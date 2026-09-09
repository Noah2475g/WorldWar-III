// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInitialState, parseRules, type Army, type GameState, type MapData } from '@worldwar/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialogs.tsx'
import { ActionRow, type Action } from './Panels.tsx'
import {
  armyActions,
  buildActions,
  cancelActions,
  capitalAction,
  diplomacyActions,
  recruitActions,
  targetAction,
  tradePreview,
  type ActionContext,
  type ActionSpec,
} from '../game/actions.ts'
import { DEFAULT_NEW_GAME, toConfig } from '../game/newGame.ts'

/**
 * Bedienbar ohne Maus (T-M16-07, R-UI-15, R-UI-06, Befund N12).
 *
 * Belegt war bisher der Kontrast und die Tastenzuordnung als reine Funktion. **Kein Test
 * hat je einen Dialog geoeffnet und wieder geschlossen** — also war das, was ein Mensch
 * ohne Maus tatsaechlich tut, nie geprueft. Eine Tastenzuordnung, die als Funktion
 * stimmt, sagt nichts darueber, ob der Fokus dort landet, wo er hingehoert.
 *
 * Kein Barrierefreiheits-Rahmenwerk und keine neue Abhaengigkeit: die Pruefung IST die
 * Zusage.
 */

afterEach(cleanup)

const zeige = (onClose = vi.fn()) => {
  render(
    <Dialog title="Beispiel" onClose={onClose}>
      <button type="button">Erster</button>
      <input aria-label="Feld" />
      <button type="button">Letzter</button>
    </Dialog>,
  )
  return onClose
}

describe('R-UI-15/AK1 Ein Dialog laesst sich mit der Tastatur bedienen', () => {
  it('setzt den Fokus beim Oeffnen in den Dialog', () => {
    zeige()

    const dialog = screen.getByRole('dialog', { name: 'Beispiel' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('schliesst mit Escape', () => {
    const onClose = zeige()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Beispiel' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalled()
  })

  it('gibt den Fokus beim Schliessen an das ausloesende Element zurueck', () => {
    // Sonst steht der Fokus nach dem Schliessen am Anfang der Seite, und wer ohne Maus
    // arbeitet, tabbt sich zurueck zu der Stelle, an der er schon war.
    const ausloeser = document.createElement('button')
    document.body.appendChild(ausloeser)
    ausloeser.focus()

    const { unmount } = render(
      <Dialog title="Beispiel" onClose={() => undefined}>
        <button type="button">Erster</button>
      </Dialog>,
    )
    unmount()

    expect(document.activeElement).toBe(ausloeser)
    ausloeser.remove()
  })

  it('springt vom letzten Feld zurueck zum ersten, statt hinter den Dialog', () => {
    // Der Fokusfang. `aria-modal` sagt einem Vorleseprogramm, dass dahinter nichts ist —
    // die Tabulatortaste hoert nicht darauf. Ohne Fang tabbt man aus einem modalen
    // Dialog in die Karte dahinter: sichtbar verdeckt, mit der Tastatur erreichbar und
    // bedienbar. Das ist der Fehler, den ein Sehender nie bemerkt.
    //
    // Geprueft wird der SPRUNG, nicht "der Fokus ist noch drin": jsdom bewegt bei Tab
    // von sich aus gar nichts, eine solche Pruefung waere auch ohne jeden Fang gruen.
    zeige()
    const dialog = screen.getByRole('dialog', { name: 'Beispiel' })
    const schliessen = screen.getByRole('button', { name: 'Schließen' })
    const letzter = screen.getByRole('button', { name: 'Letzter' })

    letzter.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(schliessen)

    schliessen.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(letzter)
  })
})

/**
 * Der Waechter zu AK2 — er liest den Quelltext, nicht einen Bildschirm.
 *
 * Ein Knopf ohne sichtbaren Text ist fuer ein Hilfsmittel namenlos; das Kreuz eines
 * Dialogs ist der Fall, an dem es zuerst auffaellt. Geprueft wird jede Datei, nicht die
 * eine, an die gerade jemand gedacht hat.
 */
describe('R-UI-15/AK2 Bedienelemente ohne Text tragen einen Namen', () => {
  const SRC = join(process.cwd(), 'apps/desktop/src')

  const dateien = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) dateien(full, out)
      else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full)
    }
    return out
  }

  /** Woerter, Ziffern und gewoehnliche Satzzeichen — daraus besteht ein lesbarer Name. */
  const LESBAR = /^[\p{L}\p{N}\s.,:!?—-]+$/u

  it('kennt keinen Knopf mit reinem Zeichen und ohne aria-label', () => {
    const verstoesse: string[] = []

    for (const file of dateien(SRC)) {
      const text = readFileSync(file, 'utf8')
      // Ein Knopf, der ganz auf einer Zeile steht und dessen Inhalt weder `t(…)` noch
      // ein anderer Ausdruck ist: also ein Zeichen wie × oder ‖. Mehrzeilige Knoepfe
      // tragen in diesem Haus immer `t(…)`, also einen Namen.
      for (const treffer of text.matchAll(/<button([^>\n]*)>([^<>{}\n]*)<\/button>/g)) {
        const attribute = treffer[1] ?? ''
        const inhalt = (treffer[2] ?? '').trim()
        if (!inhalt || LESBAR.test(inhalt)) continue
        if (attribute.includes('aria-label')) continue
        verstoesse.push(`${file.slice(SRC.length + 1)}: <button>${inhalt}</button>`)
      }
    }

    expect(verstoesse, verstoesse.join('\n')).toEqual([])
  })

  it('beisst, wenn ein Knopf seinen Namen verliert', () => {
    // Ein Waechter, der nur gruen sein kann, ist kein Waechter. Das Kreuz des Dialogs
    // ist der Fall, den er finden muss — hier ohne sein aria-label vorgefuehrt.
    const ohneNamen = '<button type="button" className="button" onClick={onClose}>×</button>'
    const treffer = [...ohneNamen.matchAll(/<button([^>\n]*)>([^<>{}\n]*)<\/button>/g)]

    expect(treffer).toHaveLength(1)
    expect(LESBAR.test(treffer[0]![2]!.trim())).toBe(false)
    expect(treffer[0]![1]!.includes('aria-label')).toBe(false)
  })
})

/**
 * Knoepfe sagen, was sie tun (T-M22-06, R-UI-06, Befund V2-13).
 *
 * Der Bauknopf hiess fuer ein Vorleseprogramm „Kaserne", der Aushebeknopf
 * „Infanterie" — die Sache, nie die Handlung. Ein Blinder hoert „Kaserne" und weiss
 * nicht, ob der Knopf baut, abreisst oder erklaert. Jeder Befehlsknopf traegt jetzt
 * einen zugaenglichen Namen mit Verb („Kaserne bauen"); Kosten bleiben im `title`.
 *
 * Geprueft werden ALLE Aktionen aus `actions.ts`, nicht die zwei, an die jemand
 * gedacht hat: eine neue Aktion ohne Verb faellt hier auf.
 */
describe('R-UI-06 Jeder Befehlsknopf traegt ein Verb', () => {
  const ROOT = process.cwd()
  const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
  const world = load('data/maps/world.json') as MapData
  const rules = parseRules(
    {
      constants: load('data/rules/default/constants.json'),
      resources: load('data/rules/default/resources.json'),
      buildings: load('data/rules/default/buildings.json'),
      units: load('data/rules/default/units.json'),
      ai: load('data/rules/default/ai.json'),
    },
    'default',
  )

  /** Die Verben des Hauses — ein Befehl, dessen Name keines traegt, ist ein Substantiv. */
  const VERB =
    /\b(bauen|ausheben|abbrechen|verlegen|erklären|anbieten|annehmen|aufkündigen|gewähren|teilen|zusammenlegen|marschieren|anhalten|beschießen|halten|freigeben|einnehmen|befehlen|handeln)\b/i

  function alleAktionen(): { ctx: ActionContext; specs: ActionSpec[] } {
    const state = createInitialState(
      toConfig({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', opponents: 3 }, world),
      { map: world, rules },
    )
    const capital = state.players.p1!.capitalProvinceId!
    const edge = world.edgesByProvince[capital]!.map((i) => world.edges[i]!).find((e) => e.kind === 'land')!
    const neighbour = edge.a === capital ? edge.b : edge.a

    // Eine Armee, damit auch die Armeebefehle in der Liste stehen.
    const army: Army = {
      id: 'a1',
      owner: 'p1',
      name: 'Armee 1',
      locationProvinceId: capital,
      units: [{ unitKey: 'infantry', hpTotal: 3000 }],
      path: [],
      arrivalTick: null,
      departureTick: null,
      deployDelayUntil: 0,
      stance: 'defensive',
      embarked: false,
      cannotAttackUntil: 0,
      bombardTarget: null,
      holdFire: false,
    }
    ;(state as GameState).armies[army.id] = army
    state.armyOrder = [...state.armyOrder, army.id]

    // Ein laufender Bau, damit auch der Abbrechen-Knopf in der Liste steht.
    state.provinces[capital]!.buildQueue = [
      { id: 'b1', building: 'barracks', startedTick: 0, completesAtTick: 24 },
    ] as never

    const ctx: ActionContext = { state, map: world, rules, playerId: 'p1', ticksPerDay: rules.constants.ticksPerDay }
    const specs = [
      ...buildActions(ctx, capital),
      ...recruitActions(ctx, capital),
      ...cancelActions(ctx, capital),
      capitalAction(ctx, capital),
      ...armyActions(ctx, 'a1'),
      targetAction(ctx, 'a1', 'move', neighbour),
      targetAction(ctx, 'a1', 'bombard', neighbour),
      ...diplomacyActions(ctx, state.playerOrder[1]!),
      tradePreview(ctx, 'wood', 1000, 'iron').action,
    ]
    return { ctx, specs }
  }

  it('gibt JEDER Aktion aus actions.ts einen Namen mit Verb', () => {
    const { specs } = alleAktionen()
    expect(specs.length).toBeGreaterThan(25)

    for (const spec of specs) {
      const name = spec.aria ?? spec.label
      expect(name, `"${spec.id}" heisst "${name}" — VERB OBJEKT fehlt (V2-13)`).toMatch(VERB)
    }
  })

  it('setzt den Verbnamen als aria-label an den Knopf; die Kosten bleiben im title', () => {
    const { specs } = alleAktionen()
    const barracks = specs.find((spec) => spec.id === 'build-barracks')!
    const action: Action = {
      id: barracks.id,
      label: barracks.label,
      ...(barracks.aria ? { aria: barracks.aria } : {}),
      ...(barracks.hint ? { hint: barracks.hint } : {}),
      disabledReason: barracks.disabledReason,
      onRun: () => undefined,
    }
    render(<ActionRow actions={[action]} />)

    const button = screen.getByRole('button', { name: 'Kaserne bauen' })
    expect(button.textContent, 'sichtbar bleibt die kurze Beschriftung').toBe('Kaserne')
    expect(button.getAttribute('title'), 'die Kosten bleiben im Tooltip').toContain('Material')
  })
})
