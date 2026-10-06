// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmButton } from './ConfirmButton.tsx'

/**
 * Der zweite Klick am selben Knopf (T-M44-09a, R-UX-04/AK1, Entscheid F2 vom 2026-10-03).
 *
 * Kein Dialog, keine Zeitüberschreitung: der erste Klick verwandelt den Knopf, der zweite
 * sendet. Was die Rückfrage von einer Zeitschaltuhr unterscheidet, steht in den letzten
 * drei Fällen — sie bleibt offen, bis der Spieler sich entscheidet, und sie fällt zurück,
 * wenn er woanders hinsieht (Escape, Fokusverlust).
 */

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const FOLGE = 'Stand 1 wird überschrieben. Noch einmal klicken.'

function zeige(extra: { disabled?: boolean } = {}) {
  const onConfirm = vi.fn()
  render(
    <ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={onConfirm} {...extra} />,
  )
  return { onConfirm, knopf: () => screen.getByRole('button') as HTMLButtonElement }
}

describe('R-UX-04/AK1 Der Bestätigungsknopf fragt mit einem zweiten Klick nach', () => {
  it('sendet beim ersten Klick nichts und nennt die Folge im Knopf', () => {
    const { onConfirm, knopf } = zeige()

    expect(knopf().textContent).toBe('Speichern')
    fireEvent.click(knopf())

    expect(onConfirm).not.toHaveBeenCalled()
    expect(knopf().textContent).toBe(FOLGE)
    // Zeitlimit wegen Last, nicht Verhalten: allein 337 ms, unter verify+Last max 8308 ms (gemessen 2026-10-05, t_3cad0a35).
  }, 30_000)

  it('sagt die Folge über aria-live an, in einer Region, die schon vor dem Klick da ist', () => {
    // Eine Live-Region, die erst mit ihrem Text entsteht, wird von Vorleseprogrammen
    // nicht angesagt: sie muss vorher im Baum stehen und leer sein.
    const { knopf } = zeige()
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')

    fireEvent.click(knopf())

    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe(FOLGE)
  })

  it('sendet beim zweiten Klick am selben Knopf und fällt dann zurück', () => {
    const { onConfirm, knopf } = zeige()

    fireEvent.click(knopf())
    fireEvent.click(knopf())

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(knopf().textContent).toBe('Speichern')
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('bricht mit Escape ab, ohne den Dialog darum zu schließen', () => {
    const außen = vi.fn()
    const onConfirm = vi.fn()
    render(
      <div onKeyDown={außen}>
        <ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={onConfirm} />
      </div>,
    )
    const knopf = screen.getByRole('button')

    fireEvent.click(knopf)
    fireEvent.keyDown(knopf, { key: 'Escape' })

    expect(knopf.textContent).toBe('Speichern')
    expect(onConfirm).not.toHaveBeenCalled()
    // Die erste Escape-Taste beantwortet die Frage; erst die zweite schließt den Dialog.
    expect(außen).not.toHaveBeenCalled()
    fireEvent.click(knopf)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('lässt Escape durch, solange keine Rückfrage offen ist', () => {
    const außen = vi.fn()
    render(
      <div onKeyDown={außen}>
        <ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={vi.fn()} />
      </div>,
    )

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' })

    expect(außen).toHaveBeenCalledOnce()
  })

  it('bricht beim Fokusverlust ab', () => {
    const { onConfirm, knopf } = zeige()

    fireEvent.click(knopf())
    fireEvent.blur(knopf())

    expect(knopf().textContent).toBe('Speichern')
    fireEvent.click(knopf())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('hat keine Zeitüberschreitung: auch nach einer Stunde steht die Frage noch', () => {
    vi.useFakeTimers()
    const { onConfirm, knopf } = zeige()

    fireEvent.click(knopf())
    vi.advanceTimersByTime(60 * 60 * 1000)

    expect(knopf().textContent).toBe(FOLGE)
    fireEvent.click(knopf())
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('setzt keinen Zeitgeber — nicht im Quelltext (Wächter R-FREE-05 liest nur Namen)', () => {
    const quelle = readFileSync(`${process.cwd()}/apps/desktop/src/ui/ConfirmButton.tsx`, 'utf8')
    // Kommentare dürfen das Wort nennen; Code darf es nicht aufrufen.
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/setTimeout|setInterval|requestAnimationFrame/)
  })

  it('fragt nicht, wenn der Knopf gesperrt ist, und vergisst eine offene Frage dabei', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(<ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe(FOLGE)

    rerender(<ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={onConfirm} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toBe('Speichern')

    rerender(<ConfirmButton label="Speichern" consequence={FOLGE} onConfirm={onConfirm} />)
    expect(screen.getByRole('button').textContent).toBe('Speichern')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('übernimmt die Klasse des Knopfes, den er ersetzt', () => {
    render(<ConfirmButton label="Los" consequence={FOLGE} onConfirm={vi.fn()} className="button button--primary" />)
    expect(screen.getByRole('button').className).toContain('button--primary')
  })
})
