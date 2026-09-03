import { describe, expect, it, vi } from 'vitest'
import { CUE_SPEED_LIMIT, animationMs, cueFor, play, shouldPlay } from './sound.ts'

/**
 * Sound and motion (T-M11-02, R-UI-04).
 *
 * The two rules worth testing are the ones that keep the game bearable rather than the
 * ones that make it pretty: sound switches off completely, and nothing plays or
 * animates while the world is being skimmed at a hundred game hours a second. Without
 * the second rule the alerts arrive dozens a second, which is not atmosphere but a
 * fault siren.
 */

describe('R-UI-04 Ton', () => {
  it('spielt nichts, wenn der Ton aus ist', () => {
    expect(shouldPlay('battle', { enabled: false, speed: 1 })).toBe(false)
  })

  it('spielt nichts im Zeitraffer', () => {
    expect(shouldPlay('battle', { enabled: true, speed: CUE_SPEED_LIMIT + 1 })).toBe(false)
    expect(shouldPlay('battle', { enabled: true, speed: 100 })).toBe(false)
  })

  it('spielt bei normaler Geschwindigkeit', () => {
    expect(shouldPlay('battle', { enabled: true, speed: 1 })).toBe(true)
    expect(shouldPlay('war', { enabled: true, speed: CUE_SPEED_LIMIT })).toBe(true)
  })

  it('kommt ohne Audiogeraet zurecht, statt zu scheitern', () => {
    // A game that refuses to start because a browser has no audio context is absurd.
    expect(play('battle', { enabled: true, speed: 1 }, () => null)).toBe(false)
  })

  it('erzeugt einen Ton, wenn es eines gibt', () => {
    const oscillator = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    const gain = {
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    }
    const audio = {
      currentTime: 0,
      destination: {},
      createOscillator: () => oscillator,
      createGain: () => gain,
    }

    expect(play('war', { enabled: true, speed: 1 }, () => audio as never)).toBe(true)
    expect(oscillator.start).toHaveBeenCalled()
    expect(oscillator.stop).toHaveBeenCalled()
  })

  it('gibt jedem lauten Ereignis einen Klang und den leisen keinen', () => {
    expect(cueFor('BATTLE_STARTED')).toBe('battle')
    expect(cueFor('WAR_DECLARED')).toBe('war')
    expect(cueFor('PROVINCE_CAPTURED')).toBe('captured')
    // Bookkeeping stays silent — a daily report is not an event to look up for.
    expect(cueFor('DAY_REPORT')).toBeNull()
    expect(cueFor('TRADE_EXECUTED')).toBeNull()
  })
})

describe('R-UI-04 Animationen', () => {
  it('laeuft bei normaler Geschwindigkeit voll', () => {
    expect(animationMs(400, 1)).toBe(400)
    expect(animationMs(400, 0)).toBe(400)
  })

  it('verkuerzt mit steigender Geschwindigkeit', () => {
    expect(animationMs(400, 5)).toBe(80)
    expect(animationMs(400, 2)).toBe(200)
  })

  it('schaltet im Zeitraffer ganz ab', () => {
    // Otherwise an army is still sliding across the map long after it arrived, fought
    // and died.
    expect(animationMs(400, CUE_SPEED_LIMIT + 1)).toBe(0)
    expect(animationMs(400, 100)).toBe(0)
  })
})
