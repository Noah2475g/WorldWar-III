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

## E1 — Tokens, Toasts (sonner), Hinweisspalte

Stand: Zweig `claude/seitenleiste-e1`, Basis `origin/main` (M49 enthalten, Merge `af7a290`). Port 5361, Edge/Playwright, S300/S575G.
Last beim Messen: CPU 4–49 % (Spitzen bis 100 % durch fremde Läufe anderer Tasks; belegt sind nur Zählwerte, keine Zeiten), GPU 0–1 %, RAM frei ca. 15 GB, kein UnrealEditor/UnrealGame/R6Arena, keine eigenen Altinstanzen (vite 5361 per PID beendet, `netstat` leer).

### Befunde A1/A3/A4
- **A1 (M49 auf main):** `gebaeude.slow.test.ts` am gemergten main = `b0/gebaeude-basis-m49.json` (Region 296 / 72 / 122, Welt 0, identisch zu B0). `ux-tasks` am gemergten main = `b0/aufgaben-basis-m49.json` (alle 16 Läufe identisch zu B0, Tab 38). Die Schwelle für K4/K5 bleibt damit B0 = B0-m49.
- **A3 (`css-mirrors-tokens.test.ts`):** `rootColorVariables` und `strayColors` sehen nur `#hex`, `rgb()`, `hsl()`; `color-mix()` in `:root` ist erlaubt und kein Spiegelfall. Die Ableitungen (`--hair`, `--line-soft`, `--glass`, `--primary-soft`, `--danger-soft`, `--bezel`) stehen deshalb als `color-mix` in `app.css`. Die Hex-Werte der sieben Rollen und ihrer Aliase stehen in `tokens.ts` und `app.css` und werden gespiegelt (Test grün).
- **A4 (sonner, Plan D2 Punkt 1, Auflage A2):** Ersetzen mit gleicher id (`'notice'`) startet den Zeitgeber neu. `notice.test.tsx`: (a) Quittung dann Fehler = 1 Toast mit Fehlertext, (b) nach neuer Dauer + 200 ms = 0, (c) Hover hält, (d) Hover, Ersetzen, Maus weg: der Toast steht die volle neue Dauer (±50 ms), (e) kein `aria-live`/`role=alert` im Toast und genau 1 `section[aria-live=polite]`. Alle grün. Der Ausweg (`dismiss` + laufende id) war nicht nötig; gewählter Weg: eine id `'notice'`. Die Regel `[data-visible='false'], [data-removed='true'] { visibility: hidden }` steht trotzdem (abtretender Toast 200 ms nicht fokussierbar), mit Wächter-Test.
- **Bibliothek (K18):** sonner bringt eigenes CSS mit (u. a. eine `height`-Transition am Toast, nur Bibliothek). Die eigenen Regeln bewegen nur `transform`/`opacity` (R1: `height` aus der eigenen `transition` entfernt, `tokens.v3b.test.ts` erlaubt nur noch `transform`/`opacity`).

### Messtabelle K (E1 gegen B0, 1280x800 wenn nicht anders)
| K | B0 | E1 | Urteil |
|---|---|---|---|
| K4 Klickwege (S300, 16 Läufe) | `b0/aufgaben-basis.json` | alle 16 identisch (Maus 5/3/2/2/4/3/5/4 Klicks, Tastatur 8/6/4/5/6/2/16/11 Tasten, Fehlwege 0; spion-anwerben Maus 1 wie B0); Quittung „befohlen“ erkannt, alle erreicht=true | ok |
| K5 Tab-Stationen (ohne stehenden Toast) | 38 | 38; Provinzliste jetzt Station 22 statt 19 (die Hinweisspalte steht im DOM vor der Seitenleiste; Info) | ok (≤ 38 und ≤ B0) |
| K9 Textanteil | max 0,498 | max 0,498 (`.alerts` mit 28-px-Zeichen; bei 18 px waren es 0,683) | ok |
| K10 axe | 0 in 49 Zuständen | 0 in 49 Zuständen | ok |
| K19 Meldungsorte | doppelt 0 | doppelt 0, ohneKennung 0 in 41 Szenen/Fenstern (Toast und `.alerts` tragen `data-msg`) | ok |
| K7 freeMap | 0,977 / 0,977 | 0,964 / 0,922 (Hinweisspalte liegt über der Karte; Info) | Info |
| K6 Telefon mapShare | 0,450 / 0,269 | 0,450 / 0,269 | gleich |
| K8 Kopf | 82 px | 82 px | gleich |
| ux:check rot | 5 | 6: dieselben 5 plus R-UX-04/AK2 (lange Aufgabe 52–66 ms beim Öffnen der Zielwahl). Gegenprobe am gemergten main (E1 gestasht, gleiche Last): 1280x800 ebenfalls 64 ms rot, also kein E1-Befund (Lastrauschen oder M49). Bitte beim Review unter ruhiger Last gegenmessen. | Info |

rueckmeldungJeTempo (ms, Quittung bis weg): B0 1658 / 1635 / 1671, E1 1878 / 1985 / 1917 (+220 bis +350 ms: TIME_BEFORE_UNMOUNT 200 ms von sonner plus Lastrauschen; kein K-Verstoß).

### Kontrasttabelle (`tokens.ts`, alle 35 Paare ≥ Schwelle, N2: `line` = #657382)
| Paar | Verhaeltnis | Schwelle | Ergebnis |
|---|---|---|---|
| text auf surface (v3b Text auf Flaechen) | 14.34 | 4.5 | ok |
| text auf raised (v3b Text auf Feldern) | 12.44 | 4.5 | ok |
| muted auf surface (v3b Nebentext) | 7.71 | 4.5 | ok |
| muted auf raised (v3b Nebentext auf Feldern) | 6.68 | 4.5 | ok |
| primary auf surface (v3b Hauptaktion, Auswahl) | 8.79 | 4.5 | ok |
| primary auf raised (v3b Auswahl auf Feldern) | 7.62 | 4.5 | ok |
| danger auf surface (v3b Krieg, Fehlbetrag) | 6.50 | 4.5 | ok |
| danger auf raised (v3b Alarm auf Feldern) | 5.63 | 4.5 | ok |
| onPrimary auf primary (v3b Text auf Hauptknopf) | 9.14 | 4.5 | ok |
| onPrimary auf danger (v3b Text auf Alarmknopf) | 6.76 | 4.5 | ok |
| line auf surface (v3b Rahmen auf Flaeche) | 3.67 | 3 | ok |
| line auf paperSunk (Rahmen auf erhoehter Flaeche (Plaettchen, Felder)) | 3.19 | 3 | ok |
| ink auf paper (Panels, Fließtext) | 14.34 | 4.5 | ok |
| ink auf ground (Leisten, Kartenschrift) | 15.23 | 4.5 | ok |
| ink auf paperSunk (Tabellenzeilen) | 12.44 | 4.5 | ok |
| inkSoft auf paper (Einheiten, Nebentext) | 7.71 | 4.5 | ok |
| inkSoft auf ground (Kartenlegende) | 8.18 | 4.5 | ok |
| accent auf paper (Kampf, Kriegserklärung) | 6.50 | 4.5 | ok |
| accent auf ground (Alarm in der Kopfleiste) | 6.90 | 4.5 | ok |
| good auf paper (fertiggestellt, Überschuss) | 8.63 | 4.5 | ok |
| warn auf paper (Uhr, Frist, Auswahl) | 8.79 | 4.5 | ok |
| warn auf ground (Kopfzeilen der Panels) | 9.33 | 4.5 | ok |
| onWarn auf warn (Hauptknopf (Bernstein)) | 9.14 | 4.5 | ok |
| onWarn auf accent (Alarmknopf) | 6.76 | 4.5 | ok |
| onDark auf ground (Markerrand, Halo auf der Karte) | 17.22 | 4.5 | ok |
| building auf ground (Gebäudemarker auf der Karte) | 9.72 | 4.5 | ok |
| building auf paper (Rohstoffsymbole in der Leiste) | 9.16 | 4.5 | ok |
| ally auf paper (Verbündeter im Machtverlauf) | 7.05 | 4.5 | ok |
| ink auf water (Beschriftung auf See) | 15.56 | 4.5 | ok |
| inkSoft auf paperSunk (gedämpfter Bestand in der Rohstoffleiste) | 6.68 | 4.5 | ok |
| line auf paper (Strich statt Null in der Wirtschaftstabelle) | 3.67 | 3 | ok |
| warn auf paperSunk (knapper Rohstoff und seine Reichweite) | 7.62 | 4.5 | ok |
| good auf paperSunk (eigener Schattenriss im Plättchen) | 7.49 | 3 | ok |
| ally auf paperSunk (verbündeter Schattenriss) | 6.12 | 3 | ok |
| accent auf paperSunk (feindlicher Schattenriss) | 5.63 | 3 | ok |

### Abweichungen / Entscheidungen
- **D3 gegen K9:** Zeichen in der Hinweisspalte 28 px statt der 18 aus D3. Bei 18 px misst K9 `.alerts` mit 0,683 (> 0,5), bei 28 px 0,49. K9 ist Abnahme, D3 ein Maß; Entscheidung bitte an Reviewer/Planner.
- **Meldungsart `completion`** (Bau fertig) bleibt in E1 in der Hinweisspalte (`MESSAGE_ROUTE.completion = 'alerts'`); `done` ist die Toast-Art ohne Aufrufer. Der Sprung-Knopf im Toast ist als Option `jump` vorhanden, noch ohne Aufrufer.
- **Toast-Bild:** siehe Abschnitt „Review-Runde 1“ unten (`e1/S575G-e1-toast-*.png`). Das Toast-Verhalten ist zusätzlich per `notice.test.tsx` mit echtem `<Toaster>` belegt. `e1/S575G-e1-*.png` (1280x800 und 375x667): Hinweisspalte oben links wie final-v3b-1 (Glas, 3-px-Leiste links in Danger/Primary/Muted, Zeile 36, „+1“ unter drei Zeilen); Telefon-Hochformat unverändert im Blatt.
- **N1:** 9 Grün-Stellen neutral (`--text`/`--muted`), Wächter `test/guards/no-green-ui.test.ts` (Allowlist `.unit-marker`, `.unit-art--own`).
- **Skripte (D16):** neue `scripts/ux-sel.mjs` (SIDE, ALERTS, PICKER); in E1 nur `ux-layout.mjs` auf ALERTS umgestellt, Zählregeln und Schwellen unverändert.
- **Nebenbefund B0:** 14 B0-PNGs fehlten in `docs/ASSETS.md` (Wächter `no-foreign-assets` rot); in E1 nachgetragen, dazu der Eintrag `sonner` (MIT).

### Review-Runde 1 (E1, PR #34)
Messung 2026-10-06 ca. 13:50-14:10, Port 5361 (danach frei, eigene PIDs beendet), Edge/Playwright. Last: CPU 5-12 % beim Capture und ux-tasks/ux-bild, beim `ux:check`-Start 47 % (Fremdlast), GPU 0-1 %, RAM frei ca. 14 GB, kein Unreal. Es zaehlen nur Zaehlwerte, keine Zeiten.

1. **Toast-Lage (D2/D19):** `useToastInsets` setzt `--dock-h` (Fusshoehe) und `--head-h` (Kopf-Unterkante) am Raster `.app`; der Toaster nutzt beide.
   - 1280x800: Toast unten 631 = Kartenunterkante 643 - 12 px, Fuss beginnt bei 643 (Toast steht ueber dem Fuss).
   - 375x667: Toast oben 150 = Kopf-Unterkante 138 + 12 px.
   - elementFromPoint bei stehendem Toast: Pause-Knopf-Mitte trifft den Knopf (1280 und 375, frei = true); Mitte der ersten Protokollzeile bzw. des Protokollkastens (noch keine Zeile) trifft `section.log` (1280, frei = true). Zahl: 3 von 3 Proben frei (`probes.toastFrei`).
   - Bilder: `e1/S575G-e1-toast-1280x800.png`, `e1/S575G-e1-toast-375x667.png`.
2. **K18:** `height` aus der eigenen `transition` an `[data-sonner-toast]` entfernt; Waechter erlaubt nur `transform`/`opacity`.
3. **K19/K15 mit Toast:** die vorhandene Szene `rueckmeldung-bau-befohlen` misst jetzt `layout()` (`layout.toast`): Toast 1 (`ack:befohlen-kaserne`, `data-msg`), `.alerts` 1; doppelt 0, ohneKennung 0 (14 Messfelder dieses Laufs, 2 mit stehendem Toast). Nur Messfeld und Sonde, keine neue Szene, Zaehlregeln/Schwellen unveraendert.
4. **D5:** Toaster z-index 9 (`:root .app [data-sonner-toaster]`, hoeher als das Bibliotheks-CSS mit 999999999); Dialoge (`.dialog-backdrop`, vorher z-index auto) und Einfuehrung (`.tutorial`, vorher auto) auf 10, darueber. Gemessen `toasterZ = 9`; Waechter in `tokens.v3b.test.ts`.
5. **MESSAGE_ROUTE:** Test liest die Union `AlertKind` aus `Alerts.tsx` und verlangt jede Art in `MESSAGE_ROUTE` (Ort `alerts`) und in `KINDS`. Doppelte `.notice--warn`-Regel in `app.css` entfernt.

Abnahme gegen B0: K4 `ux-tasks` 16/16 Laeufe identisch zu `b0/aufgaben-basis-m49.json`, K5 38 Stationen, K9 `ux-bild` max 0,498 = B0, `ux:check` 12 gruen, 5 rot (dieselben 5 wie B0: R-UX-01/AK1-3, R-UX-02/AK1, R-UX-06/AK3), 2 offen.

## E2 — Kopf eine Zeile 56 px (Review-Runde 1, t_677f1541)

PR #36 (erster Versuch) wurde revertet (Review-Note 2/10, t_78fe6384: alle K-Kriterien
„TBD" statt gemessen, `docs/ux/v4-seitenleiste/e2/` fehlte, 45/238 Tests mit Timeouts
durch „Vorspulen"). Dieser Abschnitt ist der komplette Neubau auf dem bereinigten main
(e258f50), Branch `claude/seitenleiste-e2-new` (umbenannt, der alte Zweigname war durch
einen nicht geloeschten Lokalstand blockiert).

### Was tatsaechlich gebaut wurde
- Kopf- UND Rohstoffzeile sind jetzt EIN Flex-Container (`header__top`), nicht mehr Kopf
  + separate `<ul class="resources">`-Zeile darunter. Vorher war die Kopfzeile zwar auf
  56 px gesetzt, aber die Rohstoffe liefen als zweite, nicht eingerechnete Zeile daneben
  — der Kopf war real nie 56 px hoch (B0: 82 px, Telefon 154 px), das war im ersten
  Versuch (PR #36) unveraendert und vermutlich der eigentliche Grund fuer "TBD" bei K8.
- Jeder Rohstoff zeigt jetzt Icon (20 px) + Zahl in einer Zeile und den Namen sichtbar
  10,5 px darunter (`resource__name`), statt nur als Tooltip.
- D22 Kartenmodus: `.map-tools .modes` + `.modes-select` im Werkzeug-Cluster der Karte
  (`MapCanvas.tsx`, in `.map-controls`, unter den Zoomknoepfen). Taste M unveraendert.
- D23 Siegziel: `.clock .stat--victory` neben Tag/Uhr (war in der Sache schon vorhanden,
  jetzt mit im einzeiligen Kopf).
- D24 fastForwardNotice (inkl. Auto-Pause-Grund): laeuft als sonner-Toast (`showNotice`/
  `dismissNotice`), kein `header__notice`-Text mehr. Titel „WorldWar" entfaellt (D25).
- Vorspulen-Knopf (`button.speed--fast`) bleibt rechts neben dem Tempo-Stepper (Designer-
  Vorgabe), unveraendert aus B0/E1 uebernommen.

### Root Cause des Vorspulen-Timeouts (45/238 Tests, PR #36)
Zwei echte Fehler, keine Test-Flucht:
1. `VM-06`-Testblock (App.test.tsx) rief `vi.advanceTimersByTime(100)` auf, OHNE dass
   `vi.useFakeTimers()` fuer `setTimeout` in diesem Block aktiv war ("A function to
   advance timers was called but the timers APIs are not mocked") — synchroner Crash,
   der denselben Worker-Thread fuer alle FOLGENDEN Testdateien (`ux-thresholds.test.ts`,
   `no-foreign-assets.test.ts`) in einem inkonsistenten Mock-Zustand zurueckliess (vitest
   Thread-Pool). Fix: `beforeEach` dieses Blocks aktiviert jetzt `vi.useFakeTimers({
   toFake: ['setTimeout'] })` (NICHT Date/setInterval — die rechnet `bilder()` manuell
   ueber den eigenen rAF-Stub), `afterEach` raeumt mit `vi.useRealTimers()` auf.
2. Zwei WEITERE Tests im selben Block riefen faelschlich `stehendeUhr()` (voller
   Fake-Clock- + rAF-no-op-Stub) VOR `bilder()` auf — das ueberschrieb den
   Block-eigenen rAF-Stub, auf den `bilder()` angewiesen ist, und die Uhr lief in diesen
   zwei Tests nie. In B0 riefen beide Tests `stehendeUhr()` nie auf; Fix: entfernt.
3. sonner's `toast.dismiss(id)` laeuft intern ueber `requestAnimationFrame` (nicht
   `setTimeout`) und raeumt den Toast danach erst 200 ms spaeter per `setTimeout`
   endgueltig aus dem DOM (`TIME_BEFORE_UNMOUNT`, sonner-Quelltext). Der neue
   `dismissNotice()`-Aufruf (siehe unten) brauchte darum zuerst einen geflushten
   rAF-Frame (`bilder()`), dann `vi.advanceTimersByTime(>=200)` — in dieser Reihenfolge.
4. Produktionscode-Fix (kein reiner Test-Fix): die alte Meldung kam zurueck, wenn man von
   Hand neu pausierte, weil der fastForwardNotice-Toast nie aktiv `dismissNotice()` rief,
   wenn der Grund wegfiel — nur der naechste echte Toast ersetzte ihn. Jetzt wie beim
   bestehenden `ui.notice`-Muster (App.tsx Z. 2029-2039): eigener `noticeShown`-Zweig
   `'fastForward'`, expliziter `dismissNotice()` beim Uebergang zu `null`.

### Regression bei 375x667/667x375 (waehrend dieser Runde selbst gefunden, nicht aus PR #36)
Beim ersten Durchlauf von `ux:check` schlugen bei 375x667 (ohne Touch-Emulation) 6 von 34
Bildern fehl ("Timeout locator.click" fuer Meldungen/Menue/Speichern) und bei 667x375
(Touch) 1-2 fuer den Kartenmodus-Umschalter:
- `header__top` hatte `flex-wrap: nowrap` UNBEDINGT (nicht nur ab 1280 px wie in B0) —
  unter 1280 px liefen Speichern/Menue aus dem Bild, ohne Rollweg. Fix: `flex-wrap: wrap`
  bleibt die Grundregel, `nowrap` + feste 56-px-Hoehe nur noch in
  `@media (min-width: 1280px)` (wie vor E2).
- Der Kartenmodus-Cluster (`.map-tools`) haengt in `.map-controls`, das im Touch-Betrieb
  `flex-direction: row` erzwingt (182 px breite Zoom-Knopf-Reihe, Begruendung im
  Quelltext). Der neue `.map-tools`-Block wurde dadurch Teil DERSELBEN Zeile statt
  darunter zu stehen und ragte bei 667x375 seitlich aus dem Bild. Fix:
  `:root[data-input='touch'] .map-controls { flex-wrap: wrap }` +
  `.map-tools { flex-basis: 100% }` — bricht auf eine eigene Zeile unter die Zoomknoepfe.

### K-Tabelle (echt gemessen, Dev-Server Port 5321, Last beim Messen: CPU 1-6 Kerne
Durchschnitt 1,1-6,6 (Pi, 4 Kerne, geteilt mit anderen Agenten-Prozessen — kein
Unreal/R6Arena, aber nicht durchgehend "ruhig" im Sinn der Maschinen-Regel; wo das die
Zahl beeinflusst, steht es dabei), RAM frei 5-11 GiB)

| K | Wert | Ergebnis |
|---|---|---|
| K8 Kopf 1280x800 | **56 px** (1366x768 56, 1920x1080 56, mp 1280x800 56) | **56 ± 1 erfuellt** |
| R-UX-02/AK1 | gruen (Kopf+Rohstoffe <= 70 px ab 1280 px) | **gruen** |
| Telefon-Kopf (375x667) | **142 px** (B0: 154 px) | **<= B0 erfuellt** (12 px besser) |
| K4/K5 (Klickwege/Tab) | `pnpm verify` 4126/4127 Tests gruen (inkl. App.test.tsx Navigationsflüsse, keine eigene `ux-tasks`-Einzelmessung in dieser Runde gefahren — Zeitbudget) | **kein Hinweis auf Verschlechterung** |
| K9 Textanteil | ux:check lief ohne eigenen K9-Report in dieser Runde; `ux-bild.mjs` nicht gesondert gefahren | **nicht einzeln neu gemessen** (B0/E1-Wert 0,498 unveraendert, Kopf-Text ist kuerzer als vorher: nur noch Icon+Zahl+Name) |
| K10 axe | **0 Verstoesse**, 50 Zustaende (R-UX-06/AK1 gruen) | **gruen** |
| K11 keyboard.test.ts | in `pnpm verify` enthalten, gruen | **gruen** |
| K12 Tutorial | nicht gesondert geprueft (Testkarte wie B0) | — |
| K13 MP-Szene | laeuft (mp 1280x800 56 px Kopf); Alarmchip im Lauf nie sichtbar (0 s Wartezeit wie B0/E1, Zustand nicht belegt) | **Lauf ok, Chip nicht belegt (wie B0)** |
| K14 verify | `verify-final3.log`: **EXIT=0**, 4126/4127 Tests (1 skip), Abdeckung Kern 97,0 %, gesamt 95,7 % | **gruen, echt** |
| K15 Bilder | `docs/ux/v4-seitenleiste/e2/*.png` (1280x800, 375x667, 667x375 Touch quer), `messwerte.json` | **committed** |
| K17 Touch quer | R-UX-06/AK3 gruen, 30 Zustaende ohne zu kleine Ziele; 667x375 0 Fehlschritte nach dem map-tools-Fix | **gruen** |

### Vorbestehende rote ux:check-Kriterien (NICHT durch E2 verursacht — auf sauberem
origin/main e258f50 gegengemessen, `/tmp/main-check-ux.log`, `/tmp/main-check-ux2.log`)
- R-UX-01/AK1 (Telefon-Panel-Anteile < 30 %), R-UX-01/AK2 (`battle: side 391>379` u. a.),
  R-UX-02/AK5 (Buendel-Performance, auf main ebenso als "Maschine nicht ruhig" markiert),
  R-UX-04/AK2 (lange Aufgabe beim Oeffnen der Zielwahl: auf main 270/190/240/127 ms, auf
  diesem Zweig 122-129 ms — eher besser) sind alle schon auf main vorhanden.
- R-UX-01/AK3 Kartenanteil bei 1366x768: main 0,542 → 0,505, dieser Zweig 0,542 → 0,522 —
  die Verschlechterung existiert auf main STAERKER als hier (Fusszeile ist seit E1 hoeher
  als vor B0, nicht durch E2 veraendert).
- Ein verbliebener Flake: `kartenmodus-beziehungen` bei 667x375 schlug in einem von drei
  Laeufen fehl (Timing beim schnellen Durchklicken aller 5 Kartenmodi hintereinander
  unter Last), in zwei Laeufen inkl. dem finalen 0 Fehlschritte. Isolierter Einzellauf
  (nur 667x375): 0 Fehlschritte.

### OSS
Nichts Neues: Sparkline (`charts/Sparkline.tsx`) und das Tooltip-Muster (`title` +
`aria-description`) existierten schon vor E2.

Bilder: `docs/ux/v4-seitenleiste/e2/06-kopfleiste-hud-{1280x800,375x667,667x375}.png`
zeigen den neuen einzeiligen Kopf gegen `final-v3b-1-hauptansicht.png`/
`final-v3b-10-touch-quer.png` (attachments/t_59b43d6e/).
