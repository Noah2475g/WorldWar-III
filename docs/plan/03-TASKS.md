---
type: plan
status: draft
projekt: WorldWar (Supremacy-WW3-Klon, Singleplayer)
stufe: 3 von 3 (Tasks)
created: 2026-09-02
---

# 03 — TASKS

> **Für Agenten:** Arbeite Aufgaben **in ID-Reihenfolge** ab, außer die Abhängigkeiten
> erlauben Vorziehen. Jede Aufgabe ist nach demselben Muster gebaut:
> **Ziel · Anforderungen · Abhängigkeiten · Dateien · Tests zuerst · Fertig wenn**.
> Der maschinenlesbare Zwilling dieses Dokuments ist `tasks.yaml` (gleiche IDs).
> Das Ausführungsprotokoll — wie du arbeitest, was du bei Fehlern tust, wann du Noah fragst —
> steht in `AGENT-EXECUTION.md`. **Lies dieses Protokoll, bevor du die erste Aufgabe beginnst.**

**Grundregel für jede Aufgabe (TDD, C-08):**
1. Tests aus den genannten Akzeptanzkriterien schreiben → Lauf muss **rot** sein.
2. Minimal implementieren → **grün**.
3. Aufräumen, Namen prüfen, Doppelungen entfernen.
4. `pnpm verify` läuft durch → erst dann gilt die Aufgabe als fertig.

**Schnelle und langsame Prüfungen.** `pnpm verify` muss nach *jeder* Aufgabe laufen und darf
deshalb nicht länger als etwa zwei Minuten dauern. Lang laufende Prüfungen (Turniere über
50 Partien, Läufe über 1000 Spieltage, Weltkarten-Benchmarks) tragen das Vitest-Tag `@slow`,
werden von `pnpm test` und `pnpm verify` ausgeschlossen und laufen ausschließlich über
`pnpm test:slow`. Verpflichtend ist `pnpm test:slow` in T-M8-03, T-M9-04, T-M12-01 und
T-M12-03. Für `verify` genügt die Kurzform derselben Prüfung (3 Turnierpartien, 50 Spieltage).

**Messbare Budgets statt „Benchmark läuft".** Benchmarks assertieren von sich aus nichts.
Jeder Bench schreibt sein Ergebnis nach `docs/reports/<name>.json`; ein begleitender Test
`*.budget.test.ts` liest diese Datei und schlägt fehl, sobald der Median das Budget reißt.

---

## Meilenstein M0 — Fundament

### T-M0-01 · Repository und Werkzeugkette aufsetzen
- **Ziel:** Lauffähiges Monorepo mit pnpm-Workspaces, TypeScript (strict), Vitest, ESLint, Prettier.
- **Anforderungen:** C-01, C-08
- **Abhängigkeiten:** —
- **Dateien:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.gitignore`, `vitest.workspace.ts`
- **Tests zuerst:** `test/smoke.test.ts` — prüft, dass die Testkette überhaupt läuft.
- **Fertig wenn:** `pnpm install && pnpm test` läuft grün durch; `pnpm typecheck` fehlerfrei.

### T-M0-02 · Skripte und Prüfkette
- **Ziel:** Alle Skripte aus Design D15 existieren und tun das Erwartete.
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** T-M0-01
- **Dateien:** `package.json` (scripts), `scripts/verify.mjs`
- **Tests zuerst:** `test/scripts.test.ts` — jedes in D15 genannte Skript ist definiert.
- **Fertig wenn:** `pnpm verify` führt **immer** lint + typecheck + test (ohne `@slow`) + guards
  aus. Die Abdeckungsschwellen (Kern ≥ 90 %, gesamt ≥ 80 %) werden nur für Pakete geprüft, die
  bereits Quellcode außerhalb von `src/index.ts` enthalten; leere Pakete gelten als erfüllt.
  `pnpm coverage:requirements` ist **nicht** Teil von `verify`, sondern ein eigenes Prüftor und
  ausschließlich in T-M12-03 verpflichtend grün.
  *(Ohne diese Einschränkung wäre keine Aufgabe abschließbar, solange noch Pakete leer sind.)*

### T-M0-03 · Guard-Tests (Determinismus, Monetarisierung, Netzwerk, Importgrenzen)
- **Ziel:** Die drei Produktziele Z1–Z3 und die Architekturgrenzen sind maschinell abgesichert.
- **Anforderungen:** R-ARCH-01/AK2, R-FREE-01/AK1, R-FREE-03, R-FREE-04/AK1, R-FREE-05, R-TIME-05
- **Abhängigkeiten:** T-M0-01
- **Dateien:** `test/guards/no-monetization.test.ts`, `test/guards/no-network.test.ts`,
  `test/guards/core-purity.test.ts`, `test/guards/import-boundaries.test.ts`,
  `test/guards/no-time-pressure.test.ts`, `test/guards/no-realtime.test.ts`
- **Zusätzlich zu prüfen:**
  - `R-FREE-03`/`R-FREE-05`: kein Feld im Zustandstypbaum passt auf
    `/energy|stamina|waitUntil|boostUntil|cooldownPaid/`; kein Kommando erlaubt Beschleunigung
    gegen Ressourcen; `data/rules/**` enthält keinen Schlüssel `rushCost`.
  - `R-TIME-05`: `packages/core` enthält keinen Verweis auf `Date`, `performance` oder `setTimeout`.
  - **Festkomma-Regel:** In `packages/core/src/**` sind die Operatoren `*` und `/` verboten
    (ESLint `no-restricted-syntax`); erlaubt sind nur `mulFixed`, `divFixed`, `mulChain`.
    Das ist die einzige wirksame Absicherung gegen den Fehler, zwei Festkommawerte direkt zu
    multiplizieren — das Ergebnis wäre um den Faktor 1000 falsch und fiele erst im Balancing auf.
- **Tests zuerst:** Jeder Guard bekommt unter `test/guards/fixtures/violating/` eine
  synthetische Verstoßdatei, die dauerhaft im Repository bleibt und von der Prüfung des
  Produktionscodes ausgenommen ist. Jeder Guard-Test prüft **beide** Richtungen:
  sauberer Code → grün, Fixture → rot.
- **Fertig wenn:** Alle vier Guards grün; jeder Guard weist an seiner Fixture nach, dass er
  seinen Verstoß tatsächlich erkennt.

### T-M0-04 · Anforderungs-Abgleich
- **Ziel:** Skript, das jede V1-Anforderungs-ID auf mindestens einen Test abbildet.
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** T-M0-02
- **Dateien:** `scripts/requirements-coverage.mjs`, `test/requirements.test.ts`
- **Vorgehen (verbindlich):** Das Skript liest den YAML-Block `scope` am Ende von
  `01-REQUIREMENTS.md` §2, sammelt alle Anforderungs-IDs per `/^- \*\*(R-[A-Z]+-\d{2})/m` aus §2
  und alle in Testnamen per `/describe\(['"](R-[A-Z]+-\d{2})/`. IDs unter `v2_only` werden
  übersprungen; IDs unter `v1_partial` und `test_only` brauchen mindestens einen Test.
- **Tests zuerst:** Test, der bei einer künstlich entfernten Test-ID fehlschlägt; Test, der
  eine `v2_only`-ID korrekt überspringt.
- **Fertig wenn:** `pnpm coverage:requirements` listet offene Anforderungen namentlich mit
  Abschnittsnummer auf und liefert Exit-Code ≠ 0, solange welche offen sind. **Dieses Tor
  gehört nicht zu `pnpm verify`** — zu Beginn sind erwartungsgemäß viele IDs offen.

### T-M0-05 · Plan-Konsistenz-Test
- **Ziel:** Der Plan bewacht sich selbst: `03-TASKS.md` und `tasks.yaml` dürfen nicht auseinanderlaufen.
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** T-M0-01
- **Dateien:** `test/plan-consistency.test.ts`
- **Tests zuerst:** Beide Dateien werden geparst und Feld für Feld verglichen (Aufgaben-IDs,
  `deps`, `files`, `requirements`); jede Abhängigkeit verweist auf eine existierende ID; es
  gibt keine Zyklen; jede Aufgabe gehört zu einem in `milestones` deklarierten Meilenstein.
- **Fertig wenn:** grün — der Test schlägt nachweislich an, wenn in einer der beiden Dateien
  eine Abhängigkeit geändert wird.

---

## Meilenstein M1 — Simulationskern und Determinismus

### T-M1-01 · Festkomma-Arithmetik
- **Ziel:** `Fixed`-Typ mit `add/sub/mul/div/clamp/percent`, definierter Rundung, ohne Gleitkomma.
- **Anforderungen:** R-ARCH-01, D-02
- **Abhängigkeiten:** T-M0-01
- **Dateien:** `packages/shared/src/fixed.ts`
- **Tests zuerst:** Wertetabelle mit mindestens 12 Paaren (positiv/negativ × aufwärts/abwärts/
  genau halb) gegen die in Design D2 festgelegte Rundung *halbe Beträge vom Nullpunkt weg*;
  Überlauf wirft `FixedOverflowError`; Division durch 0 wirft `FixedDivisionByZeroError`;
  ein Test hält ausdrücklich fest, dass `mulFixed` **nicht** assoziativ ist — daraus folgt die
  verbindliche Auswertungsreihenfolge aller Formeln aus D6: strikt von links nach rechts in der
  dort notierten Reihenfolge.
- **Fertig wenn:** 100 % Zweigabdeckung dieser Datei.

### T-M1-02 · Geseedeter Zufallsgenerator
- **Ziel:** PCG32-artiger PRNG, Zustand als Teil des Spielzustands, reproduzierbar.
- **Anforderungen:** R-ARCH-01
- **Abhängigkeiten:** T-M1-01
- **Dateien:** `packages/shared/src/rng.ts`
- **Tests zuerst:** gleiche Seed-Folge → gleiche Zahlen; Serialisierung/Deserialisierung
  ändert die Folge nicht; Gleichverteilung über 100 000 Ziehungen im Toleranzband.
- **Fertig wenn:** grün + Golden-Vektor (erste 20 Zahlen für Seed 42) festgeschrieben.

### T-M1-03 · Zustands-Hash
- **Ziel:** Stabiler, ordnungsunabhängiger Hash über den Spielzustand.
- **Anforderungen:** R-ARCH-01/AK1, R-GAME-03/AK1
- **Abhängigkeiten:** T-M1-01
- **Dateien:** `packages/shared/src/hash.ts`
- **Tests zuerst:** identische Zustände → gleicher Hash; ein geändertes Feld → anderer Hash;
  Schlüsselreihenfolge im Objekt irrelevant.
- **Fertig wenn:** grün.

### T-M1-04 · Zustandstypen und Anfangszustand
- **Ziel:** Alle Typen aus Design D2, plus `createInitialState(config)`.
- **Anforderungen:** R-ARCH-01, R-GAME-01
- **Abhängigkeiten:** T-M1-02, T-M1-03
- **Dateien:** `packages/core/src/state/types.ts`, `packages/core/src/state/create.ts`
- **Tests zuerst:** Anfangszustand ist JSON-serialisierbar; enthält keine `Map`/`Set`/`undefined`;
  `playerOrder`/`provinceOrder` sind vollständig und sortiert. `createInitialState(config, ctx)`
  erhält die geprüfte Kartendatei als Argument; für diesen Test genügt eine dreiteilige
  Inline-Karte, die vollständige Testkarte kommt in T-M2-02.
- **Zu beachten:** Der Typbaum enthält von Anfang an `UnitStack` mit **Trefferpunkte-Vorrat
  statt Stückzahl**, `state.ai` (KI-Gedächtnis), `Player.intel` (Aufklärungswissen) und
  `Province.productionRemainder`. Alle vier später nachzurüsten wäre ein Umbau quer durch Kern,
  KI und Persistenz.
- **Fertig wenn:** grün.

### T-M1-05 · Tick-Pipeline als Gerüst
- **Ziel:** `step(state, commands, ctx)` mit allen **12 Phasen** aus D3 als leere, aber
  aufgerufene Phasen, dazu `dailyTick` für alles in Tagesgrößen.
- **Anforderungen:** R-ARCH-01, R-TIME-01
- **Abhängigkeiten:** T-M1-04
- **Dateien:** `packages/core/src/step.ts`, `packages/core/src/phases/*.ts`
- **Tests zuerst:** Phasenreihenfolge wird exakt eingehalten (Aufrufprotokoll); `tick` erhöht
  sich um genau 1; leerer Kommandosatz ändert sonst nichts.
- **Fertig wenn:** grün.

### T-M1-06 · Determinismus-Nachweis
- **Ziel:** Zwei identische Läufe erzeugen identische Hash-Folgen über 500 Ticks.
- **Anforderungen:** R-ARCH-01/AK1, R-ARCH-03/AK1
- **Abhängigkeiten:** T-M1-05
- **Dateien:** `packages/core/test/determinism.test.ts`, `packages/core/test/golden/`
- **Tests zuerst:** Determinismus-Test + Golden-Master-Datei mit Hash nach 500 Ticks.
- **Fertig wenn:** grün; absichtliche Regeländerung lässt den Golden-Test anschlagen.

### T-M1-07 · Kommandogerüst und Validierung
- **Ziel:** `Command`-Union, `canApply`, `applyCommand`, Fehlercodes aus D4.
- **Anforderungen:** R-ARCH-02/AK1
- **Abhängigkeiten:** T-M1-08 *(Kommandos erzeugen Ereignisse — die Typen müssen vorher stehen)*
- **Dateien:** `packages/core/src/commands/*.ts`
- **Tests zuerst:** Ungültiges Kommando ändert den Zustand nicht und liefert den korrekten
  Fehlercode; gültiges Kommando erzeugt genau ein Ereignis.
- **Fertig wenn:** grün; `canApply` und `applyCommand` teilen sich die Prüflogik (keine Doppelung).

### T-M1-08 · Ereignistypen und Ereigniserzeugung
- **Ziel:** `GameEvent`-Union mit allen Ereignisarten und die Hilfsfunktionen, die sie erzeugen.
  *(Wird bereits von T-M1-07 gebraucht; die Anzeige-, Ringpuffer- und Filterlogik folgt in T-M5-04.)*
- **Anforderungen:** R-GAME-06, D-07
- **Abhängigkeiten:** T-M1-05
- **Dateien:** `packages/core/src/events/types.ts`, `packages/core/src/events/emit.ts`
- **Tests zuerst:** jedes Ereignis ist JSON-serialisierbar und trägt `tick`, `type` und die
  betroffenen IDs; die Union ist erschöpfend (Typprüfung schlägt bei fehlendem Fall fehl).
- **Fertig wenn:** grün.

### T-M1-09 · Kern-Uhr: `runTicks`, `fastForward`, Vorspulziele
- **Ziel:** `packages/core/src/clock.ts` aus Design D5 — die Vorspullogik gehört in den Kern,
  nicht in die Oberfläche.
- **Anforderungen:** R-TIME-01, R-TIME-03/AK1, R-TIME-05
- **Abhängigkeiten:** T-M1-08
- **Dateien:** `packages/core/src/clock.ts`
- **Tests zuerst:** `runTicks(s, 10)` liefert `tick + 10` unabhängig von der Wanduhr; der Kern
  enthält keinen Verweis auf `Date` oder `performance` (Guard); `fastForward` hält bei jedem
  Wächterereignis an und nennt den Grund; ohne Ereignis läuft es exakt bis zum Ziel.
- **Fertig wenn:** grün.

---

## Meilenstein M2 — Karte, Graph, Wege

### T-M2-01 · Kartenschema und Validator
- **Ziel:** JSON-Schema für Karten + Validator mit klaren Fehlermeldungen.
- **Anforderungen:** R-MAP-02/AK1/AK2, R-MAP-03
- **Abhängigkeiten:** T-M1-04
- **Dateien:** `packages/core/src/map/schema.ts`, `packages/core/src/map/validate.ts`
- **Tests zuerst:** fehlerhafte Karten werden je mit eigenem Fehler abgelehnt — asymmetrische
  Nachbarschaft, unerreichbare Provinz, doppelte ID, fehlendes Feld sowie als fünfte Klasse
  `EDGE_ASYMMETRY`: `map.edges` und die abgeleiteten `Province.neighbors` stimmen nicht überein.
- **Fertig wenn:** grün; das Schema deckt das Kantenmodell aus Design D2 mit ab
  (`Edge` mit `distanceKm`, `kind`, `crossing`).

### T-M2-02 · Testkarte „Kleine Welt“ (12 Provinzen)
- **Ziel:** Handgeschriebene Karte für alle Kernregel-Tests, inkl. Küste, Gebirge, Insel.
- **Anforderungen:** R-MAP-01, R-MAP-03
- **Abhängigkeiten:** T-M2-01
- **Dateien:** `data/maps/testworld.json`, `packages/testkit/src/maps.ts`
- **Tests zuerst:** Karte besteht den Validator; enthält mindestens je eine Provinz jedes
  Geländetyps und eine per Seeweg verbundene Insel.
- **Fertig wenn:** grün.

### T-M2-03 · Wegfindung
- **Ziel:** Kürzeste-Wege-Suche über Land und See mit Kostenfunktion aus D6.4.
- **Anforderungen:** R-UNIT-04, R-MAP-01
- **Abhängigkeiten:** T-M2-02
- **Dateien:** `packages/core/src/map/pathfinding.ts`
- **Tests zuerst:** kürzester Weg auf der Testkarte bekannt und geprüft; kein Weg → `NO_PATH`;
  Seeweg nur mit Transportfähigkeit; Ergebnis ist bei gleicher Ausgangslage identisch (stabile
  Sortierung bei Gleichstand).
- **Fertig wenn:** grün.

### T-M2-04 · Szenario-Lader im Testwerkzeug
- **Ziel:** Die in Design D14 vorgesehene Testart „Szenario“ bekommt ihr Werkzeug:
  „gegebene Lage → N Ticks → erwarteter Ausgang“ als lesbare Datei statt als Testcode.
- **Anforderungen:** R-ARCH-01, C-08
- **Abhängigkeiten:** T-M2-02
- **Dateien:** `packages/testkit/src/scenario.ts`, `packages/core/test/scenarios/*.yaml`
- **Tests zuerst:** ein Beispielszenario läuft durch und schlägt fehl, sobald die Erwartung
  verletzt wird; unbekannte Felder im Szenario werden abgelehnt.
- **Fertig wenn:** grün; mindestens ein Szenario je Kernregel ist möglich.

---

## Meilenstein M3 — Wirtschaft, Bau, Rekrutierung

### T-M3-01 · Regelwerk-Dateien und Lader
- **Ziel:** `data/rules/default/{resources,buildings,units,constants,ai}.json` + typisierter Lader.
- **Anforderungen:** R-ECON-01, R-UNIT-01, R-PROV-02, D-08
- **Abhängigkeiten:** T-M1-04
- **Dateien:** `data/rules/default/*.json`, `packages/core/src/rules/load.ts`
- **Tests zuerst:** Regelwerk besteht Schemaprüfung; unbekannter Schlüssel wird abgelehnt;
  jeder Einheitentyp hat Werte gegen **alle** Einheitenklassen.
- **Fertig wenn:** grün.

### T-M3-02 · Produktion
- **Ziel:** Produktionsphase nach Formel D6.1.
- **Anforderungen:** R-ECON-02, R-PROV-04
- **Abhängigkeiten:** T-M3-01, T-M2-02 *(die Produktionstests brauchen die Testkarte)*
- **Dateien:** `packages/core/src/phases/production.ts`
- **Tests zuerst:** Provinz mit bekanntem Vorkommen und Moral 100 liefert exakt den erwarteten
  Wert; Moral 0 halbiert; frisch erobert halbiert zusätzlich.
- **Fertig wenn:** grün.

### T-M3-03 · Verbrauch, Lagergrenzen, Mangel
- **Ziel:** Unterhaltsphase, Deckelung, Mangelfolgen nach D6.2.
- **Anforderungen:** R-ECON-03/AK1, R-ECON-04
- **Abhängigkeiten:** T-M3-02
- **Dateien:** `packages/core/src/phases/upkeep.ts`
- **Tests zuerst:** Bestände werden nie negativ; Mangel setzt Flag und Malus; Überschuss über
  Lagergrenze verfällt nach Regel.
- **Fertig wenn:** grün; Property-Test „nie negativ“ über zufällige Zustände.

### T-M3-04 · Gebäude bauen
- **Ziel:** `BUILD`/`CANCEL_BUILD`, Baufortschritt, Fertigstellung, Abbruch bei Eigentümerwechsel.
- **Anforderungen:** R-PROV-01/AK1/AK2, R-PROV-02
- **Abhängigkeiten:** T-M3-03
- **Dateien:** `packages/core/src/phases/construction.ts`, `packages/core/src/commands/build.ts`
- **Tests zuerst:** Kosten werden sofort abgezogen; Fertigstellung exakt am berechneten Tick;
  Eigentümerwechsel verwirft den Auftrag; Bauen ohne Voraussetzung liefert `MISSING_BUILDING`.
- **Fertig wenn:** grün.

### T-M3-05 · Einheiten rekrutieren
- **Ziel:** `RECRUIT` mit Gebäudevoraussetzung, Warteschlange, Fertigstellung.
- **Anforderungen:** R-UNIT-02, R-PROV-04
- **Abhängigkeiten:** T-M3-04
- **Dateien:** `packages/core/src/phases/recruitment.ts`, `packages/core/src/commands/recruit.ts`
- **Tests zuerst:** Rekrutierung ohne Kaserne scheitert; fertige Einheit erscheint als Armee in
  der Provinz; niedrige Moral verlängert die Dauer nach Formel.
- **Fertig wenn:** grün.

### T-M3-06 · Einfacher Markt
- **Ziel:** `TRADE` mit dynamischem Preis, für alle Spieler gleich (kein Kaufvorteil).
- **Anforderungen:** R-ECON-05, R-FREE-02
- **Abhängigkeiten:** T-M3-03
- **Dateien:** `packages/core/src/commands/trade.ts`, `packages/core/src/rules/market.ts`
- **Tests zuerst:** Preis steigt bei Nachfrage, sinkt bei Angebot; Handel ohne Deckung scheitert;
  zwei Spieler mit gleicher Ausgangslage erhalten exakt denselben Preis.
- **Fertig wenn:** grün.

---

## Meilenstein M4 — Bewegung und Kampf

### T-M4-01 · Armeen: bilden, teilen, zusammenlegen
- **Anforderungen:** R-UNIT-03
- **Abhängigkeiten:** T-M3-05
- **Dateien:** `packages/core/src/commands/army.ts`
- **Tests zuerst:** Teilen erhält die Gesamtzahl der Einheiten; Zusammenlegen nur am selben Ort
  und beim selben Eigentümer; leere Armee wird entfernt.
- **Fertig wenn:** grün; Property-Test „Einheitenerhaltung“.

### T-M4-02 · Bewegung
- **Anforderungen:** R-UNIT-04/AK1, R-UNIT-05
- **Abhängigkeiten:** T-M4-01, T-M2-03
- **Dateien:** `packages/core/src/phases/movement.ts`
- **Tests zuerst:** vorab angezeigte Ankunftszeit **gleich** tatsächlicher Ankunft;
  Aufmarschverzögerung wirkt; Ölmangel halbiert das Tempo; Seetransport nur mit Küstenzugang;
  `STOP_ARMY` hält an der aktuellen Provinz.
- **Fertig wenn:** grün.

### T-M4-03 · Kampfauflösung
- **Anforderungen:** R-BAT-01, R-BAT-02, R-BAT-03, R-BAT-07
- **Abhängigkeiten:** T-M4-02
- **Dateien:** `packages/core/src/phases/combat.ts`
- **Tests zuerst:** Klassenmatrix wirkt (Panzer gegen Infanterie stärker als umgekehrt);
  Festung erhöht die Verteidigung messbar; gleich starke Seiten verlieren beide; Kampfbericht
  vollständig. Dazu die vier Grenzfälle, an denen naive Formeln scheitern:
  1. **Stapel-Deckel:** 60 Einheiten richten nicht mehr Schaden an als 50 (belegte Kurve
     20 → 50), 20 Einheiten tragen voll bei.
  2. **Kein Verpuffen:** Eine reine Panzerarmee gegen reine Infanterie richtet vollen Schaden
     an — der Anteil gegen nicht anwesende Klassen fließt in die vorhandenen.
  3. **Kein Nullschaden:** Auch bei maximaler Verteidigung bleibt der Schaden ≥ Mindestwert;
     ein Kampf endet garantiert (Test: Kampf löst sich innerhalb von N Ticks auf).
  4. **Spiegelung:** Vertauschen der Seiten liefert exakt gespiegelte Ergebnisse.
  Sowie: Kampf mit **drei** Parteien in derselben Provinz löst sich korrekt auf.
- **Fertig wenn:** grün; Property-Tests über zufällige Armeen: keine Kampfkraft entsteht aus
  dem Nichts, Trefferpunkte fallen während eines Kampfes monoton, der zugefügte Schaden
  übersteigt nie die Kapazität der Gegenseite.

### T-M4-04 · Bombardement und Rückzug
- **Anforderungen:** R-BAT-05, R-BAT-06
- **Abhängigkeiten:** T-M4-03
- **Dateien:** `packages/core/src/commands/bombard.ts`, `packages/core/src/phases/combat.ts`
- **Tests zuerst:** Bombardement verursacht Schaden ohne Gegenschaden und erobert nichts;
  Rückzug bringt die Armee in die Ausgangsprovinz zurück und kostet den definierten Nachteil.
- **Fertig wenn:** grün.

### T-M4-05 · Einheitenzustand: Schaden, Regeneration, Rückzugsfolgen
- **Anforderungen:** R-UNIT-07
- **Abhängigkeiten:** T-M4-04
- **Dateien:** `packages/core/src/phases/regeneration.ts`
- **Tests zuerst:** eine Armee mit halber Stärke regeneriert in eigener Provinz je Tick um
  `REGEN_RATE` bis zum Höchstwert, in fremder Provinz nicht; Regeneration setzt bei Kampf aus;
  Einheitenmoral folgt derselben Regel.
- **Fertig wenn:** grün.

### T-M4-05b · Seetransport
- **Ziel:** Ohne dieses Stück bleibt jede Partie auf dem eigenen Kontinent gefangen.
- **Anforderungen:** R-UNIT-06/AK1
- **Abhängigkeiten:** T-M4-05
- **Dateien:** `packages/core/src/phases/transport.ts`
- **Tests zuerst:** Kapazität begrenzt die Zuladung; Ein- und Ausschiffung dauern die belegten
  Zeiten (an feindlicher Küste das Anderthalbfache); eingeschiffte Verbände kämpfen nicht und
  gehen mit dem Schiff verloren; eine Landung an verteidigter Küste erhält den Angriffsmalus;
  eine Landarmee erreicht einen anderen Kontinent ausschließlich per Transport.
- **Fertig wenn:** grün.

### T-M4-05c · Luftstreitkräfte als Fernwaffe
- **Anforderungen:** R-UNIT-08, R-BAT-06
- **Abhängigkeiten:** T-M4-05b
- **Dateien:** `packages/core/src/phases/air.ts`
- **Tests zuerst:** Flugzeuge wirken nur im Umkreis ihres Flugplatzes, erobern nichts, stehen
  nach dem Einsatz die vorgesehene Zeit am Boden und verlegen nur zwischen eigenen Flugplätzen;
  ohne Flugplatz keine Rekrutierung.
- **Fertig wenn:** grün.

### T-M4-06 · Durchstich: kopflose Minimalpartie ⭐
- **Ziel:** Der erste durchgehende Nachweis, dass die Regeln als **Spiel** funktionieren —
  bewusst früh, lange vor der Oberfläche.
- **Anforderungen:** R-ARCH-03 (Abnahmekriterium AK-1)
- **Abhängigkeiten:** T-M4-05c
- **Dateien:** `apps/headless/src/run.ts` *(hier entstanden, in M8 ausgebaut)*
- **Tests zuerst:** 2 Spieler, Testkarte, 500 Ticks, festes Kommandoskript — bauen,
  rekrutieren, marschieren, kämpfen, Provinz erobern. Der Lauf endet fehlerfrei, der
  Endzustands-Hash ist als Golden-Master festgeschrieben, und das Ereignisprotokoll enthält
  mindestens je ein `BUILD_COMPLETED`, `UNIT_RECRUITED`, `ARMY_ARRIVED`, `BATTLE_RESOLVED`,
  `PROVINCE_CAPTURED`.
- **Fertig wenn:** grün. **Ab hier ist das Spiel kopflos spielbar** — jede folgende Aufgabe
  darf diesen Durchstich nicht brechen.

---

## Meilenstein M5 — Moral, Eroberung, Sieg

### T-M5-01 · Moral
- **Anforderungen:** R-PROV-03/AK1, R-PROV-04
- **Abhängigkeiten:** T-M4-06
- **Dateien:** `packages/core/src/phases/morale.ts`
- **Tests zuerst:** jeder Term der Formel D6.3 einzeln geprüft; Moral bleibt in 0..100;
  Änderungsrate pro Tag begrenzt.
- **Fertig wenn:** grün.

### T-M5-02 · Eroberung und Aufstände
- **Anforderungen:** R-BAT-04, R-PROV-03/AK1
- **Abhängigkeiten:** T-M5-01
- **Dateien:** `packages/core/src/phases/occupation.ts`
- **Tests zuerst:** Provinz wechselt nur ohne Verteidiger; Moralmalus wird gesetzt; Aufstand
  tritt bei niedriger Moral reproduzierbar (fester Seed) ein und erzeugt eine Rebellenarmee.
- **Fertig wenn:** grün.

### T-M5-03 · Hauptstadt, Punkte, Sieg, Ausscheiden
- **Anforderungen:** R-PROV-05, R-GAME-02, R-GAME-01
- **Abhängigkeiten:** T-M5-02
- **Dateien:** `packages/core/src/phases/scoring.ts`, `packages/core/src/rules/victory.ts`
- **Tests zuerst:** alle drei Siegbedingungen lösen korrekt aus; Spieler ohne Provinzen scheidet
  aus; Hauptstadtverlust hat die definierte Folge.
- **Fertig wenn:** grün.

### T-M5-04 · Ereignisprotokoll
- **Anforderungen:** R-GAME-06
- **Abhängigkeiten:** T-M5-03
- **Dateien:** `packages/core/src/events/*.ts`
- **Tests zuerst:** jedes relevante Vorkommnis erzeugt genau ein typisiertes Ereignis;
  Ringpuffer verwirft die ältesten; Filterung nach Art und Spieler funktioniert.
- **Fertig wenn:** grün.

### T-M5-05 · Hot-Seat-Partie mit zwei menschlichen Spielern
- **Ziel:** Der Nachweis, dass die Multiplayer-Vorbereitung trägt — dauerhaft grün gehalten.
- **Anforderungen:** R-ARCH-04/AK1
- **Abhängigkeiten:** T-M5-03
- **Dateien:** `packages/core/test/hotseat.test.ts`
- **Tests zuerst:** Partie mit zwei Spielern vom Typ „menschlich“ läuft 200 Ticks; beide
  Kommandoströme werden tickgenau angewandt; der Endzustands-Hash ist reproduzierbar; kein
  Sonderpfad im Kern nötig.
- **Fertig wenn:** grün.

### T-M5-06 · Kennzahlenbericht nach Fertigstellung der Kernregeln
- **Ziel:** Frühwarnung vor Balancing-Ausreißern, bevor Karte, KI und Oberfläche darauf aufbauen.
- **Anforderungen:** R-ECON-03, Design D16
- **Abhängigkeiten:** T-M5-05, T-M4-06
- **Dateien:** `docs/reports/m5-balance.md`
- **Tests zuerst:** automatisierter Lauf über 200 Spieltage misst Wirtschaftswachstum,
  Partiedauer und Siegverteilung; Test schlägt fehl, wenn eine Ressource unbegrenzt wächst
  (Bestand am Ende > 100-fache des Tagesumsatzes).
- **Fertig wenn:** grün; Bericht geschrieben und in `PROGRESS.md` verlinkt.

---

## Meilenstein M6 — Diplomatie (Grundzüge) und Sichtbarkeit

### T-M6-01 · Diplomatische Zustände
- **Anforderungen:** R-DIP-01, R-DIP-02
- **Abhängigkeiten:** T-M5-03
- **Dateien:** `packages/core/src/phases/diplomacy.ts`, `packages/core/src/commands/diplomacy.ts`
- **Tests zuerst:** Kriegserklärung wird erst nach Vorlaufzeit wirksam; Angriff ohne Erklärung
  kostet Ansehen; Bündnis verhindert Angriff; Waffenstillstand läuft ab.
- **Fertig wenn:** grün.

### T-M6-02 · Öffentliche Sicht (Nebel des Krieges)
- **Anforderungen:** R-DIP-04, R-AI-01
- **Abhängigkeiten:** T-M6-01
- **Dateien:** `packages/core/src/view/publicView.ts`
- **Tests zuerst:** ferne feindliche Armeen fehlen in der Sicht; geteilte Karte zeigt mehr;
  die Sicht enthält **keine** Felder, die ein Spieler nicht kennen darf (Schnappschuss-Test);
  der Rückgabetyp ist nicht `GameState` (Typprüfung).
- **Fertig wenn:** grün.

### T-M6-03 · Aufklärungswissen
- **Ziel:** Der zuletzt bekannte Stand fremder Provinzen überlebt Speichern und Laden — sonst
  ist der Nebel des Krieges nach jedem Laden zurückgesetzt.
- **Anforderungen:** R-DIP-04/AK1
- **Abhängigkeiten:** T-M6-02
- **Dateien:** `packages/core/src/view/intel.ts`
- **Tests zuerst:** Beim Verlassen des Sichtbereichs bleibt der letzte bekannte Stand mit
  Zeitstempel erhalten; er altert sichtbar; nach Speichern und Laden ist er unverändert.
- **Fertig wenn:** grün.

---

## Meilenstein M7 — Computergegner

### T-M7-00 · KI-Gedächtnis im Spielzustand
- **Ziel:** Die KI merkt sich ihre Pläne zwischen den Takten — und über das Speichern hinweg.
  **Vor** T-M7-01, weil es sonst ein Umbau quer durch Kern, KI und Persistenz wird.
- **Anforderungen:** R-AI-07/AK1, R-GAME-03
- **Abhängigkeiten:** T-M6-03
- **Dateien:** `packages/core/src/state/types.ts` (`AiMemory`), `packages/ai/src/memory.ts`
- **Tests zuerst:** `decide(view, memory, difficulty)` gibt ein neues Gedächtnis zurück;
  nach Speichern und Laden trifft die KI über 50 Ticks dieselben Entscheidungen wie ohne
  Unterbrechung; das Gedächtnis ist JSON-fähig und geht in den Hash ein.
- **Fertig wenn:** grün.

### T-M7-01 · KI-Grundgerüst und Erklärbarkeit
- **Anforderungen:** R-AI-01/AK1, R-AI-05
- **Abhängigkeiten:** T-M7-00
- **Dateien:** `packages/ai/src/decide.ts`, `packages/ai/src/explain.ts`
- **Tests zuerst:** `decide` erhält nur `publicView` (Typprüfung erzwingt es); jeder erzeugte
  Befehl besteht `canApply`; Debug-Ausgabe nennt Ziel, Nutzen und mindestens eine Alternative.
- **Fertig wenn:** grün.

### T-M7-02 · Wirtschafts- und Bau-KI
- **Anforderungen:** R-AI-03
- **Abhängigkeiten:** T-M7-01
- **Dateien:** `packages/ai/src/economy.ts`
- **Tests zuerst:** KI baut bei Ressourcenmangel das passende Gebäude; verschuldet sich nie;
  priorisiert Nahrung bei drohendem Mangel.
- **Fertig wenn:** grün.

### T-M7-02b · Bedrohungskarte und Kräftevergleich
- **Ziel:** Die beiden Hilfsmittel, ohne die „Front halten“ und „aussichtslosen Angriff
  abbrechen“ nicht umsetzbar sind — je einzeln testbar.
- **Anforderungen:** R-AI-03
- **Abhängigkeiten:** T-M7-02
- **Dateien:** `packages/ai/src/threat.ts`, `packages/ai/src/strength.ts`
- **Tests zuerst:** Die Bedrohung einer Provinz steigt mit feindlicher Stärke in Reichweite
  und fällt mit der Entfernung; der Kräftevergleich schätzt eine überlegene Verteidigung
  korrekt als aussichtslos ein; jeder Nutzenterm liefert einen Wert zwischen 0 und 1000.
- **Fertig wenn:** grün.

### T-M7-03 · Militär-KI (Verteidigung, Ziele, Angriff)
- **Anforderungen:** R-AI-03
- **Abhängigkeiten:** T-M7-02b
- **Dateien:** `packages/ai/src/military.ts`, `packages/ai/src/targeting.ts`
- **Tests zuerst:** bei Grenzbedrohung wird verteidigt statt angegriffen; schwaches, wertvolles
  Ziel wird bevorzugt; aussichtsloser Angriff wird abgebrochen (Rückzug).
- **Fertig wenn:** grün.

### T-M7-04 · Diplomatie-KI
- **Anforderungen:** R-DIP-03
- **Abhängigkeiten:** T-M7-03
- **Dateien:** `packages/ai/src/diplomacy.ts`
- **Tests zuerst:** KI nimmt vorteilhaften Frieden an, lehnt nachteiligen ab; erklärt keinen
  Zweifrontenkrieg auf Stufe „leicht“.
- **Fertig wenn:** grün.

### T-M7-05 · Schwierigkeitsgrade und Rechenbudget
- **Anforderungen:** R-AI-02, R-AI-04, R-AI-06
- **Abhängigkeiten:** T-M7-04
- **Dateien:** `packages/ai/src/difficulty.ts`, `packages/core/test/perf/ai.bench.ts`
- **Tests zuerst:** Der Bench schreibt nach `docs/reports/ai-bench.json`, ein
  `ai.budget.test.ts` liest die Datei und schlägt bei Median ≥ 3 ms (8 KI-Spieler) fehl.
  Der Turnierlauf über 50 Partien trägt das Tag `@slow` (Kurzform für `verify`: 3 Partien) und
  weist nach: „schwer“ schlägt „leicht“ in ≥ 70 % der Partien bei festem Seed-Satz.
- **Fertig wenn:** grün; Turnierergebnis in `docs/reports/ai-tournament.md` festgehalten.

---

## Meilenstein M8 — Persistenz, Headless-Runner, Langlauf

### T-M8-00 · Speicher-Schnittstelle (Tauri / Node / Speicher)
- **Ziel:** Persistenz hängt nicht am Betriebssystem — sonst ist sie weder headless noch im
  Browser-Build testbar.
- **Anforderungen:** R-GAME-03, R-GAME-04, C-02
- **Abhängigkeiten:** T-M5-04
- **Dateien:** `packages/core/src/persistence/StoragePort.ts`,
  `apps/desktop/src/storage/TauriStorage.ts`, `apps/headless/src/storage/NodeStorage.ts`,
  `packages/testkit/src/MemoryStorage.ts`
- **Tests zuerst:** dieselbe Vertragstestreihe (`list`, `read`, `write`, `remove`, Fehler bei
  unbekanntem Namen) läuft gegen alle drei Umsetzungen.
- **Fertig wenn:** grün.

### T-M8-01 · Speichern und Laden
- **Anforderungen:** R-GAME-03/AK1, R-GAME-05
- **Abhängigkeiten:** T-M8-00
- **Dateien:** `packages/core/src/persistence/{save,load,migrate}.ts`
- **Tests zuerst:** Hash-Gleichheit nach Speichern/Laden; unbekannte Version wird abgelehnt;
  Migration von einer künstlichen Vorversion funktioniert.
- **Fertig wenn:** grün.

### T-M8-02 · Headless-Runner
- **Anforderungen:** R-ARCH-03, R-AI-06
- **Abhängigkeiten:** T-M8-01, T-M7-05
- **Dateien:** `apps/headless/src/{run,tournament,replay,bench}.ts`
- **Tests zuerst:** Replay aus Seed + Kommandolog erzeugt denselben Endzustand; Turnier liefert
  reproduzierbare Siegquoten.
- **Fertig wenn:** `pnpm sim:long`, `pnpm sim:tournament`, `pnpm bench` laufen fehlerfrei.

### T-M8-03 · Langlauf und Performancebudget
- **Anforderungen:** R-ARCH-06/AK1, Abnahmekriterium 6
- **Abhängigkeiten:** T-M8-02
- **Dateien:** `packages/core/test/perf/tick.bench.ts`, `docs/reports/performance.md`
- **Tests zuerst:** Der Bench schreibt nach `docs/reports/tick-bench.json`; ein
  `tick.budget.test.ts` schlägt fehl, sobald der Median 0,5 ms oder das 99. Perzentil 2 ms
  überschreitet (200 Provinzen, 8 Spieler, 400 Armeen). Der Langlauf über 1000 Spieltage trägt `@slow` und prüft zusätzlich,
  dass der Speicherverbrauch nicht unbegrenzt wächst (Ereignis-Ringpuffer greift).
- **Fertig wenn:** grün — einschließlich `pnpm test:slow`; Messwerte im Bericht.

---

## Meilenstein M9 — Weltkarte

### T-M9-00 · Provinzliste kuratieren (Handarbeit, kein Skript)
- **Ziel:** Der Zuschnitt der Weltkarte wird von Hand festgelegt. Die Rohdaten enthalten rund
  4600 Verwaltungseinheiten mit völlig ungleicher Körnung — ein Skript kann daraus keine
  spielbare Karte ableiten. **Aufwand realistisch veranschlagen: 1–2 Arbeitstage.**
- **Anforderungen:** R-MAP-01, R-MAP-03, C-03
- **Abhängigkeiten:** T-M9-01
- **Dateien:** `data/maps/world-provinces.csv`, `data/maps/world-sealinks.csv`
- **Tests zuerst:** Die Tabelle enthält 150–250 Zeilen mit eindeutiger Kennung; jede
  Verwaltungseinheit der Rohdaten ist genau einer Provinz zugeordnet oder ausdrücklich
  ausgeschlossen; jede Startnation hat mindestens drei Provinzen; jede Seeroute verbindet zwei
  Küstenprovinzen.
- **Fertig wenn:** grün.

### T-M9-01 · Geodaten beschaffen und aufbereiten
- **Anforderungen:** R-MAP-04, R-ASSET-02
- **Abhängigkeiten:** T-M2-01
- **Dateien:** `packages/mapgen/src/{fetch,simplify,project}.ts`, `docs/ASSETS.md`
- **Tests zuerst:** Lizenz- und Herkunftseintrag vorhanden; Projektion ist umkehrbar
  (Hin- und Rückrechnung innerhalb Toleranz).
- **Fertig wenn:** grün. **Achtung:** Datenbeschaffung erfordert einen Download — dafür ist
  Noahs Freigabe einzuholen (siehe `AGENT-EXECUTION.md`, Abschnitt „Wann du fragst“).

### T-M9-02a · Provinzauswahl und Zusammenfassungsregeln
- **Anforderungen:** R-MAP-01, R-MAP-03
- **Abhängigkeiten:** T-M9-00
- **Dateien:** `packages/mapgen/src/provinces.ts`, `data/mapgen/merge-rules.json`
- **Tests zuerst:** die Regeldatei legt je Land (ISO-Code) Zielprovinzzahl und
  Zusammenfassungsstrategie fest; das Ergebnis liegt bei 150–250 Provinzen; kein Land ohne
  Provinz; keine Provinz ohne Fläche.
- **Fertig wenn:** grün.

### T-M9-02b · Nachbarschaft und Kanten
- **Anforderungen:** R-MAP-01, R-MAP-02/AK2
- **Abhängigkeiten:** T-M9-02a
- **Dateien:** `packages/mapgen/src/adjacency.ts`
- **Tests zuerst:** Nachbarschaft aus gemeinsamen Polygonkanten ist symmetrisch; der Landgraph
  ist zusammenhängend (Inseln ausgenommen); jede Kante trägt eine plausible `distanceKm`
  (Schwerpunktabstand, Toleranz gegen bekannte Referenzstrecken); Enklaven werden erkannt.
- **Fertig wenn:** grün.

### T-M9-02c · Seewege und Datumsgrenze
- **Anforderungen:** R-MAP-01, R-UNIT-06
- **Abhängigkeiten:** T-M9-02b
- **Dateien:** `packages/mapgen/src/sealinks.ts`
- **Tests zuerst:** jede Küstenprovinz hat mindestens einen Seeweg; Seewege überspringen keine
  Landmasse; Provinzen beiderseits der Datumsgrenze sind korrekt verbunden (kein Sprung über
  die halbe Welt); Meerengen sind als `crossing: 'strait'` markiert.
- **Fertig wenn:** grün; `data/maps/world.json` erzeugt und eingecheckt.

### T-M9-03 · Anreicherung und Startaufstellung
- **Anforderungen:** R-MAP-03, R-GAME-01
- **Abhängigkeiten:** T-M9-02c
- **Dateien:** `packages/mapgen/src/enrich.ts`, `data/maps/world.json`
- **Messgröße (verbindlich):** `startwert(nation) = 10 × Provinzen + 2 × Σ gewichtete Vorkommen
  + 1 × Bevölkerung/1000`; die Gewichte stehen in `data/rules/default/ai.json`.
- **Tests zuerst:** Ressourcen-, Bevölkerungs- und Geländeverteilung innerhalb der in
  `merge-rules.json` hinterlegten Zielkorridore; die Abweichung jeder Startnation vom Median
  aller Startnationen liegt unter 15 %.
- **Fertig wenn:** grün; Kartenbericht in `docs/reports/map.md`.

### T-M9-04 · Kernregeln auf der Weltkarte
- **Anforderungen:** R-ARCH-06/AK1
- **Abhängigkeiten:** T-M9-03, T-M8-03
- **Tests zuerst:** Langlauf auf der echten Weltkarte hält das Performancebudget und läuft
  1000 Spieltage ohne Fehler.
- **Fertig wenn:** grün.

---

## Meilenstein M10 — Oberfläche: Gerüst und Design-Gate

### T-M10-01 · Design-Gate: Mockup vorlegen ⛔ **Haltepunkt**
- **Ziel:** Visuelles Konzept (Farb-/Typo-Tokens, Kartenansicht, Provinzpanel, Kopfleiste,
  Ereignisleiste) als Artifact zur Freigabe durch Noah.
- **Anforderungen:** R-UI-01, R-UI-04
- **Abhängigkeiten:** T-M8-03
- **Dateien:** `docs/design/ui-mockup.html`, `docs/design/tokens.md`
- **Fertig wenn:** **Noah hat freigegeben.** Ohne Freigabe wird T-M10-03 ff. nicht begonnen.

### T-M10-01b · Design-Tokens und Kontrastprüfung
- **Ziel:** Die freigegebene Optik wird zu Code — und bleibt nachweislich lesbar.
- **Anforderungen:** R-UI-02
- **Abhängigkeiten:** T-M10-01
- **Dateien:** `apps/desktop/src/ui/tokens.ts`
- **Tests zuerst:** `tokens.contrast.test.ts` — für jedes Paar aus Textfarbe und zugehöriger
  Hintergrundfarbe ist das WCAG-Kontrastverhältnis ≥ 4,5:1 (≥ 3:1 für Schrift ab 24 px);
  eine Lint-Regel verbietet Farbliterale in Komponenten.
- **Fertig wenn:** grün.

### T-M10-02 · Simulations-Host im Worker
- **Anforderungen:** R-TIME-02/AK1/AK2/AK3, R-TIME-03/AK1, R-DIP-04/AK2
- **Abhängigkeiten:** T-M8-01
- **Dateien:** `apps/desktop/src/sim/{SimHost.ts,worker.ts}`
- **Tests zuerst:** Pause führt keinen Tick aus; die Rate hält den Sollwert bis 100 im
  Toleranzband; bei Überlast entfällt kein Tick, der Rückstand bleibt auf 2 Ticks gedeckelt;
  Vorspulen erreicht mindestens 500 Spielstunden/s und stoppt bei Alarmereignis mit korrektem
  Grund; der Worker sendet ausschließlich die spielerbezogene Sicht, nie den Spielzustand.
- **Fertig wenn:** grün.

### T-M10-03a · Kartenansicht: Zeichnen und Auswahl
- **Anforderungen:** R-MAP-05, R-UI-03
- **Abhängigkeiten:** T-M10-01b, T-M10-02
- **Dateien:** `apps/desktop/src/map/{MapCanvas.tsx,layers/*.ts,picking.ts}`
- **Tests zuerst:** Klick trifft die richtige Provinz (Trefferprüfung gegen bekannte Punkte,
  rein geometrisch und damit ohne Browser testbar); Zoom und Verschieben bleiben in Grenzen;
  Ebenenreihenfolge entspricht Design D11.
- **Fertig wenn:** grün.

### T-M10-03b · Kartenmodi und Bildratenbudget
- **Anforderungen:** R-MAP-06, R-ARCH-06/AK2
- **Abhängigkeiten:** T-M10-03a
- **Dateien:** `apps/desktop/src/map/modes.ts`, `apps/desktop/e2e/map-perf.spec.ts`
- **Tests zuerst:** alle vier Kartenmodi färben nach Regel (Einfärbung als reine Funktion
  geprüft); Bildratenmessung als Playwright-Test gegen den Web-Build: 300 Bilder bei
  200 Provinzen, 95. Perzentil der Bildzeit ≤ 16,7 ms.
- **Fertig wenn:** grün.

### T-M10-04 · Kopfleiste: Ressourcen, Zeit, Geschwindigkeit
- **Anforderungen:** R-TIME-02, R-TIME-04, R-ECON-06, R-UI-06
- **Abhängigkeiten:** T-M10-03b
- **Dateien:** `apps/desktop/src/ui/TopBar.tsx`, `apps/desktop/src/ui/SpeedControl.tsx`
- **Tests zuerst:** Regler setzt die Rate; Tastaturkürzel wirken; Bilanzanzeige stimmt mit der
  Simulation überein; Vorspulen-Menü bietet alle Ziele aus R-TIME-03.
- **Fertig wenn:** grün.

### T-M10-05 · Provinz- und Armeepanel
- **Anforderungen:** R-UI-03, R-UI-05, R-PROV-01, R-UNIT-02, R-UNIT-03, R-UNIT-04
- **Abhängigkeiten:** T-M10-04
- **Dateien:** `apps/desktop/src/ui/{ProvincePanel,ArmyPanel}.tsx`
- **Tests zuerst:** nicht bezahlbare Aktionen sind ausgegraut und nennen den Grund; Tooltip
  zeigt Kosten und Dauer; Marschbefehl zeigt vorab die Ankunftszeit; Bau- und Rekrutier-
  Warteschlangen sind bedienbar.
- **Fertig wenn:** grün.

### T-M10-06 · Ereignisleiste, Kampfberichte, Diplomatieübersicht
- **Anforderungen:** R-GAME-06, R-BAT-07, R-DIP-01
- **Abhängigkeiten:** T-M10-05
- **Dateien:** `apps/desktop/src/ui/{EventLog,BattleReport,DiplomacyPanel}.tsx`
- **Tests zuerst:** Klick auf ein Ereignis springt zur Provinz; Kampfbericht zeigt beide Seiten;
  diplomatische Aktionen erzeugen die richtigen Kommandos.
- **Fertig wenn:** grün.

### T-M10-07a · Partie erstellen
- **Anforderungen:** R-GAME-01, R-GAME-02, R-AI-02
- **Abhängigkeiten:** T-M10-06
- **Dateien:** `apps/desktop/src/ui/NewGame.tsx`
- **Tests zuerst:** alle Parameter (Karte, Land, Zahl und Stufe der Gegner, Siegbedingung, Seed)
  landen unverändert im Anfangszustand; ein KI-Ressourcenbonus wird offen angezeigt;
  derselbe Seed erzeugt dieselbe Startaufstellung.
- **Fertig wenn:** grün.

### T-M10-07b · Speichern, Laden, automatisches Speichern
- **Anforderungen:** R-GAME-03, R-GAME-04
- **Abhängigkeiten:** T-M10-07a, T-M8-00
- **Dateien:** `apps/desktop/src/ui/SaveLoad.tsx`
- **Tests zuerst:** Speichern und Laden über die Oberfläche erhält den Zustands-Hash
  (im Test gegen `MemoryStorage`); automatisches Speichern rotiert über fünf Stände;
  ein beschädigter Stand wird mit verständlicher Meldung abgelehnt statt zum Absturz zu führen.
- **Fertig wenn:** grün.

### T-M10-08 · Fehlermeldungen und Rückmeldung bei abgelehnten Aktionen
- **Anforderungen:** R-ARCH-02/AK1, R-GAME-05, R-UI-07
- **Abhängigkeiten:** T-M10-05
- **Dateien:** `apps/desktop/src/ui/errors.ts`, `apps/desktop/src/i18n/de.json`
- **Tests zuerst:** jeder Wert aus `CommandError` hat einen deutschen Meldungstext (Test
  schlägt bei fehlendem Schlüssel fehl); eine abgelehnte Aktion nennt im Tooltip den Grund.
- **Fertig wenn:** grün.

### T-M10-09 · Einstellungen
- **Anforderungen:** R-GAME-04, R-UI-06, R-FREE-05
- **Abhängigkeiten:** T-M10-07b
- **Dateien:** `apps/desktop/src/ui/Settings.tsx`
- **Tests zuerst:** Intervall des automatischen Speicherns ist einstellbar und wirkt auf die
  nächste Rotation; Ton, Tempogrenze und Debug-Modus sind schaltbar; Einstellungen überleben
  einen Neustart.
- **Fertig wenn:** grün.

### T-M10-10 · Debug- und KI-Erklärungsansicht
- **Anforderungen:** R-AI-05, R-AI-02
- **Abhängigkeiten:** T-M10-09
- **Dateien:** `apps/desktop/src/ui/DebugPanel.tsx`
- **Tests zuerst:** die Ansicht zeigt je KI-Spieler das gewählte Ziel, den Nutzenwert und
  mindestens eine Alternative; zusätzlich Kommandolog und Zustands-Hash je Tick; im
  Normalmodus ist sie unsichtbar.
- **Fertig wenn:** grün.

### T-M10-11 · Kartenauswahl
- **Anforderungen:** R-GAME-01, R-MAP-02/AK1, C-03
- **Abhängigkeiten:** T-M10-07a
- **Dateien:** `apps/desktop/src/ui/MapSelect.tsx`, `packages/core/src/map/registry.ts`
- **Tests zuerst:** das Kartenregister listet alle Dateien aus `data/maps/`; eine ungültige
  Karte wird mit Meldung abgelehnt statt zum Absturz zu führen; die Auswahl wirkt auf die Partie.
- **Fertig wenn:** grün.

### T-M10-12 · Bedienbarkeit ohne Maus und Zugänglichkeit
- **Anforderungen:** R-UI-02, R-UI-06, R-UI-05
- **Abhängigkeiten:** T-M10-10, T-M10-11
- **Dateien:** `apps/desktop/src/ui/focus.ts`, `apps/desktop/e2e/a11y.spec.ts`
- **Tests zuerst:** jede Aktion aus R-UI-05 ist per Tastatur erreichbar; sichtbarer Fokusring;
  Schriftgröße ist einstellbar; automatische Zugänglichkeitsprüfung ohne kritische Verstöße.
- **Fertig wenn:** grün.

---

## Meilenstein M11 — Look, Ton, Verpackung

### T-M11-01 · Icons und Kartengrafik
- **Anforderungen:** R-UI-04, R-ASSET-01, R-ASSET-02
- **Abhängigkeiten:** T-M10-12
- **Dateien:** `apps/desktop/src/assets/**`, `docs/ASSETS.md`
- **Tests zuerst:** jedes Asset hat einen Lizenzeintrag; keine Datei ohne Herkunftsnachweis.
- **Fertig wenn:** grün; Einheiten-, Gebäude- und Ressourcen-Icons vollständig.

### T-M11-02 · Animationen und Ton
- **Anforderungen:** R-UI-04
- **Abhängigkeiten:** T-M11-01
- **Dateien:** `apps/desktop/src/fx/*`, `apps/desktop/src/audio/*`
- **Tests zuerst:** Ton lässt sich abschalten und ist standardmäßig leise; Animationen laufen
  bei hoher Spielgeschwindigkeit nicht auf (Zeitraffer-Test).
- **Fertig wenn:** grün.

### T-M11-03 · Tauri-Verpackung
- **Anforderungen:** C-02, R-FREE-04/AK1
- **Abhängigkeiten:** T-M11-02
- **Dateien:** `apps/desktop/src-tauri/**`
- **Tests zuerst:** Berechtigungen erlauben nur Dateisystemzugriff im Spielordner; kein
  Netzwerkzugriff möglich; Savegames landen im vorgesehenen Verzeichnis.
- **Fertig wenn:** `pnpm tauri:build` erzeugt ein startfähiges Programm; Guard-Test grün.

### T-M11-04 · Lokalisierung
- **Anforderungen:** R-UI-07
- **Abhängigkeiten:** T-M11-02
- **Dateien:** `apps/desktop/src/i18n/de.json`
- **Tests zuerst:** keine fest verdrahteten Anzeigetexte in Komponenten; jeder Schlüssel ist
  belegt; fehlender Schlüssel schlägt im Test fehl.
- **Fertig wenn:** grün.

---

## Meilenstein M12 — Abnahme

### T-M12-00 · Balancing-Werkzeug: Parameterlauf und Kennzahlen
- **Ziel:** Balancing wird gemessen, nicht geraten.
- **Anforderungen:** R-AI-06, Design D17
- **Abhängigkeiten:** T-M9-04, T-M7-05
- **Dateien:** `apps/headless/src/sweep.ts`, `docs/reports/balance-sweep.md`
- **Tests zuerst:** `pnpm balance:sweep` variiert jede Konstante um ±25 % und misst
  Partiedauer, Siegverteilung und Wirtschaftskurve; das Werkzeug meldet Konstanten, deren
  Änderung den Ausgang um mehr als einen festgelegten Schwellwert kippt.
- **Fertig wenn:** grün; Bericht geschrieben.

### T-M12-01 · Balancing festschreiben
- **Anforderungen:** R-ECON-01, R-UNIT-01, D17
- **Abhängigkeiten:** T-M12-00
- **Dateien:** `docs/plan/BALANCING.md`, `data/rules/default/*.json`
- **Fertig wenn:** jede Zahl ist als *belegt* oder *geschätzt* markiert; Turnier- und
  Langlaufkennzahlen zeigen keine ausartende Wirtschaft und keine unbesiegbare Strategie.

### T-M12-02 · Spielanleitung und Playtest-Vorlage
- **Anforderungen:** Abnahmekriterium 7
- **Abhängigkeiten:** T-M11-03
- **Dateien:** `docs/PLAYTEST.md`, `docs/ANLEITUNG.md`
- **Tests zuerst:** `docs/PLAYTEST.md` enthält je Anforderungsbereich (R-ECON, R-PROV, R-UNIT,
  R-BAT, R-DIP, R-AI, R-TIME, R-UI) mindestens eine Prüffrage mit Anforderungs-ID; ein Test
  prüft die Abdeckung dieser Präfixe.
- **Fertig wenn:** grün; Anleitung erklärt Bedienung und Geschwindigkeitsregler.

### T-M12-02b · Einstiegshilfe für die erste Partie
- **Anforderungen:** R-UI-05
- **Abhängigkeiten:** T-M12-02
- **Dateien:** `apps/desktop/src/ui/Onboarding.tsx`
- **Tests zuerst:** fünf geführte Schritte (Provinz wählen, Gebäude bauen, Einheit rekrutieren,
  Armee bewegen, Geschwindigkeit regeln) erscheinen nur in der ersten Partie, sind abschaltbar
  und blockieren keine Eingabe.
- **Fertig wenn:** grün.

### T-M12-03 · Abnahmelauf ⛔ **Haltepunkt**
- **Anforderungen:** alle Abnahmekriterien aus `01-REQUIREMENTS.md` §3
- **Abhängigkeiten:** T-M12-01, T-M12-02b
- **Fertig wenn:** `pnpm verify`, `pnpm test:slow` und `pnpm coverage:requirements` sind **alle
  drei grün** (letzteres hier zum ersten Mal verpflichtend); alle sieben Abnahmekriterien sind
  nachweislich erfüllt; **Noah hat den Playtest durchgeführt und abgenommen.**

---

---

## Meilenstein M13 — Eine Oberfläche, die man ansieht

> **Warum es diesen Meilenstein gibt.** Die V1 zeigt alles, was sie weiß — als Wort und als
> Zahl. Moral steht als „70 %“ da, Vorkommen als „5 Nahrung, 2 Kohle, 1 Eisen“, und unter drei
> gesperrten Knöpfen steht dreimal derselbe Absagesatz. Gleichzeitig liegen Symbolsatz, Ton und
> Einstiegshilfe fertig und getestet im Verzeichnis, ohne dass eine einzige Zeile der Anwendung
> sie einbindet. M13 räumt beides auf: erst die tote Bausubstanz verdrahten, dann Text durch
> Anzeigen ersetzen. Design: **D18**.
>
> **Zwei Regeln gelten in jeder Aufgabe dieses Meilensteins.** Erstens: Eine neue Anzeige
> **ersetzt** den Text, den sie ablöst — sie tritt nicht daneben. Zweitens: Jedes Symbol und
> jeder Balken trägt seine Textfassung für Screenreader; grafisch heißt nicht wortlos.

### T-M13-01 · Symbole erreichen die Oberfläche
- **Ziel:** Der vorhandene Symbolsatz erscheint überall dort, wo Einheiten, Gebäude, Rohstoffe
  und Warnungen vorkommen — Kopfleiste, Provinzpanel, Armeepanel, Bau- und Aushebeknöpfe.
- **Anforderungen:** R-UI-10, R-UI-04
- **Abhängigkeiten:** —
- **Dateien:** `apps/desktop/src/ui/IconRow.tsx`, `apps/desktop/src/ui/icons.tsx`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Header.tsx`,
  `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** `apps/desktop/src/ui/IconRow.test.tsx` — eine Symbolzeile zeigt je Eintrag
  Symbol **und** Textfassung, fasst gleiche Einträge mit Anzahl zusammen und deckelt die
  Zeilenlänge. `Panels.test.tsx` — jeder Bauknopf trägt das Symbol seines Gebäudes, jeder
  Aushebeknopf das seiner Gattung; für jeden Schlüssel aus den Regeln existiert eine Zuordnung
  (kein Gebäude ohne Symbol).
- **Fertig wenn:** grün; im laufenden Spiel steht neben jedem Gebäude-, Einheiten- und
  Rohstoffnamen sein Symbol.

### T-M13-02 · Ton und Einstiegshilfe werden eingeschaltet
- **Ziel:** `ui/sound.ts` hängt an den Kernereignissen (Kampf, Eroberung, Fertigstellung,
  Kriegserklärung, Mangel) und gehorcht der Toneinstellung; die fünf Schritte aus
  `game/tutorial.ts` erscheinen in der ersten Partie neben dem Spiel.
- **Anforderungen:** R-UI-04, R-UI-05
- **Abhängigkeiten:** —
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Tutorial.tsx`,
  `apps/desktop/src/ui/sound.ts`, `apps/desktop/src/game/tutorial.ts`
- **Tests zuerst:** `App.test.tsx` — ein Kampfereignis im Protokoll löst genau einen Ton aus;
  bei abgeschalteter Toneinstellung keinen; dasselbe Ereignis zweimal gelesen löst nicht zwei
  Töne aus. `Tutorial.test.tsx` — Schritt eins steht in der ersten Partie, die geforderte
  Handlung schließt ihn ab, „nicht mehr zeigen“ hält, und kein Schritt fängt eine Eingabe ab.
- **Fertig wenn:** grün; die Einstellung „Ton“ im Menü hat eine hörbare Wirkung.

### T-M13-03 · Automatisches Speichern tut, was die Einstellung verspricht
- **Ziel:** Das Intervall aus den Einstellungen speichert wirklich, mit Rotation über mehrere
  Stände; die Anwendung sagt kurz, dass sie gespeichert hat.
- **Anforderungen:** R-GAME-04
- **Abhängigkeiten:** —
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/game/saves.ts`
- **Tests zuerst:** `App.test.tsx` — nach Ablauf des eingestellten Intervalls liegt ein
  Automatikstand vor; nach dem vierten liegen weiterhin höchstens drei; ein pausiertes Spiel
  schreibt keinen neuen Stand.
- **Fertig wenn:** grün; die Einstellung ist nicht länger wirkungslos.

### T-M13-04 · Der Guard, der tote Bausubstanz verhindert
- **Ziel:** Ein Test hält fest, dass jedes Modul der Anwendung vom Einstiegspunkt aus
  erreichbar ist — die Wiederholung des Musters wird maschinell unmöglich.
- **Anforderungen:** R-UI-08
- **Abhängigkeiten:** T-M13-01, T-M13-02, T-M13-03
- **Dateien:** `test/guards/reachability.ts`, `test/guards/ui-reachability.test.ts`
- **Tests zuerst:** Der Guard verfolgt die Importkette ab `apps/desktop/src/main.tsx` und
  meldet jedes nicht erreichte Nicht-Testmodul. Beide Richtungen werden geprüft: die
  verdrahtete Anwendung ist grün, eine Waise wird gefunden. Die Gegenprobe läuft über einen
  **synthetischen Dateisatz** statt über eine Verstoß-Fixture im Produktbaum — eine echte
  Waise unter `apps/desktop/src`, angelegt zum Beweis, dass der Wächter Waisen findet, wäre
  genau das, was er verbieten soll. Ausnahmen sind erlaubt, aber jede trägt im Guard eine
  Begründung in einem Satz (Paketeinstieg `index.ts`, und `sim/worker.ts` mit `SimEngine.ts`
  für den Wechsel in den Hintergrundprozess).
- **Fertig wenn:** grün; `pnpm verify` führt den Guard mit.

### T-M13-05 · Die Sicht liefert, was Anzeigen brauchen
- **Ziel:** `publicView` ergänzt Bauschlange, Aushebeschlange, Moralziel und laufende Kämpfe —
  jeweils nur so weit, wie der Spieler es sehen darf, und nur wenn die Sicht mit Regeln
  angefordert wird. Die Truppenstärke je Provinz bleibt bewusst draußen: `view.armies` ist
  bereits nach Sichtbarkeit gefiltert, eine Summe darüber ist Darstellung (D18.2).
- **Anforderungen:** R-DIP-04, R-UI-09
- **Abhängigkeiten:** —
- **Dateien:** `packages/core/src/view/publicView.ts`, `packages/core/src/view/publicView.test.ts`
- **Tests zuerst:** Für eine fremde Provinz bleiben Bauschlange, Aushebeschlange und Moralziel
  leer, auch wenn sie sichtbar ist; Kämpfe erscheinen nur für sichtbare Provinzen; ohne Regeln
  fehlen alle vier Felder vollständig.
- **Fertig wenn:** grün; der Tickbudget-Test der Weltkarte hält weiterhin sein Budget.

### T-M13-06 · Der Balken als Bauteil, und Moral als erster Fall
- **Ziel:** Ein `Meter`-Bauteil nach D18.1; Moral erscheint als Balken mit Trendpfeil statt als
  Prozentzahl.
- **Anforderungen:** R-UI-09, R-UI-02
- **Abhängigkeiten:** T-M13-05
- **Dateien:** `apps/desktop/src/ui/Meter.tsx`, `apps/desktop/src/ui/Meter.test.tsx`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** Der Balken trägt `role="meter"` mit `aria-valuenow/min/max`, nennt den Wert
  auch als Text, verträgt 0, das Maximum und Werte darüber hinaus ohne Überlauf und benutzt
  ausschließlich Farbtoken. Moral: ein steigendes Moralziel ergibt einen aufwärts weisenden
  Trend, ein fallendes einen abwärts weisenden, Gleichstand keinen.
- **Fertig wenn:** grün; die Kontrastprüfung bleibt grün.

### T-M13-07 · Fortschritt sichtbar: Bau, Aushebung, Marsch, Siegziel
- **Ziel:** Jede laufende Sache zeigt, wie weit sie ist — Bauvorhaben und Aushebungen im
  Provinzpanel, der Marsch im Armeepanel, der Anteil am Siegziel in der Kopfleiste.
- **Anforderungen:** R-UI-09, R-UI-13
- **Abhängigkeiten:** T-M13-06
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Header.tsx`,
  `apps/desktop/src/ui/format.ts`
- **Tests zuerst:** Ein Bauvorhaben mit halber Restzeit ergibt einen halb gefüllten Balken und
  nennt die Restzeit in Spielzeit; ein fertiggestelltes verschwindet; eine Armee ohne Marsch
  zeigt keinen Fortschrittsbalken; der Siegzielbalken steht auf dem Punkteanteil aus der Sicht.
- **Fertig wenn:** grün; keine Restzeit wird in der Oberfläche nachgerechnet — sie kommt aus
  der Sicht.

### T-M13-08 · Die Karte beschriftet sich und erklärt ihre Farben
- **Ziel:** Provinznamen ab der festgelegten Zoomstufe, Legende zum aktiven Kartenmodus.
- **Anforderungen:** R-UI-12, R-MAP-05
- **Abhängigkeiten:** —
- **Dateien:** `apps/desktop/src/map/labels.ts`, `apps/desktop/src/map/labels.test.ts`,
  `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/ui/Legend.tsx`
- **Tests zuerst:** `labels.ts` ist eine reine Funktion und bekommt die Textbreite als
  Parameter — jsdom hat kein Canvas und kann keine Schrift messen, also darf die
  Entscheidung nicht im Zeichenaufruf stecken. Oberhalb der Zoomschwelle entsteht keine
  Beschriftung, unterhalb eine je sichtbarer Provinz; ein Name, der breiter ist als seine
  Provinz, entfällt statt überzulaufen; zwei Namen überlappen einander nicht. Die Legende
  zeigt für jeden Modus die Einträge aus `legendFor` und ändert sich mit dem Modus.
- **Fertig wenn:** grün; der Renderbenchmark hält sein Budget auch mit Beschriftung.

### T-M13-09 · Was auf der Karte steht: Hauptstadt, Kampf, Gattung, Marschweg
- **Ziel:** Hauptstadt als Stern, laufender Kampf als Symbol, Armeekasten mit dem Zeichen
  seiner stärksten Gattung, Marschweg und Ziel der gewählten Armee als Linie.
- **Anforderungen:** R-UI-12, R-MAP-05
- **Abhängigkeiten:** T-M13-05
- **Dateien:** `apps/desktop/src/map/markers.ts`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/App.tsx`
- **Tests zuerst:** Eine Armee aus überwiegend Panzern bekommt das Panzerzeichen; ein Kampf in
  einer sichtbaren Provinz erzeugt genau ein Kampfsymbol, einer in einer unsichtbaren keines;
  die Reihenfolge bleibt Gebäude, Armee, Kampf; der Marschweg der ausgewählten Armee wird
  gezeichnet, der einer nicht ausgewählten nicht.
- **Fertig wenn:** grün; im laufenden Spiel ist die eigene Hauptstadt auf einen Blick zu finden.

### T-M13-10 · Kartenmodus „Truppenstärke“ statt eines Modus ohne Daten
- **Ziel:** Der vierte Modus färbt nach sichtbarer Truppenstärke, gerechnet als reine Funktion
  über `view.armies`; „Bedrohung“ entfällt.
- **Anforderungen:** R-MAP-06, R-MAP-07
- **Abhängigkeiten:** T-M13-05
- **Dateien:** `apps/desktop/src/map/modes.ts`, `apps/desktop/src/map/modes.test.ts`,
  `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** Jeder angebotene Modus liefert für eine Beispielpartie mindestens eine
  Provinz mit einer anderen Füllung als „unbekannt“; unsichtbare Provinzen bleiben in jedem
  Modus „unbekannt“; eine starke Provinz ist kräftiger gefärbt als eine schwache.
- **Fertig wenn:** grün; kein Modus in der Auswahl färbt die Welt einfarbig.

### T-M13-11 · Jedes Ding erklärt sich, wo es steht
- **Ziel:** Ein `Explain`-Bauteil zeigt Beschreibung und Kennzahlen zu Gebäude, Einheit,
  Rohstoff, Kartenmodus, Gelände und Beziehungszustand — abrufbar mit Zeiger und Tastatur.
- **Anforderungen:** R-UI-11
- **Abhängigkeiten:** T-M13-01
- **Dateien:** `apps/desktop/src/ui/Explain.tsx`, `apps/desktop/src/ui/Explain.test.tsx`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/i18n/text.test.ts`
- **Tests zuerst:** Für jeden Gebäude-, Einheiten- und Rohstoffschlüssel der Regeln, jeden
  Kartenmodus, jede Geländeart und jeden Beziehungszustand existiert ein Erklärungstext von
  höchstens zwei Sätzen; das Bauteil öffnet mit Tastatur, schließt mit Escape und ist über
  `aria-describedby` mit seinem Ding verbunden; Kosten und Dauer stammen aus den Regeln, nicht
  aus dem Text.
- **Fertig wenn:** grün; kein Ding in der Oberfläche ist ohne Erklärung.

### T-M13-12 · Die Lage der Partie auf einen Blick
- **Ziel:** Eine Lageübersicht (Taste `L`) mit Punktebalken je Macht, Beziehungsfarbe und
  Truppenstärke; ein Abschlussfenster, wenn die Partie entschieden ist.
- **Anforderungen:** R-UI-13, R-GAME-02
- **Abhängigkeiten:** T-M13-05, T-M13-06
- **Dateien:** `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/ui/Standings.test.tsx`,
  `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/keyboard.ts`, `apps/desktop/src/App.tsx`
- **Tests zuerst:** Die Übersicht listet die eigene Macht hervorgehoben und sortiert nach
  Punkten; sie nennt keine Macht, von der der Spieler nichts weiß; ein entschiedenes Spiel
  zeigt genau einmal das Abschlussfenster mit dem richtigen Ausgang und setzt die Uhr auf
  Pause. Das Fenster lässt sich schließen — wer die Karte danach noch ansehen will, darf das;
  ein Spiel, das sich nach dem letzten Zug nicht mehr bedienen lässt, ist kein Abschluss,
  sondern ein Absturz mit Text.
- **Fertig wenn:** grün; Sieg und Niederlage sind im Spiel sichtbar, nicht nur im Zustand.

### T-M13-13 · Meldungen, die sich melden — und ein filterbares Protokoll
- **Ziel:** Angriff, Mangel, Aufstandsgefahr und Fertigstellung erscheinen als Meldung mit
  Symbol und Sprungziel; das Ereignisprotokoll bekommt seine Filter.
- **Anforderungen:** R-UI-14, R-GAME-06
- **Abhängigkeiten:** T-M13-01, T-M13-05
- **Dateien:** `apps/desktop/src/ui/Alerts.tsx`, `apps/desktop/src/ui/Alerts.test.tsx`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/events.ts`
- **Tests zuerst:** Ein Angriff auf eigenes Gebiet erzeugt eine Meldung, ein Angriff anderswo
  nicht; dieselbe Lage erzeugt nicht in jedem Tick eine neue Meldung; ein Klick führt die Karte
  zum Ort; der Filter blendet eine Art vollständig aus und lässt die übrigen unberührt.
- **Fertig wenn:** grün; das Protokoll ist filterbar, wie R-GAME-06 es seit M5 verlangt.

### T-M13-14 · Die Kopfleiste zeigt Vorräte, nicht nur Zahlen
- **Ziel:** Je Rohstoff Symbol, Bestand, Tagesbilanz und — bei negativer Bilanz — die
  Reichweite in Tagen; ein Mangel ist ohne Lesen erkennbar.
- **Anforderungen:** R-UI-09, R-UI-10
- **Abhängigkeiten:** T-M13-01, T-M13-06
- **Dateien:** `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/Header.test.tsx`,
  `apps/desktop/src/ui/format.ts`
- **Tests zuerst:** Bei negativer Bilanz erscheint die Reichweite in Tagen, bei positiver
  nicht; eine Reichweite unter drei Tagen wird als Mangel gekennzeichnet; eine Bilanz von null
  ergibt keine Division durch null.
- **Fertig wenn:** grün; die Kopfleiste beantwortet „reicht das noch?“ ohne Rechnen.

### T-M13-15 · Das Provinzpanel wird aufgeräumt
- **Ziel:** Vorkommen, Gebäude und Absagegründe erscheinen als Symbole und Anzeigen; der Text,
  den sie ablösen, verschwindet. Die Seitenleiste wird kürzer, nicht länger.
- **Anforderungen:** R-UI-09, R-UI-10, R-UI-11
- **Abhängigkeiten:** T-M13-06, T-M13-11
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** Der Ausgangswert wird **vor** dem Umbau gemessen und im Test als Zahl mit
  Datum festgehalten — ein „weniger als vorher“ ohne Vorher-Zahl ist keine Messung, sondern
  eine Behauptung. Danach: Für dieselbe Provinz enthält das Panel weniger sichtbare
  Textzeichen als dieser Ausgangswert; Vorkommen stehen als Symbolzeile mit Anzahl;
  gleichlautende Absagegründe stehen einmal, nicht je Knopf; jede Anzeige behält ihre
  Textfassung für Screenreader.
- **Fertig wenn:** grün; das Panel kommt bei normaler Schriftgröße ohne Rollen aus.

### T-M13-16 · Bewegung, sparsam
- **Ziel:** Kampfring pulsiert, neue Meldung blendet einmal auf, fertiger Bau leuchtet einmal
  auf — und alles hört auf, wenn das System weniger Bewegung verlangt.
- **Anforderungen:** R-UI-04
- **Abhängigkeiten:** T-M13-09, T-M13-13
- **Dateien:** `apps/desktop/src/ui/motion.ts`, `apps/desktop/src/ui/motion.test.ts`,
  `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** Der Puls ist eine reine Funktion der Zeit und wiederholt sich in festem
  Takt; bei `prefers-reduced-motion: reduce` liefert er einen konstanten Wert; keine Animation
  läuft ohne Anlass weiter.
- **Fertig wenn:** grün; im Spiel bewegt sich nichts, was nichts zu sagen hat.

### T-M13-17 · Sichtprüfung im laufenden Spiel und Nachführung der Dokumente
- **Ziel:** Der Ausbau wird im laufenden Programm angesehen und in Kennzahlen vorher/nachher
  festgehalten (Symbole, Anzeigen, Textmenge je Panel — ein Bildschirmfoto belegt nichts,
  was man später nachrechnen könnte); Anleitung, Playtest-Vorlage und Fortschrittsakten
  werden nachgezogen.
- **Anforderungen:** R-UI-02, R-UI-03
- **Abhängigkeiten:** T-M13-04, T-M13-07, T-M13-08, T-M13-10, T-M13-12, T-M13-14, T-M13-15, T-M13-16
- **Dateien:** `docs/ANLEITUNG.md`, `docs/PLAYTEST.md`, `docs/plan/PROGRESS.md`,
  `docs/plan/PROBLEME.md`, `docs/reports/ui-expansion.md`
- **Tests zuerst:** Die Playtest-Vorlage stellt zu jeder neuen Anforderung mindestens eine
  Frage mit ihrer ID; die Anleitung erklärt Lageübersicht, Erklärungen und Kartenmodi.
- **Fertig wenn:** `pnpm verify` und `pnpm coverage:requirements` sind grün; die Kennzahlen
  stehen im Bericht; jede neue Anforderung ist durch einen Test belegt.

## Übersicht: Haltepunkte, an denen Noah gebraucht wird

| Aufgabe | Warum |
|---|---|
| T-M9-01 | Download von Geodaten — Freigabe für externen Bezug |
| T-M10-01 | Design-Gate: Mockup-Freigabe vor dem UI-Bau |
| T-M12-03 | Abnahme-Playtest |

Alles dazwischen ist ohne Rückfrage ausführbar.
