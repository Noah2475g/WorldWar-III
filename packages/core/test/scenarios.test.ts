import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, parseScenario, runScenario, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'

/**
 * Every scenario file under test/scenarios is a test (design D14).
 *
 * The value of this format is that a rule can be pinned down by writing the situation
 * and the expected outcome — no TypeScript, no fixtures, no setup boilerplate.
 */
const dir = fileURLToPath(new URL('./scenarios/', import.meta.url))
const files = readdirSync(dir).filter((name) => name.endsWith('.yaml'))
const ctx = { map: smallWorld(), rules: TEST_RULES }

describe('R-ARCH-01 Szenarien', () => {
  it('findet Szenariodateien', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s', (file) => {
    const scenario = parseScenario(readFileSync(join(dir, file), 'utf8'))
    const result = runScenario(scenario, ctx)
    expect(result.failures, `${scenario.name}:\n  ${result.failures.join('\n  ')}`).toEqual([])
  })

  it('meldet eine verletzte Erwartung, statt sie zu verschlucken', () => {
    const scenario = parseScenario(`
name: Absichtlich falsch
run: 3
expect:
  - { path: tick, op: '==', value: 99 }
`)
    const result = runScenario(scenario, ctx)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toContain('tick')
  })

  it('weist unbekannte Felder zurueck', () => {
    // A silently ignored typo in an expectation is worse than no test at all.
    expect(() => parseScenario('name: X\nrun: 1\nexpect: []\nerwartet: []\n')).toThrow(/Unbekanntes Feld/)
  })

  it('verlangt Name, Laufzeit und Erwartungen', () => {
    expect(() => parseScenario('run: 1\nexpect: []\n')).toThrow(/Namen/)
    expect(() => parseScenario('name: X\nexpect: []\n')).toThrow(/run/)
    expect(() => parseScenario('name: X\nrun: 1\n')).toThrow(/expect/)
  })

  it('weist unbekannte Provinzen im Aufbau zurueck', () => {
    const scenario = parseScenario(`
name: Falsche Provinz
run: 1
provinces:
  utopia: { morale: 100 }
expect: []
`)
    expect(() => runScenario(scenario, ctx)).toThrow(/utopia/)
  })
})
