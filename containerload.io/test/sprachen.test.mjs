// Die Sprachfabrik: Deutsch und Englisch traegt app.html selbst, jede weitere Sprache ist EINE
// Datei sprache/<kuerzel>.js und EIN Eintrag in CL_SPRACHEN im Kopf von app.html.
//
// Was hier festgehalten wird:
//   * Register und Dateien passen zusammen (kein Eintrag ohne Datei, keine Datei ohne Eintrag),
//     und der Server kennt jede Sprache (sonst verwirft die Nutzungsstatistik ihre Aufrufe).
//   * Jede Sprachdatei traegt GENAU die Schluessel des englischen Woerterbuchs -- auch in den
//     verschachtelten Eintraegen --, und was dort eine Funktion ist, ist auch hier eine.
//   * Jede Funktion laeuft mit denselben Probe-Eingaben wie die englische und liefert dieselbe
//     ART Ergebnis (Text oder React-Element). Platzhalter wie {V} bleiben erhalten.
//   * Fehlt einer Sprachdatei ein Schluessel, steht dort Englisch statt nichts.
//   * Dokumente gibt es auf Deutsch und Englisch: jede weitere Sprache bekommt ENGLISCHE.
//   * Im Rechner steht keine Zwei-Sprachen-Weiche mehr im Markup (LANG === "en" ? … : …).
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const roh = fs.readFileSync(path.join(wurzel, "app.html"), "utf8");
const zwischen = (a, b) => {
  const i = roh.indexOf(a), j = roh.indexOf(b, i + 1);
  assert.ok(i > 0 && j > i, `Ausschnitt ${a} … ${b} nicht gefunden`);
  return roh.slice(i, j);
};

// Ein React, das nur merkt, was gebaut wurde
const React = { Fragment: "F", createElement: (typ, props, ...kinder) => ({ typ, props, kinder }) };
const C = new Proxy({}, { get: () => "#000000" });
const fmtDE = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
const plu = (n, eins, viele) => fmtDE(n) + " " + (Math.abs(Number(n)) === 1 ? eins : viele);

// Die beiden Woerterbuecher des Rechners, so wie er sie selbst baut
const I18N = new Function("React", "C", "plu", "fmtDE", zwischen("  var I18N = {", "  // Eine weitere Sprache liegt UEBER dem englischen") + "\nreturn I18N;")(React, C, plu, fmtDE);

// Register im Kopf von app.html
const register = new Function("window", /window\.CL_SPRACHEN = (\{[^\n]*\});/.exec(roh)[0] + "\nreturn window.CL_SPRACHEN;")({});
const dateien = fs.readdirSync(path.join(wurzel, "sprache")).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
const lade = (k) => {
  const win = {};
  new Function("window", fs.readFileSync(path.join(wurzel, "sprache", k + ".js"), "utf8"))(win);
  return win.CL_SPRACHE[k];
};
const helfer = { React, C, plu, fmtDE, loc: () => "en-US" };

test("Register und Dateien passen zusammen, und der Server kennt jede Sprache", () => {
  assert.deepStrictEqual(Object.keys(register).sort(), dateien, "CL_SPRACHEN in app.html und die Dateien in sprache/ stimmen nicht ueberein");
  assert.ok(dateien.length >= 1 && dateien.includes("es"));
  const nutzung = fs.readFileSync(path.join(wurzel, "..", "netlify", "functions", "lib", "nutzung.mjs"), "utf8");
  const serverKennt = new Function("return " + /const SPRACHEN = new Set\((\[[^\]]*\])\)/.exec(nutzung)[1])();
  for (const k of ["de", "en", ...dateien]) assert.ok(serverKennt.includes(k), `die Nutzungsstatistik verwirft Aufrufe in "${k}"`);
  // KI-Brief: was der Rechner zur Wahl stellt, nimmt der Server auch an -- und umgekehrt
  const ki = fs.readFileSync(path.join(wurzel, "..", "netlify", "functions", "lib", "ki.mjs"), "utf8");
  const briefServer = new Function("return " + /export const BRIEF_SPRACHEN = (\[[^\]]*\]);/.exec(ki)[1])();
  assert.deepStrictEqual(briefServer.slice().sort(), ["de", "en", ...dateien].sort(), "BRIEF_SPRACHEN auf dem Server und die Sprachen des Rechners weichen ab");
  assert.ok(roh.includes('var BRIEF_SPRACHEN_UI = SPRACH_LISTE.map(([k, n]) => [k, n]);'));
  assert.ok(!/Seg, \{[^}]*setBriefSprache/.test(roh), "die Brief-Sprachen stehen wieder als Knopfreihe da");
  for (const k of dateien) assert.ok(new RegExp(k + " = [A-Z]").test(/"Zielsprache ist fakten\.sprache: ([^"]*)"/.exec(ki)[1]), `der KI-Brief-Auftrag erklaert "${k}" nicht`);
  for (const k of dateien) {
    assert.match(k, /^[a-z]{2}$/);
    const [name, satz] = register[k];
    assert.ok(name && satz && name.length < 24, `${k}: Name und Menue-Satz fehlen im Register`);
    const S = lade(k);
    assert.strictEqual(S.name, name, `${k}: der Name in der Datei und im Register weichen ab`);
    assert.match(S.loc, /^[a-z]{2}-[A-Z]{2}$/, `${k}: kein Zahlenformat`);
    assert.ok(S.titel.includes("ContainerLoad") && S.laden.includes("ContainerLoad"));
    // hreflang im Kopf des Rechners
    assert.ok(roh.includes(`<link rel="alternate" hreflang="${k}" href="https://containerload.io/app?lang=${k}" />`), `${k}: hreflang fehlt im Kopf`);
    // ... und in der Sitemap: eigene Adresse, und in jedem /app-Block genannt
    const karte = fs.readFileSync(path.join(wurzel, "sitemap.xml"), "utf8");
    assert.ok(karte.includes(`<loc>https://containerload.io/app?lang=${k}</loc>`), `${k}: steht nicht in der Sitemap`);
    const bloecke = karte.split("<url>").filter((b) => /<loc>https:\/\/containerload\.io\/app(\?lang=[a-z]{2})?<\/loc>/.test(b));
    assert.strictEqual(bloecke.length, 2 + dateien.length, "je Sprache des Rechners genau ein Sitemap-Eintrag");
    for (const b of bloecke) assert.ok(b.includes(`hreflang="${k}" href="https://containerload.io/app?lang=${k}"`), `${k}: fehlt in einem /app-Block der Sitemap`);
  }
});

// Probe-Eingaben nach Parametername -- so laeuft jede Text-Funktion einmal wirklich
const probe = (name) => ({ r: { axis: "width", cm: 15 }, road: true, heck: true, frei: true, ok: true, m: 1.25, kg: 26500, pay: 26600, f: "wt", v: 2 })[name]
  ?? (/^(n|q|k|p2|pos|pcs|c2|cm|l|w|hh|h|kgs|me|pz)$/.test(name) ? 3 : "Xy");
const params = (fn) => { const m = /^\s*(?:function\s*)?\(?([^)=]*?)\)?\s*(?:=>|\{)/.exec(String(fn)); return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : []; };
const flach = (v) => v && typeof v === "object" && v.typ ? [v.typ, ...v.kinder.map(flach)].join("") : Array.isArray(v) ? v.map(flach).join("") : String(v == null ? "" : v);

test("jede Sprachdatei traegt genau die Schluessel des englischen Woerterbuchs", () => {
  for (const k of dateien) {
    const T = lade(k).texte(helfer), EN = I18N.en;
    assert.deepStrictEqual(Object.keys(T).sort(), Object.keys(EN).sort(), `${k}: Schluessel weichen vom Englischen ab`);
    for (const key of Object.keys(EN)) {
      // "dok" (die Dokument-Texte) traegt nur eine Sprachdatei -- im Englischen steht dort null,
      // die Texte selbst stehen in den Bausteinen. Verglichen wird in test/dokumente-sprachen.
      if (key === "dok") { assert.ok(T.dok === null || typeof T.dok === "object", `${k}.dok`); continue; }
      const a = EN[key], b = T[key];
      assert.strictEqual(typeof b, typeof a, `${k}.${key}: ${typeof b} statt ${typeof a}`);
      if (typeof a === "string") {
        assert.ok(b.trim().length > 0 || a.trim().length === 0, `${k}.${key} ist leer`);
        for (const platz of a.match(/\{[A-Z]\}/g) || []) assert.ok(b.includes(platz), `${k}.${key}: Platzhalter ${platz} fehlt`);
      } else if (typeof a === "object") {
        assert.deepStrictEqual(Object.keys(b).sort(), Object.keys(a).sort(), `${k}.${key}: innere Schluessel weichen ab`);
        for (const kk of Object.keys(a)) assert.strictEqual(typeof b[kk], typeof a[kk], `${k}.${key}.${kk}`);
      }
    }
  }
});

test("jede Text-Funktion laeuft und liefert dieselbe Art Ergebnis wie die englische", () => {
  for (const k of dateien) {
    const T = lade(k).texte(helfer), EN = I18N.en;
    const paare = [];
    for (const key of Object.keys(EN)) {
      if (key === "dok") continue;   // eigener Test: dokumente-sprachen
      if (typeof EN[key] === "function") paare.push([key, EN[key], T[key]]);
      else if (typeof EN[key] === "object") for (const kk of Object.keys(EN[key])) if (typeof EN[key][kk] === "function") paare.push([key + "." + kk, EN[key][kk], T[key][kk]]);
    }
    assert.ok(paare.length > 80, "zu wenige Funktionen gefunden -- stimmt der Ausschnitt noch?");
    for (const [key, fa, fb] of paare) {
      const args = params(fa).map(probe);
      for (const variante of [args, args.map((x) => (x === 3 ? 1 : x === true ? false : x))]) {
        const a = fa(...variante), b = fb(...variante);
        assert.strictEqual(typeof b, typeof a, `${k}.${key}: liefert ${typeof b} statt ${typeof a}`);
        const text = flach(b);
        assert.ok(text.length > 0 && !/undefined|NaN|\[object/.test(text), `${k}.${key}(${JSON.stringify(variante)}) → "${text}"`);
        // Was hineingeht, kommt auch heraus: Zahlen und Namen stehen im Satz
        for (const x of variante) if (typeof x === "string" && flach(a).includes(x)) assert.ok(text.includes(x), `${k}.${key}: "${x}" fehlt im Satz "${text}"`);
      }
    }
  }
});

test("fehlt ein Schluessel, steht dort Englisch -- und Dokumente bekommen nie die Oberflaechen-Sprache am Baustein vorbei", () => {
  const stelle = zwischen("  if (SPRACHE_MEHR[LANG]) I18N[LANG] = ", "  var T = I18N[LANG];");
  assert.match(stelle, /Object\.assign\(\{\}, I18N\.en, SPRACHE_MEHR\[LANG\]\.texte\(/, "die Sprache liegt nicht ueber dem englischen Woerterbuch");
  // nachgebaut mit einer Sprachdatei, der die Haelfte fehlt
  const halb = { texte: () => ({ cargo: "Carga" }) };
  const T = Object.assign({}, I18N.en, halb.texte(helfer));
  assert.strictEqual(T.cargo, "Carga");
  assert.strictEqual(T.shareBtn, "Share", "fehlender Schluessel faellt nicht auf Englisch zurueck");
  // Dokumente: DOKLANG ist Deutsch oder Englisch -- oder die Sprache der Oberflaeche, wenn
  // ihre Datei Dokument-Texte mitbringt (seit 25.11.26; test/dokumente-sprachen).
  assert.ok(roh.includes('var DOKLANG = LANG === "de" ? "de" : "en";'));
  assert.ok(roh.includes("if (SPRACHE_MEHR[LANG] && I18N[LANG].dok) { DOK_MEHR[LANG] = I18N[LANG].dok; DOKLANG = LANG; }"));
  for (const baustein of ["LV_ROW", "LV_SEQUENZ", "LV_STOPPS", "LV_GEWICHT", "LV_VGM", "LV_QUITTUNG", "LV_UEBERSICHT", "LV_DOC"]) {
    const aufrufe = [...roh.matchAll(new RegExp(baustein + "\\(([^;\\n]{0,160})", "g"))].map((m) => m[1]).filter((a) => !/^\s*(lang|pageHTML|it, i|placed|sp|its|rows|slotRows)[,)]\s*=>|=>\s*[`{]/.test(a) && /\bLANG\b|DOKLANG/.test(a));
    for (const a of aufrufe) assert.ok(!/(^|[^A-Z])LANG\b/.test(a.replace(/DOKLANG/g, "")), `${baustein}(…) bekommt die Oberflaechen-Sprache statt DOKLANG: ${a.slice(0, 80)}`);
  }
  assert.ok(roh.includes("legend, LANG: DOKLANG,"), "der Stauplan des Ladevorschlags bekommt nicht die Dokument-Sprache");
  assert.ok(roh.includes('sp: vgmSpGibt(DOKLANG) ? DOKLANG : "en" };'), "die VGM-Erklaerung ist nicht mit der Dokument-Sprache vorbelegt");
});

test("im Rechner steht keine Zwei-Sprachen-Weiche mehr", () => {
  // Erlaubt sind nur die Stellen, die wirklich nach DEUTSCH fragen (Adresse, Start-Link,
  // Tastenname, Zahlenformat) -- und die eine Titelzeile, die Englisch selbst traegt.
  const treffer = [...roh.matchAll(/[^\n]{0,60}\bLANG === "en"[^\n]{0,40}/g)].map((m) => m[0]).filter((z) => !z.includes("DOKLANG ===") && !z.includes("S.LANG ==="));   // S.LANG ist die Dokument-Sprache des Stauplans (oben geprueft)
  assert.strictEqual(treffer.length, 2, "neue LANG === \"en\"-Weiche: jede weitere Sprache bekaeme dort Deutsch\n" + treffer.join("\n"));
  assert.ok(treffer.some((z) => z.includes("document.title")) && treffer.some((z) => z.includes('return "en-US"')));
  // Die Auswahl in Kopfzeile und Menue kommt aus EINER Liste
  // Kopfzeile: ein Aufklapp-Menue (ein Knopf mit dem Kuerzel, darunter die Namen) -- keine Knopfreihe
  assert.ok(roh.includes('onClick: () => setSprachOpen((o) => !o)') && roh.includes('"aria-haspopup": "menu"'));
  assert.ok(roh.includes('SPRACH_LISTE.map(([k, n]) => /* @__PURE__ */ React.createElement("button", { key: k, role: "menuitemradio"'), "die Liste des Sprach-Menues kommt nicht aus SPRACH_LISTE");
  assert.ok(roh.includes("onClick: () => { setSprachOpen(false); if (k !== LANG) setLangTo(k); }"));
  assert.ok(!/Seg, \{[^}]*SPRACH_LISTE/.test(roh), "die Sprachen stehen wieder als Knopfreihe da");
  assert.ok(roh.includes("else if (sprachOpen) setSprachOpen(false);"), "Esc schliesst das Sprach-Menue nicht");
  // Im "…"-Menue stehen die Sprachen NICHT mehr (Jarek, 25.11.26: vier Eintraege dort waren
  // zu viel) -- die Sprachwahl im Kopf ist dafuer auf jeder Breite da (test/mobil).
  assert.ok(!/SPRACH_LISTE\.filter\(/.test(roh) && !/fn: \(\) => setLangTo\(k\)/.test(roh), "die Sprachen stehen wieder im Mehr-Menue");
  // Statistik und Stevie bekommen die echte Sprache, nicht "alles ausser Englisch ist Deutsch"
  assert.ok(roh.includes("        sprache: LANG,\n        geteilt: !!SHARED,"));
  assert.ok(roh.includes("body: JSON.stringify({ sprache: LANG, fakten, verlauf, frage,"));
});

test("der Lader im Kopf: nur bekannte Sprachen, nur aus dem eigenen Ordner, vor dem Rechner", () => {
  const kopf = zwischen("  window.CL_SPRACHEN = ", "    function start() {");
  assert.match(kopf, /if \(window\.CL_SPRACHEN\[l\]\) document\.write\('<script src="sprache\/' \+ l \+ '\.js"><\\\/script>'\);/);
  assert.match(kopf, /\.toLowerCase\(\)\.slice\(0, 2\)/, "das Kuerzel wird nicht auf zwei Zeichen begrenzt");
  // Nachgestellt: was die Adresse auch enthaelt -- geschrieben wird nur fuer Register-Eintraege
  const lauf = (search, gemerkt) => {
    const geschrieben = [];
    const win = { location: { search }, localStorage: { getItem: () => gemerkt || null } };
    const doc = { write: (h) => geschrieben.push(h), getElementById: () => null };
    new Function("window", "document", "URLSearchParams", kopf.slice(0, kopf.indexOf("</script>")))(win, doc, URLSearchParams);
    return geschrieben;
  };
  assert.deepStrictEqual(lauf("?lang=es"), ['<script src="sprache/es.js"></script>']);
  assert.deepStrictEqual(lauf("?lang=ES-MX"), ['<script src="sprache/es.js"></script>']);
  assert.deepStrictEqual(lauf("", "es"), ['<script src="sprache/es.js"></script>'], "die gemerkte Wahl laedt die Sprache nicht");
  for (const boese of ["?lang=../x", "?lang=en", "?lang=de", "?lang=xx", "?lang=%22%3E%3Cscript%3E", "?lang=__proto__", "?lang=constructor", ""]) {
    assert.deepStrictEqual(lauf(boese), [], `"${boese}" laedt etwas`);
  }
  // Die Adresse schlaegt die gemerkte Wahl
  assert.deepStrictEqual(lauf("?lang=de", "es"), []);
});
