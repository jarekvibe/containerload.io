// Erzeugt die Teilen-Zwischenseiten je Sprache -- containerload.io/<kuerzel>/share.html --
// aus containerload.io/share.html.
//
// Warum es sie gibt: Wer einen Plan verschickt, verschickt einen Link, und WhatsApp, Teams,
// Slack oder LinkedIn zeigen dazu eine Vorschau-Karte. Deren Scraper liest NUR den Kopf der
// Seite (og:title, og:description, og:image) und fuehrt kein Skript aus. Die eine Seite
// /share konnte deshalb nur eine Karte zeigen -- Deutsch und Englisch nebeneinander --, auch
// wenn der Absender spanisch, franzoesisch oder chinesisch arbeitet (Jarek, 25.11.26: "Wir
// muessen wirklich alles uebersetzen dann auf die jeweiligen Sprachen"). Jede Sprache ausser
// Deutsch bekommt darum ihre eigene Seite mit eigenem Kopf und eigenem Bild
// (share-og-<kuerzel>.png, siehe werkzeug/teilen-bilder.mjs); der Rechner haengt den
// Sprachpfad an jeden Link, den er herausgibt (teilAdresse in app.html).
//
// Quelle von allem ist share.html selbst: das TEXTE-Woerterbuch im Skript der Seite traegt je
// Sprache die Seitentexte (titel, ey, h1, p, go, ns) und die Texte der Karte (desc, og,
// ogText, alt). Wer share.html aendert, laesst danach diesen Generator laufen;
// test/teilen-seite.test.mjs vergleicht jede Sprachseite Zeichen fuer Zeichen.
//
// Abhaengigkeitsfrei (reine Zeichenketten-Arbeit), damit der Test ihn direkt laden kann.
// Aufruf: node werkzeug/teilen-seiten.mjs
import fs from 'node:fs';

const BASIS = 'https://containerload.io';

const ersetzeGenau = (s, alt, neu) => {
  const n = s.split(alt).length - 1;
  if (n !== 1) throw new Error(`teilen-seiten: erwartet genau 1 Treffer, gefunden ${n}: ${alt.slice(0, 80)}`);
  return s.replace(alt, () => neu);
};
// Text in ein Attribut bzw. in den Elementinhalt
const attr = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const inhalt = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Das TEXTE-Woerterbuch aus dem Skript der Seite (reines Objekt-Literal aus Zeichenketten)
export function texte(quelle) {
  const m = /var TEXTE = (\{[\s\S]*?\n    \});/.exec(quelle);
  if (!m) throw new Error('teilen-seiten: TEXTE in share.html nicht gefunden');
  return new Function('return ' + m[1])();
}
export const SCHLUESSEL = ['titel', 'ey', 'h1', 'p', 'go', 'ns', 'desc', 'og', 'ogText', 'alt'];
export const sprachen = (quelle) => Object.keys(texte(quelle));

// Die Seite einer Sprache
export function teilenSeite(quelle, k) {
  const t = texte(quelle)[k];
  if (!t) throw new Error('teilen-seiten: keine Texte fuer ' + k);
  for (const s of SCHLUESSEL) if (!t[s]) throw new Error(`teilen-seiten: ${k} fehlt "${s}"`);
  const bild = `${BASIS}/share-og-${k}.png`, adresse = `${BASIS}/${k}/share`;
  let s = quelle;
  s = ersetzeGenau(s, '<!DOCTYPE html>\n<html lang="de">', `<!DOCTYPE html>\n<!-- Erzeugt von werkzeug/teilen-seiten.mjs aus share.html -- nicht von Hand aendern. -->\n<html lang="${k}">`);
  // Kopf
  s = ersetzeGenau(s, '<title>Stauplan ansehen — ContainerLoad</title>', `<title>${inhalt(t.titel)}</title>`);
  s = s.replace(/<meta name="description" content="[^"]*" \/>/, () => `<meta name="description" content="${attr(t.desc)}" />`);
  s = ersetzeGenau(s, `<link rel="canonical" href="${BASIS}/share" />`, `<link rel="canonical" href="${adresse}" />`);
  // Der Kommentar der Quelle erklaert, warum DIE zweisprachig ist -- hier stimmt er nicht
  s = s.replace(/<!-- Zweisprachig, und zwar mit Absicht:[\s\S]*?-->/, () => `<!-- Die Vorschau-Karte in der Sprache dieser Seite. Die deutsche Seite /share ist zweisprachig\n     (Deutsch · Englisch); sie ist die Quelle dieser Datei. -->`);
  const meta = (name, wert, art = 'property') => {
    const re = new RegExp(`<meta ${art}="${name}" content="[^"]*" />`);
    if (!re.test(s)) throw new Error('teilen-seiten: Kopfzeile fehlt: ' + name);
    s = s.replace(re, () => `<meta ${art}="${name}" content="${attr(wert)}" />`);
  };
  meta('og:title', t.og);
  meta('og:description', t.ogText);
  meta('og:url', adresse);
  meta('og:image', bild);
  meta('og:image:alt', t.alt);
  meta('twitter:title', t.og, 'name');
  meta('twitter:description', t.ogText, 'name');
  meta('twitter:image', bild, 'name');
  // Text im Markup -- derselbe, den das Skript der Seite einsetzen wuerde (h1 traegt <br>)
  s = ersetzeGenau(s, '<div class="eyebrow" id="s-ey">Geteilter Stauplan</div>', `<div class="eyebrow" id="s-ey">${t.ey}</div>`);
  s = ersetzeGenau(s, '<h1 id="s-h1">Ein Ladeplan wurde<br>mit dir geteilt.</h1>', `<h1 id="s-h1">${t.h1}</h1>`);
  s = s.replace(/<p id="s-p">[^<]*<\/p>/, () => `<p id="s-p">${inhalt(t.p)}</p>`);
  s = ersetzeGenau(s, '<a class="btn" id="go" href="/app">Stauplan öffnen →</a>', `<a class="btn" id="go" href="/app?lang=${k}">${inhalt(t.go)}</a>`);
  s = s.replace(/(<div id="s-noscript" style="[^"]*">)[^<]*(<\/div>)/, (_, a, b) => a + inhalt(t.ns) + b);
  // Das Skript: die Seite kennt ihre Sprache auch ohne ?lang=
  s = ersetzeGenau(s, '    var SEITE = "";\n', `    var SEITE = "${k}";\n`);
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quelle = fs.readFileSync(new URL('../containerload.io/share.html', import.meta.url), 'utf8');
  for (const k of sprachen(quelle)) {
    const ziel = new URL(`../containerload.io/${k}/share.html`, import.meta.url);
    const html = teilenSeite(quelle, k);
    fs.mkdirSync(new URL('.', ziel), { recursive: true });
    fs.writeFileSync(ziel, html);
    console.log(k + '/share.html', html.length, 'Zeichen');
  }
}
