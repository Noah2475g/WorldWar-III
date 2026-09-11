// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { RESOURCE_KEYS, type PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header, RESOURCE_GROUPS, victoryProgress } from './Header.tsx'
import { reachInDays } from './format.ts'

/**
 * The header (T-M13-07, R-UI-13).
 *
 * The score alone answers nothing: 4 200 points is a good game in a small world and a
 * hopeless one in a large one. What the player is asking is how close the end is, and
 * that is a share against a threshold.
 */

afterEach(cleanup)

const view = (self: number, others: number[], goal?: number): PublicView =>
  ({
    tick: 0,
    playerId: 'p1',
    self: {
      name: 'Mensch',
      nation: 'Nordland',
      resources: { food: 1000, wood: 1000, iron: 500, coal: 500, oil: 250, rare: 100, money: 2500 },
      shortages: [],
      capitalProvinceId: 'A',
      score: self,
      reputation: 1000,
      aiBonusMultiplier: 1000,
    },
    others: others.map((score, index) => ({
      id: `p${index + 2}`,
      name: `KI ${index + 1}`,
      nation: 'Ostmark',
      // Kein Hex-Literal: Farben gehoeren in tokens.ts, und das gilt auch hier.
      color: 'testfarbe',
      alive: true,
      score,
    })),
    relations: {},
    provinces: [],
    armies: [],
    marketPrices: { food: 1, wood: 1, iron: 1, coal: 1, oil: 1, rare: 1, money: 1 },
    victory: { condition: 'points', winner: null, ...(goal === undefined ? {} : { pointsShareToWin: goal }) },
  }) as unknown as PublicView

const noop = () => undefined

const renderHeader = (
  v: PublicView | null,
  extra: {
    stalled?: boolean
    speed?: number
    onSpeed?: (s: number) => void
    onMode?: (m: string) => void
    alarm?: { provinceId: string; provinceName: string; intruder: string } | null
    onAlarm?: () => void
    fastForwarding?: boolean
  } = {},
) =>
  render(
    <Header
      view={v}
      ticksPerDay={24}
      speed={extra.speed ?? 0}
      stalled={extra.stalled ?? false}
      fastForwarding={extra.fastForwarding ?? false}
      fastForwardNotice={null}
      mode="political"
      onSpeed={extra.onSpeed ?? noop}
      onFastForward={noop}
      onAbort={noop}
      onMode={extra.onMode ?? noop}
      onMenu={noop}
      onSaves={noop}
      onPanel={noop}
      alarm={extra.alarm ?? null}
      onAlarm={extra.onAlarm ?? noop}
    />,
  )

describe('R-UI-13 Der Weg zum Sieg', () => {
  it('rechnet den eigenen Anteil an allen Punkten', () => {
    // 300 von 1000 Punkten sind 30 %, das Ziel 900 Promille sind 90 %.
    expect(victoryProgress(view(300, [400, 300], 900))).toEqual({ share: 30, goal: 90 })
  })

  it('zeigt den Anteil als Anzeige mit beiden Zahlen', () => {
    renderHeader(view(300, [400, 300], 900))

    const meter = screen.getByRole('meter', { name: 'Siegziel' })
    expect(meter.textContent).toContain('30 % von 90 %')
  })

  it('bleibt still, wenn es nichts zu rechnen gibt', () => {
    // Ohne Schwelle (Sicht ohne Regeln) und vor dem ersten Punkt gibt es keinen Anteil.
    expect(victoryProgress(view(300, [400], undefined))).toBeNull()
    expect(victoryProgress(view(0, [0], 900))).toBeNull()
    expect(victoryProgress(null)).toBeNull()

    renderHeader(view(0, [0], 900))
    expect(screen.queryByRole('meter', { name: 'Siegziel' })).toBeNull()
  })
})

/**
 * Eine stehende Uhr nennt sich Pausiert (T-M22-05, R-TIME-02, Befund V2-09): bei
 * verdecktem Fenster feuert requestAnimationFrame nicht, die Anzeige stand auf "100",
 * die Zeit stand — ohne ein Wort. Ob sie steht, entscheidet App; hier steht die
 * andere Haelfte: dass die Leiste es auch sagt, als role="status" fuers Ohr.
 */
describe('R-TIME-02 Eine stehende Uhr sagt es', () => {
  it('zeigt Pausiert, wenn die Uhr trotz Tempo steht', () => {
    renderHeader(view(300, [400], 900), { stalled: true, speed: 10 })

    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Pausiert')).toBeTruthy()
  })

  it('schweigt, solange die Uhr laeuft oder bewusst pausiert ist', () => {
    renderHeader(view(300, [400], 900), { stalled: false, speed: 10 })

    expect(screen.queryByText('Pausiert')).toBeNull()
  })
})

describe('R-UI-10 Die Kopfleiste zeigt Rohstoffe mit Symbol', () => {
  it('setzt vor jede Zahl das Zeichen ihres Rohstoffs', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const list = screen.getByRole('list', { name: 'Rohstoffe' })

    expect(list.querySelectorAll('svg').length).toBe(7)
    // Und der Name bleibt lesbar — fuer Vorleseprogramme und fuer den Zeiger.
    expect(screen.getByText('Nahrung')).toBeTruthy()
    expect(container.querySelector('.resource')?.getAttribute('title')).toBe('Nahrung')
  })
})

describe('R-UI-09 Die Kopfleiste sagt, wie lange es reicht', () => {
  const withEconomy = (stock: number, balance: number): PublicView => {
    const base = view(100, [100], 900)
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: { stock, production: 0, consumption: Math.max(0, -balance), balance },
          wood: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          iron: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          coal: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          oil: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          rare: { stock: 5000, production: 100, consumption: 0, balance: 100 },
          money: { stock: 5000, production: 100, consumption: 0, balance: 100 },
        },
      },
    } as PublicView
  }

  it('nennt die Reichweite im Titel, wenn der Vorrat schrumpft (T-M29-02)', () => {
    const { container } = renderHeader(withEconomy(10_000, -5000))

    // Seit dem Kriegsrat steht die Reichweite im `title` der Bilanz (D27.6) — und seit
    // T-M36-02 zusaetzlich sichtbar in der Zelle, sobald der Vorrat draengt, aber
    // gekuerzt („2 T"). Die Leiste bleibt damit eine Zeile.
    expect(container.querySelector('.resource--food em')?.getAttribute('title')).toContain('noch 2 Tage')
    expect(container.querySelector('.resource--food .resource__reach')?.textContent).toContain('2 T')
  })

  it('schweigt, solange der Vorrat waechst', () => {
    const { container } = renderHeader(withEconomy(10_000, 5000))

    expect(container.querySelector('.resource--food em')?.getAttribute('title')).not.toMatch(/noch .* Tage/)
  })

  it('kennzeichnet einen Vorrat unter drei Tagen als Mangel', () => {
    const { container } = renderHeader(withEconomy(4000, -2000))

    expect(container.querySelector('.resource--short')).toBeTruthy()
  })

  it('rechnet keine Reichweite aus einem leeren Lager oder einer Null-Bilanz', () => {
    expect(reachInDays(0, -100)).toBeNull()
    expect(reachInDays(1000, 0)).toBeNull()
    expect(reachInDays(1000, -100)).toBe(10)
  })
})

/**
 * Die Kopfleiste im Kriegsrat (T-M29-02, D27.1/D27.2, R-UI-03, R-TIME-04, R-UI-10).
 *
 * Tempo und Kartenmodus sind Knopfgruppen mit genau einem gedrueckten Knopf — ein
 * `<select>` sagt nicht auf einen Blick, was gilt, und ein Regler ohne Rasten sagt
 * nicht, wie schnell man wirklich faehrt. Die Tagesbilanz traegt ihr Vorzeichen im
 * Text, nicht nur in der Farbe, damit sie auch ohne Farbe lesbar bleibt.
 */
describe('T-M29-02 Kopfleiste im Kriegsrat', () => {
  const withBalance = (balance: number): PublicView => {
    const base = view(100, [100], 900)
    const flow = { stock: 5000, production: 100, consumption: 0, balance: 100 }
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: { stock: 50_000, production: Math.max(0, balance), consumption: Math.max(0, -balance), balance },
          wood: flow,
          iron: flow,
          coal: flow,
          oil: flow,
          rare: flow,
          money: flow,
        },
      },
    } as PublicView
  }

  it('traegt in der Tempo-Gruppe genau einen gedrueckten Knopf und schaltet per Klick', () => {
    const onSpeed = vi.fn()
    renderHeader(view(100, [100], 900), { speed: 0, onSpeed })
    const group = screen.getByRole('group', { name: 'Geschwindigkeit' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.length).toBe(1)
    expect(pressed[0]?.getAttribute('aria-label')).toBe('Pause')

    fireEvent.click(within(group).getByRole('button', { name: '10' }))
    expect(onSpeed).toHaveBeenCalledWith(10)
  })

  it('zeigt bei laufender Uhr die Stufe als gedrueckt, nicht die Pause', () => {
    renderHeader(view(100, [100], 900), { speed: 25 })
    const group = screen.getByRole('group', { name: 'Geschwindigkeit' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['25'])
  })

  it('traegt die Richtung der Tagesbilanz in der Klasse — und die Zahl im Titel (T-M36-02)', () => {
    const { container } = renderHeader(withBalance(-6000))
    const balance = container.querySelector('.resource--food em')

    // Festkomma: −6000 sind −6 je Tag (`rate` rechnet das Tausendstel heraus). Seit
    // T-M36-02 steht diese Zahl im Tooltip und nicht mehr als 21. Angabe in der Leiste.
    expect(balance?.getAttribute('title')).toContain('Bilanz −6')
    expect(balance?.className).toContain('resource__dir--minus')

    cleanup()
    const plus = renderHeader(withBalance(2200)).container.querySelector('.resource--food em')
    expect(plus?.getAttribute('title')).toContain('Bilanz +2')
    expect(plus?.className).toContain('resource__dir--plus')
  })

  it('macht den Kartenmodus zur Knopfgruppe mit genau einem gedrueckten Knopf', () => {
    const onMode = vi.fn()
    renderHeader(view(100, [100], 900), { onMode })
    const group = screen.getByRole('group', { name: 'Kartenmodus' })

    const pressed = within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['Besitz'])

    fireEvent.click(within(group).getByRole('button', { name: 'Moral' }))
    expect(onMode).toHaveBeenCalledWith('morale')
  })

  it('fuellt den Alarmchip mit dem Provinznamen und fuehrt zur Provinz (T-M28-06)', () => {
    let getroffen: number = 0
    const { container } = renderHeader(view(100, [100], 900), {
      alarm: { provinceId: 'USA-MW', provinceName: 'Mittlerer Westen', intruder: 'Russland' },
      onAlarm: () => (getroffen += 1),
    })
    const slot = container.querySelector('.header__alarm') as HTMLElement

    expect(slot.hidden).toBe(false)
    const knopf = within(slot).getByRole('button')
    expect(knopf.textContent).toContain('Mittlerer Westen')
    expect(knopf.getAttribute('aria-label')).toContain('Russland')
    fireEvent.click(knopf)
    expect(getroffen).toBe(1)
  })

  it('haelt einen leeren, verborgenen Platz fuer den Einmarsch-Alarm bereit (T-M28-06)', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const slot = container.querySelector('.header__alarm') as HTMLElement | null

    expect(slot).not.toBeNull()
    expect(slot?.hidden).toBe(true)
    expect(slot?.textContent).toBe('')
  })
})

/**
 * T-M28-10 · Die Tempo-Gruppe zeigt immer genau eine Stufe.
 *
 * Zwei Befunde der Durchsicht vom 2026-09-11. Der Kommentar im Quelltext versprach
 * „genau ein Knopf ist gedrückt" — die Umsetzung verglich aber auf Gleichheit mit einer
 * Raste, und beim Vorspulen trug ein zweiter Knopf derselben Gruppe `aria-pressed`.
 */
describe('T-M28-10 Genau eine gedrueckte Stufe', () => {
  const gedrueckte = (container: HTMLElement) =>
    [...container.querySelectorAll('.speeds [aria-pressed="true"]')]

  it('markiert die groesste Raste, die die laufende Geschwindigkeit nicht ueberschreitet', () => {
    // Höchstgeschwindigkeit 30: der Klick auf 50 ergibt 30, und 30 ist keine Raste.
    const { container } = renderHeader(view(100, [100], 900), { speed: 30 })
    const aktiv = gedrueckte(container)

    expect(aktiv.length).toBe(1)
    expect(aktiv[0]!.textContent).toBe('25')
  })

  it('markiert die Pause, solange die Uhr steht', () => {
    const { container } = renderHeader(view(100, [100], 900), { speed: 0 })
    const aktiv = gedrueckte(container)

    expect(aktiv.length).toBe(1)
    expect(aktiv[0]!.getAttribute('aria-label')).toBe('Pause')
  })

  it('traegt auch waehrend des Vorspulens genau einen gedrueckten Knopf', () => {
    const { container } = renderHeader(view(100, [100], 900), { speed: 0, fastForwarding: true })

    expect(gedrueckte(container).length).toBe(1)
  })
})

/**
 * Die Leiste zeigt Reichweite statt Bilanz (T-M36-02, ROHSTOFFE.md D36.2).
 *
 * Der Befund der Sichtprüfung: einundzwanzig gleich laute Angaben — sieben Zeichen,
 * sieben Bestände, sieben Bilanzen —, und die Zahl, nach der man wirklich handelt
 * („reicht sechs Tage"), war nur beim Überfahren zu sehen. Jetzt trägt die Zelle den
 * Bestand und einen Pfeil; die Bilanzzahl steht im Tooltip neben Produktion und
 * Unterhalt, und die Reichweite wird sichtbar, sobald ein Vorrat drängt.
 */
describe('T-M36-02 Reichweite statt Bilanz', () => {
  const mitFluss = (stock: number, balance: number): PublicView => {
    const base = view(100, [100], 900)
    const ruhig = { stock: 5000, production: 100, consumption: 0, balance: 100 }
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: {
            stock,
            production: Math.max(0, balance),
            consumption: Math.max(0, -balance),
            balance,
          },
          wood: ruhig,
          iron: ruhig,
          coal: ruhig,
          oil: ruhig,
          rare: ruhig,
          money: ruhig,
        },
      },
    } as PublicView
  }

  const zelle = (container: HTMLElement) => container.querySelector('.resource--food') as HTMLElement

  it('zeigt bei schrumpfendem Vorrat die Tage und einen Abwaertspfeil', () => {
    // 5000 Festkomma-Einheiten bei −2000 je Tag: zweieinhalb Tage, unter der Schwelle
    // SHORT_REACH_DAYS — und damit die Auskunft, nach der gehandelt wird.
    const { container } = renderHeader(mitFluss(5000, -2000))
    const food = zelle(container)

    expect(food.querySelector('.resource__reach')?.textContent).toContain('2,5 T')
    expect(food.querySelector('.resource__dir')?.className).toContain('resource__dir--minus')
  })

  it('zeigt bei wachsendem Vorrat nur den Pfeil, keine Tage', () => {
    const { container } = renderHeader(mitFluss(5000, 2000))
    const food = zelle(container)

    expect(food.querySelector('.resource__reach')).toBeNull()
    expect(food.querySelector('.resource__dir')?.className).toContain('resource__dir--plus')
  })

  it('zeigt bei schrumpfendem, aber reichlichem Vorrat keine Tage — nur wer draengt, sagt es', () => {
    // 100 000 bei −2000: fünfzig Tage. Die Schwelle ist die vorhandene
    // SHORT_REACH_DAYS und keine neue Zahl.
    const { container } = renderHeader(mitFluss(100_000, -2000))

    expect(zelle(container).querySelector('.resource__reach')).toBeNull()
    expect(zelle(container).querySelector('.resource__dir--minus')).toBeTruthy()
  })

  it('nennt im Tooltip weiterhin Produktion, Unterhalt UND Bilanz', () => {
    // R-ECON-06 bleibt an der Wirtschaftstabelle hängen; die Leiste ist die kurze
    // Auskunft. Trotzdem darf beim Umbau nichts aus dem Tooltip verschwinden.
    const { container } = renderHeader(mitFluss(5000, -2000))
    const titel = zelle(container).querySelector('.resource__dir')?.getAttribute('title') ?? ''

    expect(titel).toContain('Produktion')
    expect(titel).toContain('Unterhalt')
    expect(titel).toContain('Bilanz')
    expect(titel).toContain('−2')
    expect(titel).toContain('noch 2,5 Tage')
  })

  it('nimmt der Leiste die sieben sichtbaren Bilanzzahlen', () => {
    // Der Kern des Befunds: dieselbe Auskunft stand doppelt auf dem Bildschirm. SICHTBAR
    // sind jetzt sieben Bestände und sieben Pfeile — fürs Ohr bleibt die Bilanz, sonst
    // hätte der Umbau einem Vorleseprogramm etwas weggenommen statt dem Auge.
    const { container } = renderHeader(mitFluss(100_000, 2000))
    const leiste = container.querySelector('.resources') as HTMLElement
    const sichtbar = leiste.cloneNode(true) as HTMLElement
    for (const versteckt of sichtbar.querySelectorAll('.visually-hidden')) versteckt.remove()

    expect(leiste.querySelectorAll('.resource__dir').length).toBe(7)
    expect(sichtbar.textContent).not.toMatch(/[+−]\d/)
    // Und die Gegenprobe, damit der Vergleich nicht ueber dem Nichts steht: fuers Ohr
    // steht die Bilanz weiterhin da.
    expect(leiste.textContent).toContain('Bilanz +2 je Tag')
  })

  it('sagt zu einem stehenden Vorrat weder auf noch ab', () => {
    const { container } = renderHeader(mitFluss(5000, 0))

    expect(zelle(container).querySelector('.resource__dir')?.className).toContain('resource__dir--zero')
    expect(zelle(container).querySelector('.resource__reach')).toBeNull()
  })

  it('laesst die Reichweite auch fuers Ohr lesbar', () => {
    // „2,5 T" ist für das Auge gekürzt; ein Vorleseprogramm bekommt den ganzen Satz.
    const { container } = renderHeader(mitFluss(5000, -2000))

    expect(zelle(container).querySelector('.resource__reach .visually-hidden')?.textContent).toBe(
      'noch 2,5 Tage',
    )
  })
})

/**
 * Nur Knappes ist laut (T-M36-03, ROHSTOFFE.md D36.2 und Risiko 3).
 *
 * Der letzte Teil des Befunds: alles war gleich laut. Der Rohstoff, der in sechs Tagen
 * leer ist, sah aus wie der, der seit Tagen überläuft. Jetzt steht, wer läuft oder
 * steht, in ruhigem Grau mit halber Schriftstärke — und nur, wer drängt, bekommt
 * Bernstein und volle Stärke. An einem ruhigen Tag trägt die Leiste keine Farbe.
 */
describe('T-M36-03 Nur Knappes ist laut', () => {
  const mitVorraeten = (food: { stock: number; balance: number }): PublicView => {
    const base = view(100, [100], 900)
    const ruhig = { stock: 5000, production: 100, consumption: 0, balance: 100 }
    return {
      ...base,
      self: {
        ...base.self,
        economy: {
          food: {
            stock: food.stock,
            production: Math.max(0, food.balance),
            consumption: Math.max(0, -food.balance),
            balance: food.balance,
          },
          wood: ruhig,
          iron: ruhig,
          coal: ruhig,
          oil: ruhig,
          rare: ruhig,
          money: ruhig,
        },
      },
    } as PublicView
  }

  it('zeichnet an einem ruhigen Tag keine einzige Zelle aus', () => {
    const { container } = renderHeader(mitVorraeten({ stock: 5000, balance: 100 }))

    expect(container.querySelectorAll('.resource--short').length).toBe(0)
    expect(container.querySelectorAll('.resource--calm').length).toBe(7)
  })

  it('zeichnet genau die eine Zelle aus, die draengt', () => {
    const { container } = renderHeader(mitVorraeten({ stock: 5000, balance: -2000 }))

    expect(container.querySelectorAll('.resource--short').length).toBe(1)
    expect(container.querySelector('.resource--short')?.className).toContain('resource--food')
    // Und die uebrigen sechs bleiben ruhig — sonst waere „genau eine" auch dann wahr,
    // wenn alle sieben laut waeren und nur eine davon anders heisst.
    expect(container.querySelectorAll('.resource--calm').length).toBe(6)
  })

  it('gibt keiner Zelle beide Toene zugleich', () => {
    const { container } = renderHeader(mitVorraeten({ stock: 5000, balance: -2000 }))

    expect(container.querySelectorAll('.resource--calm.resource--short').length).toBe(0)
  })
})

/**
 * Die Leiste bekommt vier Gruppen (T-M36-04, ROHSTOFFE.md D36.3, Anordnung 2).
 *
 * Versorgung · Baustoffe · Kriegsstoffe · Geld. Die Trennlinien tragen die Bedeutung,
 * die einzelnen Zellen verlieren ihre. **Der Preis steht im Bauplan und ist
 * mitgekauft:** zwei Strichstärken nebeneinander können die Leiste unruhiger machen
 * statt ruhiger — bestätigt sich das im Spiel, ist es ein Befund für den nächsten
 * Playtest und kein Grund, jetzt anders zu bauen.
 *
 * Die Gruppen sind bewusst **keine** zusätzliche Ebene im Vorlesetext: sie sind eine
 * Trennlinie fürs Auge, keine Struktur fürs Ohr. Eine verschachtelte Liste mit vier
 * Untergruppen würde einem Screenreader vier Ebenen vorsprechen, wo es sieben Zahlen
 * zu lesen gibt.
 */
describe('T-M36-04 Vier Gruppen', () => {
  it('teilt genau die sieben Rohstoffe auf vier Gruppen auf', () => {
    expect(RESOURCE_GROUPS.map((gruppe) => gruppe.keys)).toEqual([
      ['food'],
      ['wood', 'iron', 'coal'],
      ['oil', 'rare'],
      ['money'],
    ])
    // Jeder genau einmal, und keiner, den es nicht gibt.
    const flach = RESOURCE_GROUPS.flatMap((gruppe) => gruppe.keys)
    expect([...new Set(flach)].length).toBe(7)
  })

  it('laesst die Reihenfolge der sieben unveraendert', () => {
    // Die Gruppierung ordnet nicht um — wer die Leiste kennt, findet sein Zeichen an
    // derselben Stelle wie gestern.
    expect(RESOURCE_GROUPS.flatMap((gruppe) => gruppe.keys)).toEqual([...RESOURCE_KEYS])
  })

  it('zieht drei Trennlinien: eine je Gruppenende ausser der letzten', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const enden = [...container.querySelectorAll('.resource--groupEnd')]

    expect(enden.length).toBe(3)
    expect(enden.map((li) => [...li.classList].find((c) => c.startsWith('resource--') && c !== 'resource--groupEnd'))).toEqual([
      'resource--food',
      'resource--coal',
      'resource--rare',
    ])
  })

  it('macht aus der Trennung keine zweite Ebene fuers Ohr', () => {
    const { container } = renderHeader(view(100, [100], 900))
    const leiste = container.querySelector('.resources') as HTMLElement

    // Genau eine Liste, genau sieben Einträge, keine Untergruppe.
    expect(container.querySelectorAll('ul').length).toBe(1)
    expect(leiste.querySelectorAll('li').length).toBe(7)
    expect(leiste.querySelectorAll('[role="group"]').length).toBe(0)
  })
})

/**
 * Was die Sichtprüfung zu T-M36-06 gefunden hat — als Kaskaden-Wächter.
 *
 * In `app.css` stand seit dem Kriegsrat eine Regel `.resource span`, die den
 * Rohstoffnamen setzte. Der Name ist `visually-hidden`, die Regel für ihn also
 * folgenlos — gegriffen hat sie auf die Spans, die T-M36-02 dazugestellt hat: den Pfeil
 * und die Reichweite. Beide standen dadurch in Nebentextfarbe statt in Bernstein,
 * obwohl `.resource--short em` und `.resource__reach` es anders sagten: ein Element
 * weiter innen, mit einer Stelle mehr Spezifität. Am laufenden Spiel gemessen, nicht in
 * einem Test gefunden — deshalb steht hier jetzt einer.
 *
 * jsdom rechnet kein Layout, löst aber die Kaskade auf und gibt `var(--…)` unaufgelöst
 * zurück. Genau das reicht: die Frage ist, WELCHE Regel gewinnt.
 */
describe('T-M36-06 Der Ton der knappen Zelle kommt auch wirklich an', () => {
  const mitStylesheet = (pruefen: (container: HTMLElement) => void): void => {
    const style = document.createElement('style')
    style.textContent = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    document.head.appendChild(style)
    try {
      const base = view(100, [100], 900)
      const ruhig = { stock: 5000, production: 100, consumption: 0, balance: 100 }
      const knapp = { stock: 5000, production: 0, consumption: 2000, balance: -2000 }
      const { container } = renderHeader({
        ...base,
        self: {
          ...base.self,
          economy: { food: knapp, wood: ruhig, iron: ruhig, coal: ruhig, oil: ruhig, rare: ruhig, money: ruhig },
        },
      } as PublicView)
      pruefen(container)
    } finally {
      style.remove()
    }
  }

  it('faerbt Pfeil und Reichweite der knappen Zelle in Bernstein', () => {
    mitStylesheet((container) => {
      const reach = container.querySelector('.resource--food .resource__reach') as HTMLElement
      const pfeil = container.querySelector('.resource--food em') as HTMLElement

      expect(window.getComputedStyle(reach).color).toBe('var(--warn)')
      expect(window.getComputedStyle(pfeil).color).toBe('var(--warn)')
    })
  })

  it('laesst die ruhigen Zellen im Nebentext', () => {
    mitStylesheet((container) => {
      const pfeil = container.querySelector('.resource--wood em') as HTMLElement

      expect(window.getComputedStyle(pfeil).color).toBe('var(--ink-soft)')
    })
  })
})
