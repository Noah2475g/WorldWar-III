import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createInitialState,
  EVENT_TYPES,
  eventsFor,
  runTicks,
  type Command,
  type EventType,
  type GameConfig,
  type GameEvent,
  type MapData,
  type PublicView,
  type Rules,
} from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { t } from '../i18n/text.ts'
import {
  adjutantMarchEntries,
  battleReport,
  dayExpenses,
  dayReportBody,
  dayReportDeltas,
  describeEvent,
  openIntrusion,
  priceSeries,
  provinceOf,
} from './events.ts'

/**
 * The event log in words (T-M10-06, R-UI-07).
 *
 * The failure this guards against is the one that always ships: a log line reading
 * "PROVINCE_CAPTURED p2 DEU-NW". Every event carries ids, every log line has to carry
 * names, and a line about a place has to be able to take the player there.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const map = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const provinceId = map.provinces[0]!.id
const provinceName = map.provinces[0]!.name

const event = (over: Record<string, unknown>): GameEvent =>
  ({ tick: 120, severity: 'info', audience: [], ...over }) as unknown as GameEvent

describe('R-UI-07 Ereignisse werden zu Saetzen', () => {
  it('setzt den Provinznamen statt der Kennung ein', () => {
    const entry = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 0, map)

    expect(entry.text).toContain(provinceName)
    expect(entry.text).not.toContain(provinceId)
  })

  it('haengt die Provinz an, damit die Zeile anspringbar ist', () => {
    const entry = describeEvent(event({ type: 'PROVINCE_CAPTURED', provinceId, playerId: 'p2' }), 0, map)

    expect(entry.provinceId).toBe(provinceId)
  })

  it('laesst eine Zeile ohne Ort ohne Sprungziel', () => {
    const entry = describeEvent(event({ type: 'GAME_STARTED' }), 0, map)

    expect(entry.provinceId).toBeUndefined()
    expect(entry.text.length).toBeGreaterThan(5)
  })

  it('uebersetzt Ressourcennamen mit', () => {
    const entry = describeEvent(event({ type: 'RESOURCE_SHORTAGE', resource: 'oil' }), 0, map)

    expect(entry.text).toContain('Öl')
    expect(entry.text).not.toContain('oil')
  })

  it('reicht die Dringlichkeit durch', () => {
    const alert = describeEvent(event({ type: 'WAR_DECLARED', severity: 'alert' }), 0, map)
    const plain = describeEvent(event({ type: 'DAY_REPORT', day: 3 }), 0, map)

    expect(alert.severity).toBe('alert')
    expect(plain.severity).toBe('info')
  })

  it('vergibt eindeutige Kennungen fuer die Liste', () => {
    const a = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 0, map)
    const b = describeEvent(event({ type: 'BATTLE_STARTED', provinceId }), 1, map)

    expect(a.id).not.toBe(b.id)
  })

  it('findet die Provinz auch in einem anderen Feld', () => {
    expect(provinceOf(event({ type: 'ARMY_ARRIVED', targetProvinceId: 'DEU-NW' }))).toBe('DEU-NW')
    expect(provinceOf(event({ type: 'GAME_STARTED' }))).toBeUndefined()
  })

  it('laesst keinen unuebersetzten Schluessel durch', () => {
    // If an event type ever loses its text, the log must not print "[events.X]".
    const entry = describeEvent(event({ type: 'BUILD_COMPLETED', provinceId, building: 'Kaserne' }), 0, map)

    expect(entry.text.startsWith('[')).toBe(false)
  })
})

describe('R-UI-07 Keine Kennung erreicht das Protokoll', () => {
  // Found in the first smoke test: "Bau von barracks begonnen", "Befehl abgelehnt:
  // {{reason}}", and a march that named its origin as its destination.
  const nations: Record<string, string> = { p1: 'Deutschland', p2: 'Russland' }
  const naming = {
    player: (id: string) => nations[id] ?? id,
    army: (id: string) => `Armee ${id.slice(1)}`,
    ticksPerDay: 24,
  }

  it('uebersetzt Gebaeude und Einheiten', () => {
    const built = describeEvent(event({ type: 'BUILD_STARTED', provinceId, building: 'barracks' }), 0, map)
    expect(built.text).toContain('Kaserne')
    expect(built.text).not.toContain('barracks')

    const recruited = describeEvent(
      event({ type: 'UNIT_RECRUITED', provinceId, unitKey: 'infantry', count: 3, armyId: 'a1' }),
      0,
      map,
    )
    expect(recruited.text).toContain('3 Infanterie')
    expect(recruited.text).not.toContain('infantry')
  })

  it('nennt bei einer Ablehnung den Grund in Worten', () => {
    const entry = describeEvent(
      event({ type: 'COMMAND_REJECTED', playerId: 'p1', command: 'BUILD', code: 'QUEUE_FULL' }),
      0,
      map,
    )

    expect(entry.text).not.toContain('{{')
    expect(entry.text).toContain('Bauplätze')
  })

  it('nennt Spieler bei ihrer Nation', () => {
    const captured = describeEvent(
      event({ type: 'PROVINCE_CAPTURED', provinceId, previousOwner: 'p1', newOwner: 'p2' }),
      0,
      map,
      naming,
    )
    expect(captured.text).toContain('Russland')
    expect(captured.text).not.toMatch(/\bp\d\b/)

    const war = describeEvent(
      event({
        type: 'WAR_DECLARED',
        playerId: 'p2',
        targetPlayerId: 'p1',
        effectiveAtTick: 48,
        withoutDeclaration: false,
      }),
      0,
      map,
      naming,
    )
    expect(war.text).toContain('Russland erklärt Deutschland')
    expect(war.text).toContain('Tag 3')
  })

  it('nennt eine Armee bei ihrem Namen und ein Gefecht bei seinem Sieger', () => {
    const arrived = describeEvent(
      event({ type: 'ARMY_ARRIVED', playerId: 'p1', armyId: 'a7', provinceId }),
      0,
      map,
      naming,
    )
    expect(arrived.text).toContain('Armee 7')

    const resolved = describeEvent(
      event({ type: 'BATTLE_RESOLVED', battleId: 'b1', provinceId, losses: {}, victor: null }),
      0,
      map,
      naming,
    )
    expect(resolved.text).toContain('niemand')
    expect(resolved.text).not.toContain('{{')
  })

  it('springt beim Marsch zum Ziel, nicht zum Start', () => {
    const from = map.provinces[0]!
    const to = map.provinces[1]!
    const entry = describeEvent(
      event({
        type: 'ARMY_DEPARTED',
        playerId: 'p1',
        armyId: 'a1',
        fromProvinceId: from.id,
        toProvinceId: to.id,
        arrivalTick: 130,
      }),
      0,
      map,
      naming,
    )

    expect(entry.provinceId).toBe(to.id)
    expect(entry.text).toContain(`nach ${to.name}`)
  })

  it('beschreibt einen Handel mit beiden Seiten', () => {
    const entry = describeEvent(
      event({
        type: 'TRADE_EXECUTED',
        playerId: 'p1',
        give: 'wood',
        giveAmount: 400000,
        want: 'iron',
        wantAmount: 250000,
      }),
      0,
      map,
    )

    expect(entry.text).toBe('400 Material gegen 250 Eisen getauscht.')
  })
})

describe('R-BAT-07 Der Kampfbericht nennt die Verluste beider Seiten', () => {
  const naming = { player: (id: string) => (id === 'p1' ? 'Deutschland' : 'Frankreich') }

  it('nennt beide Seiten mit ihren Verlusten', () => {
    // Befund 9: Der Kern erzeugt BATTLE_RESOLVED mit `losses: Record<PlayerId, Fixed>`
    // seit M4. Die Anwendung uebernahm in die Textwerte nur flache Zahlen und
    // Zeichenketten — `losses` ist ein Objekt und fiel still heraus. Der Spieler erfuhr
    // nach einem Gefecht nur, wer das Feld behauptet, nicht was es gekostet hat, und
    // R-BAT-07 ('Kampfbericht mit Verlusten beider Seiten, nachlesbar') war damit im
    // Kern erfuellt und in der Oberflaeche gar nicht gebaut.
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: { p1: 3000, p2: 12_000 } }),
      0,
      map,
      naming,
    )

    expect(entry.text).toContain('Deutschland')
    expect(entry.text).toContain('Frankreich')
    expect(entry.text).toMatch(/Verluste/)
  })

  it('sagt es, wenn niemand etwas verloren hat', () => {
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: {} }),
      0,
      map,
      naming,
    )
    expect(entry.text).toMatch(/keine/)
  })

  it('laesst keine Kennung durch', () => {
    const entry = describeEvent(
      event({ type: 'BATTLE_RESOLVED', provinceId, victor: 'p1', losses: { p1: 100, p2: 200 } }),
      0,
      map,
      naming,
    )
    expect(entry.text).not.toMatch(/\bp1\b|\bp2\b/)
  })
})

/**
 * Aus fremder Sicht (T-M15-09, R-DIP-04).
 *
 * Der Sicherheitsgurt für den Kampfbericht aus T-M14-13: sobald Verluste in die Zeile
 * kommen, kommen sie **nur für die Beteiligten** hinein. Und drei Sätze tragen ein
 * stillschweigendes „ich" — „Verhältnis zu X", „Die Hauptstadt ist verloren" —, das im
 * Weltgeschehen schlicht falsch wäre.
 */
/**
 * Was mich betrifft, sieht anders aus (T-M22-03, R-TIME-06, R-UI-05, Befund V2-07).
 *
 * Der Fall der eigenen Großstadt hatte dieselbe optische Stimme wie „Vietnam ist
 * gefallen" am anderen Ende der Welt. Einträge, die den Spieler selbst treffen —
 * eigener Provinzverlust, eigene Hauptstadt, Aufstand im eigenen Land, eigenes
 * Ausscheiden — tragen deshalb `self: true` und damit die Klasse `log__row--self`
 * (Zinnober-Balken, fett).
 *
 * Geprüft wird die Zuordnung für **jede** Ereignisart des Kerns, nicht für ein
 * Beispiel: eine neue Art fällt sonst still in die falsche Schublade.
 */
describe('R-TIME-06 Eigene Rueckschlaege tragen die eigene Klasse', () => {
  const viewer = 'p1'

  /** Je Art ein Ereignis, in dem p1 der Betroffene ist, wo die Art einen kennt. */
  const asVictim: Record<EventType, Record<string, unknown>> = {
    GAME_STARTED: { mapId: 'world', playerCount: 2 },
    COMMAND_REJECTED: { playerId: 'p1', command: 'BUILD', code: 'QUEUE_FULL' },
    BUILD_STARTED: { playerId: 'p1', provinceId, building: 'barracks', level: 1, completesAtTick: 10 },
    BUILD_COMPLETED: { playerId: 'p1', provinceId, building: 'barracks', level: 1 },
    BUILD_CANCELLED: { playerId: 'p1', provinceId, building: 'barracks', reason: 'byPlayer' },
    UNIT_RECRUITED: { playerId: 'p1', provinceId, unitKey: 'infantry', count: 1, armyId: 'a1' },
    ARMY_DEPARTED: { playerId: 'p1', armyId: 'a1', fromProvinceId: provinceId, toProvinceId: provinceId, arrivalTick: 5 },
    ARMY_ARRIVED: { playerId: 'p1', armyId: 'a1', provinceId },
    ARMY_INTRUDED: { playerId: 'p1', intruderId: 'p2', armyId: 'a2', provinceId },
    ARMY_DESTROYED: { playerId: 'p1', armyId: 'a1', provinceId },
    ARMY_RETREATED: { playerId: 'p1', armyId: 'a1', fromProvinceId: provinceId, toProvinceId: provinceId, hpLost: 100 },
    BATTLE_STARTED: { battleId: 'b1', provinceId, sides: [['p1'], ['p2']] },
    BATTLE_RESOLVED: { battleId: 'b1', provinceId, losses: {}, victor: 'p2' },
    BOMBARDMENT: { playerId: 'p2', armyId: 'a2', targetProvinceId: provinceId, damage: 100, automatic: false },
    PROVINCE_CAPTURED: { provinceId, previousOwner: 'p1', newOwner: 'p2' },
    PROVINCE_REVOLTED: { provinceId, previousOwner: 'p1', morale: 10_000 },
    RESOURCE_SHORTAGE: { playerId: 'p1', resource: 'oil' },
    STORAGE_OVERFLOW: { playerId: 'p1', resource: 'wood', wasted: 100 },
    TRADE_EXECUTED: { playerId: 'p1', give: 'wood', giveAmount: 1000, want: 'iron', wantAmount: 500 },
    WAR_DECLARED: { playerId: 'p2', targetPlayerId: 'p1', effectiveAtTick: 48, withoutDeclaration: false },
    DIPLOMACY_CHANGED: { playerId: 'p2', targetPlayerId: 'p1', newState: 'war' },
    CAPITAL_LOST: { playerId: 'p1', provinceId, penaltyUntilTick: 500 },
    CAPITAL_MOVED: { playerId: 'p1', provinceId },
    PLAYER_ELIMINATED: { playerId: 'p1' },
    GAME_ENDED: { winner: 'p2', condition: 'points' },
    DAY_REPORT: { day: 3, scores: {} },
    // Ein erreichtes Zwischenziel ist Rueckmeldung, kein Rueckschlag (T-M35-04).
    GOAL_REACHED: { playerId: 'p1', goal: 'pointShareFirst', day: 221, audience: ['p1'], concerns: ['p1'] },
    // Spionage (T-M17-08): ein Bericht und ein Verlust mangels Sold sind Rueckmeldung ueber einen
    // eigenen Auftrag, kein Rueckschlag im Sinn von D24.1.
    SPY_REPORT: { playerId: 'p1', spyId: 's1', provinceId, mission: 'intel', outcome: 'failure', audience: ['p1'], concerns: ['p1'] },
    SPY_LOST: { playerId: 'p1', spyId: 's1', provinceId, mission: 'intel', reason: 'unpaid', audience: ['p1'], concerns: ['p1'] },
    // Sabotage und Enttarnung (T-M17-09): kein Rueckschlag im Sinn von D24.1 — DECISIONS.md
    // "SABOTAGE_SUFFERED ist kein Rueckschlag" (Nacharbeit kern, 2026-09-25).
    SABOTAGE_SUFFERED: { playerId: 'p1', provinceId, kind: 'economic', moraleLoss: 10_000, destroyed: { money: 5_000 }, delayTicks: 0, audience: ['p1'], concerns: ['p1'] },
    SPY_DETECTED: { playerId: 'p2', targetPlayerId: 'p1', provinceId, mission: 'intel', audience: ['p1', 'p2'], concerns: ['p1', 'p2'] },
  }

  /** Die vier Rueckschlaege aus dem Entwurf (D24.1) — alles andere bleibt ohne Klasse. */
  const SELF: ReadonlySet<EventType> = new Set([
    'PROVINCE_CAPTURED',
    'PROVINCE_REVOLTED',
    'CAPITAL_LOST',
    'PLAYER_ELIMINATED',
    // Der fuenfte seit T-M28-06: fremde Truppen auf eigenem Boden.
    'ARMY_INTRUDED',
  ])

  const beschreibe = (type: EventType, over: Record<string, unknown>) =>
    describeEvent(event({ type, concerns: [], ...over }), 0, map, { viewer })

  it('ordnet JEDE Ereignisart zu — nicht nur ein Beispiel', () => {
    for (const type of EVENT_TYPES) {
      const entry = beschreibe(type, asVictim[type])
      expect(entry.self ?? false, `${type} als Betroffener`).toBe(SELF.has(type))
    }
  })

  it('laesst fremdes Unglueck ohne die Klasse — der Kern des Befunds V2-07', () => {
    // Dieselben vier Arten, nur ist der Betroffene ein anderer: "Vietnam ist gefallen"
    // darf nicht dieselbe Stimme haben wie der Fall der eigenen Grossstadt.
    const fremd: [EventType, Record<string, unknown>][] = [
      ['PROVINCE_CAPTURED', { provinceId, previousOwner: 'p3', newOwner: 'p2' }],
      ['PROVINCE_REVOLTED', { provinceId, previousOwner: 'p3', morale: 10_000 }],
      ['CAPITAL_LOST', { playerId: 'p3', provinceId, penaltyUntilTick: 500 }],
      ['PLAYER_ELIMINATED', { playerId: 'p3' }],
    ]
    for (const [type, over] of fremd) {
      expect(beschreibe(type, over).self ?? false, `${type} als Zuschauer`).toBe(false)
    }
  })

  it('bleibt ohne Betrachter ohne Klasse — niemand ist "selbst"', () => {
    const entry = describeEvent(
      event({ type: 'PROVINCE_CAPTURED', concerns: [], provinceId, previousOwner: 'p1', newOwner: 'p2' }),
      0,
      map,
    )
    expect(entry.self ?? false).toBe(false)
  })

  it('eine eroberte Provinz ist MEIN Rueckschlag nur als Verlierer, nicht als Eroberer', () => {
    const erobert = beschreibe('PROVINCE_CAPTURED', { provinceId, previousOwner: 'p2', newOwner: 'p1' })
    expect(erobert.self ?? false).toBe(false)
  })
})

/**
 * Der Machtname bestimmt die Beugung des Satzes (T-M23-02, R-UI-07, Befund V2-11).
 *
 * "Vereinigte Staaten erklaert Mexiko den Krieg" — der Name ist grammatisch Mehrzahl,
 * das Verb stand in der Einzahl. Die Numerus-Tabelle (de.grammar.pluralNations) speist
 * die Wahl; jede Ereignisart, die eine Macht als Satzgegenstand hat, bekommt ueber die
 * Endung `_PLURAL` eine Mehrzahlfassung.
 */
describe('R-UI-07 Der Machtname bestimmt den Numerus des Satzes', () => {
  const namen = {
    player: (id: string) => (id === 'p2' ? 'Vereinigte Staaten' : 'Mexiko'),
    ticksPerDay: 24,
  }
  const krieg = (playerId: string, targetPlayerId: string) =>
    describeEvent(
      event({ type: 'WAR_DECLARED', playerId, targetPlayerId, effectiveAtTick: 48, withoutDeclaration: false }),
      0,
      map,
      namen,
    ).text

  it('beugt die Kriegserklaerung einer Mehrzahl-Macht in die Mehrzahl', () => {
    expect(krieg('p2', 'p1')).toContain('Vereinigte Staaten erklären Mexiko den Krieg')
  })

  it('laesst die Einzahl-Macht in der Einzahl', () => {
    expect(krieg('p1', 'p2')).toContain('Mexiko erklärt Vereinigte Staaten den Krieg')
  })

  it('beugt auch die Fassung aus fremder Sicht', () => {
    const fremd = describeEvent(
      event({
        type: 'WAR_DECLARED',
        concerns: ['p2', 'p3'],
        playerId: 'p2',
        targetPlayerId: 'p3',
        effectiveAtTick: 96,
        withoutDeclaration: false,
      }),
      0,
      map,
      { ...namen, viewer: 'p1' },
    ).text
    expect(fremd).toContain('Vereinigte Staaten erklären')
  })

  it('beugt Ausscheiden und Sieg derselben Macht mit', () => {
    const raus = describeEvent(event({ type: 'PLAYER_ELIMINATED', playerId: 'p2' }), 0, map, namen).text
    const sieg = describeEvent(event({ type: 'GAME_ENDED', winner: 'p2', condition: 'points' }), 0, map, namen).text

    expect(raus).toContain('Vereinigte Staaten sind ausgeschieden')
    expect(sieg).toContain('Vereinigte Staaten haben gewonnen')
  })
})

/**
 * Der Tagesbericht bekommt einen Koerper (T-M24-01, R-TIME-06, R-UI-05, Befund V2-06).
 *
 * "Tagesbericht fuer Tag 8." war eine Ueberschrift ohne Koerper — der wichtigste
 * wiederkehrende Eintrag sagte nichts. Der Koerper kommt NICHT aus einem neuen
 * Kern-Ereignis: die Huelle liest am Tageswechsel den Zustand (D24.4) und formt daraus
 * die vier Absaetze — Bilanz je Rohstoff (nur die von null verschiedenen), Moral je
 * eigener Provinz mit Richtung, fertige und laufende Auftraege, "morgen neu: X" aus der
 * Freischaltungsachse.
 *
 * Der Test bindet den Koerper an einen Tag mit bekannten Zahlen; gegen den heutigen
 * leeren Eintrag faellt er schon beim Import.
 */
describe('R-TIME-06 Der Tagesbericht traegt einen Koerper', () => {
  /** Eine Sicht mit bekannten Zahlen: Tick 24 = Morgen des zweiten Spieltags. */
  const sicht = (): PublicView =>
    ({
      tick: 24,
      playerId: 'p1',
      self: {
        economy: {
          food: { stock: 500_000, production: 220_000, consumption: 100_000, balance: 120_000, committed: 0 },
          wood: { stock: 100_000, production: 50_000, consumption: 50_000, balance: 0, committed: 0 },
          iron: { stock: 80_000, production: 0, consumption: 40_000, balance: -40_000, committed: 0 },
        },
      },
      provinces: [
        {
          id: 'A',
          name: 'Alpha',
          owner: 'p1',
          morale: 62_000,
          moraleTarget: 80_000,
          buildQueue: [{ id: 'b1', building: 'fortress', startedTick: 20, completesAtTick: 68 }],
          recruitQueue: [],
        },
        {
          id: 'B',
          name: 'Beta',
          owner: 'p1',
          morale: 70_000,
          moraleTarget: 55_000,
          buildQueue: [],
          recruitQueue: [],
        },
        { id: 'C', name: 'Gamma', owner: 'p2' },
      ],
    }) as unknown as PublicView

  const regeln = (): Rules =>
    ({
      constants: { ticksPerDay: 24 },
      buildings: { barracks: { availableFromDay: 1 }, fortress: { availableFromDay: 3 } },
      units: { infantry: { availableFromDay: 1 }, transport: { availableFromDay: 3 } },
    }) as unknown as Rules

  const tagesereignisse = (): GameEvent[] => [
    event({ type: 'BUILD_COMPLETED', tick: 20, provinceId: 'A', building: 'barracks' }),
    event({ type: 'UNIT_RECRUITED', tick: 22, provinceId: 'B', unitKey: 'infantry', count: 3, armyId: 'a1' }),
  ]

  /**
   * Die Bilanz wird ein Bild (T-M25-04, R-UI-05, D25.2): die Rohstoffzeilen des
   * Berichts tragen dieselben Delta-Balken wie die Wirtschaftstabelle — deshalb
   * liefert `dayReportDeltas` sie als Daten (Beschriftung + Festkomma-Bilanz), und die
   * Textfassung des Körpers nennt sie nicht mehr doppelt.
   */
  it('liefert die Bilanz je Rohstoff als Delta-Datensatz — nur die von null verschiedenen', () => {
    const deltas = dayReportDeltas(sicht())

    expect(deltas).toEqual([
      { label: 'Nahrung', balance: 120_000 },
      { label: 'Eisen', balance: -40_000 },
    ])
  })

  it('nennt die Bilanz nicht mehr als Textzeile — die Balken uebernehmen', () => {
    const text = dayReportBody(sicht(), regeln(), tagesereignisse()).join('\n')

    expect(text).not.toContain('Nahrung +120')
    expect(text).not.toContain('Bilanz je Tag:')
  })

  it('schweigt NICHT als ruhiger Tag, solange die Bilanz etwas zu zeigen hat', () => {
    // Nur Wirtschaft, sonst nichts: die Textfassung ist leer, aber die Balken sprechen —
    // der eine ehrliche Satz gehoert dem Tag, an dem wirklich nichts ist.
    const nurBilanz = {
      tick: 24,
      playerId: 'p1',
      self: { economy: sicht().self.economy },
      provinces: [],
    } as unknown as PublicView
    // Regeln ohne Freischaltungen an Tag 3 — sonst spraeche „Morgen neu" mit.
    const ohneNeues = { constants: { ticksPerDay: 24 }, buildings: {}, units: {} } as unknown as Rules

    expect(dayReportBody(nurBilanz, ohneNeues, [])).toEqual([])
  })

  it('nennt die Moral jeder eigenen Provinz mit Richtung', () => {
    const text = dayReportBody(sicht(), regeln(), tagesereignisse()).join('\n')

    // Alpha strebt nach oben (Ziel 80 ueber 62), Beta nach unten (Ziel 55 unter 70).
    expect(text).toContain('Alpha 62 % ↗')
    expect(text).toContain('Beta 70 % ↘')
    // Die fremde Provinz gehoert nicht in meinen Bericht.
    expect(text).not.toContain('Gamma')
  })

  it('nennt fertige und laufende Auftraege', () => {
    const text = dayReportBody(sicht(), regeln(), tagesereignisse()).join('\n')

    expect(text).toContain('Kaserne')
    expect(text).toMatch(/3\s*×\s*Infanterie/)
    // Die Festung ist noch im Bau und nennt ihren Fertigtag (Tick 68 → Tag 3).
    expect(text).toMatch(/Festung.*Tag 3/)
  })

  it('sagt, was morgen neu ist — aus der Freischaltungsachse', () => {
    const text = dayReportBody(sicht(), regeln(), tagesereignisse()).join('\n')

    // Tick 24 = Spieltag 2; morgen ist Tag 3: Festung und Transportschiff.
    expect(text).toMatch(/Morgen neu:.*Festung/)
    expect(text).toMatch(/Morgen neu:.*Transportschiff/)
    // Was laengst da ist, ist nicht neu.
    expect(text).not.toMatch(/Morgen neu:.*Kaserne/)
  })

  it('laesst keinen Platzhalter und keine Kennung durch', () => {
    const zeilen = dayReportBody(sicht(), regeln(), tagesereignisse())
    for (const zeile of zeilen) {
      expect(zeile).not.toContain('{{')
      expect(zeile).not.toMatch(/\bp\d\b|\[|fortress|infantry|barracks/)
    }
  })

  it('sagt an einem leeren Tag EINEN ehrlichen Satz statt gar nichts', () => {
    const leer = { tick: 24, playerId: 'p1', self: {}, provinces: [] } as unknown as PublicView
    const zeilen = dayReportBody(leer, regeln(), [])

    expect(zeilen).toHaveLength(1)
    expect(zeilen[0]!.length).toBeGreaterThan(10)
    expect(zeilen[0]).not.toContain('[')
  })
})

describe('R-DIP-04 Was zwischen Fremden geschieht, erfaehrt man dem Wesen nach', () => {
  const namen = { player: (id: string) => ({ p1: 'Nordland', p2: 'Ostmark', p3: 'Süden' })[id] ?? id, ticksPerDay: 24, viewer: 'p1' }

  const zeile = (event: Partial<GameEvent> & { type: GameEvent['type'] }) =>
    describeEvent({ tick: 48, severity: 'info', audience: [], concerns: ['p2', 'p3'], ...event } as GameEvent, 0, map, namen).text

  it('nennt Dritten die Verluste eines Gefechts nicht', () => {
    const text = zeile({
      type: 'BATTLE_RESOLVED',
      battleId: 'b1',
      provinceId: 'AFG',
      losses: { p2: 12_345, p3: 6_789 },
      victor: 'p2',
    } as never)

    expect(text).not.toMatch(/12|345|6.?789/)
    expect(text, 'der Ausgang darf sehr wohl dastehen').toContain('Ostmark')
  })

  it('traegt in keiner fremden Zeile eine Ziffer oder eine Kennung', () => {
    const zeilen = [
      zeile({ type: 'BATTLE_RESOLVED', battleId: 'b1', provinceId: 'AFG', losses: { p2: 1 }, victor: 'p2' } as never),
      zeile({ type: 'WAR_DECLARED', playerId: 'p2', targetPlayerId: 'p3', effectiveAtTick: 96, withoutDeclaration: false } as never),
      zeile({ type: 'DIPLOMACY_CHANGED', playerId: 'p2', targetPlayerId: 'p3', newState: 'war' } as never),
      zeile({ type: 'CAPITAL_LOST', playerId: 'p2', provinceId: 'AFG', penaltyUntilTick: 500 } as never),
    ]

    for (const text of zeilen) {
      expect(text, `Ziffer in "${text}"`).not.toMatch(/\d/)
      expect(text, `Kennung in "${text}"`).not.toMatch(/\bp\d\b/)
      expect(text, `Provinzkennung in "${text}"`).not.toMatch(/[A-Z]{3}-/)
    }
  })

  it('nennt bei beiden mehrdeutigen Saetzen beide Beteiligte', () => {
    // "Verhältnis zu Ostmark: Krieg." waere aus fremder Sicht die Aussage, *ich* fuehre
    // Krieg — und das ist falsch.
    expect(zeile({ type: 'DIPLOMACY_CHANGED', playerId: 'p2', targetPlayerId: 'p3', newState: 'war' } as never)).toContain('Süden')
    expect(zeile({ type: 'CAPITAL_LOST', playerId: 'p2', provinceId: 'AFG', penaltyUntilTick: 500 } as never)).toContain('Ostmark')
  })

  it('erzaehlt dem Betroffenen weiterhin die volle Fassung', () => {
    // Die Gegenrichtung: die Zusicherungen oben waeren auch dann gruen, wenn jede Zeile
    // auf die Kurzfassung fiele — und der Kampfbericht aus T-M14-13 waere still wieder weg.
    const eigen = describeEvent(
      {
        type: 'BATTLE_RESOLVED',
        tick: 48,
        severity: 'info',
        audience: [],
        concerns: ['p1', 'p2'],
        battleId: 'b1',
        provinceId: 'AFG',
        losses: { p1: 12_000, p2: 8_000 },
        victor: 'p2',
      } as unknown as GameEvent,
      0,
      map,
      namen,
    ).text

    expect(eigen).toMatch(/Verluste/)
  })
})

/**
 * Das Gefecht sammelt seine Zahlen fuer die Anzeige (T-M27-01, R-BAT-05, D25.6).
 *
 * Der Kern kennt Staerken, Verluste, Gelaende und Festung — der Protokolleintrag
 * nannte nur die Verluste. `battleReport` formt aus dem BATTLE_RESOLVED-Ereignis den
 * Anzeigedatensatz, den die Staerkebalken (T-M27-02) zeichnen. Drei Grenzen gehoeren
 * dazu: ein altes Ereignis ohne die additiven Felder ergibt KEINEN Datensatz (lieber
 * kein Bild als ein erfundenes), ein Unbeteiligter bekommt keine Mengen (R-DIP-04),
 * und der Betrachter steht zuerst — es ist sein Bericht.
 */
describe('R-BAT-05 Der Anzeigedatensatz eines Gefechts', () => {
  const nations: Record<string, string> = { p1: 'Deutschland', p2: 'Russland', p3: 'Frankreich' }
  const namen = { player: (id: string) => nations[id] ?? id, ticksPerDay: 24 }

  const gefecht = (over: Record<string, unknown> = {}): GameEvent =>
    event({
      type: 'BATTLE_RESOLVED',
      concerns: ['p1', 'p2'],
      battleId: 'b1',
      provinceId,
      losses: { p1: 5_000, p2: 12_000 },
      victor: 'p1',
      strengths: {
        p1: { before: 40_000, after: 35_000 },
        p2: { before: 20_000, after: 8_000 },
      },
      terrain: 'mountain',
      fortressLevel: 2,
      entrenched: ['p1'],
      attackBlocked: ['p2'],
      ...over,
    })

  it('bindet Staerken, Verluste und Umstaende an bekannte Zahlen', () => {
    const report = battleReport(gefecht(), map, { ...namen, viewer: 'p1' })

    expect(report).not.toBeNull()
    expect(report!.provinceName).toBe(provinceName)
    expect(report!.terrain).toBe('mountain')
    expect(report!.fortressLevel).toBe(2)
    expect(report!.victor).toBe('Deutschland')

    expect(report!.sides).toHaveLength(2)
    const [ich, gegner] = report!.sides
    expect(ich!.name).toBe('Deutschland')
    expect(ich!.before).toBe(40_000)
    expect(ich!.after).toBe(35_000)
    expect(ich!.losses).toBe(5_000)
    expect(ich!.entrenched).toBe(true)
    expect(ich!.attackBlocked).toBe(false)
    expect(gegner!.name).toBe('Russland')
    expect(gegner!.losses).toBe(12_000)
    expect(gegner!.entrenched).toBe(false)
    expect(gegner!.attackBlocked).toBe(true)
  })

  it('stellt den Betrachter an die erste Stelle — es ist sein Bericht', () => {
    const report = battleReport(gefecht(), map, { ...namen, viewer: 'p2' })

    expect(report!.sides[0]!.name).toBe('Russland')
    expect(report!.sides[1]!.name).toBe('Deutschland')
  })

  it('gibt fuer ein altes Ereignis ohne die additiven Felder keinen Datensatz', () => {
    const alt = gefecht({ strengths: undefined, terrain: undefined, fortressLevel: undefined })

    expect(battleReport(alt, map, { ...namen, viewer: 'p1' })).toBeNull()
  })

  it('gibt einem Unbeteiligten keine Mengen (R-DIP-04)', () => {
    expect(battleReport(gefecht(), map, { ...namen, viewer: 'p3' })).toBeNull()
  })

  it('gibt fuer andere Ereignisarten nichts', () => {
    expect(battleReport(event({ type: 'BATTLE_STARTED', provinceId }), map, namen)).toBeNull()
  })

  it('haengt den Datensatz an den Protokolleintrag, ohne Datensatz bleibt die Zeile schlicht (T-M27-02)', () => {
    const entry = describeEvent(gefecht(), 0, map, { ...namen, viewer: 'p1' })
    expect(entry.battle?.sides[0]?.before).toBe(40_000)

    const alt = describeEvent(gefecht({ strengths: undefined, terrain: undefined }), 0, map, {
      ...namen,
      viewer: 'p1',
    })
    expect(alt.battle).toBeUndefined()
  })
})

/**
 * Der Tagesabfluss: wohin die Rohstoffe gehen (T-M28-05, R-UI-05, v1-Befund 15, D26.5).
 *
 * Die Spalte Unterhalt fuehrte nur den Armeeunterhalt; Bau-, Aushebungs- und
 * Marktkosten erschienen in keiner Uebersicht — seit den Sparklines faellt der Bestand
 * sichtbar, ohne dass eine Spalte sagt warum. `dayExpenses` rechnet den Abfluss des
 * Tages aus denselben Quellen wie der Tagesbericht: Sicht, Regeln, Tagesereignisse.
 */
describe('R-UI-05 dayExpenses rechnet den Tagesabfluss je Rohstoff', () => {
  const sicht = (): PublicView =>
    ({
      tick: 24,
      playerId: 'p1',
      self: {},
      provinces: [
        {
          id: 'A',
          name: 'Alpha',
          owner: 'p1',
          buildQueue: [],
          recruitQueue: [
            // Heute erteilt (Tick 10 liegt im Fenster 0 < t <= 24): zaehlt.
            { id: 'r1', unitKey: 'infantry', count: 2, startedTick: 10, completesAtTick: 70 },
            // Gestern erteilt (Tick 0): zaehlt nicht zum Tag.
            { id: 'r0', unitKey: 'infantry', count: 5, startedTick: 0, completesAtTick: 30 },
          ],
        },
        {
          id: 'C',
          name: 'Gamma',
          owner: 'p2',
          recruitQueue: [{ id: 'rx', unitKey: 'infantry', count: 9, startedTick: 12, completesAtTick: 70 }],
        },
      ],
    }) as unknown as PublicView

  const regeln = (): Rules =>
    ({
      constants: { ticksPerDay: 24 },
      buildings: { barracks: { cost: { wood: 300_000, money: 200_000 } } },
      units: { infantry: { cost: { money: 50_000, iron: 10_000 } } },
    }) as unknown as Rules

  it('summiert Bau, Aushebung und Markt des Tages — fremde Provinzen und gestrige Auftraege nicht', () => {
    const abfluss = dayExpenses(sicht(), regeln(), [
      event({ type: 'BUILD_STARTED', tick: 5, provinceId: 'A', building: 'barracks', level: 1 }),
      event({ type: 'TRADE_EXECUTED', tick: 9, give: 'wood', giveAmount: 100_000, want: 'iron', wantAmount: 40_000 }),
    ])

    expect(abfluss).toEqual({
      // 300 Bau + 100 Markt-Abgabe.
      wood: 400_000,
      // 200 Bau + 2 x 50 Aushebung.
      money: 300_000,
      // 2 x 10 Aushebung — der Markt-ERTRAG (40 Eisen) ist kein Abfluss.
      iron: 20_000,
    })
  })

  it('bleibt ohne frische Auftraege und Ereignisse leer', () => {
    const leer = { tick: 24, playerId: 'p1', self: {}, provinces: [] } as unknown as PublicView

    expect(dayExpenses(leer, regeln(), [])).toEqual({})
  })
})

/**
 * T-M32-02 · Der Markt zeigt den Preisverlauf.
 *
 * Der Kurs eines Rohstoffs ist das, was er in Geld gekostet oder eingebracht hat —
 * ein Tauschgeschäft ohne Geld hat keinen Kurs und darf keinen erfinden.
 */
describe('T-M32-02 Preisreihe aus TRADE_EXECUTED', () => {
  const kauf = (tick: number, want: string, money: number, menge: number): GameEvent =>
    event({ type: 'TRADE_EXECUTED', tick, playerId: 'p1', give: 'money', giveAmount: money, want, wantAmount: menge })

  it('mittelt je Spieltag: drei Ausfuehrungen an zwei Tagen ergeben zwei Punkte', () => {
    const reihe = priceSeries(
      [kauf(0, 'wood', 2000, 1000), kauf(10, 'wood', 4000, 1000), kauf(30, 'wood', 5000, 1000)],
      24,
    )

    expect(reihe['wood']).toEqual([
      { day: 0, price: 3 },
      { day: 1, price: 5 },
    ])
  })

  it('nimmt den Verkauf gegen Geld mit demselben Kurs auf', () => {
    const verkauf = event({
      type: 'TRADE_EXECUTED',
      tick: 0,
      playerId: 'p1',
      give: 'iron',
      giveAmount: 1000,
      want: 'money',
      wantAmount: 7000,
    })

    expect(priceSeries([verkauf], 24)['iron']).toEqual([{ day: 0, price: 7 }])
  })

  it('laesst ein Tauschgeschaeft ohne Geld ganz weg', () => {
    const tausch = event({
      type: 'TRADE_EXECUTED',
      tick: 0,
      playerId: 'p1',
      give: 'wood',
      giveAmount: 1000,
      want: 'iron',
      wantAmount: 500,
    })

    expect(priceSeries([tausch], 24)).toEqual({})
  })
})

/**
 * T-M28-06 · Welcher Einmarsch-Alarm offen ist.
 *
 * Der Befund der Durchsicht vom 2026-09-11: der quittierte Tick überlebte den
 * Partiewechsel, und ein Einmarsch an Tag 5 der neuen Partie blieb stumm, weil in der
 * alten schon Tag 30 quittiert war. Die Ableitung erkennt das jetzt selbst.
 */
describe('T-M28-06 Der offene Einmarsch-Alarm', () => {
  const einmarsch = (tick: number, provinceId = 'A') =>
    event({ type: 'ARMY_INTRUDED', tick, playerId: 'p1', intruderId: 'p2', armyId: 'a2', provinceId })

  it('meldet den juengsten Einmarsch oberhalb des quittierten Ticks', () => {
    const offen = openIntrusion([einmarsch(10, 'A'), einmarsch(40, 'B')], 20, 50)
    expect(offen?.provinceId).toBe('B')
  })

  it('schweigt, wenn alles quittiert ist', () => {
    expect(openIntrusion([einmarsch(10), einmarsch(40)], 40, 50)).toBeNull()
  })

  it('verwirft eine Quittung, die juenger ist als die laufende Partie', () => {
    // Genau der Fall aus der Durchsicht: Tag 30 der alten Partie quittiert, die neue
    // steht bei Tick 6. Eine Quittung aus der Zukunft kann nicht zu dieser Partie
    // gehoeren — sonst bliebe der Alarm bis Tick 721 stumm.
    expect(openIntrusion([einmarsch(5)], 720, 6)?.provinceId).toBe('A')
  })

  it('sieht nur Einmaersche an, nichts anderes', () => {
    expect(openIntrusion([event({ type: 'ARMY_ARRIVED', tick: 40, playerId: 'p1', armyId: 'a1' })], -1, 50)).toBeNull()
  })
})

/**
 * Die leisen Zeilen der Automatik (T-M40-13; Nachtrag T-M40-12, N-4 der Durchsicht der Nacharbeit).
 *
 * `App.tsx` haelt hoechstens 40 Maersche (`slice(-40)`). Die Kennung einer Zeile war ihr Listenplatz:
 * fiel vorn ein Marsch heraus, rueckte jede Kennung um eins, und React verwechselte die Zeilen. Die
 * Kennung haengt jetzt am Marsch selbst — die Automatik gibt je Tick hoechstens einen Befehl je Armee.
 */
describe('T-M40-13 Die Zeilen der Automatik tragen eine Kennung, die nicht am Listenplatz haengt', () => {
  const naming = { army: (armyId: string) => `Armee ${armyId}`, province: (provinceId: string) => `Provinz ${provinceId}` }
  const marsch = (tick: number, armyId: string, targetProvinceId: string): { tick: number; command: Command } => ({
    tick,
    command: { type: 'MOVE_ARMY', playerId: 'p1', armyId, targetProvinceId },
  })

  it('behaelt die Kennung einer Zeile, wenn aeltere Zeilen herausfallen (N-4)', () => {
    const erster = marsch(100, 'a1', 'n2')
    const zweiter = marsch(130, 'a2', 'n3')

    const vorher = adjutantMarchEntries([erster, zweiter], naming)
    const nachher = adjutantMarchEntries([zweiter], naming)

    expect(nachher[0]!.id).toBe(vorher[1]!.id)
  })

  it('unterscheidet zwei Maersche im selben Tick, schreibt Namen und laesst andere Befehle aus', () => {
    const zeilen = adjutantMarchEntries(
      [marsch(100, 'a1', 'n2'), marsch(100, 'a2', 'n3'), { tick: 100, command: { type: 'STOP_ARMY', playerId: 'p1', armyId: 'a3' } }],
      naming,
    )

    expect(zeilen).toHaveLength(2)
    expect(new Set(zeilen.map((zeile) => zeile.id)).size).toBe(2)
    expect(zeilen[0]).toMatchObject({
      tick: 100,
      text: 'Armee a1 rückt von selbst nach Provinz n2 nach.',
      provinceId: 'n2',
      severity: 'info',
      category: 'combat',
    })
  })
})

/**
 * Das Zwischenziel im Protokoll (T-M35-04, R-GAME-08/AK2, D31.4).
 *
 * Ein Zwischenziel, das man nur beim Nachsehen bemerkt, ist kein Ziel — es steht deshalb als
 * Satz im Protokoll. Ohne Kennungen: „pointShareFirst" oder „p1" muesste der Spieler
 * nachschlagen, und genau diese Arbeit soll das Protokoll ihm abnehmen.
 */
describe('R-GAME-08/AK2 Ein erreichtes Ziel wird zu einem Satz', () => {
  const GOALS = ['provinces', 'pointShareFirst', 'populationShare', 'pointShareSecond'] as const

  it('nennt jedes der vier Ziele mit eigenem Namen und ohne Kennung', () => {
    const texts = GOALS.map(
      (goal) =>
        describeEvent(
          event({ type: 'GOAL_REACHED', playerId: 'p1', audience: ['p1'], concerns: ['p1'], goal, day: 221 }),
          0,
          map,
          { viewer: 'p1' },
        ).text,
    )

    for (const text of texts) {
      expect(text).toMatch(/Zwischenziel/)
      expect(text).not.toMatch(/provinces|pointShare|populationShare|GOAL_REACHED|events\.|\bp1\b|\{\{/)
    }
    expect(new Set(texts).size, 'vier Ziele, vier Saetze').toBe(GOALS.length)
  })
})

/**
 * Der Tageslauf der Spionage im Protokoll (T-M17-08, R-SPY-02, D29.5).
 *
 * Ein Bericht, der „SPY_REPORT s3 intel targetChanged" sagt, hilft niemandem. Auftrag und Ausgang
 * stehen mit Namen im Satz, die Provinz ebenso, und keine Kennung — der Spion hat für den
 * Spieler keine Nummer (Befund M17-S1). Geprüft für jeden Auftrag und jeden Ausgang: ein
 * fehlender Name zeigte sich als `[espionage.…]` im Text.
 */
describe('R-SPY-02 Bericht und Verlust eines Spions werden zu Saetzen', () => {
  const MISSIONS = ['intel', 'economicSabotage', 'militarySabotage', 'counter'] as const
  const OUTCOMES = ['success', 'failure', 'targetChanged'] as const
  const ROH = /intel|Sabotage\b|economic|military|counter|success|failure|targetChanged|unpaid|SPY_|\bs3\b|\bp1\b|\[|\{\{/

  it('nennt Provinz, Auftrag und Ausgang beim Namen — fuer jede Paarung', () => {
    const texts = new Set<string>()
    for (const mission of MISSIONS) {
      for (const outcome of OUTCOMES) {
        const entry = describeEvent(
          event({ type: 'SPY_REPORT', playerId: 'p1', spyId: 's3', provinceId, mission, outcome, audience: ['p1'], concerns: ['p1'] }),
          0,
          map,
          { viewer: 'p1' },
        )
        expect(entry.text, `${mission}/${outcome}`).toContain(provinceName)
        expect(entry.text, `${mission}/${outcome}`).not.toMatch(ROH)
        expect(entry.provinceId).toBe(provinceId)
        texts.add(entry.text)
      }
    }
    expect(texts.size, 'zwoelf Paarungen, zwoelf Saetze').toBe(MISSIONS.length * OUTCOMES.length)
  })

  it('sagt beim Verlust, welcher Spion es war und warum', () => {
    const entry = describeEvent(
      event({ type: 'SPY_LOST', playerId: 'p1', spyId: 's3', provinceId, mission: 'economicSabotage', reason: 'unpaid', audience: ['p1'], concerns: ['p1'] }),
      0,
      map,
      { viewer: 'p1' },
    )

    expect(entry.text).toContain(provinceName)
    expect(entry.text).toContain('Wirtschaftssabotage')
    expect(entry.text).toMatch(/Sold/)
    expect(entry.text).not.toMatch(ROH)
  })
})

/**
 * Sabotage und Enttarnung im Protokoll (T-M17-09, R-SPY-04/05, D29.5).
 *
 * Die erlittene Sabotage nennt ihre Wirkung — Moral, Vernichtetes, Verzögerung — aber, mit Absicht,
 * keinen Urheber: das Ereignis kennt keinen. Die Enttarnung nennt beide Mächte mit Namen.
 */
describe('R-SPY-04/05 Sabotage und Enttarnung werden zu Saetzen (T-M17-09)', () => {
  const ROH_SAB = /economic|military|destroyed|moraleLoss|delayTicks|SABOTAGE_|SPY_|\bp\d\b|\[|\{\{/

  it('Wirtschaftssabotage: Provinz, Moralverlust und das Vernichtete mit Namen', () => {
    const entry = describeEvent(
      event({
        type: 'SABOTAGE_SUFFERED',
        severity: 'alert',
        playerId: 'p1',
        provinceId,
        kind: 'economic',
        moraleLoss: 10_000,
        destroyed: { money: 5_000, iron: 2_000 },
        delayTicks: 0,
        audience: ['p1'],
        concerns: ['p1'],
      }),
      0,
      map,
      { viewer: 'p1' },
    )

    expect(entry.text).toContain(provinceName)
    expect(entry.text).toContain('Moral')
    expect(entry.text).toContain('10')
    expect(entry.text).toContain(t('resources.money'))
    expect(entry.text).toContain(t('resources.iron'))
    expect(entry.text).not.toMatch(ROH_SAB)
    expect(entry.severity).toBe('alert')
    expect(entry.provinceId).toBe(provinceId)
  })

  it('Wirtschaftssabotage ohne Beute sagt es', () => {
    const entry = describeEvent(
      event({
        type: 'SABOTAGE_SUFFERED',
        playerId: 'p1',
        provinceId,
        kind: 'economic',
        moraleLoss: 10_000,
        destroyed: {},
        delayTicks: 0,
        audience: ['p1'],
        concerns: ['p1'],
      }),
      0,
      map,
      { viewer: 'p1' },
    )

    expect(entry.text).toContain('nichts')
    expect(entry.text).not.toContain('[espionage.sabotage.nothingDestroyed]')
  })

  it('Militaersabotage: die Verzoegerung in Stunden', () => {
    const entry = describeEvent(
      event({
        type: 'SABOTAGE_SUFFERED',
        playerId: 'p1',
        provinceId,
        kind: 'military',
        moraleLoss: 0,
        destroyed: {},
        delayTicks: 12,
        audience: ['p1'],
        concerns: ['p1'],
      }),
      0,
      map,
      { viewer: 'p1' },
    )

    expect(entry.text).toContain('12 Stunden')
    expect(entry.text).not.toContain('Moral')
  })

  it('Enttarnung nennt beide Maechte und den Auftrag', () => {
    const naming = { viewer: 'p1', player: (id: string) => ({ p1: 'Nordland', p2: 'Ostmark' })[id] ?? id }
    const makeEvent = () =>
      event({
        type: 'SPY_DETECTED',
        playerId: 'p1',
        targetPlayerId: 'p2',
        provinceId,
        mission: 'economicSabotage',
        audience: ['p1', 'p2'],
        concerns: ['p1', 'p2'],
      })

    for (const viewer of ['p1', 'p2']) {
      const entry = describeEvent(makeEvent(), 0, map, { ...naming, viewer })
      expect(entry.text, viewer).toContain('Nordland')
      expect(entry.text, viewer).toContain('Ostmark')
      expect(entry.text, viewer).toContain('Wirtschaftssabotage')
      expect(entry.text, viewer).not.toMatch(ROH_SAB)
    }
  })
})

/**
 * Über einen Lauf mit Spionen: der Opfertext von SABOTAGE_SUFFERED nennt nie den Urheber
 * (R-SPY-04/AK3, T-M17-09) — dieselbe Eigenschaft wie in `event-audience.test.ts`, hier am
 * gerenderten Satz statt an den rohen Feldern.
 */
describe('R-SPY-04/AK3 Der Opfertext nennt keinen Urheber — ueber einen Lauf mit Spionen', () => {
  it('vierzig Spieltage, drei Maechte, sechs Spione', () => {
    const testMap = smallWorld()
    const CONFIG: GameConfig = {
      seed: 7,
      mapId: 'testworld',
      rulesId: 'test',
      players: [
        { name: 'Noah', kind: 'human' as const, nation: 'Nordland', color: '#0f62bc' },
        { name: 'Zwei', kind: 'ai' as const, nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' as const },
        { name: 'Drei', kind: 'ai' as const, nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' as const },
      ],
      victory: { condition: 'points' as const, pointsShareToWin: 600, dayLimit: null },
    }
    const worldCtx = { map: testMap, rules: TEST_RULES }
    let state = createInitialState(CONFIG, worldCtx)
    state.nextIds.spy = 101
    state.players['p1']!.resources.money += 5_000_000

    const spy = (owner: string, provinceIdArg: string, mission: string) => {
      state.espionage.spies.push({
        id: `s${state.nextIds.spy++}`,
        owner,
        provinceId: provinceIdArg,
        mission: mission as never,
        recruitedTick: 0,
        assignedTick: 0,
        lastRunTick: null,
        lastOutcome: null,
      })
    }
    spy('p1', 'o1', 'economicSabotage')
    spy('p1', 'o2', 'militarySabotage')
    spy('p1', 's2', 'economicSabotage')
    spy('p1', 's1', 'intel')
    spy('p3', 's2', 'counter')
    spy('p3', 's1', 'counter')

    const seen: GameEvent[] = []
    for (let day = 0; day < 40; day++) {
      const result = runTicks(state, TEST_RULES.constants.ticksPerDay, worldCtx)
      state = result.state
      seen.push(...result.events)
      if (state.victory.winner !== null) break
    }

    const naming = { player: (id: string) => state.players[id]?.nation ?? id, ticksPerDay: 24 }
    const verstoesse: string[] = []
    let gerenderteSabotagen = 0
    for (const opfer of ['p2', 'p3']) {
      for (const [i, e] of eventsFor(seen, opfer).entries()) {
        if (e.type === 'SPY_DETECTED' && e.targetPlayerId === opfer) continue
        if (e.type === 'SABOTAGE_SUFFERED') gerenderteSabotagen++
        const text = describeEvent(e, i, testMap, { ...naming, viewer: opfer }).text
        if (text.includes('Nordland') || /\bp1\b/.test(text) || /\bs10\d\b/.test(text)) {
          verstoesse.push(`${e.type}:${text}`)
        }
      }
    }
    expect(verstoesse).toEqual([])
    expect(gerenderteSabotagen, 'kein gerenderter SABOTAGE_SUFFERED-Text — leerer Beweis').toBeGreaterThan(0)

    // Gegenkontrolle: die Suche kann Namen sehen.
    const detectedForP3 = eventsFor(seen, 'p3').find((e) => e.type === 'SPY_DETECTED' && e.targetPlayerId === 'p3')
    expect(detectedForP3, 'Vorbedingung: p3 hat einen Spion enttarnt').toBeDefined()
    const detectedText = describeEvent(detectedForP3!, 0, testMap, { ...naming, viewer: 'p3' }).text
    expect(detectedText).toContain('Nordland')
  })
})
