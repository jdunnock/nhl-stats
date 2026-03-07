# Skill: Chat-driven change workflow

Tämä skill määrittää oletustoimintatavan tilanteeseen, jossa käyttäjä pyytää muutosta chatissä.

## 1) Triggeri

Esim. pyynnöt:
- "Tee tämä workflowlla"
- "Vie tämä loppuun asti"
- "Päivitä spec ja push"

## 2) Oletusmoodi

- Fast mode: commit + push suoraan mainiin
- Safe mode: feature-branch + PR

Oletus tässä projektissa: **[Fast|Safe]**

## 3) Pakollinen vaiheistus

1. Päivitä `docs/specification.md` (tavoite/scope/muutosloki)
2. Toteuta rajattu muutos
3. UI-muutoksissa: anna lokaali linkki ja pyydä katselmointikuittaus (ok/ei ok)
4. Aja kohdistettu validointi
5. Tee GitHub-toimet (commit + push / PR)
6. Raportoi: what changed, files, validation, commit SHA

## 4) Commit-käytännöt

- Muoto: `type(scope): what changed`
- Esimerkkejä:
  - `feat(api): add summary cache`
  - `fix(ui): correct participant grouping`
  - `docs(spec): update scope and changelog`

## 5) Definition of Done

Valmis vasta kun:
- Spec päivitetty
- Muutos toteutettu
- UI-muutoksissa katselmointi ja käyttäjän kuittaus saatu
- Validointi ajettu
- GitHub-toimet tehty
- Käyttäjälle raportoitu
