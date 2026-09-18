import { advanceTicks } from '@worldwar/ai'
import {
  SCHEMA_VERSION,
  createInitialState,
  type GameConfig,
  type GameState,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { stateHash } from './lockstep'
import {
  PROTOCOL_VERSION,
  envelope,
  parseMessage,
  type HelloMessage,
  type NetMessage,
  type ProbeMessage,
  type StateMessage,
  type WelcomeMessage,
} from './protocol'

/**
 * Der Handschlag vor dem ersten Zug (T-M38-02, R-MP-06, D28.6, MEHRSPIELER.md §3.4).
 *
 * Vier Prüfungen, bevor ein einziger Zug möglich ist: Protokollfassung, Regelprüfsumme,
 * Kartenprüfsumme, Determinismus-Probe. Die ersten drei stehen hier, die vierte in
 * `probe.ts`-Nachbarschaft weiter unten (T-M38-03).
 *
 * **Warum das vorn steht und nicht hinten.** Ein Gast mit anderen Zahlen rechnet ein
 * anderes Spiel. Das fällt ohne Handschlag nicht beim Verbinden auf, sondern beim ersten
 * Gefecht, das verschieden ausgeht — und dann ist eine Stunde Partie verloren und niemand
 * weiß, welche der beiden Welten die richtige war. Die vier Prüfungen kosten zusammen
 * rund fünfzig Millisekunden.
 *
 * **Die Prüfsummen entstehen über das GELADENE Regelwerk und die GELADENE Karte**, nicht
 * über Dateinamen oder Versionsnummern. Ein Name belegt nichts: zwei Rechner können
 * dieselbe `default`-Regelmappe meinen und verschiedene Zahlen darin haben — beim Gast
 * ein älterer Bau, beim Host ein Zwischenstand. `hashValue` liest die Werte selbst.
 */

/** Wovon zwei Seiten dasselbe haben müssen, bevor sie eine Partie beginnen. */
export interface Fingerprint {
  version: number
  rulesHash: string
  mapHash: string
}

/** Woran ein Handschlag scheitert. Der Grund wandert in die Meldung, mit der er endet. */
export type HandshakeFault = 'version' | 'rules' | 'map' | 'probe' | 'message'

export type HandshakeCheck =
  | { ok: true }
  | { ok: false; fault: HandshakeFault; reason: string }

/**
 * Der Abdruck dieser Seite: Fassung, Regelwerk, Karte.
 *
 * `hashValue` ist dasselbe Werkzeug, mit dem der Gleichschritt je Tick vergleicht — die
 * Schlüsselreihenfolge ist ihm egal, die Listenreihenfolge nicht. Für Regeln und Karte ist
 * genau das richtig: zwei Provinzen zu vertauschen ist eine andere Karte.
 */
export function fingerprintOf(rules: Rules, map: MapData): Fingerprint {
  return {
    version: PROTOCOL_VERSION,
    rulesHash: hashValue(rules),
    mapHash: hashValue(map),
  }
}

/**
 * Stimmen zwei Abdrücke überein? Die Reihenfolge der Prüfungen ist gewählt.
 *
 * Zuerst die Fassung: verschiedene Fassungen reden nicht miteinander, und alles, was
 * danach käme, wäre ein Vergleich von Feldern, die auf der Gegenseite etwas anderes
 * bedeuten könnten. Dann die Regeln, dann die Karte — in der Reihenfolge, in der ein
 * Unterschied wahrscheinlicher ist, damit die Meldung die nächstliegende Ursache nennt.
 */
export function compareFingerprints(own: Fingerprint, other: Fingerprint): HandshakeCheck {
  if (own.version !== other.version) {
    return {
      ok: false,
      fault: 'version',
      reason:
        `Verschiedene Protokollfassungen: diese Seite spricht ${own.version}, die andere ${other.version}. ` +
        'Verschiedene Fassungen reden nicht miteinander.',
    }
  }
  if (own.rulesHash !== other.rulesHash) {
    return {
      ok: false,
      fault: 'rules',
      reason:
        `Verschiedene Regelwerke: ${own.rulesHash} gegen ${other.rulesHash}. ` +
        'Ein Gast mit anderen Zahlen rechnet ein anderes Spiel.',
    }
  }
  if (own.mapHash !== other.mapHash) {
    return {
      ok: false,
      fault: 'map',
      reason:
        `Verschiedene Karten: ${own.mapHash} gegen ${other.mapHash}. ` +
        'Beide Seiten muessen aus demselben Bau stammen.',
    }
  }
  return { ok: true }
}

/** Was der Gast als Erstes sagt. */
export function hello(name: string, nation: string): HelloMessage {
  return { ...envelope('hallo'), name, nation }
}

/**
 * Was der Host zurückgibt: die Partiedefinition, der Platz, die Prüfsummen, der
 * Probeauftrag.
 *
 * Der **Platz** ist die Kennung selbst (`p1`, `p2`) und nicht „Gast": die Oberfläche
 * bezieht seit T-M37-01 alles auf einen `viewerId`, und eine zweite Übersetzung dazwischen
 * wäre eine zweite Stelle, an der sich die beiden Seiten uneinig werden können.
 */
export function welcome(
  config: GameConfig,
  seat: PlayerId,
  own: Fingerprint,
  probeTicks: number,
  fixedSpeed: number,
): WelcomeMessage {
  return {
    ...envelope('willkommen'),
    config,
    seat,
    rulesHash: own.rulesHash,
    mapHash: own.mapHash,
    probeTicks,
    // Die feste Rate reist mit, obwohl weder Kern noch Zustand sie kennen (C-11): sie ist
    // das Einzige, was der Gast hinterher nicht mehr aendern kann (R-MP-02/AK1).
    fixedSpeed,
  }
}

/** Der Abdruck, den eine Willkommensnachricht trägt — die Gegenseite des Vergleichs. */
export function fingerprintOfWelcome(message: WelcomeMessage): Fingerprint {
  return { version: message.version, rulesHash: message.rulesHash, mapHash: message.mapHash }
}

/**
 * Eine eingehende Nachricht annehmen — oder sie verwerfen und sagen, warum (R-MP-06/AK3).
 *
 * **Nie geraten.** Eine halb verstandene Nachricht ist der kürzeste Weg zu zwei
 * verschiedenen Welten: wer `befehle` ohne Prüfsumme durchlässt und die fehlende Zahl als
 * „passt schon" liest, merkt das Auseinanderlaufen erst Stunden später. Die Richtung des
 * Fehlers ist deshalb gewählt — lieber eine gültige Nachricht abweisen und die Verbindung
 * mit einer Erklärung beenden als eine ungültige anwenden.
 */
export function accept(raw: unknown): { ok: true; message: NetMessage } | { ok: false; fault: HandshakeFault; reason: string } {
  const result = parseMessage(raw)
  if (result.ok) return result
  // Eine fremde Fassung ist etwas anderes als eine kaputte Nachricht: das eine beendet die
  // Verbindung mit einer Erklaerung, das andere ist ein Fehler auf der Leitung.
  const fault: HandshakeFault = /Protokollfassung/.test(result.reason) ? 'version' : 'message'
  return { ok: false, fault, reason: result.reason }
}

/**
 * Die Determinismus-Probe vor dem ersten Zug (T-M38-03, R-MP-06/AK2, D28.6).
 *
 * **Die riskanteste Aufgabe des ganzen Mehrspielers** (MEHRSPIELER.md §5), und ihr ganzer
 * Inhalt ist eine Frage: rechnet die andere Maschine wirklich bitgleich? Die Antwort ist
 * mit hoher Wahrscheinlichkeit ja — der Kern rechnet ausschließlich in Ganzzahlen, und
 * deren Verhalten ist in JavaScript exakt festgelegt (`packages/shared/src/fixed.ts`, und
 * ESLint verbietet `*` und `/` im Kern). Aber „mit hoher Wahrscheinlichkeit" ist keine
 * Grundlage für einen Abend zu zweit, und die Frage stellt sich sonst erst nach zwei
 * Stunden, wenn ein Gefecht verschieden ausgeht.
 *
 * **Die Probe rechnet dieselbe Partie wie das Spiel**, nicht eine vereinfachte: derselbe
 * `createInitialState`, dasselbe `advanceTicks` samt Computergegnern. Eine Probe, die
 * einen anderen Weg nimmt als das Spiel, belegt den anderen Weg.
 *
 * **Ohne Befehle.** Sie läuft vor dem ersten Zug; es gibt noch keine. Genau das macht sie
 * vergleichbar: beide Seiten haben dieselbe Partiedefinition und sonst nichts.
 */

/**
 * Wie viele Ticks die Probe rechnet — ein Spieltag.
 *
 * Der Stellknopf, wenn sie je zu teuer wird (D28.6). Grundlage: ein Tick kostet auf der
 * Weltkarte 1,54 ms (gemessen 2026-09-12, sechs Mächte), 24 Ticks also rund 37 ms. Ein
 * Spieltag ist die kleinste Zahl, nach der jede Phase des Kerns mindestens einmal gelaufen
 * ist — Wirtschaft, Bau und Freischaltung hängen am Tageswechsel, nicht am Tick.
 */
export const PROBE_TICKS = 24

/** Was eine Seite aus ihrer Probe mitbringt. */
export interface ProbeOutcome {
  ticks: number
  hash: string
  /**
   * Die Prüfsumme des Standes, **von dem** gerechnet wurde (T-M39-06).
   *
   * Bei einer frischen Partie ist das der Startzustand aus der Partiedefinition, bei einer
   * Wiederaufnahme der gespeicherte Stand. Sie macht eine abweichende Probe eindeutig:
   * gleicher Start heißt „die Rechner rechnen verschieden", verschiedener Start heißt
   * „verschiedene Stände" (D28.11).
   */
  from: string
  /** Wie lange sie gedauert hat. Für die Messung, nicht für den Vergleich. */
  ms: number
}

/**
 * Die Probe rechnen: Startzustand aus der Partiedefinition, `ticks` Ticks ohne Befehle.
 *
 * `now` wird hereingereicht, damit die Dauer messbar bleibt, ohne dass diese Funktion die
 * Wanduhr liest — dieselbe Regel, nach der der Pausenvertrag gebaut ist (T-M37-10). Die
 * **Prüfsumme** hängt nicht daran: sie kommt aus `stateHash`, und `HASH_OMIT_KEYS` hält
 * alles heraus, was nur die Betrachtung betrifft.
 */
export function runProbe(
  config: GameConfig,
  ctx: { map: MapData; rules: Rules },
  ticks: number = PROBE_TICKS,
  now: () => number = () => Date.now(),
): ProbeOutcome {
  return runProbeFrom(createInitialState(config, ctx), ctx, ticks, now)
}

/**
 * Dieselbe Probe, aber von einem **gegebenen** Stand aus (T-M39-06, R-MP-13).
 *
 * Für die Wiederaufnahme: dort ist der Ausgangspunkt kein frisch erzeugter Zustand,
 * sondern ein gespeicherter. Dieselbe Rechnung, ein anderer Anfang — und der Anfang steht
 * als `from` in der Nachricht, damit ein Unterschied nicht für einen Rechenfehler gehalten
 * wird.
 */
export function runProbeFrom(
  state: GameState,
  ctx: { map: MapData; rules: Rules },
  ticks: number = PROBE_TICKS,
  now: () => number = () => Date.now(),
): ProbeOutcome {
  const begonnen = now()
  const from = stateHash(state)
  const result = advanceTicks(state, ticks, ctx, { scripted: () => [] })
  return { ticks: result.ticks, hash: stateHash(result.state), from, ms: now() - begonnen }
}

/** Das Ergebnis als Nachricht. */
export function probeMessage(outcome: ProbeOutcome): ProbeMessage {
  return { ...envelope('probe'), ticks: outcome.ticks, hash: outcome.hash, fromHash: outcome.from }
}

/**
 * Stimmen die beiden Proben überein? Bei Abweichung beginnt die Partie nicht.
 *
 * Auch die **Tickzahl** wird verglichen, nicht nur die Prüfsumme. Zwei Seiten, die
 * verschieden weit gerechnet haben, hätten ohnehin verschiedene Prüfsummen — aber die
 * Meldung „ihr rechnet verschieden" wäre dann falsch und schickte den Nächsten auf die
 * Suche nach einem Fehler im Kern, den es nicht gibt.
 */
export function compareProbe(own: ProbeOutcome, other: ProbeMessage): HandshakeCheck {
  if (own.ticks !== other.ticks) {
    return {
      ok: false,
      fault: 'probe',
      reason:
        `Die Proben sind verschieden lang: ${own.ticks} Ticks gegen ${other.ticks}. ` +
        'Verglichen wird nur, was gleich weit gerechnet ist.',
    }
  }
  if (own.hash !== other.hash) {
    return {
      ok: false,
      fault: 'probe',
      reason:
        `Nach ${own.ticks} Probeticks rechnen die beiden Rechner verschiedene Welten: ` +
        `${own.hash} gegen ${other.hash}. Die Partie beginnt nicht.`,
    }
  }
  return { ok: true }
}

/**
 * Alle vier Prüfungen in einer — das Tor, durch das eine Partie beginnt (R-MP-06).
 *
 * Fassung, Regelwerk, Karte, Probe. Ein `ok: false` heißt: es wird nicht gespielt, und der
 * Grund steht dabei. Ein einziger Ort dafür, weil eine Prüfung, die an drei Stellen
 * aufgerufen wird, an einer davon vergessen wird.
 */
export function handshakeComplete(
  own: Fingerprint,
  welcome: WelcomeMessage,
  ownProbe: ProbeOutcome,
  otherProbe: ProbeMessage,
): HandshakeCheck {
  const abdruck = compareFingerprints(own, fingerprintOfWelcome(welcome))
  if (!abdruck.ok) return abdruck
  return compareProbe(ownProbe, otherProbe)
}

/**
 * Speichern und Fortsetzen zu zweit (T-M39-06, R-MP-13, D28.11).
 *
 * Beide speichern lokal weiter, wie im Einzelspieler. Zum Fortsetzen eröffnet der Host
 * einen neuen Raum, und der Handschlag vergleicht die Stände: sind sie gleich, geht es
 * weiter; sind sie ungleich — der Gast hat einen älteren Stand oder gar keinen —, überträgt
 * der Host seinen, und **beide prüfen erneut**.
 *
 * ## Warum die Probe dafür einen Startabdruck bekommt
 *
 * Bis hierher trug `probe` zwei Zahlen: wie viele Ticks gerechnet wurden und was dabei
 * herauskam. Weichen zwei Prüfsummen ab, war der Schluss eindeutig — die Rechner rechnen
 * verschieden, und die Partie beginnt nicht. **Beim Fortsetzen ist derselbe Befund
 * mehrdeutig:** zwei Seiten, die von *verschiedenen Ständen* losrechnen, bekommen
 * zwangsläufig verschiedene Prüfsummen, ohne dass irgendetwas kaputt wäre.
 *
 * Die Probe nennt deshalb seit T-M39-06 auch den Stand, **von dem** sie losgerechnet hat.
 * Damit sind die beiden Fälle unterscheidbar, und zwar genau:
 *
 * | Startabdruck | Probenprüfsumme | Schluss |
 * |---|---|---|
 * | gleich | gleich | weiter — beide rechnen dasselbe aus demselben Stand |
 * | gleich | verschieden | **Abbruch**: dieselbe Ausgangslage, zwei Ergebnisse |
 * | verschieden | — | **Übertragen**: verschiedene Stände, kein Rechenfehler |
 *
 * Ohne diese Zeile müsste der Host raten, und die sichere Richtung wäre „immer
 * übertragen" — dann ginge bei *jeder* Partie ein Viertelmegabyte über die Leitung, und
 * die Zusage „übertragen werden Befehle, nie Zustände" (D28.2) hätte eine stille Ausnahme.
 */

/** Was eine Seite über den Stand sagt, mit dem sie anfangen will. */
export interface SavedGame {
  /** Die Spielstunde des Standes — zur Anzeige, nicht zum Vergleich. */
  tick: number
  /** Die Prüfsumme des Standes. **Das** ist der Vergleich. */
  hash: string
}

export function savedGameOf(state: GameState): SavedGame {
  return { tick: state.tick, hash: stateHash(state) }
}

/** Was aus zwei Startabdrücken folgt (R-MP-13/AK1). */
export type ResumeDecision =
  /** Beide haben denselben Stand — es geht weiter, und nichts geht über die Leitung. */
  | { kind: 'continue' }
  /** Verschiedene Stände: der Host überträgt seinen, und beide prüfen erneut. */
  | { kind: 'transfer'; reason: string }
  /** Derselbe Stand, zwei Ergebnisse. Das ist kein Fall für eine Übertragung. */
  | { kind: 'abort'; reason: string }

/**
 * Der Vergleich, aus der Sicht des Hosts.
 *
 * Die Reihenfolge der Prüfungen ist gewählt: **zuerst der Startabdruck.** Stimmen die
 * Stände nicht überein, sagt die Probenprüfsumme nichts — sie *muss* dann abweichen. Wer
 * andersherum prüfte, meldete bei jeder Wiederaufnahme „die Rechner rechnen verschieden"
 * und schickte den Nächsten auf die Suche nach einem Fehler im Kern, den es nicht gibt.
 */
export function resumeDecision(own: ProbeOutcome, other: ProbeMessage): ResumeDecision {
  if (other.fromHash !== own.from) {
    return {
      kind: 'transfer',
      reason:
        `Die beiden Seiten beginnen bei verschiedenen Staenden: ${own.from} gegen ${other.fromHash}. ` +
        'Der Stand des Gastgebers wird uebertragen, und danach wird erneut geprueft.',
    }
  }
  if (own.ticks !== other.ticks || own.hash !== other.hash) {
    return {
      kind: 'abort',
      reason:
        `Aus demselben Stand ${own.from} kommen nach ${own.ticks} Probeticks zwei Ergebnisse: ` +
        `${own.hash} gegen ${other.hash}. Die Partie beginnt nicht.`,
    }
  }
  return { kind: 'continue' }
}

/**
 * Der Spielstand als Nachricht — **die einzige Stelle, an der ein Zustand über die Leitung
 * geht** (D28.11).
 *
 * Gemessen am 2026-09-12 (Bauplan §1): 93,6 KB am Anfang, 249 KB nach dreißig Spieltagen.
 * Der Wert ist kein Schätzwert und wird in `resume-save.test.ts` nachgemessen — wächst
 * eine lange Partie deutlich darüber hinaus, gehört die Zahl in den Bericht.
 */
export function stateMessage(state: GameState): StateMessage {
  return { ...envelope('zustand'), state }
}

/**
 * Einen übertragenen Stand annehmen — oder ihn verwerfen und sagen, warum.
 *
 * **Geprüft wird gegen das, was der Host angekündigt hat**, nicht gegen das, was ankam.
 * Ein Stand, der unterwegs verstümmelt wurde, hätte sonst auf beiden Seiten dieselbe
 * falsche Prüfsumme: die eigene Rechnung über das eigene Ergebnis ist keine Prüfung.
 * `announced` ist der Startabdruck aus der Probennachricht des Hosts.
 */
export function acceptState(
  message: StateMessage,
  announced: string,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  // **Zuerst die Stufe, dann die Pruefsumme** (T-M17-03). Ein Stand aus einem anderen Bau
  // hat ohnehin eine andere Pruefsumme — aber die Meldung „passt nicht zu dem, was
  // angekuendigt war" schickt den Naechsten auf die Suche nach einem verstuemmelten
  // Spielstand, obwohl in Wahrheit zwei verschiedene Faende des Spiels miteinander reden.
  // Und der Fall ist nicht theoretisch: ein Stand der Stufe 3 hat kein `espionage`, und
  // `cloneState` liest es im ersten Tick — aus der falschen Meldung wuerde ein Absturz.
  const stufe = (message.state as { schemaVersion?: unknown }).schemaVersion
  if (stufe !== SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        `Der uebertragene Stand hat Format ${JSON.stringify(stufe)}, diese Seite spricht ${SCHEMA_VERSION}. ` +
        'Die beiden Seiten haben verschiedene Faende des Spiels; der Stand wird verworfen.',
    }
  }
  const gerechnet = stateHash(message.state)
  if (gerechnet !== announced) {
    return {
      ok: false,
      reason:
        `Der uebertragene Stand passt nicht zu dem, was angekuendigt war: ${gerechnet} statt ${announced}. ` +
        'Er wird verworfen — ein halb angekommener Spielstand ist schlimmer als keiner.',
    }
  }
  return { ok: true, state: message.state }
}
