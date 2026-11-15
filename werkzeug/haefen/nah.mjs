// Haefen in der Naehe eines Landes -- fuer "Seeweg hierher" auf der Hafenkarte.
// Wer in Deutschland verschifft, nimmt oft Rotterdam oder Antwerpen; wer in der Schweiz
// sitzt, hat gar keinen eigenen Seehafen. Die Tabelle nennt je Land die naechstgelegenen
// grossen Containerhaefen (Top 50) ANDERER Laender, gemessen als Luftlinie vom Hafen zur
// Landflaeche (Natural Earth, Laenderflaechen 1:50 Mio., gemeinfrei).
//
// Rein, ohne Abhaengigkeit: haefen-bauen.mjs ruft nahTabelle() mit den fertigen Hafen-
// zeilen und den Laenderflaechen auf und schreibt das Ergebnis als CL_HAEFEN.nah.

// Land mit eigenem Hafen: Top-50-Haefen anderer Laender bis 500 km, hoechstens drei --
// und nur, solange das Land selbst weniger als drei Top-50-Haefen hat (China braucht
// keinen Nachbarn, Deutschland mit Hamburg und Bremerhaven schon).
export const NAH_KUESTE_KM = 500, NAH_KUESTE_MAX = 3, NAH_EIGENE_TOP_MAX = 3;
// Land ohne Seehafen (Schweiz, Oesterreich, Tschechien ...): die vier naechsten bis 1.000 km.
// Zwergstaaten unter 1.000 km2 (Vatikan, Monaco, Liechtenstein ...) bekommen keine Zeile --
// sie waeren nur Rauschen in der Laenderliste.
export const NAH_BINNEN_KM = 1000, NAH_BINNEN_MAX = 4, NAH_BINNEN_MIN_KM2 = 1000;
// Gemessen wird zur Hauptflaeche des Landes: Teilflaechen ab 5 % der groessten. So zaehlt
// Alaska fuer die USA und Kyushu fuer Japan, aber keine Insel vor einer fremden Kueste
// (Okinawa laege sonst "nahe" Kaohsiung).
export const NAH_TEILFLAECHE = 0.05;

const R_KM = 6371, KM2_JE_GRAD2 = (Math.PI / 180 * R_KM) ** 2;
const wickeln = (v) => (v > 180 ? v - 360 : v < -180 ? v + 360 : v);

function flaeche(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2) * Math.cos(ring[0][1] * Math.PI / 180);
}

// Alle Teilflaechen eines Landes -- Natural Earth fuehrt manche Laender in mehreren
// Eintraegen (Australien: Festland, Weihnachtsinsel, Ashmore), gemessen wird am ganzen Land.
function polygone(geos) {
  return geos.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates));
}

export function hauptRinge(geos) {
  const polys = polygone(geos);
  const f = polys.map((p) => flaeche(p[0]));
  const gross = Math.max(...f);
  return polys.filter((p, i) => f[i] >= NAH_TEILFLAECHE * gross).map((p) => p[0]);
}

// Kuerzester Abstand (km) von einem Punkt zu den Randlinien -- eben gerechnet um den Punkt
// herum, das reicht fuer die paar hundert Kilometer, um die es hier geht. Jede Kante wird
// relativ zu ihrem eigenen Anfang gewickelt: eine Kante ueber die Datumsgrenze darf nicht
// einmal um die ganze Erde laufen (und dabei jeden Hafen streifen).
export function abstandKm(lon, lat, ringe) {
  const k = Math.cos(lat * Math.PI / 180), r = Math.PI / 180 * R_KM;
  let best = Infinity;
  for (const ring of ringe) {
    for (let i = 1; i < ring.length; i++) {
      const ax0 = wickeln(ring[i - 1][0] - lon), bx0 = ax0 + wickeln(ring[i][0] - ring[i - 1][0]);
      const ax = ax0 * k * r, bx = bx0 * k * r, ay = (ring[i - 1][1] - lat) * r, by = (ring[i][1] - lat) * r;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

// h: Hafenzeilen wie in CL_HAEFEN.h; laender: GeoJSON der Laenderflaechen (ISO_A2_EH).
// Ein UN/LOCODE kann im Index mehrfach vorkommen (Cai Mep und Mui Vung Tau teilen VNVUT);
// die Karte nimmt den ERSTEN Treffer, und die Top 50 stehen vorn -- der Test prueft das.
// Ergebnis: { "DE": ["NLRTM", "BEANR"], "CH": [...], ... } -- naechster zuerst.
export function nahTabelle(h, laender) {
  const top = h.filter((z) => z[5] & 1);
  const eigeneTop = {}, mitHafen = new Set();
  for (const z of h) {
    mitHafen.add(z[2]);
    if (z[5] & 1) eigeneTop[z[2]] = (eigeneTop[z[2]] || 0) + 1;
  }
  const geos = new Map();
  for (const f of laender.features) {
    const iso = f.properties.ISO_A2_EH;
    if (!/^[A-Z]{2}$/.test(iso)) continue;
    if (!geos.has(iso)) geos.set(iso, []);
    geos.get(iso).push(f.geometry);
  }
  const aus = {};
  for (const iso of [...geos.keys()].sort()) {
    const binnen = !mitHafen.has(iso);
    if (!binnen && (eigeneTop[iso] || 0) >= NAH_EIGENE_TOP_MAX) continue;
    if (binnen && polygone(geos.get(iso)).reduce((s, p) => s + flaeche(p[0]), 0) * KM2_JE_GRAD2 < NAH_BINNEN_MIN_KM2) continue;
    const km = binnen ? NAH_BINNEN_KM : NAH_KUESTE_KM, max = binnen ? NAH_BINNEN_MAX : NAH_KUESTE_MAX;
    const ringe = hauptRinge(geos.get(iso));
    const kand = top.filter((z) => z[2] !== iso)
      .map((z) => [z[1], abstandKm(z[11], z[10], ringe)])
      .filter((k) => k[1] <= km)
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, max);
    if (kand.length) aus[iso] = kand.map((k) => k[0]);
  }
  return aus;
}
