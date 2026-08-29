// Das Vorschaubild, das beim Teilen erscheint, gehoert zur Marke.
//
// Gemeldet: "Wenn ich Kollegen den Plan per Teams teile, kommt da unter dem Link so eine
// Art Header ... Ist noch im alten Design, sieht finde ich ziemlich kacke aus. Ausserdem
// auch nur auf Deutsch." Beides stimmte: die beiden Karten (og.png, share-og.png) waren die
// letzten Stellen mit Farbverlauf, Tuerkis-Akzent und dem alten Markenzeichen -- dieselbe
// Abweichung, die auf den Randseiten schon einmal aufgeraeumt wurde -- und sie waren
// einsprachig, obwohl ein gutes Drittel der Besucher von ausserhalb Deutschlands kommt.
//
// Ein Vorschaubild ist statisch: der Scraper von Teams, Slack oder LinkedIn liest die
// Meta-Angaben, bevor irgendein ?lang=en gewirkt haette. Zwei Sprachen auf EINER Karte ist
// die einzige Fassung, die ohne zweite Seite und ohne Weiterleitungsregel auskommt.
//
// Der Test liest die PNG-Pixel selbst, statt einem Kommentar zu glauben.
//
// node --test test/vorschaubild.test.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (f) => fs.readFileSync(path.join(dir, "..", f));
const app = lies("app.html").toString("utf8");

// Die Markenwerte werden AUS app.html gelesen, nicht abgeschrieben -- eine abgeschriebene
// Zahl waere die naechste Kopie, die wegdriftet (dieselbe Regel wie test/randseiten).
const ausApp = (k) => {
  const m = app.match(new RegExp(`\\n\\s*${k}: "(#[0-9A-Fa-f]{6})"`));
  assert.ok(m, `${k} steht nicht in app.html`);
  return m[1].toLowerCase();
};
const BG = ausApp("bg"), ACCENT = ausApp("accent");

// Minimaler PNG-Leser: 8 bit, Farbtyp 2 (RGB), ohne Interlace -- genau das, was ein
// Browser-Screenshot liefert. Mehr braucht der Test nicht, und mehr soll er nicht koennen.
function pngLesen(buf) {
  assert.ok(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "keine PNG-Datei");
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  const tiefe = buf[24], typ = buf[25], interlace = buf[28];
  assert.strictEqual(tiefe, 8, "unerwartete Farbtiefe");
  assert.strictEqual(typ, 2, "unerwarteter Farbtyp (erwartet RGB)");
  assert.strictEqual(interlace, 0, "interlaced PNG wird hier nicht gelesen");
  const teile = [];
  for (let i = 8; i < buf.length;) {
    const len = buf.readUInt32BE(i), art = buf.subarray(i + 4, i + 8).toString("latin1");
    if (art === "IDAT") teile.push(buf.subarray(i + 8, i + 8 + len));
    if (art === "IEND") break;
    i += 12 + len;
  }
  const roh = zlib.inflateSync(Buffer.concat(teile));
  const bpp = 3, zeile = w * bpp;
  const px = Buffer.alloc(h * zeile);
  for (let y = 0; y < h; y++) {
    const filter = roh[y * (zeile + 1)];
    const ein = roh.subarray(y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile);
    for (let x = 0; x < zeile; x++) {
      const a = x >= bpp ? px[y * zeile + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * zeile + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * zeile + x - bpp] : 0;
      let v = ein[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) assert.fail(`unbekannter PNG-Filter ${filter} in Zeile ${y}`);
      px[y * zeile + x] = v & 255;
    }
  }
  const hex = (x, y) => "#" + px.subarray(y * zeile + x * 3, y * zeile + x * 3 + 3).toString("hex");
  return { w, h, hex };
}

const KARTEN = [["og.png", "Startseite und Wissens-Seiten"], ["share-og.png", "geteilter Plan"]];

for (const [datei, wofuer] of KARTEN) {
  const bild = pngLesen(lies(datei));

  test(`${datei}: die Masse stimmen mit den Meta-Angaben ueberein`, () => {
    // og:image:width / og:image:height nennen genau diese Zahlen -- weichen sie ab,
    // schneiden manche Vorschauen das Bild falsch zu.
    assert.strictEqual(bild.w, 1200, `${wofuer}: Breite ${bild.w}`);
    assert.strictEqual(bild.h, 630, `${wofuer}: Hoehe ${bild.h}`);
    const seiten = [lies("share.html").toString("utf8"), lies("index.html").toString("utf8")];
    for (const s of seiten) {
      assert.ok(/og:image:width" content="1200"/.test(s) && /og:image:height" content="630"/.test(s),
        "eine Seite nennt andere Masse als das Bild");
    }
  });

  test(`${datei}: der Grundton ist der der Marke, und die Flaeche ist glatt`, () => {
    // Vier Ecken statt einer: die alte Karte trug einen Farbverlauf von links unten nach
    // rechts oben. Genau den findet nur ein Vergleich ueber die Flaeche.
    const ecken = [bild.hex(6, 6), bild.hex(1193, 6), bild.hex(6, 623), bild.hex(1193, 623)];
    for (const e of ecken) assert.strictEqual(e, BG, `Ecke ${e} statt Grundton ${BG} (${ecken.join(" ")})`);
  });

  test(`${datei}: in der Textspalte kommen nur Markenfarben in Flaechen vor`, () => {
    // Kein Farbton-Raten, sondern eine Zaehlung: welche vier Farben decken die Textspalte?
    // Auf der alten Karte waren das ein Farbverlauf und ein Tuerkis; jetzt muessen es
    // genau die vier Marken-Token aus app.html sein. Antialiasing-Saeume (Chromium malt
    // Text mit Subpixeln und erzeugt dabei schraege Mischfarben) fallen dabei nicht ins
    // Gewicht -- sie kommen zusammen auf unter ein Zehntel Prozent.
    //
    // Nur die linke Haelfte: rechts steht die Zeichnung, und die Kennfarben der Packstuecke
    // sind absichtlich bunt (sie tragen Information, siehe TYPE_COLORS in app.html).
    const H = new Map();
    let n = 0;
    for (let y = 0; y < bild.h; y++) {
      for (let x = 0; x < 700; x++) {
        const k = bild.hex(x, y);
        H.set(k, (H.get(k) || 0) + 1);
        n++;
      }
    }
    const top = [...H.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const gefunden = top.map(([k]) => k).sort();
    const erwartet = [BG, ACCENT, ausApp("text"), ausApp("dim")].sort();
    assert.deepStrictEqual(gefunden, erwartet,
      `die haeufigsten Farben sind ${top.map(([k, c]) => k + " " + (c / n * 100).toFixed(1) + "%").join(", ")}`);
    const anteil = (f) => (H.get(f) || 0) / n;
    assert.ok(anteil(BG) > 0.8, `der Grundton deckt nur ${(anteil(BG) * 100).toFixed(1)} % -- steht da ein Farbverlauf?`);
    assert.ok(anteil(ACCENT) > 0.01, `der Markenton deckt nur ${(anteil(ACCENT) * 100).toFixed(2)} %`);
  });
}

test("beide Karten sprechen Deutsch und Englisch", () => {
  const quelle = lies("test/og/karte.html").toString("utf8");
  for (const wort of ["Geteilter Stauplan", "Shared load plan", "3D-Ladungsrechner", "3D load calculator",
                      "wurde mit dir geteilt", "See in 3D", "Pallet-accurate"]) {
    assert.ok(quelle.includes(wort), `"${wort}" fehlt in der Bildquelle`);
  }
  // Und die Vorschau-Texte daneben, die der Scraper liest.
  const share = lies("share.html").toString("utf8");
  for (const [attr, de, en] of [
    ["og:title", "wurde mit dir geteilt", "was shared with you"],
    ["og:description", "in den Container passt", "into the container"],
    ["og:image:alt", "in 3D ansehen", "view it in 3D"],
  ]) {
    const m = share.match(new RegExp(`${attr}" content="([^"]*)"`));
    assert.ok(m, `${attr} fehlt in share.html`);
    assert.ok(m[1].includes(de), `${attr} ohne deutschen Teil: ${m[1]}`);
    assert.ok(m[1].includes(en), `${attr} ohne englischen Teil: ${m[1]}`);
  }
});

// Die Malerreihenfolge ist keine Geschmacksfrage, sondern nachrechenbar -- und sie war
// zweimal falsch. Erst nach der Summe der Eckkoordinaten sortiert (stimmt nur bei gleich
// grossen Kisten; eine hintere Palette wurde ueber den flachen Block davor gemalt), dann mit
// einer Tiefensuche, die jede BERUEHRUNG als Verdeckung zaehlte -- und weil eine gestaute
// Ladung fast nur aus Beruehrungen besteht, nannten sich Paare gegenseitig "hinter" und die
// Suche lief im Kreis. Gemeldet als "die Ladung dadrinne sieht voll buggy aus".
//
// Der Test laedt die Kistenliste UND die Sortierung aus der Bildquelle und rechnet jedes
// Paar nach: liegt A hinter B, muss A vorher gemalt worden sein.
test("die Kisten werden von hinten nach vorne gemalt", () => {
  const q = lies("test/og/karte.html").toString("utf8");
  // Zwei Ausschnitte, weil zwischen Liste und Sortierung das Zeichnen selbst steht (das
  // braucht die Projektion P und laesst sich hier nicht ausfuehren).
  const l0 = q.indexOf("  var kisten = ["), l1 = q.indexOf("  ];", l0);
  const s0 = q.indexOf("  var hinter = function"), s1 = q.indexOf("besuche(i);", s0);
  assert.ok(l0 > 0 && l1 > l0 && s0 > l1 && s1 > s0, "Kistenliste oder Sortierung nicht gefunden");
  const { kisten, reihe, hinter } = new Function(
    q.slice(l0, l1 + 4) + q.slice(s0, s1 + "besuche(i);".length) + "\nreturn { kisten, reihe, hinter };"
  )();
  assert.strictEqual(reihe.length, kisten.length, "beim Sortieren ist eine Kiste verlorengegangen");

  const platz = new Map(reihe.map((k, i) => [k, i]));
  let paare = 0, falsch = 0, ringe = 0;
  for (const a of kisten) {
    for (const b of kisten) {
      if (a === b) continue;
      if (!hinter(a, b)) continue;
      if (hinter(b, a)) { ringe++; continue; }   // Ring: dann verdecken sie sich gar nicht
      paare++;
      if (platz.get(a) > platz.get(b)) falsch++;
    }
  }
  assert.ok(paare > 20, `nur ${paare} sich verdeckende Paare -- steht da ueberhaupt eine Ladung?`);
  assert.strictEqual(falsch, 0, `${falsch} von ${paare} Paaren stehen in der falschen Reihenfolge`);
  assert.strictEqual(ringe, 0,
    `${ringe} Paare nennen sich gegenseitig "hinter" -- die Beruehrungs-Toleranz ist wieder zu grob`);

  // Und die Ladung steht wirklich IM Container: nichts ragt hinaus, nichts durchdringt sich.
  const CL = +q.match(/var CL = ([\d.]+)/)[1], CW = +q.match(/CW = ([\d.]+)/)[1], CH = +q.match(/CH = ([\d.]+)/)[1];
  for (const k of kisten) {
    assert.ok(k[0] >= -1e-9 && k[0] + k[3] <= CL + 1e-9, `Kiste ragt in der Laenge hinaus: ${k.join()}`);
    assert.ok(k[1] >= -1e-9 && k[1] + k[4] <= CW + 1e-9, `Kiste ragt in der Breite hinaus: ${k.join()}`);
    assert.ok(k[2] >= -1e-9 && k[2] + k[5] <= CH + 1e-9, `Kiste ragt in der Hoehe hinaus: ${k.join()}`);
  }
  const schneidet = (a, b) => [0, 1, 2].every((i) => Math.min(a[i] + a[i + 3], b[i] + b[i + 3]) - Math.max(a[i], b[i]) > 1e-9);
  for (let i = 0; i < kisten.length; i++) {
    for (let j = i + 1; j < kisten.length; j++) {
      assert.ok(!schneidet(kisten[i], kisten[j]), `zwei Kisten durchdringen sich: ${kisten[i].join()} / ${kisten[j].join()}`);
    }
  }
});

test("die Bildquelle haelt sich an dasselbe Regelwerk wie der Rest", () => {
  const q = lies("test/og/karte.html").toString("utf8");
  assert.ok(!/linear-gradient|radial-gradient/.test(q), "Farbverlauf in der Vorschaubild-Quelle");
  const schwer = [...q.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => +m[1]).filter((v) => v > 700);
  assert.strictEqual(schwer.length, 0, `Schriftgewicht ueber 700: ${schwer.join(", ")}`);
  assert.ok(q.includes(BG.toUpperCase()) || q.includes(BG), "die Quelle benutzt einen anderen Grundton");
  assert.ok(q.includes(ACCENT.toUpperCase()) || q.includes(ACCENT), "die Quelle benutzt einen anderen Akzent");
  // Gemeldet: "Packstuecke sind irgendwie weirdly transparent". Die Seitenflaechen waren mit
  // fill-opacity abgedunkelt -- dadurch schien das Drahtgitter der Huelle durch die Ladung,
  // und die Kisten sahen aus wie aus Glas. Abgedunkelt wird jetzt gerechnet (dunkler()),
  // die Flaechen sind deckend, und die Huelle liegt hinter der Ladung statt darueber.
  assert.ok(!/fill-opacity\s*=/.test(q), "fill-opacity-Attribut in der Zeichnung -- die Ladung wird wieder durchsichtig");
  // Gemeldet: "der Container ist oben in der Ecke abgeschnitten". Der Zeichenbereich stand
  // auf einem festen translate(232,58); die hintere Oberkante liegt aber bei y = -104 und
  // fiel damit aus dem SVG heraus. Der Rahmen wird jetzt aus den acht Huellenecken gerechnet
  // -- wer wieder eine feste Zahl einsetzt, verschiebt beim naechsten Eingriff dieselbe Ecke.
  assert.ok(!/transform="translate\(\d/.test(q),
    "fester Versatz in der Zeichnung -- der Rahmen muss aus der Geometrie kommen");
  assert.ok(/el\.setAttribute\("viewBox"/.test(q) && /ecken\.push\(P\(x, y, z\)\)/.test(q),
    "die viewBox wird nicht mehr aus den Huellenecken gerechnet");
  const iHuelle = q.indexOf('e.forEach(function (q)');
  const iKisten = q.indexOf("reihe.forEach(function (k)");
  assert.ok(iHuelle > 0 && iKisten > 0 && iHuelle < iKisten,
    "die Huelle wird nach der Ladung gezeichnet und zieht Linien quer durch die Kisten");
});
