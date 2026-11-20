// Die Seite "LKW richtig beladen" (/ratgeber/lkw-beladen, /en/guide/how-to-load-a-truck).
//
// Sie traegt Zahlen, die der Rechner hinter dem Knopf sofort bestaetigen oder widerlegen
// wuerde: die Fahrzeug-Tabelle (Innenmasse, Hoehe, Zuladung, Europaletten) und das
// Achslast-Beispiel (18 Europaletten a 1 t: 15,4 t Sattellast an der Stirnwand, 2,1 m
// Abstand -> 11,0 t / 14,0 t). Beides wird hier mit VEHICLES, makeFloorPacker und dem
// Achslast-Modell aus app.html NACHGERECHNET -- genau der Nachlauf, den der Rechner faehrt.
// Dazu: der Knopf laedt genau dieses Beispiel, Kopf, FAQ, Einbindung.
//
// node --test test/lkw-beladen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const de = lies("ratgeber/lkw-beladen.html"), en = lies("en/guide/how-to-load-a-truck.html");

const L = lies("app.html").split("\n");
const cut = (von, bis) => {
  const s = L.findIndex((l) => l.includes(von));
  const e = L.findIndex((l, i) => i > s && bis(l, i));
  assert.ok(s >= 0 && e > s, `Ausschnitt nicht gefunden: ${von}`);
  return L.slice(s, e + 1).join("\n");
};
const M = new Function(
  `var num=(v,d=0)=>Number.isFinite(+v)&&v!==""?+v:d;
   var applyCarrier=(p)=>p;
   ${cut("var PRESETS = {", (l) => l.includes("var panelsFor"))}
   ${cut("function makeFloorPacker", (l, i) => l.trim() === "}" && L[i - 1].includes("single: false"))}
   ${cut("var ACHSEN = {", (l, i) => l.trim() === "}" && L[i - 1].includes("return best && best.zapfen < a0.zapfen ? best : null;"))}
   return { packCargo, makeFloorPacker, VEHICLES, ACHSEN, achslasten, achsShift, achsVerteilen };`
)();
const pv = L.findIndex((l) => l.includes("var PALLET_PRESETS = ["));
const pb = L.findIndex((l, i) => i > pv && l.includes("var hexA"));
const { parseCargoText } = new Function(L.slice(pv, pb).join("\n") + "\nreturn { parseCargoText };")();

const tabellen = (html) => [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)].map((t) =>
  [...t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, "").trim())));

const FAHRZEUGE = [
  ["Planensattel", "Curtainsider", "Planensattel"], ["Wechselbrücke", "Swap body", "Wechselbrücke"],
  ["Motorwagen", "Rigid truck", "Motorwagen"], ["7,5-Tonner", "7.5-t truck", "7,5-Tonner"],
  ["Transporter (Sprinter)", "Van (Sprinter)", "Sprinter"]
];

test("Fahrzeug-Tabelle: Masse, Hoehe, Zuladung aus VEHICLES, Europaletten vom Packer", () => {
  for (const [html, sp, d] of [[de, 0, ","], [en, 1, "."]]) {
    const t = tabellen(html)[0];
    assert.strictEqual(t.length, 1 + FAHRZEUGE.length);
    FAHRZEUGE.forEach((f, i) => {
      const [name, eur, zul, flaeche, hoehe] = t[i + 1];
      const V = M.VEHICLES[f[2]];
      const m = (cm) => (cm / 100).toFixed(2).replace(".", d);
      assert.strictEqual(name, f[sp]);
      assert.strictEqual(flaeche, `${m(V.l)} × ${m(V.w)} m`, `${name}: Flaeche`);
      assert.strictEqual(hoehe, `${m(V.h)} m`, `${name}: Hoehe`);
      const t1 = V.payload / 1000;
      assert.strictEqual(zul, `${Number.isInteger(t1) ? t1 : t1.toFixed(1).replace(".", d)} t`, `${name}: Zuladung`);
      assert.strictEqual(Number(eur), M.makeFloorPacker(120, 80, true)(V.l, V.w).count, `${name}: Europaletten`);
    });
  }
  // "mehr als 7,45 m -> nur der Planensattel": die laengste der uebrigen Ladeflaechen
  const ohneSattel = Math.max(...Object.entries(M.VEHICLES).filter(([k]) => k !== "Planensattel").map(([, v]) => v.l));
  assert.strictEqual(ohneSattel, 745);
  assert.ok(de.includes("mehr als 7,45&nbsp;m Ladelänge") && en.includes("more than 7.45&nbsp;m of floor"));
});

test("Achslast-Beispiel: mit dem Modell des Rechners nachgerechnet", () => {
  const V = M.VEHICLES["Planensattel"], A = M.ACHSEN["Planensattel"];
  const T = [{ l: 120, w: 80, h: 150, weight: 1000, qty: 18, stackable: false, rotatable: true }];
  const wf = () => 1000;
  const r = M.packCargo(V, T, { noHint: true, ordentlich: true });
  assert.strictEqual(r.placed.length, 18);
  const laenge = Math.max(...r.placed.map((p) => p.x + p.dx));
  const vorne = M.achslasten(r.placed, wf, A);
  // Genau der Nachlauf des Pack-Effekts: erst verteilen, dann schieben
  const v = M.achsVerteilen(r.placed, [{ ...T[0], qty: 18 }], wf, A, V, { noHint: true, ordentlich: true });
  const pl = v ? v.placed : r.placed;
  const dx = M.achsShift(pl, wf, A, V.l);
  const nach = M.achslasten(pl.map((p) => ({ ...p, x: p.x + dx })), wf, A);
  const t1 = (kg, d) => (kg / 1000).toFixed(1).replace(".", d);
  const m1 = (cm, d) => (cm / 100).toFixed(1).replace(".", d);
  for (const [html, d, wort] of [[de, ",", ["belegen sie ", "lasten rund <b>", "Mit <b>", "sinkt die Sattellast auf ", "das Aggregat trägt "]], [en, ".", ["they take up ", "around <b>", "With a <b>", "fifth-wheel load drops to ", "the axle group carries "]]]) {
    const box = html.match(/<div class="formula"[^>]*>([\s\S]*?)<\/div>/)[1];
    for (const [i, soll] of [[0, `${m1(laenge, d)}&nbsp;m`], [1, `${t1(vorne.zapfen, d)}&nbsp;t`], [2, `${m1(dx, d)}&nbsp;m`], [3, `${t1(nach.zapfen, d)}&nbsp;t`], [4, `${t1(nach.aggregat, d)}&nbsp;t`]]) {
      assert.ok(box.includes(wort[i] + soll), `Beispiel: erwartet "${wort[i]}${soll}" -- ${box.slice(0, 400)}`);
    }
  }
  // Die Aussagen dazu: vorne ueber der Grenze, danach drunter -- und beide Grenzen wie im Rechner
  assert.ok(vorne.zapfen > A.zapfenMax && nach.zapfen <= A.zapfenMax && nach.aggregat <= A.aggregatMax);
  assert.deepStrictEqual([A.zapfenMax, A.aggregatMax], [11000, 24000]);
  assert.ok(de.includes("<b>11&nbsp;t Sattellast</b> und <b>24&nbsp;t für das Dreiachsaggregat</b>"));
  assert.ok(en.includes("<b>11&nbsp;t fifth-wheel load</b> and <b>24&nbsp;t for the tri-axle group</b>"));
});

test("der Knopf laedt genau das Beispiel, auf dem Planensattel, flach", () => {
  for (const [html, flach, pref] of [[de, "nicht stapelbar", "/app?q="], [en, "not stackable", "/app?lang=en&q="]]) {
    const hrefs = [...html.matchAll(/href="(\/app\?[^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 2);
    for (const h of hrefs) {
      assert.ok(h.startsWith(pref) && /[?&]d=road(&|$)/.test(h), `Knopf nicht in der Landfracht: ${h}`);
      const q = decodeURIComponent(new URLSearchParams(h.slice(h.indexOf("?"))).get("q"));
      assert.strictEqual(q, `18x 120x80x150 1000kg ${flach}`);
      const z = parseCargoText(q)[0];
      assert.deepStrictEqual([z.qty, z.l, z.w, z.h, z.weight, z.stackable], [18, 120, 80, 150, 1000, false], `Parser liest ${q} anders`);
    }
  }
});

test("Kopf und FAQ: Suchbegriff vorne, Laengen, hreflang, Schema = sichtbar", () => {
  for (const [name, html, url, begriff] of [
    ["DE", de, "https://containerload.io/ratgeber/lkw-beladen", /^LKW richtig beladen/],
    ["EN", en, "https://containerload.io/en/guide/how-to-load-a-truck", /^How to load a truck/]
  ]) {
    const titel = html.match(/<title>([^<]+)<\/title>/)[1].replace(/&amp;/g, "&");
    const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(begriff.test(titel) && titel.length <= 60, `${name}-Titel (${titel.length})`);
    assert.ok(desc.length <= 155, `${name}-Beschreibung ${desc.length}`);
    assert.ok(begriff.test(html.match(/<h1>([^<]+)<\/h1>/)[1]), `${name}: h1`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`) && html.includes(`<meta property="og:url" content="${url}" />`));
    assert.ok(html.includes('<link rel="alternate" hreflang="de" href="https://containerload.io/ratgeber/lkw-beladen" />'));
    assert.ok(html.includes('<link rel="alternate" hreflang="en" href="https://containerload.io/en/guide/how-to-load-a-truck" />'));
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.strictEqual(ld["@type"], "FAQPage");
    for (const q of ld.mainEntity) assert.ok(html.includes(`<p><b>${q.name}</b><br>${q.acceptedAnswer.text}</p>`), `${name}: "${q.name}" nicht sichtbar`);
  }
});

test("eingebunden: Sitemap, Indexseiten, Nachbarseiten", () => {
  const sm = lies("sitemap.xml");
  assert.ok(sm.includes("<loc>https://containerload.io/ratgeber/lkw-beladen</loc>") && sm.includes("<loc>https://containerload.io/en/guide/how-to-load-a-truck</loc>"));
  assert.ok(lies("ratgeber/index.html").includes('href="/ratgeber/lkw-beladen"'));
  assert.ok(lies("en/guide/index.html").includes('href="/en/guide/how-to-load-a-truck"'));
  for (const p of ["ratgeber/lademeter-rechner.html", "ratgeber/palettenrechner.html", "ratgeber/container-gewicht-strasse.html"]) assert.ok(lies(p).includes('href="/ratgeber/lkw-beladen"'), `${p} verlinkt nicht`);
  for (const p of ["en/guide/loading-metre-calculator.html", "en/guide/pallet-calculator.html", "en/guide/container-road-weight-limits.html"]) assert.ok(lies(p).includes('href="/en/guide/how-to-load-a-truck"'), `${p} verlinkt nicht`);
});
