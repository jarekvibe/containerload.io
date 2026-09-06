// Die anonyme Nutzungsstatistik: ein Event je Rechner-Besuch an /api/beacon,
// Auswertung unter /admin. Der Kern dieses Tests ist die eine Regel, die das
// Feature tragbar macht: ES GEHT KEIN FREITEXT MIT. Packlisten tragen
// Kundennamen und Auftragsnummern; weder der Sender (app.html) noch der
// Empfaenger (netlify/functions) duerfen sie je anfassen.
//
// node --test test/nutzungsstatistik.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pruefeEvent, aggregiere, POS_MAX } from "../../netlify/functions/lib/nutzung.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const datenschutz = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
const admin = fs.readFileSync(path.join(dir, "..", "admin.html"), "utf8");
const robots = fs.readFileSync(path.join(dir, "..", "robots.txt"), "utf8");
const redirects = fs.readFileSync(path.join(dir, "..", "_redirects"), "utf8");

const gut = () => ({ v: 1, modus: "sea", sprache: "de", geteilt: false, dauerS: 42,
  positionen: [{ l: 120, b: 80, h: 110, kg: 400, n: 10, stapel: true }],
  funktionen: ["plan-gerechnet", "excel-import"], container: "20' GP", kette: 1 });

test("pruefeEvent laesst nur die erwarteten Felder durch", () => {
  const e = pruefeEvent(gut());
  assert.ok(e, "das wohlgeformte Event muss durchkommen");
  assert.deepStrictEqual(Object.keys(e).sort(),
    ["container", "dauerS", "funktionen", "geteilt", "kette", "modus", "positionen", "sprache", "v"]);
  assert.deepStrictEqual(e.positionen[0], { l: 120, b: 80, h: 110, kg: 400, n: 10, stapel: true });
  // Fremde Schluessel verschwinden -- auch in den Positionen.
  const mitMuell = gut();
  mitMuell.name = "Kunde Meier"; mitMuell.positionen[0].name = "Auftrag 4711";
  const e2 = pruefeEvent(mitMuell);
  assert.strictEqual(JSON.stringify(e2).includes("Meier"), false);
  assert.strictEqual(JSON.stringify(e2).includes("4711"), false);
});

test("pruefeEvent verwirft, was kein ehrliches Event sein kann", () => {
  assert.strictEqual(pruefeEvent(null), null);
  assert.strictEqual(pruefeEvent([]), null);
  assert.strictEqual(pruefeEvent({ ...gut(), v: 2 }), null, "unbekannte Version");
  assert.strictEqual(pruefeEvent({ ...gut(), modus: "air" }), null, "unbekannter Modus");
  assert.strictEqual(pruefeEvent({ ...gut(), sprache: "nl" }), null, "unbekannte Sprache");
  // Leeres Event (nichts eingegeben, nichts benutzt): kein Befund, kein Eintrag.
  assert.strictEqual(pruefeEvent({ v: 1, modus: "sea", sprache: "de", positionen: [], funktionen: [] }), null);
  // Freitext in funktionen faellt raus (nur kebab-case-Kennungen), Grossbuchstaben auch.
  const e = pruefeEvent({ ...gut(), funktionen: ["excel-import", "Kunde Meier GmbH", "DROP TABLE"] });
  assert.deepStrictEqual(e.funktionen, ["excel-import"]);
  // Positionen ohne brauchbare Masse fallen raus, der Rest bleibt.
  const e2 = pruefeEvent({ ...gut(), positionen: [{ l: "x", b: 80, h: 110 }, { l: 60, b: 40, h: 40 }] });
  assert.strictEqual(e2.positionen.length, 1);
  // Obergrenzen: mehr als POS_MAX Positionen werden gekappt, nicht abgelehnt.
  const viele = { ...gut(), positionen: Array.from({ length: 200 }, () => ({ l: 10, b: 10, h: 10 })) };
  assert.strictEqual(pruefeEvent(viele).positionen.length, POS_MAX);
  // Containername: enges Alphabet, harte Laenge -- auch wenn er nie aus Nutzereingaben kommt.
  const e3 = pruefeEvent({ ...gut(), container: "20' GP <script>alert(1)</script>" + "x".repeat(100) });
  assert.ok(!e3.container.includes("<") && e3.container.length <= 40);
});

test("aggregiere zaehlt Tage, Container, Modi und Funktionen aus einer Quelle", () => {
  const events = [
    { ...pruefeEvent(gut()), tag: "2026-09-01" },
    { ...pruefeEvent(gut()), tag: "2026-09-01" },
    { ...pruefeEvent({ ...gut(), modus: "road", container: "Planensattel 13,6 m", funktionen: ["ladung-eingegeben"] }), tag: "2026-09-02" },
  ];
  const a = aggregiere(events);
  assert.strictEqual(a.events, 3);
  assert.deepStrictEqual(a.tage.map((t) => t.events), [2, 1]);
  assert.strictEqual(a.positionenGesamt, 3);
  assert.strictEqual(a.stueckGesamt, 30);
  assert.strictEqual(a.container["20' GP"], 2);
  assert.strictEqual(a.modus.road, 1);
  assert.strictEqual(a.funktionen["excel-import"], 2);
});

test("der Sender in app.html haelt die Regeln des NUTZ-Blocks", () => {
  // Gesendet wird nur vom echten Host, nicht bei DNT/GPC, nicht aus dem Demo,
  // hoechstens einmal -- die Bedingungen stehen woertlich im Code.
  assert.ok(app.includes('if (NUTZ.gesendet || !NUTZ.snap || EMBEDDED) return;'), "Einmal-je-Besuch- und Demo-Sperre fehlt");
  assert.ok(app.includes('/(^|\\.)containerload\\.io$/.test(window.location.hostname)'), "Host-Sperre fehlt (file://, localhost, Previews)");
  assert.ok(app.includes('navigator.doNotTrack === "1" || navigator.globalPrivacyControl'), "DNT/GPC-Sperre fehlt");
  assert.ok(app.includes('navigator.sendBeacon("/api/beacon"'), "Beacon-Ziel fehlt");
  // Der Schnappschuss baut die Positionen NUR aus Zahlenfeldern -- kein c.name.
  const von = app.indexOf("NUTZ.snap = {");
  const bis = app.indexOf("}, [cargo, domain, result]);", von);
  assert.ok(von > 0 && bis > von, "Schnappschuss-Effekt nicht gefunden");
  const schnitt = app.slice(von, bis);
  // c.name ist der Positionsname (Nutzertext) -- verboten. result.chain[0].name
  // ist der Preset-Name aus unserer eigenen Liste -- erlaubt.
  assert.ok(!schnitt.includes("c.name"), "Positionsnamen duerfen den Schnappschuss nie erreichen");
  assert.ok(schnitt.includes("l: num(c.l), b: num(c.w), h: num(c.h), kg: num(c.weight)"), "Zahlenfelder des Schnappschusses");
  // Die Funktions-Namen kommen aus dem bestehenden Ereigniszaehler -- eine Quelle.
  assert.ok(app.includes("const funktionen = Object.keys(EV_GEZAEHLT);"), "Funktions-Liste muss aus EV_GEZAEHLT kommen");
  // Der Sicherungs-Check zaehlt inzwischen mit (kam nach dem Zaehler dazu).
  assert.ok(app.includes('zaehl("sicherung-geprueft")'), "Sicherungs-Ereignis fehlt");
});

test("die Datenschutzseite sagt es, BEVOR die Technik es tut", () => {
  assert.ok(datenschutz.includes("Anonyme Nutzungsstatistik"), "eigener Abschnitt fehlt");
  assert.ok(datenschutz.includes("Positionsbezeichnungen"), "der Ausschluss von Namen muss ausgesprochen sein");
  assert.ok(datenschutz.includes("Do&nbsp;Not&nbsp;Track"), "die DNT-Zusage muss auf der Seite stehen");
  // Das alte Versprechen "verlaesst dein Geraet nicht" darf nicht mehr uneingeschraenkt dastehen.
  assert.ok(!datenschutz.includes("Sie verlassen dein Gerät nicht"), "das alte Pauschal-Versprechen waere jetzt gelogen");
  // Und der alte Feedback-Hinweis im Rechner auch nicht.
  assert.ok(!app.includes("bleibt die Ladung auf deinem Ger\\xE4t"), "alter DE-Hinweis verspricht zu viel");
  assert.ok(!app.includes("the cargo stays on your device"), "alter EN-Hinweis verspricht zu viel");
});

test("das Dashboard bleibt draussen: noindex, robots, Token-Pflicht", () => {
  assert.ok(admin.includes('name="robots" content="noindex,nofollow"'), "noindex fehlt");
  assert.ok(robots.includes("Disallow: /admin"), "robots.txt-Sperre fehlt");
  assert.ok(redirects.includes("/admin         /admin.html         200"), "sauberer Pfad fehlt");
  assert.ok(admin.includes('authorization: "Bearer " + token'), "Token-Kopfzeile fehlt");
  // Die Function verweigert ohne konfiguriertes Token den Dienst, statt mit
  // leerem Soll-Wert jeden hereinzulassen.
  const statistik = fs.readFileSync(path.join(dir, "..", "..", "netlify", "functions", "statistik.mjs"), "utf8");
  assert.ok(statistik.includes('if (!soll) return Response.json({ fehler:'), "leeres Token darf nie wie ein richtiges wirken");
  assert.ok(statistik.includes("timingSafeEqual"), "Tokenvergleich in konstanter Zeit");
});
