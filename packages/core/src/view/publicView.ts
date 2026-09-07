import { armyHp } from '../state/army'
import { relationKey } from '../state/create'
import type {
  ArmyId,
  BuildingKey,
  DiplomaticState,
  GameState,
  PlayerId,
  ProvinceId,
  ResourceKey,
  Stance,
  Terrain,
  Tick,
} from '../state/types'
import type { Fixed } from '@worldwar/shared'
import type { Rules } from '../rules/types'
import { economyOverview, type EconomyOverview } from './economy'

/**
 * What one player may see (R-DIP-04, T-M6-02).
 *
 * This is the only thing that leaves the simulation towards a player — the interface
 * and the AI both receive it and nothing else. Two consequences follow, and both are
 * the point:
 *
 *  - The fog of war is real. A player cannot read the full state out of the interface,
 *    out of a save file, or out of a network packet, because it never gets there.
 *  - The AI provably cannot cheat: it decides from the same view a human would have
 *    (R-AI-01).
 */

export interface VisibleProvince {
  id: ProvinceId
  name: string
  owner: PlayerId | null
  kind: 'city' | 'rural'
  /**
   * Die Gelaendeart, mit dem Typ der Karte statt als blosses 'string' (T-M20-01).
   *
   * Der Wert kam schon immer aus `MapProvince.terrain` und war nie etwas anderes; als
   * `string` deklariert hat er nur den Compiler daran gehindert, das zu wissen — und
   * jede Oberflaeche, die ein Zeichen dazu nachschlagen will, zu einer Behauptung
   * gezwungen.
   */
  terrain: Terrain
  coastal: boolean
  neighbors: readonly ProvinceId[]
  seaLinks: readonly ProvinceId[]
  /**
   * Seit wann diese Provinz ihrem jetzigen Eigentümer gehört (T-M15-05, R-DIP-06/AK4).
   *
   * Öffentlich: wer eine Provinz erobert, tut das vor aller Augen. Daraus — und nur
   * daraus — leitet die KI ab, ob ein Krieg festgefahren ist; ein eigenes Zustandsfeld
   * dafür hätte eine zweite Schemastufe in M15 gekostet.
   */
  occupiedSince?: Tick
  /** Only for provinces the player owns. */
  morale?: Fixed
  population?: Fixed
  deposits?: Partial<Record<ResourceKey, Fixed>>
  buildings?: Partial<Record<BuildingKey, number>>
  buildQueueLength?: number
  /**
   * What is being built here, when it started and when it is finished (R-UI-09).
   *
   * Only for own provinces, and only when the view was asked for with the rules: a
   * progress bar is a fine thing right until it tells the player what an opponent is
   * building. The start tick is part of it — a bar needs both ends, and the first
   * version of this field left it out on the grounds that "a display needs the end,
   * not the paperwork", which turned out to be exactly wrong.
   */
  /**
   * Die Kennung gehoert dazu (T-M14-13): ohne sie kann die Oberflaeche CANCEL_BUILD
   * nicht bilden, und der Befehl war seit M3 gebaut, getestet und unerreichbar.
   */
  buildQueue?: { id: string; building: BuildingKey; startedTick: Tick; completesAtTick: Tick }[]
  /** The same for levies being raised. */
  recruitQueue?: { unitKey: string; count: number; startedTick: Tick; completesAtTick: Tick }[]
  /**
   * Where morale is heading. The current figure alone cannot say whether a province is
   * settling down or coming apart, which is the one thing the player wants to know.
   */
  moraleTarget?: Fixed
  /** True when this is remembered rather than currently observed. */
  stale: boolean
  /** Tick the information dates from. */
  asOfTick: Tick
}

export interface VisibleArmy {
  id: ArmyId
  owner: PlayerId
  provinceId: ProvinceId
  /** Own armies show their exact composition; foreign ones only a strength estimate. */
  units?: { unitKey: string; hpTotal: Fixed }[]
  strength: Fixed
  stance?: Stance
  path?: ProvinceId[]
  arrivalTick?: Tick | null
  /** When the march began — a progress bar needs both ends of the stretch (R-UI-09). */
  departureTick?: Tick | null
}

export interface PublicView {
  tick: Tick
  playerId: PlayerId
  self: {
    name: string
    nation: string
    /**
     * Die eigene Farbe (T-M20-02, R-UI-16).
     *
     * `others` fuehrt sie seit M6; die eigene fehlte, weil die Karte den eigenen Besitz
     * ueber `playerId` einfaerbt und keine Liste braucht. Eine Tabelle der Maechte
     * braucht sie: sonst traegt jede Zeile ein Farbfeld ausser der eigenen.
     */
    color: string
    /**
     * Ist der Spieler noch im Spiel? (T-M14-10, Befund N4)
     *
     * Der Abschlussdialog haengt an `victory.winner`, und den setzt der Kern erst, wenn
     * genau eine Macht uebrig ist. Scheidet der Mensch als einer von acht aus, bleibt
     * `winner` null: das Spiel tickt weiter, er hat keine Provinz, keine Armee und kein
     * Wort dazu. Die Oberflaeche konnte es nicht einmal wissen.
     */
    alive: boolean
    resources: Record<ResourceKey, Fixed>
    shortages: readonly ResourceKey[]
    capitalProvinceId: ProvinceId | null
    /**
     * Bis wann der Verlust der Hauptstadt nachwirkt — und damit das einzige Zeichen,
     * dass sie ueberhaupt gefallen ist (T-M12-09).
     *
     * `capitalProvinceId` taugt dafuer nicht: `occupation` setzt es im selben Tick auf
     * null, in dem die Hauptstadt faellt. Die Meldung "Ihre Hauptstadt ist gefallen"
     * fragte danach und war deshalb toter Code — sie konnte nur noch bei einem Aufstand
     * auslösen, wo der Eigentuemer wegfaellt und die Kennung stehen bleibt.
     */
    capitalLostUntil: Tick | null
    score: number
    reputation: Fixed
    aiBonusMultiplier: Fixed
    /**
     * Wie böse ich auf wen bin (T-M15-05, R-DIP-06).
     *
     * Das ist **eigenes** Wissen und gehört deshalb unter `self`, nicht zu `others`:
     * meine Verstimmungen kennt niemand ausser mir. Wer sie in `others` gesetzt hätte,
     * gäbe der KI Einblick in fremde Gemütslagen — ein Bruch von R-DIP-04 in genau der
     * Richtung, die am schwersten auffällt.
     */
    grievances: Record<PlayerId, Fixed>
    /**
     * Stock, production, consumption and balance per resource (R-ECON-06).
     *
     * Only present when the caller passed the rules — the AI does not need it, and
     * computing it walks every province.
     */
    economy?: EconomyOverview
  }
  /**
   * Die anderen Mächte — mit ihrem **öffentlichen Ansehen** (T-M15-05, R-DIP-06).
   *
   * `reputation` wurde seit M6 geschrieben (ein Überfall ohne Erklärung kostet welches)
   * und von **keiner Zeile** gelesen: die Sicht führte es nicht, also konnte die KI nicht
   * darauf reagieren, und der Spieler sah es nirgends. Es ist ausdrücklich öffentlich —
   * wer wortbrüchig wird, tut das vor aller Augen, und kein Nebel verdeckt das.
   */
  others: {
    id: PlayerId
    name: string
    nation: string
    color: string
    alive: boolean
    score: number
    reputation: Fixed
  }[]
  relations: Record<PlayerId, { state: DiplomaticState; rightOfWay: boolean; sharedMap: boolean; sinceTick: Tick }>
  /**
   * Wer mit wem öffentlich Krieg führt (T-M15-05, R-DIP-06/AK2).
   *
   * `relations` führt nur **meine** Beziehungen. Ein Bündnisfall — „mein Verbündeter wird
   * angegriffen" — ist damit nicht entscheidbar, und AK2 wäre unerfüllbar gewesen.
   * Kriege sind erklärt und öffentlich; Waffenstillstände und Bündnisse Dritter stehen
   * hier bewusst **nicht**, die sind Sache der Beteiligten (R-DIP-04).
   */
  publicWars: { a: PlayerId; b: PlayerId }[]
  /**
   * Angebote, die auf meine Antwort warten (T-M14-12, Befund 41).
   *
   * Ohne sie warf die KI `acceptPeace` ins Blaue: sie konnte nicht wissen, ob überhaupt
   * ein Angebot vorlag, und **99 % dieser Befehle wurden abgelehnt**. Zwischen zwei
   * KI-Mächten konnte ein Krieg dadurch strukturell fast nie enden — beide boten Frieden
   * an, keine sah das Angebot der anderen.
   *
   * Kein Verstoß gegen R-DIP-04: ein Angebot **an mich** ist mein eigenes Wissen. Was
   * andere einander anbieten, steht hier nicht.
   */
  incomingOffers: { from: PlayerId; kind: 'peace' | 'alliance'; tick: Tick }[]
  provinces: VisibleProvince[]
  armies: VisibleArmy[]
  /**
   * Fighting the player can see, for the combat symbol on the map and the alerts
   * (R-UI-12, R-UI-14). Only in provinces they observe, and only with the rules — a
   * battle in a province behind the fog is not their news.
   */
  battles?: { provinceId: ProvinceId; startedTick: Tick }[]
  marketPrices: Record<ResourceKey, Fixed>
  /**
   * The victory condition, its winner — and the share of points it takes to win
   * (R-UI-13). Without the threshold the interface can show a score but not how far
   * away the end of the game is.
   */
  victory: { condition: string; winner: PlayerId | null; pointsShareToWin?: number }
}

/** Provinces the player can currently observe. */
export function visibleProvinces(state: GameState, playerId: PlayerId): Set<ProvinceId> {
  const visible = new Set<ProvinceId>()

  const allies = new Set<PlayerId>()
  for (const other of state.playerOrder) {
    if (other === playerId) continue
    const relation = state.diplomacy.relations[relationKey(playerId, other)]
    if (relation?.sharedMap || relation?.state === 'alliance') allies.add(other)
  }

  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    if (province.owner === playerId || (province.owner && allies.has(province.owner))) {
      visible.add(id)
      // Own provinces see their immediate surroundings.
      for (const neighbour of [...province.neighbors, ...province.seaLinks]) visible.add(neighbour)
    }
  }

  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]!
    if (army.owner !== playerId && !allies.has(army.owner)) continue
    visible.add(army.locationProvinceId)
    const province = state.provinces[army.locationProvinceId]
    for (const neighbour of province?.neighbors ?? []) visible.add(neighbour)
  }

  return visible
}

/** Builds the filtered view. Never returns anything the player may not know. */
export function publicView(state: GameState, playerId: PlayerId, rules?: Rules): PublicView {
  const player = state.players[playerId]
  if (!player) throw new Error(`Unbekannter Spieler: ${playerId}`)

  const visible = visibleProvinces(state, playerId)

  const provinces: VisibleProvince[] = []
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    const own = province.owner === playerId

    if (visible.has(id)) {
      provinces.push({
        id,
        name: province.name,
        owner: province.owner,
        kind: province.kind,
        terrain: province.terrain,
        coastal: province.coastal,
        ...(province.occupiedSince !== null ? { occupiedSince: province.occupiedSince } : {}),
        neighbors: province.neighbors,
        seaLinks: province.seaLinks,
        stale: false,
        asOfTick: state.tick,
        ...(own
          ? {
              morale: province.morale,
              population: province.population,
              deposits: { ...province.deposits },
              buildings: { ...province.buildings },
              buildQueueLength: province.buildQueue.length,
              // Only with the rules: the AI asks for this view every tick and reads
              // none of it, so it should not pay for it either (D18.2).
              ...(rules
                ? {
                    buildQueue: province.buildQueue.map((order) => ({
                      id: order.id,
                      building: order.building,
                      startedTick: order.startedTick,
                      completesAtTick: order.completesAtTick,
                    })),
                    recruitQueue: province.recruitQueue.map((order) => ({
                      unitKey: order.unitKey,
                      count: order.count,
                      startedTick: order.startedTick,
                      completesAtTick: order.completesAtTick,
                    })),
                    moraleTarget: province.targetMorale,
                  }
                : {}),
            }
          : {}),
      })
      continue
    }

    // Not visible: fall back to what the player remembers, if anything.
    const remembered = player.intel[id]
    if (remembered) {
      provinces.push({
        id,
        name: province.name,
        owner: remembered.owner,
        kind: province.kind,
        terrain: province.terrain,
        coastal: province.coastal,
        ...(province.occupiedSince !== null ? { occupiedSince: province.occupiedSince } : {}),
        neighbors: province.neighbors,
        seaLinks: province.seaLinks,
        stale: true,
        asOfTick: remembered.tick,
      })
    }
  }

  const armies: VisibleArmy[] = []
  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]!
    const own = army.owner === playerId
    if (!own && !visible.has(army.locationProvinceId)) continue

    armies.push({
      id: army.id,
      owner: army.owner,
      provinceId: army.locationProvinceId,
      strength: armyHp(army),
      ...(own
        ? {
            units: army.units.map((stack) => ({ ...stack })),
            stance: army.stance,
            path: [...army.path],
            arrivalTick: army.arrivalTick,
            departureTick: army.departureTick,
          }
        : {}),
    })
  }

  // Angebote an mich — mein eigenes Wissen, kein Bruch von R-DIP-04 (T-M14-12).
  const incomingOffers = state.diplomacy.offers
    .filter((offer) => offer.to === playerId)
    .map((offer) => ({ from: offer.from, kind: offer.kind, tick: offer.tick }))

  const relations: PublicView['relations'] = {}
  for (const other of state.playerOrder) {
    if (other === playerId) continue
    const relation = state.diplomacy.relations[relationKey(playerId, other)]
    if (!relation) continue
    relations[other] = {
      state: relation.state,
      rightOfWay: relation.rightOfWay,
      sharedMap: relation.sharedMap,
      // Seit wann dieser Zustand gilt. Der Krieg hat ein Anfangsdatum, sonst kann
      // niemand fragen, ob er sich festgefahren hat (R-DIP-06/AK4).
      sinceTick: relation.sinceTick,
    }
  }

  // Über playerOrder statt über Object.keys(relations): die Reihenfolge muss aus dem
  // Zustand kommen und nicht aus der Einfügereihenfolge eines Records, sonst hängt das
  // Verhalten der KI daran, in welcher Reihenfolge Beziehungen angelegt wurden (R-ARCH-01).
  const publicWars: PublicView['publicWars'] = []
  for (let i = 0; i < state.playerOrder.length; i++) {
    for (let j = i + 1; j < state.playerOrder.length; j++) {
      const a = state.playerOrder[i]!
      const b = state.playerOrder[j]!
      if (state.diplomacy.relations[relationKey(a, b)]?.state === 'war') publicWars.push({ a, b })
    }
  }

  return {
    tick: state.tick,
    playerId,
    self: {
      name: player.name,
      nation: player.nation,
      color: player.color,
      alive: player.alive,
      resources: { ...player.resources },
      shortages: [...player.shortages],
      capitalProvinceId: player.capitalProvinceId,
      capitalLostUntil: player.capitalLostUntil,
      score: player.score,
      reputation: player.reputation,
      grievances: { ...(state.diplomacy.grievances[playerId] ?? {}) },
      aiBonusMultiplier: player.aiBonusMultiplier,
      ...(rules ? { economy: economyOverview(state, playerId, rules) } : {}),
    },
    others: state.playerOrder
      .filter((id) => id !== playerId)
      .map((id) => {
        const other = state.players[id]!
        return {
          id,
          name: other.name,
          nation: other.nation,
          color: other.color,
          alive: other.alive,
          score: other.score,
          reputation: other.reputation,
        }
      }),
    publicWars,
    relations,
    incomingOffers,
    provinces,
    armies,
    ...(rules
      ? {
          battles: state.battles
            .filter((battle) => visible.has(battle.provinceId))
            .map((battle) => ({ provinceId: battle.provinceId, startedTick: battle.startedTick })),
        }
      : {}),
    marketPrices: { ...state.market.prices },
    victory: {
      condition: state.victory.condition,
      winner: state.victory.winner,
      ...(rules ? { pointsShareToWin: state.victory.pointsShareToWin } : {}),
    },
  }
}
