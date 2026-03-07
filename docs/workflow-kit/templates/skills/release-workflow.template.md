# Skill: Release workflow

Tämä skill vakioi julkaisun, jotta release tehdään samalla mallilla projektista toiseen.

## 1) Triggeri

Käytä kun tehdään:
- versiotagi
- release-notes
- tuotantodeploy

## 2) Vaiheet

1. Freeze
   - varmista, että scope on lukittu julkaisuun
2. Validate
   - aja vähintään kriittinen smoke-polku
3. Tag & release
   - luo/siivoa tagi
   - julkaise release-notes
4. Deploy
   - seuraa deploy statusta loppuun asti
5. Post-check
   - health-check + tärkein käyttäjäpolku

## 3) Release-viestin minimisisältö

- Mitä muuttui
- Vaikutus käyttäjälle
- Mahdolliset riskit
- Rollback-ohje

## 4) Rollback runbook

- revert commit / rollback deployment
- varmista että palvelu palautuu terveeksi
- tiedota lyhyesti mitä tehtiin ja miksi

## 5) DoD

- Tag ja release olemassa
- Deploy onnistunut
- Post-check kunnossa
- Rollback-polku dokumentoitu
