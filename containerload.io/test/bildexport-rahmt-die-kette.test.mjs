// Der Bildexport muss den ganzen Plan ins Bild bekommen.
//
// Gemeldet: "wenn ich ein Bild davon machen will, passt das alles nicht rauf." Der Grund
// stand im Code: die Export-Kamera wurde auf die Masse des GEWAEHLTEN Containers
// eingepasst — bei einer Kette aus drei Containern lag alles ab dem zweiten ausserhalb
// des Bildes. Die Live-Ansicht rechnete die Halbmasse der ganzen Reihe laengst aus
// (t.frame); der Export las sie nur nicht.
//
// Dazu das Bildformat: eine Reihe aus drei 40-Fuessern ist ueber 40 m lang und 2,7 m hoch.
// In ein 16:10-Bild gepresst bleiben zwei leere Drittel uebrig.
//
// node --test test/bildexport-rahmt-die-kette.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");

// camFit steht auf Modulebene, damit Live-Ansicht UND Export dieselbe Einpassung benutzen.
const s = L.findIndex((l) => l.includes("function camFit(hx, hy, hz, aspect"));
assert.ok(s >= 0, "camFit muss auf Modulebene stehen - sonst hat der Export wieder seine eigene Rechnung");
const e = L.findIndex((l, i) => i > s && l === "  }");
const { camFit } = new Function(L.slice(s, e + 1).join("\n") + "\nreturn { camFit };")();

const passt = (hx, hy, hz, aspect) => {
  // Bei der von camFit gelieferten Entfernung muessen ALLE acht Ecken im Bild liegen.
  const dist = camFit(hx, hy, hz, aspect);
  const th = -0.92, ph = 1;
  const dir3 = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
  const rgt = [-Math.sin(th), 0, Math.cos(th)];
  const up = [dir3[1] * rgt[2] - dir3[2] * rgt[1], dir3[2] * rgt[0] - dir3[0] * rgt[2], dir3[0] * rgt[1] - dir3[1] * rgt[0]];
  const tY = Math.tan(40 * Math.PI / 180 / 2), tX = tY * Math.max(0.5, aspect);
  for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) {
    const p = [sx * hx, sy * hy, sz * hz];
    const tiefe = dist - (p[0] * dir3[0] + p[1] * dir3[1] + p[2] * dir3[2]);
    if (tiefe <= 0) return false;
    const rr = Math.abs(p[0] * rgt[0] + p[1] * rgt[1] + p[2] * rgt[2]);
    const uu = Math.abs(p[0] * up[0] + p[1] * up[1] + p[2] * up[2]);
    if (rr > tiefe * tX + 1e-9 || uu > tiefe * tY + 1e-9) return false;
  }
  return true;
};

test("die Einpassung haelt, was sie verspricht - vom Einzelcontainer bis zur langen Kette", () => {
  const faelle = [
    ["20' GP einzeln", 2.95, 1.195, 1.175],
    ["40' HC einzeln", 6.015, 1.35, 1.175],
    ["2 x 40' HC", 13.0, 1.35, 1.175],
    ["3 x 40' HC", 20.0, 1.35, 1.175],
    ["8 x 45' HC", 56.0, 1.35, 1.175]
  ];
  for (const [name, hx, hy, hz] of faelle) {
    for (const aspect of [1.6, 1.9, 2.2]) {
      assert.ok(passt(hx, hy, hz, aspect), `${name} bei ${aspect}:1 nicht vollstaendig im Bild`);
    }
  }
});

test("eine laengere Reihe braucht mehr Abstand - sonst waere nichts gewonnen", () => {
  const einzeln = camFit(6.015, 1.35, 1.175, 1.6);
  const drei = camFit(20.0, 1.35, 1.175, 1.6);
  assert.ok(drei > einzeln * 2, `Kette ${drei.toFixed(1)} vs. einzeln ${einzeln.toFixed(1)}`);
});

test("der Export passt auf die REIHE ein, nicht auf einen Container", () => {
  assert.ok(/const frAll = three\.current && three\.current\.frame;/.test(roh),
    "der Export liest die Reihen-Masse nicht aus t.frame");
  // Mit slot: nur dieser eine Container; ohne: die ganze Reihe.
  assert.ok(/const fr = nurSlot != null && frAll && frAll\.slots && frAll\.slots\[nurSlot\] \? frAll\.slots\[nurSlot\] : frAll;/.test(roh),
    "die Einzelaufnahme greift nicht auf den Rahmen ihres Containers zu");
  assert.ok(/const hx = fr \? fr\.hx : CLm \/ 2, hy = fr \? fr\.hy : CHm \/ 2, hz = fr \? fr\.hz : CWm \/ 2;/.test(roh));
  assert.ok(/hx: rowW \/ 2, hy: maxCH \/ 2, hz: maxCW \/ 2/.test(roh),
    "t.frame traegt die Halbmasse der Reihe nicht mehr");
  assert.ok(/dist = Math\.max\(2\.5, camFit\(hx, hy, hz, aspect, theta, phi\)/.test(roh));
});

test("das Bildformat folgt der Laenge der Reihe", () => {
  assert.ok(/const outAsp = opts\.aspect \|\| Math\.max\(1\.6, Math\.min\(2\.2, 1\.05 \+ 0\.22 \* laengs\)\);/.test(roh),
    "das Seitenverhaeltnis waechst nicht mehr mit der Reihe (oder die Kachel kann es nicht mehr vorgeben)");
  const asp = (laengs) => Math.max(1.6, Math.min(2.2, 1.05 + 0.22 * laengs));
  // 20' einzeln: 2,95 / 1,195 = 2,47 -> bleibt bei 16:10 wie bisher
  assert.strictEqual(asp(2.47), 1.6);
  // 3 x 40' HC: 20 / 1,35 = 14,8 -> gedeckelt bei 16:7,3
  assert.strictEqual(asp(14.8), 2.2);
  assert.ok(asp(5) > 1.6 && asp(5) < 2.2, "dazwischen muss es stufenlos sein");
});

test("der Nebel wird fuer den Export mitgezogen", () => {
  // Sonst verschwindet der hinterste Container im Dunst: der Nebel war auf die
  // Live-Entfernung gestellt, die Export-Kamera steht weiter weg.
  assert.ok(/if \(scene\.fog\) scene\.fog\.far = Math\.max\(prevFogFar, dist \+ 2 \* hx \+ 20\);/.test(roh));
  assert.ok(/if \(scene\.fog\) scene\.fog\.far = prevFogFar;/.test(roh), "und danach wieder zurueckgestellt");
});
