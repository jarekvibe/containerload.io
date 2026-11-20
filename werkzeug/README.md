# Werkzeuge (nicht deployt)

Einmal-Generatoren, die Dateien im Publish-Verzeichnis erzeugen. Liegen
ausserhalb von `containerload.io/`, werden also nie ausgeliefert.

- `karte-bauen.mjs` erzeugt `containerload.io/welt-karte.js` (Weltkarte fuer
  `/admin`): `npm install --no-save world-atlas@2 topojson-client@3 d3-geo@3
  iso-3166@4 && node karte-bauen.mjs`. Nur noetig, falls die Karte je neu
  gebaut werden muss -- die generierte Datei ist eingecheckt.
- `startseite-en.mjs` erzeugt `containerload.io/en/index.html` (englische Startseite) aus
  `containerload.io/index.html` und seinem EN-Woerterbuch -- nach JEDER Aenderung an
  index.html laufen lassen: `node werkzeug/startseite-en.mjs` (braucht nur Node).
- `haefen/land-bauen.mjs` erzeugt `containerload.io/karte/land.js` (Kueste + Grenzen
  der Hafenkarte, Natural Earth 1:50 Mio.), `haefen/haefen-bauen.mjs` erzeugt
  `containerload.io/karte/haefen.js` (World Port Index + Top 50 aus
  `haefen/quelle/top50-wsc.csv`) und schreibt die Top-50-Tabelle in beide Seiten.
  Im Ordner `haefen`: `npm install --no-save d3-geo@3 world-atlas@2 topojson-client@3
  topojson-simplify@3 && node land-bauen.mjs && node haefen-bauen.mjs`.
  (npm legt `node_modules/` dabei im Projektwurzelordner an, weil dort die
  `package.json` der Functions liegt -- `/node_modules/` steht deshalb in `.gitignore`.)
  `haefen-bauen.mjs` laedt dazu die Laenderflaechen von Natural Earth (Admin 0, 1:50 Mio.,
  Ausgabe 5.1.2, sha256 geprueft, gelesen als JSON) und rechnet mit `haefen/nah.mjs` die
  **Haefen in der Naehe** je Land (`CL_HAEFEN.nah`): Top-50-Haefen anderer Laender bis
  500 km Luftlinie zur Landesflaeche (hoechstens drei, nur fuer Laender mit weniger als drei
  eigenen Top-50-Haefen), fuer Laender ohne Seehafen die vier naechsten bis 1.000 km.
- `haefen/seeweg-bauen.mjs` erzeugt `containerload.io/karte/seeweg.js` (Seeweg-Netz,
  Eurostat SeaRoute, EUPL-1.2) -- braucht nur Node: `node seeweg-bauen.mjs`.
