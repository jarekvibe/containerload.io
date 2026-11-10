// Die Hafenkarte (/ratgeber/containerhaefen, /en/guide/container-ports).
//
// Gewuenscht (Jarek, 10.11.26): ein Kollege suchte einen Hafen an der Westkueste, den
// Containerschiffe anlaufen; die Reedereien schlugen nur Ostkueste vor, und Google Maps
// kennzeichnet Haefen nicht. Stufe 1: eine Weltkarte der Containerhaefen mit Suche und
// Filter nach Land und Kueste. Stufe 2 (Routen ab einem Abgangsland vergleichen) kommt
// erst mit sauberen Fahrplandaten.
//
// Was hier festgehalten wird:
//   * die Daten: woher, wie viele, und dass die Zahlen auf der Seite dieselben sind
//   * die Filter: dieselbe Funktion wie in der Seite (HK_START..HK_ENDE), nachgerechnet
//   * der Datenschutz: kein Kartendienst, keine fremden Skripte -- die Karte laedt nur
//     Dateien von containerload.io
//
// node --test test/hafenkarte.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(dir, "..");
const lies = (p) => fs.readFileSync(path.join(wurzel, p), "utf8");
const laden = (p, name) => { const w = {}; new Function("window", lies(p))(w); return w[name]; };
const LAND = laden("karte/land.js", "CL_LAND");
const D = laden("karte/haefen.js", "CL_HAEFEN");
const karte = lies("karte/hafenkarte.js");
const DE = lies("ratgeber/containerhaefen.html"), EN = lies("en/guide/container-ports.html");

const kern = karte.slice(karte.indexOf("// HK_START"), karte.indexOf("// HK_ENDE"));
const { hkFiltern, hkNorm, HK_BIT } = new Function(kern + "\nreturn { hkFiltern, hkNorm, HK_BIT };")();

// ── Die Filter ──────────────────────────────────────────────────────
const probe = [
  // name, locode, iso2, x, y, bits, groesse, tiefe, laenge, gew, lat, lon, alias
  ["Long Beach", "USLGB", "US", 0, 0, 3, 4, 15, 400, 0, 33.75, -118.2, ""],
  ["Oakland", "USOAK", "US", 0, 0, 1, 3, 15, 366, 0, 37.8, -122.3, ""],
  ["Savannah", "USSAV", "US", 0, 0, 1, 4, 14, 366, 1, 32.1, -81.1, ""],
  ["São Francisco do Sul", "BRSFS", "BR", 0, 0, 1, 3, 12, 300, 2, -26.2, -48.6, ""],
  ["Hamburg", "DEHAM", "DE", 0, 0, 3, 4, 15, 400, 3, 53.5, 9.97, ""],
  ["Husum", "DEHUS", "DE", 0, 0, 0, 2, 4, 90, 3, 54.5, 9.04, ""],
  ["Bremerhaven", "DEBRV", "DE", 0, 0, 3, 4, 16, 400, 3, 53.6, 8.55, "Bremen-Bremerhaven"]
];
const namen = (idx) => idx.map((i) => probe[i][0]);
const landName = (c) => ({ US: "United States", DE: "Germany", BR: "Brazil" })[c] || c;

test("ohne Filter: nur Haefen mit Containerumschlag, groesste zuerst", () => {
  const r = namen(hkFiltern(probe, { q: "", land: "", gew: "", alle: false }, landName));
  assert.ok(!r.includes("Husum"), "Husum hat keinen Containerumschlag");
  assert.deepStrictEqual(r.slice(0, 4), ["Bremerhaven", "Hamburg", "Long Beach", "Savannah"], "Hafengroesse 4 vor 3, dann Name");
  assert.ok(namen(hkFiltern(probe, { q: "", land: "", gew: "", alle: true }, landName)).includes("Husum"), "mit 'alle' auch Husum");
});

test("Land und Kueste trennen West- von Ostkueste", () => {
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "", land: "US", gew: 0, alle: false }, landName)), ["Long Beach", "Oakland"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "", land: "US", gew: 1, alle: false }, landName)), ["Savannah"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "", land: "US", gew: "", alle: false }, landName)).sort(), ["Long Beach", "Oakland", "Savannah"]);
});

test("Suche: Name ohne Akzente, UN/LOCODE mit und ohne Leerzeichen, Alias, Land", () => {
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "sao francisco", land: "", gew: "", alle: false }, landName)), ["São Francisco do Sul"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "DE HAM", land: "", gew: "", alle: false }, landName)), ["Hamburg"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "uslgb", land: "", gew: "", alle: false }, landName)), ["Long Beach"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "bremen", land: "", gew: "", alle: false }, landName)), ["Bremerhaven"], "ueber den Alias");
  assert.deepStrictEqual(namen(hkFiltern(probe, { q: "germ", land: "", gew: "", alle: false }, landName)), ["Bremerhaven", "Hamburg"]);
  assert.equal(hkNorm("Straße Ä"), "strassea");
});

// ── Die Daten ───────────────────────────────────────────────────────
test("die Daten sind in sich stimmig", () => {
  assert.ok(Array.isArray(D.h) && D.h.length > 10, "keine Haefen");
  assert.deepStrictEqual(D.rahmen || LAND.rahmen, LAND.rahmen, "Haefen und Kueste mit verschiedenem Rahmen");
  const lcs = new Set();
  for (const h of D.h) {
    assert.equal(h.length, 13, `${h[0]}: Feldzahl`);
    assert.ok(h[0] && typeof h[0] === "string", "Name fehlt");
    if (h[1]) {
      assert.match(h[1], /^[A-Z]{2}[A-Z0-9]{3}$/, `${h[0]}: UN/LOCODE`);
      assert.equal(h[1].slice(0, 2), h[2], `${h[0]}: Land passt nicht zum UN/LOCODE`);
      lcs.add(h[1]);
    }
    assert.ok(h[3] >= 0 && h[3] <= LAND.w && h[4] >= 0 && h[4] <= LAND.h, `${h[0]}: liegt ausserhalb der Karte`);
    assert.ok(h[10] >= -58 && h[10] <= 84 && h[11] >= -180 && h[11] <= 180, `${h[0]}: Koordinaten`);
    assert.ok(h[9] === -1 || (h[9] >= 0 && h[9] < D.gew.length), `${h[0]}: Gewaesser-Index`);
    assert.ok(h[6] >= 0 && h[6] <= 4, `${h[0]}: Hafengroesse`);
  }
  for (const g of D.gew) assert.ok(g[0], "Gewaesser ohne Namen");
});

test("Kueste und Haefen haben dieselbe Projektion (Stichprobe: Lage zueinander)", () => {
  const p = (lc) => D.h.find((h) => h[1] === lc);
  const ham = p("DEHAM"), brv = p("DEBRV"), lax = p("USLAX"), sea = p("USSEA");
  if (!ham || !brv || !lax || !sea) return; // Probedaten ohne diese Haefen
  assert.ok(ham[3] > brv[3], "Hamburg liegt oestlich von Bremerhaven");
  assert.ok(lax[4] > sea[4], "Los Angeles liegt suedlich von Seattle");
  // Die Projektion bildet die Breite monoton ab: wer suedlicher liegt, hat das groessere y
  const sortiert = D.h.slice().sort((a, b) => b[10] - a[10]);
  for (let i = 1; i < sortiert.length; i++) assert.ok(sortiert[i][4] >= sortiert[i - 1][4] - 0.2, `${sortiert[i][0]}: y passt nicht zur Breite`);
});

// ── Datenschutz und Seite ───────────────────────────────────────────
test("kein Kartendienst: die Karte laedt nur Dateien von containerload.io", () => {
  for (const [name, s] of [["DE", DE], ["EN", EN]]) {
    const skripte = [...s.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(skripte, ["/karte/land.js", "/karte/haefen.js", "/karte/hafenkarte.js"], `${name}: fremde Skripte`);
    assert.ok(!/tile|mapbox|leaflet|maps\.google|googleapis\.com\/maps/i.test(s), `${name}: Kartendienst eingebunden`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|new Image\(/.test(karte), "die Karte laedt nichts nach");
  // Der OSM-Link ist ein Link (neuer Tab, auf Klick), kein eingebettetes Kartenbild
  assert.match(karte, /osm\.target = "_blank"; osm\.rel = "noopener noreferrer"/);
});

test("die Seiten nennen die echte Zahl und den Stand der Daten", () => {
  const mitC = D.h.filter((h) => h[5] & HK_BIT.container).length;
  const de = mitC.toLocaleString("de-DE"), en = mitC.toLocaleString("en-US");
  for (const platzhalter of ["HK_ZAHL", "HK_STAND", "HK_GEW"]) {
    assert.ok(!DE.includes(platzhalter) && !EN.includes(platzhalter), `Platzhalter ${platzhalter} steht noch auf der Seite`);
  }
  assert.ok(DE.includes(`<b>${de} Häfen mit Containerumschlag</b>`), `DE nennt nicht ${de}`);
  assert.ok(EN.includes(`<b>${en} ports with container handling</b>`), `EN nennt nicht ${en}`);
  assert.ok(D.stand && DE.includes(D.stand.split("-").reverse().join(".")), "DE nennt den Stand nicht");
});

test("der Westkuesten-Link der Einleitung zeigt wirklich auf den Pazifik", () => {
  for (const s of [DE, EN]) {
    const m = s.match(/containerhaefen\?land=US&amp;gew=(\d+)|container-ports\?land=US&amp;gew=(\d+)/);
    assert.ok(m, "Beispiel-Link fehlt");
    const g = D.gew[+(m[1] || m[2])];
    assert.ok(g && /Pacific/.test(g[0]), `gew zeigt auf ${g && g[0]}`);
  }
});
