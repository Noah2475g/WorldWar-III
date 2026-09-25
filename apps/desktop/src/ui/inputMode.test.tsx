// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  INPUT_QUERIES,
  applyInputMode,
  detectInputMode,
  getInputMode,
  isTouchMode,
  overrideFromSearch,
  useInputMode,
  type InputEnvironment,
} from './inputMode.ts'

/**
 * Finger oder Zeiger (Android-Emulator, 2026-09-24).
 *
 * Die Oberflaeche braucht EINE Antwort auf die Frage, ob hier getippt oder gezeigt wird —
 * sonst entscheidet jede Regel fuer sich, und die Karte ist schon gross, waehrend die
 * Knoepfe noch klein sind. Die Antwort steht als `data-input` an der Wurzel, damit CSS,
 * Komponenten und ein Pruefbot dieselbe lesen. Der Adresszusatz `?touch=1` / `?touch=0`
 * gewinnt immer: ein Emulator, der seine Maus als Hauptzeiger meldet, soll trotzdem
 * deterministisch pruefbar sein.
 */

/** Ein Medienlisten-Double, dessen Antwort sich zur Laufzeit umstellen laesst. */
function fakeMedia(initial: Partial<Record<string, boolean>>) {
  const answers = new Map(Object.entries(initial))
  const listeners = new Map<string, Set<() => void>>()
  const matchMedia = (query: string) => ({
    get matches() {
      return answers.get(query) === true
    },
    addEventListener: (_type: 'change', listener: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set())
      listeners.get(query)!.add(listener)
    },
    removeEventListener: (_type: 'change', listener: () => void) => {
      listeners.get(query)?.delete(listener)
    },
  })
  return {
    matchMedia,
    /** Stellt eine Antwort um und feuert `change` wie der Browser. */
    flip(query: string, value: boolean) {
      answers.set(query, value)
      for (const listener of listeners.get(query) ?? []) listener()
    },
    listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  }
}

function env(search: string, media?: ReturnType<typeof fakeMedia>): InputEnvironment {
  return {
    location: { search },
    ...(media ? { matchMedia: media.matchMedia } : {}),
    document,
  }
}

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  cleanup()
})

describe('Eingabeart: der Adresszusatz gewinnt', () => {
  it('liest ?touch=1 und ?touch=0, sonst nichts', () => {
    expect(overrideFromSearch('?touch=1')).toBe('touch')
    expect(overrideFromSearch('?seed=4&touch=0')).toBe('mouse')
    expect(overrideFromSearch('')).toBeNull()
    expect(overrideFromSearch('?touch=ja')).toBeNull()
  })

  it('schlaegt die Medienabfrage in beide Richtungen', () => {
    const grob = fakeMedia({ [INPUT_QUERIES.coarse]: true })
    const fein = fakeMedia({ [INPUT_QUERIES.coarse]: false })

    expect(detectInputMode(env('?touch=0', grob))).toBe('mouse')
    expect(detectInputMode(env('?touch=1', fein))).toBe('touch')
  })
})

describe('Eingabeart: ohne Zusatz entscheidet der Zeiger', () => {
  it('nimmt einen groben Hauptzeiger als Finger', () => {
    expect(detectInputMode(env('', fakeMedia({ [INPUT_QUERIES.coarse]: true })))).toBe('touch')
  })

  it('nimmt einen groben Nebenzeiger nur dann, wenn nichts schweben kann', () => {
    const nurFinger = fakeMedia({ [INPUT_QUERIES.anyCoarse]: true, [INPUT_QUERIES.noHover]: true })
    // Ein Laptop mit Beruehrungsbildschirm UND Maus: der Finger ist da, aber die Maus fuehrt.
    const laptop = fakeMedia({ [INPUT_QUERIES.anyCoarse]: true, [INPUT_QUERIES.noHover]: false })

    expect(detectInputMode(env('', nurFinger))).toBe('touch')
    expect(detectInputMode(env('', laptop))).toBe('mouse')
  })

  it('bleibt ohne matchMedia bei der Maus, statt zu scheitern', () => {
    expect(detectInputMode(env(''))).toBe('mouse')
    expect(detectInputMode({})).toBe('mouse')
  })
})

describe('Eingabeart: applyInputMode setzt die Wurzel und folgt dem Geraet', () => {
  it('schreibt data-input an <html>', () => {
    dispose = applyInputMode(env('', fakeMedia({ [INPUT_QUERIES.coarse]: true })))

    expect(document.documentElement.dataset['input']).toBe('touch')
    expect(getInputMode()).toBe('touch')
    expect(isTouchMode()).toBe(true)
  })

  it('folgt einem Wechsel der Medienabfrage und hoert beim Aufraeumen auf', () => {
    const media = fakeMedia({ [INPUT_QUERIES.coarse]: false })
    dispose = applyInputMode(env('', media))
    expect(document.documentElement.dataset['input']).toBe('mouse')

    media.flip(INPUT_QUERIES.coarse, true)
    expect(document.documentElement.dataset['input']).toBe('touch')

    dispose()
    dispose = null
    expect(media.listenerCount()).toBe(0)
    expect(document.documentElement.dataset['input']).toBeUndefined()
    // Ohne angewandte Eingabeart faellt das Programm auf die Erkennung zurueck: jsdom
    // kennt kein matchMedia, also die Maus.
    expect(getInputMode()).toBe('mouse')
  })

  it('haengt sich bei einem Adresszusatz an nichts: die Wahl steht fest', () => {
    const media = fakeMedia({ [INPUT_QUERIES.coarse]: false })
    dispose = applyInputMode(env('?touch=1', media))

    media.flip(INPUT_QUERIES.coarse, false)
    expect(document.documentElement.dataset['input']).toBe('touch')
    expect(media.listenerCount()).toBe(0)
  })
})

describe('Eingabeart: useInputMode zeichnet bei einem Wechsel neu', () => {
  function Anzeige() {
    return <output>{useInputMode()}</output>
  }

  it('liefert die Maus, solange nichts angewandt ist', () => {
    render(<Anzeige />)
    expect(screen.getByRole('status').textContent).toBe('mouse')
  })

  it('wechselt mit der Medienabfrage', () => {
    const media = fakeMedia({ [INPUT_QUERIES.coarse]: false })
    dispose = applyInputMode(env('', media))
    render(<Anzeige />)
    expect(screen.getByRole('status').textContent).toBe('mouse')

    act(() => media.flip(INPUT_QUERIES.coarse, true))
    expect(screen.getByRole('status').textContent).toBe('touch')
  })
})
