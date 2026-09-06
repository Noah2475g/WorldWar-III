import type { StoragePort } from '@worldwar/core'
import { StorageEntryNotFound } from '@worldwar/core'

/**
 * Spielstände als Dateien im Anwendungsordner (T-M16-04, R-PKG-02, R-GAME-03/04).
 *
 * Die dritte Umsetzung des Ports — und damit die erste, in der die Zusage von T-M8-00
 * ihrem Wortlaut nach stimmt: „dieselbe Vertragstestreihe gegen alle drei Umsetzungen".
 * Sie stand seit M8 im Plan, und die vier Dateien, die sie nannte, hat es nie gegeben.
 *
 * Warum sie neben IndexedDB existiert und nicht statt ihr: Der Browserbau bleibt die
 * abgenommene V1 (Entscheidung 2 vom 2026-09-05). Im Programm ist eine Datei aber die
 * ehrlichere Ablage — sie lässt sich sichern, kopieren, mailen und im Dateimanager
 * ansehen, und genau das erwartet jemand, der ein Programm installiert hat und keine
 * Webseite offen hat.
 *
 * Die Module von Tauri werden **spät** geladen. Der Browserbau enthält sie nicht, und ein
 * `import` an der Dateispitze wäre in ihm ein Fehler beim Laden des Bündels — also der
 * Fall, in dem gar nichts mehr startet, um eines Speichers willen, den dieser Bau nicht
 * benutzt.
 */

/** Wo die Stände liegen: der Anwendungsordner, den die Berechtigung freigibt. */
const DIR_NAME = 'saves'

/** Die Endung. Der Inhalt ist JSON, also heißt die Datei auch so. */
const SUFFIX = '.json'

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

/** Was von `@tauri-apps/plugin-fs` gebraucht wird — als Form, damit ein Test sie stellen kann. */
export interface FsApi {
  readTextFile(path: string, options?: { baseDir?: number }): Promise<string>
  writeTextFile(path: string, data: string, options?: { baseDir?: number }): Promise<void>
  remove(path: string, options?: { baseDir?: number }): Promise<void>
  exists(path: string, options?: { baseDir?: number }): Promise<boolean>
  mkdir(path: string, options?: { baseDir?: number; recursive?: boolean }): Promise<void>
  readDir(path: string, options?: { baseDir?: number }): Promise<{ name: string; isFile?: boolean }[]>
  readonly appDataDir: number
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
  private fs: Promise<FsApi> | null = null
  private ready: Promise<void> | null = null

  /** Der Test reicht eine Nachbildung herein; die Anwendung lädt das echte Modul. */
  constructor(private readonly api?: FsApi) {}

  private load(): Promise<FsApi> {
    this.fs ??= this.api
      ? Promise.resolve(this.api)
      : import('@tauri-apps/plugin-fs').then(
          (mod): FsApi => ({
            readTextFile: mod.readTextFile,
            writeTextFile: mod.writeTextFile,
            remove: mod.remove,
            exists: mod.exists,
            mkdir: mod.mkdir,
            readDir: mod.readDir,
            appDataDir: mod.BaseDirectory.AppData,
          }),
        )
    return this.fs
  }

  /**
   * Den Ordner anlegen, bevor jemand hineinschreibt.
   *
   * Beim ersten Start gibt es ihn nicht, und `writeTextFile` legt keinen Ordner an. Das
   * ist der Fehler, der genau einmal auftritt — beim allerersten Speichern eines neuen
   * Spielers, also dort, wo ihn niemand mehr sieht, der das Programm schon benutzt.
   */
  private async ensureDir(fs: FsApi): Promise<void> {
    this.ready ??= fs.mkdir(DIR_NAME, { baseDir: fs.appDataDir, recursive: true }).catch(() => undefined)
    await this.ready
  }

  private path(name: string): string {
    return `${DIR_NAME}/${encodeName(name)}${SUFFIX}`
  }

  async list(): Promise<string[]> {
    const fs = await this.load()
    await this.ensureDir(fs)
    // Gelesen wird jedes Mal vom Datenträger, nicht aus einem Merker (R-PKG-02/AK2):
    // ein Stand, den jemand ausserhalb des Programms gelöscht hat, ist weg — und die
    // Liste muss das sagen. Ein Speicher, der die Namen nur beim Start einliest, fällt
    // im Vertrag nicht auf, weil der Vertrag den Prozess nie verlässt.
    const entries = await fs.readDir(DIR_NAME, { baseDir: fs.appDataDir }).catch(() => [])
    return entries
      .filter((entry) => entry.name.endsWith(SUFFIX))
      .map((entry) => decodeName(entry.name.slice(0, -SUFFIX.length)))
      .sort()
  }

  async read(name: string): Promise<string> {
    const fs = await this.load()
    await this.ensureDir(fs)
    try {
      return await fs.readTextFile(this.path(name), { baseDir: fs.appDataDir })
    } catch {
      // Jeder Grund, aus dem sich die Datei nicht lesen lässt, heißt für den Aufrufer
      // dasselbe: den Stand gibt es nicht. Der Vertrag verlangt genau diesen Fehler.
      throw new StorageEntryNotFound(name)
    }
  }

  async write(name: string, data: string): Promise<void> {
    const fs = await this.load()
    await this.ensureDir(fs)
    await fs.writeTextFile(this.path(name), data, { baseDir: fs.appDataDir })
  }

  async remove(name: string): Promise<void> {
    const fs = await this.load()
    await this.ensureDir(fs)
    // Etwas zu entfernen, das nicht da ist, ist kein Fehler — so steht es im Vertrag.
    await fs.remove(this.path(name), { baseDir: fs.appDataDir }).catch(() => undefined)
  }

  async exists(name: string): Promise<boolean> {
    const fs = await this.load()
    await this.ensureDir(fs)
    return fs.exists(this.path(name), { baseDir: fs.appDataDir }).catch(() => false)
  }
}
