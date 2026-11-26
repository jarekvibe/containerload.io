// Die drei Functions, die "nichts" antworten (/api/beacon, /api/puls, puls-aufraeumen), liefen
// in Produktion bei JEDEM Aufruf in einen Fehler: `new Response("", { status: 204 })`. Ein
// 204 darf keinen Koerper tragen -- auch keinen leeren Text; die Laufzeit (Node 22) wirft
// "Invalid response status code 204", Netlify macht daraus 502. Gesehen am 25.11.26 in den
// Netlify-Logs: 43 von 44 Aufrufen von /api/beacon mit 502.
//
// Die Daten waren trotzdem da (gespeichert wird VOR der Antwort, und der Absender ist
// sendBeacon, der keine Antwort liest) -- deshalb fiel es nie auf. Kein Test hatte die
// Functions je wirklich aufgerufen; die Pruefungen lasen nur ihren Quelltext.
//
// Dieser Test ruft sie auf. "@netlify/blobs" gibt es in der CI nicht (kein npm install) --
// ein Lade-Haken ersetzt das Paket durch einen Speicher im Arbeitsspeicher.
//
// node --test test/functions-antworten.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { register } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FN = path.join(dir, "..", "..", "netlify", "functions");

const ERSATZ = "data:text/javascript," + encodeURIComponent("export const getStore = (name) => globalThis.__clBlobs(name);");
register("data:text/javascript," + encodeURIComponent(
  `export async function resolve(spec, ctx, next) {
     if (spec === "@netlify/blobs") return { url: ${JSON.stringify(ERSATZ)}, shortCircuit: true };
     return next(spec, ctx);
   }`));

// Der Speicher: merkt sich, was geschrieben und geloescht wurde.
const neuerSpeicher = (vorhanden = []) => {
  const log = { geschrieben: [], geloescht: [] };
  globalThis.__clBlobs = (name) => ({
    setJSON: async (k, v) => { log.geschrieben.push([name, k, v]); },
    set: async (k, v) => { log.geschrieben.push([name, k, v]); },
    list: async () => ({ blobs: vorhanden.map((key) => ({ key })) }),
    delete: async (k) => { log.geloescht.push([name, k]); },
  });
  return log;
};
const anfrage = (pfad, body, kopf = { origin: "https://containerload.io" }, method = "POST") =>
  new Request("https://containerload.io" + pfad, { method, headers: kopf, body: method === "POST" ? body : undefined });
const PERU = { geo: { country: { code: "PE" } } };
const ereignis = () => JSON.stringify({ v: 1, modus: "sea", sprache: "es", geteilt: false, dauerS: 42,
  positionen: [{ l: 120, b: 80, h: 110, kg: 400, n: 10, stapel: true }], funktionen: ["plan-gerechnet"], container: "20' GP", kette: 1 });

test("die Laufzeit erlaubt bei 204 keinen Koerper -- auch keinen leeren Text", () => {
  // Die Tatsache, an der der Fehler hing. Aendert sich das je, ist dieser Test der Hinweis.
  assert.throws(() => new Response("", { status: 204 }), /Invalid response status code 204/);
  assert.strictEqual(new Response(null, { status: 204 }).status, 204);
});

test("keine Function baut eine koerperlose Antwort (204, 205, 304) mit einem Koerper", () => {
  const dateien = fs.readdirSync(FN).filter((f) => f.endsWith(".mjs")).map((f) => path.join(FN, f))
    .concat(fs.readdirSync(path.join(FN, "lib")).filter((f) => f.endsWith(".mjs")).map((f) => path.join(FN, "lib", f)));
  assert.ok(dateien.length >= 8, "Functions nicht gefunden");
  let leer = 0;
  for (const f of dateien) {
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/new Response\(([^;]*?)\{\s*status:\s*(204|205|304)\b/g)) {
      assert.match(m[1], /^\s*null\s*,\s*$/, `${path.basename(f)}: Antwort ${m[2]} mit Koerper (${m[1].trim()})`);
      leer++;
    }
  }
  assert.ok(leer >= 3, "die drei wortkargen Antworten sind nicht mehr da");
});

test("/api/beacon: speichert das gepruefte Ereignis mit Laendercode und antwortet 204", async () => {
  const { default: beacon } = await import("../../netlify/functions/beacon.mjs");
  const log = neuerSpeicher();
  const r = await beacon(anfrage("/api/beacon", ereignis()), PERU);
  assert.strictEqual(r.status, 204);
  assert.strictEqual(log.geschrieben.length, 1);
  const [store, key, ev] = log.geschrieben[0];
  assert.strictEqual(store, "nutzung");
  assert.match(key, /^e\/\d{4}-\d{2}-\d{2}\/\d{6}-[a-z0-9]+$/);
  assert.deepStrictEqual([ev.land, ev.sprache, ev.modus], ["PE", "es", "sea"]);
  // Abgewiesen wird wie bisher -- und dann wird auch nichts gespeichert.
  for (const [a, status] of [
    [anfrage("/api/beacon", "", {}, "GET"), 405],
    [anfrage("/api/beacon", ereignis(), { origin: "https://example.org" }), 403],
    [anfrage("/api/beacon", "kein json"), 400],
    [anfrage("/api/beacon", "x".repeat(16385)), 413],
  ]) assert.strictEqual((await beacon(a, PERU)).status, status);
  assert.strictEqual(log.geschrieben.length, 1, "eine abgewiesene Anfrage wurde gespeichert");
});

test("/api/puls: legt genau einen Schluessel ab und antwortet 204", async () => {
  const { default: puls } = await import("../../netlify/functions/puls.mjs");
  const log = neuerSpeicher();
  const r = await puls(anfrage("/api/puls", "rechner"), PERU);
  assert.strictEqual(r.status, 204);
  const schreiben = log.geschrieben.filter(([s]) => s === "puls");
  assert.strictEqual(schreiben.length, 1);
  assert.match(schreiben[0][1], /^p\/\d{12}\/\d{2}-PE-rechner-[a-z0-9]+$/);
  assert.strictEqual((await puls(anfrage("/api/puls", "irgendwas"), PERU)).status, 400);
  assert.strictEqual((await puls(anfrage("/api/puls", "", {}, "GET"), PERU)).status, 405);
  assert.strictEqual(log.geschrieben.filter(([s]) => s === "puls").length, 1);
});

test("puls-aufraeumen: loescht nur Altes und antwortet 204", async () => {
  const { default: raeumen } = await import("../../netlify/functions/puls-aufraeumen.mjs");
  const stempel = (ms) => new Date(ms).toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const alt = `p/${stempel(Date.now() - 3 * 3600e3)}/07-DE-start-abc123`, frisch = `p/${stempel(Date.now())}/07-DE-start-def456`;
  const log = neuerSpeicher([alt, frisch]);
  const r = await raeumen();
  assert.strictEqual(r.status, 204);
  assert.deepStrictEqual(log.geloescht, [["puls", alt]]);
});
