// POST /api/ki-chat — der Lade-Assistent (Stufe 4 der KI-Integration).
// Die App schickt je Nachricht: die ECHTEN Fakten des aktuellen Plans, den
// kurzen Verlauf dieser Unterhaltung und die neue Nachricht. Claude antwortet
// kurz und darf Aenderungen NUR ueber das geschlossene Aktions-Woerterbuch
// vorschlagen (CHAT_SCHEMA); ausgefuehrt werden sie in der App ueber dieselben
// Setter wie von Hand — mit Undo. Ergebniszahlen nach einer Aktion kennt die
// KI nicht und nennt sie nicht: gerechnet wird im Packer.
//
// Schluessel, Herkunftspruefung, Tagesdeckel, Modellwahl: wie ki-import.mjs.
import Anthropic from "@anthropic-ai/sdk";
import { BRIEF_SPRACHEN, CHAT_AUFTRAG, CHAT_SCHEMA, CHAT_TEXT_MAX, chatNachricht, pruefeChatAntwort, pruefeFakten, pruefeVerlauf } from "./lib/ki.mjs";
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
  let sprache = "de", fakten = null, verlauf = [], frage = "";
  try {
    const body = await req.json();
    sprache = BRIEF_SPRACHEN.includes(body.sprache) ? body.sprache : "de";
    fakten = pruefeFakten(body.fakten, false);
    verlauf = pruefeVerlauf(body.verlauf);
    frage = String(body.frage || "").trim().slice(0, CHAT_TEXT_MAX);
  } catch {}
  if (!fakten || !frage) return Response.json({ fehler: "fakten" }, { status: 400 });
  if (!(await tagesdeckel())) return Response.json({ fehler: "limit" }, { status: 429 });

  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  try {
    const antwort = await client.messages.create({
      model: process.env.KI_MODELL || "claude-haiku-5-5",
      max_tokens: 1600,
      output_config: { effort: "low", format: { type: "json_schema", schema: CHAT_SCHEMA } },
      system: CHAT_AUFTRAG,
      // Zwei Stevie-Antworten hintereinander (Ankuendigung + Nachzug) waeren zwei
      // assistant-Zuege in Folge — die API verlangt den Wechsel, also zusammenlegen.
      messages: [
        ...verlauf.map((m) => ({ role: m.rolle === "ki" ? "assistant" : "user", content: m.text })),
        { role: "user", content: chatNachricht({ sprache, ...fakten }, frage) },
      ].reduce((acc, m) => {
        const letzte = acc[acc.length - 1];
        if (letzte && letzte.role === m.role) letzte.content += "\n\n" + m.content;
        else acc.push({ ...m });
        return acc;
      }, []),
    });
    const block = antwort.content.find((b) => b.type === "text");
    let daten = null;
    try { daten = JSON.parse(block ? block.text : ""); } catch {}
    const geprueft = pruefeChatAntwort(daten);
    if (!geprueft) return Response.json({ fehler: "leer" }, { status: 502 });
    return Response.json(geprueft);
  } catch (e) {
    console.error("ki-chat:", e && e.status, e && e.message);
    if (e instanceof Anthropic.RateLimitError) return Response.json({ fehler: "ausgelastet" }, { status: 503 });
    if (e instanceof Anthropic.APIConnectionError) return Response.json({ fehler: "zeit" }, { status: 504 });
    if (e instanceof Anthropic.APIError) return Response.json({ fehler: "api" }, { status: 502 });
    return Response.json({ fehler: "unbekannt" }, { status: 500 });
  }
};

export const config = { path: "/api/ki-chat" };
