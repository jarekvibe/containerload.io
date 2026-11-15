// Erzeugt containerload.io/karte/haefen.js: alle Seehaefen aus dem World Port Index
// (NGA Pub. 150, Ausgabe April 2025) und darauf markiert die 50 groessten
// Containerhaefen der Welt (World Shipping Council, Umschlag 2025).
//
// Aufruf (im Ordner werkzeug/haefen):
//   npm install --no-save d3-geo@3 world-atlas@2 topojson-client@3 topojson-simplify@3
//   node haefen-bauen.mjs
//
// QUELLE 1 -- World Port Index. Die NGA-Seite (msi.nga.mil) war beim Bau nicht
// erreichbar (Wartung, 10.11.26). Genommen wird deshalb dieselbe Ausgabe aus dem
// npm-Paket seaport-data-js@1.0.1 (Aashish Vivekanand, Aufbereitung CC BY 4.0; die
// Daten selbst sind als Werk der US-Regierung gemeinfrei). Der Generator laedt das
// Paket aus der npm-Registry, prueft die sha512-Pruefsumme und liest den eingebetteten
// Datenblock (Base64 + gzip) SELBST aus -- der Code des Pakets laeuft nie.
//
// QUELLE 2 -- quelle/top50-wsc.csv: die Top-50-Tabelle des World Shipping Council
// (https://www.worldshipping.org/top-50-container-ports, von Jarek am 10.11.26 uebernommen). Welcher WPI-Eintrag zu
// welchem Rang gehoert, steht unten in ZUORDNUNG -- bei Hafengebieten mit mehreren
// Standorten der Containerstandort (Shenzhen -> Yantian usw.).
//
// WARUM ZWEI QUELLEN: Das Containerfeld des Index ist bei den grossen Haefen leer
// (Hamburg, Rotterdam, Los Angeles: "nicht erfasst"), und die "Hafengroesse" meint das
// Becken, nicht den Umschlag (Felixstowe "sehr klein", Ningbo "klein"). "Containerhafen"
// steht deshalb nur dort, wo eine Umschlagszahl es belegt.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { PROJ, RAHMEN } from './land-bauen.mjs';
import { paketLaden, tarDatei } from './npm-paket.mjs';

const PAKET = 'https://registry.npmjs.org/seaport-data-js/-/seaport-data-js-1.0.1.tgz';
const PAKET_SHA512 = 'AAEueI9tJeAfaOZ/QLU7eyMveig8xYD9cUAr0EAogu1epB5BzeRd1FKPG3w5PCQssQ7Glrjk+LW9afZlhPiQ4A==';
const TOP50 = new URL('quelle/top50-wsc.csv', import.meta.url);
const ZIEL = new URL('../../containerload.io/karte/haefen.js', import.meta.url);

// Rang (WSC) -> WPI-Nummer; name = Anzeige (WSC-Schreibweise, Tippfehler der Vorlage
// "Breman" korrigiert), standort = Hinweis, wenn der Punkt ein Teil des Hafengebiets ist.
export const ZUORDNUNG = {
  1: { wpi: 59970 }, 2: { wpi: 50000, standort: 'Keppel' }, 3: { wpi: 59940, standort: 'Ningbo' },
  4: { wpi: 57857, standort: 'Yantian' }, 5: { wpi: 60140 }, 6: { wpi: 57830, name: 'Guangzhou' },
  7: { wpi: 60390 }, 8: { wpi: 60190, standort: 'Xingang' }, 9: { wpi: 48276, name: 'Jebel Ali (Dubai)' },
  10: { wpi: 49930 }, 11: { wpi: 31140 }, 12: { wpi: 51587 }, 13: { wpi: 31250 }, 14: { wpi: 57840 },
  15: { wpi: 57870 }, 16: { wpi: 45753 }, 17: { wpi: 57462 }, 18: { wpi: 16080 },
  19: { wpi: 59976, standort: 'Taicang' }, 20: { wpi: 57820, standort: 'Qinzhou' }, 21: { wpi: 16070 },
  22: { wpi: 57580 }, 23: { wpi: 7810, standort: 'Newark' }, 24: { wpi: 57920 }, 25: { wpi: 30780 },
  26: { wpi: 48617 }, 27: { wpi: 57680 }, 28: { wpi: 50970, name: 'Tanjung Priok (Jakarta)' }, 29: { wpi: 49240 },
  30: { wpi: 48845, name: 'Jawaharlal Nehru Port (Nhava Sheva)' }, 31: { wpi: 57570, standort: 'Vũng Tàu' },
  32: { wpi: 60133 }, 33: { wpi: 60130 }, 34: { wpi: 48278 }, 35: { wpi: 58370 }, 36: { wpi: 12970 },
  37: { wpi: 60220 }, 38: { wpi: 9865, name: 'Colón' }, 39: { wpi: 8530 }, 40: { wpi: 38480 },
  41: { wpi: 45140 }, 42: { wpi: 60160 }, 43: { wpi: 60250 }, 44: { wpi: 30810, name: 'Bremen/Bremerhaven' },
  45: { wpi: 61380 }, 46: { wpi: 38310 }, 47: { wpi: 42230 }, 48: { wpi: 40115 },
  49: { wpi: 51130, standort: 'Surabaya' }, 50: { wpi: 48230 }
};

export async function wpiLaden() {
  const tgz = await paketLaden(PAKET, PAKET_SHA512);
  const js = tarDatei(tgz, 'package/lib/index.js').toString('utf8');
  const bloecke = js.match(/["'`][A-Za-z0-9+/=]{20000,}["'`]/g) || [];
  if (bloecke.length !== 1) throw new Error('erwartet genau einen Datenblock, gefunden: ' + bloecke.length);
  const daten = JSON.parse(zlib.gunzipSync(Buffer.from(bloecke[0].slice(1, -1), 'base64')).toString('utf8'));
  if (!Array.isArray(daten) || daten.length < 3000) throw new Error('unerwartete Daten');
  return daten;
}

// ── Kuesten: Region der NGA, sonst das Gewaesser ─────────────────────
// Die NGA ordnet jeden Hafen einer Region zu ("United States W Coast", "US Gulf Coast").
// Fortsetzungen ("Alaska Continued", "Brazil NE Coast Cont") werden zusammengelegt.
// Hat ein Land so nur EINE Region (Deutschland: "Germany"), traegt das Gewaesser die
// Unterscheidung (Nordsee / Ostsee).
const regionNorm = (r) => (r ? r.trim().replace(/\s+(Continued|Cont\.?)$/, '') : '');
const RICHTUNG = {
  N: ['North', 'Nord'], North: ['North', 'Nord'], NE: ['Northeast', 'Nordost'], E: ['East', 'Ost'], East: ['East', 'Ost'],
  SE: ['Southeast', 'Südost'], S: ['South', 'Süd'], South: ['South', 'Süd'], SW: ['Southwest', 'Südwest'],
  W: ['West', 'West'], West: ['West', 'West'], NW: ['Northwest', 'Nordwest'], Gulf: ['Gulf', 'Golf']
};
const VORSILBE_DE = { England: 'England', Scotland: 'Schottland', Newfoundland: 'Neufundland', 'New Guinea': 'Neuguinea' };
const REGION_DE = {
  'Lake Michigan': 'Michigansee', 'Lake Huron': 'Huronsee', 'Lake Superior': 'Oberer See', 'Lake Erie': 'Eriesee',
  'Lake Ontario': 'Ontariosee', 'St Lawrence R': 'Sankt-Lorenz-Strom', 'Ottawa River': 'Ottawa River',
  Alaska: 'Alaska', 'Aleutian Islands': 'Aleuten', 'Hawaiian Islands': 'Hawaii', Tasmania: 'Tasmanien',
  Sardegna: 'Sardinien', Sicilia: 'Sizilien', Corse: 'Korsika', Elba: 'Elba', 'Isole Eolie': 'Liparische Inseln',
  'Islas Canarias': 'Kanaren', 'Islas Baleares': 'Balearen', 'Andaman Islands': 'Andamanen', 'Orkney Islands': 'Orkney',
  'Shetland Islands': 'Shetland', 'Northern Ireland': 'Nordirland', Wales: 'Wales', Ireland: 'Irland', Kriti: 'Kreta',
  Kikladhes: 'Kykladen', Dhodhekanisos: 'Dodekanes', 'Aegean Islands': 'Ägäische Inseln', Acores: 'Azoren',
  'Arquipelago Da Madeira': 'Madeira', Jylland: 'Jütland', Sjaelland: 'Seeland', Fyn: 'Fünen', Lolland: 'Lolland',
  Bornholm: 'Bornholm', Falster: 'Falster', Aero: 'Ærø', Langeland: 'Langeland', Gotland: 'Gotland', Oland: 'Öland',
  Sakhalin: 'Sachalin', 'Kuril Islands': 'Kurilen', 'Nansei Shoto': 'Nansei-Inseln', Jawa: 'Java', Sumatera: 'Sumatra',
  Sulawesi: 'Sulawesi', 'Indonesia - Borneo': 'Borneo', 'Lesser Sunda Islands': 'Kleine Sundainseln', Seram: 'Seram',
  'New Guinea West Coast - Irian Jaya': 'Westneuguinea', 'Kepulauan Anambas': 'Anambas-Inseln', Sarawak: 'Sarawak', Sabah: 'Sabah',
  'Egypt Red Sea': 'Rotes Meer', 'Egypt Mediterranean': 'Mittelmeer', 'Turkey Europe': 'Europäischer Teil',
  'Turkey Asia': 'Asiatischer Teil', 'New Zealand N Island': 'Nordinsel', 'New Zealand S Island': 'Südinsel',
  'Peru Amazon River': 'Amazonas', 'Bismarck Archipelago': 'Bismarck-Archipel', 'Baffin Island': 'Baffininsel',
  'Hudson Bay': 'Hudson Bay', Labrador: 'Labrador', 'Nova Scotia': 'Nova Scotia', 'Cape Breton Island': 'Kap-Breton-Insel',
  'New Brunswick': 'New Brunswick', 'Prince Edward Island': 'Prince Edward Island', 'Yemen Aden': 'Aden', 'Yemen Sanaa': 'Sanaa',
  Newfoundland: 'Neufundland', 'Ile St Pierre': 'Saint-Pierre', 'North Side': 'Nordseite', 'South Side': 'Südseite',
  'West Indies': 'Westindien', 'St Thomas': 'St. Thomas', 'St John': 'St. John', 'St Croix': 'St. Croix', 'St Martin': 'Saint-Martin',
  'St Barthelemy': 'Saint-Barthélemy', 'Saint Eustatius': 'Sint Eustatius', Guadeloupe: 'Guadeloupe', Tobago: 'Tobago',
  Trinidad: 'Trinidad', Bonaire: 'Bonaire', Ascension: 'Ascension', Mauritius: 'Mauritius', Rodrigues: 'Rodrigues',
  'Kepulauan Sangihe': 'Sangihe-Inseln', 'Kepulauan Talaud': 'Talaud-Inseln', 'Pulau Ternate': 'Ternate', 'Pulau Batcan': 'Bacan',
  Halmahera: 'Halmahera', Buru: 'Buru', 'Kepulauan Tanimbar': 'Tanimbar-Inseln', 'Iles Tuamotu': 'Tuamotu',
  'Iles Marquises': 'Marquesas', 'Johnston Atoll': 'Johnston-Atoll', 'Peng Hu Lifh Tao': 'Penghu-Inseln',
  'Society Islands': 'Gesellschaftsinseln', 'Bahama Islands': 'Bahamas', 'Tristan Island': 'Tristan da Cunha',
  'Midway Islands': 'Midwayinseln', 'Wake Island': 'Wake', 'Gilbert Islands': 'Gilbertinseln', Malaysia: 'Malaysia',
  Italy: 'Italien', 'Kiribati (Phoenix) Islands': 'Phoenixinseln', 'Tabuaeran Atoll (Fanning Island)': 'Tabuaeran'
};
// Traegt die Region nur den Landesnamen ("Japan" neben "Nansei Shoto"), ist es das Festland --
// bei Inselstaaten ohne Festland heisst es "übrige".
const OHNE_FESTLAND = new Set(['ID', 'PG', 'BN', 'PH', 'BS', 'KI', 'PF']);
const GEW_DE = {
  'North Atlantic Ocean': 'Nordatlantik', 'North Pacific Ocean': 'Nordpazifik', 'Caribbean Sea': 'Karibisches Meer',
  'Mediterranean Sea': 'Mittelmeer', 'North Sea': 'Nordsee', 'Alaska-Canada coastal waters': 'Küstengewässer Alaska–Kanada',
  'South Pacific Ocean': 'Südpazifik', 'South Atlantic Ocean': 'Südatlantik', 'Baltic Sea': 'Ostsee', 'Sea of Japan': 'Japanisches Meer',
  'Norwegian Sea': 'Europäisches Nordmeer', 'Gulf of Mexico': 'Golf von Mexiko', 'Indian Ocean': 'Indischer Ozean',
  'Persian Gulf': 'Persischer Golf', 'South China Sea': 'Südchinesisches Meer', 'Lake Ontario': 'Ontariosee',
  'Gulf of Bothnia': 'Bottnischer Meerbusen', 'Adriatic Sea': 'Adria', 'Gulf of Saint Lawrence': 'Sankt-Lorenz-Golf',
  'English Channel': 'Ärmelkanal', 'Black Sea': 'Schwarzes Meer', 'Lake Huron': 'Huronsee', 'Aegean Sea': 'Ägäis',
  'Lake Michigan': 'Michigansee', 'Tyrrhenian Sea': 'Tyrrhenisches Meer', 'Gulf of Guinea': 'Golf von Guinea',
  'East China Sea': 'Ostchinesisches Meer', Kattegat: 'Kattegat', Skagerrak: 'Skagerrak', 'Lake Erie': 'Eriesee',
  'Gulf of Finland': 'Finnischer Meerbusen', 'Arabian Sea': 'Arabisches Meer', 'Lake Superior': 'Oberer See',
  'Philippine inland seas': 'Philippinische Binnenmeere', 'Strait of Malacca': 'Straße von Malakka', 'Rio de la Plata': 'Río de la Plata',
  'Gulf of Alaska': 'Golf von Alaska', 'Bay of Biscay': 'Golf von Biskaya', 'Korea Strait': 'Koreastraße', 'Bering Sea': 'Beringmeer',
  'Irish Sea': 'Irische See', 'Bay of Bengal': 'Golf von Bengalen', 'Sea of Marmara': 'Marmarameer', 'Red Sea': 'Rotes Meer',
  'Gulf of Thailand': 'Golf von Thailand', 'Mozambique Channel': 'Straße von Mosambik', 'Celebes Sea': 'Celebessee',
  'Gulf of Suez': 'Golf von Suez', 'Coral Sea': 'Korallenmeer', 'Makassar Strait': 'Makassarstraße', 'Tasman Sea': 'Tasmansee',
  'Bohol Sea': 'Boholsee', 'Yellow Sea': 'Gelbes Meer', 'Greenland Sea': 'Grönlandsee', 'Andaman Sea': 'Andamanensee',
  'Java Sea': 'Javasee', 'Bristol Channel': 'Bristolkanal', 'Ligurian Sea': 'Ligurisches Meer', 'Bight of Benin': 'Bucht von Benin',
  'Natuna Sea': 'Natunasee', 'Solomon Sea': 'Salomonensee', 'Tatar Strait': 'Tatarensund', 'Labrador Sea': 'Labradorsee',
  'Barents Sea': 'Barentssee', 'Bass Strait': 'Bass-Straße', 'Gulf of Tonkin': 'Golf von Tonkin', 'Baffin Bay': 'Baffin-Bucht',
  'Sea of Azov': 'Asowsches Meer', 'Laccadive Sea': 'Lakkadivensee', 'Strait of Gibraltar': 'Straße von Gibraltar',
  'Ionian Sea': 'Ionisches Meer', 'Gulf of Oman': 'Golf von Oman', 'Gulf of Aden': 'Golf von Aden', 'Bohai Sea': 'Bohai-Meer',
  'Singapore Strait': 'Singapurstraße', 'Balearic Sea': 'Balearisches Meer', 'Alboran Sea': 'Alborán-Meer', 'Celtic Sea': 'Keltische See',
  'Sea of Okhotsk': 'Ochotskisches Meer', 'Gulf of Riga': 'Rigaer Bucht', 'White Sea': 'Weißes Meer', 'Timor Sea': 'Timorsee',
  'Banda Sea': 'Bandasee', 'Flores Sea': 'Floressee', 'Sulu Sea': 'Sulusee', 'Gulf of California': 'Golf von Kalifornien',
  'Bay of Fundy': 'Bay of Fundy', 'Hudson Bay': 'Hudson Bay', 'Great Australian Bight': 'Große Australische Bucht',
  'Arafura Sea': 'Arafurasee', 'Seto Naikai or Inland Sea': 'Seto-Inlandsee', 'Gulf of Aqaba': 'Golf von Akaba',
  'Kara Sea': 'Karasee', 'Lake Erie and Lake Ontario': 'Erie- und Ontariosee', 'Davis Strait': 'Davisstraße',
  'Hudson Strait': 'Hudsonstraße', 'Golfo San Jorge': 'Golf von San Jorge', 'Drake Passage': 'Drakestraße',
  'Golfo di Taranto': 'Golf von Tarent', 'Gulf of Sidra': 'Große Syrte', 'Strait of Hormuz': 'Straße von Hormus',
  'Palk Strait': 'Palkstraße', 'Taiwan Strait': 'Taiwanstraße', 'Luzon Strait': 'Luzonstraße', 'Bo Hai': 'Bohai-Meer',
  'Korea Bay': 'Koreabucht'
};
export function kuestenName(region, land, iso) {
  if (land && region.toLowerCase() === land.toLowerCase() || /^(United States|Taiwan)$/.test(region)) {
    return OHNE_FESTLAND.has(iso) ? ['other', 'übrige'] : ['Mainland', 'Festland'];
  }
  if (REGION_DE[region]) return [region.replace(/ R$/, ' River'), REGION_DE[region]];
  // "<Land> <Richtung> Coast" -> "Westküste"; Vorsilbe eines Landesteils bleibt ("England Ostküste")
  const m = region.match(/^(.*?)\s*\b(N|NE|E|SE|S|SW|W|NW|North|East|South|West|Gulf)\s+Coast$/);
  if (m) {
    const r = RICHTUNG[m[2]];
    let vor = m[1].replace(/^(United States|US|Canada)$/, '').trim();
    if (vor && land && vor.toLowerCase() === land.toLowerCase()) vor = '';
    const en = (vor ? vor + ' ' : '') + r[0] + ' Coast';
    const de = (vor ? (VORSILBE_DE[vor] || vor) + ' ' : '') + r[1] + 'küste';
    return [en, de.replace(/^(\S+) (\S)/, (a, x, y) => x + ' ' + y)];
  }
  const ohneLand = region.replace(/^(US|Canada)\s+/, '');
  if (REGION_DE[ohneLand]) return [ohneLand.replace(/ R$/, ' River'), REGION_DE[ohneLand]];
  return [region, region];
}

const ja = (v) => v === true;
const zahl = (v) => (typeof v === 'number' && v > 0 ? Math.round(v * 10) / 10 : 0);
const GROESSE = { 'Very Small': 1, Small: 2, Medium: 3, Large: 4 };

async function haupt() {
  const P = await wpiLaden();
  const zeilen = fs.readFileSync(TOP50, 'utf8').trim().split('\n').slice(1).map((z) => z.split(';'));
  const top = new Map();
  for (const [rang, hafen, land, t25] of zeilen) {
    const z = ZUORDNUNG[+rang];
    if (!z) throw new Error('keine Zuordnung fuer Rang ' + rang);
    if (!P.some((p) => p.wpi_number === z.wpi)) throw new Error('WPI ' + z.wpi + ' fehlt (' + hafen + ')');
    top.set(z.wpi, { name: z.name || hafen, standort: z.standort || '', teu: +t25 });
  }
  // Je Land: Regionen (normalisiert) zaehlen -- ab zwei unterscheiden sie die Kueste
  const regionen = new Map();
  for (const p of P) {
    const r = regionNorm(p.region);
    if (!r) continue;
    if (!regionen.has(p.country_code)) regionen.set(p.country_code, new Set());
    regionen.get(p.country_code).add(r);
  }
  const kue = [], kueIdx = new Map(), fehltDe = new Set();
  const kueste = (en, de) => { const k = en + '|' + de; if (!kueIdx.has(k)) { kueIdx.set(k, kue.length); kue.push([en, de]); } return kueIdx.get(k); };
  const h = [];
  for (const p of P) {
    const lat = p.latitude, lon = p.longitude;
    if (!(lat >= -58 && lat <= 84) || !Number.isFinite(lon) || !p.country_code) continue;
    const t = top.get(p.wpi_number);
    const r = regionNorm(p.region), mehrere = (regionen.get(p.country_code) || new Set()).size >= 2;
    let ki = -1;
    if (mehrere && r) {
      const [en, de] = kuestenName(r, p.country_name, p.country_code);
      if (en === de && !REGION_DE[r] && !/^(Mainland|other)$/.test(en)) fehltDe.add(r);
      ki = kueste(en, de);
    } else if (p.water_body) {
      const g = p.water_body.split(';')[0].trim();
      if (!GEW_DE[g]) fehltDe.add(g);
      ki = kueste(g, GEW_DE[g] || g);
    }
    let bits = 0;
    if (t) bits |= 1;
    if (ja(p.facility_container) || ja(p.crane_container)) bits |= 2;
    if (ja(p.facility_ro_ro)) bits |= 4;
    if (ja(p.railway) || ja(p.comm_rail)) bits |= 8;
    if (ja(p.facility_breakbulk)) bits |= 16;
    const [x, y] = PROJ([lon, lat]);
    const name = t ? t.name : p.name;
    const alias = [t && t.name !== p.name ? p.name : '', p.alternate_name && p.alternate_name !== p.name ? p.alternate_name : ''].filter(Boolean).join(' · ');
    h.push([name, p.locode || '', p.country_code, Math.round(x * 10) / 10, Math.round(y * 10) / 10, bits,
      GROESSE[p.harbor_size] || 0, zahl(p.cargo_pier_depth_m), zahl(p.max_vessel_length_m), ki,
      Math.round(lat * 1e4) / 1e4, Math.round(lon * 1e4) / 1e4, alias, t ? t.teu : 0, t ? t.standort : '']);
  }
  h.sort((a, b) => (b[13] - a[13]) || (b[6] - a[6]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = {
    stand: '2025-04', quelle: 'World Port Index (NGA Pub. 150), Ausgabe April 2025, über seaport-data-js@1.0.1 (CC BY 4.0)',
    topQuelle: 'World Shipping Council, Top 50 World Container Ports', topJahr: 2025, rahmen: RAHMEN, kue, h
  };
  const js = '// Hafenkarte: Seehaefen aus dem World Port Index (NGA Pub. 150, April 2025; ueber seaport-data-js,\n' +
    '// CC BY 4.0) + die 50 groessten Containerhaefen (World Shipping Council, Umschlag 2025).\n' +
    '// Erzeugt von werkzeug/haefen/haefen-bauen.mjs -- nicht von Hand aendern.\n' +
    'window.CL_HAEFEN = ' + JSON.stringify(out) + ';\n';
  fs.writeFileSync(ZIEL, js);
  seitenTabellen(h);
  console.log('haefen.js', js.length, 'Zeichen ·', h.length, 'Haefen ·', h.filter((r) => r[5] & 1).length, 'Top-50 ·', kue.length, 'Kuesten/Gewaesser');
  if (fehltDe.size) console.log('Ohne deutschen Namen (' + fehltDe.size + '):', [...fehltDe].join(' | '));
}

// Die Top-50-Tabelle steht als fester Text auf beiden Seiten (lesbar ohne JavaScript und
// fuer Suchmaschinen) -- erzeugt aus DENSELBEN Daten wie die Karte, zwischen Markierungen.
const SEITEN = [
  ['../../containerload.io/ratgeber/containerhaefen.html', 'de', '/ratgeber/containerhaefen'],
  ['../../containerload.io/en/guide/container-ports.html', 'en', '/en/guide/container-ports']
];
export function tabelle(h, spr, pfad) {
  const dn = new Intl.DisplayNames([spr], { type: 'region' });
  const zahl = (v) => v.toLocaleString(spr === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const kopf = spr === 'de' ? ['Hafen', 'Land', 'Mio. TEU 2025'] : ['Port', 'Country', 'Million TEU 2025'];
  const zeilen = h.filter((r) => r[5] & 1).map((r, i) => '<tr><td class="num">' + (i + 1) + '</td><td><a href="' + pfad + '?hafen=' + r[1] + '">' + esc(r[0]) + '</a>' +
    (r[14] ? ' <span class="hk-std">(' + esc(r[14]) + ')</span>' : '') + '</td><td>' + esc(dn.of(r[2])) + '</td><td class="num">' + zahl(r[13]) + '</td></tr>');
  return '<div class="tabelle"><table><thead><tr><th>#</th><th>' + kopf.join('</th><th>') + '</th></tr></thead><tbody>\n' + zeilen.join('\n') + '\n</tbody></table></div>';
}
function seitenTabellen(h) {
  for (const [datei, spr, pfad] of SEITEN) {
    const ziel = new URL(datei, import.meta.url);
    const s = fs.readFileSync(ziel, 'utf8');
    const a = s.indexOf('<!-- HK_TOP50_START -->'), e = s.indexOf('<!-- HK_TOP50_ENDE -->');
    if (a < 0 || e < a) throw new Error('Markierungen fehlen in ' + datei);
    fs.writeFileSync(ziel, s.slice(0, a) + '<!-- HK_TOP50_START -->\n' + tabelle(h, spr, pfad) + '\n' + s.slice(e));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) haupt();
