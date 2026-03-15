# Skill: AI coding operating system

Tämä on projektin pysyvä AI-työtapa. Tavoite on minimoida "en tiedä mitä en tiedä" -riski.

Pohjautuu käytäntöihin mm. GitHub Copilot docs:
- Best practices for using GitHub Copilot
- Prompt engineering for GitHub Copilot Chat
- Microsoft Learn: Get started with AI-assisted development

## 1) Oletusprosessi jokaisessa muutoksessa

1. Määritä tavoite ja rajaa scope (in/out)
2. Päivitä spec lyhyesti ennen toteutusta
3. Toteuta pienin toimiva muutos
4. Validoi (kohdistettu testi/smoke)
5. Raportoi mitä muuttui + riskit + rollback

## 2) Prompt-rakenne (pakollinen minimi)

Kun pyydät AI:lta muutosta, anna aina:
- Tavoite: mitä halutaan aikaan
- Rajoitteet: mitä ei saa muuttaa
- Hyväksymiskriteeri: miten tiedämme että valmis
- Konteksti: tiedostot, endpointit, data

Malli:
- Goal:
- Constraints:
- Acceptance criteria:
- Context files:

## 3) Varmennus ennen mergeä

- Ymmärretäänkö muutos (ei mustaa laatikkoa)?
- Onko muutos rajattu eikä ylikorjaa?
- Testattiinko vähintään vaikutusalue?
- Onko security/perf/maintainability huomioitu?
- Päivitettiinkö docs, jos käyttäytyminen muuttui?

## 4) Milloin käytetään Fast vs Safe moodia

Oletus: Safe mode (branch + PR)

Fast mode (suoraan main, vain poikkeusluvalla):
- kriittinen hotfix, jossa viive aiheuttaa merkittävän tuotantoriskin

Safe mode (branch + PR):
- API-sopimus muuttuu
- käyttäjäpolku muuttuu näkyvästi
- deploy/infra/db-muutoksia
- epävarma tai laaja refaktorointi

Suositeltu tuotantomalli:
- Railway Auto Deploy seuraa vain `main`-branchia
- Railway `Wait for CI` on päällä
- GitHub main-branch on suojattu (PR + required checks + vähintään 1 review)

## 5) Anti-patternit (vältettävä)

- Yksi iso prompti ilman vaiheistusta
- Koodin hyväksyntä ilman omaa läpikäyntiä
- Testien skippaaminen "koska muutos on pieni"
- Scope creep: korjataan samalla "vähän muutakin"
- Dokumentoinnin unohtaminen

## 6) Oppimissykli (jotta tapa paranee projektista toiseen)

Jokaisen isomman muutoksen jälkeen kirjaa 3 kohtaa:
- mikä toimi
- mikä ei toiminut
- mitä muutetaan seuraavaan kierrokseen

Lisää nämä `docs/specification.md` muutoslokiin tai erilliseen projektin retrospektiokohtaan.
