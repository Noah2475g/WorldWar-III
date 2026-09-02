#!/usr/bin/env node
/**
 * Placeholder for scripts whose implementation is scheduled for a later task.
 *
 * The script name must exist from day one (D15 lists the full set), but calling it
 * before its task is done should say so plainly instead of failing cryptically.
 */
const [, , name = '<unknown>', task = '<unknown task>'] = process.argv

console.error(
  [
    ``,
    `  "${name}" ist noch nicht implementiert.`,
    `  Zustaendige Aufgabe: ${task}  (siehe docs/plan/03-TASKS.md)`,
    ``,
  ].join('\n'),
)
process.exit(1)
