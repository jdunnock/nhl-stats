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
- Prompt templates (copy-paste): [docs/skills/ai-prompt-templates.md](docs/skills/ai-prompt-templates.md)

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

### Oletus: NHL tipset -tiedosto

- Jos projektin juuressa on tiedosto `NHL tipset 2026 jan-apr period1.xlsx`, UI käyttää sitä oletuksena.
- Välilehti: `Spelarna`
- Sarake A: sukunimi
- Sarake B: joukkue (esim. `Dallas`, `Edmonton`)

Sovellus täsmäyttää pelaajan muodolla `sukunimi + joukkue` ja hakee kauden `20252026` runkosarjadatan vertailua varten.

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
