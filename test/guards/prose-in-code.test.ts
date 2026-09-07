import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, fixture } from './scan'

/**
 * Anzeigbarer Text steht in der Sprachdatei, nicht im Quelltext (T-M21-01, R-UI-07).
 *
 * `text-keys.test.ts` nebenan prüft die eine Richtung: jeder Schlüssel, den der Code
 * abfragt, existiert auch. Die **Gegenrichtung** hat gefehlt — ein Satz, der gar keinen
 * Schlüssel hat, fällt einer Prüfung nach Schlüsseln nie auf. Genau so standen die fünf
 * Schritttexte der Einstiegshilfe von M12 bis zum 2026-09-07 als Zeichenketten in
 * `game/tutorial.ts`, während `de.ts` unter `tutorial` nur `title` und `dismiss` kannte.
 *
 * ## Was diese Regel kann — und was ausdrücklich nicht
 *
 * Sie sucht in einem **engen Bereich** (`game/tutorial.ts` und `ui/*.tsx`) nach
 * Zeichenketten-Literalen mit **vier oder mehr Wörtern**, wobei ein Wort eine durch
 * Leerzeichen getrennte Folge aus reinen Buchstaben ist. Das ist absichtlich stumpf und
 * absichtlich klein, denn eine Regel „Prosa im Quelltext" kann nicht sauber zwischen
 * einem Anzeigetext und einer Kennung unterscheiden. Was sie **nicht** fängt:
 *
 *  - **Text mit drei Wörtern oder weniger.** „Nicht mehr zeigen" hat genau drei und käme
 *    durch. Die Grenze ist gewählt, nicht gefunden: bei drei Wörtern melden Wortlisten
 *    und Schriftnamen mit, bei fünf rutscht ein halber Satz durch.
 *  - **Zusammengesetzte Texte.** Alles mit `${…}` ist ausgenommen — es ist eine
 *    Zusammensetzung, und die Teile darin stehen ohnehin einzeln unter derselben Regel.
 *  - **Text zwischen JSX-Marken**, `<p>Ein ganzer Satz hier</p>`, ist kein
 *    Zeichenketten-Literal und wird nicht gesehen.
 *  - **Alles außerhalb des Bereichs.** `game/actions.ts`, `storage/` und `map/` sind
 *    nicht bewacht; dort gibt es Anzeigetexte, die dieselbe Prüfung verdienten. Der
 *    Bereich ist eng gezogen, weil ein Wächter, der öfter falsch als richtig meldet, nach
 *    dem dritten Fehlalarm abgeschaltet wird — und dann ist die Lage schlechter als ohne.
 *
 * Ein Wächter, der vorgibt, mehr zu können, ist schlimmer als ein enger, der sagt, was er
 * kann. Was hier nicht steht, steht in `PROBLEME.md` unter dem 2026-09-07.
 */

/** Die bewachten Dateien: die Einstiegshilfe und alles, was Oberflaeche zeichnet. */
function bewachteDateien(): string[] {
  const out: string[] = [join(ROOT, 'apps/desktop/src/game/tutorial.ts')]
  const ui = join(ROOT, 'apps/desktop/src/ui')
  for (const entry of readdirSync(ui, { withFileTypes: true })) {
    if (entry.isDirectory()) continue
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue
    // Die Sprachdatei selbst ist der Ort, an den der Text gehoert.
    if (entry.name === 'tokens.ts') continue
    out.push(join(ui, entry.name))
  }
  return out
}

const OHNE_BLOCKKOMMENTAR = /\/\*[\s\S]*?\*\//g
const LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g
/** Ein Wort, wie Prosa es hat: reine Buchstaben, hoechstens ein Satzzeichen dahinter. */
const WORT = /^[A-Za-zÄÖÜäöüß]+[.,;:!?]?$/

export interface Fund {
  datei: string
  text: string
}

/**
 * Zeilenkommentare fallen weg, aber nur echte: `//` in einer URL — `https://…` — ist
 * keiner, und ein Wächter, der eine Adresse für einen Kommentar hält, sieht die halbe
 * Zeile nicht mehr.
 */
function ohneKommentare(quelltext: string): string[] {
  // Ein Blockkommentar wird durch ebenso viele Leerzeilen ersetzt statt geloescht, damit
  // die Zeilennummern erhalten bleiben und die Ausnahme unten dieselbe Zeile trifft.
  return quelltext
    .replace(OHNE_BLOCKKOMMENTAR, (block) => '\n'.repeat((block.match(/\n/g) ?? []).length))
    .split('\n')
    .map((zeile) => zeile.replace(/(^|[^:])\/\/.*$/, '$1'))
}

export function prosaIm(quelltext: string, datei = ''): Fund[] {
  const funde: Fund[] = []
  const roh = quelltext.split('\n')

  ohneKommentare(quelltext).forEach((zeile, nummer) => {
    // Dieselbe Notbremse wie in scan(): eine Zeile, die die Regel erklaert, verletzt sie
    // nicht. Gesucht wird im ROHEN Text — der Marker steht in einem Kommentar, und den
    // hat `ohneKommentare` gerade entfernt.
    if (/GUARD-ALLOW/.test(roh[nummer] ?? '')) return
    // Eine Meldung an die Entwicklerkonsole erreicht keinen Spieler und gehoert deshalb
    // nicht in die Sprachdatei — sie soll im Gegenteil dort stehen, wo sie geworfen wird.
    if (/\bconsole\.\w+\(/.test(zeile)) return

    for (const treffer of zeile.matchAll(LITERAL)) {
      const text = treffer[2]!
      if (text.includes('${')) continue
      const woerter = text.split(/\s+/).filter((wort) => WORT.test(wort))
      if (woerter.length >= 4) funde.push({ datei, text })
    }
  })
  return funde
}

describe('R-UI-07 Anzeigbarer Text steht nicht im Quelltext', () => {
  const funde = bewachteDateien().flatMap((datei) =>
    prosaIm(readFileSync(datei, 'utf8'), relative(ROOT, datei)),
  )

  it('findet in der Einstiegshilfe und der Oberflaeche keinen Satz', () => {
    const liste = funde.map((fund) => `${fund.datei}: "${fund.text.slice(0, 70)}"`)

    expect(
      liste,
      `Diese Texte gehoeren nach apps/desktop/src/i18n/de.ts (R-UI-07):\n${liste.join('\n')}`,
    ).toEqual([])
  })

  it('faellt gegen die Fassung, die es vor T-M21-01 gab', () => {
    // Der Nachweis, dass die Regel beisst. Ohne ihn ist ein gruener Waechter nur die
    // Aussage, dass er nichts sucht — die Lehre vom 2026-09-05, dass „fuer jedes X gilt
    // Y" wahr ist, wenn es kein X gibt.
    const alt = prosaIm(fixture('prose-in-code'))

    expect(alt.length, 'die alte Fassung faellt nicht — dann prueft die Regel nichts').toBe(5)
    expect(alt[0]?.text).toContain('Klicken Sie eine Ihrer Provinzen an')
  })

  it('haelt eine Kennung nicht fuer einen Satz', () => {
    // Der Fehlalarm, an dem die erste Fassung dieser Regel gescheitert ist:
    // 'tutorial.steps.select.title' hat vier durch Punkte getrennte Teile. Gezaehlt wird
    // deshalb nach Leerzeichen — eine Kennung hat keine.
    expect(prosaIm("t('tutorial.steps.select.title')")).toEqual([])
    expect(prosaIm("const key = 'explain.diplomacy.rightOfWay'")).toEqual([])
  })

  it('haelt einen SVG-Pfad und eine Schriftliste nicht fuer einen Satz', () => {
    // icons.tsx besteht fast nur aus Pfaden, und in ihnen steht kein Wort aus reinen
    // Buchstaben — deshalb sind sie ohne Ausnahmeliste draussen.
    expect(prosaIm("const d = 'M3 7h18v10H3z M3 7l18 10 M21 7L3 17'")).toEqual([])
    expect(prosaIm("const f = '\\'IBM Plex Sans\\', system-ui, sans-serif'")).toEqual([])
  })

  it('sieht einen echten Satz auch dann, wenn er in einer Eigenschaft steht', () => {
    const treffer = prosaIm("const step = { text: 'Klicken Sie eine Ihrer Provinzen an.' }")

    expect(treffer).toHaveLength(1)
  })

  it('haelt eine Meldung an die Entwicklerkonsole nicht fuer Anzeigetext', () => {
    // console.error erreicht keinen Spieler; sie gehoert dorthin, wo sie geworfen wird,
    // und nicht in die Sprachdatei.
    expect(prosaIm("console.error('WorldWar ist auf einen Fehler gelaufen:', e)")).toEqual([])
  })

  it('haelt eine Adresse nicht fuer einen Kommentar', () => {
    // `//` in https:// darf nicht den Rest der Zeile verschlucken.
    expect(prosaIm("const a = 'https://x' // und hier steht ein ganzer Satz")).toEqual([])
    expect(prosaIm("const a = 'https://x'; const b = 'Hier stehen vier echte Woerter'")).toHaveLength(1)
  })
})
