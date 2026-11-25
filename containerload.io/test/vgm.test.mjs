// Die VGM-Meldung (seit 23.11.26): aus "Verladen melden" wird die Erklaerung fuer die Reederei --
// Container- und Siegel-Nr., Bruttomasse nach Methode 1 oder 2 -- als echte PDF-Datei.
//
// Was hier festgehalten wird:
//   * die Rechnung (Methode 2 = Tara + Ladung + Verpackung, Methode 1 = die gewogene Zahl)
//   * was ein Dokument braucht, bevor es entsteht (kein halbes amtlich aussehendes Papier)
//   * die PDF selbst: gueltiger Aufbau (jeder Sprung der xref-Tabelle trifft sein Objekt, jede
//     /Length stimmt), reines ASCII, der Text ist auslesbar, Umlaute stimmen
//   * die Ehrlichkeitslinie im Quelltext: die Tara wird NIE vorbelegt, das Plangewicht ist als
//     Vorbelegung gekennzeichnet, die Fusszeile des Dokuments sagt, von wem die Zahlen stammen
//   * die Meldung im Link (&ok=): VGM-Felder reisen mit, werden beim Lesen neu aufgebaut
//   * Kopfleiste, Menue, Datenschutz
//
// node --test test/vgm.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const zwischen = (a, b) => {
  const i = roh.indexOf(a), j = roh.indexOf(b, i + 1);
  assert.ok(i > 0 && j > i, `Ausschnitt ${a} … ${b} nicht gefunden`);
  return roh.slice(i, j);
};
const M = new Function(zwischen("// VGM_START", "// VGM_END")
  + "\nreturn { vgmRechnen, vgmPruefen, vgmPdf, vgmDateiname, pdfBytes, pdfBreite, pdfUmbruch, pdfBauen, pdfSeite, VGM_TXT, VGM_JE_SEITE };")();
const LINK = new Function(zwischen("  var vmSauber = ", "  var URL_VM = vmLesen") + "\nreturn { vmPacken, vmLesen };")();

const erstellt = new Date(2026, 10, 23, 14, 26);
const cont = (o = {}) => ({ marke: "C1", typ: "40' HC", nr: "MSKU1234565", sg: "ML-0456789", ...M.vgmRechnen({ ta: 3900, ld: 20000, vp: 350 }, 2), ...o });
const dok = (o = {}) => ({ sprache: "de", methode: 2, verlader: "Müller & Söhne GmbH", person: "Jarek Polep", ort: "Bremen", buchung: "HLCUBRE261100123", datum: "2026-11-23", notiz: "", erstellt, container: [cont()], ...o });
const text = (bytes) => Buffer.from(bytes).toString("latin1");

test("Methode 2 rechnet Tara + Ladung + Verpackung, Methode 1 nimmt die gewogene Zahl", () => {
  assert.deepStrictEqual(M.vgmRechnen({ ta: "3900", ld: "20000", vp: "350" }, 2), { vgm: 24250, fehlt: [], ta: 3900, ld: 20000, vp: 350 });
  // Verpackung ist freiwillig, Tara und Ladung nicht -- ohne sie gibt es KEINE Bruttomasse
  assert.strictEqual(M.vgmRechnen({ ta: "3900", ld: "20000" }, 2).vgm, 23900);
  assert.deepStrictEqual(M.vgmRechnen({ ld: "20000", vp: "350" }, 2).fehlt, ["ta"]);
  assert.strictEqual(M.vgmRechnen({ ld: "20000", vp: "350" }, 2).vgm, 0, "ohne Tara keine Zahl -- eine halbe Summe saehe aus wie ein Ergebnis");
  assert.deepStrictEqual(M.vgmRechnen({ ta: "3900" }, 2).fehlt, ["ld"]);
  assert.deepStrictEqual(M.vgmRechnen({}, 2).fehlt, ["ta", "ld"]);
  // Methode 1: die Einzelwerte spielen keine Rolle
  assert.deepStrictEqual(M.vgmRechnen({ br: "24180", ta: "1", ld: "2" }, 1), { vgm: 24180, fehlt: [] });
  assert.deepStrictEqual(M.vgmRechnen({ ta: "3900", ld: "20000" }, 1), { vgm: 0, fehlt: ["br"] });
  // Eingaben: Komma als Dezimalzeichen, Unsinn und Negatives zaehlen nicht
  assert.strictEqual(M.vgmRechnen({ ta: "3900,4", ld: "20000,4" }, 2).vgm, 23901);
  for (const quatsch of ["abc", "-5", "", null, undefined, "0"]) assert.strictEqual(M.vgmRechnen({ br: quatsch }, 1).vgm, 0, `"${quatsch}"`);
});

test("ein unvollstaendiges Dokument gibt es nicht: vgmPruefen nennt, was fehlt", () => {
  assert.deepStrictEqual(M.vgmPruefen(dok()), []);
  assert.deepStrictEqual(M.vgmPruefen(dok({ verlader: "  ", person: "" })), [{ was: "verlader" }, { was: "person" }]);
  assert.deepStrictEqual(M.vgmPruefen(dok({ container: [cont({ nr: "" }), cont({ marke: "C2", vgm: 0 })] })), [{ was: "nr", marke: "C1" }, { was: "vgm", marke: "C2" }]);
  assert.deepStrictEqual(M.vgmPruefen(dok({ container: [] })), [{ was: "container" }]);
  assert.deepStrictEqual(M.vgmPruefen(null), [{ was: "container" }]);
  // Und der Rechner haelt sich daran: ohne vollstaendige Angaben keine Datei
  const datei = zwischen("const vgmDatei = () => {", "const vgmLaden = ");
  assert.match(datei, /if \(vgmPruefen\(d\)\.length\) return null;/);
  assert.ok(zwischen("const vgmLaden = () => {", "const vgmDateiTeilen").includes("if (!f) { setToast(T.vgmFehltKurz); return; }"));
});

test("Schrift: WinAnsi-Kodierung, Rueckfall auf den Grundbuchstaben, Breiten aus den Metriken", () => {
  assert.deepStrictEqual(M.pdfBytes("Aä€–ß"), [65, 228, 128, 150, 223]);
  assert.strictEqual(Buffer.from(M.pdfBytes("Nguyễn Văn Đức · Łódź")).toString("latin1"), "Nguyen Van Duc · Lódz");
  assert.deepStrictEqual(M.pdfBytes("a\nb\tc"), [97, 32, 98, 32, 99], "Steuerzeichen werden Leerzeichen");
  assert.deepStrictEqual(M.pdfBytes("漢😀"), [63, 63], "was die Standardschrift nicht kann, wird ein Fragezeichen");
  // Helvetica: Ziffern 556, Leerzeichen 278; fett "A" 722 (Tausendstel der Schriftgroesse)
  assert.ok(Math.abs(M.pdfBreite("0000", 10, false) - 22.24) < 1e-9);
  assert.ok(Math.abs(M.pdfBreite("A A", 10, true) - (722 + 278 + 722) / 100) < 1e-9);
  assert.ok(M.pdfBreite("Größe", 12, false) > M.pdfBreite("Gre", 12, false), "Umlaute haben eine Breite");
  // Umbruch: keine Zeile breiter als verlangt, kein Wort geht verloren
  const satz = "Alle Packstücke einschließlich Paletten, Stau- und Sicherungsmaterial wurden einzeln gewogen; dazu die Tara des Containers.";
  const zeilen = M.pdfUmbruch(satz, 9.5, false, 200);
  assert.ok(zeilen.length >= 3 && zeilen.every((z) => M.pdfBreite(z, 9.5, false) <= 200));
  assert.strictEqual(zeilen.join(" "), satz);
});

// Die Datei so pruefen, wie ein PDF-Betrachter sie liest: ueber die Sprungtabelle
const pruefePdf = (bytes) => {
  const s = text(bytes);
  assert.ok(bytes.every((b) => b < 128), "die Datei ist nicht reines ASCII -- dann stimmen die Spruenge nicht");
  assert.ok(s.startsWith("%PDF-1.4\n") && s.endsWith("%%EOF\n"));
  const xref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)[1]);
  assert.strictEqual(s.slice(xref, xref + 5), "xref\n", "startxref zeigt nicht auf die Tabelle");
  const kopf = /^xref\n0 (\d+)\n/.exec(s.slice(xref));
  const n = Number(kopf[1]);
  const zeilen = s.slice(xref + kopf[0].length).split("\n").slice(0, n);
  assert.strictEqual(zeilen[0], "0000000000 65535 f ");
  for (let i = 1; i < n; i++) {
    const off = Number(zeilen[i].slice(0, 10));
    assert.ok(s.startsWith(`${i} 0 obj\n`, off), `Objekt ${i}: der Sprung ${off} trifft nicht`);
  }
  // Jede Laengenangabe eines Inhaltsstroms stimmt
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.strictEqual(m[2].length, Number(m[1]), "/Length passt nicht zum Strom");
  assert.match(s, /\/Root 1 0 R/);
  return { s, seiten: Number(/\/Type \/Pages [^>]*\/Count (\d+)/.exec(s)[1]) };
};

test("die PDF: gueltiger Aufbau, auslesbarer Text, die Zahlen des Formulars", () => {
  const { s, seiten } = pruefePdf(M.vgmPdf(dok({ container: [cont(), cont({ marke: "C2", typ: "20' GP", nr: "csqu3054383", sg: "", ...M.vgmRechnen({ ta: 2280, ld: 11264 }, 2) })] })));
  assert.strictEqual(seiten, 1);
  for (const t of ["(VGM-Erkl\\344rung)", "(MSKU 123456 5)", "(CSQU 305438 3)", "(24.250)", "(13.544)", "(37.794)", "(3.900)", "(20.000)", "(350)", "(ML-0456789)", "(M\\374ller & S\\366hne GmbH)", "(HLCUBRE261100123)", "(23.11.2026)", "(JAREK POLEP)", "(Bremen, 23.11.2026)"]) {
    assert.ok(s.includes(t), `im Dokument fehlt ${t}`);
  }
  assert.ok(s.includes("/BaseFont /Helvetica /Encoding /WinAnsiEncoding") && s.includes("/BaseFont /Helvetica-Bold"));
  // Die Fusszeile sagt, von wem die Zahlen stammen -- in beiden Sprachen
  assert.match(M.VGM_TXT.de.fuss, /Alle Angaben stammen vom Verlader .* ContainerLoad wiegt nicht und prüft die Gewichte nicht/);
  assert.match(M.VGM_TXT.en.fuss, /provided by the shipper .* does not weigh and does not verify/);
  assert.ok(s.includes("wiegt nicht und pr\\374ft die Gewichte nicht"));
  assert.ok(s.includes("(Erstellt mit ContainerLoad \\267 containerload.io)"), "die Herkunftszeile im Fuss fehlt");
  // Nur die GEWAEHLTE Methode steht im Dokument -- keine zweite, ausgegraute daneben
  assert.ok(s.includes("(Methode 2)") && !s.includes("(Methode 1)"));
  assert.match(M.VGM_TXT.de.erkl, /nach der oben genannten Methode/);
  assert.match(M.VGM_TXT.en.erkl, /by the method stated above/);
  // Klammern und Rueckstriche in Eingaben zerbrechen die Datei nicht
  pruefePdf(M.vgmPdf(dok({ verlader: "A (B) \\ C", notiz: "Zeile 1\nZeile (2)" })));
});

test("Methode 1 und Englisch: andere Spalten, andere Sprache, dieselbe Datei-Sorgfalt", () => {
  const d = dok({ sprache: "en", methode: 1, container: [cont({ ...M.vgmRechnen({ br: 24180 }, 1), ta: 0, ld: 0, vp: 0 })] });
  const { s } = pruefePdf(M.vgmPdf(d));
  for (const t of ["(VGM Declaration)", "(24,180)", "(2026-11-23)", "(Shipper)", "(Method 1)", "(JAREK POLEP)", "(VGM kg)"]) assert.ok(s.includes(t), `fehlt ${t}`);
  assert.ok(!/\((Tare|Cargo|Packing)\b/i.test(s), "bei Methode 1 gibt es keine Einzelgewichts-Spalten");
  assert.ok(!s.includes("(Method 2)"), "die nicht gewaehlte Methode steht nicht im Dokument");
  assert.ok(!s.includes("Erkl\\344rung"), "deutscher Text im englischen Dokument");
  // Beide Sprachen tragen dieselben Textschluessel
  assert.deepStrictEqual(Object.keys(M.VGM_TXT.en).sort(), Object.keys(M.VGM_TXT.de).sort());
  assert.strictEqual(M.VGM_TXT.de.sp.length, 8);
  assert.strictEqual(M.VGM_TXT.en.sp.length, 8);
});

test("viele Container: mehrere Seiten, Unterschrift nur auf der letzten", () => {
  const n = M.VGM_JE_SEITE + 3;
  const { s, seiten } = pruefePdf(M.vgmPdf(dok({ container: Array.from({ length: n }, (_, i) => cont({ marke: "C" + (i + 1) })) })));
  assert.strictEqual(seiten, 2);
  assert.strictEqual(s.split("(JAREK POLEP)").length - 1, 1, "die Unterschrift steht nicht genau einmal da");
  assert.ok(s.includes("(Seite 1 / 2)") && s.includes("(Seite 2 / 2)"));
  assert.ok(s.includes(`(${(24250 * n).toLocaleString("de-DE")})`), "die Summe ueber alle Container fehlt");
});

// Die Seiten einzeln, mit den Grundlinien aller Textzeilen (in Punkt von OBEN gemessen)
const seitenVon = (bytes) => [...text(bytes).matchAll(/<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g)].map((m) => ({
  strom: m[1],
  zeilen: [...m[1].matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm \(((?:\\.|[^\\)])*)\) Tj/g)].map((t) => ({ y: 841.89 - Number(t[1]), t: t[2] }))
}));

test("das Blatt ist ruhig: Markenzeichen ohne Grund, keine Flaechen, nur zwei Linienfarben", () => {
  for (const d of [dok(), dok({ sprache: "en", methode: 1, container: [cont({ ...M.vgmRechnen({ br: 24180 }, 1) })] })]) {
    for (const { strom } of seitenVon(M.vgmPdf(d))) {
      assert.ok(!/ re f/.test(strom), "gefuelltes Rechteck im Dokument -- das Markenzeichen steht frei, die Tabelle hat kein Band");
      // Der Wuerfel: genau drei gefuellte Vielecke in den drei Flaechentoenen der Marke
      const flaechen = [...strom.matchAll(/^([\d.]+ [\d.]+ [\d.]+) rg [^\n]* h f$/gm)].map((m) => m[1]);
      assert.deepStrictEqual(flaechen, ["0.04 0.17 0.27", "0.09 0.34 0.5", "0.06 0.24 0.38"]);
      // Linien: Tinte (Tabelle, Unterschrift) und die Haarlinie -- sonst nichts
      const linien = new Set([...strom.matchAll(/([\d.]+ [\d.]+ [\d.]+) RG/g)].map((m) => m[1]));
      for (const l of linien) assert.ok(["0.06 0.08 0.11", "0.85 0.87 0.9"].includes(l), "fremde Linienfarbe " + l);
    }
  }
});

test("der Schluss laeuft nie in den Fuss -- egal wie viele Container und wie lang die Bemerkung", () => {
  const lang = "Zwei Kartons an der Ecke eingedrückt, Fotos folgen per Mail. ".repeat(12);
  for (const notiz of ["", lang]) for (const methode of [1, 2]) for (let n = 1; n <= 40; n++) {
    const d = dok({ notiz, methode, container: Array.from({ length: n }, (_, i) => cont({ marke: "C" + (i + 1) })) });
    const seiten = seitenVon(M.vgmPdf(d));
    let zeilen = 0;
    seiten.forEach(({ zeilen: zl }, si) => {
      const inhalt = zl.filter((z) => z.y < 790);
      const tiefste = Math.max(...inhalt.map((z) => z.y));
      assert.ok(tiefste <= 772, `${n} Container, Methode ${methode}, Seite ${si + 1}: Text bei ${tiefste.toFixed(1)} pt liegt im Fuss`);
      assert.strictEqual(zl.filter((z) => z.y >= 790).length, 3, "im Fuss stehen genau drei Zeilen (Herkunft der Zahlen, Erstellt mit, Seite)");
      zeilen += zl.filter((z) => /^C\d+$/.test(z.t)).length;
    });
    assert.strictEqual(zeilen, n, `${n} Container: es stehen ${zeilen} Zeilen im Dokument`);
    // Unterschrieben wird genau einmal, auf der letzten Seite -- und die traegt immer Container
    const mitName = seiten.map(({ zeilen: zl }) => zl.some((z) => z.t === "JAREK POLEP"));
    assert.deepStrictEqual(mitName, seiten.map((_, i) => i === seiten.length - 1));
    assert.ok(seiten[seiten.length - 1].zeilen.some((z) => /^C\d+$/.test(z.t)), "die Unterschriftsseite traegt keinen Container");
  }
});

test("zu lange Eintraege werden kleiner oder zweizeilig gesetzt -- nie abgeschnitten, nie in die Nachbarspalte", () => {
  const siegel = "SIEGEL-1234567890-ABCDEFGH/XYZ", name = "Maximilian Alexander von Hohenstein-Schwarzenberg der Jüngere";
  const firma = "Internationale Maschinen- und Anlagenbau Verwaltungsgesellschaft Bremen-Nord mbH";
  const d = dok({ person: name, verlader: firma, container: [cont({ sg: siegel, typ: "40' Flat Rack" })] });
  const { strom } = seitenVon(M.vgmPdf(d))[0];
  const ops = [...strom.matchAll(/BT \/(F[12]) ([\d.]+) Tf [\d. ]+ rg [\d.]+ Tc 1 0 0 1 ([\d.]+) ([\d.]+) Tm \(((?:\\.|[^\\)])*)\) Tj ET/g)]
    .map((m) => ({ fett: m[1] === "F2", size: +m[2], x: +m[3], y: 841.89 - m[4], t: m[5].replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8))).replace(/\\(.)/g, "$1") }));
  const breit = (o) => M.pdfBreite(o.t, o.size, o.fett);
  // Siegel: Spalte beginnt bei 48 + 180 und ist 82 pt breit -- zwei Zeilen, zusammen die ganze Nummer
  const sg = ops.filter((o) => Math.abs(o.x - 228) < 0.01 && o.y > 290 && o.y < 320);
  assert.strictEqual(sg.length, 2, "das lange Siegel steht nicht zweizeilig da");
  assert.strictEqual(sg.map((o) => o.t).join(""), siegel);
  for (const o of sg) assert.ok(breit(o) <= 82 + 1e-6, `Siegelzeile "${o.t}" ist ${breit(o).toFixed(1)} pt breit`);
  // Bauart: kleiner gesetzt, eine Zeile, in der Spalte (52 pt)
  const typ = ops.find((o) => o.t === "40' Flat Rack");
  assert.ok(typ && typ.size < 10 && breit(typ) <= 52 + 1e-6);
  // Die normale Container-Nr. bleibt in voller Groesse
  assert.strictEqual(ops.find((o) => o.t === "MSKU 123456 5").size, 10.5);
  // Der Name ueber der Unterschriftslinie: ganz da, nicht breiter als die Linie
  const linie = (499.28 / 2) - 24;
  const nm = ops.filter((o) => o.y > 400 && name.toUpperCase().includes(o.t) && o.t.length > 5);
  assert.strictEqual(nm.map((o) => o.t).join(" "), name.toUpperCase());
  for (const o of nm) assert.ok(breit(o) <= linie + 1e-6, "der Name ragt ueber die Linie");
  // Der Firmenname im Kopf: hoechstens zwei Zeilen, aber vollstaendig
  const fa = ops.filter((o) => o.y < 210 && Math.abs(o.x - 48) < 0.01 && firma.includes(o.t) && o.t.length > 5);
  assert.ok(fa.length <= 2 && fa.map((o) => o.t).join(" ") === firma, "der Firmenname ist gekappt: " + fa.map((o) => o.t).join(" | "));
  // Eine sehr lange Bemerkung wird gekappt -- dann aber sichtbar, mit Auslassungspunkten
  const viele = Array.from({ length: 20 }, (_, i) => "Zeile " + (i + 1)).join("\n");
  const s2 = text(M.vgmPdf(dok({ notiz: viele })));
  assert.ok(s2.includes("(Zeile 8 \\205)") && !s2.includes("(Zeile 9)"), "die gekappte Bemerkung zeigt keine Auslassungspunkte");
});

test("Dateiname: Container-Nr. und Datum, bei mehreren die Anzahl dazu", () => {
  assert.strictEqual(M.vgmDateiname(dok()), "VGM-MSKU1234565-261123.pdf");
  assert.strictEqual(M.vgmDateiname(dok({ container: [cont({ nr: "msku 123456 5" }), cont(), cont()] })), "VGM-MSKU1234565-plus2-261123.pdf");
  assert.strictEqual(M.vgmDateiname(dok({ container: [cont({ nr: "" })] })), "VGM-container-261123.pdf");
});

test("die Meldung im Link traegt die VGM-Angaben -- und baut sie beim Lesen neu auf", () => {
  const roh2 = LINK.vmPacken({ t: 1762300000000, n: "", me: 2, ab: "Müller & Söhne GmbH", ps: "Jarek Polep", or: "Bremen", bk: "HLCUBRE261100123", wd: "2026-11-23",
    c: [{ m: "C1", ty: "40' HC", nr: "MSKU1234565", sg: "ML-1", h: 3, s: 3, g: 24250, ta: 3900, ld: 20000, vp: 350 }, { m: "C2", ty: "20' GP", nr: "", sg: "", h: 0, s: 2 }] });
  const m = LINK.vmLesen(roh2);
  assert.deepStrictEqual(m.c[0], { m: "C1", ty: "40' HC", nr: "MSKU1234565", sg: "ML-1", h: 3, s: 3, g: 24250, ta: 3900, ld: 20000, vp: 350 });
  assert.deepStrictEqual(m.c[1], { m: "C2", ty: "20' GP", nr: "", sg: "", h: 0, s: 2 }, "ein Container ohne Gewicht bleibt ohne VGM-Felder");
  assert.deepStrictEqual([m.me, m.ab, m.ps, m.or, m.bk, m.wd], [2, "Müller & Söhne GmbH", "Jarek Polep", "Bremen", "HLCUBRE261100123", "2026-11-23"]);
  // Von aussen: Unsinn faellt weg, Markup auch, Zahlen bleiben in Grenzen
  const b64 = (o) => Buffer.from(JSON.stringify(o), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b = LINK.vmLesen(b64({ v: 1, t: 1762300000000, me: 7, ab: "<img src=x onerror=1>Firma", ps: "x".repeat(200), wd: "gestern", bk: "\u0007B1",
    c: [{ m: "C1", ty: "40' HC", nr: "MSKU1234565", sg: "", h: 1, s: 1, g: 5e7, ta: -3, ld: "abc" }, { m: "C2", ty: "x", nr: "", sg: "", h: 0, s: 0, ta: 3900, ld: 100 }] }));
  assert.strictEqual(b.me, undefined, "nur Methode 1 oder 2");
  assert.ok(!/[<>]/.test(b.ab) && b.ab.endsWith("Firma"));
  assert.strictEqual(b.ps.length, 60);
  assert.strictEqual(b.wd, undefined);
  assert.strictEqual(b.bk, "B1");
  assert.deepStrictEqual(Object.keys(b.c[0]).sort(), ["h", "m", "nr", "s", "sg", "ty"], "eine unplausible Bruttomasse (50.000 t) faellt samt Einzelwerten weg");
  assert.deepStrictEqual(Object.keys(b.c[1]).sort(), ["h", "m", "nr", "s", "sg", "ty"], "Einzelwerte ohne Bruttomasse reisen nicht");
  // Der Rechner schickt die VGM-Felder nur, wenn es Gewichte gibt
  const sende = zwischen("const vmLink = () => {", "const vmTitel = ");
  assert.match(sende, /"&ok=" \+ vmPacken\(/);
  assert.match(sende, /\.\.\.\(mitVgm \? \{ me: /);
  assert.match(sende, /\.\.\.\(vg\[i2\] && vg\[i2\]\.vgm > 0 \? \{ g: vg\[i2\]\.vgm/);
});

test("Ehrlichkeit im Formular: die Tara wird nie vorbelegt, das Plangewicht ist gekennzeichnet", () => {
  // Die Tara steht auf der Containertuer. Der typische Wert des Typs erscheint nur als
  // PLATZHALTER -- der Wert des Feldes kommt allein aus dem, was der Mensch getippt hat.
  assert.ok(roh.includes('kgFeld(T.vgmTara, "ta", i2, rampeVm.ta[i2] || "", k.taraTyp ? String(k.taraTyp) : "")'), "die Tara ist vorbelegt oder ihr Platzhalter fehlt");
  const slot = zwischen("const vgmSlot = (k, i2) => {", "const vgmDaten = ");
  assert.match(slot, /const ldPlan = rampeVm\.ld\[i2\] === void 0 && k\.kg > 0;/, "die Vorbelegung der Ladung ist nicht mehr als solche erkennbar");
  assert.match(slot, /vgmRechnen\(\{ br: rampeVm\.br\[i2\], ta: rampeVm\.ta\[i2\], ld, vp: rampeVm\.vp\[i2\] \}/);
  assert.ok(roh.includes('T.vgmTaraHinweis, v.ldPlan ? " " + T.vgmLadungPlan : ""'), "der Hinweis zur Vorbelegung steht nicht am Feld");
  assert.ok(roh.includes("kein Wiegeergebnis") && roh.includes("not a weighing result"), "der Hinweis sagt nicht, was das Plangewicht ist");
  // VGM gibt es fuer den Seecontainer, nicht fuer den LKW
  assert.ok(roh.includes('const vgmAn = domain === "sea";'));
  // Jeder vgm-Text der Oberflaeche steht in beiden Sprachen
  const keys = [...roh.matchAll(/^\s{6}(vgm[A-Za-z0-9]+):/gm)].map((x) => x[1]);
  const zahl = {};
  keys.forEach((k) => { zahl[k] = (zahl[k] || 0) + 1; });
  assert.ok(Object.keys(zahl).length >= 30, `nur ${Object.keys(zahl).length} vgm-Texte gefunden`);
  for (const [k, n] of Object.entries(zahl)) assert.strictEqual(n, 2, `${k} steht ${n}x da -- erwartet je einmal Deutsch und Englisch`);
  for (const k of new Set([...roh.matchAll(/T\.(vgm[A-Za-z0-9]+)/g)].map((x) => x[1]))) assert.ok(zahl[k], `T.${k} wird benutzt, aber nirgends definiert`);
});

test("die Ausgaben stehen in der Kopfleiste, das Menue behaelt alle", () => {
  // Ladevorschlag, Bild und VGM sichtbar neben "Teilen": ab md als Symbol, mit Wort, sobald es
  // neben dem mittigen Plannamen Platz hat (das misst die Kopfzeile selbst -- test/kopfzeile)
  assert.ok(roh.includes("!EMBEDDED && kopfAusgaben, /* @__PURE__ */ React.createElement(\"button\", { onClick: manualMode ? void 0 : doShare"), "die Ausgaben stehen nicht direkt vor Teilen");
  const kopf = zwischen("const kopfAusgaben = [", "].filter(Boolean);");
  assert.match(kopf, /domain === "sea" && kopfKnopf\("lv", T\.pdfBtn, T\.pdfTitle, buildLadevorschlag/);
  assert.match(kopf, /kopfKnopf\("bild", T\.shotBtn, T\.shotTitle, \(\) => setExportOpen\(true\)/);
  assert.match(kopf, /domain === "sea" && kopfKnopf\("vgm", T\.vgmKopfBtn, T\.vgmKopfTitel, \(\) => vgmOeffnen\(null\), !planSteht \|\| manualMode/);
  const knopf = zwischen("const kopfKnopf = (", "const kopfAusgaben = [");
  assert.ok(knopf.includes('className: "hidden md:flex') && knopf.includes('className: "kopf-wort"'), "Symbol ab md, Wort nach Platz");
  assert.ok(knopf.includes('"aria-label": label') && knopf.includes("strokeWidth: ICO.sw"));
  // Im Menue stehen weiterhin alle -- auf dem Telefon ist es der einzige Weg
  const menu = zwischen("domain === \"sea\" && { label: T.pdfBtn, sub: T.pdfTitle, fn: buildLadevorschlag }", "].filter(Boolean).map((e, i) => e.trenner");
  for (const t of ["T.exportBtn", "T.shotBtn", "T.plansBtn", "T.rampeBtn", "label: T.vgmTitel, sub: T.vgmMenuSub, fn: () => vgmOeffnen(null)"]) assert.ok(menu.includes(t), `im Menue fehlt ${t}`);
  // Die Meldung ist eine Karte, kein eingefaerbter Streifen mehr
  const karte = zwischen("const hinweisKarte = (", "const fassungEl = ");
  assert.ok(karte.includes("background: C.surface") && karte.includes("borderRadius: R.l") && karte.includes("boxShadow: C.schatten"));
  assert.ok(!/background: hexA\(C\.good, 0\.1\), borderBottom/.test(roh), "der gruene Streifen ist zurueck");
  assert.ok(roh.includes("hinweisKarte(C.good,") && roh.includes("onClick: () => vgmOeffnen(vmAlsFormular(vmAnzeige))"));
});

test("Datenschutz: was die VGM-Meldung lokal ablegt, steht dort", () => {
  const ds = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.ok(roh.includes('const VGM_ABS = "cl-vgm-absender-v1";'));
  assert.match(ds, /VGM-Erklärung/, "die Datenschutzerklaerung nennt die VGM-Erklaerung nicht");
  assert.match(ds, /Verlader, bevollmächtigte Person und Ort/, "die gemerkten Absender-Angaben stehen nicht in der Datenschutzerklaerung");
  assert.match(ds, /Gewichte/, "die Gewichte der Meldung stehen nicht in der Datenschutzerklaerung");
});
