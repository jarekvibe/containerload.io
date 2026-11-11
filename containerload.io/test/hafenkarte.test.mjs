// Die Hafenkarte (/ratgeber/containerhaefen, /en/guide/container-ports).
//
// Gewuenscht (Jarek, 10.11.26): ein Kollege suchte einen Hafen an der Westkueste, den
// Containerschiffe anlaufen; die Reedereien schlugen nur Ostkueste vor, und Google Maps
// kennzeichnet Haefen nicht. Stufe 1: eine Weltkarte mit Suche und Filter nach Land und
// Kueste. Stufe 2 (Routen ab einem Abgangsland vergleichen) folgt mit Fahrplandaten.
//
// Die Ehrlichkeitsfrage dieser Karte: Was ist ein "Containerhafen"? Der World Port Index
// kann es nicht beantworten -- sein Containerfeld ist bei Hamburg, Rotterdam und Los
// Angeles leer, und seine "Hafengroesse" meint das Becken (Felixstowe: "sehr klein").
// "Containerhafen" heissen deshalb NUR die 50 Haefen mit belegtem Umschlag (World
// Shipping Council). Dieser Test haelt fest:
//   * die Filter: dieselbe Funktion wie in der Seite (HK_START..HK_ENDE), nachgerechnet
//   * die Daten: stimmig, die Top 50 = die Quelldatei, Zahl fuer Zahl
//   * die Seiten: Zahlen, Tabelle und Quellenangaben aus denselben Daten
//   * der Datenschutz: kein Kartendienst, keine fremden Skripte
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
const TOP = fs.readFileSync(path.join(wurzel, "..", "werkzeug", "haefen", "quelle", "top50-wsc.csv"), "utf8")
  .trim().split("\n").slice(1).map((z) => z.split(";"));

const kern = karte.slice(karte.indexOf("// HK_START"), karte.indexOf("// HK_ENDE"));
const { hkFiltern, hkNorm, HK_BIT } = new Function(kern + "\nreturn { hkFiltern, hkNorm, HK_BIT };")();
const seewegKern = karte.slice(karte.indexOf("// HK_SEEWEG_START"), karte.indexOf("// HK_SEEWEG_ENDE"));
const { hkGraph, hkSeeweg, hkStartHaefen, hkProj } = new Function(seewegKern + "\nreturn { hkGraph, hkSeeweg, hkStartHaefen, hkProj };")();
const NETZ = laden("karte/seeweg.js", "CL_SEEWEG");
const G = hkGraph(NETZ);
const hafen = (lc) => { const h = D.h.find((x) => x[1] === lc); assert.ok(h, lc + " fehlt"); return [h[11], h[10]]; };
const weg = (a, b, m) => hkSeeweg(G, hafen(a), hafen(b), m);

// ── Die Filter ──────────────────────────────────────────────────────
// name, locode, iso2, x, y, bits, groesse, tiefe, laenge, kueste, lat, lon, alias, teu, standort
const probe = [
  ["Long Beach", "USLGB", "US", 0, 0, 1, 3, 17, 0, 0, 33.8, -118.2, "", 9.88, ""],
  ["Los Angeles", "USLAX", "US", 0, 0, 1, 4, 17, 0, 0, 33.7, -118.3, "", 10.24, ""],
  ["Tacoma", "USTIW", "US", 0, 0, 0, 3, 14, 0, 0, 47.3, -122.4, "", 0, ""],
  ["Empire", "", "US", 0, 0, 0, 3, 0, 0, 0, 43.4, -124.3, "", 0, ""],
  ["Savannah", "USSAV", "US", 0, 0, 1, 3, 9, 0, 1, 32.1, -81.1, "", 5.69, ""],
  ["São Francisco do Sul", "BRSFS", "BR", 0, 0, 0, 3, 12, 300, 2, -26.2, -48.6, "", 0, ""],
  ["Hamburg", "DEHAM", "DE", 0, 0, 1, 4, 6, 0, 3, 53.5, 9.97, "", 8.37, ""],
  ["Husum", "DEHUS", "DE", 0, 0, 0, 1, 3, 0, 3, 54.5, 9.04, "", 0, ""],
  ["Bremen/Bremerhaven", "DEBRV", "DE", 0, 0, 1, 4, 5, 0, 3, 53.6, 8.55, "Bremerhaven", 4.9, ""]
];
const namen = (idx) => idx.map((i) => probe[i][0]);
const landName = (c) => ({ US: "United States", DE: "Germany", BR: "Brazil" })[c] || c;
const F = (x) => Object.assign({ q: "", land: "", kue: "", alle: false }, x);

test("ohne Suchwort: grosse/mittlere Haefen und die Top 50, Umschlag zuerst", () => {
  const r = namen(hkFiltern(probe, F({}), landName));
  assert.ok(!r.includes("Husum"), "kleine Haefen erst mit 'alle'");
  assert.deepStrictEqual(r.slice(0, 5), ["Los Angeles", "Long Beach", "Hamburg", "Savannah", "Bremen/Bremerhaven"], "nach Umschlag");
  assert.ok(namen(hkFiltern(probe, F({ alle: true }), landName)).includes("Husum"));
});

test("Land und Kueste trennen West- von Ostkueste", () => {
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ land: "US", kue: 0 }), landName)), ["Los Angeles", "Long Beach", "Empire", "Tacoma"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ land: "US", kue: 1 }), landName)), ["Savannah"]);
});

test("Suche: findet jeden Hafen, auch kleine -- Name ohne Akzente, UN/LOCODE, Alias, Land", () => {
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ q: "husum" }), landName)), ["Husum"], "kleiner Hafen per Name");
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ q: "sao francisco" }), landName)), ["São Francisco do Sul"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ q: "DE HAM" }), landName)), ["Hamburg"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ q: "uslgb" }), landName)), ["Long Beach"]);
  assert.deepStrictEqual(namen(hkFiltern(probe, F({ q: "bremerhaven" }), landName)), ["Bremen/Bremerhaven"], "ueber den Alias");
  assert.equal(hkNorm("Straße Ä"), "strassea");
});

// ── Die Daten ───────────────────────────────────────────────────────
test("die Daten sind in sich stimmig", () => {
  assert.ok(D.h.length > 3500, "zu wenige Haefen: " + D.h.length);
  assert.deepStrictEqual(D.rahmen, LAND.rahmen, "Haefen und Kueste mit verschiedenem Rahmen");
  const abweichend = [];
  for (const h of D.h) {
    assert.equal(h.length, 15, `${h[0]}: Feldzahl`);
    assert.ok(h[0] && /^[A-Z]{2}$/.test(h[2]), `${h[0]}: Name/Land`);
    if (h[1]) { assert.match(h[1], /^[A-Z]{2}[A-Z0-9]{3}$/, `${h[0]}: UN/LOCODE`); if (h[1].slice(0, 2) !== h[2]) abweichend.push(h[0]); }
    assert.ok(h[3] >= 0 && h[3] <= LAND.w && h[4] >= 0 && h[4] <= LAND.h, `${h[0]}: ausserhalb der Karte`);
    assert.ok(h[10] >= -58 && h[10] <= 84 && h[11] >= -180 && h[11] <= 180, `${h[0]}: Koordinaten`);
    assert.ok(h[9] === -1 || (h[9] >= 0 && h[9] < D.kue.length), `${h[0]}: Kuesten-Index`);
    assert.ok(h[6] >= 0 && h[6] <= 4, `${h[0]}: Hafengroesse`);
    assert.equal(!!(h[5] & HK_BIT.top), h[13] > 0, `${h[0]}: Top-Merkmal und Umschlag gehoeren zusammen`);
  }
  // Ein paar Ueberseegebiete fuehren den Code des Mutterlands -- mehr als eine Handvoll waere ein Fehler
  assert.ok(abweichend.length < 25, "UN/LOCODE und Land passen oft nicht: " + abweichend.slice(0, 10).join(", "));
  for (const k of D.kue) assert.ok(k[0] && k[1], "Kuesteneintrag ohne Namen");
});

test("Containerhafen heisst nur, was in der Top-50-Quelle steht -- Zahl fuer Zahl", () => {
  const top = D.h.filter((h) => h[5] & HK_BIT.top);
  assert.equal(top.length, 50);
  assert.equal(TOP.length, 50);
  const nachTeu = TOP.map((z) => +z[3]).sort((a, b) => b - a);
  assert.deepStrictEqual(top.map((h) => h[13]), nachTeu, "Umschlag 2025 wie in quelle/top50-wsc.csv");
  // Stichproben gegen die Quelle: Name/Land/Zahl
  const q = (name) => TOP.find((z) => z[1] === name);
  const d = (name) => top.find((h) => h[0] === name);
  for (const [qn, dn, iso] of [["Shanghai", "Shanghai", "CN"], ["Hamburg", "Hamburg", "DE"], ["Los Angeles", "Los Angeles", "US"],
    ["Breman/Bremerhaven", "Bremen/Bremerhaven", "DE"], ["Long Beach", "Long Beach", "US"]]) {
    assert.ok(d(dn), `${dn} fehlt in den Top 50`);
    assert.equal(d(dn)[13], +q(qn)[3], `${dn}: Umschlag`);
    assert.equal(d(dn)[2], iso, `${dn}: Land`);
  }
  assert.equal(D.topJahr, 2025);
});

test("Kueste und Haefen haben dieselbe Projektion (Stichprobe: Lage zueinander)", () => {
  const p = (lc) => D.h.find((h) => h[1] === lc);
  const ham = p("DEHAM"), brv = p("DEBRV"), lax = p("USLAX"), sea = p("USSEA");
  assert.ok(ham && brv && lax && sea, "Stichproben-Haefen fehlen");
  assert.ok(ham[3] > brv[3], "Hamburg liegt oestlich von Bremerhaven");
  assert.ok(lax[4] > sea[4], "Los Angeles liegt suedlich von Seattle");
  const sortiert = D.h.slice().sort((a, b) => b[10] - a[10]);
  for (let i = 1; i < sortiert.length; i++) assert.ok(sortiert[i][4] >= sortiert[i - 1][4] - 0.2, `${sortiert[i][0]}: y passt nicht zur Breite`);
});

test("der Fall, um den es ging: die US-Westkueste", () => {
  const wk = D.kue.findIndex((k) => k[0] === "West Coast" && k[1] === "Westküste");
  assert.ok(wk >= 0, "keine Westkueste");
  const r = hkFiltern(D.h, { q: "", land: "US", kue: wk, alle: false }, null).map((i) => D.h[i][0]);
  for (const n of ["Los Angeles", "Long Beach", "Oakland", "Seattle", "Tacoma"]) assert.ok(r.includes(n), `${n} fehlt an der Westkueste`);
  for (const n of ["Savannah", "New York-New Jersey", "Houston"]) assert.ok(!r.includes(n), `${n} steht faelschlich an der Westkueste`);
  assert.deepStrictEqual(r.slice(0, 2), ["Los Angeles", "Long Beach"], "die beiden Top-50-Haefen zuerst");
  // Der Beispiel-Link der Einleitung zeigt genau darauf
  assert.ok(DE.includes(`/ratgeber/containerhaefen?land=US&amp;kueste=${wk}"`), "DE-Beispiellink");
  assert.ok(EN.includes(`/en/guide/container-ports?land=US&amp;kueste=${wk}"`), "EN-Beispiellink");
});

// ── Seewege (Stufe 2a) ──────────────────────────────────────────────
// Gegen bekannte Groessenordnungen: Seemeilen aus der Praxis, +-5 %. Wer das Netz, die
// Haversine oder die Dijkstra-Suche umbaut, faellt hier auf.
test("Seewege: Entfernungen und Passagen wie in der Praxis", () => {
  const nahe = (r, soll, text) => assert.ok(r && Math.abs(r.sm - soll) / soll < 0.05, `${text}: ${r && Math.round(r.sm)} sm statt ~${soll}`);
  const lax = weg("DEHAM", "USLAX");
  nahe(lax, 8150, "Hamburg -> Los Angeles");
  assert.ok(lax.passagen.includes("panama"), "Hamburg -> Los Angeles fuehrt durch den Panamakanal");
  const sha = weg("NLRTM", "CNSGH");
  nahe(sha, 10550, "Rotterdam -> Shanghai");
  assert.ok(sha.passagen.includes("suez"), "Rotterdam -> Shanghai fuehrt durch den Suezkanal");
  const kap = weg("NLRTM", "CNSGH", { suez: 1, babelmandeb: 1, panama: 1 });
  nahe(kap, 13900, "Rotterdam -> Shanghai ohne Suez");
  assert.ok(kap.passagen.includes("kap") && !kap.passagen.includes("suez"), "der Umweg geht ums Kap der Guten Hoffnung");
  nahe(weg("DEHAM", "USNYC"), 3550, "Hamburg -> New York");
  nahe(weg("CNSGH", "USLAX"), 5900, "Shanghai -> Los Angeles (ueber den Pazifik)");
  assert.ok(weg("DEHAM", "PLGDN").passagen.includes("kiel"), "Hamburg -> Danzig durch den Nord-Ostsee-Kanal");
});

test("Seewege: Eispassagen nie, Datumsgrenze verbunden, Projektion wie die Karte", () => {
  for (const [a, b] of [["CNSGH", "DEHAM"], ["JPTYO", "NLRTM"], ["KRPUS", "USNYC"]]) {
    const r = weg(a, b);
    assert.ok(r && !r.passagen.includes("northwest") && !r.passagen.includes("northeast"), `${a} -> ${b}: Eispassage`);
  }
  // Ueber die Datumsgrenze: das Netz hat Kanten ueber +-180 Grad, und Busan -> Vancouver
  // darf nicht um die halbe Welt laufen (ueber den Nordpazifik ~4.600 sm)
  let ueber = 0;
  for (let j = 0; j < NETZ.e.length / 2; j++) if (Math.abs(NETZ.n[2 * NETZ.e[2 * j]] - NETZ.n[2 * NETZ.e[2 * j + 1]]) > 18000) ueber++;
  assert.ok(ueber > 10, "keine Kanten ueber die Datumsgrenze");
  const van = weg("KRPUS", "CAVAN");
  assert.ok(van.sm > 4200 && van.sm < 5200, "Busan -> Vancouver: " + Math.round(van.sm));
  assert.ok(van.punkte.some((p, i) => i > 0 && Math.abs(p[0] - van.punkte[i - 1][0]) > 180), "der Weg kreuzt die Datumsgrenze");
  // Die Formel der Karte trifft die Hafen-Punkte des Generators (d3)
  let max = 0;
  for (const h of D.h) { const [x, y] = hkProj(h[11], h[10], LAND.proj); max = Math.max(max, Math.abs(x - h[3]), Math.abs(y - h[4])); }
  assert.ok(max < 0.06, "Projektion weicht ab: " + max);
});

test("Abgangshaefen: die Containerhaefen des Landes, sonst die groessten", () => {
  const z = D.h.findIndex((h) => h[1] === "USLAX");
  assert.deepStrictEqual(hkStartHaefen(D.h, "DE", z).map((i) => D.h[i][0]), ["Hamburg", "Bremen/Bremerhaven"]);
  const pl = hkStartHaefen(D.h, "PL", -1).map((i) => D.h[i]);
  assert.ok(pl.length >= 1 && pl.length <= 4 && pl.every((h) => h[6] >= 3), "Polen: die groessten Seehaefen");
  assert.ok(!hkStartHaefen(D.h, "US", z).includes(z), "der Zielhafen ist kein Abgangshafen");
});

// ── Seiten, Quellen, Datenschutz ────────────────────────────────────
test("die Seiten nennen die echten Zahlen, und die Tabelle kommt aus denselben Daten", () => {
  for (const platzhalter of ["HK_ZAHL", "HK_STAND", "HK_GEW"]) {
    assert.ok(!DE.includes(platzhalter) && !EN.includes(platzhalter), `Platzhalter ${platzhalter} steht noch auf der Seite`);
  }
  assert.ok(DE.includes(`<b>${D.h.length.toLocaleString("de-DE")} Seehäfen</b>`), "DE: Zahl der Seehaefen");
  assert.ok(EN.includes(`<b>${D.h.length.toLocaleString("en-US")} seaports</b>`), "EN: Zahl der Seehaefen");
  const top = D.h.filter((h) => h[5] & HK_BIT.top);
  for (const [s, loc] of [[DE, "de-DE"], [EN, "en-US"]]) {
    const tab = s.slice(s.indexOf("<!-- HK_TOP50_START -->"), s.indexOf("<!-- HK_TOP50_ENDE -->"));
    const zeilen = [...tab.matchAll(/<tr><td class="num">(\d+)<\/td><td><a href="[^"]*\?hafen=([A-Z0-9]*)">([^<]+)<\/a>.*?<td class="num">([\d.,]+)<\/td><\/tr>/g)];
    assert.equal(zeilen.length, 50, "Tabelle hat nicht 50 Zeilen");
    zeilen.forEach((z, i) => {
      assert.equal(z[2], top[i][1], `Zeile ${i + 1}: Link`);
      assert.equal(z[3].replace(/&amp;/g, "&"), top[i][0], `Zeile ${i + 1}: Name`);
      assert.equal(z[4], top[i][13].toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), `Zeile ${i + 1}: TEU`);
    });
  }
});

test("Quellen und Lizenz stehen auf beiden Seiten", () => {
  for (const s of [DE, EN]) {
    assert.ok(s.includes("World Port Index") && s.includes("World Shipping Council") && s.includes("Natural Earth"));
    assert.ok(s.includes('href="https://www.npmjs.com/package/seaport-data-js"'), "Aufbereitung nicht genannt");
    assert.ok(/creativecommons\.org\/licenses\/by\/4\.0/.test(s), "CC-BY-Lizenz nicht verlinkt");
    assert.ok(s.includes("Aashish Vivekanand"), "Urheber der Aufbereitung fehlt");
    assert.ok(s.includes("Eurostat") && s.includes("EUPL"), "Quelle des Seeweg-Netzes fehlt");
    assert.ok(s.includes('href="https://www.worldshipping.org/top-50-container-ports"'), "WSC-Quelle nicht verlinkt");
  }
  // "Containerhafen" sagt die Karte nur bei der Top-50-Markierung
  const detail = karte.slice(karte.indexOf("function detailZeichnen"), karte.indexOf("// ── Karte: Groesse"));
  assert.match(detail, /if \(h\[5\] & HK_BIT\.top\) \{[\s\S]*?TX\.top/, "der Top-Satz steht nur unter der Top-Bedingung");
});

test("kein Kartendienst: die Karte laedt nur Dateien von containerload.io", () => {
  for (const [name, s] of [["DE", DE], ["EN", EN]]) {
    const skripte = [...s.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(skripte, ["/karte/land.js", "/karte/haefen.js", "/karte/hafenkarte.js"], `${name}: fremde Skripte`);
    assert.ok(!/tile|mapbox|leaflet|maps\.google|googleapis\.com\/maps/i.test(s), `${name}: Kartendienst eingebunden`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|new Image\(/.test(karte), "die Karte laedt nichts nach");
  // Nachgeladen wird genau EINE eigene Datei: das Seeweg-Netz, erst bei der ersten Route
  const nach = [...karte.matchAll(/\.src = "([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(nach, ["/karte/seeweg.js"], "fremde oder weitere nachgeladene Skripte");
  assert.match(karte, /osm\.target = "_blank"; osm\.rel = "noopener noreferrer"/, "OSM nur als Link auf Klick");
});
