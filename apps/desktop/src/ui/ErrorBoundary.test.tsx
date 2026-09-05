// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

/**
 * Was der Spieler sieht, wenn die Oberfläche aufgibt (T-M14-10, Befund N6).
 *
 * Vorher: nichts. Eine weiße Fläche, kein Hinweis, kein Text zum Weitergeben. Für Noahs
 * Playtest hieße das, dass ein Absturz keinerlei Information hinterlässt.
 */

afterEach(cleanup)

function Kaputt(): never {
  throw new Error('Kartenzeichnung fehlgeschlagen')
}

describe('R-UI-13 Ein Fehler wird gezeigt, nicht verschwiegen', () => {
  it('zeigt eine Meldung statt einer weissen Flaeche', () => {
    const gesehen = vi.fn()
    render(
      <ErrorBoundary onError={gesehen}>
        <Kaputt />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.getByText(/Kartenzeichnung fehlgeschlagen/)).toBeTruthy()
    expect(gesehen).toHaveBeenCalled()
  })

  it('nennt den Weg zurueck', () => {
    render(
      <ErrorBoundary onError={vi.fn()}>
        <Kaputt />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy()
  })

  it('sagt, dass der Fehlertext nirgendwohin geht', () => {
    // Z3: das Spiel funkt nicht nach Hause, und der Spieler soll das wissen, bevor er
    // sich fragt, ob er gerade etwas gesendet hat.
    render(
      <ErrorBoundary onError={vi.fn()}>
        <Kaputt />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/nirgendwohin gesendet/)).toBeTruthy()
  })

  it('laesst heile Inhalte in Ruhe', () => {
    render(
      <ErrorBoundary>
        <p>Alles in Ordnung</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Alles in Ordnung')).toBeTruthy()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
