const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const totalListEl = document.getElementById("totalList");
const periodTitleEl = document.getElementById("periodTitle");
const totalTitleEl = document.getElementById("totalTitle");

const DEFAULT_SEASON_ID = "20252026";
const DEFAULT_COMPARE_DATE = "2026-01-24";
const PERIOD_THREE_START_DATE = "2026-03-15";
const PERIOD_TWO_POINTS_SCALE = [20, 16, 13, 11, 9, 7, 5, 4, 3, 2, 1];
const PERIOD_ONE_POINTS = new Map([
  ["mattias", 20],
  ["fredrik", 16],
  ["joakim", 13],
  ["jarmo", 11],
  ["timmy", 9],
  ["kjell", 7],
  ["henrik", 5],
]);
const PERIOD_TWO_FINAL_POINTS = new Map([
  ["mattias", 20],
  ["timmy", 16],
  ["joakim", 13],
  ["fredrik", 11],
  ["jarmo", 9],
  ["henrik", 7],
  ["kjell", 5],
]);

let selectedFile = "";
let selectedSeasonId = DEFAULT_SEASON_ID;
let selectedCompareDate = DEFAULT_COMPARE_DATE;

function setStatus(text) {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = text;
  statusEl.style.display = text ? "inline-flex" : "none";
}

function formatPoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  const numericValue = Number(value);
  return String(numericValue);
}

function applyPointsClass(element, value) {
  if (!element) {
    return;
  }

  element.classList.remove("points-positive", "points-negative", "points-neutral");

  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    element.classList.add("points-neutral");
    return;
  }

  const numericValue = Number(value);

  if (numericValue > 0) {
    element.classList.add("points-positive");
    return;
  }

  if (numericValue < 0) {
    element.classList.add("points-negative");
    return;
  }

  element.classList.add("points-neutral");
}

function renderPeriodTwoStandings(participants) {
  if (!listEl) {
    return;
  }

  listEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "row header";
  header.innerHTML = "<div>Plac</div><div>Deltagare</div><div>Poäng</div>";
  listEl.appendChild(header);

  participants.forEach((participant) => {
    const row = document.createElement("div");
    row.className = "row";
    const isWinner = Number(participant.rank) === 1;

    if (isWinner) {
      row.classList.add("winner-row");
    }

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = formatPoints(participant.rank);

    const name = document.createElement("div");
    name.className = "name";
    if (isWinner) {
      name.classList.add("winner-name");
      name.textContent = participant.name ? `🏆 ${participant.name}` : "🏆 -";
    } else {
      name.textContent = participant.name || "-";
    }

    const points = document.createElement("div");
    points.className = "points";
    points.textContent = formatPoints(participant.totalDelta);
    applyPointsClass(points, participant.totalDelta);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(points);

    listEl.appendChild(row);
  });
}

function renderTotalStandings(participants) {
  if (!totalListEl) {
    return;
  }

  totalListEl.innerHTML = "";

  const isPeriodThreeActive = participants.some((participant) => participant.periodThreePoints !== undefined);

  const header = document.createElement("div");
  header.className = "row total header";
  if (isPeriodThreeActive) {
    header.style.gridTemplateColumns = "40px 1fr 46px 46px 46px 66px";
  }
  header.innerHTML = isPeriodThreeActive
    ? "<div>Plac</div><div>Deltagare</div><div>P1</div><div>P2</div><div>P3</div><div>Totalt</div>"
    : "<div>Plac</div><div>Deltagare</div><div>P1</div><div>P2</div><div>Totalt</div>";
  totalListEl.appendChild(header);

  participants.forEach((participant) => {
    const row = document.createElement("div");
    row.className = "row total";
    if (isPeriodThreeActive) {
      row.style.gridTemplateColumns = "40px 1fr 46px 46px 46px 66px";
    }

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = formatPoints(participant.rank);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = participant.name || "-";

    const periodOne = document.createElement("div");
    periodOne.className = "points";
    periodOne.textContent = formatPoints(participant.periodOnePoints);
    applyPointsClass(periodOne, participant.periodOnePoints);

    const periodTwo = document.createElement("div");
    periodTwo.className = "points";
    periodTwo.textContent = formatPoints(participant.periodTwoPoints);
    applyPointsClass(periodTwo, participant.periodTwoPoints);

    const periodThree = document.createElement("div");
    periodThree.className = "points";
    periodThree.textContent = formatPoints(participant.periodThreePoints);
    applyPointsClass(periodThree, participant.periodThreePoints);

    const total = document.createElement("div");
    total.className = "points";
    total.textContent = formatPoints(participant.totalPeriodPoints);
    applyPointsClass(total, participant.totalPeriodPoints);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(periodOne);
    row.appendChild(periodTwo);
    if (isPeriodThreeActive) {
      row.appendChild(periodThree);
    }
    row.appendChild(total);

    totalListEl.appendChild(row);
  });
}

function isPeriodThreeActive(compareDate) {
  return String(compareDate ?? "") >= PERIOD_THREE_START_DATE;
}

function updateSectionTitles(compareDate) {
  const periodThree = isPeriodThreeActive(compareDate);

  if (periodTitleEl) {
    periodTitleEl.textContent = periodThree ? "Ställning Period 3" : "Slutställning Period 2";
  }

  if (totalTitleEl) {
    totalTitleEl.textContent = periodThree ? "Totalställning Period 1+2+3" : "Totalställning Period 1+2";
  }
}

function normalizeParticipantName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toSortablePoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(value);
}

function sortByCurrentPoints(participants) {
  return [...participants].sort((left, right) => {
    const pointsDiff = toSortablePoints(right.totalDelta) - toSortablePoints(left.totalDelta);
    if (pointsDiff !== 0) {
      return pointsDiff;
    }
    return String(left.name || "").localeCompare(String(right.name || ""), "sv");
  });
}

function applyCompetitionRank(sortedItems, pointsGetter) {
  let previousPoints = null;
  let currentRank = 0;

  return sortedItems.map((item, index) => {
    const points = toSortablePoints(pointsGetter(item));

    if (previousPoints === null || points !== previousPoints) {
      currentRank = index + 1;
      previousPoints = points;
    }

    return {
      ...item,
      rank: currentRank,
    };
  });
}

function getScalePointsByPosition(positionIndex) {
  return PERIOD_TWO_POINTS_SCALE[positionIndex] ?? 0;
}

function buildScalePointsByName(sortedParticipants) {
  const pointsByName = new Map();

  let index = 0;
  while (index < sortedParticipants.length) {
    const currentPoints = toSortablePoints(sortedParticipants[index].totalDelta);
    let groupEnd = index;

    while (
      groupEnd + 1 < sortedParticipants.length &&
      toSortablePoints(sortedParticipants[groupEnd + 1].totalDelta) === currentPoints
    ) {
      groupEnd += 1;
    }

    let groupPointsSum = 0;
    for (let position = index; position <= groupEnd; position += 1) {
      groupPointsSum += getScalePointsByPosition(position);
    }

    const groupSize = groupEnd - index + 1;
    const sharedPoints = Math.round(groupPointsSum / groupSize);

    for (let position = index; position <= groupEnd; position += 1) {
      const participant = sortedParticipants[position];
      pointsByName.set(normalizeParticipantName(participant.name), sharedPoints);
    }

    index = groupEnd + 1;
  }

  return pointsByName;
}

function buildTotalPeriodStandings(sortedParticipants, compareDate) {
  const periodThree = isPeriodThreeActive(compareDate);
  const periodPointsByName = buildScalePointsByName(sortedParticipants);

  const sortedTotalStandings = sortedParticipants
    .map((participant) => {
      const key = normalizeParticipantName(participant.name);
      const periodOnePoints = PERIOD_ONE_POINTS.get(key) ?? 0;
      const periodTwoPoints = periodThree ? (PERIOD_TWO_FINAL_POINTS.get(key) ?? 0) : (periodPointsByName.get(key) ?? 0);
      const periodThreePoints = periodThree ? (periodPointsByName.get(key) ?? 0) : undefined;

      return {
        name: participant.name,
        periodOnePoints,
        periodTwoPoints,
        periodThreePoints,
        totalPeriodPoints: periodOnePoints + periodTwoPoints + (periodThreePoints ?? 0),
      };
    })
    .sort((left, right) => {
      const diff = right.totalPeriodPoints - left.totalPeriodPoints;
      if (diff !== 0) {
        return diff;
      }

      return String(left.name || "").localeCompare(String(right.name || ""), "sv");
    });

  return applyCompetitionRank(sortedTotalStandings, (participant) => participant.totalPeriodPoints);
}

async function loadFiles() {
  const response = await fetch("/api/excel-files");
  const data = await response.json();

  if (!data.files?.length) {
    setStatus("Ingen Excel-fil hittades.");
    return;
  }

  const preferred = "NHL tipset 2026 jan-apr period2.xlsx";
  if (data.files.includes(preferred)) {
    selectedFile = preferred;
    return;
  }

  selectedFile = data.files[0];
}

async function loadSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  if (data?.compareDate) {
    selectedCompareDate = data.compareDate;
  }
}

async function loadStandings() {
  if (!selectedFile) {
    setStatus("Ingen Excel-fil hittades.");
    return;
  }

  setStatus("");

  const params = new URLSearchParams({
    file: selectedFile,
    seasonId: selectedSeasonId,
    compareDate: selectedCompareDate,
  });

  const response = await fetch(`/api/tipsen-summary?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(`Fel: ${data.error || "Okänt fel"}`);
    return;
  }

  const sortedParticipants = sortByCurrentPoints(data.participants || []);
  const participants = applyCompetitionRank(sortedParticipants, (participant) => participant.totalDelta);
  const effectiveCompareDate = String(data.compareDate || selectedCompareDate || DEFAULT_COMPARE_DATE);
  updateSectionTitles(effectiveCompareDate);
  const totalStandings = buildTotalPeriodStandings(participants, effectiveCompareDate);

  renderPeriodTwoStandings(participants);
  renderTotalStandings(totalStandings);

  const refreshedTime = new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  setStatus(`Uppdaterad ${refreshedTime}`);
}

loadSettings()
  .then(() => {
    updateSectionTitles(selectedCompareDate);
    return loadFiles();
  })
  .then(() => loadStandings())
  .catch((error) => {
    setStatus(`Fel vid initiering: ${error.message}`);
  });
