# E7 Seitenleiste v3b: Markenkollision layoutMarks + Machtnamen + Messhaken

## Umfang in dieser Karte (Mentor-Befund t_9778f304, Option b)

layoutMarks.ts (Positionierung, Schritte 1–7 + BUILDINGS_YIELD_TO) ist fertig, getestet (10/10,
inkl. Planer-Nacharbeit) und **verdrahtet** in markers.ts/MapCanvas.tsx: `collideMarks()` berechnet
die kollisionsfreie Lage fuer Armee-/Gebaeudemarker auf mid/far und MapCanvas zeichnet an diesen
Positionen — mit dem **bisherigen** Pfad je `kind` (kein neues Aussehen). `near` bleibt bitgleich
(K16): `collideMarks` wird dort nicht gerufen.

**Nicht Teil dieser Karte** (Mentor: Phase "Verdrahtung" != Phase "Zeichnung", Folge-Ticket E7b):
- Die "gemischte Pille" (eigen|feind in einer Marke zusammengelegt, Schritt 2 der Spec) — Marken,
  die `layoutMarks` zusammenlegt (Schritt 5), bleiben unveraendert an ihrer alten Stelle und werden
  mit `merged: true` markiert, statt eine neue Pille zu zeichnen.
- Die Anker-Linie (Schritt 4), wenn der Versatz die Mitte verlaesst.
- Machtnamen-Zeichnung (`placeLabels`, §12.14.2) — die Funktion existiert und ist getestet, aber
  nichts in MapCanvas ruft sie: Machtnamen werden heute nicht als eigene Marken gezeichnet.
- `scripts/ux-marks.mjs` (Mess-Skript gegen die laufende App) — von Mentor t_ddc12c7e als Folge-
  Arbeit benannt, nicht erzwungen.

## Messung (K16, S575, Sicht der Macht mit den meisten Provinzen = p6)

`layoutMarks.slow.test.ts`, dieselbe Kamera wie B0 (`gebaeude.slow.test.ts`):

| Stufe  | gezeichnet | overlapPairs25 (ohne Gebaeude×Gebaeude) | Gebaeude×Gebaeude-Paare | B0-Vergleich | Feind sichtbar | zurueckgetretene Gebaeude | Layoutzeit |
|--------|-----------:|-----------------------------------------:|-------------------------:|--------------|----------------:|---------------------------:|-----------:|
| Region (1,6) | 368 | **0** | 0 | ≤ B0 (72) ✓ | 0/0 (100 %) | 171 | 11,7 ms* |
| Welt (2,5)   | 237 | **0** | 0 | ≤ B0 (0 — Welt zeichnet keine Gebaeude) | 0/0 (100 %) | 0 | 1,9 ms* |

\* Layoutzeit hier inklusive Eingabe-Aufbau aus der Fixture (Realwelt-Pfad, nicht der reine
Algorithmus — siehe Layoutzeit-Median unten).

Gebaeude×Gebaeude ist bewusst ausgeklammert (Planer-Nacharbeit Runde 1, Punkt 1): Gebaeude pruefen
sich heute nicht gegeneinander (anchors.ts regelt das schon); K16-neu verlangt hier nur ≤ B0 statt 0.

Feind: an diesem Fixture/Blickwinkel gibt es 0 sichtbare Feindarmeen (0/0) — die Vorrangregel
(Feind nie verdeckt) ist durch die Unit-Tests (layoutMarks.test.ts, "Feind ist nie verdeckt")
abgedeckt, hier ohne Gegenprobe mangels Feind im Fixture.

**Befund + Korrektur:** Die erste Messung fand 1 uebrig gebliebene Ueberdeckung (zwei Armeen aus
Nachbarprovinzen, 'me'-Seite). Ursache: Schritt 6 (Notfall) suchte nur im kleinen Ring (12–28 px)
statt — wie der reguläre Versuch davor — auch im erweiterten Ring (36–44 px) fuer Armeen/Feind.
Behoben in `layoutMarks.ts` (Notfall nutzt jetzt denselben Ring wie Schritt 3); Unit-Tests weiterhin
10/10 gruen, Messung danach overlapPairs25 = 0 auf beiden Stufen.

## Layoutzeit-Median (K14, rbush-Entscheidung)

20 Laeufe, 370 synthetische Marken (Groessenordnung wie Region), ruhige Maschine (Last < 1,3/4 Kerne
zum Messzeitpunkt, kein Unreal/R6Arena): **Median 1,79 ms**, Min 1,61 ms, Max 6,05 ms (ein Ausreisser,
vermutlich GC/JIT-Aufwaermung). Schwelle K14/D14: rbush nur bei Median > 4 ms. **1,79 ms < 4 ms ⇒
kein rbush.** Werte in `docs/reports/v4/layoutzeit.json`.

## OSS-Befund (wortlich fuer den PR)

Markenkollision: Eigenbau `layoutMarks()` (wie geplant). `labelgun` (MIT, 6.1.0, 2017) ist ungepflegt
und versetzt Marken nicht (nur Verstecken); `supercluster` (ISC) clustert nach Abstand, nicht nach
Prioritaet/Kollision — beides passt nicht auf die Regel §12.14.1. `rbush` 4.0.1 (MIT) **nicht
genutzt** — Layoutzeit 1,79 ms Median liegt unter der 4-ms-Schwelle.

## Bekannte Luecken (fuer E7b)

- Gemischte Pille (eigen|feind) nicht gezeichnet — zusammengelegte Marken bleiben unveraendert stehen.
- Anker-Linie nicht gezeichnet.
- Machtnamen nicht gezeichnet (Funktion vorhanden, ungenutzt).
- `window.__wwMarks()` liefert das letzte `LayoutResult` (mid/far) — kein eigenes `ux-marks.mjs`-Skript
  in dieser Karte; `scripts/ux-marks.mjs` ist Mentor-Folgearbeit (t_ddc12c7e).
- `pow` in `collideMarks` ist die Provinz, nicht die Macht (Marker tragen keine Machtkennung) — eine
  bewusste Naeherung fuer das Zusammenlegen (Schritt 5); fuer echte Machtzuordnung braucht es ein
  neues Feld auf `Marker`, aus Scope-Gruenden hier nicht gebaut.
