/* Applique l'apparence choisie dans le back-office : couleurs, polices, arrondis
   et tous les réglages de l'onglet « Style » (attributs data-* sur <html>).
   Chargé dans <head> pour éviter tout « flash ». Écoute aussi l'aperçu du
   back-office pour appliquer les changements en direct, sans recharger. */
(function () {
  /* Aperçu du back-office : utilise le brouillon (modifications pas encore publiées).
     Ne fonctionne que si l'admin est sur le même site (accès refusé sinon). */
  try {
    if (window.parent !== window && window.parent.PORTFOLIO_PREVIEW_CONFIG)
      window.SITE_CONFIG = JSON.parse(JSON.stringify(window.parent.PORTFOLIO_PREVIEW_CONFIG));
  } catch (e) {}
  var cfg = window.SITE_CONFIG || {};
  var html = document.documentElement;

  /* Polices proposées et graisses disponibles sur Google Fonts */
  var FONTS = {
    "Poppins": "400;500;600;700;800", "Montserrat": "400;500;600;700;800", "Inter": "400;500;600;700;800",
    "Manrope": "400;500;600;700;800", "Plus Jakarta Sans": "400;500;600;700;800", "DM Sans": "400;500;600;700;800",
    "Outfit": "400;500;600;700;800", "Sora": "400;500;600;700;800", "Space Grotesk": "400;500;600;700",
    "Lato": "400;700;900", "Nunito": "400;600;700;800", "Raleway": "400;500;600;700;800",
    "Open Sans": "400;500;600;700;800", "Playfair Display": "400;500;600;700;800",
    "Cormorant Garamond": "400;500;600;700", "Fraunces": "400;600;700"
  };
  var COLORS = {
    violet: "--violet", violetDark: "--violet-dark", violetSoft: "--violet-soft", indigo: "--indigo",
    lavender: "--lavender", lavender2: "--lavender-2", ink: "--ink", inkSoft: "--ink-soft"
  };
  var LIGHT_ONLY = { lavender: 1, lavender2: 1, ink: 1, inkSoft: 1 }; // ignorées en mode sombre

  /* Réglages de style : valeur par défaut + attribut posé sur <html> */
  var STYLE = {
    mode: ["clair", "mode"], finish: ["satin", "finish"], buttons: ["plat", "btn"], btnShape: ["pilule", "btn-shape"],
    border: ["fine", "border"], photos: ["normal", "photos"], anim: ["douce", "anim"], bg: ["uni", "bg"],
    density: ["normal", "density"], textSize: ["normal", "text"], caseMode: ["nom", "case"], hero: ["split", "hero"],
    nav: ["flou", "nav"], navSticky: [true, "nav-sticky"], progress: [false, "progress"], toTop: [true, "to-top"],
    counters: [true, "counters"], waFloat: [false, "wa-float"]
  };

  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var current = { theme: cfg.theme || {}, style: cfg.style || {} };

  function fontStack(name) { return '"' + name + '", system-ui, -apple-system, sans-serif'; }
  function loadFont(name, id) {
    var old = document.getElementById(id);
    if (!name || name === "Poppins" || !FONTS[name]) { if (old) old.remove(); return; }
    var href = "https://fonts.googleapis.com/css2?family=" + name.replace(/ /g, "+") + ":wght@" + FONTS[name] + "&display=swap";
    if (old && old.href === href) return;
    var l = old || document.createElement("link");
    l.id = id; l.rel = "stylesheet"; l.href = href;
    if (!old) document.head.appendChild(l);
  }

  function apply(theme, style) {
    theme = theme || {}; style = style || {};
    current = { theme: theme, style: style };
    var s = html.style;

    // Réglages de style -> attributs data-*
    Object.keys(STYLE).forEach(function (k) {
      var v = style[k] !== undefined && style[k] !== "" ? style[k] : STYLE[k][0];
      if (typeof v === "boolean") v = v ? "oui" : "non";
      html.setAttribute("data-" + STYLE[k][1], v);
    });
    var mode = html.getAttribute("data-mode");
    var dark = mode === "sombre" || mode === "dark" || (mode === "auto" && mq && mq.matches);
    html.setAttribute("data-mode", dark ? "dark" : "light");

    // Couleurs
    Object.keys(COLORS).forEach(function (k) {
      if (theme[k] && !(dark && LIGHT_ONLY[k])) s.setProperty(COLORS[k], theme[k]);
      else s.removeProperty(COLORS[k]);
    });
    if (theme.radius !== undefined && theme.radius !== "") s.setProperty("--radius", parseInt(theme.radius, 10) + "px");
    else s.removeProperty("--radius");

    // Polices (texte + titres)
    var body = theme.font && FONTS[theme.font] ? theme.font : "Poppins";
    var head = theme.headingFont && FONTS[theme.headingFont] ? theme.headingFont : "";
    loadFont(body, "font-body");
    loadFont(head && head !== body ? head : "", "font-heading");
    if (body !== "Poppins") s.setProperty("--font", fontStack(body)); else s.removeProperty("--font");
    if (head && head !== body) s.setProperty("--font-heading", fontStack(head)); else s.removeProperty("--font-heading");
  }

  apply(current.theme, current.style);

  // Mode « automatique » : suit le changement clair/sombre de l'appareil
  if (mq) {
    var onChange = function () { if ((current.style.mode || "clair") === "auto") apply(current.theme, current.style); };
    if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  // Aperçu en direct depuis le back-office (uniquement si la page est affichée dans l'admin)
  if (window.parent !== window) {
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (e.source === window.parent && d && d.portfolio === "theme") apply(d.theme, d.style);
    });
  }

  window.PortfolioTheme = { apply: apply, fonts: Object.keys(FONTS) };
})();
