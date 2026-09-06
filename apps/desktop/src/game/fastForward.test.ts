import { fastForward, createInitialState, type GameConfig } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CHUNK_TICKS, fastForwardChunk } from './fastForward.ts'

/**
 * Vorspulen ruft den Kern (T-M15-06, R-TIME-02, R-TIME-03, R-TIME-06).
 *
 * Bis zum 2026-09-06 rief **kein einziger Spieler-Pfad** `fastForward`. Die Oberfläche
 * rechnete `step(ticksPerDay)` — genau einen Spieltag, ohne Ziel, ohne Alarm, ohne
 * Abbruch —, und der einzige Aufrufer der Kernfunktion war ein Worker-Host, den nichts
 * gestartet hat. Ziel Z1, die frei regelbare Spielgeschwindigkeit, war halb eingelöst,
 * und R-TIME-02 wurde ausschließlich gegen Code geprüft, den kein Spieler ausführt.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 606,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Rechner', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Dritter', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const request = (target: Parameters<typeof fastForwardChunk>[1]['target']) => ({
  target,
  alertsFor: 'p1',
  maxTicks: 30 * TEST_RULES.constants.ticksPerDay,
})

describe('R-TIME-06/AK1 Die Huelle rechnet nicht selbst', () => {
  it('rueckt genau so viele Ticks vor wie der Kern meldet', () => {
    // Der Test, der eine zweite Schleife auffliegen lässt: weichen die vorgerückten Ticks
    // von `ticksRun` ab, hat irgendwo jemand mitgerechnet.
    const state = createInitialState(CONFIG, ctx)
    const before = state.tick

    const result = fastForwardChunk(state, request({ kind: 'days', days: 1 }), ctx, 1000)

    expect(result.ticksRun).toBeGreaterThan(0)
    expect(result.state.tick - before).toBe(result.ticksRun)
  })

  it('liefert dasselbe wie ein unmittelbarer Aufruf des Kerns', () => {
    // Dieselbe Lage, einmal über die Hülle, einmal über den Kern ohne KI. Der Vergleich
    // gilt der *Zahl der Ticks bis zum Ziel*: wäre in der Hülle eine eigene Abbruch- oder
    // Zählregel, stünde hier eine andere Zahl.
    const ueberDieHuelle = fastForwardChunk(createInitialState(CONFIG, ctx), request({ kind: 'nextDay' }), ctx, 1000)
    const imKern = fastForward(createInitialState(CONFIG, ctx), { kind: 'nextDay' }, ctx, {
      alertsFor: 'p1',
      maxTicks: DEFAULT_CHUNK_TICKS,
    })

    expect(ueberDieHuelle.ticksRun).toBe(imKern.ticksRun)
    expect(ueberDieHuelle.stoppedBy).toBe(imKern.stoppedBy)
  })

  it('nennt beim Halt einen Grund, den die Oberflaeche in Worte fassen kann', () => {
    const result = fastForwardChunk(createInitialState(CONFIG, ctx), request({ kind: 'nextDay' }), ctx, 1000)

    expect(['target', 'alert', 'limit']).toContain(result.stoppedBy)
  })
})

describe('R-TIME-06/AK4 Vorspulen rechnet in Haeppchen', () => {
  it('rechnet nie mehr Ticks am Stueck als die Haeppchengroesse', () => {
    // Der Unterschied zwischen "das Spiel rechnet" und "das Spiel hängt": bei 2,463 ms je
    // Tick auf der Weltkarte wären tausend Spieltage rund eine Minute ohne Lebenszeichen.
    const state = createInitialState(CONFIG, ctx)
    const result = fastForwardChunk(state, request({ kind: 'days', days: 30 }), ctx, 1000)

    expect(result.ticksRun).toBeLessThanOrEqual(DEFAULT_CHUNK_TICKS)
    expect(result.stoppedBy, 'ein Haeppchen soll am Deckel enden, nicht am Ziel').toBe('limit')
  })

  it('haelt an der uebergebenen Restmenge an, nicht an der Haeppchengroesse', () => {
    // So endet der Gesamtlauf an seiner Obergrenze und nicht drei Ticks daneben.
    const state = createInitialState(CONFIG, ctx)
    const result = fastForwardChunk(state, request({ kind: 'days', days: 30 }), ctx, 5)

    expect(result.ticksRun).toBe(5)
  })
})

describe('R-TIME-06/AK2 Ein fremder Krieg haelt niemanden auf', () => {
  /** Zwei fremde Mächte im Krieg, der Spieler unbeteiligt. */
  function fremderKrieg() {
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p2|p3']!.state = 'war'
    placeArmy(state, { owner: 'p2', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 200_000 }] })
    placeArmy(state, { owner: 'p3', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    return state
  }

  it('laeuft durch, waehrend zwei andere Maechte kaempfen', () => {
    // Vor T-M15-01 hielt jedes öffentliche Alarmereignis jeden Spieler an: eine Eroberung
    // zwischen zwei fremden Mächten stoppte das Vorspulen eines Unbeteiligten, und auf
    // einer Weltkarte mit acht Mächten kam man keine drei Spieltage weit.
    const result = fastForwardChunk(fremderKrieg(), request({ kind: 'days', days: 30 }), ctx, 1000)

    expect(result.stoppedBy, `angehalten durch ${result.trigger?.type}`).not.toBe('alert')
  })

  it('haelt an, sobald der Spieler selbst betroffen ist', () => {
    // Die Gegenrichtung: die Zusicherung oben wäre auch dann grün, wenn gar nichts mehr
    // anhielte — und ein Vorspulen, das eine verlorene Provinz überrollt, wäre das
    // Schlimmste, was dieses Spiel tun kann.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p2', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 400_000 }] })

    const result = fastForwardChunk(state, request({ kind: 'days', days: 30 }), ctx, 1000)

    expect(result.stoppedBy).toBe('alert')
    expect(result.trigger?.concerns).toContain('p1')
  })
})

describe('R-TIME-06/AK3 Das Ziel "Gefecht beginnt" greift', () => {
  it('endet an BATTLE_STARTED und nennt die Beteiligten', () => {
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p2|p3']!.state = 'war'
    placeArmy(state, { owner: 'p2', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })
    placeArmy(state, { owner: 'p3', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 100_000 }] })

    const result = fastForwardChunk(state, request({ kind: 'battleStarts' }), ctx, 1000)

    expect(result.stoppedBy).toBe('target')
    expect(result.trigger?.type).toBe('BATTLE_STARTED')
    if (result.trigger?.type === 'BATTLE_STARTED') {
      expect(result.trigger.sides.flat().sort()).toEqual(['p2', 'p3'])
    }
  })
})

describe('R-AI-07 Die KI behaelt ihr Gedaechtnis beim Vorspulen', () => {
  it('legt nach jedem Tick ab, was die KI in diesem Tick entschieden hat', () => {
    // Der Grund, warum der Worker-Host nicht verdrahtet wurde: `SimEngine` importierte
    // nichts aus `@worldwar/ai` und konnte `storeMemories` gar nicht ausführen. Beim
    // Vorspulen hätte die KI ihr Gedächtnis verloren — und zwar nur in der Betriebsart,
    // in der niemand hinsieht (DECISIONS.md, 2026-09-06).
    const state = createInitialState(CONFIG, ctx)
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 50_000 }] })

    const result = fastForwardChunk(state, request({ kind: 'days', days: 1 }), ctx, 1000)

    expect(Object.keys(result.state.ai), 'die KI hat kein Gedaechtnis im Zustand').toContain('p2')
    expect(result.state.ai['p2']).toBeDefined()
  })
})
