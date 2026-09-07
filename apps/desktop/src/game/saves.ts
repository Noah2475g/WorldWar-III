import {
  AUTOSAVE_SLOTS,
  autosaveName,
  deserialise,
  serialise,
  shouldAutosave,
  type AutosaveState,
  type GameState,
  type StoragePort,
} from '@worldwar/core'
import { t } from '../i18n/text.ts'

/**
 * Saving and loading, from the interface's side (T-M10-07b, R-GAME-03/04/05).
 *
 * The core does the work; what happens here is the part the player sees — which slots
 * exist, what went wrong, and in words rather than in an error code. A save that
 * cannot be read must say so plainly: silently starting a new game instead is how a
 * player loses an evening without knowing why.
 */

export const MANUAL_SLOTS = 5

export interface SlotInfo {
  name: string
  label: string
  savedAtDay: number | null
}

export function manualSlotName(index: number): string {
  return `stand-${index + 1}`
}

/** What the saves dialogue shows: five manual slots plus the autosave rotation. */
export async function listSlots(storage: StoragePort, ticksPerDay: number): Promise<SlotInfo[]> {
  const slots: SlotInfo[] = []

  for (let i = 0; i < MANUAL_SLOTS; i++) {
    const name = manualSlotName(i)
    slots.push({
      name,
      label: t('saves.slot', { number: i + 1 }),
      savedAtDay: await savedDay(storage, name, ticksPerDay),
    })
  }

  for (let i = 0; i < AUTOSAVE_SLOTS; i++) {
    const name = autosaveName(i)
    slots.push({
      name,
      label: `${t('saves.autosave')} ${i + 1}`,
      savedAtDay: await savedDay(storage, name, ticksPerDay),
    })
  }

  return slots
}

async function savedTick(storage: StoragePort, name: string): Promise<number | null> {
  if (!(await storage.exists(name))) return null
  try {
    const raw = JSON.parse(await storage.read(name)) as { savedAtTick?: number }
    if (typeof raw.savedAtTick !== 'number') return null
    return raw.savedAtTick
  } catch {
    // A slot that cannot be read is shown as unreadable rather than as empty: the
    // difference matters when the player is looking for a game they know they saved.
    return null
  }
}

async function savedDay(
  storage: StoragePort,
  name: string,
  ticksPerDay: number,
): Promise<number | null> {
  const tick = await savedTick(storage, name)
  return tick === null ? null : Math.floor(tick / ticksPerDay) + 1
}

export interface LatestSave {
  name: string
  day: number
}

/**
 * Der jüngste Stand — für „Weiterspielen (Tag N)" (T-M22-04, Befund V2-04).
 *
 * „Jüngst" heißt hier: der am weitesten gespielte Stand. Der Umschlag trägt keine
 * Wanduhrzeit, nur `savedAtTick` — und der weiteste Stand ist ohnehin das, was
 * „Weiterspielen" meint: dort ging die Partie zuletzt weiter. Autosaves und manuelle
 * Stände zählen gleichermaßen; bei Gleichstand gewinnt der zuerst gelistete.
 */
export async function latestSlot(storage: StoragePort, ticksPerDay: number): Promise<LatestSave | null> {
  const names = [
    ...Array.from({ length: MANUAL_SLOTS }, (_, i) => manualSlotName(i)),
    ...Array.from({ length: AUTOSAVE_SLOTS }, (_, i) => autosaveName(i)),
  ]

  let best: { name: string; tick: number } | null = null
  for (const name of names) {
    const tick = await savedTick(storage, name)
    if (tick === null) continue
    if (!best || tick > best.tick) best = { name, tick }
  }
  return best ? { name: best.name, day: Math.floor(best.tick / ticksPerDay) + 1 } : null
}

export type LoadOutcome =
  | { ok: true; state: GameState }
  | { ok: false; message: string }

/**
 * Loads a save and turns any failure into a sentence.
 *
 * Every path returns something the player can act on. "Beschädigt" tells them to use
 * another slot; "aus einer anderen Fassung" tells them the game was updated. An
 * exception reaching the interface would tell them nothing.
 */
export async function loadFrom(storage: StoragePort, name: string): Promise<LoadOutcome> {
  try {
    const text = await storage.read(name)
    return { ok: true, state: deserialise(text) }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/Version/i.test(message)) return { ok: false, message: t('saves.wrongVersion') }
    if (/Prüfsumme|beschädigt|JSON|Format/i.test(message)) return { ok: false, message: t('saves.corrupt') }
    return { ok: false, message: t('saves.corrupt') }
  }
}

export async function saveTo(
  storage: StoragePort,
  name: string,
  state: GameState,
  label?: string,
): Promise<void> {
  await storage.write(name, serialise(state, label))
}

/**
 * Whether it is time for an automatic save.
 *
 * Both clocks have to agree — enough game time *and* enough real time. At a hundred
 * game hours a second, ticks alone would trigger a save every few seconds and fill the
 * rotation with near-identical states, which is the opposite of a safety net.
 */
export function autosaveDue(
  autosave: AutosaveState,
  state: GameState,
  nowMs: number,
  minutes: number,
  ticksPerDay: number,
): boolean {
  // The core counts the game-time part in days; the setting is in real minutes, and
  // one game day is the smallest interval that makes sense to save at.
  return shouldAutosave(autosave, state.tick, nowMs, 1, ticksPerDay, minutes * 60)
}
