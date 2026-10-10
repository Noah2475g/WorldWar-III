import { useEffect, useRef, type ReactNode } from 'react'
import { t } from '../i18n/text.ts'

/**
 * Die Hülle der Seitenleiste (T-M44-02b; Seitenleiste v3b E3, D6).
 *
 * Seit E3 schwebt `aside.side` (Klasse bleibt) 320 px breit links neben der Leiste rechts, mit
 * einem Kopf von 52 px (Titel, Taste, ×) und einem rollenden Körper. Zu ist sie unsichtbar und
 * aus der Tab-Folge (`inert`); offen ist sie, wenn `open` gilt (= `ui.panel` gesetzt). Die Plätze
 * im Körper heißen wie vorher; wer ein Panel ändert, ändert seinen Inhalt in `App.tsx`.
 */
export interface SidebarProps {
  /**
   * Wechselt dieser Schluessel (anderes Panel, andere Auswahl), beginnt die Leiste oben (T-M44-12):
   * ein neues Panel soll mit seinem Kopf im Bild stehen, nicht dort, wo das vorige gerollt war.
   */
  scrollKey?: string
  /** Offen oder zu (E3). Ohne Angabe offen — so bleiben alte Aufrufer und Tests, wie sie waren. */
  open?: boolean
  /** Titel im Kopf; ohne Titel kein Kopf. */
  title?: string
  /** Die Taste als Marke im Kopf. */
  shortcut?: string | null
  onClose?: () => void
  /** Der Griff des Blatts (T-M44-03b), nur im Hochformat des Telefons sichtbar. */
  handle?: ReactNode
  /** Die Provinzwahl ganz oben. */
  picker: ReactNode
  /** Die Hinweisliste (Alerts). */
  alerts: ReactNode
  /** Die letzte Rückmeldung auf einen Befehl. */
  notice: ReactNode
  /** Das jeweils offene Panel. */
  panel: ReactNode
  /** Die Wirtschaft (seit E3 nur noch im Bereich `economy`). */
  economy: ReactNode
  /** Die Fehlersuche, nur eingeschaltet sichtbar. */
  debug: ReactNode
}

export function Sidebar({ picker, alerts, notice, panel, economy, debug, scrollKey, handle, open = true, title, shortcut, onClose }: SidebarProps) {
  const ref = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0
    if (body.current) body.current.scrollTop = 0
  }, [scrollKey])
  return (
    // `inert` nimmt die zugeklappte Leiste aus Tab-Folge und Vorlesehilfe (K5).
    <aside className="side" ref={ref} data-open={open ? 'true' : 'false'} inert={!open}>
      {title && (
        <div className="side__head">
          <h2 className="side__title">{title}</h2>
          {shortcut && (
            <kbd className="side__key" aria-hidden="true">
              {shortcut}
            </kbd>
          )}
          {onClose && (
            <button type="button" className="side__close" aria-label={t('side.close')} title={`${t('side.close')} (Esc)`} onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}
      <div className="side__body" ref={body}>
        {handle}
        {picker}
        {alerts}
        {notice}
        {panel}
        {economy}
        {debug}
      </div>
    </aside>
  )
}
