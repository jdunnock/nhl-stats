import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["src/server.js"],
    cwd: process.cwd(),
  });

  const client = new Client(
    {
      name: "nhl-stats-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  const standings = await client.callTool({
    name: "get_standings_now",
    arguments: {},
  });

  const activePlayers = await client.callTool({
    name: "get_active_players_stats",
    arguments: {
      seasonId: "20252026",
      includeSkaters: true,
      includeGoalies: true,
      verifyActiveViaPlayerEndpoint: false,
      limitPerTeam: 2,
    },
  });

  console.log("=== get_standings_now (preview) ===");
  console.log(String(standings.content?.[0]?.text || "").slice(0, 400));

  console.log("\n=== get_active_players_stats (preview) ===");
  console.log(String(activePlayers.content?.[0]?.text || "").slice(0, 800));

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
