// /api/plan -- der Rechner als Daten. Dieselben Parameter wie der Link /app?q=… (q, cont,
// d=road, fz, u, lang), dieselbe Rechnung (lib/plan.mjs → lib/rechenkern.mjs, aus app.html
// geschnitten), und in jeder Antwort plan_url: der Link, der genau das in 3D zeigt.
//
// Gedacht fuer KI-Assistenten, Tabellen und ERP/TMS (Fahrplan Baustein 5). Oeffentlich,
// ohne Schluessel, ohne Konto -- deshalb:
//   * nur lesen und rechnen: nichts wird gespeichert ausser EINER Zahl je Tag (der Deckel),
//     keine IP wird gelesen;
//   * Deckel fuer Textlaenge, Positionen und Packstuecke (lib/plan.mjs, GRENZEN) und ein
//     Tagesdeckel (lib/deckel.mjs) -- ist er erreicht, kommt 429 MIT dem Link zum 3D-Plan;
//   * GET oder POST (JSON oder Formular). CORS ist offen: die Antwort enthaelt nichts, was
//     nicht jeder ueber den Link ohnehin ausrechnen kann, und es gibt keine Anmeldung.
import { planen, planAdresse, GRENZEN } from "./lib/plan.mjs";
import { planDeckel } from "./lib/deckel.mjs";

export const FELDER = ["q", "cont", "d", "fz", "u", "lang"];
const KOPF = { "access-control-allow-origin": "*", "x-robots-tag": "noindex", "cache-control": "no-store" };
const json = (status, body) => new Response(JSON.stringify(body, null, 2), { status, headers: { ...KOPF, "content-type": "application/json; charset=utf-8" } });

// Liest die Parameter aus Adresse und (bei POST) Koerper. Der Koerper schlaegt die Adresse.
export async function eingabe(req) {
  const roh = {};
  const url = new URL(req.url);
  for (const k of FELDER) if (url.searchParams.has(k)) roh[k] = url.searchParams.get(k);
  if (req.method !== "POST") return roh;
  const text = await req.text();
  if (text.length > GRENZEN.zeichen * 2) return { ...roh, q: text };   // faellt unten an der Laenge
  const art = (req.headers.get("content-type") || "").toLowerCase();
  if (art.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(text);
    for (const k of FELDER) if (p.has(k)) roh[k] = p.get(k);
  } else if (text.trim().startsWith("{")) {
    let body = null;
    try { body = JSON.parse(text); } catch (e) { return { ...roh, kaputt: true }; }
    if (body && typeof body === "object") for (const k of FELDER) if (typeof body[k] === "string" || typeof body[k] === "number") roh[k] = String(body[k]);
  } else if (text.trim() && roh.q === undefined) {
    roh.q = text;   // reiner Text: die Ladung selbst
  }
  return roh;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...KOPF, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
  }
  if (req.method !== "GET" && req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed", message: "Use GET or POST." });
  let roh;
  try { roh = await eingabe(req); } catch (e) { roh = { kaputt: true }; }
  if (roh.kaputt) return json(400, { ok: false, error: "bad_request", message: "The request body is not valid JSON." });
  // Der Tagesdeckel zaehlt nur, was wirklich gerechnet wird
  const q = typeof roh.q === "string" ? roh.q.trim() : "";
  if (q && q.length <= GRENZEN.zeichen && !(await planDeckel())) {
    return json(429, { ok: false, error: "daily_limit", message: "The daily limit of this interface is reached. The link still works: it calculates in the browser.", plan_url: planAdresse(q, { lang: "en" }) });
  }
  try {
    const r = planen(roh);
    return json(r.status, r.body);
  } catch (e) {
    console.error("plan:", e && e.message);
    return json(500, { ok: false, error: "internal", message: "The calculation failed. The link still works: it calculates in the browser.", plan_url: q ? planAdresse(q, { lang: "en" }) : undefined });
  }
};

export const config = { path: "/api/plan" };
