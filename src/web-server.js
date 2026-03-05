import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import multer from "multer";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const DEFAULT_EXCEL_FILE = "NHL tipset 2026 jan-apr period1.xlsx";
const DEFAULT_SHEET_NAME = "Spelarna";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const app = express();
let mcpClientPromise = null;

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

function pickField(row, keys) {
  for (const [key, value] of Object.entries(row)) {
    const normalized = normalizeHeader(key);
    if (keys.includes(normalized) && value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

async function fetchJson(pathname) {
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
  ];

  for (const route of routeMap) {
    const match = pathname.match(route.pattern);
    if (match) {
      return route.call(match);
    }
  }

  throw new Error(`Unsupported MCP-mapped path: ${pathname}`);
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
    try {
      const client = await getMcpClient();
      const result = await client.callTool({ name, arguments: args });
      return parseToolJson(result);
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      mcpClientPromise = null;
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
    return rows
      .map((row, index) => ({
        rowNumber: index + 1,
        lastName: String(row?.[0] ?? "").trim(),
        teamName: String(row?.[1] ?? "").trim(),
      }))
      .filter((row) => row.lastName || row.teamName)
      .map((row) => ({
        ...row,
        playerId: null,
        fullName: row.lastName,
        normalizedLastName: normalizeLastNameInput(row.lastName),
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

app.use(express.static(path.join(rootDir, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/excel-files", async (_req, res) => {
  try {
    const files = await listExcelFiles();
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.get("/api/players-stats", async (req, res) => {
  try {
    const seasonId = String(req.query.seasonId ?? "20252026");
    const fileName = String(req.query.file ?? DEFAULT_EXCEL_FILE).trim();

    if (!/^\d{8}$/.test(seasonId)) {
      res.status(400).json({ error: "seasonId must be an 8-digit string, e.g. 20252026" });
      return;
    }

    const filePath = await resolveExistingExcelPath(fileName);
    const players = parseExcelPlayers(filePath);
    const teamMap = await resolveTeamMap();
    const teamCache = new Map();
    const allTeamAbbrevs = Array.from(new Set([...teamMap.values()].filter(Boolean)));

    const items = [];

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
          items.push({
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
        player.matchedTeamAbbrev = bestMatch.teamAbbrev;
      }

      if (!player.playerId) {
        items.push({
          inputName: player.fullName,
          inputTeam: player.teamName,
          playerId: null,
          status: "missing_player_id",
          error: "Excel row is missing playerId/nhlPlayerId/id column or could not be resolved from surname+team",
          rowNumber: player.rowNumber,
        });
        continue;
      }

      try {
        const landing = await fetchJson(`/player/${player.playerId}/landing`);
        const stats = extractSeasonStats(landing, seasonId);

        if (!stats) {
          items.push({
            inputName: player.fullName,
            playerId: player.playerId,
            status: "season_not_found",
            error: `No NHL regular season stats found for season ${seasonId}`,
            rowNumber: player.rowNumber,
          });
          continue;
        }

        items.push({
          inputName: player.fullName,
          inputTeam: player.teamName,
          rowNumber: player.rowNumber,
          playerId: landing.playerId,
          fullName: `${landing.firstName?.default ?? ""} ${landing.lastName?.default ?? ""}`.trim(),
          teamAbbrev: landing.currentTeamAbbrev ?? "",
          isActive: Boolean(landing.isActive),
          seasonId,
          status: "ok",
          matchStrategy: player.matchStrategy ?? (player.playerId ? "id_direct" : "unknown"),
          matchedTeamAbbrev: player.matchedTeamAbbrev ?? "",
          ...stats,
        });
      } catch (error) {
        items.push({
          inputName: player.fullName,
          inputTeam: player.teamName,
          playerId: player.playerId,
          status: "fetch_error",
          error: error.message,
          rowNumber: player.rowNumber,
        });
      }
    }

    res.json({
      file: fileName,
      seasonId,
      totalRows: players.length,
      items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await getMcpClient();
  console.log(`Web UI running at http://localhost:${PORT}`);
  console.log(`Excel source folders: ${rootDir} and ${dataDir}`);
  console.log("NHL data source: MCP server tools (stdio)");
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
    process.exit(0);
  });
}
