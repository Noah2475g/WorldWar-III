# Seitenleiste v3b · E3 „Gerüst" — Bericht

Stand: Zweig `claude/seitenleiste-e3` ab `dfe0953` (main nach E2). Maschine: Raspberry Pi 5 (4 Kerne, 16 GB),
headless Chromium. Last je Messschritt im Log `messlauf*.log` (Load1 0,8–2,0; RAM frei 11–12 GB; kein fremder
Lauf zur Messzeit, ein fremder vitest-Lauf wurde vorher abgewartet).

## Was gebaut ist

- **D5** `.main` = Karte über die ganze Breite (1280 × 744 bei 1280x800); alles andere schwebt darüber.
  z-Leiter: Werkzeuge 2 · Hinweise 3 · Provinzwahl 4 · Leiste rechts 6 · Seitenleiste 7 · Toast 9 · Dialoge 10.
- **D6** `nav.rail` (64 px, Radius 20): `button.rail__toggle` (W) und 7 × `button.rail__item[data-area]`
  (diplomacy D · market H · armies A · espionage S · standings L mit Zähler · economy · log). `aside.side`
  320 px links daneben, Kopf 52 (Titel, Taste, ×), Körper rollt. Zu = `inert` + transparent.
  W: offen → zu; zu → letzter Bereich (`localStorage 'worldwar.side.lastArea'`, frisch Diplomatie).
  Escape schließt (bestehender Weg), Fokus zurück zum Auslöser. Storyboard B: 260 ms, 40 px von rechts +
  Einblenden, Zeilen 30 ms versetzt, Werkzeuge rutschen mit (−332 px); Reduced Motion: sofort.
- **D7** Kein Fuß mehr. Protokoll → Bereich `log` (erste Zeile `button.dispatch-card` = Depesche, D27),
  Ranglisten-Zeilen → oben im Bereich `standings`, Zähler → `.rail__item[data-area=standings] .badge`
  (min-width 18, D28). `Foot.tsx` bleibt als Modul für die reinen Funktionen + `LogArea`/`StandingsTop`.
- **D8** `ui/MapTools.tsx` (Spalte 148 px oben rechts): Zoom + / − / ⌂ (32, Touch 44) · Welt/Region/Nah
  (26 px, aktiv = `zoomTier(view.scale)`, Klick setzt 2,5 / 1,6 / 0,97 um die Kartenmitte) · Kartenmodus (E2) ·
  Übersichtskarte · Legende.
- **D19** Provinz-/Armeepanel öffnen die Seitenleiste wie bisher (`ui.panel` bleibt EIN Wert).
- **D29** Tutorial-Ziele: `events` → `.rail__item[data-area="log"]`, `fastForward` → `.clock .speed--fast`.
- **D16** Skripte: neue Konstanten in `scripts/ux-sel.mjs` (RAIL, RAIL_ITEM, SHEET_ITEM, DISPATCH,
  STANDINGS_TOP); `.foot`-Selektoren ersetzt; „Rangliste / Sieg" → „Rangliste"; Depesche nach Öffnen des
  Protokolls; Armeezeichen in `ux-tasks.defs.mjs` relativ zur Kartenoberkante (Kopf 56 seit E2).
- **D30** `scripts/ux-axe-full.mjs`: axe mit wcag2a/2aa/21a/21aa/22aa über 9 Szenen.
- Provinzwahl: bis E5 (Leiste unten) als `aside.map-picker` unten mittig auf der Karte (Telefon: im Blatt).

## Messtabelle (gegen B0)

| K | Soll | E3 | Beleg |
|---|---|---|---|
| K4 Klickwege | ≤ B0 je Aufgabe | 16/16 = B0 (Klicks, Tasten, Fehlwege, Bildläufe) | `aufgaben-e3.json` |
| K5 Tab-Stationen | ≤ 38, ≤ B0 | 33 (B0 38) | `aufgaben-e3.json` begleitmessungen |
| K6 375x667 mapShare | ≥ B0 − 0,01 | 0,45 / 0,269 (B0 0,45 / 0,269) | `layout-e3.json` |
| K7 Karte | 1280 × 744 ± 2 | 1280 × 744 | `layout-e3.json`, `bilder-mass.json` |
| K7 freeMap nichts gewählt | ≥ 0,85 | 0,916 | `layout-e3.json` |
| K7 freeMap Seitenleiste offen | ≥ 0,64 | 0,655 | `layout-e3.json` (Szene panel) |
| K9 Textanteil | ≤ 0,5 | **3 Ansichten > 0,5** (s. u.) | `ubild-e3.json` |
| K10 axe 2.1 (ux-capture) | 0 | 0 in 47 Zuständen | `capture-e3.json` |
| K10 axe 2.2 voll (D30) | 0 bzw. ≤ B0 | 9 = 1 Regel `target-size` × 9 Szenen, nur Tempo-Knöpfe im Kopf (E2) | `axe-voll-1280x800.json` |
| K11 Tastatur | D/H/A/S/L, W, Esc, Fokus | grün | `App.sidebar.test.tsx`, `keyboard.test.ts` |
| K12 Tutorial-Ziele | im DOM | grün | `App.sidebar.test.tsx` |
| K13 MP-Szene | läuft | mp 375/1280: 0 Fehlschritte | `capture-e3.json` |
| K14 | keine neue Abhängigkeit, kein Diff packages/ data/rules | eingehalten | `git diff --stat` |
| K15 Bilder | 1280x800, 1920x1080, 375x667, Touch quer | 12 Bilder (zu / Diplomatie / Protokoll) | `e3-*.png` |
| K18 Bewegung | nur transform/opacity | grün (tokens.v3b-Test) | `tokens.v3b.test.ts` |
| K2 (Info) | Diplomatie ≤ 1,5 | 1212/668 = 1,81 (Inhalte erst E4) | Sonde im Bericht |

ux-capture --check (Zusammenfassung, `ux-check-final.log`): 12 grün, 5 rot, 2 offen. Rot und Ursache:
- R-UX-01/AK1 Telefon mit Panel 29 % / 27 % — **gleich E1** (29 / 27). Der Kopf darf im Hochformat wieder
  wachsen (s. u.); bei offenem Blatt tritt die Leiste zurück wie früher der Fuß.
- R-UX-01/AK2 667x375 `resources` 677 > 667 — Kopf (E1 schon rot: 686 > 667).
- R-UX-01/AK3 nur noch „1366x768 Ziele unter 24 px 1 → 2" (Provinzwahl 23 px hoch; behoben auf 28 px nach dem
  Lauf, Einzelsonde: nur noch `alert__dismiss` 21 px wie vorher). 0 Fehlschritte in allen 7 Läufen.
- R-UX-04/AK2 lange Aufgabe beim Öffnen der Zielwahl 81–87 ms (E1: 52–62 ms, andere Maschine; Pi, Last ~1,4).
- R-UX-06/AK3 667x375 armyPanel 1 Ziel < 44 im Kopf (E2).

## Abweichungen / offen

- **K9 rot in 3 Ansichten**: 1280 Provinz „panel" 0,537 (Picker-Zeichen und Wirtschaft stehen nicht mehr in
  der Seitenleiste, daher weniger Zeichen); 375 S575G „kopf" 0,512 (Kopf E2; E1 0,498); 375 protokollOffen
  „panel" 0,615 (das Protokoll steht jetzt in der Seitenleiste und zählt als „panel"). Inhalte ordnet E4.
- **Kopf Telefon (Fix)**: seit E2 ist der Kopf fest 56 px; im Hochformat lagen Menü/Spielstände darunter und
  nahmen keinen Klick an (gemessen an `dfe0953`: die Karte fängt den Klick). Jetzt `height: auto` nur im
  Hochformat → ux-capture 375x667 0 statt 5 Fehlschritte.
- Doppelte Titelzeile: die Titelzeile der Panels ist unter dem Kopf 52 ausgeblendet (Untertitel bleibt).
- Handelsformular: Bestand bleibt in der Zeile (sonst +1 Bildlauf in K4 „Handel anbieten").
- verify (`verify.log`): 45 Fehler in 3 Dateien = **genau der Stand von `dfe0953`** (App.test.tsx 29 aus der
  VM-06-Fake-Timer-Kaskade, ux-thresholds.test.ts 15 und no-foreign-assets 1 an eingecheckten docs/ux/before-
  Dateien; am Basis-Worktree gemessen: App.test 29, die anderen beiden 16). Keine neue Fehlerzeile.
  Protokoll-Lesestellen in App.test öffnen jetzt den Bereich und kehren danach ins Panel zurück.

## Bilder (neben v3b)

- `e3-1280x800-zu.png` ↔ `final-v3b-1-hauptansicht.png`: Karte voll, Leiste rechts, Werkzeuge oben rechts.
- `e3-1280x800-diplomatie.png` ↔ `final-v3-4-seitenleiste.png`: Seitenleiste 320, Kopf 52, Werkzeuge −332.
- `e3-1280x800-protokoll.png` ↔ `final-v3b-12-depesche.png`: Depesche erste Zeile im Protokoll.
- `e3-touch-quer-1280x800-*.png` ↔ `final-v3b-10-touch-quer.png`: Ziele 44.
- `e3-1920x1080-*.png`, `e3-375x667-*.png` (Telefon: Blatt wie bisher, Leiste als Reihe; Umbau E8).

## OSS

Nichts Neues; Leisten mit CSS (react-resizable-panels MIT, dockview MIT lösen Docking, nicht Dichte);
Zeichen lucide-react (ISC), Bilder game-icons.net (CC BY 3.0).
