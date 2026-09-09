import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Benannte Dinge tragen ehrliche Namen (T-M23-03, R-MAP-01, DECISIONS.md 2026-09-07).
 *
 * `AUS-SE` hiess „Suedostaustralien" und bestand aus dem Hauptstadtterritorium,
 * Jervis Bay und der Macquarie-Insel — der Name log. Der Zuschnitt bleibt, die
 * Anreicherung wird nicht neu gewuerfelt; nur der Name wird ehrlich.
 *
 * Gebunden wird die ganze Kette: `world.json` ist ein Bauprodukt (build-map.mjs), die
 * Namensquelle ist `data/mapgen/merge-rules.json`, dazwischen liegt
 * `world-shapes.json`. Stuende der neue Name nur im Produkt, brächte der naechste
 * Kartenneubau den alten zurueck — genau diese Drift prueft der dritte Test.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const lies = (pfad: string) => JSON.parse(readFileSync(`${ROOT}/${pfad}`, 'utf8'))

const NAME = 'Australisches Hauptstadtterritorium'

describe('R-MAP-01 AUS-SE traegt einen ehrlichen Namen', () => {
  const world = lies('data/maps/world.json') as {
    provinces: { id: string; name: string; population: number; deposits: Record<string, number>; polygons: unknown[] }[]
  }
  const ausSe = world.provinces.find((province) => province.id === 'AUS-SE')

  it('heisst Australisches Hauptstadtterritorium, nicht Suedostaustralien', () => {
    expect(ausSe, 'AUS-SE fehlt in world.json').toBeDefined()
    expect(ausSe!.name).toBe(NAME)
    expect(world.provinces.some((province) => province.name === 'Südostaustralien')).toBe(false)
  })

  it('behaelt Zuschnitt und Werte — nur der Name aendert sich', () => {
    // Die Zahlen der Anreicherung vom Stand vor der Umbenennung (kein Neuwuerfeln).
    expect(ausSe!.population).toBe(52_097)
    expect(ausSe!.deposits).toEqual({ food: 623, coal: 223 })
    expect(ausSe!.polygons).toHaveLength(3)
  })

  it('traegt den Namen auch in der Bauquelle — sonst driftet der naechste Neubau zurueck', () => {
    const rules = readFileSync(`${ROOT}/data/mapgen/merge-rules.json`, 'utf8')
    expect(rules, 'merge-rules.json nennt den neuen Namen nicht').toContain(NAME)
    expect(rules).not.toContain('Südostaustralien')

    const shapes = lies('data/maps/world-shapes.json') as { provinces: { id: string; name: string }[] }
    expect(shapes.provinces.find((province) => province.id === 'AUS-SE')?.name).toBe(NAME)
  })
})
