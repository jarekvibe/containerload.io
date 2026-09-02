// Der Empfaenger-Hinweis auf geteilten Plaenen ist der einzige Wachstumskanal, der mit
// der Nutzung waechst: jeder verschickte Link landet bei jemandem, der das Tool womoeglich
// nicht kennt. Diese Tests halten den Vertrag fest, ohne die React-App zu starten — sie
// lesen den Quelltext, wie die uebrigen Quelltext-Vertraege auch.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("beide Woerterbuecher tragen den Hinweis samt Knopf", () => {
  assert.ok(html.includes('shareBar: "Dieser Ladeplan wurde mit ContainerLoad erstellt'), "deutscher Text fehlt");
  assert.ok(html.includes('shareBar: "This load plan was made with ContainerLoad'), "englischer Text fehlt");
  assert.match(html, /shareBarBtn: "Eigenen Plan bauen/, "deutscher Knopf fehlt");
  assert.match(html, /shareBarBtn: "Build your own plan/, "englischer Knopf fehlt");
});

test("der Hinweis haengt am geteilten Link, nicht an jedem Besuch", () => {
  // Gegenprobe gegen die naheliegende Regression: die Leiste bei JEDEM Besuch zeigen.
  // Der Startwert des States muss SHARED pruefen und ohne SHARED false liefern.
  const init = html.match(/const \[shareBar, setShareBar\] = useState\(\(\) => \{([\s\S]{0,400}?)\}\);/);
  assert.ok(init, "shareBar-State nicht gefunden");
  assert.ok(init[1].includes("if (!SHARED) return false"), "ohne SHARED muss der Hinweis aus bleiben");
});

test("einmal weggeklickt heisst dauerhaft weg", () => {
  // Lesen UND Schreiben desselben Schluessels — sonst kommt die Leiste beim naechsten
  // geoeffneten Link wieder, und Absender, die eigene Links testen, klicken ewig weg.
  const liest = html.includes('localStorage.getItem("cl-sharebar-weg")');
  const schreibt = html.includes('localStorage.setItem("cl-sharebar-weg", "1")');
  assert.ok(liest, "liest den Merker nicht");
  assert.ok(schreibt, "schreibt den Merker nicht");
});

test("die Leiste rendert nur hinter dem Schalter", () => {
  assert.ok(html.includes("shareBar && /* @__PURE__ */ React.createElement"), "Render ist nicht an shareBar gebunden");
  // Der Knopf fuehrt in den leeren Rechner und nimmt die Sprache mit.
  assert.ok(html.includes('href: "/app" + (LANG === "en" ? "?lang=en" : "")'), "Knopfziel /app mit Sprachanhang fehlt");
});
