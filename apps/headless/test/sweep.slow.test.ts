import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseRules, type MapData } from '@worldwar/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  SWING_THRESHOLD,
  baselineSlowly,
  measureSlowly,
  type ConstantEffect,
  type SweepOptions,
  type TrialResult,
} from '../src/sweep'

/**
 * The balance sweep on the real map (T-M12-00, R-AI-06, design D17).
 *
 * Slow suite, and unavoidably so: every constant is played out twice over several
 * seeds, which is minutes of simulation. It writes `docs/reports/balance-sweep.md`, so
 * the answer to "does this number matter" is a document rather than a memory.
 *
 * The finding it looks for is not a better value. It is which constants are
 * load-bearing — because the ones that are not can be left alone forever, and that is
 * worth more than any single tuning.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const rules = parseRules(
  Object.fromEntries(
    ['constants', 'resources', 'buildings', 'units', 'ai'].map((name) => [
      name,
      JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8')),
    ]),
  ) as never,
  'default',
)

/** The constants a change would actually be felt through — economy, combat, morale. */
const WATCHED = [
  'battleRate',
  'minDamage',
  'defenceCap',
  'startMorale',
  'baseTargetMorale',
  'moraleDriftDivisor',
  'revoltThreshold',
  'productionMoraleFloor',
  'deployDelayTicks',
  'regenPermillePerTick',
  'taxPerThousandPopulationPerTick',
  'marketElasticity',
  'stackFullContribution',
  'expansionPenaltyPerProvince',
]

const OPTIONS: SweepOptions = {
  map,
  rules,
  // Neighbours in Europe, so there are fronts. Between the United States and Russia
  // nothing happens in forty days and every variant comes out identical — which would
  // be a finding about the map, read as a finding about the rules.
  nations: ['Deutschland', 'Frankreich', 'Polen', 'Italien', 'Ukraine', 'Spanien'],
  players: 6,
  days: 120,
  seeds: [1914, 2015],
}

let baseline: TrialResult
const effects: ConstantEffect[] = []

describe('R-AI-06 Balancing wird gemessen, nicht geraten', () => {
  beforeAll(async () => {
    baseline = await baselineSlowly(OPTIONS)
  })

  it('spielt einen Grundlauf, in dem ueberhaupt etwas passiert', () => {
    // A tool that measures nothing must not report that nothing matters. If no province
    // ever changes hands, the constants under test never came into play and every
    // "0 % swing" below is an artefact, not a finding.
    expect(baseline.captures, 'Im Grundlauf wechselte keine Provinz den Besitzer').toBeGreaterThan(0)
  })

  // One test per constant, and each of them yielding between games. Both halves
  // matter: the split makes a failure name its constant and the run report progress,
  // and the yielding keeps the worker answerable. Without the second, a run of this
  // length dies on vitest's RPC timeout with every measurement in it correct.
  for (const constant of WATCHED) {
    it(`misst ${constant}`, async () => {
      const effect = await measureSlowly(OPTIONS, constant, baseline)
      effects.push(effect)

      // No single constant may decide the game on its own. If one did, a mistake in one
      // number would ruin every game — and the sweep exists to find that before a
      // player does.
      expect(effect.swing, `${constant} allein kippt die Partie`).toBeLessThanOrEqual(0.4)
    })
  }

  afterAll(() => {
    if (effects.length > 0) writeReport([...effects].sort((a, b) => b.swing - a.swing))
  })
})

function writeReport(measured: ConstantEffect[]): void {
  const bearing = measured.filter((effect) => effect.loadBearing)
  const players = OPTIONS.players

  const report = [
    '# Balancing — Parameterlauf',
    '',
    'Erzeugt von `apps/headless/test/sweep.slow.test.ts` (`pnpm balance:sweep`).',
    `${players} Mächte, ${OPTIONS.days} Spieltage, ${OPTIONS.seeds.length} Startzahlen je Variante,`,
    'jede Konstante um ±25 % bewegt.',
    '',
    '## Was gemessen wird',
    '',
    'Der **Ausschlag** ist die größte Änderung am Anteil des Stärksten an allen Provinzen,',
    `wenn die Konstante um ±25 % bewegt wird. Ab ${SWING_THRESHOLD * 100} % gilt sie als`,
    '**tragend**: eine Zahl, die den Partieausgang kippt und daher stimmen muss.',
    'Konstanten ohne Ausschlag darf man in Ruhe lassen — das ist der eigentliche Nutzen',
    'dieser Liste.',
    '',
    '## Ausgangslage',
    '',
    '| Kennzahl | Wert |',
    '|---|---|',
    `| Anteil des Stärksten | ${(baseline.leaderShare * 100).toFixed(1)} % |`,
    `| Überlebende Mächte | ${baseline.survivors.toFixed(1)} von ${players} |`,
    `| Wirtschaft gesamt | ${baseline.economy.toLocaleString('de-DE')} |`,
    `| Eroberte Provinzen | ${baseline.captures} |`,
    `| Gespielte Tage | ${baseline.days} |`,
    '',
    `## Tragende Konstanten (${bearing.length} von ${measured.length})`,
    '',
    bearing.length === 0
      ? '**Keine.** Keine einzelne Konstante kippt den Ausgang um mehr als die Schwelle — das Regelwerk hängt an keiner Zahl allein, und ein Balancing-Fehler an einer Stelle verdirbt nicht die ganze Partie.'
      : [
          '| Konstante | Ausschlag | −25 % | Grundwert | +25 % |',
          '|---|---|---|---|---|',
          ...bearing.map(
            (e) =>
              `| \`${e.constant}\` | ${(e.swing * 100).toFixed(1)} % | ${(e.lower.leaderShare * 100).toFixed(0)} % | ${(e.baseline.leaderShare * 100).toFixed(0)} % | ${(e.upper.leaderShare * 100).toFixed(0)} % |`,
          ),
        ].join('\n'),
    '',
    '## Alle geprüften Konstanten',
    '',
    '| Konstante | Ausschlag | Überlebende −25 % / +25 % | tragend |',
    '|---|---|---|---|',
    ...measured.map(
      (e) =>
        `| \`${e.constant}\` | ${(e.swing * 100).toFixed(1)} % | ${e.lower.survivors.toFixed(1)} / ${e.upper.survivors.toFixed(1)} | ${e.loadBearing ? '**ja**' : '—'} |`,
    ),
    '',
  ].join('\n')

  mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
  writeFileSync(`${ROOT}/docs/reports/balance-sweep.md`, report)
  writeFileSync(
    `${ROOT}/docs/reports/balance-sweep.json`,
    JSON.stringify(
      { players, days: OPTIONS.days, seeds: OPTIONS.seeds, threshold: SWING_THRESHOLD, effects: measured },
      null,
      2,
    ) + '\n',
  )
}
