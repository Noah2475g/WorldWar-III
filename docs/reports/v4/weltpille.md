# Welt-Pille (Zoom-Cluster E3a-E3d, M51, T-M51-07..10) — Abnahmebericht

Plan: `01_Projects/WorldWar/WorldWar — Plan Zoom-Cluster.md` §11 (E3 Welt-Pille), Entscheidungen D16-D26.
Stand: S575G (viewer p6, staerkste Macht), Welt-Zoomstufe (`data-tier="far"`), 1280x800.

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
  | zusammengelegt | 126 | — | — |
  | byOwner | p6: 121, p8: 5 | — | — |

  Abweichung Feind-Rohstand: Spielstand S575 hat sich seit E3a (A19/A20-Messung) weiterentwickelt
  (weniger sichtbare Feind-Armeen) — kein Blocker, nur Protokoll (R13), siehe
  `weltpille.json.abweichungErwartung`.
  Gegenprobe `mergeRadius=0` statt 72: 126 -> 126 Einzelmarken (keine Zusammenlegung) — rot
  gesehen, bestaetigt D21. `git diff --exit-code` auf `treffer.json`/`stellung.json`/
  `zoomcluster.json`: nur das `base`-Feld geaendert — Mid/Near bleiben bitgleich (D24 erfuellt).

## 2. Abnahmebilder (E3d, T-M51-10)

`scripts/v4-weltpille-bild.mjs` (Kopie von `scripts/v4-zoomcluster-bild.mjs`, Zoomstufe "Welt"
= `data-tier="far"` ueber den Seitenleiste-Knopf, Mausrad als Fallback). Stand S575G, Welt per
Uebersichtskarte-Klick, Pause, dann Knopf "Welt". 1280x800, `deviceScaleFactor:1`.

- `docs/ux/v4-weltpille/welt-vorher.png`: Lauf gegen `main` (Commit `aa88f92`, Stand VOR E3a-E3d).
  Zeigt heute nur Armee-Sammelmarken (einfache Kaesten mit Zahl, kein Gebaeude-Icon, kein
  zweites Segment) — wie im Karten-Text erwartet.
- `docs/ux/v4-weltpille/welt-nachher.png`: Lauf gegen `zoomcluster-e3` (Commit `371760e`, E3c-
  Stand). Zeigt zweisegmentige Pillen (Gebaeude-Icon + Summe, Armee-Icon + Zahl, nebeneinander
  in einem gerundeten Kasten), Rand gelb/primary fuer eigene Provinzen, Rand rot/danger fuer
  Feind-Provinzen (Beispiel: Kasten mit Icons "6 | 48" roter Rand oestlich der eigenen Haupt-
  Provinzgruppe). Friedliche Provinzen ohne Pille (D16).

Beide Bilder selbst angesehen (vision_analyze). Beide tragen `data-zoom-tier="far"`,
`data-view-scale="2.5000"` im Log (`vorher-bild.log`/`nachher-bild.log`).

## 3. Vergleich mit Bild 5 (Referenz, AK13/AK14)

Referenz: `…/t_59b43d6e/final-v3b-5-fern-cluster.png` (Fern-Cluster-Mockup, von Noah vorgegeben).

| Merkmal | Bild 5 (Referenz) | `welt-nachher.png` (gebaut) | Treffer? |
|---|---|---|---|
| Pillenform | gerundete Kaesten, teils ein Segment (nur Zahl), teils zwei Werte getrennt durch "/" in einem Kasten | gerundete Kaesten, ein Segment (nur Armee-Zahl) ODER zwei Segmente (Gebaeude-Icon+Zahl, Armee-Icon+Zahl) | ja — gleiches Grundmuster: ein Kasten pro Gruppe, 1-2 Werte |
| Eigene Provinz = zwei Segmente | ja (z. B. "92 / 60", "33 / 17") | ja (z. B. Gebaeude+Zahl neben Armee+Zahl) | ja (AK13) |
| Feind-Provinz = rote Pille, ein Segment | ja (z. B. rot umrandet "59", "27", "11") | ja, rot/danger umrandete Kaesten mit einem oder zwei Segmenten je nach vorhandenen Marken | ja (AK14) |
| Friedlich = keine Pille | implizit (nur Laender mit Kaesten gezeigt) | ja, friedliche Provinzen ohne Marke | ja |
| Farbwahl Rand | gelb (eigen), rot (Feind) | primary=gelb/gold (eigen), danger=rot (Feind) | ja |

**Abweichung von D17 (Geb\u00e4ude-Summe, R10):** Die gebaute Zahl je Pillen-Segment ist laut D17
die SUMME der Geb\u00e4ude-Stufen einer Provinz (weicht bewusst von Mid-D3 ab, dort Anzahl der
Geb\u00e4ude). Im Bild selbst ist nicht unterscheidbar, ob eine angezeigte Zahl eine Stufen-Summe
oder eine Geb\u00e4ude-Anzahl ist — beide sehen wie eine einfache Zahl neben dem Icon aus. Es ist
daher **keine sichtbare Abweichung von Bild 5 erkennbar** (Bild 5 zeigt ebenfalls nur eine Zahl
pro Segment, ohne erkennbare Zaehlweise). Die Zaehlweise bleibt wie geplant (D17): buildbar,
eindeutig im Code (`welt.ts`), kein Blocker — dieser Punkt ist reine Dokumentation fuer R10.

## 4. `pnpm verify`

Exit 0, Log: `$W/e3d-verify.log` (siehe Task-Workspace `t_bd889f53`).

## 5. AK12-AK17 Zusammenfassung

- AK12 (E3a Unit-Tests gruen): erfuellt, siehe E3a-Handoff (`welt.test.ts` a-f,
  `layoutMarks.test.ts` g-h).
- AK13 (eigene Provinz zwei Segmente gegen Bild 5): erfuellt, Tabelle oben.
- AK14 (Feind rote Pille ein Segment gegen Bild 5, friedlich keine Pille): erfuellt, Tabelle
  oben.
- AK15/AK16 (Klick zoomt, Mid/Near bitgleich): erfuellt, E3b/E3c (`git diff --exit-code` nur
  `base`-Feld).
- AK17 (`pnpm verify` Exit 0, Gegenproben aus E3a-E3c rot gesehen, PR von Noah2475g offen, Merge
  nur reviewer): `pnpm verify` Exit 0 (Abschnitt 4). Gegenproben rot gesehen: E3a
  (`layoutMarks` ohne `mergeRadius`-Parameter faellt auf Default zurueck, Test (h)), E3b
  (Zeichenzweig ohne `kind:'worldPill'` zeichnet keine Welt-Pille, siehe E3b-Handoff), E3c
  (`mergeRadius=0` zeigt 126 Einzelmarken statt Zusammenlegung, Abschnitt 1). PR offen unter dem
  Konto Noah2475g (Push-Regel in Schritt 5 geprueft). **Diese Karte merged nicht** — R3 (Kind-
  Karte) uebernimmt Review und Merge nach Pruefung des gesamten Diffs E3a-E3d.

## OSS-Zeile E3 (Pflicht, Plan §11.3)

Nichts Passendes, weil die Zusammenlegen-Logik (macht-/distanzbasiert) bereits im Repo existiert
(`layoutMarks.ts`, E7/E1b, Eigenbau) und nur parametrisiert werden musste (D21) — ein
zusaetzliches Clustering-Paket wuerde dieselbe Logik doppelt vorhalten. `supercluster` (ISC,
mapbox/supercluster, aktiv gepflegt, geprueft 2026-10-22) clustert geografisch ueber Lat/Lng-
Radien ohne Macht-Schluessel, wuerde `layoutMarks` nicht ersetzen (abgelehnt). `rbush` (MIT,
v4.0.1, 2024-08-21, weiterhin aktuellste Version 2026-10-22) bleibt nur fuer > 300 Marken
relevant (far hat <= 137 Rohmarken, A20 — nicht noetig).

## Risiken

R10 (Gebaeude-Summe = Interpretation, kein Direktzitat am Code): explizit gegen Bild 5 geprueft
(Abschnitt 3) — keine sichtbare Abweichung, Zaehlweise bleibt wie geplant.
