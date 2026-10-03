import { describe, expect, it } from 'vitest'
import { armyNamer, nationNamer, provinceNamer } from './names.ts'

/**
 * R-UX-03/AK2, T-M44-02b: die Namensauflösung wurde aus `App.tsx` herausgezogen, ohne dass sich
 * etwas ändert. Die Gegenprobe steht hier als Text: die alten Ausdrücke, wörtlich, neben den neuen
 * Funktionen — gleiche Eingabe, gleiche Ausgabe, auch für das, was es nicht gibt.
 */
const provinces = [
  { id: 'p-west', name: 'Mittlerer Westen' },
  { id: 'p-nord', name: 'Nordostmexiko' },
]
const armies = { a1: { name: 'Erste Armee' }, a68: { name: 'Achtundsechzigste' } }
const players = { p1: { nation: 'Vereinigte Staaten' }, p2: { nation: 'Mexiko' } }

describe('R-UX-03/AK2 game/names: Namensauflösung wie vorher (T-M44-02b)', () => {
  const ids = ['p-west', 'p-nord', 'p-unbekannt', '']

  it('provinceNamer liefert dasselbe wie der Ausdruck in App.tsx', () => {
    const old = (id: string): string => provinces.find((p) => p.id === id)?.name ?? id
    const now = provinceNamer(provinces)
    for (const id of ids) expect(now(id), `Provinz ${JSON.stringify(id)}`).toBe(old(id))
    expect(now('p-west')).toBe('Mittlerer Westen')
    expect(now('p-unbekannt'), 'unbekannt heißt heute: die Kennung (R-UX-03/AK2 ändert das später, hier nicht)').toBe('p-unbekannt')
  })

  it('armyNamer liefert dasselbe wie der Ausdruck in App.tsx', () => {
    const old = (id: string): string => (armies as Record<string, { name: string } | undefined>)[id]?.name ?? id
    const now = armyNamer(armies)
    for (const id of ['a1', 'a68', 'a99', '']) expect(now(id), `Armee ${JSON.stringify(id)}`).toBe(old(id))
    expect(now('a1')).toBe('Erste Armee')
    expect(now('a99')).toBe('a99')
  })

  it('nationNamer liefert dasselbe wie der Ausdruck in App.tsx', () => {
    const old = (id: string): string => (players as Record<string, { nation: string } | undefined>)[id]?.nation ?? id
    const now = nationNamer(players)
    for (const id of ['p1', 'p2', 'p9', '']) expect(now(id), `Macht ${JSON.stringify(id)}`).toBe(old(id))
    expect(now('p2')).toBe('Mexiko')
  })

  it('eine leere Liste löst nichts auf und wirft nicht', () => {
    expect(provinceNamer([])('x')).toBe('x')
    expect(armyNamer({})('x')).toBe('x')
    expect(nationNamer({})('x')).toBe('x')
  })
})
