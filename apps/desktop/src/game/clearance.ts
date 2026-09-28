import {
  canUseSea,
  isClearingPath,
  type Army,
  type ClearingWay,
  type GameEvent,
  type MapData,
  type PublicView,
  type Rules,
} from '@worldwar/core'
import type { Alert, AlertKind } from '../ui/Alerts.tsx'
import type { IconName } from '../ui/icons.tsx'
import { gameTime } from '../ui/format.ts'
import { t } from '../i18n/text.ts'

/**
 * Die Räumfrist als Meldung (T-M43-02, R-DIP-10/AK5, D34.4).
 *
 * Diese Datei spiegelt die Kernbedingung aus `packages/core/src/phases/diplomacy.ts`,
 * `detectSurpriseAttacks` — Schutz (a) (Frieden/Bündnisbruch: ein Spieltag ab
 * `sinceTick`, Frieden seit Spielbeginn zählt nicht, E4) und Schutz (b) (der kürzeste
 * Weg hinaus ist nie ein Überfall, `isClearingPath` ohne `strictExit`) — aber **aus der
 * Sicht** (`PublicView`), nicht aus dem Zustand des Kerns. Der Grund ist E1
 * (`DECISIONS.md`): eine Meldung ist ein Zustand, kein Ereignis, sie übersteht Laden und
 * hohes Vorspultempo, und sie verschwindet von selbst, sobald die Frist vorbei oder die
 * Armee auf dem Weg hinaus ist. Das Ereignis (`DIPLOMACY_CHANGED`, `RIGHT_OF_WAY_CHANGED`)
 * dient nur noch dem Vorspul-Halt (`isClearanceCause`, `game/fastForward.ts`).
 *
 * Die eine vorsichtige Stunde (E3): bei einer Kündigung endet das Recht zum Tick `ends`
 * (`passageEndsAtTick.received`), aber die Sicht kennt die Kündigung ab genau diesem Tick
 * nicht mehr (`passageEndsAtTick.received` wird `null`, sobald sie nicht mehr gilt). Ein
 * Marschbefehl, der erst im Sicht-Tick `ends` gegeben wird, kommt beim Kern noch rechtzeitig
 * an — die Meldung nennt deshalb `ends − 1` als letzten sicheren Tick, nie `ends` selbst.
 */

export interface ClearanceNotice {
  armyId: string
  provinceId: string
  hostId: string
  /** Letzter Sicht-Tick, bis zu dem ein Marschbefehl hinaus sicher wirkt. */
  deadlineTick: number
  cause: 'peace' | 'revoked' | 'retreat'
}

/**
 * Jede eigene Armee, die im Land einer anderen Macht steht, ohne dort im Krieg oder mit
 * Bündnis/Durchmarschrecht zu stehen, und nicht schon auf dem kürzesten Weg hinaus ist.
 *
 * Reihenfolge folgt `view.armies` (`armyOrder` des Kerns) — deterministisch, keine eigene
 * Sortierung.
 */
export function clearanceNotices(
  view: PublicView,
  map: MapData,
  rules: Pick<Rules, 'constants' | 'units'>,
): ClearanceNotice[] {
  const owner = new Map(view.provinces.map((province) => [province.id, province.owner ?? null] as const))
  const me = view.playerId
  const notice = rules.constants.rightOfWayNoticeTicks
  const out: ClearanceNotice[] = []

  for (const army of view.armies) {
    if (army.owner !== me) continue
    const host = owner.get(army.provinceId) ?? null
    if (host === null || host === me) continue

    const rel = view.relations[host]
    if (!rel || rel.state === 'war' || rel.state === 'alliance') continue

    const candidates: { tick: number; cause: ClearanceNotice['cause'] }[] = []
    // (a), gespiegelt: Frieden/Waffenstillstand seit Spielbeginn ist keine Änderung (E4).
    if ((rel.state === 'truce' || rel.sinceTick > 0) && view.tick <= rel.sinceTick + notice) {
      candidates.push({ tick: rel.sinceTick + notice, cause: 'peace' })
    }
    // (c), gespiegelt: Rückzug in neutrales Land (Noahs Entscheid vom 2026-09-27, Punkt 3;
    // T-M43-01 C2b) — die Frist ist die eigene Rückzugssperre, die die Sicht seit B4 kennt.
    // Vor (b): bei Gleichstand mit einer Kündigung soll der Rückzug gewinnen (Reihenfolge
    // unten in `candidates` bestimmt den Ausgang des Gleichstands, s. `best`).
    // `until > 0`: der Zustand setzt `cannotAttackUntil` auf 0 als Grundwert (nie
    // zurückgewichen) — ohne diese Wache läse ein frischer Stand bei Tick 0 (K4, E4) das
    // als eine ablaufende Sperre und meldete faelschlich einen Rückzug.
    // `until - view.tick > 1`: dasselbe Feld setzt auch der Beschuss, aber nur fuer eine
    // Feuerpause von einem Tick (`bombardment.ts:139`, `draft.tick + 1`) — keine
    // Rueckzugssperre (24 Ticks, `retreatCooldownTicks`). Ohne diese Wache meldete eine
    // eigene Fernwaffenarmee im Friedensland, die auf ein entferntes Ziel feuert, jeden Tick
    // faelschlich einen Rueckzug (Nacharbeit Etappe 1, Befund "Rueckzugsmeldung erscheint
    // auch fuer feuernde Armeen", K18). Eine echte, fast abgelaufene Rueckzugssperre kann
    // dieselbe Randbedingung (`until - view.tick === 1`) durchlaufen — die Meldung
    // verschwindet dann bis zu einen Tick frueher als die Sperre selbst, nie spaeter: die
    // sichere Richtung (keine falsche Meldung wiegt mehr als eine Meldung, die einen Tick zu
    // frueh endet).
    const until = army.cannotAttackUntil
    if (until !== undefined && until > 0 && until - view.tick > 1) candidates.push({ tick: until, cause: 'retreat' })
    if (rel.passageReceived) {
      const ends = rel.passageEndsAtTick.received
      // Unbefristet (kein Ende) ist keine Kündigung — keine Gefahr, Armee überspringen.
      if (ends !== null) candidates.push({ tick: ends - 1, cause: 'revoked' })
    }
    if (candidates.length === 0) continue
    // Der größte Tick gewinnt; bei Gleichstand die Reihenfolge oben (Frieden vor Rückzug vor
    // Kündigung, Noahs Entscheid): der Kern schützt, solange irgendeiner der Schutzgründe greift.
    const best = candidates.reduce((a, b) => (b.tick > a.tick ? b : a))

    // (b), gespiegelt: der kürzeste Weg hinaus (Kern-Fassung, ohne strictExit).
    const way: ClearingWay = {
      map,
      ownerOf: (id) => owner.get(id) ?? null,
      mayEnter: (candidateOwner) => {
        const candidateRel = view.relations[candidateOwner]
        return !!candidateRel && (candidateRel.state === 'war' || candidateRel.state === 'alliance' || candidateRel.passageReceived)
      },
      useSea: canUseSea({ units: army.units ?? [] } as unknown as Army, rules as Rules),
    }
    const path = army.path ?? []
    if (path.length > 0 && isClearingPath(way, army.provinceId, path, me, host)) continue

    out.push({ armyId: army.id, provinceId: army.provinceId, hostId: host, deadlineTick: best.tick, cause: best.cause })
  }

  return out
}

export interface ClearanceNaming {
  army: (id: string) => string
}

/**
 * Die Meldungen daraus, als `Alert` (T-M43-02): laut in Warnfarbe (E7), nicht wegklickbar,
 * Sprung zur Armee.
 */
export function clearanceAlerts(
  view: PublicView,
  notices: readonly ClearanceNotice[],
  naming: ClearanceNaming,
  ticksPerDay: number,
): Alert[] {
  const nationOf = (playerId: string): string =>
    view.others.find((other) => other.id === playerId)?.nation ?? t('trade.unknownPower')
  const nameOf = (id: string): string => view.provinces.find((province) => province.id === id)?.name ?? id

  return notices.map((noticeItem) => {
    const { day, hour } = gameTime(noticeItem.deadlineTick, ticksPerDay)
    const kind: AlertKind = 'clearance'
    // Rückzug (Ergänzung 3, Noahs Entscheid 2026-09-27): kein eigenes Symbol in `icons.tsx` —
    // wie beim Frieden das Zeichen für Waffenstillstand (`truce`).
    const icon: IconName = noticeItem.cause === 'revoked' ? 'rightOfWay' : 'truce'
    const key = noticeItem.cause === 'retreat' ? 'alerts.clearanceRetreat' : 'alerts.clearance'
    return {
      id: `clearance:${noticeItem.armyId}`,
      kind,
      icon,
      text: t(key, {
        army: naming.army(noticeItem.armyId),
        province: nameOf(noticeItem.provinceId),
        nation: nationOf(noticeItem.hostId),
        day: String(day),
        hour: String(hour).padStart(2, '0'),
      }),
      provinceId: noticeItem.provinceId,
      armyId: noticeItem.armyId,
    }
  })
}

/**
 * Löst dieses Ereignis eine Räumfrist für `viewer` aus (T-M43-02)? Nur dafür verwendet,
 * um das Vorspulen anzuhalten (`game/fastForward.ts`) — die Meldung selbst liest keine
 * Ereignisse (E1).
 *
 * `ARMY_RETREATED` (Ergänzung 3, Noahs Entscheid 2026-09-27) feuert bei JEDEM Rückzug,
 * auch ins eigene Land — anders als bei den beiden anderen Ursachen genügt das Ereignis
 * hier also nicht: der Aufrufer muss zusätzlich prüfen, dass `clearanceNotices(...)`
 * für GENAU diese Armee (`event.armyId`) eine Meldung liefert, sonst hielte ein Rückzug
 * ins eigene Land an, sobald irgendeine andere Frist läuft (F5).
 */
export function isClearanceCause(event: GameEvent, viewer: string): boolean {
  if (event.type === 'DIPLOMACY_CHANGED') {
    return (
      (event.newState === 'truce' || event.newState === 'peace') &&
      (event.playerId === viewer || event.targetPlayerId === viewer)
    )
  }
  if (event.type === 'RIGHT_OF_WAY_CHANGED') {
    return event.granted === false && event.targetPlayerId === viewer
  }
  if (event.type === 'ARMY_RETREATED') {
    return event.playerId === viewer
  }
  return false
}
