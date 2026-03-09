const nyheterData = {
  weekStart: "2026-03-02",
  weekEnd: "2026-03-08",
  leaderName: "Mattias",
  leaderDeltaWeek: "+17",
  spotlights: {
    leader: {
      value: "Mattias",
      sub: "Behåller förstaplatsen med +17 denna vecka",
    },
    hot: {
      value: "Pastrnak",
      sub: "+8 poängimpact och fortsatt glödhet",
    },
    bottom: {
      value: "3 lag / 2 poäng",
      sub: "Bottenstriden avgörs på små marginaler",
    },
  },
  leadSummary:
    "Mattias behåller tätpositionen, men Joakim jagar hårt efter en vecka där toppkedjan levererade på alla nivåer och varje kväll bjöd på nya svängningar i tabellen. Raketerna fortsätter att vinna rätt matcher i rätt lägen, medan vissa favoriter tappade fart när pressen ökade. Längre ner i tabellen känns varje byte som en mini-final: en stolpträff åt fel håll, en sen utvisning, och hela berättelsen kan ändras innan helgen är över.",
  risers: [
    { playerName: "Pastrnak (BOS)", deltaWeek: "+8", participant: "Joakim" },
    { playerName: "Scheifele (WPG)", deltaWeek: "+7", participant: "Mattias" },
    { playerName: "Nylander (TOR)", deltaWeek: "+6", participant: "Fredrik" },
  ],
  fallers: [
    { playerName: "Carlson (ANA)", deltaWeek: "+0", participant: "Jarmo" },
    { playerName: "Tkachuk (FLA)", deltaWeek: "+1", participant: "Timmy" },
    { playerName: "Benn (DAL)", deltaWeek: "+1", participant: "Henrik" },
  ],
  participantImpacts: [
    {
      participantName: "Mattias",
      deltaWeek: "+17",
      topContributor: "Scheifele",
      topContributorDelta: "+7",
      biggestDrag: "Carlson",
      biggestDragDelta: "-3",
    },
    {
      participantName: "Joakim",
      deltaWeek: "+14",
      topContributor: "Pastrnak",
      topContributorDelta: "+8",
      biggestDrag: "Benn",
      biggestDragDelta: "-2",
    },
    {
      participantName: "Fredrik",
      deltaWeek: "+9",
      topContributor: "Nylander",
      topContributorDelta: "+6",
      biggestDrag: "Tkachuk",
      biggestDragDelta: "-2",
    },
  ],
  injuryUpdates: [
    { label: "Tkachuk (FLA)", detail: "Questionable: Day-to-day" },
    { label: "Benn (DAL)", detail: "Out: Week-to-week" },
    { label: "Carlson (ANA)", detail: "Questionable: At least 2026-03-12" },
  ],
  bottomBattleLead:
    "Nere i tabellen är det så tajt att ett övertidsmål kan kännas som jackpot och ett tekningsmisstag som ren hjärtesorg. Veckans mest nerviga trio:",
  bottomBattle: [
    {
      label: "Jarmo",
      detail: "Jag behöver poäng nu, annars blir april en väldigt lång månad.",
    },
    {
      label: "Timmy",
      detail: "Lever på små marginaler och hoppas att nästa match blir den stora vändningen.",
    },
    {
      label: "Henrik",
      detail: "Stabil grund finns, men bottenstriden förlåter inga kalla kvällar.",
    },
  ],
  watchlist: [
    {
      label: "Pastrnak",
      detail: "Het trend, 3 matcher kvar mot bottenlag",
      gamesUntilNextUpdate: 5,
    },
    {
      label: "Scheifele",
      detail: "Stabil toppform och hög usage i PP",
      gamesUntilNextUpdate: 2,
    },
    {
      label: "Tkachuk",
      detail: "Skadestatus kan svänga tabellen snabbt",
      gamesUntilNextUpdate: 1,
    },
  ],
  funNote:
    "Redaktionens lilla spaning: i bottenstriden räknas inte bara mål och assist, utan även vem som lyckas se lugn ut när tabellen blinkar rött. Hockeyns pokerface lever vidare.",
};

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
    topTd.textContent = `${impact.topContributor} (${impact.topContributorDelta})`;

    const dragTd = document.createElement("td");
    dragTd.textContent = `${impact.biggestDrag} (${impact.biggestDragDelta})`;

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

function renderBottomBattle() {
  const lead = document.getElementById("bottomBattleLead");
  if (lead) {
    lead.textContent = nyheterData.bottomBattleLead;
  }

  renderTagList("bottomBattle", nyheterData.bottomBattle, "fun");
}

function getGamesProfile(gamesUntilNextUpdate) {
  if (gamesUntilNextUpdate >= 5) {
    return "Många matcher";
  }

  if (gamesUntilNextUpdate <= 2) {
    return "Få matcher";
  }

  return "Normal vecka";
}

function renderWatchlist() {
  const list = document.getElementById("watchlist");
  if (!list) {
    return;
  }

  list.innerHTML = "";
  for (let index = 0; index < nyheterData.watchlist.length; index += 1) {
    const item = nyheterData.watchlist[index];
    const li = document.createElement("li");
    li.className = "rank-item";

    const nr = document.createElement("span");
    nr.className = "nr";
    nr.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = `${item.label} · ${item.detail}`;

    const tag = document.createElement("span");
    tag.className = "tag watch";
    const gamesCount = Number(item.gamesUntilNextUpdate) || 0;
    const profile = getGamesProfile(gamesCount);
    tag.textContent = `${gamesCount} matcher (${profile})`;

    li.appendChild(nr);
    li.appendChild(label);
    li.appendChild(tag);
    list.appendChild(li);
  }
}

function renderFunNote() {
  const note = document.getElementById("funNote");
  if (note) {
    note.textContent = nyheterData.funNote;
  }
}

renderHero();
renderRankList("risers", nyheterData.risers);
renderRankList("fallers", nyheterData.fallers);
renderImpacts();
renderTagList("injuries", nyheterData.injuryUpdates, "alert");
renderBottomBattle();
renderWatchlist();
renderFunNote();
