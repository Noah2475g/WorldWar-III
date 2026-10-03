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

import { t } from '../i18n/text.ts'

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

/**
 * Der Namensspeicher der Armeen (T-M44-06, R-UX-03/AK2).
 *
 * Eine vernichtete Armee steht nicht mehr im Spielstand, ihre Meldung („a68 ist vernichtet.“) schon
 * — und las bis hierher die Kennung. Der Speicher hält den **letzten bekannten Namen** jeder Armee,
 * die der Spieler je in diesem Stand gesehen hat. Er gehört zu einer Partie: nach dem Laden eines
 * Standes und bei jeder neuen Partie wird er **bewusst geleert** (ein geladener Stand kennt die
 * Armeen nicht, die vor dem Speichern fielen, und gleiche Kennungen zweier Partien dürfen sich nicht
 * Namen leihen) — was dann unbekannt ist, heißt „eine Armee“.
 */
export interface ArmyNameMemory {
  /** Merkt sich den Namen jeder Armee des Bestandes. */
  remember(armies: Readonly<Record<string, { readonly name: string } | undefined>>): void
  /** Der zuletzt gemerkte Name, oder `undefined`. */
  recall(id: string): string | undefined
  /** Vergisst alles (neue Partie, Laden). */
  reset(): void
}

export function createArmyNameMemory(): ArmyNameMemory {
  const names = new Map<string, string>()
  return {
    remember(armies) {
      for (const [id, army] of Object.entries(armies)) if (army) names.set(id, army.name)
    },
    recall: (id) => names.get(id),
    reset: () => names.clear(),
  }
}

/**
 * Armeename aus dem Spielstand; sonst der gemerkte Name; sonst „eine Armee“ — nie die Kennung.
 * LOESCHVERMERK (Review): bis T-M44-06 lautete der Rückfall `?? id` („a68 ist vernichtet.“).
 */
export function armyNamer(
  armies: Readonly<Record<string, { readonly name: string } | undefined>>,
  memory?: ArmyNameMemory,
): Namer {
  memory?.remember(armies)
  return (id) => armies[id]?.name ?? memory?.recall(id) ?? t('names.unknownArmy')
}

/** Nationenname einer Macht; unbekannt heißt heute: die Kennung. */
export function nationNamer(players: Readonly<Record<string, { readonly nation: string } | undefined>>): Namer {
  return (id) => players[id]?.nation ?? id
}
