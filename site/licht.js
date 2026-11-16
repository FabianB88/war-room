/* War Room - licht: document erin, samenvatting, klaar.
 * Teamlink: https://<site>/#code=<teamcode>  -> code wordt in deze browser onthouden.
 */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const opslag = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* */ } },
  };

  // teamcode uit de link halen en meteen uit de adresbalk verwijderen
  const m = location.hash.match(/code=([A-Za-z0-9_]+)/);
  if (m) { opslag.set("warroom-token", m[1]); history.replaceState(null, "", location.pathname + location.search); }
  const token = () => opslag.get("warroom-token");

  let cfg, items = [];
  const wachtend = new Map();   // id -> {naam, sinds}
  const filter = { zoek: "", afd: "" };

  const afdNaam = (id) => cfg.afdelingen.find((a) => a.id === id)?.naam ?? id;
  const afdKleur = (id) => `var(--afd-${id}, var(--zacht))`;
  const grootte = (b) => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " kB";
  const datum = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); };
  const repo = () => {
    if (cfg.repo?.includes("/")) { const [owner, name] = cfg.repo.split("/"); return { owner, name, branch: cfg.branch || "main" }; }
    const h = location.hostname;
    return h.endsWith(".github.io") ? { owner: h.split(".")[0], name: location.pathname.split("/").filter(Boolean)[0], branch: "main" } : null;
  };

  async function gh(pad, opties = {}) {
    const r = repo(), t = token();
    const res = await fetch(`https://api.github.com/repos/${r.owner}/${r.name}${pad}`, {
      ...opties, cache: "no-store",
      headers: { Accept: opties.accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
        ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(opties.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!res.ok) { const e = new Error((await res.json().catch(() => ({}))).message || res.statusText); e.status = res.status; throw e; }
    return res.json();
  }

  // ------------------------------------------------------------ laden
  async function laadItems() {
    // Met teamcode: rechtstreeks uit de repo (direct actueel). Anders: de gepubliceerde site.
    try {
      if (token() && repo()) {
        const r = repo();
        items = await gh(`/contents/site/data/items.json?ref=${r.branch}`, { accept: "application/vnd.github.raw+json" });
      } else {
        items = await (await fetch(`data/items.json?t=${Date.now()}`, { cache: "no-store" })).json();
      }
    } catch {
      try { items = await (await fetch(`data/items.json?t=${Date.now()}`, { cache: "no-store" })).json(); } catch { /* */ }
    }
    for (const id of wachtend.keys()) if (items.some((i) => i.id === id)) wachtend.delete(id);
    render();
  }

  // ------------------------------------------------------------ tonen
  function kaart(i) {
    const ext = (n) => (n.includes(".") ? n.split(".").pop() : "").slice(0, 4).toUpperCase();
    return `<article class="doc" style="--afd:${afdKleur(i.afdeling)}">
      <button class="doc-kop" aria-expanded="false">
        <span class="meta"><span class="chip afd">${esc(afdNaam(i.afdeling))}</span>
          <span class="muted">${esc(datum(i.datum))}${i.ingestuurd_door ? " · " + esc(i.ingestuurd_door) : ""}</span>
          ${i.ai ? "" : `<span class="chip waarschuw">nog geen samenvatting</span>`}</span>
        <span class="doc-titel">${esc(i.titel)}</span>
        ${i.samenvatting ? `<span class="doc-sam">${esc(i.samenvatting)}</span>` : ""}
      </button>
      <div class="doc-meer">
        ${i.kernpunten?.length ? `<ul>${i.kernpunten.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
        ${i.relevantie ? `<p><strong>Waarom relevant:</strong> ${esc(i.relevantie)}</p>` : ""}
        ${i.brontype || i.betrouwbaarheid ? `<p class="muted klein">Bron: ${esc(i.brontype || "–")}${i.betrouwbaarheid ? ` · betrouwbaarheid ${esc(i.betrouwbaarheid)}` : ""}${i.onzekerheden ? ` · ⚠ ${esc(i.onzekerheden)}` : ""}</p>` : ""}
        ${i.notitie ? `<p class="muted"><em>“${esc(i.notitie)}”</em></p>` : ""}
        ${/^https?:\/\//i.test(i.link || "") ? `<p><a href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">${esc(i.link)}</a></p>` : ""}
      </div>
      ${i.bestanden?.length ? `<div class="doc-dl">${i.bestanden.map((b) =>
        `<a href="${esc(encodeURI(b.pad))}" download="${esc(b.naam)}" class="dl"><span class="ext">${esc(ext(b.naam))}</span>${esc(b.naam)} <span class="muted">${grootte(b.grootte)} ↓</span></a>`).join("")}</div>` : ""}
    </article>`;
  }

  function render() {
    const z = filter.zoek.toLowerCase();
    const lijst = items
      .filter((i) => (!filter.afd || i.afdeling === filter.afd) &&
        (!z || [i.titel, i.samenvatting, i.notitie, i.ingestuurd_door, ...(i.tags || []), ...(i.kernpunten || []), ...(i.bestanden || []).map((b) => b.naam)].join(" ").toLowerCase().includes(z)))
      .sort((a, b) => b.datum.localeCompare(a.datum));
    const bezig = [...wachtend.values()].map((w) => `<article class="doc bezig"><span class="spinner" aria-hidden="true"></span>
      <div><span class="doc-titel">${esc(w.naam)}</span><span class="muted klein">Wordt samengevat… dit duurt 1 à 2 minuten. Je kunt gewoon doorgaan.</span></div></article>`).join("");
    $("#lijst").innerHTML = bezig + (lijst.map(kaart).join("") ||
      `<p class="muted leeg">${items.length ? "Niets gevonden." : "Nog geen documenten. Sleep de eerste hierboven!"}</p>`);
    $$("#lijst .doc-kop").forEach((k) => k.addEventListener("click", () => {
      const d = k.closest(".doc"); d.classList.toggle("open"); k.setAttribute("aria-expanded", d.classList.contains("open"));
    }));
  }

  // ------------------------------------------------------------ uploaden
  const status = (t, soort = "") => { const s = $("#status"); s.textContent = t; s.className = "status " + soort; };
  const nieuwId = () => {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    const r = [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${r}`;
  };
  const veiligeNaam = (n) => n.replace(/[\\/]/g, "_").replace(/[^\p{L}\p{N}._\- ()]+/gu, "_").replace(/^[ .]+|[ .]+$/g, "").slice(0, 120) || "bestand";
  const base64 = (f) => new Promise((ok, fout) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => fout(r.error); r.readAsDataURL(f); });

  function klaarVoorUpload() {
    const naam = $("#naam").value.trim(), afd = $("#afdeling").value;
    $("#naam").classList.toggle("ongeldig", !naam);
    $("#afdeling").classList.toggle("ongeldig", !afd);
    if (!token()) { $("#geen-toegang").hidden = false; status("Je hebt eerst de teamlink nodig.", "fout"); return null; }
    if (!naam || !afd) { status("Vul je naam en afdeling in (één keer).", "fout"); return null; }
    opslag.set("warroom-naam", naam); opslag.set("warroom-afdeling", afd);
    return { naam, afd };
  }

  async function verstuur(bestanden) {
    const wie = klaarVoorUpload();
    if (!wie) return;
    const max = (cfg.max_bestand_mb || 50) * 1048576;
    const teGroot = bestanden.find((f) => f.size > max);
    if (teGroot) return status(`${teGroot.name} is te groot (max ${cfg.max_bestand_mb || 50} MB).`, "fout");
    const tekst = $("#notitie").value.trim();
    const link = /^https?:\/\/\S+$/i.test(tekst) ? tekst : (tekst.match(/https?:\/\/\S+/) || [""])[0];
    if (!bestanden.length && !tekst) return status("Voeg een bestand, notitie of link toe.", "fout");

    const id = nieuwId(), r = repo();
    const meta = { naam: wie.naam, afdeling: wie.afd, titel: "", type: "", link, notitie: link === tekst ? "" : tekst,
      ingestuurd_op: new Date().toISOString().replace(/\.\d+Z$/, "+00:00") };
    $("#drop").classList.add("bezig");
    try {
      const entries = [];
      const metaBlob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: JSON.stringify(meta, null, 2), encoding: "utf-8" }) });
      entries.push({ path: `inbox/${id}/meta.json`, mode: "100644", type: "blob", sha: metaBlob.sha });
      const gebruikt = new Set(["meta.json"]);
      for (let k = 0; k < bestanden.length; k++) {
        const f = bestanden[k];
        status(`Uploaden ${k + 1}/${bestanden.length}: ${f.name}…`);
        let naam = veiligeNaam(f.name);
        for (let n = 2; gebruikt.has(naam); n++) naam = naam.replace(/(\.[^.]*)?$/, `-${n}$1`);
        gebruikt.add(naam);
        const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: await base64(f), encoding: "base64" }) });
        entries.push({ path: `inbox/${id}/${naam}`, mode: "100644", type: "blob", sha: blob.sha });
      }
      status("Opslaan…");
      for (let poging = 1; ; poging++) {
        try {
          const ref = await gh(`/git/ref/heads/${r.branch}`);
          const basis = await gh(`/git/commits/${ref.object.sha}`);
          const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: basis.tree.sha, tree: entries }) });
          const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: `Document: ${bestanden[0]?.name || link || "notitie"} (${wie.naam})`, tree: tree.sha, parents: [ref.object.sha] }) });
          await gh(`/git/refs/heads/${r.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
          break;
        } catch (e) { if (e.status === 422 && poging < 4) { await new Promise((ok) => setTimeout(ok, 800 * poging)); continue; } throw e; }
      }
      wachtend.set(id, { naam: bestanden.map((f) => f.name).join(", ") || link || "Notitie", sinds: Date.now() });
      $("#notitie").value = "";
      status("✓ Gedeeld! De samenvatting verschijnt hieronder vanzelf.", "ok");
      render();
      volg();
    } catch (e) {
      if (e.status === 401) { opslag.set("warroom-token", ""); $("#geen-toegang").hidden = false; }
      status("Uploaden mislukt: " + (e.status === 401 ? "de teamcode klopt niet of is verlopen" : e.status === 403 || e.status === 404 ? "de teamcode heeft geen schrijfrechten" : e.message) + ".", "fout");
    } finally { $("#drop").classList.remove("bezig"); }
  }

  let volgTimer = null;
  function volg() {
    clearInterval(volgTimer);
    volgTimer = setInterval(async () => {
      for (const [id, w] of wachtend) if (Date.now() - w.sinds > 15 * 60000) wachtend.delete(id);
      if (!wachtend.size) return clearInterval(volgTimer);
      await laadItems();
    }, 12000);
  }

  // ------------------------------------------------------------ start
  async function start() {
    cfg = await (await fetch("data/config.json", { cache: "no-store" })).json();
    $("#challenge").textContent = cfg.challenge || "";
    const opties = cfg.afdelingen.map((a) => `<option value="${esc(a.id)}">${esc(a.naam)}</option>`).join("");
    $("#afdeling").insertAdjacentHTML("beforeend", opties);
    $("#filter-afd").insertAdjacentHTML("beforeend", opties);
    $("#naam").value = opslag.get("warroom-naam") || "";
    $("#afdeling").value = opslag.get("warroom-afdeling") || "";
    $("#geen-toegang").hidden = !!token();

    const drop = $("#drop"), inp = $("#bestand");
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
    inp.addEventListener("change", () => { const f = [...inp.files]; inp.value = ""; if (f.length) verstuur(f); });
    ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => { const f = [...e.dataTransfer.files]; if (f.length) verstuur(f); });
    document.addEventListener("paste", (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) verstuur(f); });
    $("#alleen-tekst").addEventListener("click", () => verstuur([]));
    $("#code").addEventListener("change", (e) => { const v = e.target.value.trim(); if (v) { opslag.set("warroom-token", v); e.target.value = ""; $("#geen-toegang").hidden = true; status("Teamcode opgeslagen ✓", "ok"); laadItems(); } });
    $("#zoek").addEventListener("input", (e) => { filter.zoek = e.target.value; render(); });
    $("#filter-afd").addEventListener("change", (e) => { filter.afd = e.target.value; render(); });

    await laadItems();
    setInterval(() => { if (!document.hidden) laadItems(); }, 60000);
  }
  start();
})();
