import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { createInitialState, publicView, step, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { advanceOnce, currentStep, TUTORIAL_START, advance, type TutorialState } from './tutorial.ts'
import { firstUnitAt } from './opening.ts'
import { alertsFor, type UnlockRules } from '../ui/Alerts.tsx'

/**
 * Der Durchgang durch die ersten sechzehn Spieltage, gemessen (T-M21-05).
 *
 * Nicht behauptet: eine Führung, von der man sagt, sie führe, ist keine Messung. Hier
 * läuft eine echte Partie, ein gedachter Spieler tut in der ersten Stunde, was die ersten
 * drei Schritte von ihm verlangen, und danach wird gezählt — **wann kam welcher Schritt,
 * und wie lange war der Spieler ohne Aufgabe.**
 *
 * Die längste Pause ist die Zahl, die zählt. Sie ist die Stelle, an der jemand aufhört.
 *
 * Langsam, weil es sechzehn Spieltage sind, und weil der Bericht dabei geschrieben wird.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const TAGE = 16
const perDay = TEST_RULES.constants.ticksPerDay
const TICKS = TAGE * perDay

const ctx = { map: smallWorld(), rules: TEST_RULES }
const config: GameConfig = {
  seed: 1914,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Noah', kind: 'human', nation: 'Nordland', color: 'darkslategray' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: 'rebeccapurple', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const unlockRules: UnlockRules = {
  constants: { ticksPerDay: perDay },
  buildings: TEST_RULES.buildings,
  units: TEST_RULES.units,
}

interface Ereignis {
  tick: number
  art: 'Schritt' | 'Meldung' | 'Fertig'
  was: string
}

/**
 * Ein Durchgang, wie ihn ein neuer Spieler erlebt.
 *
 * Der gedachte Spieler ist absichtlich **fleißig**: er klickt sofort, baut, sobald er
 * kann, und hebt aus, sobald es geht. Was er dann noch an Leerlauf erlebt, ist der
 * Leerlauf, den das Spiel *erzwingt* — und nur der ist eine Aussage über die Eröffnung.
 */
function durchgang(): { ereignisse: Ereignis[]; ende: TutorialState } {
  let state: GameState = createInitialState(config, ctx)
  // Die ersten vier Schritte hängen an Klicks (seit T-M24-02 gehört der Blick auf die
  // Lage der Mächte dazu); ein Spieler macht sie in der ersten Minute.
  let tutorial: TutorialState = ['selectProvince', 'openBuild', 'setSpeed', 'openStandings'].reduce(
    (current, klick) => advance(current, klick as never),
    TUTORIAL_START,
  )
  const ereignisse: Ereignis[] = [
    { tick: 0, art: 'Schritt', was: 'select, build, speed, score (vier Klicks)' },
  ]

  const eigene = (s: GameState): string[] =>
    s.provinceOrder.filter((id) => s.provinces[id]?.owner === 'p1')
  let gebaut = false
  let ausgehoben = false

  for (let tick = 0; tick < TICKS; tick++) {
    const commands: Command[] = []
    const heimat = eigene(state)[0]

    // Bauen, sobald es geht — und ausheben, sobald die Kaserne steht.
    if (heimat && !gebaut) {
      commands.push({ type: 'BUILD', playerId: 'p1', provinceId: heimat, building: 'barracks' } as Command)
      gebaut = true
    } else if (heimat && !ausgehoben && (state.provinces[heimat]?.buildings['barracks'] ?? 0) > 0) {
      commands.push({
        type: 'RECRUIT',
        playerId: 'p1',
        provinceId: heimat,
        unitKey: 'infantry',
        count: 1,
      } as Command)
      ausgehoben = true
    }

    const result = step(state, commands, ctx)
    state = result.state

    // Was die Alarmleiste in diesem Tick zeigt — daraus entsteht die Freischaltungsmeldung.
    for (const alert of alertsFor(publicView(state, 'p1', TEST_RULES), unlockRules)) {
      if (alert.kind !== 'unlock') continue
      if (ereignisse.some((e) => e.art === 'Meldung' && e.was === alert.text)) continue
      ereignisse.push({ tick: state.tick, art: 'Meldung', was: alert.text })
    }
    for (const event of result.events) {
      if (event.type === 'BUILD_COMPLETED' || event.type === 'UNIT_RECRUITED') {
        ereignisse.push({ tick: state.tick, art: 'Fertig', was: event.type })
      }
    }

    // Und die Führung, genau wie in der App: höchstens ein Schritt je Bild.
    let rest = result.events.map((event) => event.type)
    for (;;) {
      const vorher = currentStep(tutorial)?.id
      const { state: next, consumed } = advanceOnce(tutorial, rest)
      rest = rest.slice(consumed)
      if (next === tutorial) break
      tutorial = next
      ereignisse.push({ tick: state.tick, art: 'Schritt', was: `${vorher} beendet` })
    }
  }
  return { ereignisse, ende: tutorial }
}

/** Die längste Strecke ohne irgendein Ereignis, in Ticks. */
function laengstePause(ereignisse: readonly Ereignis[]): { ticks: number; von: number; bis: number } {
  let best = { ticks: 0, von: 0, bis: 0 }
  let letzter = 0
  for (const e of ereignisse) {
    if (e.tick - letzter > best.ticks) best = { ticks: e.tick - letzter, von: letzter, bis: e.tick }
    letzter = e.tick
  }
  // Die Strecke nach dem letzten Ereignis bis zum Ende des Laufs zählt mit.
  if (TICKS - letzter > best.ticks) best = { ticks: TICKS - letzter, von: letzter, bis: TICKS }
  return best
}

const alsZeit = (tick: number): string =>
  `Tag ${Math.floor(tick / perDay) + 1}, ${String(tick % perDay).padStart(2, '0')}:00`

describe('R-UI-05 Der Durchgang durch die ersten sechzehn Spieltage', () => {
  const { ereignisse, ende } = durchgang()
  const pause = laengstePause(ereignisse)

  it('fuehrt den Spieler bis ans Ende der Fuehrung', () => {
    // Führen heißt ankommen. Bliebe die Führung auf einem Schritt stehen, wäre sie eine
    // Falle statt einer Hilfe — genau das war sie vor T-M21-02 nicht, weil sie nach fünf
    // Klicks fertig war, bevor überhaupt etwas geschehen konnte.
    const offen = currentStep(ende)
    expect(offen?.id ?? 'fertig', `haengt auf "${offen?.id}"`).not.toBe('dayPassed')
    expect(ereignisse.filter((e) => e.art === 'Schritt').length).toBeGreaterThanOrEqual(4)
  })

  it('haelt die laengste Pause fest, damit sie nicht unbemerkt waechst', () => {
    /*
     * Die Zahl, die zählt — und **eine Messung, keine Zusage.**
     *
     * Gemessen am 2026-09-07: 72 Ticks, drei volle Spieltage zwischen der Eisenbahn an
     * Tag 5 und der Fabrik an Tag 8. Ob das zu lang ist, ist eine Balancing-Frage und
     * gehört Noah; ob es *länger wird*, ist eine Frage, die eine Maschine beantworten
     * kann, und deshalb steht sie hier.
     *
     * Die Schranke ist der heutige Wert, nicht ein gewünschter. Eine Grenze, die das
     * Spiel heute reißt, wäre entweder eine stillschweigende Aufforderung, den Test
     * weicher zu machen, oder eine Anforderung, die niemand gestellt hat.
     */
    expect(
      pause.ticks,
      `laengste Pause ${pause.ticks} Ticks: ${alsZeit(pause.von)} bis ${alsZeit(pause.bis)}`,
    ).toBeLessThanOrEqual(72)
  })

  it('laesst die ersten beiden Spieltage nicht leer', () => {
    // Die Eröffnung selbst — dort steigt ein neuer Spieler aus, und dort wirkt der
    // Wartschritt aus T-M21-03. Was danach kommt, hat der Spieler schon investiert.
    const frueh = ereignisse.filter((e) => e.tick <= 2 * perDay)

    expect(frueh.length, 'in den ersten beiden Spieltagen geschieht nichts').toBeGreaterThanOrEqual(3)
  })

  it('schreibt den Bericht', () => {
    const zeilen = [
      '# Der Durchgang durch die ersten Spieltage',
      '',
      `Gemessen am **2026-09-07** von \`apps/desktop/src/game/onboarding.slow.test.ts\`, über`,
      `**${TAGE} Spieltage** (${TICKS} Ticks) auf der kleinen Karte, Startzahl ${config.seed}.`,
      '',
      '> Dieser Bericht gilt für genau diesen Stand. Zeigt `git log --oneline -1` etwas anderes,',
      '> ist er überholt und keine Aussage über das Projekt.',
      '',
      '## Die Zahl, die zählt',
      '',
      `| **Längste Pause ohne Anlass** | **${pause.ticks} Ticks** (${alsZeit(pause.von)} → ${alsZeit(pause.bis)}) |`,
      '|---|---|',
      `| Führungsschritte im Lauf | ${ereignisse.filter((e) => e.art === 'Schritt').length} |`,
      `| Freischaltungsmeldungen | ${ereignisse.filter((e) => e.art === 'Meldung').length} |`,
      `| Erste Einheit möglich ab | Tick ${firstUnitAt(TEST_RULES)} (${alsZeit(firstUnitAt(TEST_RULES))}) |`,
      `| Führung am Ende | ${currentStep(ende)?.id ?? 'durchgelaufen'} |`,
      '',
      'Die längste Pause ist die Stelle, an der jemand aufhört. Alles andere in diesem Bericht',
      'erklärt nur, warum sie so lang ist.',
      '',
      '## Was wann geschah',
      '',
      '| Zeit | Art | Was |',
      '|---|---|---|',
      ...ereignisse.map((e) => `| ${alsZeit(e.tick)} | ${e.art} | ${e.was} |`),
      '',
      '## Wie der Lauf gedacht ist',
      '',
      'Der gedachte Spieler ist **fleißig**: er tut in der ersten Stunde, was die drei',
      'Klickschritte von ihm verlangen, baut, sobald er kann, und hebt aus, sobald die Kaserne',
      'steht. Was danach an Leerlauf bleibt, ist der Leerlauf, den das Spiel **erzwingt** — und',
      'nur der ist eine Aussage über die Eröffnung. Ein zögerlicher Spieler erlebt mehr davon,',
      'nicht weniger.',
      '',
      'Gemessen wird auf der kleinen Karte, nicht auf der Weltkarte: die Eröffnung hängt an den',
      'Bauzeiten und am Startvorrat, nicht an der Zahl der Provinzen, und sechzehn Spieltage',
      'Weltkarte kosten das Zwanzigfache an Rechenzeit für dieselbe Aussage.',
      '',
      '## Der Befund fuer Noah',
      '',
      `**Zwischen Tag 5 und Tag 8 geschieht drei Spieltage lang nichts.** Die Eisenbahn kommt an`,
      'Tag 5, die Fabrik an Tag 8, und dazwischen meldet das Spiel nichts, was den Spieler',
      'anspräche. Die Führung ist da längst durchgelaufen.',
      '',
      'Ob das zu lang ist, ist eine **Balancing-Frage** und gehört Noah — hier steht nur die',
      'gemessene Zahl. Drei Wege wären denkbar, alle drei sind eigene Aufgaben:',
      '',
      '1. **Die Achse verdichten** — eine Freischaltung an Tag 6 oder 7. Ändert die Partie.',
      '2. **Anderes melden** — Bevölkerungswachstum, ein Lagerstand, eine Nachricht aus der',
      '   Welt. Ändert die Partie nicht, füllt aber auch nur die Meldungsleiste.',
      '3. **So lassen.** Wer bis Tag 5 gespielt hat, hat sich entschieden; die Lücke trifft',
      '   nicht mehr den Einsteiger, für den diese Aufgabe gebaut wurde.',
      '',
      'Der Test hält die Zahl als Obergrenze fest: sie darf nicht unbemerkt wachsen.',
      '',
      '## Was dieser Bericht nicht sagt',
      '',
      'Ob die Führung **verständlich** ist. Er zählt, dass etwas geschieht und wann; ob der Satz',
      'an der richtigen Stelle das Richtige sagt, findet nur ein Mensch heraus. Dafür stehen die',
      'beiden Fragen am Ende von `docs/PLAYTEST.md`.',
      '',
    ]
    writeFileSync(`${ROOT}/docs/reports/onboarding.md`, zeilen.join('\n'))

    expect(zeilen.length).toBeGreaterThan(20)
  })
})
