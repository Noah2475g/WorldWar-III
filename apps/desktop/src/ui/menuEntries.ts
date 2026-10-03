import { t } from '../i18n/text.ts'

/**
 * Die Einträge des Menüs als Liste (T-M44-02b, Nahtstelle für T-M44-09a und R-UX-04/AK1).
 *
 * Vorher standen drei Knöpfe von Hand im `MenuDialog`, und jeder bekam ein eigenes Prop. Wer einen
 * vierten Eintrag braucht — oder einem den zweiten Klick aufträgt (R-UX-04/AK1: „aus einer
 * laufenden Partie eine neue beginnen“) —, ergänzt **diese Liste**, nicht `App.tsx` und nicht
 * die Signatur des Dialogs. Reihenfolge der Liste = Reihenfolge auf dem Schirm; der erste Eintrag
 * mit `primary` trägt die Hauptfarbe.
 */

/** Welcher Dialog sich hinter dem Eintrag öffnet — `App.tsx` kennt die Wertemenge von `dialog`. */
export type MenuTarget = 'new' | 'saves' | 'settings' | 'keys'

export interface MenuEntry {
  readonly id: string
  /** Als Funktion, damit der Text beim Zeichnen gelesen wird und der Wächter `text-keys` ihn sieht. */
  readonly label: () => string
  readonly target: MenuTarget
  readonly primary?: boolean
  /**
   * Der Folgesatz eines Eintrags, der nachfragt (T-M44-09a, R-UX-04/AK1): gesetzt, zeigt der Dialog
   * einen `ConfirmButton` — der erste Klick nennt die Folge, erst der zweite wählt den Eintrag.
   */
  readonly confirm?: () => string
}

export const MENU_ENTRIES: readonly MenuEntry[] = [
  // Aus der laufenden Partie eine neue zu beginnen verlässt diese: zweiter Klick (T-M44-09a).
  { id: 'newGame', label: () => t('newGame.title'), target: 'new', primary: true, confirm: () => t('menu.newGameConfirm') },
  { id: 'saves', label: () => t('saves.title'), target: 'saves' },
  { id: 'settings', label: () => t('settings.title'), target: 'settings' },
  // Erkennen statt Erinnern (T-M44-16, R-UX-05): die Übersicht der Tasten, nicht nur per F1.
  { id: 'keys', label: () => t('menu.keys'), target: 'keys' },
]
