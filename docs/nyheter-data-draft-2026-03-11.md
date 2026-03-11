# Nyheter data draft (tilanne 2026-03-11)

Tämä vedos kokoaa tuotantoon tallennetut Nyheter-snapshotit sekä nykytilan tarkistusluvut uutiskirjoitusta varten.

## 1) Kerätyn datan status

- Snapshoteja kertynyt: 3
- Snapshot-päivät: 2026-03-08, 2026-03-09, 2026-03-10
- Uusin snapshot kerätty: 2026-03-11T07:04:25.653Z
- Osallistujia nyt: 7
- Pelaajarivejä nyt: 84
- not_found nyt: 0

Johtopäätös: data on kertynyt useammalta päivältä viikon aikana ja laatu on tällä hetkellä hyvä (ei puuttuvia not_found-rivejä).

## 2) Snapshot-aikajana (tiivistelmä)

| Snapshot date | Players | Risers | Injuries | Top-3 standings |
| --- | ---: | ---: | ---: | --- |
| 2026-03-10 | 84 | 8 | 15 | Timmy 166, Fredrik 157, Mattias 151 |
| 2026-03-09 | 84 | 8 | 15 | Timmy 157, Fredrik 148, Mattias 146 |
| 2026-03-08 | 84 | 8 | 15 | Timmy 157, Mattias 145, Fredrik 143 |

## 3) Nopeat havainnot kirjoittamista varten

- Johtopaikka pysyy Timmyllä koko havaintojakson.
- Fredrik on noussut vakaasti ja ohittanut Mattiaksen viimeisimmässä snapshotissa.
- Top-riser pysyy samana havaintojaksolla: Kucherov (TBL), delta 25 -> 26.
- Injury-lista on pysynyt määrällisesti vakaana (15).
- Datan kattavuus pysyy vakaana: 84 pelaajaa / 7 osallistujaa jokaisessa snapshotissa.
- Uutiskirjeeseen muistutus: period 2:n viimeiset ottelut pelataan lauantai-iltana ja period 3 alkaa huomenna (15.3).

## 4) Luettava uutisvedos (raakaversio)

Viikon datan perusteella kärkitaistelu pysyy tiukkana, mutta Timmy pitää ykköspaikan edelleen hallussa. Fredrik on ottanut keskiviikkoon mennessä selkeän askeleen eteenpäin ja noussut Mattiaksen ohi toiseksi. Kolmikon väliset erot ovat edelleen sellaiset, että yksikin vahva peli-ilta voi heilauttaa järjestystä ennen viikonloppua.

Pelaajapuolella suurimman nousun nimi on pysynyt samana koko havaintojakson: Kucherov (TBL). Hänen etunsa kasvoi vielä hieman viimeisimmässä snapshotissa, mikä tukee narratiivia siitä, että kärkijoukoissa ratkaisut syntyvät tähtipelaajien jatkuvasta tuotannosta.

Loukkaantumispuolella kokonaismäärä on pysynyt samana, mikä viittaa siihen, ettei viikolle ole tullut suurta uutta heiluntaa saatavuudessa. Tämä tekee perjantain viimeisestä tarkistuksesta selkeän: jos injury-määrä tai top-riser-lista muuttuu äkillisesti, se kannattaa nostaa uutiskirjeen viime hetken huomiona.

Muistutus viikonlopun kynnykselle: period 2:n viimeiset ottelut pelataan lauantai-iltana, ja heti huomenna (15.3) käynnistyy period 3. Tämä tekee lauantain kierroksesta aidon vedenjakajan sekä kokonaistilanteen että seuraavan periodin lähtöasetelmien kannalta.

## 5) Perjantain päivitysrunko

Kun perjantain check ajetaan, päivitä tähän vähintään:

- snapshots_total (odotus: kasvaa)
- latest_snapshot_date (odotus: uudempi kuin 2026-03-10)
- top-3 standings (vertailu keskiviikkoon)
- top-riser ja injury-count (muuttuiko vai ei)

Sitten tämä vedos voidaan nostaa suoraan lähes valmiiksi uutiskirjetekstiksi.

## 6) Lauantain katselmointi ennen julkaisua (pakollinen)

Ennen julkaisua tehdään aina sinun katselmointi.

Checklist:

- period 2:n viimeiset ottelut lauantai-iltana on mainittu
- period 3 alkaa huomenna (15.3) on mainittu
- mahdolliset viime hetken data-/injury-muutokset päivitetty tekstiin
- julkaisu tehdään vasta sinun "ok julkaisuun" -hyväksynnällä