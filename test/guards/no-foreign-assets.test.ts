import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
