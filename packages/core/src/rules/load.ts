import { RESOURCE_KEYS, type BuildingKey, type ResourceKey, type UnitClass } from '../state/types'
import type {
  AiRules,
  BuildingRule,
  RawRules,
  ResourceRule,
  RuleConstants,
  Rules,
  UnitRule,
} from './types'

/**
 * Parses and validates balancing data (T-M3-01).
 *
 * Reading files is the caller's business — the core takes objects, so it stays free of
 * I/O (R-ARCH-01). What happens here is the checking: a typo in a balancing file must
 * fail at load time with a readable message, not surface three hours later as an army
 * that costs nothing.
 */

export class RulesError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Regelwerk ist ungültig (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join('\n'))
    this.name = 'RulesError'
  }
}

const UNIT_CLASSES: readonly UnitClass[] = ['infantry', 'armor', 'artillery', 'air', 'navy']

const BUILDING_KEYS: readonly BuildingKey[] = [
  'barracks',
  'fortress',
  'factory',
  'shipyard',
  'airfield',
  'railway',
  'harbour',
]

const REQUIRED_CONSTANTS: readonly (keyof RuleConstants)[] = [
  'ticksPerDay',
  'startMorale',
  'capturedMorale',
  'baseTargetMorale',
  'moraleDriftDivisor',
  'productionMoraleFloor',
  'taxPerThousandPopulationPerTick',
  'revoltThreshold',
  'revoltChancePerPointPermille',
  'capitalDistancePenalty',
  'capitalDistanceRange',
  'expansionFreeProvinces',
  'expansionPenaltyPerProvince',
  'battleRate',
  'minDamage',
  'defenceCap',
  'stackFullContribution',
  'stackZeroContribution',
  'deployDelayTicks',
  'retreatLossPermille',
  'retreatCooldownTicks',
  'bombardFactor',
  'regenPermillePerTick',
  'railwayFactor',
  'embarkTicks',
  'disembarkTicks',
  'maxBuildSlotsCity',
  'maxBuildSlotsRural',
  'capitalMoveCooldownDays',
  'warDeclarationDelayTicks',
  'marketElasticity',
  'scoreProvince',
]

function record(value: unknown): Record<string, unknown> {
  return (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
}

/** Amounts must be whole numbers of known resources — a stray key is a typo, not data. */
function checkAmounts(
  amounts: unknown,
  where: string,
  problems: string[],
): Partial<Record<ResourceKey, number>> {
  const result: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(record(amounts))) {
    if (!RESOURCE_KEYS.includes(key as ResourceKey)) {
      problems.push(`${where}: unbekannte Ressource "${key}"`)
      continue
    }
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
      problems.push(`${where}: "${key}" ist keine gültige Menge (${String(value)})`)
      continue
    }
    result[key as ResourceKey] = value as number
  }
  return result
}

export function parseRules(raw: RawRules, id: string): Rules {
  const problems: string[] = []

  // --- constants -----------------------------------------------------------
  const constants = record(raw.constants) as unknown as RuleConstants
  for (const key of REQUIRED_CONSTANTS) {
    if (typeof (constants as unknown as Record<string, unknown>)[key] !== 'number') {
      problems.push(`Konstante "${String(key)}" fehlt oder ist keine Zahl`)
    }
  }
  if (constants.ticksPerDay <= 0) problems.push('ticksPerDay muss positiv sein')
  if (constants.moraleDriftDivisor <= 0) problems.push('moraleDriftDivisor muss positiv sein')
  if (constants.stackFullContribution >= constants.stackZeroContribution) {
    problems.push('stackFullContribution muss kleiner als stackZeroContribution sein')
  }

  // --- resources -----------------------------------------------------------
  const resourcesRaw = record(record(raw.resources)['resources'])
  const resources = {} as Record<ResourceKey, ResourceRule>
  for (const key of Object.keys(resourcesRaw)) {
    if (!RESOURCE_KEYS.includes(key as ResourceKey)) {
      problems.push(`Regelwerk kennt eine unbekannte Ressource: "${key}"`)
    }
  }
  for (const key of RESOURCE_KEYS) {
    const entry = record(resourcesRaw[key])
    if (Object.keys(entry).length === 0) {
      problems.push(`Ressource "${key}" fehlt im Regelwerk`)
      continue
    }
    resources[key] = {
      name: String(entry['name'] ?? key),
      startAmount: Number(entry['startAmount'] ?? 0),
      storageLimit: entry['storageLimit'] === null ? null : Number(entry['storageLimit']),
      basePrice: Number(entry['basePrice'] ?? 1000),
    }
  }

  // --- buildings -----------------------------------------------------------
  const buildingsRaw = record(record(raw.buildings)['buildings'])
  const buildings = {} as Record<BuildingKey, BuildingRule>
  for (const key of Object.keys(buildingsRaw)) {
    if (!BUILDING_KEYS.includes(key as BuildingKey)) {
      problems.push(`Regelwerk kennt ein unbekanntes Gebäude: "${key}"`)
    }
  }
  for (const key of BUILDING_KEYS) {
    const entry = record(buildingsRaw[key])
    if (Object.keys(entry).length === 0) {
      problems.push(`Gebäude "${key}" fehlt im Regelwerk`)
      continue
    }
    const where = `Gebäude "${key}"`
    const maxLevel = Number(entry['maxLevel'])
    if (!Number.isSafeInteger(maxLevel) || maxLevel < 1) problems.push(`${where}: maxLevel ungültig`)
    const buildTicks = Number(entry['buildTicks'])
    if (!Number.isSafeInteger(buildTicks) || buildTicks < 1) problems.push(`${where}: buildTicks ungültig`)

    const requires = entry['requiresBuilding'] as BuildingKey | undefined
    if (requires !== undefined && !BUILDING_KEYS.includes(requires)) {
      problems.push(`${where}: verweist auf unbekanntes Gebäude "${String(requires)}"`)
    }

    const classes = Array.isArray(entry['allowsUnitClasses']) ? (entry['allowsUnitClasses'] as string[]) : []
    for (const unitClass of classes) {
      if (!UNIT_CLASSES.includes(unitClass as UnitClass)) {
        problems.push(`${where}: unbekannte Einheitenklasse "${unitClass}"`)
      }
    }

    buildings[key] = {
      name: String(entry['name'] ?? key),
      maxLevel,
      cost: checkAmounts(entry['cost'], `${where} (Kosten)`, problems),
      buildTicks,
      ...(entry['requiresCoastal'] === true ? { requiresCoastal: true } : {}),
      ...(requires ? { requiresBuilding: requires } : {}),
      allowsUnitClasses: classes as UnitClass[],
      moraleBonus: Number(entry['moraleBonus'] ?? 0),
      effects: record(entry['effects']),
    }
  }

  // --- units ---------------------------------------------------------------
  const unitsRaw = record(record(raw.units)['units'])
  const units: Record<string, UnitRule> = {}
  for (const [key, value] of Object.entries(unitsRaw)) {
    const entry = record(value)
    const where = `Einheit "${key}"`

    const unitClass = entry['class'] as UnitClass
    if (!UNIT_CLASSES.includes(unitClass)) {
      problems.push(`${where}: unbekannte Klasse "${String(unitClass)}"`)
    }

    const requires = entry['requiresBuilding'] as BuildingKey
    if (!BUILDING_KEYS.includes(requires)) {
      problems.push(`${where}: verweist auf unbekanntes Gebäude "${String(requires)}"`)
    }

    // Every unit needs values against every class — a missing entry would silently
    // mean "does no damage to tanks" and only show up in a lost battle.
    const attack = record(entry['attack'])
    const defence = record(entry['defence'])
    for (const target of UNIT_CLASSES) {
      if (typeof attack[target] !== 'number') problems.push(`${where}: Angriffswert gegen "${target}" fehlt`)
      if (typeof defence[target] !== 'number') problems.push(`${where}: Verteidigungswert gegen "${target}" fehlt`)
    }

    const hpPerUnit = Number(entry['hpPerUnit'])
    if (!Number.isSafeInteger(hpPerUnit) || hpPerUnit <= 0) problems.push(`${where}: hpPerUnit ungültig`)
    const speedKmh = Number(entry['speedKmh'])
    if (!Number.isSafeInteger(speedKmh) || speedKmh <= 0) problems.push(`${where}: speedKmh ungültig`)

    units[key] = {
      name: String(entry['name'] ?? key),
      class: unitClass,
      cost: checkAmounts(entry['cost'], `${where} (Kosten)`, problems),
      buildTicks: Number(entry['buildTicks'] ?? 1),
      requiresBuilding: requires,
      ...(entry['requiresBuildingLevel'] !== undefined
        ? { requiresBuildingLevel: Number(entry['requiresBuildingLevel']) }
        : {}),
      hpPerUnit,
      speedKmh,
      ...(entry['rangeProvinces'] !== undefined ? { rangeProvinces: Number(entry['rangeProvinces']) } : {}),
      ...(entry['transportCapacity'] !== undefined
        ? { transportCapacity: Number(entry['transportCapacity']) }
        : {}),
      upkeep: checkAmounts(entry['upkeep'], `${where} (Unterhalt)`, problems),
      attack: attack as Record<UnitClass, number>,
      defence: defence as Record<UnitClass, number>,
    }
  }
  if (Object.keys(units).length === 0) problems.push('Das Regelwerk enthält keine Einheiten')

  // --- ai ------------------------------------------------------------------
  const aiRaw = record(raw.ai)
  const difficulties = record(aiRaw['difficulties'])
  for (const level of ['easy', 'normal', 'hard'] as const) {
    const entry = record(difficulties[level])
    if (Object.keys(entry).length === 0) {
      problems.push(`KI-Stufe "${level}" fehlt`)
      continue
    }
    const weights = ['economy', 'position', 'defence', 'distance', 'weakness'] as const
    const sum = weights.reduce((total, key) => total + Number(entry[key] ?? 0), 0)
    if (sum !== 1000) {
      // Normalised weights are what keep the terms comparable at all (design D8).
      problems.push(`KI-Stufe "${level}": Gewichte summieren sich auf ${sum}, erwartet 1000`)
    }
  }
  const ai = aiRaw as unknown as AiRules

  if (problems.length > 0) throw new RulesError(problems)

  const startResources = {} as Record<ResourceKey, number>
  const storageLimits = {} as Record<ResourceKey, number | null>
  for (const key of RESOURCE_KEYS) {
    startResources[key] = resources[key].startAmount
    storageLimits[key] = resources[key].storageLimit
  }

  return { id, resources, buildings, units, ai, constants, startResources, storageLimits }
}
