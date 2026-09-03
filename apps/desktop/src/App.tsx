import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
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
import { t } from './i18n/text.ts'
import { INITIAL_UI, uiReducer, type Settings } from './state/uiState.ts'
import { MapCanvas, type ArmyMarker } from './map/MapCanvas.tsx'
import { boundsOf, centreOn, clampView } from './map/picking.ts'
import { Header } from './ui/Header.tsx'
import {
  ArmyPanel,
  DiplomacyPanel,
  EconomyPanel,
  EventLog,
  ProvincePanel,
  hintFor,
  type Action,
  type EventEntry,
} from './ui/Panels.tsx'
import { DebugPanel, KeyboardHelp, NewGameDialog, SavesDialog, SettingsDialog, fontScaleStyle } from './ui/Dialogs.tsx'
import { DEFAULT_NEW_GAME, aiBonusPercent, startGame, type NewGameOptions } from './game/newGame.ts'
import { PAN_STEP, isTypingTarget, resolveKey } from './keyboard.ts'
import { describeEvent } from './game/events.ts'
import { MemoryStorage } from '@worldwar/core'
import { listSlots, loadFrom, saveTo, type SlotInfo } from './game/saves.ts'

/**
 * The game, assembled (T-M10-03 … T-M10-12).
 *
 * The simulation runs here in the same thread rather than in the worker: SimHost and
 * the worker shell are built and tested (T-M10-02), but wiring a worker into a Vite
 * build is a packaging question that belongs with T-M11-03, and the interactive
 * speeds hold comfortably either way — a tick on the world map costs 2.8 ms against a
 * 16 ms frame.
 */

export interface AppProps {
  map: MapData
  rules: Rules
  maps: readonly { id: string; name: string; provinces: number }[]
  /** Where saves go. Memory by default; the packaged app passes a file-system port. */
  storage?: StoragePort
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
  const ticksPerDay = props.rules.constants.ticksPerDay
  // In the browser this is memory; the packaged app swaps in the file-system port
  // (T-M8-00 built all three against the same contract).
  const storage = useMemo(() => props.storage ?? new MemoryStorage(), [props.storage])

  // Mit Regeln, damit die Sicht die Tagesbilanz mitbringt (R-ECON-06).
  const view = useMemo(() => (state ? publicView(state, 'p1', props.rules) : null), [state, props.rules])

  const provinces = useMemo(
    () =>
      props.map.provinces.map((province) => {
        const seen = view?.provinces.find((p) => p.id === province.id)
        return {
          id: province.id,
          owner: seen?.owner ?? null,
          morale: seen?.morale === undefined ? undefined : seen.morale / 1000,
          deposits: seen?.deposits as Record<string, number> | undefined,
          polygon: province.polygon,
          bounds: boundsOf(province.polygon),
        }
      }),
    [props.map.provinces, view],
  )

  const centres = useMemo(
    () => Object.fromEntries(props.map.provinces.map((p) => [p.id, p.center])),
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
      (view?.armies ?? []).map((army) => ({
        id: army.id,
        provinceId: army.provinceId,
        owner: army.owner,
        strength: army.strength,
        own: army.owner === 'p1',
      })),
    [view],
  )

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
      if (!state) return
      const result = canApply(state, command, {
        map: props.map,
        rules: props.rules,
        commands: [command],
        events: [],
      })
      if (!result.ok) {
        dispatch({ type: 'notice', text: t(`errors.${result.code}`, result.detail ?? {}) })
        return
      }
      setState((current) =>
        current ? advance(current, 1, { map: props.map, rules: props.rules }, [command]) : current,
      )
    },
    [state, props.map, props.rules],
  )

  const jumpTo = useCallback(
    (provinceId: string) => {
      const centre = centres[provinceId]
      if (!centre) return
      dispatch({ type: 'selectProvince', id: provinceId })
      dispatch({
        type: 'setView',
        view: centreOn(centre, ui.view, {
          width: props.map.width,
          height: props.map.height,
          viewportWidth: 960,
          viewportHeight: 600,
          minScale: 0.2,
          maxScale: 8,
        }),
      })
    },
    [centres, ui.view, props.map],
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
          setSpeed(Math.min(shortcut.hoursPerSecond, ui.settings.maxSpeed))
          break
        case 'fastForward':
          step(ticksPerDay)
          break
        case 'save':
        case 'load':
          setDialog('saves')
          break
        case 'cycleMode':
          dispatch({ type: 'setMode', mode: shortcut.mode })
          break
        case 'help':
          setDialog('keys')
          break
        case 'close':
          // Before the first game there is nothing behind the dialogue to return to.
          if (dialog === 'new' && !state) break
          if (dialog) setDialog(null)
          else dispatch({ type: 'closePanel' })
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
              {
                width: props.map.width,
                height: props.map.height,
                viewportWidth: 960,
                viewportHeight: 600,
                minScale: 0.2,
                maxScale: 8,
              },
            ),
          })
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [speed, ui.mode, ui.view, ui.settings.maxSpeed, dialog, step, ticksPerDay, props.map])

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

  const provinceActions: Action[] = useMemo(() => {
    if (!state || !selected) return []
    const build: Command = {
      type: 'BUILD',
      playerId: 'p1',
      provinceId: selected.id,
      building: 'barracks',
    }
    const check = canApply(state, build, {
      map: props.map,
      rules: props.rules,
      commands: [build],
      events: [],
    })
    const barracks = props.rules.buildings.barracks

    return [
      {
        id: 'build',
        label: t('actions.build'),
        disabledReason: check.ok ? null : t(`errors.${check.code}`, check.detail ?? {}),
        ...(barracks ? { hint: hintFor(barracks.cost, barracks.buildTicks, ticksPerDay) } : {}),
        onRun: () => send(build),
      },
    ]
  }, [state, selected, props.map, props.rules, send, ticksPerDay])

  if (!state || !view) {
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
              // Open on the player's own country rather than on the top-left corner of
              // the world — the first thing they look for is where they are.
              const capital = fresh.players.p1?.capitalProvinceId
              const centre = capital ? centres[capital] : undefined
              if (centre) {
                dispatch({
                  type: 'setView',
                  view: centreOn(centre, { x: 0, y: 0, scale: 1.6 }, {
                    width: props.map.width,
                    height: props.map.height,
                    viewportWidth: 960,
                    viewportHeight: 600,
                    minScale: 0.2,
                    maxScale: 8,
                  }),
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

  return (
    <div className="app" style={fontScaleStyle(ui.settings)}>
      <Header
        view={view}
        ticksPerDay={ticksPerDay}
        speed={speed}
        fastForwarding={false}
        mode={ui.mode}
        onSpeed={(value) => setSpeed(Math.min(value, ui.settings.maxSpeed))}
        onFastForward={() => step(ticksPerDay)}
        onAbort={() => setSpeed(0)}
        onMode={(mode) => dispatch({ type: 'setMode', mode })}
        onMenu={() => setDialog('settings')}
      />

      <main className="main">
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
          onSelect={(id) => dispatch({ type: 'selectProvince', id })}
          onViewChange={(next) => dispatch({ type: 'setView', view: next })}
          labelFor={(id) => props.map.provinces.find((p) => p.id === id)?.name ?? id}
        />

        <aside className="side">
          {ui.notice && <p className="notice notice--error">{ui.notice.text}</p>}
          {ui.panel === 'province' && (
            <ProvincePanel
              province={selected}
              ownerName={selected?.owner ? nameOf(selected.owner) : null}
              actions={provinceActions}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'army' && (
            <ArmyPanel
              army={view.armies.find((a) => a.id === ui.selectedArmy) ?? null}
              actions={[]}
              ticksPerDay={ticksPerDay}
              currentTick={state.tick}
            />
          )}
          {ui.panel === 'diplomacy' && <DiplomacyPanel view={view} nameOf={nameOf} />}
          <EconomyPanel view={view} />
          <DebugPanel
            enabled={ui.settings.debug}
            info={{ tick: state.tick, hash: '', aiGoals: [], commands: [] }}
          />
        </aside>
      </main>

      <EventLog entries={events} ticksPerDay={ticksPerDay} onJump={jumpTo} />

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
    </div>
  )
}
