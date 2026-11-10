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
- `bibliotheken/holen.mjs` holt React, ReactDOM und Three.js (r128) nach
  `containerload.io/vendor/` und die Schriften (Archivo, JetBrains Mono, Manrope,
  Space Grotesk) nach `containerload.io/schrift/`, jeweils aus der npm-Registry und
  gegen eine eingetragene sha512-Pruefsumme. Keine Abhaengigkeit:
  `node werkzeug/bibliotheken/holen.mjs`. Nur noetig, um eine Version anzuheben.
- `tailwind/bauen.mjs` erzeugt `containerload.io/tailwind.css` aus den Klassen in
  `app.html` und `index.html`. **Noetig nach jeder neuen Utility-Klasse** in einer der
  beiden Seiten (`test/tailwind-css.test.mjs` faellt sonst und nennt sie). Im Ordner
  `tailwind`: `npm install --no-save tailwindcss@3.4.19 autoprefixer@10.4.21 && node bauen.mjs`.
