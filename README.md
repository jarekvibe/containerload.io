# ContainerLoad

**Jede Ladung. Im richtigen Container.**

ContainerLoad ist ein interaktiver 3D-Ladungsrechner für Container und LKW, der direkt im Browser läuft — kostenlos, ohne Account, ohne Installation. Das Tool richtet sich an Exporteure, Spediteure und alle, die schnell wissen wollen: *Passt meine Ladung in den Container, und wenn ja, in welchen?*

Live: [containerload.io](https://containerload.io) · aus Bremen 🇩🇪

---

## Worum es geht

Die Speditionswelt rechnet Beladungen bis heute oft in Excel-Tabellen oder per Schätzung. ContainerLoad will das vereinfachen und der grauen, traditionellen Branche etwas Frische geben: ein modernes, sofort nutzbares Werkzeug, das die Ladeberechnung sichtbar und greifbar macht.

Der Kern ist eine **geometrische** Stauung. Was darüber hinausgeht — Gewichtsverteilung, Achslast für den Sattelzug, Straßenlimit, der Sicherungs-Check — ist ein **Richtwert** und heißt in der Oberfläche auch so. Nichts davon ist eine Garantie, und das Tool ersetzt keine fachliche Prüfung. Diese Ehrlichkeit ist Teil des Produkts und zieht sich durch alle Texte und Dokumente.

## Funktionen

- **3D-Rechner in Echtzeit** — Packstückmaße eingeben und direkt daneben sehen, wie die Ladung sitzt. Seefracht (Standard-, High-Cube-, Open-Top-, Flat-Rack-, Platform- und Reefer-Container) und Landfracht (Planensattel bis Sprinter).
- **Palettengenaue Logik** — bei einer Palettensorte rechnet das Tool palettengenau (z. B. 11 Europaletten im 20-Fuß), inklusive gedrehter Lademuster. Bei gemischter Ladung sucht ein Algorithmus die beste Stauung.
- **Dreh- und Stapelregeln je Packstück** — stapelbar, nicht stapelbar, bis zu einer Lagenzahl oder Höhe, um 90° drehbar.
- **Mehrere Container** — passt nicht alles in einen, verteilt das Tool die Ladung auf eine Kette, schlägt die günstigste Kombination vor und sagt, warum geteilt wurde.
- **Karton auf Palette** — die Vorstufe: Kartonmaße und Menge eingeben, das Tool legt das Lagenmuster und übergibt die fertigen Paletten an den Rechner.
- **Reederei-Maße** — Innenmaße und Türöffnung von acht Reedereien, mit Quelle.
- **Gewicht** — Zuladung je Container, Warnung vor Überladung, Gewichtsverteilung und Achslast-Richtwert für den Sattelzug.
- **Sicherungs-Check** — zeigt, *wo* in der gepackten Ladung Lücken zu sichern sind.
- **Manuell stauen** — Packstücke von Hand setzen, je Container.
- **Import** — Packlisten als Text, aus Excel oder als Foto einlesen (KI-gestützt, mit Prüf-Tabelle).
- **Stevie** — ein KI-Assistent neben dem Plan, der Fragen beantwortet und den Plan auf Wunsch ändert. Gerechnet wird immer im Packer, nie von der KI.
- **Teilen-Link** — die Ladung steckt im Link. Empfänger sehen sie sofort in 3D, ohne Login.
- **Ladevorschlag** — druckbares Dokument je Container mit Stauplan, Belade-Reihenfolge und QR-Code zurück zum 3D-Plan; dazu CSV- und Bildexport und ein Rampen-Modus zum Abhaken.
- **Container-Wissen** — Nachschlageseiten auf Deutsch, Englisch und Niederländisch, deren Zahlen aus demselben Packer stammen, und eine Hafenkarte.

## Tech-Stack

Bewusst schlank und ohne Build-Schritt — statisches HTML, die Bibliotheken per CDN:

- **Tailwind CSS** (Runtime via `cdn.tailwindcss.com`)
- **React 18.3.1** (UMD, production)
- **Three.js r128** für die 3D-Ansicht
- **qrcode-generator** (vendored, MIT) für die QR-Codes

Kein Bundler, kein Framework-Build. Eine HTML-Datei im Browser öffnen genügt.

Dazu fünf **Netlify Functions** (`netlify/functions/`): `beacon` und `statistik` für die anonyme Nutzungsstatistik, `ki-import`, `ki-brief` und `ki-chat` für die KI-Funktionen (Claude über die Anthropic-API). Die `package.json` an der Repo-Wurzel existiert nur für deren Abhängigkeiten.

## Projektstruktur

| Pfad | Zweck |
|---|---|
| `containerload.io/` | **Das Publish-Verzeichnis.** Alles darin ist öffentlich abrufbar. |
| `containerload.io/app.html` | Der 3D-Rechner — Kernlogik, Presets, Teilen, Druckvorlage, alles in einer Datei |
| `containerload.io/index.html` | Landingpage (DE/EN) |
| `containerload.io/share.html` | Zwischenseite für geteilte Links, leitet in den Rechner weiter |
| `containerload.io/admin.html` | Dashboard der Nutzungsstatistik (Token-Pflicht) |
| `containerload.io/ratgeber/`, `en/guide/`, `nl/gids/` | Container-Wissen |
| `containerload.io/karte/` | Hafenkarte |
| `containerload.io/test/` | Regressionstests (werden beim Deploy entfernt) |
| `netlify/functions/` | Statistik- und KI-Endpunkte |
| `werkzeug/` | Generatoren für eingecheckte, generierte Dateien (nicht deployt) |
| `CLAUDE.md` | Die Regeln für die Arbeit am Projekt |
| `docs/entscheidungen.md` | Warum es so gebaut ist: das Entscheidungsprotokoll |

## Lokale Entwicklung

Kein Setup nötig. Datei im Browser öffnen:

```
open containerload.io/index.html      # macOS
# oder einfach per Doppelklick
```

Da die Bibliotheken über CDN geladen werden, ist eine Internetverbindung erforderlich. Die KI-Funktionen und die Statistik brauchen die Netlify Functions und laufen lokal nicht.

Tests (ohne npm, rund 30 Sekunden):

```
cd containerload.io
node --test test/*.mjs
```

## Deployment

Die Seite wird über **Netlify** automatisch aus diesem Repository veröffentlicht (Push auf `main` → Auto-Deploy). Die Einstellungen stehen in `netlify.toml`: Publish-Verzeichnis `containerload.io/`, Functions unter `netlify/functions/`. Der Build-Befehl installiert nur die Abhängigkeiten der Functions (`npm ci`, exakt nach `package-lock.json`) und nimmt `containerload.io/test` aus dem Publish-Verzeichnis.

Umgebungsvariablen (Netlify → Site settings → Environment variables):

| Variable | Wofür |
|---|---|
| `STATISTIK_TOKEN` | Zugang zum Dashboard unter `/admin`. Ohne sie antwortet `/api/statistik` mit 503. |
| `FEEDBACK_TOKEN` | Optional. Ein Netlify Personal Access Token (User settings → Applications → Personal access tokens), damit das Dashboard das Feedback aus Netlify Forms anzeigt. |
| `ANTHROPIC_API_KEY` | Für die KI-Funktionen. Ohne sie antworten die KI-Endpunkte mit 503. |
| `KI_MODELL` | Optional. Überschreibt das Standardmodell der KI-Funktionen. |
| `KI_TAGESLIMIT` | Optional. Gemeinsame Obergrenze der KI-Aufrufe je Tag (Standard 400). |

## Sprachen

Rechner und Landingpage sind zweisprachig (Deutsch / Englisch). Deutsch ist die Ausgangssprache; die Sprachwahl wird im Browser gespeichert und reist im Teilen-Link mit. Das Container-Wissen gibt es zusätzlich in Teilen auf Niederländisch.

## Status & Ausblick

ContainerLoad ist als einfaches, nützliches Werkzeug im Einsatz und wird im Alltag weiter erprobt. Mittelfristig ist das Projekt für ausgebautere, monetarisierbare Funktionen ausgelegt — bei gleichbleibendem Anspruch: schnell, ehrlich, ohne Hürden.

---

*Geometrische Abschätzung · keine Achslast-Garantie · ersetzt keine fachliche Prüfung der Ladungssicherung.*
