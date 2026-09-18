import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  SCHEMA_VERSION,
  createInitialState,
  parseRules,
  type GameConfig,
  type GameState,
  type MapData,
  type Rules,
} from '@worldwar/core'
import {
  PROBE_TICKS,
  acceptState,
  createLockstep,
  encodeMessage,
  parseMessage,
  probeMessage,
  resumeDecision,
  runProbeFrom,
  savedGameOf,
  stateHash,
  stateMessage,
} from '../src/index'

/**
 * Speichern und Fortsetzen zu zweit (T-M39-06, R-MP-13, D28.11).
 *
 * Eine Partie über mehrere Abende — sonst ist jeder Abbruch endgültig. Zum Fortsetzen
 * eröffnet der Host einen neuen Raum, und der Handschlag vergleicht die Stände: sind sie
 * gleich, geht es weiter; sind sie ungleich, überträgt der Host seinen, und **beide prüfen
 * erneut**.
 *
 * **Gemessen auf der ausgelieferten Weltkarte**, sechs Mächte, dreißig Spieltage — nicht
 * auf der Testkarte. Was zwölf Provinzen an Spielstand ergeben, sagt nichts über 237, und
 * die Zahl, um die es hier geht, ist eine Größe in Kilobyte.
 */

const ROOT = process.cwd()
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const rules: Rules = parseRules(
  {
    constants: JSON.parse(readFileSync(`${ROOT}/data/rules/default/constants.json`, 'utf8')),
    resources: JSON.parse(readFileSync(`${ROOT}/data/rules/default/resources.json`, 'utf8')),
    buildings: JSON.parse(readFileSync(`${ROOT}/data/rules/default/buildings.json`, 'utf8')),
    units: JSON.parse(readFileSync(`${ROOT}/data/rules/default/units.json`, 'utf8')),
    ai: JSON.parse(readFileSync(`${ROOT}/data/rules/default/ai.json`, 'utf8')),
  } as never,
  'default',
)
const ctx = { map: world, rules }

const config: GameConfig = {
  seed: 1914,
  mapId: world.id,
  rulesId: 'default',
  players: world.startPositions.slice(0, 6).map((start, index) => ({
    name: start.nation,
    kind: index < 2 ? ('human' as const) : ('ai' as const),
    nation: start.nation,
    color: `farbe-${index + 1}`,
    ...(index < 2 ? {} : { difficulty: 'normal' as const }),
  })),
  victory: { condition: 'points', pointsShareToWin: 700, dayLimit: null },
}

const ticksPerDay = rules.constants.ticksPerDay
/** Dreißig Spieltage — die Zahl aus dem Bauplan, an der die 249 KB gemessen wurden. */
const DREISSIG_TAGE = 30 * ticksPerDay

const frisch = () => createInitialState(config, ctx)
/** Ein gespeicherter Stand nach `tage` Spieltagen. Teuer, deshalb einmal gerechnet. */
const gespielt = (tage: number) => advanceTicks(frisch(), tage * ticksPerDay, ctx, {}).state

/**
 * Die drei Staende, die dieser Lauf braucht — **einmal** gerechnet.
 *
 * Dreissig Spieltage auf der Weltkarte sind 720 Ticks mit sechs Maechten; jeder Lauf
 * kostet rund eine Sekunde. `zweiterNachDreissig` ist mit Absicht ein GETRENNTER Lauf und
 * keine Kopie: dass zwei unabhaengige Rechnungen denselben Stand ergeben, ist die halbe
 * Zusage — eine Kopie mit sich selbst zu vergleichen belegte nichts.
 */
const nachDreissig = gespielt(30)
const zweiterNachDreissig = gespielt(30)
const nachZwanzig = gespielt(20)

describe('R-MP-13/AK1 Der Handschlag vergleicht die Staende beider Seiten', () => {
  it('laesst zwei gleiche Staende weiterlaufen, ohne dass etwas uebertragen wird', () => {
    // Der Normalfall: beide haben denselben Abend gespielt und denselben Stand gesichert.
    const host = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)
    const gast = runProbeFrom(zweiterNachDreissig, ctx, PROBE_TICKS)

    expect(gast.from, 'zwei getrennt gerechnete Staende sind nicht gleich').toBe(host.from)
    expect(resumeDecision(host, probeMessage(gast))).toEqual({ kind: 'continue' })
  })

  it('verlangt eine Uebertragung, wenn der Gast einen aelteren Stand hat', () => {
    const host = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)
    const gast = runProbeFrom(nachZwanzig, ctx, PROBE_TICKS)
    const entscheid = resumeDecision(host, probeMessage(gast))

    expect(entscheid.kind).toBe('transfer')
    expect(entscheid.kind === 'transfer' && entscheid.reason).toMatch(/verschiedene(n)? Staenden/)
  })

  it('verlangt sie auch, wenn der Gast gar keinen Stand hat', () => {
    // „Gar keinen" heisst in der Huelle: er faengt beim frischen Startzustand an. Der ist
    // fuer ihn immer ausrechenbar - und er ist zwangslaeufig ein anderer.
    const host = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)
    const gast = runProbeFrom(frisch(), ctx, PROBE_TICKS)

    expect(resumeDecision(host, probeMessage(gast)).kind).toBe('transfer')
  })

  it('unterscheidet den Abbruch von der Uebertragung — das ist der ganze Zweck des Startabdrucks', () => {
    // Die Zeile, ohne die der Host raten muesste. Gleicher Start und verschiedenes
    // Ergebnis ist ein RECHENFEHLER und kein Fall fuer eine Uebertragung; wer das
    // verwechselt, schickt bei jedem Auseinanderlaufen ein Viertelmegabyte hinueber und
    // spielt weiter, als waere nichts.
    const host = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)
    const verfaelscht = probeMessage({ ...host, hash: 'ein-anderes-ergebnis' })

    const entscheid = resumeDecision(host, verfaelscht)
    expect(entscheid.kind).toBe('abort')
    expect(entscheid.kind === 'abort' && entscheid.reason).toMatch(/zwei Ergebnisse/)
  })

  it('nennt in der Probe den Stand, von dem sie losgerechnet hat', () => {
    const probe = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)

    expect(probe.from).toBe(stateHash(nachDreissig))
    expect(probe.hash, 'die Probe hat gar nicht gerechnet').not.toBe(probe.from)
    expect(probeMessage(probe).fromHash).toBe(probe.from)
    // Und die Nachricht uebersteht den Weg ueber die Leitung mit beiden Zahlen.
    const zurueck = parseMessage(JSON.parse(encodeMessage(probeMessage(probe))))
    expect(zurueck.ok && zurueck.message).toEqual(probeMessage(probe))
  })
})

describe('R-MP-13/AK2 Der uebertragene Stand fuehrt dieselbe Pruefsumme', () => {
  it('kommt beim Gast als derselbe Stand an — und wird sonst verworfen', () => {
    const host = runProbeFrom(nachDreissig, ctx, PROBE_TICKS)
    // Der Weg ueber die Leitung, wirklich durch JSON: eine Map, ein undefined, eine
    // Klasse - alles, was den Weg nicht uebersteht, faellt hier auf und nicht abends.
    const gesendet = encodeMessage(stateMessage(nachDreissig))
    const angekommen = parseMessage(JSON.parse(gesendet))
    expect(angekommen.ok).toBe(true)
    if (!angekommen.ok || angekommen.message.kind !== 'zustand') return

    const genommen = acceptState(angekommen.message, host.from)
    expect(genommen.ok).toBe(true)
    if (!genommen.ok) return
    expect(stateHash(genommen.state)).toBe(stateHash(nachDreissig))
    expect(genommen.state.tick).toBe(DREISSIG_TAGE)

    // Und die Gegenprobe: ein Stand, der nicht zu dem passt, was angekuendigt war, wird
    // verworfen. Die eigene Rechnung ueber das eigene Ergebnis waere keine Pruefung.
    const falsch = acceptState(angekommen.message, 'etwas-ganz-anderes')
    expect(falsch.ok).toBe(false)
    expect(falsch.ok === false && falsch.reason).toMatch(/verworfen/)
  })

  it('verwirft einen Stand aus einer anderen Formatstufe — und nennt den Grund (T-M17-03)', () => {
    // Der Fall aus dem Betrieb: der Gast hat einen aelteren Bau, der Gastgeber uebertraegt
    // seinen Stand. Bis zum 2026-09-18 haette diese Seite ihn angenommen, wenn die
    // Pruefsumme passte — und der erste Tick waere an einem Feld gescheitert, das es in der
    // alten Stufe nicht gibt (`cloneState` liest `espionage`). Geprueft wird deshalb ZUERST
    // die Stufe, und die Meldung nennt beide Zahlen statt „verstuemmelter Spielstand".
    const alt = JSON.parse(JSON.stringify(nachDreissig)) as GameState & { schemaVersion: number }
    alt.schemaVersion = SCHEMA_VERSION - 1
    const nachricht = parseMessage(JSON.parse(encodeMessage(stateMessage(alt))))
    expect(nachricht.ok && nachricht.message.kind === 'zustand').toBe(true)
    if (!nachricht.ok || nachricht.message.kind !== 'zustand') return

    const genommen = acceptState(nachricht.message, stateHash(alt))
    expect(genommen.ok, 'ein Stand aus einer anderen Stufe wurde angenommen').toBe(false)
    expect(genommen.ok === false && genommen.reason).toContain(`${SCHEMA_VERSION}`)
    expect(genommen.ok === false && genommen.reason).toMatch(/Fassungen|Faende|Format/)
  })

  it('spielt danach im Gleichschritt weiter, und beide Seiten bleiben gleich', () => {
    // Der Beleg, der zaehlt: nicht dass ein Feld stimmt, sondern dass die fortgesetzte
    // Partie zu zweit wirklich laeuft. Der Gast hatte einen aelteren Stand, bekommt den
    // des Hosts, und danach rechnen beide gegeneinander weiter.
    const hostStand = nachDreissig
    const host = runProbeFrom(hostStand, ctx, PROBE_TICKS)
    const gastAlt = runProbeFrom(nachZwanzig, ctx, PROBE_TICKS)
    expect(resumeDecision(host, probeMessage(gastAlt)).kind).toBe('transfer')

    const uebertragen = parseMessage(JSON.parse(encodeMessage(stateMessage(hostStand))))
    expect(uebertragen.ok && uebertragen.message.kind === 'zustand').toBe(true)
    if (!uebertragen.ok || uebertragen.message.kind !== 'zustand') return
    const genommen = acceptState(uebertragen.message, host.from)
    expect(genommen.ok).toBe(true)
    if (!genommen.ok) return

    // Und beide pruefen erneut (R-MP-13/AK1, zweiter Satz).
    const gastNeu = runProbeFrom(genommen.state, ctx, PROBE_TICKS)
    expect(resumeDecision(host, probeMessage(gastNeu))).toEqual({ kind: 'continue' })

    const eins = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: hostStand, ctx })
    const zwei = createLockstep({ seat: 'p2', seats: ['p1', 'p2'], state: genommen.state, ctx })
    eins.receive('p2', zwei.emit())
    zwei.receive('p1', eins.emit())

    // Zwei Spieltage, nicht zweihundert Ticks: dass der Gleichschritt ueber zweihundert
    // Ticks haelt, steht zweimal woanders (twoclients.test.ts, party.test.tsx). Hier geht
    // es um den Anfang - dass die FORTGESETZTE Partie ueberhaupt laeuft, und zwar ueber
    // einen Tageswechsel hinweg, an dem Wirtschaft, Bau und Freischaltung haengen.
    const weiter = 2 * ticksPerDay
    for (let tick = 0; tick < weiter; tick += 1) {
      expect(eins.canStep(), `Tick ${tick} war nicht freigegeben`).toBe(true)
      eins.step()
      zwei.step()
      expect(stateHash(eins.state), `Tick ${tick} nach der Wiederaufnahme`).toBe(stateHash(zwei.state))
      eins.receive('p2', zwei.emit())
      zwei.receive('p1', eins.emit())
    }
    expect(eins.tick).toBe(DREISSIG_TAGE + weiter)
  }, 30_000)
})

/**
 * Was die Übertragung kostet, gemessen statt geschätzt (T-M39-06, D28.11).
 *
 * Der Bauplan nennt 93,6 KB am Anfang und 249 KB nach dreißig Spieltagen (gemessen am
 * 2026-09-12). Diese Zusicherung misst dieselben zwei Zahlen an der Nachricht, die
 * wirklich über die Leitung geht — also samt Umschlag und samt JSON.
 *
 * **Die Grenze ist grosszügig und mit Absicht kein enger Deckel.** Sie soll melden, wenn
 * eine Partie *deutlich* über das hinauswächst, was der Entwurf angenommen hat — nicht bei
 * jedem zusätzlichen Feld im Zustand anschlagen. Wächst sie, gehört die neue Zahl in den
 * Bericht und nicht in eine Schätzung.
 */
describe('R-MP-13 Die Uebertragung des Standes, in Kilobyte', () => {
  it('bleibt in der Groessenordnung, die der Entwurf angenommen hat', () => {
    const amAnfang = encodeMessage(stateMessage(frisch())).length
    const nachDreissigTagen = encodeMessage(stateMessage(nachDreissig)).length

    // Die Zahlen landen in der Meldung, damit ein Lauf sie ausspuckt, ohne dass jemand
    // den Test aendern muss.
    const gemessen = `Anfang ${Math.round(amAnfang / 1024)} KB, nach 30 Spieltagen ${Math.round(nachDreissigTagen / 1024)} KB`
    // Damit ein Lauf die Zahlen ausspuckt, statt sie nur in einer Fehlermeldung zu haben,
    // die niemand sieht, solange alles gruen ist.
    console.log(`[T-M39-06] Zustandsnachricht: ${gemessen}`)

    expect(amAnfang, gemessen).toBeGreaterThan(50_000)
    expect(nachDreissigTagen, gemessen).toBeGreaterThan(amAnfang)
    // Ein Viertelmegabyte war die Annahme; das Doppelte ist die Grenze, ab der jemand
    // hinsehen soll. Auf dieser Leitung ist selbst das eine Sekunde.
    expect(nachDreissigTagen, `${gemessen} — deutlich ueber der Annahme von 249 KB`).toBeLessThan(512_000)
  })

  it('ist die EINZIGE Nachricht, die einen Zustand traegt', () => {
    // D28.2: uebertragen werden Befehle, nie Zustaende. `zustand` ist die eine Ausnahme,
    // und sie ist kein Schlupfloch, sondern der Anfangswert des Gleichschritts.
    const befehle = createLockstep({ seat: 'p1', seats: ['p1', 'p2'], state: nachDreissig, ctx }).emit()

    expect(Object.keys(befehle).sort()).toEqual(['commands', 'hash', 'kind', 'tick', 'version'])
    expect(encodeMessage(befehle).length, 'eine Befehlsnachricht traegt einen Zustand').toBeLessThan(1000)
    expect(savedGameOf(nachDreissig)).toEqual({ tick: DREISSIG_TAGE, hash: stateHash(nachDreissig) })
  })
})
