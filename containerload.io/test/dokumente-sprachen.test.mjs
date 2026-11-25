// Die DOKUMENTE in weiteren Sprachen (Ladevorschlag mit Stauplan, Reihenfolgen, Gewicht,
// VGM-Vorbereitung, Quittung).
//
// Jarek, 25.11.26: "Wir muessen wirklich alles uebersetzen dann auf die jeweiligen Sprachen."
// Bis dahin gab es Dokumente auf Deutsch und Englisch; ein spanischer Verlader bekam einen
// englischen Ladevorschlag. Jetzt bringt die Sprachdatei die Texte mit ("dok"), und sie liegen
// UEBER dem englischen Woerterbuch jedes Bausteins (dokMit) -- fehlt ein Text, steht dort
// Englisch statt nichts.
//
// Der Test liest die Woerterbuecher der Bausteine aus app.html SELBST (das englische und das
// deutsche jedes dokMit-Aufrufs), statt eine Schluesselliste abzuschreiben, und vergleicht
// jede Sprachdatei damit: dieselben Schluessel, dieselbe Art, dieselben Zahlen im Satz.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wurzel = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(wurzel, "app.html"), "utf8");
const L = app.split("\n");

// ── Die Woerterbuecher der Bausteine, aus dem Quelltext ───────────────────────────────
const strEnde = (s, p) => { const q = s[p]; for (let i = p + 1; i < s.length; i++) { if (s[i] === "\\") i++; else if (s[i] === q) return i; } throw new Error("Zeichenkette ohne Ende"); };
const tplEnde = (s, p) => { for (let i = p + 1; i < s.length; i++) { if (s[i] === "\\") i++; else if (s[i] === "`") return i; else if (s[i] === "$" && s[i + 1] === "{") i = objEnde(s, i + 1) - 1; } throw new Error("Vorlage ohne Ende"); };
function objEnde(s, p) {          // s[p] === "{"  ->  Stelle NACH der schliessenden Klammer
  let tiefe = 0;
  for (let i = p; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'") i = strEnde(s, i);
    else if (c === "`") i = tplEnde(s, i);
    else if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (!tiefe) return i + 1; }
  }
  throw new Error("Objekt ohne Ende");
}
// Freie Namen in den Woerterbuechern (COLLI, kg, typ ...) bekommen Probewerte -- je Name eine
// andere Zahl, damit sich pruefen laesst, ob sie im uebersetzten Satz wieder auftaucht.
const PROBE = { COLLI: 11, VOLPCT: 22, WTPCT: 33, POSCOUNT: 44, kg: 5555, x: 321, pct: 54, vornPct: 46, loc: "en-US", hatTara: true, typ: "40' HC" };
const werte = (quelle) => new Function("P", "with (P) { return (" + quelle + "); }")(new Proxy({}, {
  has: (t, k) => typeof k === "string" && !(k in globalThis),
  get: (t, k) => { if (k === Symbol.unscopables) return undefined; assert.ok(k in PROBE, `unbekannter Name im Woerterbuch: ${String(k)}`); return PROBE[k]; }
}));
const BAUSTEINE = {};
for (const m of app.matchAll(/dokMit\(([A-Za-z.]+), "([a-z]+)", /g)) {
  // Das VGM-Blatt haelt seine beiden Woerterbuecher in VGM_TXT (weiter unten gelesen)
  if (m[2] === "vgmpdf") { assert.ok(app.startsWith('dokMit(sp, "vgmpdf", Object.assign({}, VGM_TXT.en))', m.index)); continue; }
  const a = app.indexOf("? {", m.index) + 2;
  assert.ok(a > m.index && a - m.index < 120, `${m[2]}: das englische Woerterbuch steht nicht direkt hinter dokMit(`);
  const aEnde = objEnde(app, a);
  const zwischen = app.slice(aEnde, aEnde + 40);
  const d = aEnde + zwischen.indexOf("{");
  assert.match(zwischen, /^\s*:\s*\{/, `${m[2]}: nach dem englischen Woerterbuch folgt nicht das deutsche`);
  const dEnde = objEnde(app, d);
  const rest = app.slice(dEnde, dEnde + 4);
  let w = null;
  if (rest.startsWith(", {")) w = app.slice(dEnde + 2, objEnde(app, dEnde + 2));
  else assert.ok(rest.startsWith(")"), `${m[2]}: unerwartetes Ende des dokMit-Aufrufs: ${rest}`);
  BAUSTEINE[m[2]] = { en: werte(app.slice(a, aEnde)), de: werte(app.slice(d, dEnde)), werte: w ? werte(w) : {}, sprache: m[1] };
}
{
  const a = app.indexOf("{", app.indexOf("  var VGM_TXT = {"));
  const beide = werte(app.slice(a, objEnde(app, a)));
  BAUSTEINE.vgmpdf = { en: beide.en, de: beide.de, werte: {}, sprache: "sp" };
}
const TEILE = Object.keys(BAUSTEINE).sort();

// ── Die Sprachdateien ─────────────────────────────────────────────────────────────────
const React = { Fragment: "F", createElement: (typ, props, ...kinder) => ({ typ, props, kinder }) };
const fmtDE = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const helfer = { React, C: new Proxy({}, { get: () => "#000000" }), fmtDE, plu: (n, a, b) => fmtDE(n) + " " + (Math.abs(Number(n)) === 1 ? a : b), loc: () => "en-US" };
const dateien = fs.readdirSync(path.join(wurzel, "sprache")).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
const dok = (k) => { const win = {}; new Function("window", fs.readFileSync(path.join(wurzel, "sprache", k + ".js"), "utf8"))(win); return win.CL_SPRACHE[k].texte(helfer).dok; };
const MIT = dateien.filter((k) => dok(k));
const teil = (D, t) => (typeof D[t] === "function" ? D[t](BAUSTEINE[t].werte) : D[t]);
const art = (v) => (Array.isArray(v) ? "liste" : typeof v);
const zahlen = (s) => [...new Set(String(s).replace(/&[a-z]+;/g, " ").match(/\d+(?:[.,]\d+)*/g) || [])];

test("jeder Baustein des Ladevorschlags laeuft ueber dokMit -- und Deutsch und Englisch tragen dieselben Schluessel", () => {
  // Ladevorschlag (zehn Bausteine + Zusammenbau), Bild-Export, VGM-Blatt
  assert.deepStrictEqual(TEILE, ["bau", "bild", "doc", "gewicht", "page", "quittung", "row", "sequenz", "stau", "stopps", "uebersicht", "vgm", "vgmpdf"]);
  for (const t of TEILE) {
    const { en, de } = BAUSTEINE[t];
    assert.deepStrictEqual(Object.keys(de).sort(), Object.keys(en).sort(), `${t}: Deutsch und Englisch haben verschiedene Schluessel`);
    for (const k of Object.keys(en)) assert.strictEqual(art(de[k]), art(en[k]), `${t}.${k}`);
  }
  // Kein Baustein fragt mehr selbst nach "en": jede weitere Sprache bekaeme dort Deutsch.
  const bausteine = app.slice(app.indexOf("  var LV_ROW = "), app.indexOf("  var QIMPORT = "));
  assert.ok(bausteine.length > 20000);
  assert.doesNotMatch(bausteine, /lang === "en"|LANG === "en"/, "ein Baustein fragt wieder nach Englisch statt nach 'nicht Deutsch'");
  assert.doesNotMatch(app, /DOKLANG === "en"/, "jemand fragt nach DOKLANG === \"en\" -- mit DOKLANG \"es\" waere das Deutsch");
  assert.strictEqual((bausteine.match(/en \? "en-US" : "de-DE"/g) || []).length, 0, "das Zahlenformat kommt nicht aus dokLoc");
});

test("Spanisch und Franzoesisch bringen den Ladevorschlag mit, Chinesisch bewusst nicht", () => {
  assert.deepStrictEqual(MIT, ["es", "fr"]);
  assert.strictEqual(dok("zh"), null, "Chinesisch: die Standardschriften des VGM-PDF kennen keine Schriftzeichen -- Dokumente bleiben Englisch");
});

for (const k of MIT) {
  const D = dok(k);

  test(`${k}: dieselben Bausteine, dieselben Schluessel, dieselbe Art wie im Englischen`, () => {
    assert.deepStrictEqual(Object.keys(D).sort(), [...TEILE, "loc"].sort(), `${k}: andere Bausteine`);
    assert.doesNotThrow(() => new Intl.NumberFormat(D.loc), `${k}: "${D.loc}" ist kein Zahlenformat`);
    assert.ok(D.loc.startsWith(k + "-"));
    for (const t of TEILE) {
      const en = BAUSTEINE[t].en, o = teil(D, t);
      // Funktion genau dort, wo Zahlen aus der Rechnung im Satz stehen
      assert.strictEqual(typeof D[t] === "function", Object.keys(BAUSTEINE[t].werte).length > 0, `${k}.${t}: Funktion/Objekt passt nicht zu den Werten des Bausteins`);
      assert.deepStrictEqual(Object.keys(o).sort(), Object.keys(en).sort(), `${k}.${t}: Schluessel weichen vom Englischen ab`);
      for (const key of Object.keys(en)) {
        assert.strictEqual(art(o[key]), art(en[key]), `${k}.${t}.${key}: ${art(o[key])} statt ${art(en[key])}`);
        if (art(en[key]) === "liste") assert.strictEqual(o[key].length, en[key].length, `${k}.${t}.${key}: andere Zahl von Eintraegen`);
      }
    }
  });

  test(`${k}: jeder Text steht da, traegt die Zahlen des englischen und ist HTML-fest`, () => {
    for (const t of TEILE) {
      const en = BAUSTEINE[t].en, o = teil(D, t);
      for (const key of Object.keys(en)) {
        const paare = art(en[key]) === "liste" ? en[key].map((x, i) => [x, o[key][i]])
          : typeof en[key] === "function" ? [[en[key](3, 8), o[key](3, 8)], [en[key](1, 1), o[key](1, 1)]]
          : [[en[key], o[key]]];
        for (const [a, b] of paare) {
          const wo = `${k}.${t}.${key}`;
          assert.strictEqual(typeof b, "string", wo);
          assert.ok(b.trim().length > 0 && !/undefined|NaN|\[object/.test(b), `${wo} → "${b}"`);
          // Zahlen: Mengen, Prozente, "Methode 1", "3D" -- was im Englischen steht, steht auch hier
          for (const z of zahlen(a)) assert.ok(zahlen(b).some((y) => y.replace(/[.,\s  ]/g, "") === z.replace(/[.,]/g, "")), `${wo}: die Zahl ${z} fehlt — "${b}"`);
          // Die Texte gehen roh ins HTML des Dokuments
          assert.doesNotMatch(b.replace(/<br>|<\/?b>/g, ""), /[<>]/, `${wo}: ein Tag, das im Englischen nicht steht`);
          assert.doesNotMatch(b, /&(?![a-z]+;|#\d+;)/, `${wo}: ein rohes & (als &amp; schreiben)`);
          assert.strictEqual((b.match(/<br>/g) || []).length, (a.match(/<br>/g) || []).length, `${wo}: andere Zeilenumbrueche`);
          assert.strictEqual((b.match(/<b>/g) || []).length, (a.match(/<b>/g) || []).length, `${wo}: andere Hervorhebungen`);
          // Kein deutscher Rest
          assert.doesNotMatch(b, /\b(Ladung|Stirnwand|Tür|Gewicht|Seite|Position|stapelbar|Container-Tara|unverbindlich|Vorschlag)\b/i, `${wo}: deutscher Rest — "${b}"`);
        }
      }
    }
  });

  test(`${k}: die Ehrlichkeitslinie steht auch hier -- unverbindlich, kein VGM, keine Pruefung`, () => {
    const p = teil(D, "page"), v = teil(D, "vgm"), q = teil(D, "quittung");
    const unverb = k === "es" ? /no vinculante/i : /sans engagement/i;
    assert.match(p.h1 + p.discK + p.footer, unverb, "das Dokument nennt sich nicht mehr unverbindlich");
    assert.match(p.discBody, k === "es" ? /No es un documento oficial/ : /pas un document officiel/);
    assert.match(v.sub, k === "es" ? /^No es una VGM\./ : /^Ce n’est pas une VGM\./, "die VGM-Vorbereitung gibt sich als VGM aus");
    assert.match(v.sub, /SOLAS VI\/2/);
    assert.match(v.titel, k === "es" ? /VALOR ORIENTATIVO/ : /VALEUR INDICATIVE/);
    assert.match(q.sub, k === "es" ? /^Solo confirma la carga/ : /^Atteste uniquement le chargement/, "die Quittung bestaetigt mehr als das Laden");
    assert.match(teil(D, "bau").gefahr, k === "es" ? /no hay comprobación de mercancías peligrosas/ : /aucun contrôle des marchandises dangereuses/);
  });
}

// ── Das Zusammenspiel im Rechner ──────────────────────────────────────────────────────
const HELFER = (() => { const a = L.findIndex((l) => l.includes("var DOK_MEHR = {};")); const e = L.findIndex((l, i) => i > a && l === "  };"); return L.slice(a, e + 1).join("\n") + "\n"; })();
const QUITTUNG = (() => { const a = L.findIndex((l) => l.includes("var LV_QUITTUNG = (lang)")); const e = L.findIndex((l, i) => i > a && l === "  };"); return L.slice(a, e + 1).join("\n"); })();

test("die Sprachdatei liegt UEBER dem englischen Woerterbuch -- fehlt ein Text, steht dort Englisch", () => {
  const { LV_QUITTUNG, DOK_MEHR, dokLoc } = new Function(HELFER + QUITTUNG + "\nreturn { LV_QUITTUNG, DOK_MEHR, dokLoc };")();
  assert.ok(LV_QUITTUNG("de").includes("Geladen von (Name)"));
  assert.ok(LV_QUITTUNG("en").includes("Loaded by (name)"));
  // Ohne angemeldete Sprache: Englisch, nie Deutsch
  assert.ok(LV_QUITTUNG("es").includes("Loaded by (name)"), "eine Sprache ohne Dokument-Texte bekommt Deutsch");
  assert.strictEqual(dokLoc("es"), "en-US");
  DOK_MEHR.es = dok("es");
  const es = LV_QUITTUNG("es");
  assert.ok(es.includes("Cargado por (nombre)") && es.includes("Firma") && !es.includes("Loaded by"), es.slice(0, 200));
  assert.strictEqual(dokLoc("es"), "es-ES");
  assert.strictEqual(dokLoc("de"), "de-DE");
  // Deutsch und Englisch bleiben, was sie sind
  assert.ok(LV_QUITTUNG("de").includes("Geladen von (Name)") && LV_QUITTUNG("en").includes("Loaded by (name)"));
  // Eine Datei, der ein Text fehlt
  DOK_MEHR.fr = { quittung: { wer: "Chargé par (nom)" } };
  const fr = LV_QUITTUNG("fr");
  assert.ok(fr.includes("Chargé par (nom)") && fr.includes("Signature") && fr.includes("Date / time"), "fehlender Text faellt nicht auf Englisch zurueck");
});

test("die Dokument-Sprache folgt der Oberflaeche, wenn die Sprachdatei Dokumente mitbringt", () => {
  assert.ok(app.includes('var DOKLANG = LANG === "de" ? "de" : "en";'), "die Vorgabe: Deutsch oder Englisch");
  assert.ok(app.includes("if (SPRACHE_MEHR[LANG] && I18N[LANG].dok) { DOK_MEHR[LANG] = I18N[LANG].dok; DOKLANG = LANG; }"), "die Sprachdatei meldet ihre Dokument-Texte nicht an");
  // ... und zwar NACH dem Zusammenbau des Woerterbuchs und VOR dem ersten Baustein
  const an = app.indexOf("DOK_MEHR[LANG] = I18N[LANG].dok");
  assert.ok(an > app.indexOf("I18N[LANG] = Object.assign({}, I18N.en, SPRACHE_MEHR[LANG].texte(") && an < app.indexOf("  var LV_ROW = "));
  assert.ok(app.indexOf("  var DOK_MEHR = {};") < an, "DOK_MEHR wird benutzt, bevor es angelegt ist");
  // Deutsch und Englisch tragen kein "dok": ihre Texte stehen in den Bausteinen
  assert.strictEqual((app.match(/\n      dok: null,\n/g) || []).length, 2);
  // Der Stauplan bekommt auf BEIDEN Blattsorten die Sprache des Dokuments. Auf den Blaettern je
  // Container stand dort "LANG" -- die Sprache der Oberflaeche: im spanischen Rechner trug das
  // englische Dokument deutsche Beschriftungen im Stauplan.
  assert.ok(app.includes("legend, LANG: DOKLANG,") && app.includes("LANG: DOKLANG, chainLen: 1 })"));
  assert.doesNotMatch(app, /\n\s+LANG, chainLen: 1 \}\)/);
  // Was noch keine weiteren Sprachen kann, bekommt fuer alles ausser Deutsch Englisch
  // Das VGM-Blatt: vorbelegt mit der Sprache des Dokuments, wenn es das Blatt in ihr gibt
  assert.ok(app.includes('sp: vgmSpGibt(DOKLANG) ? DOKLANG : "en" };'), "die VGM-Erklaerung ist nicht mit der Dokument-Sprache vorbelegt");
  assert.ok(app.includes("sp: vgmSpGibt(d.sp) ? d.sp : leer.sp } : leer;"), "eine gemerkte Sprache, die es nicht (mehr) gibt, wird nicht ersetzt");
  assert.ok(app.includes("const X = vgmTexte(d.sprache), en = d.sprache !== \"de\";"));
  assert.ok(app.includes('React.createElement(Seg, { items: vgmSprachen, value: vgmAbs.sp,'), "die Sprachwahl des VGM-Blatts zeigt nicht die Liste vgmSprachen");
});
