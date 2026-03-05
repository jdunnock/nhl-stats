const fileSelect = document.getElementById("fileSelect");
const seasonInput = document.getElementById("seasonInput");
const loadBtn = document.getElementById("loadBtn");
const statusEl = document.getElementById("status");
const rowsEl = document.getElementById("rows");
const uploadInput = document.getElementById("uploadInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadBox = document.getElementById("uploadBox");

let droppedFile = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function formatMatchStrategy(strategy) {
  if (strategy === "team_exact") {
    return "team_exact";
  }
  if (strategy === "team_fallback") {
    return "team_fallback";
  }
  if (strategy === "team_fuzzy_fallback") {
    return "team_fuzzy_fallback";
  }
  if (strategy === "id_direct") {
    return "id_direct";
  }
  return strategy || "";
}

function renderRows(items) {
  rowsEl.innerHTML = "";

  for (const item of items) {
    const tr = document.createElement("tr");
    if (item.status !== "ok") {
      tr.classList.add("error-row");
    } else if (item.matchStrategy === "team_exact" || item.matchStrategy === "id_direct") {
      tr.classList.add("match-exact-row");
    } else if (item.matchStrategy === "team_fallback") {
      tr.classList.add("match-fallback-row");
    } else if (item.matchStrategy === "team_fuzzy_fallback") {
      tr.classList.add("match-fuzzy-row");
    }

    const values = [
      item.rowNumber ?? "",
      item.fullName || item.inputName || "",
      item.inputTeam || "",
      item.teamAbbrev || "",
      item.isActive === undefined ? "" : item.isActive ? "yes" : "no",
      item.gamesPlayed ?? "",
      item.goals ?? "",
      item.assists ?? "",
      item.points ?? "",
      formatMatchStrategy(item.matchStrategy),
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
    setStatus("Lisää .xlsx/.xls tiedosto kansioon data/, ja päivitä sivu.");
    loadBtn.disabled = true;
    return;
  }

  loadBtn.disabled = false;
  setStatus(`Valmis. Löytyi ${data.files.length} Excel-tiedosto(a).`);

  const preferred = "NHL tipset 2026 jan-apr period1.xlsx";
  if (data.files.includes(preferred)) {
    fileSelect.value = preferred;
    await loadStats();
  }
}

async function uploadSelectedFile() {
  const file = droppedFile || uploadInput.files?.[0];
  if (!file) {
    setStatus("Valitse ensin Excel-tiedosto uploadia varten.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  setStatus(`Ladataan tiedosto: ${file.name}...`);

  const response = await fetch("/api/upload-excel", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(`Upload virhe: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  await loadFiles();

  const uploaded = data.uploaded;
  if (uploaded) {
    fileSelect.value = uploaded;
  }

  uploadInput.value = "";
  droppedFile = null;
  setStatus(`Tiedosto ladattu: ${uploaded}`);
}

async function loadStats() {
  const file = fileSelect.value;
  const seasonId = seasonInput.value.trim();

  if (!file) {
    setStatus("Valitse Excel-tiedosto.");
    return;
  }

  setStatus("Haetaan pelaajatilastoja NHL API:sta...");
  rowsEl.innerHTML = "";

  const params = new URLSearchParams({ file, seasonId });
  const response = await fetch(`/api/players-stats?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(`Virhe: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  renderRows(data.items || []);
  setStatus(`Valmis. Tiedosto: ${data.file}, rivit: ${data.totalRows}`);
}

loadBtn.addEventListener("click", loadStats);
uploadBtn.addEventListener("click", () => {
  uploadSelectedFile().catch((error) => {
    setStatus(`Upload virhe: ${error.message}`);
  });
});

uploadBox.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadBox.classList.add("dragover");
});

uploadBox.addEventListener("dragleave", () => {
  uploadBox.classList.remove("dragover");
});

uploadBox.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadBox.classList.remove("dragover");

  const [file] = event.dataTransfer?.files || [];
  if (!file) {
    return;
  }

  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    setStatus("Vain .xlsx tai .xls tiedostot sallitaan.");
    return;
  }

  droppedFile = file;
  setStatus(`Valittu drag & drop -tiedosto: ${file.name}. Paina 'Lataa tiedosto'.`);
});

loadFiles().catch((error) => {
  setStatus(`Virhe tiedostolistan haussa: ${error.message}`);
});
