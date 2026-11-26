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

// Das VGM-Blatt ist ein PDF mit den Standardschriften (WinAnsi) -- die kennen keine chinesischen
// Schriftzeichen. Eine Sprache darf deshalb Dokumente mitbringen und das Blatt auslassen: dann
// bleibt es Englisch und steht im Formular nicht in dieser Sprache zur Wahl.
const OHNE_VGM_BLATT = ["zh"];
const teileVon = (k) => TEILE.filter((t) => !(t === "vgmpdf" && OHNE_VGM_BLATT.includes(k)));

test("Spanisch, Franzoesisch, Niederlaendisch und Chinesisch bringen ihre Dokumente mit -- Chinesisch ohne das VGM-Blatt", () => {
  assert.deepStrictEqual(MIT, ["es", "fr", "nl", "zh"]);
  for (const k of MIT) assert.strictEqual("vgmpdf" in dok(k), !OHNE_VGM_BLATT.includes(k), `${k}: VGM-Blatt`);
  // Was das Blatt nicht in der Sprache hat, bietet das Formular auch nicht an
  const { vgmSpGibt, vgmTexte, DOK_MEHR, VGM_TXT } = new Function(HELFER + app.slice(app.indexOf("  var VGM_TXT = {"), app.indexOf("  var VGM_JE_SEITE")) + "\nreturn { vgmSpGibt, vgmTexte, DOK_MEHR, VGM_TXT };")();
  DOK_MEHR.zh = dok("zh"); DOK_MEHR.es = dok("es");
  assert.strictEqual(vgmSpGibt("zh"), false, "das Formular boete ein chinesisches Blatt an, das es nicht gibt");
  assert.strictEqual(vgmSpGibt("es"), true);
  assert.strictEqual(vgmTexte("zh").titel, VGM_TXT.en.titel, "ohne eigenes Blatt muss es Englisch sein");
  assert.strictEqual(vgmTexte("es").titel, "Declaración VGM");
});

for (const k of MIT) {
  const D = dok(k);

  test(`${k}: dieselben Bausteine, dieselben Schluessel, dieselbe Art wie im Englischen`, () => {
    assert.deepStrictEqual(Object.keys(D).sort(), [...teileVon(k), "loc"].sort(), `${k}: andere Bausteine`);
    assert.doesNotThrow(() => new Intl.NumberFormat(D.loc), `${k}: "${D.loc}" ist kein Zahlenformat`);
    assert.ok(D.loc.startsWith(k + "-"));
    for (const t of teileVon(k)) {
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
    for (const t of teileVon(k)) {
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
          // Kein deutscher Rest. Niederlaendisch schreibt "gewicht" wie das Deutsche -- dort
          // stehen dafuer Woerter in der Liste, die es nur im Deutschen gibt.
          const REST = k === "nl"
            ? /\b(Ladung|Stirnwand|Tür|Zuladung|Seite|Position|stapelbar|Container-Tara|unverbindlich|Vorschlag|Packstück\w*|Schwerpunkt|Höhe|Breite)\b/i
            : /\b(Ladung|Stirnwand|Tür|Gewicht|Seite|Position|stapelbar|Container-Tara|unverbindlich|Vorschlag)\b/i;
          assert.doesNotMatch(b, REST, `${wo}: deutscher Rest — "${b}"`);
        }
      }
    }
  });

  test(`${k}: die Ehrlichkeitslinie steht auch hier -- unverbindlich, kein VGM, keine Pruefung`, () => {
    const p = teil(D, "page"), v = teil(D, "vgm"), q = teil(D, "quittung");
    const SATZ = {
      es: { unverb: /no vinculante/i, amtlich: /No es un documento oficial/, keinVgm: /^No es una VGM\./, richtwert: /VALOR ORIENTATIVO/, quittung: /^Solo confirma la carga/, gefahr: /no hay comprobación de mercancías peligrosas/ },
      fr: { unverb: /sans engagement/i, amtlich: /pas un document officiel/, keinVgm: /^Ce n’est pas une VGM\./, richtwert: /VALEUR INDICATIVE/, quittung: /^Atteste uniquement le chargement/, gefahr: /aucun contrôle des marchandises dangereuses/ },
      nl: { unverb: /vrijblijvend/i, amtlich: /Geen officieel document/, keinVgm: /^Geen VGM\./, richtwert: /RICHTWAARDE/, quittung: /^Bevestigt alleen de belading/, gefahr: /geen controle op gevaarlijke stoffen/ },
      zh: { unverb: /非约束性/, amtlich: /不是正式单证/, keinVgm: /^这不是 VGM。/, richtwert: /参考值/, quittung: /^仅确认已按本方案装载/, gefahr: /不作危险品核查/ }
    }[k];
    assert.ok(SATZ, `${k}: fuer diese Sprache steht die Ehrlichkeitslinie noch nicht im Test`);
    assert.match(p.h1 + p.discK + p.footer, SATZ.unverb, "das Dokument nennt sich nicht mehr unverbindlich");
    assert.match(p.discBody, SATZ.amtlich);
    assert.match(v.sub, SATZ.keinVgm, "die VGM-Vorbereitung gibt sich als VGM aus");
    assert.match(v.sub, /SOLAS VI\/2/);
    assert.match(v.titel, SATZ.richtwert);
    assert.match(q.sub, SATZ.quittung, "die Quittung bestaetigt mehr als das Laden");
    assert.match(teil(D, "bau").gefahr, SATZ.gefahr);
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

// ── Die Sprachwahl im Dokument-Fenster ────────────────────────────────────────────────
// Ein Dokument geht an Dritte. Der Kunde eines spanischen Verladers liest nicht unbedingt
// Spanisch -- und der eines deutschen nicht unbedingt Deutsch. Seit die Dokumente die Sprache
// der Oberflaeche sprechen, braucht es deshalb den Weg zurueck zum Englischen, ohne den ganzen
// Rechner umzustellen: ein Umschalter in der Leiste des Dokument-Fensters.
const WAHL = (() => { const a = L.findIndex((l) => l.includes("var dokWahl = () => {")); const e = L.findIndex((l, i) => i > a && l === "  };"); assert.ok(a > 0 && e > a, "dokWahl nicht gefunden"); return L.slice(a, e + 1).join("\n"); })();
const DOC = (() => { const a = L.findIndex((l) => l.includes("var LV_DOC = (pageHTML, lang, wahl) => {")); const e = L.findIndex((l, i) => i > a && l === "  };"); assert.ok(a > 0 && e > a, "LV_DOC nicht gefunden"); return L.slice(a, e + 1).join("\n"); })();
const LISTE = [["de", "Deutsch"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["zh", "中文"]];

test("zur Wahl stehen die Sprache der Oberflaeche und Englisch -- wenn es zwei verschiedene sind", () => {
  const wahl = (LANG, mehr) => new Function("LANG", "SPRACH_LISTE", HELFER + WAHL + "\nObject.assign(DOK_MEHR, " + JSON.stringify(mehr || {}) + ");\nreturn dokWahl();")(LANG, LISTE);
  assert.deepStrictEqual(wahl("de"), [["de", "Deutsch"], ["en", "English"]], "auch der deutsche Verlader hat auslaendische Kunden");
  assert.deepStrictEqual(wahl("es", { es: {} }), [["es", "Español"], ["en", "English"]]);
  assert.deepStrictEqual(wahl("fr", { fr: {} }), [["fr", "Français"], ["en", "English"]]);
  assert.deepStrictEqual(wahl("en"), [], "Englisch allein ist keine Wahl");
  assert.deepStrictEqual(wahl("zh"), [], "ohne eigene Dokumente gibt es nur Englisch");
  assert.deepStrictEqual(wahl("es"), [], "die Sprachdatei kam nicht an -- dann gibt es das Dokument nur englisch");
});

test("der Umschalter steht in der Leiste, druckt nicht mit und ruft den Rechner zurueck", () => {
  const { LV_DOC } = new Function("escHTML", HELFER + DOC + "\nreturn { LV_DOC };")((t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]));
  const mit = LV_DOC("<div class='page'></div>", "de", [["de", "Deutsch"], ["en", "English"]]);
  assert.ok(mit.includes('<button class="cl-spk on" aria-pressed="true">Deutsch</button>'), "die aktive Sprache ist nicht markiert");
  assert.ok(mit.includes(`<button class="cl-spk" aria-pressed="false" onclick="try{window.opener.__clLadevorschlag(window,'en')}catch(e){}">English</button>`), "der andere Knopf ruft den Rechner nicht");
  assert.strictEqual((mit.match(/__clLadevorschlag\(/g) || []).length, 1, "der aktive Knopf darf nichts ausloesen");
  // in der Leiste, und die Leiste verschwindet im Druck
  assert.match(mit, /<div class="cl-tb">.*<span class="cl-sp" role="group">.*<\/span>.*<\/div>/s);
  assert.ok(mit.includes("@media print{.cl-tb{display:none!important}"));
  // andersherum
  const en = LV_DOC("", "en", [["de", "Deutsch"], ["en", "English"]]);
  assert.ok(en.includes('<html lang="en">') && en.includes('<button class="cl-spk on" aria-pressed="true">English</button>') && en.includes("__clLadevorschlag(window,'de')"));
  // ohne Wahl kein Umschalter
  for (const ohne of [LV_DOC("", "en", []), LV_DOC("", "en"), LV_DOC("", "de", [["de", "Deutsch"]])]) assert.ok(!ohne.includes('class="cl-sp"') && !ohne.includes("__clLadevorschlag("));
  // Ein Kuerzel, das keines ist, kommt nicht in den Aufruf
  const boese = LV_DOC("", "de", [["de", "Deutsch"], ["x');alert(1);('", "<b>"]]);
  assert.ok(!boese.includes("alert(1)") && !boese.includes("<b>"), "ein fremdes Kuerzel landet im onclick");
});

test("der Rechner baut dasselbe Blatt in der gewaehlten Sprache ins selbe Fenster -- und nur dann", () => {
  const bau = app.slice(app.indexOf("    const buildLadevorschlag = (dokSprache, fenster) => {"), app.indexOf("    // Am Schreibtisch ist der Rahmen genau ein Fenster hoch"));
  assert.ok(bau.length > 5000, "der Zusammenbau wurde nicht gefunden");
  // Der gewoehnliche Aufruf bekommt ein Klick-Ereignis: nur eine Sprache aus dokWahl() plus ein Fenster zaehlt
  assert.ok(bau.includes('const wechsel = typeof dokSprache === "string" && !!(fenster && fenster.document) && dokWahl().some(([k]) => k === dokSprache);'));
  // Die Sprache gilt fuer diesen einen Bau und wird IMMER zurueckgesetzt (auch nach return und Fehler)
  assert.ok(bau.includes("const dokVorher = DOKLANG;") && bau.includes("if (wechsel) DOKLANG = dokSprache;"));
  assert.match(bau, /\} finally \{\n\s*DOKLANG = dokVorher;\n\s*\}\n\s*\};\n$/, "DOKLANG wird nach dem Bau nicht zurueckgesetzt -- die naechsten Dokumente kaemen in der falschen Sprache");
  // selbes Fenster, selbe Referenz, und der Wechsel zaehlt nicht als weiterer Ladevorschlag
  assert.ok(bau.includes('const w = wechsel ? fenster : window.open("", "_blank");'));
  assert.ok(bau.includes("const ref = wechsel && LV_LETZTE_REF ? LV_LETZTE_REF : `CL-") && bau.includes("LV_LETZTE_REF = ref;"));
  assert.match(bau, /if \(!wechsel\) \{\n\s*zaehl\("ladevorschlag"\);/);
  assert.ok(bau.includes("w.document.write(LV_DOC(pageHTML, DOKLANG, dokWahl()));"));
  assert.ok(bau.includes("window.__clLadevorschlag = (f, k) => buildLadevorschlag(k, f);"));
  // Die editierbaren Felder des Blatts liest dabei niemand aus (sie verlassen das Blatt nie)
  assert.doesNotMatch(bau, /cl-edit/);
});
