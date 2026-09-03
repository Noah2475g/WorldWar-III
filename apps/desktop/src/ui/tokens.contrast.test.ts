import { describe, expect, it } from 'vitest'
import {
  CONTRAST_PAIRS,
  PLAYER_COLORS,
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

  it('weist unsinnige Farbwerte zurueck, statt still 0 zu rechnen', () => {
    expect(() => relativeLuminance('rot')).toThrow(/rot/)
    expect(() => relativeLuminance('#12345')).toThrow()
  })
})
