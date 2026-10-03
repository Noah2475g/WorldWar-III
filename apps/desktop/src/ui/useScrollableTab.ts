import { useEffect, useState } from 'react'

/**
 * Ein Bereich, der rollt, ist mit der Tastatur erreichbar (T-M44-08, R-UX-06/AK1, WCAG 2.1.1).
 *
 * axe-core meldet `scrollable-region-focusable`, sobald ein Bereich überläuft und nichts in ihm den
 * Fokus nehmen kann — gemessen bei 375 px an der Rohstoffleiste (Befund B-10). Der Bereich bekommt
 * `tabindex=0` **nur dann, wenn er wirklich rollt**: ein Tabstopp ohne Nutzen ist selbst ein Fehler,
 * und bei 1280 px passt die Leiste. Gemessen wird beim Zeichnen und bei jeder Größenänderung des
 * Bereichs und seiner Kinder (die Zahlen wechseln ihre Breite, ohne dass die Leiste ihre ändert).
 * Den Namen trägt der Aufrufer (`aria-label`).
 */
export function useScrollableTab<T extends HTMLElement>(): { ref: (element: T | null) => void; tabIndex: 0 | undefined } {
  // Ein Rückruf-Ref statt `useRef`: eine Tabelle, die erst später erscheint (die Lage ohne Sicht
  // zeichnet nichts), wird gemessen, sobald sie da ist.
  const [element, setElement] = useState<T | null>(null)
  const [scrolls, setScrolls] = useState(false)

  useEffect(() => {
    if (!element) return undefined
    const measure = () =>
      setScrolls(element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
    measure()
    // Ohne ResizeObserver (alte Umgebung, jsdom) bleibt es bei der einen Messung.
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [element])

  return { ref: setElement, tabIndex: scrolls ? 0 : undefined }
}
