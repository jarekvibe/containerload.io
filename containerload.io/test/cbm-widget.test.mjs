// Der CBM-Rechner -- auf den zwei CBM-Seiten und auf der Startseite.
//
// Mehrere Positionen, weil eine Sendung selten aus einer Ware besteht. Gewicht je
// Position, weil bei LCL das HOEHERE von CBM und Gewicht zaehlt (Faustregel 1 cbm =
// 1.000 kg, W/M) -- die CBM-Seite erklaert genau diese Regel im Text, also muss der
// Rechner daneben sie auch rechnen. Und ein Sprung in den 3D-Rechner per ?q=-Import:
// die "Mini-3D-Ansicht" wird nicht nachgebaut, sie existiert -- sie ist das Produkt.
//
// Der Rechenkern (CBM_CALC_START/END) und der Oberflaechen-Baustein (CBM_UI_START/END)
// stehen auf allen drei Seiten WOERTLICH gleich. Drei Kopien, die auseinanderlaufen
// duerfen, waeren drei Rechner mit drei Meinungen.
//
// node --test test/cbm-widget.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SEITEN = {
  "ratgeber/cbm-berechnen.html": "de",
  "en/guide/how-to-calculate-cbm.html": "en",
  "index.html": "beides",
};
const html = Object.fromEntries(Object.keys(SEITEN).map((p) => [p, fs.readFileSync(path.join(dir, "..", p), "utf8")]));

const schnitt = (s, von, bis) => {
  const a = s.indexOf(von), b = s.indexOf(bis, a);
  assert.ok(a >= 0 && b > a, `Marker fehlen: ${von}`);
  return s.slice(a, b + bis.length);
};

test("jede der drei Seiten traegt genau ein Widget", () => {
  for (const [p, s] of Object.entries(html)) {
    assert.strictEqual((s.match(/data-cbm-widget/g) || []).length, 1, p);
  }
});

test("Rechenkern und Oberflaechen-Baustein sind auf allen drei Seiten identisch", () => {
  for (const marker of [["// CBM_CALC_START", "// CBM_CALC_END"], ["// CBM_UI_START", "// CBM_UI_END"]]) {
    const teile = Object.entries(html).map(([p, s]) => [p, schnitt(s, marker[0], marker[1]).replace(/\s+/g, " ").trim()]);
    for (const [p, t] of teile.slice(1)) {
      assert.strictEqual(t, teile[0][1], `${marker[0]}: ${p} weicht von ${teile[0][0]} ab`);
    }
  }
});

// Den Kern ausfuehren -- aus der deutschen Seite geschnitten, per Identitaets-Test oben
// gilt er fuer alle drei.
const { cbmBerechnen, cbmSumme } = new Function(
  schnitt(html["ratgeber/cbm-berechnen.html"], "// CBM_CALC_START", "// CBM_CALC_END")
  + "\nreturn { cbmBerechnen, cbmSumme };"
)();

test("eine Position rechnet wie bisher", () => {
  const r = cbmBerechnen(120, 80, 110, 1);
  assert.ok(Math.abs(r.stueck - 1.056) < 1e-9);
  assert.ok(Math.abs(cbmBerechnen(120, 80, 110, 26).gesamt - 27.456) < 1e-9);
  for (const kaputt of [[0, 80, 110, 1], [120, -1, 110, 1], ["", 80, 110, 1], [120, 80, 110, 0], [120, 80, 110, "x"]]) {
    assert.strictEqual(cbmBerechnen(...kaputt), null, JSON.stringify(kaputt));
  }
});

test("mehrere Positionen summieren sich, und W/M nimmt das Hoehere", () => {
  const s = cbmSumme([
    { l: 120, w: 80, h: 110, qty: 26, kg: 300 },
    { l: 60, w: 40, h: 40, qty: 10, kg: 12 },
  ]);
  assert.ok(Math.abs(s.vol - 28.416) < 1e-9, `Volumen ${s.vol}`);
  assert.strictEqual(s.stk, 36);
  assert.strictEqual(s.kg, 7920);
  // 28,416 cbm x 1.000 = 28.416 kg > 7.920 kg -> das Volumen zaehlt.
  assert.ok(Math.abs(s.frachtKg - 28416) < 1e-9, `W/M ${s.frachtKg}`);
  // Und andersherum: schwere Ware -> das Gewicht zaehlt.
  const schwer = cbmSumme([{ l: 100, w: 100, h: 100, qty: 1, kg: 2000 }]);
  assert.strictEqual(schwer.frachtKg, 2000);
});

test("fehlt ein Gewicht, gibt es KEIN frachtpflichtiges Gewicht", () => {
  // Ein halb gewogenes Maximum waere eine falsche Zahl mit amtlichem Klang.
  const s = cbmSumme([
    { l: 120, w: 80, h: 110, qty: 2, kg: 300 },
    { l: 60, w: 40, h: 40, qty: 5 },
  ]);
  assert.strictEqual(s.frachtKg, null);
  assert.strictEqual(s.kg, 600, "die vorhandenen Gewichte werden trotzdem summiert");
});

test("ungueltige Zeilen fallen raus, die uebrigen zaehlen", () => {
  const s = cbmSumme([
    { l: "", w: 80, h: 110, qty: 1 },
    { l: 120, w: 80, h: 110, qty: 3, kg: 100 },
  ]);
  assert.strictEqual(s.zeilen, 1);
  assert.strictEqual(s.stk, 3);
  assert.strictEqual(cbmSumme([{ l: "", w: "", h: "", qty: 1 }]), null);
  assert.strictEqual(cbmSumme([]), null);
});

test("jedes Feld bekommt ein Label, der Loesch-Knopf einen Namen", () => {
  const ui = schnitt(html["index.html"], "// CBM_UI_START", "// CBM_UI_END");
  assert.ok(/<label for=/.test(ui) && /<input type="number" id=/.test(ui),
    "feld() baut kein Label-Input-Paar");
  assert.ok(/aria-label=/.test(ui), "der Loesch-Knopf hat keinen zugaenglichen Namen");
});

test("der Sprung in den 3D-Rechner traegt die Zeilen als ?q= -- und die Sprache", () => {
  const ui = schnitt(html["index.html"], "// CBM_UI_START", "// CBM_UI_END");
  // Zeilenformat "26x 120x80x110 300kg" -- genau das versteht parseCargoText.
  assert.ok(/r\.menge \+ 'x ' \+ Number\(z\.l\) \+ 'x' \+ Number\(z\.w\) \+ 'x' \+ Number\(z\.h\)/.test(ui),
    "das ?q=-Zeilenformat passt nicht zum Freitext-Import");
  assert.ok(/\+ 'kg'/.test(ui), "das Gewicht reist nicht mit");
  // Die englische Wissensseite haengt lang=en an, die Startseite je nach Sprache.
  assert.ok(html["en/guide/how-to-calculate-cbm.html"].includes("encodeURIComponent(q) + '&lang=en'"),
    "der englische Sprung oeffnet einen deutschen Rechner");
  assert.ok(html["index.html"].includes("(document.documentElement.lang === 'en' ? '&lang=en' : '')"),
    "die Startseite vergisst die Sprache");
});

test("die Startseite zieht das Widget beim Sprachwechsel mit", () => {
  assert.ok(/if\(window\.__cbmNeu\) window\.__cbmNeu\(\);/.test(html["index.html"]),
    "setLang kennt das Widget nicht -- nach dem Umschalten staende es halb deutsch da");
  for (const k of ["cbm_ey", "cbm_h", "cbm_p", "cbm_link"]) {
    assert.ok(html["index.html"].includes(`data-i18n="${k}"`), `${k} steht nicht auf der Seite`);
    assert.ok(html["index.html"].includes(`"${k}": "`), `${k} fehlt im EN-Woerterbuch`);
  }
});

test("kein fill-opacity, kein Verlauf im Widget", () => {
  for (const [p, s] of Object.entries(html)) {
    const w = schnitt(s, 'data-cbm-widget', "// CBM_UI_END");
    assert.ok(!/fill-opacity|linear-gradient|radial-gradient/.test(w), p);
  }
});
