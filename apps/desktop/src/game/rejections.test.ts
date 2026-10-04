import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Command, GameState } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { de } from '../i18n/de.ts'
import { hasKey, t } from '../i18n/text.ts'
import { REASON_KEYS, SPY_REASON_KEYS, describeRejection, reasonKey, type RejectionContext } from './rejections.ts'

/**
 * R-UX-03/AK1 (T-M44-06): jeder Ablehnungsgrund des Kerns hat einen deutschen Satz, nachgeschlagen
 * nach (Befehlstyp, Grund) — und nie das Rohwort des Kerns in Klammern.
 *
 * Der Test **liest den Kern nur** (`packages/core/src/commands`, `rules/espionage.ts`): er sucht jedes
 * `fail('…', { … reason: '…' })` und den zugehörigen `registerCommand('TYP')`, ändert nichts und
 * erfindet keine Liste. Kommt im Kern ein 35. Grund dazu, fällt dieser Test, statt dass der Spieler
 * „(neuer grund)“ liest. Gezählt wird, nicht geschätzt: die Zahl steht in der Meldung des ersten Falls.
 */
const COMMANDS_DIR = fileURLToPath(new URL('../../../../packages/core/src/commands/', import.meta.url))
const SPY_RULES = fileURLToPath(new URL('../../../../packages/core/src/rules/espionage.ts', import.meta.url))

interface CoreFile {
  file: string
  types: string[]
  reasons: string[]
}

/** Je Quelldatei des Kerns: welche Befehlstypen sie anmeldet und welche Freitext-Gründe sie nennt. */
function readCore(): CoreFile[] {
  const files: CoreFile[] = []
  for (const entry of readdirSync(COMMANDS_DIR)) {
    if (!entry.endsWith('.ts') || /\.test\.ts$/.test(entry)) continue
    const text = readFileSync(COMMANDS_DIR + entry, 'utf8')
    const types = [...text.matchAll(/registerCommand<[^>]*>\(\s*'([A-Z_]+)'/g)].map((m) => m[1]!)
    // Nur Gründe in `fail(…)` — `reason: 'byPlayer'` im Ereignis BUILD_CANCELLED ist keine Ablehnung.
    const reasons = [...text.matchAll(/fail\(\s*'[A-Z_]+',\s*\{[^}]*?reason:\s*'([^']+)'/g)].map((m) => m[1]!)
    files.push({ file: entry, types, reasons })
  }
  // Die Zielgründe der Spionage stehen in den Regeln (`spyTargetProblem`) und werden von
  // `commands/espionage.ts` als `reason: problem` weitergereicht.
  const spyRules = readFileSync(SPY_RULES, 'utf8')
  const problems = [...spyRules.matchAll(/\?\s*null\s*:\s*'([^']+)'|return\s+'([^']+)'/g)].map((m) => (m[1] ?? m[2])!)
  files.push({ file: 'rules/espionage.ts', types: ['RECRUIT_SPY', 'REASSIGN_SPY', 'DISMISS_SPY'], reasons: problems })
  return files
}

const core = readCore()
const allReasons = [...new Set(core.flatMap((f) => f.reasons))]

const BUILDING = Object.keys(TEST_RULES.buildings)[0]!

function fakeCtx(): RejectionContext {
  return {
    state: { tick: 0, players: { p2: { nation: 'Mexiko' } } } as unknown as GameState,
    rules: TEST_RULES,
    playerId: 'p1',
    ticksPerDay: 24,
    nameOfProvince: (id) => (id === 'prov-x' ? 'Mittlerer Westen' : id),
  }
}

describe('R-UX-03/AK1 Ablehnungsgründe des Kerns in Spielersprache', () => {
  it('findet die Gründe im Kern — sonst prüft der Wächter das Nichts', () => {
    // Gezählt am 2026-10-03: 50 verschiedene Freitext-Gründe in den Befehlen (ohne `byPlayer`).
    expect(core.filter((f) => f.reasons.length > 0).length).toBeGreaterThanOrEqual(8)
    expect(allReasons.length, `gefundene Gründe: ${allReasons.join(' | ')}`).toBeGreaterThanOrEqual(34)
    expect(allReasons).toContain('kein Angebot')
    expect(allReasons).toContain('bereits im Krieg')
    expect(allReasons).not.toContain('byPlayer')
  })

  it('jeder Grund jeder Kerndatei hat unter einem ihrer Befehlstypen einen Schlüssel', () => {
    const ohne: string[] = []
    for (const f of core) {
      for (const reason of f.reasons) {
        if (!f.types.some((type) => reasonKey(type, reason) !== undefined)) ohne.push(`${f.file}: ${reason}`)
      }
    }
    expect(ohne, `Grund ohne Satz in de.ts:\n${ohne.join('\n')}`).toEqual([])
  })

  it('jeder Eintrag der Tabelle gehört zu einem Grund, den der Kern wirklich nennt (keine Leichen)', () => {
    const tot: string[] = []
    for (const [type, reasons] of Object.entries(REASON_KEYS)) {
      const files = core.filter((f) => f.types.includes(type))
      expect(files.length, `Befehlstyp ${type} kommt im Kern nicht vor`).toBeGreaterThan(0)
      for (const reason of Object.keys(reasons)) {
        if (!files.some((f) => f.reasons.includes(reason))) tot.push(`${type}: ${reason}`)
      }
    }
    expect(tot, `Tabelle kennt einen Grund, den der Kern nicht nennt:\n${tot.join('\n')}`).toEqual([])
  })

  it('jeder Schlüssel existiert in de.ts, und der Satz trägt kein Rohwort in Klammern', () => {
    const pairs: Array<[string, string, string]> = []
    for (const [type, reasons] of Object.entries(REASON_KEYS)) {
      for (const [reason, key] of Object.entries(reasons)) pairs.push([type, reason, key])
    }
    for (const type of ['RECRUIT_SPY', 'REASSIGN_SPY', 'DISMISS_SPY']) {
      for (const [reason, key] of Object.entries(SPY_REASON_KEYS)) pairs.push([type, reason, key])
    }
    expect(pairs.length).toBeGreaterThan(40)
    for (const [type, reason, key] of pairs) {
      expect(hasKey(key), `${type}/${reason}: Schlüssel ${key} fehlt`).toBe(true)
      const sentence = describeRejection(
        { code: 'INVALID_TARGET', detail: { reason, provinceId: 'prov-x', building: BUILDING, resource: 'money' } },
        { type, targetPlayerId: 'p2', playerId: 'p1' } as unknown as Command,
        fakeCtx(),
      )
      expect(sentence, `${type}/${reason}`).toBe(
        t(key, {
          target: 'Mexiko',
          province: 'Mittlerer Westen',
          building: t(`buildings.${BUILDING}`),
          resource: t('resources.money'),
          max: (sentence.match(/\d[\d.]*/) ?? [''])[0],
        }).replace(/\{\{\w+\}\}/g, (m) => m),
      )
      expect(sentence, `${type}/${reason}: Klammer`).not.toMatch(/[()]/)
      expect(sentence, `${type}/${reason}: Platzhalter ungefüllt`).not.toMatch(/\{\{|\[[\w.]+\]/)
      expect(sentence, `${type}/${reason}: Allgemeinsatz statt eigener Satz`).not.toBe(t('errors.INVALID_TARGET'))
    }
  })

  it('ein Grund, den die Tabelle nicht kennt, zeigt den Allgemeinsatz — nie das Rohwort', () => {
    const sentence = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'ein neuer grund' } },
      { type: 'DIPLOMACY', targetPlayerId: 'p2', playerId: 'p1' } as unknown as Command,
      fakeCtx(),
    )
    expect(sentence).toBe(de.errors.INVALID_TARGET)
    expect(sentence).not.toContain('neuer grund')
  })

  it('nennt die Macht beim Namen und nicht die Kennung', () => {
    const sentence = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'bereits im Krieg' } },
      { type: 'DIPLOMACY', targetPlayerId: 'p2', playerId: 'p1', action: 'declareWar' } as unknown as Command,
      fakeCtx(),
    )
    expect(sentence).toBe('Mit Mexiko herrscht schon Krieg.')
    expect(sentence).not.toContain('p2')
  })

  it('Handelsgründe nennen die Provinz mit Namen, nie mit Kennung', () => {
    const sentence = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'umkämpft', provinceId: 'prov-x' } },
      { type: 'OFFER_TRADE', targetPlayerId: 'p2', playerId: 'p1' } as unknown as Command,
      fakeCtx(),
    )
    expect(sentence).toBe(t('trade.blocked.contested', { province: 'Mittlerer Westen' }))
    expect(sentence).not.toContain('prov-x')
  })

  it('eine Frist nach dem Beschuss ist kein Waffenstillstand', () => {
    const ctx = fakeCtx()
    const sentence = describeRejection(
      { code: 'ON_COOLDOWN', detail: { until: 48 } },
      { type: 'BOMBARD', playerId: 'p1' } as unknown as Command,
      ctx,
    )
    expect(sentence).toBe(t('errors.ON_COOLDOWN', { days: 2 }))
    expect(sentence).not.toContain('Waffenstillstand')
  })
})

describe('R-UX-03/AK4 Dorthin führt kein Weg — die wahre Ursache', () => {
  it('NO_PATH nennt nicht „feindliches Gebiet“ (planRoute kennt nur den Kartengraphen)', () => {
    expect(de.errors.NO_PATH).not.toMatch(/feindlich/i)
    expect(de.errors.NO_PATH).toContain('keine Land- oder Seeverbindung')
  })
})

describe('T-M46-15 / VM-01 Teil a: die Moralsperre nennt Zahl und Grenze', () => {
  const recruit = { type: 'RECRUIT', playerId: 'p1', provinceId: 'prov-x', unitKey: 'infantry', count: 1 } as unknown as Command

  it('nennt die Moral der Provinz und die Grenze, abgerundet (nie „25 von 25“)', () => {
    const sentence = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'Moral zu niedrig', morale: 23_825 } },
      recruit,
      fakeCtx(),
    )
    expect(sentence).toContain('Moral 23 von 25 nötig')
    const knapp = describeRejection(
      { code: 'INVALID_TARGET', detail: { reason: 'Moral zu niedrig', morale: 24_999 } },
      recruit,
      fakeCtx(),
    )
    expect(knapp).toContain('Moral 24 von 25 nötig')
  })

  it('ohne Zahl im Detail bleibt der alte Satz (alte Spielstände, Fremdaufrufer)', () => {
    const sentence = describeRejection({ code: 'INVALID_TARGET', detail: { reason: 'Moral zu niedrig' } }, recruit, fakeCtx())
    expect(sentence).toBe(t('refusal.RECRUIT.lowMorale'))
  })
})
