// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryStorage, publicView, serialise, type MapData } from '@worldwar/core'
import { TEST_RULES, placeArmy } from '@worldwar/testkit'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { startGame as newState, DEFAULT_NEW_GAME } from './game/newGame.ts'
import { advance } from './game/advance.ts'
import { alertsFor } from './ui/Alerts.tsx'

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const maps = [{ id: 'world', name: 'Welt', provinces: world.provinces.length }]

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})

afterEach(cleanup)

describe('diag DOM', () => {
  it('Kampf in eigener Provinz -> .alerts im DOM?', async () => {
    const nation = world.startPositions[0]!.nation
    let state = newState({ ...DEFAULT_NEW_GAME, nation }, world, TEST_RULES)
    const own = state.provinceOrder.filter((id) => state.provinces[id]!.owner === 'p1')
    console.log('p1 hat', own.length, 'Provinzen; erste:', own[0])
    // Krieg + zwei Armeen in einer eigenen Provinz
    const key = Object.keys(state.diplomacy.relations).find((k) => k === 'p1|p2')
    console.log('relation key', key)
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: own[0]!, units: [{ unitKey: 'infantry', hpTotal: 400_000 }], stance: 'defensive' })
    placeArmy(state, { owner: 'p2', at: own[0]!, units: [{ unitKey: 'infantry', hpTotal: 400_000 }], stance: 'defensive' })
    state = advance(state, 2, { map: world, rules: TEST_RULES })
    console.log('battles im Zustand:', JSON.stringify(state.battles.map((b) => b.provinceId)))
    const v = publicView(state, 'p1', TEST_RULES)
    console.log('view.battles:', JSON.stringify(v.battles))
    console.log('alertsFor:', JSON.stringify(alertsFor(v)))

    const storage = new MemoryStorage()
    await storage.write('stand-1', serialise(state, 'diag'))

    render(<App map={world} rules={TEST_RULES} maps={maps} skipTutorial storage={storage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))
    console.log('nach Start: .alerts?', !!document.querySelector('.alerts'))

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    const loads = await screen.findAllByRole('button', { name: 'Laden' })
    console.log('Laden-Knoepfe:', loads.length)
    fireEvent.click(loads[0]!)
    await new Promise((r) => setTimeout(r, 50))
    console.log('nach Laden: .alerts?', !!document.querySelector('.alerts'))
    console.log('Seitenleiste:', document.querySelector('.side')?.className)
    console.log('aside innerHTML Anfang:', document.querySelector('.side')?.innerHTML.slice(0, 600))
    expect(true).toBe(true)
  })
})
