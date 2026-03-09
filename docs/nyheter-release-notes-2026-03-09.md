# Nyheter release notes – 2026-03-09

## Summary

Nyheter pilot julkaistiin read-only frontend-ominaisuutena. Toteutus on pidetty matalan riskin mallissa:
- ei backend-endpoint muutoksia
- ei kytkentää period 3 -kriittisiin refreshauspolkuihin
- UI + docs -painotteinen iteratiivinen julkaisu

## What changed

- Uusi sivu: `public/nyheter.html`
- Uusi client-renderöinti: `public/nyheter.js`
- Mobiiliystävällinen layout (testattu puhelimella)
- Ruotsinkielinen sisältörakenne + narratiivinen viikkomuoto
- `Inför nästa vecka` näyttää ottelumäärä-kontekstia (games until next update)
- Sisäinen editorial checklist poistettu lukijanäkymästä (vain docs-prosessiin)
- Bottenstriden-kortin tausta yhtenäistetty muiden osioiden kanssa

## Docs updates

- Viikkopohja: `docs/nyheter-weekly-template.md`
- Go/No-Go: `docs/nyheter-go-no-go-checklist.md`
- Spesin scope/changelog: `docs/specification.md`

## Validation

- Nyheter-sivu vastaa lokaalisti (`/nyheter.html`, HTTP 200)
- Mobiilinäkymä tarkistettu käytännössä samassa lähiverkossa
- Muutokset viety workflowlla PR:ien kautta (`#1` docs, `#2` feature)

## Risk & rollback

- Riski: low (frontend/docs)
- Rollback: revert main-commitit
  - `21eb4d3` docs(nyheter): add weekly editorial workflow and pilot scope (#1)
  - `7b9ceb8` feat(nyheter): add mobile-ready weekly pilot page (#2)
