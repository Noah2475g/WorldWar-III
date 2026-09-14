import { advanceTicks } from '@worldwar/ai'
import { createInitialState, type GameConfig, type MapData, type PlayerId, type Rules } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { stateHash } from './lockstep'
import {
  PROTOCOL_VERSION,
  envelope,
  parseMessage,
  type HelloMessage,
  type NetMessage,
  type ProbeMessage,
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
): WelcomeMessage {
  return {
    ...envelope('willkommen'),
    config,
    seat,
    rulesHash: own.rulesHash,
    mapHash: own.mapHash,
    probeTicks,
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
  const begonnen = now()
  const start = createInitialState(config, ctx)
  const result = advanceTicks(start, ticks, ctx, { scripted: () => [] })
  return { ticks: result.ticks, hash: stateHash(result.state), ms: now() - begonnen }
}

/** Das Ergebnis als Nachricht. */
export function probeMessage(outcome: ProbeOutcome): ProbeMessage {
  return { ...envelope('probe'), ticks: outcome.ticks, hash: outcome.hash }
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
