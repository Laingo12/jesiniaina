/* Effets « expert » activables dans le back-office (onglet Style › Effets) :
   barre de progression de lecture, bouton retour en haut, bouton WhatsApp flottant,
   compteurs animés des chiffres clés, menu transparent qui se remplit au défilement.
   Leur affichage est piloté en CSS par les attributs data-* de <html>,
   ce qui permet de les activer / désactiver en direct depuis l'aperçu. */
(function () {
  var html = document.documentElement;
  var cfg = window.SITE_CONFIG || {};
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Barre de progression ---------- */
  var bar = document.createElement("div");
  bar.id = "scroll-progress"; bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  /* ---------- Retour en haut ---------- */
  var top = document.createElement("button");
  top.id = "to-top"; top.className = "float-btn"; top.type = "button";
  top.setAttribute("aria-label", "Revenir en haut de la page");
  top.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); });
  document.body.appendChild(top);

  /* ---------- WhatsApp flottant (utilise le numéro de config.js) ---------- */
  var wa = String(cfg.whatsapp || "").replace(/[^0-9]/g, "");
  if (wa) {
    var w = document.createElement("a");
    w.id = "wa-float"; w.className = "float-btn"; w.href = "https://wa.me/" + wa;
    w.target = "_blank"; w.rel = "noopener"; w.setAttribute("aria-label", "Discuter sur WhatsApp");
    w.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.91-7.01zm-7.01 15.24h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>';
    document.body.appendChild(w);
  }

  /* ---------- Défilement : progression, bouton haut, menu transparent ---------- */
  var nav = document.querySelector("nav"), ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || 0, max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, y / max) : 0);
    top.classList.toggle("show", y > 600);
    if (nav) nav.classList.toggle("scrolled", y > 10);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Compteurs animés (Chiffres clés) ---------- */
  if (html.getAttribute("data-counters") === "oui" && !reduced && !/[?&]apercu=global/.test(location.search) && "IntersectionObserver" in window) {
    var stats = document.querySelectorAll(".stat strong");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } });
    }, { threshold: 0.6 });
    stats.forEach(function (el) {
      var txt = el.textContent, m = txt.match(/\d[\d\s  .,]*/);
      if (!m) return;
      var raw = m[0].replace(/[\s  .,]+$/, "");
      var grouped = /[\s  ]/.test(raw);
      var dec = grouped ? "" : ((raw.match(/[.,](\d+)$/) || [])[1] || "");
      var num = parseFloat(raw.replace(/[\s  ]/g, "").replace(",", "."));
      if (!isFinite(num) || num === 0) return;
      el._counter = { pre: txt.slice(0, m.index), post: txt.slice(m.index + raw.length), num: num, dec: dec.length, grouped: grouped, sep: raw.match(/[\s  ]/) ? raw.match(/[\s  ]/)[0] : " ", comma: /,/.test(raw) };
      io.observe(el);
    });
    function fmt(c, v) {
      var s = c.dec ? v.toFixed(c.dec) : String(Math.round(v));
      if (c.comma && c.dec) s = s.replace(".", ",");
      if (c.grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, c.sep);
      return c.pre + s + c.post;
    }
    function run(el) {
      var c = el._counter; if (!c) return;
      var t0 = null, dur = 1500;
      el.style.fontVariantNumeric = "tabular-nums";
      function step(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(c, c.num * e);
        if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(c, c.num);
      }
      requestAnimationFrame(step);
    }
  }

  /* ---------- Liaison avec les aperçus du back-office ----------
     Uniquement quand la page est affichée dans l'admin (iframe) :
     • position de défilement, hauteur de page (aperçu global)
     • « focus » : encadre l'élément en cours de modification
     • clic sur un texte / une image / un lien : ouvre le champ correspondant dans l'admin */
  if (window.parent !== window) {
    var isGlobal = /[?&]apercu=global/.test(location.search);
    var post = function (d) { try { window.parent.postMessage(d, "*"); } catch (e) {} };
    var t;
    if (isGlobal) html.classList.add("pf-global");

    var css = document.createElement("style");
    css.textContent =
      ".pf-hl{position:absolute;z-index:2147483000;pointer-events:none;border:3px solid #ffb000;border-radius:12px;" +
      "box-shadow:0 0 0 4px rgba(255,176,0,.25),0 0 30px rgba(255,176,0,.45);animation:pfPulse 1.6s ease-in-out infinite}" +
      ".pf-hl>span{position:absolute;left:-3px;top:-30px;background:#ffb000;color:#1d1400;font:700 12px/1 system-ui,sans-serif;" +
      "padding:7px 10px;border-radius:8px 8px 8px 0;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.2)}" +
      ".pf-global .pf-hl{border-width:20px;border-radius:28px;background:rgba(255,176,0,.18)}.pf-global .pf-hl>span{display:none}" +
      "@keyframes pfPulse{50%{box-shadow:0 0 0 10px rgba(255,176,0,.12),0 0 40px rgba(255,176,0,.6)}}" +
      ".pf-hover{outline:2px dashed #ffb000!important;outline-offset:4px;cursor:pointer!important}" +
      ".pf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483001;background:#1d1400;color:#ffd780;" +
      "font:600 13px/1.3 system-ui,sans-serif;padding:10px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.3)}" +
      ".pf-global #to-top,.pf-global #wa-float{display:none!important}";
    document.head.appendChild(css);

    /* Surlignage */
    var boxes = [], timer = null;
    function clearHL() { boxes.forEach(function (b) { b.box.remove(); }); boxes = []; clearInterval(timer); }
    function place() {
      boxes.forEach(function (b) {
        var r = b.el.getBoundingClientRect(), fixed = getComputedStyle(b.el).position === "fixed";
        b.box.style.position = fixed ? "fixed" : "absolute";
        b.box.style.display = r.width || r.height ? "block" : "none";
        b.box.style.top = (r.top + (fixed ? 0 : window.scrollY) - 6) + "px";
        b.box.style.left = (r.left + (fixed ? 0 : window.scrollX) - 6) + "px";
        b.box.style.width = (r.width + 12) + "px";
        b.box.style.height = (r.height + 12) + "px";
      });
    }
    function toast(m) {
      var o = document.querySelector(".pf-toast"); if (o) o.remove();
      var d = document.createElement("div"); d.className = "pf-toast"; d.textContent = m; document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 3200);
    }
    function focusSel(sel, label) {
      clearHL();
      if (!sel) return;
      var els = [];
      try { els = Array.prototype.slice.call(document.querySelectorAll(sel)); } catch (e) { return; }
      els = els.filter(function (e) { return e.getClientRects().length && getComputedStyle(e).visibility !== "hidden"; }).slice(0, 8);
      if (!els.length) {
        if (!isGlobal) toast("« " + (label || "Cet élément") + " » n'est pas visible sur le site (vide ou section masquée).");
        return;
      }
      els.forEach(function (e, i) {
        var rv = e.closest(".reveal"); if (rv) rv.classList.add("in");   // force l'apparition (animation au défilement)
        var b = document.createElement("div"); b.className = "pf-hl";
        if (i === 0 && label) { var s = document.createElement("span"); s.textContent = "✏️ " + label; b.appendChild(s); }
        document.body.appendChild(b); boxes.push({ el: e, box: b });
      });
      place(); timer = setInterval(place, 250);
      var first = els[0], r = first.getBoundingClientRect();
      if (getComputedStyle(first).position === "fixed") return;
      var top = r.top + window.scrollY;
      if (isGlobal) post({ portfolio: "focusRect", top: top, height: r.height });
      else window.scrollTo({ top: Math.max(0, top - Math.max(90, (window.innerHeight - Math.min(r.height, window.innerHeight * 0.7)) / 2)), behavior: "smooth" });
    }

    /* Clic dans l'aperçu = modifier cet élément */
    var PICK = "[data-edit],[data-img],[data-link]";
    document.addEventListener("mouseover", function (e) {
      var o = document.querySelector(".pf-hover"), n = e.target.closest && e.target.closest(PICK);
      if (o && o !== n) o.classList.remove("pf-hover");
      if (n) n.classList.add("pf-hover");
    });
    document.addEventListener("click", function (e) {
      var n = e.target.closest && e.target.closest(PICK);
      if (!n) return;
      e.preventDefault(); e.stopPropagation();
      post({ portfolio: "pick", edit: n.getAttribute("data-edit"), img: n.getAttribute("data-img"), link: n.getAttribute("data-link") });
    }, true);

    /* Hauteur de la page (pour l'aperçu global en pleine page) */
    function sendHeight() { post({ portfolio: "height", h: document.documentElement.scrollHeight }); }
    if (isGlobal) {
      window.addEventListener("load", sendHeight);
      if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(sendHeight.t); sendHeight.t = setTimeout(sendHeight, 120); }).observe(document.body);
      sendHeight();
    }

    window.addEventListener("scroll", function () { clearTimeout(t); t = setTimeout(function () { post({ portfolio: "scroll", y: window.scrollY, vh: window.innerHeight }); }, 120); }, { passive: true });
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (e.source !== window.parent || !d) return;
      if (d.portfolio === "scrollTo") window.scrollTo({ top: d.y || 0, behavior: "instant" });
      if (d.portfolio === "focus") focusSel(d.sel, d.label);
      if (d.portfolio === "pickAt") {          // clic sur la miniature (aperçu global)
        var n = document.elementFromPoint(d.x, d.y - window.scrollY), p = n && n.closest(PICK);
        if (p) post({ portfolio: "pick", edit: p.getAttribute("data-edit"), img: p.getAttribute("data-img"), link: p.getAttribute("data-link") });
        else post({ portfolio: "jump", y: d.y });
      }
    });
    post({ portfolio: "ready", global: isGlobal, y: window.scrollY, vh: window.innerHeight });
  }
})();
