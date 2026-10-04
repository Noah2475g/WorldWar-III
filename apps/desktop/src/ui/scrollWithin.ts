/**
 * Bringt `target` an den oberen Rand seines naechsten Rollrahmens - und rollt nichts anderes.
 *
 * `Element.scrollIntoView` rollt JEDEN Vorfahren mit Rollbereich, auch die mit `overflow: hidden`
 * (Spec: "scrollable box" schliesst programmatisch rollbare Rahmen ein). Beim Waehlen einer Macht in der
 * Diplomatie schob es so die ganze App (`.app`, 100vh) um die Kopfhoehe nach oben: Kopfleiste weg,
 * Fuss hoch (Messung S575G 1280x800: header.y -82 statt 0, V3 Nachbesserung U).
 */
export function scrollWithin(target: HTMLElement): void {
  let parent = target.parentElement
  while (parent) {
    const { overflowY } = getComputedStyle(parent)
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) break
    parent = parent.parentElement
  }
  if (!parent) return
  const offset = target.getBoundingClientRect().top - parent.getBoundingClientRect().top
  parent.scrollTop += offset - parseFloat(getComputedStyle(parent).paddingTop || '0')
}
