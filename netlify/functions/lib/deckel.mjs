// Gemeinsamer Tagesdeckel ALLER KI-Endpunkte: ein Zaehler im Blobs-Store "ki"
// (Schluessel z/<tag>), erhoeht VOR dem KI-Aufruf — er schuetzt das Guthaben,
// nicht die Statistik. Faellt der Speicher aus, laeuft der Import weiter
// (fail-open): die harten Deckel (Origin, Groessen, Guthaben-Obergrenze in
// der Anthropic-Konsole) stehen unabhaengig davon. Keine IP wird gelesen.
//
// Der Deckel ist GEMEINSAM: wer ihn allein leerfragt, schaltet die KI fuer alle bis zum
// naechsten Tag ab. Dagegen steht seit November 2026 ein Limit je Client davor (rateLimit
// in der Konfiguration der drei KI-Functions) -- es bremst, es verhindert nicht: ein
// einzelner Client braucht fuer 400 Aufrufe jetzt Minuten statt Sekunden (rund acht, wenn er
// alle drei Endpunkte ausschoepft).
export const TAGESLIMIT = Math.max(1, parseInt(process.env.KI_TAGESLIMIT, 10) || 400);

export async function tagesdeckel() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("ki");
    const key = `z/${new Date().toISOString().slice(0, 10)}`;
    const stand = (await store.get(key, { type: "json" })) || { n: 0 };
    if (stand.n >= TAGESLIMIT) return false;
    await store.setJSON(key, { n: stand.n + 1 });
  } catch (e) {
    console.error("ki: Tageszaehler nicht erreichbar:", e && e.message);
  }
  return true;
}
