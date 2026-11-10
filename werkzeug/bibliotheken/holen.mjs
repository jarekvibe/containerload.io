// Holt die Bibliotheken und Schriften, die ContainerLoad SELBST ausliefert, aus der
// npm-Registry und legt sie ins Publish-Verzeichnis:
//
//   containerload.io/vendor/    React, ReactDOM, Three.js (r128) -- unveraendert, wie veroeffentlicht
//   containerload.io/schrift/   Archivo, JetBrains Mono (Oberflaeche) sowie Manrope und
//                               Space Grotesk (Ladevorschlag) als woff2, dazu schrift.css / druck.css
//
// WARUM: Bis November 2026 kamen React und Three.js von cdnjs und die Schriften von Google
// Fonts. Jeder Seitenaufruf gab damit die IP-Adresse an zwei bzw. drei fremde Server, hinter
// einer Firmen-Firewall, die cdnjs sperrt, blieb der Rechner beim Laden stehen, und ein
// kompromittiertes CDN haette fremden Code in die Seite gebracht. Die Dateien sind dieselben
// wie vorher -- cdnjs spiegelt genau diese npm-Pakete --, sie liegen jetzt nur bei uns.
//
// Das ist KEIN Build-Schritt: die Ausgabe ist eingecheckt, die Seite laeuft durch blosses
// Oeffnen. Dieses Skript braucht nur, wer eine Version anhebt. Dann: Version und Pruefsumme
// unten aendern (die Pruefsumme steht als "dist.integrity" unter
// https://registry.npmjs.org/<paket>/<version>), laufen lassen, im Browser ansehen.
//
// Sicherheit: jedes Tarball wird gegen die HIER eingetragene sha512-Pruefsumme geprueft,
// bevor irgendetwas daraus gelesen wird. Paket-Code laeuft nie -- es werden nur Dateien
// kopiert. Keine Abhaengigkeit, kein npm install.
//
//   node werkzeug/bibliotheken/holen.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const ZIEL = path.join(hier, "..", "..", "containerload.io");

// ── Bibliotheken ────────────────────────────────────────────────────────────
// Der Dateiname traegt die Version: wer anhebt, bekommt einen neuen Namen und muss die
// <script>-Zeilen in app.html / index.html bewusst umstellen (test/eigene-dateien.test.mjs
// faellt sonst).
const BIBLIOTHEKEN = [
  { paket: "react", version: "18.3.1", lizenz: "MIT",
    integrity: "sha512-wS+hAgJShR0KhEvPJArfuPVN1+Hz1t0Y6n5jLrGQbkb4urgPE/0Rve+1kMB1v/oWgHgm4WIcV+i7F2pTVj+2iQ==",
    dateien: { "package/umd/react.production.min.js": "vendor/react-18.3.1.production.min.js" } },
  { paket: "react-dom", version: "18.3.1", lizenz: "MIT",
    integrity: "sha512-5m4nQKp+rZRb09LNH59GM4BxTh9251/ylbKIbpe7TpGxfJ+9kv6BLkLBXIjjspbgbnIBNqlI23tRnTWT0snUIw==",
    dateien: { "package/umd/react-dom.production.min.js": "vendor/react-dom-18.3.1.production.min.js" } },
  // r128 = npm 0.128.0. Version nicht ungefragt anheben (CLAUDE.md, Abschnitt 2).
  { paket: "three", version: "0.128.0", lizenz: "MIT",
    integrity: "sha512-i0ap/E+OaSfzw7bD1TtYnPo3VEplkl70WX5fZqZnfZsE3k3aSFudqrrC9ldFZfYFkn1zwDmBcdGfiIm/hnbyZA==",
    dateien: { "package/build/three.min.js": "vendor/three-r128.min.js" } },
];

// ── Schriften ───────────────────────────────────────────────────────────────
// Fontsource verpackt die Google-Fonts-Schriften (alle SIL OFL 1.1) als woff2 je
// Schriftsystem. Wir nehmen die variable Fassung (EINE Datei fuer alle Gewichte) und nur
// "latin" und "latin-ext": latin deckt Deutsch, Englisch, Niederlaendisch und die
// Satzzeichen, latin-ext laedt der Browser nur nach, wenn ein Zeichen daraus vorkommt
// (unicode-range) -- etwa ein polnisches "ł" in einem Plan-Namen.
const SCHRIFTEN = [
  { familie: "Archivo", slug: "archivo", css: "schrift.css", paket: "@fontsource-variable/archivo", version: "5.3.0",
    integrity: "sha512-HogK8FJelrD1o7TlZlkIVtHgc20bO5PZRWE7mUeUTdMN055alznQV6/00J00IBeu8FQAH4s3zW9UJNvKExXf+g==" },
  { familie: "JetBrains Mono", slug: "jetbrains-mono", css: "schrift.css druck.css", paket: "@fontsource-variable/jetbrains-mono", version: "5.3.0",
    integrity: "sha512-F32xpS2NsGYoQi2ADSkKTgpJj7ozajsGgDJ8woTnqjmIB+dxDIqImjl4pXZVEExu8UFZ2ndhmX18EBS/hdz3Lw==" },
  { familie: "Manrope", slug: "manrope", css: "druck.css", paket: "@fontsource-variable/manrope", version: "5.3.0",
    integrity: "sha512-6D5dgokHsWDDMtmXHznKa0hK229NN+1a4BLPmUCLqcO1Pw5EEhWY5RFt0AcXnVRAljFFPfRtLkJePQj6LSsV6g==" },
  { familie: "Space Grotesk", slug: "space-grotesk", css: "druck.css", paket: "@fontsource-variable/space-grotesk", version: "5.3.0",
    integrity: "sha512-2IxmvfB08i9vnGB3Ym/AXvhRE+8XOjWMXIyDum03c+tPwH0FUoMNQfGpU8NXPxjbws0Vvss3AH0Zqt4oJBBAdw==" },
];
const SYSTEME = ["latin-ext", "latin"];   // latin zuletzt: bei Gleichstand gewinnt die spaetere Regel

const tarballUrl = (paket, version) =>
  "https://registry.npmjs.org/" + paket + "/-/" + paket.split("/").pop() + "-" + version + ".tgz";

// Tarball holen, Pruefsumme vergleichen, Dateien als Map { pfad -> Buffer } liefern.
async function holen(paket, version, integrity) {
  const antwort = await fetch(tarballUrl(paket, version));
  if (!antwort.ok) throw new Error(paket + "@" + version + ": Registry antwortet " + antwort.status);
  const tgz = Buffer.from(await antwort.arrayBuffer());
  const ist = "sha512-" + crypto.createHash("sha512").update(tgz).digest("base64");
  if (ist !== integrity) {
    throw new Error(paket + "@" + version + ": Pruefsumme stimmt nicht.\n  erwartet " + integrity + "\n  erhalten " + ist +
      "\nNichts wurde geschrieben. Version und Pruefsumme gehoeren zusammen (dist.integrity in der Registry).");
  }
  return tarLesen(zlib.gunzipSync(tgz));
}

// Minimaler tar-Leser (ustar): 512-Byte-Kopf, Name in den ersten 100 Bytes (plus Praefix
// ab 345), Groesse oktal ab 124. Reicht fuer npm-Tarballs; lange Namen (PAX) kommen in den
// Dateien, die wir brauchen, nicht vor -- fehlt eine, bricht der Lauf unten mit Namen ab.
function tarLesen(tar) {
  const dateien = new Map();
  for (let pos = 0; pos + 512 <= tar.length;) {
    const kopf = tar.subarray(pos, pos + 512);
    const text = (von, laenge) => kopf.subarray(von, von + laenge).toString("utf8").replace(/\0.*$/s, "");
    const name = text(0, 100);
    if (!name) break;
    const groesse = parseInt(text(124, 12).trim() || "0", 8);
    const typ = text(156, 1);
    const praefix = text(345, 155);
    if (typ === "0" || typ === "") dateien.set((praefix ? praefix + "/" : "") + name, tar.subarray(pos + 512, pos + 512 + groesse));
    pos += 512 + Math.ceil(groesse / 512) * 512;
  }
  return dateien;
}

const schreiben = (rel, inhalt) => {
  const ziel = path.join(ZIEL, rel);
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, inhalt);
  console.log("  " + rel.padEnd(52) + String(inhalt.length).padStart(8) + " B");
};
const brauche = (dateien, pfad, paket) => {
  const d = dateien.get(pfad);
  if (!d) throw new Error(paket + ": " + pfad + " fehlt im Tarball");
  return d;
};

// Die unicode-range je Schriftsystem steht in der CSS des Pakets; wir uebernehmen sie
// woertlich statt sie abzuschreiben.
function bereichAus(css, slug, system) {
  const regel = css.split("@font-face").find((r) => r.includes(slug + "-" + system + "-wght-normal.woff2"));
  const range = regel && /unicode-range:\s*([^;]+);/.exec(regel);
  const gewicht = regel && /font-weight:\s*([^;]+);/.exec(regel);
  if (!range || !gewicht) throw new Error(slug + ": @font-face fuer " + system + " nicht gefunden");
  return { range: range[1].trim(), gewicht: gewicht[1].trim() };
}

console.log("Bibliotheken:");
const lizenzenBib = [];
for (const b of BIBLIOTHEKEN) {
  const dateien = await holen(b.paket, b.version, b.integrity);
  for (const [von, nach] of Object.entries(b.dateien)) schreiben(nach, brauche(dateien, von, b.paket));
  lizenzenBib.push("=".repeat(78) + "\n" + b.paket + " " + b.version + " (" + b.lizenz + ")\n" +
    Object.values(b.dateien).join(", ") + "\nQuelle: " + tarballUrl(b.paket, b.version) + "\n" + "=".repeat(78) + "\n\n" +
    brauche(dateien, "package/LICENSE", b.paket).toString("utf8").trim() + "\n");
}
schreiben("vendor/LIZENZEN.txt",
  "Bibliotheken, die ContainerLoad unveraendert selbst ausliefert.\nErzeugt von werkzeug/bibliotheken/holen.mjs -- nicht von Hand aendern.\n\n" +
  lizenzenBib.join("\n"));

console.log("Schriften:");
const regeln = { "schrift.css": [], "druck.css": [] };
const lizenzenSchrift = [];
for (const s of SCHRIFTEN) {
  const dateien = await holen(s.paket, s.version, s.integrity);
  const css = brauche(dateien, "package/wght.css", s.paket).toString("utf8");
  for (const system of SYSTEME) {
    const datei = s.slug + "-" + s.version + "-" + system + ".woff2";
    schreiben("schrift/" + datei, brauche(dateien, "package/files/" + s.slug + "-" + system + "-wght-normal.woff2", s.paket));
    const { range, gewicht } = bereichAus(css, s.slug, system);
    const regel = "@font-face{font-family:'" + s.familie + "';font-style:normal;font-display:swap;font-weight:" + gewicht +
      ";src:url(" + datei + ") format('woff2');unicode-range:" + range + "}";
    for (const ziel of s.css.split(" ")) regeln[ziel].push(regel);
  }
  lizenzenSchrift.push("=".repeat(78) + "\n" + s.familie + " -- " + s.paket + " " + s.version + " (SIL Open Font License 1.1)\n" +
    "Quelle: " + tarballUrl(s.paket, s.version) + "\n" + "=".repeat(78) + "\n\n" +
    brauche(dateien, "package/LICENSE", s.paket).toString("utf8").trim() + "\n");
}
const kopf = (wofuer) => "/* " + wofuer + "\n * Erzeugt von werkzeug/bibliotheken/holen.mjs -- nicht von Hand aendern.\n" +
  " * Variable Schriften: eine Datei je Schriftsystem traegt alle Gewichte. latin-ext wird nur\n" +
  " * geladen, wenn ein Zeichen daraus vorkommt (unicode-range). Lizenzen: LIZENZEN.txt. */\n";
schreiben("schrift/schrift.css", kopf("Schriften der Oberflaeche: Archivo und JetBrains Mono, selbst ausgeliefert.") + regeln["schrift.css"].join("\n") + "\n");
schreiben("schrift/druck.css", kopf("Schriften des Ladevorschlags (LV_DOC in app.html): Manrope, Space Grotesk, JetBrains Mono.") + regeln["druck.css"].join("\n") + "\n");
schreiben("schrift/LIZENZEN.txt",
  "Schriften, die ContainerLoad selbst ausliefert (unveraendert, als woff2).\nErzeugt von werkzeug/bibliotheken/holen.mjs -- nicht von Hand aendern.\n\n" +
  lizenzenSchrift.join("\n"));
console.log("Fertig.");
