import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { de } from '../../apps/desktop/src/i18n/de'
import { hasKey } from '../../apps/desktop/src/i18n/text'
import { ROOT, productionFiles } from './scan'

/**
 * Jeder Schluessel, den der Code abfragt, existiert auch (R-UI-07, Playtest 2026-09-06).
 *
 * Der Katalogtest in apps/desktop/src/i18n/text.test.ts prueft die Vollstaendigkeit in
 * EINER Richtung: fuer jeden Kommandofehler, jede Ereignisart, jeden Rohstoff, jedes
 * Gebaeude gibt es einen deutschen Satz. Die Gegenrichtung prueft er nicht — und genau
 * dort lag der Fehler, den erst der Playtest fand: `t('province.cancelBuild')` fragte
 * einen Schluessel ab, den niemand angelegt hatte (er heisst `actions.cancelBuild`), und
 * auf dem Bildschirm stand unter "Im Bau" die Zeichenfolge `[province.cancelBuild]`.
 *
 * Bitter daran ist die zweite Haelfte: `t()` macht einen fehlenden Schluessel absichtlich
 * sichtbar statt still leer zu liefern, und dieses Verhalten hat einen eigenen gruenen
 * Test ("macht einen fehlenden Schluessel sichtbar"). Der Mechanismus, der den rohen
 * Schluessel vor den Spieler brachte, war also selbst geprueft — nur niemand prueft, ob
 * er je greifen muss. Eine Notbremse ersetzt die Pruefung nicht.
 */

/** Nur statische Aufrufe: t('a.b') und t("a.b"). Zusammengesetzte kann kein Test aufloesen. */
const STATISCH = /\bt\(\s*(['"])([\w.]+)\1/g
/** Zusammengesetzte: t(`buildings.${x}`) — zaehlbar, aber nicht aufloesbar. */
const DYNAMISCH = /\bt\(\s*`/g

function abgefragteSchluessel() {
  const treffer = new Map<string, string>()
  let dynamisch = 0

  for (const datei of productionFiles()) {
    if (!/\.tsx?$/.test(datei)) continue
    const text = readFileSync(datei, 'utf8')

    dynamisch += [...text.matchAll(DYNAMISCH)].length
    for (const fund of text.matchAll(STATISCH)) {
      const key = fund[2]!
      // Ein Schluessel ohne Punkt ist eine Variable oder ein Aufruf, kein Katalogpfad.
      if (!key.includes('.')) continue
      if (!treffer.has(key)) treffer.set(key, datei)
    }
  }
  return { treffer, dynamisch }
}

describe('R-UI-07 Jeder abgefragte Textschluessel existiert', () => {
  const { treffer, dynamisch } = abgefragteSchluessel()

  it('findet ueberhaupt Aufrufe — sonst prueft der Waechter das Nichts', () => {
    // Die Lehre vom 2026-09-05: "fuer jedes X gilt Y" ist wahr, wenn es kein X gibt.
    expect(treffer.size).toBeGreaterThan(50)
  })

  it('kennt jeden statisch abgefragten Schluessel', () => {
    const fehlend = [...treffer.entries()]
      .filter(([key]) => !hasKey(key))
      .map(([key, datei]) => `${key} (${datei})`)
    expect(fehlend, `abgefragt, aber nicht im Katalog:\n${fehlend.join('\n')}`).toEqual([])
  })

  it('sagt, wie viele Aufrufe es NICHT pruefen kann', () => {
    // Kein stiller Deckel: zusammengesetzte Schluessel wie t(`buildings.${x}`) bleiben
    // ungeprueft, und das gehoert benannt statt verschwiegen. Fuer sie sorgen die
    // Katalogtests in text.test.ts, die von den Regeldaten her pruefen.
    expect(dynamisch).toBeGreaterThan(0)
    expect(dynamisch).toBeLessThan(treffer.size)
  })

  it('faellt gegen einen Schluessel, den es nicht gibt', () => {
    // Damit die Pruefung nicht bedeutungslos wird, sobald die echten Pfade stimmen.
    expect(hasKey('province.cancelBuild')).toBe(false)
    expect(hasKey('actions.cancelBuild')).toBe(true)
  })
})

/**
 * Keine Umlaut-Ersatzschrift in Spielertexten (T-M23-01, R-UI-07, Befund V2-10).
 *
 * Die tasks.yaml-Regel "ohne Umlaute" ist in Spielertexte durchgesickert: Tooltips
 * sagten "haelt", "Staerke", "Haelfte". Die Regel hier ist eine WORT-Regel, keine
 * Zeichenregel: `ae`/`oe`/`ue` ist nur dann Ersatzschrift, wenn davor ein Konsonant
 * steht oder das Wort damit beginnt — "bauen", "Feuer", "Neue", "genauer" tragen den
 * Zwielaut zu Recht (Vokal davor) und bleiben unangetastet. Was trotzdem echt ist
 * ("zuerst" = zu + erst), steht auf einer MUSTERLISTE, nicht als Einzelfall im Test.
 */

/** Ersatzschrift: ae/oe/ue am Wortanfang oder nach einem Konsonanten. */
const ERSATZSCHRIFT = /(^|[^aeouäöüq])(ae|oe|ue)/i

/** Echte Vorkommen nach Konsonant — Fugen und Fremdwoerter, als Muster. */
const AUSNAHMEN: readonly RegExp[] = [
  /zuerst/i, // zu + erst
  /queue/i, // Fremdwort
  /(aktu|eventu|manu|individu|punktu)ell/i, // lateinisch -uell
  /statue/i, // Statu-e
]

/** Die Woerter eines Textes, die nach der Regel Ersatzschrift tragen. */
function ersatzWoerter(text: string): string[] {
  return text
    .split(/\s+/)
    .map((wort) => wort.replace(/[^A-Za-zÄÖÜäöüß]/g, ''))
    .filter((wort) => ERSATZSCHRIFT.test(wort) && !AUSNAHMEN.some((muster) => muster.test(wort)))
}

/** Alle Textwerte des Katalogs, mit Pfad — Kommentare der Datei zaehlen nicht. */
function katalogTexte(node: unknown = de, pfad = 'de'): { pfad: string; text: string }[] {
  if (typeof node === 'string') return [{ pfad, text: node }]
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node).flatMap(([key, value]) => katalogTexte(value, `${pfad}.${key}`))
}

/**
 * Die Zeichenketten-Literale einer Quelldatei, ohne Kommentare und ohne `${…}`-Teile.
 * Kommentare duerfen Ersatzschrift tragen (Bezeichner-Regel des Hauses); was in einem
 * Literal steht, kann den Spieler erreichen.
 */
function literaleIn(datei: string): string[] {
  const quelltext = readFileSync(datei, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((zeile) => zeile.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
  const literale: string[] = []
  for (const treffer of quelltext.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    literale.push(treffer[2]!.replace(/\$\{[^}]*\}/g, ' '))
  }
  return literale
}

describe('R-UI-07 Keine Umlaut-Ersatzschrift in Spielertexten', () => {
  it('prueft ueberhaupt Texte — sonst bewacht der Waechter das Nichts', () => {
    expect(katalogTexte().length).toBeGreaterThan(100)
    expect(literaleIn(join(ROOT, 'apps/desktop/src/game/actions.ts')).length).toBeGreaterThan(10)
  })

  it('findet in de.ts keine Ersatzschrift', () => {
    const funde = katalogTexte()
      .flatMap(({ pfad, text }) => ersatzWoerter(text).map((wort) => `${pfad}: ${wort}`))
    expect(funde, `Ersatzschrift in Spielertexten:\n${funde.join('\n')}`).toEqual([])
  })

  it('findet in den Prosa-Strings der actions.ts keine Ersatzschrift', () => {
    const funde = literaleIn(join(ROOT, 'apps/desktop/src/game/actions.ts')).flatMap((literal) =>
      ersatzWoerter(literal),
    )
    expect(funde, `Ersatzschrift in actions.ts:\n${funde.join('\n')}`).toEqual([])
  })

  it('findet in den Debug-Strings der KI keine Ersatzschrift (T-M28-04, D26.4)', () => {
    // Die Zieltexte der KI erreichen den Spieler ueber die Debug-Ansicht (V2-12) —
    // seit T-M28-04 mit Machtnamen statt Kennungen. Damit sind sie Spielertexte, und
    // fuer Spielertexte gilt die Wortregel: keine Ersatzschrift.
    const dir = join(ROOT, 'packages/ai/src')
    const dateien = readdirSync(dir).filter((datei) => datei.endsWith('.ts') && !datei.includes('.test.'))
    expect(dateien.length, 'keine KI-Quelldateien gefunden — der Waechter bewacht das Nichts').toBeGreaterThan(5)

    const funde = dateien.flatMap((datei) =>
      literaleIn(join(dir, datei)).flatMap((literal) =>
        ersatzWoerter(literal).map((wort) => `${datei}: ${wort}`),
      ),
    )
    expect(funde, `Ersatzschrift in KI-Debug-Strings:\n${funde.join('\n')}`).toEqual([])
  })

  it('faellt gegen die Tooltips, wie sie vor T-M23-01 standen', () => {
    // Der Nachweis, dass die Regel beisst — die drei Beispiele des Befunds V2-10.
    expect(ersatzWoerter('Die Armee haelt an, wo sie gerade steht.')).toEqual(['haelt'])
    expect(ersatzWoerter('Kostet 10 % der Staerke.')).toEqual(['Staerke'])
    expect(ersatzWoerter('Teilt die Haelfte ab — dafuer braucht es zwei.')).toEqual(['Haelfte', 'dafuer'])
    expect(ersatzWoerter('Uebersicht oeffnen')).toEqual(['Uebersicht', 'oeffnen'])
  })

  it('haelt echte Zwielaute und die Musterliste nicht fuer Ersatzschrift', () => {
    expect(ersatzWoerter('Neue Partie: bauen dauert, Feuer frei, genauer im Blauen.')).toEqual([])
    expect(ersatzWoerter('Erklären Sie zuerst den Krieg — aktuell steht die Queue.')).toEqual([])
  })
})
