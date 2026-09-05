import { describe, expect, it } from 'vitest'
import type { StoragePort } from '@worldwar/core'

/**
 * Der Vertrag, den jeder Speicher einhalten muss (T-M14-08).
 *
 * Der Plan führte seit M8 eine „Vertragstestreihe gegen alle drei Umsetzungen". Es gab
 * nie drei Umsetzungen und nie eine Reihe: `MemoryStorage` war die einzige, und der
 * „Vertrag" ein einzelnes `it()`, das sie gegen sich selbst prüfte. Der Fehler ist nicht,
 * dass ein Test fehlte — der Fehler ist, dass die Zusage aussah, als gäbe es ihn
 * (`docs/reports/audit-2026-09-05.md`, Blocker 6).
 *
 * Deshalb ist der Vertrag hier eine Funktion: Sie bekommt eine Fabrik und prüft, was
 * jeder Speicher können muss — auch die Fälle, die nur ein echter Speicher hat und die
 * ein `Map` im Arbeitsspeicher niemals zeigt.
 */
export function storagePortContract(name: string, factory: () => StoragePort | Promise<StoragePort>): void {
  describe(`R-GAME-03 Speichervertrag: ${name}`, () => {
    const fresh = async (): Promise<StoragePort> => await factory()

    it('schreibt und liest denselben Inhalt zurueck', async () => {
      const store = await fresh()
      await store.write('a', '{"tick":42}')
      expect(await store.read('a')).toBe('{"tick":42}')
    })

    it('meldet, was es kennt — sortiert und ohne Doppelte', async () => {
      const store = await fresh()
      await store.write('b', '2')
      await store.write('a', '1')
      await store.write('a', '1 nochmal')
      expect(await store.list()).toEqual(['a', 'b'])
    })

    it('sagt die Wahrheit ueber das, was es nicht hat', async () => {
      const store = await fresh()
      expect(await store.exists('weg')).toBe(false)
      await expect(store.read('weg')).rejects.toThrow()
    })

    it('entfernt einen Stand vollstaendig', async () => {
      const store = await fresh()
      await store.write('a', '1')
      await store.remove('a')
      expect(await store.exists('a')).toBe(false)
      expect(await store.list()).not.toContain('a')
    })

    it('nimmt das Entfernen von etwas hin, das es nicht gibt', async () => {
      const store = await fresh()
      await expect(store.remove('nie dagewesen')).resolves.toBeUndefined()
    })

    it('ueberschreibt einen Stand, statt ihn zu verdoppeln', async () => {
      // Zwei Schreibvorgänge auf denselben Namen: der zweite gewinnt, und es bleibt bei
      // einem Eintrag. Ein Speicher, der hier anhängt, füllt die Slotliste mit Leichen.
      const store = await fresh()
      await store.write('slot1', 'alt')
      await store.write('slot1', 'neu')
      expect(await store.read('slot1')).toBe('neu')
      expect((await store.list()).filter((n) => n === 'slot1')).toHaveLength(1)
    })

    it('haelt Namen aus, die ein Dateisystem nicht mag', async () => {
      // Spielstände tragen vom Spieler gewählte Namen. Ein Speicher, der an einem
      // Leerzeichen oder Umlaut scheitert, scheitert beim ersten echten Spieler.
      const store = await fresh()
      const name = 'Mein Spielstand — Tag 42 (Österreich)'
      await store.write(name, 'x')
      expect(await store.read(name)).toBe('x')
      expect(await store.list()).toContain(name)
    })

    it('haelt Inhalte aus, die groesser sind als eine Zeile', async () => {
      // Ein Spielstand der Weltkarte ist über ein Megabyte gross.
      const store = await fresh()
      const gross = JSON.stringify({ füllung: 'x'.repeat(200_000) })
      await store.write('gross', gross)
      expect(await store.read('gross')).toBe(gross)
    })

    it('haelt Umlaute und Sonderzeichen im Inhalt', async () => {
      const store = await fresh()
      const inhalt = JSON.stringify({ nation: 'Österreich-Ungarn', note: 'größer • 100 %' })
      await store.write('u', inhalt)
      expect(await store.read('u')).toBe(inhalt)
    })
  })
}
