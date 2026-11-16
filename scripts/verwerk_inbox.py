#!/usr/bin/env python3
"""War Room - verwerkt nieuwe inzendingen.

Elke inzending staat als map in inbox/ (zo schrijft de site hem weg):

    inbox/<id>/meta.json      naam, afdeling, type, titel, notitie, link
    inbox/<id>/<bestanden>    de geuploade bestanden

Wie via GitHub zelf iets uploadt, kan ook losse bestanden in
inbox/<afdeling-id>/ zetten (bv. inbox/research/paper.pdf). Elk bestand wordt
dan een eigen inzending.

Per inzending:
  1. Claude leest de notitie, de bestanden en de link en maakt een titel,
     samenvatting, kernpunten, type en tags.
  2. De bestanden gaan naar site/bestanden/<afdeling>/<id>/ (downloadbaar op de site).
  3. Er komt een samenvattingspagina in afdelingen/<afdeling>/.
  4. site/data/items.json en de afdelings-overzichten worden bijgewerkt.

Zonder ANTHROPIC_API_KEY werkt alles ook, maar dan zonder AI-samenvatting.
Met --herstel worden items zonder AI-samenvatting alsnog samengevat.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import os
import re
import secrets
import shutil
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "inbox"
SITE = ROOT / "site"
DATA = SITE / "data"
BESTANDEN = SITE / "bestanden"
AFDELINGEN = ROOT / "afdelingen"

MODEL = "claude-opus-5-5"
MAX_TEKENS_PER_BRON = 300_000          # ~75k tokens tekst per bestand
MAX_PDF_BYTES = 20 * 1024 * 1024       # request-limiet is 32 MB (base64 maakt het ~1/3 groter)
MAX_AFBEELDING_BYTES = 5 * 1024 * 1024
MAX_PDF_TOTAAL = 22 * 1024 * 1024      # alle PDF's + afbeeldingen samen in één request

TEKST_EXT = {".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml", ".py", ".js", ".ts", ".yaml", ".yml", ".tex", ".rtf"}
AFBEELDING_MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp"}


# --------------------------------------------------------------------------- helpers

def laad_json(pad: Path, standaard):
    try:
        return json.loads(pad.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return standaard


def schrijf_json(pad: Path, data) -> None:
    pad.parent.mkdir(parents=True, exist_ok=True)
    pad.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def veilige_naam(naam: str) -> str:
    naam = Path(naam).name
    naam = re.sub(r"[^\w.\- ()]+", "_", naam, flags=re.UNICODE).strip(" .")
    return naam[:120] or "bestand"


def slug(tekst: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", tekst.lower()).strip("-")
    return s[:60] or "inzending"


def nieuw_id() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d-%H%M%S") + "-" + secrets.token_hex(2)


def nu_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def log(*args) -> None:
    print(*args, flush=True)


class _TekstUitHtml(HTMLParser):
    def __init__(self):
        super().__init__()
        self.delen: list[str] = []
        self._skip = 0
        self.titel = ""
        self._in_titel = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg", "nav", "footer"):
            self._skip += 1
        if tag == "title":
            self._in_titel = True

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg", "nav", "footer") and self._skip:
            self._skip -= 1
        if tag == "title":
            self._in_titel = False
        if tag in ("p", "div", "br", "li", "h1", "h2", "h3", "h4", "tr", "section", "article"):
            self.delen.append("\n")

    def handle_data(self, data):
        if self._in_titel:
            self.titel += data
        if not self._skip:
            self.delen.append(data)

    def tekst(self) -> str:
        t = "".join(self.delen)
        t = re.sub(r"[ \t\r\f\v]+", " ", t)
        return re.sub(r"\n\s*\n+", "\n\n", t).strip()


def html_naar_tekst(html: str) -> tuple[str, str]:
    p = _TekstUitHtml()
    p.feed(html)
    return p.titel.strip(), p.tekst()


# --------------------------------------------------------------------------- bronnen lezen

class Bronnen:
    """Verzamelt content-blokken voor Claude en houdt bij wat niet (volledig) gelezen kon worden."""

    def __init__(self):
        self.blokken: list[dict] = []
        self.opmerkingen: list[str] = []
        self._binair = 0

    def tekst(self, titel: str, tekst: str) -> None:
        tekst = tekst.strip()
        if not tekst:
            self.opmerkingen.append(f"{titel}: geen leesbare tekst gevonden")
            return
        if len(tekst) > MAX_TEKENS_PER_BRON:
            self.opmerkingen.append(
                f"{titel}: erg lang, alleen de eerste {MAX_TEKENS_PER_BRON // 1000}k tekens zijn samengevat")
            tekst = tekst[:MAX_TEKENS_PER_BRON]
        self.blokken.append({
            "type": "document",
            "source": {"type": "text", "media_type": "text/plain", "data": tekst},
            "title": titel[:250],
        })

    def pdf(self, titel: str, data: bytes) -> None:
        if len(data) > MAX_PDF_BYTES or self._binair + len(data) > MAX_PDF_TOTAAL:
            self.opmerkingen.append(f"{titel}: te groot om door AI te laten lezen (wel downloadbaar)")
            return
        self._binair += len(data)
        self.blokken.append({
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf",
                       "data": base64.standard_b64encode(data).decode("ascii")},
            "title": titel[:250],
        })

    def afbeelding(self, titel: str, data: bytes, mime: str) -> None:
        if len(data) > MAX_AFBEELDING_BYTES or self._binair + len(data) > MAX_PDF_TOTAAL:
            self.opmerkingen.append(f"{titel}: afbeelding te groot om door AI te laten bekijken")
            return
        self._binair += len(data)
        self.blokken.append({"type": "text", "text": f"Afbeelding: {titel}"})
        self.blokken.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mime,
                       "data": base64.standard_b64encode(data).decode("ascii")},
        })


def lees_bestand(pad: Path, bronnen: Bronnen) -> None:
    ext = pad.suffix.lower()
    naam = pad.name
    try:
        if ext == ".pdf":
            bronnen.pdf(naam, pad.read_bytes())
        elif ext in AFBEELDING_MIME:
            bronnen.afbeelding(naam, pad.read_bytes(), AFBEELDING_MIME[ext])
        elif ext in (".html", ".htm"):
            _, tekst = html_naar_tekst(pad.read_text(encoding="utf-8", errors="replace"))
            bronnen.tekst(naam, tekst)
        elif ext in TEKST_EXT:
            bronnen.tekst(naam, pad.read_text(encoding="utf-8", errors="replace"))
        elif ext == ".docx":
            import docx  # python-docx
            d = docx.Document(str(pad))
            delen = [p.text for p in d.paragraphs]
            for tabel in d.tables:
                for rij in tabel.rows:
                    delen.append(" | ".join(c.text for c in rij.cells))
            bronnen.tekst(naam, "\n".join(delen))
        elif ext == ".pptx":
            from pptx import Presentation
            pres = Presentation(str(pad))
            delen = []
            for i, dia in enumerate(pres.slides, 1):
                delen.append(f"--- Dia {i} ---")
                for vorm in dia.shapes:
                    if getattr(vorm, "has_text_frame", False) and vorm.has_text_frame:
                        delen.append(vorm.text_frame.text)
                if dia.has_notes_slide:
                    delen.append("Notities: " + dia.notes_slide.notes_text_frame.text)
            bronnen.tekst(naam, "\n".join(delen))
        elif ext == ".xlsx":
            import openpyxl
            wb = openpyxl.load_workbook(str(pad), read_only=True, data_only=True)
            delen = []
            for ws in wb.worksheets:
                delen.append(f"--- Blad: {ws.title} ---")
                for rij in ws.iter_rows(values_only=True):
                    if any(v is not None for v in rij):
                        delen.append(" | ".join("" if v is None else str(v) for v in rij))
            bronnen.tekst(naam, "\n".join(delen))
        else:
            bronnen.opmerkingen.append(f"{naam}: bestandstype kan AI niet lezen (wel downloadbaar)")
    except Exception as e:  # een kapot bestand mag de rest niet tegenhouden
        bronnen.opmerkingen.append(f"{naam}: kon niet gelezen worden ({type(e).__name__})")


def lees_link(url: str, bronnen: Bronnen) -> None:
    if not re.match(r"^https?://", url or "", re.I):
        return
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (WarRoomBot/1.0)"})
        with urllib.request.urlopen(req, timeout=20) as r:
            soort = (r.headers.get("Content-Type") or "").lower()
            data = r.read(MAX_PDF_BYTES + 1)
        if "pdf" in soort or url.lower().endswith(".pdf"):
            bronnen.pdf(f"Link: {url}", data)
        elif "html" in soort or "text" in soort or not soort:
            titel, tekst = html_naar_tekst(data.decode("utf-8", errors="replace"))
            bronnen.tekst(f"Link: {titel or url}", f"URL: {url}\n\n{tekst}")
        else:
            bronnen.opmerkingen.append(f"Link kon niet gelezen worden (type {soort})")
    except Exception as e:
        bronnen.opmerkingen.append(f"Link kon niet geopend worden ({type(e).__name__}); alleen de URL is meegenomen")


# --------------------------------------------------------------------------- Claude

def maak_client():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        log("Geen ANTHROPIC_API_KEY gevonden: inzendingen worden verwerkt zonder AI-samenvatting.")
        return None
    try:
        import anthropic
    except ImportError:
        log("Python-pakket 'anthropic' ontbreekt: pip install -r scripts/requirements.txt")
        return None
    return anthropic.Anthropic()


def systeemprompt(cfg: dict) -> str:
    afd = "\n".join(f"- {a['id']}: {a['naam']} - {a.get('omschrijving', '')}" for a in cfg["afdelingen"])
    return (
        f"Je bent de informatiemanager van de '{cfg['naam']}', een studententeam dat werkt aan de challenge: "
        f"'{cfg['challenge']}'. Het team heeft drie afdelingen:\n{afd}\n\n"
        "Teamleden sturen onderzoek, bronnen, ideeën, tools en besluiten in. Jij maakt van elke inzending "
        "een heldere, eerlijke samenvatting in het Nederlands, zodat het Centraal Team snel kan zien wat "
        "het is en of het ertoe doet. Schrijf zakelijk en concreet: noem cijfers, conclusies, methodes en "
        "beperkingen als die er zijn. Verzin niets dat niet in het materiaal staat; als je iets niet kon "
        "lezen of het materiaal dun is, zeg dat in de samenvatting."
    )


def schema(cfg: dict) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["titel", "samenvatting", "kernpunten", "type", "tags", "relevantie", "ook_relevant_voor"],
        "properties": {
            "titel": {"type": "string", "description": "Korte, beschrijvende titel (max ~10 woorden)."},
            "samenvatting": {"type": "string", "description": "3 tot 6 zinnen: wat is het en wat is de kern."},
            "kernpunten": {"type": "array", "items": {"type": "string"},
                           "description": "3 tot 7 belangrijkste punten, inzichten of cijfers."},
            "type": {"type": "string", "enum": [t["id"] for t in cfg["types"]]},
            "tags": {"type": "array", "items": {"type": "string"},
                     "description": "3 tot 6 korte onderwerp-tags in kleine letters, bv. 'feedback', 'toetsing', 'privacy'."},
            "relevantie": {"type": "string",
                           "description": "1 tot 3 zinnen: wat betekent dit voor de challenge en wat kan het team ermee?"},
            "ook_relevant_voor": {"type": "array", "items": {"type": "string", "enum": [a["id"] for a in cfg["afdelingen"]]},
                                  "description": "Andere afdelingen die dit zeker moeten zien (mag leeg)."},
        },
    }


class AIFout(Exception):
    pass


def vat_samen(client, cfg: dict, meta: dict, bronnen: Bronnen, bestaande_tags: list[str]) -> dict:
    afd_naam = next((a["naam"] for a in cfg["afdelingen"] if a["id"] == meta["afdeling"]), meta["afdeling"])
    instructie = [
        f"Nieuwe inzending van {meta.get('naam') or 'onbekend'} (afdeling {afd_naam}).",
        f"Voorgestelde titel: {meta['titel']}" if meta.get("titel") else "",
        f"Door indiener gekozen type: {meta['type']}" if meta.get("type") else "",
        f"Link: {meta['link']}" if meta.get("link") else "",
        f"Notitie van de indiener:\n{meta['notitie']}" if meta.get("notitie") else "Geen notitie meegegeven.",
        ("Kon niet (volledig) gelezen worden:\n- " + "\n- ".join(bronnen.opmerkingen)) if bronnen.opmerkingen else "",
        ("Tags die het team al gebruikt (hergebruik waar passend, voor consistent sorteren): "
         + ", ".join(bestaande_tags[:80])) if bestaande_tags else "",
        "Vat deze inzending samen volgens het schema.",
    ]
    content = bronnen.blokken + [{"type": "text", "text": "\n\n".join(r for r in instructie if r)}]

    resp = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",  # bij een (onterechte) weigering neemt automatisch een ander model het over
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": schema(cfg)}},
        system=systeemprompt(cfg),
        messages=[{"role": "user", "content": content}],
    )
    if resp.stop_reason == "refusal":
        raise AIFout("AI weigerde deze inzending samen te vatten")
    if resp.stop_reason == "max_tokens":
        raise AIFout("AI-antwoord werd afgekapt")
    tekst = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    try:
        return json.loads(tekst)
    except json.JSONDecodeError as e:
        raise AIFout(f"AI-antwoord was geen geldige JSON ({e})")


def zonder_ai(meta: dict, bestanden: list[dict], bronnen: Bronnen, reden: str) -> dict:
    titel = meta.get("titel") or (Path(bestanden[0]["naam"]).stem if bestanden else "") or meta.get("link") or "Inzending"
    return {
        "titel": titel,
        "samenvatting": meta.get("notitie") or "",
        "kernpunten": [],
        "type": meta.get("type") or "overig",
        "tags": [],
        "relevantie": "",
        "ook_relevant_voor": [],
        "_reden": reden,
    }


# --------------------------------------------------------------------------- inzendingen

def verzamel_inbox(cfg: dict) -> list[tuple[str, dict, list[Path], list[Path]]]:
    """Geeft (id, meta, bestanden, op-te-ruimen paden) per inzending."""
    afd_ids = {a["id"] for a in cfg["afdelingen"]}
    taken = []
    if not INBOX.exists():
        return taken
    for map_ in sorted(p for p in INBOX.iterdir() if p.is_dir()):
        meta_pad = map_ / "meta.json"
        if meta_pad.exists():
            meta = laad_json(meta_pad, {})
            bestanden = sorted(p for p in map_.rglob("*") if p.is_file() and p.name != "meta.json" and p.name != ".gitkeep")
            id_ = map_.name if re.match(r"^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}$", map_.name) else nieuw_id()
            taken.append((id_, meta, bestanden, [map_]))
        elif map_.name in afd_ids:
            # losse bestanden die via GitHub zelf in inbox/<afdeling>/ zijn gezet
            for f in sorted(p for p in map_.iterdir() if p.is_file() and p.name != ".gitkeep"):
                meta = {"afdeling": map_.name, "naam": "", "notitie": "", "link": "", "titel": "", "type": ""}
                taken.append((nieuw_id(), meta, [f], [f]))
        else:
            log(f"Overgeslagen: inbox/{map_.name} (geen meta.json en geen afdelingsmap)")
    return taken


def item_markdown(item: dict, cfg: dict) -> str:
    afd = {a["id"]: a["naam"] for a in cfg["afdelingen"]}
    typ = {t["id"]: t["naam"] for t in cfg["types"]}
    r = [f"# {item['titel']}", ""]
    r.append(f"**Afdeling:** {afd.get(item['afdeling'], item['afdeling'])} · **Type:** {typ.get(item['type'], item['type'])} · "
             f"**Datum:** {item['datum'][:10]} · **Ingestuurd door:** {item.get('ingestuurd_door') or 'onbekend'}")
    if item.get("tags"):
        r.append("")
        r.append("**Tags:** " + ", ".join(f"`{t}`" for t in item["tags"]))
    if item.get("ook_relevant_voor"):
        r.append("")
        r.append("**Ook relevant voor:** " + ", ".join(afd.get(a, a) for a in item["ook_relevant_voor"]))
    if item.get("samenvatting"):
        r += ["", "## Samenvatting", "", item["samenvatting"]]
    if item.get("kernpunten"):
        r += ["", "## Kernpunten", ""] + [f"- {k}" for k in item["kernpunten"]]
    if item.get("relevantie"):
        r += ["", "## Wat betekent dit voor de challenge?", "", item["relevantie"]]
    if item.get("bestanden"):
        r += ["", "## Bestanden", ""]
        for b in item["bestanden"]:
            r.append(f"- [{b['naam']}](../../site/{b['pad'].replace(' ', '%20')}) ({b['grootte'] // 1024} kB)")
    if item.get("link"):
        r += ["", "## Link", "", item["link"]]
    if item.get("notitie"):
        r += ["", "## Notitie van de indiener", "", item["notitie"]]
    if item.get("opmerkingen"):
        r += ["", "> **Let op:** " + " · ".join(item["opmerkingen"])]
    if not item.get("ai"):
        r += ["", "_Nog geen AI-samenvatting. Draai de workflow met 'herstel' aan om dit alsnog te doen._"]
    return "\n".join(r) + "\n"


def schrijf_overzichten(items: list[dict], cfg: dict) -> None:
    typ = {t["id"]: t["naam"] for t in cfg["types"]}
    for a in cfg["afdelingen"]:
        eigen = [i for i in items if i["afdeling"] == a["id"]]
        r = [f"# {a['naam']}", "", a.get("omschrijving", ""), "",
             f"_{len(eigen)} inzending(en). Dit overzicht wordt automatisch bijgewerkt._", ""]
        if eigen:
            r += ["| Datum | Titel | Type | Tags | Door |", "|---|---|---|---|---|"]
            for i in sorted(eigen, key=lambda x: x["datum"], reverse=True):
                titel = i["titel"].replace("|", "/")
                r.append(f"| {i['datum'][:10]} | [{titel}]({Path(i['md_pad']).name}) | {typ.get(i['type'], i['type'])} | "
                         f"{', '.join(i.get('tags', []))} | {i.get('ingestuurd_door') or ''} |")
        mede = [i for i in items if a["id"] in i.get("ook_relevant_voor", []) and i["afdeling"] != a["id"]]
        if mede:
            r += ["", "## Ook relevant voor deze afdeling", ""]
            for i in sorted(mede, key=lambda x: x["datum"], reverse=True):
                r.append(f"- {i['datum'][:10]} - [{i['titel']}](../{Path(i['md_pad']).relative_to('afdelingen').as_posix()})")
        (AFDELINGEN / a["id"]).mkdir(parents=True, exist_ok=True)
        (AFDELINGEN / a["id"] / "README.md").write_text("\n".join(r) + "\n", encoding="utf-8")


def pas_ai_toe(item: dict, res: dict, cfg: dict, ai: bool) -> None:
    afd_ids = {a["id"] for a in cfg["afdelingen"]}
    type_ids = {t["id"] for t in cfg["types"]}
    item["titel"] = (res.get("titel") or item.get("titel") or "Inzending").strip()
    item["samenvatting"] = res.get("samenvatting", "").strip()
    item["kernpunten"] = [k.strip() for k in res.get("kernpunten", []) if k.strip()]
    item["type"] = res.get("type") if res.get("type") in type_ids else "overig"
    item["tags"] = sorted({t.strip().lower() for t in res.get("tags", []) if t.strip()})
    item["relevantie"] = res.get("relevantie", "").strip()
    item["ook_relevant_voor"] = [a for a in res.get("ook_relevant_voor", []) if a in afd_ids and a != item["afdeling"]]
    item["ai"] = ai
    if not ai and res.get("_reden"):
        item["ai_fout"] = res["_reden"]
    else:
        item.pop("ai_fout", None)


def samenvatten(client, cfg, meta, bestanden_info, bronnen, items) -> tuple[dict, bool]:
    if client is None:
        return zonder_ai(meta, bestanden_info, bronnen, "geen API-sleutel"), False
    bestaande_tags = sorted({t for i in items for t in i.get("tags", [])})
    try:
        return vat_samen(client, cfg, meta, bronnen, bestaande_tags), True
    except Exception as e:
        log(f"  AI-samenvatting mislukt: {type(e).__name__}: {e}")
        return zonder_ai(meta, bestanden_info, bronnen, f"{type(e).__name__}: {e}"[:300]), False


def verwerk(cfg: dict, items: list[dict], client) -> int:
    afd_ids = {a["id"] for a in cfg["afdelingen"]}
    taken = verzamel_inbox(cfg)
    for id_, meta, bestanden, opruimen in taken:
        meta = {k: (v.strip() if isinstance(v, str) else v) for k, v in meta.items()}
        if meta.get("afdeling") not in afd_ids:
            meta["afdeling"] = "centraal"
        log(f"Verwerken: {id_} ({meta['afdeling']}, {len(bestanden)} bestand(en))")

        doel = BESTANDEN / meta["afdeling"] / id_
        doel.mkdir(parents=True, exist_ok=True)
        info = []
        for f in bestanden:
            naam = veilige_naam(f.name)
            dst = doel / naam
            n = 2
            while dst.exists():
                dst = doel / f"{Path(naam).stem}-{n}{Path(naam).suffix}"
                n += 1
            shutil.copy2(f, dst)
            info.append({"naam": dst.name, "pad": dst.relative_to(SITE).as_posix(), "grootte": dst.stat().st_size})

        bronnen = Bronnen()
        for b in info:
            lees_bestand(SITE / b["pad"], bronnen)
        if meta.get("link"):
            lees_link(meta["link"], bronnen)

        item = {
            "id": id_,
            "afdeling": meta["afdeling"],
            "datum": meta.get("ingestuurd_op") or nu_iso(),
            "verwerkt_op": nu_iso(),
            "ingestuurd_door": meta.get("naam", ""),
            "notitie": meta.get("notitie", ""),
            "link": meta.get("link", "") if re.match(r"^https?://", meta.get("link") or "", re.I) else "",
            "bestanden": info,
            "opmerkingen": bronnen.opmerkingen,
        }
        res, ai = samenvatten(client, cfg, meta, info, bronnen, items)
        pas_ai_toe(item, res, cfg, ai)
        if not ai and meta.get("type") in {t["id"] for t in cfg["types"]}:
            item["type"] = meta["type"]

        md = AFDELINGEN / item["afdeling"] / f"{id_}-{slug(item['titel'])}.md"
        md.parent.mkdir(parents=True, exist_ok=True)
        item["md_pad"] = md.relative_to(ROOT).as_posix()
        md.write_text(item_markdown(item, cfg), encoding="utf-8")
        items.append(item)

        for p in opruimen:
            shutil.rmtree(p) if p.is_dir() else p.unlink()
        log(f"  -> {item['titel']} [{item['type']}] {'(AI)' if ai else '(zonder AI)'}")
    return len(taken)


def herstel(cfg: dict, items: list[dict], client) -> int:
    if client is None:
        log("Herstel overgeslagen: geen API-sleutel.")
        return 0
    n = 0
    for item in items:
        if item.get("ai"):
            continue
        log(f"Opnieuw samenvatten: {item['id']}")
        bronnen = Bronnen()
        for b in item.get("bestanden", []):
            lees_bestand(SITE / b["pad"], bronnen)
        if item.get("link"):
            lees_link(item["link"], bronnen)
        meta = {"afdeling": item["afdeling"], "naam": item.get("ingestuurd_door"), "notitie": item.get("notitie"),
                "link": item.get("link"), "titel": item.get("titel"), "type": item.get("type")}
        res, ai = samenvatten(client, cfg, meta, item.get("bestanden", []), bronnen, items)
        if not ai:
            continue
        oud_md = ROOT / item["md_pad"]
        pas_ai_toe(item, res, cfg, True)
        item["opmerkingen"] = bronnen.opmerkingen
        md = AFDELINGEN / item["afdeling"] / f"{item['id']}-{slug(item['titel'])}.md"
        if oud_md.exists() and oud_md != md:
            oud_md.unlink()
        item["md_pad"] = md.relative_to(ROOT).as_posix()
        md.write_text(item_markdown(item, cfg), encoding="utf-8")
        n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--herstel", action="store_true", help="items zonder AI-samenvatting alsnog samenvatten")
    ap.add_argument("--zonder-ai", action="store_true", help="niet naar Claude sturen")
    args = ap.parse_args()

    cfg = laad_json(DATA / "config.json", None)
    if not cfg:
        log("site/data/config.json ontbreekt")
        return 1
    items = laad_json(DATA / "items.json", [])
    client = None if args.zonder_ai else maak_client()

    nieuw = verwerk(cfg, items, client)
    hersteld = herstel(cfg, items, client) if args.herstel else 0

    items.sort(key=lambda i: i["datum"], reverse=True)
    schrijf_json(DATA / "items.json", items)
    schrijf_overzichten(items, cfg)
    log(f"Klaar: {nieuw} nieuw, {hersteld} hersteld, {len(items)} totaal.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
