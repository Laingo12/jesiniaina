/* Charge l'image de chaque .img-slot[data-img].
   1) Si SITE_CONFIG.images contient un nom pour ce slot -> assets/images/<dossier>/<nom>
   2) Sinon essaie le nom par défaut avec jpg, jpeg, png, webp.
   Si rien n'est trouvé, le placeholder hachuré reste affiché. */
(function () {
  var exts = ["jpg", "jpeg", "png", "webp"];
  var map = (window.SITE_CONFIG && window.SITE_CONFIG.images) || {};
  /* Numéro de version = date de la dernière publication : chaque publication force
     le navigateur à recharger les images (évite d'afficher une ancienne réponse en cache). */
  var stamp = window.SITE_CONFIG && window.SITE_CONFIG.publishedAt;
  var v = stamp ? "?v=" + encodeURIComponent(String(stamp).replace(/\D/g, "").slice(0, 14)) : "";

  function show(slot, src) {
    var img = document.createElement("img");
    img.className = "img-fill";
    img.src = src;
    img.alt = slot.getAttribute("data-label") || "";
    img.loading = "lazy";
    slot.appendChild(img);
    slot.classList.add("has-img");
  }
  function tryList(slot, list, i) {
    if (i >= list.length) return;
    var probe = new Image();
    probe.onload = function () { show(slot, probe.src); };
    probe.onerror = function () { tryList(slot, list, i + 1); };
    probe.src = list[i];
  }
  document.querySelectorAll(".img-slot[data-img]").forEach(function (slot) {
    var def = slot.getAttribute("data-img");                       // assets/images/hero/portrait.jpg
    var base = def.replace(/\.[a-z]+$/i, "");                      // assets/images/hero/portrait
    var key = base.replace("assets/images/", "");                  // hero/portrait
    var dir = def.slice(0, def.lastIndexOf("/") + 1);              // assets/images/hero/
    var list = [];
    if (map[key] && /^(blob:|data:|https?:)/.test(map[key])) list.push(map[key]);         // aperçu de l'admin / image externe
    else if (map[key]) list.push(dir + encodeURIComponent(map[key]).replace(/%2F/g, "/") + v);
    exts.forEach(function (e) { list.push(base + "." + e + v); });
    tryList(slot, list, 0);
  });
})();