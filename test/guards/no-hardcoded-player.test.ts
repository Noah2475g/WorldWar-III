import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, fixture } from './scan'

/**
 * Die Oberflaeche behauptet nirgends mehr, wer der Spieler ist (T-M37-02, R-MP-01/AK2, D28.3).
 *
 * Bis zum 2026-09-14 stand an neunzehn Stellen in `App.tsx` eine feste Spielerkennung — in
 * der Sicht, im Protokoll, in den Alarmen, bei den Farben, bei der Frage, welche Provinz
 * mir gehoert. Im Einzelspieler ist das richtig, im Spiel zu zweit saehe der Gast die Welt
 * seines Gegners. T-M37-01 hat sie durch einen Wert ersetzt; dieser Waechter haelt die
 * Stelle sauber, denn ein zurueckkehrendes Literal fiele sonst erst in einer Partie zu
 * zweit auf, und dort als Gespensterfehler: die Oberflaeche waere stimmig und falsch.
 *
 * ## Was der Waechter sucht — und was ausdruecklich nicht
 *
 * - **Bereich: die Oberflaeche.** `apps/desktop/src`, ohne Tests. `apps/headless/src/tournament.ts`
 *   vergleicht zwei Maechte gegeneinander und nennt sie beim Platz — das ist kein Bildschirm und
 *   keine Annahme ueber einen Menschen. Die Anforderung sagt woertlich „der Quelltext der
 *   Oberflaeche".
 * - **Kommentare zaehlen nicht.** Ueber Kennungen darf geschrieben werden; `state/types.ts`
 *   und `map/modes.ts` erklaeren sie sogar. Gesucht wird nur im Code.
 * - **Erzeugte Kennungen zaehlen nicht.** `colorForPlayer(\`p${index + 2}\`)` ist eine
 *   Rechnung ueber alle Maechte und keine Behauptung ueber eine bestimmte.
 * - **Eine Ausnahme ist eine Behauptung.** Jede Datei der Liste unten MUSS einen Treffer
 *   tragen; wer die Stelle umbaut und die Ausnahme stehen laesst, bekommt sie gemeldet.
 */

/** Eine feste Kennung als Zeichenkette: 'p1', "p2", `p3`. */
const FESTE_KENNUNG = /(['"`])p\d+\1/
/** Und der Zugriff ueber den Punkt: `fresh.players.p1`. */
const FESTER_ZUGRIFF = /\bplayers\.p\d+\b/

/**
 * Die dokumentierten Ausnahmen. Mehr als eine gibt es nicht, und diese eine ist die
 * Stelle, an der die Plaetze ueberhaupt erst vergeben werden.
 */
const AUSNAHMEN: readonly { datei: string; grund: string }[] = [
  {
    datei: 'apps/desktop/src/game/newGame.ts',
    grund:
      'Das Anlegen einer Partie vergibt die Plaetze: der Gastgeber bekommt den ersten, ' +
      'die Gegner die folgenden. Hier entsteht die Kennung, statt angenommen zu werden — ' +
      'R-MP-01/AK2 nimmt das Anlegen ausdruecklich aus.',
  },
]

/** Die Dateien der Oberflaeche; Tests gehoeren nicht dazu. */
function oberflaechenDateien(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full)
    }
  }
  walk(join(ROOT, 'apps', 'desktop', 'src'))
  return out
}

/**
 * Der Quelltext ohne Kommentare — Blockkommentare zeilenweise geleert, damit die
 * Zeilennummern der Meldung stimmen. Dasselbe Verfahren wie im Prosa-Waechter.
 */
export function ohneKommentare(quelltext: string): string[] {
  return quelltext
    .replace(/\/\*[\s\S]*?\*\//g, (block) => '\n'.repeat((block.match(/\n/g) ?? []).length))
    .split('\n')
    .map((zeile) => zeile.replace(/(^|[^:])\/\/.*$/, '$1'))
}

export interface Fund {
  datei: string
  zeile: number
  text: string
}

/** Feste Spielerkennungen in einem Quelltext, Kommentare ausgenommen. */
export function festeKennungenIn(quelltext: string, datei = ''): Fund[] {
  const funde: Fund[] = []
  ohneKommentare(quelltext).forEach((zeile, nummer) => {
    if (FESTE_KENNUNG.test(zeile) || FESTER_ZUGRIFF.test(zeile)) {
      funde.push({ datei, zeile: nummer + 1, text: zeile.trim() })
    }
  })
  return funde
}

const alleFunde = oberflaechenDateien().flatMap((datei) =>
  festeKennungenIn(readFileSync(datei, 'utf8'), relative(ROOT, datei).replaceAll('\\', '/')),
)

describe('R-MP-01/AK2 Kein fest verdrahteter Spieler in der Oberflaeche', () => {
  it('durchsucht ueberhaupt Dateien — sonst bewacht der Waechter das Nichts', () => {
    // Die Lehre vom 2026-09-05 und vom Koordinatenwaechter aus M33: „fuer jedes X gilt Y"
    // ist wahr, wenn es kein X gibt.
    expect(oberflaechenDateien().length).toBeGreaterThan(30)
  })

  it('findet ausserhalb des Anlegens einer Partie keine feste Kennung', () => {
    const verstoesse = alleFunde.filter((fund) => !AUSNAHMEN.some((a) => a.datei === fund.datei))
    const liste = verstoesse.map((f) => `${f.datei}:${f.zeile}  ${f.text}`)
    expect(
      liste,
      `Feste Spielerkennung in der Oberflaeche (R-MP-01/AK2):\n${liste.join('\n')}`,
    ).toEqual([])
  })

  it('jede Ausnahme traegt eine Begruendung und einen Treffer', () => {
    // Eine Ausnahme, die nichts mehr deckt, ist eine Luege in die andere Richtung — und
    // sie hielte die Stelle offen, an der das Literal zurueckkehren darf.
    for (const ausnahme of AUSNAHMEN) {
      expect(ausnahme.grund.length, `${ausnahme.datei} ohne Begruendung`).toBeGreaterThan(40)
      expect(
        alleFunde.some((fund) => fund.datei === ausnahme.datei),
        `${ausnahme.datei} steht auf der Ausnahmeliste, traegt aber keine feste Kennung mehr`,
      ).toBe(true)
    }
  })

  it('schlaegt bei der hinterlegten Verstoss-Fixture an', () => {
    // Ohne Gegenprobe ist ein Waechter leer gruen — siehe der Koordinatenwaechter aus M33,
    // der monatelang den Buchstaben `d` suchte und deshalb nie etwas fand.
    const funde = festeKennungenIn(fixture('player'), 'fixture')
    expect(funde.length, 'die alte Fassung faellt nicht — dann prueft die Regel nichts').toBeGreaterThanOrEqual(7)
    expect(funde.map((f) => f.text)).toContain(
      "const own = eventsFor(state.eventLog, 'p1')",
    )
  })

  it('haelt eine erzeugte Kennung, eine Provinz und einen Kommentar nicht fuer eine feste', () => {
    // Die drei Fehlalarme, an denen ein stumpferes Muster gescheitert waere.
    expect(festeKennungenIn('const farbe = colorForPlayer(`p${index + 2}`)')).toEqual([])
    expect(festeKennungenIn("const provinz = 'p22-nord'")).toEqual([])
    expect(festeKennungenIn("// Die Kennungen sind 'p1', 'p2', … und damit eine Nummerierung")).toEqual([])
    expect(festeKennungenIn('/**\n * Der Gast ist `p2`.\n */\nconst x = 1')).toEqual([])
  })
})
