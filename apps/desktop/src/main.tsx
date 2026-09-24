import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { applyInputMode } from './ui/inputMode.ts'
import { parseRules } from '@worldwar/core'
import type { MapData } from '@worldwar/core'
import { App } from './App.tsx'
import { parseNetLink, type NetLink } from './net/link.ts'
import type { Transport } from '@worldwar/netplay'
import './ui/app.css'
import './ui/touch.css'

import worldMap from '../../../data/maps/world.json' with { type: 'json' }
import testMap from '../../../data/maps/testworld.json' with { type: 'json' }
import aiRaw from '../../../data/rules/default/ai.json' with { type: 'json' }
import buildingsRaw from '../../../data/rules/default/buildings.json' with { type: 'json' }
import constantsRaw from '../../../data/rules/default/constants.json' with { type: 'json' }
import resourcesRaw from '../../../data/rules/default/resources.json' with { type: 'json' }
import unitsRaw from '../../../data/rules/default/units.json' with { type: 'json' }

/**
 * The entry point (T-M10-11, T-M11-03).
 *
 * Map and rules are imported rather than fetched: the game runs offline, without a
 * server and without a network permission (R-FREE-04), so everything it needs is part
 * of the bundle.
 */

const rules = parseRules(
  {
    constants: constantsRaw,
    resources: resourcesRaw,
    buildings: buildingsRaw,
    units: unitsRaw,
    ai: aiRaw,
  } as never,
  'default',
)

/**
 * Die Karten zur Wahl — mit ihren Daten, nicht nur mit ihren Namen (T-M12-08).
 *
 * Vorher stand hier die blosse Provinzzahl fuer die Beschriftung, und die Karte selbst
 * wurde weggeworfen: die App bekam immer die Welt. Die Wahl war damit ein Blindschalter,
 * der nicht auffallen konnte, weil er richtig aussah.
 */
const maps = [
  { id: 'world', name: 'Welt', data: worldMap as unknown as MapData },
  { id: 'testworld', name: 'Kleine Welt', data: testMap as unknown as MapData },
]

// Finger oder Zeiger steht an <html>, bevor das erste Bild entsteht (data-input, touch.css).
applyInputMode()

/**
 * Der Einstieg in eine Partie zu zweit (T-M39-02, T-M39-04, R-MP-09/AK3, D28.9).
 *
 * Zwei Dinge stehen hier, und beide sind Absicht:
 *
 * **Der Link wird gelesen, bevor irgendetwas gezeichnet wird.** `parseNetLink` ist rein
 * und kennt keine Leitung; steht im Fragment keine Einladung, gibt es `null` zurück, und
 * das Spiel startet im Einzelspieler wie immer.
 *
 * **Die Leitung kommt über einen dynamischen Import hinter der Bauflagge.** `__MULTIPLAYER__`
 * ist im gewöhnlichen Bau ein literales `false`; Rollup schneidet diesen Zweig samt des
 * `import()` heraus, und im ausgelieferten Tauri-Bündel steht kein `WebSocket` — gemessen
 * am Erzeugnis (T-M38-05, `docs/reports/packaging-netfree.json`), nicht behauptet.
 * `pnpm mp:host` setzt die Flagge und baut dasselbe Bündel **mit** Einstieg; das ist der
 * Bau, den der Hostdienst ausliefert und den beide Seiten der Partie bekommen
 * (R-MP-11/AK2).
 *
 * Die Zusage, die unabhängig davon trägt, bleibt `connect-src 'none'` im kompilierten
 * Programm: sie verbietet die Verbindung, **gleich wer sie versucht**.
 */
const root = document.getElementById('root')
const link = parseNetLink(globalThis.location?.hash ?? '')

function zeichnen(party?: { link: NetLink; connect: (url: string) => Transport }): void {
  if (!root) return
  createRoot(root).render(
    <StrictMode>
      {/* Ohne diese Grenze ergibt jeder Renderfehler eine weisse Flaeche ohne Hinweis
          (T-M14-10, Befund N6). */}
      <ErrorBoundary>
        <App
          map={worldMap as unknown as MapData}
          rules={rules}
          maps={maps}
          {...(party ? { party } : {})}
        />
      </ErrorBoundary>
    </StrictMode>,
  )
}

if (__MULTIPLAYER__ && link) {
  // Erst laden, dann zeichnen — sonst gaebe es zwei Bilder hintereinander, und das erste
  // waere ein leerer Anlegedialog vor dem Beitrittsbildschirm.
  void import('./net/websocketTransport.ts')
    .then(({ createWebSocketTransport }) => {
      zeichnen({ link, connect: (url) => createWebSocketTransport({ url }) })
    })
    .catch(() => {
      // Ein Buendel ohne Mehrspielerteil ist kein Fehler, sondern der Regelfall des
      // ausgelieferten Programms: dann laeuft das Spiel im Einzelspieler weiter.
      zeichnen()
    })
} else {
  zeichnen()
}
