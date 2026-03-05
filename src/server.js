import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NHL_API_BASE = "https://api-web.nhle.com/v1";
const responseCache = new Map();

const server = new McpServer({
  name: "nhl-stats-mcp",
  version: "1.0.0",
});

async function fetchJson(path) {
  const cached = responseCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${NHL_API_BASE}${path}`);
    if (response.ok) {
      const data = await response.json();
      responseCache.set(path, {
        data,
        expiresAt: Date.now() + 2 * 60 * 1000,
      });
      return data;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
      const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 1200;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    const body = await response.text();
    throw new Error(`NHL API request failed (${response.status}) for ${path}: ${body.slice(0, 200)}`);
  }

  throw new Error(`NHL API request failed for ${path}: exhausted retries`);
}

function textResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

server.tool(
  "get_standings_now",
  "Get NHL standings for the current date (includes current seasonId).",
  {},
  async () => {
    const data = await fetchJson("/standings/now");
    return textResult(data);
  }
);

server.tool(
  "get_team_stats_now",
  "Get current season stats for one NHL team (skaters and goalies).",
  {
    teamAbbrev: z.string().min(2).max(3),
  },
  async ({ teamAbbrev }) => {
    const team = teamAbbrev.toUpperCase();
    const data = await fetchJson(`/club-stats/${team}/now`);
    return textResult(data);
  }
);

server.tool(
  "get_player_landing",
  "Get player profile including isActive and featured/current season stats.",
  {
    playerId: z.number().int().positive(),
  },
  async ({ playerId }) => {
    const data = await fetchJson(`/player/${playerId}/landing`);
    return textResult(data);
  }
);

server.tool(
  "get_active_players_stats",
  "Get active NHL players and their current season stats from all teams (defaults to 2025-2026 season filter).",
  {
    seasonId: z.string().regex(/^\d{8}$/).default("20252026"),
    verifyActiveViaPlayerEndpoint: z.boolean().default(false),
    includeSkaters: z.boolean().default(true),
    includeGoalies: z.boolean().default(true),
    limitPerTeam: z.number().int().positive().optional(),
  },
  async ({
    seasonId,
    verifyActiveViaPlayerEndpoint,
    includeSkaters,
    includeGoalies,
    limitPerTeam,
  }) => {
    const standings = await fetchJson("/standings/now");

    const teamAbbrevs = Array.from(
      new Set(
        (standings.standings ?? [])
          .map((entry) => entry?.teamAbbrev?.default)
          .filter(Boolean)
      )
    );

    const players = [];

    for (const teamAbbrev of teamAbbrevs) {
      const clubStats = await fetchJson(`/club-stats/${teamAbbrev}/now`);

      if (String(clubStats.season) !== seasonId) {
        continue;
      }

      const selected = [];

      if (includeSkaters) {
        for (const skater of clubStats.skaters ?? []) {
          selected.push({ ...skater, role: "skater" });
        }
      }

      if (includeGoalies) {
        for (const goalie of clubStats.goalies ?? []) {
          selected.push({ ...goalie, role: "goalie" });
        }
      }

      const limited = typeof limitPerTeam === "number" ? selected.slice(0, limitPerTeam) : selected;

      for (const player of limited) {
        players.push({
          teamAbbrev,
          seasonId: String(clubStats.season),
          gameType: clubStats.gameType,
          ...player,
        });
      }
    }

    let filteredPlayers = players;

    if (verifyActiveViaPlayerEndpoint) {
      filteredPlayers = [];

      for (const player of players) {
        try {
          const landing = await fetchJson(`/player/${player.playerId}/landing`);
          if (landing?.isActive) {
            filteredPlayers.push(player);
          }
        } catch {
        }
      }
    }

    return textResult({
      requestedSeasonId: seasonId,
      teamsProcessed: teamAbbrevs.length,
      playersReturned: filteredPlayers.length,
      verifyActiveViaPlayerEndpoint,
      items: filteredPlayers,
    });
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
