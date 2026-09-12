import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, parseRules, type GameConfig, type GameState, type MapData, type Rules } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { playOut, type TrialResult } from '../src/sweep'

/**
 * Die Fortschrittsachse, gemessen (T-M34-01, FORTSCHRITT.md Abschnitt 0 Punkt 1).
 *
 * **Erst messen, dann strecken.** Ohne diesen Lauf ist jedes spaetere „es ist besser
 * geworden" unbelegt — und dieses Projekt hat zweimal teuer bezahlt, weil eine Messung
 * fehlte oder unter Fremdlast entstand.
 *
 * Gemessen wird dreierlei, und die drei gehoeren zusammen:
 *
 *  1. **Die Leiter selbst** — rechnerisch aus dem Regelwerk: wann die letzte Sache frei
 *     wird, wie lange das in Echtzeit dauert, welchen Anteil einer Partie das ausmacht.
 *     Keine Simulation noetig; die Uhr laeuft mit einem Tick je Sekunde bei Tempo 1.
 *  2. **Die Partie** — derselbe Grundlauf, den der Parameterlauf als Ausgangswert nimmt:
 *     sechs europaeische Nachbarn, 120 Spieltage, zwoelf Startzahlen. Das ist der
 *     billige Teil des Parameterlaufs (24 Partien statt ueber 350) und liefert genau die
 *     Kennzahlen, die T-M34-07 vergleicht.
 *  3. **Risiko 5** — erreicht eine mittlere Macht die dritte Fabrikstufe? Nicht
 *     gerechnet, sondern gespielt: 200 Spieltage, und jeden Tag nachgesehen.
 *
 * Der Lauf **schreibt** `docs/reports/progress-measured.json`. Die Deutung steht in
 * `docs/reports/progress-baseline.md` — von Hand, weil ein Vergleich ueber fuenf
 * Regelstaende keine Maschine schreiben kann.
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
const world = load('data/maps/world.json') as MapData

/** Dieselben Nachbarn und Startzahlen wie `sweep.slow.test.ts` — sonst ist es kein Vergleich. */
const NATIONS = ['Deutschland', 'Frankreich', 'Polen', 'Italien', 'Ukraine', 'Spanien'] as const
const SEEDS = [1914, 2015, 1939, 1871, 1806, 1683, 1945, 1789, 1848, 1990, 2001, 1066]
const PLAYERS = 6
const DAYS = 120
/**
 * Der Siegtag des Abnahmelaufs **vor M34** — der feste Massstab, gegen den der Anteil
 * gerechnet wird.
 *
 * Bewusst eine Konstante und nicht der jeweils letzte Lauf: sonst aenderten sich Zaehler
 * und Nenner gleichzeitig, und „zwei Prozent gegen zehn" waere keine Aussage mehr. Der
 * Siegtag des aktuellen Standes steht in `docs/reports/fullgame.json` und wird im
 * Bericht danebengestellt (nach M34: Tag 471).
 */
const PARTIE_TAGE = 798
/** Die Stufe, um die Risiko 5 sich sorgt, und wie lange sie dafuer Zeit bekommt. */
const RISIKO_STUFE = 3
const RISIKO_TAGE = 200

interface Ladder {
  letzterTag: number
  minutenTempo1: number
  minutenTempo10: number
  anteilDerPartie: number
  tage: Record<string, number>
}

function ladder(): Ladder {
  const tage: Record<string, number> = {}
  for (const [key, rule] of Object.entries(rules.buildings)) tage[key] = rule.availableFromDay
  for (const [key, rule] of Object.entries(rules.units)) tage[key] = rule.availableFromDay

  const letzterTag = Math.max(...Object.values(tage))
  // Ein Tick je Sekunde bei Tempo 1 (App.tsx, die Schleife mit `owed`), 24 Ticks je Tag.
  const sekunden = letzterTag * rules.constants.ticksPerDay
  return {
    letzterTag,
    minutenTempo1: sekunden / 60,
    minutenTempo10: sekunden / 10 / 60,
    anteilDerPartie: letzterTag / PARTIE_TAGE,
    tage,
  }
}

const mittel = (werte: number[]): number => werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length)

/**
 * Gibt die Ereignisschleife zwischen zwei Partien zurueck — dieselbe Zeile wie in
 * `sweep.ts`, und aus demselben Grund: eine Simulation ist ein synchroner Block, und ein
 * Prozess, der Minuten darin bleibt, antwortet dem Testlaeufer nicht. Der haelt ihn fuer
 * haengend. **Ohne diese Zeile hat der erste Lauf mit `Timeout calling "onTaskUpdate"`
 * geendet, obwohl alle vier Tests gruen waren und der Bericht geschrieben war.**
 */
const atmen = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Der hoechste Fabrikausbau je Macht, und an welchem Spieltag er zuerst dastand. */
async function fabrikStufen(): Promise<{ erreichtAmTag: (number | null)[]; hoechsteStufe: number[] }> {
  const config: GameConfig = {
    seed: SEEDS[0]!,
    mapId: world.id,
    rulesId: 'default',
    players: world.startPositions
      .filter((start) => NATIONS.includes(start.nation as (typeof NATIONS)[number]))
      .slice(0, PLAYERS)
      .map((start, index) => ({
        name: start.nation,
        kind: 'ai' as const,
        nation: start.nation,
        color: `#${(0x9f_b2_be + index * 0x10_10_10).toString(16).slice(0, 6)}`,
        difficulty: 'normal' as const,
      })),
    victory: { condition: 'points' as const, pointsShareToWin: 700, dayLimit: null },
  }

  const ctx = { map: world, rules }
  let state: GameState = createInitialState(config, ctx)
  const ids = state.playerOrder
  const erreichtAmTag = new Map<string, number | null>(ids.map((id) => [id, null]))
  const hoechsteStufe = new Map<string, number>(ids.map((id) => [id, 0]))

  for (let day = 1; day <= RISIKO_TAGE; day++) {
    state = advanceTicks(state, rules.constants.ticksPerDay, ctx).state
    for (const province of Object.values(state.provinces)) {
      const owner = province.owner
      if (!owner) continue
      const level = province.buildings.factory ?? 0
      if (level > (hoechsteStufe.get(owner) ?? 0)) hoechsteStufe.set(owner, level)
      if (level >= RISIKO_STUFE && erreichtAmTag.get(owner) === null) erreichtAmTag.set(owner, day)
    }
    if (day % 20 === 0) await atmen()
  }

  return {
    erreichtAmTag: ids.map((id) => erreichtAmTag.get(id) ?? null),
    hoechsteStufe: ids.map((id) => hoechsteStufe.get(id) ?? 0),
  }
}

describe('R-TECH-01 Die Fortschrittsachse wird gemessen, nicht geschaetzt', () => {
  const leiter = ladder()
  const laeufe: TrialResult[] = []
  let fabrik: { erreichtAmTag: (number | null)[]; hoechsteStufe: number[] } = { erreichtAmTag: [], hoechsteStufe: [] }

  it('spielt einen Grundlauf, in dem ueberhaupt etwas passiert', async () => {
    for (const seed of SEEDS) {
      laeufe.push(playOut(world, rules, PLAYERS, DAYS, seed, NATIONS))
      await atmen()
    }

    // Dieselbe Zusicherung wie im Parameterlauf, und aus demselben Grund: ein Werkzeug,
    // das nichts misst, darf nicht melden, dass nichts passiert.
    expect(mittel(laeufe.map((r) => r.captures)), 'im Grundlauf wechselte keine Provinz den Besitzer').toBeGreaterThan(0)
    expect(laeufe).toHaveLength(SEEDS.length)
  })

  it('kennt fuer jede der siebzehn Sachen einen Tag', () => {
    expect(Object.keys(leiter.tage)).toHaveLength(17)
    expect(leiter.letzterTag).toBeGreaterThan(0)
  })

  it('misst, ob eine mittlere Macht die dritte Fabrikstufe erreicht (Risiko 5)', async () => {
    fabrik = await fabrikStufen()

    // Der Lauf misst; die Grenze steht bewusst niedrig. Eine Zusicherung auf „Stufe 3 bis
    // Tag 200" waere eine Zusicherung ueber die KI und nicht ueber die Regeln — sie
    // faellt, sobald jemand die KI aendert, und saehe dann wie ein Wirtschaftsproblem aus.
    // Was hier scheitern DARF: dass gar keine Macht ueber die erste Stufe hinauskommt.
    expect(Math.max(...fabrik.hoechsteStufe), 'keine Macht baut in 200 Tagen eine Fabrik').toBeGreaterThanOrEqual(1)
  })

  it('schreibt den Bericht', () => {
    const report = {
      gemessenAm: new Date().toISOString().slice(0, 10),
      leiter: {
        letzteFreischaltungTag: leiter.letzterTag,
        echtzeitMinutenTempo1: Number(leiter.minutenTempo1.toFixed(1)),
        echtzeitMinutenTempo10: Number(leiter.minutenTempo10.toFixed(1)),
        anteilDerPartieProzent: Number((leiter.anteilDerPartie * 100).toFixed(1)),
        partieTageAusAbnahmelauf: PARTIE_TAGE,
        tage: leiter.tage,
      },
      grundlauf: {
        maechte: PLAYERS,
        tage: DAYS,
        startzahlen: SEEDS.length,
        anteilDesStaerksten: Number(mittel(laeufe.map((r) => r.leaderShare)).toFixed(4)),
        eroberungen: Number(mittel(laeufe.map((r) => r.captures)).toFixed(1)),
        ueberlebende: Number(mittel(laeufe.map((r) => r.survivors)).toFixed(2)),
        endbestaende: Math.round(mittel(laeufe.map((r) => r.stockpile))),
      },
      risiko5: {
        tage: RISIKO_TAGE,
        stufe: RISIKO_STUFE,
        hoechsteStufeJeMacht: fabrik.hoechsteStufe,
        erreichtAmTagJeMacht: fabrik.erreichtAmTag,
      },
    }

    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(`${ROOT}/docs/reports/progress-measured.json`, `${JSON.stringify(report, null, 2)}\n`)
    expect(report.grundlauf.startzahlen).toBe(SEEDS.length)
  })
})
