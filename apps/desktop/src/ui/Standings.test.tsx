// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TimelineEntry } from '../game/saves.ts'
import { StandingsPanel, VictoryDialog, scoreSeries, standingsRows } from './Standings.tsx'
import { TOKENS } from './tokens.ts'

/**
 * Where everyone stands, and how the game ends (T-M13-12, R-UI-13, R-GAME-02).
 *
 * The score has been in the state since M5 and the winner since then too; neither ever
 * reached the screen. A strategy game that cannot answer "am I winning" — or "is it
 * over" — is missing something more basic than a feature.
 */

afterEach(cleanup)

const view = (options: {
  self?: number
  others?: { id: string; score: number; alive?: boolean }[]
  armies?: { owner: string; provinceId: string; strength: number }[]
  winner?: string | null
  provinces?: { owner: string }[]
}): PublicView =>
  ({
    tick: 240,
    playerId: 'p1',
    self: {
      name: 'Mensch',
      nation: 'Nordland',
      color: 'darkslategray',
      score: options.self ?? 100,
      resources: {},
      shortages: [],
    },
    others: (options.others ?? []).map((other) => ({
      id: other.id,
      name: other.id,
      nation: `Macht ${other.id}`,
      color: 'rebeccapurple',
      alive: other.alive ?? true,
      score: other.score,
    })),
    relations: { p2: { state: 'war', rightOfWay: false, sharedMap: false } },
    provinces: (options.provinces ?? []).map((province, index) => ({ id: `x${index}`, owner: province.owner })),
    armies: options.armies ?? [],
    marketPrices: {},
    victory: { condition: 'points', winner: options.winner ?? null },
  }) as unknown as PublicView

const nameOf = (id: string): string => (id === 'p2' ? 'Ostmark' : id)

describe('R-UI-13 Die Lage der Maechte', () => {
  it('sortiert nach Punkten und stellt die eigene Macht heraus', () => {
    const rows = standingsRows(view({ self: 100, others: [{ id: 'p2', score: 300 }] }), nameOf)

    expect(rows.map((row) => row.nation)).toEqual(['Ostmark', 'Nordland'])
    expect(rows.find((row) => row.own)?.nation).toBe('Nordland')
  })

  it('nennt keine ausgeschiedene Macht', () => {
    const rows = standingsRows(view({ others: [{ id: 'p2', score: 300, alive: false }] }), nameOf)

    expect(rows).toHaveLength(1)
  })

  it('zaehlt nur die Staerke, die der Spieler sieht', () => {
    // Was hinter dem Nebel steht, steht nicht in der Tabelle — eine Spalte mit der
    // wahren Truppenzahl waere die Oberflaeche, die fuer den Spieler schummelt.
    const rows = standingsRows(
      view({
        others: [{ id: 'p2', score: 50 }],
        armies: [
          { owner: 'p1', provinceId: 'a', strength: 3000 },
          { owner: 'p2', provinceId: 'b', strength: 1000 },
          { owner: 'p2', provinceId: 'c', strength: 500 },
        ],
      }),
      nameOf,
    )

    expect(rows.find((row) => row.own)?.seenStrength).toBe(3000)
    expect(rows.find((row) => row.id === 'p2')?.seenStrength).toBe(1500)
  })

  it('zeigt jede Macht als Balken gegen den Fuehrenden', () => {
    render(<StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} />)

    const leader = screen.getByRole('meter', { name: 'Ostmark' })
    expect(leader.getAttribute('aria-valuenow')).toBe('300')
    expect(leader.getAttribute('aria-valuemax')).toBe('300')
    expect(screen.getByRole('meter', { name: 'Nordland' }).getAttribute('aria-valuenow')).toBe('100')
  })

  it('rendert den Machtnamen je Zeile nur einmal (T-M23-02, Befund V2-17)', () => {
    // "Indien Indien 6148": der Punktebalken wiederholte den Namen als Textknoten neben
    // der Namensspalte. Fuers Ohr bleibt er — als aria-label des Balkens, nicht als Text.
    const { container } = render(
      <StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} />,
    )

    for (const [zeile, name] of [
      [0, 'Ostmark'],
      [1, 'Nordland'],
    ] as const) {
      const text = container.querySelectorAll('tbody tr')[zeile]!.textContent!
      expect(text.split(name).length - 1, `"${name}" steht ${zeile + 1}. Zeile mehrfach`).toBe(1)
    }
  })
})

/**
 * Der Machtverlauf als Kurve (T-M25-02, R-UI-13, D25.2).
 *
 * Die spannendste Kurve des Spiels — wer führt, wer holt auf — existierte nirgends.
 * Das Lage-Panel zeigt über der Punktetabelle ein Liniendiagramm aus der Zeitreihe
 * (T-M25-01): eigene SVG-Komponente, Spielerfarben aus der Sicht, Legende, eine
 * aria-Beschreibung mit den Endwerten. Ohne Aufzeichnung sagt der Leerzustand einen
 * ehrlichen Satz statt eine leere Fläche zu zeigen.
 */
describe('R-UI-13 Der Machtverlauf als Kurve', () => {
  /** Drei Tage mit Zahlen, deren Pfadpunkte glatt sind: Höchstwert 260, Spanne 2 Tage. */
  const zeitreihe: TimelineEntry[] = [
    { day: 1, scores: { p1: 0, p2: 260 }, stock: {}, balance: {} },
    { day: 2, scores: { p1: 130, p2: 130 }, stock: {}, balance: {} },
    { day: 3, scores: { p1: 260, p2: 260 }, stock: {}, balance: {} },
  ]

  const lage = () =>
    render(
      <StandingsPanel
        view={view({ self: 260, others: [{ id: 'p2', score: 260 }] })}
        nameOf={nameOf}
        timeline={zeitreihe}
      />,
    )

  it('bindet die Kurvenpfade an die bekannten Reihen', () => {
    const { container } = lage()

    // Der Pfadraum ist 0…100 in beiden Achsen: Tag 1 → x 0, Tag 3 → x 100. Die
    // Y-Skala läuft seit T-M28-01 von min−Rand bis max+Rand statt ab 0: Werte 0…260,
    // Rand 26, Skala −26…286 — also 0 → y 91.7 und 260 → y 8.3. Gegen die alte
    // 0-Basis ('M0,100 L50,50 L100,0') fällt dieser Test.
    // Seit T-M31-04 traegt auch die Flaeche unter der eigenen Kurve `data-series`;
    // gebunden wird die Linie.
    const eigene = container.querySelector('path.chart__line[data-series="p1"]')
    const fremde = container.querySelector('path.chart__line[data-series="p2"]')
    expect(eigene, 'keine Kurve der eigenen Macht').toBeTruthy()
    expect(eigene!.getAttribute('d')).toBe('M0,91.7 L50,50 L100,8.3')
    expect(fremde!.getAttribute('d')).toBe('M0,8.3 L50,50 L100,8.3')
  })

  it('schreibt jeden Endwert an den rechten Rand (T-M28-01)', () => {
    const { container } = lage()

    const endwerte = [...container.querySelectorAll('.chart__endvalue')].map((el) => el.textContent)
    expect(endwerte).toEqual(['260', '260'])
  })

  it('zeichnet die eigene Kurve in Phosphorgruen und den Kriegsgegner in Zinnober (T-M31-04)', () => {
    // Bis T-M31-04 trug jede Kurve ihre Spielerfarbe; acht gleichwertige Linien sagten
    // weniger als drei benannte. p2 liegt im Krieg (Fixture) — also der Feind.
    const { container } = lage()
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`

    expect((container.querySelector('path.chart__line[data-series="p2"]') as SVGPathElement).style.stroke).toBe(rgb(TOKENS.accent))
    expect((container.querySelector('path.chart__line[data-series="p1"]') as SVGPathElement).style.stroke).toBe(rgb(TOKENS.good))
  })

  it('traegt eine Legende und nennt dem Ohr die Endwerte', () => {
    const { container } = lage()

    const legende = container.querySelector('.chart__legend')
    expect(legende?.textContent).toContain('Ostmark')
    expect(legende?.textContent).toContain('Nordland')

    const beschreibung = container.querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? ''
    expect(beschreibung, 'die Endwerte fehlen der Beschreibung').toContain('Nordland 260')
    expect(beschreibung).toContain('Ostmark 260')
  })

  it('sagt ohne Aufzeichnung einen ehrlichen Satz statt einer leeren Flaeche', () => {
    const { container } = render(
      <StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} timeline={[]} />,
    )

    expect(container.querySelector('.chart'), 'ein leeres Diagramm ist keine Auskunft').toBeNull()
    expect(container.querySelector('.chart__empty')?.textContent ?? '').toMatch(/Aufzeichnung/)
  })

  it('braucht drei Tage: unter drei Punkten steht der ehrliche Wartesatz (T-M28-01)', () => {
    // Zwei Punkte ergeben eine Pseudokurve — eine Gerade, die nichts belegt. Statt
    // ihrer steht der Wartesatz, und er nennt den Stand: „Erst 2 von 3 Tagen …".
    const { container } = render(
      <StandingsPanel
        view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })}
        nameOf={nameOf}
        timeline={[zeitreihe[0]!, zeitreihe[1]!]}
      />,
    )

    expect(container.querySelector('.chart'), 'zwei Punkte sind noch keine Kurve').toBeNull()
    expect(container.querySelector('.chart__empty')?.textContent ?? '').toContain('2 von 3')
  })

  it('sagt auch bei einem einzelnen Punkt den Wartesatz statt einer Kurve', () => {
    const { container } = render(
      <StandingsPanel
        view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })}
        nameOf={nameOf}
        timeline={[zeitreihe[0]!]}
      />,
    )

    expect(container.querySelector('.chart')).toBeNull()
    expect(container.querySelector('.chart__empty')).toBeTruthy()
  })
})

describe('R-GAME-02 Das Ende der Partie', () => {
  it('sagt, dass gewonnen wurde, und fasst die Partie zusammen', () => {
    render(
      <VictoryDialog
        view={view({ winner: 'p1', self: 420, provinces: [{ owner: 'p1' }, { owner: 'p1' }, { owner: 'p2' }] })}
        nameOf={nameOf}
        ticksPerDay={24}
        onClose={() => undefined}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Die Partie ist entschieden' })).toBeTruthy()
    expect(screen.getByText('Sie haben gewonnen.')).toBeTruthy()
    expect(screen.getByText('Tag 11 · 420 Punkte · 2 Provinzen')).toBeTruthy()
  })

  it('nennt den Gewinner beim Namen, wenn es nicht der Spieler ist', () => {
    render(
      <VictoryDialog view={view({ winner: 'p2' })} nameOf={nameOf} ticksPerDay={24} onClose={() => undefined} />,
    )

    expect(screen.getByText('Ostmark hat gewonnen.')).toBeTruthy()
  })

  it('laesst sich schliessen — nach dem letzten Zug darf man die Karte noch ansehen', () => {
    const onClose = vi.fn()
    render(<VictoryDialog view={view({ winner: 'p1' })} nameOf={nameOf} ticksPerDay={24} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Karte ansehen' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})

/**
 * Der Abschlussdialog widerspricht sich nicht mehr selbst (T-M12-10, Playtest 25d).
 *
 * Er schrieb "Tag 171 · 0 Punkte · 1 Provinzen" ueber dem Satz "Ihre letzte Provinz ist
 * gefallen". Zwei Fehler in einer Zeile: die Mehrzahl bei eins, und eine Zahl, die die
 * Erinnerung mitzaehlte — `view.provinces` fuehrt auch erinnerte Provinzen, und die
 * Erinnerung eines Ausgeschiedenen friert im Tick vor dem Fall ein.
 */
describe('R-UI-13 Der Abschlussdialog zaehlt richtig', () => {
  const beendet = (provinces: { owner: string | null; stale: boolean }[], score: number) =>
    ({
      tick: 171 * 24,
      playerId: 'p1',
      self: { alive: false, score, name: 'Noah', nation: 'Nordland' },
      victory: { condition: 'points', winner: null },
      provinces: provinces.map((province, index) => ({
        id: `x${index}`,
        name: `Provinz ${index}`,
        ...province,
      })),
      others: [],
    }) as unknown as PublicView

  const summary = () =>
    screen.getByRole('dialog', { name: 'Die Partie ist entschieden' }).textContent ?? ''

  it('zaehlt die erinnerte Provinz eines Ausgeschiedenen nicht mit', () => {
    render(
      <VictoryDialog
        view={beendet([{ owner: 'p1', stale: true }], 0)}
        nameOf={(id) => id}
        ticksPerDay={24}
        onClose={() => undefined}
      />,
    )

    // Vorher stand hier "1 Provinzen", waehrend der Satz darueber vom Fall der letzten
    // Provinz sprach.
    expect(summary()).toContain('0 Provinzen')
  })

  it('schreibt die Einzahl, wo eins gemeint ist', () => {
    render(
      <VictoryDialog
        view={beendet([{ owner: 'p1', stale: false }], 1)}
        nameOf={(id) => id}
        ticksPerDay={24}
        onClose={() => undefined}
      />,
    )

    // Kein \b: der Text laeuft im textContent direkt in den Knopf daneben.
    expect(summary()).toContain('1 Provinz')
    expect(summary()).not.toContain('1 Provinzen')
    expect(summary()).toContain('1 Punkt')
    expect(summary()).not.toContain('1 Punkte')
  })
})

describe('R-UI-16 Jede Macht hat ein Gesicht', () => {
  /**
   * Die Farbe stand seit M6 in der Sicht und wurde ausserhalb der Karte nirgends
   * benutzt (T-M20-02). Wer auf der Karte eine rote Front sah, musste raten, welche der
   * acht Zeilen dazugehoert.
   */
  it('traegt die Farbe jeder Macht in die Zeile — auch die eigene', () => {
    const rows = standingsRows(view({ self: 100, others: [{ id: 'p2', score: 300 }] }), nameOf)

    expect(rows.map((row) => row.color)).toEqual(['rebeccapurple', 'darkslategray'])
  })

  it('zeichnet zu jeder Zeile ein Farbfeld', () => {
    const { container } = render(
      <StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} />,
    )
    const swatches = container.querySelectorAll('.nation__swatch')

    expect(swatches.length, 'nicht jede Zeile traegt ein Farbfeld').toBe(2)
    // jsdom verwirft einen ungueltigen Farbwert stillschweigend, also steht hier ein
    // echter — und der Test sieht damit auch, dass der Wert wirklich ankommt.
    expect((swatches[0] as HTMLElement).style.background).toBe('rebeccapurple')
  })

  it('laesst die Farbe nie das einzige Unterscheidungsmerkmal sein (AK2)', () => {
    // Rund acht Prozent der Maenner unterscheiden Rot und Gruen nicht, und die
    // Spielerfarben enthalten beides. Der Name muss neben dem Feld stehen bleiben —
    // und das Feld selbst darf nichts sagen, was der Name nicht schon sagt, sonst
    // liest ein Vorleseprogramm die Macht zweimal.
    const { container } = render(
      <StandingsPanel view={view({ self: 100, others: [{ id: 'p2', score: 300 }] })} nameOf={nameOf} />,
    )

    // getAllByText: der Name steht auch im (versteckten) Label des Punktebalkens.
    expect(screen.getAllByText('Ostmark').length, 'der Name fehlt neben der Farbe').toBeGreaterThan(0)
    expect(screen.getAllByText('Nordland').length).toBeGreaterThan(0)
    for (const swatch of container.querySelectorAll('.nation__swatch')) {
      expect(swatch.getAttribute('aria-hidden'), 'das Farbfeld spricht mit').toBe('true')
      expect(swatch.textContent, 'das Farbfeld traegt Text').toBe('')
    }
  })
})

/**
 * Drei Linien mit Legende (T-M31-04, D27.6, R-UI-13): eigen, staerkster Feind,
 * staerkster Verbuendeter — die uebrigen duenn und ohne Namen. Acht gleichwertige
 * Linien sagen weniger als drei benannte.
 */
describe('T-M31-04 Der Machtverlauf zeigt drei Linien mit Legende', () => {
  const acht = (): PublicView => {
    const base = view({
      self: 500,
      others: [
        { id: 'p2', score: 900 },
        { id: 'p3', score: 800 },
        { id: 'p4', score: 700 },
        { id: 'p5', score: 600 },
        { id: 'p6', score: 400 },
        { id: 'p7', score: 300 },
        { id: 'p8', score: 200 },
      ],
    })
    return {
      ...base,
      relations: {
        p2: { state: 'war' },
        p3: { state: 'alliance' },
        p4: { state: 'war' },
        p5: { state: 'peace' },
        p6: { state: 'alliance' },
        p7: { state: 'truce' },
        p8: { state: 'peace' },
      },
    } as unknown as PublicView
  }
  const tage: TimelineEntry[] = [1, 2, 3].map((day) => ({
    day,
    scores: Object.fromEntries(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((id, i) => [id, day * (i + 1)])),
    stock: {},
    balance: {},
  }))

  it('waehlt aus acht Maechten die eigene, den staerksten Feind und den staerksten Verbuendeten', () => {
    const rows = standingsRows(acht(), nameOf)
    const series = scoreSeries(rows, tage)

    const roles = Object.fromEntries(series.map((line) => [line.id, line.role]))
    expect(roles.p1).toBe('own')
    expect(roles.p2).toBe('enemy') // 900, staerkster Kriegsgegner (p4 mit 700 nicht)
    expect(roles.p3).toBe('ally') // 800, staerkster Verbuendeter (p6 mit 400 nicht)
    for (const id of ['p4', 'p5', 'p6', 'p7', 'p8']) expect(roles[id], id).toBe('other')
    expect(series.find((line) => line.id === 'p1')!.color).toBe(TOKENS.good)
    expect(series.find((line) => line.id === 'p2')!.color).toBe(TOKENS.accent)
    expect(series.find((line) => line.id === 'p3')!.color).toBe(TOKENS.ally)
    expect(series.find((line) => line.id === 'p5')!.color).toBe(TOKENS.inkSoft)
  })

  it('nennt in der Legende genau drei Namen und zeichnet die uebrigen duenn', () => {
    const { container } = render(<StandingsPanel view={acht()} nameOf={nameOf} timeline={tage} />)

    const legende = [...container.querySelectorAll('.chart__legend > *')].map((el) => el.textContent)
    expect(legende.length).toBe(3)
    expect(legende.join(' ')).toContain('Nordland')
    expect(legende.join(' ')).toContain('Ostmark')
    expect(container.querySelectorAll('path.chart__line').length).toBe(8)
    expect(container.querySelectorAll('path.chart__line--thin').length).toBe(5)
    // Die eigene Kurve traegt eine Flaeche, und jede der drei benannten einen Endpunkt.
    expect(container.querySelector('path.chart__area[data-series="p1"]')).toBeTruthy()
    expect(container.querySelectorAll('.chart__end').length).toBe(3)
  })
})
