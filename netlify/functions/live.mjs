// GET /api/live -- "gerade online" fuers Admin-Dashboard: wie viele Seiten in der letzten
// Minute ein Lebenszeichen geschickt haben, aus welchen Laendern, auf welcher Art von Seite,
// dazu der Verlauf der letzten Viertelstunde. Liest nur die SCHLUESSEL der Lebenszeichen
// (Store "puls") -- alles, was die Anzeige braucht, steht im Namen.
//
// Zugang wie /api/statistik: Bearer-Token gegen STATISTIK_TOKEN. Ohne gesetzte Variable 503
// mit Klartext -- ein leerer Soll-Wert darf niemals wie ein richtiges Token wirken.
import { timingSafeEqual } from "node:crypto";
import { liveAuswerten, pulsAlt } from "./lib/puls.mjs";

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

  const { getStore } = await import("@netlify/blobs");
  const store = getStore("puls");
  const { blobs } = await store.list({ prefix: "p/" });
  const keys = blobs.map((b) => b.key);
  const jetzt = Date.now();
  // Wer hinsieht, raeumt auf: Altes fliegt bei jedem Abruf raus (nicht abwarten -- die
  // Antwort haengt nicht davon ab).
  const alt = pulsAlt(keys, jetzt);
  if (alt.length) Promise.all(alt.slice(0, 300).map((k) => store.delete(k))).catch(() => {});
  return Response.json(liveAuswerten(keys, jetzt), { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/live" };
