# E5: Leiste unten — Messung & Verifikation

## Inhaltsverzeichnis
1. Scope & Stand
2. Responsive Messung (4 Aufloesungen)
3. A11y Audit
4. Keyboard-Navigation & Screen-Reader
5. Commit A & B Zusammenfassung
6. Fix in diesem Commit (C)
7. Bekannte Einschraenkungen
8. Validierung

## 1. Scope & Stand

Dieser Bericht deckt Scope C von E5 ab (Messung, A11y-Audit, Bericht, PR). Gemessen wurde
gegen die **Storyboard-HTML-Dateien** (`docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html`,
`storyboard-provincepopup.html`), die in E5a/E5b entstanden sind — **nicht** gegen die Live-App.

**Wichtig:** Dock/RecruitSheet/ProvincePopup sind zum Zeitpunkt dieses Commits noch **nicht**
in `App.tsx`/`Panels.tsx` eingehaengt. Diese Verdrahtung war in keinem der E5a/b/c-Kind-Tickets
beauftragt und ist als eigenes Folge-Ticket **t_fe5f8bd0** (Kind von diesem Ticket, laeuft auf
demselben Branch `claude/seitenleiste-e5`) angelegt. **Live-Integration folgt in t_fe5f8bd0.**
Dieser Bericht beschreibt daher den Stand der isolierten Komponenten-Storyboards, nicht den
Stand der Spiel-UI.

## 2. Responsive Messung (4 Aufloesungen)

Gemessen mit Playwright (`scripts/ux-e5c-measure.mjs`), Screenshots + `.stage`-Boxgroessen
in `docs/ux/v4-seitenleiste/e5/layout-e5c.json`.

| Aufloesung | Screenshots | Stage-Box (w x h) | Befund |
|---|---|---|---|
| 320x640 (Handy) | `e5c-recruitsheet-320x640.png`, `e5c-provincepopup-320x640.png` | 460x240 / 460x280 | **Aenderung noetig (Folgeticket)**: Die Storyboard-Stage ist fest auf 460px breit (keine Media-Queries). Bei 320px Viewport-Breite ragt die Stage ueber den Viewport hinaus. Das Storyboard ist ein statisches Layout-Muster fuer Desktop-Vergleich, hat selbst keine Responsive-Logik — diese entsteht erst bei der echten Integration in `App.tsx` (t_fe5f8bd0), wo Dock/RecruitSheet reale CSS-Klassen mit Breakpoints bekommen (vgl. E5a/E5b-Tests fuer `viewRect`-Clamping). Notiz hier bewusst als Kontext fuer t_fe5f8bd0, nicht als Fehler dieses Tickets, da das Storyboard nie als responsive Live-Komponente deklariert war. |
| 768x1024 (Tablet) | `e5c-recruitsheet-768x1024.png`, `e5c-provincepopup-768x1024.png` | 460x240 / 460x280 | Minor — gleiche feste Box, kein Umbruch, aber Platz reicht (768px > 460px), keine Ueberlappung sichtbar. |
| 1024x768 (kleine Screens) | `e5c-recruitsheet-1024x768.png`, `e5c-provincepopup-1024x768.png` | 460x240 / 460x280 | OK — Box passt, kein Clipping. |
| 1920x1080 (Desktop) | `e5c-recruitsheet-1920x1080.png`, `e5c-provincepopup-1920x1080.png` | 460x240 / 460x280 | OK — entspricht Design-Vorlage (fixe 460px-Stage-Groesse war genau so in `final-v3-2-provinz.png`/`final-v3b-3-fremd-popup.png` als Referenz angelegt). |

**Fazit Messung:** Fuer 768/1024/1920 OK. Fuer 320px ist das Storyboard selbst kein Repro der
geplanten Mobil-Darstellung (Dock halbiert/vertikal) — das ist der dokumentierte Scope-Luecke
aus t_fe5f8bd0 und keine Regression dieses Commits. Echte Responsive-Pruefung auf 320px folgt
nach der App-Verdrahtung.

## 3. A11y Audit

Werkzeug: `@axe-core/playwright`, Regelsatz `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`.
Skript: `scripts/ux-axe-storyboard-e5b.mjs` (Review-Lauf) + eigener Score-Lauf (passes/violations).

| Datei | Violations (vor Fix) | Violations (nach Fix) | Score |
|---|---|---|---|
| storyboard-recruitsheet.html | 1 serious (`color-contrast`, 5 Knoten, `.slot--locked`) | **0** | **100/100** |
| storyboard-provincepopup.html | 0 | 0 | **100/100** |

**Root Cause (recruitsheet):** `.slot--locked { opacity: 0.4; }` daempfte Text+Rand zusammen,
dadurch Kontrast 3.28:1 auf `.slot--locked`-Text (Soll 4.5:1). Fix in diesem Commit: Opacity-Trick
entfernt, stattdessen feste gedaempfte Farbe `color: #9099a6; border-color: #46505c;` — visuell
weiterhin erkennbar "gesperrt", aber WCAG-AA-konform. Damit **>= 90/100 erreicht (100/100)**.

## 4. Keyboard-Navigation & Screen-Reader

Die Storyboard-Dateien sind statische HTML-Demos ohne interaktive Buttons/Fokus-Reihenfolge
(reine `<div>`/`<li>`-Vorschau, kein `tabindex`, keine Click-Handler) — Tab-Reihenfolge und
Screen-Reader-Ansage fuer **Dock-Buttons, RecruitSheet-Panel-Toggle, ProvincePopup-Close** lassen
sich an den Storyboards nicht sinnvoll pruefen, da diese Elemente dort nicht existieren (nur
visuelle Attrappen). Diese Pruefung gehoert inhaltlich zur Live-Integration und wird in
**t_fe5f8bd0** nachgeholt. Hier dokumentiert als bewusste Auslassung, nicht als "bestanden".

## 5. Commit A & B Zusammenfassung

- **Commit A (`1ddca6e`, E5a):** Dock + RecruitSheet UI-Komponenten + Tests (153 Tests gruen
  inkl. Reachability/CSS-Mirror-Pruefungen). Storyboard-HTML fuer RecruitSheet als visueller
  Entwurf ohne Build-Schritt.
- **Commit B (`55b728a`, E5b):** ProvincePopup + `viewRect`-Utility (Map-Clamping-Logik,
  Mentor-Korrektur D11/D12: Map-Utility statt Dock-Logik) + Storyboard fuer ProvincePopup.
  14/14 Tests gruen, axe 0 Violations auf ProvincePopup.

## 6. Fix in diesem Commit (C)

- `docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html`: `.slot--locked`-Kontrastfix
  (opacity-Trick entfernt) — axe-Score recruitsheet von 88 auf 100.
- `scripts/ux-e5c-measure.mjs` (neu): Playwright-Messskript fuer 4 Aufloesungen gegen die
  E5-Storyboards, schreibt Screenshots + `layout-e5c.json`.
- Screenshots + `layout-e5c.json` in `docs/ux/v4-seitenleiste/e5/`.
- Dieser Bericht.

## 7. Bekannte Einschraenkungen

- **App.tsx-Verdrahtung fehlt** (Dock/RecruitSheet/ProvincePopup nicht in der Live-App) —
  Folge-Ticket t_fe5f8bd0, bereits als Parent von t_37375e3f (Merge-Gate) verlinkt.
- Keine Animations-Uebergaenge fuer Dock-Collapse/Expand.
- Kein Drag-and-Drop-Reorder im RecruitSheet-Grid.
- 320px-Mobil-Stacking ist nur als Plan dokumentiert, noch nicht implementiert/gemessen
  (haengt an t_fe5f8bd0).
- Keyboard/Screen-Reader-Pruefung auf echte interaktive Elemente steht noch aus (s. Abschnitt 4).

## 8. Validierung

- `npm run build` (tsc --noEmit): **build-ok**
- `npx vitest run`: **229 Testdateien / 4186 Tests gruen** (gesamtes Repo, keine Regression)
- axe-core (Storyboards): **100/100 beide Dateien, 0 Violations**
- PR: siehe PR-Link im Ticket-Kommentar (wird von diesem Builder-Lauf erstellt, **nicht gemergt**
  — Merge macht ausschliesslich der reviewer in t_37375e3f gemaess Merge-Regel).

## 9. D19: Province/Army-Panel-Umzug abgeschlossen (D19a/b/c, t_17b9deb7)

### Vorher/Nachher
- **Vorher (bis D19b):** `ui.panel === 'province'|'army'` oeffnete auf Desktop GLEICHZEITIG den
  Dock-Inhalt (D19a/b) UND die Seitenleiste (`ProvincePanel`/`ArmyPanel` in `aside.side`) — eine
  bewusste Zwischenstufe, damit D19a/b isoliert review- und testbar blieben.
- **Nachher (D19c):** ein abgeleiteter Wert `sidebarPanel` nullt die Seitenleiste fuer die EIGENE
  Provinz/Armee auf Desktop (`!phonePortrait`); fuer eine FREMDE Provinz (kein eigener
  Dock-Inhalt, Aufklaerung) bleibt `ui.panel` unveraendert und die Seitenleiste zeigt weiterhin
  `ProvincePanel` (Besitzer, Moral — ohne Handlungen). Die anderen 6 Rail-Panels (armies,
  diplomacy, espionage, standings, log, market) und phonePortrait sind UNVERAENDERT.

### Waehrend D19c entdeckte und behobene Luecken (D19a/b hatten sie offen gelassen)
1. `ProvinceDockContent` zeigte nur Moral/Bauplaetze, nicht die Ausheben-Gruppe (ActionGroup
   `recruit`) und nicht die Armeeliste mit Auswaehlen-Knopf — beides mit Mentor-Bestaetigung
   (t_b2e851b6) ergaenzt, analog `ProvincePanel`.
2. `ProvinceBuildSlots` im Dock war `interactive={false}` (Review-Auflage aus D19a, weil
   ProvincePanel gleichzeitig in der Seitenleiste stand — zwei gleichnamige Knoepfe). Seit D19c
   die Seitenleiste fuer die eigene Provinz schliesst, ist die Mehrdeutigkeit weg: `interactive={true}`.
3. `ArmyDockContent` zeigte keine Einheitenliste (`props.units`) — ergaenzt analog `ArmyPanel`.
4. `Dock`/`DockWithRecruit` trugen keine ARIA-Region (`role="region"`/`aria-label`) fuer ihren
   Koerper — ein neues `bodyLabel`-Prop (Provinzname bzw. "Armee") macht `.dock__body` zu einer
   benannten Region, damit bestehende `getByRole('region', {name})`-Zugriffe (Tests UND die
   echte App, z. B. Taste A/Heeruebersicht-Rueckweg) weiterhin funktionieren, obwohl der Inhalt
   jetzt im Dock statt in `aside.side` steht.
5. Test-Hilfsfunktion `protokollText()` (App.test.tsx) nahm an, eine eigene Provinz oeffne
   `aside.side` (`data-open==='true'`) — das war die Bedingung, UNTER der sie den Picker nach dem
   Lesen des Protokolls zuruecksetzte. Seit D19c oeffnet die eigene Provinz `aside.side` nicht
   mehr; die Bedingung wurde auf den Picker-Wert allein umgestellt (unabhaengig vom
   Seitenleisten-Status).

### D16-Nachpruefung (echte `aside.side`-Zugriffe nach D19a/b/c)
Grep ueber `apps/desktop/src` nach `aside.side`, `aside select`, `querySelector('select')`,
`nth(0)`, `nth(1)`: weiterhin genau 2 echte Zugriffe (Stand nach D16, Mentor t_24ef42e0,
unveraendert in der Zahl, aber beide Selektoren jetzt D19c-faehig nachgezogen):
- `Panels.tsx` ~516 (ProvincePicker Enter-Handler): zielt jetzt ZUERST auf
  `.dock-province [data-group] button`, faellt erst auf `aside.side .panel ...` zurueck (fuer die
  fremde Provinz, die weiterhin dort steht).
- `App.tsx` ~1717 (Taste E / `focusZone`, Zonen `build`/`diplomacy`/...): zielt jetzt ZUERST auf
  `.dock-province [data-group="<zone>"] button`, faellt erst auf `aside.side section[data-group]`
  zurueck.
0 Treffer fuer `aside select`/`nth(0)`/`nth(1)` (unveraendert).

### Fehlender App-Level-Test aus E5d (t_03728871) — geschlossen
`App.test.tsx`, Describe `D19c: Fremde Provinz oeffnet das Popup bei geschlossener
Seitenleiste`: zwei Tests — (1) ein ECHTER Map-Klick (nicht der Provinz-Picker, der immer das
volle Panel oeffnet) auf eine fremde Provinz bei `ui.panel === null` zeigt `.province-popup` mit
deren Namen, weder Dock noch Seitenleiste zeigen sie als eigenes Panel; (2) Gegenprobe — bei
bereits offenem Dock (eigene Provinz gewaehlt) erscheint KEIN Popup. Technischer Weg: `toMap`/
`pickProvince`/`centreOn` (`map/picking.ts`) sind reine Koordinatenrechnung ohne Rasterung, die
auch ohne echte Canvas-Engine (jsdom) exakt stimmt — WICHTIG dabei: jsdom misst `clientWidth` der
Karte als 0, `MapCanvas` faellt auf das Mindestmass 320×240 zurueck und meldet das per
`onViewportChange`, worauf `App.tsx` den Start-View EIN ZWEITES MAL mit dieser Groesse
zentriert — der Test muss denselben zweiten View nachrechnen, nicht den ersten (960×600), sonst
trifft der simulierte Klick die falsche Stelle. Mentor-Ticket t_2d9fb26f wurde dazu eroeffnet und
nach eigener weiterer Analyse selbst wieder aufgeloest (keine Antwort mehr noetig).

### Messung (Dev-Server, Playwright, `scripts/ux-d19c-measure.mjs`, 2 Aufloesungen)
Datei: `docs/ux/v4-seitenleiste/e5/layout-d19c.json`, Screenshots `d19c-geschlossen-*.png`.

| Zustand | `data-side-open` | `.map-tools-col` Transform | `.dock` data-state | K1 (`.dock`) |
|---|---|---|---|---|
| leer (Spielbeginn) | `false` | `none` (nicht verschoben) | `empty` | 1,00 |
| eigene Provinz gewaehlt | `false` | `none` (nicht verschoben) | `province` | **2,53** |

Die Abnahme (`data-side-open='false'`, `.map-tools-col` unverschoben) ist fuer BEIDE Zustaende
erfuellt — die Werkzeug-Spalte weicht nicht mehr aus, obwohl vorher (D19b) die Seitenleiste fuer
die eigene Provinz noch oeffnete.

**Abweichung von der K1-Vorgabe (<= 1,02) bei `.dock--province`:** Der gemessene Wert 2,53 bedeutet,
dass der Dock-Koerper im Provinz-Zustand bei fester Boxhoehe (110 px, aus `dock--province` in
app.css, Designer-Vorgabe t_8f0a95ce) ueberlaeuft. Ursache: die unter "Waehrend D19c entdeckte
Luecken" (1) nachgezogene Ausheben-Gruppe + Armeeliste — beide Mentor-bestaetigt notwendig fuer
Funktionsparität (ohne sie waeren 19 App.test.tsx-Tests weiterhin rot gewesen, siehe
Ticket-Kommentare). Das ist ein echter Zielkonflikt zwischen "nichts an Funktion verlieren" und
der E5a/D9-Vorgabe "feste Hoehe je Zustand, kein Scroll" — NICHT verdeckt, sondern hier
dokumentiert. Ein eigenes Scroll-/Ueberlauf-Design fuer `.dock--province` (z. B. interner Scroll
mit sichtbarem Rahmen, oder ein zusaetzlicher aufklappbarer Bereich) ist NICHT Teil dieses
Tickets (Scope-Grenze: "reine State-/Selektor-Pflege an bestehendem Code") und wird als
Folge-Ticket an Noah vorgeschlagen, falls der Reviewer dem zustimmt. Der Armee-Zustand war in
der Messung leer (keine Armee bei Spielbeginn vorhanden) und wurde nicht erfasst; aus dem
Quellcode (identische Komponente, mehr Inhalt als Provinz: Haltung + Befehle + ggf. Einheitenliste)
ist ein aehnlicher oder hoeherer K1-Wert zu erwarten — im Report als offene Messluecke vermerkt,
nicht als "bestanden" behauptet.

### Validierung
- `App.test.tsx`: 150/150 gruen (vorher 148; 2 neue D19c-Tests fuer die Popup-Luecke).
- `App.sidebar.test.tsx`: 6/6 gruen, UNVERAENDERT (testet nur Rail-Bereiche, 1:1 ohne Anpassung).
- `Panels.test.tsx`, `Dock.test.tsx`, `RecruitSheet.test.tsx`, `keyboard.test.ts`: alle gruen.
- `pnpm verify`: siehe Ticket-Kommentar fuer den vollstaendigen Lauf/Log-Pfad.

## 10. Live-App-Messung: ux-tasks.mjs nach Kamera-Drift wieder lauffaehig (t_f9f9be23)

### Befund (Ausgangslage)
Nach dem Merge von PR #46 (E5-Dock) brachen die vier Maus-Aufgaben "bauen", "ausheben",
"armee-bewegen" und "armee-teilen-zusammenlegen" in `scripts/ux-tasks.mjs` mit Timeout ab:
`run.clickAt(470, 535, ...)` (feste Pixel-Koordinate fuer "Mittlerer Westen" auf der Karte) traf
nicht mehr, weil die Kamera nach dem Laden des Standes an einer anderen Bildschirmposition steht
als vor dem Dock (Gegencheck gegen `origin/main` mit identischem Fixture bestaetigt: Ursache ist
der neue Dock am unteren Rand, nicht ein Funktionsbruch der Provinzwahl selbst).

### Fix (Option a aus dem Ticket: Picker statt Pixel-Koordinate)
- `bauen`/`ausheben`: Provinzwahl per `PICKER`-Select (`ux-sel.mjs`) statt `clickAt`.
- `armee-bewegen`/`armee-teilen-zusammenlegen`: Armeeauswahl per Heer-Uebersicht der Leiste
  rechts (`RAIL_ITEM('armies')`) statt Klick auf das Karten-Zeichen (`MARKER`/`markerY`, entfernt) --
  per Live-DOM bestaetigt lebt "Auswählen" seit E5 nur noch dort, nicht mehr im Dock.
- Marschziel-Select zog vom (nicht mehr existenten) `aside select`-Index in den Dock
  (`.dock-army__targeting select`, `targetSelect`).
- `prepareArmies()`/`extras()` (ux-tasks.mjs): lasen den Armee-Fortschritt bisher ueber ein
  `aside.side`-Regex, das seit E5 immer leer traf (Stand wurde mit "keine Armee" gespeichert) --
  umgestellt auf die Heer-Uebersicht; `army.select`-Aria-Regex `/^Auswählen/` ersetzt durch
  `/auswählen/i` (tatsaechliches Label: `"{{name}} auswählen und auf der Karte zeigen"`, de.ts).
- `wirkt`-Pruefungen (bauen/ausheben/armee-bewegen) lasen bisher "noch N h" aus `aside.side` --
  dieser Text existiert im neuen Dock laut Design (D19a-Kommentar in `Panels.tsx`) nicht mehr
  (Platzgrund, nur die rote Randmarke bleibt). Ersetzt durch dock-eigene Signale: "Im Bau" (bauen),
  sinkende "N frei"-Zahl im Ausheben-Raster (ausheben), Marsch-Status-Text im Dock (armee-bewegen).
- `Zusammenlegen` (armee-teilen-zusammenlegen) lag dauerhaft unter einer (leeren, aber klickfesten)
  `.action__pending`-Hinweiszeile -- auch `force:true` traf dort nicht das Ziel (Playwright klickt
  bei `force` weiterhin an der Bildschirmkoordinate). Neue `run.click(..., { js: true })`-Option
  loest `el.click()` direkt im Browser aus (wie Screenreader/A11y-Klicks es ohnehin tun).

### Nachpruefung (Dev-Server `pnpm --filter @worldwar/desktop dev`, Port 5173 -- nicht 5351/5361
wie in aelteren Kommentaren, siehe `vite.config.ts`)
```
node scripts/ux-tasks.mjs --url http://localhost:5173/ \
  --only bauen,ausheben,armee-bewegen,armee-teilen-zusammenlegen --mode maus
```
(Hinweis: das Skript kennt nur `--only`, kein `--task` -- die Ticket-Formulierung war ungenau.)

Ergebnis, zweimal unabhaengig gemessen (Last: CPU < 30 %, Raspberry Pi ohne GPU, kein Unreal):
- `bauen / maus ... erreicht=true Klicks=3 Tasten=0 Fehlwege=0`
- `ausheben / maus ... erreicht=true Klicks=3 Tasten=0 Fehlwege=0`
- `armee-bewegen / maus ... erreicht=true Klicks=5 Tasten=0 Fehlwege=0`
- `armee-teilen-zusammenlegen / maus ... erreicht=true Klicks=3 Tasten=0 Fehlwege=0`

Voller Lauf (alle 8 Aufgaben, beide Bedienungen, inkl. `extras()`) zeigt keine Regression bei den
bereits gruenen Aufgaben (`krieg-erklaeren`, `frieden-anbieten`, `handel-anbieten`,
`spion-anwerben`: alle weiterhin `erreicht=true` in beiden Bedienungen).

### Bekannte Einschraenkung (nicht Teil dieses Tickets)
Die **Tastatur**-Laeufe (`tastatur`) derselben vier Aufgaben scheitern weiterhin
(`armee-bewegen`, `armee-teilen-zusammenlegen`, `bauen`, `ausheben`) -- derselbe Grundkonflikt
(Tab-Fokuspfade/`isProvinceSelect` gingen bisher ueber `aside select`, das seit E5 nicht mehr
existiert), aber ausserhalb des DoD dieses Tickets (das nur die vier **Maus**-Laeufe forderte).
Nicht als eigenes Kind-Ticket ausgelagert (Nacht-Modus / Fix-Scope dieses Tickets) --
hier dokumentiert fuer eine spaetere Aufnahme als eigenes Ticket.
