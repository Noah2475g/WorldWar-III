import { createElement, type ReactElement } from 'react'
import { toast } from 'sonner'
import { ACK_MIN_MS, ACK_SLACK_MS } from '../game/ack.ts'

/**
 * Meldungen als Toast (Seitenleiste v3b E1, Plan D2/D21, Spec §10.9.4).
 *
 * Alle Arten teilen EINE id ('notice'): ein neuer Toast ersetzt den stehenden, es gibt nie
 * mehr als einen im DOM. Die Quittung ('ack') traegt `role="status"` fuer die Ansage,
 * alle anderen Arten haben keine Rolle — die Ansage macht der Container von sonner
 * (`section[aria-live=polite]`); verschachtelte Live-Regionen wuerden doppelt vorlesen.
 *
 * Die Darstellung wechselt, der Zustand nicht: `ui.notice` bleibt im uiState.
 */

export type NoticeKind = 'ack' | 'error' | 'warn' | 'info'

/** Anzeigedauer je Art in ms (Spec §10.9.4). Die Quittung steht wie bisher ACK_MIN_MS + ACK_SLACK_MS. */
export const NOTICE_DURATION: Readonly<Record<NoticeKind, number>> = {
  ack: ACK_MIN_MS + ACK_SLACK_MS,
  error: 6000,
  warn: 6000,
  info: 4000,
}

/** Die eine id aller Meldungs-Toasts. */
export const NOTICE_ID = 'notice'

/** Die vier Orte einer Meldung (Spec §10.9.4, D21). */
export type MessagePlace = 'toast' | 'alerts' | 'chip' | 'dock'

/**
 * Art -> genau EIN Ort (D21/K19). Wer eine Art hinzufuegt, traegt sie hier ein; der Test
 * `notice.test.tsx` prueft, dass jede Art genau einen gueltigen Ort hat.
 *
 * Uebergang E1: `completion` (Bau fertig / Einheit ausgehoben) bleibt in der Hinweisspalte,
 * solange das Fertig-Ereignis nicht als Toast verdrahtet ist (E5/E6); `done` ist die
 * Toast-Art dafuer und hat noch keinen Aufrufer in der App.
 */
export const MESSAGE_ROUTE = {
  ack: 'toast',
  error: 'toast',
  warn: 'toast',
  info: 'toast',
  done: 'toast',
  contract: 'toast',
  offer: 'alerts',
  battle: 'alerts',
  overrun: 'alerts',
  capital: 'alerts',
  unrest: 'alerts',
  clearance: 'alerts',
  shortage: 'alerts',
  sabotage: 'alerts',
  espionage: 'alerts',
  unlock: 'alerts',
  upcoming: 'alerts',
  completion: 'alerts',
  intrusion: 'chip',
  pause: 'dock',
} as const satisfies Readonly<Record<string, MessagePlace>>

export type MessageKind = keyof typeof MESSAGE_ROUTE

/** Eine Kennung `<art>:<gegenstand>` fuer `data-msg` (D21). */
export function messageId(kind: string, subject: string): string {
  const slug = subject
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${kind}:${slug || 'x'}`
}

export interface NoticeOptions {
  /** Ein Sprung-Knopf (nur Meldungen "fertig/beendet"). */
  jump?: { label: string; onJump: () => void }
}

/** Das Markup eines Toasts; ohne aria-live und ohne role (siehe oben). */
export function noticeMarkup(kind: NoticeKind, text: string, options: NoticeOptions = {}): ReactElement {
  const className =
    kind === 'ack' ? 'action__pending notice notice--ack' : `notice notice--${kind}`
  const children: (string | ReactElement)[] = [text]
  if (options.jump) {
    children.push(
      createElement(
        'button',
        { key: 'jump', type: 'button', className: 'notice__jump', onClick: options.jump.onJump },
        options.jump.label,
      ),
    )
  }
  const role = kind === 'ack' ? 'status' : undefined
  return createElement('p', { className, 'data-msg': messageId(kind, text), role }, ...children)
}

/** Zeigt die Meldung und ersetzt eine stehende (gleiche id). */
export function showNotice(kind: NoticeKind, text: string, options: NoticeOptions = {}): void {
  toast.custom(() => noticeMarkup(kind, text, options), {
    id: NOTICE_ID,
    duration: NOTICE_DURATION[kind],
  })
}

export const ack = (text: string): void => showNotice('ack', text)
export const error = (text: string): void => showNotice('error', text)
export const warn = (text: string): void => showNotice('warn', text)
export const info = (text: string, options?: NoticeOptions): void => showNotice('info', text, options)

/** Raeumt den stehenden Meldungs-Toast weg. */
export function dismissNotice(): void {
  toast.dismiss(NOTICE_ID)
}
