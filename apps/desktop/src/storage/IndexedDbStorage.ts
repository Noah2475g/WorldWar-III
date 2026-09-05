import type { StoragePort } from '@worldwar/core'
import { StorageEntryNotFound } from '@worldwar/core'

/**
 * Ein Speicher, der das Schließen des Fensters überlebt (T-M14-08, R-GAME-03/04/05).
 *
 * Bis zum 2026-09-06 gab es im ganzen Baum genau eine Umsetzung des `StoragePort`:
 * `MemoryStorage`, eine `Map`. `main.tsx` reichte keinen Port herein, `App.tsx` fiel auf
 * sie zurück — die Anwendung meldete „gespeichert", zeigte den Stand in der Slotliste,
 * und nach dem Schließen des Fensters war alles weg. Das automatische Speichern schützte
 * vor gar nichts. `TauriStorage` und `NodeStorage` standen als erledigte Arbeit im Plan
 * und haben laut `git log --all` nie existiert.
 *
 * Warum IndexedDB und nicht das Dateisystem: Noahs Entscheidung 2 vom 2026-09-05. Die V1
 * wird als Browserbau abgenommen; die Tauri-Verpackung mit Datei-Port ist M16. IndexedDB
 * statt `localStorage`, weil ein Spielstand der Weltkarte über ein Megabyte groß ist und
 * `localStorage` bei etwa fünf Megabyte für *alle* Stände zusammen endet — und weil es
 * synchron ist und damit die Oberfläche anhielte.
 */

const DB_NAME = 'worldwar'
const DB_VERSION = 1
const STORE = 'saves'

/** Verspricht das, was `indexedDB` als Ereignis liefert. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB-Fehler'))
  })
}

export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

export class IndexedDbStorage implements StoragePort {
  private db: Promise<IDBDatabase> | null = null

  /**
   * Der Datenbankname. Die Anwendung benutzt immer denselben; Tests geben je Reihe einen
   * eigenen, weil sich zwei Reihen sonst gegenseitig sehen und ein deleteDatabase auf
   * eine offene Verbindung wartet, bis das Zeitlimit reisst.
   */
  constructor(private readonly dbName: string = DB_NAME) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB liess sich nicht oeffnen'))
    })
    return this.db
  }

  private async run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    const tx = db.transaction(STORE, mode)
    const result = await promisify(fn(tx.objectStore(STORE)))
    // Auf das Ende der Transaktion warten: erst dann ist geschrieben, was geschrieben
    // wurde. Wer nur auf die Anfrage wartet, meldet Erfolg, bevor die Platte ihn kennt.
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('Schreiben fehlgeschlagen'))
      tx.onabort = () => reject(tx.error ?? new Error('Schreiben abgebrochen'))
    })
    return result
  }

  async list(): Promise<string[]> {
    const keys = await this.run('readonly', (store) => store.getAllKeys() as IDBRequest<IDBValidKey[]>)
    return keys.map(String).sort()
  }

  async read(name: string): Promise<string> {
    const value = await this.run('readonly', (store) => store.get(name) as IDBRequest<string | undefined>)
    if (value === undefined) throw new StorageEntryNotFound(name)
    return value
  }

  async write(name: string, data: string): Promise<void> {
    await this.run('readwrite', (store) => store.put(data, name))
  }

  async remove(name: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(name))
  }

  async exists(name: string): Promise<boolean> {
    const count = await this.run('readonly', (store) => store.count(name))
    return count > 0
  }
}
