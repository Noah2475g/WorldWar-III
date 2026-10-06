# Seitenleiste v3b — Bericht

## Basis (B0)

Messung am Stand `185b849` (origin/main, Zweig claude/seitenleiste-e1, ff-only, unverändert). Port 5361, Edge/Playwright, S300/S575G.
Beleg Worktree: `served.txt` (Dev-Server liefert `…/seitenleiste-e1/apps/desktop/src/App.tsx`).

- **M49 (PR #27, Sammelmarke) auf main?** Nein. `git log origin/main --oneline | grep -i sammelmarke` = leer (PR #27 offen).
  Auflage A1: Wird M49 nach B0 gemergt, wiederholt E1 vor dem Vergleich `gebaeude.slow.test.ts` (Ausgabe `b0/gebaeude-basis-m49.json`, über `WW_GEBAEUDE_OUT`) und `ux-tasks` (`b0/aufgaben-basis-m49.json`). Diese Werte sind dann die Schwelle für K4 und K16.
- **Offene PRs (D18 Hotspots):** #27 `claude/sammelmarke` (App.tsx, MapCanvas.tsx, markers.ts, …; Hotspot für E1/E7), #28 `claude/fix-zerstoerer` (nur `data/rules/default/units.json`, kein Hotspot).
- **Last beim Messen (05:50, Noah hatte das Spiel zuvor beendet; vorher GPU ~95 %, 20 min gewartet):** CPU 2–19 %, GPU 3–11 %, RAM frei 18 GB, kein UnrealEditor/UnrealGame/R6Arena, kein fremder vitest-/ux-Lauf, keine eigenen Altinstanzen (vite 5361, msedge).
  Während des Capture-Laufs: CPU bis 41 % (eigener Lauf).
- Zählregeln, Schwellen (`ux-thresholds.mjs`), Szenenfolge unverändert (D16). Diff nur neue Sonden.

### Sonden (neue Felder)

| Sonde | Ort | Selektor / Regel |
|---|---|---|
| K3 `visible.slots` | ux-layout, Szene `panel` | `aside.side .slots[data-group="build"]`, Felder `.slot`; sichtbar = ganz im Fenster UND `elementFromPoint` der Mitte von erstem/letztem Feld liegt im Element |
| K3 `visible.recruit` | ux-layout, Szene `panel` | `aside.side section.group[data-group="recruit"]` (Panels.tsx `ActionGroup`, Z. 418; Aushebe-Knöpfe = `button` darin, 20 Stück); gleiche Regel |
| K7 `freeMap` | ux-layout, `ohnePanel` + `panel` | 8-px-Raster über `canvas.map-layer--overlay`; Anteil Punkte mit `elementFromPoint === Canvas` |
| K19 `meldungsorte` | ux-capture, in `layout()` je Szene/Fenster + MP | Orte `[data-sonner-toast]:not([data-visible="false"])`, `.alerts`, `.alarm-chip`, `section.dock`; `[data-msg]`, sonst normalisierter Text (Info); `doppelt` = Schlüssel an ≥ 2 Orten |
| M1 Gebäude | `apps/desktop/src/map/gebaeude.slow.test.ts` | Rechenweg Plan §6 K16 |

### Tabelle K1–K18 (B0-Wert, 1280x800 wenn nicht anders)

| K | B0-Wert | Rolle |
|---|---|---|
| K1 Leiste unten | Info: `.side` scrollH/clientH Panel 1114/550 (2,03); Ausheben-Raster nicht im Fenster (inView=false) | Info |
| K2 Seitenleiste | Info: Diplomatie scrollH/clientH 1563/550 = 2,84 (1920: 1563/830 = 1,88); „Krieg erklären“ unter dem Falz bei 1280 (belowFold 1), bei 1920 sichtbar | Info |
| K3 Sonden | 1280: slots sichtbar = **true**, recruit sichtbar = **false** (inView false). 1920: slots true, recruit false (letztes Feld nicht getroffen). 375: beide false | Info |
| K4 Klickwege | siehe Tabelle Klickwege | **Schwelle** |
| K5 Tab-Stationen | **38** (ohne stehenden Toast; am Basisstand gibt es keinen Toast → Wert = Schwelle); davon 15 in Protokoll+Fuß, Provinzliste ab Station 19 | **Schwelle** |
| K6 Telefon mapShare | `ohnePanel` **0,450**; `panel` (Provinz-Blatt) **0,269** (R-UX-01/AK1 rot: 29 %/27 % < 30 %) | **Schwelle** |
| K7 Karte | Karte 900 × 550 (Basis, alte Fläche, nicht vergleichbar). freeMap 1280: ohne Panel **0,977**, Provinz **0,977** (Info; Seitenleiste liegt neben der Karte, nicht darüber). 375: 0,853 / 0,747. 1920: 0,991 | Info |
| K8 Kopf | **82 px** (1280, 1366, 1920; running 74–78, mp 76), Telefon 375: 154 px (ohne Panel/Provinz 138). R-UX-02/AK1 rot (> 70) | **Schwelle** (Telefon ≤ B0: 154) |
| K9 Textanteil | max **0,498** (S575G 375x667 Kopf „armee“); S300 max 0,488; 1280 max 0,473. Alle ≤ 0,5 | **Schwelle** |
| K10 axe | **0 Verstöße** in allen 49 Zuständen (R-UX-06/AK1 grün). `incomplete`: aria-prohibited-attr, color-contrast (Info) | **Schwelle** 0 |
| K11 Tastatur | — | nicht gemessen (Testkarte) |
| K12 Tutorial | — | nicht gemessen (Testkarte) |
| K13 MP-Szene | läuft (mp 375x667 + 1280x800 je 7 Bilder, 0 Fehlschritte). Alarmchip im Lauf **nie sichtbar** (0 s Wartezeit, `--mp-alarm-wait` Standard 0) → Zustand mit Chip nicht belegt | **Schwelle** (Lauf ok; Chip nicht belegt) |
| K14 verify | verify-b0.log EXIT=0 (siehe unten) | — |
| K15 Bilder | `S575G-basis-*.png` in `b0/` (375, 1280, 1920) | Info |
| K16 Gebäude | Region (1,6): gezeichnet **296**, paareGebaeude25 **72**, prognoseRuecktritt **122** (41 % von 296, < 50 % → keine Frühwarnung E7). Welt (2,5): gezeichnet **0** (far, erwartet). Viewer p6 | **Schwelle** |
| K17 Touch quer | Info: ohne Panel 51 Ziele, min 44, 1 Überlapp (Übersichtskarte × „Was ist Besitz?“ 66×12); mit Provinz-Panel 90 Ziele, min 44, **32 Überlappungen** (z. B. „Kaserne bauen“ × „Was ist Kaserne?“ 10×44) | Info |
| K18 Bewegung | Diff-Regel, keine B0-Zahl | — |
| K19 Meldungsorte | Info: je Szene 0–1 Eintrag an einem Ort (Toast 0, `.alerts` 0–1, Chip 0–1 in battle/saves, Dock 0); `doppelt` = 0 in allen Szenen; kein `data-msg` am Basisstand → Schlüssel = Text | Info |
| K5 (Zusatz C) | Stationen ohne stehende Meldung = **38** (= Schwelle) | **Schwelle** |

Frühere rote ux:check-Kriterien am Basisstand (nicht repariert): R-UX-01/AK1 (Provinzpanel 29 %, Armeepanel 27 % < 30 %), R-UX-01/AK2 (667x375 armyPanel/battle/saves; 1280/1366/1920 battle: side 389>379), R-UX-01/AK3 (375x667 Fehlschritte `meldungen`, `menue`; 667x375/1366x768 schlechter als vorher), R-UX-02/AK1 (Kopf 82 > 70; mp 76), R-UX-06/AK3 (Telefon-Kopf 9 Ziele < 44 px). Gesamt: 12 grün, 5 rot, 2 offen (von 19), Exit 1 (erwartet).

### Klickwege je Aufgabe (S300, 1280x800, `aufgaben-basis.json`)

| Aufgabe | Maus Klicks | Tastatur Tasten | Fehlwege | Bildläufe |
|---|---|---|---|---|
| armee-bewegen | 5 | 8 (3 Tab) | 0 | 0 |
| armee-teilen-zusammenlegen | 3 | 6 (2 Tab) | 0 | 0 |
| bauen | 2 | 4 | 0 | 0 |
| ausheben | 2 | 5 | 0 | 0 |
| krieg-erklaeren | 4 | 6 (2 Tab) | 0 | 0 |
| frieden-anbieten | 3 | 2 | 0 | 0 |
| handel-anbieten | 5 Klicks + 5 Tasten | 16 (8 Tab) | 0 | 0 |
| spion-anwerben | 4 | 11 | Maus 1 („Spionage-Übersicht ist leer“), Tastatur 0 | 0 |

Tab-Stationen (K5): 38 gesamt; Provinzliste als Nummer 19; davon 15 in Protokoll und Fuß.

### Weitere Messwerte

- ux-bild Textanteil: siehe `ubild-basis.json` (max 0,498).
- Kopf 82 px / Telefon-mapShare 0,269 brechen R-UX-01/02 am Basisstand (bekannt, PR #21) – als B0-Wert festgehalten.
- Rohdaten: `b0/layout-basis.json`, `b0/aufgaben-basis.json`, `b0/ubild-basis.json`, `b0/touch-basis.json`, `b0/gebaeude-basis.json`, `b0/capture-basis.json` (Auszug aus `ux-capture` messwerte: Kopf-/Kartenmaße, Tab-Reihenfolge, axe, `meldungsorte`).
- Hinweis: ein Hintergrundstart von `ux-capture` meldete im Log nur „stdin is not a tty“ (Shell der Umgebung); der Lauf im Vordergrund war vollständig (Log im Ticket-Workspace `capture-basis.log`).
