// Das Blatt: ein Bild je Container statt aller nebeneinander.
//
// Gefragt wurde: "kann man die Ansicht von mehreren Containern aendern, dass diese
// einzeln besser zu sehen sind? Vielleicht eine seitlichere Ansicht?" Beides stimmt, und
// beides zusammen erst recht:
//
//   * In der Reihe teilen sich drei 40-Fuesser die Bildbreite. Jeder bekommt ein Drittel,
//     und darin steckt er auch noch schraeg - da ist keine Lage mehr zu erkennen.
//   * Der Blickwinkel der Uebersicht (33 Grad Aufsicht, 53 Grad seitlich) kippt einen
//     12 m langen Container so stark ins Bild, dass die halbe Kachel leer bleibt. Die
//     Neigung auf dem Schirm ist cos(phi)*cos(theta) - flacher und seitlicher heisst
//     weniger Neigung und damit mehr Container je Kachel.
//
// node --test test/bild-blatt.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");

const s = L.findIndex((l) => l.includes("function camFit(hx, hy, hz, aspect"));
const e = L.findIndex((l, i) => i > s && l === "  }");
const { camFit } = new Function(L.slice(s, e + 1).join("\n") + "\nreturn { camFit };")();

// Wie stark kippt ein Quader bei diesem Blickwinkel auf dem Schirm? Der Aufwaerts-Vektor
// der Kamera hat einen Anteil in Welt-X; genau der macht die Diagonale.
const neigung = (th, ph) => Math.abs(Math.cos(ph) * Math.cos(th));

test("die Einzelkachel schaut flacher und seitlicher als die Uebersicht", () => {
  const kachel = /KACHEL_ASP = ([\d.]+), KACHEL_THETA = (-?[\d.]+), KACHEL_PHI = ([\d.]+)/.exec(roh);
  assert.ok(kachel, "die Kachel-Blickwinkel stehen nicht mehr als Konstanten da");
  const [, asp, th, ph] = kachel.map(Number);
  assert.ok(neigung(th, ph) < neigung(-0.92, 1) * 0.6,
    `die Kachel kippt mit ${neigung(th, ph).toFixed(3)} kaum weniger als die Uebersicht ` +
    `(${neigung(-0.92, 1).toFixed(3)}) - dann bringt der eigene Winkel nichts`);
  // Aber nicht so flach, dass die Deckel verschwinden: die Lagen erkennt man von oben.
  assert.ok(ph < 1.35, `phi ${ph} ist zu flach - die Deckflaechen waeren nicht mehr zu sehen`);
  assert.ok(asp > 1.8 && asp < 2.8, `Kachelverhaeltnis ${asp} passt nicht zu einem 40-Fuesser`);
});

test("bei diesem Winkel fuellt ein 40-Fuesser seine Kachel", () => {
  // Ein 40' HC: 12,03 x 2,35 x 2,70 m. Gemessen wird, wie gross er im Bild wird -
  // je kleiner die noetige Entfernung, desto groesser der Container in der Kachel.
  const [hx, hy, hz] = [6.015, 1.35, 1.175];
  const alt = camFit(hx, hy, hz, 2.1, -0.92, 1);
  const neu = camFit(hx, hy, hz, 2.1, -1.17, 1.17);
  assert.ok(neu < alt * 0.92,
    `der seitlichere Winkel bringt nur ${(100 - neu / alt * 100).toFixed(0)} % - zu wenig, um den Umbau zu rechtfertigen`);
});

test("die Einzelaufnahme blendet die anderen Container aus", () => {
  assert.ok(/const nurSlot = opts\.slot;/.test(roh), "captureView kennt keinen einzelnen Slot");
  assert.ok(/if \(c2\.userData && c2\.userData\.slot != null && c2\.userData\.slot !== nurSlot && c2\.visible\)/.test(roh),
    "ohne das stehen die Nachbarcontainer mit in der Kachel");
  assert.ok(/versteckt\.forEach\(\(c2\) => \{ c2\.visible = true; \}\);/.test(roh),
    "und danach muessen sie wieder sichtbar werden - sonst bleibt die Live-Ansicht leer");
});

test("die Slot-Marke ueberlebt das Setzen von userData", () => {
  // Die Falle: cg.userData wird spaeter komplett ersetzt. Wer die Marke nur vorher setzt,
  // hat sie danach verloren - und alle Kacheln zeigen die ganze Reihe. Genau so passiert.
  assert.ok(/cg\.userData = \{ slot: ci, boxMeshes,/.test(roh),
    "die Slot-Marke fehlt in dem Objekt, das userData ersetzt");
  assert.ok(/tk\.userData\.slot = ci;/.test(roh), "der Lastzug traegt keine Marke");
});

test("jeder Container kennt seinen eigenen Rahmen", () => {
  assert.ok(/slots: dimsArr\.map\(\(d, i\) => \(\{ cx: xpos\[i\] \+ d\.CL \/ 2, cy: \(isRoad \? BASE_Y : 0\) \+ d\.CH \/ 2, cz: d\.CW \/ 2, hx: d\.CL \/ 2, hy: d\.CH \/ 2, hz: d\.CW \/ 2 \}\)\)/.test(roh),
    "ohne die Einzelrahmen kann der Export nicht auf einen Container einpassen");
});

test("das Blatt kommt nur, wenn es etwas zu trennen gibt", () => {
  assert.ok(/const blatt = !manualMode && exportLayout === "blatt" && slotsImBild\.length > 1;/.test(roh),
    "bei einem Container gibt es nichts aufzuteilen, und im manuellen Modus keine Kette");
  assert.ok(/result\.chain && result\.chain\.length > 1 && !manualMode \? \/\* @__PURE__ \*\/ React\.createElement\("div", \{ style: \{ marginBottom: 16 \} \}, \/\* @__PURE__ \*\/ React\.createElement\(Lbl/.test(roh),
    "der Umschalter darf nicht erscheinen, wenn es nur einen Container gibt");
  for (const k of ["shotLayoutLabel", "shotLayoutRow", "shotLayoutSheet", "shotLayoutRowHint", "shotLayoutSheetHint"]) {
    const n = (roh.match(new RegExp(`[{,\\n]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
});

test("die Kacheln gehen in vollen Reihen auf", () => {
  assert.ok(/const zeilen = Math\.ceil\(bilder\.length \/ 3\);/.test(roh) &&
            /const spalten = Math\.ceil\(bilder\.length \/ zeilen\);/.test(roh),
    "sonst steht die letzte Reihe angebrochen da");
  const zeilen = (n) => Math.ceil(n / 3);
  const spalten = (n) => Math.ceil(n / zeilen(n));
  assert.strictEqual(spalten(3), 3);
  assert.strictEqual(spalten(4), 2, "4 Kacheln muessen 2x2 werden, nicht 3+1");
  assert.strictEqual(spalten(6), 3);
  assert.strictEqual(spalten(8), 3);
});

test("Kopfzeile und Balken sind EIN Baustein, nicht zwei", () => {
  // Die Kachelleiste unter dem Reihenbild und die Kachel auf dem Blatt zeigen dieselben
  // Zahlen. Zwei Zeichenroutinen dafuer laufen frueher oder spaeter auseinander.
  assert.ok(/const slotKopf = \(sr, ix, y, iw, glas\) =>/.test(roh));
  assert.ok(/const slotWerte = \(sr, ix, yTop, iw, glas\) =>/.test(roh));
  assert.strictEqual((roh.match(/slotKopf\(sr, ix,/g) || []).length, 2, "slotKopf muss von beiden benutzt werden");
  assert.strictEqual((roh.match(/slotWerte\(sr, ix,/g) || []).length, 2, "slotWerte ebenso");
});
