---
type: plan
status: draft
projekt: WorldWar (Supremacy-WW3-Klon, Singleplayer)
stufe: 2 von 3 (Design)
created: 2026-09-02
---

# 02 — DESIGN

> **Für Agenten:** Dieses Dokument legt das *Wie* fest. Es ist verbindlich: Wo hier eine
> Formel, ein Typ oder ein Dateiname steht, wird genau das gebaut. Abweichungen sind erlaubt,
> müssen aber in `docs/plan/DECISIONS.md` als neuer Eintrag begründet werden.
> Bezug: Anforderungs-IDs aus `01-REQUIREMENTS.md` stehen in Klammern.

## D0. Leitentscheidungen

| ID | Entscheidung | Begründung | Verworfene Alternative |
|---|---|---|---|
| D-01 | **Monorepo mit pnpm-Workspaces**, Simulationskern als eigenes Package ohne UI-Abhängigkeit | erzwingt die Trennung aus R-ARCH-01 auf Werkzeugebene; Kern ist im Headless-Runner und später im Multiplayer-Server wiederverwendbar | Einzelnes Vite-Projekt — Kern und UI verwachsen erfahrungsgemäß |
| D-02 | **Festkomma-Arithmetik (Integer, Skalierung 1/1000)** für alle Spielgrößen | garantiert bit-identische Ergebnisse über Maschinen und Browser hinweg (R-ARCH-01, Vorbereitung Lockstep-Multiplayer R-ARCH-04) | Gleitkomma — auf einer Maschine reproduzierbar, aber fragil bei Refactorings und plattformübergreifend riskant |
| D-03 | **Simulation läuft in einem Web Worker**, UI im Hauptthread | 1000-facher Zeitraffer (R-TIME-02) darf die Oberfläche nicht blockieren | Simulation im Hauptthread — bei hohem Tempo ruckelt die Karte |
| D-04 | **Zustand ist reines JSON** (keine Klassen, keine Referenzen, keine `Map`/`Set` im Zustand) | Speichern/Laden (R-GAME-03) und Hashing werden trivial und verlustfrei | Klassenbasiertes Modell mit Serialisierungsschicht — mehr Code, mehr Fehlerquellen |
| D-05 | **Kartenrendering mit Canvas 2D + `Path2D`**, Ebenen getrennt und zwischengespeichert | bei ~200 Provinzen mühelos 60 FPS (R-ARCH-06), deutlich einfacher als WebGL | WebGL/deck.gl — Mehraufwand ohne Nutzen in dieser Größenordnung |
| D-06 | **Tauri v2** mit deaktivierten Netzwerkberechtigungen und strenger CSP | erfüllt R-FREE-04 auf Plattformebene statt per Konvention | Electron — größer, mehr Angriffsfläche, kein Vorteil hier |
| D-07 | **Kommandos + Ereignisse als geschlossene Union-Typen**, jede Änderung erzeugt ein Ereignis | ermöglicht Ereignisprotokoll (R-GAME-06), KI-Erklärbarkeit (R-AI-05) und Replay (R-ARCH-03) ohne Zusatzarbeit | Direkte Zustandsmutation aus der UI |
| D-08 | **Balancing ausschließlich in Datendateien** (`data/rules/*.json`), niemals im Code | Balancing ändert sich oft; Datenänderung darf keinen Testcode brechen | Konstanten im Code |
| D-09 | **Karten-Erzeugung als Offline-Pipeline** (`packages/mapgen`), Ergebnis ist eine eingecheckte Datendatei | Laufzeit bleibt frei von Geodaten-Abhängigkeiten; Kartenbau ist reproduzierbar (R-MAP-02, R-MAP-04) | Geodaten zur Laufzeit verarbeiten |
| D-10 | **KI als reiner Kommandogenerator** (`decide(view, memory, difficulty) → { commands, memory }`) | garantiert R-AI-01 (KI kann nichts, was ein Mensch nicht kann) strukturell statt per Selbstdisziplin | KI mit Direktzugriff auf den Zustand |
| D-11 | **Regelwerk folgt Supremacy 1914 nach dem Umbau vom 10.01.2023**, Setting und Einheiten sind modern (WW3) | für dieses Modell liegen belegte Formeln vor (Moral, Kampf, Bewegung); das ältere stochastische Modell mit Fehlschlägen und Overkill-Bonus wird ausdrücklich **nicht** nachgebaut | Conflict-of-Nations-Modell — die meisten Kampfwerte sind nicht öffentlich |
| D-12 | **Zwei Tempo-Betriebsarten** statt eines Reglers für alles: interaktiv bis 100 Spielstunden/s, darüber Vorspulen ohne Darstellung | 1000 Ticks/s bei gleichzeitigem Rendern, Schnappschüssen und Einzelereignissen ist physikalisch unmöglich; getrennt betrachtet ist beides leicht erreichbar (siehe D5) | ein einziger Regler bis 1000 — die Zusage wäre nicht einlösbar |
| D-13 | **KI-Gedächtnis ist Teil des Spielzustands** (`state.ai`) | sonst „vergisst“ die KI beim Laden ihre Pläne und entscheidet anders weiter — der Speichertest wäre grün und die Zusage trotzdem falsch | KI-Gedächtnis neben dem Zustand halten |

## D1. Systemüberblick

```
worldwar/
├─ package.json                 # pnpm-Workspace-Wurzel, Skripte
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ shared/                   # Festkomma, PRNG, Hash, Ergebnis-/Fehlertypen, IDs
│  ├─ core/                     # Simulation: Zustand, Tick-Pipeline, Regeln  ← Herzstück
│  ├─ ai/                       # Computergegner (nutzt nur die öffentliche Sicht + Kommandos)
│  ├─ mapgen/                   # Offline-Pipeline Geodaten → data/maps/world.json
│  └─ testkit/                  # Szenario-Lader, Fixtures, Zustands-Assertions
├─ apps/
│  ├─ desktop/                  # React + Vite + Tauri (Spiel-Oberfläche)
│  └─ headless/                 # CLI: Langlauf, KI-Turnier, Benchmark, Replay
├─ data/
│  ├─ maps/world.json           # erzeugte Weltkarte (eingecheckt)
│  └─ rules/*.json              # Balancing: Ressourcen, Gebäude, Einheiten, Konstanten
└─ docs/
```

**Abhängigkeitsrichtung** (per Lint-Regel erzwungen, R-ARCH-01/AK2):
`shared ← core ← ai ← apps`. `core` darf **nichts** außer `shared` importieren.

**Datenfluss zur Laufzeit:**

```
UI (React, Hauptthread)
   │  Kommando (JSON)                     ▲ Zustands-Schnappschuss + Ereignisse
   ▼                                      │
SimHost (Web Worker) ── step(state, cmds) ─┴─> core
   ▲
   └─ KI: decide(publicView(state, spielerId)) → Kommandos (im selben Worker, vor dem Tick)
```

## D2. Datenmodell (`packages/core/src/state/types.ts`)

Alle Mengenangaben sind **Festkommazahlen** (`Fixed` = Ganzzahl, 1000 = 1,0), alle IDs sind
Zeichenketten. Der Zustand enthält ausschließlich JSON-fähige Werte (D-04).

```ts
type Fixed = number;              // Ganzzahl; 1000 ≙ 1,0  (D-02)
type Tick = number;               // 1 Tick ≙ 1 Spielstunde (R-TIME-01)
type PlayerId = string; type ProvinceId = string; type ArmyId = string;

type ResourceKey = 'food' | 'wood' | 'iron' | 'coal' | 'oil' | 'rare' | 'money';
type UnitClass  = 'infantry' | 'armor' | 'artillery' | 'air' | 'navy';

interface GameState {
  schemaVersion: number;          // R-GAME-05
  seed: number;                   // Startseed der Partie
  rng: RngState;                  // geseedeter PRNG, Teil des Zustands (R-ARCH-01)
  tick: Tick;                     // vergangene Spielstunden seit Partiestart
  mapId: string;                  // Verweis auf data/maps/<id>.json
  rulesId: string;                // Verweis auf data/rules/<id>/
  players: Record<PlayerId, Player>;
  playerOrder: PlayerId[];        // feste Reihenfolge — NIE über Object.keys iterieren
  provinces: Record<ProvinceId, Province>;
  provinceOrder: ProvinceId[];
  armies: Record<ArmyId, Army>;
  armyOrder: ArmyId[];
  diplomacy: DiplomacyState;
  ai: Record<PlayerId, AiMemory>; // Pläne der Computergegner — gehasht und mitgespeichert (D-13)
  battles: Battle[];              // laufende Kämpfe, nach Provinz-ID sortiert
  eventLog: GameEvent[];          // Ringpuffer (R-GAME-06) — NICHT Teil des Hashes, siehe unten
  victory: VictoryState;
  nextIds: { army: number; battle: number; order: number };
}

interface Player {
  id: PlayerId; name: string; color: string;
  kind: 'human' | 'ai';           // R-ARCH-04: nur ein Attribut
  difficulty?: 'easy' | 'normal' | 'hard';
  aiBonusMultiplier: Fixed;       // 1000 = kein Bonus; im UI ausgewiesen (R-AI-02)
  resources: Record<ResourceKey, Fixed>;
  capitalProvinceId: ProvinceId | null;
  capitalLostUntil: Tick | null;  // Folgen des Hauptstadtverlusts (D6.8)
  alive: boolean; score: number; reputation: Fixed;
  // Aufklärungsgedächtnis: letzter bekannter Stand fremder Provinzen (R-DIP-04).
  // Gehört in den Zustand, sonst ist der Nebel des Krieges nach dem Laden verschwunden.
  intel: Record<ProvinceId, { tick: Tick; owner: PlayerId | null; strength: Fixed }>;
}

interface Province {
  id: ProvinceId; name: string; owner: PlayerId | null;   // null = neutral/Rebellen
  kind: 'city' | 'rural';
  terrain: 'plains' | 'forest' | 'mountain' | 'desert' | 'urban';
  coastal: boolean; neighbors: ProvinceId[]; seaLinks: ProvinceId[];
  population: Fixed; morale: Fixed;                       // 0..100000 (= 0..100)
  deposits: Partial<Record<ResourceKey, Fixed>>;          // Basisproduktion je Tick
  buildings: Record<BuildingKey, number>;                 // Stufe, 0 = nicht vorhanden
  buildQueue: BuildOrder[];                               // begrenzt durch maxBuildSlots (D6.9)
  recruitQueue: RecruitOrder[];
  occupiedSince: Tick | null;                             // für Besatzungsmalus
  // Produktionsreste je Ressource. Ohne sie verliert die Festkomma-Rundung über
  // 24 000 Ticks systematisch Ertrag (Bresenham-Prinzip, siehe D-02).
  productionRemainder: Partial<Record<ResourceKey, Fixed>>;
}

interface Army {
  id: ArmyId; owner: PlayerId; name: string;
  locationProvinceId: ProvinceId;
  units: UnitStack[];                                     // nach unitKey sortiert
  path: ProvinceId[];                                     // Restweg, leer = steht
  arrivalTick: Tick | null;                               // Ankunft am nächsten Wegpunkt
  departureTick: Tick | null;
  deployDelayUntil: Tick;                                 // Aufmarschverzögerung (R-UNIT-05)
  stance: 'aggressive' | 'defensive' | 'retreat';
  embarked: boolean;                                      // auf See transportiert
}

// Ein Stapel führt NUR einen Trefferpunkte-Vorrat. Die Einheitenzahl wird daraus abgeleitet
// (count = ceil(hpTotal / hpProEinheit)) und steht nie doppelt im Zustand — sonst driften
// beide auseinander. Verluste werden dadurch stetig statt sprunghaft, die Erhaltung ist exakt.
interface UnitStack { unitKey: string; hpTotal: Fixed; }
```

**Kanten sind eigene Objekte.** Nachbarschaft allein genügt nicht — Bewegung (D6.4) braucht
Entfernungen, Kampf (D6.5) braucht Flussübergänge und Meerengen:

```ts
interface Edge {
  a: ProvinceId; b: ProvinceId;
  kind: 'land' | 'sea';
  distanceKm: Fixed;
  crossing: 'none' | 'river' | 'strait';
}
// in der Kartendatei: map.edges: Edge[]  +  map.edgesByProvince: Record<ProvinceId, number[]>
```
`Province.neighbors` und `Province.seaLinks` bleiben als abgeleitete Bequemlichkeitslisten
bestehen und **müssen** zu `map.edges` konsistent sein; der Kartenvalidator prüft das als
eigene Fehlerklasse `EDGE_ASYMMETRY`.

**Regelwerk und Karte gehören nicht in den Zustand.** Der Zustand trägt nur die Verweise
`mapId`/`rulesId`; die Daten selbst kommen als unveränderlicher Zusatz in jeden Aufruf:

```ts
step(state, commands, ctx: { rules: Rules; map: MapData }) → { state, events }
```
`ctx` wird beim Laden aus `state.mapId`/`state.rulesId` rekonstruiert und geht **nicht** in
`hash(state)` ein (sonst kollidiert Balancing-in-Datendateien mit dem Golden-Master). Der Lader
vergleicht die Kennungen und lehnt Abweichungen mit `RULES_MISMATCH` ab.

**Eiserne Regeln für Determinismus (R-ARCH-01):**
1. Iteration **nur** über die `*Order`-Arrays oder über sortierte Kopien — niemals über
   `Object.keys()` in Reihenfolge-relevantem Code.
2. Kein `Math.random`, kein `Date.now`, keine `toFixed`-Rundung im Kern.
3. `divFixed(a, b)` rundet **halbe Beträge vom Nullpunkt weg**: `divFixed(7, 2) = 4`,
   `divFixed(-7, 2) = -4`, `divFixed(5, 2) = 3`. `mulFixed(a, b) = divFixed(a × b, 1000)`;
   der Zwischenwert wird gegen `Number.MAX_SAFE_INTEGER` geprüft und wirft sonst
   `FixedOverflowError`; Division durch 0 wirft `FixedDivisionByZeroError`. Beides sind
   Programmierfehler, keine Spielzustände.
4. `mulFixed` ist **nicht assoziativ**. Deshalb gilt für alle Formeln in D6 verbindlich:
   Auswertung strikt von links nach rechts in der dort notierten Reihenfolge.
5. Neue IDs kommen ausschließlich aus `state.nextIds`.

**Erzwingung der Festkomma-Regel.** `type Fixed = number` ist nur ein Alias — `a * b` zwischen
zwei Festkommawerten übersetzt anstandslos und ist um den Faktor 1000 falsch. Das ist die
wahrscheinlichste Fehlerquelle des Projekts, deshalb wird sie durch Werkzeug verhindert:
eine ESLint-Regel (`no-restricted-syntax`) verbietet die Operatoren `*` und `/` in
`packages/core/src/**` vollständig; erlaubt sind nur `mulFixed`, `divFixed` und
`mulChain([...])` für Ketten aus mehr als zwei Faktoren (mit dokumentierter Rundung nach
jedem Schritt). **Ausnahme:** `packages/ai` darf Gleitkomma für Bewertungen verwenden
(nur Grundrechenarten, kein `Math.pow/sin/exp/log`), weil Nutzenwerte nie in den Zustand
zurückfließen — der Vergleich von Alternativen nutzt einen deterministischen Tie-Break.

**Was der Hash umfasst.** `simulationHash(state)` läuft über eine **kanonische Projektion**
des Zustands: alles, was die Simulation bestimmt — und ausdrücklich **nicht** `eventLog`.
Sonst schlüge der Golden-Master bei jeder Textänderung an einem Ereignis an, ohne dass sich
eine Regel geändert hat. Im Prüflauf wird nach jedem Tick gehasht (R-ARCH-01/AK1), im
Normalbetrieb nur beim Speichern und alle 100 Ticks — ein voller Hash kostet mehr als ein Tick.

## D3. Tick-Pipeline (`packages/core/src/step.ts`)

`step(state, commands, ctx) → { state, events }` führt **genau eine Spielstunde** aus
(`ctx` siehe D2). Die Phasenreihenfolge ist verbindlich und getestet (`R-ARCH-01`):

| # | Phase | Inhalt |
|---|---|---|
| 1 | `applyCommands` | Validierung + Anwendung aller Kommandos dieses Ticks, in Spielerreihenfolge; ungültige erzeugen Fehlerereignis (R-ARCH-02) |
| 2 | `production` | Ressourcenproduktion je Provinz inkl. Restwertverrechnung, Lagergrenzen (R-ECON-02/04) |
| 3 | `upkeep` | Verbrauch durch Armeen und Gebäude, Mangelbehandlung (R-ECON-03) |
| 4 | `construction` | Baufortschritt, Fertigstellungen (R-PROV-01) |
| 5 | `recruitment` | Rekrutierungsfortschritt, neue Einheiten (R-UNIT-02) |
| 6 | `retreat` | Rückzüge lösen sich **vor** der Bewegung auf (D6.8) |
| 7 | `movement` | Armeebewegung, Ankünfte, Aufmarschverzögerung (R-UNIT-04/05) |
| 8 | `combat` | Kampfauflösung, Bombardement, Verluste (R-BAT-01..06) |
| 9 | `occupation` | Eroberungen, Eigentümerwechsel, Moralmalus (R-BAT-04) |
| 10 | `regeneration` | Auffrischung unbeschädigter Verbände in eigenem Gebiet (R-UNIT-07) |
| 11 | `diplomacy` | Ablaufende Kriegserklärungen, Waffenstillstände (R-DIP-02) |
| 12 | `bookkeeping` | Ereignisse anhängen, `tick++`, Ringpuffer kürzen |

Die KI ist **keine** Phase: sie erzeugt Kommandos vor Phase 1 (siehe D8).

**Tagesabrechnung.** `dailyTick(state, ctx)` läuft bei `tick % 24 === 0` **nach**
`bookkeeping` und enthält alles, was in Tagesgrößen definiert ist: Moralangleichung
(D6.3 nennt eine Rate *je Tag* — stündlich angewandt wäre sie um den Faktor 24 zu groß),
Aufstandswurf, Punktestand und Siegprüfung (R-GAME-02), Auto-Speicher-Signal, Tagesbericht.
Punkte gehören ausdrücklich **nicht** in den Stundentakt: die Summe über alle Provinzen,
Gebäude und Einheiten je Spieler ist im heißesten Pfad reine Verschwendung.

**Drei Regeln, die aus der Phasenreihenfolge folgen:**
1. **Kein Durchmarsch.** Betritt eine Armee eine Provinz mit feindlichen Landeinheiten, endet
   ihr Marsch dort. Eine umkämpfte Provinz verlässt man nur über `retreat` (Phase 6) mit dem
   Malus aus D6.8.
2. **Bombardement wird bei der Auflösung erneut geprüft.** Zwischen Kommando (Phase 1) und
   Kampf (Phase 8) liegt die Bewegung; ein Ziel kann inzwischen außer Reichweite sein.
3. **Marktpreise werden zu Tickbeginn eingefroren.** Alle `TRADE`-Kommandos eines Ticks
   rechnen gegen denselben Preis ab — sonst kauft der erste Spieler in `playerOrder`
   strukturell billiger, und die Gleichbehandlung aus R-FREE-02 wäre verletzt.

## D4. Kommandos (`packages/core/src/commands/`)

Geschlossene Union; jedes Kommando trägt `playerId` und wird gegen denselben Validator
geprüft — egal ob von Mensch oder KI (R-AI-01/AK1).

```ts
type Command =
  | { type: 'BUILD';        playerId; provinceId; building: BuildingKey }
  | { type: 'CANCEL_BUILD'; playerId; provinceId; orderId: string }
  | { type: 'RECRUIT';      playerId; provinceId; unitKey: string; count: number }
  | { type: 'MOVE_ARMY';    playerId; armyId; targetProvinceId: ProvinceId }
  | { type: 'STOP_ARMY';    playerId; armyId }
  | { type: 'SPLIT_ARMY';   playerId; armyId; take: { unitKey: string; count: number }[] }
  | { type: 'MERGE_ARMIES'; playerId; armyIds: ArmyId[] }
  | { type: 'SET_STANCE';   playerId; armyId; stance }
  | { type: 'BOMBARD';      playerId; armyId; targetProvinceId }
  | { type: 'TRADE';        playerId; give: ResourceKey; giveAmount: Fixed; want: ResourceKey }
  | { type: 'DIPLOMACY';    playerId; targetPlayerId; action: DiplomacyAction }
  | { type: 'SET_CAPITAL';  playerId; provinceId };

type CommandResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; code: CommandError; detail?: Record<string, unknown> };

type CommandError =
  | 'NOT_OWNER' | 'INSUFFICIENT_RESOURCES' | 'MISSING_BUILDING' | 'BUILDING_MAX_LEVEL'
  | 'NO_PATH' | 'ARMY_BUSY' | 'ARMY_NOT_FOUND' | 'PROVINCE_NOT_FOUND' | 'AT_WAR_REQUIRED'
  | 'OUT_OF_RANGE' | 'QUEUE_FULL' | 'INVALID_TARGET';
```

Validierung ist **rein** (`canApply(state, cmd) → CommandResult`) und wird sowohl vom Kern
als auch von der UI für Tooltips und Ausgrauen genutzt (R-UI-05) — eine Quelle, keine
Doppelpflege.

## D5. Zeitsteuerung (`packages/core/src/clock.ts` + `apps/desktop/src/sim/SimHost.ts`)

Ein einziger Regler bis 1000 Spielstunden pro Sekunde wäre eine leere Zusage: bei 200 Provinzen
kostet ein Tick Rechenzeit, und gleichzeitig müssten Schnappschüsse, Ereignisse und Bild
mitlaufen. Deshalb **zwei Betriebsarten** (D-12) — zusammen erfüllen sie Ziel Z1 vollständig:

**(a) Interaktiv — bis 100 Spielstunden/Sekunde.** Die Welt läuft sichtbar, Karte und Panels
aktualisieren sich, Ereignisse kommen einzeln an.
- Rastpunkte `0 (Pause) · 1 · 2 · 5 · 10 · 25 · 50 · 100`, dazwischen stufenlos.
- Akkumulator: `accumulator += verstricheneRealzeit × speed; while (accumulator ≥ 1) { step() }`,
  **gedeckelt auf 2 Ticks**. Reicht die Rechenleistung nicht, sinkt die Rate — es entsteht aber
  **kein wachsender Rückstand**, der das Spiel später einfrieren ließe.
- Rechenbudget: ≤ 8 ms je 16-ms-Zeitscheibe im Worker.

**(b) Vorspulen — beliebig schnell.** `fastForward(state, until, guards)` läuft ohne
Schnappschüsse, ohne Einzelereignisse, ohne Rendering, mit Fortschrittsanzeige und
Abbruchknopf. Hier sind Tausende Spielstunden pro Sekunde erreichbar, weil nur die Simulation
läuft. Ziele (R-TIME-03): Bau fertig, Armee am Ziel, Kampf beginnt, Tageswechsel, feste Zahl
Stunden/Tage. Abbruch bei jedem Wächterereignis (eigene Provinz angegriffen, Armee vernichtet,
Kriegserklärung); die Rückgabe nennt den Grund des Anhaltens.

**Was der Worker an die Oberfläche schickt** — und was nicht:
- **Niemals den Zustand selbst**, immer nur `publicView(state, spielerId)`. Sonst wäre der
  Nebel des Krieges (R-DIP-04) reine Kosmetik: ein Blick in den Speicherstand zeigte alles.
  Typseitig erzwungen — `GameState` wird Richtung Oberfläche nicht exportiert.
- **Kartendaten als gepackte Zahlenfelder** (`Int32Array`: Provinzindex → Eigentümer, Moral,
  Truppenstärke, Kampfkennzeichen), übertragen ohne Kopie. Details zu Provinz, Armee und
  Warteschlangen nur auf Anfrage für die aktuelle Auswahl.
- **Ereignisse werden ab Tempo > 10 Spielstunden/s verdichtet:** einzeln nur, was Alarm ist
  (Angriff, Verlust, Kriegserklärung, Fertigstellung); alles Übrige als Tagesbündel. Ohne diese
  Verdichtung entstünden bei hohem Tempo Zehntausende Meldungen pro Sekunde — unlesbar für den
  Menschen und teurer als die Simulation selbst.
- Höchstens 20 Aktualisierungen pro Sekunde, entkoppelt von der Tickrate.

**Reinheit ohne Kopierkosten:** `step` arbeitet intern auf einem eigenen, veränderlichen
Entwurf des Zustands und gibt diesen zurück; nur tatsächlich berührte Provinzen und Armeen
werden vor der Änderung kopiert. Dass der Eingangszustand unverändert bleibt, sichert ein Test
über den Hash — nicht eine teure Tiefenkopie bei jedem Tick.

## D6. Regelwerk und Formeln

Alle Konstanten stehen in `data/rules/default/constants.json` (D-08). Nachfolgend die
**Struktur** der Formeln; die Startwerte sind in `docs/plan/BALANCING.md` gesammelt und dort
je Zeile als *belegt* (aus `docs/research/SUPREMACY-MECHANICS.md`) oder *geschätzt* markiert.

### D6.1 Produktion (R-ECON-02)

```
produktion_r(provinz) = deposit_r
                      × gebäudeFaktor_r        (z. B. Fabrikstufen)
                      × moralFaktor            = 0,20 + 0,80 × moral/100      [belegt]
                      × bevölkerungsFaktor     = clamp(bevölkerung / referenzBevölkerung, 0,5 … 1,5)
                      × besatzungsFaktor       (frisch erobert: 0,5, linear auf 1,0 über 7 Tage)
```
Der Moralfaktor ist belegt: bei 0 Moral bleiben 20 % der Produktion, bei 100 Moral 100 %.
Der Rest der Division wird als `productionRemainder` in der Provinz mitgeführt und im nächsten
Tick verrechnet — ohne diesen Übertrag verlöre die Festkomma-Rundung über 24 000 Ticks
systematisch Ertrag, und kleine Provinzen verlören anteilig am meisten.

### D6.2 Verbrauch und Mangel (R-ECON-03)

Armeen verbrauchen je Tick `unterhalt_r × einheitenzahl`. Reicht der Vorrat nicht:
1. Bestand wird auf 0 gesetzt (nie negativ),
2. `shortage_r`-Flag für diesen Spieler wird gesetzt,
3. Malus: Nahrung → Moral sinkt beschleunigt; Öl → Bewegungsgeschwindigkeit −50 %;
   Munition/Material → Kampfstärke −25 %.

### D6.3 Moral (R-PROV-03/04)

Jede Provinz führt **zwei** Werte: `morale` (wirkt sofort) und `targetMorale` (Zielwert aus
allen Boni und Strafen). Am Tageswechsel nähert sich der Istwert dem Ziel um **ein Siebtel der
Lücke** [belegt]. Ausgangswerte [belegt]: Spielstart 70, frisch erobert 25, Grundziel 102,
Rückeroberung einer zuvor gut versorgten eigenen Provinz 75.

```
morale += (targetMorale − morale) / 7          // einmal je Spieltag, nicht je Tick

zielMoral(provinz) = basis(50)
                   + hauptstadtNähe      (+20 bei Distanz 0, linear auf 0 bei Distanz ≥ 8 Provinzen)
                   + eigeneNachbarn      (+2 je benachbarter eigener Provinz, max +10)
                   − feindNachbarn       (−3 je benachbarter feindlicher Provinz, max −15)
                   + nahrungBonus        (+10 bei Überschuss, −20 bei Mangel)
                   − kriegsMüdigkeit     (−1 je 10 Tage aktiver Krieg, max −15)
                   − besatzungsMalus     (−25 frisch erobert, klingt über 14 Tage ab)
```
Aufstandsrisiko je Spieltag [belegt]: `risiko% = max(0, (33 − moral) × 3)`. Der Wurf erfolgt
einmal je Spieltag aus dem geseedeten Zufallsgenerator. Eine Garnison in der Provinzmitte
unterdrückt den Aufstand, wenn ihre Verteidigungsstärke mindestens dem Prozentwert entspricht.
Bei Erfolg wechselt die Provinz zu „Rebellen“ (Eigentümer `null`) und erhält eine
Aufständischen-Armee.

Weitere belegte Moralwirkungen: Bauzeiten laufen bei 100 Moral um 10 % schneller und bei
0 Moral auf 20 % Geschwindigkeit; frisch rekrutierte Infanterie startet mit Trefferpunkten
im Verhältnis zur Provinzmoral.

### D6.4 Bewegung (R-UNIT-04)

```
dauerTicks(kante, armee) = ceil( kante.distanzKm
                               / ( minGeschwindigkeit(armee) × infraFaktor × geländeFaktor ) )
infraFaktor  = 1 + 0,25 × eisenbahnStufe(quelle)   (max 2,0 bei beidseitigem Ausbau)
geländeFaktor: plains 1,0 · forest 0,8 · mountain 0,6 · desert 0,9 · urban 1,0
```
Nach Abmarsch gilt eine **Aufmarschverzögerung** von `DEPLOY_DELAY` Ticks (Startwert 2), in
der die Armee mit halber Kampfkraft kämpft (R-UNIT-05). Die vor dem Befehl angezeigte
Ankunftszeit wird mit **derselben Funktion** berechnet, die die Bewegung ausführt — dadurch
ist R-UNIT-04/AK1 strukturell erfüllt.

### D6.5 Kampf (R-BAT-01/02/03/07)

Das Modell folgt dem belegten Stand nach dem Umbau von 2023: **deterministisch mit ±10 %
Streuung, keine Fehlschläge, gleichmäßige Schadensverteilung, ein einziger Stapel-Deckel.**

Ein Kampf hat **N Seiten**, nicht zwei — bei acht Spielern treffen regelmäßig drei Parteien
plus Aufständische in derselben Provinz aufeinander. Jede Seite trifft alle, mit denen sie im
Krieg steht (`Battle { provinceId, sides: PlayerId[][] }`).

```
Pro Kampftick (1 Spielstunde), für jede Seite S gleichzeitig:

1. Schadenspool von S:
      pool_S = Σ_i  wert_i × anteil(i)                       // wert = Angriffs- oder
                                                             // Verteidigungswert, siehe unten
   je Einheit skaliert mit:
      geländeFaktor    (Luftfahrzeug am Boden, Landeinheit auf See usw.)
      moralFaktor      (nur Infanterie: voll bei 100, linear fallend bis 55, darunter konstant)
      zustandsFaktor   (100 % Trefferpunkte → 100 % Schaden, 0 % → 50 %, linear)   [belegt]
      versorgungsFaktor (Ölmangel senkt den Beitrag)
      aufmarschFaktor  (während der Aufmarschverzögerung halbe Wirkung)

2. Stapel-Deckel (die zentrale Balancing-Bremse):                                  [belegt]
      anteil(n) = 1                        für n ≤ 20
      anteil(n) = 1 − (n − 20)/30          für 20 < n < 50
      anteil(n) = 0                        ab n ≥ 50
   Der Bestwert liegt damit bei etwa 20 Einheiten je Armee; jenseits von 50 trägt keine
   weitere Einheit mehr zum Schaden bei — sie kostet nur Unterhalt und fängt Schaden ab.

3. Streuung:  pool_S × (1 ± 0,10)    aus dem geseedeten Zufallsgenerator             [belegt]

4. Verteidigung der Gegenseite, additiv und gedeckelt:
      schutz_G = clamp(1 + def_G × (1 + festungsBonus + geländeBonus + stellungsBonus),
                       1, DEF_CAP)
   Additiv statt multiplikativ, damit sich Boni nicht zu Faktor 8 auftürmen; `DEF_CAP` steht
   im Regelwerk. Der Übergang der genutzten Kante wirkt auf den Angriff: Fluss 0,8, Meerenge 0,7.

5. Zugeteilter Schaden:  schaden_G = max(MIN_SCHADEN, pool_S / schutz_G)
   Der Mindestschaden verhindert den Fall „Schaden rundet auf null“ — sonst laufen Kämpfe
   endlos weiter, die Provinz wird nie erobert, und der Langlauf meldet trotzdem „fehlerfrei“.

6. Verteilung: gleichmäßig über die anwesenden Zielklassen, gewichtet nach Wirksamkeit und
   „Trefferfläche“ je Einheitentyp. Ist eine Klasse vernichtet, fließt der Rest in die
   verbleibenden — sonst verpufft der gesamte Anti-Panzer-Anteil, wenn der Gegner keine Panzer
   hat, und ein einzelner Verteidiger hielte eine ganze Armee auf.

7. Abzug vom Trefferpunkte-Vorrat des Ziels; die Einheitenzahl ergibt sich neu aus
   `ceil(hpTotal / hpProEinheit)`. Verluste sind dadurch in **jedem** Tick sichtbar.

8. Beide Seiten verlieren je Kampftick Moral (`KAMPF_MORAL_VERLUST`, Startwert 1 Punkt).
```

**Welcher Wert zählt — Angriff oder Verteidigung** [belegt]:
- **Stellungskampf:** steht der Verteidiger unbewegt in der Provinzmitte, greift nur der
  Angreifer mit seinem Angriffswert an; der Verteidiger hält mit seinem Verteidigungswert
  dagegen und schlägt nicht zurück.
- **Begegnungsgefecht:** steht der Verteidiger nicht in der Mitte oder hat er selbst einen
  Marsch- oder Angriffsbefehl, greifen **beide** mit dem Angriffswert an und erwidern mit dem
  Verteidigungswert — solche Kämpfe sind etwa doppelt so schnell entschieden.

**Prüfbare Eigenschaften statt tautologischer Erhaltung (R-BAT-07/AK1):** Es entsteht nie
Kampfkraft aus dem Nichts; `hpTotal` fällt während eines Kampfes monoton; der zugefügte Schaden
übersteigt nie die Schadenskapazität der Gegenseite; und **das Vertauschen der Seiten liefert
exakt gespiegelte Ergebnisse** — Letzteres sichert die zugesagte Gleichzeitigkeit ab, die sonst
je nach Auswertungsreihenfolge kippt.

Fernkampf (`BOMBARD`, R-BAT-06): Artillerie/Luft greift eine benachbarte bzw. in Reichweite
liegende Provinz an, erhält **keinen** Gegenschaden, verursacht aber nur `BOMBARD_FACTOR`
(Startwert 0,5) des Nahkampfschadens und kann keine Provinz erobern.

### D6.6 Eroberung (R-BAT-04)

Steht am Ende der Kampfphase eine feindliche Landarmee ohne Verteidiger in einer Provinz,
wechselt der Eigentümer. Folgen: Moral auf 25 gesetzt, `occupiedSince = tick`, laufende Bau-
und Rekrutierungsaufträge werden verworfen (R-PROV-01/AK2), Ereignis `PROVINCE_CAPTURED`.

### D6.7 Punkte und Sieg (R-GAME-02)

```
punkte(spieler) = 10 × provinzen + 1 × (bevölkerung/1000) + 2 × gebäudeStufen + 1 × einheiten
```
Siegbedingungen (bei Partiestart wählbar):
- **Punktesieg:** ≥ `SIEG_PUNKTE_ANTEIL` (Startwert 60 %) aller Punkte auf der Karte.
- **Eroberungssieg:** alle gegnerischen Hauptstädte erobert.
- **Zeitlimit:** nach `N` Spieltagen führt der Punktbeste.

### D6.8 Nachgereichte Formeln (verbindlich)

Diese Regeln wurden beim Plan-Review als Lücken erkannt. Ohne sie müsste der umsetzende Agent
mitten im Regelkern raten. Zahlen sind Startwerte nach D17.

**Lagergrenze und Überschuss (R-ECON-04).**
`kapazität_r = BASIS_LAGER_r + Σ lagerBonus_r(gebäude, stufe)`. Produktion über der Grenze
verfällt ersatzlos; einmal je Spieltag entsteht je betroffener Ressource das Ereignis
`STORAGE_OVERFLOW`. **Geld ist von der Grenze ausgenommen.**

**Moral wirkt auf Rekrutierung (R-PROV-04).**
`rekrutierungsDauer = grunddauer × (2 − moral/100)` — bei Moral 100 volle Geschwindigkeit,
bei Moral 0 doppelte Dauer. Unter Moral 25 sind keine neuen Rekrutierungsaufträge möglich.

**Marktpreis (R-ECON-05).**
Je Ressource ein Preisstand `preis_r`, Startwert aus dem Regelwerk. Ein Handel verschiebt ihn:
`preis_r ← clamp(preis_r × (1 + MARKT_ELASTIZITÄT × menge/referenzMenge), minPreis_r, maxPreis_r)`.
Kauf hebt, Verkauf senkt; je Spieltag bewegt sich der Preis um `MARKT_RÜCKKEHR` (Startwert 5 %)
zurück zum Startwert. Der Preis ist **für alle Spieler identisch** (kein Kaufvorteil, R-FREE-02).

**Rückzug (R-BAT-05).**
`SET_STANCE stance='retreat'` beendet den Kampf zum nächsten Tick. Die Armee kehrt in die
zuletzt kontrollierte Nachbarprovinz zurück, verliert `RETREAT_LOSS` (Startwert 10 %) ihrer
aktuellen Stärke, erhält die doppelte Aufmarschverzögerung und kann `RETREAT_COOLDOWN`
(24 Ticks) nicht angreifen. Existiert keine eigene oder neutrale Nachbarprovinz, wird das
Kommando mit `INVALID_TARGET` abgelehnt.

**Aufstandsrisiko (R-PROV-03).**
`risiko = clamp((AUFSTAND_SCHWELLE − moral) / AUFSTAND_SCHWELLE, 0, 1) × AUFSTAND_BASIS`
(Schwelle 20, Basis 0,02 je Spieltag). Der Wurf erfolgt einmal je Spieltag aus dem geseedeten
PRNG. Bei Erfolg: Eigentümer → `null`, Rebellenarmee mit Stärke proportional zur Bevölkerung.

**Hauptstadt (R-PROV-05).**
Verlust der Hauptstadt: für `CAPITAL_LOSS_DAYS` (Startwert 14 Tage) sinkt die Produktion aller
Provinzen auf 75 %, die Zielmoral um 10, und es sind keine neuen Rekrutierungsaufträge möglich.
`SET_CAPITAL` erklärt eine eigene Stadtprovinz zur neuen Hauptstadt; Kosten `CAPITAL_MOVE_COST`,
Sperrfrist 30 Spieltage. Ohne eigene Provinz scheidet der Spieler aus (R-GAME-02).

**Stellungsfaktor und Kampfmoral (R-BAT-01/03).**
`stellungsFaktor`: `defensive` 1,25 · `aggressive` 1,0 · `retreat` 0,75. Zusätzlich wirkt
`crossing` der genutzten Kante: `river` 0,8 und `strait` 0,7 auf die Angriffsstärke.
`KAMPF_MORAL_VERLUST` (Startwert 1 Punkt je Kampftick) trifft beide Seiten; die Verliererseite
zusätzlich `2` beim Zusammenbruch.

**Regeneration (R-UNIT-07).**
In eigener oder verbündeter Provinz ohne Kampf steigt `hp` je Tick um `REGEN_RATE`
(Startwert 5 ‰) bis zum Höchstwert; in fremdem Gebiet keine Regeneration; bei Mangel an
Material halbiert. Einheitenmoral folgt derselben Regel.

### D6.9 Luft, See, Bauplätze — drei Entscheidungen, die V1 festlegt

**Luftstreitkräfte in V1 = Fernwaffe, kein zweites Bewegungssystem.** Flugzeuge sind in einer
eigenen Provinz mit Flugplatz stationiert und wirken über `BOMBARD` in einem Umkreis von
`AIR_RANGE` Provinzen; zwischen eigenen Flugplätzen können sie verlegt werden. Sie erobern
nichts und stehen nach einem Einsatz `AIR_TURNAROUND` Ticks am Boden. Damit nutzen sie die
vorhandene Fernkampfmechanik statt eines zweiten Bewegungsmodells mit Reichweite und Rückflug.
*(Vollwertige Einsatzbefehle mit Rückkehr zur Basis: V2.)*

**Seetransport** ist kein Nebensatz, sondern der einzige Weg zwischen den Kontinenten:
- Transportschiffe haben eine Kapazität in Einheiten; Landeinheiten müssen eingeschifft werden.
- Ein- und Ausschiffung kosten Zeit [belegt]: 3 h Einschiffen, 1,5 h Ausschiffen mit Hafen;
  an feindlicher Küste jeweils das Anderthalbfache (4,5 h / 2,25 h).
- Eingeschiffte Verbände kämpfen nicht und sind auf See verwundbar; eine Landung an
  verteidigter Küste erhält einen Angriffsmalus.

**Bauplätze sind begrenzt.** `maxBuildSlots` je Provinztyp steht im Regelwerk; ist die
Warteschlange voll, lehnt das Spiel den Auftrag mit `QUEUE_FULL` ab. Ohne diese Grenze wäre
Parallelbau nur durch Ressourcen gebremst — und die Design-Zusage „zusätzliche Bauplätze sind
bei uns frei“ (D12) liefe ins Leere, weil es gar keine Bauplätze gäbe.

## D7. Diplomatie (R-DIP)

Zustandsmatrix je Spielerpaar: `peace | war | truce | alliance`, dazu Flags
`rightOfWay`, `sharedMap`. Kriegserklärung wird mit `DECLARE_WAR_DELAY` (Startwert 12 Ticks)
wirksam; Angriff ohne Kriegserklärung setzt sofort `war` und kostet `reputation` (−20).
Sichtbarkeit (R-DIP-04): eigene Provinzen + Nachbarprovinzen + Provinzen mit eigener Armee +
per `sharedMap` geteilte Sicht; alles andere ist als „veraltet“ markiert (letzter bekannter
Stand mit Zeitstempel).

## D8. Computergegner (`packages/ai`, R-AI)

Drei Ebenen mit unterschiedlicher Taktfrequenz, alle rein und deterministisch:

| Ebene | Takt | Aufgabe |
|---|---|---|
| **Strategie** | alle 24 Ticks | Lagebild bewerten, Feindprioritäten setzen, Bau- und Rekrutierungsbudget verteilen, Krieg/Frieden entscheiden |
| **Operativ** | alle 6 Ticks | Armeen Aufträgen zuordnen: Front halten, Ziel angreifen, Reserve sammeln, Nachschub |
| **Taktik** | jeden Tick | konkrete Marschbefehle, Angriffs-/Rückzugsentscheidung, Bombardement |

**Gedächtnis (D-13).** `state.ai[playerId]: AiMemory` hält, was zwischen den Takten überlebt:
aktuelle Feindpriorität, Zuordnung Armee → Auftrag, laufende Aufmärsche, verteiltes Bau- und
Rekrutierungsbudget. Signatur: `decide(view, memory, difficulty) → { commands, memory }`.
Die Reihum-Verteilung der Rechenlast läuft **rein über einen Zähler** (`tick % n === index`),
niemals über gemessene Zeit — gemessene Rechenzeit ist eine Messgröße für den Benchmark, nie
eine Steuergröße im Spiel, sonst wäre der Determinismus dahin.

**Bewertungsfunktion** (Utility, alle Terme dokumentiert und einzeln testbar). Jeder Term
liefert einen **normierten Wert von 0 bis 1000** mit dokumentierter Bezugsgröße — sonst
erdrückt schlicht der Term mit der größten Rohgröße alle anderen (eine Entfernung in Kilometern
auf einer Weltkarte geht bis 20 000, ein Moralwert bis 100):

```
nutzen(zielProvinz) =  w1 × wirtschaftswert      (relativ zur besten Provinz in Sicht)
                     + w2 × strategischeLage     (Nachbarschaft, Hauptstadtnähe)
                     − w3 × verteidigungsstärke  (relativ zur eigenen Angriffsstärke)
                     − w4 × entfernung           (relativ zur Reichweite der Armee)
                     + w5 × moralSchwäche        (relativ zur Aufstandsschwelle)
```
Die Gewichte `w1..w5` summieren sich zu 1000 und stehen je Schwierigkeitsgrad in
`data/rules/default/ai.json`. Zwei Hilfsstrukturen gehören dazu und sind einzeln testbar:
eine **Bedrohungskarte** (`threat[provinceId]` aus feindlichen Armeen in Reichweite ≤ 2) und
ein **Kräftevergleich** (eigene gegen erwartete gegnerische Stärke) — ohne beides kann die KI
weder eine Front halten noch einen aussichtslosen Angriff abbrechen.
Unterschiede der Schwierigkeitsgrade (R-AI-02): Planungstiefe, Reaktionszeit, Bereitschaft zu
Mehrfrontenkriegen, Qualität der Truppenmischung — **und optional** ein offen ausgewiesener
Ressourcenbonus (`aiBonusMultiplier`), der im UI angezeigt wird.

`decide()` erhält ausschließlich `publicView(state, playerId)` — dieselbe gefilterte Sicht wie
die UI (R-AI-01). Jede Entscheidung liefert im Debug-Modus `{ befehl, nutzen, alternativen[] }`
(R-AI-05). Rechenbudget (R-AI-04): Die KI darf im Mittel höchstens **30 % der Tickzeit**
beanspruchen. Eingehalten wird das über die Taktung (24 / 6 / 1) und die Reihum-Verteilung,
nicht über eine Zeitmessung zur Laufzeit — gemessen wird ausschließlich im Benchmark.

## D9. Persistenz (R-GAME-03/04/05)

```jsonc
{ "schemaVersion": 1, "savedAtTick": 1234, "rulesId": "default", "mapId": "world",
  "state": { /* GameState */ }, "commandLog": [ /* optional, für Replay R-ARCH-03 */ ] }
```
- **Speicher-Schnittstelle statt direktem Dateizugriff:**
  `StoragePort { list(); read(name); write(name, data); remove(name) }` mit drei Umsetzungen —
  `TauriStorage` (Produktion, `<AppData>/WorldWar/saves/`), `NodeStorage` (Headless und Tests),
  `MemoryStorage` (Web-Build und E2E). Nur so ist Persistenz ohne Desktop-Hülle testbar.
- Laden prüft `schemaVersion`; bekannte ältere Versionen laufen durch Migrationsfunktionen
  (`packages/core/src/persistence/migrations/v1_to_v2.ts`), unbekannte werden mit klarer
  Meldung abgelehnt.
- Automatisches Speichern alle *N* Spieltage mit Rotation über 5 Stände — **zusätzlich an einen
  Mindestabstand in Realzeit gekoppelt** (≥ 60 s) und beim Vorspulen ausgesetzt. Ohne diese
  Bremse entstünden bei hohem Tempo Dutzende Schreibvorgänge pro Sekunde, und die Rotation wäre
  binnen Sekunden mit inhaltlich gleichen Ständen gefüllt.
- Der **Kommandolog** (für Replay, R-ARCH-03) wandert in eine eigene `.replay`-Datei, nicht in
  den Speicherstand: er muss auch alle KI-Kommandos enthalten und wächst über eine lange Partie
  auf Hunderttausende Einträge.
- **Test:** `hash(state) === hash(load(save(state)))` (R-GAME-03/AK1).

## D10. Kartenerzeugung (`packages/mapgen`, R-MAP)

Offline-Pipeline, einmal ausgeführt, Ergebnis eingecheckt. **Der Zuschnitt der Provinzen ist
Kuratierung, kein Skript** — die Rohdaten enthalten rund 4600 Verwaltungseinheiten mit völlig
ungleicher Körnung (USA 51, Deutschland 16, Mikrostaaten 1). Deshalb ist die Provinzliste eine
gepflegte Tabelle und die Pipeline setzt nur zusammen:

```
data/maps/world-provinces.csv   (gepflegt: ID, Name, Land, enthaltene Verwaltungseinheiten,
                                 Startnation, Gelände, Vorkommen)
  → Zusammenführen der Geometrie über die Topologie (mapshaper/TopoJSON, „clean“ + „merge“)
  → topologieerhaltende Vereinfachung  ← NACH dem Zusammenführen, sonst reißen die Grenzen auf
  → Nachbarschaft aus geteilten Bögen der Topologie (nicht aus Polygonvergleich)
  → Entfernungen geodätisch aus Längen-/Breitengraden in Kilometern
  → Projektion in Pixelkoordinaten — reine Darstellung, bestimmt KEINE Spielgröße
  → Seewege: kuratierte Liste (~60 Routen) + Vorschläge aus einer Ozeanmaske
  → Anreicherung: Bevölkerung, Vorkommen, Gelände, Stadt/Land, Startaufstellung
  → data/maps/world.json + Prüfbericht
```

**Sechs Fallstricke, die die Pipeline sonst nicht überlebt:**
1. **Vereinfachung vor dem Verschmelzen** zerstört genau die Kantengleichheit, aus der die
   Nachbarschaft abgeleitet wird — Reihenfolge ist deshalb verbindlich.
2. **Datumsgrenze:** Russland, Fidschi, Alaska laufen über ±180°. Die Karte läuft horizontal
   **nicht** um; betroffene Verbindungen (Beringstraße) sind kuratierte Seewege.
3. **Seewege nach Luftlinie sind falsch** — sie verbänden Mittelmeer und Rotes Meer quer durch
   Ägypten. Nur über Wasser geprüfte oder von Hand gepflegte Routen zählen.
4. **Enklaven und Inseln:** Der Flächenschwerpunkt einer mehrteiligen Provinz liegt oft im
   Meer. Provinzmittelpunkt ist deshalb der am weitesten innen liegende Punkt des **größten**
   Teils, nicht der Schwerpunkt.
5. **Der Landgraph ist auf einer Weltkarte nie zusammenhängend** (Amerika, Australien).
   Geprüft wird der **Land- und See-Graph zusammen**, so wie es R-MAP-02/AK2 auch sagt.
6. **Maßstab:** Ein Pixel entspricht je nach Breitengrad einer anderen Entfernung — Spielgrößen
   kommen ausschließlich aus den geodätischen Kilometern.

Validator (R-MAP-02/AK1/AK2) läuft als Test bei jedem Lauf: Schema, Symmetrie und Konsistenz
von Kanten und Nachbarlisten, Zusammenhang des Land-und-See-Graphen, jede Provinz hat mindestens
einen Nachbarn, keine Selbstkanten, jede Startposition erreichbar, Verteilungen im Zielkorridor.

## D11. Oberfläche (`apps/desktop`, R-UI)

**Ebenen der Kartenansicht** (D-05): (1) Hintergrund/Meer, (2) Provinzflächen nach Modus
eingefärbt, (3) Grenzen, (4) Eisenbahn/Infrastruktur, (5) Armeen und Kampfsymbole,
(6) Auswahl/Wegvorschau, (7) Beschriftungen.

**Zwischengespeichert wird die teure Ebene**, nicht die billige: Die 200 gefüllten
Provinzflächen (Ebene 2) sind der Aufwand, ändern sich aber nur bei Eigentümer-, Modus- oder
Zoomwechsel — sie werden in ein separates Zeichenfeld gerendert, Schlüssel
`(Kartenmodus, Zoomstufe, Besitzstand-Version)`. Zusammen mit den Ebenen 1, 3, 4 und 7 wird nur
dann neu gezeichnet, wenn sich ihr Schlüssel ändert. Pro Bild neu gezeichnet werden allein die
beweglichen Ebenen 5 und 6.

**Bildschirmaufbau** (R-UI-03): Kopfleiste (Ressourcen, Datum, Geschwindigkeitsregler,
Vorspulen), Karte als Hauptfläche, rechte Seitenleiste (kontextabhängig: Provinz, Armee,
Diplomatie, Wirtschaft), untere Leiste (Ereignisprotokoll, Kampfberichte).

**Design-Tokens** (`apps/desktop/src/ui/tokens.ts`) — Farben, Abstände, Typografie
zentral; kein Literal-Farbwert in Komponenten. Kontrastprüfung als automatisierter Test
(R-UI-02). **Design-Gate:** vor Baubeginn der UI wird ein Mockup als Artifact vorgelegt
(R-UI-01) — ohne Freigabe wird `apps/desktop` nur als funktionales Gerüst gebaut.

**Zustandsverwaltung:** Zustand kommt ausschließlich als Schnappschuss aus dem Worker
(unveränderlich), lokale UI-Zustände (Auswahl, Zoom, offene Panels) getrennt in einem
Zustand-Store. Kein Duplizieren von Spiellogik in der UI.

## D12. Umsetzung der Anti-Monetarisierung (R-FREE-02)

Grundlage ist die belegte Liste aus `docs/research/SUPREMACY-MECHANICS.md`, Kapitel 11
(Goldmark und „High Command“-Abonnement). Jede Zeile ist entschieden:

| Original-Kaufvorteil | Unsere Umsetzung | Kategorie |
|---|---|---|
| Bau/Rekrutierung gegen Goldmark sofort fertigstellen | entfällt — Vorspulen löst dasselbe Problem für alle gleich (R-FREE-03) | (c) gestrichen |
| Ressourcen zum festen Vorzugskurs kaufen | regulärer Markt mit dynamischem Preis, für alle identisch (R-ECON-05) | (b) Mechanik |
| Moral sofort um 10 % anheben (Sofort-Moral) | entfällt ersatzlos — verzerrt das gesamte Wirtschaftsmodell | (c) gestrichen |
| Sechs Sofort-Spionageaktionen gegen Goldmark | reguläre Aufklärung über Einheiten und Sichtweiten; V2 erweitert das um Spionagegebäude | (b) Mechanik |
| „High Command“: Bau-Warteschlange | für alle frei verfügbar (`maxBuildSlots`, D6.9) | (a) frei |
| „High Command“: Sammelpunkte für neue Einheiten | frei verfügbar | (a) frei |
| „High Command“: erweiterte Feuerleitung | frei verfügbar | (a) frei |
| „High Command“: Generalmobilmachung | frei verfügbar | (a) frei |
| „High Command“: geteilte Aufklärung im Bündnis | frei verfügbar über die Diplomatie (`sharedMap`) | (a) frei |
| Kosmetik (Flaggen, Namen, Avatare) | frei wählbar | (a) frei |
| Zeitraffer und Warteverkürzung | Kernfunktion des Spiels, unbeschränkt (Ziel Z1) | (a) frei |

Guard-Test (R-FREE-01/AK1): Textsuche über `packages/` und `apps/` nach Kaufwährungs-Begriffen;
Ausnahmeliste ausschließlich für diese Design-Tabelle und Testdateien.

## D13. Multiplayer-Vorbereitung (R-ARCH-04, nicht in V1)

Der Kern ist bereits lockstep-fähig: deterministischer Zustand (D-02), Kommandos pro Spieler
und Tick, Zustands-Hash je Tick. Für den späteren Zwei-Personen-Modus genügt:
ein schlanker Node-Server, der Kommandos einsammelt, sie einem Tick zuordnet, an beide
Klienten verteilt und die Hashes vergleicht. **Kein Kernumbau nötig** — der Hot-Seat-Test
(R-ARCH-04/AK1) hält diese Eigenschaft dauerhaft grün.

## D14. Teststrategie (TDD, C-08)

| Testart | Werkzeug | Ort | Zweck |
|---|---|---|---|
| Unit | Vitest | `packages/*/src/**/*.test.ts` | Einzelregeln, jede Formel |
| Eigenschaftsbasiert | Vitest + fast-check | `packages/core/test/properties/` | Invarianten: Erhaltung, Nichtnegativität, Determinismus |
| Szenario | Vitest + `testkit` | `packages/core/test/scenarios/*.yaml` | „Gegebene Lage → N Ticks → erwarteter Ausgang“ |
| Golden-Master | Vitest-Snapshot | `packages/core/test/golden/` | Zustands-Hash nach 500 Ticks; schlägt bei jeder unbeabsichtigten Regeländerung an |
| Performance | tinybench | `packages/core/test/perf/` | Budgets aus R-ARCH-06/R-AI-04 |
| Guards | Vitest | `test/guards/` | keine Monetarisierung, kein Netzwerk, Import-Grenzen, kein `Math.random` |
| UI-Komponenten | Vitest + Testing Library | `apps/desktop/src/**/*.test.tsx` | Panels, Tooltips, Kontrast |
| E2E | Playwright (Web-Build) | `apps/desktop/e2e/` | Partie starten, bauen, marschieren, speichern/laden |

**Namenskonvention:** jeder Test beginnt mit der Anforderungs-ID, z. B.
`describe('R-BAT-07 Kampfbericht', …)`. Ein Skript `pnpm coverage:requirements` prüft, dass für
jede V1-Anforderungs-ID mindestens ein Test existiert. Damit das keine reine Namensprüfung
bleibt, verlangt es zusätzlich: der zugehörige Block enthält mindestens eine Zusicherung und
ist nicht übersprungen. Der zu prüfende Umfang steht maschinenlesbar im `scope`-Block am Ende
von `01-REQUIREMENTS.md` §2.

**Lange Läufe gehören nicht in die Schleife.** Turniere und Tausend-Tage-Läufe tragen das Tag
`@slow` und laufen nur über `pnpm test:slow` (siehe D15). In der TDD-Schleife laufen davon nur
Kurzformen — sonst dauert die Prüfung nach jeder Aufgabe Stunden, und der nächste Schritt wäre,
dass jemand anfängt, Tests zu überspringen.

**TDD-Zyklus je Aufgabe:** (1) Test aus dem Akzeptanzkriterium schreiben → rot,
(2) minimal implementieren → grün, (3) aufräumen, (4) Abdeckung und Guards prüfen.

## D15. Werkzeuge und Skripte (Wurzel-`package.json`)

```
pnpm test               # alle Tests OHNE das Tag @slow
pnpm test:slow          # die langen Läufe (Turniere, 1000 Spieltage, Weltkarte)
pnpm test:watch         # TDD-Schleife
pnpm coverage           # Abdeckung + Schwellwerte (R-ARCH-05), leere Pakete ausgenommen
pnpm coverage:requirements  # Anforderungs-zu-Test-Abgleich (eigenes Tor, NICHT Teil von verify)
pnpm balance:sweep      # Parameterlauf für das Balancing (T-M12-00)
pnpm lint               # ESLint inkl. Importgrenzen (D-01) und Determinismus-Regeln
pnpm typecheck          # tsc --noEmit
pnpm build              # alle Packages + Desktop-Build
pnpm map:build          # Kartenpipeline (packages/mapgen)
pnpm sim:long           # Langlauf 1000 Spieltage, 8 Spieler (Abnahmekriterium 6)
pnpm sim:tournament     # KI-Turnier, Siegquoten (R-AI-06)
pnpm bench              # Performancebudgets
pnpm dev                # Vite-Entwicklungsserver (Browser)
pnpm tauri:dev          # Desktop-Anwendung
pnpm verify             # lint + typecheck + test + coverage + guards  ← Pflicht vor jedem Commit
```

## D16. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Balancing fühlt sich falsch an, obwohl alle Tests grün sind | Balancing in Datendateien (D-08) + früher, kurzer Spieltest nach Meilenstein M4 statt erst am Ende |
| Kartenerzeugung wird zum Zeitfresser | zuerst kleine Testkarte (12 Provinzen) im Repo; Weltkarte ist ein eigener, abgegrenzter Meilenstein |
| KI ist entweder zu dumm oder zu langsam | messbare Turniere (R-AI-06) und Rechenbudget (R-AI-04) sind Teil der Definition of Done, nicht Kür |
| UI wird unleserlich (Erfahrung aus dem Projekt Rotation) | Design-Gate (R-UI-01) + automatischer Kontrasttest (R-UI-02) |
| Determinismus bricht unbemerkt | Golden-Master-Hash + Guards gegen `Math.random`/`Date` im Kern |
| Umfang wächst unkontrolliert | V2-Merkmale sind in `01-REQUIREMENTS.md` ausdrücklich als V2 markiert und in `03-TASKS.md` nicht eingeplant |

## D17. Offene Balancing-Punkte

Alle konkreten Zahlenwerte werden in `docs/plan/BALANCING.md` festgeschrieben und von dort nach
`data/rules/default/*.json` überführt. Jede Zahl trägt einen Belegstatus:

| Status | Bedeutung | Beispiele |
|---|---|---|
| **belegt** | aus der Mechanik-Referenz, mit Quelle | Moraldrift ein Siebtel je Tag · Produktion 0,20 + 0,80 × Moral · Aufstandsrisiko (33 − Moral) × 3 % · Stapel-Deckel 20 → 50 · Streuung ±10 % · Geschwindigkeiten in km/h · Bahn ×2,5 · fremdes Gebiet ×0,70, feindliches ×0,35 · Ein-/Ausschiffung 3 h / 1,5 h |
| **abgeleitet** | rechnerisch aus belegten Zahlen gefolgert | Tickkosten, Kategorie-Grundbedarf je Provinz |
| **geschätzt** | keine Quelle vorhanden — begründet gesetzt und über Testpartien abgestimmt | **Angriffs- und Verteidigungswerte je Einheit und Zielklasse**, Trefferpunkte je Einheit, Gebäude-Trefferpunkte, Punkteformel |

Die größte offene Lücke sind die **Kampfwerte der einzelnen Einheiten**: sie wurden beim Umbau
2023 mit einem unbekannten Faktor neu skaliert und sind nirgends veröffentlicht. Sie werden
geschätzt und über den Parameterlauf (`pnpm balance:sweep`, T-M12-00) abgestimmt — genau dafür
existiert dieses Werkzeug. Die weiteren offenen Punkte stehen in Kapitel 14 der
Mechanik-Referenz.

## D18. Ausbau der Oberfläche (V1.1, R-UI-08 … R-UI-14, R-MAP-07)

Die freigegebene Gestaltungsrichtung bleibt unverändert: „Lagekarte“, Direction A, freigegeben
am 2026-09-03. **Es entsteht kein neues Design-Gate** (R-UI-01), weil keine Farbe, keine
Schriftgröße und kein Raster geändert wird — es kommen ausschließlich Bauteile *aus* diesem
Vokabular hinzu. Neue Farbwerte sind ausdrücklich verboten; wo eine Anzeige eine Farbe braucht,
nimmt sie eine der elf Mächtefarben oder eines der bestehenden Kennfarbtokens.

### D18.1 Das Grundmuster: eine Anzeige ist ein Datum, kein Bild

Jede neue Anzeige folgt derselben Bauart, damit die Oberfläche nicht in Einzelstücke zerfällt:

| Bauteil | Was es zeigt | Wo es herkommt |
|---|---|---|
| **Balken** (`Meter`) | ein Anteil 0…1 mit Beschriftung und Zahl | `ui/Meter.tsx` |
| **Symbolzeile** (`IconRow`) | eine Menge gleichartiger Dinge mit Anzahl | `ui/icons.tsx` + `ui/IconRow.tsx` |
| **Kennfarbe** | Zustand aus einer festen kleinen Menge | `TOKENS.good/warn/accent` |
| **Erklärung** (`Explain`) | ein bis zwei Sätze zu einem Ding | `i18n/de.ts`, Schlüssel `explain.*` |

Der Balken ist bewusst *kein* Diagramm: keine Achse, keine Skala, keine Legende. Er ist eine
Zahl, die man ohne Lesen vergleichen kann. Die Zahl selbst bleibt daneben stehen — wer genau
wissen will, wie viel, soll nicht auf Pixel zielen müssen.

**Barrierefreiheit ist Teil des Bauteils, nicht ein Nachtrag:** jeder Balken trägt
`role="meter"` mit `aria-valuenow/min/max` und einer Textfassung, jede Symbolzeile eine
Textfassung („3 Infanterie“). Ein Symbol ohne Wort ist für einen Screenreader ein leeres Feld;
ein Wort ohne Symbol ist genau das, was hier abgeschafft wird. Es braucht beides.

### D18.2 Was die Oberfläche vom Kern zusätzlich braucht

Vier Größen fehlen der Sicht (`publicView`), und jede wird dort ergänzt statt in der
Oberfläche nachgerechnet — eine Regel, die das Projekt von Anfang an trägt (D11: keine
Spiellogik in der UI):

| Feld | Zweck | Nebelregel (R-DIP-04) |
|---|---|---|
| `VisibleProvince.buildQueue` | Bauvorhaben mit Fertigstellungs-Tick, für den Fortschrittsbalken | nur eigene Provinzen |
| `VisibleProvince.recruitQueue` | dasselbe für Aushebungen | nur eigene Provinzen |
| `VisibleProvince.moraleTarget` | wohin die Moral läuft, für den Trendpfeil | nur eigene Provinzen |
| `PublicView.battles` | laufende Kämpfe als Provinzliste, für Kampfsymbol und Alarm | nur sichtbare Provinzen |

**Nicht** in den Kern kommt die Truppenstärke je Provinz für den Kartenmodus: `view.armies`
ist bereits nach Sichtbarkeit gefiltert, eine Summe darüber ist Darstellung und keine
Spiellogik. Sie entsteht als reine Funktion in `map/modes.ts` — eine Kernänderung weniger,
dasselbe Bild.

Alle vier sind **optional und werden nur berechnet, wenn die Sicht mit Regeln angefordert
wird** — genau wie `economy` es schon hält. Die KI fragt die Sicht ohne Regeln ab und zahlt
damit nichts für Anzeigen, die sie nicht liest. Das Tickbudget der Weltkarte (2,8 ms) bleibt
Maßstab; ein Budgettest hält es fest.

### D18.3 Die Karte

- **Beschriftung** ab Zoomstufe `scale ≤ 1.2` (näher als „ganze Welt“): Provinzname in
  `--font-map`, 11 px, Farbe `onPlayer`, mit heller Aura für die Lesbarkeit auf jeder Füllung.
  Gezeichnet wird nur, was ins Polygon passt — sonst gar nicht.
- **Legende** unten links auf der Karte, drei bis vier Einträge aus `legendFor(mode)`,
  das es bereits gibt und bisher niemand aufruft.
- **Symbole:** Hauptstadt (Stern), laufender Kampf (gekreuzte Säbel, pulsierend),
  Gebäudepunkte wie bisher, Armeekasten mit dem Symbol seiner stärksten Gattung statt
  immer dem Infanteriekreuz.
- **Marschweg** der ausgewählten Armee als gestrichelte Linie mit Zielpunkt — die Ebene
  `path` gibt es in `MapCanvas` schon, sie wurde nie befüllt.
- **Kartenmodus „Truppenstärke“** ersetzt „Bedrohung“ (R-MAP-07): Bedrohung wurde nie
  berechnet, der Modus färbte deshalb die ganze Welt gleich grau.

**Zeichenbudget:** Beschriftung und Symbole gehören zur teuren, zwischengespeicherten Ebene
(Namen) beziehungsweise zur billigen Überlagerung (Symbole, Weg). Damit bleibt die
Aufteilung aus D11 gültig; der Renderbenchmark bekommt einen zweiten Fall „mit Beschriftung“.

### D18.4 Bewegung, sparsam

Animiert wird genau dreierlei, jeweils über eine gemeinsame Uhr in der Überlagerungsebene:
der Kampfring pulsiert, eine neue Alarmmeldung blendet einmal auf, ein fertiggestellter Bau
lässt seinen Balken einmal aufleuchten. Nichts davon läuft dauerhaft, nichts bewegt sich
ohne Anlass, und alles hört bei `prefers-reduced-motion: reduce` auf — die Regel dafür steht
bereits im Stylesheet.

### D18.5 Erklärungen

Die Texte liegen unter `explain.*` in der Sprachdatei, ein Satz je Ding, höchstens zwei.
Ein Test zählt sie ab: für jeden Gebäude-, Einheiten- und Rohstoffschlüssel der Regeln, für
jeden Kartenmodus, jede Geländeart und jeden Beziehungszustand muss ein Eintrag existieren —
fehlt einer, ist der Test rot, nicht der Spieler ratlos.

Getragen werden sie von einem `<Explain>`-Bauteil: ein kleines Fragezeichen hinter dem Namen,
das Beschreibung *und* Kennzahlen aus den Regeln zeigt (Kosten, Bauzeit, Wirkung), erreichbar
mit Zeiger, Tastatur und Screenreader. Kein Text, der immer sichtbar ist — Noahs Vorgabe
lautet weniger Text, nicht mehr.

### D18.6 Der Stand der Partie

Eine Lageübersicht (Taste `L`) als Seitenpanel: alle bekannten Mächte mit Punktebalken,
Beziehungsfarbe und Truppenstärke, die eigene Macht hervorgehoben, darüber der Anteil am
Siegziel als Balken. Ist die Partie entschieden, tritt ein Abschlussfenster davor, das den
Ausgang nennt und den Verlauf in drei Zahlen zusammenfasst.

### D18.7 Reihenfolge und Risiko

Zuerst die Verdrahtung dessen, was schon existiert (Symbole, Ton, Einstiegshilfe,
Autosave) — dort ist der Gewinn je Aufwand am größten und das Risiko am kleinsten. Dann die
Sichterweiterung im Kern, weil alle Anzeigen darauf stehen. Dann Karte, Anzeigen,
Erklärungen, Lageübersicht. Zuletzt der Feinschliff im laufenden Bild.

**Das größte Risiko ist nicht die Technik, sondern die Menge:** eine Seitenleiste, in der
jetzt Balken, Symbole und Fragezeichen zusätzlich zum Text stehen, ist nicht aufgeräumter,
sondern voller. Deshalb ersetzt jede neue Anzeige den Text, den sie ablöst, statt neben ihm
zu stehen — und der Prüfstein am Ende ist ein Bildvergleich vorher/nachher, nicht die
Testzahl.
