// GET /api/statistik?tage=30 -- liest die Nutzungs-Events aus Netlify Blobs,
// aggregiert sie serverseitig und liefert Kennzahlen plus eine begrenzte
// Stichprobe roher Events fuers Admin-Dashboard (/admin).
//
// Zugang nur mit Bearer-Token gegen die Umgebungsvariable STATISTIK_TOKEN
// (Netlify UI -> Environment variables). Ohne gesetzte Variable antwortet
// die Function 503 mit Klartext -- ein leerer Soll-Wert darf niemals wie
// ein richtiges Token wirken.
import { timingSafeEqual } from "node:crypto";
import { aggregiere, feedbackAufbereiten, EVENTS_MAX } from "./lib/nutzung.mjs";

const gleich = (a, b) => {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export default async (req) => {
  if (req.method !== "GET") return new Response("", { status: 405 });
  const soll = process.env.STATISTIK_TOKEN || "";
  if (!soll) return Response.json({ fehler: "STATISTIK_TOKEN ist in Netlify nicht gesetzt." }, { status: 503 });
  const ist = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!ist || !gleich(ist, soll)) return Response.json({ fehler: "Token stimmt nicht." }, { status: 401 });

  const url = new URL(req.url);
  const tage = Math.min(90, Math.max(1, Math.round(+url.searchParams.get("tage")) || 30));
  const von = new Date(Date.now() - (tage - 1) * 86400000).toISOString().slice(0, 10);

  const { getStore } = await import("@netlify/blobs");
  const store = getStore("nutzung");
  // Schluessel sortieren lexikographisch nach Tag (e/YYYY-MM-DD/...): ein
  // Listing mit Prefix reicht, der Zeitraum ist ein Stringvergleich.
  const { blobs } = await store.list({ prefix: "e/" });
  const keys = blobs
    .map((b) => b.key)
    .filter((k) => k.slice(2, 12) >= von)
    .sort()
    .slice(-EVENTS_MAX);
  // Tag und Uhrzeit stecken im Schluessel (e/YYYY-MM-DD/HHMMSS-zufall, UTC).
  // ts als ISO-Zeitstempel mitgeben -- das Dashboard rendert daraus die
  // Ortszeit des Betrachters, gespeichert wird nichts Neues.
  const events = (await Promise.all(keys.map(async (k) => {
    const e = await store.get(k, { type: "json" }).catch(() => null);
    return e ? { ...e, tag: k.slice(2, 12), ts: k.slice(2, 12) + "T" + k.slice(13, 15) + ":" + k.slice(15, 17) + ":" + k.slice(17, 19) + "Z" } : null;
  }))).filter(Boolean);

  const agg = aggregiere(events);
  // Stichprobe fuer Streudiagramm und Event-Tabelle: die juengsten 300.
  const stichprobe = events.slice(-300);

  // Feedback aus Netlify Forms, damit alles an einem Ort steht. Braucht ein
  // Personal-Access-Token in FEEDBACK_TOKEN (Anleitung im README); ohne
  // Token bleibt feedback null und das Dashboard zeigt die Einrichtung.
  let feedback = null;
  const ftok = process.env.FEEDBACK_TOKEN || "";
  if (ftok) {
    try {
      const kopf = { headers: { authorization: "Bearer " + ftok } };
      const fr = await fetch("https://api.netlify.com/api/v1/forms", kopf);
      const forms = fr.ok ? await fr.json() : null;
      const form = Array.isArray(forms) ? forms.find((f) => f && f.name === "feedback") : null;
      if (!fr.ok) feedback = { fehler: "Netlify-API antwortet " + fr.status + " (Token pruefen)." };
      else if (!form) feedback = { fehler: "Formular \"feedback\" nicht gefunden." };
      else {
        const sr = await fetch("https://api.netlify.com/api/v1/forms/" + form.id + "/submissions?per_page=50", kopf);
        feedback = sr.ok ? feedbackAufbereiten(await sr.json()) : { fehler: "Submissions-Abruf antwortet " + sr.status + "." };
      }
    } catch (e) {
      feedback = { fehler: "Netlify-API nicht erreichbar." };
    }
  }

  return Response.json({ tage, von, ...agg, stichprobe, feedback }, {
    headers: { "cache-control": "no-store" },
  });
};

export const config = { path: "/api/statistik" };
