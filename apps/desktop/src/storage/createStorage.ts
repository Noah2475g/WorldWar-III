import { MemoryStorage, type StoragePort } from '@worldwar/core'
import { IndexedDbStorage, isIndexedDbAvailable } from './IndexedDbStorage'

/**
 * Welcher Speicher die laufende Anwendung benutzt (T-M14-08).
 *
 * Die Wahl steht hier und nicht in `App.tsx`, damit sie eine Stelle hat, die man prüfen
 * kann. Vorher stand sie als Standardwert in einem `useMemo` — `props.storage ?? new
 * MemoryStorage()` — und niemand reichte je etwas herein.
 */
export interface StorageChoice {
  storage: StoragePort
  /** Überlebt ein Spielstand das Schließen des Fensters? */
  persistent: boolean
  /** Was dem Spieler zu sagen ist, wenn nicht. */
  warning?: string
}

export function createStorage(): StorageChoice {
  if (isIndexedDbAvailable()) {
    return { storage: new IndexedDbStorage(), persistent: true }
  }

  // Kein IndexedDB: private Fenster mancher Browser, alte Umgebungen, Tests. Dann wird
  // gespeichert wie bisher — aber der Spieler erfährt es, statt es beim nächsten Start
  // herauszufinden. Ein stiller Rückfall auf den Arbeitsspeicher war genau der Zustand,
  // den T-M14-08 behebt.
  return {
    storage: new MemoryStorage(),
    persistent: false,
    warning:
      'Dieser Browser bietet keinen dauerhaften Speicher. Spielstände gehen beim Schließen des Fensters verloren.',
  }
}
