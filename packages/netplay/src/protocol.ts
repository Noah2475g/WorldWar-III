import type { Command, GameConfig, GameState, PlayerId } from '@worldwar/core'

/**
 * Was zwei Rechner einander sagen (T-M37-05, R-MP-03, D28.9, MEHRSPIELER.md §3.2).
 *
 * Sieben Arten, mehr braucht es nicht. Alle sind reines JSON und tragen ihre Fassung.
 *
 * **Dieses Paket kennt keine Leitung.** Kein Transport, kein Netzzugriff, keine Adresse —
 * und das ist Absicht und kein Versehen: dadurch bleibt der Wächter
 * `test/guards/no-network.test.ts` für *alles* scharf und bekommt später genau zwei
 * benannte Ausnahmen statt einer Lücke. Und der ganze schwierige Teil — Gleichschritt,
 * Reihenfolge, Prüfsummen, Pause — ist ein reines Paket, das ohne ein einziges Paket über
 * eine Leitung vollständig geprüft wird.
 *
 * **Unbekannte Arten werden verworfen und gemeldet, nie geraten.** Eine Nachricht, deren
 * Fassung nicht passt, beendet die Verbindung mit einer Erklärung, statt halb zu wirken:
 * eine halb verstandene Nachricht ist der kürzeste Weg zu zwei verschiedenen Welten.
 *
 * Die Namen der Arten sind deutsch, weil sie das **Vokabular des Protokolls** sind und so
 * im freigegebenen Bauplan stehen (MEHRSPIELER.md §3.2). Alles andere — Typen, Felder,
 * Funktionen — bleibt englisch wie im ganzen Haus.
 */

/**
 * Die Fassung, die dieses Paket spricht. Zwei Fassungen reden nicht miteinander.
 *
 * **2 seit dem 2026-09-24** (Formatstufe 4, M17). Die Nachricht `zustand` traegt einen ganzen
 * Spielstand; eine neue Formatstufe ist deshalb eine neue Fassung. Ein Bau der Stufe 3 prueft
 * einen uebertragenen Stand nur auf seine Pruefsumme, haette einen Stand der Stufe 4 angenommen
 * und waere nach dem Start auseinandergelaufen — erreichbar ist er nur ueber diese Zahl im
 * ersten `hallo` (Befund M17-4, `protocol.test.ts` fuehrt die Paare).
 */
export const PROTOCOL_VERSION = 2

/** Die sieben Arten, in der Reihenfolge, in der eine Partie sie sieht. */
export const MESSAGE_KINDS = ['hallo', 'willkommen', 'probe', 'befehle', 'pause', 'zustand', 'ende'] as const

export type MessageKind = (typeof MESSAGE_KINDS)[number]

/** Die vier Schritte einer Pause (MEHRSPIELER.md §3.5): Antrag, Zustimmung, Ablehnung, Fortsetzen. */
export const PAUSE_KINDS = ['antrag', 'ja', 'nein', 'weiter'] as const

export type PauseKind = (typeof PAUSE_KINDS)[number]

/** Warum eine Partie endet. */
export const END_REASONS = ['sieg', 'abbruch', 'auseinandergelaufen', 'fassungsstreit'] as const

export type EndReason = (typeof END_REASONS)[number]

interface Envelope {
  kind: MessageKind
  version: number
}

/** Gast zum Host: wer da ist und was er spielen möchte. */
export interface HelloMessage extends Envelope {
  kind: 'hallo'
  name: string
  nation: string
}

/** Host zum Gast: die Partiedefinition, der Platz, die Prüfsummen und der Probeauftrag. */
export interface WelcomeMessage extends Envelope {
  kind: 'willkommen'
  config: GameConfig
  /** Der Platz des Gastes in `playerOrder` — nicht „Gast", sondern die Kennung selbst. */
  seat: PlayerId
  rulesHash: string
  mapHash: string
  /** Wie viele Ticks die Determinismus-Probe rechnet (M38, T-M38-03). */
  probeTicks: number
  /**
   * Die feste Rate in Spielstunden je Sekunde (T-M39-02, R-MP-02/AK1, C-11).
   *
   * Sie steht **hier** und nicht in der Partiedefinition, weil weder Kern noch Zustand
   * eine Geschwindigkeit kennen — C-11 hat sie am 2026-09-04 dort verbannt, und
   * R-ARCH-04/AK2 haelt das gruen. Sie muss trotzdem mitreisen: sie ist das Einzige an
   * einer Partie zu zweit, was der Gast hinterher nicht mehr aendern kann, und
   * R-MP-02/AK1 verlangt, dass sie Teil der Einladung ist.
   */
  fixedSpeed: number
}

/** Beide: die Prüfsumme nach den Probeticks. */
export interface ProbeMessage extends Envelope {
  kind: 'probe'
  ticks: number
  hash: string
  /**
   * Die Prüfsumme des Standes, **von dem** die Probe losgerechnet hat (T-M39-06, R-MP-13).
   *
   * Ohne diese Zahl ist eine abweichende Probe mehrdeutig: zwei Seiten, die von
   * verschiedenen gespeicherten Ständen losrechnen, bekommen zwangsläufig verschiedene
   * Ergebnisse, ohne dass irgendetwas kaputt wäre. Mit ihr sind die beiden Fälle
   * unterscheidbar — gleicher Start und verschiedenes Ergebnis heißt „die Rechner rechnen
   * verschieden" (Abbruch), verschiedener Start heißt „verschiedene Stände" (übertragen).
   */
  fromHash: string
}

/**
 * Beide, je Tick genau eine — auch wenn sie leer ist.
 *
 * `hash` ist die Prüfsumme des zuletzt *gerechneten* Ticks, nicht die des Ticks in
 * `tick`: beide Seiten haben `tick - 1` hinter sich, wenn sie diese Nachricht schreiben.
 * Weichen die beiden Zahlen ab, laufen die Welten schon auseinander (T-M37-09).
 */
export interface CommandsMessage extends Envelope {
  kind: 'befehle'
  tick: number
  commands: Command[]
  hash: string
}

/** Beide: der Vertrag über das Anhalten (MEHRSPIELER.md §3.5). */
export interface PauseMessage extends Envelope {
  kind: 'pause'
  art: PauseKind
  /** Ab welchem Tick die Partie steht — an einem Tick, nicht an einem Augenblick. */
  abTick: number
}

/** Host zum Gast: der vollständige Spielstand, nur bei einer Wiederaufnahme (M39). */
export interface StateMessage extends Envelope {
  kind: 'zustand'
  state: GameState
}

/** Beide: Schluss, und warum. */
export interface EndMessage extends Envelope {
  kind: 'ende'
  reason: EndReason
  /** Der Tick, an dem es endete — bei einem Auseinanderlaufen der erste strittige. */
  tick: number
  /**
   * Bei `auseinandergelaufen`: die Prüfsummen beider Plätze, **je Platz benannt**.
   *
   * R-MP-04/AK1 verlangt, dass die Partie anhält **und beiden Spielern sagt**, ab welchem
   * Tick sie auseinanderlaufen. Wer es zuerst merkt, weiß beide Zahlen; ohne sie bekäme
   * die Gegenseite nur „es ist vorbei" und müsste raten. Benannt nach Platz und nicht als
   * „eigene/fremde", weil dieselbe Nachricht auf beiden Rechnern gelesen wird und sich die
   * Bedeutung von „eigen" dabei umdreht.
   */
  hashes?: Record<PlayerId, string>
}

export type NetMessage =
  | HelloMessage
  | WelcomeMessage
  | ProbeMessage
  | CommandsMessage
  | PauseMessage
  | StateMessage
  | EndMessage

/**
 * Das Ergebnis einer Prüfung. `reason` ist ein Satz für den Menschen, keine Kennung:
 * er landet in der Meldung, mit der die Verbindung endet.
 */
export type ParseResult = { ok: true; message: NetMessage } | { ok: false; reason: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

/** Ein Tick ist eine nicht-negative ganze Zahl — alles andere wäre eine andere Zeitrechnung. */
const isTick = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

function fail(reason: string): ParseResult {
  return { ok: false, reason }
}

/**
 * Sind das Befehle? Geprüft wird die **Form**, nicht die Zulässigkeit.
 *
 * Ob ein Befehl im Spiel erlaubt ist, entscheidet `canApply` im Kern — und zwar auf
 * beiden Seiten gleich, aus demselben Zustand. Hier geht es nur darum, dass nichts
 * durchrutscht, was `step` gar nicht lesen kann.
 */
function areCommands(value: unknown): value is Command[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry) && isString(entry['type']) && isString(entry['playerId']))
  )
}

/**
 * Eine Nachricht prüfen — und bei Zweifel ablehnen, nie raten.
 *
 * Die Richtung des Fehlers ist gewählt: lieber eine gültige Nachricht abweisen und die
 * Verbindung mit einer Erklärung beenden, als eine halb verstandene anwenden. Zwei
 * Welten, die auseinanderlaufen, sind schlimmer als ein Abbruch — hinterher kann niemand
 * mehr sagen, welche die richtige war.
 */
export function parseMessage(raw: unknown): ParseResult {
  if (!isRecord(raw)) return fail('Die Nachricht ist kein Objekt.')

  const kind = raw['kind']
  if (!isString(kind) || !(MESSAGE_KINDS as readonly string[]).includes(kind)) {
    return fail(`Unbekannte Nachrichtenart: ${JSON.stringify(kind)}.`)
  }

  const version = raw['version']
  if (version !== PROTOCOL_VERSION) {
    return fail(
      `Fremde Protokollfassung: ${JSON.stringify(version)} statt ${PROTOCOL_VERSION}. ` +
        'Verschiedene Fassungen reden nicht miteinander.',
    )
  }

  switch (kind as MessageKind) {
    case 'hallo':
      if (!isString(raw['name']) || !isString(raw['nation'])) return fail('hallo braucht Name und Nation.')
      return { ok: true, message: raw as unknown as HelloMessage }

    case 'willkommen':
      if (!isRecord(raw['config'])) return fail('willkommen braucht eine Partiedefinition.')
      if (!isString(raw['seat'])) return fail('willkommen braucht einen Platz.')
      if (!isString(raw['rulesHash']) || !isString(raw['mapHash'])) {
        return fail('willkommen braucht die Pruefsummen von Regelwerk und Karte.')
      }
      if (!isTick(raw['probeTicks'])) return fail('willkommen braucht die Zahl der Probeticks.')
      // Eine Rate, die keine ist, waere schlimmer als keine: der Gast saehe eine Zahl,
      // an die er sich nicht halten kann.
      if (typeof raw['fixedSpeed'] !== 'number' || !Number.isFinite(raw['fixedSpeed']) || raw['fixedSpeed'] <= 0) {
        return fail('willkommen braucht die feste Geschwindigkeit der Partie.')
      }
      return { ok: true, message: raw as unknown as WelcomeMessage }

    case 'probe':
      if (!isTick(raw['ticks']) || !isString(raw['hash'])) return fail('probe braucht Tickzahl und Pruefsumme.')
      // Ohne den Startabdruck waere eine abweichende Probe mehrdeutig (T-M39-06).
      if (!isString(raw['fromHash'])) return fail('probe braucht die Pruefsumme des Startstandes.')
      return { ok: true, message: raw as unknown as ProbeMessage }

    case 'befehle':
      if (!isTick(raw['tick'])) return fail('befehle braucht einen Tick.')
      if (!areCommands(raw['commands'])) return fail('befehle braucht eine Liste von Befehlen.')
      if (!isString(raw['hash'])) return fail('befehle braucht die Pruefsumme des letzten Ticks.')
      return { ok: true, message: raw as unknown as CommandsMessage }

    case 'pause':
      if (!isString(raw['art']) || !(PAUSE_KINDS as readonly string[]).includes(raw['art'])) {
        return fail(`Unbekannte Pausenart: ${JSON.stringify(raw['art'])}.`)
      }
      if (!isTick(raw['abTick'])) return fail('pause braucht den Tick, ab dem sie gilt.')
      return { ok: true, message: raw as unknown as PauseMessage }

    case 'zustand':
      if (!isRecord(raw['state']) || !isTick((raw['state'] as Record<string, unknown>)['tick'])) {
        return fail('zustand braucht einen Spielstand mit Tick.')
      }
      return { ok: true, message: raw as unknown as StateMessage }

    case 'ende':
      if (!isString(raw['reason']) || !(END_REASONS as readonly string[]).includes(raw['reason'])) {
        return fail(`Unbekannter Grund fuer das Ende: ${JSON.stringify(raw['reason'])}.`)
      }
      if (!isTick(raw['tick'])) return fail('ende braucht den Tick, an dem es endete.')
      if (raw['hashes'] !== undefined) {
        const hashes = raw['hashes']
        if (!isRecord(hashes) || !Object.values(hashes).every(isString)) {
          return fail('ende traegt Pruefsummen, die keine sind.')
        }
      }
      return { ok: true, message: raw as unknown as EndMessage }
  }
}

/** Eine Nachricht als Text. Reines JSON — mehr braucht das Protokoll nicht. */
export function encodeMessage(message: NetMessage): string {
  return JSON.stringify(message)
}

/**
 * Text zurück in eine Nachricht. Kaputtes JSON ist dasselbe wie eine unbekannte Art:
 * verworfen und gemeldet.
 */
export function decodeMessage(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('Die Nachricht ist kein gueltiges JSON.')
  }
  return parseMessage(raw)
}

/** Den Umschlag einmal ausfüllen, damit keine Stelle die Fassung vergisst. */
export function envelope<K extends MessageKind>(kind: K): { kind: K; version: number } {
  return { kind, version: PROTOCOL_VERSION }
}
