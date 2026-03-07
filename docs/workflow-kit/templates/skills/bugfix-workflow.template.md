# Skill: Bugfix workflow

Tämä skill on nopeisiin mutta hallittuihin bugikorjauksiin.

## 1) Triggeri

Käytä kun:
- käyttäjä raportoi virheen
- testi rikkoutuu
- tuotannossa on regressio

## 2) Vaiheet

1. Rajaa bugi
   - mikä hajoaa, missä tilanteessa, miten toistetaan
2. Vahvista juurisyy
   - vältä oireen paikkausta ilman syyn varmistusta
3. Korjaa mahdollisimman pienellä muutoksella
4. Aja kohdistettu testi/smoke
5. Päivitä `docs/specification.md` muutoslokiin
6. Commit ja push (Fast/Safe projektin käytännön mukaan)

## 3) Raportointimalli

- Root cause:
- Fix:
- Validation:
- Riskit:
- Rollback:

## 4) DoD

- Bugi toistettu ennen korjausta
- Korjaus validoitu
- Ei sivuvaikutuksia tunnetuissa kriittisissä poluissa
