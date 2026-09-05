import 'fake-indexeddb/auto'
import { MemoryStorage } from '@worldwar/core'
import { storagePortContract } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { IndexedDbStorage, isIndexedDbAvailable } from './IndexedDbStorage'
import { createStorage } from './createStorage'

/**
 * Der Speichervertrag, gegen beide Umsetzungen (T-M14-08).
 *
 * Der Plan führte seit M8 eine „Vertragstestreihe gegen alle drei Umsetzungen" als
 * erledigt. Es gab eine Umsetzung und ein einzelnes `it()`, das sie gegen sich selbst
 * prüfte. Hier läuft derselbe Vertrag gegen `MemoryStorage` **und** gegen den Speicher,
 * den die Anwendung wirklich benutzt — das ist der Unterschied zwischen einer Zusage und
 * einem Beleg.
 */

// Jeder Fall bekommt seine eigene Datenbank. Teilen sich alle eine, sieht ein Fall die
// Einträge seiner Vorgänger — und ob die Reihe grün ist, hängt an ihrer Reihenfolge.
let counter = 0
const freshIndexedDb = (): IndexedDbStorage => {
  counter += 1
  return new IndexedDbStorage(`vertrag-${counter}`)
}

storagePortContract('MemoryStorage', () => new MemoryStorage())
storagePortContract('IndexedDbStorage', () => freshIndexedDb())

describe('R-GAME-03 Der Speicher ueberlebt das Fenster', () => {
  it('liest einen Stand aus einer neuen Instanz zurueck', () => {
    // Das ist der Blocker in einer Zusicherung: eine neue Instanz ist, was nach einem
    // Neustart der Anwendung entsteht. `MemoryStorage` faellt hier durch — und genau
    // `MemoryStorage` benutzte die ausgelieferte Anwendung.
    const geschrieben = new IndexedDbStorage()
    return geschrieben.write('slot1', '{"tick":99}').then(async () => {
      const nachNeustart = new IndexedDbStorage()
      expect(await nachNeustart.read('slot1')).toBe('{"tick":99}')
    })
  })

  it('waehlt den dauerhaften Speicher, wo es einen gibt', () => {
    const wahl = createStorage()
    expect(isIndexedDbAvailable()).toBe(true)
    expect(wahl.persistent).toBe(true)
    expect(wahl.storage).toBeInstanceOf(IndexedDbStorage)
    expect(wahl.warning).toBeUndefined()
  })

  it('sagt es, wenn es keinen dauerhaften Speicher gibt', () => {
    // Ein stiller Rueckfall auf den Arbeitsspeicher war der Zustand, den diese Aufgabe
    // behebt. Faellt die Anwendung zurueck, erfaehrt es der Spieler jetzt.
    const echt = globalThis.indexedDB
    // @ts-expect-error -- absichtlich entfernt, um den Rueckfall zu pruefen
    delete globalThis.indexedDB

    const wahl = createStorage()
    expect(wahl.persistent).toBe(false)
    expect(wahl.storage).toBeInstanceOf(MemoryStorage)
    expect(wahl.warning).toMatch(/verloren/)

    globalThis.indexedDB = echt
  })
})
