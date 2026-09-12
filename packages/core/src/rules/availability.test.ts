import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/registry'
import { createInitialState, type GameConfig } from '../state/create'
import type { Command } from '../commands/types'
import type { PhaseContext } from '../phases/index'
import { tickOfDay } from './availability'
import { RulesError, parseRules } from './load'

/**
 * Die Freischaltungsachse (T-M15-02, R-TECH-01).
 *
 * Der Befund, um den es geht, war kein Fehler in einer Formel, sondern eine fehlende
 * Achse: **Tag 1 unterschied sich von Tag 40 durch nichts als den Kontostand.** Alles war
 * vom ersten Tick an baubar, es gab keine Entwicklung und nichts, worauf man hinarbeitet.
 *
 * Die Antwort ist ein Feld, eine Ablehnung und ein Text — keine neue Mechanik. Jede
 * Sache trägt einen ersten Spieltag; davor lehnt der Kern ab und **nennt den Tag**, ab
 * dem es geht. Für Mensch und KI dieselbe Regel: der Kern kennt den Unterschied nicht.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const raw = (name: string): unknown => JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8'))

const rawRules = () => ({
  constants: raw('constants'),
  resources: raw('resources'),
  buildings: raw('buildings'),
  units: raw('units'),
  ai: raw('ai'),
})

const CONFIG: GameConfig = {
  seed: 3,
  mapId: 'testworld',
  rulesId: 'test',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Rechner', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

// `events` gehoert zum Kontext, den die Kommandos beim Anwenden fuellen — ohne ihn
// laeuft nur der Ablehnungspfad, und ein Test, der nur ablehnt, belegt AK2 nicht.
const ctx: PhaseContext = { map: smallWorld(), rules: TEST_RULES, commands: [], events: [] }

/** Eine Provinz mit allen Gebäuden und vollen Kassen — damit nur der Tag ablehnen kann. */
function ready(atDay: number) {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tickOfDay(atDay, TEST_RULES)
  const province = state.provinces['n1']!
  province.owner = 'p1'
  province.morale = 90_000
  for (const key of Object.keys(TEST_RULES.buildings)) {
    province.buildings[key as keyof typeof province.buildings] = 1
  }
  for (const key of Object.keys(state.players['p1']!.resources)) {
    state.players['p1']!.resources[key as 'money'] = 99_000_000
  }
  state.players['p2']!.resources = { ...state.players['p1']!.resources }
  return state
}

const reject = (state: ReturnType<typeof ready>, command: Command) => applyCommand(state, command, ctx)

/**
 * Die Tage stehen seit T-M34-03 nicht mehr als Zahl in diesen Tests.
 *
 * Vorher hiess es hier woertlich "an Tag 8" und "ab Tag 10" — und beim Strecken der
 * Leiter fielen vier Tests, die ueber die Mechanik gar nichts sagen wollten. Gelesen wird
 * der Tag jetzt aus dem Regelwerk; dass die Zusicherung dabei nicht leer wird, sichert
 * die Zeile darunter: eine Sache, die ohnehin ab Tag 1 zu haben ist, koennte AK1 nicht
 * belegen. Welche Tage gelten, haelt der Block am Ende der Datei fest.
 */
const TAG_FABRIK = (raw('buildings') as { buildings: Record<string, { availableFromDay: number }> }).buildings['factory']!.availableFromDay
const TAG_JAEGER = (raw('units') as { units: Record<string, { availableFromDay: number }> }).units['fighter']!.availableFromDay

describe('R-TECH-01/AK1 Vor ihrem Tag gibt es die Sache nicht', () => {
  it('sperrt beide Sachen ueberhaupt erst — sonst belegt AK1 nichts', () => {
    expect(TAG_FABRIK).toBeGreaterThan(1)
    expect(TAG_JAEGER).toBeGreaterThan(1)
  })

  it('lehnt eine Fabrik an Spieltag 1 ab und nennt den Tag', () => {
    const rejected = reject(ready(1), { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'factory' })

    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
    // Der Tag steht im Detail — die Ablehnung sagt "ab Tag 28", nicht "geht nicht".
    expect(rejected.ok ? undefined : rejected.detail).toMatchObject({ availableFromDay: TAG_FABRIK })
  })

  it('lehnt einen Jaeger am Tag vor seiner Freischaltung ab', () => {
    const rejected = reject(ready(TAG_JAEGER - 1), {
      type: 'RECRUIT',
      playerId: 'p1',
      provinceId: 'n1',
      unitKey: 'fighter',
      count: 1,
    })

    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
  })

  it('kennt bei der KI keinen Unterschied', () => {
    // Derselbe Auftrag mit einer KI-Macht als Absender. Eine Freischaltung, die nur den
    // Menschen bremst, waere ein Bonus fuer die KI — und R-AI-02 verlangt, dass Boni im
    // UI ausgewiesen werden. Der billigste Weg, das nicht zu verletzen: es gibt keinen.
    const state = ready(1)
    state.provinces['n1']!.owner = 'p2'

    const rejected = reject(state, { type: 'BUILD', playerId: 'p2', provinceId: 'n1', building: 'factory' })
    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
  })
})

describe('R-TECH-01/AK2 Ab ihrem Tag gibt es sie', () => {
  it('nimmt dieselbe Fabrik am Tag ihrer Freischaltung an', () => {
    const state = ready(TAG_FABRIK)
    const before = state.provinces['n1']!.buildQueue.length
    const result = applyCommand(state, { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'factory' }, ctx)

    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(state.provinces['n1']!.buildQueue.length).toBe(before + 1)
  })

  it('nimmt den Jaeger am Tag seiner Freischaltung an', () => {
    const result = applyCommand(
      ready(TAG_JAEGER),
      { type: 'RECRUIT', playerId: 'p1', provinceId: 'n1', unitKey: 'fighter', count: 1 },
      ctx,
    )

    expect(result.ok, JSON.stringify(result)).toBe(true)
  })
})

describe('R-TECH-01/AK3 Ein fehlender Tag ist ein Fehler, keine Vorgabe', () => {
  it('lehnt ein Gebaeude ohne availableFromDay ab und nennt es beim Namen', () => {
    // Die Lehre aus N1: eine fehlende Angabe darf nicht still zu einer Vorgabe werden.
    // "Fehlt der Tag, gilt Tag 1" waere genau der Zustand, den diese Aufgabe behebt —
    // nur unauffindbar.
    const rules = rawRules()
    delete (rules.buildings as { buildings: Record<string, unknown> }).buildings['factory']!['availableFromDay' as never]

    expect(() => parseRules(rules, 'test')).toThrow(RulesError)
    expect(() => parseRules(rules, 'test')).toThrow(/factory|Fabrik/)
  })

  it('lehnt eine Einheit ab, die es frueher gibt als ihr Gebaeude', () => {
    // Eine Einheit vor ihrem Gebaeude ist nicht frueh verfuegbar, sondern nie: der
    // Bauauftrag scheitert dann an MISSING_BUILDING statt am Tag, und der Spieler liest
    // die falsche Begruendung.
    const rules = rawRules()
    const units = (rules.units as { units: Record<string, Record<string, unknown>> }).units
    units['tank']!['availableFromDay'] = 2 // Fabrik gibt es ab Tag 8

    expect(() => parseRules(rules, 'test')).toThrow(RulesError)
    expect(() => parseRules(rules, 'test')).toThrow(/tank|Panzer/)
  })

  it('nimmt das ausgelieferte Regelwerk unveraendert an', () => {
    // Die Gegenrichtung: die beiden Zusicherungen oben waeren auch dann gruen, wenn der
    // Lader alles ablehnte.
    expect(() => parseRules(rawRules(), 'test')).not.toThrow()
  })
})

/**
 * Die gestreckte Leiter (T-M34-03, D34.1).
 *
 * Bis zum 2026-09-12 stand hier die Zusicherung "traegt die fuenf belegten Tage
 * woertlich" — Kaserne 1, Hafen 2, Eisenbahn 5, Fabrik 8, Flugplatz 10 aus Referenz 1.4.
 * Sie war richtig gegen stille Zahlenaenderungen und falsch in der Sache: im Vorbild ist
 * ein Spieltag ein echter Tag, hier sind es 24 Sekunden bei Tempo 1. **Die ganze Achse
 * war nach 6,4 Minuten Echtzeit durchlaufen**, waehrend die Partie bis Spieltag 798
 * laeuft. Was die Referenz wirklich belegt, ist die REIHENFOLGE; die haelt der Test
 * darunter fest, und zwar gegen die Tage von gestern statt gegen eine neue Behauptung.
 * Entscheid in DECISIONS.md (2026-09-12, T-M34-02).
 */
describe('R-TECH-01 Die Freischaltungsleiter traegt bis in die Partie hinein', () => {
  const buildingDays = () =>
    (raw('buildings') as { buildings: Record<string, { availableFromDay: number }> }).buildings
  const unitRules = () =>
    (raw('units') as {
      units: Record<string, { availableFromDay: number; class: string; requiresBuilding: string }>
    }).units

  /** Die Leiter vor der Streckung — die Ordnung, die aus dem Vorbild stammt. */
  const FRUEHER: Readonly<Record<string, number>> = {
    barracks: 1, infantry: 1, harbour: 2, fortress: 3, transport: 3, motorized: 4, railway: 5,
    factory: 8, tank: 8, artillery: 9, shipyard: 9, airfield: 10, fighter: 10, destroyer: 11,
    bomber: 13, heavy_tank: 14, rocket_artillery: 16,
  }

  const alleTage = (): Record<string, number> => ({
    ...Object.fromEntries(Object.entries(buildingDays()).map(([key, rule]) => [key, rule.availableFromDay])),
    ...Object.fromEntries(Object.entries(unitRules()).map(([key, rule]) => [key, rule.availableFromDay])),
  })

  it('laesst die Kaserne und die Infanterie auf Tag 1', () => {
    // Ohne sie steht der Spieler am ersten Spieltag ohne eine einzige Handlung da — das
    // war die ausdrueckliche Begruendung fuer die Eins-basierte Zaehlung in currentDay().
    expect(buildingDays()['barracks']?.availableFromDay).toBe(1)
    expect(unitRules()['infantry']?.availableFromDay).toBe(1)
  })

  it('schaltet die letzte Sache erst weit in der Partie frei, nicht nach sechs Minuten', () => {
    const tage = Object.values(alleTage())
    const letzte = Math.max(...tage)

    // 80 Spieltage sind bei Tempo 1 gut eine halbe Stunde und bei Tempo 10 drei Minuten.
    // Die Marke ist eine Marke und keine Punktlandung: gemessen wird sie in T-M34-07.
    expect(letzte, `spaeteste Freischaltung: Tag ${letzte}`).toBeGreaterThanOrEqual(70)
    expect(letzte, `spaeteste Freischaltung: Tag ${letzte}`).toBeLessThanOrEqual(90)
    expect(letzte / Math.max(...Object.values(FRUEHER))).toBeGreaterThanOrEqual(4)
  })

  it('behaelt die Reihenfolge des Vorbilds — nur die Abstaende wachsen', () => {
    const heute = alleTage()
    const falsch: string[] = []

    for (const [a, tagA] of Object.entries(FRUEHER)) {
      for (const [b, tagB] of Object.entries(FRUEHER)) {
        // Nur echte Reihenfolgen pruefen: wo gestern Gleichstand herrschte, darf heute
        // eine Seite vorn liegen (Fabrik vor Panzer statt am selben Tag).
        if (tagA >= tagB) continue
        if ((heute[a] ?? 0) >= (heute[b] ?? 0)) {
          falsch.push(`${a} (${tagA}→${heute[a]}) liegt nicht mehr vor ${b} (${tagB}→${heute[b]})`)
        }
      }
    }

    expect(falsch, `Reihenfolge verletzt:\n${falsch.join('\n')}`).toEqual([])
  })

  it('haelt die Leiter je Klasse monoton: die staerkere Sache kommt spaeter', () => {
    const units = unitRules()
    const heute = alleTage()
    const klassen = new Map<string, string[]>()
    for (const [key, rule] of Object.entries(units)) {
      klassen.set(rule.class, [...(klassen.get(rule.class) ?? []), key])
    }

    // Die Gegenprobe zuerst: eine Zaehlung ueber einer leeren Menge ist immer wahr.
    expect([...klassen.values()].filter((keys) => keys.length > 1).length).toBeGreaterThanOrEqual(4)

    const falsch: string[] = []
    for (const keys of klassen.values()) {
      const sortiertFrueher = [...keys].sort((a, b) => (FRUEHER[a] ?? 0) - (FRUEHER[b] ?? 0))
      const sortiertHeute = [...keys].sort((a, b) => (heute[a] ?? 0) - (heute[b] ?? 0))
      if (sortiertFrueher.join(',') !== sortiertHeute.join(',')) {
        falsch.push(`${keys[0]}-Klasse: frueher ${sortiertFrueher.join(' < ')}, heute ${sortiertHeute.join(' < ')}`)
      }
    }

    expect(falsch, `Klassenreihenfolge verletzt:\n${falsch.join('\n')}`).toEqual([])
  })

  it('schaltet kein Gebaeude spaeter frei als die Einheit, die es verlangt', () => {
    // Der Lader wirft darauf schon (AK3 oben) — hier steht es als Zusicherung ueber das
    // ausgelieferte Regelwerk und nicht ueber den Lader, denn die Streckung haette sie
    // genau hier reissen koennen: Artillerie lag im Vorschlag des Bauplans zwei Tage VOR
    // ihrer Fabrik.
    const buildings = buildingDays()
    const falsch: string[] = []
    for (const [key, rule] of Object.entries(unitRules())) {
      const gebaeude = buildings[rule.requiresBuilding]
      if (gebaeude && rule.availableFromDay < gebaeude.availableFromDay) {
        falsch.push(`${key} ab Tag ${rule.availableFromDay}, ${rule.requiresBuilding} erst ab ${gebaeude.availableFromDay}`)
      }
    }

    expect(falsch, `Einheit vor ihrem Gebaeude:\n${falsch.join('\n')}`).toEqual([])
  })

  it('laesst die Abstaende in der zweiten Haelfte groesser sein als in der ersten', () => {
    const sortiert = Object.values(alleTage()).sort((a, b) => a - b)
    const mitte = Math.floor(sortiert.length / 2)
    const abstaende = (werte: number[]) =>
      werte.slice(1).map((tag, index) => tag - werte[index]!).reduce((a, b) => a + b, 0) / Math.max(1, werte.length - 1)

    const vorn = abstaende(sortiert.slice(0, mitte + 1))
    const hinten = abstaende(sortiert.slice(mitte))

    expect(hinten, `Abstaende vorn ${vorn.toFixed(1)}, hinten ${hinten.toFixed(1)}`).toBeGreaterThan(vorn)
  })

  it('gibt jedem Gebaeude und jeder Einheit einen Tag', () => {
    const buildings = (raw('buildings') as { buildings: Record<string, { availableFromDay?: number }> }).buildings
    const units = (raw('units') as { units: Record<string, { availableFromDay?: number }> }).units

    for (const [key, rule] of Object.entries(buildings)) {
      expect(rule.availableFromDay, `Gebäude "${key}" ohne ersten Spieltag`).toBeGreaterThan(0)
    }
    for (const [key, rule] of Object.entries(units)) {
      expect(rule.availableFromDay, `Einheit "${key}" ohne ersten Spieltag`).toBeGreaterThan(0)
    }
    expect(Object.keys(buildings).length).toBe(7)
    expect(Object.keys(units).length).toBe(10)
  })
})
