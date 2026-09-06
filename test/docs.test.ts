import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseAnswers, parseQuestions, playtestStatus, renderSheet } from '../scripts/playtest-sheet.mjs'
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
const answerSheet = readFileSync(join(ROOT, 'docs/reports/playtest-v1.md'), 'utf8')

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

/**
 * Der Bogen fragt nach dem, was schiefgehen kann (T-M14-15, Befund N10).
 *
 * Er war nach dem Gebauten geschrieben, nicht nach der Anforderung — und ein Bogen, der
 * abfragt, was ohnehin da ist, kann eine Abnahme nur bestehen. Die Fragen unten decken
 * genau die Sachen, die bis zum 2026-09-06 im Kern gebaut, getestet und für den Spieler
 * unerreichbar waren; keine davon fällt in einer einzelnen Sitzung von selbst auf.
 */
describe('R-UI-05/AK1 Der Playtest-Bogen deckt den Abnahmesatz', () => {
  /** Die Zeile einer nummerierten Frage, an ihrer Anforderungs-ID gesucht. */
  const rowsFor = (id: string): string[] =>
    playtest.split('\n').filter((line) => /^\| \d+[a-z]? \|/.test(line) && line.includes(`| ${id} |`))

  it('stellt zu jeder Anforderung des Abnahmesatzes eine eigene Frage', () => {
    for (const id of ['R-GAME-01', 'R-GAME-02', 'R-GAME-03', 'R-GAME-04', 'R-BAT-05', 'R-BAT-07', 'R-PROV-01']) {
      expect(rowsFor(id).length, `Keine Playtest-Frage mit der ID ${id}`).toBeGreaterThan(0)
    }
  })

  it('nennt in der Frage zu R-GAME-01 jede Wahl der Anforderungszeile, die Karte zuerst', () => {
    // Die Anforderung zählt auf: Karte, Anzahl KI-Gegner, eigenes Land, Schwierigkeit,
    // Siegbedingung, Seed. Der Bogen fragte nach vieren davon — und ließ die Karte aus,
    // die als einzige ein Blindschalter war.
    const row = rowsFor('R-GAME-01').find((line) => line.includes('Karte'))
    expect(row, 'Keine R-GAME-01-Frage, die die Karte nennt').toBeDefined()
    for (const choice of ['Karte', 'Macht', 'Gegner', 'Schwierigkeit', 'Siegbedingung', 'Startzahl']) {
      expect(row, `Die Frage zu R-GAME-01 nennt "${choice}" nicht`).toContain(choice)
    }
    expect(row!.indexOf('Karte'), 'Die Karte steht nicht an erster Stelle').toBeLessThan(row!.indexOf('Macht'))
  })

  it('fragt nach dem Neustart des Fensters und nach der Schrift', () => {
    const restart = playtest.split('\n').find((line) => /^\| \d+[a-z]? \|/.test(line) && /Fenster schließen/.test(line))
    expect(restart, 'Keine Frage zum Schließen und Wiederöffnen des Fensters').toBeDefined()

    const font = playtest.split('\n').find((line) => /^\| \d+[a-z]? \|/.test(line) && line.includes('IBM Plex'))
    expect(font, 'Keine Frage zur Schrift IBM Plex').toBeDefined()
  })
})

describe('R-UI-05/AK2 Die Anleitung erklaert die nachgereichten Befehle', () => {
  it('erklaert Rueckzug, Kampfbericht und Bauabbruch', () => {
    // Alle drei sind am 2026-09-06 in der Oberfläche angekommen (T-M14-13). Ein Befehl,
    // den die Anleitung nicht kennt, ist für den Leser nicht vorhanden.
    for (const topic of ['Rückzug', 'Kampfbericht', 'Bauabbruch']) {
      expect(guide, `${topic} fehlt in der Anleitung`).toContain(topic)
    }
  })
})

/**
 * AK-7 wird messbar (T-M14-15).
 *
 * Im Abnahmebericht stand für AK-7 eine feste Zeile „⏳ ausstehend" — ein Kriterium, das
 * seinen Zustand nie ändern kann, ist keins. Ob das Spiel Spaß macht, findet nur ein
 * Mensch heraus; ob er geantwortet hat, ist prüfbar. Und die Regel, an der Abnahmebögen
 * sonst scheitern, wird hier zur Zusicherung: **jedes „nein" braucht einen Befund.**
 */
describe('R-UI-05/AK3 Der Antwortbogen prueft sich selbst', () => {
  const sheet = ['| # | Anforderung | Frage | ja/nein |', '|---|---|---|---|', '| 1 | R-UI-01 | Sieht es aus? | |', '| 2a | R-UI-02 | Lesbar? | |'].join('\n')

  it('zaehlt eine unbeantwortete Frage als offen', () => {
    const answers = ['| Frage | Anforderung | ja/nein | Anmerkung |', '|---|---|---|---|', '| 1 | R-UI-01 | ja | |', '| 2a | R-UI-02 |  | |'].join('\n')
    const status = playtestStatus(sheet, answers)
    expect(status.total).toBe(2)
    expect(status.unanswered).toEqual(['2a'])
    expect(status.ok).toBe(false)
  })

  it('verlangt zu jedem "nein" einen Befund mit derselben Fragenummer', () => {
    const ohne = [
      '| Frage | Anforderung | ja/nein | Anmerkung |',
      '|---|---|---|---|',
      '| 1 | R-UI-01 | ja | |',
      '| 2a | R-UI-02 | nein | |',
      '',
      '## Befunde',
      '| Frage | Was | Wie schlimm |',
      '|---|---|---|',
      '| | | |',
    ].join('\n')
    expect(playtestStatus(sheet, ohne).noWithoutFinding).toEqual(['2a'])

    const mit = ohne.replace('| | | |', '| 2a | Text zu klein | mittel |')
    const status = playtestStatus(sheet, mit)
    expect(status.noWithoutFinding).toEqual([])
    expect(status.ok).toBe(true)
  })

  it('gilt ohne Antwortdatei als offen, nicht als erfuellt', () => {
    // Die gefährliche Richtung des Fehlers: eine fehlende Datei darf nie „bestanden"
    // heißen. Genau so war AK-7 vor dieser Aufgabe formuliert — als Text, nicht als Prüfung.
    const status = playtestStatus(sheet, null)
    expect(status.ok).toBe(false)
    expect(status.answered).toBe(0)
  })

  it('erhaelt beim Neuerzeugen die bereits gegebenen Antworten', () => {
    const previous = ['| Frage | Anforderung | ja/nein | Anmerkung |', '|---|---|---|---|', '| 1 | R-UI-01 | ja | sieht gut aus |'].join('\n')
    const rendered = renderSheet(sheet, previous)
    expect(rendered).toContain('| 1 | R-UI-01 | ja | sieht gut aus |')
    expect(rendered).toContain('| 2a | R-UI-02 |  |')
  })

  it('kennt jede Frage des echten Bogens', () => {
    // Wächst docs/PLAYTEST.md, muss der Antwortbogen mitwachsen — sonst beantwortet Noah
    // einen Bogen, dessen neue Fragen niemand einsammelt.
    const real = playtestStatus(playtest, answerSheet)
    expect(real.total, 'Der Antwortbogen kennt keine Frage').toBeGreaterThan(40)
    expect(parseQuestions(playtest).map((q) => q.nr)).toEqual([...parseAnswers(answerSheet).keys()])
  })
})
