import { describe, expect, it } from 'vitest'
import type { PublicView } from '@worldwar/core'
import { hopDistance, landReachable } from './targeting'

/**
 * Wohin eine Landarmee überhaupt kommt (T-M14-11, Ursache D des Audits).
 *
 * `hopDistance` zählt `seaLinks` mit — für die Frage „wie weit ist das weg" ist das
 * richtig, für die Frage „kann ich dort hinmarschieren" ist es falsch. Die KI benutzte
 * es für beides. Gemessen: **3046 von 4464 Marschbefehlen endeten mit `NO_PATH`**, und
 * weil sie denselben unmöglichen Befehl in jedem Tick neu fasste, wiederholte sie ihn bis
 * zum Partieende. Inselmächte standen die ganze Partie still.
 */

/** Zwei Landmassen, verbunden nur über einen Seeweg. */
function inselwelt(): PublicView {
  const province = (id: string, neighbors: string[], seaLinks: string[] = []) => ({
    id,
    name: id,
    owner: 'p2' as const,
    neighbors,
    seaLinks,
    terrain: 'plain' as const,
    morale: 50_000,
    population: 100_000,
    buildings: {},
    deposits: {},
    visible: true,
  })

  return {
    provinces: [
      province('heimat', ['nachbar'], ['insel']),
      province('nachbar', ['heimat']),
      province('insel', [], ['heimat']),
    ],
  } as unknown as PublicView
}

describe('R-AI-03 Die KI erkennt, was sie zu Fuss erreicht', () => {
  it('zaehlt einen Seeweg als Entfernung', () => {
    // hopDistance bleibt, wie es ist: als Mass fuer 'wie weit ist das weg' stimmt es.
    expect(hopDistance(inselwelt(), 'heimat', 'insel')).toBe(1)
  })

  it('nimmt die Insel nicht in die Landerreichbarkeit auf', () => {
    const erreichbar = landReachable(inselwelt(), 'heimat')
    expect(erreichbar.has('nachbar')).toBe(true)
    expect(erreichbar.has('insel'), 'eine Landarmee marschiert nicht ueber das Meer').toBe(false)
  })

  it('zaehlt den Ausgangspunkt mit', () => {
    expect(landReachable(inselwelt(), 'heimat').has('heimat')).toBe(true)
  })

  it('kommt mit einer Provinz ohne Landnachbarn zurecht', () => {
    const erreichbar = landReachable(inselwelt(), 'insel')
    expect([...erreichbar]).toEqual(['insel'])
  })
})
