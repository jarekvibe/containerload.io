# Werkzeuge (nicht deployt)

Einmal-Generatoren, die Dateien im Publish-Verzeichnis erzeugen. Liegen
ausserhalb von `containerload.io/`, werden also nie ausgeliefert.

- `karte-bauen.mjs` erzeugt `containerload.io/welt-karte.js` (Weltkarte fuer
  `/admin`): `npm install --no-save world-atlas@2 topojson-client@3 d3-geo@3
  iso-3166@4 && node karte-bauen.mjs`. Nur noetig, falls die Karte je neu
  gebaut werden muss -- die generierte Datei ist eingecheckt.
