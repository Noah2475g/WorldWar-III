import { t } from '../i18n/text.ts'

/**
 * The five steps of a first game (T-M12-02b).
 *
 * A guided start, and three rules about it that matter more than the content:
 *
 *  - It never blocks input. A step is a hint beside the game, not a door in front of
 *    it. A player who wants to ignore it plays on and the hint gets out of the way.
 *  - It appears only in the first game, and remembers that it did.
 *  - It can be switched off in the middle, and stays off.
 *
 * A tutorial that fails any of those is a tutorial people resent, and this game's whole
 * premise is not wasting the player's time.
 */

/**
 * Woran ein Schritt endet (T-M21-02).
 *
 * Bis zum 2026-09-07 waren es fuenf **Oberflaechen**ereignisse: Provinz angeklickt,
 * Bauleiste geoeffnet, Tempo gesetzt, vorgespult, Protokoll geoeffnet. Die Fuehrung
 * erklaerte damit die Knopfleiste und nicht das Spiel — sie war durch, bevor der erste
 * Spieltag vorbei war, und schwieg genau dann, wenn zum ersten Mal etwas geschieht.
 *
 * Dazu kommt jetzt, was das **Spiel** meldet, und die **Zeit**. Beide Sorten stehen
 * absichtlich in einer Aufzaehlung: fuer die Fuehrung ist "der Spieler hat gebaut" und
 * "der Bau ist fertig" derselbe Anlass, weiterzugehen.
 */
export type TutorialTrigger =
  // Was der Spieler tut.
  | 'selectProvince'
  | 'openBuild'
  | 'setSpeed'
  | 'openStandings'
  | 'fastForward'
  | 'openEvents'
  // Was das Spiel meldet.
  | 'buildCompleted'
  | 'unitRecruited'
  | 'provinceCaptured'
  // Und was die Uhr tut.
  | 'dayPassed'

export interface TutorialStep {
  /**
   * Die Kennung — und zugleich der Pfad zu den Texten: `tutorial.steps.<id>.title`,
   * `.text` und seit T-M24-02 `.why` (T-M21-01, T-M21-03).
   *
   * Das `why`-Feld ist die Antwort auf Frage 50 des Abnahmebogens: das *Was* war
   * gefuehrt, das *Wozu* fehlte. Jeder Schritt traegt in der Sprachdatei einen dritten
   * Satz, der ihn begruendet — warum die Kaserne vor der Infanterie kommt, warum das
   * Warten kein Fehler ist. Der Waechter `test/guards/unlocks-explained.test.ts`
   * verlangt ihn fuer jeden Schritt.
   *
   * Der Schritt traegt seinen Text nicht mehr selbst. Das war bis T-M21-03 so und ging
   * gut, solange kein Text eine Zahl brauchte: `TUTORIAL_STEPS` ist eine Konstante, wird
   * beim Laden des Moduls ausgewertet und kennt die Regeln des laufenden Spiels nicht.
   * Ein Satz wie „bis dahin vergehen 43 Stunden" laesst sich dort nicht bilden, ohne die
   * Zahl hineinzuschreiben — und dann stuende sie an zwei Orten.
   */
  id: string
  /** What the player has to do — or what has to happen — for the step to complete. */
  completesOn: TutorialTrigger
}

/**
 * Welches Spielereignis welchen Schritt beendet.
 *
 * Der Tagesbericht ist der Anlass fuer "ein Spieltag ist vorbei": er entsteht am Tagesende
 * und landet seit T-M12-09 auch wirklich im Protokoll. Vor dieser Reparatur waere ein
 * Schritt, der auf ihn wartet, **nie** weitergegangen — der Test unten haelt das fest,
 * damit die Fuehrung nicht still stehenbleibt, falls jemand die Kette wieder loest.
 */
const AUSLOESER: Readonly<Record<string, TutorialTrigger>> = {
  BUILD_COMPLETED: 'buildCompleted',
  UNIT_RECRUITED: 'unitRecruited',
  PROVINCE_CAPTURED: 'provinceCaptured',
  DAY_REPORT: 'dayPassed',
}

/** Der Ausloeser zu einem Ereignistyp, oder null — die meisten Ereignisse fuehren nicht. */
export function triggerFor(eventType: string): TutorialTrigger | null {
  return AUSLOESER[eventType] ?? null
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'select', completesOn: 'selectProvince' },
  { id: 'build', completesOn: 'openBuild' },
  { id: 'speed', completesOn: 'setSpeed' },
  // Das Wozu, BEVOR es wirkt (T-M24-02): die Bevoelkerung stellt fast alle Startpunkte,
  // eine Eroberung wiegt hunderte Bauwerke — wer das nicht weiss, investiert die ersten
  // Tage in das Falsche. Deshalb noch im Klickblock, vor dem ersten vollen Spieltag;
  // der Schritt endet, wenn die Lage der Maechte offen ist, denn dort stehen die
  // Punkte, von denen er spricht.
  { id: 'score', completesOn: 'openStandings' },
  // Ab hier fuehrt das Spiel, nicht die Knopfleiste (T-M21-02). Die Reihenfolge folgt
  // dem, was ein neuer Spieler tatsaechlich erlebt: erst laeuft die Uhr, dann steht das
  // Gebaeude, dann marschiert die erste Einheit.
  { id: 'dayPassed', completesOn: 'dayPassed' },
  { id: 'buildCompleted', completesOn: 'buildCompleted' },
  { id: 'unitRecruited', completesOn: 'unitRecruited' },
  { id: 'fastForward', completesOn: 'fastForward' },
  { id: 'events', completesOn: 'openEvents' },
  // Der Schlussstein (T-M24-02): ab der dritten Provinz kostet jede weitere Zielmoral
  // in allen Provinzen (morale.ts, expansionPenaltyPerProvince) — unerklaert war das
  // die tueckischste Regel des Spiels. Als letzter Schritt steht die Warnung, sobald
  // die Schritte davor durch sind — Tage vor dem fruehesten Eroberungszug —, und sie
  // bleibt stehen, bis die erste Eroberung sie einloest. Ein Spieler, der nie erobert,
  // behaelt den Hinweis; das ist Absicht, und der Knopf daneben schaltet ihn ab.
  { id: 'expansion', completesOn: 'provinceCaptured' },
]

export interface TutorialState {
  /** Index of the current step, or null when the tutorial is done or switched off. */
  step: number | null
  /** Set once the player has finished or dismissed it — it never comes back. */
  seen: boolean
}

export const TUTORIAL_START: TutorialState = { step: 0, seen: false }
export const TUTORIAL_OFF: TutorialState = { step: null, seen: true }

/** What a fresh installation gets: the tutorial on. A returning player: nothing. */
export function initialTutorial(seenBefore: boolean): TutorialState {
  return seenBefore ? TUTORIAL_OFF : TUTORIAL_START
}

/** Advances the tutorial when the player does the thing the current step asks for. */
export function advance(state: TutorialState, action: TutorialTrigger): TutorialState {
  if (state.step === null) return state

  const current = TUTORIAL_STEPS[state.step]
  if (!current || current.completesOn !== action) return state

  const next = state.step + 1
  return next >= TUTORIAL_STEPS.length ? { step: null, seen: true } : { step: next, seen: false }
}

/** Switched off in the middle — and it stays off. */
export function dismiss(): TutorialState {
  return TUTORIAL_OFF
}

export function currentStep(state: TutorialState): TutorialStep | null {
  return state.step === null ? null : (TUTORIAL_STEPS[state.step] ?? null)
}

/** Progress as "Schritt 2 von 5", so the player knows how much is left. */
export function progressLabel(state: TutorialState): string {
  if (state.step === null) return ''
  return t('tutorial.progress', { step: state.step + 1, total: TUTORIAL_STEPS.length })
}

/** Where the tutorial's memory lives. */
export const TUTORIAL_STORAGE_KEY = 'worldwar.tutorial.seen'

export function tutorialTitle(): string {
  return t('app.title')
}

export interface AdvanceResult {
  state: TutorialState
  /**
   * Wie viele Ereignisse verbraucht sind. Der Aufrufer merkt sich die Zahl und setzt beim
   * naechsten Mal dort fort — verbraucht ist auch, was zu keinem Schritt gehoerte.
   */
  consumed: number
}

/**
 * Hoechstens **ein** Schritt je Aufruf (T-M21-02).
 *
 * Ein Tick kann mehrere Meldungen zugleich bringen — die Kaserne wird fertig, der Tag
 * geht zu Ende, eine Einheit ruecken ein. Wuerde die Fuehrung alle davon abarbeiten,
 * zeigte sie einen Schritt und schoebe ihn im selben Bild weg: der Spieler saehe einen
 * Text aufblitzen, den er nicht lesen konnte, und die Fuehrung waere nach einem Tick
 * durch.
 *
 * Verloren geht dabei nichts. Der Aufrufer ruecke seinen Merker nur bis \`consumed\` vor,
 * und das restliche Ereignis wird beim naechsten Durchlauf angeboten — das ist der
 * Unterschied zwischen "einer je Bild" und "die anderen fallen weg".
 */
export function advanceOnce(
  state: TutorialState,
  eventTypes: readonly string[],
): AdvanceResult {
  for (let i = 0; i < eventTypes.length; i++) {
    const trigger = triggerFor(eventTypes[i]!)
    if (!trigger) continue

    const next = advance(state, trigger)
    if (next !== state) return { state: next, consumed: i + 1 }
  }
  // Nichts davon passte: alles ist gesehen und nichts bleibt liegen.
  return { state, consumed: eventTypes.length }
}
