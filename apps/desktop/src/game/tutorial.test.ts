import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { createInitialState, step, type GameConfig } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import {
  TUTORIAL_OFF,
  TUTORIAL_START,
  TUTORIAL_STEPS,
  advance,
  currentStep,
  dismiss,
  initialTutorial,
  progressLabel,
  advanceOnce,
  triggerFor,
  type TutorialState,
} from './tutorial.ts'

/**
 * The guided start (T-M12-02b).
 *
 * The content matters less than the three promises: it never blocks input, it appears
 * only in a first game, and switching it off makes it stay off. A tutorial that breaks
 * any of them is one people resent — and this game's whole premise is not wasting the
 * player's time.
 */

describe('R-UI-05 Einstiegshilfe', () => {
  it('fuehrt durch acht Schritte, und jeder sagt etwas', () => {
    // Fuenf waren es bis T-M21-02; drei folgen seither dem Spiel statt der Knopfleiste.
    expect(TUTORIAL_STEPS).toHaveLength(8)
    for (const step of TUTORIAL_STEPS) {
      expect(step.text.length, step.id).toBeGreaterThan(40)
      expect(step.title.length, step.id).toBeGreaterThan(3)
    }
  })

  it('zeigt sich nur in der ersten Partie', () => {
    expect(initialTutorial(false)).toEqual(TUTORIAL_START)
    expect(initialTutorial(true)).toEqual(TUTORIAL_OFF)
  })

  it('geht weiter, wenn der Spieler tut, worum der Schritt bittet', () => {
    const after = advance(TUTORIAL_START, 'selectProvince')

    expect(after.step).toBe(1)
    expect(currentStep(after)?.id).toBe('build')
  })

  it('geht bei einer anderen Handlung nicht weiter', () => {
    // And above all does not get in the way: the player is free to do something else.
    expect(advance(TUTORIAL_START, 'fastForward')).toEqual(TUTORIAL_START)
  })

  it('ist nach dem letzten Schritt vorbei und kommt nicht wieder', () => {
    let state = TUTORIAL_START
    for (const step of TUTORIAL_STEPS) state = advance(state, step.completesOn)

    expect(state.step).toBeNull()
    expect(state.seen).toBe(true)
    expect(currentStep(state)).toBeNull()
  })

  it('laesst sich mittendrin abschalten und bleibt aus', () => {
    const off = dismiss()

    expect(off.seen).toBe(true)
    expect(currentStep(off)).toBeNull()
    // And a later action does not bring it back.
    expect(advance(off, 'selectProvince')).toEqual(off)
  })

  it('sagt, wie viel noch kommt', () => {
    expect(progressLabel(TUTORIAL_START)).toBe('Schritt 1 von 8')
    expect(progressLabel(advance(TUTORIAL_START, 'selectProvince'))).toBe('Schritt 2 von 8')
    expect(progressLabel(TUTORIAL_OFF)).toBe('')
  })
})

describe('R-UI-05 Die Fuehrung folgt dem Spiel, nicht der Knopfleiste (T-M21-02)', () => {
  /**
   * Der Test, den die Aufgabe verlangt: **eine echte Partie**, so weit geführt, dass ein
   * Schritt durch ein Spielereignis endet — nicht durch einen Klick.
   *
   * Ohne ihn wäre die Verdrahtung eine Behauptung. Der Kern könnte den Tagesbericht gar
   * nicht ins Protokoll legen — bis T-M12-09 tat er das für die am Tagesende entstandenen
   * Ereignisse nicht —, und ein Schritt, der auf ihn wartet, wäre nie weitergegangen. Die
   * Führung stünde still, und zwar lautlos.
   */
  const ctx = { map: smallWorld(), rules: TEST_RULES }
  const config: GameConfig = {
    seed: 7,
    mapId: 'testworld',
    rulesId: 'default',
    players: [
      { name: 'A', kind: 'human', nation: 'Nordland', color: 'darkslategray' },
      { name: 'B', kind: 'ai', nation: 'Ostmark', color: 'rebeccapurple', difficulty: 'normal' },
    ],
    victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
  }

  /** Führt die Partie über so viele Ticks und gibt der Führung jedes Ereignis. */
  function spiele(ticks: number, start: TutorialState): { tutorial: TutorialState; typen: Set<string> } {
    let state = createInitialState(config, ctx)
    let tutorial = start
    const typen = new Set<string>()

    for (let i = 0; i < ticks; i++) {
      const result = step(state, [], ctx)
      state = result.state
      for (const event of result.events) {
        typen.add(event.type)
        const trigger = triggerFor(event.type)
        if (trigger) tutorial = advance(tutorial, trigger)
      }
    }
    return { tutorial, typen }
  }

  it('meldet den Tagesbericht ueberhaupt — sonst wartet ein Schritt fuer immer', () => {
    // Die Falle aus dem Bauplan, als eigene Prüfung: die Verdrahtung kann fehlerfrei sein
    // und trotzdem nie greifen, wenn das Ereignis das Protokoll nie erreicht.
    const { typen } = spiele(TEST_RULES.constants.ticksPerDay + 1, TUTORIAL_START)

    expect([...typen], 'kein DAY_REPORT in einem ganzen Spieltag').toContain('DAY_REPORT')
  })

  it('beendet den Wartschritt durch ein Spielereignis, nicht durch einen Klick', () => {
    // Die Führung steht auf dem Schritt, der auf den Tagesbericht wartet — erreicht über
    // die drei Oberflächenschritte davor, wie ein Spieler sie durchläuft.
    let start = TUTORIAL_START
    for (const klick of ['selectProvince', 'openBuild', 'setSpeed'] as const) start = advance(start, klick)
    expect(currentStep(start)?.id, 'der vierte Schritt wartet nicht auf den Tag').toBe('dayPassed')

    const { tutorial } = spiele(TEST_RULES.constants.ticksPerDay + 1, start)

    expect(currentStep(tutorial)?.id, 'der Tagesbericht hat den Schritt nicht beendet').not.toBe('dayPassed')
  })

  /** Die drei Klicks, mit denen ein Spieler bis zum ersten Wartschritt kommt. */
  const nachDenKlicks = (): TutorialState =>
    ['selectProvince', 'openBuild', 'setSpeed'].reduce(
      (state, klick) => advance(state, klick as never),
      TUTORIAL_START,
    )

  it('geht je Bild hoechstens einen Schritt weiter', () => {
    // Ein Tick kann mehreres zugleich melden. Würde die Führung alles abarbeiten, zeigte
    // sie einen Schritt und schöbe ihn im selben Bild weg — der Spieler sähe einen Text
    // aufblitzen, den er nicht lesen konnte, und die Führung wäre nach einem Tick durch.
    const start = nachDenKlicks()
    expect(currentStep(start)?.id).toBe('dayPassed')

    const einmal = advanceOnce(start, ['UNIT_RECRUITED', 'DAY_REPORT', 'BUILD_COMPLETED'])

    expect(currentStep(einmal.state)?.id, 'die Fuehrung ist durchgerauscht').toBe('buildCompleted')
  })

  it('laesst dabei kein Ereignis fallen', () => {
    // Der Unterschied zwischen „einer je Bild" und „die anderen fallen weg": verbraucht
    // ist nur, was bis zum auslösenden Ereignis lag.
    const strom = ['DAY_REPORT', 'BUILD_COMPLETED']

    const erst = advanceOnce(nachDenKlicks(), strom)
    expect(erst.consumed, 'der Bauabschluss ist mitverbraucht worden').toBe(1)

    const dann = advanceOnce(erst.state, strom.slice(erst.consumed))
    expect(currentStep(dann.state)?.id, 'der zweite Ausloeser kam nicht mehr an').toBe('unitRecruited')
  })

  it('verbraucht alles, wenn nichts davon passt', () => {
    // Sonst böte der Aufrufer denselben Strom endlos wieder an.
    const ergebnis = advanceOnce(TUTORIAL_START, ['BATTLE_STARTED', 'DAY_REPORT'])

    expect(ergebnis.state).toBe(TUTORIAL_START)
    expect(ergebnis.consumed).toBe(2)
  })

  it('ordnet jedem gefuehrten Ereignis genau einen Ausloeser zu', () => {
    expect(triggerFor('BUILD_COMPLETED')).toBe('buildCompleted')
    expect(triggerFor('UNIT_RECRUITED')).toBe('unitRecruited')
    expect(triggerFor('PROVINCE_CAPTURED')).toBe('provinceCaptured')
    expect(triggerFor('DAY_REPORT')).toBe('dayPassed')
    // Und alles andere fuehrt nicht — sonst waere jede Meldung ein Schritt.
    expect(triggerFor('BATTLE_STARTED')).toBeNull()
    expect(triggerFor('COMMAND_REJECTED')).toBeNull()
  })
})
