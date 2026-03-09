# Nyheter – weekly content template (sv)

Tämä pohja on viikoittaista `Nyheter`-julkaisua varten.

## MVP-kenttälista (v1)

Jos halutaan mahdollisimman kevyt ensimmäinen automaattiversio, nämä kentät riittävät:

1. `weekStart`
2. `weekEnd`
3. `leaderName`
4. `leaderDeltaWeek`
5. `mostImprovedParticipant.name`
6. `mostImprovedParticipant.deltaWeek`
7. `mostDeclinedParticipant.name`
8. `mostDeclinedParticipant.deltaWeek`
9. `topRiser.playerName`
10. `topRiser.deltaWeek`
11. `topFaller.playerName`
12. `topFaller.deltaWeek`

### MVP-julkaisun sisältö näillä kentillä

- `Veckans läge` (leader + viikon suurin nousija/laskija)
- `Raketer & ras` (1 kuumin nousija + 1 suurin laskija)
- Lyhyt `Inför nästa vecka` -nosto (template-teksti)

Tällä päästään nopeasti liveen ilman uutisfeediä tai laajaa loukkaantumisdatan käsittelyä.

## Publiceringsram

- Språk: svenska
- Frekvens: 1 gång per vecka (rekommendation: måndag morgon)
- Perspektiv: deltagarställning + spelarpåverkan + nyhetskontext
- Ton: tydlig, kort och engagerande (fakta först, rubrikdrag sen)

### Toimituslinja (pakollinen)

- Viikkoteksti kirjoitetaan joka viikko alusta uudestaan.
- Edellisen viikon tekstiä ei käytetä pohjana pienillä muokkauksilla.
- Tämän viikon ydinjuoni päätetään ensin (2–3 pääpointtia), sitten teksti kirjoitetaan niiden ympärille.
- Julkaisua ei tehdä, jos teksti kuulostaa kierrätetyltä tai vain päivämäärät/luvut vaihdetuilta.

Julkaisupäätöksen checklist:
- [docs/nyheter-go-no-go-checklist.md](docs/nyheter-go-no-go-checklist.md)

## Datakentät (täyttö backendistä)

- `weekStart` (YYYY-MM-DD)
- `weekEnd` (YYYY-MM-DD)
- `leaderName`
- `leaderDeltaWeek`
- `mostImprovedParticipant.name`
- `mostImprovedParticipant.deltaWeek`
- `mostDeclinedParticipant.name`
- `mostDeclinedParticipant.deltaWeek`
- `topRisers[]` (playerName, team, deltaWeek, participantName)
- `topFallers[]` (playerName, team, deltaWeek, participantName)
- `participantImpacts[]` (participantName, deltaWeek, topContributor, topContributorDelta, biggestDrag, biggestDragDelta)
- `injuryUpdates[]` (playerName, status, timeline, participantName)
- `newsItems[]` (title, source, publishedAt, relatedPlayer)
- `watchlist[]` (playerName, reason)

## Julkaisupohja (copy/paste)

### Veckans läge

**Period:** {weekStart} – {weekEnd}

{leaderName} leder veckan med **{leaderDeltaWeek}** i veckoutveckling.
Största klättringen stod **{mostImprovedParticipant.name}** för (**{mostImprovedParticipant.deltaWeek}**),
medan **{mostDeclinedParticipant.name}** tappade mest (**{mostDeclinedParticipant.deltaWeek}**).

### Raketer & långsammaste klättrare

**Raketer (spelare):**
1. {topRisers[0].playerName} ({topRisers[0].team}) · {topRisers[0].deltaWeek} · {topRisers[0].participantName}
2. {topRisers[1].playerName} ({topRisers[1].team}) · {topRisers[1].deltaWeek} · {topRisers[1].participantName}
3. {topRisers[2].playerName} ({topRisers[2].team}) · {topRisers[2].deltaWeek} · {topRisers[2].participantName}

**Långsammaste klättrare (spelare):**
1. {topFallers[0].playerName} ({topFallers[0].team}) · {topFallers[0].deltaWeek} · {topFallers[0].participantName}
2. {topFallers[1].playerName} ({topFallers[1].team}) · {topFallers[1].deltaWeek} · {topFallers[1].participantName}
3. {topFallers[2].playerName} ({topFallers[2].team}) · {topFallers[2].deltaWeek} · {topFallers[2].participantName}

### Påverkan per deltagare

- **{participantImpacts[0].participantName}**: {participantImpacts[0].deltaWeek}
  - Draglok: {participantImpacts[0].topContributor} ({participantImpacts[0].topContributorDelta})
  - Bromskloss: {participantImpacts[0].biggestDrag} ({participantImpacts[0].biggestDragDelta})

- **{participantImpacts[1].participantName}**: {participantImpacts[1].deltaWeek}
  - Draglok: {participantImpacts[1].topContributor} ({participantImpacts[1].topContributorDelta})
  - Bromskloss: {participantImpacts[1].biggestDrag} ({participantImpacts[1].biggestDragDelta})

(upprepa för alla deltagare)

### Skadeläget

- {injuryUpdates[0].playerName} ({injuryUpdates[0].participantName}) – {injuryUpdates[0].status}: {injuryUpdates[0].timeline}
- {injuryUpdates[1].playerName} ({injuryUpdates[1].participantName}) – {injuryUpdates[1].status}: {injuryUpdates[1].timeline}
- {injuryUpdates[2].playerName} ({injuryUpdates[2].participantName}) – {injuryUpdates[2].status}: {injuryUpdates[2].timeline}

### Spelarnyheter

1. {newsItems[0].title} ({newsItems[0].source}) – {newsItems[0].relatedPlayer}
2. {newsItems[1].title} ({newsItems[1].source}) – {newsItems[1].relatedPlayer}
3. {newsItems[2].title} ({newsItems[2].source}) – {newsItems[2].relatedPlayer}
4. {newsItems[3].title} ({newsItems[3].source}) – {newsItems[3].relatedPlayer}
5. {newsItems[4].title} ({newsItems[4].source}) – {newsItems[4].relatedPlayer}

### Inför nästa vecka

**Tre att hålla ögonen på:**
- {watchlist[0].playerName} – {watchlist[0].reason} ({watchlist[0].gamesUntilNextUpdate} matcher till nästa nyhetsbrev)
- {watchlist[1].playerName} – {watchlist[1].reason} ({watchlist[1].gamesUntilNextUpdate} matcher till nästa nyhetsbrev)
- {watchlist[2].playerName} – {watchlist[2].reason} ({watchlist[2].gamesUntilNextUpdate} matcher till nästa nyhetsbrev)

**1-rivin pre-publish:** Nyskriven text • 3 kärnpoänger • matchmängd med i "Inför nästa vecka" • fakta ok • ton ok.

### Editorial checklist (måste vara grön varje vecka)

- [ ] Nytt huvudnarrativ: texten är nyskriven för veckan, inte en lätt redigering av förra versionen.
- [ ] Tre kärnpoänger: topp, bottenstrid och en spelarnyhet med tydlig påverkan.
- [ ] Matchmängd-check: varje spelare i "Inför nästa vecka" har antal matcher till nästa nyhetsbrev.
- [ ] Relevans-check: minst en spelare med ovanligt många eller ovanligt få matcher lyfts explicit.
- [ ] Ton-check: engagerande men tydlig, fakta först och humor som förstärker budskapet.

### 3 min pre-publish (intern)

**Minut 1 – Kärnlinje**
- Varmista että viikon teksti on nyskriven, ei edellisen viikon kevyt muokkaus.
- Lue ingressi ääneen: pitääkö se paikkansa myös ilman taustatietoa?

**Minut 2 – Faktat**
- Tarkista nimet, joukkueet ja deltamuutokset top- ja botten-nostoissa.
- Tarkista että "Inför nästa vecka" sisältää ottelumäärät seuraavaan uutiseen asti jokaiselle nostolle.

**Minut 3 – Julkaisukunto**
- Poista mahdollinen sisäinen sanasto/luonnosmuotoilu (esim. TODO-tekstit).
- Varmista että sävy on selkeä: fakta ensin, sitten viihdyttävä koukku.
- Hyväksy julkaisu vasta kun kaikki Editorial checklist -kohdat ovat vihreänä.

---

## Mini-esimerkki (lyhyt)

**Veckans läge**
Mattias håller förstaplatsen, men Joakim tog veckans största kliv tack vare en stark toppkedja.
Fredrik tappade mark efter två nyckelspelare med låg produktion.

**Inför nästa vecka**
Håll extra koll på statusuppdateringar kring skadade forwards – där kan tabellen svänga snabbt.
