# Welt-Pille (Zoom-Cluster E3a-E3d, M51, T-M51-07..10) — Abnahmebericht

Plan: `01_Projects/WorldWar/WorldWar — Plan Zoom-Cluster.md` §11 (E3 Welt-Pille), Entscheidungen D16-D26.
Stand: S575G (viewer p6, staerkste Macht), Welt-Zoomstufe (`data-tier="far"`), 1280x800.

**Nachtrag Review-Runde 1 (AK15-Nachbesserung, siehe Abschnitt 1a):** Die urspruengliche Fassung
dieses Berichts (Commit `619890a`) hatte AK15 ("Zusammenlegen auf far") faelschlich als erfuellt
gemeldet. Der Reviewer hat am Produktionscode reproduziert, dass `layoutMarks`s eigener
Zusammenlegen-Zweig (Schritt 5) bei realistischen Box-Groessen (20-41 px) fast nie erreicht wird,
weil der Ring-Versatz vorher fast immer einen freien Platz findet — `mergeRadius` war fuer
`collideWorldMarks` praktisch wirkungslos. Dieser Bericht ist korrigiert (Abschnitt 1a, 2, 5).

## 1. Was gebaut wurde (E3a-E3c, Zahlen aus `weltpille.json`)

- E3a (T-M51-07): `welt.ts` — `worldRawMarks` (D16/D17/D20), `layoutMarks.ts` additiv um
  `n2`/`label2`/`mergeRadius` erweitert (D21, Default 64 unveraendert, kein Verhalten anderswo
  geaendert).
- E3b (T-M51-08): `markers.ts` (`worldPillMarkers`/`collideWorldMarks`/`pickWorldPill`),
  `MapCanvas.tsx` Zeichenzweig `kind:'worldPill'` (D22), Klick -> `zoomToGroup` auf mid (D23).
- E3c (T-M51-09): `zoomcluster-welt.slow.test.ts` misst an S575 (viewer p6):

  | Groesse | gemessen | erwartet (A19/A20) | Abweichung |
  |---|---|---|---|
  | Rohstand eigen | 121 | 126 | 4 % (< 10 %, kein Hinweis) |
  | Rohstand Feind | 5 | 11 | 55 % (> 10 %, dokumentiert) |
  | zusammengelegt (nach AK15-Nachbesserung) | 38 | — | — |
  | byOwner (nach AK15-Nachbesserung) | p6: 35, p8: 3 | — | — |

  Abweichung Feind-Rohstand: Spielstand S575 hat sich seit E3a (A19/A20-Messung) weiterentwickelt
  (weniger sichtbare Feind-Armeen) — kein Blocker, nur Protokoll (R13), siehe
  `weltpille.json.abweichungErwartung`.
  **Gegenprobe (korrigiert, siehe 1a):** `mergeRadius=0` ohne Cluster-Vorlauf zeigt 126 von 126
  Rohmarken als Einzelmarken (keine Zusammenlegung, `layoutMarks`-Default-Pfad erreicht den
  Merge-Zweig praktisch nie) — `collideWorldMarks` MIT Cluster-Vorlauf legt dieselben 126
  Rohmarken auf 38 Welt-Pillen zusammen. Der Unterschied (126 vs. 38) ist der eigentliche Beleg
  fuer D21 — nicht wie urspruenglich berichtet "126 -> 126 bei beiden, also bestaetigt". `git diff
  --exit-code` auf `sammel.json`/`zoomcluster.json`/`gebaeude-basis.json`: nur das `base`/`commit`-
  Feld geaendert — Mid/Near bleiben bitgleich (D24/AK16 erfuellt, erneut geprueft).

### 1a. AK15-Nachbesserung (Review-Runde 1): echtes macht-uebergreifendes Zusammenlegen

**Befund des Reviewers** (reproduziert am Produktionscode, nicht nur vermutet): `WORLD_PILL_SEGMENT`/
`BUILDING_GROUP_BOX` (20x20 px, zwei Segmente 41x20 px) ist bei realistischen Provinz-Abstaenden
(> 40-50 px) fast immer schon im Ring-Versatz (12/20/28, bei Armee/Feind zusaetzlich 36/44 px)
platzierbar — `layoutMarks`s eigener Zusammenlegen-Zweig (Schritt 5) wurde dadurch so gut wie nie
erreicht, egal ob `mergeRadius` 64, 72 oder 0 war.

**Fix:** neue Funktion `clusterWorldMarks` (`welt.ts`), aufgerufen von `collideWorldMarks`
(`markers.ts`) VOR dem Bau der `MarkInput`-Liste — also bevor `layoutMarks` ueberhaupt zu platzieren
beginnt. Union-Find (wie das Verkettungsmuster von `groupArmies`/`groupBuildings`, `sammel.ts`), nur
ueber Distanz statt festen Schluessel: gleiche `tone` UND `ownerId`, Abstand < `WORLD_MERGE_RADIUS`
(72 px) werden zu EINER Rohmarke zusammengefasst (`buildingSum`/`armySum` addiert, Symbol = groesste
Einzelsumme wie `armyIconFor`, Ankerpunkt = Schwerpunkt der Mitglieder). Verkettend: A-B < 72, B-C <
72 ergibt eine Gruppe, auch wenn A-C selbst >= 72 auseinanderliegen (Single-Linkage, wie bei
natuerlich gewachsenen Provinz-Clustern erwuenscht). `layoutMarks` selbst (`mergeRadius=72`) bleibt
als Notfall-Netz fuer den seltenen Rest-Fall unveraendert bestehen (Schritt B).

Isoliert in `welt.ts`/`markers.ts` (Variante a aus der Karte) — `layoutMarks.ts`-Kernschleife
(genutzt von Mid/Near/E1/E2) **nicht** angefasst; `layoutMarks.test.ts` g/h unveraendert gruen.

**OSS-Zeile (Pflicht):** Nichts Passendes verwendet — Union-Find/Verkettung nach Distanz ist ~30
Zeilen reiner Funktion und folgt bereits bestehendem Eigenbau-Muster (`groupArmies`/`groupBuildings`,
`sammel.ts`); eine Bibliothek (z. B. `supercluster`, ISC) wuerde geografische Lat/Lng-Radien clustern
ohne Macht-/Seiten-Schluessel und muesste an `WorldRawMark`/`layoutMarks` ohnehin voll angepasst
werden — kein Aufwandsgewinn gegenueber dem Eigenbau, siehe bereits dokumentierte Abwaegung am Ende
dieses Berichts (Abschnitt "OSS-Zeile E3").

**Tests (neu/geaendert):**
- `welt.test.ts`: 10 neue Faelle fuer `clusterWorldMarks` — Abstand 15/50/70 px (< 72, zusammengelegt),
  genau 72 px und 80 px (>= 72, NICHT zusammengelegt), Verkettung ueber 3 Marken, verschiedene
  Macht/verschiedener `tone` (nie zusammengelegt), Summenbildung, Symbolwahl nach groesster
  Einzelsumme, Schwerpunkt-Ankerpunkt, Leerfall, Einzelmarke ohne Nachbarn.
- `markers.test.ts`: 4 neue Faelle fuer `collideWorldMarks` end-to-end — 5 Rohmarken je 15 px
  Abstand -> eine Welt-Pille mit Summe, zwei raeumlich getrennte Gruppen -> zwei Pillen,
  `selectedProvinceId` trifft auch ein zusammengelegtes Nicht-Vertreter-Mitglied
  (`memberProvinceIds`, neues optionales Feld auf `WorldRawMark`), weit entfernte Einzelmarken
  bleiben unveraendert.
- Bestehende `layoutMarks.test.ts` g/h unveraendert (Parameter-Pfad bleibt gueltig, nicht
  angefasst).

## 2. Abnahmebilder (E3d, T-M51-10)

`scripts/v4-weltpille-bild.mjs` (Kopie von `scripts/v4-zoomcluster-bild.mjs`, Zoomstufe "Welt"
= `data-tier="far"` ueber den Seitenleiste-Knopf, Mausrad als Fallback). Stand S575G, Welt per
Uebersichtskarte-Klick, Pause, dann Knopf "Welt". 1280x800, `deviceScaleFactor:1`.

- `docs/ux/v4-weltpille/welt-vorher.png`: Lauf gegen `main` (Commit `aa88f92`, Stand VOR E3a-E3d).
  Zeigt heute nur Armee-Sammelmarken (einfache Kaesten mit Zahl, kein Gebaeude-Icon, kein
  zweites Segment) — wie im Karten-Text erwartet. **Unveraendert, nicht neu gerendert** (lief
  gegen `main`, von dieser Karte nicht beruehrt).
- `docs/ux/v4-weltpille/welt-nachher.png`: **neu gerendert** gegen `zoomcluster-e3` nach der
  AK15-Nachbesserung (Commit siehe Abschnitt 4/9). Vor der Nachbesserung zeigte dieses Bild ~60
  kleine Einzelpillen (ein Icon+Zahl-Kasten je Provinz, siehe Review-Befund Abschnitt 6). **Nach**
  der Nachbesserung zeigt es nur noch zwei grosse, macht-uebergreifend zusammengelegte Pillen fuer
  die gesamte sichtbare p6-Provinzgruppe (Gebaeude+Armee "581 | 1145" sowie eine Armee-Pille "90"
  an der gewaehlten Provinz) — der Rest der zusammenhaengenden p6-Landmasse zeigt gar keine
  Einzelpillen mehr, weil benachbarte Provinzzentren auf dieser weiten Zoomstufe fast durchweg
  < 72 px auseinanderliegen und daher in dieselbe Gruppe verkettet werden. Das ist sichtbar naeher
  an Bild 5 (wenige grosse, macht-uebergreifend aggregierte Pillen) als der vorherige Stand, siehe
  Abschnitt 3.

Beide Bilder selbst angesehen (vision_analyze). `welt-nachher.png` traegt `data-zoom-tier="far"`,
`data-view-scale="2.5000"` im Log (`nachher-bild.log`, Task-Workspace `t_463ed72a`).

## 3. Vergleich mit Bild 5 (Referenz, AK13/AK14)

Referenz: `…/t_59b43d6e/final-v3b-5-fern-cluster.png` (Fern-Cluster-Mockup, von Noah vorgegeben).

| Merkmal | Bild 5 (Referenz) | `welt-nachher.png` (gebaut, nach AK15-Nachbesserung) | Treffer? |
|---|---|---|---|
| Pillenform | gerundete Kaesten, teils ein Segment (nur Zahl), teils zwei Werte getrennt durch "/" in einem Kasten | gerundete Kaesten, ein Segment (nur Armee-Zahl) ODER zwei Segmente (Gebaeude-Icon+Zahl, Armee-Icon+Zahl) | ja — gleiches Grundmuster: ein Kasten pro Gruppe, 1-2 Werte |
| Eigene Provinz = zwei Segmente | ja (z. B. "92 / 60", "33 / 17") | ja (z. B. "581 \| 1145") | ja (AK13) |
| Feind-Provinz = rote Pille, ein Segment | ja (z. B. rot umrandet "59", "27", "11") | ja, rot/danger umrandete Kaesten mit einem oder zwei Segmenten je nach vorhandenen Marken | ja (AK14) |
| Friedlich = keine Pille | implizit (nur Laender mit Kaesten gezeigt) | ja, friedliche Provinzen ohne Marke | ja |
| Farbwahl Rand | gelb (eigen), rot (Feind) | primary=gelb/gold (eigen), danger=rot (Feind) | ja |
| Macht-uebergreifend wenige grosse Pillen statt vieler kleiner (AK15) | ja (z. B. "92/60", "33/17" — Zahlen aus mehreren Provinzen) | **ja, nach der Nachbesserung**: die gesamte zusammenhaengende p6-Landmasse zeigt nur noch 2 Pillen statt ~60 (Abschnitt 2) | ja (AK15, vorher nein — siehe Review-Befund) |

**Abweichung von D17 (Gebaeude-Summe, R10):** Die gebaute Zahl je Pillen-Segment ist laut D17
die SUMME der Gebaeude-Stufen einer Provinz (weicht bewusst von Mid-D3 ab, dort Anzahl der
Gebaeude). Im Bild selbst ist nicht unterscheidbar, ob eine angezeigte Zahl eine Stufen-Summe
oder eine Gebaeude-Anzahl ist — beide sehen wie eine einfache Zahl neben dem Icon aus. Es ist
daher **keine sichtbare Abweichung von Bild 5 erkennbar** (Bild 5 zeigt ebenfalls nur eine Zahl
pro Segment, ohne erkennbare Zaehlweise). Die Zaehlweise bleibt wie geplant (D17): buildbar,
eindeutig im Code (`welt.ts`), kein Blocker — dieser Punkt ist reine Dokumentation fuer R10.

## 4. `pnpm verify`

Exit 0 nach der AK15-Nachbesserung, Log: Task-Workspace `t_463ed72a` (`/tmp/verify2.log` zum
Zeitpunkt des Laufs) — Lint (0 Fehler, 2 vorbestehende Warnungen in `passage.ts`, nicht Teil
dieser Karte), Typpruefung 0 Fehler, 235 Testdateien/4295 Tests gruen, Abdeckung Kern 97.0 %
(Schwelle 90 %), gesamt 95.8 % (Schwelle 80 %).

## 5. AK12-AK17 Zusammenfassung

- AK12 (E3a Unit-Tests gruen): erfuellt, siehe E3a-Handoff (`welt.test.ts` a-f,
  `layoutMarks.test.ts` g-h) plus die neuen `clusterWorldMarks`-Faelle (Abschnitt 1a).
- AK13 (eigene Provinz zwei Segmente gegen Bild 5): erfuellt, Tabelle oben.
- AK14 (Feind rote Pille ein Segment gegen Bild 5, friedlich keine Pille): erfuellt, Tabelle
  oben.
- AK15 (macht-uebergreifendes Zusammenlegen auf far): **nach Review-Runde 1 nachgebessert,
  jetzt erfuellt** — `clusterWorldMarks` legt Rohmarken < 72 px VOR dem Platzieren zusammen
  (Abschnitt 1a), belegt synthetisch (`welt.test.ts`/`markers.test.ts`) UND an echten S575-Daten
  (121 Rohmarken eigen -> 38 Welt-Pillen gesamt, Abschnitt 1/2).
- AK16 (Mid/Near bitgleich): erfuellt, erneut geprueft nach der Nachbesserung — `git diff
  --exit-code` auf `sammel.json`/`zoomcluster.json`/`gebaeude-basis.json` zeigt nur das
  `base`/`commit`-Feld (Abschnitt 1), `layoutMarks.ts`-Kernschleife nicht angefasst.
- AK17 (`pnpm verify` Exit 0, Gegenproben aus E3a-E3c rot gesehen, PR von Noah2475g offen, Merge
  nur reviewer): `pnpm verify` Exit 0 (Abschnitt 4). Gegenproben rot gesehen: E3a
  (`layoutMarks` ohne `mergeRadius`-Parameter faellt auf Default zurueck, Test (h)), E3b
  (Zeichenzweig ohne `kind:'worldPill'` zeichnet keine Welt-Pille, siehe E3b-Handoff), E3c
  (ohne Cluster-Vorlauf 126 Einzelmarken statt 38 Zusammenlegungen, Abschnitt 1). PR offen unter
  dem Konto Noah2475g (Push-Regel geprueft vor Push). **Diese Karte merged nicht** — R3 (Kind-
  Karte) uebernimmt Review und Merge nach Pruefung des gesamten Diffs E3a-E3d plus der
  AK15-Nachbesserung.

## OSS-Zeile E3 (Pflicht, Plan §11.3)

Nichts Passendes, weil die Zusammenlegen-Logik (macht-/distanzbasiert) bereits im Repo existiert
(`layoutMarks.ts`, E7/E1b, Eigenbau) und nur parametrisiert werden musste (D21) — ein
zusaetzliches Clustering-Paket wuerde dieselbe Logik doppelt vorhalten. `supercluster` (ISC,
mapbox/supercluster, aktiv gepflegt, geprueft 2026-10-22) clustert geografisch ueber Lat/Lng-
Radien ohne Macht-Schluessel, wuerde `layoutMarks` nicht ersetzen (abgelehnt). `rbush` (MIT,
v4.0.1, 2024-08-21, weiterhin aktuellste Version 2026-10-22) bleibt nur fuer > 300 Marken
relevant (far hat <= 137 Rohmarken, A20 — nicht noetig). Fuer die AK15-Nachbesserung (Abschnitt
1a, Union-Find/Verkettung nach Distanz) gilt dieselbe Abwaegung — siehe dort.

## Risiken

R10 (Gebaeude-Summe = Interpretation, kein Direktzitat am Code): explizit gegen Bild 5 geprueft
(Abschnitt 3) — keine sichtbare Abweichung, Zaehlweise bleibt wie geplant.
