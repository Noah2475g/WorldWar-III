// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DebugPanel, LobbyDialog, NewGameDialog, localizeDebugText } from './Dialogs.tsx'
import {
  DEFAULT_NEW_GAME,
  MULTIPLAYER_SPEEDS,
  type Invitation,
  type NewGameOptions,
} from '../game/newGame.ts'

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
    expect(screen.getByText(/alles gehört/)).toBeTruthy()
  })

  it('wechselt den Satz mit der Auswahl, statt einen festen zu zeigen', () => {
    // Ein Hinweis, der sich nicht aendert, ist keine Erklaerung der Wahl.
    zeige('points')
    expect(screen.queryByText(/alles gehört/)).toBeNull()
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

/**
 * Die Debug-Ansicht spricht Namen (T-M28-04, R-UI-07, Befund V2-12, D26.4).
 *
 * Das opt-in-Debug sagte „p2" und „money" — die KI bleibt englisch und kernnah, die
 * Übersetzung passiert beim Rendern: Spieler-Kennungen werden per Wortgrenze durch
 * Machtnamen ersetzt, Rohstoffschlüssel durch die deutschen Namen aus de.ts.
 */
describe('R-UI-07 Die Debug-Ansicht spricht Namen', () => {
  const nameOf = (id: string): string => (id === 'p2' ? 'Mexiko' : id === 'p3' ? 'Kanada' : id)

  it('ersetzt Spieler-Kennungen und Rohstoffschlüssel in freier Prosa', () => {
    expect(localizeDebugText('Tauscht 500 money gegen iron', nameOf)).toBe('Tauscht 500 Geld gegen Eisen')
    expect(localizeDebugText('Mangel an oil decken', nameOf)).toBe('Mangel an Öl decken')
    expect(localizeDebugText('Greift p3 mit p2 an', nameOf)).toBe('Greift Kanada mit Mexiko an')
    // Wortgrenzen: „p2" in einer Provinzkennung wie „p22" bleibt, was es ist.
    expect(localizeDebugText('p22 bleibt stehen', nameOf)).toBe('p22 bleibt stehen')
  })

  it('bindet einen Zieltext mit Namen an den gerenderten Baum', () => {
    render(
      <DebugPanel
        enabled
        nameOf={nameOf}
        info={{
          tick: 12,
          hash: 'abcdef0123456789',
          aiGoals: [
            {
              player: 'p2',
              goal: 'Tauscht 500 money gegen iron — Mangel an iron decken',
              utility: 320,
              alternatives: ['nichts tauschen'],
            },
          ],
          commands: [],
        }}
      />,
    )

    const panel = screen.getByRole('region', { name: 'Debug' })
    expect(panel.textContent).toContain('Mexiko')
    expect(panel.textContent).toContain('Geld')
    expect(panel.textContent).toContain('Eisen')
    expect(panel.textContent).not.toContain('p2')
    expect(panel.textContent).not.toContain('money')
  })
})

/**
 * Die Partieart und die feste Geschwindigkeit im Anlegedialog (T-M37-03, R-MP-02/AK1, D28.4).
 *
 * Die Rate wird einmal gewaehlt und steht danach fest. Der Dialog muss deshalb zweierlei
 * koennen: die Wahl ueberhaupt anbieten — und zwar nur unter den Rasten ohne die Null —
 * und zeigen, was ein Gast vor dem Beitritt davon zu sehen bekaeme.
 */
describe('R-MP-02/AK1 Der Anlegedialog waehlt Partieart und feste Rate', () => {
  const zeigeMit = (options: Partial<NewGameOptions>, invitation: Invitation | null = null) => {
    const onChange = vi.fn()
    render(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, ...options }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        aiBonus={0}
        onChange={onChange}
        onStart={vi.fn()}
        onClose={vi.fn()}
        invitation={invitation}
      />,
    )
    return onChange
  }

  it('fragt nach der Partieart und bietet die Rate erst zu zweit an', () => {
    zeigeMit({ mode: 'single' })
    expect(screen.getByRole('combobox', { name: 'Partieart' })).toBeTruthy()
    // Im Einzelspieler gibt es nichts festzulegen: das Tempo ist ein Regler wie bisher.
    expect(screen.queryByRole('combobox', { name: /Feste Geschwindigkeit/ })).toBeNull()
    cleanup()

    zeigeMit({ mode: 'multiplayer' })
    expect(screen.getByRole('combobox', { name: /Feste Geschwindigkeit/ })).toBeTruthy()
  })

  it('bietet genau die Rasten ohne die Null an', () => {
    zeigeMit({ mode: 'multiplayer' })
    const select = screen.getByRole('combobox', { name: /Feste Geschwindigkeit/ }) as HTMLSelectElement
    const werte = [...select.querySelectorAll('option')].map((option) => Number(option.value))

    expect(werte).toEqual([...MULTIPLAYER_SPEEDS])
    expect(werte).not.toContain(0)
  })

  it('reicht die gewaehlte Rate nach oben durch', () => {
    const onChange = zeigeMit({ mode: 'multiplayer', fixedSpeed: 10 })
    fireEvent.change(screen.getByRole('combobox', { name: /Feste Geschwindigkeit/ }), { target: { value: '25' } })

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fixedSpeed: 25 }))
  })

  it('zeigt die Einladung mit der festen Rate darin', () => {
    const einladung: Invitation = {
      mapName: 'Welt',
      hostNation: 'Vereinigte Staaten',
      guestNation: 'Kanada',
      aiOpponents: 5,
      victory: 'points',
      fixedSpeed: 25,
    }
    zeigeMit({ mode: 'multiplayer', fixedSpeed: 25 }, einladung)
    const kasten = screen.getByRole('region', { name: 'Die Einladung nennt:' })

    expect(kasten.textContent).toContain('Welt')
    expect(kasten.textContent).toContain('Kanada')
    expect(kasten.textContent).toContain('5')
    expect(kasten.textContent).toMatch(/25 Spielstunden je Sekunde/)
  })

  it('zeigt im Einzelspieler keine Einladung, auch wenn eine gereicht wird', () => {
    // Eine Einzelspielerpartie laedt niemanden ein; ein Kasten daneben waere ein Versprechen.
    const einladung: Invitation = {
      mapName: 'Welt',
      hostNation: 'Vereinigte Staaten',
      guestNation: 'Kanada',
      aiOpponents: 5,
      victory: 'points',
      fixedSpeed: 25,
    }
    zeigeMit({ mode: 'single' }, einladung)

    expect(screen.queryByRole('region', { name: 'Die Einladung nennt:' })).toBeNull()
  })
})

/**
 * Der Gastgeber sieht, wer wartet — und startet (T-M39-03, R-MP-12/AK2, D28.10).
 *
 * Drei Zustaende, und der mittlere ist der, den man leicht vergisst: niemand da, jemand da
 * OHNE Namen, jemand da mit Namen. Der Gastgeber soll sehen, dass sein Link angekommen
 * ist, bevor der andere getippt hat — sonst klebt er ihn ein zweites Mal in den Chat.
 */
describe('R-MP-12/AK2 Der Gastgeber sieht, wer wartet, und startet', () => {
  const zeigeLobby = (extra: Partial<Parameters<typeof LobbyDialog>[0]> = {}) => {
    const onBegin = vi.fn()
    render(
      <LobbyDialog
        guestLink="http://100.101.102.103:7749/#/beitreten?raum=r&s=g"
        guestName={null}
        offered
        phase="lobby"
        reason={null}
        onBegin={onBegin}
        onLeave={vi.fn()}
        {...extra}
      />,
    )
    return onBegin
  }

  it('zeigt den Link, den Noah verschickt — den fuer den GAST, nicht den eigenen', () => {
    zeigeLobby()
    const feld = screen.getByLabelText(/Link verschicken/i) as HTMLInputElement

    expect(feld.value).toContain('#/beitreten')
    expect(feld.value, 'der eigene Weg steht im Link fuer den Gast').not.toContain('gastgeben')
  })

  it('unterscheidet „niemand da" von „da, aber noch ohne Namen"', () => {
    zeigeLobby({ guestName: null })
    expect(screen.getByText(/Es wartet noch niemand/)).toBeTruthy()
    cleanup()

    zeigeLobby({ guestName: '' })
    expect(screen.getByText(/Jemand hat den Link geöffnet/)).toBeTruthy()
    cleanup()

    zeigeLobby({ guestName: 'Jonas' })
    expect(screen.getByText(/Jonas wartet auf den Start/)).toBeTruthy()
  })

  it('laesst erst starten, wenn die Partie angelegt ist UND ein Gast mit Namen wartet', () => {
    const knopf = () => screen.getByRole('button', { name: 'Partie starten' }) as HTMLButtonElement

    zeigeLobby({ offered: false, guestName: 'Jonas' })
    expect(knopf().disabled, 'ohne angelegte Partie gaebe es nichts zu starten').toBe(true)
    cleanup()

    zeigeLobby({ offered: true, guestName: null })
    expect(knopf().disabled, 'ohne Gast waere der Start ein Alleingang').toBe(true)
    cleanup()

    zeigeLobby({ offered: true, guestName: '' })
    expect(knopf().disabled, 'ein Gast ohne Namen hat noch nicht beigetreten').toBe(true)
    cleanup()

    const onBegin = zeigeLobby({ offered: true, guestName: 'Jonas' })
    expect(knopf().disabled).toBe(false)
    fireEvent.click(knopf())
    expect(onBegin).toHaveBeenCalledTimes(1)
  })

  it('sagt, dass zuerst die Partie angelegt werden muss', () => {
    zeigeLobby({ offered: false })
    expect(screen.getByText(/Legen Sie zuerst die Partie an/)).toBeTruthy()
  })

  it('nennt den Grund, wenn der Beitritt abgewiesen wurde', () => {
    // Ein Ende ohne Grund ist fuer den Spieler ein Absturz.
    zeigeLobby({ phase: 'refused', reason: 'Dieser Link passt zu keiner Partie auf diesem Rechner.' })
    expect(screen.getByText(/passt zu keiner Partie/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Partie starten' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
