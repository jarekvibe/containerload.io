# ContainerLoad

**Jede Ladung. Im richtigen Container.**

ContainerLoad ist ein interaktiver 3D-Container-Ladungsrechner, der direkt im Browser läuft — kostenlos, ohne Account, ohne Installation. Das Tool richtet sich an Exporteure, Spediteure und alle, die schnell wissen wollen: *Passt meine Ladung in den Container, und wenn ja, in welchen?*

Live: [containerload.io](https://containerload.io) · aus Bremen 🇩🇪

---

## Worum es geht

Die Speditionswelt rechnet Beladungen bis heute oft in Excel-Tabellen oder per Schätzung. ContainerLoad will das vereinfachen und der grauen, traditionellen Branche etwas Frische geben: ein modernes, sofort nutzbares Werkzeug, das die Ladeberechnung sichtbar und greifbar macht.

Das Ergebnis ist eine rein **geometrische** Abschätzung der Stauung. Schwerpunkt, Achslast und Ladungssicherung sind bewusst **nicht** enthalten — das Tool ersetzt keine fachliche Prüfung. Diese Ehrlichkeit ist Teil des Produkts und zieht sich durch alle Texte und PDF-Ausgaben.

## Funktionen

- **3D-Rechner in Echtzeit** — Packstückmaße frei eingeben und direkt daneben sehen, wie die Ladung im Container sitzt. Drehen, zoomen, prüfen.
- **Palettengenaue Logik** — bei einer Palettensorte rechnet das Tool palettengenau (z. B. 11 EUR-Paletten im 20-Fuß, wie in den Speditionstabellen), inklusive gedrehter Lademuster. Bei gemischter Ladung sucht ein Algorithmus die beste Stauung.
- **Karton auf Palette** — die Vorstufe: Kartonmaße und Gesamtmenge eingeben, das Tool legt das Lagenmuster, zählt Lagen und Kartons je Palette und sagt, wie viele Paletten dabei herauskommen (inklusive Restpalette). Mehrere Kartontypen gehen entweder auf eigene Paletten oder lagenweise auf eine gemischte — schwere Lagen nach unten. Die fertigen Paletten wandern per Klick in den Container-/LKW-Rechner — Karton → Palette → Container in einem Durchgang.
- **Container-Empfehlung** — passt nicht alles rein, schlägt das Tool die günstigste Kombination vor (z. B. 1× 45' + 1× 20' statt 2× 45').
- **Dreh- & Stapelregeln je Packstück** — stapelbar / nicht stapelbar / um 90° drehbar.
- **Gewicht & Zuladung** — die maximale Zuladung jedes Containers ist hinterlegt; Warnung vor Überladung.
- **Teilen-Link** — eine eingegebene Ladung wird in einen Link kodiert und kann weitergegeben werden. Empfänger sehen die vorgespeicherte Ladung sofort in 3D, ohne Login.
- **Ladevorschlag als PDF** — druckbares Dokument mit Ladeübersicht und einem QR-Code, der zurück auf den interaktiven 3D-Plan führt.

## Tech-Stack

Bewusst schlank und ohne Build-Schritt — reines statisches HTML, alle Bibliotheken per CDN:

- **Tailwind CSS** (Runtime via `cdn.tailwindcss.com`)
- **React 18.3.1** (UMD, production)
- **Three.js r128** für die 3D-Ansicht
- **qrcode-generator** (vendored, MIT) für die QR-Codes

Kein npm, kein Bundler, kein Framework-Build. Eine HTML-Datei im Browser öffnen genügt.

## Projektstruktur

| Datei | Zweck |
|---|---|
| `index.html` | Landingpage (DE/EN), bindet den Rechner per iframe ein |
| `app.html` | Der eigentliche 3D-Rechner — Kernlogik, Presets, Teilen, QR |
| `share.html` | Branded Zwischenseite für geteilte Links, leitet in den Rechner weiter |
| `Ladevorschlag-Render.html` | Druck-/PDF-Vorlage für den Ladevorschlag inkl. QR-Code |
| `impressum.html` | Impressum |
| `datenschutz.html` | Datenschutzerklärung |
| `og.png`, `share-og.png` | Social-Media-Vorschaubilder |

## Lokale Entwicklung

Kein Setup nötig. Datei im Browser öffnen:

```
open index.html      # macOS
# oder einfach per Doppelklick
```

Da die Bibliotheken über CDN geladen werden, ist eine Internetverbindung beim Testen erforderlich.

## Deployment

Die Seite wird über **Netlify** ausgeliefert. Ziel ist die automatische Veröffentlichung aus diesem Repository (Push auf `main` → Auto-Deploy), sodass das bisherige manuelle Hochladen entfällt.

## Sprachen

Das Tool ist zweisprachig (Deutsch / Englisch). Deutsch ist die Ausgangssprache; Englisch wird über ein Wörterbuch im Code überlagert. Die Sprachwahl wird im Browser gespeichert.

## Status & Ausblick

ContainerLoad ist als einfaches, nützliches Werkzeug einsatzbereit und wird im Alltag weiter erprobt. Mittelfristig ist das Projekt für ausgebautere, monetarisierbare Funktionen ausgelegt — bei gleichbleibendem Anspruch: schnell, ehrlich, ohne Hürden.

---

*Geometrische Abschätzung · keine Achslast-Garantie · ersetzt keine fachliche Prüfung der Ladungssicherung.*

<!-- Netlify Deploy Preview neu angestoßen (PR #2). -->
