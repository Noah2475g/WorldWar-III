import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n/text.ts'

/**
 * Was passiert, wenn es schiefgeht (T-M14-10, Befund N6).
 *
 * Im ganzen Baum gab es keine einzige Fehlergrenze: `grep -rn "ErrorBoundary"` über `apps`
 * und `packages` lieferte null Treffer. Ein unabgefangener Renderfehler ergibt in React 18
 * eine **weiße Fläche** — die Anwendung wird abgehängt, und der Spieler sieht nichts, nicht
 * einmal einen Hinweis, dass etwas passiert ist.
 *
 * Für den Playtest heißt das: Ein Absturz liefert Noah keine Information außer „es ist
 * weg". Diese Grenze macht daraus eine Meldung mit dem Fehlertext, den er weitergeben kann,
 * und lässt die Seite neu laden, statt sie zu verlieren.
 *
 * Bewusst eine Klassenkomponente: Fehlergrenzen sind der eine Fall, für den React keine
 * Funktionsentsprechung hat.
 */

interface Props {
  children: ReactNode
  /** Zum Prüfen: was mit dem Fehler geschehen soll, statt ihn auf die Konsole zu schreiben. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, info)
      return
    }
    // Ohne Absender bleibt die Konsole: Es gibt kein Netz, an das man das schicken
    // könnte, und das ist Absicht (R-FREE-04).
    console.error('WorldWar ist auf einen Fehler gelaufen:', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="dialog-backdrop">
        <div className="dialog" role="alertdialog" aria-modal="true" aria-label={t('error.title')}>
          <div className="dialog__head">
            <h2>{t('error.title')}</h2>
          </div>
          <div className="dialog__body">
            <p className="state state--war">{t('error.body')}</p>
            <pre className="facts__inline" style={{ whiteSpace: 'pre-wrap', maxHeight: '12em', overflow: 'auto' }}>
              {error.message}
            </pre>
            <p className="facts__inline">{t('error.hint')}</p>
            <div className="actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => globalThis.location?.reload()}
              >
                {t('error.reload')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
