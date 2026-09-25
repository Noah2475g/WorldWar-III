import { readFileSync } from 'node:fs'
import {
  canApply,
  createInitialState,
  exchangeAmount,
  parseRules,
  publicView,
  relationKey,
  step,
  SPY_MISSIONS,
  type Army,
  type Command,
  type GameState,
  type MapData,
  type PlayerId,
  type Spy,
  type SpyMission,
} from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import {
  armyActions,
  buildActions,
  capitalAction,
  diplomacyActions,
  offerListActions,
  ownArmiesIn,
  passageActions,
  planArrival,
  cancelActions,
  nextUnlock,
  recruitActions,
  spyActions,
  spyOverviewActions,
  spySummary,
  targetAction,
  tradeOfferAction,
  tradePreview,
  unitLines,
  type ActionContext,
  type TradeDraft,
} from './actions.ts'
import { hasKey, t } from '../i18n/text.ts'
import { amount } from '../ui/format.ts'
import { UNIT_ART } from '../ui/art.tsx'
import { SPY_MISSION_ICONS, UNIT_ICONS } from '../ui/icons.tsx'
import { describeRejection, SPY_REASON_KEYS } from './rejections.ts'
import { DEFAULT_NEW_GAME, toConfig } from './newGame.ts'

/**
 * Every order as a button (T-M10-05, T-M10-06, R-UI-05).
 *
 * The first smoke test found a province panel with one button — "build a barracks" —
 * and an army panel with none. Recruiting, marching, diplomacy and the market were
 * finished in the core and unreachable from the screen. These tests hold the panel to
 * the rule the panels state for themselves: every order listed, the impossible ones
 * greyed out with a reason in words, the possible ones with their price.
 */

const ROOT = process.cwd()
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
const map = load('data/maps/world.json') as MapData
const rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)

function fresh(): { ctx: ActionContext; capital: string; neighbour: string } {
  const state = createInitialState(toConfig({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', opponents: 3 }, map), {
    map,
    rules,
  })
  const capital = state.players.p1!.capitalProvinceId!
  const edge = map.edgesByProvince[capital]!.map((i) => map.edges[i]!).find((e) => e.kind === 'land')!
  const neighbour = edge.a === capital ? edge.b : edge.a
  return { ctx: { state, map, rules, playerId: 'p1', ticksPerDay: rules.constants.ticksPerDay }, capital, neighbour }
}

const RAW_KEY = /\b(barracks|harbour|infantry|wood|iron|p\d)\b|\{\{/

function withArmy(state: GameState, where: string, hp = 3000, owner = 'p1', path: string[] = []): Army {
  const id = `a${state.armyOrder.length + 1}`
  const army: Army = {
    id,
    owner,
    name: `Armee ${state.armyOrder.length + 1}`,
    locationProvinceId: where,
    units: [{ unitKey: 'infantry', hpTotal: hp }],
    path,
    arrivalTick: null,
    departureTick: null,
    deployDelayUntil: 0,
    stance: 'defensive',
    embarked: false,
    cannotAttackUntil: 0,
    bombardTarget: null,
    holdFire: false,
  }
  state.armies[army.id] = army
  state.armyOrder = [...state.armyOrder, army.id]
  return army
}

describe('R-PROV-01 Bauen: jedes Gebaeude ist ein Knopf mit Preis', () => {
  it('listet jedes Gebaeude der Regeln, die Kaserne bezahlbar mit Kosten und Dauer', () => {
    const { ctx, capital } = fresh()
    const actions = buildActions(ctx, capital)

    expect(actions.map((a) => a.id)).toEqual(Object.keys(rules.buildings).map((key) => `build-${key}`))
    const barracks = actions.find((a) => a.id === 'build-barracks')!
    expect(barracks.disabledReason).toBeNull()
    expect(barracks.hint).toContain('Material')
    expect(barracks.hint).toContain('1 Tag')
  })

  it('nennt bei jedem ausgegrauten Knopf den Grund in Worten', () => {
    const { ctx, capital } = fresh()
    for (const action of buildActions(ctx, capital)) {
      if (action.disabledReason === null) continue
      expect(action.disabledReason.length).toBeGreaterThan(10)
      expect(action.disabledReason).not.toMatch(RAW_KEY)
    }
  })

  it('sagt, was fehlt, wenn die Kasse leer ist', () => {
    const { ctx, capital } = fresh()
    ctx.state.players.p1!.resources.wood = 0

    const barracks = buildActions(ctx, capital).find((a) => a.id === 'build-barracks')!
    expect(barracks.disabledReason).toBe('Es fehlt an Rohstoffen: 333 Material.')
  })
})

describe('R-UNIT-02 Ausheben braucht das Gebaeude und nennt die Anfangsstaerke', () => {
  it('graut ohne Kaserne jede Einheit aus, mit dem Namen des fehlenden Gebaeudes', () => {
    const { ctx, capital } = fresh()
    const infantry = recruitActions(ctx, capital).find((a) => a.id === 'recruit-infantry')!

    expect(infantry.disabledReason).toContain('Kaserne')
    expect(infantry.disabledReason).not.toMatch(RAW_KEY)
  })

  it('haengt jeder Einheit ihr Bild an, ohne das Zeichen anzutasten (T-M33-02)', () => {
    // Zwei Saetze nebeneinander: die Glyphe bleibt, weil Alarme und Tagesbericht sie
    // weiter lesen; das Bild kommt dazu, weil die Liste es zeigen kann und die Karte nicht.
    const { ctx, capital } = fresh()
    const actions = recruitActions(ctx, capital)

    expect(actions.length).toBe(Object.keys(rules.units).length)
    for (const action of actions) {
      const key = action.id.replace('recruit-', '')
      expect(action.art, `${key} ohne Bild`).toBe(UNIT_ART[key])
      expect(action.icon, `${key} hat sein Zeichen verloren`).toBe(UNIT_ICONS[key])
    }
    expect(new Set(actions.map((action) => action.art)).size).toBe(actions.length)
  })

  it('bietet Infanterie an, sobald die Kaserne steht — mit Dauer und Anfangsstaerke', () => {
    const { ctx, capital } = fresh()
    ctx.state.provinces[capital]!.buildings.barracks = 1

    const infantry = recruitActions(ctx, capital).find((a) => a.id === 'recruit-infantry')!
    expect(infantry.disabledReason).toBeNull()
    expect(infantry.hint).toMatch(/\d+ h|Tag/)
    // Start morale is 70: a province that raises soldiers at seventy per cent says so.
    expect(infantry.hint).toContain('Anfangsstärke 70 %')
  })
})

describe('R-UNIT-03/04 Armeebefehle', () => {
  it('sagt bei JEDEM Armeebefehl, was er kostet', () => {
    // Playtest 25a: Rueckzug, Marschieren, Angriff und Teilen trugen keinen Hinweis,
    // waehrend die Bauknoepfe seit M10 "333 Material, 250 Geld · 1 Tag" vormachen.
    // R-UI-05 gilt fuer jede Aktion, nicht fuer die billigen.
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    for (const action of armyActions(ctx, 'a1')) {
      expect(action.hint, `Befehl "${action.id}" ohne Hinweis`).toBeTruthy()
    }
  })

  it('nennt beim Rueckzug die Zahlen der Regeln, nicht erfundene', () => {
    // Steht der Wert im Text statt in den Regeln, hat das Spiel zwei Wahrheiten und
    // eine davon aendert sich beim naechsten Balancing nicht mit.
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const retreat = armyActions(ctx, 'a1').find((a) => a.id === 'stance-retreat')!
    expect(retreat.hint).toContain(`${Math.round(ctx.rules.constants.retreatLossPermille / 10)} %`)
  })
})

/**
 * Vier Haltungen, ihre Hinweise und das Anhalten (T-M40-05, T-M40-11, R-UNIT-09/AK6).
 *
 * Eigener Block, damit das Anforderungstor das Kriterium findet: es zaehlt `describe`-Namen, und bis
 * T-M40-12 stand AK6 nur in den Namen zweier `it` innerhalb von R-UNIT-03/04.
 */
describe('R-UNIT-09/AK6 Vier Haltungen, ihre Hinweise und das Anhalten', () => {
  it('bietet vier Haltungen an, und jeder Hinweis sagt, was die Armee von selbst tut oder laesst (R-UNIT-09/AK6)', () => {
    // Eine Automatik, die niemand erklaert, findet niemand (D30.7). Und der alte Hinweis zu
    // „Angriff" — „greift von sich aus an, was in Reichweite kommt" — beschrieb eine Wirkung,
    // die es nie gab: `aggressive` wurde bis M40 von keinem Rechenweg gelesen.
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const haltungen = armyActions(ctx, 'a1').filter((a) => a.id.startsWith('stance-'))
    expect(haltungen.map((a) => a.id)).toEqual(['stance-aggressive', 'stance-defensive', 'stance-retreat', 'stance-garrison'])

    const hinweis = Object.fromEntries(haltungen.map((a) => [a.id.replace('stance-', ''), a.hint ?? '']))
    for (const [haltung, text] of Object.entries(hinweis)) {
      expect(text, `${haltung}: der Hinweis nennt weder die Automatik noch ihr Fehlen`).toMatch(/von selbst/)
      expect(text, haltung).not.toMatch(RAW_KEY)
    }
    // Was genau von selbst geschieht, und was es kostet (D30.4 seit T-M40-10, Befund M3 der Durchsicht).
    // Bis T-M40-10 stand hier „weichend", „nicht stärker" und „angegriffene eigene Nachbarprovinz" —
    // die Verfolgung ist entfallen, und die Deckung rueckt nur noch nach, wenn eine Armee stehen bleibt.
    expect(hinweis.defensive).toMatch(/eingegraben/)
    expect(hinweis.defensive).toMatch(/weitere Armee/)
    expect(hinweis.defensive).toMatch(/allein marschiert sie nie/)
    // Die Ruhe nach Marsch und Rueckzug: fuenf Spieltage aus ADJUTANT_REST_TICKS, nicht aus dem Text —
    // und seit T-M40-14 woertlich ab dem Abmarsch (Befund H-A), und was ein eigener Marschbefehl tut.
    expect(hinweis.defensive).toMatch(/5 Tage ab dem Abmarsch/)
    expect(hinweis.defensive).toMatch(/eigener Marschbefehl stellt sie auf Garnison/)
    expect(hinweis.aggressive).toMatch(/Angriffswerten/)
    expect(hinweis.aggressive).toMatch(/eingegraben/)
    expect(hinweis.aggressive).toMatch(/nie von selbst/)
    expect(hinweis.aggressive).not.toMatch(/weichend|folgt/)
    expect(hinweis.defensive).not.toMatch(/solange dort noch gekämpft wird/)
    expect(hinweis.garrison).toMatch(/nie von selbst/)
    // Nach dem Rueckzug steht die Armee auf Verteidigung (`phases/retreat.ts`).
    expect(hinweis.retreat).toMatch(/Verteidigung/)
    expect(hinweis.aggressive).not.toMatch(/greift von sich aus an/i)
  })

  it('stellt eine Armee auf Verteidigung beim Anhalten auf Garnison, jede andere haelt nur an (R-UNIT-09/AK6, T-M40-11)', () => {
    // Befund H2 der Durchsicht: der Adjutant schickte eine Verteidigung los, der Spieler klickte
    // „Anhalten" — und im naechsten Tick marschierte sie wieder (Beleg S2). Seit T-M40-10 handelt nur
    // noch `defensive` von selbst; eine Armee auf Angriff oder Garnison haelt nur an, sonst aenderte
    // der Klick ungefragt ihre Kampfwerte.
    const marschiert = (stance: Army['stance']) => {
      const { ctx, capital, neighbour } = fresh()
      const army = withArmy(ctx.state, capital)
      army.stance = stance
      army.path = [neighbour]
      army.departureTick = ctx.state.tick
      army.arrivalTick = ctx.state.tick + 30
      return armyActions(ctx, 'a1').find((a) => a.id === 'stop')!
    }

    const verteidigung = marschiert('defensive')
    expect(verteidigung.disabledReason).toBeNull()
    expect(verteidigung.command).toEqual({ type: 'STOP_ARMY', playerId: 'p1', armyId: 'a1' })
    expect(verteidigung.followUp).toEqual({ type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'garrison' })
    expect(verteidigung.hint).toMatch(/Garnison/)

    for (const stance of ['aggressive', 'garrison', 'retreat'] as const) {
      const anhalten = marschiert(stance)
      expect(anhalten.command, stance).toEqual({ type: 'STOP_ARMY', playerId: 'p1', armyId: 'a1' })
      expect(anhalten.followUp, stance).toBeUndefined()
      expect(anhalten.hint, stance).not.toMatch(/Garnison/)
    }
  })

  it('stellt eine Armee auf Verteidigung mit dem eigenen Marschbefehl auf Garnison, jede andere marschiert nur (R-UNIT-09/AK7, T-M40-14)', () => {
    // Befund H-A der Durchsicht der Nacharbeit: die Ruhe zaehlt ab dem Abmarsch, und nach einem langen
    // Marsch schickte die Automatik die eben verlegte Armee weiter (Szenario R1).
    const verlegen = (stance: Army['stance']) => {
      const { ctx, capital, neighbour } = fresh()
      const army = withArmy(ctx.state, capital)
      army.stance = stance
      return {
        neighbour,
        bestaetigen: targetAction(ctx, 'a1', 'move', neighbour),
        marschieren: armyActions(ctx, 'a1').find((a) => a.id === 'march')!,
      }
    }

    const verteidigung = verlegen('defensive')
    expect(verteidigung.bestaetigen.disabledReason).toBeNull()
    expect(verteidigung.bestaetigen.command).toEqual({
      type: 'MOVE_ARMY',
      playerId: 'p1',
      armyId: 'a1',
      targetProvinceId: verteidigung.neighbour,
    })
    expect(verteidigung.bestaetigen.followUp).toEqual({ type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'garrison' })
    expect(verteidigung.bestaetigen.hint).toMatch(/Garnison/)
    expect(verteidigung.marschieren.hint).toMatch(/Garnison/)

    for (const stance of ['aggressive', 'garrison', 'retreat'] as const) {
      const andere = verlegen(stance)
      expect(andere.bestaetigen.followUp, stance).toBeUndefined()
      expect(andere.bestaetigen.hint ?? '', stance).not.toMatch(/Garnison/)
      expect(andere.marschieren.hint, stance).not.toMatch(/Garnison/)
    }
  })

  it('sieht gesammelte Haltungswechsel: eine eben auf Verteidigung geklickte Garnison geht mit Marsch und Anhalten auf Garnison (T-M40-19, Befund N-5)', () => {
    // Die Uhr steht, der Klick auf „Verteidigung" wartet in der Sammlung der Huelle (`pending`), und der Zustand
    // sagt noch Garnison. Bis T-M40-19 fragte der Folgebefehl nur den Zustand.
    const { ctx, capital, neighbour } = fresh()
    const army = withArmy(ctx.state, capital)
    army.stance = 'garrison'
    const verteidigung: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'defensive' }
    const garnison: Command = { type: 'SET_STANCE', playerId: 'p1', armyId: 'a1', stance: 'garrison' }
    const gesammelt: ActionContext = { ...ctx, pending: [verteidigung] }

    expect(targetAction(ctx, 'a1', 'move', neighbour).followUp, 'ohne Sammlung').toBeUndefined()
    const bestaetigen = targetAction(gesammelt, 'a1', 'move', neighbour)
    expect(bestaetigen.followUp).toEqual(garnison)
    expect(bestaetigen.hint).toMatch(/Garnison/)
    expect(armyActions(gesammelt, 'a1').find((a) => a.id === 'march')!.hint).toMatch(/Garnison/)

    army.path = [neighbour]
    army.departureTick = ctx.state.tick
    army.arrivalTick = ctx.state.tick + 30
    expect(armyActions(gesammelt, 'a1').find((a) => a.id === 'stop')!.followUp).toEqual(garnison)

    // Die Gegenrichtung: eine Verteidigung, die eben auf Garnison geklickt wurde, marschiert ohne zweiten Befehl.
    army.stance = 'defensive'
    army.path = []
    army.departureTick = null
    army.arrivalTick = null
    const umgestellt: ActionContext = { ...ctx, pending: [garnison] }
    expect(targetAction(umgestellt, 'a1', 'move', neighbour).followUp).toBeUndefined()
    expect(armyActions(umgestellt, 'a1').find((a) => a.id === 'march')!.hint).not.toMatch(/Garnison/)
  })
})

describe('R-UNIT-03/04 Armeebefehle (Fortsetzung)', () => {
  it('bietet Marsch, Haltung und Teilen an und begruendet den Rest', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const byId = Object.fromEntries(armyActions(ctx, 'a1').map((a) => [a.id, a]))
    expect(byId.march!.disabledReason).toBeNull()
    expect(byId.march!.targetKind).toBe('move')
    expect(byId.stop!.disabledReason).toContain('steht bereits')
    expect(byId['stance-defensive']!.disabledReason).toContain('schon')
    expect(byId['stance-aggressive']!.disabledReason).toBeNull()
    expect(byId.merge!.disabledReason).toContain('Keine zweite')
    expect(byId.split!.disabledReason).toBeNull()
    expect(byId.bombard!.disabledReason).toContain('Reichweite')
  })

  it('legt zwei Armeen am selben Ort zusammen und teilt keine zu kleine', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)
    const second: Army = { ...withArmy(ctx.state, capital, 1), id: 'a2', name: 'Armee 2' }
    ctx.state.armies.a2 = second
    ctx.state.armyOrder = ['a1', 'a2']

    const byId = Object.fromEntries(armyActions(ctx, 'a1').map((a) => [a.id, a]))
    expect(byId.merge!.disabledReason).toBeNull()
    expect(byId.merge!.command).toMatchObject({ type: 'MERGE_ARMIES', armyIds: ['a1', 'a2'] })

    const tiny = Object.fromEntries(armyActions(ctx, 'a2').map((a) => [a.id, a]))
    expect(tiny.split!.disabledReason).toContain('Zu klein')
  })

  it('sagt vor dem Marschbefehl, wann die Armee ankommt', () => {
    const { ctx, capital, neighbour } = fresh()
    withArmy(ctx.state, capital)

    const plan = planArrival(ctx, 'a1', neighbour)
    expect(plan).not.toBeNull()
    expect(plan!.arrivalTick).toBeGreaterThan(ctx.state.tick)
    expect(plan!.text).toMatch(/^Ankunft/)

    const confirm = targetAction(ctx, 'a1', 'move', neighbour)
    expect(confirm.disabledReason).toBeNull()
    expect(confirm.command).toMatchObject({ type: 'MOVE_ARMY', targetProvinceId: neighbour })
  })

  it('lehnt den Marsch an den eigenen Standort mit dem Grund ab', () => {
    const { ctx, capital } = fresh()
    withArmy(ctx.state, capital)

    const confirm = targetAction(ctx, 'a1', 'move', capital)
    expect(confirm.disabledReason).toContain('bereits dort')
  })

  it('zaehlt die Einheiten einer Armee in Worten und findet die Armeen einer Provinz', () => {
    const { ctx, capital } = fresh()
    const army = withArmy(ctx.state, capital, 3000)

    expect(unitLines(army, rules)).toEqual(['3 × Infanterie'])
    // Seit T-M20-03 traegt die Zeile auch die vorherrschende Gattung — dieselbe, die die
    // Karte auf die Armeemarke zeichnet.
    expect(ownArmiesIn(ctx, capital)).toEqual([
      { id: 'a1', name: 'Armee 1', strength: 3000, icon: 'infantry' },
    ])
  })
})

describe('R-DIP-01 Diplomatie und R-ECON-05 Markt', () => {
  it('bietet die Kriegserklaerung an und begruendet, was nicht geht', () => {
    const { ctx } = fresh()
    const byId = Object.fromEntries(diplomacyActions(ctx, 'p2').map((a) => [a.id, a]))

    expect(byId['diplomacy-declareWar']!.disabledReason).toBeNull()
    expect(byId['diplomacy-offerPeace']!.disabledReason).toContain('nur im Krieg')
    expect(byId['diplomacy-acceptPeace']!.disabledReason).toContain('kein Angebot')
    for (const action of Object.values(byId)) {
      if (action.disabledReason) expect(action.disabledReason).not.toMatch(RAW_KEY)
    }
  })

  it('nennt vor dem Tausch den Gegenwert und lehnt Gleiches gegen Gleiches ab', () => {
    const { ctx } = fresh()

    const trade = tradePreview(ctx, 'wood', 100_000, 'iron')
    expect(trade.wantAmount).toBeGreaterThan(0)
    expect(trade.text).toMatch(/^Ergibt etwa \d+ Eisen\.$/)
    expect(trade.action.disabledReason).toBeNull()

    const same = tradePreview(ctx, 'wood', 100_000, 'wood')
    expect(same.text).toBe('Dafür gibt es nichts.')
    expect(same.action.disabledReason).toContain('gleiche Ressource')
  })

  it('macht aus der Hauptstadt keinen Knopf fuer die Hauptstadt', () => {
    const { ctx, capital } = fresh()
    expect(capitalAction(ctx, capital).disabledReason).not.toBeNull()
  })
})

describe('R-UI-07 Ablehnungen in Worten', () => {
  it('rechnet eine Sperre in Tage um und nennt den Waffenstillstand beim Namen', () => {
    const { ctx } = fresh()
    ctx.state.tick = 10

    expect(describeRejection({ code: 'ON_COOLDOWN', detail: { readyAtTick: 58 } }, null, ctx)).toBe(
      'Das geht erst wieder in 2 Tagen.',
    )
    expect(describeRejection({ code: 'ON_COOLDOWN', detail: { reason: 'Waffenstillstand' } }, null, ctx)).toContain(
      'Waffenstillstand',
    )
  })

  it('uebersetzt das fehlende Gebaeude', () => {
    const { ctx } = fresh()
    expect(describeRejection({ code: 'MISSING_BUILDING', detail: { required: 'harbour' } }, null, ctx)).toBe(
      'Dafür fehlt das Gebäude: Hafen.',
    )
  })
})

/**
 * Die Freischaltung erreicht den Bildschirm (T-M15-03, R-TECH-02).
 *
 * T-M15-02 hat den Riegel gebaut; ohne diese Aufgabe erführe der Spieler davon nur, dass
 * ein Knopf grau ist. Ein gesperrter Knopf, der nicht sagt *wann*, ist schlimmer als
 * keiner: er sieht aus wie ein Fehler im Spiel statt wie eine Regel.
 */
describe('R-TECH-02/AK1 Ein gesperrter Knopf nennt seinen Tag', () => {
  /** Die Zahl im Text — der Tag, den der Spieler lesen soll. */
  const mentionsDay = (text: string | null | undefined, day: number): boolean =>
    typeof text === 'string' && new RegExp(String.raw`\b${day}\b`).test(text)

  it('nennt an Spieltag 1 fuer jedes Gebaeude entweder nichts oder den Tag', () => {
    const { ctx, capital } = fresh()
    const actions = buildActions(ctx, capital)

    expect(actions.length).toBe(Object.keys(rules.buildings).length)

    const stumm = actions.filter((action) => {
      const key = action.id.replace('build-', '')
      const day = rules.buildings[key as keyof typeof rules.buildings]!.availableFromDay
      if (day <= 1) return false
      // Gesperrt sein darf er aus jedem Grund — aber der Tag muss irgendwo stehen.
      return !mentionsDay(action.disabledReason, day) && !mentionsDay(action.hint, day)
    })

    expect(stumm.map((action) => action.id), 'Knopf ohne Freischaltungstag').toEqual([])
  })

  it('nennt an Spieltag 1 fuer jede Einheit entweder nichts oder den Tag', () => {
    const { ctx, capital } = fresh()
    const actions = recruitActions(ctx, capital)

    expect(actions.length).toBe(Object.keys(rules.units).length)

    const stumm = actions.filter((action) => {
      const key = action.id.replace('recruit-', '')
      const day = rules.units[key]!.availableFromDay
      if (day <= 1) return false
      return !mentionsDay(action.disabledReason, day) && !mentionsDay(action.hint, day)
    })

    expect(stumm.map((action) => action.id), 'Knopf ohne Freischaltungstag').toEqual([])
  })

  it('nennt den Tag im Tooltip, auch wenn der Knopf zusaetzlich am Geld haengt', () => {
    // Der Fall, an dem eine Anzeige sonst scheitert: zwei Gründe, und der Spieler liest
    // nur den, den der Kern zuerst prüft. Heute gewinnt der Tag, weil die Prüfung vor
    // der Kasse steht — aber das ist eine Reihenfolge im Kern, keine Zusage der
    // Oberfläche. Der Tag gehört deshalb **zusätzlich** in den Tooltip, der die Sache
    // beschreibt und nicht ihren jeweils dringendsten Hinderungsgrund.
    const { ctx, capital } = fresh()
    for (const key of Object.keys(ctx.state.players.p1!.resources)) {
      ctx.state.players.p1!.resources[key as 'money'] = 0
    }

    const airfield = buildActions(ctx, capital).find((action) => action.id === 'build-airfield')
    // Der Tag kommt aus dem Regelwerk, nicht aus dem Test: seit T-M34-03 ist er 40 statt
    // 10, und die Zusicherung gilt der Mechanik und nicht der Zahl.
    const tag = rules.buildings.airfield.availableFromDay
    expect(tag, 'der Flugplatz ist ab Tag 1 zu haben — dann belegt der Test nichts').toBeGreaterThan(1)
    expect(airfield?.disabledReason, 'kein Grund trotz leerer Kasse').not.toBeNull()
    expect(mentionsDay(airfield?.hint, tag), `Tooltip ohne Tag ${tag}: ${airfield?.hint}`).toBe(true)
  })

  it('laesst den Tag aus dem Tooltip, sobald er gekommen ist', () => {
    // Sonst stünde bis zum Partieende "ab Spieltag 1" an der Kaserne — eine Auskunft,
    // die nur beim ersten Lesen etwas heißt und danach Rauschen ist.
    const { ctx, capital } = fresh()
    ctx.state.tick = 40 * ctx.ticksPerDay

    for (const action of buildActions(ctx, capital)) {
      expect(action.hint ?? '', `${action.id} nennt nach der Freischaltung noch einen Tag`).not.toMatch(/Spieltag/)
    }
  })

  it('uebersetzt NOT_YET_AVAILABLE in einen Satz mit dem Tag', () => {
    const { ctx } = fresh()
    const text = describeRejection(
      { code: 'NOT_YET_AVAILABLE', detail: { availableFromDay: 8, building: 'factory' } },
      null,
      ctx,
    )

    expect(text).toMatch(/\b8\b/)
    expect(text, 'der Rohschluessel erreicht den Spieler').not.toContain('NOT_YET_AVAILABLE')
  })

  it('sperrt nach dem Freischaltungstag nicht mehr aus diesem Grund', () => {
    // Die Gegenrichtung: die Zusicherungen oben waeren auch dann gruen, wenn alles fuer
    // immer gesperrt bliebe.
    const { ctx, capital } = fresh()
    ctx.state.tick = 40 * ctx.ticksPerDay

    const airfield = buildActions(ctx, capital).find((action) => action.id === 'build-airfield')
    expect(airfield?.disabledReason ?? '').not.toMatch(/Spieltag/)
  })
})

/**
 * T-M28-16 · Zwei Abbrechen-Knöpfe müssen unterscheidbar sein.
 *
 * Befund 5 der Durchsicht vom 2026-09-11, zweite Hälfte: Stehen zwei Aufträge derselben
 * Gebäudeart in der Schlange, trugen beide Knöpfe denselben Text „Kaserne abbrechen".
 * Wer den falschen drückt, verliert den falschen Bau — und merkt es erst hinterher.
 */
describe('T-M28-16 Abbrechen bei gleicher Gebaeudeart', () => {
  it('nennt bei mehreren Auftraegen derselben Art den Fertigstellungstag', () => {
    const { ctx, capital } = fresh()
    ctx.state.provinces[capital]!.buildQueue = [
      { id: 'o1', building: 'barracks', level: 1, startedTick: 0, completesAtTick: 48 },
      { id: 'o2', building: 'barracks', level: 2, startedTick: 12, completesAtTick: 96 },
    ] as never

    const labels = cancelActions(ctx, capital).map((spec) => spec.label)

    expect(new Set(labels).size).toBe(2)
    for (const label of labels) expect(label).toContain('Kaserne')
  })

  it('laesst den Text bei einem einzelnen Auftrag schlicht', () => {
    const { ctx, capital } = fresh()
    ctx.state.provinces[capital]!.buildQueue = [
      { id: 'o1', building: 'barracks', level: 1, startedTick: 0, completesAtTick: 48 },
    ] as never

    expect(cancelActions(ctx, capital).map((spec) => spec.label)).toEqual(['Kaserne abbrechen'])
  })
})

/**
 * Der Blick nach vorn (T-M34-08, FORTSCHRITT.md D34.5, R-TECH-02).
 *
 * An einem gesperrten Eintrag steht heute „ab Tag 34" — die Auskunft, warum etwas nicht
 * geht. Was fehlt, ist die Gegenrichtung: **was kommt als Naechstes, und wann.** Aus
 * Warten wird damit ein Ziel. Seit T-M34-03 ist das keine Kleinigkeit mehr: die Leiter
 * reicht bis Spieltag 80 statt bis 16, und zwischen zwei Freischaltungen liegen Tage.
 *
 * Die Zeile nennt Gebaeude UND Einheiten. Der Grund steht in DECISIONS.md: die Achse ist
 * EINE Achse, und wer an Tag 25 auf die Fabrik wartet, wartet nicht auf eine Einheit.
 */
describe('R-TECH-02 Die naechste Freischaltung steht am Kopf der Liste', () => {
  const amTag = (day: number): ActionContext => {
    const { ctx } = fresh()
    return { ...ctx, state: { ...ctx.state, tick: (day - 1) * rules.constants.ticksPerDay } }
  }

  /** Alle Tage des Regelwerks, aufsteigend und ohne Doppelte. */
  const tage = [
    ...new Set([
      ...Object.values(rules.buildings).map((rule) => rule.availableFromDay),
      ...Object.values(rules.units).map((rule) => rule.availableFromDay),
    ]),
  ].sort((a, b) => a - b)

  it('nennt die naechste Sache und die richtige Zahl von Tagen', () => {
    const zweiter = tage.find((tag) => tag > 1)!
    const heute = Math.max(1, zweiter - 3)
    const naechste = nextUnlock(amTag(heute))

    expect(naechste, `an Tag ${heute} ist nichts mehr offen`).not.toBeNull()
    expect(naechste!.days).toBe(zweiter - heute)
    expect(naechste!.name, 'die Zeile nennt einen rohen Schluessel').not.toMatch(RAW_KEY)
  })

  it('wechselt am Tag der Freischaltung auf die uebernaechste', () => {
    const zweiter = tage.find((tag) => tag > 1)!
    const dritter = tage.find((tag) => tag > zweiter)!

    const davor = nextUnlock(amTag(zweiter - 1))!
    const amTagSelbst = nextUnlock(amTag(zweiter))!

    expect(davor.days).toBe(1)
    expect(amTagSelbst.key, 'am Tag der Freischaltung steht noch die alte Sache da').not.toBe(davor.key)
    expect(amTagSelbst.days).toBe(dritter - zweiter)
  })

  it('verschwindet, wenn alles frei ist, statt leer dazustehen', () => {
    expect(nextUnlock(amTag(tage[tage.length - 1]!))).toBeNull()
    expect(nextUnlock(amTag(tage[tage.length - 1]! + 500))).toBeNull()
  })

  it('fuehrt zu jeder genannten Sache ein Bild', () => {
    // Ohne Bild waere die Zeile ein Satz mehr; mit Bild zeigt sie, worauf man wartet.
    // Geprueft ueber die ganze Leiter, nicht an einem Beispiel.
    const ohneBild: string[] = []
    for (const tag of tage) {
      const naechste = nextUnlock(amTag(Math.max(1, tag - 1)))
      if (naechste && !naechste.art) ohneBild.push(naechste.key)
    }

    expect(tage.length, 'die Leiter hat keine Stufen — der Test misst nichts').toBeGreaterThan(5)
    expect(ohneBild, `ohne Bild: ${ohneBild.join(', ')}`).toEqual([])
  })

  it('nennt Gebaeude und Einheiten, nicht nur eine der beiden Arten', () => {
    const arten = new Set(tage.map((tag) => nextUnlock(amTag(Math.max(1, tag - 1)))?.kind).filter(Boolean))

    expect([...arten].sort()).toEqual(['buildings', 'units'])
  })
})

/**
 * Der Preis am Ausbau-Knopf ist der der naechsten Stufe (T-M34-04, D34.3).
 *
 * Vorher stand dort `rule.cost`, also der Preis der ERSTEN Stufe — an einer Fabrik der
 * zweiten Stufe eine Falschauskunft mit Zahl daran: der Spieler las 667 Material, der
 * Kern verlangte 1.201 und lehnte mit „es fehlen Rohstoffe" ab, was die Oberflaeche eben
 * noch als bezahlbar angeboten hatte.
 */
describe('R-PROV-02 Der Bauknopf nennt den Preis der Stufe, die er baut', () => {
  const hinweis = (level: number): string => {
    const { ctx, capital } = fresh()
    ctx.state.provinces[capital]!.buildings.factory = level - 1
    ctx.state.tick = (rules.buildings.factory.availableFromDay - 1) * rules.constants.ticksPerDay
    return buildActions(ctx, capital).find((entry) => entry.id === 'build-factory')!.hint!
  }

  it('nennt die Stufe erst, wenn sie etwas aendert', () => {
    expect(hinweis(1)).not.toMatch(/Stufe/)
    expect(hinweis(3)).toMatch(/Stufe 3/)
  })

  it('zeigt fuer die dritte Stufe eine groessere Zahl als fuer die erste', () => {
    const ersteZahl = (text: string): number => Number(text.match(/([\d.]+)\s+Material/)![1]!.replace(/\./g, ''))

    const erste = ersteZahl(hinweis(1))
    const dritte = ersteZahl(hinweis(3))

    expect(erste, 'der Hinweis nennt kein Material').toBeGreaterThan(0)
    expect(dritte / erste, `${dritte} gegen ${erste}`).toBeCloseTo(3.24, 1)
  })

  it('zeigt fuer die dritte Stufe auch die laengere Bauzeit', () => {
    const tage = (text: string): number => Number(text.match(/([\d,]+)\s+Tage/)![1]!.replace(',', '.'))

    expect(tage(hinweis(3)) / tage(hinweis(1))).toBeCloseTo(2.25, 1)
  })
})

/**
 * Die Ablehnung nennt Gebaeude UND Stufe (T-M34-05, D34.2).
 *
 * „Dafuer fehlt das Gebaeude: Werft" an einer Provinz MIT Werft ist eine Auskunft, die
 * dem Spieler widerspricht — er sieht das Gebaeude im Bauplatz-Raster stehen.
 */
describe('R-UNIT-02 Die Ablehnung nennt die verlangte Gebaeudestufe', () => {
  it('sagt Werft Stufe 2, nicht nur Werft', () => {
    const { ctx, capital } = fresh()
    const province = ctx.state.provinces[capital]!
    province.buildings.harbour = 1
    province.buildings.shipyard = 1
    ctx.state.tick = (rules.units.destroyer!.availableFromDay - 1) * rules.constants.ticksPerDay

    const satz = buildActions(ctx, capital) && recruitActions(ctx, capital).find((e) => e.id === 'recruit-destroyer')!

    expect(satz.disabledReason, 'der Zerstoerer ist gar nicht gesperrt').toMatch(/Werft/)
    expect(satz.disabledReason).toMatch(/Stufe 2/)
  })

  it('nennt die Stufe nicht, wo sie eins ist', () => {
    // Die Gegenprobe: "Stufe 1" an jeder Ablehnung waere Rauschen, und ohne sie waere die
    // Zusicherung oben auch dann gruen, wenn ueberall eine Stufe stuende.
    const { ctx, capital } = fresh()
    ctx.state.tick = (rules.units.infantry!.availableFromDay - 1) * rules.constants.ticksPerDay

    const satz = recruitActions(ctx, capital).find((e) => e.id === 'recruit-infantry')!

    expect(satz.disabledReason, 'ohne Kaserne muss die Infanterie gesperrt sein').toMatch(/Kaserne/)
    expect(satz.disabledReason).not.toMatch(/Stufe/)
  })
})

/**
 * Die Spionage in der Provinzleiste (R-SPY-06/AK1, D29.9, T-M17-13).
 *
 * `known` macht eine Provinz fuer den Spieler bekannt (sichtbar oder erinnert), ohne die
 * Sicht selbst zu bauen — genau das, was `knownOwner` im Kern liest.
 */
describe('R-SPY-06/AK1 Spionage in der Provinzleiste', () => {
  function known(ctx: ActionContext, owner: PlayerId | null): string {
    const gefunden = Object.values(ctx.state.provinces).find((p) => p.owner === owner)
    let id: string
    if (gefunden) {
      id = gefunden.id
    } else {
      // Herrenlos, und die Karte hat keine: eine fremde Provinz wird eine.
      const fremd = Object.values(ctx.state.provinces).find((p) => p.owner === ctx.state.playerOrder[1])!
      fremd.owner = null
      id = fremd.id
    }
    ctx.state.players[ctx.playerId]!.intel[id] = { tick: 0, owner, strength: 0 }
    return id
  }

  function money(ctx: ActionContext, n: number): void {
    ctx.state.players[ctx.playerId]!.resources.money = n
  }

  let spyCounter = 0
  function spy(ctx: ActionContext, over: Partial<Spy> & { provinceId: string; mission: SpyMission }): Spy {
    const entry: Spy = {
      id: `s${spyCounter++}`,
      owner: ctx.playerId,
      recruitedTick: 0,
      assignedTick: 0,
      lastRunTick: null,
      lastOutcome: null,
      ...over,
    }
    ctx.state.espionage.spies.push(entry)
    return entry
  }

  it('bietet in einer fremden Provinz je Auftrag einen Anwerbe-Knopf (AK1)', () => {
    const { ctx } = fresh()
    const id = known(ctx, ctx.state.playerOrder[1]!)

    const specs = spyActions(ctx, id)

    expect(specs.map((s) => s.id)).toEqual([
      'spy-recruit-intel',
      'spy-recruit-economicSabotage',
      'spy-recruit-militarySabotage',
    ])
    for (const spec of specs) {
      expect(spec.disabledReason, spec.id).toBeNull()
      expect(spec.command?.type).toBe('RECRUIT_SPY')
      expect((spec.command as { playerId: string }).playerId).toBe(ctx.playerId)
    }
    expect(specs.map((s) => (s.command as { mission: string }).mission)).toEqual([...SPY_MISSIONS].filter((m) => m !== 'counter'))
  })

  it('bietet in der eigenen Provinz nur die Gegenspionage (R-SPY-06)', () => {
    const { ctx, capital } = fresh()

    const specs = spyActions(ctx, capital)

    expect(specs.map((s) => s.id)).toEqual(['spy-recruit-counter'])
    expect(specs[0]!.disabledReason).toBeNull()
  })

  it('sperrt jeden Anwerbe-Knopf mit dem fehlenden Betrag, wenn das Geld fehlt (AK1)', () => {
    const { ctx } = fresh()
    const id = known(ctx, ctx.state.playerOrder[1]!)
    money(ctx, 0)

    for (const spec of spyActions(ctx, id)) {
      expect(spec.disabledReason, spec.id).toBe('Es fehlt an Rohstoffen: 102 Geld.')
    }
  })

  it('nennt Anwerbepreis, Tagessold und Wirkung im Tooltip', () => {
    const { ctx, capital } = fresh()
    const id = known(ctx, ctx.state.playerOrder[1]!)

    const specs = spyActions(ctx, id)
    const intel = specs.find((s) => s.id === 'spy-recruit-intel')!
    const economic = specs.find((s) => s.id === 'spy-recruit-economicSabotage')!

    expect(intel.hint).toContain('102 Geld')
    expect(intel.hint).toContain('10 Geld je Tag')
    expect(intel.hint).toContain('80 %')
    expect(economic.hint).toContain('Moral −10')
    expect(economic.hint).toContain('50 %')

    const counter = spyActions(ctx, capital)[0]!
    expect(counter.hint).toContain('25 %')
  })

  it('sperrt Sabotage in einer herrenlosen Provinz mit Grund, laesst Aufklaerung zu', () => {
    const { ctx } = fresh()
    const id = known(ctx, null)

    const specs = spyActions(ctx, id)
    expect(specs.find((s) => s.id === 'spy-recruit-intel')!.disabledReason).toBeNull()
    expect(specs.find((s) => s.id === 'spy-recruit-economicSabotage')!.disabledReason).toBe(
      'Sabotage braucht einen Eigentümer — diese Provinz ist herrenlos.',
    )
    expect(specs.find((s) => s.id === 'spy-recruit-militarySabotage')!.disabledReason).toBe(
      'Sabotage braucht einen Eigentümer — diese Provinz ist herrenlos.',
    )
  })

  it('gibt jedem Auftrag Symbol, Erklaerung und einen Namen mit Verb (R-UI-10/11)', () => {
    const { ctx, capital } = fresh()
    const id = known(ctx, ctx.state.playerOrder[1]!)

    for (const spec of [...spyActions(ctx, id), ...spyActions(ctx, capital)]) {
      const mission = (spec.command as { mission: SpyMission }).mission
      expect(spec.icon, spec.id).toBe(SPY_MISSION_ICONS[mission])
      expect(hasKey(spec.explainKey!), spec.explainKey).toBe(true)
      expect(spec.aria, spec.id).toMatch(/anwerben$/)
    }
  })

  it('nennt die Hoechstzahl statt der Bauplaetze', () => {
    const { ctx } = fresh()
    const id = known(ctx, ctx.state.playerOrder[1]!)
    for (let i = 0; i < rules.constants.maxSpiesPerPlayer; i++) {
      spy(ctx, { provinceId: id, mission: 'intel' })
    }

    for (const spec of spyActions(ctx, id)) {
      expect(spec.disabledReason, spec.id).toBe('Höchstzahl erreicht: 5 Spione.')
    }
  })

  it('nennt fuer eine unbekannte Provinz, dass nichts bekannt ist', () => {
    const { ctx } = fresh()
    const view = publicView(ctx.state, ctx.playerId, rules)
    const sichtbar = new Set(view.provinces.map((p) => p.id))
    const unbekannt = Object.values(ctx.state.provinces).find(
      (p) => p.owner !== null && p.owner !== ctx.playerId && !sichtbar.has(p.id),
    )!
    expect(sichtbar.has(unbekannt.id), 'die gewaehlte Provinz muss unbekannt sein').toBe(false)

    const spec = spyActions(ctx, unbekannt.id).find((s) => s.id === 'spy-recruit-intel')!
    expect(spec.disabledReason).toBe('Von dieser Provinz wissen Sie nichts — erst sehen oder aufklären.')
  })

  it('setzt im Umsetz-Modus denselben Spion um statt anzuwerben (R-SPY-06)', () => {
    const { ctx, capital } = fresh()
    const eigen = spy(ctx, { provinceId: capital, mission: 'intel' })
    const zielY = known(ctx, ctx.state.playerOrder[1]!)

    const specs = spyActions(ctx, zielY, { spyId: eigen.id, number: 1 })

    expect(specs.every((s) => s.id.startsWith('spy-move-'))).toBe(true)
    for (const spec of specs) {
      expect(spec.command?.type).toBe('REASSIGN_SPY')
      expect((spec.command as { spyId: string }).spyId).toBe(eigen.id)
      expect(spec.hint).toContain('kostenlos')
    }
    const intelSpec = specs.find((s) => (s.command as { mission: string }).mission === 'intel')!
    expect(intelSpec.aria).toBe('Spion 1 hierher umsetzen: Aufklärung')
  })

  it('lehnt Umsetzen ohne Aenderung mit Grund ab', () => {
    const { ctx } = fresh()
    const zielY = known(ctx, ctx.state.playerOrder[1]!)
    const eigen = spy(ctx, { provinceId: zielY, mission: 'intel' })

    const specs = spyActions(ctx, zielY, { spyId: eigen.id, number: 1 })

    expect(specs.find((s) => (s.command as { mission: string }).mission === 'intel')!.disabledReason).toBe(
      'Der Spion hat diesen Auftrag schon an diesem Ort.',
    )
    expect(specs.find((s) => (s.command as { mission: string }).mission === 'economicSabotage')!.disabledReason).toBeNull()
    expect(specs.find((s) => (s.command as { mission: string }).mission === 'militarySabotage')!.disabledReason).toBeNull()
  })

  it('setzt einen Gegenspion nur in eigene Provinzen um', () => {
    const { ctx, capital } = fresh()
    const eigen = spy(ctx, { provinceId: capital, mission: 'counter' })

    const specs = spyActions(ctx, capital, { spyId: eigen.id, number: 1 })

    expect(specs.map((s) => s.id)).toEqual(['spy-move-counter'])
  })
})

describe('R-SPY-06 Die Spionageuebersicht', () => {
  let spyCounter = 900
  function spy(ctx: ActionContext, over: Partial<Spy> & { provinceId: string; mission: SpyMission }): Spy {
    const entry: Spy = {
      id: `s${spyCounter++}`,
      owner: ctx.playerId,
      recruitedTick: 0,
      assignedTick: 0,
      lastRunTick: null,
      lastOutcome: null,
      ...over,
    }
    ctx.state.espionage.spies.push(entry)
    return entry
  }

  it('listet jeden eigenen Spion mit Nummer, Auftrag, Ziel, Tagessold und Ergebnis', () => {
    const { ctx, neighbour } = fresh()
    spy(ctx, { provinceId: neighbour, mission: 'intel', lastRunTick: 24, lastOutcome: 'success' })
    spy(ctx, { provinceId: neighbour, mission: 'economicSabotage', lastRunTick: null })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    const rows = spyOverviewActions(ctx, spies)

    expect(rows[0]!.number).toBe(1)
    expect(rows[0]!.missionLabel).toBe('Aufklärung')
    expect(rows[0]!.provinceName).toBe(map.provinces.find((p) => p.id === neighbour)!.name)
    expect(rows[0]!.salary).toBe('10 Geld je Tag')
    expect(rows[0]!.result).toBe('gelungen (Tag 2)')
    expect(rows[1]!.result).toBe('noch kein Einsatz — der erste folgt am Tag nach dem Ansetzen')
  })

  it('zeigt nur die eigenen Spione — ein fremder in der eigenen Provinz steht nirgends (Z8)', () => {
    const { ctx, capital, neighbour } = fresh()
    spy(ctx, { provinceId: neighbour, mission: 'intel' })
    ctx.state.espionage.spies.push({
      id: 's-fremd',
      owner: ctx.state.playerOrder[1]!,
      provinceId: capital,
      mission: 'counter',
      recruitedTick: 0,
      assignedTick: 0,
      lastRunTick: null,
      lastOutcome: null,
    })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    const rows = spyOverviewActions(ctx, spies)

    expect(rows.length).toBe(1)
    expect(rows.some((r) => r.provinceId === capital)).toBe(false)
  })

  it('sagt beim Gegenspion keine Enttarnung statt misslungen (T-M17-09 E4)', () => {
    const { ctx, capital } = fresh()
    spy(ctx, { provinceId: capital, mission: 'counter', lastRunTick: 24, lastOutcome: 'failure' })
    spy(ctx, { provinceId: capital, mission: 'counter', lastRunTick: 24, lastOutcome: 'success' })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    const rows = spyOverviewActions(ctx, spies)

    expect(rows[0]!.result).toBe('keine Enttarnung (Tag 2)')
    expect(rows[1]!.result).toBe('fremden Spion enttarnt (Tag 2)')
    expect(rows.some((r) => r.result.includes('misslungen'))).toBe(false)
  })

  it('zeigt keine Spionkennung, nur Nummern (Befund M17-S1)', () => {
    const { ctx, capital, neighbour } = fresh()
    spyCounter = 7
    spy(ctx, { provinceId: neighbour, mission: 'intel', lastRunTick: 24, lastOutcome: 'success' })
    spyCounter = 12
    spy(ctx, { provinceId: capital, mission: 'counter', lastRunTick: null })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    const rows = spyOverviewActions(ctx, spies)
    const sichtbar = rows.map(({ spyId: _spyId, ...rest }) => ({
      ...rest,
      move: rest.move.id,
      dismiss: rest.dismiss.id,
    }))

    expect(JSON.stringify(sichtbar)).not.toMatch(/\bs\d+\b/)
    expect(rows[0]!.dismiss.id).toBe('spy-1-dismiss')
  })

  it('entlaesst ueber DISMISS_SPY, geprueft, mit Verb', () => {
    const { ctx, neighbour } = fresh()
    spy(ctx, { provinceId: neighbour, mission: 'intel' })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    const row = spyOverviewActions(ctx, spies)[0]!

    expect(row.dismiss.command).toEqual({ type: 'DISMISS_SPY', playerId: ctx.playerId, spyId: row.spyId })
    expect(row.dismiss.disabledReason).toBeNull()
    expect(row.dismiss.aria).toBe('Spion 1 entlassen')
    expect(row.move.command).toBeUndefined()
    expect(row.move.aria).toBe('Spion 1 umsetzen')
  })

  it('fasst Zahl und Tagessold zusammen', () => {
    const { ctx, neighbour } = fresh()
    spy(ctx, { provinceId: neighbour, mission: 'intel', lastRunTick: 24, lastOutcome: 'success' })
    spy(ctx, { provinceId: neighbour, mission: 'economicSabotage', lastRunTick: null })

    const spies = publicView(ctx.state, ctx.playerId, rules).espionage.spies
    expect(spySummary(ctx, spies)).toBe('2 von 5 Spionen · Sold 30 Geld je Tag')
  })
})

describe('R-UI-07 Spionage-Ablehnungen in Worten', () => {
  it('hat fuer jeden Zielgrund des Kerns einen Satz', () => {
    const ROOT_DIR = process.cwd()
    const commandsText = readFileSync(`${ROOT_DIR}/packages/core/src/commands/espionage.ts`, 'utf8')
    const rulesText = readFileSync(`${ROOT_DIR}/packages/core/src/rules/espionage.ts`, 'utf8')

    const found = new Set<string>()
    for (const match of commandsText.matchAll(/reason:\s*'([^']+)'/g)) found.add(match[1]!)
    for (const match of rulesText.matchAll(/return .*'([^']+)'$/gm)) found.add(match[1]!)

    expect(found.size, 'zu wenige Zielgruende gefunden — liest die Probe noch die Dateien?').toBeGreaterThanOrEqual(6)
    for (const reason of found) {
      const key = SPY_REASON_KEYS[reason]
      expect(key, `Grund "${reason}" ohne Eintrag in SPY_REASON_KEYS`).toBeTruthy()
      expect(hasKey(key!), `${reason} -> ${key}`).toBe(true)
    }
  })

  it('uebersetzt einen Zielgrund nur bei Spionagebefehlen', () => {
    const { ctx } = fresh()
    const text = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'herrenlos' } },
      { type: 'MOVE_ARMY' } as Command,
      ctx,
    )
    expect(text).toBe('Dieses Ziel ist für den Befehl nicht zulässig. (herrenlos)')
  })
})

/**
 * Handel und Durchmarsch als Knoepfe (T-M17-14, R-DIP-07, R-DIP-08, R-DIP-09, D29.9).
 *
 * Angebote und Antraege entstehen durch den Kern (`step`), nie durch ein Literal im Test —
 * sonst prueften diese Faelle nur, dass die Oberflaeche einer erfundenen Lage vertraut.
 */
describe('R-DIP-07 Handel und Durchmarsch als Knoepfe (T-M17-14)', () => {
  const nameOfProvince = (id: string) => map.provinces.find((p) => p.id === id)!.name
  const naming = (state: GameState) => ({
    nameOf: (id: string) => state.players[id]!.nation,
    nameOfProvince,
  })

  function applied(ctx: ActionContext, commands: Command[]): ActionContext {
    const result = step(ctx.state, commands, { map, rules })
    return { ...ctx, state: result.state }
  }

  it('bietet genau die sechs Vertragsaktionen', () => {
    const { ctx } = fresh()
    expect(diplomacyActions(ctx, 'p2').map((a) => a.id)).toEqual([
      'diplomacy-declareWar',
      'diplomacy-offerPeace',
      'diplomacy-acceptPeace',
      'diplomacy-offerAlliance',
      'diplomacy-acceptAlliance',
      'diplomacy-breakAlliance',
    ])
  })

  describe('R-DIP-08/AK2 Antrag, Annahme und Kuendigung des Durchmarschs', () => {
    it('bietet Antrag, Annahme und Kuendigung des Durchmarschs an — mit Grund, wo es nicht geht', () => {
      const { ctx } = fresh()

      expect(passageActions(ctx, 'p2').map((a) => a.id)).toEqual([
        'diplomacy-grantRightOfWay',
        'diplomacy-requestRightOfWay',
        'diplomacy-acceptRightOfWay',
        'diplomacy-revokeRightOfWay',
        'diplomacy-shareMap',
      ])
      const byId = (list: ReturnType<typeof passageActions>) => Object.fromEntries(list.map((a) => [a.id, a]))

      let row = byId(passageActions(ctx, 'p2'))
      expect(row['diplomacy-requestRightOfWay']!.disabledReason).toBeNull()
      expect(row['diplomacy-acceptRightOfWay']!.disabledReason).toContain('kein Angebot')
      expect(row['diplomacy-revokeRightOfWay']!.disabledReason).toContain('nicht gewährt')
      for (const spec of Object.values(row)) if (spec.disabledReason) expect(spec.disabledReason).not.toMatch(RAW_KEY)

      // p1 gewaehrt p2 den Durchmarsch.
      const gewaehrt = applied(ctx, [{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p2', action: 'grantRightOfWay' }])
      row = byId(passageActions(gewaehrt, 'p2'))
      expect(row['diplomacy-revokeRightOfWay']!.disabledReason).toBeNull()

      // p1 kuendigt wieder.
      const gekuendigt = applied(gewaehrt, [{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p2', action: 'revokeRightOfWay' }])
      row = byId(passageActions(gekuendigt, 'p2'))
      expect(row['diplomacy-revokeRightOfWay']!.disabledReason).toContain('bereits gekündigt')

      // Getrennt: p2 beantragt bei p1 — p1 sieht "annehmen" frei.
      const p2ctx: ActionContext = { ...ctx, playerId: 'p2' }
      const beantragt = applied(p2ctx, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p1', action: 'requestRightOfWay' }])
      const p1row = byId(passageActions({ ...beantragt, playerId: 'p1' }, 'p2'))
      expect(p1row['diplomacy-acceptRightOfWay']!.disabledReason).toBeNull()
    })
  })

  it('A2 Vorschau gleich exchangeAmount — beide Seiten zum Kurs des Ticks', () => {
    const { ctx } = fresh()
    const draft: TradeDraft = {
      give: { resources: { iron: 5000, money: 2000 }, provinces: [] },
      want: { resources: { oil: 3000 }, provinces: [] },
    }
    const r1 = tradeOfferAction(ctx, 'p2', draft, nameOfProvince)
    const erwartetGive =
      exchangeAmount(ctx.state.market, 'iron', 5000, 'money') + exchangeAmount(ctx.state.market, 'money', 2000, 'money')
    const erwartetWant = exchangeAmount(ctx.state.market, 'oil', 3000, 'money')
    expect(r1.giveValue).toBe(erwartetGive)
    expect(r1.wantValue).toBe(erwartetWant)
    expect(r1.text).toBe(t('trade.worth', { give: amount(r1.giveValue), want: amount(r1.wantValue) }))

    // Der Kurs des Ticks aendert sich (Klon) — die Vorschau folgt ihm.
    const teurerMarkt = { ...ctx.state.market, prices: { ...ctx.state.market.prices, iron: ctx.state.market.prices.iron * 2 } }
    const teurerState: GameState = { ...ctx.state, market: teurerMarkt }
    const r2 = tradeOfferAction({ ...ctx, state: teurerState }, 'p2', draft, nameOfProvince)
    expect(r2.giveValue).not.toBe(r1.giveValue)
    expect(r2.giveValue).toBe(
      exchangeAmount(teurerMarkt, 'iron', 5000, 'money') + exchangeAmount(teurerMarkt, 'money', 2000, 'money'),
    )
  })

  it('A2b nennt den Satz "keinen Marktpreis", wenn eine Provinz im Angebot steht', () => {
    const { ctx, capital } = fresh()
    const draft: TradeDraft = { give: { resources: {}, provinces: [capital] }, want: { resources: { money: 1000 }, provinces: [] } }
    const r = tradeOfferAction(ctx, 'p2', draft, nameOfProvince)
    expect(r.text).toContain(t('trade.worthProvinces'))
  })

  it('A3 sperrt ein Angebot mit einem Grund in Worten', () => {
    const { ctx } = fresh()

    // leeres Angebot
    let r = tradeOfferAction(ctx, 'p2', { give: { resources: {}, provinces: [] }, want: { resources: {}, provinces: [] } }, nameOfProvince)
    expect(r.action.disabledReason).toBe(t('trade.blocked.empty'))

    // derselbe Rohstoff auf beiden Seiten
    r = tradeOfferAction(
      ctx,
      'p2',
      { give: { resources: { iron: 1000 }, provinces: [] }, want: { resources: { iron: 500 }, provinces: [] } },
      nameOfProvince,
    )
    expect(r.action.disabledReason).toBe(t('trade.blocked.sameResource'))

    // ueber der Hoechstmenge
    const zuViel = rules.constants.tradeMaxMoney + 1000
    r = tradeOfferAction(
      ctx,
      'p2',
      { give: { resources: { money: zuViel }, provinces: [] }, want: { resources: { iron: 1000 }, provinces: [] } },
      nameOfProvince,
    )
    expect(r.action.disabledReason).toBe(
      t('trade.blocked.limit', { max: amount(rules.constants.tradeMaxMoney), resource: t('resources.money') }),
    )

    // fuenf offene Angebote, dann das sechste
    let voll = ctx.state
    for (let i = 0; i < rules.constants.maxOpenTradeOffers; i++) {
      voll = step(
        voll,
        [
          {
            type: 'OFFER_TRADE',
            playerId: 'p1',
            targetPlayerId: 'p2',
            give: { resources: { wood: 1000 }, provinces: [] },
            want: { resources: { money: 1000 }, provinces: [] },
          },
        ],
        { map, rules },
      ).state
    }
    r = tradeOfferAction(
      { ...ctx, state: voll },
      'p2',
      { give: { resources: { coal: 1000 }, provinces: [] }, want: { resources: { money: 1000 }, provinces: [] } },
      nameOfProvince,
    )
    expect(r.action.disabledReason).toBe(t('trade.blocked.queueFull', { max: rules.constants.maxOpenTradeOffers }))

    // im Krieg
    const key = relationKey('p1', 'p2')
    const kriegsState: GameState = {
      ...ctx.state,
      diplomacy: {
        ...ctx.state.diplomacy,
        relations: { ...ctx.state.diplomacy.relations, [key]: { ...ctx.state.diplomacy.relations[key]!, state: 'war' } },
      },
    }
    r = tradeOfferAction(
      { ...ctx, state: kriegsState },
      'p2',
      { give: { resources: { iron: 1000 }, provinces: [] }, want: { resources: { money: 1000 }, provinces: [] } },
      nameOfProvince,
    )
    expect(r.action.disabledReason).toBe(t('trade.blocked.war'))

    // Rohstoffe fehlen im eigenen Bestand — Seltene Erden (Startbestand knapper als Eisen)
    // sind unterhalb der Hoechstmenge schon nicht mehr im Bestand.
    r = tradeOfferAction(
      ctx,
      'p2',
      { give: { resources: { rare: rules.constants.tradeMaxResource }, provinces: [] }, want: { resources: { money: 1000 }, provinces: [] } },
      nameOfProvince,
    )
    expect(r.action.disabledReason).toContain('Es fehlt an Rohstoffen')
    expect(r.action.disabledReason).toContain('Seltene Erden')

    // Keiner der Gruende nennt "Bauplaetze" (E7) oder passt auf den Rohschluessel-Fund.
    for (const grund of [
      t('trade.blocked.empty'),
      t('trade.blocked.sameResource'),
      t('trade.blocked.limit', { max: amount(rules.constants.tradeMaxMoney), resource: t('resources.money') }),
      t('trade.blocked.queueFull', { max: rules.constants.maxOpenTradeOffers }),
      t('trade.blocked.war'),
    ]) {
      expect(grund).not.toContain('Bauplätze')
      expect(grund).not.toMatch(RAW_KEY)
    }
  })

  it('A4 R-DIP-09 nennt die Provinz beim Namen, wenn sie das Angebot sperrt', () => {
    const { ctx, capital } = fresh()
    const capitalName = nameOfProvince(capital)

    const kapitalAbgeben = tradeOfferAction(
      ctx,
      'p2',
      { give: { resources: {}, provinces: [capital] }, want: { resources: {}, provinces: [] } },
      nameOfProvince,
    )
    expect(kapitalAbgeben.action.disabledReason).toContain(capitalName)
    expect(kapitalAbgeben.action.disabledReason).toContain('Hauptstadt')
    expect(kapitalAbgeben.action.disabledReason).not.toMatch(RAW_KEY)

    const fremdeVerlangen = tradeOfferAction(
      ctx,
      'p2',
      { give: { resources: {}, provinces: [] }, want: { resources: {}, provinces: [capital] } },
      nameOfProvince,
    )
    expect(fremdeVerlangen.action.disabledReason).toContain(capitalName)
    expect(fremdeVerlangen.action.disabledReason).toContain('gehört nicht')
    expect(fremdeVerlangen.action.disabledReason).not.toMatch(RAW_KEY)
  })

  describe('R-DIP-07/AK1 Ein eingehendes Angebot steht in Worten', () => {
    it('nennt beide Seiten in Worten, ohne Kennung', () => {
      const { ctx } = fresh()
      const afterOffer = applied(ctx, [
        {
          type: 'OFFER_TRADE',
          playerId: 'p2',
          targetPlayerId: 'p1',
          give: { resources: { iron: 5000 }, provinces: [] },
          want: { resources: { money: 10000 }, provinces: [] },
        },
      ])
      const p1ctx: ActionContext = { ...afterOffer, playerId: 'p1' }
      const view = publicView(afterOffer.state, 'p1', rules)
      const rows = offerListActions(p1ctx, view, naming(afterOffer.state))

      expect(rows.incoming).toHaveLength(1)
      const row = rows.incoming[0]!
      const nation = afterOffer.state.players.p2!.nation
      expect(row.text).toBe(t('trade.incoming', { nation, give: '5 Eisen', want: '10 Geld' }))
      expect(row.text).not.toMatch(/\bp\d\b|\bt\d+\b/)

      const accept = row.actions.find((a) => a.id.startsWith('trade-accept-'))!
      const decline = row.actions.find((a) => a.id.startsWith('trade-decline-'))!
      expect(accept.disabledReason).toBeNull()
      expect(decline.disabledReason).toBeNull()
      expect(row.note).toBeDefined()
      expect(row.note).toContain('Geld')
    })
  })

  it('A6 ausgehend: Zurueckziehen, und "hinterlegt" nur, wenn etwas hinterlegt ist', () => {
    const { ctx, capital } = fresh()
    const afterOffer = applied(ctx, [
      {
        type: 'OFFER_TRADE',
        playerId: 'p1',
        targetPlayerId: 'p2',
        give: { resources: { iron: 5000 }, provinces: [] },
        want: { resources: {}, provinces: [] },
      },
    ])
    const view1 = publicView(afterOffer.state, 'p1', rules)
    const rows1 = offerListActions(afterOffer, view1, naming(afterOffer.state))
    expect(rows1.outgoing).toHaveLength(1)
    const row1 = rows1.outgoing[0]!
    const withdraw1 = row1.actions.find((a) => a.id.startsWith('trade-withdraw-'))!
    expect(withdraw1.disabledReason).toBeNull()
    expect(row1.note).toContain(t('trade.escrow'))
    expect(row1.note).toMatch(/Verfällt an Tag \d/)

    // Zweites Angebot p1 -> p2, nur mit einer eigenen Provinz — kein Rohstoff hinterlegt.
    const eigeneProvinz = Object.values(afterOffer.state.provinces).find((p) => p.owner === 'p1' && p.id !== capital)?.id
    expect(eigeneProvinz, 'p1 braucht fuer diesen Fall eine zweite eigene Provinz').toBeDefined()
    const afterOffer2 = applied(afterOffer, [
      {
        type: 'OFFER_TRADE',
        playerId: 'p1',
        targetPlayerId: 'p2',
        give: { resources: {}, provinces: [eigeneProvinz!] },
        want: { resources: {}, provinces: [] },
      },
    ])
    const view2 = publicView(afterOffer2.state, 'p1', rules)
    const rows2 = offerListActions(afterOffer2, view2, naming(afterOffer2.state))
    expect(rows2.outgoing).toHaveLength(2)
    const zweiteZeile = rows2.outgoing[1]!
    expect(zweiteZeile.note ?? '').not.toContain(t('trade.escrow'))
  })

  it('A7 R-DIP-04 die Annahme verraet keine fremde Armee und keinen fremden Weg', () => {
    const { ctx, capital, neighbour } = fresh()
    // X: eine Nicht-Hauptstadt-Provinz, p2 zugeschrieben (herrenlos gemacht, am Klon), bevor
    // das Angebot entsteht. Y ist ein Nachbar von X, fuer den Weg-Fall (b).
    const X = neighbour
    const Y = map.edgesByProvince[X]!
      .map((i) => map.edges[i]!)
      .filter((e) => e.kind === 'land')
      .map((e) => (e.a === X ? e.b : e.a))
      .find((id) => id !== X && id !== capital)!
    expect(Y, 'X braucht einen zweiten Nachbarn fuer den Weg-Fall').toBeDefined()

    const basis: GameState = { ...ctx.state, provinces: { ...ctx.state.provinces, [X]: { ...ctx.state.provinces[X]!, owner: 'p2' } } }
    const offerCtx: ActionContext = { ...ctx, state: basis, playerId: 'p2' }
    const afterOffer = applied(offerCtx, [
      {
        type: 'OFFER_TRADE',
        playerId: 'p2',
        targetPlayerId: 'p1',
        give: { resources: {}, provinces: [X] },
        want: { resources: {}, provinces: [] },
      },
    ])
    const offer = afterOffer.state.diplomacy.tradeOffers[0]!
    expect(offer.give.provinces).toEqual([X])

    /** Ein flacher Klon, der nur `armies`/`armyOrder` neu anlegt — genug fuer `withArmy`. */
    const mitArmee = (state: GameState, at: string, owner: string, path: string[] = []): GameState => {
      const clone: GameState = { ...state, armies: { ...state.armies }, armyOrder: [...state.armyOrder] }
      withArmy(clone, at, 3000, owner, path)
      return clone
    }

    const varianten: { name: string; bauen: (state: GameState) => GameState }[] = [
      { name: '(a) eigene Armee des Anbieters in X', bauen: (state) => mitArmee(state, X, 'p2') },
      { name: '(b) Armee des Anbieters auf dem Weg nach X', bauen: (state) => mitArmee(state, Y, 'p2', [X]) },
      { name: '(c) Armee einer dritten Macht (Frieden mit p2) in X', bauen: (state) => mitArmee(state, X, 'p3') },
    ]

    for (const variante of varianten) {
      const state = variante.bauen(afterOffer.state)
      const p1ctx: ActionContext = { ...ctx, state, playerId: 'p1' }
      const view = publicView(state, 'p1', rules)
      const rows = offerListActions(p1ctx, view, naming(state))
      const row = rows.incoming.find((r) => r.id === offer.id)!
      const accept = row.actions.find((a) => a.id.startsWith('trade-accept-'))!

      expect(accept.disabledReason, variante.name).toBe(t('trade.blocked.lapsing'))
      const provinceName = nameOfProvince(X)
      for (const verboten of [provinceName, 'Armee', 'Truppen', 'Hauptstadt', 'umkämpft', 'gekämpft']) {
        expect(accept.disabledReason, `${variante.name}: ${verboten}`).not.toContain(verboten)
      }

      // Kontrolle: der Kern selbst lehnt mit dem erwarteten Grund ab — sonst misst der Fall nichts.
      const acceptCommand: Command = { type: 'ACCEPT_TRADE', playerId: 'p1', offerId: offer.id }
      const kernErgebnis = canApply(state, acceptCommand, { map, rules, commands: [acceptCommand], events: [] })
      expect(kernErgebnis.ok, variante.name).toBe(false)
      if (!kernErgebnis.ok) {
        expect(['eigene Armeen', 'fremde Armeen'], variante.name).toContain(kernErgebnis.detail?.reason)
      }
    }
  })

  it('A8 der Durchmarsch-Antrag steht in beiden Listen', () => {
    const { ctx } = fresh()
    const p2ctx: ActionContext = { ...ctx, playerId: 'p2' }
    const nachAntrag = applied(p2ctx, [{ type: 'DIPLOMACY', playerId: 'p2', targetPlayerId: 'p1', action: 'requestRightOfWay' }])

    const p1view = publicView(nachAntrag.state, 'p1', rules)
    const p1rows = offerListActions({ ...nachAntrag, playerId: 'p1' }, p1view, naming(nachAntrag.state))
    const eingehend = p1rows.incoming.find((row) => row.id.includes('rightOfWay'))!
    expect(eingehend.text).toBe(t('diplomacy.request.rightOfWay', { nation: nachAntrag.state.players.p2!.nation }))
    expect(eingehend.actions.some((a) => a.id === 'offer-accept-rightOfWay-p2' && a.disabledReason === null)).toBe(true)

    // getrennt: p1 beantragt bei p2 — ausgehend, aus Sicht von p1, ohne Aktion.
    const eigenerAntrag = applied(ctx, [{ type: 'DIPLOMACY', playerId: 'p1', targetPlayerId: 'p2', action: 'requestRightOfWay' }])
    const p1view2 = publicView(eigenerAntrag.state, 'p1', rules)
    const p1rows2 = offerListActions({ ...eigenerAntrag, playerId: 'p1' }, p1view2, naming(eigenerAntrag.state))
    const ausgehend = p1rows2.outgoing.find((row) => row.id.includes('rightOfWay'))!
    expect(ausgehend.text).toBe(t('diplomacy.ownRequest.rightOfWay', { nation: eigenerAntrag.state.players.p2!.nation }))
    expect(ausgehend.actions).toEqual([])
  })

  it('A9 R-DIP-04 das Formular liest keinen fremden Bestand', () => {
    const { ctx } = fresh()
    const draft: TradeDraft = { give: { resources: { iron: 5000 }, provinces: [] }, want: { resources: { money: 10000 }, provinces: [] } }

    const arm: GameState = { ...ctx.state, players: { ...ctx.state.players, p2: { ...ctx.state.players.p2!, resources: { ...ctx.state.players.p2!.resources, money: 0 } } } }
    const reich: GameState = {
      ...ctx.state,
      players: { ...ctx.state.players, p2: { ...ctx.state.players.p2!, resources: { ...ctx.state.players.p2!.resources, money: 10 ** 12 } } },
    }

    const rArm = tradeOfferAction({ ...ctx, state: arm }, 'p2', draft, nameOfProvince)
    const rReich = tradeOfferAction({ ...ctx, state: reich }, 'p2', draft, nameOfProvince)

    expect(rArm.text).toBe(rReich.text)
    expect(rArm.action.disabledReason).toBe(rReich.action.disabledReason)
  })
})
