# NHL Stats - Tuotespesifikaatio ja AI-työworkflow (v2)

Tämä dokumentti on tämän projektin ensisijainen sovellusspesifikaatio.

## 1. Mitä tämä sovellus tekee

Sovellus vertailee NHL-pelaajien pisteitä Excel-listaan perustuen.

Päätulokset:
- Admin-sivu näyttää pelaajarivit, vertailupäivän pisteet, nykyiset pisteet ja erotuksen.
- Osallistujasivu (lagen.html) näyttää joukkueet ja pelaajakohtaiset pisteet selkeässä taulukossa.
- Data tulee NHL API:sta, pelaajat täsmäytetään Excelin perusteella.

## 2. Nykyinen arkkitehtuuri

- Backend: Node.js + Express
- Data/parsing: xlsx
- Persistenssi: SQLite (app-settings + response cache)
- UI: staattiset sivut public-kansiossa
- Deploy: Railway

Pääsijainnit:
- Backend: src/web-server.js
- Admin UI: public/index.html + public/app.js
- Lagen UI: public/lagen.html + public/tipsen.js
- Dokumentaatio: README.md ja docs/specification.md

## 3. Sovelluksen toiminnallinen scope (nykytila)

### 3.1 Admin-näkymä
- Excel-tiedoston valinta / upload
- Vertailupäivän tallennus
- Pelaajien pistevertailu
- Maalivahtien ja muiden pelaajien erottelu omiin osioihin
- Reconciliation-raportti mismatch-riveille
- Mobiilikäytössä admin-sivua ei näytetä
- Admin-reitit voidaan suojata HTTP Basic Authilla ympäristömuuttujilla (`ADMIN_BASIC_USER`, `ADMIN_BASIC_PASS`)

### 3.2 Osallistujanäkymä (tipsen)
- Ruotsinkielinen näkymä
- Otsikko: Lagen
- Ei hakukontrolleja
- Taulukossa sarakkeet osallistujittain: Spelare + Poäng
- Osiot: Målvakter, Utespelare, Totalt
- Minimoitu metateksti (ei status/file/compareDate näkyvissä)
- Mobiilissa osallistujat näytetään erillisinä swipe-kortteina
- Mobiilin swipe-korteissa pelaajariveillä on vakioitu minimikorkeus, jotta `Poäng`-sarake pysyy linjassa riippumatta loukkaantumistiedon näkyvyydestä
- Jos pelaajalla on loukkaantumisstatus, pelaajan nimi näytetään punaisena
- Pelaajan nimen alle näytetään pienellä lähdedataan perustuva status-teksti (esim. `Out: Day-to-day`, `Questionable: At least YYYY-MM-DD`)
- Loukkaantumistieto haetaan ulkoisesta NHL-yhteensopivasta lähteestä (ESPN NHL injuries), mutta näkymä toimii myös ilman tietoa

#### 3.2.1 Suunniteltu lisä: `Last game` -rivi ei-loukkaantuneille

Tavoite:
- Näytä ei-loukkaantuneille pelaajille lisärivi, joka kertoo viimeisimmän pelin lyhyesti (tuore ottelukonteksti ilman erillistä klikkausta).

Näkyvyys ja ehdot:
- Rivi näytetään vain, jos pelaajalla ei ole aktiivista loukkaantumisstatusta.
- Jos loukkaantumisstatus löytyy, nykyinen injury-rivi säilyy eikä `Last game`-riviä näytetä samalle pelaajalle.
- Jos viimeisintä peliä ei löydy luotettavasti, riviä ei näytetä (fail silent, ei virhetekstiä UI:hin).

Tekstiformaatti (skaters):
- `Last game: G+A, TOI mm:ss`
- Esimerkki: `Last game: 1+1, TOI 18:30`

Tekstiformaatti (goalies):
- `Last game: SVS/SA, TOI mm:ss`
- Esimerkki: `Last game: 28/30, TOI 60:00`

Terminologia:
- Käytetään jääkiekkoterminä `TOI` (Time On Ice), koska se on NHL-kontekstissa vakiintunut ja lyhyt.

Datakentät (suunniteltu):
- Viimeisin valmis ottelu pelaajan game logista
- Skaters: goals, assists, toi
- Goalies: saves, shotsAgainst, toi

Hyväksymiskriteerit:
- Ei-loukkaantuneella pelaajalla näkyy yksi `Last game` -rivi oikeassa formaatissa.
- Loukkaantuneella pelaajalla näkyy vain injury-rivi (ei `Last game` -riviä).
- Rivi ei riko mobiilin korttirakennetta eikä pistekolumnin linjausta.
- Jos data puuttuu, rivi jää pois ilman näkyvää virhettä.

### 3.3 Ställningen-näkymä
- Ruotsinkielinen erillissivu: `stallning.html`
- Uusi navigaatiopainike lisätään ensimmäiseksi päänavigaatioon
- Sivu näyttää osallistujat pistejärjestyksessä (suurimmasta pienimpään)
- Sijoitusnumerointi käyttää kilpailusijoitusta (tasapisteisillä sama sijoitus, seuraava sijoitus hyppää)
- Pisteet ovat samat kuin `lagen`-sivun `Totalt`-rivin arvot (`participant.totalDelta`)
- Ulkoasu käyttää samaa visuaalista design-linjaa kuin Figmaan päivitetty `lagen`-näkymä
- Sivulla näytetään myös toinen taulukko otsikolla `Totalställning Period 1+2`
- Period 1 -pisteet ovat kiinteät:
  - Mattias 20, Fredrik 16, Joakim 13, Jarmo 11, Timmy 9, Kjell 7, Henrik 5
- Nykykierroksen (Period 2) sijoituspisteasteikko:
  - 20, 16, 13, 11, 9, 7, 5, 4, 3, 2, 1
- Tasapisteissä jaetaan sijoitusten pisteiden keskiarvo tasan kaikille tasapisteisille
  - Esim. sijat 1-2 tasan: `(20 + 16) / 2 = 18`
  - Esim. sijat 1-3 tasan: `(20 + 16 + 13) / 3`, pyöristys lähimpään kokonaislukuun
- Period 1+2 -taulukko lajitellaan yhteenlasketun pistemäärän mukaan
- Myös `Totalställning Period 1+2` käyttää samaa kilpailusijoituslogiikkaa tasapisteissä

### 3.3.1 Nyheter-näkymä (pilot, low-risk)
- Uusi ruotsinkielinen `Nyheter`-sivu tehdään ensin pilot-versiona (`nyheter.html` + `nyheter.js`)
- Nyheter-sivu lukee ensisijaisesti uusimman snapshotin endpointista `GET /api/nyheter/snapshots` (period2 + aktiivinen seasonId), jotta julkaistu näkymä vastaa tuotannon tuoreinta dataa
- Jos snapshot-data ei ole saatavilla, sivu voi näyttää fallback-mockin ilman että muu sovelluspolku rikkoutuu
- Tavoite: korkea “wow”-vaikutelma sisällöllä + visuaalisuudella, kuitenkin nykyisen design-linjan mukaisesti
- Nyheter-linkki näkyy päävalikossa julkaisuhetkellä (`Lagen` + `Ställningen` + `Nyheter`)
- Julkaistun tekstin kielimuodossa säilytetään skandinaaviset merkit (`å`, `ä`, `ö`) eikä niitä translitteroida (`a`, `o`)
- Osiolla `Långsammaste klättrare` näytetään uniikit pelaajat top-3-listassa; jos sama pelaaja kuuluu usealle osallistujalle, listalle näytetään muoto `Etunimi med flera`
- Osiolla `Raketer` näytetään myös uniikit pelaajat top-3-listassa; jos sama pelaaja kuuluu usealle osallistujalle, listalle näytetään muoto `Etunimi med flera`
- Osiot `Raketer` ja `Långsammaste klättrare` merkitään eksplisiittisesti periodikontekstilla (`period 2 totalt`), jotta viikkokirjeen lukija ei tulkitse niitä viikkolistoiksi
- Nyheter käyttää viikkotilastotilaa aina kun endpointista löytyy vähintään kaksi snapshotia noin viikon välein (latest + baseline noin 7 päivää aiemmin)
- Viikkotilassa `Raketer`, `Långsammaste klättrare` ja `Påverkan per deltagare` lasketaan snapshot-deltana (`latest - baseline`), ja otsikot vaihtuvat viikkokontekstiin
- Ennen kuin viikkobaseline on saatavilla, sivu pysyy perioditilassa (selkeästi merkittynä), jotta lukijalle ei synny väärää viikkotulkintaa
- Nyheter-snapshot-keräys on pausella kunnes period 3 -Excel on saatavilla (joukkueet tiedossa); tämän jälkeen viikkosnapshotien keräys jatkuu normaalisti
- Osiota `Redaktionens blinkning` ei näytetä tällä julkaisukierroksella
- Nyheter-avauksessa mainitaan period 3:n käynnistyminen (julkaisukierros 14.3.2026: "I morgon startar period 3")
- Osio `Inför nästa vecka` poistetaan Nyheter-näkymästä, koska se ei tuo lisäarvoa suhteessa muihin osioihin
- Osio `Påverkan per deltagare` muodostetaan snapshotissa jokaisen osallistujan omista pelaajista (paras nousija + suurin jarru), jotta jokaiselle osallistujalle saadaan osallistujakohtainen sisältö eikä pelkkä globaali top-listan osuma
- `Påverkan per deltagare`-taulukon toinen sarake kuvaa periodin kokonaiskertymää (`Totalt (period 2)`), ei viikon pistemuutosta
- Nyheter-toteutus pidetään read-only ja eristettynä, jotta `tipsen-summary`, `players-stats-compare` ja `daily-refresh` eivät muutu
- Iteraatio 2 painopiste: pidempi avausnarratiivi (myös häntäpään taistelu), kevyt huumorisävy sekä visuaaliset draamanostot ilman uusia backend-riippuvuuksia
- Oikean datan keruuta varten lisätään erillinen snapshot-polku, joka tallettaa Nyheter-viikkosisällön raakakandidaatit SQLiteen (`nyheter_snapshots`) ilman muutoksia UI:n julkiseen lukijasisältöön

### 3.4 API-endpointit
- GET /api/players-stats-compare
- GET /api/tipsen-summary
- GET /api/spelarna-reconciliation
- GET /api/nyheter/snapshots
- GET/POST /api/nyheter/collect
- GET /api/data-readiness
- GET /api/settings
- POST /api/settings/compare-date
- GET /api/excel-files
- POST /api/upload-excel

### 3.5 Data readiness -portti (päivän päivitys)
- Tavoite: estää päivän datapäivitys ennen kuin kaikki päivän NHL-matsit ovat varmasti valmiit.
- Endpoint: `GET /api/data-readiness?date=YYYY-MM-DD`
- Päätössääntö `ready=true` vain kun:
  - kaikki kohdepäivän matsit ovat final-tilassa (`gameState === OFF`), ja
  - jokaisesta pelistä löytyy boxscore-pelaajastatsit (`playerByGameStats` koti + vieras).
- Endpoint palauttaa myös estolistat (`blockingGames`), jotta nähdään miksi readiness on vielä false.

### 3.6 Automaattinen päiväpäivitys (09:00 FI)
- Tavoite: ajaa päivän force refresh automaattisesti vasta kun data on valmis.
- Triggerit:
  - `GET/POST /api/cron/daily-refresh` (cron-kutsu)
  - valinnainen sisäinen scheduler (`AUTO_REFRESH_SCHEDULER_ENABLED=true`)
- Ajoehdot (ellei `force=true`):
  - Helsingin kellonaika vähintään `AUTO_REFRESH_MIN_HOUR_FI` (oletus 9)
  - kohdepäivä on oletuksena `eilinen` Helsingin päivämäärästä (US-illan NHL-pelit)
  - jos kohdepäivä on `2026-03-15` tai myöhemmin, ajo blokataan kunnes period 3 Excel löytyy (filename sisältää `period3` / `period 3`)
  - samaa päivää ei ole jo onnistuneesti ajettu (`autoRefreshLastSuccessDate`)
  - `data-readiness` palauttaa `ready=true`
- Toteutus:
  - endpoint ajaa `tipsen-summary?forceRefresh=true` kaikille löydetyille Excel-tiedostoille
  - onnistuneesta ajosta talletetaan `autoRefreshLastSuccessDate` + `autoRefreshLastRunAt`
  - jos `CRON_JOB_TOKEN` on asetettu, endpoint vaatii `x-cron-token` arvon

## 4. Suorituskykylinjaukset (nykytila)

- players-stats-compare käyttää cachea dataikkunassa
- tipsen-summary käyttää omaa cachea (file+seasonId+compareDate+window)
- response cache invalidoituu automaattisesti deployment/version vaihtuessa (startup flush), jotta vanha payload-rakenne ei jää voimaan tuotannossa
- deploymentin jälkeen cache warmataan automaattisesti taustalla startupissa (`tipsen-summary` force refresh löydetyille Excel-tiedostoille), jotta ensimmäinen käyttäjä ei joudu kylmään hakuun
- cache-diagnostiikka (`hit`/`miss`) palautetaan `tipsen-summary`-vastaukseen vain kun sekä admin-auth että `debugCache=1` on mukana
- tipsen initial load ei pakota forceRefreshiä
- frontin renderöintiä kevennetty (Map lookup + DocumentFragment)

## 5. Oikea tapa tehdä spesifikaatio AI-avusteisessa koodauksessa

## 5.1 Mihin tiedostoon ja kansioon

Suositus tässä repossa:
- Yksi pääspesifikaatio: docs/specification.md
- Käytännön käyttöohjeet: README.md
- Jos tulee iso uusi osa-alue, lisää docs-kansioon oma tiedosto (esim. docs/performance.md)

Nyrkkisääntö:
- Product + scope + päätökset -> docs/specification.md
- Asennus, ajo, deploy -> README.md
- Lyhyt issue/PR-keskustelu -> GitHub issue/PR description

## 5.2 Formaatti

Pidä formaatti aina samana:
1) Tavoite
2) Scope (in/out)
3) Käyttäjäpolut
4) API + data
5) Ei-toiminnalliset vaatimukset (perf, luotettavuus)
6) Päätökset ja avoimet kysymykset
7) Muutosloki

Tämä tekee AI-agentin työstä vakaata: agentti näkee heti rajat eikä improvisoi väärään suuntaan.

## 5.3 Miten käyttää tätä käytännössä joka muutoksessa

Ennen toteutusta:
- Lisää specificationiin 3-8 bulletia siitä mitä aiot muuttaa.

Toteutuksen jälkeen:
- Päivitä specificationin nykytila-kohta.
- Lisää muutoslokiin päivä + mitä muuttui.

## 6. GitHub workflow muutoksille (pushien yhteydessä)

## 6.1 Branching

Pienet nopeat muutokset: voi mennä suoraan mainiin.

Isommat muutokset: käytä feature-branchia:
- feat/tipsen-performance
- fix/reconciliation-cache

## 6.2 Commit-viestit (selkeä malli)

Muoto:
- type(scope): what changed

Esimerkit:
- feat(tipsen): add endpoint cache for summary
- fix(admin): default to goalie-inclusive period2 file
- refactor(ui): optimize tipsen table rendering
- docs(spec): update workflow and current scope

## 6.3 Pushin yhteydessä kerrottava sisältö

Kun muutokset pusketaan, kerro aina:
1) Mitä muuttui
2) Missä tiedostoissa
3) Miten testattiin
4) Mahdolliset riskit / known issues

Esimerkkimalli:
- What changed: tipsen-summary cache + no force refresh on first load
- Files: src/web-server.js, public/tipsen.js
- Validation: forced call ~16.7s, cached call ~0.18s (production)
- Risk: first forced warmup remains slow due to upstream API calls

## 6.4 PR-kuvausmalli

Kun käytät PR:ää, käytä tätä:

- Summary
- Scope (in/out)
- Screenshots (jos UI)
- Test steps
- Rollback plan

## 7. Muutosloki

- 2026-03-13
  - Määritelty `Lagen`-sivulle suunniteltu `Last game` -lisärivi ei-loukkaantuneille pelaajille (formaatit skaters/goalies, TOI-terminologia, näkyvyys- ja hyväksymiskriteerit)

- 2026-03-14
  - Nyheter-prosessi: snapshot-keräys pauselle kunnes period 3 -Excel on saatavilla, jotta period 2 -joukkueiden viimeinen päivä ei vääristä ensi viikon `veckobrev`-vertailua
  - Nyheter-auto-refresh: kun keräys on pausella, ajotulos raportoi `snapshotsPaused=true` ja syyn `period3_excel_missing` ilman virhetilaa
  - Nyheter-parannus: snapshot-payloadiin lisätty `playerTotals` (kaikkien osallistujien kaikki pelaajarivit), jotta viikkodeltat voidaan laskea luotettavasti
  - Nyheter-parannus: sivu hakee useamman snapshotin (`limit=21`) ja vaihtaa automaattisesti viikkotilaan kun 7 päivän baseline löytyy
  - Nyheter-copy: viikkotilassa otsikot vaihtuvat muotoihin `Veckans raketer` / `Veckans långsammaste klättrare` ja `Påverkan per deltagare`-sarake `Vecka`
  - Nyheter-livekorjaus: `Raketer` näyttää uniikit pelaajat ja käyttää osallistujatekstiä muodossa `med flera` duplikaattipelaajille (sama linja kuin `Långsammaste klättrare`)
  - Nyheter-copy: `Raketer` ja `Långsammaste klättrare` otsikot täsmennetty muotoihin `(... period 2 totalt)`, jotta listat eivät näyttäydy viikkonousijoina/-laskijoina
  - Nyheter-copy: `Påverkan per deltagare`-taulukon sarakeotsikko täsmennetty muotoon `Totalt (period 2)` (ei viikkomuutos), jotta +177-tyyppiset arvot eivät tulkinnu viikkopisteiksi
  - Nyheter-copy: avausnarratiiviin lisätty period 3 -maininta ("I morgon startar period 3")
  - Nyheter-rakenne: osio `Inför nästa vecka` poistettu sivulta
  - Nyheter-copy: `Påverkan per deltagare` fallbackit muutettu muotoihin `Inget anmärkningsvärt draglok` ja `Ingen anmärkningsvärd broms` ilman `(-)`-hännän renderöintiä
  - Nyheter-parannus: snapshotiin lisätty `participantImpacts` jokaisen osallistujan omista pelaajista (top contributor + biggest drag), ja UI käyttää tätä ensisijaisena lähteenä `Påverkan per deltagare`-taulukossa
  - Nyheter-copy: kun osallistujakohtaista osumaa ei löydy, fallback-teksti on `Ingen data i senaste snapshot` (ei `Okänd spelare`)
  - Nyheter-julkaisupäivän kovennus: `nyheter.js` lukee tuoreimman snapshot-datan endpointista ja käyttää mockia vain fallbackina
  - Nyheter-linkki lisätty näkyviin päävalikkoon (`Lagen` + `Ställningen`), jotta julkaistu Nyheter-sivu on löydettävissä suoraan navigaatiosta
  - Nyheter-livekorjaus: skandinaaviset merkit (`å`, `ä`, `ö`) palautettu näkyviin UI-teksteissä
  - Nyheter-livekorjaus: `Långsammaste klättrare` näyttää uniikit pelaajat ja käyttää osallistujatekstiä muodossa `med flera` duplikaattipelaajille
  - Nyheter-livekorjaus: `Redaktionens blinkning` piilotettu tältä julkaisukierrokselta

- 2026-03-12
  - Korjattu `Ställningen`-sivun sijoitusnumerointi: tasapisteiset osallistujat saavat saman sijoituksen (esim. 3, 3, 5) periodi- ja total-taulukoissa
  - Lisätty startup-vaiheen automaattinen cache-warmup (`tipsen-summary`), jotta deployn jälkeen cache täyttyy taustalla ennen ensimmäistä käyttäjää

- 2026-03-09
  - Lisätty Nyheter-oikean datan keruu: uusi snapshot-tallennus SQLiteen (`nyheter_snapshots`) sekä endpointit `GET/POST /api/nyheter/collect` (keräys) ja `GET /api/nyheter/snapshots` (haku)
  - Kytketty Nyheter-snapshot-keräys automaattiseen päiväpäivitykseen: onnistuneen `daily-refresh`-ajon jälkeen kerätään snapshotit kaikille Excel-tiedostoille kohdepäivällä
  - Nyheter iteraatio 2 määritelty: pidempi ruotsinkielinen narratiivi + häntäpään taistelun humoristinen nosto + visuaaliset draamaelementit (edelleen low-risk, mock/read-only)
  - Aloitettu Nyheter iteraatio 1 workflowlla: määritelty low-risk pilot-scope (mock-data, eristetty toteutus, wow-painotteinen mutta nykytyyliä noudattava UI)
  - Lisätty Nyheter-julkaisun matalan riskin Go/No-Go-checklist: [docs/nyheter-go-no-go-checklist.md](docs/nyheter-go-no-go-checklist.md)
  - Lisätty `Nyheter`-MVP-kenttälista (v1) automaattisen viikkosisällön minimitoteutukseen: [docs/nyheter-weekly-template.md](docs/nyheter-weekly-template.md)
  - Lisätty `Nyheter`-sisältöä varten viikkopohja ruotsiksi: [docs/nyheter-weekly-template.md](docs/nyheter-weekly-template.md) (otsikkorakenne, datakentät ja copy/paste-julkaisurunko)

- 2026-03-08
  - Dokumentoitu period 3 go-live -runbookiin päiväkohtainen 15.3/16.3+ päätöstaulukko sekä aamun operointichecklist (`docs/period3-go-live-runbook.md`), jotta siirtymärajan käytännön ajotapa on yksiselitteinen
  - Täsmennetty period 3 -siirtymäsuoja: 15.3.2026 aamun ajo (targetDate=14.3) sallitaan period 2:n viimeisille peleille, mutta 16.3.2026 aamusta alkaen (targetDate=15.3) auto-refresh estetään kunnes period 3 Excel on saatavilla
  - Lisätty period 3 -siirtymäsuoja automaattiseen päiväpäivitykseen: kohdepäivästä `2026-03-15` eteenpäin refresh ei aja ennen kuin period 3 Excel on saatavilla, jotta period 2:n viimeinen valmis tilanne säilyy näkyvissä ilman virhepäivityksiä
  - Korjattu Lagenin pelaajanimen kirjoitusasu: kun match löytyy, `tipsen-summary` käyttää NHL-matchin sukunimeä labelissa (esim. `Scheifele`), eikä Excelin mahdollisesti väärinkirjoitettua nimeä
  - Korjattu `tipsen-summary` Lagen-labelin joukkuekoodi: pelaajarivin näkyvä label muodostetaan resolved nykyjoukkueella (esim. `Carlson (ANA)`), ei suoraan vanhalla Excel-joukkuekoodilla
  - Korjattu `players-stats-compare` current team -kentän lähde: `teamAbbrev` muodostetaan ensisijaisesti NHL `player landing` -datan nykyisestä joukkueesta (`currentTeamAbbrev`), jotta pelaajakaupat/siirrot näkyvät oikein
  - README päivitetty: lisätty admin-debug esimerkkikutsu (`tipsen-summary?debugCache=1`) cache-diagnostiikan tarkistukseen
  - Lisätty `debugCache`-query-kytkin: `tipsen-summary` palauttaa cache-diagnostiikan vain yhdistelmällä admin-auth + `debugCache=1`
  - Lisätty admin-only cache-diagnostiikka (`cache.hit=true/false`) `tipsen-summary`-vastaukseen helpottamaan tuotannon cache-käyttäytymisen varmistamista ilman että tieto näkyy tavallisille käyttäjille

- 2026-03-07
  - Admin-taulukon joukkuesarakkeet selkeytetty: `Input team` = Excelin syötejoukkue, `Current NHL team` = NHL API:n nykyjoukkue, jotta Carlson-tyyppiset siirtotilanteet eivät näytä virheeltä
  - Tipsen UI uudistettu ja lokalisoitu ruotsiksi
  - Admin-sivulla maalivahdit ja muut pelaajat eroteltu selkeämmin
  - Reconciliation endpoint lisätty
  - Tipsen-summary cache + render-optimoinnit lisätty
  - Deploy + Git tag + Release tehty
  - Lagen-mobiilinäkymään lisätty osallistujakohtaiset swipe-kortit
  - Admin-sivu piilotettu mobiilikäytössä
  - Backendin datapolku kovennettu tuotantokuormaan:
    - MCP-throttle + 429-aware retry/backoff
    - fallback MCP -> direct NHL API transient-virheissä
    - tipsen-mätsäys korjattu niin, ettei lagen-sivulle jää '-' rivejä
    - cache-key versioitu (`RESPONSE_CACHE_VERSION`) vanhan cachen invalidoimiseksi
  - Lisätty `/api/version` endpoint tuotantoversion varmistamiseen
  - Lisätty `data readiness` -toiminto (`/api/data-readiness`) päivän automaattisen päivityksen varmistamiseen
  - Lisätty automaattinen päiväpäivitys (`/api/cron/daily-refresh`) readiness-gatella ja 09:00 FI -ajoehdoilla
  - Lisätty uusi `Ställningen`-sivu (`stallning.html`), joka näyttää osallistujat `Totalt`-pisteiden mukaiseen järjestykseen lajiteltuna
  - Lisätty `Ställningen`-painike päänavigaation ensimmäiseksi
  - Poistettu `+`-etuliite positiivisista pisteistä `Lagen`- ja `Ställningen`-näkymissä
  - Lisätty valinnainen admin-suojaus (HTTP Basic Auth) reiteille `admin.html`, `app.js` ja admin-muokkaus/API-toiminnoille
  - Lisätty `Ställningen`-sivulle `Totalställning Period 1+2` -taulukko sekä tasapistetilanteen pistejako nykykierroksen sijoituspisteisiin
  - Poistettu loukkaantumisnäkymän paikallinen preview-pakotus (`Tkachuk (Flo)`), jotta näkymä perustuu vain oikeaan injury-lähdedataan
  - Päivitetty loukkaantumistiedon tekstimuoto näyttämään etuliite `Injured:` ennen timeline-tekstiä
  - Vakioitu mobiilin pelaajarivien minimikorkeus, jotta pisteet eivät näytä leijuvan eri kohdissa injury-riveihin verrattuna
  - Lisätty automaattinen cache-invalidaatio deployment/version vaihtuessa (startup flush), jotta schema-/payload-muutokset tulevat varmasti voimaan ilman manuaalista force refreshiä
  - README:iin lisätty `Cache + deploy troubleshooting` -osio, jossa yhtenäinen tuotannon tarkistuspolku (`/api/version`, cache-version logi, force refresh warmup)
  - Auto refreshin oletus kohdepäivä muutettu `eiliseen` (FI), jotta klo 9 ajo käsittelee valmiit US-illan pelit eikä saman päivän tulevia otteluita
  - Korvattu kiinteä `Injured:`-etuliite tarkemmalla lähdedataan perustuvalla status-tekstillä, koska kaikki poissaolot eivät ole varsinaisia loukkaantumisia

## 7.1 Prosessi-backfill (workflow compliance) 2026-03-07

Tällä merkinnällä paikattiin chat-kierroksen prosessipoikkeama, jossa implementointi tehtiin ennen dokumentaatiota.

Backfillin sisältö:
- Spec päivitetty jälkikäteen vastaamaan toteutettua tuotantomuutosta
- AI Quality Gate käyty läpi ja kirjattu erilliseksi raportiksi
- Dokumentaatiocommit tehty vaaditulla muodolla `type(scope): ...`

Päätös jatkoon:
- Seuraavissa muutoksissa noudatetaan järjestystä "spec update first" ennen koodimuutoksia
- Ennen push/deploy-vaihetta kirjataan aina lyhyt Quality Gate -yhteenveto

## 8. Seuraavat suositellut askeleet

1) Lisää lyhyt deployment checklist README:iin yhdellä komennolla ajettavaksi.
2) Lisää kevyt health endpoint vain deploy-monitorointiin.
3) Lisää yksi benchmark-komento package.json scripts-kohtaan (tipsen warm/cached).

## 9. Skills (erilliset tiedostot)

Projektin workflow-skillit pidetään erillisinä dokumentteina kansiossa `docs/skills`.

Nykyiset skillit:
- [Chat-driven change workflow](docs/skills/chat-change-workflow.md)
- [AI coding operating system](docs/skills/ai-coding-operating-system.md)
- [AI Quality Gate](docs/AI-QUALITY-GATE.md)
- [AI prompt templates](docs/skills/ai-prompt-templates.md)

Periaate:
- [docs/specification.md](docs/specification.md) määrittää tuotteen suunnan ja päätökset.
- Skill-tiedostot määrittävät operatiivisen toteutusprosessin.

## 10. Reusable workflow kit uusiin projekteihin

Jotta sama AI-työtapa on helposti monistettavissa projektista toiseen, tässä repossa on valmis kit:

- [docs/workflow-kit/README.md](docs/workflow-kit/README.md)
- [docs/workflow-kit/COPY-CHECKLIST.md](docs/workflow-kit/COPY-CHECKLIST.md)
- [docs/workflow-kit/templates/specification.template.md](docs/workflow-kit/templates/specification.template.md)
- [docs/workflow-kit/templates/skills/chat-change-workflow.template.md](docs/workflow-kit/templates/skills/chat-change-workflow.template.md)
- [docs/workflow-kit/templates/skills/bugfix-workflow.template.md](docs/workflow-kit/templates/skills/bugfix-workflow.template.md)
- [docs/workflow-kit/templates/skills/release-workflow.template.md](docs/workflow-kit/templates/skills/release-workflow.template.md)
- [docs/workflow-kit/templates/skills/ai-coding-operating-system.template.md](docs/workflow-kit/templates/skills/ai-coding-operating-system.template.md)
- [docs/workflow-kit/templates/skills/ai-prompt-templates.template.md](docs/workflow-kit/templates/skills/ai-prompt-templates.template.md)
- [docs/workflow-kit/templates/pull_request_template.md](docs/workflow-kit/templates/pull_request_template.md)

Käyttöperiaate:
- Kopioi templates uuteen projektiin.
- Nimeä ne kohdepolkuihin (`docs/specification.md`, `docs/skills/*.md`, `.github/pull_request_template.md`).
- Täytä vain projektikohtaiset kohdat ja jatka samalla workflowlla.

## 11. Tuleva period 3 -siirtymä (suunnittelu, ei toteutusta vielä)

### 11.1 Aikataulu ja periodirajat

- Period 2 päättyy `2026-03-15 klo 10:00` Ruotsin aikaa (`11:00` Suomen aikaa).
- Käytännön sääntö: NHL-pelit, jotka pelataan illalla `2026-03-14`, kuuluvat vielä periodiin 2.
- Period 3 alkaa `2026-03-15` illan otteluilla.

### 11.2 Period 3 pisteasteikko

Period 3:ssa käytetään eri sijoituspisteitä kuin periodeissa 1-2:

- `30, 24, 19, 15, 12, 10, 8, 6, 4, 2, 1`

### 11.3 Datan hallinta periodille 3

- Ennen period 3:n ensimmäistä ottelua tarvitaan uusi period 3 Excel.
- Uusi Excel sisältää osallistujien uudet pelaajat periodia 3 varten.
- Nykyinen period 1+2 -kokonaisuus säilyy historiallisena vertailuna.

### 11.4 Sovellusvaikutukset ja tulevat muutostarpeet

1) Periodikonfiguraatio
- Periodit kannattaa mallintaa konfiguroitavina objekteina (aikaraja + pisteasteikko + käytettävä Excel).
- Aikavyöhykesääntö tulee pitää eksplisiittisenä (`Europe/Stockholm` periodirajalle).

2) Ställningen-näkymä
- Nykyinen `Period 2` + `Totalställning Period 1+2` toimii edelleen period 2 loppuun.
- Period 3 käyttöönotossa tarvitaan päätös näytetäänkö:
  - `Ställningen Period 3`, ja
  - `Totalställning Period 1+2+3`.

3) Admin- ja operointipolku
- Adminiin tarvitaan hallittu tapa vaihtaa aktiivinen periodi/Excel juuri oikealla hetkellä.
- Vaihdon jälkeen tulee pystyä varmistamaan, että `tipsen-summary` käyttää period 3 tiedostoa.

4) Ajastus ja readiness
- Päivittäinen auto refresh voi säilyä ennallaan.
- Periodirajan vaihto on erillinen operatiivinen toimenpide (ei pelkkä päivittäinen refresh).

### 11.5 Ennen toteutusta päätettävät asiat

- Tehdäänkö periodivaihto manuaalisena admin-toimena vai ajastettuna automaattivaihtona?
- Tarvitaanko käyttöliittymään näkyvä indikointi aktiivisesta periodista?
- Lukitaanko period 1+2 -kokonaispisteet period 3:n alkaessa erilliseksi snapshotiksi?

### 11.10 Backoffice: Period 3 joukkuevalidatori

Tavoite:
- Tarjota backoffice-käyttöön erillinen tarkistustyökalu, jolla validoidaan yhden osallistujan period 3 -joukkue kerrallaan ennen lukitusta.
- Ei osa julkista tuotantokäyttöliittymää.

Toteutus:
- API: `POST /api/period3/validate-team`
- Backoffice UI: `period3-validator.html` (+ `period3-validator.js`)
- Työkalu on admin-suojattu (ei julkinen näkymä)

#### Syöteformaatti (yksi osallistuja kerrallaan)

Tekstimuotoinen syöte kolmella pakollisella otsikolla:
- `Maalivahdit`
- `Puolustajat`
- `Hyökkääjät`

Pelaajarivi muodossa:
- `Nimi, JOUKKUE`

Esimerkki:

```text
Maalivahdit
Gibson, DET
Bussi, CAR

Puolustajat
Raddysh, TBL
Sanderson, OTT
Charlie McAvoy, BOS
Mattias Samuelsson, BUF

Hyökkääjät
Celebrini, SJS
Johnston, DAL
Crosby, PIT
Keller, UTA
Hagel, TBL
Hyman, EDM
```

Normalisointi:
- Joukkuekoodi normalisoidaan isoiksi kirjaimiksi (esim. `Det` -> `DET`).
- Tyhjät rivit sallitaan.

#### Validointisäännöt

Hard fail -säännöt:
- Roolijakauma on täsmälleen: 2 maalivahtia, 4 puolustajaa, 6 hyökkääjää.
- Maksimissaan 2 pelaajaa samasta nykyisestä NHL-joukkueesta kaikkien 12 pelaajan yli.
- Et voi valita pelaajaa, joka oli period 2:ssa jollakin toisella osallistujalla, ellei pelaaja ollut myös sinulla period 2:ssa.
- Ukkopelaajien sijaan sääntö koskee ulkopelaajia (puolustajat + hyökkääjät):
  - Rankingjakso: 7.10.2025 - 26.12.2025.
  - Rankingjärjestys: pisteet, tasatilanteessa tehdyt maalit.
  - Bandisääntö (1-10, 11-20, 21-30, ...):
    - Jos et käytä ylempää bandia, voit ottaa vastaavasti enemmän seuraavasta bandista.
    - Tarkistus voidaan ilmaista kumulatiivisena ehtona: bandeista 1..m valittujen määrä <= m.
- Maalivahtien rankingjakso: 7.10.2025 - 26.12.2025, ranking wins.
- Kahden maalivahdin rank-summan on oltava vähintään 30 (esim. #1 + #29 = 30 on sallittu).

Warning-sääntö:
- Jos pelaajaa ei löydy rankinglistasta, se ei kaada validointia mutta palautetaan warningina.

#### Tulostesopimus (backoffice)

- `PASS` kun yksikään hard fail -sääntö ei rikkoudu.
- `FAIL` kun vähintään yksi hard fail -sääntö rikkoutuu.
- `warnings` lista palautetaan aina erikseen (myös PASS-tilassa), esim. rankingista puuttuvat pelaajat.

Suositeltu raportointi:
- Roolijakauma
- NHL-joukkuekohtaiset määrät
- Period 2 omistusristiriidat
- Ulkopelaajien rankingbandijakauma
- Maalivahtien rank-summa

### 11.6 Muutosloki

- 2026-03-07
  - Dokumentoitu period 3 siirtymäsäännöt, pisteasteikko, tarvittava uusi Excel sekä ennakoidut sovellusmuutostarpeet
  - Ei vielä koodimuutoksia period 3 logiikkaan (toteutus myöhemmin lähempänä periodirajaa)
  - Lisätty period 3 go-live runbook operatiiviseen käyttöön: `docs/period3-go-live-runbook.md`

### 11.7 Operatiivinen runbook

- Period 3 vaihtotilanteen käytännön checklista: [docs/period3-go-live-runbook.md](docs/period3-go-live-runbook.md)
- Nopea D-day tarkistuslista (10 min): [docs/period3-d-day-checklist.md](docs/period3-d-day-checklist.md)

### 11.8 D-day quick checklist

- Tiivis yhden sivun tarkistuslista julkaisuhetkeen:
  - `docs/period3-d-day-checklist.md`

### 11.9 Muutosloki (docs)

- 2026-03-07
  - Lisätty period 3 D-day quick checklist (`docs/period3-d-day-checklist.md`) nopeaan julkaisuhetken käyttöön
  - Lisätty loukkaantumisindikaattori Lagen-näkymän pelaajariveille (punainen nimi + arvioitu paluuaika), datalähteenä ESPN NHL injuries

- 2026-03-14
  - Period 3 validator UX-parannus: ulkopelaajien bandisääntö-virhe kertoo nyt myös mitkä pelaajat (nimi, joukkue, rank) aiheuttavat rikkeen
  - Toteutettu backoffice period 3 joukkuevalidatori: uusi admin-suojattu sivu `period3-validator.html` ja endpoint `POST /api/period3/validate-team`
  - Validatori toteuttaa syöteparserin (`Maalivahdit`/`Puolustajat`/`Hyökkääjät`) ja säännöt: 2G/4D/6F, max 2 per NHL-joukkue, period2 omistusrajoite, ulkopelaajien bandisääntö sekä maalivahtien rank-summa >= 30
  - Rankingista puuttuvat pelaajat palautetaan warningeina (ei hard fail)
  - Määritelty backoffice-käyttöön period 3 joukkuevalidatorin syöteformaatti, sääntöjoukko ja PASS/FAIL + warnings tulostesopimus (ei kooditoteutusta)
