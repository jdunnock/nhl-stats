const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const totalListEl = document.getElementById("totalList");

const DEFAULT_SEASON_ID = "20252026";
const DEFAULT_COMPARE_DATE = "2026-01-24";
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

  participants.forEach((participant, index) => {
    const row = document.createElement("div");
    row.className = "row";

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = String(index + 1);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = participant.name || "-";

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

  const header = document.createElement("div");
  header.className = "row total header";
  header.innerHTML = "<div>Plac</div><div>Deltagare</div><div>P1</div><div>P2</div><div>Totalt</div>";
  totalListEl.appendChild(header);

  participants.forEach((participant, index) => {
    const row = document.createElement("div");
    row.className = "row total";

    const rank = document.createElement("div");
    rank.className = "rank";
    rank.textContent = String(index + 1);

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

    const total = document.createElement("div");
    total.className = "points";
    total.textContent = formatPoints(participant.totalPeriodPoints);
    applyPointsClass(total, participant.totalPeriodPoints);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(periodOne);
    row.appendChild(periodTwo);
    row.appendChild(total);

    totalListEl.appendChild(row);
  });
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

function getScalePointsByPosition(positionIndex) {
  return PERIOD_TWO_POINTS_SCALE[positionIndex] ?? 0;
}

function buildPeriodTwoPointsByName(sortedParticipants) {
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

function buildTotalPeriodStandings(sortedParticipants) {
  const periodTwoPointsByName = buildPeriodTwoPointsByName(sortedParticipants);

  return sortedParticipants
    .map((participant) => {
      const key = normalizeParticipantName(participant.name);
      const periodOnePoints = PERIOD_ONE_POINTS.get(key) ?? 0;
      const periodTwoPoints = periodTwoPointsByName.get(key) ?? 0;

      return {
        name: participant.name,
        periodOnePoints,
        periodTwoPoints,
        totalPeriodPoints: periodOnePoints + periodTwoPoints,
      };
    })
    .sort((left, right) => {
      const diff = right.totalPeriodPoints - left.totalPeriodPoints;
      if (diff !== 0) {
        return diff;
      }

      return String(left.name || "").localeCompare(String(right.name || ""), "sv");
    });
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

  const participants = sortByCurrentPoints(data.participants || []);
  const totalStandings = buildTotalPeriodStandings(participants);

  renderPeriodTwoStandings(participants);
  renderTotalStandings(totalStandings);

  const refreshedTime = new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  setStatus(`Uppdaterad ${refreshedTime}`);
}

Promise.all([loadSettings(), loadFiles()])
  .then(() => loadStandings())
  .catch((error) => {
    setStatus(`Fel vid initiering: ${error.message}`);
  });
