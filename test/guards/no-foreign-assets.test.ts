import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GEO_SOURCES } from '@worldwar/mapgen'
import { TYPE } from '../../apps/desktop/src/ui/tokens.ts'
import { ROOT, scan } from './scan.ts'

/**
 * No foreign assets (R-ASSET-01, R-ASSET-02).
 *
 * The claim in `docs/ASSETS.md` is that this game ships nothing it did not make or
 * receive under a free licence — no graphic, sound, text or datum from the original.
 * A claim in a document ages badly, so it is checked here instead:
 *
 *  - every asset file in the repository is named in ASSETS.md,
 *  - every third-party source the code actually uses is named there too, and
 *  - the two things the document says about icons and sounds — drawn as inline SVG,
 *    synthesised rather than recorded — are still true of the files.
 */

const assets = readFileSync(join(ROOT, 'docs', 'ASSETS.md'), 'utf8')

const ASSET_FILE = /\.(png|jpe?g|gif|webp|ico|bmp|svg|mp3|wav|ogg|flac|m4a|ttf|otf|woff2?|eot)$/i

/** Everything git tracks — the only definition of "shipped" that cannot drift. */
function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
}

const FONT_DIR = 'apps/desktop/src/ui/fonts/'
const appCss = readFileSync(join(ROOT, 'apps/desktop/src/ui/app.css'), 'utf8')
const indexHtml = readFileSync(join(ROOT, 'apps/desktop/index.html'), 'utf8')

/** The families the interface asks for, read out of TYPE — never out of a second list. */
function requiredFamilies(): string[] {
  const families = [TYPE.map, TYPE.ui, TYPE.num]
    .flatMap((stack) => stack.split(','))
    .map((entry) => entry.trim().replace(/^"|"$/g, ''))
    .filter((entry) => entry.startsWith('IBM Plex'))
  return [...new Set(families)]
}

/** Every `@font-face` of a stylesheet as family plus the paths its `src` points at. */
function fontFaces(css: string): { family: string; urls: string[] }[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((block) => {
    const body = block[1]!
    const family = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(body)?.[1]?.trim() ?? ''
    const urls = [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((match) => match[1]!.trim())
    return { family, urls }
  })
}

/**
 * The check itself, over a file list handed in rather than read from git.
 *
 * That signature is the whole point. The assertion below runs it a second time against
 * an *empty* list and requires it to complain. Three guards in this file were green for
 * months because they measured a set that did not exist — a guard over an empty set is
 * always green, and the only cure is to prove that it can go red.
 */
function familiesWithoutEmbeddedFile(tracked: string[], css: string): string[] {
  const embedded = new Set(tracked.filter((file) => file.startsWith(FONT_DIR) && file.endsWith('.woff2')))
  const faces = fontFaces(css)

  return requiredFamilies().filter((family) => {
    const face = faces.find((entry) => entry.family === family)
    if (!face) return true
    // A url() is relative to the stylesheet; a tracked path is relative to the repository.
    return !face.urls.some((url) => embedded.has(join('apps/desktop/src/ui', url).replaceAll('\\', '/')))
  })
}

describe('R-ASSET-01 Kein Asset ohne Herkunfts- und Lizenzeintrag', () => {
  it('nennt jede eingecheckte Bild-, Ton- und Schriftdatei in ASSETS.md', () => {
    const files = trackedFiles().filter((file) => ASSET_FILE.test(file))
    const undocumented = files.filter((file) => !assets.includes(file.split('/').pop()!))

    expect(undocumented, 'Assets ohne Eintrag in docs/ASSETS.md').toEqual([])
  })

  it('nennt jede Fremdquelle, die der Code tatsaechlich benutzt', () => {
    // Geodaten: das Quellenregister im Code ist die Wahrheit, ASSETS.md muss ihm folgen.
    for (const source of GEO_SOURCES) {
      expect(assets, `Geodatenquelle "${source.name}" fehlt in ASSETS.md`).toContain(source.name)
      expect(assets, `Bezugsadresse von "${source.name}" fehlt in ASSETS.md`).toContain(source.url)
      expect(assets, `Lizenz von "${source.name}" fehlt in ASSETS.md`).toMatch(/gemeinfrei|Public Domain/i)
    }

    // Schrift: jede Familie, die die Oberflaeche verlangt, braucht einen Lizenzeintrag.
    const families = [TYPE.map, TYPE.ui, TYPE.num]
      .flatMap((stack) => stack.split(','))
      .map((entry) => entry.trim().replace(/^"|"$/g, ''))
      .filter((entry) => entry.startsWith('IBM Plex'))

    expect(families.length).toBeGreaterThan(0)
    for (const family of new Set(families)) {
      expect(assets, `Schrift "${family}" fehlt in ASSETS.md`).toContain(family)
    }
    expect(assets).toMatch(/Open Font License/)
  })

  it('laedt in der Anwendung kein Asset von aussen nach', () => {
    // Kein <img src>, kein CSS url(), kein new Audio(): was nicht im Programm steht,
    // muesste zur Laufzeit geholt werden — und das ginge nur uebers Netz (R-FREE-04).
    expect(scan(/new\s+Audio\s*\(|<img\s|url\(\s*['"]?https?:/)).toEqual([])
  })

  it('haelt fest, was ueber Icons und Klaenge behauptet wird', () => {
    const icons = readFileSync(join(ROOT, 'apps/desktop/src/ui/icons.tsx'), 'utf8')
    const sound = readFileSync(join(ROOT, 'apps/desktop/src/ui/sound.ts'), 'utf8')

    // Icons: selbst gezeichnetes Inline-SVG, keine Datei, kein Zeichensatz-Symbol.
    expect(icons).toMatch(/<svg/)
    expect(icons).not.toMatch(ASSET_FILE)

    // Klaenge: erzeugt, nicht aufgenommen.
    expect(sound).toMatch(/createOscillator/)
    expect(sound).not.toMatch(ASSET_FILE)
  })

  it('uebernimmt nichts aus den Vorbildern', () => {
    // Regeln sind nicht geschuetzt, ihre Darstellung schon: im Produktcode darf kein
    // Vorbild als Quelle von Inhalten auftauchen.
    expect(scan(/supremacy|bytro|conflict of nations/i)).toEqual([])
  })
})

describe('R-UI-04/AK2 Die Schrift liegt bei, statt vorausgesetzt zu werden', () => {
  it('checkt mindestens vier woff2-Dateien unter apps/desktop/src/ui/fonts ein', () => {
    const fonts = trackedFiles().filter((file) => file.startsWith(FONT_DIR) && file.endsWith('.woff2'))

    expect(fonts.length, `Eingecheckte Schriftdateien unter ${FONT_DIR}`).toBeGreaterThanOrEqual(4)

    // Und sie duerfen das Repository nicht zumuellen: vier Schnitte, zusammen unter 400 KB.
    const bytes = fonts.reduce((sum, file) => sum + statSync(join(ROOT, file)).size, 0)
    expect(bytes, 'Gesamtgewicht der Schriftdateien in Byte').toBeLessThan(400 * 1024)
  })

  it('bindet jede von TYPE verlangte IBM-Plex-Familie an eine eingecheckte Datei', () => {
    expect(requiredFamilies().length).toBeGreaterThan(0)
    expect(
      familiesWithoutEmbeddedFile(trackedFiles(), appCss),
      'Familien ohne @font-face auf eine eingecheckte Datei',
    ).toEqual([])
  })

  it('faellt gegen eine leere Asset-Menge — die Zusicherung prueft nicht das Nichts', () => {
    // Die kuenstliche Waise wie in ui-reachability: derselbe Aufruf, leere Dateiliste.
    expect(familiesWithoutEmbeddedFile([], appCss)).toEqual(requiredFamilies())
    // Und derselbe Aufruf gegen ein Stylesheet ohne @font-face.
    expect(familiesWithoutEmbeddedFile(trackedFiles(), ':root { --font-ui: sans-serif; }')).toEqual(requiredFamilies())
  })
})

describe('R-FREE-04/AK2 Keine Schriftquelle zeigt nach aussen', () => {
  it('haelt jede url() eines @font-face lokal', () => {
    expect(fontFaces(appCss).length, 'app.css hat kein einziges @font-face').toBeGreaterThan(0)
    for (const face of fontFaces(appCss)) {
      for (const url of face.urls) {
        expect(url, `Schriftquelle von "${face.family}" zeigt nach aussen`).not.toMatch(/^https?:/)
      }
    }
  })

  it('laedt auch die Huelle keine Schrift nach', () => {
    expect(indexHtml, 'index.html laedt eine Schrift von aussen').not.toMatch(/<link[^>]*\bfonts?\b/i)
    expect(indexHtml).not.toMatch(/https?:/)
  })
})
