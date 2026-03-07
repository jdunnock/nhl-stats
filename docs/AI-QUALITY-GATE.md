# AI Quality Gate (pre-merge)

Käy tämä läpi ennen kuin muutos mergetään tai pusketaan tuotantoon.

## 1) Scope gate

- [ ] Muutos vastaa pyyntöä (ei yli- eikä alitoteutusta)
- [ ] Ei tarpeettomia sivumuutoksia
- [ ] Julkiset API:t eivät muuttuneet vahingossa

## 2) Correctness gate

- [ ] Pääkäyttötapaus toimii
- [ ] Reuna-/virhepolku huomioitu
- [ ] Datan käsittely (null/tyhjä/poikkeava) huomioitu

## 3) Validation gate

- [ ] Ajettiin vähintään kohdistettu testi/smoke
- [ ] Tulos kirjattiin commit/PR-kuvaukseen
- [ ] Mahdolliset known issues kirjattu

## 4) Quality gate

- [ ] Koodi on luettava (nimetys, rakenne)
- [ ] Ei piilovelkaa (TODO ilman syytä)
- [ ] Suorituskykyvaikutus arvioitu tarvittaessa

## 5) Security gate

- [ ] Ei kovakoodattuja salaisuuksia/avaimia
- [ ] Inputit validoitu vaikutusalueella
- [ ] Riippuvuuksia ei lisätty ilman perustetta

## 6) Ops gate

- [ ] Rollback-polku tiedossa
- [ ] Deployn jälkeinen smoke tiedossa
- [ ] Dokumentaatio päivitetty jos käyttäytyminen muuttui

## Merge decision

- [ ] PASS -> merge/push
- [ ] FAIL -> korjaa puutteet ensin
