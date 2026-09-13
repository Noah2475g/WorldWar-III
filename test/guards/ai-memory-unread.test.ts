import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, productionFiles } from './scan'

/**
 * Das KI-Gedaechtnis `assignments` wird nirgends gelesen (Nacharbeit T-M41-05, Durchsicht M2).
 *
 * T-M41-05 kuerzt `AiMemory.assignments` auf die lebenden eigenen Armeen. Ohne Wirkung auf die
 * Partie ist das nur, weil niemand das Feld liest: geschrieben in `military.ts`, kopiert in
 * `decide.ts` und `state/clone.ts`. `loop.test.ts` belegt es ueber 200 Ticks einer kleinen Welt,
 * mit der Kuerzung wirklich abgeschaltet; dieser Waechter haelt die Voraussetzung im ganzen
 * Produktcode fest.
 *
 * Faellt er, liest jemand das Feld. Dann ist die Kuerzung eine Verhaltensaenderung und braucht
 * ihre eigene Messung (Vollpartie, Turnier), BEVOR der neue Zugriff hier als erlaubt eingetragen
 * wird — nicht umgekehrt.
 */

/** Was mit `assignments` geschehen darf, ohne es zu lesen — jede Form mit ihrem heutigen Ort. */
const ERLAUBT: readonly { form: string; muster: RegExp }[] = [
  { form: 'Typ (core state/types.ts)', muster: /\bassignments\s*:\s*Record</g },
  { form: 'leer anlegen (decide.ts, core state/create.ts)', muster: /\bassignments\s*:\s*\{\s*\}/g },
  { form: 'kopieren (decide.ts, core state/clone.ts)', muster: /\bassignments\s*:\s*\{\s*\.\.\.[\w.]+\.assignments\s*\}/g },
  { form: 'schreiben (military.ts)', muster: /\bmemory\.assignments\[[^\]\n]+\]\s*=(?!=)/g },
  { form: 'die Kuerzung selbst (military.ts)', muster: /\bmemory\.assignments\s*=\s*Object\.fromEntries\(/g },
  {
    form: 'der Filter der Kuerzung (military.ts)',
    muster: /\bObject\.entries\(memory\.assignments\)\.filter\(\(\[armyId\]\)\s*=>\s*alive\.has\(armyId\)\)/g,
  },
]

/** Kommentare zaehlen nicht; die Zeilennummern bleiben stehen. */
function ohneKommentare(quelle: string): string {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Jeder Zugriff auf `assignments`, der keine erlaubte Form ist, als "Zeile: Text". */
function leser(quelle: string): string[] {
  return ohneKommentare(quelle)
    .split(/\r?\n/)
    .flatMap((zeile, index) => {
      let rest = zeile
      for (const { muster } of ERLAUBT) rest = rest.replace(muster, '')
      return /\bassignments\b/.test(rest) ? [`${index + 1}: ${zeile.trim()}`] : []
    })
}

/** Wie viele erlaubte Zugriffe eine Quelle hat — damit der Waechter nicht leer gruen ist. */
function erlaubteZugriffe(quelle: string): number {
  const ohne = ohneKommentare(quelle)
  return ERLAUBT.reduce((summe, { muster }) => summe + [...ohne.matchAll(muster)].length, 0)
}

const quellen = productionFiles()
  .filter((datei) => /\.tsx?$/.test(datei) && !/\.test\.tsx?$/.test(datei))
  .map((datei) => ({ datei: relative(ROOT, datei).replace(/\\/g, '/'), text: readFileSync(datei, 'utf8') }))

describe('T-M41-05 Nacharbeit: AiMemory.assignments wird nirgends gelesen', () => {
  it('findet im Produktcode keinen Leser', () => {
    const funde = quellen.flatMap(({ datei, text }) => leser(text).map((fund) => `${datei}:${fund}`))
    expect(funde, `assignments wird gelesen:\n${funde.join('\n')}`).toEqual([])
  })

  it('misst nicht leer: die bekannten Orte werden gefunden und als erlaubt erkannt', () => {
    const mitZugriff = quellen.filter(({ text }) => erlaubteZugriffe(text) > 0).map(({ datei }) => datei)
    expect(mitZugriff).toEqual(
      expect.arrayContaining([
        'packages/ai/src/military.ts',
        'packages/ai/src/decide.ts',
        'packages/core/src/state/clone.ts',
        'packages/core/src/state/types.ts',
      ]),
    )
    // Fuenf Schreibzugriffe, Kuerzung und Filter in military.ts.
    const military = quellen.find(({ datei }) => datei === 'packages/ai/src/military.ts')!
    expect(erlaubteZugriffe(military.text)).toBeGreaterThanOrEqual(7)
  })

  it('wird rot, sobald jemand das Feld liest — am echten military.ts vorgefuehrt', () => {
    const military = readFileSync(join(ROOT, 'packages/ai/src/military.ts'), 'utf8')
    const anker = 'for (const army of ownArmies) {'
    expect(military, 'Anker nicht gefunden - die Vorfuehrung misst nichts').toContain(anker)

    const lesend = [
      "    if (memory.assignments[army.id] === 'retreat') continue",
      '    const erinnert = memory.assignments',
      '    const bekannt = Object.keys(context.memory.assignments).length',
      "    memory.assignments[army.id] ??= 'reserve'",
      '    const kopie = { ...memory.assignments }',
    ]
    expect(leser(military)).toEqual([])
    for (const zeile of lesend) {
      const gebrochen = military.replace(anker, `${anker}\n${zeile}`)
      const funde = leser(gebrochen)
      expect(funde, zeile).toHaveLength(1)
      expect(funde[0], zeile).toContain(zeile.trim())
    }
  })

  it('haelt die erlaubten Formen und Kommentare nicht fuer Leser', () => {
    const harmlos = [
      '  assignments: Record<ArmyId, string>',
      '    assignments: {},',
      '    assignments: { ...options.memory.assignments },',
      "      memory.assignments[army.id] = `attack:${choice.id}`",
      '  memory.assignments = Object.fromEntries(',
      '    Object.entries(memory.assignments).filter(([armyId]) => alive.has(armyId)),',
      '  // memory.assignments wird hier nur erwaehnt',
      '  /* const x = memory.assignments */',
    ].join('\n')
    expect(leser(harmlos)).toEqual([])
  })
})
