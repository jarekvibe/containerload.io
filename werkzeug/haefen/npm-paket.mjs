// Gemeinsam fuer die Generatoren: ein npm-Tarball laden, seine sha512-Pruefsumme
// pruefen und einzelne Dateien daraus als DATEN lesen (gzip + ustar, ohne Abhaengigkeit).
// Der Code der Pakete wird nie ausgefuehrt.
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export async function paketLaden(url, sha512) {
  const tgz = Buffer.from(await (await fetch(url)).arrayBuffer());
  const ist = crypto.createHash('sha512').update(tgz).digest('base64');
  if (ist !== sha512) throw new Error('Pruefsumme stimmt nicht (' + url + '): ' + ist);
  return tgz;
}

export function tarDatei(tgz, gesucht) {
  const tar = zlib.gunzipSync(tgz);
  for (let o = 0; o + 512 <= tar.length;) {
    const name = tar.toString('utf8', o, o + 100).replace(/\0.*$/s, '');
    if (!name) break;
    const groesse = parseInt(tar.toString('utf8', o + 124, o + 136).replace(/\0.*$/s, '').trim(), 8) || 0;
    if (name === gesucht) return tar.subarray(o + 512, o + 512 + groesse);
    o += 512 + Math.ceil(groesse / 512) * 512;
  }
  throw new Error('nicht im Paket: ' + gesucht);
}
