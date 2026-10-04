// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DebugPanel,
  Dialog,
  JoinDialog,
  LobbyDialog,
  MenuDialog,
  NewGameDialog,
  SavesDialog,
  KeyboardHelp,
  SettingsDialog,
  localizeDebugText,
} from './Dialogs.tsx'
import { MENU_ENTRIES } from './menuEntries.ts'
import { resolveKey } from '../keyboard.ts'
import { DEFAULT_SETTINGS } from '../state/uiState.ts'
import {
  DEFAULT_NEW_GAME,
  MULTIPLAYER_SPEEDS,
  gameModesFor,
  type GameMode,
  type Invitation,
  type NewGameOptions,
} from '../game/newGame.ts'
import { hasKey } from '../i18n/text.ts'

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
      modes={gameModesFor(true, true)}
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
        modes={gameModesFor(true, true)}
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
  const zeigeMit = (
    options: Partial<NewGameOptions>,
    invitation: Invitation | null = null,
    modes: readonly GameMode[] = gameModesFor(true, true),
  ) => {
    const onChange = vi.fn()
    render(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, ...options }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={modes}
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
 * Der Anlegedialog verspricht nur, was DIESER Bau kann (T-M39-11, Befunde V-1 und MP-5).
 *
 * **V-1**, gemessen am 2026-09-14 am ausgelieferten Programm: der Waehler „Partieart" bot
 * dort beide Werte an, obwohl `__MULTIPLAYER__` in diesem Bau ein literales `false` ist —
 * wer „Zu zweit ueber einen Link" waehlte, bekam eine Einzelspielerpartie mit fester Rate
 * und ohne Vorspulen. Kein Netzzugriff, kein Fehler, aber ein Versprechen ohne Deckung.
 *
 * **MP-5**: unter der Einladungsvorschau stand „Die Verbindung zum Mitspieler kommt mit
 * dem naechsten Ausbau; die Partie beginnt vorerst lokal." Das war in M37 richtig und ist
 * seit M38/M39 falsch.
 *
 * Geprueft werden **beide Werte der Bauflagge**, und zwar ohne sie zu setzen: sie ist eine
 * Ersetzung beim Bauen und steht im Testlauf fest. `gameModesFor()` ist die eine Stelle,
 * die aus ihr eine Liste macht; die Liste reicht `App.tsx` herein, und ein Test kann sie
 * so in beiden Auspraegungen herstellen.
 *
 * **Nacharbeit vom 2026-09-24:** die Flagge allein war der falsche Massstab. Der Hostbau
 * ohne Raum (der Hostdienst liefert `/` aus, ohne `#/gastgeben`) bot die zweite Art weiter
 * an und lieferte die erste. `gameModesFor()` nimmt deshalb eine zweite Frage herein: gibt
 * es einen Raum, den dieser Bildschirm fuehrt? Und der Start reicht die Art weiter, die der
 * Dialog angeboten hat — nicht die, die zufaellig im Formular stand.
 */
describe('R-FREE-04 Der Anlegedialog bietet keine Partieart an, die dieser Bau nicht kann', () => {
  const einladung: Invitation = {
    mapName: 'Welt',
    hostNation: 'Vereinigte Staaten',
    guestNation: 'Kanada',
    aiOpponents: 5,
    victory: 'points',
    fixedSpeed: 25,
  }

  const zeigeMit = (
    options: Partial<NewGameOptions>,
    invitation: Invitation | null,
    modes: readonly GameMode[],
  ) => {
    const onStart = vi.fn()
    render(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, ...options }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={modes}
        aiBonus={0}
        onChange={vi.fn()}
        onStart={onStart}
        onClose={vi.fn()}
        invitation={invitation}
      />,
    )
    return onStart
  }

  it('macht aus der Bauflagge die Partiearten — beide Werte', () => {
    expect(gameModesFor(true, true)).toEqual(['single', 'multiplayer'])
    expect(gameModesFor(false, false)).toEqual(['single'])
  })

  it('bietet zu zweit nur an, wenn es einen Raum gibt — die Flagge allein reicht nicht', () => {
    // Der Hostbau ohne Raum: `__MULTIPLAYER__` ist wahr, aber es gibt keine Leitung.
    expect(gameModesFor(true, false)).toEqual(['single'])
    // Und ein Raum ohne Hostbau kommt nicht vor (main.tsx baut ihn nur hinter der Flagge);
    // auch dann bleibt es beim Einzelspieler.
    expect(gameModesFor(false, true)).toEqual(['single'])
  })

  it('reicht beim Start die Art weiter, die er angeboten hat — nicht die alte Wahl im Formular', () => {
    const onStart = zeigeMit({ mode: 'multiplayer', fixedSpeed: 25 }, einladung, gameModesFor(true, false))
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    expect(onStart).toHaveBeenCalledWith('single')
  })

  it('reicht zu zweit weiter, wenn es angeboten und gewaehlt ist — die Gegenprobe', () => {
    const onStart = zeigeMit({ mode: 'multiplayer', fixedSpeed: 25 }, einladung, gameModesFor(true, true))
    fireEvent.click(screen.getByRole('button', { name: 'Partie beginnen' }))

    expect(onStart).toHaveBeenCalledWith('multiplayer')
  })

  it('zeigt im Hostbau mit Raum den Waehler mit beiden Arten', () => {
    zeigeMit({ mode: 'single' }, null, gameModesFor(true, true))
    const waehler = screen.getByRole('combobox', { name: 'Partieart' }) as HTMLSelectElement

    expect([...waehler.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Allein gegen den Rechner',
      'Zu zweit über einen Link',
    ])
  })

  it('zeigt im netzfreien Bau gar keinen Waehler — eine Wahl mit einem Wert ist keine', () => {
    zeigeMit({ mode: 'single' }, einladung, gameModesFor(false, false))

    expect(screen.queryByRole('combobox', { name: 'Partieart' })).toBeNull()
    // Und der Satz, der die zweite Art beschreibt, steht auch sonst nirgends im Dialog.
    expect(screen.queryByText('Zu zweit über einen Link')).toBeNull()
  })

  it('haelt im netzfreien Bau auch Rate und Einladung heraus, wenn die alte Wahl stehen blieb', () => {
    // Der Fall, den ein blosses Verstecken des Waehlers offen liesse: `options.mode` traegt
    // noch 'multiplayer' — aus einem alten Formularstand, einem Spielstand, einem Link.
    zeigeMit({ mode: 'multiplayer', fixedSpeed: 25 }, einladung, gameModesFor(false, false))

    expect(screen.queryByRole('combobox', { name: /Feste Geschwindigkeit/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Die Einladung nennt:' })).toBeNull()
  })

  it('MP-5: die Einladung traegt nur Angaben und kein Versprechen mehr', () => {
    zeigeMit({ mode: 'multiplayer', fixedSpeed: 25 }, einladung, gameModesFor(true, true))
    const kasten = screen.getByRole('region', { name: 'Die Einladung nennt:' })

    // Die vier Angaben stehen, der Satz aus M37 steht nicht mehr.
    expect(kasten.querySelectorAll('li')).toHaveLength(4)
    expect(kasten.textContent).not.toMatch(/nächsten Ausbau/)
    expect(kasten.textContent).not.toMatch(/vorerst lokal/)
    expect(kasten.querySelector('small')).toBeNull()
  })

  it('MP-5: den Schluessel gibt es nicht mehr — kein Waisentext im Katalog', () => {
    expect(hasKey('newGame.multiplayerPending')).toBe(false)
    // Die Gegenprobe, damit die Zeile darueber nicht bloss einen Tippfehler bestaetigt.
    expect(hasKey('newGame.invitationSpeed')).toBe(true)
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

/**
 * Das Dialog-Gerüst mit fester Fußzeile (T-M44-05, R-UX-05/AK1, R-UX-01/AK2).
 *
 * Gemessen am 2026-10-03: „Partie beginnen“ lag bei 1280×800 auf y = 733, der Dialog endet
 * bei 720 — wer nicht im Dialog rollt, findet die Hauptaktion nicht. Das Gerüst teilt den
 * Dialog darum in drei Streifen: Kopf und Fußzeile stehen fest, nur der Körper rollt. jsdom
 * rechnet kein Layout; hier steht deshalb die Bauweise (Aktionen außerhalb des rollenden
 * Körpers, Rollen am Körper), die Größen prüft `pnpm ux:check --only R-UX-05/AK1`.
 */
describe('R-UX-05/AK1 Die Hauptaktion eines Dialogs steht in einer festen Fußzeile', () => {
  const inFuss = (name: string) => {
    const knopf = screen.getByRole('button', { name })
    const fuss = knopf.closest('.dialog__foot')
    expect(fuss, `„${name}“ steht nicht in .dialog__foot`).toBeTruthy()
    expect(knopf.closest('.dialog__body'), `„${name}“ steht im rollenden Körper`).toBeNull()
    return fuss as HTMLElement
  }

  it('Partie beginnen und Spielstände stehen außerhalb des rollenden Körpers', () => {
    render(
      <NewGameDialog
        options={DEFAULT_NEW_GAME}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={gameModesFor(true, true)}
        aiBonus={0}
        onChange={vi.fn()}
        onStart={vi.fn()}
        onClose={vi.fn()}
        onSaves={vi.fn()}
      />,
    )

    const fuss = inFuss('Partie beginnen')
    expect(fuss.contains(screen.getByRole('button', { name: 'Spielstände' }))).toBe(true)
    // Der Körper steht vor der Fußzeile, nicht dahinter: die Fußzeile ist der letzte Streifen.
    const dialog = fuss.parentElement!
    expect([...dialog.children].map((kind) => kind.className)).toEqual([
      'dialog__head',
      'dialog__body',
      'dialog__foot',
    ])
  })

  it('Beitritt: „Beitreten“ steht in der Fußzeile, der Name im Körper', () => {
    render(
      <JoinDialog
        terms={{ ownNation: 'Kanada', hostNation: 'Mexiko', aiOpponents: 2, victory: 'points', fixedSpeed: 5 }}
        mapName="Welt"
        phase="lobby"
        reason={null}
        joined={false}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
      />,
    )

    const fuss = inFuss('Beitreten')
    expect(fuss).toBeTruthy()
    expect(screen.getByLabelText(/Name/).closest('.dialog__body')).toBeTruthy()
  })

  it('Lobby: Starten und Verlassen stehen in der Fußzeile, das Kopieren des Links im Körper', () => {
    render(
      <LobbyDialog
        guestLink="http://x/#/beitreten"
        guestName="Jonas"
        offered
        phase="lobby"
        reason={null}
        onBegin={vi.fn()}
        onLeave={vi.fn()}
      />,
    )

    const fuss = inFuss('Partie starten')
    expect(fuss.querySelectorAll('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Link/ }).closest('.dialog__body')).toBeTruthy()
  })

  it('der Körper rollt, Kopf und Fußzeile nicht (Kaskade)', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      render(
        <Dialog title="Beispiel" onClose={vi.fn()} foot={<button type="button">Los</button>}>
          <p>Inhalt</p>
        </Dialog>,
      )
      const dialog = screen.getByRole('dialog')
      const rechne = (selector: string) => getComputedStyle(dialog.querySelector(selector)!)

      expect(getComputedStyle(dialog).display).toBe('flex')
      expect(getComputedStyle(dialog).flexDirection).toBe('column')
      expect(getComputedStyle(dialog).overflowY).toBe('hidden')
      expect(rechne('.dialog__body').overflowY).toBe('auto')
      expect(rechne('.dialog__foot').flexShrink).toBe('0')
      expect(rechne('.dialog__head').flexShrink).toBe('0')
    } finally {
      style.remove()
    }
  })
})

/**
 * Spielstände als Liste (T-M44-05, R-UX-01/AK2): `.slots` heißt auch das Bauplatzraster mit
 * vier Spalten (T-M29-03) — die spätere Regel gewann gegen die Liste, und der Dialog lief
 * waagerecht über (gemessen 604 > 518 und 592 > 494). Die Liste trägt darum ein eigenes
 * Kennzeichen und zeichnet eine Zeile je Platz.
 */
describe('R-UX-01/AK2 Die Spielstandliste ist eine Liste und kein Raster', () => {
  const plaetze = [
    { name: 'manual-0', label: 'Stand 1', savedAtDay: 12 },
    { name: 'manual-1', label: 'Stand 2', savedAtDay: null },
  ]

  it('zeichnet eine Zeile je Platz mit Tag oder „leer“', () => {
    render(<SavesDialog slots={plaetze} onSave={vi.fn()} onLoad={vi.fn()} onClose={vi.fn()} notice={null} />)

    const zeilen = [...document.querySelectorAll('.slots--saves > li')]
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]!.textContent).toContain('Stand 1')
    expect(zeilen[0]!.textContent).toContain('Tag 12')
    expect(zeilen[1]!.textContent).toContain('leer')
  })

  it('wird von der späteren Rasterregel nicht erfasst (Kaskade)', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      render(<SavesDialog slots={plaetze} onSave={vi.fn()} onLoad={vi.fn()} onClose={vi.fn()} notice={null} />)
      const liste = document.querySelector('.slots--saves')!
      expect(getComputedStyle(liste).display).toBe('flex')
      expect(getComputedStyle(liste).gridTemplateColumns).toBe('none')
      expect(getComputedStyle(document.querySelector('.slots--saves .slot')!).flexDirection).toBe('row')
    } finally {
      style.remove()
    }
  })
})

/**
 * Die Rückfrage in den Dialogen (T-M44-09a, R-UX-04/AK1, Entscheid F2): Überschreiben,
 * Zurücksetzen und „neue Partie aus laufender Partie“ brauchen den zweiten Klick am selben
 * Knopf. Ein leerer Platz und ein Laden fragen nicht — dort geht nichts verloren.
 */
describe('R-UX-04/AK1 Folgenschweres in den Dialogen fragt nach', () => {
  it('einen belegten Stand überschreiben: erst der zweite Klick speichert', () => {
    const onSave = vi.fn()
    render(
      <SavesDialog
        slots={[{ name: 'manual-0', label: 'Stand 1', savedAtDay: 12 }]}
        onSave={onSave}
        onLoad={vi.fn()}
        onClose={vi.fn()}
        notice={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(onSave).not.toHaveBeenCalled()
    const frage = screen.getByRole('button', { name: /Stand 1 wird überschrieben/ })
    fireEvent.click(frage)

    expect(onSave).toHaveBeenCalledExactlyOnceWith('manual-0')
  })

  it('einen leeren Platz speichern: ein Klick, keine Frage', () => {
    const onSave = vi.fn()
    render(
      <SavesDialog
        slots={[{ name: 'manual-1', label: 'Stand 2', savedAtDay: null }]}
        onSave={onSave}
        onLoad={vi.fn()}
        onClose={vi.fn()}
        notice={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith('manual-1')
  })

  it('Escape beantwortet die Frage, schließt aber den Dialog nicht', () => {
    const onClose = vi.fn()
    render(
      <SavesDialog
        slots={[{ name: 'manual-0', label: 'Stand 1', savedAtDay: 12 }]}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClose={onClose}
        notice={null}
      />,
    )
    const knopf = screen.getByRole('button', { name: 'Speichern' })
    fireEvent.click(knopf)

    fireEvent.keyDown(knopf, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy()

    fireEvent.keyDown(knopf, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Einstellungen zurücksetzen: erst der zweite Klick setzt zurück', () => {
    const onReset = vi.fn()
    render(
      <SettingsDialog
        settings={{ ...DEFAULT_SETTINGS, sound: false }}
        onChange={vi.fn()}
        onReset={onReset}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Auf Vorgabe zurücksetzen' }))
    expect(onReset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Vorgabe zurück/ }))

    expect(onReset).toHaveBeenCalledOnce()
  })

  it('Einstellungen auf Vorgabe: der Knopf bleibt gesperrt, es gibt nichts zurückzusetzen', () => {
    render(<SettingsDialog settings={DEFAULT_SETTINGS} onChange={vi.fn()} onReset={vi.fn()} onClose={vi.fn()} />)

    expect((screen.getByRole('button', { name: 'Auf Vorgabe zurücksetzen' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('Neue Partie im Menü: erst der zweite Klick wählt den Eintrag', () => {
    const onSelect = vi.fn()
    render(<MenuDialog entries={MENU_ENTRIES} onSelect={onSelect} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Neue Partie' }))
    expect(onSelect).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /Partie wird verlassen/ }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ target: 'new' }))
  })

  it('Spielstände und Einstellungen im Menü fragen nicht', () => {
    const onSelect = vi.fn()
    render(<MenuDialog entries={MENU_ENTRIES} onSelect={onSelect} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Spielstände' }))
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }))

    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})

/**
 * Erkennen statt Erinnern (T-M44-16, R-UX-05): die Einstellungen nennen ihre Einheiten, die
 * Höchstgeschwindigkeit ist eine Auswahl der Tempostufen — und die Tastenkürzel sind aus dem
 * Menü erreichbar, nicht nur mit der Taste, die man kennen muss.
 */
describe('R-UX-05 Einstellungen mit Einheiten, Tastenkürzel im Menü', () => {
  const zeigeEinstellungen = (extra: Partial<typeof DEFAULT_SETTINGS> = {}) => {
    const onChange = vi.fn()
    render(
      <SettingsDialog
        settings={{ ...DEFAULT_SETTINGS, ...extra }}
        onChange={onChange}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    return onChange
  }

  it('nennt hinter dem Feld des Speicherabstands die Einheit', () => {
    zeigeEinstellungen({ autosaveMinutes: 5 })
    expect(screen.getByText('Minuten')).toBeTruthy()
    cleanup()

    zeigeEinstellungen({ autosaveMinutes: 1 })
    expect(screen.getByText('Minute')).toBeTruthy()
  })

  it('bietet die Höchstgeschwindigkeit als Auswahl der Tempostufen an, ohne die Pause', () => {
    const onChange = zeigeEinstellungen({ maxSpeed: 100 })
    const wahl = screen.getByLabelText('Höchstgeschwindigkeit') as HTMLSelectElement

    expect(wahl.tagName).toBe('SELECT')
    expect([...wahl.options].map((option) => option.value)).toEqual(['1', '2', '5', '10', '25', '50', '100'])
    expect(wahl.options[0]!.textContent).toBe('1 Stunden je Sekunde')
    expect(wahl.value).toBe('100')

    fireEvent.change(wahl, { target: { value: '25' } })
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ maxSpeed: 25 })
  })

  it('zeigt einen gespeicherten Wert zwischen den Stufen, statt ihn stumm umzuschreiben', () => {
    zeigeEinstellungen({ maxSpeed: 7 })
    const wahl = screen.getByLabelText('Höchstgeschwindigkeit') as HTMLSelectElement

    expect(wahl.value).toBe('7')
    expect([...wahl.options].map((option) => option.value)).toContain('7')
  })

  it('führt im Menü den Eintrag „Tastenkürzel“, der die Übersicht öffnet', () => {
    const onSelect = vi.fn()
    render(<MenuDialog entries={MENU_ENTRIES} onSelect={onSelect} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tastenkürzel' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ target: 'keys' }))
  })
})

/**
 * Der Startdialog erklärt sich (T-M44-15, R-UX-05/AK4): Gegner, Schwierigkeit und Startzahl
 * tragen je eine Kurzhilfe unter dem Feld — wie die Siegbedingung und die Rate es schon tun.
 */
describe('R-UX-05/AK4 Der Startdialog trägt zu jedem Feld eine Kurzhilfe', () => {
  it('erklärt Gegner, Schwierigkeit und Startzahl', () => {
    zeige('points')

    for (const feld of ['Gegner', 'Schwierigkeit', 'Startzahl']) {
      const label = screen.getByText(feld).closest('label')!
      const hilfe = label.querySelector('small')
      expect(hilfe?.textContent?.length ?? 0, `${feld} ohne Kurzhilfe`).toBeGreaterThan(15)
    }
  })

  it('bindet die Kurzhilfe an das Feld, damit ein Vorleseprogramm sie mit vorliest', () => {
    zeige('points')

    for (const feld of ['Gegner', 'Schwierigkeit']) {
      const label = screen.getByText(feld).closest('label')!
      const eingabe = label.querySelector('input, select')!
      const hilfe = label.querySelector('small')!
      expect(hilfe.id).not.toBe('')
      expect(eingabe.getAttribute('aria-describedby')).toBe(hilfe.id)
    }
  })

  it('wechselt den Satz zur Schwierigkeit mit der Wahl', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, difficulty: 'easy' }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={gameModesFor(true, true)}
        aiBonus={0}
        onChange={onChange}
        onStart={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const hilfe = () => screen.getByText('Schwierigkeit').closest('label')!.querySelector('small')!.textContent
    const leicht = hilfe()

    rerender(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, difficulty: 'hard' }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={gameModesFor(true, true)}
        aiBonus={0}
        onChange={onChange}
        onStart={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(hilfe()).not.toBe(leicht)
  })
})

/**
 * T-M44-16 vollständig (Durchsicht B, Befund 2): die Tastenübersicht nennt jede Taste, die
 * `keyboard.ts` wirklich belegt — gegengeprüft an der Quelle, nicht an einer zweiten Liste im Test.
 */
describe('R-UX-05 Die Tastenübersicht nennt alle echten Tastenbelegungen', () => {
  const context = { speed: 1, mode: 'political', typing: false, dialogOpen: false, fastForwarding: false } as const
  /** Je Taste: was `resolveKey` tut und welche Zeile der Übersicht sie nennen muss (Glyphe im Text). */
  const BELEGUNG: ReadonlyArray<{ key: string; ctrl?: boolean; type: string; glyph: RegExp }> = [
    { key: ' ', type: 'togglePause', glyph: /Leertaste/ },
    { key: '+', type: 'speed', glyph: /\+/ },
    { key: '-', type: 'speed', glyph: /−/ },
    { key: 'f', type: 'fastForward', glyph: /F — vorspulen/ },
    { key: 'm', type: 'cycleMode', glyph: /M — / },
    { key: 'd', type: 'openPanel', glyph: /D — Diplomatie/ },
    { key: 'h', type: 'openPanel', glyph: /H — Markt/ },
    { key: 'l', type: 'openPanel', glyph: /L — Lage der Mächte/ },
    { key: 's', type: 'openPanel', glyph: /S — Spionage/ },
    { key: 'a', type: 'openPanel', glyph: /A — Heer/ },
    { key: 's', ctrl: true, type: 'save', glyph: /Strg\+S/ },
    { key: 'l', ctrl: true, type: 'load', glyph: /Strg\+L/ },
    { key: 'F1', type: 'help', glyph: /F1/ },
    { key: '?', type: 'help', glyph: /\?/ },
    { key: 'ArrowLeft', type: 'pan', glyph: /Pfeiltasten — Karte verschieben/ },
    { key: 'ArrowRight', type: 'pan', glyph: /Pfeiltasten/ },
    { key: 'ArrowUp', type: 'pan', glyph: /Pfeiltasten/ },
    { key: 'ArrowDown', type: 'pan', glyph: /Pfeiltasten/ },
    { key: 'PageUp', type: 'zoom', glyph: /Bild↑/ },
    { key: 'PageDown', type: 'zoom', glyph: /Bild↓/ },
    { key: 'Home', type: 'centreCapital', glyph: /Pos1/ },
    { key: 'Escape', type: 'close', glyph: /Escape/ },
  ]

  it('führt zu jeder belegten Taste eine Zeile (heute rot: L, Pfeiltasten und ? fehlen)', () => {
    render(<KeyboardHelp onClose={vi.fn()} />)
    const text = screen.getByRole('dialog').textContent ?? ''
    for (const { key, ctrl, type, glyph } of BELEGUNG) {
      const shortcut = resolveKey({ key, ctrlKey: ctrl === true }, context)
      expect(shortcut?.type, `resolveKey(${ctrl ? 'Strg+' : ''}${key})`).toBe(type)
      expect(text, `Übersicht nennt ${ctrl ? 'Strg+' : ''}${key}`).toMatch(glyph)
    }
  })

  it('deckt jeden `case` in keyboard.ts ab (eine neue Taste ohne Zeile fällt hier auf)', () => {
    const source = readFileSync(`${process.cwd()}/apps/desktop/src/keyboard.ts`, 'utf8')
    const cases = [...source.matchAll(/case '([^']+)':/g)].map((match) => match[1]!.toLowerCase())
    const known = new Set(BELEGUNG.map((entry) => entry.key.toLowerCase()).concat(['=', '−']))
    for (const key of cases) expect(known.has(key), `keyboard.ts belegt ${key}, die Übersicht nicht`).toBe(true)
  })

  it('heißt wie der Menüpunkt: Tastenkürzel', () => {
    render(<KeyboardHelp onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Tastenkürzel' })).toBeTruthy()
  })
})

describe('Durchsicht B · Startdialog: Fokus und Siegschwelle', () => {
  const zeigeStart = (extra: Record<string, unknown> = {}) =>
    render(
      <NewGameDialog
        options={{ ...DEFAULT_NEW_GAME, victory: 'points' }}
        nations={['Vereinigte Staaten', 'Kanada']}
        maps={[{ id: 'world', name: 'Welt', data: { provinces: new Array(237) } }]}
        modes={gameModesFor(true, true)}
        aiBonus={0}
        onChange={vi.fn()}
        onStart={vi.fn()}
        onClose={vi.fn()}
        {...extra}
      />,
    )

  it('setzt den Fokus auf „Partie beginnen“, wenn es nichts zum Weiterspielen gibt (heute rot)', () => {
    zeigeStart()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Partie beginnen' }))
  })

  it('lässt „Weiterspielen“ den Fokus, wenn es da ist', () => {
    zeigeStart({ resume: { day: 3 }, onResume: vi.fn() })
    expect((document.activeElement as HTMLElement).textContent).toMatch(/Weiterspielen/)
  })

  it('nennt die Schwelle aus der Konfiguration, nicht eine feste Zahl (heute rot)', () => {
    zeigeStart({ pointsGoal: 65 })
    expect(screen.getByText(/65 % aller Siegpunkte/)).toBeTruthy()
    expect(screen.queryByText(/70 % aller Siegpunkte/)).toBeNull()
  })
})
