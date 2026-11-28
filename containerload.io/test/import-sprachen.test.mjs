// Der lokale Text-Import in den Sprachen der Oberflaeche (26.11.26).
//
// Bis dahin verstand parseCargoText / parseTSV nur Deutsch und Englisch -- obwohl der Rechner
// sechs Sprachen spricht. "9 bultos 250x80x30 no apilables" ergab neun STAPELBARE Stuecke, und
// die Beispiel-Listen der spanischen, franzoesischen und chinesischen Startseite kamen im
// Rechner als "nichts erkannt" an. Der lokale Parser liest ?q=-Links, die Import-Box der
// Startseite, lange Listen (ueber 6.000 Zeichen) und alles, wenn die KI nicht erreichbar ist.
//
// Dabei gefunden, auch fuer Deutsch und Englisch: die Masskette frass das "m" des naechsten
// Wortes als Einheit Meter -- "5 Kisten 120x80x100 mit Deckel" waren 12000 x 8000 x 10000 cm.
//
// Drei Dinge haelt dieser Test fest:
//   1. Die Woerter jeder Sprache kommen an (stapelbar, drehbar, Hoehe, Menge, Gewicht, Paletten).
//   2. Was auf den Seiten als BEISPIEL steht, liest der Rechner auch (Startseite, Import-Fenster).
//   3. Deutsch und Englisch lesen wie vorher (test/daten/import-de-en.json: 39 Eingaben, vor dem
//      Umbau aufgenommen) -- und kein neues Wort heisst in einer anderen Sprache etwas anderes.
//
// node --test test/import-sprachen.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lese = (p) => fs.readFileSync(path.join(dir, "..", p), "utf8");
const app = lese("app.html"), L = app.split("\n");
const von = L.findIndex((l) => l.includes("var PALLET_PRESETS = [")), bis = L.findIndex((l, i) => i > von && l.includes("var hexA"));
const { parseCargoText, IMPORT_WORT } = new Function(L.slice(von, bis).join("\n") + "\nreturn { parseCargoText, IMPORT_WORT };")();
const eine = (t, opts) => { const r = parseCargoText(t, opts); assert.strictEqual(r.length, 1, `eine Position erwartet fuer: ${t}`); return r[0]; };
const masse = (r) => [r.l, r.w, r.h];

test("nicht stapelbar -- in jeder Sprache, und nur wenn es dasteht", () => {
  for (const t of [
    "12 Kartons 60x40x40 nicht stapelbar", "10 boxes 60x40x40 not stackable",
    "9 bultos 250x80x30 no apilables", "8 bidones 60x60x90 220 kg no remontable", "3 cajas 100x80x60 no se pueden apilar", "2 cajas 100x80x60 NO APILAR",
    "9 colis 250x80x30 non gerbables", "4 palettes 120x80 pas gerbable", "2 caisses 100x80x60 ne pas gerber", "2 caisses 100x80x60 non empilable",
    "9 colli 250x80x30 niet stapelbaar", "2 kisten 100x80x60 niet-stapelbaar",
    "9件 250x80x30 不可堆叠", "3箱 100x80x60 不能堆放",
  ]) assert.strictEqual(eine(t).stackable, false, t);
  // Das Wort allein -- oder eine Verneinung, die keine ist ("piaNO APILABLE", "caNON GERBABLE")
  for (const t of [
    "18 palets 120x80x110 apilables", "piano apilable 150x60x110 250 kg", "18 palettes 120x80x110 gerbables", "canon gerbable 100x80x60",
    "18 pallets 120x80x110 stapelbaar", "18托盘 120x80x110 可堆叠", "6 cajas 60x40x40, 12 kg",
  ]) assert.strictEqual(eine(t).stackable, true, t);
});

test("stapelbar bis zu einer Hoehe: hasta, jusqu'à, tot, máx, 至", () => {
  for (const [t, cm] of [
    ["18 palets 120x80x110, 300 kg, apilable hasta 180 cm", 180], ["18 palets 120x80x110 máx. 180 cm", 180], ["18 palets 120x80x110 máximo 1,8 m", 180],
    ["18 palettes 120x80x110, 300 kg, gerbable jusqu’à 180 cm", 180], ["18 palettes 120x80x110 jusqu'à 1,8 m", 180],
    ["18 pallets 120x80x110, 300 kg, stapelbaar tot 180 cm", 180], ["18 pallets 120x80x110 maximaal 180 cm", 180],
    ["18 个托盘 120x80x110，300 kg，可堆叠至 180 cm", 180],
  ]) {
    const r = eine(t);
    assert.strictEqual(r.stackH, cm, t);
    assert.deepStrictEqual(masse(r), [120, 80, 110], `${t}: die Hoehengrenze hat eine Kante veraendert`);
    assert.ok(!/\d|hasta|jusqu|\btot\b|m[aá]x|至/i.test(r.name), `${t}: der Name traegt Reste — "${r.name}"`);
  }
  // Ein Gewicht ist keine Hoehe, und "total" ist kein "tot"
  assert.strictEqual(eine("12 uds 50x40x30 máx 100 kg").stackH, null);
  assert.strictEqual(eine("12 uds 50x40x30 máx 100 kg").weight, 100);
  assert.strictEqual(eine("total 180 cm 5 Kisten 100x80x60").stackH, null);
});

test("nicht drehbar -- in jeder Sprache", () => {
  for (const t of [
    "2 Maschinen 320x145x168 nicht drehbar", "3 crates 200x100x120 no rotate",
    "2 máquinas 320x145x168 no girar", "2 máquinas 320x145x168 sin girar", "2 máquinas 320x145x168 no rotar",
    "2 machines 320x145x168 ne pas tourner", "12 fûts 60x60x90 sans rotation",
    "2 kisten 320x145x168 niet draaien", "2 kisten 320x145x168 niet draaibaar", "2台 320x145x168 不可旋转",
  ]) assert.strictEqual(eine(t).rotatable, false, t);
  for (const t of ["2 máquinas 320x145x168 2,4 t", "2 machines giratoires 320x145x168", "2 draaibanken 320x145x168"]) assert.strictEqual(eine(t).rotatable, true, t);
});

test("die Menge steht nicht immer vorn -- und ein neues Zaehlwort endet am Wortende", () => {
  for (const [t, qty] of [
    ["Pos 3: 12 bultos 100x80x60 300 kilos", 12], ["Ref. A — 5 cajas 60x40x40", 5], ["Lote B: 7 tarimas 120x100x150", 7], ["Pedido: 10 uds. 60x40x40", 10],
    ["Lot B : 8 colis 60x40x30", 8], ["Commande : 10 pièces 60x40x40", 10], ["Order A: 10 stuks 60x40x40", 10], ["Partij B: 6 vaten 60x60x90", 6],
    ["货物：9件 250x80x30", 9], ["18 个托盘 120x80x110", 18],
    // Wachen: deutsche und englische Woerter, die wie ein neues Zaehlwort ANFANGEN
    ["Typ 3 Futter 10 Stück 60x40x20", 10], ["12 Futterkisten 60x40x30 20kg", 12], ["Typ 2 Sackware 10 Stück 60x40x20", 10], ["2 dozen boxes 30x20x10", 2],
  ]) assert.strictEqual(eine(t).qty, qty, t);
  // Der Name: die Ware bleibt, das Zaehlwort geht
  const N = { pos: "Bulto", pal: "Palé", ep: "Europalé" };
  for (const [t, name] of [
    ["6 cajas 60x40x40, 12 kg", "Cajas"], ["9 colis 250x80x30 non gerbables", "Colis"], ["6 vaten 60x60x90 220 kg", "Vaten"], ["18托盘 120x80x110 可堆叠", "托盘"],
    ["10 unidades de 60x40x40 cm, 15 kg c/u", "Bulto"], ["10 pièces 60x40x40 15 kg la pièce", "Bulto"], ["10 stuks 60x40x40 15 kg per stuk", "Bulto"], ["12 uds 50x40x30 máx 100 kg", "Bulto"],
    ["12 Futterkisten 60x40x30 20kg", "Futterkisten"],
  ]) assert.strictEqual(eine(t, { namen: N }).name, name, t);
});

test("Gewicht: kilos, toneladas, tonnes, libras, 公斤, 吨 -- und der Name behaelt keine Reste", () => {
  for (const [t, kg] of [
    ["12 bultos 100x80x60 300 kilos", 300], ["2 máquinas 320x145x168 2,4 toneladas", 2400], ["1 máquina 320x145x168 1 tonelada", 1000],
    ["2 machines 320x145x168 2,4 tonnes", 2400], ["3 Kisten 80x60x50 250 Kilogramm", 250], ["3 kisten 80x60x50 250 kilogram", 250],
    ["18托盘 120x80x110 300公斤", 300], ["2台 320x145x168 2.4吨", 2400], ["6箱 60x40x40 12千克", 12],
  ]) {
    const r = eine(t);
    assert.strictEqual(r.weight, kg, t);
    assert.ok(!/^(s|gramm|gram)\b|\b(s|gramm|gram)$/i.test(r.name), `${t}: Rest der Einheit im Namen — "${r.name}"`);
  }
  // Pfund genau, wie beim englischen "lbs" (test/zoll-und-pfund)
  assert.strictEqual(eine("5 tarimas 48x40x55 pulgadas 1100 libras").weight, 498.951607);
  assert.strictEqual(eine("5 pallets 48x40x55 inch 1100 lbs").weight, 498.951607);
});

test("Zoll als Wort: pulgadas, pouces -- genau umgerechnet", () => {
  for (const t of ["5 tarimas 48x40x55 pulgadas", "5 caisses 48x40x55 pouces", "5 pallets 48x40x55 inch"]) assert.deepStrictEqual(masse(eine(t)), [121.92, 101.6, 139.7], t);
});

test("Paletten ohne Masse: die Vorwahl in jeder Sprache -- und geraten wird nicht", () => {
  for (const [t, qty, l, w] of [
    ["20 Europaletten", 20, 120, 80], ["11 euro pallets", 11, 120, 80],
    ["20 europalets", 20, 120, 80], ["4 palés europeos", 4, 120, 80], ["4 palets europeos 400 kg", 4, 120, 80], ["3 palets industriales", 3, 120, 100],
    ["20 europalettes", 20, 120, 80], ["4 palettes Europe", 4, 120, 80], ["4 palettes européennes", 4, 120, 80], ["3 palettes industrielles", 3, 120, 100],
    ["20 europallets", 20, 120, 80], ["4 blokpallets", 4, 120, 100], ["4 industriepallets", 4, 120, 100], ["20 欧标托盘", 20, 120, 80],
  ]) {
    const r = eine(t);
    assert.deepStrictEqual([r.qty, r.l, r.w, r.h], [qty, l, w, 110], t);
  }
  // Die Hoehe in Worten schlaegt den Standardwert
  for (const t of ["4 palés europeos 150 cm de alto 400 kg", "4 palets europeos altura 150 cm", "4 palettes Europe hauteur 150 cm", "4 palettes Europe 150 cm de haut", "4 blokpallets 150 cm hoog", "4 europallets hoogte 150"]) assert.strictEqual(eine(t).h, 150, t);
  // Zwei Masse plus Paletten-Wort
  for (const [t, l, w] of [["4 palets 120x80", 120, 80], ["4 tarimas 120x100", 120, 100], ["4 palettes 120x80", 120, 80], ["4 palés 100x120", 100, 120], ["4 托盘 110x110", 110, 110]]) assert.deepStrictEqual(masse(eine(t)), [l, w, 110], t);
  // Nicht geraten: "palet americano" meint in Spanien 1200 x 1000, in Lateinamerika 48 x 40 Zoll
  // (siehe es/guia); "Eurokisten" sind keine Europalette; "pale ale" ist Bier, keine Palette.
  for (const t of ["3 palets americanos", "1 Palette Eurokisten", "4 cases pale ale 40x30"]) assert.deepStrictEqual(parseCargoText(t), [], t);
  // "40 high cube" ist keine Hoehe von 40 cm
  assert.strictEqual(eine("4 euro pallets for 40 high cube").h, 110);
});

test("beschriftete Masse: largo/ancho/alto, longueur/largeur/hauteur, lengte/breedte/hoogte, 长/宽/高", () => {
  for (const t of [
    "Länge 320 Breite 145 Höhe 168 1200 kg", "length 320 width 145 height 168 1200 kg",
    "largo 320 ancho 145 alto 168 1200 kg", "Largo: 320 cm, Ancho: 145 cm, Altura: 168 cm, 1200 kg", "longitud 3,2 m anchura 1,45 m altura 1,68 m 1200 kg",
    "longueur 320 largeur 145 hauteur 168 1200 kg", "lengte 320 breedte 145 hoogte 168 1200 kg", "长320 宽145 高168 1200公斤", "长度：320 宽度：145 高度：168 1200 kg",
  ]) {
    const r = eine(t);
    assert.deepStrictEqual([...masse(r), r.weight], [320, 145, 168, 1200], t);
  }
  // Franz. "largeur" ist die BREITE, span. "largo" die LAENGE -- sie duerfen sich nicht vertauschen
  assert.deepStrictEqual(masse(eine("largeur 145 longueur 320 hauteur 168")), [320, 145, 168]);
  assert.deepStrictEqual(masse(eine("ancho 145 largo 320 alto 168")), [320, 145, 168]);
});

test("die Einheit endet am Wortende: \"120x80x100 mit Deckel\" sind keine 120 Meter", () => {
  // Vor dem 26.11.26 frass die Kette das "m" des naechsten Wortes -- auf Deutsch und Englisch.
  for (const [t, l, w, h, name] of [
    ["5 Kisten 120x80x100 mit Deckel 50kg", 120, 80, 100, "Kisten mit Deckel"], ["3 Kisten 120x80x100 Maschinenteile", 120, 80, 100, "Kisten Maschinenteile"],
    ["2 crates 100x80x60 machine parts", 100, 80, 60, "Crates machine parts"], ["12 cartons 50x40x30 max 100 kg", 50, 40, 30, "Cartons"],
    ["4 Paletten 120x80 mit Folie", 120, 80, 110, null], ["3 cajas 60x40x30 muy frágil", 60, 40, 30, "Cajas muy frágil"], ["8 colis 60x40x30 marchandise", 60, 40, 30, "Colis marchandise"],
    ["2 Kisten 100x80x60 Zollware", 100, 80, 60, "Kisten Zollware"], ["2 Kisten 100x80x60 cmyk-Druck", 100, 80, 60, null],
    ["largo 320 ancho 145 alto 168 máquina", 320, 145, 168, null],
  ]) {
    const r = eine(t);
    assert.deepStrictEqual(masse(r), [l, w, h], t);
    if (name) assert.strictEqual(r.name, name, t);
  }
  // Echte Einheiten gelten weiter -- am Ende, vor einem Satzzeichen, vor dem Trenner
  for (const [t, l, w, h] of [
    ["2 Kisten 1,2x0,8x1 m", 120, 80, 100], ["1 Kiste 2x1x1m 500kg", 200, 100, 100], ["1 Kiste 2x1x1 m, 500 kg", 200, 100, 100], ["6 Kartons 600x400x300 mm", 60, 40, 30],
    ["4 Kisten 120cmx80cmx100cm", 120, 80, 100], ["4 Kisten 120 cm x 80 cm x 100 cm schwer", 120, 80, 100], ["5 boxes 20x10x10 inches each", 50.8, 25.4, 25.4], ["3 x 2,40 x 1,60 x 1,20 m 900 kg", 240, 160, 120],
  ]) assert.deepStrictEqual(masse(eine(t)), [l, w, h], t);
  // ... auch in der Zelle einer Excel-Liste
  const r = parseCargoText("Bezeichnung\tStk\tMaße (LxBxH)\tkg\nKarton\t20\t60x40x40 max\t12");
  assert.deepStrictEqual([r.length, ...masse(r[0])], [1, 60, 40, 40]);
});

test("Portugiesisch: não empilhável, até, paletes, quilos, comprimento/largura/altura -- und der palete PBR", () => {
  // Die siebte Sprache der Oberflaeche (26.11.26). "Largura" ist die BREITE (wie franz. "largeur"),
  // nicht die spanische Laenge "largo".
  for (const t of ["9 caixas 250x80x30 não empilháveis", "9 caixas 250x80x30 nao empilhavel", "2 caixas 100x80x60 NÃO EMPILHAR", "8 tambores 60x60x90 não remontável"]) assert.strictEqual(eine(t).stackable, false, t);
  for (const t of ["18 paletes 120x80x110 empilháveis", "piano empilhável 150x60x110", "6 caixas 60x40x40, 12 kg"]) assert.strictEqual(eine(t).stackable, true, t);
  for (const t of ["18 paletes 120x80x110, 300 kg, empilhável até 180 cm", "18 paletes 120x80x110 máx. 180 cm", "18 paletes 120x80x110 até 1,8 m"]) {
    const r = eine(t);
    assert.deepStrictEqual([r.stackH, ...masse(r)], [180, 120, 80, 110], t);
    assert.ok(!/\d|at[eé]|m[aá]x|empilh/i.test(r.name), `${t}: der Name traegt Reste — "${r.name}"`);
  }
  for (const t of ["2 máquinas 320x145x168 não girar", "2 máquinas 320x145x168 sem girar"]) assert.strictEqual(eine(t).rotatable, false, t);
  for (const [t, qty] of [["Lote B: 12 caixas 100x80x60 300 quilos", 12], ["Pedido: 10 peças 60x40x40", 10], ["Pedido: 10 unidades 60x40x40", 10], ["Lote C: 7 volumes 60x40x40", 7]]) assert.strictEqual(eine(t).qty, qty, t);
  for (const [t, kg] of [["12 caixas 100x80x60 300 quilos", 300], ["12 caixas 100x80x60 300 quilogramas", 300], ["2 máquinas 320x145x168 2,4 toneladas", 2400]]) assert.strictEqual(eine(t).weight, kg, t);
  assert.deepStrictEqual(masse(eine("5 paletes 48x40x55 polegadas 1100 libras")), [121.92, 101.6, 139.7]);
  assert.strictEqual(eine("5 paletes 48x40x55 polegadas 1100 libras").weight, 498.951607);
  // Paletten ohne Masse: europeu = 120 x 80, industrial und PBR (Brasilien) = 120 x 100
  for (const [t, qty, l, w] of [["20 europaletes", 20, 120, 80], ["4 paletes europeus", 4, 120, 80], ["3 paletes industriais", 3, 120, 100], ["3 paletes PBR", 3, 120, 100], ["1 palete PBR", 1, 120, 100]]) {
    const r = eine(t); assert.deepStrictEqual([r.qty, r.l, r.w, r.h], [qty, l, w, 110], t);
  }
  assert.strictEqual(eine("4 paletes europeus 150 cm de altura 400 kg").h, 150);
  assert.deepStrictEqual(masse(eine("4 paletes 120x100")), [120, 100, 110]);
  // Beschriftete Masse und die Excel-Liste
  assert.deepStrictEqual(masse(eine("comprimento 320 largura 145 altura 168 1200 kg")), [320, 145, 168]);
  assert.deepStrictEqual(masse(eine("largura 145 comprimento 320 altura 168")), [320, 145, 168]);
  const liste = parseCargoText("Descrição\tQuantidade\tComprimento (cm)\tLargura (cm)\tAltura (cm)\tPeso (kg)\tEmpilhável\nCaixa de peças\t4\t120\t80\t100\t250\tnão\nBobina\t10\t60\t40\t40\t12\tsim");
  assert.deepStrictEqual(liste.map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable, r.name]), [[4, 120, 80, 100, 250, false, "Caixa de peças"], [10, 60, 40, 40, 12, true, "Bobina"]]);
  const kurz = parseCargoText("Produto\tQtd.\tCompr.\tLarg.\tAltura\tPeso total (kg)\nCaixas\t20\t60\t40\t40\t240");
  assert.deepStrictEqual(kurz.map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.name]), [[20, 60, 40, 40, 12, "Caixas"]]);
});

// ── Excel-Listen ────────────────────────────────────────────────────────────────────────────
const zeilen = (t) => parseCargoText(t).map((r) => [r.qty, r.l, r.w, r.h, r.weight, r.stackable, r.name]);

test("Excel-Liste: Kopfzeilen auf Spanisch, Franzoesisch, Niederlaendisch, Chinesisch", () => {
  const SOLL = [[4, 120, 80, 100, 250, false], [10, 60, 40, 40, 12, true]];
  for (const [sprache, t, namen] of [
    ["es", "Descripción\tCantidad\tLargo (cm)\tAncho (cm)\tAlto (cm)\tPeso (kg)\tApilable\nCaja de repuestos\t4\t120\t80\t100\t250\tno\nBobina\t10\t60\t40\t40\t12\tsí", ["Caja de repuestos", "Bobina"]],
    ["es", "Mercancía\tCant.\tLongitud\tAnchura\tAltura\tPeso bruto\tRemontable\nCaja\t4\t120\t80\t100\t250\tNo apilable\nBobina\t10\t60\t40\t40\t12\tSí", ["Caja", "Bobina"]],
    ["fr", "Désignation\tQuantité\tLongueur (cm)\tLargeur (cm)\tHauteur (cm)\tPoids (kg)\tGerbable\nCaisse\t4\t120\t80\t100\t250\tnon\nCarton\t10\t60\t40\t40\t12\toui", ["Caisse", "Carton"]],
    ["fr", "Désignation\tQté\tL\tl\tH\tPoids brut\tGerbable\nCaisse\t4\t120\t80\t100\t250\tnon gerbable\nCarton\t10\t60\t40\t40\t12\toui", ["Caisse", "Carton"]],
    ["nl", "Omschrijving\tAantal\tLengte (cm)\tBreedte (cm)\tHoogte (cm)\tGewicht (kg)\tStapelbaar\nKist\t4\t120\t80\t100\t250\tnee\nDoos\t10\t60\t40\t40\t12\tja", ["Kist", "Doos"]],
    ["zh", "品名\t数量\t长(cm)\t宽(cm)\t高(cm)\t毛重(kg)\t是否可堆叠\n木箱\t4\t120\t80\t100\t250\t否\n纸箱\t10\t60\t40\t40\t12\t是", ["木箱", "纸箱"]],
    ["de", "Bezeichnung\tAnzahl\tLänge\tBreite\tHöhe\tGewicht\tStapelbar\nKiste\t4\t120\t80\t100\t250\tnicht stapelbar\nKarton\t10\t60\t40\t40\t12\tja", ["Kiste", "Karton"]],
  ]) assert.deepStrictEqual(zeilen(t), SOLL.map((z, i) => [...z, namen[i]]), `${sprache}: ${t.split("\n")[0]}`);
});

test("Excel-Liste: Einheiten im Kopf, Gesamtgewicht, kombinierte Mass-Spalte", () => {
  // Millimeter, Zoll und Pfund als Wort der Sprache
  assert.deepStrictEqual(zeilen("Producto\tCantidad\tLargo (mm)\tAncho (mm)\tAlto (mm)\tPeso (kg)\nMotor\t2\t1200\t800\t900\t450"), [[2, 120, 80, 90, 450, true, "Motor"]]);
  assert.deepStrictEqual(zeilen("Producto\tCantidad\tLargo (pulgadas)\tAncho (pulgadas)\tAlto (pulgadas)\tPeso (libras)\nTarima\t9\t48\t40\t55\t1100"), [[9, 121.92, 101.6, 139.7, 498.951607, true, "Tarima"]]);
  assert.deepStrictEqual(zeilen("Désignation\tQuantité\tLongueur (mètres)\tLargeur (mètres)\tHauteur (mètres)\tPoids (tonnes)\nMachine\t1\t3,2\t1,45\t1,68\t2,4"), [[1, 320, 145, 168, 2400, true, "Machine"]]);
  // "Peso total" / "Poids total" / "Totaal gewicht" / "总重量" meinen die ganze Position
  for (const kopf of ["Peso total (kg)", "Poids total (kg)", "Totaal gewicht (kg)", "总重量(kg)", "Gesamtgewicht"]) {
    assert.deepStrictEqual(zeilen(`Nombre\tCantidad\tLargo\tAncho\tAlto\t${kopf}\nCajas\t20\t60\t40\t40\t240`)[0].slice(0, 5), [20, 60, 40, 40, 12], kopf);
  }
  // Eine Kopfzelle, die zwei der drei Kanten nennt, ist die kombinierte Mass-Spalte
  for (const kopf of ["Medidas (largo x ancho x alto)", "Largo x Ancho x Alto (cm)", "Länge x Breite x Höhe (cm)", "Length x Width x Height", "Longueur x largeur x hauteur", "Dimensiones", "Afmetingen (LxBxH)", "尺寸(cm)"]) {
    assert.deepStrictEqual(zeilen(`Nombre\tBultos\t${kopf}\tPeso\nCajas\t20\t60x40x40\t12`), [[20, 60, 40, 40, 12, true, "Cajas"]], kopf);
  }
});

test("Excel-Liste: ein Wort, zwei Sprachen -- \"Nombre\" ist der spanische Name, nicht die franzoesische Anzahl", () => {
  // Spanisch: Nombre (de producto) = Name
  assert.deepStrictEqual(zeilen("Nombre de producto\tNº de bultos\tLargo\tAncho\tAlto\tPeso\nMotor\t2\t120\t80\t90\t450"), [[2, 120, 80, 90, 450, true, "Motor"]]);
  assert.deepStrictEqual(zeilen("Nombre\tCantidad\tLargo\tAncho\tAlto\tPeso\nMotor\t2\t120\t80\t90\t450"), [[2, 120, 80, 90, 450, true, "Motor"]]);
  // Franzoesisch: Nombre de colis = Anzahl
  assert.deepStrictEqual(zeilen("Désignation\tNombre de colis\tLongueur\tLargeur\tHauteur\tPoids\nCarton\t20\t60\t40\t40\t12"), [[20, 60, 40, 40, 12, true, "Carton"]]);
  // "Descripción de los bultos" ist die Beschreibung, nicht die Stueckzahl
  assert.deepStrictEqual(zeilen("Descripción de los bultos\tCantidad\tLargo\tAncho\tAlto\tPeso\nCaja\t3\t100\t80\t60\t50"), [[3, 100, 80, 60, 50, true, "Caja"]]);
  // Eine Spalte "Reference" nimmt der Beschreibung nicht den Namen weg (deshalb steht das Wort nicht im Register)
  assert.deepStrictEqual(zeilen("Reference\tDescription\tQty\tLength\tWidth\tHeight\tWeight\nPO-1\tPump\t2\t100\t80\t60\t150"), [[2, 100, 80, 60, 150, true, "Pump"]]);
  assert.deepStrictEqual(zeilen("Referencia\tDescripción\tCantidad\tLargo\tAncho\tAlto\tPeso\nPO-1\tBomba\t2\t100\t80\t60\t150"), [[2, 100, 80, 60, 150, true, "Bomba"]]);
});

// ── Was die Seiten als Beispiel zeigen, liest der Rechner auch ──────────────────────────────
const SPRACHEN = ["de", "en", ...fs.readdirSync(path.join(dir, "..", "sprache")).filter((f) => /^[a-z]{2}\.js$/.test(f)).map((f) => f.slice(0, 2)).sort()];

test("die Beispiel-Liste jeder Startseite kommt im Rechner an (Beispiel einfuegen -> Im Rechner oeffnen)", () => {
  // Die Startseite reicht den Text nur durch (/app?q=...): gelesen wird er hier. Bis 26.11.26
  // kam die spanische, die franzoesische und die chinesische Liste als "nichts erkannt" an.
  const index = lese("index.html");
  const liste = { de: new Function("return " + /impTa\.value = SEITE!=='de' \? EN\.imp_demo_data : ('(?:[^'\\]|\\.)*');/.exec(index)[1])() };
  for (const k of SPRACHEN.filter((x) => x !== "de")) {
    const seite = lese(`${k}/index.html`);
    const EN = JSON.parse(/var EN=(\{.*?\});\n/s.exec(seite)[1]);
    liste[k] = EN.imp_demo_data;
    assert.ok(seite.includes("window.location.href='/app?q='+enc+(SEITE==='de'?'':'&lang='+SEITE)"), `${k}: die Startseite reicht die Liste nicht mehr an den Rechner durch`);
  }
  assert.ok(SPRACHEN.length >= 6);
  for (const k of SPRACHEN) {
    const r = parseCargoText(liste[k]);
    assert.deepStrictEqual(r.map((x) => [x.qty, x.l, x.w, x.h, x.weight]), [[4, 120, 80, 95, 310], [6, 110, 75, 80, 240], [18, 60, 40, 40, 12]], `${k}: die Beispiel-Liste der Startseite — ${JSON.stringify(liste[k].split("\n")[0])}`);
    for (const x of r) assert.ok(x.name && x.name !== "Position" && !/^\d/.test(x.name), `${k}: Name fehlt — "${x.name}"`);
  }
});

test("die Beispiele im Import-Fenster liest auch der lokale Parser -- samt Hoehengrenze", () => {
  // Der Platzhalter verspricht eine Schreibweise. Faellt die KI aus, liest der lokale Parser
  // genau diese Zeilen -- "apilable hasta 180 cm" ging vorher verloren und stand im Namen.
  const ph = { de: /impPh: ("z\. B\.(?:[^"\\]|\\.)*")/.exec(app)[1], en: /impPh: ("e\.g\.(?:[^"\\]|\\.)*")/.exec(app)[1] };
  for (const k of SPRACHEN.filter((x) => x !== "de" && x !== "en")) ph[k] = /impPh: ("(?:[^"\\]|\\.)*")/.exec(lese(`sprache/${k}.js`))[1];
  for (const k of SPRACHEN) {
    const z = new Function("return " + ph[k])().split("\n");
    assert.strictEqual(z.length, 4, `${k}: der Platzhalter hat nicht mehr Einleitung, zwei Beispiele und den Excel-Hinweis`);
    const a = eine(z[1]), b = eine(z[2]);
    assert.deepStrictEqual([a.qty, a.l, a.w, a.h, a.weight, a.stackable, a.stackH], [18, 120, 80, 110, 300, true, 180], `${k}: ${z[1]}`);
    assert.deepStrictEqual([b.qty, b.l, b.w, b.h, b.weight, b.stackable, b.stackH], [6, 60, 40, 40, 12, true, null], `${k}: ${z[2]}`);
    for (const r of [a, b]) assert.ok(r.name.length <= 12 && !/[\d,，]/.test(r.name), `${k}: der Name traegt Reste — "${r.name}"`);
    // Der Text der ganzen Zeilen zusammen (mit ; getrennt) ergibt dieselben zwei Positionen
    assert.strictEqual(parseCargoText(z[1] + "\n" + z[2]).length, 2);
  }
});

// ── Deutsch und Englisch lesen wie vorher ───────────────────────────────────────────────────
test("Deutsch und Englisch: 39 Eingaben lesen genau wie vor dem Umbau", () => {
  // Aufgenommen mit dem Parser VOR den neuen Sprachen (Stand main, 26.11.26) -- nur Eingaben,
  // die alt und neu gleich lesen. Wer hier etwas aendert, aendert, was deutsche und englische
  // Nutzer seit jeher bekommen.
  // EINE Eingabe ist seit 28.11.26 bewusst nachgezogen: "10 boxes ... not stackable" hiess
  // vorher "Boxes not" (ein Rest der Verneinung im Namen) -- jetzt "Boxes". Sonst unveraendert.
  const alt = JSON.parse(lese("test/daten/import-de-en.json"));
  assert.strictEqual(alt.length, 39);
  for (const [t, soll] of alt) assert.deepStrictEqual(parseCargoText(t), soll, JSON.stringify(t).slice(0, 80));
});

test("die Regeln des Wort-Registers: kein Wort mit zwei Bedeutungen, kein Lookbehind", () => {
  const neu = IMPORT_WORT.stkNeu + "|" + IMPORT_WORT.wareNeu;
  // Regel 1: niederl. "dozen" (Kartons) ist engl. das Dutzend; "high" steht in "high cube";
  // "tons" koennen short tons sein; span./franz. "nombre" hat zwei Bedeutungen.
  for (const w of ["dozen", "high", "tons?", "nombre", "elk"]) assert.ok(!new RegExp(`(^|\\|)${w.replace("?", "\\?")}(\\||$)`).test(neu + "|" + IMPORT_WORT.gewicht), `"${w}" steht im Register`);
  assert.ok(!/high/.test(L.slice(von, bis).join("\n").match(/const hm = line\.match\((.*)\);/)[1]), "\"high\" als Hoehen-Wort: \"40 high cube\" waere eine Hoehe");
  assert.ok(!/referencia|r\[eé\]f\[eé\]rence|\barticle\b/.test(L.slice(von, bis).join("\n").match(/\["name", (\/.*\/i)\]/)[1]), "Artikelnummer-Spalten als Name");
  // Regel 2: die neuen Zaehlwoerter enden am Wortende, die Verneinungen beginnen an einem
  assert.ok(app.includes('var W = IMPORT_WORT, ende = "(?![a-zà-ÿ])";'));
  for (const q of ["no\\s+(?:son", "(?:non|pas)[-\\s]?(?:gerb", "niet[-\\s]?stapel"]) assert.ok(IMPORT_WORT.nichtStapelbar.source.includes("\\b" + q), `Verneinung ohne Wortgrenze: ${q}`);
  // Regel 3: aeltere Safari-Fassungen kennen kein Lookbehind -- die ganze Seite bliebe stehen
  assert.ok(!/\(\?<[=!]/.test(app), "Lookbehind in app.html");
  // Die Stapel-Regel der Zeile und die der Excel-Zelle sind dieselbe
  assert.strictEqual((app.match(/IMPORT_WORT\.nichtStapelbar\.test\(/g) || []).length, 2);
});

// ── Englische Verneinungen: der Name bleibt sauber, und "unstackable" heisst nicht stapelbar ──
// Gefunden am 28.11.26 beim ersten Aufruf ueber den MCP-Anschluss: "22 pallets ... not stackable"
// (genau die Schreibweise, die Werkzeug-Beschreibung, /llms.txt und die Link-Format-Seiten
// empfehlen) kam als Position "Pallets not" an -- gelesen wurde richtig, aber vom "not stackable"
// blieb das "not" im Namen stehen (die Namens-Reinigung kannte nur "non-stackable"). Und
// "unstackable" wurde als STAPELBAR gelesen. Der Schnappschuss oben hielt "Boxes not" sogar fest.
test("Englisch: 'not stackable', 'unstackable', 'do not stack', 'not rotatable' -- gelesen UND aus dem Namen geraeumt", () => {
  const eins = (t) => { const r = parseCargoText(t); assert.strictEqual(r.length, 1, t); return r[0]; };
  const nichtStapelbar = [
    "22 pallets 120x80x100 300kg not stackable", "22 pallets 120x80x100 300kg, not stackable", "22 pallets not stackable 120x80x100 300kg",
    "22 pallets 120x80x100 300kg non-stackable", "22 pallets 120x80x100 300kg non stackable", "22 pallets 120x80x100 300kg unstackable",
    "22 pallets 120x80x100 300kg do not stack", "22 pallets 120x80x100 300kg don't stack", "22 pallets 120x80x100 300kg no stacking",
  ];
  for (const t of nichtStapelbar) {
    const r = eins(t);
    assert.deepStrictEqual([r.qty, r.l, r.w, r.h, r.weight, r.stackable, r.name], [22, 120, 80, 100, 300, false, "Pallets"], t);
  }
  // Stapelbar bleibt stapelbar -- auch mit Hoehengrenze; der Name ist derselbe.
  for (const [t, bis] of [["22 pallets 120x80x100 300kg stackable", null], ["22 pallets 120x80x100 300kg stackable up to 180 cm", 180], ["22 pallets 120x80x100 300kg", null]]) {
    const r = eins(t);
    assert.deepStrictEqual([r.stackable, r.stackH, r.name], [true, bis, "Pallets"], t);
  }
  // Nicht drehbar: gelesen und aus dem Namen geraeumt.
  for (const t of ["8 crates 200x100x150 900kg not rotatable", "8 crates 200x100x150 900kg non-rotatable", "8 crates 200x100x150 900kg no rotation"]) {
    const r = eins(t);
    assert.deepStrictEqual([r.qty, r.rotatable, r.stackable, r.name], [8, false, true, "Crates"], t);
  }
  // Woerter, die nur so anfangen, bleiben, was sie sind (Regel 2: Verneinungen beginnen an einer Wortgrenze).
  for (const [t, name] of [["12 knots 60x40x40 12kg", "Knots"], ["3 Notstromaggregate 200x100x150 900kg", "Notstromaggregate"], ["4 sun loungers 190x60x30 14kg", "sun loungers"], ["6 nonwoven rolls 150x40x40 20kg", "nonwoven Rolls"]]) {
    const r = eins(t);
    assert.strictEqual(r.stackable, true, t);
    assert.strictEqual(r.name.toLowerCase(), name.toLowerCase(), t);
  }
  // Das Beispiel der Werkzeug-Beschreibung (MCP) liest sich sauber: zwei Positionen, keine Reste.
  const bsp = parseCargoText("22 pallets 120x80x100 300kg not stackable; 6 boxes 60x40x40 12kg");
  assert.deepStrictEqual(bsp.map((r) => [r.qty, r.name, r.stackable]), [[22, "Pallets", false], [6, "Boxes", true]]);
});
