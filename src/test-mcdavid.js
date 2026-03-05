import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const MCDAVID_ID = 8478402;
const SEASON_ID = 20252026;

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/server.js"],
    cwd: process.cwd(),
  });

  const client = new Client(
    {
      name: "nhl-stats-mcdavid-test",
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
      arguments: {
        playerId: MCDAVID_ID,
      },
    });

    const rawText = String(response.content?.[0]?.text ?? "");
    assert.ok(rawText.length > 0, "MCP tool response was empty");

    const data = JSON.parse(rawText);

    assert.equal(data.playerId, MCDAVID_ID, "Unexpected player id returned");
    assert.equal(data.isActive, true, "Player is expected to be active");
    assert.equal(
      data?.featuredStats?.season,
      SEASON_ID,
      "featuredStats.season is not 20252026"
    );

    const seasonLine = (data.seasonTotals ?? []).find(
      (row) => row?.season === SEASON_ID && row?.gameTypeId === 2 && row?.leagueAbbrev === "NHL"
    );

    assert.ok(seasonLine, "No NHL regular season row found for 20252026 in seasonTotals");

    console.log("✅ Connor McDavid 2025-2026 stats fetched successfully");
    console.log(
      JSON.stringify(
        {
          playerId: data.playerId,
          name: `${data.firstName?.default} ${data.lastName?.default}`,
          season: data.featuredStats?.season,
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
  console.error("❌ Connor McDavid test failed");
  console.error(error);
  process.exit(1);
});
