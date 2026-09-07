# ✅ ERLEDIGT — BAUPLAN M19–M21

> # Alle fünfzehn Aufgaben sind gebaut.
>
> **Abgeschlossen am 2026-09-07.** Diese Datei beschreibt **keine offene Arbeit mehr.** Sie
> bleibt stehen, weil sie die *Begründungen* trägt, gegen die gebaut wurde — und weil sich
> mehrere Entscheidungen dieser Umsetzung nur im Kontrast zu ihr verstehen lassen.
>
> **Was tatsächlich gebaut wurde, und wo es abweicht**, steht in `PROGRESS.md` (fünfzehn
> Einträge, T-M19-01 bis T-M20-04) und in den Berichten `docs/reports/map-geometry.md` und
> `docs/reports/onboarding.md`. `tasks.yaml` führt alle fünfzehn auf `done`.
>
> ## Fünf Zahlen dieses Plans waren nicht reproduzierbar
>
> Sie sind alle nachgemessen; die Messungen stehen in den Berichten. Wer hier liest, muss
> das wissen:
>
> | Behauptung | gemessen |
> |---|---|
> | „G2 fällt mit 130 von 237" bei 99 % Schwelle | **66** — die 130 gilt für 100 % |
> | „G1 mit 4" | **14** ohne Toleranz, 4 erst ab über 6 px |
> | „G3 10 von 28" | nicht prüfbar, die Datei gab es nicht |
> | 25 px² Filterschwelle | lässt **38 Provinzen** unter der 99-%-Schwelle, die dieselbe Aufgabe grün verlangt |
> | „AUS-SE ist zu klein zum Anklicken" | Singapur (4 px²), Bahrain (5), Malta (6) sind kleiner und anklickbar — die **Überdeckung** war der Fehler, nicht die Größe |
>
> **Eine Zahl des Plans war dagegen richtig und hat einen Fehler von mir gefangen:** die
> 43 Ticks bis zur ersten Einheit. Meine Rechnung kam auf 41, weil Bauen und Ausheben die
> Moral verschieden skalieren. Ohne die Zahl im Plan hätte mein eigener Test die falsche
> zementiert.
>
> ---
>
> <details><summary>Der ursprüngliche Bauplan (2026-09-07, vor der Umsetzung)</summary>
>
> **Das ist die einzige Datei, die du für die Umsetzung von M19, M20 und M21 brauchst.**
> Sie enthält je Aufgabe die Dateien, die Zeilen, den Code vorher und nachher, den Test und
> die Fallen. Du musst **nicht** suchen, nicht greppen, keine Kapitel querlesen.
>
> **Stand:** 2026-09-07 · **Nichts davon ist gebaut.**

## Wie du das hier benutzt

1. `docs/plan/WORKFLOW.md` §0 — ankommen, Branch prüfen, `pnpm install`. (155 Zeilen, einmal.)
2. Nimm die **nächste offene Aufgabe** aus der Reihenfolge unten.
3. Lies **nur ihren Abschnitt hier**. Er ist selbsttragend.
4. Baue: erst der Test, dann der Code. `pnpm verify` grün, dann `tasks.yaml` auf `done`, dann
   Commit.

**Was du nicht lesen musst:** `02-DESIGN.md` (D21–D23 begründen, *warum* — dieser Bauplan sagt
*wie*), `01-REQUIREMENTS.md`, `PROBLEME.md`. Schlag dort nur nach, wenn eine Entscheidung
ansteht, die der Bauplan nicht trägt.

> ⚠ **Die eine Regel, die dieses Projekt teuer gelernt hat:** Ein Test, der nach der
> Reparatur geschrieben wird, hat nie bewiesen, dass er den Fehler findet. Nimm die Reparatur
> einmal weg (`git stash` ist hier verboten — nutze `git show HEAD:pfad > pfad`), lass den Test
> fallen, stell sie wieder her. Zwei Minuten. Jeder Abschnitt unten sagt, **woran** der Test
> heute scheitern muss.

## Die Reihenfolge

Topologisch aufgelöst, bei Gleichstand nach Nutzen. **Arbeite sie von oben ab.**

| # | Aufgabe | wartet auf | warum hier |
|---|---|---|---|
| 1 | T-M19-01 | — | misst zuerst; der Wächter ist **erwartet rot** |
| 2 | T-M19-02 | 1 | die eigentliche Reparatur |
| 3 | T-M19-03 | 2 | Grönland, klein |
| 4 | T-M19-04 | 2 | Südostaustralien — **einzige Aufgabe mit Simulationswirkung** |
| 5 | T-M19-05 | 2,3,4 | Bericht mit Bildbeleg |
| 6 | T-M21-06 | — | drei Falschauskünfte; unabhängig, klein, hoher Nutzen |
| 7 | T-M20-01 | — | die zugesagten Symbole |
| 8 | T-M20-02 | 7 | Nationsfarben |
| 9 | T-M20-03 | 7 | zeigen, was längst berechnet wird |
| 10 | T-M21-01 | — | Texte in die Sprachdatei — **vor** T-M21-02 |
| 11 | T-M21-02 | 10 | die Führung folgt dem Spiel |
| 12 | T-M21-03 | 11 | das Warten benennen |
| 13 | T-M21-04 | 11 | Freischaltungs-Bindung |
| 14 | T-M21-05 | 12,13 | Durchgang messen |
| 15 | T-M20-04 | 8,9,2 | Bewegung — **zuletzt, weil am riskantesten** |

## Jede Datei, die unten vorkommt — mit vollem Pfad

Damit du nie greppen musst. Kurznamen im Fließtext meinen immer diese hier.

| Kurzname | voller Pfad |
|---|---|
| `types.ts` | `packages/core/src/state/types.ts` |
| `validate.ts` | `packages/core/src/map/validate.ts` |
| `build-map.mjs` | `scripts/build-map.mjs` |
| `project.ts` | `packages/mapgen/src/project.ts` |
| `worldmap.test.ts` | `packages/mapgen/src/worldmap.test.ts` |
| `render.ts` | `apps/desktop/src/map/render.ts` |
| `picking.ts` | `apps/desktop/src/map/picking.ts` |
| `MapCanvas.tsx` | `apps/desktop/src/map/MapCanvas.tsx` |
| `markers.ts` | `apps/desktop/src/map/markers.ts` |
| `App.tsx` | `apps/desktop/src/App.tsx` |
| `Panels.tsx` | `apps/desktop/src/ui/Panels.tsx` |
| `Standings.tsx` | `apps/desktop/src/ui/Standings.tsx` |
| `Header.tsx` | `apps/desktop/src/ui/Header.tsx` |
| `icons.tsx` | `apps/desktop/src/ui/icons.tsx` |
| `motion.ts` | `apps/desktop/src/ui/motion.ts` |
| `app.css` | `apps/desktop/src/ui/app.css` |
| `de.ts` | `apps/desktop/src/i18n/de.ts` |
| `actions.ts` | `apps/desktop/src/game/actions.ts` |
| `tutorial.ts` | `apps/desktop/src/game/tutorial.ts` |
| `Tutorial.tsx` | `apps/desktop/src/ui/Tutorial.tsx` |
| `movement.ts` | `packages/core/src/phases/movement.ts` |
| `occupation.ts` | `packages/core/src/phases/occupation.ts` |
| `events/types.ts` | `packages/core/src/events/types.ts` |
| `publicView.ts` | `packages/core/src/view/publicView.ts` |
| `world.json` | `data/maps/world.json` (Erzeugnis) |
| `world-shapes.json` | `data/maps/world-shapes.json` (**Quelle**, vollständig und richtig) |
| `world-provinces.csv` | `data/maps/world-provinces.csv` |
| `constants.json` | `data/rules/default/constants.json` |
| `buildings.json` | `data/rules/default/buildings.json` |
| `units.json` | `data/rules/default/units.json` |
| `text-keys.test.ts` | `test/guards/text-keys.test.ts` |
| `icons.test.tsx` | `apps/desktop/src/ui/icons.test.tsx` |
| `ANLEITUNG.md` | `docs/ANLEITUNG.md` |

**Neu anzulegen:** `packages/mapgen/src/worldmap.geometry.test.ts`, `data/maps/landmarks.csv`,
`apps/desktop/src/map/picking.test.ts`, `apps/desktop/src/map/MapCanvas.test.tsx` (existiert
seit T-M16-06 — erweitern, nicht neu), `docs/reports/map-geometry.md`,
`docs/reports/onboarding.md`.

## Was für alle Aufgaben gilt

- **Tests zuerst.** Jede Aufgabe unten nennt den Test und woran er heute scheitert.
- **Keine neue Abhängigkeit.** Kein `fetch`, kein `<img>`, keine Farbliterale in Komponenten.
- **Festkomma:** `ONE = 1000`, `mulFixed`/`divFixed` statt `*` und `/`. Eine Ausnahme braucht
  einen Kommentar mit Grund (die Lint-Regel verlangt ihn).
- **Kommentare erklären das Warum**, in der Sprache der Datei, in die du schreibst.
- **Fertig heißt:** `pnpm verify` grün, `tasks.yaml` auf `done`, ein Eintrag in `PROGRESS.md`,
  ein Commit.
- **Benchmarks brauchen die Maschine allein.** Vor jeder Messung:
  `powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage"` — unter 10 % ist brauchbar.
- **Kein `cmd | tail`**, wenn der Exit-Code zählt: die Pipe meldet den Status von `tail`.

---

# M19 — Die Karte zeigt, was da ist

## T-M19-01 · Der Wächter, der es hätte finden müssen

**Was du baust:** vier Prüfungen, die `world.json` gegen `world-shapes.json` halten. Sie sind
**heute rot** und sollen es sein — sie messen den Schaden, den T-M19-02 behebt.

### Schritt 1 — die Projektion herausziehen

`scripts/build-map.mjs:320-325` rechnet Längen- und Breitengrad in Bildpunkte um. Ein Wächter
darf das **nicht abschreiben** — zwei Tabellen der Wahrheit sind genau der Fehler, den dieses
Projekt schon zweimal bezahlt hat.

Lies `scripts/build-map.mjs:318-326` (neun Zeilen) und verschiebe `WIDTH`, `HEIGHT`, `TOP`,
`BOTTOM`, `toX`, `toY` nach `packages/mapgen/src/project.ts` als benannte Exporte. In
`build-map.mjs` bleibt ein Import. **Verschieben, nicht kopieren.**

### Schritt 2 — die vier Prüfungen

Neue Datei `packages/mapgen/src/worldmap.geometry.test.ts`. Lies zuerst
`packages/mapgen/src/worldmap.test.ts` (wie es die beiden JSON-Dateien lädt) und **übernimm
dessen Idiom**.

| | prüft | fällt heute |
|---|---|---|
| **G1** | `center` liegt in einem der eigenen gezeichneten Ringe | 4 von 237 |
| **G2** | gezeichnete Fläche ≥ 99 % der Quellfläche | **130 von 237** |
| **G3** | bekannte Städte liegen an Land | 10 von 28 |
| **G4** | kein Punkt außerhalb `[0,4000] × [0,2400]` | 1 (Grönland) |

G2 ist die vollständige: ein reiner Datenvergleich zweier Dateien, die beide im Baum liegen.
Fläche mit der Schnürsenkelformel über die **projizierten** Koordinaten.

### Schritt 3 — rot sein dürfen, ohne die Kette zu blockieren

Diese Prüfungen dürfen `pnpm verify` **nicht** rot machen, bevor T-M19-02 landet. Nimm eine
**benannte Übergangsliste** im Test, keine `it.fails`:

```ts
/** Provinzen, die T-M19-02 noch nicht repariert hat. Diese Liste darf nur schrumpfen. */
const NOCH_KAPUTT: ReadonlySet<string> = new Set([/* die 130 IDs */])
```

Der Test prüft dann: jede Provinz **außerhalb** der Liste hält die Schwelle, **und** die Liste
enthält keine ID, die inzwischen heil ist (die Gegenrichtung — sonst schrumpft sie nie).
T-M19-02 leert sie auf `new Set([])`.

> ⚠ **Falle:** `it.fails` wäre der schnellere Weg und der falsche — er wird grün, sobald der
> Test *irgendwie* fällt, auch aus einem ganz anderen Grund.

### Schritt 4 — die Landmarken

`data/maps/landmarks.csv`, rund 25 Städte über alle Kontinente, Format wie die anderen CSVs in
`data/maps/` (sieh dir eine an). Toleranz **5 px** — ohne sie flackert der Test an der
vereinfachten Küstenlinie (New York liegt 0,9 px vor der Küste).

### Fertig wenn

`docs/reports/map-geometry.md` nennt je Prüfung die heutige Zahl, gegen den Commit gestempelt.
`pnpm verify` grün.

---

## T-M19-02 · Eine Provinz darf mehrteilig sein

**Der Kern des Ganzen.** Und die gute Nachricht zuerst: **die Zeichenschleife bleibt
unverändert.** Wenn `prepareFrame` je Ring eine Form liefert, merkt `MapCanvas` nichts davon.

### Schritt 1 — der Typ

`packages/core/src/state/types.ts:77`:

```ts
  polygon: ReadonlyArray<readonly [number, number]>
```

wird zu:

```ts
  /**
   * Die Umrisse der Provinz — **mehrere**, denn Alaska und Kalifornien gehören derselben
   * Macht und liegen nicht aneinander (T-M19-02, R-MAP-08).
   *
   * Bis zum 2026-09-07 stand hier ein einzelner Ring, und der Generator musste wählen. Er
   * wählte den mit den meisten Punkten — für „Westen der USA" also Alaskas Fjordküste, und
   * die Weststaaten fielen aus der Karte. 130 von 237 Provinzen verloren so Land.
   */
  polygons: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
```

**Umbenennen, nicht danebenlegen.** Zwei Felder wären zwei Wahrheiten; der Compiler zeigt dir
alle acht Fundstellen.

### Schritt 2 — der Generator

`scripts/build-map.mjs:366-370`, heute:

```js
  const outer =
    p.geometry.type === 'MultiPolygon'
      ? p.geometry.coordinates.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]
      : p.geometry.coordinates[0]
```

wird zu: alle äußeren Ringe nehmen, projizieren, und die unter **25 px²** wegwerfen
(Schnürsenkelfläche auf den projizierten Punkten). Das holt 99,79 % des Landes bei +26 %
Punkten zurück. Zeile 379 `polygon: outer.map(...)` wird `polygons: […]`.

> ⚠ **Die Falle, an der jede naheliegende Reparatur scheitert:** „nimm den größten Ring"
> wählt nach der Projektion **wieder Alaska** — Mercator bläht hohe Breiten mit 1/cos²(φ) auf
> (Alaska 84 453 px² gegen Weststaaten 58 147 px², bei echter Fläche aber 268 gegen 329 Grad²).
> Deshalb: **alle** behalten, nicht besser wählen.

### Schritt 3 — die acht Fundstellen

| Datei | Zeile | was zu tun ist |
|---|---|---|
| `packages/core/src/map/validate.ts` | 112 | jeder Ring ≥ 3 Punkte, mindestens ein Ring |
| `apps/desktop/src/map/render.ts` | 19 | `RenderProvince.polygon` → `polygons` |
| `apps/desktop/src/map/render.ts` | 83, 86 | **`prepareFrame` schiebt je Ring eine Form** — die Schleife darüber bleibt |
| `apps/desktop/src/map/picking.ts` | 92, 95 | `pointInPolygon` über **irgendeinen** Ring (`some`) |
| `apps/desktop/src/map/MapCanvas.tsx` | 82 | `boundsOf` über alle Ringe |
| `apps/desktop/src/map/MapCanvas.tsx` | 201 | Auswahlumriss: die Schleife je Ring einmal |
| `apps/desktop/src/App.tsx` | 314-315 | durchreichen |

`boundsOf` (in `picking.ts`) bekommt eine Fassung über mehrere Ringe — die Hülle aller.

> ⚠ **Falle:** `prepareFrame` vergibt dann `shape.id` mehrfach (je Ring einmal). Prüfe, ob
> irgendetwas die Formen nach `id` indiziert — die Füllschleife tut es nicht, aber sieh nach,
> bevor du es annimmst.

### Schritt 4 — der Test, der beißt

`apps/desktop/src/map/picking.test.ts`: ein Klick auf **Alaska** und einer auf **Kalifornien**
wählen dieselbe Provinz `USA-WEST`. Nimm die Koordinaten aus `world.json` (Alaska liegt um
x 300/y 500, die Weststaaten um x 700/y 950 — rechne sie aus den Ringen aus, rate sie nicht).
**Heute schlägt der zweite Klick fehl**, weil dort kein Polygon liegt.

### Fertig wenn

Die vier Prüfungen aus T-M19-01 sind grün und `NOCH_KAPUTT` ist leer — **ohne dass eine
Schwelle weicher wurde**. `pnpm verify` grün. Die Zeichenmessung aus T-M16-06 wiederholt:
16,7 ms bei p95, **gemessen** (+26 % Punkte sind zu messen, nicht zu schätzen).

### Was NICHT passiert

Keine Migration, kein Golden Master, kein Schemaschritt: `polygon` wird außerhalb von
`validate.ts` nirgends gelesen — nicht im Kern, nicht in der KI. Die **Partie ändert sich
nicht**, nur das Bild und was anklickbar ist.

---

## T-M19-03 · Grönland bleibt auf der Leinwand

`world.json` GRL hat **796 Punkte oberhalb der Leinwand**, y bis −436. Der 78°-Beschnitt in
`build-map.mjs:322-325` wird nie geklippt.

Klippe in `build-map.mjs`, **nachdem** projiziert wurde, gegen das Rechteck `[0,4000]×[0,2400]`.

> ⚠ **Falle:** `y = Math.max(0, y)` faltet die ganze Nordküste auf eine gerade Linie am oberen
> Rand. Nimm eine echte Polygonklippung gegen die Kante (Sutherland–Hodgman ist zwanzig Zeilen)
> oder verschiebe den Beschnitt so weit nach Norden, dass Grönland ganz hineinpasst — das ist
> die billigere Antwort, kostet aber Karte im Süden. **Miss beides, entscheide dann.**

Fertig, wenn G4 grün ist **und** Grönlands Küste an der Kante durchgehend bleibt (sieh es dir
an, ein Test allein fängt das Zusammenfalten nicht).

---

## T-M19-04 · Südostaustralien ist ein Punkt

⚠ **Die einzige Aufgabe in M19, die die Partie ändert.** Lies das, bevor du anfängst.

`AUS-SE` ist eine **spielbare Provinz von 39 px²**, ganz innerhalb von `AUS-NE`. Sie besteht
aus Australian Capital Territory, Jervis Bay und Macquarie-Insel — die Kuratierung hat einen
Namen vergeben, den die Geometrie nicht trägt.

**Gemessen:** sie steht in Australiens Startaufstellung, trägt **52 097 Einwohner**, zwei
Vorkommen und **drei Kanten**.

Zwei Wege, und der sichere ist der erste:

1. **Fläche geben** — `data/maps/world-provinces.csv` bekommt für `AUS-SE` weitere Quelleinheiten
   (Victoria, New South Wales), die heute in `AUS-NE` stecken. Ändert die Partie **nicht**:
   dieselben Provinzen, andere Grenze.
2. **Streichen** — dann fällt die Provinz aus Startaufstellung, Kantenliste und Punktesumme.
   **Das ändert AK-1**, also gehört ein neuer `pnpm sim:fullgame` dazu und die neue Zahl in den
   Bericht.

Dazu ein Wächter über die Mindestgröße einer **spielbaren** Provinz, der seine Schwelle nennt.

---

## T-M19-05 · Der Bericht sagt, was die Karte zeigt

`docs/reports/map-geometry.md`: je Prüfung vorher/nachher, gegen den Commit gestempelt — wie
`acceptance.md` und `packaging.md` es tun.

**Dazu ein Bildbeleg**: derselbe Kartenausschnitt (Nordamerika) vorher und nachher. Der
gemeldete Fehler war sichtbar; vier grüne Zahlen sind kein Nachweis, dass Kalifornien da ist.
Screenshot per `pnpm --filter @worldwar/desktop dev` und Browser, oder am gebauten Programm.

Und: der Eintrag in `PROBLEME.md` vom **2026-09-03** stellte über genau diese vier Provinzen
fest, „die Karte zeichnet richtig". Er war für `world-shapes.json` wahr und für `world.json`
falsch. Berichtige ihn an Ort und Stelle mit Datum.

---

# T-M21-06 · Drei Auskünfte, die falsch sind oder nie ankommen

**Steht hier vorgezogen**, weil sie unabhängig, klein und sofort spürbar ist.

## (a) Die Kosten gesperrter Dinge erreichen den Bildschirm nie

`apps/desktop/src/ui/Panels.tsx:81`:

```tsx
          title={action.disabledReason ?? action.hint ?? undefined}
```

Bei einem gesperrten Knopf gewinnt der Grund, und der Hinweis mit **Kosten und Dauer** fällt
weg. Der Spieler erfährt, *dass* es die Fabrik erst ab Tag 8 gibt, aber nie, *was sie kosten
wird* — Vorausplanen ist unmöglich.

Verschärfend: `availabilityHint()` (`apps/desktop/src/game/actions.ts:106-109`) liefert seinen
Text **nur, solange die Sache gesperrt ist** — also genau dann, wenn er verworfen wird.
**Toter Code, gebaut in T-M15-03.**

Ersetze durch beides, Grund **und** Hinweis, getrennt durch „ · ".

**Test:** am gerenderten Baum, nicht an den Daten — `getByRole('button', …)` und das
`title`-Attribut prüfen. Der bestehende Test (`actions.test.ts:312-327`) prüft die Daten und
war deshalb grün.

## (b) Die Erklärung zum Frieden ist falsch

`apps/desktop/src/i18n/de.ts:490`:

```ts
      peace: 'Kein Krieg, kein Bündnis. Truppen dürfen die Grenze nicht überschreiten.',
```

`packages/core/src/phases/movement.ts:33` ruft `findPath` **ohne** `canEnter` — sie dürfen.
Frieden hindert nur am **Behalten** (`occupation.ts:40`). Wer dem Text glaubt, hält seine
Grenze für sicher.

Neuer Text sinngemäß: *Kein Krieg, kein Bündnis. Truppen dürfen einmarschieren — behalten
lässt sich fremdes Gebiet aber erst im Krieg.*

**Test:** prüfe die Behauptung gegen den **Code**, nicht gegen den Text — ein Zug über eine
Friedensgrenze gelingt, die Eroberung nicht.

## (c) Die Anleitung widerspricht dem Spiel

`docs/ANLEITUNG.md:124`: „**Es gibt nichts zurück**" — der Code erstattet die Hälfte
(`CANCEL_REFUND_PERMILLE`), und der Playtest hat es gemessen (+166 Material, +125 Geld).
Derselbe Irrtum stand im Playtest-Bogen und ist dort am 2026-09-06 berichtigt worden.

Berichtige die Stelle. Für den Wächter gilt: **eine allgemeine Prüfung „die Anleitung nennt
keine Zahl, die den Regeln widerspricht" ist nicht billig zu haben** — Prosa lässt sich nicht
gegen JSON diffen, ohne eine Falschmeldungsmaschine zu bauen. Nimm stattdessen die schmale,
ehrliche Fassung: **die Anleitung nennt keine Zahl, die auch in `constants.json` steht, ohne
sie von dort zu beziehen** — oder verzichte auf den Wächter und schreibe in `PROBLEME.md`,
dass diese Fehlerklasse ungeprüft bleibt. **Beides ist vertretbar; das Schweigen darüber nicht.**

---

# M20 — Die Karte spricht mit

> **Der Rahmen, der alle drei Aufgaben bestimmt:** kein `<img>` (ein Wächter verbietet den
> Text `<img ` im Produktionscode), keine neue Bilddatei ohne Eintrag in `docs/ASSETS.md`,
> keine Farbliterale in Komponenten (Lint), heller Grund festgeschrieben (`design-gate`).
> **Die Antwort auf „welche Art Bild" lautet deshalb: gezeichnete, aus dem eigenen Satz.**
>
> Keine dieser drei Aufgaben rührt die Zeichenschleife der Karte an — **die 16,7-ms-Messung
> brauchst du hier nicht zu wiederholen.**

## T-M20-01 · Die zugesagten Symbole, die es nicht gibt

R-UI-10 nennt im Text den **Beziehungszustand**, R-UI-11 die **Geländeart**. Beides sind
V1-Anforderungen, beides steht heute als deutsches Wort da.

**Elf neue Pfade** in `apps/desktop/src/ui/icons.tsx`:

| Satz | Schlüssel |
|---|---|
| Beziehung (6) | `peace`, `war`, `truce`, `alliance`, `rightOfWay`, `sharedMap` |
| Gelände (5) | `mountain`, `plains`, `desert`, `forest`, `urban` |

Je ein Pfad im 24×24-Feld, ein Strich, kein `fill`, lesbar bei 14 px. Sieh dir zwei
bestehende an (`icons.tsx:49-92`, etwa `harbour` und `fortress`) und **triff ihren Ton**.
Dann zwei Nachschlagetabellen `RELATION_ICONS` und `TERRAIN_ICONS` neben den bestehenden.

**Der Wächter** in `apps/desktop/src/ui/icons.test.tsx` prüft heute Einheiten, Gebäude und
Rohstoffe gegen die Regeldateien. Er bekommt die zwei neuen Sätze dazu — gegen die
**Aufzählung im Code** (Beziehung) und gegen die **Geländearten der Karte** (`world.json`).
Er muss gegen den heutigen Stand nachweislich rot sein.

## T-M20-02 · Jede Macht hat ein Gesicht

Die Farbe steht in der Sicht (`publicView.ts:386`, `color: other.color`) und wird außerhalb
der Karte nirgends benutzt.

| Ort | heute | Zeile |
|---|---|---|
| Lage | `<td>{row.nation}</td>` | `Standings.tsx:81` |
| Diplomatie | `<td>{nameOf(other.id)}</td>` | `Panels.tsx:599` |
| Protokoll, Provinzansicht | nur Name | — |

Ein Farbfeld **vor** dem Namen. Die Farbe kommt als `style={{ background: color }}` aus den
**Daten** — das ist kein Farbliteral im Quelltext und verletzt die Lint-Regel nicht. Die Form
(Größe, Rundung, Rahmen) gehört nach `app.css` und benutzt dort nur `var(--*)`.

> **AK2 ist kein Beiwerk:** die Farbe darf nie das einzige Unterscheidungsmerkmal sein. Der
> Name bleibt daneben stehen — rund acht Prozent der Männer unterscheiden Rot und Grün nicht,
> und die Spielerfarben enthalten beides.

## T-M20-03 · Was längst berechnet wird, wird auch gezeigt

Drei Größen werden bereits gerechnet und nicht gezeigt:

| Größe | wo sie entsteht | wo sie hin soll |
|---|---|---|
| `categoryOf(type)` → Rubrik | `Panels.tsx:477-482` | Protokollzeile, `Panels.tsx:531-552` |
| `dominantIcon(units)` → Gattung | `map/markers.ts:52-60` | Armeezeile, `Panels.tsx:318-320` |
| `RESOURCE_ICONS` | `icons.tsx:148` | Wirtschaftstabelle |

Jeweils ein `<Icon name={…} size={14} />` vor den Text. Das Muster steht in
`Header.tsx:82-84` und ist das gute Vorbild — Symbol, Zahl, versteckter Name für Vorleser.

> **Der Markt bleibt ausgenommen, und das ist eine Entscheidung.** `Panels.tsx:655-678` nutzt
> `<select><option>`, und ein `<option>` kann kein SVG tragen. Es gegen eine eigene Liste zu
> tauschen wäre Bedienbarkeit gegen Aussehen — **das entscheidet Noah, nicht du.** Schreib den
> Verzicht mit Begründung in `DECISIONS.md`.

## T-M20-04 · Die Oberfläche antwortet

**Zuletzt, weil am riskantesten.** `MapCanvas` ist die am schlechtesten abgedeckte Datei der
Oberfläche (168 von 249 Zeilen seit T-M16-06), und diese Aufgabe zeichnet dort jeden Frame.

Hier liegt eine **offene V1-Zusage**: R-UI-04 verspricht „Bewegungs- **und**
Kampfanimationen", und nur die Kampfhälfte existiert.

Zwei Bremsen sind gebaut und bleiben unangetastet: `motionAllowed(speed, reduced)`
(`ui/motion.ts:37-39`) schaltet oberhalb der Tempogrenze und unter `prefers-reduced-motion`
alles ab — *„bei hundert Spielstunden je Sekunde würde der Ring stroboskopieren, und das ist
keine Atmosphäre, sondern eine Störungslampe."*

**Fertig wenn:** `pnpm verify` grün **und die Zeichenmessung wiederholt** — 16,7 ms bei p95,
gemessen bei ruhiger Maschine. Das ist die eine Aufgabe in M20, die sie braucht.

---

# M21 — Die ersten Spieltage führen

> **Was du hier baust, ist keine neue Einstiegshilfe.** Es gibt eine, sie ist gut gebaut, und
> ihre drei Regeln bleiben: **sie blockiert nie, sie kommt nur beim ersten Mal, sie bleibt aus,
> wenn man sie abschaltet.** Was fehlt, ist der Zweck — sie erklärt die Knopfleiste, nicht das
> Spiel.

## T-M21-01 · Die Texte der Führung ziehen in die Sprachdatei

`apps/desktop/src/game/tutorial.ts:25-56` trägt fünf Schritte mit `title` und `text`
**als Zeichenketten im Quelltext**. `de.ts:432-435` kennt unter `tutorial` nur `title` und
`dismiss`. Das verletzt **R-UI-07**.

Neue Schlüssel `tutorial.steps.<id>.title` und `.text` für `select`, `build`, `speed`,
`fastForward`, `events`. In `TUTORIAL_STEPS` stehen dann `t('tutorial.steps.select.title')`.

**Der neue Wächter** in `test/guards/text-keys.test.ts`: er prüft heute Schlüssel ohne Text,
jetzt auch die Gegenrichtung — **anzeigbarer Text im Quelltext einer Komponente**.

> ⚠ **Sei ehrlich über die Grenze dieses Wächters:** eine Regel „Prosa im Quelltext" kann
> nicht sauber zwischen einem Anzeigetext und einer Kennung unterscheiden. Zieh die Linie eng
> und begründet — etwa: *in `game/tutorial.ts` und `ui/*.tsx` darf kein String-Literal mit
> einem Leerzeichen und mehr als drei Wörtern stehen, das nicht in `t()` eingebettet ist.* Was
> die Regel **nicht** fängt, gehört in ihren Kommentar. Ein Wächter, der vorgibt, mehr zu
> können, ist schlimmer als ein enger, der sagt, was er kann.

**Diese Aufgabe steht zuerst** — sonst entstehen in T-M21-02 zwölf neue Texte am falschen Ort.

## T-M21-02 · Die Führung folgt dem Spiel, nicht der Knopfleiste

`tutorial.ts:22` heute:

```ts
  completesOn: 'selectProvince' | 'openBuild' | 'setSpeed' | 'fastForward' | 'openEvents'
```

Fünf **Oberflächen**ereignisse. Es kommt hinzu, was das **Spiel** meldet — Bau fertig, Einheit
ausgehoben, Provinz erobert — und die **Zeit**: ein Spieltag vergangen.

Die Ereignisse liegen bereits in `state.eventLog`; die Typnamen stehen in
`packages/core/src/events/types.ts` (`BUILD_COMPLETED`, `UNIT_RECRUITED`, …). In `App.tsx`
gibt es den Ereignis-Merker (`const events = useMemo(…)`, um Zeile 655) — von dort speist du
`advance()` der Führung.

> ⚠ **Falle:** Seit T-M12-09 landen die am Tagesende entstandenen Ereignisse im Protokoll.
> Verlass dich darauf, aber prüfe es im Test — ein Führungsschritt, der auf `DAY_REPORT`
> wartet, wäre vor dieser Reparatur nie weitergegangen.

**Der Test, der zählt:** eine **echte Partie** so weit führen, dass ein Schritt durch ein
Spielereignis endet — nicht durch einen Klick.

## T-M21-03 · Die Führung nennt das Warten beim Namen

Gerechnet aus den Regeln, mit Moralskalierung:

| | |
|---|---|
| Startvorrat Material | 350 — die Kaserne kostet **333** |
| Kaserne | 24 Ticks → **27** bei Moral 70 000 |
| Infanterie | 12 Ticks → **16** |
| **Erste Einheit** | **Tick 43 = Spieltag 2, 19:00** |

Dazwischen gibt es nichts zu klicken, was voranbringt. **Dort steigt ein neuer Spieler aus.**

Ein Schritt, der das ausspricht und auf Tempo und Vorspulen zeigt.

> **Die Zahlen gehören nicht in den deutschen Satz.** Das Projekt hat die Regel, dass eine
> Zahl nicht an zwei Orten steht; `de.ts:441-443` sagt es für die Erklärtexte ausdrücklich.
> Rechne die Dauer zur Laufzeit aus den Regeln und setz sie als Platzhalter ein — so wie
> `actions.ts` es mit `costHint` tut.

## T-M21-04 · Jede Mechanik wird erklärt, wenn sie freigeschaltet wird

Das Rückgrat hat das Spiel schon: `availableFromDay` in `data/rules/default/buildings.json`
und `units.json`. Tag 1 Kaserne und Infanterie, Tag 2 Hafen, Tag 3 Festung und Transporter,
Tag 4 Motorisierte, Tag 5 Eisenbahn, Tag 8 Fabrik und Panzer, Tag 9 Werft und Artillerie,
Tag 10 Flugplatz und Jagdflugzeug, Tag 11 Zerstörer, Tag 13 Bomber, Tag 14 schwerer Panzer,
Tag 16 Raketenartillerie.

**Der Wächter ist die eigentliche Aufgabe:** jede Sache mit `availableFromDay` hat einen
Führungsschritt **oder** steht auf einer begründeten Ausnahmeliste. Ohne ihn fällt eine neue
Einheit still aus der Anleitung — dieselbe Bauart wie der Symbolsatz, der einst Schlüssel
führte, die es in den Regeln nicht gab.

## T-M21-05 · Der Durchgang wird gemessen, nicht behauptet

`docs/reports/onboarding.md`: ein Lauf über die ersten **16 Spieltage**. Welcher Schritt kam
wann, **wie lange war der Spieler ohne Aufgabe**, wo liegt die längste Pause.

**Die längste Pause ist die Zahl, die zählt** — sie ist die Stelle, an der jemand aufhört.

Dazu zwei Fragen in `docs/PLAYTEST.md`, die ein Mensch beantwortet: *wusste ich, was zu tun
ist* und *wusste ich, wozu*.

---

## Wenn du fertig bist

Alle fünfzehn Aufgaben auf `done`, `pnpm verify` grün, und dann:

1. `pnpm acceptance` — der volle Lauf (~75 min, Maschine allein).
2. `WORKFLOW.md` und `SESSION-STATE.md` im Vault nachziehen.
3. **Diese Datei löschen oder als erledigt kennzeichnen.** Ein Bauplan, der nach dem Bau
   stehen bleibt, wird beim nächsten Lesen für offene Arbeit gehalten.

</details>
