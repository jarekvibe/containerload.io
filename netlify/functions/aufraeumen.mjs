// Geplante Function: loescht einmal am Tag die Nutzungs-Events, die aelter als zwoelf
// Monate sind (AUFBEWAHRUNG_TAGE in lib/nutzung.mjs -- dort steht auch, warum zwoelf).
//
// Kein Pfad: eine geplante Function ist von aussen nicht aufrufbar, Netlify startet sie
// selbst -- und nur auf der veroeffentlichten Seite, nie in einer Deploy-Vorschau. Das ist
// hier wichtig: der Store "nutzung" ist fuer alle Deploys derselbe, eine Vorschau, die
// loescht, wuerde die echten Daten loeschen.
//
// Die Logik liegt als alteEventsLoeschen in lib/ und wird dort an einer Store-Attrappe
// getestet; der Blobs-Import ist wie ueberall dynamisch, damit die Tests ohne installierte
// Abhaengigkeit laufen.
import { alteEventsLoeschen } from "./lib/nutzung.mjs";

export default async () => {
  const { getStore } = await import("@netlify/blobs");
  const ergebnis = await alteEventsLoeschen(getStore("nutzung"));
  console.log("aufraeumen: " + ergebnis.geloescht + " Events geloescht (" + (ergebnis.tage.join(", ") || "kein Tag faellig") + ")" +
    (ergebnis.offen ? ", " + ergebnis.offen + " Tage warten auf den naechsten Lauf" : ""));
};

// Taeglich um 03:17 UTC. Die Uhrzeit ist beliebig -- nachts in Europa, und bewusst nicht
// zur vollen Stunde. Der Wert muss ein Literal sein (Netlify liest ihn, ohne den Code
// auszufuehren).
export const config = {
  schedule: "17 3 * * *",
};
