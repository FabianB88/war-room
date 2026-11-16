# Haalbaarheid en bias-risico's van AI-beoordeling van mondelinge opnames

**Afdeling:** Creator & Development · **Type:** Idee · **Datum:** 2026-11-16 · **Ingestuurd door:** Fabian

**Tags:** `ai-in-hoger-onderwijs`, `bewijskwaliteit`, `hbo`, `privacy`, `toetsing`

**Ook relevant voor:** Research, Centraal Team

## Samenvatting

Een expertinschatting van Fabian over de vraag of AI mondelinge opnames (audio/video) van studenten kan beoordelen. De conclusie: technisch is een beoordelingssysteem haalbaar, een systeem zonder bias niet, omdat 'geen bias' niet goed te definiëren is. Wel kan een systeem aantoonbaar eerlijker en consistenter zijn dan menselijke beoordeling. De notitie beschrijft bronnen van bias, juridische kaders (AI Act, AVG), de Nederlandse context en een realistische tijdlijn, en eindigt met aanbevelingen zoals AI als tweede beoordelaar en starten met formatieve toepassingen.

## Kernpunten

- Spraak-naar-tekst werkt goed in het Nederlands en een rubric-gebaseerde beoordeling door taalmodellen komt op inhoud vaak dicht bij de overeenstemming tussen twee menselijke beoordelaars; een prototype voor één vak kost weken tot maanden.
- Biasbronnen: spraakherkenning maakt meer fouten bij accenten, dialecten, niet-moedertaalsprekers en stotteren; opnamekwaliteit hangt samen met sociaaleconomische achtergrond; bij video kunnen uiterlijk en kleding meewegen; de rubric zelf kan culturele normen bevatten.
- Er bestaan meerdere, onderling onverenigbare definities van 'eerlijk' (gelijke gemiddelden, gelijke foutmarges, gelijke betekenis van een score); kiezen is een politieke en onderwijskundige keuze.
- Bias meten vereist gevoelige gegevens (bv. migratieachtergrond), wat onder de AVG bijzondere persoonsgegevens zijn; de AI Act staat dit onder strikte voorwaarden toe voor bias-detectie.
- Wetgeving: AI die leerresultaten beoordeelt is hoog risico onder de AI Act (verplichtingen gaan in 2026–2027, uitstel voorgesteld); emotieherkenning in het onderwijs is sinds februari 2025 verboden; AVG art. 22 vereist betekenisvolle menselijke tussenkomst.
- Tijdlijn: prototype voor één vaardigheid in maanden; gevalideerd en op bias getoetst 1–2 jaar met grote diverse dataset met minstens twee menselijke beoordelaars; landelijk en juridisch in orde vele jaren en tientallen miljoenen.
- Aanbevelingen: AI als tweede beoordelaar die afwijkingen signaleert, alleen audio of transcript gebruiken, spraakherkenningsfouten per groep meten, formatief en laag-inzet beginnen, en vergelijken met menselijke beoordeling in plaats van met perfectie.

## Wat betekent dit voor de challenge?

Geeft het team een nuchter kader om te bepalen of en hoe AI-beoordeling van mondelinge toetsen in de challenge kan worden voorgesteld: als tweede beoordelaar en formatief, niet als rechter. De juridische en bias-punten zijn direct bruikbaar voor risicoparagrafen en voor het scherp afbakenen van een concreet voorstel.

## Bron

**Soort:** expertstandpunt · **Betrouwbaarheid:** middel

Een goed gestructureerde persoonlijke inschatting zonder bronverwijzingen of cijfers, van een teamlid zonder aantoonbaar belang.

## Onzekerheden en betwiste punten

Geen bronnen genoemd; claims over modelprestaties (dicht bij menselijke beoordelaars), commerciële systemen (TOEFL, Duolingo) en de tijdlijn/kosten zijn niet onderbouwd en moeten geverifieerd worden. De ingangsdata van de AI Act-verplichtingen zijn onzeker door voorgesteld uitstel; de actuele stand moet gecheckt worden. De claim over het DUO-algoritme is niet met bron onderbouwd. De uitwerking voor een concrete context (bv. minor of presentaties) is aangeboden maar nog niet gedaan.

## Notitie van de indiener

Kort antwoord: een systeem dat opnames beoordeelt kun je met de huidige AI technisch best bouwen. Een systeem zonder bias kun je niet bouwen. Dat ligt niet aan de stand van de techniek: “geen bias” is als doel niet goed te definiëren. Wat wel kan, is een systeem dat aantoonbaar eerlijker en consistenter is dan de huidige menselijke beoordeling. Ook dat is een groot project, en het moeilijkste deel is niet de AI.

Wat nu al goed kan
Spraak naar tekst werkt goed, ook in het Nederlands.
Beoordelen aan de hand van een rubric: taalmodellen kunnen een transcript langs criteria leggen en hun score onderbouwen. Op inhoud (klopt de redenering, worden de goede begrippen gebruikt, is de opbouw logisch) komen ze vaak dicht bij twee menselijke beoordelaars onderling.
Smalle, goed gedefinieerde vaardigheden, zoals spreekvaardigheid op ERK/CEFR-niveau. Daarvoor bestaan al commerciële systemen, bijvoorbeeld bij TOEFL en Duolingo English Test.

Een werkend prototype voor één vak of vaardigheid bouw je in weken tot maanden.

Waar het moeilijk wordt

1. Waar de bias vandaan komt

Accent en dialect: spraakherkenning maakt aantoonbaar meer fouten bij niet-moedertaalsprekers, regionale accenten en mensen die stotteren. Dan wordt al een slechter transcript beoordeeld voordat er iets gescoord is.
Opnamekwaliteit: een slechte microfoon of een rumoerig huis hangt samen met sociaaleconomische achtergrond.
Video: uiterlijk, huidskleur en kleding kunnen meewegen, ook als niemand dat zo bedoeld heeft.
Stijl versus inhoud: is iemand die rustig en direct praat beter, of past die alleen beter bij de norm in de trainingsdata en de rubric?
De rubric zelf: als die culturele normen bevat, voert de AI die perfect consistent uit. Consistent is dan niet hetzelfde als eerlijk.

2. “Eerlijk” kent meerdere definities die elkaar uitsluiten
Gelijke gemiddelde scores per groep, gelijke foutmarges per groep of gelijke betekenis van een score per groep: die kun je wiskundig niet allemaal tegelijk halen. Je moet dus kiezen, en dat is een politieke en onderwijskundige keuze, geen technische.

3. Om bias te meten heb je gevoelige gegevens nodig
Je kunt alleen controleren of het systeem studenten met een migratieachtergrond benadeelt als je die achtergrond kent. Onder de AVG zijn dat bijzondere persoonsgegevens. De AI Act staat het verwerken daarvan voor bias-detectie onder strikte voorwaarden toe, maar het blijft juridisch en maatschappelijk gevoelig.

4. Wetgeving

Onder de EU AI Act valt AI die leerresultaten beoordeelt in de categorie hoog risico. Dat brengt verplichtingen mee: risicomanagement, eisen aan datakwaliteit, menselijk toezicht, documentatie, een conformiteitsbeoordeling en registratie. Deze verplichtingen gaan in 2026–2027 in; er is uitstel voorgesteld, dus check de actuele datum.
Emotieherkenning in het onderwijs is sinds februari 2025 verboden. Het systeem mag dus niet afleiden of een student “zeker” of “zenuwachtig” overkomt.
Volgens AVG artikel 22 mag een student niet zonder betekenisvolle menselijke tussenkomst alleen door een algoritme beoordeeld worden.

5. De Nederlandse context
Na het DUO-algoritme dat studenten met een migratieachtergrond vaker als fraudeur aanmerkte, en na de toeslagenaffaire, is het draagvlak voor een landelijk beoordelingsalgoritme klein. Bij het eerste incident ligt het hele project stil.

Realistische inschatting
Ambitie	Haalbaarheid
Prototype voor één vaardigheid	Maanden, goed te doen
Betrouwbaar voor één vaardigheid, gevalideerd en op bias getoetst	1–2 jaar, met een grote, diverse dataset die door minstens twee mensen beoordeeld is
Landelijk, voor meerdere vakken, juridisch in orde en breed geaccepteerd	Vele jaren en tientallen miljoenen, plus een governance-structuur

Het meeste werk zit in het definiëren van wat “niveau” is, in data verzamelen en labelen, in validatie, in bezwaarprocedures en in draagvlak. Het model zelf is het makkelijke deel.

Wat ik zou doen
AI als tweede beoordelaar, niet als rechter. Laat het systeem afwijkingen signaleren: “deze docent scoort structureel lager bij groep X” of “deze score wijkt sterk af, kijk nog eens.” Daar win je het meest aan eerlijkheid, met het minste risico.
Alleen audio, of zelfs alleen het transcript. Dan valt uiterlijk als bron van bias helemaal weg.
Meet per groep hoeveel fouten de spraakherkenning maakt voordat je ook maar iets beoordeelt.
Begin formatief en met lage inzet, bijvoorbeeld als oefenfeedback voor studenten, en niet met diploma’s of selectie.
Vergelijk met de werkelijkheid, niet met perfectie. Menselijke beoordelaars hebben ook bias, alleen is die onzichtbaar en niet te meten. Een AI-systeem kun je wel auditen. Dat is het sterkste argument vóór zo’n systeem.

Als je wilt, kan ik dit uitwerken voor een concrete context, bijvoorbeeld mondelinge toetsen in een minor of presentaties bij een opleiding. Dan wordt het een stuk concreter wat haalbaar is.
