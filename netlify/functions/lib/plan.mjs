// Die Rechnung hinter /api/plan und /mcp: eine Ladung als Text hinein, die Antwort des Packers
// als Daten heraus -- dazu der Link, der genau diese Rechnung im 3D-Rechner oeffnet.
//
// Fuer wen: KI-Assistenten (ChatGPT, Claude ...), Tabellen, ERP/TMS. Ein Sprachmodell kann
// nicht verlaesslich packen; es kann aber diese Adresse aufrufen. Fahrplan Baustein 5,
// Jareks Zusage vom 26.11.26 ("Rechner fuer KI-Assistenten ja").
//
// Vier Regeln, die nicht kippen duerfen (test/plan-api.test.mjs):
//   1. HIER RECHNET NUR DER PACKER DES RECHNERS. rechenkern.mjs ist aus app.html geschnitten
//      (werkzeug/rechenkern.mjs), und dieser Ablauf ist derselbe wie im Rechner: packKind,
//      dann die Kette, wenn nicht alles in den ersten Container geht. Keine KI, kein Schaetzen.
//   2. DIESELBEN PARAMETER WIE DER LINK /app?q= (q, cont, d=road, fz, u, lang) -- was die
//      Antwort nennt, zeigt plan_url im Browser. Unbekanntes cont/fz wird ABGELEHNT statt
//      still ersetzt: ein Programm soll merken, dass es sich vertippt hat.
//   3. EHRLICH: "cargo" zeigt, wie der Text gelesen wurde; jede Antwort traegt den Hinweis,
//      dass es eine geometrische Schaetzung ist (keine Ladungssicherung, keine Achslast).
//   4. NICHTS WIRD GESPEICHERT, keine IP gelesen. Reine Funktion: Eingabe -> Antwort.
import {
  PRESETS, VEHICLES, MAXCHAIN, CONT_CODES, FZ_CODES, EINHEITEN, SPRACHEN,
  num, uid, parseCargoText, packKind, chainContainers, chainVehicles, kettenGrund,
  suggestContainer, recommendAll, tuerKonflikte,
} from "./rechenkern.mjs";

export const BASIS = "https://containerload.io";
// Deckel: so viel Text wie der KI-Import; so viele Packstuecke, dass die Antwort auch auf
// einer langsamen Function sicher unter der Zeitgrenze bleibt. Darueber rechnet der Browser
// (plan_url) -- der hat keine Zeitgrenze.
export const GRENZEN = { zeichen: 6000, positionen: 60, stueck: 1000 };

// Fahrzeugnamen: die Schluessel des Rechners sind deutsch; die englischen sind die Namen aus
// I18N.en in app.html (der Test vergleicht).
export const FZ_EN = { "Planensattel": "Curtainsider", "Wechselbrücke": "Swap body", "Motorwagen": "Rigid truck", "7,5-Tonner": "7.5-t truck", "Sprinter": "Van" };

const hat = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const text = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const r1 = (x) => Math.round(x * 10) / 10;
const r3 = (x) => Math.round(x * 1000) / 1000;
const codeVon = (name) => Object.keys(CONT_CODES).find((k) => CONT_CODES[k] === name) || null;

const TEXT = {
  en: {
    missing: "Parameter q is missing: the cargo as text, one position per line or separated by semicolons.",
    tooLong: (n) => `The cargo text is too long (${n} characters, at most ${GRENZEN.zeichen}).`,
    unknownCont: (c) => `Unknown container code "${c}".`,
    unknownFz: (c) => `Unknown vehicle code "${c}".`,
    nothing: "No cargo position could be read from the text. Each position needs a quantity and three dimensions.",
    tooManyPos: (n) => `Too many positions (${n}, at most ${GRENZEN.positionen}).`,
    tooManyPieces: (n) => `Too many pieces for this interface (${n}, at most ${GRENZEN.stueck}). Open plan_url: the calculator in the browser has no such limit.`,
    example: "22 pallets 120x80x100 300kg stackable; 6 boxes 60x40x40 12kg",
    estimate: "Geometric estimate from the ContainerLoad packer (the same engine as the 3D calculator at plan_url). It does not check load securing, axle loads or stability.",
    read: "\"cargo\" shows how the text was read (cm, kg). Check it before relying on the numbers.",
    linesDropped: (g, l) => `${l} of ${g} lines were read as cargo; the others were skipped (a header line is normal).`,
    noWeight: (namen) => `No weight was given for: ${namen}. Weight limits were not checked for these.`,
    contIgnored: "cont is ignored in road mode (d=road); the vehicle is chosen with fz.",
    fzIgnored: "fz only applies together with d=road and was ignored.",
    weightSplit: "Weight, not space, is what splits this shipment: the first unit is at its payload.",
    door: (namen) => `Does not pass the door opening as stowed: ${namen}.`,
    capped: `The calculator stops after ${MAXCHAIN} units; more are needed.`,
    special: "Special equipment: out-of-gauge figures are shown in the 3D plan (plan_url), not here.",
    noLdm: "Loading metres are not part of this answer; the 3D plan shows the stowage.",
    unit: (road, n) => (road ? (n === 1 ? "vehicle" : "vehicles") : n === 1 ? "container" : "containers"),
    piece: (n) => (n === 1 ? "piece" : "pieces"),
    sAll: (n, name, vol, kg, pay) => `${n === 1 ? "The one piece fits" : `All ${n} pieces fit`} into one ${name} (${vol} % of the volume${kg ? `, ${kg} of ${pay} kg payload` : ""}).`,
    sChain: (n, k, liste, road) => `${n} pieces need ${k} ${road ? "vehicles" : "containers"}: ${liste}.`,
    sRest: (geladen, n, k, rest, road) => `${geladen} of ${n} pieces are loaded into ${k} ${road ? (k === 1 ? "vehicle" : "vehicles") : k === 1 ? "container" : "containers"}; ${rest} cannot be loaded.`,
    sNone: (n, name) => `None of the ${n} ${n === 1 ? "piece fits" : "pieces fit"} into a ${name}.`,
    recSingle: (name) => `Everything fits into 1 × ${name}.`,
    recMulti: (liste) => `Fewest containers: ${liste}.`,
    recEquip: (name, item) => `"${item}" exceeds every standard container; suggested equipment: ${name}.`,
    recTooBig: (item) => `"${item}" is too large for any standard container.`,
    recTooHeavy: (item) => `"${item}" is too heavy for any standard container.`,
  },
  de: {
    missing: "Der Parameter q fehlt: die Ladung als Text, eine Position je Zeile oder mit Semikolon getrennt.",
    tooLong: (n) => `Der Ladungstext ist zu lang (${n} Zeichen, höchstens ${GRENZEN.zeichen}).`,
    unknownCont: (c) => `Unbekanntes Container-Kürzel „${c}“.`,
    unknownFz: (c) => `Unbekanntes Fahrzeug-Kürzel „${c}“.`,
    nothing: "Aus dem Text ließ sich keine Position lesen. Jede Position braucht eine Menge und drei Maße.",
    tooManyPos: (n) => `Zu viele Positionen (${n}, höchstens ${GRENZEN.positionen}).`,
    tooManyPieces: (n) => `Zu viele Packstücke für diese Schnittstelle (${n}, höchstens ${GRENZEN.stueck}). plan_url öffnen: der Rechner im Browser hat diese Grenze nicht.`,
    example: "22 Paletten 120x80x100 300kg stapelbar; 6 Kartons 60x40x40 12kg",
    estimate: "Geometrische Schätzung des ContainerLoad-Packers (derselbe Rechner wie in 3D unter plan_url). Ladungssicherung, Achslasten und Standsicherheit sind nicht geprüft.",
    read: "„cargo“ zeigt, wie der Text gelesen wurde (cm, kg). Bitte prüfen, bevor die Zahlen verwendet werden.",
    linesDropped: (g, l) => `${l} von ${g} Zeilen wurden als Ladung gelesen; die übrigen wurden übersprungen (eine Kopfzeile ist normal).`,
    noWeight: (namen) => `Ohne Gewichtsangabe: ${namen}. Für diese Positionen wurde keine Gewichtsgrenze geprüft.`,
    contIgnored: "cont wird in der Landfracht (d=road) ignoriert; das Fahrzeug wählt fz.",
    fzIgnored: "fz gilt nur zusammen mit d=road und wurde ignoriert.",
    weightSplit: "Das Gewicht teilt diese Sendung, nicht der Platz: die erste Einheit ist an ihrer Zuladung.",
    door: (namen) => `Geht so gestaut nicht durch die Türöffnung: ${namen}.`,
    capped: `Der Rechner hört nach ${MAXCHAIN} Einheiten auf; es werden mehr gebraucht.`,
    special: "Special Equipment: Übermaß-Angaben stehen im 3D-Plan (plan_url), nicht hier.",
    noLdm: "Lademeter sind nicht Teil dieser Antwort; der 3D-Plan zeigt die Stauung.",
    unit: (road, n) => (road ? (n === 1 ? "Fahrzeug" : "Fahrzeuge") : "Container"),
    piece: (n) => (n === 1 ? "Packstück" : "Packstücke"),
    sAll: (n, name, vol, kg, pay) => `${n === 1 ? "Das eine Packstück passt" : `Alle ${n} Packstücke passen`} in einen ${name} (${vol} % des Volumens${kg ? `, ${kg} von ${pay} kg Zuladung` : ""}).`,
    sChain: (n, k, liste, road) => `${n} Packstücke brauchen ${k} ${road ? "Fahrzeuge" : "Container"}: ${liste}.`,
    sRest: (geladen, n, k, rest, road) => `${geladen} von ${n} Packstücken sind auf ${k} ${road ? (k === 1 ? "Fahrzeug" : "Fahrzeuge") : "Container"} verladen; ${rest} lassen sich nicht verladen.`,
    sNone: (n, name) => `Keines der ${n} Packstücke passt in einen ${name}.`,
    recSingle: (name) => `Alles passt in 1 × ${name}.`,
    recMulti: (liste) => `Wenigste Container: ${liste}.`,
    recEquip: (name, item) => `„${item}“ überschreitet jeden Standardcontainer; vorgeschlagenes Equipment: ${name}.`,
    recTooBig: (item) => `„${item}“ ist für jeden Standardcontainer zu groß.`,
    recTooHeavy: (item) => `„${item}“ ist für jeden Standardcontainer zu schwer.`,
  },
};

// Der Link, der dieselbe Rechnung im 3D-Rechner oeffnet. Englische Links tragen lang= vorn
// (so stehen sie auf den Wissensseiten); Deutsch ist die Sprache der Adresse ohne lang=.
export function planAdresse(q, { lang = "en", cont = "", road = false, fz = "", u = "" } = {}) {
  const t = [];
  if (lang !== "de") t.push("lang=" + lang);
  t.push("q=" + encodeURIComponent(q));
  if (road) { t.push("d=road"); if (fz) t.push("fz=" + fz); }
  else if (cont) t.push("cont=" + cont);
  if (u && u !== "cm") t.push("u=" + u);
  return BASIS + "/app?" + t.join("&");
}

// Eine Einheit der Kette (Container oder Fahrzeug) in Zahlen
function einheit(slot, i, cargo, road) {
  const placed = slot.placed || [];
  const p = slot.preset || {};
  const kg = placed.reduce((s, b) => s + num(cargo[b.ti] && cargo[b.ti].weight), 0);
  const vol = placed.reduce((s, b) => s + num(b.dx) * num(b.dy) * num(b.dz) / 1e6, 0);
  const raum = num(p.l) * num(p.w) * num(p.h) / 1e6;
  const je = cargo.map((t, ti) => ({ name: t.name, pieces: placed.filter((b) => b.ti === ti).length })).filter((x) => x.pieces > 0);
  const aus = { no: i + 1, type: slot.name };
  if (road && FZ_EN[slot.name]) aus.type_en = FZ_EN[slot.name];
  return Object.assign(aus, {
    pieces: placed.length,
    weight_kg: r1(kg),
    payload_kg: num(p.payload),
    payload_used_pct: num(p.payload) > 0 ? r1(kg / num(p.payload) * 100) : null,
    volume_used_m3: r3(vol),
    volume_used_pct: raum > 0 ? r1(vol / raum * 100) : null,
    items: je,
  });
}

// roh: { q, cont, d, fz, u, lang } -- Zeichenketten, wie sie in der Adresse stehen.
// Rueckgabe: { status, body } -- body ist die JSON-Antwort.
export function planen(roh = {}) {
  const sprache = text(roh.lang).toLowerCase().slice(0, 2);
  const lang = SPRACHEN.includes(sprache) ? sprache : "en";
  const T = lang === "de" ? TEXT.de : TEXT.en;
  const q = text(roh.q).trim();
  const road = text(roh.d).toLowerCase() === "road";
  const contCode = text(roh.cont).toLowerCase().trim(), fzCode = text(roh.fz).toLowerCase().trim();
  const u = EINHEITEN.includes(text(roh.u)) ? text(roh.u) : "";
  const fehler = (status, error, message, mehr = {}) => ({ status, body: Object.assign({ ok: false, error, message }, mehr) });

  if (!q) return fehler(400, "missing_q", T.missing, { example: T.example, example_url: BASIS + "/api/plan?q=" + encodeURIComponent(T.example) + "&cont=40hc" });
  if (q.length > GRENZEN.zeichen) return fehler(413, "too_long", T.tooLong(q.length));
  if (!road && contCode && !hat(CONT_CODES, contCode)) return fehler(400, "unknown_container", T.unknownCont(contCode), { valid: Object.keys(CONT_CODES) });
  if (road && fzCode && !hat(FZ_CODES, fzCode)) return fehler(400, "unknown_vehicle", T.unknownFz(fzCode), { valid: Object.keys(FZ_CODES) });

  const cont = road ? "" : contCode || "20gp";
  const fz = road ? fzCode || "sattel" : "";
  const adresse = (c = cont) => planAdresse(q, { lang, cont: c, road, fz: road ? fz : "", u });

  // 1. Lesen -- derselbe Text-Import wie hinter /app?q=
  let rows = [];
  try { rows = parseCargoText(q) || []; } catch (e) { rows = []; }
  if (!rows.length) return fehler(200, "nothing_recognized", T.nothing, { example: T.example, plan_url: adresse() });
  if (rows.length > GRENZEN.positionen) return fehler(200, "too_many_positions", T.tooManyPos(rows.length), { plan_url: adresse() });
  // Dieselbe Uebernahme wie QIMPORT in app.html
  const cargo = rows.map((r) => ({ id: uid(), name: r.name, l: r.l, w: r.w, h: r.h, weight: r.weight, qty: r.qty, stackable: r.stackable, stackH: r.stackH > 0 ? r.stackH : null, rotatable: r.rotatable }));
  const stueck = cargo.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
  if (stueck > GRENZEN.stueck) return fehler(200, "too_many_pieces", T.tooManyPieces(stueck), { pieces: stueck, plan_url: adresse() });

  // 2. Rechnen -- derselbe Ablauf wie im Rechner (der Effekt in App(): packKind, dann die Kette)
  const preset = road ? FZ_CODES[fz] : CONT_CODES[cont];
  const container = { ...(road ? VEHICLES[preset] : PRESETS[preset]) };
  const r = packKind(container, cargo, {}, false);
  let chain, rest, gekappt = false;
  if (r.boxes < r.totalBoxes && r.totalBoxes > 0 && r.boxes > 0) {
    const ch = road
      ? chainVehicles(container, preset, cargo, r, {}, MAXCHAIN)
      : chainContainers(container, preset, cargo, r, {}, MAXCHAIN, "");
    chain = ch.chain;
    rest = ch.remainingBoxes;
    gekappt = !!ch.gekappt;
  } else {
    chain = [{ name: preset, preset: container, placed: r.placed || [] }];
    rest = Math.max(0, r.totalBoxes - r.boxes);
  }
  const einheiten = chain.map((slot, i) => einheit(slot, i, cargo, road)).filter((e) => e.pieces > 0);
  const geladen = einheiten.reduce((s, e) => s + e.pieces, 0);
  const grund = chain.length > 1 ? kettenGrund(container, cargo, chain) : null;
  const tuer0 = container.door ? container.door : { w: num(container.w), h: num(container.h) };
  const tuer = tuerKonflikte(cargo, chain, tuer0);
  const tuerNamen = [...tuer.idx].map((i) => cargo[i] && cargo[i].name).filter(Boolean);

  // 3. Die Empfehlung des Rechners (nur Seefracht): Vergleich je Standardcontainer + Vorschlag
  let comparison = null, recommendation = null;
  if (!road) {
    const alle = recommendAll(cargo, "");
    if (alle) comparison = alle.rows.map((z) => ({
      container: z.name, code: codeVon(z.name), fits_all: !!z.fits, pieces_fit: z.boxes, pieces_total: z.totalBoxes,
      volume_used_pct: r1(z.util), payload_used_pct: r1(z.payPct), plan_url: adresse(codeVon(z.name)),
    }));
    const s = suggestContainer(cargo, "");
    if (s && s.type === "single") recommendation = { type: "single", containers: [{ container: s.name, code: codeVon(s.name), count: 1 }], text: T.recSingle(s.name), plan_url: adresse(codeVon(s.name)) };
    else if (s && s.type === "multi") recommendation = { type: "multi", containers: s.combo.map((c) => ({ container: c.name, code: codeVon(c.name), count: c.count })), text: T.recMulti(s.combo.map((c) => `${c.count} × ${c.name}`).join(" + ")) };
    else if (s && s.type === "equip") recommendation = { type: "special_equipment", containers: [{ container: s.name, code: codeVon(s.name), count: 1 }], item: s.item, text: T.recEquip(s.name, s.item), plan_url: codeVon(s.name) ? adresse(codeVon(s.name)) : undefined };
    else if (s && s.type === "toobig") recommendation = { type: "too_large", item: s.item, text: T.recTooBig(s.item) };
    else if (s && s.type === "tooheavy") recommendation = { type: "too_heavy", item: s.item, text: T.recTooHeavy(s.item) };
  }

  // 4. Der eine Satz
  const anzeige = (name) => (road && lang !== "de" && FZ_EN[name]) || name;
  const ort = lang === "de" ? "de-DE" : "en-US";
  const nf = (x) => Math.round(x).toLocaleString(ort);
  const pz = (x) => (x == null ? "?" : x.toLocaleString(ort, { maximumFractionDigits: 1 }));
  let summary;
  if (geladen === 0) summary = T.sNone(stueck, anzeige(preset));
  else if (rest > 0) summary = T.sRest(geladen, stueck, einheiten.length, rest, road);
  else if (einheiten.length === 1) summary = T.sAll(stueck, anzeige(preset), pz(einheiten[0].volume_used_pct), einheiten[0].weight_kg > 0 ? nf(einheiten[0].weight_kg) : "", nf(einheiten[0].payload_kg));
  else summary = T.sChain(stueck, einheiten.length, einheiten.map((e) => `${anzeige(e.type)} (${e.pieces})`).join(" + "), road);
  if (grund) summary += " " + T.weightSplit;
  // Der Vorschlag gehoert in den Satz, wenn er etwas ANDERES sagt als der Plan: nennt er
  // dieselben Container wie die Kette, stuende dieselbe Aufteilung zweimal da.
  const zaehlung = (liste) => { const z = {}; for (const [name, n] of liste) z[name] = (z[name] || 0) + n; return Object.keys(z).sort().map((k) => k + "×" + z[k]).join("|"); };
  const wieKette = !!recommendation && !!recommendation.containers && rest === 0
    && zaehlung(recommendation.containers.map((c) => [c.container, c.count])) === zaehlung(einheiten.map((e) => [e.type, 1]));
  if (recommendation && recommendation.text && !wieKette && (geladen === 0 || rest > 0 || einheiten.length > 1)) summary += " " + recommendation.text;

  // 5. Hinweise
  const notes = [T.estimate, T.read];
  const zeilen = q.split(/\r?\n|;/).filter((z) => z.trim()).length;
  if (rows.length < zeilen) notes.push(T.linesDropped(zeilen, rows.length));
  const ohneKg = cargo.filter((t) => !(num(t.weight) > 0)).map((t) => t.name);
  if (ohneKg.length) notes.push(T.noWeight(ohneKg.join(", ")));
  if (road && contCode) notes.push(T.contIgnored);
  if (!road && fzCode) notes.push(T.fzIgnored);
  if (tuerNamen.length) notes.push(T.door(tuerNamen.join(", ")));
  if (gekappt) notes.push(T.capped);
  if (container.kind && container.kind !== "dry" && container.kind !== "reefer") notes.push(T.special);
  if (road) notes.push(T.noLdm);

  const kopf = { name: preset };
  if (road) { kopf.code = fz; if (FZ_EN[preset]) kopf.name_en = FZ_EN[preset]; } else kopf.code = cont;
  Object.assign(kopf, {
    inner_cm: { length: num(container.l), width: num(container.w), height: num(container.h) },
    door_cm: container.door ? { width: num(container.door.w), height: num(container.door.h) } : null,
    payload_kg: num(container.payload),
  });

  return { status: 200, body: {
    ok: true,
    summary,
    mode: road ? "road" : "sea",
    cargo: cargo.map((t) => ({
      name: t.name, qty: Math.max(0, Math.floor(num(t.qty))),
      length_cm: num(t.l), width_cm: num(t.w), height_cm: num(t.h), weight_kg: num(t.weight),
      stackable: !!t.stackable, stack_limit_cm: t.stackH || null, rotatable: !!t.rotatable,
    })),
    totals: {
      positions: cargo.length, pieces: stueck,
      weight_kg: r1(cargo.reduce((s, t) => s + num(t.weight) * Math.max(0, Math.floor(num(t.qty))), 0)),
      volume_m3: r3(cargo.reduce((s, t) => s + num(t.l) * num(t.w) * num(t.h) / 1e6 * Math.max(0, Math.floor(num(t.qty))), 0)),
    },
    plan: {
      [road ? "vehicle" : "container"]: kopf,
      all_loaded: rest === 0 && geladen === stueck,
      fits_in_one: rest === 0 && einheiten.length === 1,
      units_needed: rest === 0 ? einheiten.length : null,
      pieces_loaded: geladen,
      pieces_left: rest,
      weight_limited: !!grund,
      door_conflicts: tuerNamen,
      units: einheiten,
    },
    recommendation,
    comparison,
    plan_url: adresse(),
    notes,
    source: "ContainerLoad packer, https://containerload.io — free 3D load calculator, no account",
  } };
}
