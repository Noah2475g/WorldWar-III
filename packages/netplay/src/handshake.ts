import type { GameConfig, MapData, PlayerId, Rules } from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import {
  PROTOCOL_VERSION,
  envelope,
  parseMessage,
  type HelloMessage,
  type NetMessage,
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
export type HandshakeFault = 'version' | 'rules' | 'map' | 'message'

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
