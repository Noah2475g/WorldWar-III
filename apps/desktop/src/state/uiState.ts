import type { GameState, PlayerId } from '@worldwar/core'
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

export type Panel =
  | 'province'
  | 'army'
  | 'diplomacy'
  | 'market'
  | 'standings'
  | 'espionage'
  | 'events'
  | 'settings'
  | 'debug'
  | null

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
  /**
   * Wer am Bildschirm sitzt (T-M37-01, R-MP-01, D28.3).
   *
   * `null` heißt nicht „niemand", sondern „die erste menschliche Macht dieses Standes" —
   * `defaultViewer` beantwortet das aus dem Zustand, damit nirgends eine Kennung fest
   * verdrahtet steht. Im Spiel zu zweit setzt der Gast sie auf seinen eigenen Platz;
   * ohne diesen Wert sähe er die Welt seines Gegners.
   */
  viewerId: PlayerId | null
  /**
   * Die im Diplomatiepanel gewählte Macht (T-M17-14, E9).
   *
   * Bis dahin lebte die Wahl in einem lokalen `useState` des Panels — eine Meldung konnte das
   * Panel dann nicht mit der richtigen Macht öffnen. Gesteuert über `chooseDiplomacyPartner`
   * (nur die Wahl) und `focusDiplomacy` (Panel öffnen und wählen, für den Sprung aus einer
   * Meldung).
   */
  diplomacyPartner: PlayerId | null
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
  viewerId: null,
  diplomacyPartner: null,
}

/**
 * Die Macht, der die Oberfläche gehört, wenn niemand etwas anderes sagt (T-M37-01).
 *
 * Die erste **menschliche** Macht in `playerOrder` — nicht „p1", denn genau diese Annahme
 * stand bis zum 2026-09-14 an neunzehn Stellen in `App.tsx` und wäre im Spiel zu zweit für
 * den Gast falsch. `playerOrder` ist ein ausdrückliches Feld des Zustands und keine
 * Schlüsselreihenfolge (`state/types.ts`, Regel 3), also ist die Antwort auf beiden
 * Rechnern dieselbe.
 */
export function defaultViewer(state: Pick<GameState, 'playerOrder' | 'players'>): PlayerId | null {
  return state.playerOrder.find((id) => state.players[id]?.kind === 'human') ?? state.playerOrder[0] ?? null
}

export type UiAction =
  | { type: 'selectProvince'; id: string | null }
  | { type: 'selectArmy'; id: string | null }
  | { type: 'setView'; view: View }
  | { type: 'setMode'; mode: MapMode }
  | { type: 'openPanel'; panel: Panel }
  | { type: 'closePanel' }
  | { type: 'notice'; text: string; kind?: 'error' | 'info' }
  /**
   * Die Meldezeile leeren. Mit `onlyIf` nur dann, wenn sie gerade einen dieser Saetze
   * traegt — ein Anlass, der nur seine eigene alte Meldung meint, soll keine fremde
   * wegwischen (Befund der Durchsicht vom 2026-09-18 zu MP-4).
   */
  | { type: 'clearNotice'; onlyIf?: readonly string[] }
  | { type: 'changeSettings'; settings: Partial<Settings> }
  | { type: 'resetSettings' }
  | { type: 'ownershipChanged' }
  /** Der Platz, auf dem dieser Bildschirm spielt (T-M37-01). */
  | { type: 'setViewer'; id: PlayerId | null }
  /** Die Macht im Diplomatiepanel waehlen, ohne das Panel zu wechseln (T-M17-14, E9). */
  | { type: 'chooseDiplomacyPartner'; playerId: PlayerId }
  /**
   * Die Diplomatie oeffnen und eine Macht waehlen — der Sprung aus einer Meldung (T-M17-14, E3,
   * E9). Mit `playerId: null` (Sprung ohne bekannte Macht) bleibt ein vorher gewaehlter Partner
   * stehen, statt die Wahl zu loeschen.
   */
  | { type: 'focusDiplomacy'; playerId: PlayerId | null }

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
      if (action.onlyIf && !(state.notice && action.onlyIf.includes(state.notice.text))) return state
      return { ...state, notice: null }

    case 'changeSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } }

    case 'resetSettings':
      return { ...state, settings: DEFAULT_SETTINGS }

    case 'ownershipChanged':
      return { ...state, ownershipVersion: state.ownershipVersion + 1 }

    case 'setViewer':
      // Die Auswahl gehört dem alten Platz: wer den Platz wechselt, hat eine andere
      // Provinz gewählt und eine andere Armee im Panel stehen.
      return { ...state, viewerId: action.id, selectedProvince: null, selectedArmy: null, notice: null }

    case 'chooseDiplomacyPartner':
      return { ...state, diplomacyPartner: action.playerId }

    case 'focusDiplomacy':
      return {
        ...state,
        panel: 'diplomacy',
        diplomacyPartner: action.playerId ?? state.diplomacyPartner,
      }
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
