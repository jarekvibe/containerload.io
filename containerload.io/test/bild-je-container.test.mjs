// Die Kennzahlen je Container stehen auch im BILD.
//
// Das Bild ist das, was beim Kunden ankommt - die Frage "wie voll ist der zweite" stellt
// sich dort genauso wie im Rechner. Eine Kachel je Container, mit zwei Balken: Raum und
// Gewicht. Zwei, weil zwei Grenzen gelten und bei schwerer Ladung die zweite zuerst
// zuschlaegt (bei der gemeldeten Sendung: 47 % Volumen, 99 % Zuladung).
//
// node --test test/bild-je-container.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("die Kacheln kommen aus derselben Quelle wie die Tabelle", () => {
  assert.ok(/const slotsImBild = \(slotRows \|\| \[\]\)\.slice\(0, 8\);/.test(roh),
    "das Bild rechnet eigene Zahlen statt slotRows zu benutzen - dann koennen sie auseinanderlaufen");
  assert.ok(/const mehrSlots = Math\.max\(0, \(slotRows \|\| \[\]\)\.length - 8\);/.test(roh),
    "ohne diesen Rest verschwiegen mehr als acht Container ihre Zahl");
  // Seit Schritt 06 gilt das auch von Hand: result ist dort die manuell gestaute Kette,
  // slotRows liest sie, und das Bild liest slotRows. Ein Sonderweg waere eine zweite Quelle.
  assert.ok(!/const slotsImBild = manualMode/.test(roh),
    "das Bild sperrt die Kacheln im manuellen Modus aus -- der stellt seit Schritt 06 selbst Container");
});

test("bei einem einzelnen Container bleibt das Bild, wie es war", () => {
  assert.ok(/const slotZeilen = slotsImBild\.length > 1 \? Math\.ceil\(slotsImBild\.length \/ 4\) : 0;/.test(roh),
    "die Kachelleiste darf bei einem Container nicht erscheinen");
  assert.ok(/const stripH = slotZeilen \? slotZeilen \* slotKachelH \+ \(slotZeilen - 1\) \* px\(10\) : 0;/.test(roh),
    "ohne Kacheln muss die Hoehe 0 sein, sonst waechst jedes Bild um einen leeren Streifen");
});

test("die Kacheln gehen in vollen Reihen auf", () => {
  // Dieselbe Regel wie bei der Typ-Auswahl: keine angebrochene letzte Reihe, wo es
  // vermeidbar ist. 6 Kacheln sind 2x3, nicht 4+2.
  const zeilen = (n) => (n > 1 ? Math.ceil(n / 4) : 0);
  const proZeile = (n) => (zeilen(n) ? Math.ceil(n / zeilen(n)) : 0);
  assert.strictEqual(proZeile(3), 3);
  assert.strictEqual(proZeile(4), 4);
  assert.strictEqual(proZeile(6), 3, "6 Kacheln muessen 2x3 werden, nicht 4+2");
  assert.strictEqual(proZeile(8), 4);
  for (let n = 2; n <= 8; n++) {
    assert.ok(proZeile(n) * zeilen(n) >= n, `${n} Kacheln passen nicht in ${zeilen(n)}x${proZeile(n)}`);
    assert.ok(proZeile(n) <= 4, `${n} Kacheln ergaeben ${proZeile(n)} pro Reihe - zu schmal`);
  }
});

test("das Gewicht faerbt sich, bevor es zu spaet ist", () => {
  assert.ok(/const kgFarbe = pPct > 100 \? "#FF5D52" : pPct > 90 \? "#F5A524" : accStops\[0\];/.test(roh),
    "ohne Warnfarbe sieht niemand, dass die Zuladung der Engpass ist");
  // Dieselben Schwellen wie in der Oberflaeche.
  assert.ok(/kgColor: pPct > 100 \? C\.bad : pPct > 90 \? C\.warn : C\.text/.test(roh),
    "Bild und Tabelle muessen bei derselben Prozentzahl umschlagen");
});

test("beide Bildvarianten machen Platz fuer die Leiste", () => {
  // Transparent (Glass-Balken) und opak (Chrome-Karte) rechnen die Hoehe getrennt aus.
  // Wer nur eine anpasst, schiebt in der anderen die Fussleiste ueber die Kacheln.
  const treffer = roh.match(/const stripPlatz = stripH \? stripH \+ (gapR|px\(14\)) \+ \(mehrSlots > 0 \? px\(24\) : 0\) : 0;/g) || [];
  assert.strictEqual(treffer.length, 2, `stripPlatz steht ${treffer.length}x, erwartet 2 (transparent und opak)`);
  assert.ok(/cv\.height = FR \+ cap\.h \+ gapR \+ stripPlatz \+ barH \+ FR;/.test(roh), "transparente Variante");
  assert.ok(/cv\.height = FR \+ cap\.h \+ stripPlatz \+ footH \+ discH;/.test(roh), "opake Variante");
  assert.ok(/const fy = FR \+ cap\.h \+ stripPlatz, fcy = fy \+ footH \/ 2;/.test(roh),
    "die Fussleiste muss unter der Kachelleiste sitzen");
  assert.ok(/const dY = fy \+ footH;/.test(roh), "und die Disclaimer-Zeile unter der Fussleiste");
});

test("die Beschriftungen sind auf beiden Untergruenden lesbar", () => {
  // mutedCol ist im opaken Bild #4A5C6E - auf der Kachelflaeche zu dunkel (rund 2,3:1).
  assert.ok(/const slotMuted = glas \? "#BCC9D6" : "#7689A0";/.test(roh),
    "die Kacheln benutzen wieder den zu dunklen Grundton");
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const kontrast = (a, b) => {
    const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (h + 0.05) / (l + 0.05);
  };
  assert.ok(kontrast("#7689A0", "#161D27") >= 4.5,
    `Beschriftung auf der Kachel: ${kontrast("#7689A0", "#161D27").toFixed(2)}:1`);
  assert.ok(kontrast("#C5D4E2", "#161D27") >= 4.5,
    `Wert auf der Kachel: ${kontrast("#C5D4E2", "#161D27").toFixed(2)}:1`);
});

test("die Sprache stimmt in beiden Faellen", () => {
  for (const [de, en] of [["VOLUMEN", "VOLUME"], ["GEWICHT", "WEIGHT"], [" STK", " PCS"], ["WEITERE", "MORE"]]) {
    assert.ok(new RegExp(`en \\? "${en}" : "${de}"`).test(roh),
      `"${de}"/"${en}" fehlt oder ist nicht zweisprachig`);
  }
});
