import type { MapMode } from '../map/modes.ts'
import type { View } from '../map/picking.ts'

/**
 * What the interface knows that the simulation does not (T-M10-04 … T-M10-09).
 *
 * Kept strictly apart from the game state, and the separation is the design (D11):
 * which panel is open and where the map is looking are not part of the world, must
 * not end up in a save file, and must never be able to change the outcome of a game.
 * A reducer rather than scattered setters, so every transition is one testable
 * function instead of a dozen event handlers.
 */

export type Panel = 'province' | 'army' | 'diplomacy' | 'market' | 'standings' | 'events' | 'settings' | 'debug' | null

export interface Settings {
  /** Minutes between automatic saves. */
  autosaveMinutes: number
  sound: boolean
  /** Ceiling for the interactive speed control, in game hours per second. */
  maxSpeed: number
  fontScale: 'small' | 'normal' | 'large'
  debug: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  autosaveMinutes: 5,
  sound: true,
  maxSpeed: 100,
  fontScale: 'normal',
  debug: false,
}

export interface UiState {
  view: View
  mode: MapMode
  selectedProvince: string | null
  selectedArmy: string | null
  panel: Panel
  settings: Settings
  /** The last rejection, shown until the player does something else. */
  notice: { text: string; kind: 'error' | 'info' } | null
  /** Bumped whenever ownership changes, so the map cache knows to rebuild. */
  ownershipVersion: number
}

export const INITIAL_UI: UiState = {
  view: { x: 0, y: 0, scale: 2 },
  mode: 'political',
  selectedProvince: null,
  selectedArmy: null,
  panel: null,
  settings: DEFAULT_SETTINGS,
  notice: null,
  ownershipVersion: 0,
}

export type UiAction =
  | { type: 'selectProvince'; id: string | null }
  | { type: 'selectArmy'; id: string | null }
  | { type: 'setView'; view: View }
  | { type: 'setMode'; mode: MapMode }
  | { type: 'openPanel'; panel: Panel }
  | { type: 'closePanel' }
  | { type: 'notice'; text: string; kind?: 'error' | 'info' }
  | { type: 'clearNotice' }
  | { type: 'changeSettings'; settings: Partial<Settings> }
  | { type: 'resetSettings' }
  | { type: 'ownershipChanged' }

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'selectProvince':
      // Selecting a province clears the army selection: the panel shows one thing at a
      // time, and leaving a stale army selected behind it is how a move order ends up
      // going to the wrong unit.
      return {
        ...state,
        selectedProvince: action.id,
        selectedArmy: null,
        panel: action.id === null ? (state.panel === 'province' ? null : state.panel) : 'province',
        notice: null,
      }

    case 'selectArmy':
      return { ...state, selectedArmy: action.id, panel: action.id === null ? state.panel : 'army', notice: null }

    case 'setView':
      return { ...state, view: action.view }

    case 'setMode':
      return { ...state, mode: action.mode }

    case 'openPanel':
      return { ...state, panel: action.panel }

    case 'closePanel':
      return { ...state, panel: null }

    case 'notice':
      return { ...state, notice: { text: action.text, kind: action.kind ?? 'error' } }

    case 'clearNotice':
      return { ...state, notice: null }

    case 'changeSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }

    case 'resetSettings':
      return { ...state, settings: DEFAULT_SETTINGS }

    case 'ownershipChanged':
      return { ...state, ownershipVersion: state.ownershipVersion + 1 }
  }
}

/**
 * Reading settings back from storage.
 *
 * Anything unknown or out of range falls back to the default rather than being trusted.
 * A settings file is the easiest thing in the game to edit by hand, and a font scale of
 * "banana" must not be able to stop the interface from starting.
 */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const input = raw as Record<string, unknown>

  const number = (key: keyof Settings, min: number, max: number): number => {
    const value = input[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SETTINGS[key] as number
    return Math.min(max, Math.max(min, value))
  }

  return {
    autosaveMinutes: number('autosaveMinutes', 1, 60),
    sound: typeof input.sound === 'boolean' ? input.sound : DEFAULT_SETTINGS.sound,
    maxSpeed: number('maxSpeed', 1, 100),
    fontScale:
      input.fontScale === 'small' || input.fontScale === 'large' || input.fontScale === 'normal'
        ? input.fontScale
        : DEFAULT_SETTINGS.fontScale,
    debug: typeof input.debug === 'boolean' ? input.debug : DEFAULT_SETTINGS.debug,
  }
}

/** Font sizes are multiplied by this, so "large" is a real change and not a token gesture. */
export const FONT_SCALES: Record<Settings['fontScale'], number> = {
  small: 0.875,
  normal: 1,
  large: 1.25,
}

/**
 * Einstellungen, die den Neustart überleben (T-M14-08, schließt T-M10-09).
 *
 * `parseSettings` gab es seit M10 — und außerhalb seines eigenen Tests hat es nie jemand
 * aufgerufen. Die Zusage „Einstellungen überleben den Neustart" stand als erledigt im
 * Plan, war aber nicht einlösbar: es gab keinen dauerhaften Speicher. Tonwahl,
 * Schriftgröße und Tempogrenze setzten sich bei jedem Start zurück.
 *
 * `localStorage` und nicht IndexedDB: das hier sind fünf Werte, sie werden beim ersten
 * Bild gebraucht, und ein asynchroner Speicher hieße, die Oberfläche zunächst falsch zu
 * zeichnen. Die Spielstände gehen den anderen Weg — sie sind groß und dürfen warten.
 */
export const SETTINGS_STORAGE_KEY = 'worldwar.settings'

/** Der kleine Schluessel-Wert-Speicher, den Einstellungen brauchen. */
export interface SettingsStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Was die Anwendung benutzt, wenn niemand etwas anderes reicht. */
const browserStore = (): SettingsStore | undefined => globalThis.localStorage ?? undefined

export function loadSettings(store: SettingsStore | undefined = browserStore()): Settings {
  try {
    const raw = store?.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return parseSettings(JSON.parse(raw))
  } catch {
    // Kaputter Eintrag, kein localStorage, verweigerter Zugriff: die Vorgaben tun es.
    // Eine Einstellung darf den Start des Spiels nicht verhindern.
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings, store: SettingsStore | undefined = browserStore()): void {
  try {
    store?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Kein Speicher, volles Kontingent, privates Fenster — kein Grund, das Spiel zu stören.
  }
}
