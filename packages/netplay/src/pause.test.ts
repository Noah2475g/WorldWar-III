import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { createLockstep, stateHash, type Lockstep } from './lockstep'
import { NO_PAUSE, PAUSE_REQUEST_TIMEOUT_MS, RESUME_LEAD_MS, isPausedAt, remainingRequestMs } from './pause'

/**
 * Die Pause auf Antrag und Zustimmung (T-M37-10, R-MP-05, D28.7, MEHRSPIELER.md §3.5).
 *
 * Noahs Regel vom 2026-09-12: kein einseitiges Anhalten, aber auch kein Einsperren. Der
 * Block prüft alle drei Kriterien am laufenden Gleichschritt und nicht an der Mechanik
 * allein — ein Antrag, der „nichts anhält", ist nur dann etwas wert, wenn die Uhr dabei
 * nachweislich weiterläuft.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const config: GameConfig = {
  seed: 1912,
  mapId: map.id,
  rulesId: TEST_RULES.id,
  players: [
    { name: 'Nordland', kind: 'human', nation: 'Nordland', color: 'farbe-eins' },
    { name: 'Ostmark', kind: 'human', nation: 'Ostmark', color: 'farbe-zwei' },
    { name: 'Sueden', kind: 'ai', nation: 'Sueden', color: 'farbe-drei', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

function frisch(): GameState {
  const state = createInitialState(config, ctx)
  placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 6000 }] })
  placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 6000 }] })
  return state
}

const paar = () => ({
  a: createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 }),
  b: createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: frisch(), ctx, delayTicks: 2 }),
})

/** Ein Tick, so weit der Gleichschritt ihn zulässt. Gibt zurück, ob gerechnet wurde. */
function tick(a: Lockstep, b: Lockstep): boolean {
  const vonA = a.emit()
  const vonB = b.emit()
  a.receive('p2', vonB)
  b.receive('p1', vonA)
  const links = a.step()
  const rechts = b.step()
  return links.ran && rechts.ran
}

describe('R-MP-05/AK1 Ein Antrag allein haelt nichts an', () => {
  it('laesst die Partie weiterlaufen, solange niemand zugestimmt hat', () => {
    const { a, b } = paar()
    const antrag = a.requestPause(1000)
    b.receivePause('p1', antrag, 1000)

    expect(a.pause.pausedFrom).toBeNull()
    expect(b.pause.pausedFrom).toBeNull()
    expect(b.pause.request?.by).toBe('p1')
    expect(b.pause.notice).toBe('requested')

    // Und die Uhr laeuft wirklich weiter — nicht nur laut Feld.
    for (let i = 0; i < 4; i += 1) expect(tick(a, b), `Tick ${i}`).toBe(true)
    expect(a.tick).toBe(4)
    expect(a.status).toBe('waiting')
  })

  it('laeuft nach einer Ablehnung weiter, und der Antrag ist weg', () => {
    const { a, b } = paar()
    const antrag = a.requestPause(0)
    b.receivePause('p1', antrag, 0)

    const nein = b.answerPause(false, 10)
    a.receivePause('p2', nein, 10)

    expect(a.pause.request).toBeNull()
    expect(b.pause.request).toBeNull()
    expect(a.pause.notice).toBe('declined')
    for (let i = 0; i < 5; i += 1) expect(tick(a, b)).toBe(true)
    expect(a.tick).toBe(5)
  })
})

describe('R-MP-05/AK2 Nach der Zustimmung stehen beide Uhren beim selben Tick', () => {
  it('haelt beide Maschinen bei demselben Tick an', () => {
    const { a, b } = paar()
    // Zwei Ticks im Gleichschritt, damit der Halt nicht zufaellig auf den Start faellt.
    tick(a, b)
    tick(a, b)

    const antrag = a.requestPause(0)
    b.receivePause('p1', antrag, 0)
    const ja = b.answerPause(true, 500)
    a.receivePause('p2', ja, 500)

    const haltBei = a.pause.pausedFrom
    expect(haltBei, 'die Pause haengt an keinem Tick').not.toBeNull()
    expect(b.pause.pausedFrom).toBe(haltBei)
    expect(haltBei).toBe(2 + 2)

    // Bis dahin laeuft sie noch: der Antrag galt ab tick + 2.
    expect(tick(a, b)).toBe(true)
    expect(tick(a, b)).toBe(true)
    expect(a.tick).toBe(haltBei)

    // Und ab dem verabredeten Tick steht sie — auf beiden Rechnern.
    expect(tick(a, b)).toBe(false)
    expect(a.tick).toBe(haltBei)
    expect(b.tick).toBe(haltBei)
    expect(a.status).toBe('paused')
    expect(b.status).toBe('paused')
    expect(stateHash(a.state)).toBe(stateHash(b.state))
  })

  it('haelt auch dann beim selben Tick, wenn eine Seite den Antrag nie gesehen hat', () => {
    // Die Zustimmung traegt den Tick des Antrags mit sich. Ginge sie stattdessen vom
    // lokalen Gedaechtnis aus, staende der eine bei 500 und der andere bei 502 — genau
    // der Fall, vor dem D28.7 warnt.
    const { a, b } = paar()
    tick(a, b)
    const antrag = a.requestPause(0)
    // b bekommt den Antrag nicht; die Zustimmung kommt trotzdem (etwa nach einem Hakeln).
    const ja = { ...antrag, art: 'ja' as const }
    a.receivePause('p2', ja, 100)
    b.receivePause('p1', ja, 100)

    expect(a.pause.pausedFrom).toBe(b.pause.pausedFrom)
    expect(a.pause.pausedFrom).toBe(1 + 2)
  })

  it('verschiebt den Halt, wenn die Zustimmung spaeter kommt als der Antrag galt', () => {
    // Zwischen Antrag und Zustimmung vergeht Bedenkzeit, und in der Zeit laeuft die
    // Partie weiter. Wer bei Tick 0 einen Halt ab 2 beantragt und erst bei Tick 6 eine
    // Zustimmung bekommt, muesste rueckwaerts anhalten — die Zusage AK2 waere gerissen.
    const { a, b } = paar()
    const antrag = a.requestPause(0)
    b.receivePause('p1', antrag, 0)
    expect(b.pause.request?.fromTick).toBe(2)

    // Sechs Ticks Bedenkzeit.
    for (let i = 0; i < 6; i += 1) expect(tick(a, b)).toBe(true)
    const ja = b.answerPause(true, 1_000)
    a.receivePause('p2', ja, 1_000)

    expect(ja.abTick, 'der Halt liegt in der Vergangenheit').toBeGreaterThan(a.tick)
    expect(a.pause.pausedFrom).toBe(b.pause.pausedFrom)
    while (tick(a, b)) {
      /* bis zum Halt */
    }
    expect(a.tick).toBe(b.tick)
    expect(a.tick).toBe(ja.abTick)
  })

  it('setzt einseitig fort, mit drei Sekunden Vorlauf', () => {
    // Die Asymmetrie ist Absicht: verlangte auch das Fortsetzen eine Zustimmung, koennte
    // ein abgelenkter Mitspieler die Partie einsperren (D28.7).
    const { a, b } = paar()
    const antrag = a.requestPause(0)
    b.receivePause('p1', antrag, 0)
    const ja = b.answerPause(true, 10)
    a.receivePause('p2', ja, 10)
    while (tick(a, b)) {
      /* bis zum verabredeten Halt */
    }
    expect(a.status).toBe('paused')

    const weiter = b.resume(60_000)
    a.receivePause('p2', weiter, 60_000)

    expect(a.pause.notice).toBe('resuming')
    expect(a.pause.resumeAt).toBe(60_000 + RESUME_LEAD_MS)
    // Vor Ablauf des Vorlaufs steht sie noch.
    a.pollClock(60_000 + RESUME_LEAD_MS - 1)
    b.pollClock(60_000 + RESUME_LEAD_MS - 1)
    expect(tick(a, b)).toBe(false)

    a.pollClock(60_000 + RESUME_LEAD_MS)
    b.pollClock(60_000 + RESUME_LEAD_MS)
    expect(a.pause.pausedFrom).toBeNull()
    expect(a.pause.notice).toBe('resumed')
    expect(tick(a, b)).toBe(true)
  })
})

describe('R-MP-05/AK3 Ein Antrag ohne Antwort verfaellt nach dreissig Sekunden', () => {
  it('faellt auf beiden Rechnern von selbst, und beide erfahren es', () => {
    const { a, b } = paar()
    const antrag = a.requestPause(5_000)
    b.receivePause('p1', antrag, 5_000)

    // Kurz davor gilt er noch.
    expect(a.pollClock(5_000 + PAUSE_REQUEST_TIMEOUT_MS - 1).request).not.toBeNull()
    expect(b.pollClock(5_000 + PAUSE_REQUEST_TIMEOUT_MS - 1).request).not.toBeNull()

    const nachher = 5_000 + PAUSE_REQUEST_TIMEOUT_MS
    expect(a.pollClock(nachher).request).toBeNull()
    expect(b.pollClock(nachher).request).toBeNull()
    expect(a.pause.notice).toBe('expired')
    expect(b.pause.notice).toBe('expired')
    // Verfallen heisst laufen, nicht stehen.
    expect(a.pause.pausedFrom).toBeNull()
    expect(tick(a, b)).toBe(true)
  })

  it('sagt, wie lange er noch gilt', () => {
    const { a } = paar()
    a.requestPause(1_000)

    expect(remainingRequestMs(a.pause, 1_000)).toBe(PAUSE_REQUEST_TIMEOUT_MS)
    expect(remainingRequestMs(a.pause, 1_000 + 10_000)).toBe(PAUSE_REQUEST_TIMEOUT_MS - 10_000)
    expect(remainingRequestMs(a.pause, 1_000 + PAUSE_REQUEST_TIMEOUT_MS + 5)).toBe(0)
    expect(remainingRequestMs(NO_PAUSE, 0)).toBeNull()
  })

  it('verfaellt nicht, wenn er schon beantwortet wurde', () => {
    const { a, b } = paar()
    const antrag = a.requestPause(0)
    b.receivePause('p1', antrag, 0)
    const ja = b.answerPause(true, 100)
    a.receivePause('p2', ja, 100)

    a.pollClock(PAUSE_REQUEST_TIMEOUT_MS * 2)

    expect(a.pause.notice).toBe('accepted')
    expect(a.pause.pausedFrom).not.toBeNull()
  })
})

describe('R-MP-05/AK1 Die reine Mechanik, ohne Maschine daneben', () => {
  it('haelt erst ab dem verabredeten Tick', () => {
    const steht = { ...NO_PAUSE, pausedFrom: 10 }
    expect(isPausedAt(steht, 9)).toBe(false)
    expect(isPausedAt(steht, 10)).toBe(true)
    expect(isPausedAt(steht, 11)).toBe(true)
    expect(isPausedAt(NO_PAUSE, 10)).toBe(false)
  })

  it('laesst eine Uhr ohne Antrag und ohne Fortsetzen in Ruhe', () => {
    // Ein `pollClock` ohne offenen Vorgang darf nichts anfassen — sonst waere es eine
    // zweite Stelle, an der sich der Zustand aendert.
    const { a } = paar()
    expect(a.pollClock(999_999)).toEqual(NO_PAUSE)
  })
})
