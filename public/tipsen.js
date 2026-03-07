const statusEl = document.getElementById("status");
const summaryMetaEl = document.getElementById("summaryMeta");
const headEl = document.getElementById("head");
const bodyEl = document.getElementById("body");

const DEFAULT_SEASON_ID = "20252026";
const DEFAULT_COMPARE_DATE = "2026-01-24";

let selectedFile = "";
let selectedSeasonId = DEFAULT_SEASON_ID;
let selectedCompareDate = DEFAULT_COMPARE_DATE;

function setStatus(text) {
  statusEl.textContent = text;
}

function setSummaryMeta(text) {
  if (!summaryMetaEl) {
    return;
  }
  summaryMetaEl.textContent = text;
}

function formatPoints(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return String(Number(value));
}

function normalizeRoleText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isGoalieRole(role) {
  const normalized = normalizeRoleText(role);
  return normalized.includes("malvakt") || normalized.includes("maalivahti") || normalized === "mv";
}

function renderTable(data) {
  const participants = data.participants || [];
  const rosterRows = data.rosterRows || [];
  const participantPlayerMaps = participants.map((participant) => {
    const byRow = new Map();
    for (const player of participant.players || []) {
      byRow.set(player.rowNumber, player);
    }
    return byRow;
  });

  headEl.innerHTML = "";
  bodyEl.innerHTML = "";

  const namesRow = document.createElement("tr");
  const labelsRow = document.createElement("tr");

  for (const participant of participants) {
    const nameTh = document.createElement("th");
    nameTh.colSpan = 2;
    nameTh.textContent = participant.name;
    namesRow.appendChild(nameTh);

    const playerTh = document.createElement("th");
    playerTh.textContent = "Pelaaja";
    labelsRow.appendChild(playerTh);

    const pointsTh = document.createElement("th");
    pointsTh.textContent = "Pisteet";
    labelsRow.appendChild(pointsTh);
  }

  headEl.appendChild(namesRow);
  headEl.appendChild(labelsRow);

  const goalieRows = rosterRows.filter((row) => isGoalieRole(row.role));
  const skaterRows = rosterRows.filter((row) => !isGoalieRole(row.role));

  const bodyFragment = document.createDocumentFragment();

  function appendSectionTitleRow(title) {
    const tr = document.createElement("tr");
    tr.classList.add("total-row");
    const td = document.createElement("td");
    td.colSpan = Math.max(1, participants.length * 2);
    td.textContent = title;
    tr.appendChild(td);
    bodyFragment.appendChild(tr);
  }

  function appendRosterRow(rosterRow) {
    const tr = document.createElement("tr");

    for (let participantIndex = 0; participantIndex < participants.length; participantIndex += 1) {
      const player = participantPlayerMaps[participantIndex].get(rosterRow.rowNumber);
      const playerTd = document.createElement("td");
      playerTd.classList.add("player");
      const pointsTd = document.createElement("td");
      pointsTd.classList.add("points");

      if (!player || !player.playerLabel) {
        playerTd.classList.add("empty");
        pointsTd.classList.add("empty");
        playerTd.textContent = "-";
        pointsTd.textContent = "-";
      } else {
        playerTd.textContent = player.playerLabel;
        pointsTd.textContent = formatPoints(player.deltaPoints);

        if (player.source === "not_found") {
          playerTd.classList.add("not-found");
          pointsTd.classList.add("not-found");
        }
      }

      tr.appendChild(playerTd);
      tr.appendChild(pointsTd);
    }

    bodyFragment.appendChild(tr);
  }

  if (goalieRows.length) {
    appendSectionTitleRow("Maalivahdit");
    for (const rosterRow of goalieRows) {
      appendRosterRow(rosterRow);
    }
  }

  if (skaterRows.length) {
    appendSectionTitleRow("Kenttäpelaajat");
    for (const rosterRow of skaterRows) {
      appendRosterRow(rosterRow);
    }
  }

  const totalTr = document.createElement("tr");
  totalTr.classList.add("total-row");

  for (const participant of participants) {
    const labelTd = document.createElement("td");
    labelTd.textContent = "Yhteensä";
    totalTr.appendChild(labelTd);

    const pointsTd = document.createElement("td");
    pointsTd.classList.add("points");
    pointsTd.textContent = formatPoints(participant.totalDelta);
    totalTr.appendChild(pointsTd);
  }

  bodyFragment.appendChild(totalTr);
  bodyEl.appendChild(bodyFragment);
}

async function loadFiles() {
  const response = await fetch("/api/excel-files");
  const data = await response.json();

  if (!data.files?.length) {
    setStatus("Excel-tiedostoja ei löytynyt.");
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

async function loadTipsenSummary(options = {}) {
  const { forceRefresh = false } = options;

  const file = selectedFile;
  const seasonId = selectedSeasonId;
  const compareDate = selectedCompareDate;

  if (!file) {
    setStatus("Excel-tiedostoa ei löytynyt.");
    return;
  }

  setStatus(forceRefresh ? "Pakotettu haku käynnissä..." : "Haetaan Tipsen yhteenveto...");

  const params = new URLSearchParams({ file, seasonId, compareDate });
  if (forceRefresh) {
    params.set("forceRefresh", "true");
  }

  const response = await fetch(`/api/tipsen-summary?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(`Virhe: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  renderTable(data);

  const notFoundCount = (data.participants || []).reduce(
    (sum, participant) => sum + (participant.players || []).filter((player) => player.source === "not_found").length,
    0
  );

  setStatus(
    `Valmis. Osallistujia: ${(data.participants || []).length}, ei löytynyt: ${notFoundCount}`
  );

  setSummaryMeta(`Tiedosto: ${data.file} · Kausi: ${data.seasonId} · Vertailupäivä: ${data.compareDate}`);
}

Promise.all([loadSettings(), loadFiles()])
  .then(() => loadTipsenSummary())
  .catch((error) => {
    setStatus(`Virhe alustusvaiheessa: ${error.message}`);
    setSummaryMeta("Yhteenveto: virhe");
  });
