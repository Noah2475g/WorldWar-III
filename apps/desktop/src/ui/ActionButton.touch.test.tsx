// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import type { VisibleProvince } from '@worldwar/core'
import { afterEach, describe, expect, it } from 'vitest'
import { applyInputMode } from './inputMode.ts'
import { ActionGroup, ActionRow, ProvincePanel, buttonTitle, touchHint, type Action } from './Panels.tsx'

/**
 * Was sonst nur im Tooltip steht, steht unter dem Knopf (Android-Emulator, 2026-09-24).
 *
 * Preis, Bauzeit, Stufe und Freischalttag eines Befehls standen bisher allein im
 * `title` — und ein Finger schwebt nie. Im Touch-Betrieb zeichnet `ActionButton` sie
 * deshalb sichtbar als `<small class="action__hint">`, und den Sperrgrund dort, wo er
 * sonst nirgends sichtbar waere (Bauplatz, Haltung). Im Mausbetrieb bleibt alles, wie es
 * war: kein neues Element, derselbe Titel.
 */

let dispose: (() => void) | null = null

function touch(): void {
  dispose = applyInputMode({ location: { search: '?touch=1' }, document })
}

afterEach(() => {
  dispose?.()
  dispose = null
  cleanup()
})

const act = (over: Partial<Action> = {}): Action => ({
  id: 'build-factory',
  label: 'Fabrik',
  disabledReason: null,
  hint: '400 Eisen · 3 Tage',
  onRun: () => undefined,
  ...over,
})

const gesperrt = (): Action =>
  act({ disabledReason: 'Das gibt es erst ab Spieltag 8.', hint: 'ab Spieltag 8 · 400 Eisen · 3 Tage' })

const province: VisibleProvince = {
  id: 'NORD-1',
  name: 'Nordmark',
  owner: 'nord',
  kind: 'city',
  terrain: 'plains',
  coastal: false,
  neighbors: [],
  seaLinks: [],
  morale: 70_000,
  population: 500_000,
  deposits: {},
  buildings: { barracks: 1 },
  buildQueueLength: 0,
  stale: false,
  asOfTick: 0,
}

function Bauplaetze({ actions }: { actions: Action[] }) {
  return (
    <ProvincePanel
      province={province}
      ownerName="Nordland"
      actions={[]}
      groups={[{ id: 'build', title: 'Bauen', actions }]}
      ticksPerDay={24}
      currentTick={0}
    />
  )
}

describe('touchHint: dieselben Angaben wie der Titel, ohne Doppeltes', () => {
  it('nennt die Kosten und laesst den Grund weg, wenn er schon darunter steht', () => {
    expect(touchHint(act(), true)).toEqual({ reason: null, cost: '400 Eisen · 3 Tage' })
    // Der Spieltag steckt im Grund und faellt aus den Kosten — wie im Titel.
    expect(touchHint(gesperrt(), true)).toEqual({ reason: null, cost: '400 Eisen · 3 Tage' })
  })

  it('nimmt den Grund dazu, wenn der Knopf ihn sonst nicht zeigt', () => {
    expect(touchHint(gesperrt(), false)).toEqual({ reason: 'Das gibt es erst ab Spieltag 8.', cost: '400 Eisen · 3 Tage' })
  })

  it('traegt zusammen genau das, was im Titel steht', () => {
    const hint = touchHint(gesperrt(), false)!
    expect([hint.reason, hint.cost].join(' · ')).toBe(buttonTitle(gesperrt()))
  })

  it('gibt nichts zurueck, wo es nichts zu sagen gibt', () => {
    expect(touchHint({ disabledReason: null }, true)).toBeNull()
    expect(touchHint(act({ hint: '' }), false)).toBeNull()
  })
})

describe('ActionButton im Mausbetrieb: unveraendert', () => {
  it('zeichnet keinen sichtbaren Hinweis, nur den Titel', () => {
    const { container } = render(<ActionRow actions={[act()]} />)

    expect(container.querySelector('.action__hint')).toBeNull()
    expect(screen.getByRole('button', { name: 'Fabrik' }).getAttribute('title')).toBe('400 Eisen · 3 Tage')
  })
})

describe('ActionButton im Touch-Betrieb: der Hinweis steht sichtbar da', () => {
  it('zeigt Kosten und Dauer unter dem Knopf', () => {
    touch()
    const { container } = render(<ActionRow actions={[act()]} />)

    const hint = container.querySelector('.action__hint')!
    expect(hint.textContent).toBe('400 Eisen · 3 Tage')
    // Fuers Ohr steht dasselbe schon im Titel und in der Beschreibung — nicht zweimal.
    expect(hint.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('button', { name: 'Fabrik' }).getAttribute('title')).toBe('400 Eisen · 3 Tage')
  })

  it('wiederholt den sichtbaren Grund nicht', () => {
    touch()
    const { container } = render(<ActionRow actions={[gesperrt()]} />)

    expect(container.querySelector('.action__reason')!.textContent).toBe('Das gibt es erst ab Spieltag 8.')
    expect(container.querySelector('.action__hint-reason')).toBeNull()
    expect(container.querySelector('.action__hint')!.textContent).toBe('400 Eisen · 3 Tage')
  })

  it('zeigt im Bauplatz Grund und Kosten, die dort sonst nur der Titel kannte', () => {
    touch()
    const { container } = render(
      <Bauplaetze actions={[gesperrt(), act({ id: 'build-barracks', label: 'Kaserne', hint: 'Stufe 2 · 200 Eisen · 2 Tage' })]} />,
    )

    const frei = container.querySelector('.slot--free .action__hint')!
    expect(frei.querySelector('.action__hint-reason')!.textContent).toBe('Das gibt es erst ab Spieltag 8.')
    expect(frei.textContent).toContain('400 Eisen · 3 Tage')
    // Der Ausbau-Knopf im gebauten Feld: nur ein Plus — der Hinweis sagt, was er kostet.
    expect(container.querySelector('.slot--built .action__hint')!.textContent).toBe('Stufe 2 · 200 Eisen · 2 Tage')
  })

  it('blendet in einer Gruppe den Grund aus, der schon ueber der Gruppe steht', () => {
    touch()
    const styles = ['app.css', 'touch.css'].map((file) => {
      const style = document.createElement('style')
      style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/${file}`, 'utf8')
      document.head.appendChild(style)
      return style
    })
    try {
      const reason = 'Dafür fehlt das Gebäude: Kaserne.'
      const { container } = render(
        <>
          <ActionGroup
            group={{
              id: 'recruit',
              title: 'Ausheben',
              actions: [
                act({ id: 'recruit-a', label: 'Infanterie', disabledReason: reason, hint: '100 Geld' }),
                act({ id: 'recruit-b', label: 'Panzer', disabledReason: reason, hint: '300 Geld' }),
              ],
            }}
          />
          <Bauplaetze actions={[gesperrt()]} />
        </>,
      )

      expect(container.querySelector('.group__reason')!.textContent).toBe(reason)
      for (const versteckt of container.querySelectorAll('.group .action__hint-reason')) {
        expect(window.getComputedStyle(versteckt).display).toBe('none')
      }
      expect(container.querySelectorAll('.group .action__hint-reason')).toHaveLength(2)
      expect(window.getComputedStyle(container.querySelector('.slot .action__hint-reason')!).display).not.toBe('none')
      // Die Kosten bleiben in der Gruppe sichtbar: sie sind je Knopf verschieden.
      expect([...container.querySelectorAll('.group .action__hint')].map((hint) => hint.textContent)).toEqual([
        `${reason}100 Geld`,
        `${reason}300 Geld`,
      ])
    } finally {
      for (const style of styles) style.remove()
    }
  })
})
