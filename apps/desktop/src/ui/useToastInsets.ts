import { useLayoutEffect, type RefObject } from 'react'

/**
 * Toast-Lage (Seitenleiste v3b E1, Plan D2/D19): der Toast steht 12 px ueber der Kartenunterkante
 * (Desktop: ueber dem Fuss) beziehungsweise 12 px unter dem Kopf (Telefon-Hochformat). Beide Masse
 * stehen als `--dock-h` (Fusshoehe) und `--head-h` (Unterkante des Kopfes) am Raster `.app`, solange
 * Kopf und Fuss gerendert werden; mit der Leiste unten (E5) wird `--dock-h` deren Hoehe.
 */
export function useToastInsets(appRef: RefObject<HTMLElement | null>, ready: boolean): void {
  useLayoutEffect(() => {
    const app = appRef.current
    if (!app) return
    const measure = (): void => {
      const foot = app.querySelector('.foot')?.getBoundingClientRect()
      const head = app.querySelector('.header')?.getBoundingClientRect()
      const dock = foot && foot.height > 0 ? Math.max(0, window.innerHeight - foot.top) : 0
      app.style.setProperty('--dock-h', `${Math.round(dock)}px`)
      app.style.setProperty('--head-h', `${Math.round(head?.bottom ?? 0)}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', measure)
    const observer = new ResizeObserver(measure)
    for (const el of app.querySelectorAll('.header, .foot')) observer.observe(el)
    return () => {
      window.removeEventListener('resize', measure)
      observer.disconnect()
    }
  }, [appRef, ready])
}
