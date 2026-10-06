// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Foot, footRows, footRowsWithLeader, isDayReport, latestReport, unreadCount } from './Foot.tsx'
import type { EventEntry } from './Panels.tsx'
import type { StandingsRow } from './Standings.tsx'

/**
 * Der Fuss (T-M31-03, D27.6): die Neu-Marke zaehlt, was seit dem letzten Oeffnen
 * dazukam, und die Rangliste zeigt die eigene Zeile immer — beides rein gerechnet.
 */

afterEach(cleanup)

const entry = (id: string, tick: number, extra: Partial<EventEntry> = {}): EventEntry => ({
  id,
  tick,
  text: `Ereignis ${id}`,
  severity: 'info',
  ...extra,
})

const row = (id: string, score: number, own = false): StandingsRow => ({
  id,
  nation: `Macht ${id}`,
  color: 'testfarbe',
  score,
  relation: 'Frieden',
  seenStrength: 0,
  own,
})

describe('T-M31-03 Der Fuss', () => {
  it('zaehlt die Neu-Marke als Zeilen seit dem zuletzt gesehenen Tick', () => {
    const entries = [entry('a', 10), entry('b', 30), entry('c', 50)]
    expect(unreadCount(entries, 0)).toBe(3)
    expect(unreadCount(entries, 30)).toBe(1)
    expect(unreadCount(entries, 50)).toBe(0)
  })

  it('erkennt den Tagesbericht an Bilanzen oder Absaetzen, nicht am Kampf', () => {
    expect(isDayReport(entry('r', 24, { deltas: [{ label: 'Nahrung', balance: 5 }] }))).toBe(true)
    expect(isDayReport(entry('r', 24, { body: ['Moral steigt.'] }))).toBe(true)
    expect(isDayReport(entry('x', 24))).toBe(false)
    expect(
      isDayReport(entry('k', 24, { body: ['Gefecht'], battle: { sides: [], terrain: 'plains', fortressLevel: 0 } as never })),
    ).toBe(false)
    expect(latestReport([entry('r1', 24, { body: ['a'] }), entry('r2', 48, { body: ['b'] }), entry('x', 60)])?.id).toBe('r2')
    expect(latestReport([entry('x', 60)])).toBeNull()
  })

  it('zeigt vier Zeilen um die eigene Macht und die eigene immer', () => {
    const rows = [row('a', 900), row('b', 800), row('c', 700), row('d', 600), row('e', 500, true), row('f', 400), row('g', 300)]
    expect(footRows(rows).map((r) => r.id)).toEqual(['d', 'e', 'f', 'g'])
    // Ganz oben: das Fenster beginnt bei eins.
    expect(footRows([row('a', 900, true), ...rows.slice(1)]).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    // Weniger als vier Maechte: alle.
    expect(footRows(rows.slice(0, 2)).length).toBe(2)
    for (const r of [rows, [row('a', 900, true), ...rows.slice(1)]]) expect(footRows(r).some((x) => x.own)).toBe(true)
  })

  it('rendert Protokoll, Rangliste (eigene in eigener Klasse) und vier Knoepfe mit Neu-Marke', () => {
    const onPanel = vi.fn()
    const onDispatch = vi.fn()
    const entries = [entry('a', 10), entry('r', 24, { body: ['Tagesbericht'] }), entry('b', 30)]
    render(
      <Foot
        entries={entries}
        ticksPerDay={24}
        rows={[row('a', 900), row('b', 800, true), row('c', 700)]}
        seenTick={10}
        onJump={() => undefined}
        onDispatch={onDispatch}
        onPanel={onPanel}
      />,
    )

    expect(screen.getByRole('region', { name: 'Ereignisse' })).toBeTruthy()
    const standings = screen.getByRole('region', { name: 'Rangliste' })
    expect(within(standings).getAllByRole('listitem').length).toBe(3)
    expect(standings.querySelector('.foot__row--own')?.textContent).toContain('Macht b')

    // Zwei Zeilen nach Tick 10: die Marke sagt 2.
    const lage = screen.getByRole('button', { name: /Rangliste/ })
    expect(lage.textContent).toContain('2')
    fireEvent.click(lage)
    expect(onPanel).toHaveBeenCalledWith('standings')

    fireEvent.click(screen.getByRole('button', { name: 'Depesche' }))
    expect(onDispatch).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Diplomatie' }))
    expect(onPanel).toHaveBeenCalledWith('diplomacy')

    fireEvent.click(screen.getByRole('button', { name: 'Spionage' }))
    expect(onPanel).toHaveBeenCalledWith('espionage')
    // Zeitlimit wegen Last, nicht Verhalten: allein 681 ms, unter verify+Last max 11874 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 60_000)

  it('sperrt die Depesche, solange es keinen Tagesbericht gibt', () => {
    render(
      <Foot entries={[entry('a', 10)]} ticksPerDay={24} rows={[]} seenTick={0} onJump={() => undefined} onDispatch={() => undefined} onPanel={() => undefined} />,
    )
    expect((screen.getByRole('button', { name: 'Depesche' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

/**
 * R-UX-02/AK4 · Platz 1 steht zuerst, die eigene Umgebung bleibt darunter (T-M44-10, Befund B-15).
 *
 * Die Rangliste im Fuss zeigte vier Zeilen um die eigene Macht — wer auf Platz 6 steht, sah den
 * Ersten nie, also auch nicht, wie weit er vorn liegt (R-UI-13). Platz 1 kommt additiv als erste
 * Zeile dazu; T-M31-03 (vier Zeilen um die eigene Macht, die eigene immer) bleibt Wort fuer Wort.
 */
describe('R-UX-02/AK4 Die Rangliste im Fuss beginnt mit Platz 1', () => {
  const rows = [row('a', 900), row('b', 800), row('c', 700), row('d', 600), row('e', 500), row('f', 400, true), row('g', 300), row('h', 200)]

  it('stellt Platz 1 vor die vier Zeilen um die eigene Macht, wenn er nicht ohnehin dabei ist (heute fehlt er)', () => {
    expect(footRowsWithLeader(rows).map((r) => r.id)).toEqual(['a', 'e', 'f', 'g', 'h'])
  })

  it('zeigt ihn nicht doppelt, wenn das Fenster bei Platz 1 beginnt', () => {
    const oben = [row('a', 900, true), ...rows.slice(1, 6)]
    expect(footRowsWithLeader(oben).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(footRowsWithLeader(rows.slice(0, 3)).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('haelt die eigene Umgebung wie bisher: dieselben vier Zeilen wie footRows, nur Platz 1 davor', () => {
    const window = footRows(rows).map((r) => r.id)
    expect(footRowsWithLeader(rows).map((r) => r.id).slice(1)).toEqual(window)
    expect(footRowsWithLeader(rows).some((r) => r.own)).toBe(true)
  })

  it('zeichnet Platz 1 als erste Zeile mit seiner Rangzahl, und die Raenge stimmen', () => {
    render(
      <Foot entries={[]} ticksPerDay={24} rows={rows} seenTick={0} onJump={() => undefined} onDispatch={() => undefined} onPanel={() => undefined} />,
    )
    const items = within(screen.getByRole('region', { name: 'Rangliste' })).getAllByRole('listitem')

    expect(items).toHaveLength(5)
    expect(items[0]!.textContent).toContain('Macht a')
    expect(items[0]!.querySelector('.foot__rank')?.textContent).toBe('1.')
    expect(items[1]!.querySelector('.foot__rank')?.textContent).toBe('5.')
    expect(items[2]!.className).toContain('foot__row--own')
  })

  it('setzt die Zeitspalte des Protokolls einzeilig (white-space: nowrap in app.css)', () => {
    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    // Die spaeteste Regel gewinnt: der Block von T-M44-10 steht am Ende von app.css.
    const rules = [...css.matchAll(/\.log__row time\s*\{([^}]*)\}/g)].map((match) => match[1]!)
    expect(rules.length).toBeGreaterThan(0)
    expect(rules.join('\n')).toMatch(/white-space:\s*nowrap/)
  })
})

describe('T-M46-10 Das Protokoll klappt auf dem Telefon als Blatt auf', () => {
  it('schaltet data-log und die Beschriftung des Knopfes um', () => {
    const { container } = render(
      <Foot entries={[]} ticksPerDay={24} rows={[]} seenTick={0} onJump={() => undefined} onDispatch={() => undefined} onPanel={() => undefined} />,
    )
    const footer = container.querySelector('footer')!
    expect(footer.getAttribute('data-log')).toBe('closed')
    fireEvent.click(screen.getByRole('button', { name: 'Protokoll öffnen' }))
    expect(footer.getAttribute('data-log')).toBe('open')
    const close = screen.getByRole('button', { name: 'Protokoll schließen' })
    expect(close.getAttribute('aria-expanded')).toBe('true')
    // Zeitlimit wegen Last, nicht Verhalten: allein 90 ms, unter verify+Last max 4997 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 20_000)
})
