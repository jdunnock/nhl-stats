# NHL Stats - Tuotespesifikaatio ja AI-työworkflow (v2)

Tämä dokumentti on tämän projektin ensisijainen sovellusspesifikaatio.

## 1. Mitä tämä sovellus tekee

Sovellus vertailee NHL-pelaajien pisteitä Excel-listaan perustuen.

Päätulokset:
- Admin-sivu näyttää pelaajarivit, vertailupäivän pisteet, nykyiset pisteet ja erotuksen.
- Osallistujasivu (lagen.html) näyttää joukkueet ja pelaajakohtaiset pisteet selkeässä taulukossa.
- Data tulee NHL API:sta, pelaajat täsmäytetään Excelin perusteella.

## 2. Nykyinen arkkitehtuuri

- Backend: Node.js + Express
- Data/parsing: xlsx
- Persistenssi: SQLite (app-settings + response cache)
- UI: staattiset sivut public-kansiossa
- Deploy: Railway

Pääsijainnit:
- Backend: src/web-server.js
- Admin UI: public/index.html + public/app.js
- Lagen UI: public/lagen.html + public/tipsen.js
- Dokumentaatio: README.md ja docs/specification.md

## 3. Sovelluksen toiminnallinen scope (nykytila)

### 3.1 Admin-näkymä
- Excel-tiedoston valinta / upload
- Vertailupäivän tallennus
- Pelaajien pistevertailu
- Maalivahtien ja muiden pelaajien erottelu omiin osioihin
- Reconciliation-raportti mismatch-riveille
- Mobiilikäytössä admin-sivua ei näytetä
- Admin-reitit voidaan suojata HTTP Basic Authilla ympäristömuuttujilla (`ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS`)

### 3.2 Osallistujanäkymä (tipsen)
- Ruotsinkielinen näkymä
- Otsikko: Lagen
- Ei hakukontrolleja
- Taulukossa sarakkeet osallistujittain: Spelare + Poäng
- Osiot: Målvakter, Utespelare, Totalt
- Minimoitu metateksti (ei status/file/compareDate näkyvissä)
- Mobiilissa osallistujat näytetään erillisinä swipe-kortteina

### 3.3 Ställningen-näkymä
- Ruotsinkielinen erillissivu: `stallning.html`
- Uusi navigaatiopainike lisätään ensimmäiseksi päänavigaatioon
- Sivu näyttää osallistujat pistejärjestyksessä (suurimmasta pienimpään)
- Pisteet ovat samat kuin `lagen`-sivun `Totalt`-rivin arvot (`participant.totalDelta`)
- Ulkoasu käyttää samaa visuaalista design-linjaa kuin Figmaan päivitetty `lagen`-näkymä

### 3.4 API-endpointit
- GET /api/players-stats-compare
- GET /api/tipsen-summary
- GET /api/spelarna-reconciliation
- GET /api/data-readiness
- GET /api/settings
- POST /api/settings/compare-date
- GET /api/excel-files
- POST /api/upload-excel

### 3.5 Data readiness -portti (päivän päivitys)
- Tavoite: estää päivän datapäivitys ennen kuin kaikki päivän NHL-matsit ovat varmasti valmiit.
- Endpoint: `GET /api/data-readiness?date=YYYY-MM-DD`
- Päätössääntö `ready=true` vain kun:
  - kaikki kohdepäivän matsit ovat final-tilassa (`gameState === OFF`), ja
  - jokaisesta pelistä löytyy boxscore-pelaajastatsit (`playerByGameStats` koti + vieras).
- Endpoint palauttaa myös estolistat (`blockingGames`), jotta nähdään miksi readiness on vielä false.

### 3.6 Automaattinen päiväpäivitys (09:00 FI)
- Tavoite: ajaa päivän force refresh automaattisesti vasta kun data on valmis.
- Triggerit:
  - `GET/POST /api/cron/daily-refresh` (cron-kutsu)
  - valinnainen sisäinen scheduler (`AUTO_REFRESH_SCHEDULER_ENABLED=true`)
- Ajoehdot (ellei `force=true`):
  - Helsingin kellonaika vähintään `AUTO_REFRESH_MIN_HOUR_FI` (oletus 9)
  - samaa päivää ei ole jo onnistuneesti ajettu (`autoRefreshLastSuccessDate`)
  - `data-readiness` palauttaa `ready=true`
- Toteutus:
  - endpoint ajaa `tipsen-summary?forceRefresh=true` kaikille löydetyille Excel-tiedostoille
  - onnistuneesta ajosta talletetaan `autoRefreshLastSuccessDate` + `autoRefreshLastRunAt`
  - jos `CRON_JOB_TOKEN` on asetettu, endpoint vaatii `x-cron-token` arvon

## 4. Suorituskykylinjaukset (nykytila)

- players-stats-compare käyttää cachea dataikkunassa
- tipsen-summary käyttää omaa cachea (file+seasonId+compareDate+window)
- tipsen initial load ei pakota forceRefreshiä
- frontin renderöintiä kevennetty (Map lookup + DocumentFragment)

## 5. Oikea tapa tehdä spesifikaatio AI-avusteisessa koodauksessa

## 5.1 Mihin tiedostoon ja kansioon

Suositus tässä repossa:
- Yksi pääspesifikaatio: docs/specification.md
- Käytännön käyttöohjeet: README.md
- Jos tulee iso uusi osa-alue, lisää docs-kansioon oma tiedosto (esim. docs/performance.md)

Nyrkkisääntö:
- Product + scope + päätökset -> docs/specification.md
- Asennus, ajo, deploy -> README.md
- Lyhyt issue/PR-keskustelu -> GitHub issue/PR description

## 5.2 Formaatti

Pidä formaatti aina samana:
1) Tavoite
2) Scope (in/out)
3) Käyttäjäpolut
4) API + data
5) Ei-toiminnalliset vaatimukset (perf, luotettavuus)
6) Päätökset ja avoimet kysymykset
7) Muutosloki

Tämä tekee AI-agentin työstä vakaata: agentti näkee heti rajat eikä improvisoi väärään suuntaan.

## 5.3 Miten käyttää tätä käytännössä joka muutoksessa

Ennen toteutusta:
- Lisää specificationiin 3-8 bulletia siitä mitä aiot muuttaa.

Toteutuksen jälkeen:
- Päivitä specificationin nykytila-kohta.
- Lisää muutoslokiin päivä + mitä muuttui.

## 6. GitHub workflow muutoksille (pushien yhteydessä)

## 6.1 Branching

Pienet nopeat muutokset: voi mennä suoraan mainiin.

Isommat muutokset: käytä feature-branchia:
- feat/tipsen-performance
- fix/reconciliation-cache

## 6.2 Commit-viestit (selkeä malli)

Muoto:
- type(scope): what changed

Esimerkit:
- feat(tipsen): add endpoint cache for summary
- fix(admin): default to goalie-inclusive period2 file
- refactor(ui): optimize tipsen table rendering
- docs(spec): update workflow and current scope

## 6.3 Pushin yhteydessä kerrottava sisältö

Kun muutokset pusketaan, kerro aina:
1) Mitä muuttui
2) Missä tiedostoissa
3) Miten testattiin
4) Mahdolliset riskit / known issues

Esimerkkimalli:
- What changed: tipsen-summary cache + no force refresh on first load
- Files: src/web-server.js, public/tipsen.js
- Validation: forced call ~16.7s, cached call ~0.18s (production)
- Risk: first forced warmup remains slow due to upstream API calls

## 6.4 PR-kuvausmalli

Kun käytät PR:ää, käytä tätä:

- Summary
- Scope (in/out)
- Screenshots (jos UI)
- Test steps
- Rollback plan

## 7. Muutosloki

- 2026-03-07
  - Tipsen UI uudistettu ja lokalisoitu ruotsiksi
  - Admin-sivulla maalivahdit ja muut pelaajat eroteltu selkeämmin
  - Reconciliation endpoint lisätty
  - Tipsen-summary cache + render-optimoinnit lisätty
  - Deploy + Git tag + Release tehty
  - Lagen-mobiilinäkymään lisätty osallistujakohtaiset swipe-kortit
  - Admin-sivu piilotettu mobiilikäytössä
  - Backendin datapolku kovennettu tuotantokuormaan:
    - MCP-throttle + 429-aware retry/backoff
    - fallback MCP -> direct NHL API transient-virheissä
    - tipsen-mätsäys korjattu niin, ettei lagen-sivulle jää '-' rivejä
    - cache-key versioitu (`RESPONSE_CACHE_VERSION`) vanhan cachen invalidoimiseksi
  - Lisätty `/api/version` endpoint tuotantoversion varmistamiseen
  - Lisätty `data readiness` -toiminto (`/api/data-readiness`) päivän automaattisen päivityksen varmistamiseen
  - Lisätty automaattinen päiväpäivitys (`/api/cron/daily-refresh`) readiness-gatella ja 09:00 FI -ajoehdoilla
  - Lisätty uusi `Ställningen`-sivu (`stallning.html`), joka näyttää osallistujat `Totalt`-pisteiden mukaiseen järjestykseen lajiteltuna
  - Lisätty `Ställningen`-painike päänavigaation ensimmäiseksi
  - Poistettu `+`-etuliite positiivisista pisteistä `Lagen`- ja `Ställningen`-näkymissä
  - Lisätty valinnainen admin-suojaus (HTTP Basic Auth) reiteille `admin.html`, `app.js` ja admin-muokkaus/API-toiminnoille

## 7.1 Prosessi-backfill (workflow compliance) 2026-03-07

Tällä merkinnällä paikattiin chat-kierroksen prosessipoikkeama, jossa implementointi tehtiin ennen dokumentaatiota.

Backfillin sisältö:
- Spec päivitetty jälkikäteen vastaamaan toteutettua tuotantomuutosta
- AI Quality Gate käyty läpi ja kirjattu erilliseksi raportiksi
- Dokumentaatiocommit tehty vaaditulla muodolla `type(scope): ...`

Päätös jatkoon:
- Seuraavissa muutoksissa noudatetaan järjestystä "spec update first" ennen koodimuutoksia
- Ennen push/deploy-vaihetta kirjataan aina lyhyt Quality Gate -yhteenveto

## 8. Seuraavat suositellut askeleet

1) Lisää lyhyt deployment checklist README:iin yhdellä komennolla ajettavaksi.
2) Lisää kevyt health endpoint vain deploy-monitorointiin.
3) Lisää yksi benchmark-komento package.json scripts-kohtaan (tipsen warm/cached).

## 9. Skills (erilliset tiedostot)

Projektin workflow-skillit pidetään erillisinä dokumentteina kansiossa `docs/skills`.

Nykyiset skillit:
- [Chat-driven change workflow](docs/skills/chat-change-workflow.md)
- [AI coding operating system](docs/skills/ai-coding-operating-system.md)
- [AI Quality Gate](docs/AI-QUALITY-GATE.md)
- [AI prompt templates](docs/skills/ai-prompt-templates.md)

Periaate:
- [docs/specification.md](docs/specification.md) määrittää tuotteen suunnan ja päätökset.
- Skill-tiedostot määrittävät operatiivisen toteutusprosessin.

## 10. Reusable workflow kit uusiin projekteihin

Jotta sama AI-työtapa on helposti monistettavissa projektista toiseen, tässä repossa on valmis kit:

- [docs/workflow-kit/README.md](docs/workflow-kit/README.md)
- [docs/workflow-kit/COPY-CHECKLIST.md](docs/workflow-kit/COPY-CHECKLIST.md)
- [docs/workflow-kit/templates/specification.template.md](docs/workflow-kit/templates/specification.template.md)
- [docs/workflow-kit/templates/skills/chat-change-workflow.template.md](docs/workflow-kit/templates/skills/chat-change-workflow.template.md)
- [docs/workflow-kit/templates/skills/bugfix-workflow.template.md](docs/workflow-kit/templates/skills/bugfix-workflow.template.md)
- [docs/workflow-kit/templates/skills/release-workflow.template.md](docs/workflow-kit/templates/skills/release-workflow.template.md)
- [docs/workflow-kit/templates/skills/ai-coding-operating-system.template.md](docs/workflow-kit/templates/skills/ai-coding-operating-system.template.md)
- [docs/workflow-kit/templates/skills/ai-prompt-templates.template.md](docs/workflow-kit/templates/skills/ai-prompt-templates.template.md)
- [docs/workflow-kit/templates/pull_request_template.md](docs/workflow-kit/templates/pull_request_template.md)

Käyttöperiaate:
- Kopioi templates uuteen projektiin.
- Nimeä ne kohdepolkuihin (`docs/specification.md`, `docs/skills/*.md`, `.github/pull_request_template.md`).
- Täytä vain projektikohtaiset kohdat ja jatka samalla workflowlla.
