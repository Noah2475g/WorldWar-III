import { useSyncExternalStore } from 'react'

/**
 * Finger oder Zeiger (Android-Emulator, 2026-09-24).
 *
 * Die Oberflaeche braucht EINE Antwort auf die Frage, ob hier getippt oder gezeigt wird.
 * Sie steht als `data-input="touch" | "mouse"` an `<html>`: `touch.css` schaltet daran
 * die grossen Ziele, Komponenten lesen sie ueber `useInputMode()`, und ein Pruefbot kann
 * sie ueber CDP abfragen, statt Pixel zu deuten.
 *
 * Die Reihenfolge der Entscheidung:
 *  1. `?touch=1` / `?touch=0` in der Adresse gewinnt immer. Ein Emulator, der seine Maus
 *     als Hauptzeiger meldet, soll trotzdem deterministisch pruefbar sein.
 *  2. Ein grober Hauptzeiger (`pointer: coarse`) ist ein Finger.
 *  3. Ein grober Nebenzeiger zaehlt nur, wenn nichts schweben kann (`hover: none`) —
 *     sonst fuehrt die Maus eines Laptops mit Beruehrungsbildschirm.
 *  4. Sonst, auch ohne `matchMedia` (jsdom, sehr alte WebViews): die Maus. Das ist das
 *     Verhalten, das es vorher gab; wer nichts meldet, bekommt nichts Neues.
 */

export type InputMode = 'touch' | 'mouse'

export const INPUT_QUERIES = {
  coarse: '(pointer: coarse)',
  anyCoarse: '(any-pointer: coarse)',
  noHover: '(hover: none)',
} as const

interface MediaListLike {
  readonly matches: boolean
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

/** Was die Erkennung von ihrer Umgebung braucht — im Programm `globalThis`, im Test ein Double. */
export interface InputEnvironment {
  location?: { readonly search: string }
  matchMedia?: (query: string) => MediaListLike
  document?: { readonly documentElement: HTMLElement }
}

/** `?touch=1` heisst Finger, `?touch=0` Maus, alles andere: keine Vorgabe. */
export function overrideFromSearch(search: string): InputMode | null {
  const value = new URLSearchParams(search).get('touch')
  if (value === '1') return 'touch'
  if (value === '0') return 'mouse'
  return null
}

function mediaList(env: InputEnvironment, query: string): MediaListLike | null {
  try {
    return env.matchMedia?.(query) ?? null
  } catch {
    return null
  }
}

/** Die Eingabeart dieser Umgebung, ohne etwas zu veraendern. */
export function detectInputMode(env: InputEnvironment = globalThis): InputMode {
  const forced = overrideFromSearch(env.location?.search ?? '')
  if (forced) return forced

  const matches = (query: string): boolean => mediaList(env, query)?.matches === true
  if (matches(INPUT_QUERIES.coarse)) return 'touch'
  if (matches(INPUT_QUERIES.anyCoarse) && matches(INPUT_QUERIES.noHover)) return 'touch'
  return 'mouse'
}

/** Die angewandte Eingabeart; `null`, solange `applyInputMode` nicht lief (Tests). */
let applied: InputMode | null = null
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/** Die geltende Eingabeart: die angewandte, sonst die erkannte. */
export function getInputMode(): InputMode {
  return applied ?? detectInputMode()
}

export function isTouchMode(): boolean {
  return getInputMode() === 'touch'
}

/**
 * Setzt `data-input` an `<html>` und folgt danach dem Geraet — ein Tablet mit
 * angesteckter Maus wechselt die Art, ohne dass jemand neu laedt. Mit Adresszusatz steht
 * die Wahl fest, und es haengt sich nichts an.
 *
 * Gibt eine Aufraeumfunktion zurueck; das Programm ruft sie nie, die Tests nach jedem Fall.
 */
export function applyInputMode(env: InputEnvironment = globalThis): () => void {
  const root = env.document?.documentElement

  const update = (): void => {
    const mode = detectInputMode(env)
    if (root) root.dataset['input'] = mode
    if (mode === applied) return
    applied = mode
    notify()
  }
  update()

  const lists = overrideFromSearch(env.location?.search ?? '')
    ? []
    : Object.values(INPUT_QUERIES)
        .map((query) => mediaList(env, query))
        .filter((list): list is MediaListLike => list !== null)
  for (const list of lists) list.addEventListener?.('change', update)

  return () => {
    for (const list of lists) list.removeEventListener?.('change', update)
    if (root) delete root.dataset['input']
    applied = null
    notify()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Die Eingabeart fuer Komponenten; zeichnet neu, wenn sie wechselt. */
export function useInputMode(): InputMode {
  return useSyncExternalStore(subscribe, getInputMode, getInputMode)
}
