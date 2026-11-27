// Der MCP-Anschluss (/mcp): ContainerLoad als Werkzeug fuer KI-Assistenten.
// Jareks Zusage vom 27.11.26: "Lass uns den Anschluss fuer die KI bauen."
//
// Was hier festgehalten wird:
//   1. ES RECHNET NUR planen(). Das Werkzeug plan_load ist eine Huelle um dieselbe Rechnung
//      wie /api/plan und der Link /app?q= -- kein zweiter Rechner, keine KI.
//   2. BEIDE FASSUNGEN DES PROTOKOLLS werden bedient: die Anmeldung mit "initialize" (bis
//      2025-11-25) und die zustandslose Fassung 2026-07-28 (server/discover, Fassung je
//      Anfrage, resultType). Quelle der Regeln: schema.ts und changelog der Fassung 2026-07-28
//      im Repository der Spezifikation (gelesen 27.11.26); zum HTTP-Transport eine Websuche.
//   3. ZUSTANDSLOS UND SPARSAM: keine Sitzung, kein Strom, keine IP, derselbe Tagesdeckel
//      wie /api/plan.
//
// Was dieser Test NICHT kann: einen echten Assistenten anschliessen. Das prueft Jarek an der
// Vorschau-Adresse (CLAUDE.md, "Der MCP-Anschluss").
//
// node --test test/mcp.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import handler, { config } from "../../netlify/functions/mcp.mjs";
import { beantworte, WERKZEUG, VERSIONEN, NEU, ALT, SERVER, ANLEITUNG, CODE } from "../../netlify/functions/lib/mcp.mjs";
import { planen, GRENZEN } from "../../netlify/functions/lib/plan.mjs";
import { CONT_CODES, FZ_CODES, EINHEITEN, SPRACHEN } from "../../netlify/functions/lib/rechenkern.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const quelle = (f) => fs.readFileSync(path.join(dir, "..", "..", "netlify", "functions", f), "utf8");
const ADRESSE = "https://containerload.io/mcp";
const post = (body, kopf = {}) => handler(new Request(ADRESSE, {
  method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...kopf },
  body: typeof body === "string" ? body : JSON.stringify(body),
}));
const rpc = async (method, params, kopf = {}, id = 1) => {
  const r = await post({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) }, kopf);
  return { status: r.status, art: r.headers.get("content-type") || "", kopf: r.headers, body: r.status === 202 ? null : await r.json() };
};
const LADUNG = "22 pallets 120x80x100 300kg not stackable; 6 boxes 60x40x40 12kg";

test("die Function haengt an /mcp und antwortet mit JSON, offen fuer jeden Ursprung", async () => {
  assert.deepStrictEqual(config, { path: "/mcp" });
  const r = await rpc("ping");
  assert.strictEqual(r.status, 200);
  assert.match(r.art, /^application\/json/);
  assert.strictEqual(r.kopf.get("access-control-allow-origin"), "*");
  assert.strictEqual(r.kopf.get("x-robots-tag"), "noindex");
  assert.strictEqual(r.kopf.get("cache-control"), "no-store");
  assert.deepStrictEqual(r.body, { jsonrpc: "2.0", id: 1, result: {} });
});

test("alte Fassung: initialize handelt die Fassung aus, danach Liste und Aufruf -- ohne Sitzung", async () => {
  for (const v of ALT) {
    const r = await rpc("initialize", { protocolVersion: v, capabilities: {}, clientInfo: { name: "test", version: "1" } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.result.protocolVersion, v, `Fassung ${v} wird nicht bestaetigt`);
    assert.deepStrictEqual(r.body.result.capabilities, { tools: { listChanged: false } });
    assert.deepStrictEqual(r.body.result.serverInfo, SERVER);
    assert.strictEqual(r.body.result.instructions, ANLEITUNG);
    assert.strictEqual(r.kopf.get("mcp-session-id"), null, "der Server vergibt keine Sitzung");
  }
  // Eine Fassung, die es bei "initialize" nicht gibt: der Server nennt seine neueste alte.
  const fremd = await rpc("initialize", { protocolVersion: "1999-01-01", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.strictEqual(fremd.body.result.protocolVersion, ALT[0]);
  // Die Bestaetigung des Clients ist eine Benachrichtigung: angenommen, keine Antwort.
  const notiz = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-protocol-version": ALT[0] });
  assert.strictEqual(notiz.status, 202);
  assert.strictEqual(await notiz.text(), "");
  // Liste und Aufruf wie ein alter Client: mit der ausgehandelten Fassung in der Kopfzeile, ohne die neuen Felder.
  const liste = await rpc("tools/list", {}, { "mcp-protocol-version": ALT[0] });
  assert.deepStrictEqual(liste.body.result, { tools: [WERKZEUG] });
  const ruf = await rpc("tools/call", { name: "plan_load", arguments: { cargo: LADUNG } }, { "mcp-protocol-version": ALT[0] });
  assert.strictEqual(ruf.body.result.isError, false);
  assert.ok(!("resultType" in ruf.body.result) && !("_meta" in ruf.body.result), "alte Clients bekommen die Felder der neuen Fassung nicht");
});

test("neue Fassung: server/discover statt Anmeldung, die Fassung reist in jeder Anfrage mit", async () => {
  const kopf = { "mcp-protocol-version": NEU };
  const meta = { _meta: { "io.modelcontextprotocol/protocolVersion": NEU, "io.modelcontextprotocol/clientCapabilities": {} } };
  const d = await rpc("server/discover", meta, { ...kopf, "mcp-method": "server/discover" });
  assert.strictEqual(d.status, 200);
  assert.deepStrictEqual(d.body.result, {
    supportedVersions: VERSIONEN, capabilities: { tools: {} }, instructions: ANLEITUNG,
    _meta: { "io.modelcontextprotocol/serverInfo": SERVER },
    resultType: "complete", ttlMs: 3600000, cacheScope: "public",
  });
  assert.strictEqual(VERSIONEN[0], NEU);
  assert.deepStrictEqual(VERSIONEN.slice(1), ALT);
  // Liste: mit resultType und den Angaben zum Merken (ohne sie zeigen manche Clients keine Werkzeuge).
  const l = await rpc("tools/list", meta, { ...kopf, "mcp-method": "tools/list" });
  // Und JEDES Ergebnis nennt in _meta, wer antwortet -- eine Anmeldung, die es einmal sagt, gibt es nicht mehr.
  const WER = { "io.modelcontextprotocol/serverInfo": SERVER };
  assert.deepStrictEqual(l.body.result, { tools: [WERKZEUG], resultType: "complete", ttlMs: 3600000, cacheScope: "public", _meta: WER });
  // Aufruf ohne jede Anmeldung, die Kopfzeilen spiegeln Methode und Werkzeug.
  const c = await rpc("tools/call", { name: "plan_load", arguments: { cargo: LADUNG, container: "40hc" }, ...meta }, { ...kopf, "mcp-method": "tools/call", "mcp-name": "plan_load" });
  assert.strictEqual(c.status, 200);
  assert.strictEqual(c.body.result.resultType, "complete");
  assert.ok(!("ttlMs" in c.body.result), "ein Ergebnis ist keine Liste: es wird nicht gemerkt");
  assert.strictEqual(c.body.result.isError, false);
  assert.deepStrictEqual(c.body.result._meta, WER);
  assert.strictEqual(c.kopf.get("mcp-session-id"), null);
  // Die Fassung steht nur in _meta (ohne Kopfzeile): gilt ebenso.
  const nurMeta = await rpc("ping", meta);
  assert.deepStrictEqual(nurMeta.body.result, { resultType: "complete", _meta: WER });
  // Die leeren Listen (Ressourcen, Vorlagen) sind Listen wie die der Werkzeuge: mit Merk-Angaben.
  for (const [methode, feld] of [["resources/list", "resources"], ["resources/templates/list", "resourceTemplates"], ["prompts/list", "prompts"]]) {
    const r = await rpc(methode, meta, { ...kopf, "mcp-method": methode });
    assert.deepStrictEqual(r.body.result, { [feld]: [], resultType: "complete", ttlMs: 3600000, cacheScope: "public", _meta: WER }, methode);
  }
});

test("Kopfzeile und Nachricht muessen dasselbe sagen; eine unbekannte Fassung wird mit der Liste abgelehnt", async () => {
  const meta = { _meta: { "io.modelcontextprotocol/protocolVersion": NEU } };
  const a = await rpc("tools/list", meta, { "mcp-protocol-version": ALT[0] });
  assert.deepStrictEqual([a.status, a.body.error.code], [400, CODE.kopf]);
  const b = await rpc("tools/list", {}, { "mcp-protocol-version": NEU, "mcp-method": "tools/call" });
  assert.deepStrictEqual([b.status, b.body.error.code], [400, CODE.kopf]);
  const c = await rpc("tools/call", { name: "plan_load", arguments: { cargo: LADUNG } }, { "mcp-protocol-version": NEU, "mcp-method": "tools/call", "mcp-name": "etwas_anderes" });
  assert.deepStrictEqual([c.status, c.body.error.code], [400, CODE.kopf]);
  // Der Name darf als base64 in der Kopfzeile stehen (Nicht-ASCII) -- und stimmt dann.
  const b64 = "=?base64?" + Buffer.from("plan_load").toString("base64") + "?=";
  const d = await rpc("tools/call", { name: "plan_load", arguments: { cargo: LADUNG } }, { "mcp-protocol-version": NEU, "mcp-method": "tools/call", "mcp-name": b64 });
  assert.strictEqual(d.status, 200);
  const e = await rpc("tools/list", {}, { "mcp-protocol-version": "2031-01-01" });
  assert.deepStrictEqual([e.status, e.body.error.code], [400, CODE.version]);
  assert.deepStrictEqual(e.body.error.data, { supported: VERSIONEN, requested: "2031-01-01" });
  assert.strictEqual(e.body.id, 1, "auch die Ablehnung traegt die id der Anfrage");
  // Die Codes der Fassung 2026-07-28.
  assert.deepStrictEqual([CODE.kopf, CODE.version], [-32020, -32022]);
  // Fehlen die Kopfzeilen (alte Clients), wird nichts abgelehnt.
  assert.strictEqual((await rpc("tools/list")).status, 200);
});

test("das Werkzeug: ein Eintrag, und seine Auswahllisten sind die des Rechners", () => {
  assert.strictEqual(WERKZEUG.name, "plan_load");
  const s = WERKZEUG.inputSchema;
  assert.strictEqual(s.type, "object");
  assert.deepStrictEqual(s.required, ["cargo"]);
  assert.strictEqual(s.additionalProperties, false);
  assert.deepStrictEqual(Object.keys(s.properties), ["cargo", "container", "mode", "vehicle", "unit", "language"]);
  assert.deepStrictEqual(s.properties.container.enum, Object.keys(CONT_CODES));
  assert.deepStrictEqual(s.properties.vehicle.enum, Object.keys(FZ_CODES));
  assert.deepStrictEqual(s.properties.unit.enum, EINHEITEN);
  assert.deepStrictEqual(s.properties.language.enum, SPRACHEN);
  assert.deepStrictEqual(s.properties.mode.enum, ["sea", "road"]);
  for (const [k, p] of Object.entries(s.properties)) assert.ok(p.type === "string" && p.description.length > 30, `${k}: Beschreibung fehlt`);
  // Nur lesen: das Werkzeug aendert nichts und fragt nichts Fremdes ab.
  assert.deepStrictEqual(WERKZEUG.annotations, { title: "Plan a container or truck load", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false });
  // Ehrlich, schon in der Beschreibung -- sie ist das, was der Assistent liest.
  assert.match(WERKZEUG.description, /Geometric estimate only: no load securing, axle loads or stability/);
  assert.match(WERKZEUG.description, new RegExp(`${GRENZEN.positionen} positions and ${GRENZEN.stueck.toLocaleString("en-US")} pieces`));
  assert.match(ANLEITUNG, /plan_url/);
  assert.match(ANLEITUNG, /does not check load securing, axle loads or stability/);
  // Das Beispiel der Beschreibung liest der Parser wirklich so.
  const bsp = /Example: '([^']+)'/.exec(s.properties.cargo.description)[1];
  const b = planen({ q: bsp }).body;
  assert.deepStrictEqual(b.cargo.map((c) => [c.qty, c.length_cm, c.width_cm, c.height_cm, c.weight_kg, c.stackable]), [[22, 120, 80, 100, 300, false], [6, 60, 40, 40, 12, true]]);
});

test("es rechnet nur planen(): das Ergebnis des Werkzeugs IST die Antwort der Schnittstelle", async () => {
  const faelle = [
    [{ cargo: LADUNG }, { q: LADUNG, lang: "en" }],
    [{ cargo: LADUNG, container: "40hc", language: "de" }, { q: LADUNG, cont: "40hc", lang: "de" }],
    [{ cargo: "33 europaletten 120x80x100 300kg nicht stapelbar", mode: "road" }, { q: "33 europaletten 120x80x100 300kg nicht stapelbar", d: "road", lang: "en" }],
    [{ cargo: "10 pallets 120x100x200 1000 kg", mode: "road", vehicle: "75t", unit: "in", language: "es" }, { q: "10 pallets 120x100x200 1000 kg", d: "road", fz: "75t", u: "in", lang: "es" }],
    [{ cargo: "34 Item 120x80x110 10000kg", container: "20gp" }, { q: "34 Item 120x80x110 10000kg", cont: "20gp", lang: "en" }],
    [{ cargo: "  20 pallets 120x100x200 1000 kg no apilables  ", container: "40rf" }, { q: "20 pallets 120x100x200 1000 kg no apilables", cont: "40rf", lang: "en" }],
  ];
  for (const [args, roh] of faelle) {
    const r = await rpc("tools/call", { name: "plan_load", arguments: args });
    const soll = planen(roh).body;
    assert.strictEqual(soll.ok, true, JSON.stringify(roh));
    const e = r.body.result;
    assert.strictEqual(e.isError, false);
    assert.deepStrictEqual(e.structuredContent, soll, `das Werkzeug rechnet anders als planen(): ${JSON.stringify(args)}`);
    // Zwei Textbloecke: der Satz mit dem Link, und dieselben Daten als JSON.
    assert.deepStrictEqual(e.content.map((c) => c.type), ["text", "text"]);
    assert.ok(e.content[0].text.startsWith(soll.summary + "\n3D plan: " + soll.plan_url), "der erste Block nennt Satz und Link nicht");
    for (const n of soll.notes) assert.ok(e.content[0].text.includes(n), "ein Hinweis der Rechnung fehlt im Text: " + n);
    assert.deepStrictEqual(JSON.parse(e.content[1].text), soll);
    assert.ok(soll.plan_url.startsWith("https://containerload.io/app?"));
  }
});

test("Fehler in den Argumenten sind Ergebnisse (isError), keine Protokollfehler -- das Modell soll sie lesen koennen", async () => {
  const ruf = async (args) => (await rpc("tools/call", { name: "plan_load", arguments: args })).body;
  for (const args of [undefined, {}, { cargo: "" }, { cargo: "   " }, { cargo: 42 }, { cargo: ["a"] }]) {
    const b = await ruf(args);
    assert.ok(b.result && b.result.isError === true, JSON.stringify(args));
    assert.match(b.result.content[0].text, /Argument 'cargo' is missing/);
  }
  assert.match((await ruf({ cargo: LADUNG, mode: "air" })).result.content[0].text, /'mode' must be 'sea' or 'road'/);
  assert.match((await ruf({ cargo: LADUNG, unit: "ft" })).result.content[0].text, /'unit' must be one of: cm, mm, in/);
  assert.match((await ruf({ cargo: LADUNG, language: "xx" })).result.content[0].text, /'language' must be one of/);
  assert.match((await ruf({ cargo: LADUNG, container: 40 })).result.content[0].text, /'container' must be a string/);
  // Ein unbekanntes Kuerzel lehnt planen() ab -- mit der Liste der gueltigen.
  const cont = await ruf({ cargo: LADUNG, container: "53ft" });
  assert.strictEqual(cont.result.isError, true);
  assert.match(cont.result.content[0].text, /Valid values: 20gp, /);
  assert.strictEqual(cont.result.structuredContent.error, "unknown_container");
  // Nichts erkannt, zu viele Stuecke: der Link in den Browser kommt trotzdem mit.
  const nichts = await ruf({ cargo: "hello there" });
  assert.strictEqual(nichts.result.isError, true);
  assert.strictEqual(nichts.result.structuredContent.error, "nothing_recognized");
  assert.match(nichts.result.content[0].text, /https:\/\/containerload\.io\/app\?/);
  const viele = await ruf({ cargo: "5000 boxes 30x20x20 5kg" });
  assert.strictEqual(viele.result.structuredContent.error, "too_many_pieces");
  assert.match(viele.result.content[0].text, /https:\/\/containerload\.io\/app\?/);
  const lang = await ruf({ cargo: "x".repeat(GRENZEN.zeichen + 1) });
  assert.strictEqual(lang.result.structuredContent.error, "too_long");
});

test("der Tagesdeckel: derselbe Zaehler wie /api/plan, und er zaehlt nur, was gerechnet wird", async () => {
  let gezaehlt = 0;
  const offen = async () => { gezaehlt++; return true; };
  const zu = async () => { gezaehlt++; return false; };
  const ruf = (args, deckel) => beantworte({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "plan_load", arguments: args } }, {}, deckel);
  await ruf({ cargo: LADUNG }, offen);
  assert.strictEqual(gezaehlt, 1);
  // Liste, Anmeldung, kaputte Argumente und zu langer Text kosten nichts.
  await beantworte({ jsonrpc: "2.0", id: 1, method: "tools/list" }, {}, offen);
  await beantworte({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: ALT[0] } }, {}, offen);
  await ruf({}, offen);
  await ruf({ cargo: LADUNG, mode: "air" }, offen);
  await ruf({ cargo: "x".repeat(GRENZEN.zeichen + 1) }, offen);
  assert.strictEqual(gezaehlt, 1, "der Deckel wurde fuer etwas gezaehlt, das nicht gerechnet wird");
  // Ist er erreicht: kein Ergebnis, aber der Link, der im Browser rechnet.
  const voll = await ruf({ cargo: LADUNG }, zu);
  assert.strictEqual(voll.antwort.result.isError, true);
  assert.match(voll.antwort.result.content[0].text, /daily limit/);
  assert.match(voll.antwort.result.content[0].text, /https:\/\/containerload\.io\/app\?lang=en&q=22%20pallets/);
  // Die Function reicht genau den Deckel der Schnittstelle durch.
  const f = quelle("mcp.mjs");
  assert.match(f, /import \{ planDeckel \} from "\.\/lib\/deckel\.mjs";/);
  assert.strictEqual((f.match(/beantworte\([^)]*planDeckel\)/g) || []).length, 2, "nicht jeder Weg durch die Function traegt den Deckel");
});

test("Protokollfehler: unbekanntes Werkzeug, unbekannte Methode, kaputtes JSON, falsche Anfrage", async () => {
  const w = await rpc("tools/call", { name: "delete_everything", arguments: {} });
  assert.deepStrictEqual([w.status, w.body.error.code], [200, CODE.parameter]);
  assert.match(w.body.error.message, /Unknown tool: delete_everything\. This server has one tool: plan_load\./);
  const m = await rpc("sampling/createMessage", {});
  assert.deepStrictEqual([m.status, m.body.error.code, m.body.id], [200, CODE.methode, 1]);
  const kaputt = await post("{ das ist kein json");
  assert.strictEqual(kaputt.status, 400);
  assert.deepStrictEqual(await kaputt.json(), { jsonrpc: "2.0", id: null, error: { code: CODE.parse, message: "Parse error: the request body is not valid JSON." } });
  for (const falsch of [{ id: 1, method: "ping" }, { jsonrpc: "1.0", id: 1, method: "ping" }, '"ping"', 7, { jsonrpc: "2.0", id: 1 }, { jsonrpc: "2.0", id: {}, method: "ping" }]) {
    const r = await post(falsch);
    assert.strictEqual(r.status, 400, JSON.stringify(falsch));
    assert.strictEqual((await r.json()).error.code, CODE.anfrage);
  }
  // Eine id als Zeichenkette kommt als Zeichenkette zurueck.
  assert.strictEqual((await rpc("ping", undefined, {}, "abc-1")).body.id, "abc-1");
  // Wer nach Ressourcen oder Vorlagen fragt, bekommt leere Listen statt eines Fehlers.
  assert.deepStrictEqual((await rpc("resources/list")).body.result, { resources: [] });
  assert.deepStrictEqual((await rpc("resources/templates/list")).body.result, { resourceTemplates: [] });
  assert.deepStrictEqual((await rpc("prompts/list")).body.result, { prompts: [] });
  // Zu grosse Anfrage.
  const gross = await post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "plan_load", arguments: { cargo: "x".repeat(120000) } } });
  assert.strictEqual(gross.status, 413);
});

test("nur POST: GET bekommt 405 (kein Ereignis-Strom), die Vorab-Frage des Browsers erlaubt die MCP-Kopfzeilen", async () => {
  for (const methode of ["GET", "DELETE", "PUT"]) {
    const r = await handler(new Request(ADRESSE, { method: methode, headers: { accept: "text/event-stream" } }));
    assert.strictEqual(r.status, 405, methode);
    assert.strictEqual(r.headers.get("allow"), "POST, OPTIONS");
    assert.match((await r.json()).error.message, /MCP endpoint of ContainerLoad/);
  }
  const o = await handler(new Request(ADRESSE, { method: "OPTIONS", headers: { origin: "https://claude.ai", "access-control-request-method": "POST" } }));
  assert.strictEqual(o.status, 204);
  assert.strictEqual(o.headers.get("access-control-allow-origin"), "*");
  assert.strictEqual(o.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  const erlaubt = o.headers.get("access-control-allow-headers").split(", ");
  for (const k of ["content-type", "accept", "mcp-protocol-version", "mcp-method", "mcp-name", "mcp-session-id"]) assert.ok(erlaubt.includes(k), `Kopfzeile ${k} ist nicht erlaubt`);
});

test("mehrere Nachrichten in einem Feld (Fassung 2025-03-26): Antworten als Feld, Benachrichtigungen ohne", async () => {
  const r = await post([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  assert.strictEqual(r.status, 200);
  const b = await r.json();
  assert.deepStrictEqual(b.map((x) => x.id), [1, 2]);
  assert.deepStrictEqual(b[1].result, { tools: [WERKZEUG] });
  const nurNotizen = await post([{ jsonrpc: "2.0", method: "notifications/initialized" }]);
  assert.strictEqual(nurNotizen.status, 202);
  assert.strictEqual((await post([])).status, 400);
  // Eine Antwort des Clients auf etwas, das dieser Server nie fragt, wird hingenommen.
  assert.strictEqual((await post({ jsonrpc: "2.0", id: 9, result: {} })).status, 202);
});

test("sparsam: keine IP, keine Kennung, nichts wird abgelegt -- und kein Paket ausser dem eigenen Code", () => {
  for (const f of ["mcp.mjs", "lib/mcp.mjs"]) {
    const s = quelle(f).replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/x-forwarded-for|x-nf-client|client-ip|context\.ip|\.geo\b|user-agent|cookie/i.test(s), `${f} liest etwas ueber den Aufrufer`);
    assert.ok(!/getStore|@netlify\/blobs/.test(s), `${f} speichert selbst etwas`);
    const importe = [...s.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    assert.ok(importe.length > 0 && importe.every((i) => i.startsWith("./")), `${f} laedt ein fremdes Paket: ${importe.join(", ")}`);
    assert.ok(!/set-cookie|mcp-session-id"\s*:/i.test(s.replace(/access-control-allow-headers[^\n]*/g, "")), `${f} vergibt eine Sitzung`);
  }
  // package.json der Functions kennt kein MCP-Paket: der Anschluss ist selbst geschrieben.
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "..", "..", "package.json"), "utf8"));
  assert.ok(!Object.keys(pkg.dependencies).some((k) => /modelcontextprotocol|zod/.test(k)));
});
