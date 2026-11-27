// /mcp -- ContainerLoad als Werkzeug fuer KI-Assistenten (MCP, "Streamable HTTP").
// Die Logik steht in lib/mcp.mjs; hier ist nur die HTTP-Huelle.
//
// Zustandslos: jede Anfrage ist ein POST mit EINER JSON-RPC-Nachricht und bekommt EINE
// JSON-Antwort. Es gibt keine Sitzung (keine Mcp-Session-Id wird vergeben oder gelesen) und
// keinen Ereignis-Strom -- GET antwortet deshalb mit 405, wie es das Protokoll vorsieht.
//
// Oeffentlich, ohne Schluessel, ohne Konto -- wie /api/plan, und mit demselben Tagesdeckel:
// gespeichert wird EINE Zahl je Tag, keine IP wird gelesen, kein Ladungstext abgelegt.
// CORS ist offen: die Antwort enthaelt nichts, was nicht jeder ueber den Link ausrechnen kann.
import { beantworte, fehlerAntwort, CODE } from "./lib/mcp.mjs";
import { planDeckel } from "./lib/deckel.mjs";

const KOPF = { "access-control-allow-origin": "*", "x-robots-tag": "noindex", "cache-control": "no-store" };
const ERLAUBT = "content-type, accept, authorization, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id";
// Eine Nachricht mit 6.000 Zeichen Ladung bleibt weit darunter; mehr ist kein Werkzeug-Aufruf.
const MAX_ZEICHEN = 100000;
const json = (status, body, mehr = {}) => new Response(JSON.stringify(body), { status, headers: { ...KOPF, "content-type": "application/json; charset=utf-8", ...mehr } });

// Kopfzeilen der neuen Protokoll-Fassung duerfen Nicht-ASCII als "=?base64?...?=" tragen.
function klartext(v) {
  if (typeof v !== "string") return "";
  const m = /^=\?base64\?([A-Za-z0-9+/=_-]*)\?=$/.exec(v.trim());
  if (!m) return v.trim();
  try { return Buffer.from(m[1], "base64").toString("utf8"); } catch (e) { return v.trim(); }
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...KOPF, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": ERLAUBT, "access-control-max-age": "86400" } });
  }
  if (req.method !== "POST") {
    return json(405, fehlerAntwort(null, CODE.anfrage, "This is the MCP endpoint of ContainerLoad (https://containerload.io). Use POST with a JSON-RPC message; there is no event stream. Add this address as a connector in your AI assistant."), { allow: "POST, OPTIONS" });
  }
  let text = "";
  try { text = await req.text(); } catch (e) { text = ""; }
  if (text.length > MAX_ZEICHEN) return json(413, fehlerAntwort(null, CODE.anfrage, "Request too large."));
  let body;
  try { body = JSON.parse(text); } catch (e) { return json(400, fehlerAntwort(null, CODE.parse, "Parse error: the request body is not valid JSON.")); }

  // Mehrere Nachrichten in einem Feld kannte nur die Fassung 2025-03-26; wer sie schickt,
  // bekommt die Antworten als Feld zurueck (ohne Kopfzeilen-Abgleich: der gilt je Anfrage).
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return json(400, fehlerAntwort(null, CODE.anfrage, "Invalid Request: a batch must hold 1 to 20 messages."));
    const antworten = [];
    for (const msg of body) {
      const r = await beantworte(msg, {}, planDeckel);
      if (r) antworten.push(r.antwort);
    }
    return antworten.length ? json(200, antworten) : new Response(null, { status: 202, headers: KOPF });
  }

  const kopf = {
    version: req.headers.get("mcp-protocol-version") || "",
    methode: klartext(req.headers.get("mcp-method") || ""),
    name: klartext(req.headers.get("mcp-name") || ""),
  };
  const r = await beantworte(body, kopf, planDeckel);
  // Benachrichtigungen (ohne id) werden nur angenommen.
  if (!r) return new Response(null, { status: 202, headers: KOPF });
  return json(r.http, r.antwort);
};

export const config = { path: "/mcp" };
