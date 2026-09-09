import { storagePortContract } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { TauriStorage, decodeName, encodeName, type SavesApi } from './TauriStorage'

/**
 * Der Datei-Port (T-M16-04, R-PKG-02, R-GAME-03/04; Kommandoweg seit T-M28-03).
 *
 * Er tritt als **dritte** Umsetzung zu Memory und IndexedDB und ändert an `createStorage`
 * und am Vertrag nichts: er erfüllt denselben Vertrag oder er ist falsch.
 *
 * Geprüft wird gegen eine Nachbildung der **Hüllen-Kommandos** (`saves_list` …
 * `saves_exists` aus `src-tauri/src/main.rs`), die sich wie der Datenträger verhält —
 * bis hin zu den Zeichen, die Windows in einem Dateinamen verbietet, und der Regel,
 * dass ein Name kein Pfad sein darf. Warum Kommandos statt `tauri-plugin-fs`: dessen
 * Scope-Prüfung kanonisiert existierende Pfade zur `\\?\C:\…`-Form, auf die kein
 * Scope-Muster passt — Schreiben ging, Wiederlesen war „forbidden path"
 * (PROBLEME.md, 2026-09-08, am gebauten Programm gemessen).
 */

/** Die Zeichen, an denen ein Dateiname unter Windows scheitert. */
const VERBOTEN = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']

/** Die Nachbildung der Hülle: ein Verzeichnis in der Hand, dieselben Regeln wie main.rs. */
class FakeSaves implements SavesApi {
  /** Dateiname (mit `.json`) → Inhalt, wie auf dem Datenträger. */
  readonly files = new Map<string, string>()

  private checkedName(name: unknown): string {
    if (typeof name !== 'string' || name.length === 0) throw new Error(`unzulaessiger Name: ${String(name)}`)
    if (name.includes('/') || name.includes('\\') || name.includes(':') || name.includes('..')) {
      throw new Error(`unzulaessiger Name: ${name}`)
    }
    // Was main.rs nicht prüft, verbietet darunter das Dateisystem selbst.
    if (VERBOTEN.some((zeichen) => name.includes(zeichen))) throw new Error(`unzulaessiger Dateiname: ${name}`)
    return name
  }

  async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    switch (command) {
      case 'saves_list':
        return [...this.files.keys()]
          .filter((file) => file.endsWith('.json'))
          .map((file) => file.slice(0, -'.json'.length))
          .sort() as T
      case 'saves_read': {
        const value = this.files.get(`${this.checkedName(args?.name)}.json`)
        if (value === undefined) throw new Error('Keine solche Datei')
        return value as T
      }
      case 'saves_write':
        this.files.set(`${this.checkedName(args?.name)}.json`, String(args?.data))
        return undefined as T
      case 'saves_remove':
        // Etwas zu entfernen, das nicht da ist, ist kein Fehler — wie in main.rs.
        this.files.delete(`${this.checkedName(args?.name)}.json`)
        return undefined as T
      case 'saves_exists':
        return this.files.has(`${this.checkedName(args?.name)}.json`) as T
      default:
        throw new Error(`unbekanntes Kommando: ${command}`)
    }
  }
}

storagePortContract('TauriStorage', () => new TauriStorage(new FakeSaves()))

describe('R-PKG-02/AK2 Der Datei-Port fuehrt Dateien, nicht Namen', () => {
  it('vergisst einen Stand, den jemand ausserhalb des Programms geloescht hat', async () => {
    // Die eigentliche Pruefung dieser Aufgabe. Ohne sie waere auch ein Port gruen, der
    // die Namen nur im Speicher fuehrt und beim Start einmal einliest — genau die
    // Umsetzung, die im Vertrag nicht auffaellt, weil der Vertrag den Prozess nie
    // verlaesst.
    const saves = new FakeSaves()
    const store = new TauriStorage(saves)
    await store.write('stand-1', '{"tick":1}')
    expect(await store.list()).toEqual(['stand-1'])

    // Der Dateimanager, nicht das Programm.
    saves.files.delete('stand-1.json')

    expect(await store.list()).toEqual([])
    expect(await store.exists('stand-1')).toBe(false)
  })

  it('sieht einen Stand, den jemand von aussen hineingelegt hat', async () => {
    // Die Gegenrichtung, und sie ist der halbe Grund fuer den Datei-Port: Spielstaende
    // soll man sichern und zurueckspielen koennen.
    const saves = new FakeSaves()
    const store = new TauriStorage(saves)
    await store.write('platzhalter', 'x')
    saves.files.set('aus%20der%20Sicherung.json', '{"tick":7}')

    expect(await store.list()).toContain('aus der Sicherung')
    expect(await store.read('aus der Sicherung')).toBe('{"tick":7}')
  })

  it('reicht nie einen Pfad an die Huelle durch, auch nicht als Spielstandname', async () => {
    // main.rs verweigert Namen mit Separatoren, statt sie zu bereinigen. Der Port
    // muss deshalb JEDEN Spielernamen so kodieren, dass er als einzelner Dateiname
    // ankommt — sonst hiesse "a/b" speichern: ausserhalb von saves/ schreiben.
    const saves = new FakeSaves()
    const store = new TauriStorage(saves)

    await expect(store.write('a/b:c\\d', '{}')).resolves.toBeUndefined()
    expect(await store.read('a/b:c\\d')).toBe('{}')
    expect(await store.list()).toEqual(['a/b:c\\d'])
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
