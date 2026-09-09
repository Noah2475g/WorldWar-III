import {
  AUTOSAVE_SLOTS,
  autosaveName,
  deserialise,
  serialise,
  shouldAutosave,
  type AutosaveState,
  type GameState,
  type PublicView,
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
 * Die Zeitreihe der Partie (T-M25-01, R-UI-13, D25.1).
 *
 * Die Sicht kennt nur das Jetzt; jeder Verlauf — die Punktekurve, die Sparkline der
 * Wirtschaft — braucht eine Aufzeichnung, und die ist Sache der Hülle, nicht des Kerns
 * (Golden-Master-Schutz). Aufgezeichnet wird am Tageswechsel, am selben Effekt-Ort wie
 * der Tagesbericht: je lebender bekannter Macht die Punkte, für die eigene Macht
 * Bestände und Tagesbilanzen je Rohstoff, alles in Festkomma wie in der Sicht.
 */
export interface TimelineEntry {
  /** Der Spieltag, der mit diesem Eintrag angebrochen ist. */
  day: number
  /** Punkte je Macht, die eigene eingeschlossen; Ausgeschiedene enden hier. */
  scores: Record<string, number>
  /** Eigene Bestände je Rohstoff, Festkomma. */
  stock: Record<string, number>
  /** Eigene Tagesbilanz je Rohstoff, Festkomma. */
  balance: Record<string, number>
}

/**
 * Der Deckel des Ringpuffers: ~400 Tage × 8 Mächte sind ein paar Kilobyte (D25.1).
 * Eine Aufzeichnung ohne Deckel wäre ein Leck mit Absicht.
 */
export const TIMELINE_CAP = 400

/**
 * Ein Tageswechsel kommt in die Reihe — höchstens einmal je Spieltag.
 *
 * Ein zweiter Aufruf am selben Tag (Vorspulen läuft in Häppchen, und jedes Häppchen
 * kann denselben Tagesbericht noch einmal anfassen) gibt die Reihe **unverändert
 * zurück** — dieselbe Referenz, damit ein setState darauf nichts umsonst zeichnet.
 */
export function recordTimelineDay(
  timeline: readonly TimelineEntry[],
  view: PublicView,
  ticksPerDay: number,
): readonly TimelineEntry[] {
  const day = Math.floor(view.tick / ticksPerDay) + 1
  if (timeline[timeline.length - 1]?.day === day) return timeline

  const scores: Record<string, number> = { [view.playerId]: view.self.score }
  for (const other of view.others) {
    if (other.alive) scores[other.id] = other.score
  }

  const stock: Record<string, number> = {}
  const balance: Record<string, number> = {}
  for (const [key, flow] of Object.entries(view.self.economy ?? {})) {
    stock[key] = flow.stock
    balance[key] = flow.balance
  }

  const next = [...timeline, { day, scores, stock, balance }]
  return next.length > TIMELINE_CAP ? next.slice(next.length - TIMELINE_CAP) : next
}

/**
 * Der Speicherschlüssel der Zeitreihe eines Slots — ein Nachbar, kein Teil des Stands.
 *
 * Als Präfix, nicht als Suffix: wer Stände über ihren Namensanfang aufzählt
 * (`autosave-…`, `stand-…`), darf die Zeitreihe dabei nicht mitzählen.
 */
export function timelineName(slotName: string): string {
  return `zeitreihe.${slotName}`
}

export async function saveTimeline(
  storage: StoragePort,
  slotName: string,
  timeline: readonly TimelineEntry[],
): Promise<void> {
  await storage.write(timelineName(slotName), JSON.stringify({ version: 1, entries: timeline }))
}

/**
 * Die Zeitreihe eines Slots — best effort, niemals ein Fehler.
 *
 * Ein alter Stand hat keine; ein unlesbarer Schlüssel ist dasselbe wie keiner. In
 * beiden Fällen beginnt die Kurve ehrlich am Ladetag, und der Leerzustand des
 * Diagramms sagt das (T-M25-02) — eine erfundene Vergangenheit wäre schlimmer.
 */
export async function loadTimeline(storage: StoragePort, slotName: string): Promise<readonly TimelineEntry[]> {
  try {
    const raw = JSON.parse(await storage.read(timelineName(slotName))) as { entries?: unknown }
    if (!Array.isArray(raw.entries)) return []
    return raw.entries.filter(
      (entry): entry is TimelineEntry =>
        typeof entry === 'object' && entry !== null && typeof (entry as TimelineEntry).day === 'number',
    )
  } catch {
    return []
  }
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
