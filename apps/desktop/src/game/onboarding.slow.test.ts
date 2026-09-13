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
  art: 'Schritt' | 'Meldung' | 'Ankündigung' | 'Fertig'
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

    // Was die Meldungsleiste in diesem Tick zeigt: Freischaltungen und, seit T-M41-03,
    // die Ankündigung zwei Spieltage vorher. Beide zählen als Anlass — die Ankündigung
    // sagt, was kommt und was dafür fehlt.
    for (const alert of alertsFor(publicView(state, 'p1', TEST_RULES), unlockRules)) {
      const art = alert.kind === 'unlock' ? 'Meldung' : alert.kind === 'upcoming' ? 'Ankündigung' : null
      if (!art) continue
      if (ereignisse.some((e) => e.art === art && e.was === alert.text)) continue
      ereignisse.push({ tick: state.tick, art, was: alert.text })
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
  for (const e of [...ereignisse].sort((a, b) => a.tick - b.tick)) {
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
  const ankuendigungen = ereignisse.filter((e) => e.art === 'Ankündigung')

  it('fuehrt den Spieler bis ans Ende der Fuehrung', () => {
    // Führen heißt ankommen. Bliebe die Führung auf einem Schritt stehen, wäre sie eine
    // Falle statt einer Hilfe — genau das war sie vor T-M21-02 nicht, weil sie nach fünf
    // Klicks fertig war, bevor überhaupt etwas geschehen konnte.
    const offen = currentStep(ende)
    expect(offen?.id ?? 'fertig', `haengt auf "${offen?.id}"`).not.toBe('dayPassed')
    expect(ereignisse.filter((e) => e.art === 'Schritt').length).toBeGreaterThanOrEqual(4)
  })

  it('kuendigt jede Freischaltung im Fenster zwei Spieltage vorher an (T-M41-03)', () => {
    // Die Zahl aus dem Lauf, nicht aus dem Einzeltest: in sechzehn Spieltagen fallen
    // vier Freischaltungen nach Tag 2 an (Hafen 6, Transportschiff 10, Festung 12,
    // motorisierte Infanterie 16), und jede muss zwei Tage vorher angekündigt sein.
    for (const meldung of ereignisse.filter((e) => e.art === 'Meldung' && e.tick >= 3 * perDay)) {
      const vorher = ankuendigungen.find((a) => a.tick === meldung.tick - 2 * perDay)
      expect(vorher, `keine Ankündigung zwei Tage vor "${meldung.was}" (${alsZeit(meldung.tick)})`).toBeTruthy()
    }
    expect(ankuendigungen.length, 'keine einzige Ankündigung im Lauf').toBeGreaterThanOrEqual(4)
  })

  it('haelt die laengste Pause fest, damit sie nicht unbemerkt waechst', () => {
    /*
     * Die Zahl, die zählt — und **eine Messung, keine Zusage.**
     *
     * Gemessen am 2026-09-07: **72 Ticks**, drei volle Spieltage zwischen der Eisenbahn
     * an Tag 5 und der Fabrik an Tag 8. Gemessen am 2026-09-12 nach M34: **96 Ticks**,
     * vier volle Spieltage zwischen dem Hafen an Tag 6 und dem Transportschiff an Tag 10.
     * Gemessen am 2026-09-13 nach T-M41-03: **48 Ticks** — zwei Spieltage, weil jede
     * Freischaltung zwei Tage vorher angekündigt wird (Tag 4, 8, 10, 14). Gerechnet war
     * dieselbe Zahl; der Lauf hat sie bestätigt.
     *
     * **Die Schranke ist der heutige Wert, nicht ein gewünschter**, und sie ist eine
     * Sperrklinke gegen *unbeabsichtigtes* Wachstum. Die Klinke wurde nach M34 einmal
     * weitergestellt, **mit genannter Ursache** (die Freischaltungsleiter reicht seither
     * bis Tag 80), und nach T-M41-03 auf den gemessenen Wert zurückgenommen. Was sie
     * weiterhin nicht duldet, ist eine Pause, die ohne solchen Grund wächst.
     *
     * **Was sie nicht misst:** ob eine Ankündigung als Anlass *empfunden* wird. Sie ist
     * leise und kann wie Kosmetik wirken (DECISIONS.md, 2026-09-13) — das bleibt eine
     * Frage an Noahs Playtest und nicht an diesen Test.
     */
    expect(
      pause.ticks,
      `laengste Pause ${pause.ticks} Ticks: ${alsZeit(pause.von)} bis ${alsZeit(pause.bis)}`,
    ).toBeLessThanOrEqual(48)
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
      `Gemessen am **2026-09-13** von \`apps/desktop/src/game/onboarding.slow.test.ts\`, über`,
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
      `| Ankündigungen (zwei Tage vorher) | ${ankuendigungen.length} |`,
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
      ...[...ereignisse].sort((a, b) => a.tick - b.tick).map((e) => `| ${alsZeit(e.tick)} | ${e.art} | ${e.was} |`),
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
      'Nach M34 lagen **zwei Pausen von vier Spieltagen** im Fenster: vom Hafen an Tag 6 bis zum',
      'Transportschiff an Tag 10 und von der Festung an Tag 12 bis zur motorisierten Infanterie an',
      'Tag 16 (96 Ticks).',
      '',
      '**Seit T-M41-03 kündigt sich jede Freischaltung zwei Spieltage vorher an**, und die',
      'Ankündigung sagt, was dafür fehlt — „In zwei Tagen: Transportschiff. Es braucht einen',
      'Hafen — Sie haben keinen." Die Freischaltungstage selbst sind unverändert (Entscheid',
      '„Ankündigung statt Datenänderung", `DECISIONS.md`, 2026-09-13, kippbar). Die längste',
      `Pause im Fenster beträgt damit **${pause.ticks} Ticks**.`,
      '',
      'Hinter dem Messfenster liegen größere Lücken zwischen den Freischaltungen (Tag 20 → 28,',
      '48 → 62, 70 → 80). Die Ankündigung wirkt dort genauso, halbiert sie aber nicht: eine Lücke',
      'von vierzehn Tagen bleibt eine Lücke von zwölf.',
      '',
      '## Was dieser Bericht nicht sagt',
      '',
      'Ob die Führung **verständlich** ist, und ob eine leise Ankündigung als Anlass empfunden',
      'wird. Er zählt, dass etwas geschieht und wann; ob der Satz an der richtigen Stelle das',
      'Richtige sagt, findet nur ein Mensch heraus. Dafür stehen die beiden Fragen am Ende von',
      '`docs/PLAYTEST.md`.',
      '',
    ]
    writeFileSync(`${ROOT}/docs/reports/onboarding.md`, zeilen.join('\n'))

    expect(zeilen.length).toBeGreaterThan(20)
  })
})
