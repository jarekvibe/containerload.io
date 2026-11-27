// Frischt die Beispiel-Antworten von /api/plan auf: den gekuerzten JSON-Auszug auf den beiden
// Link-Format-Seiten (ratgeber/ladeplan-per-link, en/guide/load-plan-by-link) und den Satz
// "Its answer begins:" in llms.txt.
//
// Die Beispiele sind keine Abschrift, sondern das, was die Schnittstelle fuer genau die
// gezeigte Adresse antwortet (planen aus netlify/functions/lib/plan.mjs). Aendert sich der
// Packer oder der Wortlaut der Antwort, laeuft dieses Skript erneut;
// test/plan-api.test.mjs vergleicht Seite und Rechnung Zeichen fuer Zeichen.
//
// Aufruf: node werkzeug/api-beispiele.mjs
import fs from 'node:fs';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Die Adresse des Beispiels steht auf der Seite (data-api="<k>") -- sie ist die Quelle.
export function beispielAdresse(html, k) {
  const m = new RegExp(`<div class="formula" data-api="${k}">([^<]*)</div>`).exec(html);
  if (!m) throw new Error('api-beispiele: Beispiel-Adresse fehlt: ' + k);
  return m[1].replace(/&amp;/g, '&');
}
export function parameter(adresse) {
  const p = new URLSearchParams(adresse.slice(adresse.indexOf('?') + 1));
  return Object.fromEntries(p.entries());
}

// Der Auszug: die Felder, die jemand zuerst liest -- in der Reihenfolge der Antwort.
export function auszug(body) {
  if (!body.ok) throw new Error('api-beispiele: das Beispiel rechnet nicht: ' + JSON.stringify(body));
  const c = body.cargo[0];
  const u = body.plan.units.map((e) => `      { "no": ${e.no}, "type": ${JSON.stringify(e.type)}, "pieces": ${e.pieces}, "weight_kg": ${e.weight_kg}, "volume_used_pct": ${e.volume_used_pct} }`).join(',\n');
  return `{
  "ok": true,
  "summary": ${JSON.stringify(body.summary)},
  "cargo": [
    { "name": ${JSON.stringify(c.name)}, "qty": ${c.qty}, "length_cm": ${c.length_cm}, "width_cm": ${c.width_cm}, "height_cm": ${c.height_cm}, "weight_kg": ${c.weight_kg}, "stackable": ${c.stackable}, "rotatable": ${c.rotatable} }
  ],
  "plan": {
    "units_needed": ${body.plan.units_needed},
    "pieces_loaded": ${body.plan.pieces_loaded},
    "pieces_left": ${body.plan.pieces_left},
    "units": [
${u}
    ]
  },
  "plan_url": ${JSON.stringify(body.plan_url)}
}`;
}

// Setzt den Auszug in die Seite ein
export function seiteMitAuszug(html, k, planen) {
  const body = planen(parameter(beispielAdresse(html, k))).body;
  const re = new RegExp(`(<pre class="formula" data-api-antwort="${k}">)[\\s\\S]*?(</pre>)`);
  if (!re.test(html)) throw new Error('api-beispiele: Platz fuer die Antwort fehlt: ' + k);
  return html.replace(re, (_, a, b) => a + esc(auszug(body)) + b);
}

// llms.txt: die Zeile nach dem Beispiel
export function llmsMitSatz(text, planen) {
  const m = /^Example: (https:\/\/containerload\.io\/api\/plan\?\S+)$/m.exec(text);
  if (!m) throw new Error('api-beispiele: Beispiel in llms.txt fehlt');
  const body = planen(parameter(m[1])).body;
  if (!body.ok) throw new Error('api-beispiele: das Beispiel in llms.txt rechnet nicht');
  const re = /^Its answer begins: .*$/m;
  if (!re.test(text)) throw new Error('api-beispiele: Zeile "Its answer begins:" fehlt in llms.txt');
  return text.replace(re, () => 'Its answer begins: ' + JSON.stringify(body.summary));
}

export const SEITEN = [['ratgeber/ladeplan-per-link.html', 'de'], ['en/guide/load-plan-by-link.html', 'en']];

if (import.meta.url === `file://${process.argv[1]}`) {
  const { planen } = await import('../netlify/functions/lib/plan.mjs');
  const pfad = (f) => new URL('../containerload.io/' + f, import.meta.url);
  for (const [f, k] of SEITEN) {
    fs.writeFileSync(pfad(f), seiteMitAuszug(fs.readFileSync(pfad(f), 'utf8'), k, planen));
    console.log(f, 'ok');
  }
  fs.writeFileSync(pfad('llms.txt'), llmsMitSatz(fs.readFileSync(pfad('llms.txt'), 'utf8'), planen));
  console.log('llms.txt ok');
}
