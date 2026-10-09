import type { ReactNode, RefObject, MouseEvent } from 'react'
import { t } from '../i18n/text.ts'
import { MAP_MODES, MAP_MODE_NAMES, type MapMode } from '../map/modes.ts'
import type { ZoomTier } from '../map/picking.ts'

/**
 * Die Werkzeug-Spalte oben rechts auf der Karte (Seitenleiste v3b E3, D8).
 *
 * Eine Spalte, 148 px breit: Zoom + / − / ⌂ (Hauptstadt), darunter die drei Zoomstufen
 * Welt / Region / Nah als Knoepfe, der Kartenmodus (E2, D22), die Uebersichtskarte und die
 * Legende. Die Spalte rechnet nichts: Zoom, Stufe und Uebersicht kommen als Rueckrufe aus
 * `MapCanvas`, das die Groesse der Karte kennt. Bei offener Seitenleiste rutscht sie per
 * CSS mit (`.app[data-side-open='true'] .map-tools-col`).
 */
export const ZOOM_TIER_SCALE: Readonly<Record<ZoomTier, number>> = { far: 2.5, mid: 1.6, near: 0.97 }

const TIERS: readonly { tier: ZoomTier; label: () => string }[] = [
  { tier: 'far', label: () => t('map.tierFar') },
  { tier: 'mid', label: () => t('map.tierMid') },
  { tier: 'near', label: () => t('map.tierNear') },
]

export interface MapToolsProps {
  tier: ZoomTier
  mode: MapMode
  capitalDisabled: boolean
  /** Vollbild-Knopf (nur Touch); null = nicht anzeigen. */
  fullscreen: { active: boolean; onToggle: () => void } | null
  onZoomIn: () => void
  onZoomOut: () => void
  onHome: () => void
  onTier: (tier: ZoomTier) => void
  onMode: (mode: MapMode) => void
  overviewRef: RefObject<HTMLCanvasElement | null>
  overviewSize: { width: number; height: number }
  onOverviewClick: (event: MouseEvent<HTMLCanvasElement>) => void
  /** Die Legende (zwei Eintraege), unten in der Spalte. */
  legend?: ReactNode
}

export function MapTools(props: MapToolsProps) {
  return (
    <div className="map-tools-col" role="group" aria-label={t('map.tools')}>
      <div className="map-controls" role="group" aria-label={t('map.zoomIn')}>
        <button type="button" className="map-control" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} onClick={props.onZoomIn}>
          +
        </button>
        <button type="button" className="map-control" aria-label={t('map.zoomOut')} title={t('map.zoomOut')} onClick={props.onZoomOut}>
          −
        </button>
        <button
          type="button"
          className="map-control"
          aria-label={t('map.centreCapital')}
          title={t('map.centreCapital')}
          onClick={props.onHome}
          disabled={props.capitalDisabled}
        >
          ⌂
        </button>
        {props.fullscreen && (
          <button
            type="button"
            className="map-control"
            aria-label={props.fullscreen.active ? t('map.fullscreenExit') : t('map.fullscreenEnter')}
            title={props.fullscreen.active ? t('map.fullscreenExit') : t('map.fullscreenEnter')}
            onClick={props.fullscreen.onToggle}
          >
            ⛶
          </button>
        )}
      </div>

      <div className="map-tiers" role="group" aria-label={t('map.tiers')}>
        {TIERS.map(({ tier, label }) => (
          <button
            key={tier}
            type="button"
            className={props.tier === tier ? 'map-tier map-tier--active' : 'map-tier'}
            data-tier={tier}
            aria-pressed={props.tier === tier}
            onClick={() => props.onTier(tier)}
          >
            {label()}
          </button>
        ))}
      </div>

      {/* Kartenmodus (D22): Button-Gruppe + Select (< 1400 px). Taste M bleibt cycleMode. */}
      <div className="map-tools">
        <div className="modes" role="group" aria-label={t('mapModes.title')}>
          {MAP_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={props.mode === mode ? 'mode mode--active' : 'mode'}
              aria-pressed={props.mode === mode}
              onClick={() => props.onMode(mode)}
            >
              {MAP_MODE_NAMES[mode]}
            </button>
          ))}
        </div>
        <select
          className="modes-select"
          aria-label={t('mapModes.title')}
          value={props.mode}
          onChange={(event) => props.onMode(event.target.value as MapMode)}
        >
          {MAP_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {MAP_MODE_NAMES[mode]}
            </option>
          ))}
        </select>
      </div>

      <canvas
        ref={props.overviewRef}
        width={props.overviewSize.width}
        height={props.overviewSize.height}
        className="map-overview"
        role="button"
        tabIndex={0}
        aria-label={t('map.overview')}
        title={t('map.overview')}
        onClick={props.onOverviewClick}
      />

      {props.legend}
    </div>
  )
}
