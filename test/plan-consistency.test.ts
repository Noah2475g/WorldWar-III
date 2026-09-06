import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { checkScope, parseRequirements } from '../scripts/requirements-coverage.mjs'
import { missingPaths, reopenedWithoutReason, type PlanTask } from './plan-paths'

/**
 * The plan guards itself (T-M0-05).
 *
 * `03-TASKS.md` is what a human reads; `tasks.yaml` is what an agent executes. If they
 * drift apart, the executing agent silently works from an outdated list — the failure
 * mode is invisible until something is built wrong.
 */

const md = readFileSync(new URL('../docs/plan/03-TASKS.md', import.meta.url), 'utf8')
const yamlText = readFileSync(new URL('../docs/plan/tasks.yaml', import.meta.url), 'utf8')
const requirementsText = readFileSync(new URL('../docs/plan/01-REQUIREMENTS.md', import.meta.url), 'utf8')

interface YamlTask {
  id: string
  milestone: string
  title: string
  status: string
  deps?: string[]
  requirements?: string[]
  constraints?: string[]
  design?: string[]
  acceptance?: string[]
  gate?: boolean
  gate_reason?: string
  /** T-M14-02: was der Plan über das Dateisystem behauptet — und was ihn zurückstuft. */
  files?: string[]
  tests?: string[]
  reopened?: string
}

const plan = parseYaml(yamlText) as {
  milestones: { id: string; title: string }[]
  tasks: YamlTask[]
}

/** Parse the human document: task headings plus their dependency and requirement lines. */
function parseMarkdown(): Map<string, { deps: string[]; requirements: string[] }> {
  const tasks = new Map<string, { deps: string[]; requirements: string[] }>()
  const sections = md.split(/^### /m).slice(1)

  for (const section of sections) {
    const id = section.match(/^(T-M\d+-\d+[a-c]?)/)?.[1]
    if (!id) continue

    const depLine = section.match(/^- \*\*Abhängigkeiten:\*\*(.*)$/m)?.[1] ?? ''
    const reqLine = section.match(/^- \*\*Anforderungen:\*\*(.*)$/m)?.[1] ?? ''

    tasks.set(id, {
      deps: [...depLine.matchAll(/T-M\d+-\d+[a-c]?/g)].map((m) => m[0]),
      requirements: [...reqLine.matchAll(/R-[A-Z]+-\d{2}/g)].map((m) => m[0]),
    })
  }
  return tasks
}

const fromMarkdown = parseMarkdown()
const byId = new Map(plan.tasks.map((t) => [t.id, t]))

describe('R-ARCH-05 Plan-Konsistenz', () => {
  it('beide Aufgabendateien enthalten dieselben IDs', () => {
    const inYaml = [...byId.keys()].sort()
    const inMd = [...fromMarkdown.keys()].sort()
    expect(inYaml).toEqual(inMd)
  })

  it('jede Abhängigkeit zeigt auf eine existierende Aufgabe', () => {
    const dangling: string[] = []
    for (const task of plan.tasks) {
      for (const dep of task.deps ?? []) {
        if (!byId.has(dep)) dangling.push(`${task.id} -> ${dep}`)
      }
    }
    expect(dangling, `unbekannte Abhängigkeiten: ${dangling.join(', ')}`).toEqual([])
  })

  it('die Abhängigkeiten stimmen zwischen beiden Dateien überein', () => {
    const mismatches: string[] = []
    for (const [id, mdTask] of fromMarkdown) {
      const yamlTask = byId.get(id)
      if (!yamlTask) continue
      const a = [...mdTask.deps].sort().join(',')
      const b = [...(yamlTask.deps ?? [])].sort().join(',')
      if (a !== b) mismatches.push(`${id}: md=[${a}] yaml=[${b}]`)
    }
    expect(mismatches, `abweichende Abhängigkeiten:\n${mismatches.join('\n')}`).toEqual([])
  })

  it('die Anforderungsbezüge stimmen zwischen beiden Dateien überein', () => {
    const mismatches: string[] = []
    for (const [id, mdTask] of fromMarkdown) {
      const yamlTask = byId.get(id)
      if (!yamlTask) continue
      const a = [...new Set(mdTask.requirements)].sort().join(',')
      const b = [...new Set(yamlTask.requirements ?? [])].sort().join(',')
      if (a !== b) mismatches.push(`${id}: md=[${a}] yaml=[${b}]`)
    }
    expect(mismatches, `abweichende Anforderungsbezüge:\n${mismatches.join('\n')}`).toEqual([])
  })

  it('kennt keine Abhängigkeitszyklen', () => {
    const state = new Map<string, 'open' | 'done'>()
    const cycles: string[] = []

    const visit = (id: string, trail: string[]): void => {
      if (state.get(id) === 'done') return
      if (state.get(id) === 'open') {
        cycles.push([...trail, id].join(' -> '))
        return
      }
      state.set(id, 'open')
      for (const dep of byId.get(id)?.deps ?? []) visit(dep, [...trail, id])
      state.set(id, 'done')
    }

    for (const id of byId.keys()) visit(id, [])
    expect(cycles, `Zyklus: ${cycles.join(' | ')}`).toEqual([])
  })

  it('jede Aufgabe gehört zu einem deklarierten Meilenstein', () => {
    const known = new Set(plan.milestones.map((m) => m.id))
    const orphans = plan.tasks.filter((t) => !known.has(t.milestone)).map((t) => t.id)
    expect(orphans, `unbekannter Meilenstein bei: ${orphans.join(', ')}`).toEqual([])
  })

  // T-M14-01: Die zweite Richtung derselben Bindung. Der scope-Block verschiebt
  // Anforderungen auf Meilensteine; nennt er einen, den der Aufgabenplan nicht kennt,
  // ist die Verschiebung ein Zettel ohne Adresse — die Anforderung wäre aus der
  // V1-Pflicht heraus und in keiner Planung drin.
  it('der scope-Block nennt nur Meilensteine, die der Aufgabenplan deklariert', () => {
    const known = new Set(plan.milestones.map((m) => m.id))
    const errors = checkScope(
      parseRequirements(requirementsText).later,
      new Set(parseRequirements(requirementsText).ids),
      known,
    )
    expect(errors, errors.join('\n')).toEqual([])
  })

  it('referenziert nur Anforderungen, die es wirklich gibt', () => {
    const known = new Set([...requirementsText.matchAll(/^- \*\*(R-[A-Z]+-\d{2})/gm)].map((m) => m[1]))
    const unknown: string[] = []
    for (const task of plan.tasks) {
      for (const id of task.requirements ?? []) {
        if (!known.has(id)) unknown.push(`${task.id} -> ${id}`)
      }
    }
    expect(unknown, `unbekannte Anforderungen: ${unknown.join(', ')}`).toEqual([])
  })

  it('trennt Anforderungen, Rahmenbedingungen und Design sauber', () => {
    // The requirements gate parses only R-IDs; a C- or D-ID in that field would be
    // silently ignored and the task would look covered when it is not.
    const wrong: string[] = []
    for (const task of plan.tasks) {
      for (const id of task.requirements ?? []) {
        if (!/^R-/.test(id)) wrong.push(`${task.id}: ${id}`)
      }
      for (const id of task.constraints ?? []) {
        if (!/^C-/.test(id)) wrong.push(`${task.id}: ${id}`)
      }
      for (const id of task.design ?? []) {
        if (!/^D-/.test(id)) wrong.push(`${task.id}: ${id}`)
      }
    }
    expect(wrong, `falsch einsortierte IDs: ${wrong.join(', ')}`).toEqual([])
  })

  it('hält die vier Haltepunkte fest', () => {
    const gates = plan.tasks.filter((t) => t.gate).map((t) => t.id)
    expect(gates).toEqual(['T-M9-01', 'T-M10-01', 'T-M12-03', 'T-M14-15'])
    for (const id of gates) {
      // A gate without a stated reason is just a blocked task.
      expect(byId.get(id)?.gate_reason, `${id} braucht eine Begründung`).toBeTruthy()
    }
  })

  it('führt jeden Haltepunkt in der Übersicht von 03-TASKS.md', () => {
    // T-M14-15: Die Liste oben ist maschinenlesbar, die Übersicht am Ende von 03-TASKS.md
    // ist das, was ein Mensch liest — und die vierte Zeile stand dort einen Meilenstein
    // lang, ohne dass `tasks.yaml` etwas davon wusste. Ein Haltepunkt, den nur eine der
    // beiden Seiten kennt, hält niemanden auf.
    const table = md.slice(md.indexOf('## Übersicht: Haltepunkte'))
    expect(table.length, 'Keine Haltepunkt-Übersicht in 03-TASKS.md').toBeGreaterThan(0)

    const listed = [...table.matchAll(/^\| (T-M\d+-\d+[a-z]?) \|/gm)].map((match) => match[1]!)
    const gates = plan.tasks.filter((t) => t.gate).map((t) => t.id)

    expect(listed, 'Die Übersicht nennt andere Haltepunkte als tasks.yaml').toEqual(gates)
  })
})

// T-M14-02: Was der Plan über das Dateisystem behauptet, muss stimmen.
//
// Die Prüfung läuft zweimal: an erfundenen Aufgabenlisten (damit der Fehlerfall selbst
// geprüft ist und die Prüfung nicht bedeutungslos wird, sobald die echten Pfade stimmen)
// und an der echten `tasks.yaml`.
describe('R-ARCH-05 Der Plan beschreibt Dateien, die es gibt', () => {
  const erfunden = (kind: (path: string) => 'file' | 'dir' | null) => kind

  it('meldet einen toten Pfad einer erledigten Aufgabe', () => {
    const tasks: PlanTask[] = [{ id: 'T-X-01', status: 'done', files: ['gibtsnicht.ts'] }]
    const result = missingPaths(tasks, erfunden(() => null))
    expect(result).toEqual([{ task: 'T-X-01', field: 'files', path: 'gibtsnicht.ts', reason: 'fehlt' }])
  })

  it('lässt einer offenen Aufgabe ihre künftigen Dateien', () => {
    // Eine Aufgabe darf benennen, was sie anlegen wird — das ist der Zweck eines Plans.
    const tasks: PlanTask[] = [{ id: 'T-X-01', status: 'todo', files: ['kommtnoch.ts'] }]
    expect(missingPaths(tasks, erfunden(() => null))).toEqual([])
  })

  it('unterscheidet Datei und Verzeichnis am Schrägstrich', () => {
    const tasks: PlanTask[] = [
      { id: 'T-X-01', status: 'done', files: ['ordner/'] },
      { id: 'T-X-02', status: 'done', files: ['datei.ts'] },
    ]
    const result = missingPaths(tasks, erfunden((p) => (p === 'ordner' ? 'file' : 'dir')))
    expect(result).toEqual([
      { task: 'T-X-01', field: 'files', path: 'ordner/', reason: 'kein Verzeichnis' },
      { task: 'T-X-02', field: 'files', path: 'datei.ts', reason: 'keine Datei' },
    ])
  })

  it('prüft auch das Feld tests', () => {
    const tasks: PlanTask[] = [{ id: 'T-X-01', status: 'done', tests: ['weg.test.ts'] }]
    expect(missingPaths(tasks, erfunden(() => null))[0]?.field).toBe('tests')
  })

  it('verlangt eine Begründung, wenn eine erledigte Aufgabe von einer offenen abhängt', () => {
    const ohne: PlanTask[] = [
      { id: 'T-X-01', status: 'todo' },
      { id: 'T-X-02', status: 'done', deps: ['T-X-01'] },
    ]
    expect(reopenedWithoutReason(ohne)).toEqual(['T-X-01'])

    const mit: PlanTask[] = [
      { id: 'T-X-01', status: 'todo', reopened: 'abgelöst durch T-X-09' },
      { id: 'T-X-02', status: 'done', deps: ['T-X-01'] },
    ]
    expect(reopenedWithoutReason(mit)).toEqual([])
  })

  it('lässt eine offene Aufgabe ohne erledigten Nachfolger in Ruhe', () => {
    const tasks: PlanTask[] = [
      { id: 'T-X-01', status: 'todo' },
      { id: 'T-X-02', status: 'todo', deps: ['T-X-01'] },
    ]
    expect(reopenedWithoutReason(tasks)).toEqual([])
  })

  it('jede erledigte Aufgabe nennt nur Pfade, die es gibt', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const onDisk = (path: string): 'file' | 'dir' | null => {
      try {
        return statSync(join(root, path)).isDirectory() ? 'dir' : 'file'
      } catch {
        return null
      }
    }
    const result = missingPaths(plan.tasks as PlanTask[], onDisk)
    const lines = result.map((m) => `${m.task} ${m.field}: ${m.path} (${m.reason})`)
    expect(result, `${result.length} tote Pfade:\n${lines.join('\n')}`).toEqual([])
  })

  it('jede zurückgestufte Aufgabe sagt, warum und wer sie schließt', () => {
    const open = reopenedWithoutReason(plan.tasks as PlanTask[])
    expect(open, `ohne reopened-Begründung: ${open.join(', ')}`).toEqual([])
  })

  // T-M14-02b, die Gegenrichtung. Bisher prüfte der Wächter nur Aufgabe → Anforderung.
  // Genau auf dem umgekehrten Weg liefen am 2026-09-04 achtzehn Anforderungen ohne
  // Entwurfstext und ohne Aufgabe grün durch: eine Anforderung ohne beides ist kein
  // Auftrag, sondern ein Wunsch.
  /**
   * Ein Meilenstein ist *geplant*, sobald er Aufgaben hat. M16 bis M18 stehen heute als
   * Achse in `milestones:`, tragen aber keine Aufgabe — sie sind Vorrat, kein Auftrag.
   * Für ihre Anforderungen jetzt Entwurf und Aufgabe zu verlangen hieße, Jahre im Voraus
   * zu entwerfen; sobald jemand M17 plant, greift die Regel dort von selbst.
   */
  const geplant = new Set(plan.tasks.map((t) => t.milestone))

  it('jede Anforderung eines geplanten Meilensteins hat eine Aufgabe', () => {
    const { ids, v2Only, later } = parseRequirements(requirementsText)
    const inAufgaben = new Set(plan.tasks.flatMap((t) => t.requirements ?? []))
    const faellig = ids.filter((id: string) => {
      if (v2Only.has(id)) return false
      const milestone = String(later[id] ?? '').split('—')[0]?.trim()
      return !milestone || geplant.has(milestone)
    })
    const ohneAufgabe = faellig.filter((id: string) => !inAufgaben.has(id))
    expect(ohneAufgabe, `ohne Aufgabe: ${ohneAufgabe.join(', ')}`).toEqual([])
  })

  it('jede noch zu bauende Anforderung hat auch einen Entwurfstext', () => {
    // Bewusst nur für das, was als Nächstes gebaut wird. Für die fertige V1 ist der Code
    // der Beleg — 32 ihrer IDs kommen in 02-DESIGN.md nicht namentlich vor, weil der
    // Entwurf Mechanismen beschreibt und keine Anforderungen abschreibt. Wo es weh tat,
    // war das andere Ende: R-TECH-01 und die siebzehn anderen aus dem Nachtrag hatten
    // weder Entwurf noch Aufgabe.
    const design = readFileSync(new URL('../docs/plan/02-DESIGN.md', import.meta.url), 'utf8')
    const { later } = parseRequirements(requirementsText)
    const zuBauen = Object.entries(later).filter(([, wert]) =>
      geplant.has(String(wert).split('—')[0]?.trim() ?? ''),
    )
    const ohneEntwurf = zuBauen
      .filter(([, wert]) => !String(wert).includes('gestrichen'))
      .map(([id]) => id)
      .filter((id) => !design.includes(id))
    expect(ohneEntwurf, `zu bauen, aber ohne Entwurfstext: ${ohneEntwurf.join(', ')}`).toEqual([])
  })
})
