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

- Fast: pieni, matalariskinen muutos
- Safe: API/UI/infra-laaja tai epävarma muutos

## 5) Anti-patternit

- liian laaja prompti
- validoinnin skippaus
- dokumentoinnin unohtaminen
