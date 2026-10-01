/* Menu mobile + surlignage du lien actif (scroll-spy) */
(function () {
  var nav = document.querySelector("nav");
  if (!nav) return;
  var toggle = nav.querySelector(".nav-toggle");
  var links = nav.querySelectorAll("ul a");

  function setOpen(open) {
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", open);
  }
  toggle.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
  links.forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });

  if (!("IntersectionObserver" in window)) return;
  var map = {};
  links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      links.forEach(function (a) { a.classList.remove("active"); });
      if (map[en.target.id]) map[en.target.id].classList.add("active");
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
})();
