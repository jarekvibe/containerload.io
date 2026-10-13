// Die Masse-Seiten versprechen woertlich: "dieselben Werte, mit denen der
// 3D-Rechner arbeitet." Dieser Test liest die Werte deshalb aus app.html
// (PRESETS) und prueft, dass Innenmasse und Tueroeffnungen auf BEIDEN
// Sprachfassungen stehen. Die Aussenmasse sind keine Rechner-Werte, sondern
// ISO-668-Norm -- sie stehen hier als Normwerte fest, damit eine stille
// Aenderung auf der Seite auffaellt.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = app.split("\n");
const pStart = L.findIndex((l) => l.includes("var PRESETS = {"));
const pEnd = L.findIndex((l, i) => i > pStart && l.trim() === "};");
const { PRESETS } = new Function(L.slice(pStart, pEnd + 1).join("\n") + "\nreturn { PRESETS };")();

const seiten = [
  ["ratgeber/container-masse-innenmasse.html"],
  ["en/guide/container-internal-dimensions.html"],
].map(([f]) => [f, fs.readFileSync(path.join(dir, "..", f), "utf8")]);

test("die Innenmass-Tabelle traegt exakt die PRESETS-Werte, in beiden Sprachen", () => {
  for (const name of ["20' GP", "20' HC", "40' GP", "40' HC", "45' HC"]) {
    const P = PRESETS[name];
    for (const [f, s] of seiten)
      for (const v of [P.l, P.w, P.h])
        assert.ok(new RegExp(`\\b${v} cm\\b`).test(s), `${f}: ${name} — ${v} cm fehlt`);
  }
});

test("die Tueroeffnungen in der Tabelle sind die der Tuerpruefung", () => {
  for (const name of ["20' GP", "40' HC"]) {
    const d = PRESETS[name].door;
    for (const [f, s] of seiten)
      assert.ok(s.includes(`${d.w} × ${d.h} cm`), `${f}: Tuer ${d.w} × ${d.h} fehlt (${name})`);
  }
});

test("die Aussenmasse bleiben die ISO-668-Normwerte", () => {
  // 20': 6.058 m, 40': 12.192 m, 45': 13.716 m; Breite 2.438 m; Hoehe 8'6" = 2.591 m,
  // High Cube 9'6" = 2.896 m -- auf der Seite gerundet in cm.
  for (const [f, s] of seiten) {
    for (const z of ["606 × 244 × 259 cm", "1219 × 244 × 259 cm", "1219 × 244 × 290 cm", "1372 × 244 × 290 cm"])
      assert.ok(s.includes(z), `${f}: Aussenmass ${z} fehlt`);
  }
});
