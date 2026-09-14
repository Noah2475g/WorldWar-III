import { describe, expect, it } from 'vitest'
import { envelope, type CommandsMessage, type NetMessage } from './protocol'
import type { Transport } from './transport'

/**
 * Der Vertrag, den jeder Transport einhalten muss (T-M38-01, D28.9).
 *
 * Hinter der Schnittstelle aus `packages/netplay/src/transport.ts` steht im Test ein
 * Doppel im selben Prozess und im Spiel eine Leitung. Das ist die Naht, an der der ganze
 * Mehrspieler prüfbar bleibt — und eine Naht ist nur so viel wert, wie **beide** Seiten
 * dasselbe versprechen.
 *
 * Deshalb ist die Reihe hier eine **Funktion** und kein kopierter Block. `StoragePort` aus
 * M8 hat dieselbe Zusage gemacht („Vertragstestreihe gegen alle drei Umsetzungen") und
 * drei Meilensteine lang nicht eingelöst: es gab nie drei Umsetzungen und nie eine Reihe,
 * sondern ein einzelnes `it()`, das `MemoryStorage` gegen sich selbst prüfte
 * (`audit-2026-09-05.md`, Blocker 6). Hier läuft dieselbe Reihe gegen das Schleifendoppel
 * (T-M38-01) **und** gegen die echte Leitung der Browserseite (T-M38-06).
 *
 * (Dass hier nicht steht, wie diese Leitung heisst, ist Absicht: der Waechter in
 * `protocol.test.ts` sucht den Namen als Zeichenfolge und unterscheidet Prosa nicht von
 * Code — richtig so, denn dieses Paket soll ihn gar nicht kennen.)
 *
 * **Warum diese Datei nicht aus `index.ts` hinausgeht.** Sie importiert `vitest`. Stünde
 * sie im Sammelexport, zöge jeder `import … from '@worldwar/netplay'` den Testläufer in
 * das ausgelieferte Bündel — also auch in das Tauri-Programm, dessen Netzfreiheit
 * T-M38-05 am Erzeugnis misst. Wer sie braucht, nennt sie beim Pfad; `websocketTransport.test.ts`
 * tut das über einen relativen Import, wie es `test/guards/text-keys.test.ts` mit `de.ts`
 * seit M21 tut.
 *
 * **Die zweite Zusicherung ist die teuer gelernte.** Beim Bau von T-M37-11 verlor das
 * Schleifendoppel die erste Nachricht, weil eine Seite sendete, bevor die andere ihren
 * Hörer angemeldet hatte. Im Gleichschritt ist eine verlorene Nachricht kein Schluckauf,
 * sondern ein **Stillstand**: die Gegenseite wartet auf eine Liste für Tick 0, die nie
 * wieder kommt, und die Partie steht nach genau einem Tick. Eine echte Leitung puffert;
 * ein Doppel, das es nicht tut, wäre freundlicher zur Umsetzung und härter zur
 * Wirklichkeit. Seit T-M38-01 steht diese Zusage im Vertrag und gilt für beide.
 */

/**
 * Zwei verbundene Enden, wie eine Umsetzung sie liefert.
 *
 * `settle` gibt einer Umsetzung, die asynchron zustellt, die Gelegenheit dazu — beim
 * Schleifendoppel ein Nichts, an einer echten Leitung das Abarbeiten ihrer
 * Ereignisschlange. Ohne diesen Haken müsste die Reihe entweder überall warten (und wäre
 * langsam) oder nirgends (und liefe nur gegen das synchrone Doppel).
 */
export interface TransportPair {
  a: Transport
  b: Transport
  settle: () => Promise<void>
}

/** Eine Nachricht, die nichts bedeutet, aber alles hat, was das Protokoll verlangt. */
export function testMessage(tick: number): CommandsMessage {
  return { ...envelope('befehle'), tick, commands: [], hash: `h${tick}` }
}

/** Sammelt, was an einem Ende ankommt. */
function collect(transport: Transport): { received: NetMessage[]; stop: () => void } {
  const received: NetMessage[] = []
  const stop = transport.onMessage((message) => {
    received.push(message)
  })
  return { received, stop }
}

export function transportContract(
  name: string,
  factory: () => TransportPair | Promise<TransportPair>,
): void {
  describe(`R-MP-06 Transportvertrag: ${name}`, () => {
    const fresh = async (): Promise<TransportPair> => await factory()

    it('stellt zu, was gesendet wurde — und in derselben Reihenfolge', async () => {
      // Die Reihenfolge ist keine Bequemlichkeit: der Gleichschritt sortiert Befehle
      // innerhalb eines Spielers NICHT um (T-M37-07), also muss die Leitung sie halten.
      const { a, b, settle } = await fresh()
      const bei = collect(b)

      a.send(testMessage(1))
      a.send(testMessage(2))
      a.send(testMessage(3))
      await settle()

      expect(bei.received.map((m) => (m as CommandsMessage).tick)).toEqual([1, 2, 3])
    })

    it('reicht nach, was vor dem ersten Hoerer ankam', async () => {
      // Die Falle aus T-M37-11. Eine Nachricht, die verlorengeht, weil der Empfaenger
      // eine Wimper zu spaet zuhoert, haelt die ganze Partie an.
      const { a, b, settle } = await fresh()

      a.send(testMessage(7))
      await settle()
      const bei = collect(b)
      await settle()

      expect(bei.received.map((m) => (m as CommandsMessage).tick)).toEqual([7])
    })

    it('schickt die Nachricht wirklich ueber die Leitung, statt sie weiterzureichen', async () => {
      // Gleich im Inhalt, verschieden in der Sache: ein Doppel, das den Gegenstand nur
      // weitergibt, verschwiege, dass etwas im Zustand den Weg nicht uebersteht — eine
      // `Map`, ein `undefined`, eine Klasse.
      const { a, b, settle } = await fresh()
      const bei = collect(b)
      const gesendet = testMessage(11)

      a.send(gesendet)
      await settle()

      expect(bei.received[0]).toEqual(gesendet)
      expect(bei.received[0]).not.toBe(gesendet)
    })

    it('meldet einen Hoerer wieder ab', async () => {
      // Ein Hoerer, den niemand abmelden kann, ueberlebt die Partie, an der er haengt.
      const { a, b, settle } = await fresh()
      const bei = collect(b)

      a.send(testMessage(1))
      await settle()
      bei.stop()
      a.send(testMessage(2))
      await settle()

      expect(bei.received.map((m) => (m as CommandsMessage).tick)).toEqual([1])
    })

    it('sagt beiden Seiten, dass geschlossen wurde', async () => {
      const { a, b, settle } = await fresh()
      const gruende: string[] = []
      a.onClose((reason) => gruende.push(`a:${reason}`))
      b.onClose((reason) => gruende.push(`b:${reason}`))

      a.close('Schluss fuer heute')
      await settle()

      expect(gruende.sort()).toEqual(['a:Schluss fuer heute', 'b:Schluss fuer heute'])
    })

    it('sagt danach, dass es zu ist', async () => {
      const { a, b, settle } = await fresh()
      expect([a.closed, b.closed]).toEqual([false, false])

      a.close()
      await settle()

      expect([a.closed, b.closed]).toEqual([true, true])
    })

    it('wirft beim Senden nach dem Schliessen, statt still zu schlucken', async () => {
      // Ein Fehler, nicht ein Nichts: im Gleichschritt ist eine nicht gesendete Nachricht
      // von einer abgerissenen Verbindung nicht zu unterscheiden.
      const { a, settle } = await fresh()
      a.close()
      await settle()

      expect(() => a.send(testMessage(1))).toThrow()
    })

    it('nimmt ein zweites Schliessen hin und meldet es nur einmal', async () => {
      const { a, settle } = await fresh()
      let gemeldet = 0
      a.onClose(() => {
        gemeldet += 1
      })

      a.close('einmal')
      a.close('zweimal')
      await settle()

      expect(gemeldet).toBe(1)
    })

    it('meldet einen Schliess-Hoerer wieder ab', async () => {
      const { a, settle } = await fresh()
      let gemeldet = 0
      const ab = a.onClose(() => {
        gemeldet += 1
      })

      ab()
      a.close()
      await settle()

      expect(gemeldet).toBe(0)
    })
  })
}
