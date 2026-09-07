// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialogs.tsx'

/**
 * Bedienbar ohne Maus (T-M16-07, R-UI-15, R-UI-06, Befund N12).
 *
 * Belegt war bisher der Kontrast und die Tastenzuordnung als reine Funktion. **Kein Test
 * hat je einen Dialog geoeffnet und wieder geschlossen** — also war das, was ein Mensch
 * ohne Maus tatsaechlich tut, nie geprueft. Eine Tastenzuordnung, die als Funktion
 * stimmt, sagt nichts darueber, ob der Fokus dort landet, wo er hingehoert.
 *
 * Kein Barrierefreiheits-Rahmenwerk und keine neue Abhaengigkeit: die Pruefung IST die
 * Zusage.
 */

afterEach(cleanup)

const zeige = (onClose = vi.fn()) => {
  render(
    <Dialog title="Beispiel" onClose={onClose}>
      <button type="button">Erster</button>
      <input aria-label="Feld" />
      <button type="button">Letzter</button>
    </Dialog>,
  )
  return onClose
}

describe('R-UI-15/AK1 Ein Dialog laesst sich mit der Tastatur bedienen', () => {
  it('setzt den Fokus beim Oeffnen in den Dialog', () => {
    zeige()

    const dialog = screen.getByRole('dialog', { name: 'Beispiel' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('schliesst mit Escape', () => {
    const onClose = zeige()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Beispiel' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('gibt den Fokus beim Schliessen an das ausloesende Element zurueck', () => {
    // Sonst steht der Fokus nach dem Schliessen am Anfang der Seite, und wer ohne Maus
    // arbeitet, tabbt sich zurueck zu der Stelle, an der er schon war.
    const ausloeser = document.createElement('button')
    document.body.appendChild(ausloeser)
    ausloeser.focus()

    const { unmount } = render(
      <Dialog title="Beispiel" onClose={() => undefined}>
        <button type="button">Erster</button>
      </Dialog>,
    )
    unmount()

    expect(document.activeElement).toBe(ausloeser)
    ausloeser.remove()
  })

  it('springt vom letzten Feld zurueck zum ersten, statt hinter den Dialog', () => {
    // Der Fokusfang. `aria-modal` sagt einem Vorleseprogramm, dass dahinter nichts ist —
    // die Tabulatortaste hoert nicht darauf. Ohne Fang tabbt man aus einem modalen
    // Dialog in die Karte dahinter: sichtbar verdeckt, mit der Tastatur erreichbar und
    // bedienbar. Das ist der Fehler, den ein Sehender nie bemerkt.
    //
    // Geprueft wird der SPRUNG, nicht "der Fokus ist noch drin": jsdom bewegt bei Tab
    // von sich aus gar nichts, eine solche Pruefung waere auch ohne jeden Fang gruen.
    zeige()
    const dialog = screen.getByRole('dialog', { name: 'Beispiel' })
    const schliessen = screen.getByRole('button', { name: 'Schließen' })
    const letzter = screen.getByRole('button', { name: 'Letzter' })

    letzter.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(schliessen)

    schliessen.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(letzter)
  })
})

/**
 * Der Waechter zu AK2 — er liest den Quelltext, nicht einen Bildschirm.
 *
 * Ein Knopf ohne sichtbaren Text ist fuer ein Hilfsmittel namenlos; das Kreuz eines
 * Dialogs ist der Fall, an dem es zuerst auffaellt. Geprueft wird jede Datei, nicht die
 * eine, an die gerade jemand gedacht hat.
 */
describe('R-UI-15/AK2 Bedienelemente ohne Text tragen einen Namen', () => {
  const SRC = join(process.cwd(), 'apps/desktop/src')

  const dateien = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) dateien(full, out)
      else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full)
    }
    return out
  }

  /** Woerter, Ziffern und gewoehnliche Satzzeichen — daraus besteht ein lesbarer Name. */
  const LESBAR = /^[\p{L}\p{N}\s.,:!?—-]+$/u

  it('kennt keinen Knopf mit reinem Zeichen und ohne aria-label', () => {
    const verstoesse: string[] = []

    for (const file of dateien(SRC)) {
      const text = readFileSync(file, 'utf8')
      // Ein Knopf, der ganz auf einer Zeile steht und dessen Inhalt weder `t(…)` noch
      // ein anderer Ausdruck ist: also ein Zeichen wie × oder ‖. Mehrzeilige Knoepfe
      // tragen in diesem Haus immer `t(…)`, also einen Namen.
      for (const treffer of text.matchAll(/<button([^>\n]*)>([^<>{}\n]*)<\/button>/g)) {
        const attribute = treffer[1] ?? ''
        const inhalt = (treffer[2] ?? '').trim()
        if (!inhalt || LESBAR.test(inhalt)) continue
        if (attribute.includes('aria-label')) continue
        verstoesse.push(`${file.slice(SRC.length + 1)}: <button>${inhalt}</button>`)
      }
    }

    expect(verstoesse, verstoesse.join('\n')).toEqual([])
  })

  it('beisst, wenn ein Knopf seinen Namen verliert', () => {
    // Ein Waechter, der nur gruen sein kann, ist kein Waechter. Das Kreuz des Dialogs
    // ist der Fall, den er finden muss — hier ohne sein aria-label vorgefuehrt.
    const ohneNamen = '<button type="button" className="button" onClick={onClose}>×</button>'
    const treffer = [...ohneNamen.matchAll(/<button([^>\n]*)>([^<>{}\n]*)<\/button>/g)]

    expect(treffer).toHaveLength(1)
    expect(LESBAR.test(treffer[0]![2]!.trim())).toBe(false)
    expect(treffer[0]![1]!.includes('aria-label')).toBe(false)
  })
})
