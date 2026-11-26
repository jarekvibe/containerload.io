// "Gerade online" (25.11.26). Jareks Frage: "Kann man eigentlich auch sehen, wie viele Leute
// gerade auf der Webseite drauf sind ... und aus welchen Laendern?"
//
// Die Antwort kommt ohne Kennung und ohne IP aus: eine offene, sichtbare, benutzte Seite
// schickt EIN Wort je Minute (puls.js -> /api/puls), der Server legt dafuer einen Schluessel
// mit Zeitpunkt, Laendercode und Seitenart ab, und das Admin zaehlt die Schluessel der letzten
// 60 Sekunden (/api/live). Was dabei NICHT kippen darf, steht hier:
//   * es geht nur ein Wort aus einer festen Liste hinaus,
//   * nichts wird auf dem Geraet abgelegt, nichts Persoenliches auf dem Server,
//   * Do Not Track / GPC, Vorschau-Hosts, iframes und der Betreiber senden nicht,
//   * die Eintraege verschwinden wieder -- und die Datenschutzseite sagt all das.
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PULS_ARTEN, PULS_FENSTER_S, PULS_VERLAUF_MIN, PULS_HALTEN_MIN, pulsArt, pulsLand, pulsSchluessel, pulsLesen, liveAuswerten, pulsAlt } from "../../netlify/functions/lib/puls.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (...p) => fs.readFileSync(path.join(dir, "..", ...p), "utf8");
const fn = (f) => fs.readFileSync(path.join(dir, "..", "..", "netlify", "functions", f), "utf8");
const puls = lies("puls.js");

// ── Der Server-Kern ────────────────────────────────────────────────────────────────────
test("hinein kommt nur ein Wort aus der festen Liste", () => {
  assert.deepStrictEqual(PULS_ARTEN, ["start", "wissen", "rechner", "sonst"]);
  for (const a of PULS_ARTEN) assert.strictEqual(pulsArt(a), a);
  assert.strictEqual(pulsArt(" rechner\n"), "rechner");
  for (const x of ["", "Rechner", "rechner; DROP", "<script>", "start,wissen", null, undefined, 7, {}, ["start"]]) assert.strictEqual(pulsArt(x), "", JSON.stringify(x));
});

test("vom Ort bleibt nur der Laendercode", () => {
  assert.strictEqual(pulsLand({ country: { code: "DE", name: "Germany" }, city: "Bremen", latitude: 53.07, subdivision: { code: "HB" } }), "DE");
  for (const g of [null, undefined, {}, { country: {} }, { country: { code: "de" } }, { country: { code: "DEU" } }, { country: { code: "D1" } }, { city: "Bremen" }]) assert.strictEqual(pulsLand(g), "XX");
});

test("der Schluessel traegt Zeitpunkt, Land und Seitenart -- und sonst nichts", () => {
  const t = new Date(Date.UTC(2026, 10, 25, 20, 7, 9));
  const k = pulsSchluessel(t, "US", "wissen", "a1b2c3");
  assert.strictEqual(k, "p/202611252007/09-US-wissen-a1b2c3");
  assert.deepStrictEqual(pulsLesen(k), { ts: t.getTime(), land: "US", art: "wissen" });
  // Nichts Fremdes kommt in den Schluessel
  assert.strictEqual(pulsSchluessel(t, "../../x", "boese", "ZZ/../!"), "p/202611252007/09-XX-sonst-0");
  assert.strictEqual(pulsSchluessel(t, "DE", "rechner", "abc/def 123"), "p/202611252007/09-DE-rechner-abcdef12");
  for (const mist of ["", "p/", "e/2026-11-25/200709-abc", "p/202611252007/09-DE-admin-abc", "p/202611252007/9-DE-start-abc", "p/2026/09-DE-start-abc", "p/202611252007/09-de-start-abc", null]) assert.strictEqual(pulsLesen(mist), null, String(mist));
});

test("online ist, wer in den letzten 60 Sekunden ein Lebenszeichen geschickt hat", () => {
  assert.strictEqual(PULS_FENSTER_S, 60, "das Fenster muss zum Takt von puls.js passen");
  const jetzt = Date.UTC(2026, 10, 25, 20, 10, 30);
  const vor = (s, land, art, z) => pulsSchluessel(new Date(jetzt - s * 1000), land, art, z);
  const keys = [
    vor(2, "DE", "rechner", "a"), vor(20, "DE", "wissen", "b"), vor(59, "US", "start", "c"),      // drin
    vor(61, "FR", "wissen", "d"), vor(300, "DE", "rechner", "e"),                                   // zu alt fuers Fenster, aber im Verlauf
    vor(16 * 60, "CN", "start", "f"),                                                               // aelter als der Verlauf
    pulsSchluessel(new Date(jetzt + 60000), "IT", "start", "g"),                                    // Zukunft: Uhrenfehler oder Unfug
    "p/kaputt", "e/2026-11-25/x",
  ];
  const r = liveAuswerten(keys, jetzt);
  assert.strictEqual(r.online, 3);
  assert.deepStrictEqual(r.laender, { DE: 2, US: 1 });
  assert.deepStrictEqual(r.seiten, { rechner: 1, wissen: 1, start: 1 });
  assert.strictEqual(r.stand, new Date(jetzt).toISOString());
  // Verlauf: lueckenlos, aelteste Minute zuerst, die laufende zuletzt
  assert.strictEqual(r.verlauf.length, PULS_VERLAUF_MIN);
  assert.strictEqual(r.verlauf[r.verlauf.length - 1].t, "2026-11-25T20:10Z");
  assert.strictEqual(r.verlauf[0].t, "2026-11-25T19:56Z");
  assert.strictEqual(r.verlauf.reduce((s, x) => s + x.n, 0), 5, "der Verlauf zaehlt alles der letzten Viertelstunde, nichts davor, nichts aus der Zukunft");
  // Leer und kaputt kippen nichts
  assert.strictEqual(liveAuswerten([], jetzt).online, 0);
  assert.strictEqual(liveAuswerten(null, jetzt).verlauf.length, PULS_VERLAUF_MIN);
});

test("ein Tab, der brav jede Minute sendet, zaehlt genau einmal", () => {
  // Lebenszeichen bei t, t+60, t+120 ...: in JEDEM 60-Sekunden-Fenster liegt genau eines.
  const start = Date.UTC(2026, 10, 25, 20, 0, 13);
  const zeiten = [0, 60, 120, 180, 240];
  const bis = (s) => zeiten.filter((z) => z <= s).map((z, i) => pulsSchluessel(new Date(start + z * 1000), "DE", "rechner", "t" + i));   // was zu diesem Zeitpunkt schon da ist
  for (let s = 0; s < 300; s += 7) assert.strictEqual(liveAuswerten(bis(s), start + s * 1000).online, 1, `nach ${s} s`);
  // Genau am Takt loest das neue Lebenszeichen das alte ab -- nie zwei, nie keins.
  for (const s of [59, 60, 61, 119, 120, 121]) assert.strictEqual(liveAuswerten(bis(s), start + s * 1000).online, 1, `am Takt, ${s} s`);
  // 60 Sekunden nach dem letzten ist er weg.
  assert.strictEqual(liveAuswerten(bis(999), start + 300 * 1000).online, 0);
  // Ein Lebenszeichen ein paar Sekunden "aus der Zukunft" (Uhren zweier Server) zaehlt mit, eines von weit vorn nicht.
  assert.strictEqual(liveAuswerten([pulsSchluessel(new Date(start + 3000), "DE", "start", "z")], start).online, 1);
  assert.strictEqual(liveAuswerten([pulsSchluessel(new Date(start + 30000), "DE", "start", "z")], start).online, 0);
});

test("was aelter ist als die Haltezeit, fliegt raus -- Unlesbares auch", () => {
  const jetzt = Date.UTC(2026, 10, 25, 20, 30, 0);
  const frisch = pulsSchluessel(new Date(jetzt - 5 * 60000), "DE", "start", "a");
  const grenze = pulsSchluessel(new Date(jetzt - PULS_HALTEN_MIN * 60000), "DE", "start", "b");
  const alt = pulsSchluessel(new Date(jetzt - (PULS_HALTEN_MIN + 1) * 60000), "DE", "start", "c");
  assert.deepStrictEqual(pulsAlt([frisch, grenze, alt, "p/kaputt"], jetzt), [alt, "p/kaputt"]);
  assert.ok(PULS_HALTEN_MIN > PULS_VERLAUF_MIN, "geloescht wuerde, was der Verlauf noch zeigt");
  assert.ok(PULS_HALTEN_MIN <= 30, "die Datenschutzseite verspricht: nur fuer die letzten Minuten");
});

// ── Die Functions ──────────────────────────────────────────────────────────────────────
test("die Functions lesen keine IP, keinen User-Agent, keinen Cookie", () => {
  for (const f of ["puls.mjs", "live.mjs", "puls-aufraeumen.mjs", "lib/puls.mjs"]) {
    const s = fn(f).replace(/^\s*\/\/.*$/gm, "");                              // Kommentare duerfen das Wort IP nennen
    assert.ok(!/x-forwarded-for|x-nf-client-connection-ip|client-ip|context\.ip\b|\.ip\b|user-agent|cookie|referer/i.test(s), `${f}: liest etwas Persoenliches`);
  }
  const p = fn("puls.mjs");
  assert.match(p, /const art = pulsArt\(\(await req\.text\(\)\)\.slice\(0, 32\)\);\n\s*if \(!art\) return new Response\("", \{ status: 400 \}\);/, "der Koerper wird nicht gegen die Liste geprueft");
  assert.match(p, /pulsSchluessel\(jetzt, pulsLand\(context && context\.geo\), art,/, "das Land kommt nicht aus context.geo");
  assert.ok(p.includes('Math.random().toString(36).slice(2, 8)), "1");'), "es wird mehr als ein Platzhalter gespeichert");
  assert.strictEqual((p.match(/store\.set\(/g) || []).length, 1, "/api/puls schreibt mehr als den einen Schluessel");
  assert.ok(!/setJSON|JSON\.stringify/.test(p), "/api/puls speichert Inhalte");
  assert.match(p, /if \(req\.method !== "POST"\) return new Response\("", \{ status: 405 \}\);/);
  assert.match(p, /containerload\\\.io\$\/\.test\(origin\)/, "die Herkunftspruefung fehlt");
  assert.ok(p.includes('export const config = { path: "/api/puls" };'));
});

test("die Live-Anzeige gibt es nur mit dem Admin-Token", () => {
  const l = fn("live.mjs");
  assert.match(l, /const soll = process\.env\.STATISTIK_TOKEN \|\| "";\n\s*if \(!soll\) return Response\.json\([^)]*\{ status: 503 \}\);/, "ohne gesetztes Token muss die Function zu sein");
  assert.match(l, /if \(!ist \|\| !gleich\(ist, soll\)\) return Response\.json\([^)]*\{ status: 401 \}\);/);
  assert.ok(l.includes("timingSafeEqual"));
  assert.ok(l.indexOf("status: 401") < l.indexOf('getStore("puls")'), "der Store wird vor der Token-Pruefung angefasst");
  assert.ok(l.includes('"cache-control": "no-store"'));
});

test("aufgeraeumt wird auch, wenn niemand mehr kommt (stuendliche Function)", () => {
  const a = fn("puls-aufraeumen.mjs");
  const m = /export const config = \{ schedule: "([^"]+)" \};/.exec(a);
  assert.ok(m, "puls-aufraeumen hat keinen Zeitplan");
  assert.match(m[1], /^\d{1,2} \* \* \* \*$/, "kein stuendlicher Cron-Ausdruck: " + m[1]);
  assert.ok(!/path:/.test(a.replace(/^\s*\/\/.*$/gm, "")), "eine Function mit schedule darf keinen path tragen");
  assert.ok(a.includes("pulsAlt(") && a.includes("store.delete(k)"));
  // ... und nebenbei bei den Lebenszeichen selbst und bei jedem Blick ins Admin
  assert.ok(fn("puls.mjs").includes("pulsAlt(") && fn("live.mjs").includes("pulsAlt("));
});

// ── Das Skript der Seite ───────────────────────────────────────────────────────────────
// puls.js in einer nachgebauten Umgebung laufen lassen und zaehlen, was hinausgeht.
function lauf({ host = "containerload.io", pfad = "/", dnt = null, gpc = false, eigen = false, iframe = false, sichtbar = true } = {}) {
  const gesendet = [], timer = [], hoerer = {};
  let uhr = 1_000_000;
  const top = {};
  const window = { addEventListener: (ev, f) => { (hoerer[ev] = hoerer[ev] || []).push(f); } };
  window.self = window; window.top = iframe ? top : window;
  const document = { visibilityState: sichtbar ? "visible" : "hidden", addEventListener: (ev, f) => { (hoerer["doc:" + ev] = hoerer["doc:" + ev] || []).push(f); } };
  const navigator = { doNotTrack: dnt, globalPrivacyControl: gpc, sendBeacon: (u, b) => { gesendet.push([u, b]); return true; } };
  const speicher = { getItem: (k) => (k === "cl-eigene-nutzung" && eigen ? "1" : null), setItem: () => { throw new Error("puls.js schreibt in den Speicher"); } };
  const DateStub = { now: () => uhr };
  new Function("window", "document", "navigator", "location", "localStorage", "setTimeout", "setInterval", "Date",
    puls)(window, document, navigator, { hostname: host, pathname: pfad }, speicher,
    (f, ms) => { timer.push({ f, um: uhr + ms }); }, (f, ms) => { timer.push({ f, alle: ms, um: uhr + ms }); }, DateStub);
  const vor = (ms) => {                                                        // Zeit laeuft, Timer feuern
    const ziel = uhr + ms;
    for (;;) {
      const t = timer.filter((x) => x.um <= ziel).sort((a, b) => a.um - b.um)[0];
      if (!t) break;
      uhr = t.um;
      if (t.alle) t.um += t.alle; else timer.splice(timer.indexOf(t), 1);
      t.f();
    }
    uhr = ziel;
  };
  const regung = () => (hoerer.pointermove || []).forEach((f) => f());
  return { gesendet, vor, regung, document, hoerer, sichtbarkeit: (v) => { document.visibilityState = v; (hoerer["doc:visibilitychange"] || []).forEach((f) => f()); } };
}

test("gesendet wird ein Wort je Minute -- das erste nach acht Sekunden", () => {
  const r = lauf({ pfad: "/app" });
  r.vor(7000);
  assert.strictEqual(r.gesendet.length, 0, "wer sofort wieder geht, zaehlt nicht");
  r.vor(1500);
  assert.deepStrictEqual(r.gesendet, [["/api/puls", "rechner"]]);
  r.vor(60000); r.regung();
  r.vor(60000); r.regung();
  assert.strictEqual(r.gesendet.length, 3, "eines je Minute");
  for (const [u, b] of r.gesendet) { assert.strictEqual(u, "/api/puls"); assert.strictEqual(pulsArt(b), b, "das Wort steht nicht auf der Liste des Servers"); }
});

test("die Art der Seite folgt aus dem Pfad -- und nichts vom Pfad geht mit", () => {
  const art = (pfad) => { const r = lauf({ pfad }); r.vor(9000); return r.gesendet[0][1]; };
  for (const [p, a] of [["/", "start"], ["/index.html", "start"], ["/en/", "start"], ["/zh/", "start"], ["/nl/", "start"], ["/fr/index.html", "start"],
    ["/app", "rechner"], ["/app.html", "rechner"],
    ["/ratgeber/", "wissen"], ["/ratgeber/ibc-container", "wissen"], ["/en/guide/pallets-40ft-container", "wissen"], ["/nl/gids/cbm-container", "wissen"], ["/es/guia/", "wissen"], ["/fr/guide/volume-conteneur-m3", "wissen"],
    ["/irgendwas", "sonst"], ["/apple", "sonst"]]) assert.strictEqual(art(p), a, p);
  // Im Skript steht kein Weg, Adresse, Abfrage oder Verweis mitzuschicken.
  assert.ok(!/location\.(href|search|hash)|document\.(referrer|title|cookie)|navigator\.(userAgent|language)/.test(puls), "puls.js liest mehr als den Pfad");
  assert.strictEqual((puls.match(/sendBeacon\(/g) || []).length, 1);
  assert.ok(puls.includes('navigator.sendBeacon("/api/puls", art)'));
  assert.ok(!/fetch\(|XMLHttpRequest|new Image|setItem|document\.cookie|indexedDB|sessionStorage/.test(puls), "puls.js sendet oder speichert auf einem zweiten Weg");
});

test("wer nicht gezaehlt werden will oder nicht gemeint ist, sendet nicht", () => {
  const still = (o) => { const r = lauf(o); r.vor(200000); return r.gesendet.length; };
  assert.strictEqual(still({ dnt: "1" }), 0, "Do Not Track");
  assert.strictEqual(still({ gpc: true }), 0, "Global Privacy Control");
  assert.strictEqual(still({ eigen: true }), 0, "der Betreiber zaehlt nicht mit");
  assert.strictEqual(still({ iframe: true }), 0, "eingebettet");
  assert.strictEqual(still({ host: "localhost" }), 0, "lokal");
  assert.strictEqual(still({ host: "deploy-preview-171--containerload.netlify.app" }), 0, "Vorschau");
  assert.strictEqual(still({ host: "containerload.io.boese.example" }), 0, "fremder Host mit dem Namen im Namen");
  assert.ok(still({ host: "www.containerload.io" }) > 0);
  assert.ok(still({}) > 0, "Gegenprobe: ohne Ausschluss wird gesendet");
});

test("ein Tab im Hintergrund oder ohne Regung ist kein Besucher", () => {
  // Im Hintergrund: nichts.
  const h = lauf({ sichtbar: false });
  h.vor(300000);
  assert.strictEqual(h.gesendet.length, 0);
  // Wieder sichtbar: sofort ein Lebenszeichen -- aber hoechstens eines je Takt.
  h.regung(); h.sichtbarkeit("visible");
  assert.strictEqual(h.gesendet.length, 1);
  h.sichtbarkeit("hidden"); h.sichtbarkeit("visible"); h.sichtbarkeit("hidden"); h.sichtbarkeit("visible");
  assert.strictEqual(h.gesendet.length, 1, "Hin- und Herwechseln sendet mehrfach");
  // Offen, aber fuenf Minuten ohne Regung: verstummt. Mit Regung meldet es sich wieder.
  const r = lauf({});
  r.vor(9000);
  const davor = r.gesendet.length;
  r.vor(20 * 60000);
  assert.ok(r.gesendet.length - davor <= 5, `ein unbenutzter Tab sendet weiter (${r.gesendet.length - davor} in 20 min)`);
  const stumm = r.gesendet.length;
  r.vor(10 * 60000);
  assert.strictEqual(r.gesendet.length, stumm, "nach fuenf Minuten Ruhe wird noch gesendet");
  r.regung(); r.vor(60000);
  assert.strictEqual(r.gesendet.length, stumm + 1, "nach einer Regung meldet sich der Tab nicht wieder");
});

// ── Wo das Skript steht, und wo nicht ──────────────────────────────────────────────────
test("Startseiten, Rechner und Wissensseiten tragen das Skript -- Rechtsseiten, Teilen und Admin nicht", () => {
  const ZEILE = '<script src="/puls.js" defer></script>';
  const mit = ["index.html", "app.html", "en/index.html", "es/index.html", "fr/index.html", "zh/index.html"];
  for (const ordner of ["ratgeber", "en/guide", "nl/gids", "es/guia", "fr/guide"])
    for (const f of fs.readdirSync(path.join(dir, "..", ordner)).filter((x) => x.endsWith(".html"))) mit.push(ordner + "/" + f);
  assert.ok(mit.length > 60);
  for (const f of mit) assert.strictEqual(lies(f).split(ZEILE).length - 1, 1, `${f}: /puls.js nicht genau einmal`);
  for (const f of ["impressum.html", "datenschutz.html", "en/imprint.html", "en/privacy.html", "share.html", "admin.html", "de/index.html"])
    assert.ok(!/<script[^>]*puls\.js/.test(lies(f)), `${f}: soll kein Lebenszeichen senden`);
  // Die erzeugten Seiten bekommen es vom Generator, nicht von Hand.
  const gen = fs.readFileSync(path.join(dir, "..", "..", "werkzeug", "palettenrechner.mjs"), "utf8");
  assert.ok(gen.includes(ZEILE), "werkzeug/palettenrechner.mjs schreibt /puls.js nicht -- der naechste Lauf nimmt es wieder heraus");
});

// ── Admin und Datenschutz ──────────────────────────────────────────────────────────────
test("das Admin zeigt die Live-Anzeige und fragt nur, solange jemand hinsieht", () => {
  const a = lies("admin.html");
  for (const id of ["livePanel", "liveZahl", "liveLaender", "liveSeiten", "liveVerlauf", "liveStand"]) assert.ok(a.includes(`id="${id}"`), `admin: ${id} fehlt`);
  assert.ok(a.includes('fetch("/api/live", { headers: { authorization: "Bearer " + token } })'));
  assert.match(a, /if \(!token \|\| document\.visibilityState !== "visible" \|\| \$\("inhalt"\)\.hidden\) return;/, "die Live-Anzeige fragt auch im Hintergrund");
  assert.match(a, /liveTimer = setInterval\(liveLaden, 30000\)/);
  // Namen werden escapet, bevor sie in die Seite duerfen (Laendercodes kommen vom Server).
  assert.ok(a.includes("laender[esc(name)]") && a.includes("seiten[esc(SEITEN_NAME[k] || k)]"));
  // Jede Seitenart des Servers hat im Admin einen Namen.
  for (const art of PULS_ARTEN) assert.match(a, new RegExp(`\\b${art}: "[^"]+"`), `admin: kein Name fuer die Seitenart ${art}`);
});

test("die Datenschutzseite sagt, was das Lebenszeichen tut -- deutsch und englisch", () => {
  const de = lies("datenschutz.html").replace(/&nbsp;/g, " "), en = lies("en/privacy.html").replace(/&nbsp;/g, " ");
  for (const re of [/einmal pro Minute ein Lebenszeichen/, /nur ein einziges Wort: die Art der Seite/, /keine Kennung gesetzt und kein Cookie/, /gezählt werden Lebenszeichen, nicht Personen/,
    /IP-Adresse wird auch hier nicht gespeichert/, /automatisch wieder gelöscht — in der Regel innerhalb einer Stunde/, /„Do Not Track“ oder Global Privacy Control, wird nichts gesendet/, /Startseite, Container-Wissen oder Rechner/])
    assert.match(de, re, "Datenschutz (deutsch): " + re);
  for (const re of [/a sign of life about once a minute/, /Only a single word is transmitted: the type of page/, /no identifier is set and no cookie is used/, /signs of life, not people/,
    /IP address is not stored here either/, /deleted again automatically — as a rule within an hour/, /“Do Not Track” or Global Privacy Control, nothing is sent/])
    assert.match(en, re, "Datenschutz (englisch): " + re);
  // Der Absatz steht im Abschnitt der eigenen Statistik (5), nicht bei GoatCounter (4).
  const abschnitt5 = de.slice(de.indexOf("<h2>5."), de.indexOf("<h2>6."));
  assert.ok(abschnitt5.includes("Lebenszeichen"));
  // Was die Seite verspricht, haelt der Code: Takt, Ruhe, Haltezeit.
  assert.ok(puls.includes("var TAKT = 60000;") && puls.includes("var RUHE = 5 * 60000;") && puls.includes("var ERST = 8000;"));
  assert.ok(/Stand: November 2026/.test(de) && /Last updated: November 2026/.test(en), "der Stand der Datenschutzseite ist nicht nachgezogen");
});
