import { MemoryStorage, type StoragePort } from '@worldwar/core'
import { IndexedDbStorage, isIndexedDbAvailable } from './IndexedDbStorage'
import { TauriStorage, isTauriAvailable } from './TauriStorage'

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
  // Im Programm liegen die Staende als Dateien (T-M16-04, R-PKG-02). Das ist nicht nur
  // eine andere Ablage, sondern eine andere Zusage: eine Datei laesst sich sichern,
  // kopieren und im Dateimanager ansehen — genau das erwartet jemand, der ein Programm
  // installiert hat. Die Pruefung gilt der Laufzeit, nicht dem Bau: derselbe
  // Buendelinhalt laeuft im Browser und im Programm.
  if (isTauriAvailable()) {
    return { storage: new TauriStorage(), persistent: true }
  }

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
