# Onderwijs opnieuw ontwerpen met AI

E-learning voor hbo-docenten: van **AI-vaardig** naar **AI-didactisch vaardig**, en daarmee onderwijs opnieuw ontwerpen. Dit is een concept: de structuur staat, de inhoud is een eerste invulling die we vervangen door echte content.

**Online:** https://fabianb88.github.io/ai-didactisch-vaardig/

## Bestanden

| Bestand | Wat |
| --- | --- |
| `ai-didactisch-vaardig.json` | **Het bouwbestand.** Open het in de [E-learning Bouwer](https://fabianb88.github.io/elearning-bouwer/) via *Openen* en bewerk daar verder. |
| `index.html` | De e-learning als één webpagina; dit is wat online staat. |

## Bijwerken

1. Open `ai-didactisch-vaardig.json` in de bouwer en pas de inhoud aan.
2. Exporteer als **Webpagina** en sla die op als `index.html` in deze map (overschrijven). Exporteer ook het **Bouwbestand** opnieuw als `ai-didactisch-vaardig.json`, en zo nodig het SCORM-pakket in `export/`.
3. Commit en push. GitHub Pages zet de nieuwe versie binnen een minuut of twee online.
| `export/onderwijs-opnieuw-ontwerpen-met-ai-scorm.zip` | SCORM 1.2-pakket voor Brightspace of een ander LMS. |
| `_bron/maak_cursus.py` | Script waarmee de eerste versie is gemaakt. Zodra je in de bouwer werkt, is het bouwbestand de bron en heb je dit script niet meer nodig. |

## Opbouw

Drie lagen, acht competenties (uit het rapport *Minimale AI-competenties voor hbo-docenten*). De docent werkt de hele e-learning aan één eigen les, opdracht of toets.

| Module | Laag | Competentie |
| --- | --- | --- |
| Start: waarom deze e-learning? (instapopdracht, zelfscan) | | |
| 1. AI begrijpen en bewust kiezen | AI-vaardig | 1, 2 |
| 2. Instructies geven en resultaten controleren | AI-vaardig | 2, 3 |
| 3. Gegevens, ethiek en gelijke toegang | AI-vaardig | 4 |
| 4. Wat weten we echt? Het onderzoek | AI-didactisch | (onderbouwing) |
| 5. Leeractiviteiten ontwerpen met AI | AI-didactisch | 5 |
| 6. Onderwijs herontwerpen: de placemat-methode | AI-didactisch | 5 |
| 7. Toetsing en bewijs van beheersing | AI-didactisch | 6 |
| 8. Studenten begeleiden bij zelfstandig oordelen | AI-didactisch | 7 |
| 9. Blijven leren en je herontwerp afronden | Herontwerpen | 8 |
| Bronnen en verantwoording | | |

Elke module: leerdoelen → uitleg → direct oefenen (meerkeuze, koppelen, sorteren, scenario) → praktijkopdracht in de eigen les → koppeling met het "aantoonbaar minimum" van de competentie.

## Nog invullen

Zoek in de bouwer op blokken met de titel **Nog invullen**. Daar komen onder meer:

- kennisclips (maximaal zes minuten), in de start en in module 4;
- een foutvoorbeeld uit een eigen vakgebied (module 2);
- de juiste downloadlocatie van de AI-placemats en de docentinstructie (module 6), en de keuze of de Food & Business-placemat het voorbeeld blijft;
- informatie over de edubadge en het inleveren van het portfolio (module 9).

## Al ingevuld (16 november 2026)

- **HAN-links** in module 3 en 7: de pagina Onderwijs met AI, het Integraal AI-kader, de Toolkit AI-bestendig toetsen, de APA-uitleg voor AI-tools en de AI-desk. Gecontroleerd op 16 november 2026. Voor andere instellingen vervangen.
- **Klikplaat van placemat 5 (E-learning)** in module 6, met zeven uitlegpunten, plus de achterkant als afbeelding. De beelden staan in `_bron/beeld/`.
- **Conceptrubric** in module 9: vier niveaus per competentie, met "voldoende" gelijk aan het aantoonbare minimum uit het rapport. Moet nog met docenten worden gekalibreerd.
- **Gecontroleerde kaders:**
  - AI Assessment Scale: de vijf niveaus zijn die van de herziene versie (Perkins e.a., 2024, arXiv 2412.09029), uitdrukkelijk zonder rangorde.
  - Mollick & Mollick (2023): de zeven rollen mentor, tutor, coach, teamgenoot, student, simulator en gereedschap.
  - Tweesporenaanpak van de University of Sydney: spoor 1 is beveiligd en betekent niet per se "geen AI"; in spoor 2 wordt AI niet verboden.

Controleer bij het invullen van echte content alle cijfers en bronnen opnieuw. De competenties en de lesopzet zijn een ontwerpvoorstel dat in een pilot getoetst moet worden.
