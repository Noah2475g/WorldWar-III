import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './guards/scan'

/**
 * The documents a player and a tester get (T-M12-02).
 *
 * A playtest sheet is only useful if a "no" points somewhere: every question carries
 * the requirement id it checks. And the guide has to explain the one thing this game
 * exists for — the speed control — or it explains nothing.
 */

const guide = readFileSync(join(ROOT, 'docs/ANLEITUNG.md'), 'utf8')
const playtest = readFileSync(join(ROOT, 'docs/PLAYTEST.md'), 'utf8')

describe('R-UI-05 Die Anleitung erklaert das Spiel', () => {
  it('erklaert die Bedienung', () => {
    for (const topic of ['Kartenmodi', 'Tastatur', 'Speichern', 'Moral']) {
      expect(guide, `${topic} fehlt`).toContain(topic)
    }
  })

  it('erklaert die Geschwindigkeitsregelung ausfuehrlich', () => {
    // The one thing this game exists for. A guide that mentions it in passing explains
    // nothing.
    const section = guide.slice(guide.indexOf('## Die Geschwindigkeitsregelung'))
    expect(section.length).toBeGreaterThan(600)
    expect(section).toContain('Vorspulen')
    expect(section).toContain('Spielstunden je Sekunde')
  })

  it('nennt jede Taste, die das Spiel kennt', () => {
    for (const key of ['Leertaste', 'Strg+S', 'F1', 'Escape', 'Pfeiltasten']) {
      expect(guide, `${key} fehlt`).toContain(key)
    }
  })

  it('sagt, was die KI darf', () => {
    expect(guide).toContain('ohne Bonus')
  })
})

describe('R-UI-05 Die Playtest-Vorlage', () => {
  it('gibt jeder Frage eine Anforderungs-ID', () => {
    const rows = playtest.split('\n').filter((line) => /^\| \d+ \|/.test(line))

    expect(rows.length).toBeGreaterThanOrEqual(25)
    for (const row of rows) {
      expect(row, `ohne Anforderungs-ID: ${row.slice(0, 40)}`).toMatch(/R-[A-Z]+-\d+/)
    }
  })

  it('deckt jeden Anforderungsbereich ab', () => {
    // One question per area at least, or a whole part of the game goes untested.
    for (const area of ['R-UI', 'R-TIME', 'R-MAP', 'R-ECON', 'R-BAT', 'R-DIP', 'R-AI', 'R-GAME', 'R-FREE']) {
      expect(playtest, `${area} kommt nicht vor`).toContain(area)
    }
  })

  it('stellt die Kernfragen', () => {
    expect(playtest).toContain('Wollten Sie weiterspielen')
    expect(playtest).toContain('gewartet')
    expect(playtest).toContain('schummelt')
  })

  it('sagt, wie man das Spiel startet', () => {
    expect(playtest).toContain('pnpm')
  })
})

/**
 * Die Dokumente ziehen mit dem Ausbau mit (T-M13-17, R-UI-03).
 *
 * Eine Anleitung, die eine Woche alt ist, ist schlimmer als keine: sie beschreibt ein
 * Spiel, das es nicht mehr gibt, und der Leser sucht den Fehler bei sich.
 */
describe('R-UI-03 Anleitung und Playtest kennen den Ausbau', () => {
  it('erklaert die neuen Teile der Oberflaeche', () => {
    for (const topic of ['Lage der Mächte', 'Meldungen', 'Siegziel', 'filtern', 'Truppenstärke']) {
      expect(guide, `${topic} fehlt in der Anleitung`).toContain(topic)
    }
  })

  it('nennt den alten Kartenmodus nicht mehr', () => {
    // "Bedrohung" gibt es nicht mehr; eine Anleitung, die ihn noch anbietet, schickt den
    // Leser zu einem Menuepunkt, den es nicht gibt.
    expect(guide).not.toContain('**Bedrohung**')
  })

  it('stellt zu jeder neuen Anforderung mindestens eine Playtest-Frage', () => {
    for (const id of ['R-UI-08', 'R-UI-09', 'R-UI-10', 'R-UI-11', 'R-UI-12', 'R-UI-13', 'R-UI-14', 'R-MAP-07']) {
      expect(playtest, `Keine Playtest-Frage zu ${id}`).toContain(id)
    }
  })
})
