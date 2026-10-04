import type { PublicView } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { arrival } from '../ui/format.ts'
import type { ArmyRow } from '../ui/Panels.tsx'

/**
 * Die Zeilen der Heeruebersicht (T-M46-01, R-UX-04): jede eigene Armee der Sicht mit Name, Ort, Staerke
 * und Auftrag. Rein, damit ein Test die Reihenfolge und die Saetze festhalten kann.
 *
 * Reihenfolge: zuerst, was gerade kaempft (braucht Aufmerksamkeit), dann was marschiert, dann was steht;
 * darin nach Name, Zahlen als Zahlen ("Armee 2" vor "Armee 10").
 */
export interface ArmyRowDeps {
  nameOfArmy: (armyId: string) => string
  nameOfProvince: (provinceId: string) => string
  ticksPerDay: number
  /** Provinzen, in denen gerade gekaempft wird. */
  battleProvinces: ReadonlySet<string>
}

const ORDER_RANK = { battle: 0, marching: 1, idle: 2 } as const

export function armyRows(view: PublicView, deps: ArmyRowDeps): ArmyRow[] {
  const rows: ArmyRow[] = []
  for (const army of view.armies) {
    if (army.owner !== view.playerId) continue
    const marching = army.arrivalTick != null && army.arrivalTick > view.tick
    const fighting = deps.battleProvinces.has(army.provinceId)
    const order = fighting ? 'battle' : marching ? 'marching' : 'idle'
    const destination = army.path && army.path.length > 0 ? army.path[army.path.length - 1] : undefined
    const stance = army.stance ? t(`army.stance${army.stance[0]!.toUpperCase()}${army.stance.slice(1)}`) : t('army.idle')
    const orderText =
      order === 'battle'
        ? t('armies.inBattle')
        : order === 'marching'
          ? t('armies.marchingTo', {
              target: destination ? deps.nameOfProvince(destination) : '…',
              arrival: arrival(view.tick, army.arrivalTick!, deps.ticksPerDay),
            })
          : t('armies.standing', { stance })
    rows.push({
      id: army.id,
      name: deps.nameOfArmy(army.id),
      provinceName: deps.nameOfProvince(army.provinceId),
      strength: army.strength,
      order,
      orderText,
    })
  }
  return rows.sort(
    (a, b) => ORDER_RANK[a.order] - ORDER_RANK[b.order] || a.name.localeCompare(b.name, 'de', { numeric: true }),
  )
}
