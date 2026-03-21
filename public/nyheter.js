const DEFAULT_FILE = "NHL tipset 2026 jan-apr period3.xlsx";
const DEFAULT_SEASON_ID = "20252026";

const NYHETER_MODE_PERIOD = "period";
const NYHETER_MODE_WEEKLY = "weekly";

const fallbackNyheterData = {
  mode: NYHETER_MODE_PERIOD,
  weekStart: "2026-03-09",
  weekEnd: "2026-03-14",
  leaderName: "Timmy",
  leaderDeltaWeek: "+177",
  spotlights: {
    leader: {
      value: "Timmy",
      sub: "Leder tabellen i senaste tillgängliga snapshot",
    },
    hot: {
      value: "Kucherov (TBL)",
      sub: "Stor poängimpact i senaste rapporten",
    },
    bottom: {
      value: "3 lag i botten",
      sub: "Små marginaler i kampen om sista platserna",
    },
  },
  leadSummary:
    "Nyheter laddades med fallback-data. Uppdatera sidan om du vill hämta den senaste snapshoten på nytt.",
  risers: [
    { playerName: "Kucherov (TBL)", deltaWeek: "+28", participant: "Mattias" },
    { playerName: "Draisaitl (EDM)", deltaWeek: "+26", participant: "Fredrik" },
    { playerName: "Dahlin (BUF)", deltaWeek: "+23", participant: "Joakim" },
  ],
  fallers: [
    { playerName: "Crosby (PIT)", deltaWeek: "+2", participant: "Mattias" },
    { playerName: "Morrissey (WPG)", deltaWeek: "+2", participant: "Joakim" },
    { playerName: "Carlson (ANA)", deltaWeek: "+3", participant: "Henrik" },
  ],
  participantImpacts: [],
  injuryUpdates: [],
  bottomBattleLead: "Bottenstriden är fortsatt jämn och avgörs på små marginaler.",
  bottomBattle: [],
  funNote: "",
};

let nyheterData = fallbackNyheterData;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateToIso(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function minusDays(isoDate, days) {
  const [year, month, day] = String(isoDate).split("-").map((part) => Number.parseInt(part, 10));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() - days);
  return dateToIso(base);
}

function parseIsoDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDelta(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

function cleanPlayerName(label) {
  return String(label || "").trim() || "Okänd spelare";
}

function getTopContributor(participantName, risers) {
  return risers.find((item) => item.participantName === participantName) || null;
}

function getBiggestDrag(participantName, slowest) {
  return slowest.find((item) => item.participantName === participantName) || null;
}

function buildUniqueSlowestClimbers(slowest, limit = 3) {
  const byPlayer = new Map();

  for (const entry of slowest) {
    const playerName = cleanPlayerName(entry.playerLabel);
    if (!byPlayer.has(playerName)) {
      byPlayer.set(playerName, {
        playerName,
        deltaWeek: formatDelta(entry.deltaPoints),
        participants: [String(entry.participantName || "-")],
      });
      continue;
    }

    const existing = byPlayer.get(playerName);
    const participantName = String(entry.participantName || "-");
    if (!existing.participants.includes(participantName)) {
      existing.participants.push(participantName);
    }
  }

  return Array.from(byPlayer.values())
    .slice(0, limit)
    .map((item) => ({
      playerName: item.playerName,
      deltaWeek: item.deltaWeek,
      participant: item.participants.length > 1 ? `${item.participants[0]} med flera` : item.participants[0],
    }));
}

function buildUniqueTopRisers(risers, limit = 3) {
  const byPlayer = new Map();

  for (const entry of risers) {
    const playerName = cleanPlayerName(entry.playerLabel);
    if (!byPlayer.has(playerName)) {
      byPlayer.set(playerName, {
        playerName,
        deltaWeek: formatDelta(entry.deltaPoints),
        participants: [String(entry.participantName || "-")],
      });
      continue;
    }

    const existing = byPlayer.get(playerName);
    const participantName = String(entry.participantName || "-");
    if (!existing.participants.includes(participantName)) {
      existing.participants.push(participantName);
    }
  }

  return Array.from(byPlayer.values())
    .slice(0, limit)
    .map((item) => ({
      playerName: item.playerName,
      deltaWeek: item.deltaWeek,
      participant: item.participants.length > 1 ? `${item.participants[0]} med flera` : item.participants[0],
    }));
}

function mapParticipantTotals(payload) {
  const standings = Array.isArray(payload?.participantStandings) ? payload.participantStandings : [];
  return new Map(
    standings.map((entry) => [String(entry?.name || "").trim(), Number(entry?.totalDelta) || 0]).filter((entry) => entry[0])
  );
}

function mapPlayerTotals(payload) {
  const playerTotals = Array.isArray(payload?.playerTotals) ? payload.playerTotals : [];
  const result = new Map();
  for (const entry of playerTotals) {
    const participantName = String(entry?.participantName || "").trim();
    const playerLabel = cleanPlayerName(entry?.playerLabel);
    const key = `${participantName}::${playerLabel}`;
    result.set(key, Number(entry?.deltaPoints) || 0);
  }
  return result;
}

function selectWeeklyBaselineSnapshot(snapshots, latestSnapshotDate) {
  const targetIso = minusDays(latestSnapshotDate, 6);
  const targetDate = parseIsoDate(targetIso);
  if (!targetDate) {
    return null;
  }

  for (let index = 1; index < snapshots.length; index += 1) {
    const candidate = snapshots[index];
    const candidateDate = parseIsoDate(candidate?.snapshotDate);
    if (!candidateDate) {
      continue;
    }
    if (candidateDate <= targetDate) {
      return candidate;
    }
  }

  return null;
}

function buildWeeklyDeltaContext(latestSnapshot, baselineSnapshot) {
  const latestPayload = latestSnapshot?.payload || {};
  const baselinePayload = baselineSnapshot?.payload || {};
  const latestStandings = Array.isArray(latestPayload?.participantStandings) ? latestPayload.participantStandings : [];
  const baselineParticipantTotals = mapParticipantTotals(baselinePayload);

  const participantWeeklyRows = latestStandings
    .map((entry) => {
      const participantName = String(entry?.name || "").trim();
      const latestTotal = Number(entry?.totalDelta) || 0;
      const baselineTotal = baselineParticipantTotals.get(participantName) || 0;
      return {
        name: participantName,
        weeklyDelta: latestTotal - baselineTotal,
      };
    })
    .sort((left, right) => right.weeklyDelta - left.weeklyDelta);

  const latestPlayerTotals = Array.isArray(latestPayload?.playerTotals) ? latestPayload.playerTotals : [];
  const baselinePlayerTotals = mapPlayerTotals(baselinePayload);
  const weeklyPlayerRows = latestPlayerTotals
    .map((entry) => {
      const participantName = String(entry?.participantName || "").trim();
      const playerLabel = cleanPlayerName(entry?.playerLabel);
      const latestDelta = Number(entry?.deltaPoints) || 0;
      const baselineDelta = baselinePlayerTotals.get(`${participantName}::${playerLabel}`) || 0;
      return {
        participantName,
        playerLabel,
        deltaPoints: latestDelta - baselineDelta,
      };
    })
    .filter((entry) => entry.playerLabel && entry.participantName);

  const weeklyParticipantImpacts = participantWeeklyRows.map((entry) => {
    const ownPlayers = weeklyPlayerRows.filter((row) => row.participantName === entry.name);
    const topContributor = [...ownPlayers].sort((left, right) => right.deltaPoints - left.deltaPoints)[0] || null;
    const biggestDrag = [...ownPlayers].sort((left, right) => left.deltaPoints - right.deltaPoints)[0] || null;

    return {
      participantName: entry.name,
      deltaWeek: `${formatDelta(entry.weeklyDelta)} vecka`,
      topContributor: topContributor ? cleanPlayerName(topContributor.playerLabel) : "Inget anmärkningsvärt draglok",
      topContributorDelta: topContributor ? formatDelta(topContributor.deltaPoints) : "-",
      biggestDrag: biggestDrag ? cleanPlayerName(biggestDrag.playerLabel) : "Ingen anmärkningsvärd broms",
      biggestDragDelta: biggestDrag ? formatDelta(biggestDrag.deltaPoints) : "-",
    };
  });

  return {
    weekStart: String(baselineSnapshot?.snapshotDate || ""),
    weekEnd: String(latestSnapshot?.snapshotDate || ""),
    participantWeeklyRows,
    weeklyPlayerRows,
    weeklyParticipantImpacts,
  };
}

function buildNyheterDataFromSnapshots(snapshots) {
  const latestSnapshot = snapshots[0] || null;
  const payload = latestSnapshot?.payload || {};
  const standings = Array.isArray(payload.participantStandings) ? payload.participantStandings : [];
  const risers = Array.isArray(payload.risers) ? payload.risers : [];
  const slowest = Array.isArray(payload.slowestClimbers) ? payload.slowestClimbers : [];
  const participantImpactsPayload = Array.isArray(payload.participantImpacts) ? payload.participantImpacts : [];
  const injuries = Array.isArray(payload.injuries) ? payload.injuries : [];

  if (!standings.length) {
    return fallbackNyheterData;
  }

  const leader = standings[0];
  const hotPlayer = risers[0] || null;
  const bottomThree = standings.slice(-3);
  const bottomGap =
    bottomThree.length >= 2
      ? Math.abs(Number(bottomThree[0].totalDelta || 0) - Number(bottomThree[bottomThree.length - 1].totalDelta || 0))
      : 0;

  const participantImpactByName = new Map(
    participantImpactsPayload.map((entry) => [String(entry?.participantName || ""), entry])
  );

  const participantImpactsPeriod = standings.map((entry) => {
    const ownImpact = participantImpactByName.get(entry.name);
    const topContributorFallback = getTopContributor(entry.name, risers);
    const biggestDragFallback = getBiggestDrag(entry.name, slowest);
    const topContributorName = ownImpact
      ? cleanPlayerName(ownImpact.topContributor)
      : topContributorFallback
      ? cleanPlayerName(topContributorFallback.playerLabel)
      : "Inget anmärkningsvärt draglok";
    const biggestDragName = ownImpact
      ? cleanPlayerName(ownImpact.biggestDrag)
      : biggestDragFallback
      ? cleanPlayerName(biggestDragFallback.playerLabel)
      : "Ingen anmärkningsvärd broms";

    return {
      participantName: entry.name,
      deltaWeek: `${formatDelta(entry.totalDelta)} totalt`,
      topContributor: topContributorName,
      topContributorDelta: ownImpact
        ? ownImpact.topContributorDelta === "-"
          ? "-"
          : formatDelta(ownImpact.topContributorDelta)
        : topContributorFallback
        ? formatDelta(topContributorFallback.deltaPoints)
        : "-",
      biggestDrag: biggestDragName,
      biggestDragDelta: ownImpact
        ? ownImpact.biggestDragDelta === "-"
          ? "-"
          : formatDelta(ownImpact.biggestDragDelta)
        : biggestDragFallback
        ? formatDelta(biggestDragFallback.deltaPoints)
        : "-",
    };
  });

  const latestSnapshotDate = String(latestSnapshot?.snapshotDate || "");
  const weeklyBaseline = latestSnapshotDate ? selectWeeklyBaselineSnapshot(snapshots, latestSnapshotDate) : null;
  const weeklyContext = weeklyBaseline ? buildWeeklyDeltaContext(latestSnapshot, weeklyBaseline) : null;
  const weeklyMode = Boolean(
    weeklyContext &&
      Array.isArray(payload.playerTotals) &&
      Array.isArray(weeklyBaseline?.payload?.playerTotals)
  );

  const injuryUpdates = injuries.slice(0, 8).map((entry) => ({
    label: cleanPlayerName(entry.playerLabel),
    detail: `${entry.injuryStatus || "Status"}: ${entry.injuryTimeline || "uppdatering kommer"}`,
  }));

  const bottomBattle = bottomThree.map((entry) => {
    const pointsToLeader = Number(leader.totalDelta || 0) - Number(entry.totalDelta || 0);
    return {
      label: entry.name,
      detail: `${pointsToLeader} poang upp till ledaren`,
    };
  });

  const snapshotDate = latestSnapshotDate;
  const weekStart = snapshotDate ? minusDays(snapshotDate, 6) : fallbackNyheterData.weekStart;
  const weekEnd = snapshotDate || fallbackNyheterData.weekEnd;

  const modeWeekStart = weeklyMode ? weeklyContext.weekStart : weekStart;
  const modeWeekEnd = weeklyMode ? weeklyContext.weekEnd : weekEnd;
  const modeRisers = weeklyMode ? buildUniqueTopRisers(weeklyContext.weeklyPlayerRows, 3) : buildUniqueTopRisers(risers, 3);
  const modeFallers = weeklyMode
    ? buildUniqueSlowestClimbers(weeklyContext.weeklyPlayerRows, 3)
    : buildUniqueSlowestClimbers(slowest, 3);
  const modeParticipantImpacts = weeklyMode ? weeklyContext.weeklyParticipantImpacts : participantImpactsPeriod;
  const modeBottomSub = weeklyMode
    ? "Veckoläget: bottenstriden lever inför period 3-starten"
    : "Bottenstriden lever in i sista omgången av period 2";
  const modeLeadSummary = weeklyMode
    ? `${leader.name} toppar fortfarande totalen, men veckans svängningar var tydliga bakom ledaren. ` +
      "Det här utskicket bygger på förändringen mellan två snapshots under veckan."
    : `${leader.name} leder fortsatt tabellen, men jakten är intensiv bakom med små marginaler mellan plats 2-4. ` +
      "Senaste snapshoten visar att toppspelarna driver stora svängningar och att skadeläget fortfarande kan avgöra slutspurten. I morgon startar period 3.";

  return {
    mode: weeklyMode ? NYHETER_MODE_WEEKLY : NYHETER_MODE_PERIOD,
    weekEnd: modeWeekEnd,
    weekStart: modeWeekStart,
    leaderName: String(leader.name || ""),
    leaderDeltaWeek: formatDelta(leader.totalDelta),
    spotlights: {
      leader: {
        value: String(leader.name || "-"),
        sub: `Leder tabellen med ${formatDelta(leader.totalDelta)} totalt`,
      },
      hot: {
        value: hotPlayer ? cleanPlayerName(hotPlayer.playerLabel) : "Ingen tydlig raket",
        sub: hotPlayer
          ? `${formatDelta(hotPlayer.deltaPoints)} för ${hotPlayer.participantName}`
          : "Senaste snapshot saknar raketlista",
      },
      bottom: {
        value: `${bottomThree.length} lag / ${bottomGap} poäng`,
        sub: modeBottomSub,
      },
    },
    leadSummary: modeLeadSummary,
    risers: modeRisers,
    fallers: modeFallers,
    participantImpacts: modeParticipantImpacts,
    injuryUpdates,
    bottomBattleLead:
      "Nere i tabellen är trycket högt. Ett enda stort spelarskifte kan fortfarande flytta flera placeringar samtidigt.",
    bottomBattle,
    funNote:
      "",
  };
}

async function loadNyheterData() {
  try {
    let resolvedFile = DEFAULT_FILE;
    try {
      const filesResponse = await fetch("/api/excel-files");
      if (filesResponse.ok) {
        const filesPayload = await filesResponse.json();
        const files = Array.isArray(filesPayload?.files) ? filesPayload.files : [];
        const periodThreeFile = files.find((fileName) => /period\s*3/i.test(String(fileName)));
        const periodTwoFile = files.find((fileName) => /period\s*2/i.test(String(fileName)));
        resolvedFile = periodThreeFile || periodTwoFile || files[0] || DEFAULT_FILE;
      }
    } catch {
      resolvedFile = DEFAULT_FILE;
    }

    const params = new URLSearchParams({
      file: resolvedFile,
      seasonId: DEFAULT_SEASON_ID,
      limit: "21",
    });
    const response = await fetch(`/api/nyheter/snapshots?${params.toString()}`);
    if (!response.ok) {
      return fallbackNyheterData;
    }

    const body = await response.json();
    const snapshots = Array.isArray(body?.snapshots) ? body.snapshots : [];
    if (!snapshots.length) {
      return fallbackNyheterData;
    }

    return buildNyheterDataFromSnapshots(snapshots);
  } catch {
    return fallbackNyheterData;
  }
}

function renderRankList(elementId, items) {
  const list = document.getElementById(elementId);
  if (!list) {
    return;
  }

  list.innerHTML = "";
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const li = document.createElement("li");
    li.className = "rank-item";

    const nr = document.createElement("span");
    nr.className = "nr";
    nr.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = `${item.playerName} · ${item.participant}`;

    const delta = document.createElement("span");
    const isUp = String(item.deltaWeek).startsWith("+");
    delta.className = `delta ${isUp ? "up" : "down"}`;
    delta.textContent = item.deltaWeek;

    li.appendChild(nr);
    li.appendChild(name);
    li.appendChild(delta);
    list.appendChild(li);
  }
}

function renderImpacts() {
  const body = document.getElementById("impactsBody");
  if (!body) {
    return;
  }

  body.innerHTML = "";
  for (const impact of nyheterData.participantImpacts) {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = impact.participantName;

    const deltaTd = document.createElement("td");
    deltaTd.textContent = impact.deltaWeek;

    const topTd = document.createElement("td");
    topTd.textContent =
      impact.topContributorDelta === "-" ? impact.topContributor : `${impact.topContributor} (${impact.topContributorDelta})`;

    const dragTd = document.createElement("td");
    dragTd.textContent = impact.biggestDragDelta === "-" ? impact.biggestDrag : `${impact.biggestDrag} (${impact.biggestDragDelta})`;

    tr.appendChild(nameTd);
    tr.appendChild(deltaTd);
    tr.appendChild(topTd);
    tr.appendChild(dragTd);
    body.appendChild(tr);
  }
}

function renderTagList(elementId, items, tagClass) {
  const list = document.getElementById(elementId);
  if (!list) {
    return;
  }

  list.innerHTML = "";
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const li = document.createElement("li");
    li.className = "rank-item";

    const nr = document.createElement("span");
    nr.className = "nr";
    nr.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = item.label;

    const tag = document.createElement("span");
    tag.className = `tag ${tagClass}`;
    tag.textContent = item.detail;

    li.appendChild(nr);
    li.appendChild(label);
    li.appendChild(tag);
    list.appendChild(li);
  }
}

function renderHero() {
  const lead = document.getElementById("heroLead");
  const weekChip = document.getElementById("weekChip");
  const statusChip = document.getElementById("statusChip");
  const spotLeader = document.getElementById("spotLeader");
  const spotLeaderSub = document.getElementById("spotLeaderSub");
  const spotHot = document.getElementById("spotHot");
  const spotHotSub = document.getElementById("spotHotSub");
  const spotBottom = document.getElementById("spotBottom");
  const spotBottomSub = document.getElementById("spotBottomSub");

  if (lead) {
    lead.textContent = nyheterData.leadSummary;
  }

  if (weekChip) {
    weekChip.textContent = `Vecka ${nyheterData.weekStart} – ${nyheterData.weekEnd}`;
  }

  if (statusChip) {
    statusChip.textContent = `Ledare: ${nyheterData.leaderName} (${nyheterData.leaderDeltaWeek})`;
  }

  if (spotLeader) {
    spotLeader.textContent = nyheterData.spotlights.leader.value;
  }

  if (spotLeaderSub) {
    spotLeaderSub.textContent = nyheterData.spotlights.leader.sub;
  }

  if (spotHot) {
    spotHot.textContent = nyheterData.spotlights.hot.value;
  }

  if (spotHotSub) {
    spotHotSub.textContent = nyheterData.spotlights.hot.sub;
  }

  if (spotBottom) {
    spotBottom.textContent = nyheterData.spotlights.bottom.value;
  }

  if (spotBottomSub) {
    spotBottomSub.textContent = nyheterData.spotlights.bottom.sub;
  }
}

function renderModeLabels() {
  const risersTitle = document.getElementById("risersTitle");
  const fallersTitle = document.getElementById("fallersTitle");
  const impactDeltaHeader = document.getElementById("impactDeltaHeader");
  const isWeekly = nyheterData.mode === NYHETER_MODE_WEEKLY;

  if (risersTitle) {
    risersTitle.textContent = isWeekly ? "🚀 Veckans raketer" : "🚀 Raketer (period 2 totalt)";
  }

  if (fallersTitle) {
    fallersTitle.textContent = isWeekly
      ? "🐢 Veckans långsammaste klättrare"
      : "🐢 Långsammaste klättrare (period 2 totalt)";
  }

  if (impactDeltaHeader) {
    impactDeltaHeader.textContent = isWeekly ? "Vecka" : "Totalt (period 2)";
  }
}

function renderBottomBattle() {
  const lead = document.getElementById("bottomBattleLead");
  if (lead) {
    lead.textContent = nyheterData.bottomBattleLead;
  }

  renderTagList("bottomBattle", nyheterData.bottomBattle, "fun");
}

function renderFunNote() {
  const note = document.getElementById("funNote");
  if (note) {
    note.textContent = nyheterData.funNote;
    const card = note.closest(".card");
    if (card) {
      card.style.display = "none";
    }
  }
}

async function initNyheter() {
  nyheterData = await loadNyheterData();
  renderModeLabels();
  renderHero();
  renderRankList("risers", nyheterData.risers);
  renderRankList("fallers", nyheterData.fallers);
  renderImpacts();
  renderTagList("injuries", nyheterData.injuryUpdates, "alert");
  renderBottomBattle();
  renderFunNote();
}

initNyheter();
