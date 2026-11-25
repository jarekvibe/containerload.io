// Laeuft einmal je Stunde (Netlify Scheduled Function) und loescht Lebenszeichen, die aelter
// sind als die Haltezeit. /api/puls raeumt zwar nebenbei auf -- aber nur, solange Besucher
// kommen. Ohne diese Function blieben die letzten Eintraege eines Tages liegen, bis am
// naechsten Morgen wieder jemand die Seite oeffnet; die Datenschutzseite sagt "in der Regel
// innerhalb einer Stunde", und das soll auch nachts stimmen.
//
// Eine Function mit `schedule` darf keinen `path` tragen und ist von aussen nicht aufrufbar.
import { pulsAlt } from "./lib/puls.mjs";

export default async () => {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("puls");
  const { blobs } = await store.list({ prefix: "p/" });
  const alt = pulsAlt(blobs.map((b) => b.key), Date.now());
  await Promise.all(alt.slice(0, 2000).map((k) => store.delete(k)));
  return new Response(null, { status: 204 });
};

// Minute 17 jeder Stunde (UTC) -- ein gewoehnlicher Cron-Ausdruck.
export const config = { schedule: "17 * * * *" };
