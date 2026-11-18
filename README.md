# War Room ™ (pending)

De gedeelde projecttool voor de challenge **de revolutie van AI in het onderwijs**: 10 studenten, 3 docenten en 3 afdelingen (Centraal Team, Research, Creator & Development).

**Site:** https://fabianb88.github.io/war-room/

## Wat kan het?

| Onderdeel | Wat |
|---|---|
| **Start** | Projectrichting en DoD, totale voortgang, voortgang van je eigen afdeling, waar elk team mee bezig is, open vragen, en nieuw sinds je vorige bezoek |
| **Taken** | Bord met de kolommen *Te doen → Bezig → Ter review → Klaar*. Elke taak heeft een verantwoordelijke, afdeling en deadline. Je plaatst voortgangsupdates met documenten, en anderen kunnen reageren. Bij *Klaar* vraagt de tool of de taak aan de DoD voldoet. |
| **Vragen** | Vragen aan een afdeling. Ze staan open tot iemand ze als beantwoord markeert. |
| **Besluiten** | Genomen besluiten met onderbouwing en datum |
| **Documenten** | Echte uploads, volledig downloadbaar. De AI maakt een samenvatting, kernpunten, tags, het brontype, de betrouwbaarheid en de onzekerheden. Een teamlid kan de samenvatting als *gecontroleerd* markeren. |
| **Richting & DoD** | Het Centraal Team legt richting, definition of done en mijlpalen vast. Elke wijziging komt in de geschiedenis. |

Alles is terug te volgen: elke taak, vraag en besluit is een GitHub-issue met een volledige tijdlijn.

## Hoe het werkt

- **Taken, vragen, besluiten, richting en reacties** zijn GitHub Issues in deze repo. Ze zijn direct zichtbaar voor iedereen.
- **Uploads** komen via de site in `inbox/`. Een GitHub Action leest ze, laat de AI ze samenvatten en zet ze in `site/bestanden/<afdeling>/`. Ook komt er een document-issue om op te reageren. Hoort een upload bij een taak, dan komt de samenvatting als reactie bij die taak. Dit duurt ongeveer 1 à 2 minuten.
- **De AI** draait via **Claude Code op je Claude-abonnement**, dus zonder API-kosten. Zonder AI-token werkt alles ook, alleen zonder samenvattingen.

## Opzetten (beheerder, eenmalig)

De repo, de labels en de site zijn al aangemaakt. Er zijn nog twee stappen.

### 1. Teamcode maken (± 3 min)
Ga naar https://github.com/settings/personal-access-tokens/new:
- *Token name*: `war-room-team`. *Expiration*: einde van de challenge.
- *Repository access*: **Only select repositories**, en kies dan `FabianB88/war-room`.
- *Permissions → Repository permissions*:
  - **Contents**: Read and write
  - **Issues**: Read and write

Deel deze code **alleen privé** met de 13 deelnemers, bijvoorbeeld in de Teams-chat. Iedereen vult hem één keer in onder *Wie ben je?*. Lekt de code toch uit, trek hem dan in en maak een nieuwe.

> Alles wordt op GitHub geplaatst onder het account van de beheerder. Wie iets plaatste, staat in de tool zelf, want iedereen vult zijn naam in. Echte inlog per persoon kan later nog.

### 2. AI-samenvattingen aanzetten via je abonnement (± 2 min)
In een terminal (Node.js nodig):
```bash
npx @anthropic-ai/claude-code setup-token
```
Log in met je Claude-account en kopieer de token die verschijnt. Zet hem daarna als secret in de repo:
```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN -R FabianB88/war-room
```
Plak daar de token. Dit vereist een Claude Pro- of Max-abonnement. Liever de betaalde API gebruiken? Zet dan in plaats daarvan het secret `ANTHROPIC_API_KEY`.

## Dagelijks gebruik
- **Mislukte samenvatting** (label "nog niet samengevat"): ga naar *Actions → Run workflow* en vink **herstel** aan.
- **Afdelingen, types of statussen aanpassen:** doe dat in `site/data/config.json`.
- **Alles lokaal hebben:** `git pull`.

## Grenzen (v1)
- Max 50 MB per bestand. De AI leest PDF, Word, PowerPoint, Excel en tekstbestanden, en de pagina achter een link (als die openbaar is).
- De repo is **openbaar**: alle uploads zijn voor iedereen met de link te zien. Upload dus geen privacygevoelige stukken.
- Voortgang = het aandeel taken met status *Klaar* (voorlopig, zoals afgesproken).
- Nog niet besloten en dus nog niet gebouwd: echte inlog per persoon, beheerrechten, meldingen en het goedkeuren van werk door een ander.

## Veiligheid
- De AI krijgt **geen gereedschap**: hij kan alleen de tekst lezen die het script hem geeft. Hij draait in een lege map, zonder andere geheimen in de buurt. Instructies in documenten worden genegeerd en gemeld.
- De workflow controleert eerst een **vingerafdruk** van `scripts/verwerk_inbox.py` en `scripts/requirements.txt`. Is één van beide aangepast, dan stopt de run voordat de Claude-token beschikbaar is. De teamcode kan de workflow zelf niet wijzigen, want daarvoor mist hij het recht *Workflows*.
- **Script bewust aangepast?** Werk dan de hashes in `.github/workflows/verwerk.yml` bij met `git show :scripts/verwerk_inbox.py | sha256sum` (en hetzelfde voor `requirements.txt`). Doe dat met je eigen GitHub-login, niet met de teamcode.
- **Teamcode gelekt?** Trek hem in op https://github.com/settings/personal-access-tokens en maak een nieuwe. Je Claude-token trek je in via je Claude-account. Maak daarna een nieuwe met `claude setup-token`.
