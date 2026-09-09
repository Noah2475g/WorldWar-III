import type { StoragePort } from '@worldwar/core'
import { StorageEntryNotFound } from '@worldwar/core'

/**
 * Spielstände als Dateien im Anwendungsordner (T-M16-04, R-PKG-02, R-GAME-03/04).
 *
 * Die dritte Umsetzung des Ports — und damit die erste, in der die Zusage von T-M8-00
 * ihrem Wortlaut nach stimmt: „dieselbe Vertragstestreihe gegen alle drei Umsetzungen".
 *
 * Seit T-M28-03 (2026-09-08) läuft sie über **eigene Kommandos der Hülle**
 * (`saves_list` … `saves_exists` in `src-tauri/src/main.rs`) statt über
 * `tauri-plugin-fs`. Der Grund ist gemessen, nicht vermutet: die Scope-Prüfung des
 * Plugins kanonisiert existierende Pfade, was unter Windows die `\\?\C:\…`-Schreibweise
 * ergibt — und kein Scope-Muster passt je auf sie. Ergebnis am gebauten Programm:
 * **Schreiben neuer Stände ging, Wiederlesen war „forbidden path"** — trotz
 * `fs:allow-appdata-read-recursive`, explizitem `fs:scope` und Laufzeit-Freigabe
 * beider Schreibweisen. Die eigenen Kommandos sind zugleich die engere Zusage: sie
 * nehmen einen Datei**namen** an, nie einen Pfad, und berühren ausschließlich
 * `$APPDATA/saves` (PROBLEME.md, 2026-09-08).
 */

/** Was von `@tauri-apps/api/core` gebraucht wird — als Form, damit ein Test sie stellen kann. */
export interface SavesApi {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}

/**
 * Ob das Programm in einer Tauri-Hülle läuft.
 *
 * Geprüft wird an dem, was Tauri **in das Fenster stellt**, nicht am Bau: derselbe
 * Bündelinhalt läuft im Browser und im Programm, und nur zur Laufzeit ist zu sehen,
 * welcher Fall vorliegt.
 */
export function isTauriAvailable(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis
}

/**
 * Ein Name, der auf jedem Dateisystem funktioniert — und umkehrbar bleibt.
 *
 * Spielstände tragen Namen, die der Spieler wählt, und der Vertrag verlangt ausdrücklich,
 * dass „Mein Spielstand — Tag 42 (Österreich)" durchgeht. Ein Dateisystem verlangt das
 * Gegenteil: unter Windows sind `\ / : * ? " < > |` verboten.
 *
 * Prozentkodierung statt Ersetzen, weil `list()` die Namen zurückgeben muss, wie sie
 * hereinkamen. Wer `:` durch `_` ersetzt, hat zwei Stände mit demselben Dateinamen und
 * merkt es an dem Tag, an dem einer den anderen überschreibt.
 */
export function encodeName(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function decodeName(file: string): string {
  return decodeURIComponent(file)
}

export class TauriStorage implements StoragePort {
  private api_: Promise<SavesApi> | null = null

  /** Der Test reicht eine Nachbildung herein; die Anwendung lädt das echte Modul. */
  constructor(private readonly api?: SavesApi) {}

  private load(): Promise<SavesApi> {
    this.api_ ??= this.api
      ? Promise.resolve(this.api)
      : import('@tauri-apps/api/core').then((mod): SavesApi => ({ invoke: mod.invoke }))
    return this.api_
  }

  async list(): Promise<string[]> {
    const api = await this.load()
    // Gelesen wird jedes Mal vom Datenträger, nicht aus einem Merker (R-PKG-02/AK2):
    // ein Stand, den jemand ausserhalb des Programms gelöscht hat, ist weg — und die
    // Liste muss das sagen.
    const names = await api.invoke<string[]>('saves_list').catch(() => [])
    return names.map(decodeName).sort()
  }

  async read(name: string): Promise<string> {
    const api = await this.load()
    try {
      return await api.invoke<string>('saves_read', { name: encodeName(name) })
    } catch {
      // Jeder Grund, aus dem sich die Datei nicht lesen lässt, heißt für den Aufrufer
      // dasselbe: den Stand gibt es nicht. Der Vertrag verlangt genau diesen Fehler.
      throw new StorageEntryNotFound(name)
    }
  }

  async write(name: string, data: string): Promise<void> {
    const api = await this.load()
    await api.invoke<void>('saves_write', { name: encodeName(name), data })
  }

  async remove(name: string): Promise<void> {
    const api = await this.load()
    // Etwas zu entfernen, das nicht da ist, ist kein Fehler — so steht es im Vertrag,
    // und so setzt es das Kommando der Hülle um.
    await api.invoke<void>('saves_remove', { name: encodeName(name) }).catch(() => undefined)
  }

  async exists(name: string): Promise<boolean> {
    const api = await this.load()
    return api.invoke<boolean>('saves_exists', { name: encodeName(name) }).catch(() => false)
  }
}
