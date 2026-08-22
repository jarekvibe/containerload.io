// Gemeldet von einem Kollegen: man traegt alle Kartons sorgfaeltig ein und muss beim
// kleinsten Fehler von vorne anfangen.
//
// Es waren zwei Unfaelle in einem Satz:
//   * Vom Arbeitsstand ueberlebte NICHTS einen Reload. Gemerkt wurden nur Sprache,
//     Einheit, Reederei und die ausdruecklich gespeicherten Plaene. F5, Zurueck-Taste,
//     Tab zu — vierzig Positionen weg.
//   * Das Loeschen einer Position war endgueltig. Ein Klick, keine Rueckfrage, kein
//     Rueckgaengig (das gab es nur im manuellen Modus).
//
// Dazu zwei Wuensche, die denselben Kern haben: ein Knopf, der die ganze Ladung leert,
// und ein LEERER Start — vorher stand beim Oeffnen ein erfundenes Packstueck da, das
// jeder erst von Hand wegloeschen musste.
//
// node --test test/entwurf-und-undo.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const L = src.split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};

// Ein Browser-Speicher zum Mitrechnen.
const speicher = {};
const { loadDraft, saveDraft, clearDraft, DRAFT_KEY } = new Function(
  `var uid = (() => { let n = 0; return () => "id" + (++n); })();
   var window = { localStorage: {
     getItem: (k) => (k in this.__s ? this.__s[k] : null),
     setItem: (k, v) => { this.__s[k] = String(v); },
     removeItem: (k) => { delete this.__s[k]; }
   } };
   window.localStorage.__s = arguments[0];
   window.localStorage.getItem = (k) => (k in arguments[0] ? arguments[0][k] : null);
   window.localStorage.setItem = (k, v) => { arguments[0][k] = String(v); };
   window.localStorage.removeItem = (k) => { delete arguments[0][k]; };
   ${cut("var DRAFT_KEY", (l) => l.includes("var PLANS_KEY"))}
   return { loadDraft, saveDraft, clearDraft, DRAFT_KEY };`
)(speicher);

const LADUNG = [
  { id: "a", name: "Karton", l: 60, w: 40, h: 40, weight: 12, qty: 20, stackable: true, stackMax: Infinity, rotatable: true },
  { id: "b", name: "Kiste", l: 240, w: 110, h: 95, weight: 800, qty: 3, stackable: true, stackMax: 2, rotatable: false },
  { id: "c", name: "Maschine", l: 300, w: 120, h: 140, weight: 1500, qty: 1, stackable: false, stackMax: 1, rotatable: true }
];

test("ohne Entwurf gibt es nichts zurueckzuholen", () => {
  assert.strictEqual(loadDraft(), null);
});

test("der Entwurf ueberlebt Speichern und Lesen", () => {
  saveDraft({ preset: "40' HC", container: { l: 1203, w: 235, h: 270, payload: 26580 }, cargo: LADUNG, domain: "sea", forceCentered: false, planName: "Jan" });
  const d = loadDraft();
  assert.ok(d, "der Entwurf kam nicht zurueck");
  assert.strictEqual(d.preset, "40' HC");
  assert.strictEqual(d.planName, "Jan");
  assert.strictEqual(d.cargo.length, 3);
  assert.strictEqual(d.cargo[1].name, "Kiste");
  assert.strictEqual(d.cargo[1].qty, 3);
  assert.strictEqual(d.cargo[1].rotatable, false);
});

test("frei stapelbar bleibt frei stapelbar", () => {
  // Der Fallstrick: stackMax traegt Infinity, und JSON macht daraus null. Ohne
  // Ruecksetzung waere aus "frei stapelbar" beim naechsten Oeffnen "nicht stapelbar"
  // geworden — eine stille Aenderung an der Rechnung, ausgeloest durch einen Reload.
  const d = loadDraft();
  assert.strictEqual(d.cargo[0].stackMax, Infinity, "frei stapelbar ist verlorengegangen");
  assert.strictEqual(d.cargo[1].stackMax, 2, "die Obergrenze 2 ist verlorengegangen");
  assert.strictEqual(d.cargo[2].stackable, false, "nicht stapelbar ist verlorengegangen");
});

test("jede Position bekommt beim Zurueckholen eine frische Kennung", () => {
  const d = loadDraft();
  const ids = d.cargo.map((c) => c.id);
  assert.strictEqual(new Set(ids).size, ids.length, "doppelte Kennungen");
  assert.ok(!ids.includes("a"), "die alten Kennungen duerfen nicht wiederverwendet werden");
});

test("leeren raeumt den Entwurf weg", () => {
  clearDraft();
  assert.strictEqual(loadDraft(), null);
});

test("ein unsinnig grosser Entwurf wird gar nicht erst abgelegt", () => {
  const riesig = Array.from({ length: 20000 }, (_, i) => ({ ...LADUNG[0], id: "x" + i, name: "Position mit einem sehr langen Namen " + i }));
  saveDraft({ preset: "20' GP", container: {}, cargo: riesig, domain: "sea", forceCentered: false, planName: "" });
  assert.strictEqual(loadDraft(), null, "der Speicher des Browsers darf daran nicht scheitern");
});

test("kaputter Inhalt im Speicher wirft nichts um", () => {
  speicher[DRAFT_KEY] = "{kein json";
  assert.strictEqual(loadDraft(), null);
  speicher[DRAFT_KEY] = JSON.stringify({ v: 99, cargo: [] });
  assert.strictEqual(loadDraft(), null, "eine andere Fassung darf nicht gelesen werden");
  delete speicher[DRAFT_KEY];
});

test("der Rechner startet leer", () => {
  assert.match(src, /const INIT_CARGO = SHARED \? SHARED\.cargo : QIMPORT \|\| \(DRAFT && DRAFT\.cargo\) \|\| \[\];/,
    "beim Start darf kein erfundenes Packstueck mehr angelegt werden");
  // Und die letzte Position muss sich loeschen lassen — vorher hing das x an
  // "mehr als eine Position", weil der Rechner nie leer sein konnte.
  assert.ok(src.includes('cargo.length > 0 && /* @__PURE__ */ React.createElement("button", { "aria-label": T.cargoDelete'),
    "die letzte Position laesst sich nicht loeschen");
});

test("eine Funktion im Zustand wird verpackt", () => {
  // Genau hier ist beim Bauen eine Stunde verlorengegangen: setToastAct(fn) liest React
  // als UPDATER und RUFT fn(bisherigerZustand) AUF, statt fn zu speichern. Das Loeschen
  // machte sich dadurch sofort selbst rueckgaengig — ohne eine einzige Fehlermeldung.
  assert.ok(src.includes("setToastAct(() => akt || null)"),
    "setToastAct bekommt die Funktion wieder direkt — React ruft sie dann auf, statt sie zu merken");
});

test("beide Sprachen kennen die neuen Texte", () => {
  for (const k of ["cargoReset", "cargoResetTitle", "cargoDelete", "cargoEmpty", "cargoEmptyHint",
                   "undoBtn", "undone", "cargoCleared", "itemDeleted", "draftBack", "noCargo"]) {
    const n = src.split(k + ":").length - 1;
    assert.strictEqual(n, 2, `${k}: ${n} Eintraege statt je einem in DE und EN`);
  }
});

test("die Datenschutzseite kennt den Entwurf", () => {
  // Die Seite zaehlt namentlich auf, was lokal gespeichert wird. Kommt ein Schluessel
  // dazu und die Seite schweigt, behauptet sie etwas, was nicht mehr stimmt — bei einem
  // Werkzeug, dessen ganzer Wert auf Nachpruefbarkeit beruht, ist das kein Formalismus.
  const dsg = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.match(dsg, /automatisch im Speicher deines Browsers behalten/,
    "der Entwurf wird gespeichert, steht aber nicht in der Datenschutzerklaerung");
  assert.match(dsg, /localStorage/, "die Speicherart wird nicht benannt");
  // Und der Weg, es wieder loszuwerden, muss dort auch stehen.
  assert.match(dsg, /„Leeren“|Leeren/, "der Weg zum Entfernen fehlt");
});

// ── "Leeren" ist ein Knopf, und er raeumt wirklich auf ─────────────────────────
//
// Gemeldet: "mir fehlt der Button, mit dem ich die Ladung zuruecksetze." Es gab ihn --
// im Kopf der Ladungsliste, als reines Wort in der leisesten Knopf-Variante zwischen
// einer Trennlinie und dem cm/mm-Umschalter. Er las sich wie eine Beschriftung.
//
// Und er raeumte nicht alles weg: die manuell gesetzten Folgecontainer blieben stehen.
// Wer C2 fuer eine alte Ladung auf einen 20-Fuesser gestellt, dann geleert und etwas
// ganz anderes eingetippt hat, bekam den 20-Fuesser wieder vorgesetzt.

const schnitt = (von, bis) => {
  const a = src.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = src.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return src.slice(a, b);
};

test("Leeren traegt ein Symbol und ist damit als Knopf erkennbar", () => {
  const knopf = schnitt("onClick: resetCargo", "T.cargoReset) : null");
  assert.match(knopf, /React\.createElement\("svg"/, "der Knopf ist wieder ein blosses Wort");
  // Dieselbe Linienstaerke und Groesse wie jedes andere Symbol im Rechner.
  assert.match(knopf, /strokeWidth: ICO\.sw/, "eigene Linienstaerke statt ICO.sw");
  assert.match(knopf, /width: ICO\.s, height: ICO\.s/, "eigene Symbolgroesse statt ICO.s");
});

test("Leeren verwirft auch die manuell gesetzten Folgecontainer", () => {
  const fn = schnitt("const resetCargo = () =>", "const enableAllRotate");
  assert.match(fn, /setCargo\(\[\]\)/, "die Ladung wird gar nicht geleert");
  assert.match(fn, /setChainOverride\(\{\}\)/,
    "die Slot-Wahl der alten Ladung bleibt stehen — die naechste Ladung zeigt fremde Container");
  assert.match(fn, /sag\(T\.cargoCleared\(n2\), undo\)/, "ohne Rueckgaengig im Hinweis fragt der Knopf auch nicht nach");
});

test("Rueckgaengig holt die Ladung UND die Slot-Wahl zurueck", () => {
  // Sonst waere das Zuruecknehmen unvollstaendig: die Ladung staende wieder da, die
  // Container darunter aber auf "Auto".
  const merk = schnitt("const merk = (cs) =>", "const undo = () =>");
  assert.match(merk, /ov: chainOverride/, "der Stapel merkt sich die Slot-Wahl nicht mit");
  const undo = schnitt("const undo = () => {", "// Ein Hinweis, der etwas anbieten kann");
  assert.match(undo, /setCargo\(v\.cargo\)/, "die Ladung wird nicht zurueckgeholt");
  assert.match(undo, /setChainOverride\(v\.ov \|\| \{\}\)/, "die Slot-Wahl wird nicht zurueckgeholt");
});

test("beide Sprachen beschriften den Knopf", () => {
  for (const key of ["cargoReset", "cargoResetTitle"]) {
    const treffer = [...src.matchAll(new RegExp(`${key}: "`, "g"))];
    assert.strictEqual(treffer.length, 2, `${key} steht ${treffer.length}× da statt zweimal (DE und EN)`);
  }
});
