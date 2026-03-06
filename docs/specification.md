# NHL Player Tracker - Spesifikaatio (v1)

## 1. Tavoite
Sovelluksen tarkoitus on seurata ennalta määritettyjen NHL-pelaajien pistekertymää kierroskohtaisesti.

- Käyttäjä tuo Excel-tiedoston, jossa on seurattavat pelaajat.
- Sovellus hakee pelaajien tiedot ja tilastot ulkoisesta API:sta.
- Sovellus tallentaa lähtötilanteen (baseline) import-hetkellä.
- Sovellus päivittää pelaajien tilanteen automaattisesti kerran päivässä.
- Käyttöliittymä näyttää:
  - lähtöpisteet (import-hetken points)
  - nykyiset pisteet
  - kierroksen aikana kertyneet pisteet (nykyiset - lähtöpisteet)

---

## 2. Vaiheistus

## Vaihe 1: Excel-import ja lähtötilanne

### 2.1 Käyttäjätoiminto
Käyttäjä lataa Excel-tiedoston, jossa on seurattavien pelaajien nimet.

### 2.2 Pelaajien tunnistus
Sovellus tunnistaa pelaajat Excelin datasta (esim. sukunimi + joukkue tai pelaaja-ID) ja hakee API:sta:

- pelaajan yksilöivä ID
- nimi
- joukkue
- nykyinen points-tilanne
- muut mahdolliset tarvittavat statit

### 2.3 Lähtötilanteen tallennus
Import-hetkellä tallennetaan tietokantaan kierroksen baseline:

- `round_started_at` = importin aikaleima
- `baseline_points` = pelaajan points import-hetkellä
- `player_id`, `player_name`, `team`
- `import_batch_id` (suositus: yksilöi yhden importin)

Lähtötilanne on aina se päivä/aika, jolloin Excel on ladattu.

---

## Vaihe 2: Päivittäinen automaattinen päivitys

### 3.1 Ajoitus
Järjestelmä hakee päivityksen joka päivä klo **10:00 Suomen aikaa**.

- Aikavyöhyke: `Europe/Helsinki`
- Ajastus toimii sekä kesä- että talviajassa oikein.

### 3.2 Päivityslogiikka
Ajastettu ajo käy läpi kaikki aktiiviset kierrokseen kuuluvat pelaajat ja hakee API:sta uusimman tilanteen.

Tallennetaan:

- `current_points`
- `last_synced_at`
- mahdolliset virhetilat (esim. API-virhe)

Lasketaan näkymää varten:

- `round_points = current_points - baseline_points`

### 3.3 UI-näkymä
Pelaajakohtaisesti näytetään vähintään:

- Pelaaja
- Joukkue
- Lähtöpisteet (baseline)
- Nykyiset pisteet
- Kierroksen pisteet (`+/-`)
- Viimeisin päivitysaika

---

## 4. Tietomalli (ehdotus)

## 4.1 Taulu: `rounds`
- `id`
- `name` (esim. "Kierros 1")
- `started_at`
- `status` (`active`, `closed`)
- `created_at`, `updated_at`

## 4.2 Taulu: `tracked_players`
- `id`
- `round_id` (FK -> rounds)
- `player_id` (ulkoinen NHL ID)
- `player_name`
- `team_abbrev`
- `baseline_points`
- `current_points`
- `round_points` (voidaan laskea tai tallentaa)
- `import_batch_id`
- `last_synced_at`
- `sync_status` (`ok`, `error`)
- `sync_error_message` (nullable)
- `created_at`, `updated_at`

## 4.3 Taulu: `sync_runs` (suositus)
- `id`
- `round_id`
- `run_started_at`
- `run_finished_at`
- `status`
- `players_total`
- `players_ok`
- `players_failed`
- `error_summary`

---

## 5. Liiketoimintasäännöt

1. Kierros alkaa aina Excel-importin hetkestä.
2. Sama pelaaja voi kuulua useaan kierrokseen eri baseline-arvoilla (historia säilyy).
3. `round_points` lasketaan aina baselineen verrattuna.
4. Päivittäinen ajo ei muuta baselinea.
5. Jos API-haku epäonnistuu, edellinen onnistunut data säilytetään ja virhe kirjataan.

---

## 6. Ei-toiminnalliset vaatimukset

- Ajastus luotettava (klo 10:00 Europe/Helsinki)
- API-virheiden retry/backoff
- Lokitus import- ja sync-ajoille
- Idempotentti päivittäinen ajo (sama ajo ei tuplakirjoita virheellisesti)
- Perusmonitorointi: onnistuiko päivän sync

---

## 7. MVP-rajaus

MVP sisältää:

1. Excel-import
2. Pelaajien tunnistus API:sta
3. Baseline-pisteiden tallennus DB:hen
4. Päivittäinen 10:00 sync
5. UI, jossa baseline + current + round_points

MVP ei välttämättä sisällä vielä:

- useita samanaikaisia aktiivisia kierroksia
- laajaa käyttäjähallintaa
- monimutkaisia raportteja

---

## 8. Avoimet päätökset

1. Sallitaanko uusi Excel-import aktiivisen kierroksen päälle vai luodaanko aina uusi kierros?
2. Miten käsitellään pelaajasiirrot kierroksen aikana (joukkue vaihtuu)?
3. Tarvitaanko manuaalinen "Päivitä nyt" -painike UI:hin automaattiajon lisäksi?
4. Tallennetaanko vain viimeisin tilanne vai myös päivittäinen historiatietue?

---

## 9. Toteutus TODO-lista (suora backlog)

Tämä lista on tarkoitettu seuraavan vaiheen toteutuksen rungoksi.

### 9.1 DB-migraatiot

- [ ] Valitse tietokanta (suositus: PostgreSQL Railwayssä)
- [ ] Lisää migraatiotyökalu projektiin (esim. Prisma tai Drizzle)
- [ ] Luo migraatio: `rounds`
  - [ ] `id` (UUID/serial)
  - [ ] `name`
  - [ ] `started_at`
  - [ ] `status` (`active`/`closed`)
  - [ ] `created_at`, `updated_at`
- [ ] Luo migraatio: `tracked_players`
  - [ ] `id`
  - [ ] `round_id` (FK -> `rounds.id`)
  - [ ] `player_id`
  - [ ] `player_name`
  - [ ] `team_abbrev`
  - [ ] `baseline_points`
  - [ ] `current_points`
  - [ ] `round_points`
  - [ ] `import_batch_id`
  - [ ] `last_synced_at`
  - [ ] `sync_status`
  - [ ] `sync_error_message`
  - [ ] `created_at`, `updated_at`
- [ ] Luo migraatio: `sync_runs`
  - [ ] `id`
  - [ ] `round_id` (FK)
  - [ ] `run_started_at`, `run_finished_at`
  - [ ] `status`
  - [ ] `players_total`, `players_ok`, `players_failed`
  - [ ] `error_summary`
- [ ] Lisää indeksit:
  - [ ] `tracked_players(round_id, player_id)` uniikki
  - [ ] `tracked_players(round_id, sync_status)`
  - [ ] `sync_runs(round_id, run_started_at DESC)`

### 9.2 API-endpointit

#### Import / round lifecycle
- [ ] `POST /api/rounds/import`
  - [ ] ottaa Excelin (tai käyttää jo ladattua tiedostoa)
  - [ ] luo uuden kierroksen (`rounds`)
  - [ ] tunnistaa pelaajat (nykyinen resolver-logiikka)
  - [ ] hakee baseline-points API:sta
  - [ ] tallentaa `tracked_players`-rivit
- [ ] `GET /api/rounds/active`
  - [ ] palauttaa aktiivisen kierroksen metadatan
- [ ] `POST /api/rounds/:id/close`
  - [ ] sulkee kierroksen (status = `closed`)

#### Read-endpointit UI:lle
- [ ] `GET /api/rounds/:id/players`
  - [ ] palauttaa baseline/current/round_points
  - [ ] sisältää viimeisimmän sync-tilan
- [ ] `GET /api/rounds/:id/sync-runs`
  - [ ] palauttaa sync-ajojen historian

#### Sync-endpointit
- [ ] `POST /api/sync/daily`
  - [ ] suojataan `SYNC_SECRET`-headerilla
  - [ ] ajaa aktiivisen kierroksen päivityksen
  - [ ] luo `sync_runs`-rivin alussa/lopussa
- [ ] `POST /api/sync/now`
  - [ ] manuaalinen triggeri UI:sta (sama logiikka kuin daily)

### 9.3 Cron / scheduler (Railway)

- [ ] Lisää ympäristömuuttuja `SYNC_SECRET`
- [ ] Lisää scheduler-jobi (Railway Cron)
  - [ ] cron: `0 10 * * *`
  - [ ] timezone: `Europe/Helsinki`
  - [ ] jobi kutsuu `POST /api/sync/daily`
  - [ ] mukana auth-header: `x-sync-secret: <SYNC_SECRET>`
- [ ] Lisää fallback-monitorointi (esim. log alert), jos ajo epäonnistuu

### 9.4 Sync-logiikan toteutus

- [ ] Toteuta palvelutaso `runDailySync(roundId)`
- [ ] Hae aktiivisen kierroksen pelaajat tietokannasta
- [ ] Hae API:sta uusin points pelaajille
- [ ] Päivitä:
  - [ ] `current_points`
  - [ ] `round_points = current_points - baseline_points`
  - [ ] `last_synced_at`
  - [ ] `sync_status`, `sync_error_message`
- [ ] Tee päivityksestä idempotentti (sama päivä/ajo ei sotke dataa)

### 9.5 UI-muutokset

- [ ] Lisää näkymä aktiiviselle kierrokselle (`baseline`, `current`, `delta`)
- [ ] Näytä viimeisin päivitysaika
- [ ] Lisää "Päivitä nyt" -painike (optio)
- [ ] Lisää virherivien indikointi (`sync_status = error`)

### 9.6 Testit

- [ ] Yksikkötestit: pelaajan matchaus (exact/fallback/fuzzy)
- [ ] Yksikkötestit: `round_points`-laskenta
- [ ] Integraatiotesti: import -> baseline tallentuu
- [ ] Integraatiotesti: daily sync -> current + delta päivittyy
- [ ] Integraatiotesti: API-virhe -> `sync_status=error`, vanha data säilyy

### 9.7 DevOps / käyttö

- [ ] Päivitä README: DB setup + migraatioiden ajo + cronin aktivointi
- [ ] Lisää `DATABASE_URL` ja `SYNC_SECRET` Railway-enviin
- [ ] Varmista että production-start komento on web-palvelu (`npm start`)
