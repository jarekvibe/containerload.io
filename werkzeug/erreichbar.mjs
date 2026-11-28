// Der Waechter: prueft VON AUSSEN, ob containerload.io antwortet -- und ob dort der Stand
// liegt, der auf main steht. Laeuft stuendlich als GitHub-Actions-Workflow
// (.github/workflows/erreichbar.yml); schlaegt er fehl, schickt GitHub dem Inhaber eine Mail.
//
// Anlass (26.11.26): Die Seite war rund achteinhalb Stunden nicht erreichbar, und ein Merge
// ging fuenfeinhalb Stunden nicht live -- gemerkt hat es niemand, weil nichts nachsah.
//
// Vier Fragen, in dieser Reihenfolge:
//   1. Antwortet die Seite?            SEITEN: nur der Status zaehlt (HEAD -- app.html wiegt 1 MB).
//   2. Liegt dort der Stand von main?  STAND: Dateien, die Netlify Byte fuer Byte ausliefert,
//                                      gegen die Fassung im Repository. Bewusst KEIN HTML:
//                                      app.html traegt ein Formular, und Netlify schreibt
//                                      solche Seiten beim Veroeffentlichen um.
//   3. Rechnet die Schnittstelle wie main?  /api/plan gegen planen() aus demselben Stand.
//   4. Und der Anschluss fuer KI-Assistenten?  Ein Werkzeug-Aufruf an /mcp (plan_load), dieselben
//                                      Zahlen gegen planen(). Fehlt die Function nach einem
//                                      Deploy, merkt es sonst niemand -- im Browser ruft sie
//                                      nichts auf.
//
// Ohne Abhaengigkeiten (fetch von Node), und die Pruefung selbst ist eine reine Funktion von
// `fetch` -- test/erreichbar.test.mjs stellt die Antworten nach.
//
// Aufruf: node werkzeug/erreichbar.mjs            (Ende 0 = alles gut, 1 = Befund)

import { readFile, appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const BASIS = "https://containerload.io";

// Damit die Aufrufe in den Zugriffsdaten als das erkennbar sind, was sie sind.
export const KENNUNG = "containerload-erreichbar/1 (GitHub Actions; Waechter der Seite)";

// Adresse -> Datei im Veroeffentlichungs-Ordner (der Test prueft, dass es sie gibt).
// Bewusst wenige: jeder Aufruf zaehlt beim Hoster mit, und ob eine einzelne Seite im
// Repository liegt, pruefen die Tests -- hier geht es darum, ob die Seite ueberhaupt antwortet
// (Startseite, Rechner ueber die Umschreibe-Regel, Teilen-Seite, eine Sprachseite).
export const SEITEN = {
  "/": "index.html",
  "/app": "app.html",
  "/share": "share.html",
  "/en/": "en/index.html",
};

// Dateien, an denen sich ein Deploy ablesen laesst: klein, kein HTML, und bei fast jeder
// Aenderung ist eine davon dabei (jeder neue Text im Rechner steht in sprache/es.js, jede
// neue Seite in sitemap.xml).
export const STAND = ["sitemap.xml", "llms.txt", "openapi.json", "puls.js", "ratgeber/wissen.css", "sprache/es.js"];

// Die Probe-Rechnung fuer /api/plan: klein, und beide Wege (See, Strasse) einmal.
export const PROBEN = [
  { q: "11 europaletten", cont: "20gp" },
  { q: "33 europaletten 120x80x100 300kg nicht stapelbar", d: "road" },
];

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = path.join(WURZEL, "containerload.io");

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

// Ein Abruf mit Zeitgrenze und einem zweiten Versuch: ein einzelner Aussetzer im Netz des
// Pruefrechners ist kein Ausfall der Seite.
async function holen(fetchFn, adresse, { methode = "GET", versuche = 2, grenzeMs = 20000, pauseMs = 3000, koerper = null } = {}) {
  let fehler = "";
  for (let i = 0; i < versuche; i++) {
    try {
      const a = await fetchFn(adresse, {
        method: methode,
        redirect: "follow",
        headers: { "user-agent": KENNUNG, "cache-control": "no-cache", ...(koerper ? { "content-type": "application/json", accept: "application/json, text/event-stream" } : {}) },
        ...(koerper ? { body: koerper } : {}),
        signal: AbortSignal.timeout(grenzeMs),
      });
      if (a.status >= 500 && i + 1 < versuche) { fehler = "Status " + a.status; }
      else return { status: a.status, bytes: methode === "HEAD" ? null : Buffer.from(await a.arrayBuffer()) };
    } catch (e) {
      fehler = String((e && e.cause && e.cause.code) || (e && e.name) || e);
    }
    if (i + 1 < versuche && pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return { status: 0, bytes: null, fehler };
}

const planAdresse = (p) => BASIS + "/api/plan?" + new URLSearchParams(p).toString();

// Dieselbe Probe als Werkzeug-Aufruf ueber den MCP-Anschluss. Ohne Anmeldung: der Anschluss ist
// zustandslos, ein Aufruf steht fuer sich (netlify/functions/lib/mcp.mjs).
export const mcpAnfrage = (p) => ({
  jsonrpc: "2.0", id: 1, method: "tools/call",
  params: { name: "plan_load", arguments: { cargo: p.q, ...(p.cont ? { container: p.cont } : {}), ...(p.d === "road" ? { mode: "road" } : {}) } },
});
// So meldet der Anschluss die Tagesgrenze: als Ergebnis mit isError (der Test haelt den Wortlaut fest).
export const MCP_TAGESGRENZE = /daily limit/i;

// Was an einer Antwort der Schnittstelle zaehlt -- die Zahlen, nicht der Wortlaut.
export const kern = (b) => b && b.ok === true && b.plan ? {
  mode: b.mode, pieces: b.totals && b.totals.pieces,
  loaded: b.plan.pieces_loaded, left: b.plan.pieces_left, units: b.plan.units_needed, one: b.plan.fits_in_one,
} : null;

// Die Pruefung. `dateien(name)` liefert die Bytes aus dem Repository, `planen(roh)` die
// Antwort der Schnittstelle aus demselben Stand. Rueckgabe: { ok, befunde[], notizen[] }.
export async function pruefen({ fetch: fetchFn, dateien, planen, pauseMs = 3000 }) {
  const befunde = [], notizen = [];
  const opt = { pauseMs };

  // 1. Antwortet die Seite?
  const seiten = await Promise.all(Object.keys(SEITEN).map(async (p) => [p, await holen(fetchFn, BASIS + p, { ...opt, methode: "HEAD" })]));
  const tot = seiten.filter(([, a]) => a.status !== 200);
  if (tot.length === seiten.length) {
    // Ein Befund statt siebzehn: ist alles weg, sagt der Rest nichts Neues.
    const [, a] = tot[0];
    befunde.push({ art: "ausfall", text: `containerload.io ist nicht erreichbar: keine der ${seiten.length} geprüften Seiten antwortet (${a.status ? "Status " + a.status : a.fehler || "keine Antwort"}).` });
    return { ok: false, befunde, notizen };
  }
  for (const [p, a] of tot) befunde.push({ art: "seite", text: `${p} antwortet nicht mit 200 (${a.status ? "Status " + a.status : a.fehler || "keine Antwort"}).` });

  // 2. Liegt dort der Stand von main?
  const anders = [];
  for (const name of STAND) {
    const a = await holen(fetchFn, BASIS + "/" + name, opt);
    if (a.status !== 200) { befunde.push({ art: "seite", text: `/${name} antwortet nicht mit 200 (${a.status ? "Status " + a.status : a.fehler || "keine Antwort"}).` }); continue; }
    if (sha(a.bytes) !== sha(await dateien(name))) anders.push(name);
  }
  if (anders.length) {
    befunde.push({ art: "stand", text: `Die Seite zeigt nicht den Stand von main: ${anders.join(", ")} ${anders.length === 1 ? "weicht" : "weichen"} ab. Ist der letzte Merge veröffentlicht worden (Netlify → Deploys)?` });
  }

  // 3. Rechnet die Schnittstelle wie main?
  for (const p of PROBEN) {
    const a = await holen(fetchFn, planAdresse(p), opt);
    if (a.status === 429) { notizen.push("/api/plan: Tagesgrenze erreicht — heute nicht prüfbar."); break; }
    if (a.status !== 200) { befunde.push({ art: "api", text: `/api/plan antwortet nicht mit 200 (${a.status ? "Status " + a.status : a.fehler || "keine Antwort"}).` }); break; }
    let live = null;
    try { live = kern(JSON.parse(a.bytes.toString("utf8"))); } catch (e) { live = null; }
    const soll = kern(planen(p).body);
    if (!live || JSON.stringify(live) !== JSON.stringify(soll)) {
      befunde.push({ art: "api", text: `/api/plan rechnet anders als main für „${p.q}“: live ${JSON.stringify(live)}, main ${JSON.stringify(soll)}.` });
    }
  }

  // 4. Antwortet der MCP-Anschluss, und rechnet er wie main? Eine Probe genuegt: es ist dieselbe
  //    Rechnung wie in Schritt 3, geprueft wird der Weg dorthin.
  {
    const p = PROBEN[0];
    const a = await holen(fetchFn, BASIS + "/mcp", { ...opt, methode: "POST", koerper: JSON.stringify(mcpAnfrage(p)) });
    if (a.status !== 200) {
      befunde.push({ art: "mcp", text: `/mcp antwortet nicht mit 200 (${a.status ? "Status " + a.status : a.fehler || "keine Antwort"}).` });
    } else {
      let erg = null;
      try { erg = JSON.parse(a.bytes.toString("utf8")).result || null; } catch (e) { erg = null; }
      if (erg && erg.isError === true && MCP_TAGESGRENZE.test(JSON.stringify(erg.content || ""))) {
        notizen.push("/mcp: Tagesgrenze erreicht — heute nicht prüfbar.");
      } else {
        const live = erg ? kern(erg.structuredContent) : null;
        const soll = kern(planen(p).body);
        if (!live || JSON.stringify(live) !== JSON.stringify(soll)) {
          befunde.push({ art: "mcp", text: `/mcp (Werkzeug plan_load) rechnet anders als main für „${p.q}“: live ${JSON.stringify(live)}, main ${JSON.stringify(soll)}.` });
        }
      }
    }
  }

  return { ok: befunde.length === 0, befunde, notizen };
}

// Der Bericht, wie er im Protokoll und in der Zusammenfassung des Laufs steht.
export function bericht(erg, jetzt = new Date()) {
  const kopf = erg.ok
    ? `containerload.io ist erreichbar und zeigt den Stand von main (${jetzt.toISOString().slice(0, 16).replace("T", " ")} UTC).`
    : `Befund bei containerload.io (${jetzt.toISOString().slice(0, 16).replace("T", " ")} UTC):`;
  return [kopf, ...erg.befunde.map((b) => "- " + b.text), ...erg.notizen.map((n) => "- Hinweis: " + n)].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { planen } = await import("../netlify/functions/lib/plan.mjs");
  const erg = await pruefen({ fetch, dateien: (name) => readFile(path.join(SEITE, name)), planen });
  const text = bericht(erg);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text + "\n\n");
  process.exit(erg.ok ? 0 : 1);
}
