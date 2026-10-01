/* Point d'entrée : année du footer, etc. Les autres modules s'initialisent eux-mêmes. */
(function () {
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
