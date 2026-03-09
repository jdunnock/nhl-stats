# Nyheter weekly check routine (ma-ke-pe)

Tämän rutiinin tarkoitus on varmistaa, että lauantain uutiskirjettä varten kertyy riittävästi oikeaa dataa viikon aikana.

## Aikataulu

- Maanantai: ensimmäinen tilannekuva viikon alussa
- Keskiviikko: puolivälin varmistus
- Perjantai: julkaisua edeltävä data-check

## 1) Aja viikkotsekki

```bash
BASE_URL="https://nhl-stats-production.up.railway.app" \
EXCEL_FILE="NHL tipset 2026 jan-apr period2.xlsx" \
SEASON_ID="20252026" \
npm run nyheter:check
```

## 2) Hyväksymiskriteerit

Tsekin jälkeen varmista vähintään:

- snapshots_total kasvaa viikon edetessä
- latest_snapshot_date on nykyinen tai odotettu keräyspäivä
- tipsen_participants_now on odotettu (nykytilassa 7)
- tipsen_player_rows_now on odotettu (nykytilassa 84)
- tipsen_not_found_now on 0 (tai poikkeama kirjattu)

## 3) Jos data ei päivity

Aja tuotannossa manuaalinen keräys:

```bash
curl -sS \
  -H "x-cron-token: $CRON_JOB_TOKEN" \
  "https://nhl-stats-production.up.railway.app/api/nyheter/collect?file=NHL%20tipset%202026%20jan-apr%20period2.xlsx&seasonId=20252026"
```

Aja sen jälkeen viikkotsekki uudelleen.

## 4) Perjantain julkaisua edeltävä lisätsekki

- Varmista, että snapshots_total sisältää useamman päivän havaintoja
- Varmista, että latest_snapshot sisältää:
  - participantStandings
  - risers
  - slowestClimbers
  - injuries
- Jos jokin puuttuu, aja collect kerran manuaalisesti ja tarkista uudelleen

## 5) Kirjaa tulos lyhyesti

Suositus: kirjaa jokaisesta ma-ke-pe-ajosta 3 riviä:

- Päivä + kellonaika
- snapshots_total + latest_snapshot_date
- Poikkeamat (esim. not_found > 0) + toimenpide
