import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  FONT_SCALES,
  INITIAL_UI,
  SETTINGS_STORAGE_KEY,
  defaultViewer,
  loadSettings,
  parseSettings,
  saveSettings,
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

describe('R-SPY-06 Die Spionageuebersicht', () => {
  it('oeffnet das Spionagepanel', () => {
    expect(uiReducer(INITIAL_UI, { type: 'openPanel', panel: 'espionage' }).panel).toBe('espionage')
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

  it('raeumt mit onlyIf nur die genannten Saetze weg und laesst fremde stehen', () => {
    // Die Pausenantwort darf der naechste Antrag loeschen, einen abgelehnten Befehl nicht
    // (Durchsicht vom 2026-09-18 zu MP-4).
    const fremd = uiReducer(INITIAL_UI, { type: 'notice', text: 'Es fehlt an Rohstoffen: 400 Eisen.' })
    const eigen = uiReducer(INITIAL_UI, { type: 'notice', kind: 'info', text: 'Der Pausenantrag ist verfallen.' })
    const nur = ['Der Pausenantrag ist verfallen.']

    expect(uiReducer(fremd, { type: 'clearNotice', onlyIf: nur }).notice).toEqual(fremd.notice)
    expect(uiReducer(eigen, { type: 'clearNotice', onlyIf: nur }).notice).toBeNull()
    expect(uiReducer(INITIAL_UI, { type: 'clearNotice', onlyIf: nur }).notice).toBeNull()
  })
})

describe('R-GAME-05 Einstellungen ueberleben den Neustart', () => {
  /** Ein Speicher, wie ihn der Browser bietet — ohne Browser. */
  const store = () => {
    const eintraege = new Map<string, string>()
    return {
      getItem: (key: string) => eintraege.get(key) ?? null,
      setItem: (key: string, value: string) => void eintraege.set(key, value),
    }
  }

  it('liest zurueck, was gespeichert wurde', () => {
    // T-M14-08, schliesst T-M10-09: parseSettings hatte seit M10 keinen Aufrufer, und die
    // Zusage 'Einstellungen ueberleben den Neustart' stand trotzdem als erledigt im Plan.
    // Sie war nicht einloesbar — es gab keinen dauerhaften Speicher.
    const s = store()
    saveSettings({ ...DEFAULT_SETTINGS, sound: false, fontScale: 'large', maxSpeed: 42 }, s)

    const zurueck = loadSettings(s)
    expect(zurueck.sound).toBe(false)
    expect(zurueck.fontScale).toBe('large')
    expect(zurueck.maxSpeed).toBe(42)
  })

  it('faellt auf die Vorgaben zurueck, wenn nichts gespeichert ist', () => {
    expect(loadSettings(store())).toEqual(DEFAULT_SETTINGS)
  })

  it('laesst sich von einem kaputten Eintrag nicht aufhalten', () => {
    // Eine Einstellung darf den Start des Spiels nicht verhindern.
    const s = store()
    s.setItem(SETTINGS_STORAGE_KEY, '{kein json')
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS)
  })

  it('bringt unsinnige Werte in den erlaubten Bereich', () => {
    const s = store()
    s.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ maxSpeed: 9999, fontScale: 'banane', autosaveMinutes: -3 }))
    const zurueck = loadSettings(s)
    expect(zurueck.maxSpeed).toBeLessThanOrEqual(100)
    expect(zurueck.fontScale).toBe(DEFAULT_SETTINGS.fontScale)
    expect(zurueck.autosaveMinutes).toBeGreaterThanOrEqual(1)
  })

  it('kommt ohne jeden Speicher aus', () => {
    // Privates Fenster, verweigerter Zugriff, Node: kein Grund, das Spiel zu stoeren.
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(() => saveSettings(DEFAULT_SETTINGS, undefined)).not.toThrow()
  })
})

/**
 * Der Platz, auf dem dieser Bildschirm spielt (T-M37-01, R-MP-01, D28.3).
 *
 * `defaultViewer` ist die Antwort auf „wer bin ich", die nirgends eine Kennung fest
 * verdrahtet. Sie nimmt die erste MENSCHLICHE Macht in `playerOrder` — ein ausdrueckliches
 * Feld des Zustands und keine Schluesselreihenfolge, also auf beiden Rechnern dieselbe.
 */
describe('R-MP-01/AK1 Der Platz kommt aus dem Zustand, nicht aus einer Annahme', () => {
  const stand = (order: string[], kinds: Record<string, 'human' | 'ai'>) =>
    ({
      playerOrder: order,
      players: Object.fromEntries(order.map((id) => [id, { kind: kinds[id] ?? 'ai' }])),
    }) as unknown as Parameters<typeof defaultViewer>[0]

  it('nimmt die erste menschliche Macht', () => {
    expect(defaultViewer(stand(['p1', 'p2', 'p3'], { p1: 'human', p2: 'ai', p3: 'human' }))).toBe('p1')
    // Im Spiel zu zweit ist der Gastgeber der erste Mensch — der Gast bekommt seinen
    // Platz ausdruecklich gesagt und faellt nicht auf diese Antwort zurueck.
    expect(defaultViewer(stand(['p1', 'p2'], { p1: 'human', p2: 'human' }))).toBe('p1')
  })

  it('faellt auf die erste Macht zurueck, wenn keine menschlich ist', () => {
    // Ein Zuschauerstand (nur Computergegner) darf die Oberflaeche nicht leer lassen.
    expect(defaultViewer(stand(['p4', 'p7'], { p4: 'ai', p7: 'ai' }))).toBe('p4')
  })

  it('sagt bei einem Stand ohne Maechte ehrlich nichts', () => {
    expect(defaultViewer(stand([], {}))).toBeNull()
  })

  it('legt beim Platzwechsel die Auswahl des alten Platzes ab', () => {
    // Provinz und Armee des Gastgebers gehoeren nicht dem Gast: ein Panel, das nach dem
    // Wechsel eine fremde Armee zeigt, ist die Vorstufe eines Befehls an die falsche.
    const vorher: UiState = {
      ...INITIAL_UI,
      selectedProvince: 'alpha',
      selectedArmy: 'a1',
      notice: { text: 'alt', kind: 'error' },
    }
    const nachher = uiReducer(vorher, { type: 'setViewer', id: 'p2' })

    expect(nachher.viewerId).toBe('p2')
    expect(nachher.selectedProvince).toBeNull()
    expect(nachher.selectedArmy).toBeNull()
    expect(nachher.notice).toBeNull()
  })

  it('beginnt ohne Platz — und das heisst nicht niemand', () => {
    expect(INITIAL_UI.viewerId).toBeNull()
    expect(uiReducer(INITIAL_UI, { type: 'setViewer', id: null }).viewerId).toBeNull()
  })
})

describe('R-DIP-07/AK1 Der Sprung aus einer Meldung waehlt die Macht der Diplomatie (T-M17-14, E9)', () => {
  it('focusDiplomacy oeffnet die Diplomatie mit der Macht des Angebots', () => {
    const state = uiReducer(INITIAL_UI, { type: 'focusDiplomacy', playerId: 'p2' })

    expect(state.panel).toBe('diplomacy')
    expect(state.diplomacyPartner).toBe('p2')

    // Ein Sprung ohne bekannte Macht (playerId: null) loescht eine vorher gewaehlte nicht.
    const zuvor = after(INITIAL_UI, { type: 'focusDiplomacy', playerId: 'p3' })
    const danach = uiReducer(zuvor, { type: 'focusDiplomacy', playerId: null })
    expect(danach.panel).toBe('diplomacy')
    expect(danach.diplomacyPartner).toBe('p3')
  })

  it('chooseDiplomacyPartner waehlt, ohne das Panel zu wechseln', () => {
    const zuvor: UiState = { ...INITIAL_UI, panel: 'province' }
    const state = uiReducer(zuvor, { type: 'chooseDiplomacyPartner', playerId: 'p2' })

    expect(state.diplomacyPartner).toBe('p2')
    expect(state.panel).toBe('province')
  })
})
