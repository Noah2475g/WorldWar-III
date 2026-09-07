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
einmal je Spieltag aus dem geseedeten Zufallsgenerator. Bei Erfolg wechselt die Provinz zu
„Rebellen“ (Eigentümer `null`) und fällt damit herrenlos zurück.

> **Zurückgenommen am 2026-09-05 (T-M14-03).** Zwei Zusagen standen hier, die nie gebaut
> wurden: dass eine Garnison den Aufstand unterdrückt, und dass die Provinz eine
> Aufständischen-Armee erhält. `settleMorale` liest `draft.armies` nirgends, und
> `Army.owner: PlayerId` lässt eine besitzerlose Armee typseitig gar nicht zu. Die
> Anforderung R-PROV-03/AK1 bleibt erfüllt — die Provinz wird herrenlos, und das ist
> die Wirkung, auf die es ankommt. Begründung in DECISIONS.md.

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
in derselben Provinz aufeinander. Jede Seite trifft alle, mit denen sie im
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

   **Grenzbeitrag** — was die *nächste* Einheit noch beiträgt (`stackContribution`):
      grenze(n) = 1                        für n ≤ 20
      grenze(n) = 1 − (n − 20)/30          für 20 < n < 50
      grenze(n) = 0                        ab n ≥ 50

   **Gesamtbeitrag** — was die Armee als Ganzes wert ist, das Integral darüber
   (`effectiveUnits`, das ist die Größe, mit der `sideAttackValue` rechnet):
      wert(n) = n                          für n ≤ 20
      wert(n) = n − (n − 20)²/60           für 20 < n < 50
      wert(n) = 35                         ab n ≥ 50  (Plateau)

   > **Die Unterscheidung ist nicht akademisch, sie hat das Spiel gekostet** (T-M14-06,
   > Befund 3 des Audits). Bis zum 2026-09-06 multiplizierte `sideAttackValue` die **ganze**
   > Armee mit dem *Grenz*beitrag. Gemessen ergab das: 20 Einheiten → 1501 Schaden,
   > 25 → 1563 (Höhepunkt), 30 → 1502, 40 → 1000, 49 → 121, **ab 50 → exakt 0** — bei
   > unverändertem eigenem Verlust und weiterlaufendem Unterhalt. Jede Einheit jenseits der
   > fünfundzwanzigsten machte eine Armee *schwächer*, und die KI, die Verbände zusammenlegt,
   > lief genau hinein. Ein Deckel begrenzt das Wachstum; er bestraft nicht die Größe.
   >
   > Für Armeen bis zwanzig Einheiten sind beide Fassungen **identisch** — deshalb blieb der
   > Golden-Master beim Umbau unverändert gültig.

   Der Bestwert liegt weiterhin bei etwa 20 Einheiten je Armee: darüber trägt jede weitere
   Einheit weniger bei als die davor, ab 50 gar nichts mehr — sie kostet dann nur noch
   Unterhalt und fängt Schaden ab.

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
PRNG. Bei Erfolg: Eigentümer → `null`; die Provinz fällt herrenlos zurück (die zuvor hier
zugesagte eigene Truppe der Aufständischen ist am 2026-09-05 zurückgenommen, T-M14-03).

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
  `MemoryStorage` (Tests). Nur so ist Persistenz ohne Desktop-Hülle testbar. Die
  ausgelieferte V1 nutzt `IndexedDbStorage` (T-M14-08); der Datei-Port folgt in M16.
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


---

## D19. Die KI wird ein Gegner (M15, das reduzierte V1.2 — R-TECH-01/02, R-DIP-06, R-BAT-08, R-AI-08, R-GAME-07, R-TIME-06)

Abschnitt 2.15 der Anforderungen beginnt mit einem Satz über das Spiel, nicht über den Code:
*„Tag 1 unterscheidet sich von Tag 40 durch nichts als den Kontostand."* Noahs Entscheidung vom
2026-09-05 nimmt diesen Satz beim Wort und streicht alles, was ihn nicht beantwortet: **Zeitung
(R-NEWS-01/02/03) entfällt** — ersetzt durch einen Filter „Weltgeschehen" im bestehenden
Ereignisprotokoll —, **Spionage (R-SPY-01…06) und Handelsangebote (R-DIP-05, R-DIP-07) wandern
nach M17**. Was bleibt, ist ein einziges Versprechen: die KI wird ein Gegner, der eine Zeitachse
kennt, ein Verhältnis pflegt, seine Fernwaffen benutzt — und dessen Partie sich speichern lässt.

Die vier Regeln aus 2.15 gelten unverändert: die KI kann alles, was der Spieler kann (R-AI-01);
kein Wissen ohne Quelle (R-DIP-04); jede Zahl steht in den Regeldateien (D-08) und mit Status in
`BALANCING.md`; ein Spielstand der V1 läuft weiter (R-GAME-05). Dieses Kapitel antwortet auf
Befund 27 („alle 18 Anforderungen aus 2.15 haben weder Entwurf noch Aufgabe") und legt fest, was
vor der ersten Zeile Code entschieden sein muss — insbesondere das, was heute an **vier** Stellen
gleichzeitig gebraucht und deshalb ohne Entwurf **viermal verschieden** improvisiert würde.

### D19.1 Das Grundmuster: wer erfährt was

> **Gebaut am 2026-09-06 (T-M15-01).** `concerns: PlayerId[]` ist ein **Pflichtfeld** an
> `BaseEvent`, mit der Vorgabe `concerns = audience` in `emit()`. Damit ist jedes private
> Ereignis ohne Zutun richtig, und ein **öffentlicher** Alarm — der Fall, um den es geht —
> muss seine Betroffenen an der Erzeugungsstelle nennen. Pflicht statt optional war die
> teurere, aber einzig ehrliche Wahl: ein fehlendes Feld hätte still „betrifft niemanden"
> geheißen, und die Typprüfung fand so vier von Hand gebaute Ereignisse, die `emit()`
> umgehen. `firstAlertFor` verlangt jetzt beides — Lektüre *und* Betroffenheit.
> `BATTLE_STARTED` wird erzeugt, **einmal je Gefecht**, entprellt gegen die Kampfliste des
> Vortricks (die Liste wird tickweise neu aufgebaut; ohne Entprellung meldete ein Gefecht
> über drei Ticks dreimal seinen Beginn). Der Golden-Master blieb unverändert gültig:
> `eventLog` steht in `HASH_OMIT_KEYS`, und die Vergabe der `battleId` wurde bewusst
> **nicht** angefasst — sie liegt im Zustand.
>
> Der Text darunter ist der Befund von vorher und bleibt als Begründung stehen.

Ein Ereignis trägt heute zwei Angaben über seine Empfänger, und eine dritte fehlt:

- **`severity`** wird aus der *Art* abgeleitet, nicht von der Aufrufstelle gesetzt
  (`packages/core/src/events/emit.ts:22`, `isAlertType`) — richtig so: ob der Verlust einer
  Provinz laut ist, darf nicht davon abhängen, welche Zeile ihn meldet.
- **`audience: PlayerId[]`** mit der Regel „leer heißt öffentlich"
  (`packages/core/src/events/types.ts:27-28`).
- **Betroffenheit** — „geht es um *mich*?" — gibt es nicht.

Weil sie fehlt, rechnet der einzige Leser sie falsch zusammen:
`firstAlertFor` (`packages/core/src/clock.ts:120-131`) hält das Vorspulen an, sobald
`severity === 'alert'` und `audience.length === 0 || audience.includes(playerId)`. Und
`PROVINCE_CAPTURED` (`phases/occupation.ts:47-51`), `PROVINCE_REVOLTED` (`phases/morale.ts:156-160`),
`PLAYER_ELIMINATED` und `GAME_ENDED` (`phases/dailyTick.ts:30` und `:39-42`) werden **ohne**
`audience` erzeugt. Jede Eroberung irgendwo auf der Welt hält also das Vorspulen jedes Spielers
an — genau das, was R-TIME-06/AK2 verbietet.

Die Antwort ist **ein Datum am Ereignis, kein Sonderfall je Verwendungsstelle**: ein drittes Feld
`concerns: PlayerId[]`, gesetzt an der Erzeugungsstelle, weil nur dort bekannt ist, um wen es
geht (Eigentümer, Vorbesitzer, Armeeeigentümer, beide Seiten einer Erklärung).

| Datum | Frage | Feld | Wer liest es |
|---|---|---|---|
| Sichtbarkeit | Darf ich davon **wissen**? | `audience` (leer = öffentlich) | `eventsFor`, `filterEvents`, Protokoll |
| Dringlichkeit | Muss ich es sehen, **bevor die Zeit weiterläuft**? | `severity`, aus der Art | Alarmleiste, Klang |
| Betroffenheit | Geht es **um mich**? | `concerns` (neu) | `firstAlertFor` — und nur dieser |

Daraus fallen die drei Fälle heraus, ohne dass eine einzige Verwendungsstelle sie nachrechnet:

- **ALARM** — `severity: 'alert'` **und** ich stehe in `concerns`: das Vorspulen hält an, die
  Meldung kommt einzeln, der Grund wird in Worten genannt. (R-TIME-06/AK2, zweite Hälfte.)
- **AN MICH GERICHTET** — ich stehe in `concerns`, aber die Art ist `info`: eine Meldung ohne
  Anhalten. Hierher gehört später jedes eingehende Angebot (M17), heute schon der
  fertiggestellte Bau und die angekommene Armee.
- **LEKTÜRE** — sichtbar über `audience`, aber ich stehe nicht in `concerns`: Protokolleintrag,
  kein Alarm, kein Anhalten. (R-TIME-06/AK2, erste Hälfte.)

**Der Filter „Weltgeschehen"** (Noahs Ersatz für die Zeitung) ist damit keine neue Mechanik,
sondern genau diese Menge, geschnitten mit einer festen Positivliste von Ereignisarten:
`audience.length === 0 && !concerns.includes(me)`. `filterEvents`
(`packages/core/src/events/log.ts:32-46`) bekommt dafür ein Feld `scope: 'mine' | 'world'` neben
den fünf, die es schon hat. **Kein neues Zustandsfeld, keine Migration, kein Hashrisiko** —
`HASH_OMIT_KEYS = ['eventLog']` (`state/types.ts:296`) bleibt unverändert, weil das Protokoll das
Protokoll bleibt. Das war der teuerste versteckte Preis der Zeitung, und er entfällt vollständig.

**`BATTLE_STARTED` wird erzeugt** (R-TIME-06/AK3). Das Ereignis ist deklariert
(`events/types.ts:111-116`), steht in `ALERT_TYPES` (`:285`), ist Vorspulziel (`clock.ts:108-115`)
und hat einen Klang (`apps/desktop/src/ui/sound.ts:135` `case 'BATTLE_STARTED'`) — und wird an
keiner Stelle des Kerns geworfen; die Kampfphase meldet ausschließlich `BATTLE_RESOLVED`
(`phases/combat.ts:135-140`). Das Vorspulziel „ein Gefecht beginnt" kann heute nicht greifen und
läuft bis `maxTicks`. Erzeugt wird es dort, wo der Kampf in die Liste eintritt
(`phases/combat.ts:125-130`), mit `sides` aus derselben Quelle und `concerns` = alle beteiligten
Eigentümer.

**Was `concerns` an alten Ständen bedeutet:** ein Protokoll aus der V1 trägt das Feld nicht. Ein
fehlendes `concerns` liest sich als leer, ein solches Ereignis ist damit Lektüre. Das ist richtig
und ausdrücklich gewollt — ein Alarm von vor dem Laden ist kein Alarm mehr. Die Migration (D19.5)
füllt das Protokoll deshalb **nicht** nach.

### D19.2 Die Zeitachse (R-TECH-01/02)

> **Teil 1 gebaut am 2026-09-06 (T-M15-02).** `availableFromDay` ist ein **Pflichtfeld** an
> jedem Gebäude und jeder Einheit; der Lader lehnt ein Regelwerk ab, das es auslässt, und
> ebenso eine Einheit, die es früher gäbe als das Gebäude, das sie braucht (dann schlüge
> der Auftrag an `MISSING_BUILDING` fehl und der Spieler läse die falsche Begründung).
> Die Ablehnung heißt `NOT_YET_AVAILABLE` und **nennt den Tag**. Fünf Tage sind belegt,
> zwölf abgeleitet, alle siebzehn mit Begründung in `BALANCING.md` und dort maschinell
> geprüft. Die Zählung ist **eins-basiert** (`rules/availability.ts`): der erste Tick liegt
> auf Tag 1 — dieselbe Zählung, die die Oberfläche schon benutzt. Null-basiert wäre die
> Kaserne am ersten Spieltag nicht baubar gewesen.
>
> **Was die Achse bewusst nicht ist:** die späteste Freischaltung liegt bei Tag 16, eine
> Standardpartie dauert 822 Spieltage. Sie prägt die **Eröffnung**, nicht den Verlauf.
> Ob das zu kurz greift, beantwortet der Playtest und nicht dieser Entwurf.
>
> **Teil 2 gebaut am 2026-09-06 (T-M15-03, R-TECH-02).** Der Tag erreicht den Bildschirm auf
> **zwei** Wegen, und das ist Absicht: der Ablehnungstext nennt ihn (`NOT_YET_AVAILABLE` mit
> `detail.availableFromDay`), *und* der Tooltip der Sache trägt „ab Spieltag N", solange sie
> gesperrt ist. Nur der erste Weg wäre eine Zusage über die **Reihenfolge der Prüfungen im
> Kern**: stünde die Kasse davor, läse der Spieler „zu wenig Rohstoffe" für etwas, das es
> noch gar nicht gibt. Nach der Freischaltung fällt der Zusatz weg — „ab Spieltag 1" an der
> Kaserne wäre eine Auskunft, die nur beim ersten Lesen etwas heißt.
>
> **Die KI wählt nichts Gesperrtes.** `nextBuilding` und `nextUnitFor` filtern auf den Tag,
> gelesen aus `view.tick` — keine zweite Zeitrechnung. Der Grund ist nicht Schönheit: ein
> Befehl, den der Kern jeden Tag ablehnt, ist Rauschen im Protokoll statt Verhalten, und
> die KI fasste ihn in jedem Tick neu. Gemessen über 60 Spieltage mit drei KI-Mächten:
> **0 Ablehnungen** `NOT_YET_AVAILABLE` — ohne den Filter sind es 2, also kann der
> Wächter fallen.

Drei Teile, und keiner davon ist eine neue Mechanik: ein Feld, eine Ablehnung, ein Filter.

**(a) Freischaltung als Feld in den Regeldateien.** `availableFromDay: number` in `BuildingRule`
(`packages/core/src/rules/types.ts:32-45`) und `UnitRule` (`:46-66`), Werte in
`data/rules/default/buildings.json` und `units.json`. Belegt aus Referenz 1.4: Kaserne Tag 1,
Hafen Tag 2, Eisenbahn Tag 5, Fabrik Tag 8, Flugplatz Tag 10; die Tage der Einheiten daraus
abgeleitet über ihr `requiresBuilding`. **Warum Tag und nicht Tick:** die Referenz zählt
Spieltage, und `ticksPerDay` ist eine Regelkonstante — eine Zeitachse in Ticks wäre bei anderem
`ticksPerDay` still verschoben.

Der Lader lehnt ein fehlendes Feld ab (AK3) an genau der Stelle, an der er schon `maxLevel` und
`buildTicks` prüft (`rules/load.ts:152-156`): `problems.push(...)`, und der Wurf am Ende sammelt
alle Fehler auf einmal (`load.ts:257`, `RulesError`). Kein neuer Mechanismus, eine Zeile im
bestehenden Muster. Ein Tag, der fehlt, wäre still Tag 1 — das ist der Grund für AK3.

Die Prüfung selbst steht **einmal**, in `packages/core/src/rules/unlock.ts` (neu):
`isUnlocked(rule, tick, rules) === Math.trunc(tick / rules.constants.ticksPerDay) + 1 >= rule.availableFromDay`.
Tag 1 ist der erste Tag. Bau und Aushebung rufen dieselbe Funktion, damit sie nicht auseinander
laufen können.

**(b) Ablehnung mit Grund.** Ein siebzehnter Wert für `CommandError`
(`commands/types.ts:130-146`): `NOT_YET_AVAILABLE`. Die Prüfung steht in `check` von `BUILD`
(`commands/build.ts:14-42`) und `RECRUIT` **nach** Eigentum und Regelsuche, aber **vor** der
Kostenprüfung (`build.ts:38-41`) — wer zu früh dran ist, soll „noch nicht" lesen und nicht „zu
teuer". Der Tag reist im schon vorhandenen `detail` mit (`fail(code, detail)`,
`types.ts:148-150`, `Record<string, string | number>`), damit die Oberfläche ihn nennen kann,
ohne ihn zweitzurechnen.

**(c) Filter für die KI** (R-TECH-02/AK2). `nextBuilding` (`packages/ai/src/economy.ts:26-42`)
ist eine Kette von fünf `if`s über Gebäudestufen; jedes bekommt die Freischaltung als zweite
Bedingung. Dasselbe an der einzigen `RECRUIT`-Quelle der KI (`economy.ts:91`, heute fest
`tank` oder `infantry`). Die KI braucht dafür **kein neues Sichtfeld**: `AiContext` führt
`view.tick` und `rules` bereits (`packages/ai/src/types.ts:21-28`), und die Regeln sind
öffentlich (D-08) — der Freischaltungstag einer Kaserne ist kein Wissen über eine fremde Macht,
R-DIP-04 bleibt unberührt. Messbar wird AK2 dadurch als Zahl: über N Spieltage erzeugt die KI
**null** `COMMAND_REJECTED` mit `NOT_YET_AVAILABLE`.

**(d) Der gesperrte Knopf** (R-TECH-02/AK1). Die Bauknöpfe entstehen aus Daten in
`apps/desktop/src/game/actions.ts` (App.tsx:82-83: *„Every order the player can give comes from
`game/actions.ts` as data"*). Ein gesperrter Knopf trägt den Satz „Ab Tag 8" an der Stelle, an
der heute die Kosten stehen — keine neue Farbe, kein neues Bauteil (Regel aus D18.1).

### D19.3 Das Verhältnis (R-DIP-06)

> **Gebaut am 2026-09-06 (T-M15-05).** `relationship(view, other, grievances, rules)` ist
> eine **reine Funktion über die öffentliche Sicht** — sie bekommt `PublicView` und sonst
> nichts, also ist R-AI-01 keine Zusage, sondern eine Eigenschaft der Signatur. Fünf
> Anteile: **Ansehen** (öffentlich, seit M6 geschrieben und bis heute von keiner Zeile
> gelesen), **Verstimmung** (gerichtet — ein Überfall macht das Opfer böse, nicht den
> Täter), **Bindungen** (Bündnis 300, Durchmarsch 150, geteilte Karte 50), **Krieg gegen
> meinen Verbündeten** und **Truppen an meiner Grenze**.
>
> Der letzte Anteil stand nicht im Entwurf und ist beim Bauen dazugekommen: **ohne ihn
> entsteht in einer Aufstellung ohne Vorgeschichte nie ein Krieg.** Ansehen startet beim
> Ausgangswert, Verstimmungen bei null, Bindungen bei null — das Verhältnis stünde bei
> 1000 und bliebe dort, und AK-1 (mindestens eine Kriegserklärung) wäre unerfüllbar.
> Truppen an der Grenze sind das, was ohne jedes Zutun entsteht, sobald zwei Mächte
> rekrutieren, und sie sind öffentlich sichtbar.
>
> **Das Verhältnis ist das Tor, die Stärke verschiebt nur seine Schwelle** — nicht
> umgekehrt. Vorher bekam ein schwächerer Nachbar die Kriegserklärung *immer*, gleich wie
> gut man sich verstand; ein Spiel, in dem Wohlverhalten nichts nützt, hat keine
> Diplomatie, sondern eine Rangliste. Umgekehrt macht Übermacht einen schwelenden Streit
> eher zum Krieg (bis zu 200 Punkte auf die Schwelle), und das soll sie.
>
> **Zwei Schwellen, nicht eine:** `warThreshold` misst das Verhältnis (meine Sicht auf
> dich), `trustThreshold` das Ansehen (was alle über dich wissen). Ein Wortbrüchiger kann
> mir sympathisch sein und bleibt trotzdem ein schlechter Bündnispartner.
>
> **Festgefahren statt unterlegen (AK4):** ein Krieg, in dem seit `stalemateDaysBeforePeace`
> keine Provinz mehr wechselte, wird beendet. Abgeleitet aus `occupiedSince` der sichtbaren
> Provinzen — **kein neues Zustandsfeld**, also auch keine zweite Schemastufe in M15.

`player.reputation` (`state/types.ts:204`) wird heute an **einer** Stelle geschrieben —
`phases/diplomacy.ts:31` zieht `surpriseAttackReputationLoss` ab (`constants.json:47`, 200) —
und von **keiner** Zeile in `packages/ai` gelesen; der einzige Treffer dort ist eine
Testvorgabe (`packages/ai/src/diplomacy.test.ts:38`). Lesen könnte die KI es auch nicht:
`PublicView.others` führt `id, name, nation, color, alive, score` und sonst nichts
(`view/publicView.ts:103`).

**Das Verhältnis ist eine abgeleitete Zahl, kein Zustandsfeld.** Das ist die tragende
Entscheidung dieses Abschnitts: ein gespeichertes Verhältnis bräuchte Migration, Hasheintrag
und eine Determinismuszusage; ein gerechnetes braucht keines davon. Es entsteht in
`packages/ai/src/relation.ts` (neu) aus fünf Anteilen, jeder 0…1000 in Festkomma, gewichtet wie
die Nutzenterme in `data/rules/default/ai.json`:

| Anteil | Woher | Richtung | Zustand? |
|---|---|---|---|
| öffentliches Ansehen | `view.others[].reputation` | hebt | **Sichtfeld neu** (öffentlich, Referenz 10.3) |
| eigene Verstimmungen | `state.diplomacy.grudges` | senkt | **Zustandsfeld neu** → Migration |
| Bündnis, gewährter Durchmarsch | `view.relations[other].state` / `.rightOfWay` | hebt | vorhanden (`publicView.ts:104`) |
| Krieg gegen meine Verbündeten | `view.wars` | senkt | **Sichtfeld neu** (Kriege sind öffentlich) |
| Bedrohung an der Grenze | `packages/ai/src/threat.ts` | senkt | vorhanden |

Zwei Sichtfelder sind neu, und beide sind nach R-DIP-04 sauber, weil ihre Quelle das
Öffentliche ist: Ansehen und geführte Kriege druckt im Original die Zeitung (Referenz 10.3).
`view.wars: [PlayerId, PlayerId][]` ist nötig, weil `view.relations` ausschließlich die
Beziehungen *zum Betrachter* führt — die KI kann heute nicht sehen, dass zwei andere Mächte
Krieg führen, und der Bündnisfall (AK2) ist ohne diese Sicht nicht baubar.

**Verstimmungen** sind das einzige echte neue Zustandsfeld von R-DIP-06:
`diplomacy.grudges: Record<string, Fixed>`. Eine Verstimmung ist **gerichtet** — A grollt B, ohne
dass B A grollt —, der Schlüssel also `${halter}>${ziel}` mit einem Trennzeichen, das sich vom
Beziehungsschlüssel `${a}|${b}` (dort mit `a < b`, `state/types.ts:226`) sichtbar unterscheidet.
**Iteriert wird niemals über `Object.keys(grudges)`**, sondern immer über
`playerOrder × playerOrder`: eine Verstimmung, die entsteht und wieder abklingt, änderte sonst
die Einfügereihenfolge und damit den Hash — derselbe Determinismusfehler, den die vorhandene
Sortierdisziplin (`playerOrder`, `armyOrder`) im ganzen Kern vermeidet (R-ARCH-01).

**Abklingen** (AK5) geschieht im Tageswechsel, der ohnehin schon einmal je Tag über alle Spieler
läuft und `player.score` schreibt (`phases/dailyTick.ts:20-21`): das Ansehen wandert um
`reputationRecoveryPerDay` Richtung Ausgangswert, jede Verstimmung schrumpft um
`grudgeDecayPermille`. Beide Konstanten neu in `constants.json`, beide in `BALANCING.md` mit
Status **geschätzt** (siehe die Warnung in D19.7).

**Die Entscheidung** (AK1) ersetzt die Zeile `packages/ai/src/diplomacy.ts:75-78`, die heute nur
bei deutlicher Übermacht Krieg erklärt (`threshold` 1200 bzw. 1600 auf das reine
Punkteverhältnis): Krieg, wenn `verhältnis < warRelation` **und** das Kräfteverhältnis die Stufe
nicht abschreckt; **kein** Krieg gegen einen schwächeren Nachbarn, solange das Verhältnis gut
ist. `warRelation` je Schwierigkeitsstufe in `ai.json` neben den bestehenden Gewichten.

**Wie die Erklärung es nennt** (AK6, R-AI-05): `Explanation` (`packages/ai/src/types.ts:30-39`)
bekommt **kein** neues Feld — die Anforderung verlangt Worte, und `reason` ist das Feld für
Worte. Damit der Satz nicht von Hand geschrieben wird, gibt `relationOf()` nicht nur die Summe
zurück, sondern ihre Teile: `{ total, parts: { reputation, grudge, alliance, alliedWar, threat } }`.
Der Satz entsteht aus dem betragsgrößten Teil — *„Verhältnis 240 von 1000, überwiegend Überfall
ohne Kriegserklärung (−300)"*. Ein Verhältnis, dessen ausschlaggebender Anteil sich nicht
benennen lässt, ist ein Verhältnis, das niemand nachvollziehen kann.

### D19.4 Feuerautomatik (R-BAT-08)

> **Gebaut am 2026-09-06 (T-M15-07).** Eine eigene Phase `bombardment` **zwischen Bewegung
> und Nahkampf**, und das ist zugleich die Behebung von Befund 52: `BOMBARD` setzt seither
> nur noch eine Absicht (`Army.bombardTarget`), aufgelöst wird sie dort — mit demselben
> Code und zum selben Zeitpunkt wie das selbsttätige Feuer. Vorher wirkte der Handbeschuss
> in Phase 1, der Nahkampf in Phase 8; eine Armee, die in diesem Tick abmarschierte, wurde
> noch am alten Ort getroffen, und mit einer Automatik hätte **dieselbe Kanone zwei Regeln**
> gehabt, je nachdem, wer abdrückt.
>
> **„Feuer halten" ist die Ausnahme**, nicht die Regel: eine stehende Fernwaffenarmee
> schießt von selbst. Andersherum wäre der Normalfall eine stumme Batterie an der Front
> gewesen, und niemand hätte den Unterschied bemerkt. Für Mensch und KI dieselbe Regel;
> die KI lässt eine Armee mit Reichweite und Ziel stehen, statt sie in den Nahkampf zu
> schicken — eine Artilleriearmee im Nahkampf ist eine schlechte Infanteriearmee.
>
> **Die Zielwahl ist bestimmt:** größte sichtbare Truppenstärke, bei Gleichstand die
> kleinere Provinzkennung, gelaufen über `provinceOrder` und `armyOrder`. Ohne feste Regel
> hinge das Ziel an der Einfügereihenfolge eines Records, und zwei Läufe mit demselben Seed
> gäben verschiedene Ergebnisse (R-ARCH-01).
>
> **AK3 ist offen**, und zwar begründet: im Turnier entsteht kein einziges selbsttätiges
> Beschussereignis, weil die KI auf der Testkarte nie eine Fabrik bezahlen kann. Die Kette
> ist Glied für Glied nachgemessen und in `PROBLEME.md` an T-M15-08 zugewiesen.

Drei Teile: wo geschossen wird, was getroffen wird, wie man es abstellt.

**Wo.** Nicht dort, wo der Beschuss heute liegt. `BOMBARD` ist ein gewöhnlicher Kommandohandler
(`commands/bombard.ts:51`), den `applyCommands` in Phase 1 sofort auflöst — während D3 den
Beschuss in Phase 8 (`combat`) führt (02-DESIGN.md:222) und daraus die zweite der „drei Regeln
aus der Phasenreihenfolge" ableitet (02-DESIGN.md:236-238). Gebaut ist keines von beidem
(Befund 52). R-BAT-08 verlangt Feuer „in jeder Kampfphase" — es gibt also **einen** Ort für
beide Schüsse: `BOMBARD` schreibt in Phase 1 nur die Absicht in den Zustand
(`army.bombardTarget: ProvinceId | null`), und die Kampfphase löst jeden Schuss auf, den
befohlenen wie den selbsttätigen, mit erneuter Reichweiten- und Kriegsprüfung. Andernfalls folgen
Handbeschuss und Feuerautomatik verschiedenen Regeln — dieselbe Krankheit wie zwei Spielschleifen,
eine Etage tiefer.

**Deterministische Zielwahl** (AK1/AK2). Die Kandidaten stehen schon bereit:
`provincesInRange(state, army.locationProvinceId, armyRange(army, rules), map)`
(`commands/bombard.ts:18-40` und `:42-49`), gefiltert auf Provinzen, mit deren Eigentümer Krieg
besteht — derselbe `atWar`-Filter, den die Handprüfung bei `bombard.ts:68-70` benutzt. Rangfolge:
**größte sichtbare Truppenstärke, bei Gleichstand die kleinste Provinzkennung** (AK2 nennt das
wörtlich). „Sichtbar" heißt durch dieselbe Aufklärung, die auch der Spieler hat
(`view/intel.ts`, `updateIntel` läuft in `phases/bookkeeping.ts:19`) — die KI zielt nicht auf
das, was sie nicht sehen darf. Die Spiegelung aus AK2 („WENN die Seiten vertauscht werden, DANN
gespiegeltes Ergebnis") ist ein Eigenschaftstest, kein Beispieltest.

**Feuer halten.** Ein neues Feld auf `Army` (`state/types.ts:161-177`): `holdFire: boolean`.
**Keine vierte `Stance`** (`types.ts:47`, `'aggressive' | 'defensive' | 'retreat'`): die Haltung
entscheidet über den Nahkampf, und „verteidigen, aber nicht schießen" muss möglich bleiben. Das
ist das zweite neue Zustandsfeld von M15 und damit die zweite Hälfte des Migrationsanlasses
(D19.5).

**Die vier Vorbedingungen aus M14.** Keine davon ist Arbeit an R-BAT-08 — alle vier machen den
Unterschied zwischen einer gebauten und einer wirksamen Feuerautomatik:

1. **Stapel-Deckel als Grenzbeitrag** (Befund 3). `rules/combat.ts:94` legt
   `stackContribution(units, rules)` als Faktor auf den *gesamten* Angriffswert der Armee; ab 50
   Einheiten ist er null. `phases/recruitment.ts:14-27` hängt jede fertige Einheit an die Armee,
   die schon in der Provinz steht. Eine selbsttätig feuernde Artilleriearmee wächst also von
   allein über 50 und richtet dann **exakt 0** Schaden an: gebaut, grün getestet, wirkungslos.
2. **Die KI baut Artillerie** (Befund 32). `packages/ai/src/economy.ts:91` wählt fest `tank`
   oder `infantry`; `armyRange` (`bombard.ts:43-49`) ist damit für jede KI-Armee 0, und AK3
   („ihre Artillerie SOLL im Turnier Beschussereignisse erzeugen") ist nicht erfüllbar —
   nicht schwer, sondern unmöglich.
3. **BOMBARD von Phase 1 nach Phase 8** (Befund 52) — siehe oben.
4. **Diplomatiefilter im Beschuss** (Befund 51). `apply` (`commands/bombard.ts:78-80`) verteilt
   den Schaden auf **alle** fremden Armeen der Zielprovinz, Verbündete und Neutrale
   eingeschlossen, während die Kampfphase über `atWar` und `!embarked` filtert
   (`phases/combat.ts:31,72,82`). Eine Feuerautomatik ohne diesen Filter beschießt jeden Tick
   ungefragt Verbündete.

### D19.5 Die Migration v1 → v2 (R-GAME-07)

> **Gebaut am 2026-09-06 (T-M15-04).** `SCHEMA_VERSION` ist 2, `MIGRATIONS` hat **genau
> einen** Schritt, und der legt alle drei M15-Felder leer an: `concerns` an jedem
> Protokolleintrag, `diplomacy.grievances` und `Army.holdFire`. Alle drei Werte sind
> neutral — ein leeres Betroffenenfeld heißt „geht niemanden an" (D19.1), ein leeres
> Verstimmungs-Record „niemand ist auf niemanden böse", `holdFire: false` heißt „feuert",
> also genau das Verhalten einer V1-Armee.
>
> **Der Umschlag führt die Version**, und `deserialise` erzwingt, dass der Zustand dasselbe
> sagt. Vorher gab es zwei Nummern und nur eine wurde geführt (Befund 56).
>
> **Kein Ladeweg ohne Prüfung** (Befund 55, das eigentliche Loch): nach einer Migration
> `validateState`, ohne Migration die Prüfsumme, ohne beides eine Ablehnung. Der alte Code
> prüfte `if (migrated.hash)` — und `migrate` entfernt den Hash selbst, weil er den
> Zustand *vor* der Umstellung beschreibt. Solange `MIGRATIONS` leer war, fiel das nicht
> auf; ab dem ersten echten Schritt wäre jeder migrierte Stand ungeprüft durchgelaufen.
>
> Gefahren wird der Schritt an einem **eingefrorenen echten V1-Stand**
> (`packages/core/test/golden/save-v1.json`), nicht an einer Testtabelle.

**Ausgangslage, belegt.** `MIGRATIONS` (`persistence/migrate.ts:35-38`) ist ein **leeres Objekt
mit einem auskommentierten Beispiel**; `SCHEMA_VERSION` steht auf 1 (`state/types.ts:298`). Der
Test füttert der Kette eine eigene Tabelle und einen erfundenen Zustand
(`migrate.test.ts:29`, `stateOf` bei `:11` castet `{ tick, marker }` zu `GameState`) — bewusst,
und die Datei sagt das bei `:5-9` selbst. **Die Kette ist nie an einem echten Fall gelaufen**,
und kein Test würde bemerken, wenn sie es aufhörte zu können.

Schlimmer: nach einem echten Schritt entfällt die letzte verbliebene Prüfung. `withoutHash`
(`migrate.ts:45-49`) entfernt den Hash — richtig, denn er beschreibt den Stand *wie geschrieben*,
nicht *wie migriert* —, und `deserialise` fragt danach nur noch `if (migrated.hash)`
(`save.ts:53`). Ein `else` gibt es nicht. **Ab dem ersten echten Migrationsschritt läuft jeder
migrierte V1-Stand ohne jede Prüfung durch** (Befund 55). Dazu die zweite Versionsnummer:
`state.schemaVersion` (`state/types.ts:270`, gesetzt in `state/create.ts:174`) wird von `migrate`
nie mitgeführt (`migrate.ts:58-59` kennt nur den Umschlag) — Befund 56.

**Wie ein Schritt aussieht.** Eine Datei, eine Funktion, ein Eintrag:
`packages/core/src/persistence/migrations/v1_to_v2.ts` — der Pfad, den D9 (02-DESIGN.md:606)
bereits nennt und den es nicht gibt. Registriert wird sie in der Tabelle bei `migrate.ts:35` als
`1: v1_to_v2`. Drei Regeln für jeden Schritt:

1. **Er setzt beide Versionsnummern.** `schemaVersion` im Umschlag *und* in `state`. Ein Schritt,
   der das Zustandsfeld vergisst, erzeugt dauerhaft Stände mit Umschlag 2 und Zustand 1: sie
   laden fehlerfrei, speichern fehlerfrei, bestehen jeden Test — und jede spätere Migration
   greift ins Leere.
2. **Er schreibt nur die neuen Felder, leer.** `armies[*].holdFire = false`,
   `diplomacy.grudges = {}`. Mehr entsteht in M15 nicht: die Zeitachse ist ein *Regel*feld
   (D19.2) und `concerns` gehört zum Ereignis, das nicht im Hash liegt (D19.1) — genau deshalb
   wurden beide dort verortet.
3. **Er ist vollständig.** Jede Armee, jedes Beziehungspaar — nicht „die, die da sind".

**Wie der Stand NACH der Migration geprüft wird**, in drei Stufen:

**(a) Struktur.** `validateState(state)` in `packages/core/src/persistence/validate.ts` (neu):
`tick` ganzzahlig, `schemaVersion === SCHEMA_VERSION`, und die drei Ordnungslisten
(`playerOrder`, `provinceOrder`, `armyOrder`) benennen ausschließlich vorhandene Einträge.
`deserialise` ruft sie **unbedingt** — nicht nur, wenn der Hash fehlt. Heute besteht ein leeres
Objekt `{}` die Eingangsprüfung bei `save.ts:46`.

**(b) Hashgleichheit nach der Migration.** Der alte Hash ist verloren und muss es sein. Der neue
lässt sich aber erzeugen: nach der Prüfung wird der migrierte Stand gespeichert und erneut
geladen, und beide Hashes müssen gleich sein — `hashValue(state, { omitKeys: HASH_OMIT_KEYS })`,
derselbe Aufruf wie in `save.ts:26` und `:54`. Das ist R-GAME-07/AK1 wörtlich, und es ist ein
Test, keine Laufzeitprüfung.

**(c) Der Stand als Datei.** Die einzige Prüfung mit echter Kraft: ein **eingecheckter** V1-Stand
unter `packages/core/test/fixtures/save-v1.json`, erzeugt mit dem heutigen `serialise` und danach
**nie wieder neu erzeugt**. Er läuft durch `deserialise`, danach 50 Ticks mit einer echten
Befehlsquelle, und das Ergebnis wird gegen den Lauf ohne Unterbrechung verglichen. Das schließt
nebenbei die Lücke, die niemand gesucht hat: `state.ai` wird von `storeMemories`
(`packages/ai/src/runner.ts:65-69`) **außerhalb** der Tick-Pipeline geschrieben
(`apps/desktop/src/game/advance.ts:29`) und ist damit genau der Zustandsteil, den eine Migration
still fallen ließe. Die einzige Fortsetzungsprüfung, die es heute gibt
(`persistence/save.test.ts:59`), läuft ohne Befehlsquelle und damit ohne KI.

### D19.6 Vorspulen in der Hülle (R-TIME-06) — die Entscheidung, die vorher fällt

> **Entschieden und gebaut am 2026-09-06 (T-M15-06): Weg (b).** `apps/desktop/src/sim/` ist
> gelöscht — 521 Produktionszeilen und 371 Testzeilen. Das Vorspulen liegt in
> `apps/desktop/src/game/fastForward.ts` und **ruft die Schleife des Kerns**; es rechnet
> nicht selbst. Die KI kommt über zwei neue Haken hinein: `commandSource` bekommt seit
> heute den **Zustand** statt nur der Tickzahl (mit einer Tickzahl allein konnte die KI dort
> gar nicht aufgerufen werden — *das* ist der Grund, warum die Oberfläche sich eine eigene
> Schleife gebaut hatte), und `afterTick` legt das Gedächtnis ab, ohne dass der Kern die KI
> kennen muss.
>
> **In Häppchen von 24 Ticks**, mit Abbruch dazwischen: bei den gemessenen 2,463 ms je Tick
> wären 30 Spieltage sonst ein paar Sekunden ohne Lebenszeichen, und 1000 Spieltage eine
> Minute. Der Grund des Halts erreicht die Oberfläche in Worten — Ziel erreicht, angehalten,
> Obergrenze, abgebrochen.
>
> Der Preis steht in DECISIONS.md: das Vorspulen rechnet im Hauptthread. Kommt der
> Hintergrundprozess wieder, dann in M16 gegen die *bestehende* Schleife und nicht neben ihr.

**Der Befund, nüchtern.** `apps/desktop/src/sim/` umfasst 521 Produktionszeilen (`SimEngine.ts`
285, `SimHost.ts` 136, `worker.ts` 64, `protocol.ts` 36) und 371 Testzeilen
(`SimHost.test.ts` 216, `worker.test.ts` 155). Die laufende Anwendung importiert daraus **eine
Konstante**: `SPEED_STOPS` in `apps/desktop/src/keyboard.ts:1` und `apps/desktop/src/ui/Header.tsx:2`.
Der Erreichbarkeitswächter ist zufrieden, weil `REACHABILITY_EXCEPTIONS`
(`test/guards/reachability.ts:104-111`) `worker.ts` und `SimEngine.ts` begründet ausnimmt und
`apps/desktop/src/index.ts:1-4` alle vier Module für andere Pakete re-exportiert. Die echte
Schleife steht in `App.tsx:330-351` und baut den Zwei-Tick-Deckel aus D5 ein zweites Mal nach.
Der Vorspulknopf (`App.tsx:656-658`) und die Taste `F` (`App.tsx:444-446`) rechnen
`step(ticksPerDay)`; `fastForwarding={false}` ist bei `App.tsx:650` fest verdrahtet, womit der
Abbruchzweig in `Header.tsx` toter Code ist. Die einzigen R-TIME-02-Tests liegen in
`SimHost.test.ts:35`, `:169` und `worker.test.ts:59` — gegen Code, den kein Spieler ausführt.

**Weg A — `SimEngine` verdrahten.**
*Dafür:* Was AK4 verlangt, ist gebaut und geprüft — `startFastForward` / `continueFastForward` /
`abortFastForward` (`SimEngine.ts:208-243`) mit `FAST_FORWARD_BATCH = 250` (`:44`) und dem
Kommentar bei `:200-207`, der genau begründet, warum Häppchen die *einzige* Art sind, einen
Abbruchknopf funktionieren zu lassen. Die Verdichtung ab Tempo 10 (`SimEngine.ts:152-172`) ist
eine D5-Zusage und existiert nirgends sonst. `SimHost` führt den Abbruchzustand, den `Header`
braucht (`SimHost.ts:57-59`, `:84-91`). Und AK5 (C-11) — kein Tempo, keine Pause, kein Ziel im
Zustand — wird zur Eigenschaft der Bauart, weil `protocol.ts` von Bau an keinen `GameState`
trägt (`protocol.ts:3-10`).
*Dagegen:* `App.tsx` hält den Zustand selbst; Speicherdialog, Panels und jeder Kommandopfad lesen
ihn. `SimEngine` besitzt ihn privat (`#state`, `SimEngine.ts:63`; `debugState` bei `:101` ist
absichtlich so benannt, dass es auffällt). Verdrahten heißt, die gesamte Zustandsführung von
`App.tsx` hinter die Leitung zu verlegen — im selben Meilenstein, in dem die KI umgebaut wird.
Dazu kommt `storeMemories` außerhalb der Pipeline (`advance.ts:29`), das mitwandern muss.

**Weg B — die Schleife in `App.tsx` erweitern, `sim/` löschen.**
*Dafür:* billig. Die Schleife bei `App.tsx:330-351` bekommt eine zweite Betriebsart, die
`fastForward` aus dem Kern (`clock.ts:138`) mit `maxTicks` je Bild aufruft und beim
zurückgegebenen Grund anhält. AK1 ist dann **wörtlich** erfüllt — dieselbe Kernfunktion, keine
zweite Schleife —, und AK4 fällt aus `requestAnimationFrame` heraus. Die 521 toten Zeilen zählen
nicht länger in die Gesamtabdeckung (`scripts/verify.mjs`, `TOTAL_LINE_THRESHOLD = 80`).
*Dagegen:* 892 Zeilen samt Tests werden weggeworfen, die Verdichtung ab Tempo 10 muss neu gebaut
oder aufgegeben werden (dann ist D5 an dieser Stelle zurückzunehmen), und ein späterer
Hintergrundprozess oder Mehrspielerbetrieb (D13, R-ARCH-04) beginnt bei null.

**Was in beiden Fällen gleich bleibt:** die Zielauswahl ist ein Menü in `Header.tsx` mit den fünf
Zielen aus R-TIME-03; der Haltegrund wird in Worten genannt (`StopReason` ist
`'target' | 'alert' | 'limit'`, `clock.ts:23`, plus `'aborted'` aus der Hülle, `protocol.ts:30`);
und das Vorspulen liest `concerns` aus D19.1 und sonst nichts.

**Diese Entscheidung wird hier nicht getroffen — sie wird benannt.** Sie fällt vor der ersten
Zeile von R-TIME-06, nicht währenddessen, und sie gehört mit ihrer Begründung in `DECISIONS.md`,
nicht in eine Aufgabe. Beide Wege sind besser als der Status quo; der einzige nicht wählbare Weg
ist, sie offen zu lassen und die Hülle nebenbei zu entscheiden.

### D19.7 Reihenfolge und Risiko

**Vorbedingungen außerhalb von M15** — sämtlich Reparaturaufgaben aus M14. Ohne sie ist die
jeweilige M15-Anforderung nicht *abnehmbar*, nicht bloß unbequem:

| Vorbedingung (Befund) | Blockiert |
|---|---|
| Stapel-Deckel als Grenzbeitrag (3) | **R-BAT-08** — sonst richtet die selbsttätig gewachsene Artilleriearmee 0 Schaden an |
| KI baut Artillerie (32) | **R-BAT-08/AK3, R-AI-08/AK3** — `armyRange` ist für jede KI-Armee 0 |
| BOMBARD in Phase 8 (52) | **R-BAT-08** — sonst zwei Regeln für denselben Schuss |
| Diplomatiefilter im Beschuss (51) | **R-BAT-08** — sonst trifft die Automatik Verbündete |
| KI-Erreichbarkeit in `rateProvinces` (11, 31, 43) | **R-DIP-06/AK1** — „greift auch eine gleich starke Macht an" ist unmessbar, solange 3.046 von 4.464 Marschbefehlen `NO_PATH` sind |
| Ladeprüfung nach der Migration (55, 56) | **R-GAME-07** |
| Dauerhafter Speicher-Port (1, 4, 6) | **R-GAME-07/AK1** — sonst wird „ein V1-Stand läuft weiter" wieder gegen `MemoryStorage` abgenommen |
| Plan-Wächter und `scope`-Block (5, 7, 15, 22, 61) | **jede** M15-Aufgabe — sonst wird sie falsch gebucht |
| Eine einzige Spielschleife (33, N3) | **R-TIME-06/AK1** wörtlich, und jede Balancezahl aus M15 |
| Zweite Turnierpaarung „schwer gegen normal" (14, 25) | **R-DIP-06/AK1** — siehe Risiko unten |

**Innerhalb von M15:**

```
D19.1  Betroffenheit am Ereignis + BATTLE_STARTED      <- das gemeinsame Substrat
  |- R-TIME-06/AK1..AK3
  |- Filter "Weltgeschehen" (Ersatz fuer R-NEWS-01/02/03)
  '- Meldung "an mich gerichtet"

R-TECH-01 -+- R-TECH-02 (Oberflaeche)
           '- R-AI-08   (die KI waehlt nichts Gesperrtes)

PublicView.offers -+- R-DIP-06/AK3 (Buendnisangebot annehmen)
                   '- R-AI-08/AK2

R-DIP-06 (Verhaeltnis) --- R-AI-08/AK2 --- Begruendung nach R-AI-05

R-GAME-07 : entsteht MIT dem ersten neuen Zustandsfeld (holdFire oder grudges), nie danach.
R-AI-08/AK3 : Integrationstor, steht zuletzt.
```

**Reihenfolge:** (1) das Substrat aus D19.1 — es trägt vier Anforderungen und wird sonst viermal
verschieden improvisiert; (2) R-TECH-01/02, die billigste Anforderung mit der größten Wirkung auf
das erklärte Problem; (3) R-GAME-07, zusammen mit dem ersten neuen Zustandsfeld; (4) R-DIP-06,
nach der KI-Erreichbarkeit; (5) R-TIME-06, nachdem die Entscheidung aus D19.6 gefallen ist;
(6) R-BAT-08, nach seinen vier Vorbedingungen; (7) R-AI-08 als Integrationstor.

**Das größte Risiko ist nicht die Technik, sondern die Messung.** Regel 3 aus 2.15 verlangt jede
neue Zahl mit Status in `BALANCING.md` — in ein Dokument, dessen bestehende Zahlen aus einem
Parameterlauf mit der falschen Schleife (Befund 33) und aus einer Eroberungszählung über einen
500er-Ringpuffer (Befunde 24, 45, 62) stammen. `warRelation`, `reputationRecoveryPerDay`,
`grudgeDecayPermille` und jedes `availableFromDay` sind bis zur Reparatur der Messgeräte
**geschätzt**, und sie so einzutragen ist Pflicht, nicht Bescheidenheit. Ein Status „belegt" vor
dem neuen Lauf wäre derselbe Fehler eine Etage höher.

Drei weitere Stellen, die der Plan benennen muss:

- **R-DIP-06/AK1 ändert zwei Richtungen gleichzeitig** — die KI soll eine gleich starke Macht
  angreifen *und* einen schwächeren Nachbarn bei gutem Verhältnis in Ruhe lassen. Das Turnier
  steht in allen sechs Läufen 25:25 (Befund 14) und kennt keine Paarung „schwer gegen normal";
  ohne sie ist die Änderung Blindflug. Die zweite Paarung gehört **vor** R-DIP-06.
- **`EVENT_LOG_LIMIT = 500`** (`phases/bookkeeping.ts:12`). Der Filter „Weltgeschehen" liest
  denselben Ringpuffer, in den die KI heute rund 9.000 abgelehnte Befehle je Partie schreibt
  (Befund 44). Bis M14 das abstellt, zeigt der Filter eine Stunde Weltgeschichte statt eines
  Tages — die Mechanik wäre gebaut und der Eindruck falsch.
- **Feld und Versionssprung gehören in denselben Schritt.** Ein `holdFire`, das ohne Anhebung von
  `SCHEMA_VERSION` eingeführt wird, erzeugt Stände, die Version 1 behaupten und Version 2 sind.
  Die Migration kann sie danach nicht mehr erkennen, und kein Test schlägt an.

**Der Prüfstein am Ende ist keine Testzahl**, sondern eine Turnierpartie, in der eine KI-Macht
eine gleich starke Nachbarin angreift, ihre Artillerie ohne Befehl feuert und vor Tag 8 keine
Fabrik bestellt — drei Ereignisse, die es heute nachweislich nicht gibt.
### D19.8 Weltgeschehen statt Zeitung (R-NEWS-04)

Die Zeitung aus R-NEWS-01/02/03 wird nicht gebaut (Entscheidung 3 vom 2026-09-05). An ihre
Stelle tritt ein **Filter im bestehenden Ereignisprotokoll** — dasselbe Material, ein
Anzeigezustand statt eines zweiten Erzeugnisses.

**Warum das kein Verzicht ist.** R-NEWS-02 verbot der Zeitung ausdrücklich Mengen, Vorräte,
Truppen und Gebäude. Was danach bleibt, ist eine Liste öffentlicher Ereignisse — und die
liegt bereits vollständig im Protokoll, dessen Filterbarkeit R-GAME-06 seit M5 fordert und
dessen Anspringbarkeit R-UI-14/AK1 seit M13 liefert. Die Zeitung hätte diesen Strom ein
zweites Mal aufgeschrieben.

**Und warum die Ersparnis größer ist, als sie aussieht.** Eine Ausgabe, die „im Spielstand
liegt“ (R-NEWS-01/AK1), wäre ein neues Zustandsfeld mit Ringpuffer und Migration — und sie
liefe **in den Simulationshash**: `HASH_OMIT_KEYS` (`packages/core/src/state/types.ts`) nimmt
heute allein `eventLog` aus. Eine andere Formulierung einer Schlagzeile hätte damit
Golden-Master und Wiedergabe gebrochen, also eine Textänderung zu einer Regeländerung
gemacht. Der Filter fasst den Zustand nicht an.

**Die Positivliste** ist dieselbe, die die Zeitung gedruckt hätte: Kriegserklärung, Wechsel
des diplomatischen Zustands, Eroberung, Verlust einer Hauptstadt, Aufstand, ausgeschiedene
Macht, entschiedene Schlacht, Partieende. Sie steht als Datum neben dem Filter, nicht als
`if` in der Anzeige — dieselbe Liste beantwortet später auch die Frage, was Lektüre ist und
was Alarm (D19.1).

**Die eine Regel, die der Filter braucht:** Weltgeschehen zeigt auch, was **zwischen fremden
Mächten** geschieht, hält aber niemandes Vorspulen an. Das ist genau die Unterscheidung aus
D19.1 — öffentlich heißt sichtbar, nicht dringend. Ohne sie würde die Eroberung zweier
Unbeteiligter am anderen Ende der Welt den Spieler aus seinem Vorspulen reißen, und
R-TIME-06/AK2 wäre gebrochen, kaum dass es gebaut ist.

---

## D20. Verpackung als Programm (M16 — R-PKG-01, R-PKG-02, R-UI-15; dazu R-AI-04 und R-ARCH-06/AK2)

**Was dieser Meilenstein tut, und was er ausdrücklich nicht tut.** M16 baut kein Spiel. Er
führt zum ersten Mal den Auslieferungspfad aus und richtet die Messgeräte auf das
Erzeugnis, das entsteht. Er liegt hinter M14 und M15, weil ein Bau, der ein unfertiges
Spiel verpackt, nichts beweist, was M14 nicht billiger beweisen kann.

### D20.1 Der Bau (R-PKG-01)

Heute prüft `test/guards/packaging.test.ts` `tauri.conf.json` gegen
`capabilities/local-only.json` — zwei Dateien, die derselbe Mensch am selben Tag geschrieben
hat. Der Wächter ist gut für das, was er prüft (R-FREE-04 in der Konfiguration), aber er
bleibt **auch dann grün, wenn nie ein Bau lief**. Deshalb bekommt er einen zweiten Teil, der
an Dingen hängt, die nur ein Bau erzeugt: ein Eintrag für `@tauri-apps/cli` im Lockfile,
`Cargo.lock`, das Anwendungssymbol.

**Die Reihenfolge ist wichtig und nicht beliebig.** Erst das Symbol, dann die Abhängigkeiten,
dann der Bau — denn `tauri.conf.json` verlangt `icons/icon.png`, und ein Bau, der daran
scheitert, sagt nichts über den Rest. Das Symbol wird selbst erzeugt (R-ASSET-01: keine
Fremdassets) aus dem, was das Spiel schon hat.

**R-FREE-04 gilt im Erzeugnis weiter** (AK2). Die Zusicherung wandert dabei nicht von der
Konfiguration weg — sie bekommt eine zweite Stelle, an der sie am Gebauten hängt.

### D20.2 Der Datei-Port (R-PKG-02)

`createStorage` ist seit T-M14-08 die eine prüfbare Stelle, an der entschieden wird, wohin
gespeichert wird, und `storagePortContract` läuft gegen zwei Umsetzungen. Der Datei-Port
tritt als **dritte** hinzu und ändert an beidem nichts: er erfüllt denselben Vertrag oder er
ist falsch. Damit löst M16 die Zusage von T-M8-00 ein — „dieselbe Vertragstestreihe läuft
gegen alle drei Umsetzungen" —, die seit M8 dastand und deren Dateien nie existierten.

**Die zweite Prüfung ist die eigentliche** (AK2): ein außerhalb des Programms gelöschter
Stand verschwindet aus der Liste. Ohne sie könnte ein Port, der die Namen nur im Speicher
führt und beim Start einmal einliest, grün sein — genau die Art von Umsetzung, die im
Vertrag nicht auffällt, weil der Vertrag den Prozess nie verlässt.

### D20.3 Die Messgeräte am Erzeugnis (R-AI-04, R-ARCH-06/AK2)

Zwei Zusicherungen messen bis heute etwas anderes, als ihr Wortlaut sagt.

**R-AI-04** verlangt den Anteil „bei 8 KI-Spielern" und wird auf zwölf Provinzen mit drei
Mächten gemessen (PROBLEME.md, 2026-09-06). Die Korrektur ist dieselbe wie bei R-ARCH-06/AK1
am selben Tag: die Messung zieht auf die ausgelieferte Weltkarte. Der Weg dahin führt über
`publicView`, denn rund 97 % der gemessenen KI-Zeit ist ihr Bau. Drei Beobachtungen, die den
Entwurf tragen:

1. **`visibleProvinces` läuft zweimal je Macht und Tick** — einmal in `updateIntel`, einmal
   in `publicView`. Die zweite Rechnung ist dieselbe wie die erste, im selben Tick, über
   denselben Zustand. Das ist der billigste Schnitt: er ändert keinen Vertrag und keine
   Sicht.
2. **Die Geografie wird je Macht und Tick neu abgeschrieben.** Sieben Felder jeder
   `VisibleProvince` — `id`, `name`, `kind`, `terrain`, `coastal`, `neighbors`, `seaLinks` —
   ändern sich in einer Partie nie. Auf der Weltkarte sind das 237 Provinzen mal acht Mächte
   mal jeden Tick. Der unveränderliche Teil lässt sich einmal je Karte bauen und teilen; was
   je Macht bleibt, ist Besitzer, Sichtbarkeit und das Erinnerte.
3. **Der Nenner ist der Tick, der Zähler die Sicht.** Ein Anteil, der wächst, kann von beidem
   kommen. Die Messung schreibt deshalb beide Zahlen einzeln fort, nicht nur den Quotienten.

**Ob R-AI-04 unter seinen eigenen Bedingungen gehalten wird, ist bis heute ungemessen.**
Fällt die Messung auf der Weltkarte gegen die Anforderung aus, ist das eine Entscheidung
wie bei R-ARCH-06 am 2026-09-06 — nachmessen, begründen, in `DECISIONS.md` eintragen. Die
Grenze anzuheben, damit die Zahl passt, ist ausdrücklich nicht der Weg; die Zusicherung im
Bench darf nach M16 auch nicht mehr lockerer sein als die Anforderung, die sie vertritt.

**R-ARCH-06/AK2** (60 FPS beim Zeichnen) misst niemand: `MapCanvas` läuft in keinem Test,
weil `getContext` in der Testumgebung `null` liefert — 141 von 249 Zeilen unausgeführt.
Am gebauten Programm existiert ein Zeichenkontext, und damit wird die Zusicherung zum
ersten Mal überhaupt prüfbar.

### D20.4 Bedienbar ohne Maus (R-UI-15)

Belegt ist heute der Kontrast (R-UI-02) und die Tastenzuordnung als reine Funktion
(R-UI-06). Was fehlt, ist die Ebene dazwischen: **kein Test öffnet einen Dialog und schließt
ihn**. Fokusfang und Escape sind keine Eigenschaften einer Funktion, sondern eines
laufenden Baums — sie gehören deshalb hierher und nicht in M10.

Der Entwurf ist bewusst klein: ein Fokusfang, der beim Öffnen den ersten fokussierbaren
Knopf wählt und Tab im Dialog hält, Escape als Schließen, und ein Wächter, der jedes
Bedienelement ohne sichtbaren Text mit einem Namen für Hilfsmittel findet. Kein
Barrierefreiheits-Rahmenwerk, keine neue Abhängigkeit — die Prüfung ist die Zusage.

## D21. Die Karte zeigt, was da ist (M19 — R-MAP-08, R-MAP-09)

Noah hat beim Abnahme-Playtest am 2026-09-07 gemeldet, im Westen der USA und in Nordkanada
überlappe der Ozean das Land. Die Untersuchung hat etwas anderes gefunden: **es überlappt
nichts.** Es fehlt.

### D21.1 Die Ursache — ein Ausdruck, 130 Provinzen

`scripts/build-map.mjs:366-370` schreibt `world.json` aus `world-shapes.json` und behält je
Provinz **einen** Umriss:

```js
p.geometry.coordinates.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]
```

`a[0].length` ist die **Zahl der Punkte**. Nicht die Fläche. Für „Westen der USA" wählt das
Alaskas Küste (1521 Punkte) und wirft die zusammenhängenden Weststaaten weg (320 Punkte) —
Alaskas Fjorde brauchen viele Stützpunkte, die geraden Vermessungslinien Nevadas wenige.

Der Renderer malt zuerst das Meer über die ganze Leinwand und dann die Provinzen darüber
(`MapCanvas.tsx:119`). Ein weggeworfener Umriss ist deshalb nicht *unsichtbar*, sondern
**Meer** — genau das, was Noah gesehen hat.

Gemessen: **3156 von 3393 Umrissen (93 %) verworfen, 14,2 % der Landfläche, 130 von 237
Provinzen betroffen.** Der schwerste Fall ist nicht der gemeldete: `CAN-NORTH` behält 11,6 %
von sich — es zeichnet die Baffininsel und verliert das Festland. Los Angeles, Seattle,
Denver, Tokio, Kuala Lumpur und Kopenhagen liegen in `world.json` im offenen Meer.

### D21.2 Die Falle in der naheliegenden Reparatur

„Dann nimm eben den **größten** Ring statt den mit den meisten Punkten" — und genau hier
scheitert es, wenn man nicht nachrechnet:

| Ring | Punkte | echte Fläche | nach Mercator |
|---|---|---|---|
| Alaska | 1521 | 267,8 Grad² | **84 453 px²** |
| Weststaaten | 320 | **328,6 Grad²** | 58 147 px² |

Mercator bläht hohe Breiten mit 1/cos²(φ) auf; Alaska wird dadurch um das Viereinhalbfache
größer gezeichnet, als es ist. **Wer die Fläche nach der Projektion misst, wählt wieder
Alaska.** Ein Einzeiler, der plausibel aussieht und den gemeldeten Fehler nicht behebt.

### D21.3 Die Entscheidung: eine Provinz darf mehrteilig sein

Der eigentliche Grund für die Auswahl steht in `packages/core/src/state/types.ts:77`:

```ts
polygon: ReadonlyArray<readonly [number, number]>
```

**Ein** Ring. Das Datenmodell kann „Alaska und Kalifornien gehören derselben Provinz" nicht
ausdrücken, also musste der Generator wählen — und niemand hat aufgeschrieben, dass er wählt.
Jeder andere Block in `build-map.mjs` trägt einen erklärenden Absatz; diese fünf Zeilen
tragen keinen.

Die Reparatur ist deshalb nicht die bessere Auswahl, sondern **keine Auswahl mehr**:
`polygon` wird zu einer Liste von Umrissen. Was dafür spricht:

- `polygon` ist **reine Zeichendatei** — nachgemessen am 2026-09-07, nicht angenommen: ein
  `grep` über `packages/core/src`, `packages/ai/src` und `apps/headless/src` findet **einen**
  Leser, `validate.ts:112`. Der Kern liest es außerhalb von `validateMap` nicht,
  die KI nie, und Spielstände enthalten die Karte nicht — **keine Migration, kein Golden
  Master**, kein Schemaschritt. Das ist der Grund, warum der richtige Weg hier billig ist.

  **Und die Folgerung, die daran hängt:** die Reparatur ändert die *Partie* nicht. Eine
  Provinz gehörte schon vorher, wem sie gehört; ihre Bevölkerung und ihre Vorkommen stehen
  als Attribute da und werden nicht aus der Fläche gerechnet. Was sich ändert, ist, was man
  **sieht** — und was man **anklicken** kann. AK-1 ist davon unberührt, und das ist keine
  Hoffnung, sondern eine Folge des Befundes darüber.
- Alles behalten kostet +48 % Punkte. Umrisse ab 25 px² behalten kostet **+26 %** und holt
  **99,79 %** der Landfläche zurück; nur 56 Provinzen brauchen dann mehr als einen Umriss.

Die Zwischenstufe (größter Ring nach **echter** Fläche, nicht nach projizierter) bleibt als
Sofortmaßnahme möglich — sie repariert die vier verschobenen Provinzen und lässt 6,7 % der
Landfläche fehlen. Sie ist ein Stopp der Blutung, nicht die Naht.

### D21.4 Die Wächter, die es hätten finden müssen

Kein Test im Projekt sagt irgendetwas über `polygon`. `validateMap` prüft eine einzige
geometrische Eigenschaft: `polygon.length >= 3`. Der eine Test, der geografische Lage prüft
und sogar `USA-WEST` beim Namen nennt, zeigt auf `world-shapes.json` — die Quelle, wo die
Geometrie richtig ist. Das ist Befund N9 der Auswertung vom 2026-09-05 („kein Test bindet
`world.json` an die Pipeline"), offen und ohne Besitzer.

Drei Prüfungen, jede allein hinreichend, **alle drei heute rot**:

| | Prüfung | heute |
|---|---|---|
| G1 | Der Ankerpunkt liegt in der eigenen gezeichneten Fläche | 4 von 237 fallen |
| G2 | Die gezeichnete Fläche trägt ≥ 99 % der Quellfläche | 130 von 237 fallen |
| G3 | Bekannte Städte liegen an Land | 10 von 28 fallen |

G2 ist die vollständige: ein reiner Datenvergleich zweier Dateien, die beide im Baum liegen,
ohne Zeichnen, und sie wäre in dem Moment rot geworden, in dem der Generator den ersten Ring
verworfen hat.

**Ein Wächter, der heute rot ist, wird nicht stillschweigend eingebaut** (Lehre vom
2026-09-06): er wird gemessen, berichtet und einer Aufgabe zugewiesen. Deshalb ist die
Reihenfolge in M19: erst messen und die Zahl festhalten, dann reparieren, dann den Wächter
scharf schalten.

### D21.5 Was ausdrücklich **nicht** gemacht wird

- **Kein Tor auf Selbstüberschneidung.** 35 von 237 Provinzen haben Überkreuzungen, fast alle
  ein Pixel groß und Folge des Rundens auf ganze Bildpunkte. Die `nonzero`-Füllregel versteckt
  sie vollständig. Ein Tor darauf wäre 35-mal rot für einen Fehler, den niemand sieht.
- **Kein Neu-Herunterladen.** `world-shapes.json` liegt im Baum und ist vollständig richtig.
> ⚠ **Eine Aufgabe in M19 ist ausdrücklich KEINE reine Zeichenänderung: T-M19-04.**
> `AUS-SE` steht in Australiens Startaufstellung, trägt 52 097 Einwohner, zwei Vorkommen und
> drei Kanten. Sie zu entfernen ändert die Wirtschaft einer Macht und den Graphen — also die
> Partie, also AK-1. Deshalb ist die sichere Richtung dort, ihr die Fläche zu **geben**, die
> ihr Name behauptet, statt sie zu streichen; und wenn gestrichen wird, gehört ein neuer
> `sim:fullgame` dazu. Die übrigen vier Aufgaben rühren an keine Zahl, die das Spiel liest.

- **Grönland** läuft oben aus der Leinwand (796 Punkte bis y = −436). Das ist ein eigener,
  kleinerer Fehler (der 78°-Beschnitt wird nie geklippt) und bekommt eine eigene Aufgabe.

## D22. Die Karte spricht mit (M20 — R-UI-16, R-UI-17; dazu die Lücken in R-UI-10 und R-UI-11)

Noahs zweiter Wunsch: „Bilder/Icons ins UI miteinarbeiten" für ein interaktiveres Gefühl.
Bevor irgendetwas entworfen wird, der Bestand — denn er ist überraschend gut und überraschend
schmal zugleich.

### D22.1 Was da ist

**Null Bilder.** Der Baum enthält acht Binärdateien: vier Tauri-Programmsymbole (von
`scripts/build-icon.mjs` **gezeichnet**, nicht geladen) und vier Schriftschnitte. Keine
Illustration, kein Porträt, keine Textur, keine Flagge.

Die gesamte Bildsprache sind **27 Symbole in einer Datei** (`apps/desktop/src/ui/icons.tsx`,
6,2 kB) — je ein SVG-Pfad in einem 24×24-Feld, in `currentColor` gestrichen. Der ganze Satz
kostet **2854 Byte Quelltext**. Dieselben Pfadzeichenketten zeichnet die Karte über `Path2D`,
weshalb ein Panzer im Panel und auf der Karte nicht auseinanderlaufen *können*.

Die Anmutung ist Richtung A „Lagekarte": Leinen (#E4E0D2), Tusche (#1F2420), und Zinnober
(#B3341E) **ausschließlich** für Kampf und Alarm.

### D22.2 Die Grenzen — und sie sind maschinell bewacht

Bildsprache fehlt hier nicht aus Nachlässigkeit, sondern ist **eingezäunt**:

| Grenze | Wo | Folge |
|---|---|---|
| `<img ` ist im Produktionscode verboten | `test/guards/no-foreign-assets.test.ts:106` | jede `<img>`-Lösung bricht `pnpm verify` |
| Jede Binärdatei braucht einen Eintrag in `docs/ASSETS.md` | derselbe Wächter, :74 | eine Bilddatei ist eine Zwei-Dateien-Änderung |
| Fremde Grafik ist verboten | R-ASSET-01/02, CSP `connect-src 'none'`, `no-network` | vierfach gesperrt, kein Abwägen |
| Der helle Grund ist festgeschrieben | `test/design-gate.test.ts` | keine dunkle oder fotografische Fassung |
| 16,7 ms je Bild bei p95 | `render.bench.slow.test.ts` | neue Zeichenarbeit misst sich daran |

Das ist kein Hindernis, sondern die Antwort auf die Frage „welche Art Bild?": **gezeichnete,
die aus dem eigenen Satz kommen.** Der billigste Weg ist zugleich der einzige, der durch alle
Wächter geht — ein neuer Pfad in `icons.tsx` kostet eine Zeichenkette, ist sofort auf der
Karte *und* im Panel verfügbar und verletzt nichts.

### D22.3 Zuerst die Lücken in dem, was schon zugesagt ist

Bevor Neues dazukommt: **R-UI-10 nennt den Beziehungszustand** und es gibt kein Symbol dafür.
**R-UI-11 nennt die Geländeart** und sie steht als Wort da. Beides sind V1-Anforderungen.
Unbemerkt blieb es, weil R-UI-10/AK1 nur nach Gebäude und Einheit fragt — ein Kriterium, das
einen Teil des Versprechens prüft und den Rest erfüllt aussehen lässt. Dieselbe Bauart wie
AK-7 vor seiner Reparatur am 2026-09-07.

### D22.4 Wo ein Zeichen mehr trägt als ein Wort

Gemessen an den Komponenten, nicht geraten:

| Ort | heute | was fehlt |
|---|---|---|
| Diplomatie | `<td>{nameOf(other.id)}</td>` | die Kartenfarbe der Macht (R-UI-16) |
| Beziehungszustand | das deutsche Wort | ein Symbol (R-UI-10, zugesagt) |
| Geländeart | das deutsche Wort | ein Symbol (R-UI-11, zugesagt) |
| Ereignisprotokoll | Zeit + Prosa | die Rubrik als Zeichen — `categoryOf` gibt es längst |
| Armeen im Panel | `{army.name} · Stärke …` | das Gattungszeichen — `dominantIcon()` gibt es längst |
| Markt | `<select><option>` | **strukturell unmöglich**, `<option>` trägt kein SVG |

Dreimal steht „gibt es längst": die Größe wird bereits berechnet und nicht gezeigt. Das ist
die billigste Art Verbesserung, die es gibt, und dieselbe Bauart wie die Playtest-Befunde
vom 2026-09-06 — gebaut, getestet, unerreichbar.

Der Markt ist die Ausnahme, die eine Entscheidung braucht: ein `<option>` kann kein Bild
tragen. Entweder er bleibt, wie er ist, oder das Auswahlfeld wird eine eigene Liste — und
das ist Bedienbarkeit gegen Aussehen, also nichts, was ein Agent allein entscheidet.

### D22.5 „Interaktiver" heißt Rückmeldung, nicht Zierde

R-UI-17 ist der Teil des Wunsches, der nicht Symbole meint. Und hier liegt eine offene
Zusage: **R-UI-04 verspricht „Bewegungs- und Kampfanimationen", und nur die Kampfhälfte
existiert.** Sie ist V1-pflichtig und nicht vertagt.

Zwei Bremsen sind dabei einzuhalten, beide bereits gebaut und begründet:
`motionAllowed(speed, reduced)` schaltet jede Bewegung oberhalb einer Tempogrenze und unter
`prefers-reduced-motion` ab — „bei hundert Spielstunden je Sekunde würde der Ring stroboskopieren,
und das ist keine Atmosphäre, sondern eine Störungslampe". Und die 16,7 ms.

Dazu kommt ein Risiko, das benannt gehört: `MapCanvas` ist die am schlechtesten abgedeckte
Datei der Oberfläche (seit T-M16-06: 168 von 249 Zeilen). Bewegung dort einzubauen ist die
riskanteste Stelle des ganzen Meilensteins — deshalb steht sie am Ende und nicht am Anfang.
