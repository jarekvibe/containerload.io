// POST /api/beacon -- nimmt das eine anonyme Nutzungs-Event je Rechner-Besuch
// entgegen und legt es in Netlify Blobs ab (Store "nutzung", Schluessel
// e/<tag>/<uhrzeit>-<zufall>). Antwortet bewusst wortkarg: der Absender ist
// navigator.sendBeacon, da liest niemand eine Antwort.
//
// Was hier NICHT passiert: keine IP, kein User-Agent, keine Cookies, keine
// Kennung wird gespeichert -- nur das geprueft-anonyme Event selbst plus der
// Tag. So steht es auf der Datenschutzseite, also bleibt es so.
import { pruefeEvent } from "./lib/nutzung.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("", { status: 405 });
  // Weiche Herkunftspruefung gegen Fremdnutzung des offenen Endpunkts. Kein
  // Sicherheitsversprechen (Origin ist faelschbar), haelt aber achtlose
  // Skripte fern. Previews (*.netlify.app) senden gar nicht erst (app.html).
  const origin = req.headers.get("origin");
  if (origin && !/^https:\/\/(www\.)?containerload\.io$/.test(origin)) {
    return new Response("", { status: 403 });
  }
  const text = await req.text();
  if (text.length > 16384) return new Response("", { status: 413 });
  let ev = null;
  try { ev = pruefeEvent(JSON.parse(text)); } catch {}
  if (!ev) return new Response("", { status: 400 });
  const { getStore } = await import("@netlify/blobs");
  const jetzt = new Date().toISOString();
  const key = `e/${jetzt.slice(0, 10)}/${jetzt.slice(11, 19).replace(/:/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  await getStore("nutzung").setJSON(key, ev);
  return new Response("", { status: 204 });
};

export const config = { path: "/api/beacon" };
