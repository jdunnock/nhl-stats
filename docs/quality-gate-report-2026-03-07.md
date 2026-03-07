# Quality Gate Report – 2026-03-07

Tämä raportti dokumentoi [AI-QUALITY-GATE.md](AI-QUALITY-GATE.md) -checklistan läpikäynnin tuotantomuutokselle, jossa lagen/admin datavirta kovennettiin ja `-`-rivit poistettiin.

## Scope gate

- [x] Muutos vastaa pyyntöä (Lagen/Admin datan virheettömyys + deploy-varmistus)
- [x] Ei tarpeettomia sivumuutoksia
- [x] Julkiset API:t eivät muuttuneet vahingossa (vain uusi lisäys: `GET /api/version`)

## Correctness gate

- [x] Pääkäyttötapaus toimii (tipsen-summary + lagen render)
- [x] Reuna-/virhepolku huomioitu (429, timeout, MCP fallback)
- [x] Datan käsittely (null/tyhjä/poikkeava nimi) huomioitu

## Validation gate

- [x] Ajettiin kohdistettu smoke/endpoint-testaus paikallisesti ja tuotannossa
- [x] Tulos kirjattu: not_found 0, null_delta 0, health 200, lagen/admin 200
- [x] Known issue kirjattu: Railway UI:n "last deploy" voi viivästyä, varmistus tehdään `/api/version` endpointilla

## Quality gate

- [x] Koodi on luettava (nimetys ja fallback-polut eroteltu)
- [x] Ei TODO-jäämiä ilman syytä
- [x] Suorituskyky arvioitu (MCP-throttle + concurrency + cache)

## Security gate

- [x] Ei kovakoodattuja salaisuuksia
- [x] Input-validaatiot säilytetty endpointeissa
- [x] Ei uusia riippuvuuksia

## Ops gate

- [x] Rollback-polku tiedossa (revert commit + redeploy)
- [x] Deployn jälkeinen smoke suoritettu
- [x] Dokumentaatio päivitetty (spec + tämä raportti)

## Merge decision

- [x] PASS -> hyväksytty
