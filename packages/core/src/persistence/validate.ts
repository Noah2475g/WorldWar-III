import { SPY_MISSIONS } from '../rules/espionage'
import { RESOURCE_KEYS, type GameState, type ResourceKey, type Reveal, type Spy, type SpyMission } from '../state/types'

/**
 * Was ein geladener Zustand mindestens sein muss (T-M15-04, R-GAME-07, Befund 55).
 *
 * Bis zum 2026-09-06 gab es diese Prüfung nicht — und sie fehlte an genau der Stelle,
 * an der sie zählt. `deserialise` prüfte `if (migrated.hash)`, und `migrate` entfernt den
 * Hash nach jedem Schritt, weil er den Zustand *vor* der Umstellung beschreibt. Solange
 * `MIGRATIONS` leer war, fiel das nicht auf. Ab dem ersten echten Schritt wäre **jeder
 * migrierte Stand ohne jede Prüfung durchgelaufen** — auch `{}`.
 *
 * Die Prüfung ist bewusst grob. Sie ersetzt den Hash nicht (das kann sie nicht: der Hash
 * beschreibt einen Zustand, den es nach der Migration nicht mehr gibt), sondern beantwortet
 * die eine Frage, die der Hash für einen migrierten Stand nicht mehr beantworten kann:
 * *ist das überhaupt ein Spielstand?* Ein halb verstandener Stand ist schlimmer als
 * abgelehnter.
 */

export class InvalidStateError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Der Speicherstand ist unvollständig: ${problems.join('; ')}`)
    this.name = 'InvalidStateError'
  }
}

/** Pflichtfelder eines Zustands, mit der Art, die sie haben müssen. */
const REQUIRED: { key: keyof GameState; kind: 'number' | 'string' | 'array' | 'object' }[] = [
  { key: 'schemaVersion', kind: 'number' },
  { key: 'seed', kind: 'number' },
  { key: 'rng', kind: 'object' },
  { key: 'tick', kind: 'number' },
  { key: 'mapId', kind: 'string' },
  { key: 'rulesId', kind: 'string' },
  { key: 'players', kind: 'object' },
  { key: 'playerOrder', kind: 'array' },
  { key: 'provinces', kind: 'object' },
  { key: 'provinceOrder', kind: 'array' },
  { key: 'armies', kind: 'object' },
  { key: 'armyOrder', kind: 'array' },
  { key: 'diplomacy', kind: 'object' },
  { key: 'market', kind: 'object' },
  { key: 'ai', kind: 'object' },
  { key: 'battles', kind: 'array' },
  { key: 'eventLog', kind: 'array' },
  { key: 'victory', kind: 'object' },
  // Seit Stufe 3 (T-M35-03): der Schritt 2 → 3 legt das Feld an, also muss es da sein.
  { key: 'goals', kind: 'object' },
  // Seit Stufe 4 (T-M17-03): dasselbe für die Spionage. Ohne das Feld lädt der Stand
  // fehlerfrei und stürzt im ersten Tick ab — `cloneState` liest `espionage.spies` und
  // `espionage.reveals`, und seit T-M17-08 liest der Tageslauf (`phases/espionage.ts`) jeden
  // Spion samt Besitzer und Provinz. Beide Listen prüft `checkVersion4` je Element.
  { key: 'espionage', kind: 'object' },
  { key: 'nextIds', kind: 'object' },
]

function kindOf(value: unknown): string {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

/**
 * Prüft einen Zustand auf Vollständigkeit und Stimmigkeit. Wirft `InvalidStateError`.
 *
 * Zwei Klassen von Befunden, und beide sind schon einmal in diesem Projekt vorgekommen:
 * fehlende Pflichtfelder, und Ordnungslisten, die auf Einträge zeigen, die es nicht gibt
 * (oder umgekehrt). Das Zweite ist der stillere Fehler — eine `playerOrder`, die einen
 * gelöschten Spieler nennt, lässt die Simulation an einer beliebigen späteren Stelle
 * abstürzen, mit einer Meldung, die nichts mit dem Speicherstand zu tun hat.
 */
export function validateState(value: unknown): asserts value is GameState {
  const problems: string[] = []

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidStateError([`Der Spielstand ist kein Objekt, sondern ${kindOf(value)}`])
  }

  const state = value as Record<string, unknown>

  for (const { key, kind } of REQUIRED) {
    const actual = kindOf(state[key])
    if (actual !== kind) problems.push(`Feld "${key}" fehlt oder ist ${actual} statt ${kind}`)
  }

  if (problems.length > 0) throw new InvalidStateError(problems)

  const order = (key: 'playerOrder' | 'provinceOrder' | 'armyOrder', record: 'players' | 'provinces' | 'armies') => {
    const ids = state[key] as unknown[]
    const entries = state[record] as Record<string, unknown>
    for (const id of ids) {
      if (typeof id !== 'string') problems.push(`${key} enthält eine Kennung, die kein Text ist`)
      else if (!(id in entries)) problems.push(`${key} nennt "${id}", das es in ${record} nicht gibt`)
    }
    const dangling = Object.keys(entries).filter((id) => !(ids as string[]).includes(id))
    if (dangling.length > 0) problems.push(`${record} enthält ${dangling.length} Einträge ohne Platz in ${key}`)
  }

  order('playerOrder', 'players')
  order('provinceOrder', 'provinces')
  order('armyOrder', 'armies')

  const diplomacy = state['diplomacy'] as Record<string, unknown>
  if (kindOf(diplomacy['relations']) !== 'object') problems.push('diplomacy.relations fehlt')
  if (kindOf(diplomacy['offers']) !== 'array') problems.push('diplomacy.offers fehlt')
  if (kindOf(diplomacy['tradeOffers']) !== 'array') problems.push('diplomacy.tradeOffers fehlt')
  if (kindOf(diplomacy['grievances']) !== 'object') problems.push('diplomacy.grievances fehlt')

  // Die Tagespruefung der Zwischenziele liest den Eintrag jeder Macht (T-M35-03). Fehlt er,
  // laedt der Stand fehlerfrei und wirft beim naechsten Tageswechsel einen TypeError.
  const goals = state['goals'] as Record<string, unknown>
  for (const id of state['playerOrder'] as unknown[]) {
    if (typeof id === 'string' && kindOf(goals[id]) !== 'object') problems.push(`goals nennt "${id}" nicht`)
  }

  checkVersion4(state, diplomacy, problems)

  if (problems.length > 0) throw new InvalidStateError(problems)
}

/** Die gerichteten Felder einer Beziehung seit Stufe 4, mit der Art, die sie haben müssen. */
const DIRECTED_FIELDS: { key: string; kinds: readonly string[] }[] = [
  { key: 'aGrantsPassage', kinds: ['boolean'] },
  { key: 'bGrantsPassage', kinds: ['boolean'] },
  { key: 'aPassageEndsAtTick', kinds: ['number', 'null'] },
  { key: 'bPassageEndsAtTick', kinds: ['number', 'null'] },
  { key: 'aSharesMap', kinds: ['boolean'] },
  { key: 'bSharesMap', kinds: ['boolean'] },
]

/**
 * Die Felder der Stufe 4 (T-M17-03), so tief, wie der erste Tick sie liest (Nacharbeit
 * 2026-09-24).
 *
 * Nachgestellt, bevor diese Prüfung kam: `espionage: {}` bestand und warf im ersten Tick
 * einen TypeError aus `cloneState`; ein Handelsangebot ohne `give` ebenso; und eine Beziehung
 * mit den **alten** Schlüsseln `rightOfWay`/`sharedMap` lud still — jeder gewährte Durchmarsch
 * war danach weg, denn gelesen werden nur noch die gerichteten Felder. Die alten Schlüssel
 * werden deshalb ausdrücklich abgewiesen: ein Stand, der beide Formen trägt, ist weder das
 * eine noch das andere.
 */
/** Eine sichere Ganzzahl — Ticks zaehlen, sie schwanken nicht (Befund N3, Nacharbeit 2026-09-25). */
function isSafeTick(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

const RELATION_STATES: readonly string[] = ['peace', 'war', 'truce', 'alliance']
const OFFER_KINDS: readonly string[] = ['peace', 'alliance', 'rightOfWay']

/**
 * `nextIds.<key>` muss ueber jeder vergebenen Kennung `<prefix><n>` liegen (Befund N3) — sonst
 * vergibt der naechste Befehl (`t${nextIds.offer++}`/`s${nextIds.spy++}`) eine Kennung erneut,
 * die schon existiert (oder gerade geschlossen wurde). Kennungen ausserhalb der Bauart
 * `<prefix><n>` bleiben hier ohne Befund — sie sind schon ueber `kein Text` hinaus nicht zu
 * bewerten und faellen an anderer Stelle auf.
 */
function checkNextIdAbove(nextIds: Record<string, unknown>, key: string, prefix: string, ids: ReadonlySet<string>, at: string, problems: string[]): void {
  if (typeof nextIds[key] !== 'number') return
  let max = -1
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isSafeInteger(n)) max = Math.max(max, n)
  }
  if (max >= (nextIds[key] as number)) problems.push(`nextIds.${key} liegt nicht über jeder vergebenen Kennung in ${at}`)
}

function checkVersion4(state: Record<string, unknown>, diplomacy: Record<string, unknown>, problems: string[]): void {
  const espionage = state['espionage'] as Record<string, unknown>
  for (const key of ['spies', 'reveals']) {
    const actual = kindOf(espionage[key])
    if (actual !== 'array') problems.push(`Feld "espionage.${key}" fehlt oder ist ${actual} statt array`)
  }

  const nextIds = state['nextIds'] as Record<string, unknown>
  for (const key of ['army', 'battle', 'order', 'spy', 'offer']) {
    const actual = kindOf(nextIds[key])
    if (actual !== 'number') problems.push(`Feld "nextIds.${key}" fehlt oder ist ${actual} statt number`)
  }

  const players = state['players'] as Record<string, unknown>
  const provinces = state['provinces'] as Record<string, unknown>
  /** Ein **eigener** Eintrag — `'constructor'` ist sonst in jedem Objekt "da" (Befund M17-S2). */
  const known = (record: Record<string, unknown>, id: unknown): boolean => typeof id === 'string' && Object.hasOwn(record, id)

  if (kindOf(diplomacy['relations']) === 'object') {
    for (const [pair, relation] of Object.entries(diplomacy['relations'] as Record<string, unknown>)) {
      if (kindOf(relation) !== 'object') {
        problems.push(`diplomacy.relations["${pair}"] ist kein Objekt`)
        continue
      }
      const fields = relation as Record<string, unknown>
      for (const { key, kinds } of DIRECTED_FIELDS) {
        const actual = kindOf(fields[key])
        if (!kinds.includes(actual)) problems.push(`diplomacy.relations["${pair}"].${key} ist ${actual} statt ${kinds.join(' oder ')}`)
        // Frist ist eine Uhrzeit — `null` bedeutet unbefristet, jede Zahl muss eine sichere
        // Ganzzahl sein (N3: eine 1.5 oder Infinity lud bisher unbeanstandet durch).
        else if (actual === 'number' && !isSafeTick(fields[key])) {
          problems.push(`diplomacy.relations["${pair}"].${key} ist keine sichere Ganzzahl`)
        }
      }
      for (const old of ['rightOfWay', 'sharedMap']) {
        if (old in fields) problems.push(`diplomacy.relations["${pair}"] trägt noch "${old}" aus Stufe 3`)
      }
      if (!RELATION_STATES.includes(fields['state'] as string)) problems.push(`diplomacy.relations["${pair}"].state ist kein Beziehungszustand`)
      if (!isSafeTick(fields['sinceTick'])) problems.push(`diplomacy.relations["${pair}"].sinceTick ist keine sichere Ganzzahl`)
      if (fields['warEffectiveAtTick'] !== null && !isSafeTick(fields['warEffectiveAtTick'])) {
        problems.push(`diplomacy.relations["${pair}"].warEffectiveAtTick ist weder sichere Ganzzahl noch null`)
      }
      // Das Beziehungspaar muss aus zwei bekannten Maechten bestehen — sonst liest `grantsPassage`
      // & Co. (`state/create.ts`) mit `relationKey(a, b)` nie wieder auf diesen Eintrag zurueck,
      // und die Rechte bleiben unerreichbar ohne dass der Stand das je meldet.
      const [a, b] = pair.split('|')
      if (pair.split('|').length !== 2 || !known(players, a) || !known(players, b)) {
        problems.push(`diplomacy.relations["${pair}"] nennt kein bekanntes Beziehungspaar`)
      }
    }
  }

  if (kindOf(diplomacy['offers']) === 'array') {
    ;(diplomacy['offers'] as unknown[]).forEach((offer, index) => {
      const at = `diplomacy.offers[${index}]`
      if (kindOf(offer) !== 'object') {
        problems.push(`${at} ist kein Objekt`)
        return
      }
      const fields = offer as Record<string, unknown>
      // `publicView.ts` liest `offer.to`/`offer.from` ungeprueft fuer jede Macht (Befund N3:
      // ein `null`-Eintrag stuerzte dort mit TypeError ab).
      if (!known(players, fields['from'])) problems.push(`${at}.from nennt keine Macht dieses Spiels`)
      if (!known(players, fields['to'])) problems.push(`${at}.to nennt keine Macht dieses Spiels`)
      if (!OFFER_KINDS.includes(fields['kind'] as string)) problems.push(`${at}.kind ist keine Antragsart`)
      if (!isSafeTick(fields['tick'])) problems.push(`${at}.tick ist keine sichere Ganzzahl`)
    })
  }

  const tradeOfferIds = new Set<string>()
  if (kindOf(diplomacy['tradeOffers']) === 'array') {
    ;(diplomacy['tradeOffers'] as unknown[]).forEach((offer, index) => {
      const at = `diplomacy.tradeOffers[${index}]`
      if (kindOf(offer) !== 'object') {
        problems.push(`${at} ist kein Objekt`)
        return
      }
      const fields = offer as Record<string, unknown>
      if (typeof fields['id'] !== 'string') problems.push(`${at}.id ist kein Text`)
      else {
        // Eine doppelte Kennung schliesst WITHDRAW_TRADE & Co. gegen BEIDE Eintraege — die
        // Treuhand des zweiten verschwindet (Befund N3, gemessen: 2000 Rohstoff vernichtet).
        if (tradeOfferIds.has(fields['id'])) problems.push(`${at}.id "${fields['id']}" ist doppelt vergeben`)
        tradeOfferIds.add(fields['id'])
      }
      // Das Schliessen bucht die Treuhand auf `players[from]` (Befund M17-D6).
      if (!known(players, fields['from'])) problems.push(`${at}.from nennt keine Macht dieses Spiels`)
      if (!known(players, fields['to'])) problems.push(`${at}.to nennt keine Macht dieses Spiels`)
      else if (fields['to'] === fields['from']) problems.push(`${at}.to ist der Anbieter selbst`)
      for (const key of ['createdTick', 'expiresAtTick']) {
        if (typeof fields[key] !== 'number') problems.push(`${at}.${key} ist ${kindOf(fields[key])} statt number`)
      }
      for (const side of ['give', 'want']) {
        const bundle = fields[side]
        const ok =
          kindOf(bundle) === 'object' &&
          kindOf((bundle as Record<string, unknown>)['resources']) === 'object' &&
          kindOf((bundle as Record<string, unknown>)['provinces']) === 'array'
        if (!ok) {
          problems.push(`${at}.${side} fehlt oder hat keine Rohstoffe und Provinzen`)
          continue
        }
        // So, wie `OFFER_TRADE` sie annimmt: bekannte Rohstoffe, ganze Betraege ueber null.
        const { resources, provinces: cessions } = bundle as { resources: Record<string, unknown>; provinces: unknown[] }
        for (const [key, amount] of Object.entries(resources)) {
          if (!RESOURCE_KEYS.includes(key as ResourceKey)) problems.push(`${at}.${side}.resources.${key} ist kein Rohstoff`)
          else if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
            problems.push(`${at}.${side}.resources.${key} ist keine ganze Zahl ueber null`)
          }
        }
        cessions.forEach((id, i) => {
          if (!known(provinces, id)) problems.push(`${at}.${side}.provinces[${i}] nennt keine Provinz dieser Karte`)
        })
      }
    })
  }
  checkNextIdAbove(nextIds, 'offer', 't', tradeOfferIds, 'diplomacy.tradeOffers', problems)

  // Je Spion und je Aufdeckung, so tief, wie der Tageslauf sie liest (Befund M17-S7):
  // `settleEspionage` greift ungeprueft auf `players[spy.owner]` und `provinces[spy.provinceId]`.
  const spyIds = new Set<string>()
  if (kindOf(espionage['spies']) === 'array') {
    ;(espionage['spies'] as unknown[]).forEach((spy, index) => {
      const at = `espionage.spies[${index}]`
      if (kindOf(spy) !== 'object') {
        problems.push(`${at} ist kein Objekt`)
        return
      }
      const fields = spy as Record<string, unknown>
      if (typeof fields['id'] !== 'string') problems.push(`${at}.id ist kein Text`)
      else {
        // Dieselbe Falle wie bei Handelsangeboten: eine doppelte Kennung traefe DISMISS_SPY &
        // Co. gegen beide Eintraege (Befund N3).
        if (spyIds.has(fields['id'])) problems.push(`${at}.id "${fields['id']}" ist doppelt vergeben`)
        spyIds.add(fields['id'])
      }
      if (!known(players, fields['owner'])) problems.push(`${at}.owner nennt keine Macht dieses Spiels`)
      if (!known(provinces, fields['provinceId'])) problems.push(`${at}.provinceId nennt keine Provinz dieser Karte`)
      if (!SPY_MISSIONS.includes(fields['mission'] as SpyMission)) problems.push(`${at}.mission ist kein Auftrag`)
      for (const key of ['recruitedTick', 'assignedTick']) {
        if (typeof fields[key] !== 'number') problems.push(`${at}.${key} ist ${kindOf(fields[key])} statt number`)
      }
      if (!['number', 'null'].includes(kindOf(fields['lastRunTick']))) {
        problems.push(`${at}.lastRunTick ist ${kindOf(fields['lastRunTick'])} statt number oder null`)
      }
      if (!SPY_OUTCOMES.includes(fields['lastOutcome'] as Spy['lastOutcome'])) problems.push(`${at}.lastOutcome ist kein Ausgang`)
    })
  }
  checkNextIdAbove(nextIds, 'spy', 's', spyIds, 'espionage.spies', problems)

  if (kindOf(espionage['reveals']) === 'array') {
    ;(espionage['reveals'] as unknown[]).forEach((reveal, index) => {
      const at = `espionage.reveals[${index}]`
      if (kindOf(reveal) !== 'object') {
        problems.push(`${at} ist kein Objekt`)
        return
      }
      const fields = reveal as Record<string, unknown>
      if (!known(players, fields['player'])) problems.push(`${at}.player nennt keine Macht dieses Spiels`)
      if (!known(provinces, fields['provinceId'])) problems.push(`${at}.provinceId nennt keine Provinz dieser Karte`)
      if (!REVEAL_KINDS.includes(fields['kind'] as Reveal['kind'])) problems.push(`${at}.kind ist keine Aufdeckungsart`)
      if (typeof fields['untilTick'] !== 'number') problems.push(`${at}.untilTick ist ${kindOf(fields['untilTick'])} statt number`)
    })
  }
}

const SPY_OUTCOMES: readonly Spy['lastOutcome'][] = ['success', 'failure', 'targetChanged', null]
const REVEAL_KINDS: readonly Reveal['kind'][] = ['intel', 'armies']
