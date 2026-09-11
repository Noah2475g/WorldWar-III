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

**Die beiden Plandateien werden gemeinsam gepflegt (T-M14-01).** Jede Aufgabe steht in
`03-TASKS.md` *und* in `tasks.yaml` mit denselben IDs, denselben `deps` und denselben
Anforderungsbezügen; `test/plan-consistency.test.ts` prüft genau das. `docs/plan/03-TASKS.md`
wird deshalb in den `files`-Listen der einzelnen Aufgaben **nicht** einzeln geführt — sonst
stünde derselbe Pfad in jeder Aufgabe und würde in genau der einen vergessen, in der es darauf
ankommt. Was eine Aufgabe an den Plandateien ändert, sagt ihre DoD.

**Was `files:` und `tests:` bedeuten (T-M14-02).** Beide Listen sind eine Zusage über das
Dateisystem, keine Absichtserklärung: Sobald eine Aufgabe auf `status: done` steht, muss jeder
dort genannte Pfad existieren, und `test/plan-consistency.test.ts` prüft es. Am 2026-09-05
zeigten 79 von 289 Einträgen ins Leere — sämtlich bei `done`-Aufgaben, und niemand hat es
bemerkt, weil kein Prüfer die Felder las.

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
- **Tests zuerst:** Der Bench schreibt nach `docs/reports/tick-bench.json`; er schlägt fehl,
  sobald der Median 0,5 ms oder das 99. Perzentil 2 ms überschreitet. *(Am 2026-09-06
  richtiggestellt: dieser Bench läuft an der Testkarte mit **12** Provinzen und belegt
  R-ARCH-06/AK1 damit nicht — er ist eine Frühwarnung. Die Abnahme der Anforderung liegt seit
  T-M9-04 bei `worldmap.bench.slow.test.ts` an der ausgelieferten Karte, seit dem 2026-09-06
  mit nachgemessenen 3,5 ms / 8 ms.)* Der Langlauf über 1000 Spieltage trägt `@slow` und prüft zusätzlich,
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
- **Abhängigkeiten:** T-M12-01, T-M12-02b, T-M14-15, T-M12-04, T-M12-05, T-M12-06, T-M12-07, T-M12-08, T-M12-09, T-M12-10
- **Fertig wenn:** Abgenommen wird der **V1-Satz**, nicht mehr und nicht weniger: `pnpm verify`
  und `pnpm test:slow` sind grün; `pnpm acceptance` weist alle sieben Abnahmekriterien als
  erfüllt aus, **AK-1 mit eigener Zeile** (`pnpm sim:fullgame`, gebaut in T-M14-14) statt in der
  Sammelzeile AK-1/4/6; `pnpm coverage:requirements` misst den V1-Umfang, den der `scope`-Block
  aus T-M14-01 ausweist, und meldet `V1 offen: 0` — die nach M15 bis M18 vertagten Kennungen aus
  Abschnitt 2.15 zählen nicht dagegen (das ist die Korrektur des Nachtrags 2.15, der 82/82 auf
  82/100 gekippt und diese Zeile unerreichbar gemacht hat); AK-7 ist erfüllt, wenn
  `docs/reports/playtest-v1.md` jede Frage aus `docs/PLAYTEST.md` beantwortet und jedes Nein in
  der Befundtabelle trägt; **Noah hat den Playtest durchgeführt und abgenommen.**

---

---

### Die Befunde des Abnahme-Playtests (2026-09-06)

> Der Playtest wurde am 2026-09-06 von einem Agenten gefahren (`docs/reports/playtest-v1.md`,
> 39 ja · 13 nein · 8 nicht geprüft, zwei Partien bis Spieltag 171). **AK-7 verlangt im
> Wortlaut Noahs Abnahme und bleibt offen** — der Durchgang nimmt ihr nur die Suche ab.
> Diese sieben Aufgaben stehen in `T-M12-03`s Abhängigkeiten: ein Playtest mit dreizehn
> Nein ist kein bestandener Playtest.
>
> **Drei der vier schweren Befunde sind dieselbe Klasse** — die Mechanik ist gebaut und
> funktioniert, und der Weg des Spielers dorthin fehlt oder endet im Nichts. Das ist
> Ursache A aus der Auswertung vom 2026-09-05, zum fünften Mal, diesmal an Stellen, die
> als erledigt gemeldet waren.

### T-M12-04 · Der Abbruchknopf bekommt sein Wort zurück
- **Ziel:** Unter „Im Bau" stand die Zeichenfolge `[province.cancelBuild]`. Der Knopf
  wirkte — Abbruch klappt, 50 % werden erstattet, das Protokoll sagt es —, nur sein Name
  fehlte.
- **Anforderungen:** R-UI-07
- **Abhängigkeiten:** T-M12-02b
- **Dateien:** `apps/desktop/src/game/actions.ts`, `apps/desktop/src/i18n/de.ts`
- **Fertig wenn:** Der Ausreißer ist behoben (`province.` → `actions.`) und die
  Beschriftung nennt das Gebäude, weil eine Provinz mit mehreren Aufträgen sonst mehrere
  gleiche Knöpfe zeigt. **Der eigentliche Teil ist der Wächter:** `text.test.ts` prüft den
  Katalog nur in *einer* Richtung und nie, ob ein vom Code abgefragter Schlüssel existiert
  — verschärfend hat der Sichtbarmacher für fehlende Schlüssel einen eigenen grünen Test,
  der Mechanismus vor dem Spieler war also geprüft. `test/guards/text-keys.test.ts` sammelt
  jeden statisch geschriebenen `t('a.b')`, prüft die Menge auf Nichtleere und nennt die
  Zahl der zusammengesetzten Aufrufe, die er nicht auflösen kann.

### T-M12-05 · Der Startdialog sagt, was Gewinnen heißt
- **Ziel:** Punkte und Eroberung waren wählbar und nirgends erklärt, während das Feld
  darüber („Startzahl") einen erklärenden Satz trug.
- **Anforderungen:** R-GAME-02
- **Abhängigkeiten:** T-M12-02b
- **Dateien:** `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`
- **Fertig wenn:** Der Hinweis nennt die Schwelle aus `newGame.ts` (700 bzw. 1000 von 1000)
  und **wechselt mit der Auswahl** — ein Hinweis, der sich nicht ändert, erklärt keine
  Wahl. Der Test hält Satz und Schwelle zusammen.

### T-M12-06 · Die zweite Partie beginnt wirklich
- **Ziel:** Der Endedialog bietet „Neue Partie" an, und der Klick führt ins Leere: er
  schließt den Dialog, öffnet keinen Startdialog und lässt den Spieler in der beendeten
  Partie zurück (gemessen an Tag 171: Siegziel 0 %, jede Produktion null, keine Dialoge im
  DOM). Nur Neuladen hilft.
- **Anforderungen:** R-GAME-01, R-UI-13
- **Abhängigkeiten:** T-M14-10
- **Dateien:** `apps/desktop/src/App.tsx`
- **Fertig wenn:** ein Test die **Kette** prüft — Partie beenden, „Neue Partie" klicken,
  Startdialog steht da, Partie beginnen, neuer Tag 1, alles ohne Neuladen. **T-M14-10 hat
  genau diesen Weg als erledigt gemeldet**; der Test dort prüft offenbar den Zustand und
  nicht die Sicht, und das ist der eigentliche Befund.

### T-M12-07 · Die Spielstände sind erreichbar, auch nach dem Neustart
- **Ziel:** Der Stand überlebt korrekt (IndexedDB führt `stand-1` nach dem Neuladen), ist
  aber nicht erreichbar: die Liste öffnet **ausschließlich Strg+S**, kein Knopf führt
  dorthin, und ohne laufende Partie wirkt die Tastenkombination nicht. Wer das Fenster
  schließt, kommt an seinen Spielstand nicht mehr heran. Dazu eine Sackgasse: schließt man
  den Startdialog mit dem Kreuz, bleibt „Die Welt wird aufgebaut …" ohne jeden Ausweg.
- **Anforderungen:** R-GAME-03, R-UI-05
- **Abhängigkeiten:** T-M14-08
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Header.tsx`,
  `apps/desktop/src/ui/Dialogs.tsx`
- **Fertig wenn:** die Spielstände ohne Tastatur erreichbar sind, **auch vor der ersten
  Partie**, und der leere Zustand keine Sackgasse mehr ist. R-UI-05 verlangt jede Aktion
  per Klick; eine nur über die Tastatur erreichbare Funktion erfüllt das nicht.

### T-M12-08 · Die Kartenwahl wirkt
- **Ziel:** Blindschalter. „Kleine Welt (12)" gewählt startet weiterhin die Weltkarte —
  gemessen an den Provinznamen (*Mittlerer Westen, Ostkanada* gegen *Hafen, Waldland,
  Bergland* in `testworld.json`). **Befund 38/N10 ist damit nicht geschlossen**, und
  `docs/PLAYTEST.md:149` behauptete das Gegenteil; die Zeile ist berichtigt.
- **Anforderungen:** R-GAME-01
- **Abhängigkeiten:** T-M14-03
- **Dateien:** `apps/desktop/src/main.tsx`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/game/newGame.ts`
- **Fertig wenn:** ein Test die Kette prüft: Karte umstellen, Partie beginnen, **die
  Provinzzahl des Zustands** entspricht der gewählten Karte. Der Test darf **nicht** gegen
  den Dialogzustand prüfen — genau diese Verwechslung hat den Befund entstehen lassen.

### T-M12-09 · Die Meldungen erreichen den Spieler
- **Ziel:** Über zwei vollständige Partien bis Tag 171 — Hauptstadtverlust, Überrennen,
  eigenes Ausscheiden, eigene Gefechte mit Verlusten — erschien **keine einzige** Meldung,
  und der Bereich `.alerts` existierte zu keinem Zeitpunkt im DOM.
- **Anforderungen:** R-UI-14
- **Abhängigkeiten:** T-M13-14
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Alerts.tsx`
- **Fertig wenn:** ein Test **aus einer echten Partie heraus** prüft, dass bei einem
  eigenen Ereignis eine Meldung im Baum steht — nicht, dass `alertsFor` die richtige Liste
  zurückgibt. Ein Einzeltest der Funktion hat den Befund nicht verhindert und wird ihn
  nicht verhindern.

### T-M12-10 · Die kleineren Befunde des Playtests
- **Ziel:** Sechs Befunde, jeder klein, keiner erfunden — Tooltips an den Armeebefehlen,
  die Spalte „Verbrauch" dauerhaft auf 0, das Vorspulen ohne Begründung, Flugplatz und
  Jagdflugzeug mit demselben Symbol, „1 Provinzen" im Endedialog, und die leere
  Debug-Ansicht.
- **Anforderungen:** R-UI-05, R-UI-09, R-UI-10, R-ECON-06, R-TIME-03
- **Abhängigkeiten:** T-M12-04, T-M12-05
- **Dateien:** `apps/desktop/src/game/actions.ts`, `apps/desktop/src/ui/icons.tsx`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/Dialogs.tsx`
- **Fertig wenn:** alle sechs behoben sind. Zur Debug-Ansicht: **entweder sie füllt sich
  oder sie verschwindet** — ein drittes gibt es nicht, sonst bleibt Playtest-Frage 48 mit
  *ja* beantwortet, wo *nein* erwartet ist.

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

---

## Meilenstein M14 — Der Stand wird wieder wahr

> **Warum es diesen Meilenstein gibt.** Am 2026-09-05 ergab eine Auswertung 68 bestätigte
> Befunde. Der größte Teil hat dieselbe Form: *Ein Dokument sagt X, der Code tut Y, und ein
> grüner Test steht daneben.* 79 von 289 Datei- und Testpfaden in `tasks.yaml` existieren
> nicht — sämtlich bei `status: done`. Das Anforderungstor meldet seit dem Nachtrag 2.15
> 82 von 100 und Exit 1. Solange das so ist, ist jede Statusaussage des Projekts wertlos, und
> die Abnahme (T-M12-03) ist unerreichbar. **M14 baut kein Spiel — M14 macht den Bericht über
> das Spiel wieder wahr**, damit alles Spätere etwas beweisen kann.
>
> **Der Meilenstein läuft in sechs Phasen.** Phase 0 ist Buchhaltung, kein Code am Spiel
> (T-M14-01 bis T-M14-03): danach stimmt, was `pnpm coverage:requirements`, `tasks.yaml` und
> `01-REQUIREMENTS.md` über den Stand behaupten. Phase 1 richtet die Messgeräte (T-M14-04,
> T-M14-05), Phase 2 die Kernzahlen des Kampfes (T-M14-06, T-M14-07), Phase 3 die
> Auslieferung (T-M14-08 bis T-M14-10), Phase 4 den Gegner (T-M14-11 bis T-M14-13), Phase 5
> die Abnahme (T-M14-14, T-M14-15).
>
> **Drei Regeln gelten in jeder Aufgabe dieses Meilensteins.** Erstens: **Kein Persistenztest
> läuft ausschließlich gegen `MemoryStorage`** — wer eine Persistenzzusage prüft, prüft sie
> gegen mindestens zwei Umsetzungen, sonst prüft er die Testhilfe und nicht das Spiel.
> Zweitens: **Kennzahlen kommen aus den während des Laufs gesammelten Ereignissen**, nie aus
> `state.eventLog` — der ist ein Ringpuffer über 500 Einträge und hat den Parameterlauf schon
> um den Faktor 16 danebenliegen lassen. Drittens: **Eine Zahl in einer „Fertig wenn"-Zeile,
> die kein Bericht trägt, ist derselbe Fehler wie ein Pfad, der keine Datei trägt** — jede
> Vorher-Zahl wird gemessen und datiert, nicht erinnert.

### T-M14-01 · Der scope-Block bekommt eine Meilensteinachse
- **Ziel:** Das Anforderungstor unterscheidet wieder V1-Pflicht von späterem Umfang: V1 wird
  hart geprüft (Exit 1, sobald eine V1-Anforderung ohne Testbeleg ist), spätere Meilensteine
  erscheinen als Fortschrittsanzeige und ändern den Exit-Code nie. Antwort auf die Befunde 7,
  15 und 22.
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** —
- **Dateien:** `docs/plan/01-REQUIREMENTS.md`, `scripts/requirements-coverage.mjs`,
  `scripts/acceptance.mjs`, `docs/plan/tasks.yaml`, `docs/plan/03-TASKS.md`,
  `test/requirements.test.ts`, `test/plan-consistency.test.ts`
- **Vorgehen (verbindlich):**
  1. **Der Block bekommt ein Fach `later`** — flach im Stil des vorhandenen `v1_partial`
     (`ID: "<Meilenstein> — Begründung"`), damit derselbe YAML-Parser genügt. Einzutragen sind
     genau die 18 IDs aus 2.15 nach Noahs Entscheidung 3: **M15** für R-TECH-01, R-TECH-02,
     R-DIP-06, R-BAT-08, R-AI-08, R-GAME-07, R-TIME-06; **M17** für R-SPY-01…06, R-DIP-05,
     R-DIP-07 sowie R-NEWS-01/02/03 (Letztere mit dem Vermerk, dass sie in M15 durch den
     Filter „Weltgeschehen" ersetzt und dort gestrichen werden).
  2. **Fail-closed.** Die V1-Pflicht ist `ids − v2_only − later`. Eine ID, die in keinem Fach
     steht, bleibt V1-Pflicht — ein künftiger Nachtrag, der den `scope`-Block vergisst, macht
     das Tor wieder rot. Genau das ist erwünscht.
  3. **Ein `later`-Eintrag kostet zwei Angaben.** Wert ohne Meilenstein, ohne Begründung oder
     mit einem Meilenstein, den `tasks.yaml` nicht deklariert → Exit 1.
  4. **Eine maschinenlesbare Zeile.** Das Skript gibt immer — auch bei null — genau eine Zeile
     `V1 offen: N` aus, dazu je Meilenstein eine Fortschrittszeile („M15: 0 von 7 belegt
     (Fortschritt, kein Tor)"). Exit 1 genau dann, wenn `N > 0` oder der Block fehlerhaft ist.
  5. **`scripts/acceptance.mjs` liest diese Zeile** statt der bisherigen Doppelheuristik; der
     Zustand „unbekannt" entfällt, und der Exit-Code von `pnpm coverage:requirements` wird
     nicht maskiert — kein `|| true`.
  6. **AK-2 präzisieren** auf: „…die der `scope`-Block keinem späteren Meilenstein zuweist;
     nachgewiesen dadurch, dass `pnpm coverage:requirements` `V1 offen: 0` meldet und mit
     Exit 0 endet."
  7. **T-M12-03** in beiden Plandateien: `dod` und `gate_reason` auf den V1-Satz fassen
     („`V1 offen: 0`" statt „alle grün"), damit die Abnahme nicht länger an M15 hängt.
  8. **Die Meilensteinachse wird deklariert.** `tasks.yaml` bekommt unter `milestones:`
     **M14 — Der Stand wird wieder wahr**, **M15 — Die KI wird ein Gegner**, **M16 —
     Verpackung als Programm**, **M17 — Tiefe zwischen den Kriegen** und **M18 — Später**;
     `03-TASKS.md` die zugehörigen Überschriften. M16 bis M18 sind zwingend: ohne sie bricht
     jeder `later`-Eintrag, der auf sie zeigt, mit Exit 1 ab (Punkt 3), und ohne M14 fällt
     „jede Aufgabe gehört zu einem deklarierten Meilenstein" bei der ersten neuen Aufgabe.
  9. **Eine Planregel, damit F3 nicht wiederkommt:** Beide Plandateien werden je Aufgabe
     gemeinsam gepflegt; `docs/plan/03-TASKS.md` wird deshalb in den `files`-Listen der
     einzelnen Aufgaben **nicht** mehr einzeln geführt. Die Regel steht in `03-TASKS.md` und
     wird von `test/plan-consistency.test.ts` dadurch gedeckt, dass beide Dateien dieselben
     IDs, deps und Anforderungen tragen.
- **Tests zuerst:** In `test/requirements.test.ts` gegen ein synthetisches Dokument: eine ID im
  Fach `later` erscheint **nicht** unter `missing`, wohl aber in der Fortschrittsliste ihres
  Meilensteins; eine ID, die in keinem Fach steht, bleibt V1-Pflicht; ein `later`-Wert ohne
  Begründung und einer mit unbekanntem Meilenstein führen zu Exit 1; der Skriptlauf gibt
  `V1 offen: <Zahl>` aus und sein Exit-Code stimmt mit dieser Zahl überein. Der bestehende
  Test „schlägt fehl, wenn eine Test-ID entfernt wird" bleibt unverändert grün — er ist der
  Beweis, dass das Tor noch misst. In `test/plan-consistency.test.ts`: jeder im `scope`-Block
  genannte Meilenstein ist in `tasks.yaml` deklariert. Alle diese Prüfungen sind vor der
  Änderung rot.
- **Fertig wenn:** `pnpm coverage:requirements` meldet `V1 offen: 0` und endet mit Exit 0;
  **jede in 2.15 geführte ID trägt ein Fach mit Meilenstein und Begründung, und ohne Fach ist
  sie V1-Pflicht** — die Aufgabe schreibt keine feste Anzahl fest, weil M15 drei IDs streicht
  (T-M15-09); `milestones:` in `tasks.yaml` führt M14, M15, M16, M17 und M18 mit den Titeln
  der Achse vom 2026-09-05; **kein Verweis in 2.14 oder 2.15 nennt einen Meilenstein, den die
  neue Achse nicht kennt** — insbesondere ist der Satz zu R-ECON-05/R-DIP-05 entfernt und der
  Hinweis „R-DIP-01 … sind V2 (M15)" auf M18 gezogen; `pnpm acceptance` führt AK-2 auf die
  Zeile `V1 offen: 0` zurück und meldet es als bestanden; die Planregel aus Punkt 9 steht im
  Vorspann von `03-TASKS.md`; `pnpm verify` ist grün.

### T-M14-02 · Der Plan-Wächter prüft, was `tasks.yaml` behauptet
- **Ziel:** `status: done` heißt wieder, dass die genannten Dateien und Tests existieren. Heute
  zeigen 79 von 289 Einträgen (38 von 174 `files`, 41 von 115 `tests`) in 43 abgeschlossenen
  Aufgaben ins Leere, und kein Prüfer liest diese Felder. Dazu wird der Arbeitsbaum
  aufgeräumt: Solange 15 unversionierte Sondendateien mitlaufen, misst jede „`pnpm verify` ist
  grün"-Zusage eine andere Testmenge als das Projekt. Antwort auf die Befunde 5, 61 und N7
  (gemeinsame Ursache A).
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** T-M14-01
- **Dateien:** `test/plan-paths.ts`, `test/plan-consistency.test.ts`, `docs/plan/tasks.yaml`,
  `docs/plan/PROGRESS.md`, `docs/plan/PROBLEME.md`, `vitest.config.ts`
- **Vorgehen (verbindlich):**
  1. **Die Prüfung als reine Funktion.** Neu: `test/plan-paths.ts` mit
     `missingPaths(tasks, exists)` und `reopenedWithoutReason(tasks)` — reine Funktionen, damit
     sie an erfundenen Aufgabenlisten geprüft werden können. Eine Prüfung, die nur die echte
     Datei liest, wird grün, sobald jemand die Pfade repariert, und beweist danach nichts mehr.
  2. **Der Wächter liest die Felder.** `YamlTask` um `files` und `tests` erweitern; für jede
     Aufgabe mit `status: done` muss jeder Pfad existieren. Ein Eintrag mit Schrägstrich am
     Ende muss ein Verzeichnis sein, jeder andere eine Datei.
  3. **Die 79 Abweichungen einmalig nachziehen.** Der größte Teil ist berechtigtes Umbenennen,
     das nie zurückgeschrieben wurde: `persistence/load.ts` → `persistence/migrate.ts`,
     `test/guards/tauri-permissions.test.ts` → `test/guards/packaging.test.ts`,
     `ui/SaveLoad.tsx` → `ui/Dialogs.tsx`, `ui/TopBar.tsx` → `ui/Header.tsx`,
     `test/playtest-coverage.test.ts` → `test/docs.test.ts`. Die drei E2E-Pfade zeigen auf das,
     was tatsächlich belegt: `e2e/map-perf.spec.ts` → `map/render.bench.slow.test.ts` und
     `map/modes.test.ts`; `e2e/game-flow.spec.ts` → `game/saves.test.ts`; `e2e/a11y.spec.ts` →
     `keyboard.test.ts` und `ui/tokens.contrast.test.ts`. **Zwei Pfade werden ausdrücklich
     nicht umgebogen**, weil sie in M14 wirklich entstehen:
     `packages/core/test/properties/combat-conservation.test.ts` (T-M14-06) und
     `packages/core/src/commands/bombard.test.ts` (T-M14-07).
  4. **Drei Aufgaben zurückstufen** — dort fehlt nicht der Pfad, sondern die Sache. Jede
     bekommt `status: todo` und ein neues Feld `reopened:` mit Befundnummer, einem Satz **und
     der Aufgabe, die sie schließt**:
     - **T-M8-00** (Vertragstestreihe gegen drei Umsetzungen): alle vier genannten Pfade
       fehlen, die „Reihe" ist ein einzelnes `it()` gegen `MemoryStorage` (Befunde 1, 5, 6).
       Begründung: **abgelöst durch T-M14-08; der Datei-Port folgt erst in M16.** Das ist
       ausdrücklich kein `reopened` im Sinne von „wird so noch gebaut" — Entscheidung 2 baut
       ihn nie so.
     - **T-M10-04** (Vorspulen-Menü vollständig): `App.tsx` spult mit `step(ticksPerDay)` genau
       einen Tag vor, `fastForwarding` ist fest verdrahtet, kein Ziel aus R-TIME-03 ist
       wählbar (Befunde 60, 61). Geschlossen von **T-M15-06**.
     - **T-M10-09** (Einstellungen überleben Neustart): `parseSettings` hat außerhalb seines
       eigenen Tests keinen Aufrufer, `Settings.tsx`/`Settings.test.tsx` existieren nicht
       (Befund 61). **Keine Aufgabe in M14 oder M15 schließt das** — in dieser Aufgabe wird
       entweder eine schließende Aufgabe benannt oder die Zusage nach T-M14-03 zurückgenommen;
       dasselbe gilt für `test/guards/fixed-arithmetic.test.ts` aus T-M0-03. Ein fehlender
       Pfad, der keine Umbenennung ist, darf nicht als Umbenennung durchgehen.
  5. **Die Rückstufung darf nicht still sein.** Da `done`-Aufgaben auf die drei zeigen, prüft
     der Wächter zusätzlich: jede Aufgabe mit `status: todo`, von der eine `done`-Aufgabe
     abhängt, trägt eine `reopened:`-Begründung.
  6. **Der Arbeitsbaum wird geräumt.** Die 13 Sonden unter `apps/headless/test/zz*`,
     `packages/core/src/phases/zzz-skeptic-hull.test.ts` und `coverage-audit/` werden gelöscht
     oder als echte Tests aufgenommen; `docs/plan/PROBLEME.md` hält fest, welche von beidem und
     warum.
  7. `PROGRESS.md`: die drei zurückgestuften Zeilen richtigstellen — die Zeile zu **T-M8-00**
     verweist auf T-M14-08, die zu T-M10-04 auf T-M15-06. Damit ist das `dod` von T-M0-05
     („…in IDs, deps, files und requirements überein") erstmals eingelöst statt behauptet.
- **Tests zuerst:** Gegen erfundene Aufgabenlisten: eine `done`-Aufgabe mit dem Pfad
  `gibtsnicht.ts` erscheint in der Fehlerliste, dieselbe Aufgabe mit `status: todo` nicht; ein
  Eintrag mit Schrägstrich am Ende, der auf eine Datei zeigt, ist ein Fehler; eine
  `todo`-Aufgabe mit `done`-Nachfolger und ohne `reopened:` ist ein Fehler. Gegen die echte
  `tasks.yaml`: die Fehlerliste ist leer — dieser Lauf ist vor der Bereinigung rot und nennt
  79 Einträge in 43 Aufgaben.
- **Fertig wenn:** `pnpm verify` ist grün; die Zahl nicht existierender Pfade bei
  `status: done` ist 0 (vorher 79); genau drei Aufgaben stehen auf `todo` und tragen je eine
  `reopened:`-Begründung samt der Aufgabe, die sie schließt; **`git status --short` ist leer**
  und `PROBLEME.md` nennt für jede der 13 Sonden, ob sie gelöscht oder übernommen wurde; der
  Test an der erfundenen Aufgabenliste zeigt, dass ein einziger falscher Pfad in einer
  `done`-Aufgabe den Lauf rot macht.

### T-M14-02b · Das Anforderungstor zählt Akzeptanzkriterien, nicht Namen
- **Ziel:** Eine ID gilt heute als belegt, sobald irgendwo `describe('R-XX-nn'` mit einem
  `expect(` steht — das Akzeptanzkriterium wird nie gelesen (Befund 28). T-M14-01 repariert nur
  den Nenner, nicht den Zähler. Und die Richtung *Anforderung → Aufgabe und Entwurf* prüft
  niemand: genau der Weg, auf dem die 18 IDs aus 2.15 ohne Entwurfstext und ohne Aufgabe grün
  durchliefen (Befund 27). Diese Aufgabe schließt beides, bevor M15 dieselben Buchungen noch
  einmal macht.
- **Anforderungen:** R-ARCH-05
- **Abhängigkeiten:** T-M14-02
- **Dateien:** `scripts/requirements-coverage.mjs`, `docs/plan/01-REQUIREMENTS.md`,
  `docs/plan/tasks.yaml`, `test/requirements.test.ts`, `test/plan-consistency.test.ts`
- **Vorgehen (verbindlich):**
  1. **Der Zähler zählt je Akzeptanzkriterium.** Belegt ist `R-DIP-06/AK1` künftig durch
     `describe('R-DIP-06/AK1 …')` mit mindestens einem `expect(`, nicht durch einen Block, der
     nur die ID nennt. Eine Anforderung ist belegt, wenn **jede** ihrer AK-Nummern belegt ist.
  2. **Eine benannte Übergangsliste** führt die 82 heute auf Namensebene gebuchten IDs auf, je
     mit Datum und dem Satz, dass sie beim nächsten Anfassen auf AK-Ebene nachgezogen werden.
     Die Liste ist eine Schuld mit Namen, keine Ausnahme ohne Ende: sie darf nur schrumpfen,
     und ein Test sichert das zu.
  3. **Die Gegenrichtung.** `plan-consistency` prüft zusätzlich, dass jede V1-pflichtige ID in
     mindestens einer Aufgabe (`requirements:`) **und** in `docs/plan/02-DESIGN.md` vorkommt.
     Eine Anforderung ohne Entwurfstext und ohne Aufgabe ist keine Anforderung, sondern ein
     Wunsch.
- **Tests zuerst:** Gegen ein synthetisches Anforderungsdokument mit drei AK: ein Test, der nur
  `describe('R-XX-01')` trägt, belegt die ID **nicht** mehr; drei Tests mit `AK1`, `AK2`, `AK3`
  belegen sie; fehlt `AK2`, meldet das Skript genau dieses AK und endet mit Exit 1. Die
  Übergangsliste: eine ID, die in ihr steht, bleibt belegt; eine neu hinzugefügte Zeile in der
  Liste ist ein Fehler. Gegen die echten Dokumente: eine V1-ID ohne Aufgabe und eine ohne
  Erwähnung in `02-DESIGN.md` erscheinen je in einer eigenen Fehlerliste. Alle Prüfungen sind
  vor der Änderung rot.
- **Fertig wenn:** `pnpm coverage:requirements` zählt je AK-Nummer, meldet weiterhin
  `V1 offen: 0` und nennt in seiner Ausgabe die Größe der Übergangsliste; die Liste enthält
  ausschließlich IDs, die am 2026-09-05 schon belegt waren, und ein Test verhindert ihr
  Wachstum; `pnpm verify` ist grün und meldet 0 V1-pflichtige IDs ohne Aufgabe und 0 ohne
  Entwurfstext.

### T-M14-03 · Zurücknehmen, was nicht gebaut wird
- **Ziel:** Sechs Zusagen, die im Code nachweislich nicht existieren, werden zurückgenommen
  statt als Aufgabe geführt (Noahs Entscheidung 1 vom 2026-09-05). Jede Rücknahme kürzt den
  Text an seiner Quelle und bekommt einen begründeten Eintrag in `DECISIONS.md`. Dazu kommt
  die Präzisierung von C-02 aus Entscheidung 2. Antwort auf die Befunde 19, 35, 39, 54, 63,
  64, 65 und den Entwurfspunkt D14.
- **Anforderungen:** R-BAT-03, R-ECON-03, R-GAME-02, R-PROV-03, R-UNIT-07
- **Abhängigkeiten:** T-M14-01, T-M14-02
- **Dateien:** `docs/plan/01-REQUIREMENTS.md`, `docs/plan/02-DESIGN.md`,
  `docs/plan/DECISIONS.md`, `docs/plan/tasks.yaml`, `docs/plan/PROGRESS.md`,
  `docs/plan/PROBLEME.md`, `packages/core/src/rules/combat.ts`,
  `packages/core/src/phases/occupation.test.ts`, `test/withdrawals.test.ts`
- **Vorgehen (verbindlich):** Sechs Rücknahmen, jede am Code geprüft, dazu ein siebter Eintrag:
  1. **Gebäudeunterhalt (Befunde 35, 54).** `BuildingRule` und `data/rules/default/buildings.json`
     kennen kein `upkeep`-Feld; die Unterhaltsphase sammelt den Bedarf ausschließlich über
     `draft.armyOrder`. R-ECON-03 wird auf „Armeen verbrauchen Ressourcen" gekürzt, die
     Phasentabelle in `02-DESIGN.md` mit. **Folge, die benannt gehört:** Kohle behält damit
     genau eine Senke (Befund 26) — der offene Punkt geht mit Meilenstein nach `PROBLEME.md`.
  2. **Einheitenmoral (Befund 64).** `UnitStack` ist `{ unitKey, hpTotal }`, `Army` hat kein
     Moralfeld; Moral berührt eine Einheit genau einmal, bei der Aufstellung. R-UNIT-07 wird
     auf „Stärke/Trefferpunkte" gekürzt; der Halbsatz „Einheitenmoral folgt derselben Regel"
     verschwindet aus `02-DESIGN.md` (D6.8) und aus der Aufgabe T-M4-05. Der Eintrag verweist
     auf T-M4-03: im Trefferpunkte-Pool *ist* der Pool die Stärke.
  3. **Garnison gegen Aufstand und Aufständischen-Armee (Befunde 19, 63).** `settleMorale`
     liest `draft.armies` nirgends und erzeugt nichts; `Army.owner: PlayerId` lässt eine
     besitzerlose Armee typseitig nicht zu. **Der Anforderungstext bleibt** — R-PROV-03/AK1
     ist erfüllt. Zurückgenommen werden die Entwurfs- und Planzusagen: die beiden Stellen in
     `02-DESIGN.md` (Garnison-Unterdrückung, Rebellenarmee), die Zeile zu T-M5-02 in
     `03-TASKS.md`, das `dod` von T-M5-02 in `tasks.yaml` und die Zeile in `PROGRESS.md`.
  4. **E2E-Ebene (D14).** `apps/desktop/e2e/` existiert nicht, „playwright" steht weder in
     einer `package.json` noch im Lockfile. Die Zeile „E2E | Playwright (Web-Build)" aus der
     Teststrategie-Tabelle und der Nebensatz „und E2E" bei `MemoryStorage` entfallen.
     Begründung: Playtest im Browser (Entscheidung 2), Tauri als eigener Meilenstein M16.
  5. **Zeitsieg als Auswahl (Befund 39).** Der Kern kann ihn, aber `condition: 'time'` wird von
     keiner Produktionsdatei gesetzt — `newGame.ts` setzt in beiden Zweigen `dayLimit: null`.
     R-GAME-02 wird auf „Punktesieg, Eroberungssieg; Auswahl bei Partiestart" gekürzt und
     bekommt einen `v1_partial`-Eintrag: das Zeitlimit bleibt im Kern und ist nur über eine
     Konfiguration erreichbar. Damit kein ungeprüfter Zweig zurückbleibt, führt ein Test in
     `occupation.test.ts` ihn genau einmal aus.
  6. **Fluss- und Meerengenübergänge (Befund 65).** `crossingFactor` ist toter Code — der
     einzige Treffer im ganzen Repo ist seine eigene Definition. Die Funktion wird gelöscht,
     R-BAT-03 auf „Verteidigungsboni durch Festung, Gelände" gekürzt. Das Kartenfeld `crossing`
     bleibt: Datenbestand für eine spätere amphibische Landung, der nichts kostet.
  7. **C-02 wird präzisiert (Entscheidung 2).** Heute lautet die Rahmenbedingung „Auslieferung:
     Desktop-Anwendung über Tauri. Savegames im echten Dateisystem." Künftig: „V1: Browserbau
     mit dauerhaftem Speicher (IndexedDB); Tauri-Verpackung mit Datei-Port in **M16**, mit
     eigenem Abnahmekriterium **AK-8**." Ohne diese Präzisierung baut T-M14-08 gegen eine
     gültige Rahmenbedingung, die es nicht erfüllt (Befunde 17, 20, 21).
  **Nicht auf dieser Liste, weil am Code widerlegt:** der Festungsbonus (Befund 18) ist gebaut
  und nur falsch — er gehört repariert, nicht zurückgenommen (T-M14-07).
  **Und was hier weder gebaut noch stillschweigend fallen gelassen wird:** die acht kleineren
  Befunde ohne Aufgabe — 16/N11 (141 unausgeführte Zeichenzeilen in `MapCanvas.tsx`,
  R-ARCH-06/AK2 unbelegt), 26 (Kohlesenke, siehe Punkt 1), 46 (R-AI-04 gemessen 43,1 % statt
  30 %), 50 (Hauptstadtverlegung kostet nichts), 58 (350-facher Vorratsaufbau), 59 (314 von 374
  Regelzahlen ohne Belegstatus), 66 (Rückzug als Teleport) und N12 (Tastatur, Fokus, `aria`) —
  stehen je entweder als ausdrückliche Rücknahme mit Begründung in `DECISIONS.md` oder mit
  Meilenstein in `docs/plan/PROBLEME.md`. Keiner verschwindet zwischen „nicht gebaut" und
  „nicht entschieden".
- **Tests zuerst:** Neu `test/withdrawals.test.ts` (Titel `R-ARCH-05 …`, **nicht** die
  gekürzten Anforderungs-IDs — sonst zählt das Tor eine Dokumentprüfung als Verhaltensbeleg):
  `02-DESIGN.md` nennt weder „Playwright" noch ein `e2e/`-Verzeichnis, weder eine
  Garnison-Unterdrückung noch eine Aufständischen-Armee; R-ECON-03 nennt keine Gebäude mehr,
  R-UNIT-07 keine Moral, R-GAME-02 kein Zeitlimit, R-BAT-03 keinen Fluss; C-02 nennt IndexedDB
  und M16; `DECISIONS.md` trägt zu jeder der sieben Entscheidungen einen Eintrag vom 2026-09-05
  mit der Aufgaben-ID; `combat.ts` enthält kein `crossingFactor`; jeder der acht offenen
  Befunde steht in genau einer der beiden Akten. Alle Prüfungen sind vor der Änderung rot. Der
  Zeitsieg-Test in `occupation.test.ts` (`condition: 'time'`, `dayLimit: N` → an Tag N gewinnt
  der Punktbeste) ist **ab dem ersten Lauf grün** — er ist kein TDD-Schritt, sondern schließt
  eine ungeprüfte Verzweigung.
- **Fertig wenn:** `pnpm verify` ist grün; `pnpm coverage:requirements` meldet weiterhin
  `V1 offen: 0` (keine Kürzung nimmt einem Testbeleg seine ID); `grep -rn crossingFactor` über
  `packages` und `apps` liefert 0 Treffer (vorher 1); `DECISIONS.md` enthält sieben Einträge
  vom 2026-09-05 zu T-M14-03, darunter den zu C-02; der Zeitsieg-Zweig wird von genau einem
  Test ausgeführt (vorher von keinem); die acht offenen Befunde haben je einen Ort.

### T-M14-04 · Eine Spielschleife für alle
- **Ziel:** Es gibt heute vier Fassungen der Fortschreibungsschleife: `game/advance.ts`
  (richtig, ein Tick je Runde), `headless/src/sweep.ts` (ein `runAi` je **Spieltag**, das
  Befehlspaket über alle 24 Ticks wiederverwendet), `worldmap.bench.slow.test.ts` (dieselbe
  Falle im Tausend-Tage-Lauf) und `sim/SimEngine.ts` (521 Zeilen, die kein Spieler ausführt).
  Die Tagesfassung ist nicht nur eine zweite Schleife, sie schaltet die KI der meisten Mächte
  ab: `shouldThinkThisTick` verteilt die Denkzeit über `tick % aiCount`, und wenn `tick` immer
  ein Vielfaches von 24 ist, denkt bei sechs Mächten nur die erste. Der Kommentar in
  `advance.ts` verurteilt genau diesen Zustand („two loops are two games"), und der
  Parameterlauf begeht ihn trotzdem. Diese Aufgabe zieht die eine Schleife nach
  `packages/ai/src/loop.ts` — das einzige Paket, das Kern **und** KI kennen darf (die
  Importrichtung `shared ← core ← ai ← apps` verbietet dem Kern den Griff nach der KI) und das
  beide Anwendungen schon als Abhängigkeit führen. Die neue Ausfuhr heißt **`advanceTicks`**
  (sie existiert heute nirgends; `game/advance.ts` exportiert `advance`): sie fragt die KI vor
  jedem Tick, reicht die Befehle des Spielers nur in den ersten, bricht bei einem Sieger ab und
  **gibt die Ereignisse aller Ticks zurück** — Letzteres ist die Voraussetzung für T-M14-05.
  Dazu ein Wächter, der eine zweite Schleife scheitern lässt. Antwort auf Ursache C: Befunde
  33, 60 und N3.
  **Ausdrücklich nicht hier:** über `apps/desktop/src/sim/` (verdrahten oder löschen) wird
  **nicht** in dieser Aufgabe entschieden, sondern in M15 mit R-TIME-06/AK1 (T-M15-06). Diese
  Aufgabe fasst `SimEngine.ts` nicht an; der Wächter greift dort auch nicht, weil `SimEngine`
  `runAi` gar nicht aufruft.
- **Anforderungen:** R-AI-01, R-AI-06, C-10
- **Abhängigkeiten:** T-M14-03
- **Dateien:** `packages/ai/src/loop.ts` *(neu)*, `packages/ai/src/index.ts`,
  `apps/desktop/src/game/advance.ts`, `apps/headless/src/sweep.ts`,
  `apps/headless/src/tournament.ts`, `apps/headless/src/replay.ts`, `docs/plan/DECISIONS.md`
- **Tests zuerst:**
  1. **Sechs Mächte handeln, nicht eine:** über 24 Ticks mit sechs KI-Mächten erzeugt jede der
     sechs mindestens einen Befehl. Gegen die heutige Tagesschleife rot — sie lässt fünf von
     sechs nie denken.
  2. **Ereignisse werden gesammelt, nicht am Ende gelesen:** über 600 Ticks mit Kriegszustand
     ist `advanceTicks(...).events.length` größer als `EVENT_LOG_LIMIT` (500) und größer als
     `state.eventLog.length`.
  3. **Spielerbefehle nur im ersten Tick** und (4) **ein Sieger beendet die Schleife** — die
     beiden Zusicherungen aus `game/advance.test.ts`, jetzt gegen die gemeinsame Funktion.
  5. **Gleichstand:** für denselben Seed liefert `advanceTicks(state, n, ctx)` denselben
     `worldHash` wie das bisherige `advance(state, n, ctx)`.
  6. **Speichern mit Befehlsquelle (R-AI-07/AK1, Befund N2):** ein über 50 Ticks **mit KI**
     gelaufener Stand, in der Mitte gespeichert und geladen, liefert denselben Zustands-Hash
     wie der ununterbrochene Lauf. Heute prüft `save.test.ts` `runTicks(deserialise(serialise(
     state)), 60, ctx)` ohne KI, und `storeMemories` schreibt außerhalb der Tick-Pipeline in
     den Zustand — der Test ist also rot, und diese Aufgabe ist die billigste Gelegenheit, ihn
     grün zu machen.
  7. **Wächter:** eine Vorrichtung, die `runAi(` und `runTicks(` in derselben Datei aufruft und
     nicht in `LOOP_EXCEPTIONS` steht, lässt `test/guards/single-loop.test.ts` scheitern;
     derselbe Fall mit einem Eintrag samt Begründung geht durch. Zusätzlich: kein
     `*.slow.test.ts` unter `apps/headless/test` und `packages/core/test/perf` ruft `runTicks(`
     noch unmittelbar auf.
- **Fertig wenn:** `pnpm verify` ist grün; der Wächter zählt genau **eine** Datei unter
  `packages/*/src` und `apps/*/src`, die `runAi(` und `runTicks(` zugleich nennt, nämlich
  `packages/ai/src/loop.ts`; `advanceTicks` ist von dort ausgeführt und von beiden Anwendungen
  benutzt; `LOOP_EXCEPTIONS` hat höchstens zwei Einträge, jeder mit einem Satz Begründung;
  `game/advance.ts` enthält weder `for` noch `runTicks(` und bleibt unter 20 Zeilen,
  `App.tsx` bleibt unverändert; `sweep.ts`, `tournament.ts` und `replay.ts` nennen `runTicks(`
  nicht mehr; Golden-Master und Wiedergabetest sind ohne Änderung an `apps/headless/test/golden/`
  grün; **der Speicher-/Ladelauf über 50 Ticks mit KI ist hashgleich (R-AI-07/AK1)**; der
  Absatz „two loops are two games" steht jetzt in `loop.ts`; `DECISIONS.md` trägt den datierten
  Eintrag „Es gibt genau eine Fortschreibungsschleife" samt dem Satz, dass über
  `apps/desktop/src/sim/` erst R-TIME-06 in M15 entschieden wird. Die langsamen Messläufe
  bleiben hier ungeprüft — ihre Zahlen ändern sich und werden in T-M14-05 gemessen.

### T-M14-05 · Die Messgeräte richtigstellen und die Rauschgrenze messen
- **Ziel:** Vier Messgeräte messen nachweislich das Falsche, und drei veröffentlichte Dokumente
  tragen die Ergebnisse (Ursache E, Befunde 23, 24, 25, 45, 47, 62).
  **(a) Eroberungen aus dem Ringpuffer:** `sweep.ts` zählt `PROVINCE_CAPTURED` in
  `state.eventLog` — einem Ringpuffer von 500 Einträgen, der bei rund 12.300 Ereignissen je
  Partie die letzten ~5 Spieltage abdeckt. Nachgemessen: Seed 1914 hat 51 echte Eroberungen, im
  Puffer stehen 2; der Bericht meldet **3 statt 49**. Die eingebaute Warnung „Zero means the
  trial measured nothing" kann damit nie auslösen. Die Zählung kommt künftig aus den während
  des Laufs gesammelten `events` (die T-M14-04 zurückgibt). Im selben Zug: `economy` ist als
  „Total resources produced" beschriftet, summiert aber **Endbestände** — die Beschriftung wird
  auf das gebracht, was gemessen wird.
  **(b) Das Turnier hat keine Obergrenze:** geprüft wird nur `>= 0,70`; im ganzen Bestand gibt
  es keine Obergrenze auf einer Siegquote, also bleibt ein entartetes 100-%-Ergebnis dauerhaft
  grün — und genau das steht heute im Turnierbericht (50:0).
  **(c) Tickbudget an der falschen Karte:** R-ARCH-06/AK1 fordert Median < 0,5 ms und
  p99 < 2 ms bei 200 Provinzen, 8 Spielern, ~400 Armeen. Geprüft wird das an 12 Provinzen,
  zwanzigmal kleiner; auf der Weltkarte prüft der Bench das Sechzehn- bzw. Zwanzigfache
  (8 ms / 40 ms), mit 12 statt 8 Mächten, und misst `runAi` und `runTicks` zusammen.
  **(d) Die Rauschgrenze ist unbekannt:** die Zielgröße streut über 8 Startzahlen um 0,183, der
  Lauf mittelt über **2**, und der größte gemeldete Ausschlag liegt unter dieser Grenze
  (Befund 23). Jede Aussage der Spalte „Ausschlag" ist damit heute unbelegt — und T-M15-05
  hängt an einem Rauschband, das es noch nicht gibt.
  **(e) BALANCING.md widerspricht seinem eigenen Bericht:** die Datei behauptet „ohne dass eine
  Stufe je alle Partien gewinnt", der zitierte Bericht sagt 100 %.
- **Anforderungen:** R-AI-06, R-ARCH-06, C-10
- **Abhängigkeiten:** T-M14-04
- **Dateien:** `apps/headless/src/sweep.ts`, `docs/plan/BALANCING.md`, `docs/plan/PROBLEME.md`,
  `docs/reports/balance-sweep.md`, `docs/reports/balance-sweep.json`,
  `docs/reports/ai-tournament.md`, `docs/reports/worldmap-bench.json`
- **Tests zuerst:**
  1. **Die Zählung überlebt den Ringpuffer:** ein Lauf, der mehr als 500 Ereignisse erzeugt,
     meldet `captures` in Höhe der tatsächlichen Besitzwechsel — gegengeprüft an der Differenz
     der Besitzverhältnisse zwischen Start und Ende, nicht an einer festen Zahl. Gegen die
     heutige Fassung rot (sie misst den Schwanz, nicht die Partie).
  2. **Ein Grundlauf ohne Eroberung ist ein Fehlschlag:** die Zusicherung aus dem langsamen
     Lauf wird auf die neue Zählung gehoben und zusätzlich in der schnellen Fassung geprüft.
  3. **Die Siegquote wird gemessen, nicht zugesichert:** der Turniertest behält seine
     Untergrenze `>= 0,70` und schreibt den **Ist-Wert** in den Bericht. Eine **Obergrenze wird
     hier ausdrücklich nicht eingeführt** — sie wäre gegen die heutige Messung (100 %) sofort
     rot, machte `pnpm test:slow` rot und damit AK-4/AK-6, T-M12-03 und die ganze Abnahmekette
     unerreichbar. Die Obergrenze kommt mit **T-M15-05**, zusammen mit der Regel, die sie
     einlösen kann; hier steht sie als `it.skip` mit Verweis auf T-M15-05 im Turniertest.
  4. **Die Rauschgrenze wird gemessen:** die Startzahlen je Variante steigen von 2 auf
     mindestens **12**; ein Grundlauf **ohne** Regeländerung misst die Streuung der Zielgröße.
     Ein Test sichert zu, dass der Bericht diese Grenze mit Datum trägt und dass keine Variante
     als „tragend" gilt, deren Ausschlag unter dem **Doppelten** der Grenze liegt.
  5. **Das Tickbudget wird an der Anforderung gemessen:** der Weltkarten-Bench spielt
     `data/maps/world.json` mit **8** Mächten und mindestens **400** Armeen und misst
     `runTicks` getrennt von `runAi`; der Bericht nennt beide Mediane, beide p99-Werte und den
     Faktor zum Budget aus R-ARCH-06/AK1.
  6. **Wächter gegen den Rückfall:** `test/balancing.test.ts` scheitert, wenn die im
     Turnierbericht gemessene Siegquote nicht wörtlich in `BALANCING.md` steht, und wenn die
     „Eroberte Provinzen"-Zahl im Parameterlaufbericht nicht mit `balance-sweep.json`
     übereinstimmt oder null ist.
- **Fertig wenn:** `pnpm verify` ist grün; die Kennzahl „Eroberte Provinzen" ist größer als
  null und stimmt mit der Besitzdifferenz überein; `economy` ist als Endbestand beschriftet;
  `pnpm bench` hat `docs/reports/worldmap-bench.json` neu geschrieben, dort stehen
  `tickMedianMs`, `tickP99Ms`, `aiMedianMs`, `players: 8`, `armies >= 400` und der Faktor zu
  0,5 ms / 2 ms; **die Rauschgrenze der Zielgröße steht mit Datum in
  `docs/reports/balance-sweep.md` und in `BALANCING.md`, die tragend-Schwelle ist das Doppelte
  dieser Grenze, und die Spalte „Ausschlag" ist bis zur Neumessung als nicht aussagekräftig
  gekennzeichnet**; **der Ist-Wert der Siegquote „schwer gegen leicht" steht mit Datum, Zahl
  und vermuteter Ursache (`recruitShare`-Faktor 4 als einziger Stufenunterschied) in
  `docs/plan/PROBLEME.md` und ist als M15-Aufgabe unter R-AI-08 geführt** — als Messung, nicht
  als roter Test; `BALANCING.md` enthält keinen Satz mehr, der einer Zahl in `docs/reports/`
  widerspricht. **Die veröffentlichten Berichte selbst werden hier nicht neu erzeugt:** die
  Kampfzahlen ändern sich in T-M14-06 und T-M14-07 noch einmal, deshalb laufen
  `pnpm balance:sweep` und `pnpm sim:tournament` genau **einmal**, und zwar in T-M14-07.

### T-M14-06 · Der Stapel-Deckel als Grenzbeitrag
- **Ziel:** Der Stapel-Deckel wirkt wie belegt als **Grenzbeitrag der zusätzlichen Einheit**
  („jenseits von 50 trägt keine *weitere* Einheit mehr zum Schaden bei", 02-DESIGN.md D6.5) und
  nicht mehr als Faktor auf die ganze Armee. Die Kurve `stackContribution(i)` bleibt als
  Grenzbeitrag erhalten und bekommt ihr Integral zur Seite:

  ```
  Grenzbeitrag   beitrag(i) = 1                 für i ≤ 20
                 beitrag(i) = (50 − i)/30       für 20 < i < 50
                 beitrag(i) = 0                 für i ≥ 50
  Gesamtbeitrag  effectiveUnits(n) = n                     für n ≤ 20
                 effectiveUnits(n) = n − (n−20)²/60        für 20 < n < 50
                 effectiveUnits(n) = 35 (Plateau)          für n ≥ 50
  ```

  `sideAttackValue` skaliert eine Armee künftig mit `effectiveUnits(n)/n` statt mit
  `stackContribution(n)`. Damit endet der gemessene Zustand: Höhepunkt der Schadenskurve bei
  25 Einheiten, ab 50 exakt null Schaden bei konstantem eigenem Verlust und weiterlaufendem
  Unterhalt — eine große Armee ist heute eine Falle, und die KI legt Armeen über `MERGE_ARMIES`
  genau dort hinein. Antwort auf Befund 3 (Blocker, schwerster Einzelbefund) und Befund 28,
  Teil 1 (die Eigenschaftsdatei, die der Plan seit M4 als Beleg nennt und die es nie gab).
  **Die Folge gehört zur Aufgabe:** danach ist jede Kampfzahl des Projekts gegenstandslos.
  Golden-Master, Parameterlauf, Turnier und die Kampfzeilen in `BALANCING.md` müssen mit den in
  Phase 1 reparierten Messgeräten neu gemessen werden — die Berichte erzeugt **T-M14-07** ein
  einziges Mal neu, damit sie nicht dreimal geschrieben und zweimal falsch werden.
- **Anforderungen:** R-BAT-01, R-BAT-07
- **Abhängigkeiten:** T-M14-05
- **Dateien:** `packages/core/src/rules/combat.ts`,
  `packages/core/test/properties/combat-conservation.test.ts` *(neu)*,
  `packages/core/src/phases/combat.test.ts`, `packages/core/test/golden/tiny-500.json`,
  `docs/plan/02-DESIGN.md`, `docs/plan/BALANCING.md`, `docs/plan/DECISIONS.md`
- **Tests zuerst:** (alle fünf sind vor dem Umbau rot)
  1. `effectiveUnits` existiert und liefert in Festkomma `effectiveUnits(20) = 20000`,
     `effectiveUnits(50) = 35000`, `effectiveUnits(80) = 35000`; die Folge über n = 1..80
     wächst streng bis 50 und bleibt danach konstant. Rot, weil die Funktion fehlt.
  2. Schadenskurve über n (echtes Regelwerk, Infanterie gegen 10 Einheiten Infanterie, ein
     Tick, Regel-Override `combatSpreadPermille: 0`): für n aus {1, 5, 10, 20, 25, 30, 40, 49,
     50, 60, 80} fällt der zugefügte Schaden nie, wenn n wächst — Toleranz 0. Rot: heute
     20 → 1501, 25 → 1563, 30 → 1502, 40 → 1000, 45 → 564, 49 → 121, ab 50 → 0.
  3. Eine Armee mit 60 Einheiten fügt je Tick Schaden > 0 zu und entscheidet den Kampf gegen
     eine kleinere Gegenseite in weniger als 500 Ticks. Rot: heute exakt 0 bei unverändertem
     eigenem Verlust.
  4. **Seitentausch spiegelt** (Ersatzeigenschaft für R-BAT-07/AK1): bei Streuung 0 liefert die
     vertauschte Aufstellung exakt gespiegelte Verlustzahlen. Rot: nirgends geprüft.
  5. **Erhaltungssatz:** über 50 Ticks eines Dreiparteienkampfes ist in jedem Tick die Summe
     der tatsächlich abgezogenen Trefferpunkte je Seite gleich der Summe der in
     `BATTLE_RESOLVED.losses` gemeldeten Werte. Rot: nirgends geprüft (Befund 28).
- **Fertig wenn:** `effectiveUnits(50) == effectiveUnits(80) == 35000`; die Schadenskurve über
  n = 1..80 ist monoton nicht fallend (Toleranz 0); der Schaden bei 50 Einheiten beträgt
  mindestens das 1,4-fache des bisherigen Höchstwerts bei 25 Einheiten statt 0; Seitentausch
  und Erhaltungssatz sind grün; **die beiden Zusicherungen zum Stapel-Deckel in
  `combat.test.ts` prüfen Grenzbeitrag und Gesamtbeitrag getrennt**, und keine behauptet mehr
  „zwanzig Einheiten sind stärker als fünfzig"; **der Abschnitt D6.5 Punkt 2 in
  `02-DESIGN.md` und die Zeile `stackCap` in `BALANCING.md`** nennen beide Größen mit Formel
  und benennen den Unterschied ausdrücklich; `DECISIONS.md` hält fest, ob die Fläche
  kontinuierlich (Plateau 35,0) oder als diskrete Summe (34,5) gerechnet wird; der
  Golden-Master ist mit `UPDATE_GOLDEN=1 pnpm test` neu erzeugt und die Regeländerung steht in
  der Commit-Nachricht; `pnpm verify` ist grün. Die Zeilen `stackFullContribution` und
  `stackZeroContribution` in `BALANCING.md` werden in T-M14-07 **neu gemessen**, nicht nur neu
  datiert.

### T-M14-07 · Vier Kampfregeln, die nicht tun, was der Entwurf sagt — und die Berichte danach, einmal
- **Ziel:** Vier Kernregeln tun endlich, was der Entwurf zusagt, eine fünfte Lücke wird
  geschlossen, und danach werden die veröffentlichten Zahlen **genau einmal** neu erzeugt.
  (a) **Festung schützt nur den Eigentümer** (Befund 18): `defenceMultiplier` prüft kein
  Eigentum, also teilt eine Festung den Schaden für Angreifer *und* Verteidiger. Bei Stufe 5
  fällt das Schutzverhältnis Verteidiger:Angreifer von 1250:1000 auf 2250:2000 — die Festung
  macht die Verteidigung *relativ schwächer* und kostet je Stufe 500 Holz, 333 Eisen, 417 Geld.
  Getrennt wird in einen provinzweiten Teil (Gelände, gilt für alle) und einen
  eigentumsgebundenen Teil (Festung, Eingrabung — nur für `province.owner`).
  (b) **Die Rückzugssperre wirkt** (Befund 49): `cannotAttackUntil` wird gesetzt und nur von
  `commands/bombard.ts` gelesen — `phases/combat.ts` liest das Feld nirgends. Eine gesperrte
  Armee trägt künftig nur mit ihrem Verteidigungswert bei und erzeugt keinen Angriffspool.
  (c) **Beschuss kennt Diplomatie** (Befund 51): der Beschussschaden verteilt sich heute auf
  *alle* fremden Armeen der Zielprovinz, Verbündete, Neutrale und eingeschiffte Verbände
  eingeschlossen, während die Kampfphase über `atWar` und `!embarked` filtert.
  (d) **Beschuss löst sich in Phase 8 auf** (Befund 52): BOMBARD ist heute ein gewöhnlicher
  Handler, den `applyCommands` in Phase 1 sofort anwendet; die in `02-DESIGN.md` zugesagte
  Auflösung nach der Bewegung fehlt. Künftig prüft Phase 1 nur (Eigentum, Fernwaffe,
  Sperrfrist, eingeschifft) und die Kampfphase löst auf — mit erneuter Reichweiten- und
  Kriegsprüfung, aus `ctx.commands` in Spielerreihenfolge, **ohne neues Zustandsfeld**
  (Begründung in `DECISIONS.md`).
  (e) **Leere Armee-Hüllen verschwinden** (Befund 53): Beschuss lässt heute Armeen mit null
  Trefferpunkten zurück — ohne `ARMY_DESTROYED`, und die Hülle hält einen Spieler am Leben.
  `checkVictory` setzt einen Sieger erst, wenn genau eine Macht lebt; eine Hülle verhindert das
  dauerhaft und damit auch T-M14-14.
  **(c) und (d) sind Vorbedingung für R-BAT-08 in M15:** ohne den Diplomatiefilter beschießt
  die Automatik Verbündete und Neutrale ohne Kriegserklärung, ohne die Auflösung in Phase 8
  gibt es keinen Ort, an dem sie stattfinden kann. Dazu kommen die Kampf-Eigenschaftstests, die
  als Datei fehlen (Befund 28, Teil 2).
- **Anforderungen:** R-BAT-03, R-BAT-05, R-BAT-06, R-BAT-07
- **Abhängigkeiten:** T-M14-06
- **Dateien:** `packages/core/src/rules/combat.ts`, `packages/core/src/phases/combat.ts`,
  `packages/core/src/commands/bombard.ts`, `packages/core/src/phases/applyCommands.ts`,
  `packages/core/src/commands/bombard.test.ts` *(neu)*,
  `packages/core/src/phases/combat.test.ts`, `packages/core/src/phases/retreat.test.ts`,
  `packages/core/test/properties/combat-conservation.test.ts`,
  `packages/core/test/golden/tiny-500.json`, `docs/plan/02-DESIGN.md`,
  `docs/plan/DECISIONS.md`, `docs/plan/BALANCING.md`, `docs/reports/balance-sweep.md`,
  `docs/reports/balance-sweep.json`, `docs/reports/ai-tournament.md`
- **Tests zuerst:** (alle sind vor dem Umbau rot; gemessen wird die Wirkung, nie die Funktion)
  1. **Festung, beide Seiten** (Befund 18): gleiche Ausgangslage mit und ohne Festung Stufe 5,
     Streuung 0. Der Verlust des Verteidigers sinkt **und** der Verlust des Angreifers bleibt
     unverändert; das Schutzverhältnis beträgt mit Festung 2250:1000. Rot: heute sinkt der
     Verlust des Angreifers mit.
  2. **Gesperrte Armee im Nahkampf** (Befund 49): eine Armee mit `cannotAttackUntil = tick + 24`
     in derselben Provinz wie ein Gegner fügt diesem keinen Angriffsschaden zu; der Gegner
     verliert strikt weniger als gegen dieselbe ungesperrte Armee. Rot: heute in beiden Fällen
     derselbe Endwert.
  3. **Rückzug in eine neutrale Nachbarprovinz mit Feindarmee** (Befund 49, zweite Hälfte): die
     zurückgezogene Armee greift im selben Tick nicht an (0 Angriffsschaden). Rot: heute greift
     sie mit vollem Angriffswert an, in demselben Tick, in dem die Sperre gesetzt wird.
  4. **Beschuss mit drei Parteien** (Befund 51): p1 im Krieg mit p2, im Frieden mit p3;
     beschossen wird p2s Provinz, in der eine p3-Armee und eine eingeschiffte Armee stehen.
     Beide verlieren exakt 0 Trefferpunkte. Rot: heute verliert p3 1000 von 20.000, ohne
     Kriegserklärung, ohne Ansehensverlust, ohne Meldung an das Opfer.
  5. **Auflösung nach der Bewegung** (Befund 52): das Ziel marschiert im selben Tick aus der
     Reichweite — es verliert 0 Trefferpunkte, und **genau ein** Ereignis erklärt warum (kein
     doppeltes `COMMAND_REJECTED` aus Phase 1 und Phase 8). Rot: heute trifft der Schuss vor
     der Bewegung.
  6. **Keine leeren Hüllen** (Befund 53): eine Armee, deren Trefferpunkte durch Beschuss auf 0
     fallen, wird im selben Tick entfernt und erzeugt genau ein `ARMY_DESTROYED`; als
     Eigenschaftstest über 200 Spieltage: es existiert zu keinem Zeitpunkt eine Armee ohne
     Einheiten. Rot: heute bleibt die Hülle stehen und hält ihren Spieler am Leben.
  7. **Restliche Ersatzeigenschaften zu R-BAT-07/AK1** (Befund 28), in derselben
     Eigenschaftsdatei: `hpTotal` fällt während eines Kampfes monoton, und der zugefügte
     Schaden übersteigt nie die Schadenskapazität der Gegenseite.
- **Fertig wenn:** die sieben Testgruppen sind grün; `commands/bombard.test.ts` existiert (der
  Plan nennt sie seit M4 als Beleg) und trägt `R-BAT-06`-Blöcke — der alte
  `R-BAT-06`-Block in `retreat.test.ts` wird erst entfernt, wenn der neue steht, sonst fällt
  `coverage:requirements` mitten in der Aufgabe rot; die Eigenschaftsdatei trägt alle vier
  Ersatzeigenschaften aus **der Liste zu R-BAT-07/AK1 in `02-DESIGN.md`**;
  `phases/combat.ts` liest `cannotAttackUntil`, und `defenceMultiplier` gibt den Festungs- und
  Eingrabungsbonus nur für `province.owner`; `bombard.ts` beschädigt ausschließlich Armeen, mit
  deren Eigentümer Krieg besteht, und nie eingeschiffte Verbände; BOMBARD wird in Phase 1 nur
  geprüft und in Phase 8 in Spielerreihenfolge aufgelöst; **nach 200 Spieltagen existiert keine
  Armee ohne Einheiten**; `02-DESIGN.md` D3 und die Kommandotabelle D4 sagen das auch so;
  `DECISIONS.md` begründet, warum kein neues Zustandsfeld und keine Migration entsteht, und
  hält fest, dass „Feuer halten" das Feld erst mit R-BAT-08 in M15 bringt; der Golden-Master
  ist neu erzeugt. **Und einmal, hier und nirgends sonst:** `pnpm balance:sweep` und
  `pnpm sim:tournament` laufen mit den in T-M14-05 reparierten Messgeräten neu,
  `docs/reports/balance-sweep.md`, `balance-sweep.json` und `ai-tournament.md` sind durch diese
  Läufe **ersetzt** (Datum im Bericht), die Rauschgrenze aus T-M14-05 ist mitgemessen, und die
  Zeilen `stackCap`, `stackFullContribution` und `stackZeroContribution` in `BALANCING.md`
  tragen neu gemessene Zahlen mit Status. `pnpm verify` und `pnpm coverage:requirements` sind
  grün.

### T-M14-08 · Ein Speicher, der das Schließen des Fensters überlebt
- **Ziel:** (Befunde 1, 4, 6, 67, 68) `MemoryStorage` ist heute die einzige Umsetzung des
  `StoragePort` im ganzen Repo; `main.tsx` reicht keinen Port herein, `App.tsx` fällt auf den
  Arbeitsspeicher zurück. Jeder gespeicherte Stand ist mit dem Fenster weg. Weil Noah **Browser
  jetzt** entschieden hat (Entscheidung 2), bekommt das Spiel einen dauerhaften Port über
  **IndexedDB** — ausdrücklich **ohne** `@tauri-apps`-Abhängigkeit; die Verpackung als Programm
  ist M16, und C-02 ist dafür in T-M14-03 präzisiert worden. Dazu wird die
  „Vertragstestreihe", die T-M8-00 zugesagt und nie geliefert hat, zum ersten Mal wirklich eine
  Reihe: eine exportierte Funktion `storagePortContract(name, factory)`, die gegen **alle**
  Umsetzungen läuft und die Fälle kennt, die nur ein echter Speicher hat.
  **Zuständigkeitsgrenze:** Diese Aufgabe besitzt den Speicherpfad — Port, Vertrag, Rotation,
  unlesbare Plätze. Die Buchführung zu T-M8-00 in `PROGRESS.md` und `tasks.yaml` gehört
  **T-M14-02** (dort steht bereits „abgelöst durch T-M14-08"); hier wird sie nicht ein zweites
  Mal geschrieben. Fehlerfläche, Niederlage und zweite Partie gehören **T-M14-10**.
- **Anforderungen:** R-GAME-03, R-GAME-04, R-GAME-05, C-02 (präzisiert: Browser jetzt, Tauri in
  M16), C-08
- **Abhängigkeiten:** T-M13-03, T-M14-02
- **Dateien:** `apps/desktop/src/storage/IndexedDbStorage.ts` *(neu)*,
  `apps/desktop/src/storage/createStorage.ts` *(neu)*,
  `packages/testkit/src/storageContract.ts` *(neu)*, `packages/testkit/src/index.ts`,
  `packages/core/src/persistence/StoragePort.ts`, `apps/desktop/src/main.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/game/saves.ts`,
  `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`, `package.json`,
  `vitest.config.ts`
- **Tests zuerst:**
  1. `packages/testkit/src/storageContract.ts` — die Reihe als Funktion. Sie enthält den
     heutigen Einzeltest aus `save.test.ts` (schreiben, lesen, listen, löschen,
     `StorageEntryNotFound`) **und** drei Fälle, die `MemoryStorage` nie hatte: ein
     fehlschlagendes `write` wirft einen unterscheidbaren `StorageWriteError` und lässt den
     alten Inhalt unversehrt; ein abgebrochener Schreibvorgang hinterlässt keinen halben Stand
     (nach dem Fehler liefert `read` entweder den alten Wert oder `StorageEntryNotFound`, nie
     eine abgeschnittene Zeichenkette); zwei Schreibvorgänge auf denselben Namen enden mit
     genau einem Eintrag in `list()` und dem zuletzt geschriebenen Inhalt.
  2. `apps/desktop/src/storage/IndexedDbStorage.test.ts` fährt dieselbe Reihe gegen die neue
     Umsetzung — vor dem Code rot, weil die Datei nicht existiert — und dazu den einen Test, um
     den es eigentlich geht: schreiben, die Instanz wegwerfen, eine neue Instanz gegen dieselbe
     Datenbank aufbauen, laden — und der Zustands-Hash ist derselbe (R-GAME-03/AK1). Umgebung
     `jsdom` plus `fake-indexeddb`.
  3. `test/guards/persistence-contract.test.ts` schlägt fehl, solange nur **eine** Fabrik bei
     `storagePortContract` registriert ist, und meldet jeden Testblock unter
     `R-GAME-03/04/05`, der `MemoryStorage` als einzige Umsetzung nennt.
  4. `apps/desktop/src/storage/createStorage.test.ts`: mit vorhandenem `indexedDB` kommt der
     dauerhafte Port, ohne `indexedDB` der Speicher-Port **mit** `volatile: true`; ein Test in
     `App.test.tsx` sichert, dass die Oberfläche in diesem Fall den Satz „Stände gehen beim
     Schließen verloren" zeigt. Die Auswahl liegt in `createStorage.ts`, nicht in `main.tsx`.
  5. Befund 67, in `saves.test.ts`: ein Platz mit unparsbarem Inhalt ergibt
     `state: 'unreadable'`, nicht `null`; der Dialog schreibt dafür `saves.unreadable` statt
     `saves.empty` und lässt den Ladeknopf **offen**, damit die Meldung aus `loadFrom` erscheint.
  6. Befund 68, in `saves.test.ts`: zwei aufeinanderfolgende „Sitzungen" — nach der zweiten
     trifft der nächste Automatikstand den Platz mit dem kleinsten `savedAtTick`, und kein Stand
     aus der ersten Sitzung ist überschrieben, der jünger ist als ein noch vorhandener.
     `resumeAutosave(storage)` leitet `nextSlot` aus den vorhandenen `autosave-*.json` ab statt
     ihn bei jedem Start auf 0 zu setzen.
- **Fertig wenn:** `pnpm verify` grün; **die Einstellungen überleben den Neustart** — `parseSettings` bekommt endlich einen Aufrufer, und ein gespeicherter Wert (Tempo, Schriftgröße, Ton) steht nach dem Neuladen wieder da; damit schließt diese Aufgabe **T-M10-09**, das seit dem 2026-09-06 auf sie zeigt (die Zusage „Einstellungen überleben den Neustart" war nie einlösbar, weil es keinen dauerhaften Speicher gab); `storagePortContract` läuft gegen mindestens zwei
  Umsetzungen und der Wächter fällt, wenn es wieder eine wird; ein über eine verworfene Instanz
  geschriebener Stand liefert aus einer neuen Instanz denselben Zustands-Hash; ohne `indexedDB`
  meldet `createStorage` `volatile: true` und die Oberfläche sagt es; ein unlesbarer Platz heißt
  „unlesbar" und lässt sich laden; nach dem simulierten Neustart trifft die Rotation den
  ältesten Platz; **`main.tsx` ist nicht mehr aus der Abdeckung ausgenommen** (die Zeile
  `'**/main.tsx'` in `vitest.config.ts` entfällt, Befund N5) **und die AK-3-Schwellen bleiben
  gehalten**.

### T-M14-09 · Das Spiel bekommt seine Schrift
- **Ziel:** (Befund N1) `git ls-files` findet im ganzen Repo **null** Asset-Dateien, es gibt
  kein einziges `@font-face` — und `ui/tokens.ts` wie `app.css` verlangen IBM Plex. Auf jedem
  Rechner ohne installiertes IBM Plex sieht das Spiel anders aus als die freigegebene Richtung
  A. Drei Zusicherungen in `test/guards/no-foreign-assets.test.ts` sind trotzdem grün, weil sie
  eine **leere Menge** prüfen, Namen in einem Dokument suchen und die Abwesenheit eines
  Nachladens feststellen — die Anwendung lädt nichts nach, weil sie nichts hat. `docs/ASSETS.md`
  behauptet, die ausgelieferte Anwendung bette die Schriftdateien ein; das wird hier wahr
  gemacht. Playtest-Frage 1 („Sieht das Spiel aus wie Richtung A?") ist die erste Frage der
  Abnahme und hängt daran.
- **Anforderungen:** R-UI-04, R-ASSET-01, R-ASSET-02, R-FREE-04
- **Abhängigkeiten:** T-M14-02
- **Dateien:** `apps/desktop/src/ui/fonts/IBMPlexSans-Regular.woff2` *(neu)*,
  `apps/desktop/src/ui/fonts/IBMPlexSans-SemiBold.woff2` *(neu)*,
  `apps/desktop/src/ui/fonts/IBMPlexSansCondensed-SemiBold.woff2` *(neu)*,
  `apps/desktop/src/ui/fonts/IBMPlexMono-Regular.woff2` *(neu)*,
  `apps/desktop/src/ui/fonts/OFL.txt` *(neu)*, `scripts/fetch-fonts.mjs` *(neu)*,
  `apps/desktop/src/ui/app.css`, `docs/ASSETS.md`
- **Tests zuerst:**
  1. `no-foreign-assets.test.ts`: eine leere Menge ist kein Bestehen mehr. Der Test zählt die
     getrackten `.woff2`-Dateien unter `apps/desktop/src/ui/fonts/` und verlangt **mindestens
     vier**; er verlangt für jede IBM-Plex-Familie aus `TYPE.map`, `TYPE.ui` und `TYPE.num`
     mindestens ein `@font-face` in `app.css`, dessen `src: url(...)` auf eine dieser
     getrackten Dateien zeigt. Beides ist vor dem Einbetten rot.
  2. Derselbe Wächter beweist an sich selbst, dass die neue Zusicherung greift: gegen eine
     synthetische, leere Dateiliste muss sie werfen — dieselbe Zwei-Richtungs-Probe, die
     `ui-reachability.test.ts` mit der künstlichen Waise fährt.
  3. Kein Netz (R-FREE-04): weder `app.css` noch `apps/desktop/index.html` enthalten in einer
     Schriftquelle ein `https:`; kein `<link>` auf einen fremden Host. Der Wächter prüft beide
     Dateien wörtlich. Die CSP der Hülle bleibt unangetastet — `default-src 'self'` deckt
     lokale Schriftdateien ohne Änderung ab.
  4. `test/design-gate.test.ts` vergleicht bisher nur Farbtokens. Neu: die Schriftfamilien, die
     `docs/design/ui-mockup.html` benutzt, sind dieselben, die `TYPE` verlangt — sonst zeigt
     das freigegebene Mockup etwas anderes als das Spiel.
  5. `ASSETS.md` nennt jede der vier Dateien beim Namen (der bestehende Test sucht die
     Dateinamen wörtlich), nennt die OFL 1.1 und ersetzt den Satz über das Mockup durch die
     Fassung, die stimmt: eingebettet, lokal, ohne Netz. `OFL.txt` liegt bei den Dateien, wie
     die Lizenz es verlangt.
- **Fertig wenn:** `pnpm verify` grün; `git ls-files 'apps/desktop/src/ui/fonts/*.woff2'`
  liefert mindestens vier Treffer, die zusammen **unter 400 KB** wiegen (Zahl in der
  Aufgabennotiz festgehalten); der Wächter fällt gegen eine leere Asset-Menge; keine
  Schriftquelle in `app.css` oder `index.html` beginnt mit `https:`; die Aussage in `ASSETS.md`
  über das Einbetten ist durch einen Test gedeckt statt durch einen Satz. Der einmalige Bezug
  der Schriftdateien von `github.com/IBM/plex` läuft unter derselben Freigabe für externen
  Bezug, die T-M9-01 für die Geodaten erteilt hat; ein neuer Haltepunkt entsteht dadurch nicht.

### T-M14-10 · Was passiert, wenn es schiefgeht
- **Ziel:** Drei Wege, auf denen das Spiel heute stumm bleibt, statt etwas zu sagen — alle drei
  am Code nachgeprüft. **(a) Befund N6, 55b:** `grep` über `apps` und `packages` nach
  `ErrorBoundary|componentDidCatch|getDerivedStateFromError|window.onerror|unhandledrejection`
  findet **null Treffer**; jeder unabgefangene Renderfehler — etwa nach einem migrierten Stand,
  der ein Feld verloren hat — ergibt eine weiße Fläche ohne Hinweis, und der Playtest liefert
  Noah dazu gar nichts. **(b) Befund N4:** `checkVictory` setzt `winner` nur, wenn genau **eine**
  Macht lebt; der Siegdialog hängt an `view.victory.winner !== null`, und `alive` kommt in
  `App.tsx` kein einziges Mal vor. Scheidet der Mensch als einer von acht aus, tickt das Spiel
  weiter — keine Provinz, keine Armee, kein Dialog, nur `PLAYER_ELIMINATED` im Protokoll.
  R-UI-13 verlangt ausdrücklich, dass eine entschiedene Partie das von sich aus sagt.
  **(c) Befund 37:** `setDialog('new')` existiert ausschließlich als `useState`-Anfangswert, und
  der `NewGameDialog` wird nur im frühen Rücksprung für den Zustand ohne Partie gezeichnet —
  eine zweite Partie kostet einen Programmneustart.
  **Zuständigkeitsgrenze:** Diese Aufgabe besitzt **Fehlerfall, Niederlage und Neustart** und
  damit als einzige `apps/desktop/src/ui/Dialogs.tsx` und `apps/desktop/src/i18n/de.ts` in
  Phase 3/4. T-M14-13 besitzt ausschließlich die Kommandoabdeckung: Kartenwahl und Debug-Panel
  in `newGame.ts`/`App.tsx` gehören dort hin, die zweite Partie hierher. Wer beides in einer
  Aufgabe anfasst, schreibt dieselbe Zeile zweimal.
- **Anforderungen:** R-UI-13, R-GAME-01, R-GAME-05
- **Abhängigkeiten:** T-M13-12, T-M14-08
- **Dateien:** `apps/desktop/src/ui/ErrorBoundary.tsx` *(neu)*, `apps/desktop/src/main.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Standings.tsx`,
  `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`,
  `packages/core/src/view/publicView.ts`
- **Tests zuerst:**
  1. `apps/desktop/src/ui/ErrorBoundary.test.tsx`: ein Kind, das beim Rendern wirft, ergibt eine
     Auffangfläche mit einem deutschen Satz, der Fehlermeldung und einem Knopf „Neu laden" —
     nicht eine leere Seite. Ein zweiter Test sichert, dass ein Kind, das **nicht** wirft,
     unverändert durchgereicht wird. Die Fläche wird in `main.tsx` um `<App/>` gelegt; der
     Erreichbarkeitswächter bleibt ohne neue Ausnahme grün.
  2. `packages/core/src/view/publicView.test.ts`: `publicView(state, 'p1').self` trägt
     `alive: boolean`. Heute gibt es das Feld nur unter `others` — die eigene Macht ist die
     einzige, deren Ausscheiden die Sicht verschweigt. Das ist eine Änderung an der **Sicht**,
     nicht an den Regeln: `checkVictory` bleibt unangetastet, damit kein Hash wandert.
  3. `apps/desktop/src/App.test.tsx`: aus einem Zustand, in dem `p1` ausgeschieden ist,
     erscheint **genau einmal** ein Niederlagendialog (`standings.defeatTitle`), die
     Geschwindigkeit steht danach auf 0, und der Dialog nennt Tag und Ursache. Rot, solange die
     Oberfläche nur auf `victory.winner` sieht.
  4. `packages/core/test/determinism.test.ts` und `apps/headless/test/walkthrough.test.ts`
     bleiben **unverändert** grün — der Beleg dafür, dass die Niederlage in der Oberfläche
     entstanden ist und nicht in den Regeln.
  5. `apps/desktop/src/App.test.tsx`, zweiter Block: bei laufender Partie führt der Menüeintrag
     „Neue Partie" zum `NewGameDialog`, und nach dem Start läuft eine zweite Partie in derselben
     Sitzung — der Dialog wird dafür aus dem frühen Rücksprung herausgezogen. Läuft Spielzeit
     ohne Speicherung, kommt vorher eine Rückfrage. `apps/desktop/src/ui/Standings.test.tsx`:
     Sieg- **und** Niederlagendialog bieten denselben Knopf an; „Karte ansehen" bleibt daneben
     bestehen.
- **Fertig wenn:** `pnpm verify` grün; ein werfendes Kind ergibt die Auffangfläche mit Satz und
  Knopf statt einer weißen Seite; `view.self.alive` ist `false`, sobald die Macht ausgeschieden
  ist, und die Oberfläche zeigt darauf genau einen Dialog und hält die Uhr an; Determinismus-
  und Walkthrough-Test sind unverändert grün; aus Menü, Sieg- und Niederlagendialog beginnt
  eine zweite Partie ohne Programmneustart — Playtest-Frage 48 („eine Einstellung, die sichtbar
  nichts bewirkt?") verliert damit eine ihrer drei Ja-Antworten. Kartenwahl und Debug-Ansicht,
  die anderen beiden, gehören T-M14-13.

### T-M14-11 · Die KI findet ihr Ziel
- **Ziel:** Die KI bewertet nur noch Provinzen, die die betreffende Armee tatsächlich erreichen
  kann, und die ausgelieferte Voreinstellung stellt ihr Nachbarn gegenüber statt Namen in
  Kartenreihenfolge. Antwort auf Befund 11, 30, 31, 43 (gemeinsame Ursache D). Heute zählt
  `hopDistance` Seekanten wie Landkanten, `rateProvinces` filtert nur nach Eigentümer und
  Kriegszustand, und der Kern lehnt den daraus entstehenden Marsch mit `NO_PATH` ab: 3.046 von
  4.464 Marschbefehlen, 57 % aller KI-Befehle abgelehnt, derselbe unmögliche Befehl bis zum
  Partieende. Gleichzeitig setzt `DEFAULT_NEW_GAME` den Spieler auf die Vereinigten Staaten und
  füllt die sieben Gegner mit `slice(0, n)` über `map.startPositions` — eine Aufstellung ohne
  Landverbindung, 0 Kriegserklärungen in 1000 Tagen. Drei Teile, in dieser Reihenfolge:
  1. **Erreichbarkeit als eigene Menge.** `reachableFrom(map, from, { canUseSea })` aus
     `packages/core/src/map/pathfinding.ts` existiert bereits und ist über den Paketindex
     exportiert; `rateProvinces` benutzt sie statt der Nachbarschaftszählung. `canUseSea` wird
     aus der eigenen Armeezusammensetzung und `rules.units[].transportCapacity` bestimmt — kein
     neues Sichtfeld, kein verborgenes Wissen. Die Karte selbst ist ausdrücklich öffentlich
     (`AiContext.map`, „geography is not a secret"); der Filter ist Geographie, keine
     Aufklärung. **Keine amphibische KI in diesem Zug** (Entscheidung 4): eine Armee ohne
     Transportkapazität sieht keine Ziele jenseits des Wassers, sie lernt nicht, welche zu
     bauen.
  2. **Die Menge wird einmal berechnet, nicht je Ziel.** Ein Aufruf je Paar (Startprovinz,
     Seefähigkeit) und Denkschritt, in `decide` zwischengespeichert — sonst kauft der Filter die
     Ablehnungen mit dem Rechenbudget aus R-AI-04 zurück.
  3. **Gegnerauswahl nach Nachbarschaft.** Neu: `landNeighbourOrder(map, nation)` in
     `packages/core/src/map/neighbourhood.ts` ordnet die Startpositionen nach Abstand im
     Landgraphen von der eigenen Hauptstadt aus, Gleichstand nach Nationsname, damit dieselbe
     Karte immer dieselbe Reihenfolge ergibt. `toConfig` füllt die Gegnerliste daraus. Die
     Funktion liegt im Kern, weil der kopflose Abnahmelauf dieselbe Voreinstellung nachbauen
     muss und `apps/headless` nicht auf `apps/desktop` zugreifen darf (R-ARCH-01).
  R-AI-01 bekommt eine zusätzliche AK für den Ablehnungsanteil — der heutige grüne Beleg prüft
  einen einzigen Aufruf im Tick 0 im Frieden und kann die Lage, die das Spiel dauernd
  herstellt, gar nicht sehen.
- **Anforderungen:** R-AI-01, R-AI-03, R-GAME-01
- **Abhängigkeiten:** T-M14-02
- **Dateien:** `packages/core/src/map/neighbourhood.ts` *(neu)*, `packages/core/src/index.ts`,
  `packages/ai/src/targeting.ts`, `packages/ai/src/military.ts`, `packages/ai/src/decide.ts`,
  `apps/desktop/src/game/newGame.ts`, `docs/plan/01-REQUIREMENTS.md`,
  `docs/reports/ai-reachability.md` *(neu)*
- **Tests zuerst:** Der Ausgangswert wird **vor** dem Umbau gemessen und als Zahl mit Datum in
  den Test und in den Bericht geschrieben — ein „weniger als vorher" ohne Vorher-Zahl ist keine
  Messung. Danach, alle vor dem Code rot:
  `packages/core/src/map/neighbourhood.test.ts` — auf der Weltkarte liefert `landNeighbourOrder`
  für jede Startnation eine Reihenfolge, deren erster Eintrag über reine Landkanten erreichbar
  ist; eine Inselnation liefert eine leere Landnachbarschaft statt eines falschen ersten
  Eintrags; zweimal derselbe Aufruf liefert dieselbe Folge.
  `packages/ai/src/targeting.test.ts` — auf einer Karte aus zwei Landmassen mit einer Seekante
  bewertet `rateProvinces` für eine Armee ohne Transportkapazität ausschließlich Provinzen der
  eigenen Landmasse; dieselbe Armee mit Transportern bewertet auch die andere; `hopDistance`
  misst für die Armee ohne Transport keine Entfernung über Wasser; die Erreichbarkeitsmenge wird
  bei zehn Zielbewertungen aus derselben Provinz einmal berechnet (Zähler im Testdoppel).
  `apps/desktop/src/game/newGame.test.ts` — für die ausgelieferte Voreinstellung hat jede
  teilnehmende Macht einen Landweg zu mindestens einer anderen teilnehmenden Macht; dieselben
  Optionen ergeben zweimal dieselbe Gegnerliste.
  `apps/headless/test/ai-reachability.slow.test.ts` — 90 Spieltage auf der Weltkarte mit der
  Voreinstellung, gefahren über die gemeinsame Schleife mit `runAi` je Tick (nicht über
  `sweep.ts`): Anteil der `COMMAND_REJECTED`-Ereignisse an allen KI-Befehlen, Anteil `NO_PATH`
  an allen `MOVE_ARMY`, Zahl der `WAR_DECLARED`, und die Häufigkeit jeder Paarung (Armee,
  Fehlercode). Alle Zählungen aus den gesammelten Ereignissen, nie aus `state.eventLog`.
- **Fertig wenn:** grün; im 90-Tage-Lauf mit der ausgelieferten Voreinstellung liegt der Anteil
  abgelehnter KI-Befehle unter **10 %** (gemessen vorher: 57 %), der `NO_PATH`-Anteil an allen
  KI-`MOVE_ARMY` unter **2 %** (vorher 68 %), keine Paarung (Armee, Fehlercode) kommt öfter als
  **dreimal** vor (vorher bis zum Partieende), und es fällt mindestens **eine** `WAR_DECLARED`
  (vorher 0 in 1000 Tagen). Das R-AI-04-Budget bleibt grün. Die vier Zahlen stehen
  vorher/nachher in `docs/reports/ai-reachability.md`.

### T-M14-12 · Die KI benutzt, was sie hat
- **Ziel:** Fünf Mechaniken, die der Kern kann und die KI nie anfasst, werden ihr zugänglich
  gemacht. Antwort auf Befund 12, 13, 32, 40, 41. Jeder Punkt ist im Code nachgeprüft: `grep`
  über `packages/ai/src` liefert für `SET_CAPITAL`, `MERGE_ARMIES`, `SPLIT_ARMY`, `BOMBARD`,
  `CANCEL_BUILD` und `STOP_ARMY` **null Treffer**, und `PublicView` führt kein Feld `offers`.
  1. **Hauptstadt (Befund 12).** Die Besetzungsphase setzt `capitalProvinceId` auf `null`; der
     einzige Wiederbesetzer ist der `SET_CAPITAL`-Handler, und den ruft nur die Oberfläche. Der
     befristete Teil der Strafe läuft aus, der Entfernungsteil bleibt — dauerhaft 27.000 bis
     32.000 Punkte Zielmoral, unter die Rekrutierungsschwelle hinunter. Neu:
     `packages/ai/src/capital.ts` mit `capitalCommands`, in `decide` in der strategischen Stufe
     aufgerufen: bei `view.self.capitalProvinceId === null` und einer eigenen Stadtprovinz
     `SET_CAPITAL` auf die wertvollste, mit Begründung nach R-AI-05.
  2. **Truppenmischung (Befund 32).** `economy.ts` wählt fest `tank` oder `infantry`; acht von
     zehn Einheitentypen sind reiner Spielervorteil. Die Mischung wird zu einer Regelgröße in
     `data/rules/default/ai.json` (Anteile je Klasse, Summe 1000, Status in `BALANCING.md`) und
     deckt die **Landklassen einschließlich Artillerie** ab. Luftwaffe und Marine bleiben
     ausdrücklich draußen: Lufteinsatzbefehle stehen in M18, und die amphibische KI hat Noah in
     Entscheidung 4 abgelehnt — beides wird in `DECISIONS.md` als zurückgenommene Zusage
     begründet, nicht stillschweigend weitergeschleppt. **Die Artillerie ist Vorbedingung für
     R-BAT-08 in M15:** `armyRange` ist heute für jede KI-Armee 0, eine Feuerautomatik wäre für
     sie gebaut, grün getestet und wirkungslos, und R-BAT-08/AK3 wie R-AI-08/AK3 verlangen
     Beschussereignisse **je Schwierigkeitsstufe** — deshalb zählt hier nicht eine Armee
     irgendwo, sondern eine je KI-Macht.
  3. **Verbände zusammenlegen (Befund 40).** Die KI hält bis zu **127** Armeeobjekte, der
     größte Teil davon auf vier Provinzen. Im Gefecht kostet das nichts — alle Armeen eines
     Spielers in einer Provinz kämpfen als eine Seite —, aber jede Armee entscheidet einzeln,
     sodass die KI keinen Schwerpunkt bildet und jeder Denkschritt über 127 statt über eine
     Handvoll Armeen läuft. `militaryCommands` legt Armeen derselben Provinz zusammen, bevor es
     einzeln entscheidet.
  4. **Handel (Befund 13).** `tradeCommands` hängt an `view.self.shortages`, und diese Liste
     meldet ausschließlich einen bereits eingetretenen Soldausfall. Gemessen: 0 `TRADE` und
     0 `TRADE_EXECUTED` in drei Läufen, die Marktpreise stehen am Ende exakt auf den
     Grundwerten. Der Auslöser wird vom Mangel gelöst: verkauft wird, was über der Rücklage und
     über dem Bedarf der nächsten N Tage liegt, gekauft, was der teuerste offene Bau- oder
     Aushebeauftrag braucht. N steht in den Regeldateien.
  5. **Frieden (Befund 41).** Die KI wirft `acceptPeace` blind — sie *kann* nicht prüfen, ob
     ein Angebot vorliegt. Ergebnis: 408 Versuche, davon rund **99 %** mit
     `DIPLOMACY/INVALID_TARGET` („kein Angebot") abgewiesen. `PublicView` bekommt ein Feld
     `offers` mit den an mich gerichteten und den von mir gestellten Angeboten aus
     `state.diplomacy.offers` — Begründung nach R-DIP-04 in einem Satz an der Feldstelle: ein an
     mich gerichtetes Angebot ist meine eigene Post. **`PublicView.offers` ist Vorbedingung für
     R-DIP-06/AK3 und R-AI-08/AK2 in M15:** die KI kann ein Angebot nicht bewerten, das sie
     nicht sieht. Die Annahmeregel wird zugleich vom eigenen Unterlegensein gelöst; die
     Verhältnis- und Ansehensbewertung selbst bleibt M15 (T-M15-05).
- **Anforderungen:** R-AI-01, R-AI-03, R-PROV-05, R-ECON-05, R-DIP-03, R-DIP-04
- **Abhängigkeiten:** T-M14-11
- **Dateien:** `packages/ai/src/capital.ts` *(neu)*, `packages/ai/src/economy.ts`,
  `packages/ai/src/military.ts`, `packages/ai/src/diplomacy.ts`, `packages/ai/src/decide.ts`,
  `packages/core/src/view/publicView.ts`, `packages/core/src/rules/types.ts`,
  `packages/core/src/rules/load.ts`, `data/rules/default/ai.json`,
  `docs/plan/01-REQUIREMENTS.md`, `docs/plan/BALANCING.md`, `docs/plan/DECISIONS.md`,
  `docs/reports/ai-parity.md` *(neu)*
- **Tests zuerst:** Fünf Fassungen, jede vor ihrem Code rot, jede gegen den Zustand **nach** dem
  Tageswechsel statt gegen die Formel:
  `packages/ai/src/capital.test.ts` — eine KI ohne Hauptstadt mit eigener Stadtprovinz erzeugt
  genau ein `SET_CAPITAL` auf die wertvollste; eine KI mit Hauptstadt erzeugt keines; eine KI
  ohne jede Stadtprovinz erzeugt keines und begründet das.
  `packages/ai/src/economy.test.ts` — `recruitCommands` erzeugt über hundert Denkschritte jede
  in der Regeldatei genannte Klasse mindestens einmal, darunter `artillery`, und keine Klasse,
  die dort nicht steht; `tradeCommands` erzeugt ohne jeden Mangel ein `TRADE`, sobald ein
  Bestand über Rücklage und Tagesbedarf liegt und ein Bauauftrag offen ist, und erzeugt keines,
  wenn der Verkauf die Rücklage anbrechen würde.
  `packages/ai/src/military.test.ts` — bei vier eigenen Armeen in derselben Provinz entsteht
  genau ein `MERGE_ARMIES` über alle vier, und im Folgeschritt keines mehr.
  `packages/core/src/view/publicView.test.ts` — `offers` enthält ein an mich gerichtetes Angebot
  und ein von mir gestelltes, und **kein** Angebot zwischen zwei Dritten.
  `packages/ai/src/diplomacy.test.ts` — ohne Angebot in der Sicht entsteht kein `acceptPeace`;
  mit Angebot entsteht genau eines; `offerPeace` bleibt unabhängig davon.
  `apps/headless/test/ai-parity.slow.test.ts` *(neu)* — 90 Spieltage, Weltkarte, die
  Voreinstellung aus T-M14-11, gezählt über die gesammelten Ereignisse, nicht über den
  500er-Ringpuffer.
- **Fertig wenn:** grün; im 90-Tage-Lauf gilt: keine KI-Macht endet mit
  `capitalProvinceId === null`, solange sie eine Stadtprovinz hält (vorher: jede, die ihre
  Hauptstadt verlor); **je KI-Macht trägt am Ende mindestens eine Armee `armyRange > 0`**
  (vorher 0 für jede — eine einzelne Artilleriearmee auf einer Stufe machte R-BAT-08/AK3 und
  damit T-M15-07 unabnehmbar); keine KI-Macht hält mehr als **drei** Armeeobjekte in derselben
  Provinz (vorher **127** bei einer Macht, der größte Teil auf vier Provinzen); jede KI-Macht
  erzeugt mindestens ein `TRADE_EXECUTED` (vorher 0 in drei Läufen); der Anteil abgewiesener
  `acceptPeace` liegt unter **5 %** (vorher rund **99 %**) und zwischen zwei KI-Mächten kommt
  mindestens ein Frieden zustande. Die Anteile der Truppenmischung und der Handelsvorlauf
  stehen in `BALANCING.md` mit Status; die Zahlen vorher/nachher stehen in
  `docs/reports/ai-parity.md`; der Verzicht auf Luftwaffe und Marine steht mit Begründung in
  `DECISIONS.md`.

### T-M14-13 · Was der Kern kann, muss der Spieler erreichen
- **Ziel:** Das Muster, das dieses Projekt dreimal getroffen hat — Symbolsatz, Ton,
  Einstiegshilfe: gebaut, einzeln geprüft, für den Spieler nicht vorhanden —, in seiner vierten
  Auflage, diesmal nicht als Modul, sondern als Kommando. Der eigentliche Punkt dieser Aufgabe
  ist **der Wächter**, nicht die fünf Löcher, die er aufdeckt. `test/guards/reachability.ts`
  prüft heute nur Modul-Erreichbarkeit und wird von einem `export const` zufriedengestellt.
  Neu: ein Wächter, der jeden im Kern **registrierten Kommandotyp** und jede
  **Aufzählungsvariante** gegen das hält, was die Oberfläche erzeugen kann.
  1. **Der Wächter (`test/guards/ui-command-coverage.ts`).** Teil A liest die
     `registerCommand<…>('X', …)`-Stellen unter `packages/core/src/commands/` — die
     Registrierung ist die Wahrheit, nicht eine zweite Liste, die driften kann — und kreuzt sie
     gegen die Kommandos, die die exportierten Fabriken aus `apps/desktop/src/game/actions.ts`
     über einen vorbereiteten Spielzustand tatsächlich liefern (`ActionSpec.command`,
     `targetAction` für die Ziel-Kommandos). Zur Laufzeit, nicht per Textsuche: eine Fabrik, die
     nichts erzeugt, sieht im Quelltext gleich aus wie eine, die es tut. Teil B tut dasselbe für
     die Aufzählungen, die ein Kommando oder die Partieerstellung trägt: `Stance` (drei
     Varianten), `DiplomacyAction` (acht), `BuildingKey`, die Einheitenschlüssel,
     `NewGameOptions.victory` und die Kartenkennungen aus `main.tsx`. Teil C ist eine
     Ausnahmeliste `UI_COVERAGE_EXCEPTIONS` nach dem Muster von `REACHABILITY_EXCEPTIONS`: jeder
     Eintrag trägt einen Satz Begründung, und der Test besteht darauf. Erster und zunächst
     einziger Eintrag ist `victory: 'time'` — der Zeitsieg ist eine in T-M14-03 zurückgenommene
     Zusage, kein zu bauendes Loch, und die Begründung verweist auf `DECISIONS.md`. Der Wächter
     wird in beide Richtungen geprüft, wie jeder Wächter dieses Repos.
  2. **Rückzug (Befund 8).** `actions.ts` ruft die generische Hilfsfunktion `stance` nur mit
     `'aggressive'` und `'defensive'` auf; `'retreat'` fehlt als einzige Zeile, während die KI
     es als Standardverhalten jeder unterlegenen Armee setzt. Die Umkehrung von R-AI-01: die KI
     kann, was der Spieler nicht kann. Der Text `army.stanceRetreat` liegt seit M10 unbenutzt da.
  3. **Kampfbericht (Befund 9).** `BATTLE_RESOLVED` trägt `losses: Record<PlayerId, Fixed>`;
     `game/events.ts` übernimmt in `valuesFor` nur Felder vom Typ `number` oder `string`, also
     fällt `losses` als Objekt **still** heraus, und der Satz nennt nur den Sieger. Die fünf
     Schlüssel `events_ui.battleReport` und Nachbarn liegen fertig da. Der Spieler erfährt, wer
     das Feld behauptet, nicht was es gekostet hat — R-BAT-07 verlangt beide Seiten.
  4. **Bauabbruch (Befund 36/48).** `CANCEL_BUILD` ist das einzige der zwölf Kernkommandos ohne
     Erzeuger in der Oberfläche, und es ist mit dem heutigen Datenfluss nicht verdrahtbar:
     `publicView` liefert je Bauauftrag `building`, `startedTick` und `completesAtTick`, aber
     nicht die `orderId`, die der Handler verlangt. Also erst das Feld (Begründung nach
     R-DIP-04: es ist der eigene Auftrag, nur bei eigenen Provinzen), dann der Knopf mit der
     halben Rückerstattung im Tooltip. Bauplätze sind knapp; im Messlauf entstanden 1417
     `BUILD/QUEUE_FULL`-Ablehnungen.
  5. **Debug-Panel (Befund 10).** `App.tsx` füttert `DebugPanel` mit
     `{ hash: '', aiGoals: [], commands: [] }`. Die KI erzeugt Begründungen nur bei
     `explain: true`, und `advance` fordert sie nie an. `advance` reicht sie durch, wenn der
     Debug-Schalter an ist; der Hash kommt aus `hashValue(state, { omitKeys: HASH_OMIT_KEYS })`,
     derselben Rechnung wie im Spielstand.
  6. **Kartenwahl (Befund 38).** `Dialogs.tsx` schreibt `options.mapId`, `main.tsx` stellt zwei
     Karten zur Wahl und übergibt nur `worldMap`, und `startGame` bekommt die feste `props.map`.
     Wer „Kleine Welt" wählt, bekommt kommentarlos die Weltkarte. `main.tsx` übergibt eine
     Kartensammlung, `startGame` wählt daraus.
  **Zuständigkeitsgrenze:** Diese Aufgabe besitzt **ausschließlich die Kommandoabdeckung** —
  Wächter, Rückzug, Kampfbericht, Bauabbruch, Debug-Panel, Kartenwahl. Fehlerfläche,
  Niederlagendialog und die zweite Partie gehören T-M14-10; `apps/desktop/src/ui/Dialogs.tsx`
  und `apps/desktop/src/i18n/de.ts` werden hier nicht angefasst.
- **Anforderungen:** R-UI-05, R-UI-08, R-BAT-05, R-BAT-07, R-GAME-01, R-AI-05, R-DIP-04
- **Abhängigkeiten:** T-M14-12
- **Dateien:** `test/guards/ui-command-coverage.ts` *(neu)*, `apps/desktop/src/game/actions.ts`,
  `apps/desktop/src/game/events.ts`, `apps/desktop/src/game/advance.ts`,
  `apps/desktop/src/game/newGame.ts`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/main.tsx`,
  `packages/core/src/view/publicView.ts`, `docs/plan/01-REQUIREMENTS.md`,
  `docs/plan/DECISIONS.md`
- **Tests zuerst:** `test/guards/ui-command-coverage.test.ts` *(neu)* zuerst und in beide
  Richtungen: gegen den echten Baum meldet er heute genau `CANCEL_BUILD` und die Variante
  `'retreat'`, und gegen eine synthetische Fabrikliste, aus der eine Variante entfernt wurde,
  meldet er genau diese — ein Wächter, der nur in eine Richtung geprüft ist, ist eine
  Behauptung. Jede Ausnahme trägt eine Begründung von mehr als vierzig Zeichen. Dazu, jeder vor
  seinem Code rot:
  `apps/desktop/src/game/actions.test.ts` — `armyActions` liefert drei Haltungsknöpfe, der
  dritte trägt `stance: 'retreat'`, seine Beschriftung kommt aus `army.stanceRetreat`, und er
  ist gesperrt, wenn die Armee bereits zurückgeht; `cancelBuildAction` erzeugt `CANCEL_BUILD`
  mit der `orderId` des gewählten Auftrags und nennt die Rückerstattung.
  `packages/core/src/view/publicView.test.ts` — `buildQueue` trägt für eigene Provinzen eine
  `orderId`, für fremde weder Warteschlange noch Kennung.
  `apps/desktop/src/game/events.test.ts` — ein `BATTLE_RESOLVED` mit Verlusten zweier Spieler
  ergibt eine Zeile, die beide Nationen und beide Verlustzahlen nennt; ein objektwertiges Feld
  fällt nicht mehr stillschweigend heraus.
  `apps/desktop/src/game/advance.test.ts` — mit eingeschaltetem Debug reicht `advance` je
  KI-Spieler mindestens eine Begründung samt Alternative durch, ohne ihn keine, und der
  Spielverlauf ist in beiden Fällen bitgleich.
  `apps/desktop/src/game/newGame.test.ts` — mit `mapId: 'testworld'` trägt der Anfangszustand
  `mapId === 'testworld'` und die Provinzzahl der kleinen Karte.
  `apps/desktop/src/App.test.tsx` — bei eingeschaltetem Debug zeigt das Panel einen nichtleeren
  Hash und mindestens ein Ziel je KI-Spieler.
- **Fertig wenn:** grün; der Wächter findet für **jeden** im Kern registrierten Kommandotyp
  (12 von 12) und für **jede** Variante von `Stance` (3), `DiplomacyAction` (8), `BuildingKey`
  und den Einheitenschlüsseln einen Erzeuger in der Oberfläche, und `UI_COVERAGE_EXCEPTIONS`
  enthält genau einen Eintrag (`victory: 'time'`) mit Begründung und Verweis auf
  `DECISIONS.md`. `pnpm verify` und `pnpm coverage:requirements` sind grün. Playtest-Frage 48
  („Gibt es eine Einstellung im Menü, die sichtbar nichts bewirkt?") lässt sich für Kartenwahl
  und Debug-Ansicht mit nein beantworten.

### T-M14-14 · Der Abnahmetest, den AK-1 immer gebraucht hätte
- **Ziel:** Eine Partie mit der **ausgelieferten Voreinstellung** läuft kopflos bis zu einer
  Entscheidung, und AK-1 zeigt auf genau diesen Lauf statt auf `pnpm test:slow`. Heute sichert
  kein Test zu, dass irgendeine Partie einen Ausgang erreicht: die einzigen
  `winner`-Zusicherungen sind ein Zweispieler-Einheitstest und ein Determinismusvergleich; der
  Weltkarten-Langlauf bricht bei einem Sieger nur ab, ohne ihn je zu fordern. *(Befunde 2, 29,
  34)*
- **Der Punkt, an dem der Test scheitern kann, bevor er etwas misst:** er darf die Partie
  **nicht selbst erklären**. Er liest `DEFAULT_NEW_GAME` und `toConfig` aus
  `apps/desktop/src/game/newGame.ts` — dieselbe Quelle, aus der die Anwendung ihre
  Voreinstellung nimmt — und enthält keine eigene Spielerliste. Sonst misst er wieder ein
  anderes Spiel als das ausgelieferte, und das ist genau der Fehler, den dieser Meilenstein
  abstellt. Regelwerk: `defaultRules()` aus `@worldwar/testkit` (die echten Dateien aus
  `data/rules/default/`), Karte: `data/maps/world.json`, Schleife: die gemeinsame aus T-M14-04.
- **Anforderungen:** R-GAME-02 — dazu Abnahmekriterium AK-1
- **Abhängigkeiten:** T-M14-01, T-M14-04, T-M14-05, T-M14-06, T-M14-07, T-M14-11, T-M14-12
- **Dateien:** `apps/headless/test/full-game.slow.test.ts` *(neu)*, `test/scripts.test.ts`,
  `scripts/acceptance.mjs`, `package.json`, `docs/plan/02-DESIGN.md` (D15),
  `docs/reports/ak1-full-game.md` *(neu, vom Test geschrieben)*, `docs/reports/acceptance.md`
- **Tests zuerst:**
  1. `apps/headless/test/full-game.slow.test.ts` — `toConfig(DEFAULT_NEW_GAME, world)` liefert
     mindestens vier Mächte mit `kind: 'ai'`; der Lauf endet mit `state.victory.winner !== null`
     spätestens am Spieltag 1500 (harter Deckel). *Heute rot:* in der Voreinstellung fällt in
     1000 Tagen keine einzige Kriegserklärung, und eine leere Armee-Hülle hielte den letzten
     Verlierer am Leben (Befund 53, in T-M14-07 behoben).
  2. Derselbe Lauf erzeugt mindestens ein `WAR_DECLARED`, ein `BATTLE_RESOLVED` und ein
     `PROVINCE_CAPTURED`. *Heute rot* aus demselben Grund.
  3. **Keine Blockade, messbar:** das längste Fenster ohne ein Ereignis aus
     `{PROVINCE_CAPTURED, BATTLE_RESOLVED, ARMY_ARRIVED, BUILD_COMPLETED}` bleibt unter 100
     Spieltagen. Die Ereignisse kommen aus den gesammelten `events`, nicht aus dem
     500er-Ringpuffer.
  4. **Niederlage zählt so viel wie Sieg:** jede Macht mit `alive === false` hat genau ein
     `PLAYER_ELIMINATED`; der Bericht nennt, ob der Menschplatzhalter gewonnen hat oder
     ausgeschieden ist. Dazu die Gesundheitsprüfungen des Langlaufs: kein Bestand negativ, jede
     Provinzmoral endlich.
  5. `test/scripts.test.ts` — `package.json` kennt `sim:fullgame`, und das Skript zeigt auf
     genau diese Testdatei; `scripts/acceptance.mjs` führt AK-1 in einer **eigenen** Zeile aus,
     die `sim:fullgame` startet, und keine Zeile trägt mehr die Sammelkennung `AK-1/4/6`.
     *Heute rot:* AK-1 wird kollektiv über `pnpm test:slow` bescheinigt.
  6. `test/scripts.test.ts` — die Abnahmetestdatei nennt `DEFAULT_NEW_GAME` und enthält kein
     eigenes `kind: 'ai'`. Der Test, der den Test bindet: eine handgeschriebene Spielerliste
     wäre eine zweite Voreinstellung, und die wäre ab dem ersten Tag falsch.
- **Fertig wenn:** `pnpm sim:fullgame` ist grün mit: Sieger gesetzt spätestens am Spieltag 1500,
  mindestens vier KI-Mächte, ≥ 1 `WAR_DECLARED`, ≥ 1 `BATTLE_RESOLVED`, längstes Fenster ohne
  Fortschrittsereignis < 100 Spieltage, Laufzeit < 15 Minuten; `docs/reports/ak1-full-game.md`
  nennt Karte, Regelwerk, Spielerliste, Sieger, Entscheidungstag, Ereigniszahl je Typ, längstes
  Stillstandsfenster und Laufzeit; `docs/reports/acceptance.md` führt AK-1 als eigene Zeile mit
  `pnpm sim:fullgame` und keine Zeile mehr als AK-1/4/6; `pnpm verify` grün.
  **Und die Regel, die diese Aufgabe wertvoll macht:** entscheidet der Lauf sich nicht innerhalb
  des Deckels, wird der Deckel **nicht** erhöht — der Befund geht als offener Punkt nach
  `docs/plan/PROBLEME.md` und ist eine Balance- oder Siegbedingungsfrage, kein Testproblem.

### T-M14-15 · Der Playtest-Bogen misst, was schiefgehen kann ⛔ **Haltepunkt**
- **Ziel:** `docs/PLAYTEST.md` fragt nach der **Anforderung** statt nach dem Gebauten, deckt die
  sechs Wege ab, auf denen die V1 nachweislich scheitert, und wird von Noah ausgefüllt. Danach —
  und erst danach — ist AK-7 beantwortbar und T-M12-03 erreichbar. *(Befund N10)*
- **Was heute falsch ist:** Frage 4 fragt nach „Macht, Gegnerzahl, Schwierigkeit, Startzahl",
  während R-GAME-01 an **erster** Stelle die Karte nennt — genau den Schalter ohne Wirkung
  (Befund 38). Frage 48 („Gibt es eine Einstellung, die sichtbar nichts bewirkt? Erwartet:
  nein") ist damit vorbeantwortet. Es fehlen: Fenster schließen und neu öffnen (Befund 4),
  zweite Partie nach der ersten (Befund 37), Rückzug (Befund 8), Kampfbericht mit beiden Seiten
  (Befund 9), Bauabbruch (Befund 36), die eigene Niederlage (Befund N4) — und die Schrift, die
  es im Repository nicht gibt (Befund N1).
- **Anforderungen:** R-UI-05 — dazu Abnahmekriterium AK-7
- **Abhängigkeiten:** T-M14-03, T-M14-08, T-M14-09, T-M14-10, T-M14-13, T-M14-14
- **Dateien:** `docs/PLAYTEST.md`, `docs/ANLEITUNG.md`, `docs/plan/tasks.yaml`,
  `docs/plan/03-TASKS.md`, `docs/reports/playtest-v1.md` *(neu — der ausgefüllte Bogen als
  Akte)*
- **Tests zuerst:**
  1. `test/docs.test.ts` — die Frage zu R-GAME-01 nennt jede Wahlmöglichkeit, die
     `01-REQUIREMENTS.md` in R-GAME-01 aufzählt, und die **Karte zuerst**. Der Test liest die
     Anforderungszeile und übersetzt ihre Begriffe über eine im Test sichtbare Tabelle
     (`Seed` → `Startzahl`, `Anzahl KI-Gegner` → `Gegnerzahl`); er verdrahtet die Wörter nicht
     fest. *Heute rot:* „Karte" kommt in Frage 4 nicht vor.
  2. `test/docs.test.ts` — zu jeder dieser Kennungen steht mindestens eine Frage im Bogen:
     `R-GAME-01`, `R-GAME-02`, `R-GAME-03`, `R-GAME-04`, `R-BAT-05`, `R-BAT-07`, `R-PROV-01`.
     *Heute rot* für R-GAME-02, R-BAT-05, R-BAT-07 und R-PROV-01 — vier Mechaniken, die der Kern
     kann und nach denen der Abnahmebogen nie gefragt hat.
  3. `test/docs.test.ts` — der Bogen enthält eine Frage, die Schließen und Neustart des Fensters
     verbindet, und eine, die die Schrift beim Namen nennt (`IBM Plex`). *Heute rot.*
  4. `test/docs.test.ts` — die Anleitung erklärt `Rückzug`, `Kampfbericht` und `Bauabbruch`,
     damit ein Nein im Playtest kein Dokumentationsloch ist. *Heute rot.*
  5. `test/plan-consistency.test.ts` — die Haltepunktliste lautet
     `['T-M9-01', 'T-M10-01', 'T-M12-03', 'T-M14-15']`, jeder Haltepunkt trägt eine Begründung,
     und **jede Aufgabe mit `gate: true` steht in der Tabelle „Haltepunkte, an denen Noah
     gebraucht wird" in `03-TASKS.md`**. Die zweite Hälfte ist neu: eine Tabelle, die niemand
     prüft, ist genau die Sorte Zusage, die dieser Meilenstein aufräumt. *Heute rot.*
     **Reihenfolge, die nicht verhandelbar ist:** Die Liste im Wächter und der `gate:`-Block
     dieser Aufgabe in `tasks.yaml` werden in **derselben** Änderung eingetragen. Wer den Block
     vorher einspielt, spielt einen roten Wächter ein, den keine andere Aufgabe grün machen
     kann. **Deshalb steht in `tasks.yaml` bei T-M14-15 heute kein `gate:`-Block** — ein
     Kommentar an dieser Stelle sagt, warum, und diese Aufgabe trägt `gate: true` samt
     `gate_reason` („Noah spielt die V1 nach dem überarbeiteten `docs/PLAYTEST.md` (AK-7); ohne
     seine Antworten in `docs/reports/playtest-v1.md` ist T-M12-03 nicht abschließbar") zusammen
     mit der Wächterliste nach.
  6. `test/plan-consistency.test.ts` (vorhandene Zusicherung) — T-M12-03 trägt in **beiden**
     Plandateien die Abhängigkeiten T-M12-01, T-M12-02b und T-M14-15; T-M14-14 kommt über die
     `deps` dieser Aufgabe mit und wird nicht zusätzlich eingetragen. *Beides ist bereits
     eingetragen und hier nur nachzuprüfen.*
- **Fertig wenn:** `pnpm verify` ist grün, das heißt: die sieben Kennungen aus Punkt 2 haben je
  eine Frage, jede nummerierte Frage trägt weiterhin eine Anforderungs-ID, die Haltepunkttabelle
  und die Gate-Liste stimmen überein, und T-M12-03 hängt in beiden Dateien an dieser Aufgabe.
  **Der Haltepunkt selbst ist erfüllt, wenn** `docs/reports/playtest-v1.md` vorliegt: jede Frage
  beantwortet, jedes Nein mit einer Zeile in der Befundtabelle, die drei Kernfragen (A/B/C)
  beantwortet. Erst dann ist AK-7 grün — und T-M12-03 darf gestartet werden.

---

## Meilenstein M15 — Die KI wird ein Gegner

> **Warum es diesen Meilenstein gibt.** Nach M14 stimmt der Bericht — aber das Spiel ist
> deshalb noch kein Spiel: Tag 1 unterscheidet sich von Tag 40 durch nichts als den
> Kontostand, und der Gegner erklärt keinen Krieg, handelt nie und beantwortet kein Angebot.
> M15 ist das **reduzierte V1.2** nach Noahs Entscheidung 3 vom 2026-09-05: drin sind
> R-TECH-01, R-TECH-02, R-DIP-06, R-BAT-08, R-AI-08, R-GAME-07 und R-TIME-06;
> R-NEWS-01/02/03 sind durch einen Filter „Weltgeschehen" im bestehenden Ereignisprotokoll
> ersetzt und werden gestrichen; R-SPY-01…06, R-DIP-05 und R-DIP-07 stehen in M17.
>
> **Die Reihenfolge ist der halbe Inhalt.** Zuerst das gemeinsame Substrat (T-M15-01: wer
> erfährt was), dann die Freischaltung und ihre Sichtbarkeit (T-M15-02, T-M15-03), dann die
> Migration — **mit** dem ersten neuen Zustandsfeld, nie danach (T-M15-04). T-M15-04 legt
> **alle** Zustandsfelder von M15 leer an und bleibt der einzige Schritt 1 → 2; keine spätere
> Aufgabe dieses Meilensteins erhöht `SCHEMA_VERSION` ein zweites Mal. Erst danach ändern
> T-M15-05 bis T-M15-07 Verhalten, und T-M15-08 misst als letzte Aufgabe, ob die gebauten
> Mechaniken für die KI überhaupt leben.

### T-M15-01 · Wer erfährt was — Alarm, Lektüre, Adressat — und `BATTLE_STARTED`
- **Ziel:** Das Ereignissystem unterscheidet drei Dinge, die es heute in zwei Feldern
  vermischt: *wer darf es lesen* (`audience`), *muss es gesehen werden, bevor die Zeit
  weiterläuft* (`severity`) und — neu — *an wen ist es gerichtet* (`concerns`). Heute hält
  `firstAlertFor` jedes öffentliche Alarmereignis für jeden Spieler an: eine Eroberung zwischen
  zwei fremden Mächten stoppt das Vorspulen eines Unbeteiligten (R-TIME-06/AK2). Zugleich
  erzeugt der Kern `BATTLE_STARTED` nirgends, obwohl Vorspulziel und Alarmliste es kennen
  (R-TIME-06/AK3). Beides ist dasselbe Substrat: darauf stehen später der Filter
  „Weltgeschehen", die Feuerautomatik R-BAT-08 und — falls M17 kommt — R-SPY-04/AK3. Wird es
  nicht **zuerst** entschieden, wird es mehrfach improvisiert und jedes Mal anders. `concerns`
  ist ein **Pflichtfeld** an `BaseEvent`, Vorgabe im `emit()`: `concerns = audience`. Ein
  optionales Feld hätte die Migration gespart und genau den Fehler wiederholt, den R-TECH-01/AK3
  benennt — ein fehlendes Betroffenenfeld wäre still „betrifft niemanden". *(Befunde 27 und 60)*
- **Anforderungen:** R-TIME-06
- **Abhängigkeiten:** T-M14-15
- **Dateien:** `packages/core/src/events/types.ts`, `packages/core/src/events/emit.ts`,
  `packages/core/src/clock.ts`, `packages/core/src/phases/combat.ts`,
  `packages/core/src/phases/occupation.ts`, `packages/core/src/phases/morale.ts`,
  `packages/core/src/phases/dailyTick.ts`, `packages/core/src/state/create.ts`,
  `docs/plan/02-DESIGN.md`
  *(Am 2026-09-06 gebaut: `phases/diplomacy.ts` und `commands/diplomacy.ts` blieben
  unangetastet — beide `WAR_DECLARED`-Stellen setzen schon `audience: both`, und die Vorgabe
  `concerns = audience` trifft dort genau richtig. Dafür kam `state/create.ts` dazu: das
  `GAME_STARTED` des ersten Ticks wird von Hand gebaut und umgeht `emit()` — die Typprüfung
  des Pflichtfelds hat es gefunden, zusammen mit drei ebensolchen Stellen in Tests.)*
- **Tests zuerst:**
  1. `firstAlertFor` liefert für `p1` `null`, wenn im Tick nur eine Eroberung zwischen `p2` und
     `p3` liegt, und liefert dasselbe Ereignis, sobald `p1` Vorbesitzer oder Neubesitzer ist
     (heute in beiden Fällen das Ereignis — rot).
  2. `fastForward` mit dem Ziel `{ kind: 'battleStarts' }` hält an dem Tick an, in dem zwei
     verfeindete Armeen zum ersten Mal in derselben Provinz stehen; heute läuft der Lauf bis
     `maxTicks` durch und meldet `stoppedBy: 'limit'` (rot).
  3. Die Kampfphase erzeugt `BATTLE_STARTED` genau einmal je Gefecht: ein Gefecht über drei
     Ticks ergibt **eine** Meldung, nicht drei und nicht null; `sides` nennt dieselben Mächte
     wie das zugehörige `BATTLE_RESOLVED`. (Die Kampfliste wird in jedem Tick neu aufgebaut und
     bekommt jedes Mal eine neue `battleId` — ohne Entprellung gegen die Liste des Vortricks
     wäre das Vorspulen unbrauchbar.)
  4. Eigenschaftstest über einen Lauf von 200 Spieltagen mit acht Mächten: jedes Ereignis mit
     `severity: 'alert'` nennt mindestens einen Betroffenen, und kein Betroffener steht
     außerhalb einer nicht leeren Leserschaft (`concerns ⊆ audience`, solange `audience` nicht
     leer ist).
  5. Der Determinismus-Golden-Master bleibt unverändert: `eventLog` steht in `HASH_OMIT_KEYS`,
     das neue Feld ist nicht hashwirksam.
- **Fertig wenn:** `pnpm verify` ist grün; im Eigenschaftslauf über 200 Spieltage und acht
  Mächte liegen **0** Alarmereignisse ohne Betroffenen und **0** Verstöße gegen
  `concerns ⊆ audience` vor; ein Gefecht über drei Ticks erzeugt genau **1** `BATTLE_STARTED`;
  `packages/core/test/determinism.test.ts` bleibt ohne Erneuerung der Golden-Datei grün;
  `docs/plan/02-DESIGN.md` trägt das Kapitel „Wer erfährt was" mit den drei Zeilen (Lektüre =
  `audience`, Dringlichkeit = `severity`, Adressat = `concerns`; Vorgabe `concerns = audience`,
  öffentliche Alarme nennen ihre Betroffenen ausdrücklich). **Das neue Feld ist das erste, das
  in einen Spielstand wandert — T-M15-04 hängt daran und legt es dort an.**

### T-M15-02 · R-TECH-01 — Freischaltung nach Spieltag
- **Ziel:** Jedes Gebäude und jede Einheit trägt in den Regeldateien einen ersten Spieltag
  (`availableFromDay`); vorher lehnt der Kern Bau und Aushebung mit `NOT_YET_AVAILABLE` ab und
  nennt den Tag, ab dem es geht — für Mensch und KI gleichermaßen. Belegt sind fünf Tage
  (Referenz 1.4: Kaserne 1, Hafen 2, Eisenbahn 5, Fabrik 8, Flugplatz 10); Festung und Werft
  sowie alle zehn Einheiten werden daraus abgeleitet, und jede abgeleitete oder geschätzte Zahl
  bekommt eine Zeile in `BALANCING.md` mit Status. Ein Gebäude oder eine Einheit ohne ersten
  Spieltag lehnt der Lader ab — ein fehlender Tag wäre still Tag 1. Das ist die billigste
  Anforderung mit dem größten Effekt auf das erklärte Problem („Tag 1 unterscheidet sich von
  Tag 40 durch nichts als den Kontostand"). *(Befunde 27 und 59)*
- **Anforderungen:** R-TECH-01
- **Abhängigkeiten:** T-M14-15
- **Dateien:** `data/rules/default/buildings.json`, `data/rules/default/units.json`,
  `packages/core/src/rules/types.ts`, `packages/core/src/rules/load.ts`,
  `packages/core/src/rules/availability.ts` *(neu)*,
  `packages/core/src/commands/build.ts`, `packages/core/src/commands/recruit.ts`,
  `packages/core/src/commands/types.ts`, `apps/desktop/src/i18n/de.ts`,
  `docs/plan/BALANCING.md`, `docs/plan/02-DESIGN.md`
  *(Am 2026-09-06 gebaut. `availability.ts` kam dazu, weil `currentDay` sonst an zwei
  Stellen entstanden wäre — und die **eins-basierte** Zählung ist die eigentliche Frage
  dieser Aufgabe: null-basiert wäre die Kaserne am ersten Spieltag nicht baubar gewesen,
  und der Fehler hätte im Playtest wie ein Wirtschaftsproblem ausgesehen. Der
  Golden-Master `walkthrough.json` blieb unverändert und ist deshalb aus der Liste
  genommen.)*
- **Tests zuerst:**
  1. `R-TECH-01/AK1`: Ein `BUILD` einer Fabrik an Spieltag 1 wird mit `NOT_YET_AVAILABLE`
     abgelehnt und trägt `detail.availableFromDay === 8`; ein `RECRUIT` eines Jägers vor Tag 10
     ebenso. Derselbe Test läuft ein zweites Mal mit einer KI-Macht als Absender — der Kern
     kennt keinen Unterschied.
  2. `R-TECH-01/AK2`: Derselbe Auftrag an Tag 8 beziehungsweise Tag 10 wird angenommen, ohne
     dass sonst etwas verändert wird.
  3. `R-TECH-01/AK3`: `parseRules` wirft `RulesError` mit einer Meldung, die den Namen der Sache
     nennt, wenn ein Gebäude oder eine Einheit `availableFromDay` nicht trägt — und ebenso, wenn
     eine Einheit früher verfügbar wäre als das Gebäude, das sie braucht
     (`unit.availableFromDay >= buildings[unit.requiresBuilding].availableFromDay`).
  4. Belegstatus: `test/balancing.test.ts` findet für jedes der 7 Gebäude und jede der 10
     Einheiten eine Zeile in `BALANCING.md` mit Tag und Status aus {belegt, abgeleitet,
     geschätzt}; heute liest der Test nur `constants.json`, also 0 von 17 (rot).
- **Fertig wenn:** `pnpm verify` ist grün; die fünf belegten Tage stehen wörtlich in
  `buildings.json` (barracks 1, harbour 2, railway 5, factory 8, airfield 10); **17 von 17**
  neuen Zahlen stehen mit Status in `BALANCING.md` und werden von `test/balancing.test.ts`
  geprüft; der Lader lehnt einen fehlenden Tag und eine Einheit vor ihrem Gebäude ab (je ein
  Test); `apps/desktop/src/i18n/de.ts` hat für `NOT_YET_AVAILABLE` einen Satz in `errors`
  **und** in `rejections`, sodass kein Rohschlüssel den Spieler erreichen kann;
  `docs/plan/02-DESIGN.md` trägt einen D-Abschnitt zur Freischaltungsachse, der die Anforderungs-ID
  nennt und von `test/docs.test.ts` gegen sie geprüft wird; `pnpm coverage:requirements` weist
  R-TECH-01 als testbelegt aus. Ändert sich ein Golden-Master, weil die KI ihre Bauabfolge
  anpassen muss, wird er mit `UPDATE_GOLDEN=1` erneuert und die Änderung in der Fertigmeldung
  benannt — ein stillschweigend erneuerter Golden-Master gilt als Fehlschlag.

### T-M15-03 · R-TECH-02 — der Spieler sieht, was wann kommt
- **Ziel:** Ein wegen des Spieltags gesperrter Bau- oder Aushebeknopf nennt den Tag, an dem er
  frei wird, und der Tooltip nennt ihn auch vorher; die KI wählt nichts, was heute noch gesperrt
  ist. Der zweite Teil ist kein Schönheitsfehler: ein Befehl, den der Kern jeden Tag ablehnt,
  ist Rauschen im Protokoll, kein Verhalten. *(Befunde 11 und 27)*
- **Anforderungen:** R-TECH-02
- **Abhängigkeiten:** T-M15-02
- **Dateien:** `apps/desktop/src/game/actions.ts`, `apps/desktop/src/game/rejections.ts`,
  `apps/desktop/src/i18n/de.ts`, `packages/ai/src/economy.ts`, `docs/plan/02-DESIGN.md`
  *(Am 2026-09-06 gebaut. `rejections.ts` blieb unangetastet: der Satz entsteht aus dem
  i18n-Eintrag und `detail.availableFromDay`, ohne Sonderfall im Übersetzer — genau die
  Bauweise, die `ON_COOLDOWN` schon hat. Belege sind `apps/desktop/src/game/actions.test.ts`,
  `packages/ai/src/economy.test.ts` (neu angelegt — die Datei stand im Plan und existierte
  nicht) und `apps/headless/test/availability.test.ts` für den 60-Tage-Lauf.)*
- **Tests zuerst:**
  1. `R-TECH-02/AK1`: An Spieltag 1 gilt für jedes der 7 Gebäude und jede der 10 Einheiten:
     entweder ist `disabledReason` null, oder der Grund enthält den Freischaltungstag als Zahl.
     Kein Knopf sagt „nicht verfügbar" ohne Tag (heute gibt es den Fall gar nicht — rot, sobald
     T-M15-02 steht).
  2. `describeRejection` übersetzt `NOT_YET_AVAILABLE` mit `detail.availableFromDay` in einen
     Satz, der den Tag nennt — wie `ON_COOLDOWN` es mit `days` tut.
  3. Der Tooltip (`hint`) einer noch gesperrten Sache nennt den Tag auch dann, wenn der Knopf
     zusätzlich aus einem anderen Grund gesperrt ist.
  4. `R-TECH-02/AK2`: `economyCommands` und `recruitCommands` liefern an Spieltag 1 kein `BUILD`
     und kein `RECRUIT` für etwas, dessen erster Spieltag später liegt — geprüft über alle 7
     Gebäude und 10 Einheiten; der Tag kommt aus `view.tick` und `rules.constants.ticksPerDay`,
     nicht aus einer zweiten Zeitrechnung.
  5. Kopfloser Lauf über 60 Spieltage mit vier KI-Mächten: die Zahl der Ereignisse
     `COMMAND_REJECTED` mit `code: 'NOT_YET_AVAILABLE'` ist 0.
- **Fertig wenn:** `pnpm verify` ist grün; im kopflosen 60-Tage-Lauf mit vier KI-Mächten liegen
  **0** Ablehnungen mit `NOT_YET_AVAILABLE` vor; in `actions.test.ts` nennt in **17 von 17**
  Fällen entweder der Grund oder der Tooltip den Freischaltungstag als Zahl;
  `docs/plan/02-DESIGN.md` beschreibt die Anzeige der Freischaltung mit ihrer Anforderungs-ID;
  `pnpm coverage:requirements` weist R-TECH-02 als testbelegt aus.

### T-M15-04 · R-GAME-07 — Spielstände der V1 laufen weiter, und die Migration wird geprüft
- **Ziel:** Die Migration entsteht **mit** dem ersten neuen Zustandsfeld von M15, nicht danach —
  und sie wird zum ersten Mal an einem echten Fall gefahren: `MIGRATIONS` ist heute ein leeres
  Objekt mit einem auskommentierten Beispiel, die Kette ist nie gelaufen. Dazu werden zwei
  Löcher geschlossen, die genau in dieser Lücke liegen: `migrate.ts` entfernt den Hash nach
  jedem Schritt, und `save.ts` prüft nur `if (migrated.hash)` — ab dem ersten echten
  Migrationsschritt läuft **jeder** migrierte V1-Stand ohne jede Prüfung durch (Befund 55). Und
  es gibt zwei Versionsnummern — `state.schemaVersion` gegen den Umschlag —, von denen nur eine
  geführt wird (Befund 56). Die neue Prüffunktion heißt **`validateState`** und entsteht in
  `packages/core/src/persistence/validate.ts`; sie existiert heute nirgends.
  **Der Schnitt, der diesen Meilenstein zusammenhält:** Diese Aufgabe legt **alle**
  Zustandsfelder von M15 leer an — das Betroffenenfeld aus T-M15-01, das Verstimmungs-Record
  aus T-M15-05 und das Feuerleitungsfeld der Armee aus T-M15-07 — und bleibt damit der
  **einzige** Schritt 1 → 2. T-M15-05 und T-M15-07 füllen diese Felder mit Verhalten, erhöhen
  `SCHEMA_VERSION` aber nicht ein zweites Mal; sonst widerspräche der Formatwächter dieser
  Aufgabe sich selbst. *(Befunde 22, 27, 55 und 56)*
- **Anforderungen:** R-GAME-07
- **Abhängigkeiten:** T-M15-01, T-M15-02
- **Dateien:** `packages/core/src/state/types.ts`, `packages/core/src/state/clone.ts`,
  `packages/core/src/persistence/migrate.ts`, `packages/core/src/persistence/save.ts`,
  `packages/core/src/persistence/validate.ts` *(neu)*,
  `packages/core/src/persistence/index.ts`, `docs/plan/DECISIONS.md`,
  `docs/plan/02-DESIGN.md`, `docs/plan/01-REQUIREMENTS.md`,
  `packages/core/test/golden/save-v1.json` *(neu, ein mit dem V1-Serialisierer erzeugter Stand)*
- **Tests zuerst:**
  1. `R-GAME-07/AK1`: Der eingefrorene V1-Stand lädt nach der Migration, jeder Eintrag seines
     Protokolls trägt danach ein leeres Betroffenenfeld, und **der Unterschied zwischen altem
     und migriertem Zustand besteht ausschließlich aus den neu angelegten Feldern** — die
     Migration rührt nichts an, was die Simulation liest. Heute wird der Stand mit
     `UnsupportedSaveVersion` abgewiesen (rot).
     *(Am 2026-09-06 korrigiert: hier stand „der Hash des migrierten Zustands ist derselbe wie
     der im V1-Umschlag". Das ist nicht einlösbar — der Hash sortiert die Schlüssel und nimmt
     jeden mit, ein neues Feld ändert ihn zwangsläufig. Die Zusage dahinter ist prüfbar, und
     der Feldvergleich ist schärfer als ein Hashvergleich: er sagt, **was** sich geändert hat.
     Begründung in PROBLEME.md.)*
  2. Befund 55: Ein migrierter Stand, dem ein Pflichtfeld fehlt (`playerOrder` entfernt), wird
     mit `SaveFormatError` abgelehnt; heute kommt selbst `{}` durch (rot).
  3. Befund 56: Eine absichtlich vergessliche Migration, die `state.schemaVersion` nicht
     mitzieht, wird abgelehnt — Umschlag 2 mit Zustand 1 darf nicht laden.
  4. Ein Stand ohne Hash und ohne Migration wird als beschädigt abgelehnt (`serialise` schreibt
     immer einen Hash; ein hashloser, nicht migrierter Stand ist fremd).
  5. Formatwächter: Die Schlüsselliste eines frischen Zustands entspricht einer festgeschriebenen
     Liste, und `SCHEMA_VERSION` ist genau um eins größer als die höchste Stufe in `MIGRATIONS`.
     Wer ein Zustandsfeld hinzufügt, ohne die Version zu erhöhen und einen Schritt einzutragen,
     lässt diesen Test scheitern — **und deshalb legt diese Aufgabe die Felder von T-M15-05 und
     T-M15-07 gleich mit an**: ein Test sichert zu, dass ein frischer Zustand das
     Verstimmungs-Record und das Feuerleitungsfeld bereits (leer) trägt.
  6. `clone.ts` kopiert die neuen Felder **tief** — ein Record, das über den Spread als geteilte
     Referenz durchkäme, ist ein Determinismusfehler mit Ansage.
- **Fertig wenn:** `pnpm verify` ist grün; `SCHEMA_VERSION` ist 2 und `MIGRATIONS` enthält
  **genau einen** Schritt (1 → 2), der an einem echten, eingefrorenen V1-Stand gelaufen ist,
  nicht nur an einer Testtabelle; **alle in M15 hinzukommenden Zustandsfelder sind in diesem
  einen Schritt leer angelegt, und keine spätere M15-Aufgabe erhöht die Version erneut** (in
  `DECISIONS.md` als Entscheidung festgehalten); die drei Ladewege sind einzeln geprüft und es
  gibt **0** Pfade ohne Prüfung (nach einer Migration läuft `validateState`; ohne Migration wird
  der Hash geprüft wie bisher; ein Stand ohne beides wird abgelehnt); der migrierte V1-Stand ist
  nach Speichern und Laden hashgleich (R-GAME-03/AK1); `DECISIONS.md` hält fest, dass der
  Umschlag die führende Versionsnummer ist und `deserialise` die Übereinstimmung mit
  `state.schemaVersion` erzwingt; `docs/plan/02-DESIGN.md` trägt den D-Abschnitt zum
  Speicherformat V2 mit der Anforderungs-ID; **in `01-REQUIREMENTS.md` nennt R-GAME-07 keine
  Spione, keine Aufklärung und keine Zeitung mehr** — die auf M17 verschobenen Teilsätze sind
  aus Anforderungs- und AK-Text entfernt und in `DECISIONS.md` begründet;
  `packages/core/test/determinism.test.ts` wird erneuert — **aber erst nach dem Beweis**, dass
sich nur die Gestalt geändert hat: derselbe 500-Tick-Lauf liefert nach Abzug von
`schemaVersion`, `grievances` und `holdFire` bitgleich die alten Werte. *(Am 2026-09-06
korrigiert: hier stand „bleibt ohne Erneuerung grün". Ein Zustands-Hash ändert sich, sobald
ein Feld dazukommt; die Zusage war nicht einlösbar. Ein stillschweigend erneuerter
Golden-Master gilt weiterhin als Fehlschlag — die alten Werte stehen in PROBLEME.md.)*

### T-M15-05 · Das Verhältnis steuert die KI — erst die Messlatte, dann die Regel
- **Ziel:** In zwei Schritten, und die Reihenfolge ist der eigentliche Inhalt der Aufgabe.
  **Schritt 1 (zuerst, vor jeder Verhaltensänderung):** Das Turnier bekommt die Paarung „schwer
  gegen normal" und zählt je Partie Kriegserklärungen und Friedensschlüsse mit. Heute kennt
  `playTournament` nur „schwer gegen leicht" und meldet dort 50:0; zwischen normal und schwer
  unterscheidet allein `maxFronts`, und das dreifach zweckentfremdet (Frontenzahl,
  Kriegsschwelle, Risikobereitschaft). `planningDepth` wird von keiner Zeile gelesen,
  `tacticalInterval` wird vom Rundenlauf überlagert. Ohne diese zweite Paarung ist jede Änderung
  an der Kriegsentscheidung Blindflug. **In denselben Schritt gehört die Obergrenze auf der
  Siegquote**, die T-M14-05 bewusst nicht eingeführt hat: sie wäre dort sofort rot gewesen,
  hätte `pnpm test:slow` rot gemacht und damit AK-4, AK-6 und die Abnahme blockiert. Hier
  gehört sie hin, weil hier die Regel entsteht, die sie einlösen kann.
  **Schritt 2:** R-DIP-06. Die KI führt je fremder Macht ein Verhältnis aus öffentlichem
  Ansehen, eigenen Verstimmungen, Bündnissen, gewährtem Durchmarsch, Kriegen gegen ihre
  Verbündeten und Grenzbedrohung — und entscheidet danach über Krieg, Bündnisfall,
  Bündnisannahme, Durchmarsch und Frieden. Heute liest **keine Zeile** des Projekts das Feld
  `reputation`; geschrieben wird es nur in `packages/core/src/phases/diplomacy.ts`. Zwei
  Sichtlücken kommen dazu und müssen mit geschlossen werden: `PublicView.others` führt kein
  `reputation`, und `PublicView.relations` führt nur die eigenen Beziehungen — die öffentlichen
  Kriege anderer Mächte untereinander, die AK2 und der Bündnisfall brauchen, sieht die KI nicht.
  Das Verstimmungs-Record liegt seit T-M15-04 leer im Zustand; diese Aufgabe füllt es und
  erhöht `SCHEMA_VERSION` **nicht**. *(Befunde 2, 14, 25, 41, 44)*
- **Anforderungen:** R-DIP-06, R-AI-02, R-AI-06
- **Abhängigkeiten:** T-M14-05, T-M14-11, T-M14-12, T-M15-04
- **Dateien:** *Schritt 1:* `apps/headless/src/tournament.ts`, `docs/reports/ai-tournament.md`.
  *Schritt 2:* `packages/ai/src/relationship.ts` *(neu)*, `packages/ai/src/diplomacy.ts`,
  `packages/ai/src/index.ts`, `packages/core/src/view/publicView.ts`,
  `packages/core/src/phases/diplomacy.ts`, `packages/core/src/state/types.ts`,
  `packages/core/src/state/clone.ts`, `packages/core/src/phases/dailyTick.ts`,
  `packages/core/src/rules/types.ts`, `packages/core/src/rules/load.ts`,
  `data/rules/default/ai.json`, `data/rules/default/constants.json`,
  `docs/plan/01-REQUIREMENTS.md`, `docs/plan/02-DESIGN.md`, `docs/plan/BALANCING.md`
- **Tests zuerst:**
  1. *Schritt 1, rot ohne Code:* `playTournament` mit `['hard','normal']` liefert je Stufe
     Siegquote, Zahl der Kriegserklärungen und Zahl der Friedensschlüsse — `tournament.ts` führt
     diese Zahlen heute nicht. Dazu wird das `it.skip` aus T-M14-05 zu einem echten Test: der
     Turniertest prüft `winRateA >= 0,70` **und** `winRateA <= 0,95`.
  2. Das Verhältnis ist eine reine Funktion: gleiche Eingaben, gleiche Zahl; gesenktes Ansehen
     und frische Verstimmung senken es, ein Bündnis hebt es; Werte bleiben in 0..1000.
  3. **AK1, Richtung eins:** eine gleich starke Nachbarmacht (Punkteverhältnis 900..1100) mit
     schlechtem Verhältnis erhält die Kriegserklärung. Heute entsteht sie erst ab 1200 bzw.
     1600, der Test ist also rot.
  4. **AK1, Richtung zwei:** ein schwächerer Nachbar (Punkteverhältnis über 1600) mit gutem
     Verhältnis erhält **keine** Kriegserklärung. Heute erhält er sie immer.
  5. **AK2:** wird ein Verbündeter angegriffen und ist eine Front frei, folgt die
     Kriegserklärung an den Angreifer — das braucht die öffentlichen Kriege in `PublicView`.
  6. **AK3:** Bündnisangebot bei gutem Verhältnis wird angenommen, bei Ansehen unter der
     Vertrauensschwelle abgelehnt; gewährter Durchmarsch wird bei gutem Verhältnis binnen der
     Regelfrist erwidert.
  7. **AK4:** ein Krieg ohne Provinzwechsel seit der Regelzahl Tage und ohne feindseliges
     Verhältnis erzeugt `offerPeace`; `acceptPeace` entsteht **nur**, wenn `PublicView` ein an
     mich gerichtetes Angebot führt (aus T-M14-12).
  8. **AK5:** nach einem Spieltag ist das Ansehen um den Regelbetrag Richtung Ausgangswert
     gewandert und jede Verstimmung um den Regelanteil kleiner. Die Schleife läuft über
     `playerOrder`, nicht über `Object.keys` — sonst hängt das Ergebnis an der
     Einfügereihenfolge und R-ARCH-01 bricht. Geprüft in
     `packages/core/src/phases/diplomacy.test.ts`, der Datei, die das Abklingen wirklich enthält.
  9. **AK6:** die Erklärung nennt den Verhältniswert und den ausschlaggebenden Anteil.
  10. *Determinismus:* Golden-Master und Wiedergabe bleiben grün, und `clone.ts` kopiert das
      Verstimmungs-Record **tief**.
  11. Der Regellader lehnt eine Schwierigkeitsstufe ohne Kriegsschwelle ab: ein fehlender Wert
      wäre sonst still eine Null und damit „erklärt jedem den Krieg".
- **Fertig wenn:** Der Grundlauf „schwer gegen normal" steht datiert in
  `docs/reports/ai-tournament.md`, **bevor** eine Zeile in `packages/ai/src/diplomacy.ts`
  geändert wird. Nach Schritt 2 liegt die Siegquote „schwer gegen normal" außerhalb des in
  T-M14-05 gemessenen Rauschbands und unter der Obergrenze von 0,95, die diese Aufgabe in den
  Turniertest einträgt; Grundwert, Endwert, Rauschband und Obergrenze stehen mit Status in
  `BALANCING.md`, und der in T-M14-05 nach `PROBLEME.md` geschriebene Rotstand ist dort als
  erledigt geschlossen. Kein Lauf endet 25:25. Die elf Tests oben sind grün, und die sechs zu
  AK1–AK6 prüfen ein erzeugtes Kommando, nicht eine Nutzenzahl. In einem Lauf über 50 Partien
  entsteht mindestens eine Kriegserklärung mit Punkteverhältnis zwischen 900 und 1100. Die
  Kriegsschwelle je Stufe ist ein eigener Regelwert; `maxFronts` trägt danach nur noch die
  Frontenzahl. **In `01-REQUIREMENTS.md` nennt R-DIP-06 keine enttarnten Spione mehr** — der
  auf M17 verschobene Teilsatz ist aus Anforderungs- und AK-Text entfernt und in
  `DECISIONS.md` begründet. `SCHEMA_VERSION` bleibt bei 2, es kommt kein Migrationsschritt
  hinzu. `pnpm verify` und `pnpm coverage:requirements` sind grün, Determinismus- und
  Wiedergabetest unverändert grün.

### T-M15-06 · Vorspulen erreicht die Oberfläche — nach einer Entscheidung über die Hülle
- **Ziel:** Der Vorspulknopf ruft den Kern nicht auf. `App.tsx` und die Taste `F` rechnen
  `step(ticksPerDay)`, also genau einen Spieltag; `fastForwarding` ist hart auf `false`, wodurch
  der Abbruchzweig in `ui/Header.tsx` toter Code ist; `fastForward` aus
  `packages/core/src/clock.ts` wird in `apps/desktop/src` an **keiner** Stelle gerufen — der
  einzige Aufrufer ist `sim/SimEngine.ts`, den nichts startet. Ziel Z1, das erste erklärte
  Produktziel, ist damit halb eingelöst, und R-TIME-02 wird ausschließlich gegen Code geprüft,
  den kein Spieler ausführt. Diese Aufgabe schließt zugleich die in T-M14-02 zurückgestufte
  Aufgabe **T-M10-04**.
  **Die Entscheidung fällt vor dem Bau, nicht während:** AK1 verlangt wörtlich „dieselbe
  Funktion wie der Simulations-Host, keine zweite Schleife". Weg (a) verdrahtet `SimEngine` und
  rettet 521 Produktionszeilen samt 371 Testzeilen, ändert aber die gesamte Zustandsführung von
  `App.tsx` — und `SimEngine.ts` importiert heute nichts aus `@worldwar/ai`; sein
  `commandSource` kann `storeMemories` gar nicht ausführen. Weg (b) erweitert die Schleife in
  `App.tsx` und löscht die 521 Zeilen. Beide Wege sind besser als der heutige Zustand; welcher
  gewählt wird, gehört begründet in `DECISIONS.md`, bevor Produktionscode fällt. *(Befunde 60,
  N3)*
- **Anforderungen:** R-TIME-06, R-TIME-03
- **Abhängigkeiten:** T-M14-04, T-M15-01
- **Dateien:** `docs/plan/DECISIONS.md`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/keyboard.ts`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/sim/SimEngine.ts`,
  `apps/desktop/src/sim/SimHost.ts`, `apps/desktop/src/sim/worker.ts`,
  `apps/desktop/src/sim/protocol.ts`, `packages/core/src/clock.ts`,
  `test/guards/reachability.ts`, `docs/ANLEITUNG.md`, `docs/reports/performance.md`,
  `docs/plan/02-DESIGN.md`, `docs/plan/01-REQUIREMENTS.md`, `docs/plan/tasks.yaml`
  *(Die Dateien unter `apps/desktop/src/sim/` werden je nach Entscheidung verdrahtet oder
  gelöscht — in beiden Fällen angefasst. Die gemeinsame Spielschleife kommt aus T-M14-04 und
  wird hier nur benutzt, nicht noch einmal geschrieben.)*
- **Tests zuerst:**
  1. *Die Entscheidung ist selbst prüfbar:* `test/docs.test.ts` verlangt einen
     `DECISIONS.md`-Eintrag zu T-M15-06, der beide Wege, ihre Kosten und das entscheidende
     Kriterium nennt und den gewählten Weg benennt. Ohne den Eintrag ist der Test rot, und zwar
     bevor irgendein Bau beginnt.
  2. **AK1:** die Hülle wählt das Ziel „Bau fertig" und ruft genau `fastForward` des Kerns mit
     genau diesem Ziel; der Test vergleicht die von der Hülle vorgerückten Ticks mit `ticksRun`
     des Kerns — weichen sie ab, gibt es eine zweite Schleife. Beim Halt nennt die Meldung den
     Grund in Worten (Ziel erreicht / Alarm / Obergrenze).
  3. **AK2:** eine Eroberung zwischen zwei fremden Mächten hält das Vorspulen **nicht** an;
     dieselbe Eroberung mit dem Spieler als bisherigem Eigentümer hält an. Das braucht das
     Substrat aus T-M15-01.
  4. **AK3:** ein Vorspulen mit Ziel „Gefecht beginnt" endet an `BATTLE_STARTED` (aus T-M15-01)
     und nennt die Beteiligten.
  5. **AK4:** das Vorspulen rechnet in Häppchen — die Fortschrittszahl wächst mehr als einmal,
     und ein zwischen zwei Häppchen gesetzter Abbruch beendet den Lauf.
  6. **AK5:** ein Wächter in `test/guards/no-realtime.test.ts` stellt fest, dass weder Tempo
     noch Pausenstand noch Vorspulziel im `GameState` liegen, und wird rot, sobald ein Feld
     dieser Art dazukommt.
  7. *Erreichbarkeit:* `test/guards/ui-reachability.test.ts` findet nach dieser Aufgabe keine
     Ausnahme mehr für `sim/SimEngine.ts` und `sim/worker.ts` — entweder ist der Code erreichbar
     oder gelöscht.
  8. R-TIME-02/AK3 (Rückstand höchstens 2 Ticks) wird von mindestens einem Test geprüft, der den
     Weg ausführt, den der Spieler ausführt.
- **Fertig wenn:** Der `DECISIONS.md`-Eintrag steht, ist datiert und wird von `test/docs.test.ts`
  geprüft. `fastForwarding={false}` existiert nicht mehr, und der Abbruchknopf aus `Header.tsx`
  ist in einem Test erreichbar. Genau ein Aufruf von `fastForward` je Vorspulvorgang,
  nachgewiesen über die Tickgleichheit aus Test 2. **Die fünf Ziele aus R-TIME-06 sind über ein
  Menü wählbar und alle fünf in `docs/ANLEITUNG.md` genannt** — und derselbe Zug räumt den
  Widerspruch aus, dass R-TIME-03 sechs Ziele aufzählt (mit „Angriff auf eigenes Gebiet") und
  R-TIME-06 fünf: die Aufgabe entscheidet in `01-REQUIREMENTS.md` begründet, welche der beiden
  Listen gekürzt oder ergänzt wird, und danach nennen beide dieselbe Menge. `apps/desktop/src/sim/`
  hat keinen Eintrag mehr in `REACHABILITY_EXCEPTIONS`. **T-M10-04 steht in `tasks.yaml` wieder
  auf `done` und verweist auf diese Aufgabe.** Der Durchsatz des Vorspulens wird auf der Karte
  gemessen, auf der gespielt wird — nicht auf der Testkarte — und steht als Zahl in
  `docs/reports/performance.md`, zusammen mit dem Vergleich gegen die Zusage von 500
  Spielstunden je Sekunde aus R-TIME-02/AK4. `pnpm verify` und `pnpm coverage:requirements` sind
  grün.

### T-M15-07 · Feuerautomatik und Feuerleitung
- **Ziel:** Eine stehende Armee mit Fernwaffen beschießt in jeder Kampfphase selbsttätig die
  feindliche Nachbarprovinz mit der größten sichtbaren Truppenstärke, sofern Krieg besteht; je
  Armee kann „Feuer halten" befohlen werden — für Mensch und KI dieselbe Regel. Das Armeefeld
  dafür liegt seit T-M15-04 leer im Zustand; diese Aufgabe füllt es und erhöht
  `SCHEMA_VERSION` **nicht**.
  **Vier Vorbedingungen, alle in M14, und keine davon ist Bequemlichkeit:**
  (1) *Stapel-Deckel als Grenzbeitrag* (T-M14-06) — der Deckel wirkt heute als Faktor auf die
  ganze Armee; eine selbsttätig feuernde Artilleriearmee wächst über die Rekrutierung automatisch
  über 50 Einheiten und richtet dann **exakt null** Schaden an. Die Feuerautomatik wäre gebaut,
  grün getestet und wirkungslos.
  (2) *Die KI baut Artillerie* (T-M14-12) — sonst ist `armyRange` für jede KI-Armee 0 und im
  Turnier kann kein einziges Beschussereignis entstehen; R-BAT-08/AK3 wäre unabnehmbar. Deshalb
  verlangt T-M14-12 eine Fernwaffenarmee **je KI-Macht**, nicht eine irgendwo.
  (3) *BOMBARD von Phase 1 nach Phase 8* (T-M14-07) — ohne den Umzug hätten Handbeschuss und
  Automatik verschiedene Regeln, und die Automatik hätte gar keinen Ort.
  (4) *Diplomatiefilter beim Beschuss* (T-M14-07) — sonst träfe die Automatik Verbündete und
  Neutrale ohne Kriegserklärung und ohne Ansehensverlust. *(Befunde 3, 32, 51, 52)*
- **Anforderungen:** R-BAT-08, R-BAT-06
- **Abhängigkeiten:** T-M14-06, T-M14-07, T-M14-12, T-M15-01, T-M15-04
- **Dateien:** `packages/core/src/state/types.ts`, `packages/core/src/state/clone.ts`,
  `packages/core/src/commands/types.ts`, `packages/core/src/commands/handlers.ts`,
  `packages/core/src/commands/bombard.ts`, `packages/core/src/phases/combat.ts`,
  `packages/core/src/events/types.ts`, `packages/core/src/view/publicView.ts`,
  `packages/ai/src/military.ts`, `apps/desktop/src/game/actions.ts`,
  `apps/desktop/src/game/events.ts`, `apps/desktop/src/i18n/de.ts`,
  `data/rules/default/constants.json`, `docs/plan/02-DESIGN.md`, `docs/plan/BALANCING.md`
- **Tests zuerst:**
  1. **AK1:** eine stehende Armee mit Fernwaffen, Krieg mit dem Nachbarn, kein Befehl — nach
     einem Tick liegt ein `BOMBARDMENT` vor, das den selbsttätigen Beschuss kennzeichnet, und
     der Gegner hat Trefferpunkte verloren. Heute erzeugt die Kampfphase kein Beschussereignis.
  2. *Feuerleitung:* dieselbe Lage mit „Feuer halten" liefert kein Ereignis und keinen Schaden;
     der Befehl ist über `armyActions` erreichbar und trägt seinen deutschen Text in `i18n/de.ts`.
  3. **AK2, Bestimmtheit:** zwei erreichbare Nachbarprovinzen mit identischer sichtbarer Stärke —
     gewählt wird die kleinere Provinzkennung, und zwar in beiden Reihenfolgen der Armeeliste.
  4. **AK2, Spiegelung:** Seitentausch spiegelt das Ergebnis trefferpunktgenau.
  5. Eine marschierende Armee feuert nicht („stehend"), eine eingeschiffte nicht, und eine mit
     laufender Rückzugssperre nicht.
  6. *Diplomatie:* die Automatik lässt eine verbündete und eine neutrale Armee in der
     Zielprovinz unberührt und erklärt niemandem den Krieg — als Eigenschaftstest über zufällige
     Dreiparteienlagen, der auch den Handbeschuss abdeckt.
  7. *Wirksamkeit statt Grün:* eine feuernde Artilleriearmee mit 60 Einheiten richtet mehr
     Schaden an als eine mit 25. Dieser Test ist ohne T-M14-06 rot und ist der Grund, warum
     T-M14-06 vorher liegt.
  8. **AK3, KI:** `militaryCommands` lässt eine Armee mit `armyRange > 0` in Reichweite eines
     Ziels stehen, statt sie in den Nahkampf zu schicken.
  9. *Migration:* ein Spielstand ohne das neue Armeefeld lädt, das Feld steht danach auf
     „feuert", und die Hashprüfung nach der Migration greift (aus T-M15-04) — **ohne** einen
     zweiten Migrationsschritt: `SCHEMA_VERSION` bleibt 2, `MIGRATIONS` behält genau einen
     Schritt.
  10. *Determinismus:* die Automatik läuft über `armyOrder`, nicht über
      `Object.keys(state.armies)`; Golden-Master und Wiedergabe bleiben grün.
- **Fertig wenn:** Alle zehn Tests sind grün. Der Schaden einer selbsttätig feuernden
  Artilleriearmee ist über die Einheitenzahl monoton nicht fallend bis 50 und danach konstant.
  Kein Beschuss — von Hand oder selbsttätig — trifft eine Armee, mit deren Eigentümer kein Krieg
  besteht. Im 50-Partien-Turnier aus T-M15-05 erzeugt **jede** Schwierigkeitsstufe mindestens
  ein selbsttätiges Beschussereignis; die Zahl je Stufe steht mit Status in `BALANCING.md` — das
  ist R-BAT-08/AK3 und zugleich der Anteil, den diese Aufgabe an R-AI-08/AK3 trägt.
  `armyActions` liefert den Befehl „Feuer halten" zusätzlich, und der Kommandowächter aus
  T-M14-13 bleibt grün. `pnpm verify` und `pnpm coverage:requirements` sind grün.

### T-M15-08 · Die KI nutzt die neuen Mittel — das Integrationstor
- **Ziel:** Die KI beachtet die Freischaltung, lässt ihre Fernwaffen wirken und beantwortet
  vorliegende Angebote nach Nutzen und Verhältnis — alles über dieselben Kommandos wie der
  Mensch. Diese Aufgabe läuft als **letzte** des Meilensteins: sie baut die vier KI-Pfade und
  misst danach, ob die in M15 gebauten Mechaniken für die KI überhaupt leben. **Sie hängt
  deshalb an jeder anderen Aufgabe von M15, auch an T-M15-09** — sachlich trägt der
  Protokollfilter nichts zum Tor bei, aber „zuletzt" heißt: kein Stück von M15 ist offen, wenn
  das Tor misst. AK1 von R-AI-08 (Gegenspion) reist mit R-SPY nach M17 (Entscheidung 3 vom
  2026-09-05); hier werden AK2 und AK3 eingelöst, AK3 ohne Spionageereignisse. Antwort auf die
  Befunde 13, 32, 41, 42 und 43/44.
- **Anforderungen:** R-AI-08, R-AI-01
- **Abhängigkeiten:** T-M15-01, T-M15-02, T-M15-03, T-M15-04, T-M15-05, T-M15-06, T-M15-07, T-M15-09
- **Dateien:** `packages/ai/src/economy.ts`, `packages/ai/src/military.ts`,
  `packages/ai/src/diplomacy.ts`, `packages/ai/src/decide.ts`,
  `apps/headless/src/tournament.ts`, `data/rules/default/ai.json`,
  `packages/core/src/rules/types.ts`, `docs/plan/01-REQUIREMENTS.md`,
  `docs/reports/ai-tournament.md`, `docs/plan/BALANCING.md`, `docs/plan/PROGRESS.md`
- **Tests zuerst:** Vier Testdateien müssen rot sein, bevor eine Zeile KI-Code entsteht.
  (a) `packages/ai/src/economy.test.ts`: `nextBuilding` wählt an Spieltag 1 kein Gebäude, das die
  Freischaltungstabelle erst später öffnet, und `recruitCommands` keine gesperrte Einheit —
  heute prüft weder die eine noch die andere Stelle das. Weiter: `tradeCommands` erzeugt einen
  `TRADE`, **ohne** dass ein Mangel vorliegt, sobald ein Bestand über der Rücklage den teuersten
  offenen Bauauftrag zum Marktpreis bezahlen würde.
  (b) `packages/ai/src/military.test.ts`: Eine untätige KI-Armee mit Fernwaffen in Reichweite
  einer feindlichen Provinz erzeugt `BOMBARD`; dieselbe Armee erzeugt keinen gegen eine
  verbündete oder neutrale Macht; ohne Reichweite entsteht kein Befehl. Heute enthält
  `packages/ai/src/military.ts` das Wort `BOMBARD` kein einziges Mal.
  (c) `packages/ai/src/diplomacy.test.ts`: Liegt ein Angebot in der Sicht und ist das Verhältnis
  zum Anbieter nicht schlecht, entsteht `acceptPeace` **mit** einer Begründung im
  `explanations`-Feld (R-AI-05); ist das Verhältnis schlecht, entsteht kein Kommando, aber
  ebenfalls eine Begründung; liegt gar kein Angebot vor, entsteht `acceptPeace` **nie**.
  (d) `apps/headless/test/ai-integration.slow.test.ts` *(neu)*, `describe('R-AI-08 …')`: der
  200-Tage-Lauf und die Turnierzählung aus „Fertig wenn". Alle Zählungen kommen aus den
  gesammelten Ereignissen, nie aus `state.eventLog`.
- **Fertig wenn:** `pnpm verify` und `pnpm coverage:requirements` sind grün und **zusätzlich**
  jede der folgenden Zahlen gemessen im Bericht steht. Gemessen wird ausschließlich, **was M15
  hinzufügt** — was T-M14-12 bereits zugesichert hat (mindestens ein `TRADE_EXECUTED` je
  KI-Macht), wird hier nicht ein zweites Mal als bloße Existenzprüfung gebucht.
  *Zahlungsfähigkeit (AK3, erste Hälfte)* — Weltkarte, acht KI-Mächte, 200 Spieltage: die Zahl
  der `RESOURCE_SHORTAGE`-Ereignisse mit `resource: 'money'` ist über alle KI-Mächte **0**.
  *Freischaltung und Diplomatie* — im selben Lauf ist die Zahl der `COMMAND_REJECTED` mit
  `NOT_YET_AVAILABLE` **0**, und die Zahl der `COMMAND_REJECTED` mit `INVALID_TARGET` aus
  diplomatischen Kommandos ist **0** (vorher rund 99 % von 408).
  *Ereigniszählung je Stufe (AK3, zweite Hälfte)* — der Turnierlauf fährt die drei Paarungen
  schwer/leicht, schwer/normal und normal/leicht; `playMatch` gibt je Partie die Ereigniszahl je
  Stufe zurück, `playTournament` summiert sie. Für **jede** der drei Stufen gilt, gezählt über
  alle Partien, in denen sie antritt: mindestens ein **selbsttätiges** `BOMBARDMENT`, mindestens
  eine Kriegserklärung, die aus dem Verhältnis aus T-M15-05 stammt (und nicht aus der alten
  Punkteschwelle), und mindestens ein `TRADE_EXECUTED` **über der Regelmarge** — ein Handel
  unterhalb der Marge zählt nicht, weil er nichts über die neue Entscheidung aussagt. Neun
  Zahlen, keine davon null: eine Null heißt, die Mechanik ist für diese Stufe tot, und die
  Aufgabe ist nicht fertig.
  *Buchführung* — die Tabelle steht mit Datum in `docs/reports/ai-tournament.md`; jede neue
  Regelzahl (Handelsmarge, Angebotsmarge, Rücklage) steht mit Status *belegt* oder *geschätzt*
  in `BALANCING.md`. **In `01-REQUIREMENTS.md` nennt R-AI-08 keinen Gegenspion und keine
  Spionageereignisse mehr** — AK1 und die Spionageklausel aus AK3 sind mit R-SPY nach M17
  gezogen, aus Anforderungs- und AK-Text entfernt und in `DECISIONS.md` begründet; ohne diese
  Kürzung wäre das Tor unerfüllbar.

### T-M15-09 · Weltgeschehen: ein Filter statt einer Zeitung
- **Ziel:** Das Ereignisprotokoll bekommt einen fünften Filter „Weltgeschehen", der genau die
  acht Ereignisarten einer festen Positivliste zeigt — Kriegserklärungen, Friedensschlüsse und
  Bündnisse, Eroberungen, gefallene Hauptstädte, Aufstände, ausgeschiedene Mächte, entschiedene
  Schlachten und das Ende der Partie —, und zwar **auch dann, wenn sie zwischen fremden Mächten
  geschehen**. R-NEWS-01/02/03 entfallen dafür ersatzlos (Entscheidung 3 vom 2026-09-05).
  Begründung, die in `DECISIONS.md` gehört: R-NEWS-02 verbietet der Zeitung ausdrücklich Mengen,
  Vorräte, Truppen und Gebäude — was danach übrig bleibt, ist genau diese Positivliste, und sie
  liegt bereits vollständig im Ereignisprotokoll, dessen Filterbarkeit R-GAME-06 seit M5
  fordert. Die Zeitung kostete dagegen ein neues Zustandsfeld mit Ringpuffer, eine Migration und
  ein verstecktes Risiko: `HASH_OMIT_KEYS` nimmt nur `eventLog` vom Simulationshash aus, jede
  Ausgabe liefe also in den Hash, und jede spätere Änderung an einer Schlagzeilenformulierung
  bräche Golden-Master und Wiedergabe. Der Filter kostet kein Zustandsfeld. *(Befunde 27 und 9)*
- **Anforderungen:** R-GAME-06, R-NEWS-04
  *(R-NEWS-01/02/03 standen hier als „wird von dieser Aufgabe gestrichen"; sie sind seit dem
  2026-09-06 gestrichen und damit auch als Bezug hinfällig.)*
- **Abhängigkeiten:** T-M13-13, T-M15-01
- **Dateien:** `packages/core/src/events/world.ts` *(neu)*, `packages/core/src/index.ts`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/game/events.ts`, `apps/desktop/src/i18n/de.ts`,
  `docs/plan/01-REQUIREMENTS.md`, `docs/plan/DECISIONS.md`
- **Tests zuerst:**
  (a) `packages/core/src/events/world.test.ts` *(neu)*: `WORLD_EVENT_TYPES` enthält genau die
  acht Arten `WAR_DECLARED`, `DIPLOMACY_CHANGED`, `PROVINCE_CAPTURED`, `CAPITAL_LOST`,
  `PROVINCE_REVOLTED`, `PLAYER_ELIMINATED`, `BATTLE_RESOLVED`, `GAME_ENDED`, und jede davon
  steht in `EVENT_TYPES` — mit derselben Übersetzungsprüfung, die `ALERT_TYPES` schon hat. Dazu
  ein Eigenschaftstest über zufällige Ereignisfolgen: `worldEventsIn(log)` liefert ausschließlich
  Arten der Liste, in der Reihenfolge des Protokolls, lässt keine Art der Liste aus — und
  **ignoriert das Feld `audience`**: ein `WAR_DECLARED` mit `audience: ['p3','p5']` ist
  enthalten. Die Positivliste entscheidet, nicht der Empfängerkreis. Das Feld entsteht in
  T-M15-01 und wird hier nur gelesen, nie geändert.
  (b) `apps/desktop/src/ui/Panels.test.tsx`: Der Filterbalken trägt fünf Knöpfe; unter
  „Weltgeschehen" steht eine Kriegserklärung zwischen zwei fremden Mächten; unter „alles" steht
  sie ebenfalls, aber **ohne** die Klasse `log__row--alert`. Und: die Liste zeigt die letzten N
  Weltereignisse, nicht die Weltereignisse der letzten vierzig Zeilen — bei 500 Ereignissen, von
  denen nur die drei ältesten Weltereignisse sind, stehen alle drei da. **Heute schneidet
  `App.tsx` das Protokoll auf die letzten vierzig Zeilen zurecht, bevor gefiltert wird**; der
  Filter fände in diesem Fall nichts. Das ist ein echter Umbau in `App.tsx`, kein Knopf.
  (c) `apps/desktop/src/game/events.test.ts`: Für ein Ereignis, dessen `audience` den Spieler
  nicht enthält, trägt die Zeile nur Art, Beteiligte und Ort — der Text enthält keine Ziffer und
  keine Kennung (`/\bp\d\b/`, `/[A-Z]{3}-/`); ein `BATTLE_RESOLVED` nennt Dritten seine `losses`
  nicht. Dieser Test ist der Sicherheitsgurt für den Kampfbericht aus T-M14-13: sobald Verluste
  in die Zeile kommen, kommen sie nur für die Beteiligten hinein. Weiter: zwei Sätze sind aus
  fremder Sicht falsch, weil sie ein stillschweigendes „ich" tragen — `DIPLOMACY_CHANGED`
  („Verhältnis zu {{player}}: {{state}}.") und `CAPITAL_LOST` („Die Hauptstadt {{province}} ist
  verloren."); für Dritte braucht es eine zweite Fassung, die beide Beteiligte nennt.
  (d) Nichtänderung, ausdrücklich geprüft: `apps/desktop/src/ui/Alerts.test.tsx` — `alertsFor`
  liefert dieselbe Menge wie vorher, denn die Meldungen kommen aus der `PublicView`, nicht aus
  dem Protokoll; und `firstAlertFor` liefert dieselbe Menge, weil weder `audience` noch
  `severity` noch `concerns` im Kern angefasst werden — sonst hielte das Vorspulen aus
  R-TIME-06 künftig bei jeder fremden Kriegserklärung an.
- **Fertig wenn:** `pnpm verify` ist grün. **Diese Aufgabe erhöht `SCHEMA_VERSION` nicht, fügt
  keine Migration hinzu, fasst `packages/core/src/state/types.ts` nicht an und lässt beide
  Golden-Master byteweise unverändert** — nachgewiesen mit `git diff --stat` über
  `packages/core/test/golden` und `apps/headless/test/golden`, während `determinism.test.ts` und
  `replay.test.ts` grün laufen. `grep -rn "R-NEWS-0[123]" .` liefert keine **lebende**
  Anforderung mehr: der ausformulierte Text von R-NEWS-01/02/03 ist aus `01-REQUIREMENTS.md`
  entfernt, die drei IDs stehen nicht mehr im `scope`-Block, und was bleibt, sind datierte
  Streichungsvermerke mit Begründung.
  *(Am 2026-09-06 berichtigt: die ursprüngliche Fassung verlangte, dass `grep -rn "R-NEWS" .`
  ausschließlich `DECISIONS.md` trifft. Das ist nicht einlösbar — **R-NEWS-04 enthält die
  Zeichenfolge selbst**, und sie ist die Anforderung, die diese Aufgabe baut. Die Zusage
  dahinter — keine gestrichene Anforderung steht mehr als Zusage da — ist prüfbar und wird
  oben geprüft.)* **Der `scope`-Block trägt nach
  der Streichung 97 IDs, davon 15 spätere, und `pnpm coverage:requirements` meldet weiterhin
  `V1 offen: 0`** und zählt R-GAME-06 als belegt.

---

## Meilenstein M16 — Verpackung als Programm

> **Warum es diesen Meilenstein gibt.** Bis heute ist unbekannt, ob WorldWar überhaupt als
> Programm startet: `@tauri-apps/cli` steht in keiner `package.json` und hat null Treffer im
> Lockfile, das in `tauri.conf.json` verlangte `icons/icon.png` gibt es nicht, `Cargo.lock` und
> `src-tauri/target/` fehlen, und die JS-Bindung, über die ein Dateiport überhaupt schreiben
> könnte, fehlt ebenfalls — der einzige Beleg ist ein Wächter, der Zeichenketten aus zwei
> JSON-Dateien vergleicht, also die Konfiguration gegen sich selbst prüft (Befunde 17, 20, 21).
> M16 macht daraus **einen einmal wirklich ausgeführten Bau** mit eigenem Abnahmekriterium
> AK-8, so wie C-02 es seit T-M14-03 sagt: das Erzeugnis startet, schreibt einen Spielstand,
> wird geschlossen, neu gestartet, und der Stand liegt wieder in der Liste. Er liegt **hinter**
> M14 und M15, weil ein Bau, der ein unfertiges Spiel verpackt, nichts beweist, was M14 nicht
> billiger beweisen kann.

> **Reihenfolge und ihr Grund.** Erst die Buchhaltung, wie in M14: AK-8 bekommt einen Ort,
> bevor irgendetwas darauf zeigt. Dann T-M16-02, der einzige Befund dieses Meilensteins, der
> **nicht am Bau hängt** — er liegt im Kern und wird von keinem Playtest-Befund entwertet.
> Erst danach der Bau und das, was allein an ihm messbar ist: ein Zeichenkontext, ein Fokus,
> ein Prozess, den man schließen und neu starten kann.

### T-M16-01 · AK-8 bekommt einen Ort
- **Ziel:** C-02 sagt seit dem 2026-09-05, die Tauri-Verpackung sei M16 „mit eigenem
  Abnahmekriterium **AK-8**". Bis zum 2026-09-06 war das eine Zusage ohne Ort: Abschnitt 3
  der Anforderungen kannte AK-1 bis AK-7, `scripts/acceptance.mjs` prüfte AK-1 bis AK-5 und
  AK-7, und **nach AK-8 suchte kein Skript**. Das ist dieselbe Fehlerklasse, die M14
  abgeräumt hat — Ursache A, die Zusage wurde nie ans Erzeugnis gebunden —, nur in der
  Zukunftsform: sie wird erst dann sichtbar falsch, wenn jemand M16 für fertig erklärt.
- **Anforderungen:** keine neue; diese Aufgabe bindet ein Abnahmekriterium, sie baut keine
  Mechanik.
- **Abhängigkeiten:** T-M14-01
- **Dateien:** `docs/plan/01-REQUIREMENTS.md`, `scripts/acceptance.mjs`,
  `scripts/acceptance-criteria.mjs` *(neu)*, `docs/plan/PROGRESS.md`
- **Tests zuerst:**
  (a) `test/requirements.test.ts`: **die Verallgemeinerung, nicht der Einzelfall.** Der Test
  sammelt jede Kennung der Form `AK-n`, die der Anforderungstext nennt, und verlangt für
  jede einen Ort in einer Abnahmeliste — er fällt, wenn eine Zusage wie AK-8 nirgends
  ankommt. An einer **erfundenen** Anforderungsliste nachgewiesen, damit die Prüfung nicht
  bedeutungslos wird, sobald die echten Kennungen stimmen; das ist die Lehre aus T-M14-02,
  wo ein Wächter über einer leeren Menge grün war.
  (b) Gegenrichtung: eine Abnahmeliste, die ein AK führt, das der Anforderungstext nicht
  kennt, fällt ebenfalls. Ein Kriterium ohne Anforderung ist so wenig wert wie eine
  Anforderung ohne Kriterium.
- **Fertig wenn:** `01-REQUIREMENTS.md` führt AK-8 in einem eigenen **Abschnitt 3.1** mit
  dem ausdrücklichen Vermerk, dass es **nicht gegen die V1 zählt**; `pnpm acceptance` weist
  AK-8 als eigene Zeile aus und **lässt den Exit-Code unberührt**, solange M16 nicht gebaut
  ist. Diese Trennung ist der Kern der Aufgabe: ein AK-8, das gegen die V1 zählte, kettete
  die Abnahme an einen Bau, der ausdrücklich hinter ihr liegt — das wäre der Fehler des
  Nachtrags 2.15 in neuer Gestalt, der AK-2 unerfüllbar gemacht hat. `pnpm verify` grün,
  `pnpm coverage:requirements` meldet weiterhin `V1 offen: 0`.

### T-M16-02 · Die öffentliche Sicht kostet, was sie wert ist
- **Ziel:** Zwei Befunde vom 2026-09-06, die dieselbe Wurzel haben. Der erste: die KI ist in
  M15 um 73 % teurer geworden, und **rund 97 % der gemessenen „KI-Zeit" ist der Bau der
  öffentlichen Sicht**, nicht die Entscheidung. Der zweite, an diesem Tag nachgetragen: die
  Zusicherung wird **auf zwölf Provinzen mit drei Mächten** gemessen, während die
  Anforderung „bei 8 KI-Spielern" sagt — dieselbe Diskrepanz, die für R-ARCH-06/AK1 am
  selben Tag behoben wurde, im selben Dateikopf beschrieben und im Block darunter erneut
  begangen. Damit ist der gemeldete Wert 0,498 **keine Aussage über die Anforderung**: ob
  R-AI-04 unter seinen eigenen Bedingungen gehalten wird, ist bis heute ungemessen.
- **Anforderungen:** R-AI-04, R-ARCH-06
- **Abhängigkeiten:** T-M15-08
- **Dateien:** `packages/core/src/view/publicView.ts`, `packages/core/src/view/intel.ts`,
  `packages/ai/src/runner.ts`, `docs/plan/01-REQUIREMENTS.md`, `docs/plan/DECISIONS.md`,
  `docs/plan/PROBLEME.md`, `docs/reports/ai-bench.json`
- **Tests zuerst:**
  (a) **Zuerst messen, dann reparieren** — in dieser Reihenfolge, sonst ist hinterher
  unbekannt, was die Reparatur bewirkt hat. Die Zusicherung für R-AI-04 wandert nach
  `worldmap.bench.slow.test.ts` (237 Provinzen, acht KI-Mächte); was in
  `tick.bench.slow.test.ts` bleibt, trägt denselben Vermerk wie sein Nachbarblock: es
  belegt die Anforderung **nicht**, es fängt einen Rückschritt um eine Größenordnung früh
  ab. Der Ausgangswert wird festgehalten, **bevor** eine Zeile Produktionscode fällt.
  (b) `packages/core/src/view/publicView.test.ts`: die Sicht ist nach den Schnitten
  dieselbe — gleicher Inhalt, gleiche Reihenfolge —, und **kein Aufrufer kann den geteilten
  Teil verändern**. Das ist die Prüfung, an der ein geteilter unveränderlicher Teil scheitern
  würde: geteilte Objekte, die jemand beschreibt, sind schlimmer als kopierte.
- **Die zwei Schnitte, jeder einzeln gemessen:**
  1. `visibleProvinces` läuft nicht mehr **zweimal je Macht und Tick** — heute einmal in
     `updateIntel`, einmal in `publicView`, über denselben Zustand im selben Tick. Kein
     Vertrag ändert sich, keine Sicht.
  2. Der unveränderliche Teil der Provinzsicht — `id`, `name`, `kind`, `terrain`, `coastal`,
     `neighbors`, `seaLinks` — wird **einmal je Karte** gebaut statt je Macht und Tick neu
     abgeschrieben. Auf der Weltkarte sind das 237 Provinzen mal acht Mächte mal jeden Tick.
- **Fertig wenn:** `ai-bench.json` führt `aiMedianMs` und `tickMedianMs` **einzeln** fort,
  nicht nur den Quotienten — ein gestiegener Anteil kann von beidem kommen. Die Zusicherung
  im Bench ist danach **nicht mehr lockerer als die Anforderung, die sie vertritt**: heute
  sichert sie 0,5 zu, wo die Anforderung 0,30 sagt. Fällt die Messung gegen die Anforderung
  aus, wird nachgemessen und begründet wie bei R-ARCH-06 am 2026-09-06 — Eintrag in
  `DECISIONS.md`, Entscheidung durch Noah. **Das bloße Anheben der Grenze, damit die Zahl
  passt, ist ausgeschlossen.** `pnpm verify` und `pnpm test:slow` grün.

### T-M16-03 · Der erste Bau
- **Ziel:** Den Auslieferungspfad zum ersten Mal wirklich ausführen. Heute hat
  `@tauri-apps/cli` **null Treffer im Lockfile**, `Cargo.lock` fehlt, das von
  `tauri.conf.json` verlangte Symbol gibt es nicht — und der einzige Beleg ist ein Wächter,
  der `tauri.conf.json` gegen `capabilities/local-only.json` hält, also zwei Dateien
  derselben Hand.
- **Anforderungen:** R-PKG-01, R-FREE-04
- **Rahmen:** C-02
- **Abhängigkeiten:** T-M16-01
- **Dateien:** `package.json`, `pnpm-lock.yaml`, `.gitignore`,
  `scripts/build-icon.mjs` *(neu)*, `apps/desktop/src-tauri/tauri.conf.json`,
  `apps/desktop/src-tauri/Cargo.lock` *(neu)*,
  `apps/desktop/src-tauri/icons/icon.png` *(neu)*,
  `apps/desktop/src-tauri/icons/icon.ico` *(neu)*
- **Reihenfolge, und sie ist nicht beliebig:** erst das **Symbol**, weil `tauri.conf.json`
  es verlangt und ein Bau, der daran scheitert, über den Rest nichts sagt; es wird **selbst
  erzeugt und nicht bezogen** (R-ASSET-01). Dann die Abhängigkeiten. Dann der Bau.
- **Tests zuerst:** `test/guards/packaging.test.ts` bekommt einen **zweiten Teil**, der an
  Dingen hängt, die nur ein Bau erzeugt: ein Eintrag für die Tauri-Werkzeugkette im
  Lockfile, `Cargo.lock`, das Symbol. Der erste Teil bleibt **unverändert** — R-FREE-04 in
  der Konfiguration ist richtig geprüft; er ist nur kein Beleg dafür, dass je ein Bau lief.
- **Fertig wenn:** der Bau läuft durch und erzeugt ein startfähiges Erzeugnis; `Cargo.lock`
  liegt danach im Baum. Der Fortschrittseintrag nennt, was der Bau an Werkzeug gebraucht
  hat: Rust ist auf der Maschine vorhanden, der erste `cargo`-Lauf bezieht die Crates aus
  dem Netz — **Freigabe durch Noah am 2026-09-06**.

### T-M16-04 · Der Datei-Port
- **Ziel:** Spielstände im echten Dateisystem — die Zusage, die T-M8-00 seit M8 trug und
  deren vier Dateien nie existierten. Seit T-M14-08 gibt es `createStorage` als **eine**
  prüfbare Stelle und `storagePortContract` gegen zwei Umsetzungen; der Datei-Port tritt als
  **dritte** hinzu.
- **Anforderungen:** R-PKG-02, R-GAME-03, R-GAME-04
- **Rahmen:** C-02
- **Abhängigkeiten:** T-M14-08, T-M16-03
- **Dateien:** `apps/desktop/src/storage/TauriStorage.ts` *(neu)*,
  `apps/desktop/src/storage/createStorage.ts`,
  `packages/core/src/persistence/StoragePort.ts`, `docs/plan/PROGRESS.md`
- **Tests zuerst:**
  (a) `storagePortContract` läuft unverändert gegen die dritte Umsetzung. **Er erfüllt
  denselben Vertrag oder er ist falsch** — an Vertrag und Fabrik ändert diese Aufgabe
  nichts. Damit ist T-M8-00s Wortlaut („dieselbe Vertragstestreihe gegen alle drei
  Umsetzungen") zum ersten Mal erfüllt.
  (b) **Die zweite Prüfung ist die eigentliche** (R-PKG-02/AK2): ein **außerhalb** des
  Programms gelöschter Stand verschwindet aus der Liste. Ohne sie wäre ein Port grün, der
  die Namen nur im Speicher führt und beim Start einmal einliest — genau die Umsetzung, die
  im Vertrag nicht auffällt, weil der Vertrag den Prozess nie verlässt.
- **Fertig wenn:** T-M8-00 ist **geschlossen** und trägt diese Aufgabe im Feld `reopened`;
  der Wächter `persistence-contract` fällt weiterhin, sobald nur eine Fabrik registriert
  ist. `pnpm verify` grün.

### T-M16-05 · AK-8 gemessen
- **Ziel:** Das Abnahmekriterium des Meilensteins, gemessen statt behauptet.
- **Anforderungen:** R-PKG-01, R-PKG-02
- **Abnahme:** AK-8
- **Abhängigkeiten:** T-M16-03, T-M16-04
- **Dateien:** `scripts/acceptance.mjs`, `docs/reports/packaging.md` *(neu)*,
  `docs/plan/PROGRESS.md`
- **Fertig wenn:** das Erzeugnis startet, schreibt einen Spielstand, wird geschlossen, wird
  neu gestartet — und der Stand liegt wieder in der Liste, mit Datum in
  `docs/reports/packaging.md`. Erst jetzt zählt AK-8 in `pnpm acceptance` mit; die Zeile aus
  T-M16-01 wechselt vom Vermerk „zählt nicht gegen V1" auf ein gemessenes Ergebnis. **Die
  V1-Abnahme AK-1 bis AK-7 bleibt unberührt**, und T-M12-03 wird von dieser Aufgabe nicht
  angefasst.

### T-M16-06 · Die Karte wird zum ersten Mal zeichnend gemessen
- **Ziel:** R-ARCH-06/AK2 — 60 FPS bei 200 Provinzen — misst bis heute **niemand, der
  zeichnet**: `MapCanvas` läuft in keinem Test, weil `getContext` in der Testumgebung `null`
  liefert, und 141 von 249 Zeilen sind unausgeführt. Am gebauten Programm existiert ein
  Zeichenkontext, und damit wird die Zusicherung zum ersten Mal überhaupt prüfbar.
- **Anforderungen:** R-ARCH-06, R-UI-12
- **Abhängigkeiten:** T-M16-03
- **Dateien:** `apps/desktop/src/ui/MapCanvas.tsx`, `docs/reports/render-bench.json`
- **Fertig wenn:** die Zusicherung ist an einem Lauf belegt, der wirklich zeichnet, und die
  unausgeführten Zeilen von `MapCanvas` sind **gezählt statt geschätzt**. Fällt die Messung
  gegen die Anforderung aus, gilt dasselbe wie in T-M16-02: nachmessen und begründen, nicht
  die Zahl weichspülen.

### T-M16-07 · Bedienbar ohne Maus
- **Ziel:** Belegt ist heute der Kontrast (R-UI-02) und die Tastenzuordnung als **reine
  Funktion** (R-UI-06). Was fehlt, ist die Ebene dazwischen: **kein Test öffnet einen Dialog
  und schließt ihn** (Befund N12). Fokusfang und Escape sind keine Eigenschaften einer
  Funktion, sondern eines laufenden Baums.
- **Anforderungen:** R-UI-15, R-UI-06
- **Abhängigkeiten:** T-M16-03
- **Dateien:** `apps/desktop/src/ui/Dialog.tsx`, `apps/desktop/src/ui/Panels.tsx`
- **Tests zuerst:** `apps/desktop/src/ui/a11y.test.tsx` — Escape schließt jeden Dialog; der
  Fokus bleibt im offenen Dialog und kehrt beim Schließen an das auslösende Element zurück;
  die Tabreihenfolge folgt der Leserichtung; ein Wächter findet jedes Bedienelement ohne
  sichtbaren Text, das keinen Namen für Hilfsmittel trägt.
- **Fertig wenn:** `pnpm verify` grün. **Kein Barrierefreiheits-Rahmenwerk und keine neue
  Abhängigkeit** — die Prüfung ist die Zusage.

## Meilenstein M17 — Tiefe zwischen den Kriegen

> **Warum es diesen Meilenstein gibt.** Was M15 bewusst weggelassen hat, kommt hier: Spionage
> (R-SPY-01 bis R-SPY-06) und Handelsangebote mit Treuhand (R-DIP-05, R-DIP-07) — zusammen
> zweiundvierzig Prozent des Akzeptanzbudgets von V1.2, ohne dass sie die Frage beantworten, mit
> der Abschnitt 2.15 selbst beginnt. Beide setzen voraus, was M15 erst schafft: eine
> `PublicView`, die eingehende Angebote führt, ein Verhältnis, das über Annahme und Ablehnung
> entscheidet, und ein Turnier, das `TRADE_EXECUTED` überhaupt zählt — vorher wäre ein zweites
> Handelssystem über einem ersten gebaut, den die KI nachweislich nie benutzt. Die Zeitung
> gehört nicht mehr hierher: sie ist in M15 durch den Filter „Weltgeschehen" ersetzt und
> gestrichen.

## Meilenstein M18 — Später

> **Warum es diesen Meilenstein gibt.** Nuklearwaffen, Koalitionen, Verträge mit Laufzeiten,
> Lufteinsatzbefehle, Sammelpunkte, Dauerrekrutierung und Mehrspieler — Wünsche, die genannt
> wurden und keine Anforderung haben. Der Meilenstein existiert, damit sie einen Ort haben, der
> nicht der laufende Plan ist; wer etwas von hier bauen will, schreibt zuerst eine Anforderung
> mit Akzeptanzkriterien und holt sie in einen echten Meilenstein. Ein Meilenstein ohne Aufgaben
> ist unbedenklich — der Plan-Wächter prüft die Richtung Aufgabe → Meilenstein, nicht umgekehrt.

---

## Übersicht: Haltepunkte, an denen Noah gebraucht wird

| Aufgabe | Warum |
|---|---|
| T-M9-01 | Download von Geodaten — Freigabe für externen Bezug |
| T-M10-01 | Design-Gate: Mockup-Freigabe vor dem UI-Bau |
| T-M12-03 | Abnahme-Playtest |
| T-M14-15 | Playtest-Bogen der V1: Noah spielt und füllt ihn aus (AK-7) |

Alles dazwischen ist ohne Rückfrage ausführbar.

> **Zur vierten Zeile.** Sie ist seit dem 2026-09-06 scharf: T-M14-15 trägt `gate: true` samt
> Begründung, und die Wächterliste in `test/plan-consistency.test.ts` nennt alle vier. Beides
> ist in **einer** Änderung eingetragen worden, wie die Aufgabe es verlangt — bis dahin fehlte
> der Block mit Absicht, weil ein vorgezogenes `gate: true` gegen eine dreistellige Wächterliste
> die Zusage „`pnpm verify` grün" in jeder M14-Aufgabe unerfüllbar gemacht hätte.
>
> Neu prüft der Wächter zusätzlich die Gegenrichtung: **diese Tabelle und `tasks.yaml` müssen
> dieselben Haltepunkte nennen.** Die vierte Zeile stand hier einen Meilenstein lang, ohne dass
> `tasks.yaml` etwas davon wusste — ein Haltepunkt, den nur eine der beiden Seiten kennt, hält
> niemanden auf.

## Meilenstein M19 — Die Karte zeigt, was da ist

> **Herkunft:** Noahs Abnahme-Playtest am 2026-09-07. Gemeldet als „im Westen der USA und
> Nordkanada überlappt der Ozean das Land"; gemessen als **das Gegenteil** — es überlappt
> nichts, es fehlt. 130 von 237 Provinzen verlieren Land, 14,2 % der Landfläche wird nie
> gezeichnet. Entwurf: **D21**.
>
> **Die Reihenfolge ist Absicht:** erst messen und festhalten, dann reparieren, dann den
> Wächter scharf schalten. Ein Wächter, der heute rot ist, wird nicht stillschweigend
> eingebaut — die Lehre vom 2026-09-06.

### T-M19-01 · Der Wächter, der es hätte finden müssen
- **Ziel:** Kein Test im Projekt sagt etwas über `polygon`. `validateMap` prüft
  `polygon.length >= 3` und nichts weiter; der eine Test, der geografische Lage prüft und
  sogar `USA-WEST` beim Namen nennt, zeigt auf `world-shapes.json` — die Quelle, wo alles
  stimmt. Das ist Befund **N9** der Auswertung vom 2026-09-05, offen und ohne Besitzer;
  diese Aufgabe schließt ihn.
- **Anforderungen:** R-MAP-09
- **Entwurf:** D21.4
- **Abhängigkeiten:** keine
- **Dateien:** `packages/mapgen/src/project.ts` (die Projektion wird herausgezogen, damit
  ein Wächter sie nicht abschreiben muss), `data/maps/landmarks.csv` (neu)
- **Tests zuerst:** `packages/mapgen/src/worldmap.geometry.test.ts` — (G2) je Provinz trägt
  die gezeichnete Fläche ≥ 99 % der Quellfläche; (G1) der Ankerpunkt liegt in einer
  gezeichneten Fläche; (G3) bekannte Städte liegen an Land; (G4) kein Punkt außerhalb der
  Leinwand.
- **Fertig wenn:** die vier Prüfungen stehen, **laufen und melden ihre Zahl** — und sie sind
  **erwartet rot**: heute fallen G2 mit 130 von 237, G1 mit 4, G3 mit 10 von 28, G4 mit
  Grönland. Die Zahlen stehen in `docs/reports/map-geometry.md`, der Wächter ist mit
  `it.fails` oder einer ausdrücklichen Übergangsliste geführt, bis T-M19-02 ihn grün macht.
  **Ein neuer roter Wächter darf die Kette nicht blockieren** — die Lehre vom 2026-09-06.
  Die Projektion wird **verschoben, nicht kopiert**: zwei Tabellen der Wahrheit sind genau
  der Fehler, vor dem die Zeichentests des Projekts warnen.

### T-M19-02 · Eine Provinz darf mehrteilig sein
- **Ziel:** `polygon` wird von einem Umriss zu einer Liste von Umrissen. Nicht die bessere
  Auswahl, sondern **keine Auswahl mehr**. Der Grund, warum das billig ist, steht in D21.3:
  `polygon` ist reine Zeichendatei — der Kern liest es außerhalb von `validateMap` nicht, die
  KI nie, Spielstände enthalten die Karte nicht. **Keine Migration, kein Golden Master, kein
  Schemaschritt.**
- **Anforderungen:** R-MAP-08
- **Entwurf:** D21.3
- **Abhängigkeiten:** T-M19-01
- **Dateien:** `packages/core/src/state/types.ts`, `packages/core/src/map/validate.ts`,
  `scripts/build-map.mjs`, `apps/desktop/src/map/render.ts`,
  `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/map/picking.ts`,
  `data/maps/world.json`
- **Tests zuerst:** die vier Prüfungen aus T-M19-01 werden grün — **ohne dass ihre Schwelle
  weicher wird**. Dazu `apps/desktop/src/map/picking.test.ts`: ein Klick auf Alaska **und**
  ein Klick auf Kalifornien wählen dieselbe Provinz.
- **Fertig wenn:** ≥ 99 % der Landfläche gezeichnet, `pnpm verify` grün, die Zeichenmessung
  aus T-M16-06 wiederholt und **im Budget** (16,7 ms p95) — +26 % Punkte sind zu messen, nicht
  zu schätzen. Die Schwelle für kleine Umrisse (25 px²) steht mit ihrer Zahl in `DECISIONS.md`.
  **Die naheliegende Reparatur ist ausdrücklich nicht diese Aufgabe:** „größter Ring" wählt
  nach der Projektion wieder Alaska (D21.2).

### T-M19-03 · Grönland bleibt auf der Leinwand
- **Ziel:** 796 Punkte Grönlands liegen oberhalb der Leinwand, bis y = −436; der 78°-Beschnitt
  der Projektion wird nie geklippt. Kleiner, eigener Fehler — eigene Aufgabe, damit er nicht
  in der großen mitschwimmt und unbemerkt bleibt.
- **Anforderungen:** R-MAP-08
- **Entwurf:** D21.5
- **Abhängigkeiten:** T-M19-02
- **Dateien:** `scripts/build-map.mjs`, `data/maps/world.json`
- **Tests zuerst:** G4 aus T-M19-01 wird grün.
- **Fertig wenn:** kein Punkt außerhalb `[0,4000] × [0,2400]`; die Küstenlinie Grönlands
  bleibt an der Beschnittkante **sichtbar durchgehend** und wird nicht zu einer geraden Linie
  zusammengefaltet.

### T-M19-04 · Südostaustralien ist ein Punkt
- **Ziel:** `AUS-SE` „Südostaustralien" ist eine **spielbare Provinz von 39 px²**, die ganz
  innerhalb von `AUS-NE` liegt. Sie besteht aus Australian Capital Territory, Jervis Bay und
  Macquarie-Insel — die Kuratierung hat einen Namen vergeben, den die Geometrie nicht trägt.
  Das ist ein Quellendatenfehler, kein Generatorfehler, und deshalb eine eigene Aufgabe.
- **Anforderungen:** R-MAP-08
- **Abhängigkeiten:** T-M19-02
- **Dateien:** `data/maps/world-provinces.csv`, `data/maps/world.json`
- **Tests zuerst:** ein Wächter über die Mindestgröße einer **spielbaren** Provinz; er nennt
  seine Schwelle und die heute darunter liegenden Provinzen.
- **Fertig wenn:** entweder trägt `AUS-SE` die Fläche, die ihr Name behauptet, oder sie
  verschwindet und ihre Einheiten gehen an `AUS-NE`. **Ein drittes gibt es nicht** — eine
  Provinz, die man nicht anklicken kann, ist keine.
- ⚠ **Diese Aufgabe ist als einzige in M19 keine reine Zeichenänderung.** `AUS-SE` steht in
  Australiens Startaufstellung, trägt 52 097 Einwohner, zwei Vorkommen und drei Kanten. Sie
  zu streichen ändert die Wirtschaft einer Macht und den Graphen — also die Partie, also
  AK-1. **Die sichere Richtung ist deshalb, ihr Fläche zu geben**, nicht sie zu streichen.
  Wird doch gestrichen, gehört ein neuer `pnpm sim:fullgame` dazu.

### T-M19-05 · Der Bericht sagt, was die Karte zeigt
- **Ziel:** Die Zahlen aus M19 gehören an einen Ort, der sie stempelt — wie `acceptance.md`
  und `packaging.md`. Ohne ihn wandert „14,2 % fehlten" als nackte Zahl durch Berichte und
  wird unterwegs zur Aussage.
- **Anforderungen:** R-MAP-09
- **Abhängigkeiten:** T-M19-02, T-M19-03, T-M19-04
- **Dateien:** `docs/reports/map-geometry.md`, `docs/plan/PROBLEME.md`, `docs/plan/PROGRESS.md`
- **Tests zuerst:** keine — der Bericht ist ein Erzeugnis, sein Wächter ist T-M19-01.
- **Fertig wenn:** vorher/nachher je Prüfung, gegen den Commit gestempelt, **und ein
  Bildbeleg derselben Kartenstelle**. Der gemeldete Fehler war sichtbar; vier grüne Zahlen
  sind kein Nachweis dafür, dass Noah jetzt Kalifornien sieht. Dazu wird der
  Eintrag in `PROBLEME.md` vom 2026-09-03 berichtigt, der über genau diese vier Provinzen
  „Die Karte zeichnet richtig" feststellte — er war für `world-shapes.json` wahr und für
  `world.json` falsch.

## Meilenstein M20 — Die Karte spricht mit

> **Herkunft:** Noahs Wunsch vom 2026-09-07, „Bilder/Icons ins UI miteinarbeiten" für ein
> interaktiveres Gefühl. Entwurf: **D22**.
>
> **Die Reihenfolge ist Absicht:** zuerst die Lücken in dem, was schon zugesagt ist
> (T-M20-01), dann das Neue. Und das Riskanteste zuletzt: Bewegung auf der Karte ist die am
> schlechtesten abgedeckte Stelle der Oberfläche.
>
> **Was hier nicht gebaut wird:** keine fremde Grafik, keine `<img>`-Marke, keine dunkle
> Fassung. Alles vier ist maschinell gesperrt (D22.2) — und das ist die Antwort auf „welche
> Art Bild": **gezeichnete, aus dem eigenen Satz.**

### T-M20-01 · Die zugesagten Symbole, die es nicht gibt
- **Ziel:** R-UI-10 nennt im Text den **Beziehungszustand**, R-UI-11 die **Geländeart** —
  beides V1-Anforderungen, beides steht als deutsches Wort da. Unbemerkt blieb es, weil
  R-UI-10/AK1 nur nach Gebäude und Einheit fragt: ein Kriterium, das einen Teil des
  Versprechens prüft und den Rest erfüllt aussehen lässt. Dieselbe Bauart wie AK-7 vor dem
  2026-09-07.
- **Anforderungen:** R-UI-10, R-UI-11
- **Entwurf:** D22.3
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/icons.tsx`, `apps/desktop/src/ui/Panels.tsx`
- **Tests zuerst:** `apps/desktop/src/ui/icons.test.tsx` — der Vollständigkeitswächter prüft
  **jeden im Anforderungstext genannten Satz** gegen die Regeldateien, also auch
  Beziehungszustände (6) und Geländearten (5), nicht nur Einheiten, Gebäude und Rohstoffe.
- **Fertig wenn:** elf neue Pfade, der Wächter grün, und **er wäre vorher rot gewesen** —
  nachgewiesen gegen den heutigen Stand. Zeichnerisch gilt die Hausregel: ein Strich in einem
  24×24-Feld, lesbar bei 14 px.

### T-M20-02 · Jede Macht hat ein Gesicht
- **Ziel:** Wo eine Macht genannt wird, steht ihr Name — und der Spieler soll sich elf
  Zuordnungen merken, die die Karte längst zeigt. Die Farbe steht im Zustand und wird
  außerhalb der Karte nirgends benutzt.
- **Anforderungen:** R-UI-16
- **Entwurf:** D22.4
- **Abhängigkeiten:** T-M20-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Standings.tsx`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** `apps/desktop/src/ui/Standings.test.tsx` und `Panels.test.tsx` — wo eine
  Macht in einer Zeile steht, trägt die Zeile ihre Kartenfarbe; und **die Farbe ist nie das
  einzige Unterscheidungsmerkmal** (R-UI-16/AK2).
- **Fertig wenn:** Diplomatie, Lage, Protokoll und Provinzansicht tragen die Farbe.
  AK2 ist kein Beiwerk: rund acht Prozent der Männer unterscheiden Rot und Grün nicht, und
  die Spielerfarben enthalten beides.

### T-M20-03 · Was längst berechnet wird, wird auch gezeigt
- **Ziel:** Drei Stellen berechnen bereits die Größe, die ein Zeichen tragen würde, und
  zeigen sie nicht: `categoryOf()` klassifiziert jede Protokollzeile, `dominantIcon()` kennt
  die stärkste Gattung jeder Armee, `RESOURCE_ICONS` steht in der Kopfleiste. Dieselbe Bauart
  wie die Playtest-Befunde vom 2026-09-06: gebaut, getestet, unerreichbar.
- **Anforderungen:** R-UI-10
- **Entwurf:** D22.4
- **Abhängigkeiten:** T-M20-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`
- **Tests zuerst:** `apps/desktop/src/ui/Panels.test.tsx` — eine Protokollzeile der Rubrik
  „Kampf" trägt das Kampfzeichen; eine Armeezeile trägt das Zeichen ihrer stärksten Gattung.
- **Fertig wenn:** beides steht. **Der Markt bleibt ausgenommen und das ist eine
  Entscheidung, keine Auslassung:** ein `<option>` kann kein SVG tragen. Ihn umzubauen hieße,
  ein natives Auswahlfeld gegen eine eigene Liste zu tauschen — Bedienbarkeit gegen Aussehen,
  und das entscheidet Noah, nicht diese Aufgabe. Der Verzicht steht mit Begründung in
  `DECISIONS.md`.

### T-M20-04 · Die Oberfläche antwortet
- **Ziel:** Der Teil von „interaktiver", der keine Symbole meint. Und hier liegt eine offene
  V1-Zusage: **R-UI-04 verspricht „Bewegungs- und Kampfanimationen", und nur die Kampfhälfte
  existiert.**
- **Anforderungen:** R-UI-17, R-UI-04
- **Entwurf:** D22.5
- **Abhängigkeiten:** T-M20-02, T-M20-03, T-M19-02
- **Dateien:** `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/ui/motion.ts`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** `apps/desktop/src/map/MapCanvas.test.tsx` — die gewählte Provinz trägt ihr
  Kennzeichen auf der Karte; eine marschierende Armee bewegt sich zwischen zwei Bildern; und
  **beides hört auf**, sobald `motionAllowed()` falsch sagt.
- **Fertig wenn:** `pnpm verify` grün **und die Zeichenmessung wiederholt** — 16,7 ms bei p95,
  gemessen, nicht geschätzt. Die zwei gebauten Bremsen bleiben unangetastet: oberhalb der
  Tempogrenze und unter `prefers-reduced-motion` bewegt sich nichts. „Bei hundert Spielstunden
  je Sekunde würde der Ring stroboskopieren, und das ist keine Atmosphäre, sondern eine
  Störungslampe."
  **Diese Aufgabe steht zuletzt, weil sie die riskanteste ist:** `MapCanvas` ist die am
  schlechtesten abgedeckte Datei der Oberfläche (168 von 249 Zeilen seit T-M16-06).

## Meilenstein M21 — Die ersten Spieltage führen

> **Herkunft:** Noah, 2026-09-07 — „eine Art geführte Anleitung, die in den ersten Spieltagen
> den Spielzyklus mit all seinen Mechaniken erklärt, damit der Spieler nicht überfordert ist
> und nicht weiß, was er anklicken muss, um Progress zu machen." Entwurf: **D23**.
>
> Die bestehende Einstiegshilfe erklärt in fünf Schritten die **Bedienung** und ist nach
> wenigen Minuten vorbei. Was fehlt, ist der **Zweck** — und die Stunden danach.

### T-M21-01 · Die Texte der Führung ziehen in die Sprachdatei
- **Ziel:** Die fünf Schritttexte stehen im **Quelltext** von `tutorial.ts`; `de.ts` kennt
  unter `tutorial` nur `title` und `dismiss`. Das verletzt R-UI-07 („Texte zentral in einer
  Sprachdatei"). Gefangen hat es nichts, weil der Textwächter die **Gegenrichtung** prüft: er
  sucht Schlüssel ohne Text, nicht Text ohne Schlüssel.
- **Anforderungen:** R-UI-07
- **Entwurf:** D23.1
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** `test/guards/text-keys.test.ts` — die neue Richtung: ein anzeigbarer Text
  im Quelltext einer Komponente fällt auf.
- **Fertig wenn:** jeder Schritt bezieht seinen Text aus `t()`. **Diese Aufgabe steht zuerst**
  — sonst entstehen in T-M21-02 zwölf neue Texte an der falschen Stelle.

### T-M21-02 · Die Führung folgt dem Spiel, nicht der Knopfleiste
- **Ziel:** `completesOn` kennt heute fünf Oberflächenereignisse. Es kommt hinzu, was das
  **Spiel** meldet — Bau fertig, Einheit ausgehoben, Armee marschiert, Provinz erobert — und
  die **Zeit**: ein Spieltag vergangen. Damit führt die Anleitung den Kreislauf *bauen →
  ausheben → führen → erobern* statt der Knopfleiste.
- **Anforderungen:** R-UI-18
- **Entwurf:** D23.4
- **Abhängigkeiten:** T-M21-01
- **Dateien:** `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/ui/Tutorial.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** `apps/desktop/src/game/tutorial.test.ts` und `App.test.tsx` — ein Test
  führt eine **echte Partie** so weit, dass ein Schritt durch ein **Spielereignis** endet,
  nicht durch einen Klick.
- **Fertig wenn:** die drei Regeln der bestehenden Hilfe unangetastet gelten — sie blockiert
  nie, sie kommt nur beim ersten Mal, sie bleibt aus, wenn man sie abschaltet. **Auch die
  freundliche Sperre ist eine Sperre** („erst wenn Sie X getan haben"): wer die Führung
  ignoriert, spielt weiter, und sie holt ihn ein.

### T-M21-03 · Die Führung nennt das Warten beim Namen
- **Ziel:** Aus den Regeln gerechnet: der Startvorrat trägt **350 Material**, die Kaserne
  kostet **333** — genau eine ist drin. Danach vergeht ein Spieltag Bauzeit und ein halber für
  die Infanterie: **die erste Einheit steht frühestens an Spieltag 2,5.** Dazwischen gibt es
  nichts zu klicken, was voranbringt. Genau dort steigt ein neuer Spieler aus.
- **Anforderungen:** R-UI-18
- **Entwurf:** D23.3
- **Abhängigkeiten:** T-M21-02
- **Dateien:** `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** `apps/desktop/src/game/tutorial.test.ts` — der Warteschritt erscheint und
  nennt Tempo und Vorspulen.
- **Fertig wenn:** die Lücke ist ausdrücklich benannt. **Ein Hinweis, der Warten als Warten
  benennt, ist besser als einer, der so tut, als gäbe es etwas zu tun.**

### T-M21-04 · Jede Mechanik wird erklärt, wenn sie freigeschaltet wird
- **Ziel:** Das Rückgrat ist die Freischaltungsachse, die das Spiel **ohnehin hat** — Kaserne
  und Infanterie an Tag 1, Hafen an Tag 2, Festung und Transporter an Tag 3, Motorisierte an
  Tag 4, Eisenbahn an Tag 5, Fabrik und Panzer an Tag 8, Werft und Artillerie an Tag 9,
  Flugplatz und Jagdflugzeug an Tag 10, Zerstörer an Tag 11, Bomber an Tag 13. Jede Mechanik
  wird erklärt, **wenn sie kommt** — nicht vorher und nicht alles auf einmal.
- **Anforderungen:** R-UI-18
- **Entwurf:** D23.2
- **Abhängigkeiten:** T-M21-02
- **Dateien:** `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** ein **Wächter**, der die Bindung hält: jede Sache mit `availableFromDay`
  hat einen Führungsschritt oder steht auf einer **begründeten** Ausnahmeliste.
- **Fertig wenn:** der Wächter steht. Ohne ihn fällt eine neue Einheit still aus der Anleitung
  — dieselbe Bauart wie der Symbolsatz, der Schlüssel führte, die es in den Regeln nicht gab.

### T-M21-05 · Der Durchgang wird gemessen, nicht behauptet
- **Ziel:** Eine Führung, die nur ihre eigenen Tests besteht, ist eine Führung, die niemand
  geführt hat.
- **Anforderungen:** R-UI-18
- **Abhängigkeiten:** T-M21-03, T-M21-04
- **Dateien:** `docs/reports/onboarding.md`, `docs/PLAYTEST.md`
- **Tests zuerst:** keine — der Bericht ist ein Erzeugnis; seine Wächter sind T-M21-04 und die
  Tests der Schritte.
- **Fertig wenn:** ein Lauf über die ersten **16 Spieltage** ist protokolliert: welcher Schritt
  wann kam, wie lange der Spieler zwischen zwei Schritten **ohne Aufgabe** war, und wo die
  längste Pause liegt. **Die längste Pause ist die Zahl, die zählt** — sie ist die Stelle, an
  der jemand aufhört. Dazu zwei Fragen im Playtest-Bogen, die ein Mensch beantwortet: *wusste
  ich, was zu tun ist* und *wusste ich, wozu*.

### T-M21-06 · Drei Auskünfte, die falsch sind oder nie ankommen
- **Ziel:** Bei der Bestandsaufnahme für M21 gefunden, alle drei nachgemessen. Sie gehören
  nicht zur Führung, sondern sind Fehler in dem, was das Spiel **heute schon** sagt — und eine
  falsche Auskunft ist schlimmer als keine, weil der Spieler ihr glaubt.
  1. **Die Kosten gesperrter Dinge sind unsichtbar.** `Panels.tsx:81` setzt
     `title={action.disabledReason ?? action.hint ?? undefined}`. Bei einem gesperrten Knopf
     gewinnt der Grund, und der Hinweis mit Kosten und Dauer fällt weg. Der Spieler erfährt
     *dass* es die Fabrik erst ab Tag 8 gibt, aber nie, *was sie kosten wird* — Vorausplanen
     ist damit unmöglich. Verschärfend: `availabilityHint()` (`actions.ts:106`) liefert seinen
     Text **nur, solange die Sache gesperrt ist** — also genau dann, wenn er verworfen wird.
     **Toter Code, gebaut in T-M15-03**, und der Test dazu prüft die Daten, nicht den Baum.
  2. **Die Erklärung zum Frieden ist falsch.** `de.ts:490`: „Truppen dürfen die Grenze nicht
     überschreiten." `movement.ts:33` ruft `findPath` **ohne** `canEnter` — sie dürfen. Frieden
     hindert nur am *Behalten* (`occupation.ts:40`), nicht am Betreten. Ein Spieler, der dem
     Text glaubt, hält seine Grenze für sicher.
  3. **Die Anleitung widerspricht dem Spiel.** `ANLEITUNG.md:124`: „Es gibt nichts zurück."
     Der Code erstattet die Hälfte, und der Playtest hat es gemessen (+166 Material, +125
     Geld). Derselbe Irrtum stand im Playtest-Bogen und ist dort am 2026-09-06 berichtigt
     worden — in der Anleitung steht er noch.
- **Anforderungen:** R-UI-05, R-UI-11
- **Entwurf:** D23.4
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/actions.ts`,
  `apps/desktop/src/i18n/de.ts`, `docs/ANLEITUNG.md`
- **Tests zuerst:** ein Test am **gerenderten Baum**, nicht an den Daten: ein gesperrter Knopf
  trägt Kosten *und* Grund. Dazu ein Test, der die Friedensregel gegen den **Code** prüft statt
  gegen den Text — er wäre heute rot.
- **Fertig wenn:** alle drei stimmen. Und der dritte Punkt bekommt einen Wächter, der die Art
  Fehler fängt statt des Einzelfalls: **die Anleitung darf keine Zahl nennen, die den
  Regeldateien widerspricht.** Zwei Wahrheiten über dieselbe Sache sind der Grund, warum
  dieser Eintrag existiert.

---

## Meilenstein M22 — Die Oberfläche hält, was der Kern rechnet

> **Herkunft:** der delegierte Abnahme-Playtest V2 vom 2026-09-07
> (`docs/reports/playtest-2026-09-07-v2.md`) und der LEVEL-UP-Plan
> (`docs/plan/LEVEL-UP.md`), Achse **UI/UX**. Entwurf: **D24**.
>
> Diagnose in einem Satz: das Spiel *rechnet* auf dem Niveau eines fertigen
> Strategiespiels und *spricht* auf dem Niveau eines Debug-Werkzeugs. Der Kern erzeugt
> die Information vollständig — die Oberfläche wirft sie auf dem letzten Meter weg.

### T-M22-01 · Das Protokoll spricht in ganzen Zeilen
- **Ziel:** Befund V2-01 — jeder Protokolleintrag bricht in einer ~90-px-Spalte nach je
  1–2 Wörtern um; die Leiste ist ~1400 px breit. Der wichtigste Kanal des Spiels ist
  faktisch unlesbar.
- **Anforderungen:** R-TIME-06, R-UI-05
- **Entwurf:** D24.1
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/App.tsx`
- **Tests zuerst:** ein Test am gerenderten Baum (`apps/desktop/src/App.test.tsx`), der
  die Eintragsbreite an die Leistenbreite bindet (abzüglich Zeitstempel, kein fester
  Pixelwert) — fällt heute.
- **Fertig wenn:** ein Eintrag die verfügbare Breite nutzt und der Test grün ist.

### T-M22-02 · Die Seitenleiste hört auf, seitwärts zu kriechen
- **Ziel:** Befund V2-02 — die Wirtschaftstabelle (Spalte „In Auftrag") ist breiter als
  die Leiste; die ganze Leiste scrollt horizontal, Armeeknöpfe erscheinen abgeschnitten
  („…arschieren"), Überschriften verlieren Buchstaben („ebug").
- **Anforderungen:** R-UI-05
- **Entwurf:** D24.2
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/icons.tsx`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** ein Wächter-Test am gerenderten Baum (`Panels.test.tsx`, dazu
  `App.test.tsx`): `scrollWidth <= clientWidth` für die Leiste — in jsdom als
  Struktur- und Kaskadenprüfung gebunden (DECISIONS.md, 2026-09-07).
- **Fertig wenn:** kein horizontales Scrollen mehr; „In Auftrag" wird ein Zeichen mit
  Zahl hinter dem Bestand.

### T-M22-03 · Was mich betrifft, sieht anders aus
- **Ziel:** Befund V2-07 — der Fall der eigenen Großstadt hat dieselbe optische Stimme
  wie „Vietnam ist gefallen" am anderen Ende der Welt.
- **Anforderungen:** R-TIME-06, R-UI-05
- **Entwurf:** D24.1
- **Abhängigkeiten:** T-M22-01
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/events.ts`
- **Tests zuerst:** die Zuordnung Ereignis → Klasse gegen die Ereignisarten des Kerns —
  für **jede** Art, nicht für ein Beispiel (`events.test.ts`); die Klasse am gerenderten
  Baum in `Panels.test.tsx`.
- **Fertig wenn:** Einträge, die den Spieler selbst betreffen (Provinzverlust,
  Hauptstadt, Aufstand, eigenes Ausscheiden), Zinnober-Balken und Fettung tragen.

### T-M22-04 · Start mit Gesicht, Menü mit Wegen, Weiterspielen mit einem Klick
- **Ziel:** Befunde V2-03/04/05 — der Startdialog ist ein Formular ohne Titel; nach dem
  Neustart ist der jüngste Stand zwei Klicks entfernt; das Menü kennt nur Einstellungen.
- **Anforderungen:** R-UI-05, R-GAME-03
- **Entwurf:** D24.3
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/game/saves.ts`, `apps/desktop/src/i18n/de.ts`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** der Weiterspielen-Test (lädt den jüngsten Stand;
  `Dialogs.test.tsx` und `App.test.tsx`) — fällt heute.
- **Fertig wenn:** Titelzeile im Startdialog; „Weiterspielen (Tag N)" als **erster**
  Knopf, wenn ein Stand existiert; Menü mit Neue Partie / Spielstände / Einstellungen,
  auch aus der laufenden Partie.

### T-M22-05 · Jeder Befehl quittiert; eine stehende Uhr sagt es
- **Ziel:** Befunde V2-08/09 — nach „Krieg erklären" zeigt das Panel weiter „Frieden"
  bis zum nächsten Tick (bei Pause dauerhaft); eine stehende Uhr behauptet ihr Tempo.
- **Anforderungen:** R-UI-05, R-TIME-02
- **Entwurf:** D24.5
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Header.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`,
  `apps/desktop/src/game/fastForward.ts`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** beide fallen heute — ausstehender Befehl sichtbar; „Pausiert" nach
  zwei Sekunden ohne Tick trotz eingestelltem Tempo (`App.test.tsx`, dazu
  `Panels.test.tsx`/`Header.test.tsx` je Komponente).
- **Fertig wenn:** beide Anzeigen stehen, gespeist aus der Befehlsübergabe der Hülle.

### T-M22-06 · Knöpfe sagen, was sie tun
- **Ziel:** Befunde V2-13/14 — Bau-/Aushebeknöpfe tragen als zugänglichen Namen den
  Kosten-Tooltip statt der Aktion; Armee-Marker sind ~12-px-Klickziele.
- **Anforderungen:** R-UI-06, R-UI-05
- **Entwurf:** D24.5
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/actions.ts`,
  `apps/desktop/src/map/markers.ts`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** ein a11y-Test über **alle** Aktionen aus `actions.ts`
  (`a11y.test.tsx`); der Picking-Radius rein in `markers.test.ts`.
- **Fertig wenn:** jeder Befehlsknopf einen aria-Namen „VERB OBJEKT" trägt (Kosten
  bleiben im `title`); Armee-Marker-Trefferfläche mindestens 24 px (Picking-Radius,
  nicht Zeichnungsgröße).

---

## Meilenstein M23 — Die Sprache wird fertig

> **Herkunft:** LEVEL-UP.md, Achse **Stil**. „Stil" heißt hier nicht Schmuck, sondern ob
> man dem Spiel glaubt: Ersatzschrift und Kongruenzfehler geben ihm die Anmutung eines
> Provisoriums. Entwurf: **D24**.

### T-M23-01 · Umlaute kehren zurück, ein Wächter hält die Tür
- **Ziel:** Befund V2-10 — Tooltips sagen „haelt", „Staerke", „Haelfte"; die
  tasks.yaml-Regel „ohne Umlaute" ist in Spielertexte durchgesickert.
- **Anforderungen:** R-UI-07
- **Entwurf:** D24.6
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/game/actions.ts`,
  `packages/ai/src/economy.ts`, `packages/ai/src/military.ts`
- **Tests zuerst:** der Wächter (fällt heute; `test/guards/text-keys.test.ts`, dazu
  `Dialogs.test.tsx`): jeder Text aus `de.ts` und jeder
  Prosa-String aus `actions.ts` ohne ae/oe/ue-Ersatzschrift; Ausnahmen über eine
  Musterliste („Neue", „Feuer"), nicht über Einzelfälle.
- **Fertig wenn:** alle deutschen Anzeigetexte echte Umlaute tragen, Wächter grün.

### T-M23-02 · Grammatik — Genus, Dativ, Numerus, doppelte Namen
- **Ziel:** Befunde V2-11/17 — „Sie können **es** jetzt bauen" (Genus), „nach 2
  **Tage**" (Dativ), „Vereinigte Staaten **erklärt**" (Numerus), Lage-Tabelle rendert
  den Machtnamen doppelt.
- **Anforderungen:** R-UI-07
- **Entwurf:** D24.6
- **Abhängigkeiten:** T-M23-01
- **Dateien:** `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/i18n/grammar.ts`,
  `apps/desktop/src/ui/Alerts.tsx`, `apps/desktop/src/game/events.ts`,
  `apps/desktop/src/ui/format.ts`, `apps/desktop/src/ui/Meter.tsx`,
  `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/App.tsx`
  *(der Genus-Satz entsteht in `Alerts.tsx`, nicht in `tutorial.ts`; der Dativ in
  `format.ts`/`App.tsx`, nicht in `fastForward.ts` — die Listen nennen die Orte, an
  denen tatsächlich gebaut wurde)*
- **Tests zuerst:** je gemessenem Fall ein Test, der gegen den alten Text fällt
  (`grammar.test.ts`, `Alerts.test.tsx`, `events.test.ts`, `format.test.ts`,
  `Standings.test.tsx`, `App.test.tsx`).
- **Fertig wenn:** eine kleine Genus/Numerus-Tabelle je Gebäude, Einheit und Macht
  speist die Sätze; die vier Fälle sind korrekt.

### T-M23-03 · AUS-SE bekommt einen ehrlichen Namen, der Markt sein Zeichen
- **Ziel:** die zwei verbliebenen vertagten Entscheidungen, am 2026-09-07 entschieden
  (DECISIONS.md): der Name lügt („Südostaustralien" ist das Hauptstadtterritorium plus
  Jervis Bay und Macquarie), und der Markt ist die letzte Liste ohne Zeichen.
- **Anforderungen:** R-MAP-01, R-UI-05
- **Entwurf:** D24.6
- **Abhängigkeiten:** keine
- **Dateien:** `data/maps/world.json`, `data/maps/world-shapes.json`,
  `data/mapgen/merge-rules.json`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/app.css`, `docs/plan/DECISIONS.md`
  *(der Name wird in Quelle, Zwischenstand und Produkt zugleich geändert — der
  Kartenneubau braucht die nicht eingecheckten Geodaten; Begründung in DECISIONS.md)*
- **Tests zuerst:** ein Test bindet den neuen Anzeigenamen über die ganze Baukette
  (`worldmap.test.ts`); das Marktzeichen am gerenderten Baum (`Panels.test.tsx`).
- **Fertig wenn:** der Name ehrlich ist (Zuschnitt bleibt, Anreicherung wird nicht neu
  gewürfelt) und der Markt das Zeichen des jeweils **gewählten** Rohstoffs neben der
  Liste zeigt — das `<select>` bleibt (T-M20-03 bestätigt).

---

## Meilenstein M24 — Die Tage bekommen Inhalt

> **Herkunft:** LEVEL-UP.md, Achse **Spiellogik**. Frage 50 des Abnahmebogens, ehrlich
> beantwortet: das *Was* ist geführt, das *Wozu* fehlt — und die Frühphase belohnt das
> Falsche, ohne es zu sagen. Entwurf: **D24**.

### T-M24-01 · Der Tagesbericht bekommt einen Körper
- **Ziel:** Befund V2-06 — „Tagesbericht für Tag 8." ist eine Überschrift ohne Körper.
  Zusammen mit den leeren Tagen 5–8 fühlt sich die Frühphase tot an.
- **Anforderungen:** R-TIME-06, R-UI-05
- **Entwurf:** D24.4
- **Abhängigkeiten:** T-M22-01
- **Dateien:** `apps/desktop/src/game/events.ts`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/app.css`
  *(Panels und Stylesheet kamen dazu: der aufklappbare Eintrag lebt im Protokoll —
  `EventEntry.body` und das `details/summary` gehören dorthin, nicht in die App)*
- **Tests zuerst:** der Körper an einem Tag mit bekannten Zahlen — fällt gegen den
  heutigen leeren Eintrag (`events.test.ts`); das Aufklappen am gerenderten Baum
  (`Panels.test.tsx`); die Verdrahtung über einen ganzen Spieltag (`App.test.tsx`).
- **Fertig wenn:** der Bericht aufklappbar trägt: Bilanz je Rohstoff (nur ≠ 0),
  Moralrichtung je eigener Provinz, fertige/laufende Aufträge, „morgen neu: X". Kein
  neues Kern-Ereignis — die Oberfläche liest den Zustand am Tageswechsel.

### T-M24-02 · Das Wozu — Punkte, Moralstrafe, zwei neue Führungsschritte
- **Ziel:** gemessen (PROBLEME.md „Der Einstieg ist enger…"): die Bevölkerung stellt
  98,6 % der Startpunkte, eine Eroberung wiegt 285 Kasernen, ab der dritten Provinz
  kostet jede weitere 3000 Zielmoral — nichts davon sagt das Spiel.
- **Anforderungen:** R-UI-18, R-UI-05
- **Entwurf:** D24.7
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/i18n/de.ts`,
  `apps/desktop/src/ui/Tutorial.tsx`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/ui/app.css`
  *(Tutorial.tsx, App und Stylesheet kamen dazu: das `why` wird als eigener Absatz
  gerendert, die Zahlen der Moralstrafe kommen zur Laufzeit aus den Regeln, und der
  Punkteschritt endet am geöffneten Lage-Panel — die Verdrahtung lebt in der App)*
- **Tests zuerst:** der bestehende Wächter `unlocks-explained` prüft das neue
  `why`-Feld mit (`test/guards/unlocks-explained.test.ts`); Reihenfolge und Auslöser
  der zwei neuen Schritte in `tutorial.test.ts`; das gerenderte Wozu und die
  eingesetzten Zahlen in `Tutorial.test.tsx`; die Verdrahtung über die Taste L in
  `App.test.tsx`; der Durchgang in `onboarding.slow.test.ts` (vier Klicks).
- **Fertig wenn:** jeder Führungsschritt einen Begründungssatz trägt; zwei neue
  Schritte erklären Punktequellen und Moralstrafe, **bevor** sie zum ersten Mal wirken.

### T-M24-03 · Das Kriegsmarsch-Paradox wird gemessen und entschieden
- **Ziel:** auf fremdem Boden Marschfaktor 0,7, im Krieg 0,35 — eine Kriegserklärung
  **halbiert** das Tempo; der schnellste Eröffnungszug ist der unangekündigte Überfall.
  Dazu Befund V2-15: Märsche von 14–31 Tagen dominieren die Frühphase.
- **Anforderungen:** R-BAT-04
- **Entwurf:** D24.8
- **Abhängigkeiten:** keine
- **Dateien:** `data/rules/default/constants.json`, `docs/plan/BALANCING.md`,
  `docs/plan/DECISIONS.md`, `docs/plan/PROBLEME.md`, `docs/reports/warmarch.json`
  *(der Pfad hieß im Plan `data/rules/constants.json` — die Regeln liegen unter
  `data/rules/default/`; die Rohzahlen des Messlaufs liegen als Bericht bei, PROBLEME.md
  verweist bei der Beobachtung auf die Entscheidung)*
- **Tests zuerst:** keine neuen — der Parameterlauf ist das Messgerät. Die Änderung
  selbst wies sich am Golden-Master nach: `walkthrough.json` fiel gegen den neuen Wert
  und wurde bewusst neu erzeugt (`UPDATE_GOLDEN=1`); `movement.test.ts` bindet die
  Konstante symbolisch und blieb grün.
- **Fertig wenn:** beide Varianten (0,35 gegen gemildert, Vorschlag 0,5) gemessen sind
  (Eroberungen, Kriegsdauer, Sieg-Tag), die Entscheidung mit Zahlen in DECISIONS.md
  steht und BALANCING.md den Eintrag trägt. Eine **Änderung** ist nur fertig, wenn der
  Golden-Master-Umgang begründet ist; ein Beibehalten ist als Ergebnis zulässig.

---

## Meilenstein M25 — Die Zahlen werden Bilder

> **Herkunft:** Noahs Auftrag vom 2026-09-08 nach der V1-Abnahme — *„wir wollen noch mehr
> weg vom Text und eher auf Grafiken setzen"* — fünf Vorschläge, alle fünf gewählt.
> Plan: `docs/plan/LEVEL-UP-2-GRAFIK.md`. Entwurf: **D25**. Dieses Kapitel: Vorschläge
> A (Machtverlauf) und B (Wirtschaft visuell).

### T-M25-01 · Die Partie bekommt ein Gedächtnis — Zeitreihe je Spieltag
- **Ziel:** Die Sicht kennt nur das Jetzt; für jeden Verlauf braucht die Hülle eine
  Aufzeichnung.
- **Anforderungen:** R-UI-13
- **Entwurf:** D25.1
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/game/saves.ts`
- **Tests zuerst:** die Aufzeichnung wächst je Tag genau um einen Eintrag; der Deckel
  hält; Speichern → Laden erhält sie. Alle fallen ohne die Reparatur.
- **Fertig wenn:** am Tageswechsel (derselbe Effekt-Ort wie der Tagesbericht) je
  bekannter Macht die Punkte und für die eigene Macht Bestände und Bilanzen in einen
  Ringpuffer mit Deckel geschrieben werden; der Puffer wandert je Spielstand-Slot in
  IndexedDB mit; ein alter Stand ohne Aufzeichnung beginnt die Kurve ehrlich am Ladetag.

### T-M25-02 · Der Machtverlauf wird eine Kurve
- **Ziel:** Vorschlag A — die spannendste Kurve des Spiels (wer führt, wer holt auf)
  existiert nirgends.
- **Anforderungen:** R-UI-13
- **Entwurf:** D25.2
- **Abhängigkeiten:** T-M25-01
- **Dateien:** `apps/desktop/src/ui/charts/LineChart.tsx`, `apps/desktop/src/ui/Standings.tsx`,
  `apps/desktop/src/ui/app.css`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
  *(die Kurve wurde ein eigener Baustein unter `ui/charts/`; `tokens.ts` blieb unberührt —
  die Spielerfarben kommen als Daten aus der Sicht, genau wie beim Farbfeld der Tabelle)*
- **Tests zuerst:** ein Test am gerenderten Baum bindet die Kurvenpfade an bekannte
  Reihen (`Standings.test.tsx`, `charts/LineChart.test.tsx`); die Verdrahtung über zwei
  Spieltage in `App.test.tsx`; der Querscroll-Wächter (T-M22-02) bleibt grün.
- **Fertig wenn:** das Lage-Panel über der Punktetabelle ein Liniendiagramm des
  Punkteverlaufs aller bekannten Mächte zeigt — eigene SVG-Komponente, **keine
  Fremdbibliothek**, Spielerfarben aus `tokens.ts`, Legende, aria-Beschreibung mit den
  Endwerten; der Leerzustand ohne Aufzeichnung sagt einen ehrlichen Satz.

### T-M25-03 · Die Wirtschaft zeigt Trend und Bilanz als Bild
- **Ziel:** Vorschlag B — sieben Rohstoffe × fünf Zahlenspalten; Trends muss man sich
  merken.
- **Anforderungen:** R-UI-05, R-UI-13
- **Entwurf:** D25.2
- **Abhängigkeiten:** T-M25-01
- **Dateien:** `apps/desktop/src/ui/charts/DeltaBar.tsx`, `apps/desktop/src/ui/charts/Sparkline.tsx`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/App.tsx`
  *(die Bausteine wurden eigene Komponenten unter `ui/charts/` — der DeltaBar wird in
  T-M25-04 wiederverwendet; die App reicht die Zeitreihe an das Wirtschaftspanel durch)*
- **Tests zuerst:** Balkenrichtung und Sparkline-Punkte an bekannte Werte gebunden
  (`Panels.test.tsx`, `charts/DeltaBar.test.tsx`, `charts/Sparkline.test.tsx`).
- **Fertig wenn:** jede Rohstoffzeile eine Sparkline der letzten sieben Tage (aus der
  Zeitreihe) und einen Bilanzbalken trägt (positiv grün, negativ zinnober, null als
  Strich; die Zahl bleibt daneben und bleibt der zugängliche Wert); die Tabelle bleibt
  in der Leiste (Wächter T-M22-02).

### T-M25-04 · Der Tagesbericht bekommt Balken
- **Ziel:** Der Körper des Tagesberichts (T-M24-01) nennt Bilanzen als Text.
- **Anforderungen:** R-UI-05
- **Entwurf:** D25.2
- **Abhängigkeiten:** T-M25-03
- **Dateien:** `apps/desktop/src/game/events.ts`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/app.css`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
  *(App und Stylesheet kamen dazu: die App heftet die Bilanz-Daten an den Eintrag, das
  Protokoll zeichnet sie; die alte Bilanz-Textzeile wurde zur Überschrift der Balkenliste)*
- **Tests zuerst:** am gerenderten Eintrag gebunden (`Panels.test.tsx`); die
  Delta-Daten und die verstummte Textzeile in `events.test.ts`.
- **Fertig wenn:** die Rohstoffzeilen des Berichts **dieselben** Delta-Balken nutzen wie
  die Wirtschaftstabelle — eine Komponente, zweimal verwendet, nicht zwei Kopien.

---

## Meilenstein M26 — Die Karte lebt

> **Herkunft:** LEVEL-UP 2, Vorschläge C (lebendige Karte) und E (Beziehungsmodus).
> Entwurf: **D25**. Leitplanke: das Zeichenbudget gilt weiter (p95 gegen 16,7 ms).

### T-M26-01 · Märsche werden Pfeile mit Fortschritt
- **Ziel:** Eine Bewegung ist heute eine gestrichelte Linie ohne Richtung und ohne
  Fortschritt.
- **Anforderungen:** R-MAP-05, R-UI-16
- **Entwurf:** D25.3
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/map/render.ts`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/map/markers.ts`, `apps/desktop/src/App.tsx`,
  `docs/reports/render-bench.json`
  *(die Marker tragen den Marsch jetzt samt Restroute; die App reicht sie durch — dafür
  entfiel die gestrichelte Vorschau der gewählten Armee samt `path`-Prop, D25.3 „ersetzt
  die gestrichelte Linie"; der Slow-Bench misst die Pfeile mit und schreibt die Zahl in
  den Bericht)*
- **Tests zuerst:** die Fortschrittsrechnung an bekannte Ticks gebunden — 0 % beim
  Abmarsch, ½ in der Mitte, voll bei Ankunft (`render.test.ts`, `MapCanvas.test.tsx`,
  `render.bench.slow.test.ts`).
- **Fertig wenn:** jede sichtbare marschierende Armee ihre Route als Pfad mit
  Pfeilspitze zeigt, der zurückgelegte Anteil gefüllt, der Rest blass; eigene Armeen in
  Tinte, fremde in Spielerfarbe. Danach Zeichenbudget nachmessen
  (`docs/reports/render-bench.json`).

### T-M26-02 · Kampf und Eroberung sind auf der Karte sichtbar
- **Ziel:** Ein Besitzwechsel ist ein harter Farbsprung, ein Kampf ein Ring fester
  Stärke.
- **Anforderungen:** R-MAP-05, R-UI-17
- **Entwurf:** D25.4
- **Abhängigkeiten:** T-M26-01
- **Dateien:** `apps/desktop/src/map/render.ts`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/ui/motion.ts`, `apps/desktop/src/map/modes.ts`
  *(die Mischformel `mixColors` der Kartenmodi wurde exportiert statt kopiert — die
  Welle blendet mit genau der Formel, aus der die Modi ihre Skalen mischen)*
- **Tests zuerst:** die Blendkurve an feste Zeitpunkte gebunden; der
  reduced-motion-Pfad geprüft (`motion.test.ts`); Besitzwechsel-Erkennung und
  Ringintensität rein gebunden (`render.test.ts`).
- **Fertig wenn:** ein Besitzwechsel als kurze Farbwelle läuft (~600 ms; bei
  `prefers-reduced-motion` sofortiger Wechsel) und die Kampfzone ihre Intensität nach
  Gefechtsgröße skaliert.

### T-M26-03 · Der fünfte Kartenmodus — Beziehungen
- **Ziel:** Vorschlag E — die Diplomatie wohnt nur in einer Tabelle, obwohl
  `PublicView.relations` je Macht Zustand und Dauer führt.
- **Anforderungen:** R-MAP-06
- **Entwurf:** D25.5
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/map/modes.ts`, `apps/desktop/src/ui/Legend.tsx`,
  `apps/desktop/src/ui/tokens.ts`, `apps/desktop/src/i18n/de.ts`,
  `apps/desktop/src/App.tsx`
  *(die App leitet je Provinz den Beziehungszustand aus Eigentümer und eigener
  Beziehungslage ab und reicht ihn als `relation` an die Schattierung; die Legende
  selbst blieb unverändert — sie liest `legendFor` wie bisher)*
- **Tests zuerst:** die Farbwahl je Beziehungszustand gebunden; die fünf Farben
  bestehen den ΔE-Farbabstandstest; der M-Zyklus erreicht den fünften Modus
  (`keyboard.test.ts`).
- **Fertig wenn:** `MAP_MODES` einen Modus `relations` kennt (eigen / verbündet /
  Frieden / Krieg / unbekannt aus eigener Sicht), die Legende alle fünf nennt und die
  Taste M ihn im Zyklus erreicht. Die Diplomatie-Tabelle bleibt.

---

## Meilenstein M27 — Das Gefecht zeigt sich

> **Herkunft:** LEVEL-UP 2, Vorschlag D. Entwurf: **D25**.

### T-M27-01 · Das Gefecht sammelt seine Zahlen für die Anzeige
- **Ziel:** Der Kern kennt Stärken, Verluste, Gelände und Festung — der
  Protokolleintrag nennt nur die Verluste.
- **Anforderungen:** R-BAT-05, R-UI-10
- **Entwurf:** D25.6
- **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/game/events.ts`, `packages/core/src/events/types.ts`,
  `packages/core/src/phases/combat.ts`
  *(die fehlenden Angaben — Stärken vorher/nachher, Gelände, Festungsstufe, Eingrabung,
  Rückzugssperre — kamen additiv als optionale Felder ans `BATTLE_RESOLVED`-Ereignis;
  alte Spielstände tragen sie nicht und ergeben ehrlich keinen Datensatz)*
- **Tests zuerst:** der Datensatz an ein Gefecht mit bekannten Zahlen gebunden — fällt
  ohne die Sammlung (`events.test.ts`, `combat.test.ts` für die neuen Ereignisfelder).
- **Fertig wenn:** je Gefecht ein Anzeigedatensatz entsteht (Stärke beider Seiten
  vorher/nachher, Verluste, Gelände, Festung, Eingrabung, Rückzugssperre), gespeist aus
  den BATTLE-Ereignissen plus der Sicht zum Ereigniszeitpunkt. Fehlende Angaben werden
  im Ereignis **additiv** ergänzt (kein Hash-Bruch, Golden-Master unberührt — sonst
  Entscheid in DECISIONS.md statt stillem Umbau).

### T-M27-02 · Das Gefecht zeigt sich — Stärkebalken und Zeichen
- **Ziel:** Vorschlag D — der Kampfbericht wird ein Bild.
- **Anforderungen:** R-BAT-05, R-UI-10
- **Entwurf:** D25.6
- **Abhängigkeiten:** T-M27-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/icons.tsx`,
  `apps/desktop/src/game/events.ts`
  *(zwei neue Zeichen — Stellungsbogen für die Eingrabung, gesperrter Pfeil für die
  Rückzugssperre — kamen in den Symbolsatz; `describeEvent` heftet den Datensatz aus
  T-M27-01 an den Protokolleintrag)*
- **Tests zuerst:** Balkenlängen und Zeichen an den Datensatz aus T-M27-01 gebunden —
  fällt gegen den heutigen Texteintrag (`Panels.test.tsx`, Anheftung in
  `events.test.ts`).
- **Fertig wenn:** der Protokolleintrag eines Gefechts einen aufklappbaren Körper trägt
  (Muster Tagesbericht): je Seite ein Stärkebalken vorher → nachher mit dem Verlust als
  zinnoberrotem Abschnitt, dazu Zeichen für Gelände, Festung, Eingrabung und
  Rückzugssperre aus dem bestehenden Symbolsatz; fürs Ohr eine Satzfassung (aria).

---

## Meilenstein M28 — Der Feinschliff nach dem Spielen

> **Herkunft:** LEVEL-UP 3 (`docs/plan/LEVEL-UP-3.md`), 2026-09-08 — die kritische
> Überprüfung nach der Grafikrunde. Entwurf: **D26**. Der **Haltepunkt** (gebaut wird
> erst nach Noahs Spiel-Feedback) ist am 2026-09-08 durch Noahs Freigabe aufgehoben;
> seine Befunde werden weiterhin als T-M28-06+ ergänzt.

### T-M28-01 · Die Kurve wird bei jeder Historienlänge lesbar
- **Ziel:** Sichtprüfung 2026-09-08 — acht Tage Historie ergeben flache, oben
  gedrängte Linien (Y-Skala ab 0, Punktestände im oberen Fünftel).
- **Anforderungen:** R-UI-13 · **Entwurf:** D26.1 · **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/charts/LineChart.tsx`,
  `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/i18n/de.ts`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** Skalengrenzen an bekannte Reihen gebunden — fällt gegen die 0-Basis
  (`LineChart.test.tsx`, `Standings.test.tsx`; Verdrahtung in `App.test.tsx`).
- **Fertig wenn:** Skala von min−Rand bis max+Rand, Endwert je Linie am rechten
  Rand, unter drei Punkten der ehrliche Wartesatz.

### T-M28-02 · Auch die Zielwahl quittiert sichtbar
- **Ziel:** Debugging 2026-09-08 — die Quittung hängt am „Marsch befehlen"-Knopf,
  der nach dem Bestätigen verschwindet; der Spieler sieht nichts.
- **Anforderungen:** R-UI-05 · **Entwurf:** D26.2 · **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** der volle Zielwahl-Weg am gerenderten Baum — fällt heute.
- **Fertig wenn:** die Quittung in der Armee-Statuszeile steht, gespeist aus
  `pendingCommands`.

### T-M28-03 · Frisches Bündel, AK-8 am echten Stand gemessen
- **Ziel:** `worldwar.exe` ist Stand `75a0128`; die AK-8-Messung beschreibt `1c33ec7`.
- **Anforderungen:** R-PKG-01, R-PKG-02 · **Entwurf:** D26.3 · **Abhängigkeiten:** keine
- **Dateien:** `docs/reports/packaging.md`, `apps/desktop/src-tauri/src/main.rs`,
  `apps/desktop/src-tauri/Cargo.toml`, `apps/desktop/src-tauri/capabilities/local-only.json`,
  `apps/desktop/src/storage/TauriStorage.ts`, `apps/desktop/package.json`,
  `docs/plan/PROBLEME.md`
- **Tests zuerst:** die Vertragsreihe des Ports gegen die Nachbildung der neuen
  Hüllen-Kommandos (`apps/desktop/src/storage/TauriStorage.test.ts`).
- **Fertig wenn:** Bau bei unangefasster Quelle; AK-8 (starten, speichern,
  schließen, neu starten, laden) am neuen Bündel; Stand-Stempel in `packaging.md`.
- **So kam es (2026-09-08):** Die Messung **brach** AK-8 am frischen Bündel — Schreiben
  ging, Wiederlesen war „forbidden path". Ursache (Falsifikationskette in PROBLEME.md):
  die Scope-Prüfung von `tauri-plugin-fs` kanonisiert existierende Pfade zur
  `\\?\C:\…`-Form, auf die kein Scope-Muster passt. Der Speicherweg läuft jetzt über
  **sechs eigene, engere Kommandos der Hülle** (Dateiname statt Pfad, fest auf
  `$APPDATA/saves`); das fs-Plugin samt Berechtigungen ist entfernt. Danach alle
  sieben Schritte grün, erstmals einschließlich „Weiterspielen (Tag 1)" am Programm.

### T-M28-04 · Die Debug-Ansicht spricht Namen
- **Ziel:** Befund V2-12 — das opt-in-Debug sagt „p2" und „money".
- **Anforderungen:** R-UI-07 · **Entwurf:** D26.4 · **Abhängigkeiten:** keine
- **Dateien:** `packages/ai/src/economy.ts`, `packages/ai/src/military.ts`,
  `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/App.tsx`
- **Tests zuerst:** ein Zieltext mit Namen gebunden (`Dialogs.test.tsx`); der
  Umlaut-Wächter deckt die KI-Debug-Strings mit ab (`test/guards/text-keys.test.ts`).
- **Fertig wenn:** Macht- und Rohstoffnamen aus derselben Quelle wie die übrige
  Oberfläche; die Übersetzung passiert in der Anzeige, die KI bleibt englisch.

### T-M28-05 · Die Wirtschaft sagt, wohin die Rohstoffe gehen
- **Ziel:** v1-Befund 15, nie adressiert — Bau-, Aushebungs- und Marktkosten
  erscheinen in keiner Übersicht; seit den Sparklines fällt der Bestand sichtbar,
  ohne dass eine Spalte sagt warum.
- **Anforderungen:** R-UI-05, R-UI-13 · **Entwurf:** D26.5 · **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/events.ts`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/App.tsx`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** die Ausgaben-Auskunft an einen Tag mit bekannten Ausgaben gebunden
  (`Panels.test.tsx`, `events.test.ts` für `dayExpenses`).
- **Fertig wenn:** ein Tagesabfluss „Ausgaben" steht neben dem Unterhalt, aus
  denselben Zahlen wie der Tagesbericht — im D24.2-Stil (Zahl mit Titel in der
  Unterhalt-Zelle), damit der Querscroll-Wächter aus T-M22-02 bindend bleibt.

### T-M28-06 · Der Einmarsch schlägt Alarm *(vorgemerkt)*
- **Ziel:** Noahs Spiel-Feedback 2026-09-08 — man kriegt es kaum mit, wenn feindliche
  Truppen in eigene Gebiete einlaufen.
- **Anforderungen:** R-TIME-06, R-UI-05 · **Entwurf:** D26
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/game/events.ts`, `apps/desktop/src/App.tsx`
- **Tests zuerst:** das Einmarsch-Ereignis löst Banner, Hervorhebung und
  Vorspul-Stopp aus — je Art, nicht je Beispiel.
- **Fertig wenn:** der Einmarsch ein deutliches Signal trägt (Alarmbanner mit
  Provinznamen, Karten-Hervorhebung, Ton, `log--self`) und das Vorspulen anhält.
  Entwurfsfrage vorab: welches Kern-Ereignis ihn trägt (additiv, ohne
  Golden-Master-Bruch).

### T-M28-07 · Angriff und Verteidigung führen sich selbst aus *(vorgemerkt)*
- **Ziel:** Noahs Spiel-Feedback 2026-09-08 — Angriffs-/Verteidigungsszenarien sollen
  die Truppen automatisch ausführen; heute verlangt jedes Gefecht Mikromanagement.
- **Anforderungen:** R-BAT-03, R-UI-05 · **Entwurf:** D26 (nachzutragen)
- **Abhängigkeiten:** T-M28-06
- **Dateien:** `docs/plan/LEVEL-UP-3.md`
- **Tests zuerst:** erst nach der Analyse — dieser Eintrag ist die Vormerkung.
- **Fertig wenn:** die Analyse geklärt hat, was konkret fehlt (Verteidiger marschieren
  selbsttätig zur bedrohten eigenen Provinz in Reichweite? Haltung Angriff verfolgt?
  Garnisonshaltung?), der Entwurf in LEVEL-UP-3.md steht und die Aufgabe in
  Teilaufgaben mit begründetem Golden-Master-Umgang geschnitten ist.

### T-M28-08 · Kämpfe werden ein Ereignis *(vorgemerkt)*
- **Ziel:** Noahs Spiel-Feedback 2026-09-08 — die Kämpfe sind noch zu unspektakulär.
- **Anforderungen:** R-MAP-05, R-UI-17 · **Entwurf:** D26
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/map/render.ts`, `apps/desktop/src/ui/sound.ts`
- **Tests zuerst:** Kampfdarstellung skaliert mit der Gefechtsgröße; der
  reduced-motion-Pfad bleibt ruhig.
- **Fertig wenn:** ein laufendes Gefecht auf der Karte unübersehbar ist (kräftigere
  Kampfzone, Aufblitzen je Runde, Einschlagzeichen), eigene Gefechte einen Ton
  auslösen und das Zeichenbudget hält. **Maßstab: im Vorspulen fällt ein Krieg auf,
  ohne dass man das Protokoll liest.**


---

## Meilenstein M29 — Kriegsrat: das Aussehen

> **Herkunft:** KRIEGSRAT (`docs/plan/KRIEGSRAT.md`), 2026-09-10 — Noahs Wahl der
> Designrichtung A „Kriegsrat" aus drei Entwürfen, plus Abgleich mit Supremacy WW3.
> Entwurf: **D27**, Bild in `docs/design/kriegsrat.html`, Symbole in
> `docs/design/kriegsrat-icons.svg`. **Der bauende Agent liest KRIEGSRAT.md §0 zuerst.**

### T-M29-01 · Die dunkle Token-Ebene mit Spiegel-Wächter
- **Ziel:** Kriegsrat ist zuerst ein Token-Wechsel — aber die Farben stehen doppelt
  (`tokens.ts:13-38` und `app.css:51-73`), und nichts hält sie zusammen.
- **Anforderungen:** R-UI-02, R-UI-04 · **Entwurf:** D27.1 · **Abhängigkeiten:** keine
- **Dateien:** `apps/desktop/src/ui/tokens.ts`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/map/render.ts`, `apps/desktop/src/map/modes.ts`,
  `test/guards/css-mirrors-tokens.test.ts`
- **Tests zuerst:** der Spiegel-Wächter (jeder Hex in `app.css :root` ↔ `tokens.ts`),
  bewiesen an einer verstimmten Fixture; dann `tokens.contrast.test.ts` mit den neuen
  Paaren (`onWarn` auf `warn`, `building` auf `ground`, `line` auf `paper` 3 : 1).
- **Fertig wenn:** die Werte aus D27.1 an beiden Orten stehen, `onWarn` und `building`
  existieren, die elf Spielerfarben dunkel sind und ΔE > 10 halten, `RELATION_COLORS`
  `self = good`, `war = accent`, `ally = #6FA8DC`, `MAP_COLORS` folgt, kein Aufrufer
  sich ändert und das Spiel im Browser dunkel ist.

### T-M29-02 · Kopf- und Ressourcenleiste im Kriegsrat-Stil
- **Ziel:** Uhr, Tempo und Ressourcen tragen das neue Bild; ein Alarmchip-Slot wartet
  auf T-M28-06.
- **Anforderungen:** R-UI-03, R-TIME-04, R-UI-10 · **Entwurf:** D27.1, D27.2
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/icons.tsx`
- **Tests zuerst:** Tempo-Gruppe trägt genau ein `aria-pressed="true"` und schaltet per
  Klick; die Tagesbilanz trägt ihr Vorzeichen im Text (`Header.test.tsx`).
- **Fertig wenn:** Uhr in `TYPE.num`/`warn`, Tempo als Knopfgruppe (Pause · Laufen ·
  Vorspulen), Ressourcen mit Symbol, Bestand, Bilanz (Vorzeichen **und** Farbe),
  Reichweite im `title`, leerer Alarmchip-Slot (`hidden`), Kartenmodus als Knopfgruppe;
  Tasten unverändert.

### T-M29-03 · Das Provinzpanel bekommt das Bauplatz-Raster
- **Ziel:** Gebäude als Liste sagen nicht, was frei ist und was wann fertig wird.
- **Anforderungen:** R-UI-09, R-UI-10, R-UI-11 · **Entwurf:** D27.6
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** je `BuildingKey` genau ein Feld; ein Bau in der Schlange trägt den
  Fortschritt als Breite und `aria-valuenow` (`Panels.test.tsx`).
- **Fertig wenn:** Raster in vier Spalten (gebaut · im Bau mit Fortschritt und Resttagen ·
  frei mit Bau-Aktion), Moral mit Tendenz aus `morale` gegen `moraleTarget` und zehn
  Segmenten, Gelände mit Bonus-Text.

## Meilenstein M30 — Kriegsrat: die Karte zeigt den Zustand

> **Erst messen, dann ändern.** Vor jeder Aufgabe `render.bench` p95 notieren (Stand
> 2026-09-08: 5,39 ms), nach jeder Aufgabe wieder — Maschine allein.

### T-M30-01 · Armeen sind Stapel mit Zahl und Zustand
- **Ziel:** Noahs Lob galt den NATO-Markern; die Karte zeigt heute Kasten ohne Zahl.
- **Anforderungen:** R-MAP-05, R-UI-10, R-UI-12 · **Entwurf:** D27.2
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/map/markers.ts`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/icons.tsx`
- **Tests zuerst:** `count` und `condition` je Marker aus einer Sicht mit zwei Klassen
  (`markers.test.ts`); Bench danach (`render.bench.slow.test.ts`).
- **Fertig wenn:** Rechteck 30×18 mit Rahmen in Besitzerfarbe, Zahl (Σ `unitCount`),
  Glyphe der dominanten Klasse, 3-px-Zustandsbalken, Trefferfläche ≥ 24 px, Marker als
  Offscreen-Stempel; p95 < 16,7 ms mit 8 Spielern auf der Weltkarte.

### T-M30-02 · Gebäude stehen verteilt in der Provinz
- **Ziel:** Gebäude gehören auf die Karte, „so als wären sie in der Provinz verteilt".
- **Anforderungen:** R-MAP-05, R-UI-10, R-UI-12 · **Entwurf:** D27.3
- **Abhängigkeiten:** T-M30-01
- **Dateien:** `apps/desktop/src/map/anchors.ts`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/map/markers.ts`, `apps/desktop/src/App.tsx`
- **Tests zuerst:** kein Anker außerhalb des Polygons, keine zwei näher als 14, gleiche
  Eingabe → gleiche Anker (`anchors.test.ts`); Bench vorher/nachher.
- **Fertig wenn:** Anker deterministisch aus `polygons`/`center`, Hafen und Werft am
  Rand, je Gebäude ein 14×14-Quadrat mit Glyphe in `building`, Stufe ≥ 2 als Ziffer, die
  Pips entfallen.

### T-M30-03 · Drei Zoomstufen, Knöpfe und Übersichtskarte
- **Ziel:** Zoom gibt es, aber ohne Knöpfe, ohne Schwellen und ohne Überblick.
- **Anforderungen:** R-UI-12, R-UI-15, R-ARCH-06 · **Entwurf:** D27.4
- **Abhängigkeiten:** T-M30-02
- **Dateien:** `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/map/picking.ts`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/keyboard.ts`,
  `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** `zoomTier(scale)` an den Schwellen 0,5 und 1,0; Knöpfe rufen
  `zoomAt`/`centreOn` (`picking.test.ts`, `MapCanvas.test.tsx`).
- **Fertig wenn:** Gebäude ab mittel, Namen und Moralringe ab nah, Stapel immer; Knöpfe
  `+ − ◎` mit `aria-label` und Tasten; Übersichtskarte 132×74 mit Ausschnitt in `warn`;
  Weltansicht nicht teurer als vor T-M30-01. Fällt der Zeitplan, fällt die Übersichtskarte.

### T-M30-04 · Der Marschweg zeigt Stand und Rest
- **Ziel:** ein Pfeil sagt nicht, wie weit die Armee ist und wann sie ankommt.
- **Anforderungen:** R-MAP-05, R-UI-12 · **Entwurf:** D27.5
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/map/render.ts`, `apps/desktop/src/map/MapCanvas.tsx`
- **Tests zuerst:** Segmentgrenze bei `marchProgress`; Tagesangabe rundet auf;
  reduced-motion ändert nichts (`render.test.ts`).
- **Fertig wenn:** gelaufen 3 px rund, Rest 1,6 px gestrichelt mit Spitze, Standpunkt
  r 3,5, „n/m T" in `TYPE.num` ab Stufe mittel.

## Meilenstein M31 — Kriegsrat: Panels, Protokoll, Fuß

### T-M31-01 · Die Provinz erklärt sich im Tooltip
- **Ziel:** Supremacy erklärt jede Provinz beim Zeigen; wir nur im Panel.
- **Anforderungen:** R-UI-11, R-UI-15, R-UI-12 · **Entwurf:** D27.6
- **Abhängigkeiten:** T-M30-03
- **Dateien:** `apps/desktop/src/ui/Tooltip.tsx`, `apps/desktop/src/map/MapCanvas.tsx`,
  `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** Tooltip erscheint für die per Tastatur gewählte Provinz ohne Maus;
  Inhalt aus der Sicht, nicht aus dem Zustand (`Tooltip.test.tsx`, `MapCanvas.test.tsx`).
- **Fertig wenn:** `role="tooltip"` mit Name, Land, Moral, Gelände, Besitzer,
  Armeen/Verteidiger, Gefechtsrunde, Bedienhinweis; entprellt 120 ms; Escape schließt.

### T-M31-02 · Das Armeepanel trägt Marker, Zustand und Haltungsgruppe
- **Ziel:** dieselben Marker wie auf der Karte, dieselbe Sprache im Panel.
- **Anforderungen:** R-UI-05, R-UI-10, R-UI-17 · **Entwurf:** D27.6
- **Abhängigkeiten:** T-M30-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`,
  `apps/desktop/src/ui/icons.tsx`
- **Tests zuerst:** genau ein `aria-pressed="true"` in der Haltungsgruppe; Marker je
  Klasse mit Zahl; Seitenleiste scrollt nicht quer (`Panels.test.tsx`).
- **Fertig wenn:** Einheitenzeile aus NATO-Markern, Kampfkraft mit Zustand-Prozent und
  Balken, Haltung als Dreiergruppe, Befehle zweispaltig mit Icon, Hauptaktion in `warn`.

### T-M31-03 · Der Fuß: Protokoll, Rangliste, drei Knöpfe
- **Ziel:** die Rangliste ist nur ein Panel, die Depesche hat keinen festen Platz.
- **Anforderungen:** R-UI-13, R-UI-14, R-UI-03 · **Entwurf:** D27.6
- **Abhängigkeiten:** T-M29-02
- **Dateien:** `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Foot.tsx`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Standings.tsx`,
  `apps/desktop/src/ui/app.css`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** Neu-Marke zählt und wird beim Öffnen null; Rangliste zeigt die eigene
  Zeile immer (`Foot.test.tsx`, `Panels.test.tsx`, `App.test.tsx`).
- **Fertig wenn:** dreiteiliger Fuß — Protokoll mit Zeitspalte und Icon, Rangliste
  dauerhaft (eigene Zeile in `warn`), Knöpfe Depesche · Diplomatie/Markt · Rangliste/Sieg.

### T-M31-04 · Der Machtverlauf zeigt drei Linien mit Legende
- **Ziel:** acht gleichwertige Linien sagen weniger als drei benannte.
- **Anforderungen:** R-UI-13 · **Entwurf:** D27.6
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/ui/charts/LineChart.tsx`, `apps/desktop/src/ui/Standings.tsx`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** Auswahl der drei Reihen aus einer Sicht mit acht Mächten; Legende
  nennt genau drei Namen (`LineChart.test.tsx`, `Standings.test.tsx`).
- **Fertig wenn:** eigen in `good` mit Fläche, stärkster Feind in `accent`, stärkster
  Verbündeter in `ally`, übrige dünn in `inkSoft`, Endpunkt markiert.

## Meilenstein M32 — Kriegsrat: Lücken zu Supremacy *(Freigabe durch Noah vor Bau)*

> M32 ist der einzige Meilenstein dieses Plans, der den Kern berührt (T-M32-01). Er wird
> erst nach Noahs ausdrücklicher Freigabe gebaut; T-M32-02 und T-M32-03 sind kernfrei.

### T-M32-01 · Der Abmarsch lässt sich verzögern *(Freigabe vor Bau)*
- **Ziel:** Supremacy kennt den verzögerten Abmarsch; bei uns marschiert jede Armee sofort.
- **Anforderungen:** R-ARCH-02, R-UI-05 · **Entwurf:** D27
- **Abhängigkeiten:** T-M31-02
- **Dateien:** `packages/core/src/commands/types.ts`, `packages/core/src/commands/move.ts`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** Ankunft verschiebt sich exakt um n Tage (`movement.test.ts`); alte
  Kommandologs ohne das Feld verhalten sich identisch (`determinism.test.ts`).
- **Fertig wenn:** `MOVE_ARMY.departInTicks` optional und additiv, Bewegungsphase startet
  erst dann, halbe Kampfkraft ab tatsächlichem Abmarsch, Stepper im Panel, ein Lauf über
  eine ganze Partie bleibt grün.

### T-M32-02 · Der Markt zeigt den Preisverlauf
- **Ziel:** Supremacys Börse zeigt Kurse; unser Markt nur den Moment.
- **Anforderungen:** R-UI-09, R-UI-13 · **Entwurf:** D27
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/events.ts`,
  `apps/desktop/src/ui/charts/Sparkline.tsx`
- **Tests zuerst:** drei Ausführungen an zwei Tagen ergeben zwei Punkte mit dem
  Tagesmittel (`events.test.ts`).
- **Fertig wenn:** je Rohstoff eine Sparkline aus `TRADE_EXECUTED` mit letztem Wert im
  Marktpanel; keine Kernänderung.

### T-M32-03 · Entscheid zu Durchmarsch, Provinzhandel und Forschung
- **Ziel:** drei Supremacy-Elemente sind Mechanik, nicht Oberfläche — sie brauchen einen
  Entscheid, keinen Bau.
- **Anforderungen:** keine · **Entwurf:** D27 · **Abhängigkeiten:** keine
- **Dateien:** `docs/plan/DECISIONS.md`
- **Tests zuerst:** keine (Entscheid).
- **Fertig wenn:** je Punkt entweder Aufgabe mit Meilenstein vorgemerkt oder mit
  Begründung gestrichen.

## Meilenstein M33 — Einheiten und Gebäude bekommen Bilder

> Noahs Wahl vom 2026-09-11 nach zwei Entwurfsrunden: Richtung **B „Schattenriss"**, für
> Einheiten **und** Gebäude, eingefärbt nach Besitzerfarbe, Infanterie als **Mann**.
> Der Bauplan steht in `docs/plan/EINHEITSBILDER.md`, die siebzehn fertigen Zeichnungen in
> `docs/design/einheiten-bilder.html`. **M33 berührt den Kern nicht** und hängt an keiner
> offenen Aufgabe aus M28 oder M32 — es kann vor oder nach ihnen gebaut werden.

### T-M33-01 · Der Bildsatz zieht in den Code ein
- **Ziel:** siebzehn Zeichnungen als zweiter Satz neben `icons.tsx`, und ein Wächter, der
  sie deckt — sonst entsteht das größte Asset-Loch des Projekts.
- **Anforderungen:** R-ASSET-01, R-ASSET-02, R-UI-04 · **Entwurf:** D27 (Abschnitt D33 in
  `EINHEITSBILDER.md`)
- **Abhängigkeiten:** T-M29-01
- **Dateien:** `apps/desktop/src/ui/art.tsx`, `apps/desktop/src/ui/tokens.ts`
- **Tests zuerst:** jede Einheit und jedes Gebäude hat genau ein Bild, keines doppelt
  vergeben, jede Zeichnung hat `body` **und** `cut` (`art.test.tsx`); `art.tsx` wird wie
  `icons.tsx` geprüft und fällt gegen eine leere Menge (`no-foreign-assets.test.ts`);
  drei neue Kontrastpaare gegen `paperSunk` (`tokens.contrast.test.ts`).
- **Fertig wenn:** `ART`, `UNIT_ART`, `BUILDING_ART` und `UnitArt` stehen; **und** der
  vacuous gewordene Koordinatentest in `icons.test.tsx` ist durch eine echte Pfadabfahrt
  ersetzt, die vorher rot werden konnte (Risiko 7).

### T-M33-02 · Die Rekrutierungsliste zeigt Bilder
- **Ziel:** die Liste, aus der ausgehoben wird, ist der Ort mit dem größten Gewinn.
- **Anforderungen:** R-UI-03, R-UI-04 · **Entwurf:** D27
- **Abhängigkeiten:** T-M33-01
- **Dateien:** `apps/desktop/src/game/actions.ts`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/app.css`
- **Tests zuerst:** je Einheit genau ein Bild; A11y-Name bleibt wortgleich; Klickziel
  bleibt ≥ 24 px (`Panels.test.tsx`, `actions.test.ts`).
- **Fertig wenn:** `ActionSpec.art` optional gesetzt, `icon` unberührt, keine
  Kernänderung.

### T-M33-03 · Das Bauplatzraster zeigt Gebäudebilder
- **Ziel:** Rekrutierungsliste und Bauplatzraster stehen nebeneinander und sollen nicht
  wie zwei Programme aussehen.
- **Anforderungen:** R-UI-03, R-UI-04 · **Entwurf:** D27
- **Abhängigkeiten:** T-M33-01
- **Dateien:** `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** sieben Felder zeigen sieben verschiedene Bilder; der Zustandswechsel
  ändert das Bild nicht (`Panels.test.tsx`).
- **Fertig wenn:** alle drei Feldzustände tragen dasselbe Bild, die Stufenzahl bleibt
  sichtbar und hörbar, und der Pfadvergleich gegen `ICON_PATHS` ist angepasst statt
  gelockert.

### T-M33-04 · Das Plättchen bekommt eine Bildfassung
- **Ziel:** Armee- und Rangliste tragen Bilder, die Karte behält ihre Glyphe.
- **Anforderungen:** R-UI-04, R-UI-10 · **Entwurf:** D27
- **Abhängigkeiten:** T-M33-01, T-M31-02
- **Dateien:** `apps/desktop/src/ui/UnitMarker.tsx`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/ui/app.css`
- **Tests zuerst:** eigenes Plättchen `good`, verbündetes `ally`, feindliches `accent`;
  `MapCanvas` stempelt weiter `ICON_PATHS` (`MapCanvas.test.tsx`).
- **Fertig wenn:** Rahmen, Farbe und Zahlstellung unverändert — nur die Füllung wechselt.

### T-M33-05 · Abnahme M33
- **Ziel:** der Meilenstein wird geschlossen, nicht liegen gelassen.
- **Anforderungen:** keine · **Entwurf:** D27
- **Abhängigkeiten:** T-M33-02, T-M33-03, T-M33-04
- **Dateien:** `docs/plan/PROGRESS.md`, `docs/plan/WORKFLOW.md`,
  `docs/plan/EINHEITSBILDER.md`
- **Tests zuerst:** keine neuen; `render.bench.slow.test.ts` wird bei freier Maschine
  nachgemessen.
- **Fertig wenn:** `pnpm verify` grün, Zeichenbudget festgehalten, Sichtprüfung im
  laufenden Spiel, PROGRESS/WORKFLOW fortgeschrieben und D33-a bis D33-c in
  `DECISIONS.md`.

## Meilenstein M34 — Der Fortschritt bekommt eine Strecke

> **Der Befund in einem Satz:** die Uhr läuft mit einem Tick je Sekunde, ein Spieltag hat
> vierundzwanzig Ticks, und die letzte Freischaltung liegt auf Spieltag 16 — die ganze
> Fortschrittsachse ist nach **6,4 Minuten Echtzeit** vorbei, während die Partie bis
> Spieltag 798 läuft. Die Tage stammen aus dem Vorbild, wo ein Spieltag ein echter Tag ist.
>
> Noahs Wahl vom 2026-09-11: strecken, an Gebäudestufen binden, Stufen teurer machen,
> Startvorrat senken, nächste Freischaltung sichtbar machen. Der Bauplan mit Zahlen,
> Selbstkritik und dem Verworfenen: `docs/plan/FORTSCHRITT.md`.
>
> **M34 ändert `data/rules` viermal.** Jede dieser Änderungen macht die Abnahme rot, bis
> Parameterlauf und Turnier neu gelaufen **und eingecheckt** sind. Und der Golden-Master
> wird sich verschieben — das ist erwartet, aber nur als bewusster Akt.

### T-M34-01 · Der Ausgangswert wird gemessen
- **Ziel:** „Erst messen, dann ändern" — ohne Ausgangswert ist jede spätere Verbesserung
  eine Behauptung.
- **Anforderungen:** keine · **Abhängigkeiten:** keine
- **Dateien:** `docs/reports/progress-baseline.md`
- **Tests zuerst:** keine neuen; `sweep.slow.test.ts` und `tournament.slow.test.ts` laufen
  auf dem heutigen Regelstand, Maschine allein.
- **Fertig wenn:** die vier Kennzahlen der Analyse und der Wirtschafts-Ist-Stand
  (wann erreicht eine mittlere Macht Fabrik Stufe 3) im Bericht stehen.

### T-M34-02 · R-TECH-01 wird begründet geändert
- **Ziel:** die Tage des Vorbilds sind als *belegt* festgeschrieben; sie zu strecken ist
  eine Abweichung und braucht eine Begründung, keine stille Zahlenänderung.
- **Anforderungen:** R-TECH-01
- **Abhängigkeiten:** T-M34-01
- **Dateien:** `docs/plan/01-REQUIREMENTS.md`, `docs/plan/DECISIONS.md`,
  `docs/plan/BALANCING.md`
- **Tests zuerst:** keine (Entscheid).
- **Fertig wenn:** die Anforderung die neue Zeitrechnung trägt, BALANCING.md die Tage von
  *belegt* auf *abgeleitet* umstuft und `pnpm coverage:requirements` weiter
  `V1 offen: 0` meldet.

### T-M34-03 · Die Freischaltungsleiter wird gestreckt
- **Ziel:** die letzte Freischaltung liegt bei etwa Spieltag 80 statt 16.
- **Anforderungen:** R-TECH-01
- **Abhängigkeiten:** T-M34-02
- **Dateien:** `data/rules/default/units.json`, `data/rules/default/buildings.json`,
  `docs/plan/BALANCING.md`
- **Tests zuerst:** die Leiter ist je Klasse monoton; kein Gebäude wird später frei als die
  Einheit, die es verlangt (`availability.test.ts`).
- **Fertig wenn:** Reihenfolge unverändert, Abstände gewachsen, Kaserne und Infanterie auf
  Tag 1 geblieben, Golden-Master bewusst neu erzeugt.

### T-M34-04 · Gebäudestufen kosten und dauern mehr
- **Ziel:** die zweite Fortschrittsachse ist heute keine — `build.ts` zieht denselben Preis
  für Stufe 3 wie für Stufe 1 ab.
- **Anforderungen:** R-PROV-01, R-PROV-02
- **Abhängigkeiten:** T-M34-01
- **Dateien:** `packages/core/src/commands/build.ts`,
  `packages/core/src/phases/construction.ts`, `packages/core/src/rules/types.ts`,
  `packages/core/src/rules/load.ts`, `data/rules/default/constants.json`,
  `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** Stufe 1 unverändert, Stufe 3 kostet das 3,24-fache und dauert das
  2,25-fache; ein Auftrag, der für Stufe 1 reicht, wird für Stufe 3 abgelehnt
  (`construction.test.ts`).
- **Fertig wenn:** zwei neue Konstanten greifen, das Bauplatz-Raster den Preis der
  **nächsten** Stufe zeigt und der Golden-Master begründet neu steht.

### T-M34-05 · Starke Einheiten verlangen höhere Gebäudestufen
- **Ziel:** Fortschritt, den man baut, statt Fortschritt, der vergeht.
- **Anforderungen:** R-UNIT-02, R-TECH-01
- **Abhängigkeiten:** T-M34-03, T-M34-04
- **Dateien:** `data/rules/default/units.json`, `docs/plan/BALANCING.md`
- **Tests zuerst:** die Ablehnung nennt Gebäude **und** Stufe; mit der Stufe darunter wird
  derselbe Auftrag abgelehnt (`validate.test.ts`).
- **Fertig wenn:** genau drei Einträge geändert sind — mehr wäre eine Sperre, keine Achse.

### T-M34-06 · Der Startvorrat schrumpft
- **Ziel:** die ersten Tage sollen von der Produktion handeln, nicht vom Lagerabbau.
- **Anforderungen:** R-ECON-01
- **Abhängigkeiten:** T-M34-01
- **Dateien:** `data/rules/default/resources.json`, `docs/plan/BALANCING.md`
- **Tests zuerst:** eine frische Partie trägt die neuen Werte und bleibt in den ersten zehn
  Tagen handlungsfähig (`create.test.ts`, `economy-scale.test.ts`).
- **Fertig wenn:** `startAmount` je Rohstoff auf zwei Dritteln steht — nicht darunter.

### T-M34-07 · Nachmessen und nachjustieren
- **Ziel:** vier Zahlenänderungen auf einmal lassen sich hinterher nicht auseinanderhalten.
- **Anforderungen:** keine
- **Abhängigkeiten:** T-M34-03, T-M34-04, T-M34-05, T-M34-06
- **Dateien:** `docs/reports/progress-baseline.md`, `docs/reports/balance-sweep.md`,
  `docs/reports/ai-tournament-run.md`
- **Tests zuerst:** keine neuen; die drei Langläufe **nach jeder** der vier Zahlenaufgaben.
- **Fertig wenn:** der Vergleich gegen T-M34-01 steht und der Siegtag zwischen 300 und 1500
  liegt — sonst nachjustieren und erneut messen.

### T-M34-08 · Die nächste Freischaltung wird sichtbar
- **Ziel:** Fortschritt, den man nicht sieht, motiviert nicht.
- **Anforderungen:** R-TECH-02, R-UI-13 · **Entwurf:** D27
- **Abhängigkeiten:** T-M33-02, T-M34-03
- **Dateien:** `apps/desktop/src/game/actions.ts`, `apps/desktop/src/ui/Panels.tsx`,
  `apps/desktop/src/ui/app.css`, `apps/desktop/src/i18n/de.ts`
- **Tests zuerst:** an Tag 20 nennt die Zeile die nächste Sache und die richtige Zahl von
  Tagen; am Tag der Freischaltung wechselt sie; nach der letzten verschwindet sie
  (`Panels.test.tsx`).
- **Fertig wenn:** die Zeile am Kopf der Rekrutierungsliste steht, mit Bild aus M33.

## Meilenstein M35 — Der lange Mittelteil bekommt Ziele *(Entwurf zuerst)*

> Zwischen Spieltag 20 und Spieltag 700 sagt dem Spieler niemand, ob er vorankommt. Es gibt
> genau eine Schwelle, und die liegt bei siebzig Prozent Punktanteil.

### T-M35-01 · Entwurf der Zwischenziele zum Sieg
- **Ziel:** der Punkt braucht neue Mechanik und berührt eine V1-Zusage — also erst ein
  Entwurf, dann der Schnitt in Aufgaben. Muster: T-M28-07.
- **Anforderungen:** keine
- **Abhängigkeiten:** T-M34-07
- **Dateien:** `docs/plan/FORTSCHRITT.md`, `docs/plan/DECISIONS.md`
- **Tests zuerst:** keine (Entwurf).
- **Fertig wenn:** feststeht, welche Ziele der Zustand schon trägt, was ein neues Feld
  bräuchte, und die Teilaufgaben geschnitten sind — mit Umgang für Golden-Master und
  R-GAME-02.
