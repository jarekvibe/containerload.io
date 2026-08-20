// Die Auswahlreihen im Rechner sind RASTER, keine umbrechenden Reihen.
//
// Warum das einen Test bekommt: Fuenf Kacheln in einer flex-wrap-Reihe ergaben oben drei
// und unten zwei — und die untere Reihe stand unter keiner Spalte, weil flex den Rest
// verteilt statt ihn stehen zu lassen. Das faellt niemandem beim Programmieren auf und
// jedem beim Hinsehen. Die Regel ist deshalb nicht "sieht ordentlich aus", sondern
// nachrechenbar: die Kachelzahl geht in ganzen Reihen auf.
//
// Wer einen sechsten Containertyp oder ein sechstes Fahrzeug ergaenzt, faellt hier auf
// die Nase. Das ist der Zweck: dann muss jemand entscheiden, wie das Raster weitergeht.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

const zaehle = (name) => {
  const i = app.indexOf(`var ${name} = {`);
  assert.ok(i > 0, `${name} nicht gefunden`);
  // Bis zur schliessenden Klammer auf derselben Einrueckung
  const ende = app.indexOf("\n  };", i);
  const block = app.slice(i, ende);
  return (block.match(/^\s{4}"[^"]+": \{/gm) || []).length;
};

test("die Containertypen fuellen ihre Rasterreihen", () => {
  // KINDS_PRESENT + eine Kachel "eigene Masse"
  const kinds = (app.match(/var KIND_ORDER = \[([^\]]*)\]/) || [])[1];
  assert.ok(kinds, "KIND_ORDER nicht gefunden");
  const n = kinds.split(",").filter((x) => x.trim()).length + 1;
  assert.strictEqual(n % 3, 0,
    `${n} Kacheln (${n - 1} Typen + "eigene Masse") gehen bei 3 Spalten nicht auf — ` +
    "die letzte Reihe bliebe angebrochen. Entweder eine Kachel dazu oder die Spaltenzahl aendern.");
});

test("die Fahrzeuge fuellen ihre Rasterreihen", () => {
  const n = zaehle("VEHICLES") + 1;   // + "eigene Masse"
  assert.strictEqual(n % 3, 0,
    `${n} Kacheln (${n - 1} Fahrzeuge + "eigene Masse") gehen bei 3 Spalten nicht auf`);
});

test("die Auswahlreihen sind Raster, keine umbrechenden Reihen", () => {
  assert.ok(/const segGrid = \(n\) => \(\{ display: "grid", gridTemplateColumns: `repeat\(\$\{Math\.min\(n, 3\)\}, 1fr\)`/.test(app),
    "segGrid fehlt oder ist keine Rasterdefinition mehr");
  assert.ok(!/style: segWrap\b/.test(app),
    "irgendwo steht noch die alte umbrechende Reihe (segWrap)");
  assert.ok(/Object\.keys\(VEHICLES\)\.map[\s\S]{0,400}?gridTemplateColumns: "repeat\(3, 1fr\)"/.test(app) ||
            /gridTemplateColumns: "repeat\(3, 1fr\)"[\s\S]{0,400}?Object\.keys\(VEHICLES\)/.test(app),
    "die Fahrzeugkacheln stehen nicht in einem Dreispaltenraster");
});
