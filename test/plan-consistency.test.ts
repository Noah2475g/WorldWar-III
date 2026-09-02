import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'

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

  it('hält die drei Haltepunkte fest', () => {
    const gates = plan.tasks.filter((t) => t.gate).map((t) => t.id)
    expect(gates).toEqual(['T-M9-01', 'T-M10-01', 'T-M12-03'])
    for (const id of gates) {
      // A gate without a stated reason is just a blocked task.
      expect(byId.get(id)?.gate_reason, `${id} braucht eine Begründung`).toBeTruthy()
    }
  })
})
