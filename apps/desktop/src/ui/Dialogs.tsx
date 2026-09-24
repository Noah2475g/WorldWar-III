import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RESOURCE_KEYS } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { DEFAULT_SETTINGS, FONT_SCALES, type Settings } from '../state/uiState.ts'
import {
  MULTIPLAYER_SPEEDS,
  effectiveMode,
  type Difficulty,
  type GameMode,
  type Invitation,
  type NewGameOptions,
} from '../game/newGame.ts'
// Die Fassung aus package.json — nicht als zweite Wahrheit in der Sprachdatei (T-M22-04).
import { version as APP_VERSION } from '../../../../package.json'

/**
 * Everything that opens over the map (T-M10-07a/b, T-M10-09, T-M10-10, T-M10-11).
 *
 * All of them share one dialogue shell, and the shell does the accessibility work
 * once: focus moves in on opening and back out on closing, Escape closes, and the
 * background cannot be reached by tab. Done per dialogue, that work gets forgotten in
 * the fourth one — and the fourth one is where a player gets stuck.
 */

/** Was in einem Dialog den Fokus annehmen kann — eine Liste, damit sie nicht auseinanderlaeuft. */
// prettier-ignore
const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])' // GUARD-ALLOW prose-in-code: ein CSS-Waehler, kein Satz

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)

  useEffect(() => {
    returnTo.current = document.activeElement
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
    }
  }, [])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose()
            return
          }
          // Der Fokusfang (T-M16-07, R-UI-15/AK1).
          //
          // `aria-modal` sagt einem Vorleseprogramm, dass dahinter nichts ist — die
          // Tabulatortaste hoert nicht darauf. Ohne diese Zeilen tabbt man aus einem
          // modalen Dialog in die Karte dahinter: sichtbar verdeckt, mit der Tastatur
          // erreichbar und bedienbar. Das ist der Fehler, den ein Sehender nie bemerkt.
          if (event.key !== 'Tab') return
          const felder = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
            (element) => !element.hasAttribute('disabled'),
          )
          if (felder.length === 0) return
          const erster = felder[0]!
          const letzter = felder[felder.length - 1]!
          const aktiv = document.activeElement
          if (event.shiftKey && (aktiv === erster || !ref.current?.contains(aktiv))) {
            event.preventDefault()
            letzter.focus()
          } else if (!event.shiftKey && (aktiv === letzter || !ref.current?.contains(aktiv))) {
            event.preventDefault()
            erster.focus()
          }
        }}
      >
        <header className="dialog__head">
          <h2>{title}</h2>
          <button type="button" className="button" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  )
}

export function NewGameDialog({
  options,
  nations,
  maps,
  modes,
  aiBonus,
  onChange,
  onStart,
  onClose,
  onSaves,
  resume,
  onResume,
  invitation,
}: {
  options: NewGameOptions
  nations: readonly string[]
  maps: readonly { id: string; name: string; data: { provinces: readonly unknown[] } }[]
  /**
   * Die Partiearten, die dieser Bau herstellen kann (T-M39-11, Befund V-1).
   *
   * Eine Eigenschaft und keine Bauflagge im Rumpf: dieses Formular soll in beiden Bauten
   * geprüft werden können, und die Flagge steht im Testlauf fest. Enthält die Liste nur
   * eine Art, verschwindet der Wähler — eine Wahl mit einem Wert ist keine. Und mit ihm
   * verschwindet alles, was nur zu zweit einen Sinn hat: die feste Rate und die
   * Einladungsvorschau.
   */
  modes: readonly GameMode[]
  aiBonus: number
  onChange: (options: NewGameOptions) => void
  /**
   * Beginnen — mit der Art, die dieser Dialog angeboten hat (Befund V-1, Nacharbeit vom
   * 2026-09-24). Nicht `options.mode`: das Formular kann eine Art tragen, die gerade nicht
   * angeboten wird, und dann darf sie beim Start nicht zuschlagen.
   */
  onStart: (mode: GameMode) => void
  onClose: () => void
  /**
   * Was ein Gast vor dem Beitritt sähe (T-M37-03, R-MP-02/AK1, D28.10).
   *
   * `null` im Einzelspieler — dann gibt es nichts einzuladen. Der Dialog rechnet sie
   * nicht selbst aus: die Einladung entsteht aus der Partiedefinition, und die kennt
   * die Hülle, nicht das Formular.
   */
  invitation?: Invitation | null
  /**
   * Der Weg zu den Spielstaenden (T-M12-07). Wer wiederkommt, will laden und nicht neu
   * anfangen — und vor der ersten Partie steht dieser Dialog davor. Ohne den Griff waere
   * der Stand nur zu erreichen, indem man den Dialog erst wegklickt.
   */
  onSaves?: () => void
  /**
   * Der juengste Stand, wenn es einen gibt (T-M22-04, Befund V2-04): dann ist
   * "Weiterspielen (Tag N)" der ERSTE Knopf — wer wiederkommt, will weiterspielen.
   */
  resume?: { day: number } | null
  onResume?: () => void
}) {
  // Zu zweit ist nur dann eine Frage, wenn dieser Bildschirm es auch herstellen kann
  // (Befund V-1). `effectiveMode` fängt den Fall ab, in dem eine alte Wahl im Formular
  // stehen bleibt, während sie nicht mehr angeboten wird — für die Anzeige UND für den
  // Start, damit beide dieselbe Art meinen.
  const art = effectiveMode(options.mode, modes)
  const zuZweit = art === 'multiplayer'

  return (
    <Dialog title={t('newGame.title')} onClose={onClose}>
      {/* Start mit Gesicht (T-M22-04, Befund V2-03): Name, Untertitel, Fassung —
          der erste Eindruck sagte vorher "Formular", nicht "Strategiespiel". */}
      <header className="start">
        <h1 className="start__title">{t('app.title')}</h1>
        <p className="start__subtitle">{t('app.subtitle')}</p>
        <p className="start__version">{t('app.version', { version: APP_VERSION })}</p>
      </header>

      {resume && onResume && (
        <button type="button" className="button button--primary" onClick={onResume}>
          {t('newGame.resume', { day: resume.day })}
        </button>
      )}

      {/* Die Partieart steht vor allem anderen (T-M37-03, R-MP-02): sie entscheidet, ob
          die Rate darunter überhaupt eine Frage ist.

          Sie erscheint nur, wenn es etwas zu wählen gibt (T-M39-11, Befund V-1): im
          netzfreien Bau kann das Programm die zweite Art nicht herstellen, und ein Wähler,
          der eine Partieart anbietet und danach eine andere liefert, ist schlimmer als
          keiner. */}
      {modes.length > 1 && (
        <label className="field">
          <span>{t('newGame.mode')}</span>
          <select
            value={options.mode}
            onChange={(e) => onChange({ ...options, mode: e.target.value as GameMode })}
          >
            {modes.map((mode) => (
              <option key={mode} value={mode}>
                {mode === 'single' ? t('newGame.modeSingle') : t('newGame.modeMultiplayer')}
              </option>
            ))}
          </select>
        </label>
      )}

      {zuZweit && (
        <label className="field">
          <span>{t('newGame.fixedSpeed')}</span>
          <select
            value={options.fixedSpeed}
            onChange={(e) => onChange({ ...options, fixedSpeed: Number(e.target.value) })}
          >
            {MULTIPLAYER_SPEEDS.map((stop) => (
              <option key={stop} value={stop}>
                {t('header.speedStop', { stop })}
              </option>
            ))}
          </select>
          <small>{t('newGame.fixedSpeedHint')}</small>
        </label>
      )}

      <label className="field">
        <span>{t('newGame.map')}</span>
        <select value={options.mapId} onChange={(e) => onChange({ ...options, mapId: e.target.value })}>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.data.provinces.length})
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.nation')}</span>
        <select value={options.nation} onChange={(e) => onChange({ ...options, nation: e.target.value })}>
          {nations.map((nation) => (
            <option key={nation} value={nation}>
              {nation}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.opponents')}</span>
        <input
          type="number"
          min={1}
          max={Math.max(1, nations.length - 1)}
          value={options.opponents}
          onChange={(e) => onChange({ ...options, opponents: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>{t('newGame.difficulty')}</span>
        <select
          value={options.difficulty}
          onChange={(e) => onChange({ ...options, difficulty: e.target.value as Difficulty })}
        >
          <option value="easy">{t('newGame.easy')}</option>
          <option value="normal">{t('newGame.normal')}</option>
          <option value="hard">{t('newGame.hard')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.seed')}</span>
        <input
          type="number"
          value={options.seed}
          onChange={(e) => onChange({ ...options, seed: Number(e.target.value) })}
        />
        <small>{t('newGame.seedHint')}</small>
      </label>

      <label className="field">
        <span>{t('newGame.victory')}</span>
        <select
          value={options.victory}
          onChange={(e) => onChange({ ...options, victory: e.target.value as 'points' | 'conquest' })}
        >
          <option value="points">{t('newGame.victoryPoints')}</option>
          <option value="conquest">{t('newGame.victoryConquest')}</option>
        </select>
        <small>
          {options.victory === 'points'
            ? t('newGame.victoryPointsHint')
            : t('newGame.victoryConquestHint')}
        </small>
      </label>

      <p className="notice notice--info">
        {aiBonus === 0 ? t('newGame.aiBonusNone') : t('newGame.aiBonus', { percent: aiBonus })}
      </p>

      {/* Worauf ein Gast sich einließe (R-MP-02/AK1, R-MP-12): Karte, beide Nationen,
          die Zahl der Computergegner und die feste Rate — vor dem Beitritt, nicht danach. */}
      {zuZweit && invitation && (
        <section className="notice notice--info" aria-label={t('newGame.invitation')}>
          <p>{t('newGame.invitation')}</p>
          <ul>
            <li>{t('newGame.invitationMap', { map: invitation.mapName })}</li>
            <li>
              {t('newGame.invitationNations', { host: invitation.hostNation, other: invitation.guestNation })}
            </li>
            <li>{t('newGame.invitationAi', { count: invitation.aiOpponents })}</li>
            <li>{t('newGame.invitationSpeed', { speed: invitation.fixedSpeed })}</li>
          </ul>
          {/* Hier stand bis zum 2026-09-18 „Die Verbindung zum Mitspieler kommt mit dem
              nächsten Ausbau" (T-M39-11, Befund MP-5). Der Satz war in M37 richtig und ist
              seit M38/M39 falsch: die Verbindung ist gebaut. Ersatzlos, weil der Kasten
              Angaben trägt und keine Erklärungen — was als Nächstes kommt, sagt die Lobby
              mit dem Link darin, einen Klick später. */}
        </section>
      )}

      <p className="dialog__actions">
        <button type="button" className="button button--primary" onClick={() => onStart(art)}>
          {t('newGame.start')}
        </button>
        {onSaves && (
          <button type="button" className="button" onClick={onSaves}>
            {t('saves.title')}
          </button>
        )}
      </p>
    </Dialog>
  )
}

/**
 * Der Beitrittsbildschirm (T-M39-02, R-MP-12/AK1, D28.10, MEHRSPIELER.md §3.7).
 *
 * **Zuerst die Bedingungen, dann der Name.** Niemand tritt einer Partie bei, deren
 * Bedingungen er nicht kennt — und die feste Geschwindigkeit gehört ausdrücklich dazu, denn
 * sie ist das Einzige, was er hinterher nicht mehr ändern kann (R-MP-02). Deshalb steht das
 * Namensfeld unter der Liste und nicht darüber, und deshalb ist der Knopf ohne Namen
 * gesperrt: ein Gast ohne Namen wäre beim Gastgeber ein leerer Platz.
 *
 * **Er kommt ohne Spielstand aus.** Der Gast hat keinen — er hat einen Link. Der erste
 * Bildschirm der Anwendung ist sonst der Anlegedialog; der Beitritt ist ein **zweiter
 * Einstieg** und kein Sonderfall des ersten.
 */
export function JoinDialog({
  terms,
  mapName,
  phase,
  reason,
  joined,
  onJoin,
  onLeave,
}: {
  terms: {
    ownNation: string
    hostNation: string
    aiOpponents: number
    victory: 'points' | 'conquest'
    fixedSpeed: number
  } | null
  /** Der Name der Karte — die Kennung aus der Partiedefinition sagt einem Menschen nichts. */
  mapName: string
  phase: 'lobby' | 'checking' | 'refused'
  reason: string | null
  joined: boolean
  onJoin: (name: string) => void
  onLeave: () => void
}) {
  const [name, setName] = useState('')

  return (
    <Dialog title={t(phase === 'refused' ? 'party.refusedTitle' : 'party.joinTitle')} onClose={onLeave}>
      {phase === 'refused' && (
        <>
          <p className="notice notice--warn">{reason}</p>
          <p>{t('party.refusedHint')}</p>
        </>
      )}

      {phase !== 'refused' && !terms && <p className="notice notice--info">{t('party.waitingForOffer')}</p>}

      {phase !== 'refused' && terms && (
        <>
          <section className="notice notice--info" aria-label={t('party.terms')}>
            <p>{t('party.terms')}</p>
            <ul>
              <li>{t('party.termsMap', { map: mapName })}</li>
              <li>{t('party.termsNations', { own: terms.ownNation, host: terms.hostNation })}</li>
              <li>{t('party.termsAi', { count: terms.aiOpponents })}</li>
              <li>
                {t('party.termsVictory', {
                  victory: t(terms.victory === 'points' ? 'newGame.victoryPoints' : 'newGame.victoryConquest'),
                })}
              </li>
              <li>{t('party.termsSpeed', { speed: terms.fixedSpeed })}</li>
            </ul>
            <small>{t('party.fixedSpeedWarning')}</small>
          </section>

          {/* D28.2: jeder hat den vollen Zustand im Speicher. Das steht in der Anleitung
              UND hier, weil es die einzige Einschraenkung ist, die der Gast vorher wissen
              muss - hinterher ist sie eine Enttaeuschung. */}
          <p className="notice notice--info">{t('party.openState')}</p>

          {joined ? (
            <p className="notice notice--info">{t('party.joined')}</p>
          ) : (
            <>
              <label className="field">
                <span>{t('party.nameLabel')}</span>
                <input
                  type="text"
                  value={name}
                  placeholder={t('party.namePlaceholder')}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <p className="dialog__actions">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={name.trim().length === 0}
                  onClick={() => onJoin(name.trim())}
                >
                  {t('party.joinButton')}
                </button>
              </p>
            </>
          )}
        </>
      )}

      {phase === 'checking' && <p className="notice notice--info">{t('party.checking')}</p>}
    </Dialog>
  )
}

/**
 * Der Gastgeber sieht, wer wartet — und startet (T-M39-03, R-MP-12/AK2, D28.10).
 *
 * **Die Partie beginnt, wenn der Host es sagt, nicht wenn eine Verbindung steht.** Eine
 * Partie, die mit dem Verbindungsaufbau losliefe, begänne, während der Gast noch liest.
 *
 * Drei Zustände, und der mittlere ist der, den man leicht vergisst: niemand da, **jemand da
 * ohne Namen**, jemand da mit Namen. Der Gastgeber soll sehen, dass sein Link angekommen
 * ist, bevor der andere getippt hat — sonst klickt er den Link ein zweites Mal in den Chat.
 */
export function LobbyDialog({
  guestLink,
  guestName,
  offered,
  phase,
  reason,
  onBegin,
  onLeave,
}: {
  guestLink: string
  /** `null` heißt „niemand da", `''` heißt „da, aber noch ohne Namen". */
  guestName: string | null
  offered: boolean
  phase: 'lobby' | 'checking' | 'refused'
  reason: string | null
  onBegin: () => void
  onLeave: () => void
}) {
  const [copied, setCopied] = useState(false)

  return (
    <Dialog title={t(phase === 'refused' ? 'party.refusedTitle' : 'party.hostTitle')} onClose={onLeave}>
      {phase === 'refused' && <p className="notice notice--warn">{reason}</p>}

      <p>{t('party.inviteHint')}</p>
      <p className="field">
        <input type="text" readOnly value={guestLink} aria-label={t('party.inviteHint')} />
      </p>
      <p className="dialog__actions">
        <button
          type="button"
          className="button"
          onClick={() => {
            // Ohne sicheren Kontext gibt es keine Zwischenablage-Schnittstelle (D28.10);
            // die Auswahl im Feld ist der Weg, der ueber http immer funktioniert.
            const feld = document.querySelector<HTMLInputElement>('.dialog input[readonly]')
            feld?.select()
            setCopied(true)
          }}
        >
          {copied ? t('party.copied') : t('party.copyLink')}
        </button>
      </p>

      {!offered && <p className="notice notice--info">{t('party.setUpFirst')}</p>}
      {guestName === null && <p className="notice notice--info">{t('party.waitingForGuest')}</p>}
      {guestName === '' && <p className="notice notice--info">{t('party.guestArrived')}</p>}
      {guestName !== null && guestName !== '' && (
        <p className="notice notice--info">{t('party.guestReady', { name: guestName })}</p>
      )}

      {phase === 'checking' && <p className="notice notice--info">{t('party.checking')}</p>}

      <p className="dialog__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={!offered || guestName === null || guestName === '' || phase !== 'lobby'}
          onClick={onBegin}
        >
          {t('party.beginButton')}
        </button>
        <button type="button" className="button" onClick={onLeave}>
          {t('party.leave')}
        </button>
      </p>
    </Dialog>
  )
}

/**
 * Das Menue mit Wegen (T-M22-04, Befund V2-05): aus der laufenden Partie gab es nur
 * die Einstellungen — keinen Weg zu einer neuen Partie, keinen zu den Spielstaenden.
 */
export function MenuDialog({
  onNewGame,
  onSaves,
  onSettings,
  onClose,
}: {
  onNewGame: () => void
  onSaves: () => void
  onSettings: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={t('menu.title')} onClose={onClose}>
      <div className="menu">
        <button type="button" className="button button--primary" onClick={onNewGame}>
          {t('newGame.title')}
        </button>
        <button type="button" className="button" onClick={onSaves}>
          {t('saves.title')}
        </button>
        <button type="button" className="button" onClick={onSettings}>
          {t('settings.title')}
        </button>
      </div>
    </Dialog>
  )
}

export interface SaveSlot {
  name: string
  label: string
  savedAtDay: number | null
}

export function SavesDialog({
  slots,
  onSave,
  onLoad,
  onClose,
  notice,
}: {
  slots: readonly SaveSlot[]
  /**
   * Fehlt der Griff, wird nur geladen: vor der ersten Partie gibt es keinen Zustand zu
   * sichern, und ein Knopf, der nichts tun kann, waere genau der Fehler aus 26a
   * (T-M12-07).
   */
  onSave?: (name: string) => void
  onLoad: (name: string) => void
  onClose: () => void
  notice: string | null
}) {
  return (
    <Dialog title={t('saves.title')} onClose={onClose}>
      {notice && <p className="notice">{notice}</p>}
      <ul className="slots">
        {slots.map((slot) => (
          <li key={slot.name} className="slot">
            <span className="slot__label">
              {slot.label}
              {slot.savedAtDay !== null ? ` — ${t('header.day')} ${slot.savedAtDay}` : ` — ${t('saves.empty')}`}
            </span>
            <span className="slot__actions">
              {onSave && (
                <button type="button" className="button" onClick={() => onSave(slot.name)}>
                  {t('saves.save')}
                </button>
              )}
              <button
                type="button"
                className="button"
                disabled={slot.savedAtDay === null}
                onClick={() => onLoad(slot.name)}
              >
                {t('saves.load')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export function SettingsDialog({
  settings,
  onChange,
  onReset,
  onClose,
}: {
  settings: Settings
  onChange: (settings: Partial<Settings>) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <label className="field">
        <span>{t('settings.autosaveInterval')}</span>
        <input
          type="number"
          min={1}
          max={60}
          value={settings.autosaveMinutes}
          onChange={(e) => onChange({ autosaveMinutes: Number(e.target.value) })}
        />
      </label>

      <label className="field field--switch">
        <input type="checkbox" checked={settings.sound} onChange={(e) => onChange({ sound: e.target.checked })} />
        <span>{t('settings.sound')}</span>
      </label>

      <label className="field">
        <span>{t('settings.maxSpeed')}</span>
        <input
          type="number"
          min={1}
          max={100}
          value={settings.maxSpeed}
          onChange={(e) => onChange({ maxSpeed: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>{t('settings.fontSize')}</span>
        <select
          value={settings.fontScale}
          onChange={(e) => onChange({ fontScale: e.target.value as Settings['fontScale'] })}
        >
          <option value="small">{t('settings.fontSmall')}</option>
          <option value="normal">{t('settings.fontNormal')}</option>
          <option value="large">{t('settings.fontLarge')}</option>
        </select>
      </label>

      <label className="field field--switch">
        <input type="checkbox" checked={settings.debug} onChange={(e) => onChange({ debug: e.target.checked })} />
        <span>{t('settings.debug')}</span>
      </label>

      <button type="button" className="button" onClick={onReset} disabled={isDefault(settings)}>
        {t('settings.reset')}
      </button>
    </Dialog>
  )
}

function isDefault(settings: Settings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every(
    (key) => settings[key] === DEFAULT_SETTINGS[key],
  )
}

export interface DebugInfo {
  tick: number
  hash: string
  aiGoals: { player: string; goal: string; utility: number; alternatives: string[] }[]
  commands: string[]
}

/**
 * Debug-Prosa spricht Namen (T-M28-04, R-UI-07, Befund V2-12, D26.4).
 *
 * Die KI bleibt englisch und kernnah — ihre Zieltexte nennen `p2` und `money`. Die
 * Übersetzung passiert HIER, beim Rendern, aus denselben Quellen wie die übrige
 * Oberfläche: Spieler-Kennungen ersetzt der Aufrufer über `nameOf` (die Sicht kennt
 * die Machtnamen), Rohstoffschlüssel kommen aus `de.ts`. Weil die Zieltexte freie
 * Prosa sind, ersetzt ein Wortgrenzen-Muster — `p22` (eine Provinzkennung) bleibt
 * unangetastet, nur ein freistehendes `p2` wird zur Macht.
 */
export function localizeDebugText(text: string, nameOf: (id: string) => string): string {
  let result = text.replace(/\bp\d+\b/g, (id) => nameOf(id))
  for (const key of RESOURCE_KEYS) {
    result = result.replace(new RegExp(`\\b${key}\\b`, 'g'), t(`resources.${key}`))
  }
  return result
}

export function DebugPanel({
  info,
  enabled,
  nameOf = (id) => id,
}: {
  info: DebugInfo | null
  enabled: boolean
  /** Der Machtname zu einer Spielerkennung — ohne ihn bleibt die Kennung stehen. */
  nameOf?: (id: string) => string
}) {
  if (!enabled) return null
  if (!info) return <section className="panel">{t('debug.hidden')}</section>

  return (
    <section className="panel panel--debug" aria-label={t('debug.title')}>
      <h2>{t('debug.title')}</h2>
      <dl className="facts">
        <dt>{t('debug.tick')}</dt>
        <dd>{info.tick}</dd>
        <dt>{t('debug.hash')}</dt>
        <dd className="mono">{info.hash.slice(0, 16)}</dd>
      </dl>

      <h3>{t('debug.aiGoal')}</h3>
      {/* Eine Ueberschrift ueber einer leeren Liste ist genau der Befund aus dem
          Playtest (Frage 48): sie sieht kaputt aus, auch wenn nur nichts anliegt. */}
      {info.aiGoals.length === 0 && <p className="muted">{t('debug.noGoals')}</p>}
      <ul className="debug-list">
        {info.aiGoals.map((goal) => (
          <li key={goal.player}>
            <b>{nameOf(goal.player)}</b>: {localizeDebugText(goal.goal, nameOf)}{' '}
            <span className="mono">
              ({t('debug.aiUtility')} {goal.utility})
            </span>
            {goal.alternatives.length > 0 && (
              <div className="debug-alt">
                {t('debug.aiAlternatives')}: {localizeDebugText(goal.alternatives.join(', '), nameOf)}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h3>{t('debug.commandLog')}</h3>
      {info.commands.length === 0 && <p className="muted">{t('debug.noCommands')}</p>}
      <ol className="debug-list mono">
        {info.commands.slice(-12).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  )
}

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const keys = [
    'pause',
    'speedUp',
    'speedDown',
    'fastForward',
    'zoomIn',
    'zoomOut',
    'home',
    'save',
    'load',
    'mapMode',
    'diplomacy',
    'market',
    'escape',
    'help',
  ] as const

  return (
    <Dialog title={t('keys.title')} onClose={onClose}>
      <ul className="keys">
        {keys.map((key) => (
          <li key={key}>{t(`keys.${key}`)}</li>
        ))}
      </ul>
    </Dialog>
  )
}

/** Fonts scale from one place, so "large" is a real change everywhere at once. */
export function fontScaleStyle(settings: Settings): { fontSize: string } {
  return { fontSize: `${FONT_SCALES[settings.fontScale] * 100}%` }
}
