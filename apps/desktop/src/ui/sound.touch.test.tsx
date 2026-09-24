// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { play } from './sound.ts'

/**
 * Der echte Weg durch `play()` (Android-Emulator, 2026-09-24): der erste AudioContext
 * entsteht beim ersten Ton — oft vor jeder Beruehrung, also schlafend — und das erste
 * Tippen irgendwo auf der Seite weckt ihn. Die Regel selbst pruefen die Faelle in
 * sound.test.ts; hier geht es darum, dass `play()` sie auch benutzt.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Der erste AudioContext wartet auf die erste Geste', () => {
  it('play() legt ihn schlafend an, und das erste Tippen weckt ihn', () => {
    const created: FakeAudioContext[] = []

    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume = vi.fn(() => {
        this.state = 'running'
        return Promise.resolve()
      })

      constructor() {
        created.push(this)
      }

      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
      }

      createGain() {
        return { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext)

    expect(play('war', { enabled: true, speed: 1 })).toBe(true)
    expect(created).toHaveLength(1)
    expect(created[0]!.resume).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('pointerdown'))
    expect(created[0]!.resume).toHaveBeenCalledTimes(1)
  })
})
