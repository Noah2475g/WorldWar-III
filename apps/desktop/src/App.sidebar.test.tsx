// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { MapData } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { TUTORIAL_TARGETS } from './game/tutorial.ts'
import { SIDE_LAST_AREA_KEY } from './ui/Rail.tsx'

/**
 * Seitenleiste v3b E3 (D5–D8, D27–D29) in der ganzen App: Taste W, Escape mit Fokus zurueck, der
 * zuletzt offene Bereich, kein Fuss mehr, die neuen Tutorial-Ziele im DOM (K11, K12).
 */
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

const testworld = JSON.parse(readFileSync(`${process.cwd()}/data/maps/testworld.json`, 'utf8')) as MapData
const world = JSON.parse(readFileSync(`${process.cwd()}/data/maps/world.json`, 'utf8')) as MapData
const start = (map: MapData = testworld) => {
  render(<App map={map} rules={TEST_RULES} maps={[{ id: 'testworld', name: 'Kleine Welt', data: testworld }]} skipTutorial />)
  fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
}
const side = () => document.querySelector('aside.side')!
const key = (k: string) => act(() => void fireEvent.keyDown(window, { key: k }))

describe('E3 Seitenleiste in der App', () => {
  it('startet zu, ohne Fuss; die Leiste rechts hat sieben Bereiche', () => {
    start()
    expect(side().getAttribute('data-open')).toBe('false')
    expect(document.querySelector('footer.foot, .foot')).toBeNull()
    expect(document.querySelectorAll('nav.rail .rail__item[data-area]')).toHaveLength(7)
    expect(document.querySelector('.app')!.getAttribute('data-side-open')).toBe('false')
  }, 30_000)

  it('W oeffnet den zuletzt offenen Bereich (frisch: Diplomatie), W und Escape schliessen', () => {
    start()
    key('w')
    expect(side().getAttribute('data-open')).toBe('true')
    expect(document.querySelector('.rail__item[data-area="diplomacy"]')!.getAttribute('aria-pressed')).toBe('true')
    key('W')
    expect(side().getAttribute('data-open')).toBe('false')

    fireEvent.click(document.querySelector('.rail__item[data-area="log"]')!)
    expect(window.localStorage.getItem(SIDE_LAST_AREA_KEY)).toBe('log')
    key('Escape')
    expect(side().getAttribute('data-open')).toBe('false')
    key('w')
    expect(document.querySelector('.rail__item[data-area="log"]')!.getAttribute('aria-pressed')).toBe('true')
  }, 30_000)

  it('D/H/A/S/L oeffnen ihren Bereich; Escape schliesst und gibt dem Ausloeser den Fokus zurueck', () => {
    start()
    for (const [k, area] of [
      ['d', 'diplomacy'],
      ['h', 'market'],
      ['a', 'armies'],
      ['s', 'espionage'],
      ['l', 'standings'],
    ] as const) {
      key(k)
      expect(document.querySelector(`.rail__item[data-area="${area}"]`)!.getAttribute('aria-pressed'), k).toBe('true')
    }
    key('Escape')

    const market = document.querySelector<HTMLButtonElement>('.rail__item[data-area="market"]')!
    market.focus()
    fireEvent.click(market)
    expect(side().getAttribute('data-open')).toBe('true')
    expect(side().querySelector('.side__title')?.textContent).toBe('Markt')
    key('Escape')
    expect(side().getAttribute('data-open')).toBe('false')
    expect(document.activeElement).toBe(market)
  }, 30_000)

  it('ein zweiter Klick auf denselben Bereich schliesst; das × im Kopf ebenso', () => {
    start()
    const economy = document.querySelector<HTMLButtonElement>('.rail__item[data-area="economy"]')!
    fireEvent.click(economy)
    expect(screen.getByRole('region', { name: 'Wirtschaft' })).toBeTruthy()
    fireEvent.click(economy)
    expect(side().getAttribute('data-open')).toBe('false')
    fireEvent.click(economy)
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(side().getAttribute('data-open')).toBe('false')
  }, 30_000)

  it('jedes Tutorial-Ziel mit Element steht im DOM der Partie (K12)', () => {
    start()
    for (const [step, selector] of Object.entries(TUTORIAL_TARGETS)) {
      if (!selector || selector.startsWith('.side .panel')) continue
      expect(document.querySelector(selector), `${step}: ${selector}`).not.toBeNull()
    }
    expect(TUTORIAL_TARGETS.events).toBe('.rail__item[data-area="log"]')
    expect(TUTORIAL_TARGETS.fastForward).toBe('.clock .speed--fast')
  }, 30_000)

  it('die Werkzeug-Spalte zeigt die Zoomstufe der Karte und setzt sie per Klick', () => {
    start(world)
    const wrapper = document.querySelector('.map-wrapper')!
    fireEvent.click(document.querySelector('.map-tier[data-tier="far"]')!)
    expect(wrapper.getAttribute('data-zoom-tier')).toBe('far')
    expect(document.querySelector('.map-tier[data-tier="far"]')!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(document.querySelector('.map-tier[data-tier="near"]')!)
    expect(wrapper.getAttribute('data-zoom-tier')).toBe('near')
  }, 30_000)
})
