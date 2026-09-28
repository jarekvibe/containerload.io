// Der Teilen-Anstoss: die Wachstumsschleife bekommt ihren Moment.
//
// Gemessen (Admin-Export, 30 Tage): 95 gerechnete Plaene, genau EIN geteilter.
// Die Schleife (teilen -> Empfaenger sieht 3D -> wird Nutzer) existiert als
// Feature, zuendet aber nicht -- der Teilen-Knopf oben rechts ist nicht im
// Blick, wenn der Plan unten fertig wird. Der Anstoss erscheint deshalb als
// unterster Banner im Bild, genau einmal, und laesst sich dauerhaft abschalten.
//
// node --test test/teilen-anstoss.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("beide Sprachen kennen den Anstoss", () => {
  for (const k of ["teilenNudge:", "teilenNudgeBtn:"]) {
    const n = (roh.match(new RegExp("\\n\\s*" + k, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x da statt zweimal (deutsch und englisch)`);
  }
});

test("der Anstoss ist einmalig -- und genau dafuer einmal vorne", () => {
  // Die Empfehlung geht immer vor (zeigeBanner). Der Sicherungs-Aufplopp laesst
  // dem EINMALIGEN Anstoss den Vortritt -- sonst saehe ihn nie jemand, denn
  // Sicherungs-Hinweise gibt es bei fast jedem Plan. Unfertige (planFit) und
  // empfangene Plaene (shareBar) zeigen nichts.
  assert.ok(roh.includes("const teilenAnstossAktiv = !manualMode && !EMBEDDED && !shareBar && !teilenWeg && !leer && planFit && sichtBoxes > 0 && !zeigeBanner && !sichZeige && !sichOpen;"),
    "die Anzeige-Bedingung ist nicht mehr die vereinbarte");
  assert.ok(roh.includes("!manualMode && !zeigeBanner && !teilenAnstossAktiv && sichWarnzahl > 0 && !sichBannerWeg"),
    "der Sicherungs-Aufplopp laesst dem einmaligen Anstoss nicht mehr den Vortritt");
  assert.ok(roh.includes("teilenAnstossAktiv && /* @__PURE__ */ React.createElement"),
    "der Anstoss haengt nicht an der benannten Bedingung");
});

test("einmal weggeklickt oder geteilt heisst dauerhaft weg", () => {
  assert.ok(roh.includes('localStorage.getItem("cl-teilen-anstoss-weg") === "1"'),
    "der Anstoss liest sein Abschalten nicht");
  assert.ok(roh.includes('const teilenNudgeWeg = () => { setTeilenWeg(true); try { localStorage.setItem("cl-teilen-anstoss-weg", "1"); } catch (e) {} };'),
    "das Wegklicken haelt nicht dauerhaft");
  // Wer ueber IRGENDEINEN Weg teilt (auch den Kopf-Knopf), braucht den Anstoss nie wieder.
  assert.ok(/const doShare = \(\) => \{\n\s*zaehl\("geteilt"\);\n\s*teilenNudgeWeg\(\);/.test(roh),
    "doShare schaltet den Anstoss nicht ab");
});

test("der Klick zaehlt seinen Ursprung und oeffnet den echten Teilen-Dialog", () => {
  assert.ok(roh.includes('onClick: () => { zaehl("teilen-anstoss"); doShare(); }'),
    "der Knopf zaehlt nicht oder oeffnet nicht doShare");
});
