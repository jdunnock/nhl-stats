# Skill: AI coding operating system

Kopioi tämä tiedosto uuden projektin `docs/skills/`-kansioon.

## 1) Oletusprosessi

1. Scope ensin (`in/out`)
2. Spec update
3. Rajattu toteutus
4. Kohdistettu validointi
5. Raportointi + riskit + rollback

## 2) Prompt minimi

Anna aina:
- Goal
- Constraints
- Acceptance criteria
- Context files

## 3) Merge gate

Ennen mergeä varmista:
- scope
- correctness
- validation
- security
- docs

## 4) Moodit

- Oletus: Safe (feature-branch + PR)
- Fast: vain poikkeuksena kriittinen hotfix, erikseen hyväksyttynä

Tuotannossa suositus:
- Auto Deploy seuraa vain main-branchia
- Wait for CI päällä
- Main suojattu (PR + required checks + review)

## 5) Anti-patternit

- liian laaja prompti
- validoinnin skippaus
- dokumentoinnin unohtaminen
