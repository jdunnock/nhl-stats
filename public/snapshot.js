const fileSelect = document.getElementById("fileSelect");
const dateInput = document.getElementById("dateInput");
const seasonInput = document.getElementById("seasonInput");
const loadBtn = document.getElementById("loadBtn");
const statusEl = document.getElementById("status");
const rowsEl = document.getElementById("rows");

function setStatus(text) {
  statusEl.textContent = text;
}

function renderRows(items) {
  rowsEl.innerHTML = "";

  for (const item of items) {
    const tr = document.createElement("tr");
    if (item.status !== "ok") {
      tr.classList.add("error-row");
    }

    const values = [
      item.rowNumber ?? "",
      item.fullName || item.inputName || "",
      item.inputTeam || "",
      item.teamAbbrev || "",
      item.gamesPlayedAtDate ?? "",
      item.goalsAtDate ?? "",
      item.assistsAtDate ?? "",
      item.pointsAtDate ?? "",
      item.status || "",
      item.error || "",
    ];

    for (const value of values) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.appendChild(td);
    }

    rowsEl.appendChild(tr);
  }
}

async function loadFiles() {
  setStatus("Haetaan Excel-tiedostoja...");
  const response = await fetch("/api/excel-files");
  const data = await response.json();

  fileSelect.innerHTML = "";

  for (const file of data.files || []) {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = file;
    fileSelect.appendChild(option);
  }

  if (!data.files || data.files.length === 0) {
    setStatus("Excel-tiedostoja ei löytynyt.");
    loadBtn.disabled = true;
    return;
  }

  const preferred = "NHL tipset 2026 jan-apr period1.xlsx";
  if (data.files.includes(preferred)) {
    fileSelect.value = preferred;
  }

  loadBtn.disabled = false;
  setStatus("Valmis. Valitse päivämäärä ja hae snapshot.");
}

async function loadSnapshot() {
  const file = fileSelect.value;
  const date = dateInput.value;
  const seasonId = seasonInput.value.trim();

  if (!file) {
    setStatus("Valitse Excel-tiedosto.");
    return;
  }
  if (!date) {
    setStatus("Valitse päivämäärä.");
    return;
  }

  setStatus("Haetaan snapshot-dataa...");
  rowsEl.innerHTML = "";

  const params = new URLSearchParams({ file, date, seasonId });
  const response = await fetch(`/api/players-stats-on-date?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(`Virhe: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  renderRows(data.items || []);
  setStatus(`Valmis. Päivä: ${data.snapshotDate}, rivit: ${data.totalRows}`);
}

loadBtn.addEventListener("click", () => {
  loadSnapshot().catch((error) => {
    setStatus(`Virhe snapshot-haussa: ${error.message}`);
  });
});

loadFiles().catch((error) => {
  setStatus(`Virhe tiedostolistan haussa: ${error.message}`);
});
