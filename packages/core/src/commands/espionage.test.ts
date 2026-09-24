import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameEvent } from '../events/types'
import type { PhaseContext } from '../phases/index'
import { SPY_MISSIONS, spySalary } from '../rules/espionage'
import { createInitialState, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, type GameState, type SpyMission } from '../state/types'
import { step } from '../step'
import { publicView } from '../view/publicView'
import './handlers'
import { applyCommand, canApply } from './registry'
import type { Command, CommandResult } from './types'

/**
 * Spione anwerben, ansetzen, entlassen (R-SPY-01, T-M17-07, D29.2).
 *
 * Die Testwelt: p1 (Nordland) hält n1–n3 und sieht von dort m1, m2, i1 und über die Seeverbindung
 * die fremde Hauptstadt s1 von p3. Ostmark (o1–o3, p2) liegt hinter dem Nebel, und das
 * Aufklärungsgedächtnis ist beim Start leer — o1 ist für p1 eine Stadt, „von der er nie gehört hat"
 * (R-SPY-01/AK3). m1 und m2 sind herrenlos.
 */

const map = smallWorld()
const stepCtx = { map, rules: TEST_RULES }
const C = TEST_RULES.constants

const CONFIG: GameConfig = {
  seed: 1917,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState
let events: GameEvent[]
let ctx: PhaseContext

beforeEach(() => {
  state = createInitialState(CONFIG, stepCtx)
  events = []
  ctx = { map, rules: TEST_RULES, commands: [], events }
})

const recruit = (provinceId: string, mission: SpyMission, playerId = 'p1'): Command =>
  ({ type: 'RECRUIT_SPY', playerId, provinceId, mission }) as Command
const reassign = (spyId: string, provinceId: string, mission: SpyMission, playerId = 'p1'): Command =>
  ({ type: 'REASSIGN_SPY', playerId, spyId, provinceId, mission }) as Command
const dismiss = (spyId: string, playerId = 'p1'): Command => ({ type: 'DISMISS_SPY', playerId, spyId }) as Command

const invalid = (reason: string): CommandResult => ({ ok: false, code: 'INVALID_TARGET', detail: { reason } })
const hashOf = (s: GameState) => hashValue(s, { omitKeys: HASH_OMIT_KEYS })

/** Wendet Befehle direkt an und verlangt, dass jeder gelingt — für den Aufbau einer Lage. */
function given(...commands: Command[]): void {
  for (const command of commands) {
    const result = applyCommand(state, command, ctx)
    if (!result.ok) throw new Error(`Aufbau scheiterte: ${command.type} ${JSON.stringify(result)}`)
  }
}

const money = (s: GameState, playerId = 'p1') => s.players[playerId]!.resources.money

describe('R-SPY-01/AK1 Anwerben bucht sofort ab und führt den Spion im Zustand', () => {
  it('zieht den Anwerbepreis im selben Tick ab — genau ihn, sonst nichts', () => {
    const ohne = step(state, [], stepCtx).state
    const mit = step(state, [recruit('s1', 'intel')], stepCtx).state

    expect(money(ohne) - money(mit)).toBe(C.spyRecruitCost)
    // Die anderen zahlen nichts.
    expect(money(mit, 'p3')).toBe(money(ohne, 'p3'))
  })

  it('führt den Spion mit Auftrag, Ziel und Anwerbetag', () => {
    const angeworben = state.tick
    const nachher = step(state, [recruit('s1', 'economicSabotage')], stepCtx).state

    expect(nachher.espionage.spies).toEqual([
      {
        id: 's1',
        owner: 'p1',
        provinceId: 's1',
        mission: 'economicSabotage',
        recruitedTick: angeworben,
        assignedTick: angeworben,
        lastRunTick: null,
        lastOutcome: null,
      },
    ])
    expect(nachher.nextIds.spy).toBe(2)
  })

  it('vergibt fortlaufende Kennungen und hängt in Ausführungsreihenfolge an', () => {
    given(recruit('s1', 'intel'), recruit('n1', 'counter'), recruit('m1', 'intel'))

    expect(state.espionage.spies.map((spy) => `${spy.id}:${spy.provinceId}:${spy.mission}`)).toEqual([
      's1:s1:intel',
      's2:n1:counter',
      's3:m1:intel',
    ])
  })

  it('verändert beim Prüfen nichts (canApply ist rein)', () => {
    const vorher = hashOf(state)
    expect(canApply(state, recruit('s1', 'intel'), ctx)).toEqual({ ok: true })
    expect(hashOf(state)).toBe(vorher)
    expect(state.espionage.spies).toEqual([])
  })
})

describe('R-SPY-01/AK2 Geld, Ziel und Obergrenze', () => {
  it('lehnt mit INSUFFICIENT_RESOURCES ab, wenn ein Tausendstel fehlt — und nimmt den genauen Betrag an', () => {
    state.players['p1']!.resources.money = C.spyRecruitCost - 1
    expect(canApply(state, recruit('s1', 'intel'), ctx)).toEqual({
      ok: false,
      code: 'INSUFFICIENT_RESOURCES',
      detail: { resource: 'money' },
    })

    state.players['p1']!.resources.money = C.spyRecruitCost
    given(recruit('s1', 'intel'))
    expect(money(state)).toBe(0)
  })

  it.each([
    ['intel', 'n1', 'eigene Provinz'],
    ['economicSabotage', 'n1', 'eigene Provinz'],
    ['militarySabotage', 'n2', 'eigene Provinz'],
    ['counter', 's1', 'nicht eigene Provinz'],
    ['counter', 'm1', 'nicht eigene Provinz'],
    ['economicSabotage', 'm1', 'herrenlos'],
    ['militarySabotage', 'm2', 'herrenlos'],
  ] as const)('lehnt %s in %s mit INVALID_TARGET (%s) ab', (mission, provinceId, reason) => {
    expect(canApply(state, recruit(provinceId, mission), ctx)).toEqual(invalid(reason))
  })

  it.each([
    ['intel', 's1'],
    ['intel', 'm1'],
    ['economicSabotage', 's1'],
    ['militarySabotage', 's1'],
    ['counter', 'n3'],
  ] as const)('nimmt %s in %s an', (mission, provinceId) => {
    expect(canApply(state, recruit(provinceId, mission), ctx)).toEqual({ ok: true })
  })

  it('lehnt einen unbekannten Auftrag ab — der Wert wird geprüft, nicht geglaubt', () => {
    // Im Gleichschritt (D28) kommt ein Befehl von einer zweiten Maschine; die Oberfläche kann
    // keinen falschen Wert erzeugen, ein fremder Bau schon (Muster SET_STANCE, T-M40-01).
    expect(canApply(state, recruit('s1', 'bribery' as SpyMission), ctx)).toEqual(invalid('unbekannter Auftrag'))
  })

  it('lehnt bei der Regelhöchstzahl mit QUEUE_FULL ab und zählt nur die eigenen Spione', () => {
    for (let i = 0; i < C.maxSpiesPerPlayer; i++) given(recruit('s1', 'intel'))
    // Eine fremde Macht mit vollem Bestand nimmt p1 nichts weg und umgekehrt.
    for (let i = 0; i < C.maxSpiesPerPlayer; i++) given(recruit('n1', 'intel', 'p3'))

    expect(canApply(state, recruit('s1', 'intel'), ctx)).toEqual({
      ok: false,
      code: 'QUEUE_FULL',
      detail: { max: C.maxSpiesPerPlayer },
    })
    expect(canApply(state, recruit('s2', 'intel', 'p2'), ctx)).toEqual({ ok: true })

    // Wer einen entlässt, darf wieder anwerben.
    given(dismiss('s1'))
    expect(canApply(state, recruit('s1', 'intel'), ctx)).toEqual({ ok: true })
  })
})

describe('R-SPY-01/AK3 Niemand schickt einen Spion in eine Stadt, von der er nie gehört hat', () => {
  it('lehnt eine Provinz ab, die weder sichtbar noch im Aufklärungsgedächtnis ist', () => {
    expect(canApply(state, recruit('o1', 'intel'), ctx)).toEqual(invalid('unbekannt'))
  })

  it('nimmt eine Provinz an, die nur im Aufklärungsgedächtnis steht', () => {
    state.players['p1']!.intel['o1'] = { tick: 0, owner: 'p2', strength: 0 }
    expect(canApply(state, recruit('o1', 'intel'), ctx)).toEqual({ ok: true })
  })

  it('lehnt eine Provinz ab, die es auf der Karte nicht gibt', () => {
    expect(canApply(state, recruit('atlantis', 'intel'), ctx)).toEqual({
      ok: false,
      code: 'PROVINCE_NOT_FOUND',
      detail: { provinceId: 'atlantis' },
    })
  })

  it('prüft das Ziel gegen das, was der Spieler weiß — nicht gegen den verborgenen Besitzer', () => {
    // o3 liegt hinter dem Nebel. Das Gedächtnis sagt „Ostmark", in Wahrheit ist sie herrenlos
    // geworden. Die Prüfung gegen den wahren Besitzer verriete den Wechsel durch ihre Ablehnung —
    // und über canApply könnte jede KI den Nebel abfragen. Ob der Auftrag noch passt, entscheidet
    // der Tageslauf (`targetChanged`, D29.3).
    state.provinces['o3']!.owner = null
    state.players['p1']!.intel['o3'] = { tick: 0, owner: 'p2', strength: 0 }
    expect(canApply(state, recruit('o3', 'economicSabotage'), ctx)).toEqual({ ok: true })

    // Und umgekehrt: erinnert herrenlos, in Wahrheit Ostmark.
    state.players['p1']!.intel['o2'] = { tick: 0, owner: null, strength: 0 }
    expect(canApply(state, recruit('o2', 'economicSabotage'), ctx)).toEqual(invalid('herrenlos'))
  })

  it('gilt auch beim Umsetzen', () => {
    given(recruit('s1', 'intel'))
    expect(canApply(state, reassign('s1', 'o1', 'intel'), ctx)).toEqual(invalid('unbekannt'))
  })
})

describe('D29.2 Prüfreihenfolge — bei zwei Fehlern gewinnt der frühere', () => {
  /** Volle Obergrenze und kein Geld: die beiden letzten Prüfungen schlagen immer an. */
  function vollUndPleite(): void {
    for (let i = 0; i < C.maxSpiesPerPlayer; i++) given(recruit('s1', 'intel'))
    state.players['p1']!.resources.money = 0
  }

  it('Existenz vor allem anderen', () => {
    vollUndPleite()
    expect(canApply(state, recruit('atlantis', 'economicSabotage'), ctx)).toMatchObject({
      code: 'PROVINCE_NOT_FOUND',
    })
  })

  it('Kenntnis des Ziels vor Zielbedingung, Obergrenze und Kosten', () => {
    vollUndPleite()
    expect(canApply(state, recruit('o1', 'counter'), ctx)).toEqual(invalid('unbekannt'))
  })

  it('Zielbedingung vor Obergrenze und Kosten', () => {
    vollUndPleite()
    expect(canApply(state, recruit('n1', 'militarySabotage'), ctx)).toEqual(invalid('eigene Provinz'))
  })

  it('Obergrenze vor Kosten', () => {
    vollUndPleite()
    expect(canApply(state, recruit('s1', 'intel'), ctx)).toMatchObject({ code: 'QUEUE_FULL' })
  })

  it('beim Umsetzen: der Spion vor dem Ziel, das Ziel vor dem Auftrag', () => {
    given(recruit('s1', 'intel'))
    expect(canApply(state, reassign('s99', 'atlantis', 'intel'), ctx)).toEqual(invalid('kein Spion'))
    expect(canApply(state, reassign('s1', 'o1', 'intel', 'p3'), ctx)).toEqual(invalid('kein Spion'))
    expect(canApply(state, reassign('s1', 'atlantis', 'counter'), ctx)).toMatchObject({ code: 'PROVINCE_NOT_FOUND' })
    expect(canApply(state, reassign('s1', 'o1', 'counter'), ctx)).toEqual(invalid('unbekannt'))
  })

  it('Umsetzen kennt weder Obergrenze noch Kosten', () => {
    vollUndPleite()
    expect(canApply(state, reassign('s1', 'n1', 'counter'), ctx)).toEqual({ ok: true })
  })
})

describe('REASSIGN_SPY — Auftrag und Ziel sind jederzeit änderbar, kostenlos', () => {
  it('setzt Ziel, Auftrag und Ansetztag; der Anwerbetag bleibt', () => {
    given(recruit('s1', 'intel'))
    const angeworben = state.tick
    state.tick += 30
    given(reassign('s1', 'n2', 'counter'))

    expect(state.espionage.spies[0]).toMatchObject({
      id: 's1',
      provinceId: 'n2',
      mission: 'counter',
      recruitedTick: angeworben,
      assignedTick: angeworben + 30,
    })
  })

  it('kostet nichts', () => {
    given(recruit('s1', 'intel'))
    const ohne = step(state, [], stepCtx).state
    const mit = step(state, [reassign('s1', 's1', 'militarySabotage')], stepCtx).state
    expect(money(mit)).toBe(money(ohne))
  })

  it('lehnt ein Umsetzen ab, das nichts ändert — es würde nur den nächsten Tag verschenken', () => {
    given(recruit('s1', 'intel'))
    expect(canApply(state, reassign('s1', 's1', 'intel'), ctx)).toEqual(invalid('unverändert'))
    expect(canApply(state, reassign('s1', 's1', 'economicSabotage'), ctx)).toEqual({ ok: true })
    expect(canApply(state, reassign('s1', 'm1', 'intel'), ctx)).toEqual({ ok: true })
  })

  it('prüft die Zielregeln wie beim Anwerben', () => {
    given(recruit('s1', 'intel'))
    expect(canApply(state, reassign('s1', 'n1', 'intel'), ctx)).toEqual(invalid('eigene Provinz'))
    expect(canApply(state, reassign('s1', 's1', 'counter'), ctx)).toEqual(invalid('nicht eigene Provinz'))
    expect(canApply(state, reassign('s1', 'm2', 'militarySabotage'), ctx)).toEqual(invalid('herrenlos'))
  })
})

describe('DISMISS_SPY — ein Spion ist jederzeit entlassbar', () => {
  it('entfernt genau diesen Spion und lässt die Reihenfolge der übrigen stehen', () => {
    given(recruit('s1', 'intel'), recruit('m1', 'intel'), recruit('n1', 'counter'))
    given(dismiss('s2'))
    expect(state.espionage.spies.map((spy) => spy.id)).toEqual(['s1', 's3'])
  })

  it('erstattet nichts und vergibt die Kennung nicht neu', () => {
    given(recruit('s1', 'intel'))
    const ohne = step(state, [], stepCtx).state
    const mit = step(state, [dismiss('s1')], stepCtx).state
    expect(money(mit)).toBe(money(ohne))
    expect(mit.espionage.spies).toEqual([])

    const danach = step(mit, [recruit('s1', 'intel')], stepCtx).state
    expect(danach.espionage.spies.map((spy) => spy.id)).toEqual(['s2'])
  })
})

describe('Verborgene Information: kein Befehl verrät fremde Spione', () => {
  it('lehnt einen fremden Spion genauso ab wie einen, den es nicht gibt', () => {
    // NOT_OWNER hieße: „diese Kennung gibt es, sie gehört jemand anderem". Die Kennungen sind
    // fortlaufend — wer s1, s2, … durchprobiert, zählte so die lebenden Spione aller anderen.
    given(recruit('n1', 'intel', 'p3'))
    const fremd = 's1'
    const nichtDa = 's42'

    expect(canApply(state, dismiss(fremd), ctx)).toEqual(invalid('kein Spion'))
    expect(canApply(state, dismiss(fremd), ctx)).toEqual(canApply(state, dismiss(nichtDa), ctx))
    expect(canApply(state, reassign(fremd, 's1', 'intel'), ctx)).toEqual(
      canApply(state, reassign(nichtDa, 's1', 'intel'), ctx),
    )
  })

  it('erzeugt beim Anwerben, Umsetzen und Entlassen kein Ereignis', () => {
    // D29.5 kennt für diese drei Befehle keines; der Besitzer sieht seine Spione in der Sicht.
    // Ein Ereignis mit leerer oder falscher Leserschaft wäre der kürzeste Weg, das Ziel eines
    // Spions an dessen Opfer zu verraten.
    given(recruit('s1', 'intel'))
    const ohne = step(state, [], stepCtx).events.map((event) => event.type)
    const mit = step(state, [recruit('s1', 'militarySabotage'), reassign('s1', 'm1', 'intel'), dismiss('s1')], stepCtx)
      .events.map((event) => event.type)
    expect(mit).toEqual(ohne)
  })

  it('meldet eine Ablehnung nur dem, der befohlen hat', () => {
    const { events: tickEvents } = step(state, [recruit('n1', 'economicSabotage')], stepCtx)
    const abgelehnt = tickEvents.filter((event) => event.type === 'COMMAND_REJECTED')
    expect(abgelehnt).toHaveLength(1)
    expect(abgelehnt[0]!.audience).toEqual(['p1'])
  })

  it('zeigt jedem nur die eigenen Spione — auch dem, in dessen Provinz einer sitzt', () => {
    given(recruit('s1', 'economicSabotage'), recruit('n1', 'counter'))

    const eigene = publicView(state, 'p1').espionage.spies
    expect(eigene).toEqual([
      {
        id: 's1',
        provinceId: 's1',
        mission: 'economicSabotage',
        recruitedTick: state.tick,
        assignedTick: state.tick,
        lastRunTick: null,
        lastOutcome: null,
      },
      {
        id: 's2',
        provinceId: 'n1',
        mission: 'counter',
        recruitedTick: state.tick,
        assignedTick: state.tick,
        lastRunTick: null,
        lastOutcome: null,
      },
    ])
    // Der Spion sitzt in der Hauptstadt von p3 — p3 erfährt davon nichts.
    expect(publicView(state, 'p3').espionage.spies).toEqual([])
    expect(JSON.stringify(publicView(state, 'p3'))).not.toContain('economicSabotage')
    expect(publicView(state, 'p2').espionage.spies).toEqual([])
  })

  it('gibt in der Sicht Kopien heraus, keine Verweise in den Zustand', () => {
    given(recruit('s1', 'intel'))
    const sicht = publicView(state, 'p1')
    sicht.espionage.spies[0]!.provinceId = 'm1'
    expect(state.espionage.spies[0]!.provinceId).toBe('s1')
  })
})

describe('D29.7 Sold und Anwerbepreis aus dem Anker von T-M17-02', () => {
  const baseline = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../../docs/reports/m17-baseline.json', import.meta.url)), 'utf8'),
  ) as { soldAnker: { soldAnkerFuenfProzent: number } }

  it('setzt den Aufklärungssold auf den gemessenen Anker', () => {
    // 5 % des Medians des Brutto-Geldertrags je Spieltag an Tag 30, abgerundet (T-M17-02).
    expect(C.spySalaryIntel).toBe(baseline.soldAnker.soldAnkerFuenfProzent)
  })

  it('hält die Verhältnisse der Referenz (10.2: 20.000 / 2.000 / 4.000 / 1.000)', () => {
    const intel = C.spySalaryIntel
    expect(C.spyRecruitCost).toBe(intel + intel + intel + intel + intel + intel + intel + intel + intel + intel)
    expect(C.spySalaryEconomicSabotage).toBe(intel + intel)
    expect(C.spySalaryMilitarySabotage).toBe(intel + intel)
    // Die Hälfte, abgerundet wie der Anker selbst.
    expect(C.spySalaryCounter).toBe(Math.floor(intel / 2))
  })

  it('nennt für jeden Auftrag seinen Tagessold', () => {
    expect(SPY_MISSIONS).toEqual(['intel', 'economicSabotage', 'militarySabotage', 'counter'])
    expect(SPY_MISSIONS.map((mission) => spySalary(C, mission))).toEqual([
      C.spySalaryIntel,
      C.spySalaryEconomicSabotage,
      C.spySalaryMilitarySabotage,
      C.spySalaryCounter,
    ])
  })
})
