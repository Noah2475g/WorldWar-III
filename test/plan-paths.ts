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
