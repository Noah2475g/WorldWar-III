import { RAW_DEFAULT_RULES, defaultRules } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { RulesError, parseRules } from './load'
import type { RawRules } from './types'

const UNIT_CLASSES = ['infantry', 'armor', 'artillery', 'air', 'navy'] as const

/** Deep copy of the shipped rules with one thing broken. */
const withBreak = (mutate: (raw: RawRules) => void): RawRules => {
  const raw = structuredClone(RAW_DEFAULT_RULES) as unknown as RawRules
  mutate(raw)
  return raw
}

const problemsOf = (raw: RawRules): string[] => {
  try {
    parseRules(raw, 'broken')
    return []
  } catch (error) {
    return error instanceof RulesError ? error.problems : [String(error)]
  }
}

describe('R-ECON-01 Regelwerk laden', () => {
  it('laedt das ausgelieferte Regelwerk', () => {
    const rules = defaultRules()
    expect(rules.id).toBe('default')
    expect(Object.keys(rules.units).length).toBeGreaterThanOrEqual(8)
    expect(Object.keys(rules.buildings)).toHaveLength(7)
  })

  it('kennt alle sieben Ressourcen mit Startmenge und Preis', () => {
    const rules = defaultRules()
    for (const key of ['food', 'wood', 'iron', 'coal', 'oil', 'rare', 'money'] as const) {
      expect(rules.resources[key].startAmount).toBeGreaterThan(0)
      expect(rules.resources[key].basePrice).toBeGreaterThan(0)
    }
  })

  it('laesst Geld ohne Lagergrenze', () => {
    // Documented exception in design D6.8: storage caps apply to goods, not to money.
    expect(defaultRules().storageLimits.money).toBeNull()
    expect(defaultRules().storageLimits.food).toBeGreaterThan(0)
  })
})

describe('R-UNIT-01 Einheitenkatalog ist vollstaendig', () => {
  it('gibt jeder Einheit Werte gegen jede Klasse', () => {
    // A missing entry would quietly read as "does no damage to tanks" and only
    // surface in a lost battle.
    const rules = defaultRules()
    for (const [key, unit] of Object.entries(rules.units)) {
      for (const target of UNIT_CLASSES) {
        expect(unit.attack[target], `${key} ohne Angriffswert gegen ${target}`).toBeTypeOf('number')
        expect(unit.defence[target], `${key} ohne Verteidigungswert gegen ${target}`).toBeTypeOf('number')
      }
    }
  })

  it('deckt alle fuenf Einheitenklassen ab', () => {
    const classes = new Set(Object.values(defaultRules().units).map((unit) => unit.class))
    expect([...classes].sort()).toEqual(['air', 'armor', 'artillery', 'infantry', 'navy'])
  })

  it('verlangt fuer jede Einheit ein existierendes Gebaeude', () => {
    const rules = defaultRules()
    for (const [key, unit] of Object.entries(rules.units)) {
      expect(rules.buildings[unit.requiresBuilding], `${key} braucht ein unbekanntes Gebäude`).toBeDefined()
    }
  })

  it('gibt Fernwaffen eine Reichweite und Transportern eine Kapazitaet', () => {
    const rules = defaultRules()
    expect(rules.units['artillery']!.rangeProvinces).toBeGreaterThanOrEqual(1)
    expect(rules.units['transport']!.transportCapacity).toBeGreaterThanOrEqual(1)
  })
})

describe('R-PROV-02 Gebaeude', () => {
  it('kennt die sieben Gebaeudearten mit Kosten und Bauzeit', () => {
    const rules = defaultRules()
    for (const [key, building] of Object.entries(rules.buildings)) {
      expect(building.buildTicks, `${key} ohne Bauzeit`).toBeGreaterThan(0)
      expect(Object.keys(building.cost).length, `${key} ohne Kosten`).toBeGreaterThan(0)
      expect(building.maxLevel).toBeGreaterThanOrEqual(1)
    }
  })

  it('bindet Werft und Hafen an die Kueste', () => {
    const rules = defaultRules()
    expect(rules.buildings.harbour.requiresCoastal).toBe(true)
    expect(rules.buildings.shipyard.requiresCoastal).toBe(true)
    expect(rules.buildings.shipyard.requiresBuilding).toBe('harbour')
  })
})

describe('R-ECON-01 Fehlerhafte Regelwerke werden abgewiesen', () => {
  it('erkennt eine unbekannte Ressource', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        ;(raw.resources as { resources: Record<string, unknown> }).resources['unobtainium'] = {
          name: 'X',
          startAmount: 1,
          storageLimit: 1,
          basePrice: 1,
        }
      }),
    )
    expect(problems.join('\n')).toMatch(/unbekannte Ressource/)
  })

  it('erkennt ein unbekanntes Gebaeude', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        ;(raw.buildings as { buildings: Record<string, unknown> }).buildings['bunker'] = { name: 'Bunker' }
      }),
    )
    expect(problems.join('\n')).toMatch(/unbekanntes Gebäude/)
  })

  it('erkennt einen fehlenden Kampfwert', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        const units = (raw.units as { units: Record<string, { attack: Record<string, unknown> }> }).units
        delete units['infantry']!.attack['armor']
      }),
    )
    expect(problems.join('\n')).toMatch(/Angriffswert gegen "armor" fehlt/)
  })

  it('erkennt eine Einheit ohne gueltiges Gebaeude', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        const units = (raw.units as { units: Record<string, { requiresBuilding: string }> }).units
        units['infantry']!.requiresBuilding = 'zeltlager'
      }),
    )
    expect(problems.join('\n')).toMatch(/unbekanntes Gebäude "zeltlager"/)
  })

  it('erkennt eine fehlende Konstante', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        delete (raw.constants as Record<string, unknown>)['battleRate']
      }),
    )
    expect(problems.join('\n')).toMatch(/battleRate/)
  })

  it('erkennt KI-Gewichte, die sich nicht auf 1000 summieren', () => {
    // Normalised weights are what make the utility terms comparable at all (D8).
    const problems = problemsOf(
      withBreak((raw) => {
        const ai = raw.ai as { difficulties: Record<string, Record<string, number>> }
        ai.difficulties['normal']!['economy'] = 500
      }),
    )
    expect(problems.join('\n')).toMatch(/summieren sich auf/)
  })

  it('erkennt eine ungueltige Kostenangabe', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        const units = (raw.units as { units: Record<string, { cost: Record<string, unknown> }> }).units
        units['tank']!.cost['iron'] = -5
      }),
    )
    expect(problems.join('\n')).toMatch(/keine gültige Menge/)
  })

  it('sammelt mehrere Probleme in einer Meldung', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        delete (raw.constants as Record<string, unknown>)['battleRate']
        delete (raw.constants as Record<string, unknown>)['minDamage']
      }),
    )
    expect(problems.length).toBeGreaterThanOrEqual(2)
  })
})

/**
 * Die Marken der Zwischenziele sind Regeldaten (T-M35-02, D31.2).
 *
 * Eine Marke im Code waere eine Zahl ohne Status (D-08) — und genau die Zahl, die jemand
 * spaeter verschieben will. Fehlt sie im Regelwerk, darf der Lader nicht still `undefined`
 * einsetzen: `stand >= undefined` ist immer `false`, und das Ziel waere unerreichbar, ohne
 * dass es jemand merkt.
 */
describe('R-GAME-08/AK4 Der Lader verlangt die vier Marken der Zwischenziele', () => {
  const GOAL_CONSTANTS = [
    'goalProvinces',
    'goalPointShareFirstPermille',
    'goalPopulationSharePermille',
    'goalPointShareSecondPermille',
  ] as const

  it.each(GOAL_CONSTANTS)('lehnt ein Regelwerk ohne "%s" ab', (key) => {
    const problems = problemsOf(
      withBreak((raw) => {
        delete (raw.constants as Record<string, unknown>)[key]
      }),
    )
    expect(problems.join('\n')).toContain(`Konstante "${key}" fehlt`)
  })

  it('traegt die entschiedenen Werte 25, 400, 350 und 600 (DECISIONS.md, 2026-09-13)', () => {
    // Die Bevoelkerungsmarke stand bis T-M35-06 auf 300: in der Vollpartie mit Startzahl 1914
    // erreichte der Sieger sie drei Tage VOR der ersten Punktmarke (R-GAME-08/AK6).
    const { constants } = defaultRules()
    expect(GOAL_CONSTANTS.map((key) => constants[key])).toEqual([25, 400, 350, 600])
  })
})

/** Die Spionagezahlen der KI (T-M17-12, D29.8): fehlt eine, waere das Budget NaN und die KI wuerbe nie an. */
describe('R-AI-09 Der Lader verlangt die Spionagezahlen der KI', () => {
  const KEYS = ['espionageBudgetPermille', 'espionageCounterGrievance', 'espionageMoneyHorizonDays'] as const
  it.each(KEYS)('lehnt ein Regelwerk ohne "%s" ab', (key) => {
    const problems = problemsOf(
      withBreak((raw) => {
        delete (raw.ai as Record<string, unknown>)[key]
      }),
    )
    expect(problems.join('\n')).toContain(`"${key}"`)
  })
  it('lehnt einen negativen Wert ab', () => {
    const problems = problemsOf(
      withBreak((raw) => {
        ;(raw.ai as Record<string, unknown>)['espionageBudgetPermille'] = -1
      }),
    )
    expect(problems.join('\n')).toContain('"espionageBudgetPermille"')
  })
  it('traegt die Werte 150, 150 und 3 (BALANCING.md, T-M17-12)', () => {
    const { ai } = defaultRules()
    expect([ai.espionageBudgetPermille, ai.espionageCounterGrievance, ai.espionageMoneyHorizonDays]).toEqual([
      150, 150, 3,
    ])
  })
})
