import { describe, expect, it } from 'vitest'
import {
  CONTRAST_PAIRS,
  PLAYER_COLORS,
  RELATION_COLORS,
  TOKENS,
  contrastRatio,
  deltaE,
  relativeLuminance,
} from './tokens'

/**
 * R-UI-02 as a test rather than a promise.
 *
 * The lesson this exists for is concrete: in the Rotation project a finished playtest
 * was abandoned after one minute because the interface was blue on dark blue. Nobody
 * had decided to make it unreadable — the colours drifted there one commit at a time.
 * This test is what stops that drift.
 */

const AA_TEXT = 4.5
const AA_LARGE = 3

describe('R-UI-02 Kontrast', () => {
  it('rechnet bekannte Verhaeltnisse richtig aus', () => {
    // Anchors from the WCAG definition itself: white on black is 21:1, a colour on
    // itself is 1:1. Without these the whole suite could be uniformly wrong.
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrastRatio('#B3341E', '#B3341E')).toBeCloseTo(1, 9)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 9)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 9)
  })

  it('ist unabhaengig von der Reihenfolge der Farben', () => {
    expect(contrastRatio(TOKENS.ink, TOKENS.paper)).toBeCloseTo(
      contrastRatio(TOKENS.paper, TOKENS.ink),
      9,
    )
  })

  it('haelt jedes benannte Paar ueber der Schwelle', () => {
    for (const pair of CONTRAST_PAIRS) {
      const ratio = contrastRatio(TOKENS[pair.foreground], TOKENS[pair.background])
      const threshold = pair.large ? AA_LARGE : AA_TEXT
      expect(
        ratio,
        `${pair.foreground} auf ${pair.background} (${pair.use}): ${ratio.toFixed(2)}:1, ` +
          `gefordert ${threshold}:1`,
      ).toBeGreaterThanOrEqual(threshold)
    }
  })

  it('prueft jede Textfarbe gegen jeden Grund, auf dem sie vorkommt', () => {
    // A pair list is only worth as much as its completeness, so the text colours are
    // checked against every surface exhaustively rather than by hand-picked samples.
    const surfaces = ['ground', 'paper', 'paperSunk'] as const
    const texts = ['ink', 'inkSoft'] as const

    for (const surface of surfaces) {
      for (const text of texts) {
        expect(
          contrastRatio(TOKENS[text], TOKENS[surface]),
          `${text} auf ${surface}`,
        ).toBeGreaterThanOrEqual(AA_TEXT)
      }
    }
  })

  it('laesst jede Spielerfarbe als Flaeche unter Kartenschrift lesbar sein', () => {
    // Player colours fill provinces and the province name sits on top of them.
    for (const [name, color] of Object.entries(PLAYER_COLORS)) {
      expect(contrastRatio(TOKENS.onPlayer, color), `Kartenschrift auf ${name}`).toBeGreaterThanOrEqual(
        AA_TEXT,
      )
    }
  })

  it('unterscheidet die Spielerfarben auch voneinander', () => {
    // Two nations that look alike on the map are worse than one that looks wrong.
    // The instrument matters: contrast ratio only knows lightness, so a blue-grey and
    // a red-brown of the same brightness read as identical to it while a person sees
    // two plainly different countries. Perceived difference is the right measure.
    //
    // The threshold is 10 rather than the just-noticeable 2.3: two provinces need to
    // be different at a glance across the map, not distinguishable when held side by
    // side. This test already sent one colour back - a grey and a blue-grey that came
    // out 5.7 apart.
    const colors = Object.entries(PLAYER_COLORS)
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const [nameA, a] = colors[i]!
        const [nameB, b] = colors[j]!
        expect(deltaE(a, b), `${nameA} gegen ${nameB} zu aehnlich`).toBeGreaterThan(10)
      }
    }
  })

  it('unterscheidet die fuenf Beziehungsfarben voneinander (T-M26-03)', () => {
    // Dieselbe Schwelle wie bei den Spielerfarben: der Beziehungsmodus faerbt die
    // ganze Welt aus genau diesen fuenf, und zwei aehnliche Zustaende auf einer Karte
    // sind schlimmer als einer, der falsch aussieht.
    const colors = Object.entries(RELATION_COLORS)
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const [nameA, a] = colors[i]!
        const [nameB, b] = colors[j]!
        expect(deltaE(a, b), `${nameA} gegen ${nameB} zu aehnlich`).toBeGreaterThan(10)
      }
    }
  })

  it('haelt Kartenschrift auf jeder Beziehungsfarbe lesbar (T-M26-03)', () => {
    // Die Provinznamen sitzen im Beziehungsmodus auf genau diesen Fuellungen.
    for (const [name, color] of Object.entries(RELATION_COLORS)) {
      expect(contrastRatio(TOKENS.onPlayer, color), `Kartenschrift auf ${name}`).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it('weist unsinnige Farbwerte zurueck, statt still 0 zu rechnen', () => {
    expect(() => relativeLuminance('rot')).toThrow(/rot/)
    expect(() => relativeLuminance('#12345')).toThrow()
  })
})

/**
 * Nicht-Text: die Anzeigen aus M13 (R-UI-02, WCAG 1.4.11).
 *
 * Ein Balken traegt keine Schrift, aber er traegt Bedeutung — und die Schwelle dafuer
 * ist 3:1 gegen das, wovon er sich abheben muss. Die Fuellung gegen ihre Spur, damit
 * man den Anteil sieht, und die Spur gegen das Panel, damit man den leeren Balken
 * ueberhaupt findet: bei 1,27:1 waere ein Balken bei null schlicht unsichtbar, und
 * genau deshalb bekommt die Spur ihren Umriss aus `line`.
 */
describe('R-UI-02 Anzeigen ohne Schrift', () => {
  const NON_TEXT = 3

  it('hebt jede Balkenfuellung von ihrer Spur ab', () => {
    for (const tone of ['good', 'warn', 'accent', 'inkSoft'] as const) {
      expect(contrastRatio(TOKENS[tone], TOKENS.paperSunk), `${tone} auf der Balkenspur`).toBeGreaterThanOrEqual(
        NON_TEXT,
      )
    }
  })

  it('macht die leere Spur auf dem Panel auffindbar', () => {
    // Die Flaeche allein reicht nicht (1,27:1) — der Umriss traegt den Unterschied.
    expect(contrastRatio(TOKENS.line, TOKENS.paper)).toBeGreaterThanOrEqual(NON_TEXT)
  })
})
