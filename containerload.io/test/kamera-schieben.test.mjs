// Die Kamera darf ihren Mittelpunkt verlassen.
//
// Gemeldet: "wenn ich mehrere Container habe und zoome, dann nervt es, dass immer der
// Mittelpunkt fixiert ist... ich kann gar nicht richtig zu den anderen Containern in das
// Detail gehen." Genau so war es gebaut: die Kamera kreiste um t.target, und t.target war
// die MITTE DER REIHE. Zoomen hiess damit immer "in die Mitte hinein" - bei drei Containern
// also in die Luecke zwischen dem ersten und dem zweiten.
//
// Drei Wege heraus, alle drei Standard in 3D-Betrachtern:
//   * rechte (oder mittlere) Maustaste, oder Shift, schiebt das Ziel
//   * das Rad zoomt DORTHIN, wo der Zeiger steht
//   * Doppelklick holt den Punkt unter dem Zeiger in die Mitte
//
// node --test test/kamera-schieben.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const roh = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");

test("Ziehen mit rechts, Mitte oder Shift schiebt statt zu drehen", () => {
  assert.ok(/schiebt = e\.button === 2 \|\| e\.button === 1 \|\| e\.shiftKey;/.test(roh),
    "es gibt keinen Schiebe-Modus mehr");
  assert.ok(/target\.addScaledVector\(rechts, -dx \* proPixel\);/.test(roh) &&
            /target\.addScaledVector\(hoch, dy \* proPixel\);/.test(roh),
    "das Ziel wird beim Schieben nicht in der Bildebene bewegt");
  // Ein Pixel Mauszug soll ein Pixel Bild sein - sonst rutscht die Ladung unter dem Zeiger weg.
  assert.ok(/const proPixel = 2 \* Math\.tan\(camera\.fov \* Math\.PI \/ 360\) \* cur\.r \/ Math\.max\(1, dom\.clientHeight\);/.test(roh),
    "das Schiebe-Mass haengt nicht mehr an Entfernung und Bildhoehe");
});

test("ein Schiebe-Zug setzt im manuellen Modus keine Kiste", () => {
  assert.ok(/const warSchieben = schiebt;/.test(roh) &&
            /if \(!warSchieben && Math\.hypot\(e\.clientX - downX, e\.clientY - downY\) <= CLICK_SLOP\) handleManualClick\(e\);/.test(roh),
    "ein Klick mit der rechten Taste wuerde wieder platzieren");
  assert.ok(/dom\.addEventListener\("contextmenu", keinMenue\);/.test(roh),
    "ohne das oeffnet die rechte Maustaste das Browser-Menue mitten im Ziehen");
});

test("das Rad zoomt dorthin, wo der Zeiger steht", () => {
  assert.ok(/const rein = 1 - sph\.r \/ vorher;/.test(roh), "der Zoom-Anteil fehlt");
  assert.ok(/target\.lerp\(p, rein\);/.test(roh),
    "der Anteil muss GENAU der Entfernungsaenderung entsprechen - nur dann bleibt der Punkt " +
    "unter dem Zeiger stehen, statt weggezogen zu werden");
  assert.ok(/if \(rein > 1e-3\)/.test(roh),
    "beim Herauszoomen muss das Ziel stehen bleiben, sonst zerrt es bei jedem Rueckzug");
});

test("Doppelklick zentriert - ausser im manuellen Modus", () => {
  assert.ok(/const dbl = \(e\) => \{\s*\n\s*if \(propsRef\.current\.manualMode\) return;/.test(roh),
    "im manuellen Modus saesse ein Doppelklick zwei Kisten");
  assert.ok(/dom\.addEventListener\("dblclick", dbl\);/.test(roh));
  assert.ok(/dom\.removeEventListener\("dblclick", dbl\);/.test(roh), "und wieder abmelden");
  assert.ok(/dom\.removeEventListener\("contextmenu", keinMenue\);/.test(roh), "desgleichen");
});

test("das Ziel kann sich bewegen, aber nicht verlorengehen", () => {
  assert.ok(/const zielKlemmen = \(\) => \{/.test(roh), "ohne Klemmung schiebt man sich ins Nichts");
  assert.ok(/target\.x = Math\.max\(f\.cx - f\.hx - m, Math\.min\(f\.cx \+ f\.hx \+ m, target\.x\)\);/.test(roh),
    "die Grenze ist die Reihe selbst plus Auslauf - dafuer stehen die Halbmasse in t.frame");
  assert.ok(/target\.y = Math\.max\(0, Math\.min\(f\.cy \+ f\.hy \+ m, target\.y\)\);/.test(roh),
    "unter den Boden soll es auch nicht gehen");
  // Nachgerechnet: die Klemmung darf keinen Container ausschliessen.
  const klemm = (v, c, h, m) => Math.max(c - h - m, Math.min(c + h + m, v));
  const cx = 20, hx = 20, m = 2;          // Reihe aus drei 40-Fuessern, rund 40 m lang
  assert.strictEqual(klemm(0, cx, hx, m), 0, "der erste Container muss erreichbar bleiben");
  assert.strictEqual(klemm(40, cx, hx, m), 40, "der letzte auch");
  assert.strictEqual(klemm(999, cx, hx, m), 42, "weit dahinter ist Schluss");
});

test("die Bedienung steht dran, kurz und in beiden Sprachen", () => {
  // Lang gehoert in den title: daneben sitzt das Empfehlungsbanner, und der Hinweis lief
  // vorher darunter durch.
  for (const k of ["orbitHint", "orbitHintLong"]) {
    const n = (roh.match(new RegExp(`[{,\\n]\\s*${k}:`, "g")) || []).length;
    assert.strictEqual(n, 2, `${k} steht ${n}x in den Woerterbuechern, erwartet 2 (DE und EN)`);
  }
  // \xB7 steht als vier Zeichen in der Quelle - gezaehlt wird, was der Nutzer sieht.
  const kurz = /orbitHint: "([^"]+)"/.exec(roh)[1].replace(/\\x[0-9A-Fa-f]{2}/g, "\u00b7");
  assert.ok(kurz.length <= 36, `der sichtbare Hinweis ist mit ${kurz.length} Zeichen zu lang: "${kurz}"`);
  assert.ok(!/"ziehen \\xB7 scrollen"\)/.test(roh) && !/, "ziehen /.test(roh),
    "der Hinweis stand fest auf Deutsch im Markup - er muss aus T kommen");
  assert.strictEqual((roh.match(/title: T\.orbitHintLong/g) || []).length, 2,
    "beide 3D-Ansichten (Rechner und Palettendialog) sollen den langen Hinweis tragen");
});
