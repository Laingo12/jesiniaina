/* Applique les textes et la visibilité des sections choisis dans le back-office.
   - SITE_CONFIG.sections : { "cle": false } masque le bloc [data-section="cle"] (et son lien dans le menu)
   - SITE_CONFIG.texts    : { "cle": "texte" } remplace le contenu de [data-edit="cle"]
     Texte vide = l'élément est masqué. Clé absente = texte d'origine du HTML.
   Le texte est inséré comme texte brut (jamais comme HTML). */
(function () {
  var c = window.SITE_CONFIG || {};
  var texts = c.texts || {}, sections = c.sections || {};

  // 1. Sections masquées
  document.querySelectorAll("[data-section]").forEach(function (el) {
    if (sections[el.getAttribute("data-section")] !== false) return;
    el.style.display = "none";
    if (el.id) {
      document.querySelectorAll('nav a[href="#' + el.id + '"]').forEach(function (a) {
        a.parentNode.style.display = "none";
      });
    }
  });

  // 2. Textes
  document.querySelectorAll("[data-edit]").forEach(function (el) {
    var key = el.getAttribute("data-edit");
    if (!Object.prototype.hasOwnProperty.call(texts, key)) return;
    var val = String(texts[key]);
    var type = el.getAttribute("data-type") || "text";

    if (val.trim() === "") { el.style.display = "none"; return; }

    if (type === "lines") {
      el.textContent = "";
      val.split("\n").forEach(function (line, i) {
        if (i) el.appendChild(document.createElement("br"));
        el.appendChild(document.createTextNode(line.trim()));
      });
    } else if (type === "list") {
      var tpl = el.firstElementChild;
      var tag = tpl ? tpl.tagName : "LI", cls = tpl ? tpl.className : "";
      el.textContent = "";
      val.split("\n").map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (line) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        n.textContent = line;
        el.appendChild(n);
      });
    } else {
      el.textContent = val.replace(/\s*\n\s*/g, " ");
    }
  });
})();
