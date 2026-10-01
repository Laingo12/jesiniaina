/* Applique SITE_CONFIG aux éléments [data-link="cv|linkedin|email|whatsapp"].
   Valeur vide = bouton masqué. Avec l'attribut data-link-text, le bouton affiche la valeur (ex. l'e-mail). */
(function () {
  var c = window.SITE_CONFIG || {};
  var build = {
    cv: function (v) { return v; },
    linkedin: function (v) { return v; },
    email: function (v) { return "mailto:" + v; },
    whatsapp: function (v) { return "https://wa.me/" + String(v).replace(/[^0-9]/g, ""); }
  };
  document.querySelectorAll("[data-link]").forEach(function (el) {
    var key = el.getAttribute("data-link"), val = c[key];
    if (!val || !build[key]) { el.style.display = "none"; return; }
    el.href = build[key](val);
    if (el.hasAttribute("data-link-text")) el.textContent = val;
    if (key === "cv") el.setAttribute("download", "");
    if (key === "linkedin" || key === "whatsapp") { el.target = "_blank"; el.rel = "noopener"; }
  });
})();
