# EINHEITSBILDER — Bauplan M33

> **Stand:** 2026-09-11 · **Entwurf:** `docs/design/einheiten-bilder.html` · **Noahs Wahl:**
> Richtung **B (Schattenriss)**, Einheiten **und** Gebäude, Einfärbung nach **Besitzerfarbe**,
> Einsatzorte **Rekrutierungsliste, Bauplatzraster, Armee- und Rangliste**. Gefechtsbericht und
> Erklär-Fenster bleiben vorerst ohne Bild. **Infanterie:** der marschierende Mann, nicht das
> Emblem aus Helm und Gewehr (Noahs Wahl, zweite Runde).
>
> **Status: gebaut und abgenommen am 2026-09-11** (T-M33-01 bis T-M33-05, `pnpm verify`
> Exit 0, 1859 Tests). Die siebzehn Zeichnungen stehen in `apps/desktop/src/ui/art.tsx`
> und sind per Test zeichengleich an das Entwurfsblatt gebunden. Zwei Korrekturen gegen
> diesen Plan, beide in `PROGRESS.md` begründet: die **Kette des schweren Panzers** ragte
> im Entwurfsblatt 1,5 px links und rechts aus dem Kasten (gefunden von der neuen
> Pfadabfahrt, in Blatt und Code korrigiert), und die **Rangliste** aus T-M33-04 führt
> überhaupt kein Einheitenzeichen — dort war nichts umzustellen.

---

## 0 · Für den Agenten, der das baut (lies nur das hier)

1. Der Bildsatz ist **ein zweiter Satz neben `icons.tsx`**, kein Ersatz. Die Karte behält
   ihre NATO-Glyphe — `MapCanvas.tsx:81` stempelt `ICON_PATHS[name]` als einzelnen
   `Path2D` bei 11 px Kantenlänge, und ein gefüllter Schattenriss ist dort ein Fleck.
2. Jede Zeichnung liegt im Kasten **48 × 30**, Standlinie **y = 26**, und besteht aus zwei
   Pfaden: `body` (gefüllt) und `cut` (die Innenlinien, gestrichen in der Flächenfarbe).
3. **Der Wächter muss mitwandern.** `test/guards/no-foreign-assets.test.ts` prüft heute
   namentlich `icons.tsx`. Eine neue Datei mit siebzehn Zeichnungen wäre sonst genau das
   ungeprüfte Loch, das R-ASSET-01 verhindern soll. Aufgabe T-M33-01 erweitert den Wächter,
   **bevor** die erste Zeichnung eincheckt.
4. Reihenfolge ist Baureihenfolge. Je Aufgabe ein Commit und eine Zeile in `PROGRESS.md`.
   `pnpm verify` läuft am Ende des Meilensteins, nicht nach jeder Aufgabe.

---

## 1 · Was da ist (Fundstellen)

| Stelle | Was sie heute tut |
|---|---|
| `apps/desktop/src/ui/icons.tsx` | 44 Glyphen als 24er-Pfadstrings, dazu `UNIT_ICONS`, `BUILDING_ICONS`, `BUILDING_ORDER` |
| `apps/desktop/src/map/MapCanvas.tsx:81` | stempelt die Glyphe als `Path2D` auf die Leinwand — **bleibt unberührt** |
| `apps/desktop/src/ui/UnitMarker.tsx` | das Plättchen fürs Panel: Rahmen in Besitzerfarbe, Glyphe links, Zahl rechts |
| `apps/desktop/src/game/actions.ts:176` | `recruitActions` hängt je Einheit `UNIT_ICONS[key]` an die `ActionSpec` |
| `apps/desktop/src/ui/Panels.tsx:393` | das Bauplatzraster, je Gebäudeart ein Feld mit `<Icon size={18}>` |
| `apps/desktop/src/ui/Panels.tsx:613` | die Armeeliste mit `<UnitMarker>` |
| `apps/desktop/src/ui/icons.test.tsx` | jede Einheit und jedes Gebäude hat ein Symbol, keines doppelt, alle Zahlen im 24er-Kasten |

Zehn Einheiten (`data/rules/default/units.json`), sieben Gebäude
(`data/rules/default/buildings.json`) — siebzehn Zeichnungen, alle im Entwurfsblatt
bereits gesetzt.

---

## 2 · Anforderungen (bestehende IDs, nichts Neues)

- **R-ASSET-01 / R-ASSET-02** — selbst gezeichnet, inline, keine Datei, keine Fremdquelle.
- **R-UI-04** — dieselbe Schrift- und Farbwelt; Farben nur aus `tokens.ts`.
- **R-UI-10** — Besitzerfarbe bedeutet in der Liste dasselbe wie auf der Karte.
- **R-UI-03** — Klickziele mindestens 24 px, A11y-Namen unverändert.

---

## 3 · Entwurf D33 „Schattenriss"

### D33.1 Datenform

Neue Datei `apps/desktop/src/ui/art.tsx`:

```ts
export type ArtName = 'infantry' | 'motorized' | … | 'railway'   // 17
export interface Art { body: string; cut: string }               // Kasten 48 × 30
export const ART: Readonly<Record<ArtName, Art>>
export const UNIT_ART: Record<string, ArtName>
export const BUILDING_ART: Record<BuildingKey, ArtName>
export function UnitArt(props: { name: ArtName; label: string; tone?: MarkerTone; width?: number })
```

Zwei Pfade statt einem, weil die Innenlinien (Radnaben, Rippen, Fenster, Wellen) in der
Flächenfarbe **über** die Fläche gestrichen werden. Ein einziger Pfad mit `evenodd`
könnte Löcher stanzen, aber keine Linie ziehen — und ohne Radnaben ist ein Panzer eine
Schachtel.

### D33.2 Einfärbung

Der Schattenriss nimmt die Besitzerfarbe des Plättchens: `good` für eigene, `ally`,
`accent`, `inkSoft` sonst — dieselbe Zuordnung wie `UnitMarker` sie heute für den Rahmen
verwendet. In der Rekrutierungsliste und im Bauplatzraster gibt es keinen fremden Besitzer;
dort steht der Riss in `ink`, das Gebäude in `building`.

**Zu prüfen, nicht zu glauben:** `CONTRAST_PAIRS` prüft `good`, `ally` und `accent` heute
gegen `paper`, nicht gegen `paperSunk`. Die Plakette sitzt auf `paperSunk`. T-M33-01 ergänzt
die drei Paare; hält eines die 3:1-Schwelle nicht, entscheidet der Kontrasttest, nicht der
Entwurf — so wie schon bei `line` in D27.1.

### D33.3 Größen

| Ort | Breite | Warum |
|---|---|---|
| Rekrutierungsliste | 34 px | neben zwei Textzeilen, ohne die Zeilenhöhe zu treiben |
| Bauplatzraster | 30 px | vierzehn Felder auf Panelbreite |
| Armee- und Rangliste | 44 px | dort trägt das Plättchen zusätzlich die Zahl |

Unter 22 px wird nicht gezeichnet — dann gilt die Glyphe. Das betrifft heute nur die Karte.

---

## 4 · Aufgaben

| ID | Titel | Kern der Abnahme |
|---|---|---|
| **T-M33-01** | Der Bildsatz zieht in den Code ein, der Wächter deckt ihn | `art.tsx` mit siebzehn Zeichnungen, wörtlich aus dem Entwurfsblatt. Test zuerst: jede Einheit aus `units.json` und jedes Gebäude aus `buildings.json` hat genau ein Bild, keines doppelt vergeben, jede Zeichnung hat `body` **und** `cut`. `no-foreign-assets.test.ts` prüft `art.tsx` wie `icons.tsx` und fällt gegen eine leere Menge. Drei Kontrastpaare gegen `paperSunk`. **Dazu die Reparatur aus Risiko 7.** |
| **T-M33-02** | Die Rekrutierungsliste zeigt Bilder | `ActionSpec` bekommt ein optionales `art`; `recruitActions` setzt es. Test zuerst: die Liste zeigt je Einheit ein Bild, der A11y-Name bleibt „Infanterie ausheben", das Klickziel bleibt ≥ 24 px. |
| **T-M33-03** | Das Bauplatzraster zeigt Gebäudebilder | Alle drei Feldzustände (frei, im Bau, gebaut) tragen dasselbe Bild. Test zuerst: sieben Felder, sieben verschiedene Bilder; die Stufenzahl bleibt im Namen fürs Ohr. |
| **T-M33-04** | Das Plättchen bekommt eine Bildfassung | `UnitMarker` nimmt wahlweise Glyphe oder Bild; Armee- und Rangliste schalten auf Bild. Die Karte bleibt auf Glyphe — ein Test hält fest, dass `MapCanvas` weiter `ICON_PATHS` benutzt. |
| **T-M33-05** | Abnahme des Meilensteins | `pnpm verify` grün, Zeichenbudget nachgemessen (Risiko 4), ein Absatz in `PROGRESS.md` und ein Satz in `WORKFLOW.md`. |

---

## 5 · Selbstkritik und Risiken

1. **Zwei Bildsprachen im selben Spiel.** Auf der Karte ein Rechteck mit Oval, in der Liste
   ein Panzer von der Seite. Wer beides zum ersten Mal sieht, muss den Zusammenhang selbst
   herstellen. *Gegenmittel:* Rahmen, Farbe und Zahlstellung bleiben identisch — nur die
   Füllung wechselt. *Restrisiko:* bleibt. Es ist der Preis dafür, dass elf Pixel keinen
   Panzer tragen.
2. **Der Wächter deckt `art.tsx` nicht von allein.** Ohne T-M33-01 entstünde das größte
   Asset-Loch des Projekts genau dort, wo die Anforderung am schärfsten ist. Deshalb steht
   die Wächtererweiterung in derselben Aufgabe wie die erste Zeichnung, nicht dahinter.
3. **Bestehende Tests hängen an `ICON_PATHS`.** `Panels.test.tsx:1032` vergleicht gezeichnete
   Pfade mit `ICON_PATHS[...]`. Wo ein Panel auf Bilder umstellt, fällt der Test — und das
   ist die richtige Reaktion. Er wird angepasst, nicht gelockert.
4. **Mehr SVG-Knoten je Zeile.** Die Armeeliste kann lang werden; je Zeile steigt die Zahl
   der Pfade von zwei auf vier. Das ist wahrscheinlich belanglos, aber „wahrscheinlich" ist
   in diesem Projekt kein Befund. **T-M33-05** misst das Zeichenbudget nach (die Aufgabe
   T-M33-06 gibt es nicht; der Plan schrieb sich hier vertippt), gegen den Ausgangswert
   p95 5,39 ms. Ergebnis am 2026-09-11: 2,37 / 2,89 / 2,46 ms — und der Node-Benchmark
   misst die **Karte**, nicht die Panel-Zeile; die Zahl dazu steht in `PROGRESS.md`.
5. **Die Infanterie ist die eine Ausnahme.** Neun Einheiten zeigen ihr Gerät, die zehnte
   zeigt einen Menschen. Die Regel hat damit einen Sonderfall, und das ist bewusst: die
   Infanterie *ist* das Gerät, und ein Helm auf einem Gewehr wurde in der ersten Runde nicht
   gelesen. Beide Fassungen stehen im Entwurfsblatt, Abschnitt 2b, die verworfene bleibt
   sichtbar.
6. **Was dieser Plan nicht liefert.** Keine Stufenabzeichen (ein Gebäude auf Stufe 3 sieht
   aus wie auf Stufe 1, die Zahl steht daneben), keine Bewegung, kein Bild im Gefechtsbericht.
   Das sind Erweiterungen für später, keine Lücken in diesem hier.
7. **Der bestehende Symboltest prüft die Koordinaten nur scheinbar.**
   `icons.test.tsx:48` zieht mit `/-?d+(.d+)?/g` Zahlen aus dem Pfadstring und vergleicht sie
   mit dem 24er-Kasten. Der Ausdruck trifft `d` als Buchstaben statt `\d` als Ziffer, und selbst
   richtig geschrieben wäre er falsch: in `h-12` ist die −12 eine Länge, keine Koordinate. Die
   Zusicherung ist damit doppelt bedeutungslos. T-M33-01 ersetzt sie durch eine echte
   Pfadabfahrt, die den Stift mitführt, und wendet dieselbe auf beide Sätze an — **zuerst am
   alten Satz vorführen, dass sie rot werden kann**, sonst ist die Reparatur wieder nur ein
   Wächter über dem Nichts.

---

## 6 · Entscheidungen, die dieser Plan trifft (Eintrag in DECISIONS.md nach dem Bau)

- **D33-a** — Die Karte behält die NATO-Glyphe. Begründung: 11 px.
- **D33-b** — Der Bildsatz liegt in einer eigenen Datei, nicht in `icons.tsx`. Begründung:
  `ICON_PATHS` ist ein `Record<…, string>`, an dem `Path2D` und drei Tests hängen; zwei
  Pfade je Zeichnung passen dort nicht hinein, ohne die Kartenschnittstelle zu verbiegen.
- **D33-c** — Gefechtsbericht und Erklär-Fenster bekommen kein Bild. Noahs Wahl vom
  2026-09-11; wieder aufnehmbar, ohne etwas zurückzubauen.
