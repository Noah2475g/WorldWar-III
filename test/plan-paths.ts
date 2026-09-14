/**
 * Does the plan describe files that exist? (T-M14-02)
 *
 * `files:` and `tests:` in `tasks.yaml` are a promise about the file system, not a
 * statement of intent. On 2026-09-05 79 of 289 entries pointed at nothing — all of them
 * in tasks marked `done`, and nobody noticed, because no checker read the fields. That is
 * how a storage port that was never written could stand in the plan as finished work
 * (`docs/reports/audit-2026-09-05.md`, cause A).
 *
 * Pure functions, on purpose: a check that only reads the real file turns green the
 * moment someone repairs the paths, and proves nothing afterwards. These take the task
 * list and an `exists` predicate, so the failure itself can be tested.
 */

export interface PlanTask {
  id: string
  status: string
  deps?: string[]
  files?: string[]
  tests?: string[]
  reopened?: string
}

export interface MissingPath {
  task: string
  field: 'files' | 'tests'
  path: string
  reason: 'fehlt' | 'kein Verzeichnis' | 'keine Datei'
}

/** What kind of thing is a path entry meant to be? A trailing slash means directory. */
function expectsDirectory(path: string): boolean {
  return path.endsWith('/')
}

/**
 * Every path a finished task names must exist.
 *
 * `exists` answers for a repo-relative path: 'file', 'dir' or null. Unfinished tasks are
 * exempt — they are allowed to name what they will create; that is the point of a plan.
 */
export function missingPaths(
  tasks: readonly PlanTask[],
  exists: (path: string) => 'file' | 'dir' | null,
): MissingPath[] {
  const problems: MissingPath[] = []

  for (const task of tasks) {
    if (task.status !== 'done') continue

    for (const field of ['files', 'tests'] as const) {
      for (const path of task[field] ?? []) {
        const kind = exists(path.replace(/\/$/, ''))
        if (kind === null) {
          problems.push({ task: task.id, field, path, reason: 'fehlt' })
        } else if (expectsDirectory(path) && kind !== 'dir') {
          problems.push({ task: task.id, field, path, reason: 'kein Verzeichnis' })
        } else if (!expectsDirectory(path) && kind !== 'file') {
          problems.push({ task: task.id, field, path, reason: 'keine Datei' })
        }
      }
    }
  }
  return problems
}

/**
 * A task that was put back to `todo` while finished tasks depend on it must say why.
 *
 * Without this rule a rollback is silent: the plan would claim a finished chain whose
 * first link is open again, and the next reader would take the `done` at face value.
 */
export function reopenedWithoutReason(tasks: readonly PlanTask[]): string[] {
  const open: string[] = []

  for (const task of tasks) {
    if (task.status === 'done') continue
    const hasFinishedDependant = tasks.some(
      (other) => other.status === 'done' && (other.deps ?? []).includes(task.id),
    )
    if (hasFinishedDependant && !task.reopened?.trim()) open.push(task.id)
  }
  return open
}

/**
 * Does the human copy of the plan describe files that exist? (2026-09-13)
 *
 * `missingPaths` reads `tasks.yaml`. Next to it, `03-TASKS.md` names files in the
 * `Dateien` and `Tests zuerst` lines of every task — the lines a person reads when asking
 * where something lives. On 2026-09-12 they named dozens of paths that do not exist, all of
 * them in finished tasks, while `tasks.yaml` had none: the fault class of 2026-09-05, one
 * file over (`docs/plan/PROBLEME.md`).
 *
 * Reading rules — the same text stands in the header of `03-TASKS.md`:
 *
 * - A field starts at `- **Dateien:**` or `- **Tests zuerst:**` and runs over every
 *   following line that is blank or indented. The first line starting in column one (the
 *   next `- **` field, a heading, a paragraph) ends it.
 * - Only backtick spans count, and only outside parentheses. Text in parentheses is an
 *   annotation and annotations name old paths on purpose ("der Pfad hieß im Plan …").
 * - `Dateien` is a list of repo-root paths. A span is a path if it has no whitespace and
 *   carries a slash or a file extension — `AiMemory` and `pnpm verify` are not paths.
 * - `Tests zuerst` is prose that names files by short names (`App.test.tsx`,
 *   `game/advance.test.ts`), which cannot be resolved without guessing. There a span is a
 *   path only if it has a slash and its first segment is a directory at the repo root.
 * - `{a,b}` stands for one path per alternative. A path with `*` or `?` is a glob and must
 *   match at least one entry. A trailing slash demands a directory, a file extension
 *   demands a file, a path with neither may be either (`apps/desktop/src`).
 * - **Marker for what does not exist on purpose:** an annotation directly behind a span —
 *   nothing but spaces, line breaks and `*` in between — that begins with `nie gebaut` or
 *   `gelöscht` exempts every path of that span. The marker is a claim too: if the path
 *   exists, it is reported, and backtick paths inside the marker are checked like every
 *   other path of the field.
 */

export type ProseField = 'Dateien' | 'Tests zuerst'

const PROSE_FIELDS: readonly ProseField[] = ['Dateien', 'Tests zuerst']

export const NOT_BUILT_MARKERS = ['nie gebaut', 'gelöscht'] as const

export type NotBuiltMarker = (typeof NOT_BUILT_MARKERS)[number]

export interface ProseEntry {
  task: string
  field: ProseField
  /** The backtick span as written, before `{a,b}` is expanded. */
  written: string
  marker: NotBuiltMarker | null
}

export interface ProseProblem {
  task: string
  field: ProseField
  path: string
  reason: MissingPath['reason'] | 'Glob ohne Treffer' | 'gekennzeichnet, aber vorhanden'
}

export interface ProseFileSystem {
  /** 'file', 'dir' or null for a repo-relative path. */
  exists: (path: string) => 'file' | 'dir' | null
  /** How many entries a repo-relative glob matches. */
  glob: (pattern: string) => number
}

export interface ProseCheck {
  /** How many paths were checked per field — a guard over an empty set is always green. */
  checked: Record<ProseField, number>
  problems: ProseProblem[]
}

const EXTENSION = /\.[A-Za-z0-9]+$/

/** The `Dateien` and `Tests zuerst` fields of one task section, continuation lines included. */
function fieldBlocks(section: string): { field: ProseField; text: string }[] {
  const blocks: { field: ProseField; text: string }[] = []
  let current: { field: ProseField; text: string } | null = null

  for (const line of section.split('\n')) {
    const opened = PROSE_FIELDS.find((field) => line.startsWith(`- **${field}:**`))
    if (opened) {
      current = { field: opened, text: line.slice(`- **${opened}:**`.length) }
      blocks.push(current)
    } else if (current && /^(\s|$)/.test(line)) {
      current.text += `\n${line}`
    } else {
      current = null
    }
  }
  return blocks
}

/** Backtick spans outside annotations, with the marker that stands directly behind one. */
function spansOf(task: string, field: ProseField, text: string): ProseEntry[] {
  const entries: ProseEntry[] = []
  let depth = 0
  let insideMarker = false
  let last: { entry: ProseEntry; end: number } | null = null

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '`') {
      const close = text.indexOf('`', i + 1)
      if (close === -1) break
      if (depth === 0 || insideMarker) {
        const entry: ProseEntry = { task, field, written: text.slice(i + 1, close), marker: null }
        entries.push(entry)
        if (depth === 0) last = { entry, end: close + 1 }
      }
      i = close
    } else if (char === '(') {
      if (depth === 0 && last && /^[\s*]*$/.test(text.slice(last.end, i))) {
        const after = text.slice(i + 1).trimStart()
        const marker = NOT_BUILT_MARKERS.find((word) => after.startsWith(word))
        if (marker) {
          last.entry.marker = marker
          insideMarker = true
        }
      }
      depth += 1
    } else if (char === ')' && depth > 0) {
      depth -= 1
      if (depth === 0) insideMarker = false
    }
  }
  return entries
}

/** Every path a task in `03-TASKS.md` names in its `Dateien` and `Tests zuerst` fields. */
export function readProsePaths(markdown: string): ProseEntry[] {
  const entries: ProseEntry[] = []
  for (const section of markdown.split(/^### /m).slice(1)) {
    const task = /^(T-[A-Z0-9]+-\d+[a-z]?)\b/.exec(section)?.[1]
    if (!task) continue
    for (const block of fieldBlocks(section)) entries.push(...spansOf(task, block.field, block.text))
  }
  return entries
}

function expandBraces(path: string): string[] {
  const group = /\{([^{}]*)\}/.exec(path)
  if (!group) return [path]
  const head = path.slice(0, group.index)
  const tail = path.slice(group.index + group[0].length)
  return group[1]!.split(',').flatMap((alternative) => expandBraces(head + alternative + tail))
}

function countsAsPath(written: string, field: ProseField, fs: ProseFileSystem): boolean {
  if (written === '' || /\s/.test(written)) return false
  if (field === 'Dateien') return written.includes('/') || EXTENSION.test(written)
  const first = written.split('/')[0]!
  return written.includes('/') && !/[*?{]/.test(first) && fs.exists(first) === 'dir'
}

function reasonMissing(path: string, fs: ProseFileSystem): ProseProblem['reason'] | null {
  if (/[*?]/.test(path)) return fs.glob(path) > 0 ? null : 'Glob ohne Treffer'
  const kind = fs.exists(path.replace(/\/$/, ''))
  if (kind === null) return 'fehlt'
  if (expectsDirectory(path)) return kind === 'dir' ? null : 'kein Verzeichnis'
  if (EXTENSION.test(path.split('/').pop() ?? '')) return kind === 'file' ? null : 'keine Datei'
  return null
}

/**
 * Every path a finished task names in `03-TASKS.md` must exist — unless it is marked as
 * never built or deleted, and then it must not. Unfinished and unknown tasks are exempt,
 * as in `missingPaths`; the ID check between both plan files is a separate test.
 */
export function missingProsePaths(
  entries: readonly ProseEntry[],
  tasks: readonly Pick<PlanTask, 'id' | 'status'>[],
  fs: ProseFileSystem,
): ProseCheck {
  const finished = new Set(tasks.filter((task) => task.status === 'done').map((task) => task.id))
  const checked: Record<ProseField, number> = { Dateien: 0, 'Tests zuerst': 0 }
  const problems: ProseProblem[] = []

  for (const entry of entries) {
    if (!finished.has(entry.task) || !countsAsPath(entry.written, entry.field, fs)) continue

    for (const path of expandBraces(entry.written)) {
      checked[entry.field] += 1
      const reason = reasonMissing(path, fs)
      const at = { task: entry.task, field: entry.field, path }
      if (entry.marker && reason === null) problems.push({ ...at, reason: 'gekennzeichnet, aber vorhanden' })
      if (!entry.marker && reason !== null) problems.push({ ...at, reason })
    }
  }
  return { checked, problems }
}
