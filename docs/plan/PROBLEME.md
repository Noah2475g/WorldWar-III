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
| **Kohle hat nur noch eine Senke** — der Gebäudeunterhalt ist heute zurückgenommen, damit bleibt nur der Armeeunterhalt; 86 von 237 Provinzen fördern Kohle, die niemand braucht | Befund 26, 35 | **M17** — mit der Tiefe zwischen den Kriegen, die dem Frieden Ausgaben gibt |
| **R-AI-04 ist gemessen verletzt** — die KI hält 43,1 % statt der zugesagten 30 % Rücklage, und der Test ist trotzdem grün, weil er die Schwelle nicht prüft | Befund 46 | **M15**, mit T-M15-08 (Integrationstor) — dort wird die KI ohnehin gemessen |
| **Hauptstadtverlegung kostet nichts** und löscht die Strafe für den Hauptstadtverlust; wer seine Hauptstadt verliert, verlegt sie sofort und ist die Folgen los | Befund 50 | **M15**, mit T-M15-05 — die KI lernt dort `SET_CAPITAL`, und der Preis gehört zur selben Regel |
| **350-facher Vorratsaufbau** über 1000 Spieltage ohne einen einzigen Überlauf; die Lagergrenze liegt rechnerisch 3000 Spieltage entfernt und wirkt nie | Befund 58 | **M17** — dieselbe Ursache wie die Kohlesenke: dem Frieden fehlen Ausgaben |
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
