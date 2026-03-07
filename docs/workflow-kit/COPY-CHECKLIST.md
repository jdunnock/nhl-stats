# 10 minuutin käyttöönotto uuteen projektiin

## 1) Luo hakemistot

- `docs`
- `docs/skills`
- `.github`

## 2) Kopioi template-tiedostot

- `templates/specification.template.md` -> `docs/specification.md`
- `templates/skills/chat-change-workflow.template.md` -> `docs/skills/chat-change-workflow.md`
- `templates/skills/bugfix-workflow.template.md` -> `docs/skills/bugfix-workflow.md`
- `templates/skills/release-workflow.template.md` -> `docs/skills/release-workflow.md`
- `templates/skills/ai-coding-operating-system.template.md` -> `docs/skills/ai-coding-operating-system.md`
- `templates/skills/ai-prompt-templates.template.md` -> `docs/skills/ai-prompt-templates.md`
- `templates/pull_request_template.md` -> `.github/pull_request_template.md`

## 3) Täytä nämä heti

- Projektin tavoite ja scope (`docs/specification.md`)
- Deploy-ympäristö ja rollback-polku (`docs/skills/release-workflow.md`)
- Oletusmoodi: Fast vai Safe (`docs/skills/chat-change-workflow.md`)

## 4) Ensimmäinen commit uuteen projektiin

Suositus:
- `docs(workflow): initialize reusable workflow kit`

## 5) Definition of Ready projektin kehitykselle

- [ ] `docs/specification.md` täytetty vähintään osiot 1–4
- [ ] vähintään yksi skill aktiivisessa käytössä
- [ ] PR-template käytössä `.github`-kansiossa
- [ ] tiimi tietää Fast vs Safe -moodin oletuksen
