import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import inspector from 'node:inspector'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { deserialise, parseRules, type GameState, type MapData, type Rules } from '@worldwar/core'

/**
 * Profil der V3 (P0-A.3): wo die Arbeit im Spaetspiel hingeht, ohne Millisekunden als Beleg.
 *
 * Je Stand (S100/S300/S575) `TICKS` Ticks (Vorgabe 240 = 10 Spieltage) mit KI. Zwei Betriebsarten:
 *
 *  - `WORLDWAR_PROFILE_MODE=calls` (Vorgabe): genaue **Aufrufzahlen** je Funktion ueber die
 *    Precise-Coverage des Inspectors (`callCount`), dazu die **Allokationen** der Heap-Stichprobe
 *    (`HeapProfiler.startSampling`, Bytes je Funktion). Beides haengt nicht an der Maschinenlast.
 *    Schreibt `docs/reports/v3/profil-<stand>.json`.
 *  - `WORLDWAR_PROFILE_MODE=cpu`: Probenprofil des Inspectors, geschrieben nach
 *    `node_modules/.cache/cpu/<stand>.cpuprofile`; `plain` faehrt nur die Ticks (fuer
 *    `--pool=forks --poolOptions.forks.execArgv=--cpu-prof`, das unter vitest keine Datei schrieb).
 *    `scripts/cpuprofile-top.mjs` wertet das `.cpuprofile` aus (Anteile, nicht Millisekunden) und haengt `cpuShares` an dieselbe Datei.
 *
 * `WORLDWAR_PROFILE_STANDS=S300` (Komma-Liste) waehlt Staende. Das Spielverhalten wird nicht beruehrt.
 * Hinweis: `planRoute` ist Kern (`core/phases/movement.ts`), nicht KI.
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
const TICKS = Number(process.env['WORLDWAR_PROFILE_TICKS'] ?? 240)
const MODE = process.env['WORLDWAR_PROFILE_MODE'] ?? 'calls'
const STANDS = (process.env['WORLDWAR_PROFILE_STANDS'] ?? 'S100,S300,S575').split(',')

function loadStand(name: string): GameState {
  const gz = `${ROOT}/test/fixtures/v3/${name}.json.gz`
  const text = existsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : readFileSync(`${ROOT}/test/fixtures/v3/${name}.json`, 'utf8')
  return deserialise(text)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const session = new inspector.Session()
session.connect()
const post = (method: string, params?: object): Promise<any> =>
  new Promise((resolve, reject) => session.post(method, params ?? {}, (err: Error | null, res: unknown) => (err ? reject(err) : resolve(res))))

const rel = (url: string): string => {
  const path = url.replace(/^file:\/\/\//, '').split('\\').join('/')
  const root = ROOT.split('\\').join('/')
  return path.startsWith(root) ? path.slice(root.length) : path
}
const interesting = (file: string): boolean => /^\/?(packages\/(ai|core)\/src)\//.test(file) && !/\.test\./.test(file)

interface HeapNode {
  callFrame: { functionName: string; url: string; lineNumber: number }
  selfSize: number
  children: HeapNode[]
}

describe('V3-Profil', () => {
  it.each(STANDS)('%s: Aufrufzahlen und Allokationen', async (name) => {
    const state = loadStand(name)
    mkdirSync(`${ROOT}/docs/reports/v3`, { recursive: true })
    const file = `${ROOT}/docs/reports/v3/profil-${name}.json`

    if (MODE === 'cpu') {
      // Probenprofil im Prozess (Inspector-Profiler): `--cpu-prof` ueber execArgv schrieb unter dem
      // vitest-Arbeiter keine Datei (Prozessende vor dem Schreiben). Dieselbe Art Datei, selber Auswerter.
      const dir = `${ROOT}/node_modules/.cache/cpu`
      mkdirSync(dir, { recursive: true })
      await post('Profiler.enable')
      await post('Profiler.setSamplingInterval', { interval: 200 })
      await post('Profiler.start')
      advanceTicks(state, TICKS, { map, rules })
      const { profile } = (await post('Profiler.stop')) as { profile: unknown }
      writeFileSync(`${dir}/${name}.cpuprofile`, JSON.stringify(profile))
      return
    }

    if (MODE === 'plain') {
      advanceTicks(state, TICKS, { map, rules })
      return
    }

    await post('Profiler.enable')
    await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false })
    await post('HeapProfiler.enable')
    await post('HeapProfiler.startSampling', { samplingInterval: 8192 })
    const out = advanceTicks(state, TICKS, { map, rules })
    const heap = (await post('HeapProfiler.stopSampling')) as { profile: { head: HeapNode } }
    const cov = (await post('Profiler.takePreciseCoverage')) as {
      result: { url: string; functions: { functionName: string; ranges: { count: number }[] }[] }[]
    }
    await post('Profiler.stopPreciseCoverage')
    await post('Profiler.disable')

    const calls: { fn: string; file: string; calls: number }[] = []
    for (const script of cov.result) {
      const f = rel(script.url)
      if (!interesting(f)) continue
      for (const fn of script.functions) {
        const count = fn.ranges[0]?.count ?? 0
        if (count > 0 && fn.functionName) calls.push({ fn: fn.functionName, file: f, calls: count })
      }
    }
    calls.sort((a, b) => b.calls - a.calls)

    const alloc = new Map<string, number>()
    const walk = (node: HeapNode): void => {
      const f = rel(node.callFrame.url)
      if (node.selfSize > 0 && interesting(f)) {
        const key = `${node.callFrame.functionName || '(anonym)'} ${f}`
        alloc.set(key, (alloc.get(key) ?? 0) + node.selfSize)
      }
      node.children.forEach(walk)
    }
    walk(heap.profile.head)
    const allocTop = [...alloc.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, bytes]) => ({ fn: k, sampledBytes: bytes }))

    const ran = Math.max(1, out.state.tick - state.tick)
    const aiFns = ['runAi', 'consolidateCommands', 'economyCommands', 'recruitCommands', 'tradeCommands', 'militaryCommands', 'adjutantCommands']
    const coreFns = ['planRoute', 'runTicks', 'applyCommands', 'frontProvinces']
    const pick = (names: string[]) => names.flatMap((n) => calls.filter((c) => c.fn === n).slice(0, 3))
    const perFile = new Map<string, number>()
    for (const c of calls) perFile.set(c.file, (perFile.get(c.file) ?? 0) + c.calls)

    writeFileSync(
      file,
      JSON.stringify(
        {
          note: 'Erzeugt von apps/headless/test/perf-profile.slow.test.ts. Aufrufzahlen (Precise Coverage) und Heap-Stichprobe; keine Millisekunden. Ticks aus dem Stand, mit KI.',
          stand: name,
          ticksRun: out.state.tick - state.tick,
          startTick: state.tick,
          decided: out.state.victory.winner,
          aiFunctions: pick(aiFns),
          coreFunctions: pick(coreFns),
          callsPerTick: Object.fromEntries([...aiFns, ...coreFns].map((n) => [n, +((calls.find((c) => c.fn === n)?.calls ?? 0) / ran).toFixed(2)])),
          topCalls: calls.slice(0, 30),
          callsPerFile: [...perFile.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 25)
            .map(([f, n]) => ({ file: f, calls: n })),
          topAllocations: allocTop,
        },
        null,
        2,
      ) + '\n',
    )
  })
})
