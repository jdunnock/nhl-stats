# NHL Stats MCP Server + Web UI

MCP server that wraps NHL public endpoints and a single-page web UI for comparing player points.

## Reusable AI workflow kit

Jos haluat käyttää samaa AI-työtapaa projektista toiseen ilman aloituskierrosta:

- Kit overview: [docs/workflow-kit/README.md](docs/workflow-kit/README.md)
- 10 min copy checklist: [docs/workflow-kit/COPY-CHECKLIST.md](docs/workflow-kit/COPY-CHECKLIST.md)
- Spec template: [docs/workflow-kit/templates/specification.template.md](docs/workflow-kit/templates/specification.template.md)
- Skills templates: [docs/workflow-kit/templates/skills](docs/workflow-kit/templates/skills)
- PR template: [docs/workflow-kit/templates/pull_request_template.md](docs/workflow-kit/templates/pull_request_template.md)
- Project AI operating model: [docs/skills/ai-coding-operating-system.md](docs/skills/ai-coding-operating-system.md)
- Pre-merge quality gate: [docs/AI-QUALITY-GATE.md](docs/AI-QUALITY-GATE.md)
- Latest quality gate report: [docs/quality-gate-report-2026-03-07.md](docs/quality-gate-report-2026-03-07.md)
- Prompt templates (copy-paste): [docs/skills/ai-prompt-templates.md](docs/skills/ai-prompt-templates.md)
- Mobile Codespaces quickstart: [docs/codespaces-mobile-quickstart.md](docs/codespaces-mobile-quickstart.md)

## Tools

- `get_standings_now`
- `get_team_stats_now`
- `get_player_landing`
- `get_player_game_log`
- `get_active_players_stats`

## Run

```bash
npm install
npm start
```

## Web UI (single page compare)

1. Lisää Excel-tiedosto kansioon `data/` (esim. `data/players.xlsx`)
2. Tuettu formaatti:
  - välilehti `Spelarna`
  - sarake A = sukunimi
  - sarake B = joukkue
3. Käynnistä web-serveri:

```bash
npm run start:web
```

4. Avaa selaimessa `http://localhost:3000`

UI listaa tiedostot projektin juuresta ja `data/`-kansiosta.
Voit myös ladata tiedoston suoraan UI:ssa (file input tai drag & drop), jolloin tiedosto tallennetaan automaattisesti `data/`-kansioon.

Yhdellä sivulla voit valita vertailupäivän (oletus `2026-01-24`) ja nähdä pelaajittain:
- tämän päivän pisteet
- valitun päivän pisteet
- erotuksen (`ΔP = todayPoints - comparePoints`)

Web UI käyttää taustalla MCP-serverin työkaluja (`get_standings_now`, `get_team_stats_now`, `get_player_landing`, `get_player_game_log`) eikä tee suoria NHL API -hakuja web-backendistä.

## Railway deployment (SQLite + persistence)

Jotta asetukset (`compareDate`) ja cache säilyvät redeployn yli, käytä Railwayssä Volumea.

1. Luo Railway-projektiin **Volume**.
2. Aseta mount path, esimerkiksi `/data`.
3. Lisää tarvittaessa env-muuttuja `APP_STORAGE_DIR=/data`.

Sovellus käyttää tallennuksiin oletuksena:
- `APP_STORAGE_DIR` (jos asetettu), muuten
- `RAILWAY_VOLUME_MOUNT_PATH` (jos Railway asettaa sen), muuten
- projektin juurihakemistoa (local dev)

Tallennettavat tiedostot:
- SQLite: `app-settings.sqlite`
- ladatut Excelit: `data/`

`railway.json` käyttää käynnistystä `npm run start:web`, joten erillistä start-komentoa ei tarvitse muuttaa.

### Railway checklist (copy-paste)

1. **Connect repo Railwayhin**
  - New Project → Deploy from GitHub repo

2. **Luo pysyvä Volume**
  - Service → Volumes → Add Volume
  - Mount path: `/data`

3. **Aseta Environment Variables**
  - `APP_STORAGE_DIR=/data`
  - (valinnainen) `NODE_ENV=production`
  - (suositus version endpointiin) `COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA`

4. **Deploy**
  - Railway deployaa automaattisesti pushista
  - Start command tulee `railway.json`-tiedostosta: `npm run start:web`

5. **Varmista toiminta deployn jälkeen**
  - Avaa app URL
  - Testaa health: `GET /api/health`
  - Tallenna vertailupäivä UI:sta (Save default date)
  - Tee uusi deploy ja varmista, että tallennettu vertailupäivä säilyy

6. **Varmista tiedostopersistenssi**
  - Lataa Excel UI:sta
  - Tee deploy uudelleen
  - Varmista, että ladattu tiedosto on edelleen valittavissa `excel files` -listassa

### Version endpoint (`/api/version`)

Sovellus näyttää deploy/version metatiedot endpointissa:

- `GET /api/version`

Kenttä `commitSha` haetaan järjestyksessä näistä lähteistä:

- `RAILWAY_GIT_COMMIT_SHA`
- `RAILWAY_GIT_COMMIT`
- `SOURCE_VERSION`
- `VERCEL_GIT_COMMIT_SHA`
- `GITHUB_SHA`
- `COMMIT_SHA`
- fallback: `git rev-parse HEAD` (jos git metadata on saatavilla runtime-ympäristössä)

Jos `commitSha` näkyy edelleen `unknown`, aseta Railwayyn eksplisiittinen env esim. `COMMIT_SHA`.

### Cache + deploy troubleshooting

Jos deployn jälkeen UI/API näyttää vanhaa dataa tai vanhaa payload-rakennetta:

1. Tarkista ajossa oleva deploy
  - `GET /api/version`
  - varmista että `railway.deploymentId` on uusi

2. Tarkista aktiivinen cache-versio lokista
  - startup-logissa näkyy: `Response cache version: ...`
  - jos versio vaihtui, app tekee startupissa automaattisen cache-flushin

3. Warmaa tarvittaessa summary-cache hallitusti
  - kutsu kerran:
    - `GET /api/tipsen-summary?forceRefresh=true&file=<excel>`
  - tämän jälkeen tavallinen `tipsen-summary` käyttää tuoretta cachea

4. Nopea tuotantotarkistus
  - `GET /api/version` (deploymentId)
  - `GET /tipsen.js` (uusi frontend-koodi)
  - `GET /api/tipsen-summary?file=<excel>` (uusi payload)

Suositus: pidä `RESPONSE_CACHE_VERSION` tyhjänä ellei tarvitse pakotettua overridea. Oletuksena sovellus käyttää deployment-kohtaista cache-tokenia ja invalidoi vanhan cachen automaattisesti.

## Daily auto refresh (09:00 FI)

Sovellus tukee automaattista päiväpäivitystä readiness-portilla.

Endpointit:
- `GET /api/data-readiness?date=YYYY-MM-DD`
- `GET/POST /api/cron/daily-refresh`

### Miten auto refresh päättää ajaako päivityksen

Ilman `force=true` endpoint ajaa force refreshin vain kun:
- Helsingin aika on vähintään `AUTO_REFRESH_MIN_HOUR_FI` (oletus `9`)
- kohdepäivä on oletuksena `eilinen` (FI), jotta käsitellään valmiit US-illan NHL-pelit
- saman päivän onnistunutta ajoa ei ole jo tehty
- `data-readiness` palauttaa `ready=true`

### Suositus Railwayyn

1. Aseta envit:
- `AUTO_REFRESH_MIN_HOUR_FI=9`
- `AUTO_REFRESH_SEASON_ID=20252026`
- `CRON_JOB_TOKEN=<vahva satunnainen arvo>`

2. Valitse ajotapa:

- Vaihtoehto A (sisäinen scheduler):
  - `AUTO_REFRESH_SCHEDULER_ENABLED=true`
  - (valinnainen) `AUTO_REFRESH_CHECK_INTERVAL_MS=900000` (15 min)

- Vaihtoehto B (ulkoinen cron kutsuu endpointia):
  - kutsu tunnin välein URL:ia
    - `GET /api/cron/daily-refresh` + header `x-cron-token: <CRON_JOB_TOKEN>`

Tunnin välein kutsuminen on suositeltu, koska se välttää kesä-/talviaikaoffsetin ylläpitotarpeen ja readiness-gate estää liian aikaisen päivityksen.

### Oletus: NHL tipset -tiedosto

- Jos projektin juuressa on tiedosto `NHL tipset 2026 jan-apr period1.xlsx`, UI käyttää sitä oletuksena.
- Välilehti: `Spelarna`
- Sarake A: sukunimi
- Sarake B: joukkue (esim. `Dallas`, `Edmonton`)

Sovellus täsmäyttää pelaajan muodolla `sukunimi + joukkue` ja hakee kauden `20252026` runkosarjadatan vertailua varten.

## Admin access protection

Voit rajata admin-näkymän vain itsellesi HTTP Basic Authilla.

Aseta env-muuttujat:

- `ADMIN_BASIC_USER=<oma_käyttäjätunnus>`
- `ADMIN_BASIC_PASS=<vahva_salasana>`

Kun molemmat on asetettu, nämä reitit vaativat kirjautumisen:

- `/admin.html`
- `/app.js` (admin-frontend)
- `POST /api/upload-excel`
- `POST /api/settings/compare-date`
- `GET /api/spelarna-reconciliation`

Jos envit puuttuvat, suojaus on pois päältä (nykyinen käytös).

### Admin cache debug (`tipsen-summary`)

Cache-diagnostiikka (`cache.hit`, `cache.compareHit`) palautetaan vain kun:
- admin-auth on validi, ja
- queryssa on `debugCache=1`

Esimerkki:

```bash
curl -u "$ADMIN_BASIC_USER:$ADMIN_BASIC_PASS" \
  "https://nhl-stats-production.up.railway.app/api/tipsen-summary?file=<excel>&debugCache=1"
```

## Quick test

```bash
npm test
```

`npm test` ajaa geneerisen tarkistuksen oletuspelaajalla (`8478402`, kausi `20252026`).

## Player test (by ID)

```bash
npm run test:player -- 8478402
```

Optional seasonId:

```bash
npm run test:player -- 8478420 20252026
```

## Example MCP config (stdio)

```json
{
  "mcpServers": {
    "nhl-stats": {
      "command": "node",
      "args": ["/absolute/path/to/nhl-stats/src/server.js"]
    }
  }
}
```
