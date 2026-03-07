# Workflow Kit (Project-to-project reusable)

Tämän kansion tarkoitus on tehdä AI-avusteisesta työskentelystä vakioitu malli, jonka voi ottaa mukaan uuteen projektiin muutamassa minuutissa.

## Mitä tämä kit sisältää

- `templates/specification.template.md` — päätason tuote- ja scope-spesifikaation pohja
- `templates/skills/chat-change-workflow.template.md` — yleinen chat-muutosworkflow
- `templates/skills/bugfix-workflow.template.md` — nopea bugikorjausworkflow
- `templates/skills/release-workflow.template.md` — julkaisu- ja deployworkflow
- `templates/skills/ai-coding-operating-system.template.md` — AI-työskentelyn pysyvä käyttömalli
- `templates/skills/ai-prompt-templates.template.md` — valmiit promptipohjat feature/bugfix/refactor/release/audit
- `templates/pull_request_template.md` — PR-kuvauspohja
- `COPY-CHECKLIST.md` — 10 min käyttöönotto uuteen projektiin

## Käyttötapa uudessa projektissa

1. Kopioi tämän kansion `templates`-sisältö uuteen projektiin.
2. Luo kohdeprojektiin rakenteet:
   - `docs/specification.md`
   - `docs/skills/*.md`
   - `.github/pull_request_template.md`
3. Täytä vain projektikohtaiset kentät (nimi, tavoite, scope, deploy-ympäristö).
4. Käytä samoja commit/PR-rutiineja projektista toiseen.

## Periaate

- `docs/specification.md` = mitä rakennetaan ja miksi
- `docs/skills/*.md` = miten muutokset viedään läpi käytännössä
- `.github/pull_request_template.md` = miten muutoksista raportoidaan yhdenmukaisesti
