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

**Status: offen**, je mit Aufgabe; B7 zweite Hälfte ohne Meilenstein.

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
nicht auf dem vor M41. (2) Der eine Parameterlauf der Delegation (T-M17-16) sieht die
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
Pendelzüge. Die Garnison A 1914 bildet vorher nach (52 Einmärsche, 4 verloren). Jede Zahl trifft die
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
nicht (er fragt nur `data/rules`), der eine Parameterlauf in T-M17-16 misst neu. Risiko 5 (200 Tage, sechs
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
- 0 Ablehnungen, 0 Kriege ohne Erklärung, 0 Pendelzüge.

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

**Nicht zugesichert, nicht gebaut.** Pendelzüge gehören nicht zu AK5; die Zahl steht im Bericht. Wer sie verhindern
will, hat zwei Wege, und beide sind eine neue Entscheidung, gemessen mit demselben Lauf:
- die Ruhe ab der Ankunft zählen (Zustandsfeld, in T-M40-14 verworfen),
- die Ruhe nach Märschen der Automatik verlängern.

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

## 2026-09-13 · Beim Bau von T-M40-17 gefunden · Parameterlauf und Turnier folgen dem Code nicht, den sie vermessen (gezählt, offen)

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

**Status:** offen, Frage an Noah.
