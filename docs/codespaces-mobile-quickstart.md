# Codespaces puhelimella – quickstart (5–10 min)

Tämä ohje tekee yhden asian: saat yhteyden tähän projektiin puhelimesta ja voit ohjata kehitystä/chattailla Copilotin kanssa missä vain.

## 1) Mitä tämä on käytännössä

- GitHub Codespaces = pilvessä ajettava VS Code -ympäristö.
- Buildit, testit, komennot ja terminal ajetaan pilvessä.
- Puhelimella käytät sitä selaimessa (Chrome/Safari).
- Commit/push toimii normaalisti GitHubiin.

## 2) Ennen kuin aloitat

- GitHub-tilillä Codespaces käytössä.
- Repo näkyy GitHubissa: `jdunnock/nhl-stats`.
- Copilot käytössä tilillä.

## 3) Käynnistys puhelimella

1. Avaa GitHubissa repo `jdunnock/nhl-stats`.
2. Paina **Code** → **Codespaces** → **Create codespace on main**.
3. Odota, että VS Code Web avautuu.
4. Avaa Copilot Chat (chat-ikoni sivupalkista).
5. Kirjoita testiksi: “Tee tämä workflown mukaan: kerro nykyinen tilanne ja seuraava vaihe.”

## 4) Ensimmäinen ajo (terminal)

Aja Codespacesin terminalissa:

- `npm install`
- `npm run start:web`

Kun palvelin käynnistyy, avaa **Ports**-välilehti:
- Etsi portti `3000`
- Aseta näkyvyys tarvittaessa `Public`
- Avaa portin URL selaimeen (myös puhelimella)

## 5) Miten annat hyväksynnän mobiilista

Käytä tätä mallia chatissa:

- “Tee UI-muutos X workflown mukaan.”
- Kun saat katselmointilinkin, vastaa:
  - `ok` = hyväksytty, saa commit/push
  - `ei ok` = korjataan ennen commitia

## 6) Paikalliset tiedostot (tärkeä huomio)

Codespace EI näe automaattisesti Macin paikallisia tiedostoja.

Jos tarvitset paikallisen Excelin:
- vaihtoehto A: lisää tiedosto repoon (vain jos haluat versionhallintaan)
- vaihtoehto B: lataa tiedosto appin upload-toiminnolla Codespacessa
- vaihtoehto C: pidä data lokaalina ja tee datariippuvaiset ajot läppäriltä

## 7) Suositeltu käytäntö tähän projektiin

- Päivittäinen ohjaus puhelimesta: tehtävät, priorisointi, hyväksynnät
- Dataintensiiviset ajot: läppäriltä (jos tiedostot vain lokaalisti)
- Deploy: normaalisti push `main` -> Railway

## 8) Nopea vianhaku

- Codespace ei aukea: refresh + avaa uudelleen GitHubista
- Portti ei aukea: tarkista, että sovellus on käynnissä ja portti 3000 näkyy Ports-listassa
- Copilot Chat ei näy: varmista Copilot-lisenssi ja kirjaudu uudelleen GitHubiin
- Ympäristö “nukkui”: käynnistä codespace uudelleen

## 9) Ensimmäinen kokeilu nyt

1. Luo Codespace.
2. Aja `npm install` ja `npm run start:web`.
3. Avaa portti 3000 URL.
4. Lähetä minulle chatissa: “ok, codespace toimii”.

Sen jälkeen voidaan tehdä ensimmäinen mobiilista ohjattu muutos end-to-end.
