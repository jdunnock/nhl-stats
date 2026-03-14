# Skill: Swedish language quality gate (Nyheter)

Tämän skillin tavoite on estää ruotsinkieliset kieli- ja merkitysvirheet ennen julkaisua.

## 1) Milloin käytetään

Käytä aina kun muutat ruotsinkielistä sisältöä, erityisesti:
- [public/nyheter.js](public/nyheter.js)
- [public/nyheter.html](public/nyheter.html)
- ruotsinkieliset tekstit [docs/specification.md](docs/specification.md)

## 2) Pakollinen tarkistus ennen commitia

1. Kielioppi ja suku/taivutus
- Varmista substantiivin suku (en/ett) ja siihen liittyvä adjektiivin muoto.
- Esim. oikea: Inget anmarkningsvart draglok.

2. Termin johdonmukaisuus
- Sama termi käytössä kaikkialla (ei rinnakkaisia tai typo-muotoja).
- Esim. draglok, ei dragkrog.

3. Numeron merkitys
- Tarkista että otsikko vastaa dataa.
- Jos arvo on periodin kokonaiskertymä, otsikko ei saa vihjata viikkovaihteluun.

4. Diakriitit
- Sailyta ruotsin merkit: a/o-korvauksia ei hyväksytä jos alkuperäinen teksti kuuluu olla å/ä/ö.

5. Julkaisukonteksti
- Tarkista, että ajankohtamaininnat (esim. period 3 alkaa huomenna) ovat mukana kun niistä on sovittu.

## 3) Julkaisua edeltävä mini-checklist

1. Aja kohdistettu haku kriittisille sanoille:
- draglok
- broms
- period 3
- Totalt (period 2)

2. Lue koko Nyheter-sivu läpi "lukijan silmillä":
- onko otsikko harhaanjohtava?
- onko lause luonnollista ruotsia?

3. Vasta sitten commit/push/deploy.

## 4) Hyväksymiskriteeri

Muutos on valmis vasta kun:
- ei löydy tunnettuja typoja tai väärää en/ett-muotoa
- taulukkojen otsikot vastaavat datan semantiikkaa
- sovitut julkaisumaininnat ovat mukana
- UI-tekstit ovat yhteneväiset [public/nyheter.js](public/nyheter.js), [public/nyheter.html](public/nyheter.html) ja [docs/specification.md](docs/specification.md) välillä
