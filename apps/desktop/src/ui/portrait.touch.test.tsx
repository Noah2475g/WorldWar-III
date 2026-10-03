// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIMITS } from '../../../../scripts/ux-thresholds.mjs'
import { t } from '../i18n/text.ts'
import { OrientationHint } from './OrientationHint.tsx'

/**
 * Telefon hochkant (T-M44-03a, R-UX-01, R-UX-05/AK2, Befund B-01).
 *
 * Gebunden ist, was jsdom binden kann: die Textgestalt der Regel in `touch.css` und das Verhalten
 * des Hinweises. jsdom rechnet kein Layout und wendet `@media`-Regeln nur fuer `all` und `screen`
 * an (WORKFLOW Falle 25) — den Kartenanteil misst `pnpm ux:check --only R-UX-01` im echten Fenster;
 * die Zahlen dort und hier stammen aus derselben Quelle (`LIMITS` in `scripts/ux-thresholds.mjs`),
 * damit keine zweite Zahl entsteht, die jemand allein anheben koennte.
 */

const UI = `${process.cwd()}/apps/desktop/src/ui`
const touchCss = readFileSync(`${UI}/touch.css`, 'utf8')
const appCss = readFileSync(`${UI}/app.css`, 'utf8')

const QUERY = '@media (max-width: 599px) and (orientation: portrait)'

/** Der Inhalt eines `@media`-Blocks, Klammer fuer Klammer gezaehlt (kein Regex ueber Verschachtelung). */
function blockOf(css: string, query: string): string {
  const start = css.indexOf(`${query} {`)
  if (start < 0) return ''
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, i)
    }
  }
  return ''
}

/** Alle Deklarationen einer Regel, deren Auswahlliste `selector` genau enthaelt. */
function declarationsOf(block: string, selector: string): string {
  const out: string[] = []
  const bare = block.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(',').map((s) => s.trim())
    if (selectors.includes(selector)) out.push(match[2]!)
  }
  return out.join('\n')
}

const portrait = blockOf(touchCss, QUERY)

describe('R-UX-01/AK1: die Hochformat-Regel haengt an der Breite und der Ausrichtung', () => {
  it('steht in touch.css unter (max-width: 599px) and (orientation: portrait)', () => {
    expect(portrait.length, `${QUERY} fehlt in touch.css`).toBeGreaterThan(200)
  })

  it('haengt nicht an data-input: auch ein schmales Mausfenster stapelt', () => {
    expect(portrait).not.toMatch(/data-input/)
  })

  it('ist nicht dieselbe Regel wie das Telefon quer (max-height: 480px)', () => {
    // Die Ursache von B-01: der Stapel galt nur bei max-height 480 und fehlte im Hochformat ganz.
    expect(touchCss).toMatch(/@media \(max-height: 480px\) \{/)
    expect(QUERY).not.toMatch(/max-height/)
  })

  it('legt die Seite in eine Spalte, die schmaler werden darf als ihr Inhalt', () => {
    expect(declarationsOf(portrait, ':root:root .app')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(declarationsOf(portrait, ':root:root .main')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })
})

describe('R-UX-01/AK1: Karte oben, Seitenleiste darunter, Kartenanteil aus den Schwellen', () => {
  /** Die Hoehe der Karte als Anteil der Fensterhoehe — `--map-h`, die letzte (dvh-)Deklaration gilt. */
  const mapH = (declarations: string): string => [...declarations.matchAll(/--map-h:\s*([^;]+);/g)].at(-1)?.[1] ?? ''
  const shareOf = (value: string): number => Number(/(\d+(?:\.\d+)?)dvh/.exec(value)?.[1] ?? 'NaN') / 100

  it('gibt der Karte ohne Panel mindestens den Anteil der Anforderung', () => {
    const app = declarationsOf(portrait, ':root:root .app')
    const share = shareOf(mapH(app))
    expect(share).toBeGreaterThanOrEqual(LIMITS.mapShareNoPanel)
  })

  it('gibt der Karte mit offenem Panel mindestens den Anteil der Anforderung', () => {
    const open = declarationsOf(portrait, ':root:root .app[data-panel="open"]')
    const share = shareOf(mapH(open))
    expect(share).toBeGreaterThanOrEqual(LIMITS.mapShareWithPanel)
    // Ein offenes Panel darf die Karte nie breiter machen als ohne Panel.
    const closed = shareOf(mapH(declarationsOf(portrait, ':root:root .app')))
    expect(share).toBeLessThan(closed)
  })

  it('stapelt: Zeile 1 die Karte, Zeile 2 die Seitenleiste, die in sich rollt', () => {
    const main = declarationsOf(portrait, ':root:root .main')
    expect(main).toMatch(/grid-template-rows:\s*var\(--map-h\)\s+minmax\(0,\s*1fr\)/)
    const side = declarationsOf(portrait, ':root:root .side')
    expect(side).toMatch(/overflow-y:\s*auto/)
    expect(side).toMatch(/overscroll-behavior:\s*contain/)
    expect(side).toMatch(/border-left:\s*0/)
  })

  it('stellt dem Panel keinen Rahmen mehr zur Seite, der die Spalte verdraengte', () => {
    // app.css gibt .main zwei Spalten (1fr 380px); ohne die Hochformat-Regel bliebe der Karte 0 px.
    expect(appCss).toMatch(/grid-template-columns:\s*1fr 380px/)
  })
})

describe('R-UX-01/AK2: Kopfleiste einzeilig und wischbar, Fuss kompakt', () => {
  it('haelt die Kopfleiste in einer Zeile, die seitlich rollt', () => {
    const header = declarationsOf(portrait, ':root:root .header__top')
    expect(header).toMatch(/flex-wrap:\s*nowrap/)
    expect(header).toMatch(/overflow-x:\s*auto/)
  })

  it('laesst jedes Kind der Kopfleiste seine Breite behalten, statt zu stauchen', () => {
    expect(declarationsOf(portrait, ':root:root .header__top > *')).toMatch(/flex:\s*none/)
  })

  it('macht den Fuss einzeilig im Protokoll und die Knoepfe zu einer wischbaren Reihe', () => {
    expect(declarationsOf(portrait, ':root:root .foot')).toMatch(/max-height:\s*none/)
    expect(declarationsOf(portrait, ':root:root .foot .log')).toMatch(/max-height:\s*44px/)
    const buttons = declarationsOf(portrait, ':root:root .foot__buttons')
    expect(buttons).toMatch(/flex-direction:\s*row/)
    expect(buttons).toMatch(/overflow-x:\s*auto/)
  })

  it('laesst das Siegziel in der Zeile stehen: nur der Titel entfaellt', () => {
    // Die Aufnahme (--mp) wartet auf das Siegziel; eine ausgeblendete Auskunft machte aus
    // „wischbar“ ein „nicht da“.
    expect(declarationsOf(portrait, ':root:root .header__title')).toMatch(/display:\s*none/)
    expect(portrait).not.toMatch(/\.meter\s*[,{]/)
  })

  it('zeichnet die Uebersichtskarte nicht: sie nimmt einem 300 px hohen Kartenstreifen ein Viertel', () => {
    expect(declarationsOf(portrait, ':root:root .map-overview')).toMatch(/display:\s*none/)
  })
})

describe('R-UX-05/AK2: die Einfuehrung bleibt auf der Karte und verdeckt weder Provinzwahl noch Fuss', () => {
  it('endet ueber der Kante der Karte statt am Rand der ganzen Seite', () => {
    const tutorial = declarationsOf(portrait, ':root:root .tutorial')
    expect(tutorial).toMatch(/top:\s*calc\(var\(--map-h\)/)
    expect(tutorial).toMatch(/transform:\s*translateY\(-100%\)/)
    // Ihre Hoehe laesst die Zoomknoepfe oben rechts frei (44 px + Abstaende).
    expect(tutorial).toMatch(/max-height:\s*calc\(var\(--map-h\)\s*-\s*44px/)
  })

  it('laesst das Wozu im Hochformat weg: der Streifen ist kurz', () => {
    expect(declarationsOf(portrait, ':root:root .tutorial__why')).toMatch(/display:\s*none/)
  })
})

describe('R-UX-05/AK2: der Hinweis „quer halten empfohlen“ blockiert nicht', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('traegt den Text aus der Sprachdatei', () => {
    render(<OrientationHint />)
    expect(screen.getByRole('note').textContent).toMatch(/quer halten/i)
    expect(t('orientation.hint')).toMatch(/quer halten/i)
  })

  it('ist kein Dialog, nimmt keinen Fokus und haelt keine Eingabe auf', () => {
    const before = document.activeElement
    const { container } = render(<OrientationHint />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(container.querySelector('[aria-modal]')).toBeNull()
    expect(document.activeElement).toBe(before)
    // Ohne Hochformat gezeichnet wird er gar nicht: app.css blendet ihn ausserhalb der Regel aus.
    expect(appCss).toMatch(/\.orient-hint\s*\{[^}]*display:\s*none/)
    expect(declarationsOf(portrait, ':root:root .orient-hint')).toMatch(/display:\s*flex/)
  })

  it('verschwindet mit einem Tipp und kommt nicht wieder', () => {
    const first = render(<OrientationHint />)
    fireEvent.click(screen.getByRole('button', { name: t('orientation.dismiss') }))
    expect(screen.queryByRole('note')).toBeNull()
    first.unmount()

    render(<OrientationHint />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('bleibt auch ohne Speicher bedienbar (Privatfenster, gesperrte Webdaten)', () => {
    const broken = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('gesperrt')
      },
    })
    try {
      render(<OrientationHint />)
      expect(screen.getByRole('note')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: t('orientation.dismiss') }))
      expect(screen.queryByRole('note')).toBeNull()
    } finally {
      Object.defineProperty(window, 'localStorage', broken)
    }
  })

  it('ist ein Ziel von mindestens 44 px, wo es gezeichnet wird', () => {
    expect(declarationsOf(portrait, ':root:root .orient-hint button')).toMatch(/min-(height|width):\s*44px/)
  })
})

describe('R-UX-01/AK3: Telefon quer (667x375) ist nicht schlechter, die Seitenleiste laeuft nicht mehr ueber (B-25)', () => {
  const landscape = blockOf(touchCss, '@media (max-height: 480px)')

  it('laesst die Provinzwahl in der schmalen Leiste schrumpfen', () => {
    const rule = declarationsOf(landscape, ":root[data-input='touch'] .picker select")
    expect(rule).toMatch(/min-width:\s*0/)
    expect(rule).toMatch(/flex:\s*1 1 0/)
  })

  it('beruehrt die Querregeln sonst nicht: Seitenleiste schmaler, Kopfleiste einzeilig', () => {
    expect(declarationsOf(landscape, ":root[data-input='touch'] .header__top")).toMatch(/flex-wrap:\s*nowrap/)
    expect(declarationsOf(landscape, ":root[data-input='touch']")).toMatch(/--touch-side:\s*clamp\(240px,\s*38vw,\s*320px\)/)
  })
})
