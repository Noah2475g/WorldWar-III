import { useState, type ReactNode } from 'react'
import { t } from '../i18n/text.ts'
import { amount } from './format.ts'
import { Icon } from './Icon.tsx'
import { RESOURCE_ICONS } from './icons.tsx'
import { useInputMode } from './inputMode.ts'
import type { Action } from './Panels.tsx'

/** Der Zustand eines Bauplatzes fuer die Marke (Bauvorschau D4). */
export type SlotState = 'ok' | 'short' | 'locked' | 'queue' | 'none'

export function slotState(a: Pick<Action, 'disabledReason' | 'blockCode'>): SlotState {
  if (a.disabledReason === null) return 'ok'
  switch (a.blockCode) {
    case 'INSUFFICIENT_RESOURCES':
      return 'short'
    case 'QUEUE_FULL':
      return 'queue'
    case 'NOT_YET_AVAILABLE':
    case 'MISSING_BUILDING':
    case 'INVALID_TARGET':
      return 'locked'
    default:
      return 'none' // BUILDING_MAX_LEVEL u. a.: keine Marke
  }
}

/** Die Vorschauzeile: feste Hoehe 22 px, auch leer (Spec Bauvorschau §3). */
export function CostPreview({ action }: { action: Action | null }) {
  const lines = action && slotState(action) !== 'none' ? (action.costLines ?? []) : []
  return (
    <div className="cost-preview" aria-hidden="true">
      {action && lines.length > 0 && (
        <>
          {action.icon && <Icon name={action.icon} size={14} />}
          {lines.map((l) => (
            <span key={l.resource} className={l.short > 0 ? 'cost-chip cost-chip--short' : 'cost-chip'}>
              <Icon name={RESOURCE_ICONS[l.resource] ?? 'warning'} size={22} />
              {amount(l.need)}
              {l.short > 0 && <span className="cost-chip__short">{t('actions.costShort', { amount: amount(l.short) })}</span>}
            </span>
          ))}
        </>
      )}
    </div>
  )
}

/** Hover/Fokus waehlt die Aktion, deren Kosten die Zeile unter dem Bereich zeigt (D6). Touch: nur Kinder. */
export function PreviewArea({ actions, children }: { actions: readonly Action[]; children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  const touch = useInputMode() === 'touch'
  if (touch) return <>{children}</>
  const pick = (target: EventTarget | null): void => {
    const el = target instanceof Element ? target : null
    const hit = el?.closest('[data-action-id]')
    if (hit) setId(hit.getAttribute('data-action-id'))
    else {
      const slot = el?.closest('.slot')
      // Rand/Ecke eines Feldes: Aktion des Feldes nehmen; Feld im Bau (ohne Aktion) leert die Zeile (Spec §3, §9)
      if (slot) setId(slot.querySelector('[data-action-id]')?.getAttribute('data-action-id') ?? null)
    }
    // sonst: Wert behalten (Luecke zwischen Feldern, Leerraum)
  }
  const action = id === null ? null : (actions.find((a) => a.id === id) ?? null)
  return (
    <>
      <div
        className="preview-area"
        onPointerOver={(e) => pick(e.target)}
        onFocus={(e) => pick(e.target)}
        onPointerLeave={() => setId(null)}
        onBlur={(e) => {
          if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setId(null)
        }}
      >
        {children}
      </div>
      <CostPreview action={action} />
    </>
  )
}
