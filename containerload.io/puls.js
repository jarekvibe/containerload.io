// "Gerade online": Solange diese Seite offen, im Vordergrund und in Benutzung ist, schickt sie
// etwa einmal je Minute ein Lebenszeichen an /api/puls. Daraus zeigt das Admin, wie viele
// Seiten gerade offen sind und aus welchen Laendern.
//
// Uebertragen wird EIN WORT aus einer festen Liste -- die Art der Seite. Keine Adresse, kein
// Inhalt, keine Kennung, kein Cookie; gespeichert wird auf dem Geraet nichts. Das Land
// leitet der Server aus der Anfrage ab und merkt sich nur den Laendercode. So steht es in der
// Datenschutzerklaerung (Abschnitt 5) -- wer hier etwas ergaenzt, ergaenzt es ZUERST dort.
(function () {
  "use strict";
  // Nur auf der echten Seite: nicht lokal, nicht in Deploy-Previews.
  if (!/(^|\.)containerload\.io$/.test(location.hostname)) return;
  // Eingebettet (iframe) zaehlt nicht -- das ist der Besucher einer anderen Seite.
  try { if (window.self !== window.top) return; } catch (e) { return; }
  // "Do Not Track" und Global Privacy Control: dann wird nichts gesendet.
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
  // Der Betreiber zaehlt nicht mit (dieselbe Markierung wie bei der Nutzungsstatistik).
  try { if (localStorage.getItem("cl-eigene-nutzung") === "1") return; } catch (e) {}

  var p = location.pathname;
  var art = /^\/app(\.html)?\/?$/.test(p) ? "rechner"
    : /^\/((en|es|fr|zh|nl|pt)\/)?(index\.html)?$/.test(p) ? "start"
    : /^\/(ratgeber|en\/guide|nl\/gids|es\/guia|fr\/guide)(\/|$)/.test(p) ? "wissen"
    : "sonst";

  var TAKT = 60000;        // ein Lebenszeichen je Minute
  var RUHE = 5 * 60000;    // fuenf Minuten ohne Regung: niemand da -- ein offener Tab ist kein Besucher
  var ERST = 8000;         // das erste erst nach acht Sekunden: wer sofort wieder geht (oder ein Crawler ist), zaehlt nicht
  var aktiv = Date.now(), zuletzt = 0;
  var regung = function () { aktiv = Date.now(); };
  ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, regung, { passive: true, capture: true });
  });
  var senden = function () {
    var jetzt = Date.now();
    if (document.visibilityState !== "visible") return;
    if (jetzt - aktiv > RUHE) return;
    if (jetzt - zuletzt < TAKT - 5000) return;       // hoechstens eines je Takt, auch wenn der Tab hin- und herwechselt
    zuletzt = jetzt;
    try { navigator.sendBeacon("/api/puls", art); } catch (e) {}
  };
  setTimeout(function () {
    senden();
    setInterval(senden, TAKT);
    document.addEventListener("visibilitychange", senden);
  }, ERST);
})();
