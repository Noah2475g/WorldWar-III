import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  economyOverview,
  type BuildCompletedEvent,
  type BuildStartedEvent,
  type Command,
  type CommandRejectedEvent,
  type DiplomacyChangedEvent,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PlayerId,
  type ProvinceCapturedEvent,
  type RecruitOrder,
  type ResourceShortageEvent,
  type UnitRecruitedEvent,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import {
  armeeEinheiten,
  artillerieAnteil,
  fabrikBezahlbar,
  istBatterie,
  m42Zaehler,
  tagesbilanzNachAushebung,
  zusammenlegbarePaare,
  type TagesEingang,
} from './m42-zaehlung'

/**
 * T-M42-01 — schnelle Tests fuer `m42-zaehlung.ts` (Bauplan Paragraph 3.1).
 *
 * Echte Zustaende ueber `createInitialState`/`smallWorld`/`TEST_RULES` (wie
 * `packages/ai/src/espionage.test.ts`), Lagen per direktem Feldzugriff. Jeder Fall prueft seine
 * Vorbedingung zuerst, wenn sie nicht offensichtlich ist (Fixed-Point-Bilanzen).
 */

const map = smallWorld()
const rules = TEST_RULES
const CONFIG: GameConfig = {
  seed: 4201,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Leicht', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'easy' },
    { name: 'Normal', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Schwer', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'hard' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const KI: ReadonlySet<PlayerId> = new Set(['p1', 'p2', 'p3'])
const P1 = 'p1'
const P2 = 'p2'
const P3 = 'p3'

function baseState(): GameState {
  return createInitialState(CONFIG, { map, rules })
}

const evBasis = { tick: 0, severity: 'info' as const, audience: [] as PlayerId[], concerns: [] as PlayerId[] }

function leer(state: GameState): TagesEingang {
  return { state, events: [], applied: [] }
}

function recruitOrder(unitKey: string, count: number, ownerAtStart: PlayerId, id = 'o1'): RecruitOrder {
  return { id, unitKey, count, startedTick: 0, completesAtTick: 100, ownerAtStart }
}

function armeeStapel(unitKey: string, hpTotal: number) {
  return { unitKey, hpTotal }
}

// ---------------------------------------------------------------------------
// B — istBatterie
// ---------------------------------------------------------------------------
describe('T-M42-01 istBatterie', () => {
  it('B1: leere Armee ist keine Batterie', () => {
    expect(istBatterie({ units: [] }, rules)).toBe(false)
  })

  it('B2: nur Infanterie ist keine Batterie', () => {
    expect(istBatterie({ units: [armeeStapel('infantry', 5000)] }, rules)).toBe(false)
  })

  it('B3: nur Artillerie (auch gemischt aus zwei Artillerieklassen) ist eine Batterie', () => {
    expect(istBatterie({ units: [armeeStapel('artillery', 1400)] }, rules)).toBe(true)
    expect(
      istBatterie({ units: [armeeStapel('artillery', 1400), armeeStapel('rocket_artillery', 1600)] }, rules),
    ).toBe(true)
  })

  it('B4: Infanterie und Artillerie gemischt ist keine Batterie', () => {
    expect(istBatterie({ units: [armeeStapel('infantry', 5000), armeeStapel('artillery', 1400)] }, rules)).toBe(false)
  })

  it('B5: unbekannter unitKey ist keine Batterie', () => {
    expect(istBatterie({ units: [armeeStapel('unbekannte_einheit', 1000)] }, rules)).toBe(false)
  })

  it('B6: Wortlaut-Waechter gegen military.ts:155-157', () => {
    const quelle = readFileSync(
      new URL('../../../packages/ai/src/military.ts', import.meta.url),
      'utf-8',
    )
    expect(quelle.includes('eigeneEinheiten.length > 0 &&'), 'military.ts hat die Batterie-Bedingung geaendert — istBatterie in m42-zaehlung.ts nachziehen (T-M42-08 ersetzt beides durch army-role.ts)').toBe(true)
    expect(
      quelle.includes(
        'eigeneEinheiten.every((stack) => (context.rules.units[stack.unitKey]?.rangeProvinces ?? 0) > 0)',
      ),
      'military.ts hat die Batterie-Bedingung geaendert — istBatterie in m42-zaehlung.ts nachziehen (T-M42-08 ersetzt beides durch army-role.ts)',
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// E — armeeEinheiten
// ---------------------------------------------------------------------------
describe('T-M42-01 armeeEinheiten', () => {
  it('E1: rundet Trefferpunkte pro Einheit auf (ceil)', () => {
    expect(armeeEinheiten({ units: [armeeStapel('infantry', 15000)] }, rules)).toBe(15)
    expect(armeeEinheiten({ units: [armeeStapel('infantry', 15001)] }, rules)).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// P — zusammenlegbarePaare
// ---------------------------------------------------------------------------
describe('T-M42-01 zusammenlegbarePaare', () => {
  it('P1: zwei stehende Infanteriearmeen 5+5, gleiche Macht/Provinz -> genau ein Paar, a < b', () => {
    const state = baseState()
    const a = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    const b = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    const paare = zusammenlegbarePaare(state, rules, KI)
    expect(paare).toHaveLength(1)
    expect(paare[0]!.a < paare[0]!.b).toBe(true)
    expect([paare[0]!.a, paare[0]!.b].sort()).toEqual([a.id, b.id].sort())
  })

  it('P2: 12+8 (Summe 20) -> ein Paar', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 12000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 8000)] })
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(1)
  })

  it('P3: 15+10 (Summe 25) -> kein Paar', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 15000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 10000)] })
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(0)
  })

  it('P4: Batterie und Infanterie am selben Ort paaren nicht (Rolle verschieden); zwei Batterien paaren', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 2800)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 3000)] })
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(0)

    const state2 = baseState()
    placeArmy(state2, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 2800)] })
    placeArmy(state2, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 4200)] })
    expect(zusammenlegbarePaare(state2, rules, KI)).toHaveLength(1)
  })

  it('P5: eine der beiden marschiert (path != []) -> kein Paar', () => {
    const state = baseState()
    const a = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    a.path = ['n2']
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(0)
  })

  it('P6: embarked unterschiedlich -> kein Paar', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)], embarked: true })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)], embarked: false })
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(0)
  })

  it('P7: verschiedene Besitzer, oder Besitzer nicht in ki -> kein Paar', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state, { owner: P2, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    expect(zusammenlegbarePaare(state, rules, KI)).toHaveLength(0)

    const state2 = baseState()
    placeArmy(state2, { owner: 'p9', at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state2, { owner: 'p9', at: 'n1', units: [armeeStapel('infantry', 5000)] })
    expect(zusammenlegbarePaare(state2, rules, KI)).toHaveLength(0)
  })

  it('P8: dieselben zwei Armeen an Tag 1 und Tag 2 -> Blindheitsschutz zu Paragraph 2.6', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    zaehler.tagesende(leer(state))
    zaehler.tagesende(leer(state))
    const bericht = zaehler.bericht()
    expect(bericht.heer.paareUeberZweiTagesenden).toBe(1)
    expect(bericht.heer.tageMitPaarUeberZweiTagesenden).toBe(1)
    expect(bericht.heer.orteMitPaarUeberZweiTagesenden).toBe(1)
  })

  it('P9: Tag 1 Paar (a,b), Tag 2 anderes Paar (c,d) am selben Ort -> Paare 0, Orte 1', () => {
    // Ein durchgehender Zustand statt zwei frischer: sonst vergibt `placeArmy` fuer den
    // zweiten Tag dieselben Kennungen wie fuer den ersten (beide starten bei `a1`), und das
    // Paar saehe "ueber zwei Tagesenden" gleich aus, obwohl es andere Armeen sind.
    const state = baseState()
    const a = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    const b = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(state))

    delete state.armies[a.id]
    delete state.armies[b.id]
    state.armyOrder = state.armyOrder.filter((id) => id !== a.id && id !== b.id)
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 4000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 4000)] })
    zaehler.tagesende(leer(state))

    const bericht = zaehler.bericht()
    expect(bericht.heer.paareUeberZweiTagesenden).toBe(0)
    expect(bericht.heer.orteMitPaarUeberZweiTagesenden).toBe(1)
  })

  it('P10: Paar Tag 1, kein Paar Tag 2, dasselbe Paar Tag 3 -> nur der vorige Tag zaehlt', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    zaehler.tagesende(leer(tag1))

    const tag2 = baseState()
    zaehler.tagesende(leer(tag2))

    zaehler.tagesende(leer(tag1))

    expect(zaehler.bericht().heer.paareUeberZweiTagesenden).toBe(0)
  })

  it('P11: drei Armeen 5/5/5 an einem Ort -> Hoechstwerte', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    zaehler.tagesende(leer(state))
    const bericht = zaehler.bericht()
    expect(bericht.heer.paareHoechstens).toBe(3)
    expect(bericht.heer.provinzenMitPaarHoechstens).toBe(1)
    expect(bericht.heer.tageMitPaar).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// H — Heer, Deckel, Batterien, alte Zusage 7
// ---------------------------------------------------------------------------
describe('T-M42-01 Heer und Deckel', () => {
  it('H1: stehender Verband ueber dem Deckel (21 > 20), darunter nicht', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 21000)] })
    zaehler.tagesende(leer(state))
    const bericht = zaehler.bericht()
    expect(bericht.jeMacht[P1]!.groessterStehenderVerband).toBe(21)
    expect(bericht.jeMacht[P1]!.tageUeberDeckel).toBe(1)
    expect(bericht.heer.groessterStehenderVerband).toBe(21)
    expect(bericht.heer.tageUeberDeckel).toBe(1)

    const zaehler2 = m42Zaehler(rules, KI)
    const state2 = baseState()
    placeArmy(state2, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 20000)] })
    zaehler2.tagesende(leer(state2))
    expect(zaehler2.bericht().jeMacht[P1]!.tageUeberDeckel).toBe(0)
  })

  it('H2: marschierender Verband zaehlt nicht fuer groessterStehenderVerband', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    const army = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 30000)] })
    army.path = ['n2']
    zaehler.tagesende(leer(state))
    expect(zaehler.bericht().jeMacht[P1]!.groessterStehenderVerband).toBe(0)
  })

  it('H3: vier stehende Armeen einer Macht in einer Provinz -> alte Zusage 7', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    for (let i = 0; i < 4; i++) {
      placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 1000)] })
    }
    zaehler.tagesende(leer(state))
    const bericht = zaehler.bericht()
    expect(bericht.heer.alteZusage7.stehendHoechstens).toBe(4)
    expect(bericht.heer.alteZusage7.stehendTageUeberDrei).toBe(1)
  })

  it('H4: zwei Batterien und eine Linie einer Macht -> batterienHoechstens 2', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 1400)] })
    const marschierendeBatterie = placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 1400)] })
    marschierendeBatterie.path = ['n2']
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 3000)] })
    zaehler.tagesende(leer(state))
    expect(zaehler.bericht().jeMacht[P1]!.batterienHoechstens).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// A — artillerieAnteil
// ---------------------------------------------------------------------------
describe('T-M42-01 artillerieAnteil', () => {
  function recruited(playerId: PlayerId, unitKey: string, count: number, armyId = 'a1'): UnitRecruitedEvent {
    return { ...evBasis, type: 'UNIT_RECRUITED', playerId, provinceId: 'n1', unitKey, count, armyId }
  }

  it('A1: artillery(3) + infantry(7) + transport(2) + fighter(1) -> 3/10/30%', () => {
    const events: GameEvent[] = [
      recruited(P1, 'artillery', 3),
      recruited(P1, 'infantry', 7),
      recruited(P1, 'transport', 2),
      recruited(P1, 'fighter', 1),
    ]
    expect(artillerieAnteil(events, rules, KI)).toEqual({ artillerie: 3, landeinheiten: 10, prozent: 30 })
  })

  it('A2: Aushebung einer Nicht-KI-Macht zaehlt nicht', () => {
    const events: GameEvent[] = [recruited('p9', 'artillery', 5)]
    expect(artillerieAnteil(events, rules, KI)).toEqual({ artillerie: 0, landeinheiten: 0, prozent: 0 })
  })

  it('A3: keine Aushebung -> {0,0,0}, kein NaN', () => {
    expect(artillerieAnteil([], rules, KI)).toEqual({ artillerie: 0, landeinheiten: 0, prozent: 0 })
  })

  it('A4: rocket_artillery zaehlt als Klasse Artillerie, nicht ueber den Schluessel', () => {
    const events: GameEvent[] = [recruited(P1, 'rocket_artillery', 1), recruited(P1, 'infantry', 1)]
    expect(artillerieAnteil(events, rules, KI)).toEqual({ artillerie: 1, landeinheiten: 2, prozent: 50 })
  })

  // Nacharbeit T-M42-01 (Befund 10, mittel): bericht().truppen.artillerieAnteil summiert
  // artillerieCount/landeinheitenCount laufend im Zaehler statt die Funktion artillerieAnteil()
  // aufzurufen — ein ungetesteter Zwilling. A5 fuettert dieselben Ereignisse einmal durch den
  // Zaehler und einmal durch die Funktion und verlangt Gleichstand.
  it('A5: truppen.artillerieAnteil (Zaehler) stimmt mit artillerieAnteil() (Funktion) ueberein', () => {
    const events: GameEvent[] = [
      recruited(P1, 'artillery', 3),
      recruited(P1, 'rocket_artillery', 1),
      recruited(P1, 'infantry', 7),
      recruited(P1, 'transport', 2),
      recruited(P1, 'fighter', 1),
      recruited('p9', 'artillery', 5), // Nicht-KI, darf in beiden Wegen nicht zaehlen
    ]
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: baseState(), events, applied: [] })
    expect(zaehler.bericht().truppen.artillerieAnteil).toEqual(artillerieAnteil(events, rules, KI))
  })
})

// ---------------------------------------------------------------------------
// BE — Beschuss (automatisches BOMBARDMENT)
// ---------------------------------------------------------------------------
describe('T-M42-01 Beschuss', () => {
  // Nacharbeit T-M42-01 (Befund 10, mittel): jeMacht.beschuss und truppen.beschuss liefen bisher
  // nur durch die 80-s-Integrationslaeufe, nie durch die schnelle Suite.
  it('BE1: automatisches BOMBARDMENT zaehlt jeMacht.beschuss und truppen.beschuss; ein befohlenes nicht', () => {
    const automatisch: GameEvent = { ...evBasis, type: 'BOMBARDMENT', playerId: P1, armyId: 'a1', targetProvinceId: 'n2', damage: 100, automatic: true }
    const befohlen: GameEvent = { ...evBasis, type: 'BOMBARDMENT', playerId: P1, armyId: 'a2', targetProvinceId: 'n2', damage: 100, automatic: false }
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: baseState(), events: [automatisch, befohlen], applied: [] })
    const bericht = zaehler.bericht()
    expect(bericht.jeMacht[P1]!.beschuss, 'nur das automatische zaehlt').toBe(1)
    expect(bericht.truppen.beschuss, 'nur das automatische zaehlt').toBe(1)
  })
})

// ---------------------------------------------------------------------------
// M — Geldmangel / Oelmangel
// ---------------------------------------------------------------------------
describe('T-M42-01 Geld- und Oelmangel', () => {
  function recruitCommand(playerId: PlayerId, count = 1): { command: Command } {
    return { command: { type: 'RECRUIT', playerId, provinceId: 'n1', unitKey: 'infantry', count } }
  }
  function shortageState(macht: PlayerId, resources: ('money' | 'oil')[]): GameState {
    const state = baseState()
    state.players[macht]!.shortages = [...resources]
    return state
  }

  it('M1: Aushebung bei negativer Bilanz (grosse Armee), Tag 2 Geldmangel -> 1/1', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    expect(tagesbilanzNachAushebung(tag1, P1, 'money', rules)).toBeLessThan(0)
    zaehler.tagesende({ state: tag1, events: [], applied: [recruitCommand(P1)] })
    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(1)
  })

  it('M2: Aushebung bei positiver Bilanz, Tag 2 Geldmangel -> 1/0', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    expect(tagesbilanzNachAushebung(tag1, P1, 'money', rules)).toBeGreaterThan(0)
    zaehler.tagesende({ state: tag1, events: [], applied: [recruitCommand(P1)] })
    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(0)
  })

  it('M3: Mangel ohne jede vorherige Aushebung -> 1/0', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(0)
  })

  it('M4: Tag1 Aushebung negativ, Tag2 Aushebung positiv, Tag3 Mangel -> die letzte zaehlt (1/0)', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    zaehler.tagesende({ state: tag1, events: [], applied: [recruitCommand(P1)] })

    const tag2 = baseState()
    zaehler.tagesende({ state: tag2, events: [], applied: [recruitCommand(P1)] })

    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(0)
  })

  it('M5: RECRUIT angewandt UND abgelehnt am selben Tag -> kein Aushebungstag (1/0, aushebungsTage 0)', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    const rejected: CommandRejectedEvent = { ...evBasis, type: 'COMMAND_REJECTED', playerId: P1, command: 'RECRUIT', code: 'INSUFFICIENT_RESOURCES' }
    zaehler.tagesende({ state: tag1, events: [rejected], applied: [recruitCommand(P1)] })
    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(0)
    expect(m.aushebungsTage).toBe(0)
  })

  it('M6: Mangel am selben Tag wie die Aushebung (negativ) -> 1/1', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = shortageState(P1, ['money'])
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    zaehler.tagesende({ state, events: [], applied: [recruitCommand(P1)] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(1)
  })

  it('M7: Oelmangel nach Aushebung mit negativer Oel-Tagesbilanz -> 1/1', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('artillery', 1400)] })
    expect(tagesbilanzNachAushebung(tag1, P1, 'oil', rules)).toBeLessThan(0)
    zaehler.tagesende({ state: tag1, events: [], applied: [recruitCommand(P1)] })
    zaehler.tagesende(leer(shortageState(P1, ['oil'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.oelmangelTage).toBe(1)
    expect(m.oelmangelTageDurchAushebung).toBe(1)
  })

  it('M8: Mangel an Tag 2 UND Tag 3, RESOURCE_SHORTAGE nur an Tag 2 (wie im Kern) -> geldmangelTage 2', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(baseState()))
    const shortageEvent: ResourceShortageEvent = { ...evBasis, type: 'RESOURCE_SHORTAGE', playerId: P1, resource: 'money' }
    zaehler.tagesende({ state: shortageState(P1, ['money']), events: [shortageEvent], applied: [] })
    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    expect(zaehler.bericht().jeMacht[P1]!.geldmangelTage).toBe(2)
  })

  // M9/M10 des Bauplans (T-M43-01, §3.5): ein Provinzverlust NACH der letzten Aushebung zaehlt
  // zusaetzlich in `geldmangelTageNachProvinzverlust`, schliesst den Tag aber NICHT aus
  // `geldmangelTageDurchAushebung` aus (DECISIONS.md 2026-09-26 T-M42-01, woertlich: "eine
  // alte, knapp negative Aushebung zaehlt auch bei spaeterem Provinzverlust"). E5 (T-M43-01)
  // hatte hier eine Entweder-oder-Weiche gebaut, ohne Noahs Antwort auf die zugehoerige Frage
  // (Befund T-M42-03-Nacharbeit/kritisch); zurueckgenommen.
  it('M9: Aushebung negativ (Tag1), Provinzverlust danach (Tag2), Mangel (Tag3) -> 1/1/1', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    expect(tagesbilanzNachAushebung(tag1, P1, 'money', rules)).toBeLessThan(0)
    zaehler.tagesende({ state: tag1, events: [], applied: [recruitCommand(P1)] })

    const verlust: ProvinceCapturedEvent = { ...evBasis, type: 'PROVINCE_CAPTURED', provinceId: 'o1', previousOwner: P1, newOwner: P2 }
    zaehler.tagesende({ state: baseState(), events: [verlust], applied: [] })

    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(1)
    expect(m.geldmangelTageNachProvinzverlust).toBe(1)
  })

  it('M10: wie M9, aber der Verlust faellt auf den Aushebungstag selbst -> 1/1/0', () => {
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    placeArmy(tag1, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 50_000_000)] })
    const verlust: ProvinceCapturedEvent = { ...evBasis, type: 'PROVINCE_CAPTURED', provinceId: 'o1', previousOwner: P1, newOwner: P2 }
    zaehler.tagesende({ state: tag1, events: [verlust], applied: [recruitCommand(P1)] })

    zaehler.tagesende(leer(shortageState(P1, ['money'])))
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.geldmangelTage).toBe(1)
    expect(m.geldmangelTageDurchAushebung).toBe(1)
    expect(m.geldmangelTageNachProvinzverlust).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// T — tagesbilanzNachAushebung
// ---------------------------------------------------------------------------
describe('T-M42-01 tagesbilanzNachAushebung', () => {
  it('T1: ohne Warteschlange gleich economyOverview(...).balance', () => {
    const state = baseState()
    expect(tagesbilanzNachAushebung(state, P1, 'money', rules)).toBe(economyOverview(state, P1, rules).money.balance)
  })

  it('T2: eigene RecruitOrder infantry x5 senkt die Geldbilanz um 5*60*24=7200; fremde Order aendert nichts', () => {
    const state = baseState()
    const basis = economyOverview(state, P1, rules).money.balance
    state.provinces['n1']!.recruitQueue.push(recruitOrder('infantry', 5, P1))
    expect(tagesbilanzNachAushebung(state, P1, 'money', rules)).toBe(basis - 7200)

    const state2 = baseState()
    state2.provinces['n1']!.recruitQueue.push(recruitOrder('infantry', 5, P2))
    expect(tagesbilanzNachAushebung(state2, P1, 'money', rules)).toBe(economyOverview(state2, P1, rules).money.balance)
  })

  it('T3: RecruitOrder artillery x2 senkt die Oelbilanz um 2*60*24=2880', () => {
    const state = baseState()
    const basis = economyOverview(state, P1, rules).oil.balance
    state.provinces['n1']!.recruitQueue.push(recruitOrder('artillery', 2, P1))
    expect(tagesbilanzNachAushebung(state, P1, 'oil', rules)).toBe(basis - 2880)
  })
})

// ---------------------------------------------------------------------------
// F — fabrikBezahlbar, Zaehler
// ---------------------------------------------------------------------------
describe('T-M42-01 fabrikBezahlbar', () => {
  // Nacharbeit T-M42-01 (Befund 3, mittel): fabrikenBegonnen/fabrikenFertig liefen bisher nur
  // durch die 80-s-Integrationslaeufe (m17-/ai-integration.slow.test.ts, "zwei Zaehlwege"); ein
  // Mutationstest (event.building === 'factory'-Filter aus BUILD_STARTED/BUILD_COMPLETED entfernt)
  // liess die schnelle Suite unveraendert gruen. F0 fuettert beide Ereignisse direkt durch den
  // Zaehler und prueft die Filterung auch gegen ein anderes Gebaeude.
  it('F0: BUILD_STARTED/BUILD_COMPLETED factory zaehlen fabrikenBegonnen/fabrikenFertig; ein anderes Gebaeude nicht', () => {
    const begonnenFactory: BuildStartedEvent = { ...evBasis, type: 'BUILD_STARTED', playerId: P1, provinceId: 'n1', building: 'factory', level: 1, completesAtTick: 100 }
    const begonnenHafen: BuildStartedEvent = { ...evBasis, type: 'BUILD_STARTED', playerId: P1, provinceId: 'n1', building: 'harbour', level: 1, completesAtTick: 100 }
    const fertigFactory: BuildCompletedEvent = { ...evBasis, type: 'BUILD_COMPLETED', playerId: P1, provinceId: 'n1', building: 'factory', level: 1 }
    const fertigHafen: BuildCompletedEvent = { ...evBasis, type: 'BUILD_COMPLETED', playerId: P1, provinceId: 'n1', building: 'harbour', level: 1 }
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: baseState(), events: [begonnenFactory, begonnenHafen, fertigFactory, fertigHafen], applied: [] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.fabrikenBegonnen, 'nur die Fabrik zaehlt, nicht der Hafen').toBe(1)
    expect(m.fabrikenFertig, 'nur die Fabrik zaehlt, nicht der Hafen').toBe(1)
  })

  it('F1: jeder Kostenrohstoff genau an der Reserve-Schwelle -> true; einer darunter -> false', () => {
    // Reserve 200 Promille: Bestand*4/5 = Kosten, also Bestand = Kosten*5/4.
    const cost = rules.buildings.factory.cost
    const resources = { food: 0, wood: 0, iron: 0, coal: 0, oil: 0, rare: 0, money: 0 }
    for (const [key, amount] of Object.entries(cost)) {
      if (!amount) continue
      ;(resources as Record<string, number>)[key] = Math.trunc((amount * 5) / 4)
    }
    expect(fabrikBezahlbar(resources, rules)).toBe(true)
    // -1 kann an der Trunkierungsgrenze denselben Reserve-Wert lassen (200/1000 von einem
    // Bestand knapp unter der Schwelle rundet gleich); -10 unterschreitet sie sicher.
    resources.money -= 10
    expect(fabrikBezahlbar(resources, rules)).toBe(false)
  })

  it('F2: Zaehler ueber drei Tage, bezahlbar an zweien -> tageFabrikBezahlbar 2', () => {
    const cost = rules.buildings.factory.cost
    function resourcesBezahlbar(): Record<string, number> {
      const r = { food: 0, wood: 0, iron: 0, coal: 0, oil: 0, rare: 0, money: 0 }
      for (const [key, amount] of Object.entries(cost)) {
        if (!amount) continue
        ;(r as Record<string, number>)[key] = Math.trunc((amount * 5) / 4)
      }
      return r
    }
    const zaehler = m42Zaehler(rules, KI)
    const tag1 = baseState()
    tag1.players[P1]!.resources = { ...tag1.players[P1]!.resources, ...resourcesBezahlbar() }
    zaehler.tagesende(leer(tag1))

    const tag2 = baseState()
    tag2.players[P1]!.resources = { ...tag2.players[P1]!.resources, money: 0 }
    zaehler.tagesende(leer(tag2))

    const tag3 = baseState()
    tag3.players[P1]!.resources = { ...tag3.players[P1]!.resources, ...resourcesBezahlbar() }
    zaehler.tagesende(leer(tag3))

    expect(zaehler.bericht().jeMacht[P1]!.tageFabrikBezahlbar).toBe(2)
  })

  it('F3: Stadt ohne Fabrik im Besitz -> tageStadtOhneFabrik 1; mit Fabrik -> 0', () => {
    const zaehler = m42Zaehler(rules, KI)
    const state = baseState()
    state.provinces['n1']!.buildings.factory = 0
    zaehler.tagesende(leer(state))
    expect(zaehler.bericht().jeMacht[P1]!.tageStadtOhneFabrik).toBe(1)

    const zaehler2 = m42Zaehler(rules, KI)
    const state2 = baseState()
    state2.provinces['n1']!.buildings.factory = 1
    zaehler2.tagesende(leer(state2))
    expect(zaehler2.bericht().jeMacht[P1]!.tageStadtOhneFabrik).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D — Befund D (verpasste Gelegenheiten)
// ---------------------------------------------------------------------------
describe('T-M42-01 Befund D', () => {
  const share = rules.ai.difficulties.easy.recruitShare // p1 ist 'easy'
  const artillery = rules.units['artillery']!
  function schwellenResources(): Record<string, number> {
    const r: Record<string, number> = { food: 0, wood: 0, iron: 0, coal: 0, oil: 0, rare: 0, money: 0 }
    for (const [key, amount] of Object.entries(artillery.cost)) {
      if (!amount) continue
      r[key] = Math.ceil((amount * 1000) / share)
    }
    return r
  }
  function grundlage(): GameState {
    const state = baseState()
    state.tick = 40 * rules.constants.ticksPerDay // Spieltag 40, >= availableFromDay 34
    state.provinces['n1']!.buildings.factory = 1 // eigene Fabrikprovinz
    state.provinces['n2']!.buildings.factory = 0 // Provinz ohne Fabrik
    state.players[P1]!.resources = { ...state.players[P1]!.resources, ...schwellenResources() }
    return state
  }
  function recruitAt(provinceId: string): { command: Command } {
    return { command: { type: 'RECRUIT', playerId: P1, provinceId, unitKey: 'infantry', count: 1 } }
  }

  it('D1: Aushebung ohne Fabrik, eigene Fabrikprovinz vorhanden, alle Rohstoffe an der Schwelle -> 1/1', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: grundlage(), events: [], applied: [recruitAt('n2')] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.verpassteGelegenheiten).toBe(1)
    expect(m.verpassteGelegenheitenNurGeld).toBe(1)
  })

  it('D2: keine eigene Fabrikprovinz -> 0/0', () => {
    const state = grundlage()
    state.provinces['n1']!.buildings.factory = 0
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state, events: [], applied: [recruitAt('n2')] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.verpassteGelegenheiten).toBe(0)
    expect(m.verpassteGelegenheitenNurGeld).toBe(0)
  })

  it('D3: Aushebung in der Fabrikprovinz selbst -> 0/0', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: grundlage(), events: [], applied: [recruitAt('n1')] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.verpassteGelegenheiten).toBe(0)
    expect(m.verpassteGelegenheitenNurGeld).toBe(0)
  })

  it('D4: Eisen unter der Schwelle, Geld darueber -> 0/1', () => {
    const state = grundlage()
    state.players[P1]!.resources.iron -= 1
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state, events: [], applied: [recruitAt('n2')] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.verpassteGelegenheiten).toBe(0)
    expect(m.verpassteGelegenheitenNurGeld).toBe(1)
  })

  it('D5: Spieltag 30 (< 34) -> 0/0', () => {
    const state = grundlage()
    state.tick = 30 * rules.constants.ticksPerDay
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state, events: [], applied: [recruitAt('n2')] })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.verpassteGelegenheiten).toBe(0)
    expect(m.verpassteGelegenheitenNurGeld).toBe(0)
  })

  it('D6: zwei RECRUIT an einem Tag zaehlen als ein Tag', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: grundlage(), events: [], applied: [recruitAt('n2'), recruitAt('n2')] })
    expect(zaehler.bericht().jeMacht[P1]!.verpassteGelegenheiten).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// K — Krieg
// ---------------------------------------------------------------------------
describe('T-M42-01 Krieg', () => {
  it('K1: Ueberfall, Eroberung, Frieden zwischen zwei KI-Maechten', () => {
    const warDeclared: GameEvent = { ...evBasis, type: 'WAR_DECLARED', playerId: P1, targetPlayerId: P2, effectiveAtTick: 0, withoutDeclaration: true }
    const captured: ProvinceCapturedEvent = { ...evBasis, type: 'PROVINCE_CAPTURED', provinceId: 'o1', previousOwner: P2, newOwner: P1 }
    const truce: DiplomacyChangedEvent = { ...evBasis, type: 'DIPLOMACY_CHANGED', playerId: P1, targetPlayerId: P2, newState: 'truce' }
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: baseState(), events: [warDeclared, captured, truce], applied: [] })
    const bericht = zaehler.bericht()
    expect(bericht.jeMacht[P1]!.kriegeErklaert).toBe(1)
    expect(bericht.jeMacht[P1]!.ueberfaelle).toBe(1)
    expect(bericht.jeMacht[P1]!.eroberungen).toBe(1)
    expect(bericht.jeMacht[P2]!.provinzenVerloren).toBe(1)
    expect(bericht.krieg).toEqual({ kriege: 1, ohneErklaerung: 1, frieden: 1, friedenZwischenKi: 1, eroberungen: 1 })
  })
})

// ---------------------------------------------------------------------------
// S — Spionage
// ---------------------------------------------------------------------------
describe('T-M42-01 Spionage', () => {
  it('S1: ein angewandtes RECRUIT_SPY, zwei eigene Spione am Tagesende', () => {
    const state = baseState()
    state.espionage.spies = [
      { id: 's1', owner: P1, provinceId: 'n1', mission: 'intel', recruitedTick: 0, assignedTick: 0, lastRunTick: null, lastOutcome: null },
      { id: 's2', owner: P1, provinceId: 'n1', mission: 'counter', recruitedTick: 0, assignedTick: 0, lastRunTick: null, lastOutcome: null },
    ]
    const applied: { command: Command }[] = [{ command: { type: 'RECRUIT_SPY', playerId: P1, provinceId: 'n1', mission: 'intel' } }]
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state, events: [], applied })
    const m = zaehler.bericht().jeMacht[P1]!
    expect(m.spioneAngeworben).toBe(1)
    expect(m.spioneHoechstens).toBe(2)
    expect(m.soldHoechstensJeTag).toBe(rules.constants.spySalaryIntel + rules.constants.spySalaryCounter)
  })
})

// ---------------------------------------------------------------------------
// X — Fehler
// ---------------------------------------------------------------------------
describe('T-M42-01 Fehler', () => {
  it('X1: 10 Marschbefehle, 1 NO_PATH, 1 BUILD:NOT_OWNER', () => {
    const applied: { command: Command }[] = []
    for (let i = 0; i < 10; i++) {
      applied.push({ command: { type: 'MOVE_ARMY', playerId: P1, armyId: `a${i}`, targetProvinceId: 'n2' } })
    }
    const rejectedMove: CommandRejectedEvent = { ...evBasis, type: 'COMMAND_REJECTED', playerId: P1, command: 'MOVE_ARMY', code: 'NO_PATH' }
    const rejectedBuild: CommandRejectedEvent = { ...evBasis, type: 'COMMAND_REJECTED', playerId: P1, command: 'BUILD', code: 'NOT_OWNER' }
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende({ state: baseState(), events: [rejectedMove, rejectedBuild], applied })
    const bericht = zaehler.bericht()
    expect(bericht.fehler.noPath).toBe(1)
    expect(bericht.fehler.noPathAnteilProzent).toBe(10)
    expect(bericht.fehler.ablehnungen).toEqual({ 'BUILD:NOT_OWNER': 1, 'MOVE_ARMY:NO_PATH': 1 })
  })
})

// ---------------------------------------------------------------------------
// R — Rahmen
// ---------------------------------------------------------------------------
describe('T-M42-01 Rahmen', () => {
  it('R1: tagesende laesst den Zustand unveraendert', () => {
    const state = baseState()
    placeArmy(state, { owner: P1, at: 'n1', units: [armeeStapel('infantry', 5000)] })
    const vorher = hashValue(state)
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(state))
    expect(hashValue(state)).toBe(vorher)
  })

  it('R2: zwei Zaehler, dieselben drei Tage -> gleicher Bericht; jeMacht in playerOrder-Reihenfolge', () => {
    const tage = [baseState(), baseState(), baseState()]
    const z1 = m42Zaehler(rules, KI)
    const z2 = m42Zaehler(rules, KI)
    for (const t of tage) z1.tagesende(leer(t))
    for (const t of tage) z2.tagesende(leer(t))
    expect(JSON.stringify(z1.bericht())).toBe(JSON.stringify(z2.bericht()))
    expect(Object.keys(z1.bericht().jeMacht)).toEqual(['p1', 'p2', 'p3'])
  })

  it('R3: jeStufe summiert Summenfelder und bildet das Maximum der Hoechstfelder', () => {
    const zweiEasyConfig: GameConfig = {
      seed: 4202,
      mapId: 'testworld',
      rulesId: 'default',
      players: [
        { name: 'Leicht1', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'easy' },
        { name: 'Leicht2', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'easy' },
      ],
      victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
    }
    const kiZwei: ReadonlySet<PlayerId> = new Set(['p1', 'p2'])
    const state = createInitialState(zweiEasyConfig, { map, rules })
    state.players['p1']!.resources.money = 1000
    state.players['p2']!.resources.money = 2000
    const buildP1: BuildStartedEvent = { ...evBasis, type: 'BUILD_STARTED', playerId: 'p1', provinceId: 'n1', building: 'factory', level: 1, completesAtTick: 100 }
    const buildP2a: BuildStartedEvent = { ...evBasis, type: 'BUILD_STARTED', playerId: 'p2', provinceId: 'o1', building: 'factory', level: 1, completesAtTick: 100 }
    const buildP2b: BuildStartedEvent = { ...evBasis, type: 'BUILD_STARTED', playerId: 'p2', provinceId: 'o2', building: 'factory', level: 1, completesAtTick: 100 }
    const zaehler = m42Zaehler(rules, kiZwei)
    zaehler.tagesende({ state, events: [buildP1, buildP2a, buildP2b], applied: [] })
    const jeStufe = zaehler.bericht().jeStufe.easy!
    expect(jeStufe.maechte).toBe(2)
    expect(jeStufe.fabrikenBegonnen).toBe(3)
    expect(jeStufe.geldHoechststand).toBe(2000)
  })

  it('R4: drei Tagesenden zaehlen tagesenden hoch; ausgeschieden spiegelt player.alive', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(baseState()))
    zaehler.tagesende(leer(baseState()))
    const letzterTag = baseState()
    letzterTag.players[P3]!.alive = false
    zaehler.tagesende(leer(letzterTag))
    const bericht = zaehler.bericht()
    expect(bericht.tagesenden).toBe(3)
    expect(bericht.jeMacht[P3]!.ausgeschieden).toBe(true)
    expect(bericht.jeMacht[P1]!.ausgeschieden).toBe(false)
  })

  // Nacharbeit T-M42-01 (Befund 9, mittel): jeMacht ist nach PlayerId geschluesselt, nicht nach
  // Nation (Bauplan-Kommentar sagte "Schluessel Nation") — beide eingecheckten Berichte trugen
  // nur p1..p8 ohne die Zuordnung zur Nation. MachtZahlen.nation schliesst die Luecke.
  it('R5: MachtZahlen.nation traegt die Nation der Macht (jeMacht ist nach PlayerId geschluesselt)', () => {
    const zaehler = m42Zaehler(rules, KI)
    zaehler.tagesende(leer(baseState()))
    const bericht = zaehler.bericht()
    expect(bericht.jeMacht[P1]!.nation).toBe('Nordland')
    expect(bericht.jeMacht[P2]!.nation).toBe('Ostmark')
    expect(bericht.jeMacht[P3]!.nation).toBe('Sueden')
  })
})
