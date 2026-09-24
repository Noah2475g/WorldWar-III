import { SPY_MISSIONS } from '../rules/espionage'
import type { GameState, PlayerId, ProvinceId, Spy, SpyMission } from '../state/types'
import { visibleProvinces } from '../view/publicView'
import { registerCommand } from './registry'
import {
  fail,
  ok,
  type CommandResult,
  type DismissSpyCommand,
  type ReassignSpyCommand,
  type RecruitSpyCommand,
} from './types'

/**
 * Spione anwerben, ansetzen, entlassen (R-SPY-01, T-M17-07, D29.2).
 *
 * Spione sind keine Einheiten, sondern Aufträge mit Sold (Referenz 10.2). Diese Datei legt sie
 * an, setzt sie um und nimmt sie weg; was ein Spion täglich tut und kostet, ist der Tageslauf
 * (R-SPY-02, T-M17-08).
 *
 * **Prüfreihenfolge** in jedem `check`: Existenz → Eigentum → Zielbedingung → Obergrenze →
 * Kosten (D29.2). Bei zwei Fehlern gewinnt der frühere; die Tests halten jedes Paar fest.
 *
 * **Verborgene Information ist ein Spielgesetz.** Zwei Stellen, an denen die naheliegende Prüfung
 * den Nebel verraten hätte, und beide über dieselbe Tür — die Ablehnung, die als
 * `COMMAND_REJECTED` beim Befehlenden ankommt und über `canApply` jeder KI offensteht:
 *
 *  - **Ein fremder Spion wird abgelehnt wie einer, den es nicht gibt** (`kein Spion`), nicht mit
 *    `NOT_OWNER`. Die Kennungen sind fortlaufend; wer s1, s2, … durchprobiert, zählte sonst die
 *    lebenden Spione aller anderen.
 *  - **Die Zielbedingung prüft den Besitzer, den der Spieler kennt** — den wahren, wenn er die
 *    Provinz sieht, sonst den aus seinem Aufklärungsgedächtnis. Gegen den wahren Besitzer
 *    geprüft, verriete „herrenlos" einen Besitzwechsel hinter dem Nebel. Ob der Auftrag am
 *    Ausführungstag noch passt, entscheidet der Tageslauf (`targetChanged`, D29.3).
 *
 * Keiner der drei Befehle erzeugt ein Ereignis (D29.5 kennt keines): der Besitzer sieht seine
 * Spione in der Sicht (`PublicView.espionage`), und niemand sonst erfährt etwas.
 */

/** Was der Spieler über eine Provinz weiß: nichts, oder wem sie gehört (soweit er weiß). */
export type KnownOwner = { known: false } | { known: true; owner: PlayerId | null }

/**
 * Der Besitzer einer Provinz aus Sicht eines Spielers — sichtbar oder erinnert (R-SPY-01/AK3).
 *
 * Dieselbe Quelle wie `publicView`: was dort als Provinz steht, ist hier bekannt, mit demselben
 * Besitzer. Eine Provinz, die die Sicht nicht führt, ist unbekannt.
 */
export function knownOwner(state: GameState, playerId: PlayerId, provinceId: ProvinceId): KnownOwner {
  const province = state.provinces[provinceId]
  if (province && visibleProvinces(state, playerId).has(provinceId)) return { known: true, owner: province.owner }
  const remembered = state.players[playerId]?.intel[provinceId]
  if (remembered) return { known: true, owner: remembered.owner }
  return { known: false }
}

/**
 * Passt der Auftrag zum Ziel? `null` heißt ja, sonst der Grund (R-SPY-01/AK2).
 *
 * Aufklärung und Sabotage nur in fremden Provinzen, Gegenspionage nur in eigenen, Sabotage nie in
 * herrenlosen. Aufklärung in einer herrenlosen Provinz ist erlaubt — dort gibt es nichts zu
 * zerstören, aber etwas zu sehen.
 */
export function spyTargetProblem(owner: PlayerId | null, playerId: PlayerId, mission: SpyMission): string | null {
  if (mission === 'counter') return owner === playerId ? null : 'nicht eigene Provinz'
  if (owner === playerId) return 'eigene Provinz'
  if (owner === null && mission !== 'intel') return 'herrenlos'
  return null
}

/** Die Zielprüfung, die Anwerben und Umsetzen teilen: Existenz, Kenntnis, Auftrag, Zielbedingung. */
function checkTarget(state: GameState, playerId: PlayerId, provinceId: ProvinceId, mission: SpyMission): CommandResult {
  if (!state.provinces[provinceId]) return fail('PROVINCE_NOT_FOUND', { provinceId })

  const known = knownOwner(state, playerId, provinceId)
  if (!known.known) return fail('INVALID_TARGET', { reason: 'unbekannt' })

  // Der Wert wird geprüft, nicht geglaubt (Muster SET_STANCE, T-M40-01).
  if (!SPY_MISSIONS.includes(mission)) return fail('INVALID_TARGET', { reason: 'unbekannter Auftrag' })

  const problem = spyTargetProblem(known.owner, playerId, mission)
  return problem ? fail('INVALID_TARGET', { reason: problem }) : ok
}

/** Ein eigener Spion — oder keiner. Fremde und nicht vorhandene sehen gleich aus (siehe oben). */
function ownSpy(state: GameState, playerId: PlayerId, spyId: string): Spy | undefined {
  const spy = state.espionage.spies.find((candidate) => candidate.id === spyId)
  return spy && spy.owner === playerId ? spy : undefined
}

function ownSpyCount(state: GameState, playerId: PlayerId): number {
  let count = 0
  for (const spy of state.espionage.spies) if (spy.owner === playerId) count++
  return count
}

registerCommand<RecruitSpyCommand>('RECRUIT_SPY', {
  check: (state, command, ctx) => {
    const target = checkTarget(state, command.playerId, command.provinceId, command.mission)
    if (!target.ok) return target

    const { maxSpiesPerPlayer, spyRecruitCost } = ctx.rules.constants
    if (ownSpyCount(state, command.playerId) >= maxSpiesPerPlayer) {
      return fail('QUEUE_FULL', { max: maxSpiesPerPlayer })
    }

    if (state.players[command.playerId]!.resources.money < spyRecruitCost) {
      return fail('INSUFFICIENT_RESOURCES', { resource: 'money' })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    // R-SPY-01/AK1: der Betrag geht sofort ab, der Spion steht sofort im Zustand.
    draft.players[command.playerId]!.resources.money -= ctx.rules.constants.spyRecruitCost
    draft.espionage.spies.push({
      id: `s${draft.nextIds.spy++}`,
      owner: command.playerId,
      provinceId: command.provinceId,
      mission: command.mission,
      recruitedTick: draft.tick,
      // Angesetzt im selben Tick: er führt frühestens am Tag danach aus (R-SPY-02/AK3).
      assignedTick: draft.tick,
      lastRunTick: null,
      lastOutcome: null,
    })
  },
})

registerCommand<ReassignSpyCommand>('REASSIGN_SPY', {
  check: (state, command) => {
    const spy = ownSpy(state, command.playerId, command.spyId)
    if (!spy) return fail('INVALID_TARGET', { reason: 'kein Spion' })

    const target = checkTarget(state, command.playerId, command.provinceId, command.mission)
    if (!target.ok) return target

    // Ein Umsetzen, das nichts ändert, setzte nur `assignedTick` neu und verschenkte den nächsten
    // Tag — für die KI ein Befehl, der jeden Tag wiederholt ihren Spion lahmlegt.
    if (spy.provinceId === command.provinceId && spy.mission === command.mission) {
      return fail('INVALID_TARGET', { reason: 'unverändert' })
    }
    // Kostenlos und ohne Obergrenze: der Spion ist schon bezahlt und schon gezählt.
    return ok
  },

  apply: (draft, command) => {
    const spy = ownSpy(draft, command.playerId, command.spyId)!
    spy.provinceId = command.provinceId
    spy.mission = command.mission
    // Auch beim Umsetzen erst am Tag danach (D29.1). `lastRunTick` und `lastOutcome` bleiben als
    // Geschichte stehen; `assignedTick > lastRunTick` heißt „am neuen Ziel noch nicht gelaufen".
    spy.assignedTick = draft.tick
  },
})

registerCommand<DismissSpyCommand>('DISMISS_SPY', {
  check: (state, command) => {
    if (!ownSpy(state, command.playerId, command.spyId)) return fail('INVALID_TARGET', { reason: 'kein Spion' })
    return ok
  },

  apply: (draft, command) => {
    // Nichts wird erstattet, und die Kennung wird nie wieder vergeben (`nextIds.spy` läuft weiter).
    draft.espionage.spies = draft.espionage.spies.filter((spy) => spy.id !== command.spyId)
  },
})
