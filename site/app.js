/* War Room - overzicht + insturen.
 * Overzicht: leest data/items.json (gemaakt door scripts/verwerk_inbox.py).
 * Insturen: schrijft één commit met meta.json + bestanden naar inbox/<id>/ via de GitHub API.
 */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const opslag = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* geen opslag */ } },
  };

  let cfg = null;
  let items = [];
  const filter = { zoek: "", afdeling: "", type: "", tag: "", sorteer: "nieuw" };

  // ------------------------------------------------------------------ helpers
  const afdNaam = (id) => cfg.afdelingen.find((a) => a.id === id)?.naam ?? id;
  const typeNaam = (id) => cfg.types.find((t) => t.id === id)?.naam ?? id;
  const afdKleur = (id) => `var(--afd-${id}, var(--zacht))`;
  const grootte = (b) => b >= 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " kB";
  const datum = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  };

  function repoInfo() {
    if (cfg.repo && cfg.repo.includes("/")) {
      const [owner, repo] = cfg.repo.split("/");
      return { owner, repo, branch: cfg.branch || "main" };
    }
    const h = location.hostname;
    if (h.endsWith(".github.io")) {
      const owner = h.split(".")[0];
      const seg = location.pathname.split("/").filter(Boolean)[0];
      return { owner, repo: seg || h, branch: cfg.branch || "main" };
    }
    return null;
  }

  // ------------------------------------------------------------------ laden
  async function laad() {
    try {
      cfg = await (await fetch("data/config.json", { cache: "no-store" })).json();
    } catch {
      $("#lijst").innerHTML = `<div class="leeg">Kon <code>data/config.json</code> niet laden.</div>`;
      return;
    }
    try {
      items = await (await fetch("data/items.json", { cache: "no-store" })).json();
    } catch { items = []; }

    $("#app-naam").textContent = cfg.naam || "War Room";
    document.title = cfg.naam || "War Room";
    $("#challenge").textContent = cfg.challenge || "";
    $("#max-mb").textContent = cfg.max_bestand_mb || 50;

    const r = repoInfo();
    if (r) $("#repo-link").innerHTML = `Alles staat ook in de repo: <a href="https://github.com/${esc(r.owner)}/${esc(r.repo)}">${esc(r.owner)}/${esc(r.repo)}</a> · bestanden per afdeling in <code>afdelingen/</code>`;

    vulSelects();
    renderAfdelingen();
    render();
    initForm();
    toonWachtrij();
  }

  function vulSelects() {
    const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
    $("#f-afdeling").insertAdjacentHTML("beforeend", cfg.afdelingen.map((a) => opt(a.id, a.naam)).join(""));
    $("#f-type").insertAdjacentHTML("beforeend", cfg.types.map((t) => opt(t.id, t.naam)).join(""));
    const tags = [...new Set(items.flatMap((i) => i.tags || []))].sort((a, b) => a.localeCompare(b, "nl"));
    $("#f-tag").insertAdjacentHTML("beforeend", tags.map((t) => opt(t, t)).join(""));
    $("#i-afdeling").innerHTML = `<option value="">Kies…</option>` + cfg.afdelingen.map((a) => opt(a.id, a.naam)).join("");
    $("#i-type").insertAdjacentHTML("beforeend", cfg.types.map((t) => opt(t.id, t.naam)).join(""));
  }

  // ------------------------------------------------------------------ overzicht
  function renderAfdelingen() {
    $("#afdelingen").innerHTML = cfg.afdelingen.map((a) => {
      const n = items.filter((i) => i.afdeling === a.id).length;
      const gedeeld = items.filter((i) => i.afdeling !== a.id && (i.ook_relevant_voor || []).includes(a.id)).length;
      return `<button class="afd-kaart" data-afd="${esc(a.id)}" aria-pressed="false" style="--afd:${afdKleur(a.id)}">
        <span class="getal">${n}${gedeeld ? ` <span class="muted klein">+${gedeeld} gedeeld</span>` : ""}</span><span class="naam">${esc(a.naam)}</span>
        <span class="muted klein">${esc(a.omschrijving || "")}</span></button>`;
    }).join("");
    $$("#afdelingen .afd-kaart").forEach((b) => b.addEventListener("click", () => {
      filter.afdeling = filter.afdeling === b.dataset.afd ? "" : b.dataset.afd;
      $("#f-afdeling").value = filter.afdeling;
      render();
    }));
  }

  function gefilterd() {
    const z = filter.zoek.trim().toLowerCase();
    let lijst = items.filter((i) =>
      (!filter.afdeling || i.afdeling === filter.afdeling || (i.ook_relevant_voor || []).includes(filter.afdeling)) &&
      (!filter.type || i.type === filter.type) &&
      (!filter.tag || (i.tags || []).includes(filter.tag)) &&
      (!z || [i.titel, i.samenvatting, i.notitie, i.relevantie, i.ingestuurd_door, ...(i.tags || []), ...(i.kernpunten || []),
        ...(i.bestanden || []).map((b) => b.naam)].join(" ").toLowerCase().includes(z)));
    const s = filter.sorteer;
    lijst.sort((a, b) =>
      s === "oud" ? a.datum.localeCompare(b.datum) :
      s === "titel" ? a.titel.localeCompare(b.titel, "nl") :
      s === "afdeling" ? afdNaam(a.afdeling).localeCompare(afdNaam(b.afdeling), "nl") || b.datum.localeCompare(a.datum) :
      s === "type" ? typeNaam(a.type).localeCompare(typeNaam(b.type), "nl") || b.datum.localeCompare(a.datum) :
      b.datum.localeCompare(a.datum));
    return lijst;
  }

  function itemHtml(i) {
    const r = repoInfo();
    const ext = (n) => (n.includes(".") ? n.split(".").pop() : "bestand").slice(0, 5);
    const ook = (i.ook_relevant_voor || []).map((a) => `<span class="chip">ook voor ${esc(afdNaam(a))}</span>`).join("");
    const link = /^https?:\/\//i.test(i.link || "") ? i.link : "";
    return `<article class="item" style="--afd:${afdKleur(i.afdeling)}" data-id="${esc(i.id)}">
      <button class="item-kop" aria-expanded="false">
        <div class="meta">
          <span class="chip afd">${esc(afdNaam(i.afdeling))}</span>
          <span class="chip">${esc(typeNaam(i.type))}</span>
          ${ook}
          ${i.bestanden?.length ? `<span class="chip">📎 ${i.bestanden.length}</span>` : ""}
          ${!i.ai ? `<span class="chip waarschuw" title="${esc(i.ai_fout || "")}">nog niet samengevat</span>` : ""}
          <span class="muted">${esc(datum(i.datum))}${i.ingestuurd_door ? " · " + esc(i.ingestuurd_door) : ""}</span>
        </div>
        <h3>${esc(i.titel)}</h3>
        ${i.samenvatting ? `<p class="samenvatting">${esc(i.samenvatting)}</p>` : ""}
      </button>
      <div class="item-body">
        ${i.kernpunten?.length ? `<h4>Kernpunten</h4><ul>${i.kernpunten.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
        ${i.relevantie ? `<h4>Wat betekent dit voor de challenge?</h4><p>${esc(i.relevantie)}</p>` : ""}
        ${i.tags?.length ? `<h4>Tags</h4><div class="tags">${i.tags.map((t) => `<button class="chip" data-tag="${esc(t)}">#${esc(t)}</button>`).join("")}</div>` : ""}
        ${i.notitie && i.ai ? `<h4>Notitie van ${esc(i.ingestuurd_door || "de indiener")}</h4><p>${esc(i.notitie)}</p>` : ""}
        ${link ? `<h4>Link</h4><p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></p>` : ""}
        ${i.bestanden?.length ? `<h4>Bestanden</h4><div class="downloads">${i.bestanden.map((b) =>
          `<a class="download" href="${esc(encodeURI(b.pad))}" download="${esc(b.naam)}">
             <span class="ext">${esc(ext(b.naam))}</span><span class="bnaam">${esc(b.naam)}</span><span class="grootte">${grootte(b.grootte)} ↓</span></a>`).join("")}</div>` : ""}
        ${i.opmerkingen?.length ? `<h4>Let op</h4><ul class="muted">${i.opmerkingen.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
        <div class="item-voet">
          ${r && i.md_pad ? `<a href="https://github.com/${esc(r.owner)}/${esc(r.repo)}/blob/${esc(r.branch)}/${esc(encodeURI(i.md_pad))}" target="_blank" rel="noopener">Bekijk op GitHub</a>` : ""}
          <a href="#${esc(i.id)}" data-kopieer="${esc(i.id)}">Link kopiëren</a>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const lijst = gefilterd();
    $$("#afdelingen .afd-kaart").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.afd === filter.afdeling)));
    const actief = filter.zoek || filter.afdeling || filter.type || filter.tag;
    $("#wis-filters").hidden = !actief;
    $("#aantal").textContent = `${lijst.length} van ${items.length} inzending${items.length === 1 ? "" : "en"}`;
    $("#lijst").innerHTML = lijst.length ? lijst.map(itemHtml).join("") :
      `<div class="leeg"><p><strong>${items.length ? "Niets gevonden met deze filters." : "Nog geen inzendingen."}</strong></p>
       <p class="muted">${items.length ? "" : "Stuur het eerste stuk in via “+ Insturen”."}</p></div>`;

    $$("#lijst .item-kop").forEach((k) => k.addEventListener("click", () => {
      const art = k.closest(".item");
      art.classList.toggle("open");
      k.setAttribute("aria-expanded", art.classList.contains("open"));
    }));
    $$("#lijst [data-tag]").forEach((t) => t.addEventListener("click", () => {
      filter.tag = t.dataset.tag; $("#f-tag").value = filter.tag; render(); window.scrollTo({ top: 0, behavior: "smooth" });
    }));
    $$("#lijst [data-kopieer]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const url = location.href.split("#")[0] + "#" + a.dataset.kopieer;
      navigator.clipboard?.writeText(url).then(() => { a.textContent = "Gekopieerd ✓"; });
    }));

    // direct openen via #id
    const id = decodeURIComponent(location.hash.slice(1));
    const doel = id && $(`#lijst .item[data-id="${CSS.escape(id)}"]`);
    if (doel && !doel.classList.contains("open")) { doel.classList.add("open"); doel.scrollIntoView({ block: "start" }); }
  }

  function initFilters() {
    $("#zoek").addEventListener("input", (e) => { filter.zoek = e.target.value; render(); });
    [["#f-afdeling", "afdeling"], ["#f-type", "type"], ["#f-tag", "tag"], ["#sorteer", "sorteer"]].forEach(([sel, k]) =>
      $(sel).addEventListener("change", (e) => { filter[k] = e.target.value; render(); }));
    $("#wis-filters").addEventListener("click", () => {
      Object.assign(filter, { zoek: "", afdeling: "", type: "", tag: "" });
      $("#zoek").value = ""; $("#f-afdeling").value = ""; $("#f-type").value = ""; $("#f-tag").value = "";
      render();
    });
  }

  // ------------------------------------------------------------------ tabs
  function toonView(v) {
    $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    $("#view-overzicht").hidden = v !== "overzicht";
    $("#view-insturen").hidden = v !== "insturen";
  }

  // ------------------------------------------------------------------ GitHub API
  async function gh(pad, opties = {}) {
    const r = repoInfo();
    const token = opslag.get("warroom-token");
    const res = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}${pad}`, {
      ...opties,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  async function toonWachtrij() {
    const r = repoInfo();
    if (!r || !opslag.get("warroom-token")) return;
    try {
      const inhoud = await gh(`/contents/inbox?ref=${encodeURIComponent(r.branch)}`);
      const n = inhoud.filter((x) => x.type === "dir").length;
      if (n) {
        const w = $("#wachtrij");
        w.hidden = false;
        w.textContent = `⏳ ${n} inzending${n === 1 ? " wordt" : "en worden"} nu samengevat. Ververs de pagina over een paar minuten.`;
      }
    } catch { /* geen toegang of geen inbox: niets tonen */ }
  }

  const leesBase64 = (file) => new Promise((ok, fout) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(",")[1] || "");
    fr.onerror = () => fout(fr.error);
    fr.readAsDataURL(file);
  });

  function nieuwId() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const rnd = [...crypto.getRandomValues(new Uint8Array(2))].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${rnd}`;
  }

  const veiligeNaam = (n) => n.replace(/[\\/]/g, "_").replace(/[^\p{L}\p{N}._\- ()]+/gu, "_").replace(/^[ .]+|[ .]+$/g, "").slice(0, 120) || "bestand";

  /** Eén commit met alle bestanden: blobs -> tree -> commit -> ref. */
  async function commitInzending(id, meta, bestanden, voortgang) {
    const r = repoInfo();
    const entries = [];
    const metaBlob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: JSON.stringify(meta, null, 2), encoding: "utf-8" }) });
    entries.push({ path: `inbox/${id}/meta.json`, mode: "100644", type: "blob", sha: metaBlob.sha });

    const gebruikt = new Set(["meta.json"]);
    for (let k = 0; k < bestanden.length; k++) {
      const f = bestanden[k];
      voortgang(`Uploaden ${k + 1}/${bestanden.length}: ${f.name}…`);
      let naam = veiligeNaam(f.name);
      for (let n = 2; gebruikt.has(naam); n++) naam = naam.replace(/(\.[^.]*)?$/, `-${n}$1`);
      gebruikt.add(naam);
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: await leesBase64(f), encoding: "base64" }) });
      entries.push({ path: `inbox/${id}/${naam}`, mode: "100644", type: "blob", sha: blob.sha });
    }

    voortgang("Opslaan…");
    for (let poging = 1; ; poging++) {
      try {
        const ref = await gh(`/git/ref/heads/${encodeURIComponent(r.branch)}`);
        const basis = await gh(`/git/commits/${ref.object.sha}`);
        const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: basis.tree.sha, tree: entries }) });
        const commit = await gh("/git/commits", {
          method: "POST",
          body: JSON.stringify({ message: `Inzending: ${meta.titel || bestanden[0]?.name || meta.link || "notitie"} (${meta.naam})`, tree: tree.sha, parents: [ref.object.sha] }),
        });
        await gh(`/git/refs/heads/${encodeURIComponent(r.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return;
      } catch (e) {
        // iemand anders was net eerder: opnieuw proberen op de nieuwste versie
        if (e.status === 422 && poging < 4) { await new Promise((ok) => setTimeout(ok, 800 * poging)); continue; }
        throw e;
      }
    }
  }

  // ------------------------------------------------------------------ formulier
  let gekozen = [];

  function renderBestanden() {
    const max = (cfg.max_bestand_mb || 50) * 1048576;
    $("#bestandlijst").innerHTML = gekozen.map((f, k) =>
      `<li class="${f.size > max ? "te-groot" : ""}"><span>${esc(f.name)}</span><span class="muted">${grootte(f.size)}${f.size > max ? " · te groot" : ""}</span>
       <button type="button" data-weg="${k}" aria-label="Verwijder ${esc(f.name)}">×</button></li>`).join("");
    $$("#bestandlijst [data-weg]").forEach((b) => b.addEventListener("click", () => { gekozen.splice(+b.dataset.weg, 1); renderBestanden(); }));
  }

  function voegToe(lijst) {
    for (const f of lijst) if (!gekozen.some((g) => g.name === f.name && g.size === f.size)) gekozen.push(f);
    renderBestanden();
  }

  function zetStatus(tekst, soort = "") {
    const s = $("#status");
    s.textContent = tekst;
    s.className = "status " + soort;
  }

  function updateToegang() {
    const heeft = !!opslag.get("warroom-token");
    $("#toegang-status").textContent = heeft ? "· opgeslagen ✓" : "· nog niet ingevuld";
    if (!heeft) $("#toegang").open = true;
  }

  function initForm() {
    const form = $("#form");
    $("#i-naam").value = opslag.get("warroom-naam") || "";
    $("#i-afdeling").value = opslag.get("warroom-afdeling") || "";
    updateToegang();

    $("#i-token").addEventListener("change", (e) => { opslag.set("warroom-token", e.target.value.trim()); e.target.value = ""; updateToegang(); toonWachtrij(); });

    const dz = $("#dropzone"), inp = $("#i-bestanden");
    $("#kies").addEventListener("click", () => inp.click());
    dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } });
    inp.addEventListener("change", () => { voegToe(inp.files); inp.value = ""; });
    ["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("over"); }));
    ["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
    dz.addEventListener("drop", (e) => voegToe(e.dataTransfer.files));
    // plakken van screenshots
    document.addEventListener("paste", (e) => { if (!$("#view-insturen").hidden && e.clipboardData?.files?.length) voegToe(e.clipboardData.files); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tokenVeld = $("#i-token");
      if (tokenVeld.value.trim()) { opslag.set("warroom-token", tokenVeld.value.trim()); tokenVeld.value = ""; updateToegang(); }
      const fd = new FormData(form);
      const meta = {
        naam: String(fd.get("naam") || "").trim(),
        afdeling: String(fd.get("afdeling") || ""),
        titel: String(fd.get("titel") || "").trim(),
        type: String(fd.get("type") || ""),
        link: String(fd.get("link") || "").trim(),
        notitie: String(fd.get("notitie") || "").trim(),
        ingestuurd_op: new Date().toISOString().replace(/\.\d+Z$/, "+00:00"),
      };
      $$(".ongeldig", form).forEach((x) => x.classList.remove("ongeldig"));
      const max = (cfg.max_bestand_mb || 50) * 1048576;

      const fouten = [];
      if (!meta.naam) { fouten.push("vul je naam in"); $("#i-naam").classList.add("ongeldig"); }
      if (!meta.afdeling) { fouten.push("kies een afdeling"); $("#i-afdeling").classList.add("ongeldig"); }
      if (meta.link && !/^https?:\/\/\S+$/i.test(meta.link)) { fouten.push("de link moet met http(s):// beginnen"); form.link.classList.add("ongeldig"); }
      if (!meta.notitie && !meta.link && !gekozen.length) fouten.push("voeg een bestand, link of notitie toe");
      if (gekozen.some((f) => f.size > max)) fouten.push(`haal bestanden groter dan ${cfg.max_bestand_mb} MB weg`);
      if (!repoInfo()) fouten.push("de site weet niet bij welke repo hij hoort (vul 'repo' in data/config.json)");
      if (!opslag.get("warroom-token")) { fouten.push("vul de teamcode in"); $("#toegang").open = true; }
      if (fouten.length) { zetStatus("Nog even: " + fouten.join(", ") + ".", "fout"); return; }

      opslag.set("warroom-naam", meta.naam);
      opslag.set("warroom-afdeling", meta.afdeling);
      const knop = $("#verstuur");
      knop.disabled = true;
      try {
        await commitInzending(nieuwId(), meta, gekozen, (t) => zetStatus(t));
        zetStatus("✓ Ingestuurd! De samenvatting verschijnt binnen een paar minuten in het overzicht.", "ok");
        form.titel.value = ""; form.link.value = ""; form.notitie.value = ""; form.type.value = "";
        gekozen = []; renderBestanden();
        toonWachtrij();
      } catch (err) {
        const uitleg =
          err.status === 401 ? "de teamcode klopt niet of is verlopen" :
          err.status === 403 || err.status === 404 ? "de teamcode heeft geen schrijfrechten op deze repo" :
          err.status === 422 ? "het bestand is te groot of iemand anders sloeg net iets op; probeer opnieuw" :
          err.message || "onbekende fout";
        if (err.status === 401) { opslag.set("warroom-token", ""); updateToegang(); }
        zetStatus("Insturen mislukt: " + uitleg + ".", "fout");
      } finally {
        knop.disabled = false;
      }
    });
  }

  // ------------------------------------------------------------------ start
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => toonView(b.dataset.view)));
  initFilters();
  laad();
})();
