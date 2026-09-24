// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { toScreen, type View } from './map/picking.ts'

/**
 * Die Karte zentriert im Ausschnitt, den sie wirklich hat (Touch-Bedienung).
 *
 * App.tsx rechnete Sprung, Tastaturzoom und den Blick auf die Hauptstadt beim Anlegen mit
 * einem festen Ausschnitt von 960 x 600. Auf einem Telefon im Querformat ist die Karte
 * einige hundert Punkte breit: die angesprungene Provinz lag bei (480, 300) — neben der
 * sichtbaren Karte, und ein Testroboter, der nach dem Sprung ein Bild nimmt, fand sie
 * nicht. jsdom misst die Karte mit ihrem Mindestmass von 320 x 240; das ist hier der
 * kleine Bildschirm.
 *
 * Gelesen wird der Ausschnitt dort, wo ihn auch der Roboter liest: an den
 * data-Attributen der Kartenhuelle.
 */

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const maps = [{ id: 'world', name: 'Welt', data: world }]

/** Die Rueckrufe der ResizeObserver: der Test entscheidet, wann die Karte neu misst. */
let messungen: (() => void)[] = []

beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      messungen.push(callback)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})

afterEach(() => {
  cleanup()
  messungen = []
})

/** Die Kartenmasse in jsdom: das Mindestmass von MapCanvas. */
const KARTE = { width: 320, height: 240 }

/** Die Huelle waechst (Drehen des Geraets, Adresszeile weg) und die Karte misst neu. */
function messe(width: number, height: number): void {
  const huelle = document.querySelector('div.map-wrapper') as HTMLDivElement
  Object.defineProperty(huelle, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(huelle, 'clientHeight', { configurable: true, value: height })
  act(() => {
    for (const messung of messungen) messung()
  })
}

function ausschnitt(): View {
  const huelle = document.querySelector('div.map-wrapper') as HTMLDivElement
  return {
    x: Number(huelle.dataset.viewX),
    y: Number(huelle.dataset.viewY),
    scale: Number(huelle.dataset.viewScale),
  }
}

function mitteVon(provinceId: string): { x: number; y: number } {
  const province = world.provinces.find((candidate) => candidate.id === provinceId)
  expect(province, `Provinz ${provinceId} fehlt in der Karte`).toBeDefined()
  return province!.center
}

/** Liegt der Punkt in der sichtbaren Karte — und, wo kein Rand klemmt, in ihrer Mitte? */
function sichtbar(point: { x: number; y: number }, karte = KARTE): void {
  expect(point.x).toBeGreaterThanOrEqual(0)
  expect(point.x).toBeLessThanOrEqual(karte.width)
  expect(point.y).toBeGreaterThanOrEqual(0)
  expect(point.y).toBeLessThanOrEqual(karte.height)
  // Die Attribute runden auf ganze Karteneinheiten; bei Massstab 1,6 ist das unter einem Punkt.
  expect(Math.abs(point.x - karte.width / 2)).toBeLessThan(2)
  expect(Math.abs(point.y - karte.height / 2)).toBeLessThan(2)
}

function anlegen(): { x: number; y: number } {
  render(<App map={world} rules={TEST_RULES} maps={maps} skipTutorial />)
  fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
  const vorher = ausschnitt()
  // Pos1 springt auf die Hauptstadt und waehlt sie aus — so erfaehrt der Test, welche es ist.
  fireEvent.keyDown(window, { key: 'Home' })
  const hauptstadt = (document.querySelector('div.map-wrapper') as HTMLDivElement).dataset.selectedProvince
  expect(hauptstadt).toBeTruthy()
  // Der Sprung aendert an einem schon zentrierten Blick nichts.
  expect(ausschnitt()).toEqual(vorher)
  return mitteVon(hauptstadt!)
}

describe('Touch-Bedienung: Zentrieren im gemessenen Ausschnitt der Karte', () => {
  it('legt die eigene Hauptstadt beim Anlegen und beim Sprung in die Mitte der kleinen Karte', () => {
    // Beim Anlegen gab es die Karte noch nicht: der Blick wird nach ihrer ersten Messung
    // nachgezogen. `anlegen` prueft auch, dass der Sprung danach nichts mehr verschiebt.
    const hauptstadt = anlegen()

    sichtbar(toScreen(hauptstadt, ausschnitt()))
  })

  it('zoomt mit der Tastatur um die Mitte der kleinen Karte', () => {
    const hauptstadt = anlegen()

    fireEvent.keyDown(window, { key: 'PageUp' })

    // Um die Mitte gezoomt, bleibt die Hauptstadt in der Mitte.
    const nachher = ausschnitt()
    expect(nachher.scale).toBeLessThan(1.6)
    sichtbar(toScreen(hauptstadt, nachher))
  })

  it('zieht den Blick nach, wenn die Karte waechst, solange niemand sie bewegt hat', () => {
    const hauptstadt = anlegen()

    messe(700, 400)

    sichtbar(toScreen(hauptstadt, ausschnitt()), { width: 700, height: 400 })
  })

  it('reisst den Spieler nicht zurueck, nachdem er die Karte bewegt hat', () => {
    anlegen()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const bewegt = ausschnitt()

    messe(700, 400)

    expect(ausschnitt()).toEqual(bewegt)
  })
})
