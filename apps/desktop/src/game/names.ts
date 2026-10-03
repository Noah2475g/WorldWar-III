/**
 * Namensauflösung an einer Stelle (T-M44-02b, Nahtstelle für R-UX-03/AK2).
 *
 * Bis hierher stand dieselbe Auflösung an neun Stellen in `App.tsx` — `activeMap.provinces.find(…)?.name
 * ?? id`, `state.armies[id]?.name ?? id`, `state.players[id]?.nation ?? id` —, jede mit demselben
 * Rückfall auf die Kennung. R-UX-03/AK2 will genau diesen Rückfall ändern („eine Armee“ statt
 * „a68“); wer das tut, ändert **diese Datei** und nicht neun Zeilen in der größten Datei des
 * Projekts. Diese Fassung ändert nichts: der Rückfall ist weiter die Kennung, und der Test
 * hält fest, dass jede Funktion dasselbe liefert wie der Ausdruck, den sie ersetzt.
 *
 * Rein: keine Reactkenntnis, keine Zustandskenntnis. `App.tsx` baut die Auflöser mit `useMemo`
 * über den jeweiligen Bestand; die Anzahl der Aufrufe und ihre Reihenfolge bleiben dieselben.
 */

/** Ein Eintrag mit Namen — so viel muss eine Provinzliste der Karte können. */
export interface NamedProvince {
  readonly id: string
  readonly name: string
}

/** Löst eine Kennung in den Namen auf, den der Spieler liest. */
export type Namer = (id: string) => string

/** Provinzname aus der Kartenliste; unbekannt heißt heute: die Kennung. */
export function provinceNamer(provinces: readonly NamedProvince[]): Namer {
  return (id) => provinces.find((province) => province.id === id)?.name ?? id
}

/** Armeename aus dem Spielstand; unbekannt heißt heute: die Kennung. */
export function armyNamer(armies: Readonly<Record<string, { readonly name: string } | undefined>>): Namer {
  return (id) => armies[id]?.name ?? id
}

/** Nationenname einer Macht; unbekannt heißt heute: die Kennung. */
export function nationNamer(players: Readonly<Record<string, { readonly nation: string } | undefined>>): Namer {
  return (id) => players[id]?.nation ?? id
}
