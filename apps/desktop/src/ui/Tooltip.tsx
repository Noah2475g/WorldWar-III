import { useLayoutEffect, useRef, useState } from 'react'
import type { PublicView, Terrain } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { Icon, TERRAIN_ICONS } from './icons.tsx'
import { amount, percent, unfix } from './format.ts'
import { TERRAIN_DEFENCE_PERMILLE } from './Panels.tsx'
import { useInputMode } from './inputMode.ts'

/**
 * Die Provinz erklaert sich beim Zeigen (T-M31-01, D27.6, R-UI-11/R-UI-12/R-UI-15).
 *
 * Das Vorbild erklaert jede Provinz, sobald der Zeiger darauf liegt; wir taten es nur im
 * Panel. Der Tooltip hier folgt der Maus UND der Tastaturauswahl — wer ohne Maus
 * spielt, bekommt dieselbe Auskunft am selben Ort. Der Inhalt kommt aus der Sicht
 * (`PublicView`), nie aus dem Zustand: was der Spieler nicht sehen darf, steht auch
 * hier nicht (R-DIP-04). `tooltipFor` ist rein und ohne Leinwand testbar; die
 * Komponente setzt nur noch Zeilen.
 */

export interface TooltipData {
  provinceId: string
  name: string
  /** Der Besitzer als Machtname, oder null fuer herrenlos. */
  owner: string | null
  terrain: Terrain
  /** Prozent, nur fuer eigene Provinzen bekannt. */
  moralePercent: number | null
  /** Sichtbare Armeen hier: Anzahl und Gesamtstaerke. */
  armies: { count: number; strength: number }
  /** Laufendes Gefecht: die Runde (Spieltage seit Beginn, ab 1). */
  battleRound: number | null
  /** Veraltete Sicht: Stand von Tag n. */
  staleDay: number | null
}

export interface TooltipSources {
  nameOf: (provinceId: string) => string
  playerName: (playerId: string) => string
  ticksPerDay: number
}

/** Baut die Auskunft aus der Sicht — null, wenn die Sicht die Provinz nicht kennt. */
export function tooltipFor(provinceId: string | null, view: PublicView | null, sources: TooltipSources): TooltipData | null {
  if (!provinceId || !view) return null
  const province = view.provinces.find((p) => p.id === provinceId)
  if (!province) return null

  const here = view.armies.filter((army) => army.provinceId === provinceId)
  const battle = view.battles?.find((b) => b.provinceId === provinceId)
  const perDay = Math.max(1, sources.ticksPerDay)

  return {
    provinceId,
    name: sources.nameOf(provinceId),
    owner: province.owner ? sources.playerName(province.owner) : null,
    terrain: province.terrain,
    moralePercent: province.morale === undefined ? null : Math.round(unfix(province.morale)),
    armies: { count: here.length, strength: here.reduce((sum, army) => sum + army.strength, 0) },
    battleRound: battle ? Math.floor((view.tick - battle.startedTick) / perDay) + 1 : null,
    staleDay: province.stale ? Math.floor(province.asOfTick / perDay) + 1 : null,
  }
}

export interface TooltipProps {
  data: TooltipData
  /** Bildschirmposition der Ankerstelle (Zeiger oder Provinzmitte), relativ zur Karte. */
  x: number
  y: number
}

/** Abstand des Kastens vom Anker, damit der Zeiger ihn nicht verdeckt. */
const OFFSET = 14

export interface Size {
  width: number
  height: number
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/**
 * Wo der Kasten steht (Android-Emulator, 2026-09-24): neben dem Anker, aber auf der Karte.
 *
 * Bevorzugt rechts unten vom Zeiger — oder, fuer den Finger, rechts DARUEBER, weil die
 * Hand verdeckt, was unter ihr liegt. Stoesst er an einen Rand, klappt er auf die andere
 * Seite des Ankers; passt er auf keiner, haelt ihn die Kante fest. Ohne bekannte Masse
 * (erstes Bild, jsdom) bleibt es beim Versatz von bisher.
 */
export function placeTooltip(
  anchor: { x: number; y: number },
  box: Size,
  area: Size,
  prefer: 'below' | 'above' = 'below',
): { left: number; top: number } {
  let left = anchor.x + OFFSET
  let top = prefer === 'above' ? anchor.y - OFFSET - box.height : anchor.y + OFFSET

  if (area.width > 0) {
    if (left + box.width > area.width) left = anchor.x - OFFSET - box.width
    left = clamp(left, 0, Math.max(0, area.width - box.width))
  }
  if (area.height > 0) {
    if (prefer === 'below' && top + box.height > area.height) top = anchor.y - OFFSET - box.height
    if (prefer === 'above' && top < 0) top = anchor.y + OFFSET
    top = clamp(top, 0, Math.max(0, area.height - box.height))
  }
  return { left, top }
}

interface Measure {
  box: Size
  area: Size
}

const sameMeasure = (a: Measure, b: Measure): boolean =>
  a.box.width === b.box.width &&
  a.box.height === b.box.height &&
  a.area.width === b.area.width &&
  a.area.height === b.area.height

export function Tooltip({ data, x, y }: TooltipProps) {
  const defence = TERRAIN_DEFENCE_PERMILLE[data.terrain]
  const touch = useInputMode() === 'touch'
  const ref = useRef<HTMLDivElement>(null)
  const [measure, setMeasure] = useState<Measure | null>(null)

  // Nach jedem Bild messen, vor dem Zeichnen: Kasten und Karte (das Elternelement, die
  // `.map-area`). Gleiche Masse aendern nichts — sonst zeichnete jedes Messen neu.
  useLayoutEffect(() => {
    const element = ref.current
    const area = element?.parentElement
    if (!element || !area) return
    const next = {
      box: { width: element.offsetWidth, height: element.offsetHeight },
      area: { width: area.clientWidth, height: area.clientHeight },
    }
    setMeasure((previous) => (previous && sameMeasure(previous, next) ? previous : next))
  })

  const none = { width: 0, height: 0 }
  const at = placeTooltip({ x, y }, measure?.box ?? none, measure?.area ?? none, touch ? 'above' : 'below')

  return (
    <div ref={ref} className="tooltip" role="tooltip" id={`tooltip-${data.provinceId}`} style={{ left: at.left, top: at.top }}>
      <p className="tooltip__head">
        <b>{data.name}</b>
        <span className="tooltip__owner">{data.owner ?? t('province.neutral')}</span>
      </p>
      <dl className="tooltip__facts">
        {data.moralePercent !== null && (
          <>
            <dt>{t('province.morale')}</dt>
            <dd>{percent(data.moralePercent)}</dd>
          </>
        )}
        <dt>
          <Icon name={TERRAIN_ICONS[data.terrain]} size={11} /> {t(`terrain.${data.terrain}`)}
        </dt>
        <dd>{defence > 0 ? t('province.defenceBonus', { percent: defence / 10 }) : '—'}</dd>
        <dt>{t('tooltip.armies')}</dt>
        <dd>
          {data.armies.count === 0
            ? t('tooltip.armiesNone')
            : data.armies.count === 1
              ? t('tooltip.armyHere', { strength: amount(data.armies.strength) })
              : t('tooltip.armiesHere', { count: data.armies.count, strength: amount(data.armies.strength) })}
        </dd>
        {data.battleRound !== null && (
          <>
            <dt>{t('tooltip.battle')}</dt>
            <dd className="tooltip__alarm">{t('tooltip.battleRound', { round: data.battleRound })}</dd>
          </>
        )}
        {data.staleDay !== null && (
          <>
            <dt>{t('tooltip.stale')}</dt>
            <dd>{t('province.lastSeen', { day: data.staleDay })}</dd>
          </>
        )}
      </dl>
      <p className="tooltip__hint">{touch ? t('map.tooltipHintTouch') : t('tooltip.hint')}</p>
    </div>
  )
}
