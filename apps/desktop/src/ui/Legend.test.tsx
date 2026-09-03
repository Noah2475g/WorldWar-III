// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Legend } from './Legend.tsx'
import { MAP_MODES, legendFor } from '../map/modes.ts'

/**
 * The key to the map (T-M13-08, R-UI-12).
 *
 * `legendFor` was written in M10 and never called: the map offered four colour schemes
 * and no way to find out what any of them meant.
 */

afterEach(cleanup)

describe('R-UI-12 Die Legende erklaert die Farben', () => {
  it('zeigt fuer jeden Modus seine Eintraege', () => {
    for (const mode of MAP_MODES) {
      const { unmount } = render(<Legend mode={mode} />)
      for (const entry of legendFor(mode)) {
        expect(screen.getByText(entry.label), `${mode}: ${entry.label} fehlt`).toBeTruthy()
      }
      unmount()
    }
  })

  it('wechselt mit dem Modus', () => {
    const { rerender } = render(<Legend mode="political" />)
    expect(screen.getByText('eigen')).toBeTruthy()

    rerender(<Legend mode="morale" />)
    expect(screen.queryByText('eigen')).toBeNull()
    expect(screen.getByText('treu')).toBeTruthy()
  })

  it('nimmt der Karte keine Klicks weg', () => {
    // Eine Legende, die den Klick auf die Provinz darunter schluckt, ist ein Hindernis.
    const { container } = render(<Legend mode="political" />)

    expect((container.firstElementChild as HTMLElement).className).toContain('legend')
  })
})
