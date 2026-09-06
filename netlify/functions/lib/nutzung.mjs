// Anonyme Nutzungsstatistik: Pruefung und Auswertung der Events, die der
// 3D-Rechner einmal je Besuch an /api/beacon schickt.
//
// Die eine Regel ueber allem: HIER KOMMT KEIN FREITEXT DURCH. Packlisten
// tragen Kundennamen und Auftragsnummern; der Rechner schickt sie gar nicht
// erst mit, und dieses Modul verwirft trotzdem alles, was kein erwartetes
// Feld mit erwartetem Typ ist -- der Endpunkt ist oeffentlich, und was
// jemand von Hand hineinwirft, darf die Statistik nicht vergiften.
//
// Reine Funktionen ohne Netlify-Abhaengigkeit, damit test/nutzungsstatistik
// .test.mjs sie direkt importieren kann.

export const POS_MAX = 40;        // Positionen je Event -- mehr braucht keine Auswertung
export const FUNK_MAX = 24;       // Funktions-Kennungen je Event
export const EVENTS_MAX = 5000;   // Events je Auswertung (Schutz der Function-Laufzeit)

const MODI = new Set(["sea", "road"]);
const SPRACHEN = new Set(["de", "en"]);

// Zahl im erlaubten Bereich oder null. Rundet auf eine Nachkommastelle --
// genauer muss keine Kante und kein Gewicht in einer Statistik sein.
const zahl = (v, max) => {
  const n = +v;
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 10) / 10;
};

// Rohes Event aus dem Netz -> geprueftes Event oder null.
export function pruefeEvent(roh) {
  if (!roh || typeof roh !== "object" || Array.isArray(roh) || roh.v !== 1) return null;
  if (!MODI.has(roh.modus) || !SPRACHEN.has(roh.sprache)) return null;
  const positionen = (Array.isArray(roh.positionen) ? roh.positionen : [])
    .slice(0, POS_MAX)
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const l = zahl(p.l, 1e5), b = zahl(p.b, 1e5), h = zahl(p.h, 1e5);
      if (l === null || b === null || h === null || !l || !b || !h) return null;
      const kg = zahl(p.kg, 1e6);
      const n = zahl(p.n, 1e4);
      return { l, b, h, kg: kg === null ? 0 : kg, n: Math.max(1, Math.round(n === null ? 1 : n)), stapel: !!p.stapel };
    })
    .filter(Boolean);
  const funktionen = (Array.isArray(roh.funktionen) ? roh.funktionen : [])
    .filter((f) => typeof f === "string" && /^[a-z0-9-]{1,32}$/.test(f))
    .slice(0, FUNK_MAX);
  // Der Containername kommt aus der Preset-Liste des Rechners, nie aus einer
  // Nutzereingabe -- trotzdem: enges Alphabet, harte Laengengrenze.
  const container = typeof roh.container === "string"
    ? roh.container.replace(/[^0-9A-Za-z\xC0-\xFF′'" .·-]/g, "").slice(0, 40)
    : "";
  const kette = Math.min(99, Math.max(0, Math.round(+roh.kette) || 0));
  const dauerS = Math.min(86400, Math.max(0, Math.round(+roh.dauerS) || 0));
  if (!positionen.length && !funktionen.length) return null;
  return { v: 1, modus: roh.modus, sprache: roh.sprache, geteilt: !!roh.geteilt, dauerS, positionen, funktionen, container, kette };
}

// Events (je mit .tag "YYYY-MM-DD") -> Kennzahlen fuers Dashboard.
export function aggregiere(events) {
  const tage = new Map(), container = {}, modus = {}, sprachen = {}, funktionen = {};
  let positionenGesamt = 0, stueckGesamt = 0;
  for (const e of events) {
    const t = tage.get(e.tag) || { tag: e.tag, events: 0, positionen: 0 };
    t.events += 1;
    t.positionen += e.positionen.length;
    tage.set(e.tag, t);
    positionenGesamt += e.positionen.length;
    for (const p of e.positionen) stueckGesamt += p.n;
    if (e.container) container[e.container] = (container[e.container] || 0) + 1;
    modus[e.modus] = (modus[e.modus] || 0) + 1;
    sprachen[e.sprache] = (sprachen[e.sprache] || 0) + 1;
    for (const f of e.funktionen) funktionen[f] = (funktionen[f] || 0) + 1;
  }
  return {
    events: events.length,
    positionenGesamt,
    stueckGesamt,
    tage: [...tage.values()].sort((a, b) => a.tag < b.tag ? -1 : 1),
    container, modus, sprachen, funktionen,
  };
}
