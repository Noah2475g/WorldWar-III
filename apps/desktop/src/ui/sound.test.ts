import { describe, expect, it, vi } from 'vitest'
import {
  CUE_SPEED_LIMIT,
  animationMs,
  cueFor,
  cueForEvents,
  cueForOwnEvents,
  play,
  resumeOnGesture,
  shouldPlay,
} from './sound.ts'

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

describe('R-UI-04 Ein Tick, ein Ton', () => {
  it('waehlt aus vielen Ereignissen das dringlichste', () => {
    // A tick that declares war, takes a province and finishes a barracks is one sound,
    // not three — and it is the war.
    expect(
      cueForEvents([{ type: 'BUILD_COMPLETED' }, { type: 'PROVINCE_CAPTURED' }, { type: 'WAR_DECLARED' }]),
    ).toBe('war')
  })

  it('bleibt still, wenn nichts davon einen Ton verdient', () => {
    expect(cueForEvents([{ type: 'DAY_REPORT' }, { type: 'TRADE_EXECUTED' }])).toBeNull()
    expect(cueForEvents([])).toBeNull()
  })

  it('nimmt den Kampf vor dem Mangel und den Mangel vor der Fertigstellung', () => {
    expect(cueForEvents([{ type: 'RESOURCE_SHORTAGE' }, { type: 'BATTLE_STARTED' }])).toBe('battle')
    expect(cueForEvents([{ type: 'BUILD_COMPLETED' }, { type: 'RESOURCE_SHORTAGE' }])).toBe('shortage')
  })
})

/**
 * T-M28-08 · Der Ton gehört dem eigenen Gefecht.
 *
 * `BATTLE_STARTED` ist öffentlich: bis hierher spielte ein Gefecht zwischen China und
 * Indien dem amerikanischen Spieler einen Kampfton vor. `concerns` beantwortet dieselbe
 * Frage, die es für das Vorspulen schon beantwortet (T-M15-01) — wen es angeht.
 */
describe('T-M28-08 Nur was mich angeht, klingt', () => {
  const fremd = { type: 'BATTLE_STARTED', concerns: ['p2', 'p3'] }
  const eigen = { type: 'BATTLE_STARTED', concerns: ['p1', 'p2'] }

  it('schweigt beim Gefecht zweier fremder Maechte', () => {
    expect(cueForOwnEvents([fremd], 'p1')).toBeNull()
  })

  it('spielt den Kampfton beim eigenen Gefecht', () => {
    expect(cueForOwnEvents([eigen, fremd], 'p1')).toBe('battle')
  })

  it('waehlt weiterhin den dringlichsten unter den eigenen', () => {
    expect(cueForOwnEvents([eigen, { type: 'WAR_DECLARED', concerns: ['p1'] }], 'p1')).toBe('war')
  })
})

/**
 * Android spielt erst nach der ersten Beruehrung (Android-Emulator, 2026-09-24).
 *
 * Chrome startet einen AudioContext, der vor jeder Nutzergeste entsteht, im Zustand
 * `suspended` — und er bleibt stumm, bis jemand `resume()` ruft, und zwar in einer Geste.
 * Ohne das hoert ein Spieler auf dem Telefon nie einen Ton, obwohl der Ton an ist.
 */
describe('Ton nach der ersten Beruehrung (Autoplay-Regel)', () => {
  /** Ein AudioContext-Double: nur Zustand und resume, mehr braucht die Regel nicht. */
  function fakeAudio(state: 'suspended' | 'running', resumeWorks = true) {
    const audio = {
      state: state as string,
      resume: vi.fn(() => {
        if (!resumeWorks) return Promise.reject(new Error('nicht erlaubt'))
        audio.state = 'running'
        return Promise.resolve()
      }),
    }
    return audio
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('weckt einen schlafenden Ton beim ersten Tippen und haengt sich danach ab', async () => {
    const audio = fakeAudio('suspended')
    const target = new EventTarget()
    resumeOnGesture(audio, target)

    expect(audio.resume).not.toHaveBeenCalled()
    target.dispatchEvent(new Event('pointerdown'))
    expect(audio.resume).toHaveBeenCalledTimes(1)

    await flush()
    target.dispatchEvent(new Event('pointerdown'))
    target.dispatchEvent(new Event('keydown'))
    expect(audio.resume).toHaveBeenCalledTimes(1)
  })

  it('weckt ihn auch mit der Tastatur', () => {
    const audio = fakeAudio('suspended')
    const target = new EventTarget()
    resumeOnGesture(audio, target)

    target.dispatchEvent(new Event('keydown'))
    expect(audio.resume).toHaveBeenCalledTimes(1)
  })

  it('versucht es bei der naechsten Geste wieder, wenn das Wecken scheitert', async () => {
    const audio = fakeAudio('suspended', false)
    const target = new EventTarget()
    resumeOnGesture(audio, target)

    target.dispatchEvent(new Event('pointerdown'))
    await flush()
    target.dispatchEvent(new Event('pointerdown'))
    expect(audio.resume).toHaveBeenCalledTimes(2)
  })

  it('laesst einen laufenden Ton in Ruhe und kommt ohne Ereignisziel aus', () => {
    const audio = fakeAudio('running')
    const target = new EventTarget()
    resumeOnGesture(audio, target)
    target.dispatchEvent(new Event('pointerdown'))
    expect(audio.resume).not.toHaveBeenCalled()

    // In node ist globalThis kein EventTarget: nichts anhaengen, nicht scheitern.
    expect(() => resumeOnGesture(fakeAudio('suspended'), undefined)()).not.toThrow()
  })

  it('haengt sich beim Aufraeumen ab', () => {
    const audio = fakeAudio('suspended')
    const target = new EventTarget()
    const dispose = resumeOnGesture(audio, target)

    dispose()
    target.dispatchEvent(new Event('pointerdown'))
    expect(audio.resume).not.toHaveBeenCalled()
  })
})
