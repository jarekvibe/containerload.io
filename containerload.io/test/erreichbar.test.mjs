// Der Waechter (werkzeug/erreichbar.mjs + .github/workflows/erreichbar.yml): prueft stuendlich
// von aussen, ob containerload.io antwortet und ob dort der Stand von main liegt.
//
// Anlass (26.11.26): rund achteinhalb Stunden Ausfall, und ein Merge ging nie live -- gemerkt
// hat es niemand. Die echte Seite ist von der CI aus kein Testgegenstand (ein Ausfall soll
// keinen Pull Request rot faerben); hier werden die ANTWORTEN nachgestellt und geprueft, dass
// der Waechter die drei Lagen auseinanderhaelt: alles gut, Seite weg, Stand veraltet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pruefen, bericht, kern, mcpAnfrage, MCP_TAGESGRENZE, BASIS, KENNUNG, SEITEN, STAND, PROBEN } from "../../werkzeug/erreichbar.mjs";
import { planen } from "../../netlify/functions/lib/plan.mjs";
import { beantworte } from "../../netlify/functions/lib/mcp.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SEITE = path.join(HIER, "..");
const WURZEL = path.join(SEITE, "..");
const datei = (name) => readFileSync(path.join(SEITE, name));

// Eine nachgestellte Seite: liefert, was im Repository liegt -- /api/plan aus planen() und /mcp
// aus derselben Function, die Netlify ausliefert (beantworte).
// `anders(adresse, methode)` darf eine Antwort ersetzen ({ status, body } oder ein Fehler).
function seite(anders = () => null) {
  const rufe = [];
  const fetchFn = async (adresse, opt = {}) => {
    const u = new URL(adresse);
    rufe.push({ pfad: u.pathname, methode: opt.method || "GET", kennung: opt.headers && opt.headers["user-agent"], koerper: opt.body || null, art: opt.headers && opt.headers["content-type"] });
    const ers = anders(u, opt.method || "GET", rufe.length);
    if (ers instanceof Error) throw ers;
    let status = 200, body = Buffer.alloc(0);
    if (ers) { status = ers.status; body = Buffer.from(ers.body || ""); }
    else if (u.pathname === "/api/plan") body = Buffer.from(JSON.stringify(planen(Object.fromEntries(u.searchParams)).body));
    else if (u.pathname === "/mcp" && opt.method === "POST") body = Buffer.from(JSON.stringify((await beantworte(JSON.parse(opt.body))).antwort));
    else if (SEITEN[u.pathname]) body = datei(SEITEN[u.pathname]);
    else if (STAND.includes(u.pathname.slice(1))) body = datei(u.pathname.slice(1));
    else status = 404;
    return { status, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
  };
  return { fetchFn, rufe };
}
const lauf = (s) => pruefen({ fetch: s.fetchFn, dateien: async (n) => datei(n), planen, pauseMs: 0 });

// So antwortet Netlify, wenn es zu einer Adresse keine Seite (mehr) gibt -- am 26.11.26 gesehen.
const WEG = { status: 404, body: "Not Found - Request ID: 01M8C2CGF02VKRKN8B6GF34ZX7" };

test("Alles gut: jede Seite antwortet, der Stand ist der von main, die Schnittstelle rechnet gleich", async () => {
  const s = seite();
  const erg = await lauf(s);
  assert.deepEqual(erg.befunde, []);
  assert.equal(erg.ok, true);
  // Jede Adresse aus den drei Listen wurde wirklich gefragt.
  const gefragt = new Set(s.rufe.map((r) => r.pfad));
  for (const p of Object.keys(SEITEN)) assert.ok(gefragt.has(p), p + " wurde nicht geprüft");
  for (const n of STAND) assert.ok(gefragt.has("/" + n), n + " wurde nicht verglichen");
  assert.equal(s.rufe.filter((r) => r.pfad === "/api/plan").length, PROBEN.length);
  // Der MCP-Anschluss: genau EIN Werkzeug-Aufruf, als JSON per POST.
  const mcp = s.rufe.filter((r) => r.pfad === "/mcp");
  assert.equal(mcp.length, 1);
  assert.deepEqual([mcp[0].methode, mcp[0].art], ["POST", "application/json"]);
  assert.deepEqual(JSON.parse(mcp[0].koerper), mcpAnfrage(PROBEN[0]));
  // Seiten nur mit HEAD (app.html wiegt fast 1 MB und liefe sonst jede Stunde durch die Leitung).
  for (const r of s.rufe) if (SEITEN[r.pfad]) assert.equal(r.methode, "HEAD", r.pfad);
  // Und jeder Aufruf sagt, wer er ist.
  for (const r of s.rufe) assert.equal(r.kennung, KENNUNG);
  assert.match(bericht(erg), /erreichbar und zeigt den Stand von main/);
});

test("Seite weg (der Fall vom 26.11.26): EIN Befund „nicht erreichbar“, kein Folgelärm", async () => {
  const s = seite(() => WEG);
  const erg = await lauf(s);
  assert.equal(erg.ok, false);
  assert.equal(erg.befunde.length, 1, JSON.stringify(erg.befunde));
  assert.equal(erg.befunde[0].art, "ausfall");
  assert.match(erg.befunde[0].text, /nicht erreichbar/);
  assert.match(erg.befunde[0].text, /Status 404/);
  // Ist alles weg, wird weder der Stand verglichen noch die Schnittstelle gerufen.
  assert.ok(!s.rufe.some((r) => r.pfad === "/api/plan" || r.pfad === "/mcp" || STAND.includes(r.pfad.slice(1))));
});

test("Gar keine Antwort (Netz, DNS): gilt als Ausfall und nennt den Grund", async () => {
  const fehler = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
  const erg = await lauf(seite(() => fehler));
  assert.equal(erg.ok, false);
  assert.equal(erg.befunde[0].art, "ausfall");
  assert.match(erg.befunde[0].text, /ENOTFOUND/);
});

test("Ein einzelner Aussetzer ist kein Ausfall: der zweite Versuch zählt", async () => {
  // Jede Adresse scheitert beim ERSTEN Mal und antwortet beim zweiten.
  const gesehen = new Set();
  const s = seite((u, methode) => {
    const k = methode + " " + u.pathname + u.search;
    if (gesehen.has(k)) return null;
    gesehen.add(k);
    return u.pathname === "/app" ? { status: 502, body: "" } : new TypeError("fetch failed");
  });
  const erg = await lauf(s);
  assert.deepEqual(erg.befunde, []);
  assert.equal(erg.ok, true);
});

test("Stand veraltet (ein Merge ging nicht live): der Befund nennt die Dateien und den Ort zum Nachsehen", async () => {
  // Die Seite antwortet, liefert aber eine ältere sitemap.xml und eine ältere Sprachdatei.
  const s = seite((u) => (u.pathname === "/sitemap.xml" || u.pathname === "/sprache/es.js") ? { status: 200, body: "alter Stand" } : null);
  const erg = await lauf(s);
  assert.equal(erg.ok, false);
  const stand = erg.befunde.filter((b) => b.art === "stand");
  assert.equal(stand.length, 1, "ein Befund für den Stand, nicht einer je Datei");
  assert.match(stand[0].text, /nicht den Stand von main/);
  assert.match(stand[0].text, /sitemap\.xml/);
  assert.match(stand[0].text, /sprache\/es\.js/);
  assert.match(stand[0].text, /Deploys/);
  assert.equal(erg.befunde.length, 1, JSON.stringify(erg.befunde));
});

test("Schon EIN abweichendes Byte zählt — verglichen wird der Inhalt, nicht die Länge", async () => {
  const echt = datei("llms.txt");
  const kopie = Buffer.from(echt);
  kopie[kopie.length - 2] = kopie[kopie.length - 2] === 0x61 ? 0x62 : 0x61;
  const erg = await lauf(seite((u) => u.pathname === "/llms.txt" ? { status: 200, body: kopie } : null));
  assert.equal(erg.ok, false);
  assert.match(erg.befunde[0].text, /llms\.txt weicht ab/);
});

test("Eine einzelne Seite fehlt: sie wird genannt, der Rest trotzdem geprüft", async () => {
  const s = seite((u) => u.pathname === "/en/" ? WEG : null);
  const erg = await lauf(s);
  assert.equal(erg.ok, false);
  assert.deepEqual(erg.befunde.map((b) => b.art), ["seite"]);
  assert.match(erg.befunde[0].text, /^\/en\/ antwortet nicht mit 200 \(Status 404\)/);
  assert.ok(s.rufe.some((r) => r.pfad === "/api/plan"), "die Schnittstelle wurde trotzdem geprüft");
});

test("Schnittstelle: fehlt sie oder rechnet sie anders als main, ist das ein Befund — die Tagesgrenze nicht", async () => {
  // Fehlt (z. B. die Function wurde nicht mitveröffentlicht).
  let erg = await lauf(seite((u) => u.pathname === "/api/plan" ? WEG : null));
  assert.equal(erg.ok, false);
  assert.deepEqual(erg.befunde.map((b) => b.art), ["api"]);
  assert.match(erg.befunde[0].text, /\/api\/plan antwortet nicht mit 200/);

  // Rechnet anders: 10 statt 11 Paletten verladen.
  erg = await lauf(seite((u) => {
    if (u.pathname !== "/api/plan") return null;
    const b = planen(Object.fromEntries(u.searchParams)).body;
    return { status: 200, body: JSON.stringify({ ...b, plan: { ...b.plan, pieces_loaded: b.plan.pieces_loaded - 1 } }) };
  }));
  assert.equal(erg.ok, false);
  assert.equal(erg.befunde.length, PROBEN.length);
  assert.match(erg.befunde[0].text, /rechnet anders als main/);

  // Kein JSON (eine Fehlerseite mit Status 200).
  erg = await lauf(seite((u) => u.pathname === "/api/plan" ? { status: 200, body: "<html>" } : null));
  assert.equal(erg.ok, false);

  // Tagesgrenze: nicht prüfbar, aber kein Alarm.
  erg = await lauf(seite((u) => u.pathname === "/api/plan" ? { status: 429, body: "{}" } : null));
  assert.equal(erg.ok, true);
  assert.match(erg.notizen.join(" "), /Tagesgrenze/);
  assert.match(bericht(erg), /Hinweis: .*Tagesgrenze/);
});

test("MCP-Anschluss: fehlt er oder rechnet er anders als main, ist das ein Befund — die Tagesgrenze nicht", async () => {
  // Fehlt (die Function wurde nicht mitveröffentlicht) -- im Browser ruft sie nichts auf, es fiele sonst niemandem auf.
  let erg = await lauf(seite((u) => u.pathname === "/mcp" ? WEG : null));
  assert.equal(erg.ok, false);
  assert.deepEqual(erg.befunde.map((b) => b.art), ["mcp"]);
  assert.match(erg.befunde[0].text, /\/mcp antwortet nicht mit 200 \(Status 404\)/);

  // Rechnet anders: ein Stück weniger verladen.
  const echt = async (opt) => (await beantworte(JSON.parse(opt))).antwort;
  erg = await lauf(seite((u) => {
    if (u.pathname !== "/mcp") return null;
    const b = planen(PROBEN[0]).body;
    const falsch = { ...b, plan: { ...b.plan, pieces_loaded: b.plan.pieces_loaded - 1 } };
    return { status: 200, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [], structuredContent: falsch, isError: false } }) };
  }));
  assert.deepEqual(erg.befunde.map((b) => b.art), ["mcp"]);
  assert.match(erg.befunde[0].text, /plan_load\) rechnet anders als main/);

  // Keine Antwort im Format des Protokolls: eine Fehlerseite mit Status 200, ein Protokollfehler, ein leeres Ergebnis.
  for (const body of ["<html>", JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }), JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} })]) {
    erg = await lauf(seite((u) => u.pathname === "/mcp" ? { status: 200, body } : null));
    assert.deepEqual(erg.befunde.map((b) => b.art), ["mcp"], body.slice(0, 40));
  }

  // Tagesgrenze: so, wie die Function sie WIRKLICH meldet (Deckel zu) -- nicht prüfbar, aber kein Alarm.
  const zu = (await beantworte(mcpAnfrage(PROBEN[0]), {}, async () => false)).antwort;
  assert.equal(zu.result.isError, true);
  assert.match(JSON.stringify(zu.result.content), MCP_TAGESGRENZE, "die Function meldet die Tagesgrenze mit anderem Wortlaut, als der Wächter erwartet");
  erg = await lauf(seite((u) => u.pathname === "/mcp" ? { status: 200, body: JSON.stringify(zu) } : null));
  assert.equal(erg.ok, true);
  assert.match(erg.notizen.join(" "), /\/mcp: Tagesgrenze/);

  // Ein anderer Fehler des Werkzeugs (isError ohne Tagesgrenze) ist dagegen ein Befund.
  const kaputt = { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "The calculation failed." }], isError: true } };
  erg = await lauf(seite((u) => u.pathname === "/mcp" ? { status: 200, body: JSON.stringify(kaputt) } : null));
  assert.deepEqual(erg.befunde.map((b) => b.art), ["mcp"]);

  // Die Probe ist ein gültiger Aufruf: die echte Function beantwortet sie mit den Zahlen von main.
  const gut = await echt(JSON.stringify(mcpAnfrage(PROBEN[0])));
  assert.deepEqual(kern(gut.result.structuredContent), kern(planen(PROBEN[0]).body));
  assert.equal(gut.result.isError, false);
});

test("Die Probe-Rechnungen ergeben auf main eine echte Antwort (sonst vergliche der Wächter null mit null)", () => {
  assert.ok(PROBEN.length >= 2);
  const arten = new Set();
  for (const p of PROBEN) {
    const a = planen(p);
    assert.equal(a.status, 200, p.q);
    const k = kern(a.body);
    assert.ok(k, p.q + ": keine Zahlen in der Antwort");
    assert.ok(k.pieces > 0 && k.loaded === k.pieces && k.one === true, p.q + ": " + JSON.stringify(k));
    arten.add(k.mode);
  }
  assert.deepEqual([...arten].sort(), ["road", "sea"], "See und Straße je einmal");
  assert.equal(kern({ ok: false }), null);
});

test("Die Listen zeigen auf Dateien, die es gibt — und der Stand-Vergleich fasst kein HTML an", () => {
  assert.equal(BASIS, "https://containerload.io");
  for (const [p, f] of Object.entries(SEITEN)) assert.ok(existsSync(path.join(SEITE, f)), `${p}: ${f} fehlt`);
  // Jeder Aufruf zählt beim Hoster mit: die Liste bleibt kurz.
  assert.ok(Object.keys(SEITEN).length + STAND.length + PROBEN.length <= 14, "der Wächter soll sparsam bleiben");
  assert.ok(SEITEN["/"] && SEITEN["/app"], "Startseite und Rechner gehören dazu");
  for (const n of STAND) {
    assert.ok(existsSync(path.join(SEITE, n)), n + " fehlt");
    // Netlify schreibt HTML mit Formularen beim Veröffentlichen um (app.html trägt eines):
    // ein Byte-Vergleich schlüge dort falschen Alarm.
    assert.ok(!/\.html?$/.test(n), n + ": HTML gehört nicht in den Stand-Vergleich");
  }
  assert.ok(STAND.includes("sitemap.xml") && STAND.some((n) => n.startsWith("sprache/")), "neue Seiten und neue Texte müssen auffallen");
  assert.match(KENNUNG, /containerload-erreichbar/);
});

test("Der Workflow: Stundentakt und Knopf, kein Lauf bei Pull Requests, zweiter Anlauf vor dem Alarm", () => {
  const yml = readFileSync(path.join(WURZEL, ".github/workflows/erreichbar.yml"), "utf8");
  const ohneKommentar = yml.split("\n").filter((z) => !/^\s*#/.test(z)).join("\n");
  assert.match(ohneKommentar, /\n {2}schedule:\n {4}- cron: "\d{1,2} \* \* \* \*"/, "stündlich");
  assert.match(ohneKommentar, /\n {2}workflow_dispatch:/);
  // Ein Ausfall der Seite darf keinen Pull Request rot färben.
  assert.ok(!/pull_request|\n {2}push:/.test(ohneKommentar), "kein Lauf bei Pull Requests oder Pushes");
  assert.match(ohneKommentar, /permissions:\n {2}contents: read\n/, "nur Leserechte");
  assert.ok(!/secrets\./.test(ohneKommentar), "der Wächter braucht keine Geheimnisse");
  // Verglichen wird mit main, auch wenn der Knopf auf einem anderen Zweig gedrückt wird.
  assert.match(ohneKommentar, /ref: main/);
  // Erst der zweite Befund zählt.
  assert.equal((ohneKommentar.match(/node werkzeug\/erreichbar\.mjs/g) || []).length, 2);
  assert.match(ohneKommentar, /id: erste\n\s+continue-on-error: true/);
  assert.match(ohneKommentar, /if: steps\.erste\.outcome == 'failure'/);
  assert.match(ohneKommentar, /sleep 300\n\s+git fetch --depth 1 origin main\n\s+git checkout --force FETCH_HEAD/);
  // Keine Abhängigkeiten: kein npm-Schritt.
  assert.ok(!/npm (ci|install)/.test(ohneKommentar));
});

test("Das Skript lädt nichts außer Node und dem Rechenkern", () => {
  const js = readFileSync(path.join(WURZEL, "werkzeug/erreichbar.mjs"), "utf8");
  const importe = [...js.matchAll(/(?:from|import\()\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const i of importe) assert.ok(i.startsWith("node:") || i === "../netlify/functions/lib/plan.mjs", "unerwarteter Import: " + i);
  // lib/plan.mjs selbst zieht nur den erzeugten Rechenkern (kein @netlify/blobs) -- sonst
  // bräuchte der Workflow einen Install-Schritt.
  const plan = readFileSync(path.join(WURZEL, "netlify/functions/lib/plan.mjs"), "utf8");
  for (const m of plan.matchAll(/from\s+"([^"]+)"/g)) assert.ok(m[1].startsWith("./"), "lib/plan.mjs lädt " + m[1]);
});
