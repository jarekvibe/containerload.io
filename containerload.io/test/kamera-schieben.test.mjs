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

// ── Der Sprung beim Radschritt ───────────────────────────────────────────────
//
// Gemeldet: "wenn ich das Mausrad nach vorne bewege, werde ich teilweise teleportiert."
//
// Ursache war punktUnterZeiger. Es schnitt nur eine UNENDLICHE waagerechte Ebene auf
// Zielhoehe -- und die trifft der Strahl auch dann, wenn der Zeiger neben der Ladung ins
// Leere zeigt. Bei flachem Blickwinkel liegt der Schnittpunkt dann Dutzende Meter weiter
// hinten; ein Radschritt zieht das Ziel um 13 % dieser Strecke dorthin, und zielKlemmen
// setzt es anschliessend hart an den Rand der Reihe. Derselbe Fehler steckte im Doppelklick.

// Ein Ausschnitt aus app.html, von "von" bis "bis".
const schnitt = (von, bis) => {
  const a = roh.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = roh.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return roh.slice(a, b);
};
const zahl = (re, was) => {
  const m = roh.match(re);
  assert.ok(m, `${was} nicht in app.html gefunden`);
  return Number(m[1]);
};

test("der Zeiger trifft zuerst die Ladung, nicht irgendeine Ebene", () => {
  const fn = schnitt("const punktUnterZeiger = (e) =>", "const zielKlemmen");
  assert.match(fn, /isInstancedMesh/, "es wird gar nicht erst auf die Kisten geschossen");
  assert.match(fn, /intersectObjects/, "kein Raycast auf die Ladung");
  // Und die Ebene bleibt der Notnagel -- mit Schranke.
  const i = fn.indexOf("intersectObjects"), j = fn.indexOf("intersectPlane");
  assert.ok(i >= 0 && j > i, "die Bodenebene wird vor der Ladung befragt");
  assert.match(fn, /imRahmen\(hit\) \? hit : null/, "der Ebenentreffer wird ungeprueft zurueckgegeben");
});

test("die Schranke ist dieselbe wie beim Klemmen des Ziels", () => {
  // Zwei verschiedene Auslaufmasse waeren genau die Art Abweichung, die spaeter niemand
  // mehr erklaeren kann: das Ziel duerfte an eine Stelle springen, an der es nicht bleiben darf.
  const r = schnitt("const imRahmen = (p) =>", "const punktUnterZeiger");
  assert.match(r, /const m = 2;/, "imRahmen benutzt einen anderen Auslauf als zielKlemmen");
  assert.match(r, /Math\.abs\(p\.x - f\.cx\) <= f\.hx \+ m/, "die x-Grenze fehlt");
  assert.match(r, /Math\.abs\(p\.z - f\.cz\) <= f\.hz \+ m/, "die z-Grenze fehlt");
  const k = schnitt("const zielKlemmen = () =>", "const updateGhost");
  assert.match(k, /const m = 2;/, "zielKlemmen benutzt einen anderen Auslauf als imRahmen");
});

test("gerechnet: ohne Schranke reisst ein einziger Radschritt die Ansicht meterweit weg", () => {
  // Die Rechnung, die den Fehler erklaert -- mit den echten Werten aus app.html, damit sie
  // nicht stillschweigend veraltet, wenn jemand Bildwinkel oder Zoomschritt aendert.
  const fov = zahl(/PerspectiveCamera\((\d+), W \/ H/, "Bildwinkel der 3D-Buehne") * Math.PI / 180;
  const r = zahl(/const sph = \{ r: (\d+(?:\.\d+)?), theta: -0\.92, phi: 1 \}/, "Ruhelage der Kamera");
  const schrittFaktor = zahl(/sph\.r \* \(1 \+ e\.deltaY \* (\d+(?:e-\d+)?)\)/, "Zoomschritt");
  const rein = 1 - (1 + (-120) * schrittFaktor);   // ein Radschritt nach vorne
  assert.ok(rein > 0.05 && rein < 0.4, `ein Radschritt schrumpft die Entfernung um ${(rein * 100).toFixed(1)} %`);

  // Kamera bei flachem Blick (so steht sie, nachdem man zu einer Seitenansicht gedreht hat).
  const phi = 1.4, theta = -0.92;
  const pos = { x: r * Math.sin(phi) * Math.sin(theta), y: r * Math.cos(phi), z: r * Math.sin(phi) * Math.cos(theta) };
  const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
  const fwd = norm({ x: -pos.x, y: -pos.y, z: -pos.z });
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const rechts = norm(cross(fwd, { x: 0, y: 1, z: 0 }));
  const oben = cross(rechts, fwd);
  const th = Math.tan(fov / 2), asp = 1200 / 640;
  // Zeiger im oberen Bilddrittel, leicht links -- also neben der Ladung im Leeren.
  const nx = -0.5, ny = 0.35;
  const d = norm({ x: fwd.x + rechts.x * nx * th * asp + oben.x * ny * th,
                   y: fwd.y + rechts.y * nx * th * asp + oben.y * ny * th,
                   z: fwd.z + rechts.z * nx * th * asp + oben.z * ny * th });
  assert.ok(d.y < 0, "der Strahl zeigt nach oben -- fuer diesen Fall gibt es keinen Bodentreffer");
  const t = -pos.y / d.y;
  const treffer = { x: pos.x + d.x * t, z: pos.z + d.z * t };
  const entfernung = Math.hypot(treffer.x, treffer.z);
  const sprung = entfernung * rein;

  // Ein 40-Fuss-Container ist 12 m lang. Ein Sprung in dieser Groessenordnung ist der
  // gemeldete "Teleport" -- und imRahmen faengt ihn ab, weil der Punkt weit ausserhalb
  // selbst einer dreigliedrigen Reihe (Halbmass rund 18 m) plus 2 m Auslauf liegt.
  assert.ok(entfernung > 20, `Bodentreffer nur ${entfernung.toFixed(1)} m entfernt — der Fall bildet den Fehler nicht mehr ab`);
  assert.ok(sprung > 3, `ein Radschritt versetzt das Ziel nur um ${sprung.toFixed(2)} m`);
  assert.ok(entfernung > 18 + 2, "der Punkt laege noch innerhalb der Reihe — imRahmen wuerde ihn durchlassen");
});
