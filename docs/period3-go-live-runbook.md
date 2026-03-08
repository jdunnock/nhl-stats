# Period 3 go-live runbook

Tämä checklist on periodi 2 -> periodi 3 vaihtoon.

## 1) Aikaraja (source of truth)

- Period 2 päättyy: `2026-03-15 klo 10:00` (SE) / `11:00` (FI)
- `2026-03-14` illan NHL-pelit kuuluvat vielä periodiin 2
- Period 3 alkaa `2026-03-15` illan peleistä

### Päiväkohtainen päätöstaulukko (cron 09:00 FI)

| Aamun ajopäivä (FI) | Oletus targetDate (`eilinen`) | Tavoite | Vaaditaanko period 3 Excel? |
| --- | --- | --- | --- |
| 2026-03-15 | 2026-03-14 | Päivitä period 2 viimeinen pelipäivä | Ei |
| 2026-03-16 | 2026-03-15 | Period 3 ensimmäinen pelipäivä | Kyllä |
| 2026-03-17 -> | >= 2026-03-16 | Period 3 jatkuvat päivitykset | Kyllä |

Tulkinta:
- `2026-03-15` aamun automaattiajo on sallittu ilman period 3 Exceliä.
- `2026-03-16` aamusta eteenpäin automaattiajo blokataan ilman period 3 Exceliä (reason: `period3_excel_missing`).

## 2) Ennen vaihtoa (viimeistään 15.3 ennen ekaa period 3 peliä)

- [ ] Uusi period 3 Excel on valmis ja tarkistettu
- [ ] Excel sisältää kaikkien osallistujien period 3 pelaajat
- [ ] Tiedoston nimi sovittu (selkeä, esim. `NHL tipset 2026 period3.xlsx`)
- [ ] Varmista että admin-kirjautuminen toimii (`/admin.html`)

## 3) Vaihtohetki (operointi)

- [ ] Lataa uusi period 3 Excel adminin kautta
- [ ] Valitse period 3 tiedosto aktiiviseksi (kun period 3 toteutus käyttää tiedostovalintaa)
- [ ] Aja force-refresh, jotta data lämpenee uudelle periodille
- [ ] Varmista että `Ställningen` ja `Lagen` latautuvat ilman virheitä

### Aamun operointichecklist (15.3 -> 16.3)

15.3 aamulla (period 2 finalisointi):
- [ ] Kutsu `GET /api/cron/daily-refresh` ilman `force=true`
- [ ] Varmista että vastaus EI ole `period3_excel_missing`
- [ ] Varmista että `date` on `2026-03-14` (tai vastaava period 2 viimeinen targetDate)

16.3 aamulla (period 3 gate aktiivinen):
- [ ] Jos period 3 Excel puuttuu, varmista että vastaus on `reason=period3_excel_missing`
- [ ] Lataa period 3 Excel ja aja `GET /api/cron/daily-refresh?force=true`
- [ ] Varmista onnistumisen jälkeen `autoRefreshLastSuccessDate` asetuksista/API-vastauksesta

## 4) Period 3 pisteasteikko

Period 3 sijoituspisteet:

- `30, 24, 19, 15, 12, 10, 8, 6, 4, 2, 1`

Huomio:

- Tämä poikkeaa periodi 1-2 asteikosta (`20, 16, 13, 11, 9, 7, 5, 4, 3, 2, 1`)
- Tasapisteissä käytetään keskiarvoa ja pyöristystä lähimpään kokonaislukuun (sama periaate kuin period 2:ssa)

## 5) Julkaisun jälkeinen tarkistus (smoke)

- [ ] `/` (Lagen) → toimii ja näyttää odotetut arvot
- [ ] `/stallning.html` → toimii ja järjestys näyttää järkevältä
- [ ] `/api/tipsen-summary` → vastaa `200`
- [ ] `/api/health` → vastaa `200`
- [ ] Admin edelleen suojattu (`401` ilman tunnuksia)

## 6) Rollback-suunnitelma

Jos period 3 data on virheellinen:

1. Palauta edellinen toimiva Excel aktiiviseksi
2. Aja force-refresh uudelleen
3. Tarkista `Lagen` + `Ställningen`
4. Tee korjattu period 3 Excel ja toista vaihto

## 7) Viestintä osallistujille

Kun vaihto on tehty:

- [ ] Lähetä lyhyt ilmoitus: period 3 käynnissä
- [ ] Kerro että pisteasteikko period 3:ssa on päivitetty
- [ ] Jaa suora linkki `Ställningen`-sivulle
