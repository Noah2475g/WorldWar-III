import { describe, expect, it } from 'vitest'
import { armyNamer, createArmyNameMemory, nationNamer, provinceNamer } from './names.ts'

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

  it('armyNamer liefert den Namen wie vorher, bei Unbekanntem aber „eine Armee“ statt der Kennung (R-UX-03/AK2)', () => {
    // LOESCHVERMERK (Review): bis T-M44-06 hieß die Gegenprobe `old(id) = armies[id]?.name ?? id`
    // und `expect(now('a99')).toBe('a99')` — der Rückfall auf die Kennung ist der Fehler „a68 ist vernichtet.“.
    const now = armyNamer(armies)
    expect(now('a1')).toBe('Erste Armee')
    expect(now('a68')).toBe('Achtundsechzigste')
    for (const id of ['a99', '']) {
      expect(now(id), `Armee ${JSON.stringify(id)}`).toBe('eine Armee')
      expect(now(id)).not.toBe(id)
    }
  })

  it('der Namensspeicher behält den Namen einer vernichteten Armee, bis er geleert wird (R-UX-03/AK2)', () => {
    const memory = createArmyNameMemory()
    expect(armyNamer(armies, memory)('a68')).toBe('Achtundsechzigste')
    // a68 fällt: der Bestand kennt sie nicht mehr, der Speicher schon.
    const danach = { a1: { name: 'Erste Armee' } }
    expect(armyNamer(danach, memory)('a68')).toBe('Achtundsechzigste')
    expect(armyNamer(danach, memory)('a1')).toBe('Erste Armee')
    // Nach dem Laden bewusst leer: unbekannt heißt „eine Armee“.
    memory.reset()
    expect(armyNamer(danach, memory)('a68')).toBe('eine Armee')
    expect(armyNamer(danach, memory)('a1')).toBe('Erste Armee')
    // Ohne Speicher (Aufrufer, die ihn nicht brauchen) bleibt es bei „eine Armee“.
    expect(armyNamer(danach)('a68')).toBe('eine Armee')
  })

  it('nationNamer liefert dasselbe wie der Ausdruck in App.tsx', () => {
    const old = (id: string): string => (players as Record<string, { nation: string } | undefined>)[id]?.nation ?? id
    const now = nationNamer(players)
    for (const id of ['p1', 'p2', 'p9', '']) expect(now(id), `Macht ${JSON.stringify(id)}`).toBe(old(id))
    expect(now('p2')).toBe('Mexiko')
  })

  it('eine leere Liste löst nichts auf und wirft nicht', () => {
    expect(provinceNamer([])('x')).toBe('x')
    expect(armyNamer({})('x')).toBe('eine Armee')
    expect(nationNamer({})('x')).toBe('x')
  })
})
