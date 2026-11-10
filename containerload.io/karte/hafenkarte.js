// Hafenkarte: Weltkarte der Containerhaefen mit Suche und Filtern (Land, Gewaesser).
//
// Liest window.CL_LAND (Kuesten + Grenzen, erzeugt von werkzeug/haefen/land-bauen.mjs)
// und window.CL_HAEFEN (Haefen aus dem World Port Index, erzeugt von
// werkzeug/haefen/haefen-bauen.mjs). Beide liegen auf containerload.io selbst:
// KEIN Kartendienst, keine Kacheln, keine Bibliothek -- beim Aufruf geht keine
// IP-Adresse an einen Dritten. Gezeichnet wird auf ein Canvas.
//
// Datenformat CL_HAEFEN.h: [name, locode, iso2, x, y, merkmale, groesse, tiefe_m,
//   laenge_m, gewaesser, lat, lon, alias]
//   merkmale: Bits (HK_BIT unten), groesse: 0 unbekannt .. 4 gross,
//   gewaesser: Index in CL_HAEFEN.gew (je Eintrag [englisch, deutsch]).
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-hafenkarte]");
  if (!wurzel || !window.CL_LAND || !window.CL_HAEFEN) return;

  // HK_START
  var HK_BIT = { container: 1, kraene: 2, roro: 4, bahn: 8, stueckgut: 16 };
  var HK_GROESSE = { de: ["–", "sehr klein", "klein", "mittel", "groß"], en: ["–", "very small", "small", "medium", "large"] };
  // Suchtext normalisieren: Kleinschreibung, ohne Akzente, ohne Leer- und Satzzeichen.
  // "São Paulo" findet man mit "sao paulo", "DE HAM" mit "deham".
  function hkNorm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "");
  }
  // Welche Haefen zeigt die Liste? Rein, ohne DOM -- test/hafenkarte.test.mjs rechnet nach.
  function hkFiltern(haefen, f, laenderName) {
    var q = hkNorm(f.q), aus = [];
    for (var i = 0; i < haefen.length; i++) {
      var h = haefen[i];
      if (!f.alle && !(h[5] & HK_BIT.container)) continue;
      if (f.land && h[2] !== f.land) continue;
      if (f.gew != null && f.gew !== "" && h[9] !== +f.gew) continue;
      if (q) {
        var treffer = hkNorm(h[0]).indexOf(q) >= 0 || hkNorm(h[12]).indexOf(q) >= 0 ||
          (h[1] && hkNorm(h[1]).indexOf(q) === 0) ||
          (laenderName && hkNorm(laenderName(h[2])).indexOf(q) === 0);
        if (!treffer) continue;
      }
      aus.push(i);
    }
    // Groesste zuerst, dann nach Name -- wer "USA" filtert, will Los Angeles vor Kleinhaefen sehen
    aus.sort(function (a, b) {
      var ha = haefen[a], hb = haefen[b];
      return (hb[6] - ha[6]) || ((hb[5] & 1) - (ha[5] & 1)) || (ha[0] < hb[0] ? -1 : ha[0] > hb[0] ? 1 : 0);
    });
    return aus;
  }
  // HK_ENDE

  var SPR = wurzel.getAttribute("data-sprache") === "en" ? "en" : "de";
  var TX = {
    de: {
      suche: "Hafen, UN/LOCODE oder Land", land: "Land", alleLaender: "Alle Länder", gew: "Küste / Gewässer",
      alleGew: "alle", auchOhne: "Auch Häfen ohne Containerumschlag", treffer: function (n) { return n === 1 ? "1 Hafen" : n.toLocaleString("de-DE") + " Häfen"; },
      mehr: function (n) { return "… und " + n.toLocaleString("de-DE") + " weitere — Suche oder Filter eingrenzen."; },
      keine: "Kein Hafen passt zu dieser Suche.", groesse: "Hafengröße", laenge: "Max. Schiffslänge", tiefe: "Wassertiefe am Kai",
      gewaesser: "Gewässer", ausstattung: "Ausstattung", container: "Containerumschlag", kraene: "Containerkräne", roro: "Ro-Ro",
      bahn: "Bahnanschluss", stueckgut: "Stückgut", keinContainer: "kein Containerumschlag gemeldet", koord: "Koordinaten",
      osm: "In OpenStreetMap ansehen", planen: "Ladung im 3D-Rechner planen", kopieren: "Link zu diesem Hafen kopieren",
      kopiert: "Link kopiert", zu: "Schließen", plus: "Hineinzoomen", minus: "Herauszoomen", welt: "Ganze Welt",
      karte: "Weltkarte der Häfen. Ziehen verschiebt, Mausrad oder zwei Finger zoomen.", unbekannt: "keine Angabe", m: " m",
      loc: "de-DE"
    },
    en: {
      suche: "Port, UN/LOCODE or country", land: "Country", alleLaender: "All countries", gew: "Coast / water body",
      alleGew: "all", auchOhne: "Also ports without container handling", treffer: function (n) { return n === 1 ? "1 port" : n.toLocaleString("en-US") + " ports"; },
      mehr: function (n) { return "… and " + n.toLocaleString("en-US") + " more — narrow the search or filters."; },
      keine: "No port matches this search.", groesse: "Harbour size", laenge: "Max. vessel length", tiefe: "Depth at the quay",
      gewaesser: "Water body", ausstattung: "Facilities", container: "Container handling", kraene: "Container cranes", roro: "Ro-Ro",
      bahn: "Rail connection", stueckgut: "Break bulk", keinContainer: "no container handling reported", koord: "Coordinates",
      osm: "View in OpenStreetMap", planen: "Plan the load in the 3D calculator", kopieren: "Copy link to this port",
      kopiert: "Link copied", zu: "Close", plus: "Zoom in", minus: "Zoom out", welt: "Whole world",
      karte: "World map of ports. Drag to pan, mouse wheel or two fingers to zoom.", unbekannt: "not stated", m: " m",
      loc: "en-US"
    }
  }[SPR];

  var L = window.CL_LAND, D = window.CL_HAEFEN, H = D.h;
  var landName = (function () {
    var dn = null;
    try { dn = new Intl.DisplayNames([SPR], { type: "region" }); } catch (e) {}
    var cache = {};
    return function (c) {
      if (!c) return "";
      if (cache[c]) return cache[c];
      var n = c;
      try { n = (dn && dn.of(c)) || c; } catch (e) {}
      return (cache[c] = n);
    };
  })();
  var gewName = function (i) { var g = D.gew[i]; return g ? (SPR === "de" ? g[1] || g[0] : g[0]) : ""; };
  var css = function (v, d) { var s = getComputedStyle(wurzel).getPropertyValue(v).trim(); return s || d; };

  // ── DOM ─────────────────────────────────────────────────────────────
  var $ = function (sel) { return wurzel.querySelector(sel); };
  var feldQ = $("[data-hk-q]"), feldLand = $("[data-hk-land]"), feldAlle = $("[data-hk-alle]");
  var chips = $("[data-hk-chips]"), liste = $("[data-hk-liste]"), zahl = $("[data-hk-zahl]");
  var detail = $("[data-hk-detail]"), kasten = $("[data-hk-karte]"), canvas = kasten.querySelector("canvas");
  var ctx = canvas.getContext("2d");
  canvas.setAttribute("aria-label", TX.karte);
  canvas.setAttribute("role", "img");
  feldQ.placeholder = TX.suche;

  var landPfad = new Path2D(L.land), grenzPfad = new Path2D(L.grenzen);
  var REDUZIERT = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Zustand ─────────────────────────────────────────────────────────
  var f = { q: "", land: "", gew: "", alle: false };
  var sichtbar = [], gewaehlt = -1;
  var ansicht = { k: 1, tx: 0, ty: 0 }, cssB = 1, cssH = 1, dpr = 1;
  // Die Welt ohne Antarktis: 84 Grad Nord bis 58 Grad Sued, vom Generator mitgegeben
  var WELT = { x0: L.rahmen[0], y0: L.rahmen[1], x1: L.rahmen[2], y1: L.rahmen[3] };
  var kMin = 0.1, kMax = 1;

  // ── Laender- und Gewaesser-Auswahl ─────────────────────────────────
  function zaehlen(pruef) { var z = {}; for (var i = 0; i < H.length; i++) if (pruef(H[i])) z[H[i][2]] = (z[H[i][2]] || 0) + 1; return z; }
  function laenderFuellen() {
    var z = zaehlen(function (h) { return f.alle || (h[5] & HK_BIT.container); });
    var codes = Object.keys(z).filter(Boolean).sort(function (a, b) { return landName(a).localeCompare(landName(b), TX.loc); });
    var alt = f.land;
    feldLand.innerHTML = "";
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = TX.alleLaender; feldLand.appendChild(o0);
    codes.forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = landName(c) + " (" + z[c] + ")"; feldLand.appendChild(o);
    });
    if (alt && z[alt]) feldLand.value = alt; else { feldLand.value = ""; f.land = ""; }
  }
  function chipsFuellen() {
    chips.innerHTML = "";
    if (!f.land) { chips.hidden = true; return; }
    var z = {};
    for (var i = 0; i < H.length; i++) {
      var h = H[i];
      if (h[2] !== f.land || (!f.alle && !(h[5] & HK_BIT.container)) || h[9] < 0) continue;
      z[h[9]] = (z[h[9]] || 0) + 1;
    }
    var idx = Object.keys(z).map(Number).sort(function (a, b) { return z[b] - z[a]; });
    if (idx.length < 2) { chips.hidden = true; if (f.gew !== "" && !z[f.gew]) f.gew = ""; return; }
    chips.hidden = false;
    var knopf = function (wert, text) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = text;
      b.setAttribute("aria-pressed", String(String(f.gew) === String(wert)));
      b.addEventListener("click", function () { f.gew = wert; aktualisieren(true); });
      chips.appendChild(b);
    };
    knopf("", TX.alleGew);
    idx.forEach(function (g) { knopf(g, gewName(g) + " · " + z[g]); });
    if (f.gew !== "" && !z[f.gew]) f.gew = "";
  }

  // ── Liste ───────────────────────────────────────────────────────────
  var LISTE_MAX = 150;
  function listeZeichnen() {
    zahl.textContent = TX.treffer(sichtbar.length);
    liste.innerHTML = "";
    if (!sichtbar.length) { var p = document.createElement("p"); p.className = "hk-leer"; p.textContent = TX.keine; liste.appendChild(p); return; }
    var frag = document.createDocumentFragment();
    sichtbar.slice(0, LISTE_MAX).forEach(function (i) {
      var h = H[i], b = document.createElement("button");
      b.type = "button"; b.className = "hk-eintrag" + (i === gewaehlt ? " an" : "");
      b.innerHTML = '<span class="hk-n"></span><span class="hk-m"></span>';
      b.firstChild.textContent = h[0];
      b.lastChild.textContent = [h[1] ? h[1].slice(0, 2) + " " + h[1].slice(2) : "", landName(h[2]), gewName(h[9])].filter(Boolean).join(" · ");
      if (!(h[5] & HK_BIT.container)) b.classList.add("ohne");
      b.addEventListener("click", function () { waehlen(i, true); });
      frag.appendChild(b);
    });
    liste.appendChild(frag);
    if (sichtbar.length > LISTE_MAX) { var m = document.createElement("p"); m.className = "hk-leer"; m.textContent = TX.mehr(sichtbar.length - LISTE_MAX); liste.appendChild(m); }
  }

  // ── Detail ──────────────────────────────────────────────────────────
  function zeile(dl, k, v) { var dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.appendChild(dt); dl.appendChild(dd); }
  function zahlM(v) { return v > 0 ? v.toLocaleString(TX.loc, { maximumFractionDigits: 1 }) + TX.m : TX.unbekannt; }
  function koordText(lat, lon) {
    var f2 = function (v, p, n) { return Math.abs(v).toLocaleString(TX.loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "° " + (v >= 0 ? p : n); };
    return f2(lat, "N", "S") + ", " + f2(lon, SPR === "de" ? "O" : "E", SPR === "de" ? "W" : "W");
  }
  function detailZeichnen() {
    detail.innerHTML = "";
    if (gewaehlt < 0) { detail.hidden = true; return; }
    detail.hidden = false;
    var h = H[gewaehlt];
    var kopf = document.createElement("div"); kopf.className = "hk-dkopf";
    var t = document.createElement("h3"); t.textContent = h[0]; kopf.appendChild(t);
    var x = document.createElement("button"); x.type = "button"; x.className = "hk-x"; x.setAttribute("aria-label", TX.zu); x.textContent = "×";
    x.addEventListener("click", function () { waehlen(-1, false); });
    kopf.appendChild(x); detail.appendChild(kopf);
    var sub = document.createElement("p"); sub.className = "hk-dsub";
    sub.textContent = [h[1] ? h[1].slice(0, 2) + " " + h[1].slice(2) : "", landName(h[2])].filter(Boolean).join(" · ");
    detail.appendChild(sub);
    var dl = document.createElement("dl");
    if (h[9] >= 0) zeile(dl, TX.gewaesser, gewName(h[9]));
    zeile(dl, TX.groesse, HK_GROESSE[SPR][h[6]] || TX.unbekannt);
    zeile(dl, TX.laenge, zahlM(h[8]));
    zeile(dl, TX.tiefe, zahlM(h[7]));
    var aus = [];
    if (h[5] & HK_BIT.container) aus.push(TX.container);
    if (h[5] & HK_BIT.kraene) aus.push(TX.kraene);
    if (h[5] & HK_BIT.roro) aus.push(TX.roro);
    if (h[5] & HK_BIT.stueckgut) aus.push(TX.stueckgut);
    if (h[5] & HK_BIT.bahn) aus.push(TX.bahn);
    zeile(dl, TX.ausstattung, aus.length ? aus.join(", ") : TX.unbekannt);
    if (!(h[5] & HK_BIT.container)) dl.lastChild.textContent += " — " + TX.keinContainer;
    zeile(dl, TX.koord, koordText(h[10], h[11]));
    detail.appendChild(dl);
    var links = document.createElement("div"); links.className = "hk-links";
    var osm = document.createElement("a");
    osm.href = "https://www.openstreetmap.org/?mlat=" + h[10] + "&mlon=" + h[11] + "#map=13/" + h[10] + "/" + h[11];
    osm.target = "_blank"; osm.rel = "noopener noreferrer"; osm.textContent = TX.osm;
    var plan = document.createElement("a"); plan.href = SPR === "en" ? "/app?lang=en" : "/app"; plan.textContent = TX.planen;
    var kop = document.createElement("button"); kop.type = "button"; kop.textContent = TX.kopieren;
    kop.addEventListener("click", function () {
      var u = location.origin + location.pathname + "?hafen=" + encodeURIComponent(h[1] || String(gewaehlt));
      try { navigator.clipboard.writeText(u).then(function () { kop.textContent = TX.kopiert; }); } catch (e) {}
    });
    links.appendChild(osm); links.appendChild(plan); links.appendChild(kop);
    detail.appendChild(links);
  }

  // ── Karte: Groesse, Ansicht, Zeichnen ───────────────────────────────
  function groesse() {
    var r = kasten.getBoundingClientRect();
    cssB = Math.max(1, r.width); cssH = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssB * dpr); canvas.height = Math.round(cssH * dpr);
    kMin = Math.min(cssB / (WELT.x1 - WELT.x0), cssH / (WELT.y1 - WELT.y0)) * 0.98;
    kMax = kMin * 80;
  }
  function klemmen() {
    ansicht.k = Math.max(kMin, Math.min(kMax, ansicht.k));
    // Die Welt darf nicht aus dem Bild geschoben werden: mindestens die Haelfte bleibt sichtbar
    var wB = (WELT.x1 - WELT.x0) * ansicht.k, wH = (WELT.y1 - WELT.y0) * ansicht.k;
    var minX = cssB * 0.5 - WELT.x1 * ansicht.k, maxX = cssB * 0.5 - WELT.x0 * ansicht.k;
    var minY = cssH * 0.5 - WELT.y1 * ansicht.k, maxY = cssH * 0.5 - WELT.y0 * ansicht.k;
    if (wB < cssB) { ansicht.tx = (cssB - wB) / 2 - WELT.x0 * ansicht.k; } else ansicht.tx = Math.max(minX, Math.min(maxX, ansicht.tx));
    if (wH < cssH) { ansicht.ty = (cssH - wH) / 2 - WELT.y0 * ansicht.k; } else ansicht.ty = Math.max(minY, Math.min(maxY, ansicht.ty));
  }
  function ansichtFuer(x0, y0, x1, y1, maxK) {
    var rand = 40;
    var k = Math.min((cssB - 2 * rand) / Math.max(1, x1 - x0), (cssH - 2 * rand) / Math.max(1, y1 - y0));
    k = Math.max(kMin, Math.min(maxK || kMax, k));
    return { k: k, tx: cssB / 2 - (x0 + x1) / 2 * k, ty: cssH / 2 - (y0 + y1) / 2 * k };
  }
  var flug = null;
  function fliegen(ziel) {
    if (flug) cancelAnimationFrame(flug.raf);
    if (REDUZIERT) { ansicht = ziel; klemmen(); zeichnen(); return; }
    var von = { k: ansicht.k, tx: ansicht.tx, ty: ansicht.ty }, t0 = performance.now(), dauer = 520;
    // In Weltkoordinaten interpolieren (Bildmitte), sonst schlingert der Flug
    var mitteVon = [(cssB / 2 - von.tx) / von.k, (cssH / 2 - von.ty) / von.k];
    var mitteZu = [(cssB / 2 - ziel.tx) / ziel.k, (cssH / 2 - ziel.ty) / ziel.k];
    flug = { raf: 0 };
    var schritt = function (jetzt) {
      var p = Math.min(1, (jetzt - t0) / dauer), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      var k = Math.exp(Math.log(von.k) + (Math.log(ziel.k) - Math.log(von.k)) * e);
      var mx = mitteVon[0] + (mitteZu[0] - mitteVon[0]) * e, my = mitteVon[1] + (mitteZu[1] - mitteVon[1]) * e;
      ansicht = { k: k, tx: cssB / 2 - mx * k, ty: cssH / 2 - my * k };
      klemmen(); zeichnenJetzt();
      if (p < 1) flug.raf = requestAnimationFrame(schritt); else flug = null;
    };
    flug.raf = requestAnimationFrame(schritt);
  }
  function ansichtAufTreffer() {
    if (!sichtbar.length) return;
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    sichtbar.forEach(function (i) { var h = H[i]; if (h[3] < x0) x0 = h[3]; if (h[3] > x1) x1 = h[3]; if (h[4] < y0) y0 = h[4]; if (h[4] > y1) y1 = h[4]; });
    // Ein einzelner Treffer: nicht bis zum Anschlag hineinfliegen
    var maxK = kMin * (sichtbar.length === 1 ? 30 : 24);
    fliegen(ansichtFuer(x0, y0, x1, y1, maxK));
  }

  var geplant = false;
  function zeichnen() { if (geplant) return; geplant = true; requestAnimationFrame(function () { geplant = false; zeichnenJetzt(); }); }
  var FARBE = {};
  function farbenLesen() {
    FARBE = {
      meer: css("--hk-meer", "#121821"), land: css("--hk-land", "#1E2834"), grenze: css("--hk-grenze", "#2E3A49"),
      hafen: css("--accent", "#2E8FFF"), ohne: css("--faint", "#7689A0"), text: css("--dim", "#9DB0C2"),
      halo: css("--hk-meer", "#121821"), wahl: css("--text", "#E9F0F7")
    };
  }
  function zeichnenJetzt() {
    var k = ansicht.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FARBE.meer; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ansicht.tx, dpr * ansicht.ty);
    ctx.fillStyle = FARBE.land; ctx.fill(landPfad);
    ctx.strokeStyle = FARBE.grenze; ctx.lineWidth = 0.8 / k; ctx.stroke(grenzPfad);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Punkte: erst die ohne Containerumschlag (darunter), dann die Containerhaefen
    var zoom = k / kMin, rBasis = zoom < 3 ? 2 : zoom < 10 ? 3 : 4;
    var sx = function (h) { return h[3] * k + ansicht.tx; }, sy = function (h) { return h[4] * k + ansicht.ty; };
    for (var durchgang = 0; durchgang < 2; durchgang++) {
      ctx.fillStyle = durchgang ? FARBE.hafen : FARBE.ohne;
      ctx.beginPath();
      for (var j = sichtbar.length - 1; j >= 0; j--) {
        var h = H[sichtbar[j]], c = h[5] & HK_BIT.container ? 1 : 0;
        if (c !== durchgang) continue;
        var x = sx(h), y = sy(h);
        if (x < -10 || y < -10 || x > cssB + 10 || y > cssH + 10) continue;
        var r = c ? rBasis + (h[6] >= 4 ? 1.5 : h[6] === 3 ? 0.7 : 0) : Math.max(1.5, rBasis - 0.5);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // Beschriftungen, sobald man nah genug ist -- groesste zuerst, ohne Ueberlappung
    if (zoom >= 5) {
      ctx.font = "500 11.5px Archivo, ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      var belegt = [], gesetzt = 0;
      for (var n = 0; n < sichtbar.length && gesetzt < 140; n++) {
        var hh = H[sichtbar[n]], lx = sx(hh) + 7, ly = sy(hh);
        if (lx < -100 || ly < -10 || lx > cssB || ly > cssH + 10) continue;
        var w = ctx.measureText(hh[0]).width, box = [lx - 2, ly - 8, lx + w + 2, ly + 8], frei = true;
        for (var b = 0; b < belegt.length; b++) { var o = belegt[b]; if (box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]) { frei = false; break; } }
        if (!frei) continue;
        belegt.push(box); gesetzt++;
        ctx.strokeStyle = FARBE.halo; ctx.lineWidth = 3; ctx.strokeText(hh[0], lx, ly);
        ctx.fillStyle = FARBE.text; ctx.fillText(hh[0], lx, ly);
      }
    }
    if (gewaehlt >= 0) {
      var g = H[gewaehlt], gx = sx(g), gy = sy(g);
      ctx.lineWidth = 2; ctx.strokeStyle = FARBE.wahl;
      ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "700 13px Archivo, ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      ctx.strokeStyle = FARBE.halo; ctx.lineWidth = 4; ctx.strokeText(g[0], gx + 12, gy);
      ctx.fillStyle = FARBE.wahl; ctx.fillText(g[0], gx + 12, gy);
    }
  }

  // ── Auswahl ─────────────────────────────────────────────────────────
  function waehlen(i, hinfliegen) {
    gewaehlt = i;
    detailZeichnen(); listeZeichnen(); urlSchreiben(); zeichnen();
    if (i >= 0 && hinfliegen) {
      var h = H[i], k = Math.max(ansicht.k, kMin * 14);
      fliegen({ k: k, tx: cssB / 2 - h[3] * k, ty: cssH / 2 - h[4] * k });
    }
  }
  function treffer(px, py) {
    var best = -1, bd = 14 * 14;
    for (var j = 0; j < sichtbar.length; j++) {
      var h = H[sichtbar[j]], dx = h[3] * ansicht.k + ansicht.tx - px, dy = h[4] * ansicht.k + ansicht.ty - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = sichtbar[j]; }
    }
    return best;
  }

  // ── Bedienung: ziehen, zoomen, tippen ───────────────────────────────
  var zeiger = new Map(), start = null, bewegt = false;
  function lokal(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function zoomUm(faktor, px, py) {
    var k0 = ansicht.k, k1 = Math.max(kMin, Math.min(kMax, k0 * faktor));
    ansicht.tx = px - (px - ansicht.tx) * (k1 / k0); ansicht.ty = py - (py - ansicht.ty) * (k1 / k0); ansicht.k = k1;
    klemmen(); zeichnen();
  }
  canvas.addEventListener("pointerdown", function (e) {
    if (flug) { cancelAnimationFrame(flug.raf); flug = null; }
    canvas.setPointerCapture(e.pointerId);
    zeiger.set(e.pointerId, lokal(e));
    if (zeiger.size === 1) { start = lokal(e); bewegt = false; }
    canvas.classList.add("zieht");
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!zeiger.has(e.pointerId)) return;
    var neu = lokal(e), alt = zeiger.get(e.pointerId);
    if (zeiger.size === 1) {
      ansicht.tx += neu[0] - alt[0]; ansicht.ty += neu[1] - alt[1];
      if (start && Math.abs(neu[0] - start[0]) + Math.abs(neu[1] - start[1]) > 5) bewegt = true;
      zeiger.set(e.pointerId, neu); klemmen(); zeichnen();
    } else if (zeiger.size === 2) {
      var ps = Array.from(zeiger.values()), anderer = ps[0] === alt ? ps[1] : ps[0];
      var d0 = Math.hypot(alt[0] - anderer[0], alt[1] - anderer[1]), d1 = Math.hypot(neu[0] - anderer[0], neu[1] - anderer[1]);
      zeiger.set(e.pointerId, neu); bewegt = true;
      if (d0 > 0) zoomUm(d1 / d0, (neu[0] + anderer[0]) / 2, (neu[1] + anderer[1]) / 2);
    }
  });
  function los(e) {
    if (!zeiger.has(e.pointerId)) return;
    var p = lokal(e);
    zeiger.delete(e.pointerId);
    if (!zeiger.size) {
      canvas.classList.remove("zieht");
      if (!bewegt) { var t = treffer(p[0], p[1]); if (t >= 0 || gewaehlt >= 0) waehlen(t, false); }
      start = null;
    }
  }
  canvas.addEventListener("pointerup", los);
  canvas.addEventListener("pointercancel", los);
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var p = lokal(e);
    zoomUm(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), p[0], p[1]);
  }, { passive: false });
  canvas.addEventListener("dblclick", function (e) { var p = lokal(e); zoomUm(2, p[0], p[1]); });
  $("[data-hk-plus]").addEventListener("click", function () { zoomUm(1.8, cssB / 2, cssH / 2); });
  $("[data-hk-minus]").addEventListener("click", function () { zoomUm(1 / 1.8, cssB / 2, cssH / 2); });
  $("[data-hk-welt]").addEventListener("click", function () { fliegen(ansichtFuer(WELT.x0, WELT.y0, WELT.x1, WELT.y1)); });
  $("[data-hk-plus]").setAttribute("aria-label", TX.plus);
  $("[data-hk-minus]").setAttribute("aria-label", TX.minus);
  $("[data-hk-welt]").setAttribute("aria-label", TX.welt);
  $("[data-hk-welt]").title = TX.welt;

  // ── Filter ──────────────────────────────────────────────────────────
  function aktualisieren(hinfliegen) {
    sichtbar = hkFiltern(H, f, landName);
    if (gewaehlt >= 0 && sichtbar.indexOf(gewaehlt) < 0 && !(f.q === "" && !f.land)) gewaehlt = -1;
    chipsFuellen();
    listeZeichnen(); detailZeichnen(); urlSchreiben(); zeichnen();
    if (hinfliegen) {
      if (f.q || f.land) ansichtAufTreffer();
      else fliegen(ansichtFuer(WELT.x0, WELT.y0, WELT.x1, WELT.y1));
    }
  }
  var tippUhr = 0;
  feldQ.addEventListener("input", function () {
    f.q = feldQ.value; clearTimeout(tippUhr);
    tippUhr = setTimeout(function () { aktualisieren(true); }, 220);
  });
  feldQ.addEventListener("keydown", function (e) { if (e.key === "Enter" && sichtbar.length) { e.preventDefault(); waehlen(sichtbar[0], true); } });
  feldLand.addEventListener("change", function () { f.land = feldLand.value; f.gew = ""; aktualisieren(true); });
  feldAlle.addEventListener("change", function () { f.alle = feldAlle.checked; laenderFuellen(); aktualisieren(false); });

  // ── Adresse: ?q= ?land= ?gew= ?alle=1 ?hafen= (teilbar, wie der Rechner) ──
  function urlSchreiben() {
    try {
      var p = new URLSearchParams();
      if (f.q) p.set("q", f.q);
      if (f.land) p.set("land", f.land);
      if (f.gew !== "") p.set("gew", String(f.gew));
      if (f.alle) p.set("alle", "1");
      if (gewaehlt >= 0) p.set("hafen", H[gewaehlt][1] || String(gewaehlt));
      var s = p.toString();
      history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
    } catch (e) {}
  }
  function urlLesen() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { return -1; }
    f.q = (p.get("q") || "").slice(0, 60); feldQ.value = f.q;
    f.alle = p.get("alle") === "1"; feldAlle.checked = f.alle;
    var land = (p.get("land") || "").toUpperCase();
    f.land = /^[A-Z]{2}$/.test(land) ? land : "";
    var gew = p.get("gew"); f.gew = gew != null && /^\d{1,3}$/.test(gew) ? +gew : "";
    var hafen = (p.get("hafen") || "").toUpperCase().replace(/\s+/g, ""), idx = -1;
    if (hafen) for (var i = 0; i < H.length; i++) if (H[i][1] === hafen) { idx = i; break; }
    return idx;
  }

  // ── Start ───────────────────────────────────────────────────────────
  farbenLesen();
  groesse();
  var startHafen = urlLesen();
  laenderFuellen();
  feldLand.value = f.land;
  sichtbar = hkFiltern(H, f, landName);
  chipsFuellen();
  ansicht = ansichtFuer(WELT.x0, WELT.y0, WELT.x1, WELT.y1); klemmen();
  listeZeichnen();
  if (startHafen >= 0) {
    gewaehlt = startHafen; detailZeichnen();
    var sh = H[startHafen], sk = kMin * 14;
    ansicht = { k: sk, tx: cssB / 2 - sh[3] * sk, ty: cssH / 2 - sh[4] * sk }; klemmen();
  } else if (f.q || f.land) {
    var b0 = ansicht; ansichtAufTreffer(); ansicht = b0;
  }
  zeichnenJetzt();
  if (window.ResizeObserver) new ResizeObserver(function () {
    var mx = (cssB / 2 - ansicht.tx) / ansicht.k, my = (cssH / 2 - ansicht.ty) / ansicht.k;
    groesse(); ansicht.tx = cssB / 2 - mx * ansicht.k; ansicht.ty = cssH / 2 - my * ansicht.k; klemmen(); zeichnenJetzt();
  }).observe(kasten);
  wurzel.classList.add("bereit");
})();
