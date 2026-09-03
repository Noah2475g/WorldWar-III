import { describe, expect, it } from 'vitest'
import {
  amount,
  arrival,
  costs,
  duration,
  formatTime,
  gameTime,
  missing,
  percent,
  population,
  rate,
  unfix,
} from './format.ts'

/**
 * Numbers on screen (T-M10-04, T-M10-05).
 *
 * Everything in the core is fixed-point with three decimals. The conversion happens
 * here and only here, because a component that divides by a thousand on its own is a
 * component that will one day forget to — and a resource bar showing 4 812 000 instead
 * of 4 812 is the kind of bug that survives a whole playtest.
 */

describe('R-UI-04 Mengen und Raten', () => {
  it('rechnet Festkomma in ganze Einheiten um', () => {
    expect(unfix(4_812_000)).toBe(4812)
    expect(amount(4_812_000)).toBe('4.812')
  })

  it('zeigt Raten immer mit Vorzeichen', () => {
    // The sign is read at a glance; a bare "42" needs a moment to work out which way
    // the balance is going.
    expect(rate(42_000)).toBe('+42')
    expect(rate(-17_000)).toBe('−17')
    expect(rate(0)).toBe('±0')
  })

  it('kuerzt grosse Bevoelkerungen', () => {
    // The core counts people in fixed-point thousands, so the raw figure is the number
    // of people: the test map's 900 000 is nine hundred thousand, not nine hundred.
    expect(population(1_240_000)).toBe('1,24 Mio')
    expect(population(900_000)).toBe('900 Tsd')
    expect(population(45_000)).toBe('45 Tsd')
    expect(population(320)).toBe('320')
    expect(population(9_400_000)).toBe('9,4 Mio')
  })

  it('rundet Prozente', () => {
    expect(percent(71.4)).toBe('71 %')
  })
})

describe('R-UI-04 Spielzeit', () => {
  it('beginnt an Tag eins um Mitternacht', () => {
    expect(gameTime(0, 24)).toEqual({ day: 1, hour: 0 })
    expect(formatTime(0, 24)).toBe('Tag 1 · 00:00')
  })

  it('rechnet Ticks in Tag und Stunde um', () => {
    expect(gameTime(24 * 33 + 6, 24)).toEqual({ day: 34, hour: 6 })
    expect(formatTime(24 * 33 + 6, 24)).toBe('Tag 34 · 06:00')
  })

  it('gruppiert grosse Tageszahlen', () => {
    expect(formatTime(24 * 1233, 24)).toContain('1.234')
  })
})

describe('R-UI-05 Dauern und Ankunft', () => {
  it('sagt Stunden unter einem Tag', () => {
    expect(duration(14)).toBe('14 h')
  })

  it('sagt Tage darueber', () => {
    // Above a day the player thinks in days, so that is what the interface says.
    expect(duration(36)).toBe('1,5 Tage')
    expect(duration(24 * 12)).toBe('12 Tage')
  })

  it('beugt den einen Tag richtig', () => {
    expect(duration(24)).toBe('1 Tag')
    expect(duration(25)).toBe('1 Tag')
    expect(duration(30)).toBe('1,3 Tage')
  })

  it('nennt eine nahe Ankunft in Stunden', () => {
    expect(arrival(100, 108, 24)).toBe('Ankunft in 8 h')
  })

  it('nennt eine ferne Ankunft mit Tag und Uhrzeit', () => {
    // Counting down from ninety hours is arithmetic the player should not have to do.
    expect(arrival(0, 24 * 3 + 6, 24)).toBe('Ankunft Tag 4, 06:00')
  })

  it('sagt bei erreichtem Ziel, dass die Armee steht', () => {
    expect(arrival(120, 120, 24)).toBe('Steht')
  })
})

describe('R-UI-05 Kosten und Fehlbetrag', () => {
  it('listet Kosten mit Einheit', () => {
    expect(costs({ money: 750_000, iron: 400_000 })).toBe('750 Geld, 400 Eisen')
  })

  it('laesst leere Posten weg', () => {
    expect(costs({ money: 750_000, iron: 0, oil: undefined })).toBe('750 Geld')
  })

  it('nennt nur den Fehlbetrag, nicht die ganze Rechnung', () => {
    // "Es fehlen 400 Eisen" tells the player what to do next; the full price makes
    // them work out the difference themselves.
    const short = missing({ money: 750_000, iron: 400_000 }, { money: 900_000, iron: 0 })

    expect(short).toBe('400 Eisen')
  })

  it('meldet nichts, wenn alles da ist', () => {
    expect(missing({ iron: 100_000 }, { iron: 200_000 })).toBe('')
  })
})
