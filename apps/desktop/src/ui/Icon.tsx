import {
  ArrowLeftRight,
  Banknote,
  Bomb,
  Building2,
  Clock,
  Eye,
  FastForward,
  Flag,
  Handshake,
  Hourglass,
  Link2,
  Mountain,
  Pause,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Swords,
  TreePine,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import ms from 'milsymbol'
import { GLYPH_BOX, GLYPH_PATHS } from './glyphs.ts'
import { Icon as DrawnIcon, type IconName, type IconProps } from './icons.tsx'

/**
 * Das Symbol des Spiels (T-M46-13, VM-05): „keinen Text als Hauptvordergrund, sondern Grafiken
 * und Symbole“.
 *
 * Drei Quellen, eine Schnittstelle — `name`, `size`, `title` wie bisher in `icons.tsx`:
 *
 *  - **Einheiten** als NATO-Truppenzeichen aus milsymbol (MIT), Rahmen und Strich in der
 *    Textfarbe, damit dasselbe Zeichen im Kopf, im Panel und im Tooltip stimmt;
 *  - **Gebaeude und Rohstoffe** aus game-icons.net (CC BY 3.0, Urheber in `glyphs.ts` und
 *    `docs/ASSETS.md`), gefuellt mit der Textfarbe;
 *  - **Oberflaeche** (Uhr, Pause, Warnung, Beziehungen, Gelaende, Spionage) aus Lucide (ISC).
 *
 * Was keine der drei Quellen hat (Rueckzugssperre, Stellungsbogen, Ebene, Landebahn …),
 * bleibt die selbst gezeichnete Fassung aus `icons.tsx`. Der Text steht NICHT im Bild: jedes
 * Symbol mit `title` traegt ihn als zugaenglichen Namen und als Tooltip (`<title>`); ohne
 * `title` ist es Zierde und fuer die Vorlesehilfe unsichtbar.
 */

export type { IconName, IconProps }

/** 2525C-Kennungen der zehn Einheitenarten; friend/present/Land bzw. Luft bzw. See. */
const SIDC: Partial<Record<IconName, string>> = {
  infantry: 'SFGPUCI-------',
  motorized: 'SFGPUCIZ------',
  armour: 'SFGPUCA-------',
  heavyArmour: 'SFGPUCATH-----',
  artillery: 'SFGPUCF-------',
  rocket: 'SFGPUCFR------',
  aircraft: 'SFAPMFF-------',
  bomber: 'SFAPMFB-------',
  ship: 'SFSPCLDD------',
  transport: 'SFSPXMTO------',
}

/** Oberflaechensymbole aus Lucide. */
const LUCIDE: Partial<Record<IconName, LucideIcon>> = {
  clock: Clock,
  pause: Pause,
  fastForward: FastForward,
  warning: TriangleAlert,
  battle: Swords,
  capital: Star,
  queue: Hourglass,
  peace: Handshake,
  truce: Flag,
  alliance: Link2,
  sharedMap: Eye,
  mountain: Mountain,
  desert: Sun,
  forest: TreePine,
  urban: Building2,
  spyIntel: Search,
  spyEconomic: Banknote,
  spyMilitary: Bomb,
  spyCounter: ShieldCheck,
  trade: ArrowLeftRight,
}

interface Frame {
  viewBox: string
  inner: string
}

const frames = new Map<IconName, Frame | null>()

/** Das Truppenzeichen als Rahmen + Inhalt; einmal je Art erzeugt, danach aus dem Speicher. */
function unitFrame(name: IconName): Frame | null {
  if (frames.has(name)) return frames.get(name) ?? null
  const sidc = SIDC[name]
  let frame: Frame | null = null
  if (sidc) {
    const svg = new ms.Symbol(sidc, { size: 32, monoColor: 'currentColor', outlineWidth: 0, strokeWidth: 5 }).asSVG()
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1]
    const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1]
    if (viewBox && inner) frame = { viewBox, inner }
  }
  frames.set(name, frame)
  return frame
}

/** Gibt es fuer diesen Namen ein Bild aus einer der drei Quellen (sonst bleibt die Zeichnung)? */
export function hasPicture(name: IconName): boolean {
  return Boolean(SIDC[name] || GLYPH_PATHS[name] || LUCIDE[name])
}

export interface PictureProps extends IconProps {
  className?: string
}

export function Icon({ name, size = 16, title, className }: PictureProps) {
  const label = title ? { role: 'img' as const, 'aria-label': title } : { role: 'presentation' as const, 'aria-hidden': true as const }

  const unit = unitFrame(name)
  if (unit) {
    // Truppenzeichen sind breiter als hoch; die Hoehe bleibt `size`, der Kasten laesst Platz.
    return (
      <svg width={size} height={size} viewBox={unit.viewBox} className={className} {...label}>
        {title && <title>{title}</title>}
        <g dangerouslySetInnerHTML={{ __html: unit.inner }} />
      </svg>
    )
  }

  const glyph = GLYPH_PATHS[name]
  if (glyph) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} className={className} fill="currentColor" {...label}>
        {title && <title>{title}</title>}
        <path d={glyph} />
      </svg>
    )
  }

  const Drawn = LUCIDE[name]
  if (Drawn) {
    return (
      <Drawn size={size} strokeWidth={1.8} className={className} {...label}>
        {title && <title>{title}</title>}
      </Drawn>
    )
  }

  return <DrawnIcon name={name} size={size} {...(title ? { title } : {})} />
}
