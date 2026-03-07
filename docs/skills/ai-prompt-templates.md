# Skill: AI prompt templates (copy-paste)

Tämä tiedosto sisältää valmiit promptipohjat yleisimpiin kehitystilanteisiin.

Käyttö:
1. Kopioi sopiva template.
2. Täytä hakasulkeissa olevat kentät.
3. Lähetä prompti Copilot Chatille.

---

## 1) Feature template

Goal:
- Toteuta [ominaisuus] käyttäjälle [kohderyhmä].

Constraints:
- Älä muuta [tiedostot/alueet joita ei saa koskea].
- Pidä muutos minimissä, ei scope creepiä.
- Säilytä nykyiset API-sopimukset ellei erikseen pyydetä.

Acceptance criteria:
- [kriteeri 1]
- [kriteeri 2]
- [kriteeri 3]

Context files:
- [path1]
- [path2]

Validation:
- Aja [testi/smoke]
- Raportoi: what changed, files, validation result, risks

---

## 2) Bugfix template

Issue:
- Ongelma: [mitä hajoaa]
- Repro steps: [1..n]
- Expected vs actual: [odotettu] vs [toteutunut]

Goal:
- Korjaa juurisyy, ei pelkkä oire.

Constraints:
- Älä tee laajaa refaktorointia tämän korjauksen yhteydessä.
- Muuta vain vaikutusalueen tiedostoja.

Acceptance criteria:
- Repro ei enää toistu.
- Vähintään yksi kohdistettu validointi menee läpi.
- Ei regressiota kriittisessä polussa [nimi].

Context files:
- [path1]
- [path2]

Validation:
- Aja [kohdistettu testi/smoke]
- Kirjaa root cause + fix + risk + rollback

---

## 3) Refactor template

Goal:
- Refaktoroi [moduuli/funktio] parantaaksesi [luettavuus/suorituskyky/testattavuus].

Constraints:
- Ei muutoksia ulkoiseen käyttäytymiseen.
- Ei API contract -muutoksia.
- Pidä commitit pieninä ja perusteltuina.

Acceptance criteria:
- Käyttäytyminen säilyy samana.
- Koodi yksinkertaistuu (vähemmän duplikaatiota/selkeämpi rakenne).
- Nykyiset testit/smoke menevät läpi.

Context files:
- [path1]
- [path2]

Validation:
- Aja [testit]
- Raportoi ennen/jälkeen-rakenne lyhyesti

---

## 4) Release template

Goal:
- Valmistele release [version] ja varmista turvallinen deploy.

Scope:
- In: [mitä sisältyy releaseen]
- Out: [mitä ei sisälly]

Acceptance criteria:
- Tag/release luotu
- Deploy onnistunut
- Post-deploy smoke ok

Checklist:
- Päivitä release notes
- Varmista rollback-polku
- Raportoi riskit ja known issues

Context:
- Release branch/tag: [nimi]
- Ympäristö: [prod/stage]

---

## 5) Audit/Unknowns template ("en tiedä mitä en tiedä")

Goal:
- Tee audit nykyisestä toteutuksesta ja löydä puutteet suhteessa best practiceen.

Focus areas:
- correctness
- security
- performance
- observability
- docs/workflow

Expected output format:
1. Nykytila (mikä on jo hyvin)
2. Puutteet (prioriteetti: high/medium/low)
3. Konkreettiset korjausehdotukset
4. Minimi-toimenpiteet 24h sisään
5. Jatkokehitys 2–4 viikon näkymällä

Constraints:
- Ei suuria koodimuutoksia ennen hyväksyntää
- Ehdota ensin, toteuta vasta erillisellä pyynnöllä

Context files:
- [spec, readme, päämoduulit]

---

## 6) Prompt quality self-check

Ennen lähetystä varmista:
- Onko tavoite yksiselitteinen?
- Onko rajaukset kerrottu?
- Onko hyväksymiskriteeri testattava?
- Onko kontekstitiedostot nimetty?
- Onko pyydetty validointi mukana?
