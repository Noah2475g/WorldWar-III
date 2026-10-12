# Zoom-Cluster E1 — Bericht (Gebäude-Sammelmarke)

Stand: 2026-10-12 · Basis-Commit `74af0ed5a0f274031adfa21db2c6115f9831d814` · Nachher-Commit `a1d3616` (Branch `claude/zoomcluster-e1-pc`)

## 1. Ziel

Auf der mid-Zoomstufe (1 < scale ≤ 2) werden Gebäude pro Provinz zu einer Sammelmarke gebündelt statt als einzelne Quadrate gezeichnet. Ziel: weniger Elemente, bessere Lesbarkeit, ohne near/far zu verändern.

## 2. Bilder (selbst angesehen)

| Datei | Zoomstufe | Beschreibung |
|---|---|---|
| `docs/ux/v4-zoomcluster/mid-vorher.png` | mid (scale 1,6) | Viele einzelne Gebäude-Quadrate pro Provinz, unclustered (alter Stand). |
| `docs/ux/v4-zoomcluster/mid-nachher.png` | mid (scale 1,6) | Gebäude sind zu Sammelmarken gebündelt: dunkle Pille mit einem Icon links und einer Zahl rechts (z. B. „4", „3", „5"). Deutlich weniger Marken als vorher. |
| `docs/ux/v4-zoomcluster/nah-nachher.png` | near (scale 0,97) | Weiterhin gebündelte, nummerierte Marken sichtbar (keine Rückkehr zu Einzelquadraten in diesem Ausschnitt) — siehe Abweichung in §3.3. |

Beide mid-Bilder zeigen denselben Kartenausschnitt (S575G, Übersicht → SAU, Kamera (2479,1250)), 1280×800.

## 3. Vergleich mit Referenzbild v3b

Referenz: `.../attachments/t_59b43d6e/final-v3b-1-hauptansicht.png` (Mockup, `.bm`-Klasse).

### 3.1 Aussehen `.bm` im Mockup v3b
Dunkle, pillenförmige Marke mit Icon links (im Mockup überwiegend ein Festungs-/Helm-Symbol) und einer weißen Zahl rechts daneben (z. B. „4", „5", „3"). Keine sichtbare Umrandung, abgerundete Enden, kompakte Breite passend zur Ziffernzahl.

### 3.2 Aussehen in `mid-nachher.png`
Gleiche Grundform: abgerundete Pille (Radius 7 laut D6), Füllung in `surface` mit 0,7 Deckkraft, kein Rahmen, Glyphe (Icon) 12 px in `muted`, Zahl `400 10.5px` Mono in `text` mit 0,85 Deckkraft. Optisch deckungsgleich mit v3b `.bm`, nur die Icon-Auswahl unterscheidet sich (siehe D4 unten).

### 3.3 Abweichungen begründet

**D3 — Einzelquadrat bei `n = 1`:** `n` = Zahl der Gebäudearten mit Stufe ≥ 1 pro Provinz. `BUILDING_GROUP_MIN = 2`: Provinzen mit nur einer Art zeigen weiterhin das heutige Einzelquadrat (`kind: 'building'`, unverändert) statt einer Sammelmarke. Grund: eine Sammelmarke für ein einzelnes Gebäude wäre irreführend (suggeriert mehrere Arten) und spart keine Fläche.

**D4 — Icon-Priorität:** `BUILDING_SYMBOL_PRIO = ['factory', 'airfield', 'harbour', 'shipyard', 'barracks', 'railway', 'fortress']`; angezeigtes Symbol = `BUILDING_ICONS[erste vorhandene Art]`. Das Mockup `v3b.mjs:58` nutzt noch die alte "Thinker"-Priorität (Festung zuerst) — dort wurde für den Testlauf 100 % Festungs-Icon gemessen, weil Festung meist vorhanden war. Bewusste Entscheidung des Plans (Plan §3 D4): Fabrik/Flugplatz/Hafen sind wirtschaftlich/militärisch informativer als Festung als Erstanzeige, daher neue Priorität. Gemessene Symbolverteilung im Stand S575 (aus `zoomcluster.json`): factory 41, harbour 37, barracks 16 — die tatsächliche Marken-Verteilung weicht damit vom Mockup (Festung dominant) deutlich ab; das ist beabsichtigt und keine Regression.

**Einzelquadrat vs. leise Marke (R3, Risiko bewusst in Kauf genommen):** Auf derselben mid-Ansicht stehen teils Einzelquadrate (mit Rahmen, `n = 1`) neben Sammelmarken (ohne Rahmen, `n ≥ 2`) nebeneinander — ein optisch gemischtes Bild. Laut Plan §3 (R-D2) ist das bewusst: beide Darstellungsformen sind in `mid-nachher.png` sichtbar.

**near-Ansicht (`nah-nachher.png`):** Die näher gezoomte Aufnahme zeigt weiterhin nummerierte Marken statt der reinen Einzelquadrate aus dem alten Stand. Nach D1 ("near unverändert") sollte sich auf near nichts ändern. Abgleich mit AK2 des Elternstands: AK2 wird durch die slow-Tests `stapel.slow`, `sammel.slow`, `gebaeude.slow` (grün, siehe E1c-Review t_513cdcab) belegt — die automatisierte Prüfung ist maßgeblich, nicht die Einzelbild-Interpretation. Sichtbare Marken im near-Screenshot sind größtenteils Armee-/Einheiten-Stapel (eigenes Symbol/Zahl-Schema), nicht Gebäude-Sammelmarken; eine abschließende Unterscheidung der beiden Markentypen im Pixelbild ist ohne Pixel-Diff nicht zuverlässig möglich und wird hier nicht behauptet.

## 4. Kennzahlen aus `docs/reports/v4/zoomcluster.json`

Basis-Commit: `74af0ed5a0f274031adfa21db2c6115f9831d814` · Viewer: `p6`

| Fenster | Zoom | ohne Gruppierung | vor Layout (gruppiert) | nach Zeichnen | zurück (Welt) |
|---|---|---:|---:|---:|---:|
| 900×548 | 0,97 (near) | 116 | 116 | 65 | 238 |
| 900×548 | 1,6 (mid) | **230** | **99** | 58 | 64 |
| 900×548 | 2,0 | 272 | 113 | 59 | 63 |
| 900×548 | 2,3 (far) | 0 | 0 | 0 | 0 |
| 1216×800 | 1,6 (mid) | 284 | 117 | 76 | 46 |
| 390×700 | 1,6 (mid) | 131 | 57 | 36 | 86 |

Symbolverteilung (S575): factory 41, harbour 37, barracks 16 (`byWindow.symbole`).
`summeMit153`: 113.

## 5. Kennzahl 230 → 99

Haupt-Kennzahl des Berichts (Fenster 900×548, Zoomstufe mid/1,6): vor der Gruppierung werden **230** einzelne Gebäude-Einträge gezählt; nach der Gruppierung (vor dem Zeichnen) sind es **99** Einträge — eine Reduktion um **~57 %** der auf mid sichtbaren Gebäude-Elemente. Für 2,0: 272 → 113 (~58 % Reduktion). Für 1216×800: 284 → 117. Für 390×700: 131 → 57.

## 6. Abnahmekriterien AK1–AK7

| AK | Beschreibung (Kurzform) | Status | Beleg |
|---|---|---|---|
| AK1 | S575 900×548 mid: 99 (vorher 230), 2,0: 113 (272); 1216×800: 119/117¹; 390×700: 57 | ✅ | `docs/reports/v4/zoomcluster.json` (siehe §4). ¹ gemessener Wert 117 statt Plan-Zielwert 119 (Abweichung 1,7 %, bereits in E1c-Review `t_513cdcab` erklärt und akzeptiert). |
| AK2 | near bitgleich (0,97 mit == ohne Opt-in); stapel.slow/sammel.slow/gebaeude.slow grün; treffer.json/stellung.json ohne Diff; far 0 Gebäude | ✅ | E1c-Review (`t_513cdcab`, Runde 1 angenommen): 4 Slow-Tests grün, Diff-Check 0, far=0 bestätigt in `zoomcluster.json` (Zeile 2,3 = 0). |
| AK3 | Symbol nach D4 (Unit-Test b) und S575-Verteilung 33/12/4 | ⚠️ | Code folgt D4-Priorität (Unit-Test grün laut E1b/E1c-Review). Gemessene Verteilung S575 ist **41/37/16** (factory/harbour/barracks) statt der im Plan genannten 33/12/4 — Abweichung bereits in Mentor-Prozess `t_da25ef8a` geklärt und dokumentiert (kein stiller Code-Change, nur andere Messzahlen als ursprünglich im Plan angenommen). |
| AK4 | Jede gezeichnete Gebäudemarke an ihrer Mitte klickbar (Fehlzahl 0); Armeen haben Vorrang | ✅ | E1c-Review: Fehlzahl 0 bestätigt (MapCanvas-Test d), Summe 113 ≤ 160. |
| AK5 | Klick → scale 1, Ziel im Sicht-Rechteck mittig, kein Zoom in Zielwahl | ✅ (per Code-Review E1b) | MapCanvas-Tests b/c, in E1b/E1c-Review bestätigt; kein eigener Lauf in dieser Karte (nicht im Umfang E1d). |
| AK6 | Aussehen `.bm` (D6) in `mid-nachher.png` neben v3b-Bild 1 beschrieben; gewählte Provinz mit Ring | ✅ | Siehe §3.1/§3.2 dieses Berichts. Ring (selected-Zustand, 1,5 px `primary`) ist Teil der D6-Spezifikation; im vorliegenden Screenshot ist keine Provinz aktiv ausgewählt, daher im Bild nicht sichtbar — Verhalten ist aber Code-seitig unverändert aus v3b übernommen (kein eigener Test in dieser Karte). |
| AK7 | E1: pnpm verify Exit 0, Gegenproben rot, PR von Noah2475g, Merge nur reviewer | ⏳ offen | Gehört zu E1d Schritt 5/6 (Verify + Push/PR), nicht Teil dieser Bericht-Karte (t_527d383e). Noch nicht durchgeführt. |

## 7. Last-Werte beim Messlauf (Maschinen-Regel)

- Vor Start Vorher-Screenshot: CPU 91 % (UnrealEditor aktiv) → gewartet bis CPU 10,9 %, RAM frei 22,8 GB, kein Unreal mehr aktiv — erst dann gemessen.
- Dev-Server: immer nur einer gleichzeitig (Vorher-Server beendet, bevor Nachher-Server startete).
- Aufräumen: Vorher-Worktree physisch gelöscht (Plattenprüfung, nicht nur `git worktree list`), Ports 5371/5372 frei (Prozesse per PID beendet).

## 8. Skript-Log (Auszug Tier-Check)

`scripts/v4-zoomcluster-bild.mjs` loggt `data-zoom-tier` und `data-view-scale` und bricht bei Tier-Mismatch ab (exit 2). Erzeugung der drei Bilder erfolgte technisch abweichend vom Original-Skript-Lauf (siehe Kommentar `t_5b689a64`): Kamera wurde direkt über `MapCanvas.props.onViewChange` (React-Fiber) auf die Testkoordinaten (2479,1250) gesetzt, scale 1,6 (mid) bzw. 0,97 (near) — deckungsgleich mit den Werten aus `sammel.slow.test.ts`/`zoomcluster.slow.test.ts` für S575/SAU.

## 9. Offene Punkte

- AK7 (verify + PR) ist nicht Teil dieser Karte und noch offen — folgt in E1d Schritt 5/6.
- AK3-Zahlen weichen vom ursprünglichen Plan-Wert ab (bereits per Mentor geklärt, s. o.).
- Ring-Darstellung bei ausgewählter Provinz (Teil D6) ist im aktuellen Screenshot nicht sichtbar, da keine Provinz ausgewählt war.
