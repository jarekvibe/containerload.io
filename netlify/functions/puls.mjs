// POST /api/puls -- nimmt das Lebenszeichen einer offenen Seite entgegen (puls.js, etwa
// einmal je Minute) und legt dafuer EINEN Schluessel in Netlify Blobs ab (Store "puls").
// Daraus zeigt /admin, wie viele Seiten gerade offen sind und aus welchen Laendern.
//
// Was hier NICHT passiert: keine IP, kein User-Agent, keine Cookies, keine Kennung. Der
// Koerper der Anfrage ist ein einziges Wort aus einer festen Liste (die Art der Seite); das
// Land leitet Netlify aus der IP ab (context.geo), gespeichert wird nur der Laendercode.
// So steht es auf der Datenschutzseite, also bleibt es so.
import { pulsArt, pulsLand, pulsSchluessel, pulsAlt } from "./lib/puls.mjs";

export default async (req, context) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  // Weiche Herkunftspruefung wie beim Nutzungs-Event: kein Sicherheitsversprechen, haelt aber
  // achtlose Skripte fern. Previews und localhost senden gar nicht erst (puls.js).
  const origin = req.headers.get("origin");
  if (origin && !/^https:\/\/(www\.)?containerload\.io$/.test(origin)) {
    return new Response("", { status: 403 });
  }
  const art = pulsArt((await req.text()).slice(0, 32));
  if (!art) return new Response("", { status: 400 });
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("puls");
  const jetzt = new Date();
  await store.set(pulsSchluessel(jetzt, pulsLand(context && context.geo), art, Math.random().toString(36).slice(2, 8)), "1");
  // Aufraeumen nebenbei, bei etwa jedem zwanzigsten Lebenszeichen: was aelter ist als die
  // Haltezeit, wird geloescht. Die stuendliche Function puls-aufraeumen faengt den Fall ab,
  // dass danach niemand mehr kommt.
  if (Math.random() < 0.05) {
    try {
      const { blobs } = await store.list({ prefix: "p/" });
      await Promise.all(pulsAlt(blobs.map((b) => b.key), jetzt.getTime()).slice(0, 300).map((k) => store.delete(k)));
    } catch {}
  }
  return new Response("", { status: 204 });
};

export const config = { path: "/api/puls" };
