const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");

const DEFAULT_SEASON_ID = "20252026";
const DEFAULT_COMPARE_DATE = "2026-01-24";

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
  if (numericValue > 0) {
    return `+${numericValue}`;
  }
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

function renderStandings(participants) {
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

function toSortablePoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return Number.NEGATIVE_INFINITY;
  }
  return Number(value);
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

  const participants = [...(data.participants || [])].sort((left, right) => {
    const pointsDiff = toSortablePoints(right.totalDelta) - toSortablePoints(left.totalDelta);
    if (pointsDiff !== 0) {
      return pointsDiff;
    }
    return String(left.name || "").localeCompare(String(right.name || ""), "sv");
  });

  renderStandings(participants);

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
