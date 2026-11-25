// Sprach-Menue der Wissensseiten: Klick daneben oder Esc schliesst es wieder.
// Das Menue selbst ist ein <details> und laesst sich auch ohne dieses Skript bedienen --
// es geht dann nur nicht von selbst zu.
(function () {
  var m = [].slice.call(document.querySelectorAll("details.langmenu"));
  if (!m.length) return;
  document.addEventListener("click", function (e) {
    m.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") m.forEach(function (d) { d.open = false; });
  });
})();
