import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  publicView,
  setPassage,
  step,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
} from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearanceAlerts, clearanceNotices } from './clearance.ts'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const notice = TEST_RULES.constants.rightOfWayNoticeTicks

const CONFIG: GameConfig = {
  seed: 202,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const diplo = (playerId: string, targetPlayerId: string, action: string): Command =>
  ({ type: 'DIPLOMACY', playerId, targetPlayerId, action }) as Command

const ueberfall = (events: readonly GameEvent[], taeter: string, opfer: string) =>
  events.find(
    (e) => e.type === 'WAR_DECLARED' && e.withoutDeclaration === true && e.playerId === taeter && e.targetPlayerId === opfer,
  )

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

/** Ausgangsstand plus ein leerer Tick (Tick 1), damit `sinceTick > 0` möglich ist (E4). */
function neu(): GameState {
  return step(state, [], ctx).state
}

/** Frieden mit einer eigenen Armee in `at` — die Annahme greift, bevor die Armee besetzt (Sonde P1). */
function friedenMitArmee(at = 'o3'): { state: GameState; army: ReturnType<typeof placeArmy>; since: number } {
  const nach1 = neu()
  nach1.diplomacy.relations['p1|p2']!.state = 'war'
  nach1.diplomacy.offers = [{ from: 'p2', to: 'p1', kind: 'peace', tick: nach1.tick }] as never
  const army = placeArmy(nach1, { owner: 'p1', at, units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
  const acc = step(nach1, [diplo('p1', 'p2', 'acceptPeace')], ctx)
  const since = acc.state.diplomacy.relations['p1|p2']!.sinceTick
  return { state: acc.state, army, since }
}

function meldungen(s: GameState, wer = 'p1') {
  return clearanceNotices(publicView(s, wer, TEST_RULES), map, TEST_RULES)
}

describe('R-DIP-10/AK5 clearanceNotices spiegelt die Kernbedingung aus der Sicht', () => {
  it('K1 Frieden mit Armee in o3: genau eine Meldung', () => {
    const { state: after, army, since } = friedenMitArmee('o3')
    const n = meldungen(after)
    expect(n).toEqual([{ armyId: army.id, provinceId: 'o3', hostId: 'p2', deadlineTick: since + notice, cause: 'peace' }])
  })

  it('K2 Frieden, Armee im eigenen Land (n2): keine Meldung', () => {
    const { state: after } = friedenMitArmee('o3')
    // eine zweite Armee im eigenen Land darf nicht mitgemeldet werden
    placeArmy(after, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const n = meldungen(after).filter((x) => x.provinceId === 'n2')
    expect(n).toEqual([])
  })

  it('K3 fremder Frieden: p1-Armee in o3 mit unbefristetem Recht von p2, p2 und p3 schliessen Frieden', () => {
    const nach1 = neu()
    setPassage(nach1.diplomacy.relations['p1|p2']!, 'p2', 'p1', true, null)
    placeArmy(nach1, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    nach1.diplomacy.relations['p2|p3']!.state = 'war'
    nach1.diplomacy.offers = [{ from: 'p3', to: 'p2', kind: 'peace', tick: nach1.tick }] as never
    const acc = step(nach1, [diplo('p2', 'p3', 'acceptPeace')], ctx)
    expect(meldungen(acc.state)).toEqual([])
  })

  it('K4 Frieden seit Spielbeginn (sinceTick 0): keine Meldung (E4)', () => {
    // frischer Stand, ohne den zusaetzlichen `step`: Beziehung ist bei Tick 0 schon `peace`.
    const frisch = createInitialState(CONFIG, ctx)
    expect(frisch.diplomacy.relations['p1|p2']!.sinceTick).toBe(0)
    placeArmy(frisch, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    expect(meldungen(frisch)).toEqual([])
  })

  it('K5 Buendnisbruch: Armee in o3, p2 bricht das Buendnis mit p1', () => {
    const nach1 = neu()
    nach1.diplomacy.relations['p1|p2']!.state = 'alliance'
    const army = placeArmy(nach1, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const brk = step(nach1, [diplo('p2', 'p1', 'breakAlliance')], ctx)
    const since = brk.state.diplomacy.relations['p1|p2']!.sinceTick
    expect(meldungen(brk.state)).toEqual([
      { armyId: army.id, provinceId: 'o3', hostId: 'p2', deadlineTick: since + notice, cause: 'peace' },
    ])
  })

  it('K6 Kuendigung empfangen: keine Meldung solange gewaehrt (K6a), eine nach der Kuendigung', () => {
    const granted = step(state, [diplo('p2', 'p1', 'grantRightOfWay')], ctx).state
    const army = placeArmy(granted, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    // K6a
    expect(meldungen(granted)).toEqual([])
    const rv = step(granted, [diplo('p2', 'p1', 'revokeRightOfWay')], ctx)
    const ev = rv.events.find((e) => e.type === 'RIGHT_OF_WAY_CHANGED') as { effectiveAtTick: number }
    const ends = ev.effectiveAtTick
    expect(meldungen(rv.state)).toEqual([
      { armyId: army.id, provinceId: 'o3', hostId: 'p2', deadlineTick: ends - 1, cause: 'revoked' },
    ])
    // die eine vorsichtige Stunde (E3): bei Sicht-Tick `ends` kennt die Sicht die Kuendigung nicht mehr
    let cur = rv.state
    while (cur.tick < ends) cur = step(cur, [], ctx).state
    expect(meldungen(cur)).toEqual([])
  })

  it('K6b eigene Kuendigung: keine Meldung an den Kuendigenden, eine an den Gast', () => {
    const granted = step(state, [diplo('p1', 'p2', 'grantRightOfWay')], ctx).state
    placeArmy(granted, { owner: 'p2', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const rv = step(granted, [diplo('p1', 'p2', 'revokeRightOfWay')], ctx)
    expect(meldungen(rv.state, 'p1')).toEqual([])
    expect(meldungen(rv.state, 'p2').length).toBe(1)
  })

  it('K7 Raeumweg: Marsch hinaus loescht die Meldung, tiefer hinein laesst sie stehen', () => {
    const { state: after, army, since } = friedenMitArmee('o3')
    const zuN2 = step(after, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 'n2' } as Command], ctx)
    expect(meldungen(zuN2.state)).toEqual([])
    const zuN1 = step(after, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 'n1' } as Command], ctx)
    expect(meldungen(zuN1.state)).toEqual([])
    const zuO1 = step(after, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 'o1' } as Command], ctx)
    expect(meldungen(zuO1.state)).toEqual([
      { armyId: army.id, provinceId: 'o3', hostId: 'p2', deadlineTick: since + notice, cause: 'peace' },
    ])
  })

  /**
   * G9 (Gegenprobe des Bauplans, Testluecke geschlossen): der Kern verlangt fuer den
   * Raeumweg **kein** `strictExit` (D34.3) — das erste Feld hinter der Gastmacht muss nicht
   * selbst frei betretbar sein. K7 allein hatte das nie geprueft, weil dort jeder Ausgang
   * in eigenes oder herrenloses Land fuehrt (`mayStand` waere dort auch mit `strictExit`
   * wahr). Hier fuehrt der kuerzeste Weg aus `o2` direkt in `s2`, das Land einer DRITTEN
   * Macht ohne jedes Recht fuer p1 — mit `strictExit: true` waere das kein Raeumweg mehr.
   */
  it('K7b Raeumweg ueber eine dritte Macht ohne Recht (o2 -> s2): zaehlt trotzdem (kein strictExit)', () => {
    const nach1 = neu()
    nach1.diplomacy.relations['p1|p2']!.state = 'war'
    nach1.diplomacy.offers = [{ from: 'p2', to: 'p1', kind: 'peace', tick: nach1.tick }] as never
    const army = placeArmy(nach1, { owner: 'p1', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const acc = step(nach1, [diplo('p1', 'p2', 'acceptPeace')], ctx)
    const zuS2 = step(acc.state, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 's2' } as Command], ctx)
    expect(zuS2.state.armies[army.id]!.path).toEqual(['s2'])
    expect(meldungen(zuS2.state)).toEqual([])
  })

  it('K8 Frist vorbei: Beziehung ist dann Krieg (Ueberfall), keine Meldung mehr', () => {
    const { state: after, since } = friedenMitArmee('o3')
    let cur = after
    while (cur.tick < since + notice + 5) cur = step(cur, [], ctx).state
    expect(cur.diplomacy.relations['p1|p2']!.state).toBe('war')
    expect(meldungen(cur)).toEqual([])
  })

  it('K9 clearanceAlerts: Satz, Sprungziel, Art', () => {
    const { state: after, army, since } = friedenMitArmee('o3')
    const n = meldungen(after)
    const alerts = clearanceAlerts(
      publicView(after, 'p1', TEST_RULES),
      n,
      { army: (id) => after.armies[id]!.name },
      TEST_RULES.constants.ticksPerDay,
    )
    expect(alerts).toHaveLength(1)
    const alert = alerts[0]!
    expect(alert.id).toBe(`clearance:${army.id}`)
    expect(alert.kind).toBe('clearance')
    expect(alert.icon).toBe('truce')
    expect(alert.provinceId).toBe('o3')
    expect(alert.armyId).toBe(army.id)
    const day = Math.floor((since + notice) / TEST_RULES.constants.ticksPerDay) + 1
    const hour = (since + notice) % TEST_RULES.constants.ticksPerDay
    expect(alert.text).toBe(
      `Räumfrist: ${army.name} steht in Ostfeld (Ostmark). Losmarschieren bis Tag ${day}, ${String(hour).padStart(2, '0')}:00 — ein Marsch auf dem kürzesten Weg hinaus gilt nicht als Überfall.`,
    )
    expect(alert.text).not.toMatch(/\bp\d\b|\ba\d+\b|\{\{|undefined/)
  })

  it('K10 Zwilling Frieden gegen den Kern: die gemeldete Frist ist exakt der letzte sichere Tick', () => {
    const { state: after, army, since } = friedenMitArmee('o3')
    // Die Frist kommt aus `meldungen()`, nicht aus einer eigenen Rechnung im Test — sonst
    // prueft der Zwilling nur den Kern und nie clearance.ts selbst (Befund der Gegenprobe G1).
    const deadlineTick = meldungen(after)[0]!.deadlineTick
    expect(deadlineTick).toBe(since + notice)

    let cur = after
    let firstUeberfallAt = -1
    while (cur.tick < deadlineTick + 3) {
      const before = cur.tick
      const r = step(cur, [], ctx)
      if (ueberfall(r.events, 'p1', 'p2')) {
        firstUeberfallAt = before
        break
      }
      cur = r.state
    }
    // Anders als bei der Kuendigung (K11) faellt der erste Ueberfall hier GENAU auf die
    // gemeldete Frist, nicht einen Tick danach: Schutz (a) im Kern gilt nur, solange
    // `draft.tick < sinceTick + notice` — beim Stehenbleiben ohne Marschbefehl greift ab
    // `draft.tick === deadlineTick` nur noch Schutz (b) (der Weg), und der ist bei einer
    // ruhenden Armee nie erfuellt. Marschieren AN diesem Tick ist trotzdem sicher (unten).
    expect(firstUeberfallAt).toBe(deadlineTick)

    // Marschbefehl im letzten sicheren Sicht-Tick: kein Ueberfall ueber 96 Ticks, Armee in n2.
    let atDeadline = after
    while (atDeadline.tick < deadlineTick) atDeadline = step(atDeadline, [], ctx).state
    let r = step(atDeadline, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 'n2' } as Command], ctx)
    let bad = !!ueberfall(r.events, 'p1', 'p2')
    let c = r.state
    for (let i = 0; i < 96; i += 1) {
      r = step(c, [], ctx)
      if (ueberfall(r.events, 'p1', 'p2')) bad = true
      c = r.state
    }
    expect(bad).toBe(false)
    expect(c.armies[army.id]!.locationProvinceId).toBe('n2')
  })

  it('K11 Zwilling Kuendigung gegen den Kern: die gemeldete Frist ist exakt der letzte sichere Tick', () => {
    const granted = step(state, [diplo('p2', 'p1', 'grantRightOfWay')], ctx).state
    const army = placeArmy(granted, { owner: 'p1', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
    const rv = step(granted, [diplo('p2', 'p1', 'revokeRightOfWay')], ctx)
    const ev = rv.events.find((e) => e.type === 'RIGHT_OF_WAY_CHANGED') as { effectiveAtTick: number }
    const deadlineTick = meldungen(rv.state)[0]!.deadlineTick
    expect(deadlineTick).toBe(ev.effectiveAtTick - 1)

    let cur = rv.state
    let firstUeberfallAt = -1
    while (cur.tick < deadlineTick + 5) {
      const before = cur.tick
      const r = step(cur, [], ctx)
      if (ueberfall(r.events, 'p1', 'p2')) {
        firstUeberfallAt = before
        break
      }
      cur = r.state
    }
    // Anders als beim Frieden (K10): `grantsPassage` schuetzt hier blanko, auch stehend,
    // solange `draft.tick < ends` (ends = deadlineTick + 1) — der erste Ueberfall faellt
    // deshalb erst EINEN Tick nach der gemeldeten Frist, nicht auf sie selbst.
    expect(firstUeberfallAt).toBe(deadlineTick + 1)

    let atDeadline = rv.state
    while (atDeadline.tick < deadlineTick) atDeadline = step(atDeadline, [], ctx).state
    let r = step(atDeadline, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: army.id, targetProvinceId: 'n2' } as Command], ctx)
    let bad = !!ueberfall(r.events, 'p1', 'p2')
    let c = r.state
    for (let i = 0; i < 96; i += 1) {
      r = step(c, [], ctx)
      if (ueberfall(r.events, 'p1', 'p2')) bad = true
      c = r.state
    }
    expect(bad).toBe(false)
  })

  it(
    'K12 ganze Partien: 0 fehlend, 0 Verstoesse, mindestens eine Meldung',
    () => {
      const seeds = [1, 10]
      let fehlend = 0
      let verstoesse = 0
      let gemeldet = 0
      for (const seed of seeds) {
        const cfg: GameConfig = { ...CONFIG, seed, players: CONFIG.players.map((p) => ({ ...p, kind: 'ai' as const, difficulty: 'normal' as const })) }
        let cur = createInitialState(cfg, ctx)
        const open = new Map<string, { armyId: string; hostId: string; deadlineTick: number; player: string }>()
        for (let tick = 0; tick < 200 * TEST_RULES.constants.ticksPerDay; tick += 1) {
          const before = cur
          const r = advanceTicks(cur, 1, ctx)
          cur = r.state
          for (const e of r.events) {
            if (e.type === 'WAR_DECLARED' && e.withoutDeclaration) {
              for (const [key, n] of open) {
                if (n.player === e.playerId && n.hostId === e.targetPlayerId) {
                  if (before.tick < n.deadlineTick) verstoesse += 1
                  open.delete(key)
                }
              }
            }
          }
          for (const e of r.events) {
            const cause =
              (e.type === 'DIPLOMACY_CHANGED' && (e.newState === 'truce' || e.newState === 'peace')) ||
              (e.type === 'RIGHT_OF_WAY_CHANGED' && e.granted === false)
            if (!cause) continue
            const players = e.type === 'RIGHT_OF_WAY_CHANGED' ? [e.targetPlayerId] : [e.playerId, e.targetPlayerId]
            for (const p of players) {
              if (!cur.players[p]?.alive) continue
              const other = p === e.playerId ? e.targetPlayerId : e.playerId
              const ns = clearanceNotices(publicView(cur, p, TEST_RULES), map, TEST_RULES)
              const standingIdle = cur.armyOrder
                .map((id) => cur.armies[id]!)
                .filter((a) => a.owner === p && cur.provinces[a.locationProvinceId]?.owner === other && a.path.length === 0)
              for (const a of standingIdle) {
                if (ns.some((n) => n.armyId === a.id)) gemeldet += 1
                else fehlend += 1
              }
              for (const n of ns) open.set(`${p}:${n.armyId}`, { ...n, player: p })
            }
          }
          for (const [key, n] of open) if (cur.tick > n.deadlineTick + 1) open.delete(key)
          if (cur.victory.winner !== null) break
        }
      }
      expect(fehlend).toBe(0)
      expect(verstoesse).toBe(0)
      // leerer Beweis waere kein Beweis — Startzahlen neu waehlen, wenn das reisst.
      expect(gemeldet).toBeGreaterThanOrEqual(1)
    },
    30_000,
  )
})
