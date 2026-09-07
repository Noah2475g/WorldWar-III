import { de } from './de.ts'

/**
 * Beugung aus den Tabellen der Sprachdatei (T-M23-02, R-UI-07, Befund V2-11).
 *
 * Drei gemessene Fehler hatten dieselbe Wurzel: ein Satz, der sich nach seinem
 * Gegenstand richten muss, kannte den Gegenstand nicht. „Sie können **es** jetzt
 * bauen" über der Kaserne (Genus), „Vereinigte Staaten **erklärt**" (Numerus) — die
 * Tabellen dazu stehen in `de.ts` beim übrigen Deutsch; hier steht nur der Zugriff.
 *
 * Unbekannte Schlüssel fallen auf das Neutrum bzw. die Einzahl zurück — das ist der
 * Zustand von vor der Reparatur, nicht schlimmer. Damit der Rückfall nie eintritt,
 * bindet `grammar.test.ts` beide Tabellen an die Namenslisten des Katalogs.
 */

export type Genus = 'f' | 'm' | 'n'

const GENUS: Record<'buildings' | 'units', Readonly<Record<string, string>>> = {
  buildings: de.grammar.buildings,
  units: de.grammar.units,
}

/** Das Genus einer benannten Sache; unbekannte gelten als sächlich. */
export function genusOf(kind: 'buildings' | 'units', key: string): Genus {
  const genus = GENUS[kind][key]
  return genus === 'f' || genus === 'm' ? genus : 'n'
}

/** „sie", „ihn" oder „es" — das Akkusativpronomen zur Sache. */
export function accusativePronoun(kind: 'buildings' | 'units', key: string): string {
  return de.grammar.pronoun[genusOf(kind, key)]
}

/** Ist dieser Machtname grammatisch Mehrzahl („Vereinigte Staaten erklären …")? */
export function isPluralNation(name: string): boolean {
  return (de.grammar.pluralNations as readonly string[]).includes(name)
}
