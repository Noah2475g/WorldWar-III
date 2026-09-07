// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewGameDialog } from './Dialogs.tsx'
import { DEFAULT_NEW_GAME } from '../game/newGame.ts'

/**
 * Die Siegbedingung erklaert sich (R-GAME-02/AK1, Playtest-Frage 4a, 2026-09-06).
 *
 * Der Startdialog liess "Punkte" und "Eroberung" waehlen und sagte an keiner Stelle, was
 * sie bedeuten — waehrend direkt darueber unter "Startzahl" ein erklaerender Satz stand.
 * Die Wahl entscheidet, wie die Partie endet; sie darf nicht unerklaerter dastehen als
 * die Zufallszahl.
 *
 * Die Zahlen im Hinweis sind keine Erfindung: newGame.ts setzt fuer Punkte 700 und fuer
 * Eroberung 1000 von 1000 Siegpunktanteilen. Dieser Test haelt beide Seiten zusammen —
 * aendert jemand die Schwelle, ohne den Satz zu aendern, faellt er.
 */

afterEach(cleanup)

function zeige(victory: 'points' | 'conquest') {
  const onChange = vi.fn()
  render(
    <NewGameDialog
      options={{ ...DEFAULT_NEW_GAME, victory }}
      nations={['Vereinigte Staaten', 'Kanada']}
      maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
      aiBonus={0}
      onChange={onChange}
      onStart={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  return onChange
}

/**
 * Start mit Gesicht (T-M22-04, R-UI-05, Befund V2-03).
 *
 * Der erste Eindruck sagte „Formular", nicht „Strategiespiel": kein Titel, kein Name,
 * keine Fassung. Der Startdialog traegt jetzt eine Titelzeile — Spielname, Untertitel,
 * Versionszeile — und, wenn ein Stand existiert, „Weiterspielen (Tag N)" als ersten
 * Knopf (der Ladeweg selbst ist in App.test.tsx geprueft).
 */
describe('R-UI-05 Der Startdialog traegt ein Gesicht', () => {
  it('nennt Spielname, Untertitel und Fassung', () => {
    zeige('points')

    expect(screen.getByRole('heading', { name: 'WorldWar' })).toBeTruthy()
    expect(document.querySelector('.start__subtitle')?.textContent?.length ?? 0).toBeGreaterThan(0)
    // Die Fassung kommt aus package.json — nicht als zweite Wahrheit im Text.
    const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8')) as { version: string }
    expect(screen.getByText(`Fassung ${pkg.version}`)).toBeTruthy()
  })

  it('stellt Weiterspielen als ersten Knopf des Rumpfes vor alles andere', () => {
    const onResume = vi.fn()
    render(
      <NewGameDialog
        options={DEFAULT_NEW_GAME}
        nations={['Vereinigte Staaten']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        aiBonus={0}
        resume={{ day: 4 }}
        onResume={onResume}
        onChange={vi.fn()}
        onStart={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const first = document.querySelector('.dialog__body button')
    expect(first?.textContent).toBe('Weiterspielen (Tag 4)')
    fireEvent.click(first!)
    expect(onResume).toHaveBeenCalled()
  })

  it('zeigt ohne Spielstand keinen Weiterspielen-Knopf', () => {
    zeige('points')

    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull()
  })
})

describe('R-GAME-02/AK1 Der Startdialog erklaert die Siegbedingung', () => {
  it('nennt beim Punktesieg die Schwelle', () => {
    zeige('points')
    expect(screen.getByText(/70 % aller Siegpunkte/)).toBeTruthy()
  })

  it('nennt bei der Eroberung, dass alles gehoeren muss', () => {
    zeige('conquest')
    expect(screen.getByText(/alles gehoert/)).toBeTruthy()
  })

  it('wechselt den Satz mit der Auswahl, statt einen festen zu zeigen', () => {
    // Ein Hinweis, der sich nicht aendert, ist keine Erklaerung der Wahl.
    zeige('points')
    expect(screen.queryByText(/alles gehoert/)).toBeNull()
    cleanup()
    zeige('conquest')
    expect(screen.queryByText(/70 % aller Siegpunkte/)).toBeNull()
  })

  it('meldet die Umstellung nach oben, damit die Wahl auch wirkt', () => {
    // Die Kartenwahl daneben ist ein Blindschalter (Playtest-Frage 4). Hier wird
    // wenigstens geprueft, dass die Siegbedingung ihren Wert weitergibt.
    const onChange = zeige('points')
    const feld = screen.getByDisplayValue('Punkte')
    fireEvent.change(feld, { target: { value: 'conquest' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ victory: 'conquest' }))
  })
})
