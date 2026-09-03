// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { IconRow, condense } from './IconRow.tsx'

/**
 * The symbol row (T-M13-01, R-UI-10).
 *
 * The rule this component exists for: a symbol replaces a word, it does not silence
 * one. Everything drawn here carries a text version, because a screen reader is handed
 * an empty box otherwise — and "grafisch statt Text" was never meant as "wortlos".
 */

afterEach(cleanup)

describe('R-UI-10 Die Symbolzeile', () => {
  it('fasst gleiche Eintraege mit Anzahl zusammen', () => {
    expect(
      condense([
        { icon: 'infantry', label: 'Infanterie' },
        { icon: 'infantry', label: 'Infanterie' },
        { icon: 'armour', label: 'Kampfpanzer' },
      ]),
    ).toEqual([
      { icon: 'infantry', label: 'Infanterie', count: 2 },
      { icon: 'armour', label: 'Kampfpanzer', count: 1 },
    ])
  })

  it('behaelt mitgegebene Anzahlen bei, statt sie zu zaehlen', () => {
    // Deposits arrive as "5 food", not as five separate entries.
    expect(condense([{ icon: 'food', label: 'Nahrung', count: 5 }])).toEqual([
      { icon: 'food', label: 'Nahrung', count: 5 },
    ])
  })

  it('zeigt zu jedem Symbol seine Textfassung', () => {
    render(<IconRow items={[{ icon: 'iron', label: 'Eisen', count: 400 }]} />)

    // The count and the name are readable as text, not only as a picture.
    expect(screen.getByText('400')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Eisen/ })).toBeTruthy()
  })

  it('laesst die Eins weg — "1 Kaserne" ist eine Kaserne', () => {
    const { container } = render(<IconRow items={[{ icon: 'barracks', label: 'Kaserne', count: 1 }]} />)

    expect(container.textContent).not.toContain('1')
    expect(screen.getByRole('img', { name: /Kaserne/ })).toBeTruthy()
  })

  it('deckelt die Zeile und sagt, wie viel nicht zu sehen ist', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      icon: 'infantry' as const,
      label: `Einheit ${index}`,
    }))
    render(<IconRow items={many} max={4} />)

    // Five hidden entries are named as a number; silently dropping them would be a lie.
    expect(screen.getByText('+5')).toBeTruthy()
  })

  it('bleibt bei leerer Liste leer, statt eine leere Zeile zu bauen', () => {
    const { container } = render(<IconRow items={[]} />)

    expect(container.firstChild).toBeNull()
  })
})
