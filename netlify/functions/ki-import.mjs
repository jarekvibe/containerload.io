// POST /api/ki-import — nimmt den eingefuegten Listentext aus dem Import-
// Dialog entgegen, laesst Claude die Positionen herauslesen (strukturierte
// Ausgabe, festes Schema) und antwortet mit Zeilen in der Form der Pruef-
// Tabelle. Der API-Schluessel lebt NUR hier (Netlify-Umgebungsvariable
// ANTHROPIC_API_KEY) — er darf nie in den Browser-Code.
//
// Deckel gegen Missbrauch des offenen Endpunkts, ohne je eine IP zu lesen
// (dieselbe Linie wie beacon.mjs): Herkunftspruefung, Textlaenge, und ein
// GLOBALER Tageszaehler in Netlify Blobs (Store "ki"). Der Zaehler wird VOR
// dem KI-Aufruf erhoeht — er schuetzt das Guthaben, nicht die Statistik.
//
// Modellwahl: Standard ist Claude Haiku 5.5 — schnell genug fuer die
// 10-Sekunden-Grenze synchroner Netlify Functions und bei ~0,05 Cent je
// Import praktisch gratis. Per Umgebungsvariable KI_MODELL umstellbar
// (z. B. auf claude-opus-5-5, wenn der Netlify-Plan laengere Laufzeiten
// erlaubt); die Fehlleistungen faengt so oder so die Pruef-Tabelle.
import Anthropic from "@anthropic-ai/sdk";
import { KI_AUFTRAG, KI_SCHEMA, TEXT_MAX, kiNachricht, pruefePositionen } from "./lib/ki.mjs";

const TAGESLIMIT = Math.max(1, parseInt(process.env.KI_TAGESLIMIT, 10) || 400);

// Weiches Tageslimit ueber Netlify Blobs. Faellt der Speicher aus, laeuft der
// Import weiter (fail-open): die harten Deckel (Origin, Laenge, Guthaben-
// Obergrenze in der Anthropic-Konsole) stehen unabhaengig davon.
async function tagesdeckel() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("ki");
    const key = `z/${new Date().toISOString().slice(0, 10)}`;
    const stand = (await store.get(key, { type: "json" })) || { n: 0 };
    if (stand.n >= TAGESLIMIT) return false;
    await store.setJSON(key, { n: stand.n + 1 });
  } catch (e) {
    console.error("ki-import: Tageszaehler nicht erreichbar:", e && e.message);
  }
  return true;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  // Weiche Herkunftspruefung gegen Fremdnutzung (wie beacon.mjs: kein
  // Sicherheitsversprechen, haelt aber achtlose Skripte fern).
  const origin = req.headers.get("origin");
  if (origin && !/^https:\/\/(www\.)?containerload\.io$/.test(origin)) {
    return new Response("", { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ fehler: "ANTHROPIC_API_KEY ist in Netlify nicht gesetzt." }, { status: 503 });
  }
  let text = "";
  try { text = String((await req.json()).text || ""); } catch {}
  text = text.trim();
  if (!text) return Response.json({ fehler: "leer" }, { status: 400 });
  if (text.length > TEXT_MAX) return Response.json({ fehler: "zu lang" }, { status: 413 });
  if (!(await tagesdeckel())) return Response.json({ fehler: "limit" }, { status: 429 });

  const client = new Anthropic({ timeout: 20000, maxRetries: 0 });
  try {
    const antwort = await client.messages.create({
      model: process.env.KI_MODELL || "claude-haiku-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: { type: "json_schema", schema: KI_SCHEMA } },
      system: KI_AUFTRAG,
      messages: [{ role: "user", content: kiNachricht(text) }],
    });
    const block = antwort.content.find((b) => b.type === "text");
    let daten = null;
    try { daten = JSON.parse(block ? block.text : ""); } catch {}
    return Response.json({ positionen: pruefePositionen(daten) });
  } catch (e) {
    // Vom Speziellen zum Allgemeinen; nach aussen nur eine knappe Einordnung,
    // Details stehen im Function-Log.
    console.error("ki-import:", e && e.status, e && e.message);
    if (e instanceof Anthropic.RateLimitError) return Response.json({ fehler: "ausgelastet" }, { status: 503 });
    if (e instanceof Anthropic.APIConnectionError) return Response.json({ fehler: "zeit" }, { status: 504 });
    if (e instanceof Anthropic.APIError) return Response.json({ fehler: "api" }, { status: 502 });
    return Response.json({ fehler: "unbekannt" }, { status: 500 });
  }
};

export const config = { path: "/api/ki-import" };
