import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  HASH_OMIT_KEYS,
  SCHEMA_VERSION,
  createInitialState,
  deserialise,
  parseRules,
  serialise,
  type Command,
  type GameConfig,
  type MapData,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'

/**
 * Das Rezept fuer `packages/core/test/golden/save-v3.json` (T-M17-02, D29.10).
 *
 * Der eingefrorene Stand der Stufe 3 ist kein handgeschriebenes JSON, sondern eine gespielte
 * Partie: Weltkarte, acht Maechte, Startzahl 1917, **30 Spieltage** (Tick 720). Sieben Maechte
 * fuehrt die KI, Deutschland (`p5`) ist ein Mensch und gibt genau die fuenf Befehle aus `SCRIPT`.
 * Der Mensch ist noetig: der Ausgangswert (`m17-baseline.slow.test.ts`) zeigt, dass die KI ueber
 * 200 Spieltage **keinen** Durchmarsch und **keine** Karte freigibt — ein reiner KI-Stand haette
 * die Felder, um die es in Schritt 3 → 4 geht, gar nicht gesetzt.
 *
 * Was der Stand traegt (und `migration-v3.test.ts` als Vorbedingung prueft):
 *  - `p5|p6` Frieden mit `rightOfWay: true` — gewaehrter Durchmarsch **ohne** Buendnis,
 *  - `p5|p7` Frieden mit `sharedMap: true` — geteilte Karte **ohne** Buendnis,
 *  - `p2|p5` Buendnis (das Annehmen setzt beide Felder),
 *  - offene Friedensangebote, darunter das eigene an `p8` aus Tick 719,
 *  - Kriege, Verstimmungen, 500 Eintraege im Ereignisprotokoll, vier offene Ziele je Macht.
 *
 * **Dieser Lauf gilt nur, solange `SCHEMA_VERSION` 3 ist.** Er belegt auf dem Commit von
 * T-M17-02, dass die Datei zeichengleich aus dem Rezept entsteht (die Partie ist deterministisch),
 * und wird mit T-M17-03 entfernt — ab dann schreibt `serialise` Stufe 4, und ein eingefrorener
 * Stand wird nie neu erzeugt. Wer den Weg nachgehen will, checkt den Commit von T-M17-02 aus und
 * faehrt `npx vitest run --config vitest.slow.config.ts apps/headless/test/save-v3-freeze.slow.test.ts`;
 * mit `FREEZE_V3=1` schreibt der Lauf die Datei, ohne vergleicht er sie.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const FROZEN = `${ROOT}packages/core/test/golden/save-v3.json`
const LABEL = 'Eingefroren am 2026-09-18 als Beleg für den Migrationsschritt 3 → 4 (T-M17-02)'
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never
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

/** Deutschland, `p5`. */
const HUMAN = 4
const DAYS = 30

const config: GameConfig = {
  seed: 1917,
  mapId: map.id,
  rulesId: 'default',
  players: map.startPositions.slice(0, 8).map((start, index) => ({
    name: start.nation,
    kind: index === HUMAN ? ('human' as const) : ('ai' as const),
    nation: start.nation,
    color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C', '#6B5B3A', '#3A6B5B'][index]!,
    ...(index === HUMAN ? {} : { difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]! }),
  })),
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const dip = (action: Extract<Command, { type: 'DIPLOMACY' }>['action'], target: string): Command => ({
  type: 'DIPLOMACY',
  playerId: 'p5',
  targetPlayerId: target,
  action,
})

/** Tick → Befehle des Menschen. Das Buendnis mit `p2` nimmt die KI von selbst an. */
const SCRIPT: Record<number, Command[]> = {
  24: [dip('grantRightOfWay', 'p6')],
  48: [dip('shareMap', 'p7')],
  72: [dip('offerAlliance', 'p2')],
  480: [dip('declareWar', 'p8')],
  719: [dip('offerPeace', 'p8')],
}

describe('T-M17-02 save-v3.json entsteht zeichengleich aus seinem Rezept', () => {
  it('spielt 30 Spieltage und vergleicht (oder schreibt) den eingefrorenen Stand', async () => {
    expect(SCHEMA_VERSION, 'das Rezept gilt nur auf Stufe 3 — siehe Kopfkommentar').toBe(3)

    let state = createInitialState(config, { map, rules })
    const rejected: unknown[] = []
    for (let day = 0; day < DAYS; day++) {
      const chunk = advanceTicks(state, rules.constants.ticksPerDay, { map, rules }, { scripted: (tick) => SCRIPT[tick] ?? [] })
      state = chunk.state
      rejected.push(...chunk.events.filter((event) => event.type === 'COMMAND_REJECTED' && event.playerId === 'p5'))
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(rejected, 'ein Befehl des Rezepts wurde abgelehnt').toEqual([])
    expect(state.tick).toBe(DAYS * rules.constants.ticksPerDay)

    // Was der Stand tragen muss, damit der Schritt 3 → 4 etwas zu verlieren hat (T-M17-02, Fertig wenn).
    const relations = Object.values(state.diplomacy.relations)
    expect(relations.some((relation) => relation.rightOfWay && relation.state !== 'alliance'), 'kein Durchmarsch ohne Buendnis').toBe(true)
    expect(relations.some((relation) => relation.sharedMap && relation.state !== 'alliance'), 'keine Karte ohne Buendnis').toBe(true)
    expect(state.diplomacy.offers.some((offer) => offer.kind === 'peace'), 'kein offenes Friedensangebot').toBe(true)

    const text = serialise(state, LABEL)
    // Gegenprobe: der Text laedt unmigriert, also mit gepruefter Pruefsumme.
    expect(hashValue(deserialise(text), { omitKeys: HASH_OMIT_KEYS })).toBe(hashValue(state, { omitKeys: HASH_OMIT_KEYS }))

    const pretty = JSON.stringify(JSON.parse(text), null, 2) + '\n'
    if (process.env['FREEZE_V3'] === '1') writeFileSync(FROZEN, pretty)
    const frozen = readFileSync(FROZEN, 'utf8')
    expect(frozen === pretty, 'save-v3.json entsteht nicht zeichengleich aus dem Rezept').toBe(true)

    // Die Pruefsumme im Umschlag beschreibt den Zustand in der Datei — nachgerechnet, nicht geglaubt.
    const envelope = JSON.parse(frozen) as { schemaVersion: number; savedAtTick: number; hash: string; state: unknown }
    expect(envelope.schemaVersion).toBe(3)
    expect(envelope.savedAtTick).toBe(state.tick)
    expect(hashValue(envelope.state, { omitKeys: HASH_OMIT_KEYS })).toBe(envelope.hash)
  })
})
