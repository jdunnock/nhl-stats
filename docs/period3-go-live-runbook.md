# Period 3 go-live runbook

Tämä checklist on periodi 2 -> periodi 3 vaihtoon.

## 1) Aikaraja (source of truth)

- Period 2 päättyy: `2026-03-15 klo 10:00` (SE) / `11:00` (FI)
- `2026-03-14` illan NHL-pelit kuuluvat vielä periodiin 2
- Period 3 alkaa `2026-03-15` illan peleistä

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
