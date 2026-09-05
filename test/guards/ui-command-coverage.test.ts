import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './scan'

/**
 * Was der Kern kann, muss der Spieler erreichen (T-M14-13).
 *
 * Das Muster, das dieses Projekt viermal getroffen hat: eine Fähigkeit ist im Kern
 * gebaut, getestet, benannt — und von keinem Element der Oberfläche erreichbar. Zuerst
 * bot die Provinzleiste nur „Kaserne bauen" (M12), dann waren Symbole, Ton und
 * Einstiegshilfe nicht eingebunden (M13), dann fehlte der Rückzug, und `CANCEL_BUILD`
 * existiert seit M3 ohne einen einzigen Knopf.
 *
 * Der bestehende Erreichbarkeitswächter (`ui-reachability`) prüft **Module**: erreicht die
 * Importkette ab `main.tsx` diese Datei? Das ist zu grob — `game/actions.ts` ist
 * erreichbar, und trotzdem fehlt darin die Hälfte der Befehle. Dieser Wächter prüft
 * stattdessen **jeden im Kern registrierten Kommandotyp** und jede Variante der
 * Haltungen: Kommt er in dem Modul vor, das die Befehle der Oberfläche erzeugt?
 *
 * Er kann nicht beweisen, dass ein Knopf sichtbar ist — dafür gibt es die Tests in
 * `actions.test.ts` und den Blick ins laufende Programm. Er beweist das Gegenteil:
 * dass ein Befehl **gar nicht** vorkommt, und das ist der Fall, der viermal eingetreten ist.
 */

/** Jeder Kommandotyp, den der Kern registriert. */
function coreCommands(): string[] {
  const dir = join(ROOT, 'packages/core/src/commands')
  const found = new Set<string>()
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue
    const text = readFileSync(join(dir, entry), 'utf8')
    for (const match of text.matchAll(/registerCommand<[^>]*>\(\s*'([A-Z_]+)'/g)) {
      found.add(match[1]!)
    }
  }
  return [...found].sort()
}

/** Alles, was die Oberfläche an Befehlen erzeugen kann. */
function uiCommandSource(): string {
  const files = [
    'apps/desktop/src/game/actions.ts',
    'apps/desktop/src/App.tsx',
    'apps/desktop/src/game/newGame.ts',
  ]
  return files.map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n')
}

/**
 * Befehle, die der Spieler nicht selbst gibt — mit Grund.
 *
 * Eine Ausnahme ohne Begründung ist eine Lücke mit Erlaubnis; deshalb steht der Grund
 * hier und nicht in einer Liste von Namen.
 */
const NICHT_FUER_DEN_SPIELER: Record<string, string> = {
  SET_CAPITAL:
    'Die Hauptstadtverlegung erreicht die Oberflaeche ueber die Provinzleiste (provinceActions), nicht ueber actions.ts als eigener Befehlstyp.',
}

describe('R-UI-05 Jeder Befehl des Kerns ist fuer den Spieler erreichbar', () => {
  it('findet ueberhaupt Kommandotypen', () => {
    // Ein Waechter ueber einer leeren Menge ist immer gruen (Befund N1).
    expect(coreCommands().length).toBeGreaterThanOrEqual(10)
  })

  it('erzeugt die Oberflaeche jeden Kommandotyp des Kerns', () => {
    const source = uiCommandSource()
    const fehlend = coreCommands()
      .filter((type) => !NICHT_FUER_DEN_SPIELER[type])
      .filter((type) => !new RegExp(`['"\`]${type}['"\`]`).test(source))

    expect(
      fehlend,
      `Diese Befehle kann der Kern, aber der Spieler erreicht sie nicht:\n${fehlend.join('\n')}`,
    ).toEqual([])
  })

  it('benutzt die Anwendung jede Aktionsliste, die sie baut', () => {
    // Der Fall, den dieser Wächter beim eigenen Bau fast selbst produziert hätte:
    // `cancelActions` war geschrieben, exportiert und in `App.tsx` nirgends aufgerufen.
    // Ein Befehl, der als Text in einer Datei steht, ist noch kein Knopf — genau das
    // war der Befund von M13 („die Panels existierten, nur die Befehle darin fehlten").
    const actions = readFileSync(join(ROOT, 'apps/desktop/src/game/actions.ts'), 'utf8')
    const app = readFileSync(join(ROOT, 'apps/desktop/src/App.tsx'), 'utf8')

    const exported = [...actions.matchAll(/export function (\w*[Aa]ctions?)\(/g)].map((m) => m[1]!)
    expect(exported.length, 'keine Aktionslisten gefunden').toBeGreaterThan(3)

    const ungenutzt = exported.filter((name) => !new RegExp(`\\b${name}\\s*\\(`).test(app))
    expect(
      ungenutzt,
      `Diese Aktionslisten baut niemand in die Oberflaeche ein:\n${ungenutzt.join('\n')}`,
    ).toEqual([])
  })

  it('bietet jede Haltung an, nicht nur zwei von drei', () => {
    // Der Fall, der die Aufzaehlung betrifft: `SET_STANCE` kam in actions.ts vor, aber
    // nur mit 'aggressive' und 'defensive'. Der Rueckzug war der einzige Kampfbefehl,
    // den die KI geben konnte und der Spieler nicht.
    const stances = readFileSync(join(ROOT, 'packages/core/src/state/types.ts'), 'utf8')
      .match(/export type Stance =([^\n]+)/)?.[1]
      ?.match(/'(\w+)'/g)
      ?.map((entry) => entry.replaceAll("'", ''))

    expect(stances, 'Stance-Typ nicht gefunden').toBeTruthy()
    const source = uiCommandSource()
    const fehlend = stances!.filter((stance) => !new RegExp(`['"\`]${stance}['"\`]`).test(source))

    expect(fehlend, `Haltungen ohne Knopf: ${fehlend.join(', ')}`).toEqual([])
  })
})
