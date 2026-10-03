import {
  RECRUIT_MIN_MORALE,
  buildingCostForLevel,
  createInitialState,
  publicView,
  type Command,
  type GameConfig,
} from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { emptyMemory } from './decide'
<<<<<<< HEAD
import {
  RESERVE_PERMILLE,
  economyCommands,
  factoryReserve,
  frontProvinces,
  rankedUnitsFor,
  recruitCommands,
  tradeCommands,
  unitStockOf,
} from './economy'
=======
import { RESERVE_PERMILLE, economyCommands, factoryReserve, rankedUnitsFor, recruitCommands, tradeCommands } from './economy'
>>>>>>> parent of e2fde62 (feat(ai): Festung nur an der Front, im Hinterland nach den Wirtschaftsbauten (T-M42-13, Review Punkt 10, Befund M42-04-a))
import { dailyMoneyIncome } from './finance'
import type { Explanation } from './types'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 404,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

/**
 * Eine KI-Macht mit allen Gebaeuden und vollen Kassen, zu einem bestimmten Tick.
 *
 * Absichtlich reich und vollgebaut: geprueft wird die Freischaltung, nicht das Geld.
 * Waere die Kasse leer, waeren beide Zusicherungen unten gruen, ohne etwas zu belegen —
 * die KI baute dann ja ohnehin nichts.
 */
function richContext(tick: number) {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tick
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    if (province.owner !== 'p2') continue
    for (const key of Object.keys(TEST_RULES.buildings)) {
      province.buildings = { ...province.buildings, [key]: 1 }
    }
  }
  const resources = state.players['p2']!.resources as Record<string, number>
  for (const key of Object.keys(resources)) resources[key] = 50_000_000

  return {
    view: publicView(state, 'p2'),
    memory: state.ai['p2'] ?? emptyMemory(600),
    rules: TEST_RULES,
    map,
    difficulty: TEST_RULES.ai.difficulties.normal,
  }
}


/**
 * Die KI wählt nichts, was es noch nicht gibt (T-M15-03, R-TECH-02/AK2).
 *
 * Der zweite Teil der Anforderung ist kein Schönheitsfehler. Ein Befehl, den der Kern
 * jeden Tag ablehnt, ist Rauschen im Protokoll statt Verhalten — und die KI fasste ihn
 * bis zum 2026-09-06 in jedem Tick neu, weil sie ihn nie ausführen konnte. Dasselbe
 * Muster hat schon 3046 von 4464 Marschbefehlen als `NO_PATH` enden lassen (T-M14-11).
 */
describe('R-TECH-02/AK2 Die KI kennt die Freischaltung', () => {
  it('baut an Spieltag 1 nichts, was es erst spaeter gibt', () => {
    const context = richContext(0)
    const commands = economyCommands(context, [])

    const zuFrueh = commands
      .filter((command): command is Extract<Command, { type: 'BUILD' }> => command.type === 'BUILD')
      .filter((command) => context.rules.buildings[command.building]!.availableFromDay > 1)

    expect(zuFrueh.map((command) => command.building), 'Bauauftrag vor dem Freischaltungstag').toEqual([])
  })

  it('hebt an Spieltag 1 nichts aus, was es erst spaeter gibt', () => {
    const context = richContext(0)
    const commands = recruitCommands(context, [])

    const zuFrueh = commands
      .filter((command): command is Extract<Command, { type: 'RECRUIT' }> => command.type === 'RECRUIT')
      .filter((command) => context.rules.units[command.unitKey]!.availableFromDay > 1)

    expect(zuFrueh.map((command) => command.unitKey), 'Aushebung vor dem Freischaltungstag').toEqual([])
  })

  it('greift spaeter sehr wohl zu — sonst baut sie nie wieder etwas', () => {
    // Die Gegenrichtung. Ein Filter, der alles wegwirft, bestuende die beiden
    // Zusicherungen oben makellos und machte die KI handlungsunfaehig.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    const commands = economyCommands(context, [])

    expect(commands.length, 'die KI baut auch an Tag 31 nichts').toBeGreaterThan(0)
  })
})

describe('R-AI-08/AK3 Die KI handelt, bevor der Mangel da ist', () => {
  it('tauscht fuer das naechste Bauvorhaben, ohne dass etwas knapp ist', () => {
    // Der teuerste Befund des Meilensteins: gehandelt wurde **erst bei eingetretenem
    // Mangel** — und ein Mangel heißt, dass ein Vorrat schon aufgebraucht ist. Wer erst
    // dann tauscht, tauscht immer zu spät und nie für etwas, das er *vorhat*. Auf der
    // Testkarte baute die KI dadurch über 150 Spieltage keine einzige Fabrik.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    // Reich an allem außer Holz — die Fabrik kostet Holz, ein Mangel liegt nicht vor.
    ;(context.view.self.resources as Record<string, number>).wood = 1000
    expect(context.view.self.shortages.length, 'die Lage soll gerade keinen Mangel zeigen').toBe(0)

    const commands = tradeCommands(context, [])
    const trade = commands.find((command) => command.type === 'TRADE')

    expect(trade, 'kein Tauschbefehl trotz fehlendem Baustoff').toBeDefined()
    if (trade?.type === 'TRADE') expect(trade.want).toBe('wood')
  })

  it('tauscht nicht, wenn nichts fehlt', () => {
    // Die Gegenrichtung: eine KI, die in jedem Tick tauscht, verbrennt am Markt Geld —
    // und die Zusicherung oben wäre auch dann grün.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)

    expect(tradeCommands(context, [])).toEqual([])
  })

  it('nimmt die dringlichste Einheit, die auch bezahlbar ist', () => {
    // Vorher wurde genau eine gewählt — die mit dem größten Rückstand — und wenn die
    // unbezahlbar war, ging die Provinz leer aus. Gemessen: 3322 Infanteristen, 15 Panzer,
    // **0 Artillerie**, weil der Panzer den größeren Rückstand hat und am Öl scheitert.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    ;(context.view.self.resources as Record<string, number>).oil = 0

    const commands = recruitCommands(context, [])
    const recruit = commands.find((command) => command.type === 'RECRUIT')

    expect(recruit, 'kein Aushebungsbefehl trotz vollem Lager').toBeDefined()
    if (recruit?.type === 'RECRUIT') {
      expect(recruit.unitKey, 'ohne Öl darf kein Panzer gewählt werden').not.toBe('tank')
    }
  })

  it('hebt nicht aus, wo die Moral unter der Aushebungsgrenze liegt (R-AI-09/AK2)', () => {
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    context.view.provinces = context.view.provinces.map((province) =>
      province.owner === 'p2' ? { ...province, morale: RECRUIT_MIN_MORALE - 1 } : province,
    )

    expect(recruitCommands(context, []).some((command) => command.type === 'RECRUIT'), 'keine Aushebung unter der Moralgrenze').toBe(
      false,
    )

    const eineProvinz = context.view.provinces.find((province) => province.owner === 'p2')!
    const angehoben = context.view.provinces.map((province) =>
      province.id === eineProvinz.id ? { ...province, morale: RECRUIT_MIN_MORALE } : province,
    )
    const angehobenerContext = { ...context, view: { ...context.view, provinces: angehoben } }

    expect(
      recruitCommands(angehobenerContext, []).some(
        (command) => command.type === 'RECRUIT' && command.provinceId === eineProvinz.id,
      ),
      'genau ab der Grenze darf diese Provinz wieder aufnehmen',
    ).toBe(true)
  })
})

/**
 * Die KI baut die Fabrik aus (T-M41-01, R-PROV-02, R-AI-08).
 *
 * Befund aus T-M34-04: `nextBuildingFor` fragte fuer Kaserne, Fabrik, Eisenbahn und Hafen
 * `level === 0` — keine Macht kam je ueber Fabrikstufe 1. Die zweite Fortschrittsachse war
 * eine fuer den Menschen allein. Gebaut wird nur die Fabrik aus, und nur in Staedten
 * (DECISIONS.md, 2026-09-13).
 */
describe('R-PROV-02 Die KI baut die Fabrik ueber Stufe 1 hinaus aus', () => {
  const tag31 = 30 * TEST_RULES.constants.ticksPerDay
  const bauten = (context: ReturnType<typeof richContext>) =>
    economyCommands(context, []).filter(
      (command): command is Extract<Command, { type: 'BUILD' }> => command.type === 'BUILD',
    )
  /** Setzt eine Gebaeudestufe in allen eigenen Provinzen der Sicht. */
  const stufe = (context: ReturnType<typeof richContext>, building: string, level: number) => {
    for (const province of context.view.provinces) {
      if (province.owner !== 'p2' || !province.buildings) continue
      ;(province.buildings as Record<string, number>)[building] = level
    }
  }

  it('befiehlt in einer Stadt mit Fabrik der Stufe 1 und genug Mitteln den Ausbau', () => {
    const context = richContext(tag31)
    const [bau] = bauten(context)
    const provinz = context.view.provinces.find((province) => province.id === bau?.provinceId)

    expect(bau?.building, 'kein Fabrikausbau trotz vollem Lager').toBe('factory')
    expect(provinz?.kind).toBe('city')
    expect(provinz?.buildings?.factory).toBe(1)
  })

  it('baut nicht ueber die hoechste Stufe der Regel hinaus', () => {
    const context = richContext(tag31)
    stufe(context, 'factory', TEST_RULES.buildings.factory.maxLevel)
    const gebaut = bauten(context).map((command) => command.building)

    expect(gebaut, 'bei maxLevel wird nichts mehr gebaut - der Test saehe den Fabrikbau nicht').not.toEqual([])
    expect(gebaut).not.toContain('factory')
  })

  it('baut die Fabrik nur in Staedten', () => {
    const context = richContext(tag31)
    ;(context.view as { provinces: typeof context.view.provinces }).provinces = context.view.provinces.filter(
      (province) => province.owner !== 'p2' || province.kind !== 'city',
    )

    expect(bauten(context).map((command) => command.building)).not.toContain('factory')
  })

  it('baut in einer Stadt mit Fabrik 1 die Eisenbahn, wenn Stufe 2 zu teuer ist (Nacharbeit, H1)', () => {
    // Befund H1 der Durchsicht M41: `nextBuildingFor` lieferte fuer jede Stadt mit einer Fabrik
    // unter maxLevel nur noch "factory"; war diese Stufe zu teuer, sprang `economyCommands` zur
    // naechsten Provinz — Eisenbahn, Festung und Hafen kamen in der Stadt erst nach Fabrikstufe 3,
    // oft nie. Gemessen in der Vollpartie mit Startzahl 1815: Russland haelt am Ende 48 Staedte,
    // 36 davon mit Fabrik und ohne Eisenbahn.
    const context = richContext(tag31)
    stufe(context, 'railway', 0)
    const vorrat = context.view.self.resources as Record<string, number>
    for (const key of Object.keys(vorrat)) vorrat[key] = 1_000_000

    // Die Lage, die der Test braucht, und nicht nur behauptet: nach der Ruecklage sind 800.000
    // frei — zu wenig fuer Fabrikstufe 2, genug fuer die Eisenbahn.
    const frei = 800_000
    const fabrik2 = buildingCostForLevel(TEST_RULES.buildings.factory, 2, TEST_RULES.constants)
    const eisenbahn = buildingCostForLevel(TEST_RULES.buildings.railway, 1, TEST_RULES.constants)
    expect(Object.values(fabrik2).some((menge) => (menge ?? 0) > frei), 'Fabrikstufe 2 waere bezahlbar').toBe(true)
    expect(Object.values(eisenbahn).every((menge) => (menge ?? 0) <= frei), 'Eisenbahn waere zu teuer').toBe(true)

    const [bau] = bauten(context)
    const provinz = context.view.provinces.find((province) => province.id === bau?.provinceId)

    expect(`${bau?.building} in ${provinz?.kind}`).toBe('railway in city')
    expect(provinz?.buildings?.factory).toBe(1)
  })

  it('baut nicht in einer Provinz, die sie nur noch erinnert (T-M41-09)', () => {
    // Befund der Untersuchung zu T-M41-08: alle 213 BUILD:NOT_OWNER auf der Weltkarte zielten
    // auf Provinzen, die die Sicht als `stale` mit dem eigenen Besitzer von damals fuehrte;
    // tatsaechlich gehoerten sie laengst einem Gegner. Die Erinnerung zeigt keine Gebaeude, also
    // wollte die KI dort eine Kaserne — und weil nur ein Bau je Denkschritt entsteht, verdraengte
    // der Geisterbau den echten Bau des Tages.
    const context = richContext(tag31)
    const stadt = context.view.provinces.find((province) => province.owner === 'p2' && province.kind === 'city')!
    const erinnert = { ...stadt, id: 'erinnert', stale: true }
    // Die Erinnerung fuehrt weder Gebaeude noch Bauschlange (publicView, `stale`).
    delete erinnert.buildings
    delete erinnert.buildQueueLength
    ;(context.view as { provinces: typeof context.view.provinces }).provinces = [erinnert, ...context.view.provinces]

    const ziele = bauten(context).map((command) => command.provinceId)

    expect(ziele, 'die KI baut gar nichts mehr - der Test saehe den Filter nicht').not.toEqual([])
    expect(ziele).not.toContain('erinnert')
  })

  it('handelt nicht fuer einen Bau in einer erinnerten Provinz (T-M41-09)', () => {
    // Dieselbe Liste speist `missingForNextBuilding`: ohne Filter tauschte die KI Rohstoffe fuer
    // einen Bauauftrag, den der Kern ablehnen wird.
    const context = richContext(tag31)
    // Jede sichtbare eigene Provinz ist fertig — wie im Haltetest unten.
    stufe(context, 'factory', TEST_RULES.buildings.factory.maxLevel)
    stufe(context, 'fortress', 2)
    const stadt = context.view.provinces.find((province) => province.owner === 'p2' && province.kind === 'city')!
    const erinnert = { ...stadt, id: 'erinnert', stale: true }
    // Die Erinnerung fuehrt weder Gebaeude noch Bauschlange (publicView, `stale`).
    delete erinnert.buildings
    delete erinnert.buildQueueLength
    ;(context.view as { provinces: typeof context.view.provinces }).provinces = [erinnert, ...context.view.provinces]
    ;(context.view.self.resources as Record<string, number>).wood = 1000
    expect(context.view.self.shortages.length, 'die Lage soll gerade keinen Mangel zeigen').toBe(0)

    expect(tradeCommands(context, [])).toEqual([])
  })

  it('weicht auch in einer Landprovinz mit Kaserne auf den naechsten Wunsch aus (Durchsicht M2)', () => {
    // Haltetest fuer das heutige Verhalten, kein neues: die Ausweichliste aus der Nacharbeit zu H1
    // gilt fuer jede Provinz mit Kaserne, nicht nur fuer Staedte mit Fabrik. Vorher ging eine
    // Landprovinz leer aus, wenn die Eisenbahn zu teuer war, und die Suche lief zur naechsten
    // Provinz. Gemessen ist das nur in der Summe der Laeufe zu H1 (PROBLEME.md, 2026-09-13).
    const context = richContext(tag31)
    ;(context.view as { provinces: typeof context.view.provinces }).provinces = context.view.provinces.filter(
      (province) => province.owner !== 'p2' || province.kind !== 'city',
    )
    stufe(context, 'railway', 0)
    stufe(context, 'fortress', 0)
    ;(context.view.self.resources as Record<string, number>).coal = 0

    // Die Lage, die der Test braucht: die Eisenbahn kostet Kohle, die Festung nicht.
    const eisenbahn = buildingCostForLevel(TEST_RULES.buildings.railway, 1, TEST_RULES.constants)
    const festung = buildingCostForLevel(TEST_RULES.buildings.fortress, 1, TEST_RULES.constants)
    expect((eisenbahn as Record<string, number>).coal ?? 0, 'die Eisenbahn waere ohne Kohle bezahlbar').toBeGreaterThan(0)
    expect((festung as Record<string, number>).coal ?? 0, 'die Festung braucht Kohle').toBe(0)

    const [bau] = bauten(context)
    const provinz = context.view.provinces.find((province) => province.id === bau?.provinceId)

    expect(`${bau?.building} in ${provinz?.kind}`).toBe('fortress in rural')
    expect(provinz?.buildings?.barracks).toBe(1)
    expect(provinz?.buildings?.railway).toBe(0)
  })

  it('HALTETEST: baut Kaserne, Eisenbahn und Hafen nie ueber Stufe 1 aus', () => {
    // Gemessen an vier Varianten (DECISIONS.md, 2026-09-13, T-M41-01): die Kaserne Stufe 2
    // reisst R-AI-06 — schwer gegen normal im Frieden 1,00 statt 0,70 gegen die Obergrenze
    // 0,95 in apps/headless/test/tournament.slow.test.ts —, die Eisenbahn aendert nichts.
    // Wer diesen Test loescht, liest zuerst den Entscheid und faehrt danach das Turnier.
    const context = richContext(tag31)
    // Fabrik und Festung sind ausgebaut, sonst kaeme die KI an den anderen nie vorbei.
    stufe(context, 'factory', TEST_RULES.buildings.factory.maxLevel)
    stufe(context, 'fortress', 2)

    expect(bauten(context).map((command) => `${command.building} in ${command.provinceId}`)).toEqual([])
  })
})

/**
 * T-M42-03 (R-AI-11/AK2, D32.4): die Aushebung prueft die Tagesbilanz.
 *
 * `bilanzLage` baut Spieltag 31 (Tick 30*24) auf der Testwelt: alle eigenen Provinzen mit jedem
 * Gebaeude auf Stufe 1 (bei `fabrik: false` danach `factory: 0` — Panzer und Artillerie fallen
 * dann aus `rankedUnitsFor` heraus, Infanterie bleibt der einzige Kandidat, Artillerie ist an
 * Tag 31 ohnehin erst ab Tag 34 verfuegbar), 50 Mio. je Rohstoff (die Bilanz soll die Grenze
 * setzen, nicht die Kaufkraft), optional eine Infanterie-Armee und ein eigener Gegenspion in
 * `o1`. Der Ertrag wird gemessen, nicht hart geschrieben (§3.3 des Bauplans).
 */
describe('R-AI-11/AK2 Die KI hebt nur aus, was ihre Tagesbilanz traegt', () => {
  function bilanzLage(o: { infanterie: number; fabrik: boolean; spion?: boolean }) {
    const state = createInitialState(CONFIG, ctx)
    state.tick = 30 * TEST_RULES.constants.ticksPerDay
    const eigene = state.provinceOrder.filter((id) => state.provinces[id]!.owner === 'p2')
    for (const id of eigene) {
      const province = state.provinces[id]!
      for (const key of Object.keys(TEST_RULES.buildings)) {
        province.buildings = { ...province.buildings, [key]: 1 }
      }
      if (!o.fabrik) province.buildings = { ...province.buildings, factory: 0 }
    }
    const resources = state.players['p2']!.resources as Record<string, number>
    for (const key of Object.keys(resources)) resources[key] = 50_000_000
    if (o.infanterie > 0) {
      placeArmy(state, { owner: 'p2', at: eigene[0]!, units: [{ unitKey: 'infantry', hpTotal: o.infanterie * 1000 }] })
    }
    if (o.spion) {
      state.espionage.spies.push({
        id: 's901',
        owner: 'p2',
        provinceId: 'o1',
        mission: 'counter',
        recruitedTick: 0,
        assignedTick: 0,
        lastRunTick: null,
        lastOutcome: null,
      })
    }
    return {
      view: publicView(state, 'p2'),
      memory: emptyMemory(600),
      rules: TEST_RULES,
      map,
      difficulty: TEST_RULES.ai.difficulties.normal,
    }
  }

  const I = dailyMoneyIncome(bilanzLage({ infanterie: 0, fabrik: false }).view, TEST_RULES)
  const k = Math.floor(I / 1440)

  it('Vorbedingung: der Ertrag der Lage ist deterministisch (Sonde: 59645, k=41)', () => {
    // Kein Rauschen (Befund T-M42-03/niedrig): dieselbe Lage liefert immer denselben Ertrag,
    // die Sonde ist der Wert selbst und keine Bandbreite.
    expect(I).toBe(59645)
    expect(k).toBe(41)
  })

  it('E1: die Tagesbilanz traegt keine weitere Einheit — kein RECRUIT, begruendet', () => {
    const context = bilanzLage({ infanterie: k, fabrik: false })
    const spielraum = I - k * 1440
    expect(spielraum, 'Spielraum im erwarteten Bereich [0, 1440)').toBeGreaterThanOrEqual(0)
    expect(spielraum).toBeLessThan(1440)

    const explanations: Explanation[] = []
    const commands = recruitCommands(context, explanations)

    expect(commands.some((c) => c.type === 'RECRUIT')).toBe(false)
    const unterbleibt = explanations.filter((e) => e.action === 'Aushebung unterbleibt')
    expect(unterbleibt).toHaveLength(1)
    expect(unterbleibt[0]!.reason).toContain('Tagesbilanz')
  })

  it('E2: die Tagesbilanz traegt genau sieben', () => {
    const context = bilanzLage({ infanterie: k - 7, fabrik: false })
    const spielraum = I - (k - 7) * 1440
    expect(spielraum, 'Spielraum im erwarteten Bereich [7*1440, 8*1440)').toBeGreaterThanOrEqual(7 * 1440)
    expect(spielraum).toBeLessThan(8 * 1440)

    const commands = recruitCommands(context, [])
    const recruit = commands.find((c) => c.type === 'RECRUIT')
    expect(recruit?.unitKey).toBe('infantry')
    expect(recruit?.count).toBe(7)
  })

  it('E3: grosser Bestand bei schon negativer Tagesbilanz — trotzdem kein RECRUIT', () => {
    const context = bilanzLage({ infanterie: k + 10, fabrik: false })
    const spielraum = I - (k + 10) * 1440
    expect(spielraum, 'die Bilanz ist bereits negativ').toBeLessThan(0)
    expect(context.view.self.resources.money).toBeGreaterThan(spielraum * -1)

    const explanations: Explanation[] = []
    const commands = recruitCommands(context, explanations)

    expect(commands.some((c) => c.type === 'RECRUIT')).toBe(false)
    expect(explanations.some((e) => e.reason.includes('Tagesbilanz trägt keine weitere Einheit'))).toBe(true)
  })

  it('E4: der Sold zaehlt mit — ohne Spion noch eine Einheit, mit Spion keine', () => {
    const ohne = bilanzLage({ infanterie: k - 1, fabrik: false })
    const spielraumOhne = I - (k - 1) * 1440
    expect(spielraumOhne, 'ohne Spion traegt genau eine weitere Einheit [1440, 2880)').toBeGreaterThanOrEqual(1_440)
    expect(spielraumOhne).toBeLessThan(2_880)
    const commandsOhne = recruitCommands(ohne, [])
    expect(commandsOhne.find((c) => c.type === 'RECRUIT')?.count).toBe(1)

    const mit = bilanzLage({ infanterie: k - 1, fabrik: false, spion: true })
    const spielraumMit = spielraumOhne - 5_076
    expect(spielraumMit, 'mit dem Sold des Gegenspions wird die Bilanz negativ').toBeLessThan(0)
    const commandsMit = recruitCommands(mit, [])
    expect(commandsMit.some((c) => c.type === 'RECRUIT')).toBe(false)
  })

  it('E5: die Rangfolge faellt auf die tragbare Einheit (Panzer zuerst, aber Infanterie bezahlbar)', () => {
    const context = bilanzLage({ infanterie: k - 1, fabrik: true })
    const spielraum = I - (k - 1) * 1440
    expect(spielraum, 'zwischen einer Infanterie und einem Panzer je Tag').toBeGreaterThanOrEqual(1_440)
    expect(spielraum).toBeLessThan(2_232)

    const eigeneProvinz = context.view.provinces.find((p) => p.owner === 'p2')!
    expect(rankedUnitsFor(context, eigeneProvinz)[0], 'ohne Bilanzpruefung waere der Panzer vorn').toBe('tank')

    const commands = recruitCommands(context, [])
    const recruit = commands.find((c) => c.type === 'RECRUIT')
    expect(recruit?.unitKey).toBe('infantry')
    expect(recruit?.count).toBe(1)
  })

  it('E6: reichlich Bilanz aendert nichts (Haltetest)', () => {
    const context = bilanzLage({ infanterie: 0, fabrik: false })

    const explanations: Explanation[] = []
    const commands = recruitCommands(context, explanations)
    const recruit = commands.find((c) => c.type === 'RECRUIT')

    expect(recruit?.unitKey).toBe('infantry')
    expect(recruit?.count).toBe(15)
    expect(explanations.some((e) => e.reason.includes('Tagesbilanz'))).toBe(false)
  })

  it('E7: die Begrenzung ist begruendet', () => {
    const context = bilanzLage({ infanterie: k - 7, fabrik: false })
    const explanations: Explanation[] = []
    recruitCommands(context, explanations)

    const begruendung = explanations.find((e) => e.action.includes('infantry'))
    expect(begruendung, 'eine Begruendung fuer die Aushebung').toBeDefined()
    expect(begruendung!.reason).toContain('Tagesbilanz')
    expect(begruendung!.reason).toContain('7')
  })
})

/**
 * T-M42-06 (R-AI-12/AK1, D32.7): Erst die Fabrik.
 *
 * `fabrikLage` baut einen Spieltag auf der Testwelt: Ostmark (p2) haelt die Stadt `o1` und die
 * Landprovinzen `o2`, `o3`; jede mit Kaserne, keine Fabrik, keine Eisenbahn, keine Festung. Der
 * Vorrat ist so gesetzt, dass die Fabrik ueber der Ruecklage **nicht** bezahlbar ist, Eisenbahn,
 * Festung und Kaserne aber schon (`vorrat`, Vorbedingung je Fall). Nahrung ist reichlich — sie
 * soll die Aushebung nicht begrenzen.
 */
describe('R-AI-12/AK1 Erst die Fabrik', () => {
  const tpd = TEST_RULES.constants.ticksPerDay
  const fabrikTag = TEST_RULES.buildings.factory.availableFromDay
  const fabrikKosten = buildingCostForLevel(TEST_RULES.buildings.factory, 1, TEST_RULES.constants) as Record<string, number>
  /** Genau der Bestand, bei dem canAfford die Fabrik traegt (D32.7): aufgerundet kosten * 1000 / 800. */
  const erwarteterVorbehalt = Object.fromEntries(
    Object.entries(fabrikKosten)
      .filter(([, menge]) => menge > 0)
      .map(([key, menge]) => [key, Math.ceil((menge * 1000) / (1000 - RESERVE_PERMILLE))]),
  )

  function fabrikLage(o: {
    tag?: number
    vorrat?: number
    /** Kaserne in `o2` (sonst keine). */
    kaserneO2?: boolean
    /** Fabrik in `o1`. */
    fabrikO1?: number
    /** Eigene zweite Stadt `m1` mit dieser Fabrikstufe (undefined: m1 bleibt herrenlos). */
    zweiteStadtFabrik?: number
  }) {
    const state = createInitialState(CONFIG, ctx)
    state.tick = ((o.tag ?? fabrikTag + 3) - 1) * tpd
    if (o.zweiteStadtFabrik !== undefined) state.provinces['m1']!.owner = 'p2'
    for (const id of state.provinceOrder) {
      const province = state.provinces[id]!
      if (province.owner !== 'p2') continue
      province.buildings = { barracks: 1 }
    }
    state.provinces['o1']!.buildings = { barracks: 1, factory: o.fabrikO1 ?? 0 }
    if (o.kaserneO2 === false) state.provinces['o2']!.buildings = {}
    if (o.zweiteStadtFabrik !== undefined) state.provinces['m1']!.buildings = { barracks: 1, factory: o.zweiteStadtFabrik }
    const resources = state.players['p2']!.resources as Record<string, number>
    for (const key of Object.keys(resources)) resources[key] = o.vorrat ?? 700_000
    resources['food'] = 50_000_000
    return {
      view: publicView(state, 'p2'),
      memory: emptyMemory(600),
      rules: TEST_RULES,
      map,
      difficulty: TEST_RULES.ai.difficulties.normal,
    }
  }
  /** Setzt `buildQueueLength` einer Provinz in der Sicht (die Sicht der KI traegt nur die Laenge). */
  const schlange = (context: ReturnType<typeof fabrikLage>, provinceId: string, laenge: number) => {
    context.view.provinces = context.view.provinces.map((province) =>
      province.id === provinceId ? { ...province, buildQueueLength: laenge } : province,
    )
  }
  const bauten = (context: ReturnType<typeof fabrikLage>) =>
    economyCommands(context, []).filter(
      (command): command is Extract<Command, { type: 'BUILD' }> => command.type === 'BUILD',
    )
  const setzeVorrat = (context: ReturnType<typeof fabrikLage>, werte: Record<string, number>) => {
    const vorrat = context.view.self.resources as Record<string, number>
    for (const [key, menge] of Object.entries(werte)) vorrat[key] = menge
  }

  // --- factoryReserve, die reine Frage -------------------------------------------------------

  it('V1: Stadt ohne Fabrik, Fabrik freigeschaltet -> Vorbehalt = Kosten der ersten Fabrik samt Ruecklage', () => {
    expect(Object.keys(erwarteterVorbehalt).length, 'die Fabrik kostet nichts - der Test saehe nichts').toBeGreaterThan(0)
    expect(factoryReserve(fabrikLage({}))).toEqual(erwarteterVorbehalt)
  })

  it('V2: genau der Vorbehalt traegt die Fabrik ueber der Ruecklage (canAfford-Zwilling)', () => {
    for (const [key, wert] of Object.entries(erwarteterVorbehalt)) {
      const frei = wert - Math.trunc((wert * RESERVE_PERMILLE) / 1000)
      expect(frei, key).toBeGreaterThanOrEqual(fabrikKosten[key]!)
    }
  })

  it('V2b: rundet auf, nicht ab, wenn die Kosten den Teiler nicht glatt teilen (Nacharbeit Etappe 1, Befund niedrig)', () => {
    // Bei den echten Fabrikkosten (V1/V2) ist amount * 1000 fuer jeden betroffenen
    // Rohstoff durch den Teiler (800) restlos teilbar - Aufrundung und Abrundung
    // liefern deshalb zufaellig denselben Wert, und keiner der beiden bestehenden
    // Faelle unterscheidet sie. Ein Rohstoff, dessen Kosten das NICHT tun, macht
    // die Rundungsrichtung sichtbar: fuer 1 (Fixed) ergibt Aufrundung 2, Abrundung 1.
    const context = fabrikLage({})
    context.rules = {
      ...context.rules,
      buildings: { ...context.rules.buildings, factory: { ...context.rules.buildings.factory, cost: { wood: 1 } } },
    }
    expect(factoryReserve(context)).toEqual({ wood: 2 })
  })

  it('V3: vor der Freischaltung aus, ab dem Freischaltungstag an', () => {
    expect(factoryReserve(fabrikLage({ tag: fabrikTag - 1 }))).toBeNull()
    expect(factoryReserve(fabrikLage({ tag: fabrikTag }))).not.toBeNull()
  })

  it('V4: ohne sichtbare eigene Stadt aus (auch nicht mit einer nur erinnerten)', () => {
    const ohneStadt = fabrikLage({})
    ohneStadt.view.provinces = ohneStadt.view.provinces.filter((province) => province.id !== 'o1')
    expect(factoryReserve(ohneStadt)).toBeNull()

    const erinnert = fabrikLage({})
    erinnert.view.provinces = erinnert.view.provinces.map((province) =>
      province.id === 'o1' ? { ...province, stale: true } : province,
    )
    expect(factoryReserve(erinnert)).toBeNull()
  })

  it('V5: Fabrik vorhanden -> aus, auch wenn eine zweite Stadt noch keine hat (nur bis zur ersten)', () => {
    expect(factoryReserve(fabrikLage({ fabrikO1: 1 }))).toBeNull()
    expect(factoryReserve(fabrikLage({ zweiteStadtFabrik: 1 })), 'm1 mit Fabrik, o1 ohne').toBeNull()
    expect(factoryReserve(fabrikLage({ zweiteStadtFabrik: 0 })), 'Gegenprobe: zwei Staedte ohne Fabrik').not.toBeNull()
  })

  it('V6: Fabrik "im Bau" (Stadt ohne Fabrik, mit Kaserne, Schlange > 0) -> aus', () => {
    const context = fabrikLage({})
    schlange(context, 'o1', 1)
    expect(factoryReserve(context)).toBeNull()
  })

  it('V7: Schlange > 0 in einer Stadt ohne Kaserne ist die erste Kaserne, nicht die Fabrik -> an', () => {
    const context = fabrikLage({})
    context.view.provinces = context.view.provinces.map((province) =>
      province.id === 'o1' ? { ...province, buildings: { factory: 0 }, buildQueueLength: 1 } : province,
    )
    expect(factoryReserve(context)).not.toBeNull()
  })

  it('V8: bekannte Unschaerfe - ein Kasernenausbau in der Schlange liest sich wie die Fabrik (D32.7)', () => {
    // Die Sicht der KI traegt nur die Laenge der Schlange (runner.ts, D18.2). Eine Stadt mit
    // Kaserne, ohne Fabrik und mit einem Kasernenausbau in der Schlange ist fuer sie von einer
    // Stadt mit Fabrik im Bau nicht zu unterscheiden. Die KI selbst baut Kasernen nie aus
    // (HALTETEST oben); nur ein Mensch koennte das. Wer das Merkmal schaerfer macht, dreht
    // diesen Test um.
    const context = fabrikLage({})
    schlange(context, 'o1', 1) // gemeint: Kaserne Stufe 2
    expect(factoryReserve(context)).toBeNull()
  })

  // --- economyCommands: andere Bauten ausser der Kaserne unterbleiben ------------------------

  it('B1: Stadt ohne Fabrik, Bestand darunter -> kein Bau von Eisenbahn, Festung oder Hafen', () => {
    const context = fabrikLage({})
    // Die Lage, die der Test braucht: ueber der Ruecklage ist die Fabrik zu teuer, die Eisenbahn nicht.
    const frei = 700_000 - Math.trunc((700_000 * RESERVE_PERMILLE) / 1000)
    const eisenbahn = buildingCostForLevel(TEST_RULES.buildings.railway, 1, TEST_RULES.constants)
    expect(Object.values(fabrikKosten).some((menge) => menge > frei), 'die Fabrik waere bezahlbar').toBe(true)
    expect(Object.values(eisenbahn).every((menge) => (menge ?? 0) <= frei), 'die Eisenbahn waere zu teuer').toBe(true)

    const gebaut = bauten(context).map((command) => `${command.building} in ${command.provinceId}`)
    expect(gebaut.filter((b) => /^(railway|fortress|harbour) /.test(b)), 'Bau trotz Vorbehalt').toEqual([])
    expect(gebaut).toEqual([])
  })

  it('B2: eine Kaserne ja', () => {
    const context = fabrikLage({ kaserneO2: false })
    expect(bauten(context).map((command) => `${command.building} in ${command.provinceId}`)).toEqual(['barracks in o2'])
  })

  it('B3: die Fabrik selbst, sobald sie bezahlbar ist (Haltetest)', () => {
    const context = fabrikLage({ vorrat: 50_000_000 })
    expect(bauten(context).map((command) => `${command.building} in ${command.provinceId}`)).toEqual(['factory in o1'])
  })

  it('B4: Fabrik im Bau -> die Eisenbahn ist wieder erlaubt (Gegenrichtung)', () => {
    const context = fabrikLage({})
    schlange(context, 'o1', 1)
    const gebaut = bauten(context).map((command) => command.building)
    expect(gebaut, 'der Vorbehalt geht nie aus').toEqual(['railway'])
  })

  it('B5: der Vorbehalt ist begruendet (R-AI-05)', () => {
    const explanations: Explanation[] = []
    economyCommands(fabrikLage({}), explanations)
    expect(explanations.some((e) => e.action.includes('erste Fabrik'))).toBe(true)
  })

  // --- recruitCommands: ausgehoben wird nur ueber dem Vorbehalt -------------------------------

  /** Holz und Geld = Vorbehalt + `ueber`; Nahrung reichlich; alles andere 0. */
  function aushebungsLage(ueber: number, fabrikO1 = 0) {
    const context = fabrikLage({ vorrat: 0, fabrikO1 })
    setzeVorrat(context, {
      food: 50_000_000,
      wood: erwarteterVorbehalt['wood']! + ueber,
      money: erwarteterVorbehalt['money']! + ueber,
    })
    return context
  }
  const aushebung = (context: ReturnType<typeof fabrikLage>, explanations: Explanation[] = []) =>
    recruitCommands(context, explanations).find(
      (command): command is Extract<Command, { type: 'RECRUIT' }> => command.type === 'RECRUIT',
    )

  it('A1: ausgehoben wird nur aus dem Bestand ueber dem Vorbehalt', () => {
    // Ueber dem Vorbehalt 1 005 000: 20 % davon = 201 000 Geld -> 3 Infanterien zu 67 000.
    // Ohne Vorbehalt waeren es 20 % von 1 838 750 = 367 750 -> 5.
    const context = aushebungsLage(1_005_000)
    const infanterie = TEST_RULES.units['infantry']!.cost as Record<string, number>
    const share = TEST_RULES.ai.difficulties.normal.recruitShare
    const ohne = Math.min(
      ...Object.entries(infanterie)
        .filter(([, menge]) => menge > 0)
        .map(([key, menge]) => Math.trunc(Math.trunc((context.view.self.resources[key as 'money'] * share) / 1000) / menge)),
    )
    expect(ohne, 'ohne Vorbehalt mehr als mit - sonst saehe der Test nichts').toBeGreaterThan(3)

    const recruit = aushebung(context)
    expect(recruit?.unitKey).toBe('infantry')
    expect(recruit?.count).toBe(3)
    const explanations: Explanation[] = []
    aushebung(aushebungsLage(1_005_000), explanations)
    expect(explanations.find((e) => e.action.includes('infantry'))?.reason).toContain('erste Fabrik')
  })

  it('A2: reicht der Bestand ueber dem Vorbehalt fuer keine Einheit, keine Aushebung - begruendet', () => {
    const explanations: Explanation[] = []
    const recruit = aushebung(aushebungsLage(300_000), explanations)
    expect(recruit, 'Aushebung aus dem Vorbehalt').toBeUndefined()
    const unterbleibt = explanations.filter((e) => e.action === 'Aushebung unterbleibt')
    expect(unterbleibt).toHaveLength(1)
    expect(unterbleibt[0]!.reason).toContain('erste Fabrik')
  })

  it('A3: mit Fabrik kein Vorbehalt - derselbe Bestand hebt mehr aus (Haltetest)', () => {
    const recruit = aushebung(aushebungsLage(1_005_000, 1))
    expect(recruit?.count, 'mit Fabrik haelt die KI nichts zurueck').toBeGreaterThan(3)
  })
})

/**
 * T-M42-05 (R-AI-10/AK1, D32.6): die Truppenmischung zaehlt Einheiten, nicht Stapel.
 *
 * Bis hierher zaehlte `rankedUnitsFor` je Stapel eine 1 (`economy.ts`, vormals Zeile 226-227): drei
 * Infanteriearmeen zu je fuenf und eine Batterie zu eins waren "75 % Infanterie", nach dem
 * Verschmelzen derselben Truppen "50 %" - das Zusammenlegen aenderte, was die KI als Naechstes
 * aushebt. In Einheiten sind es vorher und nachher 15 zu 1.
 */
describe('R-AI-10/AK1 Die Truppenmischung zaehlt Einheiten (T-M42-05)', () => {
  const tpd = TEST_RULES.constants.ticksPerDay
  const hp = (unitKey: string) => TEST_RULES.units[unitKey]!.hpPerUnit

  function heerLage(armeen: { unitKey: string; einheiten: number }[][]) {
    const context = richContext(40 * tpd)
    const eigene = context.view.provinces.find((province) => province.owner === 'p2')!
    context.view.armies = [
      ...context.view.armies.filter((army) => army.owner !== 'p2'),
      ...armeen.map((stapel, index) => ({
        id: `a${900 + index}`,
        owner: 'p2',
        provinceId: eigene.id,
        units: stapel.map(({ unitKey, einheiten }) => ({ unitKey, hpTotal: einheiten * hp(unitKey) })),
        strength: 0,
      })),
    ]
    return { context, provinz: eigene }
  }

  it('M1: drei Infanteriearmeen zu je fuenf plus eine Batterie zu eins - Rangfolge vor und nach dem Verschmelzen gleich', () => {
    const vorher = heerLage([
      [{ unitKey: 'infantry', einheiten: 5 }],
      [{ unitKey: 'infantry', einheiten: 5 }],
      [{ unitKey: 'infantry', einheiten: 5 }],
      [{ unitKey: 'artillery', einheiten: 1 }],
    ])
    const nachher = heerLage([[{ unitKey: 'infantry', einheiten: 15 }], [{ unitKey: 'artillery', einheiten: 1 }]])

    const rangVorher = rankedUnitsFor(vorher.context, vorher.provinz)
    expect(rangVorher, 'Vorbedingung: alle drei Arten sind in der Provinz baubar').toHaveLength(3)
    expect(rankedUnitsFor(nachher.context, nachher.provinz)).toEqual(rangVorher)
  })

  it('M2: 15 000 HP Infanterie sind 15 Einheiten, nicht ein Stapel', () => {
    const { context } = heerLage([[{ unitKey: 'infantry', einheiten: 15 }]])
    expect(hp('infantry')).toBe(1000)
    const bestand = unitStockOf(context)
    expect(bestand.owned.get('infantry')).toBe(15)
    expect(bestand.total).toBe(15)
  })

  it('M3: angeschlagene Stapel zaehlen wie im Kern (aufgerundet, unitCount)', () => {
    const { context } = heerLage([[{ unitKey: 'infantry', einheiten: 2 }]])
    context.view.armies = context.view.armies.map((army) =>
      army.owner === 'p2' ? { ...army, units: [{ unitKey: 'infantry', hpTotal: 1_001 }] } : army,
    )
    expect(unitStockOf(context).owned.get('infantry'), '1001 HP sind zwei angeschlagene Infanteristen').toBe(2)
  })

  it('M4: fremde Armeen zaehlen nicht mit', () => {
    const { context } = heerLage([[{ unitKey: 'infantry', einheiten: 3 }]])
    context.view.armies = [
      ...context.view.armies,
      { id: 'a999', owner: 'p1', provinceId: 'n1', units: [{ unitKey: 'artillery', hpTotal: 50 * hp('artillery') }], strength: 0 },
    ]
    expect(unitStockOf(context).total).toBe(3)
  })

  it('M5: der uebergebene Bestand entspricht dem selbst gebildeten', () => {
    const { context, provinz } = heerLage([
      [{ unitKey: 'infantry', einheiten: 7 }, { unitKey: 'artillery', einheiten: 2 }],
      [{ unitKey: 'tank', einheiten: 1 }],
    ])
    const bestand = unitStockOf(context)
    expect(bestand.total).toBe(10)
    expect(rankedUnitsFor(context, provinz, bestand)).toEqual(rankedUnitsFor(context, provinz))
    // Und der uebergebene Bestand wird wirklich gelesen, nicht neu gebildet.
    const nurPanzer = { owned: new Map([['tank', 10]]), total: 10 }
    expect(rankedUnitsFor(context, provinz, nurPanzer)[0]).toBe('infantry')
  })
})
