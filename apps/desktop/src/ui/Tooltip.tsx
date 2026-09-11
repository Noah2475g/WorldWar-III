import type { PublicView, Terrain } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { Icon, TERRAIN_ICONS } from './icons.tsx'
import { amount, percent, unfix } from './format.ts'
import { TERRAIN_DEFENCE_PERMILLE } from './Panels.tsx'

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

export function Tooltip({ data, x, y }: TooltipProps) {
  const defence = TERRAIN_DEFENCE_PERMILLE[data.terrain]
  return (
    <div className="tooltip" role="tooltip" id={`tooltip-${data.provinceId}`} style={{ left: x + OFFSET, top: y + OFFSET }}>
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
      <p className="tooltip__hint">{t('tooltip.hint')}</p>
    </div>
  )
}
