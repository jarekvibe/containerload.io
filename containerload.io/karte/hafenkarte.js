// Hafenkarte: Weltkarte der Seehaefen mit den 50 groessten Containerhaefen, Suche und
// Filtern (Land, Kueste/Gewaesser, Hafengroesse).
//
// Liest window.CL_LAND (Kuesten + Grenzen, erzeugt von werkzeug/haefen/land-bauen.mjs)
// und window.CL_HAEFEN (Haefen aus dem World Port Index, erzeugt von
// werkzeug/haefen/haefen-bauen.mjs). Beide liegen auf containerload.io selbst:
// KEIN Kartendienst, keine Kacheln, keine Bibliothek -- beim Aufruf geht keine
// IP-Adresse an einen Dritten. Gezeichnet wird auf ein Canvas.
//
// Datenformat CL_HAEFEN.h: [name, locode, iso2, x, y, merkmale, groesse, tiefe_m,
//   laenge_m, kueste, lat, lon, alias, teu_mio, standort]
//   merkmale: Bits (HK_BIT unten), groesse: 0 unbekannt .. 4 gross (das BECKEN laut
//   Index, nicht der Umschlag), kueste: Index in CL_HAEFEN.kue ([englisch, deutsch]),
//   teu_mio: Containerumschlag des Top-50-Jahres (0 = nicht in der Top 50).
(function () {
  "use strict";
  var wurzel = document.querySelector("[data-hafenkarte]");
  if (!wurzel || !window.CL_LAND || !window.CL_HAEFEN) return;

  // HK_START
  // top = unter den 50 groessten Containerhaefen (World Shipping Council) -- das ist die
  // EINZIGE Stelle, an der die Karte "Containerhafen" sagt. container = der Index
  // verzeichnet Container-Anlagen (bei den grossen Haefen meist leer, daher nur Zusatz).
  var HK_BIT = { top: 1, container: 2, roro: 4, bahn: 8, stueckgut: 16 };
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
      // Ohne Suchwort: grosse und mittlere Haefen plus die Top 50; "alle" zeigt auch die
      // kleinen. Wer nach einem Namen sucht, findet ihn immer -- auch einen kleinen Hafen.
      if (!q && !f.alle && !(h[5] & HK_BIT.top) && h[6] < 3) continue;
      if (f.land && h[2] !== f.land) continue;
      if (f.kue != null && f.kue !== "" && h[9] !== +f.kue) continue;
      if (q) {
        var treffer = hkNorm(h[0]).indexOf(q) >= 0 || hkNorm(h[12]).indexOf(q) >= 0 ||
          (h[1] && hkNorm(h[1]).indexOf(q) === 0) ||
          (laenderName && hkNorm(laenderName(h[2])).indexOf(q) === 0);
        if (!treffer) continue;
      }
      aus.push(i);
    }
    // Containerumschlag zuerst, dann Hafengroesse, dann Name -- wer "USA" filtert, will
    // Los Angeles vor den Kleinhaefen sehen
    aus.sort(function (a, b) {
      var ha = haefen[a], hb = haefen[b];
      return (hb[13] - ha[13]) || (hb[6] - ha[6]) || (ha[0] < hb[0] ? -1 : ha[0] > hb[0] ? 1 : 0);
    });
    return aus;
  }
  // HK_ENDE

  // HK_SEEWEG_START
  // Stufe 2a: der kuerzeste Seeweg im Eurostat-Netz (window.CL_SEEWEG, wird erst bei der
  // ersten Route nachgeladen) -- Entfernung in Seemeilen, eigene Dijkstra-Suche. Rein,
  // ohne DOM; test/hafenkarte.test.mjs rechnet mit dem echten Netz nach.
  var HK_SM = 3440.065;                        // Erdradius in Seemeilen
  var HK_EIS = { northwest: 1, northeast: 1 }; // Eispassagen: keine Containerlinie faehrt dort
  function hkHav(lo1, la1, lo2, la2) {
    var r = Math.PI / 180, dp = (la2 - la1) * r, dl = (lo2 - lo1) * r;
    var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * HK_SM * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Natural Earth I wie d3 (geoNaturalEarth1Raw); Massstab und Verschiebung aus land.js
  function hkProj(lon, lat, P) {
    var la = lat * Math.PI / 180, lo = lon * Math.PI / 180, p2 = la * la, p4 = p2 * p2;
    var x = lo * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    var y = la * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [P[1] + x * P[0], P[2] - y * P[0]];
  }
  function hkGraph(S) {
    var n = S.n.length / 2, adj = [];
    for (var i = 0; i < n; i++) adj.push([]);
    for (var j = 0; j < S.e.length / 2; j++) {
      var a = S.e[2 * j], b = S.e[2 * j + 1], pass = S.p[j] || "";
      var d = hkHav(S.n[2 * a] / 100, S.n[2 * a + 1] / 100, S.n[2 * b] / 100, S.n[2 * b + 1] / 100);
      adj[a].push(b, d, pass); adj[b].push(a, d, pass); // Tripel: Nachbar, Seemeilen, Passage
    }
    return { n: n, lo: function (i) { return S.n[2 * i] / 100; }, la: function (i) { return S.n[2 * i + 1] / 100; }, adj: adj };
  }
  function hkNaechste(G, lon, lat, k) {
    var best = [];
    for (var i = 0; i < G.n; i++) {
      var d = hkHav(lon, lat, G.lo(i), G.la(i));
      if (best.length < k || d < best[best.length - 1][1]) {
        best.push([i, d]); best.sort(function (a, b) { return a[1] - b[1]; });
        if (best.length > k) best.pop();
      }
    }
    return best;
  }
  // von/nach = [Laenge, Breite]. Jeder Hafen haengt an seinen drei naechsten Netzknoten --
  // so landet ein Hafen hinter einer Landzunge nicht auf der falschen Seite.
  function hkSeeweg(G, von, nach, meiden) {
    var m = meiden || {}, N = G.n, dist = new Float64Array(N), vor = new Int32Array(N), fertig = new Uint8Array(N), heap = [];
    for (var z = 0; z < N; z++) { dist[z] = Infinity; vor[z] = -1; }
    var rein = function (d, i) {
      heap.push([d, i]);
      for (var c = heap.length - 1; c > 0;) { var p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; var t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; }
    };
    var raus = function () {
      var top = heap[0], l = heap.pop();
      if (heap.length) {
        heap[0] = l;
        for (var c = 0; ;) {
          var a = 2 * c + 1, b = a + 1, s = c;
          if (a < heap.length && heap[a][0] < heap[s][0]) s = a;
          if (b < heap.length && heap[b][0] < heap[s][0]) s = b;
          if (s === c) break;
          var t = heap[s]; heap[s] = heap[c]; heap[c] = t; c = s;
        }
      }
      return top;
    };
    hkNaechste(G, von[0], von[1], 3).forEach(function (q) { if (q[1] < dist[q[0]]) { dist[q[0]] = q[1]; rein(q[1], q[0]); } });
    var zielD = {};
    hkNaechste(G, nach[0], nach[1], 3).forEach(function (q) { zielD[q[0]] = q[1]; });
    var best = Infinity, bestK = -1;
    while (heap.length) {
      var oben = raus(), d = oben[0], i = oben[1];
      if (fertig[i] || d > dist[i]) continue;
      if (d >= best) break;
      fertig[i] = 1;
      if (zielD[i] !== undefined && d + zielD[i] < best) { best = d + zielD[i]; bestK = i; }
      var adj = G.adj[i];
      for (var j = 0; j < adj.length; j += 3) {
        var ps = adj[j + 2];
        if (ps && (m[ps] || HK_EIS[ps])) continue;
        var nd = d + adj[j + 1];
        if (nd < dist[adj[j]]) { dist[adj[j]] = nd; vor[adj[j]] = i; rein(nd, adj[j]); }
      }
    }
    if (bestK < 0) return null;
    var pfad = [], passagen = {};
    for (var k = bestK; k >= 0; k = vor[k]) pfad.push(k);
    pfad.reverse();
    for (var q = 1; q < pfad.length; q++) {
      var aa = G.adj[pfad[q - 1]];
      for (var r = 0; r < aa.length; r += 3) if (aa[r] === pfad[q]) { if (aa[r + 2]) passagen[aa[r + 2]] = 1; break; }
    }
    var punkte = [von];
    pfad.forEach(function (i) { punkte.push([G.lo(i), G.la(i)]); });
    punkte.push(nach);
    // Die beiden grossen Kaps tragen im Netz keine Marke -- erkannt an der Lage des Weges
    punkte.forEach(function (pt) {
      if (pt[1] < -33 && pt[0] > 12 && pt[0] < 30) passagen.kap = 1;
      if (pt[1] < -55 && pt[0] > -72 && pt[0] < -62) passagen.horn = 1;
    });
    return { sm: best, punkte: punkte, passagen: Object.keys(passagen) };
  }
  // Abgangshaefen eines Landes: seine Top-50-Containerhaefen (nach Umschlag); hat es keinen,
  // die vier groessten Seehaefen. Der Zielhafen selbst faellt heraus.
  function hkStartHaefen(haefen, iso, ziel) {
    var top = [], rest = [];
    for (var i = 0; i < haefen.length; i++) {
      var h = haefen[i];
      if (h[2] !== iso || i === ziel) continue;
      if (h[5] & 1) top.push(i); else if (h[6] >= 3) rest.push(i);
    }
    top.sort(function (a, b) { return haefen[b][13] - haefen[a][13]; });
    rest.sort(function (a, b) { return (haefen[b][6] - haefen[a][6]) || (haefen[a][0] < haefen[b][0] ? -1 : 1); });
    return top.length ? top.slice(0, 6) : rest.slice(0, 4);
  }
  // HK_SEEWEG_ENDE

  var SPR = wurzel.getAttribute("data-sprache") === "en" ? "en" : "de";
  var TX = {
    de: {
      suche: "Hafen, UN/LOCODE oder Land", land: "Land", alleLaender: "Alle Länder", gew: "Küste / Gewässer",
      alleGew: "alle", treffer: function (n) { return n === 1 ? "1 Hafen" : n.toLocaleString("de-DE") + " Häfen"; },
      mehr: function (n) { return "… und " + n.toLocaleString("de-DE") + " weitere — Suche oder Filter eingrenzen."; },
      keine: "Kein Hafen passt zu dieser Suche.", groesse: "Hafenbecken", laenge: "Max. Schiffslänge", tiefe: "Wassertiefe am Kai",
      gewaesser: "Küste / Gewässer", ausstattung: "Ausstattung laut Index", container: "Container-Anlagen", roro: "Ro-Ro",
      bahn: "Bahnanschluss", stueckgut: "Stückgut", koord: "Koordinaten",
      umschlag: function (j) { return "Containerumschlag " + j; }, teu: function (t) { return t.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Mio. TEU"; },
      top: "einer der 50 größten Containerhäfen der Welt", standort: "Punkt auf der Karte", mioKurz: function (t) { return t.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Mio. TEU"; },
      osm: "In OpenStreetMap ansehen", planen: "Ladung im 3D-Rechner planen", kopieren: "Link zu diesem Hafen kopieren",
      kopiert: "Link kopiert", zu: "Schließen", plus: "Hineinzoomen", minus: "Herauszoomen", welt: "Ganze Welt",
      karte: "Weltkarte der Häfen. Ziehen verschiebt, Mausrad oder zwei Finger zoomen.", unbekannt: "keine Angabe", m: " m",
      route: "Seeweg hierher", routeVon: "Ab Land", routeWaehlen: "Abgangsland wählen", routeLaedt: "Seewege werden berechnet …",
      routeFehler: "Das Seeweg-Netz konnte nicht geladen werden.", routeKeine: "Kein Hafen in diesem Land, von dem ein Seeweg hierher führt.",
      sm: function (v) { return Math.round(v).toLocaleString("de-DE") + " sm"; }, tage: function (v) { return "≈ " + Math.round(v) + " Tage"; },
      ueber: function (l) { return "über " + l; }, ohneSuez: function (n) { return n + ": ohne Suez und Rotes Meer"; },
      pass: { suez: "Suezkanal", panama: "Panamakanal", kiel: "Nord-Ostsee-Kanal", corinth: "Kanal von Korinth", magellan: "Magellanstraße", bering: "Beringstraße", kap: "Kap der Guten Hoffnung", horn: "Kap Hoorn" },
      routeHinweis: "Kürzester Seeweg und reine Fahrzeit bei 16 Knoten — ohne Hafenaufenthalte, Umschlag und Fahrplan. Echte Abfahrten und Laufzeiten der Reedereien folgen.",
      loc: "de-DE"
    },
    en: {
      suche: "Port, UN/LOCODE or country", land: "Country", alleLaender: "All countries", gew: "Coast / water body",
      alleGew: "all", treffer: function (n) { return n === 1 ? "1 port" : n.toLocaleString("en-US") + " ports"; },
      mehr: function (n) { return "… and " + n.toLocaleString("en-US") + " more — narrow the search or filters."; },
      keine: "No port matches this search.", groesse: "Harbour basin", laenge: "Max. vessel length", tiefe: "Depth at the quay",
      gewaesser: "Coast / water body", ausstattung: "Facilities per index", container: "Container facilities", roro: "Ro-Ro",
      bahn: "Rail connection", stueckgut: "Break bulk", koord: "Coordinates",
      umschlag: function (j) { return "Container throughput " + j; }, teu: function (t) { return t.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " million TEU"; },
      top: "one of the 50 largest container ports in the world", standort: "Point on the map", mioKurz: function (t) { return t.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "m TEU"; },
      osm: "View in OpenStreetMap", planen: "Plan the load in the 3D calculator", kopieren: "Copy link to this port",
      kopiert: "Link copied", zu: "Close", plus: "Zoom in", minus: "Zoom out", welt: "Whole world",
      karte: "World map of ports. Drag to pan, mouse wheel or two fingers to zoom.", unbekannt: "not stated", m: " m",
      route: "Sea route to here", routeVon: "From country", routeWaehlen: "Choose a country of departure", routeLaedt: "Calculating sea routes …",
      routeFehler: "The sea route network could not be loaded.", routeKeine: "No port in this country with a sea route to here.",
      sm: function (v) { return Math.round(v).toLocaleString("en-US") + " nm"; }, tage: function (v) { return "≈ " + Math.round(v) + " days"; },
      ueber: function (l) { return "via " + l; }, ohneSuez: function (n) { return n + ": avoiding Suez and the Red Sea"; },
      pass: { suez: "Suez Canal", panama: "Panama Canal", kiel: "Kiel Canal", corinth: "Corinth Canal", magellan: "Strait of Magellan", bering: "Bering Strait", kap: "Cape of Good Hope", horn: "Cape Horn" },
      routeHinweis: "Shortest sea route and pure sailing time at 16 knots — without port stays, transshipment or schedules. Real carrier departures and transit times will follow.",
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
  var gewName = function (i) { var g = D.kue[i]; return g ? (SPR === "de" ? g[1] || g[0] : g[0]) : ""; };
  var sichtbarNachGroesse = function (h) { return f.alle || (h[5] & HK_BIT.top) || h[6] >= 3; };
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
  var f = { q: "", land: "", kue: "", alle: false, von: "" };
  var sichtbar = [], gewaehlt = -1;
  var NETZ = null, netzStatus = "", routen = [], routeWahl = 0, KNOTEN_KN = 16;
  var ansicht = { k: 1, tx: 0, ty: 0 }, cssB = 1, cssH = 1, dpr = 1;
  // Die Welt ohne Antarktis: 84 Grad Nord bis 58 Grad Sued, vom Generator mitgegeben
  var WELT = { x0: L.rahmen[0], y0: L.rahmen[1], x1: L.rahmen[2], y1: L.rahmen[3] };
  var kMin = 0.1, kMax = 1;

  // ── Laender- und Gewaesser-Auswahl ─────────────────────────────────
  function zaehlen(pruef) { var z = {}; for (var i = 0; i < H.length; i++) if (pruef(H[i])) z[H[i][2]] = (z[H[i][2]] || 0) + 1; return z; }
  function laenderFuellen() {
    var z = zaehlen(sichtbarNachGroesse);
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
      if (h[2] !== f.land || !sichtbarNachGroesse(h) || h[9] < 0) continue;
      z[h[9]] = (z[h[9]] || 0) + 1;
    }
    var idx = Object.keys(z).map(Number).sort(function (a, b) { return z[b] - z[a]; });
    if (idx.length < 2) { chips.hidden = true; if (f.kue !== "" && !z[f.kue]) f.kue = ""; return; }
    chips.hidden = false;
    var knopf = function (wert, text) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = text;
      b.setAttribute("aria-pressed", String(String(f.kue) === String(wert)));
      b.addEventListener("click", function () { f.kue = wert; aktualisieren(true); });
      chips.appendChild(b);
    };
    knopf("", TX.alleGew);
    idx.forEach(function (g) { knopf(g, gewName(g) + " · " + z[g]); });
    if (f.kue !== "" && !z[f.kue]) f.kue = "";
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
      b.lastChild.textContent = [h[1] ? h[1].slice(0, 2) + " " + h[1].slice(2) : "", landName(h[2]), gewName(h[9]), h[13] ? TX.mioKurz(h[13]) : ""].filter(Boolean).join(" · ");
      if (h[5] & HK_BIT.top) b.classList.add("top"); else if (h[6] < 3) b.classList.add("klein");
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
    if (h[5] & HK_BIT.top) {
      var top = document.createElement("p"); top.className = "hk-top";
      top.innerHTML = "<b></b><span></span>";
      top.firstChild.textContent = TX.teu(h[13]);
      top.lastChild.textContent = " · " + TX.umschlag(D.topJahr) + " · " + TX.top;
      detail.appendChild(top);
    }
    var dl = document.createElement("dl");
    if (h[14]) zeile(dl, TX.standort, h[14]);
    if (h[9] >= 0) zeile(dl, TX.gewaesser, gewName(h[9]));
    zeile(dl, TX.groesse, HK_GROESSE[SPR][h[6]] || TX.unbekannt);
    zeile(dl, TX.laenge, zahlM(h[8]));
    zeile(dl, TX.tiefe, zahlM(h[7]));
    var aus = [];
    if (h[5] & HK_BIT.container) aus.push(TX.container);
    if (h[5] & HK_BIT.roro) aus.push(TX.roro);
    if (h[5] & HK_BIT.stueckgut) aus.push(TX.stueckgut);
    if (h[5] & HK_BIT.bahn) aus.push(TX.bahn);
    zeile(dl, TX.ausstattung, aus.length ? aus.join(", ") : TX.unbekannt);
    zeile(dl, TX.koord, koordText(h[10], h[11]));
    detail.appendChild(dl);
    detail.appendChild(routeTeil(h));
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

  // ── Seewege (Stufe 2a) ──────────────────────────────────────────────
  var ROUTE_LAENDER = (function () {
    var z = {};
    for (var i = 0; i < H.length; i++) if ((H[i][5] & HK_BIT.top) || H[i][6] >= 3) z[H[i][2]] = 1;
    return Object.keys(z).sort(function (a, b) { return landName(a).localeCompare(landName(b), TX.loc); });
  })();
  function netzLaden() {
    if (NETZ || netzStatus) return;
    if (window.CL_SEEWEG) { NETZ = hkGraph(window.CL_SEEWEG); return; }
    netzStatus = "laedt";
    var s = document.createElement("script");
    s.src = "/karte/seeweg.js"; s.async = true;
    s.onload = function () {
      netzStatus = window.CL_SEEWEG ? "" : "fehler";
      if (window.CL_SEEWEG) { NETZ = hkGraph(window.CL_SEEWEG); routenRechnen(); detailZeichnen(); routeZeigen(); }
      else detailZeichnen();
    };
    s.onerror = function () { netzStatus = "fehler"; detailZeichnen(); };
    document.head.appendChild(s);
  }
  function routenRechnen() {
    routen = []; routeWahl = 0;
    if (gewaehlt < 0 || !f.von || !NETZ) return;
    var z = H[gewaehlt], ziel = [z[11], z[10]];
    hkStartHaefen(H, f.von, gewaehlt).forEach(function (i) {
      var r = hkSeeweg(NETZ, [H[i][11], H[i][10]], ziel);
      if (r) routen.push({ i: i, r: r, kap: false });
    });
    routen.sort(function (a, b) { return a.r.sm - b.r.sm; });
    // Fuehrt der kuerzeste Weg durchs Rote Meer, steht der Umweg direkt darunter -- welchen
    // die Reedereien gerade fahren, sagt erst ein Fahrplan. Panama ist dabei ebenfalls
    // gesperrt: die grossen Asien-Europa-Schiffe passen nicht hindurch, der echte Umweg
    // geht ums Kap der Guten Hoffnung (rechnerisch waere Panama manchmal kuerzer).
    var b0 = routen[0];
    if (b0 && (b0.r.passagen.indexOf("suez") >= 0 || b0.r.passagen.indexOf("babelmandeb") >= 0)) {
      var kap = hkSeeweg(NETZ, [H[b0.i][11], H[b0.i][10]], ziel, { suez: 1, babelmandeb: 1, panama: 1 });
      if (kap) routen.splice(1, 0, { i: b0.i, r: kap, kap: true });
    }
    routen.forEach(function (rt) {
      // In Bildpunkte; an der Datumsgrenze (Sprung > halbe Karte) beginnt ein neues Stueck
      var stuecke = [], akt = [], alt = null;
      rt.r.punkte.forEach(function (pt) {
        var xy = hkProj(pt[0], pt[1], L.proj);
        if (alt && Math.abs(xy[0] - alt[0]) > L.w / 2) { stuecke.push(akt); akt = []; }
        akt.push(xy); alt = xy;
      });
      stuecke.push(akt);
      rt.xy = stuecke;
    });
  }
  function routeZeigen() {
    var rt = routen[routeWahl];
    if (!rt) { zeichnen(); return; }
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    rt.xy.forEach(function (st) { st.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    fliegen(ansichtFuer(x0, y0, x1, y1, kMin * 20));
  }
  function routeTeil(h) {
    var box = document.createElement("div"); box.className = "hk-route";
    var t = document.createElement("h4"); t.textContent = TX.route; box.appendChild(t);
    var lab = document.createElement("label"); lab.textContent = TX.routeVon;
    var sel = document.createElement("select");
    var o0 = document.createElement("option"); o0.value = ""; o0.textContent = TX.routeWaehlen; sel.appendChild(o0);
    ROUTE_LAENDER.forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = landName(c); sel.appendChild(o); });
    sel.value = f.von;
    sel.addEventListener("change", function () {
      f.von = sel.value; urlSchreiben();
      if (f.von && !NETZ) { netzLaden(); detailZeichnen(); return; }
      routenRechnen(); detailZeichnen(); routeZeigen();
    });
    lab.appendChild(sel); box.appendChild(lab);
    if (!f.von) return box;
    var p = function (text, cls) { var e = document.createElement("p"); e.className = cls || "hk-rhinweis"; e.textContent = text; box.appendChild(e); };
    if (netzStatus === "fehler") { p(TX.routeFehler); return box; }
    if (!NETZ) { p(TX.routeLaedt); netzLaden(); return box; }
    if (!routen.length) { p(TX.routeKeine); return box; }
    var liste = document.createElement("div"); liste.className = "hk-rliste";
    routen.forEach(function (rt, n) {
      var b = document.createElement("button"); b.type = "button";
      b.className = "hk-rzeile" + (n === routeWahl ? " an" : "") + (rt.kap ? " kap" : "");
      var weg = rt.r.passagen.map(function (k) { return TX.pass[k]; }).filter(Boolean);
      b.innerHTML = '<span class="hk-rn"></span><span class="hk-rw"><b></b> · <span></span></span><span class="hk-rp"></span>';
      b.children[0].textContent = rt.kap ? TX.ohneSuez(H[rt.i][0]) : H[rt.i][0] + " → " + h[0];
      b.children[1].children[0].textContent = TX.sm(rt.r.sm);
      b.children[1].children[1].textContent = TX.tage(rt.r.sm / (KNOTEN_KN * 24));
      b.children[2].textContent = weg.length ? TX.ueber(weg.join(", ")) : "";
      b.addEventListener("click", function () { routeWahl = n; detailZeichnen(); routeZeigen(); });
      liste.appendChild(b);
    });
    box.appendChild(liste);
    p(TX.routeHinweis);
    return box;
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
      hafen: css("--accent", "#2E8FFF"), gross: css("--hk-gross", "#8FA3B8"), ohne: css("--hk-klein", "#55667A"), text: css("--dim", "#9DB0C2"),
      halo: css("--hk-meer", "#121821"), wahl: css("--text", "#E9F0F7")
    };
  }
  function zeichnenJetzt() {
    var k = ansicht.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = FARBE.meer; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ansicht.tx, dpr * ansicht.ty);
    // Unterhalb des Rahmens (58 Grad Sued) liegt nur die Antarktis -- kein Hafen, also kein Land
    ctx.save(); ctx.beginPath(); ctx.rect(-L.w, -L.h, 3 * L.w, WELT.y1 + L.h + 6); ctx.clip();
    ctx.fillStyle = FARBE.land; ctx.fill(landPfad);
    ctx.strokeStyle = FARBE.grenze; ctx.lineWidth = 0.8 / k; ctx.stroke(grenzPfad);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Seewege: die uebrigen leise, der gewaehlte im Akzent; Abgangshaefen als Ring
    if (routen.length) {
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (var rr = routen.length - 1; rr >= 0; rr--) {
        if (rr === routeWahl) continue;
        routeStrich(routen[rr], FARBE.gross, 1.5, 0.55, k);
      }
      routeStrich(routen[routeWahl], FARBE.hafen, 2.6, 1, k);
      ctx.globalAlpha = 1;
    }
    // Punkte in drei Lagen: kleine Haefen, grosse/mittlere, oben die Top-50-Containerhaefen
    var zoom = k / kMin, rBasis = zoom < 3 ? 2 : zoom < 10 ? 2.6 : 3.2;
    var sx = function (h) { return h[3] * k + ansicht.tx; }, sy = function (h) { return h[4] * k + ansicht.ty; };
    var klasse = function (h) { return h[5] & HK_BIT.top ? 2 : h[6] >= 3 ? 1 : 0; };
    for (var lage = 0; lage < 3; lage++) {
      ctx.fillStyle = lage === 2 ? FARBE.hafen : lage === 1 ? FARBE.gross : FARBE.ohne;
      ctx.beginPath();
      for (var j = sichtbar.length - 1; j >= 0; j--) {
        var h = H[sichtbar[j]];
        if (klasse(h) !== lage) continue;
        var x = sx(h), y = sy(h);
        if (x < -10 || y < -10 || x > cssB + 10 || y > cssH + 10) continue;
        var r = lage === 2 ? rBasis + 2 + Math.min(2, h[13] / 20) : lage === 1 ? rBasis : Math.max(1.4, rBasis - 0.8);
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    // Beschriftungen: die Top 50 schon aus der Ferne, die uebrigen erst von nahem --
    // in Listen-Reihenfolge (Umschlag, dann Groesse), ohne Ueberlappung
    if (zoom >= 1.6) {
      ctx.font = "500 11.5px Archivo, ui-sans-serif, system-ui, sans-serif";
      ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      var belegt = [], gesetzt = 0;
      for (var n = 0; n < sichtbar.length && gesetzt < 140; n++) {
        var hh = H[sichtbar[n]], px = sx(hh), py = sy(hh);
        if (!(hh[5] & HK_BIT.top) && zoom < 6) continue;
        if (px < -100 || py < -10 || px > cssB + 100 || py > cssH + 10) continue;
        var w = ctx.measureText(hh[0]).width, platz = null;
        // Rechts vom Punkt, sonst links, oben, unten -- der erste freie Platz gewinnt
        var orte = [[px + 8, py], [px - 8 - w, py], [px - w / 2, py - 14], [px - w / 2, py + 14]];
        for (var oi = 0; oi < orte.length && !platz; oi++) {
          var lx = orte[oi][0], ly = orte[oi][1], box = [lx - 2, ly - 8, lx + w + 2, ly + 8], frei = true;
          for (var b = 0; b < belegt.length; b++) { var o = belegt[b]; if (box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]) { frei = false; break; } }
          if (frei) platz = [lx, ly, box];
        }
        if (!platz) continue;
        belegt.push(platz[2]); gesetzt++;
        ctx.strokeStyle = FARBE.halo; ctx.lineWidth = 3; ctx.strokeText(hh[0], platz[0], platz[1]);
        ctx.fillStyle = (hh[5] & HK_BIT.top) ? FARBE.wahl : FARBE.text; ctx.fillText(hh[0], platz[0], platz[1]);
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

  function routeStrich(rt, farbe, breite, alpha, k) {
    if (!rt) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = farbe; ctx.lineWidth = breite;
    ctx.beginPath();
    rt.xy.forEach(function (st) {
      st.forEach(function (p, j) { var x = p[0] * k + ansicht.tx, y = p[1] * k + ansicht.ty; if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    });
    ctx.stroke();
    var s = H[rt.i], sx0 = s[3] * k + ansicht.tx, sy0 = s[4] * k + ansicht.ty;
    ctx.beginPath(); ctx.arc(sx0, sy0, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Auswahl ─────────────────────────────────────────────────────────
  function waehlen(i, hinfliegen) {
    gewaehlt = i;
    routenRechnen();
    detailZeichnen(); listeZeichnen(); urlSchreiben(); zeichnen();
    if (i >= 0 && f.von && routen.length && hinfliegen !== "nah") { routeZeigen(); return; }
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
  feldLand.addEventListener("change", function () { f.land = feldLand.value; f.kue = ""; aktualisieren(true); });
  feldAlle.addEventListener("change", function () { f.alle = feldAlle.checked; laenderFuellen(); aktualisieren(false); });

  // ── Adresse: ?q= ?land= ?gew= ?alle=1 ?hafen= (teilbar, wie der Rechner) ──
  function urlSchreiben() {
    try {
      var p = new URLSearchParams();
      if (f.q) p.set("q", f.q);
      if (f.land) p.set("land", f.land);
      if (f.kue !== "") p.set("kueste", String(f.kue));
      if (f.alle) p.set("alle", "1");
      if (gewaehlt >= 0) p.set("hafen", H[gewaehlt][1] || String(gewaehlt));
      if (f.von) p.set("von", f.von);
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
    var kue = p.get("kueste"); f.kue = kue != null && /^\d{1,3}$/.test(kue) ? +kue : "";
    var von = (p.get("von") || "").toUpperCase(); f.von = ROUTE_LAENDER.indexOf(von) >= 0 ? von : "";
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
    if (f.von) netzLaden();
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
