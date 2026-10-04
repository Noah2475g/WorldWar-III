# V3 · Leistung — Endstand (Rechnerfenster 2, 2026-10-04)

Gemessen 21:02–21:18 auf Noahs Rechner, Freigabe durch Noah („Fenster frei, Blender und Epic sind
zu“). Last vor den Schritten 1–28 % (Werte je Schritt in `fenster2.log` im Sitzungs-Scratchpad);
keine andere Claude-Sitzung aktiv. Stand: Versionszweig `claude/v3-leistung-ux` = `6672743`.
Ausgangswerte: `leistung-ausgang.md` (P0-W, 2026-10-04 morgens).

## R-PERF-01 — erfüllt

| Kriterium | Grenze | Ausgang | Endstand | hält? |
|---|---|---|---|---|
| AK1 · Bündel S300, Tempo 100, 10 s | ≥ 98 Ticks/s | 91,6 | **99,87** (1001 Ticks in 10,024 s, 0 Bilder > 50 ms, 0 lange Aufgaben) | ja |
| AK1 · Bündel S500, Tempo 100, 10 s | ≥ 98 Ticks/s | — (S575 war Messfehler) | **99,94** (1001 Ticks in 10,016 s, 0 Bilder > 50 ms, 0 lange Aufgaben) | ja |
| AK2 · Langlauf, höchstes 50-Tage-Fenster vor der Entscheidung | ≤ 10 ms je Tick | 9,32 (`main`) | **2,81** (Tage 200–250) | ja |

Langlauf einzeln (`pnpm sim:long`): Mittel über 1000 Tage **3,11 ms** je Tick (Ausgang 16,60), Entscheidung
weiter bei **Tick 9456** — dieselbe Partie wie vorher (verhaltensgleich, Regel 3). Auch nach dem Sieg
höchstens 4,27 ms (Ausgang bis 31,1) — G1-5 hatte dafür kein Ziel gesetzt, es fällt trotzdem mit.

## Uhr an der exe (neue Partie, je 5 Läufe)

| exe | Quelle | Größe | Minimum | Median | Höchstwert |
|---|---|---|---|---|---|
| Ausgangswert | `19b28d3` (`main`) | 6 827 008 B | 99,76 | 99,87 | 99,91 |
| V3 | `6672743` | 7 066 624 B | 100,63 | 100,66 | 100,81 |

Nicht langsamer. **Befund (offen):** die V3-exe misst systematisch **über** 100 Ticks/s (+0,8 %). Am Bündel
(S300/S500) zeigt dieselbe Uhr 99,87/99,94. Vermutung: seit T-M45-04 geht der Stand höchstens einmal je Bild
und mit adaptiver Lücke an React — die Kopfleiste, aus der das Uhr-Skript abliest, hinkt am Anfang des
Fensters stärker nach als am Ende. Nicht untersucht; zu klären, bevor die Uhr-Zusage neu gefasst wird.

## Zeichnen (`render.bench.slow`, Node)

Erste Zeile Median 1,96 ms (vorher 2,08), p95 2,36 (2,42), Max 4,31 (6,53); zweite Zeile Median 2,31 (2,42),
p95 3,13 (4,01). Die Stapel-Entzerrung (T-M46-03, Radius 96 → 256) kostet messbar nichts; Grenzen gehalten.

## Abnahme

`pnpm acceptance` **12 von 12, Exit 0**, 3 min 49 s (zweiter Lauf). Der erste Lauf im Fenster war 9 von 11:
der Netzfreiheits-Bericht nannte noch die exe von `main` (6 827 008 B) — nach `node scripts/measure-netfree.mjs`
gegen die neue exe grün. AK-1 Siegtag 589 (unverändert).

## Nicht gemessen

- Ladezeit am Bündel getrennt (in `ux-capture --state` nicht ausgewiesen).
