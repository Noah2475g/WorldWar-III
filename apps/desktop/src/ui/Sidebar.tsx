import type { ReactNode } from 'react'

/**
 * Die Hülle der Seitenleiste (T-M44-02b, Nahtstelle für R-UX-01 und die Pakete A und D).
 *
 * Vorher war die Seitenleiste ein `<aside>` mitten in `App.tsx`, in dem Auswahl, Meldungen, das
 * jeweils offene Panel, die Wirtschaft und die Fehlersuche untereinander standen. Jetzt hat jede
 * Stelle einen Namen. Das ist **keine Funktion**: dieselben Kinder in derselben Reihenfolge im
 * selben Element mit derselben Klasse.
 *
 * Wer die Seitenleiste umbaut (Hochformat-Stapel, Blatt, Wirtschaft ständig sichtbar), ändert die
 * Hülle hier; wer ein Panel ändert, ändert den Inhalt von `panel` in `App.tsx`. Die zwei Arbeiten
 * berühren sich nicht mehr in denselben Zeilen.
 */
export interface SidebarProps {
  /** Die Provinzwahl ganz oben. */
  picker: ReactNode
  /** Die Hinweisliste (Alerts). */
  alerts: ReactNode
  /** Die letzte Rückmeldung auf einen Befehl. */
  notice: ReactNode
  /** Das jeweils offene Panel: Provinz, Armee, Diplomatie, Spionage, Rangliste oder Markt. */
  panel: ReactNode
  /** Die Wirtschaft: Kennzahlen und Verlauf, immer unten. */
  economy: ReactNode
  /** Die Fehlersuche, nur eingeschaltet sichtbar. */
  debug: ReactNode
}

export function Sidebar({ picker, alerts, notice, panel, economy, debug }: SidebarProps) {
  return (
    <aside className="side">
      {picker}
      {alerts}
      {notice}
      {panel}
      {economy}
      {debug}
    </aside>
  )
}
