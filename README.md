# NHL Stats MCP Server

MCP server that wraps NHL public endpoints and exposes tools for current-season player stats.

## Tools

- `get_standings_now`
- `get_team_stats_now`
- `get_player_landing`
- `get_active_players_stats`

## Run

```bash
npm install
npm start
```

## Web UI (Excel -> player stats)

1. Lisää Excel-tiedosto kansioon `data/` (esim. `data/players.xlsx`)
2. Excelissä pitää olla vähintään yksi ID-sarake: `playerId` (tai `nhlPlayerId` tai `id`)
3. Käynnistä web-serveri:

```bash
npm run start:web
```

4. Avaa selaimessa `http://localhost:3000`

UI listaa tiedostot `data/`-kansiosta ja hakee pelaajien kausitilastot NHL API:sta.
Voit myös ladata tiedoston suoraan UI:ssa (file input tai drag & drop), jolloin tiedosto tallennetaan automaattisesti `data/`-kansioon.

Web UI käyttää nyt taustalla MCP-serverin työkaluja (`get_standings_now`, `get_team_stats_now`, `get_player_landing`) eikä tee suoria NHL API -hakuja web-backendistä.

### Oletus: NHL tipset -tiedosto

- Jos projektin juuressa on tiedosto `NHL tipset 2026 jan-apr period1.xlsx`, UI käyttää sitä oletuksena.
- Välilehti: `Spelarna`
- Sarake A: sukunimi
- Sarake B: joukkue (esim. `Dallas`, `Edmonton`)

Sovellus täsmäyttää pelaajan muodolla `sukunimi + joukkue` ja hakee kauden `20252026` NHL runkosarjastatsit.

## Quick test

```bash
npm test
```

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
