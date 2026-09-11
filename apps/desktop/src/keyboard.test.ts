// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isInteractiveTarget, resolveKey, type KeyContext } from './keyboard.ts'

/**
 * Playing without a mouse (T-M10-12, R-UI-06).
 *
 * "Every action reachable by keyboard" is a claim that is normally checked by someone
 * pressing keys and hoping. As one pure function it is a test — including the two
 * cases that are always forgotten: that letters belong to a text field while the
 * player is typing in it, and that Escape works even then.
 */

const context = (over: Partial<KeyContext> = {}): KeyContext => ({
  speed: 10,
  mode: 'political',
  typing: false,
  dialogOpen: false,
  ...over,
})

describe('R-UI-06 Tastaturkuerzel', () => {
  it('haelt mit der Leertaste an', () => {
    expect(resolveKey({ key: ' ' }, context())).toEqual({ type: 'togglePause' })
  })

  it('geht mit Plus und Minus die Rastpunkte entlang', () => {
    expect(resolveKey({ key: '+' }, context({ speed: 10 }))).toEqual({ type: 'speed', hoursPerSecond: 25 })
    expect(resolveKey({ key: '-' }, context({ speed: 10 }))).toEqual({ type: 'speed', hoursPerSecond: 5 })
  })

  it('bleibt an den Enden der Rastpunkte stehen', () => {
    expect(resolveKey({ key: '+' }, context({ speed: 100 }))).toEqual({ type: 'speed', hoursPerSecond: 100 })
    expect(resolveKey({ key: '-' }, context({ speed: 0 }))).toEqual({ type: 'speed', hoursPerSecond: 0 })
  })

  it('spult mit F vor', () => {
    expect(resolveKey({ key: 'f' }, context())).toEqual({ type: 'fastForward' })
    expect(resolveKey({ key: 'F' }, context())).toEqual({ type: 'fastForward' })
  })

  it('speichert und laedt mit Strg', () => {
    expect(resolveKey({ key: 's', ctrlKey: true }, context())).toEqual({ type: 'save' })
    expect(resolveKey({ key: 'l', ctrlKey: true }, context())).toEqual({ type: 'load' })
    // Same on a Mac keyboard.
    expect(resolveKey({ key: 's', metaKey: true }, context())).toEqual({ type: 'save' })
  })

  it('wechselt mit M reihum die Kartenmodi', () => {
    expect(resolveKey({ key: 'm' }, context({ mode: 'political' }))).toEqual({
      type: 'cycleMode',
      mode: 'resources',
    })
    // Der fuenfte Modus haengt am Ende des Zyklus (T-M26-03) …
    expect(resolveKey({ key: 'm' }, context({ mode: 'strength' }))).toEqual({
      type: 'cycleMode',
      mode: 'relations',
    })
    // … and wraps around at the end rather than stopping.
    expect(resolveKey({ key: 'm' }, context({ mode: 'relations' }))).toEqual({
      type: 'cycleMode',
      mode: 'political',
    })
  })

  it('bewegt die Karte mit den Pfeiltasten', () => {
    expect(resolveKey({ key: 'ArrowLeft' }, context())).toEqual({ type: 'pan', dx: -1, dy: 0 })
    expect(resolveKey({ key: 'ArrowDown' }, context())).toEqual({ type: 'pan', dx: 0, dy: 1 })
  })

  it('zeigt mit F1 die Uebersicht', () => {
    expect(resolveKey({ key: 'F1' }, context())).toEqual({ type: 'help' })
  })

  it('zoomt mit Bild-auf/-ab und zentriert mit Pos1 die Hauptstadt (T-M30-03)', () => {
    // Plus und Minus gehoeren seit T-M10-06 dem Tempo; der Zoom nimmt die Bildtasten.
    expect(resolveKey({ key: 'PageUp' }, context())).toEqual({ type: 'zoom', direction: 1 })
    expect(resolveKey({ key: 'PageDown' }, context())).toEqual({ type: 'zoom', direction: -1 })
    expect(resolveKey({ key: 'Home' }, context())).toEqual({ type: 'centreCapital' })
  })
})

describe('R-UI-06 Was Tastenkuerzel nicht duerfen', () => {
  it('laesst Buchstaben im Eingabefeld in Ruhe', () => {
    // Otherwise the seed field becomes unusable the moment someone types an "f".
    expect(resolveKey({ key: 'f' }, context({ typing: true }))).toBeNull()
    expect(resolveKey({ key: ' ' }, context({ typing: true }))).toBeNull()
    expect(resolveKey({ key: 'm' }, context({ typing: true }))).toBeNull()
  })

  it('laesst Escape auch im Eingabefeld durch', () => {
    // Escape is how you get out. It has to work from everywhere, including a field.
    expect(resolveKey({ key: 'Escape' }, context({ typing: true }))).toEqual({ type: 'close' })
  })

  it('steuert das Spiel nicht, waehrend ein Dialog offen ist', () => {
    expect(resolveKey({ key: ' ' }, context({ dialogOpen: true }))).toBeNull()
    expect(resolveKey({ key: 'ArrowLeft' }, context({ dialogOpen: true }))).toBeNull()
    // Saving still works — that is what the dialogue is for.
    expect(resolveKey({ key: 's', ctrlKey: true }, context({ dialogOpen: true }))).toEqual({ type: 'save' })
  })

  it('ignoriert unbelegte Tasten', () => {
    expect(resolveKey({ key: 'q' }, context())).toBeNull()
    expect(resolveKey({ key: 'Tab' }, context())).toBeNull()
  })

  it('faengt keine Strg-Kombination ab, die es nicht kennt', () => {
    // Ctrl+C has to keep working — copying out an error message is a normal thing.
    expect(resolveKey({ key: 'c', ctrlKey: true }, context())).toBeNull()
  })
})

describe('R-UI-06 Diplomatie und Markt per Taste', () => {
  it('oeffnet Diplomatie mit D und den Markt mit H', () => {
    expect(resolveKey({ key: 'd' }, context())).toEqual({ type: 'openPanel', panel: 'diplomacy' })
    expect(resolveKey({ key: 'H' }, context())).toEqual({ type: 'openPanel', panel: 'market' })
  })

  it('laesst die Buchstaben in einem Textfeld in Ruhe', () => {
    expect(resolveKey({ key: 'd' }, context({ typing: true }))).toBeNull()
    expect(resolveKey({ key: 'h' }, context({ dialogOpen: true }))).toBeNull()
  })
})

/**
 * T-M28-09 · Die Leertaste gehört dem Knopf, auf dem der Fokus liegt.
 *
 * Befund 8 der Durchsicht vom 2026-09-11: `isTypingTarget` kannte nur Textfelder. Wer
 * ohne Maus bedient, tabbt aber auf **Knöpfe** — und der Browser löst sie mit der
 * Leertaste aus. Das Spiel fing sie vorher ab und pausierte stattdessen, wodurch kein
 * einziger Knopf mit der Leertaste zu betätigen war.
 */
describe('T-M28-09 Die Leertaste auf einem Bedienelement', () => {
  const element = (html: string): HTMLElement => {
    const host = document.createElement('div')
    host.innerHTML = html
    return host.firstElementChild as HTMLElement
  }

  it('erkennt einen Knopf als Bedienelement', () => {
    expect(isInteractiveTarget(element('<button>Rangliste</button>'))).toBe(true)
  })

  it('erkennt auch Verweise und alles mit der Rolle eines Knopfes', () => {
    expect(isInteractiveTarget(element('<a href="#x">hin</a>'))).toBe(true)
    expect(isInteractiveTarget(element('<div role="button">Übersichtskarte</div>'))).toBe(true)
  })

  it('laesst die Karte und den Rumpf in Ruhe — dort gehoert die Taste dem Spiel', () => {
    expect(isInteractiveTarget(element('<canvas></canvas>'))).toBe(false)
    expect(isInteractiveTarget(element('<div>nur Text</div>'))).toBe(false)
  })

  it('schluckt die Leertaste nicht mehr, wenn der Fokus auf einem Knopf liegt', () => {
    const auf = { key: ' ', target: element('<button>Vorspulen</button>') } as unknown as KeyboardEvent
    expect(resolveKey(auf, context())).toBeNull()
  })

  it('pausiert weiterhin, wenn der Fokus nirgends besonders liegt', () => {
    const auf = { key: ' ', target: element('<canvas></canvas>') } as unknown as KeyboardEvent
    expect(resolveKey(auf, context())).toEqual({ type: 'togglePause' })
  })
})
