# Nyheter launch: Go/No-Go checklist (low risk)

Tämä checklist on lauantain ensimmäistä `Nyheter`-julkaisua varten.

## A) Tekninen turvallisuus (pakollinen)

1. [ ] Nyheter on eristetty omaksi polukseen (ei muutoksia `tipsen-summary` / `players-stats-compare` / `daily-refresh` logiikkaan)
2. [ ] Feature flag käytössä: `NYHETER_ENABLED` (default `false`)
3. [ ] Kill switch testattu: Nyheter voidaan piilottaa ilman deployta (tai yhdellä hyvin pienellä rollbackilla)
4. [ ] Nyheterin datalähteet ovat read-only

## B) Tuotannon sanity ennen julkaisua (pakollinen)

5. [ ] `GET /api/health` = 200
6. [ ] `GET /api/version` vastaa odotettua deployta
7. [ ] `GET /api/cron/daily-refresh` (tokenilla) antaa odotetun vastauksen (`done` tai `already_done_for_date`)
8. [ ] `GET /api/settings` näyttää odotetun `autoRefreshLastSuccessDate`-tilan

## C) Sisältölaatu (wow + luotettavuus)

9. [ ] Nyheter-julkaisussa on vähintään nämä osiot:
   - `Veckans läge`
   - `Raketer & ras`
   - `Påverkan per deltagare`
   - `Skadeläget`
   - `Bottenstriden`
10. [ ] Jokainen nosto on datalla perusteltu (ei spekulaatiota ilman merkintää)
11. [ ] Swedish language quality gate ajettu ja hyväksytty: [docs/skills/swedish-language-quality-gate.md](docs/skills/swedish-language-quality-gate.md)
12. [ ] Kriittiset ruotsin copy-kohdat tarkistettu erikseen:
   - en/ett-muodot oikein
   - å/ä/ö-merkit säilyvät
   - ei tunnettuja typoja (esim. dragkrog)
   - `Påverkan per deltagare` sarakeotsikko vastaa dataa (`Totalt (period 2)`)

---

## Go/No-Go päätössääntö

- GO: kaikki kohdat 1–12 valmiina
- NO-GO: yksikin kohdista 1–8 epäonnistuu

## Julkaisun jälkeen (15 min seuranta)

- [ ] Nyheter-sivu avautuu ilman virheitä
- [ ] Kaksi eri käyttäjäpolkua testattu (desktop + mobile)
- [ ] Ei vaikutuksia olemassa oleviin sivuihin (`/`, `/stallning.html`, admin)
- [ ] Tarvittaessa kill switchillä pois ja analyysi rauhassa
