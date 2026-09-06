import { de, type Catalog } from './de.ts'

/**
 * Looking up a text (T-M11-04, R-UI-07).
 *
 * A missing key must be loud. A lookup that silently returns an empty string produces
 * a button with no label and a screen nobody can report a bug about — so an unknown
 * key comes back as the key itself, in brackets, and a test refuses to let one exist.
 */

export type TextKey = string

/** Values a placeholder can take. Numbers are formatted German-style on the way in. */
export type Placeholders = Record<string, string | number>

const catalog: Catalog = de

function resolve(key: TextKey): string | undefined {
  let node: unknown = catalog
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

/** Formats a number the way German readers expect: 1.234.567. */
export function num(value: number): string {
  return value.toLocaleString('de-DE')
}

/**
 * The text for a key, with placeholders filled in.
 *
 * `{{name}}` is replaced by the matching value; a placeholder with no value stays
 * visible rather than vanishing, because a sentence with a hole in it is a bug report
 * and a sentence missing a word is a mystery.
 */
export function t(key: TextKey, values: Placeholders = {}): string {
  const template = resolve(key)
  if (template === undefined) return `[${key}]`

  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = values[name]
    if (value === undefined) return whole
    return typeof value === 'number' ? num(value) : value
  })
}

/**
 * Einzahl oder Mehrzahl, je nach Anzahl (T-M12-10).
 *
 * Der Abschlussdialog schrieb "1 Provinzen" und "1 Punkte". Das gab es im Haus schon
 * einmal — `duration` verzweigt seit M10 von Hand zwischen "1 Tag" und "1,5 Tage" —,
 * und eine zweite handgeschriebene Verzweigung waere die zweite Stelle, an der dieselbe
 * Frage anders beantwortet wird. Deutsch braucht nur die eine Grenze bei eins; mehr
 * Regeln waeren hier erfunden und nicht gebraucht.
 */
export function plural(count: number, one: TextKey, many: TextKey, values: Placeholders = {}): string {
  return t(count === 1 ? one : many, { ...values, count })
}

/** Every key in the catalog, flattened — used by the test that keeps it complete. */
export function allKeys(node: unknown = catalog, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix]
  if (typeof node !== 'object' || node === null) return []

  return Object.entries(node).flatMap(([key, value]) =>
    allKeys(value, prefix ? `${prefix}.${key}` : key),
  )
}

/** Does a key exist? For the guards, not for the interface. */
export function hasKey(key: TextKey): boolean {
  return resolve(key) !== undefined
}

/** The placeholders a text expects, so a caller can be checked against it. */
export function placeholdersOf(key: TextKey): string[] {
  const template = resolve(key)
  if (template === undefined) return []
  return [...template.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]!)
}
