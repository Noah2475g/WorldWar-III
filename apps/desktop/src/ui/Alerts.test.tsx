// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GameEvent, PublicView } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Alerts,
  NO_NEWS,
  UNREST_MORALE,
  alertsFor,
  collectEspionageNews,
  dismissNews,
  espionageAlerts,
  isDismissible,
  type NewsNaming,
} from './Alerts.tsx'
import { categoryOf } from './Panels.tsx'

/**
 * What needs looking at (T-M13-13, R-UI-14, R-GAME-06).
 *
 * The log says what happened and keeps saying it; at a hundred game hours a second the
 * one line that mattered scrolls past between two blinks. These are conditions rather
 * than events — one entry for as long as the battle lasts, not one per tick — and the
 * log finally gets the filter R-GAME-06 asked for in M5.
 */

afterEach(cleanup)

const view = (options: {
  battles?: string[]
  shortages?: string[]
  provinces?: { id: string; name: string; owner: string; morale?: number }[]
  capital?: string | null
  others?: { id: string; nation: string }[]
  incomingOffers?: { from: string; kind: 'peace' | 'alliance' | 'rightOfWay'; tick: number }[]
  tradeIncoming?: { id: string; from: string; to: string }[]
  tradeOutgoing?: { id: string; to: string }[]
}): PublicView =>
  ({
    tick: 100,
    playerId: 'p1',
    self: {
      nation: 'Nordland',
      shortages: options.shortages ?? [],
      capitalProvinceId: options.capital === undefined ? 'A' : options.capital,
      score: 10,
    },
    others: options.others ?? [],
    relations: {},
    provinces: (options.provinces ?? [{ id: 'A', name: 'Alpha', owner: 'p1' }]).map((province) => ({
      ...province,
      stale: false,
      asOfTick: 0,
    })),
    armies: [],
    battles: (options.battles ?? []).map((provinceId) => ({ provinceId, startedTick: 90 })),
    marketPrices: {},
    victory: { condition: 'points', winner: null },
    // Angebote (T-M17-14, R-DIP-07/AK1): der Fixtur-Standard bleibt leer, damit alle
    // bestehenden Faelle unveraendert bleiben — offerAlerts liest sie ohne `?.` (Falle 7).
    incomingOffers: options.incomingOffers ?? [],
    outgoingOffers: [],
    tradeOffers: {
      incoming: (options.tradeIncoming ?? []).map((offer) => ({
        ...offer,
        give: { resources: { iron: 5000 }, provinces: [] },
        want: { resources: { money: 10000 }, provinces: [] },
        createdTick: 90,
        expiresAtTick: 90 + 72,
      })),
      outgoing: (options.tradeOutgoing ?? []).map((offer) => ({
        ...offer,
        from: 'p1',
        give: { resources: { iron: 5000 }, provinces: [] },
        want: { resources: { money: 10000 }, provinces: [] },
        createdTick: 90,
        expiresAtTick: 90 + 72,
      })),
    },
  }) as unknown as PublicView

describe('R-UI-14 Meldungen entstehen aus der Lage', () => {
  it('meldet einen Kampf im eigenen Gebiet', () => {
    const alerts = alertsFor(view({ battles: ['A'] }))

    expect(alerts.map((alert) => alert.kind)).toEqual(['battle'])
    expect(alerts[0]!.text).toContain('Alpha')
    expect(alerts[0]!.provinceId).toBe('A')
  })

  it('meldet keinen Kampf anderswo', () => {
    const alerts = alertsFor(
      view({
        battles: ['B'],
        provinces: [
          { id: 'A', name: 'Alpha', owner: 'p1' },
          { id: 'B', name: 'Beta', owner: 'p2' },
        ],
      }),
    )

    expect(alerts).toEqual([])
  })

  it('gibt derselben Lage dieselbe Kennung — sonst waere jede Sekunde eine neue Meldung', () => {
    const first = alertsFor(view({ battles: ['A'] }))
    const later = alertsFor(view({ battles: ['A'] }))

    expect(first[0]!.id).toBe(later[0]!.id)
  })

  it('meldet Mangel und Aufstandsgefahr', () => {
    const alerts = alertsFor(
      view({
        shortages: ['iron'],
        provinces: [{ id: 'A', name: 'Alpha', owner: 'p1', morale: UNREST_MORALE - 1000 }],
      }),
    )

    expect(alerts.map((alert) => alert.kind).sort()).toEqual(['shortage', 'unrest'])
  })

  it('meldet keine Unruhe bei zufriedener Provinz', () => {
    const alerts = alertsFor(view({ provinces: [{ id: 'A', name: 'Alpha', owner: 'p1', morale: 70_000 }] }))

    expect(alerts).toEqual([])
  })

  it('meldet die verlorene Hauptstadt', () => {
    const alerts = alertsFor(
      view({ capital: 'A', provinces: [{ id: 'A', name: 'Alpha', owner: 'p2' }] }),
    )

    expect(alerts.map((alert) => alert.kind)).toContain('capital')
  })

  it('fuehrt die Karte zum Ort, wenn man die Meldung anklickt', () => {
    const onJump = vi.fn()
    render(<Alerts alerts={alertsFor(view({ battles: ['A'] }))} onJump={onJump} />)

    fireEvent.click(screen.getByRole('button', { name: /Alpha/ }))

    // Seit T-M17-14 (E3) traegt der Sprung ein Panelziel, nicht mehr nur die Provinz-Id.
    expect(onJump).toHaveBeenCalledWith({ kind: 'province', provinceId: 'A' })
  })

  it('zeigt nichts, wenn nichts anliegt', () => {
    const { container } = render(<Alerts alerts={[]} onJump={() => undefined} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('R-GAME-06 Das Protokoll ist filterbar', () => {
  it('ordnet jedes Ereignis einer Schublade zu', () => {
    expect(categoryOf('BATTLE_STARTED')).toBe('combat')
    expect(categoryOf('PROVINCE_CAPTURED')).toBe('combat')
    expect(categoryOf('BUILD_COMPLETED')).toBe('economy')
    expect(categoryOf('TRADE_EXECUTED')).toBe('economy')
    expect(categoryOf('WAR_DECLARED')).toBe('diplomacy')
    expect(categoryOf('DAY_REPORT')).toBe('other')
  })

  it('ordnet die Abtretung der Diplomatie zu — sie ist ein Vertrag, keine Eroberung (T-M17-06)', () =>
    expect(categoryOf('PROVINCE_CEDED')).toBe('diplomacy'))

  it('ordnet ein geschlossenes oder angenommenes Handelsangebot den Vertraegen zu, den Markttausch der Wirtschaft (T-M17-14, E5)', () => {
    expect(categoryOf('TRADE_OFFER_CLOSED')).toBe('diplomacy')
    expect(categoryOf('TRADE_AGREED')).toBe('diplomacy')
    expect(categoryOf('TRADE_EXECUTED')).toBe('economy')
  })
})

/**
 * Ein eingehendes Angebot meldet sich (T-M17-14, R-DIP-07/AK1, E4).
 */
describe('R-DIP-07/AK1 Ein eingehendes Angebot meldet sich', () => {
  it('meldet ein Handelsangebot mit Namen und Sprung in die Diplomatie', () => {
    const alerts = alertsFor(
      view({ others: [{ id: 'p2', nation: 'Ostmark' }], tradeIncoming: [{ id: 't3', from: 'p2', to: 'p1' }] }),
    )

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      kind: 'offer',
      id: 'offer:trade:t3',
      text: 'Handelsangebot von Ostmark',
      diplomacyWith: 'p2',
    })
    expect(alerts[0]!.provinceId).toBeUndefined()
    expect(alerts[0]!.text).not.toMatch(/\bp\d\b|\bt\d+\b/)
  })

  it('meldet Antrag, Friedens- und Buendnisangebot', () => {
    const naming = { others: [{ id: 'p2', nation: 'Ostmark' }] }
    const first = alertsFor(
      view({ ...naming, incomingOffers: [{ from: 'p2', kind: 'rightOfWay', tick: 90 }] }),
    )
    expect(first.map((alert) => alert.text)).toEqual(['Ostmark bittet um Durchmarsch'])
    expect(first[0]!.id).toBe('offer:rightOfWay:p2')

    const second = alertsFor(view({ ...naming, incomingOffers: [{ from: 'p2', kind: 'peace', tick: 90 }] }))
    expect(second.map((alert) => alert.text)).toEqual(['Ostmark bietet Frieden an'])

    const third = alertsFor(view({ ...naming, incomingOffers: [{ from: 'p2', kind: 'alliance', tick: 90 }] }))
    expect(third.map((alert) => alert.text)).toEqual(['Ostmark bietet ein Bündnis an'])

    // Stabil ueber zwei Aufrufe — dieselbe Lage, dieselbe Kennung.
    const again = alertsFor(view({ ...naming, incomingOffers: [{ from: 'p2', kind: 'rightOfWay', tick: 90 }] }))
    expect(again[0]!.id).toBe(first[0]!.id)
  })

  it('schweigt bei eigenen Angeboten', () => {
    const alerts = alertsFor(view({ others: [{ id: 'p2', nation: 'Ostmark' }], tradeOutgoing: [{ id: 't4', to: 'p2' }] }))

    expect(alerts.filter((alert) => alert.kind === 'offer')).toEqual([])
  })

  it('der Klick fuehrt in die Diplomatie, nicht auf die Karte', () => {
    const spy = vi.fn()
    const sicht = view({ others: [{ id: 'p2', nation: 'Ostmark' }], tradeIncoming: [{ id: 't3', from: 'p2', to: 'p1' }] })
    render(<Alerts alerts={alertsFor(sicht)} onJump={spy} />)

    fireEvent.click(screen.getByRole('button', { name: /Handelsangebot von Ostmark/ }))

    expect(spy).toHaveBeenCalledWith({ kind: 'diplomacy', playerId: 'p2' })
  })

  it('ist leise wie die Ankuendigung (M36): keine Alarm- oder Warnfarbe', () => {
    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    const laut = [...css.matchAll(/([^{}]*)\{[^}]*color:\s*var\(--(accent|warn)\)[^}]*\}/g)].map((match) => match[1]!)
    expect(laut.length, 'keine Alarmregel gefunden - der Waechter misst nichts').toBeGreaterThan(0)
    for (const selektor of laut) expect(selektor).not.toContain('alert--offer')
  })

  it('ist nicht wegklickbar — sie endet mit Antwort oder Verfall', () => {
    const sicht = view({ others: [{ id: 'p2', nation: 'Ostmark' }], tradeIncoming: [{ id: 't3', from: 'p2', to: 'p1' }] })
    const [angebot] = alertsFor(sicht)

    expect(isDismissible(angebot!)).toBe(false)
  })
})

/**
 * Die Freischaltungsmeldung beugt ihr Pronomen (T-M23-02, R-UI-07, Befund V2-11).
 *
 * "Neu ab heute: Kaserne. Sie koennen ES jetzt bauen." — das Pronomen hing nicht am
 * Genus der Sache. Die Genus-Tabelle (de.grammar) speist den Satz: die Kaserne → sie,
 * der Hafen → ihn, das Jagdflugzeug → es.
 */
describe('R-UI-07 Die Freischaltungsmeldung beugt ihr Pronomen', () => {
  // view() steht auf Tick 100: Tagesanfang von Spieltag 5 — die Meldung erscheint.
  const regeln = {
    constants: { ticksPerDay: 24 },
    buildings: { barracks: { availableFromDay: 5 }, harbour: { availableFromDay: 5 } },
    units: { infantry: { availableFromDay: 5 }, tank: { availableFromDay: 5 }, fighter: { availableFromDay: 5 } },
  }

  it('setzt das Pronomen nach dem Genus der Sache', () => {
    const texte = Object.fromEntries(alertsFor(view({}), regeln).map((alert) => [alert.id, alert.text]))

    expect(texte['unlock:building:barracks']).toBe('Neu ab heute: Kaserne. Sie können sie jetzt bauen.')
    expect(texte['unlock:building:harbour']).toBe('Neu ab heute: Hafen. Sie können ihn jetzt bauen.')
    expect(texte['unlock:unit:infantry']).toBe('Neu ab heute: Infanterie. Sie können sie jetzt ausheben.')
    expect(texte['unlock:unit:tank']).toBe('Neu ab heute: Kampfpanzer. Sie können ihn jetzt ausheben.')
    expect(texte['unlock:unit:fighter']).toBe('Neu ab heute: Jagdflugzeug. Sie können es jetzt ausheben.')
  })
})

/**
 * Die nächste Freischaltung kündigt sich an (T-M41-03, R-TECH-02, R-UI-05).
 *
 * Die Eröffnung hatte zwei Pausen von vier Spieltagen ohne Anlass (Tag 6 → 10, Tag 12 →
 * 16). Statt die Freischaltungstage zu schieben, sagt das Spiel zwei Tage vorher, was
 * kommt — und was dafür fehlt, damit aus Warten eine Handlung wird (DECISIONS.md,
 * 2026-09-13). Leise: kein Alarm, kein Sprung auf die Karte.
 */
describe('R-TECH-02 Die naechste Freischaltung kuendigt sich zwei Spieltage vorher an', () => {
  const regeln = {
    constants: { ticksPerDay: 24 },
    buildings: {
      barracks: { availableFromDay: 1 },
      harbour: { availableFromDay: 6, requiresCoastal: true },
      shipyard: { availableFromDay: 20, requiresBuilding: 'harbour', requiresCoastal: true },
    },
    units: {
      infantry: { availableFromDay: 1, requiresBuilding: 'barracks' },
      transport: { availableFromDay: 10, requiresBuilding: 'harbour' },
      destroyer: { availableFromDay: 24, requiresBuilding: 'shipyard', requiresBuildingLevel: 2 },
      fighter: { availableFromDay: 12, requiresBuilding: 'airfield' },
      artillery: { availableFromDay: 14, requiresBuilding: 'barracks' },
    },
  }

  /** Eine Sicht zu Tagesbeginn eines Spieltags, mit einer eigenen Provinz. */
  const sicht = (tag: number, provinz: { buildings?: Record<string, number>; coastal?: boolean } = {}) =>
    ({
      ...view({}),
      tick: (tag - 1) * 24,
      provinces: [{ id: 'A', name: 'Alpha', owner: 'p1', coastal: true, stale: false, asOfTick: 0, ...provinz }],
    }) as unknown as PublicView

  const angekuendigt = (v: PublicView) => alertsFor(v, regeln).filter((alert) => alert.kind === 'upcoming')

  it('erscheint zwei Spieltage vor der Freischaltung und nennt, was fehlt', () => {
    const [ankuendigung, ...rest] = angekuendigt(sicht(8))

    expect(rest).toEqual([])
    expect(ankuendigung?.id).toBe('upcoming:unit:transport')
    expect(ankuendigung?.text).toBe('In zwei Tagen: Transportschiff. Dafür braucht es einen Hafen — Sie haben keinen.')
  })

  it('schweigt von der Voraussetzung, wenn sie steht', () => {
    expect(angekuendigt(sicht(8, { buildings: { harbour: 1 } })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Transportschiff.',
    ])
  })

  it('nennt die fehlende Stufe, und schweigt, sobald sie erreicht ist', () => {
    // Nacharbeit T-M41-03 (Durchsicht M1): mit Werft 1 stand hier "— Sie haben keine" —
    // falsch, der Spieler hat eine, nur eine Stufe zu niedrig. Der Test schrieb den
    // Fehler fest. Jetzt nennt die Ankuendigung die beste vorhandene Stufe.
    expect(angekuendigt(sicht(22, { buildings: { harbour: 1, shipyard: 1 } })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Zerstörer. Dafür braucht es eine Werft der Stufe 2 — Ihre beste steht auf Stufe 1.',
    ])
    // Ohne jede Werft bleibt es beim "keine".
    expect(angekuendigt(sicht(22, { buildings: { harbour: 1 } })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Zerstörer. Dafür braucht es eine Werft der Stufe 2 — Sie haben keine.',
    ])
    expect(angekuendigt(sicht(22, { buildings: { harbour: 1, shipyard: 2 } })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Zerstörer.',
    ])
  })

  it('nennt bei einem Gebaeude die fehlende Kueste', () => {
    expect(angekuendigt(sicht(4, { coastal: false })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Hafen. Dafür braucht es eine Küstenprovinz — Sie haben keine.',
    ])
    expect(angekuendigt(sicht(4)).map((alert) => alert.text)).toEqual(['In zwei Tagen: Hafen.'])
  })

  it('beugt nach dem Genus der Voraussetzung', () => {
    // Der Flugplatz ist maennlich, die Kaserne weiblich: "einen"/"keinen" gegen "eine"/"keine".
    expect(angekuendigt(sicht(10, { buildings: { harbour: 1 } })).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Jagdflugzeug. Dafür braucht es einen Flugplatz — Sie haben keinen.',
    ])
  })

  it('beginnt den zweiten Satz nie mit "Sie", "Er" oder "Es" (Nacharbeit T-M41-03, Durchsicht N6)', () => {
    // "Artillerie. Sie braucht eine Kaserne — Sie haben keine." war richtig gebeugt und
    // trotzdem doppeldeutig: das erste "Sie" meint die Artillerie, das zweite den Spieler.
    // "Dafür braucht es" haengt an keinem Genus; nur Artikel und Verneinung richten sich
    // nach der Voraussetzung.
    expect(angekuendigt(sicht(12)).map((alert) => alert.text)).toEqual([
      'In zwei Tagen: Artillerie. Dafür braucht es eine Kaserne — Sie haben keine.',
    ])
    for (let tag = 1; tag <= 24; tag++) {
      for (const alert of angekuendigt(sicht(tag, { coastal: tag % 2 === 0 }))) {
        expect(alert.text, `Tag ${tag}`).not.toMatch(/\. (Sie|Er|Es) braucht/)
      }
    }
  })

  it('kuendigt nur zwei Tage vorher an, nicht am Vortag und nicht am Tag selbst', () => {
    // An Tag 10 kuendigt sich das Jagdflugzeug (Tag 12) an; gefragt ist nur das Transportschiff.
    const transport = (tag: number) => angekuendigt(sicht(tag)).filter((alert) => alert.id === 'upcoming:unit:transport')
    expect(transport(7)).toEqual([])
    expect(transport(8)).toHaveLength(1)
    expect(transport(9)).toEqual([])
    expect(transport(10)).toEqual([])
    // Und am Tag selbst steht die Freischaltung, keine Ankuendigung.
    expect(alertsFor(sicht(10), regeln).map((alert) => alert.id)).toContain('unlock:unit:transport')
  })

  it('steht den ganzen Spieltag, nicht nur in seinen ersten Stunden (T-M41-12)', () => {
    // Bis T-M41-12 stand die Ankuendigung nur in den ersten 12 Ticks: bei Tempo 100 etwa
    // 0,12 s, und ein Vorspulen aus einer Tagesmitte in die naechste sprang darueber.
    for (const stunde of [0, 11, 12, 20, 23]) {
      const spaet = { ...sicht(8), tick: 7 * 24 + stunde } as PublicView
      expect(angekuendigt(spaet).map((alert) => alert.id), `Tag 8, ${stunde} Uhr`).toEqual(['upcoming:unit:transport'])
    }
    // Am naechsten Tag nicht mehr.
    expect(angekuendigt(sicht(9)).map((alert) => alert.id)).not.toContain('upcoming:unit:transport')
  })

  it('ist leise: keine Alarmfarbe und kein Sprung auf die Karte', () => {
    const [ankuendigung] = angekuendigt(sicht(8))
    expect(ankuendigung?.provinceId).toBeUndefined()

    // Laut ist nur, was knapp oder umkaempft ist (M36). Die Farbregeln fuer Alarm und
    // Warnung duerfen die Ankuendigung nicht nennen.
    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    const laut = [...css.matchAll(/([^{}]*)\{[^}]*color:\s*var\(--(accent|warn)\)[^}]*\}/g)].map((match) => match[1]!)
    expect(laut.length, 'keine Alarmregel gefunden - der Waechter misst nichts').toBeGreaterThan(0)
    for (const selektor of laut) expect(selektor).not.toContain('alert--upcoming')
  })
})

/**
 * Ankuendigung und Freischaltung bleiben sichtbar (T-M41-12, Befund N8 der Durchsicht M41).
 *
 * Beide standen nur in den ersten 12 Ticks eines Spieltags — so lange wie eine
 * Fertigstellung. Bei Tempo 100 sind das etwa 0,12 s, und ein Vorspulen von 14:00 bis 14:00
 * am naechsten Tag sprang ganz darueber. Jetzt stehen sie bis zum Ende ihres Spieltags oder
 * bis der Spieler sie wegklickt; leise wie bisher (M36).
 */
describe('T-M41-12 Ankuendigung und Freischaltung bleiben sichtbar', () => {
  const regeln = {
    constants: { ticksPerDay: 24 },
    buildings: { harbour: { availableFromDay: 6 } },
    units: {},
  }
  const um = (tick: number) => ({ ...view({}), tick }) as PublicView

  it('zeigt die Freischaltung bis zum Ende ihres Spieltags, am naechsten nicht mehr', () => {
    for (const stunde of [0, 11, 12, 23]) {
      expect(alertsFor(um(5 * 24 + stunde), regeln).map((alert) => alert.id), `Tag 6, ${stunde} Uhr`).toContain(
        'unlock:building:harbour',
      )
    }
    expect(alertsFor(um(6 * 24), regeln).map((alert) => alert.id)).not.toContain('unlock:building:harbour')
  })

  it('bietet nur bei Ankuendigung und Freischaltung einen Wegklick an und meldet die Kennung', () => {
    const onDismiss = vi.fn()
    const alerts = [...alertsFor(um(5 * 24 + 14), regeln), ...alertsFor(view({ battles: ['A'] }))]
    expect(alerts.map((alert) => alert.kind).sort()).toEqual(['battle', 'unlock'])

    render(<Alerts alerts={alerts} onJump={() => undefined} onDismiss={onDismiss} />)
    const knoepfe = screen.getAllByRole('button', { name: /^Ausblenden/ })
    expect(knoepfe, 'ein Kampf ist nicht wegzuklicken - er endet von selbst').toHaveLength(1)
    expect(knoepfe[0]!.getAttribute('aria-label')).toBe('Ausblenden: Neu ab heute: Hafen. Sie können ihn jetzt bauen.')

    fireEvent.click(knoepfe[0]!)
    expect(onDismiss).toHaveBeenCalledWith('unlock:building:harbour')
  })

  it('bleibt leise: der Wegklick traegt keine Alarm- oder Warnfarbe (Haltetest, M36)', () => {
    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    const laut = [...css.matchAll(/([^{}]*)\{[^}]*color:\s*var\(--(accent|warn)\)[^}]*\}/g)].map((match) => match[1]!)
    expect(laut.length, 'keine Alarmregel gefunden - der Waechter misst nichts').toBeGreaterThan(0)
    for (const selektor of laut) {
      expect(selektor).not.toContain('alert__dismiss')
      expect(selektor).not.toContain('alert--unlock')
    }
  })
})

/**
 * Spionage meldet sich (R-SPY-06/AK2, T-M17-13, E3/E4).
 *
 * `ereignis` baut nur, was `espionageAlerts` tatsaechlich liest — `audience`/`concerns`
 * stehen dabei, weil `BaseEvent` sie verlangt, auch wenn diese Funktion sie nicht ansieht
 * (die Rollenpruefung ist ihre eigene, ueber `playerId`/`targetPlayerId`, nicht `eventsFor`).
 */
describe('R-SPY-06/AK2 Spionage meldet sich', () => {
  const ereignis = (over: Partial<GameEvent> & Pick<GameEvent, 'type'>): GameEvent =>
    ({
      tick: 0,
      severity: 'info',
      audience: ['p1'],
      concerns: ['p1'],
      ...over,
    }) as GameEvent

  const naming: NewsNaming = {
    province: (id) => ({ A: 'Alpha', B: 'Beta' })[id] ?? id,
    player: (id) => ({ p1: 'Nordland', p2: 'Ostmark', p3: 'Suedreich' })[id] ?? id,
  }

  it('meldet eine erlittene Sabotage mit Sprungziel (AK2)', () => {
    const event = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p1',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
      tick: 48,
    })

    const alerts = espionageAlerts([event], 'p1', naming)

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      id: 'sabotage:A',
      kind: 'sabotage',
      provinceId: 'A',
      icon: 'spyEconomic',
      text: 'Wirtschaftssabotage in Alpha',
      tick: 48,
    })

    const onJump = vi.fn()
    render(<Alerts alerts={alerts} onJump={onJump} />)
    fireEvent.click(screen.getByRole('button', { name: /Wirtschaftssabotage in Alpha/ }))
    expect(onJump).toHaveBeenCalledWith({ kind: 'province', provinceId: 'A' })
  })

  it('nennt keinen Urheber — auch nicht, wenn die Huelle alle Namen kennt (Z8)', () => {
    const events = [
      ereignis({
        type: 'SABOTAGE_SUFFERED',
        playerId: 'p1',
        provinceId: 'A',
        kind: 'economic',
        moraleLoss: 10000,
        destroyed: {},
        delayTicks: 0,
      }),
      ereignis({
        type: 'SABOTAGE_SUFFERED',
        playerId: 'p1',
        provinceId: 'B',
        kind: 'military',
        moraleLoss: 0,
        destroyed: {},
        delayTicks: 12,
      }),
    ]

    const alerts = espionageAlerts(events, 'p1', naming)

    expect(alerts.every((alert) => !alert.text.includes('Ostmark') && !alert.text.includes('Suedreich'))).toBe(true)
    expect(JSON.stringify(alerts)).not.toContain('p2')
    expect(JSON.stringify(alerts)).not.toContain('p3')
    const militaer = alerts.find((alert) => alert.id === 'sabotage:B')!
    expect(militaer.text).toBe('Militärsabotage in Beta')
    expect(militaer.icon).toBe('spyMilitary')
  })

  it('meldet fremde Sabotage nicht', () => {
    const event = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p2',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
    })

    expect(espionageAlerts([event], 'p1', naming)).toEqual([])
  })

  it('ist laut und wegklickbar', () => {
    expect(isDismissible({ id: 'sabotage:A', kind: 'sabotage', icon: 'spyEconomic', text: '' })).toBe(true)

    const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')
    const laut = [...css.matchAll(/([^{}]*)\{[^}]*color:\s*var\(--(accent|warn)\)[^}]*\}/g)].map((match) => match[1]!)
    expect(laut.some((selektor) => selektor.includes('alert--sabotage'))).toBe(true)
    expect(laut.some((selektor) => selektor.includes('alert--espionage'))).toBe(false)
  })

  it('steht vor Freischaltung und Ankuendigung', () => {
    const regeln = { constants: { ticksPerDay: 24 }, buildings: { harbour: { availableFromDay: 6 } }, units: {} }
    const sabotage = espionageAlerts(
      [
        ereignis({
          type: 'SABOTAGE_SUFFERED',
          playerId: 'p1',
          provinceId: 'A',
          kind: 'economic',
          moraleLoss: 10000,
          destroyed: {},
          delayTicks: 0,
          tick: 5 * 24 + 14,
        }),
      ],
      'p1',
      naming,
    )

    const alerts = alertsFor({ ...view({}), tick: 5 * 24 + 14 } as PublicView, regeln, sabotage)

    expect(alerts.map((alert) => alert.kind).indexOf('sabotage')).toBeLessThan(alerts.map((alert) => alert.kind).indexOf('unlock'))
  })

  it('zeigt ohne Nachrichten dasselbe wie bisher', () => {
    const v = view({ battles: ['A'] })
    expect(alertsFor(v)).toEqual(alertsFor(v, undefined, []))
  })

  it('meldet dem Entdecker die Enttarnung mit der Macht', () => {
    const event = ereignis({ type: 'SPY_DETECTED', playerId: 'p2', targetPlayerId: 'p1', provinceId: 'A', mission: 'intel' })

    const alerts = espionageAlerts([event], 'p1', naming)

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      kind: 'espionage',
      text: 'Gegenspionage in Alpha: ein Spion von Ostmark enttarnt',
      icon: 'spyCounter',
      provinceId: 'A',
    })
  })

  it('verschluckt keine zweite Macht — zwei Enttarnungen in derselben Provinz im selben Tick bleiben beide (Befund Nacharbeit, niedrig)', () => {
    const vonP2 = ereignis({ type: 'SPY_DETECTED', playerId: 'p2', targetPlayerId: 'p1', provinceId: 'A', mission: 'intel', tick: 48 })
    const vonP3 = ereignis({ type: 'SPY_DETECTED', playerId: 'p3', targetPlayerId: 'p1', provinceId: 'A', mission: 'counter', tick: 48 })

    const alerts = espionageAlerts([vonP2, vonP3], 'p1', naming)

    expect(alerts).toHaveLength(2)
    const news = collectEspionageNews(NO_NEWS, [vonP2, vonP3], 48, 'p1', naming)
    // `collectEspionageNews` (App.tsx) ersetzt bei gleicher id die aeltere Meldung durch die
    // juengere — bei derselben id fuer beide Maechte wuerde eine der beiden verschwinden.
    expect(news.alerts.size).toBe(2)
  })

  it('meldet dem Urheber den Verlust seines Spions', () => {
    const event = ereignis({ type: 'SPY_DETECTED', playerId: 'p2', targetPlayerId: 'p1', provinceId: 'A', mission: 'intel' })

    const alerts = espionageAlerts([event], 'p2', naming)

    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      kind: 'espionage',
      text: 'Ihr Spion in Alpha ist enttarnt (Aufklärung)',
      icon: 'spyIntel',
    })
  })

  it('meldet unbezahlten Sold und ein unpassendes Ziel, nicht aber Erfolg und Misserfolg (E4)', () => {
    const lost = ereignis({ type: 'SPY_LOST', playerId: 'p1', spyId: 's1', provinceId: 'A', mission: 'intel', reason: 'unpaid' })
    const changed = ereignis({
      type: 'SPY_REPORT',
      playerId: 'p1',
      spyId: 's1',
      provinceId: 'A',
      mission: 'intel',
      outcome: 'targetChanged',
    })
    const success = ereignis({ type: 'SPY_REPORT', playerId: 'p1', spyId: 's1', provinceId: 'A', mission: 'intel', outcome: 'success' })
    const failure = ereignis({ type: 'SPY_REPORT', playerId: 'p1', spyId: 's1', provinceId: 'A', mission: 'intel', outcome: 'failure' })

    expect(espionageAlerts([lost], 'p1', naming)).toHaveLength(1)
    expect(espionageAlerts([changed], 'p1', naming)).toHaveLength(1)
    expect(espionageAlerts([success], 'p1', naming)).toEqual([])
    expect(espionageAlerts([failure], 'p1', naming)).toEqual([])
  })

  it('sammelt neue Meldungen und nimmt jede nur einmal auf (E3)', () => {
    const e48 = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p1',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
      tick: 48,
    })

    const a = collectEspionageNews(NO_NEWS, [e48], 50, 'p1', naming)
    expect(a.alerts.size).toBe(1)
    expect(a.upTo).toBe(48)

    const b = collectEspionageNews(a, [e48], 51, 'p1', naming)
    expect(b).toBe(a)
  })

  it('behaelt eine Meldung, wenn ihr Ereignis aus dem Ring faellt, und vergisst eine weggeklickte', () => {
    const e48 = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p1',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
      tick: 48,
    })
    const a = collectEspionageNews(NO_NEWS, [e48], 50, 'p1', naming)

    const c = collectEspionageNews(a, [], 900, 'p1', naming)
    expect(c.alerts.has('sabotage:A')).toBe(true)

    const d = dismissNews(c, 'sabotage:A')
    expect(d.alerts.has('sabotage:A')).toBe(false)

    const e = collectEspionageNews(d, [e48], 901, 'p1', naming)
    expect(e.alerts.has('sabotage:A')).toBe(false)
  })

  it('beginnt nach einem frueheren Stand und bei neuem Betrachter von vorn', () => {
    const e48 = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p1',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
      tick: 48,
    })
    const a = collectEspionageNews(NO_NEWS, [e48], 50, 'p1', naming)

    const frueherStand = collectEspionageNews(a, [], 10, 'p1', naming)
    expect(frueherStand.alerts.size).toBe(0)
    expect(frueherStand.upTo).toBe(-1)

    const neuerBetrachter = collectEspionageNews(a, [], 10, 'p2', naming)
    expect(neuerBetrachter.alerts.size).toBe(0)

    // Eine juengere Sabotage derselben Provinz ersetzt die aeltere: Anzahl bleibt 1, der Tick steigt.
    const juenger = ereignis({
      type: 'SABOTAGE_SUFFERED',
      playerId: 'p1',
      provinceId: 'A',
      kind: 'economic',
      moraleLoss: 10000,
      destroyed: {},
      delayTicks: 0,
      tick: 72,
    })
    const ersetzt = collectEspionageNews(NO_NEWS, [e48, juenger], 80, 'p1', naming)
    expect(ersetzt.alerts.size).toBe(1)
    expect(ersetzt.alerts.get('sabotage:A')!.tick).toBe(72)
  })
})
