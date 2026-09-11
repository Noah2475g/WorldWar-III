/**
 * The icon set (T-M11-01, R-UI-04/R-ASSET-01).
 *
 * Drawn here as inline SVG rather than shipped as files, and drawn from the vocabulary
 * of military situation maps: a rectangle with a diagonal cross is infantry, an oval is
 * armour, a chevron is artillery. That vocabulary is a public convention, not a work —
 * which is exactly why it can be used at all (R-ASSET-01: nothing taken from anyone).
 *
 * Inline because these are shapes, not pictures: a dozen paths cost less than a dozen
 * requests, they take their colour from the surrounding text, and they scale with the
 * font setting without a second asset.
 */

import type { BuildingKey, DiplomaticState, Terrain } from '@worldwar/core'

export type IconName =
  | 'infantry'
  | 'motorized'
  | 'armour'
  | 'heavyArmour'
  | 'artillery'
  | 'rocket'
  | 'aircraft'
  | 'bomber'
  | 'ship'
  | 'transport'
  | 'barracks'
  | 'factory'
  | 'harbour'
  | 'shipyard'
  | 'airfield'
  | 'fortress'
  | 'railway'
  | 'battle'
  | 'capital'
  | 'warning'
  | 'food'
  | 'wood'
  | 'iron'
  | 'coal'
  | 'oil'
  | 'rare'
  | 'money'
  | 'peace'
  | 'war'
  | 'truce'
  | 'alliance'
  | 'rightOfWay'
  | 'sharedMap'
  | 'queue'
  | 'mountain'
  | 'plains'
  | 'desert'
  | 'forest'
  | 'urban'
  | 'entrenched'
  | 'noRetreat'
  | 'clock'
  | 'pause'
  | 'fastForward'

export interface IconProps {
  name: IconName
  size?: number
  title?: string
}

/** Every icon is drawn in a 24×24 box, so they line up without per-icon nudging. */
const PATHS: Record<IconName, string> = {
  // Sanduhr — was bezahlt ist und noch entsteht (T-M22-02, "In Auftrag").
  queue: 'M6 4h12 M6 20h12 M8 4v2.5L12 11l4-4.5V4 M8 20v-2.5L12 13l4 4.5V20',
  // Rectangle with a diagonal cross — infantry, as on any situation map.
  infantry: 'M3 7h18v10H3z M3 7l18 10 M21 7L3 17',
  // The same rectangle on wheels — motorised infantry.
  motorized: 'M3 5h18v9H3z M3 5l18 9 M21 5L3 14 M7 18.4a1.6 1.6 0 1 0 0 .01 M17 18.4a1.6 1.6 0 1 0 0 .01',
  // Oval — armour.
  armour: 'M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0',
  // Oval with a bar through it — heavy armour.
  heavyArmour: 'M3 12a9 5 0 1 0 18 0a9 5 0 1 0-18 0 M6 12h12',
  // Chevron with a dot — artillery.
  artillery: 'M3 17h18 M6 17l6-9 6 9 M12 5.5a1.2 1.2 0 1 0 0 .01',
  // Chevron under a rising arrow — rocket artillery.
  rocket: 'M3 19h18 M6 19l6-7 6 7 M12 3v6 M9.8 5.2L12 3l2.2 2.2',
  // Wing shape — air.
  aircraft: 'M12 3l3 8h6l-6 4 2 6-5-4-5 4 2-6-6-4h6z',
  // Seen from above, two engines — the bomber, told apart from the fighter at a glance.
  bomber: 'M2 12h20 M12 4v16 M7 9.5v5 M17 9.5v5',
  // Hull and mast — sea.
  ship: 'M3 16h18l-2 4H5z M12 4v10 M12 6l6 3-6 2z',
  // Hull with a crate — the transport.
  transport: 'M3 16h18l-2 4H5z M7 8h10v6H7z M12 8v6',
  barracks: 'M4 20V9l8-5 8 5v11z M9 20v-6h6v6',
  factory: 'M3 20V11l5 3V11l5 3V6l8 5v9z M7 16h2 M13 16h2',
  harbour: 'M12 4v14 M8 8h8 M5 14a7 7 0 0 0 14 0 M12 2.5a1.4 1.4 0 1 0 0 .01',
  // A crane over a hull — the shipyard, which the set had no answer for at all.
  shipyard: 'M4 20h16 M6 20V5h9 M15 5l3 6 M8 12h6',
  // Landebahn mit Halle — der Flugplatz (T-M12-10). Er teilte sich bis zum 2026-09-07
  // die Tragflaeche mit dem Jagdflugzeug, und ein Gebaeude, das aussieht wie eine
  // Einheit, ist in einer Bauliste genau die falsche Auskunft. Ein Ort wird von der
  // Seite gezeigt wie Hafen und Werft, kein Fluggeraet.
  airfield: 'M3 20h18 M4 17h16 M6 17v-4h6l2 4 M7 13V9h4v4',
  fortress: 'M4 20V8h3V5h3v3h4V5h3v3h3v12z M10 20v-5h4v5',
  railway: 'M4 8h16 M4 16h16 M8 4v16 M16 4v16',
  // Crossed sabres — a battle.
  battle: 'M5 5l14 14 M19 5L5 19 M4 4l3 1 M20 4l-3 1',
  // Star in a circle — a capital.
  capital: 'M12 3l2.4 5.5 6 .5-4.5 4 1.4 5.9L12 15.8 6.7 18.9l1.4-5.9-4.5-4 6-.5z',
  // Triangle with a bar — a warning.
  warning: 'M12 4l9 16H3z M12 10v5 M12 17.4a.6.6 0 1 0 0 .01',
  // The seven resources. Drawn as things, not as letters: a row of symbols is only
  // faster to read than a row of words if it is not itself a word.
  //
  // Neu gezeichnet in T-M36-01 (ROHSTOFFE.md D36.1), wortgleich aus
  // `docs/design/rohstoffleiste.html` Abschnitt 1b. Der alte Satz scheiterte an der
  // einzigen Groesse, in der er vorkommt: bei vierzehn Pixeln las die Nahrung als „Y",
  // Eisen und Kohle waren zwei aehnlich grosse Klumpen, und das Material trug einen
  // Nadelbaum, obwohl es seit T-M23-01 nicht mehr Holz heisst. Der beschlossene Satz
  // ist Fassung 1 mit Eisen, Kohle, Oel und Seltenen Erden aus Fassung 2; nachgemessen
  // bei 14 px ueber alle 21 Paare liegt sein engstes Paar (Kohle/Oel) bei 0,127 gegen
  // 0,104 heute. Die Zahl belegt unterscheidbar, nicht erkennbar — dafuer war die
  // Sichtpruefung da.
  //
  // Aehre: ein Halm, sechs Koerner. Schmal und hoch — nichts sonst im Satz sieht so aus.
  food: 'M12 21v-9 M12 12.5l3.6-2.6 M12 12.5L8.4 9.9 M12 16l3.6-2.6 M12 16l-3.6-2.6 M12 9l3-2.4 M12 9L9 6.6',
  // Balkenstapel: drei Lagen, unten breit. Ein Stapel, kein Baum.
  wood: 'M3 16.5h18v4.5H3z M5 12h14v4.5H5z M8 7.5h8V12H8z',
  // Zwei gestapelte Barren, versetzt — flach gegen den kantigen Brocken der Kohle.
  iron: 'M6 19.5h14l-2.5-5.5h-9z M3 13h14l-2.5-5.5h-9z',
  // Brocken mit Facetten, kantig statt rund.
  coal: 'M4.5 14.5l3.5-6 5-2 6 4.5-2 8H7z M12.5 6.5l1.5 6 5.5-.5 M12.5 12.5L7 20.5',
  // Der Tropfen. Er war schon richtig und bleibt deshalb, wie er war.
  oil: 'M12 4c3.5 5 5.5 7.5 5.5 10.5a5.5 5.5 0 0 1-11 0C6.5 11.5 8.5 9 12 4z',
  // Zwei Kristalle nebeneinander, verschieden hoch — der einzelne war zu nah am Barren.
  rare: 'M8 9l3.5 3-3.5 9-3.5-9z M4.5 12h7 M16 6l4 3.5-4 11.5-4-11.5z M12 9.5h8',
  // Muenzstapel: drei Lagen. Eine einzelne Scheibe sah aus wie ein Knopf.
  money: 'M5 7.5a7 2.6 0 1 0 14 0a7 2.6 0 1 0-14 0 M5 7.5v4.2a7 2.6 0 0 0 14 0V7.5 M5 11.7v4.2a7 2.6 0 0 0 14 0v-4.2',
  // Die sechs Beziehungen (T-M20-01, R-UI-10). Sie erzaehlen eine Reihe: eine Grenze,
  // die haelt — eine, die gebrochen ist — die Fahne, die das Feuer einstellt — der
  // gemeinsame Ring — der Durchgang — das geteilte Auge.
  // Grenze mit zwei Pfosten: kein Krieg, kein Buendnis.
  peace: 'M4 12h16 M4 8.5v7 M20 8.5v7',
  // Dieselbe Grenze, in der Mitte durchbrochen und durchstossen.
  war: 'M4 12h5 M15 12h5 M4 8.5v7 M20 8.5v7 M9.5 7.5l5 9 M14.5 7.5l-5 9',
  // Fahne am Mast — die Kampfpause auf Zeit.
  truce: 'M6 21V3 M6 4.5h11l-2.6 3.6L17 12H6',
  // Zwei ineinandergreifende Ringe — gemeinsame Sache.
  alliance: 'M6 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M10 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  // Pfeil zwischen zwei Pfosten — Durchmarsch ohne Kriegserklaerung.
  rightOfWay: 'M6 4v16 M18 4v16 M3 12h13 M13 9l3 3-3 3',
  // Auge — beide sehen, was der andere sieht.
  sharedMap: 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8',
  // Die fuenf Gelaendearten (T-M20-01, R-UI-11). Von der Seite gesehen, wie eine
  // Gelaendeschnittzeichnung — nicht von oben wie die Karte selbst, damit sie sich von
  // den Provinzflaechen unterscheiden, auf denen sie stehen.
  mountain: 'M2 19l6.5-11 4 6.5 2.5-3.5 7 8z M8.5 8l2.2 3.7h-4.4z',
  // Zwei Horizonte und ein paar Halme — offenes Land.
  plains: 'M3 15.5h18 M3 20h18 M8 15.5v-3 M12 15.5v-4.5 M16 15.5v-3',
  // Duene unter der Sonne.
  desert: 'M2.5 19c4.5 0 5-5 9.5-5s5 5 9.5 5 M12 3.5a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2',
  // Zwei Nadelbaeume — nicht einer, sonst waere es der Rohstoff Holz.
  forest: 'M7.5 5l3 4.5H8.5l2.6 4H3.9l2.6-4H4.5z M7.5 13.5V19 M16.5 9l2.4 3.6h-1.7l2.1 3.4h-5.6l2.1-3.4h-1.7z M16.5 16V19',
  // Haeuserzeile — dichte Bebauung.
  urban: 'M3.5 20V11h5v9 M8.5 20V5h6.5v15 M15 20v-6h5.5v6 M5.5 14h1 M11 9h2 M17.5 17h1',
  // Die zwei Umstaende des Kampfberichts (T-M27-02, R-UI-10). Der Stellungsbogen der
  // Lagekarte — eine eingegrabene Stellung, von der Seite geschnitten.
  entrenched: 'M4 19v-4a8 8 0 0 1 16 0v4 M2.5 19h19',
  // Pfeil zurueck, der an der Sperre endet — die Rueckzugssperre nach D6.8.
  noRetreat: 'M6 4v16 M20 12H10 M13.5 8.5L10 12l3.5 3.5',
  // Die Kopfleiste im Kriegsrat (T-M29-02): Uhr, Pause, Vorspulen.
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17 M12 7v5l3.5 2',
  pause: 'M8 5v14 M16 5v14',
  fastForward: 'M4 6l8 6-8 6z M12 6l8 6-8 6z',
}

export function Icon({ name, size = 16, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}

/**
 * Which icon stands for which unit, so the map and the panels agree.
 *
 * The keys are the keys of `data/rules/default/units.json` — exactly those, no more.
 * The first version of this table answered to "cavalry" and "submarine", which the
 * rules never had, and had nothing to say for "motorized" or "heavy_tank", which they
 * do: half the army drew no symbol at all, and a test that only compared the table
 * against itself called that complete.
 */
export const UNIT_ICONS: Record<string, IconName> = {
  infantry: 'infantry',
  motorized: 'motorized',
  tank: 'armour',
  heavy_tank: 'heavyArmour',
  artillery: 'artillery',
  rocket_artillery: 'rocket',
  fighter: 'aircraft',
  bomber: 'bomber',
  destroyer: 'ship',
  transport: 'transport',
}

export const BUILDING_ICONS: Record<string, IconName> = {
  barracks: 'barracks',
  fortress: 'fortress',
  factory: 'factory',
  harbour: 'harbour',
  shipyard: 'shipyard',
  airfield: 'airfield',
  railway: 'railway',
}

/** And one per resource, for the header bar and the deposits row. */
export const RESOURCE_ICONS: Record<string, IconName> = {
  food: 'food',
  wood: 'wood',
  iron: 'iron',
  coal: 'coal',
  oil: 'oil',
  rare: 'rare',
  money: 'money',
}

/**
 * Die Reihenfolge der Gebaeude — fuer die Bauplaetze im Panel (T-M29-03) und die Anker
 * auf der Karte (T-M30-02). Eine Reihenfolge, zwei Ausgaben: ein Bau verschiebt die
 * anderen nirgends.
 */
export const BUILDING_ORDER = Object.keys(BUILDING_ICONS) as BuildingKey[]

/**
 * The raw drawings, for anything that is not React.
 *
 * The map draws the same symbols onto a canvas through Path2D — one set of shapes for
 * the whole game, so a unit looks the same in the panel and on the map because it is
 * literally the same path (R-UI-10).
 */
export const ICON_PATHS: Readonly<Record<IconName, string>> = PATHS

/** Every icon name, for the test that keeps the set complete. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[]

/**
 * Ein Zeichen je Beziehungszustand (T-M20-01, R-UI-10).
 *
 * R-UI-10 nennt den Beziehungszustand im Anforderungstext, und bis zum 2026-09-07 stand
 * er als deutsches Wort da. Unbemerkt blieb das, weil R-UI-10/AK1 nur nach Gebaeude und
 * Einheit fragt — ein Kriterium, das einen Teil des Versprechens prueft und den Rest
 * erfuellt aussehen laesst.
 *
 * Vier davon sind Zustaende (`DiplomaticState`), zwei sind Rechte, die dazukommen
 * koennen. Der Typ unten haelt beides zusammen, damit der Compiler einen neuen Zustand
 * meldet, statt ihn still ohne Zeichen zu lassen.
 */
export const RELATION_ICONS: Record<DiplomaticState | 'rightOfWay' | 'sharedMap', IconName> = {
  peace: 'peace',
  war: 'war',
  truce: 'truce',
  alliance: 'alliance',
  rightOfWay: 'rightOfWay',
  sharedMap: 'sharedMap',
}

/** Und eines je Gelaendeart (T-M20-01, R-UI-11). Die Karte kennt genau diese fuenf. */
export const TERRAIN_ICONS: Record<Terrain, IconName> = {
  plains: 'plains',
  forest: 'forest',
  mountain: 'mountain',
  desert: 'desert',
  urban: 'urban',
}
