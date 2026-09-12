/**
 * Der Bildsatz: siebzehn Schattenrisse (T-M33-01, EINHEITSBILDER.md D33.1, R-ASSET-01).
 *
 * Ein ZWEITER Satz neben `icons.tsx`, kein Ersatz. Die Karte behaelt ihre NATO-Glyphe —
 * `MapCanvas` stempelt sie als einzelnen `Path2D` bei 11 px Kantenlaenge, und ein
 * gefuellter Schattenriss ist dort ein Fleck (D33-a). In den Panels ist es umgekehrt: ein
 * Rechteck mit Oval sagt bei 34 px nicht mehr als bei 11, ein Panzer von der Seite schon.
 *
 * Jede Zeichnung liegt im Kasten 48 x 30 mit der Standlinie bei y = 26 und besteht aus
 * zwei Pfaden: `body` wird gefuellt, `cut` traegt die Innenlinien — Radnaben, Rippen,
 * Fenster, Wellen — und wird in der Flaechenfarbe UEBER die Flaeche gestrichen. Ein
 * einziger Pfad mit `evenodd` koennte Loecher stanzen, aber keine Linie ziehen, und ohne
 * Radnaben ist ein Panzer eine Schachtel (D33-b).
 *
 * Selbst gezeichnet, inline, ohne Datei und ohne Fremdquelle (R-ASSET-01): die Vorlage
 * ist `docs/design/einheiten-bilder.html`, und `art.test.tsx` vergleicht jede der
 * siebzehn Zeichnungen Zeichen fuer Zeichen mit dem Blatt.
 */

import type { BuildingKey } from '@worldwar/core'
import type { IconName } from './icons.tsx'
import { BUILDING_ICONS, UNIT_ICONS } from './icons.tsx'
import type { MarkerTone } from './UnitMarker.tsx'

/** Ein Kreis als Bogenpaar — Raeder, Naben, Poller. Wie im Entwurfsblatt. */
const c = (x: number, y: number, r: number): string =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

export type ArtName =
  | 'infantry'
  | 'motorized'
  | 'tank'
  | 'heavy_tank'
  | 'artillery'
  | 'rocket_artillery'
  | 'fighter'
  | 'bomber'
  | 'destroyer'
  | 'transport'
  | 'barracks'
  | 'fortress'
  | 'factory'
  | 'harbour'
  | 'shipyard'
  | 'airfield'
  | 'railway'

export interface Art {
  /** Die gefuellte Flaeche. */
  body: string
  /** Die Innenlinien, in der Flaechenfarbe darueber gestrichen. */
  cut: string
}

const DRAWINGS: Record<ArtName, Art> = {
  // Der marschierende Mann mit geschultertem Gewehr (Noahs Wahl, zweite Runde). Neun
  // Einheiten zeigen ihr Geraet, die zehnte einen Menschen — die Infanterie IST das
  // Geraet, und ein Helm auf einem Gewehr wurde in der ersten Runde nicht gelesen.
  infantry: {
    body:
      'M19.6 8.4a4.6 4.4 0 0 1 9.2 0Z' +
      'M18.2 8.2h12v2h-12Z' +
      'M21.8 10.2h4.4v1.8h-4.4Z' +
      'M19.8 11.8h7.4l1.6 8.8h-9Z' +
      'M16.4 12.4h3.6v6.2h-3.6Z' +
      'M29.6 4.8 L31.3 6.1 L19.8 22.3 L18.1 21Z' +
      'M24.6 20.6h3.8l1.2 6h-3.6Z M25.2 24.9h5.2v1.9h-5.2Z' +
      'M19.8 20.6h3.6l-1.6 6h-3.6Z M17 24.9h5.2v1.9H17Z',
    cut: 'M19.9 17.6h8.8 M23.7 20.9l-.9 5.7 M20.1 12.6v5.8',
  },
  motorized: {
    body:
      'M6 12h9l3.4 5.4V21H6Z' +
      'M18.4 9h21a3 3 0 0 1 3 3v9H18.4Z' +
      'M5 21h38v2.2H5Z' +
      c(12, 24.2, 3.3) +
      c(34, 24.2, 3.3) +
      c(40.5, 24.2, 3.3),
    cut:
      c(12, 24.2, 1.2) +
      c(34, 24.2, 1.2) +
      c(40.5, 24.2, 1.2) +
      'M24 10v10.6 M30 10v10.6 M36 10v10.6 M8.5 13.5h5v3.5h-5z',
  },
  tank: {
    body: 'M5 19h38l-2-5H9Z' + 'M18 14l2-5h9l2 5Z' + 'M29 10.4h17v1.9H29Z' + 'M4 19h40a4 4 0 0 1 0 8H4a4 4 0 0 1 0-8Z',
    cut:
      c(8.5, 23, 2.2) +
      c(14.5, 23, 2.2) +
      c(20.5, 23, 2.2) +
      c(26.5, 23, 2.2) +
      c(32.5, 23, 2.2) +
      c(38.5, 23, 2.2) +
      'M20.5 11.5h8',
  },
  heavy_tank: {
    body:
      'M4 19h40l-2-6H8Z' + 'M16 13l2-6h12l3 6Z' + 'M32 8.6h16v2.1H32Z' + 'M4.5 19h39a4.5 4.5 0 0 1 0 9H4.5a4.5 4.5 0 0 1 0-9Z',
    cut:
      c(7.5, 23.5, 2.4) +
      c(13.5, 23.5, 2.4) +
      c(19.5, 23.5, 2.4) +
      c(25.5, 23.5, 2.4) +
      c(31.5, 23.5, 2.4) +
      c(37.5, 23.5, 2.4) +
      c(43, 23.5, 2.4) +
      'M19 9.5h10 M30 9.2h3v2.2h-3z',
  },
  // Rohr, Schild, Spornlafette, ein grosses Rad.
  artillery: {
    body:
      'M16.4 16.6 L40.6 3.2 l2.3 3.3 L18.7 20 Z' +
      'M39.4 2.2 L44.6 5.2 L43.2 7.6 L38 4.6 Z' +
      'M8.6 12.2h8.2v9.8H8.6Z' +
      'M16.8 21.2 L4.2 27 L3.3 24.8 L15.9 19 Z' +
      c(17, 20.6, 6.4),
    cut: c(17, 20.6, 2.2) + 'M10.6 14.2h4.2v5.8h-4.2 M25 13l2.1 3',
  },
  rocket_artillery: {
    body:
      'M6 13h8l3 4.4V21H6Z' +
      'M17 17h24v4H17Z' +
      'M20 15.4 L42 5.6 l1 2.2 L21 17.6 Z' +
      'M20 11.2 L42 1.4 l1 2.2 L21 13.4 Z' +
      'M22.6 11.2h2v5.2h-2Z' +
      'M5 21h38v2.2H5Z' +
      c(12, 24.2, 3.3) +
      c(34, 24.2, 3.3) +
      c(40.5, 24.2, 3.3),
    cut: c(12, 24.2, 1.2) + c(34, 24.2, 1.2) + c(40.5, 24.2, 1.2) + 'M8.5 14.5h5v3.2h-5z',
  },
  fighter: {
    body:
      'M3 18.6 L10 13.6 L34 12.8 a7 3.2 0 0 1 8.4 2.8 a7 3.2 0 0 1 -8.4 2.8 L10 20.4 Z' +
      'M3.4 18.6 V7.4 L11.6 14.2 Z' +
      'M1.6 18.4h11.4v2.4H1.6Z' +
      'M23 16.8h7.6l-3.2 8.6h-7Z' +
      'M41.8 13.2 L45.2 14.6 L41.8 16 Z' +
      'M44.8 7.6h1.9v14h-1.9Z',
    cut: 'M25.6 13.2l3.4-2.8h4.2l2 2.6 M13 16.4h17',
  },
  bomber: {
    body:
      'M22 1.6h4a2.4 2.4 0 0 1 2.4 2.4v22a2.4 2.4 0 0 1 -2.4 2.4h-4a2.4 2.4 0 0 1 -2.4-2.4V4a2.4 2.4 0 0 1 2.4-2.4Z' +
      'M1.5 11.4h45l-3.4 4.4H4.9Z' +
      'M12 23.2h24l-2.2 3.4H14.2Z' +
      'M8.2 9.8h4.4v7.6H8.2Z M14.6 9.8h4.4v7.6h-4.4Z M29 9.8h4.4v7.6H29Z M35.4 9.8h4.4v7.6h-4.4Z',
    cut: 'M24 5.6v20 M6 13.4h36',
  },
  destroyer: {
    body:
      'M2 18h44l-6.5 7H8.5Z' +
      'M18 12h9.5v6H18Z' +
      'M21 7.6h4.6v4.4H21Z' +
      'M28.4 2h1.6v10h-1.6Z' +
      'M33 14.4h6.4v3.6H33Z M38.6 15.4h7v1.7h-7Z' +
      'M8 14.8h5.6v3.2H8Z' +
      'M5 27h7.4v1.8H5Z M15.4 27h7.4v1.8h-7.4Z M25.8 27h7.4v1.8h-7.4Z M36.2 27h7.4v1.8h-7.4Z',
    cut: 'M19.6 13.4h6.4v2.2h-6.4z M24 2.8l4.4 3',
  },
  transport: {
    body:
      'M2 18h44l-6.5 7H8.5Z' +
      'M5.4 11h9v7h-9Z' +
      'M7.8 6.6h3.6v4.4H7.8Z' +
      'M18 11.6h9v6.4h-9Z M29 13h8.6v5H29Z' +
      'M16 5.6h1.6v6.2H16Z M16.6 5.4 L27 9.6 l-.7 1.8 L15.9 7.2 Z' +
      'M5 27h7.4v1.8H5Z M15.4 27h7.4v1.8h-7.4Z M25.8 27h7.4v1.8h-7.4Z M36.2 27h7.4v1.8h-7.4Z',
    cut: 'M18 14.8h9 M22.5 11.6v6.4 M29 15.5h8.6 M33.3 13v5',
  },

  barracks: {
    body: 'M5 13.4 L24 4.6 L43 13.4 Z' + 'M8.6 13.4h30.8V26H8.6Z' + 'M23.2 4.6h1.6V0.8h-1.6Z M24.8 0.8h7.4v3.4h-7.4Z',
    cut: 'M20.4 18.6h7.2V26h-7.2z M11.6 16.4h5v4h-5z M31.4 16.4h5v4h-5z',
  },
  fortress: {
    body: 'M4 26V11.4h4.4V7.6h4.4v3.8h6.4V7.6h4.4v3.8h6.4V7.6h4.4v3.8H40V26Z',
    cut: 'M18 26v-6.4a4.6 4.6 0 0 1 9.2 0V26 M4 15.4h36 M12.8 19h3.4v3.4h-3.4z M28.4 19h3.4v3.4h-3.4z',
  },
  factory: {
    body: 'M4 26V15.2l9 4.6V15.2l9 4.6V15.2l9 4.6V12.4h13V26Z' + 'M35.4 12.4V3.4h4.6v9Z',
    cut: 'M8 21.6h3.6v3.2H8z M17 21.6h3.6v3.2H17z M26 21.6h3.6v3.2H26z M36.6 3.2q0-3 3-3',
  },
  // Kai auf Pfaehlen, Poller mit Tau, Anker — kein Schiff, das hat die Werft.
  harbour: {
    body:
      'M2 17.4h26v4.4H2Z' +
      'M4.6 21.8h2.6v4.8H4.6Z M11 21.8h2.6v4.8H11Z M17.4 21.8H20v4.8h-2.6Z M23.8 21.8h2.6v4.8h-2.6Z' +
      'M9 11.2h5.2v6.2H9Z M7.6 8.6h8v2.8h-8Z' +
      'M15.4 9.6q10.2 1.8 13.8 8.2l-2 1.1q-3.2-5.8-12.2-7.2Z' +
      'M37.4 11.6h2v11.8h-2Z' +
      'M33.2 13.6h10.4v2H33.2Z' +
      c(38.4, 8.4, 2.9) +
      'M32.6 17.8q0 5.9 5.8 6.8v-2.2q-3.7-.9-3.7-4.6Z' +
      'M44.2 17.8q0 5.9-5.8 6.8v-2.2q3.7-.9 3.7-4.6Z',
    cut: c(38.4, 8.4, 1.3) + 'M2 20.2h26 M9.4 12.6h4.4',
  },
  shipyard: {
    body: 'M2 23.8h44V26H2Z' + 'M6 3.6h32v3.2H6Z' + 'M7 6.8h3.2v17H7Z M33.8 6.8H37v17h-3.2Z' + 'M12.6 14h22l-4 8H16.4Z',
    cut: 'M22 6.8v5 M19.6 11.6h4.8v3h-4.8z M14.6 17h18',
  },
  // Halle, Turm, und eine Bahn, die perspektivisch nach hinten schmaler wird.
  airfield: {
    body:
      'M9 26h37l-5.4-4.6H14.4Z' +
      'M2.6 21.4V14.8a9.2 8.2 0 0 1 18.4 0v6.6Z' +
      'M31.6 21.4V10h4.4v11.4Z M29.4 5.6h8.8v4.4h-8.8Z',
    cut: 'M8.4 21.4v-5.2h7v5.2 M30.8 6.8h6v2.1h-6 M20 23.6h4.4 M28 23.6h4.4 M36 23.6h4.4',
  },
  railway: {
    body:
      'M4 7h11v14H4Z' +
      'M15 11h17v10H15Z' +
      'M27.6 5h4.6v6h-4.6Z' +
      'M32 17l6.4 4H32Z' +
      c(9, 23.6, 3.2) +
      c(19, 23.6, 3.2) +
      c(27, 23.6, 3.2) +
      'M2 27.4h44v1.8H2Z',
    cut:
      c(9, 23.6, 1.1) +
      c(19, 23.6, 1.1) +
      c(27, 23.6, 1.1) +
      'M6 9.6h7v4.4H6z M28.4 4.8q0-3 3-3 M5 27.4v1.8 M13 27.4v1.8 M21 27.4v1.8 M29 27.4v1.8 M37 27.4v1.8',
  },
}

export const ART: Readonly<Record<ArtName, Art>> = DRAWINGS

/** Jeder Bildname, fuer den Test, der den Satz vollstaendig haelt. */
export const ART_NAMES = Object.keys(DRAWINGS) as ArtName[]

/**
 * Welches Bild zu welcher Einheit gehoert — die Schluessel sind die von
 * `data/rules/default/units.json`, genau diese und keine weiteren.
 */
export const UNIT_ART: Record<string, ArtName> = {
  infantry: 'infantry',
  motorized: 'motorized',
  tank: 'tank',
  heavy_tank: 'heavy_tank',
  artillery: 'artillery',
  rocket_artillery: 'rocket_artillery',
  fighter: 'fighter',
  bomber: 'bomber',
  destroyer: 'destroyer',
  transport: 'transport',
}

export const BUILDING_ART: Record<BuildingKey, ArtName> = {
  barracks: 'barracks',
  fortress: 'fortress',
  factory: 'factory',
  harbour: 'harbour',
  shipyard: 'shipyard',
  airfield: 'airfield',
  railway: 'railway',
}

/**
 * Von der Glyphe zum Bild (T-M33-04).
 *
 * Die Armeeliste fuehrt den Glyphennamen, nicht den Regelschluessel — sie kommt aus
 * `UNIT_ICONS`. Statt den Schluessel durch drei Schichten mitzuschleppen, wird die
 * Bruecke hier einmal aus beiden Tabellen gebaut: sie kann gar nicht veralten, weil sie
 * keine dritte Liste ist.
 */
export const ART_FOR_ICON: Partial<Record<IconName, ArtName>> = Object.fromEntries([
  ...Object.entries(UNIT_ICONS).map(([key, icon]) => [icon, UNIT_ART[key]]),
  ...Object.entries(BUILDING_ICONS).map(([key, icon]) => [icon, BUILDING_ART[key as BuildingKey]]),
]) as Partial<Record<IconName, ArtName>>

/**
 * Die Farbe des Risses (D33.2).
 *
 * Die vier Besitzertoene sind dieselben wie beim Plaettchen, damit Karte und Liste
 * dasselbe sagen (R-UI-10). Dazu die beiden Faelle, in denen es gar keinen Besitzer
 * gibt: in der Rekrutierungsliste steht der Riss in `ink`, im Bauplatzraster das
 * Gebaeude in `building`.
 */
/**
 * `muted` ist der Ton fuer eine Sache, die es noch NICHT gibt (T-M34-08): die naechste
 * Freischaltung ueber der Aushebeliste. Er traegt dasselbe Token wie `other` und meint
 * etwas anderes — `other` ist eine fremde Macht auf der Karte. Zwei Namen fuer eine
 * Farbe sind in Ordnung; ein Name fuer zwei Bedeutungen waere es nicht.
 */
export type ArtTone = MarkerTone | 'ink' | 'building' | 'muted'

export interface UnitArtProps {
  name: ArtName
  /**
   * Der zugaengliche Name. Fehlt er, ist das Bild Schmuck und bleibt fuer
   * Vorleseprogramme unsichtbar — im Knopf steht der Name schon am Knopf.
   */
  label?: string
  tone?: ArtTone
  /** Breite in Pixeln; die Hoehe folgt dem Kasten 48 x 30 (D33.3). */
  width?: number
}

export function UnitArt({ name, label, tone = 'ink', width = 34 }: UnitArtProps) {
  const drawing = DRAWINGS[name]
  return (
    <svg
      className={`unit-art unit-art--${tone}`}
      width={width}
      height={(width * 30) / 48}
      viewBox="0 0 48 30"
      role={label ? 'img' : 'presentation'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {label && <title>{label}</title>}
      <path className="unit-art__body" d={drawing.body} />
      <path className="unit-art__cut" d={drawing.cut} />
    </svg>
  )
}
