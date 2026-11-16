# Haalbaarheid en bias-risico's van AI-beoordeling van mondelinge opnames

**Afdeling:** Creator & Development · **Type:** Idee · **Datum:** 2026-11-16 · **Ingestuurd door:** Fabian

**Tags:** `ai-in-hoger-onderwijs`, `bewijskwaliteit`, `hbo`, `privacy`, `toetsing`

**Ook relevant voor:** Centraal Team, Research

## Samenvatting

Fabian geeft een eigen inschatting van of een AI-systeem opnames (mondelinge toetsen, presentaties) kan beoordelen en of dat zonder bias kan. Conclusie: technisch is beoordelen goed haalbaar, maar een systeem zonder bias niet, omdat 'geen bias' niet eenduidig te definiëren is; wel kan een systeem aantoonbaar eerlijker en consistenter zijn dan menselijke beoordeling. De tekst beschrijft biasbronnen (accent, opnamekwaliteit, video, rubric), uitsluitende eerlijkheidsdefinities, dataproblemen (AVG), regelgeving (EU AI Act, AVG art. 22) en de Nederlandse context. Het advies is AI te gebruiken als tweede beoordelaar, formatief en met lage inzet, bij voorkeur op alleen audio of transcript.

## Kernpunten

- Technisch haalbaar: spraak-naar-tekst werkt goed (ook Nederlands), taalmodellen kunnen transcripten langs een rubric scoren en komen op inhoud vaak dicht bij twee menselijke beoordelaars; een prototype voor één vaardigheid kost weken tot maanden.
- Biasbronnen: slechtere spraakherkenning bij niet-moedertaalsprekers, regionale accenten en stotteren; opnamekwaliteit (gekoppeld aan sociaaleconomische achtergrond); uiterlijk bij video; stijl versus inhoud; culturele normen in de rubric (consistent is niet gelijk aan eerlijk).
- Eerlijkheidsdefinities (gelijke gemiddelden, gelijke foutmarges, gelijke betekenis van een score) zijn wiskundig niet tegelijk te halen; kiezen is een politieke en onderwijskundige keuze.
- Bias meten vereist gevoelige gegevens (bijv. migratieachtergrond), bijzondere persoonsgegevens onder de AVG; de AI Act staat verwerking voor bias-detectie onder strikte voorwaarden toe.
- Wetgeving: beoordeling van leerresultaten is hoog risico onder de EU AI Act (verplichtingen 2026–2027, uitstel voorgesteld); emotieherkenning in het onderwijs is sinds feb. 2025 verboden; AVG art. 22 vereist betekenisvolle menselijke tussenkomst.
- Realistische inschatting: prototype voor één vaardigheid in maanden; gevalideerd en op bias getoetst 1–2 jaar met grote, diverse, dubbel beoordeelde dataset; landelijk vele jaren en tientallen miljoenen.
- Advies: AI als tweede beoordelaar die afwijkingen signaleert, alleen audio/transcript, eerst ASR-fouten per groep meten, starten formatief; vergelijk met menselijke bias, die niet auditbaar is, terwijl AI wel auditbaar is.

## Wat betekent dit voor de challenge?

Biedt een afgewogen kader voor elk idee of prototype dat mondelinge prestaties beoordeelt: begin klein, formatief en met menselijke tussenkomst, en neem wet- en biasaspecten vanaf het begin mee. Het Centraal Team kan hiermee richting bepalen of een AI-tweede-beoordelaar of oefenfeedback-tool een haalbare uitwerking van de challenge is.

## Bron

**Soort:** expertstandpunt · **Betrouwbaarheid:** middel

Inhoudelijk consistent met bekende thema's en door een teamlid geschreven, maar zonder bronverwijzingen of cijfers en niet onafhankelijk getoetst.

## Onzekerheden en betwiste punten

Er zijn geen bronnen of onderzoeken genoemd voor claims zoals 'dicht bij twee menselijke beoordelaars', ASR-fouten per groep, TOEFL/Duolingo of de tijds- en kostenramingen (maanden, 1–2 jaar, tientallen miljoenen); deze zijn schattingen. De ingangsdata van de AI Act zijn onzeker door voorgesteld uitstel en moeten worden nagecheckt. De uitwerking voor een concrete context (minor, presentaties) is nog niet gedaan.

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
