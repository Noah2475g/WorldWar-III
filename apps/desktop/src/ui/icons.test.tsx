// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { de } from '../i18n/de.ts'
import {
  BUILDING_ICONS,
  ICON_NAMES,
  ICON_PATHS,
  Icon,
  RELATION_ICONS,
  RESOURCE_ICONS,
  TERRAIN_ICONS,
  UNIT_ICONS,
} from './icons.tsx'

/** The rules as they are shipped — the set has to cover those, not a test fixture. */
const ROOT = process.cwd()
const rulesFile = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8')) as Record<string, unknown>

/**
 * The icon set (T-M11-01, R-ASSET-01).
 *
 * What matters is completeness and provenance: every unit and every building the rules
 * define needs a symbol, and every symbol is drawn here rather than taken from
 * somewhere. Nothing in this file came from anyone else.
 */

afterEach(cleanup)

describe('R-UI-04 Icons', () => {
  it('zeichnet jedes Icon', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />)
      const path = container.querySelector('path')
      expect(path?.getAttribute('d')?.length, name).toBeGreaterThan(10)
      unmount()
    }
  })

  it('bleibt mit jedem Pfad im 24x24-Feld', () => {
    // Alle Zeichen liegen im selben Feld, sonst richten sie sich in einer Zeile nicht
    // aneinander aus und eines haengt durch. Geprueft an den Zahlen des Pfades: die
    // Bogenparameter (Radien und Flags) sind hier alle klein genug, um dieselbe Schranke
    // zu vertragen, also braucht es keinen SVG-Parser fuer eine Frage dieser Groesse.
    for (const name of ICON_NAMES) {
      const zahlen = (ICON_PATHS[name].match(/-?d+(.d+)?/g) ?? []).map(Number)
      const groesste = Math.max(...zahlen)
      const kleinste = Math.min(...zahlen)

      expect(groesste, `${name} ragt bis ${groesste} und damit aus dem Feld`).toBeLessThanOrEqual(24)
      expect(kleinste, `${name} beginnt bei ${kleinste} und damit vor dem Feld`).toBeGreaterThanOrEqual(0)
    }
  })

  it('nimmt die Farbe des umgebenden Textes an', () => {
    // So an icon in a warning is the warning's colour without a second asset.
    const { container } = render(<Icon name="battle" />)

    expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('currentColor')
  })

  it('ist ohne Beschriftung fuer Vorleseprogramme unsichtbar', () => {
    // A decorative icon beside its own label would be read out twice.
    const { container } = render(<Icon name="infantry" />)

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('bekommt mit Beschriftung eine Rolle und einen Titel', () => {
    render(<Icon name="battle" title="Gefecht" />)

    expect(screen.getByRole('img', { name: 'Gefecht' })).toBeTruthy()
  })

  it('kennt ein Symbol fuer jede Einheit und jedes Gebaeude', () => {
    for (const [key, icon] of Object.entries(UNIT_ICONS)) {
      expect(ICON_NAMES, `${key} zeigt auf ${icon}`).toContain(icon)
    }
    for (const [key, icon] of Object.entries(BUILDING_ICONS)) {
      expect(ICON_NAMES, `${key} zeigt auf ${icon}`).toContain(icon)
    }
  })
})

describe('R-UI-10 Der Satz deckt die ausgelieferten Regeln', () => {
  // The old set answered to keys the rules never had ("cavalry", "mine") and had no
  // answer for keys they do have ("motorized", "shipyard"). A symbol table that does
  // not match the rules is a table that silently draws nothing.
  it('hat ein Symbol fuer jedes Gebaeude der Regeln', () => {
    const buildings = Object.keys((rulesFile('buildings').buildings ?? {}) as object)

    expect(buildings.length).toBeGreaterThan(5)
    for (const key of buildings) {
      expect(BUILDING_ICONS[key], `Gebaeude "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('hat ein Symbol fuer jede Einheit der Regeln', () => {
    const units = Object.keys((rulesFile('units').units ?? {}) as object)

    expect(units.length).toBeGreaterThan(5)
    for (const key of units) {
      expect(UNIT_ICONS[key], `Einheit "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('hat ein Symbol fuer jeden Rohstoff der Regeln', () => {
    const resources = Object.keys((rulesFile('resources').resources ?? {}) as object)

    expect(resources.length).toBeGreaterThan(5)
    for (const key of resources) {
      expect(RESOURCE_ICONS[key], `Rohstoff "${key}" ohne Symbol`).toBeTruthy()
    }
  })

  it('kennt keinen Schluessel, den die Regeln nicht haben', () => {
    // The other direction, and it matters just as much: a table entry for a unit that
    // does not exist is dead weight that looks like coverage.
    const units = new Set(Object.keys((rulesFile('units').units ?? {}) as object))
    const buildings = new Set(Object.keys((rulesFile('buildings').buildings ?? {}) as object))

    for (const key of Object.keys(UNIT_ICONS)) {
      expect(units.has(key), `"${key}" steht im Symbolsatz, aber nicht in den Regeln`).toBe(true)
    }
    for (const key of Object.keys(BUILDING_ICONS)) {
      expect(buildings.has(key), `"${key}" steht im Symbolsatz, aber nicht in den Regeln`).toBe(true)
    }
  })
it('gibt Gebaeuden und Einheiten nicht dasselbe Zeichen', () => {
    // Playtest-Befund 30: Flugplatz und Jagdflugzeug zeigten beide auf "aircraft". In
    // einer Bauliste sagt ein Gebaeude, das aussieht wie eine Einheit, genau das
    // Falsche. Vorher hielt nichts die beiden Tabellen auseinander — die Kollision war
    // moeglich, ohne dass ein Test zuckte.
    const units = new Map<string, string>()
    for (const [key, icon] of Object.entries(UNIT_ICONS)) units.set(icon, key)

    for (const [key, icon] of Object.entries(BUILDING_ICONS)) {
      expect(
        units.has(icon),
        `Gebaeude "${key}" teilt sich das Zeichen "${icon}" mit der Einheit "${units.get(icon)}"`,
      ).toBe(false)
    }
  })
})

/**
 * Die beiden Saetze, die R-UI-10 und R-UI-11 zusagen und die es bis zum 2026-09-07 nicht
 * gab (T-M20-01).
 *
 * Beide Anforderungen nennen ihren Gegenstand im Text — den Beziehungszustand und die
 * Gelaendeart —, und beide standen als deutsches Wort in der Oberflaeche. Gefangen hat
 * es nichts, weil das Abnahmekriterium zu R-UI-10 nur nach Gebaeude und Einheit fragt:
 * **ein Kriterium, das einen Teil des Versprechens prueft, laesst den Rest erfuellt
 * aussehen.** Dieselbe Bauart wie AK-7 vor dem 2026-09-07.
 *
 * Geprueft wird deshalb gegen die Quellen, nicht gegeneinander: das Gelaende gegen die
 * ausgelieferte Karte, die Beziehungen gegen die Schluessel, unter denen die Sprachdatei
 * sie erklaert.
 */
describe('R-UI-10/R-UI-11 Beziehung und Gelaende haben ein Zeichen', () => {
  it('hat ein Symbol fuer jede Gelaendeart der Weltkarte', () => {
    const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
      provinces: { terrain: string }[]
    }
    const terrains = [...new Set(world.provinces.map((p) => p.terrain))].sort()

    expect(terrains.length, 'die Karte kennt keine Gelaendearten').toBe(5)
    for (const terrain of terrains) {
      expect(TERRAIN_ICONS[terrain as keyof typeof TERRAIN_ICONS], `Gelaende "${terrain}" ohne Symbol`).toBeTruthy()
    }
  })

  it('hat ein Symbol fuer jeden Beziehungszustand, den die Sprachdatei erklaert', () => {
    // `explain.diplomacy` ist die Liste, die dem Spieler versprochen wird. Steht dort
    // etwas, das kein Zeichen hat, faellt es in der Oberflaeche auf ein Wort zurueck.
    const relations = Object.keys(de.explain.diplomacy)

    expect(relations.length, 'die Sprachdatei erklaert keine Beziehungen').toBe(6)
    for (const relation of relations) {
      expect(
        RELATION_ICONS[relation as keyof typeof RELATION_ICONS],
        `Beziehung "${relation}" ohne Symbol`,
      ).toBeTruthy()
    }
  })

  it('zeigt mit jedem der beiden Saetze auf ein Zeichen, das es gibt', () => {
    for (const [key, icon] of Object.entries(TERRAIN_ICONS)) {
      expect(ICON_NAMES, `Gelaende ${key} zeigt auf ${icon}`).toContain(icon)
    }
    for (const [key, icon] of Object.entries(RELATION_ICONS)) {
      expect(ICON_NAMES, `Beziehung ${key} zeigt auf ${icon}`).toContain(icon)
    }
  })

  it('gibt Gelaende und Beziehung nicht dasselbe Zeichen wie einer Einheit', () => {
    // Dieselbe Falle wie bei Flugplatz und Jagdflugzeug (Playtest-Befund 30): ein
    // Gelaende, das aussieht wie eine Einheit, ist auf der Karte die falsche Auskunft.
    const belegt = new Map<string, string>()
    for (const [key, icon] of Object.entries(UNIT_ICONS)) belegt.set(icon, `Einheit ${key}`)
    for (const [key, icon] of Object.entries(BUILDING_ICONS)) belegt.set(icon, `Gebaeude ${key}`)

    for (const [key, icon] of [...Object.entries(TERRAIN_ICONS), ...Object.entries(RELATION_ICONS)]) {
      expect(belegt.has(icon), `"${key}" teilt sich "${icon}" mit ${belegt.get(icon)}`).toBe(false)
    }
  })
})
