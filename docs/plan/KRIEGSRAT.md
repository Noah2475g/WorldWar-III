# KRIEGSRAT — der Umbau der Oberfläche (2026-09-10)

> **Noahs Auftrag (2026-09-10):** Aus drei Designrichtungen hat Noah **A „Kriegsrat"**
> gewählt — dunkler Kartentisch, Bernstein für Zeit und Befehle, Phosphor-Grün eigen,
> Zinnober Feind. Ausdrücklich gelobt: die **Marker im NATO-Stil** (Rechteck mit
> Glyphe). Davon will er mehr — auch für **Gebäude**, und die Gebäude sollen **in der
> Provinzfläche verteilt** auf der Karte stehen, nicht in Reihen und nicht nur im
> Panel. Dazu der Abgleich mit Supremacy WW3: *gleich gut oder besser, sonst in den Plan.*
>
> Der Entwurf ist fertig und liegt im Repo: **`docs/design/kriegsrat.html`** (drei Reiter:
> Spielbildschirm, Abgleich, Plan) und **`docs/design/kriegsrat-icons.svg`** (43 Symbole).
> Diese Datei hier ist der Bauplan. Methode wie bei LEVEL-UP 1–3: Analyse → Anforderungen
> → Entwurf (D27) → Aufgaben (M29–M32, Zwilling in `tasks.yaml` und `03-TASKS.md`).

---

## 0 · Für den Agenten, der das baut (lies nur das hier)

**Ankommen:**

```bash
git log --oneline -1          # muss die Spitze von claude/ui-ux-pro-max-bit-ba5d44 (oder deren Merge) sein
pnpm install
npx vitest run test/plan-consistency.test.ts   # muss grün sein, bevor du anfängst
```

**Was du liest, und sonst nichts:**

1. Diese Datei ganz (≈ 10 Minuten).
2. `docs/design/kriegsrat.html` im Browser öffnen (Reiter „Spielbildschirm") — das ist
   das Ziel. Nicht den Quelltext studieren; die Werte stehen unten in §3.
3. Je Aufgabe **nur** die in `03-TASKS.md` genannten Dateien, an den in §1 genannten
   Zeilen. Die Zeilennummern stammen vom 2026-09-10 und verschieben sich mit jeder
   Aufgabe — sie sind Einstieg, nicht Wahrheit.

**Was du nicht liest:** `01-REQUIREMENTS.md`, `02-DESIGN.md`, `03-TASKS.md` am Stück,
`LEVEL-UP*.md`, die Playtest-Berichte, `PROBLEME.md`. Alles, was davon zählt, steht hier.

**Was gilt (Kurzfassung von WORKFLOW.md §3/§4, dort nicht nachlesen):**

- Test zuerst, der ohne die Änderung fällt. `pnpm verify` grün je Aufgabe (~4 min).
- Farben **nur** in `tokens.ts` (Lint) **und** gespiegelt in `app.css` `:root` — beide
  Orte zusammen ändern; T-M29-01 baut dafür einen Wächter.
- Zeichenbudget: `render.bench.slow.test.ts` p95 < 16,7 ms, Stand 5,39 ms. **Erst messen,
  dann ändern** — vor jeder M30-Aufgabe den Wert notieren (Maschine allein, kein
  paralleler Lauf: `powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage"`).
- Kern (`packages/core`) bleibt in M29–M31 **unangetastet** (Golden-Master). M32 ändert
  ihn additiv und wird **erst nach Noahs Freigabe** gebaut.
- Sprache: Dokumente Deutsch, Code Englisch, `tasks.yaml` ohne Umlaute, Spielertexte in
  `de.ts` **mit** Umlauten (Wächter). Symbole sind SVG-Pfade, nie Emoji.
- jsdom rechnet kein Layout; Layout-Wächter binden Struktur und Kaskade. `rAF` unter
  `vi.useFakeTimers` stubben.
- Kein blankes `git stash` (geteilt mit anderen Worktrees). WIP-Commit stattdessen.
- Je erledigter Aufgabe: `status: done` in `tasks.yaml`, Zeile in `PROGRESS.md`,
  Selbstprüfung gegen das „Fertig wenn" in `03-TASKS.md`.

**Reihenfolge:** M29 → M30 → M31, jeweils Aufgabe für Aufgabe wie nummeriert. M32 nur
nach Freigabe. T-M28-06 (Einmarsch-Alarm) und T-M28-08 (Kämpfe als Ereignis) sind
ältere, offene Aufgaben, die dieselben Dateien anfassen; ihre Einordnung steht in §4.

---

## 1 · Analyse: was da ist, was fehlt (Stand 2026-09-10, mit Fundstellen)

Der Abgleich hat drei Annahmen des ersten Planentwurfs **widerlegt** — die Aufgaben sind
entsprechend kleiner geworden:

- **Die Ressourcenleiste mit Tagesbilanz existiert schon.** `ui/Header.tsx:75-105` zeigt je
  Rohstoff Symbol, Bestand, `rate(flow.balance)` und Reichweite, gespeist aus
  `packages/core/src/view/economy.ts:20-45` (`ResourceFlow.production/consumption/balance`
  je Spieltag). Sie braucht nur das neue Aussehen, keine neue Zahl.
- **Zoom und Pan existieren.** Mausrad (`MapCanvas.tsx:456-463`, Faktor 1,2), Ziehen
  (`:465-487`), Grenzen `limits` (`:124-134`), reine Funktionen in `map/picking.ts`
  (`zoomAt :182`, `centreOn :189`, `clampView :162`). Es fehlen Knöpfe, Symbolschwellen
  je Stufe und die Übersichtskarte.
- **Die Gefechts-Ursache ist im Ereignis.** `BattleResolvedEvent` (`events/types.ts:150-175`)
  trägt seit T-M27-01 `strengths`, `terrain`, `fortressLevel`, `entrenched`,
  `attackBlocked`; `battleSentence()` (`ui/Panels.tsx:658`) macht daraus den Satz. Der
  „Warum"-Text des Entwurfs ist damit Darstellung, keine Kernänderung.

Was wirklich fehlt (je Zeile eine Aufgabe in §4):

| Befund | Fundstelle | Aufgabe |
|---|---|---|
| Kein dunkles Schema; Farben doppelt in `tokens.ts:13-38` und `app.css:51-73`; `MAP_COLORS` fest aus `TOKENS` (`render.ts:319-327`); 11 helle `PLAYER_COLORS` (`tokens.ts:50-62`) mit ΔE-Wächter | `tokens.contrast.test.ts` | T-M29-01 |
| Kopfzeile: Tempo als Rasten-Liste (`Header.tsx:130-142`), Modus als `<select>` (`:160-169`), kein Alarmchip | `Header.tsx` | T-M29-02 |
| Provinzpanel: Gebäude als Liste (`buildingItems`, `Panels.tsx:77`), kein Raster, keine Fortschrittsanzeige der Bauschlange | `Panels.tsx:271-410` | T-M29-03 |
| Armee auf der Karte: Kasten 20×14 mit Icon, **ohne Stapelzahl, ohne Zustand** (`MapCanvas.tsx:378-389`); `ArmyMarker` hat nur `strength` (`markers.ts:17-48`) | `MapCanvas.tsx`, `markers.ts` | T-M30-01 |
| Gebäude auf der Karte: nur 4-px-Pips als Anzahl (`MapCanvas.tsx:366-376`, `markers.ts:184-197`), kein Typ, keine Verteilung in der Fläche | `MapCanvas.tsx` | T-M30-02 |
| Zoom ohne Knöpfe, ohne Schwellen je Stufe, ohne Übersichtskarte | `MapCanvas.tsx`, `picking.ts` | T-M30-03 |
| Marschpfeil: gleichmäßige Linie mit `MARCH_AHEAD_ALPHA` (`render.ts:209-259`), keine Tagesangabe | `render.ts` | T-M30-04 |
| Kein Provinz-Tooltip; Erklärungen nur als Panel | `MapCanvas.tsx` | T-M31-01 |
| Armeepanel: Stärke als Zahl (`Panels.tsx:451`), Haltung als Knöpfe ohne Gruppe, Einheiten als Icon-Zeilen | `Panels.tsx:442-533` | T-M31-02 |
| Fuß: `EventLog` allein (`App.tsx:1424`, `Panels.tsx:730`), Rangliste nur im Lage-Panel | `App.tsx`, `Standings.tsx` | T-M31-03 |
| Machtverlauf: eine Kurve je Macht ohne Legende/Fläche | `charts/LineChart.tsx` | T-M31-04 |
| `MOVE_ARMY` ohne Abmarschverzögerung (`commands/types.ts:44-48`; Reducer `commands/move.ts`) | Kern | T-M32-01 |
| Markt ohne Preisverlauf; `TRADE_EXECUTED` trägt `give/giveAmount/want/wantAmount` (`events/types.ts:220-227`) | `Panels.tsx:941` | T-M32-02 |

Weitere Fakten, die der Bau braucht:

- **Icons:** `ui/icons.tsx` hält 24-Einheiten-SVG-Pfade (`PATHS :66`, `UNIT_ICONS :180`,
  `BUILDING_ICONS :193`, `RESOURCE_ICONS :204`); die Karte zeichnet dieselben Pfade über
  `drawIcon()`/`Path2D` (`MapCanvas.tsx:42-56`). **Das Markerset baut darauf auf:** Rahmen
  neu, Glyphe aus den vorhandenen Pfaden — ein Strichbild, zwei Ausgaben.
- **Stückzahl:** nie gespeichert; `unitCount(stack, rules)` in
  `packages/core/src/state/army.ts:14` (`ceil(hpTotal / hpPerUnit)`). Zustand einer Armee
  = `Σ hpTotal / Σ (unitCount · hpPerUnit)`.
- **Provinzgeometrie:** `MapProvince.center` und `polygons` (mehrere Ringe!) in
  `packages/core/src/state/types.ts:69-92`; `coastal` ebenda. Die App hält `centres`
  (`App.tsx:493-496`).
- **Kartenmodi:** `map/modes.ts:11` (`political, resources, morale, strength, relations`),
  Taste **M** zykliert (`keyboard.ts:70-73`).
- **Gefechtsdarstellung:** Kampfringe `MapCanvas.tsx:399-415`, `battleIntensity`
  (`render.ts:303`). **T-M28-08** baut die spektakuläre Fassung — im Kriegsrat-Stil.
- **Schriften:** IBM Plex Sans/Condensed/Mono liegen gebündelt (`ui/fonts/`, 208 kB,
  OFL). Kriegsrat braucht **keine neue Schrift**.
- **Tempo-Rasten:** `SPEED_STOPS` (`Header.tsx:130-142`), Pausiert-Alarm `stalled` (`:124`).

---

## 2 · Anforderungen (bestehende R-IDs, nichts Neues)

R-UI-02 Lesbarkeit (Kontrast) · R-UI-03 Hauptansicht · R-UI-04 Original-naher Look mit
Einheiten- und Gebäudeicons · R-UI-05 Bedienung ohne Nachschlagen · R-UI-09 Größen als
Anzeige · R-UI-10 Symbole für Wiederkehrendes · R-UI-11 Erklärung am Ort · R-UI-12 Die
Karte trägt die Lage · R-UI-13 Stand der Partie ablesbar · R-UI-14 Aufmerksamkeit meldet
sich · R-UI-15 Bedienbar ohne Maus · R-UI-17 Oberfläche antwortet · R-MAP-05
Kartendarstellung · R-TIME-04 Zeitanzeige · R-ARCH-02 Befehlsbasierte Steuerung ·
R-ARCH-06 Performance.

Nicht in diesem Plan (Mechanik, nicht Oberfläche — Entscheid in T-M32-03): Durchmarschrecht,
Provinzhandel, Forschung.

---

## 3 · Entwurf D27 „Kriegsrat" (Kurzform; Bild in `docs/design/kriegsrat.html`)

### D27.1 Tokens (ersetzt Richtung A „Lagekarte" vom 2026-09-03, T-M10-01b, `docs/design/tokens.md`)

Token-Namen bleiben, damit kein Aufrufer sich ändert. Neue Namen nur, wo eine neue Rolle
entsteht. Werte sind im Entwurf nachgemessen; der Kontrasttest hat das letzte Wort.

| Token | Wert | Rolle im Kriegsrat |
|---|---|---|
| `ground` | `#0D1117` | Kartengrund, Meer |
| `paper` | `#161C25` | Panels, Leisten |
| `paperSunk` | `#1E2632` | vertiefte Flächen, Meter-Spuren, Bauplätze |
| `ink` | `#E6E1D3` | Text |
| `inkSoft` | `#9AA0A8` | Zweittext, Einheiten, Uhrzeit im Fuß |
| `line` | `#2F3944` | Rahmen, Panelrinnen; Provinzgrenzen mit `ink` bei 35 % Deckung |
| `water` | `#0A0E14` | Meer (eine Nuance unter `ground`) |
| `accent` | `#E2503A` | **Feind, Kampf, Alarm** — und nur das (wie bisher) |
| `good` | `#7EC57E` | **eigen**, Überschuss, fertig |
| `warn` | `#E0A220` | Bernstein: Zeit, Befehle, Auswahl, Bauschlange, Mangelfrist |
| `onDark` | `#F7F4EC` | Text auf Bernstein-Knöpfen ist **`#1A1200`** → neues Token `onWarn` |
| `onPlayer` | `#E6E1D3` | Text auf Provinzflächen (dunkle Füllungen) |
| `building` *(neu)* | `#C9B98A` | Gebäudemarker, Rohstoffsymbole in der Leiste |
| `ally` | `#6FA8DC` | in `RELATION_COLORS.ally`; `self` = `good`, `war` = `accent` |

`PLAYER_COLORS` (11, dunkle Flächen; Kandidaten, Wächter ΔE > 10 und `onPlayer` ≥ 4,5 : 1
entscheidet): `#2C4A3A #3A3A52 #4C3A2A #243C4C #3D2F3F #2F4A55 #4A3E22 #2E3550 #4A2E3A
#3F4630 #35434A`. Eigene Provinzen `#3C6E44`, Feind `#7A2E22` — das sind **keine**
Spielerfarben, sondern Beziehungs-Füllungen im Modus „Beziehungen" (`RELATION_COLORS`).

Schriften unverändert (`TYPE.map/ui/num`). Neue Regel: **Kopfzeilen der Panels in
Condensed, Versalien, 0,06 em, Bernstein.** Knöpfe: Bernstein-Fläche mit `onWarn`-Text für
die eine Hauptaktion je Panel, alle anderen `paperSunk` mit `line`-Rahmen.

### D27.2 Markerset (Quelle: `docs/design/kriegsrat-icons.svg`)

- **Einheit:** Rechteck 20×12 (Kartenraum, skaliert mit Zoom bis min. 24 px Trefferfläche),
  Rahmen 1,2 in Besitzerfarbe (`good` eigen, `accent` Feind, `ally` Bündnis, sonst
  `inkSoft`), Füllung `ground`. Glyphe je `UnitClass`: Infanterie ×, Panzer Ellipse,
  Artillerie Punkt, Luft Kreuz, Marine Anker — **aus `UNIT_ICONS`, im Rahmen zentriert**.
- **Stapel:** Rechteck 30×18 mit **Zahl** (Σ `unitCount`) in `TYPE.num` und einem
  3-px-Zustandsbalken am unteren Rand (Länge = Zustand). Bei einer Armee mit mehr als einer
  Klasse zeigt der Stapel die Zahl, der Rahmen die Farbe, die Glyphe die dominante Klasse
  (`dominantIcon`, `markers.ts:69`).
- **Gebäude:** Quadrat 14×14, Rahmen `building`, Glyphe aus `BUILDING_ICONS` (Kaserne,
  Festung, Fabrik, Werft, Flugfeld, Eisenbahn, Hafen). Stufe ≥ 2 als kleine Ziffer rechts
  oben. Sichtbar ab Zoomstufe „nah" (D27.4).
- **Rohstoffe** (Leiste): Ähre, Holzstoß, Berg, Brocken, Tropfen, Kristall, Münze — aus
  `RESOURCE_ICONS`, Farbe `building`, Geld `warn`.

### D27.3 Gebäude in der Provinzfläche (T-M30-02)

Ankerpunkte je Provinz, **deterministisch aus der Geometrie**, nicht aus dem Zustand:
Kandidaten auf einem Gitter über dem größten Ring von `polygons` (Schrittweite aus der
Fläche, mindestens 16 Einheiten Kartenraum), Punkt-in-Polygon, mindestens 12 Einheiten vom
Rand, sortiert nach Abstand zum `center` (nah zuerst), Mindestabstand 14 zwischen Ankern.
Gebäude belegen Anker in fester Reihenfolge (`BuildingKey`-Reihenfolge des Typs), damit ein
Bau die anderen nicht verschiebt. **Hafen und Werft** nehmen den Kandidaten mit dem
kleinsten Abstand zum Rand (Küste). Anker werden einmal je Karte berechnet und im
Render-Cache gehalten (`cacheKey`, `render.ts:159`).

### D27.4 Zoomstufen und Übersicht (T-M30-03)

Drei Schwellen auf `View.scale`: **weit** (< 0,5): Flächen, Grenzen, Hauptstädte, Stapel ·
**mittel** (0,5–1,0): + Gebäude, Marschpfeile mit Tagesangabe · **nah** (> 1,0): + Namen
(bestehendes `labelsFor`), Moralringe. Knöpfe `+`, `−`, `◎` (Hauptstadt zentrieren) oben
rechts auf der Karte, `aria-label`, Tastatur `+`/`−`/`Pos1`. Übersichtskarte unten rechts
(132×74 px): gecachte Flächenebene verkleinert, Ausschnitt als Bernstein-Rahmen, Klick
zentriert dort.

### D27.5 Marschwege (T-M30-04)

Gelaufener Teil: 3 px, Besitzerfarbe, rund. Rest: 1,6 px gestrichelt 3/3 mit Pfeilspitze.
Standpunkt: Kreis r 3,5 mit `ground`-Rand. Tagesangabe „3/5 T" in `TYPE.num` 7 px neben
dem Standpunkt (ab Stufe mittel). Nachschublinie unverändert.

### D27.6 Panels und Fuß (T-M29-03, T-M31-01…04)

Provinz: Kopfzeile Stern + Name, rechts Land · Art. Zeilen Gelände (mit Bonus), Moral
(Prozent + Tendenz + 10 Segmente), Erzeugt, Bauplätze; **Raster** 4 Spalten: gebaut
(Glyphe + Name), im Bau (Bernstein-Rahmen + Fortschrittsbalken aus
`startedTick/completesAtTick`), frei (gestrichelt „+ Bauen" = bestehende Bau-Aktion).
Armee: Einheitenzeile aus NATO-Markern mit Zahl, Kampfkraft mit Zustand-Prozent und Balken,
Haltung als Dreiergruppe `aria-pressed`, Befehle zweispaltig als Icon-Knöpfe, Hauptaktion
Bernstein, Quittung darunter (bestehend). Gefecht: wie T-M27-01, Ursache-Satz aus
`battleSentence`. Tooltip auf der Karte: Name · Land, Moral, Gelände, Verteidiger,
Gefechtsrunde, Bedienhinweis; folgt der Maus **und** der Tastaturauswahl. Fuß: links
Protokoll (Zeitspalte, Kategorie-Icon, Text), Mitte Rangliste (vier Zeilen, eigene in
Bernstein), rechts drei Knöpfe Depesche (Tagesbericht) · Diplomatie/Markt · Rangliste/Sieg
mit Neu-Marke.

---

## 4 · Aufgaben (Zwilling in `tasks.yaml` und `03-TASKS.md`; Reihenfolge = Baureihenfolge)

| ID | Titel | Kern? | Aufwand |
|---|---|---|---|
| **M29 — Kriegsrat: das Aussehen** | | | |
| T-M29-01 | Die dunkle Token-Ebene mit Spiegel-Wächter | nein | mittel |
| T-M29-02 | Kopf- und Ressourcenleiste im Kriegsrat-Stil | nein | klein |
| T-M29-03 | Das Provinzpanel bekommt das Bauplatz-Raster | nein | klein |
| **M30 — Kriegsrat: die Karte zeigt den Zustand** | | | |
| T-M30-01 | Armeen sind Stapel mit Zahl und Zustand | nein | mittel |
| T-M30-02 | Gebäude stehen verteilt in der Provinz | nein | mittel |
| T-M30-03 | Drei Zoomstufen, Knöpfe und Übersichtskarte | nein | mittel |
| T-M30-04 | Der Marschweg zeigt Stand und Rest | nein | klein |
| **M31 — Kriegsrat: Panels, Protokoll, Fuß** | | | |
| T-M31-01 | Die Provinz erklärt sich im Tooltip | nein | mittel |
| T-M31-02 | Das Armeepanel trägt Marker, Zustand und Haltungsgruppe | nein | klein |
| T-M31-03 | Der Fuß: Protokoll, Rangliste, drei Knöpfe | nein | mittel |
| T-M31-04 | Der Machtverlauf zeigt drei Linien mit Legende | nein | klein |
| **M32 — Kriegsrat: Lücken zu Supremacy (Freigabe durch Noah vor Bau)** | | | |
| T-M32-01 | Der Abmarsch lässt sich verzögern | **ja, additiv** | mittel |
| T-M32-02 | Der Markt zeigt den Preisverlauf | nein | klein |
| T-M32-03 | Entscheid zu Durchmarsch, Provinzhandel, Forschung | nein | klein |

**Einordnung der offenen M28-Aufgaben** (beide bleiben, beide bekommen T-M29-01 als
Abhängigkeit, damit sie im neuen Schema gebaut werden):

- **T-M28-06 Einmarsch-Alarm:** der Alarmchip oben rechts (`Header.tsx`) ist sein Platz;
  T-M29-02 legt den Chip an (leer, `hidden`), T-M28-06 füllt ihn. Karten-Hervorhebung
  der Provinz nutzt den `accent`-Ring aus D27.2.
- **T-M28-08 Kämpfe als Ereignis:** wird **nach T-M30-01** gebaut, im Kriegsrat-Stil:
  Explosionsmarker (`kriegsrat-icons.svg`, Bernstein mit hellem Kern) über dem Kampfring,
  Aufblitzen je Runde, Bench davor und danach.

**Definition of Done je Aufgabe:** Test zuerst, der ohne die Änderung fällt · `pnpm verify`
grün · für M30 zusätzlich `render.bench` vorher/nachher notiert (`docs/reports/render-bench.json`)
· `status: done` in `tasks.yaml` · Zeile in `PROGRESS.md` · Sichtprüfung gegen
`docs/design/kriegsrat.html` (gleicher Ausschnitt, kurz im Ergebnisbericht beschrieben).

**Abschlussprüfung des Umbaus (nach T-M31-04):** `pnpm acceptance` 11/11 · Kontrasttest
grün · `render.bench` p95 < 16,7 ms mit allen Markern auf der Weltkarte mit 8 Spielern ·
ein Lauf `apps/headless/test/ai-integration.slow.test.ts` unverändert grün (Kern unberührt).

---

## 5 · Abgleich mit Supremacy WW3 (Kurzfassung; Tabelle mit Quellen im Entwurf, Reiter 2)

| Element | Urteil | Was den Unterschied macht |
|---|---|---|
| Ressourcenleiste | besser | Tagesbilanz sichtbar statt im Tooltip; Reichweite in Tagen |
| Zeit und Tempo | besser | Pause, Vorspulen bis Ereignis, Befehlsquittung |
| Provinzpanel | gleich | nach T-M29-03: Raster mit Fortschritt |
| Armeebefehle | gleich | verzögerter Abmarsch fehlt → T-M32-01 |
| Einheiten auf der Karte | Lücke | Stapelzahl und Zustand → T-M30-01 |
| Gebäude auf der Karte | Lücke | Typ und Verteilung → T-M30-02 |
| Kartenmodi | besser | fünf Modi, Supremacy hat keine |
| Zoom und Übersicht | Lücke | Stufen, Knöpfe, Übersichtskarte → T-M30-03 |
| Tooltips | teilweise | Provinz-Tooltip → T-M31-01 |
| Gefecht | besser nach T-M28-08 | Ursache aus dem Ereignis, Explosionsmarker |
| Tagesbericht | gleich | Depesche im Fuß mit Neu-Marke → T-M31-03 |
| Diplomatie | teilweise | Durchmarsch, Provinzhandel: Entscheid T-M32-03 |
| Markt | teilweise | Preisverlauf → T-M32-02 |
| Rangliste, Alarme | gleich | dauerhaft im Fuß; Einmarsch-Alarm T-M28-06 |
| Forschung | Lücke | Mechanik, kein UI-Thema → T-M32-03 |
| Tastatur, Kontrast | besser | Supremacy ist Maus/Touch |

---

## 6 · Selbstkritik und Risiken (gegengeprüft am Code)

1. **Zeichenbudget (M30).** Heute 5,39 ms p95 für Flächen + 60 Pfeile. Stapel mit Text und
   bis zu ~1 700 Gebäudemarker (237 Provinzen × 7) sind neue Pfad- und Textaufrufe.
   Gegenmittel: Gebäude erst ab Stufe „mittel", Marker als vorgezeichnete Offscreen-Canvas
   je (Typ, Farbe) gestempelt statt je Frame als `Path2D` gefüllt; Bench vor und nach
   jeder M30-Aufgabe. Fällt p95 über 12 ms, wird die Stufe „mittel" auf > 0,7 angehoben,
   bevor irgendetwas anderes passiert.
2. **Spielerfarben.** 11 dunkle Flächen mit ΔE > 10 paarweise **und** 4,5 : 1 gegen
   `onPlayer` sind enger als hell. Die Kandidaten in D27.1 sind rechnerisch dunkel genug;
   scheitert ΔE, tauscht T-M29-01 einzelne Kandidaten (Ersatz: `#2A4A4A`, `#4A3A4A`,
   `#3A4A2A`) — die Zuordnung bleibt Hash, also ändert sich nur die Palette, kein Test der
   Zuordnung.
3. **Zwei Farbquellen.** `app.css` und `tokens.ts` driften, sobald jemand eine vergisst.
   Darum baut T-M29-01 den Wächter **zuerst** (`test/guards/css-mirrors-tokens.test.ts`:
   jeder Hex in `app.css :root` kommt in `tokens.ts` vor, und umgekehrt jeder Token in
   `app.css`).
4. **Zoom (T-M30-03) ist der einzige Eingriff in die Bedienung.** Fällt er, bleibt der
   Rest stimmig; die Übersichtskarte ist der erste Teil, der wegfällt, nicht die Schwellen.
5. **M32 berührt den Kern.** `departInTicks` als optionales Feld ändert alte Kommandologs
   nicht (Golden-Master), aber die Bewegungsphase muss den Abmarsch aufschieben, ohne die
   halbe Kampfkraft beim Abmarsch (`moveHint`) vorzuziehen. Darum Freigabe vor Bau und ein
   Lauf über eine ganze Partie, nicht nur der Einzeltest.
6. **Der Entwurf zeigt Dinge, die es als Ereignis nicht gibt**: „Moral fällt" (Tendenz aus
   `morale` vs. `targetMorale`, `types.ts:148-150` — gibt es doch), „Ankunft in 2 Tagen"
   im Protokoll (aus `arrivalTick`, gibt es), „Festung −30 %" (aus `fortressLevel`, Prozent
   aus den Regeln). Alles Darstellung. Nichts davon rechtfertigt einen Kerneingriff.
7. **Was der Plan bewusst nicht tut:** keine neue Schrift, keine Fremdbibliothek, kein
   Umbau der Seitenleiste auf Glas/Overlay (das war Richtung C), kein Wechsel von Canvas
   zu SVG. Der Kartenrenderer bleibt Canvas 2D mit zwei Ebenen.

---

## 7 · Entscheidungen, die dieser Plan trifft (Eintrag in DECISIONS.md)

- Richtung A „Kriegsrat" **ersetzt** Richtung A „Lagekarte" vom 2026-09-03. Tokens
  behalten Namen und Rollen; `accent` bleibt exklusiv Kampf/Alarm/Feind, `warn` wird
  zur Handlungsfarbe (Zeit, Befehle, Auswahl), `good` zur Eigen-Farbe.
- Marker im NATO-Stil sind der einzige Symbolstil auf der Karte — für Einheiten, Stapel
  und Gebäude. Kein zweiter Stil daneben.
- Gebäude stehen in der Provinzfläche an geometrisch abgeleiteten Ankern, nicht am
  Mittelpunkt und nicht in Reihen.
- Durchmarschrecht, Provinzhandel, Forschung sind keine UI-Lücken, sondern
  Mechanikfragen und werden in T-M32-03 entschieden, nicht gebaut.
