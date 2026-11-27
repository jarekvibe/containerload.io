// ERZEUGT von werkzeug/rechenkern.mjs aus containerload.io/app.html -- NICHT von Hand aendern.
// Der Rechenkern des Rechners, Zeile fuer Zeile wie in app.html (von "EQUIPMENT-BEGIN" bis vor
// den LANG-Block). Nach jeder Aenderung dort: node werkzeug/rechenkern.mjs
/* eslint-disable */
// Der Kern braucht keinen Browser; diese vier Namen kommen in ihm nur in Teilen vor, die hier
// niemand aufruft (Farben, Zeichenhilfen).
const React = { createElement: () => null }, THREE = {}, window = {}, document = {};
  // EQUIPMENT-BEGIN (Marker fuer test/reederei-presets.test.mjs – nicht entfernen)
  // Typische Container-Leergewichte (kg) fuer die VGM-Vorbereitung im
  // Ladevorschlag. Dieselben Richtwerte wie die Tabelle der Zuladungs-
  // Wissensseite -- Brutto - Tara = Zuladung aus PRESETS muss aufgehen,
  // test/vgm-und-gefahrgut.test.mjs rechnet beide Quellen gegeneinander.
  // Massgeblich ist immer das CSC-Schild des KONKRETEN Containers; deshalb
  // ist das Tara-Feld im Dokument editierbar und der Wert nur "typisch".
  var TARA = { "20' GP": 2280, "20' HC": 2330, "40' GP": 3880, "40' HC": 3900, "45' HC": 4900 };
  // ── Strassenlimit je Land (Richtwert) ────────────────────────────────────
  // Ein Container darf laut CSC-Schild oft weit mehr tragen, als im Vor-/
  // Nachlauf auf der Strasse legal faehrt: massgeblich ist das zulaessige
  // Gesamtgewicht der ZUGKOMBINATION, und davon gehen Zugmaschine und
  // Containerchassis ab. Verglichen wird deshalb Ladung + Container-Tara
  // (TARA) gegen brutto = zgg - fahrzeug. TYPISCHE Werte, offen als
  // Richtwert ausgewiesen -- reale Fahrzeuge, Bundesstaaten und
  // Sondergenehmigungen weichen ab. Die Wissensseite
  // ratgeber/container-gewicht-strasse rechnet DIESELBE Tabelle vor;
  // test/strassenlimit.test.mjs koppelt beide Quellen und die Invariante
  // brutto = zgg - fahrzeug.
  //   zgg      zulaessiges Gesamtgewicht der Kombination (kg)
  //            (DE/CH 40 t nach StVZO/VRV; EU kombinierter Verkehr 44 t nach
  //            RL 96/53/EG; UK 44 t fuer 6-Achser; USA 80.000 lbs Bundesrecht,
  //            gerundet 36.300 kg)
  //   fahrzeug typische Zugmaschine + Containerchassis (kg). 12.000 kg ist
  //            DIESELBE Beispielannahme wie die Strassen-Tabelle der
  //            Zuladungs-Wissensseite -- zwei Seiten mit zwei verschiedenen
  //            "typischen" Fahrzeugen waeren genau die Drift, die dieses
  //            Projekt ueberall sonst ausgebaut hat. USA hoeher, weil dort
  //            schwerere Zugmaschinen ueblich sind.
  //   brutto   Richtwert fuer Container SAMT Ladung (kg)
  var STRASSE = {
    de40: { zgg: 40000, fahrzeug: 12000, brutto: 28000 },
    kv44: { zgg: 44000, fahrzeug: 12000, brutto: 32000 },
    uk44: { zgg: 44000, fahrzeug: 12000, brutto: 32000 },
    ch40: { zgg: 40000, fahrzeug: 12000, brutto: 28000 },
    us80: { zgg: 36300, fahrzeug: 15400, brutto: 20900 }
  };
  var PRESETS = {
    "20' GP": { l: 590, w: 235, h: 239, payload: 28200, door: { w: 234, h: 228 } },
    "20' HC": { l: 590, w: 235, h: 270, payload: 28150, door: { w: 234, h: 258 } },
    "40' GP": { l: 1203, w: 235, h: 239, payload: 26600, door: { w: 234, h: 228 } },
    "40' HC": { l: 1203, w: 235, h: 270, payload: 26580, door: { w: 234, h: 258 } },
    "45' HC": { l: 1355, w: 235, h: 270, payload: 27600, door: { w: 234, h: 258 } },
    // ── Special Equipment ─────────────────────────────────────────────────
    // ACHTUNG: Alle Equipment-Masse (l/w/h/payload) sind editierbare DEFAULTS und
    // lieferantenabhaengig – NICHT als verbindlich verstehen. l/w/h = nutzbares
    // Deck-/Innenmass (cm). gauge = ISO-Slot-Huellmass (cm), gegen das Ueberstand
    // gemessen wird (Buchungsmass der Zelle: 8'=244, 8'6"=259, 20'=606, 40'=1219).
    // Open Top (Innenmass ~ wie GP, Dach offen). roof = nutzbare DACHOEFFNUNG in cm:
    // sie ist KLEINER als das Innenmass (Laengsholme seitlich, Quertraeger ueber der
    // Tuer). RICHTWERTE aus Hersteller-Datenblaettern (variieren um einige cm) --
    // der Ladeweg-Check (tuerKonflikte) prueft beim Open Top Tuer ODER Dach.
    "20' Open Top": { l: 589, w: 235, h: 239, payload: 28100, door: { w: 234, h: 230 }, roof: { l: 540, w: 222 }, kind: "opentop", gauge: { l: 606, w: 244, h: 259 } },
    "40' Open Top": { l: 1203, w: 235, h: 239, payload: 26280, door: { w: 234, h: 230 }, roof: { l: 1155, w: 221 }, kind: "opentop", gauge: { l: 1219, w: 244, h: 259 } },
    // Flat Rack (Stirnwaende vorhanden, Seiten+Dach offen; h = Stirnwand-Hoehe, variiert je Typ ~199–226)
    "20' Flat Rack": { l: 585, w: 244, h: 218, payload: 31000, kind: "flatrack", gauge: { l: 606, w: 244, h: 259 } },
    "40' Flat Rack": { l: 1198, w: 240, h: 205, payload: 39000, kind: "flatrack", gauge: { l: 1219, w: 244, h: 259 } },
    // Platform (nur Deck, alles offen; h = nur visuelle Deckhoehe, KEIN Ladungslimit)
    "20' Platform": { l: 606, w: 244, h: 30, payload: 31000, kind: "platform", gauge: { l: 606, w: 244, h: 259 } },
    "40' Platform": { l: 1219, w: 244, h: 40, payload: 40000, kind: "platform", gauge: { l: 1219, w: 244, h: 259 } },
    // Reefer (isoliert, geschlossener Korpus wie dry — daher kein eigenes gauge). Innenmasse
    // fallen wegen Isolierung + Kuehlaggregat kleiner aus als GP/HC gleicher Laenge, die
    // Zuladung entsprechend niedriger (schwereres Tara durchs Aggregat). WERTE SIND EIN
    // RICHTWERT (Web-Recherche, nicht gegen ein einzelnes Reederei-Datenblatt abgeglichen) -
    // wie bei VEHICLES ueber "Masse anpassen" korrigierbar. 40' faktisch immer High-Cube-Bauart.
    "20' Reefer": { l: 544, w: 228, h: 220, payload: 27400, door: { w: 228, h: 218 }, kind: "reefer" },
    "40' Reefer": { l: 1158, w: 228, h: 242, payload: 28200, door: { w: 228, h: 219 }, kind: "reefer" }
  };
  var META = {
    "20' GP": "General Purpose",
    "20' HC": "High Cube",
    "40' GP": "General Purpose",
    "40' HC": "High Cube",
    "45' HC": "High Cube \xB7 Pallet-Wide",
    "20' Open Top": "Open Top \xB7 Dach offen",
    "40' Open Top": "Open Top \xB7 Dach offen",
    "20' Flat Rack": "Flat Rack \xB7 Stirnw\xE4nde",
    "40' Flat Rack": "Flat Rack \xB7 Stirnw\xE4nde",
    "20' Platform": "Platform \xB7 nur Deck",
    "40' Platform": "Platform \xB7 nur Deck"
  };
  // ── Reederei-Presets: Innenmasse, wie die Reederei sie selbst veroeffentlicht ────────
  // Jede Reederei baut ihre Boxen ein paar Millimeter anders. Das klingt nach nichts und
  // entscheidet in der letzten Lage, ob eine Palette noch reingeht. Wer eine Reederei waehlt,
  // rechnet mit deren Masszahlen statt mit dem ISO-Mittelwert.
  //
  // Quelle ist jeweils die offizielle Equipment-Seite bzw. das offizielle Datenblatt der
  // Reederei (abgerufen im August 2026, Quelle je Eintrag in "src"). Die Reedereien schreiben
  // selbst dazu, dass es Beispielwerte sind, die je Baureihe und Hersteller abweichen — genau
  // deshalb bleiben die Felder unter „Masse anpassen" weiter frei editierbar.
  //
  // Masse in cm mit einer Nachkommastelle = Millimeter, so wie veroeffentlicht. Rundung auf
  // ganze cm haette die Unterschiede eingeebnet, um die es hier gerade geht.
  //
  // BEWUSST NICHT UEBERNOMMEN: die Zuladung. Die veroeffentlichten Werte haengen am zulaessigen
  // Gesamtgewicht der jeweiligen Baureihe (24 t / 30,48 t / 32,5 t) und werden teils als Spanne
  // angegeben (COSCO 20' GP: 21.740–28.295 kg). Eine einzelne Zahl daraus waere Schein-
  // Genauigkeit. Die Zuladung bleibt darum der Standardwert des Typs.
  //
  // Fehlt ein Typ bei einer Reederei, veroeffentlicht sie dazu keine eigenen Masse (z. B. bietet
  // Hapag-Lloyd keinen 20' HC an, COSCO fuehrt keinen 45er). Dann gilt der Standardwert, und die
  // Auswahl sagt das auch.
  var CARRIERS = {
    "Maersk": { src: "maersk.com", url: "https://www.maersk.com/~/media_sc9/maersk/local-information/files/africa/south-africa/important-information/container-type-and-sizes/dry-equipment-specifications-updated.pdf", eq: {
      "20' GP": { l: 589.6, w: 235, h: 239.3, door: { w: 235, h: 227.4 } },
      "40' GP": { l: 1203.2, w: 235, h: 239.3, door: { w: 234, h: 227.4 } },
      "40' HC": { l: 1203.2, w: 235, h: 269.7, door: { w: 234, h: 257.7 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 269.8, door: { w: 234, h: 258.5 } }
    } },
    "CMA CGM": { src: "cma-cgm.com", url: "https://www.cma-cgm.com/products-services/containers", eq: {
      "20' GP": { l: 590, w: 235.2, h: 239.3, door: { w: 234, h: 228 } },
      "40' GP": { l: 1203.4, w: 235.2, h: 239.5, door: { w: 234, h: 228 } },
      "40' HC": { l: 1203.4, w: 235.2, h: 270, door: { w: 234, h: 258.5 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 270, door: { w: 234, h: 258.5 } }
    } },
    // COSCO fuehrt in derselben Tabelle auch einen 20' HC, dort aber mit 259,5 cm Innenhoehe.
    // Das passt zu ihrer Kubikangabe (36 m3), nicht aber zum 20' HC dieses Rechners (270 cm,
    // 9'6" aussen) – das waere ein anderer Bautyp. Solange das nicht geklaert ist, bleibt der
    // Eintrag draussen und der 20' HC beim Standardwert, statt eine Zahl zu behaupten.
    "COSCO": { src: "coscoshipping.it", url: "https://www.coscoshipping.it/container-dimension", eq: {
      "20' GP": { l: 589.8, w: 235.2, h: 239.2, door: { w: 234, h: 228 } },
      "40' GP": { l: 1203.1, w: 235.2, h: 239.2, door: { w: 234, h: 228 } },
      "40' HC": { l: 1203.1, w: 235.2, h: 269.7, door: { w: 234, h: 258.5 } }
    } },
    "Hapag-Lloyd": { src: "hapag-lloyd.com", url: "https://www.hapag-lloyd.com/en/services-information/cargo-fleet/container.html", eq: {
      "20' GP": { l: 590, w: 235.2, h: 239.5, door: { w: 234, h: 229.2 } },
      "40' GP": { l: 1203.2, w: 235.2, h: 239.5, door: { w: 234, h: 229.2 } },
      "40' HC": { l: 1203.2, w: 235.2, h: 270, door: { w: 234, h: 259.7 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 270, door: { w: 234, h: 259.7 } }
    } },
    "ONE": { src: "one-line.com", url: "https://www.one-line.com/en/dry-containers", eq: {
      "20' GP": { l: 589.8, w: 235, h: 239, door: { w: 234, h: 228 } },
      "40' GP": { l: 1203.2, w: 235, h: 239, door: { w: 234, h: 228 } },
      "40' HC": { l: 1203.2, w: 235, h: 269.5, door: { w: 234, h: 258.5 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 269.7, door: { w: 234, h: 258.5 } }
    } },
    "Evergreen": { src: "evergreen-line.com", url: "https://www.evergreen-line.com/container/jsp/CNTR_ContainerInformation.jsp", eq: {
      "20' GP": { l: 589.8, w: 235.2, h: 239.3, door: { w: 234, h: 228 } },
      "40' GP": { l: 1203.2, w: 235.2, h: 238.5, door: { w: 234.3, h: 228 } },
      "40' HC": { l: 1203.2, w: 235.2, h: 269, door: { w: 234.3, h: 258.5 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 270, door: { w: 234, h: 258.5 } }
    } },
    // HMM veroeffentlicht auf seinen Container-Seiten nur 20' und 40' Dry; fuer 40' HC und 45'
    // gibt es dort keine eigenen Masse, also bleibt es dort beim Standard.
    "HMM": { src: "hmm21.com", url: "https://www.hmm21.com/e-service/information/mobile/containerInformationDetail.do?pageName=dryCntr_20", eq: {
      "20' GP": { l: 589.8, w: 235.2, h: 239.2, door: { w: 234, h: 228 } },
      "40' GP": { l: 1203.2, w: 235.2, h: 239.2, door: { w: 234, h: 228 } }
    } },
    "Yang Ming": { src: "yangming.com", url: "https://www.yangming.com/en/service/service_network/container_equipment_detail_40HQ.aspx", eq: {
      "20' GP": { l: 589.6, w: 235.2, h: 239.3, door: { w: 234, h: 228 } },
      "40' GP": { l: 1202.5, w: 235.2, h: 239.3, door: { w: 234, h: 228 } },
      "40' HC": { l: 1203.1, w: 235.2, h: 270, door: { w: 234, h: 258.5 } },
      "45' HC": { l: 1355.6, w: 235.2, h: 269.7, door: { w: 234, h: 258.5 } }
    } }
  };
  // Die Masse dieses Typs bei dieser Reederei – oder null (keine Reederei gewaehlt, Typ dort
  // nicht veroeffentlicht, Special Equipment).
  var carrierSpec = (carrier, presetName) => {
    var c = CARRIERS[carrier];
    return c && c.eq[presetName] ? c.eq[presetName] : null;
  };
  // Legt die Reederei-Geometrie ueber ein Preset. Zuladung, kind, gauge bleiben unberuehrt;
  // ohne Treffer kommt das Preset unveraendert zurueck.
  var applyCarrier = (base, carrier, presetName) => {
    var s = carrierSpec(carrier, presetName);
    return s ? { ...base, l: s.l, w: s.w, h: s.h, door: s.door || base.door } : base;
  };
  // EQUIPMENT-END
  // Stevies Maximal-Rechnung: wie viele Stueck EINER Position passen ALLEIN in einen leeren
  // Container. Gemeldet: „Wie viele passen, wenn sie nicht stapelbar sind?" ergab 22 (= 11 x 2
  // Lagen), weil die Rechnung die Stapel-Einstellung der Position nahm statt der Bedingung aus
  // der Frage. Die Annahmen hier gelten NUR fuer diese Rechnung — gerechnet wird auf einer
  // Kopie, der Plan bleibt unberuehrt.
  //   annahmen.stapeln: "nein" | "frei" | "bis_hoehe" (mit bis_cm) — sonst wie die Position
  //   annahmen.drehen:  true | false — sonst wie die Position
  // Rueckgabe: die Zahl UND die tatsaechlich benutzten Regeln; nur die darf Stevie nennen.
  var MAXPROBE_DECKEL = 600;
  var maxProbe = (container, item, annahmen) => {
    const a = annahmen || {};
    const it = { ...item, qty: MAXPROBE_DECKEL };
    if (a.stapeln === "nein") { it.stackable = false; it.stackMax = 1; it.stackH = null; }
    else if (a.stapeln === "frei") { it.stackable = true; it.stackMax = Infinity; it.stackH = null; }
    else if (a.stapeln === "bis_hoehe" && a.bis_cm >= 10 && a.bis_cm <= 1000) { it.stackable = true; it.stackMax = Infinity; it.stackH = Math.round(a.bis_cm); }
    if (a.drehen === true || a.drehen === false) it.rotatable = a.drehen;
    const anzahl = packCargo(container, [it]).boxes;
    const cap = stackCapOf(it), hGrenze = stackHOf(it);
    const stapeln = it.stackable === false ? "nein" : isFinite(hGrenze) ? "bis_hoehe" : cap === Infinity ? "frei" : "lagen";
    return {
      anzahl, deckel: anzahl >= MAXPROBE_DECKEL, stapeln,
      bis_cm: stapeln === "bis_hoehe" ? hGrenze : 0, lagen: stapeln === "lagen" ? cap : 0,
      drehen: it.rotatable !== false,
    };
  };
  // Stevies Container-Empfehlung (v6, Jareks Live-Befund 02.11.26): „5,8 x 2,5 x 3,0 m -- welcher
  // Typ?" beantwortete Stevie selbst mit „40' HC", obwohl 2,5 m Breite in KEINEN Standardcontainer
  // geht (innen hoechstens 235 cm) und das Banner daneben „20' Flat Rack" empfahl. Ein Sprachmodell
  // vergleicht Masse nicht zuverlaessig -- deshalb holt sich Stevie hier DIESELBE Empfehlung wie das
  // Banner (suggestContainer, darin suggestEquipment) und gibt nur deren Ergebnis wieder.
  //   items: die Ware als Ladungsliste (eine Position, Ware ausserhalb des Plans, der ganze Plan)
  // Rueckgabe: die Empfehlung, der Ueberstand je Achse gegen den groessten Standardcontainer und
  // ob die Ware durch die Tuer des empfohlenen Containers geht (nur bei einem Standard-Treffer).
  var empfProbe = (items, carrier) => {
    const sug = suggestContainer(items, carrier);
    const std = Object.values(PRESETS).filter((p) => !p.kind || p.kind === "dry");
    const stdW = Math.max(...std.map((p) => p.w)), stdH = Math.max(...std.map((p) => p.h)), stdL = Math.max(...std.map((p) => p.l));
    let breit = 0, hoch = 0, lang = 0;
    const da = (items || []).filter((t) => num(t.qty) > 0);
    da.forEach((t) => {
      const rot = t.rotatable !== false;
      const quer = rot ? Math.min(num(t.l), num(t.w)) : num(t.w), laengs = rot ? Math.max(num(t.l), num(t.w)) : num(t.l);
      breit = Math.max(breit, quer - stdW); hoch = Math.max(hoch, num(t.h) - stdH); lang = Math.max(lang, laengs - stdL);
    });
    // Tuer: dieselbe Bestfall-Regel wie fitsThroughDoor (schmalste Kante voran) -- hier lokal,
    // weil die Probe auch ohne den Rest der Oberflaeche laufen muss.
    const tuer = sug && sug.type === "single" && PRESETS[sug.name] && PRESETS[sug.name].door ? PRESETS[sug.name].door : null;
    const durchTuer = tuer ? da.every((t) => num(t.h) <= tuer.h && Math.min(num(t.l), num(t.w)) <= tuer.w) : null;
    return { sug, ueber: { breit: Math.round(breit), hoch: Math.round(hoch), lang: Math.round(lang) }, std: { w: stdW, h: stdH, l: stdL }, tuer, durchTuer };
  };
  // Spart die frei gerechnete Empfehlung wirklich Equipment gegenueber der gewaehlten Kette?
  // Verglichen wird ueber den Container-TYP, nicht ueber die Geometrie: die Reederei-Masse
  // weichen um Millimeter vom Standard ab (Yang Ming 20' GP: 589,6 x 235,2 x 239,3 statt
  // 590 x 235 x 239). Die Kette rechnete mit der Reederei-Geometrie, die Empfehlung mit dem
  // Standard — derselbe Container wirkte 0,05 m³ kleiner, und unter einem gewaehlten 20' GP
  // stand „Es ginge auch mit 1x 20' GP". Gleiche Typen = gleiche Kosten, keine Empfehlung.
  // Ein Slot ohne Typ (eigene Masse) zaehlt mit seiner Geometrie (geoVol, cm³).
  //   kette: [{ typ, geoVol }], empf: ["20' GP", ...]
  var empfSpart = (kette, empf) => {
    if (!kette || !kette.length || !empf || !empf.length) return false;
    const nennVol = (n) => { const q = PRESETS[n]; return q ? q.l * q.w * q.h : 0; };
    const typen = kette.map((s) => s.typ || "");
    if (typen.every((t) => PRESETS[t]) && typen.slice().sort().join("|") === empf.slice().sort().join("|")) return false;
    const kVol = kette.reduce((a, s) => a + (PRESETS[s.typ] ? nennVol(s.typ) : s.geoVol || 0), 0);
    const eVol = empf.reduce((a, n) => a + nennVol(n), 0);
    return empf.length < kette.length || (empf.length === kette.length && eVol < kVol - 1e-6);
  };
  // === LANDFRACHT: Fahrzeuge (Phase 1: nur Planensattel) ===
  // Innenmasse in cm. Breite ~248 real (Nennmass 2,45) – bewusst approx.
  // door = volle Innenmasse => Curtainsider ist seitenladbar, kein Tuer-Warnhinweis.
  // Straßenfahrzeuge: EIN Laderaum als Quader (Gliederzug/Hängerzug mit zwei Laderäumen bewusst
  // NICHT enthalten – ließe sich nicht ehrlich als ein Kasten darstellen). Maße in cm, Zuladung in kg
  // als typische Richtwerte (real stark von Achszahl/Aufbau abhängig; per "Maße anpassen" änderbar).
  var VEHICLES = {
    "Planensattel": { l: 1362, w: 248, h: 270, payload: 24000, door: { w: 248, h: 270 } },
    "Wechselbrücke": { l: 745, w: 248, h: 270, payload: 16000, door: { w: 248, h: 270 } },
    "Motorwagen": { l: 720, w: 248, h: 270, payload: 12000, door: { w: 248, h: 270 } },
    "7,5-Tonner": { l: 610, w: 220, h: 230, payload: 2800, door: { w: 220, h: 230 } },
    "Sprinter": { l: 430, w: 180, h: 190, payload: 1200, door: { w: 180, h: 190 } }
  };
  // Anzeigename und Beitext je Fahrzeug — analog zu KIND_LABEL/KIND_META bei den Containern.
  // Die SCHLUESSEL bleiben deutsch: sie stehen als preset im ?p=-/?c=-Link und duerfen sich
  // nicht aendern. Angezeigt wird, was T liefert. Ohne das stand der ganze Landfracht-Modus
  // auch bei ?lang=en auf Deutsch da, waehrend die Seefracht daneben sauber uebersetzte.
  var VEHICLE_LABEL = (T) => ({
    "Planensattel": T.vhTilt, "Wechselbrücke": T.vhSwap, "Motorwagen": T.vhRigid,
    "7,5-Tonner": T.vh75, "Sprinter": T.vhVan
  });
  var VEHICLE_META = (T) => ({
    "Planensattel": T.vmTilt, "Wechselbrücke": T.vmSwap, "Motorwagen": T.vmRigid,
    "7,5-Tonner": T.vm75, "Sprinter": T.vmVan
  });
  // LDM-Referenzbreite: FESTE Konvention (2x Europalettenlaengsseite 1,20 m), NICHT die echte
  // Innenbreite. Nur Doku-Konstante; "belegte Lademeter" nutzt direkt die X-Ausdehnung (s. ldmBelegt).
  var LDM_REF_WIDTH_CM = 240;
  // kind -> welche Huellflaechen sind geschlossen (true = Panel wird gezeichnet).
  // EINE Wahrheit: aus kind werden sowohl gezeichnete Flaechen als auch OOG-Achsen abgeleitet.
  var EQUIP = {
    dry: { panels: { sides: true, ends: true, roof: true } },
    opentop: { panels: { sides: true, ends: true, roof: false } },
    flatrack: { panels: { sides: false, ends: true, roof: false } },
    platform: { panels: { sides: false, ends: false, roof: false } },
    reefer: { panels: { sides: true, ends: true, roof: true } }
  };
  var panelsFor = (k) => (EQUIP[k] || EQUIP.dry).panels;
  // Container-Auswahl: Struktur rein aus PRESETS ableiten (kind + Laenge + GP/HC).
  // Neue Presets (auch neue kinds) fliessen automatisch ein.
  var KIND_ORDER = ["dry", "opentop", "flatrack", "platform", "reefer"];
  var PICK = (function () {
    var byKind = {};
    Object.keys(PRESETS).forEach(function (p) {
      var k = PRESETS[p].kind || "dry";
      var L = (p.match(/^(\d+')/) || [])[1];
      if (!L) return;
      byKind[k] = byKind[k] || { lens: {} };
      if (k === "dry") {
        byKind[k].lens[L] = byKind[k].lens[L] || {};
        byKind[k].lens[L][/HC/.test(p) ? "HC" : "GP"] = p;
      } else {
        byKind[k].lens[L] = { _: p };
      }
    });
    return byKind;
  })();
  var KINDS_PRESENT = KIND_ORDER.filter(function (k) { return PICK[k]; });
  var KIND_LABEL = (T) => ({ dry: T.kDry, opentop: T.kOpenTop, flatrack: T.kFlatRack, platform: T.kPlatform, reefer: T.kReefer });
  var KIND_SUB = (T) => ({ dry: T.subDry, opentop: T.subOpenTop, flatrack: T.subFlatRack, platform: T.subPlatform, reefer: T.subReefer });
  var KIND_META = (T) => ({ dry: null, opentop: T.metaOpenTop, flatrack: T.metaFlatRack, platform: T.metaPlatform, reefer: T.metaReefer });
  // Farbwaehler: alle zehn stehen zur Wahl. Wer weisse Kartons hat, soll sie weiss sehen.
  var TYPE_COLORS = ["#3B8CFF", "#16D9C4", "#FF7A1A", "#B15CFF", "#FF3D6E", "#2BE06B", "#FFC21F", "#FF4FD1", "#FFFFFF", "#000000"];
  // Automatische Vergabe nach Position: nur die ersten acht. Weiss und Schwarz werden
  // NIE von selbst vergeben. Grund: Die Packstuecke in der 3D-Ansicht haben keine
  // Kantenlinien (die hat nur die Containerhuelle), und ihr Material reflektiert bei
  // Schwarz praktisch nichts. Vor dem Hintergrund (C.bg = #0E1116) waere die 10. Position
  // damit fast unsichtbar — ohne dass jemand das ausgewaehlt haette. Selbst gewaehlt ist
  // Schwarz in Ordnung, zugeteilt nicht.
  var TYPE_COLORS_AUTO = TYPE_COLORS.slice(0, 8);
  // ══ Gestaltungsskala ══════════════════════════════════════════════════════
  // Warum es die gibt: gemessen lagen im Rechner 122 von 225 Schriftgroessen bei
  // 11 px, es gab 22 verschiedene Innenabstaende, sieben Linienstaerken an den
  // Symbolen und 104 Rahmenlinien -- die Startseite kommt mit 18 aus. Der Rechner
  // sah neben ihr nicht deshalb beliebig aus, weil ein Wert falsch war, sondern
  // weil es gar keine Ordnung gab. Wer hier eine Stufe braucht, traegt sie EIN
  // und benutzt sie; neue Zwischenwerte im Code faengt test/design-system.test.mjs.
  //
  // Schrift: Fliesstext bleibt klein und ruhig, ZAHLEN duerfen gross werden. Ein
  // Ladungsrechner wird nach Zahlen gelesen, nicht nach Beschriftungen.
  var FS = { label: 11.5, small: 12.5, body: 13.5, lead: 15, h3: 17, h2: 20 };
  var FW = { label: 500, body: 500, semi: 600, bold: 700 };
  var NUMS = { s: 15, m: 20, l: 26 };
  // Radien: ZWEI Stufen statt vier. 8 fuer alles, was man anfasst (Knopf, Feld,
  // Pille), 16 fuer Flaechen, auf denen etwas steht (Karte, Dialog).
  var R = { s: 8, l: 16 };
  // Abstaende: 4 / 8 / 12 / 16 / 24 / 32. Nichts dazwischen.
  var SP = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
  // Symbole: eine Linienstaerke, zwei Groessen, nichts unter 16.
  var ICO = { s: 16, m: 20, sw: 1.5 };
  // Zwei Farbsaetze, EIN Markenname: das Markup liest ausschliesslich C.* — beim Umschalten
  // (Sonne/Mond im Kopf, UI-Umbau Phase 1) kopiert die App den gewaehlten Satz nach C und
  // zeichnet neu. Voreinstellung ist die Systemeinstellung des Geraets (prefers-color-scheme);
  // eine Wahl per Hand wird unter cl_theme gemerkt (steht in der Datenschutzerklaerung).
  // Die 3D-Buehne bleibt in BEIDEN Saetzen dunkel — sie ist ein Bild, kein Formular; dasselbe
  // gilt fuer Share-Card (Canvas), Druckvorlage, Maskottchen und Container-Piktogramm.
  // BEIDE Saetze tragen DIESELBEN Schluessel; test/design-system.test.mjs prueft das und
  // rechnet die Lesbarkeit (4,5:1) fuer jeden Satz nach.
  var C_DUNKEL = {
    text: "#E9F0F7",
    dim: "#9DB0C2",
    // faint war #5C7085 (3,19–3,93:1, unter WCAG AA) und dann #7689A0 — dessen „4,5 ueberall"
    // hielt beim Nachrechnen auf raised/field nicht (4,31:1). #7E91A8 haelt die Grenze
    // wirklich auf ALLEN Flaechenstufen (4,79:1 im schlechtesten Fall) und bleibt deutlich
    // hinter dim zurueck. Die Kontrast-Wache in test/design-system.test.mjs rechnet das nach.
    faint: "#7E91A8",
    // soft/info/accText/warnSoft sind KEINE neuen Toene, sondern die eingesammelten Streuner:
    // vor Phase 1 lagen #d4dce5, #9ecbff, #DBE8FF/#BCD9FF/#cfe6ff/#bdfaf0 und #ffd9a8/#ffd9a0
    // als Literale im Markup — fast gleiche Pastelltoene, die nur auseinanderlaufen konnten.
    soft: "#d4dce5",
    info: "#9ecbff",
    accText: "#DBE8FF",
    warnSoft: "#ffd9a8",
    accent: "#2E8FFF",
    // teal behaelt seinen Namen (37 Fundstellen), traegt aber denselben Akzent wie oben.
    // Ein Produkt, ein Markenton — genau wie auf der Landingpage. Farbverlaeufe von
    // accent nach teal werden dadurch automatisch zu einer glatten Flaeche.
    // Achtung: TYPE_COLORS bleibt bunt — das sind Kennfarben je Packstueckart und tragen
    // Information, keine Dekoration.
    teal: "#2E8FFF",
    good: "#2FD8A0",
    warn: "#F5A524",
    bad: "#FF5D52",
    field: "#1C2531",
    fieldBorder: "#232C38",
    // Redesign-Tokens (Design-System „Der Rechner, der aussieht wie 2026"):
    // Sechs Flaechenstufen, mehr gibt es nicht. Der Grundton ist derselbe wie auf der
    // Landingpage (PR #57) – sie bindet den Rechner per iframe ein, und eine Naht zwischen
    // zwei fast gleichen Schwarztoenen sieht man sofort.
    bg: "#0E1116",
    chrome: "#121821",
    surface: "#161D27",
    raised: "#1C2531",
    line: "#232C38",
    lineHi: "#2E3A49",
    // hairline ist die leise Trennlinie (Kopf-/Fusszeile, Spaltenraender): im Dunkeln bewusst
    // der raised-Ton (so stand es als Literal im Markup), im Hellen die normale line.
    hairline: "#1C2531",
    onAcc: "#04121A",
    // onWarn ist der warme Grund der Tuer-Warnung als Textfarbe auf warn-Flaechen;
    // warnGlas derselbe Ton als Banner-Grund. Im Hellen trennen sich beide.
    onWarn: "#1a0f08",
    warnGlas: "#1a0f08",
    hint: "#2E8FFF",
    // Frueher halbdurchsichtig plus Weichzeichner. Jetzt deckend: Tiefe entsteht ueber
    // Flaechenstufe und Kante, nicht ueber Unschaerfe — spart nebenbei Rechenzeit.
    glass: "#161D27",
    // Der Karten-Schatten (Phase 2, Entwurf B2): im Dunkeln schwarz und knapp, im Hellen
    // der weiche Grauton des Mocks. KEIN Hex — die Farbsatz-Wachen lesen ihn bewusst nicht.
    schatten: "0 1px 2px rgba(0,0,0,.3), 0 14px 36px -20px rgba(0,0,0,.7)",
    // Dialoge und Popover (Phase 3): im Hellen deutlich weicher — ein 85%-Schwarz unter
    // einer weissen Karte sieht aus wie ein Loch. Der Schleier (scrim) ebenso.
    schattenTief: "0 30px 80px -20px rgba(0,0,0,0.85)",
    scrim: "rgba(4,8,14,0.74)",
    grad: "linear-gradient(135deg,#2E8FFF,#2E8FFF)"
  };
  // Der helle Satz (Entwurf B2, „Helle Werkbank" — Jareks Wahl). Zwei bewusste Abweichungen
  // von der Marke, beide der Lesbarkeit geschuldet (WCAG 4,5:1 auf hellem Grund):
  // accent ist eine Stufe tiefer (#1273E6 statt #2E8FFF — #2E8FFF kommt auf Weiss nur auf
  // 3,2:1), und die Statusfarben good/warn/bad sind die dunklen Geschwister derselben Toene.
  var C_HELL = {
    text: "#1C2733",
    dim: "#46566A",
    faint: "#5B6B7E",
    soft: "#33404F",
    info: "#0F62D6",
    accText: "#0B4FA8",
    warnSoft: "#7A4A00",
    accent: "#1273E6",
    teal: "#1273E6",
    good: "#177A4C",
    warn: "#A94E08",
    bad: "#C9271B",
    field: "#F6F8FB",
    fieldBorder: "#D7DEE9",
    bg: "#EEF1F6",
    chrome: "#FFFFFF",
    surface: "#FFFFFF",
    raised: "#F6F8FB",
    line: "#E3E8F0",
    lineHi: "#C6D0DD",
    hairline: "#E3E8F0",
    onAcc: "#FFFFFF",
    onWarn: "#FFFFFF",
    warnGlas: "#FFF4DD",
    hint: "#1273E6",
    glass: "#FFFFFF",
    schatten: "0 1px 2px rgba(16,24,40,.05), 0 10px 30px -18px rgba(16,24,40,.18)",
    schattenTief: "0 30px 80px -30px rgba(16,24,40,0.32)",
    scrim: "rgba(16,24,40,0.45)",
    grad: "linear-gradient(135deg,#1273E6,#1273E6)"
  };
  // C ist die lebende Kopie des aktiven Satzes. Das Umschalten passiert in App():
  // Object.assign(C, ...) VOR dem Rendern, danach liest jedes style={} den neuen Wert.
  var C = Object.assign({}, C_DUNKEL);
  // Start-Thema: gemerkte Wahl → Systemeinstellung → dunkel. Im eingebetteten Demo der
  // Startseite immer dunkel (die Landingpage ist dunkel; eine helle Naht im iframe faellt
  // sofort auf — die helle Startseite ist eine eigene Entscheidung).
  var themaStart = () => {
    try {
      const t = localStorage.getItem("cl_theme");
      if (t === "hell" || t === "dunkel") return t;
    } catch (e) {}
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) return "hell";
    } catch (e) {}
    return "dunkel";
  };
  // Die Buehnen-Palette (Jareks Wunsch vom 30.10.26: „kriegt man die 3D-View auch hell?").
  // Eigene Marke B statt C: die Buehne ist ein BILD mit eigener Lichtwelt — Nebel, Licht,
  // Stahl, Raster. Signal- und Kennfarben (TYPE_COLORS, Ghost-Gruen/-Rot, Warn-Bernstein,
  // Zugmaschine, Nummern-Plaketten) bleiben in beiden Saetzen gleich: sie tragen Bedeutung.
  // Zahlen fuer Three.js-Materialien, Strings fuer DOM/Canvas. Gewechselt wird wie bei C
  // in App() per Object.assign; der Bau-Effekt der Szene haengt am Thema und baut neu.
  var B_DUNKEL = {
    grad: "radial-gradient(120% 80% at 50% 0%, #101a2b 0%, #121821 55%, #0E1116 100%)",
    vignette: "radial-gradient(75% 70% at 50% 45%, transparent 55%, rgba(4,7,11,0.55) 100%)",
    nebel: 0x070a0f,
    himmelOben: 0xbfd3ff, himmelUnten: 0x0a0f14,
    stahl: 0x33425a, rahmen: 0x4a5d7e, boden: 0x202a3a, kanteOben: 0x6f93c4,
    gitterHaupt: 0x2c3c50, gitterNeben: 0x161f2b,
    deck: 0x222a36, deckFuss: 0x2a3340,
    wellGrund: "rgb(70,78,92)", wellDunkel: "rgba(20,26,36,0.55)", wellHell: "rgba(150,160,178,0.22)",
    schattenOp: 0.34
  };
  var B_HELL = {
    grad: "radial-gradient(120% 80% at 50% 0%, #FFFFFF 0%, #F2F5FA 55%, #E6EBF2 100%)",
    vignette: "radial-gradient(75% 70% at 50% 45%, transparent 55%, rgba(16,24,40,0.10) 100%)",
    nebel: 0xe6ebf2,
    himmelOben: 0xffffff, himmelUnten: 0xc9d4e2,
    stahl: 0x8da2bd, rahmen: 0x6b82a3, boden: 0xd7dfe9, kanteOben: 0x5c7ba3,
    gitterHaupt: 0xc3cfdd, gitterNeben: 0xe4eaf1,
    deck: 0xcfd8e4, deckFuss: 0xb9c5d4,
    wellGrund: "rgb(186,196,210)", wellDunkel: "rgba(90,106,128,0.30)", wellHell: "rgba(255,255,255,0.45)",
    schattenOp: 0.18
  };
  var B = Object.assign({}, B_DUNKEL);
  var SANS = "'Archivo', ui-sans-serif, system-ui, -apple-system, sans-serif";
  var MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', monospace";
  // Bild direkt in die Zwischenablage kopieren (statt nur als Datei-Download) – erlaubt Einfuegen
  // per Strg+V mitten in ein Mail-Compose-Fenster, wie bei einem echten Screenshot.
  var CLIPBOARD_IMAGE_SUPPORTED = typeof navigator !== "undefined" && !!(navigator.clipboard && navigator.clipboard.write && typeof window.ClipboardItem === "function");
  var num = (v, d = 0) => Number.isFinite(+v) && v !== "" ? +v : d;
  var fitsThroughDoor = (it, door) => num(it.h) <= door.h && Math.min(num(it.l), num(it.w)) <= door.w;
  // Tuer-Fit anhand der TATSAECHLICHEN Ausrichtung jedes platzierten Stuecks (dz = Fussabdruck
  // entlang der Container-Breite, dy = Hoehe, exakt wie gepackt) statt der Typ-weiten Bestfall-
  // Annahme "schmalste Kante voran" (fitsThroughDoor/min(l,w)) - die uebersah gedrehte Stuecke,
  // deren gepackte Breitenkante die Tueroeffnung tatsaechlich ueberschreitet. Ohne eigene
  // Platzierung (Typ passt z.B. gar nicht ins Volumen) bleibt fitsThroughDoor als Rueckfall -
  // dafuer gibt es keine tatsaechliche Ausrichtung zum Nachschauen.
  var doorFailCheck = (cargo, doorOpening, placedList) => {
    const byTi = {};
    (placedList || []).forEach((b) => { (byTi[b.ti] = byTi[b.ti] || []).push(b); });
    const idx = new Set();
    let critical = null; // breiteste scheiternde Kante (w,h), fuers Ghost-Vorschaubild im 3D
    (cargo || []).forEach((it, i) => {
      if (num(it.qty) <= 0) return;
      const ps = byTi[i];
      if (ps && ps.length) {
        const bad = ps.filter((b) => num(b.dz) > doorOpening.w + 1e-6 || num(b.dy) > doorOpening.h + 1e-6);
        if (bad.length) {
          idx.add(i);
          // d = Tiefe der Kante in Fahrtrichtung (dx, wie gepackt) -- die "Warum?"-
          // Animation schiebt einen echten Kasten zur Tuer, keine flache Scheibe.
          bad.forEach((b) => { if (!critical || num(b.dz) > critical.w) critical = { w: num(b.dz), h: num(b.dy), d: num(b.dx) }; });
        }
      } else if (!fitsThroughDoor(it, doorOpening)) {
        idx.add(i);
        const w = Math.min(num(it.l), num(it.w)), h = num(it.h);
        if (!critical || w > critical.w) critical = { w, h, d: Math.max(num(it.l), num(it.w)) };
      }
    });
    return { idx, critical };
  };
  // Tuer-Fit ueber eine ganze KETTE: jede Kiste zaehlt gegen die Tuer IHRES
  // Containers. Gemeldet mit Bild: der Konflikt lag in einem Folgecontainer,
  // Warnrahmen und Ghost klebten trotzdem am Tuerende von C1 -- die Pruefung
  // kannte nur den ersten Container.
  //   cargo        die Ladungsliste (fuer den Bestfall-Rueckfall unplatzierter Typen)
  //   chain        Slots mit .placed und .preset (Folgecontainer: Tuer aus dem Preset)
  //   tuer0        Tuer des ERSTEN Containers -- den Custom-Sonderfall (keine
  //                Preset-Tuer -> volle Innenflaeche) kennt nur der Aufrufer
  //   mitRueckfall Typen ganz ohne Platzierung im Bestfall gegen tuer0 pruefen
  //                (false im Fokus: dort geht es nur um den gezeigten Container)
  // Rueckgabe: idx = Positionen mit Konflikt; slots = je Konflikt-Container die
  // Oeffnung und die kritischste Kante (dz/dy/dx wie gepackt) fuers 3D-Bild.
  var tuerKonflikte = (cargo, chain, tuer0, mitRueckfall = true) => {
    const idx = /* @__PURE__ */ new Set();
    const slots = [];
    const platziert = /* @__PURE__ */ new Set();
    (chain || []).forEach((c) => (c.placed || []).forEach((b) => platziert.add(b.ti)));
    // Ladeweg je Bauart: dry und Reefer sind geschlossene Kaesten -- dort zaehlt
    // nur die Tuer (der Reefer stand faelschlich mit den offenen Bauarten auf
    // "nie pruefen", dabei hat er die ENGSTE Tuer von allen). Der Open Top hat
    // einen ZWEITEN Ladeweg von oben: die Dachoeffnung (preset.roof), die kleiner
    // ist als das Innenmass -- ein Konflikt ist dort erst, was weder durch die
    // Tuer noch durchs Dach geht. Flat Rack und Platform sind offen: kein Engpass.
    (chain || []).forEach((c, ci) => {
      const kind = (c.preset && c.preset.kind) || "dry";
      if (kind === "flatrack" || kind === "platform") return;
      const dach = kind === "opentop" ? (c.preset && c.preset.roof) || null : null;
      if (kind === "opentop" && !dach) return;
      const tuer = ci === 0 ? tuer0 : (c.preset && c.preset.door) || { w: num(c.preset && c.preset.w), h: num(c.preset && c.preset.h) };
      if (!tuer || !(tuer.w > 0) || !(tuer.h > 0)) return;
      let critical = null;
      (c.placed || []).forEach((b) => {
        const tuerNicht = num(b.dz) > tuer.w + 1e-6 || num(b.dy) > tuer.h + 1e-6;
        const dachNicht = !dach || num(b.dx) > dach.l + 1e-6 || num(b.dz) > dach.w + 1e-6;
        if (tuerNicht && dachNicht) {
          idx.add(b.ti);
          if (!critical || num(b.dz) > critical.w) critical = { w: num(b.dz), h: num(b.dy), d: num(b.dx) };
        }
      });
      if (critical) slots.push({ ci, tuer, critical });
    });
    // Bestfall-Rueckfall wie in doorFailCheck: ein Typ ganz ohne Platzierung
    // hat keine gepackte Lage zum Nachschauen. Er zaehlt gegen die Haupt-Tuer
    // und haengt sein Ghost-Bild an Slot 0.
    if (mitRueckfall && tuer0 && tuer0.w > 0 && tuer0.h > 0) {
      // Bauart von Slot 0 auch hier: beim Open Top rettet die Dachoeffnung den
      // Bestfall (schmalste Kante zaehlt gegen die Dachbreite, laengste gegen die
      // Dachlaenge -- die Hoehe spielt von oben keine Rolle); ohne Dachmass oder
      // bei offener Bauart gibt es keinen Rueckfall-Konflikt.
      const kind0 = (chain && chain[0] && chain[0].preset && chain[0].preset.kind) || "dry";
      const dach0 = kind0 === "opentop" ? (chain[0].preset && chain[0].preset.roof) || null : null;
      const offen0 = kind0 === "flatrack" || kind0 === "platform" || (kind0 === "opentop" && !dach0);
      const passtDach = (it) => dach0 && Math.max(num(it.l), num(it.w)) <= dach0.l && Math.min(num(it.l), num(it.w)) <= dach0.w;
      let rest = null;
      (cargo || []).forEach((it, i) => {
        if (offen0 || num(it.qty) <= 0 || platziert.has(i) || fitsThroughDoor(it, tuer0) || passtDach(it)) return;
        idx.add(i);
        const w = Math.min(num(it.l), num(it.w)), h = num(it.h);
        if (!rest || w > rest.w) rest = { w, h, d: Math.max(num(it.l), num(it.w)) };
      });
      if (rest) {
        const s0 = slots.find((s) => s.ci === 0);
        if (!s0) slots.push({ ci: 0, tuer: tuer0, critical: rest });
        else if (rest.w > s0.critical.w) s0.critical = rest;
      }
    }
    return { idx, slots };
  };
  var _id = 0;
  var uid = () => `c${_id++}`;
  var PALLET_PRESETS = [
    // \bepal\b statt epal: "Industri-EPAL-etten" -- der Substring steckt mitten in
    // "Industriepaletten" und griff sich dort das falsche Grundmass.
    // Seit 26.11.26 auch in den uebrigen Sprachen der Oberflaeche: euro pallet / europallet
    // (en, nl), europalet / palé europeo (es), palette Europe (fr), 欧标托盘 (zh); Industrie:
    // palet industrial, palette industrielle, blokpallet, palete PBR (Brasilien, 1000 x 1200).
    // Portugiesisch: palete europeu / europalete. "Palet americano" steht NICHT da:
    // in Spanien meint es 1200 x 1000, in Lateinamerika 48 x 40 Zoll (siehe es/guia).
    { re: /euro\s*-?\s*pal(?:ette|let|et|é)|eur\s*-?\s*pal(?:ette|let)|\bepal\b|pal(?:ette|ete|let|et|é)s?\s+(?:euro(?:p[eé][a-zé]*)?|eur)(?![a-zà-ÿ])|欧标托盘|欧洲托盘|欧式托盘/i, l: 120, w: 80 },
    { re: /industrie\s*-?\s*pal(?:ette|let)|industrial\s*pallet|pal(?:ette|ete|let|et|é)s?\s+industri|\bblokpallet|\bpal(?:ete|let)s?\s+pbr\b|工业托盘/i, l: 120, w: 100 }
  ];
  // Die Woerter des Text-Imports in den Sprachen der Oberflaeche (26.11.26). Bis dahin
  // verstand der lokale Parser nur Deutsch und Englisch: "9 bultos 250x80x30 no apilables"
  // ergab neun STAPELBARE Stuecke. Er liest ?q=-Links, die Import-Box der Startseite, lange
  // Listen (ueber 6.000 Zeichen) und alles, wenn die KI nicht erreichbar ist.
  // Drei Regeln fuer jedes neue Wort:
  //   1. Es heisst in KEINER dieser Sprachen etwas anderes (span. "nombre" = Name, franz.
  //      "nombre" = Anzahl; niederl. "dozen" = Kartons, engl. "dozen" = Dutzend; engl. "high"
  //      steht in "high cube" -- sie stehen deshalb nicht oder nicht allein da).
  //   2. Eine Verneinung beginnt an einer Wortgrenze ("piano apilable" ist kein "no apilable"),
  //      ein neues Zaehlwort endet an einer ("12 Futterkisten" sind keine "12 fut").
  //   3. Kein Lookbehind: aeltere Safari-Fassungen kennen es nicht, und die Seite bliebe stehen.
  var IMPORT_WORT = {
    nichtStapelbar: /nicht\s*stapel|non[-\s]?stack|not\s*stack|keine?\s*stapel|\bno\s+(?:son\s+|es\s+|se\s+pueden?\s+)?(?:apila|remonta)|\bsin\s+apilar|\b(?:non|pas)[-\s]?(?:gerb|empil)|\bniet[-\s]?stapel|\bonstapelbaar|\bn[aã]o\s+(?:(?:[eé]|s[aã]o|podem?\s+ser)\s+)?(?:empilh|remont|sobrepo)|不可堆|不能堆|禁止堆|不可叠|不能叠/i,
    nichtDrehbar: /nicht\s*drehbar|not\s*rotat|no\s*rotat|\bno\s+(?:se\s+pueden?\s+)?(?:gira|rota)|\bsin\s+(?:gira|rota)|\bne\s+pas\s+(?:tourner|pivoter)|\b(?:sans|pas\s+de)\s+rotation|\brotation\s+interdite|\bniet[-\s]?draai|\bn[aã]o\s+(?:gir|rotac)|\bsem\s+gir|不可旋转|不能旋转|禁止旋转/i,
    // "stapelbar bis 180 cm" -- das Schluesselwort vor der Hoehe
    bis: "(?:bis|m[aá]x\\.?|maximal|maximaal|m[aá]ximo|up\\s*to|hasta|jusqu['’]?\\s*[àa]|\\btot|\\bat[eé]|限高|最高|不超过|至)",
    // Zaehlwoerter, die mit der Zahl verschwinden ("12 Stück") -- alt und neu getrennt, weil
    // die neuen an einer Wortgrenze enden muessen (Regel 2)
    stk: "x\\b|×|stk\\.?|stück|colli|packst(?:ü|ue)cke?|pcs|units?",
    stkNeu: "uds?\\b\\.?|unidades?|unid\\b\\.?|un\\b\\.?|pe[cç]as?|piezas?|pzas?\\b\\.?|pi[eè]ces?|unit[eé]s?|stuks?|个|件",
    // Ware, die als Name stehen bleibt ("12 Kisten" -> "Kisten")
    ware: "paletten?|pallets?|industriepaletten?|europaletten?|kartons?|cartons?|crates?|kisten?|gitterboxen?|f(?:ä|ae)sser|maschinen|trommeln|boxes?",
    wareNeu: "europaletes?|paletes?|caixas?|caixotes?|volumes|fardos?|rolos?|bombonas?|engradados?|europalets?|palets?|pal[eé]s|palé|tarimas?|cajas?|cajones|bultos?|bidones|tambores|sacos?|rollos?|bobinas?|colis|caisses?|f[uû]ts?|sacs?|rouleaux|bobines?|europallets?|blokpallets?|vaten|kratten|zakken|rollen|balen|托盘|托|箱|桶|卷|包|台|捆",
    gewicht: "kgs?|kilo[a-z]*|quilo[a-z]*|toneladas?|tonnes|tonnen?|to\\b|t\\b|lbs?\\b|pounds?\\b|libras?\\b|公斤|千克|吨",
    // Was nach dem Lesen aus dem NAMEN verschwindet (Deutsch und Englisch raeumt die Zeile selbst)
    wortWeg: /\bno\s+(?:son\s+|es\s+|se\s+pueden?\s+)?(?:apilables?|apilar|remontables?)|\bsin\s+apilar|\bapilables?|\bremontables?|\b(?:non|pas)[-\s]?(?:gerbables?|empilables?)|\bgerbables?|\bempilables?|\bniet[-\s]?stapelbaar|\bniet\s+stapelen|\bstapelbaar|\bno\s+(?:se\s+pueden?\s+)?(?:girar|girables?|rotar|rotables?)|\bsin\s+girar|\bne\s+pas\s+(?:gerber|empiler|tourner|pivoter)|\b(?:sans|pas\s+de)\s+rotation|\bniet[-\s]?draai(?:baar|en)|\bn[aã]o\s+(?:empilh[aá]ve(?:l|is)|empilhar|remont[aá]ve(?:l|is))|\bempilh[aá]ve(?:l|is)|\bn[aã]o\s+girar|\bsem\s+girar|不可堆叠|不可堆放|不能堆叠|可堆叠|可堆放|不可旋转|不能旋转/ig
  };
  var IMPORT_RE = (function () {
    var W = IMPORT_WORT, ende = "(?![a-zà-ÿ])";
    return {
      menge: new RegExp("(\\d+)\\s*(?:" + W.stk + "|" + W.ware + "|(?:" + W.stkNeu + "|" + W.wareNeu + ")" + ende + ")", "i"),
      stk: new RegExp("(\\d+)\\s*(?:" + W.stk + "|(?:" + W.stkNeu + ")" + ende + "(?:\\s+(?:de\\s+|d['’]\\s*|van\\s+))?)", "i"),
      ware: new RegExp("(\\d+)\\s*(" + W.ware + "|(?:" + W.wareNeu + ")" + ende + ")", "i"),
      gewicht: new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(" + W.gewicht + ")", "i"),
      bis: new RegExp(W.bis + "\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m)\\b", "i"),
      bisWeg: new RegExp(W.bis + "\\s*\\d+(?:[.,]\\d+)?\\s*(?:mm|cm|m)\\b", "ig")
    };
  })();
  // DE-robuster Zahlen-Parser fuer TSV-Zellen:
  // "1.200,50" -> 1200.5 | "1200.5" -> 1200.5 | "1200,5" -> 1200.5 | "1 200" -> 1200
  var toNumDE = (x) => {
    let s = String(x == null ? "" : x).trim().replace(/\s/g, "");
    if (/,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  // Spalten-Mapping des letzten TSV-Laufs, NUR fuer die Hinweiszeile im Import-Modal.
  // Bewusst Modul-Variable statt Zusatzfeld in den rows: der parseCargoText-Vertrag
  // (rows = {qty,l,w,h,weight,stackable,rotatable,name}) bleibt unangetastet (QIMPORT!).
  var LAST_TSV_MAP = null;
  // Wie eine Position heisst, die OHNE Namen ankommt ("12 x 120x80x100", ein ?q=-Link ohne
  // Wort davor). Die Vorgabe des Parsers ist deutsch; der Rechner setzt hier die Woerter
  // seiner Sprache ein, sobald das Woerterbuch steht (T.importNamen). Ein einzelner Aufruf
  // kann sie mit opts.namen ueberstimmen. Vorher hiess so eine Position in jeder Sprache
  // "Position", "Palette" oder "Europalette" -- auch im englischen Rechner.
  var PARSER_NAMEN = null;
  var parserNamen = (opts) => (opts && opts.namen) || (typeof PARSER_NAMEN !== "undefined" && PARSER_NAMEN) || {};
  // Excel-Copy-Paste (TSV): Kopfzeilen-Erkennung in den Sprachen der Oberflaeche (DE, EN,
  // seit 26.11.26 ES, FR, NL, ZH, PT -- Regeln siehe IMPORT_WORT), Einheiten aus dem Header
  // (mm/10, m*100, t*1000 – pro Spalte), positionaler Fallback ohne Header.
  // Ehrlichkeit: OHNE Einheit im Header wird cm angenommen – keine Magnitude-Heuristik.
  function parseTSV(text, opts) {
    const ZOLL = 2.54, PFUND = 0.45359237, r6 = (v) => Math.round(v * 1e6) / 1e6;
    opts = opts || {};
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\t+$/, "")).filter((l) => l.trim());
    const grid = lines.map((l) => l.split("\t").map((c) => c.trim()));
    // Dreierkette "120x80x95" -- auch als ZELLE einer kombinierten Masse-Spalte. Ohne
    // diese Lesart verwarf der Parser jede Zeile solcher Listen, und die sind in
    // Speditionslisten Standard ("Masse (LxBxH)").
    const KETTE = /(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m)(?![a-zà-ÿ]))?/i;
    const KEYS = [
      // "Bultos", "Colis" zaehlen nur am ANFANG der Zelle oder hinter "Nº (de)": in
      // "Descripción de los bultos" sind sie die Beschreibung. Franz. "Nombre" nur mit dem,
      // was gezaehlt wird ("Nombre de colis") -- allein ist es der spanische NAME.
      ["qty", /anzahl|menge|stk|stück|qty|quantity|pcs|colli|kartons|cantidad|^cant\b|(?:^|n[uú]m(?:ero)?\.?\s+(?:de\s+)?|n[º°]\.?\s*(?:de\s+)?)(?:bultos|piezas|unidades|uds?\b|colis\b|cajas\b|palets\b)|quantit[eé]|^qt[eé](?![a-zà-ÿ])|^nbr?e?\b|nombre\s+de\s+(?:colis|palettes?|cartons|caisses|pi[eè]ces|unit[eé]s)|aantal|stuks|quantidade|^qtde?\b|^volumes\b|数量|件数|箱数/i],
      ["l", /länge|laenge|length|^l$|^l\s*\(|\blargo\b|\blongitud\b|longueur|lengte|comprimento|^compr\b|^长度?\s*(?:$|[(（\[])/i],
      ["w", /breite|width|^b$|^w$|^b\s*\(|^w\s*\(|\banch(?:o|ura)\b|largeur|breedte|largura|^larg\b|^宽度?\s*(?:$|[(（\[])/i],
      ["h", /höhe|hoehe|height|^h$|^h\s*\(|\balt(?:o|ura)\b|hauteur|hoogte|^高度?\s*(?:$|[(（\[])/i],
      // "Maße"/"Abmessungen"/"LxBxH" VOR dem Gewicht pruefen: "Masse (LxBxH)" ist eine
      // Massspalte, "Masse (kg)" bleibt Gewicht. Das nackte "Maße" (mit ß) ist eindeutig
      // eine Massspalte; das nackte "Masse" bleibt beim Gewicht.
      ["dims", /abmessung|dimensions?\b|^maße$|ma(?:ß|ss)e\s*\(\s*(?:mm|cm|m\b|lxbxh|l\s*[x×])|l\s*[x×]\s*b\s*[x×]\s*h|lxbxh|dimensiones|dimens[oõ]es|\bmedidas\b|afmetingen|^maten\b|尺寸|规格/i],
      ["weight", /gewicht|weight|^kg$|kg\/|masse\b|brutto|netto|\bpeso\b|poids|重量|毛重|净重/i],
      ["stackable", /stapel|stack|apilable|remontable|gerbable|empilable|empilh|堆叠|堆放|叠放/i],
      // Bewusst NICHT dabei: "Referencia", "Référence", "Article" -- das ist meist die
      // Artikelnummer, und die erste passende Spalte gewinnt den Namen.
      ["name", /bezeichnung|artikel|beschreibung|name|description|item|ware|inhalt|position|descripci[oó]n|art[ií]culo|producto|mercanc[ií]a|\bnombre\b|d[eé]signation|produit|marchandise|libell[eé]|omschrijving|\bnaam\b|goederen|^bulto$|descri[cç][aã]o|produto|mercadoria|\bnome\b|品名|名称|货物|描述/i]
    ];
    // Eine Kopfzelle, die ZWEI der drei Kanten nennt ("Länge x Breite x Höhe", "Medidas
    // (largo x ancho x alto)"), ist die kombinierte Mass-Spalte -- nicht die Laenge. Vorher
    // griff sich die Laengen-Regel solche Spalten, und jede Zeile der Liste fiel weg.
    const kanten = (c) => ["l", "w", "h"].filter((k) => KEYS.find(([n]) => n === k)[1].test(c)).length;
    const isNumCell = (c) => Number.isFinite(toNumDE(c));
    // Kopfzeile: >= 2 Keyword-Treffer UND < 2 reine Zahlen in Zeile 0.
    const head = grid[0] || [];
    const kwHits = head.filter((c) => KEYS.some(([, re]) => re.test(c))).length;
    const hasHeader = kwHits >= 2 && head.filter(isNumCell).length < 2;
    const map = {}, unitF = {};
    if (hasHeader) {
      head.forEach((c, i) => {
        // Franzoesisch schreibt "L | l | H": grosses L = longueur, kleines l = largeur. Ohne
        // diese Lesart blieb die Breite leer, und die Beispiel-Liste der franzoesischen
        // Startseite kam im Rechner als "nichts erkannt" an.
        if (c === "l" && map.l !== void 0 && map.w === void 0) { map.w = i; return; }
        for (const [k, re] of map.dims === void 0 && kanten(c) >= 2 ? [["dims", /(?:)/]] : KEYS) {
          if (map[k] === void 0 && re.test(c)) { // erster Treffer gewinnt (z. B. Brutto vor Netto)
            map[k] = i;
            if (k === "l" || k === "w" || k === "h" || k === "dims") {
              if (/mm|millim|mil[ií]m|毫米/i.test(c)) unitF[i] = 0.1;
              // Ausdruecklich cm (bzw. kg) heisst Faktor 1 -- und nicht "keine Angabe": sonst
              // griffe die Grundeinheit der Oberflaeche (mm, Zoll) auf eine Spalte, die ihre
              // Einheit selbst nennt.
              else if (/cm|centim|cent[ií]m|厘米/i.test(c)) unitF[i] = 1;
              // Zoll nur, wenn es als EINHEIT dasteht -- "(in)", "inch", "Zoll", Zollzeichen.
              // Ein blankes "in" waere auch das deutsche/englische Wort ("Laenge in cm").
              else if (/[(\[]\s*in(?:ch(?:es)?)?\.?\s*[)\]]|\binch(?:es)?\b|\bzoll\b|["\u2033]|\bpulgadas?\b|\bpulg\b|\bpouces?\b|\bpolegadas?\b|英寸/i.test(c)) unitF[i] = ZOLL;
              else if (/\bm\b|\(m\)|\b(?:meters?|metros?|m[eè]tres?)\b|[(（]\s*米\s*[)）]/i.test(c)) unitF[i] = 100;
            } else if (k === "weight") {
              if (/\bt\b|tonnen|toneladas?|tonnes?|吨/i.test(c)) unitF[i] = 1e3;
              else if (/\blbs?\b|pounds?|pfund|libras?|磅/i.test(c)) unitF[i] = PFUND;
              else if (/\bkg\b|kilo|quilo|公斤|千克/i.test(c)) unitF[i] = 1;
            }
            break;
          }
        }
      });
    } else {
      // Positional aus der ersten Datenzeile: erste nicht-numerische Spalte = name;
      // eine Zelle mit Dreierkette ("120x80x95") = kombinierte Massspalte; numerische
      // Spalten in Reihenfolge = qty,l,w,h,weight (nur 4: l,w,h,weight; nur 3: l,w,h).
      const first = grid[0] || [];
      const numsIdx = [];
      first.forEach((c, i) => {
        // Kette VOR der Zahlpruefung: parseFloat("120x80x95") liefert 120, die Zelle
        // saehe sonst wie eine gewoehnliche Zahl aus.
        if (map.dims === void 0 && KETTE.test(c)) map.dims = i;
        else if (isNumCell(c)) numsIdx.push(i);
        else if (map.name === void 0 && c) map.name = i;
      });
      let roles;
      if (map.dims !== void 0) roles = numsIdx.length >= 2 ? ["qty", "weight"] : ["qty"];
      else if (numsIdx.length >= 5) {
        // Ohne Kopfzeile ist die Reihenfolge geraten. Zwei uebliche Layouts werden
        // gegeneinander abgewogen: Stueckzahl vorn (Standard) oder Stueckzahl hinter den
        // Massen. Es gewinnt die Zuordnung, unter der mehr Zeilen plausibel sind --
        // Kanten zwischen 5 und 1450 cm, Stueckzahl eine ganze Zahl bis 5000. Eine
        // 4-cm-"Hoehe" neben 120 "Stueck" ist fast immer die vertauschte Lesart.
        const A = ["qty", "l", "w", "h", "weight"], B = ["l", "w", "h", "qty", "weight"];
        const punkte = (r) => {
          let p = 0;
          for (const cells of grid.slice(0, 10)) {
            const v = {};
            r.forEach((k, j) => { v[k] = toNumDE(cells[numsIdx[j]]); });
            if ([v.l, v.w, v.h].every((d) => d >= 5 && d <= 1450) && Number.isInteger(v.qty) && v.qty >= 1 && v.qty <= 5e3) p++;
          }
          return p;
        };
        roles = punkte(B) > punkte(A) ? B : A;
      } else roles = numsIdx.length === 4 ? ["l", "w", "h", "weight"] : ["l", "w", "h"];
      roles.forEach((k, j) => { if (numsIdx[j] !== void 0) map[k] = numsIdx[j]; });
    }
    // Zweizeiliger Excel-Kopf: unter den Spaltennamen steht eine eigene Zeile nur mit
    // Einheiten ("mm  mm  mm  kg"). Sie ist keine Datenzeile -- sie belegt die Einheiten
    // je Spalte und wird uebersprungen. Ohne diese Lesart wurde die Zeile still verworfen
    // und eine mm-Liste als cm gelesen: aus dem Motorblock wurde ein 12-Meter-Klotz.
    let einheitenZeile = false;
    if (hasHeader && grid[1]) {
      const belegt = grid[1].filter((c) => c !== "");
      const istEinheit = (c) => /^\(?\s*(mm|cm|m|in|inch|inches|kg|lbs?|to?|stk\.?|stück|pcs|uds?\.?|unid\.?|pzas?\.?|stuks?|pi[eè]ces?|个|件)\s*\)?$/i.test(c);
      if (belegt.length && belegt.every(istEinheit) && belegt.some((c) => /mm|cm|^\(?\s*(m|in|inch|inches)\s*\)?$/i.test(c))) {
        einheitenZeile = true;
        grid[1].forEach((c, i) => {
          if (i === map.l || i === map.w || i === map.h || i === map.dims) {
            if (/mm/i.test(c)) unitF[i] = 0.1;
            else if (/cm/i.test(c)) unitF[i] = 1;
            else if (/^\(?\s*m\s*\)?$/i.test(c)) unitF[i] = 100;
            else if (/^\(?\s*in(ch(es)?)?\s*\)?$/i.test(c)) unitF[i] = ZOLL;
          } else if (i === map.weight && /^\(?\s*(t|to)\s*\)?$/i.test(c)) unitF[i] = 1e3;
          else if (i === map.weight && /^\(?\s*lbs?\s*\)?$/i.test(c)) unitF[i] = PFUND;
          else if (i === map.weight && /^\(?\s*kg\s*\)?$/i.test(c)) unitF[i] = 1;
        });
      }
    }
    // "Gesamtgewicht"/"Total" meint die ganze Position, nicht das Stueck -- sonst wiegt
    // jeder von 20 Kartons die kompletten 240 kg.
    const gewichtGesamt = hasHeader && map.weight !== void 0 && /gesamt|tota+l|总/i.test(head[map.weight]);
    // Angeforderte Grundeinheit (mm-Vorschlag aus dem Import-Dialog): gilt nur fuer
    // Massspalten OHNE eigene Einheit im Kopf -- beschriftete Spalten wissen es besser.
    // "in" ist die Eingabe-Einheit Zoll der Oberflaeche -- dort heissen Gewichte ohne
    // eigene Einheit Pfund.
    const grundF = opts.einheit === "mm" ? 0.1 : opts.einheit === "in" ? ZOLL : 0;
    const grundG = opts.einheit === "in" ? PFUND : 0;
    const dataRows = hasHeader ? grid.slice(einheitenZeile ? 2 : 1) : grid;
    const out = [];
    let skipped = 0;
    for (const cells of dataRows) {
      const cell = (k) => map[k] === void 0 || cells[map[k]] === void 0 ? "" : cells[map[k]];
      const val = (k) => {
        const i = map[k];
        if (i === void 0) return NaN;
        let v = toNumDE(cells[i]);
        if (Number.isFinite(v)) {
          const f = unitF[i] || (k === "weight" ? grundG : k === "l" || k === "w" || k === "h" ? grundF : 0);
          if (f) v *= f;
          if (f === ZOLL) zoll = true;
          if (f === PFUND) pfund = true;
        }
        return v;
      };
      let zoll = false, pfund = false;
      let l = val("l"), w = val("w"), h = val("h");
      if (!(l > 0 && w > 0 && h > 0) && map.dims !== void 0) {
        const m = String(cell("dims")).match(KETTE);
        if (m) {
          l = toNumDE(m[1]); w = toNumDE(m[3]); h = toNumDE(m[5]);
          const u = (m[6] || m[4] || m[2] || "").toLowerCase();
          const f = u === "mm" ? 0.1 : u === "m" ? 100 : u === "cm" ? 1 : unitF[map.dims] || grundF || 1;
          l *= f; w *= f; h *= f;
          if (f === ZOLL) zoll = true;
        }
      }
      // Summenzeilen/Zwischenueberschriften ueberspringen statt abbrechen.
      if (!(l > 0) || !(w > 0) || !(h > 0)) { skipped++; continue; }
      let qty = Math.floor(toNumDE(cell("qty")));
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      let weight = val("weight");
      if (!Number.isFinite(weight) || weight < 0) weight = 0;
      if (gewichtGesamt && qty > 1) weight = weight / qty;
      let stackable = true;
      // Die Zelle sagt "nein" -- als Wort der Sprache oder ausgeschrieben ("no apilable",
      // "nicht stapelbar": das stand vorher als STAPELBAR in der Liste).
      const stapelZelle = map.stackable !== void 0 ? String(cell("stackable")).trim() : "";
      if (/^(nein|no|non|nee|n[aã]o|0|false|falso|faux|✗|x|否|不|不可|不能|不可以)$/i.test(stapelZelle) || IMPORT_WORT.nichtStapelbar.test(stapelZelle)) stackable = false;
      let name = String(cell("name") || "").replace(/\s+/g, " ").trim();
      if (!name) name = parserNamen(opts).pos || "Position";
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (name.length > 22) name = name.slice(0, 22);
      // Metrische Listen werden wie eh und je auf ganze cm und kg gerundet. Zoll und Pfund
      // NICHT: 48 Zoll sind 121,92 cm, und wer in Zoll arbeitet, soll danach wieder 48
      // lesen und nicht 48,03.
      const mass = (v) => Math.max(1, zoll ? r6(v) : Math.round(v));
      out.push({ qty, l: mass(l), w: mass(w), h: mass(h), weight: Math.max(0, pfund ? r6(weight) : Math.round(weight)), stackable, rotatable: true, name });
    }
    const cols = Object.entries(map).sort((a, b) => a[1] - b[1]).map(([k]) => k);
    LAST_TSV_MAP = { header: hasHeader, cols, skipped };
    return out;
  }
  function parseCargoText(text, opts) {
    opts = opts || {};
    const ZOLL = 2.54, PFUND = 0.45359237, r6 = (v) => Math.round(v * 1e6) / 1e6;
    // Verdachts-Meldung fuer den Import-Dialog, als Eigenschaft der Funktion statt als
    // neue Modul-Variable (die Quelltext-Tests schneiden parseCargoText einzeln aus).
    // mmVerdacht: JEDE Zeile hat eine Kante, die in kein Fahrzeug passt (>320 cm breit/
    // hoch oder >1400 cm lang), und keine Kante unter 100 -- das Muster einer mm-Liste,
    // die als cm gelesen wurde. Es wird NICHT still umgerechnet: der Dialog schlaegt es
    // vor, und erst opts.einheit="mm" rechnet um. Vorschlagen statt raten.
    parseCargoText.hinweis = null;
    const fertig = (rows) => {
      if (!opts.einheit && rows.length && rows.every((r) => (r.w > 320 || r.h > 320 || r.l > 1400) && Math.min(r.l, r.w, r.h) >= 100)) parseCargoText.hinweis = { mmVerdacht: true };
      return rows;
    };
    if (!text) return [];
    // TSV-Weiche: mindestens eine Zeile mit >= 2 Tabs => Excel-Copy-Paste.
    // Freitext enthaelt nie Tabs (Tastatureingabe/URL), daher kollisionsfrei.
    const isTSV = text.split(/\n/).some((ln) => (ln.match(/\t/g) || []).length >= 2);
    if (isTSV) return fertig(parseTSV(text, opts));
    // Semikolon-CSV: wer aus einer .csv-Datei statt aus Excel kopiert, hat Semikolons
    // statt Tabs. Erst ab drei Semikolons in JEDER Zeile -- der Freitext benutzt das
    // Semikolon als Positions-Trenner ("120x80x100; 60x40x30"), und der hat nie drei.
    //
    // "Der hat nie drei" stimmte nicht: VIER Positionen in einer Zeile haben drei
    // ("a; b; c; d") -- und genau so schreibt sie ein Link, eine Excel-Formel, ein
    // KI-Assistent. Bis 26.11.26 wurde daraus EINE Tabellenzeile mit Zufallswerten (aus
    // "16 Kisten 30x45x52 57kg; 16 ..." wurde eine Position mit 16 kg). Der Unterschied:
    // in einer CSV-Zeile steht die Masskette hoechstens EINMAL (eine Zelle "120x80x100"),
    // im Freitext in jeder Position. Zwei Ketten in einer Zeile -- oder lauter Paletten
    // ohne Masse ("11 Europaletten; 5 Industriepaletten; ...") -- heisst: Freitext.
    const csvZeilen = text.split(/\r?\n/).filter((ln) => ln.trim());
    const MASSKETTE = /\d\s*(?:mm|cm|m|zoll|inch(?:es)?|["″])?\s*[x×\*]\s*\d+(?:[.,]\d+)?\s*(?:mm|cm|m|zoll|inch(?:es)?|["″])?\s*[x×\*\/]\s*\d/i;
    const positionenZeile = (ln) => {
      const t = ln.split(/[;；]/).filter((x) => x.trim());
      return t.filter((x) => MASSKETTE.test(x)).length >= 2
        || (t.length >= 2 && t.every((x) => /^\s*\d+\s*[^\d\s]/.test(x) && PALLET_PRESETS.some((pp) => pp.re.test(x))));
    };
    if (csvZeilen.length && csvZeilen.every((ln) => (ln.match(/;/g) || []).length >= 3) && !csvZeilen.some(positionenZeile)) {
      return fertig(parseTSV(text.replace(/;/g, "\t"), opts));
    }
    LAST_TSV_MAP = null;
    const out = [];
    const toNum = toNumDE;
    // Masse OHNE Einheit: cm -- ausser die Oberflaeche steht auf mm oder Zoll ("in").
    const grundU = opts.einheit === "mm" ? "mm" : opts.einheit === "in" ? "inch" : "";
    const lines = text.split(/[\n;；]+/).map((x) => x.trim()).filter(Boolean);
    for (const line of lines) {
      const low = line.toLowerCase();
      let l = null, w = null, h = null, zoll = false, pfund = false;
      // Vier-Zahlen-Kette "N x L x B x H": erste Zahl ist die Anzahl (uebliche
      // Anfrage-Schreibweise "5x 120x80x100"). Muss VOR dem 3er-Match laufen,
      // sonst frisst der sich die ersten drei Zahlen. Erster Trenner bewusst
      // NUR [x×*] ohne "/" – sonst wuerde "120/80/100" als 3er-Kette mit Anzahl gelesen.
      // Die LETZTE Einheit einer Kette muss an einem Wortende stehen: bis 26.11.26 frass die
      // Kette das "m" des naechsten Wortes als Meter -- "5 Kisten 120x80x100 mit Deckel" waren
      // 12000 x 8000 x 10000 cm, ebenso "... Maschinenteile", "... machine parts", "... max".
      const dim4 = line.match(/(\d+)\s*[x×\*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)(?![a-zà-ÿ]))?/i);
      const dim = dim4 ? null : line.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)(?![a-zà-ÿ]))?/i);
      if (dim4) {
        l = toNum(dim4[2]);
        w = toNum(dim4[4]);
        h = toNum(dim4[6]);
        const u = (dim4[7] || dim4[5] || dim4[3] || "").toLowerCase() || grundU;
        if (u === "m") {
          l *= 100;
          w *= 100;
          h *= 100;
        } else if (u === "mm") {
          l /= 10;
          w /= 10;
          h /= 10;
        } else if (u && u !== "cm") {
          l *= ZOLL;
          w *= ZOLL;
          h *= ZOLL;
          zoll = true;
        }
      } else if (dim) {
        l = toNum(dim[1]);
        w = toNum(dim[3]);
        h = toNum(dim[5]);
        const u = (dim[6] || dim[4] || dim[2] || "").toLowerCase() || grundU;
        if (u === "m") {
          l *= 100;
          w *= 100;
          h *= 100;
        } else if (u === "mm") {
          l /= 10;
          w /= 10;
          h /= 10;
        } else if (u && u !== "cm") {
          l *= ZOLL;
          w *= ZOLL;
          h *= ZOLL;
          zoll = true;
        }
      }
      let pal = null;
      for (const p of PALLET_PRESETS) {
        if (p.re.test(line)) {
          pal = p;
          break;
        }
      }
      // Palette mit ZWEI Massen ("4 Paletten 120x80"): Grundmass aus der Zeile, Hoehe als
      // Standardwert -- vorher wurde die Zeile komplett verworfen, obwohl die Lesart
      // offensichtlich ist. Nur mit Paletten-Stichwort: eine nackte Zweierkette waere
      // sonst ein geratenes Packstueck ohne Hoehe. Das generische "Palette" (ohne Euro/
      // Industrie) zaehlt NUR mit Massen in der Zeile -- ohne sie waere das Grundmass
      // geraten, die Presets bringen ihres dagegen selbst mit.
      let dim2 = null;
      if (!dim4 && !dim && (pal || /\bpaletten?\b|\bpallets?\b|\bpalettes?\b|\bpalets?\b|\bpalés?(?![a-zà-ÿ])|\bpales\b|\btarimas?\b|\bpaletes?\b|托盘/i.test(low))) {
        dim2 = line.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*]\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)(?![a-zà-ÿ]))?(?!\s*[x×\*\/])/i);
      }
      // Beschriftete Masse ("Länge 320 Breite 145 Höhe 168"): die Prosa-Form ohne
      // x-Kette. Nur wenn alle drei Angaben da sind -- zwei plus Raten waere erfunden.
      let lbl = null;
      if (!dim4 && !dim && !pal && !dim2) {
        const teil = (re) => {
          const m = line.match(re);
          if (!m) return null;
          const v = toNum(m[1]), u = (m[2] || "").toLowerCase();
          return u === "m" ? v * 100 : u === "mm" ? v / 10 : v;
        };
        const L2 = teil(/(?:l(?:änge|aenge|ength)|\blargo|\blongitud|\blongueur|\blengte|\bcomprimento|长度?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m)(?![a-zà-ÿ]))?\b/i);
        const B2 = teil(/(?:breite|width|\banch(?:o|ura)|\blargeur|\bbreedte|\blargura|宽度?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m)(?![a-zà-ÿ]))?\b/i);
        const H2 = teil(/(?:h(?:öhe|oehe|eight)|\balt(?:o|ura)|\bhauteur|\bhoogte|高度?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m)(?![a-zà-ÿ]))?\b/i);
        if (L2 > 0 && B2 > 0 && H2 > 0) { lbl = true; l = L2; w = B2; h = H2; }
      }
      if (!dim4 && !dim && !pal && !dim2 && !lbl) continue;
      if (!dim4 && !dim && !lbl) {
        if (dim2) {
          l = toNum(dim2[1]);
          w = toNum(dim2[3]);
          const u2 = (dim2[4] || dim2[2] || "").toLowerCase() || grundU;
          if (u2 === "m") { l *= 100; w *= 100; }
          else if (u2 === "mm") { l /= 10; w /= 10; }
          else if (u2 && u2 !== "cm") { l *= ZOLL; w *= ZOLL; zoll = true; }
        } else {
          l = pal.l;
          w = pal.w;
        }
        h = 110;
        // Steht die Hoehe in Worten dabei ("Höhe 132cm", "95cm hoch"), schlaegt sie den
        // Standardwert -- eine genannte Zahl zu ignorieren waere schlechter als raten.
        // ("high" steht bewusst nicht da: "40 high cube" waere sonst eine Hoehe von 40 cm.)
        const hm = line.match(/(?:h(?:öhe|oehe|eight)|\balt(?:o|ura)|\bhauteur|\bhoogte|高度?)\s*[:：]?\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m)(?![a-zà-ÿ]))?\b|(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:hoch|hoog|de\s+alt(?:o|ura)|de\s+haut(?:eur)?)\b/i);
        if (hm) {
          const v = toNum(hm[1] || hm[3]), u3 = (hm[2] || hm[4] || "").toLowerCase();
          const cm = u3 === "m" ? v * 100 : u3 === "mm" ? v / 10 : v;
          if (cm > 0) h = cm;
        }
      }
      let qty = 1;
      if (dim4) {
        // Anzahl steht durch die Vier-Zahlen-Kette fest – qm/lead ueberspringen.
        qty = parseInt(dim4[1], 10);
      } else {
        // Menge NICHT in der Masskette suchen: "2,40 x 1,60" gab sonst die
        // Nachkommastellen als Stueckzahl her ("40 x" -> 40 Stueck).
        const rest = dim ? line.replace(dim[0], " ") : dim2 ? line.replace(dim2[0], " ") : line;
        const qm = rest.match(IMPORT_RE.menge);
        if (qm) qty = parseInt(qm[1], 10);
        else {
          const lead = rest.match(/^\s*(\d+)\b/);
          if (lead) qty = parseInt(lead[1], 10);
        }
      }
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      let weight = 0;
      const wm = line.match(IMPORT_RE.gewicht);
      if (wm) {
        weight = toNum(wm[1]);
        if (/^(t|to|tonn|吨)/i.test(wm[2])) weight *= 1e3;
        else if (/^(lb|pound|libra)/i.test(wm[2])) { weight *= PFUND; pfund = true; }
      }
      let stackable = true;
      if (IMPORT_WORT.nichtStapelbar.test(low)) stackable = false;
      // "stapelbar bis 180 cm" -- die Angabe, wie sie in Anfragen steht. Bewusst an ein
      // Schluesselwort gebunden (bis / max / up to / hasta / jusqu'à / tot) UND an eine Laengeneinheit: sonst
      // frisst der Ausdruck das Stueckgewicht ("max 100 kg") oder eine der Kantenlaengen.
      let stackH = null;
      const shm = line.match(IMPORT_RE.bis);
      if (shm && stackable) {
        const v = toNum(shm[1]), u = (shm[2] || "cm").toLowerCase();
        const cm = u === "m" ? v * 100 : u === "mm" ? v / 10 : v;
        if (cm > 0) stackH = Math.round(cm * 10) / 10;
      }
      let rotatable = true;
      if (IMPORT_WORT.nichtDrehbar.test(low)) rotatable = false;
      let name = (dim4 ? line.replace(dim4[0], "") : line.replace(/(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)?\s*[x×\*\/]\s*(\d+(?:[.,]\d+)?)\s*(?:(mm|cm|m|zoll|inch(?:es)?|pulgadas?|pouces?|polegadas?)(?![a-zà-ÿ]))?/i, "")).replace(IMPORT_RE.gewicht, "").replace(IMPORT_RE.stk, "").replace(IMPORT_RE.ware, "$2").replace(IMPORT_RE.bisWeg, "").replace(/nicht\s*stapelbar|stapelbar|non[-\s]?stackable|stackable|nicht\s*drehbar/ig, "").replace(IMPORT_WORT.wortWeg, "").replace(/\b(?:bis|max\.?|maximal|up\s*to)\b/ig, "").replace(/\b(?:m[aá]x\.?|m[aá]ximo|maximaal)\b/ig, "").replace(/^[\s,，、\-–|:：]+|[\s,，、\-–|:：]+$/g, "").replace(/^\s*\d+\s+/, "").replace(/\s+/g, " ").trim();
      if (dim2) name = name.replace(dim2[0], "").trim();
      // Fuellwoerter, die nach dem Herausschneiden von Gewicht und Menge uebrig bleiben
      // ("3 Kisten 1,2x0,8x1,1 m je 250 kg" -> "Kisten je"): weg damit.
      name = name.replace(/(?:^|\s)(?:je|à|each|c\/u|cada\s+u(?:n[oa]|ma?)|cada|chacune?|la\s+pi[eè]ce|l['’]unit[eé]|por\s+(?:unidade?|bulto|pieza|pe[cç]a|volume|item)|par\s+colis|per\s+stuk|per\s+collo)(?=\s|,|$)/ig, " ").replace(/\/\s*(?:st(?:ü|ue)ck|stk\.?|pc|piece|ud|unidade?|un|pza|pe[cç]a|pi[eè]ce|stuk|collo|colis)\b/ig, "").replace(/^pos\.?\s*\d+\s*[:.\-]?\s*/i, "").replace(/^[\s,，、\-–|:：]+|[\s,，、\-–|:：]+$/g, "").replace(/\s+/g, " ").trim();
      if (!name) { const NM = parserNamen(opts); name = pal ? pal.w === 80 ? NM.ep || "Europalette" : NM.pal || "Palette" : dim2 ? NM.pal || "Palette" : NM.pos || "Position"; }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      if (name.length > 22) name = name.slice(0, 22);
      // Zoll und Pfund bleiben genau (48 in = 121,92 cm), metrische Angaben werden wie
      // bisher auf ganze cm und kg gerundet -- siehe parseTSV.
      const mass = (v) => Math.max(1, zoll ? r6(v) : Math.round(v));
      out.push({ qty, l: mass(l), w: mass(w), h: mass(h), weight: Math.max(0, pfund ? r6(weight) : Math.round(weight)), stackable, stackH, rotatable, name });
    }
    fertig(out); // setzt nur den mm-Verdacht; das Ergebnis bleibt unangeruehrt
    return out;
  }
  var hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${a})`;
  };
  // ── Farbwaehler fuer das Export-BILD (Ansichtsbild/Share-Card), NICHT die Live-App ──
  // "standard" = Marken-Verlauf (Cyan->Blau). Weitere = optionaler Firmen-Akzent nur in der
  // exportierten PNG. Nur Akzent-Elemente (Auslastungs-%, Akzentlinie); Logo bleibt Marke.
  var EXPORT_ACCENTS = {
    standard: null,
    blau: "#0057a3",
    rot: "#c8102e"
  };
  // Zweiter Gradient-Stop: leicht abgedunkelt, ohne neue Farblogik/Bibliothek.
  var shade = (hex, pct) => {
    const n = parseInt(hex.slice(1), 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp((n >> 16 & 255) * (1 + pct));
    const g = clamp((n >> 8 & 255) * (1 + pct));
    const b = clamp((n & 255) * (1 + pct));
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  // Liefert die zwei Verlaufs-Stops fuer den Export-Akzent. hex == null -> Marken-Verlauf.
  // Standard war frueher ein Verlauf aus zwei Markentoenen (Tuerkis -> Blau). Seit das
  // Produkt nur noch EINEN Akzent hat, waeren beide Stopps identisch — ein Verlauf ohne
  // Verlauf. Stattdessen dieselbe Regel wie bei selbst gewaehlten Farben: Akzent und
  // abgedunkelter Akzent. Das gibt dem Export-Bild Tiefe ohne zweite Markenfarbe.
  var exportAccentStops = (hex) => { const base = hex || "#2E8FFF"; return [base, shade(base, -0.22)]; };
  // maxSpots (optional): so viele Stellplaetze braucht der Aufrufer HOECHSTENS. Ohne den
  // Wert rechnet der Packer wie immer das echte Maximum aus. Mit ihm hoert er auf, sobald
  // die Zahl erreicht ist — das Ergebnis bleibt unter maxSpots exakt und darueber "mindestens
  // so viele", was der Aufrufer ohnehin nicht mehr unterscheiden kann.
  //
  // Grund: das Bodenraster wurde bisher IMMER vollstaendig aufgebaut, unabhaengig von der
  // Menge. Ein Packstueck von 3 mm Kante — beim Umschalten der Eingabe auf mm schnell
  // getippt — ergab auf einem 45' HC 3,5 Millionen Rechtecke und blockierte den Browser
  // fuenf bis zwoelf Sekunden lang fuer ein einziges Teil.
  function makeFloorPacker(l, w, rotatable, maxSpots) {
    const memo = /* @__PURE__ */ new Map();
    const LIMIT = maxSpots > 0 ? maxSpots : Infinity;
    const grid = (a, b, pl, pw) => {
      const nx = Math.floor((a + 1e-6) / pl), nz = Math.floor((b + 1e-6) / pw);
      const r = [];
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        r.push({ x: i * pl, z: j * pw, dx: pl, dz: pw });
        if (r.length >= LIMIT) return r;
      }
      return r;
    };
    const cands = (D) => {
      const s = /* @__PURE__ */ new Set();
      for (let k = l; k < D; k += l) s.add(k);
      if (rotatable) for (let k = w; k < D; k += w) s.add(k);
      return [...s].filter((v) => v <= D - Math.min(l, w) + 1e-6);
    };
    function solve(FL, FW) {
      const m = Math.min(l, w);
      if (FL < m - 1e-6 || FW < m - 1e-6) return { count: 0, rects: [], cuts: 0 };
      const key = FL.toFixed(1) + "x" + FW.toFixed(1);
      if (memo.has(key)) return memo.get(key);
      let best = { count: 0, rects: [], cuts: 0 };
      const grids = rotatable ? [grid(FL, FW, l, w), grid(FL, FW, w, l)] : [grid(FL, FW, l, w)];
      for (const g of grids) if (g.length > best.count) best = { count: g.length, rects: g, cuts: 0 };
      // Genug fuer den Aufrufer: das Zerteilen kann die Zahl nur noch weiter erhoehen,
      // und mehr als LIMIT wird nicht gebraucht.
      if (best.count >= LIMIT) { memo.set(key, best); return best; }
      if (best.count < 500) {
        // Ordnungs-Tiebreaker: bei GLEICHER Stueckzahl gewinnt die Loesung mit den
        // wenigsten Schnitten (ein reines Raster hat 0, jede Teilung zaehlt 1 dazu).
        // Wenige Schnitte heisst wenige geschlossene Baender statt Flickwerk --
        // gemeldet: 11 Stueck 120x80 im 20' standen quer und laengs verschachtelt,
        // obwohl dieselben 11 als "7 quer + 4 laengs" in zwei Reihen stehen koennen.
        // Die Stueckzahl entscheidet weiterhin ZUERST und bleibt unangetastet.
        for (const s of cands(FL)) {
          const A = solve(s, FW), B = solve(FL - s, FW);
          const n = A.count + B.count, c = A.cuts + B.cuts + 1;
          if (n > best.count || (n === best.count && n > 0 && c < best.cuts)) best = { count: n, cuts: c, rects: [...A.rects, ...B.rects.map((r) => ({ ...r, x: r.x + s }))] };
        }
        for (const t of cands(FW)) {
          const A = solve(FL, t), B = solve(FL, FW - t);
          const n = A.count + B.count, c = A.cuts + B.cuts + 1;
          if (n > best.count || (n === best.count && n > 0 && c < best.cuts)) best = { count: n, cuts: c, rects: [...A.rects, ...B.rects.map((r) => ({ ...r, z: r.z + t }))] };
        }
      }
      memo.set(key, best);
      return best;
    }
    return solve;
  }
  // === KARTON AUF PALETTE (Vorstufe vor dem Container-/LKW-Rechner) ===
  // Palettenhoehe 14,4 cm ist Norm fuer EUR wie Industrie. tare = Leergewicht,
  // payload = Tragfaehigkeit als Richtwert (real je Palettenqualitaet verschieden;
  // deshalb nur eine Deckelung mit ausgewiesenem Grund, keine Zusicherung).
  var PALLETS = {
    EUR: { l: 120, w: 80, h: 14.4, tare: 25, payload: 1500 },
    IND: { l: 120, w: 100, h: 14.4, tare: 30, payload: 1500 }
  };
  // Ein Kartontyp auf eine Palette. Bewusst NUR ein Typ: packCargo rechnet echte Lagen
  // ebenfalls nur im Einzeltyp-Pfad, und gemischte Kartons auf einer Palette sind die
  // Ausnahme. Rein geometrisch — kein Lagenverbund, keine Ladungssicherung.
  //
  // pal    {l,w,h,tare,payload}   Grundflaeche, Palettenhoehe, Leergewicht, Tragfaehigkeit
  // carton {l,w,h,weight,qty}     Kartonmasse cm, Gewicht kg, qty = GESAMTmenge
  // opts   maxTotalH  Gesamthoehe inkl. Palette (cm, 0 = unbegrenzt)
  //        over       zugelassener Ueberstand JE SEITE (cm, 0 = buendig)
  //        maxLayers  harte Lagenobergrenze (0 = keine)
  //        rotatable  Karton darf um 90 Grad gedreht werden
  //
  // Das Lagenmuster kommt aus makeFloorPacker — demselben Guillotine-Packer, der im
  // Container die Bodenlage legt. Er mischt Ausrichtungen (Kreuzverband); echte
  // Windmuehlenmuster sind nicht guillotine-schneidbar und entstehen daher nicht.
  function palletize(pal, carton, opts = {}) {
    const PL = num(pal && pal.l), PW = num(pal && pal.w), PH = num(pal && pal.h);
    const cl = num(carton && carton.l), cw = num(carton && carton.w), ch = num(carton && carton.h);
    const cwt = Math.max(0, num(carton && carton.weight));
    const total = Math.max(0, Math.floor(num(carton && carton.qty)));
    const tare = Math.max(0, num(pal && pal.tare));
    const over = Math.max(0, num(opts.over));
    const maxTotalH = num(opts.maxTotalH);
    const base = {
      perLayer: 0, rects: [], layers: 0, perPallet: 0, full: 0, rest: 0, restLayers: 0,
      pallets: 0, overL: 0, overW: 0, outL: PL, outW: PW, palH: PH, cartonH: ch,
      fullH: PH, restH: PH, fullKg: tare, restKg: tare, cap: null, totalCartons: total
    };
    if (PL <= 0 || PW <= 0 || cl <= 0 || cw <= 0 || ch <= 0) return base;

    // Lagenmuster auf der (ggf. um den Ueberstand vergroesserten) Flaeche.
    const fl = makeFloorPacker(cl, cw, carton.rotatable !== false)(PL + 2 * over, PW + 2 * over);
    const perLayer = fl.count;
    if (perLayer === 0) return { ...base, cap: "footprint" };

    // Tatsaechliche Ausdehnung des Musters, mittig auf die Palette gelegt. Der Ueberstand
    // ist damit gemessen, nicht angenommen: ein zugelassener, aber ungenutzter Ueberstand
    // erscheint nicht als Ueberstand.
    let ex = 0, ez = 0;
    for (const r of fl.rects) { ex = Math.max(ex, r.x + r.dx); ez = Math.max(ez, r.z + r.dz); }
    const overL = Math.max(0, (ex - PL) / 2), overW = Math.max(0, (ez - PW) / 2);
    const rects = fl.rects.map((r) => ({ ...r, x: r.x - overL, z: r.z - overW }));

    // Drei Grenzen; die kleinste bindet, und welche es war, wird ausgewiesen. Ohne diese
    // Angabe steht in der Oberflaeche eine Lagenzahl ohne Begruendung.
    const usableH = maxTotalH > 0 ? maxTotalH - PH : Infinity;
    const layH = usableH >= ch ? Math.floor((usableH + 1e-6) / ch) : 0;
    const payload = num(pal.payload) > 0 ? num(pal.payload) : Infinity;
    const layKg = cwt > 0 ? Math.floor((payload + 1e-6) / (perLayer * cwt)) : Infinity;
    const layCap = num(opts.maxLayers) > 0 ? Math.floor(num(opts.maxLayers)) : Infinity;
    let layers = Math.min(layH, layKg, layCap);
    if (!isFinite(layers)) layers = 1;
    layers = Math.max(0, layers);
    let cap = null;
    if (layers <= 0) cap = cwt > 0 && layKg <= 0 ? "weight" : "height";
    else if (layH === layers) cap = "height";
    else if (layKg === layers) cap = "weight";
    else if (layCap === layers) cap = "layers";

    const perPallet = perLayer * layers;
    if (perPallet <= 0) return { ...base, perLayer, rects, overL, overW, outL: Math.max(PL, ex), outW: Math.max(PW, ez), cap };

    const full = Math.floor(total / perPallet);
    const rest = total - full * perPallet;
    const restLayers = rest > 0 ? Math.ceil(rest / perLayer) : 0;
    return {
      perLayer, rects, layers, perPallet,
      full, rest, restLayers, pallets: full + (rest > 0 ? 1 : 0),
      overL, overW,
      // Aussenmasse: was der Container spaeter wirklich vorfindet — nicht das Palettenmass.
      outL: Math.max(PL, ex), outW: Math.max(PW, ez),
      palH: PH, cartonH: ch,
      fullH: PH + layers * ch,
      restH: PH + restLayers * ch,
      fullKg: tare + perPallet * cwt,
      restKg: tare + rest * cwt,
      cap, totalCartons: total
    };
  }
  // Mehrere Kartontypen. Zwei Betriebsarten, weil es an der Rampe zwei verschiedene
  // Vorgaenge sind:
  //   "separate" – jeder Typ auf eigene Paletten. Der haeufigere Fall.
  //   "layered"  – ein Stapel, aber JEDE LAGE gehoert genau einem Typ. So wird eine
  //                Mischpalette tatsaechlich gebaut: schwer und grossflaechig unten.
  //
  // Bewusst NICHT gebaut: Kartons verschiedener Groesse INNERHALB einer Lage verschachteln.
  // Das ergaebe Muster, die niemand nachbaut — und eine Zahl, der man an der Rampe nicht
  // folgen kann, ist schlechter als keine Zahl.
  //
  // Die Reihenfolge in `cartons` IST die Stapelreihenfolge: erster Eintrag unten.
  //
  // Rueckgabe: builds = die verschiedenen Palettenaufbauten, jeder mit seiner Stueckzahl.
  // Bei einem Typ und einer Restpalette sind das genau zwei — dieselbe Aussage wie bisher.
  function palletizeMulti(pal, cartons, opts = {}) {
    const mode = opts.mode === "layered" ? "layered" : "separate";
    const over = Math.max(0, num(opts.over));
    const maxTotalH = num(opts.maxTotalH);
    const PL = num(pal && pal.l), PW = num(pal && pal.w), PH = num(pal && pal.h);
    const tare = Math.max(0, num(pal && pal.tare));
    const payload = num(pal && pal.payload) > 0 ? num(pal.payload) : Infinity;

    const list = (cartons || []).map((c, ti) => ({
      ti, l: num(c.l), w: num(c.w), h: num(c.h),
      weight: Math.max(0, num(c.weight)), qty: Math.max(0, Math.floor(num(c.qty))),
      rotatable: c.rotatable !== false
    })).filter((c) => c.l > 0 && c.w > 0 && c.h > 0 && c.qty > 0);

    // Lagenmuster je Typ — derselbe Guillotine-Packer wie im Einzelfall.
    for (const c of list) {
      const fl = makeFloorPacker(c.l, c.w, c.rotatable)(PL + 2 * over, PW + 2 * over);
      c.perLayer = fl.count;
      let ex = 0, ez = 0;
      for (const r of fl.rects) { ex = Math.max(ex, r.x + r.dx); ez = Math.max(ez, r.z + r.dz); }
      c.overL = Math.max(0, (ex - PL) / 2);
      c.overW = Math.max(0, (ez - PW) / 2);
      c.rects = fl.rects.map((r) => ({ ...r, x: r.x - c.overL, z: r.z - c.overW }));
      c.outL = Math.max(PL, ex);
      c.outW = Math.max(PW, ez);
    }
    const noFit = list.filter((c) => !c.perLayer).map((c) => c.ti);
    const good = list.filter((c) => c.perLayer > 0);
    const types = {};
    for (const c of list) types[c.ti] = c;
    // Menge der Typen, die auf diese Palette in keiner Ausrichtung passen. Sie faellt
    // aus der Rechnung heraus, DARF aber nicht aus der Bilanz fallen: was nicht verladen
    // ist, ist uebrig. Sonst meldet das Tool eine Sendung als vollstaendig, die es nicht ist.
    const lostNoFit = list.filter((c) => !c.perLayer).reduce((s, c) => s + c.qty, 0);
    const base = { mode, builds: [], perType: [], types, totalPallets: 0, unplaced: 0, noFit };
    if (!good.length) return { ...base, unplaced: lostNoFit };

    const usableH = maxTotalH > 0 ? maxTotalH - PH : Infinity;
    const maxLay = num(opts.maxLayers) > 0 ? Math.floor(num(opts.maxLayers)) : Infinity;
    // Lagen eines Typs: volle Lagen und, wenn etwas uebrig bleibt, eine angebrochene.
    const layersOf = (c, total) => {
      const out = [];
      let left = total;
      while (left > 0) {
        const n = Math.min(c.perLayer, left);
        out.push({ ti: c.ti, count: n, h: c.h, kg: n * c.weight });
        left -= n;
      }
      return out;
    };

    if (mode === "separate") {
      const builds = [], perType = [];
      let unplaced = 0;
      for (const c of good) {
        const r = palletize(pal, { l: c.l, w: c.w, h: c.h, weight: c.weight, qty: c.qty, rotatable: c.rotatable }, opts);
        const placed = r.perPallet * r.full + r.rest;
        perType.push({ ti: c.ti, perLayer: r.perLayer, layers: r.layers, placed, total: c.qty, cap: r.cap });
        unplaced += c.qty - placed;
        if (r.full > 0) builds.push({ ti: c.ti, qty: r.full, rest: false, layers: layersOf(c, r.perPallet), totalH: r.fullH, totalKg: r.fullKg, outL: r.outL, outW: r.outW });
        if (r.rest > 0) builds.push({ ti: c.ti, qty: 1, rest: true, layers: layersOf(c, r.rest), totalH: r.restH, totalKg: r.restKg, outL: r.outL, outW: r.outW });
      }
      return { ...base, builds, perType, unplaced: unplaced + lostNoFit, totalPallets: builds.reduce((s, b) => s + b.qty, 0) };
    }

    // layered: alle Lagen in der Reihenfolge der Typen, dann der Reihe nach auf Paletten.
    // Eine Lage wird NICHT zwischen zwei Paletten geteilt — sie ist die kleinste Einheit,
    // die jemand am Stueck baut.
    const queue = [];
    for (const c of good) for (const L of layersOf(c, c.qty)) queue.push(L);
    const pallets = [];
    let curr = null, unplaced = 0;
    for (const L of queue) {
      if (L.h > usableH + 1e-6 || L.kg > payload + 1e-6) { unplaced += L.count; continue; }
      if (!curr) curr = { layers: [], h: 0, kg: 0 };
      if (curr.layers.length >= maxLay || curr.h + L.h > usableH + 1e-6 || curr.kg + L.kg > payload + 1e-6) {
        pallets.push(curr);
        curr = { layers: [], h: 0, kg: 0 };
      }
      curr.layers.push(L); curr.h += L.h; curr.kg += L.kg;
    }
    if (curr && curr.layers.length) pallets.push(curr);

    // Gleich aufgebaute Paletten zaehlen statt sie einzeln aufzulisten: In der Ladung
    // steht sonst dreissigmal dasselbe Packstueck.
    const byKey = /* @__PURE__ */ new Map();
    for (const pt of pallets) {
      const key = pt.layers.map((l) => l.ti + ":" + l.count).join("|");
      const seen = byKey.get(key);
      if (seen) { seen.qty++; continue; }
      byKey.set(key, {
        key, qty: 1, ti: null, rest: false, layers: pt.layers,
        totalH: PH + pt.h, totalKg: tare + pt.kg,
        outL: Math.max(PL, ...pt.layers.map((l) => types[l.ti].outL)),
        outW: Math.max(PW, ...pt.layers.map((l) => types[l.ti].outW))
      });
    }
    const builds = [...byKey.values()];
    // Die letzte, angebrochene Palette als solche kennzeichnen — sie ist die einzige,
    // die sich von den uebrigen unterscheidet.
    if (builds.length > 1) builds[builds.length - 1].rest = true;
    const placedBy = {};
    for (const pt of pallets) for (const l of pt.layers) placedBy[l.ti] = (placedBy[l.ti] || 0) + l.count;
    const perType = good.map((c) => ({ ti: c.ti, perLayer: c.perLayer, layers: Math.ceil(c.qty / c.perLayer), placed: placedBy[c.ti] || 0, total: c.qty, cap: null }));
    return { ...base, builds, perType, unplaced: unplaced + lostNoFit, totalPallets: pallets.length };
  }
  // Vorschlag fuer die Stapelreihenfolge: schwerste Lage nach unten. Das Lagengewicht
  // (Kartons je Lage x Stueckgewicht) ist dafuer das ehrlichere Mass als das Stueckgewicht —
  // viele leichte Kartons koennen eine schwerere Lage ergeben als wenige schwere.
  function layerOrder(pal, cartons, opts = {}) {
    const r = palletizeMulti(pal, cartons, { ...opts, mode: "separate" });
    const kgOf = (i) => {
      const t = r.types[i];
      return t && t.perLayer ? t.perLayer * t.weight : -1;
    };
    return cartons.map((c, i) => i).sort((a, b) => kgOf(b) - kgOf(a));
  }
  function emsContains(A, B) {
    return A.x <= B.x + 1e-6 && A.y <= B.y + 1e-6 && A.z <= B.z + 1e-6 && B.x + B.dx <= A.x + A.dx + 1e-6 && B.y + B.dy <= A.y + A.dy + 1e-6 && B.z + B.dz <= A.z + A.dz + 1e-6;
  }
  function emsPrune(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dx < 1e-6 || a.dy < 1e-6 || a.dz < 1e-6) continue;
      let dom = false;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        if (b.dx < 1e-6) continue;
        if (emsContains(b, a) && !(emsContains(a, b) && j < i)) {
          dom = true;
          break;
        }
      }
      if (!dom) out.push(a);
    }
    return out;
  }
  function emsOverlap(S, B) {
    return S.x < B.x + B.dx && B.x < S.x + S.dx && S.y < B.y + B.dy && B.y < S.y + S.dy && S.z < B.z + B.dz && B.z < S.z + S.dz;
  }
  function emsSplit(S, B) {
    const r = [];
    if (B.x > S.x) r.push({ x: S.x, y: S.y, z: S.z, dx: B.x - S.x, dy: S.dy, dz: S.dz });
    if (B.x + B.dx < S.x + S.dx) r.push({ x: B.x + B.dx, y: S.y, z: S.z, dx: S.x + S.dx - B.x - B.dx, dy: S.dy, dz: S.dz });
    if (B.y > S.y) r.push({ x: S.x, y: S.y, z: S.z, dx: S.dx, dy: B.y - S.y, dz: S.dz });
    if (B.y + B.dy < S.y + S.dy) r.push({ x: S.x, y: B.y + B.dy, z: S.z, dx: S.dx, dy: S.y + S.dy - B.y - B.dy, dz: S.dz });
    if (B.z > S.z) r.push({ x: S.x, y: S.y, z: S.z, dx: S.dx, dy: S.dy, dz: B.z - S.z });
    if (B.z + B.dz < S.z + S.dz) r.push({ x: S.x, y: S.y, z: B.z + B.dz, dx: S.dx, dy: S.dy, dz: S.z + S.dz - B.z - B.dz });
    return r;
  }
  function emsOris(it) {
    const o = [], s = /* @__PURE__ */ new Set();
    const add = (x, y, z) => {
      const k = `${x},${y},${z}`;
      if (!s.has(k)) {
        s.add(k);
        o.push([x, y, z]);
      }
    };
    add(it.l, it.h, it.w);
    if (it.rotatable) add(it.w, it.h, it.l);
    return o;
  }
  // Abstuetzung/Schwerkraft: eine Kiste bei py>0 braucht genug Auflageflaeche von den Kisten
  // direkt darunter (deren Oberkante == py). Verhindert schwebende Kisten / grosse Ueberhaenge –
  // rein geometrisch, keine echte Physik/Sicherung. SUPPORT_MIN = geforderter Anteil der Grundflaeche.
  var SUPPORT_MIN = 0.7;
  // Die zweite Haelfte derselben Regel: KEIN UEBERSTAND ueber den Unterbau.
  //
  // Ein Flaechenanteil sagt, WIE VIEL getragen wird -- nicht, WO das Fehlende liegt. Und genau
  // darauf kommt es an: 30 % fehlende Auflage mitten unter der Kiste (zwei Paletten mit einer
  // Luecke dazwischen) ist eine Bruecke und in Ordnung. Dieselben 30 % an EINER KANTE sind ein
  // laengeres Packstueck, das ueber ein kuerzeres hinausragt und in der Luft endet. Das kippt,
  // laesst sich nicht sichern, und niemand baut es so -- genau so gemeldet, mit Bild.
  //
  // Geprueft wird deshalb zusaetzlich der Umriss dessen, was traegt: keine Kante der neuen Kiste
  // darf weiter als OVERHANG_MAX ueber die Huelle ihrer Traeger hinausstehen.
  var OVERHANG_MAX = 0;
  var MANUAL_NUDGE = 10; // cm – Feinjustier-Schrittweite fuer eine ausgewaehlte, manuell platzierte Kiste
  var SNAP_TOL = 25; // cm – Fangradius fuer das Andocken an die Kante einer Nachbarkiste beim Platzieren
  // Stapel-Obergrenze eines Packstuecks in GESAMT-Lagen (wie hoch der eigene Turm werden darf):
  //   nicht stapelbar -> 1, "frei stapelbar" -> Infinity, sonst die gewaehlte Zahl (2 = zwei
  //   uebereinander, 3 = drei, ...). Getragen vom Feld item.stackMax; fehlt es, gilt "frei".
  //   Bewusst hier (zwischen SUPPORT_MIN und emsPackOnce) definiert, damit sowohl der Auto-Packer
  //   als auch manualCandidate es sehen – und beide Test-Slices es mit-extrahieren.
  function stackCapOf(t) {
    if (t.stackable === false) return 1;
    var m = +t.stackMax;
    return m >= 2 && isFinite(m) ? m : Infinity;
  }
  // Die ZWEITE Stapelgrenze: wie hoch der Turm ueber dem Containerboden werden darf, in cm.
  //
  // Warum es die braucht, obwohl es stackMax schon gibt: an der Rampe wird nicht in Lagen
  // gedacht, sondern in Zentimetern -- "stapelbar bis 180 cm". Eine Lagenzahl ist dafuer nur
  // eine Naeherung, und zwar eine, die sich nicht zusammensetzen laesst. Bei Paletten von 42
  // bis 49 cm Bauhoehe rechnet man sich aus: unter 45 cm gehen vier, darueber nur drei. Stehen
  // dann eine flache unten und drei hohe darauf, sind es vier Lagen (jede Grenze fuer sich
  // eingehalten) und 184 cm (die eigentliche Grenze gerissen). Genau so gemeldet.
  //
  // Gemessen wird ab dem Containerboden, nicht ab dem Stueck: "bis 180 cm" ist eine Angabe
  // ueber den fertigen Stapel im Container, so wie sie in der Anfrage steht.
  function stackHOf(t) {
    var h = t ? +t.stackH : NaN;
    return h > 0 && isFinite(h) ? h : Infinity;
  }
  // Umkehrung fuer die UI: aktueller Zustand eines Packstuecks -> Auswahlwert des Stapel-Selectors.
  // "x1"/"x2"/"x3" = 1/2/3 zusaetzliche Lagen obendrauf (also 2/3/4 hoch gesamt),
  // "h" = Grenze in Zentimetern statt in Lagen.
  function stackModeOf(c) {
    if (c && c.stackable === false) return "no";
    if (c && isFinite(+c.stackH) && +c.stackH > 0) return "h";
    var m = c ? +c.stackMax : NaN;
    if (!(m >= 2 && isFinite(m))) return "free";
    return m <= 2 ? "x1" : m === 3 ? "x2" : "x3";
  }
  // Rastet eine Achsen-Koordinate an die naeheste Kante in "edges" ein, wenn sie innerhalb von "tol"
  // liegt (linke ODER rechte Kante der neuen Box gegen jede Nachbarkante) – sonst unveraendert.
  // Macht das "buendig danebenstellen" so leicht wie das bereits bestehende Klemmen an die Wand.
  function snapAxis(origin, size, edges, tol) {
    let best = origin, bestDist = tol;
    for (const e of edges) {
      const dLeft = Math.abs(origin - e);
      if (dLeft < bestDist) { bestDist = dLeft; best = e; }
      const dRight = Math.abs(origin + size - e);
      if (dRight < bestDist) { bestDist = dRight; best = e - size; }
    }
    return best;
  }
  // Beide Haelften der Abstuetz-Regel in EINEM Durchgang ueber die Kisten darunter: genug
  // Auflageflaeche (SUPPORT_MIN) UND kein Ueberstand ueber den Umriss der Traeger (OVERHANG_MAX).
  // Ein Durchgang, weil das hier die heisseste Schleife des Packers ist.
  function supportOk(px, pz, dx, dz, py, placed) {
    if (py <= 1e-4) return true; // steht auf dem Boden
    const base = dx * dz;
    if (base <= 0) return true;
    let sup = 0, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of placed) {
      if (Math.abs(b.y + b.dy - py) > 1e-3) continue; // nur direkt darunterliegende Oberkanten
      const ox = Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x);
      if (ox <= 0) continue;
      const oz = Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z);
      if (oz <= 0) continue;
      sup += ox * oz;
      if (b.x < x0) x0 = b.x;
      if (b.x + b.dx > x1) x1 = b.x + b.dx;
      if (b.z < z0) z0 = b.z;
      if (b.z + b.dz > z1) z1 = b.z + b.dz;
    }
    if (sup < base * SUPPORT_MIN - 1e-6) return false;
    const tol = OVERHANG_MAX + 1e-6;
    return px >= x0 - tol && px + dx <= x1 + tol && pz >= z0 - tol && pz + dz <= z1 + tol;
  }
  // ── Manuelles Platzieren (Slice 2): reine Geometrie-Helfer, vom UI-State entkoppelt und
  // node-testbar. Nutzt dieselbe Abstuetz-Regel (SUPPORT_MIN) wie der Auto-Packer, damit eine
  // Kiste beim manuellen Ablegen niemals schwebt – der Nutzer waehlt nur x/z per Klick, die Hoehe
  // "faellt" auf die niedrigste ausreichend tragende Ebene (Boden oder Oberkante darunter). ──
  function boxesOverlap(a, b) {
    const EPS = 1e-6;
    return a.x < b.x + b.dx - EPS && a.x + a.dx > b.x + EPS &&
      a.y < b.y + b.dy - EPS && a.y + a.dy > b.y + EPS &&
      a.z < b.z + b.dz - EPS && a.z + a.dz > b.z + EPS;
  }
  function withinBounds(container, box) {
    return box.x >= -1e-6 && box.z >= -1e-6 && box.y >= -1e-6 &&
      box.x + box.dx <= num(container.l) + 1e-6 &&
      box.z + box.dz <= num(container.w) + 1e-6 &&
      box.y + box.dy <= num(container.h) + 1e-6;
  }
  // Kandidaten-Auflagehoehen = Boden + alle Oberkanten, die die x/z-Grundflaeche ueberhaupt
  // beruehren; die niedrigste davon mit ausreichender Auflage (und ohne 3D-Ueberlappung) gewinnt.
  function dropHeight(px, pz, dx, dz, dy, placed) {
    const levels = new Set([0]);
    for (const b of placed) {
      const ox = Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x);
      if (ox <= 0) continue;
      const oz = Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z);
      if (oz <= 0) continue;
      levels.add(b.y + b.dy);
    }
    const sorted = [...levels].sort((a, b) => a - b);
    for (const y of sorted) {
      if (!supportOk(px, pz, dx, dz, y, placed)) continue;
      const cand = { x: px, y, z: pz, dx, dy, dz };
      if (placed.some((b) => boxesOverlap(cand, b))) continue;
      return y;
    }
    return null;
  }
  // Baut/prueft eine vollstaendige Platzierung fuer "item" (aus cargo) an (px,pz), inkl. Rotation,
  // Container-Grenzen, Stapelbarkeit und Zuladung. px/pz werden auf gueltigen Bereich geklemmt.
  // Zaehlt, wie viele Stuecke an dieser Stelle unmittelbar untereinanderstehen -- das neue
  // Stueck eingerechnet. Das ist die Zahl, die stackMax begrenzt.
  //
  // Dieselbe Regel wie im Auto-Packer (emsPackOnce fuehrt sie beim Platzieren als b.pos mit,
  // was dort billiger ist). Beide MUESSEN dasselbe ergeben, sonst verhaelt sich Ziehen von
  // Hand anders als automatisches Packen -- test/stackmax-manuell.test.mjs prueft das.
  //
  // Nicht die absolute Hoehe im Container: sonst koennte eine flache Kiste nie auf einer
  // hohen stehen, weil deren Hoehe die Grenze schon aufbraucht.
  //
  // Und ausdruecklich OHNE Ruecksicht auf die Bauhoehe der Stuecke darunter. Frueher zaehlte
  // nur mit, was genau gleich hoch war -- ein Behelf fuer "gleiche Sorte". Bei Paletten von
  // 41 bis 52 cm, jede einzeln erfasst, war keine zwei gleich hoch: der Turm blieb bei 1 und
  // die Grenze griff nie. stackMax ist eine Tragfaehigkeit; was obendrauf steht, ist ihr egal.
  function towerAt(px, pz, dx, dz, dy, y, placed) {
    let n = 1, cur = y;
    for (let guard = 0; guard <= placed.length; guard++) {
      const below = placed.find((b) =>
        Math.abs(b.y + b.dy - cur) < 1e-3 &&
        Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x) > 1e-6 &&
        Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z) > 1e-6);
      if (!below) break;
      n++;
      cur = below.y;
    }
    return n;
  }
  // Kleinste Hoehengrenze in dieser Saeule -- die eigene und die jedes Stueckes darunter.
  // Gegenstueck zu hlim in emsPackOnce; beide muessen dasselbe ergeben, sonst verhaelt sich
  // Ziehen von Hand anders als automatisches Packen.
  function towerHLimit(px, pz, dx, dz, y, placed, cargo, item) {
    let grenze = stackHOf(item), cur = y;
    for (let guard = 0; guard <= placed.length; guard++) {
      const below = placed.find((b) =>
        Math.abs(b.y + b.dy - cur) < 1e-3 &&
        Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x) > 1e-6 &&
        Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z) > 1e-6);
      if (!below) break;
      const it = cargo && cargo[below.ti];
      if (it) grenze = Math.min(grenze, stackHOf(it));
      cur = below.y;
    }
    return grenze;
  }
  // Kleinste Lagengrenze in dieser Saeule -- wie weit die Stuecke DARUNTER tragen.
  // Gegenstueck zu lim in emsPackOnce; beide muessen dasselbe ergeben, sonst verhaelt sich
  // Ziehen von Hand anders als automatisches Packen (test/stackmax-manuell.test.mjs).
  //
  // Vorher stand hier nur die eigene Tragfaehigkeit des gezogenen Stueckes gegen die Turmhoehe.
  // Bei gleicher Ware kommt dasselbe heraus; bei gemischter Ladung ist es die falsche Zahl --
  // was ich tragen kann, sagt nichts darueber, was UNTER mir aushaelt. Ein nicht stapelbares
  // Stueck (stackCapOf = 1) macht damit seine Oberseite auch von Hand dicht.
  function towerCapLimit(px, pz, dx, dz, y, placed, cargo, item) {
    const saeule = [];
    let cur = y;
    for (let guard = 0; guard <= placed.length; guard++) {
      const below = placed.find((b) =>
        Math.abs(b.y + b.dy - cur) < 1e-3 &&
        Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x) > 1e-6 &&
        Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z) > 1e-6);
      if (!below) break;
      saeule.push(below);
      cur = below.y;
    }
    let grenze = Infinity;
    for (let i = 0; i < saeule.length; i++) {
      // Ohne Ladungsliste (oder bei unbekanntem ti) bleibt nur die Annahme, dass unter mir
      // dieselbe Ware steht -- genau die Rechnung, die hier vorher fuer alle galt.
      const it = (cargo && cargo[saeule[i].ti]) || item;
      const cap = it ? stackCapOf(it) : Infinity;
      if (!isFinite(cap)) continue;
      const lage = saeule.length - i;   // saeule[0] ist direkt unter mir, das letzte steht am Boden
      grenze = Math.min(grenze, lage + cap - 1);
    }
    return grenze;
  }
  function manualCandidate(container, item, rotated, px, pz, placed, weightUsed, cargo) {
    const l = num(item.l), w = num(item.w), h = num(item.h);
    const dx = rotated ? w : l, dz = rotated ? l : w, dy = h;
    if (dx <= 0 || dz <= 0 || dy <= 0) return { ok: false, reason: "dims" };
    const CL = num(container.l), CW = num(container.w);
    if (dx > CL + 1e-6 || dz > CW + 1e-6) return { ok: false, reason: "toobig" };
    px = Math.max(0, Math.min(px, CL - dx));
    pz = Math.max(0, Math.min(pz, CW - dz));
    const payCap = num(container.payload);
    if (payCap > 0 && weightUsed + num(item.weight) > payCap + 1e-6) return { ok: false, reason: "weight" };
    if (item.stackable === false) {
      const cand = { x: px, y: 0, z: pz, dx, dy, dz };
      if (placed.some((b) => boxesOverlap(cand, b))) return { ok: false, reason: "overlap" };
      if (!withinBounds(container, cand)) return { ok: false, reason: "bounds" };
      return { ok: true, box: cand };
    }
    const y = dropHeight(px, pz, dx, dz, dy, placed);
    if (y == null) return { ok: false, reason: "overlap" };
    const capLim = towerCapLimit(px, pz, dx, dz, y, placed, cargo, item);
    if (isFinite(capLim) && y > 1e-4 && towerAt(px, pz, dx, dz, dy, y, placed) > capLim) return { ok: false, reason: "stackmax" };
    const hcap = towerHLimit(px, pz, dx, dz, y, placed, cargo, item);
    if (isFinite(hcap) && y + dy > hcap + 1e-6) return { ok: false, reason: "stackheight" };
    const cand = { x: px, y, z: pz, dx, dy, dz };
    if (!withinBounds(container, cand)) return { ok: false, reason: "bounds" };
    return { ok: true, box: cand };
  }
  // Wird eine bereits platzierte Kiste entfernt, verschoben oder gedreht, verlieren die Kisten
  // darueber ihre Auflage und wuerden sonst in der Luft stehen bleiben – im 3D-Bild sieht das aus,
  // als steckten die Packstuecke ineinander. settlePlaced laesst darum jede Kiste an ihrer x/z-Stelle
  // so weit absacken, wie die Abstuetz-Regel (SUPPORT_MIN) es zulaesst: von unten nach oben, damit
  // ganze Stapel geschlossen nachrutschen. Die Array-Reihenfolge bleibt erhalten, damit die Auswahl
  // (manualSel) auf dieselbe Kiste zeigt wie vorher.
  function settlePlaced(container, placed, cargo) {
    const out = new Array(placed.length);
    const done = [];
    const order = placed.map((_, i) => i).sort((a, b) => placed[a].y - placed[b].y || a - b);
    for (const i of order) {
      const b = placed[i];
      const item = cargo && cargo[b.ti];
      const y = item && item.stackable === false ? 0 : dropHeight(b.x, b.z, b.dx, b.dz, b.dy, done);
      const nb = { ...b, y: y == null ? b.y : y };
      out[i] = nb;
      done.push(nb);
    }
    return out;
  }
  // Haelt die manuell platzierten Stuecke mit der Ladungsliste in Deckung, waehrend sich Container
  // oder Ladung aendern. Wichtig: die Position einer Zeile im cargo-Array (ti) ist KEINE verlaessliche
  // Kennung – wird eine Zeile darueber geloescht, rutschen alle folgenden nach und ein platziertes
  // Stueck wuerde stillschweigend zur falschen Ware (Farbe, Gewicht, Name, Stapelbarkeit). Massgeblich
  // ist darum die stabile cargo-id (cid); ti wird daraus jedes Mal neu bestimmt. Entfernt werden
  // Stuecke, deren Ware es nicht mehr gibt, die ausserhalb der neuen Masse liegen oder die ueber der
  // eingegebenen Menge liegen. Bleibt alles gueltig, kommt dieselbe Array-Referenz zurueck (kein Re-Render).
  function remapPlaced(container, placed, cargo) {
    const byId = /* @__PURE__ */ new Map();
    (cargo || []).forEach((c, i) => { if (c && c.id != null) byId.set(c.id, i); });
    const counts = {};
    const next = [];
    let changed = false;
    for (const b of placed) {
      const ti = b.cid != null ? byId.has(b.cid) ? byId.get(b.cid) : -1 : b.ti;
      const item = ti >= 0 ? (cargo || [])[ti] : null;
      if (!item || !withinBounds(container, b)) {
        changed = true;
        continue;
      }
      counts[ti] = (counts[ti] || 0) + 1;
      if (counts[ti] > Math.max(0, Math.floor(num(item.qty)))) {
        changed = true;
        continue;
      }
      if (ti !== b.ti) {
        changed = true;
        next.push({ ...b, ti });
      } else next.push(b);
    }
    return changed ? next : placed;
  }
  // Die Mengengrenze gilt ueber ALLE Container, remapPlaced aber sieht immer nur einen.
  // Bei mehreren Containern (manueller Modus, Schritt 06) muss die Menge deshalb hinterher
  // einmal ueber die zusammengelegte Liste geprueft werden -- sonst stehen 22 Paletten in C1
  // UND 22 in C2, obwohl 22 eingegeben sind. Die Reihenfolge entscheidet, was bleibt: was
  // zuerst gesetzt wurde, bleibt stehen.
  function mengenGrenze(placed, cargo) {
    const counts = {};
    const out = [];
    for (const b of placed) {
      const item = (cargo || [])[b.ti];
      if (!item) continue;
      counts[b.ti] = (counts[b.ti] || 0) + 1;
      if (counts[b.ti] > Math.max(0, Math.floor(num(item.qty)))) continue;
      out.push(b);
    }
    return out.length === placed.length ? placed : out;
  }
  // Lage im Turm (pos) und die beiden Grenzen (lim in Lagen, hlim in cm), abgeleitet aus dem,
  // was schon unter der Kiste steht -- dieselbe Rechnung, die emsPackOnce beim Setzen inline
  // fuehrt (dort billiger, weil die Werte ohnehin gebraucht werden).
  //
  // Gebraucht wird sie fuer die VORBELEGUNG: Kisten, die schon stehen, bringen diese Angaben
  // nicht zwingend mit. Aus packCargo kommen sie mit, von Hand gesetzte nicht -- und ohne sie
  // faellt der Packer auf "keine Grenze" zurueck und stapelt auf ein nicht stapelbares Stueck.
  function grenzenAus(B, placed, t) {
    let pos = 1, lim = Infinity, hlim = Infinity;
    if (B.y > 1e-4) {
      let untenPos = 0, untenLim = Infinity, untenH = Infinity;
      for (const b of placed) {
        if (Math.abs(b.y + b.dy - B.y) > 1e-3) continue;
        const ox = Math.min(B.x + B.dx, b.x + b.dx) - Math.max(B.x, b.x);
        if (ox <= 1e-6) continue;
        const oz = Math.min(B.z + B.dz, b.z + b.dz) - Math.max(B.z, b.z);
        if (oz <= 1e-6) continue;
        untenPos = Math.max(untenPos, b.pos || 1);
        untenLim = Math.min(untenLim, b.lim === void 0 ? Infinity : b.lim);
        untenH = Math.min(untenH, b.hlim === void 0 ? Infinity : b.hlim);
      }
      pos = untenPos + 1;
      lim = untenLim;
      hlim = untenH;
    }
    if (t) {
      const hh = stackHOf(t);
      if (isFinite(hh)) hlim = Math.min(hlim, hh);
      const cap = stackCapOf(t);
      if (isFinite(cap)) lim = Math.min(lim, pos + cap - 1);
    }
    return { pos, lim, hlim };
  }
  // WEITERPACKEN AUF EINER VORBELEGUNG (opts.vorbelegt).
  //
  // Jeder Packlauf fing bisher beim leeren Container an. Zwei Dinge brauchen das Gegenteil:
  // eine Zuweisung, die "dort ZUERST" heisst (erst die gepinnte Ware, dann der Rest in den
  // Rest), und der manuelle Modus je Container (von Hand gesetzte Kisten sind nichts anderes
  // als eine Vorbelegung, auf der der Automat weitermachen soll).
  //
  // Umgesetzt ohne neue Datenstruktur: emsPackOnce zerteilt seinen einen freien Raum nach
  // JEDER gesetzten Kiste ohnehin. Dieselbe Schleife einmal vorab ueber die schon stehenden
  // Kisten gefahren ergibt genau den Startzustand -- freie Raeume um die Vorbelegung herum.
  //
  // Vertrag: die vorbelegten Kisten sind Hindernis, Auflage und Gewicht, aber sie kommen
  // NICHT im Ergebnis zurueck. "Pack das hier noch dazu" liefert, was dazukam -- der Aufrufer
  // haengt es an seine eigene Liste. Das Gewicht der Vorbelegung zieht packCargo vorher von
  // der Zuladung ab; emsPackOnce rechnet deshalb unveraendert weiter.
  // ZWEI ABKUERZUNGEN FUER GROSSE LADUNGEN -- beide aendern das Ergebnis nicht, nur die Zeit.
  //
  // Gemeldet am 23.11.26 (Nutzungsstatistik, Vietnam): 6 Positionen, 2.169 Packstuecke, und
  // der Rechner stand rund 40 Sekunden. Nachgemessen: 8 Millionen Auflage-Pruefungen, jede
  // ueber ALLE schon gesetzten Kisten (in einem 40' HC rund 900), und nach dem letzten Stueck,
  // das noch hineinging, wurde fuer jedes der ueber tausend uebrigen noch einmal der ganze
  // freie Raum abgesucht -- obwohl schon das erste derselben Sorte nicht mehr passte.
  //
  // (1) EBENEN-VERZEICHNIS. Auflage geben nur Kisten, deren Oberkante auf der Hoehe py liegt.
  //     `ebenen` fuehrt die gesetzten Kisten nach Oberkante (auf 1/1000 cm gerastert), in
  //     Setzreihenfolge. Gefragt wird damit nur noch die eine Ebene statt alle Kisten.
  //     supportOk und die Turm-Schleife pruefen die Hoehe weiterhin selbst (1e-3) -- sie
  //     bekommen nur eine kuerzere Liste. Liegt in einem Nachbar-Raster ebenfalls etwas
  //     (Hoehen, die sich um weniger als 3/1000 cm unterscheiden), gibt es die volle Liste:
  //     dann ist die Reihenfolge der Summanden dieselbe wie frueher, auf das letzte Bit.
  // (2) MERKER FUER STUECKE, DIE NICHT PASSEN. Gleiche Ware ist in `units` DASSELBE Objekt
  //     (emsSearch legt je Stueck denselben Typ-Eintrag ab). Findet ein Stueck keinen Platz,
  //     findet das naechste gleiche auch keinen, solange nichts dazugekommen ist:
  //       * `nie`     -- es passt in KEINEN freien Raum mehr hinein, schon nach den Massen.
  //                      Freie Raeume werden nur kleiner (zerteilt, ausgeduennt, gekappt),
  //                      das bleibt also fuer den Rest dieses Laufs so.
  //       * `vorerst` -- die Masse passten irgendwo, aber Auflage oder Stapelgrenze fehlten.
  //                      Das kann die naechste gesetzte Kiste aendern (neue Auflage), deshalb
  //                      gilt es nur bis zum naechsten Setzen.
  //
  // Vertrag: test/grossladung.test.mjs laesst diese Fassung gegen die alte (ohne beide
  // Abkuerzungen, aus derselben Datei gebaut) laufen und vergleicht jede Kiste.
  var EMS_LEER = [];
  function emsPackOnce(C2, units, order, pay, cap, vorbelegt) {
    let ems = [{ x: 0, y: 0, z: 0, dx: C2.l, dy: C2.h, dz: C2.w }];
    const placed = [];
    let weight = 0;
    const ebenen = /* @__PURE__ */ new Map();
    const ebeneRein = (b) => {
      const k = Math.round((b.y + b.dy) * 1e3);
      const l = ebenen.get(k);
      if (l) l.push(b); else ebenen.set(k, [b]);
    };
    const ebeneBei = (py) => {
      const k = Math.round(py * 1e3);
      if (ebenen.has(k - 1) || ebenen.has(k + 1) || ebenen.has(k - 2) || ebenen.has(k + 2)) return placed;
      return ebenen.get(k) || EMS_LEER;
    };
    const nie = /* @__PURE__ */ new Set(), vorerst = /* @__PURE__ */ new Set();
    const vorN = vorbelegt && vorbelegt.length ? vorbelegt.length : 0;
    if (vorN) {
      // Von unten nach oben, damit grenzenAus die Traeger schon kennt.
      for (const B of vorbelegt.slice().sort((a2, b2) => a2.y - b2.y)) {
        placed.push(B);
        ebeneRein(B);
        const next = [];
        for (const S of ems) {
          if (emsOverlap(S, B)) { for (const ns of emsSplit(S, B)) next.push(ns); } else next.push(S);
        }
        ems = emsPrune(next);
        if (ems.length > cap) ems = ems.slice(0, cap);
      }
    }
    for (const u of units) {
      if (nie.has(u) || vorerst.has(u)) continue;
      if (weight + u.weight > pay + 1e-6) continue;
      let best = null;
      // Die Ausrichtungen haengen nur am Stueck -- einmal je Stueck, nicht je freiem Raum.
      const oris = emsOris(u);
      // massPasst: gab es ueberhaupt einen freien Raum, in den das Stueck nach den Massen geht?
      // ebPy/ebListe: die Ebene der zuletzt gefragten Hoehe (viele Raeume teilen sich eine).
      let massPasst = false, ebPy = NaN, ebListe = EMS_LEER;
      for (const S of ems) {
        if (u.stackable === false && S.y > 1e-6) continue;
        for (const [dx, dy, dz] of oris) {
          if (dx <= S.dx + 1e-6 && dy <= S.dy + 1e-6 && dz <= S.dz + 1e-6) {
            massPasst = true;
            const px = S.x, py = S.y, pz = S.z;
            // Die Wertung haengt nur an der Lage -- sie steht fest, bevor irgendetwas geprueft
            // ist. Kann diese Stelle die bisher beste ohnehin nicht schlagen, sind Auflage und
            // Stapelgrenze egal: sie wuerde unten so oder so verworfen. (Dritte Abkuerzung,
            // gleiche Zusage: dasselbe Ergebnis. Die Verneinung steht woertlich da, damit
            // auch ein NaN genauso faellt wie im Vergleich am Ende.)
            let score;
            if (order === 0) score = py * 1e12 + px * 1e6 + pz;
            else if (order === 1) score = py * 1e12 + pz * 1e6 + px;
            else if (order === 2) score = px * 1e12 + py * 1e6 + pz;
            else score = py * 1e12 + (px + pz) * 1e6 + Math.min(S.dx - dx, S.dz - dz);
            if (best && !(score < best.score)) continue;
            if (py > 1e-4 && py !== ebPy) { ebPy = py; ebListe = ebeneBei(py); }
            if (py > 1e-4 && !supportOk(px, pz, dx, dz, py, ebListe)) continue; // nicht genug Auflage oder Ueberstand -> nicht schweben lassen
            // Stapel-Obergrenze. stackMax ist eine TRAGFAEHIGKEIT: "1x stapelbar" heisst,
            // dass auf dieses Stueck genau ein weiteres darf -- unabhaengig davon, WAS
            // daraufkommt und wie hoch es ueber dem Containerboden steht.
            //
            // Daraus folgen zwei Dinge, die beide gelten muessen:
            //   * Die Grenze zaehlt AB DEM STUECK SELBST nach oben, nicht ab dem
            //     Containerboden. Sonst blockiert eine hohe fremde Kiste am Boden schon
            //     die erste eigene Lage darueber (test/pack-stackmax-mixed.test.mjs).
            //   * Sie gilt fuer JEDES Stueck unter mir, nicht nur fuer meine eigene Sorte.
            //     Vorher zaehlte der Turm nur Stuecke GLEICHER BAUHOEHE mit -- ein Behelf
            //     fuer "gleiche Sorte". Bei 39 Paletten mit 41 bis 52 cm Hoehe, jede
            //     einzeln erfasst und jede "1x stapelbar", war keine zwei gleich hoch:
            //     der Turm blieb bei 1, die Grenze griff nie, und der Rechner stapelte
            //     fuenf hoch. Genau so gemeldet.
            //
            // Umgesetzt ohne Suche: jedes gesetzte Stueck traegt seine Lage im Turm (pos)
            // und die hoechste Lage, die sein Turm nach ALLEN Traegern darunter erreichen
            // darf (lim = min ueber pos + Tragfaehigkeit - 1). Beim Aufsetzen genuegt der
            // Vergleich mit dem unmittelbaren Untergrund.
            //
            // Die Hoehengrenze (stackH, "stapelbar bis 180 cm") laeuft genau parallel dazu,
            // nur in Zentimetern statt in Lagen: hlim ist die hoechste Oberkante, die der
            // Turm nach allen Stuecken darunter erreichen darf. Sie wird gebraucht, weil eine
            // Lagenzahl sich bei ungleich hohen Paletten nicht zusammensetzen laesst -- vier
            // Lagen aus 42 + 47 + 47 + 47 halten jede Einzelgrenze ein und sind trotzdem
            // 183 cm hoch.
            let pos = 1, lim = Infinity, hlim = Infinity;
            if (py > 1e-4) {
              let untenPos = 0, untenLim = Infinity, untenH = Infinity;
              for (const b of ebListe) {
                if (Math.abs(b.y + b.dy - py) > 1e-3) continue;
                const ox = Math.min(px + dx, b.x + b.dx) - Math.max(px, b.x);
                if (ox <= 1e-6) continue;
                const oz = Math.min(pz + dz, b.z + b.dz) - Math.max(pz, b.z);
                if (oz <= 1e-6) continue;
                untenPos = Math.max(untenPos, b.pos || 1);
                untenLim = Math.min(untenLim, b.lim === void 0 ? Infinity : b.lim);
                untenH = Math.min(untenH, b.hlim === void 0 ? Infinity : b.hlim);
              }
              pos = untenPos + 1;
              if (pos > untenLim) continue;   // eines der Stuecke darunter traegt nicht so viel
              lim = untenLim;
              hlim = untenH;
            }
            if (isFinite(u.stackH)) hlim = Math.min(hlim, u.stackH);
            if (py + dy > hlim + 1e-6) continue;   // der Turm wuerde zu hoch
            // "nicht stapelbar" heisst BEIDES: ich stehe auf nichts (die Pruefung oben,
            // S.y > 1e-6) UND auf mir steht nichts.
            //
            // Frueher galt nur die erste Haelfte -- ein nicht stapelbares Stueck durfte also
            // weiter tragen. Das war gegen die eigene Oberflaeche gerichtet: derselbe Selektor
            // bietet "nicht stapelbar / 1x stapelbar / 2x / 3x / bis 180 cm / frei stapelbar",
            // und jede andere Stufe darin begrenzt genau eine Sache -- was OBEN drauf darf.
            // Nur "nicht stapelbar" meinte etwas anderes. Auf dem Aufkleber am Packstueck
            // ("Stapelverbot", "do not stack") und im Ladevorschlag dieses Tools ("Nicht
            // stapelbare Positionen zuletzt bzw. oben verladen") heisst es ebenfalls: da kommt
            // nichts drauf. Genau so gemeldet -- 9 nicht stapelbare Stuecke, auf sechsen davon
            // standen zwei bis drei Paletten.
            //
            // Umgesetzt ohne Sonderweg: stackCapOf liefert fuer solche Stuecke bereits 1, also
            // ist ihre Tragfaehigkeit einfach ihr stackMax wie bei jedem anderen Stueck auch.
            // lim = pos heisst: ueber dieser Lage geht in dieser Saeule nichts mehr.
            const tragCap = u.stackMax;
            if (isFinite(tragCap)) lim = Math.min(lim, pos + tragCap - 1);
            if (!best || score < best.score) best = { px, py, pz, dx, dy, dz, score, pos, lim, hlim };
          }
        }
      }
      if (!best) { (massPasst ? vorerst : nie).add(u); continue; }
      const B = { x: best.px, y: best.py, z: best.pz, dx: best.dx, dy: best.dy, dz: best.dz };
      const gesetzt = { ...B, ti: u.ti, pos: best.pos, lim: best.lim, hlim: best.hlim };
      placed.push(gesetzt);
      ebeneRein(gesetzt);
      vorerst.clear();
      weight += u.weight;
      const next = [];
      for (const S of ems) {
        if (emsOverlap(S, B)) {
          for (const ns of emsSplit(S, B)) next.push(ns);
        } else next.push(S);
      }
      ems = emsPrune(next);
      if (ems.length > cap) ems = ems.slice(0, cap);
    }
    return { placed: vorN ? placed.slice(vorN) : placed, weight };
  }
  function emsShuffle(a, seed) {
    let s = seed >>> 0;
    const r = () => {
      s = s * 1103515245 + 12345 & 2147483647;
      return s / 2147483647;
    };
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  }
  function emsSearch(C2, items, pay, restarts, ordentlich, vorbelegt) {
    let units = [];
    items.forEach((t) => {
      for (let i = 0; i < t.qty; i++) units.push(t);
    });
    if (units.length > 1500) units = units.slice(0, 1500);
    // Kanonische Normalisierung: macht das Ergebnis unabhaengig von der Eingabe-Reihenfolge
    // der Typen (auch der Shuffle-Restarts, die sonst auf der Array-Ausgangslage variieren).
    units.sort((a, b) => (a.stackable === false ? 0 : 1) - (b.stackable === false ? 0 : 1) || b.l * b.w * b.h - a.l * a.w * a.h || b.l - a.l || b.w - a.w || b.h - a.h || b.weight - a.weight || a.ti - b.ti);
    const big = units.length;
    const cap = big > 200 ? 1500 : 3e3;
    // Nicht-stapelbare Boxen muessen auf den Boden -> als eingeschraenkteste zuerst platzieren.
    // Jede Basissortierung zusaetzlich in einer "nicht-stapelbar-zuerst"-Variante; emsSearch nimmt
    // das Beste aller Laeufe, daher nie schlechter, aber reihenfolge-unabhaengig bei Misch-Ladung.
    const byStack = (a, b) => (a.stackable === false ? 0 : 1) - (b.stackable === false ? 0 : 1);
    const baseKeys = [
      (a, b) => b.l * b.w * b.h - a.l * a.w * a.h,
      (a, b) => b.l * b.w - a.l * a.w,
      (a, b) => Math.max(b.l, b.w) - Math.max(a.l, a.w),
      (a, b) => b.h - a.h
    ];
    const allSorts = [];
    baseKeys.forEach((k) => {
      allSorts.push((u) => u.slice().sort(k));
      allSorts.push((u) => u.slice().sort((a, b) => byStack(a, b) || k(a, b)));
    });
    const sorts = big > 300 ? [allSorts[0], allSorts[1], allSorts[6], allSorts[7]] : allSorts;
    const orderN = big > 300 ? 2 : 4;
    // ORDENTLICH: nur die festen Sortierungen, keine Zufalls-Neustarts.
    //
    // Gemeldet als "die Ladung wird teilweise weird gestaut": gleiche Ware lag ueber den
    // ganzen Container verstreut, dazwischen einzelne Stuecke einer anderen Sorte. Nachgemessen
    // an der gemeldeten Ladung -- die Streuung (mittlerer Abstand vom Schwerpunkt der eigenen
    // Sorte) lag bei 266 m^2, sortenrein gelegt bei 85.
    //
    // Die Ursache sind ausgerechnet die Zufalls-Neustarts. Die festen Sortierungen legen Sorte
    // fuer Sorte (gleiche Ware hat gleiche Masse, und die stabile Sortierung haelt sie
    // zusammen); ein gemischter Wurf findet oft ein paar Stueck mehr -- im gemeldeten Fall
    // 26 statt 24 -- und dafuer steht jede Sorte hinterher an vier Stellen.
    //
    // Deshalb ist das hier eine SCHRANKE und keine Regel: wer ordentlich packen laesst,
    // bekommt eventuell weniger unter. Ob sich das lohnt, entscheidet die Kette (Stufe 3) --
    // dort ist die Frage "kostet es einen Container?" und nicht "kostet es ein Packstueck?".
    const rs = ordentlich ? 0 : big > 400 ? Math.min(restarts, 6) : restarts;
    const vol = (p) => p.reduce((s, b) => s + b.dx * b.dy * b.dz, 0);
    // Hoehensumme als DRITTES Kriterium — erst wenn Anzahl UND Volumen gleich sind. Die
    // Suche laeuft ohnehin viele Varianten; unter denen, die gleich viel unterbringen, ist
    // die gestapelte die anschaulichere: wer die Bauhoehe auf zwei Etagen abgestimmt hat,
    // will die zweite Etage auch sehen. Per Konstruktion kostet das keinen Fuellgrad —
    // an Anzahl und Volumen wird nichts getauscht, es entscheidet nur den Gleichstand.
    //
    // Volumen wird mit Toleranz verglichen: dieselbe Kistenmenge in anderer Reihenfolge
    // aufsummiert ergibt in Gleitkomma nicht bitgleich dasselbe, und ein Gleichstand, den
    // die letzte Stelle verhindert, waere keiner.
    const yTot = (p) => p.reduce((s, b) => s + b.y, 0);
    let best = { placed: [], weight: 0, n: -1, v: -1, y: -1 };
    const consider = (res) => {
      const v = vol(res.placed), n = res.placed.length;
      if (n < best.n) return;
      const gleichV = Math.abs(v - best.v) <= 1e-6 * Math.max(1, Math.abs(v));
      const besser = n > best.n || (!gleichV && v > best.v) || (gleichV && yTot(res.placed) > best.y);
      if (besser) best = { placed: res.placed, weight: res.weight, n, v, y: yTot(res.placed) };
    };
    for (const sf of sorts) for (let o = 0; o < orderN; o++) consider(emsPackOnce(C2, sf(units), o, pay, cap, vorbelegt));
    for (let r = 0; r < rs; r++) {
      const sh = emsShuffle(units, r * 2654435761 + 7);
      for (let o = 0; o < orderN; o++) consider(emsPackOnce(C2, sh, o, pay, cap, vorbelegt));
    }
    return best;
  }
  // "Passt ALLES in diesen einen Container?" -- die Frage stellen Kette und Empfehlung fuer
  // jeden Standardtyp, und bis November 2026 hat jede dieser Fragen einen vollen Packlauf
  // gekostet. Bei der gemeldeten Grossladung (122 m3, 53 t) waren das vierzig Packlaeufe ueber
  // je 1.500 Stueck, um vierzigmal "nein" zu erfahren -- obwohl ein 20-Fuesser 33 m3 fasst.
  //
  // Was nach Volumen oder Gewicht sicher nicht hineingeht, wird deshalb gar nicht erst
  // gepackt. Das ist keine Schaetzung: Kisten ueberlappen sich nicht und bleiben im Container,
  // also kann nie mehr Volumen stehen, als er hat, und der Packer setzt kein Stueck, das die
  // Zuladung reisst. Die Zugabe (1 Liter, 10 g) deckt die Rechentoleranzen des Packers
  // (1e-6 cm je Kante, 1e-6 kg) grosszuegig ab. Gezaehlt wird wie in packCargo: nur Stuecke
  // mit gueltigen Massen und Menge, Gewicht nie negativ.
  function sicherZuViel(Ct, types) {
    const CL = num(Ct.l), CW = num(Ct.w), CH = num(Ct.h);
    const pay = num(Ct.payload) > 0 ? num(Ct.payload) : Infinity;
    let vol = 0, kg = 0;
    for (const t of types) {
      const l = num(t.l), w = num(t.w), h = num(t.h), q = Math.max(0, Math.floor(num(t.qty)));
      if (!(l > 0 && w > 0 && h > 0 && q > 0)) continue;
      vol += l * w * h * q;
      kg += Math.max(0, num(t.weight)) * q;
    }
    return vol > CL * CW * CH + 1e3 || kg > pay + 0.01;
  }
  // soll = wie viele Stueck hinein muessen. Die Abkuerzung gilt nur, wenn das die ganze Liste
  // ist (dann heisst "nicht alles" auch "weniger als soll"); sonst wird gepackt wie immer.
  function passtAlles(Ct, types, opts, soll) {
    const alle = types.reduce((s2, t) => s2 + Math.max(0, Math.floor(num(t.qty))), 0);
    if (soll >= alle && sicherZuViel(Ct, types)) return false;
    return packCargo(Ct, types, opts).boxes >= soll;
  }
  // Der groesste Container ist nur dann die richtige Wahl, wenn er auch MEHR traegt.
  // Gemeldet mit Bild (27.11.26): 34 Stueck zu je 10 t. Jeder Container traegt zwei davon,
  // ein drittes waere zu schwer -- und die Kette stellte fuenfzehn 40' HC hin, jeden mit zwei
  // Stueck, die Empfehlung nannte "16 x 40' HC + 1 x 20' GP". Der 40' HC hat das groesste
  // Volumen, aber NICHT die groesste Zuladung (26.580 kg gegen 28.200 kg im 20' GP): teilt
  // das Gewicht die Sendung, ist der 20-Fuesser die bessere Wahl -- so bucht es auch die Praxis.
  //
  // r ist, was der grosse Container geladen hat. Gesucht wird der kleinste KUERZERE
  // Standard-Container, der von jeder Sorte mindestens genauso viel laedt. Gepackt wird dafuer
  // nur, wenn die Stauung des grossen (ihre Ausdehnung, ihr Gewicht) in den kuerzeren
  // ueberhaupt hineinginge: fuellt die Ladung den grossen raeumlich, kostet die Frage nichts.
  //
  // Kuerzer, nicht bloss kleiner: ein 40' GP anstelle des 40' HC ist dieselbe Stellflaeche und
  // in der Praxis derselbe Preis -- und das Empfehlungsbanner riete sonst bei jeder Ladung,
  // die keine 2,70 m Hoehe braucht, vom gewaehlten High Cube ab. Ein 20-Fuesser statt eines
  // 40-Fuessers ist dagegen wirklich weniger Equipment.
  function kleinerReicht(stdOrder, gross, r, packen) {
    if (!r || !r.boxes) return null;
    let mx = 0, my = 0, mz = 0;
    for (const b of r.placed) {
      if (b.x + b.dx > mx) mx = b.x + b.dx;
      if (b.y + b.dy > my) my = b.y + b.dy;
      if (b.z + b.dz > mz) mz = b.z + b.dz;
    }
    for (const o of stdOrder) {
      if (o === gross || o.vol >= gross.vol) break;
      if (!(num(o.p.l) < num(gross.p.l) - 1)) continue;
      const pay = num(o.p.payload) > 0 ? num(o.p.payload) : Infinity;
      if (mx > num(o.p.l) + 1e-6 || my > num(o.p.h) + 1e-6 || mz > num(o.p.w) + 1e-6 || r.weight > pay + 1e-6) continue;
      const k = packen(o.p);
      if (k.boxes >= r.boxes && r.perType.every((t, i) => (k.perType[i] ? k.perType[i].loaded : 0) >= t.loaded)) return { o, r: k };
    }
    return null;
  }
  function packCargo(Ct, types, opts = {}) {
    const CL = num(Ct.l), CW = num(Ct.w), CH = num(Ct.h);
    const pay = num(Ct.payload) > 0 ? num(Ct.payload) : Infinity;
    const totalBoxes = types.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
    const empty = { placed: [], perType: types.map((t) => ({ loaded: 0, total: Math.max(0, Math.floor(num(t.qty))) })), contVol: CL * CW * CH / 1e6, usedVol: 0, util: 0, weight: 0, boxes: 0, totalBoxes, layers: 0, single: false, rotHint: false, rotHintAll: false };
    if (CL <= 0 || CW <= 0 || CH <= 0) return empty;
    // Gewicht auf >= 0 klemmen, wie es palletize/palletizeMulti seit jeher tun. Ein
    // Minuszeichen im Gewichtsfeld - beim Einfuegen aus einer Tabelle schnell passiert -
    // ergab sonst eine negative Zuladung ("-9.940 kg") und haette jede Ueberladungspruefung
    // ausgehebelt, weil die Summe nach unten statt nach oben lief.
    const valid = types.map((t, ti) => ({ ti, rotatable: t.rotatable !== false, stackable: t.stackable !== false, stackMax: stackCapOf(t), stackH: stackHOf(t), l: num(t.l), w: num(t.w), h: num(t.h), qty: Math.max(0, Math.floor(num(t.qty))), weight: Math.max(0, num(t.weight)) })).filter((t) => t.l > 0 && t.w > 0 && t.h > 0 && t.qty > 0);
    const loaded = types.map(() => 0);
    // Vorbelegung: Kisten, die schon stehen (siehe emsPackOnce). Ihre Lage im Turm und ihre
    // beiden Grenzen werden HIER ausgerechnet und nicht dort -- nur packCargo kennt die
    // Ladungsliste, und eine von Hand gesetzte Kiste bringt die Angaben nicht mit. Von unten
    // nach oben, damit jede Kiste ihre Traeger schon kennt.
    const vorRoh = Array.isArray(opts.vorbelegt) && opts.vorbelegt.length ? opts.vorbelegt : null;
    let vorbelegt = null, vorKg = 0;
    if (vorRoh) {
      vorbelegt = [];
      vorRoh.slice().sort((a, b) => a.y - b.y).forEach((B) => {
        const g = grenzenAus(B, vorbelegt, types[B.ti]);
        vorbelegt.push({ ...B, pos: g.pos, lim: g.lim, hlim: g.hlim });
        vorKg += Math.max(0, num(types[B.ti] && types[B.ti].weight));
      });
    }
    // Was die Vorbelegung wiegt, ist von der Zuladung schon weg. Damit rechnet emsPackOnce
    // unveraendert weiter und muss von der Vorbelegung nichts wissen.
    const payFrei = pay === Infinity ? Infinity : Math.max(0, pay - vorKg);
    let placed = [], weight = 0, layers = 0, single = false;
    // Massgleiche Einzelpositionen sind EINE Sorte. 11 Packstuecke einzeln erfasst
    // (jede Zeile Menge 1) liefen sonst durch den gemischten Pfad und wurden anders
    // gestaut als dieselben 11 in einer Zeile mit Menge 11 -- zwei Bilder fuer
    // dieselbe Ladung. Gebuendelt wird nur, was in ALLEM uebereinstimmt, das die
    // Rechnung beruehrt; die Stellplaetze gehen in Listenreihenfolge an die Positionen.
    const einErster = valid[0];
    const massgleich = valid.length > 1 && !vorbelegt && valid.every((t) =>
      t.l === einErster.l && t.w === einErster.w && t.h === einErster.h
      && t.weight === einErster.weight && t.rotatable === einErster.rotatable
      && t.stackable === einErster.stackable && t.stackMax === einErster.stackMax
      && t.stackH === einErster.stackH);
    // Der Einzeltyp-Pfad legt ein Bodenraster und kennt keine Hindernisse. Mit einer
    // Vorbelegung fuehrt deshalb auch bei einer Sorte der gemischte Pfad -- er ist der
    // einzige, der um schon stehende Kisten herum packen kann.
    if ((valid.length === 1 || massgleich) && !vorbelegt) {
      single = true;
      const tiFolge = massgleich ? valid.flatMap((v) => Array(v.qty).fill(v.ti)) : null;
      const t = massgleich ? { ...einErster, qty: tiFolge.length } : valid[0];
      const maxLay = Math.floor((CH + 1e-6) / t.h);
      // capLay = wie viele Lagen theoretisch uebereinander PASSEN. Nur die Schleifengrenze.
      // Die spaeter ausgewiesene Lagenzahl wird nach dem Packen aus den tatsaechlich
      // belegten Hoehen gezaehlt (siehe unten) — sonst meldet das Tool "2 gestapelt",
      // obwohl nur ein Packstueck auf dem Boden steht.
      // Auch die Hoehengrenze zaehlt hier mit: "bis 180 cm" bei 45 cm Bauhoehe sind vier
      // Lagen, egal was der Container hergibt.
      const hLay = isFinite(t.stackH) ? Math.floor((t.stackH + 1e-6) / t.h) : Infinity;
      const capLay = maxLay < 1 ? 0 : t.stackable ? Math.min(maxLay, t.stackMax, hLay) : 1;
      // Mehr Stellplaetze als Menge / Etagen kann diese Schleife nie belegen — der Packer
      // muss also gar nicht erst mehr ausrechnen.
      const brauchtSpots = Math.max(1, Math.ceil(t.qty / Math.max(1, capLay)));
      const fl = makeFloorPacker(t.l, t.w, t.rotatable, brauchtSpots)(CL, CW);
      // Reihenfolge: STELLPLATZ zuerst, dann in die Hoehe. Frueher andersherum — erst der
      // ganze Boden, dann die zweite Etage. Die Zahl war in beiden Faellen dieselbe (die
      // Kapazitaet ist Stellplaetze x Etagen), aber bei wenigen Packstuecken stand alles
      // nebeneinander, obwohl der Benutzer die Bauhoehe gerade auf zwei Etagen abgestimmt
      // hatte. Wer stapeln darf, soll das auch sehen.
      //
      // Nur wenn Stapeln ueberhaupt erlaubt ist: bei stackable=false ist capLay ohnehin 1,
      // und dann sind beide Reihenfolgen identisch.
      // Die Guillotine-Schnitte des Bodenpackers hinterlassen Naehte und -- mit
      // maxSpots -- unbelegte Plaetze MITTEN im Container (gemeldet: 42 Paletten
      // 121x85 im 40', Luecke bei x 605-690, waehrend an der Tuer Platz frei war).
      // Die Stellplatzzahl stimmt, nur ihre Lage ist Schnittkunst. Deshalb wird
      // jeder Platz so weit zur Stirnwand geschoben, wie seine Nachbarn im selben
      // z-Band es zulassen (aendert nie die Zahl, nur die Luecken wandern zur
      // Tuer), und gefuellt wird von der Stirnwand her -- dieselbe Richtung wie
      // loadingOrder und die Belade-Reihenfolge im Ladevorschlag.
      const spots = fl.rects.map((r) => ({ ...r })).sort((a, b) => a.x - b.x || a.z - b.z);
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        let sx = 0;
        for (let j = 0; j < i; j++) {
          const o = spots[j];
          if (o.z < s.z + s.dz - 1e-6 && o.z + o.dz > s.z + 1e-6) sx = Math.max(sx, o.x + o.dx);
        }
        s.x = sx;
      }
      spots.sort((a, b) => a.x - b.x || a.z - b.z);
      const colFirst = capLay > 1;
      outer: for (let a = 0; a < (colFirst ? spots.length : capLay); a++) {
        for (let b = 0; b < (colFirst ? capLay : spots.length); b++) {
          const ly = colFirst ? b : a, r = spots[colFirst ? a : b];
          // placed.length zaehlt hier dasselbe wie loaded -- der Pfad beginnt leer.
          if (placed.length >= t.qty) break outer;
          if (weight + t.weight > pay + 1e-6) break outer;
          const zielTi = tiFolge ? tiFolge[placed.length] : t.ti;
          placed.push({ x: r.x, y: ly * t.h, z: r.z, dx: r.dx, dy: t.h, dz: r.dz, ti: zielTi });
          loaded[zielTi]++;
          weight += t.weight;
        }
      }
      // Gleiche Zaehlweise wie im gemischten Pfad: tatsaechlich belegte Hoehen, nicht moegliche.
      layers = placed.length ? new Set(placed.map((p) => Math.round(p.y))).size : 0;
    } else if (valid.length >= 1) {
      const totalU = valid.reduce((s, t) => s + t.qty, 0);
      const restarts = opts.quick ? 0 : opts.intensive ? totalU <= 60 ? 280 : totalU <= 200 ? 70 : 18 : totalU <= 40 ? 60 : totalU <= 120 ? 12 : 0;
      const res = emsSearch({ l: CL, w: CW, h: CH }, valid, payFrei, restarts, opts.ordentlich, vorbelegt);
      placed = res.placed;
      weight = res.weight;
      placed.forEach((p) => loaded[p.ti] = (loaded[p.ti] || 0) + 1);
      layers = placed.length ? new Set(placed.map((p) => Math.round(p.y))).size : 0;
    }
    const contVol = CL * CW * CH / 1e6;
    let usedVol = 0;
    placed.forEach((p) => usedVol += p.dx * p.dy * p.dz / 1e6);
    let rotHint = false, rotHintAll = false;
    if (!opts.noHint && placed.length < totalBoxes && totalBoxes > 0 && totalBoxes <= 400) {
      const anyFixed = types.some((t) => t.rotatable === false);
      if (anyFixed) {
        const forced = types.map((t) => ({ ...t, rotatable: true }));
        const test = packCargo(Ct, forced, { noHint: true, quick: true });
        if (test.boxes > placed.length) {
          rotHint = true;
          rotHintAll = test.boxes >= totalBoxes;
        }
      }
    }
    return { placed, perType: types.map((t, i) => ({ loaded: loaded[i], total: Math.max(0, Math.floor(num(t.qty))) })), contVol, usedVol, util: contVol > 0 ? usedVol / contVol * 100 : 0, weight, boxes: placed.length, totalBoxes, layers, single, rotHint, rotHintAll };
  }
  // ── Special Equipment: Ueberstand-Platzierung, OOG-Vermessung, deck-faehiger Packer ──
  // Reine Geometrie. Das Tool entscheidet KEINE Physik (Gewichtsverteilung/Sicherung) –
  // es optimiert nur innerhalb der Nutzervorgabe (forceCentered = "mittig stauen erzwingen").
  // ── Achslast-Richtwert fuer die Landfracht ────────────────────────────────────────
  //
  // Bis August 2026 stand in jeder Fusszeile "keine Achslast-Garantie", und das war die
  // ganze Antwort. Dabei liegt alles Noetige laengst vor: die Laengsposition jedes
  // Packstuecks (x) und sein Gewicht. Was fehlte, war die Geometrie des Fahrzeugs.
  //
  // Die steht hier -- als TYPISCHE Geometrie, offen als Richtwert ausgewiesen, nur fuer
  // den Sattelzug (das Arbeitspferd; fuer die uebrigen Fahrzeuge waere jede Zahl geraten,
  // also gibt es dort keine). Masse in cm ab der STIRNWAND der Ladeflaeche, Gewichte in kg:
  //   * zapfen 160: Koenigszapfen ~1,6 m hinter der Front (Vormass 2.040 mm Drehradius
  //     ergibt ~1,6 m Ueberhang; Zapfen-zu-Heck max. 12,0 m nach 96/53/EG, und
  //     160 + 1200 = 13,60 m passt zur 13,62-m-Ladeflaeche).
  //   * aggregat 1030: Mitte des Dreiachs-Aggregats (Radstand im Aggregat typ. 1,31 m,
  //     Heckueberhang hinter der letzten Achse ~2,3 m).
  //   * tara 7000 / taraSp 845: Curtainsider leer ~7 t; der Schwerpunkt so gelegt, dass
  //     leer ~1,5 t Stuetzlast herauskommen -- das ist die Groessenordnung realer Auflieger.
  //   * zapfenMax 11000: EU-typisch eingetragene Sattellast einer 4x2-Maschine.
  //   * aggregatMax 24000: Dreifachachse nach Par. 34 StVZO (Achsabstand > 1,3 m).
  // Reale Fahrzeuge weichen ab; genau deshalb heisst die Anzeige Richtwert und die
  // Annahmen stehen SICHTBAR daneben (T.axleAssume), nicht nur hier im Kommentar.
  var ACHSEN = {
    "Planensattel": { zapfen: 160, aggregat: 1030, tara: 7000, taraSp: 845, zapfenMax: 11000, aggregatMax: 24000 }
  };
  // Balkenstatik mit zwei Stuetzen (Koenigszapfen, Aggregat-Mitte): Momentengleichgewicht
  // um den Zapfen. Exakt fuer die angenommene Geometrie -- die Naeherung steckt in den
  // Konstanten oben, nicht in dieser Rechnung.
  function achslasten(placed, weightOf, A) {
    let m = A.tara, mom = A.tara * (A.taraSp - A.zapfen), ladung = 0;
    for (const p of placed) {
      const w = Math.max(0, +weightOf(p.ti) || 0);
      if (w === 0) continue;
      const cx = (+p.x || 0) + (+p.dx || 0) / 2;
      m += w; ladung += w;
      mom += w * (cx - A.zapfen);
    }
    const aggregat = mom / (A.aggregat - A.zapfen);
    // Zapfen = Rest. Er KANN negativ werden -- die Ladung liegt dann so weit hinten, dass
    // der Auflieger vorne abheben wuerde. Das ist keine Rechenpanne, sondern die Warnung.
    return { zapfen: m - aggregat, aggregat, gesamt: m, ladung };
  }
  // Achslast-bewusstes Stauen: liegt zu viel Gewicht auf dem Zapfen, wird die Ladung als
  // GANZER Block nach hinten gesetzt -- die Stauung selbst (Stapel, Reihen, Formschluss
  // untereinander) bleibt exakt erhalten, nur der Abstand zur Stirnwand waechst. Der Packer
  // staut von der Stirnwand her, und bei schwerer Ladung auf kurzer Strecke ist das genau
  // die Lage, die den Zapfen ueberlastet.
  // Die Statik ist linear in der Verschiebung dx, das Ziel darum exakt loesbar:
  //   aggregat(dx) = (mom0 + W*dx) / D,  zapfen(dx) = m - aggregat(dx)
  //   zapfen(dx) = zapfenMax  ->  dx = ((m - zapfenMax) * D - mom0) / W
  // Aufgerundet auf ganze cm (lieber 1 cm mehr als knapp drueber bleiben), gedeckelt durch
  // den freien Platz hinter der Ladung und die Aggregat-Grenze. Reicht die Deckelung nicht,
  // wird so weit geschoben wie moeglich -- und die Anzeige bleibt ehrlich rot.
  // Minimal geschoben, nicht "optimal verteilt": jede weitere Verschiebung waere Abstand
  // zur Stirnwand ohne Not, und der Formschluss nach vorn ist beim Sichern bares Geld.
  function achsShift(placed, weightOf, A, contLen) {
    const a = achslasten(placed, weightOf, A);
    if (!(a.ladung > 0) || a.zapfen <= A.zapfenMax) return 0;
    const D = A.aggregat - A.zapfen;
    const mom0 = a.aggregat * D;
    let maxX = 0;
    for (const p of placed) maxX = Math.max(maxX, (+p.x || 0) + (+p.dx || 0));
    const frei = (+contLen || 0) - maxX;
    if (frei < 1) return 0;
    const dxZiel = Math.ceil(((a.gesamt - A.zapfenMax) * D - mom0) / a.ladung);
    const dxAgg = Math.floor((A.aggregatMax * D - mom0) / a.ladung);
    const dx = Math.min(dxZiel, dxAgg, Math.floor(frei));
    return dx > 0 ? dx : 0;
  }
  // Erst verteilen, dann schieben (Jareks Befund 19.11.26, mit Bild: 18 flache Paletten
  // 325 x 218, je 1,3-2,6 t, auf zwei Planensattel -- der Rechner stapelte sie fuenf hoch
  // auf die ersten 6,5 m und schob den Block dann 2,87 m von der Stirnwand weg: "Warum
  // staut er die mittig und nicht am Ende?"). An der Rampe verteilt man solche Ladung
  // flacher ueber die Laenge, statt hohe Stapel zu bauen und vorn eine Luecke zu lassen,
  // die beim Sichern erst wieder gefuellt werden muss.
  // Mittel: dieselbe Ladung desselben Fahrzeugs noch einmal packen, mit tiefer gelegter
  // DECKE -- der Packer kann dann nicht mehr so hoch stapeln und belegt von selbst mehr
  // Laenge, weiter ab der Stirnwand. Genommen wird die TIEFSTE Decke, bei der noch alles
  // hineingeht und der Zapfen haelt: ist der Zapfen ueberlastet, ist die Ladung schwer, und
  // schwere Ladung gehoert gleichmaessig auf die Ladeflaeche (niedrige Stapel kippen nicht
  // und lassen sich sichern). Die hoechste passende Decke war die erste Fassung -- sie liess
  // bei Jareks Ladung eine einzelne Palette vorn und zwei Fuenfer-Stapel dahinter stehen.
  // Gibt es keine Stufe mit haltendem Zapfen, bleibt die mit dem leichtesten Zapfen -- den
  // Rest erledigt danach achsShift. null: nichts zu verteilen (Zapfen haelt schon, zu viele
  // Stuecke fuer die Rechenzeit, oder es wird nicht besser).
  // Dazu je Stufe die SPIEGELUNG ueber die belegte Laenge: der Packer weiss nichts von
  // Gewicht und legt die schweren Stapel gern nach vorn -- gespiegelt stehen sie hinten,
  // die Ladung bleibt an der Stirnwand, und jede Kiste steht auf denselben Traegern wie
  // vorher (die Spiegelung aendert nur x, Hoehen und Nachbarschaften bleiben). An der
  // Rampe heisst das: die schweren Paletten kommen nach hinten.
  var ACHS_STUFEN = 12, ACHS_VERTEILEN_MAX = 300;
  function achsSpiegel(placed) {
    let ende = 0;
    for (const p of placed) ende = Math.max(ende, (+p.x || 0) + (+p.dx || 0));
    return placed.map((p) => ({ ...p, x: ende - (+p.x || 0) - (+p.dx || 0) }));
  }
  function achsVerteilen(placed, items, weightOf, A, Ct, opts) {
    const a0 = achslasten(placed, weightOf, A);
    if (!(a0.ladung > 0) || a0.zapfen <= A.zapfenMax || placed.length > ACHS_VERTEILEN_MAX) return null;
    let oben = 0, hMin = 0;
    for (const p of placed) { oben = Math.max(oben, (+p.y || 0) + (+p.dy || 0)); hMin = Math.max(hMin, +p.dy || 0); }
    // best: leichtester Zapfen ueberhaupt; gut: die flachste Lage, bei der der Zapfen haelt.
    // layers null = unveraendert (reine Spiegelung); decke 0 = nicht umgestapelt.
    let best = null, gut = null;
    const pruefe = (pl, layers, decke, spiegel) => {
      const a = achslasten(pl, weightOf, A);
      if (a.aggregat > A.aggregatMax) return false;
      let hoehe = 0;
      for (const p of pl) hoehe = Math.max(hoehe, (+p.y || 0) + (+p.dy || 0));
      const erg = { placed: pl, layers, decke, hoehe, spiegel, zapfen: a.zapfen };
      if (!best || a.zapfen < best.zapfen) best = erg;
      if (a.zapfen > A.zapfenMax) return false;
      gut = erg;
      return true;
    };
    // Stufe 0: dieselbe Stauung, nur gespiegelt -- zaehlt, wenn keine flachere Lage hilft
    pruefe(achsSpiegel(placed), null, 0, true);
    // Von oben nach unten: jede Stufe, bei der der Zapfen haelt, loest die hoehere ab
    for (let s = 1; s <= ACHS_STUFEN && oben - hMin >= 1; s++) {
      const decke = Math.floor(oben - (oben - hMin) * s / ACHS_STUFEN);
      if (decke < hMin) break;
      const r = packCargo({ ...Ct, h: decke }, items, opts);
      // Geht nicht mehr alles hinein, wird es mit noch tieferer Decke nicht besser
      if (r.boxes < placed.length) break;
      pruefe(r.placed, r.layers, decke, false) || pruefe(achsSpiegel(r.placed), r.layers, decke, true);
    }
    if (gut) return gut;
    return best && best.zapfen < a0.zapfen ? best : null;
  }

  // ── Ladungssicherungs-Check ─────────────────────────────────────────────────
  // Aus der gepackten Geometrie laesst sich ehrlich ableiten, WO gesichert werden
  // muss -- nicht, WOMIT im Detail: die Ware kennen wir nicht. Deshalb Richtwerte
  // mit sichtbaren Annahmen (wie beim Achslast-Richtwert), keine "optimale
  // Ladungssicherung". Grundlagen: CTU-Code (Luecken je Richtung in Summe unter
  // 15 cm, Einzelluecken 3-5 cm; im Container ist Formschluss die Methode der
  // Wahl) und EN 12195-1 (Niederzurren: Gesamtvorspannkraft aus Gewicht,
  // Beschleunigungsbeiwert 0,8 nach vorn und Reibbeiwert, je Gurt zaehlt die
  // doppelte STF).
  var SICH = {
    EINZEL: 5,      // cm -- Einzelluecke, ab der sie gemeldet wird (CTU: 3-5 cm ok)
    SUMME: 15,      // cm -- Lueckensumme je Richtung, ab der gefuellt werden MUSS
    KIPP: 2         // Hoehe > KIPP x schmalste Grundkante = kippgefaehrdet (0,5 g quer)
  };
  // Der Check zeigt WO Bewegung moeglich ist -- nicht WOMIT zu sichern waere.
  // Es gab mal mehr: Zurrgurt-Rechner nach EN 12195-1, Materialliste, 3D-Vorschau
  // von Luftkissen und Stauholz (Git-Historie dieses Blocks). Bewusst entfernt:
  // welches Material ein Lager nutzt, wissen wir nicht, und Vorschlaege fuer
  // Ausruestung, die es dort nicht gibt, helfen niemandem.
  // Intervalle mergen und Loecher zwischen 0 und "bis" melden.
  function sichLoecher(iv, bis) {
    iv.sort((a, b) => a[0] - b[0]);
    const out = [];
    let ende = 0;
    for (const [a, b] of iv) {
      if (a > ende + 1e-6) out.push([ende, a]);
      ende = Math.max(ende, b);
    }
    if (bis > ende + 1e-6) out.push([ende, bis]);
    return { loecher: out, ende };
  }
  // Luecken-Analyse eines gepackten Containers. Ergebnis in cm, Positionen ab Stirnwand.
  function sichAnalyse(placed, weightOf, cont, domain) {
    const L = +cont.l || 0, W = +cont.w || 0;
    const laengsIv = placed.map((p) => [+p.x || 0, (+p.x || 0) + (+p.dx || 0)]);
    const lg = sichLoecher(laengsIv, 0); // nur innere Loecher; Tuer separat
    const laengs = lg.loecher.filter(([a, b]) => b - a > SICH.EINZEL);
    const tuer = Math.max(0, L - lg.ende);
    // Quer: je Laengsband (Schnitt zwischen zwei Kanten) die z-Abdeckung pruefen.
    // Meldewuerdig ist jedes Loch ueber EINZEL in einem Band, dessen Lochsumme ueber
    // der CTU-Grenze liegt. Nahezu deckungsgleiche Loecher benachbarter Baender werden
    // zu EINER durchgehenden Zone verschmolzen (Schnittmenge, damit die Zone sicher im
    // Loch liegt) -- frueher zaehlte nur das schlechteste Band, und ein langer schmaler
    // Streifen an der Wand fiel neben einer dickeren Luecke unter den Tisch.
    const kanten = [...new Set(placed.flatMap((p) => [+p.x || 0, (+p.x || 0) + (+p.dx || 0)]))].sort((a, b) => a - b);
    const querZonen = [];
    for (let i = 0; i + 1 < kanten.length; i++) {
      const m = (kanten[i] + kanten[i + 1]) / 2;
      const zIv = placed.filter((p) => (+p.x || 0) < m && m < (+p.x || 0) + (+p.dx || 0)).map((p) => [+p.z || 0, (+p.z || 0) + (+p.dz || 0)]);
      if (!zIv.length) continue; // Laengsloch, oben schon gemeldet
      const zg = sichLoecher(zIv, W);
      const summe = zg.loecher.reduce((s2, [a, b]) => s2 + (b - a), 0);
      if (summe <= SICH.SUMME) continue;
      for (const [za, zb] of zg.loecher) {
        if (zb - za <= SICH.EINZEL) continue;
        const alt = querZonen.find((q) => Math.abs(q.bis - kanten[i]) < 1e-6 && Math.abs(q.za - za) < 10 && Math.abs(q.zb - zb) < 10);
        if (alt) { alt.bis = kanten[i + 1]; alt.za = Math.max(alt.za, za); alt.zb = Math.min(alt.zb, zb); }
        else querZonen.push({ von: kanten[i], bis: kanten[i + 1], za, zb });
      }
    }
    const laengsSumme = laengs.reduce((s, [a, b]) => s + (b - a), 0);
    // Kippgefahr: freistehend, homogene Masse -- Hoehe gegen schmalste Grundkante.
    const kippTi = [...new Set(placed.filter((p) => (+p.dy || 0) > SICH.KIPP * Math.min(+p.dx || 1e9, +p.dz || 1e9)).map((p) => p.ti))];
    // Schwere Einzelstuecke: Lastverteilung ist dort Handarbeit.
    const schwerTi = [...new Set(placed.map((p) => p.ti))].filter((ti) => Math.max(0, +weightOf(ti) || 0) >= 1500);
    return { laengs, laengsSumme, tuer, querZonen, kippTi, schwerTi, domain };
  }
  // Die Befunde als typisierte Liste: EINE Quelle fuer Dialog, Aufplopp-Hinweis und
  // 3D-Zonen -- drei Stellen mit eigener Logik waeren drei Meinungen.
  function sichBefunde(s) {
    const b = [];
    s.laengs.forEach(([a, c]) => b.push(a < 1e-6 ? { art: "stirn", a, c } : { art: "laengs", a, c }));
    if (s.laengsSumme > SICH.SUMME) b.push({ art: "laengsSumme" });
    (s.querZonen || []).forEach(() => b.push({ art: "quer" }));
    if (s.tuer > SICH.SUMME) b.push({ art: "tuer" });
    else if (s.tuer > SICH.EINZEL) b.push({ art: "tuerKlein" });
    s.kippTi.forEach((ti) => b.push({ art: "kipp", ti }));
    s.schwerTi.forEach((ti) => b.push({ art: "schwer", ti }));
    return b;
  }
  // Die Luecken als Quader fuer die 3D-Ansicht (cm, slot-lokal ab Stirnwand). Hoehe:
  // so hoch wie die Ladung daneben steht -- ein Fuellquader bis unters Dach waere
  // Drama, keine Information. Die Tuerluecke wird als schmaler Balken am Ladungsende
  // gezeigt (die Sperrbalken-Position), nicht als Riesenblock bis zur Tuer.
  function sichZonenBauen(s, cont, placed) {
    let hMax = 0;
    for (const p of placed) hMax = Math.max(hMax, (+p.y || 0) + (+p.dy || 0));
    const H = Math.max(80, Math.min(hMax || 80, +cont.h || 999));
    const W = +cont.w || 0;
    // Angrenzende Packstuecke einer Luecke: wer sie beruehrt, wuerde bei Bewegung in
    // sie hineinrutschen. Fuer die "Grund"-Zeile der Zonen-Karte.
    const anrainerX = (a, b) => [...new Set(placed.filter((p) => Math.abs((+p.x || 0) + (+p.dx || 0) - a) < 2 || Math.abs((+p.x || 0) - b) < 2).map((p) => p.ti))];
    const anrainerZ = (von, bis, za, zb) => [...new Set(placed.filter((p) => (+p.x || 0) < bis && (+p.x || 0) + (+p.dx || 0) > von && (Math.abs((+p.z || 0) + (+p.dz || 0) - za) < 2 || Math.abs((+p.z || 0) - zb) < 2)).map((p) => p.ti))];
    const z = [];
    s.laengs.forEach(([a, b]) => z.push({ x: a, z: 0, dx: b - a, dz: W, dy: H, richtung: "x",
      art: a < 1e-6 ? "stirn" : "laengs", luecke: b - a, nachbarn: anrainerX(a, b), wand: false }));
    (s.querZonen || []).forEach((q) => z.push({ x: q.von, z: q.za, dx: q.bis - q.von, dz: q.zb - q.za, dy: H, richtung: "z",
      art: "quer", luecke: q.zb - q.za, nachbarn: anrainerZ(q.von, q.bis, q.za, q.zb), wand: q.za < 2 || q.zb > W - 2 }));
    if (s.tuer > SICH.SUMME) z.push({ x: (+cont.l || 0) - s.tuer, z: 0, dx: Math.min(s.tuer, 12), dz: W, dy: H, tuer: true, richtung: "x",
      art: "tuer", luecke: s.tuer, nachbarn: anrainerX((+cont.l || 0) - s.tuer, Infinity), wand: false });
    return z;
  }
  // Indikative Laengs-Gewichtsverteilung. KEINE Physik-Garantie, KEINE Achslast im Detail --
  // fuer den Sattelzug gibt es daneben den Achslast-Richtwert (ACHSEN/achslasten).
  // Rein aus Geometrie + Stueckgewichten. Ergebnis ist ein Richtwert ohne Gewaehr.
  // placed: [{x,dx,ti,...}], weightOf: (ti)=>Stueckgewicht in kg, contLenCm: Innenlaenge (cm)
  function computeLongCog(placed, weightOf, contLenCm) {
    const L = Math.max(1, +contLenCm || 1);
    let W = 0, mom = 0, front = 0, rear = 0; // front = vordere Haelfte (x < L/2)
    let placedCount = 0, withWeightCount = 0;  // Zaehlung: insgesamt vs. mit Gewicht
    for (const p of placed) {
      placedCount++;
      const w = Math.max(0, +weightOf(p.ti) || 0);
      if (w === 0) continue;
      withWeightCount++;
      const cx = (+p.x || 0) + (+p.dx || 0) / 2; // Laengs-Mitte der Colli (cm)
      W += w;
      mom += w * cx;
      if (cx < L / 2) front += w; else rear += w;
    }
    if (W <= 0) return null; // keine Gewichte eingegeben -> nichts anzeigen
    const cogCm = mom / W;                 // Schwerpunkt-Position ab Stirnseite (cm)
    const cogPct = cogCm / L * 100;        // 0 % = ganz vorne, 100 % = ganz hinten
    const frontPct = front / W * 100;      // Gewichtsanteil vordere Haelfte
    const rearPct = rear / W * 100;        // Gewichtsanteil hintere Haelfte
    const devPct = cogPct - 50;            // + = hecklastig, - = kopflastig
    let balance;                            // "front" | "balanced" | "rear"
    if (devPct < -5) balance = "front";
    else if (devPct > 5) balance = "rear";
    else balance = "balanced";
    return { totalKg: W, cogCm, cogPct, frontPct, rearPct, devPct, balance, placedCount, withWeightCount };
  }
  // Platzierung eines Uebermass-Stuecks auf dem Deck (cm, Min-Ecke). j/m = Index/Anzahl Stuecke.
  // "placed" sind die bereits auf dem Deck stehenden Stuecke (normale Ladung + zuvor platziertes
  // Uebermass) -- Uebermass darf ueber den Container hinausragen (das ist sein Zweck), aber es
  // darf nicht DURCH andere Ladung hindurchgehen. Zuerst wird die "schoene" Standardposition
  // versucht (mittig ueber die Laenge verteilt, seitlich zentriert oder an den offenen Rand
  // geschoben); ueberschneidet die sich mit bereits stehender Ladung, wird ein Ausweich-Raster
  // aus Kanten der bereits platzierten Stuecke sowie den Containerraendern durchprobiert. Findet
  // sich keine kollisionsfreie Stelle, gibt es null zurueck -- das Stueck bleibt dann unverladen,
  // statt sich mit anderer Ladung zu durchdringen.
  // Durch GESCHLOSSENE Huellflaechen darf nichts ragen -- das ist Stahl, kein Freiraum.
  // Ueber OFFENE Flaechen darf es das sehr wohl, genau dafuer gibt es Open Top und Flat Rack.
  function fitsPanels(c, CL, CW, panels) {
    const tol = 1e-6;
    if (panels.ends && (c.x < -tol || c.x + c.dx > CL + tol)) return false;
    if (panels.sides && (c.z < -tol || c.z + c.dz > CW + tol)) return false;
    return true;
  }
  function placeOversize(dims, Ct, panels, forceCentered, j, m, placed) {
    const CL = num(Ct.l), CW = num(Ct.w);
    const l = num(dims.l), w = num(dims.w), dy = num(dims.h);
    const xc = CL * (j + 0.5) / Math.max(1, m);
    // Zwei Ausrichtungen, geliefert zuerst. Der Grund fuer die zweite: Die Einstufung in
    // packKind fragt "Math.min(l, w) > CW" -- sie haelt ein Stueck also schon fuer
    // breitenkonform, sobald es QUER zwischen die Waende passt, und setzt damit stillschweigend
    // voraus, dass gedreht wird. Ohne diese Drehung stand ein 300 cm breites Stueck im Open Top
    // 32,5 cm links und rechts durch massive Seitenwaende (test/oversize-breite.test.mjs).
    // Die gelieferte Ausrichtung bleibt vorne, damit sich bei OFFENEN Seiten nichts aendert:
    // dort ist der Ueberstand gewollt und die OOG-Vermessung rechnet mit ihm.
    const oris = l === w || dims.rot === false ? [[l, w]] : [[l, w], [w, l]];
    // Auflage: In offenen Richtungen darf Ware ueberstehen – das ist der Sinn eines Flat Racks.
    // Sie muss aber auf dem Deck LIEGEN. Ohne diese Pruefung fand der Packer fuer ein zweites
    // ueberbreites Stueck einen "freien" Platz vollstaendig NEBEN dem Deck; im 3D-Bild schwebte
    // es dann in der Luft. Verlangt werden zwei Dinge, die beide anschaulich sind: der
    // Schwerpunkt liegt ueber dem Deck, und mindestens die Haelfte der Standflaeche auch.
    const traegt = (c) => {
      const ueberlappX = Math.max(0, Math.min(c.x + c.dx, CL) - Math.max(c.x, 0));
      const ueberlappZ = Math.max(0, Math.min(c.z + c.dz, CW) - Math.max(c.z, 0));
      const anteil = c.dx * c.dz > 0 ? ueberlappX * ueberlappZ / (c.dx * c.dz) : 0;
      const mx = c.x + c.dx / 2, mz = c.z + c.dz / 2;
      return anteil >= 0.5 - 1e-9 && mx >= -1e-9 && mx <= CL + 1e-9 && mz >= -1e-9 && mz <= CW + 1e-9;
    };
    // Deckel fuer eine zweite Lage: bei offenem Dach das Huellmass der Zelle, sonst die
    // Innenhoehe. Was schon einzeln darueber hinausragt, liegt weiter auf dem Deck – nur
    // STAPELN darf man nicht ins Unendliche.
    const deckel = !panels.roof && Ct.gauge ? num(Ct.gauge.h) : num(Ct.h);
    for (const [dx, dz] of oris) {
      const zCentered = (CW - dz) / 2;
      const zEdge = !panels.sides && dz > CW && !forceCentered ? CW - dz : zCentered;
      // Buendig ans schon Liegende ZUERST, dann die Grundplaetze. Vorher stand hier ein
      // Spreiz-Platz (xc) vorn, der jedem Stueck sein eigenes Laengsdrittel gab – dadurch
      // standen zwei Stuecke mit Luecke auf dem Deck, obwohl sie aneinander passen.
      const nachbarnX = (placed || []).map((b) => b.x + b.dx).sort((a, b) => a - b);
      const xCandidates = [0, ...nachbarnX, ...(placed || []).map((b) => b.x - dx), CL - dx, xc - dx / 2];
      const zCandidates = [zEdge, zCentered, 0, CW - dz];
      for (const b of placed || []) zCandidates.push(b.z + b.dz, b.z - dz);
      for (const x of xCandidates) {
        for (const z of zCandidates) {
          const cand = { x, y: 0, z, dx, dy, dz };
          if (!fitsPanels(cand, CL, CW, panels)) continue;
          if (!traegt(cand)) continue;
          if (!(placed || []).some((b) => boxesOverlap(cand, b))) return cand;
        }
      }
      // Kein Platz mehr auf dem Deck: auf ein deckungsgleiches Stueck derselben Art stapeln.
      // Gleicher Grundriss, exakt buendig – die Auflage ist damit vollstaendig, ohne dass
      // irgendwo eine Prozentregel greifen muesste.
      if (dims.stapel !== 0) {
        const saeulen = {};
        for (const b of placed || []) {
          if (b.ti !== dims.ti || b.dx !== dx || b.dz !== dz) continue;
          const k = b.x + "|" + b.z;
          (saeulen[k] = saeulen[k] || []).push(b);
        }
        const kandidaten = Object.values(saeulen)
          .map((bs) => ({ bs, oben: bs.reduce((m, b) => Math.max(m, b.y + b.dy), 0) }))
          .sort((a, b) => a.oben - b.oben);
        for (const { bs, oben } of kandidaten) {
          if (bs.length + 1 > dims.stapel) continue;          // Lagen-Obergrenze der Ware
          if (oben + dy > deckel + 1e-6) continue;            // Huellmass bzw. Innenhoehe
          const cand = { x: bs[0].x, y: oben, z: bs[0].z, dx, dy, dz };
          if (!(placed || []).some((b) => boxesOverlap(cand, b))) return cand;
        }
      }
    }
    return null;
  }
  // OOG-Vermessung (cm) gegen das gauge-Huellmass, nur in OFFENEN Richtungen. md = groesste
  // Stueckmasse je Achse (der groesste Ueberstand je Achse bestimmt den Buchungswert).
  function computeOOG(md, gauge, panels, forceCentered) {
    const oog = {};
    if (!panels.roof) oog.overHeight = Math.max(0, num(md.h) - num(gauge.h));
    if (!panels.sides) {
      const total = Math.max(0, num(md.w) - num(gauge.w));
      if (forceCentered) { oog.overWidthL = total / 2; oog.overWidthR = total / 2; }
      else { oog.overWidthL = total; oog.overWidthR = 0; }
    }
    if (!panels.ends) {
      const total = Math.max(0, num(md.l) - num(gauge.l));
      oog.overLengthFront = total / 2; oog.overLengthBack = total / 2;
    }
    return oog;
  }
  // Blockierte Slots = reine Geometrie-Schaetzung (kein Geld). Das eigene Stueck + je
  // ueberragter Richtung ein Nachbar-Slot.
  function blockedSlots(oog) {
    let s = 1;
    if (oog.overWidthL > 0) s++;
    if (oog.overWidthR > 0) s++;
    if (oog.overLengthFront > 0) s++;
    if (oog.overLengthBack > 0) s++;
    if (oog.overHeight > 0) s++;
    return s;
  }
  // Packer fuer Special Equipment: normale Stuecke wie bisher innerhalb l/w/h; ein Uebermass-Stueck
  // wird NICHT abgelehnt, sondern aufs Deck gelegt (Ueberstand nur in offenen Richtungen). dry -> packCargo.
  function packKind(Ct, cargo, opts, forceCentered) {
    const kind = Ct.kind || "dry";
    if (kind === "dry") return packCargo(Ct, cargo, opts);
    const panels = panelsFor(kind);
    const CL = num(Ct.l), CW = num(Ct.w), CH = num(Ct.h);
    const overTi = new Set(), overUnits = [];
    cargo.forEach((t, ti) => {
      const l = num(t.l), w = num(t.w), h = num(t.h), q = Math.max(0, Math.floor(num(t.qty)));
      if (q <= 0 || l <= 0 || w <= 0 || h <= 0) return;
      // Drehen ist eine ERLAUBNIS: die Deck-Pruefung darf die gedrehte Lage nur
      // ansetzen, wenn die Ware sie erlaubt. Gemeldet (20' Flat Rack, 245 cm breit,
      // Drehen aus): fitsDeck hielt das Stueck fuer deckkonform, der normale Packer
      // darf aber nicht drehen -- es blieb unverladen, das Deck stand leer, und die
      // Empfehlung schlug einen Flat Rack vor, waehrend genau einer gewaehlt war.
      // Dasselbe gilt fuer die Uebermass-Einstufung darunter: ohne Drehen zaehlt die
      // Lage wie eingegeben (l laengs, w quer).
      const rot = t.rotatable !== false;
      const fitsDeck = (l <= CL && w <= CW || rot && w <= CL && l <= CW) && h <= CH;
      if (fitsDeck) return;
      const overL = rot ? l > CL && (w > CW || l > CW) : l > CL;
      const overW = rot ? Math.min(l, w) > CW : w > CW;
      const overH = h > CH;
      const placeable = (!overL || !panels.ends) && (!overW || !panels.sides) && (!overH || !panels.roof);
      // rot wandert mit: nicht drehbare Ware darf auch beim Uebermass nicht quer gelegt werden.
      if (placeable) {
        overTi.add(ti);
        const stapel = t.stackable === false ? 0 : isFinite(t.stackMax) && +t.stackMax >= 2 ? +t.stackMax : Infinity;
        for (let n = 0; n < q; n++) overUnits.push({ ti, l, w, h, rot, stapel });
      }
    });
    const masked = cargo.map((t, ti) => overTi.has(ti) ? { ...t, qty: 0 } : t);
    const base = packCargo(Ct, masked, { ...opts, noHint: true });
    const placed = base.placed.slice();
    // perType muss an cargo ausgerichtet bleiben; over-Typen wurden in masked auf 0 gesetzt.
    const perType2 = cargo.map((t, ti) => ({ loaded: base.perType[ti] ? base.perType[ti].loaded : 0, total: Math.max(0, Math.floor(num(t.qty))) }));
    let weight = base.weight;
    const payCap = num(Ct.payload) > 0 ? num(Ct.payload) : Infinity;
    overUnits.forEach((u, j) => {
      const uw = num(cargo[u.ti].weight);
      if (weight + uw > payCap + 1e-6) return; // Nutzlast-Grenze: Uebermass nicht ueberladen
      const box = placeOversize(u, Ct, panels, forceCentered, j, overUnits.length, placed);
      if (!box) return; // keine kollisionsfreie Stelle gefunden -> Stueck bleibt unverladen (zaehlt bei perType/boxes als offen, wie beim normalen Packer)
      placed.push({ ti: u.ti, x: box.x, y: box.y, z: box.z, dx: box.dx, dy: box.dy, dz: box.dz });
      perType2[u.ti].loaded++;
      weight += uw;
    });
    const contVol = CL * CW * CH / 1e6;
    let usedVol = 0;
    placed.forEach((p) => usedVol += p.dx * p.dy * p.dz / 1e6);
    const totalBoxes = cargo.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
    // Lagen zaehlen die tatsaechlichen Hoehenstufen mit: seit Uebermass-Stuecke stapeln duerfen,
    // haette "1 Lage" bei zwei uebereinander liegenden Kisten schlicht nicht gestimmt.
    return { placed, perType: perType2, contVol, usedVol, util: contVol > 0 ? usedVol / contVol * 100 : 0, weight, boxes: placed.length, totalBoxes, layers: Math.max(base.layers || 1, new Set(placed.map((p) => p.y)).size), single: false, rotHint: false, rotHintAll: false };
  }
  // Bildet ein Stueck, das in keinen Standard passt, auf den passenden Special-Typ ab.
  // Entscheidend: der Typ muss das Stueck PHYSISCH tragen koennen – in GESCHLOSSENEN
  // Richtungen muss es aufs Deck passen, in OFFENEN darf es ueberstehen. Es wird der am
  // wenigsten offene Typ gewaehlt, der das schafft (Open Top < Flat Rack < Platform):
  //   Open Top  (Seiten+Stirn zu, Dach offen) -> Breite UND Laenge muessen aufs Deck
  //   Flat Rack (nur Stirn zu)                -> nur Laenge muss aufs Deck
  //   Platform  (alles offen)                 -> traegt jede Geometrie (Ueberstand erlaubt)
  // So wird z. B. ein zu hohes Stueck, das aber laenger als das OT-Deck ist, korrekt zur
  // Platform geroutet statt zum Open Top, auf den es lengthwise gar nicht passt.
  function suggestEquipment(piece, cargo) {
    const std = Object.entries(PRESETS).filter(([n, p]) => !p.kind || p.kind === "dry").map(([n, p]) => p);
    const stdW = Math.max(...std.map((p) => p.w)), stdH = Math.max(...std.map((p) => p.h)), stdLen = Math.max(...std.map((p) => p.l));
    const pl = num(piece.l), pw = num(piece.w), ph = num(piece.h);
    if (pw <= stdW && ph <= stdH && pl <= stdLen) return null;
    const maxOf = (kind, dim) => { const v = Object.entries(PRESETS).filter(([n, p]) => p.kind === kind).map(([n, p]) => p[dim]); return v.length ? Math.max(...v) : 0; };
    let kind;
    if (pw <= maxOf("opentop", "w") && pl <= maxOf("opentop", "l")) kind = "opentop";
    else if (pl <= maxOf("flatrack", "l")) kind = "flatrack";
    else kind = "platform";
    const cand = Object.entries(PRESETS).filter(([n, p]) => p.kind === kind).map(([name, p]) => ({ name, p })).sort((a, b) => a.p.l - b.p.l);
    // Erst muss der Typ das STUECK tragen (Laenge aufs Deck), dann die MENGE. Vorher endete
    // die Suche beim ersten Deck, auf das ein einzelnes Stueck passt – acht 250er bekamen so
    // einen 20' Flat Rack empfohlen, auf den nur vier gehen.
    const tragen = cand.filter(({ p }) => pl <= p.l + 1e-6);
    const auswahl = tragen.length ? tragen : cand;
    const menge = (cargo || []).reduce((n, t) => n + Math.max(0, Math.floor(num(t.qty))), 0);
    const hit = menge > 0
      ? auswahl.find(({ p }) => packKind(p, cargo, { noHint: true, quick: true }, false).boxes >= menge) || auswahl[auswahl.length - 1]
      : auswahl[0];
    if (!hit) return null;
    // Grund passend zur Wahl: Platform = (zu) lang fuer geschlossene Stirnseiten,
    // Flat Rack = zu breit, Open Top = zu hoch. cm = Ueberstand ueber Standard (<=0 -> ohne cm).
    const reason = kind === "platform" ? { axis: "len", cm: Math.round(pl - stdLen) } : kind === "flatrack" ? { axis: "width", cm: Math.round(pw - stdW) } : { axis: "height", cm: Math.round(ph - stdH) };
    return { name: hit.name, kind, reason };
  }
  // carrier (optional): rechnet die Empfehlung mit den Massen dieser Reederei. Sonst wuerde
  // "ein 40' HC reicht" auf ISO-Massen beruhen, waehrend der 3D-Plan daneben mit der etwas
  // niedrigeren Box der Reederei rechnet und die Ladung nicht reinbekommt.
  function suggestContainer(cargo, carrier) {
    const totalBoxes = cargo.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
    if (totalBoxes === 0) return null;
    // Nur Standard-Container empfehlen; Special Equipment kommt ueber suggestEquipment (s.u.).
    const order = Object.entries(PRESETS).filter(([n, p]) => !p.kind || p.kind === "dry").map(([name, p0]) => { const p = applyCarrier(p0, carrier, name); return { name, p, vol: p.l * p.w * p.h }; }).sort((a, b) => a.vol - b.vol);
    const absLargest = order[order.length - 1];
    const hc40 = order.find((o) => o.name === "40' HC");
    const hc45 = order.find((o) => o.name === "45' HC");
    // Ehrliche Ausnahme: Der 45' HC ist in DE/EU unueblich und soll nicht der
    // bevorzugte Standard sein. Er wird nur dann zugelassen, wenn ein einzelnes
    // Packstueck physisch nicht in den 40' HC passt, aber in den 45' HC (z. B. Ueberlaenge).
    let need45 = false;
    if (hc40 && hc45) {
      for (const t of cargo) {
        if (num(t.qty) > 0 && packCargo(hc40.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes === 0 && packCargo(hc45.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes > 0) { need45 = true; break; }
      }
      // Zweite ehrliche Ausnahme (auf Jareks Wunsch): macht der 45' HC aus MEHREREN
      // Containern EINEN, darf er genannt werden. Der Ausloeser war eine reine
      // Gewichtsklemme (25 x 1.100 kg: jeder 40er deckelt bei ~26,6 t, der 45' HC
      // traegt 27,6 t) -- die Pruefung ist bewusst die ganze Ladung, nicht das
      // Einzelstueck, und greift nur, wenn der 45er wirklich ALLES nimmt. Dadurch
      // endet die Einzel-Schleife unten spaetestens bei ihm, die Kombi-Logik sieht
      // ihn nie -- und die Kette (autoFollow) kennt ihn weiterhin nicht: er bleibt
      // ein Hinweis mit Uebernehmen-Knopf, nie eine stille Auto-Wahl.
      if (!need45 && !passtAlles(hc40.p, cargo, { noHint: true, quick: true }, totalBoxes)
        && passtAlles(hc45.p, cargo, { noHint: true, quick: true }, totalBoxes)) need45 = true;
    }
    // Standard-Arbeitsmenge: ohne 45' HC (40' HC ist der groesste Standard und das "Arbeitspferd").
    // Nur im Ausnahmefall (need45) bleibt der 45' HC fuer Einzel- und Kombi-Empfehlung dabei.
    const stdOrder = need45 ? order : order.filter((o) => o.name !== "45' HC");
    const workhorse = stdOrder[stdOrder.length - 1];
    for (const o of stdOrder) {
      if (passtAlles(o.p, cargo, { noHint: true, quick: true }, totalBoxes)) return { type: "single", name: o.name, preset: o.p };
    }
    for (const t of cargo) {
      if (num(t.qty) > 0) {
        const one = packCargo(absLargest.p, [{ ...t, qty: 1 }], { noHint: true, quick: true });
        if (one.boxes === 0) {
          // packCargo liefert boxes===0 sowohl bei zu GROSS als auch bei zu SCHWER (Payload-Deckel in
          // packCargo). Erst pruefen, ob EIN Stueck rein raeumlich (payload:0 => Gewicht ignoriert) in
          // den groessten Container passt – sonst wuerde ein reines Gewichtsproblem faelschlich als
          // "zu gross" gemeldet (z. B. 1 Palette mit 30 t).
          const oneDim = packCargo({ ...absLargest.p, payload: 0 }, [{ ...t, qty: 1 }], { noHint: true, quick: true });
          if (oneDim.boxes === 0) {
            const eq = suggestEquipment({ l: num(t.l), w: num(t.w), h: num(t.h) }, cargo);
            if (eq) return { type: "equip", name: eq.name, kind: eq.kind, item: t.name, reason: eq.reason };
            return { type: "toobig", name: absLargest.name, item: t.name };
          }
          // Passt raeumlich, aber in KEINEN Standard-Container vom Gewicht her -> ehrlich "zu schwer".
          const fitsAnyByWeight = stdOrder.some((o) => packCargo(o.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes > 0);
          if (!fitsAnyByWeight) return { type: "tooheavy", item: t.name };
        }
      }
    }
    let remaining = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
    // Die Kombination wird zweimal gesucht -- gierig und sortenrein -- und die bessere
    // gewinnt. Ohne das nennt das Empfehlungsbanner eine SCHLECHTERE Kombination als die,
    // die der Rechner darunter tatsaechlich baut ("2x 40' HC + 1x 40' GP", waehrend in der
    // Kette ein 20-Fuesser steht). Zwei widerspruechliche Zahlen nebeneinander sind
    // schlimmer als eine ungenaue.
    const OPT = { noHint: true, quick: true };
    const kombiMit = (sortenrein, klein) => {
      let rest = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
      const used = {};
      let guard = 0, vol = 0, n = 0, kleiner = false;
      while (guard++ < 80) {
        const tot = rest.reduce((s, t) => s + t.qty, 0);
        if (tot === 0) break;
        // Passt der ganze Rest in EINEN Container? Dann den kleinsten davon nehmen.
        let fit = null;
        for (const o of stdOrder) {
          if (passtAlles(o.p, rest, OPT, tot)) { fit = o; break; }
        }
        if (fit) {
          used[fit.name] = (used[fit.name] || 0) + 1;
          vol += fit.vol; n++;
          rest = rest.map((t) => ({ ...t, qty: 0 }));
          break;
        }
        const packen = (p) => sortenrein
          ? packSortenrein(p, rest, sortenReihenfolge(rest), null, OPT)
          : packCargo(p, rest, OPT);
        let r = packen(workhorse.p), pick = workhorse;
        if (r.boxes === 0) break;
        // Traegt ein kleinerer Container dasselbe (das Gewicht teilt, nicht der Platz),
        // wird er genannt -- wie in der Kette (kleinerReicht).
        const kl = klein ? kleinerReicht(stdOrder, workhorse, r, packen) : null;
        if (kl) { pick = kl.o; r = kl.r; kleiner = true; }
        used[pick.name] = (used[pick.name] || 0) + 1;
        vol += pick.vol; n++;
        rest = rest.map((t, i) => ({ ...t, qty: t.qty - (r.perType[i] ? r.perType[i].loaded : 0) }));
      }
      return { used, offen: rest.reduce((s, t) => s + t.qty, 0), n, vol, kleiner };
    };
    // Dieselbe Rangfolge wie bei der Kette: was liegenbleibt, dann die Zahl der
    // Container, dann das gebuchte Volumen.
    const besser = (a, b) => a.offen < b.offen || (a.offen === b.offen && (a.n < b.n || (a.n === b.n && a.vol < b.vol)));
    // Mit kleineren Folgecontainern wird nur empfohlen, was sich gegen die alte Regel
    // ("sonst immer der groesste") beweist -- sie kann nie einen Container kosten.
    const kombi = (sortenrein) => {
      const neu = kombiMit(sortenrein, true);
      if (!neu.kleiner) return neu;
      const alt = kombiMit(sortenrein, false);
      return besser(neu, alt) ? neu : alt;
    };
    let best = kombi(false);
    const sorten = cargo.filter((t) => Math.floor(num(t.qty)) > 0 && num(t.l) > 0 && num(t.w) > 0 && num(t.h) > 0).length;
    if (sorten > 1 && sorten <= SORTENREIN_MAX) {
      const rein = kombi(true);
      if (besser(rein, best)) best = rein;
    }
    const combo = stdOrder.slice().reverse().filter((o) => best.used[o.name]).map((o) => ({ name: o.name, count: best.used[o.name] }));
    return { type: "multi", combo };
  }
  // Landfracht-Empfehlung: Wie viele GLEICHE Fahrzeuge (das aktuell gewaehlte) braucht es, wenn
  // nicht alles auf eines passt? Iterativ packen, Geladenes abziehen, Fahrzeuge zaehlen. Rein
  // geometrisch + Nutzlast (packCargo deckelt bei payload). "ca." – keine Achslast/Sicherung.
  function suggestVehicles(vehicle, cargo, name) {
    const totalBoxes = cargo.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
    if (totalBoxes === 0) return null;
    let remaining = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
    let count = 0, guard = 0;
    while (guard++ < 60) {
      const tot = remaining.reduce((s, t) => s + t.qty, 0);
      if (tot === 0) break;
      const r = packCargo(vehicle, remaining, { noHint: true, quick: true });
      if (r.boxes === 0) break; // Rest passt in kein weiteres (gleiches) Fahrzeug -> zu gross/schwer
      count++;
      remaining = remaining.map((t, i) => ({ ...t, qty: t.qty - (r.perType[i] ? r.perType[i].loaded : 0) }));
    }
    if (count <= 1) return null; // ein Fahrzeug reicht -> keine "zweiter LKW"-Empfehlung noetig
    return { type: "vehicles", name, count };
  }
  // Container-Empfehlung (Vergleich): rechnet die Ladung gegen alle Standard-
  // Container (dry) durch. Reine Leseschicht ueber packCargo – KEINE Aenderung
  // an Solver oder suggestContainer. 45'-HC-Ausnahme wie in suggestContainer:
  // nur anzeigen, wenn ein Einzelstueck ihn physisch erfordert (need45).
  function recommendAll(cargo, carrier) {
    const totalBoxes = cargo.reduce((s, t) => s + Math.max(0, Math.floor(num(t.qty))), 0);
    if (totalBoxes === 0) return null;
    const order = Object.entries(PRESETS)
      .filter(([n, p]) => !p.kind || p.kind === "dry")
      .map(([name, p0]) => { const p = applyCarrier(p0, carrier, name); return { name, p, vol: p.l * p.w * p.h }; })
      .sort((a, b) => a.vol - b.vol);
    const hc40 = order.find((o) => o.name === "40' HC");
    const hc45 = order.find((o) => o.name === "45' HC");
    let need45 = false;
    if (hc40 && hc45) {
      for (const t of cargo) {
        if (num(t.qty) > 0
          && packCargo(hc40.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes === 0
          && packCargo(hc45.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes > 0) { need45 = true; break; }
      }
    }
    const rows = (need45 ? order : order.filter((o) => o.name !== "45' HC")).map((o) => {
      const r = packCargo(o.p, cargo, { noHint: true, quick: true });
      const totKg = r.weight;
      const payPct = num(o.p.payload) > 0 ? totKg / num(o.p.payload) * 100 : 0;
      return {
        name: o.name,
        fits: r.boxes >= totalBoxes,
        boxes: r.boxes,
        totalBoxes,
        // packCargo liefert util bereits in % (usedVol/contVol*100, s. Z. ~437)
        util: r.util,
        payPct
      };
    });
    // Kombi nur berechnen, wenn kein Einzelcontainer reicht.
    const anyFits = rows.some((r) => r.fits);
    const combo = anyFits ? null : suggestContainer(cargo, carrier);
    return { rows, combo, need45 };
  }
  // Baut die Kette der in der 3D-Ansicht dargestellten Container auf. Slot 0 ist der
  // gewählte Container; Folge-Container werden automatisch als KLEINSTER Standard-Typ
  // gewählt, der den Rest aufnimmt (weniger ungenutzter Raum – eine Wahl nach Größe,
  // nicht nach Preis), bzw. per overrides[slot] manuell übersteuert. Es wird nur
  // packCargo (unverändert) erneut angewendet – keine Änderung an der Pack-Logik.
  // Wie weit die Kette GERECHNET wird und wie viele Huellen davon GEZEICHNET werden --
  // zwei verschiedene Zahlen, weil es zwei verschiedene Fragen sind. "Wie viele Container
  // brauche ich" beantwortet man mit einer Zahl, "wie steht die Ladung" mit einem Bild.
  //
  // Vorher galt fuer beides 4. Wer 39 Paletten eingab, sah vier Huellen und darunter
  // "15 offen - weitere Container noetig", ohne je zu erfahren, wie viele. Es sind sieben.
  //
  // Gerechnet wird bis 24. Das kostet fast nichts, weil jeder Folgecontainer weniger Rest
  // zu packen hat: gemessen 92 ms fuer die 39 Paletten (bei Grenze 4 waren es 133 -- es
  // wird schneller) und 727 ms im schlimmsten nachgestellten Fall, 1.900 Packstuecke auf
  // zehn Container. Gezeichnet werden 8; darueber wird jede Huelle im Bild zum Strich.
  var MAXCHAIN = 24, MAXDRAW = 8;
  // Was ist ueber die GANZE Kette verladen? Ohne diese Bilanz zeigte die Ladungsliste die
  // Zahlen des ersten Containers -- "0/1" an einem Packstueck, das im zweiten Container
  // liegt und im Bild daneben zu sehen ist. Mehr als ein Container ist ein Entschluss,
  // kein Fehler; die Liste muss den ganzen Plan zaehlen, nicht seinen ersten Teil.
  function kettenBilanz(cargo, remaining) {
    return cargo.map((t, i) => {
      const total = Math.max(0, Math.floor(num(t.qty)));
      const offen = Math.max(0, remaining[i] ? remaining[i].qty : 0);
      return { loaded: Math.max(0, total - offen), total };
    });
  }
  // Von Hand gestaut: dieselbe Ergebnisform wie aus dem Packer, aber NICHTS gerechnet --
  // nur summiert, was steht. Damit lesen Leiste, Fokus, Details und Bild im manuellen Modus
  // aus derselben Quelle wie sonst, statt jede Stelle einen Sonderweg zu bekommen.
  //
  // basis ist das Auto-Ergebnis desselben Containers: Gesamtmenge, Containervolumen, die
  // Dreh-Hinweise und die Uebermass-Rechnung haengen an Container und Ladung, nicht an der
  // Verteilung, und bleiben deshalb stehen.
  function manuellBilanz(basis, chain, placed, cargo) {
    const inSlot = (i) => placed.filter((b) => (+b.slot || 0) === i);
    const vol = (l) => l.reduce((s, b) => s + b.dx * b.dy * b.dz / 1e6, 0);
    const kg = (l) => l.reduce((s, b) => s + (cargo[b.ti] ? num(cargo[b.ti].weight) : 0), 0);
    const c0 = inSlot(0);
    const contVol = basis && basis.contVol > 0 ? basis.contVol : 0;
    const usedVol = vol(c0);
    const je = cargo.map((t, i) => ({
      loaded: placed.filter((b) => b.ti === i).length,
      total: Math.max(0, Math.floor(num(t.qty)))
    }));
    return {
      ...basis,
      chain: chain.map((c, i) => ({ name: c.name, preset: c.preset, placed: inSlot(i) })),
      placed: c0,
      perType: cargo.map((t, i) => ({ loaded: c0.filter((b) => b.ti === i).length, total: Math.max(0, Math.floor(num(t.qty))) })),
      perTypeAll: je,
      usedVol,
      util: contVol > 0 ? usedVol / contVol * 100 : 0,
      weight: kg(c0),
      boxes: c0.length,
      layers: c0.length ? new Set(c0.map((b) => Math.round(b.y))).size : 0,
      remainingBoxes: je.reduce((s, p) => s + Math.max(0, p.total - p.loaded), 0),
      // Von Hand gestaut gibt es weder eine gekappte Kette noch eine Zuweisung, die etwas
      // liegen laesst: wie viele Container es gibt, hat der Mensch davor entschieden.
      gekappt: false,
      pinOffen: 0
    };
  }
  // ── Sortenrein statt gleichzeitig: gleiche Ware gehoert in denselben Container ──
  //
  // Gemeldet, mit Bild: 8 grosse Packstuecke (600x220x100) und 22 Paletten. Der gierige
  // Packer legte in den ERSTEN Container 22 Paletten UND 2 der grossen Stuecke -- weil das
  // dort die meisten Stuecke sind (24 statt 22). Die uebrigen 6 grossen Stuecke brauchten
  // danach ZWEI weitere 40-Fuss-Container, der letzte davon fuer ganze zwei Stueck.
  //
  // Sortenrein waeren es dieselben drei Container gewesen -- aber 4 + 4 grosse Stuecke in
  // zwei 40-Fuessern und die 22 Paletten in einem 20-Fuesser. Gleiche Zahl, kleinerer
  // dritter Container, und ein Bild, nach dem sich laden laesst.
  //
  // Das ist der klassische Greedy-Fehler: lokal das Maximum, global das schlechtere
  // Ergebnis. Der Ausweg ist nicht, gierig abzuschaffen, sondern eine ZWEITE Kette daneben
  // zu stellen und am Ende die bessere zu nehmen.
  //
  // Reihenfolge der Sorten: das groesste Stueck zuerst. Es bestimmt die Aufteilung; die
  // Kleinteile fuellen hinterher auf, nicht umgekehrt.
  function sortenReihenfolge(rest) {
    const vol = (t) => num(t.l) * num(t.w) * num(t.h);
    return rest.map((_, i) => i).filter((i) => rest[i].qty > 0)
      .sort((a, b) => vol(rest[b]) - vol(rest[a]) || rest[b].qty - rest[a].qty || a - b);
  }
  // Packt EINEN Container sortenrein: angeboten wird nur der Anfang der Sortenliste, bis
  // einschliesslich der ersten Sorte, die nicht mehr vollstaendig hineingeht. Alles danach
  // wuerde nur Platz belegen, den diese Sorte im naechsten Container ohnehin wieder braucht.
  //
  // Ein Probelauf mit ALLEM sagt, wo diese Grenze liegt -- das kostet einen zweiten Packlauf
  // und nicht einen je Sorte. Geht ohnehin alles hinein, gibt es nichts zu trennen.
  function packSortenrein(preset, rest, reihenfolge, probe, opts) {
    const o = opts || { noHint: true };
    // Der Probelauf ist reine DIAGNOSE -- er sagt nur, wo die erste angebrochene Sorte
    // liegt, und geht nicht ins Ergebnis. Deshalb "quick" (ohne Restarts): das kostete
    // sonst den dritten Teil der gesamten Rechenzeit. Liegt er daneben, wird die
    // sortenreine Kette am Ende ohnehin von ketteBesser verworfen.
    // Fuer den ersten Container ist der Probelauf bereits gerechnet (slot0) -- der wird
    // durchgereicht statt noch einmal gepackt.
    const alles = probe || packCargo(preset, rest, { ...o, quick: true });
    let bis = -1;
    for (let k = 0; k < reihenfolge.length; k++) {
      const i = reihenfolge[k];
      if ((alles.perType[i] ? alles.perType[i].loaded : 0) < rest[i].qty) { bis = k; break; }
    }
    if (bis < 0 || bis >= reihenfolge.length - 1) return alles; // nichts zu trennen
    const nimm = new Set(reihenfolge.slice(0, bis + 1));
    const teil = rest.map((t, i) => nimm.has(i) ? t : { ...t, qty: 0 });
    const r = packCargo(preset, teil, o);
    // Der Probelauf war quick -- fuer das ECHTE Ergebnis wird hier mit den Optionen des
    // Aufrufers gerechnet.
    return r.boxes > 0 ? r : packCargo(preset, rest, o);
  }
  // Welche der beiden Ketten ist besser? Der Reihe nach:
  //   1. was liegenbleibt   -- eine Kette, die Ladung stehen laesst, gewinnt nie.
  //   2. Zahl der Container -- die Frage, mit der der Nutzer hier ist.
  //   3. gebuchtes Containervolumen -- bei drei Containern ist 2x 40' + 1x 20' billiger als
  //      3x 40'. Das ist der Unterschied, um den es in der Meldung ging, und es ist Geld.
  //   4. Sortenstreuung     -- gleiche Ware in einem Container laesst sich laden, verzollen
  //      und ausliefern. Nur der Gleichstand-Entscheid, nie ein Grund fuer einen Container mehr.
  // ── Die Zuweisung: welche Position in welchen Container ─────────────────────────────
  //
  // Gewuenscht als "der User waehlt selbst aus, welche Packstuecke in welchen Container
  // kommen". Eine Position traegt dafuer "slot" -- null heisst Auto (der Normalfall und die
  // Voreinstellung), sonst der Index eines Containers der Kette.
  //
  // ENTSCHIEDEN wurde "DORT ZUERST", nicht "nur dort". Der Unterschied ist die ganze
  // Funktion: nachgerechnet an der gemeldeten Sendung landen unter "nur dort" 2 von 9
  // gepinnten Stuecken im Container (die Paletten sind frueher dran), unter "dort zuerst" 8
  // von 9 -- mehr passen auch allein nicht hinein. Eine Zuweisung, die schwaecher ist als die
  // Reihenfolge im Packer, ist schlimmer als gar keine.
  //
  // Umgesetzt in zwei Laeufen: erst die zugewiesene Ware in den leeren Container, dann der
  // Rest auf ihr als Vorbelegung (siehe opts.vorbelegt). Ohne Zuweisung an diesem Slot
  // laeuft genau ein Lauf -- Wort fuer Wort der alte Weg.
  //
  // Was einem ANDEREN Slot zugewiesen ist, wird hier gar nicht erst angeboten. Und was nicht
  // hineingeht, bleibt OFFEN und sagt es; es rutscht nicht heimlich in den naechsten
  // Container. Sonst waere die Zuweisung wieder nur ein Vorschlag.
  function slotPins(cargo) {
    const p = cargo.map((t) => (Number.isInteger(t.slot) && t.slot >= 0 ? t.slot : null));
    return p.some((v) => v != null) ? p : null;
  }
  // ── Multi-Stopp: die Entladereihenfolge bestimmt die Stauung (LIFO) ──
  //
  // Jede Position kann einen Stopp tragen (1, 2, 3 ...). Der Plan wird dann so
  // gestaut, dass Stopp 1 an der Tuer steht und die hoechste Nummer an der
  // Stirnwand -- was zuerst raus muss, kommt zuletzt rein. Ware verschiedener
  // Stopps wird NICHT vermischt: weder gestapelt noch in Luecken der anderen
  // eingesickert. Das kann Stellplaetze kosten, und das ist der ausgewiesene
  // Preis der Anweisung (dasselbe Muster wie bei der Container-Zuweisung) --
  // ein Plan, der beim zweiten Stopp das halbe Ausraeumen verlangt, ist an der
  // Rampe wertlos, egal wie voll er ist.
  //
  // Umgesetzt als WELLEN ueber packCargo: ohne Stopp zuerst (bleibt bis zuletzt
  // geladen, Stirnwand), dann Stopps absteigend, Stopp 1 zuletzt. Jede Welle
  // packt auf einer Vorbelegung (opts.vorbelegt, Schritt 04) aus den vorigen
  // Wellen PLUS einer virtuellen Trennwand von der Stirnwand bis zur hintersten
  // Kante des schon Gestauten, volle Breite und Hoehe. Die Wand haelt die
  // naechste Welle aus den Luecken UND von den Deckeln der vorigen; sie traegt
  // kein Gewicht (ti -1 -> num(undefined) = 0), das echte Gewicht der vorigen
  // Wellen zaehlt ueber die mitgegebenen Kisten gegen die Zuladung.
  function stoppWerte(cargo) {
    const s = cargo.map((t) => (Number.isInteger(t.stop) && t.stop >= 1 ? Math.min(9, t.stop) : null));
    return s.some((v) => v != null) ? s : null;
  }
  function stoppPacken(preset, rest, opts, pins, slotIdx) {
    const stopps = stoppWerte(rest) || rest.map(() => null);
    const CL = num(preset.l), CW = num(preset.w), CH = num(preset.h);
    const folge = [null, ...[...new Set(stopps.filter((v) => v != null))].sort((a, b) => b - a)];
    let placed = [], usedVol = 0, weight = 0;
    const loaded = rest.map(() => 0);
    const lauf = (teil) => {
      if (!teil.some((t) => num(t.qty, 0) > 0)) return;
      const grenzX = placed.reduce((m, b) => Math.max(m, b.x + b.dx), 0);
      const vor = placed.length
        ? [{ x: 0, y: 0, z: 0, dx: Math.max(grenzX, 0.01), dy: CH, dz: CW, ti: -1 }, ...placed]
        : null;
      const r = packCargo(preset, teil, vor ? { ...opts, vorbelegt: vor } : opts);
      placed = placed.concat(r.placed);
      r.perType.forEach((pt, i) => loaded[i] += pt.loaded || 0);
      usedVol += r.usedVol;
      weight += r.weight;
    };
    for (const st of folge) {
      const welle = rest.map((t, i) => (stopps[i] === st ? t : { ...t, qty: 0 }));
      if (pins) {
        // Zuweisung + Stopp zusammen: die Stopp-Reihenfolge dominiert, innerhalb
        // der Welle gilt weiter "dort zuerst" -- erst die gepinnte Ware der
        // Welle, dann ihre freie.
        lauf(welle.map((t, i) => (pins[i] === slotIdx ? t : { ...t, qty: 0 })));
        lauf(welle.map((t, i) => (pins[i] == null ? t : { ...t, qty: 0 })));
      } else lauf(welle);
    }
    const contVol = CL * CW * CH / 1e6;
    return {
      placed,
      perType: rest.map((t, i) => ({ loaded: loaded[i], total: Math.max(0, Math.floor(num(t.qty))) })),
      contVol,
      usedVol,
      util: contVol > 0 ? usedVol / contVol * 100 : 0,
      weight,
      boxes: placed.length,
      totalBoxes: rest.reduce((a2, t) => a2 + Math.max(0, Math.floor(num(t.qty))), 0),
      layers: placed.length ? new Set(placed.map((b) => Math.round(b.y))).size : 0,
      single: false, rotHint: false, rotHintAll: false
    };
  }
  function slotPacken(preset, rest, slotIdx, pins, opts, sortenrein) {
    // Mit Stopps packt IMMER die Wellen-Fassung -- sie ist der einzige Weg, der
    // die Entladereihenfolge haelt. Sortenrein widerspraeche ihr nur.
    const stopps = stoppWerte(rest);
    const frei = pins ? rest.map((t, i) => (pins[i] == null ? t : { ...t, qty: 0 })) : rest;
    const hatPin = !!pins && rest.some((t, i) => t.qty > 0 && pins[i] === slotIdx);
    if (stopps) {
      const angebot = pins ? rest.map((t, i) => (pins[i] == null || pins[i] === slotIdx ? t : { ...t, qty: 0 })) : rest;
      return stoppPacken(preset, angebot, opts, hatPin ? pins : null, slotIdx);
    }
    if (!hatPin) {
      // Ohne Zuweisung an diesem Slot: der alte Weg. Angeboten wird alles Freie; was einem
      // anderen Container gehoert, bleibt aussen vor.
      return sortenrein ? packSortenrein(preset, frei, sortenReihenfolge(frei), null, opts) : packCargo(preset, frei, opts);
    }
    const gepinnt = rest.map((t, i) => (pins[i] === slotIdx ? t : { ...t, qty: 0 }));
    const p1 = packCargo(preset, gepinnt, opts);
    // Der zweite Lauf ist bewusst NICHT sortenrein: welche Sorte wohin gehoert, hat der
    // Nutzer mit der Zuweisung schon beantwortet.
    const p2 = packCargo(preset, frei, { ...opts, vorbelegt: p1.placed });
    // Zusammengefuehrt in der VOLLEN Form eines packCargo-Ergebnisses. Der erste Container
    // der Kette wird als slot0 in die Oberflaeche uebernommen (Leiste, Details, Bild) und
    // braucht jedes Feld -- ein halbes Ergebnis dort waere eine zweite Wahrheit.
    const placed = p1.placed.concat(p2.placed);
    const usedVol = p1.usedVol + p2.usedVol;
    return {
      placed,
      perType: rest.map((t, i) => ({
        loaded: (p1.perType[i] ? p1.perType[i].loaded : 0) + (p2.perType[i] ? p2.perType[i].loaded : 0),
        total: Math.max(0, Math.floor(num(t.qty)))
      })),
      contVol: p1.contVol,
      usedVol,
      util: p1.contVol > 0 ? usedVol / p1.contVol * 100 : 0,
      weight: p1.weight + p2.weight,
      boxes: p1.boxes + p2.boxes,
      totalBoxes: rest.reduce((a2, t) => a2 + Math.max(0, Math.floor(num(t.qty))), 0),
      layers: placed.length ? new Set(placed.map((b) => Math.round(b.y))).size : 0,
      single: false, rotHint: false, rotHintAll: false
    };
  }
  function ketteBesser(a, b) {
    if (!a || !b) return !!a;
    const masse = (k) => [k.totRem, k.chain.length,
      k.chain.reduce((s, c) => s + num(c.preset.l) * num(c.preset.w) * num(c.preset.h), 0),
      k.chain.reduce((s, c) => s + new Set(c.placed.map((x) => x.ti)).size, 0)];
    const ma = masse(a), mb = masse(b);
    for (let i = 0; i < ma.length; i++) {
      if (ma[i] < mb[i] - 1e-6) return true;
      if (ma[i] > mb[i] + 1e-6) return false;
    }
    return false;
  }
  // ── Stufe 2: das Gewicht ueber die Kette verteilen, OHNE einen Container mehr zu brauchen ──
  //
  // Stufe 1 (chainContainers/chainVehicles) fuellt gierig: der erste Container bekommt alles,
  // was hineingeht, der letzte den Rest. Das beantwortet "wie viele brauche ich?" mit der
  // kleinsten Zahl -- und liefert daneben eine Verteilung, die so niemand bucht: 26 t, 26 t,
  // 15 t. Jeder Container wird einzeln gestellt, einzeln gewogen und einzeln gefahren; drei
  // annaehernd gleich schwere sind an der Rampe das Gewuenschte.
  //
  // Beide Ziele zusammen gehen, weil es zwei STUFEN sind und nicht ein Ziel:
  //   1. Stufe 1 bestimmt N -- die kleinste Zahl Container, die die Ladung aufnimmt.
  //   2. Stufe 2 verteilt bei FESTEM N neu und wird nur uebernommen, wenn danach immer noch
  //      alles in dieselben N Container passt. Der Ausgleich kann also nie einen Container
  //      kosten; geht er nicht auf, bleibt die gierige Verteilung stehen.
  //
  // Das Werkzeug dafuer ist die Zuladung selbst: jeder Container wird mit einer KUENSTLICH
  // gesenkten Zuladung gepackt (dem Zielgewicht), nur der letzte mit seiner echten. Der
  // Packer laesst dann von sich aus schwere Stuecke fuer die naechsten Container liegen --
  // es braucht keinen zweiten Algorithmus, nur eine andere Schranke.
  //
  // Ein Zielgewicht exakt auf dem Schnitt geht selten auf: das naechste Stueck passt immer
  // knapp nicht mehr, und was vorne liegenbleibt, muss hinten zusaetzlich hinein. Deshalb
  // ein paar Prozent Luft, in Stufen -- die erste Stufe, die aufgeht, gewinnt.
  var AUSGLEICH_LUFT = [1, 1.08, 1.2, 1.45];
  var AUSGLEICH_MAXSTK = 600; // darueber ist der zweite Durchgang die Rechenzeit nicht wert
  // Und der wichtigste Waechter: der Ausgleich greift NUR, wenn das Gewicht ueberhaupt die
  // Grenze ist.
  //
  // Gemeldet, mit Bild: acht grosse Packstuecke (600x220x100) und 22 Paletten, zusammen
  // 9 Tonnen auf drei Containern mit je 26,6 t Zuladung -- elf Prozent. Trotzdem hat der
  // Ausgleich die Ladung auf 10/10/10 Stueck umverteilt und damit eine saubere Aufteilung
  // (die Paletten hierhin, die grossen Stuecke dorthin) in drei zusammengewuerfelte
  // Container verwandelt, in denen nichts mehr zusammengehoerte.
  //
  // Wo Gewicht nichts entscheidet, darf es auch nichts entscheiden. Erst wenn ein Container
  // ueber diesem Anteil seiner Zuladung liegt, ist die gleichmaessige Verteilung ein echtes
  // Ziel -- vorher ist sie nur Kosmetik, die die Geometrie zerstoert.
  var AUSGLEICH_AB = 0.6;
  // Und die Untergrenze dazu: ein fast leerer UEBERLAUF-Container bleibt Ueberlauf.
  // Gemeldet, mit Bild: 25 schwere IBC im 40' GP -- gierig 24 + 1 (der zweite Container
  // existiert fuer genau EIN Stueck), nach dem Ausgleich 12 + 13. Der gewaehlte 40'
  // sah halb leer aus, und die wertvollste Aussage des Plans, "genau ein Stueck ist
  // zu viel", war weg. Erst wenn schon die gierige Kette JEDEN Container nennenswert
  // belaedt, ist "gleich schwer" ein Ziel; die 37-Paletten-Sendung, fuer die der
  // Ausgleich gebaut wurde, lag beim leichtesten Container bei 63 Prozent.
  var AUSGLEICH_MIN = 0.2;
  // Sortenrein lohnt bei wenigen, deutlich verschiedenen Sorten. Bei 37 einzeln erfassten
  // Paletten waere jede Sorte ein Stueck -- da gibt es nichts zu trennen, nur Rechenzeit.
  var SORTENREIN_MAX = 12;
  function slotKg(placed, cargo) {
    let kg = 0;
    for (const b of placed) { const t = cargo[b.ti]; if (t) kg += Math.max(0, num(t.weight)); }
    return kg;
  }
  // Warum mehrere Container? Wenn die Kette teilt, obwohl der erste Container halb
  // leer AUSSIEHT, war das Gewicht die Grenze -- gemeldet (25 IBC zu je 1.100 kg:
  // "ich habe nicht auf das Gewicht geachtet und mich gewundert, wieso er das auf
  // mehrere Container verteilt"). Die Gegenprobe ist derselbe Packlauf ohne
  // Gewichtsdeckel: passt dann mehr hinein, hat die Zuladung geteilt, nicht der
  // Platz. Nur dann gibt es etwas zu erklaeren -- ein raeumlich voller Container
  // erklaert sich selbst.
  function kettenGrund(preset0, cargo, chain) {
    if (!chain || chain.length < 2 || !chain[0] || !(chain[0].placed || []).length) return null;
    const pay = num(preset0 && preset0.payload);
    if (!(pay > 0)) return null;
    const kg = slotKg(chain[0].placed, cargo);
    // Die Zuladung ist die Grenze, wenn sie fast erreicht ist -- oder wenn schon das
    // leichteste Stueck, das draussen blieb, sie reissen wuerde. Das zweite fehlte bis
    // 27.11.26: zwei Stueck zu je 10 t sind 71 Prozent der Zuladung eines 20-Fuessers, ein
    // drittes geht trotzdem nicht -- und genau dort stand keine Zeile (gemeldet mit Bild).
    const drin = cargo.map(() => 0);
    for (const b of chain[0].placed) if (drin[b.ti] != null) drin[b.ti]++;
    let leicht = Infinity;
    cargo.forEach((t, i) => {
      const w = Math.max(0, num(t.weight));
      if (Math.floor(num(t.qty)) - drin[i] > 0 && w > 0 && w < leicht) leicht = w;
    });
    const reisst = leicht < Infinity && kg + leicht > pay + 1e-6;
    if (kg < pay * 0.9 && !reisst) return null; // die Zuladung war nicht die Grenze
    const ohne = packCargo({ ...preset0, payload: 0 }, cargo, { noHint: true, quick: true });
    if (ohne.boxes <= chain[0].placed.length) return null; // auch ohne Deckel nicht mehr: der Platz teilt
    return { kg, pay };
  }
  function ketteAusgleichen(chain, cargo, ordentlich, pins) {
    const N = chain.length;
    if (N < 2 || N > MAXDRAW) return null;
    const stueck = cargo.map((t) => Math.max(0, Math.floor(num(t.qty))));
    const gesStk = stueck.reduce((a, b) => a + b, 0);
    if (gesStk <= 0 || gesStk > AUSGLEICH_MAXSTK) return null;
    const gesKg = cargo.reduce((a, t, i) => a + stueck[i] * Math.max(0, num(t.weight)), 0);
    if (!(gesKg > 0)) return null; // ohne Gewichte gibt es nichts auszugleichen
    const spanne = (k) => Math.max(...k) - Math.min(...k);
    const istKg = chain.map((c) => slotKg(c.placed, cargo));
    const istSpanne = spanne(istKg);
    if (istSpanne <= 1e-6) return null; // schon gleich verteilt
    // Bindet das Gewicht ueberhaupt? Wenn kein Container auch nur in die Naehe seiner
    // Zuladung kommt, ist jede Umverteilung ein Eingriff ohne Gegenwert.
    const voll = chain.map((c, i) => { const p = num(c.preset && c.preset.payload); return p > 0 ? istKg[i] / p : 0; });
    if (Math.max(...voll) < AUSGLEICH_AB) return null;
    // Untergrenze (AUSGLEICH_MIN): traegt ein Container der gierigen Kette fast nichts,
    // ist er ein Ueberlauf fuer die letzten Stuecke -- den aufzupumpen wuerde die
    // Aussage "fast alles passt in die Container davor" zerstoeren.
    if (Math.min(...voll) < AUSGLEICH_MIN) return null;
    // Zuladung je Slot. Ohne Angabe (Custom ohne Gewichtsgrenze) zaehlt der Container mit dem
    // Durchschnitt mit -- sonst zoege ein einziges Infinity die ganze Verteilung an sich.
    const zul = chain.map((c) => num(c.preset && c.preset.payload) > 0 ? num(c.preset.payload) : 0);
    const schnitt = zul.reduce((a, b) => a + b, 0) / N || 1;
    for (let i = 0; i < N; i++) if (!zul[i]) zul[i] = schnitt;
    const versuch = (f) => {
      let rest = cargo.map((t, i) => ({ ...t, qty: stueck[i] }));
      let restKg = gesKg, offen = gesStk;
      let restPay = zul.reduce((a, b) => a + b, 0);
      const neu = [];
      for (let i = 0; i < N && offen > 0; i++) {
        const p = chain[i].preset;
        const voll = zul[i];
        // Zielgewicht ANTEILIG ZUR ZULADUNG, nicht stur der Durchschnitt: bei gleichen
        // Containern ist das dasselbe (der Normalfall), bei gemischten heisst "gleichmaessig
        // verteilt" nicht "gleich viele Kilo", sondern "keiner prozentual voller als die
        // anderen". Der letzte nimmt, was bleibt -- ohne ihn als Auffangbecken ginge die
        // Rechnung am letzten Rundungsrest auf.
        const ziel = i === N - 1 ? voll : Math.min(voll, restKg * (voll / restPay) * f);
        const rr = slotPacken({ ...p, payload: ziel }, rest, i, pins, { noHint: true, ordentlich }, false);
        neu.push({ ...chain[i], placed: rr.placed, res: rr });
        rest = rest.map((t, k) => ({ ...t, qty: t.qty - (rr.perType[k] ? rr.perType[k].loaded : 0) }));
        restKg -= rr.weight;
        restPay -= voll;
        offen -= rr.placed.length;
      }
      return offen <= 0 ? neu : null;
    };
    for (const f of AUSGLEICH_LUFT) {
      const neu = versuch(f);
      if (!neu) continue;
      if (spanne(neu.map((c) => slotKg(c.placed, cargo))) >= istSpanne - 1e-6) return null; // kein Gewinn
      const slot0 = neu[0].res;
      return { chain: neu.map((c) => ({ name: c.name, preset: c.preset, placed: c.placed })), slot0 };
    }
    return null;
  }
  function chainContainers(container0, preset0, cargo, slot0, overrides, MAXVIS, carrier) {
    // Auto-Folgecontainer nur aus Standard-Typen; Special Equipment nur per manueller Wahl.
    // Folgecontainer kommen von derselben Reederei wie der erste – eine Buchung, ein Equipment-Pool.
    const order = Object.entries(PRESETS).filter(([n, p]) => !p.kind || p.kind === "dry").map(([name, p0]) => { const p = applyCarrier(p0, carrier, name); return { name, p, vol: p.l * p.w * p.h }; }).sort((a, b) => a.vol - b.vol);
    const hc40 = order.find((o) => o.name === "40' HC"), hc45 = order.find((o) => o.name === "45' HC");
    let need45 = false;
    if (hc40 && hc45) {
      for (const t of cargo) {
        if (num(t.qty) > 0 && packCargo(hc40.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes === 0 && packCargo(hc45.p, [{ ...t, qty: 1 }], { noHint: true, quick: true }).boxes > 0) { need45 = true; break; }
      }
    }
    const stdOrder = need45 ? order : order.filter((o) => o.name !== "45' HC");
    const workhorse = stdOrder[stdOrder.length - 1];
    const autoFollow = (rem, totRem) => {
      for (const o of stdOrder) {
        if (passtAlles(o.p, rem, { noHint: true, quick: true }, totRem)) return o;
      }
      return workhorse;
    };
    // Eine Kette bauen -- entweder gierig (alle Sorten gleichzeitig, wie bisher) oder
    // sortenrein. Der erste Container ist der gewaehlte; gierig uebernimmt ihn fertig aus
    // slot0, sortenrein packt ihn neu (und gibt ihn als slot0 zurueck, damit die Leiste
    // dieselben Zahlen zeigt wie die Tabelle darunter).
    const pins = slotPins(cargo);
    // Stopps greifen nur beim gewoehnlichen Trockencontainer bzw. Fahrzeug:
    // Special Equipment packt packKind, und ein Wellen-Lauf ueber packCargo
    // liesse Uebermass-Stuecke stillschweigend fallen (Grenze wie beim Ausgleich).
    const stopps = (container0.kind || "dry") === "dry" ? stoppWerte(cargo) : null;
    // klein: darf ein Folgecontainer kleiner ausfallen als der groesste, wenn er dasselbe
    // traegt (kleinerReicht)? bauen() darunter laesst beide Ketten gegeneinander antreten.
    const bauenMit = (sortenrein, ordentlich, klein) => {
      let erst = null, chain, remaining, kleiner = false;
      const OPT = { noHint: true, ordentlich };
      const start = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
      // Der erste Container wird nur dann fertig aus slot0 uebernommen, wenn gierig UND
      // unordentlich gepackt wird -- genau so ist slot0 naemlich entstanden. Jede andere
      // Betriebsart legt ihn neu und gibt ihn als slot0 zurueck, sonst zeigt die Leiste
      // andere Zahlen als die Tabelle darunter.
      // Eine Zuweisung zwingt auch den ersten Container zu einem eigenen Lauf: slot0 ist ohne
      // sie entstanden und wuesste nichts davon. Stopps genauso: slot0 kennt keine Wellen.
      if (sortenrein || ordentlich || pins || stopps) {
        erst = pins || stopps
          ? slotPacken(container0, start, 0, pins, OPT, sortenrein)
          : sortenrein
            ? packSortenrein(container0, start, sortenReihenfolge(start), ordentlich ? null : slot0, OPT)
            : packCargo(container0, start, OPT);
        if (!erst.boxes) return null;
        chain = [{ name: preset0, preset: container0, placed: erst.placed }];
        remaining = start.map((t, i) => ({ ...t, qty: t.qty - (erst.perType[i] ? erst.perType[i].loaded : 0) }));
      } else {
        // Traegt die Wahl nichts, gibt es keine Kette zu bauen -- der Fang unten
        // antwortet dann ehrlich (leerer C1, alles offen) statt Folgecontainer um
        // eine leere Huelle herumzustellen.
        if (!(slot0.placed || []).length) return null;
        chain = [{ name: preset0, preset: container0, placed: slot0.placed }];
        remaining = start.map((t, i) => ({ ...t, qty: t.qty - (slot0.perType[i] ? slot0.perType[i].loaded : 0) }));
      }
      let totRem = remaining.reduce((s, t) => s + t.qty, 0);
      // Was noch untergebracht werden KANN -- und das ist nicht dasselbe wie das,
      // was offen ist. Ware, die auf einen bereits gebauten Container gepinnt ist,
      // findet in keinem weiteren Container mehr Platz; ohne diese Unterscheidung
      // baut die Kette bis MAXCHAIN Container fuer ein Stueck, das nie hineingeht.
      const nochMoeglich = (rem) =>
        rem.reduce((s, t, i) => s + (pins && pins[i] != null && pins[i] < chain.length ? 0 : t.qty), 0);
      let slot = 1;
      while (nochMoeglich(remaining) > 0 && chain.length < MAXVIS) {
        const ov = overrides && overrides[slot];
        const manual = ov && PRESETS[ov];
        let pick = manual ? { name: ov, p: applyCarrier(PRESETS[ov], carrier, ov) } : autoFollow(remaining, totRem);
        let rr = slotPacken(pick.p, remaining, slot, pins, OPT, sortenrein);
        // Der groesste Container nur, wenn er auch mehr traegt: teilt das Gewicht die
        // Sendung, laedt ein kleinerer dasselbe (siehe kleinerReicht).
        if (klein && !manual && pick === workhorse && rr.boxes > 0) {
          const s = slot, rest = remaining;
          const kl = kleinerReicht(stdOrder, workhorse, rr, (p) => slotPacken(p, rest, s, pins, OPT, sortenrein));
          if (kl) { pick = kl.o; rr = kl.r; kleiner = true; }
        }
        if (rr.boxes === 0 && !manual) break;
        chain.push({ name: pick.name, preset: pick.p, placed: rr.placed });
        if (rr.boxes === 0) break;
        remaining = remaining.map((t, i) => ({ ...t, qty: t.qty - (rr.perType[i] ? rr.perType[i].loaded : 0) }));
        totRem = remaining.reduce((s, t) => s + t.qty, 0);
        slot++;
      }
      return { chain, remaining, totRem, slot0: erst, sortenrein: !!sortenrein, ordentlich: !!ordentlich, kleiner };
    };
    // Eine Kette mit kleineren Folgecontainern muss sich gegen die alte Regel ("sonst immer
    // der groesste") beweisen: nicht mehr liegen lassen, nicht mehr Container, weniger
    // gebuchter Raum (ketteBesser). Gebaut wird die zweite nur, wenn die erste ueberhaupt
    // einen kleineren Container gewaehlt hat -- sonst sind beide dieselbe.
    const bauen = (sortenrein, ordentlich) => {
      const neu = bauenMit(sortenrein, ordentlich, true);
      if (!neu || !neu.kleiner) return neu;
      const alt = bauenMit(sortenrein, ordentlich, false);
      return !alt || ketteBesser(neu, alt) ? neu : alt;
    };
    let erg = bauen(false);
    // Zuweisungen und Stopps koennen den ERSTEN Container leeren (alles auf spaetere
    // Slots gepinnt, nichts Freies passt hinein) -- bauen() sagt dann null, und ohne
    // diesen Fang stuerzte die App genau hier ab (erg.chain von null). Die ehrliche
    // Antwort ist dieselbe wie bei "nichts passt in die Wahl": die gewaehlte Huelle,
    // alles offen, keine Auto-Kette um einen leeren C1 herum.
    if (!erg) {
      const start = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
      erg = { chain: [{ name: preset0, preset: container0, placed: [] }], remaining: start,
        totRem: start.reduce((s, t) => s + t.qty, 0), slot0: null, sortenrein: false, ordentlich: false };
    }
    // Die sortenreine Kette lohnt nur bei mehr als einer Sorte, und nur beim gewoehnlichen
    // Trockencontainer: Special Equipment packt packKind, nicht packCargo.
    const sorten = cargo.filter((t) => Math.floor(num(t.qty)) > 0 && num(t.l) > 0 && num(t.w) > 0 && num(t.h) > 0).length;
    // Lohnt sich der zweite Durchgang ueberhaupt? Nur, wenn in der gierigen Kette ein
    // Container VOR dem letzten mehrere Sorten traegt -- genau daraus entsteht der
    // angebrochene Rest, der hinten einen weiteren Container kostet. Ist ohnehin jeder
    // Container sortenrein, gibt es nichts zu verbessern und nichts zu rechnen.
    const gemischt = erg.chain.slice(0, -1).some((c) => new Set(c.placed.map((b) => b.ti)).size > 1);
    // Und nicht bei sehr langen Ketten: ab acht Containern zeichnet die Ansicht ohnehin
    // nicht mehr alle (MAXDRAW), die Sortenfrage wiegt dort weniger als die Antwortzeit --
    // und genau diese Ketten sind die teuren, weil jeder weitere Slot einen Packlauf kostet.
    if (!stopps && gemischt && sorten > 1 && sorten <= SORTENREIN_MAX && erg.chain.length <= MAXDRAW
        && (container0.kind || "dry") === "dry") {
      const rein = bauen(true);
      if (ketteBesser(rein, erg)) erg = rein;
    }
    let { chain, remaining, totRem } = erg;
    let slot0Neu = erg.slot0;
    let ausgeglichen = false;
    // Stufe 2: bei festem N das Gewicht ausgleichen. Nur wenn alles verladen ist (sonst waere
    // die Frage nicht "wie verteile ich", sondern "was bleibt liegen") und nur bei einem
    // gewoehnlichen Trockencontainer -- Special Equipment packt packKind, nicht packCargo.
    if (totRem === 0 && chain.length > 1 && (container0.kind || "dry") === "dry") {
      const bal = ketteAusgleichen(chain, cargo, erg.ordentlich, pins);
      if (bal) { chain = bal.chain; slot0Neu = bal.slot0; remaining = cargo.map(() => ({ qty: 0 })); ausgeglichen = true; }
    }
    // ── Stufe 3: ordentlich stauen, solange es nichts kostet ──
    //
    // Gemeldet: "die Ladung wird teilweise weird gestaut". Nachgemessen an der gemeldeten
    // Sendung -- gleiche Ware lag an vier Stellen im Container, dazwischen einzelne Stuecke
    // der anderen Sorte (Streuung 266 m^2 gegen 85, wenn Sorte fuer Sorte gelegt wird).
    // Die Ursache sind ausgerechnet die Zufalls-Neustarts in emsSearch: sie finden dort 26
    // Packstuecke statt 24, und zwar indem sie die Sorten durcheinanderwerfen.
    //
    // Die Frage ist deshalb nicht "ordentlich ODER voll", sondern auf WELCHER Ebene bezahlt
    // wird. Zwei Packstuecke weniger im ersten Container sind kein Verlust, solange sie im
    // zweiten mitfahren, den es ohnehin gibt: gebucht und bezahlt werden Container, nicht
    // Stellplaetze.
    //
    // Dieselbe Bauart wie Stufe 2: eine zweite Kette, die sich beweisen muss. Sie wird nur
    // uebernommen, wenn sie
    //   * nicht mehr liegen laesst,
    //   * nicht mehr Container braucht,
    //   * und die Gewichtsspanne nicht verschlechtert.
    // Der letzte Punkt ist nicht theoretisch: bei schweren Sendungen hat Stufe 2 die Spanne
    // gerade erst von 9.700 auf 800 kg gedrueckt, und eine ordentliche Kette hat weniger
    // Spielraum dafuer. Ordentlich darf nichts kosten -- auch keinen Gewichtsausgleich.
    //
    // Bei genau EINEM Container faellt die Stufe aus: dort gibt es keine naechste Ladung, in
    // die zwei Packstuecke ausweichen koennten, und Ordentlichkeit waere schlicht weniger
    // Ladung. Die Suche laeuft ausserdem ohne Neustarts und ist damit billiger als Stufe 1.
    //
    // Zwei Waechter, beide aus demselben Grund wie bei der sortenreinen Kette: Stufe 3 kostet
    // eine weitere Kette, und sie soll nur laufen, wo sie etwas ausrichten kann.
    //   * Traegt kein Container mehr als EINE Sorte, gibt es nichts zu entmischen. Bei einer
    //     einzigen Sorte ist das immer so -- und dort kostete die Stufe am meisten
    //     (1.900 Kisten: 445 -> 932 ms fuer exakt dasselbe Ergebnis).
    //   * Ab MAXDRAW Containern zeichnet die Ansicht ohnehin nicht mehr alle, und genau diese
    //     Ketten sind die teuren.
    const mehrsortig = chain.some((c) => new Set(c.placed.map((b) => b.ti)).size > 1);
    // Stufe 3 entfaellt mit Stopps: die Wellen ordnen bereits nach der Entlade-
    // reihenfolge, ein "Entmischen" nach Sorte wuerde dagegen arbeiten.
    if (!stopps && chain.length > 1 && chain.length <= MAXDRAW && mehrsortig) {
      const ord = bauen(erg.sortenrein, true);
      if (ord && ord.totRem <= totRem && ord.chain.length <= chain.length) {
        let oChain = ord.chain, oSlot0 = ord.slot0, oAus = false;
        if (ord.totRem === 0 && oChain.length > 1 && (container0.kind || "dry") === "dry") {
          const b2 = ketteAusgleichen(oChain, cargo, true, pins);
          if (b2) { oChain = b2.chain; oSlot0 = b2.slot0; oAus = true; }
        }
        const spanne = (k) => { const kg = k.map((c) => slotKg(c.placed, cargo)); return Math.max(...kg) - Math.min(...kg); };
        if (spanne(oChain) <= spanne(chain) + 1e-6) {
          chain = oChain; slot0Neu = oSlot0; totRem = ord.totRem; ausgeglichen = oAus;
          remaining = ord.totRem === 0 ? cargo.map(() => ({ qty: 0 })) : ord.remaining;
        }
      }
    }
    // Zwei Gruende, warum etwas offen bleibt, und sie verlangen zwei verschiedene Saetze:
    // Die Kette ist an der Grenze abgeschnitten (gekappt -- es gaebe weitere Container),
    // oder sie ist zu Ende und ein weiterer Container wuerde nichts aendern (zu grosses
    // Stueck, oder auf einen bereits gebauten Container gepinnte Ware).
    const gekappt = totRem > 0 && chain.length >= MAXVIS;
    // Und wie viel vom Rest geht auf das Konto der Zuweisung? Was jemand selbst einem
    // Container zugewiesen hat, bleibt dort liegen, wenn es nicht hineinpasst -- ein
    // weiterer Container aendert daran nichts, und ein Vorschlag dafuer waere leer.
    const pinOffen = pins ? remaining.reduce((s, t, i) => s + (pins[i] != null ? Math.max(0, t.qty) : 0), 0) : 0;
    // Die Zeile darunter beginnt bewusst woertlich mit "return { chain, remainingBoxes" --
    // fuenf Test-Slices schneiden genau an ihr das Ende dieser Funktion ab. Wer sie zu
    // einem Objekt-Literal mit anschliessendem "return out" umbaut, laesst die Slices ins
    // Leere laufen, und die halbe Kette ist nicht mehr getestet.
    if (slot0Neu) return { chain, remainingBoxes: totRem, gekappt, pinOffen, perType: kettenBilanz(cargo, remaining), slot0: slot0Neu, ausgeglichen };
    return { chain, remainingBoxes: totRem, gekappt, pinOffen, perType: kettenBilanz(cargo, remaining), ausgeglichen };
  }
  // Landfracht-Kette: Folgefahrzeuge = dasselbe (aktuell gewaehlte) Fahrzeug, sofern nicht pro Slot
  // manuell ueberschrieben. Analog zu chainContainers, nur ohne Auto-Typwahl (Entscheidung: N× gleich).
  function chainVehicles(container0, preset0, cargo, slot0, overrides, MAXVIS) {
    // Dieselben zwei Strategien wie in der Seefracht. Nur der dritte Entscheid von
    // ketteBesser (das gebuchte Volumen) faellt hier weg: das Fahrzeug ist gesetzt, es
    // gibt keinen kleineren. Uebrig bleibt "gleiche Ware zusammen" -- an der Rampe genauso
    // wertvoll wie im Hafen, und wer die Seefracht anders behandelt als die Landfracht,
    // baut sich zwei Algorithmen, die auseinanderlaufen.
    const pins = slotPins(cargo);
    // Stopps greifen nur beim gewoehnlichen Trockencontainer bzw. Fahrzeug:
    // Special Equipment packt packKind, und ein Wellen-Lauf ueber packCargo
    // liesse Uebermass-Stuecke stillschweigend fallen (Grenze wie beim Ausgleich).
    const stopps = (container0.kind || "dry") === "dry" ? stoppWerte(cargo) : null;
    const bauen = (sortenrein, ordentlich) => {
      let erst = null, chain, remaining;
      const OPT = { noHint: true, ordentlich };
      const start = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
      // Der erste Container wird nur dann fertig aus slot0 uebernommen, wenn gierig UND
      // unordentlich gepackt wird -- genau so ist slot0 naemlich entstanden. Jede andere
      // Betriebsart legt ihn neu und gibt ihn als slot0 zurueck, sonst zeigt die Leiste
      // andere Zahlen als die Tabelle darunter.
      // Eine Zuweisung zwingt auch den ersten Container zu einem eigenen Lauf: slot0 ist ohne
      // sie entstanden und wuesste nichts davon. Stopps genauso: slot0 kennt keine Wellen.
      if (sortenrein || ordentlich || pins || stopps) {
        erst = pins || stopps
          ? slotPacken(container0, start, 0, pins, OPT, sortenrein)
          : sortenrein
            ? packSortenrein(container0, start, sortenReihenfolge(start), ordentlich ? null : slot0, OPT)
            : packCargo(container0, start, OPT);
        if (!erst.boxes) return null;
        chain = [{ name: preset0, preset: container0, placed: erst.placed }];
        remaining = start.map((t, i) => ({ ...t, qty: t.qty - (erst.perType[i] ? erst.perType[i].loaded : 0) }));
      } else {
        // Traegt die Wahl nichts, gibt es keine Kette zu bauen -- der Fang unten
        // antwortet dann ehrlich (leerer C1, alles offen) statt Folgecontainer um
        // eine leere Huelle herumzustellen.
        if (!(slot0.placed || []).length) return null;
        chain = [{ name: preset0, preset: container0, placed: slot0.placed }];
        remaining = start.map((t, i) => ({ ...t, qty: t.qty - (slot0.perType[i] ? slot0.perType[i].loaded : 0) }));
      }
      let totRem = remaining.reduce((s, t) => s + t.qty, 0);
      // Was noch untergebracht werden KANN -- und das ist nicht dasselbe wie das,
      // was offen ist. Ware, die auf einen bereits gebauten Container gepinnt ist,
      // findet in keinem weiteren Container mehr Platz; ohne diese Unterscheidung
      // baut die Kette bis MAXCHAIN Container fuer ein Stueck, das nie hineingeht.
      const nochMoeglich = (rem) =>
        rem.reduce((s, t, i) => s + (pins && pins[i] != null && pins[i] < chain.length ? 0 : t.qty), 0);
      let slot = 1;
      while (nochMoeglich(remaining) > 0 && chain.length < MAXVIS) {
        const ov = overrides && overrides[slot];
        const manual = ov && VEHICLES[ov];
        const pick = manual ? { name: ov, p: VEHICLES[ov] } : { name: preset0, p: container0 };
        const rr = slotPacken(pick.p, remaining, slot, pins, OPT, sortenrein);
        if (rr.boxes === 0 && !manual) break;
        chain.push({ name: pick.name, preset: pick.p, placed: rr.placed });
        if (rr.boxes === 0) break;
        remaining = remaining.map((t, i) => ({ ...t, qty: t.qty - (rr.perType[i] ? rr.perType[i].loaded : 0) }));
        totRem = remaining.reduce((s, t) => s + t.qty, 0);
        slot++;
      }
      return { chain, remaining, totRem, slot0: erst, sortenrein: !!sortenrein, ordentlich: !!ordentlich };
    };
    let erg = bauen(false);
    // Derselbe Fang wie in der Seefracht: Zuweisungen/Stopps koennen das erste
    // Fahrzeug leeren, bauen() sagt dann null statt einer Kette.
    if (!erg) {
      const start = cargo.map((t) => ({ ...t, qty: Math.max(0, Math.floor(num(t.qty))) }));
      erg = { chain: [{ name: preset0, preset: container0, placed: [] }], remaining: start,
        totRem: start.reduce((s, t) => s + t.qty, 0), slot0: null, sortenrein: false, ordentlich: false };
    }
    const sorten = cargo.filter((t) => Math.floor(num(t.qty)) > 0 && num(t.l) > 0 && num(t.w) > 0 && num(t.h) > 0).length;
    const gemischt = erg.chain.slice(0, -1).some((c) => new Set(c.placed.map((b) => b.ti)).size > 1);
    if (!stopps && gemischt && sorten > 1 && sorten <= SORTENREIN_MAX && erg.chain.length <= MAXDRAW) {
      const rein = bauen(true);
      if (ketteBesser(rein, erg)) erg = rein;
    }
    let { chain, remaining, totRem } = erg;
    let slot0Neu = erg.slot0;
    let ausgeglichen = false;
    if (totRem === 0 && chain.length > 1) {
      const bal = ketteAusgleichen(chain, cargo, erg.ordentlich, pins);
      if (bal) { chain = bal.chain; slot0Neu = bal.slot0; remaining = cargo.map(() => ({ qty: 0 })); ausgeglichen = true; }
    }
    // ── Stufe 3: ordentlich stauen, solange es nichts kostet ──
    //
    // Gemeldet: "die Ladung wird teilweise weird gestaut". Nachgemessen an der gemeldeten
    // Sendung -- gleiche Ware lag an vier Stellen im Container, dazwischen einzelne Stuecke
    // der anderen Sorte (Streuung 266 m^2 gegen 85, wenn Sorte fuer Sorte gelegt wird).
    // Die Ursache sind ausgerechnet die Zufalls-Neustarts in emsSearch: sie finden dort 26
    // Packstuecke statt 24, und zwar indem sie die Sorten durcheinanderwerfen.
    //
    // Die Frage ist deshalb nicht "ordentlich ODER voll", sondern auf WELCHER Ebene bezahlt
    // wird. Zwei Packstuecke weniger im ersten Container sind kein Verlust, solange sie im
    // zweiten mitfahren, den es ohnehin gibt: gebucht und bezahlt werden Container, nicht
    // Stellplaetze.
    //
    // Dieselbe Bauart wie Stufe 2: eine zweite Kette, die sich beweisen muss. Sie wird nur
    // uebernommen, wenn sie
    //   * nicht mehr liegen laesst,
    //   * nicht mehr Container braucht,
    //   * und die Gewichtsspanne nicht verschlechtert.
    // Der letzte Punkt ist nicht theoretisch: bei schweren Sendungen hat Stufe 2 die Spanne
    // gerade erst von 9.700 auf 800 kg gedrueckt, und eine ordentliche Kette hat weniger
    // Spielraum dafuer. Ordentlich darf nichts kosten -- auch keinen Gewichtsausgleich.
    //
    // Bei genau EINEM Container faellt die Stufe aus: dort gibt es keine naechste Ladung, in
    // die zwei Packstuecke ausweichen koennten, und Ordentlichkeit waere schlicht weniger
    // Ladung. Die Suche laeuft ausserdem ohne Neustarts und ist damit billiger als Stufe 1.
    //
    // Zwei Waechter, beide aus demselben Grund wie bei der sortenreinen Kette: Stufe 3 kostet
    // eine weitere Kette, und sie soll nur laufen, wo sie etwas ausrichten kann.
    //   * Traegt kein Container mehr als EINE Sorte, gibt es nichts zu entmischen. Bei einer
    //     einzigen Sorte ist das immer so -- und dort kostete die Stufe am meisten
    //     (1.900 Kisten: 445 -> 932 ms fuer exakt dasselbe Ergebnis).
    //   * Ab MAXDRAW Containern zeichnet die Ansicht ohnehin nicht mehr alle, und genau diese
    //     Ketten sind die teuren.
    const mehrsortig = chain.some((c) => new Set(c.placed.map((b) => b.ti)).size > 1);
    // Stufe 3 entfaellt mit Stopps: die Wellen ordnen bereits nach der Entlade-
    // reihenfolge, ein "Entmischen" nach Sorte wuerde dagegen arbeiten.
    if (!stopps && chain.length > 1 && chain.length <= MAXDRAW && mehrsortig) {
      const ord = bauen(erg.sortenrein, true);
      if (ord && ord.totRem <= totRem && ord.chain.length <= chain.length) {
        let oChain = ord.chain, oSlot0 = ord.slot0, oAus = false;
        if (ord.totRem === 0 && oChain.length > 1 && (container0.kind || "dry") === "dry") {
          const b2 = ketteAusgleichen(oChain, cargo, true, pins);
          if (b2) { oChain = b2.chain; oSlot0 = b2.slot0; oAus = true; }
        }
        const spanne = (k) => { const kg = k.map((c) => slotKg(c.placed, cargo)); return Math.max(...kg) - Math.min(...kg); };
        if (spanne(oChain) <= spanne(chain) + 1e-6) {
          chain = oChain; slot0Neu = oSlot0; totRem = ord.totRem; ausgeglichen = oAus;
          remaining = ord.totRem === 0 ? cargo.map(() => ({ qty: 0 })) : ord.remaining;
        }
      }
    }
    // Zwei Gruende, warum etwas offen bleibt, und sie verlangen zwei verschiedene Saetze:
    // Die Kette ist an der Grenze abgeschnitten (gekappt -- es gaebe weitere Container),
    // oder sie ist zu Ende und ein weiterer Container wuerde nichts aendern (zu grosses
    // Stueck, oder auf einen bereits gebauten Container gepinnte Ware).
    const gekappt = totRem > 0 && chain.length >= MAXVIS;
    // Und wie viel vom Rest geht auf das Konto der Zuweisung? Was jemand selbst einem
    // Container zugewiesen hat, bleibt dort liegen, wenn es nicht hineinpasst -- ein
    // weiterer Container aendert daran nichts, und ein Vorschlag dafuer waere leer.
    const pinOffen = pins ? remaining.reduce((s, t, i) => s + (pins[i] != null ? Math.max(0, t.qty) : 0), 0) : 0;
    // Die Zeile darunter beginnt bewusst woertlich mit "return { chain, remainingBoxes" --
    // fuenf Test-Slices schneiden genau an ihr das Ende dieser Funktion ab. Wer sie zu
    // einem Objekt-Literal mit anschliessendem "return out" umbaut, laesst die Slices ins
    // Leere laufen, und die halbe Kette ist nicht mehr getestet.
    if (slot0Neu) return { chain, remainingBoxes: totRem, gekappt, pinOffen, perType: kettenBilanz(cargo, remaining), slot0: slot0Neu, ausgeglichen };
    return { chain, remainingBoxes: totRem, gekappt, pinOffen, perType: kettenBilanz(cargo, remaining), ausgeglichen };
  }
// ── Ende des geschnittenen Bereichs ──────────────────────────────────────────────────────
// Die Tabellen des Link-Formats (in app.html: QCONT, QFZ, EINHEITEN, CL_SPRACHEN).
export const CONT_CODES = {"20gp":"20' GP","20hc":"20' HC","40gp":"40' GP","40hc":"40' HC","45hc":"45' HC","20ot":"20' Open Top","40ot":"40' Open Top","20fr":"20' Flat Rack","40fr":"40' Flat Rack","20rf":"20' Reefer","40rf":"40' Reefer"};
export const FZ_CODES = {"sattel":"Planensattel","wb":"Wechselbrücke","mw":"Motorwagen","75t":"7,5-Tonner","sprinter":"Sprinter"};
export const EINHEITEN = ["cm","mm","in"];
export const SPRACHEN = ["de","en","es","fr","zh","nl","pt"];
export { PRESETS, VEHICLES, TARA, MAXCHAIN, LDM_REF_WIDTH_CM, num, uid, parseCargoText, packKind, packCargo, makeFloorPacker, chainContainers, chainVehicles, kettenGrund, suggestContainer, suggestVehicles, recommendAll, tuerKonflikte };
