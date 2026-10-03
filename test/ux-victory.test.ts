import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as core from '@worldwar/core'
import type { MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { DEFAULT_NEW_GAME, startGame } from '../apps/desktop/src/game/newGame'
import { grantUntilVictory } from '../scripts/lib/ux-victory.mjs'

/**
 * R-UX-05/AK4, T-M44-02 (Befund B-22): ein Siegstand, der die Bedingung wirklich erfüllt.
 *
 * Gefahren wird die Funktion, die `scripts/ux-capture.mjs` in die Seite schickt — gegen den echten
 * Kern und die echte Weltkarte, nicht gegen eine erfundene Lage. Gegenprobe: der Stand, aus dem sie
 * kopiert, ist vorher **nicht** entschieden; ein Stand mit bloß gesetztem `winner` (die Aufnahme von
 * T-M44-01) erfüllt die Bedingung nicht.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const rules = TEST_RULES
const state = startGame({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', seed: 7, victory: 'points' }, map, rules)
const humanId = Object.values(state.players).find((p) => p.kind === 'human')!.id
const otherId = Object.keys(state.players).find((id) => id !== humanId)!

describe('R-UX-05/AK4 ux-victory: der Siegstand erfüllt die Bedingung wirklich (T-M44-02)', () => {
  it('der Ausgangsstand ist nicht entschieden und der Mensch weit unter dem Ziel', () => {
    expect(core.checkVictory(state, rules).winner).toBeNull()
    expect(core.pointShare(state, humanId, rules)).toBeLessThan(state.victory.pointsShareToWin)
  })

  it('gibt dem Menschen so viel Besitz, dass der Kern ihn selbst als Sieger nach Punkten meldet', () => {
    const r = grantUntilVictory(core, rules, state, humanId)
    expect(r.real, 'die Bedingung ist wirklich erfüllt').toBe(true)
    expect(r.moved, 'es wurde Besitz verschoben').toBeGreaterThan(0)
    expect(r.share).toBeGreaterThanOrEqual(state.victory.pointsShareToWin)
    expect(r.goal).toBe(state.victory.pointsShareToWin)
    // Der Kern selbst, nicht die Hilfsfunktion, sagt es:
    expect(core.checkVictory(r.next, rules)).toEqual({ winner: humanId, condition: 'points' })
  })

  it('dasselbe für die Niederlage: eine Gegenmacht erreicht den Anteil durch Besitz', () => {
    const r = grantUntilVictory(core, rules, state, otherId)
    expect(r.real).toBe(true)
    expect(core.checkVictory(r.next, rules).winner).toBe(otherId)
    expect(core.pointShare(r.next, humanId, rules)).toBeLessThan(state.victory.pointsShareToWin)
  })

  it('verändert den Ausgangsstand nicht (Kopie) und fasst nur den Besitz an', () => {
    const before = JSON.stringify(state)
    const r = grantUntilVictory(core, rules, state, humanId)
    expect(JSON.stringify(state), 'der Ausgangsstand bleibt, wie er war').toBe(before)
    const changed = Object.keys(r.next).filter((key) => JSON.stringify((r.next as Record<string, unknown>)[key]) !== JSON.stringify((state as unknown as Record<string, unknown>)[key]))
    expect(changed, 'außer den Provinzen ändert sich nichts').toEqual(['provinces'])
  })

  it('Gegenprobe: ein bloß gesetztes winner (Fassung von T-M44-01) erfüllt die Bedingung nicht', () => {
    const fake = structuredClone(state)
    fake.victory.winner = humanId
    expect(core.checkVictory(fake, rules).winner, 'der Kern sieht dort keinen Sieger').toBeNull()
    expect(core.pointShare(fake, humanId, rules)).toBeLessThan(fake.victory.pointsShareToWin)
  })

  it('der versiegelte Stand lässt sich laden wie jeder andere (serialise → deserialise)', () => {
    const r = grantUntilVictory(core, rules, state, humanId)
    r.next.victory.winner = humanId
    r.next.victory.condition = 'points'
    const loaded = core.deserialise(core.serialise(r.next))
    expect(loaded.victory.winner).toBe(humanId)
    expect(core.checkVictory(loaded, rules).winner).toBe(humanId)
  })
})
