/* Apparition des blocs au scroll, en cascade dans les grilles.
   Désactivée si l'option « Animations : aucune » est choisie dans le back-office. */
(function () {
  var sel = ".stat,.venture,.cam,.card,.client-item,.t-item,.quote,.aiky,.train-block,.cam-point";
  var html = document.documentElement;
  if (!("IntersectionObserver" in window) || html.getAttribute("data-anim") === "aucune" || /[?&]apercu=global/.test(location.search)) { html.classList.remove("js"); return; }
  var els = document.querySelectorAll(sel);
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add("in"); io.unobserve(el);
      setTimeout(function () { el.style.transitionDelay = ""; }, 1400); // le délai ne doit pas ralentir les survols
    });
  }, { threshold: 0.12 });
  els.forEach(function (el) {
    var i = Array.prototype.indexOf.call(el.parentNode.children, el);
    if (i > 0) el.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
    el.classList.add("reveal"); io.observe(el);
  });
})();
