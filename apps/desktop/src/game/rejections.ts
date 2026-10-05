import { RECRUIT_MIN_MORALE, type Command, type CommandError, type GameState, type ResourceKey, type Rules } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { amount, missing, unfix } from '../ui/format.ts'

/**
 * A refusal, in words the player can act on (T-M10-08, R-UI-05, R-UI-07).
 *
 * The core says *what* went wrong with a code and a few raw fields — a building key,
 * a unit key, a tick. The sentence the player reads must carry names and numbers:
 * "Es fehlt an Rohstoffen: 333 Material" rather than "INSUFFICIENT_RESOURCES
 * barracks". The core cannot know what is missing in the player's terms; this does.
 */

export interface RejectionContext {
  state: GameState
  rules: Rules
  playerId: string
  ticksPerDay: number
  /** Provinzname für Sätze, die eine Provinz nennen (Handel); ohne ihn heißt sie „diese Provinz“ (R-UX-03/AK2). */
  nameOfProvince?: (id: string) => string
}

export interface Rejection {
  code: CommandError
  detail?: Record<string, string | number> | undefined
}

/** The resources an order would consume, so the shortfall can be named. */
function costOf(command: Command | null, rules: Rules): Partial<Record<string, number>> {
  if (!command) return {}
  switch (command.type) {
    case 'BUILD':
      return rules.buildings[command.building]?.cost ?? {}
    case 'RECRUIT': {
      const unit = rules.units[command.unitKey]
      if (!unit) return {}
      return Object.fromEntries(
        Object.entries(unit.cost).map(([key, value]) => [key, (value ?? 0) * command.count]),
      )
    }
    case 'TRADE':
      return { [command.give]: command.giveAmount }
    case 'RECRUIT_SPY':
      return { money: rules.constants.spyRecruitCost }
    default:
      return {}
  }
}

/**
 * Die Zielgruende des Kerns fuer Spionagebefehle (commands/espionage.ts, rules/espionage.ts) →
 * Satz (R-SPY-06, T-M17-13).
 */
export const SPY_REASON_KEYS: Record<string, string> = {
  unbekannt: 'espionage.reasons.unknown',
  'unbekannter Auftrag': 'espionage.reasons.unknownMission',
  'eigene Provinz': 'espionage.reasons.ownProvince',
  'nicht eigene Provinz': 'espionage.reasons.notOwnProvince',
  herrenlos: 'espionage.reasons.unowned',
  unverändert: 'espionage.reasons.unchanged',
  'kein Spion': 'espionage.reasons.noSpy',
}

const SPY_COMMANDS = new Set(['RECRUIT_SPY', 'REASSIGN_SPY', 'DISMISS_SPY'])

/**
 * Die Ablehnungsgründe des Kerns → Satz, nachgeschlagen nach (Befehlstyp, Grund) (T-M44-06, R-UX-03/AK1).
 *
 * Der Kern nennt bei `INVALID_TARGET` (und `ON_COOLDOWN`) einen Freitext-Grund in `detail.reason` —
 * „kein Angebot“, „bereits im Krieg“ —, den bis hierher die Oberfläche in Klammern hinter den
 * Allgemeinsatz setzte: „Dieses Ziel ist für den Befehl nicht zulässig. (kein Angebot)“. Hier steht je
 * (Befehlstyp, Grund) der Schlüssel eines ganzen Satzes in `de.ts` (Abschnitt `refusal`). **Der
 * Kern-Text wird nur gelesen**, nie geändert; `rejections.test.ts` liest die Gründe aus
 * `packages/core/src/commands` und fällt, wenn ein neuer ohne Satz dazukommt.
 *
 * Gleiche Gründe unter verschiedenen Befehlen dürfen denselben Schlüssel teilen (der Handel); die
 * Tabelle ist nach Befehlstyp getrennt, damit ein Satz je Befehl möglich bleibt.
 */
const DIPLOMACY_REASONS: Record<string, string> = {
  'sich selbst': 'refusal.DIPLOMACY.self',
  'bereits im Krieg': 'refusal.DIPLOMACY.alreadyAtWar',
  Waffenstillstand: 'diplomacy.truceBlocks',
  'kein Angebot': 'refusal.DIPLOMACY.noOffer',
  'nicht im Frieden': 'refusal.DIPLOMACY.notAtPeace',
  'kein Bündnis': 'refusal.DIPLOMACY.noAlliance',
  'im Krieg': 'refusal.DIPLOMACY.atWar',
  'Kriegserklärung läuft': 'refusal.DIPLOMACY.declarationRunning',
  gekündigt: 'refusal.DIPLOMACY.passageEnding',
  'bereits gewährt': 'refusal.DIPLOMACY.passageAlreadyGranted',
  'nicht gewährt': 'refusal.DIPLOMACY.passageNotGranted',
  'bereits gekündigt': 'refusal.DIPLOMACY.passageAlreadyRevoked',
  'im Bündnis': 'refusal.DIPLOMACY.inAlliance',
}

/** Die Gründe der Handelsangebote (`commands/tradeOffer.ts`); die Sätze stammen aus `trade.blocked`. */
const TRADE_OFFER_REASONS: Record<string, string> = {
  'sich selbst': 'refusal.OFFER_TRADE.self',
  'kein Angebot': 'refusal.ACCEPT_TRADE.noOffer',
  'Anbieter ausgeschieden': 'trade.blocked.gone',
  lapsing: 'trade.blocked.lapsing',
  'nicht im Besitz': 'trade.blocked.notOwned',
  Hauptstadt: 'trade.blocked.capital',
  umkämpft: 'trade.blocked.contested',
  'eigene Armeen': 'trade.blocked.ownArmies',
  'fremde Armeen': 'trade.blocked.foreignArmies',
  'doppelte Provinz': 'trade.blocked.duplicate',
  'leeres Angebot': 'trade.blocked.empty',
  'gleicher Rohstoff auf beiden Seiten': 'trade.blocked.sameResource',
  'über der Höchstmenge': 'trade.blocked.limit',
  'ungültige Menge': 'trade.blocked.invalidAmount',
  'unbekannter Rohstoff': 'trade.blocked.invalidAmount',
  'ungültiges Angebot': 'trade.blocked.invalidAmount',
  'im Krieg': 'trade.blocked.war',
  'Kriegserklärung läuft': 'trade.blocked.declaration',
  'ungültiger Zeitplan': 'trade.blocked.badSchedule',
  'Zeitplan nur mit Rohstoffen': 'trade.blocked.scheduleResourcesOnly',
  'zu viele Verträge': 'trade.blocked.tooManyContracts',
}

export const REASON_KEYS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  SPLIT_ARMY: {
    'nichts ausgewählt': 'refusal.SPLIT_ARMY.nothingChosen',
    'ganze Stärke': 'refusal.SPLIT_ARMY.wholeStrength',
  },
  MERGE_ARMIES: {
    'mindestens zwei Armeen': 'refusal.MERGE_ARMIES.needTwo',
    'nicht am selben Ort': 'refusal.MERGE_ARMIES.notTogether',
    'teils eingeschifft': 'refusal.MERGE_ARMIES.partlyEmbarked',
  },
  BOMBARD: {
    eingeschifft: 'refusal.BOMBARD.embarked',
    'keine Fernwaffe': 'refusal.BOMBARD.noRanged',
  },
  BUILD: { 'braucht Küste': 'refusal.BUILD.needsCoast' },
  SET_STANCE: { 'unbekannte Haltung': 'refusal.SET_STANCE.unknown' },
  MOVE_ARMY: {
    'leere Armee': 'refusal.MOVE_ARMY.empty',
    'bereits dort': 'refusal.MOVE_ARMY.alreadyThere',
    'kein eigener Flugplatz': 'refusal.MOVE_ARMY.noAirfield',
  },
  RECRUIT: { 'Moral zu niedrig': 'refusal.RECRUIT.lowMorale' },
  TRADE: {
    'gleiche Ressource': 'refusal.TRADE.sameResource',
    'Menge zu groß': 'refusal.TRADE.tooMuch',
    'Gegenwert zu klein': 'refusal.TRADE.tooLittle',
  },
  DIPLOMACY: DIPLOMACY_REASONS,
  OFFER_TRADE: TRADE_OFFER_REASONS,
  ACCEPT_TRADE: TRADE_OFFER_REASONS,
  DECLINE_TRADE: { 'kein Angebot': 'refusal.ACCEPT_TRADE.noOffer' },
  WITHDRAW_TRADE: { 'kein Angebot': 'refusal.ACCEPT_TRADE.noOffer' },
  CANCEL_CONTRACT: { 'kein Vertrag': 'refusal.CANCEL_CONTRACT.noContract' },
}

/** Der Schlüssel des Satzes zu (Befehlstyp, Grund) — oder `undefined`, wenn der Kern einen neuen Grund hat. */
export function reasonKey(commandType: string, reason: string): string | undefined {
  if (SPY_COMMANDS.has(commandType)) return SPY_REASON_KEYS[reason]
  return REASON_KEYS[commandType]?.[reason]
}

/** Der Satz zu einem Kerngrund, mit Namen statt Kennungen; `null`, wenn die Tabelle ihn nicht kennt. */
function reasonSentence(rejection: Rejection, command: Command | null, ctx: RejectionContext): string | null {
  const detail = rejection.detail ?? {}
  if (command === null || typeof detail.reason !== 'string') return null
  const key = reasonKey(command.type, detail.reason)
  if (key === undefined) return null

  const values: Record<string, string | number> = {}
  const targetId = (command as { targetPlayerId?: unknown }).targetPlayerId
  values.target = (typeof targetId === 'string' ? ctx.state.players[targetId]?.nation : undefined) ?? t('refusal.thatPower')
  values.province =
    typeof detail.provinceId === 'string' && ctx.nameOfProvince
      ? ctx.nameOfProvince(detail.provinceId)
      : t('refusal.thatProvince')
  if (typeof detail.building === 'string') values.building = t(`buildings.${detail.building}`)
  if (typeof detail.resource === 'string') values.resource = t(`resources.${detail.resource}`)
  // Die Moralsperre nennt Zahl und Grenze (T-M46-15, VM-01 Teil a): Noah hielt „Moral zu niedrig“ in einer
  // eroberten Provinz fuer ein fehlendes Gebaeude. Abgerundet, damit die Zahl nie die Grenze erreicht, wenn die
  // Sperre greift. Ohne Zahl im Detail (alter Stand, Fremdaufrufer) bleibt der Satz ohne Zahlen.
  if (command.type === 'RECRUIT' && detail.reason === 'Moral zu niedrig' && typeof detail.morale === 'number') {
    values.morale = Math.floor(unfix(detail.morale))
    values.needed = Math.floor(unfix(RECRUIT_MIN_MORALE))
    return t('refusal.RECRUIT.lowMoraleNumbers', values)
  }
  if (detail.reason === 'über der Höchstmenge') {
    const max = detail.resource === 'money' ? ctx.rules.constants.tradeMaxMoney : ctx.rules.constants.tradeMaxResource
    values.max = amount(max)
  }
  return t(key, values)
}

export function describeRejection(rejection: Rejection, command: Command | null, ctx: RejectionContext): string {
  const detail = rejection.detail ?? {}
  const values: Record<string, string | number> = { ...detail }

  const buildingKey = detail.required ?? detail.building
  if (typeof buildingKey === 'string') {
    // Die Stufe gehoert in den Satz, nicht nur ins Detail (T-M34-05): seit Zerstoerer
    // Werft 2 und Raketenartillerie Fabrik 3 verlangen, ist "Dafuer fehlt das Gebaeude:
    // Werft" an einer Provinz MIT Werft eine Auskunft, die dem Spieler widerspricht.
    // Stufe 1 bleibt ungenannt — sie ist der Normalfall und waere Rauschen.
    const level = typeof detail.level === 'number' ? detail.level : 1
    values.building =
      level > 1
        ? `${t(`buildings.${buildingKey}`)} ${t('actions.buildLevel', { level })}`
        : t(`buildings.${buildingKey}`)
  }
  if (typeof detail.unitKey === 'string') values.unit = t(`units.${detail.unitKey}`)
  if (typeof detail.resource === 'string') values.resource = t(`resources.${detail.resource}`)

  // Spionagebefehle sprechen eigene Saetze: "Alle Bauplaetze belegt" waere bei fuenf
  // Spionen falsch, und der Zielgrund des Kerns (`herrenlos`, `kein Spion`, …) ist ein
  // Wort ohne Satz, bis eine Tabelle es uebersetzt (R-SPY-06, T-M17-13).
  if (command && SPY_COMMANDS.has(command.type)) {
    if (rejection.code === 'QUEUE_FULL') return t('espionage.limitReached', { max: Number(detail.max) })
    const key = typeof detail.reason === 'string' ? SPY_REASON_KEYS[detail.reason] : undefined
    if (rejection.code === 'INVALID_TARGET' && key) return t(key)
  }

  switch (rejection.code) {
    case 'INSUFFICIENT_RESOURCES': {
      const player = ctx.state.players[ctx.playerId]
      const available = (player?.resources ?? {}) as Partial<Record<string, number>>
      const short = missing(costOf(command, ctx.rules), available)
      values.missing = short || (typeof detail.resource === 'string' ? t(`resources.${detail.resource}`) : t('resources.money'))
      break
    }
    case 'ON_COOLDOWN': {
      // Ohne Zeitpunkt ist es der Waffenstillstand (Kriegserklaerung); `until` (Beschuss nach dem
      // Marsch) ist eine Frist wie `readyAtTick`, kein Waffenstillstand (T-M44-06, falsche Ursache).
      const readyAt = typeof detail.readyAtTick === 'number' ? detail.readyAtTick : typeof detail.until === 'number' ? detail.until : null
      if (readyAt === null) return t('diplomacy.truceBlocks')
      values.days = Math.max(1, Math.ceil((readyAt - ctx.state.tick) / ctx.ticksPerDay))
      break
    }
    case 'INVALID_TARGET': {
      // T-M44-06 (R-UX-03/AK1): ein Satz je (Befehlstyp, Grund); ein Grund ohne Satz zeigt den
      // Allgemeinsatz und nie das Rohwort des Kerns in Klammern.
      // LOESCHVERMERK (Review): vorher `t('actions.reasonDetail', { text: t('errors.INVALID_TARGET'), reason: detail.reason })`
      // — „Dieses Ziel ist für den Befehl nicht zulässig. (kein Angebot)“.
      const sentence = reasonSentence(rejection, command, ctx)
      if (sentence !== null) return sentence
      break
    }
    default:
      break
  }

  return t(`errors.${rejection.code}`, values)
}

/** The player's stock, for hints that compare a price with what is in the treasury. */
export function treasuryOf(ctx: RejectionContext): Partial<Record<ResourceKey, number>> {
  return ctx.state.players[ctx.playerId]?.resources ?? {}
}

/** Formats a fixed-point quantity for a sentence — re-exported so callers need one import. */
export { amount }
