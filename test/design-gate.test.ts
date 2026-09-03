import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS, TOKENS, relativeLuminance } from '../apps/desktop/src/ui/tokens.ts'
import { ROOT } from './guards/scan.ts'

/**
 * The design gate (R-UI-01, T-M10-01).
 *
 * The requirement exists because of one lesson from another project: a dark interface
 * on a dark ground ended a finished playtest after a minute, and nobody had looked at
 * it before it was built. So the rule is that a mockup is shown and approved first.
 *
 * A rule about a process is easy to write and easy to forget, which is why this checks
 * three things that can actually be seen from the outside: the proposal exists and is
 * complete, the approval is recorded with a date, and what was built is the direction
 * that was approved — not a different one that arrived later.
 */

const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8')

const mockup = read('docs/design/ui-mockup.html')
const proposal = read('docs/design/tokens.md')
const decisions = read('docs/plan/DECISIONS.md')

const camel = (name: string): string => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())

/** The colour tokens the proposal put up for approval, from its table. */
function proposedTokens(): string[] {
  const table = proposal.slice(proposal.indexOf('## Farben'))
  return [...table.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((match) => camel(match[1]!))
}

describe('R-UI-01 Vor dem UI-Bau lag ein Mockup zur Freigabe vor', () => {
  it('legt mehr als eine Richtung vor, damit die Freigabe eine Wahl war', () => {
    const directions = [...mockup.matchAll(/<h2>([A-C]) · ([^<]+)<\/h2>/g)]
    expect(directions.length).toBeGreaterThanOrEqual(2)
  })

  it('zeigt die vier geforderten Teile', () => {
    // Farb-/Typo-Tokens, Kartenansicht, Provinzpanel, Leiste — die Aufzaehlung der
    // Anforderung, eins zu eins.
    for (const part of ['Karte', 'Provinz', 'Leiste']) {
      expect(mockup, `Das Mockup zeigt keine ${part}`).toMatch(new RegExp(part, 'i'))
    }
    expect(proposal).toMatch(/## Farben/)
    expect(proposal).toMatch(/## Schrift/)
  })

  it('haelt die Freigabe mit Datum und Richtung fest', () => {
    const record = /## (\d{4}-\d{2}-\d{2}) · T-M10-01 · Noah hat Richtung A .Lagekarte. freigegeben/.exec(decisions)
    expect(record, 'Keine Freigabe-Entscheidung in DECISIONS.md').not.toBeNull()
    expect(record![1]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('baut die Oberflaeche aus den freigegebenen Tokens', () => {
    const proposed = proposedTokens()
    expect(proposed.length).toBeGreaterThan(5)

    const implemented = Object.keys(TOKENS)
    for (const token of proposed) {
      expect(implemented, `Token "${token}" wurde freigegeben, existiert aber nicht`).toContain(token)
    }
  })

  it('baut die freigegebene Richtung, nicht eine andere', () => {
    // Richtung A ist die helle Lagekarte; B war die Nachtlage. Ein dunkler Grund waere
    // also nicht eine Geschmacksfrage, sondern eine andere als die freigegebene
    // Richtung — und genau das ist der Fehler, den dieses Tor verhindern soll.
    expect(relativeLuminance(TOKENS.ground)).toBeGreaterThan(0.5)
    expect(relativeLuminance(TOKENS.paper)).toBeGreaterThan(0.5)
    expect(relativeLuminance(TOKENS.ink)).toBeLessThan(0.1)

    // Und die Signalfarbe bleibt eine: kein Spielerfarbton darf so kraeftig sein wie
    // der Akzent, sonst schreit die halbe Karte.
    for (const [name, color] of Object.entries(PLAYER_COLORS)) {
      expect(relativeLuminance(color), `Spielerfarbe ${name} ist zu dunkel fuer Kartenschrift`).toBeGreaterThan(
        relativeLuminance(TOKENS.accent),
      )
    }
  })
})
