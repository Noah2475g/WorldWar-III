import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  RESOURCE_KEYS,
  canApply,
  eventsFor,
  publicView,
  type Command,
  type GameState,
  type MapData,
  type Rules,
  type StoragePort,
} from '@worldwar/core'
import { advance } from './game/advance.ts'
import {
  armyActions,
  buildActions,
  capitalAction,
  diplomacyActions,
  ownArmiesIn,
  planArrival,
  recruitActions,
  targetAction,
  tradePreview,
  unitCounts,
  type ActionContext,
  type ActionSpec,
} from './game/actions.ts'
import { describeRejection } from './game/rejections.ts'
import { t } from './i18n/text.ts'
import { INITIAL_UI, uiReducer, type Settings } from './state/uiState.ts'
import { MapCanvas, type ArmyMarker } from './map/MapCanvas.tsx'
import { dominantIcon } from './map/markers.ts'
import { strengthByProvince } from './map/modes.ts'
import { boundsOf, centreOn, clampView } from './map/picking.ts'
import { Header } from './ui/Header.tsx'
import {
  ArmyPanel,
  DiplomacyPanel,
  EconomyPanel,
  EventLog,
  MarketPanel,
  ProvincePanel,
  ProvincePicker,
  type Action,
  type ActionGroupSpec,
  type EventEntry,
  type Targeting,
} from './ui/Panels.tsx'
import { DebugPanel, KeyboardHelp, NewGameDialog, SavesDialog, SettingsDialog, fontScaleStyle } from './ui/Dialogs.tsx'
import { DEFAULT_NEW_GAME, aiBonusPercent, startGame, type NewGameOptions } from './game/newGame.ts'
import { PAN_STEP, isTypingTarget, resolveKey } from './keyboard.ts'
import { describeEvent } from './game/events.ts'
import { MemoryStorage } from '@worldwar/core'
import { UNIT_ICONS } from './ui/icons.tsx'
import type { IconItem } from './ui/IconRow.tsx'
import { Tutorial } from './ui/Tutorial.tsx'
import { Legend } from './ui/Legend.tsx'
import { StandingsPanel, VictoryDialog } from './ui/Standings.tsx'
import { Alerts, alertsFor } from './ui/Alerts.tsx'
import { cueForEvents, play } from './ui/sound.ts'
import {
  TUTORIAL_OFF,
  TUTORIAL_STORAGE_KEY,
  advance as advanceTutorial,
  dismiss as dismissTutorial,
  initialTutorial,
  type TutorialState,
  type TutorialStep,
} from './game/tutorial.ts'
import { autosaveDue, listSlots, loadFrom, saveTo, type SlotInfo } from './game/saves.ts'
import { writeAutosave, type AutosaveState } from '@worldwar/core'

/**
 * The game, assembled (T-M10-03 … T-M10-12).
 *
 * The simulation runs here in the same thread rather than in the worker: SimHost and
 * the worker shell are built and tested (T-M10-02), but wiring a worker into a Vite
 * build is a packaging question that belongs with T-M11-03, and the interactive
 * speeds hold comfortably either way — a tick on the world map costs 2.8 ms against a
 * 16 ms frame.
 *
 * Every order the player can give comes from `game/actions.ts` as data; this file only
 * turns descriptions into buttons and buttons into commands. An order that needs a
 * place on the map — a march, a bombardment — puts the panel into target mode: the
 * next click on the map (or a pick from the list) names the target, the panel says
 * when the army would arrive, and only then is the order given.
 */

export interface AppProps {
  map: MapData
  rules: Rules
  maps: readonly { id: string; name: string; provinces: number }[]
  /** Where saves go. Memory by default; the packaged app passes a file-system port. */
  storage?: StoragePort
  /**
   * Where sound comes from. The browser's own audio by default; a test passes a stand-in
   * so that "the game makes a sound when a battle starts" is something a test can see.
   */
  audio?: () => AudioContext | null
  /** Starts with the guided introduction off — for tests and for a returning player. */
  skipTutorial?: boolean
  /** The wall clock, for the real-time half of the autosave rule. Injectable for tests. */
  now?: () => number
}

interface PendingTarget {
  armyId: string
  kind: 'move' | 'bombard'
  target: string | null
}

const VIEWPORT = { viewportWidth: 960, viewportHeight: 600, minScale: 0.2, maxScale: 8 }

/**
 * Whether this player has seen the introduction before.
 *
 * Local storage is the easiest thing in the game to be missing — a private window, a
 * packaged shell without it — and a game that refuses to start over a remembered
 * preference would be absurd. Anything unreadable counts as "never seen".
 */
function readTutorialSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(TUTORIAL_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function rememberTutorialSeen(): void {
  try {
    globalThis.localStorage?.setItem(TUTORIAL_STORAGE_KEY, 'true')
  } catch {
    // Nothing to do: the introduction simply appears again next time.
  }
}

export function App(props: AppProps) {
  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI)
  const [options, setOptions] = useState<NewGameOptions>({
    ...DEFAULT_NEW_GAME,
    nation: props.map.startPositions[0]?.nation ?? '',
  })
  const [state, setState] = useState<GameState | null>(null)
  const [speed, setSpeed] = useState(0)
  const [dialog, setDialog] = useState<'new' | 'saves' | 'settings' | 'keys' | null>('new')
  const [slots, setSlots] = useState<readonly SlotInfo[]>([])
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<PendingTarget | null>(null)
  const [victoryAcknowledged, setVictoryAcknowledged] = useState(false)
  const [tutorial, setTutorial] = useState<TutorialState>(() =>
    props.skipTutorial ? TUTORIAL_OFF : initialTutorial(readTutorialSeen()),
  )
  // How far the event log had been read the last time a sound was played. Without it
  // every render would replay the same battle.
  const soundedUpTo = useRef(0)
  const [autosave, setAutosave] = useState<AutosaveState>({
    lastSavedTick: 0,
    lastSavedRealTime: 0,
    nextSlot: 0,
  })
  // A save is a promise; without this guard a second render would start a second one
  // against the same slot before the first has finished.
  const writingAutosave = useRef(false)
  const now = props.now ?? Date.now
  const ticksPerDay = props.rules.constants.ticksPerDay
  // In the browser this is memory; the packaged app swaps in the file-system port
  // (T-M8-00 built all three against the same contract).
  const storage = useMemo(() => props.storage ?? new MemoryStorage(), [props.storage])

  // Mit Regeln, damit die Sicht die Tagesbilanz mitbringt (R-ECON-06).
  const view = useMemo(() => (state ? publicView(state, 'p1', props.rules) : null), [state, props.rules])

  /**
   * Sound for what happened since the last look (T-M13-02, R-UI-04).
   *
   * Only the player's own share of the log is read — the fog of war applies to the ears
   * as well as to the eyes — and one tick produces at most one sound, the most urgent
   * one. Above ten game hours a second `play` stays silent by itself.
   */
  useEffect(() => {
    if (!state) return
    const own = eventsFor(state.eventLog, 'p1')
    const fresh = own.slice(soundedUpTo.current)
    soundedUpTo.current = own.length
    if (fresh.length === 0) return

    const cue = cueForEvents(fresh)
    if (cue) play(cue, { enabled: ui.settings.sound, speed }, props.audio)
  }, [state, ui.settings.sound, speed, props.audio])

  /** A step of the guided start ends because the player did the thing it asked for. */
  const tutor = useCallback((action: TutorialStep['completesOn']) => {
    setTutorial((current) => advanceTutorial(current, action))
  }, [])

  // Eine entschiedene Partie laeuft nicht weiter: die Uhr haelt an, sobald ein Sieger
  // feststeht (R-UI-13). Das Fenster darf man schliessen, die Uhr bleibt stehen.
  useEffect(() => {
    if (view?.victory.winner) setSpeed(0)
  }, [view?.victory.winner])

  // Once it has run its course it never comes back — the same promise as the button.
  useEffect(() => {
    if (tutorial.seen) rememberTutorialSeen()
  }, [tutorial.seen])

  /**
   * Automatic saving (T-M13-03, R-GAME-04).
   *
   * The core has held the rotation and the two-clock rule since M8 and the settings
   * dialogue has offered an interval since M10; nothing connected the two, so the
   * setting was a decoration. Both clocks have to agree — a game day of play *and* the
   * chosen minutes of real time — which is what keeps a fast-forwarded hour from
   * filling all three slots with near-identical states.
   */
  useEffect(() => {
    if (!state || writingAutosave.current) return
    const at = now()
    if (!autosaveDue(autosave, state, at, ui.settings.autosaveMinutes, ticksPerDay)) return

    writingAutosave.current = true
    void writeAutosave(storage, autosave, state, at)
      .then((next) => {
        setAutosave(next)
        setSaveNotice(t('saves.autosaved'))
      })
      .finally(() => {
        writingAutosave.current = false
      })
  }, [state, autosave, ui.settings.autosaveMinutes, ticksPerDay, storage, now])

  /** Everything the order descriptions need, in one place. */
  const ctx: ActionContext | null = useMemo(
    () => (state ? { state, map: props.map, rules: props.rules, playerId: 'p1', ticksPerDay } : null),
    [state, props.map, props.rules, ticksPerDay],
  )

  /** Sichtbare Truppenstärke je Provinz, für den Kartenmodus (T-M13-10). */
  const strengths = useMemo(() => strengthByProvince(view?.armies ?? []), [view])

  const provinces = useMemo(
    () =>
      props.map.provinces.map((province) => {
        const seen = view?.provinces.find((p) => p.id === province.id)
        return {
          id: province.id,
          owner: seen?.owner ?? null,
          morale: seen?.morale === undefined ? undefined : seen.morale / 1000,
          deposits: seen?.deposits as Record<string, number> | undefined,
          // Nur was der Spieler sieht: eine Provinz hinter dem Nebel bleibt unbekannt,
          // statt als "keine Truppen" zu erscheinen.
          strength: seen === undefined ? undefined : (strengths[province.id] ?? 0),
          polygon: province.polygon,
          bounds: boundsOf(province.polygon),
        }
      }),
    [props.map.provinces, view, strengths],
  )

  const centres = useMemo(
    () => Object.fromEntries(props.map.provinces.map((p) => [p.id, p.center])),
    [props.map.provinces],
  )

  const nameOfProvince = useCallback(
    (id: string): string => props.map.provinces.find((p) => p.id === id)?.name ?? id,
    [props.map.provinces],
  )

  /** Gebaeude je Provinz — nur die eigenen sind bekannt (R-DIP-04). */
  const buildings = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const province of view?.provinces ?? []) {
      const total = Object.values(province.buildings ?? {}).reduce((sum, level) => sum + (level ?? 0), 0)
      if (total > 0) counts[province.id] = total
    }
    return counts
  }, [view])

  const armies: ArmyMarker[] = useMemo(
    () =>
      (view?.armies ?? []).map((army) => {
        // Eigene Armeen tragen das Zeichen ihrer staerksten Gattung; von fremden weiss
        // der Spieler nur die Staerke, also bleibt es dort beim schlichten Kasten.
        const icon = army.units
          ? dominantIcon(army.units.map((stack) => ({ unitKey: stack.unitKey, hp: stack.hpTotal })))
          : undefined
        return {
          id: army.id,
          provinceId: army.provinceId,
          owner: army.owner,
          strength: army.strength,
          own: army.owner === 'p1',
          ...(icon ? { icon } : {}),
        }
      }),
    [view],
  )

  /** Was gerade Aufmerksamkeit braucht: Kampf, Mangel, Aufstandsgefahr (R-UI-14). */
  const alerts = useMemo(() => alertsFor(view), [view])

  /** Wo gerade gekaempft wird — so weit der Spieler es sehen darf (R-DIP-04). */
  const battleProvinces = useMemo(() => (view?.battles ?? []).map((battle) => battle.provinceId), [view])

  /**
   * Der Weg der gewaehlten Armee, als Linie auf der Karte (R-UI-12).
   *
   * Die Ebene dafuer gibt es in `MapCanvas` seit M10 — befuellt hat sie nie jemand, und
   * damit war der Marschbefehl das einzige, was man gab, ohne zu sehen, wohin.
   */
  const selectedPath = useMemo(() => {
    const army = view?.armies.find((a) => a.id === ui.selectedArmy)
    if (!army?.path || army.path.length === 0) return undefined
    return [army.provinceId, ...army.path]
  }, [view, ui.selectedArmy])

  /** One game hour, AI included. */
  const step = useCallback(
    (ticks: number) => {
      setState((current) => (current ? advance(current, ticks, { map: props.map, rules: props.rules }) : current))
    },
    [props.map, props.rules],
  )

  // The clock. Deliberately capped at two ticks per frame: when the machine cannot
  // keep up the rate drops, but no backlog builds that would freeze the game later
  // (design D5).
  useEffect(() => {
    if (speed === 0 || !state) return
    let running = true
    let last = performance.now()
    let owed = 0

    const frame = () => {
      if (!running) return
      const now = performance.now()
      owed = Math.min(2, owed + ((now - last) / 1000) * speed)
      last = now
      const due = Math.floor(owed)
      if (due > 0) {
        owed -= due
        step(due)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    return () => {
      running = false
    }
  }, [speed, state, step])

  const send = useCallback(
    (command: Command) => {
      if (!state || !ctx) return
      const result = canApply(state, command, {
        map: props.map,
        rules: props.rules,
        commands: [command],
        events: [],
      })
      if (!result.ok) {
        dispatch({ type: 'notice', text: describeRejection(result, command, ctx) })
        return
      }
      setState((current) =>
        current ? advance(current, 1, { map: props.map, rules: props.rules }, [command]) : current,
      )
    },
    [state, ctx, props.map, props.rules],
  )

  /** A description becomes a button: orders are sent, target orders open target mode. */
  const toAction = useCallback(
    (spec: ActionSpec, armyId?: string): Action => ({
      id: spec.id,
      label: spec.label,
      disabledReason: spec.disabledReason,
      ...(spec.icon ? { icon: spec.icon } : {}),
      ...(spec.explainKey ? { explainKey: spec.explainKey } : {}),
      ...(spec.hint ? { hint: spec.hint } : {}),
      onRun: () => {
        if (spec.id.startsWith('build-')) tutor('openBuild')
        if (spec.targetKind && armyId) {
          // The army panel itself says "choose a target" — one notice, not two.
          setTargeting({ armyId, kind: spec.targetKind, target: null })
          dispatch({ type: 'clearNotice' })
        } else if (spec.command) {
          send(spec.command)
        }
      },
    }),
    [send, tutor],
  )

  const jumpTo = useCallback(
    (provinceId: string) => {
      const centre = centres[provinceId]
      if (!centre) return
      tutor('openEvents')
      dispatch({ type: 'selectProvince', id: provinceId })
      dispatch({
        type: 'setView',
        view: centreOn(centre, ui.view, { width: props.map.width, height: props.map.height, ...VIEWPORT }),
      })
    },
    [centres, ui.view, props.map, tutor],
  )

  /** A click on the map: a target while an order waits for one, a selection otherwise. */
  const selectOnMap = useCallback(
    (id: string | null) => {
      if (targeting && id) {
        setTargeting({ ...targeting, target: id })
        return
      }
      setTargeting(null)
      if (id) tutor('selectProvince')
      dispatch({ type: 'selectProvince', id })
    },
    [targeting, tutor],
  )

  // Keyboard. One handler, one pure resolver, so every shortcut is testable.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = resolveKey(event, {
        speed,
        mode: ui.mode,
        typing: isTypingTarget(event.target),
        dialogOpen: dialog !== null,
      })
      if (!shortcut) return
      event.preventDefault()

      switch (shortcut.type) {
        case 'togglePause':
          setSpeed((current) => (current === 0 ? 10 : 0))
          break
        case 'speed':
          if (shortcut.hoursPerSecond > 0) tutor('setSpeed')
          setSpeed(Math.min(shortcut.hoursPerSecond, ui.settings.maxSpeed))
          break
        case 'fastForward':
          tutor('fastForward')
          step(ticksPerDay)
          break
        case 'save':
        case 'load':
          setDialog('saves')
          break
        case 'cycleMode':
          dispatch({ type: 'setMode', mode: shortcut.mode })
          break
        case 'openPanel':
          if (state) dispatch({ type: 'openPanel', panel: shortcut.panel })
          break
        case 'help':
          setDialog('keys')
          break
        case 'close':
          // Before the first game there is nothing behind the dialogue to return to.
          if (dialog === 'new' && !state) break
          if (dialog) setDialog(null)
          else if (targeting) {
            setTargeting(null)
            dispatch({ type: 'clearNotice' })
          } else dispatch({ type: 'closePanel' })
          break
        case 'pan':
          dispatch({
            type: 'setView',
            view: clampView(
              {
                x: ui.view.x + shortcut.dx * PAN_STEP * ui.view.scale,
                y: ui.view.y + shortcut.dy * PAN_STEP * ui.view.scale,
                scale: ui.view.scale,
              },
              { width: props.map.width, height: props.map.height, ...VIEWPORT },
            ),
          })
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [speed, ui.mode, ui.view, ui.settings.maxSpeed, dialog, step, ticksPerDay, props.map, state, targeting, tutor])

  useEffect(() => {
    if (dialog !== 'saves') return
    void listSlots(storage, ticksPerDay).then(setSlots)
  }, [dialog, storage, ticksPerDay])

  const selected = view?.provinces.find((p) => p.id === ui.selectedProvince) ?? null

  /** Player ids never reach the screen: the player knows nations, not "p2". */
  const nameOf = useCallback(
    (playerId: string): string => {
      if (!state) return playerId
      return state.players[playerId]?.nation ?? playerId
    },
    [state],
  )

  /**
   * The log as this player may read it: their own doings and the public ones. The
   * other powers' orders, builds and refusals stay theirs (R-DIP-04) — and every id
   * in a line is swapped for the name it stands for (R-UI-07).
   */
  const events: EventEntry[] = useMemo(() => {
    if (!state) return []
    const naming = {
      player: nameOf,
      army: (id: string) => state.armies[id]?.name ?? id,
      ticksPerDay,
    }
    return eventsFor(state.eventLog, 'p1')
      .slice(-40)
      .reverse()
      .map((event, index) => describeEvent(event, index, props.map, naming))
  }, [state, props.map, nameOf, ticksPerDay])

  /** Build, recruit and capital — for an own province; nothing for anyone else's. */
  const provinceGroups: ActionGroupSpec[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== 'p1') return []
    return [
      { id: 'build', title: t('actions.buildGroup'), actions: buildActions(ctx, selected.id).map((spec) => toAction(spec)) },
      {
        id: 'recruit',
        title: t('actions.recruitGroup'),
        actions: recruitActions(ctx, selected.id).map((spec) => toAction(spec)),
      },
    ]
  }, [ctx, selected, toAction])

  const provinceActions: Action[] = useMemo(() => {
    if (!ctx || !selected || selected.owner !== 'p1') return []
    return [toAction(capitalAction(ctx, selected.id))]
  }, [ctx, selected, toAction])

  const armiesHere = useMemo(() => (ctx && selected ? ownArmiesIn(ctx, selected.id) : []), [ctx, selected])

  const selectedArmy = view?.armies.find((a) => a.id === ui.selectedArmy) ?? null

  /** The chosen army's stacks as symbols with counts (R-UI-10). */
  const armyUnitItems: IconItem[] = useMemo(() => {
    const army = ui.selectedArmy ? state?.armies[ui.selectedArmy] : undefined
    if (!army) return []
    return unitCounts(army, props.rules).map((entry) => ({
      icon: UNIT_ICONS[entry.unitKey] ?? 'warning',
      label: t(`units.${entry.unitKey}`),
      count: entry.count,
    }))
  }, [ui.selectedArmy, state, props.rules])

  const armyActionList: Action[] = useMemo(
    () => (ctx && ui.selectedArmy ? armyActions(ctx, ui.selectedArmy).map((spec) => toAction(spec, ui.selectedArmy!)) : []),
    [ctx, ui.selectedArmy, toAction],
  )

  /** Target mode for the selected army: options, the chosen place, and its arrival. */
  const armyTargeting: Targeting | null = useMemo(() => {
    if (!ctx || !targeting || !state || targeting.armyId !== ui.selectedArmy) return null
    const army = state.armies[targeting.armyId]
    if (!army) return null
    const options = props.map.provinces
      .filter((p) => p.id !== army.locationProvinceId)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const target = targeting.target
      ? {
          id: targeting.target,
          name: nameOfProvince(targeting.target),
          arrivalText: targeting.kind === 'move' ? (planArrival(ctx, army.id, targeting.target)?.text ?? null) : null,
        }
      : null
    const confirmSpec = targeting.target ? targetAction(ctx, army.id, targeting.kind, targeting.target) : null
    const confirm: Action | null = confirmSpec
      ? {
          ...toAction(confirmSpec),
          onRun: () => {
            if (confirmSpec.command) send(confirmSpec.command)
            setTargeting(null)
            dispatch({ type: 'clearNotice' })
          },
        }
      : null
    return {
      kind: targeting.kind,
      target,
      options,
      confirm,
      onChoose: (id) => setTargeting({ ...targeting, target: id }),
      onCancel: () => {
        setTargeting(null)
        dispatch({ type: 'clearNotice' })
      },
    }
  }, [ctx, targeting, state, ui.selectedArmy, props.map.provinces, nameOfProvince, toAction, send])

  if (!state || !view || !ctx) {
    return (
      <div className="app app--empty" style={fontScaleStyle(ui.settings)}>
        <p>{t('app.loading')}</p>
        {dialog === 'new' && (
          <NewGameDialog
            options={options}
            nations={props.map.startPositions.map((s) => s.nation)}
            maps={props.maps}
            aiBonus={aiBonusPercent(props.rules, options.difficulty)}
            onChange={setOptions}
            onStart={() => {
              const fresh = startGame(options, props.map, props.rules)
              setState(fresh)
              // The autosave clock starts now, not at the epoch — otherwise the
              // real-time half of the rule is satisfied before the first day is played
              // and the chosen interval never applies.
              setAutosave({ lastSavedTick: fresh.tick, lastSavedRealTime: now(), nextSlot: 0 })
              // Open on the player's own country rather than on the top-left corner of
              // the world — the first thing they look for is where they are.
              const capital = fresh.players.p1?.capitalProvinceId
              const centre = capital ? centres[capital] : undefined
              if (centre) {
                dispatch({
                  type: 'setView',
                  view: centreOn(centre, { x: 0, y: 0, scale: 1.6 }, { width: props.map.width, height: props.map.height, ...VIEWPORT }),
                })
              }
              setDialog(null)
            }}
            // Closing without a game would leave a blank screen with no way back —
            // found in the first smoke test, one Escape before the first click.
            onClose={() => undefined}
          />
        )}
      </div>
    )
  }

  const ownProvinces = view.provinces.filter((p) => p.owner === 'p1').map((p) => ({ id: p.id, name: p.name }))
  const knownProvinces = view.provinces.filter((p) => p.owner !== 'p1').map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="app" style={fontScaleStyle(ui.settings)}>
      <Header
        view={view}
        ticksPerDay={ticksPerDay}
        speed={speed}
        fastForwarding={false}
        mode={ui.mode}
        onSpeed={(value) => {
          if (value > 0) tutor('setSpeed')
          setSpeed(Math.min(value, ui.settings.maxSpeed))
        }}
        onFastForward={() => {
          tutor('fastForward')
          step(ticksPerDay)
        }}
        onAbort={() => setSpeed(0)}
        onMode={(mode) => dispatch({ type: 'setMode', mode })}
        onMenu={() => setDialog('settings')}
        onPanel={(panel) => dispatch({ type: 'openPanel', panel })}
      />

      <main className="main">
        <div className="map-area">
          <MapCanvas
            provinces={provinces}
            centres={centres}
            armies={armies}
            buildings={buildings}
            mode={ui.mode}
            width={props.map.width}
            height={props.map.height}
            view={ui.view}
            ownershipVersion={ui.ownershipVersion}
            selectedProvince={ui.selectedProvince}
            capitalProvinceId={view.self.capitalProvinceId}
            battleProvinces={battleProvinces}
            {...(selectedPath ? { path: selectedPath } : {})}
            onSelect={selectOnMap}
            onViewChange={(next) => dispatch({ type: 'setView', view: next })}
            labelFor={nameOfProvince}
          />
          {/* Der Schluessel gehoert zu seiner Karte, nicht in die Seitenleiste. */}
          <Legend mode={ui.mode} />
        </div>

        <aside className="side">
          <ProvincePicker
            own={ownProvinces}
            others={knownProvinces}
            value={ui.selectedProvince}
            onChange={(id) => {
              setTargeting(null)
              if (id) tutor('selectProvince')
              dispatch({ type: 'selectProvince', id })
            }}
          />
          <Alerts alerts={alerts} onJump={jumpTo} />
          {ui.notice && <p className={`notice notice--${ui.notice.kind}`}>{ui.notice.text}</p>}
          {ui.panel === 'province' && (
            <ProvincePanel
              province={selected}
              ownerName={selected?.owner ? nameOf(selected.owner) : null}
              actions={provinceActions}
              groups={provinceGroups}
              armies={armiesHere}
              selectedArmy={ui.selectedArmy}
              onSelectArmy={(id) => {
                setTargeting(null)
                dispatch({ type: 'selectArmy', id })
              }}
              isCapital={selected?.id === view.self.capitalProvinceId}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'army' && (
            <ArmyPanel
              army={selectedArmy}
              name={ui.selectedArmy ? state.armies[ui.selectedArmy]?.name : undefined}
              units={armyUnitItems}
              actions={armyActionList}
              targeting={armyTargeting}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'diplomacy' && (
            <DiplomacyPanel
              view={view}
              nameOf={nameOf}
              actionsFor={(playerId) => diplomacyActions(ctx, playerId).map((spec) => toAction(spec))}
            />
          )}
          {ui.panel === 'standings' && <StandingsPanel view={view} nameOf={nameOf} />}
          {ui.panel === 'market' && (
            <MarketPanel
              resources={RESOURCE_KEYS}
              stock={view.self.resources}
              preview={(give, giveAmount, want) => {
                const result = tradePreview(ctx, give, giveAmount, want)
                return { text: result.text, action: toAction(result.action) }
              }}
            />
          )}
          <EconomyPanel view={view} />
          <DebugPanel
            enabled={ui.settings.debug}
            info={{ tick: state.tick, hash: '', aiGoals: [], commands: [] }}
          />
        </aside>
      </main>

      <EventLog entries={events} ticksPerDay={ticksPerDay} onJump={jumpTo} />

      <Tutorial
        state={tutorial}
        onDismiss={() => {
          setTutorial(dismissTutorial())
          rememberTutorialSeen()
        }}
      />

      {dialog === 'settings' && (
        <SettingsDialog
          settings={ui.settings}
          onChange={(settings: Partial<Settings>) => dispatch({ type: 'changeSettings', settings })}
          onReset={() => dispatch({ type: 'resetSettings' })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'saves' && (
        <SavesDialog
          slots={slots}
          notice={saveNotice}
          onSave={(name) => {
            void saveTo(storage, name, state).then(async () => {
              setSaveNotice(t('saves.saved'))
              setSlots(await listSlots(storage, ticksPerDay))
            })
          }}
          onLoad={(name) => {
            void loadFrom(storage, name).then(async (result) => {
              if (result.ok) {
                setState(result.state)
                setAutosave({ lastSavedTick: result.state.tick, lastSavedRealTime: now(), nextSlot: 0 })
                setSaveNotice(t('saves.loaded'))
                setDialog(null)
              } else {
                // A refused save says why, in a sentence — never an exception and never
                // a silent restart (T-M10-08).
                setSaveNotice(result.message)
              }
              setSlots(await listSlots(storage, ticksPerDay))
            })
          }}
          onClose={() => {
            setSaveNotice(null)
            setDialog(null)
          }}
        />
      )}
      {dialog === 'keys' && <KeyboardHelp onClose={() => setDialog(null)} />}

      {/* Die Partie ist entschieden: einmal sagen, die Uhr anhalten, und den Blick auf
          die Karte freigeben, wenn der Spieler ihn will (R-UI-13). */}
      {view.victory.winner !== null && !victoryAcknowledged && (
        <VictoryDialog
          view={view}
          nameOf={nameOf}
          ticksPerDay={ticksPerDay}
          onClose={() => setVictoryAcknowledged(true)}
        />
      )}
    </div>
  )
}
