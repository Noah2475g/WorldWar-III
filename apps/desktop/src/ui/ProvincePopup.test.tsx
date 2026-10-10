// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProvincePopup, provincePopupRect, PROVINCE_POPUP_WIDTH } from './ProvincePopup.tsx'

afterEach(cleanup)

describe('provincePopupRect (D11/D12)', () => {
  const viewport = { width: 1280, height: 800 }
  const insets = { hintColumnWidth: 220, toolsWidth: 48, bottomBarHeight: 110 }

  it('legt das Popup ueber die Provinz-Mitte (16px Versatz nach oben)', () => {
    const pos = provincePopupRect({ x: 700, y: 400 }, viewport, insets, 160)
    expect(pos).toEqual({ x: 700 - PROVINCE_POPUP_WIDTH / 2, y: 400 - 16 - 160 })
  })

  it('klemmt an die sichtbare linke Kante, wenn die Provinz am Rand der Hinweisspalte liegt', () => {
    const pos = provincePopupRect({ x: 230, y: 400 }, viewport, insets, 160)
    expect(pos.x).toBe(220)
  })

  it('klemmt oben an 12px, wenn die Provinz nahe am oberen Rand liegt', () => {
    const pos = provincePopupRect({ x: 700, y: 30 }, viewport, insets, 160)
    expect(pos.y).toBe(12)
  })
})

describe('ProvincePopup', () => {
  it('rendert Titel und Inhalt in einem dialog mit fixer Breite', () => {
    render(
      <ProvincePopup anchor={{ x: 700, y: 400 }} viewport={{ width: 1280, height: 800 }} title="Bayern">
        <p>Einwohner: 1.000.000</p>
      </ProvincePopup>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Bayern' })
    expect(dialog).not.toBeNull()
    expect(dialog.style.width).toBe(`${PROVINCE_POPUP_WIDTH}px`)
    expect(screen.getByText('Einwohner: 1.000.000')).not.toBeNull()
  })
})
