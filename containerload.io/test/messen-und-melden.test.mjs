// Wissen, was passiert — und einen Weg, es zu sagen.
//
// Ausgangslage: GoatCounter zaehlte nur Seitenaufrufe, und im Rechner gab es keinen Weg,
// etwas zu melden. Damit war weder zu erkennen, ob nach dem Aufruf ueberhaupt etwas
// passiert (tippt jemand eine Ladung ein? rechnet er? teilt er?), noch kam ein Fehler
// anders herein als per Bildschirmfoto, das erst von Hand nachgebaut werden musste.
//
// Beides ist billig zu haben und aendert, woran als naechstes gearbeitet wird. Beides muss
// aber sauber bleiben, und genau das haelt diese Datei fest:
//
//   * Es geht NUR DER NAME DES EREIGNISSES mit — nie ein Mass, ein Gewicht, ein
//     Positionsname. Das ist die Zusage der Datenschutzseite, und sie ist im Code
//     nachpruefbar: jeder Aufruf von zaehl() traegt eine feste Zeichenkette.
//   * Jedes Ereignis zaehlt JE SEITENAUFRUF HOECHSTENS EINMAL. Sonst zaehlt jeder
//     Tastendruck im Mengenfeld eine "Ladung eingegeben".
//   * Der Rueckkanal uebertraegt von sich aus GAR NICHTS: er oeffnet das Mailprogramm des
//     Absenders, und der sieht vor dem Senden, was drinsteht.
//
// node --test test/messen-und-melden.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const schnitt = (von, bis) => {
  const a = src.indexOf(von);
  assert.ok(a >= 0, `nicht gefunden: ${von}`);
  const b = src.indexOf(bis, a);
  assert.ok(b > a, `Ende nicht gefunden: ${bis}`);
  return src.slice(a, b);
};

// Die Ereignisse, die es geben soll. Wer eines ergaenzt, faellt hier auf — und muss sich
// dabei die Frage stellen, ob der Name wirklich nichts ueber die Ladung verraet.
const EREIGNISSE = [
  "plan-per-link-geoeffnet", "beispiel-geoeffnet", "ladung-eingegeben", "excel-import",
  "palettierer", "plan-gerechnet", "mehrere-container", "passt-nicht", "empfehlung",
  "manueller-modus", "geteilt", "csv-export", "ladevorschlag", "bild-export", "feedback-geoeffnet"
];

test("es geht NUR der Name des Ereignisses mit — nie etwas aus der Ladung", () => {
  // Der wichtigste Test dieser Datei. Ein einziges zaehl(name) mit einer Variablen wuerde
  // die Zusage der Datenschutzseite brechen, ohne dass es jemandem auffiele.
  // Die Definition selbst (function zaehl(name)) ist kein Aufruf.
  const aufrufe = [...src.matchAll(/(?<!function )\bzaehl\(([^)]*)\)/g)].map((m) => m[1].trim());
  assert.ok(aufrufe.length >= EREIGNISSE.length, `nur ${aufrufe.length} Zaehl-Aufrufe gefunden`);
  for (const a of aufrufe) {
    assert.match(a, /^"[a-z0-9-]+"$/,
      `zaehl(${a}) — der Wert ist keine feste Zeichenkette. Damit koennte Ladungsinhalt hinausgehen.`);
  }
  const genutzt = [...new Set(aufrufe.map((a) => a.slice(1, -1)))].sort();
  assert.deepStrictEqual(genutzt, EREIGNISSE.slice().sort(),
    "die gezaehlten Ereignisse weichen von der vereinbarten Liste ab");
});

test("jedes Ereignis zaehlt je Seitenaufruf hoechstens einmal", () => {
  const fn = schnitt("function zaehl(name) {", "var homeHref");
  assert.match(fn, /if \(EV_GEZAEHLT\[name\]\) return;/, "der Wiederholungsschutz fehlt");
  assert.match(fn, /EV_GEZAEHLT\[name\] = true;/, "das Ereignis wird nie als gezaehlt vermerkt");
});

test("Ereignisse gehen nicht verloren, solange der Zaehler noch laedt", () => {
  // count.js wird async geladen. Ohne Warteschlange ginge ausgerechnet das erste Ereignis
  // verloren — und das erste ist das wichtigste.
  const fn = schnitt("function zaehl(name) {", "var homeHref");
  assert.match(fn, /EV_WARTEN\.push\(name\)/, "es gibt keine Warteschlange");
  assert.match(fn, /setInterval/, "auf den Zaehler wird nicht gewartet");
  const senden = schnitt("function evAbsenden() {", "function zaehl(name)");
  assert.match(senden, /typeof window\.goatcounter\.count === "function"/, "es wird nicht geprueft, ob der Zaehler ueberhaupt da ist");
  assert.match(senden, /while \(EV_WARTEN\.length\)/, "die Warteschlange wird nie geleert");
});

test("der eingebettete Rechner zaehlt getrennt vom eigenstaendigen", () => {
  // Jeder Startseiten-Besuch laedt den Rechner im iframe mit. Ohne die Trennung waere jede
  // Zahl von diesen Aufrufen verwaessert.
  const senden = schnitt("function evAbsenden() {", "function zaehl(name)");
  assert.match(senden, /EMBEDDED \? "demo\/" : "app\/"/, "beide Faelle zaehlen in denselben Topf");
  assert.match(senden, /event: true/, "es wird als Seitenaufruf statt als Ereignis gezaehlt");
});

test("der Rueckkanal oeffnet eine Mail und uebertraegt von sich aus nichts", () => {
  const fn = schnitt("const meldeProblem = () => {", "const doShare = () =>");
  assert.match(fn, /^[\s\S]*mailto:/, "es wird gar keine Mail geoeffnet");
  assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(fn),
    "der Rueckkanal schickt etwas ohne Zutun des Absenders — genau das soll er nicht");
  // Die Adresse steht im Impressum und wird hier nicht abgeschrieben.
  const imp = fs.readFileSync(path.join(dir, "..", "impressum.html"), "utf8");
  const mail = (imp.match(/mailto:([^"?]+)/) || [])[1];
  assert.ok(mail, "im Impressum steht keine Adresse");
  assert.ok(fn.includes("mailto:" + mail), `der Rueckkanal schreibt an eine andere Adresse als das Impressum (${mail})`);
});

test("die Meldung traegt den Plan — und sagt das auch", () => {
  const fn = schnitt("const meldeProblem = () => {", "const doShare = () =>");
  assert.match(fn, /encodePlanURL\(preset, container, cargo, forceCentered, domain\)/,
    "ohne den Plan-Link muss jeder Fall wieder von Hand nachgebaut werden");
  assert.match(fn, /T\.feedbackPrivacy/, "es steht nicht dabei, dass die Ladung im Link steckt");
  // Lange Adressen schneiden manche Mailprogramme ab. Dann lieber ohne Link als halb.
  assert.match(fn, /if \(mail\.length > \d+\) mail = bauen\(""\)/, "keine Laengenbegrenzung");
});

test("beide Sprachen kennen die neuen Texte", () => {
  for (const key of ["feedback", "feedbackTitle", "feedbackSubject", "feedbackIntro",
                     "feedbackFacts", "feedbackNoLink", "feedbackPrivacy"]) {
    const n = [...src.matchAll(new RegExp(`\\b${key}: "`, "g"))].length;
    assert.strictEqual(n, 2, `${key} steht ${n}× da statt zweimal (DE und EN)`);
  }
});

test("die Datenschutzseite sagt, was gezaehlt wird und was der Rueckkanal tut", () => {
  // Dieselbe Ehrlichkeitsregel wie bei den Zahlen: was die Seite tut, steht dort auch.
  const ds = fs.readFileSync(path.join(dir, "..", "datenschutz.html"), "utf8");
  assert.match(ds, /anonyme Ereignisse/, "die Ereigniszaehlung ist nicht erwaehnt");
  assert.match(ds, /ausschließlich der Name des Ereignisses/, "es steht nicht da, dass nur der Name uebertragen wird");
  assert.match(ds, /Feedback-Formular|Knopf „Feedback“/, "der Rueckkanal ist nicht erwaehnt");
  assert.match(ds, /nichts übertragen, solange du nicht auf „Absenden“ drückst/,
    "es steht nicht da, dass ohne Absenden nichts hinausgeht");
  assert.match(ds, /Ladung mitschicken/, "das abwaehlbare Kaestchen ist nicht erklaert");
  assert.match(ds, /Netlify/, "der Empfaenger der Formulardaten ist nicht genannt");
  // Der wichtigste Satz der Seite darf nicht mehr pauschal behaupten, es gehe NIE etwas
  // hinaus -- seit dem Formular gibt es eine Ausnahme, und die muss dort stehen.
  assert.match(ds, /von selbst nicht an einen Server gesendet/,
    "das Versprechen in Abschnitt 2 ist nicht auf das automatische Verhalten eingegrenzt");
  assert.match(ds, /containerload\.feedback\.v1|Hat der Plan gepasst/,
    "der neue Speicher-Schluessel ist nicht erwaehnt");
});

// ── Das Formular ────────────────────────────────────────────────────────────
//
// Es laeuft OHNE Server: Netlify erkennt beim Deploy ein statisches <form
// data-netlify="true"> im ausgelieferten HTML und nimmt dafuer POSTs entgegen. Der sichtbare
// Dialog kommt aus React und schickt dieselben Felder per fetch dorthin.
//
// Genau daran haengt aber eine Falle: stimmen die Feldnamen im versteckten Formular nicht mit
// denen im Dialog ueberein, verwirft Netlify die Eingabe still. Es gibt keine Fehlermeldung,
// der Absender sieht "Danke", und die Rueckmeldung ist weg. Deshalb werden beide Listen hier
// gegeneinander geprueft.

const formular = schnitt('<form name="feedback"', "</form>");
const dialogSenden = schnitt("const senden = async () => {", "const feld = {");

test("es gibt ein statisches Formular, an dem Netlify die Adresse erkennt", () => {
  assert.match(formular, /data-netlify="true"/, "ohne data-netlify nimmt Netlify keine POSTs an");
  assert.match(formular, /netlify-honeypot="bot-field"/, "kein Spam-Schutz");
  assert.match(formular, /name="form-name" value="feedback"/, "der Formularname fehlt im Rumpf");
  assert.ok(/\shidden(\s|>)/.test(formular), "das Formular ist nicht versteckt und wuerde im Rechner auftauchen");
});

test("die Feldnamen im Dialog und im Formular stimmen ueberein", () => {
  const imFormular = [...formular.matchAll(/name="([^"]+)"/g)].map((m) => m[1])
    .filter((n) => n !== "feedback" && n !== "bot-field").sort();
  const imDialog = [...dialogSenden.matchAll(/^\s*"?([a-zA-Z-]+)"?:/gm)].map((m) => m[1]).sort();
  assert.deepStrictEqual(imDialog, imFormular,
    `Dialog schickt [${imDialog}], das Formular kennt [${imFormular}] — Netlify wuerde die Abweichung still verwerfen`);
});

test("gesendet wird als Formular, nicht als JSON", () => {
  // Netlify Forms nimmt urlencoded (oder multipart) entgegen. JSON wird stillschweigend
  // verworfen -- wieder ohne Fehlermeldung.
  assert.match(dialogSenden, /"Content-Type": "application\/x-www-form-urlencoded"/, "falscher Inhaltstyp");
  assert.match(dialogSenden, /new URLSearchParams\(daten\)/, "der Rumpf ist nicht urlencodiert");
  assert.match(dialogSenden, /if \(!r\.ok\) throw/, "ein abgelehnter POST wird als Erfolg gewertet");
});

test("die Ladung geht nur mit, wenn das Kaestchen steht", () => {
  assert.match(dialogSenden, /plan: mitPlan \? kontext\.plan : ""/,
    "der Plan wird unabhaengig vom Kaestchen mitgeschickt");
  const dlg = schnitt("function FeedbackDialog(", "function PlansDialog(");
  assert.match(dlg, /type: "checkbox", checked: mitPlan/, "es gibt gar kein Kaestchen");
  assert.match(dlg, /T\.fbSendPlanHint/, "es steht nicht dabei, was mitgeschickt wird");
});

test("geht das Absenden schief, faellt der Dialog auf die E-Mail zurueck", () => {
  // Datei lokal geoeffnet, Formulare nicht aktiviert, offline -- dann darf die Rueckmeldung
  // nicht einfach verschluckt werden.
  const dlg = schnitt("function FeedbackDialog(", "function PlansDialog(");
  assert.match(dlg, /setStand\("fehler"\)/, "ein Fehlschlag wird gar nicht bemerkt");
  assert.match(dlg, /stand === "fehler" \? \/\* @__PURE__ \*\/ React\.createElement\(Btn[^)]*onMailto/,
    "im Fehlerfall gibt es keinen Weg per E-Mail");
});

test("die Frage nach dem Plan kommt hoechstens einmal — und nicht im eingebetteten Rechner", () => {
  const block = schnitt("const fbFragen = () => {", "};");
  assert.match(block, /EMBEDDED \|\| fbSchonGefragt\.current/, "kein Schutz gegen Mehrfach-Fragen");
  assert.match(block, /localStorage\.getItem\(FB_KEY\)/, "die Frage kommt bei jedem Besuch wieder");
  const vorbei = schnitt("const fbVorbei = () => {", "};");
  assert.match(vorbei, /localStorage\.setItem\(FB_KEY/, "die Antwort wird nicht gemerkt");
});
