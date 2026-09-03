/**
 * A CSV reader for the map tables (T-M9-00).
 *
 * Small on purpose. The tables it reads are ours: written by `curate-provinces.mjs`
 * or by hand, always with a header row, always UTF-8. What it does need to handle is
 * quoting, because province names carry commas and the day one does, a naive split
 * would shift every following column by one without complaining.
 */

export type CsvRow = Record<string, string>

export function readCsv(text: string): CsvRow[] {
  const rows = parse(text)
  const header = rows.shift()
  if (!header) return []

  return rows
    .filter((cells) => cells.some((cell) => cell !== ''))
    .map((cells) => {
      const row: CsvRow = {}
      header.forEach((name, index) => {
        row[name] = cells[index] ?? ''
      })
      return row
    })
}

function parse(text: string): string[][] {
  const rows: string[][] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') quoted = true
    else if (char === ',') {
      cells.push(cell)
      cell = ''
    } else if (char === '\n') {
      cells.push(cell.replace(/\r$/, ''))
      rows.push(cells)
      cells = []
      cell = ''
    } else cell += char
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell.replace(/\r$/, ''))
    rows.push(cells)
  }
  return rows
}
