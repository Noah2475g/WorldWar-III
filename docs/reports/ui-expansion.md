# Ausbau der Oberfläche — was sich gemessen geändert hat

**Stand:** 2026-09-04 · Meilenstein M13 (17 Aufgaben) · Branch `claude/game-ui-expansion-4dd9fe`

Dieser Bericht hält fest, was der Ausbau bewirkt hat — in Zahlen, die man nachrechnen kann,
nicht in Bildschirmfotos. Ein Foto zeigt, dass etwas anders aussieht; es sagt nicht, ob es
weniger Text geworden ist.

## 1. Der Befund, mit dem M13 begann

Drei fertige, getestete Bausteine waren in keiner Zeile der laufenden Anwendung eingebunden:

| Baustein | Gebaut in | Zustand vor M13 |
|---|---|---|
| Symbolsatz `ui/icons.tsx` | T-M11-01 | von keiner Datei außer den eigenen Tests importiert |
| Ton `ui/sound.ts` | T-M11-02 | dito — die Toneinstellung im Menü hatte keine Wirkung |
| Einstiegshilfe `game/tutorial.ts` | T-M12-02b | dito — kein Spieler hat je einen Schritt gesehen |

Alle drei Anforderungen galten über ihre Modultests als belegt. Dazu kamen ein Kartenmodus
ohne Datengrundlage, ein Autosave-Intervall ohne Autosave und ein Ereignisprotokoll ohne den
Filter, den R-GAME-06 seit M5 verlangt.

## 2. Zahlen

| Größe | Vorher | Nachher | Quelle |
|---|---|---|---|
| Module der Anwendung, die `main.tsx` nicht erreicht | 3 (+ 3 begründete Ausnahmen) | 0 | `test/guards/ui-reachability.test.ts` |
| Sichtbare Textzeichen im Provinzpanel (gleiche Provinz, gleiche Befehle) | 864 | 587 (−32 %) | `Panels.test.tsx`, „bleibt knapp" |
| Absagegründe unter einer Aushebegruppe mit fünf gesperrten Knöpfen | 5 | 2 | dieselbe Datei |
| Symbole im Regelabgleich ohne Zuordnung | 6 Einheiten, 1 Gebäude, 7 Rohstoffe | 0 | `icons.test.tsx` |
| Symbolzuordnungen, die es in den Regeln gar nicht gibt | 3 (`cavalry`, `submarine`, `mine`) | 0 | dieselbe Datei |
| Kartenmodi mit Datengrundlage | 3 von 4 | 4 von 4 | `modes.test.ts`, R-MAP-07 |
| Erklärungen für Dinge der Oberfläche | 0 | 39 | `Explain.test.tsx` |
| Grafische Anzeigen statt reiner Zahlen | 0 | 6 Arten (Moral, Bau, Aushebung, Marsch, Siegziel, Punktestand) | `Meter.test.tsx` u. a. |
| Tests gesamt | 947 | 1086 | `pnpm verify` |
| Testabdeckung Kern / gesamt | 96,1 % / 93,5 % | 96,1 % / 93,5 % | `pnpm verify` |
| Anforderungen mit Testbeleg | 74 von 74 | 82 von 82 | `pnpm coverage:requirements` |

## 3. Was jetzt auf dem Bildschirm steht und vorher nicht

- **Karte:** Provinznamen ab Zoomstufe 2,0, Legende zum Kartenmodus, Hauptstadtstern,
  Kampfring mit Säbeln (atmend), Armeekasten mit dem Zeichen der stärksten Gattung,
  Marschweg der gewählten Armee.
- **Kopfleiste:** Rohstoffsymbole, Reichweite in Tagen bei schrumpfendem Vorrat,
  Siegzielbalken, Knopf für die Lageübersicht.
- **Provinzpanel:** Moral als Balken mit Trendpfeil, Vorkommen und Gebäude als Symbolzeilen,
  Bau- und Aushebefortschritt als Balken mit Restzeit, Erklärzeichen an jedem Befehl.
- **Neu:** Meldungen (Kampf, verlorene Hauptstadt, Mangel, Aufstandsgefahr) mit Sprungziel,
  Lageübersicht (`L`), Abschlussfenster, Ereignisfilter, Ton, Einstiegshilfe, Autosave.

## 4. Befunde aus der Sichtprüfung im laufenden Programm

Vier Dinge fielen erst am Bildschirm auf und wurden sofort behoben:

1. **Die Karte blieb beim Spielstart namenlos.** Die Zoomschwelle lag bei 1,2, das Spiel
   öffnet bei 1,6. Schwelle auf 2,0 — die Regel „kein Name breiter als seine Provinz"
   filtert ohnehin, was nicht hineinpasst.
2. **Die Erklärzeichen standen unter den Knöpfen** statt daneben und bildeten eine Reihe
   einsamer Kreise. Knopf und Zeichen sitzen jetzt in einer Zeile.
3. **In der Lagetabelle stand jeder Name doppelt** — einmal in der Spalte, einmal als
   Beschriftung des Balkens. Der Balken trägt seinen Namen jetzt nur noch für
   Vorleseprogramme.
4. **Die leere Balkenspur war vom Panel kaum zu unterscheiden** (1,27:1). Sie bekam einen
   Umriss; ein Balken bei null ist jetzt leer und nicht unsichtbar.

## 5. Was gemessen unverändert blieb

- **Zeichenbudget der Karte:** Der Renderbenchmark hält 16,7 ms auch mit Beschriftung; die
  Namen bekamen einen eigenen Messfall (`render.bench.slow.test.ts`).
- **Der Nebel:** Jedes neue Feld der Sicht ist auf eigene Provinzen bzw. gesehene Orte
  beschränkt, und alle sind optional — die KI fragt die Sicht ohne Regeln ab und zahlt
  nichts für Anzeigen, die sie nicht liest.
- **Die freigegebene Gestaltung:** keine neue Farbe. Jede Anzeige nimmt ein Token aus der
  Freigabe vom 2026-09-03; der Kontrasttest bekam einen zweiten Teil für Anzeigen ohne
  Schrift (≥ 3:1 nach WCAG 1.4.11).
