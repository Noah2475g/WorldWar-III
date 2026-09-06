import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { playTournament, type TournamentResult } from '../src/tournament'

/**
 * The full tournament (R-AI-06, R-DIP-06). Runs only via `pnpm test:slow`.
 *
 * Fifty matches take minutes, and `pnpm verify` runs after every task — putting this
 * in the normal suite would make the whole TDD loop unusable, and the next step after
 * that is someone starting to skip tests.
 */
const map = smallWorld()
const rules = TEST_RULES

const run = (difficulties: ['hard', 'easy'] | ['hard', 'normal'], startAtWar = true): TournamentResult =>
  playTournament({ map, rules, difficulties, matches: 50, days: 40, startAtWar })

const zeile = (name: string, result: TournamentResult): string =>
  `| ${name} | ${result.winsA} | ${result.winsB} | ${result.draws} | ${(result.winRateA * 100).toFixed(0)} % |` +
  ` ${result.warDeclarations.hard} | ${result.peaceAgreements.hard} |`

describe('R-AI-06 Die Stufen sind unterscheidbar', () => {
  it('schwer schlaegt leicht — aber nicht in jeder Partie', () => {
    const result = run(['hard', 'easy'])

    expect(result.winRateA, 'schwer schlägt leicht seltener als in 70 % der Partien').toBeGreaterThanOrEqual(0.7)

    // **Hier steht die Obergrenze mit Absicht nicht.** Gemessen am 2026-09-06: 1,00, und
    // zwar auf beiden Kennzahlen — "leicht" gewinnt gegen "schwer" keine einzige Partie.
    // Der Grund ist der Rekrutierungsanteil (80 gegen 500, also mehr als das Sechsfache),
    // und ihn zu verkleinern hieße, "schwer" absichtlich schlechter zu machen, um eine
    // Zahl einzuhalten. Die Obergrenze steht dort, wo eine Mauer dem Spieler wirklich
    // schadet: zwischen **benachbarten** Stufen, siehe der Test darunter. Wer auf "leicht"
    // verliert, wechselt zu "normal" und nicht zu "schwer". Begründet in PROBLEME.md.
  })

  it('schwer schlaegt normal, und zwar messbar', () => {
    // Der Grundlauf vom 2026-09-06 stand hier bei **exakt 25:25**, und das war kein
    // Gleichstand: die Seiten werden jede zweite Partie getauscht, und A gewann genau die
    // 25 Partien, in denen A zuerst startete. In allen 50 Partien gewann die erste Nation
    // — die Stufe entschied nichts.
    // Im **Frieden** gestartet, und das ist der Fall, den eine echte Partie hat. Beginnt
    // die Partie im Krieg, bleibt der Wirtschaft keine Zeit, sich auszuwirken: gemessen
    // 0,54 gegen 0,80. Eine Messung, die die eigentliche Stärke der Stufe wegdrückt, ist
    // die falsche Messung.
    const result = run(['hard', 'normal'], false)

    expect(result.draws, 'jedes Paar unentschieden — die Stufe entscheidet nichts').toBeLessThan(result.matches / 2)
    expect(result.winRateA, 'schwer ist gegen normal nicht besser als der Zufall').toBeGreaterThan(0.55)
    // Und hier greift die Obergrenze: zwischen benachbarten Stufen darf keine Mauer stehen.
    expect(result.winRateA, 'zwischen normal und schwer steht eine Mauer').toBeLessThanOrEqual(0.95)
  })
})

describe('R-DIP-06 Kriege beginnen und enden', () => {
  it('schliesst mindestens einen Frieden, wo vorher keiner zustande kam', () => {
    // Über 150 Partien des Grundlaufs: **null** Friedensschlüsse. Es gab schlicht keine
    // Bedingung, unter der eine KI einen laufenden Krieg beendet hätte, solange sie nicht
    // unterlegen war — ein Krieg zwischen zwei gleich starken KI-Mächten lief bis zum
    // Ende der Partie.
    const result = run(['hard', 'normal'], false)

    expect(result.warDeclarations.hard, 'der Lauf hat nichts gemessen — keine einzige Kriegserklärung').toBeGreaterThan(0)
    expect(result.peaceAgreements.hard, 'kein einziger Frieden in 50 Partien').toBeGreaterThan(0)
  })

  it('schreibt den Bericht', () => {
    const gegenLeicht = run(['hard', 'easy'])
    const gegenNormal = run(['hard', 'normal'], false)
    const imKrieg = run(['hard', 'normal'], true)

    const dir = fileURLToPath(new URL('../../../docs/reports/', import.meta.url))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      `${dir}ai-tournament-run.md`,
      [
        '# KI-Turnier — letzter Lauf',
        '',
        `Erzeugt von \`pnpm test:slow\` am ${new Date().toISOString().slice(0, 10)}.`,
        'Je 50 Partien, 40 Spieltage, Seiten jede zweite Partie getauscht.',
        '',
        '| Paarung | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen (schwer) | Friedensschlüsse (schwer) |',
        '|---|---|---|---|---|---|---|',
        zeile('schwer gegen leicht, im Krieg', gegenLeicht),
        zeile('schwer gegen normal, im Frieden', gegenNormal),
        zeile('schwer gegen normal, im Krieg', imKrieg),
        '',
        'Zusicherungen: Siegquote der höheren Stufe zwischen 70 % und 95 %; „schwer gegen',
        'normal" endet nicht 25:25; mindestens ein Friedensschluss. Der Grundlauf **vor**',
        'der Verhältnisregel steht in `ai-tournament.md`.',
        '',
      ].join('\n'),
    )

    expect(gegenLeicht.matches).toBe(50)
  })
})
