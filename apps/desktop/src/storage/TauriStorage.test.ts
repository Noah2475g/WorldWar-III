import { storagePortContract } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { TauriStorage, decodeName, encodeName, type FsApi } from './TauriStorage'

/**
 * Der Datei-Port (T-M16-04, R-PKG-02, R-GAME-03/04).
 *
 * Er tritt als **dritte** Umsetzung zu Memory und IndexedDB und ändert an `createStorage`
 * und am Vertrag nichts: er erfüllt denselben Vertrag oder er ist falsch. Damit stimmt
 * die Zusage von T-M8-00 zum ersten Mal ihrem Wortlaut nach — sie stand seit M8 im Plan,
 * und die Dateien, die sie nannte, hat es nie gegeben.
 *
 * Geprüft wird gegen ein Dateisystem in der Hand, nicht gegen eine `Map`: die
 * Nachbildung unten verhält sich wie ein Datenträger, bis hin zu den Zeichen, die
 * Windows in einem Dateinamen verbietet. Sonst prüfte dieser Test genau das nicht, wofür
 * es den Port gibt.
 */

/** Die Zeichen, an denen ein Dateiname unter Windows scheitert. */
const VERBOTEN = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']

class FakeFs implements FsApi {
  readonly appDataDir = 1
  readonly files = new Map<string, string>()
  private dirs = new Set<string>()

  private check(path: string): void {
    const file = path.slice(path.lastIndexOf('/') + 1)
    if (VERBOTEN.some((zeichen) => file.includes(zeichen))) throw new Error(`Unzulaessiger Dateiname: ${file}`)
  }

  async mkdir(path: string): Promise<void> {
    this.dirs.add(path)
  }

  async readDir(path: string): Promise<{ name: string; isFile?: boolean }[]> {
    if (!this.dirs.has(path)) throw new Error('Kein solcher Ordner')
    return [...this.files.keys()]
      .filter((full) => full.startsWith(`${path}/`))
      .map((full) => ({ name: full.slice(path.length + 1), isFile: true }))
  }

  async readTextFile(path: string): Promise<string> {
    const value = this.files.get(path)
    if (value === undefined) throw new Error('Keine solche Datei')
    return value
  }

  async writeTextFile(path: string, data: string): Promise<void> {
    this.check(path)
    this.files.set(path, data)
  }

  async remove(path: string): Promise<void> {
    if (!this.files.delete(path)) throw new Error('Keine solche Datei')
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }
}

storagePortContract('TauriStorage', () => new TauriStorage(new FakeFs()))

describe('R-PKG-02/AK2 Der Datei-Port fuehrt Dateien, nicht Namen', () => {
  it('vergisst einen Stand, den jemand ausserhalb des Programms geloescht hat', async () => {
    // Die eigentliche Pruefung dieser Aufgabe. Ohne sie waere auch ein Port gruen, der
    // die Namen nur im Speicher fuehrt und beim Start einmal einliest — genau die
    // Umsetzung, die im Vertrag nicht auffaellt, weil der Vertrag den Prozess nie
    // verlaesst.
    const fs = new FakeFs()
    const store = new TauriStorage(fs)
    await store.write('stand-1', '{"tick":1}')
    expect(await store.list()).toEqual(['stand-1'])

    // Der Dateimanager, nicht das Programm.
    fs.files.delete('saves/stand-1.json')

    expect(await store.list()).toEqual([])
    expect(await store.exists('stand-1')).toBe(false)
  })

  it('sieht einen Stand, den jemand von aussen hineingelegt hat', async () => {
    // Die Gegenrichtung, und sie ist der halbe Grund fuer den Datei-Port: Spielstaende
    // soll man sichern und zurueckspielen koennen.
    const fs = new FakeFs()
    const store = new TauriStorage(fs)
    await store.write('platzhalter', 'x')
    fs.files.set('saves/aus%20der%20Sicherung.json', '{"tick":7}')

    expect(await store.list()).toContain('aus der Sicherung')
    expect(await store.read('aus der Sicherung')).toBe('{"tick":7}')
  })

  it('legt den Ordner beim ersten Speichern an, statt daran zu scheitern', async () => {
    // Der Fehler, der genau einmal auftritt: beim allerersten Speichern eines neuen
    // Spielers, also dort, wo ihn niemand mehr sieht, der das Programm schon benutzt.
    const store = new TauriStorage(new FakeFs())

    await expect(store.write('erster', '{}')).resolves.toBeUndefined()
  })
})

describe('R-PKG-02 Namen ueberleben den Weg durch das Dateisystem', () => {
  it('kodiert, was ein Dateisystem nicht mag, und kehrt es wieder um', () => {
    for (const name of ['Mein Spielstand — Tag 42 (Österreich)', 'a/b:c*d?e"f<g>h|i', 'ganz normal']) {
      expect(VERBOTEN.some((zeichen) => encodeName(name).includes(zeichen)), `"${name}" bleibt unzulaessig`).toBe(false)
      expect(decodeName(encodeName(name))).toBe(name)
    }
  })

  it('gibt zwei verschiedenen Namen zwei verschiedene Dateien', () => {
    // Wer verbotene Zeichen durch "_" ersetzt, hat zwei Staende mit demselben
    // Dateinamen und merkt es an dem Tag, an dem einer den anderen ueberschreibt.
    expect(encodeName('Tag:42')).not.toBe(encodeName('Tag_42'))
  })
})
