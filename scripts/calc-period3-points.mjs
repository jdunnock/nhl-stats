import { readFile } from "node:fs/promises";

const FROM_DATE = "2026-03-15";
const TO_DATE = "2026-03-19";
const SEASON_ID = "20252026";

const aliasMap = {
  ana: "ANA",
  bos: "BOS",
  buf: "BUF",
  cal: "CGY",
  car: "CAR",
  cbj: "CBJ",
  chi: "CHI",
  col: "COL",
  dal: "DAL",
  det: "DET",
  edm: "EDM",
  fla: "FLA",
  flo: "FLA",
  lak: "LAK",
  min: "MIN",
  mtl: "MTL",
  mon: "MTL",
  nash: "NSH",
  nas: "NSH",
  nsh: "NSH",
  njd: "NJD",
  nyr: "NYR",
  nyi: "NYI",
  ott: "OTT",
  phi: "PHI",
  pit: "PIT",
  sjs: "SJS",
  stl: "STL",
  tbl: "TBL",
  tam: "TBL",
  tor: "TOR",
  uta: "UTA",
  vgk: "VGK",
  veg: "VGK",
  was: "WSH",
  wsh: "WSH",
  win: "WPG",
  wpg: "WPG",
};

function normTeam(value) {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return aliasMap[token] ?? String(value ?? "").trim().toUpperCase();
}

function normText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function lastNameKey(name) {
  const cleaned = String(name ?? "").replace(/\./g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const last = parts.length ? parts[parts.length - 1] : cleaned;
  return normText(last);
}

function parseRosterEntry(entry) {
  const raw = String(entry ?? "").trim();
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return null;
  }

  const playerName = String(match[1] ?? "").trim();
  const team = normTeam(match[2]);
  const normalizedName = playerName
    .replace(/\bVasilievskiy\b/i, "Vasilevskiy")
    .replace(/\./g, " ")
    .trim();
  const firstToken = normalizedName.split(/\s+/).filter(Boolean)[0] ?? "";
  const firstInitial = firstToken ? normText(firstToken).slice(0, 1) : "";

  return {
    raw,
    playerName: normalizedName,
    team,
    lastName: lastNameKey(normalizedName),
    firstInitial,
    fullName: normText(normalizedName),
    key: `${lastNameKey(normalizedName)}|${team}`,
  };
}

async function fetchAll(entity, sortProperty, fromDate, toDate) {
  const rows = [];
  const limit = 200;
  let start = 0;
  let total = Number.POSITIVE_INFINITY;

  while (start < total) {
    const sort = encodeURIComponent(JSON.stringify([{ property: sortProperty, direction: "DESC" }]));
    const parts = [`seasonId=${SEASON_ID}`, "gameTypeId=2"];
    if (fromDate) {
      parts.push(`gameDate>=\"${fromDate}\"`);
    }
    if (toDate) {
      parts.push(`gameDate<=\"${toDate}\"`);
    }
    const cayenne = encodeURIComponent(parts.join(" and "));
    const url =
      `https://api.nhle.com/stats/rest/en/${entity}/summary` +
      `?isAggregate=false&isGame=false&start=${start}&limit=${limit}` +
      `&sort=${sort}&cayenneExp=${cayenne}`;

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "nhl-stats-validation/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`${entity} ${response.status}`);
    }

    const payload = await response.json();
    const pageRows = Array.isArray(payload?.data) ? payload.data : [];
    total = Number(payload?.total ?? pageRows.length);
    rows.push(...pageRows);

    if (!pageRows.length) {
      break;
    }

    start += pageRows.length;
  }

  return rows;
}

function addIndex(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

function getUniqueEntry(entries) {
  if (!Array.isArray(entries) || entries.length !== 1) {
    return null;
  }
  return entries[0];
}

function toSkaterEntry(row, pointsOverride) {
  return {
    fullName: row.skaterFullName,
    fullNameKey: normText(String(row.skaterFullName ?? "").replace(/\./g, " ")),
    lastNameKey: lastNameKey(row.lastName || row.skaterFullName),
    team: normTeam(row.teamAbbrevs),
    points: Number(pointsOverride ?? row.points ?? 0),
  };
}

function toGoalieEntry(row, pointsOverride) {
  const fantasyPoints =
    Number(row.wins ?? 0) * 2 +
    Number(row.goals ?? 0) +
    Number(row.assists ?? 0) +
    Number(row.shutouts ?? 0) * 2;

  return {
    fullName: row.goalieFullName,
    fullNameKey: normText(String(row.goalieFullName ?? "").replace(/\./g, " ")),
    lastNameKey: lastNameKey(row.lastName || row.goalieFullName),
    team: normTeam(row.teamAbbrevs),
    points: Number(pointsOverride ?? fantasyPoints),
  };
}

function buildIndexes(entries) {
  const byLastTeam = new Map();
  const byLastTeamInitial = new Map();
  const byFullName = new Map();
  const byLastInitial = new Map();
  const byLastName = new Map();

  for (const entry of entries) {
    addIndex(byLastTeam, `${entry.lastNameKey}|${entry.team}`, entry);
    const firstInitial = normText(entry.fullName).slice(0, 1);
    if (firstInitial) {
      addIndex(byLastTeamInitial, `${entry.lastNameKey}|${entry.team}|${firstInitial}`, entry);
      addIndex(byLastInitial, `${entry.lastNameKey}|${firstInitial}`, entry);
    }
    addIndex(byFullName, entry.fullNameKey, entry);
    addIndex(byLastName, entry.lastNameKey, entry);
  }

  return {
    byLastTeam,
    byLastTeamInitial,
    byFullName,
    byLastInitial,
    byLastName,
  };
}

function resolvePlayer(parsed, windowIndexes, seasonIndexes) {
  const exactWindow = getUniqueEntry(windowIndexes.byLastTeam.get(parsed.key));
  if (exactWindow) {
    return { entry: exactWindow, status: "ok" };
  }

  if (parsed.firstInitial) {
    const exactWindowInitial = getUniqueEntry(
      windowIndexes.byLastTeamInitial.get(`${parsed.lastName}|${parsed.team}|${parsed.firstInitial}`)
    );
    if (exactWindowInitial) {
      return { entry: exactWindowInitial, status: "ok_initial_team_match" };
    }
  }

  const fullNameWindow = getUniqueEntry(windowIndexes.byFullName.get(parsed.fullName));
  if (fullNameWindow) {
    return { entry: fullNameWindow, status: "window_name_match_team_drift" };
  }

  if (parsed.firstInitial) {
    const lastInitialWindow = getUniqueEntry(windowIndexes.byLastInitial.get(`${parsed.lastName}|${parsed.firstInitial}`));
    if (lastInitialWindow) {
      return { entry: lastInitialWindow, status: "window_last_initial_match" };
    }
  }

  const lastNameWindow = getUniqueEntry(windowIndexes.byLastName.get(parsed.lastName));
  if (lastNameWindow) {
    return { entry: lastNameWindow, status: "window_last_name_match_team_drift" };
  }

  const fullNameSeason = getUniqueEntry(seasonIndexes.byFullName.get(parsed.fullName));
  if (fullNameSeason) {
    return {
      entry: {
        ...fullNameSeason,
        points: 0,
      },
      status: "no_games_in_window",
    };
  }

  if (parsed.firstInitial) {
    const lastInitialSeason = getUniqueEntry(seasonIndexes.byLastInitial.get(`${parsed.lastName}|${parsed.firstInitial}`));
    if (lastInitialSeason) {
      return {
        entry: {
          ...lastInitialSeason,
          points: 0,
        },
        status: "no_games_in_window_last_initial_match",
      };
    }
  }

  const lastNameSeason = getUniqueEntry(seasonIndexes.byLastName.get(parsed.lastName));
  if (lastNameSeason) {
    return {
      entry: {
        ...lastNameSeason,
        points: 0,
      },
      status: "no_games_in_window_last_name_match",
    };
  }

  return {
    entry: {
      fullName: parsed.playerName,
      team: parsed.team,
      points: 0,
    },
    status: "assumed_zero_no_api_match",
  };
}

async function main() {
  const roster = JSON.parse(await readFile("data/period3-rosters.json", "utf8"));
  const skatersWindowRows = await fetchAll("skater", "points", FROM_DATE, TO_DATE);
  const goaliesWindowRows = await fetchAll("goalie", "wins", FROM_DATE, TO_DATE);
  const skatersSeasonRows = await fetchAll("skater", "points", null, TO_DATE);
  const goaliesSeasonRows = await fetchAll("goalie", "wins", null, TO_DATE);

  const skaterWindowIndexes = buildIndexes(skatersWindowRows.map((row) => toSkaterEntry(row)));
  const goalieWindowIndexes = buildIndexes(goaliesWindowRows.map((row) => toGoalieEntry(row)));
  const skaterSeasonIndexes = buildIndexes(skatersSeasonRows.map((row) => toSkaterEntry(row, 0)));
  const goalieSeasonIndexes = buildIndexes(goaliesSeasonRows.map((row) => toGoalieEntry(row, 0)));

  const unresolved = [];
  const participants = [];

  for (const participant of roster.participants ?? []) {
    let totalPoints = 0;
    const players = [];

    for (const raw of participant.goalies ?? []) {
      const parsed = parseRosterEntry(raw);
      if (!parsed) {
        continue;
      }

      const resolved = resolvePlayer(parsed, goalieWindowIndexes, goalieSeasonIndexes);
      totalPoints += resolved.entry.points;
      players.push({
        role: "G",
        player: raw,
        points: resolved.entry.points,
        matched: `${resolved.entry.fullName} (${resolved.entry.team})`,
        status: resolved.status,
      });
    }

    for (const raw of [...(participant.defenders ?? []), ...(participant.forwards ?? [])]) {
      const parsed = parseRosterEntry(raw);
      if (!parsed) {
        continue;
      }

      const resolved = resolvePlayer(parsed, skaterWindowIndexes, skaterSeasonIndexes);
      totalPoints += resolved.entry.points;
      players.push({
        role: "S",
        player: raw,
        points: resolved.entry.points,
        matched: `${resolved.entry.fullName} (${resolved.entry.team})`,
        status: resolved.status,
      });
    }

    participants.push({
      participant: participant.name,
      totalPoints,
      players,
    });
  }

  participants.sort((left, right) => right.totalPoints - left.totalPoints || left.participant.localeCompare(right.participant, "sv"));

  console.log(
    JSON.stringify(
      {
        window: {
          from: FROM_DATE,
          to: TO_DATE,
          seasonId: SEASON_ID,
        },
        participants,
        unresolved,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
