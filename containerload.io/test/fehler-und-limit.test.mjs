// Zwei Dinge, die Jarek am 10.11.26 entschieden hat und die beide die Datenschutzerklaerung
// beruehren -- deshalb stehen sie zusammen, und deshalb ist hier festgehalten, wie WENIG
// dabei uebertragen bzw. ausgewertet wird.
//
// 1. DER FEHLERZAEHLER. Stuerzt der Rechner ab, wird ein Ereignis gezaehlt -- nur der Name,
//    je Seitenaufruf hoechstens einmal, wie jedes andere Ereignis auch. Kein Fehlertext,
//    keine Zeile, kein Stack: in einer Meldung kann ein Positionsname stehen.
//
// 2. DAS LIMIT JE CLIENT. Die drei KI-Endpunkte teilen sich einen Tagesdeckel; wer ihn
//    allein leerfragt, schaltet die KI fuer alle ab. Davor steht jetzt ein Limit je
//    IP-Adresse -- gezaehlt von Netlify am Rand des Netzes, nicht vom Code der Function.
//    Der Rechner muss die beiden 429 unterscheiden: "morgen wieder" ist nicht "einen Moment".
//
// node --test test/fehler-und-limit.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pruefeEvent } from "../../netlify/functions/lib/nutzung.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(dir, "..", "app.html"), "utf8");
const fn = (name) => fs.readFileSync(path.join(dir, "..", "..", "netlify", "functions", name), "utf8");
const L = app.split("\n");

// ── 1. Fehlerzaehler ─────────────────────────────────────────────────────────
// Der Block mit den beiden Horchern, ausgefuehrt gegen ein nachgestelltes Fenster.
function horcher(origin = "https://containerload.io") {
  const von = L.findIndex((l) => l.includes('window.addEventListener("error"'));
  const bis = L.findIndex((l, i) => i > von && l.includes('window.addEventListener("unhandledrejection"'));
  assert.ok(von > 0 && bis > von, "die Fehler-Horcher stehen nicht mehr, wo der Test sie sucht");
  const gezaehlt = [], h = {};
  const fenster = { location: { origin }, addEventListener: (typ, f) => { h[typ] = f; } };
  new Function("window", "zaehl", L.slice(von, bis + 1).join("\n"))(fenster, (...a) => gezaehlt.push(a));
  return { h, gezaehlt };
}

test("ein Fehler im eigenen Code wird gezaehlt -- mit nichts als dem Namen", () => {
  const { h, gezaehlt } = horcher();
  h.error({ filename: "https://containerload.io/app", message: "Position „Mueller GmbH, Auftrag 4711“ ist undefined", lineno: 9001, error: new Error("geheim") });
  assert.deepStrictEqual(gezaehlt, [["fehler-skript"]], "es geht genau EIN Argument mit: der feste Name");
  h.unhandledrejection({ reason: new Error("Kunde XY") });
  assert.deepStrictEqual(gezaehlt[1], ["fehler-async"]);
});

test("fremde Skripte zaehlen nicht mit", () => {
  const { h, gezaehlt } = horcher();
  h.error({ filename: "chrome-extension://abc/inject.js", message: "x" });     // Browser-Erweiterung
  h.error({ filename: "", message: "Script error." });                          // fremde Herkunft, vom Browser verdeckt
  h.error({ filename: "https://gc.zgo.at/count.js", message: "x" });            // der Besucherzaehler
  h.error({});
  assert.deepStrictEqual(gezaehlt, [], "gezaehlt wurde ein Fehler, der nicht aus dem eigenen Code kommt");
});

test("der Fehlerschirm meldet sich -- und alle drei Namen kommen beim Server durch", () => {
  assert.match(app, /componentDidCatch\(fehler, info\) \{[\s\S]{0,400}?zaehl\("fehler-anzeige"\)/, "der Fehlerschirm zaehlt sein Erscheinen nicht");
  const namen = ["fehler-anzeige", "fehler-skript", "fehler-async"];
  // Jeder Aufruf traegt eine feste Zeichenkette, nie eine Variable oder Verkettung.
  for (const n of namen) assert.ok(app.includes('zaehl("' + n + '")'), n + " wird nicht gezaehlt");
  assert.doesNotMatch(app, /zaehl\("fehler-[a-z]*"\s*[+,]/, "an einem Fehler-Ereignis haengt mehr als der Name");
  // Der Server laesst Funktionsnamen nur in engem Alphabet durch -- diese muessen hineinpassen.
  const ev = pruefeEvent({ v: 1, modus: "sea", sprache: "de", positionen: [], funktionen: namen });
  assert.deepStrictEqual(ev.funktionen, namen);
});

// ── 2. Limit je Client ───────────────────────────────────────────────────────
// Netlify liest "export const config" ohne den Code auszufuehren -- es muss ein reines
// Literal sein. Genau so wird es hier gelesen: als Literal ausgewertet, nicht als Text verglichen.
const konfig = (name) => {
  const s = fn(name);
  const m = /export const config = (\{[\s\S]*?\n\});/.exec(s);
  assert.ok(m, name + ": config nicht gefunden");
  return new Function("return " + m[1])();
};

test("jeder KI-Endpunkt hat ein Limit je IP-Adresse -- als Literal, das Netlify lesen kann", () => {
  for (const name of ["ki-chat.mjs", "ki-import.mjs", "ki-brief.mjs"]) {
    const c = konfig(name);
    assert.strictEqual(c.path, "/api/" + name.replace(".mjs", ""));
    const r = c.rateLimit;
    assert.ok(r, name + ": kein rateLimit");
    assert.strictEqual(r.action, "rate_limit", name + ": das Limit muss ablehnen (429), nicht umleiten");
    assert.ok([].concat(r.aggregateBy).includes("ip"), name + ": gezaehlt wird nicht je Client");
    assert.ok(Number.isInteger(r.windowSize) && r.windowSize > 0 && r.windowSize <= 180, name + ": Zeitfenster ausserhalb 1–180 s");
    assert.ok(Number.isInteger(r.windowLimit) && r.windowLimit >= 5, name + ": Limit so eng, dass normales Arbeiten daran stoesst");
  }
  // Stevie fragt je Nachricht bis zu dreimal (Antwort + zwei Nachzuege): er braucht mehr Luft
  // als Import und Brief, und das Limit muss ein Gespraech in normalem Tempo durchlassen.
  assert.ok(konfig("ki-chat.mjs").rateLimit.windowLimit >= 3 * 8, "Stevie: weniger als acht Nachrichten je Fenster");
});

test("das Limit je Client schont den gemeinsamen Tagesdeckel, es ersetzt ihn nicht", () => {
  // Rechnerisch: selbst wer jedes Fenster ausschoepft, braucht fuer den Tagesdeckel Minuten
  // statt Sekunden -- und der Deckel selbst bleibt die harte Grenze fuers Guthaben.
  const proMinute = ["ki-chat.mjs", "ki-import.mjs", "ki-brief.mjs"].map((n) => { const r = konfig(n).rateLimit; return r.windowLimit * 60 / r.windowSize; });
  const summe = proMinute.reduce((a, b) => a + b, 0);
  assert.ok(400 / summe >= 5, `ein Client koennte den Tagesdeckel in ${(400 / summe).toFixed(1)} Minuten leeren`);
  for (const name of ["ki-chat.mjs", "ki-import.mjs", "ki-brief.mjs"]) {
    assert.match(fn(name), /if \(!\(await tagesdeckel\(\)\)\) return Response\.json\(\{ fehler: "limit" \}, \{ status: 429 \}\)/, name + ": der Tagesdeckel fehlt");
    assert.doesNotMatch(fn(name), /context\.ip|x-forwarded-for|x-nf-client-connection-ip/i, name + ": der Code liest eine IP-Adresse");
  }
});

// Der Rechner unterscheidet die beiden 429 -- ausgefuehrt gegen nachgestellte Antworten.
const kiLimitText = (() => {
  const von = L.findIndex((l) => l.includes("var kiLimitText = async"));
  const bis = L.findIndex((l, i) => i > von && l.trim() === "};");
  assert.ok(von > 0 && bis > von, "kiLimitText nicht gefunden");
  return new Function("T", L.slice(von, bis + 1).join("\n") + "\nreturn kiLimitText;")({ kiLimit: "MORGEN", kiTempo: "MOMENT" });
})();
const antwort = (rumpf) => ({ clone: () => ({ json: async () => { if (rumpf === null) throw new Error("kein JSON"); return rumpf; } }) });

test("429 vom Tagesdeckel heisst morgen, 429 vom Limit je Client heisst einen Moment", async () => {
  assert.strictEqual(await kiLimitText(antwort({ fehler: "limit" })), "MORGEN", "die Function meldet den Tagesdeckel mit {fehler:'limit'}");
  assert.strictEqual(await kiLimitText(antwort(null)), "MOMENT", "Netlifys eigene Antwort traegt unser JSON nicht");
  assert.strictEqual(await kiLimitText(antwort({ irgendwas: 1 })), "MOMENT");
  assert.strictEqual(await kiLimitText(antwort("Too Many Requests")), "MOMENT");
});

test("alle drei KI-Wege fragen nach, welches 429 es war, und beide Sprachen kennen den Text", () => {
  assert.strictEqual((app.match(/r\.status === 429/g) || []).length, 3, "die Zahl der 429-Stellen hat sich geaendert -- pruefen, ob jede unterscheidet");
  assert.strictEqual((app.match(/await kiLimitText\(r\)/g) || []).length, 3, "nicht jeder KI-Weg unterscheidet die beiden 429");
  assert.strictEqual((app.match(/^\s+kiTempo: "/gm) || []).length, 2, "kiTempo fehlt in einer der beiden Sprachen");
});
