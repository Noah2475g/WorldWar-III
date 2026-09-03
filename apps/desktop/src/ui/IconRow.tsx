import { Icon, type IconName } from './icons.tsx'

/**
 * A row of things, as symbols with their counts (T-M13-01, R-UI-10).
 *
 * This replaces the sentences the panels used to build — "5 Nahrung, 2 Kohle, 1 Eisen",
 * "3 × Infanterie, 1 × Artillerie". A row of symbols is read in one glance where a
 * sentence is read word by word.
 *
 * The one rule that keeps it honest: every symbol carries its own text. The icon gets a
 * title, so a screen reader announces "5 Nahrung" and not an empty box, and the count
 * stands next to it as a figure rather than being encoded in the picture. Graphical was
 * never supposed to mean wordless.
 */

export interface IconItem {
  icon: IconName
  label: string
  /** How many. Absent means one, and several entries of the same kind are added up. */
  count?: number
}

export interface CondensedItem extends IconItem {
  count: number
}

/**
 * Adds up repeated entries, keeping the order of first appearance.
 *
 * Two ways of counting meet here and both are needed: an army arrives as one entry per
 * stack with its own number, deposits arrive as one entry per resource with an amount,
 * and a list of individual units arrives as repetitions. Summing covers all three.
 */
export function condense(items: readonly IconItem[]): CondensedItem[] {
  const out: CondensedItem[] = []
  for (const item of items) {
    const seen = out.find((entry) => entry.icon === item.icon && entry.label === item.label)
    if (seen) seen.count += item.count ?? 1
    else out.push({ ...item, count: item.count ?? 1 })
  }
  return out
}

export interface IconRowProps {
  items: readonly IconItem[]
  /** Beyond this many kinds the row says "+n" instead of growing. */
  max?: number
  /** Pixel size of one symbol; the row scales with the font setting otherwise. */
  size?: number
}

export function IconRow({ items, max = 8, size = 14 }: IconRowProps) {
  const all = condense(items)
  if (all.length === 0) return null

  const shown = all.slice(0, max)
  // What is left over is named as a number. Silently dropping entries would turn a
  // shortened row into a wrong one.
  const hidden = all.length - shown.length

  return (
    <ul className="icon-row">
      {shown.map((item) => (
        <li key={`${item.icon}-${item.label}`} className="icon-row__item">
          <Icon name={item.icon} size={size} title={item.count > 1 ? `${item.count} ${item.label}` : item.label} />
          {item.count > 1 && <span className="icon-row__count">{item.count}</span>}
        </li>
      ))}
      {hidden > 0 && (
        <li className="icon-row__item icon-row__more" title={`${hidden} weitere`}>
          <span className="icon-row__count">+{hidden}</span>
        </li>
      )}
    </ul>
  )
}
