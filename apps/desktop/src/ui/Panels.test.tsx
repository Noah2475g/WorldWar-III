// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import type { VisibleProvince } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { ProvincePanel, buildingItems, depositItems, type Action } from './Panels.tsx'

/**
 * The side panels, once symbols carry what sentences used to (T-M13-01, R-UI-10).
 *
 * What is tested here is deliberately not "does it look nice" but the two things that
 * decide whether the change is an improvement or a decoration: the symbol is the right
 * one for the thing, and every symbol still says its name for a screen reader.
 */

afterEach(cleanup)

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
    buildQueue: [{ building: 'barracks', startedTick, completesAtTick }],
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
