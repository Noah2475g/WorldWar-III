# PROBLEME

Befunde, die die Umsetzung blockieren oder aufschieben — je Eintrag: Datum, Aufgabe, Befund, kleinster reproduzierbarer Fall, Status.

---

## 2026-09-03 · T-M9-00 · Die Rohdaten sehen anders aus als der Plan annahm

**Befund:** Die Aufgabe veranschlagt „rund 4600 Verwaltungseinheiten mit völlig ungleicher
Körnung" und 1–2 Tage Handarbeit. Die geladene Fassung (Natural Earth 1:50 Mio) enthält
**294 Verwaltungseinheiten in nur 9 Ländern** — Russland (85), USA (51), Indien (36),
Indonesien (33), China (31), Brasilien (27), Kanada (13), Australien (9), Südafrika (9).
Alle übrigen Länder sind dort gar nicht untergliedert. Die 4600er-Zahl gehört zur
Fassung 1:10 Mio.

**Kleinster reproduzierbarer Fall:** `ne_50m_admin_1_states_provinces.dbf` auslesen und
nach `adm0_a3` gruppieren — neun Schlüssel.

**Das ist kein Rückschlag, sondern eine bessere Ausgangslage.** Der Zuschnitt fällt
dadurch fast von selbst:

| Gruppe | Quelle | Ergebnis |
|---|---|---|
| Die 9 großen Länder | Admin-1, zu Regionen zusammengefasst | je 4–10 Provinzen |
| Mittlere und kleine Staaten | Admin-0, ein Staat = eine Provinz | rund 125 Provinzen |
| Kleinststaaten und Inseln unter der Schwelle | ausdrücklich ausgeschlossen oder einem Nachbarn zugeschlagen | — |

Überschlag: rund 180 Provinzen, also mitten im geforderten Korridor 150–250 (R-MAP-01).

**Zweiter Befund — Textfelder:** Die DBF-Felder sind mit Null-Bytes aufgefüllt
(`"Asia\0\0\0…"`), und die deutschen Namen kommen falsch dekodiert an (`Ã„thiopien`
statt `Äthiopien`). Beides muss der Lader abfangen, bevor irgendetwas gruppiert wird —
sonst stehen die Fehler später in der Karte.

**Status:** offen, T-M9-00 in Arbeit. Kein Blocker.

---

## 2026-09-03 · T-M9-02a → vorgemerkt für T-M9-02c · Vier Provinzen liegen auf der Datumsgrenze

**Befund:** Fidschi, Neuseeland, der Russische Ferne Osten und der Westen der USA
(Alaska mit den Aleuten) spannen in den Rohdaten über die volle Längenspanne von −180°
bis 180°. Das ist geografisch richtig, aber jede Rechnung, die „westlichster minus
östlichster Punkt" bildet, hält diese Provinzen für so breit wie die halbe Welt.

**Kleinster reproduzierbarer Fall:** In `world-shapes.json` die Längenspanne je Provinz
bilden — vier liegen über 180°.

**Noch keine Auswirkung:** Die Karte zeichnet richtig (die Polygone selbst sind korrekt,
nur weit auseinander), und die Flächenrechnung stimmt — 133,9 Mio km² gegen erwartete
rund 135 Mio ohne Antarktis.

> ### ⚠ Berichtigt am 2026-09-07 (T-M19-05)
>
> **Der Absatz darüber ist falsch, und er war es schon, als er geschrieben wurde.**
>
> Er gilt für `world-shapes.json` — dort sind die Umrisse tatsächlich vollständig. Er gilt
> **nicht** für `world.json`, die Datei, die das Spiel zeichnet: dort behielt der Generator
> je Provinz nur *einen* Umriss, und für genau diese vier Provinzen war das der falsche.
> `USA-WEST` zeichnete 58,0 % seiner Fläche (Alaska statt der Weststaaten), `NZL` 38,5 %,
> `FJI` 31,3 %, `CAN-NORTH` 11,6 %.
>
> Der Satz „die Karte zeichnet richtig" hat den Fehler vier Tage lang gedeckt — bis Noah ihn
> am 2026-09-07 im Playtest **sah**. Die Lehre steht in `docs/reports/map-geometry.md`: eine
> Aussage über „die Karte" muss sagen, **welche Datei** sie meint, sobald es zwei gibt.
> Geprüft wird das seither von `packages/mapgen/src/worldmap.geometry.test.ts`, das die
> beiden Dateien gegeneinander hält.

**Wo es weh tun wird:** T-M9-02b (Nachbarschaft über Schwerpunktabstände) und T-M9-02c
(Seewege, „kein Sprung über die halbe Welt"). Beide müssen die Längendifferenz über die
Datumsgrenze rechnen, nicht linear. `distanceKm` in `project.ts` tut das bereits und hat
einen Test dafür; die noch zu schreibenden Schritte müssen es ebenso tun.

**Erledigt in T-M9-02b:** Die Nachbarschaft rechnet Entfernungen mit `distanceKm`
(Haversine), das die Datumsgrenze richtig behandelt — keine der 445 Landgrenzen kommt
über 6000 km, was ein Test festhält. **Offen bleibt es für T-M9-02c:** die Seewege aus
der Geometrie dürfen dort ebenfalls nicht linear rechnen.

**Status:** halb erledigt, Rest vorgemerkt für T-M9-02c.

---

## 2026-09-03 · vor T-M12-03 · Die Weltkarte ist wirtschaftlich vom Regelwerk abgekoppelt

**Befund:** Ein Rauchtest der Oberfläche vor dem Playtest (Deutschland, Startzahl 1914)
zeigte in der Kopfleiste eine Tagesproduktion von **+203.093 Nahrung** bei einem
Startbestand von 1.000. Nachgemessen mit `economyOverview` auf beiden Karten, mit
denselben Regeln:

| Karte / Macht | Provinzen | Material je Tag | Geld je Tag | Kaserne (333 Material) kostet |
|---|---|---|---|---|
| Kleine Welt / Nordland | 3 | 38 | 61 | **8,8 Tage** Materialeinkommen |
| Welt / Deutschland | 4 | 132.805 | 542.407 | **4 Minuten** Spielzeit |
| Welt / China | 6 | 43.366 | 1.643.294 | 12 Minuten |
| Welt / Italien | 3 | **0** | 402.209 | — nie aus eigener Produktion |

Die Regeln (Kosten, Startbestände, Unterhalt, Marktgrundpreise, `BALANCING.md`) wurden
in M3 auf der Kleinen Welt abgestimmt: dort liegt ein Vorkommen bei 1,5–2,5 Einheiten
je Tick. Auf der Weltkarte liegt es bei **1.000–3.000 Einheiten je Tick** — Faktor
600 bis 1000. Die Bevölkerung ist um denselben Faktor größer (Deutschland 9,9 Mio
gegen Nordland 1.330), und die Steuer rechnet `Bevölkerung / 1000 × Satz`, also
tausendfach mehr Geld.

**Ursache:** `packages/mapgen/src/enrich.ts` erzeugt Vorkommen als ganze Einheiten
(`amount(1200)` ≈ 700–3.600), `scripts/build-map.mjs` wandelt sie mit `toFixed`
(× 1000) in Festkomma um — die Kleine Welt trägt dieselben Größenordnungen aber bereits
*als* Festkomma (2000 = 2,0). Zwei Karten, zwei Einheiten, ein Regelwerk. Der
Startwert-Abgleich in T-M9-03 (±15 % vom Median) prüft die Nationen gegeneinander,
nicht gegen die Regeln; T-M9-04 prüft Tickbudget und Fehlerfreiheit, nicht die
Spielbarkeit der Zahlen.

**Kleinster reproduzierbarer Fall:** `createInitialState` auf `world.json` mit
Deutschland, dann `economyOverview(state, 'p1', rules).wood.production / ONE` → 132.805,
gegen `rules.buildings.barracks.cost.wood / ONE` → 333.

**Folgen, solange das so bleibt:**
- Geld und Material sind ab der ersten Spielstunde bedeutungslos; jeder Bauknopf ist
  immer bezahlbar, die Wirtschaftsfragen des Playtests (13–16b) messen nichts.
- Die KI-Logik „reagiert auf Mangel, verschuldet sich nie" kommt nie zum Zug.
- Der Parameterlauf (`balance-sweep.md`: „nur Moral und Ausdehnung sind tragend") ist
  vermutlich ein Artefakt einer gesättigten Wirtschaft, kein Befund über das Spiel.
- Italien (und womöglich weitere Mächte) startet ohne Material-Vorkommen und kann aus
  eigener Produktion nie eine Kaserne bauen.
- Die Rohstoff-Kartenfärbung („zehntausend ist reich", `modes.ts`) ist auf der
  Weltkarte überall voll ausgesteuert.

**Vorschlag (Entscheidung Noah):** Die Anreicherung auf die Skala der Regeln bringen —
Vorkommen so setzen, dass eine Startnation mit 3–4 Provinzen etwa das Tageseinkommen
Nordlands erreicht (Grundwerte in `depositsFor` durch ~1000 teilen, Bevölkerung im
Kern als Festkomma-Personen behandeln oder die Steuerformel anpassen), jeder
Startnation ein Mindestvorkommen an Nahrung, Material und Geld sichern, `world.json`
und `docs/reports/map.md` neu erzeugen, Golden-Master und Parameterlauf wiederholen.
Erst danach ist der Playtest aussagekräftig.

**Status: behoben am 2026-09-03** (Entscheidung Noah: der Weg mit den wenigsten
Spielproblemen — die Karte auf die Regelskala, nicht umgekehrt; `DECISIONS.md`). Der
Generator schreibt beide Größen ungeskaliert, die Bevölkerung geht zusätzlich auf ein
Fünftel (die komprimierten Millionen hingen alle am Deckel des Bevölkerungsfaktors,
Geld war noch zwanzigfach zu reichlich), jede Startnation erhält Holz und Erz, und
`apps/headless/test/economy-scale.test.ts` misst seither die Tage Einkommen je Kaserne
gegen die Referenzkarte. Nachher: Deutschland 2,4 Tage Material, 2,3 Tage Geld; Italien
3,5 / 3,1; über alle Mächte 1,1–15 bzw. 0,8–4,9 Tage (Referenz 8,8 / 4,1).


## 2026-09-03 · vor T-M12-03 · Rauchtest der Oberfläche — behoben

Gefunden beim selben Rauchtest, alle mit Test behoben:

- **KI-Befehle je Stunde neu:** Die Oberfläche fragte die KI einmal und wandte dieselben
  Befehle auf jeden Tick eines Vorspulens an — ein „Bau begonnen", dann 23 × „Befehl
  abgelehnt". Jetzt läuft dieselbe Schleife wie im kopflosen Läufer (`advance.ts`).
- **Protokoll zeigte fremde Ereignisse:** Bauten und Ablehnungen der KI-Mächte standen
  im Protokoll des Spielers (R-DIP-04). Jetzt gefiltert über `eventsFor`.
- **Rohtexte im Protokoll:** `{{reason}}`, `barracks`, `p2`, Armeekennungen, ein Marsch
  „nach" seinem Startort, Handel und Kriegserklärung mit falschen Platzhaltern
  (R-UI-07). Gebäude, Einheiten und Ablehnungsgründe haben jetzt deutsche Namen im
  Katalog; Nationen und Armeen kommen aus dem Spielzustand.
- **Wirtschaftsübersicht abgeschnitten:** Seitenleiste 260px, fünf Spalten — zwei
  fielen hinter einen Rollbalken. Jetzt 380px.
- **„1 Tage"** im Kosten-Tooltip.
- **Escape im Startdialog** ließ einen leeren Bildschirm ohne Rückweg zurück.

## 2026-09-03 · vor T-M12-03 · Die Oberfläche bot nur „Kaserne bauen"

**Befund:** Beim zweiten Blick auf die Playtest-Liste (Fragen 13, 14, 21–25) zeigte
sich, dass die Provinzleiste genau einen Knopf hatte — Kaserne bauen — und die
Armeeleiste keinen. Rekrutieren, Marschieren, Anhalten, Teilen, Zusammenlegen,
Beschießen, Kriegserklärung, Frieden, Bündnis, Markt und Hauptstadtverlegung waren im
Kern gebaut, getestet und über `canApply` abgesichert, aber von keinem Element der
Oberfläche erreichbar. T-M10-05 („Marschbefehl zeigt Ankunftszeit vorab") und
T-M10-06 („Diplomatieübersicht") standen auf `done`, weil ihre Panels existierten —
nur die Befehle darin fehlten. Eine Partie war damit nicht spielbar.

**Kleinster reproduzierbarer Fall:** `App.tsx` vor `16420d0`: `provinceActions` enthält
eine einzige Aktion (`BUILD barracks`), `<ArmyPanel actions={[]} />`.

**Behoben am 2026-09-03:** `apps/desktop/src/game/actions.ts` erzeugt jeden Befehl als
Daten — ein Knopf je Gebäude (7), je Einheit (10), Hauptstadt, sieben Armeebefehle,
acht diplomatische Handlungen, Markt mit Vorschau des Gegenwerts. Jeder Knopf trägt
Kosten und Dauer im Tooltip und, wenn er ausgegraut ist, den Grund in Worten
(`rejections.ts` übersetzt die Codes des Kerns, rechnet den Fehlbetrag und nennt
Gebäude bei ihrem Namen). Marsch und Beschuss laufen über eine Zielwahl (Klick auf die
Karte oder Liste im Panel); vor der Bestätigung steht die Ankunftszeit aus derselben
Routenrechnung, die die Simulation ausführt. Diplomatie (D) und Markt (H) sind aus der
Kopfleiste und per Taste erreichbar; eine Provinzliste in der Seitenleiste macht die
Auswahl ohne Maus möglich. Fünf Ende-zu-Ende-Tests fahren die Kette Bauen → Ausheben →
Armee → Marsch, Kriegserklärung, Tausch und den Abbruch der Zielwahl.

---

## 2026-09-04 · T-M13-10 · Die ESLint-Guards laufen unter Last in eine Zeitüberschreitung

**Befund:** In einem `pnpm verify`-Lauf meldeten drei Guards gleichzeitig einen
Fehlschlag — `no-color-literals`, `import-boundaries`, `core-purity` —, alle drei nach
rund 11,7 Sekunden. Einzeln ausgeführt läuft derselbe Guard in 0,8 Sekunden grün, und der
unmittelbar folgende `verify`-Lauf war ebenfalls grün.

**Ursache:** Diese drei Guards starten je eine eigene ESLint-Instanz. Wenn sie neben
hundert anderen Testdateien parallel laufen und die Maschine gerade beschäftigt ist,
reißen sie das Vitest-Standardlimit — sie melden dann die Auslastung der Maschine, nicht
einen Verstoß im Code.

**Kleinster reproduzierbarer Fall:** `pnpm verify` mehrfach hintereinander; der
Fehlschlag tritt sporadisch auf und verschwindet beim nächsten Lauf.

**Dieselbe Klasse wie schon einmal:** Der Renderbenchmark hatte genau dieses Verhalten
(18,6 ms unter `verify`, ein Bruchteil davon allein) und wurde deshalb in die langsame
Suite verschoben.

**Status:** offen, kein Blocker — aber ein Kandidat für dieselbe Behandlung
(eigenes Zeitlimit oder eigener Lauf). Vorgemerkt für T-M13-17.

---

## 2026-09-04 · T-M13-17 · Vier Befunde, die erst am Bildschirm auftraten

**Befund:** Vier Dinge waren durch grüne Tests gedeckt und trotzdem falsch — sie zeigen
sich nur im laufenden Programm:

1. **Die Karte blieb beim Spielstart namenlos.** Die Zoomschwelle für Provinznamen lag bei
   1,2, das Spiel öffnet bei 1,6. Der Test prüfte „oberhalb der Schwelle keine Namen" und
   war grün — er kannte die Startzoomstufe nicht. *Behoben:* Schwelle 2,0.
2. **Die Erklärzeichen standen unter den Knöpfen** und bildeten eine Reihe einsamer
   Kreise. Der Test prüfte „der Knopf trägt ein Fragezeichen", nicht wo. *Behoben:* Knopf
   und Zeichen in einer Zeile.
3. **In der Lagetabelle stand jeder Name doppelt** — Spalte und Balkenbeschriftung. Beide
   Tests waren richtig, keiner sah beides zusammen. *Behoben:* `labelHidden` am Balken.
4. **Die leere Balkenspur war vom Panel kaum zu unterscheiden** (1,27:1). Das fiel beim
   Nachrechnen des Kontrasts auf, nicht beim Ansehen. *Behoben:* Umriss aus `line`, und ein
   Kontrasttest für Anzeigen ohne Schrift.

**Die Lehre, schon einmal notiert und hier bestätigt:** Ein Test misst, was er liest.
Layout, Zoomstufe und Doppelungen zwischen zwei richtigen Bauteilen sieht er nicht — dafür
braucht es den Blick ins laufende Programm, und der gehört als Aufgabe in den Plan, nicht
in die Hoffnung.

**Status:** alle vier behoben.

---

## 2026-09-05 · Auswertung vor M14 · Wie diese Einträge entstanden — und was das Verfahren nicht sehen konnte

**Verfahren:** Acht Leser sind den Stand auf `1008774` getrennt durchgegangen — Kern, KI,
Oberfläche, Tests, Persistenz, Wirtschaft, Plan und Referenzabgleich — und meldeten
zusammen **127 Befunde**. Geprüft wurden davon **80**: je Dimension die ersten zehn. Das ist
eine Kappung des auswertenden Skripts, keine Auswahl nach Wichtigkeit — **47 Befunde sind
nie geprüft worden.** Jeder der 80 bekam einen zweiten Leser mit dem ausdrücklichen Auftrag,
ihn zu *widerlegen*: **68 hielten stand, 12 fielen.** Eine anschließende
Vollständigkeitskritik fand **13 weitere Punkte**, darunter zwei, die keiner der acht Leser
gesehen hatte: das Spiel hat keine Schrift, und die Niederlage des Menschen kommt in der
Oberfläche nicht vor.

**Der Vorbehalt, der über allem steht: niemand hat das Spiel gestartet.** Jeder Beleg der
Auswertung stammt aus `grep`, aus `readFileSync`, aus kopflosen Läufen und aus dem Lesen der
Plandateien. Das ist genau die Ebene, auf der die vier Bildschirmfehler vom 2026-09-04
(Eintrag T-M13-17 oben) unsichtbar waren. Die beiden Punkte, die erst die
Vollständigkeitskritik fand, hätten eine Minute vor dem laufenden Programm gezeigt; 68
geprüfte Befunde haben sie nicht gefunden. Was unten steht, ist deshalb eine Untergrenze,
kein vollständiges Bild.

Eingetragen sind hier nur die **sieben Blocker** und die **zwei Ursachen**, die sie tragen.
Alles Übrige steht im Auditbericht, auf den der Schluss dieser Datei verweist.

---

## 2026-09-05 · T-M14-08 · Kein Spielstand überlebt das Schließen des Fensters

**Befund:** `MemoryStorage` (`packages/core/src/persistence/StoragePort.ts:25`) ist die
einzige Umsetzung des Speicher-Ports im ganzen Repo. `apps/desktop/src/main.tsx:44` reicht
kein `storage` herein, `apps/desktop/src/App.tsx:168` fällt deshalb auf
`new MemoryStorage()` zurück. Jeder lauffähige Bau speichert damit in den Arbeitsspeicher:
die Anwendung meldet „gespeichert", die Platzliste zeigt den Spieltag — und nach dem
Schließen des Fensters ist alles weg. Das automatische Speichern aus T-M13-03, gerade erst
verdrahtet, schützt vor gar nichts.

Der Unterbau, den der Plan als vorhanden führt, wurde nie geschrieben. `tasks.yaml:538-547`
führt T-M8-00 mit `status: done`, vier Dateien und der DoD „dieselbe Vertragstestreihe läuft
gegen alle drei Umsetzungen". Von diesen vier existiert genau eine, `StoragePort.ts`;
`apps/desktop/src/storage/TauriStorage.ts`, `apps/headless/src/storage/NodeStorage.ts`,
`packages/testkit/src/MemoryStorage.ts` und der als Beleg genannte
`packages/core/src/persistence/StoragePort.test.ts` haben laut `git log --all` **nie
existiert**. `PROGRESS.md:117` meldet die Zeile trotzdem als grün. Auch die Bindung fehlt,
mit der ein Datei-Port überhaupt schreiben könnte: `@tauri-apps` kommt in `pnpm-lock.yaml`
**nullmal** vor, obwohl `apps/desktop/src-tauri/capabilities/local-only.json` bereits
`fs:`-Berechtigungen vergibt.

**Kleinster reproduzierbarer Fall:**
`grep -c "@tauri-apps" pnpm-lock.yaml` → `0`;
`git log --all --diff-filter=A -- "*TauriStorage*" "*NodeStorage*" "*StoragePort.test.ts*"`
→ keine Zeile;
`grep -rn "implements StoragePort" packages apps` → genau ein Treffer.

**Folge:** R-GAME-03 („Speichern/Laden in eine Datei"), R-GAME-04 und R-GAME-05 gelten alle
drei als testbelegt und sind auf Anwendungsebene wirkungslos. Der Playtest scheitert an
Frage 26 („Speichern, laden, weiterspielen") und Frage 47 („Liegt nach einer Weile ein
automatischer Spielstand in der Liste?"), sobald das Fenster einmal geschlossen wird.

**Status:** offen, aufgelöst durch **T-M14-08** („Ein Speicher, der das Schließen des
Fensters überlebt") — IndexedDB als dauerhafter Port für die Browser-Auslieferung, der
Datei-Port erst in M16 (Entscheidung 2 vom 2026-09-05). Die Rückstufung von T-M8-00 auf
`todo` samt Begründung liegt bei T-M14-02, nicht hier.

---

## 2026-09-05 · T-M14-06 · Der Stapel-Deckel wirkt auf die ganze Armee statt auf die zusätzliche Einheit

**Befund:** Der Entwurf beschreibt einen **Grenzbeitrag**: „jenseits von 50 trägt keine
*weitere* Einheit mehr zum Schaden bei" (`02-DESIGN.md:413-414`); die Referenz sagt
dasselbe. Gebaut ist ein **Faktor auf den Gesamtwert**:
`packages/core/src/rules/combat.ts:25-31` liefert `ONE` bis 20 Einheiten, fällt linear bis
50 und gibt ab 50 exakt `0` zurück — und `combat.ts:95` multipliziert damit den Angriffswert
der **ganzen** Armee, nicht den der überzähligen Einheiten.

Gemessen mit den echten Regeln (Infanterie gegen 10 Einheiten Infanterie, ein Tick,
zugefügter Schaden über die Armeegröße n):

| n | 20 | 25 | 30 | 40 | 45 | 49 | ab 50 |
|---|---|---|---|---|---|---|---|
| zugefügter Schaden | 1501 | **1563** | 1502 | 1000 | 564 | 121 | **0** |

Der eigene Verlust bleibt dabei konstant 804, der Unterhalt läuft weiter. Die Kurve kippt
schon bei 26 Einheiten, nicht erst bei 50.

**Kleinster reproduzierbarer Fall:** `stackContribution(50, rules)` → `0`; damit ist der
Angriffswert jeder Armee ab 50 Einheiten null, bei unverändertem eigenem Verlust.

**Folge:** Die zentrale Balancebremse des Vorbilds ist im Klon eine Falle. Wer eine große
Armee baut, verliert sie ohne Gegenwehr — und die KI legt Verbände zusammen
(`MERGE_ARMIES` in `packages/core/src/commands/army.ts`) und rennt genau hinein. Jede
Kampfaussage des Turniers, des Parameterlaufs und des kommenden Playtests steht auf dieser
Kurve.

**Status:** offen, aufgelöst durch **T-M14-06** — `effectiveUnits` als Integralwert statt
als Faktor, Schaden über n = 1…80 monoton nicht fallend, `effectiveUnits(50)` gleich
`effectiveUnits(80)`, Golden-Master neu erzeugt, und D6.5 in `02-DESIGN.md` sowie die Zeile
`stackCap` in `BALANCING.md` nennen Grenz- und Gesamtbeitrag getrennt mit Formel.

---

## 2026-09-05 · T-M14-01 · Das Anforderungstor ist rot — 82 von 100

**Befund:** Commit `1008774` hat Abschnitt 2.15 mit 18 neuen Anforderungs-IDs in
`01-REQUIREMENTS.md` eingefügt, ohne sie im maschinenlesbaren `scope`-Block (2.14)
einzuordnen — obwohl derselbe Commit diesen Block angefasst hat. `requirements-coverage.mjs`
sammelt alle `- **R-XXX-nn`-Zeilen des Dokuments ein und bildet die V1-Pflichtmenge als
„alle IDs minus `v2_only`"; `v2_only` ist leer. Alle 18 V1.2-IDs zählen seither als
V1-Pflicht. Lauf von heute im Worktree auf `1008774`:

```
davon fuer V1 verpflichtend: 100  (V2-only uebersprungen: 0)
mit belegtem Test:           82
Offen (18):
```

Exit-Code 1. Kein V1-Testbeleg ist verloren gegangen — gewachsen ist der Nenner, nicht
gefallen der Zähler. Es ist ein Buchhaltungsfehler im scope-Block, kein Regress im Code.

**Kleinster reproduzierbarer Fall:** `node scripts/requirements-coverage.mjs` → 82 von 100,
18 offen, Exit 1. Dasselbe Skript gegen den Dokumentstand von `eef9648` und dieselben
Testdateien → 82 von 82, 0 offen.

**Folge:** Die AK-2-Prüfung in `scripts/acceptance.mjs` (Zeile 48 als Lauf, Zeile 66 als
Auswertung) ist rot. Die DoD von T-M12-03 („`pnpm coverage:requirements` alle grün") und
dessen `gate_reason` („sechs von sieben Abnahmekriterien maschinell grün") sind nicht mehr
erfüllbar, solange M14 nicht gebaut ist: die Abnahme der V1 hängt damit an der
Fertigstellung der V1.2, und Noahs Playtest (AK-7) steht hinter einem Tor, das aus rein
dokumentarischen Gründen rot ist. Die bequeme Reparatur wäre die schlechteste — Exit-Code
maskieren oder IDs von Hand ausnehmen, und das Tor misst künftig nichts.

**Status:** offen, aufgelöst durch **T-M14-01** — ein Fach je Meilenstein im scope-Block,
eine ID ohne Fach bleibt V1-Pflicht, ein `later`-Eintrag ohne Begründung bricht mit Exit 1
ab, und AK-2 liest die Zeile „V1 offen:", ohne den Exit-Code zu maskieren. Der Zähler (die
Namenszählung) ist ein eigener Befund, siehe Ursache A.

---

## 2026-09-05 · T-M14-14 · AK-1 prüft kein Test

**Befund:** AK-1 lautet „vollständige Partie gegen mindestens 4 KI-Gegner von Start bis
Sieg/Niederlage, ohne Absturz und ohne Blockade". `scripts/acceptance.mjs:47` bescheinigt
es kollektiv über eine Sammelzeile `AK-1/4/6` → `pnpm test:slow`. Im ganzen Repo gibt es
genau zwei Zusicherungen auf einen Sieger: `packages/core/src/phases/occupation.test.ts:194`
(Zweispieler-Einheitstest) und `apps/headless/test/tournament.test.ts:27` (ein
Determinismusvergleich, der nur `a.winner === b.winner` fordert, ohne einen Sieger zu
verlangen). Die im Plan an AK-1 gebundene Aufgabe T-M4-06 hängt an
`apps/headless/test/walkthrough.test.ts` — zwei Spieler, 500 Ticks, kein Spielende.

Der Weltkarten-Langlauf existiert
(`packages/core/test/perf/worldmap.bench.slow.test.ts`, zwölf KI-Mächte, 1000 Spieltage),
prüft aber nur Absturzfreiheit, ein begrenztes Ereignisprotokoll und endliche Provinzmoral;
seine Zeile 125 bricht bei einem Sieger lediglich ab, ohne ihn je zu fordern. **Kein
eingecheckter Test sichert zu, dass irgendeine Partie auf irgendeiner Karte einen Sieger
hervorbringt** — und keiner spielt die Aufstellung, die der Startdialog vorbelegt.

**Kleinster reproduzierbarer Fall:**
`grep -rn "winner" --include=*.ts packages apps | grep expect` → zwei Treffer, beide oben
genannt.

**Folge:** Genau die Fehlerarten, die AK-1 fangen soll — Blockade, Partie ohne Entscheidung,
Absturz bei acht Mächten auf der Weltkarte —, sind unbeobachtet. Das erste und wichtigste
Abnahmekriterium wird als bestanden gebucht, ohne dass ein Test es berührt.

**Status:** offen, aufgelöst durch **T-M14-14** („Der Abnahmetest, den AK-1 immer gebraucht
hätte") — `pnpm sim:fullgame` mit der Voreinstellung aus `DEFAULT_NEW_GAME`/`toConfig`,
Sieger spätestens am Spieltag 1500, mindestens vier KI-Mächte, längstes Fenster ohne
Fortschrittsereignis unter 100 Spieltagen, eigene Zeile in `docs/reports/acceptance.md`
statt der Sammelzeile. Die DoD hält ausdrücklich fest: entscheidet der Lauf nicht, wird
nicht der Deckel erhöht, sondern der Befund hierher geschrieben.

---

## 2026-09-05 · T-M14-02 · Der Plan-Wächter liest `files:` und `tests:` gar nicht

**Befund:** `test/plan-consistency.test.ts` ist der einzige Leser von `tasks.yaml` im Repo.
Sein `YamlTask`-Interface (Zeilen 17–29) kennt `id`, `milestone`, `title`, `status`, `deps`,
`requirements`, `constraints`, `design`, `acceptance`, `gate` und `gate_reason` — **die
Felder `files:` und `tests:` stehen nicht darin**. Kein anderer Prüfer liest sie, obwohl die
DoD von T-M0-05 (`tasks.yaml:96`) genau diesen Abgleich zusagt („03-TASKS.md und tasks.yaml
stimmen in IDs, deps, **files** und requirements überein").

Nachgezählt im Worktree auf `1008774`, nur bei Aufgaben mit `status: done`: **38 von 174
`files`-Einträgen und 41 von 115 `tests`-Einträgen zeigen auf nicht existierende Pfade — 79
von 289, verteilt auf 43 Aufgaben.** Die Mehrzahl ist berechtigtes Umbauen, das nur nie in
den Plan zurückgeschrieben wurde (`migrate.ts` statt `load.ts`, `packaging.test.ts` statt
`tauri-permissions.test.ts`, `Dialogs.tsx` statt `SaveLoad.tsx`). Ein Teil ist es nicht: der
Speicher-Unterbau aus dem Eintrag oben, und die Eigenschaftstests, die die Kernregeln
geprüft hätten (`combat-conservation.test.ts`, `bombard.test.ts`) — sie fehlen, weil sie nie
geschrieben wurden, nicht weil sie umbenannt wurden.

**Kleinster reproduzierbarer Fall:** `tasks.yaml` parsen, über jede Aufgabe mit
`status: done` jeden Pfad aus `files` und `tests` mit `existsSync` prüfen — 79 fehlen. Und
`pnpm verify` bleibt dabei grün.

**Folge:** „done" kann bedeuten, dass zwei von vier zugesagten Dateien nie geschrieben
wurden. Genau so ist der Speicher-Blocker durchgerutscht. Wer M14 nach `tasks.yaml`
umsetzt, schreibt in Dateien, die es nicht gibt, und sucht Tests an Orten, die leer sind.

**Status:** offen, aufgelöst durch **T-M14-02** — jeder `files`- und `tests`-Pfad einer
erledigten Aufgabe muss existieren (ein Eintrag mit Schrägstrich als Verzeichnis), ein
einziger falscher Pfad macht den Lauf rot, und jede `done`-Aufgabe, deren fehlender Pfad
keine Umbenennung ist, geht auf `todo` zurück und trägt im Feld `reopened` die Aufgabe, die
sie schließt.

---

## 2026-09-05 · T-M14-08 · Die Vertragstestreihe für den Speicher-Port läuft gegen eine Umsetzung, nicht gegen drei

**Befund:** Was der Plan als „dieselbe Vertragstestreihe gegen alle drei Umsetzungen"
führt, ist ein einzelnes `it()`: `packages/core/src/persistence/save.test.ts:131-144`,
`describe('R-GAME-03 Der Speicher-Port ist austauschbar')`. Es legt in Zeile 132 ein
`new MemoryStorage()` an und prüft `exists`, `write`, `read`, `list` und `remove` gegen
dieselbe eine Umsetzung. Austauschbarkeit prüft es nicht — es gibt nichts, wogegen
ausgetauscht werden könnte.

**Kleinster reproduzierbarer Fall:** `save.test.ts:132` —
`const port: StoragePort = new MemoryStorage()`. Die einzige Fabrik im Test ist zugleich die
einzige Umsetzung im Repo.

**Folge:** Sobald ein dauerhafter Port kommt, existiert kein Vertrag, der ihn prüft. Die
Unterschiede, die nur ein echter Speicher hat — fehlschlagendes Schreiben, halb
geschriebener Stand, zwei Schreibvorgänge auf denselben Namen, Namen mit Sonderzeichen —,
treffen dann zuerst den Spieler.

**Status:** offen, aufgelöst durch **T-M14-08** — `storagePortContract(name, factory)` in
`packages/testkit`, gefahren gegen mindestens zwei Umsetzungen (Arbeitsspeicher und
IndexedDB), plus ein Wächter `test/guards/persistence-contract.test.ts`, der fällt, sobald
nur eine Fabrik registriert ist.

---

## 2026-09-05 · T-M14-09 · Das Spiel hat keine Schrift

**Befund:** `git ls-files` findet im ganzen Repository **null** Bild-, Ton- oder
Schriftdateien (Muster `\.(png|jpe?g|svg|mp3|wav|ttf|otf|woff2?)$`). Gleichzeitig verlangt
`apps/desktop/src/ui/tokens.ts:89-93` „IBM Plex Sans Condensed", „IBM Plex Sans" und
„IBM Plex Mono", `apps/desktop/src/ui/app.css:22-24` wiederholt es, und `docs/ASSETS.md`
behauptet, die ausgelieferte Anwendung bette die Schriftdateien ein, damit sie ohne Netz
funktioniere (R-FREE-04). Es gibt **kein `@font-face`** (null Treffer über
`apps/desktop/src`), keine Schriftdatei und kein `<link>`: `apps/desktop/index.html` enthält
Titel, Wurzel-Element und `main.tsx`, sonst nichts. Die Anwendung läuft auf jedem Rechner
ohne installiertes IBM Plex in der Systemschrift — das freigegebene Mockup
(`docs/design/ui-mockup.html`, lädt IBM Plex von `fonts.googleapis.com`) sieht damit
nachweislich anders aus als das Programm.

**Warum drei Wächter grün sind:** `test/guards/no-foreign-assets.test.ts` prüft dreimal
dasselbe Muster gegen eine leere Menge — (a) jede *eingecheckte* Asset-Datei steht in
`ASSETS.md` (es gibt keine, also grün), (b) `ASSETS.md` nennt die *Namen* der
Schriftfamilien (tut sie), (c) die Anwendung lädt nichts von außen nach (tut sie nicht — sie
hat nichts zu laden). `test/design-gate.test.ts` vergleicht Mockup und Code nur über
Farbtokens, nie über Typografie.

**Kleinster reproduzierbarer Fall:**
`git ls-files | grep -Ei "\.(woff2?|ttf|otf)$"` → leer;
`grep -rn "font-face" apps/desktop/src` → leer;
`pnpm verify` → grün.

**Folge:** Playtest-Frage 1 („Sieht das Spiel aus wie die freigegebene Richtung A?") ist die
erste Frage der Abnahme und würde gegen eine Systemschrift beantwortet. Diesen Befund hat
keiner der acht Leser gefunden — er stammt aus der Vollständigkeitskritik und ist der Beleg
dafür, dass der fehlende Blick ins laufende Programm ein echtes Loch ist und keine
Stilkritik.

**Status:** offen, aufgelöst durch **T-M14-09** („Das Spiel bekommt seine Schrift") — vier
`woff2`-Dateien unter `apps/desktop/src/ui/fonts`, zusammen unter 400 KB, je Familie ein
`@font-face` mit lokaler `url()`, keine Schriftquelle mit `https:` in `app.css` oder
`index.html`, OFL 1.1 in `ASSETS.md`, und ein Selbsttest, der den Wächter gegen eine leere
Asset-Menge fallen lässt.

---

## 2026-09-05 · T-M14-02 / T-M14-02b · Ursache A — die Zusage wurde nie an das Erzeugnis gebunden

**Befund:** Achtzehn der 68 bestätigten Befunde — vierzehn ganz, vier zum Teil — hängen an
**zwei Zeichenkettenvergleichen**, die zusammen die gesamte Statusaussage des Projekts
tragen:

1. `scripts/requirements-coverage.mjs:24` zählt eine Anforderungs-ID als belegt, sobald
   irgendwo im Repo ein `describe('R-XX-nn` mit mindestens einer Zusicherung steht. Das
   Akzeptanzkriterium selbst liest das Skript nie. „82 von 82" war damit eine
   Namenszählung, keine Verhaltensaussage — R-BAT-07/AK1, der Erhaltungssatz, gilt als
   belegt, ohne dass ein Test ihn prüft.
2. `test/plan-consistency.test.ts` liest `files:` und `tests:` nicht (Eintrag oben) — 79 von
   289 Pfadangaben bei `status: done` existieren nicht.

Damit sind `PROGRESS.md`, die DoD-Zeilen in `tasks.yaml` und `03-TASKS.md` ein zweites,
unabhängiges Dokument **ohne Rückkopplung an den Code**. Jede Zusage, die dort steht, bleibt
so lange wahr, wie niemand nachsieht.

**Kleinster reproduzierbarer Fall:** Eine Datei mit
`describe('R-XYZ-99', () => { it('x', () => { expect(1).toBe(1) }) })` genügt dem
Anforderungstor. Eine `done`-Aufgabe mit einem frei erfundenen Pfad in `files:` genügt dem
Plan-Wächter.

**Folge:** Die Reparatur ist ein Wächter, nicht achtzehn Einzelaufgaben. Solange beide
Vergleiche stehen bleiben, erzeugt M14 dieselbe Art von Grün ein zweites Mal.

**Status:** offen. Die Dateiliste löst **T-M14-02** auf; die Zählung je Akzeptanzkriterium
statt je ID — samt datierter Übergangsliste für die heute schon belegten IDs und der bisher
ungeprüften Richtung Anforderung → Aufgabe → Entwurf — löst **T-M14-02b** auf.

---

## 2026-09-05 · T-M14-08 / T-M14-09 / T-M14-10 / M16 · Ursache B — der Auslieferungspfad wurde nie ausgeführt

**Befund:** Kein `tauri build` ist je gelaufen; `@tauri-apps` steht nicht im Lockfile; das
Programmsymbol fehlt; die Schrift fehlt; ein dauerhafter Speicher-Port fehlt; einen
Fehlerfall zur Laufzeit gibt es nicht — `grep -rnE
"ErrorBoundary|componentDidCatch|getDerivedStateFromError|window\.onerror|unhandledrejection"`
über `apps` und `packages` liefert **null Treffer**, jeder unabgefangene Renderfehler ergibt
also eine weiße Fläche. Und die eine Datei, an der all das hängt, ist von der Messung
ausgenommen: `vitest.config.ts:34` — `exclude: [… , '**/main.tsx']`.

Jede Zusicherung des Projekts liegt damit **eine Ebene unterhalb dessen, was ausgeliefert
wird**. Das ist derselbe Fehler wie im Eintrag vom 2026-09-04 (die vier Befunde, die erst am
Bildschirm auftraten) — nur angewandt auf das Paket statt auf ein Panel.

**Kleinster reproduzierbarer Fall:** `grep -n "main.tsx" vitest.config.ts` → die Datei steht
in `coverage.exclude`; `grep -c "@tauri-apps" pnpm-lock.yaml` → `0`.

**Folge:** Dreizehn Befunde hängen daran, darunter vier der sieben Blocker: der fehlende
Speicher, die Vertragsreihe ohne zweite Umsetzung, die fehlende Schrift und — gemeinsam mit
Ursache A — der Plan-Wächter. Und es ist die Ursache, die eine Testsuite grundsätzlich nicht
findet: sie prüft, was gebaut wurde, nicht, was ausgeliefert wird.

**Status:** offen. Dauerhafter Speicher, und `main.tsx` zurück in die Abdeckung, ohne die
AK-3-Schwellen zu reißen → **T-M14-08**; Schrift → **T-M14-09**; Fehlerfall zur Laufzeit →
**T-M14-10**; Symbol, `@tauri-apps` und ein echter `tauri build` mit eigenem
Abnahmekriterium → **M16** (Entscheidung 2 vom 2026-09-05: die V1 liefert im Browser aus,
die Verpackung wird ein eigener Meilenstein).

---

## 2026-09-05 · T-M14-02 · Die Sondendateien der Auswertung sind aus dem Arbeitsbaum entfernt

**Befund:** Die Auswertung selbst hat ihre Messsonden im Arbeitsbaum liegen lassen: 13
Sondentests unter `apps/headless/test/zz*`, dazu
`packages/core/src/phases/zzz-skeptic-hull.test.ts` und ein Verzeichnis `coverage-audit/` —
15 unverfolgte Einträge. `vitest.config.ts:26` schließt sie nicht aus
(`include: ['{packages,apps,test}/**/*.test.{ts,tsx}']`), sie liefen also in jedem
`verify`-Lauf mit. Jede Zahl der Auswertung wurde damit in einem Baum gemessen, dessen
Testmenge nicht die des Projekts ist.

**Kleinster reproduzierbarer Fall:** `git status --short` zeigte 15 unverfolgte Einträge;
`ls apps/headless/test/zz*` fand Testdateien, die in keiner Aufgabe stehen.

**Status: behoben am 2026-09-05** — mit `git clean` entfernt; `ls apps/headless/test/` und
`git status --short` weisen keine `zz`-Datei und kein `coverage-audit/` mehr aus. Dass der
Baum vor jedem Abnahmelauf sauber ist, hält T-M14-02 als erste Zusage seiner DoD fest.

---

**Der vollständige Befundstand** — die 68 bestätigten Befunde mit Belegen, die 12
widerlegten mit Grund, die 13 Punkte der Vollständigkeitskritik, die sechs gemeinsamen
Ursachen A–F, der Abhängigkeitsgraph und die 47 nie geprüften Befunde — steht in
`docs/reports/audit-2026-09-05.md`. Die daraus abgeleiteten Aufgaben stehen als M14 und M15
in `docs/plan/tasks.yaml` und `docs/plan/03-TASKS.md`.

---

## 2026-09-06 · T-M14-01 · Der Ende-zu-Ende-Test der Oberfläche reißt unter der Abdeckungsmessung sein Zeitlimit

**Befund:** Nach dem Einbau der Meilensteinachse meldete `pnpm verify` einen roten Test —
`App.test.tsx > baut, hebt aus, waehlt die Armee und marschiert mit angesagter Ankunft`,
`Test timed out in 5000ms`. Allein ausgeführt läuft derselbe Test in **3,5 s** durch
(dreimal wiederholt, dreimal grün, 37 Tests der Datei). Unter `pnpm verify`, das die
Abdeckung mitmisst, braucht er **5,3 s** und reißt damit das Standardlimit von 5 s.

**Kleinster reproduzierbarer Fall:** `npx vitest run` → 1098 grün. `npx vitest run
--coverage` → derselbe eine Test rot. Der Unterschied ist ausschließlich die
Instrumentierung.

**Warum jetzt:** Der Test lag schon vorher dicht am Limit (4,3 s im verify-Lauf vom
2026-09-05). Die neun Tests, die T-M14-01 hinzufügt, waren der Tropfen — nicht die
Ursache.

**Dieselbe Klasse zum dritten Mal:** der Renderbenchmark (T-M10-03b, 18,6 ms unter
`verify`, ein Bruchteil davon allein) und die drei ESLint-Guards (2026-09-04, 11,7 s
gegen 0,8 s). In allen drei Fällen misst der Test unter Last die Auslastung der
Maschine, nicht das Verhalten des Codes.

**Behoben:** Eigenes Zeitlimit von 20 s für diesen einen Test, mit Begründung an Ort und
Stelle. Nicht das globale `testTimeout` angehoben — das hätte jeden künftigen echten
Hänger um denselben Faktor verzögert. Der Test fährt die ganze Befehlskette (bauen,
vorspulen, ausheben, Armee wählen, Ziel wählen, marschieren) und zeichnet die Anwendung
dabei dutzendfach neu; er ist berechtigt langsam.

**Status: behoben am 2026-09-06.** Offen bleibt die Frage, ob weitere Tests dicht am
Limit liegen — heute misst das niemand. Vorgemerkt für **T-M14-05** (die Messgeräte):
eine Liste der zehn langsamsten Tests je Lauf, damit der nächste Fall auffällt, bevor er
rot wird.

---

## 2026-09-06 · T-M14-03 · Acht kleinere Befunde ohne eigene Aufgabe — hier ist ihr Ort

Aus der Auswertung vom 2026-09-05 (`docs/reports/audit-2026-09-05.md`) blieben acht
Befunde, die weder eine Aufgabe in M14/M15 bekommen haben noch als Zusage zurückgenommen
wurden. Sie stehen hier mit Meilenstein, damit keiner zwischen „nicht gebaut" und „nicht
entschieden" verschwindet. Ein Eintrag in dieser Akte ist keine Zusage, ihn zu bauen — er
ist die Zusage, ihn nicht zu vergessen.

| Befund | Beleg | Wohin |
|---|---|---|
| **`MapCanvas` läuft in keinem Test** — 141 von 249 Zeilen unausgeführt, weil `App.test.tsx` `getContext` als `null` liefert; R-ARCH-06/AK2 (60 FPS) misst damit niemand, der zeichnet | Befund 16, N11 | **M16** — zusammen mit dem echten Bau, wo ein Zeichenkontext existiert |
| **Kohle hat nur noch eine Senke** — der Gebäudeunterhalt ist heute zurückgenommen, damit bleibt nur der Armeeunterhalt; 86 von 237 Provinzen fördern Kohle, die niemand braucht | Befund 26, 35 | **M17** — mit der Tiefe zwischen den Kriegen, die dem Frieden Ausgaben gibt. *(Umgehängt nach **M18** am 2026-09-13, T-M17-01: M17 bringt keine Senke — Spionagesold zieht nur Geld, Handel verschiebt Güter. Und „bleibt nur der Armeeunterhalt" war ungenau: keine Einheit verbraucht Kohle, Befund B8 unten. M17 misst die Bestände vorher und nachher, T-M17-02/16.)* |
| **R-AI-04 ist gemessen verletzt** — die KI hält 43,1 % statt der zugesagten 30 % Rücklage, und der Test ist trotzdem grün, weil er die Schwelle nicht prüft | Befund 46 | **M15**, mit T-M15-08 (Integrationstor) — dort wird die KI ohnehin gemessen |
| **Hauptstadtverlegung kostet nichts** und löscht die Strafe für den Hauptstadtverlust; wer seine Hauptstadt verliert, verlegt sie sofort und ist die Folgen los | Befund 50 | **M15**, mit T-M15-05 — die KI lernt dort `SET_CAPITAL`, und der Preis gehört zur selben Regel |
| **350-facher Vorratsaufbau** über 1000 Spieltage ohne einen einzigen Überlauf; die Lagergrenze liegt rechnerisch 3000 Spieltage entfernt und wirkt nie | Befund 58 | **M17** — dieselbe Ursache wie die Kohlesenke: dem Frieden fehlen Ausgaben. *(Umgehängt nach **M18** am 2026-09-13, T-M17-01, aus demselben Grund; gemessen wird in T-M17-02 und T-M17-16.)* |
| **314 von 374 Regelzahlen ohne Belegstatus** — der Test prüft nur `constants.json`, die übrigen Dateien (Einheiten, Gebäude, Rohstoffe) tragen keinen Status „belegt/geschätzt" | Befund 59 | **M15**, mit T-M14-05s Nachfolge: sobald die Messgeräte stimmen, wird der Status messbar statt behauptet |
| **Rückzug ist ein Teleport** — eine Armee ohne Gegner springt in einem Tick dorthin, wofür ein Marsch 15 Ticks braucht | Befund 66 | **M15**, mit T-M15-07 — die Feuerleitung fasst dieselbe Haltungslogik an |
| **Barrierefreiheit jenseits des Kontrasts** — kein Test öffnet einen Dialog und schließt ihn mit Escape, keiner prüft Fokusfang, Tabreihenfolge oder `aria`; belegt ist nur die Tastenzuordnung als reine Funktion | Befund N12 | **M16** — zusammen mit dem Bau, in dem sich Fokus überhaupt beobachten lässt |

**Status: offen, je mit Meilenstein.** Keiner dieser acht blockiert die Abnahme der V1.

---

## 2026-09-06 · T-M14-05 · Das Tickbudget der Anforderung ist auf der Weltkarte um Faktor 5 gerissen

**Befund:** R-ARCH-06/AK1 fordert für 200 Provinzen, 8 Spieler und rund 400 Armeen einen
Tick im **Median unter 0,5 ms** und im 99. Perzentil unter 2 ms. Gemessen auf der
Weltkarte (`docs/reports/worldmap-bench.json`, 237 Provinzen, 12 Spieler):
**2,463 ms Median, 5,53 ms p99** — Faktor 4,9 bzw. 2,8 über der Anforderung.

**Warum das niemand bemerkt hat:** Der Weltkarten-Bench sichert 8 ms und 40 ms zu, also
das Sechzehn- und Zwanzigfache der Anforderung. Der zweite Bench
(`tick.bench.slow.test.ts`) prüft zwar gegen die Zahlen der Anforderung — aber an
**12 Provinzen** statt 200, einer zwanzigmal kleineren Karte, auf der 0,04 ms herauskommen.
Beide Tests sind grün, und keiner misst, was die Anforderung meint. Ein Budget, das um den
Faktor sechzehn über der Anforderung liegt, ist keine Prüfung, sondern eine Erlaubnis.

**Kleinster reproduzierbarer Fall:** `docs/reports/worldmap-bench.json` gegen
`01-REQUIREMENTS.md`, R-ARCH-06/AK1 halten.

**Was daran nicht schlimm ist:** Die interaktive Betriebsart aus R-TIME-02 (bis 100
Spielstunden je Sekunde) ist bei 2,463 ms je Tick erreichbar — rechnerisch rund 400 Ticks
je Sekunde. Die Zahl 0,5 ms stammt aus der Entwurfsphase und ist nirgends nachgemessen
worden; ihre eigene Begründung im Anforderungstext („nur so ist die interaktive
Betriebsart erreichbar") trifft nach dieser Rechnung nicht zu.

**Behandelt am 2026-09-06 (T-M14-05):** Der Bericht nennt jetzt neben der Messung die
Anforderung, ob sie eingehalten ist und um welchen Faktor sie verfehlt wird. Die
Zusicherung bleibt beim erreichbaren Budget — eine Zusicherung auf 0,5 ms wäre sofort rot,
machte `pnpm test:slow` rot und damit AK-4, AK-6 und die Abnahmekette; das ist genau der
Fehler, den T-M14-01 behoben hat.

**Entschieden am 2026-09-06 (Noah): (a) — Anforderung nachmessen und anheben.** Nicht auf
M16 vertagt, sondern sofort umgesetzt, weil die Zahl sonst als offener Widerspruch in die
Abnahme gegangen wäre.

**Was jetzt gilt:** R-ARCH-06/AK1 nennt die **ausgelieferte** Karte (237 Provinzen, 12
Mächte) und fordert Median unter **3,5 ms**, p99 unter **8 ms**. Die Herleitung steht in
der Anforderung selbst: R-TIME-02 verlangt rund 100 Ticks je Sekunde, dafür genügen 10 ms;
3,5 ms halten das mit dreifacher Reserve. Gemessen wurde dreimal — 2,344 / 2,359 / 2,463 ms
Median, Streuung unter 5 % — die Zusicherung liegt also rund 1,5-fach über der Messung.

**Und das war der eigentliche Befund:** Die Zusicherung im Bench ist jetzt **dieselbe Zahl**
wie die Anforderung, nicht das Sechzehnfache. Ein angehobenes Budget mit weiterhin lockerer
Zusicherung wäre derselbe Fehler in neuer Höhe gewesen. Der Bericht nennt zusätzlich die
Reserve je Größe, damit ein Rückschritt sichtbar wird, bevor er die Grenze reißt.

**Der kleine Bench ist eingeordnet statt gelöscht:** `tick.bench.slow.test.ts` misst 12
Provinzen und behauptete, die Anforderung zu prüfen — er ist jetzt als Frühwarnung
beschrieben, mit dem Vermerk, dass er bei 0,04 ms grün war, während die Anforderung um den
Faktor fünf gerissen wurde.

---

## 2026-09-06 · T-M14-07 · Der Beschuss löst sich in Phase 1 auf, der Nahkampf in Phase 8

**Befund:** `BOMBARD` ist ein Kommando und wirkt deshalb in Phase 1 der Tick-Pipeline
(Kommandos anwenden); der Nahkampf wird in Phase 8 aufgelöst. Damit gelten für zwei
Kampfarten zwei verschiedene Zeitpunkte: der Beschuss trifft, bevor Bewegung und Kampf
desselben Ticks stattgefunden haben. Eine Armee, die in diesem Tick abmarschiert, wird
noch am alten Ort getroffen.

**Kleinster reproduzierbarer Fall:** `packages/core/src/phases/index.ts` (Phasenordnung)
gegen `packages/core/src/commands/bombard.ts` (`apply` wirkt sofort).

**Warum er hier nicht behoben wird — und das ist eine Entscheidung, keine Auslassung:**
Der Umbau verlangt, dass `BOMBARD` künftig nur noch eine *Absicht* im Zustand setzt, die
eine neue Phase neben dem Nahkampf auflöst. Das ändert die Reihenfolge, in der Schaden
entsteht, und damit **jeden Golden-Master und jede Balancezahl** — für sich genommen ohne
einen einzigen Gewinn für den Spieler, denn heute gibt es nur den Handbeschuss, und der
ist in sich stimmig.

Sinn bekommt der Umbau erst mit **R-BAT-08** (T-M15-07): die Feuerautomatik ist ihrer Natur
nach eine Phase, keine Handlung, und dann müssen Handbeschuss und Automatik zwingend
denselben Zeitpunkt haben — sonst hat dieselbe Kanone zwei Regeln, je nachdem, wer
abdrückt. Den Umbau einmal zu machen, zusammen mit dem, was ihn braucht, ist billiger und
ehrlicher als ihn zweimal zu messen.

**Status: offen, zugewiesen an T-M15-07.** Die Aufgabe führt ihn bereits als Vorbedingung;
diese Akte hält fest, warum er dort und nicht hier steht. Die beiden anderen
Beschuss-Vorbedingungen aus derselben Aufgabe — der Diplomatiefilter (Befund 51) und die
leeren Armee-Hüllen (Befund 53) — sind am 2026-09-06 **behoben**, weil sie den heutigen
Handbeschuss betreffen und nichts an der Reihenfolge ändern.

---

## 2026-09-06 · T-M14-09 · Das Spiel hat keine Schrift — und die Aufgabe braucht eine Entscheidung

**Befund (N1 des Audits, bestätigt):** `git ls-files` mit Asset-Muster liefert **null
Treffer** — das Repository trackt keine einzige Schriftdatei. Es gibt kein `@font-face`,
keinen `<link>`, nichts. Gleichzeitig verlangt `apps/desktop/src/ui/tokens.ts` IBM Plex in
drei Schnitten, und `docs/ASSETS.md` behauptet: *„die Anwendung bettet die Schriftdateien
ein, damit sie ohne Netz funktioniert (R-FREE-04)"*.

Ausgeliefert wird also der Rückfall des Stacks: `system-ui`. Das freigegebene Mockup
(`docs/design/ui-mockup.html`) lädt IBM Plex von Google Fonts und sieht damit nachweislich
anders aus als das Spiel auf jedem Rechner ohne installiertes IBM Plex. **Playtest-Frage 1
lautet „Sieht das Spiel aus wie die freigegebene Richtung A?" — sie wird heute gegen eine
andere Schrift beantwortet.**

**Warum drei Wächter das durchgewinkt haben:** `test/guards/no-foreign-assets.test.ts`
prüft (a) „jede eingecheckte Asset-Datei steht in ASSETS.md" — über einer leeren Menge
trivial wahr; (b) „ASSETS.md nennt die Familien" — tut sie; (c) „die Anwendung lädt nichts
nach" — tut sie nicht, sie hat nichts. Drei grüne Zusicherungen, und das Erzeugnis hat
keine Schrift. *Ein Wächter über einer leeren Menge ist immer grün.*

**Status: offen, Entscheidung steht aus — und zwar bei Noah.** Der Bau verlangt, vier
`.woff2`-Dateien (IBM Plex Sans, Sans Condensed, Mono, dazu die OFL-Lizenzdatei, zusammen
rund 300 kB) von `github.com/IBM/plex` **herunterzuladen und einzuchecken**. Ein Download
aus einer externen Quelle ist nichts, was ich ungefragt tue.

Zwei Wege:

- **(a) IBM Plex einbetten** — hält die Design-Freigabe ein, das Spiel sieht überall gleich
  aus, und `R-FREE-04` (kein Netz zur Laufzeit) bleibt erfüllt, weil die Dateien mitkommen.
  Kosten: rund 300 kB im Repository, ein Skript `scripts/fetch-fonts.mjs` mit Prüfsummen,
  ein `@font-face`-Block. **Braucht Noahs Freigabe für den Download.**
- **(b) Auf Systemschriften umstellen** — `tokens.ts` verlangt nur noch, was jedes System
  hat; `ASSETS.md` nimmt die Zusage zurück; das Design-Gate wird auf den neuen Stand
  nachgeführt. Kostet nichts, sieht aber nicht aus wie das freigegebene Mockup.

**Vorschlag: (a).** Das Design-Gate war eine ausdrückliche Freigabe auf ein Bild, und die
Schrift trägt daran mehr als die Farben — Richtung A lebt von der schmalen Kartenschrift.

**Entschieden am 2026-09-06 (Noah): (a), einbetten.** Umgesetzt in T-M14-09. Bezogen wurden
vier Schnitte von `github.com/IBM/plex`, Stand `v6.4.0` — ein Tag, kein Branch, sonst wären
die Prüfsummen im Skript nach dem nächsten Fremd-Commit Rauschen. Zusammen **208,1 kB**,
die Grenze der Aufgabe lag bei 400 kB. `scripts/fetch-fonts.mjs` hält Quelle, Lizenz und
je Datei eine SHA-256-Summe fest und prüft mit `--check` das Eingecheckte nach, ohne etwas
zu laden.

**Und der Wächter kann jetzt fallen.** Das war der eigentliche Befund, nicht die fehlende
Schrift: `familiesWithoutEmbeddedFile(tracked, css)` nimmt die Dateiliste als Parameter,
damit eine Zusicherung sie gegen die **leere** Liste laufen lassen und verlangen kann, dass
sie klagt — dieselbe Zwei-Richtungs-Probe, die `ui-reachability` mit der künstlichen Waise
fährt. Ein Wächter, der nur die echte Welt liest, wird grün, sobald jemand sie repariert,
und beweist danach nichts mehr.

**Zwei Nebenbefunde beim Bau:**
1. `OFL.txt` wäre bei jedem Auschecken auf LF normalisiert worden und hätte damit eine
   andere Prüfsumme gehabt als die geladene Datei — `.gitattributes` führt sie jetzt als
   `-text`. Eine Prüfsumme über eine Datei, die das Versionssystem unterwegs umschreibt,
   ist keine Prüfung.
2. Das Design-Tor verglich bis heute **nur Farbtokens**. Der größte sichtbare Unterschied
   zwischen Freigabebild und Erzeugnis war aber die Schrift. Es vergleicht jetzt beides.

---

## 2026-09-06 · T-M14-12 · Die KI handelt erst, wenn der Mangel schon da ist

**Befund (13 des Audits):** `tradeCommands` beginnt mit `if (shortages.length === 0)
return []` — die KI tauscht also erst, wenn ein Vorrat bereits aufgebraucht ist und der
Mangelzustand eingetreten. Gemessen: **in drei Probeläufen entstand kein einziges
`TRADE`**, und keine Testzeile ruft `tradeCommands` überhaupt auf.

Der Auslöser ist die falsche Größe. `view.self.shortages` meldet einen Ausfall, der schon
stattgefunden hat; bis dahin sind Bauvorhaben gestoppt und Armeen ohne Nachschub. Ein
Händler, der erst kauft, wenn er nichts mehr hat, handelt zu spät — und der Markt, den
R-ECON-05 gebaut hat, bleibt für die halbe Welt totes Inventar.

**Kleinster reproduzierbarer Fall:** eine Partie über 200 Spieltage, `TRADE_EXECUTED` in
den Ereignissen zählen — null.

**Der bessere Auslöser** (aus der Vollständigkeitskritik, Abschnitt 4): *WENN ich über der
Rücklage einen Bestand halte, der meinen teuersten offenen Bauauftrag zum Marktpreis
bezahlen würde, DANN tausche ich.* Die Sicht trägt seit T-M13-05 die Tagesbilanz je
Rohstoff (`self.economy`), also ist auch „dieser Vorrat reicht noch N Tage" ohne neues
Feld zu haben.

**Status: offen, zugewiesen an T-M15-08** (R-AI-08, das Integrationstor). Dort wird die KI
ohnehin über 200 Spieltage gemessen, und AK3 verlangt ausdrücklich, dass jede
Schwierigkeitsstufe im Turnier Handelsereignisse erzeugt — „sonst ist die Mechanik für die
KI tot". Diese Akte hält fest, dass der Grund bekannt ist und nicht gesucht werden muss.

**Was T-M14-12 stattdessen gebaut hat**, weil es Vorbedingung für M15 war: Truppenmischung
samt Artillerie, `SET_CAPITAL`, `MERGE_ARMIES` und `PublicView.incomingOffers`.

---

## 2026-09-06 · T-M15-04 · Zwei Zusagen der Aufgabe waren nicht einlösbar — und was an ihre Stelle tritt

**Befund:** Die Aufgabenbeschreibung verlangte zweierlei, das mit einem neuen Zustandsfeld
nicht gleichzeitig zu haben ist:

1. *„der Hash des migrierten Zustands ist derselbe wie der im V1-Umschlag"* — der Hash
   (`packages/shared/src/hash.ts`) sortiert die Schlüssel eines Objekts und nimmt **jeden**
   mit. Ein hinzugefügtes Feld ändert ihn zwangsläufig, gleich wie neutral sein Wert ist.
2. *„`determinism.test.ts` bleibt ohne Erneuerung der Golden-Datei grün"* — aus demselben
   Grund. Der Golden-Master ist ein Zustands-Hash je Prüfpunkt.

**Was daran nicht schlimm ist:** Beide Sätze meinen dieselbe Sache, und die ist prüfbar —
nur nicht über den Hash: **die Migration rührt nichts an, was die Simulation liest.**

**Was an ihre Stelle getreten ist, und warum es schärfer ist:**

- Statt eines Hashvergleichs prüft `migration-v1.test.ts` den *Unterschied* zwischen altem
  und migriertem Zustand und verlangt, dass er **ausschließlich** aus den in
  `ADDED_IN_VERSION_2` genannten Feldern besteht. Ein Hashvergleich hätte nur „gleich oder
  ungleich" gesagt; das hier sagt, *was* sich geändert hat, und lässt genau die drei
  erlaubten Felder durch.
- Der Golden-Master wurde erneuert — aber **erst nach dem Beweis**, dass sich nur die
  Gestalt geändert hat. Gemessen am 2026-09-06: derselbe 500-Tick-Lauf liefert nach Abzug
  von `schemaVersion`, `grievances` und `holdFire` **bitgleich** die alten Werte
  (`tick1 63ad299674899dac`, `tick24 99829740ca0a2912`, `tick100 63815fde347d0fb4`,
  `tick500 f9f4259d8eaff2f3`). Die neuen stehen in `tiny-500.json`. Ein stillschweigend
  erneuerter Golden-Master gilt in diesem Projekt als Fehlschlag — dies ist die
  dazugehörige Akte.

**Status: behoben.** Die Aufgabenbeschreibung in `03-TASKS.md` ist auf die einlösbare
Fassung gezogen, mit Verweis hierher.

---

## 2026-09-06 · T-M15-04 · Die Migration stürzte an fremdem Inhalt ab, statt ihn abzulehnen

**Befund:** Der erste Entwurf von `toVersion2` griff direkt auf `state.armies`,
`state.diplomacy` und `state.eventLog` zu. Ein Umschlag mit `state: { schemaVersion: 1 }`
ergab damit einen `TypeError` statt einer Meldung — und für den Spieler ist ein TypeError
nicht von einem Absturz des Spiels zu unterscheiden.

**Kleinster reproduzierbarer Fall:**
`deserialise('{"schemaVersion":1,"savedAtTick":0,"state":{"schemaVersion":1}}')`.

**Behoben am 2026-09-06.** Die Migration ist nachsichtig gegenüber fehlenden Teilen: sie
darf an fremdem Inhalt nicht *abstürzen*, sie darf ihn nur nicht verstehen. Die Ablehnung
gehört zu `validateState`, das danach läuft — und das ist auch die Stelle, an der die
Meldung entsteht, die der Spieler lesen kann.

---

## 2026-09-06 · T-M15-05 · Das Turnier maß die Startaufstellung, nicht die Spielstärke

**Befund:** Der Grundlauf „schwer gegen normal" endete **exakt 25:25** — und das war kein
Gleichstand. Die Seiten wurden jede zweite Partie getauscht, jede Partie aber **einzeln**
gewertet; A gewann genau die 25 Partien, in denen A auf Platz eins startete. Anders gesagt:
**in allen 50 Partien gewann die erste Nation.** Das Turnier hat eine Eigenschaft der
Testkarte für eine Eigenschaft der KI gehalten, und ein Instrument, das das tut, kann eine
Regeländerung weder bestätigen noch widerlegen.

**Behoben am 2026-09-06:** Gewertet wird das **Paar** aus Hin- und Rückpartie desselben
Seeds — dieselbe Technik, mit der Schachturniere die Farbe herausrechnen. Dazu ist
`winRateA` eine **Punktquote** über alle Paare geworden (Unentschieden zählt halb); die
alte Form `winsA / (winsA + winsB)` ließ die Unentschieden aus dem Nenner und meldete für
„fünf Siege, fünf Unentschieden" glatte 1,00.

---

## 2026-09-06 · T-M15-05 · Die KI befahl 762 Märsche dorthin, wo die Armee schon stand

**Befund:** In einer Turnierpartie über 40 Spieltage: **807 abgelehnte Befehle gegen 133
angenommene.** 762 davon `MOVE_ARMY` mit `INVALID_TARGET`, Grund „bereits dort".
`rateProvinces` bewertet auch die Provinz, in der die Armee steht, und der Angriffszweig
in `military.ts` filterte sie nicht heraus — also fasste die KI in **jedem Tick** denselben
unmöglichen Befehl.

Dieselbe Klasse wie die 3046 `NO_PATH` aus T-M14-11: die KI sah handlungsfähig aus und war
es nicht. Der Verteidigungszweig hatte den Filter (`target !== army.provinceId`), der
Angriffszweig nicht.

**Warum es so lange unsichtbar war:** `COMMAND_REJECTED` trug den Grund nicht. Der Kern
kennt ihn — er steht in `CommandResult.detail` —, aber das Ereignis ließ ihn fallen. Im
Protokoll stand „MOVE_ARMY abgelehnt: INVALID_TARGET", und dieser eine Code steht für drei
verschiedene Fehler (leere Armee, bereits dort, kein eigener Flugplatz).

**Behoben am 2026-09-06, beides:** ein Filter auf die eigene Provinz, und `detail` im
Ereignis. **Gemessen: 807 Ablehnungen → 0.**

---

## 2026-09-06 · T-M15-05 · Zwei Zusagen, die nur teilweise einzulösen waren

**1. „Kein Lauf endet 25:25" — eingelöst, aber anders als gedacht.** Die 25:25 waren ein
Artefakt der Einzelwertung (siehe oben). Paarweise gewertet zeigte sich der wahre Befund:
**25 Unentschieden**, also keine unterscheidbaren Stufen. Die Ursache war messbar —
`recruitShare` ist der einzige Wert, der die Stufen trennt, und die Spreizung 200/330 war
zu klein. Versuche: 120/500 → 8 von 10 Paaren für „schwer"; 150/400 → wieder nur
Unentschieden. Die Wirkung liegt an den Rändern. Übernommen wurde das gemessene Paar
120/500; danach steht „schwer gegen normal" bei **0,80** (15 Siege, 0 Niederlagen, 10
Unentschieden). Zeit half nicht: 40, 80 und 150 Spieltage ergaben dasselbe Bild.

**2. Die Obergrenze 0,95 — nicht für „schwer gegen leicht".** Dort steht 1,00, und zwar auf
beiden Kennzahlen: „leicht" gewinnt keine einzige Partie. Der Rekrutierungsanteil ist 80
gegen 500, mehr als das Sechsfache. Diese Quote unter 0,95 zu drücken hieße, **„schwer"
absichtlich schlechter zu machen, um eine Zahl einzuhalten** — der Spieler, der „schwer"
wählt, zahlte für eine Zusicherung.

Die Obergrenze steht deshalb dort, wo eine Mauer dem Spieler wirklich schadet: zwischen
**benachbarten** Stufen. Wer auf „leicht" verliert, wechselt zu „normal", nicht zu
„schwer". `apps/headless/test/tournament.slow.test.ts` sichert 0,55 < Quote ≤ 0,95 für
„schwer gegen normal" und die 70 % aus R-AI-06 für „schwer gegen leicht" — und die Stelle,
an der die Obergrenze *nicht* steht, trägt die Begründung im Code.

**Status: offen als Beobachtung, nicht als Fehler.** Ob „leicht" spürbar leichter sein
*sollte*, beantwortet der Playtest und keine Turnierzahl.

---

## 2026-09-06 · T-M15-05 · Ein Friedensschluss ist ein Waffenstillstand

**Befund:** Der erste Turnierlauf meldete **0 Friedensschlüsse**, und das sah aus wie ein
Befund über die KI. Tatsächlich zählte das Turnier `DIPLOMACY_CHANGED` mit
`newState: 'peace'` — `acceptPeace` setzt aber `truce`, und erst nach der Regelfrist wird
daraus wieder `peace`. Gezählt wurde also ein Zustand, den ein Friedensschluss gar nicht
erzeugt.

**Behoben am 2026-09-06.** Gezählt wird `truce`. Danach: **78 Friedensschlüsse in 50
Partien**, wo vorher null standen. Der Befund „kein Krieg endet je" war zur Hälfte echt
(es fehlte die Bedingung für einen festgefahrenen Krieg) und zur Hälfte ein Messfehler —
und ohne die Korrektur wäre die Hälfte, die echt war, mit einer grünen Zahl zugedeckt worden.

---

## 2026-09-06 · T-M15-07 → T-M15-08 · Die Feuerautomatik kommt im Turnier nicht vor

**Befund:** R-BAT-08 ist gebaut und in zwölf Einzeltests belegt — aber im Turnier über
150 Spieltage entsteht **kein einziges** selbsttätiges Beschussereignis. Damit ist AK3
(„jede Schwierigkeitsstufe erzeugt mindestens ein selbsttätiges Beschussereignis im
50-Partien-Turnier") nicht erfüllt.

**Die Kette, Glied für Glied nachgemessen** an einer Partie über 60 Spieltage
(`hard` gegen `normal`, Testkarte):

| Frage | Gemessen |
|---|---|
| Wird Artillerie rekrutiert? | **nein** — nur `infantry`, 12 Stück |
| Steht eine Fabrik? | **nein** — gebaut werden `barracks` (4×) und `railway` (2×) |
| Blockiert ein Mangel? | **nein** — `shortages` ist leer |
| Reicht das Holz? | **nein: 83.081 vorhanden, die Fabrik kostet 667.000** |

**Das ist die eigentliche Ursache.** Die KI auf der Testkarte wird nie reich genug für
eine Fabrik; ohne Fabrik keine Artillerie, ohne Artillerie ist `armyRange` jeder Armee 0,
und die Feuerautomatik hat nichts, womit sie feuern könnte. Genau der Zustand, vor dem
die Aufgabenbeschreibung warnt: *gebaut, grün getestet und wirkungslos.*

**Ein Nebenblocker ist dabei behoben worden:** `nextBuilding` verlangte für die Fabrik
`shortages.size === 0` — als „unter Druck befestigen statt ausbauen" gedacht und in der
Praxis eine Dauersperre, denn eine KI, der irgendein Rohstoff knapp ist, hat *immer* einen
Mangel. Ob die Fabrik bezahlbar ist, entscheidet ohnehin `canAfford`, und das hält eine
Rücklage frei; zwei Sperren für dieselbe Frage, von denen eine nie aufgeht, sind eine zu
viel. Nach der Änderung: immer noch kein Beschuss, weil die Holzmenge bindet.

**Status: offen, zugewiesen an T-M15-08** — dem Integrationstor, dessen erklärter Zweck
genau das ist: *die KI nutzt die neuen Mittel.* Dort gehört die Frage hin, ob die KI zu
arm ist, ob die Fabrik zu teuer ist, oder ob die Testkarte für diese Messung zu klein ist.
Was hier **nicht** getan wird, ist die Zusicherung so zu formulieren, dass sie grün wird:
eine Obergrenze über null Ereignissen wäre grün und sagte nichts.

---

## 2026-09-06 · T-M15-07/T-M15-08 · M15 hat AK-1 gebrochen — die Front war eingefroren

**Befund:** Der volle Abnahmelauf nach M15 meldete **5 von 7**. Gerissen war unter anderem
**AK-1**: die ausgelieferte Standardpartie kam über 1500 Spieltage zu **keinem Ausgang**,
obwohl 2453 Provinzen den Besitzer wechselten und 8083 Gefechte stattfanden. Vor M15 wurde
dieselbe Aufstellung an Spieltag 822 entschieden.

**Nachgemessen, Spieltag für Spieltag** (Punktanteil des Führenden, Schwelle 700 ‰):

| Spieltag | lebende Mächte | Anteil des Führenden | Provinzen des Führenden |
|---|---|---|---|
| 200 | 8 | 332 | 55 |
| 500 | 7 | 453 | 87 |
| 900 | 5 | 560 | 123 |
| 1500 | 5 | **570** | **127** |

**Die Ausdehnung hört ab Spieltag 900 praktisch auf.** Nicht, weil die Gegner stark wären —
zwei Mächte halten drei und vier Provinzen —, sondern weil sich nichts mehr bewegt.

**Die Ursache, und sie war eine Zeile aus T-M15-07:** Die Regel „eine Fernwaffenarmee mit
Ziel in Reichweite bleibt stehen" prüfte `armyRange(army) > 0` — also **jede Armee, die
irgendeine Kanone dabeihat**. Die KI rekrutiert gemischt (Zielverhältnis 50/30/20), also
enthielt nach einiger Zeit praktisch jeder Verband Artillerie, und **praktisch jede Armee
an der Front blieb stehen**. Eine Armee aus zwanzig Infanteristen und einer Haubitze ist
kein Artillerieverband — sie hat eine Haubitze dabei.

**Behoben am 2026-09-06:** Es bleibt nur stehen, wessen Einheiten **sämtlich** Fernwaffen
sind. **Gemessen: entschieden an Spieltag 876**, Sieger p6, 11 Kriegserklärungen, 2025
Eroberungen. AK-1 ist wieder grün.

**Zweite Änderung derselben Untersuchung, kleiner und ebenfalls gemessen:** die Obergrenze
der „Verlockung" in der Kriegsentscheidung ist von 200 auf **450** angehoben. Mit 200 konnte
eine erdrückende Übermacht ein tadelloses Verhältnis nie überstimmen — der Führende hatte
zu den Restmächten schlicht nichts vorzuwerfen und griff nie an. Das Verhältnis bleibt das
Tor für *gewöhnliche* Entscheidungen; ab einem Stärkeverhältnis von rund 1:2,8 ist die
Übermacht ihr eigenes Argument. R-DIP-06/AK1 (zweite Richtung) bleibt erfüllt: ein Nachbar
mit doppelten Punkten und gutem Verhältnis bleibt unbehelligt.

**Was daran lehrreich ist:** Beide Regeln waren einzeln richtig und in ihren Tests grün.
Erst der **Lauf über die ganze Partie** hat gezeigt, dass sie zusammen das Spiel anhalten.
Dasselbe Muster wie beim Integrationstor — nur diesmal nicht „die Mechanik kommt nie vor",
sondern „die Mechanik kommt überall vor".

---

## 2026-09-06 · T-M15-08 · Die KI ist in M15 um 73 % teurer geworden

**Befund:** `R-AI-04` verlangt, dass die Entscheidungen aller KI-Spieler im Mittel höchstens
**30 % der Tickzeit** kosten. Gemessen:

| | vor M15 (`f78470e`) | nach M15 |
|---|---|---|
| KI je Tick | 0,0468 ms | **0,0808 ms** (+73 %) |
| Anteil an der Tickzeit | 0,443 | **0,498** |

Der Test in `tick.bench.slow.test.ts` sichert `< 0,5` zu und war damit zeitweise **rot**
(0,517). Nach zwei Änderungen — das Verhältnis wird je Macht und Tick einmal statt viermal
gerechnet, und `nextBuilding` bekommt die Provinz statt ihrer Kennung, was einen
quadratischen Durchlauf je Tick beseitigt — steht er bei 0,498.

**0,498 gegen eine Grenze von 0,500 ist kein Ergebnis, das man stehen lässt.** Es steht hier
als offener Befund und nicht als Erfolg.

**Was die Messung darüber hinaus zeigt** (Profil auf der Testkarte, drei Mächte):

```
publicView für drei Mächte   0,0254 ms
runAi gesamt                 0,0262 ms
```

**Rund 97 % der „KI-Zeit" ist der Bau der öffentlichen Sicht, nicht die Entscheidung.**
R-AI-04 misst dem Wortlaut nach „die Entscheidungen der KI" und misst tatsächlich
überwiegend `publicView` — dieselbe Art von Diskrepanz wie beim Tickbudget, das bis zum
2026-09-06 an einer zwanzigmal kleineren Karte geprüft wurde.

Dazu kommt: die Zusicherung im Test (`< 0,5`) ist **67 % lockerer als die Anforderung**
(≤ 0,30), und das war schon vor M15 so (gemessen 0,443). Eine Anforderung, die seit
Monaten um die Hälfte verfehlt wird, ohne dass ein Test es sagt, ist genau der Zustand, den
T-M14-01 anderswo behoben hat.

**Status: offen, zugewiesen an M16** — dort ist die Leistung am echten Bau ohnehin neu zu
messen. Drei Fragen gehören dann beantwortet: (a) ist `publicView` je Macht und Tick
überhaupt nötig oder lässt sich der unveränderliche Teil teilen, (b) misst R-AI-04 das, was
es messen will, und (c) auf welchen Wert gehört die Zusicherung, wenn die Anforderung
30 % sagt. **Nicht** getan wurde das Naheliegende: die Grenze von 0,5 anzuheben, damit die
Zahl passt.

---

## 2026-09-06 · M16 · R-AI-04 wird auf der falschen Karte gemessen

**Befund:** Die Reparatur vom 2026-09-06 hat R-ARCH-06/AK1 von der Testkarte auf die
ausgelieferte Weltkarte gezogen — und **R-AI-04 auf der Testkarte stehen lassen**. Beide
Zusicherungen stehen in derselben Datei, elf Zeilen auseinander:

| | R-ARCH-06/AK1 | R-AI-04 |
|---|---|---|
| Wortlaut der Anforderung | „die ausgelieferte Weltkarte (237 Provinzen, 12 Mächte)" | „alle KI-Spieler … **bei 8 KI-Spielern**" |
| gemessen in | `worldmap.bench.slow.test.ts` | `tick.bench.slow.test.ts` |
| Karte | 237 Provinzen | **12** (`smallWorld()`) |
| Mächte | 12 | **3** |

Der Dateikopf von `tick.bench.slow.test.ts` beschreibt den Fehler selbst und in aller
Schärfe — „a twentieth of the real one … the numbers here certify nothing about the
requirement … which is how a budget breached by a factor of five stayed invisible for a
milestone" —, und **direkt darunter steht ein zweiter `describe`, der genau das wieder
tut**: `R-AI-04 Rechenzeit der KI` sichert den Anteil der Anforderung auf zwölf Provinzen
und drei Mächten zu. Die Korrektur wurde auf einen von zwei Blöcken derselben Datei
angewandt.

`worldmap.bench.slow.test.ts` ruft `runAi` in beiden Prüfungen auf, **misst es aber nie**:
gemessen wird dort ausschließlich die Tickzeit.

**Warum die Richtung des Fehlers hier besonders schlecht ist.** Rund 97 % der gemessenen
„KI-Zeit" ist der Bau der öffentlichen Sicht (Befund vom selben Tag), und `publicView`
läuft **je Macht über alle Provinzen**. Von der Testkarte zur Weltkarte wächst dieser
Anteil also mit rund 237/12 ≈ 20 an Provinzen **und** mit 8/3 an Mächten, während die
Tickzeit im Nenner anders wächst. **Der gemeldete Wert 0,498 sagt über die Bedingungen,
die R-AI-04 selbst nennt, nichts.** Ob die Anforderung unter ihren eigenen Bedingungen
gehalten wird, ist bis heute **ungemessen** — und das ist eine andere Aussage als „knapp
gehalten".

**Nicht behoben, weil es sich nicht nebenbei beheben lässt:** die Messung auf der
Weltkarte kann die Zusicherung reißen, und dann steht eine Entscheidung an — dieselbe wie
bei R-ARCH-06 am 2026-09-06. **Zugewiesen an T-M16-02**, zusammen mit den drei Fragen des
Befundes von heute Nachmittag. Die Grenze anzuheben, damit die Zahl passt, ist auch hier
ausdrücklich **nicht** der Weg.

**Was daran lehrreich ist:** Eine Korrektur ist erst fertig, wenn sie **jede** Stelle
derselben Klasse erreicht hat. Der Kommentar, der den Fehler benennt, ist kein Beleg dafür,
dass er behoben ist — er stand hier über einem Block, der ihn noch beging.

---

## 2026-09-06 · T-M12-03 · Das gerissene Tickbudget war Fremdlast, kein Rückschritt

**Befund:** Der Abnahmelauf gegen `5065b99` meldete **6 von 7**; gerissen war genau eine
Zusicherung, R-ARCH-06/AK1 mit **3,525 ms Median gegen 3,5 ms**. Das ist **kein**
Rückschritt im Code, sondern eine Messung unter Fremdlast.

**Die Messreihe, alles derselbe Commit:**

| Bedingung | Median | Urteil |
|---|---|---|
| 2026-09-06, 17:02 (Referenz, vorher gemessen) | 2,528 ms | grün |
| im Abnahmelauf, 22:25 | **3,525 ms** | **rot** |
| einzeln nachgemessen, gleiche Lage | 3,535 ms | rot |
| nach dem Schließen der Fremdlast, 3 Durchgänge | **2,546 / 2,606 / 2,655 ms** | **grün** |

**Die Ursache:** `OPERATOR.exe` (ein Spiel aus dem Steam-Ordner) lief ab 21:20:13 und
belegte **2,7 von 6 Kernen**. Der Abnahmelauf startete 21:02, seine Benchmarks liefen
gegen 22:25 — mitten hinein. Ein Ryzen 5600X taktet bei mehreren belegten Kernen deutlich
niedriger als bei einem, dazu kommt Speicher- und Cache-Konkurrenz; zusammen rund **30 %**,
und damit genug, um 2,5 ms über die Grenze von 3,5 zu heben.

**Zwei Irrwege auf dem Weg dorthin, beide lehrreich:**

**(a) Der Einzelvergleich hätte die falsche Ursache benannt.** Eine Messung vor der
AK-1-Reparatur (`0d551ac`) ergab 3,126 ms, eine danach 3,535 ms — daraus wäre „die
Reparatur kostet 13 %" geworden. **Im Wechsel** gemessen, dreimal, überlappen die Spannen:

| Durchgang | vor der Reparatur | nach der Reparatur |
|---|---|---|
| 1 | 3,139 | 3,323 |
| 2 | 3,267 | 3,315 |
| 3 | 3,307 | **3,279** |

Kein nachweisbarer Unterschied — und im Verlauf sieht man, wie die Maschine warmläuft.
Genau der Fall aus dem Lessons Log vom 2026-08-12: ein Werkzeug, das stärker streut als
der Effekt, den es messen soll, darf **kein Verhältnis** ausgeben, sondern muss
„kein Unterschied nachweisbar" melden.

**(b) Die Kontrolle „ist die Maschine frei" war blind.** Gefragt wurde `Get-Process node`
— also ausschließlich nach den **eigenen** Prozessen. Die Antwort „keine rechnenden
node-Prozesse" war wahr und wertlos; die Gesamtlast stand bei 24 %. Richtig ist die
Gesamtlast plus die Liste der größten Verbraucher, unabhängig davon, wem sie gehören.

**Folgen, eingetragen:**

1. **Die Grenze bleibt bei 3,5 ms.** Sie war nie das Problem. Die Reserve liegt bei rund
   **1,32-fach** (3,5 gegen 2,65) — etwas unter der bei der Festlegung gemeinten
   1,5-fachen, aber die Festlegung nannte 2,344/2,359/2,463 als Grundlage, und die
   heutigen 2,546/2,606/2,655 liegen darüber. Wer das für zu knapp hält, misst nach und
   begründet; **angehoben wird sie nicht, damit eine Zahl passt.**
2. **`WORKFLOW.md`, Falle 5** sagt jetzt ausdrücklich, dass „Maschine allein" *jeden*
   Prozess meint, und nennt den Prüfbefehl samt Schwelle (brauchbar unter etwa 10 %
   Grundlast).
3. **`docs/reports/acceptance.md` weist AK-4/6 weiterhin als rot aus** und ist damit für
   diesen Lauf korrekt — der Lauf *war* rot. Der nächste vollständige Abnahmelauf steht
   ohnehin nach Noahs Playtest an (AK-7), und er ist die Stelle, an der der Bericht wieder
   grün wird. Bis dahin gilt: **die Zeile ist erklärt, nicht offen.**

**Was daran lehrreich ist:** Eine rote Zusicherung ist eine Frage, keine Antwort. Sie kann
drei Dinge heißen — der Code ist schlechter geworden, die Zusicherung war falsch, oder die
Messung war es. Wer sofort am Code oder an der Zahl arbeitet, hat eine der drei Möglichkeiten
gewählt, ohne sie zu prüfen. Hier war es die dritte, und das Einzige, was sie sichtbar
gemacht hat, war eine Wiederholung unter geänderten Bedingungen.

---

## 2026-09-06 · AK-7 · Was der Playtest gefunden hat

**Gefahren am 2026-09-06 von einem Agenten, nicht von Noah.** AK-7 verlangt im Wortlaut
seine Abnahme; dieser Durchgang ersetzt sie nicht, er nimmt ihr die Suche ab.
Vollständig in `docs/reports/playtest-v1.md`: **39 ja · 13 nein · 8 nicht geprüft**, zwei
vollständige Partien bis Spieltag 171.

### Die vier schweren Befunde

**1. Die Kartenwahl ist ein Blindschalter — Befund 38/N10 ist NICHT geschlossen.**
„Kleine Welt (12)" gewählt, Partie begonnen — es läuft die Weltkarte. Die Provinzliste
zeigt „Mittlerer Westen", „Ostkanada"; `data/maps/testworld.json` enthält „Hafen",
„Waldland", „Bergland". **`docs/PLAYTEST.md:149` behauptet das Gegenteil** („Kartenwahl und
Debug sind seither geschlossen") — der Abnahmebogen trägt damit selbst eine Falschaussage,
und zwar an der Stelle, die den Befund für erledigt erklärt.

**2. Der Spielstand überlebt, ist aber nicht erreichbar.** IndexedDB führt `stand-1` nach
dem Neuladen korrekt — die Liste öffnet aber **ausschließlich Strg+S**, kein Knopf führt
dorthin, und die Tastenkombination wirkt **ohne laufende Partie nicht**. Wer das Fenster
schließt, kommt an seinen Stand nicht mehr heran. Dazu eine Sackgasse: schließt man den
Startdialog mit dem Kreuz, bleibt eine leere Fläche mit „Die Welt wird aufgebaut …" —
kein Knopf, kein Dialog, keine Taste führt zurück, nur Neuladen hilft.

**3. Der Knopf „Neue Partie" im Endedialog führt ins Leere.** Das Spiel meldet das Ende
und bietet ihn an; der Klick schließt den Dialog, öffnet **keinen** Startdialog und lässt
den Spieler in der beendeten Partie zurück (Tag 171, Siegziel 0 %, jede Produktion null).
Damit ist die zweite Partie ohne Programmneustart nicht möglich, obwohl der Knopf sie
verspricht — und **T-M14-10 hat genau das als erledigt gemeldet.**

**4. Es erscheint nie eine Meldung.** Über zwei vollständige Partien — Hauptstadtverlust,
Überrennen, eigenes Ausscheiden, eigene Gefechte mit Verlusten — erschien **keine
einzige**. Der Bereich `.alerts` existiert zu keinem Zeitpunkt im DOM. Was hätte warnen
können, stand nur im Ereignisprotokoll, und das läuft als Ringpuffer gleichzeitig mit
fremden Gefechten voll.

### Die mittleren

| Was | Wo |
|---|---|
| **Roher Übersetzungsschlüssel auf dem Bildschirm:** der Abbruchknopf heißt `[province.cancelBuild]`. Er funktioniert; nur sein Name fehlt | Provinzpanel, „Im Bau" |
| **Die Siegbedingung wird nicht erklärt.** Punkte und Eroberung sind wählbar, und nirgends steht, was sie bedeuten — dabei entscheidet die Wahl, wie die Partie endet. Unter „Startzahl" steht ein erklärender Satz, hier keiner | Startdialog |
| **Der Rückzug sagt nicht, was er kostet.** Der Knopf ist da und wirkt, trägt aber keinen Tooltip. Dasselbe bei Marschieren, Angriff, Teilen — während die Bauknöpfe es vormachen („333 Material, 250 Geld · 1 Tag") | Armeepanel |
| **Die Spalte „Verbrauch" steht dauerhaft auf 0.** Über 35 Spieltage laufend gebaut und ausgehoben; die Spalte führt nur den Armeeunterhalt. Die Frage „wohin gehen meine Rohstoffe" bleibt unbeantwortet | Wirtschaftsübersicht |
| **Das Vorspulen sagt nie, warum es anhält** — über 30 Klicks kein Hinweistext, auch nicht während Gefechte liefen. R-TIME-03 verlangt die Begründung ausdrücklich | Kopfleiste |
| **Nach einem Gefecht fehlt das Warum.** Verluste beider Seiten stehen da („Verluste: Vereinigte Staaten 3, Kanada 0"), aber keine Stärken, kein Gelände. Dazu fünfmal hintereinander im Stundentakt „Verluste: 0, 0" — ein Patt, das niemand erklärt | Ereignisprotokoll |
| **Die Debug-Ansicht ist praktisch leer:** „Tick: 8", ein **leerer** Zustands-Hash, und die Überschriften „Ziel" und „Kommandolog" ohne Inhalt. Damit ist Frage 48 („gibt es eine Einstellung, die sichtbar nichts bewirkt?") mit **ja** zu beantworten, erwartet war nein | Menü |
| **Flugplatz und Jagdflugzeug teilen ein Symbol** — beide zeigen auf `aircraft` (`icons.tsx:131` und `:143`). Gebäude und Einheit sind nicht auseinanderzuhalten | Symbolsatz |
| **Nebel und herrenloses Land sind gleich gefärbt** (#DAD5C6), und die Legende nennt beides „neutral" | Karte, Modus Besitz |
| **„1 Provinzen"** im Endedialog — Mehrzahl bei eins, und die Zahl widerspricht dem Satz darüber („Ihre letzte Provinz ist gefallen") | Endedialog |

### Zwei Fehler im Abnahmebogen selbst

- **`docs/PLAYTEST.md:149`** erklärt Kartenwahl und Debug-Panel für geschlossen. **Beides
  ist offen** (Befunde 1 und die Debug-Ansicht oben).
- **Frage 13b** unterstellt, ein Bauabbruch gebe „nichts zurück". Gemessen werden **50 %**
  erstattet, und das Protokoll sagt es auch. Die Frage ist falsch gestellt, nicht das Spiel.
- **`scripts/playtest-sheet.mjs`** verlangt für *jedes* „nein" einen Befund — auch bei den
  Fragen, deren erwartete Antwort „nein" **ist** (3: nichts zu kaufen, 45: nichts bewegt
  sich). Ein bestandener Punkt erzwingt so einen Befundeintrag; die Regel müsste die
  Polarität der Frage kennen.

### Was der Playtest bestätigt hat, mit Zahlen

Damit der Bericht nicht nur die Mängel führt: die angekündigte Tagesproduktion trifft die
Lieferung **auf die Einheit genau** (fünf Rohstoffe, +450/+450, +176/+176, +27/+27,
+68/+68, +198/+198). Baukosten werden exakt wie angekündigt abgezogen, der Abbruch
erstattet gemessene 50 %. Alle vier IBM-Plex-Schnitte melden `loaded`. Alle vier
Kartenmodi färben nachweislich (22/22/19/18 verschiedene Farben über ein Raster). Die
Ankunftsvorschau steht vor der Bestätigung und trifft zu. Der Endedialog kommt von selbst.
Automatikstände rotieren. Einstellungen überleben den Neustart.

### Was daran lehrreich ist

**Drei der vier schweren Befunde sind dieselbe Klasse:** die Mechanik ist gebaut und
funktioniert — der Spielstand wird geschrieben, die neue Partie ist im Kern vorgesehen,
die Meldungen sind programmiert — und **der Weg des Spielers dorthin fehlt oder endet im
Nichts**. Das ist Ursache A aus der Auswertung vom 2026-09-05, zum fünften Mal, und
diesmal an Stellen, die als erledigt gemeldet waren.

**Und die Gegenprobe zählt genauso:** Zwei Verdachtsfälle aus der Codelektüre haben sich
im Lauf **nicht** bestätigt — „jede eigene Provinz wird im Moral-Modus zinnoberrot" (live
gemessen: Oliv #505738) und „ein Klick auf die Karte wählt nichts aus" (ein Werkzeugfehler
des Prüfers, kein Produktfehler). Wer aus dem Code auf das Verhalten schließt, liegt
regelmäßig daneben — in beide Richtungen.

---

## 2026-09-07 · T-M12-09 · Was `dailyTick` erzeugt, kommt nie im Protokoll an

**Gefunden von der Gegenprobe, nicht von der Diagnose** — und das ist der Punkt. Ein
Diagnose-Agent führte den Befund „es erscheint nie eine Meldung" auf einen fehlenden
Kanal in `App.tsx` zurück und schlug dort eine Reparatur vor. Der Skeptiker, dessen
einziger Auftrag das Widerlegen war, hat nachgemessen und **ein übersprungenes Glied
gefunden, an dem diese Reparatur gescheitert wäre**.

**Der Befund:** `step.ts` ruft `dailyTick` **nach** der gesamten `PHASE_ORDER` auf — also
**nach** `bookkeeping`. Und `bookkeeping` ist die Phase, die `ctx.events` an
`draft.eventLog` hängt. Alles, was `dailyTick` danach erzeugt, landet **nie im
Protokoll**.

Gemessen über drei Spieltage: zurückgegeben `{"DAY_REPORT": 3}`, im `eventLog` davon
**nichts**.

**Warum das mehr ist als ein Schönheitsfehler:** Der Ereignisstrom ist seit T-M14-05 die
Grundlage der Messungen — Eroberungen werden aus `runTicks(...).events` gezählt, nicht
mehr aus dem Ringpuffer. Ereignisse, die den Rückgabewert erreichen, aber nicht das
Protokoll, sind für die *Messung* da und für den *Spieler* nicht. Genau diese Trennung
macht den Befund schwer zu sehen: wer die Zahlen prüft, sieht sie; wer das Spiel spielt,
nicht.

**Was der Skeptiker außerdem widerlegt hat.** Die Diagnose behauptete, ein Kampf im
eigenen Gebiet erzeuge „strukturell null" Meldungen, weil die Eroberung im selben Tick
greife. Nachgestellt mit echtem Kern: **zehn von zehn Ticks liefern `alerts: ["battle"]`**,
die Provinz bleibt beim Verteidiger. Die Null im Messlauf entstand allein daraus, dass die
gemessene Macht **passiv** war und nie in Feindberührung kam — nicht aus dem Code. Aus
einer Partie ohne Spieler wurde eine Aussage über eine Partie mit Spieler abgeleitet.

**Zwei weitere Funde derselben Gegenprobe**, beide bestätigt:

- Die Hauptstadt-Bedingung in `Alerts.tsx` ist **toter Code**: `occupation.ts` setzt
  `capitalProvinceId = null` im selben Tick, in dem die Hauptstadt fällt — die Bedingung
  kann danach nie mehr wahr werden.
- Die vierte von R-UI-14 geforderte Quelle, **„Fertigstellungen"**, fehlt in `alertsFor`
  ganz.

**Status: offen, T-M12-09.** Die Reparatur des Lecks gehört in den Kern und muss ohne
Phasenumstellung auskommen — eine geänderte Phasenreihenfolge wäre eine Änderung am
Golden-Master. `eventLog` steht in `HASH_OMIT_KEYS`, der Simulationshash bleibt also
unberührt, wenn man die in `dailyTick` entstandenen Ereignisse nachträgt statt die Phasen
zu tauschen.

**Was daran lehrreich ist:** Die Gegenprobe hat sich bezahlt gemacht. Vier von fünf
Diagnosen wurden bestätigt; die fünfte war plausibel, gut belegt, an der entscheidenden
Stelle falsch — und hätte zu einer Reparatur geführt, die den Befund nicht behebt. Ein
Skeptiker mit dem ausdrücklichen Auftrag zu widerlegen ist billiger als eine Reparatur,
die nicht wirkt.

---

## 2026-09-07 · T-M14-13 stand auf `done` und hatte zwei seiner Punkte nie geliefert

**Gefunden** bei der Aufarbeitung der Playtest-Befunde, nicht gesucht.

`03-TASKS.md` beschreibt T-M14-13 in sechs Punkten. Zwei davon sind nie gebaut worden:

| Punkt | Zusage | Stand am 2026-09-07 |
|---|---|---|
| 5 | Die Debug-Ansicht füllt sich | `App.tsx` übergab `{ tick, hash: '', aiGoals: [], commands: [] }` — drei feste Leerwerte |
| 6 | `main.tsx` übergibt eine Kartensammlung, `startGame` wählt daraus | `main.tsx` warf `testMap` weg, `startGame` bekam immer die Weltkarte |

`tasks.yaml` führte die Aufgabe trotzdem als `done`, und ihre Fertig-wenn-Zeile behauptete
wörtlich, „die Playtest-Frage zu Kartenwahl und Debug-Ansicht ist mit nein beantwortbar".
**Beides war falsch**, und der Playtest hat genau diese beiden Punkte als Befunde 4 und 48
wieder eingesammelt — eine Runde später und mit dem Umweg über einen Menschen.

**Warum der Plan-Wächter das nicht gefunden hat:** Er prüft, ob die in `files:`/`tests:`
genannten Pfade existieren (T-M14-02), und ob jede Anforderung eine Aufgabe hat. Beides war
erfüllt: die Dateien existierten, sie enthielten nur nicht, was die Aufgabe versprach. Eine
Fertig-wenn-Zeile ist Prosa, und Prosa prüft kein Wächter.

**Was daraus folgt — und was ausdrücklich nicht:** Es folgt *nicht*, dass es einen Wächter
für Prosa braucht; den kann es nicht geben. Es folgt, dass eine mehrteilige Aufgabe je Teil
einen Test braucht, der ohne den Teil fällt. T-M12-08 und T-M12-10 tragen jetzt genau das:
die Kartenwahl wird an der Provinzzahl der begonnenen Partie gemessen, die Debug-Ansicht am
gerenderten Hash und an gefüllten Listen. Beide Tests wurden gegen den Stand von vorher
geprüft und fallen dort.

**Status: geschlossen** durch T-M12-08 und T-M12-10. Der Eintrag bleibt stehen, weil die
Fehlerklasse bleibt: „`done` heißt gebaut" gilt in diesem Projekt nur so weit, wie ein Test
es trägt.

---

## 2026-09-07 · R-AI-04 ist gemessen — und die Zahl war in die falsche Richtung falsch

**Der Befund vom 2026-09-06 stimmte:** R-AI-04 wurde auf **zwölf Provinzen mit drei
Mächten** gemessen, während die Anforderung „bei 8 KI-Spielern" sagt. Der gemeldete
Anteil (0,463, davor 0,498) war keine Aussage über die Anforderung.

**Was die Messung unter den richtigen Bedingungen ergibt** (Weltkarte, 237 Provinzen,
acht KI-Mächte, 480 Ticks):

| | gemessen | gefordert |
|---|---|---|
| KI-Median | 0,206 ms | — |
| Tick-Median | 2,569 ms | — |
| **Anteil** | **0,074** | < 0,30 |

**Die Anforderung hält mit Faktor 4.** Und das ist der eigentliche Punkt dieses Eintrags:
die alte Zahl war nicht nur unbelegt, sie war **irreführend pessimistisch**. 0,463 gegen
eine Grenze von 0,5 liest sich wie „knapp", und wer so liest, plant Optimierungsarbeit
gegen ein Problem, das keines ist. Genau das stand in T-M16-02 als „zwei Schnitte".

Der Grund für die Diskrepanz steckt im Quotienten. Auf zwölf Provinzen kosten KI und Tick
beide rund 0,065 ms — der Anteil liegt dort **von Natur aus** bei 0,5. Auf der Weltkarte
wächst die Tickzeit auf das Vierzigfache, die KI-Zeit nur auf das Dreifache. Der Anteil
fällt, ohne dass eine Zeile optimiert wurde.

**Die Lehre ist nicht „falsch gemessen"**, sondern spezifischer: *Ein Anteil ist auf einer
kleinen Karte keine kleinere Version desselben Anteils auf einer großen.* Die Fehlerklasse
E aus der Auswertung vom 2026-09-05 („jedes Messgerät misst das Falsche") hat hier eine
Untervariante — das Messgerät misst die richtige Größe unter Bedingungen, unter denen sie
etwas anderes bedeutet.

**Zwei Dinge daran wurden abgestellt:**

- Der Block auf der kleinen Karte hieß „bleibt unter dreissig Prozent der Tickzeit" und
  sicherte **fünfzig** zu. Der Titel nannte die Zahl der Anforderung, die Zusicherung ließ
  das Anderthalbfache durch, und belegt hat er keine von beiden.
- Er sicherte einen **Anteil** zu, der bei 0,487 gegen 0,5 lag: 2,6 % Reserve. Ein
  Geländer, das zufällig reißt, kostet die Untersuchung, die es sparen soll — dieselbe
  Lektion, die das Tickbudget am 2026-09-06 erteilt hat. Es misst jetzt die absolute
  KI-Zeit, wo die Reserve das Achtfache beträgt.

**Status: geschlossen** durch T-M16-02. Die beiden Schnitte sind nicht gebaut und werden
nicht als Aufgabe geführt — Begründung in `DECISIONS.md`, 2026-09-07.

---

## 2026-09-07 · Der Ozean überlappt kein Land — es fehlt einfach

**Gemeldet** von Noah im Abnahme-Playtest: „im Westen der USA und Nordkanada ein Map-Problem:
der Ozean überlappt mit dem Land."

**Gemessen** wurde das Gegenteil. Es überlappt nichts: über alle 237 Provinzen gibt es vier
Überlappungspaare, das schlimmste 39 px² groß. Der Renderer malt zuerst das Meer über die
ganze Leinwand und dann die Provinzen darüber (`MapCanvas.tsx:119`) — **wo kein Polygon
liegt, ist Meer.** Was Noah gesehen hat, war ein Loch.

**Die Ursache ist ein Ausdruck** in `scripts/build-map.mjs:366-370`:

```js
p.geometry.coordinates.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]
```

`a[0].length` ist die **Zahl der Punkte**, nicht die Fläche. Für „Westen der USA" wählt das
Alaskas Küste (1521 Punkte) und wirft die zusammenhängenden Weststaaten weg (320 Punkte).
Alaskas Fjorde brauchen viele Stützpunkte, Nevadas gerade Vermessungslinien wenige.

| | |
|---|---|
| Umrisse verworfen | **3156 von 3393 (93 %)** |
| Landfläche nie gezeichnet | **14,2 %** |
| Provinzen betroffen | **130 von 237** |
| schwerster Fall | `CAN-NORTH` behält **11,6 %** von sich — es zeichnet die Baffininsel und verliert das Festland |

Los Angeles, Seattle, Denver, Phoenix, Tokio, Kuala Lumpur, Kopenhagen und Belfast liegen in
`world.json` im offenen Meer. Bei vier Provinzen (`USA-WEST`, `CAN-NORTH`, `NZL`, `FJI`) sitzt
zusätzlich die Beschriftung außerhalb der gezeichneten Form, weil `center` aus der **echten**
Geometrie kommt und `polygon` aus der gewählten.

**Die Falle in der naheliegenden Reparatur** — und sie ist der Grund, warum dieser Eintrag
so ausführlich ist:

| Ring | Punkte | echte Fläche | nach Mercator |
|---|---|---|---|
| Alaska | 1521 | 267,8 Grad² | **84 453 px²** |
| Weststaaten | 320 | **328,6 Grad²** | 58 147 px² |

„Nimm den größten Ring" klingt richtig und **behebt den gemeldeten Fehler nicht**, wenn man
die Fläche nach der Projektion misst: Mercator bläht hohe Breiten mit 1/cos²(φ) auf, Alaska
gewinnt wieder. Zwei unabhängige Messungen dieser Sitzung kamen deshalb zu entgegengesetzten
Ergebnissen — die eine rechnete in Grad², die andere in Pixel². **Beide hatten recht.**

**Warum es niemand gefunden hat:** kein Test im Projekt sagt etwas über `polygon`.
`validateMap` prüft `polygon.length >= 3` und nichts weiter. Der eine Test, der geografische
Lage prüft und sogar `USA-WEST` beim Namen nennt, zeigt auf `world-shapes.json` — die Quelle,
wo die Geometrie vollständig und richtig ist. Das ist **Befund N9** der Auswertung vom
2026-09-05 („kein Test bindet `world.json` an die Pipeline"), seither offen und ohne Besitzer.

**Und ein Eintrag hier ist dadurch falsch geworden:** die Notiz vom 2026-09-03 stellte über
genau diese Provinzen fest, „die Karte zeichnet richtig". Sie war für `world-shapes.json`
wahr und für `world.json` falsch — geprüft wurde die Quelle, ausgeliefert wird das Erzeugnis.

**Status: geplant, nicht gebaut.** M19 (T-M19-01 bis -05), Entwurf D21, Anforderungen
R-MAP-08 und R-MAP-09. Die Reihenfolge ist Absicht: erst der Wächter mit seiner roten Zahl,
dann die Reparatur, dann der Bildbeleg.

---

## 2026-09-07 · Der Einstieg ist enger, als jede Zahl im Plan bisher sagte

Aufgenommen bei der Bestandsaufnahme für M21. Alle Zahlen aus den Regeldateien gerechnet,
mit den Rundungsfunktionen des Projekts.

**Der erste Spieltag.** Dem Spieler stehen rund **52 Bedienelemente** gegenüber — 36 in der
Provinzansicht, 16 in Kopf- und Seitenleiste. **Genau eines bringt ihn voran:** „Kaserne
bauen". Die übrigen 17 Befehlsknöpfe sind abgelehnt, mit **16 sichtbaren Ablehnungssätzen**
untereinander. Wählt er eine Armee, kommen neun weitere Knöpfe, sechs davon abgelehnt.

Das ist die gemessene Gestalt von „überfordert": nicht zu viele Möglichkeiten, sondern ein
Wald aus Absagen, in dem die eine offene Tür nicht auffällt.

**Der Spieler startet mit null Armeen** (`create.ts:184`). Nichts sagt es ihm.

**Die erste Einheit steht an Tick 43** — Spieltag 2, 19:00. Die Moral skaliert die Bauzeit:
Kaserne 24 → 27 Ticks, Infanterie 12 → 16.

**Die erste Eroberung ist frühestens an Spieltag 7 möglich.** Die Standardpartie beginnt als
Vereinigte Staaten, und die haben **keinen neutralen Nachbarn** — 201 von 237 Provinzen sind
herrenlos, aber jeder Landnachbar der USA gehört einer KI.

**Und nur Eroberung zählt.** Die vier Startprovinzen tragen 40 Provinzpunkte und **2825
Bevölkerungspunkte**: die Bevölkerung ist **98,6 %** des Punktestands. Eine Kaserne bringt 2,
eine Infanterie 1. Eine einzige Eroberung wiegt mehr als 285 Kasernen. Wer das nicht weiß,
baut aus — und wird dafür bestraft: ab der dritten Provinz kostet jede weitere 3000 Zielmoral
im ganzen Reich (`morale.ts:66-72`), unerklärt.

### Drei Auskünfte, die falsch sind oder nie ankommen

Diese drei sind keine Entwurfsfragen, sondern Fehler — **Status: behoben am 2026-09-07
(T-M21-06).** Jede der drei hat jetzt einen Test, der gegen den alten Stand nachweislich
rot ist; die Einzelheiten stehen unten unter „Was ungeprüft bleibt".

1. **Die Kosten gesperrter Dinge erreichen den Bildschirm nie.** `Panels.tsx:81` setzt
   `title={action.disabledReason ?? action.hint ?? undefined}`; bei einem gesperrten Knopf
   gewinnt der Grund. `availabilityHint()` liefert seinen Text **nur, solange die Sache
   gesperrt ist** — also genau dann, wenn er verworfen wird. **Toter Code, gebaut in
   T-M15-03**, und der Test dazu prüft die Daten statt den gerenderten Baum. Dieselbe
   Fehlerklasse wie T-M14-13 und AK-7: erledigt geführt, ohne zu wirken.
2. **Die Erklärung zum Frieden ist falsch.** `de.ts:490` sagt „Truppen dürfen die Grenze nicht
   überschreiten"; `movement.ts:33` ruft `findPath` ohne `canEnter`. Frieden hindert nur am
   *Behalten*, nicht am Betreten. Wer dem Text glaubt, hält seine Grenze für sicher.
3. **Die Anleitung widerspricht dem Spiel.** `ANLEITUNG.md:124`: „Es gibt nichts zurück."
   Der Code erstattet die Hälfte. Derselbe Irrtum stand im Playtest-Bogen und ist dort am
   2026-09-06 berichtigt worden — in der Anleitung steht er noch. **Zwei Wahrheiten über
   dieselbe Sache**, und die berichtigte war die weniger gelesene.

### Eine Balancing-Beobachtung, die nicht hierher gehört, aber notiert sein will

**Eine Kriegserklärung macht langsamer.** Auf fremdem Boden gilt Marschfaktor 0,7, im Krieg
0,35 (`constants.json:37-38`). Der Weg USA-SOUTH → MEX-NE kostet 106 Ticks im Frieden und 211
im Krieg. Der schnellste Eröffnungszug ist damit der **Überraschungsangriff**, der 200 Ansehen
kostet und automatisch Krieg auslöst. Ob das so gemeint ist, ist eine Balancing-Frage für
Noah — sie steht hier, damit sie nicht verloren geht.

> **Entschieden am 2026-09-07 (T-M24-03):** gemessen über 0,35/0,5/0,7 und auf **0,5**
> gesetzt — Kriegsmalus halbiert statt gestrichen. Zahlen und Begründung in
> `DECISIONS.md` (2026-09-07 · T-M24-03), Messwerte in `docs/reports/warmarch.json`.

---

## 2026-09-07 · T-M19-04 · „Südostaustralien" trägt seinen Namen weiterhin nicht

**Befund:** `AUS-SE` heißt Südostaustralien und besteht aus dem Australian Capital Territory,
Jervis Bay und der Macquarie-Insel — zusammen 43 px². Victoria und New South Wales, die den
Namen tragen würden, stecken in `AUS-NE`. Das ist ein Kuratierungsfehler in
`data/maps/world-provinces.csv:12` (`sourceUnits: AUS-2653 AUS-1932 AUS+00?` — der letzte
Eintrag ist nicht einmal eine gültige Kennung), kein Fehler des Generators.

**Anklickbar ist die Provinz seit T-M19-04**, und damit ist sie spielbar. Der Name bleibt
falsch.

**Warum es hier steht und nicht behoben ist:** Die Behebung heißt, `world-provinces.csv` die
Quelleinheiten Victoria und New South Wales zu geben und **`pnpm map:build` laufen zu lassen**.
Das Skript liest die Natural-Earth-Shapefiles unter `data/geo/`, und die liegen nicht im Baum
(`data/.gitignore`); sie zu holen ist der einzige Netzzugriff des Projekts. Vor allem aber
würde ein voller Lauf die **Anreicherung neu ausführen** — Bevölkerung, Gelände und Vorkommen
aller 237 Provinzen — und damit die Zahlen ändern, gegen die das Balancing gemessen und AK-1
belegt wurde. Eine Namenskorrektur würde die Partie neu würfeln.

**Kleinster reproduzierbarer Fall:**
```
node -e "const w=require('./data/maps/world.json');const p=w.provinces.find(x=>x.id==='AUS-SE');console.log(p.name,p.population)"
→ Südostaustralien 52097     (Victoria und NSW haben zusammen rund 14 Millionen)
```

**Status: offen, Entscheidung liegt bei Noah.** Drei Möglichkeiten, alle vertretbar:

1. **Umbenennen** — „Hauptstadtterritorium" statt „Südostaustralien". Kostet nichts, ändert
   die Partie nicht, und die Karte sagt dann die Wahrheit.
2. **Zuschnitt korrigieren** und die Karte samt Balancing neu bauen. Braucht die Geodaten, einen
   neuen `sim:fullgame` und einen neuen Abnahmelauf.
3. **So lassen.** Die Provinz ist spielbar; nur ihr Name ist irreführend.

Die erste ist die billigste ehrliche Antwort und wäre die Empfehlung.

---

## 2026-09-07 · T-M21-06 · Was ungeprüft bleibt: Prosa gegen Regeln

**Befund:** Alle drei Falschauskünfte vom 2026-09-07 sind behoben, jede mit einem Test, der
gegen den alten Stand fällt:

| | Fehler | Prüfung |
|---|---|---|
| (a) | Der Tooltip eines gesperrten Knopfs verschluckte die Kosten | `Panels.test.tsx` am gerenderten Baum: `expected 'Erst ab Spieltag 8' to contain '750 Geld'` |
| (b) | „Truppen dürfen die Grenze nicht überschreiten" — sie dürfen | `occupation.test.ts` gegen den **Code**: ein Marsch mitten durch fremdes Gebiet gelingt, die Eroberung nicht |
| (c) | „Es gibt nichts zurück" — der Code erstattet die Hälfte | `docs.test.ts` gegen `CANCEL_REFUND_PERMILLE` |

**Was damit nicht geprüft ist, und das ist die eigentliche Meldung:** die allgemeine
Fehlerklasse „**die Anleitung nennt eine Zahl oder eine Regel, die dem Code
widerspricht**" bleibt ungeprüft. Der Wächter zu (c) hält *eine* Aussage gegen *eine*
Konstante; er weiß nichts über die übrigen vierhundert Zeilen der Anleitung.

**Warum kein breiterer Wächter gebaut wurde:** Prosa lässt sich nicht gegen JSON diffen.
Eine Regel wie „jede Zahl in `ANLEITUNG.md`, die auch in `constants.json` steht, muss dort
denselben Wert haben" klingt billig und ist es nicht — sie schlägt bei jeder Jahreszahl, bei
jeder Tastenbezeichnung und bei jeder umformulierten Erklärung an. Ein Wächter, der öfter
falsch als richtig meldet, wird nach dem dritten Mal abgeschaltet, und dann ist die Lage
schlechter als vorher: es steht ein Test da, der nichts mehr prüft.

Verschärfend hätte er **genau diesen Fall nicht gefangen**: `CANCEL_REFUND_PERMILLE` steht
in `packages/core/src/rules/build.ts`, nicht in `constants.json`.

**Was stattdessen hilft, wenn die Klasse wieder zuschlägt:** dieselbe Bauart wie (c) — für
die einzelne Aussage, die falsch war, ein Test gegen die einzelne Größe, die sie meint. Das
ist Handarbeit je Fall und ehrlich darüber.

**Status: bewusst offen, dokumentiert.** Keine Aufgabe, kein Termin — eine benannte Lücke.

---

## 2026-09-07 · T-M21-01 · Anzeigetext außerhalb des bewachten Bereichs

**Befund:** `test/guards/prose-in-code.test.ts` prüft seit heute die Gegenrichtung zu
`text-keys.test.ts`: nicht nur, ob jeder abgefragte Schlüssel existiert, sondern ob es
Text **ohne** Schlüssel gibt. Der bewachte Bereich ist eng — `game/tutorial.ts` und
`ui/*.tsx` —, und das ist eine Entscheidung, keine Nachlässigkeit.

**Außerhalb liegt Anzeigetext, der dieselbe Prüfung verdiente.** Beim Ziehen der Grenze
gemessen und hier festgehalten, damit es nicht verlorengeht:

| Datei | Text |
|---|---|
| `apps/desktop/src/storage/createStorage.ts` | „Dieser Browser bietet keinen dauerhaften Speicher. Spielstände gehen beim Schließen verloren." |

Dazu kommt eine ganze Klasse, die die Regel prinzipiell nicht sieht: **Text zwischen
JSX-Marken.** `<p>Ein ganzer Satz hier</p>` ist kein Zeichenketten-Literal. Heute gibt es
davon keinen Fall, aber die Regel würde einen auch nicht melden.

**Warum der Bereich nicht größer ist:** Jede Ausweitung bringt neue Fehlalarme mit —
CSS-Selektoren, Schriftlisten, SVG-Pfade, Meldungen an die Entwicklerkonsole. Drei davon
sind schon in diesem engen Bereich aufgetreten und mussten einzeln ausgenommen werden. Ein
Wächter, der öfter falsch als richtig meldet, wird abgeschaltet, und dann ist die Lage
schlechter als ohne ihn.

**Status: bewusst offen, dokumentiert.** Die eine bekannte Stelle ist genannt; wer den
Bereich ausweitet, weiß, was ihn erwartet.

---

## 2026-09-08 · Sichtprüfung nach M25–M27 · Ein Marschbefehl verschwand spurlos — der setState-Updater war unrein

**Symptom (nur im echten Programm, kein Test sah es):** Armee wählen, Ziel wählen,
„Marsch befehlen" — keine Ablehnung, keine Quittung, kein Protokolleintrag, kein Marsch,
auch nach dem Vorspulen nicht. Konsole leer.

**Ursache:** `fastForwardRun` (App.tsx) rechnete die Simulation **im
setState-Updater** und mutierte dabei Laufvariablen (`playerCommands = []`,
`ticksRun +=`). Die echte Anwendung rendert in `<StrictMode>` (main.tsx), und React
ruft Updater dort **doppelt**: der erste Lauf verbrauchte die gesammelten Befehle
(T-M22-05) und sein Ergebnis wurde verworfen; der zweite — dessen Ergebnis zählt —
rechnete ohne sie. Derselbe Mechanismus verdoppelte `ticksRun`: die Stoppmeldung sagte
seit M21 konstant „Angehalten nach 2 Tagen", wenn ein Tag übersprungen wurde — im
Playtest V2 notiert, für einen Textfehler gehalten, tatsächlich dieselbe Wurzel.

**Warum kein Test biss:** alle App-Tests rendern `<App/>` **ohne** StrictMode — die
Testumgebung war freundlicher als die Anwendung. Der neue Test rendert wie main.tsx
(`App.test.tsx`, „verliert gesammelte Befehle nicht, wenn React den Updater doppelt
ruft") und fiel gegen den alten Stand mit exakt dem Playtest-Symptom.

**Reparatur:** Die Rechnung verlässt den Updater. `stateRef` (synchron gepflegter
Spiegel) liefert den Ausgangszustand, `chunk` reicht den Zustand explizit weiter,
`setState` setzt nur noch Ergebnisse. `step()` gleich mitgezogen (dort war der
Doppellauf ergebnisgleich, aber `noteTrace` feuerte zweimal) — danach hat App.tsx
keinen rechnenden Updater mehr.

**Regel für die Nachwelt:** Ein setState-Updater ist eine **pure Funktion** — wer darin
rechnet, was Seiteneffekte hat oder Laufvariablen mutiert, baut einen Fehler, den nur
die echte Anwendung zeigt. Und: mindestens ein Test je App rendert **in demselben
StrictMode wie der Einstiegspunkt**, sonst prüft die Testumgebung eine andere Anwendung.

---

## 2026-09-08 · T-M28-03 · Zwei Randnotizen von der Bündel-Messung

1. **Die Messung musste abbrechen, weil der Bildschirm besetzt war.** Die AK-8-Messung
   simuliert Eingaben im Vordergrund — und der Kontroll-Screenshot zeigte ein fremdes
   Vollbildspiel (Noah spielte gerade). Simulierte Klicks wären in **sein** Spiel
   gegangen; der Abbruch war die einzig richtige Wahl. Regel für die Nachwelt: **vor
   simulierten Eingaben immer erst ein Screenshot, und wenn darauf nicht das eigene
   Zielfenster zu sehen ist, keine einzige Taste senden.** Das Bündel selbst ist frisch
   gebaut (36b63a8); nur die Messung wartet auf einen freien Bildschirm.
2. **`autosave-0.json.json`** — die Spielstände des Datei-Ports tragen eine
   Doppelendung: der Slotname enthält bereits `.json`, der Port hängt ein zweites an.
   Funktional folgenlos (Schreiben und Lesen sind symmetrisch, der M25-Zeitreihen-Test
   stolperte deshalb schon über den Slotnamen), aber unsauber. Kleiner Kandidat für
   T-M28-06+.

---

## 2026-09-08 · T-M28-03 · AK-8 war am neuen Bündel gebrochen — die Scope-Prüfung des fs-Plugins kanonisiert sich selbst ins Aus

**Symptom:** Das frische Bündel schrieb Spielstände („Gespeichert.", Datei auf der
Platte) — aber jede Anzeige blieb „leer", kein Laden, kein Weiterspielen-Knopf. Im
Browserbau (IndexedDB) war derselbe Code gesund.

**Falsifikationskette** (über CDP am laufenden Programm, jede Hypothese gemessen):

| # | Hypothese | Messung | Ergebnis |
|---|---|---|---|
| 1 | Separator-Mix (`saves/stand-1.json` hinter `\`-Pfad) | `exists('saves')` ganz ohne Separator ebenso „forbidden" | widerlegt |
| 2 | Crate-/npm-Versionen seit der alten Messung gewandert | Cargo.lock und pnpm-lock.yaml unverändert | widerlegt |
| 3 | Fehlender expliziter `fs:scope` | ergänzt, neu gebaut → weiter „forbidden" (Capability nachweislich einkompiliert) | widerlegt |
| 4 | Laufzeit-Freigabe fehlt | `fs_scope().allow_directory` beider Schreibweisen → `Ok`, und `is_allowed` im selben Prozess direkt danach `false` (Diagnosedatei aus dem Setup-Hook) | widerlegt |
| 5 | `is_allowed` kanonisiert existierende Pfade (`\?\C:\…`), kein Muster passt | **Geisterdatei: `exists` → sauber `false`. Existierende Datei, gleicher Pfad: „forbidden"** | **bestätigt** |

Damit erklärt sich auch die Asymmetrie, die alles verschleierte: **Schreiben neuer
Dateien ging immer** (nichts zu kanonisieren), das Wiederlesen nie.

**Reparatur:** kein Kampf mehr gegen das ACL — die Hülle hat **sechs *(korrigiert 2026-09-13: fünf)* eigene, engere
Kommandos** (`saves_list` … `saves_exists`, `src-tauri/src/main.rs`): Dateiname statt
Pfad (Separatoren/`..` werden verweigert), fest auf `$APPDATA/saves`.
`tauri-plugin-fs` samt Berechtigungen entfernt; `TauriStorage` ruft `invoke`, die
Vertragsreihe läuft gegen eine Nachbildung der Kommandos mit denselben Regeln.
AK-8 danach vollständig neu gemessen: `docs/reports/packaging.md`.

**Zwei ehrliche Ränder:**
1. Die **Messung vom 2026-09-07** (gegen `1c33ec7`) meldete Schritt 6 als bestanden —
   mit identischem Code, identischen Rechten, identischen Abhängigkeiten heute nicht
   reproduzierbar. Sie bleibt als nicht nachvollziehbar markiert.
2. **Warum kein Test es sah:** die Vertragsreihe prüft den Port gegen eine
   Nachbildung — die Scope-Prüfung der Plattform kommt darin nicht vor und ist mit
   jsdom auch nicht erreichbar. Die Regel daraus: **was eine Plattform-Berechtigung
   durchsetzt, gilt erst nach einer Messung am gebauten Erzeugnis** — genau die
   AK-8-Messung, die diesen Fehler gefunden hat. Sie gehört nach jedem Umbau am
   Speicherweg wiederholt.

## 2026-09-11 · T-M32-02 · CRLF im Arbeitsbaum macht den Prosa-Wächter blind für Kommentare

**Befund:** `pnpm verify` meldete am M32-Tor einen Prosa-Fund in einer Zeile, die seit
T-M25-03 unverändert ist — einem **Kommentar** in `Panels.tsx`. Ursache ist nicht die
Zeile, sondern das Zeilenende: `ohneKommentare()` in
`test/guards/prose-in-code.test.ts` streift Zeilenkommentare mit `/(^|[^:])\/\/.*$/`.
In JavaScript ist `` ein Zeilenende, `.` trifft es also nicht, und `$` steht ohne
`m`-Flag am Ende der Zeichenkette — **hinter** dem ``. Auf einer CRLF-Zeile greift der
Ausdruck nie, der Kommentar bleibt stehen, und sein Inhalt wird als Spielertext gemeldet.

**Kleinster reproduzierbarer Fall:**
`"  // Text".replace(/(^|[^:])\/\/.*$/, "$1")` gibt die Zeile unverändert zurück;
ohne `` gibt sie `"  "`.

**Wie es entstand:** ein Bearbeitungsskript schrieb mehrere Dateien mit Pythons
Standard-Zeilenendeumsetzung und machte aus LF im Arbeitsbaum CRLF. Die **Commits waren
nie betroffen** — `.gitattributes` trägt `* text=auto eol=lf`, git normalisiert beim
Einchecken. Sichtbar wurde es erst im Wächter.

**Status: umgangen, nicht behoben.** Die 20 Dateien sind zurück auf LF, `pnpm verify`
ist grün. Die Fehlerrichtung ist die sichere — der Wächter wird zu streng, nicht zu
lax —, und ein `?$` im Ausdruck wäre die Reparatur. Sie steht aus, weil sie einen
eigenen Test verlangt (eine CRLF-Fixture), und weil die eigentliche Regel lautet:
**Dateien im Arbeitsbaum bleiben LF.**

---

## 2026-09-11 · T-M28-08 · Im Vorschaufenster ist kein tickgenaues Bild zu fangen

**Befund:** Die Sichtprüfung der Gefechtsdarstellung scheiterte in **fünf** Anläufen über
drei Partien, und der Grund ist keiner der vermuteten. Er ist strukturell: **im
Browser-Vorschaufenster läuft die Spieluhr nicht.** `requestAnimationFrame` wird dort
gedrosselt, und die Tempostufen hängen an der Bildschleife — auf Stufe 10 blieb die Uhr
über sechzig Messungen in vierundzwanzig Sekunden auf **Tag 106 · 00:00** stehen. Die
einzige Möglichkeit, Zeit zu bewegen, ist der Knopf „Vorspulen", und der springt einen
**ganzen Spieltag**.

Ein Gefecht dauert wenige Ticks; `view.battles` trägt nur die des laufenden Ticks. Ein
Tagessprung landet deshalb fast immer **zwischen** zwei Gefechten. Gemessen: bei Tag 106
lagen Gefechte bei 105 · 19:00 und 104 · 18:00 im Protokoll, und die Überzugsebene
enthielt in diesem Augenblick **null** Pixel in Gefechts- oder Bernsteinfarbe.

**Kleinster reproduzierbarer Fall:** Partie starten, Tempo 10 wählen, vierundzwanzig
Sekunden lang die Uhr lesen — sie steht. Danach „Vorspulen" drücken: die Uhr springt um
einen Tag.

**Was nicht hilft, und warum:**
- *Auf ein eigenes Gefecht warten.* Der Vorspul-Stopp greift beim Alarm — er hält aber am
  Tick **nach** dem Gefecht an, und bei einer kleinen Armee ist es da schon entschieden.
- *Die Farbe auf der Leinwand zählen.* Feindliche Stapel tragen seit T-M30-01 denselben
  Zinnober im Rahmen, die Auswahl denselben Bernstein wie die Einschlagzeichen. Ohne
  Auswahl und ohne Alarm bleibt die Probe trotzdem mehrdeutig, solange Feindmarker im Bild
  sind — und im Krieg sind sie das.
- *Den Tooltip lesen* („Gefechtsrunde n" aus `view.battles`). Er braucht eine **gewählte**
  Provinz, und die Auswahlliste führt nur die dreizehn sichtbaren — die Gefechte der KI
  lagen außerhalb.

**Status: offen, und es ist kein Produktfehler.** Gebunden ist die Zeichenarbeit durch
`MapCanvas.test.tsx` (Schein als gefüllter Bogen, Ring, Bernstein der Einschläge,
Deckkraft unter eins) und die Geometrie durch `render.test.ts`/`motion.test.ts`. Was fehlt,
ist Noahs Urteil an seinem eigenen Maßstab: **fällt ein Krieg im Vorspulen auf, ohne dass
man das Protokoll liest?** Das beantwortet ein großes Fenster und ein Mensch, keine
Pixelprobe. Für künftige Sichtprüfungen gilt derselbe Befund allgemein: **alles, was nur
einen Tick lang sichtbar ist, ist im Vorschaufenster nicht prüfbar.**

---

## 2026-09-11 · Durchsicht M29–M31 · Elf Befunde in Code, der schon auf `main` liegt

**Befund:** Nachdem eine adversarische Durchsicht drei schwere Fehler in der frischen
M32-Arbeit gefunden hatte, bekam der **bereits gemergte** Kriegsrat-Umbau dieselbe
Behandlung: vier Prüfer über `git diff ec36bef..c372ba4`, je Befund ein Skeptiker mit dem
Auftrag zu widerlegen. **13 gemeldet, 11 überlebten, vier davon schwer.** Der Stand hatte
`pnpm verify`, `pnpm acceptance` 11/11 und Sichtprüfungen am laufenden Spiel bestanden.

| # | Schwere | Ort | Befund |
|---|---|---|---|
| 1 | hoch | `map/anchors.ts` | `placeBuildings` reserviert **immer** zwei Küstenplätze, auch in Binnenprovinzen. Reichen die übrigen nicht für die fünf Landarten, fällt der Modulo-Rückfall auf belegte Anker und das Gebäude wird **verworfen** — während die reservierten leer bleiben. 32 Provinzen der Weltkarte liefern 3–6 Anker und sind betroffen |
| 2 | mittel | `map/anchors.ts` | Der Rückfall-Anker ist der Provinzmittelpunkt — genau der Punkt, auf den auch der Armeekasten kommt. Der 30×18-Kasten deckt das 14×14-Quadrat restlos. **92 von 237 Provinzen** laufen in diesen Rückfall. Der alte `BUILDING_OFFSET_Y` verhinderte genau das und ist auf dem Ankerpfad weg |
| 3 | mittel | `map/markers.ts` | `pickArmy` nimmt bei gleichem Abstand die **erste** Armee, gezeichnet wird die **letzte**. Bei zwei eigenen Stapeln in einer Provinz wählt der Klick die verdeckte; die sichtbare ist per Karte nie anwählbar |
| 4 | hoch | `ui/Panels.tsx` | Das Bauplatz-Raster wird **bedingungslos** gezeichnet. Bei einer fremden Provinz kennt die Sicht keine `buildings` — das Raster zeigt sieben freie Plätze und behauptet damit „hier steht nichts". Die alte Fassung zeichnete die Zeile nur bei vorhandenen Gebäuden und brach die Nebelregel nicht |
| 5 | mittel | `ui/Panels.tsx` | Je Gebäudeart **ein** Feld, aber der Kern erlaubt mehrere gleichzeitige Aufträge derselben Art (`buildSlots` 2). Der zweite bezahlte Auftrag hat im Panel weder Fortschritt noch Fertigstellung; beide Abbrechen-Knöpfe heißen gleich |
| 6 | hoch | `map/modes.ts` | `colorForPlayer` hat elf Farben; der Startdialog erlaubt bis zu **zwölf** Mächte. Ab der zwölften wiederholt sich eine Farbe, und zwei Mächte sind im Besitzmodus nicht unterscheidbar |
| 7 | niedrig | `test/guards/css-mirrors-tokens.test.ts` | Der Spiegel-Wächter sieht nur sechsstellige Hex-Werte im **ersten** `:root`-Block. Zwei Farben der abgelösten hellen Richtung stehen unbemerkt in `app.css`, und ein `rgb(...)` im `:root` bliebe unentdeckt |
| 8 | hoch | `App.tsx` | **Die Leertaste auf einem fokussierten Knopf pausiert das Spiel, statt den Knopf auszulösen.** Wer ohne Maus bedient, kann keinen Knopf mit der Leertaste betätigen — auch „Vorspulen" nicht |
| 9 | hoch | `ui/Header.tsx` | Ist die Geschwindigkeit keine Raste aus `SPEED_STOPS` (etwa durch die eingestellte Höchstgeschwindigkeit), ist in der Tempo-Gruppe **kein** Knopf gedrückt — der Klick sieht folgenlos aus |
| 10 | mittel | `ui/Header.tsx` | Während des Vorspulens sind **zwei** Knöpfe derselben Gruppe gedrückt (Pause und Abbrechen); erwartet ist genau einer |
| 11 | mittel | `App.tsx` | Die Leertaste setzt beim Fortsetzen `speed = 10` und **umgeht damit die eingestellte Höchstgeschwindigkeit** (bei Maximum 2 läuft das Spiel danach fünffach zu schnell) |

**Zwei Befunde wurden widerlegt** und sind hier nur der Vollständigkeit halber genannt:
ein behaupteter Versatz zwischen Standpunkt und Armeekasten beim Vorspulen, und
ungeprüfte Schrift/Marker in den Verlaufsmodi.

**Status: als Aufgaben geschnitten** (T-M28-09 … T-M28-15), nicht sofort alle gebaut. Die
Reihenfolge steht in `03-TASKS.md`; angefangen wird bei denen, die die Bedienung ohne Maus
betreffen.

**Die Lehre steht über den elf Befunden:** ein Stand mit grünen Tests, grüner Abnahme und
bestätigter Sichtprüfung hatte elf echte Fehler, und keiner davon war teuer zu finden —
nur hatte niemand gesucht. Eine adversarische Durchsicht gehört ans Ende jedes
Meilensteins, nicht ans Ende des Projekts.

---

## 2026-09-11 · Abschlussprüfung · `pnpm verify` konnte im Hauptcheckout nie grün sein

**Befund:** Der erste `pnpm verify` auf `main` nach dem Merge meldete **1684 Lint-Probleme**
(1188 Fehler). Keines davon stammt aus dem Quellcode dieses Baums: ESLint las die **acht
git-Worktrees** unter `.claude/worktrees/` mit — jeder eine vollständige Kopie des
Projekts, samt eigener `node_modules`-freier Quellen und alter Stände.

**Kleinster reproduzierbarer Fall:** `pnpm lint` im Hauptordner, solange ein Worktree
existiert. Die Pfadverteilung der Meldungen sagt es selbst: 294 aus `.claude`, 37–38 je
Baum, null aus `apps/`, `packages/` oder `test/`.

**Warum es niemandem auffiel:** Seit Monaten wurde ausschließlich **in** einem Worktree
gearbeitet, und dort liegen keine weiteren Bäume — `pnpm verify` war dort immer grün. Der
Hauptcheckout kam erst mit dem Merge wieder an die Reihe, und damit zum ersten Mal die
Konstellation, in der der Lauf nicht bestehen kann.

**Behoben:** `.claude/**` steht jetzt in den `ignores` von `eslint.config.js`, mit der
Begründung im Kommentar. `pnpm verify` auf `main`: **1825 Tests, Exit 0.**

**Die Lehre:** Ein Prüflauf, der nur an einem Ort ausgeführt wird, ist nur an diesem Ort
belegt. Die Prüfkette gehört mindestens einmal dorthin, wo am Ende gemerged wird.

---

## Ein Wächter, der seit Monaten nichts bewacht (2026-09-11, beim Planen von M33 gefunden)

`apps/desktop/src/ui/icons.test.tsx:48` verspricht, dass jeder Symbolpfad im 24er-Feld
bleibt. Der Ausdruck dafür lautet `/-?d+(.d+)?/g` — er sucht den **Buchstaben** `d`, nicht
eine Ziffer. In SVG-Pfaden kommt kein kleines `d` vor, die Suche liefert also für jedes der
44 Symbole nichts:

```
Treffer: 0   max: -Infinity   min: Infinity
```

`Math.max()` über einer leeren Liste ist `-Infinity`, `Math.min()` ist `Infinity`. Beide
Zusicherungen — „höchstens 24" und „mindestens 0" — sind damit **immer** erfüllt. Der Test
ist grün, seit er geschrieben wurde, und war es auch für ein Symbol, das quer aus dem Feld
ragt.

**Zwei Fehler, nicht einer.** Selbst mit `\d` wäre die Prüfung falsch: in `h-12` ist die
−12 eine *Länge*, keine Koordinate, und die untere Schranke „mindestens 0" würde gegen
jeden relativen Rückwärtsbefehl schlagen. Eine Feldprüfung braucht eine Pfadabfahrt, die
den Stift mitführt.

**Reparatur:** T-M33-01 (`docs/plan/EINHEITSBILDER.md`, Risiko 7) ersetzt sie durch eine
echte Abfahrt für beide Bildsätze — und führt sie **zuerst am alten Satz vor**, damit
belegt ist, dass sie rot werden kann.

**Die Regel daraus, wieder einmal:** eine Zusicherung über einer leeren Menge ist immer
grün. Jeder Wächter, der über eine Menge läuft, muss einmal gegen die leere Menge geprüft
werden — so wie es `no-foreign-assets.test.ts` und `ui-reachability` schon tun.

---

## 2026-09-12 · Der Plan-Wächter prüft die Maschinenfassung, nicht die, die ein Mensch liest

**Befund:** `03-TASKS.md` nennt **57 Dateien, die es nicht gibt** — in `- **Dateien:**`-Zeilen
von Aufgaben, die als `done` gelten. Vier davon sind Umzüge (`MapCanvas.tsx` liegt heute
unter `src/map/`, `constants.json` unter `data/rules/default/`, `registry.ts` unter
`commands/`, `save-v1.json` unter `test/golden/`); der Rest wurde nie gebaut oder anders
umgesetzt, darunter ein ganzer Worker-Strang (`sim/SimHost.ts`, `worker.ts`, `protocol.ts`),
eine Zeile UI-Dateien, die am Ende anders geschnitten wurden, und drei Berichte
(`ai-parity.md`, `ak1-full-game.md`, `progress-baseline.md`).

**Warum es niemand sah:** `test/plan-consistency.test.ts` prüft `files:` und `tests:` in
**`tasks.yaml`** — dort sind 0 von 336 Pfaden tot, sauber. Die Prosafassung daneben, die der
Dateikopf ausdrücklich als „what a human reads" bezeichnet, ist **nie geprüft worden**. Die
beiden Zwillinge sind an genau der Stelle auseinandergelaufen, an der kein Wächter steht.

**Das ist dieselbe Fehlerklasse wie am 2026-09-05** („der Plan-Wächter liest die Dateilisten
nicht — 79 von 289 Pfaden tot, alle bei `status: done"`). Die Reparatur von damals hat den
Wächter auf `tasks.yaml` scharf gemacht und ist dort geblieben. Eine Reparatur, die auf
**einen** Fundort angewandt wird statt auf die Fehlerklasse — auch das steht schon im
Lessons Log.

**Status: behoben am 2026-09-13** (Abschnitt am Ende; bis dahin offen, kein Produktfehler).
Nichts davon beeinflusst das Spiel; die Wirkung
trifft den, der im Plan nachschlägt, wo etwas steht, und an einen Pfad gerät, den es nicht
gibt. **Die Reparatur ist zweiteilig:** den Wächter auf die `- **Dateien:**`- und
`- **Tests:**`-Zeilen von `03-TASKS.md` ausdehnen (er fällt dann sofort mit 57 Fundstellen),
und die Fundstellen abarbeiten — Umzüge korrigieren, nie Gebautes als solches kennzeichnen.
Vorher **am eigenen Maßstab vorführen, dass der erweiterte Wächter rot werden kann.**

**Gemessen mit:** einem Abgleich aller Backtick-Pfade in `docs/**/*.md` gegen das
Dateisystem, Umzüge über den Basisnamen erkannt.

**Eine Warnung zur Messung selbst:** Bei derselben Prüfung hat ein `grep -cU $''` in Git
Bash behauptet, über vierhundert Dateien trügen CRLF — auch `.gitattributes` und
Binärdateien. Das war **falsch**; das Muster traf nicht, was es sollte. Nachgemessen in
Python (`s.count('
')`) und am rohen Blob (`git cat-file`): **null**, im Arbeitsbaum wie
im Repository, und `git add --renormalize .` ändert nichts. Die Regel „Dateien im
Arbeitsbaum bleiben LF" ist eingehalten. Wer eine überraschende Messung bekommt, misst sie
mit einem zweiten Werkzeug nach, bevor er sie meldet.

**Behoben am 2026-09-13.** Der Wächter liest jetzt auch die Fassung, die ein Mensch liest:
`readProsePaths` und `missingProsePaths` in `test/plan-paths.ts` ziehen die Pfade aus den Zeilen
`Dateien` und `Tests zuerst` jeder Aufgabe (samt Fortsetzungszeilen, ohne Anmerkungen in
Klammern), und `test/plan-consistency.test.ts` prüft sie bei jeder Aufgabe auf `done`. Die
Leseregeln und die Kennzeichnung stehen im Kopf von `03-TASKS.md`.

- **Vorher, mit zwei Werkzeugen nachgezählt: 63 tote von 866 gelesenen Pfaden** — 55 in
  `Dateien` (von 777), 8 in `Tests zuerst` (von 89; dort zählen nur Pfade ab der Wurzel des
  Repos, weil die Prosa Kurznamen wie `App.test.tsx` benutzt). Ein Python-Abgleich und der neue
  Wächter lieferten dieselbe Liste, Pfad für Pfad. **Die 57 oben ließen sich nicht nachstellen** —
  sie stammen aus einer anderen Messung (alle Backticks in `docs/**/*.md`); eine Variante mit
  Anmerkungen und ohne Globs ergibt 70. Es gilt 63.
- **Umzüge, 5 Fundstellen, auf den heutigen Pfad korrigiert:** `ui/MapCanvas.tsx` →
  `map/MapCanvas.tsx` (T-M16-06), `ui/Dialog.tsx` → `ui/Dialogs.tsx` (T-M16-07),
  `full-game.slow.test.ts` → `fullgame.slow.test.ts` (T-M14-14, zweimal),
  `perf/tick.bench.ts` → `perf/tick.bench.slow.test.ts` (T-M8-03).
  **Zwei der vier Umzüge aus dem Befund waren keine:** `packages/core/src/commands/registry.ts`
  ist die Registry der Befehls-Handler, keine Kartenregistry — die Kartensammlung steht in
  `apps/desktop/src/main.tsx` —, und `save-v1.json` stand in `03-TASKS.md` schon richtig;
  `data/rules/constants.json` steht dort nur in einer Anmerkung, die den alten Pfad absichtlich
  nennt. Ein gleicher Dateiname ist kein Beleg für einen Umzug.
- **Nie gebaut oder gelöscht, 58 Fundstellen, gekennzeichnet statt gestrichen:** 54 tragen
  `(nie gebaut — …)`, 4 tragen `(gelöscht — …)` — die `sim/`-Dateien, die T-M15-06 selbst
  entfernt hat. Jede Kennzeichnung sagt, wo das Gebaute heute steht, nachgesehen am Code und an
  `git log --all`: außer den vier `sim/`-Dateien stand keiner dieser Pfade je im Repository.
- **Nachher: 0 tote von 929 gelesenen Pfaden** — die 866 von vorher und 63 Pfade, die die
  Kennzeichnungen als Ersatz nennen und die mitgeprüft werden. `tasks.yaml` ist unberührt.
- **Gegenprobe:** in T-M16-06 testweise wieder `apps/desktop/src/ui/MapCanvas.tsx` — der Wächter
  fällt mit „1 tote von 929 gelesenen Pfaden"; zurückgesetzt, grün. Dass er eine Kennzeichnung an
  einer vorhandenen Datei meldet und aus einem leeren Dokument nichts liest, belegen die
  Unit-Tests daneben; am echten Dokument sichert er zu, mindestens einen Pfad je erledigter
  Aufgabe gelesen zu haben.

---

## 2026-09-12 · T-M34-03 · Der Bauplan setzte eine Einheit vor das Gebäude, das sie verlangt

**Der Befund.** Die Tabelle in `FORTSCHRITT.md` D34.1, freigegeben am 2026-09-11, gab der
**Artillerie Tag 28 und der Fabrik Tag 30**. Die Artillerie verlangt eine Fabrik. Ein
Regelwerk mit dieser Reihenfolge wird vom Lader zurückgewiesen (`rules/load.ts`, seit
T-M15-02), und zwar aus einem guten Grund, der dort auch steht: der Auftrag scheiterte
sonst an `MISSING_BUILDING` statt am Spieltag, und der Spieler läse die falsche
Begründung.

**Warum es niemandem auffiel.** Die Tabelle war nach dem *Vorschlag* sortiert, nicht nach
dem Ist-Zustand — und in dieser Sortierung stehen 28 und 30 brav untereinander. Erst der
Blick auf die linke Spalte zeigt den Tausch: heute liegt die Artillerie mit Tag 9
**hinter** der Fabrik mit Tag 8. Derselbe Absatz sagte zwei Zeilen tiefer „die
Reihenfolge bleibt, die Abstände wachsen"; der Vorschlag widersprach seinem eigenen Satz.

**Wer es gefunden hat.** Kein Mensch, sondern der Test, den die Aufgabenbeschreibung
selbst verlangt: „kein Gebäude wird später frei als die Einheit, die es verlangt". Er
wurde vor der Datenänderung geschrieben, war gegen den alten Stand grün — ein **Haltetest**
— und wäre in dem Augenblick rot geworden, in dem die vorgeschlagenen Zahlen eingetragen
worden wären. Das ist der Ertrag von „Test zuerst" an einer Stelle, an der er sonst wie
Formalismus aussieht: der Test prüfte nicht die neue Zahl, sondern die Regel, die beim
Ändern der Zahl zerbrechen kann.

**Die Reparatur.** Die drei Zahlen 28, 30 und 34 bleiben, sie werden nur in der richtigen
Reihenfolge vergeben: Fabrik 28, Kampfpanzer 30, Artillerie 34. Der Bauplan trägt die
Korrektur mit Begründung (`FORTSCHRITT.md` D34.1), damit niemand die alte Tabelle für die
gültige hält.

**Die Lehre, über diesen Fall hinaus.** Eine Plantabelle, die nach der *neuen* Spalte
sortiert ist, verbirgt jede Umsortierung gegenüber der alten. Wer eine Leiter umschreibt,
sortiert die Tabelle nach dem **alten** Stand oder führt beide Ränge mit.

---

## 2026-09-12 · T-M34-04 · Die zweite Fortschrittsachse ist gebaut, und die KI klettert nicht

**Der Befund.** `nextBuildingFor` in `packages/ai/src/economy.ts` fragt für Kaserne,
Fabrik, Eisenbahn und Hafen `level(...) === 0` — sie baut jedes dieser Gebäude **genau
einmal** und sieht es danach nie wieder an. Das einzige Gebäude, das sie ausbaut, ist die
Festung (`level('fortress') < 2`). Gemessen über 200 Spieltage auf der Weltkarte, an allen
fünf Messpunkten von M34: **keine Macht kommt je über Fabrikstufe 1 hinaus**, auch nicht
am Ausgangswert, als eine Stufe noch nichts extra kostete.

**Warum das jetzt auffällt.** T-M34-04 hat den Gebäudestufen einen Preis gegeben und damit
aus der Buchführung eine Fortschrittsachse gemacht. Sie ist damit heute **eine Achse für
den Menschen allein**. R-AI-01 sagt „die KI kann alles, was der Spieler kann" — *können*
tut sie es (der Befehl steht ihr offen, der Kern kennt keinen Unterschied), sie *tut* es
nur nicht. Das ist eine Verhaltenslücke, keine Fähigkeitslücke, und deshalb kein Bruch der
Zusage; es ist trotzdem ein Spielervorteil, den niemand beschlossen hat.

**Was es nicht ist.** Es ist **nicht** die Ursache von Risiko 5 („bleibt die dritte
Fabrikstufe erreichbar"). Die dritte Stufe war schon unerreichbar, als sie so viel kostete
wie die erste — der Preis war nie das Hindernis.

**Die Reparatur, geschätzt klein.** Eine Zeile je Gebäude in `nextBuildingFor`, etwa
`if (available('factory') && level('factory') < 2 && province.kind === 'city') return 'factory'`,
und die Rücklage in `canAfford` entscheidet wie bisher, ob es dazu kommt. **Sie gehört
nicht in M34**, weil sie das KI-Verhalten ändert und damit eine eigene Messung braucht —
Grundlauf und Turnier, so wie jede der vier Zahlenaufgaben eine bekommen hat.

**Status: offen, kein Produktfehler.** Für Noahs nächste Planung vorgemerkt.

**Status seit 2026-09-13: behoben** (T-M41-01, T-M41-02). Die KI baut die Fabrik in Städten
bis `maxLevel`. In der Vollpartie besitzt am Ende in jeder der drei gemessenen Startzahlen
mindestens eine Macht eine Fabrik der Stufe 2 — vorher in keiner: 1914 Russland Stufe **3**
(11 Provinzen auf Stufe 3, 29 auf mindestens 2), 2015 Stufe 2 (42 Provinzen), 1815 Stufe 2
(23 Provinzen). `fullgame.slow.test.ts` sichert es zu. `progress.slow.test.ts` (200 Tage,
sechs Europäer) sieht den Ausbau weiterhin nicht — höchste Stufe 1 vorher wie nachher. Was
der Ausbau an der ganzen Partie ändert, steht im Eintrag vom 2026-09-13 zu T-M41-02 unten.

---

## 2026-09-13 · T-M17-01 · Acht Befunde beim Planen von M17

Beim Planen von M17 am Code gefunden. Keiner davon wird in T-M17-01 gebaut; jeder hat eine
Aufgabe oder einen Meilenstein.

- **B1 — Durchmarschrecht und Kartenfreigabe sind symmetrisch und damit ausnutzbar.**
  `Relation.rightOfWay` und `sharedMap` sind je Paar ein Feld (`state/types.ts`, Schlüssel
  `a|b`). Gewährt A dem B Durchmarsch, darf **A** unbehelligt in Bs Land:
  `detectSurpriseAttacks` fragt nur `relation.rightOfWay` (`phases/diplomacy.ts:25`). Teilt A
  seine Karte, sieht A auch Bs Gebiet (`view/publicView.ts:224`). Beides löst eine Seite allein
  aus. → **T-M17-03/04**, R-DIP-08 (Kartenfreigabe: delegierter Entscheid, `DECISIONS.md`).
- **B2 — Das KI-„Erwidern" des Durchmarschs ist leer.** `packages/ai/src/diplomacy.ts` schickt
  `grantRightOfWay` nur, wenn `relation.rightOfWay` schon `true` ist — jeden Tag, ohne Wirkung.
  Der Test „erwidert gewaehrten Durchmarsch" (`packages/ai/src/diplomacy.test.ts`) setzt das
  Feld in der Sicht und prüft den erzeugten Befehl, nicht den Zustand; er ist grün und belegt
  nichts. **Die zweite Hälfte von R-DIP-06/AK3 ist nicht eingelöst.** → T-M17-04 (Test auf den
  Zustand), T-M17-10.
- **B3 — Die Angebotsfrist steht als Zahl im Code:** `3 * ticksPerDay`
  (`phases/diplomacy.ts:85`), gegen D-08. → T-M17-04, `offerLifetimeDays`.
- **B4 — `acceptPeace` löscht alle Friedensangebote an den Annehmenden, von jedem Absender**
  (`commands/diplomacy.ts:100`), `acceptAlliance` ebenso die Bündnisangebote (Z. 114).
  Handelsangebote dürfen das nicht erben. → T-M17-05.
- **B5 — Die KI bewertet jede fremde Provinz pauschal** mit 400 (Stadt) oder 200 (Land)
  (`packages/ai/src/targeting.ts:77`), weil die Sicht `deposits` nur für eigene Provinzen führt.
  Für den Provinzhandel untauglich. → T-M17-11, Wert aus der Karte.
- **B6 — Wege durch fremdes Land sind ungeprüft.** `MOVE_ARMY` prüft beim Ziel Existenz, Eigentum
  der Armee und einen Weg (`commands/move.ts`), `findPath` filtert nicht nach Eigentum. Ein
  KI-Marsch zum Kriegsgegner kann über eine friedliche dritte Macht führen — ein Überfall.
  **Nicht gemessen.** Genau diese Zahl misst T-M17-02 zuerst: ist sie null, fehlt der KI der
  Anlass, um Durchmarsch zu bitten, und R-AI-09/AK3 hat nichts zu messen.
- **B7 — R-DIP-06 nennt Verstimmungsquellen, die es nicht gibt:** „enttarnte Spione" (kommt mit
  R-SPY-05, T-M17-09) und „gebrochene Bündnisse" — `breakAlliance` senkt nur das Ansehen
  (`commands/diplomacy.ts:123-135`), eine Verstimmung entsteht nicht. Die zweite bleibt offen,
  ohne Meilenstein; sie ist hier festgehalten, damit sie nicht als gebaut gilt.
- **B8 — Kohle hat nicht einmal den Armeeunterhalt als Senke.** Keine Einheit in `units.json`
  nennt Kohle; sie steht nur in `buildings.json` (Baukosten der Eisenbahn) und in `ai.json`. Die
  einzigen Verbraucher sind dieser Bau und die Börse. Die Zeile im Eintrag vom 2026-09-06 („bleibt
  nur der Armeeunterhalt") war ungenau und ist dort vermerkt. → M18, mit dem Vorratsaufbau.

**Status:** B1 bis B3 erledigt (2026-09-24, T-M17-04) — Durchmarsch und Karte sind gerichtet, wer gewährt, darf nicht selbst hinein, die Angebotsfrist steht in `constants.json`, das Erwidern ist am Zustand geprüft. B4 für Handelsangebote erledigt (2026-09-25, T-M17-05); für Frieden und Bündnis (`acceptPeace`/`acceptAlliance`) weiterhin offen, ohne Meilenstein. B5 für den Provinzhandel behoben (2026-09-25, T-M17-11) — `targeting.ts` bewertet fremde Provinzen weiter pauschal. B6 für KI-Märsche erledigt (2026-09-25, T-M17-10, Antrag statt Marsch); die volle Messung über eine echte Partie mit vielen Mächten bleibt T-M17-15 vorbehalten. B7 erste Hälfte (enttarnte Spione) eingelöst (2026-09-25, T-M17-09); zweite Hälfte (gebrochene Bündnisse) weiterhin offen, ohne Meilenstein. B8 weiterhin offen, für M18 mit dem Vorratsaufbau.

---

## 2026-09-13 · T-M41-06 · T-M14-11 und T-M14-12 sagten 90-Tage-Läufe zu, und T-M15-08 löst sie nicht ab

**Nachgesehen, nicht angenommen.** Beide Aufgaben stehen auf `done` und sagten je einen Lauf
über **90 Spieltage** mit der ausgelieferten Voreinstellung zu, gezählt aus dem Ereignisstrom.
Den Lauf gibt es nicht, und kein Test prüft eine seiner Zahlen.

- **T-M14-11** versprach vier Zahlen: abgelehnte KI-Befehle unter 10 %, `NO_PATH`-Anteil an
  `MOVE_ARMY` unter 2 %, keine Paarung Armee/Fehlercode öfter als dreimal, mindestens ein
  `WAR_DECLARED`. `docs/reports/ai-reachability.md` misst **60** Spieltage und nennt zwei davon
  (6 Kriegserklärungen, 6,3 % abgelehnt, 101 von 1597). `NO_PATH`-Anteil und Paarungen fehlen.
- **T-M14-12** versprach sechs Aussagen: keine KI-Macht ohne Hauptstadt, solange sie eine Stadt
  hält; je KI-Macht eine Armee mit `armyRange` > 0; höchstens drei Armeeobjekte je Macht und
  Provinz; mindestens ein `TRADE_EXECUTED` **je** KI-Macht; abgewiesene `acceptPeace` unter 5 %;
  ein Frieden zwischen zwei KI. Dazu gibt es weder Bericht noch Lauf.

**T-M15-08 belegt etwas anderes.** `apps/headless/test/ai-integration.slow.test.ts` spielt acht
KI aus `map.startPositions.slice(0, 8)` — nicht `DEFAULT_NEW_GAME` — über 200 Spieltage mit
Startzahl 1815 und sichert zu: null `NOT_YET_AVAILABLE`, null diplomatische `INVALID_TARGET`,
null Geldmangel, mehr als null Fabriken, Artillerie und selbsttätiger Beschuss. Die
Überschneidung ist klein:

| Zusage aus M14 | belegt durch | Stand |
|---|---|---|
| ≥ 1 Kriegserklärung | `fullgame.slow.test.ts` (ganze Partie, Voreinstellung) | belegt |
| abgewiesene `acceptPeace` < 5 % | diplomatische `INVALID_TARGET` = 0 in T-M15-08 (andere Aufstellung) | sinngemäß belegt, strenger |
| Handel je KI-Macht | `ai-integration.json` zählt 3914 Geschäfte **insgesamt**, nicht je Macht | nicht belegt |
| Frieden zwischen zwei KI | `ai-integration.json` zählt 3 Waffenstillstände, ohne Zusicherung | gezählt, nicht zugesichert |
| Ablehnungsquote < 10 % | 1105 Ablehnungen, aber keine Gesamtzahl der Befehle | nicht zu rechnen |
| `NO_PATH` < 2 %, Paarungen ≤ 3, Hauptstadt, `armyRange` je Macht, ≤ 3 Armeeobjekte je Provinz | — | nicht belegt |

**Nebenbei aufgefallen:** `ai-integration.json` meldet **890 `MOVE_ARMY:ARMY_NOT_FOUND`** in 200
Spieltagen — Marschbefehle an Armeen, die es nicht mehr gibt. Ob darunter eine Armee öfter als
dreimal vorkommt, sagt der Bericht nicht; er zählt nicht je Armee.

**Warum kein Lauf in T-M41-06:** die Aufgabe richtet Text. Ein Lauf mit neun Zusicherungen misst
KI-Verhalten und würde nach dem Fabrikausbau (T-M41-01) ohnehin neu gemessen. T-M14-11 und
T-M14-12 bleiben `done`; die fehlenden Zusicherungen gehören in die nächste Planung.

**Status: offen, ohne Aufgabe** — für die nächste Planung vorgemerkt. *(Eingelöst 2026-09-13 mit
T-M41-08: der 90-Tage-Lauf der Voreinstellung steht in `apps/headless/test/ai-integration.slow.test.ts`;
acht Aussagen sind zugesichert, `armyRange` je Macht und die AK bei R-AI-01 mit Grund zurückgenommen,
„höchstens drei Armeeobjekte je Provinz" geht an T-M41-10 — Eintrag unten.)*

---

## 2026-09-13 · T-M41-04 · Die Uhr verlor mehr Ticks, als der Plan rechnete — und seine Kappe hätte es nicht behoben

**Erstens: der Befund war richtig und ist rot belegt.** Die aus `App.tsx` unverändert
herausgelöste Formel `owed = Math.min(2, owed + dt · speed)` ergibt in `clock.test.ts`: 60 Bilder
bei Tempo 100 → **90** Ticks, 30 Bilder bei Tempo 100 → **60**, 30 Bilder bei Tempo 50 → **45**; bei
50, 120 und 144 Bildern 100. Dazu zwei Dinge, die der Plan nicht nannte: über zehn Sekunden bei 60
Bildern läuft Tempo 2 nur **19** statt 20 Ticks (Gleitkomma), und eine rückwärts laufende
Zeitquelle liefert **−2** Ticks.

**Zweitens: im Spiel war es schlimmer.** Die Uhrschleife in `App.tsx` war ein `useEffect` mit
`state` in den Abhängigkeiten. Jeder Tick setzt einen neuen Zustand, der Effekt beginnt neu, und
`owed` steht wieder auf null — der Bruchteil ging also nicht nur an der Kappe verloren, sondern
nach **jedem** Tick. Gemessen in `App.test.tsx` (rAF als Warteschlange, `performance.now` gestellt,
gezählt an der Kopfleiste), gegen den Stand vor dieser Aufgabe: 60 Bilder bei Tempo 100 → **„Tag 3 ·
12:00", 60 Spielstunden** statt 100; 30 Bilder bei Tempo 50 → **„Tag 2 · 06:00", 30** statt 50.
Allein mit der reparierten Formel blieb es bei denselben 60 und 30 — ein grüner `clock.test.ts`
hätte die Uhr des Spielers nicht um einen Tick schneller gemacht.

**Drittens: die Reparatur aus dem Plan war es nicht.** `min(max(2, speed / 30), owed + dt · speed)`,
wörtlich nachgerechnet: 60 Bilder bei Tempo 100 → 100, aber 30 Bilder bei Tempo 100 → **90** und bei
Tempo 50 → **45**. Nach dem ersten Bild trägt jedes Bild einen Rest; Guthaben plus Rest liegt über
der Kappe, und die Kappe schneidet genau diesen Rest. Der Test aus dem Plan („30 Bilder zu 33,3 ms
ebenso") wäre mit der Formel aus demselben Plan rot geblieben.

**Absicht und Ersatz.** Gemeint war: bei üblichen Bildraten geht kein Tick verloren, und ein
Hänger baut keinen Rückstand auf (D5). Gebaut ist:
- die Kappe `max(2, speed / 30)` auf das **Zeitguthaben eines Bildes**, nicht auf die Summe mit
  dem Übertrag; der Übertrag bleibt immer in [0, 1) — `clock.test.ts` fährt 1000 Bilder mit
  eingestreuten Fünf-Sekunden-Hängern und sichert das in jedem Bild;
- ein `EPSILON` von 10⁻⁹ Tick vor dem Abrunden — ohne ihn verliert auch die neue Formel bei 60
  Bildern über zehn Sekunden Ticks (Tempo 2 → 19, Tempo 10 → 99);
- die Uhrschleife hängt nur noch an Tempo und „Partie läuft" und erreicht `step` über einen Ref.

Nachher, dieselben Messungen: 100 und 50 Spielstunden an der Kopfleiste, `clock.test.ts` 9 von 9.

**Was sich für den Spieler ändert.** Tempo 100 heißt 100 Spielstunden je Sekunde — vorher waren es
bei 60 Bildern 60. Nach einem Hänger holt ein Bild bei kleinem Tempo wie bisher höchstens 2 Ticks
nach, bei Tempo 100 aus leerem Übertrag höchstens 3 (vorher 2).

**Was nicht belegt ist:** ein echter Browser. Im Vorschaufenster läuft die Spieluhr nicht
(`WORKFLOW.md` §2 Punkt 6); belegt sind die reine Funktion und die Schleife in `App.tsx` unter
jsdom mit gestellter Zeit. Die Messung mit dem Leistungsbudget (R-TIME-02/AK4) bleibt dem
Schlussblock auf freier Maschine.

**Status: behoben** (T-M41-04). Plantext in `03-TASKS.md`, `tasks.yaml` und D5 mit Vermerk.

---

## 2026-09-13 · T-M41-02 · Der Fabrikausbau verändert die ganze Partie — und die Planungszahl „Tag 449" ist nicht reproduzierbar

**Was der Plan sagte.** Im Planungslauf, „im Speicher gepatcht" und nicht eingecheckt, ergab
„nur Fabrik bis `maxLevel`, nur Städte": Turnier und Grundlauf zeilengleich, Vollpartie 1914
**Tag 449**, 31 begonnene Fabriken Stufe 2, **keine Stufe 3** — „das liegt im Rauschen der
Startzahl und belegt nur keine Verschiebung" (`DECISIONS.md` und `03-TASKS.md`, T-M41-01/02).

**Was gebaut und gemessen ist** (`fullgame.slow.test.ts`, jetzt mit Startzahl über
`WORLDWAR_FULLGAME_SEED`, Berichte `docs/reports/fullgame.json`, `fullgame-2015.json`,
`fullgame-1815.json`; vorher = Stand `a2352b6` mit denselben Berichtsfeldern):

| Startzahl | Siegtag | Kriegserklärungen | Eroberungen | Schlachten | höchste Fabrikstufe | Provinzen ≥ 2 / = 3 | Ausbau begonnen auf 2 / 3 |
|---|---|---|---|---|---|---|---|
| 1914 vorher | 471 | 12 | 1827 | 4040 | 1 | 0 / 0 | 0 / 0 |
| 1914 nachher | **582** | 12 | 1615 | 5236 | **3** | 29 / 11 | 56 / **17** |
| 2015 vorher | 583 | 10 | 1420 | 4985 | 1 | 0 / 0 | 0 / 0 |
| 2015 nachher | **868** | **37** | 2923 | 11262 | 2 | 42 / 0 | 106 / 0 |
| 1815 vorher | 774 | 13 | 1772 | 6379 | 1 | 0 / 0 | 0 / 0 |
| 1815 nachher | **412** | 12 | 1172 | 5323 | 2 | 23 / 0 | 50 / 0 |

- **Turnier:** zeilengleich vorher und nachher (1,00 / 0,70 bei 10:0:15 / 1,00). R-AI-06 hält.
- **Grundlauf** (`progress.slow.test.ts`, 12 Startzahlen × 120 Tage): **nicht** auf vier Stellen
  gleich — Anteil des Stärksten 0,4442 → 0,4462, Eroberungen 302,3 → 301,3, Überlebende
  5,17 → 5,08, Endbestände 50613 → 50439.
- **Gegenprobe** mit Kappe bei Stufe 2 (`level('factory') < 2`, sonst gleich; Startzahl 1914,
  danach zurückgenommen): Tag **591**, 1904 Eroberungen, 68 begonnene Ausbauten auf Stufe 2,
  keine Stufe 3. Auch sie trifft 449 nicht.

**Die Planungszahl ist damit nicht reproduzierbar**, mit keiner der beiden naheliegenden
Varianten. Welche Änderung der Planungslauf wirklich gemessen hat, lässt sich aus dem
eingecheckten Stand nicht rekonstruieren; eine Ursache wird hier nicht behauptet. Die Lehre
steht schon in den Regeln — eine nicht eingecheckte Messung ist erst Daten, wenn sie als Test
neu entstanden ist —, und genau das hat den Unterschied aufgedeckt.

**Was die Zahlen sagen.** Der Siegtag verschiebt sich je Startzahl stark und **in beide
Richtungen** (+111, +285, −362 Tage; Mittel 609 → 621). Das ist keine systematische
Verlängerung oder Verkürzung, sondern die Partie wird eine andere: jede Verhaltensänderung der
KI lenkt eine 500-Tage-Partie in einen anderen Verlauf. „Keine Verschiebung" war mit einer
einzigen Startzahl nie belegbar. Auffällig ist 2015: **37 statt 10 Kriegserklärungen** und
mehr als doppelt so viele Schlachten.

**Warum die Variante bleibt.** Das Rücknahmekriterium dieser Aufgabe war das Turnier (R-AI-06),
und das ist zeilengleich. AK-1 ist in allen drei Startzahlen entschieden, jeder Siegtag liegt im
Tor 300–1500 aus T-M34-07, und die Zusicherung „mindestens eine Macht besitzt Fabrikstufe 2"
hält in allen dreien. Die Kappe bei Stufe 2 wäre nicht besser belegt und hielte der KI die
dritte Stufe verschlossen.

**Was daraus folgt.** (1) Der Ausgangswert von M17 (T-M17-02) wird auf diesem Stand gemessen,
nicht auf dem vor M41. (2) Der eine Parameterlauf der Delegation (seit 2026-09-13 im Schlussblock nach M35, M17
abgetrennt; vorher T-M17-16) sieht die
Änderung im 120-Tage-Grundlauf nur schwach; die Wirkung liegt in der langen Partie. (3) Ob die
blutigere Partie mit Startzahl 2015 ein Muster ist, sagen erst mehr Startzahlen — vorgemerkt
für den Schlussblock, keine Aufgabe.

**Status: Beobachtung, kein Produktfehler.** Plantext in `DECISIONS.md` (T-M41-01) und
`03-TASKS.md`/`tasks.yaml` (T-M41-02) mit Vermerk; `WORKFLOW.md` §5 nennt Tag 582.

---

## 2026-09-13 · T-M40-02 · „Beantwortet binnen 24 Ticks" ist auf der Weltkarte nicht erreichbar — das Fenster folgt jetzt aus der Karte

**Was der Plan sagte.** D30.6, T-M40-02 und T-M40-06: ein Einmarsch gilt als beantwortet, wenn
„eine eigene Armee diese Provinz binnen 24 Ticks erreicht"; zugesichert wird nachher ein größerer
Anteil beantworteter Einmärsche (R-UNIT-09/AK5).

**Was vor dem Bau nachgerechnet wurde.** Infanterie marschiert 6 km/h (`units.json`), und
`edgeTravelTicks` rundet auf und rechnet das Gelände ein. Die deutschen Binnengrenzen, mit der
Funktion des Kerns für die aufgestellte Armee gerechnet (`docs/reports/stance.json`,
`innerBorders`): 146 km = 25 bzw. 31 Ticks, 236 km = 50, 314 km = 53 bzw. 88, 359 km = 75 bzw.
100, 404 km = 85 bzw. 113. Der Adjutant befiehlt frühestens im Tick nach dem Einmarsch (D30.4).
**Die schnellste denkbare Antwort braucht also 26 Ticks** — mit 24 wäre die Zahl vorher und
nachher null gewesen, und jede Automatik hätte AK5 verfehlt, ohne dass es an ihr lag.

**Korrektur, festgelegt vor jeder Messung nachher.** Die Absicht bleibt: eine eigene Armee kommt
dort an. Gezählt werden drei Zahlen, alle aus dem Ereignisstrom:

1. **Ankunft binnen 24 Ticks** — die Zahl des Plans, weiter im Bericht, nicht zugesichert;
2. **Ankunft binnen des Kartenfensters** — 1 Tick Verzug plus die längste Marschzeit über eine
   eigene Binnengrenze für genau die aufgestellte Armee (Deutschland: **114 Ticks**);
3. **Aufbruch binnen 24 Ticks** — die Reaktion selbst, unabhängig von der Marschzeit.

Zugesichert wird in T-M40-06, dass die Anteile (2) und (3) nachher größer sind als vorher. Das
Fenster ist aus der Karte abgeleitet und nicht aus einem Messergebnis, und es gilt für beide Läufe
gleich.

**Messung vorher** (Weltkarte, Startzahl 1914, 200 Spieltage, Deutschland mit je fünf Infanterie in
seinen vier Provinzen, sieben KI-Nachbarn, kein Befehl; **gemessen vor der M41-Nacharbeit
(KI-Bauordnung)**): 52 Einmärsche (Frankreich 47, Italien 5, der erste an Tag 20), beantwortet
0 / 0 / 0, **alle vier Provinzen verloren**, 0 abgelehnte Befehle, 0 Befehle für den Menschen.
Der Ringpuffer am Ende führt **0** Einmärsche — derselbe Unterschied wie in T-M14-05.

**Status:** Plan korrigiert (D30.6, `03-TASKS.md` und `tasks.yaml` T-M40-02/06, mit Vermerk);
kein Produktfehler.

---

## 2026-09-13 · T-M40-06 · Die Haltungs-Automatik wirkt messbar, aber schwach — zwei Befehle in 200 Spieltagen

**Gemessen** (`docs/reports/stance.json`; Weltkarte, Startzahl 1914, 200 Spieltage, Deutschland als
Mensch mit je fünf Infanterie in seinen vier Provinzen, sieben KI-Nachbarn, kein Befehl des
Menschen; alle absoluten Zahlen **gemessen vor der M41-Nacharbeit (KI-Bauordnung)** — der
Vergleich bleibt gültig, weil alle Läufe auf demselben KI-Stand liefen):

| Lauf | Einmärsche | Ankunft ≤ 24 Ticks | Ankunft im Kartenfenster (114) | Aufbruch ≤ 24 Ticks | verlorene Provinzen | Provinzen / Armeen am Ende | Befehle des Adjutanten | abgelehnt |
|---|---|---|---|---|---|---|---|---|
| vorher (T-M40-02, Verteidigung, noch ohne Automatik) | 52 | 0 | 0 | 0 | 4 | 0 / 0 | 0 | 0 |
| Kontrolle (Garnison) | 52 | 0 | 0 | 0 | 4 | 0 / 0 | 0 | 0 |
| **nachher (Verteidigung mit Adjutant)** | 136 | 4 | **9 (6,6 %)** | **4 (2,9 %)** | 3 | 1 / 3 | **2** | **0** |
| Angriff (mit Verfolgung) | 51 | 0 | 0 | 0 | 5 | 0 / 0 | 3 | 0 |

- **Die Kontrolle bildet „vorher" Zahl für Zahl nach.** Die Garnison ist die Verteidigung ohne
  Automatik; zwischen T-M40-02 und T-M40-06 hat sich also nichts verschoben außer dem Adjutanten.
- **R-UNIT-09/AK5 hält:** der Anteil im Kartenfenster steigt von 0 auf 6,6 %, der Aufbruch binnen
  24 Ticks von 0 auf 2,9 %, und kein Befehl der Automatik wird abgelehnt — auch in der Verfolgung
  nicht.
- **Die 24-Tick-Ankunft ist nachher nicht null (4),** obwohl die schnellste Antwort 26 Ticks
  braucht: mehrere Einmärsche fallen in dieselbe Provinz, und eine Armee, die für den ersten
  aufbrach, kommt binnen 24 Ticks nach einem späteren an.
- **Rot gesehen nur ohne Automatik:** mit herausgenommener Deckungsregel fällt der Messlauf („der
  Adjutant hat im ganzen Lauf nichts befohlen"), mit herausgenommener Verfolgungsregel fallen drei
  Einzeltests.

**Der Befund: die Wirkung ist klein.** Zwei Befehle in 200 Spieltagen. Deutschland hält am Ende
eine Provinz und drei Armeen statt keiner, und weil länger etwas zu erobern bleibt, steigen die
Einmärsche auf 136 — der Anteil hängt am Nenner. Drei Ursachen, am Code belegt:

1. **`occupation` läuft im Tick des Einmarschs** (`phases/index.ts`: movement → combat →
   occupation). Eine Provinz ohne Verteidiger gehört dem Eindringling, bevor der Adjutant sie im
   nächsten Tick sieht. Decken kann er nur, wo noch eine eigene Armee kämpft — gefallene Provinzen
   holt keine Regel zurück.
2. **Die Quelle muss feindfrei sein** (D30.4, R-UNIT-09/AK1). Frankreich greift mehrere deutsche
   Provinzen zugleich an; eine Armee im eigenen Gefecht rückt nicht aus.
3. **Vier Provinzen, fünf Binnengrenzen** — wenige Nachbarn, die nachrücken können.

**Angriff:** drei Verfolgungen, keine Ablehnung. Die Haltung ändert auch den Kampf — `aggressive`
gilt nicht als eingegrabener Verteidiger —, und dieser Lauf verliert fünf Provinzen bei vier
Startprovinzen: eine wurde zwischendurch genommen, was ohne Befehl des Menschen nur ein Marsch der
Verfolgung sein kann (abgeleitet, nicht einzeln gezählt).

**Was daraus folgt.** Keine Aufgabe in M40 — die Zusage von R-UNIT-09 ist eingelöst. Eine
stärkere Automatik (gefallene Nachbarprovinzen zurückerobern, aus einer umkämpften Provinz
nachrücken) wäre eine neue Entscheidung über D30.4 und damit über Noahs Satz „Angriff und
Verteidigung führen sich selbst aus" — vorgemerkt, nicht gebaut. Die Sichtprüfung der
Haltungsgruppe (zwei mal zwei, T-M40-05) steht im Schlussblock aus.

**Status:** Beobachtung; AK5 belegt.

**Berichtigt am 2026-09-13 (T-M40-07, Befund H3 der Durchsicht von M40).** Drei Aussagen dieses
Eintrags halten der Nachprüfung nicht stand.

1. **„Am Ende eine Provinz und drei Armeen statt keiner" ist keine gelungene Deckung.** Zwei der
   drei Verluste hat der Adjutant selbst verursacht: er schickte a2 aus DEU-NW (Tick 497) und a3 aus
   DEU-SE (Tick 522) nach DEU-SW, und beide geleerten Provinzen fielen danach **ohne Gefecht**
   (Tick 867 und 1018, Durchsicht H3). Dass DEU-SW hielt, lag an den drei Armeen, die dort
   zusammenkamen.
2. **Ursache 1 (Eroberung im Einmarschtick) erklärt den Lauf kaum.** Nur 2 der 136 Einmärsche fielen
   mit einer Eroberung im selben Tick zusammen — genau die zwei entblößten Provinzen.
3. **Der „Anteil beantworteter Einmärsche" misst die Dauer des Widerstands, nicht die Wirkung.**
   Vorher ist er strukturell null, und die neun „beantworteten" Einmärsche stammen aus zwei
   Ankünften. Eine Deckung kam in **1 von 132** umkämpften Episoden vor Gefechtsende an — Gefechte
   dauern im Median einen Tick, die kürzeste deutsche Binnengrenze 25. Im Entwurf der Nacharbeit
   verloren Regeln mit 73–80 % „beantwortet" alle Provinzen. Die Zahl bleibt im Bericht, zugesichert
   wird sie seit T-M40-07 nicht mehr.

**Neu gemessen je umkämpfter Episode** (`apps/headless/test/stance.slow.test.ts`,
`docs/reports/stance.json`, Abschnitt `episoden.vorher`; Weltkarte, 200 Spieltage, Deutschland ohne
Befehl, der Adjutant wie in M40 gebaut; gemessen vor Block N2 der M41-Nacharbeit). Provinz-Tage =
Provinzen des Menschen zu Beginn jedes Spieltags, summiert. Aufstellung A: eine Armee aus fünf
Infanterie je Provinz, B: zwei.

| Startzahl · Aufstellung · Haltung | Provinz-Tage | verloren (davon ohne Gefecht) | Befehle | Episoden (Deckung befohlen / rechtzeitig / gehalten) | Ende Provinzen / Armeen |
|---|---|---|---|---|---|
| 1914 · A · Garnison | 573 | 4 (0) | 0 | 45 (0 / 0 / 41) | 0 / 0 |
| 1914 · A · Verteidigung | 366 | 3 (**2**) | 2 | 132 (2 / 1 / 131) | 1 / 3 |
| 1914 · B · Garnison | 733 | 1 (0) | 0 | 42 (0 / 0 / 41) | 3 / 6 |
| 1914 · B · Verteidigung | 636 | 2 (**2**) | 4 | 286 (4 / 2 / 286) | 2 / 8 |
| 2015 · A · Garnison | 532 | 3 (0) | 0 | 37 (0 / 0 / 34) | 1 / 1 |
| 2015 · A · Verteidigung | 341 | 3 (**3**) | 2 | 108 (2 / 1 / 108) | 1 / 3 |
| 2015 · B · Garnison | 800 | 0 (0) | 0 | 58 (0 / 0 / 58) | 4 / 8 |
| 2015 · B · Verteidigung | 800 | 0 (0) | 6 | 509 (6 / 2 / 509) | 4 / 8 |
| 1815 · A · Garnison | 702 | 1 (0) | 0 | 27 (0 / 0 / 26) | 3 / 3 |
| 1815 · A · Verteidigung | 362 | 3 (**2**) | 2 | 92 (2 / 1 / 91) | 1 / 3 |
| 1815 · B · Garnison | 800 | 0 (0) | 0 | 36 (0 / 0 / 36) | 4 / 8 |
| 1815 · B · Verteidigung | 796 | 1 (**1**) | 4 | 404 (4 / 2 / 404) | 3 / 8 |

**Summen über die sechs Paare:** Provinz-Tage mit Garnison 4140, mit Verteidigung **3301 (79,7 %)**;
Verluste ohne Gefecht mit Garnison **0**, mit Verteidigung **10** — in fünf von sechs Paaren mehr als
mit Garnison. Rechtzeitig vor Gefechtsende kam die Deckung in 9 von 1531 umkämpften Episoden an.
Die Verteidigung aus M40 hält weniger als die Garnison und verliert fast nur Provinzen, die sie
selbst geleert hat.

Die Garnison A 1914 bildet den Lauf vorher aus T-M40-02 nach (52 Einmärsche, 4 verloren). Jede Zahl
trifft den Entwurf der Nacharbeit, der dieselben Läufe im Speicher nachgebaut hatte — die
Messung ist also dieselbe, auf der dort die Schwelle festgelegt wurde. In keinem Lauf gab es eine
Ablehnung, einen Krieg ohne Erklärung oder einen Pendelzug.

**Status:** berichtigt. Die Regel ersetzt T-M40-10; ob die neue Fassung bleibt, entscheidet derselbe
Messlauf in T-M40-12.

## 2026-09-13 · T-M41-12 · Ankündigung und Freischaltung standen zwölf Spielstunden — nach einem Vorspulen gar nicht

**Befund (Durchsicht M41, N8).** `unlockAlerts` und `upcomingAlerts` in `Alerts.tsx` meldeten nur,
solange `tick % ticksPerDay < COMPLETION_ALERT_TICKS` (12) galt — so lange wie eine Fertigstellung.
Zwölf Spielstunden sind bei Tempo 100 rund 0,12 s. Ein Vorspulen um einen Tag landet zur selben
Uhrzeit am nächsten Tag; von 14:00 aus sprang es über die ganze Anzeige hinweg.

**Gemessen** (`App.test.tsx`, T-M41-12): Weltkarte, eine Partie mit `advanceTicks` auf Tag 5, 14:00
gebracht und über den Ladeweg geöffnet, einmal Vorspulen. Die Uhr steht danach auf Tag 6, 14:00 —
dem Freischaltungstag des Hafens —, und die Meldungsleiste war **leer** („expected '' to contain
'Neu ab heute: Hafen'"). Die Zählung im Onboarding-Durchgang sah das nie: sie fragt jeden Tick ab
und findet die Meldung deshalb in der ersten Stunde.

**Reparatur.** Beide stehen den ganzen Spieltag und lassen sich wegklicken; ein Klick gilt bis zum
Ende dieses Spieltags und nur ab seinem Tick, Laden und neue Partie setzen ihn zurück. Leise wie
bisher (M36): der Wegklick trägt keine Alarm- oder Warnfarbe (Haltetest in `Alerts.test.tsx`),
springt nicht auf die Karte und macht keinen Ton; Kampf, Mangel und Hauptstadt sind nicht
wegzuklicken. Die längste Pause des Onboarding-Durchgangs bleibt 48 Ticks, `onboarding.md`
unverändert.

**Was nicht behoben ist (vor dem Bau gerechnet).** Ein Spieltag dauert bei Tempo 100 0,24 s, bei
Tempo 10 2,4 s, bei Tempo 5 4,8 s. „Bis Tagesende" verdoppelt die Anzeigezeit, lesbar ist sie bei
vollem Tempo trotzdem nicht. Der Gewinn liegt beim Vorspulen — danach steht die Uhr (`setSpeed(0)`
beim Start des Laufs), und die Meldung bleibt, bis weitergespielt oder weggeklickt wird — und bei
kleinem Tempo. Eine Meldung, die länger als ihren Tag steht, bräuchte einen anderen Text als
„Neu ab heute" und ist nicht entschieden.

**Status:** behoben (T-M41-12); die Anzeigezeit bei vollem Tempo als Beobachtung.

## 2026-09-13 · T-M41-13 · Tempo während des Vorspulens verlor Befehle — und das Ziel des Vorspulens zählt je Häppchen

**Befund (Durchsicht M41, N7).** Die Tempostufen (`Header.tsx`) und die Kürzel Leertaste, Plus und
Minus waren während eines Vorspulens nicht gesperrt. Läuft der Lauf über mehrere Häppchen, setzt
ein Druck die Uhr neben ihnen in Gang: sie nimmt gesammelte Befehle aus `takePending`, wendet sie
auf ihren Zustand an, und `chunk(result.state)` überschreibt diesen Zustand im nächsten Häppchen.

**Vor dem Bau gemessen: heute nicht herstellbar.** Knopf und Taste F fahren `{ kind: 'days', days: 1 }`,
das sind 24 Ticks, `DEFAULT_CHUNK_TICKS` ist 24, und der Kern prüft das Ziel im Häppchen. Der Lauf
endet im ersten Häppchen, synchron im Klick — `App.test.tsx` hält das fest (kein Abbrechen-Knopf,
sofort „Angehalten nach …"). Einen Zeitpunkt, an dem der Spieler Tempo drücken könnte, gibt es
heute nicht.

**Mit kleineren Häppchen gezeigt.** `App.test.tsx` verkleinert die Häppchen per Hülle um
`fastForwardChunk` auf 4 Ticks (derselbe Weg wie jeder Lauf über mehr als ein Häppchen): Kaserne
gesammelt, Vorspulen gestartet (der Lauf steht nach dem ersten Häppchen noch, die Kaserne ist
begonnen), Krieg während des Laufs erklärt, dann Tempo 100 geklickt bzw. Leertaste und Plus
gedrückt, vier Bilder der Uhr, ein weiteres Häppchen, abgebrochen, erneut vorgespult. **Vor der
Reparatur rot in beiden Fällen:** die Kriegserklärung steht nie im Protokoll.

**Reparatur: gesperrt, nicht übergeben.** Die Stufen über 0 sind während eines Laufs `disabled` und
nennen den Grund („Während des Vorspulens gesperrt — erst abbrechen oder abwarten"); die Pause
bleibt bedienbar, der Vorspulknopf ist seit T-M28-10 der Abbrechen-Knopf. `resolveKey` gibt für
Leertaste, Plus, Minus und F während eines Laufs nichts zurück (F hätte einen zweiten Lauf neben
dem ersten gestartet); Karte, Panels, Speichern und Escape bleiben. Befehle, die während des Laufs
gegeben werden, bleiben gesammelt und wirken im nächsten Tick danach.

**Nebenbefund 1 (nicht gebaut): das Ziel „ein Tag" zählt je Häppchen.** `fastForwardChunk` ruft
für jedes Häppchen `fastForward` neu auf, und `targetReached` misst `ticksRun` dieses Aufrufs.
Die Schleife in `App.tsx` setzt fort, solange ein Häppchen an `limit` endet — sie trägt den
Fortschritt zum Ziel nicht über Häppchen hinweg. Mit Häppchen zu 4 Ticks lief „ein Tag" nach 50
Häppchen (200 Ticks) weiter und hätte erst an der Obergrenze von 30 Spieltagen gehalten (gesehen im
ersten Entwurf des Tests; er bricht deshalb ab). Heute verdeckt: ein Tag ist genau ein Häppchen.
Jedes Ziel über mehr als 24 Ticks, das nicht zustandsbasiert ist (`days` ab 2, `ticks` über 24),
würde bis zur Obergrenze laufen. Gehört zu R-TIME-02/R-TIME-06 und keiner Aufgabe dieses Blocks.

**Nebenbefund 2 (nicht gebaut): der Kürzel-Effekt in `App.tsx` nennt `fastForwardRun` nicht in
seinen Abhängigkeiten.** Er ruft die Funktion aus dem Render, in dem er zuletzt neu gebunden wurde;
`fastForwardRun` hängt an `debugOn` und `noteTrace`, der Effekt nicht. Wer die Debug-Ansicht
einschaltet und dann F drückt, spult ohne Mitschrift vor, bis sich eine andere Abhängigkeit ändert.
Gelesen, nicht gemessen.

**Status:** behoben (T-M41-13); Nebenbefund 1 und 2 offen.

**Nebenbefund 1 behoben am 2026-09-13 (T-M41-15).** Die Anfrage an `fastForwardChunk` trägt jetzt
`ticksRunBefore`, ein Zählziel (`ticks`, `days`) wird auf den Rest des Laufs umgerechnet, und
`App.tsx` reicht den Stand weiter; Ereignisziele bleiben, wie sie sind. **Rot vorher:** ein Ziel von
48 Ticks und eines von zwei Spieltagen, in Häppchen zu 24 aneinandergereiht wie in der Oberfläche,
liefen beide bis zur Obergrenze (720 Ticks, `limit`); in der App stand die Uhr nach einem „Vorspulen
um einen Tag" in Häppchen zu 4 Ticks auf „Tag 31 · 00:00" statt „Tag 2 · 00:00". **Grün:** Halt am
Ziel nach 48 Ticks bzw. zwei Tagen, die App hält nach genau einem Tag.

**Nebenbefund 2 am 2026-09-13 gemessen und gehärtet (T-M41-16) — über die Oberfläche nicht
herstellbar.** `App.test.tsx` schaltet die Debug-Ansicht während der Partie im Einstellungsdialog ein
und drückt dann F: die Kommandoliste der Debug-Ansicht füllt sich — **auch ohne Reparatur grün**.
Zwei Abhängigkeiten binden den Kürzel-Effekt beim Umschalten ohnehin neu: `step` hängt wie
`fastForwardRun` an `debugOn`, und die Debug-Ansicht lässt sich nur im Einstellungsdialog umschalten,
dessen Schließen `dialog` ändert. Gemessen, jeweils nur im Arbeitsbaum:

1. unverändert: grün;
2. `step` aus den Abhängigkeiten genommen: weiter grün — das Schließen des Dialogs bindet neu;
3. `step` und `dialog` herausgenommen: **rot** („F hat ohne Mitschrift vorgespult: expected 0 to be
   greater than 0");
4. wie 3, dazu `fastForwardRun` in den Abhängigkeiten: **weiter rot** — der Handler liest dann ein
   veraltetes `dialog` („settings") und verwirft F als „Dialog offen".

Der Test sieht also einen veralteten Kürzel-Effekt. Einen Rotlauf, der allein das fehlende
`fastForwardRun` zeigt, lässt die Oberfläche nicht zu, weil jeder Weg zur Debug-Ansicht über den Dialog
führt. Die Zusicherung ist deshalb nicht umformuliert, und `fastForwardRun` steht trotzdem in den
Abhängigkeiten: die Mitschrift hängt nicht mehr daran, dass zufällig eine andere Abhängigkeit den Effekt
neu bindet. `step` und `dialog` stehen wieder drin.

**Beobachtung, nicht gebaut:** `jumpTo` (Kürzel für die Hauptstadt) fehlt in denselben Abhängigkeiten
ebenso — gelesen, nicht gemessen.

**Status:** Nebenbefund 1 behoben (T-M41-15); Nebenbefund 2 gehärtet, als Fehler über die Oberfläche
nicht herstellbar (T-M41-16).

---

## 2026-09-13 · T-M40-09 · „Nach der Ankunft fünf Tage Ruhe" ist aus dem Zustand nicht prüfbar — die Ruhe zählt ab dem Abmarsch

**Was der Plan sagte.** Der Entwurf der Nacharbeit (R3, R4) und `tasks.yaml` bei T-M40-09: nach einem
Spielermarsch „nach Ankunft 120 Ticks ohne Adjutantenbefehl". Die Regel selbst lautet dort
`tick >= deployDelayUntil + 120`.

**Was vor dem Bau geprüft wurde.** `deployDelayUntil` setzen der Befehl (`commands/move.ts`), der
Abmarsch (`phases/movement.ts`, nur im Tick von `departureTick`) und — verdoppelt — der Rückzug
(`phases/retreat.ts`). Bei der Ankunft setzt der Kern nichts, `arrivalTick` und `departureTick` gehen
auf `null`. Der Zustand kennt den Tick der Ankunft also nicht, und ein Feld dafür kostete Schemastufe,
Migration und neue Golden-Master — genau das, was die Nacharbeit ausschließt. Die zwei Sätze des Plans
widersprechen sich: die Regel misst ab dem Abmarsch.

**Korrektur.** Zugesichert und getestet wird die Regel, wie sie gebaut ist: nach Abmarsch oder Rückzug
handelt eine Armee vor `deployDelayUntil + 120` nicht von selbst (R-UNIT-09/AK7). Nach der Ankunft
bleiben damit 120 Ticks abzüglich der Marschzeit — auf der Weltkarte dauert eine Binnenetappe für
Infanterie 25 bis 113 Ticks, es bleiben also zwischen 7 Ticks und gut vier Spieltagen. Gemessen in
`packages/ai/src/loop.test.ts` (Kleine Welt, Marsch n3 → n1 neben einer laufenden Schlacht in n2):
ohne Ruhe marschierte die Armee an Tick 224 von selbst weiter, 24 Ticks nach dem Abmarsch an Tick
200; mit Ruhe nicht vor Tick 322.

**Nebenbei geprüft.** Die bisherige Bedingung „Angriffssperre abgelaufen" bleibt stehen. Nach einem
Rückzug hält sie `retreatCooldownTicks` (24 Ticks) zurück, die Ruhe `2 · deployDelayTicks + 120`
(124 Ticks) — die Ruhe ist also immer die spätere, auch nach dem Zusammenlegen, das beide Felder als
Maximum übernimmt. Die Durchsicht nannte als zweite Lösung (a) „Rückzug setzt Menschen auf Garnison";
nicht gebaut, weil der Kern dafür `players[].kind` lesen müsste (D30.2 hält Mensch und KI aus dem Kern)
— kippbar in `phases/retreat.ts`, danach `pnpm test` ohne `UPDATE_GOLDEN`.

**Status:** Plantext korrigiert (T-M40-09 in `tasks.yaml` und `03-TASKS.md`); kein Produktfehler.

---

## 2026-09-13 · T-M40-12 · Die Regel, die nicht entblößt, hält den Messlauf — sie schadet nicht, und dass sie hilft, ist nicht belegt

**Gemessen** (`apps/headless/test/stance.slow.test.ts`, `docs/reports/stance.json`, Abschnitt
`episoden.nachher`; Weltkarte, 200 Spieltage, Deutschland ohne Befehl, Startzahlen 1914, 2015, 1815,
Aufstellung A mit einer und B mit zwei Armeen aus je fünf Infanterie je Provinz; gemessen vor Block N2
der M41-Nacharbeit). Provinz-Tage = Provinzen des Menschen zu Beginn jedes Spieltags, summiert.

| Startzahl · Aufstellung | Garnison: Provinz-Tage / verloren (ohne Gefecht) | Verteidigung M40 (T-M40-07) | **Verteidigung D30.4 neu** | Befehle neu | Episoden neu (Deckung befohlen / rechtzeitig / gehalten) |
|---|---|---|---|---|---|
| 1914 · A | 573 / 4 (0) | 366 / 3 (2) | **573 / 4 (0)** | 0 | 45 (0 / 0 / 41) |
| 1914 · B | 733 / 1 (0) | 636 / 2 (2) | **800 / 0 (0)** | 6 | 83 (6 / 1 / 83) |
| 2015 · A | 532 / 3 (0) | 341 / 3 (3) | **532 / 3 (0)** | 0 | 37 (0 / 0 / 34) |
| 2015 · B | 800 / 0 (0) | 800 / 0 (0) | **800 / 0 (0)** | 9 | 41 (9 / 1 / 41) |
| 1815 · A | 702 / 1 (0) | 362 / 3 (2) | **702 / 1 (0)** | 0 | 27 (0 / 0 / 26) |
| 1815 · B | 800 / 0 (0) | 796 / 1 (1) | **774 / 2 (0)** | 10 | 73 (10 / 1 / 71) |
| **Summe** | **4140 / 9 (0)** | 3301 (79,7 %) / 12 (10) | **4181 (101,0 %) / 10 (0)** | 25 | 306 |

**AK5 hält** (die Zusicherungen standen vor dieser Messung fest, die Schwelle 98 % aber erst nach der Messung des Entwurfs, der dieselbe Regel N mit denselben Zahlen maß — D30.9; berichtigt nach der Durchsicht der Nacharbeit, N-5): Provinz-Tage 4181 von 4140 (≥ 98 %); in keinem Paar mehr
Verluste ohne Gefecht als mit Garnison (überall 0); 0 Ablehnungen, 0 Kriege ohne Erklärung, 0
Pendelzüge [gezählt ab Abmarsch, strukturell 0 (H-A)]. Die Garnison A 1914 bildet vorher nach (52 Einmärsche, 4 verloren). Jede Zahl trifft die
Regel N im Entwurf der Nacharbeit. **Rücknahmekriterium nicht ausgelöst — die Regel bleibt.**

**Was die Zahlen nicht sagen.**

- **Mit einer Armee je Provinz tut die Regel nichts** (Aufstellung A gleich Garnison, 0 Befehle). Das ist
  die Regel, nicht ein Fehler: allein marschiert eine Verteidigung nie.
- **1815 B liegt unter der Garnison** (774 gegen 800, zwei Provinzen verloren — beide mit Gefecht). Die
  Schwelle gilt für die Summe; so steht es in D30.9, und sie wurde nach der Messung des Entwurfs
  festgelegt, nicht nach dieser.
- **Deckung kommt fast nie rechtzeitig:** 3 von 25 Befehlen erreichten ihre Provinz vor Gefechtsende.
  Die Gewinne in 1914 B (800 statt 733) kommen also kaum aus rechtzeitig gedeckten Gefechten —
  vermutlich aus Armeen, die schon standen, als der nächste Angriff kam (abgeleitet, nicht einzeln
  gezählt). Belegt ist „schadet nicht", nicht „hilft" — die spürbare Entlastung, die
  Noah wollte, ist als offene Frage in `DECISIONS.md` (2026-09-13, T-M40-10).
- **Neu messen nach Block N2:** die Gegner ändern sich; fällt dann eine Zusicherung, greift das
  Rücknahmekriterium (D30.9), und die Verteidigung kämpft wie die Garnison.

**Unverändert, belegt:** Turnier zeilengleich (`docs/reports/ai-tournament-run.md`, `git diff` leer);
Vollpartie Startzahl 1914 Siegtag **582**, Sieger p6, 12 Kriegserklärungen, 1615 Eroberungen, 5236
Schlachten — der Bericht bis auf `measuredAt` gleich dem eingecheckten, zurückgesetzt; Golden-Master
über `pnpm test` ohne `UPDATE_GOLDEN`; `data/rules` unberührt.

**Status:** AK5 belegt; Beobachtung „hilft nicht belegbar" offen bei Noah.
---

## 2026-09-13 · T-M41-08 · 961 Ablehnungen waren Rauschen aus dem Zusammenlegen — die Zusagen aus M14 sind eingelöst oder begründet zurückgenommen, und fünf Nebenbefunde bleiben

**Der Befund, nachgemessen beim Bau.** Die Untersuchung zu `ai-integration.json` (890 `MOVE_ARMY:ARMY_NOT_FOUND`
am 2026-09-12) fand eine einzige Ursache: Operativ- und Taktikstufe feuern praktisch immer im selben Tick
und lasen dieselbe Sicht; `consolidateCommands` legte Armeen zusammen, `militaryCommands` befahl danach
die aufgelösten, und der Kern lehnte jeden dieser Befehle ab. Nachgemessen auf dem Stand `4854465`, rot
vor der Reparatur: **200 Tage Weltkarte 938 + 23** (`MOVE_ARMY`/`SET_STANCE`), **90 Tage Voreinstellung
265 + 2**. Kein verlorener Zug — die bleibende Armee bekam ihren eigenen Befehl —, aber 961 von 1177
Ablehnungen verdeckten jede andere.

**Reparatur und Beleg.** `decide.ts` gibt der Taktikstufe eine Sicht ohne die Armeen, die das
Zusammenlegen im selben Zug auflöst (Sortierregel des Kerns). Befehle, `assignments` und Begründungen
für diese Armeen entstehen nicht mehr. **Neutral, gemessen:** die Prüfsumme des Endzustands ohne
Protokoll und KI-Gedächtnis ist vorher wie nachher `dbf5fa3f49a96cd1` (200 Tage) und `a177d1db875a10b1`
(90 Tage), jede Ereigniszahl außer den Ablehnungen ist gleich, das Turnier zeilengleich. Ablehnungen
Weltkarte **1177 → 216** (6,32 % → 1,22 % der KI-Befehle), Voreinstellung **267 → 0**.

**Die Zusagen von T-M14-11 und T-M14-12** (Eintrag „T-M41-06" oben) stehen jetzt im 90-Tage-Lauf der
ausgelieferten Voreinstellung (`ai-integration.slow.test.ts`, Startzahl 1914, sieben KI):

| Zusage | gemessen (90 Tage) | Stand |
|---|---|---|
| Ablehnungsquote < 10 % | 0 % (vorher 3,92 %) | zugesichert |
| `NO_PATH` < 2 % der Marschbefehle | 0 von 2556 | zugesichert |
| Paarung Armee/Fehlercode ≤ 3 | 0 | zugesichert |
| ≥ 1 Kriegserklärung | 5 | zugesichert |
| keine Macht ohne Hauptstadt, solange sie eine Stadt hält | 0 am Ende, 0 Tage | zugesichert — *berichtigt nach der Durchsicht (M1): über einer leeren Menge, 0 Verluste in 90 Tagen; jetzt im 200-Tage-Lauf mit 10 Verlusten zugesichert* |
| Handel je KI-Macht | alle 7, mindestens 288 | zugesichert |
| abgewiesene `acceptPeace` < 5 % | keine diplomatische Ablehnung (1 Annahme) | zugesichert, strenger |
| Frieden zwischen zwei KI | 1 | zugesichert |
| je Macht eine Armee mit `armyRange > 0` | 0 von 7 | **zurückgenommen** (`DECISIONS.md`) |
| ≤ 3 Armeeobjekte je Macht und Provinz | höchstens 86, stehend 8 | Zahl im Bericht, Nebenbefund (b) |
| zusätzliche AK für den Ablehnungsanteil bei R-AI-01 | nie gebaut | **zurückgenommen** (`DECISIONS.md`) |

Im 200-Tage-Lauf stehen dieselben Zahlen im Bericht; zugesichert ist dort nur `ARMY_NOT_FOUND` = 0.

**Die „neun Zahlen je Stufe" aus T-M15-08.** Das Turnier zählte Kriegserklärung und Beschuss je Partie für
**beide** antretenden Stufen — der Beschuss von „schwer" stand auch bei „leicht". Jetzt nach dem
Handelnden (`byDifficulty`): Kriegserklärungen leicht 0, normal 110, schwer 70; selbsttätiger Beschuss
**0 auf jeder Stufe**. Zugesichert sind die Kriegserklärungen von „schwer" und „normal", der Rest ist
zurückgenommen (`DECISIONS.md`).

**Nebenbefunde (nicht in dieser Aufgabe gebaut):**

- **(a) Das Artillerie-Tor ist dünn.** 200 Tage Weltkarte: **1 Artillerie, 10 selbsttätige Beschüsse**
  (2026-09-12: 9 und 121); `ai-integration.slow.test.ts` sichert `> 0` und ist damit auf einer einzigen
  Einheit grün. Naheliegende Ursache H1 der Durchsicht (Fabrikausbau sperrt die Stadt) → nach der
  H1-Reparatur nachmessen, sonst T-M41-14.
- **(b) Viele Armeeobjekte je Provinz.** Voreinstellung höchstens 86 (stehend 8), Weltkarte 101 (stehend 17),
  fast nur Durchzug. `consolidate.ts` legt je Denkschritt nur **eine** Provinz zusammen (`break`), und der
  Deckel vergleicht die Zahl der **Stapel** mit `stackFullContribution` = 20 **Einheiten** — er greift nie.
  → T-M41-10.
- **(c) Die Hauptstadt wird im Turnier täglich neu befohlen.** Nachbau der Untersuchung: 298×
  `SET_CAPITAL:ON_COOLDOWN` in einem Lauf; `PublicView.self` führt die 30-Tage-Sperre des Verlegens nicht.
  → T-M41-11.
- **(d) Im Turnier schießt keine Stufe.** R-BAT-08/AK3 sagt „SOLL ihre Artillerie im Turnier
  Beschussereignisse erzeugen" — gemessen 0 auf jeder Stufe (40 Spieltage, Testkarte, Artillerie ab Tag 34
  hinter der Fabrik). Belegt ist der Beschuss nur als Summe im 200-Tage-Lauf (Befund a). Vermerk bei
  R-BAT-08/AK3 in `01-REQUIREMENTS.md`; die Anforderung selbst bleibt gebucht, ihr Text wird nicht still
  gelockert.
- **(e) 213 `BUILD:NOT_OWNER` sind Geisterbauten** in Provinzen, die die KI nur noch erinnert (`stale`), eine
  davon 94× (China, PAK-NORTH); wegen `break` verdrängt der Geisterbau den echten Bau des Tages. → T-M41-09.

**Status:** behoben (`ARMY_NOT_FOUND`, T-M41-08); Zusagen aus M14 eingelöst oder zurückgenommen;
Nebenbefunde (a)–(e) offen, mit Aufgabe in Block N2.

---

## 2026-09-13 · Nacharbeit T-M41-01 (H1, H2) · Der Fabrikausbau sperrte die Städte — repariert, und das Artillerie-Tor lebt wieder

**Der Befund der Durchsicht, nachgemessen.** `nextBuildingFor` lieferte seit T-M41-01 für jede Stadt mit
einer Fabrik unter `maxLevel` nur noch „factory"; war diese Stufe zu teuer, sprang `economyCommands` zur
nächsten Provinz. Eisenbahn, Festung und Hafen kamen in der Stadt erst nach Fabrikstufe 3 — das
3,24-fache des Grundpreises. Neu gezählt in `fullgame.slow.test.ts` (Städte je Macht am Ende), auf dem
Stand nach T-M41-08: mit Startzahl 1914 halten die Mächte zusammen 71 Städte, **39 davon mit Fabrik und
ohne Eisenbahn**; 2015 **66 von 82**; 1815 **40 von 71**. Russland allein, 1815: 48 Städte, 36 hängend.
`economy.test.ts` zeigt den Mechanismus in einem Satz: Stadt mit Fabrik 1, Stufe 2 zu teuer, Eisenbahn
bezahlbar — die KI baut die Eisenbahn **in einer Landprovinz** („expected 'railway in rural' to be
'railway in city'").

**Reparatur.** Der Ausbau ist nur noch der **erste** Wunsch einer Stadt, deren Fabrik steht; Eisenbahn,
Festung und Hafen stehen dahinter, und `economyCommands` baut den ersten bezahlbaren. Kaserne und erste
Fabrik bleiben allein wie bisher, der Handel (`missingForNextBuilding`) zielt weiter auf den ersten
Wunsch — geändert ist genau eine Größe. *(Berichtigt nach der Durchsicht von Block N2, M2: nicht
genau eine. Die Ausweichliste gilt für jede Provinz mit Kaserne, auch Landprovinzen und Städte mit
Fabrik 3 — dort baut die KI jetzt die Festung, wenn die Eisenbahn zu teuer ist, statt zur nächsten
Provinz zu gehen. Gemessen nur in der Summe der Läufe unten; Haltetest in `economy.test.ts`.)* Gewählt statt „Ausbau hinter die anderen einordnen", weil eine
reiche Macht die Fabrik so weiter zuerst ausbaut (`DECISIONS.md`, Nachtrag zu T-M41-01).

**Vollpartie, vorher → nachher** (vorher = Stand nach T-M41-08, Berichte mit denselben Feldern):

| Startzahl | Siegtag | Kriege | Eroberungen | Schlachten | Städte mit Eisenbahn / Festung / Festung 2 | Fabrik ohne Eisenbahn | Fabrik ≥ 2 / = 3 (Provinzen) |
|---|---|---|---|---|---|---|---|
| 1914 vorher | 582 | 12 | 1615 | 5236 | 18 / 13 / 11 von 71 | 39 | 29 / 11 |
| 1914 nachher | **430** | 11 | 1022 | 4009 | **43 / 41 / 32** von 72 | **2** | 25 / 3 |
| 2015 vorher | 868 | 37 | 2923 | 11262 | 11 / 4 / 0 von 82 | 66 | 42 / 0 |
| 2015 nachher | **640** | 11 | 1826 | 7128 | **69 / 67 / 62** von 80 | **0** | 56 / 13 |
| 1815 vorher | 412 | 12 | 1172 | 5323 | 11 / 4 / 0 von 71 | 40 | 23 / 0 |
| 1815 nachher | **571** | 8 | 1609 | 5811 | **66 / 62 / 59** von 81 | **1** | 51 / 4 |

AK-1 ist in allen drei Startzahlen entschieden, jeder Siegtag liegt im Tor 300–1500 aus T-M34-07, und
„mindestens eine Macht besitzt Fabrikstufe 2" hält. Der Siegtag springt wieder in beide Richtungen —
die Partie wird eine andere, wie schon bei T-M41-02 beobachtet. Mit Startzahl 2015 gewinnt jetzt China
(p7) statt Russland (p6), mit 11 statt 37 Kriegserklärungen, und China erreicht Fabrikstufe 3 in 13
Provinzen.

**H2 — das Integrationstor, gegen den Stand vom 2026-09-12** (`ai-integration.json`, Weltkarte, 200 Tage):

| Größe | 2026-09-12 | nach T-M41-08 | nach H1 |
|---|---|---|---|
| Artillerie ausgehoben | 9 | 1 | **69** |
| selbsttätiger Beschuss | 121 | 10 | **303** |
| begonnene Fabriken | 77 | 71 | 76 |
| Kriegserklärungen | 13 | 12 | 15 |
| Ablehnungen | 1105 | 216 | 136 (59 `BUILD:NOT_OWNER`, 72 `SET_CAPITAL:ON_COOLDOWN`, 5 `RECRUIT`) |

Das dünne Tor (Nebenbefund a zu T-M41-08) war Folge von H1: die Städte, die Artillerie ausheben
könnten, bauten nichts mehr. **Aber:** alle 69 Artillerien und alle 303 Beschüsse gehören einer Stufe —
„schwer" (China, 51 Armeen mit Reichweite); „leicht" und „normal" 0. Der 90-Tage-Lauf der Voreinstellung
bleibt grün (0 Ablehnungen), sein Endzustand hat sich verschoben (`a177d1db875a10b1` → `41acc8a544184d8b`).

**Turnier:** nicht mehr zeilengleich, R-AI-06 hält — Siegquoten 1,00 / 0,70 (10:0:15) / 1,00 wie vorher;
„schwer gegen normal im Frieden" 146 → 145 Kriegserklärungen, 97 → 96 Frieden.

**Grundlauf** (`progress.slow.test.ts`, 12 Startzahlen × 120 Tage): Anteil des Stärksten 0,4462 → **0,3623**, Eroberungen
301,3 → 314,5, Überlebende 5,08 → 5,67, Endbestände 50439 → 41961. Der Lauf vorher war gleich dem
eingecheckten Bericht — T-M41-08 und M40 hatten ihn nicht verschoben. **Befund:** der Ausgangswert in
`balance-sweep.md` beschreibt damit nicht mehr den heutigen Stand; der Frische-Wächter der Abnahme sieht das
nicht (er fragt nur `data/rules`), der eine Parameterlauf im Schlussblock nach M35 misst neu (bis 2026-09-13: T-M17-16). Risiko 5 (200 Tage, sechs
Europäer): höchste Stufe weiter 1.

**Neu sichtbar, nicht in dieser Reparatur:** `SET_CAPITAL:ON_COOLDOWN` 72× auf der Weltkarte, und die längste
Strecke ohne Hauptstadt bei gehaltener Stadt ist 31 Tage (Italien) — die 30-Tage-Sperre nach einem zweiten
Verlust. Gehört zu T-M41-11.

**Status: behoben** (Nacharbeit zu T-M41-01). Plantext bei T-M41-01 in `03-TASKS.md` und `tasks.yaml`,
Nachtrag in `DECISIONS.md` und `progress-baseline.md` §5.

---

## 2026-09-13 · T-M41-09 · Die KI baute in Provinzen, die sie nur erinnerte — und jeder Geisterbau kostete den echten Bau des Tages

**Befund** (Nebenbefund e zu T-M41-08). Eine Provinz außer Sicht führt `publicView` mit dem Besitzer, den die
Macht zuletzt gesehen hat (`stale: true`) — auch dann noch als eigene, wenn ein Gegner sie längst hält. Die
Erinnerung zeigt keine Gebäude, also wollte die KI dort eine Kaserne, und der Kern lehnte mit `NOT_OWNER`
ab, jeden Tag neu. Weil `economyCommands` nur einen Bau je Denkschritt befiehlt, verdrängte der Geisterbau
den echten; `missingForNextBuilding` handelte obendrein dafür. Stand nach der Reparatur zu H1: **59
`BUILD:NOT_OWNER`** in 200 Tagen, eine Provinz **50×** (China, PAK-CENTRAL).

**Reparatur.** Wirtschaft, Handel und Aushebung sehen nur sichtbare eigene Provinzen. Militär, Diplomatie und
Hauptstadt bleiben bei der vollen Sicht — dort heißt „erinnert mein" Rückeroberung, und das wäre eine eigene
Verhaltensänderung. Tests zuerst: `economy.test.ts` rot 2 von 13 („expected [ 'erinnert' ] to not include
'erinnert'", ein `TRADE` für den erinnerten Bau), `ai-integration.slow.test.ts` rot 2 von 19 („expected 59 to
be +0", „Weltkarte, 200 Tage: expected 50 to be less than or equal to 3").

**Abweichung von der Untersuchung.** Sie wollte hier den erweiterten Paarungsschlüssel (Macht, Befehl,
Fehlercode, Einzelheiten) über **alle** Befehle zusichern. Das trägt nach H1 nicht: `SET_CAPITAL:ON_COOLDOWN`
wiederholt dieselbe Sperre bis zu 29× (Italien). Zugesichert ist deshalb der Bauauftrag; der volle Schlüssel
geht an T-M41-11.

**Vorher → nachher** (vorher = Stand nach H1):

| Größe | vorher (Stand nach H1) | nachher |
|---|---|---|
| `BUILD:NOT_OWNER`, Weltkarte 200 Tage | 59 | **0** |
| derselbe abgelehnte Bauauftrag, höchstens | 50 (China, PAK-CENTRAL) | 0 |
| Ablehnungen gesamt | 136 (0,82 %) | 75 (0,45 %) — 72 `SET_CAPITAL:ON_COOLDOWN`, 3 `RECRUIT` |
| begonnene Fabriken / Artillerie / selbsttätiger Beschuss | 76 / 69 / 303 | 71 / 63 / 231 |
| Voreinstellung 90 Tage, Prüfsumme ohne Protokoll und KI | `41acc8a544184d8b` | **bitgleich** |
| Vollpartie 1914: Siegtag, Sieger | 430, p6 | **975**, p7 (China) |
| Vollpartie 2015: Siegtag, Sieger | 640, p7 | **583**, p6 |
| Vollpartie 1815: Siegtag, Sieger | 571, p6 | **583**, p6 |
| Turnier | — | zeilengleich |
| Grundlauf (`progress.slow`) | Anteil des Stärksten 0,3623 | 0,3684; Eroberungen 314,5 → 310,1, Überlebende 5,67 → 5,42 |

AK-1 ist in allen drei Startzahlen entschieden, jeder Siegtag liegt im Tor 300–1500. Mit Startzahl 1914
endet die Partie jetzt mehr als doppelt so spät — China gewinnt mit Fabrikstufe 3 in 61 Provinzen, 2589
Eroberungen statt 1022. Der Siegtag springt wie schon bei H1 je Änderung in beide Richtungen; die
Voreinstellung bleibt über 90 Tage bitgleich, weil erinnerte Bauten dort nicht vorkommen.

**Status: behoben** (T-M41-09).

---

## 2026-09-13 · T-M41-10 · „Höchstens drei Armeeobjekte je Provinz" — gebaut, am Rücknahmekriterium gerissen, zurückgenommen

**Befund** (Nebenbefund b zu T-M41-08). T-M14-12 sagte zu: „keine KI-Macht hält mehr als drei Armeeobjekte in
derselben Provinz". Gemessen auf dem Stand nach T-M41-09: Voreinstellung (90 Tage) bis zu **65** Armeeobjekte
einer Macht in einer Provinz, **stehend 5**; Weltkarte (200 Tage) bis zu **80**, **stehend 12**. Zwei Stellen in
`consolidate.ts`: der `break` legt je Denkschritt nur **eine** Provinz zusammen, und der Deckel vergleicht die Zahl
der **Stapel** (einer je Einheitenart) mit `stackFullContribution`, zwanzig **Einheiten** — er greift nie.
Marschierende Armeen kann der Kern nicht zusammenlegen (`ARMY_BUSY`); fast alle 65 bzw. 80 sind Durchzug.

**Gebaut und gemessen.** Beide Stellen repariert (alle Provinzen je Denkschritt, Deckel über `unitCount`), die
Zusage neu gefasst auf **stehende** Armeeobjekte. Tests zuerst: `decide.test.ts` rot 2 von 42 („expected [ 'o1' ]
to deeply equal [ 'o1', 'o2' ]", „expected [ 'a1', 'a2', 'a3' ] to have a length of 2 but got 3"), grün mit der
Reparatur; `ai-integration.slow.test.ts` mit der Zusicherung „Voreinstellung stehend ≤ 3" rot mit der alten
`consolidate.ts` („an 1 Tagen mehr als drei: expected 5 to be less than or equal to 3").

**Rücknahmekriterium** (Vollpartie 1914/2015/1815 im Tor 300–1500 und entschieden, `ai-integration` 200 Tage grün,
Turnier im Band von R-AI-06):

| | vorher (nach T-M41-09) | mit T-M41-10 |
|---|---|---|
| **`ai-integration` 200 Tage** | grün | **rot 2 von 20** |
| Artillerie ausgehoben / selbsttätiger Beschuss | 63 / 231 | **0 / 0** |
| stehende Armeeobjekte je Provinz, höchstens (Weltkarte / Voreinstellung) | 12 / 5 | 11 / **5** (an 2 Tagen über drei) |
| Ablehnungen Weltkarte | 75 | 44 (42 `SET_CAPITAL:ON_COOLDOWN`) |
| Turnier | — | zeilengleich, Band hält |
| Vollpartie 1914: Siegtag | 975 | 842, entschieden (Sieger p7 → p8) |
| Vollpartie 2015: Siegtag | 583 | 1003, entschieden (Sieger p6 → p7) |
| Vollpartie 1815: Siegtag | 583 | 456, entschieden |
| Grundlauf (`progress.slow`) | 0,3684 | 0,3703 (Eroberungen 310,1 → 309,2) |

**Das Kriterium ist gerissen** — am Integrationstor der Artilleriekette, R-AI-08/AK3. Und die neu gefasste Zusage
hielt auch mit der Reparatur nicht. **T-M41-10 ist zurückgenommen**: `consolidate.ts` und die Tests stehen wieder
auf dem Stand nach T-M41-09, die Berichte ebenso; die Aufgabe steht auf `todo` mit `reopened`, die Zusage 7 ist mit
dieser Messung nach M18 verschoben (`DECISIONS.md`). Keine Grenze bewegt.

**Zwei offene Fragen, nicht gemessen:**
- **Warum verschwindet die Artillerie?** Naheliegend: `TARGET_MIX` in `economy.ts` zählt Stapel, nicht Einheiten.
  Zusammenlegen verschmilzt die Infanteriestapel mehrerer Armeen zu einem; der Anteil der Infanterie sinkt
  scheinbar, sie behält den größten Rückstand, und die Artillerie kommt nie an die Reihe. Dieselbe Kette hält
  heute an einer einzigen Macht („schwer", China) — das Tor ist dünner, als die Zahl 231 aussieht.
- **Warum hält „stehend ≤ 3" nicht?** Naheliegend: der Deckel in Einheiten legt zwei große Verbände zusammen und
  lässt jeden weiteren stehen; dazu denkt jede Macht nur jeden siebten oder achten Tick, und Aushebungen erzeugen
  dazwischen neue Armeen. Ob der Deckel und die Zusage überhaupt zusammenpassen, ist die erste Frage für M18.

**Status: zurückgenommen** (T-M41-10 auf `todo`, Zusage 7 nach M18).

---

## 2026-09-13 · T-M41-11 · Die KI sah die Sperre beim Verlegen der Hauptstadt nicht — und befahl jeden Tag neu

**Befund** (Nebenbefund c zu T-M41-08). `SET_CAPITAL` wird 30 Spieltage nach dem letzten Verlegen mit
`ON_COOLDOWN` abgelehnt (`CAPITAL_MOVE_COOLDOWN_DAYS`). `PublicView.self` führte nur `capitalLostUntil`, nicht die
Sperre; `capitalCommands` befahl deshalb an jedem Strategietag neu. Im Turnier-Nachbau der Untersuchung 298×; auf
der Weltkarte zeigte es sich erst nach der Reparatur zu H1: **72×** in 200 Tagen, dieselbe Sperre bis zu **29×**
(Italien) — nach T-M41-09 die letzte große Ablehnungsklasse.

**Reparatur.** `PublicView.self.capitalMovedAtTick` (eigenes Wissen, nur der `self`-Block — `retreating` aus M40 in
derselben Datei bleibt unberührt), `CAPITAL_MOVE_COOLDOWN_DAYS` aus dem Kernindex, `capitalCommands` wartet die Sperre
ab und begründet es (R-AI-05). Tests zuerst: `publicView.test.ts` rot 3 von 19 („expected undefined to be 48"),
`decide.test.ts` rot 1 von 42 (ein `SET_CAPITAL`, das der Kern mit `ON_COOLDOWN` ablehnen würde),
`ai-integration.slow.test.ts` rot 2 von 21 mit der alten `capital.ts` („Weltkarte, 200 Tage: expected 72 to be +0",
„expected 29 to be less than or equal to 3").

**Neutral, gemessen.** Sicht ist kein Zustand, und eine abgelehnte `SET_CAPITAL` änderte nichts:

| Größe | vorher (nach T-M41-10-Rücknahme) | nachher |
|---|---|---|
| Endzustand ohne Protokoll und KI, Weltkarte 200 Tage | `e7b0627bff9f7b39` | **bitgleich** |
| dasselbe, Voreinstellung 90 Tage | `41acc8a544184d8b` | **bitgleich** |
| Ablehnungen Weltkarte | 75 (0,45 %) | **3** (0,02 %, alle `RECRUIT:INSUFFICIENT_RESOURCES`) |
| längste Wiederholung eines abgelehnten Befehls | 29 | **2** |
| Golden-Master (`determinism`, `walkthrough`, `replay`, ohne `UPDATE_GOLDEN`) | — | 20 grün, Dateien unverändert |
| Turnier | — | zeilengleich |

Damit trägt auch der erweiterte Paarungsschlüssel aus T-M14-11 (Macht, Befehl, Fehlercode, Einzelheiten) über
**alle** Befehle, den T-M41-09 noch nicht zusichern konnte — jetzt in beiden Läufen zugesichert.

**Status: behoben** (T-M41-11).

---

## 2026-09-13 · Block N2, Schluss · T-M41-14 ist nicht nötig — aber das Artillerie-Tor hängt an einer einzigen Macht

**Die Prüfung aus der Orchestrierung** (§3d, Punkt 6): liegt der selbsttätige Beschuss im Integrationslauf (Weltkarte,
200 Tage, acht KI) nach allen Änderungen von Block N2 weiter unter einem Viertel des Werts vom 2026-09-12 (121, also
30), wird die Ursache als T-M41-14 untersucht. **Gemessen auf dem Endstand (`55dcf23`): 231 Beschüsse, 63
Artillerien.** Die Bedingung tritt nicht ein; T-M41-14 ist nicht angelegt.

| Stand | Artillerie | selbsttätiger Beschuss |
|---|---|---|
| 2026-09-12 (vor T-M41-01) | 9 | 121 |
| nach T-M41-08 | 1 | 10 |
| nach H1 (Fabrikausbau sperrt keine Stadt) | 69 | 303 |
| nach T-M41-09 und T-M41-11 (Endstand) | 63 | **231** |
| mit T-M41-10 (zurückgenommen) | 0 | 0 |

**Der Befund, der bleibt, und keine Aufgabe hat.** Alle 63 Artillerien und alle 231 Beschüsse gehören **einer**
Macht: China, Stufe „schwer", 47 Armeen mit Reichweite am Ende. Die drei „leichten" und drei „normalen" Mächte heben
keine einzige Artillerie aus. Das Tor aus R-AI-08/AK3 („Artillerie > 0, Beschuss > 0") ist damit grün, aber es steht
auf einer einzigen Kette — T-M41-10 hat vorgeführt, dass eine Änderung am Zusammenlegen es auf null bringt.
Naheliegend, nicht gemessen: `TARGET_MIX` in `packages/ai/src/economy.ts` zählt Stapel statt Einheiten, und
`recruitShare` der Stufen (80 / 200 / 280) lässt die teure Artillerie nur bei „schwer" in den Haushalt. *(Berichtigt nach der Durchsicht von Block N2, H1: diese Erklärung widerspricht den eigenen Daten.
Im Integrationslauf sind **zwei** Mächte „schwer" — China und Frankreich —, und Frankreich hebt keine
Artillerie aus. Engstellen sind die Fabrik und das Geld im Aushebebudget, nicht die Stufe; Messung im
Eintrag „Durchsicht Block N2, H1" unten.)* Vorgemerkt
für M18 zusammen mit Zusage 7 (T-M41-10); die Zusicherung wird nicht auf „je Stufe" verschärft, solange das nicht
gebaut ist.

**Schlussmessung von Block N2** (Code `55dcf23`, alle Berichte eingecheckt):

| Lauf | Ergebnis |
|---|---|
| Vollpartie 1914 | Tag **975**, Sieger p7 (China), 11 Kriegserklärungen, 2589 Eroberungen |
| Vollpartie 2015 | Tag **583**, Sieger p6 (Russland), 13 Kriegserklärungen, 2185 Eroberungen |
| Vollpartie 1815 | Tag **583**, Sieger p6 (Russland), 10 Kriegserklärungen, 1587 Eroberungen |
| `progress.slow` (Grundlauf) | Anteil des Stärksten **0,3684** (vor Block N2: 0,4462), Eroberungen 310,1, Überlebende 5,42 |
| Turnier | schwer:leicht 1,00, schwer:normal Frieden **0,70** (10:0:15), im Krieg 1,00 — R-AI-06 hält |
| `ai-integration` 200 T / Voreinstellung 90 T | 21 grün; Ablehnungen **3** von 16 650 (vor Block N2: 1177 von 18 629), Voreinstellung 0 |

Die Vollpartien vor und nach T-M41-11 sind zahlengleich (nur `measuredAt` verschieden) — auch über 975 Spieltage
belegt, dass die Sicht auf die Hauptstadtsperre die Partie nicht ändert.

**Folge für den Parameterlauf:** der Ausgangswert in `balance-sweep.md` (Grundlauf 0,4442) beschreibt den Stand nicht
mehr. Der Frische-Wächter der Abnahme sieht das nicht, weil sich `data/rules` nicht geändert hat; der eine Parameterlauf
im Schlussblock misst neu.

**Status: Beobachtung** (Artillerie bei einer Macht, vorgemerkt für M18); T-M41-14 nicht nötig.

---

## 2026-09-13 · Durchsicht Block N2, N3 · Die drei Startzahlen der Vollpartie variieren nur den Zufall, nicht die Aufstellung

**Befund der Durchsicht, selbst nachgeprüft** (eigenes Skript gegen den Worktree, `scratchpad/n2/seed/`, nicht das Skript
des Prüfers). `toConfig({ ...DEFAULT_NEW_GAME, seed }, map)` und `createInitialState` für 1914, 2015 und 1815:

| | 1914 | 2015 | 1815 |
|---|---|---|---|
| `state.seed` | 1914 | 2015 | 1815 |
| `state.rng` (erste Zustandszahl) | 2484121936 | 816126800 | 3993579382 |
| Startzustand ohne `seed`/`rng`, sha256 über JSON | `fb9f284dabb1bd40` | `fb9f284dabb1bd40` | `fb9f284dabb1bd40` |
| dasselbe, `hashValue` des Projekts | `bebb7f75a2e09d7f` | `bebb7f75a2e09d7f` | `bebb7f75a2e09d7f` |
| Spieler, Gegner, Stufen, Hauptstädte | gleich | gleich | gleich |

Zwei Werkzeuge, dasselbe Ergebnis; der sha256-Wert trifft den der Durchsicht.

**Was das für AK-1 heißt.** Die drei Vollpartien spielen **dieselbe Aufstellung** — Vereinigte Staaten gegen
Kanada, Mexiko, Brasilien, Argentinien, Russland, China, Indien, alle „normal" — und unterscheiden sich nur im
Zufallsstrom. „Drei Startzahlen" ist deshalb eine engere Streuung, als der Ausdruck nahelegt: sie misst, wie
empfindlich **diese** Partie auf den Zufall ist, nicht, wie verschiedene Partien ausgehen. Dass 2015 und 1815 beide
an Tag 583 enden, ist echt (die Berichte unterscheiden sich in allen anderen Feldern; die Durchsicht hat 1815
unabhängig nachgefahren) und nicht ein kopierter Bericht.

**Veraltete Zahlen (N4), berichtigt:** `03-TASKS.md` nennt bei T-M15-08 „normal 110" (heute 109) und bei T-M14-11
„`NO_PATH` 0 von 2556, 5 Kriegserklärungen" (heute 0 von 2405, 6) — beide mit „(Stand T-M41-08)" versehen; der
Kommentar in `fullgame.slow.test.ts` („1914 endet an Tag 471") ist nachgezogen und nennt die Einschränkung oben.

**Status: Beobachtung** (keine Änderung am Messaufbau; wer verschiedene Partien messen will, braucht verschiedene
Aufstellungen, nicht nur Startzahlen).

---

## 2026-09-13 · Durchsicht Block N2, H1 · Die Feuerautomatik lebt in der ausgelieferten Partie nicht — das Tor hängt an einer Macht

**Befund der Durchsicht, mit eigenem Lauf bestätigt** (`ai-integration.slow.test.ts` fährt die Voreinstellung jetzt
200 Tage und hält Tag 90 als Zwischenstand fest; Prüfsummen der Weltkarte `e7b0627bff9f7b39` und der Voreinstellung
an Tag 90 `41acc8a544184d8b` unverändert — dieselbe Partie, derselbe Code).

**1 · Das Tor aus R-AI-08/AK3 steht auf einer einzigen Macht.** Weltkarte, 200 Tage, acht KI:

| Macht | Stufe | Fabriken begonnen | Geld am Ende | Artillerie |
|---|---|---|---|---|
| Vereinigte Staaten | leicht | 37 | 963 217 | 0 |
| Russland | normal | 0 | 363 452 | 0 |
| China | **schwer** | 4 | 702 525 | **63** |
| Indien | leicht | 27 | 1 043 552 | 0 |
| Deutschland | normal | 0 | 305 017 | 0 |
| Frankreich | **schwer** | 2 | 793 878 | **0** |
| Vereinigtes Königreich | leicht | 1 | 841 505 | 0 |
| Italien | normal | 0 | 304 900 | 0 |

Mächte mit Artillerie: **China**. Selbsttätiger Beschuss 231, alle von China.

**2 · Die Ursache war falsch benannt.** Der Schlusseintrag zu Block N2 schrieb, `recruitShare` lasse die Artillerie
„nur bei schwer in den Haushalt" — Frankreich ist ebenfalls „schwer" und hebt nichts aus. Was die Zahlen tragen:
- **Fabrik.** Drei der fünf Mächte ohne „leicht" beginnen in 200 Tagen keine einzige Fabrik, Frankreich zwei.
- **Geld im Aushebebudget.** `recruitCommands` gibt je Einheit höchstens `recruitShare` ‰ des Vorrats aus; eine
  Artillerie kostet 200 000 Geld. Bei „leicht" (80 ‰) braucht das 2,5 Mio. Geld auf Lager — die Vereinigten Staaten
  bauen 37 Fabriken und enden mit 963 217. Bei „schwer" (280 ‰) sind es 715 000; Frankreich endet knapp darüber
  (laut Durchsicht, `review-n2/why.json`, lag es unterwegs zwischen 211 000 und 794 000 — nicht selbst gemessen).
- Dazu, laut Durchsicht und nicht selbst gemessen: gefragt wird zuerst die vielseitigste Provinz, und die trägt oft
  keine Fabrik.

**3 · In der Partie, die ein Spieler bekommt, schießt keine KI.** Voreinstellung (Startzahl 1914, sieben KI, alle
„normal"), dieselbe Partie über 200 Tage: **3 Artillerien** (China), **0 selbsttätige Beschüsse**; Fabriken begonnen
nur Russland 5, China 6, Indien 1; Kanada und Indien enden mit 0 Geld. An Tag 90: 0 und 0. Das bestätigt die Zahlen
der Durchsicht (`review-n2/preset200.json`: 3 Artillerien, 0 Beschüsse). **R-BAT-08/AK3 ist für die Stufe „normal"
nicht belegt**, weder im Turnier (0) noch in der Voreinstellung.

**Was nicht geschieht:** keine Grenze geändert, kein Umbau des KI-Balancings. Das ist eine Frage an Noah bzw. M18
(`DECISIONS.md`, 2026-09-13, R-BAT-08/AK3). Kein Rückschritt durch Block N2: vorher 1 Artillerie und 10 Beschüsse auf
der Weltkarte.

**Status: offen, ohne Aufgabe** — Frage in `DECISIONS.md`, vorgemerkt für M18 zusammen mit Zusage 7 (T-M41-10).

---

## 2026-09-13 · Durchsicht Block N2, M3 · Der Handel arbeitet auf den teuersten Wunsch hin, gebaut wird der erste bezahlbare (plausibel, nicht gebaut)

**Befund der Durchsicht, mit Zahlen aus dem eigenen Bericht** (`docs/reports/ai-integration.json`), **nicht gebaut**:

- **Zwei Stellen, zwei Ziele.** `missingForNextBuilding` nimmt den **ersten** Wunsch einer Provinz
  (`nextBuildingFor`) — seit T-M41-01 in einer Stadt mit Fabrik deren nächste Stufe, bis zum 3,24-fachen Preis —
  und `tradeCommands` tauscht auf den Rohstoff hin, der dafür fehlt. Gebaut wird seit der Reparatur zu H1 aber der
  **erste bezahlbare** Wunsch, oft Eisenbahn oder Festung. Die Nacharbeit zu H1 hat das bewusst so gelassen (eine
  Größe geändert); dass Handel und Bau seither verschiedene Ziele verfolgen, ist die Folge.
- **Getauscht wird fast in jedem Denkschritt.** `tradeCommands` verkauft ein Zehntel des größten Bestands, der selbst
  nicht knapp ist, ohne auf eine Rücklage zu achten.

| Lauf | Tauschgeschäfte | je Macht | je Macht und Tag |
|---|---|---|---|
| Weltkarte, 200 Tage, acht KI (Stand nach Block N2) | 4637 | 568–593 | ≈ 2,9 |
| dasselbe, 2026-09-12 (vor M41) | 3914 | — | ≈ 2,4 |
| Voreinstellung, 90 Tage, sieben KI | 2060 | 288–299 | ≈ 3,3 |

Eine Macht denkt bei acht KI jeden achten Tick, also dreimal am Tag; fast jeder Denkschritt enthält einen Tausch.
Durch Block N2 unverändert („schwer" 1179 → 1180 in der Summe beider Mächte).

**Plausible Folge, nicht gemessen:** der Tausch kann genau den Rohstoff abgeben, den der tatsächlich gebaute Wunsch
oder die Aushebung braucht — etwa Geld, das die Artillerie im Aushebebudget verlangt (Eintrag „Durchsicht Block N2, H1"
oben). Ob das eine der Engstellen dort ist, sagt erst eine eigene Messung.

**Mögliche Reparatur (für M18):** den Handel auf den Wunsch ausrichten, der wirklich verfolgt wird, oder nicht tauschen,
wenn im selben Denkschritt gebaut wird — und gesondert messen (Handel, Bauten, Artillerie, Vollpartie, Turnier).

**Status: offen, ohne Aufgabe** — vorgemerkt für M18.

---

## 2026-09-13 · Nach dem Merge von Block N2 · Die Kontrolle des Haltungs-Messlaufs hat sich mit den Gegnern verschoben — AK5 hält

**Gemessen** nach dem Merge `c3ff8be` (Block N2 und Nacharbeit M40), gefahren vom Orchestrator:
- zwölf Episodenläufe mit `WORLDWAR_WRITE_REPORT=1` (`apps/headless/test/stance.slow.test.ts`, 680 s),
- Turnier,
- Vollpartie 1914,
- `pnpm verify`.

Spaltenformat: Provinz-Tage / verloren (davon ohne Gefecht).

| Startzahl · Aufstellung | Garnison vor N2 | **Garnison nach N2** | Verteidigung vor N2 | **Verteidigung nach N2** | Befehle nach N2 |
|---|---|---|---|---|---|
| 1914 · A | 573 / 4 (0) | **317 / 4 (0)** | 573 / 4 (0) | **317 / 4 (0)** | 0 |
| 1914 · B | 733 / 1 (0) | **800 / 0 (0)** | 800 / 0 (0) | **800 / 0 (0)** | 8 |
| 2015 · A | 532 / 3 (0) | **200 / 4 (0)** | 532 / 3 (0) | **200 / 4 (0)** | 0 |
| 2015 · B | 800 / 0 (0) | **734 / 1 (0)** | 800 / 0 (0) | **800 / 0 (0)** | 4 |
| 1815 · A | 702 / 1 (0) | **238 / 4 (0)** | 702 / 1 (0) | **238 / 4 (0)** | 0 |
| 1815 · B | 800 / 0 (0) | **800 / 0 (0)** | 774 / 2 (0) | **791 / 1 (0)** | 9 |
| **Summe** | 4140 / 9 (0) | **3089 / 13 (0)** | 4181 (101,0 %) / 10 (0) | **3146 (101,8 %) / 13 (0)** | 21 |

**AK5 hält.**
- Provinz-Tage: 3146 von 3089 (101,8 %, Schwelle 98 %).
- Verluste ohne Gefecht: in keinem Paar, überall 0.
- 0 Ablehnungen, 0 Kriege ohne Erklärung, 0 Pendelzüge [gezählt ab Abmarsch, strukturell 0 (H-A)].

Das Rücknahmekriterium ist nicht ausgelöst.

**Was fiel: die Kontrolle.** „Die Garnison A 1914 bildet den Lauf vorher nach" erwartete 52 Einmärsche und
4 verlorene Provinzen. Der Lauf ergab 76 und 4. Die 52 stammen vom KI-Stand vor N2.

Geprüft, bevor etwas geändert wurde (`git diff --stat 74d7de0 c3ff8be`): Außerhalb von `packages/ai`, Tests
und Berichten ändert der Merge nur zwei Dateien.
- `packages/core/src/view/publicView.ts`, +10: das Sichtfeld `self.capitalMovedAtTick` (T-M41-11). Es ist
  nur Sicht, und nur die KI liest es.
- `packages/core/src/index.ts`, +1: dessen Export.

Unberührt sind Karte, `data/rules`, `apps/desktop/src/game/newGame.ts`, `packages/testkit` und die
Aufstellung im Test. Eine Garnison handelt nie von selbst.

Die Gegner sind nach N2 stärker: In Aufstellung A hält die Garnison deutlich weniger Provinz-Tage (1914: 317
statt 573).

**Korrektur.** Die Kontrolle ist jetzt der Garnison-Lauf auf dem heutigen KI-Stand, `KONTROLLE =
{ intrusions: 76, provincesLost: 4 }`. Die Geschichte steht im Kopf des Tests und im Bericht
(`episoden.counting.ak5`); die 52 stehen weiter in `episoden.vorher`. Die Zusicherung prüft beide Zahlen wie
bisher, abgeschwächt ist nichts.

Dass die Regel hilft, bleibt unbelegt: Eine befohlene Deckung kam in 0 von 19 Episoden vor Gefechtsende an
(vor N2: 3 von 25).

**Unverändert, belegt:**
- Turnier zeilengleich (`ai-tournament-run.md` ohne Diff).
- Vollpartie 1914: Siegtag **975**, Sieger p7. `fullgame.json` weicht nur in `measuredAt` ab und ist
  zurückgesetzt.
- `pnpm verify`: Exit 0, 144 Dateien / 2059 Tests, Abdeckung Kern 96,8 %, gesamt 96,3 %.

**Status:** Kontrolle begründet gesetzt, `stance.json` eingecheckt. Die nächste Messung, nach T-M40-14 und
T-M40-15, bestätigt die Kontrolle am Lauf.

---

## 2026-09-13 · Durchsicht der Nacharbeit M40, N-1, N-2, N-4, N-6 · Kleine Befunde an der Automatik — festgehalten, nicht gebaut

Gefunden hat sie die Durchsicht der Nacharbeit M40 (`4854465..74d7de0`). Die zweite Nacharbeit (T-M40-14 bis
T-M40-16, Nachtrag T-M40-12) baut davon nur N-3, N-5 und den React-Schlüssel aus N-4. Der Rest steht hier.

**N-1 · „Angegriffen" und „leer" weichen vom Kern ab (plausibel, nicht gemessen).**
- **Befund.** `packages/ai/src/adjutant.ts` zählt jede sichtbare Armee eines Kriegsgegners als Feind in
  ihrer Provinz, auch eine eingeschiffte oder einen reinen Luft- oder Flottenverband. Der Kern prüft für
  die Besetzung `hasHostileLandForces` (`packages/core/src/phases/movement.ts`) und schließt solche Armeen
  aus. Die Automatik hält eine Küstenprovinz mit feindlicher Flotte deshalb für angegriffen, und eine
  eigene Armee dort ist als Quelle gesperrt.
- **Umgekehrt** zählt `occupied` jede eigene Armee als Besatzung, auch eine, die im selben Tick
  abmarschiert, und einen reinen Luftverband. Eine solche Provinz gilt nicht als leer.
- **Warum nicht gebaut.** `VisibleArmy` führt bei fremden Armeen weder `embarked` noch, ob sie
  Landeinheiten tragen. Die Kernbedingung braucht also ein neues Sichtfeld; vorher ist nach R-DIP-04 zu
  prüfen, ob der Besitzer das überhaupt sehen darf.
- **Reparatur später.** Erst das Sichtfeld, dann dieselbe Bedingung wie `hasHostileLandForces`; `occupied`
  nur noch aus `holdsGround`, ohne Armeen, die im selben Tick ausrücken.

**N-2 · „Genau eine Landetappe" prüft die Kantenart nicht (plausibel, harmlos).**
- **Befund.** Die Automatik wählt Ziele über `neighbors`, also Landnachbarn, und verlangt von `planRoute`
  genau eine Etappe ins Ziel. Ob diese Etappe über Land oder über See führt, prüft sie nicht. Gibt es
  zwischen denselben zwei Provinzen einen billigeren Seeweg, geht der Marsch über See; das Ziel bleibt
  trotzdem eigenes Land.
- **Folge.** Der Wortlaut von R-UNIT-09/AK7 („genau einer Landetappe") ist ungenau.
- **Reparatur später.** Die Kante der Etappe (`edgeBetween`) auf `kind === 'land'` prüfen, oder den
  Wortlaut auf „eine Etappe" setzen.

**N-4, der Rest.** Der React-Schlüssel der Protokollzeile hängt seit dem Nachtrag zu T-M40-12 nicht mehr am
Listenplatz. Zwei Punkte bleiben offen:
- **Abgelehnter Befehl.** Lehnt der Kern einen Befehl der Automatik ab, entstünde trotzdem eine Zeile
  „rückt von selbst nach". Gemessen kam das nicht vor: 0 Ablehnungen in allen Episodenläufen.
- **Debug-Mitschrift.** Das Vorspulen mit eingeschalteter Debug-Ansicht gibt nur `tick.ai` an die
  Mitschrift, die Uhr alle Befehle. Die Asymmetrie ist älter als M40, doch jetzt fehlen dort auch die
  Befehle der Automatik.

**N-6 · Die vorbeugende Teilregel ist auf der Weltkarte ungemessen (plausibel).**
- **Befund.** D30.4 schickt eine Verteidigung auch in eine leere eigene Provinz, die an einen sichtbaren
  Kriegsgegner grenzt. Der Haltungs-Messlauf zählt nicht, ob ein Befehl vorbeugend war.
- **Zahlen.** In `docs/reports/stance.json` (`episoden.nachher`, Aufstellung B) liegen die Episoden mit
  befohlener Deckung fast gleichauf mit den Befehlen; die Befehle gingen also in umkämpfte Provinzen.
  - vor N2: 6 zu 6, 9 zu 9, 10 zu 10
  - nach dem Merge: 7 zu 8, 4 zu 4, 8 zu 9
- **Belegt nur durch Einzeltests.** D30.9 sagt, dass die Teilregel in der Messung des Entwurfs nie feuerte;
  gezeigt ist sie nur in `adjutant.test.ts`.
- **Reparatur später.** Eine eigene Zahl „vorbeugende Befehle" im Messlauf: das Ziel war im Tick des
  Befehls ohne Gefecht und ohne feindliche Armee.

**Status:** offen, ohne Aufgabe. N-1 braucht ein Sichtfeld und damit eine eigene Entscheidung.

---

## 2026-09-13 · Nach T-M40-14 und T-M40-15 · Die neue Pendel-Zählung findet einen Pendelzug der Automatik — AK5 hält unverändert

**Gemessen** nach `bf3db75` (T-M40-15): zwölf Episodenläufe mit `WORLDWAR_WRITE_REPORT=1`, 730 s, 9 von 9 Tests grün.
Grün sind damit auch die Kontrolle (Garnison A 1914: 76 Einmärsche, 4 verloren) und AK5.

**Gleich dem Lauf nach dem Merge ist jede Zahl außer einer:**
- Provinz-Tage 3146 von 3089 (101,8 %),
- Verluste ohne Gefecht 0, Ablehnungen 0, Kriege ohne Erklärung 0,
- 21 Befehle, 381 Episoden, 0 von 19 befohlenen Deckungen rechtzeitig.

Das ist erwartet: der Mensch gibt im Messlauf keinen Befehl, und T-M40-14 und T-M40-15 greifen nur an Befehlen des
Spielers. Der Diff des Berichts gegen den Lauf nach dem Merge zeigt außer Texten und `measuredAt` genau eine Zahl.

**Geändert: ein Pendelzug in 1914 · B mit Verteidigung** (vorher 0). Seit T-M40-14 zählt die Frist ab der Ankunft
statt ab dem Abmarsch, und die alte Zählung konnte diesen Zug nicht sehen. Nachgebaut in einem Scratch-Lauf mit
demselben Aufbau (`scratchpad/n2x-pendel`). Ruhe heißt dabei `deployDelayUntil + 120`, in den ausgelieferten Regeln
120 Ticks ab Befehlstick + 2.

| Schritt | Tick | Lage |
|---|---|---|
| Befehl der Automatik: Armee a3 von Südostdeutschland nach Südwestdeutschland | 1801 | 4 Gefechte in Südwestdeutschland während des Marsches |
| Ankunft in Südwestdeutschland | 1853 | 52 Ticks Marsch; die Ruhe endet an Tick 1923, also 70 Ticks nach der Ankunft |
| Befehl der Automatik: a3 zurück nach Südostdeutschland | 1972 | 171 Ticks nach dem Abmarsch, **119 nach der Ankunft**; seit der Ankunft 2 Gefechte in Südostdeutschland |

**Warum das kein Fehler der Regel ist.** Beide Befehle folgen D30.4:
- das Ziel war jeweils eine angegriffene eigene Nachbarprovinz,
- in der Quelle blieb eine weitere Armee stehen,
- die Ruhe war abgelaufen.

Der Zug ist die Folge davon, dass die Ruhe ab dem Abmarsch zählt. Es ist derselbe Mechanismus wie in Befund H-A, nur
mit einem Marsch der Automatik statt einem des Spielers. T-M40-14 hat den Fall für Spielermärsche gelöst, nicht für
die Märsche der Automatik selbst.

*(Berichtigt am 2026-09-13 nach Befund N-6 der Durchsicht der zweiten Nacharbeit, gerechnet, nicht gemessen: die
Ursache ist nicht allein, dass die Ruhe ab dem Abmarsch zählt, sondern dass **Ruhe und Pendelfenster gleich lang
sind** — beide fünf Spieltage, 120 Ticks. Zählte die Ruhe ab der Ankunft, wäre a3 frühestens an Tick 1853 + 120 =
1973 frei, einen Tick nach dem gemessenen Rückzug und 120 Ticks nach der Ankunft; die Kennzahl
(`bewegung.tick - ankunft.tick <= 5 · 24` in `werteAus`) zählte den Zug weiter.)*

**Nicht zugesichert, nicht gebaut.** Pendelzüge gehören nicht zu AK5; die Zahl steht im Bericht. Wer sie verhindern
will, hat zwei Wege, und beide sind eine neue Entscheidung, gemessen mit demselben Lauf:
- die Ruhe ab der Ankunft zählen (Zustandsfeld, in T-M40-14 verworfen) — **verschiebt um einen Tick** und
  verhindert den Zug nicht, weil Ruhe und Pendelfenster gleich lang sind (N-6, siehe oben),
- die Ruhe nach Märschen der Automatik verlängern — wirksam nur, wenn sie länger ist als das Pendelfenster von
  fünf Spieltagen.

**Status:** offen, ohne Aufgabe. `stance.json` eingecheckt, Frische-Wächter grün.

---

## 2026-09-13 · Beim Nachtrag zu T-M40-12 (N-4) gefunden · Die Kennung jeder Protokollzeile hängt am Listenplatz (gelesen, nicht gemessen)

**Befund.** `describeEvent(event, index, …)` in `apps/desktop/src/game/events.ts` baut die Kennung einer Protokollzeile
als `${event.tick}-${event.type}-${index}`. Diese Kennung dient auch als React-Schlüssel. `index` ist der Platz in der
Liste, die `App.tsx` vorher filtert und umdreht (neueste zuerst). Kommt oben eine Zeile hinzu oder fällt eine heraus,
verschieben sich die Plätze, und zwei gleichartige Ereignisse im selben Tick tauschen ihre Schlüssel.

Es ist dasselbe Muster, das N-4 der Durchsicht der Nacharbeit an den Zeilen der Automatik fand; dort ist es seit dem
Nachtrag zu T-M40-12 behoben (`adjutantMarchEntries`).

**Nicht gemessen.** Ob die Oberfläche dadurch sichtbar falsch zeichnet, ist nicht geprüft. Aufgeklappte Zeilen,
etwa ein Gefechtsbericht, wären die Stelle, an der ein vertauschter Schlüssel auffiele.

**Warum nicht gebaut.** Das Muster ist älter als M40 und liegt außerhalb der Nacharbeit. Eine stabile Kennung braucht
etwas, das ein Ereignis eindeutig macht; `GameEvent` trägt keine laufende Nummer.

**Reparatur später.** Kennung aus Tick, Typ und den Feldern, die das Ereignis bestimmen, oder eine laufende Nummer im
Ereignisstrom. Test wie in `events.test.ts` (T-M40-13): dieselbe Zeile behält ihre Kennung, wenn davor eine andere
herausfällt.

**Status:** offen, ohne Aufgabe.

---

## 2026-09-13 · T-M35-06 · Beim Sieger fiel die Bevölkerungsmarke vor der ersten Punktmarke (gemessen, Entscheid getroffen)

**Befund.** Die Vollpartie in der ausgelieferten Voreinstellung (`fullgame.slow.test.ts`, Startzahl 1914) lief auf dem
Stand nach T-M35-05. Siegtag 975, Sieger China, 2589 Eroberungen, 11 Kriegserklärungen: gleich wie vor M35. Die neue
Zusicherung R-GAME-08/AK6 fiel:

> populationShare (Tag 544) nicht nach pointShareFirst (Tag 547): expected 544 to be greater than 547

Zieltage des Siegers: 25 Provinzen an Tag 157, 400 ‰ Punkte an 547, **300 ‰ Weltbevölkerung an 544**, 600 ‰ an 921.
Erster Tag ≥ 20 und letzter Tag ≤ Siegtag hielten. Mit Startzahl 2015 (Sieger Russland: 119 / 237 / 299 / 516) und
1815 (Russland: 115 / 276 / 326 / 456) hielt die Reihenfolge; dort gilt keine Zusicherung. Ereignisstrom und Spielstand
stimmten in allen drei Partien für jede Macht und jedes Ziel überein.

**Ursache.** Die Marken aus der Planung stammten aus Partien mit Russland als Sieger, gemessen vor M41 (Siegtag 471).
Seit Block N2 gewinnt mit Startzahl 1914 China. Bei der bevölkerungsreichsten Macht wachsen Bevölkerungs- und Punktanteil
fast gleich schnell. D31.7 hatte das Risiko genannt: „Die Marken stammen aus KI-Partien mit immer demselben Sieger.“

**Messung statt Schätzung.** Ein vorübergehender Tagesverfolger (gelöscht) zeichnete je Tag und Macht Provinzen,
Punktanteil und Bevölkerungsanteil auf. Er traf in allen drei Partien die Siegtage und Zieltage der Vollpartie. Tabelle
und verworfene Wege stehen im Entscheid.

**Nicht still verschoben.** Die Zusicherung bleibt streng (`>`). Die Marke ändert sich mit einem kippbaren Entscheid:
`DECISIONS.md`, 2026-09-13, T-M35-06, **Bevölkerungsmarke 350 ‰**. Vorhersage aus dem Verfolger: Sieger an Tag 576 /
337 / 376.

**Status:** Entscheid getroffen; T-M35-06 misst die drei Vollpartien mit 350 ‰ nach.
## 2026-09-13 · Beim Bau von T-M40-17 gefunden · Parameterlauf und Turnier folgen dem Code nicht, den sie vermessen (gezählt, entschieden)

**Befund.** Der Frische-Wächter von Parameterlauf und Turnier sieht nur Daten. Seit T-M40-17 sind das
`data/rules` und die jeweilige Karte: `data/maps/world.json` für den Parameterlauf, `data/maps/testworld.json`
für das Turnier (über `smallWorld` aus `packages/testkit`). Beide Läufe spielen aber Partien mit KI und Kern:
- der Parameterlauf über `apps/headless/src/sweep.ts`,
- das Turnier über `apps/headless/src/tournament.ts`,
- beide mit `advanceTicks` aus `packages/ai`.

**Gezählt** mit `git rev-list --count <bericht>..HEAD -- <pfade>`, Worktree `m40n3` auf `72438d1`:

| Messgerät | Bericht | Commits seitdem an KI, Kern und `apps/headless/src` | davon `packages/ai/src` | davon `packages/core/src` |
|---|---|---|---|---|
| Parameterlauf | `d82779d`, 2026-09-12 | 20 | 19 | 5 |
| Turnier | `1edcb7b`, 2026-09-13 | 11 (mit `packages/testkit`) | 11 | 3 |

Am echten Stand melden beide Wächter frisch:
- „seit dem Bericht (d82779d) kein Commit an data/rules, data/maps/world.json auf HEAD"
- „seit dem Bericht (1edcb7b) kein Commit an data/rules, data/maps/testworld.json auf HEAD"

Dass eine Änderung der KI Partien verschiebt, ist gemessen: nach dem Merge von Block N2 ergab dieselbe
Garnison im Haltungs-Messlauf 76 statt 52 Einmärsche, bei unveränderten Regeln und unveränderter Karte.

**Warum nicht gebaut.** Die Messgeräte vermessen nach dem Entscheid vom 2026-09-08 die Regeln. Mit den
Codepfaden wäre die Abnahme heute rot, und der Parameterlauf dauert rund eine Stunde. Ob die Messgeräte jedem
Codecommit folgen sollen, ist eine neue Entscheidung und nicht Teil der Nacharbeit.

**Reparatur später, falls gewollt.** Die Codepfade in `GAUGES` aufnehmen (`scripts/acceptance-criteria.mjs`);
die Einheitsfälle in `test/requirements.test.ts` nennen die Listen wörtlich. Billig wäre es beim Turnier, das
rund 15 Sekunden läuft; teuer beim Parameterlauf.

**Entschieden (2026-09-13, Orchestrator, kippbar).**
- Das Turnier sieht zusätzlich `packages/ai/src` und `packages/core/src`: 13 Sekunden, der billige Beleg für
  die KI-Stärke.
- Der Parameterlauf bleibt bei `data/rules` und `data/maps/world.json`: rund eine Stunde; den Code decken
  Turnier und `progress.slow` ab.
- `apps/headless/src` und `packages/testkit` sieht keiner der beiden, hingenommen.

Entscheid in `DECISIONS.md`, 2026-09-13, „Das Turnier folgt auch KI und Kern". Einheitsfall mit Wegwerf-Repo in
`test/requirements.test.ts`. Am echten Stand (`bd4744c`) meldet der Turnier-Wächter nicht frisch. Das täte er
auch mit der alten Liste, wegen `a64be03` unter `data/rules`.

**Status:** entschieden; das Turnier ist rot, bis ein neuer Turnierlauf eingecheckt ist.

**Nachtrag (2026-09-13, Messcommit).** Der Neulauf auf `bd4744c` ergab einen zeilengleichen Bericht, der sich nicht committen ließ, und der Wächter ging nach dem Commit der Datei (`1edcb7b`) und blieb deshalb rot. Seitdem schreibt das Turnier `Gemessen auf: <Commit> (Quellen sauber)` in seinen Bericht, und der Wächter urteilt wie beim Haltungs-Messlauf nach `<Messcommit>..HEAD`, verlangt einen Vorfahren von HEAD und saubere Quellen (`judgedBy: 'measuredAtCommit'` in `GAUGES`). Der Parameterlauf bleibt bewusst beim Commit seines Berichts (`judgedBy: 'reportCommit'`), und ein Haltetest in `test/requirements.test.ts` sichert diesen Unterschied.

---

## 2026-09-13 · T-M40-19 · Der Folgebefehl der Garnison sieht gesammelte Haltungswechsel — zwei Randlagen bleiben

**N-5, behoben.** Szenario der Durchsicht, am Bildschirm nachgestellt (`App.test.tsx`):
1. Eine Armee steht auf Garnison, die Uhr steht.
2. Der Spieler klickt „Verteidigung"; der Befehl wartet in der Sammlung, der Zustand sagt noch Garnison.
3. Er befiehlt einen Marsch und spult vor.

Bis T-M40-19 fragte `garrisonFollowUp` nur den Zustand, und der nächste Tick wandte [Verteidigung, Marsch] an.
Die Armee marschierte auf Verteidigung, und Szenario R1 war wieder offen. Rot vorgeführt: „expected
[ 'Verteidigung' ] to deeply equal [ 'Garnison' ]". Jetzt liest der Folgebefehl die zuletzt gesammelte
`SET_STANCE` derselben Armee (`ActionContext.pending`), und die Armee steht nach dem Tick auf Garnison.

**N-4, Randlage, nicht gebaut.** „Angenommen" heißt: die Vorprüfung beim Klick nimmt den Befehl an. Gemeint ist
`send` in `App.tsx`, also `canApply` gegen den angewandten Zustand — nicht der Kern. Die Befehle warten in der
Sammlung, und der Kern wendet sie im nächsten Tick an. Einen abgelehnten Befehl lehnt er ab, ohne den nächsten
aufzuhalten (`phases/applyCommands.ts` im Kern).
- **Szenario:** Ein Marsch wird während des Vorspulens befohlen und wartet (T-M41-13). Die Automatik verlegt
  dieselbe Armee genau dorthin. Im Tick lehnt der Kern `MOVE_ARMY` mit „bereits dort" ab, `SET_STANCE garrison`
  wird trotzdem angewandt.
- **Folge, mild:** Die Armee steht dort, wohin der Spieler sie schicken wollte, auf Garnison — so wie nach dem
  Marsch.
- **Umgekehrt nicht erreichbar:** `SET_STANCE` prüft nur Armee, Besitzer und Wert.
- **Warum nicht gebaut:** Den zweiten Befehl an den Ausgang des ersten zu binden, wäre eine neue Regel des Kerns
  (Befehlsgruppen). D30.7 sagt jetzt wörtlich „wenn die Vorprüfung ihn annimmt".

**Gesehen, nicht gebaut: „schon in dieser Haltung" sieht die Sammlung nicht.** `armyActions` sperrt den Knopf
der Haltung, die der Zustand trägt (`army.stance === value`, Text `army.alreadyStance`). Nach einem gesammelten Klick auf „Verteidigung" bleibt
„Garnison" bis zum nächsten Tick gesperrt, und „Verteidigung" trägt die Quittung und ist ebenfalls gesperrt. Der
Spieler kann den Klick also vor dem Tick nicht zurücknehmen. Kein Befehl geht falsch; es kostet einen Klick
nach dem Tick. Die Reparatur läge in `actions.ts` und verlangt eine Entscheidung, was der gesperrte Knopf dann
sagt (ein Text in `de.ts`).

**Status:** N-5 behoben (T-M40-19). N-4 und die Sperre offen, ohne Aufgabe.

## 2026-09-14 · Sichtprüfung §3.5, Punkt 1 · Die Uhr hält Tempo 100 im gebauten Bündel, im Dev-Server verliert sie ein Drittel

**Befund.** Am Dev-Server (`pnpm --filter @worldwar/desktop dev`, Port 5174, Brave 1584×911, Weltkarte,
Startzahl 20260914) läuft die Uhr bei Tempo 100 **nicht** mit 100 Spielstunden je Sekunde. Drei Läufe über
zehn Sekunden Echtzeit, je zwei abgelesene Uhrzeiten und `performance.now()` dazwischen:

| Lauf | von | bis | Echtzeit | Ticks | Ticks/s |
|---|---|---|---|---|---|
| 1 | Tag 4 · 11:00 | Tag 31 · 19:00 | 10,029 s | 656 | 65,4 |
| 2 (8 s) | Tag 67 · 20:00 | Tag 87 · 01:00 | 8,085 s | 461 | 57,0 |
| 3 | Tag 5 · 02:00 | Tag 24 · 19:00 | 10,009 s | 473 | 47,3 |

Dieselbe Messung **am gebauten Bündel** (`vite build` + `vite preview`, Port 5175, gleiche Karte, gleiche
Startzahl, dasselbe Fenster): **Tag 44 · 10:00 → Tag 84 · 15:00 in 10,011 s = 965 Ticks = 96,4 Ticks/s**,
also 40,2 Spieltage in zehn Sekunden. Die Zusage aus T-M41-04 hält dort. Gegenprobe auf der Kleinen Welt
(12 Provinzen) am Dev-Server: **999 Ticks in 10,02 s = 99,7 Ticks/s** — die Uhrformel ist nicht der Engpass.

**Wo die Ticks bleiben (gemessen, nicht vermutet).** `requestAnimationFrame` wurde umhüllt, um die Bildzeiten
zu sehen, die die Spielschleife selbst misst, und `clockStep` aus `game/clock.ts` wurde über genau diese
Bildzeiten nachgerechnet. Dazu zählte ein `MutationObserver` auf `.clock__time` die React-Commits:

- Lauf am Dev-Server: **127 Bilder der Spielschleife, `clockStep` verlangt 635 Ticks, die Uhr rückte 325 vor.**
  **65 Commits** — also etwa jedes zweite Bild —, und **jeder Commit sprang genau 5 Ticks**, die Kappe
  `clockCap(100) = 5`. Die anderen Bilder rechneten ihre fünf Ticks und warfen sie weg.
- Lauf am gebauten Bündel: 343 Bilder, `clockStep` verlangt 987, die Uhr rückte 965 vor — deckungsgleich.

**Ursache, gelesen:** `step` in `App.tsx` rechnet aus `stateRef.current`, und `stateRef.current = state` steht
im Render. `setState(result.state)` ist die **Wertform**, kein Updater. Kommt ein Bild, bevor React das
vorige Ergebnis eingespielt hat, rechnet es noch einmal vom selben Stand — und überschreibt das vorige.
Im Dev-Bau ist ein Commit teuer (React-Entwicklungsbau, `StrictMode` rendert doppelt), deshalb passiert das
dort etwa bei jedem zweiten Bild und im ausgelieferten Bau praktisch nie.

**Kleinster reproduzierbarer Fall:** Dev-Server, Weltkarte, Tempo 100, zehn Sekunden — die Uhr rückt rund
20 statt 41 Spieltage vor. Dieselbe Partie im `vite preview`-Bündel: 40 Spieltage.

**Nicht gebaut (Sichtprüfung ändert keinen Produktivcode).** Zwei Dinge, die daraus folgen:
1. **Die Zusage T-M41-04 ist am ausgelieferten Programm erfüllt** — Tauri lädt dasselbe Bündel wie
   `vite preview`. Der Dev-Server ist die falsche Messstelle für die Uhr.
2. Ob die Wertform von `setState` auch im ausgelieferten Bau unter Last (späte Partie, viele Armeen)
   Ticks verliert, ist offen. Im Dev-Bau tut sie es messbar; ein Updater
   (`setState((s) => advance(s, …))`) oder ein Ref, das der Schritt selbst fortschreibt, wäre die
   Reparatur — sie gehört in eine eigene Aufgabe mit eigenem Rücknahmekriterium.

**Behoben am 2026-09-14 (T-M41-17).** `commitState(next)` schreibt den Spiegel `stateRef.current` **und**
den Zustand; `step`, das Vorspul-Häppchen, Laden, neue Partie und das Leeren gehen darüber. Die Updaterform
ist bewusst nicht gewählt — dieses Haus hat die Rechnung zweimal absichtlich aus dem Updater geholt
(T-M22-05 und der Befund vom 2026-09-08 im Vorspulen), und an derselben Rechnung hängen `noteTrace`,
`noteMarches` und die eingesammelten Befehle. Eigener Ausgangswert desselben Tages, gleiches Verfahren
(Brave über CDP, Fenster vorn, Weltkarte, Vereinigte Staaten, Startzahl 20260914, Tempo 100, je zehn
Sekunden, frische Partie je Lauf): **Dev-Server 61,7 / 62,6 / 57,9 Ticks/s → 99,6 / 99,6 / 99,7**;
**gebautes Bündel über fünf Läufe 93,0–98,4 (Minimum 93,0, Median 95,8) → 99,8–100,0 (Minimum 99,8,
Median 99,9)**. Der Regressionstest steht in `App.test.tsx` („addiert zwei Bilder desselben JS-Zugs auf")
und ist ohne die Reparatur rot: Tag 1 · 05:00 statt Tag 1 · 10:00.

**Status:** behoben (T-M41-17). **Die Lehre bleibt: die Uhr wird am gebauten Bündel gemessen, nicht am
Dev-Server** — der Dev-Bau hat dieselbe Schwäche nur früher sichtbar gemacht, und das Bündel misst, was
ausgeliefert wird.

---

## 2026-09-14 · Sichtprüfung §3.5, Punkt 2 · Die Tempo-Sperre im Vorspulen lässt sich am Bildschirm nicht sehen

**Befund.** T-M41-13 sperrt die Tempostufen während eines Vorspul-Laufs (`disabled`, Tooltip „Während des
Vorspulens gesperrt — erst abbrechen oder abwarten"). Am laufenden Spiel ist dieser Zustand **nie sichtbar**:
beide Auslöser — der Knopf (`App.tsx` Z. 1538) und die Taste F (Z. 955) — rufen
`fastForwardRun({ kind: 'days', days: 1 })`, das sind 24 Ticks, und `DEFAULT_CHUNK_TICKS` ist ebenfalls 24.
Der Lauf ist also **genau ein Häppchen** und endet synchron im Klick; `setFastForward({ running: true })` und
`setFastForward({ running: false })` liegen im selben JS-Zug, React spielt nur den zweiten ein.

**Gemessen (Brave, Dev-Server, Weltkarte, Tag 7 · 18:00):** Der Klick auf „Vorspulen" dauerte **31 ms**
(an Tag 79 in derselben Partie 206 ms). Ein `MutationObserver` auf `.speeds` zählte über drei Sekunden
**0 Mutationen**; ein Abtaster auf jedem Bild sah in **429 Abtastungen keinen einzigen gesperrten
Tempoknopf**. Vor dem Klick, unmittelbar nach dem Klick (noch im selben Zug) und drei Sekunden später ist
jeder Knopf frei und trägt seinen normalen Tooltip („100 Stunden je Sekunde").

**Das ist kein neuer Fehler.** T-M41-13 hat es selbst notiert („heute nicht herstellbar"); der Test
verkleinert die Häppchen per Hülle auf 4 Ticks. Neu ist nur, dass es jetzt **am laufenden Spiel gemessen**
ist: die Zusage ist im Browser nicht prüfbar, und die Sichtprüfung führt Punkt 2 deshalb als
**nicht geprüft**, nicht als erfüllt.

**Was es prüfbar machen würde:** ein Vorspulziel über einen Spieltag hinaus (dann läuft der zweite
Häppchen-Aufruf über `setTimeout`, und der gesperrte Zustand wird eingespielt) — oder ein Häppchen, das
kleiner ist als ein Spieltag.

**Status:** offen, ohne Aufgabe; die Zusage bleibt durch `App.test.tsx` gedeckt.

---

## 2026-09-14 · Abnahmeskript · Die AK-9-Zeile traegt die Beschreibung von AK-8

**Befund.** `scripts/acceptance.mjs` schreibt die Zeilen der Kriterien ausserhalb der V1 mit einem
fest verdrahteten Text:

```js
...spaetere.map((c) => `| ${c.id} | Verpackung als Programm (T-M16-05) | ${spaetereZeile(c)} |`)
```

`spaetere` ist `CRITERIA.filter((c) => c.scope !== 'V1')` und enthaelt seit dem 2026-09-12 **zwei**
Eintraege: AK-8 (M16, Verpackung) und AK-9 (M39, die Partie zu zweit). Beide bekommen denselben Satz.
In `docs/reports/acceptance.md` steht darum in der AK-9-Zeile „Verpackung als Programm (T-M16-05)",
obwohl AK-9 nach `01-REQUIREMENTS.md` Abschnitt 3.2 die Zweispieler-Abnahme ist: „Noah und ein zweiter
Mensch in einem anderen Netz spielen eine Partie zu zweit". Der Bericht sagt an dieser Stelle etwas
Falsches ueber das Projekt — dieselbe Fehlerklasse wie eine Zusage ohne Ort, nur eine Ebene weiter:
eine Zusage mit **fremdem** Ort.

Gefunden beim Abnahmelauf vom 2026-09-13 (`UEBERGABE.md` §4a), zuerst ohne Heimat in `PROBLEME.md`
notiert; die unabhaengige Verifikation vom 2026-09-14 hat genau das als Befund M-1 gemeldet („der
Befund hat keinen Besitzer").

**Warum es kein gefallenes Kriterium ist.** AK-9 zaehlt mit `scope: 'M39'` nicht gegen die V1, und der
Zustandsteil der Zeile (`spaetereZeile`) ist richtig: „⏸ M39, noch nicht gemessen, zaehlt nicht gegen
V1". Falsch ist nur die Beschreibung.

**Reparatur (T-M41-18).** Die Beschreibung wandert als Feld `description` zu den Eintraegen in
`scripts/acceptance-criteria.mjs` — dorthin, wo `scope` und `report` schon stehen —, und
`acceptance.mjs` druckt `c.description`. Damit kann ein spaeteres Kriterium nicht mehr die
Beschreibung seines Vorgaengers erben.

**Status:** behoben (T-M41-18, 2026-09-14). Der eingecheckte `docs/reports/acceptance.md` traegt den
alten Satz noch, bis der naechste `pnpm acceptance` ihn neu schreibt — der Bericht gilt ohnehin nur
fuer den Stand, gegen den er gemessen wurde.

---

## 2026-09-14 · Abnahmeskript · Die gedruckte Gesamtdauer wird gerundet statt abgerundet

**Befund.** `scripts/acceptance.mjs` schloss mit

```js
console.log(`
${passed} von ${results.length} Pruefungen bestanden — Gesamtdauer ${Math.round(totalSeconds / 60)} min ${totalSeconds % 60} s.`)
```

`Math.round` auf den Minuten, `%` auf den Sekunden: bei `totalSeconds` 298 druckt die Konsole
**„5 min 58 s"** statt 4 min 58 s. Der Fehler tritt fuer jede Dauer ab 30 Sekunden Rest auf und macht
den Lauf um bis zu 59 Sekunden aelter oder juenger, als er war. Gemessen am Abnahmelauf vom
2026-09-13: `docs/reports/acceptance-timing.json` haelt `totalSeconds: 298` fest — die **JSON-Zahl war
immer richtig**, nur die Konsolenzeile war es nicht.

Der Befund ist klein und trotzdem eingetragen, weil diese Zahl in Uebergaben und Berichte abgeschrieben
wird: `UEBERGABE.md` §1a nennt die Wanduhr 4 min 58 s aus der JSON, andere Stellen haetten die
Konsolenzeile uebernommen.

**Reparatur (T-M41-18).** `durationText(totalSeconds)` in `scripts/acceptance-criteria.mjs`, mit
`Math.floor`; `acceptance.mjs` ruft sie. Eine reine Funktion statt einer Rechnung im Konsolenaufruf —
sonst gibt es nichts zu pruefen.

**Status:** behoben (T-M41-18, 2026-09-14).

## 2026-09-14 · Abnahme auf dem Endstand · AK-8 ist ueberholt, weil die Uhr-Reparatur nach der Verpackungsmessung kam

**Befund.** Der Abnahmelauf auf `03e4200` (2026-09-14, freie Maschine, Prozessorlast 2 %) meldet
**12 von 12, Exit 0, 4 min 56 s** — und stempelt AK-8 trotzdem mit ⚠. Der Grund ist ein anderer als
am Vortag: dort fehlte die Messung ganz („`docs/reports/packaging.md` nennt keinen Stand"), jetzt
gibt es sie, und sie ist **ueberholt**:

```
AK-8  ⚠ gemessen am 2026-09-14 gegen `2c52356` - seither 1 Datei(en) am Erzeugnis geaendert
```

Die eine Datei ist `apps/desktop/src/App.tsx`, geändert von `0f1fce1` („die Uhr schreibt ihren Stand
zurueck, bevor das naechste Bild rechnet"). Die Reihenfolge der Nacht sagt alles:

| Zeit | Commit | Was |
|---|---|---|
| 00:05 | `2c52356` | der Stand, gegen den gebaut und gemessen wurde |
| 00:41 | — | `worldwar.exe` gebaut, 6 780 416 Bytes |
| 00:49 | `1759386` | der AK-8-Bericht: sieben von sieben Schritten |
| 01:49 | `2a437b0` | Sichtprüfung im Browser |
| **02:21** | **`0f1fce1`** | **die Uhr-Reparatur — ausgeliefertes Gut** |

Das Programm, das die sieben Schritte bestanden hat, **enthält die Uhr-Reparatur nicht**. Der Wächter
hat recht, und der Stempel hat recht.

**Was der Befund nicht ist.** Keine maschinelle Prüfung ist gerissen: 12 von 12, Exit 0. AK-8 gehört
zu M16 und zählt nicht gegen V1; die Zeile trägt den Vermerk selbst. Und die Simulation ist unberührt —
`docs/reports/fullgame.json` unterscheidet sich gegen den Vorlauf **nur in `measuredAt`**, Siegtag 975,
2589 Eroberungen, 11 Kriegserklärungen unverändert. Die Uhr-Reparatur hat wirklich nur die Oberfläche
angefasst, genau wie ihr Commit sagt.

**Was in der Doku jetzt zu weit geht.** Der Kopf von `WORKFLOW.md`, dort §1 und §5, dazu `CLAUDE.md`
und `UEBERGABE.md` sagen „AK-8 ist seit dem 2026-09-14 erfüllt" — ohne den Zusatz **„auf dem Stand vor
der Uhr-Reparatur"**. Gemessen ist AK-8 gegen `2c52356`, nicht gegen den Endstand.

**Was es kostet, den Stempel gruen zu bekommen** (hier bewusst nicht getan — dieser Lauf misst, er
repariert nicht): `pnpm tauri:build` auf dem Endstand, am Vortag 2 min 19 s, danach
`node docs/plan/schlussblock/ak8-cdp.mjs <exe> <ausgabe>`, am Vortag 8 Sekunden. Beides braucht ein
**sichtbares** Fenster (§4 Falle 17) und geht in einer Hintergrund-Sitzung nicht.

**Die Lehre.** Eine Messung am gebauten Programm hält genau so lange, wie niemand `apps/`, `packages/`
oder `data/` anfasst — das ist die Positivliste `LIEFERT` in `artefactUnchangedSince`
(`scripts/acceptance-criteria.mjs`). **Wer AK-8 misst, misst es zuletzt**, nach der letzten Zeile
ausgelieferten Codes; am 2026-09-14 lag zwischen Messung und Blockende noch eine Reparatur, und genau
dafür ist der Wächter gebaut. Gegengeprüft wurde auch die andere Richtung: das seither ebenfalls
geänderte `index.html` im Wurzelverzeichnis ist die Projektübersichtsseite, nicht der App-Einstieg
(das ist `apps/desktop/index.html`), und geht nicht ins Erzeugnis — die Positivliste uebersieht hier
nichts.

**Erledigt am 2026-09-14, 03:22–04:42.** Genau der Weg oben wurde gegangen, nichts abgekuerzt:
`pnpm tauri:build` auf dem Endstand `1c64a6e` (fertig 03:22:44, Rust `release` in 1 min 51 s),
danach `ak8-cdp.mjs` (Lauf endet 03:24:36, **sieben von sieben Schritten**, `AK-8 ERFÜLLT`).
Die neue exe ist **auf das Byte genau so gross** wie die vom 00:41 — 6 780 416 B beide Male —, und
eine gleiche Dateigroesse ist kein Beleg. Deshalb eine Gegenprobe **am laufenden Programm**: exe mit
`--remote-debugging-port=9222` gestartet, Weltkarte, Tempo 100, drei Mal zehn Sekunden Echtzeit
gemessen — **99,85–99,98 Ticks/s**. Vor der Reparatur lag dieselbe Messung bei 92,98–98,40, nach ihr
bei 99,77–99,95. Die Reparatur steckt im ausgelieferten Programm. Noahs Spielstaende blieben
unberuehrt (SHA-256 vor und nach der Gegenprobe gleich). Belege: `docs/reports/packaging.md`.

**Status:** behoben (2026-09-14). Kein Kriterium gerissen; AK-8 war gegen `1c64a6e` gemessen — und
**dieselbe Lehre traf am selben Tag ein zweites Mal zu**: M37, M38 und M39 haben `apps/` erneut
angefasst, der Wächter stellte AK-8 wieder auf ⚠ („seither 32 Datei(en) am Erzeugnis geändert“),
und die Antwort war wieder neu bauen (18:40:02, `e82c2bc`) und neu messen (18:40:53, sieben von
sieben Schritten). Belege: `docs/reports/packaging.md`.

---

## 2026-09-14 · T-M37-07 / T-M37-08 · Befund M37-1: Die Sortierung war seit M1 schon da

**Befund:** `03-TASKS.md` verlangt fuer T-M37-08 eine Gegenprobe in dieser Form — *„der Test
ohne Befehle **faellt**, wenn man die Sortierung aus T-M37-07 entfernt"*. Sie faellt nicht,
und sie kann nicht fallen: `packages/core/src/phases/applyCommands.ts` sortiert die Befehle
eines Ticks **selbst** nach `state.playerOrder`, und zwar seit `75071b2` (M1, 2026-09-03).
Nimmt man `orderCommands` aus dem Gleichschritt heraus, sortiert der Kern im naechsten
Atemzug dasselbe Ergebnis — die Zusage aus D28.5 war ueber Machtgrenzen hinweg eingeloest,
bevor der Mehrspieler geplant wurde.

**Kleinster reproduzierbarer Fall:** dieselbe Lage, zwei Teilungen (`SPLIT_ARMY`) von zwei
verschiedenen Maechten, einmal als `[p1, p2]` und einmal als `[p2, p1]` an
`advanceTicks(..., { scripted })` gereicht. Beide Male dieselbe Pruefsumme, obwohl
`nextIds.army` ein Zaehler ist, den sich alle Maechte teilen. Steht als Test in
`packages/netplay/test/twoclients.test.ts`.

**Was daraus folgt — und was nicht.** `orderCommands` ist damit nicht ueberfluessig, aber
seine Zusage zeigt in die **andere Richtung**, und die ist scharf: innerhalb einer Macht
bleibt die eigene Folge erhalten, und sie darf unter keinen Umstaenden „aufgeraeumt" werden
(nach Armeekennung, nach Befehlsart). Zwei Teilungen **derselben** Macht in vertauschter
Folge ergeben zwei verschiedene Welten — das ist gemessen, nicht vermutet, und es ist der
Fehler, den ein gut gemeinter Aufraeumer einbauen wuerde. Zweitens haengt der Gleichschritt
so nicht an einer Umsetzungseinzelheit des Kerns: stuende die Sortierung dort eines Tages
nicht mehr, traegt ihn `orderCommands` weiter.

**Was geaendert wurde:** die Zeile „Fertig wenn" von T-M37-08 nennt den Befund und die
Gegenprobe, die wirklich greift. Die Zusage wurde nicht gestrichen, sondern berichtigt —
der Beleg des Meilensteins (zwei Simulationen, 200 Ticks, eine Pruefsumme) steht unberuehrt.

**Status:** geschlossen (2026-09-14). Kein Kern angefasst, keine Anforderung betroffen.

---

## 2026-09-14 · Vor dem Bau von M38 gelesen · Befund M38-1: Falle 11 nennt die Nummern vertauscht

**Befund:** `MEHRSPIELER.md` §4 Falle 11 sagte bis heute: *„Er wird in T-M38-09 umgebaut, bevor
T-M38-04 den Transport schreibt."* `WORKFLOW.md` §2 sagt dieselbe Sache mit den anderen Nummern:
*„T-M38-04 kommt vor T-M38-06."* Eine der beiden Dateien musste falsch sein, und eine Falle, die
falsche Adressen nennt, kostet genau die Sitzung, die sie sparen soll.

**Nachgeprueft an der einzigen Stelle, die nicht Prosa ist** — den Titeln in `tasks.yaml`:

| Aufgabe | Titel | Was sie tut |
|---|---|---|
| T-M38-04 | Der Netz-Waechter bekommt seine Grenze | der Waechter |
| T-M38-06 | Der WebSocket-Transport im Browser | der erste `new WebSocket` |
| T-M38-09 | Die Anzeige sagt, wenn es am anderen haengt | die Kopfleiste |

Damit ist **`WORKFLOW.md` §2 richtig** und Falle 11 falsch. Zwei weitere Stellen bestaetigen es
unabhaengig: `tasks.yaml` fuehrt bei T-M38-06 die Abhaengigkeit `T-M38-04`, und der Kopf des
Abschnitts M38 in `03-TASKS.md` sagt die Regel ohne Nummern („der Netz-Wächter wird umgebaut, bevor
der erste `new WebSocket` entsteht") — also in derselben Richtung.

**Die Ursache, und sie erklaert mehr als eine Zeile.** Die alten Nummern sind kein Zahlendreher,
sondern eine **frühere Zählung**: T-M38-04 und T-M38-05 (Wächter und Verpackung) sind beim Planen
nachträglich nach vorn gezogen worden, und alles dahinter rutschte um zwei. Wer das weiß, findet
dieselbe alte Zählung sofort ein zweites Mal — im scope-Block von `01-REQUIREMENTS.md`:

| ID | stand dort | richtig |
|---|---|---|
| R-MP-07 | T-M38-06 | T-M38-08, T-M38-09 |
| R-MP-08 | T-M38-08 | T-M38-10 |
| R-MP-09 | T-M38-09 | T-M38-04, T-M38-05 |

Die drei Zeilen waren maschinell nicht auffindbar: `checkScope` prueft den **Meilenstein** vor dem
Geviertstrich und die Begruendung dahinter, nicht die Aufgabennummer in der Begruendung. Sie ist
Fliesstext in einem Feld, das wie Daten aussieht.

**Was geaendert wurde:** Falle 11 nennt jetzt T-M38-04 und T-M38-06 und traegt einen Absatz, der
die alte Fassung zitiert statt sie zu loeschen; die drei scope-Zeilen sind berichtigt und tragen
einen Kommentar, der auf diesen Befund zeigt. Keine Anforderung, kein Kriterium und keine Aufgabe
hat sich dabei geaendert — `plan-consistency` 36/36, `coverage:requirements` `V1 offen: 0`, beides
vor und nach der Aenderung.

**Die Lehre.** Eine Nummer in Prosa altert, sobald der Plan umgestellt wird, und kein Waechter
sieht es. Wo eine Falle eine Aufgabe meint, gehoert **ihr Titel** daneben — an einem Titel faellt
die Verwechslung beim Lesen auf, an einer Nummer nie.

**Status:** behoben (2026-09-14).

---

## 2026-09-14 · T-M38-07 · Befund M38-2: Ein hochgestufter Sockel meldet `end`, aber nie `close`

**Befund:** Der Hostdienst gab einen Platz nicht wieder frei, wenn ein Gast seine Verbindung
einfach wegwarf. Der zweite Gast fand danach einen **vollen Raum, in dem niemand sass** — und die
Partie liess sich nicht neu beginnen, ohne den Dienst neu zu starten.

**Gemessen** (eigener Probelauf mit `node:http` und `node:net`, ohne den Dienst): ein Sockel, den
`server.on('upgrade', …)` herausreicht, feuert nach dem Wegwerfen der Gegenseite

```
end   nach  65 ms
close nie
```

Der Grund ist kein Fehler, sondern der Entwurf von Node: nach dem Hochstufen ist die HTTP-Schicht
nicht mehr zustaendig und reicht den Sockel **halb offen** heraus. Die Leseseite ist zu, die
Schreibseite bleibt stehen, bis jemand sie schliesst — und genau das tut niemand, wenn der Dienst
nur auf `close` hoert.

**Was daran gefaehrlich ist:** der Fehler sieht aus wie ein Fehler des Gastes. Der Raum ist voll,
die Meldung lautet „Dieser Raum ist voll", und sie stimmt sogar — nur ist der Grund ein Sockel, der
seit zehn Minuten niemandem mehr gehoert.

**Was geaendert wurde:** der Dienst hoert auf `end` **und** `close` **und** `error`, und `abgang`
schliesst den Sockel selbst (`socket.destroy()`), statt auf ein Ereignis zu warten, das nicht kommt.
Eine eigene Zusicherung misst es am **Ergebnis** und nicht am Ereignis: ein dritter Gast bekommt den
Platz des ersten. **Gegenprobe gefahren:** das `end`-Ohr herausgenommen, zwei Zusicherungen fallen.

**Die Lehre.** Wer einen Sockel aus `upgrade` uebernimmt, uebernimmt auch seine Lebensdauer. Und
allgemeiner: eine Aufraeumfunktion, die an **einem** Ereignis haengt, ist eine Wette darauf, dass
dieses Ereignis kommt — belegen laesst sie sich nur an der Wirkung, hier am freien Platz.

**Status:** behoben (2026-09-14).

---

## 2026-09-14 · T-M38-03 · Befund M38-3: Die Determinismus-Probe sieht keine Gefechtskonstante

**Befund:** Kein Fehler, sondern eine **Grenze der Zusage** — und sie gehoert aufgeschrieben, weil
die Probe sonst mehr verspricht, als sie halten kann. Gemessen am 2026-09-14 auf der ausgelieferten
Weltkarte (sechs Maechte, Startzahl 1914): ab wie vielen Probeticks eine geaenderte Regelzahl die
Pruefsumme verschiebt.

| Geaenderte Konstante | sichtbar ab Tick |
|---|---|
| `startMorale` | **0** (schon im Startzustand) |
| `moraleDriftDivisor` | **24** |
| `baseTargetMorale` | **24** |
| `foodSurplusBonus` | **24** |
| `ownNeighborBonus` | **24** |
| `regenPermillePerTick` | **48** |
| `battleRate` | auch nach 48 **nicht** |
| `minDamage` | auch nach 48 **nicht** |

**Zwei Dinge folgen daraus, und beide stehen jetzt im Test.**

Erstens: **24 ist die kleinste Zahl, die ueberhaupt etwas sieht** ausser dem Startzustand. Vier der
gemessenen Konstanten haengen an der Tagesrechnung und werden genau bei Tick 24 sichtbar; bei 12 ist
die Probe fuer alle vier blind. `PROBE_TICKS` ist damit ein Stellknopf, der **nach oben** geht —
wer ihn zum Sparen nach unten dreht, dreht die Probe ab. Eine eigene Zusicherung haelt das fest
(12 gleich, 24 verschieden).

Zweitens: die Probe kann **nicht** sagen, dass zwei Maschinen bitgleich rechnen. In den ersten zwei
Spieltagen findet kein Gefecht statt, also beruehrt der Lauf die Gefechtskonstanten nie. Sie ist ein
**billiger frueher Widerleger** und kein Beweis — und das ist genau die Rolle, die D28.6 ihr gibt
(„die Antwort ist mit hoher Wahrscheinlichkeit ja … aber das ist keine Grundlage fuer einen Abend zu
zweit"). Was danach wirklich alles sieht, ist die Pruefsumme in **jeder** Befehlsnachricht
(T-M37-09): sie vergleicht den ganzen Zustand nach jedem Tick, Gefechte eingeschlossen.

**Was geaendert wurde:** eine Zusicherung, die den gemessenen **Negativfall** festhaelt
(`battleRate` und `minDamage` aendern nach 24 Ticks nichts) — damit der naechste Leser nicht
annimmt, die Probe decke alles ab. Die Zeile „Fertig wenn" von T-M38-03 nennt die Zahlen.

**Status:** geschlossen (2026-09-14). Keine Anforderung betroffen, kein Kern angefasst; die
Regelaenderungen leben als Patch im Test, `data/rules` ist unberuehrt.

---

## 2026-09-14 · Beim Bau von M38 gefunden · Befund M38-4: `productionFiles()` liest `.test.tsx` mit

**Befund:** `test/guards/scan.ts` sagt ueber `productionFiles()`: *„Product source only — plan
documents, tests and fixtures are explicitly out of scope."* Der Filter dahinter lautet
`!f.endsWith('.test.ts')` — und laesst damit **`.test.tsx` durch**. Gemessen am 2026-09-14: von
**193** Dateien, die `productionFiles()` liefert, sind **21** `.test.tsx`.

Betroffen ist jeder Waechter, der `productionFiles()` benutzt: der Netz-Waechter, die
Farbliteral-Regel, der Steuerzeichen-Waechter, die Schluesselpruefung und weitere. Sie sind dadurch
**strenger**, als ihr Kopf behauptet — keiner von ihnen ist heute rot, aber die Beschreibung stimmt
nicht mit dem Verhalten ueberein, und das ist die Sorte Abweichung, die beim naechsten Mal Zeit
kostet: wer einen Treffer in einer `.tsx`-Testdatei sieht, sucht ihn zuerst im Produktcode.

**Nicht repariert, und warum.** Die Aenderung waere eine Zeile, aber ihre Reichweite sind zwoelf
Waechter. Zwei davon zaehlen, was sie gelesen haben, und beide Zahlen wurden nachgemessen, bevor
diese Entscheidung fiel: die Schluesselpruefung faende 315 statt 317 `t()`-Schluessel (Grenze 50),
die Schleifenpruefung 160 statt 181 Dateien (Grenze 50) — es waere also nichts gerissen. Trotzdem
gilt fuer M38 die Regel des Zuschnitts: **dieser Meilenstein weitet keine bestehende Pruefung aus
und engt keine ein.** Der Befund gehoert nach M18.

**Was es fuer heute heisst:** wer in `apps/desktop` eine `.test.tsx` schreibt, die ein verbotenes
Muster nennt, braucht dieselbe Notbremse wie der Produktcode — `GUARD-ALLOW` in der Zeile. Genau so
steht es in `websocketTransport.test.ts`, wo die Regel gegen `crypto.randomUUID` ihre eigene
Gegenprobe braucht.

**Status:** erledigt (2026-09-18, T-M38-11). Der Filter heißt jetzt `isTestFile()` und
erkennt beide Endungen in **einem** Ausdruck (`/\.test\.[cm]?[jt]sx?$/`), damit die
nächste nicht wieder eine eigene Zeile braucht. **Unabhängig nachgemessen am 2026-09-18**
(eigener Verzeichnislauf, beide Filter über denselben Baum):
`productionFiles()` liefert **205 → 183** Dateien, herausgeschnitten werden **22**, und
alle 22 sind `.test.tsx` unter `apps/desktop` — keine einzige Produktdatei fällt weg
(Gegenprobe: alle 23 echten `.tsx` und alle echten `.ts` sind weiterhin dabei). Die zwei
Zahlen, die der alte Eintrag nannte, sind mitgewachsen und stimmen in der Richtung:
`t()`-Schlüssel **350 → 348** (Grenze 50), Schleifenprüfung **192 → 170** (Grenze 50). Die
beiden verlorenen Schlüssel sind `tutorial.steps.dayPassed.text` und
`tutorial.steps.select.text` — der Produktcode fragt sie zusammengesetzt ab
(`Tutorial.tsx`), und `tutorial.test.ts` prüft für **jeden** Schritt alle drei Schlüssel;
es geht also nichts verloren.
**Was schmaler wird, und zwar dem Buchstaben nach:** der Steuerzeichen-Wächter (C-08) las
die 22 Dateien bisher mit — zufällig, denn die rund 200 `.test.ts` hat er nie gelesen; und
die Schlüsselprüfung sieht `t()`-Aufrufe in `.test.tsx` nicht mehr. In den 22 Dateien steht
heute kein Steuerzeichen, keine `implements StoragePort`, kein `runAi`+`runTicks`, kein
`assignments` und kein Treffer eines `scan()`-Musters (alles nachgemessen) — **kein Urteil
ändert sich**. `ai-memory-unread.test.ts` filterte `.test.tsx` schon vorher selbst heraus;
diese Zeile ist jetzt überflüssig und bleibt als Gürtel neben den Hosenträgern stehen.
**Gezählt statt übernommen (Nacharbeit vom 2026-09-24):** neun Wächterdateien bekamen die
Liste vor `c0d20b4` geliefert — **sechs direkt** (`ai-memory-unread`,
`no-control-characters`, `no-network`, `persistence-contract`, `single-loop`, `text-keys`)
und **drei über den Standardparameter von `scan()`**, die im Bericht vom 2026-09-18
fehlten: `no-foreign-assets` (zwei Muster), `no-monetization`, `no-time-pressure`. Über
genau die 22 herausgeschnittenen Dateien nachgemessen, mit demselben Verzeichnislauf und
derselben `GUARD-ALLOW`-Ausnahme: Medien **0**, Vorbilder **0**, `CURRENCY_TERMS` **0**,
`WAIT_OR_PAY` **0**; gegengeprüft mit ripgrep über dieselben 22 Dateien, auch ohne die
Ausnahme **0**. Mit `scan.test.ts` lesen heute zehn Dateien die Liste. Die „zwölf" im Kopf
von `scan.test.ts` (aus dem Befundtext oben, nicht gezählt) und die „sieben" im Bericht vom
2026-09-18 sind berichtigt (`7b2f3df`).
Neu: `test/guards/scan.test.ts`. Seine Gegenliste kommt aus `git ls-files` und **nicht** aus
demselben Verzeichnislauf — ein Filter, der gegen sich selbst geprüft wird, ist immer
vollständig. Er hält auch den alten Filter als Gegenprobe fest.

---

## 2026-09-14 · T-M38-06 · Befund M38-5: Der Transport ist gebaut und absichtlich nicht verdrahtet

**Befund:** `apps/desktop/src/net/websocketTransport.ts` ist die einzige Stelle im Spiel, die
`new WebSocket` sagt — und **kein Pfad von `main.tsx` fuehrt dorthin**. Der Erreichbarkeits-Waechter
(T-M13-04) hat das sofort gemeldet, und er hat recht: „gebaut, getestet, nie verdrahtet" ist genau
die Fehlerklasse, fuer die er existiert (Symbole, Ton, Einstiegshilfe — dreimal in diesem Projekt).

**Warum es hier trotzdem richtig ist.** Die Leitung wird vom **Beitrittsbildschirm** gebaut, und der
ist T-M39-02/T-M39-03. In M38 gibt es keinen Weg, auf dem ein Mensch eine Verbindung anfordert; den
Transport trotzdem irgendwo anzustoepseln hiesse, M39 vorwegzunehmen. Und die Unerreichbarkeit ist
in M38 keine Luecke, sondern eine **gemessene Zusage**: `docs/reports/packaging-netfree.json` haelt
fest, dass im gebauten Buendel (2 Dateien, 1 650 291 Zeichen) **kein `WebSocket`** steht — das ist
die Haelfte von R-MP-09/AK3, und sie stimmt nur, weil niemand die Datei erreicht.

**Was geaendert wurde:** ein Eintrag in `REACHABILITY_EXCEPTIONS` mit Begruendung, und die
Begruendung nennt ihr eigenes Ablaufdatum: *„Diese Ausnahme ist eine Zusage auf Zeit und gehoert in
T-M39-03 wieder heraus."*

**Was in M39 zu tun ist, und es ist eine Warnung:** sobald der Beitrittsbildschirm den Transport
erreicht, steht er im Tauri-Buendel, und die Zeile „kein WebSocket im Buendel" wird **falsch**. Sie
darf dann nicht stillschweigend umgeschrieben werden. Die Zusage, die traegt, ist die andere:
`connect-src 'none'` verbietet die Verbindung, **gleich wer sie versucht** — gemessen woertlich im
Erzeugnis. Wer M39 baut, ersetzt die Buendelzusicherung durch eine Zusicherung am Verhalten (der
Aufruf im Tauri-Bau scheitert) oder durch eine Bauflagge, die den Einstieg herausschneidet — aber
nicht durch Streichen.

**Status:** bewusst offen bis T-M39-03 (2026-09-14).

---

## 2026-09-14 · T-M39-02 · Befund M39-1: Die Reihenfolge im Bauplan widerspricht dem Bauplan

**Befund:** `MEHRSPIELER.md` §3.2 führt `hallo` als **erste** Nachrichtenart auf (Gast zum
Host: „wer da ist und was er spielen möchte"), §3.7 verlangt für denselben Ablauf: „Der
Beitrittsbildschirm zeigt, worauf man sich einlässt, **bevor irgendetwas passiert** …
**Dann** Name eintragen und beitreten." Beides zusammen geht nicht: die Bedingungen kennt
nur der Host, also muss er sie geschickt haben, bevor der Gast seinen Namen nennt — und
`willkommen` ist die Antwort auf `hallo`.

**Warum das kein Zahlendreher ist.** Der Widerspruch entsteht erst beim Bauen, weil §3.2
eine *Liste von Arten* ist und keine Ablaufbeschreibung. Wer sie als Ablauf liest, baut
einen Beitrittsbildschirm, der nach dem Namen fragt und die Bedingungen danach zeigt — und
verletzt R-MP-12/AK1 („bevor irgendetwas beginnt"), ohne dass ein Test es sieht: alle sechs
Angaben stünden ja da.

**Wie es gebaut ist.** `hallo` kommt zweimal, und beide Male trägt es seine Aufgabe:

```
Gast verbindet          -> hallo (ohne Namen)   die Anmeldung; sie traegt die Fassung
Host antwortet          -> willkommen           Karte, Nationen, Rate, Siegbedingung
Gast liest, traegt ein  -> hallo (mit Namen)    jetzt sieht der Host, wer wartet
Host startet            -> probe                der Determinismus-Handschlag
Gast antwortet          -> probe                beide vergleichen, dann laeuft es
```

Damit steht §3.2 weiter: die Anmeldung ist die erste Art, und sie trägt die
Protokollfassung — verschiedene Fassungen reden nicht miteinander (R-MP-06/AK1). Und §3.7
steht auch: die Bedingungen kommen vor dem Namen.

**Die verworfene Alternative** war, die Einladung im **Hostdienst** abzulegen, damit der
Gast sie per HTTP holen kann, bevor er die Leitung baut. Dann wäre der Dienst nicht mehr
Briefträger, sondern hielte Partiedaten — genau die dritte Meinung darüber, was gerade
gilt, die D28.2 ausschließt. Und das Geheimnis müsste für die Abfrage an den Server, also
in eine Anfragezeile; es steht nicht ohne Grund hinter dem Rautezeichen.

**Nebenwirkung, die zur Auskunft wurde:** der Gastgeber sieht zwischen den beiden `hallo`
einen Gast **ohne Namen**. Das ist keine Lücke, sondern die genauere Auskunft — „jemand hat
den Link geöffnet und trägt gerade seinen Namen ein" statt „es wartet noch niemand". Ohne
sie klebt der Gastgeber den Link ein zweites Mal in den Chat.

**Status:** erledigt (2026-09-14). Entscheid in `DECISIONS.md`; der Ablauf steht im Kopf
von `apps/desktop/src/net/party.ts`.

---

## 2026-09-14 · T-M39-02 · Befund M39-2: Ein Haken an Objekten statt an Feldern kostet den Speicher

**Befund:** `useParty` hing mit seinem Effekt an `link` (einem Objekt) und `connect` (einer
Funktion). Der naheliegendste Aufrufer gibt beides frisch herein:

```tsx
useParty({ link: { role, room, secret }, connect: () => transport, … })
```

Für React ist ein frisches Objekt mit denselben Werten ein anderes. Der Effekt lief also bei
**jedem Bild** neu, baute jedes Mal eine Leitung, schickte `hallo` und rief `setSnapshot` —
was das nächste Bild auslöste. **Gemessen:** der Testlauf endete nach **160 Sekunden** mit
`FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory`,
bei 4 GB Halde.

**Warum die Reparatur nicht „der Aufrufer soll es richtig machen" ist.** Ein Haken, der nur
bei stabilen Eigenschaften funktioniert, ist eine Falle für seinen nächsten Benutzer — und
die Falle schnappt nicht mit einer Fehlermeldung zu, sondern mit einem toten Prozess. Der
Effekt hängt jetzt an den **drei Feldern** des Links (`role`, `room`, `secret`) und an der
Frage, *ob* es eine Leitungsquelle gibt; die Quelle selbst liegt in einem Merker.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · T-M39-06 · Befund M39-3: Eine abweichende Probe war beim Fortsetzen mehrdeutig

**Befund:** Die Determinismus-Probe (T-M38-03) trug zwei Zahlen — wie viele Ticks gerechnet
wurden und was dabei herauskam. Weichen zwei Prüfsummen ab, war der Schluss eindeutig: die
Rechner rechnen verschieden, die Partie beginnt nicht. **Beim Fortsetzen ist derselbe
Befund mehrdeutig:** zwei Seiten, die von *verschiedenen gespeicherten Ständen* losrechnen,
bekommen zwangsläufig verschiedene Prüfsummen, ohne dass irgendetwas kaputt wäre. R-MP-13
verlangt dort das Gegenteil einer Abweisung — der Host soll seinen Stand übertragen.

**Die sichere Richtung wäre die falsche gewesen.** Ohne Unterscheidung bliebe nur „bei einer
Wiederaufnahme immer übertragen". Dann ginge bei *jeder* fortgesetzten Partie ein
Viertelmegabyte über die Leitung (gemessen: 263 KB nach dreißig Spieltagen), und die Zusage
„übertragen werden Befehle, nie Zustände" (D28.2) hätte eine stille Ausnahme, die niemand
mehr prüft.

**Was geändert wurde:** `ProbeMessage` trägt zusätzlich `fromHash` — die Prüfsumme des
Standes, **von dem** die Probe losgerechnet hat. Damit sind die beiden Fälle exakt trennbar:

| Startabdruck | Probenprüfsumme | Schluss |
|---|---|---|
| gleich | gleich | weiter, und nichts geht über die Leitung |
| gleich | verschieden | **Abbruch** — dieselbe Ausgangslage, zwei Ergebnisse |
| verschieden | — | **Übertragen** — verschiedene Stände, kein Rechenfehler |

**Was der Wächter dabei nicht kann, und es steht am Code:** zwei *verschiedene* Stände mit
*demselben* Tick und verschiedenem Inhalt melden „verschiedene Stände" — das ist richtig.
Zwei Seiten mit demselben Stand und einem echten Rechenunterschied melden „Abbruch" — auch
richtig. Nicht unterscheidbar bleibt der Fall, in dem beides zugleich zutrifft; er endet in
einer Übertragung, und der laufende Prüfsummenvergleich je Tick (T-M37-09) fängt ihn im
ersten Tick danach.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · T-M39-07 · Befund M39-4: Eine neue Playtest-Frage hätte AK-7 zurückgesetzt

**Befund:** T-M39-07 verlangt, dass die Anleitung und `docs/PLAYTEST.md` die Einladung
erklären. Der naheliegende Weg — eine nummerierte Frage zur Partie zu zweit in den Bogen —
hätte **AK-7 wieder geöffnet**: `playtestStatus` zählt jede unbeantwortete Frage als offen,
`docs/reports/playtest-v1.md` hätte eine Zeile mehr gebraucht, und der Abnahmelauf hätte
für AK-7 wieder „⏳ vollstaendig ausgefuellt … AK-7 verlangt Noahs Abnahme" gemeldet.

**Das ist die Fehlerklasse des Nachtrags 2.15** in neuer Gestalt: eine später zugefügte
Zeile macht ein abgenommenes Kriterium unerfüllbar. Sie ist hier besonders leicht zu
übersehen, weil der Bogen *inhaltlich* der richtige Ort wäre.

**Wie es gelöst ist:** der Abschnitt zu AK-9 steht als **Prosa** im Bogen, ohne
nummerierte Zeile, und sagt in seinem ersten Satz, warum. AK-9 hat seinen eigenen Ort
(Abschnitt 3.2 der Anforderungen) und seinen eigenen Bericht
(`docs/reports/mehrspieler.md`). Ein Test hält beides fest: der Abschnitt nennt alle sechs
Punkte des Durchgangs, **und** die Fragen des Bogens sind deckungsgleich mit den Zeilen des
Antwortbogens.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · T-M39-04 · Befund M39-5: Befund M38-5 eingelöst — die Zusage hängt jetzt an einer Bauflagge

**Der Vorgänger:** M38-5 hielt fest, dass `apps/desktop/src/net/websocketTransport.ts`
gebaut und **absichtlich nicht verdrahtet** war, und warnte: „sobald der
Beitrittsbildschirm den Transport erreicht, steht er im Tauri-Bündel, und die Zusicherung
„kein `WebSocket` im Bündel" wird falsch. Sie darf dann nicht stillschweigend gestrichen
werden."

**Was gebaut wurde,** und es ist die zweite der beiden dort genannten Möglichkeiten: eine
**Bauflagge**, die den Einstieg herausschneidet. `apps/desktop/vite.config.ts` setzt
`__MULTIPLAYER__` auf ein literales `false`, sofern `WORLDWAR_MULTIPLAYER` nicht `1` ist;
`main.tsx` hängt den Mehrspielereinstieg an einen **dynamischen** Import hinter dieser
Flagge, und Rollup schneidet den Zweig samt Import heraus. `pnpm mp:host` setzt die Flagge
und baut dasselbe Bündel **mit** Einstieg — das ist der Bau, den der Hostdienst ausliefert.

**Gemessen am 2026-09-14 gegen `d5936cd`**, und die zweite Zeile ist die eigentliche Aussage:

| | Dateien | Zeichen | `WebSocket` |
|---|---|---|---|
| `dist` (ohne Flagge, das ausgelieferte Bündel) | 2 | 1 667 096 | **0** |
| `dist-mp` (mit Flagge, derselbe Quelltext) | 3 | 1 669 355 | 1 (`assets/websocketTransport-*.js`) |
| `worldwar.exe` (6 789 632 B, neu gebaut) | — | — | **0** |

Ohne die zweite Zeile wäre die erste keine Aussage über die Flagge, sondern ein Zufall —
genau der Unterschied zwischen „gemessen" und „grün geblieben". Die Ausnahme in
`REACHABILITY_EXCEPTIONS` ist heraus, wie sie es selbst verlangt hatte.

**Ein Nebenbefund mit Kosten, in zwei Läufen gemessen:** ein zweiter Bauordner muss an
**sechs** Stellen bekannt gemacht werden — `.gitignore`, `eslint.config.js`,
`tsconfig.json`, beide vitest-Konfigurationen **und** `test/guards/scan.ts`. Beide
Vergesslichkeiten sind wirklich passiert:

| Lauf | Was fehlte | Was `pnpm verify` meldete |
|---|---|---|
| 2026-09-14 16:47 | `eslint.config.js` | Hunderte Lint-Fehler aus erzeugtem Code, Exit 1 |
| 2026-09-14 16:50 | `test/guards/scan.ts` | **der Netz-Wächter meldet das gebündelte `new WebSocket` als Verstoß**, dazu ein Fremdasset-Treffer; 2 von 163 Dateien rot |

Der zweite ist der lehrreichere: `productionFiles()` überspringt `dist`, `coverage`,
`target` und `src-tauri` **namentlich** — ein Ordner, der anders heißt, ist für jeden
Wächter im Haus Produktcode. Der Ordner heißt `dist-mp` und nicht `dist/mp`, weil
`vite build --outDir dist` den Inhalt von `dist` beim nächsten Lauf leert; die sechs
Einträge sind der Preis dafür, und sie stehen jetzt mit Begründung da.

**Status:** erledigt (2026-09-14). M38-5 ist damit geschlossen.

---

## 2026-09-14 · T-M39-05 · Befund M39-6: Tailscale ist installiert und nicht angemeldet — AK-9 ist nicht messbar

**Befund:** Die letzte Meile (Noahs zweite Festlegung vom 2026-09-12) lässt sich auf dieser
Maschine **nicht** bis zum Ende prüfen. Gemessen am 2026-09-14:

```
tailscale version   1.102.2              (C:\Program Files\Tailscale\tailscale.exe)
tailscale ip -4     no current Tailscale IPs; state: NoState
Schnittstelle       Tailscale: 169.254.83.107   (APIPA, kein Tailnet)
```

Eine angemeldete Tailscale-Schnittstelle trägt eine Adresse aus `100.64.0.0/10` (RFC 6598,
der dokumentierte Bereich des Anbieters). `169.254.x.x` heißt: der Dienst läuft, aber es
gibt kein Tailnet.

**Was daraus folgt, und es ist kein Mangel am Bau.** Geprüft und gemessen ist alles, was
ohne Tailnet messbar ist: der Hostdienst horcht auf **allen** Schnittstellen und ist über
`192.168.178.93` erreichbar (nicht nur über die Rückschleife); er erkennt eine
Tailnet-Adresse an ihrem Bereich und stellt sie im Ausdruck nach vorn; und er **sagt es**,
wenn er keine findet, statt einen Link ins Leere zu drucken. Was fehlt, ist der Gast in
einem anderen Netz — und das ist AK-9, das einzige Kriterium dieses Plans, das kein Agent
erfüllen kann.

**Ausdrücklich nicht getan:** Tailscale anmelden, ein Konto anlegen, eine Einladung
erzeugen. Das sind Noahs Schritte, und sie stehen Schritt für Schritt in
`docs/ANLEITUNG.md` („Was Sie einmal einrichten") und in `docs/PLAYTEST.md`.

**Status:** offen bis AK-9 (T-M39-09) — und zwar mit Absicht.

---

## 2026-09-14 · T-M39-06 · Befund M39-7: Eine tote Zusicherung im eigenen Test

**Befund:** Die erste Fassung des Wiederaufnahme-Tests in `party.test.tsx` zählte, wie oft
ein Spielstand über die Leitung geht — und zählte in eine Liste, die **niemand füllte**:

```ts
const gesendet: string[] = []
leitung.a.onMessage(() => undefined)     // horcht, schreibt aber nichts
…
expect(gesendet).toEqual([])             // gruen, immer
```

Die Zusicherung war grün, bevor die Sache gebaut war, und wäre grün geblieben, wenn sie je
kaputtgegangen wäre. Das ist dieselbe Fehlerklasse wie der leere Koordinatenwächter aus M33
(`/-?d+(.d+)?/g` suchte den Buchstaben `d`) und wie „für jedes X gilt Y", wenn es kein X
gibt.

**Wie es repariert ist:** ein Schnüffler hängt wirklich an der Leitung und schreibt jede
Nachrichtenart mit. Er wird **nach** den beiden Haken angemeldet — das Schleifendoppel
reicht seinen Puffer dem *ersten* Hörer weiter (T-M37-11), und wer sich vordrängt, nimmt dem
Gast seine Willkommensnachricht weg. **Gegenprobe gefahren:** nimmt man die Übertragung aus
`party.ts` heraus, fällt die Zusicherung, die sie zählt.

**Die Lehre, die über diesen Fall hinausgeht:** eine Zusicherung auf `[]` oder `0` ist
verdächtig, solange nicht danebensteht, dass dieselbe Messung in einem anderen Fall **nicht**
null ist. Hier steht es: bei gleichen Ständen kein `zustand`, bei verschiedenen genau eines.

**Status:** erledigt (2026-09-14).
---

## 2026-09-14 · Sichtprüfung Mehrspieler · Befund MP-1: `pnpm mp:host` liefert unter Windows auf **jede** Adresse 404

**Befund:** Der Hostdienst startete, druckte beide Links und beantwortete danach jede Anfrage
mit `404 Nicht gefunden.` — auch `/` und `/index.html`. Beide Browser blieben weiß; die
Sichtprüfung des Mehrspielers konnte ohne diese Reparatur nicht einmal beginnen.

**Ursache, gemessen:** `apps/party/src/index.ts` setzt die Wurzel als Zeichenkette zusammen —
`fileURLToPath(...)` liefert unter Windows Rückstriche, der Rest steht mit Schrägstrichen da:

```
Ausgeliefert wird: C:\Users\noahh\Desktop\Claude-Projekte\WorldWar\apps/desktop/dist
```

In `resolveStatic` normalisiert `join(root, relativ)` die Trenner, der Vergleich davor nicht:

```
join(root, 'index.html')  = C:\Users\…\WorldWar\apps\desktop\dist\index.html
`${root}${sep}`           = C:\Users\…\WorldWar\apps/desktop/dist\
ziel.startsWith(…)        = false   ->  „zeigt aus dem Ordner hinaus"  ->  null  ->  404
```

**Kleinster reproduzierbarer Fall:**

```js
resolveStatic(`${fileURLToPath(new URL('./', import.meta.url))}apps/desktop/dist`, '/')  // null
resolveStatic(join(ROOT, 'apps', 'desktop', 'dist'), '/')                                // …\index.html
```

**Warum kein Test das sah:** `apps/party/test/server.test.ts` legt die Wurzel mit
`mkdtempSync(join(tmpdir(), …))` an — die ist immer normalisiert. Die Zusicherung „löst die
Wurzel auf index.html auf" war grün und blieb es, während der Dienst im Spiel nichts
auslieferte. Derselbe Fehlerkopf wie der leere Koordinatenwächter aus M33.

**Wie es repariert ist:** `resolveStatic` löst die Wurzel zuerst auf (`resolve(root)`) und
vergleicht gegen die aufgelöste Form. Damit trägt auch ein `--root` mit Schrägstrichen. Die
Ausbruchsprüfung bleibt: `/../geheim` ist weiter `null`. Neuer Fall
„liefert auch aus, wenn die Wurzel gemischte Trenner traegt"; **Gegenprobe gefahren** —
ohne die Reparatur fällt er.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · Sichtprüfung Mehrspieler · Befund MP-2: Wer seinen Link zuerst öffnet, wartet für immer

**Befund:** Öffnet der **Gast** seinen Link, bevor der Gastgeber seinen geöffnet hat, finden
die beiden nie zusammen. Gemessen an zwei sichtbaren Fenstern desselben Rechners: Gast um
`t=0`, Gastgeber um `t=10 s`, Partie angelegt um `t=17 s`.

| Seite | Was auf dem Bildschirm steht — auch nach 30 weiteren Sekunden |
|---|---|
| Gastgeber | „Es wartet noch niemand. Der Link ist erst nützlich, wenn er angekommen ist." |
| Gast | „Der Gastgeber legt die Partie gerade an. Gleich steht hier, worauf Sie sich einlassen." |

Ein Neuladen beim Gast löst es **sofort** — danach steht beim Gastgeber „Jemand hat den Link
geöffnet und trägt gerade seinen Namen ein."

**Ursache:** Der Hostdienst ist Briefträger und kein Briefkasten — `Room.relay` schickt nur an
Plätze, die **gerade** besetzt sind, und puffert nichts. Der Gast schickte sein `hallo` genau
einmal, beim Verbindungsaufbau; saß da noch niemand, war es weg. Der Gastgeber schickte
überhaupt keine Anmeldung, also fragte auch nie jemand nach.

**Kleinster reproduzierbarer Fall:** Gast-Link öffnen, zehn Sekunden warten, Gastgeber-Link
öffnen, Partie anlegen. Im Test: zwei Enden, die nur an *besetzte* Plätze zustellen
(`RaumEnde` in `party.test.tsx`), Gast zuerst gerendert.

**Warum kein Test das sah:** `createLoopback` **puffert**, was ankommt, bevor jemand zuhört
(T-M37-11, dort mit Absicht eingebaut: „Eine echte Leitung puffert genauso"). Für die eine
Leitung stimmt das — für den **Raum** dazwischen nicht. Das Doppel war freundlicher als die
Wirklichkeit, und genau in dieser Lücke saß der Befund.

**Wie es repariert ist:** Beide Seiten melden sich an, nicht nur der Gast; das `hallo` des
Gastgebers ist die Nachfrage, und der Gast beantwortet sie mit seiner eigenen Anmeldung —
mit Namen, wenn er schon einen eingetragen hat. Keine neue Nachrichtenart, keine Änderung am
Dienst. **Gegenprobe gefahren**, im Test und am Bildschirm: nimmt man die Anmeldung des
Gastgebers heraus, meldet der neue Fall wieder `expected null to be ''`; am reparierten
Bündel steht der Wartende ohne Neuladen in der Lobby.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · Sichtprüfung Mehrspieler · Befund MP-3: Eine Abweisung wird endlos wiederholt und nie gezeigt

**Befund:** Wird eine Verbindung abgewiesen — belegter Platz, voller Raum, falsches
Geheimnis, unbekannter Raum —, versucht der Browser es ohne Ende weiter, und der Gast erfährt
den Grund nie. Gemessen gegen einen von außen belegten Platz `p2`:

```
77 Verbindungsversuche in 20,0 s  = 3,8 je Sekunde
Schließcode jedes Mal: 4001 „Dieser Platz ist besetzt."
Auf dem Bildschirm:    „Der Gastgeber legt die Partie gerade an."
```

**Ursache:** Der Dienst weist **nach** dem 101-Handschlag ab (er muss erst Raum und Geheimnis
lesen). Der Browser feuert deshalb erst `open` — und `open` setzt im Transport `attempt = 0`
zurück („die nächste Störung ist eine neue Störung"). Der Wiederaufbau kam damit nie an das
Ende seiner Abstandsliste.

Der Satz, der gefehlt hat, stand schon im Haus — in `apps/party/src/room.ts` über
`REFUSED_CLOSE_CODE = 4001`: *„Ein Code über 4000 heisst deshalb: **nicht wiederversuchen**,
das ist kein Netzfehler, sondern eine Antwort."* Gebaut war er nur auf der Serverseite.

**Kleinster reproduzierbarer Fall:** einen Sockel auf `ws://…/raum/<id>?s=<geheimnis>&platz=p2`
offen halten und denselben Link im Browser öffnen. Im Test: `sockets[0].close(4001, 'Dieser
Platz ist besetzt.')` nach einem gelungenen Aufbau.

**Wie es repariert ist:** `websocketTransport.ts` behandelt jeden Schließcode ab **4000** als
Antwort: kein Wiederversuch, `onClose` mit dem Satz des Dienstes. Damit greift der
Beitrittsbildschirm, den es längst gibt. Gemessen am reparierten Bündel, dieselbe Lage:

```
1 Verbindungsversuch statt 77
„Der Beitritt hat nicht geklappt — Dieser Platz ist besetzt.
 Bitten Sie den Gastgeber um einen neuen Link."
```

**Gegenprobe gefahren:** ohne die Reparatur fallen beide neuen Fälle
(`expected [ 250 ] to deeply equal []`).

**Nebenbefund, nicht repariert:** in der Zeile aus `docs/reports/mehrspieler-anleitung.md` §4
(„Der Gast sieht ‚Der Beitritt hat nicht geklappt'") stand damit bis heute etwas, das der
Gast nicht sah. Die Anleitung selbst bleibt richtig — sie beschreibt jetzt den gebauten Stand.

**Status:** erledigt (2026-09-14).

---

## 2026-09-14 · Sichtprüfung Mehrspieler · Befund MP-4: Fünf Spielertexte, die niemand je sieht

**Befund:** In `apps/desktop/src/i18n/de.ts` stehen unter `netplay` fünf Texte, die im ganzen
Quellbaum **nirgends** gerendert werden:

| Schlüssel | Text | Wann er fehlt |
|---|---|---|
| `pauseSent` | „Ihr Pausenantrag ist gestellt. Ohne Antwort verfällt er nach dreißig Sekunden." | nach dem Druck auf *Pause beantragen* |
| `pauseDeclined` | „Ihr Mitspieler möchte weiterspielen." | wenn der andere ablehnt |
| `pauseExpired` | „Der Pausenantrag ist verfallen." | nach dreißig Sekunden ohne Antwort |
| `paused` | „Die Partie steht. Fortsetzen darf jeder allein." | während der Pause |
| `resuming` | „Die Partie läuft in drei Sekunden weiter." | nach dem Druck auf *Fortsetzen* |

**Gemessen am Bildschirm:** der Gastgeber stellt einen Pausenantrag — seine Kopfleiste ändert
sich nicht. Der Gast lehnt mit *Weiterspielen* ab — beim Gastgeber ändert sich wieder nichts;
der einzige Hinweis, der dort stand, war der alte („Vorspulen gibt es zu zweit nicht"). Wer
den Antrag stellt, sieht also weder, dass er gestellt ist, noch dass er abgelehnt wurde.

**Kleinster reproduzierbarer Fall:**

```bash
grep -rn "pauseSent\|pauseDeclined\|pauseExpired" apps/desktop/src --include=*.tsx
# nur de.ts und Tests
```

**Nicht repariert, und warum:** wo die Sätze hingehören und ob sie überhaupt hingehören, ist
eine Frage an den Maßstab — die Kopfleiste ist im Mehrspieler schon voll (Uhr, feste Rate,
„Warte auf Mitspieler …", *Pause beantragen*, der Verlust-Hinweis mit zwei Knöpfen). Ein
Agent, der hier Text einbaut, entscheidet über das Aussehen.

**Status:** erledigt (2026-09-18, T-M39-10). Die drei Sätze, die einen **Zustand**
beschreiben — `pauseSent`, `paused`, `resuming` — stehen in der Kopfleiste neben dem
Pausenknopf; die zwei **Ereignisse** — `pauseDeclined`, `pauseExpired` — in der
Meldezeile, in der schon `header.pauseNeedsConsent` steht. Die Gestaltungsfrage, an der
der Befund hing, ist damit entschieden und in DECISIONS.md als kippbar festgehalten.
Dafür trägt `PauseState` ein neues Feld `noticeBy`: ohne es ist `'declined'` auf beiden
Rechnern dasselbe, und der Ablehnende läse einen Satz über sich selbst. Neun Fälle an der
ganzen Anwendung (`App.test.tsx`), **sechs davon fallen ohne die Reparatur**; die drei
übrigen sind die Verneinungen — der Ablehnende liest nichts, der eigene Antrag bekommt
keinen Dialog, im Einzelspieler steht keiner der fünf Sätze.
**Nachgearbeitet am 2026-09-24** (Durchsicht vom 2026-09-18, Stufe niedrig): ein fremder
Antrag löschte beim Gefragten jede Meldung, nicht nur die alte Pausenantwort — an der
ganzen Anwendung nachgestellt („+" gedrückt, der Hinweis zur festen Rate steht, der
Mitspieler beantragt, der Hinweis ist fort). `clearNotice` nimmt jetzt ein `onlyIf` und
leert nur `pauseDeclined`/`pauseExpired`; zwei Fälle an der Anwendung, einer am
Reduzierer, Gegenprobe gefahren. Zwei weitere Befunde derselben Durchsicht bleiben offen:
MP-6 und MP-7.
---

## 2026-09-14 · Sichtprüfung Mehrspieler · Befund MP-5: Ein Satz aus M37 steht noch im Anlegedialog

**Befund:** Wer eine Partie zu zweit anlegt, liest unter der Einladungsvorschau

> „Die Verbindung zum Mitspieler kommt mit dem nächsten Ausbau; die Partie beginnt vorerst
> lokal." (`newGame.multiplayerPending`)

Das war in M37 richtig und ist seit M38/M39 falsch: die Verbindung ist gebaut, und die Partie
beginnt sehr wohl zu zweit. Gemessen am 2026-09-14 im Anlegedialog des Gastgebers, unmittelbar
über dem Knopf, der die Partie zu zweit eröffnet.

**Kleinster reproduzierbarer Fall:** `pnpm mp:host`, den eigenen Link öffnen, Partieart steht
auf „Zu zweit über einen Link" — der Satz steht als `<small>` unter den vier Einladungszeilen.

**Nicht repariert, und warum:** ob dort **nichts** stehen soll oder ein anderer Satz, ist eine
Frage an den Maßstab — der Kasten trägt sonst nur Angaben, keine Erklärungen. Spielertext ist
Noahs Entscheidung.

**Status:** erledigt (2026-09-18, T-M39-11). Der Satz ist ersatzlos gestrichen, samt
Schlüssel `newGame.multiplayerPending`; der alte Wortlaut steht als Kommentar an beiden
Stellen. Der Kasten trägt jetzt, was PROBLEME.md als Maß nannte: Angaben, keine
Erklärungen. Was als Nächstes kommt, sagt die Lobby einen Klick später. Seit der
Nacharbeit zu V-1 (2026-09-24) steht der Kasten nur noch mit Raum; seine Überschrift „Die
Einladung nennt:" behauptet damit keine Einladung mehr, die es nicht gibt. Im netzfreien
Bündel ist der Schlüssel gemessen fort („nächsten Ausbau" 0×, „vorerst lokal" 0×).
---

## 2026-09-14 · Verpackungslauf AK-8 (`e82c2bc`) · Befund V-1: Der netzfreie Bau bietet eine Partieart an, die er nicht herstellen kann

**Befund:** Der Startdialog des **ausgelieferten Tauri-Programms** trägt seit M37 den Wähler
„Partieart“, und er bietet dort **beide** Werte an: „Allein gegen den Rechner“ *und* „Zu zweit über
einen Link“. Dieses Programm kann die zweite Art technisch nicht — `__MULTIPLAYER__` ist beim
gewöhnlichen Bau ein literales `false` (T-M39-04), der Rollup-Baum schneidet den Transport heraus, und
`connect-src 'none'` verböte die Verbindung ohnehin. Der Wähler ist von der Bauflagge **nicht** gedeckt:
sie steht in `main.tsx` und entscheidet über den Beitrittsweg, nicht über die Auswahl in
`ui/Dialogs.tsx`.

**Gemessen, nicht erschlossen** (exe vom 2026-09-14 18:40 gegen `e82c2bc`, über CDP am sichtbaren
Fenster, nur lesen und einmal klicken):

| Gemessen | Beobachtung |
|---|---|
| Werte des Wählers „Partieart“ | „Allein gegen den Rechner“, „Zu zweit über einen Link“ |
| nach dem Umstellen auf „Zu zweit“ | Die Einladungsvorschau erscheint: Karte, „Sie spielen Vereinigte Staaten, Ihr Mitspieler Kanada“, „Computergegner: 6“, „Feste Geschwindigkeit: 10 Spielstunden je Sekunde“ |
| nach „Partie beginnen“ | Die Partie läuft **lokal**, Kopfleiste „10 Stunden je Sekunde (fest)“, das Mitspielerland ist eine KI, **kein Fehler**, kein Verbindungsversuch |
| `WebSocket` im gebauten Bündel (2 Dateien, 1 668 947 Zeichen) | **0×** |
| `connect-src 'none'` in `worldwar.exe` | **1×** |

Es entsteht also **kein Netzzugriff** und kein hängender Zustand — der Spieler bekommt eine
Einzelspielerpartie mit fester Rate und ohne Vorspulen, und der Hinweis darunter sagt es sogar:
„Die Verbindung zum Mitspieler kommt mit dem nächsten Ausbau; die Partie beginnt vorerst lokal.“
Genau dieser Satz ist seit M38/M39 falsch — im **Hostbau** ist die Verbindung gebaut (Befund MP-5).
Im **Tauri-Bau** ist er sachlich noch richtig und trotzdem irreführend: er verspricht einen Ausbau,
den dieses Programm dem Vorsatz nach nie bekommt.

**Kleinster reproduzierbarer Fall:** `pnpm tauri:build`, `worldwar.exe` starten, im Startdialog die
Partieart auf „Zu zweit über einen Link“ stellen — es erscheint die Einladungsvorschau samt fester
Rate, obwohl es in diesem Bau keinen Link gibt und keinen geben soll.

**Nicht repariert, und warum:** Der Verpackungslauf misst, er ändert keinen Produktivcode — und die
Reparatur ist eine Frage an den Maßstab, keine technische. Drei Wege stehen offen, und welcher
richtig ist, entscheidet Noah: den Wähler im netzfreien Bau **hinter dieselbe Bauflagge** legen
(`__MULTIPLAYER__`, dann hat das Programm nur eine Partieart und der Wähler verschwindet), ihn
stehen lassen und den Hinweis auf das umschreiben, was hier wahr ist („Dieses Programm spielt allein;
zu zweit geht es über den Hostdienst“), oder ihn bewusst als Vorschau behalten. Der erste Weg ist der
einzige, nach dem die Zusage „die Tauri-Anwendung kennt keinen Mehrspieler“ **auch an der Oberfläche**
wahr ist; die Zusage „darf ihn technisch nicht können“ ist schon heute gemessen wahr.

**Status:** erledigt (2026-09-18, T-M39-11; **nachgearbeitet am 2026-09-24**). Gebaut ist
der **erste** der drei Wege: im netzfreien Bau gibt es die Wahl nicht. **Im Hostbau gibt es
sie nur mit Raum** — die Fassung vom 2026-09-18 hing die Liste allein an die Bauflagge, und
der Hostbau ohne Raum (`/` statt `#/gastgeben`) bot die zweite Art weiter an und lieferte
die erste: das Symptom dieses Befunds, im anderen Bau (Durchsicht vom 2026-09-18, Stufe
hoch; am 2026-09-24 an der ganzen Anwendung nachgestellt). Jetzt
`gameModesFor(__MULTIPLAYER__, hostsParty)` — zu zweit nur, wenn der Bau es kann **und**
dieser Bildschirm einen Raum als Gastgeber führt. Und die **Wirkung** hängt an derselben
Liste, nicht nur die Anzeige: `effectiveMode` entscheidet, was der Dialog zeichnet und was
er an `onStart` weiterreicht; `startNewGame` liest `options.mode` nicht mehr (Stufe mittel,
nachgestellt: eine vorgewählte Partie zu zweit startete ohne Raum mit fester Rate). Die
Bauflagge wird für die Oberfläche an genau einer Stelle gelesen (`App.tsx`, `gameModes`);
geprüft sind **beide** Werte der Flagge und **beide** Lagen des Raums, ohne die Flagge zu
setzen. Entscheid samt Kippweg in DECISIONS.md. **AK-8 bleibt unberührt**: die sieben
Schritte fahren „Allein gegen den Rechner", und genau das ist die einzige Partieart des
ausgelieferten Programms.
**Was sich im netzfreien Bündel ändert — gemessen, nicht erschlossen** (2026-09-24,
`vite build` in `apps/desktop` ohne `WORLDWAR_MULTIPLAYER` auf `f47b830`, Ausgabe außerhalb
des Baums): heraus fällt **allein der Schlüssel** `newGame.multiplayerPending` („nächsten
Ausbau" 0×, „vorerst lokal" 0×). Wähler, Rate und Einladungskasten **stehen weiter im
Bündel** und werden nur zur Laufzeit nicht gezeichnet: „Zu zweit über einen Link" 1×,
„Partieart" 1×, „Die Einladung nennt" 1×, „Feste Geschwindigkeit" 3×, der Aufruf
`newGame.modeMultiplayer` 1×. Der Grund: die Liste kommt aus einer Funktion in einem
anderen Modul, `modes.length > 1` kann Rollup nicht falten — und selbst mit der Flagge als
Literal im Dialog blieben die Texte im Katalog `de.ts`, der als Ganzes gebündelt wird. Es
ist Laufzeit-Indirektion, keine Baumschneidung; die Fassung vom 2026-09-18 („die zweite
Option und der Satz aus M37 fallen heraus") war zur Hälfte falsch. `WebSocket` im Bündel:
**0×** — die Netzfrei-Zusage hält, an dem Zweig hängt kein Netzcode. **Neu zu messen bleibt
das Erzeugnis**, weil sich der Code geändert hat, nicht weil Inhalt fiele: gemessen
**2 Dateien, 1 669 812 Zeichen** gegen 1 668 947 in `docs/reports/packaging-netfree.json`
(gemessen auf `6622ec9`); `bundle.bytes` und `binary.bytes` stimmen erst nach einem neuen
Bau samt `scripts/measure-netfree.mjs` wieder. Der Wächter ist heute grün — er liest den
Bericht und, wenn die exe auf der Maschine liegt, sie selbst; beide sind unverändert.

---

## 2026-09-24 · Durchsicht der Bahn C · Befund MP-6: Zwei gleiche Pausenereignisse hintereinander fallen zusammen

**Befund** (Durchsicht vom 2026-09-18, Stufe niedrig; per Codelesen, **nicht nachgestellt**):
der Effekt in `App.tsx`, der `pauseDeclined`/`pauseExpired` in die Meldezeile schreibt,
reagiert auf eine **Änderung** von `pause.notice` und `pause.noticeBy` — und die Hülle sieht
`PauseState` nur einmal je Takt: `setSnapshot` steht allein in `schlag()`
(`useNetplay.ts`), während `requestPause`, `answerPause`, `resume` und der Empfang den
Zustand ohne Schnappschuss ändern. Fallen ein `'requested'` und die Antwort darauf in
dieselbe Taktlücke (40 ms bei 25 Stunden je Sekunde), sieht React nur `'declined'`; beim
**zweiten** Mal in Folge ändert sich dann weder `notice` noch `noticeBy`, und der
Antragsteller liest nichts.

**Nicht repariert, und warum:** die saubere Reparatur ist eine monoton wachsende
Ereignisnummer in `PauseState` (oder ein Schnappschuss nach jeder Pausenänderung in
`useNetplay`) — ein Eingriff in `packages/netplay` samt Tests an zwei Maschinen, kein
Minutenwerk. Und die Lage braucht einen Menschen, der binnen eines Takts auf einen Antrag
antwortet, den sein eigener Bildschirm erst im nächsten Takt zeigt; am Bildschirm ist sie
nicht beobachtet.

**Status:** offen, niedrig (2026-09-24).

---

## 2026-09-24 · Durchsicht der Bahn C · Befund MP-7: `pollPause` kann das Verfallen im selben Aufruf überschreiben

**Befund** (Durchsicht vom 2026-09-18, Stufe niedrig; per Codelesen, **nicht nachgestellt**):
`pollPause` (`packages/netplay/src/pause.ts`) prüft nacheinander „Antrag verfallen" und
„Fortsetzen fällig" auf demselben Zwischenstand. Sind beide im selben Aufruf fällig, setzt
der zweite Zweig `notice: 'resumed'` und löscht das `'expired'` des ersten — das Verfallen
wird nie gemeldet. Möglich ist das, weil `applyPause('antrag')` einen Antrag auch während
einer stehenden Partie oder während der drei Sekunden Vorlauf annimmt.

**Nicht repariert, und warum:** beide Reparaturen sind Entscheidungen über den
Pausenvertrag (R-MP-05, D28.7), keine Handgriffe — einen Antrag während der Pause
verwerfen, oder Ereignisse als Liste statt als Einzelwert führen. Das Fenster ist schmal:
die Frist eines Antrags (30 s) muss im selben Abfrageschritt ablaufen wie der Vorlauf
(3 s), und der Antrag muss während einer stehenden Partie gestellt worden sein. Die
Kopfleiste zeigt dort *Fortsetzen* statt *Pause beantragen*; die Leertaste ruft
`requestPause` allerdings weiterhin, und `useNetplay` reicht ihn ohne eigene Sperre an den
Gleichschritt weiter (ob `createLockstep` ihn dann annimmt, ist nicht geprüft).

**Status:** offen, niedrig (2026-09-24).

---

## 2026-09-24 · Nacharbeit der Bahn C · Befund MP-8: Der Gastgeber mit Raum wählt „Allein" und bekommt trotzdem die Lobby

**Befund:** `startNewGame` bietet die Partie dem Raum an, sobald dieser Bildschirm Gastgeber
ist (`alsGastgeber = netParty.active && netParty.role === 'host'`) — **unabhängig von der
gewählten Art**. Gemessen am 2026-09-24 an der ganzen Anwendung (ein Wegwerf-Test, nicht
eingecheckt): Gastgeber mit Raum, Partieart auf „Allein gegen den Rechner", *Partie
beginnen* → es öffnet sich der Dialog „Partie zu zweit eröffnen", die Kopfleiste zeigt
keine feste Rate, *Vorspulen* ist da. Angeboten wird dabei die Partiedefinition der
Einzelspielerpartie — `toConfig` macht bei `mode: 'single'` den zweiten Platz zu einem
Computergegner, auf den der Gast beträte (per Codelesen; was dann geschieht, ist nicht
gemessen). Das ist V-1 in der Gegenrichtung: angeboten „allein", geliefert eine Lobby. Das
Verhalten ist älter als diese Bahn; die Nacharbeit zu V-1 hat es nicht verändert, nur
sichtbar gemacht.

**Nicht repariert, und warum:** die Antwort ist eine Frage an den Maßstab. Entweder startet
„Allein" auch mit Raum eine Einzelspielerpartie ohne Angebot (dann wartet ein schon
verbundener Gast weiter auf eine Partie, die nicht kommt), oder der Gastgeber mit Raum
bekommt gar keine Wahl (wer über `#/gastgeben` kommt, will zu zweit spielen — T-M39-03).
Beides ist ein Satz Code; welcher, entscheidet Noah.

**Status:** offen — Frage an Noah (2026-09-24).

---

## 2026-09-18 · T-M17-02 · Befund M17-1: B6 ist gemessen — dreizehn Überfälle, drei davon auf dem Weg

**Befund:** Befund B6 (2026-09-13) stand auf „nicht gemessen": ein KI-Marsch kann über das Land
einer friedlichen dritten Macht führen, und das ist ein Überfall. Der Ausgangswert
(`docs/reports/m17-baseline.json`, `8bda869`, Weltkarte, acht KI, Startzahl 1815, 200 Spieltage)
zählt **13 Überfälle ohne Kriegserklärung bei 15 Kriegen** — die KI erklärt in 200 Tagen nur
**zweimal** förmlich den Krieg, alle anderen Kriege beginnen mit Stiefeln auf fremdem Boden.

**Eingeordnet je Tick, nicht geschätzt.** Der Messlauf liest unmittelbar nach dem Tick, in dem der
Überfall fiel, wohin die Armee wollte, die auf fremdem Boden stand:

| Art | Zahl | Bedeutung |
|---|---|---|
| `ziel` | 10 | das Marschziel liegt im Land des Opfers — ein Angriff ohne Erklärung |
| `durchmarsch` | 3 | das Marschziel gehört jemand anderem — das Opfer lag nur auf dem Weg |

Von den drei Durchmärschen führte **einer** zu einem Kriegsgegner (Italien über Frankreich nach
Deutschland, Tick 2012) und **zwei zurück ins eigene Land** (Russland über China, Tick 2822; China
über Indien, Tick 3218). In keinem Fall lief eine Kriegserklärung gegen das Opfer.

**Was daraus folgt.** R-AI-09/AK3 („mit Anträgen nicht mehr Überfälle") hat etwas zu messen, aber
der Hebel ist klein: ein Antrag auf Durchmarsch (T-M17-10) kann höchstens **3 von 13** verhindern.
Die zehn anderen sind kein Wegproblem, sondern die Art, wie die KI Krieg beginnt — sie marschiert
einfach los. Das ist kein Auftrag von M17 und wird hier nur festgehalten, damit T-M17-15 die
Zahl 13 nicht für den Erfolgsmaßstab des Antrags hält. Dazu: **keine** Durchmarsch- und **keine**
Kartenfreigabe und kein Bündnis in 200 Tagen (909 Friedensangebote, 7 angenommen) — die
Felder, die T-M17-03 umbaut, sind in einer reinen KI-Partie heute nie gesetzt.

**Status:** gemessen; offen für T-M17-10 (Antrag) und T-M17-15 (Vergleich gegen 3, nicht gegen 13).

---

## 2026-09-18 · T-M17-02 · Befund M17-2: `ai-integration.json` ist seit fünf Tagen veraltet, und niemand merkt es

**Befund:** Der Messlauf des Ausgangswerts lag als unversionierter Rest eines abgebrochenen
Agenten im Baum. Sein Kopfkommentar behauptete, die Prüfsumme `zustandOhneKi` müsse dem Wert in
`docs/reports/ai-integration.json` gleichen — „eine zweite Messung mit einem zweiten Werkzeug,
ohne einen zweiten Lauf". **Sie gleicht ihm nicht:** der Bericht nennt `e7b0627bff9f7b39`, der
Messlauf `10950ec5abffd9b7`.

**Nachgesehen statt angenommen.** Der eingecheckte Bericht stammt vom 2026-09-13 (`fcf43cd`).
Seitdem liegen vierzehn Commits an `packages/core/src`, `packages/ai/src` und `data/rules` auf
`main` — M35 mit dem Feld `goals`, die Nacharbeiten zu M40, die Marke 350 ‰. Das Integrationstor
auf `8bda869` neu gefahren (132 s, 21 von 21 grün) meldet **`10950ec5abffd9b7`**, 29 987
Ereignisse, 16 650 KI-Befehle, 3 Ablehnungen — also genau die Zahlen des Ausgangswerts. Die
Gleichheit gilt, aber nur **auf demselben Commit gemessen**; gegen den eingecheckten Bericht war
die Behauptung falsch und wäre beim ersten Nachsehen aufgefallen. Der Kommentar ist berichtigt.

**Der eigentliche Befund dahinter:** `ai-integration.json` steht unter **keinem**
Frische-Wächter. `GAUGES` deckt den Parameterlauf und das Turnier, `STANCE_SOURCES` den
Haltungs-Messlauf; das Integrationstor schreibt seinen Bericht bei jedem Lauf neu, aber nichts
wird rot, wenn er hinter dem Kern zurückbleibt. Wer ihn als Vergleichswert liest, liest den Stand
vom 2026-09-13.

**Nicht repariert, und warum:** der neu gefahrene Bericht ist zurückgesetzt, nicht eingecheckt —
T-M17-03 verschiebt die Prüfsumme sofort wieder (neue Zustandsfelder), und T-M17-15 fährt das
Integrationstor ohnehin als eigene Aufgabe. Ob der Bericht einen Wächter nach dem Muster
`measuredAtCommit` bekommt, gehört in die M18-Sammelstelle.

**Status:** offen (Wächter); die falsche Behauptung ist berichtigt.

---

## 2026-09-18 · T-M17-03 · Befund M17-3: der Entwurf sagt, ein Krieg lösche „nur den Durchmarsch" — er löscht seit je auch die Karte

**Befund:** D29.1 beschreibt, was die neuen gerichteten Felder wann ändern, und schließt mit:
„`acceptAlliance` setzt beide Richtungen beider Felder, `breakAlliance` löscht sie, eine
wirksame Kriegserklärung löscht **wie heute nur den Durchmarsch**." Das „wie heute" stimmt
nicht. `phases/diplomacy.ts` löscht, sobald eine Kriegserklärung wirksam wird, **beide**
Felder — `rightOfWay` *und* `sharedMap`, seit M6 und unverändert.

**Gemessen, nicht erinnert:** die Zeilen standen vor T-M17-03 unmittelbar untereinander
(`relation.rightOfWay = false` / `relation.sharedMap = false`), und `git log -L` führt sie bis
auf den ersten Bau der Phase zurück.

**Was daraus folgt — und was hier bewusst NICHT passiert.** T-M17-03 ist der Migrationsschritt:
er richtet den *Zustand*, nicht das *Verhalten*. Hätte dieser Schritt die Karte im Krieg stehen
lassen, wäre eine Regeländerung mitten in eine Formatumstellung geraten — und beide
Golden-Master hätten sich aus **zwei** Gründen zugleich verschoben, von denen keiner mehr vom
anderen zu trennen gewesen wäre. Der Krieg löscht deshalb weiterhin beide Richtungen beider
Felder, und im Code steht, warum.

**Die Frage dahinter ist echt und gehört nach T-M17-04:** soll ein Krieg die Kartenfreigabe
mitnehmen? Dafür spricht, dass niemand dem Feind die eigene Karte lässt; dagegen, dass eine
*geschenkte* Karte nicht zurückgenommen werden kann — was der andere gesehen hat, weiß er.
Solange das offen ist, gilt das Verhalten von heute.

**Status:** entschieden (2026-09-24, T-M17-04): ein Krieg nimmt die Kartenfreigabe mit, in beiden Richtungen — was der andere gesehen hat, behält er im Aufklärungsgedächtnis, gelöscht wird nur die laufende Sicht. Dasselbe gilt jetzt für den Überfall, der die Karte seit M6 stehen ließ (Befund M17-D1). Kippbar in `DECISIONS.md`; D29.1 ist datiert berichtigt.

*Nachtrag 2026-09-24: der Vermerk stand bis heute nur hier, nicht im Entwurf. Jetzt tragen D29.1
und D29.3 Punkt 1 ihn selbst, und `packages/core/src/state/relation-direction.test.ts` hält fest,
dass eine wirksame Kriegserklärung alle sechs gerichteten Felder zurücksetzt — in beiden Hälften
des Schlüssels (Befund M17-6).*

---

## 2026-09-18 · T-M17-03 · Befund M17-4: der Mehrspieler kennt die Formatstufe nicht — und nahm einen fremden Stand an

**Befund:** D29.12 nahm an, M17 sei **vor** M37 gemergt. Es kam umgekehrt. Also nachgesehen,
was am Mehrspieler an `SCHEMA_VERSION`, am Spielstandsformat, an `rightOfWay`/`sharedMap` oder
am Zustandshash hängt — `packages/netplay`, `apps/party`, `apps/desktop/src/net`, die Skripte
und die Mehrspieler-Tests.

**Drei Antworten, alle gemessen:**

1. **Der Handschlag sieht die Stufe nicht.** `fingerprintOf` vergleicht Protokollfassung,
   Regel- und Kartenprüfsumme (`handshake.ts`) — die Formatstufe steht nicht darin. Zwei Bauten,
   die sich **nur** im Kern unterscheiden, kommen also durch den Handschlag.
2. **Die Determinismus-Probe fängt es trotzdem** — das ist ihr Zweck. 24 Ticks aus derselben
   Partiedefinition ergeben mit Stufe 4 `d4e0ae7104e71c6b` statt `b2f6fef971bbfc1b` (gemessen
   am 2026-09-18, 53 ms kalt gegen eine Grenze von 100). Die Partie beginnt nicht. Was sie
   **falsch** macht, ist die Meldung: „aus demselben Stand kommen zwei Ergebnisse" schickt den
   Nächsten auf die Suche nach einem Fehler im Kern, den es nicht gibt (genau die Falle, die
   `resumeDecision` für den umgekehrten Fall schon vermeidet).
3. **Eine Stelle war wirklich kaputt, und die ist repariert.** `acceptState` nahm einen
   übertragenen Stand allein nach seiner Prüfsumme an (T-M39-06, R-MP-13/AK2). Seit Stufe 4
   heißt das: ein Stand der Stufe 3 wird angenommen, und `cloneState` liest im **ersten Tick**
   `state.espionage.spies` — aus der irreführenden Meldung wäre ein Absturz geworden. `acceptState`
   prüft jetzt **zuerst** die Stufe und nennt beide Zahlen. Der Test dazu fällt ohne die
   Reparatur (Gegenprobe gefahren).

**Was nicht repariert wurde, und warum:** die Formatstufe in den Handschlag zu nehmen ändert das
Nachrichtenformat und gehört mit einer Erhöhung von `PROTOCOL_VERSION` zusammen. Dazu kommt, dass
das Fenster klein ist: **ab T-M17-04 ändert M17 `data/rules`**, und dann meldet schon der
Handschlag „verschiedene Regeln" mit einem Satz, den man lesen kann. Der Vorschlag gehört in die
M18-Sammelstelle, nicht in eine Migrationsaufgabe.

**Zwei Zahlen, die dabei abfielen:** die Zustandsnachricht wächst um **1558 Byte** (15 Beziehungen
auf der Weltkarte, sechs Mächte) — 0,6 %, gegen eine Grenze von 512 000. Und die Prüfsummen, die
`WORKFLOW.md` §5 und `PROGRESS.md` für den Mehrspieler nennen (`5ed264a0fea05076`,
`b2f6fef971bbfc1b`, `7aae49be9d989df8`), sind ab Stufe 4 **historische Messwerte ihres Commits**
und keine Vergleichswerte mehr. Sie werden nicht gelöscht: sie tragen ihr Datum.

**Status:** eine Reparatur eingebaut und belegt; Handschlag-Vorschlag offen (M18).

**Berichtigt am 2026-09-24 (Nacharbeit zu T-M17-03, adversarische Prüfung, selbst
nachgestellt):** Punkt 2 stimmt für die App nicht. `compareProbe` und `handshakeComplete`
haben außerhalb der Tests **keinen Aufrufer** (`git grep`); die App vergleicht in
`apps/desktop/src/net/party.ts` beim Gastgeber wie beim Gast mit `resumeDecision`, und die
fragt **zuerst** nach dem Startabdruck. Zwei Formatstufen haben zwangsläufig verschiedene —
gemessen aus derselben Partiedefinition: `b14b2dad229e92cb` (Stufe 4) gegen
`68736687aa40819d` (dieselbe Partie in der Form von Stufe 3). Die Entscheidung lautet
`transfer`, **auch in einer frischen Partie**: der Gastgeber schickt seinen Stand und beginnt.
Die Meldung „aus demselben Stand kommen zwei Ergebnisse" kann in diesem Fall nie erscheinen.
Je Richtung:

- **Gastgeber alt, Gast neu:** der Gast verwirft den Stand mit der Formatmeldung — die
  Reparatur aus Punkt 3 wirkt.
- **Gastgeber neu, Gast alt:** das alte `acceptState` (`8bda869`) prüft nur die Prüfsumme, und
  die stimmt (`stateHash` des Standes der Stufe 4 = angekündigter Startabdruck). Beide gehen auf
  „playing", und die Partie endet **nach dem Start** mit „auseinandergelaufen" — R-MP-06
  verlangt „vor dem ersten Zug".

Der Kommentar in `resume-save.test.ts` beschrieb den Fall verkehrt herum („der Gast hat einen
älteren Bau" ist gerade der Fall, den die Prüfung der Stufe **nicht** erreicht) und ist
berichtigt. Dieselbe falsche Annahme stand in `DECISIONS.md`, D29.12, `PROGRESS.md` und der
`dod` von T-M17-03 — alle fünf sind datiert berichtigt, nicht gelöscht. Die Begründung, die
Formatstufe nicht in den Handschlag zu nehmen („Nutzen klein, die Probe fängt es"), stützte sich
auf genau diese Annahme.

**Repariert am 2026-09-24:** `PROTOCOL_VERSION` 2. Eine neue Formatstufe ist eine neue
Protokollfassung, und den alten Bau erreicht nur eine Prüfung, die er schon kennt: die Fassung
im ersten `hallo`. `protocol.test.ts` führt die Paare Stufe → Fassung (3 → 1, 4 → 2) und fällt,
wenn jemand die Stufe hebt und die Fassung nicht; beide neuen Tests waren vor der Änderung rot.
Der Handschlag-Vorschlag ist damit erledigt und wandert **nicht** nach M18. Das Nichtwort
`Faende` in der Abbruchmeldung heißt jetzt „Fassungen des Spiels".

**Status:** erledigt am 2026-09-24 — `acceptState` prüft die Stufe (2026-09-18), die
Protokollfassung trennt die Bauten (2026-09-24).

**Nachtrag 2026-09-25 (T-M17-04), gemessen:** die Regelprüfsumme des Handschlags (`fingerprintOf(...).rulesHash` über die ausgelieferten Regeln) trennt seit T-M17-04 zwei Bauten vor und nach dieser Aufgabe schon am Handschlag mit „Verschiedene Regelwerke“ — das Fenster, in dem die Probe den falschen Grund nannte, ist damit zu; der Handschlag-Vorschlag bleibt für M18. Keine feste Zusage: `data/rules/default/constants.json` hat sich seither mehrfach weiterbewegt (T-M17-05, T-M17-07 ff.), jede Regelprüfsumme gilt nur für ihren eigenen Commit.

---

## 2026-09-18 · T-M17-03 · Befund M17-5: ein einziges Byte in `node_modules` legt `pnpm lint` lahm — und damit `pnpm verify`

**Befund:** `pnpm lint` bricht seit dem 2026-09-18, etwa 14:40, mit
`SyntaxError: Unexpected identifier 'createTextChangeRange'` ab, noch bevor eine einzige Datei
geprüft ist. Betroffen ist nicht dieses Projekt, sondern eine **Abhängigkeit**:
`node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/typescript.js`, Zeile 183 694.
Dort endet `createTextChangeFromStartLength: () => createTextChangeFromStartLength` mit einem
`$` statt mit einem Komma. **Ein Byte.** Drei Wächter, die ESLint programmatisch fahren
(`core-purity`, `import-boundaries`, `no-color-literals`, zusammen 10 Zusicherungen), fallen aus
demselben Grund.

**Belegt, nicht vermutet — der Speicher von pnpm beweist es selbst.** Jede Datei im
inhaltsadressierten Speicher trägt ihren sha512 als Dateinamen. Die Datei heißt
`…/files/01/ec6731435398…` — der Inhalt hashed aber auf `3ea65f7568fc2fde…`. Ersetzt man das eine
Byte wieder durch ein Komma, ergibt sich **exakt** `01ec67314353989306eb143d7b8d1da0…`, also der
Name, unter dem die Datei abgelegt ist. Die Reparatur ist damit keine Vermutung, sondern durch
den hinterlegten Hash bewiesen.

**Nicht durch M17 verursacht:** derselbe vollständige Testlauf war um 14:36 mit denselben drei
Wächtern grün, auf genau diesem Arbeitsbaum; der Ausgangslauf `pnpm verify` vom Morgen ebenso.
Zwischen beiden hat niemand `node_modules` angefasst. Ein einzelnes gekipptes Byte in einer
Datei, die seit dem 2026-09-02 unverändert ist, ist ein Zeichen für Platte oder Speicher — das
gehört in `99_Meta/Health & Risks.md` des Vaults, nicht nur hierher.

**Nicht repariert, und warum:** die Datei liegt **außerhalb** des Projekts
(`%LOCALAPPDATA%\pnpm\store\v11`) und ist von dort in jeden Arbeitsbaum hart verlinkt; der
Berechtigungs-Classifier verweigert das Schreiben zu Recht. `pnpm install --force` hilft nicht
(„Already up to date" — pnpm prüft beim Verlinken keine Inhalte). **Was hilft**, ist ein Befehl
von Noah:

```bash
# die eine beschädigte Datei aus dem Speicher werfen, dann neu holen
Remove-Item -LiteralPath "$env:LOCALAPPDATA\pnpm\store\v11\files\01\ec67314353989306eb143d7b8d1da050f66bbbb5b9830da5d6b88465d2c37821ddf31b36d18e7c81df6d5099bc0f06bf9e6e096e6ce623c993cc883d900ef1" -Force
Remove-Item -LiteralPath "node_modules\.pnpm\typescript@5.9.3" -Recurse -Force
pnpm install
pnpm lint   # muss wieder durchlaufen
```

**Was das für T-M17-03 heißt:** `pnpm verify` bricht im **ersten** Schritt ab (Lint), also vor
Typprüfung und Tests. Beide anderen Schritte sind einzeln gefahren und grün
(`pnpm typecheck` Exit 0; die Testreihe ohne die drei ESLint-Wächter Exit 0). Umgangen wird der
Wächter nicht: er ist rot, der Grund steht hier, und die Prüfkette gilt erst wieder als gefahren,
wenn die Datei heil ist.

**Status:** offen — braucht einen Befehl von Noah. Kein Projektfehler.

**Status am 2026-09-24:** **nicht mehr reproduzierbar.** Die Datei ist heil: ihr sha512 beginnt
mit `01ec67314353989306eb143d7b8d1da050f66bbb` und ist damit wieder genau ihr Name im Speicher
von pnpm; Zeile 183 694 endet mit dem Komma. Ihre Änderungszeit steht unverändert auf dem
2026-09-02 23:02, und sie hat heute 10 harte Links (am 2026-09-18 waren es 7 — dazugekommen
sind Arbeitsbäume, nicht Ersatzdateien): **die Datei wurde nie ersetzt**, das Rezept mit
`Remove-Item` ist hinfällig und wurde nicht gefahren. `pnpm verify` lief am 2026-09-24 auf
`522ebca` mit **Exit 0** (164 Dateien / 2464 Tests) und am Ende der Nacharbeit erneut. Ein Byte,
das kippt und ohne Schreibzugriff wieder stimmt, lag vermutlich nie auf der Platte, sondern im
Arbeitsspeicher oder im Seitencache — der Hinweis auf die Hardware bleibt deshalb in
`99_Meta/Health & Risks.md` des Vaults stehen. Erledigt, ohne Eingriff.

---

## 2026-09-24 · Nacharbeit T-M17-03 · Befund M17-6: Zusagen ohne Test — der eingefrorene Stand lief nie, und die Richtung war nirgends geprüft

**Anlass:** zwei unabhängige adversarische Prüfungen des M17-Fundaments (`522ebca`). Jeder
Befund ab „mittel" ist vor der Reparatur **selbst nachgestellt**, jeder Test war ohne seine
Reparatur rot oder fällt unter der Mutation, die er fangen soll.

**1. R-GAME-09/AK1 und AK2 waren behauptet, nicht gerechnet (Schwere hoch).** Der Lauftest im
Block „R-GAME-09/AK1 Ein Stand der Stufe 3 läuft nach der Migration weiter" deserialisierte
`copy(V2)` — einen Stand der **Stufe 2** mit zwei Mächten und einer Beziehung ohne Freigaben —
und rechnete ihn 48 Ticks auf `smallWorld`. `save-v3.json` wurde nirgends auch nur einen Tick
gerechnet (`git grep save-v3`: zwei Dateien, beide laden nur), `save-v1.json` nach der Kette
1 → 4 ebenso wenig. Die `dod` von T-M17-03 und `coverage:requirements` zählten R-GAME-09
trotzdem als belegt. Das Verhalten selbst stimmt — jetzt gemessen statt angenommen:
`migration-v3.test.ts` rechnet den eingefrorenen Stand 48 Ticks auf `data/maps/world.json` mit
den Standardregeln, hashgleich nach Speichern und Laden, und nach einer Unterbrechung dasselbe
wie ohne; AK2 rechnet `save-v1.json` und `save-v2.json`; `apps/headless/test/migrated-save.test.ts`
rechnet denselben Stand zwei Spieltage **mit KI** (der Kern darf die KI nicht kennen). Ohne
`3: toVersion4` fallen alle neuen Lauftests.

**2. „Alle Schreiber setzen beide Richtungen" hatte keinen Test (mittel).** Nachgestellt mit
sechs Mutationen **zugleich** — `setPassageBothWays` ohne die Hälfte `a`, die wirksame
Kriegserklärung ohne alle sechs Löschzeilen, `breakAlliance` ohne seine zwei Zeilen,
`acceptAlliance` ohne den Durchmarsch, dazu die beiden aus Punkt 3: **114 Testdateien / 1812
Tests** in `packages/core`, `packages/ai`, `packages/netplay`, `apps/headless` und
`apps/desktop` blieben grün. Die Golden-Master sehen es nicht, weil `tiny` und `walkthrough`
keine Freigaben haben. Genau diese Schreiber baut T-M17-04 um.

**3. Die Richtung der Sicht war nicht belegt (mittel).** `publicView` liest
`grantsPassage(state, other, playerId)` und `sharesMap(state, other, playerId)` — „der andere
gewährt mir". Vertauscht blieb alles grün (in der Messung von Punkt 2 enthalten). Die
Gegenprobe im Bericht von T-M17-03 galt `visibleProvinces`, nicht `relations`; `DECISIONS.md`
ist datiert berichtigt. Die KI liest genau diese Felder (`packages/ai/src/relationship.ts`,
`diplomacy.ts`) — dieselbe Fehlerklasse wie Befund B2.

**Repariert für 2 und 3:** `packages/core/src/state/relation-direction.test.ts`, 19 Tests. Jeder
Schreiber in **beiden Hälften** des Schlüssels mit allen sechs gerichteten Feldern, die Sicht
und die Überfallerkennung mit einseitig gesetztem Feld, dazu der Fristzweig von
`grantsPassage` bei Frist − 1 und Frist. Gegenprobe **einzeln**: zwölf Mutationen, jede fällt
(darunter eine, die die erste Fassung der Datei selbst übersah — `setPassageBothWays` ohne
`aPassageEndsAtTick = null` fällt erst, seit der Test mit gesetzter Frist beginnt).

**4. Die Vollständigkeitsprüfung war flach (niedrig).** Siehe `DECISIONS.md` 2026-09-24:
`espionage: {}` bestand und warf im ersten Tick; ein Stand der Stufe 4 mit den alten Schlüsseln
und gültiger Prüfsumme lud still, jeder Durchmarsch war danach weg. Repariert, beide Ladewege.

**5. Kleinigkeiten, mitgenommen:** der Klontest sah ein geteiltes `want.provinces` nicht
(jetzt ja; Gegenprobe fällt). Der Kopfkommentar des Ausgangswerts sagt T-M17-16, dass
`zustandOhneKi` über die Stufen roh nicht vergleichbar ist — nachgemessen: auf `eb27a4c`
entsteht der Bericht zeilengleich bis auf Datum, Commit und `4d58309111d9669f` statt
`10950ec5abffd9b7`. D29.1 und D29.3 tragen den Vermerk zu M17-3 jetzt im Entwurf selbst.

**6. Ein roter Zwischencommit (niedrig, nicht rückwirkend geändert).** Auf `a5636c9` fallen
`determinism.test.ts` und `walkthrough.test.ts`; erst `c6d192e` zieht die Golden-Master nach.
Die Hashes selbst sind richtig — aber Codeänderung und Erneuerung in zwei Commits stören
`git bisect`. **Regel für die Bahnen:** eine Änderung, die einen Golden-Master verschiebt, und
`UPDATE_GOLDEN=1` gehören in **denselben** Commit.

**Die Lehre:** ein Test im Block einer Anforderung ist kein Beleg für sie, wenn er einen anderen
Stand fährt; und eine Gegenprobe belegt nur die Stelle, die sie trifft. „Alle Schreiber" und
„die Sicht" waren zwei Sätze über viele Stellen, belegt durch Gegenproben an je einer.

**Status:** erledigt am 2026-09-24. Die Schreiber-Tests halten das Verhalten von T-M17-03 fest
(beide Richtungen); T-M17-04 stellt sie gezielt auf „nur die eigene Richtung" um.

---

## 2026-09-24 · T-M17-04 · Befund M17-D1: ein Überfall ließ die geteilte Karte im Krieg stehen — seit M6

**Befund:** Eine **wirksame Kriegserklärung** löschte Durchmarsch und Karte; ein **Überfall**
(`detectSurpriseAttacks`) setzte nur den Zustand auf Krieg und ließ beide Felder stehen. Mit dem
symmetrischen Feld bis Stufe 3 traf das den Durchmarsch nie — wer ihn hatte, konnte nicht
überfallen —, wohl aber die **Karte**: zwei Mächte, die ihre Karten teilten, sahen einander nach
einem Überfall den ganzen Krieg lang, obwohl `shareMap` im Krieg jede Freigabe verweigert. Mit
dem gerichteten Recht wäre es auch für den Durchmarsch erreichbar geworden: A gewährt B und
überfällt B, und As Gewährung lebte nach dem nächsten Frieden still wieder auf.

**Nachgesehen, nicht erinnert:** in `951d3e8` (M6, 2026-09-03), wo `detectSurpriseAttacks`
entstand, und in jeder späteren Fassung der Datei stehen `rightOfWay = false` und
`sharedMap = false` nur im Zweig der wirksamen Erklärung, nie im Überfall.

**Gemessen:** in keiner reinen KI-Partie tritt der Fall auf — die KI teilt nie eine Karte
(`m17-baseline`: `freigabenHoechstens` Durchmarsch 0, Karte 0, Bündnisse 0 über 200 Spieltage),
deshalb bewegen sich weder Golden-Master noch Turnier. Getroffen hat es nur Spieler, die eine
Karte freigegeben hatten.

**Status:** erledigt (2026-09-24, T-M17-04), zusammen mit dem Entscheid zu M17-3: `endTies()`
an beiden Stellen, an denen ein Krieg beginnt; ein Test fällt ohne die Zeile.

---

## 2026-09-24 · T-M17-04 · Befund M17-D2: der Erreichbarkeitswächter sah die Aktionen in `DIPLOMACY` nicht

**Befund:** `test/guards/ui-command-coverage.test.ts` prüft jeden **Kommandotyp** des Kerns und
jede **Haltung** gegen die Befehlsquellen der Oberfläche. `DIPLOMACY` ist *ein* Typ und steht in
`actions.ts` — also wäre jede neue diplomatische Aktion ohne Knopf grün geblieben. T-M17-04
brachte drei, keine hat einen Knopf (die Oberfläche ist T-M17-14).

**Gemessen:** mit leerer Ausnahmeliste meldet der erweiterte Wächter genau
`requestRightOfWay, acceptRightOfWay, revokeRightOfWay`; bekommt eine davon einen Knopf, während
ihre Ausnahme stehen bleibt, meldet er sie als veraltet.

**Status:** erledigt (2026-09-24, T-M17-04); die drei Ausnahmen stehen in
`DIPLOMATIE_NOCH_OHNE_KNOPF` (einer eigenen Ausnahmeliste desselben Wächters, nicht
`NICHT_FUER_DEN_SPIELER`) und verweisen auf T-M17-14.

---

## 2026-09-24 · T-M17-04 · Befund M17-D3: zwei Spielertexte versprachen eine Gegenseitigkeit, die es nicht mehr gibt

**Befund:** `diplomacy.sharedMap` hieß „Kartenaustausch", und `explain.diplomacy.sharedMap`
sagte „Beide sehen, was der andere sieht". Seit T-M17-04 ist die Freigabe gerichtet, und beide
Sätze sind falsch. `explain.diplomacy.rightOfWay` war richtig, sagte aber nicht, dass das Recht
nur in eine Richtung gilt — genau das, was B1 so lange verdeckt hat.

**Status:** in `de.ts` berichtigt (2026-09-24, T-M17-04): „Kartenfreigabe", die Erklärung der
Karte nennt die Richtung, die des Durchmarschs bekommt den Satz über die Gegenrichtung. **Offen
für T-M17-14:** `docs/ANLEITUNG.md` Zeile 284 zählt die Diplomatie noch als „… Bündnis,
Durchmarsch, Kartenaustausch" auf — die Anleitung schreibt T-M17-14 ohnehin neu (D29.9).

---

## 2026-09-25 · T-M17-05 · Befund M17-D4: eine Gegenprobe kann die Registrierung nicht isolieren, weil die Diplomatiephase sie über einen anderen Weg mitbringt

**Befund:** Eine Gegenprobe sollte `import './tradeOffer'` in `commands/handlers.ts`
auskommentieren und damit alle Handelsbefehle mit `UNKNOWN_COMMAND` scheitern lassen —
insbesondere sollte der Eigenschaftstest dann wieder leer grün werden. Er bleibt aber grün:
`tradeOffer.test.ts` importiert `phases/diplomacy.ts` direkt (für `diplomacyAt`), und diese
importiert `settleTradeOffers` aus `commands/tradeOffer.ts` — der Import allein löst die
`registerCommand(...)`-Aufrufe am Modulanfang aus, unabhängig vom Import in `handlers.ts`.

**Gemessen:** mit auskommentiertem Import in `handlers.ts` bleiben alle 52 Fälle in
`tradeOffer.test.ts` grün (statt wie erwartet fast alle rot).

**Einordnung:** kein Verhaltensfehler — `registerCommand` ist dieselbe Funktion über jeden
Importweg, und in der echten Anwendung importiert so gut wie jeder Einstiegspunkt auch die
Diplomatiephase. Der eigentliche Beleg gegen „leer grün" bleibt die Zählung der Ausgänge im
Eigenschaftstest, die unabhängig von diesem Importpfad funktioniert und in der Vorarbeit
tatsächlich versagt hatte.

**Status:** offen, ohne Meilenstein — eine Beobachtung für künftige Bauplan-Gegenproben, kein
Bau-Defekt.

---

## 2026-09-25 · T-M17-06 · Befund M17-D5: eine abgetretene Provinz kann eine fremde Armee auf dem Marsch zum Überfall machen

**Befund:** Eine dritte Macht, die mit Durchmarschrecht des Abtretenden auf die angebotene
Provinz zumarschiert, kommt nach der Abtretung im Land des Empfängers an —
`detectSurpriseAttacks` (`phases/diplomacy.ts`) macht daraus Krieg mit Ansehensverlust für die
marschierende Macht, die zum Zeitpunkt ihres Marschbefehls nichts falsch gemacht hat.

**Warum nicht geprüft:** Das Ziel eines fremden Marsches ist verborgene Information (R-DIP-04);
`cessionProblem` liest fremde `army.path`-Felder nicht — die Sicht (`publicView.ts`) zeigt fremde
Wege ohnehin nicht, und ein Kern-Check würde dem Abtretenden verraten, was er nicht wissen darf.

**Status:** entschieden hingenommen (`DECISIONS.md`, kippbar). Kandidat für die Messung in
T-M17-15 (Überfälle unmittelbar nach `PROVINCE_CEDED` zählen). Verwandte, ungeprüfte Beobachtung:
dieselbe Lage entsteht schon heute bei einem sofort wirksamen Bündnisbruch, wenn Armeen im Land
des anderen stehen — nicht geprüft, nur notiert.

**Gemessen:** Raster über 72 Aufstellungen (`tradeOffer.test.ts`, R-DIP-09/AK2); die Grenze der
dod-Zusage gilt für Armeen, die in der Provinz **stehen**, und für die eigenen **auf dem Weg** —
nicht für fremde Märsche.

---

## 2026-09-25 · Nacharbeit „kern" (T-M17-04/05/06) · Befund M17-D6: ein Handelsangebot mit unbekanntem Anbieter ließ den ersten Verfallslauf abstürzen

**Befund:** `settleTradeOffers` stuft ein Angebot mit einem `offer.from`, das keine bekannte
Macht ist, als `invalid` ein. `closeTradeOffer` griff dann unbedingt auf
`draft.players[offer.from]!.resources` zu — ein `TypeError`, sobald `offer.give.resources` einen
Betrag trug, und der Tick brach ab. Kein Befehl dieser Bahn kann das erzeugen; erreichbar ist es
nur über einen geladenen Spielstand — `validateState` prüfte `give`/`want` bisher nur als Objekt,
nicht `from`/`to` als bekannte Spielerkennungen.

**Gemessen:** vor der Reparatur `TypeError: Cannot read properties of undefined (reading
'resources')`, danach schließt das Angebot als `invalid`, ohne den Bestand des Empfängers zu
berühren.

**Status:** erledigt (2026-09-25, Nacharbeit „kern"). `closeTradeOffer` gibt die Treuhand nur
noch zurück, wenn der Anbieter existiert. Zusätzlich geschlossen bei der Zusammenführung
(2026-09-25): `validateState` prüft `give`/`want` seither je Element, siehe unten Befund M17-M3-
Nachbareintrag „`validateState` prüft Spione, Aufdeckungen und Handelsangebote je Element".

---

## 2026-09-25 · Nacharbeit „kern" (T-M17-04/05/06) · Befund M17-D7: der Spielertext zu einem hinfälligen Handelsangebot behauptete fälschlich ein Ausscheiden

**Befund:** Seit T-M17-06 schließt `settleTradeOffers` ein Angebot auch dann mit dem Grund
`invalid`, wenn eine Provinz nicht mehr abtretbar ist (`provincesLapsed`) — der Spielertext
(`diplomacy.tradeClosed.invalid`) sagte dafür unverändert „hinfällig, eine Macht ist
ausgeschieden".

**Status:** erledigt (2026-09-25, Nacharbeit „kern"). `de.ts` nennt jetzt beide möglichen
Ursachen. **Offen, nicht repariert (Sekundärbefund):** der Zusatz „— das Hinterlegte geht
zurück" steht bei allen fünf Verfallsgründen fest im Text, auch wenn ein Angebot nur Provinzen
trug — eine Reparatur bräuchte ein neues Feld am Ereignis und eine Entscheidung gegen die
bewusste Zusage „ohne Mengen" (D29.5). Kandidat für T-M17-14.

---

## 2026-09-25 · Nacharbeit „kern" · Beobachtung: eine Provinzabtretung kann den verborgenen Weg des Anbieters verraten, aktiv und passiv

**Befund:** `ACCEPT_TRADE.check` prüft die gebende Seite mit Tiefe `full` (auch
`army.path.includes(provinceId)`). Liegt im selben Befehlsschub ein `MOVE_ARMY` des Anbieters vor
dem `ACCEPT_TRADE`, bekommt der Annehmende `COMMAND_REJECTED` mit `{reason: 'eigene Armeen'}` —
das verrät ihm, dass der Anbieter dort etwas bewegt, ohne dass die Sicht das je zeigen würde.
Derselbe Leak entsteht **passiv**, ohne dass `ACCEPT_TRADE` je versucht wird: `settleTradeOffers`
prüft die gebende Seite mit Tiefe `full` in **jeder** Diplomatiephase, und ein
`TRADE_OFFER_CLOSED{reason:'invalid'}` ohne öffentliche Ursache verrät dasselbe, nur einen Tick
später.

**Warum nicht repariert:** Eine saubere Lösung braucht entweder eine zweite, redaktionsärmere
Rückmeldung für genau diesen Prüfschritt oder eine neue `CommandResult`-Form — beides eine
Design-Entscheidung, keine Zweizeiler-Reparatur.

**Status:** offen. Kandidat für T-M17-14 (Oberfläche Handel), wo die Sperrtexte ohnehin
entstehen.

**Statusnachtrag 2026-09-25 (T-M17-14, E1):** Oberfläche geschlossen — der Annehmen-Knopf nennt
für die gebende Seite nur noch „das Angebot verfällt" (`trade.blocked.lapsing`), nie Provinz oder
Ursache (Test A7, Kontrolle über `canApply`). **Offen im Kern:** `COMMAND_REJECTED.detail` und
`canApply` tragen den Grund weiterhin mit `provinceId` — erreichbar für KI und Skript, nicht für
den Spieler über die Oberfläche. Kandidat M18.

---

## 2026-09-25 · Nacharbeit „kern" · Beobachtung: `outgoingOffers` fehlte für den eigenen Durchmarsch-Antrag — erledigt durch die Spionagebahn

**Befund:** `publicView()` führte nur `incomingOffers`. Ein eigener `requestRightOfWay` stand in
keiner Sicht des Antragstellers.

**Status:** erledigt durch die Spionagebahn (Befund M17-S5, T-M17-12): `outgoingOffers` deckt
auch einen eigenen `requestRightOfWay`-Antrag ab (`kind: 'rightOfWay'`); T-M17-10/14 brauchen
dafür kein eigenes Feld.

---

## 2026-09-25 · T-M17-10 · Befund M17-D8: der Handelsaufschlag der KI weicht vom Entwurfstext ab

**Befund:** D29.8 nennt für den Handelsaufschlag „× 1,02"; der S1-Schnitt (vor T-M17-10)
implementierte `tradeOfferPremiumPermille: 1060` (× 1,06).

**Status:** entschieden, gebaut wie entschieden (`DECISIONS.md`); der Entwurfstext D29.8 ist
datiert berichtigt auf `tradeOfferPremiumPermille` ‰ (1060).

---

## 2026-09-25 · T-M17-10 · Befund M17-D9: das Turnierband „schwer gegen normal, im Frieden" fällt von 70 % auf 50 %

**Befund (ursprünglich, 2026-09-25):** 0 von 25 Paaren entschieden, 0 Kriegserklärungen über 50
Partien à 40 Spieltage. Als Ursache **angenommen**:
`packages/ai/src/diplomacy.ts::landNeighbours` verlange eine direkte Landkante zwischen eigenen
und fremden Provinzen; Nordland (n1–n3) und Ostmark (o1–o3) — die ersten beiden Startpositionen
der Testwelt — grenzten nicht direkt aneinander (dazwischen liegen die herrenlosen m1/m2). Die
bisherige 70-%-Quote komme vollständig aus B6 (ungeprüftes Marschieren löste `WAR_DECLARED` ohne
Erklärung aus). Bauplan-Stellschraube `tradeImpactPermille` 30→50 versucht, keine Wirkung.

**Berichtigt (Nacharbeit ki, 2026-09-25): diese Ursache ist WIDERLEGT.** `m1` grenzt tatsächlich
an `n2` (Nordlands eigene Provinz, Kante `n2-m1` in `testworld.json`). Eigene Messung (3 Seeds,
Frieden-Start, 40 Spieltage, jetzt als Test in `apps/headless/test/tournament.test.ts`
festgehalten): `m1` **und** `m2` gehören am Ende in allen drei (und in einem weiteren
Wegwerflauf über 8 Seeds) Partien durchgehend Ostmark — `landNeighbours(p1)` enthält `p2` damit
ab dem Moment, in dem Ostmark `m1` erobert, und das geschieht in jeder gemessenen Partie.
Trotzdem bleiben `warDeclarations` und `grievances` bei null. Die tatsächliche Ursache:
`relationship()` braucht `borderThreat` (Truppen an der Grenze) oder `grievance` (Verstimmung
durch Überfälle, B6), um unter die Kriegsschwelle zu fallen; ohne B6-Überfälle (seit T-M17-10
behoben) entstehen keine Verstimmungen, und ob genug Truppen genug lange an einer frisch
eroberten Grenze stehen, ist auf der kleinen Testwelt binnen 40 Tagen offenbar nicht der Fall.

**Status:** offen. Zugewiesen an T-M17-15/16 mit der **richtigen** Stoßrichtung: nicht
`landNeighbours` erweitern (das ändert nichts, wie gemessen), sondern `borderThreat`/die
Zeitachse der Grenzbildung untersuchen. Bei der Zusammenführung mit Bahn B (Befund M17-M2) auf
zwei Ursachen zerlegt: die B6-Sperre selbst hält 50 % im Frieden, die KI-Spionage (T-M17-12)
zieht das Band im Krieg auf 98 %.

---

## 2026-09-25 · T-M17-10 · Befund M17-D10: ein Heimmarsch nach gekündigtem Durchmarschrecht kann länger dauern als die Kündigungsfrist

**Befund:** Gemessen an m1→n2 (160.000 km, Infanterie, kein Eisenbahn-/Gebietsbonus): der
Heimweg dauert rund 27 Ticks, `rightOfWayNoticeTicks` beträgt nur 24. Die KI reagiert sofort
(zieht in die nächste eigene Provinz, sobald das Recht gekündigt ist), der Kern meldet trotzdem
einen Überfall ohne Erklärung.

**Hinweis (Nacharbeit „kern", Runde 2):** obwohl `rightOfWayNoticeTicks` und
`detectSurpriseAttacks` beide in T-M17-04 entstehen, wurde der Befund erst in T-M17-10 sichtbar —
ein Mensch reagiert selten binnen eines Ticks, die KI tut es. Er gehört inhaltlich zu T-M17-04.

**Status:** offen. Zwei Richtungen zur Wahl, nicht entschieden (kippbar, Messung erst
T-M17-15/16): (a) eine Armee, deren Pfad beim Fristende schon aus dem Land des Gewährenden
hinausführt, gilt in `detectSurpriseAttacks` nicht als Überfall; (b) die Frist wird aus der
längsten Landkante oder der Marschzeit abgeleitet statt geschätzt — nicht einfach angehoben,
ohne zu messen.

*(Anmerkung: dieser Befund trug in einer Zwischenfassung dieselbe Nummer wie Befund M17-D5
— siehe dort. Umnummeriert von der Nacharbeit „kern", Runde 2, auf `M17-D10`, die nächste freie
Nummer.)*

---

## 2026-09-25 · T-M17-10 · Befund M17-D11: die KI handelte und kriegte im selben Zug

**Befund:** Die KI nahm ein Handelsangebot an oder bot an, im selben Zug, in dem sie derselben
Macht den Krieg erklärte (`declareWar` setzt `warEffectiveAtTick` sofort, der Handel prüfte nur
die Sicht vom Zugbeginn).

**Status:** erledigt (T-M17-11, Commit `b091e8b`, vor der Zusammenführung bereits im S1-Schnitt
gemessen): `warDeclaredThisTurn` sperrt Antwort und Partnerwahl für die Ziele eigener
Kriegserklärungen dieses Zugs zuerst.

---

## 2026-09-25 · T-M17-11 · Befund M17-D12: Provinzwert und Handelsobergrenzen passen nicht zusammen

**Befund:** Bei 60 Tagen Horizont ist eine mittlere Provinz im zweistelligen Millionenbereich
wert (Bauplan-Messung: Median 9,6 Mio. Geld), ein Angebot trägt höchstens 1,88 Mio. — die KI
verkauft praktisch keine Provinz, kauft aber sehr viele einem Menschen ab.

**Status:** offen für T-M17-16 (Kandidaten 5–10 Tage Horizont). Nicht in T-M17-11 geändert. Die
Formel selbst ist am laufenden Code nachvollzogen (W1–W9 reproduzieren die vorgerechneten
Zahlen exakt), die Weltkarten-Messung selbst wurde nicht wiederholt.

---

## 2026-09-25 · T-M17-11 · Befund M17-D13: die Gegenprobe zur Annahmegrenze (inklusiv/exklusiv) unterscheidet mit den gewählten Testzahlen nicht

**Befund:** `ask = Math.ceil((wert × 1300) / 1_000_000)` rundet grundsätzlich auf, und der
Vergleich läuft in gröberen Einheiten (Vielfache von 1.000.000) als die Provinzwert-Formel
(Vielfache von 1) — die Annahmegrenze `E` landet dadurch nie exakt auf `G`, sondern immer echt
darüber. Ob `<` oder `<=` geprüft wird, ist mit den Zahlen dieser Testwelt beobachtungsgleich.

**Status:** offen, kein Fehler — nur eine Lücke in der Probe. Wer die Grenze künftig als eigenen
Test führen will, braucht eine Aufstellung, in der `E` und `G` exakt zusammenfallen (z. B. eine
reine Geldprovinz ohne Rohstoffanteile). Ein zweiter, unabhängiger adversarischer Prüfer
bestätigte dieselbe Diagnose, ohne eine neue Testaufstellung zu schließen.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Befund M17-D14: ein Durchmarschantrag im selben Zug wie die eigene Kriegserklärung

**Befund:** `requestPassage` prüfte `view.relations[owner]` — eine Momentaufnahme vom
Zugbeginn — und kannte eine eigene `declareWar` **derselben** Strategiestufe nicht: `p1`
beantragte im selben `decide()`-Aufruf einen Durchmarsch bei genau der Macht, der
`diplomacyCommands` eben den Krieg erklärt hatte — der Kern lehnte den zweiten Befehl beim
Anwenden mit `INVALID_TARGET`/`Kriegserklärung läuft` ab.

**Status:** erledigt (Nacharbeit ki, 2026-09-25). `requestPassage` bekommt `pending` und prüft
`warDeclaredThisTurn(context, pending)` (wiederverwendet aus `provinceValue.ts`, dieselbe
Präzedenz wie bei M17-D11). Test rot ohne die Prüfung, grün mit ihr, Gegenprobe gefahren.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Befund M17-D15: der AK4-Test für Durchmarsch prüfte `alternative` nicht

**Befund:** Der Testtitel und R-AI-09/AK4 verlangen sowohl `reason` als auch `alternative` in
jeder Begründung — der Test prüfte nur `explanation.reason`.

**Status:** erledigt (Nacharbeit ki, 2026-09-25). Reiner Testlücken-Befund: alle zehn
Durchmarsch-Erklärungen in `passage.ts` hatten `alternative` bereits gesetzt (Gegenprobe: Feld
aus der Erfolgs-Erklärung entfernt → Test wird rot; wieder eingesetzt → grün) — kein
Produktcode geändert außer der Testzeile selbst.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Befund M17-D16: `neighbourMine` im Kauf-Zweig der KI war ungetestet

**Befund:** `neighbourMine` (`provinceValue.ts`, Kauf-Zweig von `provinceOfferCommands`) war
ungetestet — ein Mutationslauf (Filter entfernt) blieb bei 46/46 Fällen grün.

**Status:** erledigt (Nacharbeit ki, 2026-09-25). Test ergänzt: Ostmarks einziger Landnachbar von
Süden neutral gesetzt, eine eigene Armee ohne echten Landnachbarn positioniert — mit dem Filter
bleibt `commands` leer, ohne ihn (Gegenprobe) kauft die KI eine Provinz ohne Landnachbarn.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Befund M17-D17: die Ablehnung wegen `cessionProblem` nannte den errechneten Wert nicht

**Befund:** Die Ablehnung einer Provinzabtretung wegen `cessionProblem` (z. B. „s1: Hauptstadt")
nannte nie den errechneten Wert, obwohl `provinceTexts` im selben Durchlauf direkt danach
ohnehin berechnet wird — R-DIP-09/AK3 verlangt „Wert und größten Anteil" für jede Bewertung.

**Status:** erledigt (Nacharbeit ki, 2026-09-25). `reason` wird bei einem Sperrgrund erst nach
`provinceTexts` zusammengesetzt (`${cessionReason}; ${provinceTexts}`). Test rot ohne die
Änderung, grün mit ihr, Gegenprobe gefahren.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Beobachtung, offen: `predictLandPath` ignoriert Seewege

**Befund:** Bei einem `null`-Weg oder einer seefähigen Armee marschiert `military.ts` ungeprüft,
obwohl der Kern auch Seewege plant (`canUseSea`). Aufgefangen wird das erst beim nächsten
Taktiktakt durch die Sicherung für marschierende Armeen — bei „leicht" bis zu ein Vierteltag
ungeprüfter Marsch.

**Status:** offen, nicht in Minuten zu beheben (braucht eine Sichtnachbildung von `canUseSea`).
Kandidat für T-M17-15 oder eine eigene Aufgabe.

---

## 2026-09-25 · Nacharbeit ki (T-M17-10/11) · Beobachtung, offen: die Kaufsuche der KI ist O(P²) je Aufruf

**Befund:** `provinceOfferCommands` rechnet für jede sichtbare Provinz `relationship()` neu und
`mapLandNeighbours(...)` mit linearer Suche, dazu zwei `provinceWorth`-Aufrufe je Nachbar. Nur
jeden dritten Spieltag (Spitzenlast, keine Dauerlast) — mit den ausgelieferten Zahlen kauft die
KI ohnehin praktisch nie (siehe M17-D12), also aktuell folgenlos.

**Status:** offen, Kandidat T-M17-15. Ein Provinz-Index (Map) und ein Relationship-Cache je
Aufruf wären die Reparatur.

---

## 2026-09-24 · T-M17-07 · Befund M17-S1: die eigene Kennungsfolge verrät, wie viele Spione andere angeworben haben

**Befund:** Spione bekommen ihre Kennung aus **einem** Zähler für alle Mächte
(`s${nextIds.spy++}`). Die eigenen Kennungen stehen in der Sicht
(`PublicView.espionage.spies[].id`) — die **Lücke** zwischen zwei eigenen Kennungen ist die
Zahl der Anwerbungen aller anderen dazwischen.

**Gemessen** (Wegwerflauf, Testwelt, drei Mächte, nicht committet): p1 wirbt an, p3 wirbt
zweimal an, p1 wirbt wieder an — p1 sieht in seiner Sicht `s1,s4` und weiß damit, dass fremde
Mächte in der Zwischenzeit **zwei** Spione angeworben haben.

**Einordnung:** klein. Dieselbe Bauart haben Armeen (`a${n}`) und Aufträge (`o${n}`) seit M3/M4.
Die schärfere Form — die **lebenden** fremden Spione abzählen, indem man fremde Kennungen
durchprobiert — ist in T-M17-07 geschlossen (ein fremder Spion wird abgelehnt wie ein
fehlender). `SPY_DETECTED` trägt seit T-M17-09 ebenfalls keine Spionkennung, um diese Lücke
nicht zu verschärfen — **schließt sie aber nicht**.

**Warum nicht repariert:** ein Zähler je Macht ist eine Zustandsänderung (`nextIds.spy` würde
ein Record), also eine neue Formatstufe — in M17 ausgeschlossen. Ein Umweg ohne
Zustandsänderung (Kennung aus Besitzer, Tick und laufender Nummer) vergäbe nach einem Entlassen
im selben Tick eine Kennung doppelt.

**Vorschlag:** M18-Sammelstelle — `nextIds.spy` je Macht, oder die Kennung durch eine
Vertauschung aus dem Zähler ableiten. Bis dahin: die Oberfläche (T-M17-13) zeigt keine
Kennungen, sondern eine eigene Nummerierung, und die KI (T-M17-12) liest aus Kennungen nichts
ab — bestätigt (`text-keys.test.ts` prüft `\bs\d+\b` gegen jede KI-Begründung).

**Status:** gemessen, offen für M18.

---

## 2026-09-25 · Nacharbeit „kern" (T-M17-07/08/09) · Befund M17-S2 (kritisch, behoben): Prototyp-Schlüssel als Provinz akzeptiert

**Befund:** `state.provinces[provinceId]` und `state.players[playerId]?.intel[provinceId]` sind
Zugriffe auf ein einfaches Objekt ohne `Object.hasOwn`-Prüfung. Mit `provinceId: 'constructor'`
(ebenso `'__proto__'`, `'toString'`, `'hasOwnProperty'`) liefert das den
Object.prototype-Eintrag zurück — truthy, `owner: undefined`.

**Gemessen (vor der Reparatur):** `canApply` für `RECRUIT_SPY {provinceId:'constructor', …}`
ergab `{ok:true}` bei allen vier Schlüsseln und allen vier Aufträgen. `step()` legte den Spion im
Zustand an, ohne `COMMAND_REJECTED`. Ein anschließender Tageswechsel stürzte in
`capitalPenalty` mit `TypeError` ab — jeder Ladeversuch des Standes wiederholte den Absturz.

**Reparatur:** `Object.hasOwn(state.provinces, provinceId)` in `checkTarget`, ebenso für
`intel` in `knownOwner` (`commands/espionage.ts`). Test zuerst (13 Fälle: alle vier Schlüssel ×
alle Aufträge × RECRUIT/REASSIGN, dazu ein `step()`-Fall), rot bestätigt ohne die Reparatur,
grün danach. Commit `4286842`.

**Status:** behoben.

---

## 2026-09-25 · Nacharbeit „kern" (T-M17-07/08/09) · Befund M17-S3 (mittel, behoben): ausgeschiedene Macht sabotiert weiter

**Befund:** `settleEspionage` prüfte `players[spy.owner].alive` nicht. `registry.ts` lehnt jeden
Befehl einer ausgeschiedenen Macht ab (`PLAYER_ELIMINATED`), sie kann ihre Spione also nicht
mehr entlassen.

**Gemessen (vor der Reparatur):** `p1.alive = false`, ein Wirtschaftssaboteur von p1 auf einer
fremden Provinz — `settleEspionage` zog weiter Sold vom Geld des Toten ab, würfelte die
Sabotage, senkte die Moral des Opfers und verbrauchte Zufall.

**Reparatur:** die Spione nicht lebender Besitzer werden in `settleEspionage` vor Schritt (b)
entfernt — kein Sold, kein Zufallszug, kein Ereignis. Test zuerst, Gegenprobe gefahren, Commit
`ef8d27b`.

**Status:** behoben.

---

## 2026-09-25 · Nacharbeit „kern", zweite Runde (T-M17-07/08/09) · Befund (mittel, behoben): Spionagesold fehlte in der Wirtschaftsübersicht (R-ECON-06)

**Befund:** `economyOverview` (`view/economy.ts`) summierte `armyUpkeep` als `consumption`, nie
`spySalary`. `phases/espionage.ts` bucht den Sold direkt vom Bestand ab — eine laufende Rate wie
der Armeeunterhalt.

**Gemessen:** ein Spieler mit einem Aufklärer (Sold 10153) zeigte `consumption`/`balance`
unverändert gegenüber demselben Zustand ohne den Spion — die Bilanz war um genau den Sold zu
hoch.

**Reparatur:** die Summe von `spySalary(...)` über alle eigenen Spione geht direkt in `eaten`
(nicht in `consumption`, das mit `ticksPerDay` hochgerechnet wird — der Sold steht schon als
Tagesbetrag da). Nur für `money`, nur für eigene Spione.

**Status:** behoben.

---

## 2026-09-25 · T-M17-12 · Befund M17-S4 (offen): Turnierband kippt unabhängig von `grievanceOnSpyDetected`

**Befund:** Mit der KI-Spionage riss das Turnierband „schwer gegen normal, im Frieden"
(R-AI-06, Zusicherung 0,55–0,95) von **70 %** (ohne Spionage) auf **100 %** (mit Spionage,
`grievanceOnSpyDetected` 300). D29.12 nennt als vermutete Ursache eine „Verstimmungsspirale".

**Gemessen (Leiter D29.12, je Stufe Turnier und `progress.slow.test.ts` neu gefahren):** bei
300, 200 und 150 (Boden der Leiter) ergeben sich **exakt dieselben** Turnierzahlen, auf die
Partie genau (100 %, 25-0-0, 78 Kriegserklärungen, 28 Friedensschlüsse). Eine Zahl, die das
Ergebnis nicht messbar verändert, ist nicht die Ursache — die vermutete Verstimmungsspirale
erklärt den Rückgang in diesem Turnieraufbau nicht.

**Naheliegendste Alternativerklärung (nicht weiter verfolgt):** „schwer" hat im Turnier die
größere Wirtschaft und damit ein höheres `espionageBudget`; Gegenspion und Aufklärer sind für
sie darum früher und zuverlässiger finanzierbar als für „normal" — ein allgemeiner Vorteil aus
der Existenz der Spionage, nicht aus einer bestimmten Verstimmungszahl.

**Zweite, unabhängig gemessene Teilursache (Nacharbeit T-M17-12, durch Code-Lesen bestätigt):**
Anwerben (`bound() + salary > budget`) und Entlassen (`salaries <= budget`) vergleichen denselben
`budget`-Wert **ohne Abstand** in beide Richtungen — ein Spion, der genau noch ins Budget passt,
fällt am nächsten Tag bei einem winzigen Ertragsrückgang sofort wieder heraus (Anwerbepreis
verloren). Dieselbe Symmetrie ohne Hysterese gilt für `espionageCounterGrievance` beim
Gegenspion. Erklärt vermutlich einen Teil des Turnierrisses, nicht zwingend den ganzen.

**Zweite Nacharbeit ki (2026-09-25), zwei weitere Kontrollmessungen:**
`espionageBudgetPermille` auf 0 hält das Band ein (deckt sich mit 0,70); `grievanceOnSpyDetected`
auf 0 ändert nichts (weiterhin 1,00) — die Verstimmung ist also ein zweites Mal ausgeschlossen.
Nach dem Fix zu Befund M17-S8 (Gegenspion hält im Krieg länger durch) bewegt sich die Zahl auf
**0,98** — näher an der Schranke, aber weiterhin gerissen; der Fix selbst ist also keine
Ursache, höchstens ein kleiner Faktor.

**Entscheidung:** `grievanceOnSpyDetected` bleibt bei **300**. Die Leiter zu senken, ohne dass es
das Turnierergebnis bewegt, wäre „eine Grenze anheben, bis eine Zahl passt" — nur in die andere
Richtung, ebenso ein Fehler. Eine Hysterese zwischen Anwerben und Entlassen wäre eine neue Regel
mit einem neuen, zu schätzenden Toleranzwert — eine Entscheidung für Noah, keine, die eine
Nacharbeit ungefragt einbaut.

**Status:** weiterhin offen, durch zwei Nacharbeit-Runden präzisiert, nicht geschlossen. Bei der
Zusammenführung mit Bahn A (Befund M17-M2) auf zwei Ursachen zerlegt: die B6-Sperre der
Diplomatiebahn hält das Frieden-Band bei 50 %, diese Aufgabe zieht das Kriegs-Band auf 98 %.
Kandidat für T-M17-15 oder eine eigene, von Noah beauftragte Untersuchung.

*(Anmerkung: eine frühere Fassung dieses Befunds behauptete anhand eines Weltkarten-Wegwerflaufs
„weniger Kriege mit Spionage" — falsch, die eigenen Zahlen zeigten **mehr** (20 gegen 15
Kriegserklärungen, 11 gegen 7 Waffenstillstände). Der Wegwerflauf ist ohnehin kein Gegenbeleg zur
Budget-Vermutung, da acht gleichrangige Mächte nicht mit dem 2-Spieler-Turnier vergleichbar sind
— hier als Beleg ersatzlos gestrichen, nicht berichtigt.)*

---

## 2026-09-25 · T-M17-12, Nacharbeit ki · Befund M17-S5: `publicView.ts` fehlte ein drittes Feld für eigene diplomatische Angebote — erledigt

**Befund:** Der bestehende Merge-Hinweis zwischen den Bahnen nannte nur zwei neue Felder in
`publicView.ts` (`tradeOffers`, `espionage`); ein drittes, `outgoingOffers` (eigene offene
Angebote jeder Art — Frieden, Bündnis, Durchmarschantrag), war unvollständig dokumentiert.

**Status:** erledigt. `outgoingOffers` ist gebaut (T-M17-12, Entscheid E-NA1) und deckt auch die
frühere Beobachtung „eigener Durchmarsch-Antrag fehlt in der Sicht" ab.

---

## 2026-09-25 · Nacharbeit kern, zweite Runde (T-M17-07/08/09) · Befund M17-S7 (behoben bei der Zusammenführung): `validateState` prüfte Spionagefelder nur als Array

**Befund:** `persistence/validate.ts` (Hauptzweig) prüfte `espionage.spies`/`.reveals` nur als
Array, nicht je Element (anders als `diplomacy.tradeOffers` seit dessen Nacharbeit).
`phases/espionage.ts` liest seit T-M17-08/09 `players[spy.owner]!.resources` und
`provinces[spy.provinceId]!` ungeprüft. Ein geladener Stand mit einem defekten Spion bestand die
Prüfung und stürzte beim ersten Tageswechsel ab.

**Status:** erledigt bei der Zusammenführung der Bahnen (2026-09-25, Commit `b793a0f`) —
`validateState` prüft Spione, Aufdeckungen und Handelsangebote seither je Element (siehe den
Eintrag „Zusammenführung Bahn A und B").

---

## 2026-09-25 · Zweite Nacharbeit ki (T-M17-12) · Befund M17-S8 (hoch, behoben): der Gegenspion wurde durch ein eigenes, unbeantwortetes Friedensangebot fälschlich entlassen

**Befund:** `peaceBound()` nahm seit der ersten Nacharbeit ki jede Macht mit einem offenen
**eigenen** Friedensangebot aus der Kriegsgegner-Menge heraus — auch für den Gegenspion. Ein
Angebot ist ein Antrag, kein Kriegsende: `relations[x].state` blieb `'war'`, die Gegenseite
konnte weiter spionieren, die KI entließ ihren Gegenspion trotzdem mit der falschen Begründung
„Krieg und Verstimmung vorbei".

**Gemessen (Prüfer, Codeursache selbst bestätigt):** 41 von 41 solcher Entlassungen fielen in
einen tatsächlich laufenden Krieg.

**Status:** behoben. Ein getrennter `warEnemies`-Satz (echter Beziehungsstatus) trägt
`counterReason`; die um `peaceBound` verminderte Menge (`enemies`) bleibt für
Aufklärung/Sabotage bestehen. Drei bestehende Tests korrigiert, eine vierte, neue Gegenprobe
hält echtes Kriegsende als weiterhin entlassenden Fall fest.

---

## 2026-09-25 · Zweite Nacharbeit ki (T-M17-12) · Befund M17-S9 (mittel, behoben): bei Hauptstadtverlust wurde der Gegenspion entlassen statt umgesetzt

**Befund:** `home` las nur `view.self.capitalProvinceId` — das `SET_CAPITAL` desselben
Strategietakts (`capitalCommands` läuft in `decide.ts` davor) trug die Sicht erst am nächsten
Tag nach. Der Gegenspion wurde entlassen statt in die neue Hauptstadt umgesetzt, am nächsten Tag
für den vollen Anwerbepreis neu angeworben.

**Status:** behoben. `capitalIdFrom()` liest `earlier` für ein `SET_CAPITAL`, wie
`moneyCommittedBy` es für `BUILD` schon tut.

---

## 2026-09-25 · Zweite Nacharbeit ki (T-M17-12) · Befund M17-S12 (niedrig, offen für T-M17-15): `recruitCommands` bucht kein `RECRUIT_SPY` desselben Takts vor

**Befund:** `decide.ts` führt `espionageCommands` im Strategieblock aus (`RECRUIT_SPY` zieht
`spyRecruitCost` vom Konto ab), `recruitCommands` (`packages/ai/src/economy.ts`) erst danach im
Operativblock — aber `recruitCommands` bekommt kein `earlier` und liest
`context.view.self.resources[key]` direkt, ohne das schon geplante `RECRUIT_SPY` abzuziehen.

**Warum nicht repariert:** `moneyCommittedBy` und `capitalIdFrom` lösen dasselbe Muster für
`BUILD` bzw. `SET_CAPITAL` mit einem einzigen Geldbetrag — `recruitCommands` rechnet dagegen je
Ressource einen eigenen, gestaffelten Budgetrahmen in einer Schleife; ein sauberer Fix bräuchte
eine eigene, ressourcenweise „schon gebucht"-Karte.

**Status:** durch Code-Lesen bestätigt, ungemessen, offen für T-M17-15.

---

## 2026-09-25 · T-M17-09 · Befund B7 (2026-09-13), erste Hälfte eingelöst

**Nachtrag zu B7:** die erste Hälfte (enttarnte Spione tragen keine diplomatische Folge) ist mit
T-M17-09 eingelöst — `SPY_DETECTED` trägt eine Verstimmung des Entdeckers gegen den Urheber
(`grievanceOnSpyDetected` 300, über das vorhandene `addGrievance`) und einen Ansehensverlust
(`spyDetectedReputationLoss` 100, doppelt bei Sabotage ohne Krieg). Die **zweite** Hälfte
(gebrochene Bündnisse) bleibt weiter offen, ohne zugewiesenen Meilenstein.

**Beobachtung, kein Befund:** Dritte sehen das öffentliche Ansehen des Urhebers sinken, wenn
sein Spion enttarnt wird — R-SPY-05 verlangt den Verlust ausdrücklich, und Ansehen ist seit M6
ein öffentliches Feld (derselbe Mechanismus wie beim Überfall), ohne dass Dritte erfahren, wen
genau er ausspioniert hat.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · Befund M17-M1: liegengebliebene Arbeitskopien im Hauptordner brachen `pnpm typecheck` (behoben)

**Befund:** Im Wurzelordner des Hauptordners lagen zwei nicht versionierte Dateien,
`espionage.orig.ts` und `pv.orig.ts` — dem Inhalt nach Originalkopien von
`packages/ai/src/espionage.ts` und `packages/core/src/view/publicView.ts`, zeitlich passend zu
den Nacharbeiten der Bahnen. `pnpm typecheck` erfasst sie mit, und `pv.orig.ts` warf Fehler
(TS2307 für die relativen Importe, dazu eine Reihe TS7006) — Exit 2. Der Arbeitsbaum galt dem
Auftrag als „sauber", weil `git status` sie nur als `??` führt.

**Reparatur:** nicht gelöscht, sondern in den Scratchpad verschoben; danach `pnpm typecheck`
Exit 0.

**Lehre:** Arbeitskopien gehören in den Scratchpad, nie in den Repo-Wurzelordner — und
„Arbeitsbaum sauber" heißt `git status --short` **leer**, nicht „keine geänderten Dateien".

**Status:** behoben.

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · Befund M17-M2: Turnierband R-AI-06 am gemeinsamen Stand gerissen, Ursache sauber zerlegt

**Befund:** Turnier (`tournament.slow.test.ts`, je 50 Partien, 40 Spieltage) am gemeinsamen
Stand und in vier Wegwerf-Kontrollen (nichts davon committet):

| Stand | schwer–leicht (Krieg) | schwer–normal (Frieden) | schwer–normal (Krieg) | Kriegserklärungen normal/schwer |
|---|---|---|---|---|
| gemeinsam | 25:0:0 = 100 % | 0:0:25 = **50 %**, 0 Kriege, 0 Frieden | 24:0:1 = 98 %, 0 Kriege, 47 Frieden | 0 / 0 |
| KI-Spionage aus (`espionageBudgetPermille` 0) | 100 % | 50 %, 0 / 0 | 98 %, 0 Kriege, 27 Frieden | 0 / 0 |
| KI-Handel/Durchmarsch aus (Einhängepunkte in `decide.ts` auskommentiert) | 100 % | 50 %, 0 / 0 | 98 %, 0 Kriege, 47 Frieden | 0 / 0 |
| Wegprüfung B6 aus (`firstBlock` in `passage.ts` gibt immer `null`) | 100 % | 24:0:1 = **98 %**, 77 Kriege, 27 Frieden | 22:0:3 = 94 %, 72 / 72 | 88 / 61 |
| Wegprüfung B6 aus **und** KI-Spionage aus | 100 % | 10:0:15 = **70 %**, 145 / 96 | 100 %, 34 / 34 | 109 / 70 |

Die letzte Zeile ist **zeichengleich** mit dem Stand vor beiden Bahnen. Damit ist der Ausschlag
vollständig zwei Ursachen zugeordnet, und sie wirken gegeneinander: (1) Bahn A (T-M17-10) lässt
eine Armee nicht mehr ungeprüft durch fremdes Land marschieren (B6, Wegprüfung in der
**Taktik**, `military.ts`) — ohne Überfälle keine Verstimmung, ohne Verstimmung kein Krieg, das
Friedens-Duell endet 25-mal unentschieden (50 %, Befund M17-D9 in der berichtigten Fassung
bestätigt); (2) Bahn B (T-M17-12) gibt „schwer" mit Spionage einen Vorsprung, der im Krieg wirkt
— mit B6-Kriegen steigt die Quote auf 98 % (wie Bahn B allein, Befund M17-S4). Handel,
Provinzhandel und der **strategische** Durchmarsch-Einhängepunkt bewegen das Turnier nicht.
**Hinweis zur Kontrolle 2:** der Einhängepunkt in `decide.ts` schaltet die B6-Wegprüfung nicht
ab — sie sitzt in `militaryCommands`.

**Status:** offen. Band 0,55–0,95 am gemeinsamen Stand: **50 %, unter dem Band.** Keine KI-Zahl
geändert; die Entscheidung liegt beim Orchestrator bzw. T-M17-15/16 — siehe `tasks.yaml`, Feld
`reopened`, bei T-M17-10 und T-M17-12. Die drei roten Fälle im Lauf: „schwer schlägt normal" (25
Unentschieden), „mindestens ein Frieden, wo vorher keiner" (0 Kriegserklärungen), „schwer und
normal erklären selbst Kriege" (0).

---

## 2026-09-25 · Zusammenführung Bahn A und B in M17 · Befund M17-M3: die KI-Spionage verplante das Geld des Handels desselben Zugs ein zweites Mal (behoben)

**Befund (Merge-Hinweis beider Bahnen: A Prüfer-Befund 9 der Nacharbeit ki; B Ergänzung
`ACCEPT_TRADE`):** Am gemeinsamen Stand durch Test gezeigt: bei 300.000 Geld und einem
`OFFER_TRADE` mit 250.000 Geld Treuhand im selben Strategietakt warb die KI trotzdem einen
Gegenspion (101.530) an — die Rücklage war damit angebrochen, im echten Ablauf wäre
`RECRUIT_SPY` an `INSUFFICIENT_RESOURCES` gescheitert oder hätte die Rücklage unterschritten
(R-AI-09/AK2). Dasselbe mit `ACCEPT_TRADE` eines Angebots, das 250.000 Geld verlangt.

**Reparatur:** `moneyCommittedBy` (`packages/ai/src/espionage.ts`) zieht neben `BUILD` jetzt
`OFFER_TRADE` und `ACCEPT_TRADE` ab (siehe `DECISIONS.md`). Beide Fälle rot vor der Änderung,
grün danach; Golden-Master und Turnier unberührt. Commit `41a3410`.

**Status:** behoben.

---

**Offen, nur festgehalten (Zusammenführung, 2026-09-25):** `ledgerAfter` zieht `RECRUIT_SPY`
nicht ab — heute folgenlos, weil die Spionage als letzte plant; wer die Reihenfolge im
Strategietakt ändert, muss es nachziehen (siehe `DECISIONS.md`). Die übrigen offenen Befunde
beider Bahnen (M17-D9, M17-D10, M17-D12, M17-D13, M17-S1, M17-S4, M17-S12 u. a.) sind vom Merge
nicht berührt und stehen oben.


---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T1: Die Kriege der Turnierpaarung „im Frieden" waren Überfälle aus veralteten Befehlen — kein einziger förmlich

**Befund:** Die Zerlegung der Zusammenführung (Befund M17-M2) hat die Wegprüfung aus T-M17-10 als
Ursache des 50-%-Ergebnisses gefunden. Die Hypothese „die Prüfung verbietet auch den Marsch ins
Land des eigentlichen Angriffsziels und geht damit über D29.8 hinaus" ist **widerlegt**: ein
Angriffsziel ist immer herrenlos oder feindlich (`targeting.ts:107-110`). Je Tick eingeordnet
(Wegwerfsonde, 25 Paare, 40 Tage): auf `3a97e10` hält die Sicherung marschierender Armeen
(`military.ts:95`, Entscheid E4) 375-mal an, **jedes Mal** am Zielfeld selbst, dessen Besitzer
sich unterwegs geändert hat; die Prüfung neuer Angriffsbefehle (`military.ts:190`) sperrt 993-mal
echten Durchgang durch Gegnerland und bewegt das Ergebnis nicht (aus: weiter 50 %). Nur die
Sicherung aus: 98 %. Auf dem Stand vor M17 (Prüfung und KI-Spionage aus, zeichengleich `522ebca`,
70 %) standen 145 `WAR_DECLARED` im Ereignisstrom, davon **0** förmlich; 144 der 146 Armeen auf
fremdem Boden hatten `attack:<Ziel>` als Auftrag und ein Ziel, das beim Befehl herrenlos oder
feindlich war und unterwegs dem Gegner zufiel (meist `m1`/`m2`) oder in einen Waffenstillstand
geriet; 2 standen nur auf dem Weg. **Damit ist auch die Zusage aus T-M41-08 falsch**, in einer
Partie zu zweit komme „jede Erklärung aus dem Verhältnis" (`tournament.slow.test.ts`, Test
„laesst schwer und normal selbst Kriege erklaeren"): sie kam aus Überfällen, die das Turnier als
`WAR_DECLARED` des Täters zählt.

**Einordnung:** kein Fehler der Wegprüfung. D29.8 prüft „den Weg eines geplanten Angriffs", das
Ziel gehört zum Weg, und E4 hat den ganzen Restpfad ausdrücklich entschieden. Das Band war auf
Kriegen gemessen, die niemand beschlossen hat. `recruitShare` 280 wurde in genau diesem Band
gewählt (`BALANCING.md`, Nachtrag M17-T1).

**Status:** gemessen; Reparatur über Noahs Entscheid zu Befund M17-T5 (Option C, siehe unten).

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T2: Auf der Weltkarte erklärt die KI in 200 Tagen noch einen Krieg — vorher waren es 15

**Befund:** `m17-baseline.slow.test.ts` (Weltkarte, acht KI, Startzahl 1815, 200 Spieltage) auf
`3a97e10` gegen den eingecheckten Ausgangswert (`8bda869`): Kriegserklärungen **15 → 1**,
Überfälle ohne Erklärung **13 → 0**, `declareWar` 2 → 1, `offerPeace` 909 → 176, `acceptPeace`
7 → 0, Durchmarsch 0 → 14 Freigaben am Ende (7 Anträge, 7 angenommen, 7 erwidert), abgelehnte
KI-Befehle 3 → 2 (alle `RECRUIT:INSUFFICIENT_RESOURCES`), Ereignisse 29 987 → 22 482.
R-AI-09/AK3 hält (0 ≤ 13). Aber die Lesart aus Befund M17-1 — die zehn Überfälle der Art `ziel`
seien „die Art, wie die KI Krieg beginnt — sie marschiert einfach los" — trifft nicht zu: die KI
wählt nie eine Provinz einer friedlichen Macht als Ziel (`targeting.ts:110`); ein Überfall der Art
`ziel` ist ein Befehl, dessen Ziel unterwegs den Besitzer oder den Zustand gewechselt hat. Die
KI-Partie vor M17 bekam ihre Kriege damit zu 13 von 15 aus diesem Versehen. Übrig bleibt das
förmliche Tor (`diplomacy.ts` Abschnitt 4): Verhältnis = Ansehen (Ausgangswert 1000) − Verstimmung
+ Bindungen − Feindschaft − Grenztruppen (höchstens 300, `relationship.ts:142-144`); ohne
Verstimmung und bei ungetrübtem Ansehen bleibt es bei mindestens 700, über `warThreshold` 600
(„schwer") und 450 („normal"), und die Übermacht-Verlockung (`diplomacy.ts`, `(ratio − 1000) / 4`,
höchstens 450) öffnet es erst ab einem Punkteverhältnis von rund 1,4 („schwer", volle
Grenzbedrohung) bzw. 2,0 („normal").

**Status:** gemessen, **offen für T-M17-15/16** — das Integrationstor misst dieselbe Partie; die
Frage, ob eine KI-Partie ohne Kriege gewollt ist, ist eine Spielfrage für Noah (M17-T5, mit Option
C entschieden — die Weltkarte mit C: 11 Kriege statt 1, siehe Befund M17-T5).

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T3: Die KI-Spionage ist zerlegt — kein Teil trägt, kein Fehler

**Befund:** zu Befund M17-S4. Zerlegt per Wegwerfschalter in der einzigen Aufstellung, in der die
Paarung „im Frieden" überhaupt Kriege hat (Sicherung duldet das Zielland): alles an 98 %, KI-Spionage
aus 64 %; Sabotage aus 98 % (wird auf der Testwelt nie angeworben, 0 von 50 Partien); Aufklärung
aus 98 %; Budget halbiert 98 % (dann nur noch Gegenspione); Gegenspion aus 100 %; nur „schwer"
spioniert 100 %, nur „normal" 96 %. Bei halbem Budget gibt es keinen fremden Spion, der
Gegenspion würfelt nicht (`phases/espionage.ts`, Schritt c) — er kostet nur Anwerbepreis 101 530
und Sold 5 076 je Tag. Die Stufen unterscheiden sich in der Spionage nicht (drei Zahlen oberster
Ebene in `ai.json`, keine je Stufe). Keine Sabotage ohne Obergrenze, keine Information, die
„schwer" sieht und „normal" nicht. `grievanceOnSpyDetected` 300/200/150 (Bahn B) konnte deshalb
nichts bewegen.

**Status:** gemessen, **kein Fehler, keine Zahl geändert** (`BALANCING.md`, KI: Spionage). M17-S4
ist damit beantwortet: die Spionage macht „schwer" nicht übermächtig, sie verschiebt ein
empfindliches Messgerät (M17-T4). In der neu aufgestellten Turnieraufstellung (Option D) bewegt
die Spionage die gemittelte Quote von 0,58 auf 0,76 (beides im Band), je Sitzordnung aber zwischen
0,29 und 0,92 — Einzelheiten unter Befund M17-T4.

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T4: Das Turnier maß auf der Testwelt wenige Verläufe — behoben durch Option D

**Befund:** Die Startzahl bewegt auf `smallWorld` wenig. Verschiedene Ausgänge (Sieger und
Endpunkte) in den 50 Partien der Paarung „im Frieden": auf `3a97e10` **5** — und in allen 50
gewinnt die zweite Nation (Ostmark), gleich welche Stufe sie spielt; also 25 Paare unentschieden,
50 %. Mit geduldetem Zielland 13, zusätzlich ohne Spionage 29, Stand vor M17 29. Gegenspione
allein — Anwerbepreis 101 530, Sold 5 076 je Tag, ohne fremden Spion kein Wurf — kippen die Quote
von 64 % auf 98 %. Das Band 0,55–0,95 gilt nur für diese Paarung (`tournament.slow.test.ts`, Test
„schwer schlaegt normal, und zwar messbar"); „im Krieg" hat keine Obergrenze und stand schon vor
M17 bei 100 %.

**Umgesetzt (Option D, Commits `36121fb`, `d904c3c`, `97c385c`):** Vorabmessung mit acht Varianten
— nur ein Dritter am Tisch bringt Streuung. Aufstellung: Testwelt, drei Mächte reihum
(Nordland/Ostmark/Sueden in drei Sitzordnungen), Dritter als Füller „normal" (die einzige Stufe
ohne eigene Schlagseite), 150 Partien je Paarung, 40 Spieltage, jedes Turnier einmal gerechnet
(rund 32 Sekunden, gemessen 2026-09-25, zwei Läufe allein: 31,4 s / 31,6 s). Ergebnis: **110**
verschiedene Ausgänge in 150 Partien statt 5, höchstens 67 Siege einer Nation (447 ‰ statt
980 ‰), Quote schwer–normal im Frieden **0,760** (Band hält), schwer–leicht 0,847, schwer–normal
im Krieg 0,633. Neu zugesichert: mindestens 50 Ausgänge, keine Nation über 600 ‰, beide Stufen
erklären förmlich. Band, Grenzen, Karte und KI-Zahlen unverändert.

**Berichtigung 2026-09-25 (Nacharbeit-Prüfung, Befund 6 „mittel"):** die neue Aufstellung trägt
das Band **aus eigener Kraft**, nicht Option C — Gegenmessung ohne Option C, gleiche Aufstellung:
**0,75** (43:5:27, 83 Ausgänge, 23 Überfälle, 124 Frieden). Option C liefert die förmlichen
Erklärungen (286 → 680) und mehr Friedensschlüsse (124 → 478), nicht die Quote selbst.

**Berichtigung 2026-09-25 (Nacharbeit-Prüfung, Befund 5 „hoch"):** die Obergrenze 0,95 hält nur,
weil Ostmark in zwei von drei Sitzordnungen schwach ist. Je Startzahl-Block (150 Partien,
1000/5000/7000/9000): 0,7600 / 0,8200 / 0,7267 / 0,7267 — die Spanne reicht bis 0,82, nicht nur
0,71–0,76 wie die Vorabmessung (nur Startzahlen 1000–3000) nahelegte. „normal" gewinnt in keinem
der vier Blöcke mehr als 1 von 75 Paaren; die Quote unter 0,95 kommt praktisch allein aus
Unentschieden, in denen der Füller entscheidet. Je Aufstellung: Nordland/Ostmark/Sueden 0,72–0,84,
Ostmark/Sueden/Nordland 0,60–0,70, Sueden/Nordland/Ostmark 0,86–0,92 (ausgeglichen).

**Berichtigung 2026-09-25 (Nacharbeit-Prüfung, Befund 9 „mittel"):** der Frische-Wächter folgt der
neuen Turnierlogik nicht. `scripts/acceptance-criteria.mjs`, `GAUGES` Eintrag „Turnier",
`sources`: `data/rules`, `data/maps/testworld.json`, `packages/ai/src`, `packages/core/src` —
enthält **nicht** `apps/headless/src` oder `apps/headless/test`, obwohl die Messung (Aufstellung,
Siegerwahl, 150 Partien, 40 Tage) seit Option D genau dort steht. Offen für T-M17-15/16.

**Status:** behoben als Teil von T-M17-15.

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T5: Kein ehrlicher Eingriff hielt das Band — die Optionen, Noahs Entscheid und die Umsetzung

**Befund:** gemessen auf `3a97e10`, Turnier je 50 Partien (schwer–leicht Krieg / schwer–normal
Frieden / schwer–normal Krieg; Kriegserklärungen der Stufe nach Handelndem normal / schwer),
Weltkarte 200 Tage (Kriege / Überfälle / Durchmarschfreigaben am Ende / abgelehnte KI-Befehle):

| Option | Turnier | nach Handelndem | Tests rot | Weltkarte |
|---|---|---|---|---|
| A: heute (`3a97e10`) | 100 / **50** / 98 % | 0 / 0 | 3 von 5 | 1 / 0 / 14 / 2 |
| B: Sicherung duldet das Zielland („Transit nur durch Dritte") | 100 / **98** / 96 % | 54 / 50 (alles Überfälle) | 1 (Obergrenze) | 11 / 7 / 2 / 4 |
| C: veraltetes Ziel → förmliche Kriegserklärung statt Anhalten (Wegwerfbau) | 100 / **52** / 98 % | 35 / 70 (förmlich) | 1 (Untergrenze) | 10 / 0 / 8 / 9, davon **7 `DIPLOMACY:INVALID_TARGET`** |
| D: Band auf eine Paarung/Karte mit Streuung verlegen | — | — | — | Planarbeit |

B holt den Fehler B6 zurück und reißt das Band trotzdem. C ist eine Erweiterung über D29.8 hinaus
(die KI beansprucht eine Provinz, die ihr weggeschnappt wurde), erfüllt R-DIP-06 (61
Friedensschlüsse) und T-M15-08 förmlich, reißt das Band nach unten und müsste für R-AI-09/AK2 die
sieben Ablehnungen beheben. `progress.slow.test.ts` (6 Mächte, 120 Tage, 12 Startzahlen) grün für
beide: B Anteil des Stärksten 0,4607, Eroberungen 289,8, Überlebende 5,0; C 0,3724 / 244,8 / 5,42;
heute (Zusammenführung, gleicher Commit) 0,3544 / 249,9 / 5,5; vor M17 (2026-09-13) 0,3684 /
310,1 / 5,42.

**Entscheidung (Noah, 2026-09-25, `DECISIONS.md`):** Option C **und** Option D, gebaut in dieser
Reihenfolge; B und „so lassen" (A) abgelehnt.

**Umgesetzt (Option C, Commits `f69dffb`, `e0712f5`, `21859f8`, `1179075`):** Weltkarte 200 Tage:
**11 Kriege**, davon **10 förmlich erklärt**; **0** `INVALID_TARGET`, 1 Ablehnung insgesamt. Die
sieben `DIPLOMACY:INVALID_TARGET` des Wegwerfbaus hatten zwei Ursachen: sechsmal beantragte eine
zweite Armee im selben Zug Durchmarsch bei der Macht, der die Taktik eben erklärt hatte
(`requestPassage` sah nur Befehle früherer Stufen), einmal schlug die zweite von zwei
Friedensannahmen fehl, weil `acceptPeace` alle Angebote an den Annehmenden löschte (Befund B4).
Beide behoben; B4 ist damit für Frieden und Bündnis erledigt. Nebenbei behoben: Friedensangebote
an ausgeschiedene Mächte (9× `PLAYER_ELIMINATED`) und eine Aushebung unter der Moralgrenze (1×
`RECRUIT:INVALID_TARGET`).

**Umgesetzt (Option D, Commits `36121fb`, `d904c3c`, `97c385c`):** siehe Befund M17-T4. Mit beiden
Optionen zusammen: Turnier schwer–leicht 0,847, schwer–normal im Frieden **0,760** (Band hält),
im Krieg 0,633; 110 verschiedene Ausgänge; zwei Läufe zeilengleich.

**Status:** umgesetzt. T-M17-10 und T-M17-12 auf `status: done` (siehe `tasks.yaml`,
`DECISIONS.md`).

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T6: Ein Friedensschluss im selben Tick macht aus einem Angriff einen Überfall — offene Frage an Noah

**Befund:** Der eine verbleibende Überfall der Weltkarte (Tick 1590, Italien → Frankreich, nach
Option C) ist keiner aus Versehen: am Tickbeginn herrschte Krieg, Frankreich nahm im selben Tick
Italiens Friedensangebot an, und Italiens Armee rückte im selben Tick in ihr Angriffsziel ein.
`detectSurpriseAttacks` (`packages/core/src/phases/diplomacy.ts`) wertet jede Armee auf fremdem
Boden ohne Krieg als Überfall — auch die, die bei Friedensschluss schon dort stand oder im selben
Tick ankam. Im neu aufgestellten Turnier (Option D) sind das **54 von 74** Überfällen der Paarung
„im Frieden" (Beziehung am Tickbeginn `war`), weitere 18 fallen in den ersten
Waffenstillstandstagen — macht 72, nicht 74 (Differenz von 2 nicht nachgemessen, Zeitbudget der
Nacharbeit-Prüfung). In der endgültigen Turnieraufstellung (150 Partien) liegt die Zahl bei **74
von 150** Partien der Paarung „im Frieden". Gemessen und verworfen: „wer Frieden anbietet, hält
seine Armeen an" (Turnier 50/50 %, kein Friedensschluss im Krieg mehr gemessen — keine Lösung).

**Einordnung:** Option C **verdreifacht** die Überfallzahl im Turnier (23 → 74 in derselben
Aufstellung, ohne/mit C, gleiche Startzahlen) — der Anstieg kommt aus mehr Kriegen, die C erst
ermöglicht (förmliche statt ausbleibender Erklärungen), und damit aus mehr Friedensschlüssen, bei
denen noch Armeen im Feindesland stehen. M17-T6 ist eine **Folge** von Option C, kein von C
unabhängiger Befund.

**Offene Frage an Noah:** ein Überfall auf der Weltkarte entsteht, weil ein Frieden im selben Tick
angenommen wird, in dem die Armee ankommt; eine Räumfrist nach Friedensschluss (wie die
Kündigungsfrist beim Durchmarsch) wäre die Reparatur — Entscheid, ob M17 oder M18.

**Status:** offen, Entscheid Noah. R-AI-09/AK3 hält (1 ≤ 13 auf der Weltkarte).

---

## 2026-09-25 · Nacharbeit Turnier M17 · Befund M17-T7: Der KI-Integrationslauf ist auf dem M17-Stand rot

**Befund:** `apps/headless/test/ai-integration.slow.test.ts` auf `4a793fd` (vor Option C): **3 von
21 rot** — „fuehrt Artillerie und laesst sie feuern" (18 Artillerie, 0 selbsttätiger Beschuss),
„laesst keine KI-Macht ohne Hauptstadt enden" und „schliesst mindestens einen Frieden zwischen
zwei KI-Maechten" (90 Tage: 1 Krieg, 0 Frieden). Mit Option C (`1179075`): **2 von 21 rot** —
Artillerie (0 ausgehoben, 2 819 Infanterie, 0 Beschuss) und Frieden in 90 Tagen (5 Kriege, 0
Frieden); die Hauptstadt hält jetzt. Im 200-Tage-Lauf mit C: 11 Kriege, 3 Frieden zwischen KI, 92
Fabriken. Die Läufe gehören nicht zu `pnpm verify` und liefen seit M17 offenbar nicht.

**Einordnung (Nacharbeit-Prüfung 2026-09-25, Befund 10 „mittel"):** der Artillerie-Rückgang
(18 → 0) ist ein **Rückschritt durch Option C**, keine bloße Fortsetzung des Vorbefunds — C3 (die
Moralgrenze der Aushebung in `economy.ts`, `recruitCommands`) greift in dieselbe Provinzschleife
ein, die auch die Artillerie sichert; es gibt keine Gegenprobe ohne C3 dafür.

**Status:** offen, für das Integrationstor T-M17-15 — Ursache der fehlenden Artillerie und des
fehlenden Beschusses dort zerlegen (Gegenprobe ohne C3 und ohne C4), Frieden in 90 Tagen prüfen;
nicht in der Nacharbeit Turnier behoben.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · Befund M17-U1 (kritisch, in der Oberfläche behoben): Marktvorschau bricht bei Mengen über der Höchstmenge

**Befund:** `exchangeAmount()` (`packages/core/src/rules/market.ts`) warf `FixedOverflowError`
schon bei 3,5 Mrd. Einheiten Seltene Erden im bloßen Formularentwurf — unabhängig davon, ob
`canApply` den Befehl je gesehen hat. Die Vorschau (`Panels.tsx` `TradeOfferForm`, `MarketPanel`)
rief `exchangeAmount()` bei **jedem** Rendern auf und stürzte dementsprechend ab, reproduziert am
2026-09-25 vor der Reparatur.

**Reparatur (in dieser Nacharbeit, `apps/desktop`):** neue Funktion `safeExchangeAmount()`
(`actions.ts`) kappt `giveAmount` vor der Rechnung, so dass `giveAmount * Kurs` unterhalb
`Number.MAX_SAFE_INTEGER` bleibt; der an `canApply` gehende Befehl bleibt ungekürzt für die echte
Prüfung. Test A10. Siehe DECISIONS.md, Eintrag „Kappung statt Prüfung vor der Vorschau".

**Offen im Kern (Kandidat, nicht Teil dieser Nacharbeit):** `exchangeAmount()` selbst kappt oder
sättigt nicht — jeder künftige Aufrufer außerhalb von `apps/desktop/src/game/actions.ts` kann
denselben Absturz erzeugen. Kandidat für eine eigene Aufgabe: `exchangeAmount()` wirft nie,
sondern sättigt intern, oder `MIN_TRADE_AMOUNT` bekommt ein Pendant nach oben.

**Status:** Oberfläche repariert und mit Gegenprobe belegt; Kernverhalten offen, vorgemerkt für
M18.

---

## 2026-09-25 · Nacharbeit T-M17-13/14 · Befund M17-U2 (niedrig, nicht selbst behoben): `nameOf` in `App.tsx` hat keinen Rückfall auf leeren Text bei unbekannter Kennung

**Befund:** Ein adversarischer Prüfer meldete, dass `offerListActions` bei einer unbekannten
Macht `t('trade.unknownPower')` zurückgibt, dieser Pfad aber nie erreichbar sei, weil `nationOf`
laut Befund „nie" auf eine rohe Kennung zurückfällt. Nachgestellt (2026-09-25): zutreffend —
`naming.nameOf` **und** `App.tsx`s eigenes `nameOf` haben tatsächlich **keinen** Rückfall auf
einen leeren Text bei einer unbekannten Kennung; sie geben die Kennung selbst zurück.
`t('trade.unknownPower')` in `offerListActions` ist damit eine tote Kaskade — der Zweig, der sie
auslösen würde, wird von `nameOf` selbst nie erreicht.

**Warum nicht repariert:** Die sichtbar erreichbare Hälfte des ursprünglichen Befunds — die
Provinz-Chip-Seite in `TradeOfferForm` — wurde in dieser Nacharbeit behoben (`trade.unknownProvince`,
siehe DECISIONS.md und Befund darüber). Die `nameOf`-Hälfte selbst zu ändern (Rückfall auf
`view.others`/leeren Text) betrifft mehrere Aufrufer außerhalb von T-M17-13/T-M17-14 — außerhalb
des Umfangs dieser Nacharbeit.

**Status:** bestätigt, nicht repariert, zurückgestellt als eigener, kleiner Befund für eine
künftige Aufgabe.

---

## 2026-09-25 · T-M17-13 · Befund M17-S13 (niedrig, unbestätigt): der Ton verstummt vermutlich, sobald der Ereignisring voll ist

**Fundort:** `apps/desktop/src/App.tsx`, Ton-Effekt (Kommentar „own.slice(soundedUpTo)").

**Beobachtung (aus dem Bauplan zu T-M17-13, dort als F10 geführt, nicht selbst nachgemessen):**
der Ton-Effekt zählt seinen Fortschritt über die **Länge** von `eventsFor(state.eventLog,
viewerId)`. Der Ereignisring ist auf 500 Einträge für alle Mächte gedeckelt; ist er einmal voll,
wächst diese Länge kaum noch, und `own.slice(soundedUpTo)` liefert fast nichts mehr — der Ton
könnte nach Sättigung des Rings verstummen. Die Spionage-Meldungen dieser Aufgabe zählen bewusst
nach Tick (`upTo`), nicht nach Länge, um genau das zu vermeiden (siehe DECISIONS.md, T-M17-13 E3).

**Status:** unbestätigt, nicht selbst nachgemessen — weder in T-M17-13 noch in dieser Nacharbeit
behoben (außerhalb ihres Auftrags). Empfehlung: eigener Befund mit Messung (wie lange bis der
Ring voll ist, ob der Ton dann wirklich verstummt), Reparatur nach demselben Muster wie
`collectEspionageNews` (nach Tick statt nach Länge).
