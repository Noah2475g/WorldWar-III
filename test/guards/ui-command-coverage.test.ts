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
  OFFER_TRADE:
    'Bis T-M17-14 (Oberflaeche Handel, R-DIP-07): der Kern nimmt Handelsangebote mit Treuhand an (T-M17-05, R-DIP-05); das Angebotsformular im Diplomatiepanel kommt mit T-M17-14. T-M17-14 streicht diesen Eintrag.',
  ACCEPT_TRADE:
    'Bis T-M17-14 (Oberflaeche Handel, R-DIP-07): das Angebot steht schon in publicView().tradeOffers.incoming; Knopf und Meldung kommen mit T-M17-14. T-M17-14 streicht diesen Eintrag.',
  DECLINE_TRADE:
    'Bis T-M17-14 (Oberflaeche Handel, R-DIP-07): Ablehnen kommt mit der Liste eingehender Angebote. T-M17-14 streicht diesen Eintrag.',
  WITHDRAW_TRADE:
    'Bis T-M17-14 (Oberflaeche Handel, R-DIP-07): Zuruecknehmen kommt mit der Liste ausgehender Angebote. T-M17-14 streicht diesen Eintrag.',
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

  it('kennt keine veraltete Ausnahme — ein Befehl mit Knopf braucht keine (T-M17-13)', () => {
    // Dasselbe Muster wie bei DIPLOMATIE_NOCH_OHNE_KNOPF (unten): eine Ausnahme, die
    // niemand mehr braucht, ist so falsch wie eine fehlende — sie behauptet eine Luecke,
    // die es nicht mehr gibt. RECRUIT_SPY, REASSIGN_SPY, DISMISS_SPY und SET_CAPITAL
    // waren hier drei Aufgaben lang berechtigt und sind es seit T-M17-13 nicht mehr.
    const core = coreCommands()
    const source = uiCommandSource()
    const erreicht = (type: string) => new RegExp(`['"\`]${type}['"\`]`).test(source)

    const veraltet = Object.keys(NICHT_FUER_DEN_SPIELER).filter(
      (type) => !core.includes(type) || erreicht(type),
    )
    expect(veraltet, `Veraltete Ausnahmen: ${veraltet.join(', ')}`).toEqual([])
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

  it('bietet jede diplomatische Aktion an — oder nennt die Aufgabe, die sie bringt (T-M17-04)', () => {
    // Derselbe Fall wie bei den Haltungen, eine Ebene tiefer: `DIPLOMACY` ist EIN Kommandotyp
    // und kommt in actions.ts vor, also war der Test oben fuer jede neue Aktion darin gruen.
    // T-M17-04 brachte drei (Antrag, Annahme, Kuendigung des Durchmarschs), und keine davon
    // hatte einen Knopf — der Waechter haette es nie gesehen.
    const aktionen = readFileSync(join(ROOT, 'packages/core/src/commands/types.ts'), 'utf8')
      .match(/export type DiplomacyAction =([\s\S]*?)\n\n/)?.[1]
      ?.match(/'(\w+)'/g)
      ?.map((entry) => entry.replaceAll("'", ''))

    expect(aktionen, 'DiplomacyAction nicht gefunden').toBeTruthy()
    expect(aktionen!.length, 'zu wenige Aktionen gefunden — liest der Waechter noch den Typ?').toBeGreaterThanOrEqual(11)
    const source = uiCommandSource()
    const erreicht = (aktion: string) => new RegExp(`['"\`]${aktion}['"\`]`).test(source)

    const fehlend = aktionen!.filter((aktion) => !DIPLOMATIE_NOCH_OHNE_KNOPF[aktion] && !erreicht(aktion))
    expect(fehlend, `Diplomatische Aktionen ohne Knopf: ${fehlend.join(', ')}`).toEqual([])

    // Und umgekehrt: eine Ausnahme fuer eine Aktion, die es nicht gibt oder die schon einen Knopf
    // hat, ist veraltet. So muss T-M17-14 die Zeile streichen, wenn es die Knoepfe baut.
    const veraltet = Object.keys(DIPLOMATIE_NOCH_OHNE_KNOPF).filter(
      (aktion) => !aktionen!.includes(aktion) || erreicht(aktion),
    )
    expect(veraltet, `Veraltete Ausnahmen: ${veraltet.join(', ')}`).toEqual([])
  })
})

/**
 * Diplomatische Aktionen, die der Kern schon kann und die Oberflaeche noch nicht anbietet — mit
 * der Aufgabe, die sie bringt (T-M17-04). Dieselbe Regel wie `NICHT_FUER_DEN_SPIELER`: eine
 * Ausnahme ohne Grund ist eine Luecke mit Erlaubnis.
 */
const DIPLOMATIE_NOCH_OHNE_KNOPF: Record<string, string> = {
  requestRightOfWay:
    'Antrag auf Durchmarsch (R-DIP-08/AK2). Der Knopf kommt mit T-M17-14 ins Diplomatiepanel; bis dahin beantragt nur ein Skript, ab T-M17-10 die KI.',
  acceptRightOfWay:
    'Annahme eines Antrags (R-DIP-08/AK2). Der Antrag steht schon in incomingOffers; Knopf und Meldung kommen mit T-M17-14.',
  revokeRightOfWay:
    'Kuendigung mit Frist (R-DIP-08/AK3). Der Knopf kommt mit T-M17-14; das Ereignis RIGHT_OF_WAY_CHANGED steht schon im Protokoll.',
}
