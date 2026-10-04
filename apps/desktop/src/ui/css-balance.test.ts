import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Ein Merge verlor die schliessende Klammer von `.explain__text--end`: vite lieferte app.css mit 500, die Seite blieb leer. */
describe('Stylesheets sind klammerbalanciert', () => {
  for (const name of ['app.css', 'touch.css', 'bild.css', 'symbol.css']) {
    it(`${name}: gleich viele { wie }`, () => {
      const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/${name}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(css.split('{').length).toBe(css.split('}').length)
    })
  }
})
