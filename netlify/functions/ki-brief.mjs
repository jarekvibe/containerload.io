// POST /api/ki-brief — "Plan erklaeren & versenden" (Stufe 3 der KI-
// Integration). Die App schickt die ECHTEN Fakten des gerechneten Plans
// (Equipment, Summen, Grund-Zeilen, Teilen-Link); Claude formuliert daraus
// einen kurzen E-Mail-Entwurf in der gewuenschten Sprache. Formulieren, nicht
// rechnen: jede Zahl kommt aus der App, der Link muss auf containerload.io
// zeigen (pruefeFakten), und der Mensch liest den Entwurf in einem
// bearbeitbaren Feld, bevor er ihn verschickt.
//
// Schluessel, Herkunftspruefung, Tagesdeckel und Modellwahl: dieselben
// Entscheidungen wie ki-import.mjs (dort begruendet).
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF_AUFTRAG, BRIEF_SCHEMA, briefNachricht, pruefeBrief, pruefeFakten } from "./lib/ki.mjs";
import { tagesdeckel } from "./lib/deckel.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  const origin = req.headers.get("origin");
  if (origin && !/^https:\/\/(www\.)?containerload\.io$/.test(origin)) {
    return new Response("", { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ fehler: "ANTHROPIC_API_KEY ist in Netlify nicht gesetzt." }, { status: 503 });
  }
  let fakten = null;
  try { fakten = pruefeFakten((await req.json()).fakten); } catch {}
  if (!fakten) return Response.json({ fehler: "fakten" }, { status: 400 });
  if (!(await tagesdeckel())) return Response.json({ fehler: "limit" }, { status: 429 });

  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  try {
    const antwort = await client.messages.create({
      model: process.env.KI_MODELL || "claude-haiku-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: BRIEF_SCHEMA } },
      system: BRIEF_AUFTRAG,
      messages: [{ role: "user", content: briefNachricht(fakten) }],
    });
    const block = antwort.content.find((b) => b.type === "text");
    let daten = null;
    try { daten = JSON.parse(block ? block.text : ""); } catch {}
    const brief = pruefeBrief(daten);
    if (!brief) return Response.json({ fehler: "leer" }, { status: 502 });
    return Response.json(brief);
  } catch (e) {
    console.error("ki-brief:", e && e.status, e && e.message);
    if (e instanceof Anthropic.RateLimitError) return Response.json({ fehler: "ausgelastet" }, { status: 503 });
    if (e instanceof Anthropic.APIConnectionError) return Response.json({ fehler: "zeit" }, { status: 504 });
    if (e instanceof Anthropic.APIError) return Response.json({ fehler: "api" }, { status: 502 });
    return Response.json({ fehler: "unbekannt" }, { status: 500 });
  }
};

export const config = { path: "/api/ki-brief" };
