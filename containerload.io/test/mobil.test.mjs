// Drei Seiten liessen sich auf dem Telefon seitlich schieben.
//
// Gefunden mit einem echten Browser bei 390 px, festgehalten hier als das, was im
// Quelltext dafuer stehen muss — die CI hat keinen Browser, aber sie kann pruefen,
// ob die Vorkehrung noch da ist.
//
//   Startseite: .clh-stage hat min-height 380 px UND ein Seitenverhaeltnis. Beides
//     zusammen bestimmt die BREITE: 380 hoch bei 1,05 sind 399 breit — mehr, als ein
//     390 px schmales Telefon hergibt. Die Buehne hat die ganze Seite hinausgeschoben.
//   Container-Wissen: die Zahlenspalten stehen mit white-space:nowrap (richtig so, eine
//     Zahl darf nicht umbrechen). Die Tabelle wurde dadurch breiter als das Fenster.
//   Rechner: Marke, Sprachwahl, Planname, Speichern, Teilen und "…" brauchen zusammen
//     479 px in einer Zeile.
//
// node --test test/mobil.test.mjs
import fs from "node:fs";
import assert from "node:assert";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const lies = (...p) => fs.readFileSync(path.join(dir, "..", ...p), "utf8");

test("die Hero-Buehne gibt ihre Mindesthoehe auf schmalen Schirmen auf", () => {
  const s = lies("index.html");
  assert.match(s, /\.clh-stage\{[^}]*min-height:\s*380px/, "die Buehne hat keine Mindesthoehe mehr — dann ist dieser Test gegenstandslos");
  const m = s.match(/@media\(max-width:(\d+)px\)\{\.clh-stage\{min-height:0\}\}/);
  assert.ok(m, "es fehlt die Regel, die die Mindesthoehe auf schmalen Schirmen aufhebt");
  assert.ok(Number(m[1]) >= 440,
    `die Regel greift erst ab ${m[1]} px — die Buehne erzwingt aber schon bei rund 440 px eine zu grosse Breite`);
});

test("jede Tabelle im Container-Wissen scrollt in ihrem eigenen Kasten", () => {
  const css = lies("ratgeber", "wissen.css");
  assert.match(css, /\.tabelle\{[^}]*overflow-x:\s*auto/, "wissen.css kennt keinen scrollenden Tabellenkasten");
  const seiten = fs.readdirSync(path.join(dir, "..", "ratgeber")).filter((f) => f.endsWith(".html"));
  for (const f of seiten) {
    const s = lies("ratgeber", f);
    const tabellen = (s.match(/<table>/g) || []).length;
    const umschlossen = (s.match(/<div class="tabelle"><table>/g) || []).length;
    assert.strictEqual(umschlossen, tabellen, `${f}: ${tabellen} Tabellen, davon ${umschlossen} im Kasten`);
  }
});

test("die Kopfzeile des Rechners darf auf dem Telefon umbrechen", () => {
  const s = lies("app.html");
  assert.match(s, /"header", \{ className: "flex flex-wrap items-center/,
    "die Kopfzeile bricht nicht mehr um — auf 390 px passt sie nicht in eine Zeile");
  // Die Sprachwahl muss sich per Klasse ausblenden lassen. Stuende display:flex fest im
  // style-Attribut, koennte "hidden sm:flex" nichts ausrichten.
  const i = s.indexOf('["de", "en"].map((l)');
  const davor = s.slice(Math.max(0, i - 260), i);
  assert.match(davor, /className: "hidden sm:flex"/, "die Sprachwahl im Kopf laesst sich nicht mehr ausblenden");
  assert.ok(!/className: "hidden sm:flex", style: \{ display: "flex"/.test(davor),
    "display:flex steht wieder fest im style-Attribut und schlaegt die Klasse");
});
