/* War Room - gedeelde projecttool.
 *
 * Gegevens:
 *  - Taken, vragen, besluiten, richting & reacties  -> GitHub Issues van deze repo (live, gedeeld)
 *  - Documenten + AI-samenvattingen                 -> data/items.json (gemaakt door scripts/verwerk_inbox.py)
 *  - Uploads                                        -> één commit naar inbox/<id>/ via de GitHub API
 * Elk issue/reactie draagt een onzichtbare marker <!-- warroom:{...} --> met auteur/afdeling/soort.
 */
(() => {
  "use strict";

  // ================================================================== basis
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const opslag = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* geen opslag */ } },
  };

  let cfg = null;
  let items = [];          // documenten (items.json)
  let issues = [];         // geparste issues
  let reacties = [];       // geparste issue-reacties
  let vorigBezoek = 0;
  const profiel = { naam: opslag.get("warroom-naam") || "", afdeling: opslag.get("warroom-afdeling") || "" };
  const token = () => opslag.get("warroom-token");

  const afdNaam = (id) => cfg.afdelingen.find((a) => a.id === id)?.naam ?? (id || "–");
  const typeNaam = (id) => cfg.types.find((t) => t.id === id)?.naam ?? id;
  const statusNaam = (id) => cfg.statussen.find((s) => s.id === id)?.naam ?? id;
  const afdKleur = (id) => `var(--afd-${id}, var(--zacht))`;
  const grootte = (b) => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " kB";
  const datum = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }); };
  function geleden(iso) {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return "zojuist";
    if (s < 3600) return `${Math.floor(s / 60)} min geleden`;
    if (s < 86400) return `${Math.floor(s / 3600)} uur geleden`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} dag${s < 2 * 86400 ? "" : "en"} geleden`;
    return datum(iso);
  }
  const afdChip = (id) => `<span class="chip afd" style="--afd:${afdKleur(id)}">${esc(afdNaam(id))}</span>`;

  function repoInfo() {
    if (cfg.repo && cfg.repo.includes("/")) {
      const [owner, repo] = cfg.repo.split("/");
      return { owner, repo, branch: cfg.branch || "main" };
    }
    const h = location.hostname;
    if (h.endsWith(".github.io")) {
      return { owner: h.split(".")[0], repo: location.pathname.split("/").filter(Boolean)[0] || h, branch: cfg.branch || "main" };
    }
    return null;
  }

  function melding(tekst, soort = "") {
    const m = $("#melding");
    m.hidden = !tekst;
    m.className = "melding " + soort;
    m.innerHTML = tekst || "";
  }

  // ================================================================== mini-markdown (veilig: eerst escapen)
  const MARKER = /<!--\s*warroom:(\{[\s\S]*?\})\s*-->/;
  const leesMarker = (t) => { const m = MARKER.exec(t || ""); if (!m) return {}; try { return JSON.parse(m[1]); } catch { return {}; } };
  const zonderMarker = (t) => String(t || "").replace(MARKER, "").trim();
  const maakMarker = (d) => `<!-- warroom:${JSON.stringify(d).replace(/--/g, "-\\u002d")} -->`;

  function inline(h) {
    return h
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)_([^_]+)_(?=[\s.,]|$)/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])#(\d+)\b/g, '$1<a href="#$2" data-open="$2">#$2</a>');
  }
  function md(tekst) {
    const regels = esc(zonderMarker(tekst)).split(/\r?\n/);
    let uit = "", lijst = false, par = [];
    const sluitPar = () => { if (par.length) { uit += `<p>${inline(par.join("<br>"))}</p>`; par = []; } };
    const sluitLijst = () => { if (lijst) { uit += "</ul>"; lijst = false; } };
    for (const r of regels) {
      const l = r.trim();
      if (/^[-*] /.test(l)) { sluitPar(); if (!lijst) { uit += "<ul>"; lijst = true; } uit += `<li>${inline(l.slice(2))}</li>`; }
      else if (/^#{1,4} /.test(l)) { sluitPar(); sluitLijst(); uit += `<h4>${inline(l.replace(/^#+ /, ""))}</h4>`; }
      else if (!l) { sluitPar(); sluitLijst(); }
      else { sluitLijst(); par.push(l); }
    }
    sluitPar(); sluitLijst();
    return uit;
  }

  // ================================================================== GitHub API
  async function gh(pad, opties = {}) {
    const r = repoInfo();
    const t = token();
    const res = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}${pad}`, {
      ...opties,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(opties.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      let msg = "";
      try { msg = (await res.json()).message; } catch { /* */ }
      const err = new Error(msg || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  async function ghAlles(pad, maxPaginas = 5) {
    let alles = [];
    for (let p = 1; p <= maxPaginas; p++) {
      const deel = await gh(`${pad}${pad.includes("?") ? "&" : "?"}per_page=100&page=${p}`);
      alles = alles.concat(deel);
      if (deel.length < 100) break;
    }
    return alles;
  }
  const foutUitleg = (err) =>
    err.status === 401 ? "de teamcode klopt niet of is verlopen" :
    err.status === 403 ? (String(err.message).includes("rate limit") ? "te veel verzoeken, probeer het over een paar minuten opnieuw" : "de teamcode heeft geen rechten hiervoor") :
    err.status === 404 ? "niet gevonden, of de teamcode heeft geen toegang" :
    err.status === 422 ? "GitHub weigerde het verzoek (te groot bestand?)" : (err.message || "onbekende fout");

  function parseIssue(i) {
    const labels = i.labels.map((l) => (typeof l === "string" ? l : l.name));
    const meta = leesMarker(i.body);
    const soort = ["taak", "vraag", "besluit", "richting", "document"].find((s) => labels.includes(s)) || "overig";
    return {
      nr: i.number, titel: i.title, body: i.body || "", meta, labels, soort,
      afd: (labels.find((l) => l.startsWith("afd:")) || "").slice(4) || meta.afdeling || "",
      status: (labels.find((l) => l.startsWith("status:")) || "").slice(7) || (i.state === "closed" ? "klaar" : "todo"),
      open: i.state === "open", gemaakt: i.created_at, bijgewerkt: i.updated_at, url: i.html_url,
      auteur: meta.auteur || i.user?.login || "", reacties: i.comments,
    };
  }
  function parseReactie(c) {
    const meta = leesMarker(c.body);
    return { id: c.id, nr: +c.issue_url.split("/").pop(), body: c.body || "", meta, soort: meta.soort || "reactie",
      auteur: meta.auteur || c.user?.login || "", afd: meta.afdeling || "", gemaakt: c.created_at, url: c.html_url };
  }

  // ================================================================== laden
  async function laadDocumenten() {
    try { items = await (await fetch("data/items.json", { cache: "no-store" })).json(); } catch { items = []; }
  }
  async function laadIssues() {
    if (!repoInfo() || !token()) { issues = []; reacties = []; return false; }
    const [is, cs] = await Promise.all([
      ghAlles("/issues?state=all&sort=updated&direction=desc"),
      ghAlles("/issues/comments?sort=created&direction=desc", 5),
    ]);
    issues = is.filter((i) => !i.pull_request).map(parseIssue);
    reacties = cs.map(parseReactie).sort((a, b) => a.gemaakt.localeCompare(b.gemaakt));
    return true;
  }
  async function ververs(stil = false) {
    try {
      await Promise.all([laadDocumenten(), laadIssues()]);
      if (!token()) melding(`👋 Vul je <button class="link-knop" data-profiel>naam, afdeling en teamcode</button> in om taken, vragen en besluiten te zien en te plaatsen.`);
      else melding("");
    } catch (err) {
      if (err.status === 401) opslag.set("warroom-token", "");
      if (!stil) melding(`Kon gegevens niet laden: ${esc(foutUitleg(err))}. <button class="link-knop" data-profiel>Teamcode controleren</button>`, "fout");
    }
    renderAlles();
  }

  // ================================================================== afgeleide gegevens
  const taken = () => issues.filter((i) => i.soort === "taak");
  const vragen = () => issues.filter((i) => i.soort === "vraag");
  const besluiten = () => issues.filter((i) => i.soort === "besluit");
  const richtingIssue = () => issues.filter((i) => i.soort === "richting").sort((a, b) => a.nr - b.nr)[0];
  const reactiesVan = (nr) => reacties.filter((r) => r.nr === nr);
  const laatsteActiviteit = (i) => { const rs = reactiesVan(i.nr); return rs.length ? rs[rs.length - 1].gemaakt : i.gemaakt; };
  const isNieuw = (iso) => vorigBezoek && new Date(iso).getTime() > vorigBezoek;
  const bekendeNamen = () => [...new Set([profiel.naam, ...issues.map((i) => i.meta.verantwoordelijke), ...issues.map((i) => i.auteur), ...reacties.map((r) => r.auteur), ...items.map((d) => d.ingestuurd_door)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "nl"));

  function voortgang(lijst) {
    const n = lijst.length;
    const per = Object.fromEntries(cfg.statussen.map((s) => [s.id, lijst.filter((t) => t.status === s.id).length]));
    return { n, per, pct: n ? Math.round((per.klaar / n) * 100) : 0 };
  }
  function balk(v) {
    if (!v.n) return `<div class="balk-leeg muted klein">Nog geen taken</div>`;
    return `<div class="vbalk" role="img" aria-label="${v.pct}% klaar">${cfg.statussen.map((s) => v.per[s.id]
      ? `<span class="seg st-${s.id}" style="flex:${v.per[s.id]}" title="${esc(s.naam)}: ${v.per[s.id]}"></span>` : "").join("")}</div>
      <div class="legenda">${cfg.statussen.map((s) => `<span><i class="st-${s.id}"></i>${esc(s.naam)} ${v.per[s.id]}</span>`).join("")}</div>`;
  }

  // ================================================================== START
  function renderStart() {
    const r = richtingIssue();
    $("#richting-banner").innerHTML = r
      ? `<div class="richting-banner"><div class="paneel-kop"><h2 class="paneel-titel">🎯 Projectrichting &amp; Definition of Done</h2>
           <button class="link-knop" data-view-link="richting">Bekijk / bewerk</button></div>
         <div class="md ingeklapt">${md(r.body)}</div>
         <p class="muted klein">Laatst bijgewerkt ${esc(geleden(laatsteActiviteit(r)))}</p></div>`
      : token() ? `<div class="richting-banner leeg-banner"><strong>🎯 Nog geen projectrichting vastgelegd.</strong>
           <span class="muted">Het Centraal Team legt hier de richting en de definition of done vast.</span>
           <button class="knop klein-knop" data-view-link="richting">Vastleggen</button></div>` : "";

    const alle = taken();
    const tot = voortgang(alle);
    $("#paneel-voortgang").innerHTML = `<div class="paneel-kop"><h2 class="paneel-titel">Totale projectvoortgang</h2><span class="groot-getal">${tot.pct}%</span></div>
      ${balk(tot)}
      <div class="afd-voortgang">${cfg.afdelingen.map((a) => { const v = voortgang(alle.filter((t) => t.afd === a.id));
        return `<div><div class="rij-kop">${afdChip(a.id)}<span class="muted klein">${v.per.klaar}/${v.n} klaar</span></div>
          <div class="mini"><span style="width:${v.pct}%;background:${afdKleur(a.id)}"></span></div></div>`; }).join("")}</div>
      <p class="muted klein">Voorlopige berekening: aandeel taken met status “Klaar”.</p>`;

    const mijnAfd = profiel.afdeling;
    if (mijnAfd) {
      const eigen = alle.filter((t) => t.afd === mijnAfd);
      const v = voortgang(eigen);
      const mijnTaken = alle.filter((t) => t.meta.verantwoordelijke === profiel.naam && t.status !== "klaar");
      $("#paneel-eigen").innerHTML = `<div class="paneel-kop"><h2 class="paneel-titel">${esc(afdNaam(mijnAfd))}</h2><span class="groot-getal">${v.pct}%</span></div>
        ${balk(v)}
        <h3 class="sub">Mijn open taken</h3>
        ${mijnTaken.length ? `<ul class="compact">${mijnTaken.map((t) => `<li><a href="#${t.nr}" data-open="${t.nr}">${esc(t.titel)}</a> <span class="chip st-chip st-${t.status}">${esc(statusNaam(t.status))}</span></li>`).join("")}</ul>`
          : `<p class="muted klein">Geen open taken op jouw naam. <button class="link-knop" data-nieuw="taak">Taak aanmaken</button></p>`}`;
    } else {
      $("#paneel-eigen").innerHTML = `<h2 class="paneel-titel">Jouw afdeling</h2><p class="muted">Kies je afdeling om hier de voortgang van je eigen team te zien.</p><button class="knop klein-knop" data-profiel>Wie ben je?</button>`;
    }

    $("#teams-bezig").innerHTML = cfg.afdelingen.map((a) => {
      const actief = alle.filter((t) => t.afd === a.id && (t.status === "bezig" || t.status === "review"))
        .sort((x, y) => laatsteActiviteit(y).localeCompare(laatsteActiviteit(x)));
      return `<div class="team" style="--afd:${afdKleur(a.id)}"><h3>${esc(a.naam)}</h3>
        ${actief.length ? actief.map((t) => `<button class="team-taak" data-open="${t.nr}">
            <span class="tt-titel">${esc(t.titel)}</span>
            <span class="muted klein">${esc(t.meta.verantwoordelijke || "")} · <span class="st-tekst st-${t.status}">${esc(statusNaam(t.status))}</span> · ${esc(geleden(laatsteActiviteit(t)))}</span></button>`).join("")
          : `<p class="muted klein">Niets in uitvoering.</p>`}</div>`;
    }).join("");

    const open = vragen().filter((v) => v.open).sort((a, b) => (b.meta.aan === mijnAfd) - (a.meta.aan === mijnAfd) || b.gemaakt.localeCompare(a.gemaakt));
    $("#open-vragen").innerHTML = open.length ? `<ul class="compact">${open.slice(0, 8).map((v) => `<li>
        <a href="#${v.nr}" data-open="${v.nr}">${esc(v.titel)}</a>
        <span class="muted klein">aan ${esc(afdNaam(v.meta.aan))} · ${esc(v.auteur)} · ${v.reacties} antwoord${v.reacties === 1 ? "" : "en"}</span>
        ${v.meta.aan === mijnAfd ? `<span class="chip waarschuw">jouw afdeling</span>` : ""}</li>`).join("")}</ul>`
      : `<p class="muted klein">${token() ? "Geen open vragen 🎉" : "Vul je teamcode in om vragen te zien."}</p>`;

    // feed: nieuwe issues + reacties + documenten
    const feed = [
      ...issues.filter((i) => i.soort !== "document").map((i) => ({ t: i.gemaakt, nr: i.nr, html: `<strong>${esc(i.auteur)}</strong> ${({ taak: "maakte taak", vraag: "stelde vraag", besluit: "legde besluit vast", richting: "legde de richting vast" })[i.soort] || "plaatste"} <a href="#${i.nr}" data-open="${i.nr}">${esc(i.titel)}</a>` })),
      ...reacties.filter((r) => r.soort !== "samenvatting").map((r) => { const i = issues.find((x) => x.nr === r.nr); return i && { t: r.gemaakt, nr: r.nr,
        html: `<strong>${esc(r.auteur)}</strong> ${({ update: "plaatste een voortgangsupdate bij", antwoord: "beantwoordde", status: "wijzigde de status van", richting: "werkte de richting bij", controle: "controleerde" })[r.soort] || "reageerde op"} <a href="#${r.nr}" data-open="${r.nr}">${esc(i.titel)}</a>` }; }).filter(Boolean),
      ...items.map((d) => ({ t: d.verwerkt_op || d.datum, doc: d.id, html: `📄 <strong>${esc(d.ingestuurd_door || "Iemand")}</strong> uploadde <a href="#doc-${esc(d.id)}" data-doc="${esc(d.id)}">${esc(d.titel)}</a>` })),
    ].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 15);
    $("#feed").innerHTML = feed.length ? feed.map((f) => `<div class="feed-item">${isNieuw(f.t) ? `<span class="nieuw-stip" title="Nieuw sinds je vorige bezoek"></span>` : ""}
        <div>${f.html}<div class="muted klein">${esc(geleden(f.t))}</div></div></div>`).join("")
      : `<p class="muted klein">Nog geen activiteit.</p>`;
  }

  // ================================================================== TAKEN
  function renderTaken() {
    const fa = $("#taken-afd").value, fp = $("#taken-persoon").value;
    const sel = $("#taken-persoon"), huidig = sel.value;
    sel.innerHTML = `<option value="">Iedereen</option>` + bekendeNamen().map((n) => `<option>${esc(n)}</option>`).join("");
    sel.value = huidig;
    const lijst = taken().filter((t) => (!fa || t.afd === fa) && (!fp || t.meta.verantwoordelijke === fp));
    $("#bord").innerHTML = cfg.statussen.map((s) => {
      const kol = lijst.filter((t) => t.status === s.id).sort((a, b) => laatsteActiviteit(b).localeCompare(laatsteActiviteit(a)));
      return `<div class="kolom"><h3><i class="st-${s.id}"></i>${esc(s.naam)} <span class="muted">${kol.length}</span></h3>
        ${kol.map((t) => { const ups = reactiesVan(t.nr).filter((r) => r.soort === "update").length;
          return `<button class="kaart" data-open="${t.nr}" style="--afd:${afdKleur(t.afd)}">
            <span class="kaart-titel">${esc(t.titel)}</span>
            <span class="meta">${afdChip(t.afd)}<span class="muted">${esc(t.meta.verantwoordelijke || "–")}</span></span>
            <span class="muted klein">${ups} update${ups === 1 ? "" : "s"} · ${esc(geleden(laatsteActiviteit(t)))}${t.meta.deadline ? ` · ⏰ ${esc(datum(t.meta.deadline))}` : ""}</span>
          </button>`; }).join("") || `<p class="muted klein leeg-kol">—</p>`}</div>`;
    }).join("");
  }

  // ================================================================== VRAGEN & BESLUITEN
  function issueKaart(i, extra = "") {
    const laatste = reactiesVan(i.nr).at(-1);
    return `<button class="item-kaart" data-open="${i.nr}" style="--afd:${afdKleur(i.afd)}">
      <span class="meta">${afdChip(i.afd)}${extra}<span class="muted">${esc(i.auteur)} · ${esc(datum(i.gemaakt))}</span>
        ${isNieuw(laatsteActiviteit(i)) ? `<span class="chip nieuw">nieuw</span>` : ""}</span>
      <span class="kaart-titel">${esc(i.titel)}</span>
      ${zonderMarker(i.body) ? `<span class="uittreksel">${esc(zonderMarker(i.body).slice(0, 220))}</span>` : ""}
      <span class="muted klein">💬 ${i.reacties}${laatste ? ` · laatste reactie ${esc(geleden(laatste.gemaakt))} door ${esc(laatste.auteur)}` : ""}</span>
    </button>`;
  }
  function renderVragen() {
    const f = $("#vragen-filter").value;
    const lijst = vragen().filter((v) => f === "alle" || (v.open && (f === "open" || v.meta.aan === profiel.afdeling)))
      .sort((a, b) => laatsteActiviteit(b).localeCompare(laatsteActiviteit(a)));
    $("#vragen-lijst").innerHTML = lijst.map((v) => issueKaart(v,
      `<span class="chip">aan ${esc(afdNaam(v.meta.aan))}</span>${v.open ? `<span class="chip waarschuw">open</span>` : `<span class="chip ok">beantwoord</span>`}`)).join("")
      || `<div class="leeg">${token() ? "Geen vragen in deze selectie." : "Vul je teamcode in om vragen te zien."}</div>`;
    const mijnOpen = vragen().filter((v) => v.open && v.meta.aan === profiel.afdeling).length;
    $("#teller-vragen").hidden = !mijnOpen;
    $("#teller-vragen").textContent = mijnOpen;
  }
  function renderBesluiten() {
    const lijst = besluiten().sort((a, b) => (b.meta.datum || b.gemaakt).localeCompare(a.meta.datum || a.gemaakt));
    $("#besluiten-lijst").innerHTML = lijst.map((b) => issueKaart(b, `<span class="chip">📅 ${esc(datum(b.meta.datum || b.gemaakt))}</span>`)).join("")
      || `<div class="leeg">${token() ? "Nog geen besluiten vastgelegd." : "Vul je teamcode in om besluiten te zien."}</div>`;
  }

  // ================================================================== RICHTING
  function renderRichting() {
    const r = richtingIssue();
    if (!token()) { $("#richting-vol").innerHTML = `<div class="leeg">Vul je teamcode in om de richting te zien.</div>`; return; }
    if (!r) {
      $("#richting-vol").innerHTML = `<div class="paneel"><h2 class="paneel-titel">Projectrichting &amp; Definition of Done</h2>
        <p class="muted">Nog niet vastgelegd. Het Centraal Team kan dit hieronder invullen.</p>
        <form id="richting-form"><textarea name="tekst" rows="14">${esc(cfg.richting_sjabloon || "")}</textarea>
        <div class="acties"><button class="knop">Vastleggen</button><span class="status"></span></div></form></div>`;
    } else {
      const versies = reactiesVan(r.nr).filter((c) => c.soort === "richting").reverse();
      $("#richting-vol").innerHTML = `<div class="paneel">
        <div class="paneel-kop"><h2 class="paneel-titel">🎯 Projectrichting &amp; Definition of Done</h2>
          <button class="knop klein-knop" id="richting-bewerk">Bewerken</button></div>
        <div class="md" id="richting-tekst">${md(r.body)}</div>
        <form id="richting-form" hidden><textarea name="tekst" rows="16">${esc(zonderMarker(r.body))}</textarea>
          <label><span class="lbl">Wat is er veranderd en waarom? <span class="opt">(voor de geschiedenis)</span></span><input name="waarom"></label>
          <div class="acties"><button class="knop">Opslaan</button><button type="button" class="link-knop" id="richting-annuleer">Annuleren</button><span class="status"></span></div></form>
        ${profiel.afdeling && profiel.afdeling !== "centraal" ? `<p class="muted klein">Wijzigingen horen bij het Centraal Team. Reageer of stel een vraag als je iets wilt voorstellen.</p>` : ""}
      </div>
      <div class="paneel"><h2 class="paneel-titel">Geschiedenis</h2>
        ${versies.length ? versies.map((v) => `<details class="versie"><summary><strong>${esc(v.auteur)}</strong> · ${esc(datum(v.gemaakt))} ${esc(new Date(v.gemaakt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }))}${v.meta.waarom ? ` · ${esc(v.meta.waarom)}` : ""}</summary><div class="md">${md(v.body)}</div></details>`).join("")
          : `<p class="muted klein">Nog geen eerdere versies.</p>`}
        <p class="klein"><a href="${esc(r.url)}" target="_blank" rel="noopener">Bekijk op GitHub (inclusief reacties)</a> · <button class="link-knop" data-open="${r.nr}">Reageren</button></p>
      </div>`;
      $("#richting-bewerk").onclick = () => { $("#richting-form").hidden = false; $("#richting-tekst").hidden = true; };
      $("#richting-annuleer").onclick = () => { $("#richting-form").hidden = true; $("#richting-tekst").hidden = false; };
    }
    $("#richting-form").onsubmit = async (e) => {
      e.preventDefault();
      if (!eisProfiel()) return;
      const f = e.target, st = $(".status", f), tekst = f.tekst.value.trim();
      st.textContent = "Opslaan…";
      try {
        const m = { soort: "richting", auteur: profiel.naam, afdeling: profiel.afdeling };
        if (!r) {
          await gh("/issues", { method: "POST", body: JSON.stringify({ title: "🎯 Projectrichting & Definition of Done", body: `${tekst}\n\n${maakMarker(m)}`, labels: ["richting", "afd:centraal"] }) });
        } else {
          await gh(`/issues/${r.nr}`, { method: "PATCH", body: JSON.stringify({ body: `${tekst}\n\n${maakMarker({ ...r.meta, ...m })}` }) });
          await gh(`/issues/${r.nr}/comments`, { method: "POST", body: JSON.stringify({ body: `${tekst}\n\n${maakMarker({ ...m, waarom: f.waarom?.value.trim() || "" })}` }) });
        }
        await ververs();
      } catch (err) { st.textContent = "Mislukt: " + foutUitleg(err); st.className = "status fout"; }
    };
  }

  // ================================================================== DOCUMENTEN
  const docFilter = { zoek: "", afdeling: "", type: "", tag: "", bron: "", sorteer: "nieuw" };
  function renderDocumenten() {
    const z = docFilter.zoek.trim().toLowerCase();
    const lijst = items.filter((i) =>
      (!docFilter.afdeling || i.afdeling === docFilter.afdeling || (i.ook_relevant_voor || []).includes(docFilter.afdeling)) &&
      (!docFilter.type || i.type === docFilter.type) &&
      (!docFilter.tag || (i.tags || []).includes(docFilter.tag)) &&
      (!docFilter.bron || i.brontype === docFilter.bron) &&
      (!z || [i.titel, i.samenvatting, i.notitie, i.relevantie, i.ingestuurd_door, i.onzekerheden, ...(i.tags || []), ...(i.kernpunten || []),
        ...(i.bestanden || []).map((b) => b.naam)].join(" ").toLowerCase().includes(z)));
    const s = docFilter.sorteer;
    lijst.sort((a, b) => s === "oud" ? a.datum.localeCompare(b.datum) : s === "titel" ? a.titel.localeCompare(b.titel, "nl")
      : s === "afdeling" ? afdNaam(a.afdeling).localeCompare(afdNaam(b.afdeling), "nl") || b.datum.localeCompare(a.datum) : b.datum.localeCompare(a.datum));
    $("#wis-filters").hidden = !(docFilter.zoek || docFilter.afdeling || docFilter.type || docFilter.tag || docFilter.bron);
    $("#aantal").textContent = `${lijst.length} van ${items.length} document${items.length === 1 ? "" : "en"}`;
    $("#lijst").innerHTML = lijst.map((i) => {
      const iss = issues.find((x) => x.nr === i.issue);
      return `<button class="item-kaart" data-doc="${esc(i.id)}" style="--afd:${afdKleur(i.afdeling)}">
        <span class="meta">${afdChip(i.afdeling)}<span class="chip">${esc(typeNaam(i.type))}</span>
          ${i.brontype ? `<span class="chip">${esc(i.brontype)}</span>` : ""}
          ${i.betrouwbaarheid ? `<span class="chip betr-${esc(i.betrouwbaarheid)}">betrouwbaarheid: ${esc(i.betrouwbaarheid)}</span>` : ""}
          ${iss?.labels.includes("gecontroleerd") ? `<span class="chip ok">✓ gecontroleerd</span>` : ""}
          ${!i.ai ? `<span class="chip waarschuw">nog niet samengevat</span>` : ""}
          ${i.bestanden?.length ? `<span class="chip">📎 ${i.bestanden.length}</span>` : ""}
          <span class="muted">${esc(datum(i.datum))}${i.ingestuurd_door ? " · " + esc(i.ingestuurd_door) : ""}</span></span>
        <span class="kaart-titel">${esc(i.titel)}</span>
        ${i.samenvatting ? `<span class="uittreksel">${esc(i.samenvatting)}</span>` : ""}
      </button>`;
    }).join("") || `<div class="leeg"><strong>${items.length ? "Niets gevonden met deze filters." : "Nog geen documenten."}</strong></div>`;
  }

  // ================================================================== DETAIL
  function tijdlijn(nr) {
    const rs = reactiesVan(nr).filter((r) => r.soort !== "richting");
    const label = { update: "voortgangsupdate", antwoord: "antwoord", status: "status", samenvatting: "AI-samenvatting", controle: "controle" };
    return `<div class="tijdlijn">${rs.map((r) => `<div class="reactie soort-${esc(r.soort)}">
        <div class="meta"><strong>${esc(r.auteur)}</strong>${r.afd ? afdChip(r.afd) : ""}${label[r.soort] ? `<span class="chip">${esc(label[r.soort])}</span>` : ""}
          <span class="muted" title="${esc(new Date(r.gemaakt).toLocaleString("nl-NL"))}">${esc(geleden(r.gemaakt))}</span></div>
        <div class="md">${md(r.body)}</div></div>`).join("") || `<p class="muted klein">Nog geen reacties.</p>`}</div>`;
  }

  function reactieForm(i) {
    const isTaak = i.soort === "taak";
    return `<form class="reactie-form" data-nr="${i.nr}" novalidate>
      ${isTaak ? `<div class="soort-keuze"><label class="radio"><input type="radio" name="soort" value="update" checked> Voortgangsupdate</label>
        <label class="radio"><input type="radio" name="soort" value="reactie"> Reactie / vraag</label></div>` : ""}
      ${i.soort === "vraag" ? `<input type="hidden" name="soort" value="antwoord">` : ""}
      <textarea name="tekst" rows="3" placeholder="${isTaak ? "Wat heb je gedaan, wat is de volgende stap, waar loop je tegenaan?" : i.soort === "vraag" ? "Jouw antwoord…" : "Jouw reactie…"}"></textarea>
      ${isTaak ? `<div class="bijlage"><input type="file" name="bestanden" multiple><span class="muted klein">Documenten worden geüpload, door AI samengevat en bij deze taak gezet.</span></div>` : ""}
      <div class="acties"><button class="knop">Plaatsen</button><span class="status"></span></div>
    </form>`;
  }

  function openIssue(nr) {
    const i = issues.find((x) => x.nr === +nr);
    if (!i) return;
    if (i.soort === "document") { const d = items.find((x) => x.issue === i.nr); if (d) return openDocument(d.id); }
    if (i.soort === "richting") return toonView("richting");
    const extra = i.soort === "taak" ? `
        <div class="kv"><span>Verantwoordelijke</span><strong>${esc(i.meta.verantwoordelijke || "–")}</strong>
          <span>Afdeling</span>${afdChip(i.afd)}
          ${i.meta.deadline ? `<span>Deadline</span><strong>${esc(datum(i.meta.deadline))}</strong>` : ""}
          <span>Aangemaakt</span><span>${esc(datum(i.gemaakt))} door ${esc(i.auteur)}</span></div>
        <div class="status-knoppen" role="group" aria-label="Status">${cfg.statussen.map((s) =>
          `<button class="st-knop st-${s.id}" data-status="${s.id}" aria-pressed="${i.status === s.id}">${esc(s.naam)}</button>`).join("")}</div>`
      : i.soort === "vraag" ? `<div class="kv"><span>Aan</span>${afdChip(i.meta.aan)}<span>Gesteld door</span><span>${esc(i.auteur)} (${esc(afdNaam(i.afd))}), ${esc(datum(i.gemaakt))}</span></div>
        <button class="knop secundair" data-beantwoord>${i.open ? "✓ Markeer als beantwoord" : "Heropen vraag"}</button>`
      : i.soort === "besluit" ? `<div class="kv"><span>Genomen door</span>${afdChip(i.afd)}<span>Datum</span><strong>${esc(datum(i.meta.datum || i.gemaakt))}</strong><span>Vastgelegd door</span><span>${esc(i.auteur)}</span></div>` : "";

    $("#detail-meta").innerHTML = `<span class="chip soort">${esc({ taak: "Taak", vraag: "Vraag", besluit: "Besluit" }[i.soort] || "Item")} #${i.nr}</span>`;
    $("#detail-inhoud").innerHTML = `<h2 class="detail-titel">${esc(i.titel)}</h2>${extra}
      ${zonderMarker(i.body) ? `<div class="md body">${md(i.body)}</div>` : ""}
      <h3 class="sub">${i.soort === "taak" ? "Updates & reacties" : i.soort === "vraag" ? "Antwoorden" : "Reacties"}</h3>
      ${tijdlijn(i.nr)}${reactieForm(i)}
      <p class="klein"><a href="${esc(i.url)}" target="_blank" rel="noopener">Volledige geschiedenis op GitHub</a></p>`;
    koppelDetail(i);
    openDialog("#detail");
    history.replaceState(null, "", "#" + i.nr);
  }

  function openDocument(id) {
    const d = items.find((x) => x.id === id);
    if (!d) return;
    const iss = issues.find((x) => x.nr === d.issue);
    const ext = (n) => (n.includes(".") ? n.split(".").pop() : "bestand").slice(0, 5);
    const link = /^https?:\/\//i.test(d.link || "") ? d.link : "";
    const taak = d.taak && issues.find((x) => x.nr === d.taak);
    $("#detail-meta").innerHTML = `${afdChip(d.afdeling)}<span class="chip">${esc(typeNaam(d.type))}</span>
      ${iss?.labels.includes("gecontroleerd") ? `<span class="chip ok">✓ gecontroleerd</span>` : ""}`;
    $("#detail-inhoud").innerHTML = `<h2 class="detail-titel">${esc(d.titel)}</h2>
      <p class="muted klein">${esc(datum(d.datum))}${d.ingestuurd_door ? " · ingestuurd door " + esc(d.ingestuurd_door) : ""}${taak ? ` · bij taak <a href="#${taak.nr}" data-open="${taak.nr}">${esc(taak.titel)}</a>` : ""}</p>
      ${d.samenvatting ? `<h4>Samenvatting${d.ai ? ' <span class="chip">AI</span>' : ""}</h4><p>${esc(d.samenvatting)}</p>` : ""}
      ${d.kernpunten?.length ? `<h4>Kernpunten</h4><ul>${d.kernpunten.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
      ${d.relevantie ? `<h4>Wat betekent dit voor de challenge?</h4><p>${esc(d.relevantie)}</p>` : ""}
      ${d.brontype || d.betrouwbaarheid ? `<h4>Bron</h4><p><span class="chip">${esc(d.brontype || "–")}</span> ${d.betrouwbaarheid ? `<span class="chip betr-${esc(d.betrouwbaarheid)}">betrouwbaarheid: ${esc(d.betrouwbaarheid)}</span>` : ""}</p>${d.betrouwbaarheid_toelichting ? `<p class="muted">${esc(d.betrouwbaarheid_toelichting)}</p>` : ""}` : ""}
      ${d.onzekerheden ? `<h4>Onzekerheden &amp; betwiste punten</h4><p>${esc(d.onzekerheden)}</p>` : ""}
      ${d.tags?.length ? `<h4>Tags</h4><div class="tags">${d.tags.map((t) => `<button class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
      ${d.notitie ? `<h4>Notitie van ${esc(d.ingestuurd_door || "de indiener")}</h4><p>${esc(d.notitie)}</p>` : ""}
      ${link ? `<h4>Link</h4><p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></p>` : ""}
      ${d.bestanden?.length ? `<h4>Bestanden</h4><div class="downloads">${d.bestanden.map((b) =>
        `<a class="download" href="${esc(encodeURI(b.pad))}" download="${esc(b.naam)}"><span class="ext">${esc(ext(b.naam))}</span><span class="bnaam">${esc(b.naam)}</span><span class="grootte">${grootte(b.grootte)} ↓</span></a>`).join("")}</div>` : ""}
      ${d.opmerkingen?.length ? `<h4>Let op</h4><ul class="muted">${d.opmerkingen.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
      ${iss ? `<div class="controle">${iss.labels.includes("gecontroleerd") ? "✓ Samenvatting is gecontroleerd." : `<span class="muted">AI-samenvattingen kunnen fouten bevatten.</span> <button class="knop secundair klein-knop" data-controleer>✓ Ik heb de samenvatting gecontroleerd</button>`}</div>
        <h3 class="sub">Reacties</h3>${tijdlijn(iss.nr)}${reactieForm(iss)}` : `<p class="muted klein">Reageren kan zodra het document verwerkt is.</p>`}`;
    if (iss) koppelDetail(iss);
    $$("#detail-inhoud [data-tag]").forEach((t) => t.addEventListener("click", () => {
      docFilter.tag = t.dataset.tag; $("#f-tag").value = t.dataset.tag; $("#detail").close(); toonView("documenten"); renderDocumenten();
    }));
    openDialog("#detail");
    history.replaceState(null, "", "#doc-" + d.id);
  }

  function koppelDetail(i) {
    const inhoud = $("#detail-inhoud");
    $$("[data-status]", inhoud).forEach((b) => b.addEventListener("click", async () => {
      if (!eisProfiel()) return;
      const nieuw = b.dataset.status;
      if (nieuw === i.status) return;
      if (nieuw === "klaar") {
        const dod = richtingIssue();
        if (!confirm(`Voldoet deze taak aan de definition of done?${dod ? "\n\n" + zonderMarker(dod.body).split(/##\s*Definition of Done/i)[1]?.split(/\n##\s/)[0]?.trim().slice(0, 600) : ""}`)) return;
      }
      b.disabled = true;
      try {
        const labels = i.labels.filter((l) => !l.startsWith("status:")).concat("status:" + nieuw);
        await gh(`/issues/${i.nr}`, { method: "PATCH", body: JSON.stringify({ labels, state: nieuw === "klaar" ? "closed" : "open" }) });
        await gh(`/issues/${i.nr}/comments`, { method: "POST", body: JSON.stringify({ body: `Status: **${statusNaam(i.status)}** → **${statusNaam(nieuw)}**\n\n${maakMarker({ soort: "status", auteur: profiel.naam, afdeling: profiel.afdeling })}` }) });
        await ververs(); openIssue(i.nr);
      } catch (err) { alert("Status wijzigen mislukt: " + foutUitleg(err)); b.disabled = false; }
    }));
    $("[data-beantwoord]", inhoud)?.addEventListener("click", async (e) => {
      if (!eisProfiel()) return;
      e.target.disabled = true;
      try {
        await gh(`/issues/${i.nr}`, { method: "PATCH", body: JSON.stringify({ state: i.open ? "closed" : "open" }) });
        await gh(`/issues/${i.nr}/comments`, { method: "POST", body: JSON.stringify({ body: `${i.open ? "✓ Gemarkeerd als beantwoord" : "Vraag heropend"}\n\n${maakMarker({ soort: "status", auteur: profiel.naam, afdeling: profiel.afdeling })}` }) });
        await ververs(); openIssue(i.nr);
      } catch (err) { alert("Mislukt: " + foutUitleg(err)); e.target.disabled = false; }
    });
    $("[data-controleer]", inhoud)?.addEventListener("click", async (e) => {
      if (!eisProfiel()) return;
      e.target.disabled = true;
      try {
        await gh(`/issues/${i.nr}/labels`, { method: "POST", body: JSON.stringify({ labels: ["gecontroleerd"] }) });
        await gh(`/issues/${i.nr}/comments`, { method: "POST", body: JSON.stringify({ body: `✓ Samenvatting gecontroleerd en akkoord bevonden.\n\n${maakMarker({ soort: "controle", auteur: profiel.naam, afdeling: profiel.afdeling })}` }) });
        const id = items.find((x) => x.issue === i.nr)?.id;
        await ververs(); if (id) openDocument(id);
      } catch (err) { alert("Mislukt: " + foutUitleg(err)); e.target.disabled = false; }
    });
    const form = $(".reactie-form", inhoud);
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!eisProfiel()) return;
      const st = $(".status", form), knop = $("button", form);
      const tekst = form.tekst.value.trim();
      const soort = form.soort?.value || "reactie";
      const bestanden = form.bestanden ? [...form.bestanden.files] : [];
      const max = (cfg.max_bestand_mb || 50) * 1048576;
      if (!tekst && !bestanden.length) { st.textContent = "Schrijf eerst iets."; st.className = "status fout"; return; }
      if (bestanden.some((f) => f.size > max)) { st.textContent = `Bestanden mogen max ${cfg.max_bestand_mb} MB zijn.`; st.className = "status fout"; return; }
      knop.disabled = true;
      try {
        const bijlage = bestanden.length ? `\n\n📎 ${bestanden.map((f) => f.name).join(", ")}: _wordt geüpload en door AI samengevat; verschijnt hieronder binnen een paar minuten._` : "";
        st.textContent = "Plaatsen…"; st.className = "status";
        await gh(`/issues/${i.nr}/comments`, { method: "POST", body: JSON.stringify({ body: `${tekst}${bijlage}\n\n${maakMarker({ soort, auteur: profiel.naam, afdeling: profiel.afdeling })}` }) });
        if (bestanden.length) {
          await commitInzending(nieuwId(), { naam: profiel.naam, afdeling: i.afd || profiel.afdeling, titel: "", type: "",
            link: "", notitie: `Bij taak "${i.titel}": ${tekst}`, taak: i.nr, ingestuurd_op: nuIso() }, bestanden, (t) => { st.textContent = t; });
        }
        if (i.soort === "taak" && soort === "update" && i.status === "todo") {
          const labels = i.labels.filter((l) => !l.startsWith("status:")).concat("status:bezig");
          await gh(`/issues/${i.nr}`, { method: "PATCH", body: JSON.stringify({ labels }) });
        }
        await ververs();
        const doc = items.find((x) => x.issue === i.nr);
        doc ? openDocument(doc.id) : openIssue(i.nr);
      } catch (err) { st.textContent = "Mislukt: " + foutUitleg(err); st.className = "status fout"; knop.disabled = false; }
    });
  }

  // ================================================================== NIEUW (taak / vraag / besluit / document)
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  const afdOpties = (sel) => cfg.afdelingen.map((a) => opt(a.id, a.naam, a.id === sel)).join("");

  function openNieuw(soort) {
    if (soort !== "document" && !eisProfiel()) return;
    const f = $("#nieuw-form");
    const namen = `<datalist id="namen">${bekendeNamen().map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;
    const titels = { taak: "Nieuwe taak", vraag: "Vraag stellen", besluit: "Besluit vastleggen", document: "Document uploaden" };
    $("#nieuw-titel").textContent = titels[soort];
    f.dataset.soort = soort;
    f.innerHTML = {
      taak: `<label><span class="lbl">Taak</span><input name="titel" required placeholder="Bijv. Literatuuronderzoek AI-feedback"></label>
        <label><span class="lbl">Omschrijving <span class="opt">(wat moet er gebeuren, wat is het resultaat?)</span></span><textarea name="tekst" rows="4"></textarea></label>
        <div class="rij"><label><span class="lbl">Verantwoordelijke</span><input name="verantwoordelijke" list="namen" required value="${esc(profiel.naam)}"></label>
          <label><span class="lbl">Afdeling</span><select name="afdeling">${afdOpties(profiel.afdeling)}</select></label></div>
        <div class="rij"><label><span class="lbl">Deadline <span class="opt">(optioneel)</span></span><input name="deadline" type="date"></label>
          <label><span class="lbl">Status</span><select name="status">${cfg.statussen.map((s) => opt(s.id, s.naam, s.id === "todo")).join("")}</select></label></div>${namen}`,
      vraag: `<label><span class="lbl">Vraag</span><input name="titel" required placeholder="Wat wil je weten?"></label>
        <label><span class="lbl">Toelichting <span class="opt">(optioneel)</span></span><textarea name="tekst" rows="4"></textarea></label>
        <label><span class="lbl">Aan welke afdeling?</span><select name="aan">${afdOpties("centraal")}</select></label>`,
      besluit: `<label><span class="lbl">Besluit</span><input name="titel" required placeholder="Wat is er besloten?"></label>
        <label><span class="lbl">Onderbouwing <span class="opt">(waarom, welke alternatieven, wie waren erbij?)</span></span><textarea name="tekst" rows="5"></textarea></label>
        <div class="rij"><label><span class="lbl">Genomen door</span><select name="afdeling">${afdOpties("centraal")}</select></label>
          <label><span class="lbl">Datum</span><input name="datum" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>`,
      document: `<p class="muted klein">Upload bestanden, deel een link of schrijf een notitie. De AI vat het samen en zet het bij de juiste afdeling. Bestanden blijven volledig downloadbaar.</p>
        <div class="rij"><label><span class="lbl">Afdeling</span><select name="afdeling">${afdOpties(profiel.afdeling)}</select></label>
          <label><span class="lbl">Bij taak <span class="opt">(optioneel)</span></span><select name="taak"><option value="">—</option>${taken().filter((t) => t.status !== "klaar").map((t) => opt(t.nr, t.titel)).join("")}</select></label></div>
        <div class="rij"><label><span class="lbl">Titel <span class="opt">(optioneel)</span></span><input name="titel" placeholder="Leeg: de AI bedenkt er een"></label>
          <label><span class="lbl">Type <span class="opt">(optioneel)</span></span><select name="type"><option value="">Laat de AI kiezen</option>${cfg.types.map((t) => opt(t.id, t.naam)).join("")}</select></label></div>
        <label><span class="lbl">Link <span class="opt">(optioneel)</span></span><input name="link" type="url" placeholder="https://…"></label>
        <label><span class="lbl">Notitie <span class="opt">(wat is dit en waarom is het belangrijk?)</span></span><textarea name="tekst" rows="3"></textarea></label>
        <div class="dropzone" tabindex="0"><input type="file" name="bestanden" multiple hidden>
          <p><strong>Sleep bestanden hierheen</strong> of <button type="button" class="link-knop" data-kies>kies bestanden</button></p>
          <p class="muted klein">PDF, Word, PowerPoint, Excel, afbeeldingen, tekst… max ${cfg.max_bestand_mb || 50} MB per bestand</p>
          <ul class="bestandlijst"></ul></div>`,
    }[soort] + `<div class="acties"><button class="knop" type="submit">${soort === "document" ? "Uploaden" : "Opslaan"}</button><span class="status"></span></div>`;
    if (soort === "document") initDropzone(f);
    openDialog("#nieuw");
    $("input[name=titel]", f)?.focus();
  }

  let gekozen = [];
  function initDropzone(f) {
    gekozen = [];
    const dz = $(".dropzone", f), inp = $("input[type=file]", f), max = (cfg.max_bestand_mb || 50) * 1048576;
    const render = () => {
      $(".bestandlijst", f).innerHTML = gekozen.map((b, k) => `<li class="${b.size > max ? "te-groot" : ""}"><span>${esc(b.name)}</span><span class="muted">${grootte(b.size)}${b.size > max ? " · te groot" : ""}</span><button type="button" data-weg="${k}" aria-label="Verwijder">×</button></li>`).join("");
      $$("[data-weg]", f).forEach((x) => x.addEventListener("click", () => { gekozen.splice(+x.dataset.weg, 1); render(); }));
    };
    const voeg = (l) => { for (const b of l) if (!gekozen.some((g) => g.name === b.name && g.size === b.size)) gekozen.push(b); render(); };
    $("[data-kies]", f).addEventListener("click", () => inp.click());
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
    inp.addEventListener("change", () => { voeg(inp.files); inp.value = ""; });
    ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => voeg(e.dataTransfer.files));
    f.onpaste = (e) => { if (e.clipboardData?.files?.length) voeg(e.clipboardData.files); };
  }

  async function verstuurNieuw(e) {
    e.preventDefault();
    const f = e.target, soort = f.dataset.soort, st = $(".status", f), knop = $("button[type=submit]", f);
    const v = (n) => (f.elements[n]?.value || "").trim();
    if (!eisProfiel()) return;
    $$(".ongeldig", f).forEach((x) => x.classList.remove("ongeldig"));
    const fout = (t, veld) => { st.textContent = t; st.className = "status fout"; if (veld) f.elements[veld]?.classList.add("ongeldig"); };
    if (soort !== "document" && !v("titel")) return fout("Vul een titel in.", "titel");
    if (soort === "taak" && !v("verantwoordelijke")) return fout("Wie is verantwoordelijk?", "verantwoordelijke");
    knop.disabled = true; st.className = "status"; st.textContent = "Opslaan…";
    try {
      const basis = { soort, auteur: profiel.naam, afdeling: profiel.afdeling };
      if (soort === "taak") {
        await maakIssue(v("titel"), v("tekst"), { ...basis, verantwoordelijke: v("verantwoordelijke"), deadline: v("deadline") }, ["taak", `afd:${v("afdeling")}`, `status:${v("status") || "todo"}`]);
      } else if (soort === "vraag") {
        await maakIssue(v("titel"), v("tekst"), { ...basis, aan: v("aan") }, ["vraag", `afd:${profiel.afdeling}`]);
      } else if (soort === "besluit") {
        await maakIssue(v("titel"), v("tekst"), { ...basis, datum: v("datum") }, ["besluit", `afd:${v("afdeling")}`]);
      } else {
        const max = (cfg.max_bestand_mb || 50) * 1048576;
        const link = v("link");
        if (link && !/^https?:\/\/\S+$/i.test(link)) { knop.disabled = false; return fout("De link moet met http(s):// beginnen.", "link"); }
        if (!v("tekst") && !link && !gekozen.length) { knop.disabled = false; return fout("Voeg een bestand, link of notitie toe."); }
        if (gekozen.some((b) => b.size > max)) { knop.disabled = false; return fout(`Haal bestanden groter dan ${cfg.max_bestand_mb} MB weg.`); }
        await commitInzending(nieuwId(), { naam: profiel.naam, afdeling: v("afdeling"), titel: v("titel"), type: v("type"), link,
          notitie: v("tekst"), taak: v("taak") ? +v("taak") : null, ingestuurd_op: nuIso() }, gekozen, (t) => { st.textContent = t; });
        st.className = "status ok";
        st.textContent = "✓ Geüpload! De samenvatting verschijnt binnen een paar minuten bij Documenten.";
        gekozen = []; knop.disabled = false;
        setTimeout(() => $("#nieuw").close(), 1800);
        return;
      }
      $("#nieuw").close();
      await ververs();
      toonView({ taak: "taken", vraag: "vragen", besluit: "besluiten" }[soort]);
    } catch (err) {
      fout("Mislukt: " + foutUitleg(err) + ".");
      if (err.status === 401) { opslag.set("warroom-token", ""); }
    } finally { knop.disabled = false; }
  }

  const maakIssue = (titel, tekst, meta, labels) =>
    gh("/issues", { method: "POST", body: JSON.stringify({ title: titel, body: `${tekst}\n\n${maakMarker(meta)}`, labels }) });

  // ================================================================== uploads (één commit)
  const nuIso = () => new Date().toISOString().replace(/\.\d+Z$/, "+00:00");
  function nieuwId() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const rnd = [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${rnd}`;
  }
  const veiligeNaam = (n) => n.replace(/[\\/]/g, "_").replace(/[^\p{L}\p{N}._\- ()]+/gu, "_").replace(/^[ .]+|[ .]+$/g, "").slice(0, 120) || "bestand";
  const leesBase64 = (file) => new Promise((ok, fout) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1] || "");
    fr.onerror = () => fout(fr.error);
    fr.readAsDataURL(file);
  });

  async function commitInzending(id, meta, bestanden, voortgangCb) {
    const r = repoInfo();
    const entries = [];
    const metaBlob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: JSON.stringify(meta, null, 2), encoding: "utf-8" }) });
    entries.push({ path: `inbox/${id}/meta.json`, mode: "100644", type: "blob", sha: metaBlob.sha });
    const gebruikt = new Set(["meta.json"]);
    for (let k = 0; k < bestanden.length; k++) {
      const f = bestanden[k];
      voortgangCb(`Uploaden ${k + 1}/${bestanden.length}: ${f.name}…`);
      let naam = veiligeNaam(f.name);
      for (let n = 2; gebruikt.has(naam); n++) naam = naam.replace(/(\.[^.]*)?$/, `-${n}$1`);
      gebruikt.add(naam);
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: await leesBase64(f), encoding: "base64" }) });
      entries.push({ path: `inbox/${id}/${naam}`, mode: "100644", type: "blob", sha: blob.sha });
    }
    voortgangCb("Opslaan…");
    for (let poging = 1; ; poging++) {
      try {
        const ref = await gh(`/git/ref/heads/${encodeURIComponent(r.branch)}`);
        const basis = await gh(`/git/commits/${ref.object.sha}`);
        const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: basis.tree.sha, tree: entries }) });
        const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({
          message: `Inzending: ${meta.titel || bestanden[0]?.name || meta.link || "notitie"} (${meta.naam})`, tree: tree.sha, parents: [ref.object.sha] }) });
        await gh(`/git/refs/heads/${encodeURIComponent(r.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return;
      } catch (e) {
        if (e.status === 422 && poging < 4) { await new Promise((ok) => setTimeout(ok, 800 * poging)); continue; }
        throw e;
      }
    }
  }

  // ================================================================== profiel
  function eisProfiel() {
    if (profiel.naam && profiel.afdeling && token()) return true;
    openProfiel();
    return false;
  }
  function openProfiel() {
    const f = $("#profiel-form");
    f.naam.value = profiel.naam;
    f.afdeling.innerHTML = `<option value="">Kies…</option>` + afdOpties(profiel.afdeling);
    f.token.value = "";
    $("#token-status").textContent = token() ? "(opgeslagen ✓, leeg laten om te behouden)" : "";
    openDialog("#profiel");
  }
  function renderProfielKnop() {
    $("#profiel-knop").innerHTML = profiel.naam
      ? `<span class="avatar" style="--afd:${afdKleur(profiel.afdeling)}">${esc(profiel.naam.slice(0, 1).toUpperCase())}</span><span class="pk-tekst">${esc(profiel.naam)}</span>`
      : "Wie ben je?";
  }

  // ================================================================== tabs, dialogen, render
  function toonView(v) {
    $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    $$("[data-view-sectie]").forEach((s) => { s.hidden = s.dataset.viewSectie !== v; });
    opslag.set("warroom-view", v);
    window.scrollTo({ top: 0 });
  }
  function openDialog(sel) {
    const d = $(sel);
    if (!d.open) d.showModal();
  }
  function renderAlles() {
    renderProfielKnop();
    renderStart();
    renderTaken();
    renderVragen();
    renderBesluiten();
    renderRichting();
    renderDocumenten();
    const tags = [...new Set(items.flatMap((i) => i.tags || []))].sort((a, b) => a.localeCompare(b, "nl"));
    const tagSel = $("#f-tag"), tv = tagSel.value;
    tagSel.innerHTML = `<option value="">Alle tags</option>` + tags.map((t) => opt(t, t)).join("");
    tagSel.value = tv;
  }

  function initStatisch() {
    $("#app-naam").textContent = cfg.naam || "War Room";
    document.title = cfg.naam || "War Room";
    $("#challenge").textContent = cfg.challenge || "";
    const r = repoInfo();
    if (r) $("#repo-link").innerHTML = `Alles staat ook in de repo: <a href="https://github.com/${esc(r.owner)}/${esc(r.repo)}">${esc(r.owner)}/${esc(r.repo)}</a>`;
    const afd = cfg.afdelingen.map((a) => opt(a.id, a.naam)).join("");
    $("#taken-afd").insertAdjacentHTML("beforeend", afd);
    $("#f-afdeling").insertAdjacentHTML("beforeend", afd);
    $("#f-type").insertAdjacentHTML("beforeend", cfg.types.map((t) => opt(t.id, t.naam)).join(""));
    $("#f-bron").insertAdjacentHTML("beforeend", ["wetenschappelijk onderzoek", "institutioneel rapport", "expertstandpunt", "nieuws/journalistiek", "beleid/overheid", "commercieel/leverancier", "eigen werk", "overig"].map((b) => opt(b, b)).join(""));

    $$(".tabs button").forEach((b) => b.addEventListener("click", () => toonView(b.dataset.view)));
    $("#taken-afd").addEventListener("change", renderTaken);
    $("#taken-persoon").addEventListener("change", renderTaken);
    $("#vragen-filter").addEventListener("change", renderVragen);
    $("#zoek").addEventListener("input", (e) => { docFilter.zoek = e.target.value; renderDocumenten(); });
    [["#f-afdeling", "afdeling"], ["#f-type", "type"], ["#f-tag", "tag"], ["#f-bron", "bron"], ["#sorteer", "sorteer"]].forEach(([s, k]) =>
      $(s).addEventListener("change", (e) => { docFilter[k] = e.target.value; renderDocumenten(); }));
    $("#wis-filters").addEventListener("click", () => {
      Object.assign(docFilter, { zoek: "", afdeling: "", type: "", tag: "", bron: "" });
      ["#zoek", "#f-afdeling", "#f-type", "#f-tag", "#f-bron"].forEach((s) => { $(s).value = ""; });
      renderDocumenten();
    });
    $("#ververs").addEventListener("click", async (e) => { e.target.classList.add("draait"); await ververs(); e.target.classList.remove("draait"); });
    $("#profiel-knop").addEventListener("click", openProfiel);
    $("#nieuw-form").addEventListener("submit", verstuurNieuw);
    $$("dialog").forEach((d) => {
      d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-sluit]")) d.close(); });
      d.addEventListener("close", () => { if (d.id === "detail") history.replaceState(null, "", location.pathname + location.search); });
    });

    // gedelegeerde klikken
    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-open],[data-doc],[data-nieuw],[data-profiel],[data-view-link]");
      if (!el) return;
      e.preventDefault();
      if (el.dataset.open) { openIssue(el.dataset.open); }
      else if (el.dataset.doc) { openDocument(el.dataset.doc); }
      else if (el.dataset.nieuw) { $("#detail").open && $("#detail").close(); openNieuw(el.dataset.nieuw); }
      else if (el.hasAttribute("data-profiel")) { openProfiel(); }
      else if (el.dataset.viewLink) { toonView(el.dataset.viewLink); }
    });

    $("#profiel-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, st = $("#profiel-status");
      const naam = f.naam.value.trim(), afdeling = f.afdeling.value, nieuwToken = f.token.value.trim();
      if (!naam || !afdeling) { st.textContent = "Vul je naam en afdeling in."; st.className = "status fout"; return; }
      if (!nieuwToken && !token()) { st.textContent = "Vul de teamcode in."; st.className = "status fout"; return; }
      Object.assign(profiel, { naam, afdeling });
      opslag.set("warroom-naam", naam);
      opslag.set("warroom-afdeling", afdeling);
      if (nieuwToken) opslag.set("warroom-token", nieuwToken);
      st.textContent = "Controleren…"; st.className = "status";
      try {
        await gh(""); // test de teamcode
        st.textContent = ""; $("#profiel").close();
        await ververs();
      } catch (err) {
        if (nieuwToken) opslag.set("warroom-token", "");
        st.textContent = "Teamcode werkt niet: " + foutUitleg(err) + "."; st.className = "status fout";
      }
    });

    // auto-verversen elke 2 minuten als het tabblad zichtbaar is en er geen venster open is
    setInterval(() => { if (!document.hidden && !$$("dialog").some((d) => d.open)) ververs(true); }, 120000);
  }

  // ================================================================== start
  async function start() {
    try { cfg = await (await fetch("data/config.json", { cache: "no-store" })).json(); }
    catch { melding("Kon <code>data/config.json</code> niet laden.", "fout"); return; }
    cfg.statussen = cfg.statussen || [{ id: "todo", naam: "Te doen" }, { id: "bezig", naam: "Bezig" }, { id: "review", naam: "Ter review" }, { id: "klaar", naam: "Klaar" }];
    vorigBezoek = +(opslag.get("warroom-bezoek") || 0);
    opslag.set("warroom-bezoek", String(Date.now()));
    initStatisch();
    toonView(opslag.get("warroom-view") || "start");
    await ververs();
    const h = decodeURIComponent(location.hash.slice(1));
    if (/^\d+$/.test(h)) openIssue(h);
    else if (h.startsWith("doc-")) openDocument(h.slice(4));
    if (!profiel.naam || !token()) openProfiel();
  }
  start();
})();
