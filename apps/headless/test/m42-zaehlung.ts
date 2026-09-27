import { RESERVE_PERMILLE } from '@worldwar/ai'
import {
  economyOverview,
  spySalary,
  unitCount,
  type Army,
  type Command,
  type GameEvent,
  type GameState,
  type PlayerId,
  type ResourceKey,
  type Rules,
} from '@worldwar/core'

/**
 * Zaehlmodul fuer M42/M43 (T-M42-01, Plan `m18-plan-v2` Paragraph 8, Bauplan `plan-T-M42-01.md`).
 *
 * Nur lesend: eine Instanz (`m42Zaehler`) sammelt am Ende jedes Spieltags Kennzahlen aus dem
 * Zustand und den Ereignissen/Befehlen dieses Tages. Schreibt nirgends in den Zustand (Beweis:
 * R1/R einunddreissig hier im Test, `zustandOhneKi` in den Integrationslaeufen). Gefuettert von
 * `m17-integration.slow.test.ts` (tickweise, Weltkarten 1815/1914/2015) und
 * `ai-integration.slow.test.ts` (tageweise, Welt 1815 und Voreinstellung 200) — beide Anschluesse
 * sind T-M42-01 Schritt 4, ein Nachfolger baut sie.
 *
 * Begriffe (Entscheide E1-E16 in `plan-T-M42-01.md` Paragraph 8):
 * - **Mangeltag**: Tagesende, an dem `player.shortages` den Rohstoff enthaelt (nicht das
 *   `RESOURCE_SHORTAGE`-Ereignis, das nur den Beginn meldet, `upkeep.ts`).
 * - **„durch Aushebung"**: die letzte angenommene Aushebung dieser Macht an oder vor dem
 *   Mangeltag hatte am Ende ihres Tages eine negative Tagesbilanz — und seit T-M43-01/E5:
 *   die Macht hat seither keine Provinz verloren (`geldmangelTageNachProvinzverlust`
 *   zählt sonst, R-AI-11/AK3 in der Fassung nach Frage 8). Bestätigt durch Noahs Entscheid
 *   vom 2026-09-27 (Antwort F8: Pleite nach Provinzverlust ist ohne eigene Schuld); die
 *   widersprechende Messfestlegung in DECISIONS 2026-09-26 T-M42-01 ist berichtigt.
 * - **Tagesbilanz**: `economyOverview(...).balance` (Ertrag minus Armeeunterhalt minus Spionagesold)
 *   minus Unterhalt der eigenen Aushebungs-Warteschlange (`tagesbilanzNachAushebung`).
 * - **Paar**: zwei stehende Armeen gleicher Macht, Provinz, Einschiffung und Rolle mit zusammen
 *   hoechstens `stackFullContribution` Einheiten (`zusammenlegbarePaare`); „ueber zwei
 *   Tagesenden" heisst dieselben zwei Armee-Kennungen am vorigen und diesem Tagesende.
 * - **Artillerieanteil**: Klasse `artillery` an den Klassen `infantry`/`armor`/`artillery`, aus
 *   `UNIT_RECRUITED`-Ereignissen (`artillerieAnteil`).
 * - **Befund D**: Spieltag ab Verfuegbarkeit der Artillerie mit einer angenommenen Aushebung in
 *   einer Provinz ohne Fabrik, waehrend die Macht selbst eine Fabrikprovinz besitzt und jeder
 *   Artillerie-Kostenrohstoff die Stufenschwelle erreicht; die Nur-Geld-Fassung daneben.
 * - **`istBatterie`** ist ein Zwilling von `packages/ai/src/military.ts:155-157` (Wortlaut-Waechter
 *   im Test, Fall B6) — bis T-M42-08 `army-role.ts` baut und beide ablegt.
 *
 * Determinismus: keine `Map`-Ausgabe, keine `Date`, kein `sort()` auf Zustandsarrays. Ausgabe ueber
 * `state.playerOrder`/`state.armyOrder`, Schluesselobjekte (`befohlen`, `ausgehoben`, `ablehnungen`)
 * mit sortierten Schluesseln.
 */

export type Rolle = 'battery' | 'line'
export type Stufe = 'easy' | 'normal' | 'hard'

/**
 * Zwilling von `military.ts:155-157` (Wortlaut-Waechter: Fall B6 in `m42-zaehlung.test.ts`
 * bricht, sobald die beiden Fundstellen auseinanderlaufen).
 */
export function istBatterie(army: Pick<Army, 'units'>, rules: Rules): boolean {
  const eigeneEinheiten = army.units
  return (
    eigeneEinheiten.length > 0 &&
    eigeneEinheiten.every((stack) => (rules.units[stack.unitKey]?.rangeProvinces ?? 0) > 0)
  )
}

export function armeeRolle(army: Pick<Army, 'units'>, rules: Rules): Rolle {
  return istBatterie(army, rules) ? 'battery' : 'line'
}

export function armeeEinheiten(army: Pick<Army, 'units'>, rules: Rules): number {
  let total = 0
  for (const stack of army.units) total += unitCount(stack, rules)
  return total
}

export interface Paar {
  owner: PlayerId
  provinceId: string
  embarked: boolean
  rolle: Rolle
  a: string
  b: string
}

/**
 * Alle zusammenlegbaren Paare stehender Armeen einer KI-Macht (E7): gleiche Macht, Provinz,
 * Einschiffung und Rolle, Summe der Einheiten hoechstens `stackFullContribution`. Gruppiert in
 * `state.armyOrder`-Reihenfolge, damit dieselbe Lage dieselben Paare in derselben Reihenfolge gibt.
 */
export function zusammenlegbarePaare(state: GameState, rules: Rules, ki: ReadonlySet<PlayerId>): Paar[] {
  const gruppen = new Map<string, Army[]>()
  for (const armyId of state.armyOrder) {
    const army = state.armies[armyId]
    if (!army) continue
    if (!ki.has(army.owner)) continue
    if (army.path.length !== 0) continue
    const rolle = armeeRolle(army, rules)
    const schluessel = `${army.owner}|${army.locationProvinceId}|${army.embarked}|${rolle}`
    const gruppe = gruppen.get(schluessel)
    if (gruppe) gruppe.push(army)
    else gruppen.set(schluessel, [army])
  }

  const paare: Paar[] = []
  for (const gruppe of gruppen.values()) {
    for (let i = 0; i < gruppe.length; i++) {
      for (let j = i + 1; j < gruppe.length; j++) {
        const x = gruppe[i]!
        const y = gruppe[j]!
        const summe = armeeEinheiten(x, rules) + armeeEinheiten(y, rules)
        if (summe > rules.constants.stackFullContribution) continue
        const [a, b] = [x.id, y.id].sort()
        paare.push({ owner: x.owner, provinceId: x.locationProvinceId, embarked: x.embarked, rolle: armeeRolle(x, rules), a: a!, b: b! })
      }
    }
  }
  return paare
}

export const paarSchluessel = (p: Paar): string => `${p.a}|${p.b}`
export const ortSchluessel = (p: Paar): string => `${p.owner}|${p.provinceId}|${p.embarked}|${p.rolle}`

/**
 * `economyOverview(...)[resource].balance` minus Unterhalt der eigenen Aushebungs-Warteschlange
 * fuer einen Tag (E3) — die schon befohlene Aushebung ist Teil der ehrlichen Tagesbilanz, auch
 * wenn der Kern sie erst bei Fertigstellung abbucht.
 */
export function tagesbilanzNachAushebung(
  state: GameState,
  playerId: PlayerId,
  resource: 'money' | 'oil',
  rules: Rules,
): number {
  const overview = economyOverview(state, playerId, rules)
  const ticksPerDay = rules.constants.ticksPerDay
  let abzug = 0
  for (const provinceId of state.provinceOrder) {
    const province = state.provinces[provinceId]
    if (!province) continue
    for (const order of province.recruitQueue) {
      if (order.ownerAtStart !== playerId) continue
      const upkeep = rules.units[order.unitKey]?.upkeep[resource]
      if (!upkeep) continue
      abzug += upkeep * order.count * ticksPerDay
    }
  }
  return overview[resource].balance - abzug
}

/** Wie `canAfford` der KI (`packages/ai/src/economy.ts:17-25`), gegen die Fabrik der Stufe 1. */
export function fabrikBezahlbar(resources: Readonly<Record<ResourceKey, number>>, rules: Rules): boolean {
  const cost = rules.buildings.factory.cost
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    const resource = key as ResourceKey
    const stock = resources[resource] ?? 0
    const reserve = Math.trunc((stock * RESERVE_PERMILLE) / 1000)
    if (stock - reserve < amount) return false
  }
  return true
}

function prozent(teil: number, ganze: number): number {
  if (ganze === 0) return 0
  return Math.round((10000 * teil) / ganze) / 100
}

/** Artillerie an den ausgehobenen Landeinheiten (E9), aus `UNIT_RECRUITED`, nur `ki`. */
export function artillerieAnteil(
  events: readonly GameEvent[],
  rules: Rules,
  ki: ReadonlySet<PlayerId>,
): { artillerie: number; landeinheiten: number; prozent: number } {
  let artillerie = 0
  let landeinheiten = 0
  for (const event of events) {
    if (event.type !== 'UNIT_RECRUITED') continue
    if (!ki.has(event.playerId)) continue
    const rule = rules.units[event.unitKey]
    if (!rule) continue
    if (rule.class === 'artillery') {
      artillerie += event.count
      landeinheiten += event.count
    } else if (rule.class === 'infantry' || rule.class === 'armor') {
      landeinheiten += event.count
    }
  }
  return { artillerie, landeinheiten, prozent: prozent(artillerie, landeinheiten) }
}

export interface TagesEingang {
  state: GameState
  events: readonly GameEvent[]
  applied: readonly { command: Command }[]
}

export interface MachtZahlen {
  stufe: Stufe
  /** Nation der Macht (Nacharbeit T-M42-01: der Schluessel von jeMacht ist PlayerId, nicht Nation). */
  nation: string
  fabrikenBegonnen: number
  fabrikenFertig: number
  tageFabrikBezahlbar: number
  tageStadtOhneFabrik: number
  geldmangelTage: number
  geldmangelTageDurchAushebung: number
  /**
   * Geldmangeltage, deren letzte Aushebung negativ war, aber danach eine Provinz verloren
   * ging — Befund M42-03-a/E5 (T-M43-01, Frage 8): nicht der Aushebung zugerechnet, weil
   * der Verlust dazwischenkam (`m42-zaehlung.test.ts` M8/M9).
   */
  geldmangelTageNachProvinzverlust: number
  oelmangelTage: number
  oelmangelTageDurchAushebung: number
  geldHoechststand: number
  spioneAngeworben: number
  spioneHoechstens: number
  soldHoechstensJeTag: number
  aushebungsTage: number
  tagesbilanzGeldBeiLetzterAushebung: number
  befohlen: Record<string, number>
  ausgehoben: Record<string, number>
  beschuss: number
  kriegeErklaert: number
  ueberfaelle: number
  eroberungen: number
  provinzenVerloren: number
  ausgeschieden: boolean
  groessterStehenderVerband: number
  tageUeberDeckel: number
  batterienHoechstens: number
  verpassteGelegenheiten: number
  verpassteGelegenheitenNurGeld: number
}

export type JeStufeEintrag = Omit<
  MachtZahlen,
  'stufe' | 'nation' | 'ausgeschieden' | 'tagesbilanzGeldBeiLetzterAushebung'
> & {
  maechte: number
}

export interface M42Bericht {
  tagesenden: number
  /** Schluessel PlayerId (state.playerOrder-Reihenfolge), NICHT Nation — die Nation steht je Macht in MachtZahlen.nation (Nacharbeit T-M42-01, Befund: Bauplan-Kommentar sagte "Schluessel Nation"). */
  jeMacht: Record<string, MachtZahlen>
  jeStufe: Partial<Record<Stufe, JeStufeEintrag>>
  truppen: {
    befohlen: Record<string, number>
    ausgehoben: Record<string, number>
    beschuss: number
    artillerieAnteil: { artillerie: number; landeinheiten: number; prozent: number }
  }
  krieg: { kriege: number; ohneErklaerung: number; frieden: number; friedenZwischenKi: number; eroberungen: number }
  heer: {
    groessterStehenderVerband: number
    tageUeberDeckel: number
    tageMitPaar: number
    provinzenMitPaarHoechstens: number
    paareHoechstens: number
    paareUeberZweiTagesenden: number
    tageMitPaarUeberZweiTagesenden: number
    orteMitPaarUeberZweiTagesenden: number
    alteZusage7: { stehendHoechstens: number; stehendTageUeberDrei: number }
    batterienHoechstens: number
  }
  fehler: { marschbefehle: number; noPath: number; noPathAnteilProzent: number; ablehnungen: Record<string, number> }
}

export interface M42Zaehler {
  tagesende(tag: TagesEingang): void
  bericht(): M42Bericht
}

function leereMachtZahlen(stufe: Stufe, nation: string): MachtZahlen {
  return {
    stufe,
    nation,
    fabrikenBegonnen: 0,
    fabrikenFertig: 0,
    tageFabrikBezahlbar: 0,
    tageStadtOhneFabrik: 0,
    geldmangelTage: 0,
    geldmangelTageDurchAushebung: 0,
    geldmangelTageNachProvinzverlust: 0,
    oelmangelTage: 0,
    oelmangelTageDurchAushebung: 0,
    geldHoechststand: 0,
    spioneAngeworben: 0,
    spioneHoechstens: 0,
    soldHoechstensJeTag: 0,
    aushebungsTage: 0,
    tagesbilanzGeldBeiLetzterAushebung: 0,
    befohlen: {},
    ausgehoben: {},
    beschuss: 0,
    kriegeErklaert: 0,
    ueberfaelle: 0,
    eroberungen: 0,
    provinzenVerloren: 0,
    ausgeschieden: false,
    groessterStehenderVerband: 0,
    tageUeberDeckel: 0,
    batterienHoechstens: 0,
    verpassteGelegenheiten: 0,
    verpassteGelegenheitenNurGeld: 0,
  }
}

function addZaehlung(rec: Record<string, number>, key: string, amount: number): void {
  rec[key] = (rec[key] ?? 0) + amount
}

function sortiert(rec: Record<string, number>): Record<string, number> {
  const ausgabe: Record<string, number> = {}
  for (const key of Object.keys(rec).sort()) ausgabe[key] = rec[key]!
  return ausgabe
}

export function m42Zaehler(rules: Rules, ki: ReadonlySet<PlayerId>): M42Zaehler {
  let tagesenden = 0
  const jeMacht: Record<string, MachtZahlen> = {}
  // `verloren`: der Stand von `provinzenVerloren` bei der letzten Aushebung — schon mit
  // den Verlusten DIESES Tages, weil Schritt 3 (Ereignisschleife) vor Schritt 4 (dieser
  // Block) läuft. Ein Verlust am Aushebungstag selbst zählt so noch "durch Aushebung"
  // (M9); nur ein Verlust NACH der letzten Aushebung unterbricht die Zuordnung (E5).
  const letzte: Record<string, { money: number; oil: number; verloren: number }> = {}

  const truppenBefohlen: Record<string, number> = {}
  const truppenAusgehoben: Record<string, number> = {}
  let truppenBeschuss = 0
  let artillerieCount = 0
  let landeinheitenCount = 0

  let kriege = 0
  let ohneErklaerung = 0
  let frieden = 0
  let friedenZwischenKi = 0
  let eroberungenGesamt = 0

  let heerGroessterStehenderVerband = 0
  let heerTageUeberDeckel = 0
  let heerTageMitPaar = 0
  let heerProvinzenMitPaarHoechstens = 0
  let heerPaareHoechstens = 0
  let heerPaareUeberZweiTagesenden = 0
  let heerTageMitPaarUeberZweiTagesenden = 0
  let heerOrteMitPaarUeberZweiTagesenden = 0
  let heerStehendHoechstens = 0
  let heerStehendTageUeberDrei = 0
  let heerBatterienHoechstens = 0

  let gestern = new Set<string>()
  let gestrigeOrte = new Set<string>()

  let fehlerMarschbefehle = 0
  let fehlerAblehnungen: Record<string, number> = {}

  function machtVon(id: PlayerId, state: GameState): MachtZahlen {
    let eintrag = jeMacht[id]
    if (!eintrag) {
      const player = state.players[id]
      const stufe: Stufe = (player?.difficulty ?? 'normal') as Stufe
      eintrag = leereMachtZahlen(stufe, player?.nation ?? id)
      jeMacht[id] = eintrag
    }
    return eintrag
  }

  function tagesende(tag: TagesEingang): void {
    const { state, events, applied } = tag
    tagesenden += 1
    const ticksPerDay = rules.constants.ticksPerDay
    const spieltag = Math.ceil(state.tick / ticksPerDay)

    // Schritt 2: Befehle des Tages, nur ki.
    const recruitsHeute: Record<string, { provinceId: string }[]> = {}
    const rejectedRecruitHeute: Record<string, number> = {}
    const recruitSpyHeute: Record<string, number> = {}
    const moveArmyHeute: Record<string, number> = {}

    for (const eintrag of applied) {
      const command = eintrag.command
      if (!('playerId' in command)) continue
      const playerId = command.playerId
      if (!ki.has(playerId)) continue

      if (command.type === 'RECRUIT') {
        const liste = recruitsHeute[playerId] ?? (recruitsHeute[playerId] = [])
        liste.push({ provinceId: command.provinceId })
        const macht = machtVon(playerId, state)
        addZaehlung(macht.befohlen, command.unitKey, command.count)
        addZaehlung(truppenBefohlen, command.unitKey, command.count)
      } else if (command.type === 'RECRUIT_SPY') {
        recruitSpyHeute[playerId] = (recruitSpyHeute[playerId] ?? 0) + 1
      } else if (command.type === 'MOVE_ARMY') {
        moveArmyHeute[playerId] = (moveArmyHeute[playerId] ?? 0) + 1
        fehlerMarschbefehle += 1
      }
    }

    for (const event of events) {
      if (event.type === 'COMMAND_REJECTED') {
        if (ki.has(event.playerId)) {
          const schluessel = `${event.command}:${event.code}`
          fehlerAblehnungen = { ...fehlerAblehnungen }
          addZaehlung(fehlerAblehnungen, schluessel, 1)
          if (event.command === 'RECRUIT') {
            rejectedRecruitHeute[event.playerId] = (rejectedRecruitHeute[event.playerId] ?? 0) + 1
          }
        }
      } else if (event.type === 'BUILD_STARTED') {
        if (ki.has(event.playerId) && event.building === 'factory') {
          machtVon(event.playerId, state).fabrikenBegonnen += 1
        }
      } else if (event.type === 'BUILD_COMPLETED') {
        if (ki.has(event.playerId) && event.building === 'factory') {
          machtVon(event.playerId, state).fabrikenFertig += 1
        }
      } else if (event.type === 'UNIT_RECRUITED') {
        if (ki.has(event.playerId)) {
          const macht = machtVon(event.playerId, state)
          addZaehlung(macht.ausgehoben, event.unitKey, event.count)
          addZaehlung(truppenAusgehoben, event.unitKey, event.count)
          const rule = rules.units[event.unitKey]
          if (rule?.class === 'artillery') {
            artillerieCount += event.count
            landeinheitenCount += event.count
          } else if (rule?.class === 'infantry' || rule?.class === 'armor') {
            landeinheitenCount += event.count
          }
        }
      } else if (event.type === 'BOMBARDMENT') {
        if (ki.has(event.playerId) && event.automatic) {
          machtVon(event.playerId, state).beschuss += 1
          truppenBeschuss += 1
        }
      } else if (event.type === 'WAR_DECLARED') {
        if (ki.has(event.playerId)) {
          const macht = machtVon(event.playerId, state)
          macht.kriegeErklaert += 1
          kriege += 1
          if (event.withoutDeclaration) {
            macht.ueberfaelle += 1
            ohneErklaerung += 1
          }
        }
      } else if (event.type === 'DIPLOMACY_CHANGED') {
        if (event.newState === 'truce') {
          frieden += 1
          if (ki.has(event.playerId) && ki.has(event.targetPlayerId)) friedenZwischenKi += 1
        }
      } else if (event.type === 'PROVINCE_CAPTURED') {
        if (ki.has(event.newOwner)) {
          machtVon(event.newOwner, state).eroberungen += 1
          eroberungenGesamt += 1
        }
        if (event.previousOwner && ki.has(event.previousOwner)) {
          machtVon(event.previousOwner, state).provinzenVerloren += 1
        }
      }
    }

    // Schritt 4: je KI-Macht, Zustand am Tagesende.
    for (const id of state.playerOrder) {
      if (!ki.has(id)) continue
      const player = state.players[id]
      if (!player) continue
      const macht = machtVon(id, state)

      const recruitsListe = recruitsHeute[id] ?? []
      const rejectedRecruit = rejectedRecruitHeute[id] ?? 0
      const aushebungstag = recruitsListe.length > rejectedRecruit
      if (aushebungstag) {
        macht.aushebungsTage += 1
        const money = tagesbilanzNachAushebung(state, id, 'money', rules)
        const oil = tagesbilanzNachAushebung(state, id, 'oil', rules)
        letzte[id] = { money, oil, verloren: macht.provinzenVerloren }
        macht.tagesbilanzGeldBeiLetzterAushebung = money
      }

      if (player.shortages.includes('money')) {
        macht.geldmangelTage += 1
        const letzteAushebung = letzte[id]
        if (letzteAushebung && letzteAushebung.money < 0) {
          // E5: ein Provinzverlust NACH dieser Aushebung unterbricht die Zuordnung.
          if (macht.provinzenVerloren === letzteAushebung.verloren) macht.geldmangelTageDurchAushebung += 1
          else macht.geldmangelTageNachProvinzverlust += 1
        }
      }
      if (player.shortages.includes('oil')) {
        macht.oelmangelTage += 1
        if ((letzte[id]?.oil ?? 0) < 0) macht.oelmangelTageDurchAushebung += 1
      }

      macht.geldHoechststand = Math.max(macht.geldHoechststand, player.resources.money ?? 0)
      if (fabrikBezahlbar(player.resources, rules)) macht.tageFabrikBezahlbar += 1

      let stadtOhneFabrik = false
      for (const provinceId of state.provinceOrder) {
        const province = state.provinces[provinceId]
        if (!province || province.owner !== id) continue
        if (province.kind === 'city' && (province.buildings.factory ?? 0) === 0) {
          stadtOhneFabrik = true
          break
        }
      }
      if (stadtOhneFabrik) macht.tageStadtOhneFabrik += 1

      let spioneHeute = 0
      let soldHeute = 0
      for (const spy of state.espionage.spies) {
        if (spy.owner !== id) continue
        spioneHeute += 1
        soldHeute += spySalary(rules.constants, spy.mission)
      }
      macht.spioneHoechstens = Math.max(macht.spioneHoechstens, spioneHeute)
      macht.soldHoechstensJeTag = Math.max(macht.soldHoechstensJeTag, soldHeute)
      macht.spioneAngeworben += recruitSpyHeute[id] ?? 0

      // Befund D (E10): nur an einem Aushebungstag, ab Verfuegbarkeit der Artillerie.
      const artillery = rules.units['artillery']
      if (artillery && spieltag >= artillery.availableFromDay && aushebungstag) {
        const ohneFabrik = recruitsListe.some((r) => {
          const province = state.provinces[r.provinceId]
          return (province?.buildings.factory ?? 0) === 0
        })
        if (ohneFabrik) {
          const hatFabrik = state.provinceOrder.some((pid) => {
            const province = state.provinces[pid]
            return province?.owner === id && (province.buildings.factory ?? 0) > 0
          })
          if (hatFabrik) {
            const share = player.difficulty ? rules.ai.difficulties[player.difficulty].recruitShare : 0
            if (share > 0) {
              let alle = true
              for (const [key, amount] of Object.entries(artillery.cost)) {
                if (!amount) continue
                const resource = key as ResourceKey
                const schwelle = Math.ceil((amount * 1000) / share)
                if ((player.resources[resource] ?? 0) < schwelle) alle = false
              }
              const geldKosten = artillery.cost.money ?? 0
              const geldSchwelle = geldKosten ? Math.ceil((geldKosten * 1000) / share) : 0
              const nurGeld = geldKosten === 0 || (player.resources.money ?? 0) >= geldSchwelle
              if (alle) macht.verpassteGelegenheiten += 1
              if (nurGeld) macht.verpassteGelegenheitenNurGeld += 1
            }
          }
        }
      }

      macht.ausgeschieden = !player.alive
    }

    // Schritt 5: Heer (Deckel, Batterien, alte Zusage 7), nur ki, nur einmal ueber armyOrder.
    const batterienJeMacht: Record<string, number> = {}
    const stehendJeOrtProvinz: Record<string, number> = {}
    const ueberDeckelHeute = new Set<PlayerId>()
    let batterienGesamtHeute = 0

    for (const armyId of state.armyOrder) {
      const army = state.armies[armyId]
      if (!army || !ki.has(army.owner)) continue
      if (istBatterie(army, rules)) {
        batterienJeMacht[army.owner] = (batterienJeMacht[army.owner] ?? 0) + 1
        batterienGesamtHeute += 1
      }
      if (army.path.length !== 0) continue

      const einheiten = armeeEinheiten(army, rules)
      const macht = machtVon(army.owner, state)
      macht.groessterStehenderVerband = Math.max(macht.groessterStehenderVerband, einheiten)
      heerGroessterStehenderVerband = Math.max(heerGroessterStehenderVerband, einheiten)
      if (einheiten > rules.constants.stackFullContribution) ueberDeckelHeute.add(army.owner)

      const ortSchluesselStr = `${army.owner}|${army.locationProvinceId}`
      stehendJeOrtProvinz[ortSchluesselStr] = (stehendJeOrtProvinz[ortSchluesselStr] ?? 0) + 1
    }

    for (const [owner, count] of Object.entries(batterienJeMacht)) {
      machtVon(owner, state).batterienHoechstens = Math.max(machtVon(owner, state).batterienHoechstens, count)
    }
    heerBatterienHoechstens = Math.max(heerBatterienHoechstens, batterienGesamtHeute)

    for (const owner of ueberDeckelHeute) {
      machtVon(owner, state).tageUeberDeckel += 1
    }
    if (ueberDeckelHeute.size > 0) heerTageUeberDeckel += 1

    let ueberDreiHeute = false
    for (const count of Object.values(stehendJeOrtProvinz)) {
      heerStehendHoechstens = Math.max(heerStehendHoechstens, count)
      if (count > 3) ueberDreiHeute = true
    }
    if (ueberDreiHeute) heerStehendTageUeberDrei += 1

    // Schritt 6: Paare.
    const paare = zusammenlegbarePaare(state, rules, ki)
    const heute = new Set(paare.map(paarSchluessel))
    const orteHeute = new Set(paare.map(ortSchluessel))

    if (heute.size > 0) heerTageMitPaar += 1
    heerPaareHoechstens = Math.max(heerPaareHoechstens, heute.size)
    heerProvinzenMitPaarHoechstens = Math.max(heerProvinzenMitPaarHoechstens, orteHeute.size)

    let zweiTagesenden = 0
    for (const schluessel of heute) {
      if (gestern.has(schluessel)) zweiTagesenden += 1
    }
    heerPaareUeberZweiTagesenden += zweiTagesenden
    if (zweiTagesenden > 0) heerTageMitPaarUeberZweiTagesenden += 1

    let ortUeberZweiTagesenden = 0
    for (const schluessel of orteHeute) {
      if (gestrigeOrte.has(schluessel)) ortUeberZweiTagesenden += 1
    }
    heerOrteMitPaarUeberZweiTagesenden += ortUeberZweiTagesenden

    gestern = heute
    gestrigeOrte = orteHeute
  }

  function jeStufeBerechnen(): Partial<Record<Stufe, JeStufeEintrag>> {
    const gruppen: Partial<Record<Stufe, MachtZahlen[]>> = {}
    for (const macht of Object.values(jeMacht)) {
      const liste = gruppen[macht.stufe] ?? (gruppen[macht.stufe] = [])
      liste.push(macht)
    }

    const hoechstFelder = new Set<keyof MachtZahlen>([
      'geldHoechststand',
      'spioneHoechstens',
      'soldHoechstensJeTag',
      'groessterStehenderVerband',
      'batterienHoechstens',
    ])
    const summenFelder: (keyof MachtZahlen)[] = [
      'fabrikenBegonnen',
      'fabrikenFertig',
      'tageFabrikBezahlbar',
      'tageStadtOhneFabrik',
      'geldmangelTage',
      'geldmangelTageDurchAushebung',
      'geldmangelTageNachProvinzverlust',
      'oelmangelTage',
      'oelmangelTageDurchAushebung',
      'spioneAngeworben',
      'aushebungsTage',
      'beschuss',
      'kriegeErklaert',
      'ueberfaelle',
      'eroberungen',
      'provinzenVerloren',
      'tageUeberDeckel',
      'verpassteGelegenheiten',
      'verpassteGelegenheitenNurGeld',
    ]

    const ausgabe: Partial<Record<Stufe, JeStufeEintrag>> = {}
    for (const [stufeName, liste] of Object.entries(gruppen) as [Stufe, MachtZahlen[]][]) {
      const summe: Record<string, unknown> = { maechte: liste.length }
      for (const feld of summenFelder) {
        summe[feld] = liste.reduce((acc, macht) => acc + (macht[feld] as number), 0)
      }
      for (const feld of hoechstFelder) {
        summe[feld] = liste.reduce((acc, macht) => Math.max(acc, macht[feld] as number), 0)
      }
      const befohlen: Record<string, number> = {}
      const ausgehoben: Record<string, number> = {}
      for (const macht of liste) {
        for (const [k, v] of Object.entries(macht.befohlen)) addZaehlung(befohlen, k, v)
        for (const [k, v] of Object.entries(macht.ausgehoben)) addZaehlung(ausgehoben, k, v)
      }
      summe['befohlen'] = sortiert(befohlen)
      summe['ausgehoben'] = sortiert(ausgehoben)
      ausgabe[stufeName] = summe as JeStufeEintrag
    }
    return ausgabe
  }

  function bericht(): M42Bericht {
    const jeMachtAusgabe: Record<string, MachtZahlen> = {}
    for (const [id, macht] of Object.entries(jeMacht)) {
      jeMachtAusgabe[id] = { ...macht, befohlen: sortiert(macht.befohlen), ausgehoben: sortiert(macht.ausgehoben) }
    }

    return {
      tagesenden,
      jeMacht: jeMachtAusgabe,
      jeStufe: jeStufeBerechnen(),
      truppen: {
        befohlen: sortiert(truppenBefohlen),
        ausgehoben: sortiert(truppenAusgehoben),
        beschuss: truppenBeschuss,
        artillerieAnteil: { artillerie: artillerieCount, landeinheiten: landeinheitenCount, prozent: prozent(artillerieCount, landeinheitenCount) },
      },
      krieg: { kriege, ohneErklaerung, frieden, friedenZwischenKi, eroberungen: eroberungenGesamt },
      heer: {
        groessterStehenderVerband: heerGroessterStehenderVerband,
        tageUeberDeckel: heerTageUeberDeckel,
        tageMitPaar: heerTageMitPaar,
        provinzenMitPaarHoechstens: heerProvinzenMitPaarHoechstens,
        paareHoechstens: heerPaareHoechstens,
        paareUeberZweiTagesenden: heerPaareUeberZweiTagesenden,
        tageMitPaarUeberZweiTagesenden: heerTageMitPaarUeberZweiTagesenden,
        orteMitPaarUeberZweiTagesenden: heerOrteMitPaarUeberZweiTagesenden,
        alteZusage7: { stehendHoechstens: heerStehendHoechstens, stehendTageUeberDrei: heerStehendTageUeberDrei },
        batterienHoechstens: heerBatterienHoechstens,
      },
      fehler: {
        marschbefehle: fehlerMarschbefehle,
        noPath: fehlerAblehnungen['MOVE_ARMY:NO_PATH'] ?? 0,
        noPathAnteilProzent: prozent(fehlerAblehnungen['MOVE_ARMY:NO_PATH'] ?? 0, fehlerMarschbefehle),
        ablehnungen: sortiert(fehlerAblehnungen),
      },
    }
  }

  return { tagesende, bericht }
}
