// Traegt eine weitere Sprache ueberall ein, wo sie stehen muss: Register im Kopf des Rechners,
// hreflang (Rechner + Startseite), Sitemap, Server (Nutzungsstatistik, KI-Brief), Admin-Seite,
// Sprach-Menue und Sprachangebot der Startseite, Liste des Generators.
//
// VORHER muessen die beiden Sprachdateien da sein:
//   containerload.io/sprache/<k>.js     -- die Texte des Rechners
//   werkzeug/sprachen/<k>.mjs           -- die Texte der Startseite
// DANACH: node werkzeug/startseite-en.mjs  (baut /<k>/index.html) und node --test.
//
// Aufruf (vom Repo-Wurzelverzeichnis):
//   node werkzeug/sprache-eintragen.mjs . fr "Français" "Passer l’interface en français" \
//     "Cette page existe en français." "Passer au français →" "Französisch" "Französisch (Sie-Form, vous)"
// Argumente: Repo, Kuerzel, Name, Satz im Menue, Angebot (Satz, Link-Text) fuer Browser dieser
// Sprache, deutscher Name (Admin-Seite), Zeile fuer den KI-Brief-Auftrag.
// Jede Ersetzung muss genau so oft treffen wie erwartet -- sonst bricht das Skript ab.
import fs from "node:fs";
import path from "node:path";
const [, , repo, K, NAME, SATZ, ANG1, ANG2, DE_NAME, BRIEF] = process.argv;
const W = path.join(repo, "containerload.io");
const B = "https://containerload.io";
const uni = (t) => t.replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const tausche = (datei, paare) => {
  let s = fs.readFileSync(datei, "utf8");
  for (const [a, b, mal = 1] of paare) {
    const n = typeof a === "string" ? s.split(a).length - 1 : (s.match(new RegExp(a.source, a.flags.includes("g") ? a.flags : a.flags + "g")) || []).length;
    if (n !== mal) throw new Error(`${path.basename(datei)}: erwartet ${mal}×, gefunden ${n}×: ${String(a).slice(0, 80)}`);
    s = typeof a === "string" ? s.split(a).join(b) : s.replace(a, b);
  }
  fs.writeFileSync(datei, s);
};
// Die bisher letzte Sprache: hinter ihr wird eingefuegt
const app0 = fs.readFileSync(path.join(W, "app.html"), "utf8");
const reg = /window\.CL_SPRACHEN = \{([^\n]*)\};/.exec(app0)[1];
const bisher = [...reg.matchAll(/([a-z]{2}): \[/g)].map((m) => m[1]);
const L = bisher[bisher.length - 1];
if (bisher.includes(K)) throw new Error(K + " ist schon eingetragen");
console.log("bisher:", bisher.join(", "), "→ neu:", K);

// 1) Rechner: Register, hreflang, KI-Brief-Auswahl
tausche(path.join(W, "app.html"), [
  [`window.CL_SPRACHEN = {${reg}};`, `window.CL_SPRACHEN = {${reg.replace(/\s*$/, "")}, ${K}: ["${uni(NAME)}", "${uni(SATZ)}"] };`],
  [`<link rel="alternate" hreflang="${L}" href="${B}/app?lang=${L}" />\n`, `<link rel="alternate" hreflang="${L}" href="${B}/app?lang=${L}" />\n<link rel="alternate" hreflang="${K}" href="${B}/app?lang=${K}" />\n`],
  [/useState\(\[("[a-z]{2}", )+"[a-z]{2}"\]\.includes\(LANG\) \? LANG : "en"\);/, (m) => m.replace(/"\]\.includes/, `", "${K}"].includes`)],
  [/items: \[\["de", "DE"\], \["en", "EN"\], \["nl", "NL"\](, \["[a-z]{2}", "[A-Z]{2}"\])*\]/, (m) => m.replace(/\]$/, `, ["${K}", "${K.toUpperCase()}"]]`)],
]);
// 2) Server: Statistik und KI-Brief
tausche(path.join(repo, "netlify/functions/lib/nutzung.mjs"), [[/const SPRACHEN = new Set\(\[[^\]]*\]\);/, (m) => m.replace("]);", `, "${K}"]);`)]]);
tausche(path.join(repo, "netlify/functions/lib/ki.mjs"), [
  [/export const BRIEF_SPRACHEN = \[[^\]]*\];/, (m) => m.replace("];", `, "${K}"];`)],
  [/("Zielsprache ist fakten\.sprache: [^"]*)\.",/, (m, a) => `${a}, ${K} = ${BRIEF}.",`],
]);
tausche(path.join(W, "test/ki-import.test.mjs"), [[/assert\.deepEqual\(BRIEF_SPRACHEN, \[[^\]]*\]\);/, (m) => m.replace("]);", `, "${K}"]);`)]]);
tausche(path.join(W, "admin.html"), [[/\{ de: "Deutsch", en: "Englisch"[^}]*\}/, (m) => m.replace(" }", `, ${K}: "${DE_NAME}" }`)]]);
// 3) Startseite: FREMD, hreflang, Menue-Eintraege, Angebot fuer Browser dieser Sprache
tausche(path.join(W, "index.html"), [
  [/FREMD=\[[^\]]*\];/, (m) => m.replace("];", `,'${K}'];`)],
  [`<link rel="alternate" hreflang="${L}" href="${B}/${L}/" />\n`, `<link rel="alternate" hreflang="${L}" href="${B}/${L}/" />\n<link rel="alternate" hreflang="${K}" href="${B}/${K}/" />\n`],
  [new RegExp(`^( +)<a data-lang="${L}" href="/${L}/" hreflang="${L}" class="langbtn">[^<]*</a>\\n`, "gm"), (ganz, ein) => ganz + `${ein}<a data-lang="${K}" href="/${K}/" hreflang="${K}" class="langbtn">${NAME}</a>\n`, 2],
  [/ANG=\{(.*?)\};/, (m, innen) => `ANG={${innen},${K}:['${uni(ANG1).replace(/'/g, "\\'")}','${uni(ANG2).replace(/'/g, "\\'")}']};`],
]);
// 4) Generator: die Sprache gehoert in die Liste
tausche(path.join(repo, "werkzeug/startseite-en.mjs"), [
  [new RegExp(`import ${L} from './sprachen/${L}\\.mjs';\\n`), (m) => m + `import ${K} from './sprachen/${K}.mjs';\n`],
  [/export const SPRACHEN = \[[^\]]*\];/, (m) => m.replace("];", `, ${K}];`)],
]);
// 5) Sitemap: Startseite und Rechner, je mit Zeile in allen Bloecken und eigenem Block
let k = fs.readFileSync(path.join(W, "sitemap.xml"), "utf8");
for (const [zeileL, zeileK, locL, locK] of [
  [`hreflang="${L}" href="${B}/${L}/"/>`, `hreflang="${K}" href="${B}/${K}/"/>`, `${B}/${L}/`, `${B}/${K}/`],
  [`hreflang="${L}" href="${B}/app?lang=${L}"/>`, `hreflang="${K}" href="${B}/app?lang=${K}"/>`, `${B}/app?lang=${L}`, `${B}/app?lang=${K}`],
]) {
  const zl = `    <xhtml:link rel="alternate" ${zeileL}\n`;
  if (k.split(zl).length - 1 < 3) throw new Error("Sitemap: zu wenige Bloecke mit " + zeileL);
  k = k.split(zl).join(zl + `    <xhtml:link rel="alternate" ${zeileK}\n`);
  const a = k.indexOf(`  <url>\n    <loc>${locL}</loc>`), e = k.indexOf("  </url>\n", a) + 9;
  if (a < 0) throw new Error("Sitemap-Block fehlt: " + locL);
  k = k.slice(0, e) + k.slice(a, e).replace(`<loc>${locL}</loc>`, `<loc>${locK}</loc>`) + k.slice(e);
}
fs.writeFileSync(path.join(W, "sitemap.xml"), k);
console.log("eingetragen:", K);
