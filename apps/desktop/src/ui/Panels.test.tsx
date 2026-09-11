// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { TEST_RULES } from '@worldwar/testkit'
import { defenceMultiplier, type Province, type PublicView, type Terrain, type VisibleArmy, type VisibleProvince } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { TOKENS } from './tokens.ts'
import {
  ActionGroup,
  ArmyPanel,
  DiplomacyPanel,
  EconomyPanel,
  EventLog,
  MarketPanel,
  ProvincePanel,
  TERRAIN_DEFENCE_PERMILLE,
  buildingItems,
  buttonTitle,
  depositItems,
  type Action,
  type ActionGroupSpec,
  type EventEntry,
  type Targeting,
} from './Panels.tsx'
import { BUILDING_ICONS, BUILDING_ORDER, ICON_PATHS, RESOURCE_ICONS, UNIT_ICONS } from './icons.tsx'
import { ART, ART_FOR_ICON, BUILDING_ART, UNIT_ART } from './art.tsx'
import { UnitMarker, type MarkerTone } from './UnitMarker.tsx'
import type { BattleReportData } from '../game/events.ts'
import type { TimelineEntry } from '../game/saves.ts'

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

  /**
   * Der Tagesbericht klappt auf (T-M24-01, R-TIME-06, Befund V2-06): eine Zeile mit
   * Koerper wird ein details/summary — die Ueberschrift bleibt die Zeile, der Koerper
   * steht dahinter. Zeilen ohne Koerper bleiben, was sie waren.
   */
  it('klappt eine Zeile mit Koerper auf und zeigt ihn', () => {
    const bericht: EventEntry = {
      id: 'r1',
      tick: 24,
      text: 'Tagesbericht für Tag 1.',
      severity: 'info',
      category: 'other',
      body: ['Bilanz je Tag: Nahrung +120', 'Moral: Alpha 62 % ↗'],
    }
    render(<EventLog entries={[bericht]} ticksPerDay={24} onJump={() => undefined} />)

    const details = document.querySelector('details.log__report')
    expect(details, 'der Bericht traegt kein details-Element').toBeTruthy()
    expect(details!.querySelector('summary')!.textContent).toContain('Tagesbericht für Tag 1.')
    expect(screen.getByText('Bilanz je Tag: Nahrung +120')).toBeTruthy()
    expect(screen.getByText('Moral: Alpha 62 % ↗')).toBeTruthy()
  })

  it('laesst Zeilen ohne Koerper ohne details', () => {
    renderLog()

    expect(document.querySelector('details.log__report')).toBeNull()
  })

  /**
   * Der Tagesbericht bekommt Balken (T-M25-04, R-UI-05, D25.2): die Rohstoffzeilen des
   * Berichts nutzen DIESELBEN Delta-Balken wie die Wirtschaftstabelle — eine
   * Komponente, zweimal verwendet. Die Zahl steht daneben und bleibt der zugaengliche
   * Wert; der Balken selbst ist stumm.
   */
  it('zeichnet die Bilanzen des Tagesberichts als Delta-Balken mit der Zahl daneben', () => {
    const bericht: EventEntry = {
      id: 'r2',
      tick: 24,
      text: 'Tagesbericht für Tag 1.',
      severity: 'info',
      category: 'other',
      body: ['Moral: Alpha 62 % ↗'],
      deltas: [
        { label: 'Nahrung', balance: 120_000 },
        { label: 'Eisen', balance: -40_000 },
      ],
    }
    render(<EventLog entries={[bericht]} ticksPerDay={24} onJump={() => undefined} />)

    const details = document.querySelector('details.log__report')!
    const zeilen = [...details.querySelectorAll('.log__deltas li')]
    expect(zeilen, 'keine Delta-Zeilen im Bericht').toHaveLength(2)

    // Dieselbe Komponente wie in der Wirtschaftstabelle: die delta-Klassen kommen an,
    // der groesste Betrag bekommt die halbe Spur, der kleinere skaliert dagegen.
    const plus = zeilen[0]!.querySelector('.delta__fill--plus') as HTMLElement
    const minus = zeilen[1]!.querySelector('.delta__fill--minus') as HTMLElement
    expect(plus, 'kein gruener Balken bei +120').toBeTruthy()
    expect(plus.style.width).toBe('50%')
    expect(minus, 'kein zinnoberner Balken bei −40').toBeTruthy()
    expect(minus.style.width).toBe('16.7%')

    expect(zeilen[0]!.textContent).toContain('Nahrung')
    expect(zeilen[0]!.textContent).toContain('+120')
    expect(zeilen[1]!.textContent).toContain('−40')
    expect(zeilen[0]!.querySelector('.delta')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('klappt einen Bericht auch dann auf, wenn er NUR Bilanzen traegt', () => {
    const bericht: EventEntry = {
      id: 'r3',
      tick: 24,
      text: 'Tagesbericht für Tag 1.',
      severity: 'info',
      category: 'other',
      deltas: [{ label: 'Nahrung', balance: 120_000 }],
    }
    render(<EventLog entries={[bericht]} ticksPerDay={24} onJump={() => undefined} />)

    expect(document.querySelector('details.log__report')).toBeTruthy()
  })
})

/**
 * Das Gefecht zeigt sich (T-M27-02, R-BAT-05, R-UI-10, D25.6).
 *
 * Der Kampfbericht war ein Satz. Jetzt traegt der Protokolleintrag eines Gefechts
 * einen aufklappbaren Koerper nach dem Muster des Tagesberichts: je Seite ein
 * Staerkebalken vorher-zu-nachher, der Verlust als zinnoberner Abschnitt, dazu die
 * Zeichen fuer Gelaende, Festung, Eingrabung und Rueckzugssperre. Die Balkenlaengen
 * sind an den Datensatz aus T-M27-01 gebunden — gegen den heutigen Texteintrag
 * faellt jeder dieser Tests.
 */
describe('R-BAT-05 Der Kampfbericht wird ein Bild', () => {
  const battle: BattleReportData = {
    provinceName: 'Alpha',
    terrain: 'mountain',
    fortressLevel: 2,
    victor: 'Deutschland',
    sides: [
      {
        playerId: 'p1',
        name: 'Deutschland',
        before: 40_000,
        after: 35_000,
        losses: 5_000,
        entrenched: true,
        attackBlocked: false,
      },
      {
        playerId: 'p2',
        name: 'Russland',
        before: 20_000,
        after: 8_000,
        losses: 12_000,
        entrenched: false,
        attackBlocked: true,
      },
    ],
  }

  const eintrag: EventEntry = {
    id: 'g1',
    tick: 48,
    text: 'Alpha: Gefecht entschieden — Deutschland behauptet das Feld.',
    severity: 'alert',
    category: 'combat',
    battle,
  }

  const renderBattle = () =>
    render(<EventLog entries={[eintrag]} ticksPerDay={24} onJump={() => undefined} />)

  it('klappt den Gefechtseintrag auf und bindet die Balkenlaengen an den Datensatz', () => {
    renderBattle()
    const details = document.querySelector('details.log__report')
    expect(details, 'der Gefechtseintrag traegt kein details-Element').toBeTruthy()

    const seiten = [...details!.querySelectorAll('.battle__side')]
    expect(seiten, 'nicht je Seite ein Staerkebalken').toHaveLength(2)

    // Die staerkste Seite vorher (40 000) ist der Massstab der Spur: Deutschland
    // behaelt 35 000 (87,5 %), verliert 5 000 (12,5 %); Russland behaelt 8 000
    // (20 %) und verliert 12 000 (30 %).
    const erste = seiten[0]!
    expect((erste.querySelector('.battle__after') as HTMLElement).style.width).toBe('87.5%')
    expect((erste.querySelector('.battle__loss') as HTMLElement).style.width).toBe('12.5%')
    const zweite = seiten[1]!
    expect((zweite.querySelector('.battle__after') as HTMLElement).style.width).toBe('20%')
    expect((zweite.querySelector('.battle__loss') as HTMLElement).style.width).toBe('30%')

    // Die Zahlen stehen sichtbar neben dem Balken — das Bild ersetzt sie nicht.
    expect(erste.textContent).toContain('40')
    expect(erste.textContent).toContain('35')
    expect(zweite.textContent).toContain('20')
    expect(zweite.textContent).toContain('8')
  })

  it('zeigt die Zeichen fuer Gelaende, Festung, Eingrabung und Rueckzugssperre', () => {
    renderBattle()
    const details = document.querySelector('details.log__report')!
    const titles = [...details.querySelectorAll('svg title')].map((title) => title.textContent)

    expect(titles).toContain('Gebirge')
    expect(titles.some((title) => title?.includes('Festung'))).toBe(true)
    expect(titles).toContain('Eingegraben')
    expect(titles).toContain('Rückzugssperre')
  })

  it('traegt fuers Ohr eine Satzfassung mit den Zahlen', () => {
    renderBattle()
    const bild = document.querySelector('.battle')
    expect(bild, 'kein Gefechtsbild im Koerper').toBeTruthy()
    expect(bild!.getAttribute('role')).toBe('img')

    const satz = bild!.getAttribute('aria-label') ?? ''
    expect(satz).toContain('Deutschland')
    expect(satz).toContain('Russland')
    expect(satz).toContain('40')
    expect(satz).toContain('35')
    expect(satz).toContain('Gebirge')
    expect(satz).toContain('Festung')
  })

  it('laesst ein Gefecht ohne Datensatz als schlichte Zeile', () => {
    const schlicht: EventEntry = { ...eintrag, id: 'g2' }
    delete (schlicht as { battle?: BattleReportData }).battle
    render(<EventLog entries={[schlicht]} ticksPerDay={24} onJump={() => undefined} />)

    expect(document.querySelector('details.log__report')).toBeNull()
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

/**
 * Die Seitenleiste hoert auf, seitwaerts zu kriechen (T-M22-02, R-UI-05, Befund V2-02).
 *
 * Die sechste Spalte „In Auftrag" machte die Wirtschaftstabelle breiter als die Leiste;
 * die ganze Leiste scrollte seitlich, Armeeknoepfe erschienen abgeschnitten,
 * Ueberschriften verloren Buchstaben. Die Spalte wird ein Zeichen mit Zahl hinter dem
 * Bestand (D24.2), und die Leiste unterbindet horizontales Scrollen.
 *
 * jsdom rechnet kein Layout — `scrollWidth`/`clientWidth` sind dort immer 0, die
 * Zusage `scrollWidth <= clientWidth` waere leer. Gebunden wird deshalb, was jsdom
 * pruefen kann und was die Zusage im Browser erzwingt: das echte Stylesheet setzt
 * `overflow-x: hidden` auf die Leiste, und die Tabelle traegt keine sechste Spalte
 * mehr (siehe DECISIONS.md, 2026-09-07).
 */
describe('T-M22-02 Die Seitenleiste kriecht nicht seitwaerts', () => {
  const economy = (committed: number): PublicView =>
    ({
      self: {
        shortages: [],
        economy: {
          food: { stock: 1_000_000, production: 349, consumption: 0, balance: 349, committed },
        },
      },
    }) as unknown as PublicView

  it('ersetzt die Spalte In Auftrag durch Zeichen und Zahl hinter dem Bestand', () => {
    const { container } = render(<EconomyPanel view={economy(200_000)} />)

    // Die Spalte ist weg — sie war es, die die Tabelle aus der Leiste schob. (Als Wort
    // lebt "In Auftrag" weiter: im Titel des Zeichens, nur eben nicht als Spaltenkopf.)
    const headers = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(headers).not.toContain('In Auftrag')
    expect(headers).toHaveLength(5)

    // Die Auskunft bleibt: Zeichen und Zahl hinter dem Bestand, Textfassung im Titel.
    const marker = container.querySelector('.committed')
    expect(marker, 'kein Auftragszeichen hinter dem Bestand').toBeTruthy()
    expect(marker?.textContent).toContain('200')
    expect(marker?.getAttribute('title')).toContain('In Auftrag')
    expect(marker?.querySelector('svg'), 'das Zeichen fehlt').toBeTruthy()
  })

  it('zeigt ohne laufende Auftraege kein Zeichen — eine Null ist keine Auskunft', () => {
    const { container } = render(<EconomyPanel view={economy(0)} />)

    expect(container.querySelector('.committed')).toBeNull()
  })

  /**
   * Die Wirtschaft sagt, wohin die Rohstoffe gehen (T-M28-05, R-UI-05, v1-Befund 15,
   * D26.5). Bau-, Aushebungs- und Marktkosten des Tages erschienen in keiner
   * Uebersicht. Die Auskunft steht als Zeichen mit Zahl neben dem Unterhalt —
   * D24.2-Stil, KEINE sechste Spalte: der Querscroll-Waechter oben bleibt bindend.
   */
  it('zeigt die Tagesausgaben als Zahl mit Titel neben dem Unterhalt (T-M28-05)', () => {
    const { container } = render(<EconomyPanel view={economy(0)} expenses={{ food: 400_000 }} />)

    const marker = container.querySelector('.expense')
    expect(marker, 'keine Ausgaben-Auskunft in der Tabelle').toBeTruthy()
    expect(marker?.textContent).toContain('400')
    expect(marker?.getAttribute('title')).toContain('Ausgaben')
    // Neben dem Unterhalt (vierte Spalte), nicht als eigene.
    const zelle = marker?.closest('td')
    const zeile = marker?.closest('tr')
    expect([...zeile!.children].indexOf(zelle!)).toBe(3)
    expect([...container.querySelectorAll('thead th')]).toHaveLength(5)
  })

  it('zeigt ohne Tagesausgaben kein Ausgaben-Zeichen — eine Null ist keine Auskunft', () => {
    const { container } = render(<EconomyPanel view={economy(0)} expenses={{}} />)

    expect(container.querySelector('.expense')).toBeNull()
  })

  it('R-UI-05 Waechter: die Leiste unterbindet horizontales Scrollen', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      const { container } = render(
        <aside className="side">
          <EconomyPanel view={economy(200_000)} />
        </aside>,
      )
      const side = container.querySelector('.side') as HTMLElement

      expect(window.getComputedStyle(side).getPropertyValue('overflow-x')).toBe('hidden')
      // In jsdom sind beide 0; im Browser ist genau das die Zusage aus dem Befund.
      expect(side.scrollWidth).toBeLessThanOrEqual(side.clientWidth)
    } finally {
      style.remove()
    }
  })
})

/**
 * Die Befehls-Quittung am Knopf (T-M22-05, R-UI-05, Befund V2-08): ob ein Befehl
 * aussteht, entscheidet App; hier steht die andere Haelfte — dass der Knopf die
 * Quittung zeigt und solange gesperrt ist (ein Doppelklick waere ein Doppelbefehl).
 */
describe('T-M22-05 Der ausloesende Knopf quittiert', () => {
  it('zeigt den Quittungssatz und sperrt den Knopf, solange der Befehl aussteht', () => {
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[
          {
            id: 'build-barracks',
            label: 'Kaserne',
            disabledReason: null,
            pendingNotice: '✓ befohlen — wirkt beim Weiterlaufen.',
            onRun: () => undefined,
          },
        ]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

    const button = screen.getByRole('button', { name: 'Kaserne' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('befohlen')
    expect(screen.getByRole('status').textContent).toContain('wirkt beim Weiterlaufen')
  })

  it('zeigt ohne ausstehenden Befehl keine Quittung', () => {
    render(
      <ProvincePanel
        province={province}
        ownerName="Vereinigte Staaten"
        actions={[{ id: 'build-barracks', label: 'Kaserne', disabledReason: null, onRun: () => undefined }]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Kaserne' }).hasAttribute('disabled')).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('T-M22-03 Der eigene Rueckschlag traegt Balken und Fettung', () => {
  it('gibt einer self-Zeile die Klasse log__row--self — und nur ihr', () => {
    // Die Zuordnung Ereignis -> self prueft events.test.ts fuer jede Kernart;
    // hier steht die andere Haelfte: dass die Klasse auch am Baum ankommt.
    const entries: EventEntry[] = [
      { id: '1', tick: 5, text: 'Südstaaten ist gefallen.', severity: 'alert', category: 'combat', self: true },
      { id: '2', tick: 6, text: 'Vietnam ist gefallen.', severity: 'alert', category: 'combat' },
    ]
    const { container } = render(<EventLog entries={entries} ticksPerDay={24} onJump={() => undefined} />)
    const rows = [...container.querySelectorAll('.log__row')]

    expect(rows[0]?.classList.contains('log__row--self')).toBe(true)
    expect(rows[1]?.classList.contains('log__row--self')).toBe(false)
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

/**
 * Die Wirtschaft zeigt Trend und Bilanz als Bild (T-M25-03, R-UI-05, R-UI-13, D25.2).
 *
 * Sieben Rohstoffe mal fünf Zahlenspalten — Trends musste man sich merken. Jede Zeile
 * trägt jetzt eine Sparkline der letzten sieben Tage (aus der Zeitreihe, T-M25-01) und
 * einen Bilanzbalken: positiv grün, negativ zinnober, null als Strich. Beides sind
 * Bilder ohne Stimme (aria-hidden) — die Zahl daneben bleibt der zugängliche Wert.
 * Und die Tabelle bleibt in der Leiste: keine sechste Spalte, feste schmale Breiten.
 */
describe('R-UI-05 Die Wirtschaftstabelle traegt Sparkline und Bilanzbalken', () => {
  const wirtschaft = (): PublicView =>
    ({
      self: {
        shortages: [],
        economy: {
          food: { stock: 400_000, production: 220_000, consumption: 100_000, balance: 120_000, committed: 0 },
          iron: { stock: 80_000, production: 0, consumption: 40_000, balance: -40_000, committed: 0 },
          wood: { stock: 50_000, production: 10_000, consumption: 10_000, balance: 0, committed: 0 },
        },
      },
    }) as unknown as PublicView

  /** Drei Tage Bestand fuer Nahrung — Werte, deren Sparkline-Punkte glatt sind. */
  const zeitreihe: TimelineEntry[] = [
    { day: 1, scores: {}, stock: { food: 100_000 }, balance: {} },
    { day: 2, scores: {}, stock: { food: 250_000 }, balance: {} },
    { day: 3, scores: {}, stock: { food: 400_000 }, balance: {} },
  ]

  const zeilen = (container: HTMLElement) => [...container.querySelectorAll('tbody tr')]

  it('zeigt die Bilanz als Balken: positiv gruen, negativ zinnober, null als Strich', () => {
    const { container } = render(<EconomyPanel view={wirtschaft()} timeline={zeitreihe} />)
    const [nahrung, eisen, holz] = zeilen(container)

    expect(nahrung!.querySelector('.delta__fill--plus'), 'kein gruener Balken bei +120').toBeTruthy()
    expect(eisen!.querySelector('.delta__fill--minus'), 'kein zinnoberner Balken bei −40').toBeTruthy()
    expect(holz!.querySelector('.delta__zero'), 'kein Strich bei ±0').toBeTruthy()
    expect(holz!.querySelector('.delta__fill')).toBeNull()
  })

  it('richtet die Balkenlaenge am groessten Betrag aus', () => {
    const { container } = render(<EconomyPanel view={wirtschaft()} />)
    const plus = container.querySelector('.delta__fill--plus') as HTMLElement
    const minus = container.querySelector('.delta__fill--minus') as HTMLElement

    // +120 ist der groesste Betrag → die halbe Spur; −40 ein Drittel davon, nach links.
    expect(plus.style.width).toBe('50%')
    expect(plus.style.left).toBe('50%')
    expect(minus.style.width).toBe('16.7%')
    expect(minus.style.right).toBe('50%')
  })

  it('zeichnet die Sparkline der letzten sieben Tage aus der Zeitreihe', () => {
    const { container } = render(<EconomyPanel view={wirtschaft()} timeline={zeitreihe} />)
    const linie = zeilen(container)[0]!.querySelector('.sparkline polyline')

    // Bestand 100/250/400: Spanne 100…400 → y 100, 50, 0; drei Tage → x 0, 50, 100.
    expect(linie, 'keine Sparkline in der Nahrungszeile').toBeTruthy()
    expect(linie!.getAttribute('points')).toBe('0,100 50,50 100,0')
  })

  it('laesst eine Zeile ohne Verlauf ohne Sparkline', () => {
    // Eisen kommt in der Zeitreihe nicht vor — ein erfundener Trend waere schlimmer
    // als keiner. Und ganz ohne Zeitreihe (alter Stand) traegt keine Zeile eine.
    const { container } = render(<EconomyPanel view={wirtschaft()} timeline={zeitreihe} />)
    expect(zeilen(container)[1]!.querySelector('.sparkline')).toBeNull()

    const ohne = render(<EconomyPanel view={wirtschaft()} />)
    expect(ohne.container.querySelector('.sparkline')).toBeNull()
  })

  it('laesst die Bilder stumm — die Zahl bleibt der zugaengliche Wert', () => {
    const { container } = render(<EconomyPanel view={wirtschaft()} timeline={zeitreihe} />)

    expect(container.querySelector('.delta')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.sparkline')?.getAttribute('aria-hidden')).toBe('true')
    // Die Zahlen stehen weiterhin als Text in ihren Zellen.
    expect(zeilen(container)[0]!.textContent).toContain('+120')
    expect(zeilen(container)[1]!.textContent).toContain('−40')
    expect(zeilen(container)[2]!.textContent).toContain('±0')
  })

  it('R-UI-05 Waechter: die Tabelle behaelt ihre fuenf Spalten', () => {
    // Die Bilder wohnen IN den Zellen — eine sechste Spalte war es, die die Leiste
    // seitwaerts schob (T-M22-02, Befund V2-02).
    const { container } = render(<EconomyPanel view={wirtschaft()} timeline={zeitreihe} />)

    expect(container.querySelectorAll('thead th')).toHaveLength(5)
  })
})

/**
 * Der Markt bekommt sein Zeichen (T-M23-03, R-UI-05, DECISIONS.md 2026-09-07).
 *
 * Die Entscheidung von T-M20-03 bleibt: das `select` ist die bedienbarste Liste.
 * Aber der Markt war die letzte Liste ohne Zeichen — neben jeder der beiden Listen
 * steht jetzt das Symbol des jeweils GEWAEHLTEN Rohstoffs, und es wechselt mit.
 */
describe('R-UI-05 Der Markt zeigt das Zeichen des gewaehlten Rohstoffs', () => {
  const handel = () => ({ text: 'Ergibt etwas.', action: action('trade', undefined, 'Handeln') })
  const zeichnung = (container: HTMLElement, seite: string) =>
    container.querySelector(`.market__choice--${seite} svg path`)?.getAttribute('d')

  it('zeichnet neben beiden Listen das Symbol der Auswahl', () => {
    const { container } = render(
      <MarketPanel resources={['wood', 'iron', 'oil'] as never} stock={{}} preview={handel} />,
    )

    expect(zeichnung(container, 'give')).toBe(ICON_PATHS[RESOURCE_ICONS.wood!])
    expect(zeichnung(container, 'want')).toBe(ICON_PATHS[RESOURCE_ICONS.iron!])
  })

  it('wechselt das Zeichen mit der Auswahl', () => {
    const { container } = render(
      <MarketPanel resources={['wood', 'iron', 'oil'] as never} stock={{}} preview={handel} />,
    )

    fireEvent.change(container.querySelector('#market-give')!, { target: { value: 'oil' } })

    expect(zeichnung(container, 'give')).toBe(ICON_PATHS[RESOURCE_ICONS.oil!])
  })
})

/**
 * Das Bauplatz-Raster (T-M29-03, D27.6, R-UI-09/R-UI-10/R-UI-11).
 *
 * Eine Liste der gebauten Gebaeude sagt nicht, was frei ist und was wann fertig wird.
 * Das Raster hat je Gebaeudeart genau ein Feld: gebaut (Zeichen und Name), im Bau
 * (Bernstein-Rahmen und Fortschritt) oder frei (die bestehende Bau-Aktion).
 */
describe('T-M29-03 Das Provinzpanel traegt das Bauplatz-Raster', () => {
  const buildGroup = (): ActionGroupSpec => ({
    id: 'build',
    title: 'Bauen',
    actions: Object.keys(BUILDING_ICONS).map((key) => action(`build-${key}`, BUILDING_ICONS[key], `${key}-label`)),
  })

  it('hat je Gebaeudeart genau ein Feld: gebaut, im Bau oder frei', () => {
    const queued: VisibleProvince = {
      ...province,
      buildQueue: [{ id: 'b1', building: 'fortress', startedTick: 0, completesAtTick: 48 }],
      buildQueueLength: 1,
    }
    const { container } = render(
      <ProvincePanel province={queued} ownerName="Nordland" actions={[]} groups={[buildGroup()]} ticksPerDay={24} currentTick={12} />,
    )

    const slots = [...container.querySelectorAll('.slot')]
    expect(slots.length).toBe(Object.keys(BUILDING_ICONS).length)
    expect(slots.filter((slot) => slot.classList.contains('slot--built')).length).toBe(2)
    expect(slots.filter((slot) => slot.classList.contains('slot--queued')).length).toBe(1)
    expect(slots.filter((slot) => slot.classList.contains('slot--free')).length).toBe(4)
    // Die Bau-Aktion sitzt im freien Feld — es ist derselbe Knopf wie zuvor.
    expect(within(slots.find((slot) => slot.classList.contains('slot--free')) as HTMLElement).getByRole('button')).toBeTruthy()
  })

  it('zeigt einen Bau in der Schlange mit Fortschritt als Breite und aria-valuenow', () => {
    const queued: VisibleProvince = {
      ...province,
      buildQueue: [{ id: 'b1', building: 'fortress', startedTick: 0, completesAtTick: 48 }],
      buildQueueLength: 1,
    }
    const { container } = render(
      <ProvincePanel province={queued} ownerName="Nordland" actions={[]} groups={[buildGroup()]} ticksPerDay={24} currentTick={12} />,
    )

    const slot = container.querySelector('.slot--queued') as HTMLElement
    const meter = within(slot).getByRole('meter', { name: 'Festung' })
    expect(meter.getAttribute('aria-valuenow')).toBe('12')
    expect(meter.getAttribute('aria-valuemax')).toBe('48')
    expect((slot.querySelector('.meter__fill') as HTMLElement).style.width).toBe('25%')
    expect(slot.textContent).toContain('noch 1,5 Tage')
  })

  /**
   * Bilder im Bauplatzraster (T-M33-03, D33.3, Breite 30 px).
   *
   * Die Zusage ist nicht „es ist ein Bild da", sondern „es ist in jedem Feldzustand
   * DASSELBE Bild": frei, im Bau und gebaut unterscheiden sich in Rahmen, Fortschritt
   * und Knopf — das Gebaeude bleibt dasselbe Gebaeude.
   */
  const gerastert = (zustand: 'frei' | 'bau' | 'gebaut') => {
    const gebaut = Object.fromEntries(Object.keys(BUILDING_ICONS).map((key) => [key, 2]))
    const prov: VisibleProvince = {
      ...province,
      buildings: zustand === 'gebaut' ? gebaut : {},
      ...(zustand === 'bau'
        ? {
            buildQueue: Object.keys(BUILDING_ICONS).map((key, index) => ({
              id: `b${index}`,
              building: key as never,
              startedTick: 0,
              completesAtTick: 48,
            })),
            buildQueueLength: 7,
          }
        : { buildQueue: [], buildQueueLength: 0 }),
    }
    return render(
      <ProvincePanel province={prov} ownerName="Nordland" actions={[]} groups={[buildGroup()]} ticksPerDay={24} currentTick={12} />,
    )
  }

  /** Die Flaeche je Feld, in der Reihenfolge des Rasters. */
  const bilderImRaster = (container: HTMLElement): (string | null)[] =>
    [...container.querySelectorAll('.slot')].map(
      (slot) => slot.querySelector('.unit-art .unit-art__body')?.getAttribute('d') ?? null,
    )

  it('zeigt sieben Felder mit sieben verschiedenen Gebaeudebildern', () => {
    const { container } = gerastert('gebaut')
    const bilder = bilderImRaster(container)

    expect(bilder).toHaveLength(Object.keys(BUILDING_ART).length)
    expect(bilder.filter(Boolean)).toHaveLength(bilder.length)
    expect(new Set(bilder).size).toBe(bilder.length)
    for (const [index, key] of BUILDING_ORDER.entries()) {
      expect(bilder[index], key).toBe(ART[BUILDING_ART[key]]!.body)
    }
  })

  it('aendert das Bild nicht, wenn das Feld seinen Zustand wechselt', () => {
    const frei = gerastert('frei')
    const imBau = gerastert('bau')
    const gebaut = gerastert('gebaut')

    // Ohne diese Zeile verglichen die naechsten beiden siebenmal nichts mit nichts.
    expect(bilderImRaster(frei.container).filter(Boolean)).toHaveLength(BUILDING_ORDER.length)
    expect(bilderImRaster(imBau.container)).toEqual(bilderImRaster(frei.container))
    expect(bilderImRaster(gebaut.container)).toEqual(bilderImRaster(frei.container))
  })

  it('faerbt das Gebaeude in jedem Zustand in `building` und nicht in `ink` (D33.2)', () => {
    // Im Raster gibt es keinen fremden Besitzer; die Gebaeudefarbe ist die Auskunft.
    // Befund der Sichtpruefung vom 2026-09-11: im FREIEN Feld stand der Riss in `ink`,
    // weil das Bild dort im Knopf sitzt und `.slot > svg` es nicht mehr erwischt.
    for (const zustand of ['frei', 'bau', 'gebaut'] as const) {
      const { container, unmount } = gerastert(zustand)
      const bilder = [...container.querySelectorAll('.slot .unit-art')]

      expect(bilder, zustand).toHaveLength(BUILDING_ORDER.length)
      for (const bild of bilder) {
        expect(bild.getAttribute('class'), zustand).toContain('unit-art--building')
      }
      unmount()
    }
  })

  it('setzt die Bilder auf die 30 px des Bauplans', () => {
    const { container } = gerastert('gebaut')
    const bilder = [...container.querySelectorAll('.slot .unit-art')]

    expect(bilder).toHaveLength(BUILDING_ORDER.length)
    for (const bild of bilder) {
      expect(bild.getAttribute('width')).toBe('30')
    }
  })

  it('behaelt die Stufenzahl sichtbar und im Namen fuers Ohr', () => {
    // "2 Fabrik" war die Zusage von T-M29-03 und bleibt sie: die Ziffer steht
    // hochgestellt im Feld und im zugaenglichen Namen des Bildes.
    const { container } = gerastert('gebaut')
    const feld = container.querySelectorAll('.slot')[BUILDING_ORDER.indexOf('factory')] as HTMLElement

    expect(feld.querySelector('.slot__level')?.textContent).toBe('2')
    const benannt = within(feld).getByRole('img', { name: '2 Fabrik' })
    expect(benannt.classList.contains('unit-art'), 'Der Name haengt noch an der Glyphe').toBe(true)
  })

  it('zeichnet die Moral in zehn Segmenten mit dem Prozentwert und der Tendenz', () => {
    const { container } = render(
      <ProvincePanel
        province={{ ...province, morale: 44_000, moraleTarget: 20_000 }}
        ownerName="Nordland"
        actions={[]}
        ticksPerDay={24}
        currentTick={0}
      />,
    )

    const segments = [...container.querySelectorAll('.meter__segment')]
    expect(segments.length).toBe(10)
    expect(segments.filter((seg) => seg.classList.contains('meter__segment--on')).length).toBe(4)
    expect(screen.getByRole('meter', { name: 'Moral' }).textContent).toContain('44 %')
    expect(screen.getByRole('meter', { name: 'Moral' }).textContent).toContain('fallend')
  })

  it('nennt den Verteidigungsbonus des Gelaendes, wo es einen gibt', () => {
    const { unmount } = render(
      <ProvincePanel province={{ ...province, terrain: 'mountain' }} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />,
    )
    expect(screen.getByText(/Verteidigung \+30 %/)).toBeTruthy()
    unmount()

    render(<ProvincePanel province={{ ...province, terrain: 'plains' }} ownerName="Nordland" actions={[]} ticksPerDay={24} currentTick={0} />)
    expect(screen.queryByText(/Verteidigung/)).toBeNull()
  })

  it('haelt die Bonus-Tabelle deckungsgleich mit dem Kern', () => {
    // Der Kern schreibt die Gelaendeboni als Literale in defenceMultiplier (combat.ts);
    // die Oberflaeche darf sie nennen, aber nicht erfinden. Bewiesen am Kern selbst.
    for (const terrain of Object.keys(TERRAIN_DEFENCE_PERMILLE) as Terrain[]) {
      const bare = { terrain, buildings: {} } as unknown as Province
      const multiplier = defenceMultiplier(bare, false, TEST_RULES)
      expect(multiplier - 1000, `Gelaende ${terrain}`).toBe(TERRAIN_DEFENCE_PERMILLE[terrain])
    }
  })
})

/**
 * Das Armeepanel im Kriegsrat (T-M31-02, D27.6, R-UI-05/R-UI-10/R-UI-17).
 *
 * Dieselben Marker wie auf der Karte, dieselbe Sprache im Panel: Einheiten als
 * NATO-Stapel mit Zahl, Kampfkraft mit Zustand, die Haltung als Dreiergruppe mit
 * genau einem gedrueckten Knopf, Befehle zweispaltig mit Zeichen.
 */
describe('T-M31-02 Das Armeepanel traegt Marker, Zustand und Haltungsgruppe', () => {
  const army = { id: 'a1', owner: 'p1', provinceId: 'USA-MW', strength: 12_400, stance: 'defensive' } as VisibleArmy
  const act = (id: string, label: string, aria?: string): Action => ({
    id,
    label,
    ...(aria ? { aria } : {}),
    disabledReason: null,
    onRun: () => undefined,
  })
  const actions = [
    act('march', 'Marschieren'),
    act('stop', 'Anhalten'),
    act('stance-aggressive', 'Angriff', 'Haltung Angriff einnehmen'),
    { ...act('stance-defensive', 'Verteidigung', 'Haltung Verteidigung einnehmen'), disabledReason: 'Die Armee hat diese Haltung schon.' },
    act('stance-retreat', 'Rückzug', 'Haltung Rückzug einnehmen'),
    act('merge', 'Zusammenlegen'),
    act('split', 'Teilen'),
    act('bombard', 'Beschießen'),
    act('holdFire', 'Feuer halten'),
  ]
  const units = [
    { icon: 'infantry', label: 'Infanterie', count: 8 },
    { icon: 'armour', label: 'Kampfpanzer', count: 3 },
  ] as const

  const panel = () =>
    render(<ArmyPanel army={army} name="3. Armee" units={units} condition={0.86} actions={actions} ticksPerDay={24} currentTick={0} />)

  it('traegt in der Haltungsgruppe genau einen gedrueckten Knopf — die aktuelle Haltung', () => {
    panel()
    const group = screen.getByRole('group', { name: 'Haltung' })
    const buttons = within(group).getAllByRole('button')

    expect(buttons.length).toBe(3)
    const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['Verteidigung'])
  })

  it('zeichnet je Gattung einen NATO-Marker mit Zahl, hoerbar als "8 Infanterie"', () => {
    const { container } = panel()

    expect(container.querySelectorAll('.unit-marker').length).toBe(2)
    expect(screen.getByRole('img', { name: '8 Infanterie' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '3 Kampfpanzer' }).textContent).toContain('3')
  })

  /**
   * Die Bildfassung des Plaettchens (T-M33-04, D33.2/D33.3, Breite 44 px).
   *
   * Rahmen, Besitzerfarbe und die Zahl rechts bleiben, wo sie sind — nur die Fuellung
   * wechselt von der Glyphe zum Schattenriss. Das ist das Gegenmittel gegen Risiko 1:
   * zwei Bildsprachen im selben Spiel halten nur zusammen, solange alles andere gleich
   * bleibt.
   */
  it('zeigt in der Armeeliste den Schattenriss statt der Glyphe', () => {
    const { container } = panel()
    const marker = [...container.querySelectorAll('.unit-marker')]

    expect(marker).toHaveLength(2)
    expect(container.querySelector('.unit-marker__glyph'), 'Die Liste stempelt noch Glyphen').toBeNull()
    marker.forEach((platte, index) => {
      const bild = ART_FOR_ICON[units[index]!.icon]!
      expect(platte.querySelector('.unit-marker__art')?.getAttribute('d')).toBe(ART[bild]!.body)
      expect(platte.querySelector('.unit-marker__art-cut')?.getAttribute('d')).toBe(ART[bild]!.cut)
    })
  })

  it('nimmt fuer die Bildfassung die 44 px des Bauplans, ohne das Seitenverhaeltnis zu drehen', () => {
    const { container } = panel()
    const platte = container.querySelector('.unit-marker')!

    expect(platte.getAttribute('width')).toBe('44')
    expect(platte.getAttribute('height')).toBe('26.4')
    expect(platte.getAttribute('viewBox')).toBe('0 0 30 18')
  })

  it('behaelt Zahl und Name am Plaettchen — "8 Infanterie" bleibt hoerbar', () => {
    panel()

    expect(screen.getByRole('img', { name: '8 Infanterie' }).textContent).toContain('8')
    expect(screen.getByRole('img', { name: '3 Kampfpanzer' }).textContent).toContain('3')
  })

  it('faerbt eigen, verbuendet und feindlich nach denselben Tokens wie die Karte', () => {
    // R-UI-10: die Besitzerfarbe bedeutet in der Liste dasselbe wie auf der Karte.
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      // jsdom loest keine Custom Properties auf — gebunden wird deshalb die Kaskade
      // (welcher Ton welchen Token nimmt); dass der Token seinen Wert hat, haelt
      // css-mirrors-tokens fest.
      const erwartet = { own: 'good', ally: 'ally', enemy: 'accent', other: 'ink-soft' } as const
      for (const [ton, token] of Object.entries(erwartet)) {
        const { container, unmount } = render(
          <UnitMarker icon="infantry" art="infantry" label="Infanterie" count={4} tone={ton as MarkerTone} />,
        )
        const platte = container.querySelector('.unit-marker') as SVGElement

        expect(window.getComputedStyle(platte).color, ton).toBe(`var(--${token})`)
        unmount()
      }
    } finally {
      style.remove()
    }
  })

  it('nennt die Kampfkraft mit Zustand-Prozent und zeichnet den Balken', () => {
    panel()

    // `amount` rechnet Festkomma heraus — gebunden wird die Zeile, nicht die Schreibweise.
    expect(screen.getByText(/Kampfkraft/).textContent).toContain('Zustand 86 %')
    const meter = screen.getByRole('meter', { name: 'Zustand' })
    expect(meter.getAttribute('aria-valuenow')).toBe('86')
    expect(meter.textContent).toContain('86 %')
  })

  it('setzt die Befehle zweispaltig mit Zeichen und macht den Marsch zur Hauptaktion', () => {
    const { container } = panel()
    const grid = container.querySelector('.actions--grid') as HTMLElement

    expect(grid).toBeTruthy()
    const march = within(grid).getByRole('button', { name: 'Marschieren' })
    expect(march.className).toContain('button--primary')
    expect(march.querySelector('svg')).toBeTruthy()
    // Die Haltung steht nicht noch einmal unter den Befehlen.
    expect(within(grid).queryByRole('button', { name: /Haltung/ })).toBeNull()
  })

  it('R-UI-05 Waechter: auch mit Markern und Raster kriecht die Leiste nicht seitwaerts', () => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      const { container } = render(
        <aside className="side">
          <ArmyPanel army={army} units={units} condition={0.5} actions={actions} ticksPerDay={24} currentTick={0} />
        </aside>,
      )
      const side = container.querySelector('.side') as HTMLElement
      expect(window.getComputedStyle(side).getPropertyValue('overflow-x')).toBe('hidden')
      expect(side.scrollWidth).toBeLessThanOrEqual(side.clientWidth)
    } finally {
      style.remove()
    }
  })
})

/**
 * T-M32-01 · Der Abmarsch lässt sich verzögern.
 *
 * Der Kern kennt seit T-M32-01 `MOVE_ARMY.departInTicks`; hier wird nur geprüft, dass
 * die Zielwahl ihn erreichbar macht — Schrittwahl in Tagen, Vorschau der verschobenen
 * Ankunft, und bei Beschuss gibt es sie nicht (der Beschuss marschiert nicht).
 */
describe('T-M32-01 Die Zielwahl kennt den verzoegerten Abmarsch', () => {
  const army = { id: 'a1', owner: 'p1', provinceId: 'USA-MW', strength: 12_400, stance: 'defensive' } as VisibleArmy
  const noop = (): void => undefined

  const targeting = (over: Partial<Targeting> = {}): Targeting => ({
    kind: 'move',
    target: { id: 'USA-NE', name: 'Nordosten', arrivalText: 'Ankunft Tag 9' },
    options: [{ id: 'USA-NE', name: 'Nordosten' }],
    confirm: { id: 'confirm-move', label: 'Marsch bestätigen', disabledReason: null, onRun: noop },
    onChoose: noop,
    onCancel: noop,
    delayDays: 0,
    onDelay: noop,
    ...over,
  })

  const panel = (t: Targeting) =>
    render(<ArmyPanel army={army} actions={[]} targeting={t} ticksPerDay={24} currentTick={0} />)

  it('bietet einen Schrittwaehler, der bei "sofort" steht', () => {
    panel(targeting())
    const group = screen.getByRole('group', { name: 'Abmarsch' })

    expect(within(group).getByRole('status').textContent).toContain('sofort')
    expect(within(group).getByRole('button', { name: 'Früher abmarschieren' }).hasAttribute('disabled')).toBe(true)
  })

  it('zaehlt in Tagen hoch und meldet jeden Schritt weiter', () => {
    const seen: number[] = []
    panel(targeting({ onDelay: (days) => seen.push(days) }))
    const group = screen.getByRole('group', { name: 'Abmarsch' })

    fireEvent.click(within(group).getByRole('button', { name: 'Später abmarschieren' }))
    expect(seen).toEqual([1])
  })

  it('nennt bei gesetzter Verzoegerung den Tag im Waehler', () => {
    panel(targeting({ delayDays: 3 }))
    const group = screen.getByRole('group', { name: 'Abmarsch' })

    expect(within(group).getByRole('status').textContent).toContain('3 Tagen')
    expect(within(group).getByRole('button', { name: 'Früher abmarschieren' }).hasAttribute('disabled')).toBe(false)
  })

  it('bietet ihn beim Beschuss nicht an', () => {
    panel(targeting({ kind: 'bombard' }))

    expect(screen.queryByRole('group', { name: 'Abmarsch' })).toBeNull()
  })
})

/**
 * T-M32-02 · Der Markt zeigt den Preisverlauf.
 *
 * Die Reihe kommt aus `priceSeries` (game/events.ts); hier zählt nur, dass das
 * Marktpanel sie zeigt — je Rohstoff eine Linie mit dem letzten Kurs als Zahl, und
 * nichts, wo es keinen Verlauf gibt.
 */
describe('T-M32-02 Der Markt zeigt den Preisverlauf', () => {
  const preview = () => ({
    text: 'Vorschau',
    action: { id: 'trade', label: 'Tauschen', disabledReason: null, onRun: () => undefined } as Action,
  })

  const market = (prices?: Partial<Record<string, { day: number; price: number }[]>>) =>
    render(
      <MarketPanel
        resources={['wood', 'iron']}
        stock={{ wood: 10_000, iron: 5000 }}
        preview={preview}
        {...(prices ? { prices } : {})}
      />,
    )

  it('zeichnet je Rohstoff mit Verlauf eine Linie und nennt den letzten Kurs', () => {
    const { container } = market({ wood: [{ day: 0, price: 3 }, { day: 1, price: 5 }] })
    const list = screen.getByRole('list', { name: 'Kursverlauf' })

    expect(within(list).getAllByRole('listitem').length).toBe(1)
    expect(within(list).getByRole('listitem').textContent).toContain('5')
    expect(container.querySelectorAll('.sparkline').length).toBe(1)
  })

  it('zeigt den Abschnitt gar nicht, solange nichts gehandelt wurde', () => {
    market()
    expect(screen.queryByRole('list', { name: 'Kursverlauf' })).toBeNull()
  })

  it('laesst einen einzelnen Punkt weg — eine Linie aus einem Wert ist keine', () => {
    market({ wood: [{ day: 0, price: 3 }] })
    expect(screen.queryByRole('list', { name: 'Kursverlauf' })).toBeNull()
  })
})

/**
 * T-M28-11 · Das Bauplatz-Raster sagt nur, was die Sicht weiß.
 *
 * Befund 4 der Durchsicht vom 2026-09-11 (schwer): Bei einer fremden Provinz führt die
 * Sicht keine `buildings` — das Raster zeichnete trotzdem sieben freie Plätze und
 * behauptete damit „hier steht nichts". Die Fassung vor dem Kriegsrat-Umbau zeichnete die
 * Gebäudezeile nur bei vorhandenen Gebäuden und brach die Nebelregel nicht.
 */
describe('T-M28-11 Das Raster bricht die Nebelregel nicht', () => {
  const fremd = {
    id: 'RUS-CENTRAL',
    name: 'Zentralrussland',
    owner: 'p2',
    terrain: 'plains',
    population: 900_000,
  } as unknown as VisibleProvince

  const eigen = {
    ...fremd,
    owner: 'p1',
    buildings: { barracks: 1 },
    buildQueue: [],
    morale: 70_000,
  } as unknown as VisibleProvince

  it('zeichnet fuer eine fremde Provinz gar kein Raster', () => {
    const { container } = render(<ProvincePanel province={fremd} ownerName="Russland" actions={[]} ticksPerDay={24} currentTick={0} />)

    expect(container.querySelector('.slots')).toBeNull()
    expect(screen.queryByText('Bauplätze')).toBeNull()
  })

  it('zeichnet es fuer die eigene Provinz weiterhin', () => {
    const { container } = render(<ProvincePanel province={eigen} ownerName="Vereinigte Staaten" actions={[]} ticksPerDay={24} currentTick={0} />)

    expect(container.querySelector('.slots')).not.toBeNull()
  })
})

/**
 * T-M28-16 · Mehrere Bauaufträge derselben Art sind einzeln sichtbar.
 *
 * Befund 5 der Durchsicht vom 2026-09-11: Der Kern erlaubt zwei gleichzeitige Aufträge
 * derselben Gebäudeart, und jeder trägt sein eigenes `completesAtTick`. Das Raster hat je
 * Art **ein** Feld und fand mit `find()` nur den ersten — der zweite bezahlte Auftrag
 * hatte weder Fortschritt noch Fertigstellung, und nach Abschluss des ersten sprang der
 * Balken ohne Erklärung zurück.
 */
describe('T-M28-16 Zwei Auftraege derselben Art', () => {
  const zweimalKaserne = {
    id: 'USA-MW',
    name: 'Mittlerer Westen',
    owner: 'p1',
    terrain: 'plains',
    population: 900_000,
    morale: 70_000,
    buildings: {},
    buildQueue: [
      { building: 'barracks', startedTick: 0, completesAtTick: 48 },
      { building: 'barracks', startedTick: 12, completesAtTick: 96 },
    ],
  } as unknown as VisibleProvince

  const panel = () =>
    render(<ProvincePanel province={zweimalKaserne} ownerName="Vereinigte Staaten" actions={[]} ticksPerDay={24} currentTick={24} />)

  it('zeigt beide Fortschritte, nicht nur den ersten', () => {
    const { container } = panel()
    const meter = container.querySelectorAll('.slot--queued [role="meter"]')

    expect(meter.length).toBe(2)
  })

  it('nennt je Auftrag seine eigene Restzeit', () => {
    const { container } = panel()
    const texte = [...container.querySelectorAll('.slot--queued [role="meter"]')].map((m) => m.textContent)

    expect(new Set(texte).size).toBe(2)
  })
})

/**
 * Bilder in der Rekrutierungsliste (T-M33-02, EINHEITSBILDER.md D33.3, R-UI-03/R-UI-04).
 *
 * Die Liste ist der eine Ort, an dem eine Einheit gross genug steht, um mehr zu zeigen
 * als ein Rechteck mit Oval: 34 px statt der elf auf der Karte. Geprueft wird deshalb
 * beides — dass das Bild da ist, und dass es nichts kostet, was vorher da war: den
 * A11y-Namen mit Verb (T-M22-06) und das Klickziel (R-UI-03).
 */
describe('R-UI-04 Die Rekrutierungsliste zeigt Bilder', () => {
  const EINHEITEN = ['infantry', 'tank', 'artillery'] as const
  const NAMEN: Record<(typeof EINHEITEN)[number], string> = {
    infantry: 'Infanterie',
    tank: 'Kampfpanzer',
    artillery: 'Artillerie',
  }

  const gruppe = (): ActionGroupSpec => ({
    id: 'recruit',
    title: 'Ausheben',
    actions: EINHEITEN.map((key) => ({
      id: `recruit-${key}`,
      label: NAMEN[key],
      aria: `${NAMEN[key]} ausheben`,
      icon: UNIT_ICONS[key]!,
      art: UNIT_ART[key]!,
      disabledReason: null,
      onRun: () => undefined,
    })),
  })

  it('zeigt je Einheit genau ein Bild', () => {
    const { container } = render(<ActionGroup group={gruppe()} />)

    expect(container.querySelectorAll('.unit-art')).toHaveLength(EINHEITEN.length)
  })

  it('zeichnet zu jeder Einheit ihr eigenes Bild, Flaeche und Innenlinien', () => {
    const { container } = render(<ActionGroup group={gruppe()} />)
    const bilder = [...container.querySelectorAll('.unit-art')]

    EINHEITEN.forEach((key, index) => {
      const pfade = bilder[index]!.querySelectorAll('path')
      expect(pfade, key).toHaveLength(2)
      expect(pfade[0]!.getAttribute('d'), key).toBe(ART[UNIT_ART[key]!]!.body)
      expect(pfade[1]!.getAttribute('d'), key).toBe(ART[UNIT_ART[key]!]!.cut)
    })
  })

  it('setzt das Bild auf die 34 px des Bauplans', () => {
    const { container } = render(<ActionGroup group={gruppe()} />)
    const bild = container.querySelector('.unit-art')

    expect(bild?.getAttribute('width')).toBe('34')
    expect(bild?.getAttribute('viewBox')).toBe('0 0 48 30')
  })

  it('laesst den A11y-Namen woertlich stehen', () => {
    // T-M22-06/V2-13: sichtbar "Infanterie", hoerbar "Infanterie ausheben". Ein Bild mit
    // eigenem Namen daneben wuerde den Knopf doppelt vorlesen — es bleibt Schmuck.
    render(<ActionGroup group={gruppe()} />)

    expect(screen.getByRole('button', { name: 'Infanterie ausheben' })).toBeTruthy()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })

  it('zeigt das Bild IM Knopf, damit das Klickziel waechst statt zu schrumpfen', () => {
    const { container } = render(<ActionGroup group={gruppe()} />)

    for (const bild of container.querySelectorAll('.unit-art')) {
      expect(bild.closest('button'), 'Bild ausserhalb des Knopfes').toBeTruthy()
    }
  })

  it('R-UI-03 Waechter: der Knopf bleibt mindestens 24 px hoch', () => {
    // jsdom rechnet kein Layout — gebunden wird die Kaskade, nicht die Messung.
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      render(<ActionGroup group={gruppe()} />)
      const knopf = screen.getByRole('button', { name: 'Infanterie ausheben' })

      expect(window.getComputedStyle(knopf).getPropertyValue('min-height')).toBe('24px')
    } finally {
      style.remove()
    }
  })
})

/**
 * Die Wirtschaftstabelle wird ruhiger, nicht kürzer (T-M36-05, ROHSTOFFE.md Abschnitt 3).
 *
 * Der Bauplan schlug zuerst vor, **eine Spalte zu streichen**. Das geht nicht: R-ECON-06
 * verlangt wörtlich, dass Bestand, Produktion je Tag, Verbrauch je Tag **und** Bilanz je
 * Ressource sichtbar sind — eine V1-Zusage. Eine Anforderung zu brechen, um eine Tabelle
 * hübscher zu machen, ist keine Ersparnis. Alle vier bleiben; ruhiger wird die Tabelle
 * über Gewicht und Farbe: nur Bestand und Bilanz tragen Gewicht, die Nullen der
 * Unterhaltsspalte werden zu Strichen, und die Farbe gehört allein der Bilanz.
 */
describe('T-M36-05 Ruhiger, nicht kuerzer', () => {
  const wirtschaftMit = (balance: number, consumption = 0): PublicView =>
    ({
      self: {
        shortages: [],
        economy: {
          food: { stock: 1_000_000, production: Math.max(0, balance), consumption, balance, committed: 0 },
        },
      },
    }) as unknown as PublicView

  it('behaelt alle vier Groessen im Baum — R-ECON-06 bleibt belegt', () => {
    const { container } = render(<EconomyPanel view={wirtschaftMit(349_000)} />)
    const kopf = [...container.querySelectorAll('thead th')].map((th) => th.textContent)

    expect(kopf).toEqual(['Rohstoff', 'Bestand', 'Produktion', 'Unterhalt', 'Bilanz'])
    expect(container.querySelectorAll('tbody tr td')).toHaveLength(5)
  })

  it('schreibt eine Null als Strich, ohne sie dem Vorlesetext zu nehmen', () => {
    const { container } = render(<EconomyPanel view={wirtschaftMit(349_000)} />)
    const unterhalt = container.querySelectorAll('tbody td')[3] as HTMLElement

    // Sichtbar ein Strich in Linienfarbe …
    const sichtbar = unterhalt.cloneNode(true) as HTMLElement
    for (const versteckt of sichtbar.querySelectorAll('.visually-hidden')) versteckt.remove()
    expect(sichtbar.textContent?.trim()).toBe('–')
    // … fuers Ohr weiterhin die Null. Sonst hoerte ein Vorleseprogramm einen
    // Gedankenstrich, wo eine Zahl stehen soll.
    expect(unterhalt.querySelector('.visually-hidden')?.textContent).toBe('±0')
  })

  it('laesst eine Zahl Zahl bleiben — der Strich steht nur fuer die Null', () => {
    const { container } = render(<EconomyPanel view={wirtschaftMit(-120_000, 120_000)} />)
    const unterhalt = container.querySelectorAll('tbody td')[3] as HTMLElement

    expect(unterhalt.textContent).toContain('−120')
    expect(unterhalt.querySelector('.zero')).toBeNull()
  })

  it('gibt Gewicht nur dem Bestand und der Bilanz (Kaskaden-Waechter)', () => {
    // jsdom rechnet kein Layout, aber die Kaskade rechnet es: das echte Stylesheet
    // entscheidet, welche Zelle Gewicht traegt. Ohne diesen Test bindet nichts die
    // Zusage „nur zwei der vier Spalten tragen Gewicht".
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      const { container } = render(<EconomyPanel view={wirtschaftMit(349_000)} />)
      const zellen = [...container.querySelectorAll('tbody td')] as HTMLElement[]
      const gewicht = (index: number) => window.getComputedStyle(zellen[index]!).fontWeight

      expect(gewicht(1), 'Bestand ohne Gewicht').toBe('600')
      expect(gewicht(4), 'Bilanz ohne Gewicht').toBe('600')
      expect(gewicht(2), 'Produktion traegt Gewicht').not.toBe('600')
      expect(gewicht(3), 'Unterhalt traegt Gewicht').not.toBe('600')
    } finally {
      style.remove()
    }
  })

  it('gibt die Farbe allein der Bilanz', () => {
    const { container } = render(<EconomyPanel view={wirtschaftMit(349_000)} />)
    const zellen = [...container.querySelectorAll('tbody td')] as HTMLElement[]

    expect(zellen[4]!.className).toContain('eco__balance--plus')
    // Und die beiden Flussspalten tragen keinen Ton — sie sind Herkunft, nicht Urteil.
    for (const index of [2, 3]) {
      expect(zellen[index]!.className, `Spalte ${index} traegt einen Ton`).not.toMatch(/--plus|--minus/)
    }
  })
})
