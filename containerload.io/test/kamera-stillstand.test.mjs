// Die 3D-Ansicht steht still, solange niemand sie anfasst (Jareks Wunsch, 30.10.26:
// „dass sich der Container automatisch dreht die ganze Zeit — das nervt").
//
// Zwei Zusagen und eine Falle:
//   * Keine Leerlaufdrehung — weder im Rechner (Viewport) noch in der Palettierer-
//     Vorschau (PalletScene), die bewusst dieselbe Kamerafuehrung hat.
//   * Der Pause-Knopf, der nur die Leerlaufdrehung schaltete, ist weg; „01" (Nummern)
//     und „⟳" (Ansicht zuruecksetzen) bleiben.
//   * DIE FALLE beim Ausbau: `const now = performance.now()` sah aus wie ein Teil der
//     Drehung, wird aber im selben Bild-Schritt fuer die Einblend-Animation gebraucht.
//     Ohne die Zeile wirft tick() beim ersten Bild einen ReferenceError, die Render-
//     Schleife stirbt — die Szene friert ein und laesst sich nicht mehr drehen. Weder
//     `node --check` noch ein anderer Test faengt das; deshalb die Wache unten.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

// Alle tick-Funktionen mit ihrem Koerper (Klammern gezaehlt, nicht geraten).
const ticks = (() => {
  const out = [];
  let i = 0;
  const marke = "const tick = () => {";
  while ((i = app.indexOf(marke, i)) >= 0) {
    let tiefe = 0, j = i + marke.length - 1;
    for (; j < app.length; j++) {
      if (app[j] === "{") tiefe++;
      else if (app[j] === "}" && --tiefe === 0) break;
    }
    out.push(app.slice(i, j + 1));
    i = j;
  }
  return out;
})();

test("es gibt die beiden Kameras (Rechner + Palettierer)", () => {
  assert.ok(ticks.length >= 2, `nur ${ticks.length} tick-Funktion(en) gefunden`);
});

test("keine Leerlaufdrehung — die Ansicht bewegt sich nur auf Eingriff", () => {
  for (const t of ticks) {
    assert.ok(!/sph\.theta\s*\+=/.test(t),
      "ein tick() dreht die Kamera von selbst (sph.theta +=) — die Ansicht soll stillstehen");
  }
  assert.ok(!/autoRotate|setSpin|spinRef/.test(app), "Reste der Leerlaufdrehung (autoRotate/spin) stehen noch im Code");
});

test("jede tick-Funktion, die `now` liest, legt es auch an", () => {
  for (const t of ticks) {
    const koerper = t.slice(t.indexOf("{") + 1);
    if (!/\bnow\b/.test(koerper)) continue;
    assert.ok(/const now = performance\.now\(\);/.test(koerper),
      "tick() liest `now`, legt es aber nicht an — ReferenceError im ersten Bild, die Render-Schleife stirbt");
  }
});

test("oben rechts in der Buehne: Nummern und Zuruecksetzen, kein Pause-Knopf", () => {
  assert.ok(!/"\\u23F8"|"\\u25B6"|"⏸"|"▶"/.test(app), "ein Pause-/Play-Knopf steht noch in der Oberflaeche");
  assert.ok(app.includes('title: T.resetView }, "\\u27F3")'), "der Zuruecksetzen-Knopf fehlt");
  assert.ok(/title: zeigeNummern \? T\.numAus : T\.numAn \}, "01"\)/.test(app), "der Nummern-Knopf fehlt");
  assert.ok(!/autoRotatePause|autoRotateResume/.test(app), "die Texte des Pause-Knopfs stehen noch im Woerterbuch");
});
