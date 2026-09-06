// GET /api/statistik?tage=30 -- liest die Nutzungs-Events aus Netlify Blobs,
// aggregiert sie serverseitig und liefert Kennzahlen plus eine begrenzte
// Stichprobe roher Events fuers Admin-Dashboard (/admin).
//
// Zugang nur mit Bearer-Token gegen die Umgebungsvariable STATISTIK_TOKEN
// (Netlify UI -> Environment variables). Ohne gesetzte Variable antwortet
// die Function 503 mit Klartext -- ein leerer Soll-Wert darf niemals wie
// ein richtiges Token wirken.
import { timingSafeEqual } from "node:crypto";
import { aggregiere, EVENTS_MAX } from "./lib/nutzung.mjs";

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
  const events = (await Promise.all(keys.map(async (k) => {
    const e = await store.get(k, { type: "json" }).catch(() => null);
    return e ? { ...e, tag: k.slice(2, 12) } : null;
  }))).filter(Boolean);

  const agg = aggregiere(events);
  // Stichprobe fuer Streudiagramm und Event-Tabelle: die juengsten 300.
  const stichprobe = events.slice(-300);
  return Response.json({ tage, von, ...agg, stichprobe }, {
    headers: { "cache-control": "no-store" },
  });
};

export const config = { path: "/api/statistik" };
