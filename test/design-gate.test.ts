import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS, TOKENS, TYPE, relativeLuminance } from '../apps/desktop/src/ui/tokens.ts'
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

  it('haelt auch die zweite Freigabe fest: Kriegsrat vom 2026-09-10', () => {
    // Die Lagekarte wurde am 2026-09-10 durch den Kriegsrat ersetzt (KRIEGSRAT.md D27.1).
    // Auch das ist eine Wahl aus mehreren Richtungen und steht als Entscheid da.
    expect(decisions).toMatch(/## 2026-09-10 · KRIEGSRAT · Richtung A .Kriegsrat. ersetzt .Lagekarte./)
  })

  it('baut die freigegebene Richtung, nicht eine andere', () => {
    // Seit dem 2026-09-10 ist die freigegebene Richtung der dunkle Kartentisch
    // (Kriegsrat, T-M29-01): ein heller Grund waere jetzt nicht eine Geschmacksfrage,
    // sondern die abgeloeste Richtung — und genau das ist der Fehler, den dieses Tor
    // verhindern soll. Das Gegenteil des alten Tors, aus demselben Grund.
    expect(relativeLuminance(TOKENS.ground)).toBeLessThan(0.05)
    expect(relativeLuminance(TOKENS.paper)).toBeLessThan(0.05)
    expect(relativeLuminance(TOKENS.ink)).toBeGreaterThan(0.6)

    // Und die Signalfarbe bleibt eine: kein Spielerfarbton darf so kraeftig sein wie
    // der Akzent, sonst schreit die halbe Karte. Auf dem dunklen Tisch heisst das:
    // jede Flaeche bleibt unter der Leuchtkraft des Zinnobers.
    for (const [name, color] of Object.entries(PLAYER_COLORS)) {
      expect(relativeLuminance(color), `Spielerfarbe ${name} ist so hell wie der Alarm`).toBeLessThan(
        relativeLuminance(TOKENS.accent),
      )
    }
  })

  it('zeigt das Mockup dieselben Schriften, die das Spiel verlangt', () => {
    // Bis zum 2026-09-06 verglich dieses Tor nur Farben — und genau daneben lag der
    // groesste Unterschied zwischen Bild und Erzeugnis: das Mockup laedt IBM Plex,
    // das Spiel hatte keine Schriftdatei und fiel auf system-ui zurueck. Richtung A
    // lebt von der schmalen Kartenschrift; eine Freigabe auf ein Bild, das anders
    // gesetzt ist als das Spiel, ist keine Freigabe auf das Spiel.
    const families = (text: string): Set<string> =>
      new Set(
        [...text.matchAll(/["']?(IBM Plex[A-Za-z ]*)["']?/g)]
          .map((match) => match[1]!.trim())
          .filter((name) => name.length > 'IBM Plex'.length),
      )

    const wanted = families([TYPE.map, TYPE.ui, TYPE.num].join(','))
    const shown = families(mockup)

    expect(wanted.size, 'TYPE verlangt keine benannte Schriftfamilie').toBeGreaterThan(0)
    for (const family of wanted) {
      expect([...shown], `Das Mockup zeigt "${family}" nicht`).toContain(family)
    }
  })
})
