import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './scan'

/**
 * Jedes Stylesheet der Oberflaeche (Android-Emulator, 2026-09-24).
 *
 * Bis hierhin lasen die Farb- und Schriftwaechter nur `ui/app.css` — es war die einzige
 * .css-Datei. Mit `touch.css` kam eine zweite, und ein Waechter, der eine Datei mit Namen
 * liest, sieht die naechste nie: eine Hexfarbe dort waere am Farbwaechter vorbeigegangen,
 * ohne dass ein Test rot wird. Diese Liste wird deshalb gesucht, nicht aufgezaehlt.
 */

export const UI_DIR = join(ROOT, 'apps', 'desktop', 'src', 'ui')

export interface Stylesheet {
  /** Pfad relativ zur Wurzel, mit Schraegstrichen. */
  file: string
  css: string
}

/** Jede .css-Datei unter `dir` (rekursiv), nach Pfad sortiert. */
export function uiStylesheets(dir: string = UI_DIR): Stylesheet[] {
  const found: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.css')) found.push(full)
    }
  }
  walk(dir)
  return found
    .sort()
    .map((full) => ({ file: relative(ROOT, full).replaceAll('\\', '/'), css: readFileSync(full, 'utf8') }))
}
