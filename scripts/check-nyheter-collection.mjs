const baseUrl = String(process.env.BASE_URL || "https://nhl-stats-production.up.railway.app").replace(/\/$/, "");
const fileName = String(process.env.EXCEL_FILE || "NHL tipset 2026 jan-apr period2.xlsx");
const seasonId = String(process.env.SEASON_ID || "20252026");
const snapshotsLimit = Number.parseInt(String(process.env.SNAPSHOTS_LIMIT || "14"), 10);

function sumSourceBreakdown(sourceBreakdown) {
  if (!sourceBreakdown || typeof sourceBreakdown !== "object") {
    return 0;
  }

  return Object.values(sourceBreakdown).reduce((sum, value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? sum + numericValue : sum;
  }, 0);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}

async function run() {
  const snapshotsUrl = `${baseUrl}/api/nyheter/snapshots?file=${encodeURIComponent(fileName)}&seasonId=${encodeURIComponent(
    seasonId
  )}&limit=${encodeURIComponent(String(snapshotsLimit))}`;
  const tipsenUrl = `${baseUrl}/api/tipsen-summary?file=${encodeURIComponent(fileName)}&seasonId=${encodeURIComponent(seasonId)}`;

  const [snapshotsData, tipsenData] = await Promise.all([
    fetchJson(snapshotsUrl),
    fetchJson(tipsenUrl),
  ]);

  const snapshots = Array.isArray(snapshotsData?.snapshots) ? snapshotsData.snapshots : [];
  const latestSnapshot = snapshots[0] ?? null;

  const participants = Array.isArray(tipsenData?.participants) ? tipsenData.participants : [];
  const playerRows = participants.flatMap((participant) => participant?.players || []);

  console.log("Nyheter weekly check");
  console.log(`base_url: ${baseUrl}`);
  console.log(`file: ${fileName}`);
  console.log(`season: ${seasonId}`);
  console.log(`snapshots_total: ${snapshots.length}`);

  if (latestSnapshot) {
    const latestPlayersFromSnapshot = sumSourceBreakdown(latestSnapshot?.payload?.sourceBreakdown);
    console.log(`latest_snapshot_date: ${latestSnapshot.snapshotDate || "-"}`);
    console.log(`latest_snapshot_collected_at: ${latestSnapshot.collectedAt || "-"}`);
    console.log(`latest_snapshot_participants: ${latestSnapshot?.payload?.participantStandings?.length || 0}`);
    console.log(`latest_snapshot_players: ${latestPlayersFromSnapshot}`);
    console.log(`latest_snapshot_risers: ${latestSnapshot?.payload?.risers?.length || 0}`);
    console.log(`latest_snapshot_injuries: ${latestSnapshot?.payload?.injuries?.length || 0}`);
  } else {
    console.log("latest_snapshot_date: -");
  }

  console.log(`tipsen_participants_now: ${participants.length}`);
  console.log(`tipsen_player_rows_now: ${playerRows.length}`);

  const notFoundCount = playerRows.filter((player) => player?.source === "not_found").length;
  console.log(`tipsen_not_found_now: ${notFoundCount}`);

  const byParticipant = participants.map((participant) => ({
    name: participant?.name,
    totalDelta: Number(participant?.totalDelta ?? 0),
  }));

  byParticipant.sort((left, right) => right.totalDelta - left.totalDelta);
  const topThree = byParticipant.slice(0, 3);

  for (let index = 0; index < topThree.length; index += 1) {
    const item = topThree[index];
    console.log(`standings_${index + 1}: ${item.name} (${item.totalDelta})`);
  }
}

run().catch((error) => {
  console.error(`check_failed: ${error.message}`);
  process.exit(1);
});
