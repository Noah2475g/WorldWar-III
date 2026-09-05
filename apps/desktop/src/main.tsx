import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { parseRules } from '@worldwar/core'
import type { MapData } from '@worldwar/core'
import { App } from './App.tsx'
import './ui/app.css'

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

const maps = [
  { id: 'world', name: 'Welt', provinces: (worldMap as unknown as MapData).provinces.length },
  { id: 'testworld', name: 'Kleine Welt', provinces: (testMap as unknown as MapData).provinces.length },
]

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      {/* Ohne diese Grenze ergibt jeder Renderfehler eine weisse Flaeche ohne Hinweis
          (T-M14-10, Befund N6). */}
      <ErrorBoundary>
        <App map={worldMap as unknown as MapData} rules={rules} maps={maps} />
      </ErrorBoundary>
    </StrictMode>,
  )
}
