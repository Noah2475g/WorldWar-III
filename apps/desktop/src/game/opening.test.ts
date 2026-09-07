import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDuration, recruitDuration, type Rules } from '@worldwar/core'
import { firstUnitAt } from './opening.ts'

/**
 * Wie lange die Eröffnung dauert (T-M21-03).
 *
 * Die Zahl steht in keinem Satz — deshalb braucht sie hier eine Prüfung, die sie gegen
 * die ausgelieferten Regeln hält. Ändert jemand eine Bauzeit oder die Moralskalierung,
 * ändert sich der Satz in der Führung mit, und dieser Test sagt, um wie viel.
 */

const rules = JSON.parse(
  JSON.stringify({
    constants: JSON.parse(readFileSync('data/rules/default/constants.json', 'utf8')),
    buildings: JSON.parse(readFileSync('data/rules/default/buildings.json', 'utf8')).buildings,
    units: JSON.parse(readFileSync('data/rules/default/units.json', 'utf8')).units,
  }),
) as Rules

describe('R-UI-05 Die Eroeffnung dauert, und die Fuehrung sagt wie lange', () => {
  it('rechnet Kaserne und Infanterie nacheinander, mit Moralskalierung', () => {
    const morale = rules.constants.startMorale
    // Zwei verschiedene Kurven: bauen normiert auf 80 000 Moral, ausheben auf 100 000.
    const kaserne = buildDuration(rules.buildings['barracks']!.buildTicks, morale)
    const infanterie = recruitDuration(rules.units['infantry']!.buildTicks, morale)

    expect(firstUnitAt(rules)).toBe(kaserne + infanterie)
  })

  it('liegt bei den ausgelieferten Regeln im zweiten Spieltag', () => {
    // Die Zahl, die den Playtest-Befund vom 2026-09-07 ausgeloest hat. Sie steht hier
    // und nirgends sonst — der Führungstext setzt sie zur Laufzeit ein.
    const ticks = firstUnitAt(rules)
    const tag = Math.floor(ticks / rules.constants.ticksPerDay) + 1

    expect(ticks, 'die Eroeffnung ist nicht mehr so lang wie im Bericht').toBe(43)
    expect(tag).toBe(2)
  })

  it('erfindet keine Zahl, wenn die Regeln das Noetige nicht kennen', () => {
    // Lieber gar keine Auskunft als eine erfundene: eine Partie ohne Kaserne ist eine
    // andere als die, für die der Satz geschrieben ist.
    const ohne = { ...rules, buildings: {} } as unknown as Rules

    expect(firstUnitAt(ohne)).toBe(0)
  })

  it('nimmt fuer die Einheit die Aushebekurve, nicht die Baukurve', () => {
    // Der Fehler, der beim Bauen dieser Funktion tatsaechlich passiert ist: zweimal
    // buildDuration ergibt 41 statt 43, und nichts haette es gemeldet.
    const morale = rules.constants.startMorale
    const zwoelf = rules.units['infantry']!.buildTicks

    expect(recruitDuration(zwoelf, morale), 'ausheben').toBe(16)
    expect(buildDuration(zwoelf, morale), 'bauen').toBe(14)
  })

  it('waechst, wenn die Moral am Start niedriger ist', () => {
    // Die Moralskalierung ist der Grund, warum 24 + 12 Ticks nicht 36 ergeben.
    const schlecht = { ...rules, constants: { ...rules.constants, startMorale: 40_000 } } as Rules

    expect(firstUnitAt(schlecht)).toBeGreaterThan(firstUnitAt(rules))
  })
})
