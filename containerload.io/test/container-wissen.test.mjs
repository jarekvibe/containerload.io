// Die Seiten unter /ratgeber/ teilen sich EINE Gestaltung.
//
// Vorgeschichte: Jede der zehn Seiten trug ihre eigene Kopie derselben Regeln. Sie mussten
// auseinanderlaufen, und sie taten es — eigener Grundton (#070a0f statt #0E1116), eigener
// Akzent (#2f9bff statt #2E8FFF), ein Tuerkis, das es im Produkt nicht mehr gibt, Inter
// statt Archivo, Gewicht 800 und Radien 10/14. Nah genug, um fuer dieselbe Marke gehalten
// zu werden — daneben genug, um fremd zu wirken. Genau daran erkennt man zusammengeklickte
// Seiten, und genau das soll nicht zurueckkommen.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wissen = path.join(dir, "..", "ratgeber");
const seiten = fs.readdirSync(wissen).filter((f) => f.endsWith(".html"));
const lies = (f) => fs.readFileSync(path.join(wissen, f), "utf8");
const css = fs.readFileSync(path.join(wissen, "wissen.css"), "utf8");
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("es gibt ueberhaupt Seiten und eine gemeinsame Datei", () => {
  assert.ok(seiten.length >= 9, `nur ${seiten.length} Seiten gefunden`);
  assert.ok(css.length > 500, "wissen.css ist leer oder fehlt");
});

test("jede Seite laedt die gemeinsame Datei", () => {
  const ohne = seiten.filter((f) => !lies(f).includes('href="/ratgeber/wissen.css"'));
  assert.deepStrictEqual(ohne, [], `ohne gemeinsame Gestaltung: ${ohne.join(", ")}`);
});

test("keine Seite bringt ihre eigenen Regeln wieder mit", () => {
  const eigen = seiten.filter((f) => /<style[\s>]/.test(lies(f)));
  assert.deepStrictEqual(eigen, [], `eigener style-Block: ${eigen.join(", ")}`);
});

test("keine Farbverlaeufe — das Regelwerk kennt einen Markenton", () => {
  const treffer = [...seiten.map((f) => [f, lies(f)]), ["wissen.css", css]]
    .filter(([, s]) => /linear-gradient|radial-gradient/.test(s)).map(([f]) => f);
  assert.deepStrictEqual(treffer, [], `Verlauf gefunden in: ${treffer.join(", ")}`);
});

test("die Schrift ist die des Produkts, nicht Inter", () => {
  const falsch = seiten.filter((f) => /family=Inter|'Inter'/.test(lies(f)));
  assert.deepStrictEqual(falsch, [], `laedt noch Inter: ${falsch.join(", ")}`);
  assert.ok(/family=Archivo/.test(lies(seiten[0])), "Archivo wird nicht geladen");
  assert.ok(css.includes("'Archivo'"), "wissen.css setzt Archivo nicht");
});

test("Grundton und Akzent stimmen mit dem Rechner ueberein", () => {
  // Aus app.html gelesen statt hier abgeschrieben: eine abgeschriebene Zahl waere die
  // naechste Kopie, die auseinanderlaeuft.
  const accent = app.match(/accent:\s*"(#[0-9A-Fa-f]{6})"/)[1];
  const text = app.match(/\btext:\s*"(#[0-9A-Fa-f]{6})"/)[1];
  assert.ok(css.toLowerCase().includes("--accent:" + accent.toLowerCase()), `Akzent weicht ab, erwartet ${accent}`);
  assert.ok(css.toLowerCase().includes("--text:" + text.toLowerCase()), `Textfarbe weicht ab, erwartet ${text}`);
  assert.ok(css.includes("--bg:#0E1116"), "Grundton ist nicht #0E1116");
  const themes = [...new Set(seiten.map((f) => (lies(f).match(/theme-color" content="([^"]+)"/) || [])[1]))];
  assert.deepStrictEqual(themes, ["#0E1116"], `abweichende theme-color: ${themes.join(", ")}`);
});

test("Radien und Gewichte bleiben in der Reihe", () => {
  const radien = [...new Set([...css.matchAll(/border-radius:\s*([\d]+)px/g)].map((m) => m[1]))];
  const erlaubt = new Set(["4", "8", "12", "16", "999"]);   // 4 = nur der Fokusrahmen
  assert.deepStrictEqual(radien.filter((r) => !erlaubt.has(r)), [], `Radien ausserhalb der Reihe: ${radien.join(", ")}`);
  const schwer = css.match(/font-weight:\s*(800|900)/g) || [];
  assert.deepStrictEqual(schwer, [], `Gewicht ueber 700: ${schwer.join(", ")}`);
});

test("der sichtbare Name ist Container-Wissen", () => {
  const alt = seiten.filter((f) => />Ratgeber\b|>Ratgeber\s*·/.test(lies(f)));
  assert.deepStrictEqual(alt, [], `nennt sich noch Ratgeber: ${alt.join(", ")}`);
});

test("Adressen, Fragen-Titel und Beschreibungen bleiben unberuehrt", () => {
  // Die URLs sind indexiert und die Titel sind die Fragen, nach denen gesucht wird —
  // daran wird beim Auffrischen der Gestaltung NICHTS geaendert.
  for (const f of seiten) {
    const s = lies(f);
    assert.ok(/<link rel="canonical" href="https:\/\/containerload\.io\/ratgeber\//.test(s), `${f}: canonical fehlt oder zeigt woanders hin`);
    assert.ok(/<meta name="description" content=".{40,}"/.test(s), `${f}: Beschreibung fehlt oder ist zu kurz`);
    assert.ok(/<title>.{15,}<\/title>/.test(s), `${f}: Titel fehlt`);
  }
});

test("das Markenzeichen ist dasselbe wie auf der Startseite", () => {
  // Zwei Fehler auf einmal waren hier drin: ein voellig anderes Symbol (Container mit
  // Streben statt des Marken-Wuerfels), und ein sichtbarer Spalt im Schriftzug, weil
  // "Container" und der Load-Span zwei Flex-Kinder von .brand waren — das gap:9px zog
  // sie auseinander, und aus ContainerLoad wurde "Container Load".
  const start = fs.readFileSync(path.join(dir, "..", "index.html"), "utf8");
  const flaechen = [...new Set([...start.matchAll(/fill="(#0[AaFf]2[Bb]46|#165780|#0[Ff]3[Cc]60)"/g)].map((m) => m[1].toUpperCase()))];
  assert.strictEqual(flaechen.length, 3, "die drei Wuerfelflaechen stehen nicht mehr in index.html");
  for (const f of seiten) {
    const s = lies(f);
    for (const flaeche of flaechen) {
      assert.ok(s.toUpperCase().includes(flaeche), `${f}: Wuerfelflaeche ${flaeche} fehlt — anderes Zeichen?`);
    }
    assert.ok(/<span class="brand-name">Container<span class="brand-load">Load<\/span><\/span>/.test(s),
      `${f}: Schriftzug ist nicht EIN Element — der Abstand zerreisst ihn`);
  }
});

test("der Abstand steht zwischen Zeichen und Schriftzug, nicht im Wort", () => {
  assert.ok(/\.brand\{[^}]*gap:/.test(css), ".brand hat keinen Abstand mehr");
  assert.ok(/\.brand-name\{/.test(css), "brand-name ist nicht gesetzt");
});
