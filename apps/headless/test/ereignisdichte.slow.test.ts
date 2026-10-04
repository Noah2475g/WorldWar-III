import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  isAlertType,
  parseRules,
  type GameEvent,
  type GameState,
  type MapData,
  type Rules,
} from '@worldwar/core'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * Ereignisdichte je Spielabschnitt (T-M46-16, VM-06: "Das Mid-Game ist sehr, sehr stressig").
 *
 * Erst messen: eine Vollpartie der ausgelieferten Aufstellung (ein Mensch, der nichts befiehlt,
 * und sieben KI; Startzahl 1914) bis zur Entscheidung, gezaehlt je 50-Tage-Fenster. Keine
 * Schranke - der Test schreibt `docs/reports/v3/ereignisdichte.md` und prueft nur, dass die
 * Partie entschieden wurde und die Zaehlung nichts verloren hat. Simulation, keine Zeitmessung.
 *
 * **Grenze:** der Mensch befiehlt nichts, also misst das die KI-Umwelt: Angriffe, die ein
 * Mensch durch eigenes Handeln (Rueckzug, Buendnisse, Verteidigung) abwenden oder ausloesen
 * wuerde, sind hier nicht abgebildet.
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
const rules: Rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const map = load('data/maps/world.json') as MapData
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const WINDOW = 50
const MAX_DAYS = 1500

interface Window {
  from: number
  total: number
  alerts: number
  byType: Record<string, number>
  /** Fuer den Menschen sichtbar (audience leer oder er) - das, was sein Protokoll fuellt. */
  visible: number
  /** Betrifft den Menschen (`concerns`). */
  humanConcerned: number
  /** Davon Alarme - die, die das Vorspulen anhalten. */
  humanAlerts: number
  warsDeclared: number
  warsOnHuman: number
  attacksOnHuman: number // Einmarsch in seine Provinzen + Eroberung seiner Provinzen + Kampf auf seinem Boden
  intrusions: number
  provincesLost: number
  armiesLost: number
  battlesOnHumanLand: number
  warsMax: number
  warsSum: number
  warsHumanMax: number
  days: number
}

const emptyWindow = (from: number): Window => ({
  from,
  total: 0,
  alerts: 0,
  byType: {},
  visible: 0,
  humanConcerned: 0,
  humanAlerts: 0,
  warsDeclared: 0,
  warsOnHuman: 0,
  attacksOnHuman: 0,
  intrusions: 0,
  provincesLost: 0,
  armiesLost: 0,
  battlesOnHumanLand: 0,
  warsMax: 0,
  warsSum: 0,
  warsHumanMax: 0,
  days: 0,
})

/** Kriege zwischen lebenden Maechten, und wie viele davon den Menschen betreffen. */
const kriege = (state: GameState, human: string): { all: number; human: number } => {
  let all = 0
  let mine = 0
  for (const [key, relation] of Object.entries(state.diplomacy.relations)) {
    if (relation.state !== 'war') continue
    const [a, b] = key.split('|') as [string, string]
    if (!state.players[a]?.alive || !state.players[b]?.alive) continue
    all += 1
    if (a === human || b === human) mine += 1
  }
  return { all, human: mine }
}

describe('Ereignisdichte je 50 Tage', () => {
  it('zaehlt eine Vollpartie der ausgelieferten Aufstellung und schreibt den Bericht', async () => {
    const config = toConfig({ ...DEFAULT_NEW_GAME, seed: 1914 }, map)
    let state = createInitialState(config, { map, rules })
    const human = state.playerOrder.find((id) => state.players[id]!.kind === 'human')
    expect(human).toBeDefined()
    const me = human!
    const perDay = rules.constants.ticksPerDay
    const windows: Window[] = []
    const windowOf = (day: number): Window => {
      const index = Math.floor(day / WINDOW)
      while (windows.length <= index) windows.push(emptyWindow(windows.length * WINDOW))
      return windows[index]!
    }
    const types = new Set<string>()
    let eventsTotal = 0

    for (let day = 0; day < MAX_DAYS && state.victory.winner === null; day += 1) {
      const step = advanceTicks(state, perDay, { map, rules })
      state = step.state
      const w = windowOf(day)
      w.days += 1
      const war = kriege(state, me)
      w.warsSum += war.all
      w.warsMax = Math.max(w.warsMax, war.all)
      w.warsHumanMax = Math.max(w.warsHumanMax, war.human)
      for (const event of step.events as GameEvent[]) {
        const ew = windowOf(Math.floor(event.tick / perDay))
        eventsTotal += 1
        ew.total += 1
        types.add(event.type)
        ew.byType[event.type] = (ew.byType[event.type] ?? 0) + 1
        if (isAlertType(event.type)) ew.alerts += 1
        if (event.audience.length === 0 || event.audience.includes(me)) ew.visible += 1
        const concerned = event.concerns.includes(me)
        if (concerned) {
          ew.humanConcerned += 1
          if (isAlertType(event.type)) ew.humanAlerts += 1
        }
        switch (event.type) {
          case 'WAR_DECLARED':
            ew.warsDeclared += 1
            if (event.targetPlayerId === me) ew.warsOnHuman += 1
            break
          case 'ARMY_INTRUDED':
            if (event.playerId === me) {
              ew.intrusions += 1
              ew.attacksOnHuman += 1
            }
            break
          case 'PROVINCE_CAPTURED':
            if (event.previousOwner === me) {
              ew.provincesLost += 1
              ew.attacksOnHuman += 1
            }
            break
          case 'ARMY_DESTROYED':
            if (event.playerId === me) ew.armiesLost += 1
            break
          case 'BATTLE_STARTED':
            if (state.provinces[event.provinceId]?.owner === me || event.sides.some((side) => side.includes(me))) {
              ew.battlesOnHumanLand += 1
            }
            break
          default:
            break
        }
      }
      if (day % 10 === 9) await breathe()
    }

    const endDay = Math.floor(state.tick / perDay)
    expect(state.victory.winner).not.toBeNull()
    expect(windows.reduce((sum, w) => sum + w.total, 0)).toBe(eventsTotal)

    const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
    const typeList = [...types].sort()
    const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`
    const label = (w: Window): string => `${w.from}-${w.from + WINDOW - 1}`
    const avg = (w: Window): string => (w.days === 0 ? '-' : (w.warsSum / w.days).toFixed(1))
    const out: string[] = []
    out.push('# Ereignisdichte je Spielabschnitt (T-M46-16)')
    out.push('')
    out.push(`Gemessen auf: ${commit} · Startzahl 1914 · Aufstellung: ausgeliefert (Weltkarte, 1 Mensch ohne Befehle + 7 KI) · Entscheidung an Tag ${endDay} (Tick ${state.tick}), Sieger ${String(state.victory.winner)}.`)
    out.push('')
    out.push('Erzeugt von `apps/headless/test/ereignisdichte.slow.test.ts` (`pnpm test:slow` mit dieser Datei). Simulation, keine Zeitmessung. Fenster: je 50 Spieltage, nach Tick des Ereignisses.')
    out.push('')
    out.push('**Grenze:** der Mensch befiehlt nichts. Das misst die KI-Umwelt; was ein handelnder Mensch ausloest oder abwendet, fehlt.')
    out.push('')
    out.push('## Ereignisse und Alarme')
    out.push('')
    out.push(row(['Tage', 'Ereignisse', 'je Tag', 'Alarme', 'sichtbar fuer Mensch', 'betrifft Mensch', 'davon Alarme']))
    out.push(row(['---', '---:', '---:', '---:', '---:', '---:', '---:']))
    for (const w of windows) out.push(row([label(w), w.total, (w.total / Math.max(1, w.days)).toFixed(1), w.alerts, w.visible, w.humanConcerned, w.humanAlerts]))
    out.push('')
    out.push('## Krieg und Gefahr fuer den Menschen')
    out.push('')
    out.push(row(['Tage', 'Kriegserklaerungen', 'davon an Mensch', 'Kriege gleichzeitig (Schnitt)', 'Kriege (Spitze)', 'Kriege mit Mensch (Spitze)', 'Einmaersche', 'Provinzen verloren', 'Armeen verloren', 'Kaempfe auf seinem Boden']))
    out.push(row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']))
    for (const w of windows) out.push(row([label(w), w.warsDeclared, w.warsOnHuman, avg(w), w.warsMax, w.warsHumanMax, w.intrusions, w.provincesLost, w.armiesLost, w.battlesOnHumanLand]))
    out.push('')
    out.push('## Ereignisse je Typ')
    out.push('')
    out.push(row(['Typ', ...windows.map(label), 'gesamt']))
    out.push(row(['---', ...windows.map(() => '---:'), '---:']))
    for (const type of typeList) {
      const counts = windows.map((w) => w.byType[type] ?? 0)
      out.push(row([`${type}${isAlertType(type as never) ? ' (Alarm)' : ''}`, ...counts, counts.reduce((a, b) => a + b, 0)]))
    }
    out.push('')
    out.push('## Deutung')
    out.push('')
    out.push('@@DEUTUNG@@')
    out.push('')
    const dir = `${ROOT}/docs/reports/v3`
    mkdirSync(dir, { recursive: true })
    // Die Deutung schreibt der Mensch/Agent nach dem Lauf in den Bericht; ein erneuter Lauf
    // behaelt sie, wenn sie schon dasteht.
    const file = `${dir}/ereignisdichte.md`
    let deutung = '(noch nicht gedeutet)'
    try {
      const old = readFileSync(file, 'utf8')
      const at = old.indexOf('## Deutung\n')
      if (at >= 0) deutung = old.slice(at + '## Deutung\n'.length).trim()
    } catch {
      /* erster Lauf */
    }
    writeFileSync(file, out.join('\n').replace('@@DEUTUNG@@', deutung) + '\n')
  })
})
