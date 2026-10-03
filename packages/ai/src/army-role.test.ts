import { describe, expect, it } from 'vitest'
import { TEST_RULES } from '@worldwar/testkit'
import { armyRole, isBattery } from './army-role'

/**
 * T-M42-08 (R-AI-10/AK2, D32.9): die Rolle einer Armee. Eine Batterie ist eine Armee, deren
 * Einheiten **saemtlich** Reichweite haben (dieselbe Bedingung wie bisher in `military.ts`); alles
 * andere ist Linie. Die Faelle sind die von `istBatterie` in `m42-zaehlung.test.ts` (B1-B5).
 */
const stapel = (unitKey: string, einheiten: number) => ({
  unitKey,
  hpTotal: einheiten * (TEST_RULES.units[unitKey]?.hpPerUnit ?? 1000),
})

describe('R-AI-10/AK2 Die Rolle einer Armee (T-M42-08)', () => {
  it('R1: leer ist keine Batterie', () => {
    expect(isBattery([], TEST_RULES)).toBe(false)
    expect(armyRole([], TEST_RULES)).toBe('line')
  })
  it('R2: Infanterie ist Linie', () => {
    expect(isBattery([stapel('infantry', 5)], TEST_RULES)).toBe(false)
    expect(armyRole([stapel('infantry', 5)], TEST_RULES)).toBe('line')
  })
  it('R3: Artillerie ist Batterie', () => {
    expect(isBattery([stapel('artillery', 1)], TEST_RULES)).toBe(true)
    expect(armyRole([stapel('artillery', 1)], TEST_RULES)).toBe('battery')
  })
  it('R4: gemischt ist Linie - eine Haubitze macht keinen Artillerieverband', () => {
    expect(armyRole([stapel('infantry', 20), stapel('artillery', 1)], TEST_RULES)).toBe('line')
  })
  it('R5: eine unbekannte Einheit ist keine Batterie', () => {
    const unbekannt = [{ unitKey: 'unbekannte_einheit', hpTotal: 1000 }]
    expect(armyRole(unbekannt, TEST_RULES)).toBe('line')
  })
})
