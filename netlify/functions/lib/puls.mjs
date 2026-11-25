// "Gerade online": die Lebenszeichen der offenen Seiten und ihre Auswertung fuers Admin.
//
// Jareks Frage (25.11.26): "Kann man eigentlich auch sehen, wie viele Leute gerade auf der
// Webseite drauf sind ... und aus welchen Laendern?" Bis dahin nicht: der Rechner meldet sich
// einmal, beim VERLASSEN der Seite.
//
// Das Prinzip -- und warum es ohne jede Kennung auskommt:
//   Eine geoeffnete, sichtbare Seite schickt EIN Lebenszeichen je Minute (puls.js). Wer in
//   den letzten 60 Sekunden ein Lebenszeichen geschickt hat, ist "online". Gezaehlt werden
//   also Lebenszeichen im Fenster, nicht Personen -- dafuer braucht es weder eine Kennung
//   noch die IP-Adresse. Zwei Fenster nebeneinander sind zwei.
//
// Gespeichert wird je Lebenszeichen NUR ein Schluessel in Netlify Blobs (Store "puls"):
//   p/<JJJJMMTTHHMM>/<SS>-<LAND>-<art>-<zufall>
// Zeitpunkt, Laendercode (aus context.geo, wie beim Nutzungs-Event), Art der Seite. Der
// Zufallsteil haelt nur zwei gleichzeitige Lebenszeichen auseinander; er wird nirgends
// wiedererkannt. Nach PULS_HALTEN_MIN Minuten wird der Eintrag geloescht.
//
// Reine Funktionen ohne Netlify-Abhaengigkeit, damit test/live-anzeige.test.mjs sie direkt
// importieren kann.

export const PULS_ARTEN = ["start", "wissen", "rechner", "sonst"];
export const PULS_FENSTER_S = 60;     // "online" = Lebenszeichen in den letzten 60 s (ein Takt)
export const PULS_VERLAUF_MIN = 15;   // so weit zurueck zeigt das Admin den Verlauf
export const PULS_HALTEN_MIN = 20;    // danach wird geloescht

// Was die Seite schickt, ist genau eines dieser Woerter -- alles andere wird verworfen.
export const pulsArt = (x) => (typeof x === "string" && PULS_ARTEN.includes(x.trim()) ? x.trim() : "");

// Laendercode aus Netlifys Geo-Ableitung. Unbekannt heisst "XX" -- nie die IP, nie eine Stadt.
export const pulsLand = (geo) => {
  const c = geo && geo.country && geo.country.code;
  return typeof c === "string" && /^[A-Z]{2}$/.test(c) ? c : "XX";
};

const zwei = (n) => String(n).padStart(2, "0");
const minute = (d) => "" + d.getUTCFullYear() + zwei(d.getUTCMonth() + 1) + zwei(d.getUTCDate()) + zwei(d.getUTCHours()) + zwei(d.getUTCMinutes());

// Der Schluessel eines Lebenszeichens. Alles, was die Auswertung braucht, steht im Namen:
// das Admin muss nur LISTEN, nie einen Inhalt abholen.
export function pulsSchluessel(jetzt, land, art, zufall) {
  const l = /^[A-Z]{2}$/.test(land || "") ? land : "XX";
  const a = pulsArt(art) || "sonst";
  const z = String(zufall || "").replace(/[^a-z0-9]/g, "").slice(0, 8) || "0";
  return `p/${minute(jetzt)}/${zwei(jetzt.getUTCSeconds())}-${l}-${a}-${z}`;
}

// Schluessel -> { ts, land, art } oder null. Fremdes im Store darf die Anzeige nicht kippen.
export function pulsLesen(key) {
  const m = /^p\/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\/(\d{2})-([A-Z]{2})-([a-z]+)-[a-z0-9]+$/.exec(String(key || ""));
  if (!m || !PULS_ARTEN.includes(m[8])) return null;
  const ts = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isFinite(ts) ? { ts, land: m[7], art: m[8] } : null;
}

// Alle Schluessel -> was das Admin zeigt. jetztMs kommt von aussen (pruefbar).
export function liveAuswerten(keys, jetztMs) {
  const laender = {}, seiten = {};
  let online = 0;
  const jeMinute = new Map();
  for (const k of Array.isArray(keys) ? keys : []) {
    const p = pulsLesen(k);
    if (!p) continue;
    const alter = jetztMs - p.ts;
    if (alter < -5000 || alter > PULS_VERLAUF_MIN * 60000) continue;      // Zukunft (Uhrenfehler) und Altes
    if (alter < PULS_FENSTER_S * 1000) {
      online++;
      laender[p.land] = (laender[p.land] || 0) + 1;
      seiten[p.art] = (seiten[p.art] || 0) + 1;
    }
    const min = Math.floor(p.ts / 60000);
    jeMinute.set(min, (jeMinute.get(min) || 0) + 1);
  }
  // Verlauf: je Minute die Zahl der Lebenszeichen = ungefaehr die Zahl der offenen Seiten in
  // dieser Minute. Lueckenlos, aelteste zuerst, die laufende Minute zuletzt.
  const jetztMin = Math.floor(jetztMs / 60000);
  const verlauf = [];
  for (let i = PULS_VERLAUF_MIN - 1; i >= 0; i--) {
    const min = jetztMin - i;
    verlauf.push({ t: new Date(min * 60000).toISOString().slice(0, 16) + "Z", n: jeMinute.get(min) || 0 });
  }
  return { stand: new Date(jetztMs).toISOString(), online, laender, seiten, verlauf, fensterS: PULS_FENSTER_S };
}

// Welche Schluessel sind zu alt (oder unlesbar) und koennen weg?
export function pulsAlt(keys, jetztMs) {
  return (Array.isArray(keys) ? keys : []).filter((k) => {
    const p = pulsLesen(k);
    return !p || jetztMs - p.ts > PULS_HALTEN_MIN * 60000;
  });
}
