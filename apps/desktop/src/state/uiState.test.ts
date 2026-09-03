import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  FONT_SCALES,
  INITIAL_UI,
  parseSettings,
  uiReducer,
  type UiState,
} from './uiState.ts'

/**
 * The interface's own state (T-M10-04 … T-M10-09).
 *
 * Held apart from the game state on purpose (design D11): which panel is open must
 * never be able to change what happens in the world. These tests are the cheap part of
 * that guarantee — the reducer is a pure function, so every transition can be checked
 * without rendering anything.
 */

const after = (state: UiState, ...actions: Parameters<typeof uiReducer>[1][]): UiState =>
  actions.reduce(uiReducer, state)

describe('R-UI-03 Auswahl', () => {
  it('oeffnet mit einer Provinz das Provinzpanel', () => {
    const state = uiReducer(INITIAL_UI, { type: 'selectProvince', id: 'DEU-NW' })

    expect(state.selectedProvince).toBe('DEU-NW')
    expect(state.panel).toBe('province')
  })

  it('loescht bei neuer Provinz die Armeeauswahl', () => {
    // Otherwise a move order lands on the army that was selected two clicks ago.
    const state = after(
      INITIAL_UI,
      { type: 'selectArmy', id: 'a7' },
      { type: 'selectProvince', id: 'FRA-NE' },
    )

    expect(state.selectedArmy).toBeNull()
  })

  it('schliesst das Provinzpanel beim Abwaehlen', () => {
    const state = after(
      INITIAL_UI,
      { type: 'selectProvince', id: 'ITA-NORTH' },
      { type: 'selectProvince', id: null },
    )

    expect(state.selectedProvince).toBeNull()
    expect(state.panel).toBeNull()
  })

  it('laesst ein anderes Panel beim Abwaehlen offen', () => {
    const state = after(
      INITIAL_UI,
      { type: 'openPanel', panel: 'diplomacy' },
      { type: 'selectProvince', id: null },
    )

    expect(state.panel).toBe('diplomacy')
  })

  it('raeumt bei jeder neuen Auswahl die Meldung weg', () => {
    // A rejection from the last click must not still be on screen after the next one.
    const state = after(
      INITIAL_UI,
      { type: 'notice', text: 'Die Provinz gehört Ihnen nicht.' },
      { type: 'selectProvince', id: 'POL-NW' },
    )

    expect(state.notice).toBeNull()
  })
})

describe('R-UI-03 Kartenmodus und Ausschnitt', () => {
  it('merkt sich den Modus', () => {
    expect(uiReducer(INITIAL_UI, { type: 'setMode', mode: 'morale' }).mode).toBe('morale')
  })

  it('zaehlt Besitzwechsel, damit der Zwischenspeicher es merkt', () => {
    const state = after(INITIAL_UI, { type: 'ownershipChanged' }, { type: 'ownershipChanged' })

    expect(state.ownershipVersion).toBe(INITIAL_UI.ownershipVersion + 2)
  })
})

describe('R-UI-06 Einstellungen', () => {
  it('aendert einzelne Einstellungen, ohne die anderen zu verlieren', () => {
    const state = uiReducer(INITIAL_UI, { type: 'changeSettings', settings: { sound: false } })

    expect(state.settings.sound).toBe(false)
    expect(state.settings.autosaveMinutes).toBe(DEFAULT_SETTINGS.autosaveMinutes)
  })

  it('setzt auf die Vorgabe zurueck', () => {
    const state = after(
      INITIAL_UI,
      { type: 'changeSettings', settings: { sound: false, fontScale: 'large' } },
      { type: 'resetSettings' },
    )

    expect(state.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('liest gespeicherte Einstellungen zurueck', () => {
    const parsed = parseSettings({ autosaveMinutes: 10, sound: false, maxSpeed: 25, fontScale: 'large', debug: true })

    expect(parsed).toEqual({
      autosaveMinutes: 10,
      sound: false,
      maxSpeed: 25,
      fontScale: 'large',
      debug: true,
    })
  })

  it('faellt bei Unsinn auf die Vorgabe zurueck, statt zu scheitern', () => {
    // The settings file is the easiest thing in the game to edit by hand; a font scale
    // of "banana" must not be able to stop the interface from starting.
    expect(parseSettings({ fontScale: 'banana', sound: 'ja' }).fontScale).toBe('normal')
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('kaputt')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ autosaveMinutes: -5 }).autosaveMinutes).toBe(1)
    expect(parseSettings({ maxSpeed: 9999 }).maxSpeed).toBe(100)
  })

  it('macht aus der Schriftgroesse einen spuerbaren Unterschied', () => {
    // A setting that changes nothing visible is worse than no setting.
    expect(FONT_SCALES.large / FONT_SCALES.small).toBeGreaterThan(1.3)
  })
})

describe('R-UI-05 Meldungen', () => {
  it('haelt eine Ablehnung fest, bis sie weggeraeumt wird', () => {
    const state = uiReducer(INITIAL_UI, { type: 'notice', text: 'Es fehlt an Rohstoffen: 400 Eisen.' })

    expect(state.notice).toEqual({ text: 'Es fehlt an Rohstoffen: 400 Eisen.', kind: 'error' })
    expect(uiReducer(state, { type: 'clearNotice' }).notice).toBeNull()
  })
})
