// Erzeugt containerload.io/en/index.html -- die englische Startseite -- aus
// containerload.io/index.html. Bis November 2026 war die englische Startseite dasselbe
// HTML unter /?lang=en, per Skript uebersetzt; die Websuche zeigte sie mit dem DEUTSCHEN
// Titel, und englische Werkzeug-Anfragen ("container loading calculator") standen auf
// Platz 80+. Jetzt ist sie eine eigene Datei mit englischem Text, Kopf, Schema und Links.
//
// Quelle von allem ist index.html selbst: das EN-Woerterbuch (var EN={...}, je data-i18n-
// Schluessel der englische Inhalt, dazu meta_*/ld_* fuer Kopf und Schema) und die GUIDE-
// Tabelle (deutscher Ratgeber-Pfad -> englischer Guide-Pfad). Wer index.html aendert,
// laesst danach diesen Generator laufen; test/startseite-en.test.mjs vergleicht die Datei
// Zeichen fuer Zeichen mit dem, was startseiteEn() aus index.html macht.
//
// WEITERE SPRACHEN (seit 25.11.26): derselbe Generator baut auch /es/index.html usw. Je Sprache
// liegt eine Datei in werkzeug/sprachen/<kuerzel>.mjs (texte, inline, guide). Der Aufruf unten
// schreibt ALLE Sprachseiten neu; test/startseite-sprachen.test.mjs vergleicht jede Datei
// Zeichen fuer Zeichen. Der Name dieser Datei ist geblieben, damit der eine Handgriff
// ("nach jeder Aenderung an index.html: node werkzeug/startseite-en.mjs") derselbe bleibt.
//
// Abhaengigkeitsfrei (reine Zeichenketten-Arbeit), damit der Test ihn direkt laden kann.
// Aufruf: node werkzeug/startseite-en.mjs
import fs from 'node:fs';
import es from './sprachen/es.mjs';

// Jede Sprache ausser Deutsch (Quelle) und Englisch (Woerterbuch steht in index.html)
export const SPRACHEN = [es];

const BASIS = 'https://containerload.io';

// Inhalt eines Elements ersetzen: vom Ende des oeffnenden Tags bis zum PASSENDEN
// schliessenden Tag (gleichnamige Tags dazwischen werden mitgezaehlt).
function innenErsetzen(html, start, tag, neu) {
  const auf = html.indexOf('>', start) + 1;
  const re = new RegExp('<(/?)' + tag + '(?=[\\s>/])', 'gi');
  re.lastIndex = auf;
  let tiefe = 1, m;
  while ((m = re.exec(html))) {
    tiefe += m[1] ? -1 : 1;
    if (tiefe === 0) return html.slice(0, auf) + neu + html.slice(m.index);
  }
  throw new Error('kein schliessendes </' + tag + '> ab ' + start);
}

const ersetzeGenau = (s, alt, neu) => {
  const n = s.split(alt).length - 1;
  if (n !== 1) throw new Error(n + '× gefunden: ' + alt.slice(0, 80));
  return s.replace(alt, () => neu);
};
const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function woerterbuch(de) {
  const m = de.match(/var EN=(\{.*?\});\n/s);
  if (!m) throw new Error('EN-Woerterbuch nicht gefunden');
  return JSON.parse(m[1]);
}

export function guideTabelle(de) {
  const a = de.indexOf('var GUIDE={'), e = de.indexOf('};', a);
  const t = {};
  for (const [, von, nach] of de.slice(a, e).matchAll(/'([^']+)':'([^']+)'/g)) t[von] = nach;
  return t;
}

export function startseiteEn(de) {
  return startseite(de, { kuerzel: 'en', texte: woerterbuch(de), inline: null, guide: {} });
}
export function startseiteSprache(de, X) {
  return startseite(de, X);
}

// Die { de:'…', en:'…' }-Paare in den Skripten der Seite: 'en' ist der Platz fuer die Sprache
// der SEITE. Fuer jede weitere Sprache setzt der Generator dort die Uebersetzung ein -- und
// verlangt sie fuer JEDEN englischen Text (fehlt einer, bliebe mitten im Spanischen Englisch).
const INLINE_RE = /\ben:('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;
export function inlineTexte(html) {
  return [...new Set([...html.matchAll(INLINE_RE)].map((m) => new Function('return ' + m[1])()))];
}
const jsText = (t) => "'" + t.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";

function startseite(de, X) {
  const K = X.kuerzel, EN = X.texte, GUIDE = guideTabelle(de);
  if (K !== 'en') {
    const soll = Object.keys(woerterbuch(de)).sort().join(','), ist = Object.keys(EN).sort().join(',');
    if (soll !== ist) throw new Error(K + ': die Schluessel weichen vom EN-Woerterbuch ab');
  }
  let s = de;

  // 1) Jeder data-i18n-Block bekommt seinen englischen Inhalt
  const re = /<([a-z][a-z0-9]*)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>/gi;
  const stellen = [];
  let m;
  while ((m = re.exec(s))) stellen.push({ start: m.index, tag: m[1], key: m[2] });
  for (const st of stellen.reverse()) {
    if (EN[st.key] === undefined) throw new Error('kein englischer Text fuer ' + st.key);
    s = innenErsetzen(s, st.start, st.tag, EN[st.key]);
  }

  // 1b) Beschriftungen, die in Attributen stehen (Design-Umschalter, Platzhalter der Import-Box).
  //     Bis 25.11.26 blieben sie auch auf der englischen Seite deutsch -- ein Vorleseprogramm
  //     las dort "Dunkles Design".
  for (const [alt, neu] of [['Dunkles Design', EN.thema_dunkel], ['Helles Design', EN.thema_hell]]) {
    const von = 'aria-label="' + alt + '" title="' + alt + '"';
    if (!s.includes(von)) throw new Error('Design-Umschalter nicht gefunden: ' + alt);
    s = s.split(von).join('aria-label="' + attr(neu) + '" title="' + attr(neu) + '"');
  }
  s = ersetzeGenau(s, 'placeholder="Packliste aus Excel hier einfügen …"', 'placeholder="' + attr(EN.imp_ph) + '"');

  // 2) Sprache, Kopf, Kanonische Adresse
  s = ersetzeGenau(s, '<html lang="de"', '<html lang="' + K + '"');
  s = s.replace(/<title>[^<]*<\/title>/, () => '<title>' + EN.meta_t + '</title>');
  const meta = (sel, wert) => {
    const r = new RegExp('(<meta ' + sel + ' content=")[^"]*(")');
    if (!r.test(s)) throw new Error('Kopfzeile fehlt: ' + sel);
    s = s.replace(r, (_, a, b) => a + attr(wert) + b);
  };
  meta('name="description"', EN.meta_d);
  meta('property="og:title"', EN.meta_ot);
  meta('property="og:description"', EN.meta_od);
  meta('property="og:image:alt"', EN.meta_ot);
  meta('name="twitter:title"', EN.meta_ot);
  meta('name="twitter:description"', EN.meta_od);
  meta('property="og:url"', BASIS + '/' + K + '/');
  s = ersetzeGenau(s, '<link rel="canonical" href="' + BASIS + '/" />', '<link rel="canonical" href="' + BASIS + '/' + K + '/" />');

  // 3) Strukturierte Daten auf Englisch (dieselben Fakten, andere Sprache)
  s = s.replace(/<script type="application\/ld\+json">(.*?)<\/script>/s, (_, j) => {
    const o = JSON.parse(j);
    o.url = BASIS + '/' + K + '/';
    o.alternateName = EN.ld_name;
    o.applicationSubCategory = EN.ld_sub;
    o.browserRequirements = EN.ld_browser;
    o.description = EN.ld_d;
    o.featureList = EN.ld_features.split('|');
    return '<script type="application/ld+json">' + JSON.stringify(o) + '</script>';
  });

  // 4) Links im Seitenkoerper: Rechner auf Englisch, Wissen auf den Guide, Start auf /en/.
  //    Sprachknoepfe (data-lang) bleiben, wie sie sind -- DE muss auf / zeigen.
  const kopfEnde = s.indexOf('<body');
  const kopf = s.slice(0, kopfEnde);
  let koerper = s.slice(kopfEnde);
  koerper = koerper.replace(/<a\b[^>]*>/g, (tag) => {
    if (/\bdata-lang=/.test(tag)) return tag;
    return tag.replace(/\bhref="([^"]*)"/, (ganz, h) => {
      let n = h;
      if (h === '/' || h === '/?lang=en') n = '/' + K + '/';
      else if (/^\/app(\?|$)/.test(h)) n = /[?&]lang=/.test(h) ? h : h + (h.includes('?') ? '&' : '?') + 'lang=' + K;
      else if (X.guide[h]) n = X.guide[h];
      else if (GUIDE[h]) n = GUIDE[h];
      return 'href="' + n + '"';
    });
  });
  s = kopf + koerper;

  // 5) Aktive Sprache: der Knopf dieser Seite ist "on", der DE-Knopf nicht
  s = s.replace(/class="langbtn on">DE<\/a>/g, 'class="langbtn">DE</a>');
  let knoepfe = 0;
  s = s.replace(new RegExp('(<a data-lang="' + K + '" [^>]*class="langbtn)(">)', 'g'), (_, a, b) => { knoepfe++; return a + ' on' + b; });
  if (knoepfe !== 2) throw new Error(K + ': ' + knoepfe + ' Sprachknoepfe statt 2 -- fehlt der Knopf in index.html?');

  // 5b) Weitere Sprachen: die Texte in den Skripten und das Woerterbuch der Seite
  if (X.inline) {
    const dictA = s.indexOf('var EN={'), dictE = s.indexOf('};\n', dictA) + 3;
    if (dictA < 0 || dictE < dictA) throw new Error('Woerterbuch der Seite nicht gefunden');
    const uebersetze = (teil) => teil.replace(INLINE_RE, (_, lit) => {
      const en = new Function('return ' + lit)();
      if (X.inline[en] === undefined) throw new Error(K + ': keine Uebersetzung fuer den Skript-Text "' + en + '"');
      return 'en:' + jsText(X.inline[en]);
    });
    s = uebersetze(s.slice(0, dictA)) + 'var EN=' + JSON.stringify(EN) + ';\n' + uebersetze(s.slice(dictE));
  }

  // 6) Herkunft vermerken
  s = ersetzeGenau(s, '<!DOCTYPE html>\n', '<!DOCTYPE html>\n<!-- Erzeugt von werkzeug/startseite-en.mjs aus index.html -- nicht von Hand aendern. -->\n');
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quelle = new URL('../containerload.io/index.html', import.meta.url);
  const ziel = new URL('../containerload.io/en/index.html', import.meta.url);
  const de = fs.readFileSync(quelle, 'utf8');
  const en = startseiteEn(de);
  fs.mkdirSync(new URL('.', ziel), { recursive: true });
  fs.writeFileSync(ziel, en);
  console.log('en/index.html', en.length, 'Zeichen');
  for (const X of SPRACHEN) {
    const z = new URL('../containerload.io/' + X.kuerzel + '/index.html', import.meta.url);
    const html = startseiteSprache(de, X);
    fs.mkdirSync(new URL('.', z), { recursive: true });
    fs.writeFileSync(z, html);
    console.log(X.kuerzel + '/index.html', html.length, 'Zeichen');
  }
}
