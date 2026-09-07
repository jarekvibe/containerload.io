// Weisse Packstuecke im Ladevorschlag.
//
// Gemeldet: wer einer Position Weiss gibt (erlaubt — "Wer weisse Kartons hat, soll
// sie weiss sehen"), bekam im Druckdokument unsichtbare Boxen. Die App ist dunkel,
// der Ladevorschlag ist weisses Papier — dieselbe Kennfarbe, zwei Welten.
//
// Der Fix hat zwei Haelften, und BEIDE haelt dieser Test fest:
// 1. lvDruckfarbe misst die relative Luminanz (WCAG) und klemmt jede zu helle
//    Farbe unter LV_LUM_MAX — kein Sonderfall "weiss", jede Pastellfarbe faellt
//    genauso darunter. Geklemmt wird an der Eintrittsstelle der Nutzerfarben
//    (tiColor/tiC in buildLadevorschlag) und defensiv in LV_STOWAGE selbst.
// 2. Die Kontur der Boxen im Stauplan haengt NIE an der Nutzerfarbe: fester
//    dunkler Strich (#0c1320), die Farbe traegt nur Fuellung und Beschriftung.
//
// node --test test/ladevorschlag-druckfarben.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = roh.split("\n");
const schnitt = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && l.includes(bis));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e).join("\n");
};

// Die Helfer sind abhaengigkeitsfrei und lassen sich am Stueck ausschneiden.
const { LV_LUM_MAX, relLuminanz, lvDruckfarbe } = new Function(
  schnitt("var LV_LUM_MAX =", "  var LV_STOWAGE =")
  + "\nreturn { LV_LUM_MAX, relLuminanz, lvDruckfarbe };"
)();

test("die Grenze steht fest — wer sie aufmacht, entscheidet das im Test mit", () => {
  // Wie bei SUPPORT_MIN: gegen den Literalwert, nicht gegen die Variable —
  // sonst wuechse der Test stillschweigend mit.
  assert.ok(roh.includes("var LV_LUM_MAX = 0.3;"), "LV_LUM_MAX ist nicht mehr 0.3");
  assert.strictEqual(LV_LUM_MAX, 0.3);
});

test("weiss wird fuers Papier abgedunkelt — und bleibt unter der Grenze", () => {
  const w = lvDruckfarbe("#FFFFFF");
  assert.notStrictEqual(w.toLowerCase(), "#ffffff", "weiss bleibt weiss — unsichtbar auf Papier");
  assert.ok(relLuminanz(w) <= LV_LUM_MAX + 1e-9, `Luminanz ${relLuminanz(w)} liegt ueber der Grenze`);
});

test("jede zu helle Farbe faellt unter die Grenze — kein Sonderfall weiss", () => {
  // Pastell, Gelb, helles Cyan, Grau: alles, was auf weissem Papier verschwimmt.
  for (const c of ["#FFFFFF", "#FFFF00", "#FFC21F", "#E6F7FF", "#F8BBD0", "#CCCCCC", "#16D9C4", "#2BE06B"]) {
    const d = lvDruckfarbe(c);
    assert.ok(relLuminanz(d) <= LV_LUM_MAX + 1e-9,
      `${c} -> ${d}: Luminanz ${relLuminanz(d)} liegt ueber ${LV_LUM_MAX}`);
  }
});

test("dunkle Farben bleiben unangetastet", () => {
  for (const c of ["#3b8cff", "#000000", "#0c1320", "#ff3d6e", "#b15cff"]) {
    assert.strictEqual(lvDruckfarbe(c), c, `${c} ist dunkel genug und darf nicht veraendert werden`);
  }
});

test("der Farbton bleibt beim Abdunkeln erkennbar", () => {
  // Gelb bleibt gelblich (R und G ueber B), der Kanal-Verhaeltnis kippt nicht.
  const d = lvDruckfarbe("#FFC21F");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(d.slice(i, i + 2), 16));
  assert.ok(r > b && g > b, `aus Gelb wurde ${d} — der Ton ist verloren`);
});

test("Kurzform und Kaputtes: #fff wird verstanden, Unlesbares faellt auf einen dunklen Ton", () => {
  assert.strictEqual(lvDruckfarbe("#fff"), lvDruckfarbe("#ffffff"));
  for (const kaputt of ["", null, undefined, "red", "#12", "rgba(1,2,3,.5)"]) {
    const d = lvDruckfarbe(kaputt);
    assert.match(d, /^#[0-9a-f]{6}$/, `${kaputt} ergibt keine Hex-Farbe: ${d}`);
    assert.ok(relLuminanz(d) <= LV_LUM_MAX, `${kaputt} ergibt eine zu helle Farbe: ${d}`);
  }
});

test("die Klemme ist idempotent — doppelt geklemmt aendert nichts mehr", () => {
  for (const c of ["#FFFFFF", "#FFC21F", "#3B8CFF", "#16D9C4"]) {
    const einmal = lvDruckfarbe(c);
    assert.strictEqual(lvDruckfarbe(einmal), einmal, `${c}: zweite Klemme veraendert ${einmal}`);
  }
});

// ── Der Vertrag im Quelltext ────────────────────────────────────────────────────────
test("Nutzerfarben werden an ihrer Eintrittsstelle ins Dokument geklemmt", () => {
  // Deckblatt/Einzelblatt und die Blaetter je Container — beide Wege.
  assert.ok(/tiColor\[p\.ti\] = lvDruckfarbe\(colorOf\(it, p\.ti\)\);/.test(roh),
    "das Deckblatt uebernimmt die Nutzerfarbe ungeklemmt");
  assert.ok(/tiC\[b\.ti\] = lvDruckfarbe\(colorOf\(cargo\[b\.ti\], b\.ti\)\);/.test(roh),
    "die Container-Blaetter uebernehmen die Nutzerfarbe ungeklemmt");
});

test("die Kontur der Stauplan-Boxen haengt nicht an der Nutzerfarbe", () => {
  const stowage = schnitt("var LV_STOWAGE =", "  var LV_PAGE =");
  // Draufsicht UND Seitenansicht: Fuellung aus der geklemmten Farbe, Strich fest dunkel.
  const feste = (stowage.match(/fill="\$\{tint\(col\)\}" stroke="#0c1320"/g) || []).length;
  assert.strictEqual(feste, 2,
    "Draufsicht und Seitenansicht muessen eine feste dunkle Kontur zeichnen (2 Fundstellen erwartet)");
  // Und keine Box-Fuellflaeche traegt mehr einen Strich in der Nutzerfarbe.
  assert.ok(!/fill="\$\{tint\(col\)\}" stroke="\$\{col\}"/.test(stowage),
    "eine Box haengt ihre Kontur wieder an die Nutzerfarbe — weiss waere unsichtbar");
  // LV_STOWAGE klemmt zusaetzlich selbst (Defensive, falls ein neuer Aufrufer vorbeikommt).
  const klemmen = (stowage.match(/lvDruckfarbe\(tiColor\[/g) || []).length;
  assert.strictEqual(klemmen, 2, "die defensive Klemme in LV_STOWAGE fehlt");
  assert.ok(/lvDruckfarbe\(g\.color/.test(stowage), "die Legende klemmt ihre Farbe nicht");
});

test("der Farb-Chip der Belade-Reihenfolge traegt eine farbunabhaengige Kontur", () => {
  const seq = schnitt("var LV_SEQUENZ =", "  var LV_UEBERSICHT =");
  assert.ok(/background:\$\{tiColor\[sc\.ti\][^\n]*border:1px solid rgba\(12,19,32,\.35\)/.test(seq),
    "der Chip hat keinen festen Rand — ein weisser Chip verschwindet auf dem Blatt");
});
