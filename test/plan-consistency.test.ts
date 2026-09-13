import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { checkScope, parseRequirements } from '../scripts/requirements-coverage.mjs'
import {
  missingPaths,
  missingProsePaths,
  readProsePaths,
  reopenedWithoutReason,
  type PlanTask,
  type ProseFileSystem,
} from './plan-paths'

/**
 * How many files under `cwd` match a repo-relative glob (`*`, `**`, `?`)?
 *
 * `globSync` from `node:fs` only exists from Node 22, while `package.json` allows Node 20 —
 * the plan guard would fail there for a reason that has nothing to do with the plan.
 */
function countGlobMatches(pattern: string, cwd: string): number {
  const segments = pattern.split('/')
  const firstWild = segments.findIndex((s) => /[*?]/.test(s))
  const base = segments.slice(0, firstWild).join('/')
  const wild = segments.slice(firstWild)
  const source = wild
    .map((segment, index) => {
      // A trailing `**` matches everything below, a `**` in between any number of folders.
      if (segment === '**') return index === wild.length - 1 ? '.*' : '(?:[^/]+/)*'
      const literal = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')
      return index === wild.length - 1 ? literal : `${literal}/`
    })
    .join('')
  const matcher = new RegExp(`^${source}$`)
  let entries: string[]
  try {
    entries = readdirSync(join(cwd, base), { recursive: true, encoding: 'utf8' })
  } catch {
    return 0
  }
  return entries.map((entry) => entry.replace(/\\/g, '/')).filter((entry) => matcher.test(entry)).length
}

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

/** Das echte Dateisystem, von der Wurzel des Repos aus gesehen. */
const root = fileURLToPath(new URL('..', import.meta.url))
const onDisk = (path: string): 'file' | 'dir' | null => {
  try {
    return statSync(join(root, path)).isDirectory() ? 'dir' : 'file'
  } catch {
    return null
  }
}

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

// 2026-09-13: Der Wächter liest auch die Fassung, die ein Mensch liest.
//
// Bis hierher prüfte er `files:` und `tests:` in `tasks.yaml`. Die `Dateien`- und
// `Tests zuerst`-Zeilen in `03-TASKS.md` daneben nannten zur selben Zeit Dutzende Pfade,
// die es nicht gibt, alle bei erledigten Aufgaben (PROBLEME.md, 2026-09-12) — dieselbe
// Fehlerklasse wie am 2026-09-05, nur am Zwilling. Die Leseregeln stehen an
// `readProsePaths` und im Kopf von `03-TASKS.md`.
describe('R-ARCH-05 Auch 03-TASKS.md beschreibt Dateien, die es gibt', () => {
  const erfunden = (entries: Record<string, 'file' | 'dir'>, globs: Record<string, number> = {}): ProseFileSystem => ({
    exists: (path) => entries[path] ?? null,
    glob: (pattern) => globs[pattern] ?? 0,
  })
  const erledigt: PlanTask[] = [{ id: 'T-X-01', status: 'done' }]
  const doc = (...lines: string[]) => ['### T-X-01 · Erfunden', ...lines].join('\n')
  const tote = (markdown: string, fs: ProseFileSystem) =>
    missingProsePaths(readProsePaths(markdown), erledigt, fs).problems.map((p) => `${p.path} (${p.reason})`)

  it('meldet einen toten Pfad in der Dateien-Zeile einer erledigten Aufgabe', () => {
    const md = doc('- **Dateien:** `da.ts`, `weg.ts`')
    expect(missingProsePaths(readProsePaths(md), erledigt, erfunden({ 'da.ts': 'file' })).problems).toEqual([
      { task: 'T-X-01', field: 'Dateien', path: 'weg.ts', reason: 'fehlt' },
    ])
  })

  it('liest Fortsetzungszeilen bis zur nächsten Feldzeile und nicht darüber hinaus', () => {
    const md = [
      '### T-X-01 · Erfunden',
      '- **Dateien:** `a/eins.ts`,',
      '  `a/zwei.ts`',
      '- **Fertig wenn:** `a/drei.ts` ist nur erwähnt',
      '',
      '### T-X-02 · Die nächste',
      '- **Ziel:** `a/vier.ts`',
    ].join('\n')
    expect(readProsePaths(md).map((e) => e.written)).toEqual(['a/eins.ts', 'a/zwei.ts'])
  })

  it('überliest Anmerkungen in Klammern, auch über mehrere Zeilen', () => {
    // Anmerkungen nennen alte Pfade mit Absicht — „der Pfad hieß im Plan …".
    const md = doc(
      '- **Dateien:** `neu.ts` *(der Pfad hieß im Plan `alt/weg.ts` — die Regeln liegen unter',
      '  `data/`)*, `auch.ts` (`Bezeichner.feld`)',
    )
    expect(readProsePaths(md).map((e) => e.written)).toEqual(['neu.ts', 'auch.ts'])
  })

  it('wertet in Dateien nur, was einen Schrägstrich oder eine Endung trägt', () => {
    const md = doc('- **Dateien:** `package.json` (scripts), `AiMemory`, `pnpm verify`, `.gitignore`')
    const result = missingProsePaths(readProsePaths(md), erledigt, erfunden({}))
    expect(result.problems.map((p) => p.path)).toEqual(['package.json', '.gitignore'])
    expect(result.checked.Dateien).toBe(2)
  })

  it('liest in Tests zuerst nur Pfade, die an der Wurzel des Repos beginnen', () => {
    // Die Prosa nennt Dateien beim Kurznamen; `App.test.tsx` lässt sich nicht auflösen,
    // ohne zu raten, und `map.edges` sieht nur aus wie ein Dateiname.
    const md = doc(
      '- **Tests zuerst:** `apps/x.test.ts` — `App.test.tsx` zeigt `map.edges`;',
      '  `game/advance.test.ts` und `R-GAME-03/04/05` bleiben Prosa',
    )
    const result = missingProsePaths(readProsePaths(md), erledigt, erfunden({ apps: 'dir' }))
    expect(result.problems).toEqual([{ task: 'T-X-01', field: 'Tests zuerst', path: 'apps/x.test.ts', reason: 'fehlt' }])
    expect(result.checked['Tests zuerst']).toBe(1)
  })

  it('löst Klammergruppen in einzelne Pfade auf', () => {
    const md = doc('- **Dateien:** `src/{eins,zwei}.ts`')
    expect(tote(md, erfunden({ 'src/eins.ts': 'file' }))).toEqual(['src/zwei.ts (fehlt)'])
  })

  it('verlangt von einem Glob mindestens einen Treffer', () => {
    const md = doc('- **Dateien:** `src/fx/*`, `src/ui/*.ts`')
    expect(tote(md, erfunden({}, { 'src/ui/*.ts': 3 }))).toEqual(['src/fx/* (Glob ohne Treffer)'])
  })

  it('unterscheidet Verzeichnis, Datei und Pfad ohne Endung', () => {
    const md = doc('- **Dateien:** `ordner/`, `datei.ts`, `apps/desktop/src`')
    const fs = erfunden({ ordner: 'file', 'datei.ts': 'dir', 'apps/desktop/src': 'dir' })
    expect(tote(md, fs)).toEqual(['ordner/ (kein Verzeichnis)', 'datei.ts (keine Datei)'])
  })

  it('erkennt die Kennzeichnung für nie Gebautes und prüft, worauf sie verweist', () => {
    const md = doc(
      '- **Dateien:** `ui/TopBar.tsx` *(nie gebaut — die Kopfleiste ist `ui/Header.tsx`)*,',
      '  `sim/{Host,worker}.ts` *(gelöscht — Weg (b), siehe `docs/DECISIONS.md`)*',
    )
    const beide = { 'ui/Header.tsx': 'file', 'docs/DECISIONS.md': 'file' } as const
    expect(tote(md, erfunden(beide))).toEqual([])
    expect(tote(md, erfunden({ 'docs/DECISIONS.md': 'file' }))).toEqual(['ui/Header.tsx (fehlt)'])
  })

  it('meldet eine Kennzeichnung an einem Pfad, den es gibt', () => {
    // Wer eine gekennzeichnete Datei später baut, muss die Kennzeichnung entfernen —
    // sonst lügt der Plan in die andere Richtung.
    const md = doc('- **Dateien:** `da.ts` (nie gebaut — doch)')
    expect(tote(md, erfunden({ 'da.ts': 'file' }))).toEqual(['da.ts (gekennzeichnet, aber vorhanden)'])
  })

  it('lässt eine Kennzeichnung nur direkt hinter ihrem Pfad gelten', () => {
    const md = doc('- **Dateien:** `weg.ts`, dazu *(nie gebaut — steht zu weit weg)*')
    expect(tote(md, erfunden({}))).toEqual(['weg.ts (fehlt)'])
  })

  it('lässt offenen und unbekannten Aufgaben ihre künftigen Dateien', () => {
    const md = doc('- **Dateien:** `kommtnoch.ts`')
    const offen = missingProsePaths(readProsePaths(md), [{ id: 'T-X-01', status: 'todo' }], erfunden({}))
    const unbekannt = missingProsePaths(readProsePaths(md), [], erfunden({}))
    expect([offen.problems, unbekannt.problems]).toEqual([[], []])
    expect(offen.checked).toEqual({ Dateien: 0, 'Tests zuerst': 0 })
  })

  it('liest aus einem leeren Dokument nichts — und ist dabei grün', () => {
    // Genau deshalb sichert der Lauf am echten Dokument unten zu, wie viel er gelesen hat.
    expect(missingProsePaths(readProsePaths(''), erledigt, erfunden({}))).toEqual({
      checked: { Dateien: 0, 'Tests zuerst': 0 },
      problems: [],
    })
  })

  const echt = missingProsePaths(readProsePaths(md), plan.tasks as PlanTask[], {
    exists: onDisk,
    glob: (pattern) => countGlobMatches(pattern, root),
  })

  it('liest in 03-TASKS.md wirklich Pfade — mindestens einen je erledigter Aufgabe', () => {
    const fertig = plan.tasks.filter((t) => t.status === 'done').length
    expect(echt.checked.Dateien, 'Dateien-Zeilen gelesen').toBeGreaterThanOrEqual(fertig)
    expect(echt.checked['Tests zuerst'], 'Tests-zuerst-Zeilen gelesen').toBeGreaterThan(0)
  })

  it('jede erledigte Aufgabe nennt in 03-TASKS.md nur Pfade, die es gibt', () => {
    const gelesen = echt.checked.Dateien + echt.checked['Tests zuerst']
    const lines = echt.problems.map((p) => `${p.task} ${p.field}: ${p.path} (${p.reason})`)
    expect(echt.problems, `${echt.problems.length} tote von ${gelesen} gelesenen Pfaden:\n${lines.join('\n')}`).toEqual([])
  })
})
