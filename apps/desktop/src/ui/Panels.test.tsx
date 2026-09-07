// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PublicView, VisibleProvince } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { TOKENS } from './tokens.ts'
import {
  DiplomacyPanel,
  EconomyPanel,
  EventLog,
  ProvincePanel,
  buildingItems,
  buttonTitle,
  depositItems,
  type Action,
  type EventEntry,
} from './Panels.tsx'

/**
 * The side panels, once symbols carry what sentences used to (T-M13-01, R-UI-10).
 *
 * What is tested here is deliberately not "does it look nice" but the two things that
 * decide whether the change is an improvement or a decoration: the symbol is the right
 * one for the thing, and every symbol still says its name for a screen reader.
 */

afterEach(cleanup)

/** Eine Spielerfarbe, wie sie aus der Sicht kaeme — nicht als Literal im Quelltext. */
const FARBE = TOKENS.accent

const province: VisibleProvince = {
  id: 'USA-MW',
  name: 'Mittlerer Westen',
  owner: 'p1',
  kind: 'city',
  terrain: 'plains',
  coastal: false,
  neighbors: [],
  seaLinks: [],
  morale: 70_000,
  population: 670_000,
  deposits: { food: 5000, coal: 2000, iron: 1000 },
  buildings: { barracks: 1, factory: 2 },
  buildQueueLength: 0,
  stale: false,
  asOfTick: 0,
}

const action = (id: string, icon: Action['icon'], label: string): Action => ({
  id,
  label,
  ...(icon ? { icon } : {}),
  disabledReason: null,
  onRun: () => undefined,
})

describe('R-UI-10 Vorkommen und Gebaeude als Symbolzeile', () => {
  it('macht aus Vorkommen Symbole mit ganzen Mengen', () => {
    // The core counts in thousandths; the row counts in whole units.
    expect(depositItems({ food: 5000, coal: 2000 })).toEqual([
      { icon: 'food', label: 'Nahrung', count: 5 },
      { icon: 'coal', label: 'Kohle', count: 2 },
    ])
  })

  it('laesst leere Vorkommen weg, statt eine Null zu zeichnen', () => {
    expect(depositItems({ food: 5000, oil: 0 })).toHaveLength(1)
  })

  it('macht aus Gebaeuden Symbole mit ihrer Stufe', () => {
    expect(buildingItems({ barracks: 1, factory: 2 })).toEqual([
      { icon: 'barracks', label: 'Kaserne', count: 1 },
      { icon: 'factory', label: 'Fabrik', count: 2 },
    ])
  })

  it('zeigt Vorkommen und Gebaeude im Panel als Symbole mit Textfassung', () => {
    render(<ProvincePanel province={province} ownerName="Vereinigte Staaten" actions={[]} ticksPerDay={24} currentTick={0} />)

    expect(screen.getByRole('img', { name: '5 Nahrung' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Kaserne' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '2 Fabrik' })).toBeTruthy()
  })
})

describe('R-UI-10 Befehlsknoepfe tragen ihr Symbol', () => {
  it('zeichnet das Symbol des Gebaeudes auf den Bauknopf', () => {
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[]}
        groups={[{ id: 'build', title: 'Bauen', actions: [action('build-barracks', 'barracks', 'Kaserne')] }]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

    const button = screen.getByRole('button', { name: 'Kaserne' })
    expect(button.querySelector('svg'), 'Der Bauknopf traegt kein Symbol').toBeTruthy()
  })

  it('bleibt ohne Symbol bedienbar — ein Befehl ohne Bild ist kein Fehler', () => {
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[action('set-capital', undefined, 'Hauptstadt verlegen')]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Hauptstadt verlegen' })).toBeTruthy()
  })
})

describe('R-UI-09 Moral als Balken mit Trend', () => {
  const withMorale = (morale: number, moraleTarget?: number): VisibleProvince => ({
    ...province,
    morale,
    ...(moraleTarget === undefined ? {} : { moraleTarget }),
  })

  it('zeigt die Moral als Anzeige mit ihrem Wert', () => {
    render(<ProvincePanel province={withMorale(70_000)} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />)

    const meter = screen.getByRole('meter', { name: 'Moral' })
    expect(meter.getAttribute('aria-valuenow')).toBe('70000')
    expect(meter.textContent).toContain('70 %')
  })

  it('zeigt aufwaerts, wenn die Moral steigt, und abwaerts, wenn sie faellt', () => {
    const { unmount } = render(
      <ProvincePanel province={withMorale(60_000, 80_000)} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />,
    )
    expect(screen.getByRole('meter', { name: 'Moral' }).textContent).toContain('steigend')
    unmount()

    render(
      <ProvincePanel province={withMorale(80_000, 60_000)} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />,
    )
    expect(screen.getByRole('meter', { name: 'Moral' }).textContent).toContain('fallend')
  })

  it('zeigt keinen Pfeil, wenn die Sicht kein Ziel kennt', () => {
    // A foreign province: visible, but its morale target is none of the player's business.
    render(<ProvincePanel province={withMorale(70_000)} ownerName="Ostmark" actions={[]} ticksPerDay={24} currentTick={0} />)

    const meter = screen.getByRole('meter', { name: 'Moral' })
    expect(meter.textContent).not.toContain('steigend')
    expect(meter.textContent).not.toContain('fallend')
  })
})

describe('R-UI-09 Was gerade entsteht, zeigt seinen Fortschritt', () => {
  const building = (startedTick: number, completesAtTick: number): VisibleProvince => ({
    ...province,
    buildQueue: [{ id: 'b1', building: 'barracks', startedTick, completesAtTick }],
    buildQueueLength: 1,
  })

  it('fuellt den Balken zur Haelfte und nennt die Restzeit', () => {
    render(
      <ProvincePanel province={building(0, 48)} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={24} />,
    )

    const meter = screen.getByRole('meter', { name: 'Kaserne' })
    expect(meter.getAttribute('aria-valuenow')).toBe('24')
    expect(meter.getAttribute('aria-valuemax')).toBe('48')
    expect(meter.textContent).toContain('noch 1 Tage')
  })

  it('nennt Stunden, solange es weniger als ein Tag ist', () => {
    render(
      <ProvincePanel province={building(0, 48)} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={42} />,
    )

    expect(screen.getByRole('meter', { name: 'Kaserne' }).textContent).toContain('noch 6 h')
  })

  it('zeigt nichts, wenn nichts gebaut wird', () => {
    render(<ProvincePanel province={province} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />)

    expect(screen.queryByRole('meter', { name: 'Kaserne' })).toBeNull()
  })

  it('zeigt Aushebungen mit Anzahl und Gattung', () => {
    const raising: VisibleProvince = {
      ...province,
      recruitQueue: [{ unitKey: 'infantry', count: 2, startedTick: 0, completesAtTick: 20 }],
    }
    render(<ProvincePanel province={raising} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={10} />)

    expect(screen.getByRole('meter', { name: '2 × Infanterie' })).toBeTruthy()
  })

  it('faellt auf die blosse Anzahl zurueck, wenn die Sicht keine Einzelheiten kennt', () => {
    // Die Sicht ohne Regeln liefert nur buildQueueLength — dann ist die Zahl das Beste,
    // was die Oberflaeche ehrlich sagen kann.
    const lean: VisibleProvince = { ...province, buildQueueLength: 2 }
    render(<ProvincePanel province={lean} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />)

    expect(screen.getByText(/Im Bau: 2/)).toBeTruthy()
  })
})

describe('R-GAME-06 Der Filter im Ereignisprotokoll', () => {
  const entries = [
    { id: '1', tick: 10, text: 'Gefecht bei Alpha.', severity: 'alert' as const, category: 'combat' as const },
    { id: '2', tick: 11, text: 'Kaserne fertiggestellt.', severity: 'info' as const, category: 'economy' as const },
    { id: '3', tick: 12, text: 'Krieg erklärt.', severity: 'alert' as const, category: 'diplomacy' as const },
  ]

  const renderLog = () => render(<EventLog entries={entries} ticksPerDay={24} onJump={() => undefined} />)

  it('zeigt zunaechst alles', () => {
    renderLog()

    expect(screen.getByText('Gefecht bei Alpha.')).toBeTruthy()
    expect(screen.getByText('Kaserne fertiggestellt.')).toBeTruthy()
  })

  it('blendet eine Art vollstaendig aus und laesst die uebrigen unberuehrt', () => {
    renderLog()

    fireEvent.click(screen.getByRole('button', { name: 'Kämpfe' }))

    expect(screen.getByText('Gefecht bei Alpha.')).toBeTruthy()
    expect(screen.queryByText('Kaserne fertiggestellt.')).toBeNull()
    expect(screen.queryByText('Krieg erklärt.')).toBeNull()
  })

  it('findet zurueck zu allem', () => {
    renderLog()
    fireEvent.click(screen.getByRole('button', { name: 'Verträge' }))
    fireEvent.click(screen.getByRole('button', { name: 'alles' }))

    expect(screen.getByText('Kaserne fertiggestellt.')).toBeTruthy()
  })

  it('sagt es, wenn der Filter nichts uebrig laesst', () => {
    render(<EventLog entries={[entries[0]!]} ticksPerDay={24} onJump={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Aufbau' }))

    expect(screen.getByText(/Noch nichts|keine/i)).toBeTruthy()
  })
})

/**
 * Weniger Text, gemessen (T-M13-15, R-UI-09).
 *
 * Die Zahl in diesem Test ist eine Messung vom 2026-09-04, kein Gefühl: dasselbe Panel
 * derselben Provinz enthielt vor dem Aufräumen **864** sichtbare Textzeichen und danach
 * **587** — ein Drittel weniger, ohne dass eine Auskunft verlorenging (die Gründe stehen
 * weiterhin im Tooltip und in der Textfassung für Vorleseprogramme).
 *
 * Gezählt wird, was man sieht: `textContent` allein zählt auch die Textfassungen mit,
 * und dann sinkt die Zahl beim Aufräumen um zwanzig Zeichen statt um zweihundertsiebzig.
 */
describe('R-UI-09 Das Provinzpanel bleibt knapp', () => {
  /** Vor dem Aufräumen gemessen; die Grenze lässt Luft für kleine Ergänzungen. */
  const TEXT_BUDGET = 640

  const visibleText = (element: HTMLElement): string => {
    const clone = element.cloneNode(true) as HTMLElement
    for (const hidden of clone.querySelectorAll('.visually-hidden')) hidden.remove()
    return clone.textContent ?? ''
  }

  const reason = (text: string) => text
  const act = (id: string, label: string, disabledReason: string | null): Action => ({
    id,
    label,
    disabledReason,
    onRun: () => undefined,
  })

  const fullPanel = () =>
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[act('cap', 'Hauptstadt verlegen', reason('Dieses Ziel ist für den Befehl nicht zulässig.'))]}
        groups={[
          {
            id: 'recruit',
            title: 'Ausheben',
            actions: [
              act('r1', 'Infanterie', reason('Dafür fehlt das Gebäude: Kaserne.')),
              act('r2', 'Motorisierte Infanterie', reason('Dafür fehlt das Gebäude: Kaserne.')),
              act('r3', 'Kampfpanzer', reason('Dafür fehlt das Gebäude: Fabrik.')),
              act('r4', 'Schwerer Kampfpanzer', reason('Dafür fehlt das Gebäude: Fabrik.')),
              act('r5', 'Artillerie', reason('Dafür fehlt das Gebäude: Fabrik.')),
            ],
          },
        ]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

  it('haelt sich an das gemessene Textbudget', () => {
    const { container } = fullPanel()
    const length = visibleText(container).length

    expect(length, `Das Panel ist auf ${length} sichtbare Zeichen gewachsen`).toBeLessThanOrEqual(TEXT_BUDGET)
  })

  it('nennt jeden Absagegrund hoechstens einmal', () => {
    const { container } = fullPanel()
    const shown = [...container.querySelectorAll('.action__reason')].map((node) => node.textContent)

    // Der Hauptstadt-Knopf steht in einer eigenen Reihe und bringt seinen Grund mit;
    // innerhalb der Aushebegruppe erscheint jeder Grund genau einmal statt fuenfmal.
    expect(shown).toEqual([
      'Dieses Ziel ist für den Befehl nicht zulässig.',
      'Dafür fehlt das Gebäude: Kaserne.',
      'Dafür fehlt das Gebäude: Fabrik.',
    ])
  })

  it('behaelt jeden Grund fuer Vorleseprogramme, auch den nicht gezeigten', () => {
    // Weniger Text auf dem Schirm darf nicht weniger Auskunft bedeuten.
    const { container } = fullPanel()
    const hidden = [...container.querySelectorAll('.visually-hidden')].map((node) => node.textContent)

    expect(hidden).toContain('Dafür fehlt das Gebäude: Fabrik.')
    expect(hidden.filter((text) => text === 'Dafür fehlt das Gebäude: Fabrik.')).toHaveLength(2)
  })
})

/**
 * Der Filter „Weltgeschehen" (T-M15-09, R-NEWS-04, R-GAME-06).
 *
 * Der Ersatz für die Zeitung — und der Grund, warum sie entfällt: was R-NEWS-02 einer
 * Zeitung erlaubt hätte, liegt bereits vollständig im Protokoll.
 */
describe('R-NEWS-04 Weltgeschehen ist der fuenfte Filter', () => {
  const eintrag = (over: Partial<EventEntry>): EventEntry => ({
    id: `e${Math.random()}`,
    tick: 24,
    text: 'Etwas geschieht',
    severity: 'info',
    category: 'other',
    ...over,
  })

  it('bietet fuenf Knoepfe an', () => {
    render(<EventLog entries={[eintrag({})]} ticksPerDay={24} onJump={() => {}} />)

    expect(screen.getByRole('button', { name: 'Weltgeschehen' })).toBeTruthy()
    expect(screen.getAllByRole('button').length).toBe(5)
  })

  it('zeigt unter Weltgeschehen eine Kriegserklaerung zwischen zwei fremden Maechten', () => {
    const fremd = eintrag({ text: 'Ostmark erklärt Süden den Krieg.', world: true, category: 'diplomacy' })
    const eigen = eintrag({ text: 'Kaserne fertig.', world: false, category: 'economy' })
    render(<EventLog entries={[fremd, eigen]} ticksPerDay={24} onJump={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Weltgeschehen' }))

    expect(screen.getByText('Ostmark erklärt Süden den Krieg.')).toBeTruthy()
    expect(screen.queryByText('Kaserne fertig.')).toBeNull()
  })

  it('macht aus einem fremden Ereignis keinen Alarm', () => {
    // Unter „alles" steht die Zeile ebenfalls — aber ohne die Alarmklasse. Ein fremder
    // Krieg ist Lektüre, kein Grund, den Spieler anzuhalten (T-M15-01).
    const fremd = eintrag({ text: 'Ostmark erklärt Süden den Krieg.', world: true, severity: 'info' })
    const { container } = render(<EventLog entries={[fremd]} ticksPerDay={24} onJump={() => {}} />)

    expect(container.querySelectorAll('.log__row--alert').length).toBe(0)
    expect(screen.getByText('Ostmark erklärt Süden den Krieg.')).toBeTruthy()
  })
})

describe('T-M21-06 Die Kosten einer gesperrten Sache erreichen den Bildschirm', () => {
  /**
   * Der Befund vom 2026-09-07, und er ist am gerenderten Baum zu pruefen — nicht an den
   * Daten.
   *
   * `actions.test.ts` prueft seit T-M15-03, dass `hint` den Freischaltungstag traegt, und
   * war deshalb gruen. Verloren ging der Text eine Ebene spaeter: `title` nahm
   * `disabledReason ?? hint`, und bei einem gesperrten Knopf gewinnt immer der Grund.
   * Der Spieler erfuhr, *dass* es die Fabrik erst ab Tag 8 gibt, aber nie, *was sie
   * kosten wird* — Vorausplanen war unmoeglich.
   *
   * Verschaerfend liefert `availabilityHint()` seinen Text ausschliesslich, solange die
   * Sache gesperrt ist: also genau dann, wenn er verworfen wurde. Toter Code, gebaut in
   * T-M15-03, gefunden erst, als jemand auf den Knopf zeigte.
   */
  const gesperrt: Action = {
    id: 'build-factory',
    label: 'Fabrik',
    hint: '750 Geld, 400 Eisen · 18 h',
    disabledReason: 'Erst ab Spieltag 8',
    onRun: () => undefined,
  }

  const panel = (actions: Action[]) =>
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[]}
        groups={[{ id: 'build', title: 'Bauen', actions }]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

  it('nennt bei einem gesperrten Knopf Grund UND Kosten', () => {
    panel([gesperrt])
    const title = screen.getByRole('button', { name: /Fabrik/ }).getAttribute('title')

    expect(title).toContain('Erst ab Spieltag 8')
    expect(title, 'die Kosten fehlen — genau der Befund vom 2026-09-07').toContain('750 Geld')
  })

  it('nennt bei einem freien Knopf nur die Kosten', () => {
    // Kein leeres " · " davor: ein Trenner ohne linke Seite sieht aus wie ein Fehler.
    panel([{ ...gesperrt, id: 'build-barracks', label: 'Kaserne', disabledReason: null }])

    expect(screen.getByRole('button', { name: /Kaserne/ }).getAttribute('title')).toBe(
      '750 Geld, 400 Eisen · 18 h',
    )
  })

  it('laesst title ganz weg, wenn es nichts zu sagen gibt', () => {
    // Ein leeres title-Attribut ist ein Tooltip, der beim Zeigen nichts zeigt.
    panel([{ id: 'x', label: 'Ohne', disabledReason: null, onRun: () => undefined }])

    expect(screen.getByRole('button', { name: /Ohne/ }).hasAttribute('title')).toBe(false)
  })
})

describe('T-M21-06 Der Tooltip wiederholt sich nicht', () => {
  it('nennt den Freischaltungstag einmal, nicht zweimal', () => {
    // `describeRejection` sagt „Das gibt es erst ab Spieltag 8.", `availabilityHint`
    // haengt „ab Spieltag 8" an die Kosten. Beides zusammen ergaebe denselben Tag zweimal
    // im selben Satz.
    const title = buttonTitle({
      disabledReason: 'Das gibt es erst ab Spieltag 8.',
      hint: '750 Geld, 400 Eisen · 18 h · ab Spieltag 8',
    })

    expect(title).toBe('Das gibt es erst ab Spieltag 8. · 750 Geld, 400 Eisen · 18 h')
  })

  it('behaelt den Tag, wenn der Grund ein anderer ist', () => {
    // Der Fall, für den `availabilityHint` überhaupt gebaut wurde: die Kasse ist leer,
    // also meldet der Kern das — und der Spieler wüsste sonst nicht, dass die Sache
    // ohnehin noch nicht existiert.
    const title = buttonTitle({
      disabledReason: 'Zu wenig Material.',
      hint: '750 Geld, 400 Eisen · 18 h · ab Spieltag 8',
    })

    expect(title).toBe('Zu wenig Material. · 750 Geld, 400 Eisen · 18 h · ab Spieltag 8')
  })
})

describe('R-UI-10/R-UI-11 Beziehung und Gelaende stehen als Zeichen auf dem Bildschirm', () => {
  /**
   * Der Satz allein genügt nicht — die Lehre aus T-M21-06.
   *
   * `icons.test.tsx` prüft, dass es zu jeder Geländeart und zu jedem Beziehungszustand
   * ein Zeichen **gibt**. Ob es auch **erscheint**, ist eine andere Frage, und genau an
   * dieser Stelle ging am 2026-09-07 ein Text verloren, den ein Datentest für vorhanden
   * hielt. Geprüft wird deshalb am gerenderten Baum.
   */
  it('zeichnet das Gelaendesymbol neben den Gelaendenamen', () => {
    const { container } = render(
      <ProvincePanel province={province} ownerName="Vereinigte Staaten" actions={[]} ticksPerDay={24} currentTick={0} />,
    )

    const sub = container.querySelector('.panel__sub')
    expect(sub?.textContent, 'der Name muss neben dem Zeichen stehen bleiben').toContain('Ebene')
    expect(sub?.querySelector('svg'), 'kein Gelaendesymbol in der Provinzansicht').toBeTruthy()
  })

  it('zeichnet das Beziehungssymbol neben den Beziehungsnamen', () => {
    const view = {
      // Die Farbe steht als Datum in der Sicht; ein Literal hier waere ein Farbwert im
      // Quelltext und faellt zu Recht durch die Lint-Regel (R-UI-02).
      others: [{ id: 'p2', nation: 'Ostmark', color: FARBE }],
      relations: { p2: { state: 'war' } },
    } as unknown as PublicView

    const { container } = render(<DiplomacyPanel view={view} nameOf={() => 'Ostmark'} />)
    const cell = container.querySelector('td.state, td.state--war, td.state.state--war')

    expect(cell?.textContent, 'der Name muss neben dem Zeichen stehen bleiben').toContain('Krieg')
    expect(cell?.querySelector('svg'), 'kein Beziehungssymbol in der Diplomatie').toBeTruthy()
  })
})

describe('T-M20-03 Was laengst gerechnet wird, steht auch da', () => {
  /**
   * Drei Größen, die das Spiel seit Monaten ausrechnet und nie gezeigt hat: die Rubrik
   * einer Protokollzeile, die vorherrschende Gattung einer Armee und das Zeichen eines
   * Rohstoffs in der Wirtschaftstabelle. Alle drei geprüft am gerenderten Baum — ob eine
   * Zahl *berechnet* wird, sagt nichts darüber, ob sie **ankommt** (T-M21-06).
   */
  it('zeichnet die Rubrik einer Protokollzeile als Symbol', () => {
    const entries: EventEntry[] = [
      { id: '1', tick: 5, text: 'Gefecht bei Mittstadt', severity: 'info', category: 'combat' },
      { id: '2', tick: 6, text: 'Kaserne fertig', severity: 'info', category: 'economy' },
    ]
    const { container } = render(<EventLog entries={entries} ticksPerDay={24} onJump={() => undefined} />)
    const rows = container.querySelectorAll('.log__row')

    expect(rows[0]?.querySelector('svg'), 'die Kampfzeile traegt kein Rubriksymbol').toBeTruthy()
    expect(rows[1]?.querySelector('svg'), 'die Wirtschaftszeile traegt kein Rubriksymbol').toBeTruthy()
  })

  it('laesst eine Zeile ohne Rubrik ohne Symbol', () => {
    // Ein Zeichen für "nichts davon" wäre eine Auskunft, die keine ist — und in einer
    // Spalte voller gleicher Symbole findet das Auge die Ausnahme nicht mehr.
    const entries: EventEntry[] = [{ id: '1', tick: 5, text: 'Die Partie beginnt.', severity: 'info' }]
    const { container } = render(<EventLog entries={entries} ticksPerDay={24} onJump={() => undefined} />)

    expect(container.querySelector('.log__row svg')).toBeNull()
  })

  it('zeichnet die vorherrschende Gattung neben den Armeenamen', () => {
    const { container } = render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[]}
        armies={[{ id: 'a1', name: 'Armee 1', strength: 3000, icon: 'armour' }]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )
    const row = container.querySelector('.army-list li')

    expect(row?.textContent, 'der Name muss neben dem Zeichen stehen bleiben').toContain('Armee 1')
    expect(row?.querySelector('svg'), 'kein Gattungssymbol in der Armeezeile').toBeTruthy()
  })

  it('zeichnet das Rohstoffsymbol in der Wirtschaftstabelle', () => {
    const view = {
      self: {
        shortages: [],
        economy: {
          food: { stock: 1000, production: 349, consumption: 0, balance: 349, committed: 0 },
        },
      },
    } as unknown as PublicView

    const { container } = render(<EconomyPanel view={view} />)
    const cell = container.querySelector('tbody td')

    expect(cell?.textContent, 'der Name muss neben dem Zeichen stehen bleiben').toContain('Nahrung')
    expect(cell?.querySelector('svg'), 'kein Rohstoffsymbol in der Wirtschaftstabelle').toBeTruthy()
  })
})
