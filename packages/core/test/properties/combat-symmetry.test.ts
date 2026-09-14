import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../../src/events/types'
import type { Rules } from '../../src/rules/types'
import { armyHp } from '../../src/state/army'
import { createInitialState, type GameConfig } from '../../src/state/create'
import { RESOURCE_KEYS, type GameState } from '../../src/state/types'
import { step } from '../../src/step'

/**
 * Die zugesagte Eigenschaftspruefung des Nahkampfs (T-M41-07, Zusage aus T-M14-06).
 *
 * T-M14-06 steht auf `done` und sagte zwei Eigenschaften zu, die kein Test pruefte:
 * der Seitentausch spiegelt bei Streuung 0 exakt, und die abgezogenen Trefferpunkte sind
 * gleich den in BATTLE_RESOLVED gemeldeten Verlusten. Geschrieben war nur der
 * Seitentausch beim Beschuss (`bombardment.test.ts`). Beide stehen hier — faellt eine,
 * ist das ein Befund und keine Formulierungsfrage.
 */

const map = smallWorld()
const PROVINZ = 'm1'

/** Landverbaende ohne Reichweite: der Beschuss soll hier nicht mitkaempfen. */
const LAND = ['infantry', 'motorized', 'tank', 'heavy_tank'] as const

/** Die Streuung zieht je Seite aus `draft.rng`; ohne sie ist der Seitentausch exakt pruefbar. */
const OHNE_STREUUNG: Rules = {
  ...TEST_RULES,
  constants: { ...TEST_RULES.constants, combatSpreadPermille: 0 },
}

const ZWEI: GameConfig = {
  seed: 41,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const DREI: GameConfig = {
  ...ZWEI,
  seed: 71,
  players: [...ZWEI.players, { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' }],
}

type Verband = { unitKey: string; hpTotal: number }

interface Lage {
  abwehr: Verband[]
  angriff: Verband[]
  /** Steht der Verteidiger (defensive, kein Marsch) und kaempft eingegraben? */
  eingegraben: boolean
  festung: number
  /**
   * Wird die Armee des Verteidigers zuerst aufgestellt? Das legt ihre Stelle in `armyOrder`
   * fest. Bis zur Nacharbeit (Durchsicht N2) stand sie in beiden Laeufen des Seitentauschs
   * vorn — eine Schieflage nach Armeereihenfolge waere unsichtbar geblieben.
   */
  verteidigerZuerst: boolean
}

/** Gleiche, reichliche Vorraete fuer alle: sonst misst `supplyFactor` die Startnation. */
function gleicheVorraete(state: GameState): void {
  for (const playerId of state.playerOrder) {
    for (const key of RESOURCE_KEYS) state.players[playerId]!.resources[key] = 4_000_000
  }
}

const trefferpunkteIn = (state: GameState, owner: string): number =>
  state.armyOrder
    .map((id) => state.armies[id]!)
    .filter((army) => army.owner === owner && army.locationProvinceId === PROVINZ && !army.embarked)
    .reduce((sum, army) => sum + armyHp(army), 0)

const gefechtIn = (events: readonly GameEvent[]) =>
  events.find(
    (event): event is Extract<GameEvent, { type: 'BATTLE_RESOLVED' }> =>
      event.type === 'BATTLE_RESOLVED' && event.provinceId === PROVINZ,
  )

/**
 * Ein Nahkampf mit festen Rollen. `verteidiger` sagt nur, welcher Spieler die Rolle traegt;
 * alles, was der Rolle gehoert — Provinz, Festung, Haltung —, wandert mit.
 */
function nahkampf(verteidiger: 'p1' | 'p2', lage: Lage, ticks: number) {
  const angreifer = verteidiger === 'p1' ? 'p2' : 'p1'
  const ctx = { map, rules: OHNE_STREUUNG }
  let state = createInitialState(ZWEI, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
  gleicheVorraete(state)
  state.provinces[PROVINZ]!.owner = verteidiger
  state.provinces[PROVINZ]!.buildings = { ...state.provinces[PROVINZ]!.buildings, fortress: lage.festung }

  const abwehr = () =>
    placeArmy(state, { owner: verteidiger, at: PROVINZ, units: lage.abwehr, stance: lage.eingegraben ? 'defensive' : 'aggressive' })
  const angriff = () => placeArmy(state, { owner: angreifer, at: PROVINZ, units: lage.angriff, stance: 'aggressive' })
  if (lage.verteidigerZuerst) {
    abwehr()
    angriff()
  } else {
    angriff()
    abwehr()
  }

  const verlauf: { verteidiger: number; angreifer: number; staerke: [number, number, number, number]; sieger: string | null }[] = []
  for (let tick = 0; tick < ticks; tick++) {
    const result = step(state, [], ctx)
    state = result.state
    const gefecht = gefechtIn(result.events)
    if (!gefecht) break
    const rolle = (player: string | null) => (player === verteidiger ? 'verteidiger' : player === angreifer ? 'angreifer' : null)
    // Nacharbeit (Durchsicht N2): fehlte `strengths`, stand hier still -1 auf beiden Seiten,
    // und der Vergleich blieb gleich. Beide Seiten kaempfen — beide muessen gemeldet sein.
    const staerke = (player: string): [number, number] => {
      const eintrag = gefecht.strengths?.[player]
      expect(eintrag, `Tick ${tick}: BATTLE_RESOLVED ohne strengths fuer ${player}`).toBeDefined()
      return [eintrag!.before, eintrag!.after]
    }
    verlauf.push({
      verteidiger: gefecht.losses[verteidiger] ?? 0,
      angreifer: gefecht.losses[angreifer] ?? 0,
      staerke: [...staerke(verteidiger), ...staerke(angreifer)],
      sieger: rolle(gefecht.victor),
    })
  }
  return { verlauf, rest: { verteidiger: trefferpunkteIn(state, verteidiger), angreifer: trefferpunkteIn(state, angreifer) } }
}

describe('T-M41-07 Der Seitentausch im Nahkampf spiegelt bei Streuung 0 exakt', () => {
  it('kennt die Landverbaende, die er benutzt, und keiner hat Reichweite', () => {
    for (const key of LAND) {
      expect(TEST_RULES.units[key], key).toBeDefined()
      expect(TEST_RULES.units[key]!.rangeProvinces ?? 0, key).toBe(0)
    }
  })

  it('gibt beiden Spielern in derselben Rolle dieselben Verluste, Tick fuer Tick', () => {
    const lage: Lage = {
      abwehr: [{ unitKey: 'infantry', hpTotal: 60_000 }],
      angriff: [
        { unitKey: 'infantry', hpTotal: 40_000 },
        { unitKey: 'tank', hpTotal: 52_000 },
      ],
      eingegraben: true,
      festung: 1,
      verteidigerZuerst: true,
    }
    const alsP1 = nahkampf('p1', lage, 6)
    const alsP2 = nahkampf('p2', lage, 6)

    expect(alsP1.verlauf.length, 'kein Gefecht - die Lage misst nichts').toBe(6)
    expect(alsP1.verlauf[0]!.verteidiger + alsP1.verlauf[0]!.angreifer).toBeGreaterThan(0)
    expect(alsP2).toEqual(alsP1)
    // Und die Stelle in `armyOrder` spielt keine Rolle (Nacharbeit, Durchsicht N2).
    expect(nahkampf('p1', { ...lage, verteidigerZuerst: false }, 6)).toEqual(alsP1)
    expect(nahkampf('p2', { ...lage, verteidigerZuerst: false }, 6)).toEqual(alsP1)
  })

  it('haelt fuer beliebige Verbaende, Festung, Haltung und Aufstellungsreihenfolge', () => {
    const verbaende = fc
      .subarray([...LAND], { minLength: 1 })
      .chain((keys) =>
        fc
          .array(fc.integer({ min: 1_000, max: 200_000 }), { minLength: keys.length, maxLength: keys.length })
          .map((hps) => keys.map((unitKey, index) => ({ unitKey, hpTotal: hps[index]! }))),
      )

    fc.assert(
      fc.property(
        fc.record({
          abwehr: verbaende,
          angriff: verbaende,
          eingegraben: fc.boolean(),
          festung: fc.integer({ min: 0, max: 3 }),
          verteidigerZuerst: fc.boolean(),
        }),
        (lage) => {
          const alsP1 = nahkampf('p1', lage, 4)
          expect(alsP1.verlauf.length).toBeGreaterThan(0)
          // Seitentausch: dieselbe Rolle, der andere Spieler.
          expect(nahkampf('p2', lage, 4)).toEqual(alsP1)
          // Armeereihenfolge (Nacharbeit, Durchsicht N2): im Seitentausch steht die Rolle in
          // beiden Laeufen an derselben Stelle von `armyOrder`; erst die andere Aufstellung
          // sieht eine Schieflage nach Reihenfolge.
          expect(nahkampf('p1', { ...lage, verteidigerZuerst: !lage.verteidigerZuerst }, 4)).toEqual(alsP1)
          return true
        },
      ),
      { numRuns: 40 },
    )
  })
})

describe('R-BAT-07/AK1 Verbleibende Staerke plus gemeldete Verluste ergeben die Ausgangsstaerke', () => {
  /*
   * Gemessen wird um die Kampfphase herum, nicht um den ganzen Tick: `upkeep`, `retreat`,
   * `bombardment` und `regeneration` aendern Trefferpunkte ebenfalls, und ein Vergleich
   * ueber den Tick maesse sie mit. `step` meldet jede Phase ueber `onPhase` — der Stand
   * nach `bombardment` ist der Stand vor `combat`.
   */
  it('gilt ueber 50 Ticks eines Dreiparteienkampfes, je Macht und in der Summe', () => {
    const ctx = { map, rules: TEST_RULES }
    let state = createInitialState(DREI, ctx)
    for (const key of ['p1|p2', 'p1|p3', 'p2|p3']) state.diplomacy.relations[key]!.state = 'war'
    gleicheVorraete(state)
    state.provinces[PROVINZ]!.owner = 'p1'

    placeArmy(state, { owner: 'p1', at: PROVINZ, units: [{ unitKey: 'infantry', hpTotal: 900_000 }], stance: 'defensive' })
    placeArmy(state, {
      owner: 'p2',
      at: PROVINZ,
      units: [
        { unitKey: 'tank', hpTotal: 500_000 },
        { unitKey: 'infantry', hpTotal: 300_000 },
      ],
    })
    placeArmy(state, { owner: 'p3', at: PROVINZ, units: [{ unitKey: 'motorized', hpTotal: 700_000 }] })
    const maechte = ['p1', 'p2', 'p3']

    let abgezogenGesamt = 0
    let gemeldetGesamt = 0
    let gefechte = 0
    let dreiParteien = 0
    let staerkenGeprueft = 0

    for (let tick = 0; tick < 50; tick++) {
      let vorher: Record<string, number> = {}
      let nachher: Record<string, number> = {}
      const result = step(state, [], ctx, {
        onPhase: (phase, draft) => {
          if (phase === 'bombardment') vorher = Object.fromEntries(maechte.map((p) => [p, trefferpunkteIn(draft, p)]))
          if (phase === 'combat') nachher = Object.fromEntries(maechte.map((p) => [p, trefferpunkteIn(draft, p)]))
        },
      })
      state = result.state

      const gefecht = gefechtIn(result.events)
      if (!gefecht) break
      gefechte += 1
      if (Object.keys(gefecht.losses).length === 3) dreiParteien += 1

      for (const p of maechte) {
        const abgezogen = vorher[p]! - nachher[p]!
        const gemeldet = gefecht.losses[p] ?? 0
        expect(abgezogen, `Tick ${state.tick}, ${p}: abgezogen gegen gemeldet`).toBe(gemeldet)
        // Nacharbeit (Durchsicht N2): `if (strengths[p])` uebersprang eine fehlende Meldung
        // still. Wer vor dem Kampf Truppen in der Provinz hat, kaempft — und wird gemeldet.
        const staerke = gefecht.strengths?.[p]
        if (vorher[p]! > 0) {
          expect(staerke, `Tick ${state.tick}, ${p}: BATTLE_RESOLVED ohne strengths`).toBeDefined()
          expect(staerke!.before, `Tick ${state.tick}, ${p}: Staerke vorher`).toBe(vorher[p])
          expect(staerke!.after, `Tick ${state.tick}, ${p}: Staerke nachher`).toBe(nachher[p])
          staerkenGeprueft += 1
        }
        abgezogenGesamt += abgezogen
        gemeldetGesamt += gemeldet
      }
    }

    // Nicht leer gemessen: 50 Gefechtsticks mit drei Parteien und echten Verlusten.
    expect(gefechte, 'das Gefecht endete vor 50 Ticks').toBe(50)
    expect(dreiParteien, 'kein Tick mit drei Parteien').toBeGreaterThan(0)
    // Mindestens zwei gemeldete Staerken je Gefechtstick: sonst prueft die Zusicherung oben nichts.
    expect(staerkenGeprueft, 'strengths nie geprueft').toBeGreaterThanOrEqual(2 * gefechte)
    expect(gemeldetGesamt).toBeGreaterThan(0)
    expect(abgezogenGesamt).toBe(gemeldetGesamt)
  })
})
