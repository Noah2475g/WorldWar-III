# V3 · Leistung — Ausgangswerte (Rechnerfenster P0-W, 2026-10-04)

Gemessen von 08:52 bis 09:38 auf Noahs Rechner (Windows 11), Freigabe durch Noah.
Last vor jedem Schritt 4–23 % (Hintergrund: Discord, Docker Desktop, Blender im Leerlauf mit
ungespeicherter Datei — nicht beendet, 0,09 CPU-s in 15 s). Ablauf: `fenster-ablauf.sh`
(Scratchpad der Sitzung), Schritte nacheinander, nie zwei Messungen zugleich.

## 1 · Langlauf je Commit (einzeln, 1000 Tage, 8 KI, Weltkarte)

Je Commit ein eigener Worktree (`git worktree add --detach`); die Zeitreihen-Erweiterung
von `longrun.slow.test.ts` (P0-A, nur Bericht) wurde in alle vier Worktrees kopiert, kein
Spielcode. Rohberichte: `langlauf-<commit>.md` hier daneben.

| Commit | Stand | Mittel 24 000 Ticks | Entscheidung (Tick / Tag) | **höchstes 50-Tage-Fenster vor der Entscheidung** | höchstes Fenster nach der Entscheidung |
|---|---|---|---|---|---|
| `95441e0` | Etappe 1 | 5,45 ms | 12672 / 528 | **9,12 ms** (200–250) | 6,14 |
| `b8106df` | Code Stufe C2 | 9,78 ms | 10224 / 426 | **8,96 ms** (200–250) | 24,45 |
| `0cabf39` | KI-Endstand | 16,71 ms | 9456 / 394 | **9,05 ms** (200–250) | 31,86 |
| `main` (`19b28d3`) | heute | 16,60 ms | 9456 / 394 | **9,32 ms** (200–250) | 31,11 |

**H-P1 (Etappe 2 macht die Tickzeit im Spätspiel teurer) ist für die Zeit bis zur Entscheidung
widerlegt:** alle vier Stände liegen vor der Entscheidung zwischen 3 und 9,3 ms je Tick, der
Unterschied (9,12 → 9,32) liegt in der Streuung zwischen divergierenden Partien. Der Sprung des
Mittelwerts (5,5 → 16,6 ms) kommt **vollständig aus den Ticks nach der Entscheidung**: ab
Etappe 2 steigt die Zeit nach dem Sieg auf 24–32 ms je Tick (die Sieger-KI wächst weiter, ohne
dass die Partie endet). Der alte Mittelwert 18,6 ms war also eine Mischgröße aus Spätphase
nach Spielende und Parallellast in `acceptance`.

Das Budget bei Tempo 100 (10 ms je Tick) hält headless bis zur Entscheidung — knapp (9,3 ms).

## 2 · Bündel am Stand (Tempo 100, 10 s, 1920x1080, `ux-capture --bundle --state`)

| Stand | Tag | Ticks/s | Bilder > 50 ms | lange Aufgaben |
|---|---|---|---|---|
| S300 | 300 | **91,6** | 84 | 23 |
| S575 | 575 (14 Tage vor der Entscheidung) | **29,9** | 52 | 49 |

Die Stände stammen aus der ausgelieferten Aufstellung (1 Mensch ohne Befehle + 7 KI, Startzahl
1914, entschieden an Tag 589) — eine **andere Partie** als der Langlauf (8 KI, Tag 394).

> **Korrektur 2026-10-04 (Bahn P-Hülle):** Der S575-Wert ist **ein Messfehler**. S575 liegt nur
> 14 Tage (~336 Ticks) vor der Entscheidung; bei Tempo 100 endet die Partie nach rund 290 Ticks mit
> „Niederlage – Russland hat gewonnen“ (Tag 590), und das 10-s-Fenster misst den Stillstand nach dem
> Ende mit. 29,9 Ticks/s heißt nur „290 Ticks bis zum Sieg“. Ein Browserprofil im Fenster **vor** dem
> Ende zeigt den Hauptfaden voll belegt: Ticks 70–75 %, React 16 %, Native 7–11 % — die Hülle kostet
> also rund **25–30 %**, nicht zwei Drittel; im Browser kostet ein Tick dort ~12,7 ms (Maschine belegt,
> nur Hinweis). S300 (91,6) ist davon nicht betroffen. Wie S575 künftig gemessen wird: siehe G1-Nachtrag
> in `docs/plan/V3-G1-DOSSIER.md`.
<!-- LOESCHVERMERK (Review): falsche Deutung, ersetzt durch die Korrektur oben. Wortlaut:
**Im Browser hält Tempo 100 im Spätspiel nicht:** an S575 läuft die Uhr mit 30 statt 100 Ticks/s.
Headless kostet derselbe Stand ~10,7 ms je Tick (Abschnitt 3); der Rest (~20 ms je Tick) liegt
in der Hülle (Zeichnen, React, Ableitungen je Tick).
-->

## 3 · Profil an den Ständen (headless, 240 Ticks mit KI)

Zeit je Test (Modus `plain`, enthält Laden und Aufwärmen): S100 2,50 s · S300 2,01 s · S575 2,57 s
→ grob 10,4 / 8,4 / 10,7 ms je Tick. Anteile und Aufrufzahlen: `profil-S*.json` (P0-A):
KI-Anteil S100 0,09 · S300 0,13 · **S575 0,48**, größter Posten an S575 `distances` (24 %) und
`threatMap` (13 %) in `packages/ai/src/threat.ts`. Die Etappe-2-Funktionen (`consolidate`,
`economyCommands`) laufen 0,25-mal je Tick und stehen nicht in den Top 15.

## 4 · Zeichnen (`render.bench.slow`, Node) — `render-bench.json`

Erste Zeile: Median 2,08 ms (vorher 1,96), p95 2,42 (2,28), Max 6,53 (5,79); zweite: Median 2,42
(2,51), p95 4,01 (4,19). Unterschiede in der Streuung; keine Grenze verletzt.

## 5 · Uhr an der exe (neue Partie) — `docs/reports/packaging.md`

Alt 99,80 / 99,88, neu 99,64 / 99,77 Ticks/s (Min/Median) → Normalstreuung.

## Offen

- Ladezeit am Bündel: die Ausgabe von `ux-capture --state` nennt sie nicht getrennt; nachholen in Rechnerfenster 2.
- Ms-Werte des Profils sind Testdauern (mit Laden), keine Tickmessung im engen Sinn.

## Folgerung für G1

1. Der Hebel liegt **nicht** in Etappe 2, sondern (a) in den **Tickkosten** (Kern und `threat.ts`,
   ~70–75 % des Hauptfadens im Browser an S575) und (b) in der **Hülle** (~25–30 %). *(Korrigiert
   2026-10-04; vorher hieß es „Hülle zuerst, S575 30 Ticks/s“ — Messfehler, siehe Abschnitt 2.)*
2. Die Ticks **nach der Entscheidung** (24–32 ms) sind nur relevant, wenn nach dem Sieg
   weitergespielt wird — eine Frage an Noah, kein Ziel von sich aus.
