import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import multer from "multer";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const DEFAULT_EXCEL_FILE = "NHL tipset 2026 jan-apr period1.xlsx";
const DEFAULT_SHEET_NAME = "Spelarna";
const DEFAULT_COMPARE_DATE = "2026-01-24";
const TIPSEN_SHEET_NAME = "Tipsen";
const TIPSEN_PLAYER_ROWS = [6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const NHL_API_BASE = "https://api-web.nhle.com/v1";
const RESPONSE_CACHE_SCHEMA_VERSION = "v3";
const DEPLOYMENT_CACHE_TOKEN = String(
  process.env.RESPONSE_CACHE_VERSION ?? process.env.RAILWAY_DEPLOYMENT_ID ?? process.env.RAILWAY_DEPLOYMENT_CREATED_AT ?? ""
).trim();
const RESPONSE_CACHE_VERSION = DEPLOYMENT_CACHE_TOKEN
  ? `${RESPONSE_CACHE_SCHEMA_VERSION}:${DEPLOYMENT_CACHE_TOKEN}`
  : RESPONSE_CACHE_SCHEMA_VERSION;
const MCP_TOOL_TIMEOUT_MS = Number.parseInt(process.env.MCP_TOOL_TIMEOUT_MS ?? "20000", 10);
const PLAYER_FETCH_CONCURRENCY = Number.parseInt(
  process.env.PLAYER_FETCH_CONCURRENCY ?? (process.env.USE_MCP_BRIDGE ? "2" : "8"),
  10
);
const MCP_MIN_CALL_INTERVAL_MS = Number.parseInt(process.env.MCP_MIN_CALL_INTERVAL_MS ?? "350", 10);
const storageRoot =
  process.env.APP_STORAGE_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  rootDir;
const dataDir = path.join(storageRoot, "data");
const settingsDbPath = process.env.SETTINGS_DB_PATH || path.join(storageRoot, "app-settings.sqlite");
const useMcpBridge = String(
  process.env.USE_MCP_BRIDGE ?? (process.env.RAILWAY_ENVIRONMENT ? "false" : "true")
).toLowerCase() === "true";
const AUTO_REFRESH_MIN_HOUR_FI = Number.parseInt(process.env.AUTO_REFRESH_MIN_HOUR_FI ?? "9", 10);
const AUTO_REFRESH_SEASON_ID = String(process.env.AUTO_REFRESH_SEASON_ID ?? "20252026");
const AUTO_REFRESH_SCHEDULER_ENABLED = String(process.env.AUTO_REFRESH_SCHEDULER_ENABLED ?? "false").toLowerCase() === "true";
const AUTO_REFRESH_CHECK_INTERVAL_MS = Number.parseInt(process.env.AUTO_REFRESH_CHECK_INTERVAL_MS ?? "900000", 10);
const STARTUP_CACHE_WARMUP_ENABLED = String(process.env.STARTUP_CACHE_WARMUP_ENABLED ?? "true").toLowerCase() === "true";
const STARTUP_CACHE_WARMUP_DELAY_MS = Number.parseInt(process.env.STARTUP_CACHE_WARMUP_DELAY_MS ?? "5000", 10);
const PERIOD3_REQUIRED_TARGET_DATE = "2026-03-15";
const PERIOD3_VALIDATOR_DEFAULT_FILE = "NHL tipset 2026 jan-apr period2.xlsx";
const PERIOD3_VALIDATOR_SEASON_ID = "20252026";
const PERIOD3_VALIDATOR_RANKING_FROM = "2025-10-07";
const PERIOD3_VALIDATOR_RANKING_TO = "2025-12-26";
const CRON_JOB_TOKEN = String(process.env.CRON_JOB_TOKEN ?? "").trim();
const ADMIN_BASIC_USER = String(process.env.ADMIN_BASIC_USER ?? "").trim();
const ADMIN_BASIC_PASS = String(process.env.ADMIN_BASIC_PASS ?? "").trim();
const ADMIN_PROTECTION_ENABLED = ADMIN_BASIC_USER.length > 0 && ADMIN_BASIC_PASS.length > 0;
const ESPN_NHL_INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries";
const appBootedAt = new Date().toISOString();
const buildTimestamp = process.env.BUILD_TIMESTAMP || process.env.RAILWAY_DEPLOYMENT_CREATED_AT || appBootedAt;

function resolveCommitSha() {
  const envCandidates = [
    process.env.RAILWAY_GIT_COMMIT_SHA,
    process.env.RAILWAY_GIT_COMMIT,
    process.env.SOURCE_VERSION,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.GITHUB_SHA,
    process.env.COMMIT_SHA,
  ];

  for (const candidate of envCandidates) {
    const value = String(candidate ?? "").trim();
    if (value) {
      return value;
    }
  }

  try {
    const gitSha = execSync("git rev-parse HEAD", {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim();

    return gitSha || "unknown";
  } catch {
    return "unknown";
  }
}

const commitSha = resolveCommitSha();

mkdirSync(storageRoot, { recursive: true });
mkdirSync(path.dirname(settingsDbPath), { recursive: true });

const app = express();
app.use(express.json());

let mcpClientPromise = null;
let mcpThrottleLock = Promise.resolve();
let mcpNextAllowedAt = 0;
let autoRefreshInProgress = false;
let injuryCache = {
  fetchedAt: 0,
  data: new Map(),
};
let period3ValidatorRankingCache = {
  cacheKey: "",
  cachedAt: 0,
  data: null,
};
const settingsDb = new Database(settingsDbPath);

settingsDb.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

settingsDb.exec(`
  CREATE TABLE IF NOT EXISTS compare_response_cache (
    cache_key TEXT PRIMARY KEY,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);

settingsDb.exec(`
  CREATE TABLE IF NOT EXISTS nyheter_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    file_name TEXT NOT NULL,
    season_id TEXT NOT NULL,
    compare_date TEXT NOT NULL,
    collected_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    UNIQUE(snapshot_date, file_name, season_id, compare_date)
  )
`);

function getSetting(key, fallback = "") {
  const row = settingsDb.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

function setSetting(key, value) {
  settingsDb
    .prepare(
      `
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
    )
    .run(key, value);
}

function clearResponseCacheOnVersionChange() {
  const settingKey = "responseCacheVersion";
  const previousVersion = String(getSetting(settingKey, "")).trim();

  if (previousVersion === RESPONSE_CACHE_VERSION) {
    return;
  }

  const removedRows = settingsDb.prepare("DELETE FROM compare_response_cache").run().changes;
  setSetting(settingKey, RESPONSE_CACHE_VERSION);
  console.log(
    `[cache] invalidated compare_response_cache due to version change (${previousVersion || "none"} -> ${RESPONSE_CACHE_VERSION}, rows=${removedRows})`
  );
}

function getCachedResponse(cacheKey) {
  const row = settingsDb
    .prepare("SELECT response_json, created_at FROM compare_response_cache WHERE cache_key = ?")
    .get(cacheKey);

  if (!row?.response_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.response_json);
    if (!parsed?.cache?.fetchedAt && row?.created_at) {
      parsed.cache = {
        ...(parsed.cache ?? {}),
        fetchedAt: row.created_at,
      };
    }
    return parsed;
  } catch {
    settingsDb.prepare("DELETE FROM compare_response_cache WHERE cache_key = ?").run(cacheKey);
    return null;
  }
}

function setCachedResponse(cacheKey, payload) {
  settingsDb
    .prepare(
      `
        INSERT INTO compare_response_cache (cache_key, response_json, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
          response_json = excluded.response_json,
          created_at = excluded.created_at
      `
    )
    .run(cacheKey, JSON.stringify(payload), new Date().toISOString());
}

function getCachedCompareResponse(cacheKey) {
  return getCachedResponse(cacheKey);
}

function setCachedCompareResponse(cacheKey, payload) {
  setCachedResponse(cacheKey, payload);
}

function dateFromParts(dateValue) {
  const [year, month, day] = String(dateValue)
    .split("-")
    .map((value) => Number.parseInt(value, 10));

  const base = new Date(Date.UTC(year, month - 1, day));
  return base;
}

function formatDateUTC(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHelsinkiDateWindowKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const todayDate = `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
  const helsinkiHour = Number.parseInt(valueByType.hour ?? "0", 10);

  if (helsinkiHour < 10) {
    const previous = dateFromParts(todayDate);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return `${formatDateUTC(previous)}_fi10`;
  }

  return `${todayDate}_fi10`;
}

function getHelsinkiTodayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function getHelsinkiNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
    hour: Number.parseInt(valueByType.hour ?? "0", 10),
  };
}

function getPreviousDateIso(dateValue) {
  const previous = dateFromParts(dateValue);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return formatDateUTC(previous);
}

function getDefaultAutoRefreshTargetDate() {
  return getPreviousDateIso(getHelsinkiTodayDate());
}

function isFinalGameState(gameState) {
  return String(gameState ?? "").trim().toUpperCase() === "OFF";
}

function hasBoxscorePlayerStats(boxscorePayload) {
  const home = boxscorePayload?.playerByGameStats?.homeTeam;
  const away = boxscorePayload?.playerByGameStats?.awayTeam;

  function teamHasStats(teamStats) {
    if (!teamStats) {
      return false;
    }

    const forwards = Array.isArray(teamStats.forwards) ? teamStats.forwards.length : 0;
    const defense = Array.isArray(teamStats.defense) ? teamStats.defense.length : 0;
    const goalies = Array.isArray(teamStats.goalies) ? teamStats.goalies.length : 0;
    return forwards + defense + goalies > 0;
  }

  return teamHasStats(home) && teamHasStats(away);
}

async function buildDataReadiness(targetDate) {
  const scorePayload = await fetchJsonDirect(`/score/${targetDate}`);
  const allGames = Array.isArray(scorePayload?.games) ? scorePayload.games : [];
  const dayGames = allGames.filter((game) => String(game?.gameDate ?? "") === targetDate);

  const nonFinalGames = dayGames
    .filter((game) => !isFinalGameState(game?.gameState))
    .map((game) => ({
      id: game?.id ?? null,
      gameState: game?.gameState ?? "",
      gameScheduleState: game?.gameScheduleState ?? "",
      startTimeUTC: game?.startTimeUTC ?? "",
      awayTeam: game?.awayTeam?.abbrev ?? "",
      homeTeam: game?.homeTeam?.abbrev ?? "",
      reason: "not_final",
    }));

  const finalGames = dayGames.filter((game) => isFinalGameState(game?.gameState));
  const statsChecks = await runWithConcurrency(finalGames, 4, async (game) => {
    try {
      const boxscorePayload = await fetchJsonDirect(`/gamecenter/${game.id}/boxscore`);
      const statsReady = hasBoxscorePlayerStats(boxscorePayload);
      return {
        id: game?.id ?? null,
        awayTeam: game?.awayTeam?.abbrev ?? "",
        homeTeam: game?.homeTeam?.abbrev ?? "",
        gameState: game?.gameState ?? "",
        statsReady,
        reason: statsReady ? "ok" : "missing_boxscore_player_stats",
      };
    } catch (error) {
      return {
        id: game?.id ?? null,
        awayTeam: game?.awayTeam?.abbrev ?? "",
        homeTeam: game?.homeTeam?.abbrev ?? "",
        gameState: game?.gameState ?? "",
        statsReady: false,
        reason: "boxscore_fetch_error",
        error: String(error?.message ?? "unknown error"),
      };
    }
  });

  const statsBlockingGames = statsChecks.filter((check) => !check.statsReady);
  const blockingGames = [...nonFinalGames, ...statsBlockingGames];
  const ready = blockingGames.length === 0;

  return {
    date: targetDate,
    timezone: "Europe/Helsinki",
    ready,
    checksAt: new Date().toISOString(),
    totalGames: dayGames.length,
    finalGames: finalGames.length,
    nonFinalGames: nonFinalGames.length,
    statsReadyGames: statsChecks.filter((check) => check.statsReady).length,
    statsBlockingGames: statsBlockingGames.length,
    blockingGames,
    nextSuggestedCheckSeconds: ready ? 0 : 300,
  };
}

async function forceRefreshTipsenForFile({ fileName, seasonId, compareDate }) {
  const params = new URLSearchParams({
    file: fileName,
    seasonId,
    compareDate,
    forceRefresh: "true",
  });

  const response = await fetch(`http://127.0.0.1:${PORT}/api/tipsen-summary?${params.toString()}`);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`tipsen refresh failed for ${fileName} (${response.status}): ${body.slice(0, 200)}`);
  }

  return {
    file: fileName,
    status: "ok",
  };
}

function parseFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildParticipantImpactFromPlayers(participantName, playerRows) {
  const ownRows = playerRows.filter((row) => row.participantName === participantName && row.playerLabel);
  if (!ownRows.length) {
    return {
      participantName,
      topContributor: "Ingen spelardata",
      topContributorDelta: "-",
      biggestDrag: "Ingen spelardata",
      biggestDragDelta: "-",
    };
  }

  const scoredRows = ownRows.filter((row) => row.deltaPoints !== null);
  if (!scoredRows.length) {
    const fallbackTop = ownRows[0];
    const fallbackBottom = ownRows[Math.min(1, ownRows.length - 1)] || ownRows[0];
    return {
      participantName,
      topContributor: String(fallbackTop.playerLabel || "Ingen spelardata"),
      topContributorDelta: "-",
      biggestDrag: String(fallbackBottom.playerLabel || "Ingen spelardata"),
      biggestDragDelta: "-",
    };
  }

  const topContributor = [...scoredRows].sort((left, right) => Number(right.deltaPoints) - Number(left.deltaPoints))[0];
  const biggestDrag = [...scoredRows].sort((left, right) => Number(left.deltaPoints) - Number(right.deltaPoints))[0];
  return {
    participantName,
    topContributor: String(topContributor.playerLabel || "Ingen spelardata"),
    topContributorDelta: Number.isFinite(Number(topContributor.deltaPoints)) ? Number(topContributor.deltaPoints) : "-",
    biggestDrag: String(biggestDrag.playerLabel || "Ingen spelardata"),
    biggestDragDelta: Number.isFinite(Number(biggestDrag.deltaPoints)) ? Number(biggestDrag.deltaPoints) : "-",
  };
}

function buildNyheterSnapshotFromTipsenPayload(payload) {
  const participants = Array.isArray(payload?.participants) ? payload.participants : [];
  const participantStandings = participants
    .map((participant) => ({
      name: String(participant?.name ?? "").trim(),
      totalDelta: parseFiniteNumber(participant?.totalDelta) ?? 0,
    }))
    .sort((left, right) => right.totalDelta - left.totalDelta)
    .map((participant, index) => ({
      rank: index + 1,
      ...participant,
    }));

  const playerRows = participants.flatMap((participant) => {
    const participantName = String(participant?.name ?? "").trim();
    const players = Array.isArray(participant?.players) ? participant.players : [];
    return players.map((player) => ({
      participantName,
      rowNumber: Number(player?.rowNumber ?? 0) || null,
      playerLabel: String(player?.playerLabel ?? "").trim(),
      teamAbbrev: String(player?.teamAbbrev ?? "").trim(),
      deltaPoints: parseFiniteNumber(player?.deltaPoints),
      source: String(player?.source ?? "").trim(),
      injuryStatus: String(player?.injury?.status ?? "").trim(),
      injuryTimeline: String(player?.injury?.timeline ?? "").trim(),
      injurySource: String(player?.injury?.source ?? "").trim(),
    }));
  });

  const scoredPlayers = playerRows.filter((row) => row.playerLabel && row.deltaPoints !== null);
  const risers = [...scoredPlayers]
    .sort((left, right) => Number(right.deltaPoints) - Number(left.deltaPoints))
    .slice(0, 8);
  const slowestClimbers = [...scoredPlayers]
    .sort((left, right) => Number(left.deltaPoints) - Number(right.deltaPoints))
    .slice(0, 8);

  const injuries = playerRows
    .filter((row) => row.playerLabel && (row.injuryStatus || row.injuryTimeline))
    .slice(0, 16);

  const sourceBreakdown = playerRows.reduce((acc, row) => {
    const key = row.source || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const playerTotals = playerRows
    .filter((row) => row.playerLabel)
    .map((row) => ({
      participantName: row.participantName,
      playerLabel: row.playerLabel,
      deltaPoints: row.deltaPoints,
    }));

  const participantImpacts = participantStandings.map((participant) =>
    buildParticipantImpactFromPlayers(participant.name, playerRows)
  );

  return {
    file: String(payload?.file ?? "").trim(),
    seasonId: String(payload?.seasonId ?? "").trim(),
    compareDate: String(payload?.compareDate ?? "").trim(),
    collectedFromCacheWindow: String(payload?.cache?.window ?? "").trim(),
    participantStandings,
    risers,
    slowestClimbers,
    participantImpacts,
    playerTotals,
    injuries,
    sourceBreakdown,
  };
}

function saveNyheterSnapshot({ snapshotDate, fileName, seasonId, compareDate, payload }) {
  const collectedAt = new Date().toISOString();
  settingsDb
    .prepare(
      `
        INSERT INTO nyheter_snapshots (
          snapshot_date,
          file_name,
          season_id,
          compare_date,
          collected_at,
          payload_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(snapshot_date, file_name, season_id, compare_date)
        DO UPDATE SET
          collected_at = excluded.collected_at,
          payload_json = excluded.payload_json
      `
    )
    .run(snapshotDate, fileName, seasonId, compareDate, collectedAt, JSON.stringify(payload));

  return collectedAt;
}

function listNyheterSnapshots({ fileName = "", seasonId = "", limit = 14 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 14, 60));
  const clauses = [];
  const params = [];

  if (fileName) {
    clauses.push("file_name = ?");
    params.push(fileName);
  }

  if (seasonId) {
    clauses.push("season_id = ?");
    params.push(seasonId);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = settingsDb
    .prepare(
      `
        SELECT snapshot_date, file_name, season_id, compare_date, collected_at, payload_json
        FROM nyheter_snapshots
        ${whereClause}
        ORDER BY snapshot_date DESC, collected_at DESC
        LIMIT ?
      `
    )
    .all(...params, normalizedLimit);

  return rows.map((row) => {
    let payload = null;
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      payload = null;
    }

    return {
      snapshotDate: row.snapshot_date,
      file: row.file_name,
      seasonId: row.season_id,
      compareDate: row.compare_date,
      collectedAt: row.collected_at,
      payload,
    };
  });
}

async function collectNyheterSnapshot({
  fileName,
  seasonId,
  compareDate,
  snapshotDate,
  forceRefresh = false,
} = {}) {
  const files = await listExcelFiles();
  if (isNyheterSnapshotCollectionPaused(files)) {
    return {
      snapshotDate: String(snapshotDate ?? getHelsinkiTodayDate()).trim(),
      file: fileName,
      seasonId,
      compareDate,
      paused: true,
      reason: "period3_excel_missing",
      requiredFromDate: PERIOD3_REQUIRED_TARGET_DATE,
    };
  }

  const params = new URLSearchParams({
    file: fileName,
    seasonId,
    compareDate,
  });

  if (forceRefresh) {
    params.set("forceRefresh", "true");
  }

  const response = await fetch(`http://127.0.0.1:${PORT}/api/tipsen-summary?${params.toString()}`);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`tipsen-summary failed (${response.status}): ${body.slice(0, 250)}`);
  }

  const tipsenPayload = JSON.parse(body);
  const normalizedSnapshotDate = String(snapshotDate ?? getHelsinkiTodayDate()).trim();
  const snapshotPayload = buildNyheterSnapshotFromTipsenPayload(tipsenPayload);
  const collectedAt = saveNyheterSnapshot({
    snapshotDate: normalizedSnapshotDate,
    fileName,
    seasonId,
    compareDate,
    payload: snapshotPayload,
  });

  return {
    snapshotDate: normalizedSnapshotDate,
    file: fileName,
    seasonId,
    compareDate,
    collectedAt,
    participants: snapshotPayload.participantStandings.length,
    risers: snapshotPayload.risers.length,
    slowestClimbers: snapshotPayload.slowestClimbers.length,
    injuries: snapshotPayload.injuries.length,
  };
}

async function runDailyAutoRefresh({
  trigger = "manual",
  date,
  seasonId = AUTO_REFRESH_SEASON_ID,
  compareDate = getSetting("compareDate", DEFAULT_COMPARE_DATE),
  force = false,
} = {}) {
  if (autoRefreshInProgress) {
    return {
      ok: true,
      executed: false,
      reason: "already_running",
      trigger,
      date: String(date ?? getDefaultAutoRefreshTargetDate()).trim(),
    };
  }

  autoRefreshInProgress = true;
  try {
    const now = getHelsinkiNowParts();
    const targetDate = String(date ?? getPreviousDateIso(now.date)).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return {
        ok: false,
        executed: false,
        reason: "invalid_date",
        error: "date must be in format YYYY-MM-DD",
        trigger,
        date: targetDate,
      };
    }

    if (!/^\d{8}$/.test(String(seasonId))) {
      return {
        ok: false,
        executed: false,
        reason: "invalid_season_id",
        error: "seasonId must be an 8-digit string, e.g. 20252026",
        trigger,
        date: targetDate,
      };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(compareDate))) {
      return {
        ok: false,
        executed: false,
        reason: "invalid_compare_date",
        error: "compareDate must be in format YYYY-MM-DD",
        trigger,
        date: targetDate,
      };
    }

    if (!force && now.hour < AUTO_REFRESH_MIN_HOUR_FI) {
      return {
        ok: true,
        executed: false,
        reason: "before_refresh_window",
        trigger,
        date: targetDate,
        nowHourFI: now.hour,
        refreshHourFI: AUTO_REFRESH_MIN_HOUR_FI,
      };
    }

    const lastSuccessDate = getSetting("autoRefreshLastSuccessDate", "");
    if (!force && lastSuccessDate === targetDate) {
      return {
        ok: true,
        executed: false,
        reason: "already_done_for_date",
        trigger,
        date: targetDate,
        lastSuccessDate,
      };
    }

    const files = await listExcelFiles();

    if (!force && targetDate >= PERIOD3_REQUIRED_TARGET_DATE && !hasPeriod3Excel(files)) {
      return {
        ok: true,
        executed: false,
        reason: "period3_excel_missing",
        trigger,
        date: targetDate,
        requiredFromDate: PERIOD3_REQUIRED_TARGET_DATE,
      };
    }

    const readiness = await buildDataReadiness(targetDate);
    if (!readiness.ready) {
      return {
        ok: true,
        executed: false,
        reason: "readiness_false",
        trigger,
        date: targetDate,
        readiness,
      };
    }

    if (!files.length) {
      return {
        ok: true,
        executed: false,
        reason: "no_excel_files",
        trigger,
        date: targetDate,
      };
    }

    const refreshResults = await runWithConcurrency(files, 2, async (fileName) => {
      try {
        return await forceRefreshTipsenForFile({ fileName, seasonId, compareDate });
      } catch (error) {
        return {
          file: fileName,
          status: "error",
          error: String(error?.message ?? "unknown error"),
        };
      }
    });

    const failed = refreshResults.filter((item) => item.status !== "ok");
    if (failed.length > 0) {
      return {
        ok: false,
        executed: false,
        reason: "refresh_failed",
        trigger,
        date: targetDate,
        results: refreshResults,
      };
    }

    const completedAt = new Date().toISOString();
    const snapshotResults = [];
    const snapshotErrors = [];

    if (isNyheterSnapshotCollectionPaused(files)) {
      setSetting("autoRefreshLastSuccessDate", targetDate);
      setSetting("autoRefreshLastRunAt", completedAt);

      return {
        ok: true,
        executed: true,
        reason: "done",
        trigger,
        date: targetDate,
        compareDate,
        seasonId,
        files: files.length,
        completedAt,
        results: refreshResults,
        snapshots: [],
        snapshotErrors: [],
        snapshotsPaused: true,
        snapshotsPauseReason: "period3_excel_missing",
        snapshotRequiredFromDate: PERIOD3_REQUIRED_TARGET_DATE,
      };
    }

    for (const fileName of files) {
      try {
        const snapshotResult = await collectNyheterSnapshot({
          fileName,
          seasonId: String(seasonId),
          compareDate: String(compareDate),
          snapshotDate: targetDate,
          forceRefresh: false,
        });
        snapshotResults.push(snapshotResult);
      } catch (error) {
        snapshotErrors.push({
          file: fileName,
          error: String(error?.message ?? "unknown error"),
        });
      }
    }

    setSetting("autoRefreshLastSuccessDate", targetDate);
    setSetting("autoRefreshLastRunAt", completedAt);

    return {
      ok: true,
      executed: true,
      reason: "done",
      trigger,
      date: targetDate,
      compareDate,
      seasonId,
      files: files.length,
      completedAt,
      results: refreshResults,
      snapshots: snapshotResults,
      snapshotErrors,
    };
  } finally {
    autoRefreshInProgress = false;
  }
}

async function warmTipsenCacheOnStartup() {
  if (!STARTUP_CACHE_WARMUP_ENABLED) {
    console.log("[cache-warmup] startup warmup disabled");
    return;
  }

  const compareDate = getSetting("compareDate", DEFAULT_COMPARE_DATE);
  const files = await listExcelFiles();
  if (!files.length) {
    console.log("[cache-warmup] skipped: no excel files found");
    return;
  }

  const warmupCandidates = [];
  for (const fileName of files) {
    try {
      const filePath = await resolveExistingExcelPath(fileName);
      const workbook = XLSX.readFile(filePath, { bookSheets: true });
      if (Array.isArray(workbook?.SheetNames) && workbook.SheetNames.includes(TIPSEN_SHEET_NAME)) {
        warmupCandidates.push(fileName);
      }
    } catch (error) {
      console.warn(`[cache-warmup] skipping ${fileName}: ${String(error?.message ?? "unknown error")}`);
    }
  }

  if (!warmupCandidates.length) {
    console.log("[cache-warmup] skipped: no files with Tipsen sheet found");
    return;
  }

  console.log(
    `[cache-warmup] started for ${warmupCandidates.length} file(s), seasonId=${AUTO_REFRESH_SEASON_ID}, compareDate=${compareDate}`
  );

  const startedAt = Date.now();
  const results = await runWithConcurrency(warmupCandidates, 1, async (fileName) => {
    try {
      return await forceRefreshTipsenForFile({
        fileName,
        seasonId: AUTO_REFRESH_SEASON_ID,
        compareDate,
      });
    } catch (error) {
      return {
        file: fileName,
        status: "error",
        error: String(error?.message ?? "unknown error"),
      };
    }
  });

  const failed = results.filter((item) => item.status !== "ok");
  const durationMs = Date.now() - startedAt;
  if (failed.length > 0) {
    console.warn(
      `[cache-warmup] completed with errors (${results.length - failed.length}/${results.length} ok, ${durationMs}ms)`
    );
    for (const item of failed) {
      console.warn(`[cache-warmup] failed ${item.file}: ${item.error}`);
    }
    return;
  }

  console.log(`[cache-warmup] completed (${results.length}/${results.length} ok, ${durationMs}ms)`);
}

function getCronTokenFromRequest(req) {
  return String(req.headers["x-cron-token"] ?? req.query.token ?? "").trim();
}

function hasNyheterCollectorAccess(req) {
  if (!CRON_JOB_TOKEN) {
    return true;
  }

  const requestToken = getCronTokenFromRequest(req);
  if (requestToken === CRON_JOB_TOKEN) {
    return true;
  }

  return hasAdminCredentials(req);
}

async function handleDailyAutoRefreshRequest(req, res) {
  const requestToken = getCronTokenFromRequest(req);
  if (CRON_JOB_TOKEN && requestToken !== CRON_JOB_TOKEN) {
    res.status(401).json({ error: "Unauthorized cron token" });
    return;
  }

  const forceRaw = String(req.query.force ?? req.body?.force ?? "").trim().toLowerCase();
  const force = ["1", "true", "yes", "y"].includes(forceRaw);
  const date = String(req.query.date ?? req.body?.date ?? "").trim() || undefined;
  const seasonId = String(req.query.seasonId ?? req.body?.seasonId ?? AUTO_REFRESH_SEASON_ID).trim();
  const compareDate = String(
    req.query.compareDate ?? req.body?.compareDate ?? getSetting("compareDate", DEFAULT_COMPARE_DATE)
  ).trim();

  const result = await runDailyAutoRefresh({
    trigger: "cron_endpoint",
    date,
    seasonId,
    compareDate,
    force,
  });

  if (!result.ok) {
    res.status(500).json(result);
    return;
  }

  res.json(result);
}

async function tryAutoRefreshFromScheduler() {
  const result = await runDailyAutoRefresh({ trigger: "scheduler" });
  const summary = `${result.reason} (executed=${result.executed ? "yes" : "no"})`;
  console.log(`[auto-refresh] ${summary}`);
}

if (!getSetting("compareDate")) {
  setSetting("compareDate", DEFAULT_COMPARE_DATE);
}

clearResponseCacheOnVersionChange();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeLastNameInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const withoutInitials = raw
    .replace(/^[a-z]\.?\s+/i, "")
    .replace(/^[a-z]\.?$/i, "");

  const parts = withoutInitials.split(/\s+/).filter(Boolean);
  const candidate = parts.length > 1 ? parts[parts.length - 1] : withoutInitials;
  return normalizeText(candidate);
}

function extractFirstInitial(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const compact = raw
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/^[a-z]\.\s*/i, (match) => match.replace(/\./g, ""));
  const normalized = normalizeText(compact);
  return normalized ? normalized[0] : "";
}

function extractDisplayLastNameFromFullName(fullNameValue) {
  const fullName = String(fullNameValue ?? "").trim();
  if (!fullName) {
    return "";
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }

  return parts[parts.length - 1];
}

function normalizeTipsenTeamToken(value) {
  const token = normalizeText(value);
  const aliasMap = {
    ana: "ANA",
    bos: "BOS",
    buf: "BUF",
    car: "CAR",
    cbj: "CBJ",
    col: "COL",
    colu: "CBJ",
    dal: "DAL",
    det: "DET",
    edm: "EDM",
    flo: "FLA",
    lak: "LAK",
    la: "LAK",
    min: "MIN",
    mon: "MTL",
    mtl: "MTL",
    nas: "NSH",
    nsh: "NSH",
    njd: "NJD",
    nyr: "NYR",
    ott: "OTT",
    phi: "PHI",
    pit: "PIT",
    sjs: "SJS",
    tam: "TBL",
    tbl: "TBL",
    tor: "TOR",
    uta: "UTA",
    vgk: "VGK",
    veg: "VGK",
    was: "WSH",
    wsh: "WSH",
    win: "WPG",
    wpg: "WPG",
  };

  return aliasMap[token] ?? String(value ?? "").trim().toUpperCase();
}

function parseTipsenPlayerCell(cellValue) {
  const raw = String(cellValue ?? "").trim();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return {
      playerLabel: raw,
      playerName: raw,
      lastNameNormalized: normalizeLastNameInput(raw),
      firstInitial: extractFirstInitial(raw),
      hasGivenNameHint: /\s/.test(raw),
      teamAbbrev: "",
    };
  }

  const playerName = String(match[1] ?? "").trim();
  const teamToken = String(match[2] ?? "").trim();
  return {
    playerLabel: raw,
    playerName,
    lastNameNormalized: normalizeLastNameInput(playerName),
    firstInitial: extractFirstInitial(playerName),
    hasGivenNameHint: /\s/.test(playerName),
    teamAbbrev: normalizeTipsenTeamToken(teamToken),
  };
}

function buildPlayerLastTeamKey(playerName, teamAbbrev) {
  const lastName = normalizeLastNameInput(playerName);
  const team = normalizeTipsenTeamToken(teamAbbrev);
  if (!lastName || !team) {
    return "";
  }
  return `${lastName}|${team}`;
}

function buildPlayerFullTeamKey(playerName, teamAbbrev) {
  const fullName = normalizePersonName(playerName);
  const team = normalizeTipsenTeamToken(teamAbbrev);
  if (!fullName || !team) {
    return "";
  }
  return `${fullName}|${team}`;
}

function parsePeriod3RosterText(rosterText) {
  const lines = String(rosterText ?? "").split(/\r?\n/);
  const sectionMap = {
    maalivahdit: "goalie",
    puolustajat: "defense",
    hyokkaajat: "forward",
  };

  const players = [];
  const parseErrors = [];
  let currentRole = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] ?? "").trim();
    if (!line) {
      continue;
    }

    const normalizedHeading = normalizeText(line.replace(/:$/, ""));
    if (sectionMap[normalizedHeading]) {
      currentRole = sectionMap[normalizedHeading];
      continue;
    }

    if (!currentRole) {
      parseErrors.push(`Rivi ${index + 1}: otsikko puuttuu ennen pelaajariviä ('${line}')`);
      continue;
    }

    const separatorIndex = line.lastIndexOf(",");
    if (separatorIndex < 0) {
      parseErrors.push(`Rivi ${index + 1}: pelaajarivin muoto pitää olla 'Nimi, JOUKKUE'`);
      continue;
    }

    const playerName = String(line.slice(0, separatorIndex)).trim();
    const inputTeam = String(line.slice(separatorIndex + 1)).trim();
    const teamAbbrev = normalizeTipsenTeamToken(inputTeam);

    if (!playerName || !teamAbbrev) {
      parseErrors.push(`Rivi ${index + 1}: pelaajan nimi tai joukkuekoodi puuttuu`);
      continue;
    }

    players.push({
      row: index + 1,
      role: currentRole,
      playerName,
      teamAbbrev,
      lastTeamKey: buildPlayerLastTeamKey(playerName, teamAbbrev),
      fullTeamKey: buildPlayerFullTeamKey(playerName, teamAbbrev),
    });
  }

  return {
    players,
    parseErrors,
  };
}

function addEntryToMapArray(map, key, entry) {
  if (!key) {
    return;
  }
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(entry);
}

function findRankEntry(player, byFullKey, byLastKey) {
  const fullMatches = byFullKey.get(player.fullTeamKey) ?? [];
  if (fullMatches.length === 1) {
    return { entry: fullMatches[0], warning: "" };
  }
  if (fullMatches.length > 1) {
    return {
      entry: fullMatches[0],
      warning: `${player.playerName} (${player.teamAbbrev}): useita full-name osumia rankingissa, käytetään parasta rankia`,
    };
  }

  const lastMatches = byLastKey.get(player.lastTeamKey) ?? [];
  if (lastMatches.length === 1) {
    return { entry: lastMatches[0], warning: "" };
  }
  if (lastMatches.length > 1) {
    return {
      entry: lastMatches[0],
      warning: `${player.playerName} (${player.teamAbbrev}): useita surname-osumia rankingissa, käytetään parasta rankia`,
    };
  }

  return {
    entry: null,
    warning: `${player.playerName} (${player.teamAbbrev}): ei löytynyt rankinglistalta`,
  };
}

async function buildPeriod2OwnershipIndex(fileName) {
  const filePath = await resolveExistingExcelPath(fileName);
  const workbook = XLSX.readFile(filePath);
  const tipsenSheet = workbook.Sheets[TIPSEN_SHEET_NAME];
  if (!tipsenSheet) {
    throw new Error(`Sheet '${TIPSEN_SHEET_NAME}' not found in ${fileName}`);
  }

  const rows = XLSX.utils.sheet_to_json(tipsenSheet, { header: 1, defval: "" });
  const participantNameRow = rows[2] ?? [];
  const participantHeaderRow = rows[3] ?? [];
  const participantColumns = [];

  for (let col = 0; col < participantHeaderRow.length; col += 1) {
    if (normalizeText(participantHeaderRow[col]) !== "spelare") {
      continue;
    }

    const participantName = String(participantNameRow[col] ?? "").trim();
    if (!participantName) {
      continue;
    }

    participantColumns.push({
      name: participantName,
      playerCol: col,
    });
  }

  const byLastTeam = new Map();
  for (const participant of participantColumns) {
    for (const rowNumber of TIPSEN_PLAYER_ROWS) {
      const row = rows[rowNumber - 1] ?? [];
      const parsed = parseTipsenPlayerCell(row[participant.playerCol]);
      if (!parsed?.playerName || !parsed?.teamAbbrev) {
        continue;
      }

      const key = buildPlayerLastTeamKey(parsed.playerName, parsed.teamAbbrev);
      if (!key) {
        continue;
      }

      if (!byLastTeam.has(key)) {
        byLastTeam.set(key, new Set());
      }
      byLastTeam.get(key).add(participant.name);
    }
  }

  return {
    byLastTeam,
  };
}

async function buildPeriod3RankingData({ fileName, seasonId, fromDate, toDate }) {
  const cacheKey = `${fileName}|${seasonId}|${fromDate}|${toDate}`;
  const cacheFreshMs = 10 * 60 * 1000;
  if (
    period3ValidatorRankingCache.data &&
    period3ValidatorRankingCache.cacheKey === cacheKey &&
    Date.now() - period3ValidatorRankingCache.cachedAt < cacheFreshMs
  ) {
    return period3ValidatorRankingCache.data;
  }

  const { resolvedPlayers } = await resolvePlayersForFile(fileName);
  const rankedRows = await runWithConcurrency(resolvedPlayers, PLAYER_FETCH_CONCURRENCY, async (player) => {
    try {
      const [landing, gameLogPayload] = await Promise.all([
        fetchJson(`/player/${player.playerId}/landing`),
        fetchJson(`/player/${player.playerId}/game-log/${seasonId}/2`),
      ]);

      const gameLog = Array.isArray(gameLogPayload?.gameLog) ? gameLogPayload.gameLog : [];
      const windowGames = gameLog.filter(
        (game) => String(game?.gameDate ?? "") >= fromDate && String(game?.gameDate ?? "") <= toDate
      );
      const isGoalie = String(landing?.position ?? "").toUpperCase() === "G" || player.sourceSectionType === "goalies";
      const fullName =
        `${landing?.firstName?.default ?? ""} ${landing?.lastName?.default ?? ""}`.trim() ||
        String(player.fullName ?? "").trim();
      const teamAbbrev = String(landing?.currentTeamAbbrev ?? player.matchedTeamAbbrev ?? player.inputTeamAbbrev ?? "")
        .trim()
        .toUpperCase();

      if (!teamAbbrev) {
        return null;
      }

      return {
        fullName,
        teamAbbrev,
        sourceSectionType: player.sourceSectionType,
        isGoalie,
        points: isGoalie ? 0 : windowGames.reduce((sum, game) => sum + Number(game?.points ?? 0), 0),
        goals: isGoalie ? 0 : windowGames.reduce((sum, game) => sum + Number(game?.goals ?? 0), 0),
        wins: isGoalie ? windowGames.filter((game) => String(game?.decision ?? "").toUpperCase() === "W").length : 0,
      };
    } catch {
      return null;
    }
  });

  const availableRows = rankedRows.filter(Boolean);
  const skaters = availableRows
    .filter((row) => !row.isGoalie)
    .sort((left, right) => right.points - left.points || right.goals - left.goals || left.fullName.localeCompare(right.fullName));
  const goalies = availableRows
    .filter((row) => row.isGoalie)
    .sort((left, right) => right.wins - left.wins || left.fullName.localeCompare(right.fullName));

  const skaterByFullKey = new Map();
  const skaterByLastKey = new Map();
  for (let index = 0; index < skaters.length; index += 1) {
    const row = skaters[index];
    const entry = {
      ...row,
      rank: index + 1,
      fullTeamKey: buildPlayerFullTeamKey(row.fullName, row.teamAbbrev),
      lastTeamKey: buildPlayerLastTeamKey(row.fullName, row.teamAbbrev),
    };

    addEntryToMapArray(skaterByFullKey, entry.fullTeamKey, entry);
    addEntryToMapArray(skaterByLastKey, entry.lastTeamKey, entry);
  }

  const goalieByFullKey = new Map();
  const goalieByLastKey = new Map();
  for (let index = 0; index < goalies.length; index += 1) {
    const row = goalies[index];
    const entry = {
      ...row,
      rank: index + 1,
      fullTeamKey: buildPlayerFullTeamKey(row.fullName, row.teamAbbrev),
      lastTeamKey: buildPlayerLastTeamKey(row.fullName, row.teamAbbrev),
    };

    addEntryToMapArray(goalieByFullKey, entry.fullTeamKey, entry);
    addEntryToMapArray(goalieByLastKey, entry.lastTeamKey, entry);
  }

  const data = {
    skaterByFullKey,
    skaterByLastKey,
    goalieByFullKey,
    goalieByLastKey,
  };

  period3ValidatorRankingCache = {
    cacheKey,
    cachedAt: Date.now(),
    data,
  };

  return data;
}

async function validatePeriod3TeamSelection({
  participantName,
  rosterText,
  fileName,
  seasonId,
  rankingFrom,
  rankingTo,
}) {
  const errors = [];
  const warnings = [];

  const parsed = parsePeriod3RosterText(rosterText);
  if (parsed.parseErrors.length) {
    errors.push(...parsed.parseErrors);
    return {
      status: "FAIL",
      errors,
      warnings,
      diagnostics: {},
    };
  }

  const roster = parsed.players;
  const roleCounts = {
    goalies: roster.filter((item) => item.role === "goalie").length,
    defense: roster.filter((item) => item.role === "defense").length,
    forwards: roster.filter((item) => item.role === "forward").length,
  };

  if (roleCounts.goalies !== 2 || roleCounts.defense !== 4 || roleCounts.forwards !== 6) {
    errors.push(
      `Roolijakauma virhe: odotettu 2 maalivahtia, 4 puolustajaa, 6 hyökkääjää (nyt ${roleCounts.goalies}/${roleCounts.defense}/${roleCounts.forwards})`
    );
  }

  if (roster.length !== 12) {
    errors.push(`Kokonaispelaajamäärä virhe: odotettu 12, nyt ${roster.length}`);
  }

  const seenPlayers = new Set();
  for (const player of roster) {
    if (!player.lastTeamKey) {
      continue;
    }
    if (seenPlayers.has(player.lastTeamKey)) {
      errors.push(`Duplikaattipelaaja: ${player.playerName} (${player.teamAbbrev})`);
    }
    seenPlayers.add(player.lastTeamKey);
  }

  const teamCounts = roster.reduce((acc, player) => {
    const key = player.teamAbbrev;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  for (const [teamAbbrev, count] of Object.entries(teamCounts)) {
    if (count > 2) {
      errors.push(`Liikaa pelaajia samasta joukkueesta: ${teamAbbrev} (${count} kpl, max 2)`);
    }
  }

  const ownership = await buildPeriod2OwnershipIndex(fileName);
  for (const player of roster) {
    const owners = ownership.byLastTeam.get(player.lastTeamKey);
    if (!owners || owners.size === 0) {
      continue;
    }
    if (!owners.has(participantName)) {
      const ownerNames = Array.from(owners.values()).sort((a, b) => a.localeCompare(b));
      errors.push(
        `Omistussääntö rikki: ${player.playerName} (${player.teamAbbrev}) oli period 2:ssa osallistujalla ${ownerNames.join(", ")}, ei ${participantName}`
      );
    }
  }

  const ranking = await buildPeriod3RankingData({
    fileName,
    seasonId,
    fromDate: rankingFrom,
    toDate: rankingTo,
  });

  const selectedSkaters = roster.filter((item) => item.role !== "goalie");
  const selectedGoalies = roster.filter((item) => item.role === "goalie");

  const skaterRanks = [];
  for (const skater of selectedSkaters) {
    const match = findRankEntry(skater, ranking.skaterByFullKey, ranking.skaterByLastKey);
    if (match.warning) {
      warnings.push(match.warning);
    }
    if (match.entry) {
      skaterRanks.push(match.entry.rank);
    }
  }

  const skaterBandCounts = {};
  for (const rank of skaterRanks) {
    const band = Math.floor((rank - 1) / 10) + 1;
    skaterBandCounts[band] = (skaterBandCounts[band] ?? 0) + 1;
  }

  const maxBand = Math.max(0, ...Object.keys(skaterBandCounts).map((value) => Number.parseInt(value, 10)));
  let cumulative = 0;
  for (let band = 1; band <= maxBand; band += 1) {
    cumulative += skaterBandCounts[band] ?? 0;
    if (cumulative > band) {
      errors.push(
        `Ulkopelaajien bandisääntö rikki: bandeista 1-${band} valittu ${cumulative} pelaajaa (max ${band})`
      );
      break;
    }
  }

  const goalieRanks = [];
  for (const goalie of selectedGoalies) {
    const match = findRankEntry(goalie, ranking.goalieByFullKey, ranking.goalieByLastKey);
    if (match.warning) {
      warnings.push(match.warning);
    }
    if (match.entry) {
      goalieRanks.push(match.entry.rank);
    }
  }

  if (goalieRanks.length === 2) {
    const goalieRankSum = goalieRanks[0] + goalieRanks[1];
    if (goalieRankSum < 30) {
      errors.push(`Maalivahtien rank-summa liian pieni: ${goalieRankSum} (min 30)`);
    }
  } else if (selectedGoalies.length === 2) {
    warnings.push("Maalivahtien rank-summaa ei voitu varmistaa täysin, koska rankingosuma puuttuu");
  }

  return {
    status: errors.length > 0 ? "FAIL" : "PASS",
    errors,
    warnings,
    diagnostics: {
      participantName,
      roleCounts,
      teamCounts,
      skaterBandCounts,
      knownSkaterRanks: skaterRanks,
      knownGoalieRanks: goalieRanks,
      rankingWindow: {
        from: rankingFrom,
        to: rankingTo,
      },
    },
  };
}

function buildCompareIndexes(compareItems) {
  const byTeamAndLast = new Map();
  const byTeamLastAndInitial = new Map();
  const byLastName = new Map();
  const byLastAndInitial = new Map();

  for (const item of compareItems ?? []) {
    if (item?.status !== "ok") {
      continue;
    }

    const teamAbbrev = String(item.teamAbbrev ?? "").trim().toUpperCase();
    const itemName = item.inputName || item.fullName || "";
    const lastNameNormalized = normalizeLastNameInput(itemName);
    const firstInitial = extractFirstInitial(itemName);
    if (!lastNameNormalized) {
      continue;
    }

    if (teamAbbrev) {
      byTeamAndLast.set(`${teamAbbrev}|${lastNameNormalized}`, item);
      if (firstInitial) {
        const key = `${teamAbbrev}|${lastNameNormalized}|${firstInitial}`;
        if (!byTeamLastAndInitial.has(key)) {
          byTeamLastAndInitial.set(key, []);
        }
        byTeamLastAndInitial.get(key).push(item);
      }
    }

    if (!byLastName.has(lastNameNormalized)) {
      byLastName.set(lastNameNormalized, []);
    }
    byLastName.get(lastNameNormalized).push(item);

    if (firstInitial) {
      const key = `${lastNameNormalized}|${firstInitial}`;
      if (!byLastAndInitial.has(key)) {
        byLastAndInitial.set(key, []);
      }
      byLastAndInitial.get(key).push(item);
    }
  }

  return { byTeamAndLast, byTeamLastAndInitial, byLastName, byLastAndInitial };
}

function pickTipsenTeamCandidate(players, parsedCell) {
  if (!Array.isArray(players) || players.length === 0) {
    return null;
  }

  const byLastName = players.filter(
    (candidate) => normalizeLastNameInput(candidate?.lastName?.default ?? "") === parsedCell.lastNameNormalized
  );

  const exactPool = byLastName.length > 0 ? byLastName : players;
  const byInitial = parsedCell.firstInitial && parsedCell.hasGivenNameHint
    ? exactPool.filter(
        (candidate) => extractFirstInitial(candidate?.firstName?.default ?? "") === parsedCell.firstInitial
      )
    : exactPool;

  const narrowed = byInitial.length > 0 ? byInitial : exactPool;

  const fuzzyCandidates = narrowed
    .map((candidate) => {
      const candidateLastName = normalizeLastNameInput(candidate?.lastName?.default ?? "");
      const distance = levenshteinDistance(parsedCell.lastNameNormalized, candidateLastName);
      const samePrefix = parsedCell.lastNameNormalized.slice(0, 4) === candidateLastName.slice(0, 4);
      return {
        candidate,
        distance,
        samePrefix,
      };
    })
    .filter((entry) => {
      const input = parsedCell.lastNameNormalized;
      const target = normalizeLastNameInput(entry.candidate?.lastName?.default ?? "");
      if (!target || !input) {
        return false;
      }

      if (target === input) {
        return true;
      }

      if (entry.samePrefix && entry.distance <= 5) {
        return true;
      }

      return target.includes(input) || input.includes(target);
    })
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      return (right.candidate?.points ?? 0) - (left.candidate?.points ?? 0);
    });

  return fuzzyCandidates[0]?.candidate ?? null;
}

async function resolveTipsenLiveSnapshot({ parsedCell, seasonId, compareDate, teamCache, snapshotCache }) {
  const cacheKey = `${parsedCell.teamAbbrev}|${parsedCell.lastNameNormalized}|${parsedCell.firstInitial}`;
  if (snapshotCache.has(cacheKey)) {
    return snapshotCache.get(cacheKey);
  }

  if (!parsedCell.teamAbbrev || !parsedCell.lastNameNormalized) {
    snapshotCache.set(cacheKey, null);
    return null;
  }

  if (!teamCache.has(parsedCell.teamAbbrev)) {
    teamCache.set(parsedCell.teamAbbrev, await buildTeamPlayerIndex(parsedCell.teamAbbrev));
  }

  const teamBundle = teamCache.get(parsedCell.teamAbbrev);
  const teamPlayers = teamBundle?.players ?? [];
  const candidate = pickTipsenTeamCandidate(teamPlayers, parsedCell);

  if (!candidate?.playerId) {
    snapshotCache.set(cacheKey, null);
    return null;
  }

  try {
    const [landing, gameLogPayload] = await Promise.all([
      fetchJsonDirect(`/player/${candidate.playerId}/landing`),
      fetchJsonDirect(`/player/${candidate.playerId}/game-log/${seasonId}/2`),
    ]);

    const gameLog = Array.isArray(gameLogPayload?.gameLog) ? gameLogPayload.gameLog : [];
    const gamesUntilDate = gameLog.filter((game) => String(game.gameDate) <= compareDate);
    const isGoalie = String(landing?.position ?? "").toUpperCase() === "G";
    const comparePoints = isGoalie
      ? sumGoalieFantasyPoints(gamesUntilDate)
      : gamesUntilDate.reduce((sum, game) => sum + Number(game?.points ?? 0), 0);
    const todayPoints = isGoalie ? sumGoalieFantasyPoints(gameLog) : Number(candidate?.points ?? 0);
    const deltaPoints = Number.isFinite(todayPoints) && Number.isFinite(comparePoints) ? todayPoints - comparePoints : null;
    const fullName = `${landing?.firstName?.default ?? ""} ${landing?.lastName?.default ?? ""}`.trim();

    const snapshot = {
      deltaPoints,
      matchedFullName: fullName,
      matchedLastName: String(landing?.lastName?.default ?? "").trim(),
      teamAbbrev: String(landing?.currentTeamAbbrev ?? parsedCell.teamAbbrev ?? "").trim().toUpperCase(),
      source: "nhl_live_fallback",
    };
    snapshotCache.set(cacheKey, snapshot);
    return snapshot;
  } catch {
    snapshotCache.set(cacheKey, null);
    return null;
  }
}

function getSectionColumns(headerRow) {
  let nameCol = 0;
  let teamCol = -1;
  let totalCol = -1;
  let startCol = -1;
  let deltaCol = -1;

  for (let col = 0; col < headerRow.length; col += 1) {
    const normalized = normalizeText(headerRow[col]);
    if (!normalized) {
      continue;
    }

    if (normalized === "spelare" || normalized === "malvakter" || normalized === "utespelare") {
      nameCol = col;
    }
    if (normalized === "lag") {
      teamCol = col;
    }
    if (normalized.includes("totalt")) {
      totalCol = col;
    }
    if (normalized === "start") {
      startCol = col;
    }
    if (normalized.includes("period")) {
      deltaCol = col;
    }
  }

  return { nameCol, teamCol, totalCol, startCol, deltaCol };
}

function parseSpelarnaReferenceRows(sheetRows) {
  const sections = [];

  for (let rowIndex = 0; rowIndex < sheetRows.length; rowIndex += 1) {
    const row = sheetRows[rowIndex] ?? [];
    const firstCell = normalizeText(row[0]);
    if (firstCell !== "malvakter" && firstCell !== "utespelare") {
      continue;
    }

    const sectionType = firstCell === "malvakter" ? "goalies" : "skaters";
    const columns = getSectionColumns(row);
    if (columns.teamCol < 0 || columns.totalCol < 0 || columns.startCol < 0 || columns.deltaCol < 0) {
      continue;
    }

    const items = [];
    for (let dataIndex = rowIndex + 1; dataIndex < sheetRows.length; dataIndex += 1) {
      const dataRow = sheetRows[dataIndex] ?? [];
      const first = normalizeText(dataRow[0]);
      if (first === "malvakter" || first === "utespelare" || first === "totalpoang") {
        break;
      }

      const name = String(dataRow[columns.nameCol] ?? "").trim();
      const team = String(dataRow[columns.teamCol] ?? "").trim();
      const total = Number(dataRow[columns.totalCol]);
      const start = Number(dataRow[columns.startCol]);
      const delta = Number(dataRow[columns.deltaCol]);

      if (!name || !team || !Number.isFinite(total) || !Number.isFinite(start) || !Number.isFinite(delta)) {
        continue;
      }

      items.push({
        rowNumber: dataIndex + 1,
        name,
        team,
        excelTotal: total,
        excelStart: start,
        excelDelta: delta,
      });
    }

    sections.push({ sectionType, items });
  }

  return sections;
}

function isLikelyPlayerRow(lastName, teamName) {
  const normalizedLast = normalizeText(lastName);
  const normalizedTeam = normalizeText(teamName);

  if (!normalizedLast) {
    return false;
  }

  const invalidLastTokens = new Set([
    "allavaldaspelare",
    "malvakter",
    "backar",
    "forwards",
    "forwardsforwards",
    "anfallare",
    "antal",
    "poang",
    "totalt",
    "start",
    "period2",
    "lag",
  ]);

  if (invalidLastTokens.has(normalizedLast)) {
    return false;
  }

  const invalidTeamTokens = new Set(["lag", "", "antal", "poang", "totalt", "start", "period2"]);
  if (invalidTeamTokens.has(normalizedTeam)) {
    return false;
  }

  return true;
}

function pickField(row, keys) {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key);
    if (keys.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error) {
  const message = String(error?.message ?? "");
  return /\b429\b|rate.?limit|too many requests/i.test(message);
}

function isTransientUpstreamError(error) {
  const message = String(error?.message ?? "");
  return /\b429\b|rate.?limit|too many requests|timeout|timed out|econnreset|socket hang up|fetch failed/i.test(
    message
  );
}

async function waitForMcpThrottleSlot() {
  if (!useMcpBridge || MCP_MIN_CALL_INTERVAL_MS <= 0) {
    return;
  }

  let releaseLock = null;
  const previousLock = mcpThrottleLock;
  mcpThrottleLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  await previousLock;
  try {
    const waitMs = Math.max(0, mcpNextAllowedAt - Date.now());
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    mcpNextAllowedAt = Date.now() + MCP_MIN_CALL_INTERVAL_MS;
  } finally {
    releaseLock();
  }
}

async function fetchJson(pathname) {
  if (!useMcpBridge) {
    return fetchJsonDirect(pathname);
  }

  const routeMap = [
    {
      pattern: /^\/standings\/now$/,
      call: () => callMcpTool("get_standings_now", {}),
    },
    {
      pattern: /^\/club-stats\/([A-Z]{2,3})\/now$/,
      call: (match) => callMcpTool("get_team_stats_now", { teamAbbrev: match[1] }),
    },
    {
      pattern: /^\/player\/(\d+)\/landing$/,
      call: (match) => callMcpTool("get_player_landing", { playerId: Number.parseInt(match[1], 10) }),
    },
    {
      pattern: /^\/player\/(\d+)\/game-log\/(\d{8})\/(\d+)$/,
      call: (match) => callMcpTool("get_player_game_log", {
        playerId: Number.parseInt(match[1], 10),
        seasonId: match[2],
        gameTypeId: Number.parseInt(match[3], 10),
      }),
    },
  ];

  for (const route of routeMap) {
    const match = pathname.match(route.pattern);
    if (match) {
      try {
        return await route.call(match);
      } catch (error) {
        if (!isTransientUpstreamError(error)) {
          throw error;
        }

        console.warn(`MCP request failed for ${pathname}, falling back to direct NHL API: ${error.message}`);
        return fetchJsonDirect(pathname);
      }
    }
  }

  throw new Error(`Unsupported MCP-mapped path: ${pathname}`);
}

async function fetchJsonDirect(pathname) {
  const url = `${NHL_API_BASE}${pathname}`;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "nhl-stats-web/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`NHL API ${response.status}: ${body.slice(0, 300)}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      if (isRateLimitError(error)) {
        await sleep(attempt * 2000);
      } else {
        await sleep(attempt * 500);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Failed direct NHL API fetch: ${pathname}`);
}

function normalizePersonName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatInjuryTimeline(injuryItem) {
  const returnDate = String(injuryItem?.details?.returnDate ?? "").trim();
  const shortComment = String(injuryItem?.shortComment ?? "").trim();
  const longComment = String(injuryItem?.longComment ?? "").trim();

  if (shortComment && /day-to-day/i.test(shortComment)) {
    return shortComment;
  }

  if (longComment && /day-to-day/i.test(longComment)) {
    return longComment;
  }

  if (returnDate) {
    return `At least ${returnDate}`;
  }

  if (shortComment) {
    return shortComment;
  }

  if (longComment) {
    return longComment;
  }

  return "";
}

async function fetchEspnNhlInjuries() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(ESPN_NHL_INJURIES_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "nhl-stats-web/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ESPN injuries ${response.status}: ${body.slice(0, 200)}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildInjuryLookup(payload) {
  const map = new Map();
  const teams = Array.isArray(payload?.injuries) ? payload.injuries : [];

  for (const teamEntry of teams) {
    const injuries = Array.isArray(teamEntry?.injuries) ? teamEntry.injuries : [];

    for (const injuryItem of injuries) {
      const athleteName = injuryItem?.athlete?.displayName;
      const nameKey = normalizePersonName(athleteName);
      if (!nameKey) {
        continue;
      }

      const status = String(injuryItem?.status ?? injuryItem?.type?.description ?? "").trim() || "Injured";
      const timeline = formatInjuryTimeline(injuryItem);
      map.set(nameKey, {
        status,
        timeline,
        source: "espn",
      });
    }
  }

  return map;
}

async function getInjuryLookup() {
  const now = Date.now();
  const maxAgeMs = 15 * 60 * 1000;
  if (injuryCache.data.size > 0 && now - injuryCache.fetchedAt < maxAgeMs) {
    return injuryCache.data;
  }

  try {
    const payload = await fetchEspnNhlInjuries();
    const lookup = buildInjuryLookup(payload);
    injuryCache = {
      fetchedAt: now,
      data: lookup,
    };
    return lookup;
  } catch (error) {
    console.warn(`Injury lookup unavailable: ${error.message}`);
    return injuryCache.data;
  }
}

function resolveInjuryForPlayer({ matchedFullName, playerLabel }, injuryLookup) {
  const fullNameKey = normalizePersonName(matchedFullName);
  if (fullNameKey && injuryLookup.has(fullNameKey)) {
    return injuryLookup.get(fullNameKey);
  }

  const labelKey = normalizePersonName(playerLabel);
  if (labelKey && injuryLookup.has(labelKey)) {
    return injuryLookup.get(labelKey);
  }

  return null;
}

function getResultText(result) {
  const textContent = (result?.content ?? []).find((part) => part?.type === "text")?.text;
  if (!textContent) {
    throw new Error("MCP tool returned empty response content");
  }
  return textContent;
}

function parseToolJson(result) {
  const text = getResultText(result);

  if (result?.isError) {
    throw new Error(`MCP tool error: ${text}`);
  }

  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    throw new Error(`MCP non-JSON response: ${trimmed.slice(0, 200)}`);
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`MCP JSON parse failed: ${error.message}; payload: ${trimmed.slice(0, 200)}`);
  }
}

async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/server.js"],
    cwd: rootDir,
  });

  const client = new Client(
    {
      name: "nhl-stats-web-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  return client;
}

async function getMcpClient() {
  if (!mcpClientPromise) {
    mcpClientPromise = createMcpClient();
  }

  try {
    return await mcpClientPromise;
  } catch (error) {
    mcpClientPromise = null;
    throw error;
  }
}

async function callMcpTool(name, args) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let timeoutId = null;
    try {
      await waitForMcpThrottleSlot();
      const client = await getMcpClient();
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`MCP tool timeout after ${MCP_TOOL_TIMEOUT_MS}ms (${name})`));
        }, MCP_TOOL_TIMEOUT_MS);
      });

      const result = await Promise.race([client.callTool({ name, arguments: args }), timeoutPromise]);
      return parseToolJson(result);
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      const backoffMs = isRateLimitError(error) ? attempt * 3000 : attempt * 500;
      await sleep(backoffMs);
      mcpClientPromise = null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  throw new Error(`Failed MCP tool call: ${name}`);
}

function extractSeasonStats(playerLanding, seasonId) {
  const requested = Number.parseInt(String(seasonId), 10);
  const seasonRow = (playerLanding.seasonTotals ?? []).find(
    (row) => row?.season === requested && row?.gameTypeId === 2 && row?.leagueAbbrev === "NHL"
  );

  const featured = playerLanding?.featuredStats?.regularSeason?.subSeason;
  const featuredSeason = playerLanding?.featuredStats?.season;

  if (seasonRow) {
    return {
      gamesPlayed: seasonRow.gamesPlayed ?? null,
      goals: seasonRow.goals ?? null,
      assists: seasonRow.assists ?? null,
      points: seasonRow.points ?? null,
      pim: seasonRow.pim ?? null,
      plusMinus: seasonRow.plusMinus ?? null,
      shots: seasonRow.shots ?? null,
    };
  }

  if (featured && Number(featuredSeason) === requested) {
    return {
      gamesPlayed: featured.gamesPlayed ?? null,
      goals: featured.goals ?? null,
      assists: featured.assists ?? null,
      points: featured.points ?? null,
      pim: featured.pim ?? null,
      plusMinus: featured.plusMinus ?? null,
      shots: featured.shots ?? null,
    };
  }

  return null;
}

function getGoalieGameFantasyPoints(game) {
  const isWin = String(game?.decision ?? "").toUpperCase() === "W";
  const winsPoints = isWin ? 2 : 0;
  const skaterPoints = Number(game?.goals ?? 0) + Number(game?.assists ?? 0);
  const shutoutPoints = Number(game?.shutouts ?? 0) > 0 ? 2 : 0;
  return winsPoints + skaterPoints + shutoutPoints;
}

function sumGoalieFantasyPoints(games) {
  return (games ?? []).reduce((sum, game) => sum + getGoalieGameFantasyPoints(game), 0);
}

async function listExcelFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  const [rootEntries, dataEntries] = await Promise.all([
    fs.readdir(rootDir, { withFileTypes: true }),
    fs.readdir(dataDir, { withFileTypes: true }),
  ]);

  const rootFiles = rootEntries
    .filter((entry) => entry.isFile() && /\.(xlsx|xls)$/i.test(entry.name) && !entry.name.startsWith("~$"))
    .map((entry) => entry.name);

  const dataFiles = dataEntries
    .filter((entry) => entry.isFile() && /\.(xlsx|xls)$/i.test(entry.name) && !entry.name.startsWith("~$"))
    .map((entry) => entry.name);

  return Array.from(new Set([...rootFiles, ...dataFiles])).sort((a, b) => a.localeCompare(b));
}

function hasPeriod3Excel(files) {
  return (files ?? []).some((fileName) => /period\s*3/i.test(String(fileName ?? "")));
}

function isNyheterSnapshotCollectionPaused(files) {
  return !hasPeriod3Excel(files);
}

function toSafeDataPath(fileName) {
  const baseName = path.basename(fileName);
  const dataPath = path.resolve(dataDir, baseName);
  const rootPath = path.resolve(rootDir, baseName);

  if (!dataPath.startsWith(dataDir) || !rootPath.startsWith(rootDir)) {
    throw new Error("Invalid file path");
  }

  return { dataPath, rootPath, baseName };
}

async function resolveExistingExcelPath(fileName) {
  const { dataPath, rootPath } = toSafeDataPath(fileName);
  try {
    await fs.access(rootPath);
    return rootPath;
  } catch {
  }

  try {
    await fs.access(dataPath);
    return dataPath;
  } catch {
  }

  throw new Error(`Excel file not found: ${fileName}`);
}

function parseExcelPlayers(filePath) {
  const workbook = XLSX.readFile(filePath);

  if (workbook.Sheets[DEFAULT_SHEET_NAME]) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[DEFAULT_SHEET_NAME], { header: 1, defval: "" });

    const sections = parseSpelarnaReferenceRows(rows);
    const sectionPlayers = sections.flatMap((section) =>
      (section.items ?? []).map((item) => ({
        rowNumber: item.rowNumber,
        lastName: item.name,
        teamName: item.team,
        playerId: null,
        fullName: item.name,
        normalizedLastName: normalizeLastNameInput(item.name),
        sourceSectionType: section.sectionType,
      }))
    );

    if (sectionPlayers.length > 0) {
      return sectionPlayers;
    }

    return rows
      .map((row, index) => ({
        rowNumber: index + 1,
        lastName: String(row?.[0] ?? "").trim(),
        teamName: String(row?.[1] ?? "").trim(),
      }))
      .filter((row) => isLikelyPlayerRow(row.lastName, row.teamName))
      .map((row) => ({
        ...row,
        playerId: null,
        fullName: row.lastName,
        normalizedLastName: normalizeLastNameInput(row.lastName),
        sourceSectionType: "",
      }));
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return rows.map((row, index) => {
    const playerIdRaw = pickField(row, ["playerid", "nhlplayerid", "id"]);
    const playerId = Number.parseInt(String(playerIdRaw ?? ""), 10);

    const firstName = String(pickField(row, ["firstname", "etunimi"]) ?? "").trim();
    const lastName = String(pickField(row, ["lastname", "sukunimi"]) ?? "").trim();
    const fullName = String(
      pickField(row, ["fullname", "name", "player", "pelaaja"]) ?? `${firstName} ${lastName}`
    ).trim();

    return {
      rowNumber: index + 2,
      playerId: Number.isInteger(playerId) && playerId > 0 ? playerId : null,
      fullName,
      lastName,
      normalizedLastName: normalizeLastNameInput(lastName),
      teamName: "",
      sourceSectionType: "",
      sourceRow: row,
    };
  });
}

async function resolveTeamMap() {
  const standings = await fetchJson("/standings/now");
  const map = new Map();

  for (const entry of standings.standings ?? []) {
    const teamAbbrev = entry?.teamAbbrev?.default;
    const placeName = entry?.placeName?.default;
    const teamCommon = entry?.teamCommonName?.default;
    const fullTeamName = entry?.teamName?.default;

    if (teamAbbrev) {
      map.set(normalizeText(teamAbbrev), teamAbbrev);
    }
    if (placeName) {
      map.set(normalizeText(placeName), teamAbbrev);
    }
    if (teamCommon) {
      map.set(normalizeText(teamCommon), teamAbbrev);
    }
    if (fullTeamName) {
      map.set(normalizeText(fullTeamName), teamAbbrev);
    }
  }

  map.set("njdevils", "NJD");
  map.set("newjerseydevils", "NJD");
  map.set("nyrangers", "NYR");
  map.set("newyorkrangers", "NYR");
  map.set("sanjose", "SJS");
  map.set("sanjosesharks", "SJS");
  map.set("montreal", "MTL");

  return map;
}

async function buildTeamPlayerIndex(teamAbbrev) {
  const clubStats = await fetchJson(`/club-stats/${teamAbbrev}/now`);
  const players = [...(clubStats.skaters ?? []), ...(clubStats.goalies ?? [])];
  const index = new Map();

  for (const player of players) {
    const key = normalizeText(player?.lastName?.default ?? "");
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(player);
  }

  return { clubStats, index, players };
}

function levenshteinDistance(a, b) {
  const left = a ?? "";
  const right = b ?? "";

  if (left === right) {
    return 0;
  }

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function selectBestCandidate(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const pointsA = a.player?.points ?? -1;
    const pointsB = b.player?.points ?? -1;
    if (pointsB !== pointsA) {
      return pointsB - pointsA;
    }
    return (b.player?.gamesPlayed ?? 0) - (a.player?.gamesPlayed ?? 0);
  });

  return candidates[0];
}

async function resolvePlayersForFile(fileName) {
  const filePath = await resolveExistingExcelPath(fileName);
  const players = parseExcelPlayers(filePath);
  const teamMap = await resolveTeamMap();
  const teamCache = new Map();
  const allTeamAbbrevs = Array.from(new Set([...teamMap.values()].filter(Boolean)));

  const resolvedPlayers = [];
  const unresolvedItems = [];

  for (const player of players) {
    if (!player.playerId && player.lastName && player.teamName) {
      const teamAbbrev = teamMap.get(normalizeText(player.teamName));
      const normalizedLastName = player.normalizedLastName || normalizeLastNameInput(player.lastName);
      const candidatePool = [];

      if (teamAbbrev) {
        if (!teamCache.has(teamAbbrev)) {
          teamCache.set(teamAbbrev, await buildTeamPlayerIndex(teamAbbrev));
        }

        const teamIndex = teamCache.get(teamAbbrev).index;
        const teamCandidates = teamIndex.get(normalizedLastName) ?? [];
        for (const candidate of teamCandidates) {
          candidatePool.push({ player: candidate, teamAbbrev, matchStrategy: "team_exact" });
        }
      }

      if (candidatePool.length === 0) {
        for (const fallbackTeamAbbrev of allTeamAbbrevs) {
          if (fallbackTeamAbbrev === teamAbbrev) {
            continue;
          }

          if (!teamCache.has(fallbackTeamAbbrev)) {
            teamCache.set(fallbackTeamAbbrev, await buildTeamPlayerIndex(fallbackTeamAbbrev));
          }

          const fallbackIndex = teamCache.get(fallbackTeamAbbrev).index;
          const fallbackCandidates = fallbackIndex.get(normalizedLastName) ?? [];

          for (const candidate of fallbackCandidates) {
            candidatePool.push({
              player: candidate,
              teamAbbrev: fallbackTeamAbbrev,
              matchStrategy: "team_fallback",
            });
          }
        }
      }

      if (candidatePool.length === 0) {
        for (const fuzzyTeamAbbrev of allTeamAbbrevs) {
          if (!teamCache.has(fuzzyTeamAbbrev)) {
            teamCache.set(fuzzyTeamAbbrev, await buildTeamPlayerIndex(fuzzyTeamAbbrev));
          }

          const teamPlayers = teamCache.get(fuzzyTeamAbbrev).players;
          for (const candidate of teamPlayers) {
            const candidateLastName = normalizeText(candidate?.lastName?.default ?? "");
            if (!candidateLastName) {
              continue;
            }

            const distance = levenshteinDistance(normalizedLastName, candidateLastName);
            const lengthGap = Math.abs(normalizedLastName.length - candidateLastName.length);
            const samePrefix = normalizedLastName.slice(0, 4) === candidateLastName.slice(0, 4);
            if (distance <= 2 && lengthGap <= 2 && samePrefix) {
              candidatePool.push({
                player: candidate,
                teamAbbrev: fuzzyTeamAbbrev,
                matchStrategy: "team_fuzzy_fallback",
              });
            }
          }
        }
      }

      const bestMatch = selectBestCandidate(candidatePool);
      if (!bestMatch) {
        unresolvedItems.push({
          inputName: player.fullName,
          inputTeam: player.teamName,
          teamAbbrev: teamAbbrev ?? "",
          playerId: null,
          status: teamAbbrev ? "player_not_found" : "team_not_found",
          error: teamAbbrev
            ? `No player with last name '${player.lastName}' found from NHL teams (input team: ${teamAbbrev})`
            : `Could not map team '${player.teamName}' to NHL team and no surname fallback match was found`,
          rowNumber: player.rowNumber,
        });
        continue;
      }

      player.playerId = bestMatch.player.playerId;
      player.matchStrategy = bestMatch.matchStrategy;
      player.inputTeamAbbrev = teamAbbrev ?? "";
      player.matchedTeamAbbrev = bestMatch.teamAbbrev;
      player.matchedCurrentSeasonStats = {
        gamesPlayed: bestMatch.player?.gamesPlayed ?? null,
        goals: bestMatch.player?.goals ?? null,
        assists: bestMatch.player?.assists ?? null,
        points: bestMatch.player?.points ?? null,
      };
    }

    if (!player.playerId) {
      unresolvedItems.push({
        inputName: player.fullName,
        inputTeam: player.teamName,
        playerId: null,
        status: "missing_player_id",
        error: "Excel row is missing playerId/nhlPlayerId/id column or could not be resolved from surname+team",
        rowNumber: player.rowNumber,
      });
      continue;
    }

    resolvedPlayers.push(player);
  }

  return {
    totalRows: players.length,
    resolvedPlayers,
    unresolvedItems,
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }

      results[current] = await worker(items[current], current);
    }
  }

  const workers = [];
  const count = Math.min(Math.max(concurrency, 1), items.length || 1);
  for (let i = 0; i < count; i += 1) {
    workers.push(runner());
  }

  await Promise.all(workers);
  return results;
}

function isAdminProtectedPath(requestPath) {
  const pathValue = String(requestPath ?? "");
  return [
    "/admin.html",
    "/app.js",
    "/period3-validator.html",
    "/period3-validator.js",
    "/api/period3/validate-team",
    "/api/upload-excel",
    "/api/settings/compare-date",
    "/api/spelarna-reconciliation",
  ].some((prefix) => pathValue === prefix || pathValue.startsWith(`${prefix}/`));
}

function parseBasicAuthHeader(authorizationHeader) {
  const value = String(authorizationHeader ?? "");
  if (!value.startsWith("Basic ")) {
    return null;
  }

  const encodedPart = value.slice(6).trim();
  if (!encodedPart) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedPart, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) {
      return null;
    }

    return {
      user: decoded.slice(0, separatorIndex),
      pass: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function requireAdminAccess(req, res, next) {
  if (!ADMIN_PROTECTION_ENABLED || !isAdminProtectedPath(req.path)) {
    next();
    return;
  }

  const credentials = parseBasicAuthHeader(req.get("authorization"));
  const authorized = credentials?.user === ADMIN_BASIC_USER && credentials?.pass === ADMIN_BASIC_PASS;

  if (authorized) {
    next();
    return;
  }

  res.set("WWW-Authenticate", 'Basic realm="NHL Admin"');

  if (String(req.path).startsWith("/api/")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.status(401).send("Unauthorized");
}

function hasAdminCredentials(req) {
  if (!ADMIN_PROTECTION_ENABLED) {
    return false;
  }

  const credentials = parseBasicAuthHeader(req.get("authorization"));
  return credentials?.user === ADMIN_BASIC_USER && credentials?.pass === ADMIN_BASIC_PASS;
}

function isTruthyQueryValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y"].includes(normalized);
}

app.use(requireAdminAccess);

app.use(express.static(path.join(rootDir, "public"), { index: false }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "public", "lagen.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/version", (_req, res) => {
  res.json({
    name: "nhl-stats",
    commitSha,
    buildTimestamp,
    appBootedAt,
    railway: {
      projectId: process.env.RAILWAY_PROJECT_ID || "",
      serviceId: process.env.RAILWAY_SERVICE_ID || "",
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID || "",
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || "",
      environmentName: process.env.RAILWAY_ENVIRONMENT || "",
    },
  });
});

app.get("/api/data-readiness", async (req, res) => {
  try {
    const dateInput = String(req.query.date ?? "").trim();
    const targetDate = dateInput || getHelsinkiTodayDate();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      res.status(400).json({ error: "date must be in format YYYY-MM-DD" });
      return;
    }

    const readiness = await buildDataReadiness(targetDate);
    res.json(readiness);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cron/daily-refresh", handleDailyAutoRefreshRequest);
app.get("/api/cron/daily-refresh", handleDailyAutoRefreshRequest);

app.get("/api/excel-files", async (_req, res) => {
  try {
    const files = await listExcelFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/settings", (_req, res) => {
  const compareDate = getSetting("compareDate", DEFAULT_COMPARE_DATE);
  res.json({ compareDate });
});

app.get("/api/nyheter/snapshots", (req, res) => {
  try {
    const fileName = String(req.query.file ?? "").trim();
    const seasonId = String(req.query.seasonId ?? "").trim();
    const limit = Number.parseInt(String(req.query.limit ?? "14"), 10);
    const snapshots = listNyheterSnapshots({ fileName, seasonId, limit });

    res.json({
      count: snapshots.length,
      snapshots,
    });
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? "unknown error") });
  }
});

async function handleNyheterCollectRequest(req, res) {
  if (!hasNyheterCollectorAccess(req)) {
    res.status(401).json({ error: "Unauthorized nyheter collector access" });
    return;
  }

  try {
    const fileName = String(req.query.file ?? req.body?.file ?? DEFAULT_EXCEL_FILE).trim();
    const seasonId = String(req.query.seasonId ?? req.body?.seasonId ?? AUTO_REFRESH_SEASON_ID).trim();
    const compareDate = String(
      req.query.compareDate ?? req.body?.compareDate ?? getSetting("compareDate", DEFAULT_COMPARE_DATE)
    ).trim();
    const snapshotDate = String(req.query.snapshotDate ?? req.body?.snapshotDate ?? getHelsinkiTodayDate()).trim();
    const forceRefresh = isTruthyQueryValue(req.query.forceRefresh ?? req.body?.forceRefresh ?? "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) {
      res.status(400).json({ error: "snapshotDate must be in format YYYY-MM-DD" });
      return;
    }

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDate)) {
      res.status(400).json({ error: "compareDate must be in format YYYY-MM-DD" });
      return;
    }

    const result = await collectNyheterSnapshot({
      fileName,
      seasonId,
      compareDate,
      snapshotDate,
      forceRefresh,
    });

    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message ?? "unknown error") });
  }
}

app.post("/api/nyheter/collect", handleNyheterCollectRequest);
app.get("/api/nyheter/collect", handleNyheterCollectRequest);

app.post("/api/period3/validate-team", async (req, res) => {
  try {
    const participantName = String(req.body?.participantName ?? "").trim();
    const rosterText = String(req.body?.rosterText ?? "").trim();
    const fileName = String(req.body?.file ?? PERIOD3_VALIDATOR_DEFAULT_FILE).trim();
    const seasonId = String(req.body?.seasonId ?? PERIOD3_VALIDATOR_SEASON_ID).trim();
    const rankingFrom = String(req.body?.rankingFrom ?? PERIOD3_VALIDATOR_RANKING_FROM).trim();
    const rankingTo = String(req.body?.rankingTo ?? PERIOD3_VALIDATOR_RANKING_TO).trim();

    if (!participantName) {
      res.status(400).json({ ok: false, error: "participantName is required" });
      return;
    }

    if (!rosterText) {
      res.status(400).json({ ok: false, error: "rosterText is required" });
      return;
    }

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ ok: false, error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(rankingFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(rankingTo)) {
      res.status(400).json({ ok: false, error: "rankingFrom and rankingTo must be in format YYYY-MM-DD" });
      return;
    }

    const result = await validatePeriod3TeamSelection({
      participantName,
      rosterText,
      fileName,
      seasonId,
      rankingFrom,
      rankingTo,
    });

    res.json({
      ok: true,
      result,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error?.message ?? "unknown error") });
  }
});

app.post("/api/settings/compare-date", (req, res) => {
  const compareDate = String(req.body?.compareDate ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDate)) {
    res.status(400).json({ error: "compareDate must be in format YYYY-MM-DD" });
    return;
  }

  setSetting("compareDate", compareDate);
  res.json({ compareDate });
});

app.post("/api/upload-excel", upload.single("file"), async (req, res) => {
  try {
    await fs.mkdir(dataDir, { recursive: true });

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Missing file field (name: file)" });
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ext || ![".xlsx", ".xls"].includes(ext)) {
      res.status(400).json({ error: "Only .xlsx/.xls files are allowed" });
      return;
    }

    const safeBase = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const { dataPath } = toSafeDataPath(safeBase);

    await fs.writeFile(dataPath, file.buffer);

    const files = await listExcelFiles();
    res.json({
      uploaded: safeBase,
      files,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/players-stats-compare", async (req, res) => {
  try {
    const compareDateInput = String(req.query.compareDate ?? "").trim();
    const compareDate = compareDateInput || getSetting("compareDate", DEFAULT_COMPARE_DATE);
    const forceRefreshRaw = String(req.query.forceRefresh ?? "").trim().toLowerCase();
    const forceRefresh = ["1", "true", "yes", "y"].includes(forceRefreshRaw);
    const seasonId = String(req.query.seasonId ?? "20252026");
    const fileName = String(req.query.file ?? DEFAULT_EXCEL_FILE).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDate)) {
      res.status(400).json({ error: "compareDate must be in format YYYY-MM-DD" });
      return;
    }

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    const dataWindowKey = getHelsinkiDateWindowKey();
    const cacheKey = [RESPONSE_CACHE_VERSION, seasonId, fileName, compareDate, dataWindowKey].join("|");
    const cachedResponse = forceRefresh ? null : getCachedCompareResponse(cacheKey);
    if (cachedResponse) {
      res.json({
        ...cachedResponse,
        cache: {
          ...(cachedResponse.cache ?? {}),
          hit: true,
          window: dataWindowKey,
          timezone: "Europe/Helsinki",
          refreshHourLocal: 10,
        },
      });
      return;
    }

    const { totalRows, resolvedPlayers, unresolvedItems } = await resolvePlayersForFile(fileName);

    const resolvedItems = await runWithConcurrency(resolvedPlayers, PLAYER_FETCH_CONCURRENCY, async (player) => {
      try {
        let landing;
        let gameLogPayload;

        if (useMcpBridge) {
          landing = await fetchJson(`/player/${player.playerId}/landing`);
          gameLogPayload = await fetchJson(`/player/${player.playerId}/game-log/${seasonId}/2`);
        } else {
          [landing, gameLogPayload] = await Promise.all([
            fetchJson(`/player/${player.playerId}/landing`),
            fetchJson(`/player/${player.playerId}/game-log/${seasonId}/2`),
          ]);
        }

        const stats = extractSeasonStats(landing, seasonId);
        const gameLog = Array.isArray(gameLogPayload?.gameLog) ? gameLogPayload.gameLog : [];
        const gamesUntilDate = gameLog.filter((game) => String(game.gameDate) <= compareDate);
        const isGoalie =
          String(landing?.position ?? "").toUpperCase() === "G" || player.sourceSectionType === "goalies";
        const comparePoints = isGoalie
          ? sumGoalieFantasyPoints(gamesUntilDate)
          : gamesUntilDate.reduce((sum, game) => sum + Number(game?.points ?? 0), 0);
        const matchedStats = player.matchedCurrentSeasonStats ?? null;
        const todayGamesPlayed = Number.isFinite(Number(matchedStats?.gamesPlayed))
          ? Number(matchedStats.gamesPlayed)
          : (stats?.gamesPlayed ?? null);
        const goalieGoals = gameLog.reduce((sum, game) => sum + Number(game?.goals ?? 0), 0);
        const goalieAssists = gameLog.reduce((sum, game) => sum + Number(game?.assists ?? 0), 0);
        const todayGoals = isGoalie
          ? goalieGoals
          : Number.isFinite(Number(matchedStats?.goals))
            ? Number(matchedStats.goals)
            : (stats?.goals ?? null);
        const todayAssists = isGoalie
          ? goalieAssists
          : Number.isFinite(Number(matchedStats?.assists))
            ? Number(matchedStats.assists)
            : (stats?.assists ?? null);
        const todayPoints = isGoalie
          ? sumGoalieFantasyPoints(gameLog)
          : Number.isFinite(Number(matchedStats?.points))
            ? Number(matchedStats.points)
            : (stats?.points ?? null);

        return {
          inputName: player.fullName,
          inputTeam: player.teamName,
          rowNumber: player.rowNumber,
          isGoalie,
          playerId: landing.playerId,
          fullName: `${landing.firstName?.default ?? ""} ${landing.lastName?.default ?? ""}`.trim(),
          lastName: String(landing.lastName?.default ?? "").trim(),
          teamAbbrev: landing.currentTeamAbbrev ?? player.matchedTeamAbbrev ?? player.inputTeamAbbrev ?? "",
          isActive: Boolean(landing.isActive),
          seasonId,
          compareDate,
          gamesPlayed: todayGamesPlayed,
          goals: todayGoals,
          assists: todayAssists,
          points: todayPoints,
          todayPoints,
          comparePoints,
          deltaPoints:
            Number.isFinite(todayPoints) && Number.isFinite(comparePoints) ? todayPoints - comparePoints : null,
          matchStrategy: player.matchStrategy ?? (player.playerId ? "id_direct" : "unknown"),
          matchedTeamAbbrev: player.matchedTeamAbbrev ?? "",
          status: stats ? "ok" : "season_not_found",
          error: stats ? "" : `No NHL regular season stats found for season ${seasonId}`,
        };
      } catch (error) {
        return {
          inputName: player.fullName,
          inputTeam: player.teamName,
          playerId: player.playerId,
          status: "fetch_error",
          error: error.message,
          rowNumber: player.rowNumber,
        };
      }
    });

    const responsePayload = {
      file: fileName,
      seasonId,
      compareDate,
      totalRows,
      items: [...unresolvedItems, ...resolvedItems],
      cache: {
        hit: false,
        window: dataWindowKey,
        timezone: "Europe/Helsinki",
        refreshHourLocal: 10,
        fetchedAt: new Date().toISOString(),
      },
    };

    setCachedCompareResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tipsen-summary", async (req, res) => {
  try {
    const compareDateInput = String(req.query.compareDate ?? "").trim();
    const compareDate = compareDateInput || getSetting("compareDate", DEFAULT_COMPARE_DATE);
    const forceRefreshRaw = String(req.query.forceRefresh ?? "").trim().toLowerCase();
    const forceRefresh = ["1", "true", "yes", "y"].includes(forceRefreshRaw);
    const seasonId = String(req.query.seasonId ?? "20252026");
    const fileName = String(req.query.file ?? DEFAULT_EXCEL_FILE).trim();
    const includeCacheDebug = hasAdminCredentials(req) && isTruthyQueryValue(req.query.debugCache);

    if (!/^[\d]{4}-[\d]{2}-[\d]{2}$/.test(compareDate)) {
      res.status(400).json({ error: "compareDate must be in format YYYY-MM-DD" });
      return;
    }

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    const dataWindowKey = getHelsinkiDateWindowKey();
    const cacheKey = [RESPONSE_CACHE_VERSION, "tipsen", seasonId, fileName, compareDate, dataWindowKey].join("|");
    const cachedResponse = forceRefresh ? null : getCachedResponse(cacheKey);
    if (cachedResponse) {
      const cachePayload = {
        ...(cachedResponse.cache ?? {}),
        window: dataWindowKey,
        timezone: "Europe/Helsinki",
        refreshHourLocal: 10,
      };

      if (includeCacheDebug) {
        cachePayload.hit = true;
      } else {
        delete cachePayload.hit;
        delete cachePayload.compareHit;
      }

      res.json({
        ...cachedResponse,
        cache: cachePayload,
      });
      return;
    }

    const compareParams = new URLSearchParams({
      file: fileName,
      seasonId,
      compareDate,
    });
    if (forceRefresh) {
      compareParams.set("forceRefresh", "true");
    }

    const compareResponse = await fetch(`http://127.0.0.1:${PORT}/api/players-stats-compare?${compareParams}`);
    const comparePayload = await compareResponse.json();
    if (!compareResponse.ok) {
      res.status(compareResponse.status).json(comparePayload);
      return;
    }

    const filePath = await resolveExistingExcelPath(fileName);
    const workbook = XLSX.readFile(filePath);
    const tipsenSheet = workbook.Sheets[TIPSEN_SHEET_NAME];
    if (!tipsenSheet) {
      res.status(400).json({ error: `Sheet '${TIPSEN_SHEET_NAME}' not found in ${fileName}` });
      return;
    }

    const tipsenRows = XLSX.utils.sheet_to_json(tipsenSheet, { header: 1, defval: "" });
    const participantNameRow = tipsenRows[2] ?? [];
    const participantHeaderRow = tipsenRows[3] ?? [];
    const participantColumns = [];

    for (let col = 0; col < participantHeaderRow.length; col += 1) {
      if (normalizeText(participantHeaderRow[col]) !== "spelare") {
        continue;
      }

      const participantName = String(participantNameRow[col] ?? "").trim();
      if (!participantName) {
        continue;
      }

      participantColumns.push({
        name: participantName,
        playerCol: col,
        pointsCol: col + 1,
      });
    }

    const compareItems = comparePayload.items ?? [];
    const { byTeamAndLast, byTeamLastAndInitial, byLastName, byLastAndInitial } = buildCompareIndexes(compareItems);
    const tipsenTeamCache = new Map();
    const tipsenSnapshotCache = new Map();
    const rosterRows = TIPSEN_PLAYER_ROWS.map((rowNumber) => {
      const row = tipsenRows[rowNumber - 1] ?? [];
      return {
        rowNumber,
        role: String(row[0] ?? "").trim(),
      };
    });

    const injuryLookup = await getInjuryLookup();
    const participants = [];

    for (const participant of participantColumns) {
      const players = [];

      for (const rosterRow of rosterRows) {
        const row = tipsenRows[rosterRow.rowNumber - 1] ?? [];
        const parsedCell = parseTipsenPlayerCell(row[participant.playerCol]);
        if (!parsedCell) {
          players.push({
            rowNumber: rosterRow.rowNumber,
            role: rosterRow.role,
            playerLabel: "",
            teamAbbrev: "",
            deltaPoints: null,
            source: "empty",
          });
          continue;
        }

        const teamKey = parsedCell.teamAbbrev ? `${parsedCell.teamAbbrev}|${parsedCell.lastNameNormalized}` : "";
        const directMatch = teamKey ? byTeamAndLast.get(teamKey) : null;
        const teamInitialKey =
          parsedCell.teamAbbrev && parsedCell.firstInitial && parsedCell.hasGivenNameHint
            ? `${parsedCell.teamAbbrev}|${parsedCell.lastNameNormalized}|${parsedCell.firstInitial}`
            : "";
        const teamInitialCandidates = teamInitialKey ? byTeamLastAndInitial.get(teamInitialKey) ?? [] : [];
        const teamInitialMatch = teamInitialCandidates.length === 1 ? teamInitialCandidates[0] : null;
        const fallbackCandidates = byLastName.get(parsedCell.lastNameNormalized) ?? [];
        const fallbackInitialKey = parsedCell.firstInitial && parsedCell.hasGivenNameHint
          ? `${parsedCell.lastNameNormalized}|${parsedCell.firstInitial}`
          : "";
        const fallbackInitialCandidates = fallbackInitialKey ? byLastAndInitial.get(fallbackInitialKey) ?? [] : [];
        const fallbackInitialMatch = fallbackInitialCandidates.length === 1 ? fallbackInitialCandidates[0] : null;
        const fallbackMatch = fallbackCandidates.length === 1 ? fallbackCandidates[0] : null;
        const matched = directMatch ?? teamInitialMatch ?? fallbackInitialMatch ?? fallbackMatch ?? null;
        let liveSnapshot = null;

        if (!matched) {
          liveSnapshot = await resolveTipsenLiveSnapshot({
            parsedCell,
            seasonId,
            compareDate,
            teamCache: tipsenTeamCache,
            snapshotCache: tipsenSnapshotCache,
          });
        }

        const resolvedTeamAbbrev = String(
          matched?.teamAbbrev ?? liveSnapshot?.teamAbbrev ?? parsedCell.teamAbbrev ?? ""
        )
          .trim()
          .toUpperCase();
        const resolvedPlayerName = String(
          extractDisplayLastNameFromFullName(matched?.fullName) ||
          liveSnapshot?.matchedLastName ||
          parsedCell.playerName ||
          ""
        ).trim();
        const resolvedPlayerLabel = resolvedTeamAbbrev && resolvedPlayerName
          ? `${resolvedPlayerName} (${resolvedTeamAbbrev})`
          : parsedCell.playerLabel;

        players.push({
          rowNumber: rosterRow.rowNumber,
          role: rosterRow.role,
          playerLabel: resolvedPlayerLabel,
          teamAbbrev: resolvedTeamAbbrev,
          deltaPoints: matched?.deltaPoints ?? liveSnapshot?.deltaPoints ?? null,
          injury: resolveInjuryForPlayer(
            {
              matchedFullName: matched?.fullName ?? liveSnapshot?.matchedFullName ?? "",
              playerLabel: parsedCell.playerLabel,
            },
            injuryLookup
          ),
          source: directMatch
            ? "team_last"
            : teamInitialMatch
              ? "team_last_initial"
              : fallbackInitialMatch
                ? "last_name_initial_unique"
                : fallbackMatch
                  ? "last_name_unique"
                  : liveSnapshot?.source ?? "not_found",
          matchedFullName: matched?.fullName ?? liveSnapshot?.matchedFullName ?? "",
        });
      }

      const totalDelta = players.reduce((sum, player) => {
        if (!Number.isFinite(Number(player.deltaPoints))) {
          return sum;
        }
        return sum + Number(player.deltaPoints);
      }, 0);

      participants.push({
        name: participant.name,
        totalDelta,
        players,
      });
    }

    const responsePayload = {
      file: fileName,
      seasonId,
      compareDate,
      rosterRows,
      participants,
      cache: {
        window: dataWindowKey,
        timezone: "Europe/Helsinki",
        refreshHourLocal: 10,
        fetchedAt: new Date().toISOString(),
        ...(includeCacheDebug
          ? {
              hit: false,
              compareHit: Boolean(comparePayload?.cache?.hit),
            }
          : {}),
      },
    };

    setCachedResponse(cacheKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/spelarna-reconciliation", async (req, res) => {
  try {
    const compareDateInput = String(req.query.compareDate ?? "").trim();
    const compareDate = compareDateInput || getSetting("compareDate", DEFAULT_COMPARE_DATE);
    const forceRefreshRaw = String(req.query.forceRefresh ?? "").trim().toLowerCase();
    const forceRefresh = ["1", "true", "yes", "y"].includes(forceRefreshRaw);
    const seasonId = String(req.query.seasonId ?? "20252026");
    const fileName = String(req.query.file ?? DEFAULT_EXCEL_FILE).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDate)) {
      res.status(400).json({ error: "compareDate must be in format YYYY-MM-DD" });
      return;
    }

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    const compareParams = new URLSearchParams({ file: fileName, seasonId, compareDate });
    if (forceRefresh) {
      compareParams.set("forceRefresh", "true");
    }

    const compareResponse = await fetch(`http://127.0.0.1:${PORT}/api/players-stats-compare?${compareParams}`);
    const comparePayload = await compareResponse.json();
    if (!compareResponse.ok) {
      res.status(compareResponse.status).json(comparePayload);
      return;
    }

    const filePath = await resolveExistingExcelPath(fileName);
    const workbook = XLSX.readFile(filePath);
    const spelarnaSheet = workbook.Sheets[DEFAULT_SHEET_NAME];
    if (!spelarnaSheet) {
      res.status(400).json({ error: `Sheet '${DEFAULT_SHEET_NAME}' not found in ${fileName}` });
      return;
    }

    const sheetRows = XLSX.utils.sheet_to_json(spelarnaSheet, { header: 1, defval: "" });
    const sections = parseSpelarnaReferenceRows(sheetRows);
    const byRow = new Map((comparePayload.items ?? []).map((item) => [item.rowNumber, item]));

    const responseSections = sections.map((section) => {
      const mismatches = [];

      for (const item of section.items) {
        const api = byRow.get(item.rowNumber);
        const apiTotal = Number(api?.todayPoints);
        const apiStart = Number(api?.comparePoints);
        const apiDelta = Number(api?.deltaPoints);
        const matches =
          Number.isFinite(apiTotal) &&
          Number.isFinite(apiStart) &&
          Number.isFinite(apiDelta) &&
          item.excelTotal === apiTotal &&
          item.excelStart === apiStart &&
          item.excelDelta === apiDelta;

        if (!matches) {
          mismatches.push({
            rowNumber: item.rowNumber,
            name: item.name,
            team: item.team,
            excelTotal: item.excelTotal,
            apiTotal: Number.isFinite(apiTotal) ? apiTotal : null,
            excelStart: item.excelStart,
            apiStart: Number.isFinite(apiStart) ? apiStart : null,
            excelDelta: item.excelDelta,
            apiDelta: Number.isFinite(apiDelta) ? apiDelta : null,
            apiStatus: api?.status ?? "missing",
          });
        }
      }

      return {
        sectionType: section.sectionType,
        count: section.items.length,
        matches: section.items.length - mismatches.length,
        mismatches: mismatches.length,
        items: mismatches,
      };
    });

    res.json({
      file: fileName,
      seasonId,
      compareDate,
      sections: responseSections,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  await fs.mkdir(dataDir, { recursive: true });
  if (useMcpBridge) {
    await getMcpClient();
  }
  console.log(`Web UI running at http://localhost:${PORT}`);
  console.log(`Excel source folders: ${rootDir} and ${dataDir}`);
  console.log(`Storage root: ${storageRoot}`);
  console.log(`Settings DB: ${settingsDbPath}`);
  console.log(`Response cache version: ${RESPONSE_CACHE_VERSION}`);
  console.log(`Players compare concurrency: ${PLAYER_FETCH_CONCURRENCY}`);
  console.log(`MCP min call interval: ${MCP_MIN_CALL_INTERVAL_MS}ms`);
  console.log(
    useMcpBridge ? "NHL data source: MCP server tools (stdio)" : `NHL data source: direct API (${NHL_API_BASE})`
  );
  console.log(`Admin protection: ${ADMIN_PROTECTION_ENABLED ? "enabled" : "disabled"}`);
  console.log(`Auto refresh scheduler: ${AUTO_REFRESH_SCHEDULER_ENABLED ? "enabled" : "disabled"}`);
  console.log(`Startup cache warmup: ${STARTUP_CACHE_WARMUP_ENABLED ? "enabled" : "disabled"}`);
  if (STARTUP_CACHE_WARMUP_ENABLED) {
    console.log(`Startup cache warmup delay: ${Math.max(0, STARTUP_CACHE_WARMUP_DELAY_MS)}ms`);
    setTimeout(() => {
      warmTipsenCacheOnStartup().catch((error) => {
        console.error(`[cache-warmup] startup warmup failed: ${error.message}`);
      });
    }, Math.max(0, STARTUP_CACHE_WARMUP_DELAY_MS));
  }
  if (AUTO_REFRESH_SCHEDULER_ENABLED) {
    console.log(`Auto refresh schedule: check every ${AUTO_REFRESH_CHECK_INTERVAL_MS}ms, min hour FI ${AUTO_REFRESH_MIN_HOUR_FI}`);
    setTimeout(() => {
      tryAutoRefreshFromScheduler().catch((error) => {
        console.error(`[auto-refresh] initial check failed: ${error.message}`);
      });
    }, 5000);

    setInterval(() => {
      tryAutoRefreshFromScheduler().catch((error) => {
        console.error(`[auto-refresh] scheduled check failed: ${error.message}`);
      });
    }, Math.max(60000, AUTO_REFRESH_CHECK_INTERVAL_MS));
  }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    try {
      if (mcpClientPromise) {
        const client = await mcpClientPromise;
        await client.close();
      }
    } catch {
    }
    try {
      settingsDb.close();
    } catch {
    }
    process.exit(0);
  });
}
