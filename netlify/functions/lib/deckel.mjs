// Gemeinsamer Tagesdeckel ALLER KI-Endpunkte: ein Zaehler im Blobs-Store "ki"
// (Schluessel z/<tag>), erhoeht VOR dem KI-Aufruf — er schuetzt das Guthaben,
// nicht die Statistik. Faellt der Speicher aus, laeuft der Import weiter
// (fail-open): die harten Deckel (Origin, Groessen, Guthaben-Obergrenze in
// der Anthropic-Konsole) stehen unabhaengig davon. Keine IP wird gelesen.
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

// Der Deckel der oeffentlichen Rechen-Schnittstelle (/api/plan, /mcp): eigener Zaehler im
// Store "plan", getrennt vom KI-Guthaben oben. Er schuetzt die Rechenzeit, nicht ein Konto --
// ist er erreicht, bekommt der Aufrufer trotzdem den Link zum 3D-Plan (der rechnet im
// Browser). Wie oben: fail-open, keine IP, gezaehlt wird nur EINE Zahl je Tag.
export const PLAN_TAGESLIMIT = Math.max(1, parseInt(process.env.PLAN_TAGESLIMIT, 10) || 5000);

export async function planDeckel() {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("plan");
    const key = `z/${new Date().toISOString().slice(0, 10)}`;
    const stand = (await store.get(key, { type: "json" })) || { n: 0 };
    if (stand.n >= PLAN_TAGESLIMIT) return false;
    await store.setJSON(key, { n: stand.n + 1 });
  } catch (e) {
    console.error("plan: Tageszaehler nicht erreichbar:", e && e.message);
  }
  return true;
}
