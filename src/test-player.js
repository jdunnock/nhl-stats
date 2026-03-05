import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function parseArgs(argv) {
  const [playerIdArg, seasonIdArg] = argv;

  const playerId = Number.parseInt(playerIdArg, 10);
  const seasonId = seasonIdArg ? Number.parseInt(seasonIdArg, 10) : 20252026;

  if (!Number.isInteger(playerId) || playerId <= 0) {
    throw new Error("Usage: npm run test:player -- <playerId> [seasonId]");
  }

  if (!Number.isInteger(seasonId) || seasonId < 10000000 || seasonId > 99999999) {
    throw new Error("seasonId must be an 8-digit integer, e.g. 20252026");
  }

  return { playerId, seasonId };
}

async function main() {
  const { playerId, seasonId } = parseArgs(process.argv.slice(2));

  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/server.js"],
    cwd: process.cwd(),
  });

  const client = new Client(
    {
      name: "nhl-stats-generic-player-test",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  try {
    const response = await client.callTool({
      name: "get_player_landing",
      arguments: { playerId },
    });

    const rawText = String(response.content?.[0]?.text ?? "");
    assert.ok(rawText.length > 0, "MCP tool response was empty");

    const data = JSON.parse(rawText);

    assert.equal(data.playerId, playerId, "Unexpected player id returned");

    const seasonLine = (data.seasonTotals ?? []).find(
      (row) => row?.season === seasonId && row?.gameTypeId === 2 && row?.leagueAbbrev === "NHL"
    );

    assert.ok(
      seasonLine,
      `No NHL regular season row found for ${seasonId} in seasonTotals`
    );

    console.log("✅ Player season stats fetched successfully");
    console.log(
      JSON.stringify(
        {
          playerId: data.playerId,
          name: `${data.firstName?.default} ${data.lastName?.default}`,
          isActive: data.isActive,
          team: data.currentTeamAbbrev,
          season: seasonId,
          gamesPlayed: seasonLine.gamesPlayed,
          goals: seasonLine.goals,
          assists: seasonLine.assists,
          points: seasonLine.points,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("❌ Generic player test failed");
  console.error(error.message || error);
  process.exit(1);
});
