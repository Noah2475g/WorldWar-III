import { smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import type { PlayerId, ProvinceId } from '../state/types'
import { hostFieldsToLeave, isClearingPath, type ClearingWay } from './homePath'

const map = smallWorld()
const ME: PlayerId = 'p1'
const HOST: PlayerId = 'p2'

/**
 * Die Besetzung der Testwelt, wie `testworld.json` sie aufteilt: p1 Nordland (n1-n3),
 * p2 Ostmark (o1-o3), p3 Sueden (s1-s2); m1, m2, i1, i2 herrenlos. Jedes H-Beispiel
 * ändert nur die Felder, die es ausdrücklich nennt (§3.1).
 */
const BASE_OWNERS: Partial<Record<ProvinceId, PlayerId>> = {
  n1: 'p1',
  n2: 'p1',
  n3: 'p1',
  o1: HOST,
  o2: HOST,
  o3: HOST,
  s1: 'p3',
  s2: 'p3',
}

/**
 * Baut eine `ClearingWay` aus einer Besitzliste (Grundbesetzung + Überschreibungen) und
 * den Mächten, die die Armee ohne Überfall betreten darf. `p1` (die Armee) und `p2` (die
 * Gastmacht) fragt die Rechnung nie ab (H1-H8, §3.1).
 */
function way(
  overrides: Partial<Record<ProvinceId, PlayerId>>,
  legal: PlayerId[] = [],
  options: { useSea?: boolean; strictExit?: boolean } = {},
): ClearingWay {
  const owners = { ...BASE_OWNERS, ...overrides }
  const legalSet = new Set(legal)
  return {
    map,
    ownerOf: (id) => owners[id] ?? null,
    mayEnter: (owner) => legalSet.has(owner),
    useSea: options.useSea ?? false,
    ...(options.strictExit !== undefined ? { strictExit: options.strictExit } : {}),
  }
}

describe('R-DIP-10/AK2 Der Räumweg', () => {
  it('H1: von einem einzigen Gastmacht-Feld reicht schon der erste Nachbar', () => {
    const w = way({ m1: HOST })
    expect(hostFieldsToLeave(w, 'm1', ME, HOST)).toBe(0)
    expect(isClearingPath(w, 'm1', ['n2'], ME, HOST)).toBe(true)
    // m2 gehoert der Gastmacht: der Weg ueber sie kostet ein Feld mehr als noetig.
    expect(isClearingPath(way({ m1: HOST, m2: HOST }), 'm1', ['m2', 'n3'], ME, HOST)).toBe(false)
  })

  it('H2: zwei Gastmacht-Felder tief, ueber den kuerzesten Ausgang', () => {
    const w = way({ m1: HOST, m2: HOST })
    expect(hostFieldsToLeave(w, 'o1', ME, HOST)).toBe(1)
    expect(isClearingPath(w, 'o1', ['m1', 'n2'], ME, HOST)).toBe(true)
    expect(isClearingPath(w, 'o1', ['o3', 'm1', 'n2'], ME, HOST)).toBe(false)
    expect(isClearingPath(w, 'o1', ['o2', 'o3', 'm1', 'n2'], ME, HOST)).toBe(false)
  })

  it('H3: ein leerer oder in der Gastmacht endender Weg ist kein Raeumweg', () => {
    const w = way({ m1: HOST, m2: HOST })
    expect(isClearingPath(w, 'o1', [], ME, HOST)).toBe(false)
    expect(isClearingPath(w, 'o1', ['m1'], ME, HOST)).toBe(false)
  })

  it('H4: ein Weg, der die Gastmacht wieder betritt, ist kein Raeumweg', () => {
    const w = way({ m1: HOST, m2: HOST })
    expect(isClearingPath(w, 'm1', ['n2', 'n3', 'm2', 'n3'], ME, HOST)).toBe(false)
  })

  it('H5: ein herrenloses Feld ist immer ein Ausgang', () => {
    const w = way({ o1: HOST })
    expect(hostFieldsToLeave(w, 'o1', ME, HOST)).toBe(0)
    expect(isClearingPath(w, 'o1', ['m1'], ME, HOST)).toBe(true)
    expect(isClearingPath(w, 'o1', ['m1', 'n2'], ME, HOST)).toBe(true)
  })

  it('H6: fehlt ein legaler Ausgang, zaehlt der Rueckfall "jeder Ausgang" — nur mit strictExit gilt er nicht', () => {
    const owners = { o1: HOST, m1: 'p3' as PlayerId, m2: 'p3' as PlayerId }
    const noRight = way(owners)
    expect(hostFieldsToLeave(noRight, 'o1', ME, HOST)).toBe(0)
    expect(isClearingPath(noRight, 'o1', ['m1'], ME, HOST)).toBe(true)

    const strict = way(owners, [], { strictExit: true })
    expect(isClearingPath(strict, 'o1', ['m1'], ME, HOST)).toBe(false)

    const withPassage = way(owners, ['p3'], { strictExit: true })
    expect(hostFieldsToLeave(withPassage, 'o1', ME, HOST)).toBe(0)
    expect(isClearingPath(withPassage, 'o1', ['m1'], ME, HOST)).toBe(true)
  })

  it('H7: eine Seekante ist der kuerzeste Ausgang, aber nur, wenn die Armee sie nutzen darf', () => {
    const bySea = way({ i2: ME })
    expect(hostFieldsToLeave(bySea, 'o1', ME, HOST)).toBe(0)
    const noSea = way({ i2: ME, m1: HOST }, [], { useSea: false })
    expect(hostFieldsToLeave(noSea, 'o1', ME, HOST)).toBe(1)
  })

  it('H8: die Antwort haengt nicht von der Iterationsreihenfolge der Provinzen ab', () => {
    const w = way({ m1: HOST, m2: HOST })
    const forward = hostFieldsToLeave(w, 'o1', ME, HOST)
    // `neighborsOf` sortiert ohnehin; die Rechnung selbst iteriert nie ueber ein Set.
    const reversed = hostFieldsToLeave({ ...w, map: { ...map, provinces: [...map.provinces].reverse() } }, 'o1', ME, HOST)
    expect(reversed).toBe(forward)
  })
})
