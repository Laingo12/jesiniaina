/* =====================================================================
   BACK-OFFICE DU PORTFOLIO
   ---------------------------------------------------------------------
   Deux modes de stockage (« backends ») avec la même interface :
     • GitHub  : lecture/écriture via l'API GitHub avec un jeton personnel.
                 « Publier » crée UN commit (config.js + images + CV) ;
                 Netlify redéploie automatiquement le site.
     • Local   : dossier de l'ordinateur (File System Access API, Edge/Chrome).
   Les modifications restent en brouillon (aperçu en direct) jusqu'au clic
   sur « Publier ». Le brouillon des réglages est gardé dans le navigateur.
   ===================================================================== */
(function () {
"use strict";

/* ============================================================
   OUTILS
   ============================================================ */
var AC = window.ADMIN_CONFIG || {};
var $ = function (s) { return document.querySelector(s); };
var EXTS = ["jpg", "jpeg", "png", "webp"];
var ROOT = (AC.root || "").replace(/^\/+|\/+$/g, "");           // sous-dossier du site dans le dépôt
function rp(p) { return ROOT ? ROOT + "/" + p : p; }              // chemin dans le dépôt

function el(tag, attrs, kids) {
  var n = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) {
    if (k === "text") n.textContent = attrs[k];
    else if (k === "class") n.className = attrs[k];
    else n.setAttribute(k, attrs[k]);
  });
  (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return n;
}
function status(m, kind) {
  var s = $("#status"); s.textContent = m;
  s.style.color = kind === "err" ? "#ffd2c2" : kind === "ok" ? "#c9f5d9" : "";
}
function clean(n) { return n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-"); }
function store(kind) { try { var s = window[kind]; s.setItem("__t", "1"); s.removeItem("__t"); return s; } catch (e) { return null; } }
var LS = store("localStorage"), SS = store("sessionStorage");
function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " Mo" : Math.max(1, Math.round(n / 1024)) + " Ko"; }

/* ---------- Base64 ---------- */
function textToB64(t) {
  var bytes = new TextEncoder().encode(t), bin = "";
  for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function blobToB64(b) {
  return new Promise(function (res, rej) {
    var r = new FileReader();
    r.onload = function () { res(String(r.result).split(",")[1] || ""); };
    r.onerror = function () { rej(r.error); };
    r.readAsDataURL(b);
  });
}

/* ============================================================
   BACKEND GITHUB
   ============================================================ */
function GitHubBackend(repo, branch, token) {
  var api = "https://api.github.com/repos/" + repo;
  function enc(p) { return p.split("/").map(encodeURIComponent).join("/"); }
  function explain(code, body) {
    if (code === 401) return "Jeton invalide ou expiré.";
    if (code === 403) return /rate limit/i.test(body) ? "Trop de requêtes vers GitHub : réessayez dans quelques minutes." : "Ce jeton n'a pas le droit de modifier le dépôt (permission « Contents : Read and write »).";
    if (code === 404) return "Dépôt, branche ou fichier introuvable (ou jeton sans accès à ce dépôt).";
    if (code === 409 || code === 422) return "Le dépôt a changé entre-temps : rechargez la page puis republiez.";
    return "Erreur GitHub " + code + ".";
  }
  async function gh(path, o) {
    o = o || {};
    var h = { "Authorization": "Bearer " + token, "Accept": o.accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (o.body) h["Content-Type"] = "application/json";
    var r;
    try { r = await fetch(api + path, { method: o.method || "GET", headers: h, body: o.body ? JSON.stringify(o.body) : undefined, cache: "no-store" }); }
    catch (e) { var ne = new Error("Connexion à GitHub impossible. Vérifiez Internet."); ne.status = 0; throw ne; }
    if (!r.ok) { var t = await r.text().catch(function () { return ""; }); var er = new Error(explain(r.status, t)); er.status = r.status; throw er; }
    if (o.raw) return r;
    return r.status === 204 ? null : r.json();
  }
  var q = "?ref=" + encodeURIComponent(branch);
  return {
    kind: "github", label: repo + (branch !== "main" ? " (" + branch + ")" : ""),
    check: async function () {
      var info;
      try { info = await gh(""); }
      catch (e) {
        if (e.status === 404) e.message = "Le dépôt « " + repo + " » est introuvable avec ce jeton. Vérifiez : 1) le nom exact du compte et du dépôt ; " +
          "2) que le jeton a bien accès à ce dépôt (Repository access → Only select repositories → " + repo.split("/")[1] + ") ; " +
          "3) que le jeton a été créé APRÈS le dépôt, sinon modifiez-le pour ajouter le dépôt.";
        throw e;
      }
      try { await gh("/git/ref/heads/" + enc(branch)); }
      catch (e) {
        if (e.status === 404 || e.status === 409) e.message = "Le dépôt est trouvé, mais la branche « " + branch + " » n'existe pas : le dépôt est sans doute encore vide. " +
          "Envoyez d'abord les fichiers du portfolio sur GitHub (« uploading an existing file »), puis reconnectez-vous.";
        throw e;
      }
      return info;
    },
    readText: async function (p) { return (await gh("/contents/" + enc(rp(p)) + q, { accept: "application/vnd.github.raw+json", raw: true })).text(); },
    readBlob: async function (p) {
      try { return await (await gh("/contents/" + enc(rp(p)) + q, { accept: "application/vnd.github.raw+json", raw: true })).blob(); }
      catch (e) { if (e.status === 404) return null; throw e; }
    },
    list: async function (dir) {
      try { var d = await gh("/contents/" + enc(rp(dir)) + q); return Array.isArray(d) ? d.filter(function (x) { return x.type === "file"; }).map(function (x) { return x.name; }) : []; }
      catch (e) { if (e.status === 404) return []; throw e; }
    },
    /* Un seul commit pour tous les fichiers (API Git Data) */
    publish: async function (files, message, progress) {
      var ref = await gh("/git/ref/heads/" + enc(branch)), head = ref.object.sha;
      var commit = await gh("/git/commits/" + head), tree = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        progress && progress("Envoi " + (i + 1) + "/" + files.length + " : " + f.path.split("/").pop());
        var content = typeof f.content === "string" ? textToB64(f.content) : await blobToB64(f.content);
        var b = await gh("/git/blobs", { method: "POST", body: { content: content, encoding: "base64" } });
        tree.push({ path: rp(f.path), mode: "100644", type: "blob", sha: b.sha });
      }
      progress && progress("Création de la version…");
      var t = await gh("/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: tree } });
      var c = await gh("/git/commits", { method: "POST", body: { message: message, tree: t.sha, parents: [head] } });
      await gh("/git/refs/heads/" + enc(branch), { method: "PATCH", body: { sha: c.sha, force: false } });
      return c.sha;
    }
  };
}

/* ============================================================
   BACKEND DOSSIER LOCAL
   ============================================================ */
function LocalBackend(root) {
  async function sub(p, create) { var d = root; for (const s of p.split("/").filter(Boolean)) d = await d.getDirectoryHandle(s, { create: !!create }); return d; }
  function split(p) { var i = p.lastIndexOf("/"); return [i < 0 ? "" : p.slice(0, i), p.slice(i + 1)]; }
  return {
    kind: "local", label: "dossier « " + root.name + " »", root: root,
    check: async function () { await root.getFileHandle("index.html"); },
    readText: async function (p) { var s = split(p); return (await (await (await sub(s[0])).getFileHandle(s[1])).getFile()).text(); },
    readBlob: async function (p) { try { var s = split(p); return await (await (await sub(s[0])).getFileHandle(s[1])).getFile(); } catch (e) { return null; } },
    list: async function (dir) {
      try { var d = await sub(dir), out = []; for await (const [name, h] of d.entries()) if (h.kind === "file") out.push(name); return out; }
      catch (e) { return []; }
    },
    remove: async function (p) { var s = split(p); try { await (await sub(s[0])).removeEntry(s[1]); } catch (e) {} },
    publish: async function (files, message, progress) {
      for (var i = 0; i < files.length; i++) {
        var s = split(files[i].path);
        progress && progress("Écriture " + (i + 1) + "/" + files.length);
        var fh = await (await sub(s[0], true)).getFileHandle(s[1], { create: true }), w = await fh.createWritable();
        await w.write(files[i].content); await w.close();
      }
    }
  };
}

/* ============================================================
   ÉTAT
   ============================================================ */
var backend, cfg, baseSnap = "", doc, tokens = {}, currentAnchor = "";
var staged = new Map();        // chemin -> Blob (images, CV) à publier
var objUrls = new Map();       // chemin -> URL locale (aperçu)
var dirCache = {}, blobCache = {};

function snapshot(c) { var x = JSON.parse(JSON.stringify(c)); delete x.publishedAt; return JSON.stringify(x); }
function countDiff(a, b) {
  if (a === b) return 0;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return 1;
  var keys = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { keys[k] = 1; });
  return Object.keys(keys).reduce(function (n, k) {
    var va = a[k], vb = b[k];
    if ((va === undefined || va === "") && (vb === undefined || vb === "")) return n;
    return n + countDiff(va, vb);
  }, 0);
}
function changesCount() {
  var cur = JSON.parse(snapshot(cfg)), base = JSON.parse(baseSnap || "{}");
  return countDiff(base, cur) + staged.size;
}
function isDirty() { return changesCount() > 0; }

/* ============================================================
   CONFIG : lecture / texte
   ============================================================ */
async function readCfg() {
  var t = await backend.readText("assets/js/config.js"), w = {};
  new Function("window", t)(w);
  var c = w.SITE_CONFIG || {};
  c.theme = c.theme || {}; c.style = c.style || {}; c.sections = c.sections || {}; c.texts = c.texts || {}; c.images = c.images || {};
  return c;
}
function cfgText() {
  return "/* ============================================================\n" +
    "   CONFIG DU SITE — générée par le back-office (/admin), modifiable aussi à la main.\n" +
    "   Liens : valeur vide = bouton masqué.\n" +
    "   theme : couleurs #rrggbb (vide = charte du CV), font, headingFont, radius (px).\n" +
    "   style : mode, finition, boutons, bordures, photos, fond, animations, mise en page, effets.\n" +
    "   sections : { \"cle\": false } = section masquée.\n" +
    "   texts : { \"cle data-edit\": \"texte\" } ; texte vide = élément masqué ; listes = une ligne par élément.\n" +
    "   images : { \"dossier/cle\": \"nom-du-fichier.jpg\" } ; vide = <cle>.jpg/.png/.webp\n" +
    "   ============================================================ */\n" +
    "window.SITE_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n";
}

/* ============================================================
   MODIFICATIONS, BROUILLON, PUBLICATION
   ============================================================ */
var draftKey = function () { return "portfolio-draft:" + backend.kind + ":" + backend.label; };
function saveDraft() {
  if (!LS) return;
  try { if (isDirty()) LS.setItem(draftKey(), JSON.stringify({ at: Date.now(), cfg: cfg })); else LS.removeItem(draftKey()); } catch (e) {}
}
function updateBar() {
  if (backend && backend.kind === "local") { $("#discard").hidden = true; return; }
  var n = changesCount(), p = $("#publish");
  p.disabled = n === 0; $("#count").textContent = n;
  $("#discard").hidden = n === 0;
  p.title = n ? n + " modification(s) à publier" : "Aucune modification";
}
/* live = true : style/couleurs appliqués instantanément ; sinon l'aperçu est rechargé */
function changed(live) {
  setPreviewConfig();
  if (backend.kind === "local") {             // dossier local : enregistrement automatique
    if (live) pushTheme();
    autosave(!live);
    return;
  }
  if (live) pushTheme(); else { clearTimeout(changed.t); changed.t = setTimeout(reloadPreview, 200); }
  updateBar(); saveDraft();
  status(isDirty() ? "Modifications non publiées" : "À jour");
}
/* Mode dossier : écrit config.js + nouveaux fichiers dans le dossier, puis recharge l'aperçu */
var autoQ = Promise.resolve(), autoT, autoReload = false;
function autosave(reload) {
  autoReload = autoReload || reload;
  clearTimeout(autoT);
  status("⏳ Enregistrement…");
  autoT = setTimeout(function () {
    var doReload = autoReload; autoReload = false;
    autoQ = autoQ.then(async function () {
      try {
        var files = [{ path: "assets/js/config.js", content: cfgText() }], hadFiles = staged.size > 0;
        staged.forEach(function (blob, path) { files.push({ path: path, content: blob }); });
        await backend.publish(files);
        baseSnap = snapshot(cfg); staged.clear();
        if (hadFiles) { dirCache = {}; blobCache = {}; renderImages(); renderLinks(); }
        updateBar();
        status("✔ Enregistré dans le dossier à " + new Date().toLocaleTimeString("fr-FR"), "ok");
        if (doReload) reloadPreview();
      } catch (e) { status("Erreur d'enregistrement : " + e.message, "err"); }
    });
  }, 350);
}

async function publish() {
  if (!isDirty()) return;
  var btn = $("#publish"); btn.disabled = true;
  var stamp = new Date().toISOString();
  var prev = cfg.publishedAt;
  cfg.publishedAt = stamp;
  var files = [{ path: "assets/js/config.js", content: cfgText() }];
  staged.forEach(function (blob, path) { files.push({ path: path, content: blob }); });
  try {
    await backend.publish(files, "Portfolio : mise à jour depuis le back-office (" + new Date().toLocaleString("fr-FR") + ")", function (m) { status("⏳ " + m); });
    baseSnap = snapshot(cfg); staged.clear(); dirCache = {};
    if (LS) try { LS.removeItem(draftKey()); } catch (e) {}
    updateBar(); renderImages(); renderLinks();
    if (backend.kind === "github") { status("✔ Publié — mise en ligne en cours…", "ok"); watchDeploy(stamp); }
    else { status("✔ Enregistré dans le dossier", "ok"); reloadPreview(); }
  } catch (e) {
    cfg.publishedAt = prev;
    status("Échec de la publication : " + e.message, "err");
    updateBar();
  }
}
/* Attend que Netlify ait mis en ligne la nouvelle version (config.js contient le tampon) */
function siteBase() {
  if (/^https?:$/.test(location.protocol)) return new URL("../", location.href).href;
  return (AC.siteUrl || "").replace(/\/?$/, "/");
}
async function watchDeploy(stamp) {
  var base = siteBase();
  if (!base) { status("✔ Publié — le site sera à jour dans environ 1 minute", "ok"); return; }
  for (var i = 0; i < 40; i++) {
    await new Promise(function (r) { setTimeout(r, i ? 5000 : 8000); });
    try {
      var t = await (await fetch(base + "assets/js/config.js?v=" + Date.now(), { cache: "no-store" })).text();
      if (t.indexOf(stamp) > -1) { status("✔ En ligne ! Votre site est à jour", "ok"); reloadPreview(); return; }
      status("⏳ Netlify met le site à jour… (" + (i + 1) * 5 + " s)");
    } catch (e) { status("✔ Publié — le site sera à jour dans environ 1 minute", "ok"); return; }
  }
  status("Publié. La mise en ligne prend plus de temps que prévu : vérifiez Netlify › Deploys.", "err");
}
async function discard() {
  if (!confirm("Annuler toutes les modifications non publiées ?")) return;
  cfg = JSON.parse(baseSnap); cfg.theme = cfg.theme || {}; cfg.style = cfg.style || {};
  staged.clear();
  if (LS) try { LS.removeItem(draftKey()); } catch (e) {}
  renderAll(); changed(false); status("Modifications annulées");
}
window.addEventListener("beforeunload", function (e) { if (cfg && isDirty()) { e.preventDefault(); e.returnValue = ""; } });

/* ============================================================
   APERÇU
   ============================================================ */
var lastScroll = 0, pendingScroll = null, lastFocus = null;
var view = "desk", pageH = 0, gScale = 0.18, dScale = 1, detailVY = { y: 0, vh: 0 };
var DESK_W = 1280;
function frames() { return [$("#frame"), $("#globalFrame")].filter(Boolean); }
function url(path) { return objUrls.get(path); }
/* Config utilisée par l'aperçu : brouillon + fichiers pas encore publiés (adresses locales) */
function setPreviewConfig() {
  var c = JSON.parse(JSON.stringify(cfg));
  Object.keys(c.images || {}).forEach(function (k) {
    var dir = "assets/images/" + k.split("/").slice(0, -1).join("/");
    var p = dir + "/" + c.images[k];
    if (c.images[k] && staged.has(p)) c.images[k] = url(p);
  });
  if (c.cv && staged.has(c.cv)) c.cv = url(c.cv);
  window.PORTFOLIO_PREVIEW_CONFIG = c;
}
function reloadPreview() {
  var a = currentAnchor; currentAnchor = "";
  pendingScroll = a ? null : lastScroll;
  setPreviewConfig();
  var v = Date.now();
  $("#frame").src = "../index.html?apercu=" + v + (a ? "#" + a : "");
  $("#globalFrame").src = "../index.html?apercu=global&v=" + v;
}
function post(f, msg) { if (f && f.contentWindow) f.contentWindow.postMessage(msg, "*"); }
function pushTheme() { frames().forEach(function (f) { post(f, { portfolio: "theme", theme: cfg.theme, style: cfg.style }); }); }

/* Repérage : encadre l'élément modifié dans les deux aperçus */
function focusPreview(sel, label) {
  lastFocus = sel ? { sel: sel, label: label || "" } : null;
  frames().forEach(function (f) { post(f, { portfolio: "focus", sel: sel || "", label: label || "" }); });
}

/* Mise à l'échelle : détaillé (1280 px ajusté, ou mobile 390 px) + global pleine page */
function fitFrames() {
  var wrap = $("#frameWrap"), f = $("#frame");
  if (view === "desk") {
    dScale = Math.min(1, wrap.clientWidth / DESK_W);
    f.style.width = DESK_W + "px"; f.style.height = (wrap.clientHeight / dScale) + "px";
    f.style.transform = "scale(" + dScale + ")";
  } else { f.style.width = ""; f.style.height = ""; f.style.transform = ""; dScale = 1; }
  var gs = $("#globalScroll"), gf = $("#globalFrame");
  gScale = (gs.clientWidth || 200) / DESK_W;
  gf.style.transform = "scale(" + gScale + ")";
  if (pageH) { gf.style.height = pageH + "px"; $("#globalInner").style.height = Math.ceil(pageH * gScale) + "px"; }
  updateViewportBox();
}
function updateViewportBox() {
  var box = $("#viewportBox");
  if (!box) return;
  box.hidden = view !== "desk" || !detailVY.vh;
  box.style.top = (detailVY.y * gScale) + "px";
  box.style.height = Math.max(8, detailVY.vh * gScale) + "px";
}
function setView(v) {
  view = v;
  $("#frameWrap").classList.toggle("mobile", v === "mobile");
  $("#viewDesk").classList.toggle("on", v === "desk"); $("#viewMob").classList.toggle("on", v === "mobile");
  fitFrames();
}

window.addEventListener("message", function (e) {
  var d = e.data, f = $("#frame"), g = $("#globalFrame");
  if (!d || !d.portfolio) return;
  var fromDetail = f && e.source === f.contentWindow, fromGlobal = g && e.source === g.contentWindow;
  if (!fromDetail && !fromGlobal) return;
  if (d.portfolio === "pick") { handlePick(d); return; }
  if (fromDetail) {
    if (d.portfolio === "scroll") { lastScroll = d.y; detailVY = { y: d.y, vh: d.vh || detailVY.vh }; updateViewportBox(); }
    if (d.portfolio === "ready") {
      detailVY = { y: d.y || 0, vh: d.vh || 0 };
      if (pendingScroll) { post(f, { portfolio: "scrollTo", y: pendingScroll }); pendingScroll = null; }
      if (lastFocus) post(f, { portfolio: "focus", sel: lastFocus.sel, label: lastFocus.label, quiet: true });
      updateViewportBox();
    }
  } else {
    if (d.portfolio === "height" && d.h) { pageH = d.h; fitFrames(); }
    if (d.portfolio === "ready" && lastFocus) post(g, { portfolio: "focus", sel: lastFocus.sel, label: lastFocus.label });
    if (d.portfolio === "focusRect" && d.top != null) {
      var sc = $("#globalScroll");
      sc.scrollTo({ top: Math.max(0, d.top * gScale - sc.clientHeight / 2 + (d.height * gScale) / 2), behavior: "smooth" });
    }
    if (d.portfolio === "jump" && view === "desk") post(f, { portfolio: "scrollTo", y: Math.max(0, d.y - detailVY.vh / 3) });
  }
});

/* Clic dans l'aperçu (détaillé ou global) : ouvre le champ correspondant */
function openTab(name) { var b = document.querySelector('#tabs button[data-tab="' + name + '"]'); if (b) b.click(); }
function flash(node) { if (!node) return; node.classList.remove("flash"); void node.offsetWidth; node.classList.add("flash"); }
function reveal(node, focusEl) {
  node.scrollIntoView({ block: "center", behavior: "smooth" });
  flash(node);
  if (focusEl) setTimeout(function () { focusEl.focus({ preventScroll: true }); }, 350);
}
function handlePick(d) {
  if (d.edit) {
    openTab("textes");
    var q = $("#q"); if (q.value) { q.value = ""; q.oninput.call(q); }
    var inp = document.getElementById("t_" + d.edit.replace(/[^a-z0-9]/gi, "_"));
    if (inp) { inp.closest("details").open = true; reveal(inp.closest(".field"), inp); }
  } else if (d.img) {
    openTab("images");
    var key = d.img.replace(/^assets\/images\//, "").replace(/\.[a-z]+$/i, "");
    var card = document.querySelector('#slots .card[data-key="' + key + '"]');
    if (card) { reveal(card); focusPreview(imgSel(key), card.querySelector("b").textContent); }
  } else if (d.link) {
    openTab("liens");
    if (d.link === "cv") { var bx = $("#cvfile").closest(".box"); reveal(bx); focusPreview('[data-link="cv"]', "CV à télécharger"); }
    else { var i = document.getElementById(d.link); if (i) reveal(i.closest(".field"), i); }
  }
}
function imgSel(key) { return '[data-img^="assets/images/' + key + '."]'; }
function anchorOf(node) { var a = node.closest("[id]"); return a ? a.id : ""; }

/* ============================================================
   FICHIERS (images, CV) : préparation + optimisation
   ============================================================ */
async function optimize(file, keep) {
  var info = "";
  if (keep || !/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return { file: file, info: info };
  try {
    var bmp = await createImageBitmap(file), max = 2000;
    if (file.size < 450 * 1024 && Math.max(bmp.width, bmp.height) <= max) return { file: file, info: info };
    var k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    var out = await new Promise(function (r) { cv.toBlob(r, "image/webp", 0.84); });
    if (!out || out.size >= file.size) return { file: file, info: info };
    var name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".webp";
    return { file: new File([out], name, { type: "image/webp" }), info: "optimisée : " + kb(file.size) + " → " + kb(out.size) };
  } catch (e) { return { file: file, info: info }; }
}
function stage(dir, file) {
  var name = clean(file.name), path = dir + "/" + name;
  if (objUrls.has(path)) URL.revokeObjectURL(objUrls.get(path));
  staged.set(path, file); objUrls.set(path, URL.createObjectURL(file));
  return name;
}
async function listDir(dir) { if (!dirCache[dir]) dirCache[dir] = await backend.list(dir); return dirCache[dir]; }
async function srcOf(path) {
  if (blobCache[path] !== undefined) return blobCache[path];
  var b = await backend.readBlob(path);
  blobCache[path] = b ? { url: URL.createObjectURL(b), size: b.size } : null;
  return blobCache[path];
}

/* ============================================================
   ONGLET LIENS & CV
   ============================================================ */
function renderLinks() {
  ["linkedin", "email", "whatsapp"].forEach(function (k) {
    var i = $("#" + k); i.value = cfg[k] || "";
    i.onfocus = function () { focusPreview('[data-link="' + k + '"]', i.closest(".field").querySelector("label").textContent); };
    i.onchange = function () {
      var v = i.value.trim();
      if (k === "whatsapp") v = v.replace(/[^0-9]/g, "");
      i.value = v; cfg[k] = v; currentAnchor = "contact"; changed(false);
    };
  });
  var cvStaged = cfg.cv && staged.has(cfg.cv);
  $("#cvname").textContent = cfg.cv ? "Fichier : " + cfg.cv.split("/").pop() + (cvStaged ? " (sera publié)" : "") : "Aucun CV — le bouton est masqué.";
  $("#cvfile").closest(".box").onclick = function () { focusPreview('[data-link="cv"]', "CV à télécharger"); };
  $("#cvfile").onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    cfg.cv = "assets/docs/" + stage("assets/docs", f); renderLinks(); currentAnchor = "top"; changed(false);
    e.target.value = "";
  };
  $("#cvclear").onclick = function () { cfg.cv = ""; renderLinks(); currentAnchor = "top"; changed(false); };
}

/* ============================================================
   ONGLET COULEURS & POLICES
   ============================================================ */
var COLORS = [
  ["violet", "--violet", "Couleur principale", "Bandeaux, colonne du hero, chiffres clés"],
  ["violetDark", "--violet-dark", "Principale foncée", "Dégradés, contact, pied de page"],
  ["violetSoft", "--violet-soft", "Principale douce", "Emplacements d'images, détails"],
  ["indigo", "--indigo", "Couleur d'accent", "Boutons, titres en couleur, puces"],
  ["lavender", "--lavender", "Fond clair", "Fonds des sections Projets et Parcours"],
  ["lavender2", "--lavender-2", "Bordures", "Contours des cartes et séparateurs"],
  ["ink", "--ink", "Texte principal", "Titres et texte courant"],
  ["inkSoft", "--ink-soft", "Texte secondaire", "Paragraphes et légendes"]
];
/* Où se voit chaque réglage (pour le repérage dans l'aperçu) */
var COLOR_SEL = { violet: ".stats,.values", violetDark: ".contact,footer", violetSoft: ".img-slot:not(.has-img),.legend",
  indigo: ".btn-primary,.hl,.eyebrow", lavender: ".projects,.parcours", lavender2: ".card,.client-item", ink: "h1,h2", inkSoft: ".lead,.venture p" };
var STYLE_SEL = { mode: ".hero", finish: ".card,.stats", buttons: ".btn", btnShape: ".btn", border: ".card,.client-item,.quote",
  photos: ".img-slot", bg: "#realisations", anim: ".cards", hero: ".hero", nav: "nav", density: "#realisations",
  textSize: ".hero .lead", caseMode: "h1,h2", navSticky: "nav", progress: "#scroll-progress", toTop: "#to-top", counters: ".stats",
  waFloat: "#wa-float" };
var FONTS = ["Poppins", "Montserrat", "Inter", "Manrope", "Plus Jakarta Sans", "DM Sans", "Outfit", "Sora", "Space Grotesk",
  "Lato", "Nunito", "Raleway", "Open Sans", "Playfair Display", "Cormorant Garamond", "Fraunces"];
async function readTokens() {
  try {
    var t = await backend.readText("assets/css/base/tokens.css");
    COLORS.forEach(function (c) { var m = t.match(new RegExp(c[1].replace(/-/g, "\\-") + "\\s*:\\s*(#[0-9a-fA-F]{6})")); if (m) tokens[c[0]] = m[1].toLowerCase(); });
    var r = t.match(/--radius\s*:\s*(\d+)px/); tokens.radius = r ? r[1] : "16";
  } catch (e) { tokens.radius = "16"; }
}
/* Nom français d'une couleur, calculé à partir de sa teinte, saturation et clarté */
function colorName(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return "";
  var n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  if (l < 0.1) return "Noir";
  if (l > 0.96) return "Blanc";
  if (s < 0.12) return l < 0.3 ? "Gris anthracite" : l < 0.6 ? "Gris" : l < 0.85 ? "Gris clair" : "Gris perle";
  var base;
  if (h < 12 || h >= 345) base = l < 0.32 ? "Bordeaux" : "Rouge";
  else if (h < 40) base = l < 0.42 ? (h < 25 ? "Brun rouille" : "Marron") : (l > 0.8 ? "Pêche" : "Orange");
  else if (h < 55) base = l < 0.4 ? "Bronze" : (l > 0.8 ? "Crème" : "Or");
  else if (h < 70) base = l < 0.4 ? "Olive" : "Jaune";
  else if (h < 100) base = l < 0.35 ? "Kaki" : "Vert anis";
  else if (h < 155) base = l < 0.25 ? "Vert sapin" : "Vert";
  else if (h < 185) base = l > 0.75 ? "Vert d'eau" : "Turquoise";
  else if (h < 200) base = "Cyan";
  else if (h < 232) base = l < 0.25 ? "Bleu marine" : l > 0.82 ? "Bleu ciel" : "Bleu";
  else if (h < 246) base = l > 0.82 ? "Pervenche" : "Indigo";
  else if (h < 285) base = l > 0.85 ? "Lavande" : l > 0.72 ? "Lilas" : "Violet";
  else if (h < 320) base = l > 0.8 ? "Mauve" : "Magenta";
  else base = l < 0.35 ? "Framboise" : l > 0.8 ? "Rose poudré" : "Rose";
  var pale = /^(Pêche|Crème|Vert d'eau|Bleu ciel|Pervenche|Lavande|Lilas|Mauve|Rose poudré|Bordeaux|Bleu marine|Vert sapin|Brun rouille|Marron|Bronze|Olive|Kaki|Framboise)$/.test(base);
  if (pale) return base;
  if (l < 0.34) return base + " foncé";
  if (l > 0.85) return base + " très clair";
  if (l > 0.68) return base + " clair";
  if (s > 0.72 && l > 0.38 && l < 0.62) return base + " vif";
  if (s < 0.3) return base + " grisé";
  return base;
}
function fillFonts(sel, withSame) {
  if (sel.options.length) return;
  if (withSame) sel.appendChild(el("option", { value: "", text: "— Même police que le texte —" }));
  FONTS.forEach(function (n) { sel.appendChild(el("option", { value: n, text: n })); });
}
function renderTheme() {
  var box = $("#colors"); box.innerHTML = "";
  COLORS.forEach(function (c) {
    var val = cfg.theme[c[0]] || tokens[c[0]] || "#000000";
    var code = el("code", { text: val });
    var inp = el("input", { type: "color", value: val, title: c[2] });
    var reset = el("button", { class: "link", text: "↺", title: "Couleur du CV" });
    var cname = el("span", { class: "cname", text: colorName(val) });
    reset.hidden = !cfg.theme[c[0]];
    function setColor() {
      code.textContent = inp.value; cname.textContent = colorName(inp.value);
      cfg.theme[c[0]] = inp.value.toLowerCase() === (tokens[c[0]] || "") ? "" : inp.value.toLowerCase();
      reset.hidden = !cfg.theme[c[0]];
    }
    inp.oninput = function () { setColor(); pushTheme(); renderStyleAccent(); };
    inp.addEventListener("focus", function () { focusPreview(COLOR_SEL[c[0]], c[2] + " · " + cname.textContent); });
    inp.onchange = function () { setColor(); changed(true); renderStyleAccent(); };
    reset.onclick = function () { cfg.theme[c[0]] = ""; renderTheme(); changed(true); };
    var row = el("div", { class: "color" }, [inp, el("div", { class: "txt" }, [el("b", {}, [c[2], cname]), el("small", { text: c[3] })]), code, reset]);
    row.addEventListener("click", function () { focusPreview(COLOR_SEL[c[0]], c[2] + " · " + cname.textContent); });
    box.appendChild(row);
  });
  fillFonts($("#font"), false); fillFonts($("#headingFont"), true);
  $("#font").onfocus = function () { focusPreview(".lead,.venture p", "Police du texte"); };
  $("#headingFont").onfocus = function () { focusPreview("h1,h2", "Police des titres"); };
  $("#radius").onfocus = function () { focusPreview(".card,.img-slot", "Arrondi"); };
  var f = $("#font"); f.value = cfg.theme.font || "Poppins";
  f.onchange = function () { cfg.theme.font = f.value; changed(true); };
  var hf = $("#headingFont"); hf.value = cfg.theme.headingFont || "";
  hf.onchange = function () { cfg.theme.headingFont = hf.value; changed(true); };
  var r = $("#radius"), rv = $("#radiusVal");
  r.value = cfg.theme.radius !== undefined && cfg.theme.radius !== "" ? cfg.theme.radius : tokens.radius;
  rv.textContent = r.value + " px";
  r.oninput = function () { rv.textContent = r.value + " px"; cfg.theme.radius = r.value === tokens.radius ? "" : r.value; pushTheme(); };
  r.onchange = function () { changed(true); };
  $("#themeReset").onclick = function () {
    if (!confirm("Revenir aux couleurs, aux polices et aux arrondis de la charte du CV ?")) return;
    cfg.theme = { font: "Poppins", headingFont: "" }; COLORS.forEach(function (c) { cfg.theme[c[0]] = ""; }); cfg.theme.radius = "";
    renderTheme(); renderStyle(); changed(true);
  };
  renderStyleAccent();
}
function renderStyleAccent() {
  var st = document.documentElement.style;
  st.setProperty("--acc", cfg.theme.indigo || tokens.indigo || "#3b34d9");
  st.setProperty("--main", cfg.theme.violet || tokens.violet || "#4a3b8c");
  st.setProperty("--main-dark", cfg.theme.violetDark || tokens.violetDark || "#3a2d73");
  st.setProperty("--main-soft", cfg.theme.violetSoft || tokens.violetSoft || "#6a5bb0");
}

/* ============================================================
   ONGLET STYLE
   ============================================================ */
var STYLE_DEFAULTS = { mode: "clair", finish: "satin", buttons: "plat", btnShape: "pilule", border: "fine", photos: "normal",
  bg: "uni", anim: "douce", density: "normal", textSize: "normal", caseMode: "nom", hero: "split", nav: "flou",
  navSticky: true, progress: false, toTop: true, counters: true, waFloat: false };
var PRESETS = {
  cv:        { name: "Charte CV", desc: "Votre identité, sobre et pro", bg: "#fff", fg: "#4a3b8c", btn: "plat", shape: "pilule", style: {} },
  corporate: { name: "Corporate", desc: "Épuré, aplats, très lisible", bg: "#fff", fg: "#4a3b8c", btn: "plat", shape: "arrondi",
               style: { finish: "mat", btnShape: "arrondi", density: "aere", caseMode: "aucun", nav: "plein", progress: true } },
  prestige:  { name: "Prestige", desc: "Sombre, lumineux, élégant", bg: "#0f0c1d", fg: "#b8b3d4", btn: "contour", shape: "carre", headingFont: "Playfair Display",
               style: { mode: "sombre", finish: "lumineux", buttons: "contour", btnShape: "carre", photos: "teinte", density: "aere", caseMode: "aucun", hero: "plein", nav: "transparent" } },
  tech:      { name: "Tech néon", desc: "Sombre, néon, dynamique", bg: "#0f0c1d", fg: "#8f86ff", btn: "neon", shape: "pilule", headingFont: "Space Grotesk",
               style: { mode: "sombre", finish: "lumineux", buttons: "neon", border: "degradee", bg: "grille", anim: "dynamique", progress: true } },
  verre:     { name: "Verre moderne", desc: "Translucide, halos colorés", bg: "linear-gradient(135deg,#e3defc,#f8e6f6)", fg: "#4a3b8c", btn: "verre", shape: "arrondi",
               style: { finish: "verre", buttons: "verre", btnShape: "arrondi", bg: "aurore", anim: "dynamique", caseMode: "aucun", hero: "centre" } },
  creatif:   { name: "Créatif 3D", desc: "Relief, cadres, énergie", bg: "#fff", fg: "#4a3b8c", btn: "3d", shape: "arrondi",
               style: { buttons: "3d", btnShape: "arrondi", border: "epaisse", photos: "cadre", bg: "points", anim: "dynamique" } },
  minimal:   { name: "Minimal", desc: "Noir & blanc, beaucoup d'air", bg: "#fff", fg: "#161616", btn: "contour", shape: "carre",
               style: { finish: "mat", buttons: "contour", btnShape: "carre", border: "aucune", photos: "nb", density: "aere", caseMode: "aucun", hero: "centre", nav: "plein" } }
};
var STYLE_BOXES = [
  { title: "Mode & finition", help: "L'ambiance générale du site.", fields: [
    { k: "mode", label: "Mode d'affichage", vis: "mode", opts: [["clair", "Clair", "Fond blanc lumineux"], ["sombre", "Sombre", "Élégant, fond nuit"], ["auto", "Automatique", "Suit l'appareil du visiteur"]] },
    { k: "finish", label: "Finition", vis: "finish", opts: [["mat", "Mat", "Aplats, sans ombre"], ["satin", "Satiné", "Ombres douces"], ["lumineux", "Lumineux", "Halos, reflets, dégradés"], ["verre", "Verre", "Verre dépoli translucide"]] } ] },
  { title: "Boutons", help: "Style 2D ou 3D, effets et forme de tous les boutons du site.", fields: [
    { k: "buttons", label: "Style des boutons", vis: "btn", opts: [["plat", "Plat 2D", "Net et moderne"], ["3d", "Relief 3D", "Effet bouton pressé"], ["degrade", "Dégradé", "Animé au survol"], ["contour", "Contour", "Se remplit au survol"], ["neon", "Néon", "Halo lumineux"], ["verre", "Verre", "Translucide"], ["tonal", "Doux", "Teinte légère"]] },
    { k: "btnShape", label: "Forme", vis: "shape", opts: [["pilule", "Pilule"], ["arrondi", "Arrondie"], ["carre", "Carrée"]] } ] },
  { title: "Bordures, cartes & photos", help: "Le contour des cartes (projets, formations, témoignages) et le rendu de vos images.", fields: [
    { k: "border", label: "Bordures des cartes", vis: "border", opts: [["aucune", "Aucune", "Ombre seule"], ["fine", "Fine"], ["epaisse", "Épaisse"], ["pointillee", "Pointillée"], ["accent", "Liseré d'accent"], ["degradee", "Dégradée"]] },
    { k: "photos", label: "Traitement des photos", vis: "photo", opts: [["normal", "Naturel"], ["nb", "Noir & blanc", "Couleur au survol"], ["teinte", "Teinte de marque", "Couleur au survol"], ["cadre", "Cadre photo", "Effet tirage"]] } ] },
  { title: "Fond & mouvement", help: "", fields: [
    { k: "bg", label: "Fond de page", vis: "bg", opts: [["uni", "Uni"], ["degrade", "Dégradé"], ["points", "Points"], ["grille", "Grille"], ["aurore", "Aurore", "Halos animés"]] },
    { k: "anim", label: "Animations", vis: "icon", opts: [["aucune", "Aucune", "Site statique", "⏸"], ["douce", "Douces", "Apparitions discrètes", "〰"], ["dynamique", "Dynamiques", "Cascade, zoom, relief", "⚡"]] } ] },
  { title: "Mise en page", help: "", fields: [
    { k: "hero", label: "En-tête (hero)", vis: "hero", opts: [["split", "Partagé", "Comme votre CV"], ["centre", "Centré", "Photo ronde"], ["plein", "Immersif", "Fond couleur principale"]] },
    { k: "nav", label: "Menu du haut", vis: "nav", opts: [["flou", "Verre flou"], ["plein", "Plein"], ["violet", "Coloré", "Couleur principale"], ["transparent", "Transparent", "Se remplit au défilement"]] },
    { k: "density", label: "Espacement entre sections", vis: "icon", opts: [["compact", "Compact", "", "▤"], ["normal", "Normal", "", "☰"], ["aere", "Aéré", "", "≡"]] },
    { k: "textSize", label: "Taille du texte", vis: "icon", opts: [["petit", "Petite", "", "A", ".85rem"], ["normal", "Normale", "", "A", "1.1rem"], ["grand", "Grande", "", "A", "1.45rem"]] },
    { k: "caseMode", label: "Majuscules", vis: "icon", opts: [["nom", "Nom en capitales", "", "AB"], ["aucun", "Aucune", "", "Ab"], ["tous", "Tous les titres", "", "ABC"]] } ] }
];
var EXTRAS = [
  ["navSticky", "Menu toujours visible", "Le menu reste en haut pendant le défilement"],
  ["progress", "Barre de progression de lecture", "Fine barre colorée en haut de l'écran"],
  ["toTop", "Bouton « retour en haut »", "Apparaît après un peu de défilement"],
  ["counters", "Compteurs animés", "Les chiffres clés défilent jusqu'à leur valeur (visible au rechargement)"],
  ["waFloat", "Bouton WhatsApp flottant", "Contact en un clic — utilise le numéro de l'onglet Liens"]
];
function styleVal(k) { var v = cfg.style[k]; return v === undefined || v === "" ? STYLE_DEFAULTS[k] : v; }
function visual(type, v, o) {
  var d = el("span", { class: "vis" });
  if (type === "btn") d.appendChild(el("span", { class: "smp b-" + v, text: "Bouton" }));
  else if (type === "shape") d.appendChild(el("span", { class: "smp sh-" + v, text: "Bouton" }));
  else if (type === "border") d.appendChild(el("span", { class: "box-s bd-" + v }));
  else if (type === "finish") { d.classList.add("f-" + v); d.appendChild(el("span", { class: "box-s" })); }
  else if (type === "mode") d.classList.add("v-" + v);
  else if (type === "bg") d.classList.add("g-" + v);
  else if (type === "photo") d.classList.add("p-" + v);
  else if (type === "hero") d.classList.add("h-" + v);
  else if (type === "nav") d.classList.add("n-" + v);
  else { var ic = el("span", { class: "ic", text: o[3] || "•" }); if (o[4]) ic.style.fontSize = o[4]; d.appendChild(ic); }
  return d;
}
function renderStyle() {
  renderStyleAccent();
  var pb = $("#presets"); pb.innerHTML = "";
  Object.keys(PRESETS).forEach(function (key) {
    var P = PRESETS[key];
    var vis = el("span", { class: "vis", style: "background:" + P.bg + ";color:" + P.fg }, [el("span", { class: "smp b-" + P.btn + " sh-" + P.shape, text: "Bouton" })]);
    var t = el("button", { class: "tile preset" + ((cfg.style.preset || "cv") === key ? " on" : ""), type: "button" }, [vis, el("b", { text: P.name }), el("small", { text: P.desc })]);
    t.onclick = function () {
      var keep = { navSticky: styleVal("navSticky"), toTop: styleVal("toTop"), counters: styleVal("counters"), waFloat: styleVal("waFloat") };
      cfg.style = Object.assign({}, STYLE_DEFAULTS, keep, P.style, { preset: key });
      cfg.theme.headingFont = P.headingFont || "";
      $("#headingFont").value = cfg.theme.headingFont;
      renderStyle(); changed(true);
      status("✨ Thème « " + P.name + " » appliqué (à publier) — vos couleurs sont conservées");
    };
    pb.appendChild(t);
  });
  var box = $("#styleBoxes"); box.innerHTML = "";
  STYLE_BOXES.forEach(function (B) {
    var b = el("div", { class: "box" }, [el("h2", { text: B.title }), B.help ? el("p", { class: "help", text: B.help }) : null]);
    B.fields.forEach(function (F) {
      b.appendChild(el("div", { class: "opt-label", text: F.label }));
      var g = el("div", { class: "tiles", role: "radiogroup", "aria-label": F.label });
      F.opts.forEach(function (o) {
        var on = String(styleVal(F.k)) === o[0];
        var t = el("button", { class: "tile" + (on ? " on" : ""), type: "button", role: "radio", "aria-checked": on ? "true" : "false" },
          [visual(F.vis, o[0], o), el("b", { text: o[1] }), o[2] ? el("small", { text: o[2] }) : null]);
        t.onclick = function () {
          cfg.style[F.k] = o[0]; cfg.style.preset = "perso";
          g.querySelectorAll(".tile").forEach(function (x) { x.classList.remove("on"); x.setAttribute("aria-checked", "false"); });
          t.classList.add("on"); t.setAttribute("aria-checked", "true");
          document.querySelectorAll("#presets .tile").forEach(function (x) { x.classList.remove("on"); });
          changed(true);
          focusPreview(STYLE_SEL[F.k], F.label + " : " + o[1]);
        };
        g.appendChild(t);
      });
      b.appendChild(g);
    });
    box.appendChild(b);
  });
  var ex = $("#extras"); ex.innerHTML = "";
  EXTRAS.forEach(function (x) {
    var cb = el("input", { type: "checkbox" }); cb.checked = !!styleVal(x[0]);
    cb.onchange = function () { cfg.style[x[0]] = cb.checked; changed(true); setTimeout(function () { focusPreview(STYLE_SEL[x[0]], x[1]); }, 60); };
    ex.appendChild(el("div", { class: "toggle" }, [el("span", { class: "name" }, [x[1], el("small", { text: x[2] })]), el("label", { class: "switch" }, [cb, el("span")])]));
  });
}

/* ============================================================
   ONGLET SECTIONS (découvertes dans index.html)
   ============================================================ */
function renderSections() {
  var box = $("#toggles"); box.innerHTML = "";
  var items = doc.querySelectorAll("[data-section][data-optional]");
  if (!items.length) { box.textContent = "Aucune section configurable trouvée dans index.html."; return; }
  var rows = [];
  items.forEach(function (s) {
    var key = s.getAttribute("data-section");
    var parent = s.parentElement && s.parentElement.closest("[data-section][data-optional]");
    var cb = el("input", { type: "checkbox" }); cb.checked = cfg.sections[key] !== false;
    var row = el("div", { class: "toggle" + (parent ? " child" : "") }, [
      el("span", { class: "name", text: s.getAttribute("data-section-label") || key }),
      el("label", { class: "switch", title: "Afficher / masquer" }, [cb, el("span")])
    ]);
    row.dataset.parent = parent ? parent.getAttribute("data-section") : "";
    row.querySelector(".name").style.cursor = "pointer";
    row.querySelector(".name").onclick = function () { focusPreview('[data-section="' + key + '"]', s.getAttribute("data-section-label") || key); };
    cb.onchange = function () {
      if (cb.checked) delete cfg.sections[key]; else cfg.sections[key] = false;
      currentAnchor = anchorOf(s); refreshParents(); changed(false);
      lastFocus = cb.checked ? { sel: '[data-section="' + key + '"]', label: s.getAttribute("data-section-label") || key } : null;
    };
    rows.push(row); box.appendChild(row);
  });
  function refreshParents() { rows.forEach(function (r) { r.classList.toggle("parent-off", !!r.dataset.parent && cfg.sections[r.dataset.parent] === false); }); }
  refreshParents();
}

/* ============================================================
   ONGLET TEXTES (découverts dans index.html)
   ============================================================ */
function defaultText(node) {
  var type = node.getAttribute("data-type") || "text";
  if (type === "list") return Array.prototype.map.call(node.children, function (c) { return c.textContent.replace(/\s+/g, " ").trim(); }).filter(Boolean).join("\n");
  if (type === "lines") {
    var out = "";
    node.childNodes.forEach(function (c) { out += c.nodeName === "BR" ? "\n" : c.textContent; });
    return out.split("\n").map(function (l) { return l.replace(/\s+/g, " ").trim(); }).join("\n");
  }
  return node.textContent.replace(/\s+/g, " ").trim();
}
function renderTexts() {
  var box = $("#groups"); box.innerHTML = "";
  var groups = new Map();
  doc.querySelectorAll("[data-edit]").forEach(function (node) {
    var sec = node.closest("[data-section]");
    var gk = sec ? sec.getAttribute("data-section") : "autres";
    if (!groups.has(gk)) groups.set(gk, { label: sec ? (sec.getAttribute("data-section-label") || gk) : "Autres", nodes: [] });
    groups.get(gk).nodes.push(node);
  });
  groups.forEach(function (g, gk) {
    var body = el("div", { class: "body" }), count = el("small");
    var det = el("details", { class: "group" }, [el("summary", {}, [el("span", { text: g.label }), count]), body]);
    if (gk === "hero") det.open = true;
    function updateCount() {
      var n = g.nodes.filter(function (x) { return Object.prototype.hasOwnProperty.call(cfg.texts, x.getAttribute("data-edit")); }).length;
      count.textContent = n ? n + " modifié" + (n > 1 ? "s" : "") : "";
    }
    g.nodes.forEach(function (node) { body.appendChild(textField(node, updateCount)); });
    updateCount();
    box.appendChild(det);
  });
}
function textField(node, onChange) {
  var key = node.getAttribute("data-edit"), type = node.getAttribute("data-type") || "text";
  var def = defaultText(node);
  var has = function () { return Object.prototype.hasOwnProperty.call(cfg.texts, key); };
  var val = has() ? String(cfg.texts[key]) : def;
  var id = "t_" + key.replace(/[^a-z0-9]/gi, "_");
  var input;
  if (type === "text") input = el("input", { type: "text", id: id });
  else { input = el("textarea", { id: id }); input.rows = Math.min(10, Math.max(type === "long" ? 3 : 2, val.split("\n").length + (type === "long" ? Math.ceil(val.length / 70) - 1 : 0))); }
  input.value = val;
  var badge = el("span", { class: "badge" });
  var reset = el("button", { class: "link", text: "↺ Rétablir", title: "Texte d'origine : " + def });
  var label = node.getAttribute("data-label") || key;
  var hint = type === "list" ? "Une ligne = un élément." : type === "lines" ? "Chaque ligne s'affiche sur une ligne séparée." : "";
  var wrap = el("div", { class: "field", "data-search": (label + " " + key + " " + def + " " + val).toLowerCase() }, [
    el("div", { class: "meta" }, [el("label", { class: "f", for: id, text: label }), el("span", { class: "row" }, [badge, reset])]),
    input, hint ? el("div", { class: "hint", text: hint }) : null
  ]);
  function refresh() {
    var mod = has(), empty = mod && String(cfg.texts[key]).trim() === "";
    badge.textContent = empty ? "masqué" : "modifié";
    badge.className = "badge" + (empty ? " hide" : "");
    badge.hidden = !mod; reset.hidden = !mod;
  }
  input.addEventListener("focus", function () { focusPreview('[data-edit="' + key + '"]', label); });
  input.onchange = function () {
    var v = type === "text" ? input.value.trim() : input.value.split("\n").map(function (l) { return l.trim(); }).join("\n").replace(/^\n+|\n+$/g, "");
    if (type === "list") v = v.split("\n").filter(Boolean).join("\n");
    input.value = v;
    if (v === def) delete cfg.texts[key]; else cfg.texts[key] = v;
    currentAnchor = anchorOf(node); refresh(); onChange(); changed(false);
  };
  reset.onclick = function () { delete cfg.texts[key]; input.value = def; currentAnchor = anchorOf(node); refresh(); onChange(); changed(false); };
  refresh();
  return wrap;
}
$("#q").oninput = function () {
  var q = this.value.trim().toLowerCase();
  document.querySelectorAll("#groups details.group").forEach(function (d) {
    var any = false;
    d.querySelectorAll(".field").forEach(function (f) {
      var hit = !q || f.getAttribute("data-search").indexOf(q) > -1 || f.querySelector("input,textarea").value.toLowerCase().indexOf(q) > -1;
      f.hidden = !hit; if (hit) any = true;
    });
    d.hidden = !any; if (q && any) d.open = true;
  });
};

/* ============================================================
   ONGLET IMAGES (découvertes dans index.html)
   ============================================================ */
function renderImages() {
  var box = $("#slots"); box.innerHTML = "";
  var seen = {};
  doc.querySelectorAll("[data-img]").forEach(function (node) {
    var def = node.getAttribute("data-img");
    var base = def.replace(/\.[a-z]+$/i, "");
    var key = base.replace("assets/images/", "");
    if (seen[key]) return; seen[key] = 1;
    var dir = def.slice(0, def.lastIndexOf("/"));
    box.appendChild(imageCard(key, dir, node.getAttribute("data-label") || key, node.getAttribute("data-size") || "", anchorOf(node)));
  });
}
function imageCard(key, dir, label, size, anchor) {
  var ph = size ? "Format conseillé : " + size : "Aucune image";
  var thumb = el("div", { class: "thumb", text: ph });
  var img = el("img", { alt: "" }); img.hidden = true; thumb.appendChild(img);
  var fname = el("div", { class: "fname" });
  var inp = el("input", { type: "file", accept: "image/*" });
  var clear = el("button", { class: "ghost", text: "Retirer" });
  var isLogo = /^logos\//.test(key);
  var card = el("div", { class: "card", "data-key": key }, [
    el("span", { class: "tag", text: dir.replace("assets/images/", "") }), thumb,
    el("div", {}, [el("b", { style: "font-size:.85rem", text: label }), fname]),
    el("div", { class: "row" }, [el("label", { class: "file" }, ["Choisir une image", inp]), clear])
  ]);
  var extra = "";
  card.addEventListener("click", function () { focusPreview(imgSel(key), label); });
  async function preview() {
    var name = cfg.images[key], b = key.split("/").pop(), cand = name;
    try {
      if (!cand) { var names = await listDir(dir); cand = EXTS.map(function (e) { return b + "." + e; }).find(function (n) { return names.indexOf(n) > -1; }); }
      var path = cand ? dir + "/" + cand : null;
      if (path && staged.has(path)) {
        img.src = objUrls.get(path); img.hidden = false; thumb.firstChild.textContent = "";
        fname.textContent = cand + " · " + kb(staged.get(path).size) + (extra ? " · " + extra : "");
        fname.appendChild(el("span", { class: "staged", text: "à publier" }));
        clear.disabled = false; return;
      }
      var s = path ? await srcOf(path) : null;
      if (s) {
        img.src = s.url; img.hidden = false; thumb.firstChild.textContent = "";
        fname.textContent = cand + " · " + kb(s.size) + (s.size > 800 * 1024 ? " (lourde)" : "");
        fname.className = "fname" + (s.size > 800 * 1024 ? " warn" : "");
        clear.disabled = !name; return;
      }
    } catch (e) { fname.textContent = "Lecture impossible : " + e.message; return; }
    img.hidden = true; thumb.firstChild.textContent = ph;
    fname.textContent = name ? "Fichier introuvable : " + name : "Aucune image — emplacement vide affiché";
    fname.className = "fname"; clear.disabled = !name;
  }
  inp.onchange = async function () {
    var f = inp.files[0]; inp.value = ""; if (!f) return;
    status("⏳ Préparation de l'image…");
    var o = await optimize(f, isLogo);
    extra = o.info;
    cfg.images[key] = stage(dir, o.file); currentAnchor = anchor; changed(false); preview();
  };
  clear.onclick = function () { cfg.images[key] = ""; extra = ""; currentAnchor = anchor; changed(false); preview(); };
  preview();
  return card;
}

/* ============================================================
   DÉMARRAGE, CONNEXION
   ============================================================ */
document.querySelectorAll("#tabs button").forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll("#tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("on", p.id === "p-" + b.dataset.tab); });
  };
});
$("#viewDesk").onclick = function () { setView("desk"); };
$("#viewMob").onclick = function () { setView("mobile"); };
$("#toggleGlobal").onclick = function () {
  var off = $("#previewPane").classList.toggle("no-global");
  this.classList.toggle("on", !off);
  if (LS) try { LS.setItem("portfolio-global", off ? "0" : "1"); } catch (e) {}
  setTimeout(fitFrames, 30);
};
/* Aperçu global : la miniature reçoit les clics via un calque (la molette fait défiler la colonne) */
(function () {
  var inner = $("#globalInner"), vb = el("div", { id: "viewportBox" }), layer = el("div", { style: "position:absolute;inset:0;cursor:pointer;z-index:2" });
  inner.appendChild(vb); inner.appendChild(layer);
  layer.addEventListener("click", function (e) {
    var r = inner.getBoundingClientRect();
    post($("#globalFrame"), { portfolio: "pickAt", x: (e.clientX - r.left) / gScale, y: (e.clientY - r.top) / gScale });
  });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { fitFrames(); }); ro.observe($("#frameWrap")); ro.observe($("#globalScroll")); }
  window.addEventListener("resize", fitFrames);
  if (LS && LS.getItem("portfolio-global") === "0") $("#previewPane").classList.add("no-global"); else $("#toggleGlobal").classList.add("on");
  $("#viewDesk").classList.add("on");
})();
$("#reload").onclick = reloadPreview;
$("#hidePrev").onclick = function () { var off = $("#app").classList.toggle("no-preview"); this.textContent = off ? "Afficher" : "Masquer"; };
$("#publish").onclick = publish;
$("#discard").onclick = discard;
$("#backup").onclick = function () {
  var a = el("a", { href: URL.createObjectURL(new Blob([cfgText()], { type: "text/javascript" })), download: "config-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".js" });
  document.body.appendChild(a); a.click(); a.remove();
};
$("#logout").onclick = function () {
  if (isDirty() && !confirm("Des modifications ne sont pas publiées. Se déconnecter quand même ? (le brouillon des textes et réglages est conservé)")) return;
  [LS, SS].forEach(function (s) { if (s) try { s.removeItem("portfolio-gh"); } catch (e) {} });
  cfg = null; location.reload();
};

function renderAll() { renderLinks(); renderTheme(); renderStyle(); renderSections(); renderTexts(); renderImages(); }

async function openBackend(b) {
  backend = b;
  status("⏳ Chargement…");
  cfg = await readCfg();
  doc = new DOMParser().parseFromString(await backend.readText("index.html"), "text/html");
  await readTokens();
  baseSnap = snapshot(cfg);
  $("#login").hidden = true; $("#app").hidden = false;
  ["#backup", "#logout"].forEach(function (s) { $(s).hidden = false; });
  $("#publish").hidden = backend.kind === "local";
  if (backend.kind === "local") $("#p-images .help").innerHTML = "Choisissez une photo : elle est copiée dans le bon dossier, enregistrée et affichée aussitôt. Les photos lourdes sont <b>automatiquement optimisées</b> pour le web.";
  $("#where").textContent = "· " + backend.label;
  renderAll(); updateBar();
  reloadPreview();
  status(backend.kind === "github" ? "Connecté ✔ — modifiez puis cliquez sur « Publier »" : "Dossier connecté ✔ — chaque modification est enregistrée automatiquement", "ok");
  if (backend.kind === "github") offerDraft();
}
function offerDraft() {
  if (!LS) return;
  var d; try { d = JSON.parse(LS.getItem(draftKey()) || "null"); } catch (e) { d = null; }
  if (!d || !d.cfg || snapshot(d.cfg) === baseSnap) return;
  var bar = $("#draftBar"); bar.innerHTML = ""; bar.hidden = false;
  var when = new Date(d.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  var yes = el("button", { text: "Reprendre le brouillon" }), no = el("button", { class: "ghost", text: "Ignorer" });
  bar.appendChild(el("span", { text: "📝 Vous avez des modifications non publiées du " + when + " (textes et réglages ; les nouvelles images sont à rechoisir)." }));
  bar.appendChild(yes); bar.appendChild(no);
  yes.onclick = function () {
    cfg = d.cfg; ["theme", "style", "sections", "texts", "images"].forEach(function (k) { cfg[k] = cfg[k] || {}; });
    // les images non publiées ne sont plus disponibles : on les retire du brouillon
    Object.keys(cfg.images).forEach(function (k) { if (cfg.images[k] && /^(blob:)/.test(cfg.images[k])) cfg.images[k] = ""; });
    bar.hidden = true; renderAll(); changed(false); status("Brouillon repris — pensez à publier");
  };
  no.onclick = function () { bar.hidden = true; try { LS.removeItem(draftKey()); } catch (e) {} };
}

/* ---------- Écran de connexion ---------- */
function loginError(m) { var e = $("#loginErr"); e.textContent = m; e.hidden = !m; }
async function connectGitHub(repo, branch, token, remember, silent) {
  loginError("");
  repo = repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
  branch = (branch || "main").trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { loginError("Indiquez le dépôt sous la forme compte/nom-du-depot."); return; }
  if (!token) { loginError("Collez votre jeton d'accès GitHub."); return; }
  var b = GitHubBackend(repo, branch, token.trim());
  $("#lgGo").disabled = true; $("#lgGo").textContent = "Connexion…";
  try {
    await b.check();
    var saved = JSON.stringify({ repo: repo, branch: branch, token: token.trim() });
    if (remember && LS) LS.setItem("portfolio-gh", saved); else if (SS) { SS.setItem("portfolio-gh", saved); if (LS) LS.removeItem("portfolio-gh"); }
    await openBackend(b);
  } catch (e) {
    if (silent) { [LS, SS].forEach(function (s) { if (s) try { s.removeItem("portfolio-gh"); } catch (x) {} }); }
    $("#login").hidden = false; $("#app").hidden = true;
    loginError(e.message);
  } finally { $("#lgGo").disabled = false; $("#lgGo").textContent = "Se connecter"; }
}
$("#lgGo").onclick = function () { connectGitHub($("#lgRepo").value, $("#lgBranch").value, $("#lgToken").value, $("#lgRemember").checked); };
$("#lgToken").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#lgGo").click(); });

/* ---------- Mode dossier local (ordinateur) ---------- */
/* Vérifie que le dossier choisi est bien celui qui contient CE back-office :
   on y écrit un petit fichier témoin puis on essaie de le charger depuis la page. */
function sameFolder(b) {
  var tok = "t" + Math.random().toString(36).slice(2);
  var path = "assets/js/_admin-check.js";
  return b.publish([{ path: path, content: "window.__ADMIN_CHECK=" + JSON.stringify(tok) + ";" }]).then(function () {
    return new Promise(function (res) {
      var done = false, s = document.createElement("script");
      function end(v) { if (done) return; done = true; s.remove(); res(v); }
      s.src = "../" + path + "?" + tok;
      s.onload = function () { end(window.__ADMIN_CHECK === tok); };
      s.onerror = function () { end(false); };
      setTimeout(function () { end(false); }, 4000);
      document.head.appendChild(s);
    });
  }).finally(function () { return b.remove(path); });
}
$("#lgLocal").onclick = async function () {
  if (!window.showDirectoryPicker) { loginError("Le mode dossier nécessite Microsoft Edge ou Google Chrome sur ordinateur."); return; }
  try {
    var h = await showDirectoryPicker({ mode: "readwrite", id: "portfolio" });
    var b = LocalBackend(h);
    try { await b.check(); } catch (e) { loginError("Ce n'est pas le bon dossier : choisissez celui qui contient index.html."); return; }
    loginError(""); $("#lgLocal").disabled = true; $("#lgLocal").textContent = "Vérification du dossier…";
    var ok = await sameFolder(b).catch(function () { return false; });
    $("#lgLocal").disabled = false; $("#lgLocal").textContent = "📁 Choisir le dossier du portfolio";
    if (!ok) {
      var here = decodeURIComponent(location.pathname).replace(/\/admin(\/index\.html|\.html)?$/, "").replace(/^\/+/, "");
      loginError("⚠️ Le dossier « " + h.name + " » n'est pas celui de ce back-office : vos changements n'apparaîtraient pas ici. " +
        "Choisissez le dossier qui contient ce back-office" + (here ? " : " + here : "") + ". " +
        "(Astuce : supprimez les anciennes copies dézippées pour éviter la confusion.)");
      return;
    }
    await openBackend(b);
  } catch (e) { if (e.name !== "AbortError") loginError("Erreur : " + e.message); }
};

(async function init() {
  var isLocalFile = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  $("#localWrap").hidden = !isLocalFile;
  if (isLocalFile) {   // ouvert depuis l'ordinateur : le mode dossier passe en premier
    var lw = $("#localWrap"), help = $("#login .help");
    help.textContent = "Choisissez le dossier du portfolio (celui qui contient index.html et ce dossier admin). Chaque modification y est enregistrée automatiquement.";
    help.after(lw); lw.after($("#loginErr"));
    $("#lgLocal").textContent = "📁 Choisir le dossier du portfolio"; $("#lgLocal").className = ""; 
    lw.querySelector(".or").remove();
    lw.appendChild(el("div", { class: "or", text: "ou, pour le site en ligne, se connecter à GitHub" }));
  }
  var saved = null;
  [SS, LS].forEach(function (s) { if (!saved && s) try { saved = JSON.parse(s.getItem("portfolio-gh") || "null"); } catch (e) {} });
  $("#lgRepo").value = (saved && saved.repo) || AC.repo || "";
  $("#lgBranch").value = (saved && saved.branch) || AC.branch || "main";
  if (AC.repo && !saved) { $("#lgRepo").closest(".field").hidden = true; $("#lgBranch").closest(".field").hidden = true; }
  if (saved && saved.token) { status("⏳ Connexion…"); await connectGitHub(saved.repo, saved.branch, saved.token, !!(LS && LS.getItem("portfolio-gh")), true); }
  else $("#login").hidden = false;
  if (!cfg) $("#login").hidden = false;
})();

})();