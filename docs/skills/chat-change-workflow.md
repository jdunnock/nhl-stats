# Skill: Chat-driven change workflow

Tämä skill määrittää oletustoimintatavan tilanteeseen, jossa käyttäjä kertoo chatissä haluamansa muutoksen.

## 1) Triggeri

Skill aktivoituu, kun käyttäjä sanoo esimerkiksi:
- "Tee tämä workflown mukaan"
- "Tee muutokset ja vie loppuun asti"
- "Päivitä spec ja hoida GitHub-toimet"

## 2) Oletusmoodi

Oletus on Safe mode:
- Safe mode: feature-branch + PR
- Fast mode: suora commit + push mainiin vain poikkeuksena (esim. kriittinen hotfix), käyttäjän eksplisiittisellä hyväksynnällä

## 3) Vaiheistus (pakollinen järjestys)

1. Spec update first
   - Päivitä ensin [docs/specification.md](docs/specification.md):
     - tavoite / scope
     - nykytila tai päätökset
     - muutosloki

2. Implementointi
   - Tee pyydetyt koodimuutokset rajatusti.

3. Visuaalinen katselmointi (vain UI/visuaaliset muutokset)
   - Anna lokaali linkki katselmointiin (esim. `http://localhost:3000/...`).
   - Pyydä käyttäjää kuittaamaan: `ok` tai `ei ok`.
   - Tee mahdolliset korjaukset ennen seuraavaa vaihetta.

4. Validointi
   - Aja vähintään kohdistettu smoke- tai endpoint-testi.
   - Kirjaa tulos lyhyesti.
   - Käy läpi [AI Quality Gate](docs/AI-QUALITY-GATE.md) ennen commit/push-vaihetta.
   - Jos mukana on ruotsinkielistä UI-copya, käy läpi myös [Swedish language quality gate](docs/skills/swedish-language-quality-gate.md) ennen commit/push/deploy-vaihetta.

5. GitHub-toimet
   - Commit viestimallilla `type(scope): what changed`
   - Safe mode: push feature-branchiin + PR + merge mainiin
   - Fast mode: vain erikseen hyväksytty poikkeus

6. Raportointi käyttäjälle
   - What changed
   - Files changed
   - Validation
   - Commit SHA
   - Deploy status (jos tehty)
   - UI-muutoksissa: lokaali katselmointilinkki + käyttäjän kuittaus (ok/ei ok)

## 4) Commit- ja push-käytäntö

- Docs-only muutokset:
  - `docs(spec): update workflow and decisions`
- UI-muutokset:
  - `feat(ui): ...` / `fix(ui): ...`
- Backend-muutokset:
  - `feat(api): ...` / `fix(api): ...`

Jos mukana on paikallisia data-/excel-tiedostoja, niitä ei lisätä committiin ilman erillistä pyyntöä.

Main-suojauksessa suositus:
- vaadi PR ennen mergeä (`Require a pull request before merging`)
- vaadi vähintään yksi hyväksyntä
- vaadi status checkit (CI)
- estä suorat pushit mainiin

## 5) Definition of Done (DoD)

Skill on valmis vasta kun:
- Spec on päivitetty
- Koodi on muutettu
- UI-muutoksissa käyttäjän katselmointi ja kuittaus on saatu
- Validointi on ajettu
- AI Quality Gate on käyty läpi
- Ruotsinkielisissä UI-copy -muutoksissa Swedish language quality gate on käyty läpi
- GitHub-toimet tehty valitun moodin mukaan
- Käyttäjälle on raportoitu yllä olevan mallin mukaisesti
