const fileSelect = document.getElementById("fileSelect");
const seasonInput = document.getElementById("seasonInput");
const compareDateInput = document.getElementById("compareDateInput");
const saveDateBtn = document.getElementById("saveDateBtn");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const reconcileBtn = document.getElementById("reconcileBtn");
const statusEl = document.getElementById("status");
const rowsEl = document.getElementById("rows");
const reconcileRowsEl = document.getElementById("reconcileRows");
const uploadInput = document.getElementById("uploadInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadBox = document.getElementById("uploadBox");
const comparePointsHeader = document.getElementById("comparePointsHeader");
const savedDateInfo = document.getElementById("savedDateInfo");
const fetchInfo = document.getElementById("fetchInfo");
const reconcileSummary = document.getElementById("reconcileSummary");

let droppedFile = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function setSavedDateInfo(dateValue) {
  if (!savedDateInfo) {
    return;
  }
  savedDateInfo.textContent = `Tallennettu oletuspäivä: ${dateValue || "-"}`;
}

function setFetchInfo(cache) {
  if (!fetchInfo) {
    return;
  }

  const fetchedAt = cache?.fetchedAt ? new Date(cache.fetchedAt) : null;
  const timeText = fetchedAt && !Number.isNaN(fetchedAt.getTime())
    ? fetchedAt.toLocaleString("fi-FI")
    : "-";
  const sourceText = cache?.hit ? "cache" : "uusi haku";
  fetchInfo.textContent = `Viimeksi haettu: ${timeText} (${sourceText})`;
}

function setReconcileSummary(text) {
  if (!reconcileSummary) {
    return;
  }
  reconcileSummary.textContent = text;
}

function flashSavedDateSuccess() {
  if (!savedDateInfo) {
    return;
  }

  savedDateInfo.classList.remove("flash-success");
  requestAnimationFrame(() => {
    savedDateInfo.classList.add("flash-success");
    setTimeout(() => {
      savedDateInfo.classList.remove("flash-success");
    }, 1400);
  });
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

function formatDelta(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "";
  }
  const numeric = Number(value);
  if (numeric > 0) {
    return `+${numeric}`;
  }
  return String(numeric);
}

function renderRows(items) {
  rowsEl.innerHTML = "";

  const sortedItems = [...items].sort((left, right) => Number(left?.rowNumber ?? 0) - Number(right?.rowNumber ?? 0));
  const goalies = sortedItems.filter((item) => item.isGoalie === true);
  const others = sortedItems.filter((item) => item.isGoalie !== true);

  function appendSectionRow(title) {
    const tr = document.createElement("tr");
    tr.classList.add("section-row");
    const td = document.createElement("td");
    td.colSpan = 14;
    td.textContent = title;
    tr.appendChild(td);
    rowsEl.appendChild(tr);
  }

  function appendDataRow(item) {
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
      item.todayPoints ?? item.points ?? "",
      item.comparePoints ?? "",
      formatDelta(item.deltaPoints),
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

  if (goalies.length) {
    appendSectionRow("Maalivahdit");
    for (const item of goalies) {
      appendDataRow(item);
    }
  }

  if (others.length) {
    appendSectionRow(goalies.length ? "Kenttäpelaajat ja muut" : "Pelaajat");
    for (const item of others) {
      appendDataRow(item);
    }
  }
}

function toCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return String(value);
}

function renderReconciliationRows(sections) {
  if (!reconcileRowsEl) {
    return;
  }

  reconcileRowsEl.innerHTML = "";
  let mismatchCount = 0;

  for (const section of sections || []) {
    const sectionName = section?.sectionType || "";
    const items = section?.items || [];
    const mismatches = items.filter((item) => !item.matches);

    for (const item of mismatches) {
      mismatchCount += 1;
      const tr = document.createElement("tr");
      tr.classList.add("error-row");

      const values = [
        sectionName,
        item.rowNumber,
        item.inputName || item.fullName || "",
        item.inputTeam || item.teamAbbrev || "",
        item.excelTotal,
        item.apiTotal,
        item.excelStart,
        item.apiStart,
        item.excelDelta,
        item.apiDelta,
      ];

      for (const value of values) {
        const td = document.createElement("td");
        td.textContent = toCellValue(value);
        tr.appendChild(td);
      }

      reconcileRowsEl.appendChild(tr);
    }
  }

  if (mismatchCount === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.textContent = "Ei mismatch-rivejä.";
    tr.appendChild(td);
    reconcileRowsEl.appendChild(tr);
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

  const preferred = "NHL tipset 2026 jan-apr period2.xlsx";
  if (data.files.includes(preferred)) {
    fileSelect.value = preferred;
    await loadStats();
  }
}

async function loadSettings() {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    return;
  }

  const data = await response.json();
  if (data?.compareDate) {
    compareDateInput.value = data.compareDate;
    comparePointsHeader.textContent = `P ${data.compareDate}`;
    setSavedDateInfo(data.compareDate);
  }
}

async function saveDefaultCompareDate() {
  const compareDate = compareDateInput.value;
  if (!compareDate) {
    setStatus("Valitse vertailupäivä ennen tallennusta.");
    return;
  }

  const response = await fetch("/api/settings/compare-date", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ compareDate }),
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(`Päivämäärän tallennus epäonnistui: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  comparePointsHeader.textContent = `P ${data.compareDate}`;
  setSavedDateInfo(data.compareDate);
  flashSavedDateSuccess();
  setStatus(`Oletusvertailupäivä tallennettu: ${data.compareDate}`);
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

async function loadStats(options = {}) {
  const { forceRefresh = false } = options;
  const file = fileSelect.value;
  const seasonId = seasonInput.value.trim();
  const compareDate = compareDateInput.value;

  if (!file) {
    setStatus("Valitse Excel-tiedosto.");
    return;
  }

  if (!compareDate) {
    setStatus("Valitse vertailupäivä.");
    return;
  }

  setStatus(
    forceRefresh
      ? "Pakotettu päivitys käynnissä (ohitetaan cache)..."
      : "Haetaan tämän päivän ja vertailupäivän pisteet NHL API:sta..."
  );
  rowsEl.innerHTML = "";
  comparePointsHeader.textContent = `P ${compareDate}`;

  const params = new URLSearchParams({ file, seasonId, compareDate });
  if (forceRefresh) {
    params.set("forceRefresh", "true");
  }
  const response = await fetch(`/api/players-stats-compare?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setStatus(`Virhe: ${data.error || "Tuntematon virhe"}`);
    return;
  }

  const items = data.items || [];
  const okCount = items.filter((item) => item.status === "ok").length;
  renderRows(items);
  setFetchInfo(data.cache);
  setStatus(
    `Valmis. Tiedosto: ${data.file}, rivit: ${data.totalRows}, ok: ${okCount}/${items.length}, vertailupäivä: ${
      data.compareDate || compareDate
    }`
  );
}

async function loadReconciliation(options = {}) {
  const { forceRefresh = false } = options;
  const file = fileSelect.value;
  const seasonId = seasonInput.value.trim();
  const compareDate = compareDateInput.value;

  if (!file) {
    setStatus("Valitse Excel-tiedosto.");
    return;
  }

  if (!compareDate) {
    setStatus("Valitse vertailupäivä.");
    return;
  }

  setReconcileSummary("Reconciliation: haetaan...");

  const params = new URLSearchParams({ file, seasonId, compareDate });
  if (forceRefresh) {
    params.set("forceRefresh", "true");
  }

  const response = await fetch(`/api/spelarna-reconciliation?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    setReconcileSummary(`Reconciliation: virhe (${data.error || "Tuntematon virhe"})`);
    return;
  }

  const sections = data.sections || [];
  renderReconciliationRows(sections);

  const totalCount = sections.reduce((sum, section) => sum + Number(section.count || 0), 0);
  const totalMatches = sections.reduce((sum, section) => sum + Number(section.matches || 0), 0);
  const totalMismatches = sections.reduce((sum, section) => sum + Number(section.mismatches || 0), 0);

  setReconcileSummary(
    `Reconciliation: ${totalMatches}/${totalCount} match (${totalMismatches} mismatch), vertailupäivä: ${compareDate}`
  );
}

loadBtn.addEventListener("click", loadStats);
refreshBtn.addEventListener("click", () => {
  loadStats({ forceRefresh: true }).catch((error) => {
    setStatus(`Pakotettu päivitys epäonnistui: ${error.message}`);
  });
});
reconcileBtn.addEventListener("click", () => {
  loadReconciliation({ forceRefresh: true }).catch((error) => {
    setReconcileSummary(`Reconciliation: virhe (${error.message})`);
  });
});
saveDateBtn.addEventListener("click", () => {
  saveDefaultCompareDate().catch((error) => {
    setStatus(`Päivämäärän tallennus epäonnistui: ${error.message}`);
  });
});
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

loadSettings()
  .then(() => loadFiles())
  .catch((error) => {
  setStatus(`Virhe tiedostolistan haussa: ${error.message}`);
  });

setReconcileSummary("Reconciliation: -");
