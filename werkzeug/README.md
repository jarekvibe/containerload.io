# Werkzeuge (nicht deployt)

Einmal-Generatoren, die Dateien im Publish-Verzeichnis erzeugen. Liegen
ausserhalb von `containerload.io/`, werden also nie ausgeliefert.

- `karte-bauen.mjs` erzeugt `containerload.io/welt-karte.js` (Weltkarte fuer
  `/admin`): `npm install --no-save world-atlas@2 topojson-client@3 d3-geo@3
  iso-3166@4 && node karte-bauen.mjs`. Nur noetig, falls die Karte je neu
  gebaut werden muss -- die generierte Datei ist eingecheckt.
- `haefen/land-bauen.mjs` erzeugt `containerload.io/karte/land.js` (Kueste + Grenzen
  der Hafenkarte, Natural Earth 1:50 Mio.), `haefen/haefen-bauen.mjs` erzeugt
  `containerload.io/karte/haefen.js` (World Port Index + Top 50 aus
  `haefen/quelle/top50-wsc.csv`) und schreibt die Top-50-Tabelle in beide Seiten.
  Im Ordner `haefen`: `npm install --no-save d3-geo@3 world-atlas@2 topojson-client@3
  topojson-simplify@3 && node land-bauen.mjs && node haefen-bauen.mjs`.
