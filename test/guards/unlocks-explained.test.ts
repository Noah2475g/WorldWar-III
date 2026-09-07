import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { alertsFor, type UnlockRules } from '../../apps/desktop/src/ui/Alerts'
import { TUTORIAL_STEPS } from '../../apps/desktop/src/game/tutorial'
import { hasKey, t } from '../../apps/desktop/src/i18n/text'
import { ROOT } from './scan'

/**
 * Jede Mechanik wird erklärt, wenn sie freigeschaltet wird (T-M21-04, R-TECH-02).
 *
 * Das Rückgrat hatte das Spiel seit M12: `availableFromDay` schaltet siebzehn Sachen über
 * sechzehn Spieltage frei — Hafen an Tag 2, Fabrik an Tag 8, Raketenartillerie an Tag 16.
 * **Gesagt hat es das nie.** Wer nicht von sich aus jeden Tag die Bauliste durchsah,
 * erfuhr von der Werft, wenn er sie zufällig brauchte.
 *
 * Dieser Wächter ist der eigentliche Ertrag der Aufgabe, und zwar weil er **heute grün
 * ist und morgen fallen wird**: eine neue Einheit in `units.json` fällt sonst still aus
 * der Anleitung. Dieselbe Bauart wie der Symbolwächter, der einst Schlüssel führte, die
 * es in den Regeln nicht gab — nur in die andere Richtung.
 *
 * Geprüft wird jede Sache gegen drei Dinge, und **jedes** davon muss stimmen:
 *
 *  1. Sie wird am Tag ihrer Freischaltung gemeldet (`alertsFor`).
 *  2. Sie hat einen Erklärtext hinter dem Fragezeichen (`explain.*`).
 *  3. Sie hat einen deutschen Namen — sonst meldet die Meldung einen rohen Schlüssel.
 *
 * ⚠ **Was der Wächter nicht prüft:** ob die Erklärung *gut* ist. Er zählt, dass sie da
 * ist und aus mehr als einem Wort besteht. Ob sie das Richtige sagt, entscheidet ein
 * Mensch — dafür steht im Playtest-Bogen eine Frage.
 */

const rules = {
  constants: JSON.parse(readFileSync(join(ROOT, 'data/rules/default/constants.json'), 'utf8')) as {
    ticksPerDay: number
  },
  buildings: JSON.parse(readFileSync(join(ROOT, 'data/rules/default/buildings.json'), 'utf8'))
    .buildings as Record<string, { availableFromDay: number }>,
  units: JSON.parse(readFileSync(join(ROOT, 'data/rules/default/units.json'), 'utf8')).units as Record<
    string,
    { availableFromDay: number }
  >,
} satisfies UnlockRules

/**
 * Sachen, die absichtlich **nicht** gemeldet werden.
 *
 * Sie muss begründet sein, nicht bloß vorhanden: eine Ausnahmeliste ohne Grund ist eine
 * Liste, auf die man Dinge schiebt, statt sie zu erledigen. Heute ist sie leer — jede der
 * siebzehn Sachen wird gemeldet.
 */
const NICHT_GEMELDET: Readonly<Record<string, string>> = {}

/** Jede Sache mit einem Freischaltungstag, mit ihrer Art und ihrem Tag. */
function freischaltungen(): { key: string; art: 'buildings' | 'units'; day: number }[] {
  return [
    ...Object.entries(rules.buildings).map(([key, rule]) => ({
      key,
      art: 'buildings' as const,
      day: rule.availableFromDay,
    })),
    ...Object.entries(rules.units).map(([key, rule]) => ({
      key,
      art: 'units' as const,
      day: rule.availableFromDay,
    })),
  ]
}

/** Die Sicht, wie sie am Morgen des genannten Spieltags aussähe. */
function viewAtDay(day: number): Parameters<typeof alertsFor>[0] {
  return {
    tick: (day - 1) * rules.constants.ticksPerDay,
    playerId: 'p1',
    provinces: [],
    battles: [],
    self: { shortages: [] },
  } as never
}

describe('R-TECH-02 Jede Freischaltung wird gemeldet und erklaert', () => {
  const alle = freischaltungen()

  it('findet ueberhaupt Freischaltungen — sonst prueft der Waechter das Nichts', () => {
    // Die Lehre vom 2026-09-05: "fuer jedes X gilt Y" ist wahr, wenn es kein X gibt.
    expect(alle.length).toBeGreaterThanOrEqual(15)
    expect(new Set(alle.map((x) => x.day)).size, 'alles am selben Tag frei?').toBeGreaterThan(5)
  })

  it('meldet jede Sache am Tag, an dem sie dazukommt', () => {
    const stumm = alle
      .filter(({ key }) => !(key in NICHT_GEMELDET))
      .filter(({ key, art, day }) => {
        const kind = art === 'buildings' ? 'building' : 'unit'
        return !alertsFor(viewAtDay(day), rules).some((alert) => alert.id === `unlock:${kind}:${key}`)
      })
      .map(({ key, art, day }) => `${art}.${key} (Tag ${day})`)

    expect(stumm, `wird an ihrem Tag nicht gemeldet: ${stumm.join(', ')}`).toEqual([])
  })

  it('erklaert jede Sache hinter dem Fragezeichen', () => {
    const ohne = alle
      .filter(({ key, art }) => !hasKey(`explain.${art}.${key}`))
      .map(({ key, art }) => `explain.${art}.${key}`)

    expect(ohne, `ohne Erklaerung: ${ohne.join(', ')}`).toEqual([])
  })

  it('gibt jeder Sache einen deutschen Namen', () => {
    // Sonst meldete die Meldung einen rohen Schluessel in eckigen Klammern — der
    // Mechanismus dafuer ist gebaut und geprueft, und genau deshalb faellt er auf.
    const ohne = alle.filter(({ key, art }) => !hasKey(`${art}.${key}`)).map(({ key, art }) => `${art}.${key}`)

    expect(ohne, `ohne Namen: ${ohne.join(', ')}`).toEqual([])
  })

  it('begruendet jede Ausnahme, statt sie nur aufzuzaehlen', () => {
    // Eine Liste ohne Gruende ist eine Liste, auf die man Dinge schiebt.
    for (const [key, grund] of Object.entries(NICHT_GEMELDET)) {
      expect(grund.length, `${key} steht ohne Begruendung auf der Ausnahmeliste`).toBeGreaterThan(30)
    }
  })

  it('meldet an einem Tag ohne Freischaltung nichts', () => {
    // Der Gegenbeweis: waere die Meldung von der Zahl unabhaengig, meldete sie immer.
    const leereTage = [6, 7, 12, 15].filter((day) => !alle.some((x) => x.day === day))
    expect(leereTage.length, 'kein Tag ohne Freischaltung zum Gegenpruefen').toBeGreaterThan(0)

    for (const day of leereTage) {
      const meldungen = alertsFor(viewAtDay(day), rules).filter((alert) => alert.kind === 'unlock')
      expect(meldungen, `Tag ${day} meldet eine Freischaltung, die es nicht gibt`).toEqual([])
    }
  })

  it('meldet nur am Anfang des Tages, nicht den ganzen Tag lang', () => {
    // Sonst stuende die Meldung vierundzwanzig Stunden in der Liste und verdraengte, was
    // gerade wirklich Aufmerksamkeit braucht.
    const day = alle[0]!.day
    const spaeter = {
      ...(viewAtDay(day) as { tick: number }),
      tick: (day - 1) * rules.constants.ticksPerDay + 20,
    } as never

    expect(alertsFor(spaeter, rules).filter((alert) => alert.kind === 'unlock')).toEqual([])
  })

  it('meldet keine Freischaltung, wenn die Regeln fehlen', () => {
    // `alertsFor` wird auch ohne Regeln gerufen (Tests, Vorschau) — dann faellt die
    // Freischaltungsmeldung weg statt zu raten. Die uebrigen Meldungen bleiben: sie
    // kommen aus der Sicht und brauchen die Regeln nicht.
    expect(alertsFor(viewAtDay(2)).filter((alert) => alert.kind === 'unlock')).toEqual([])
    expect(alertsFor(viewAtDay(2), rules).filter((alert) => alert.kind === 'unlock')).not.toEqual([])
  })
})

/**
 * Jeder Fuehrungsschritt sagt sein Wozu (T-M24-02, R-UI-18).
 *
 * Frage 50 des Abnahmebogens, ehrlich beantwortet: das *Was* war gefuehrt, das *Wozu*
 * fehlte. Jeder Schritt traegt deshalb hinter Titel und Text ein drittes Feld `why` in
 * der Sprachdatei — den Satz, der begruendet, WARUM der Schritt an dieser Stelle kommt
 * (warum die Kaserne vor der Infanterie, warum das Warten kein Fehler ist).
 *
 * Derselbe Bau wie oben: der Waechter ist heute gruen und faellt morgen — ein neuer
 * Schritt ohne Begruendung faellt sonst still aus der Anleitung.
 */
describe('R-UI-18 Jeder Fuehrungsschritt begruendet sich', () => {
  it('findet ueberhaupt Schritte — sonst prueft der Waechter das Nichts', () => {
    // Acht waren es bis T-M24-02; die Punktequellen und die Moralstrafe kamen dazu.
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(10)
  })

  it('traegt zu jedem Schritt ein Wozu hinter Titel und Text', () => {
    const ohne = TUTORIAL_STEPS.filter(({ id }) => !hasKey(`tutorial.steps.${id}.why`)).map(
      ({ id }) => id,
    )
    expect(ohne, `Schritte ohne Wozu: ${ohne.join(', ')}`).toEqual([])
  })

  it('begruendet mit einem Satz, nicht mit einem Wort', () => {
    // ⚠ Wie oben: ob der Satz das Richtige sagt, entscheidet ein Mensch. Gezaehlt wird
    // nur, dass er da ist und Laenge hat.
    const knapp = TUTORIAL_STEPS.filter(
      ({ id }) => hasKey(`tutorial.steps.${id}.why`) && t(`tutorial.steps.${id}.why`).length <= 30,
    ).map(({ id }) => id)
    expect(knapp, `zu knapp begruendet: ${knapp.join(', ')}`).toEqual([])
  })

  it('erklaert Punktequellen und Moralstrafe, bevor sie wirken', () => {
    const ids = TUTORIAL_STEPS.map((step) => step.id)
    // Die Punktequellen frueh: noch im Klickblock, vor dem ersten vollen Spieltag.
    expect(ids.indexOf('score'), 'kein Schritt erklaert die Punktequellen').toBeGreaterThanOrEqual(0)
    expect(ids.indexOf('score')).toBeLessThan(ids.indexOf('dayPassed'))
    // Die Moralstrafe als letzter Schritt: gezeigt, sobald die Klickschritte durch sind
    // (Tage vor dem fruehesten Eroberungszug), beendet erst von der Eroberung selbst.
    expect(ids[ids.length - 1], 'die Moralstrafe ist nicht der letzte Schritt').toBe('expansion')
    expect(TUTORIAL_STEPS[ids.length - 1]!.completesOn).toBe('provinceCaptured')
  })
})
