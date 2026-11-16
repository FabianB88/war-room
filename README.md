# War Room ™ (pending)

Eén plek waar alle kennis van de War Room samenkomt. Challenge: **de revolutie van AI in het onderwijs**.

- **Insturen** gaat direct op de site: een bestand slepen, een link plakken of een notitie typen.
- **AI vat het samen**: titel, samenvatting, kernpunten, type, tags en wat het betekent voor de challenge.
- **Gesorteerd per afdeling**: Creator & Development, Research en het Centraal Team.
- **Doorzoekbaar en filterbaar** op afdeling, type, tag en datum.
- **Alle bestanden blijven volledig downloadbaar**, zowel op de site als in de repo.

## Hoe het werkt

```
 Site (GitHub Pages)            GitHub-repo                         GitHub Action
 ───────────────────            ───────────                         ─────────────
 Formulier "Insturen"  ──────►  inbox/<id>/meta.json + bestanden ─► scripts/verwerk_inbox.py
                                                                     • leest PDF/Word/PPT/Excel/
                                                                       afbeeldingen/tekst + link
                                                                     • Claude vat samen + sorteert
 Overzicht + downloads ◄──────  site/data/items.json             ◄── • bestanden → site/bestanden/<afdeling>/
                                site/bestanden/<afdeling>/…          • samenvatting → afdelingen/<afdeling>/
                                afdelingen/<afdeling>/*.md           • site opnieuw gepubliceerd
```

Een inzending staat 1 à 2 minuten na het insturen op de site.

## Mappen

| Map | Wat staat er |
|---|---|
| `site/` | De website (overzicht + insturen) |
| `site/data/config.json` | Afdelingen, types, challenge-naam: **hier pas je dingen aan** |
| `site/data/items.json` | Alle verwerkte inzendingen (wordt automatisch bijgewerkt) |
| `site/bestanden/<afdeling>/<id>/` | De originele bestanden, volledig downloadbaar |
| `afdelingen/<afdeling>/` | Per inzending een samenvattingspagina + `README.md` overzicht per afdeling |
| `inbox/` | Wachtrij; wordt automatisch leeggemaakt |
| `scripts/verwerk_inbox.py` | Het verwerkscript |

## Eenmalig opzetten (± 15 minuten)

1. **Repo aanmaken.** Maak op GitHub een nieuwe repository, bijvoorbeeld `war-room`, en zet de inhoud van deze map erin:
   ```bash
   git init && git add -A && git commit -m "War Room" && git branch -M main
   git remote add origin https://github.com/<jouw-naam>/war-room.git && git push -u origin main
   ```
   *Openbaar of privé?* Bij een openbare repo is alles (ook de bestanden) voor iedereen te zien. Een privé-repo met een site werkt alleen met GitHub Pro. Studenten krijgen Pro gratis via het [GitHub Student Developer Pack](https://education.github.com/pack).

2. **Pages aanzetten.** Ga in de repo naar *Settings → Pages* en kies bij *Source* de optie **GitHub Actions**.

3. **AI-sleutel toevoegen.** Maak een API-sleutel aan op [console.anthropic.com](https://console.anthropic.com). Ga daarna naar *Settings → Secrets and variables → Actions → New repository secret*, met naam `ANTHROPIC_API_KEY` en als waarde de sleutel.
   Zonder sleutel werkt alles ook, maar dan zonder samenvatting.

4. **Teamcode maken.** Dit is de sleutel waarmee de site in de repo mag schrijven.
   *GitHub → je profiel → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*:
   - *Repository access*: **Only select repositories**, en kies dan alleen `war-room`.
   - *Permissions → Repository permissions → Contents*: **Read and write**.
   - Kies een vervaldatum, bijvoorbeeld het einde van de challenge.

   Deel deze code **alleen privé** met het team, bijvoorbeeld in Teams of WhatsApp, en zet hem nooit in de repo. Iedereen vult hem één keer in onder *Insturen → Teamcode*. Wie de code heeft, kan alleen in deze ene repo schrijven. Lekt de code toch uit, trek hem dan in en maak een nieuwe.

5. **Eerste run.** Ga naar *Actions → "Inzendingen verwerken en site publiceren" → Run workflow*. Daarna staat de site op
   `https://<jouw-naam>.github.io/war-room/`.

## Dagelijks gebruik

- **Insturen:** op de site, via *+ Insturen*. Naam en afdeling zijn verplicht, de rest mag. Je kunt meerdere bestanden tegelijk sturen, of een screenshot plakken met Ctrl+V.
- **Via GitHub zelf:** zet een bestand in `inbox/research/`, `inbox/creator-development/` of `inbox/centraal/`. Elk bestand wordt een eigen inzending.
- **Mislukte samenvatting** (rood label "nog niet samengevat"): ga naar *Actions → Run workflow* en vink **herstel** aan.
- **Alles lokaal hebben:** met `git pull` staat alles, inclusief bestanden, ook op je eigen pc.
- **Afdelingen of types aanpassen:** bewerk `site/data/config.json`. Geef een nieuwe afdeling een kleur in `site/style.css` (`--afd-<id>`).

## Kosten

Het samenvatten gebeurt met Claude Opus 5.5. Een notitie of link kost ongeveer € 0,01, een PDF van 20 pagina's zo'n € 0,10 à € 0,20. GitHub zelf is gratis, met wel een limiet van ongeveer 1 GB voor de site. Grote video's kun je dus beter als link delen.

## Grenzen

- Max 50 MB per bestand (instelbaar in `config.json`; GitHub accepteert tot 100 MB).
- De AI leest PDF's tot 20 MB en afbeeldingen tot 5 MB. Grotere bestanden zijn wel downloadbaar, maar worden alleen op basis van de notitie samengevat. Dat staat er dan bij.
- Een link wordt alleen gelezen als de pagina zonder inloggen te openen is.
