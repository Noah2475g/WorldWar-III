import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANCEL_REFUND_PERMILLE } from '@worldwar/core'
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
/**
 * Der Entwurf beschreibt, was gebaut wurde (T-M15-01 ff.).
 *
 * Der Nachtrag 2.15 rutschte durch, weil eine Anforderung ohne Entwurfstext niemandem
 * auffiel (T-M14-02b). Die Gegenrichtung fehlte: ein Entwurfskapitel, das seine
 * Anforderungs-ID nicht nennt, ist von ihr aus nicht auffindbar.
 */
describe('R-ARCH-05 Der Entwurf nennt die Anforderungen, die er ausfuehrt', () => {
  const design = readFileSync(join(ROOT, 'docs/plan/02-DESIGN.md'), 'utf8')

  it('traegt zu jedem M15-Kapitel die Anforderung, die es entwirft', () => {
    // Über die Überschriften, nicht über den Fließtext: „Die Migration" kommt auch in
    // D19.1 vor, und ein Test, der die erste Fundstelle nimmt, prüft das falsche Kapitel.
    const chapters = new Map(
      [...design.matchAll(/^### (D19\.\d) ([^\n]+)$/gm)].map((match, index, all) => {
        const start = match.index!
        const end = all[index + 1]?.index ?? design.length
        return [match[1]!, `${match[2]!}\n${design.slice(start, end)}`]
      }),
    )

    for (const [id, requirement] of [
      ['D19.1', 'R-TIME-06'],
      ['D19.2', 'R-TECH-01'],
      ['D19.3', 'R-DIP-06'],
      ['D19.4', 'R-BAT-08'],
      ['D19.5', 'R-GAME-07'],
    ] as const) {
      const section = chapters.get(id)
      expect(section, `Kein Entwurfskapitel ${id}`).toBeDefined()
      expect(section, `${id} nennt ${requirement} nicht`).toContain(requirement)
    }
  })

  it('nennt die drei Felder des Ereignismusters beim Namen', () => {
    const section = design.slice(design.indexOf('### D19.1'), design.indexOf('### D19.2'))
    for (const field of ['audience', 'severity', 'concerns']) {
      expect(section, `D19.1 nennt "${field}" nicht`).toContain(field)
    }
  })
})

/**
 * Eine Entscheidung, die Produktionscode löscht, steht vorher schriftlich (T-M15-06).
 *
 * Der Plan verlangt sie ausdrücklich *bevor* Code fällt — und dieser Test ist der Grund,
 * warum das nicht bloß eine Absichtserklärung ist. 521 Zeilen zu löschen ist die eine
 * Sorte Änderung, die sich nicht mehr aus dem Ergebnis rekonstruieren lässt: hinterher
 * sieht der Baum aus, als hätte es die Alternative nie gegeben.
 */
describe('R-ARCH-05 Die Entscheidung zu T-M15-06 steht in DECISIONS.md', () => {
  const decisions = readFileSync(join(ROOT, 'docs/plan/DECISIONS.md'), 'utf8')
  const section = decisions.slice(decisions.indexOf('## 2026-09-06 · T-M15-06'))

  it('nennt beide Wege, ihre Kosten und den gewählten', () => {
    expect(section.length, 'kein Eintrag zu T-M15-06').toBeGreaterThan(500)
    expect(section, 'der gewählte Weg ist nicht benannt').toContain('Weg **(b)**')
    expect(section, 'der verworfene Weg ist nicht benannt').toContain('Weg (a)')
    expect(section, 'die Kosten des Löschens fehlen').toMatch(/521/)
    expect(section, 'der Preis der gewählten Lösung fehlt').toMatch(/Hauptthread/)
  })
})

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
    // `complete` heisst "vollstaendig ausgefuellt". Ob AK-7 damit erfuellt ist, haengt
    // seit dem 2026-09-07 zusaetzlich daran, WER gefahren ist — siehe unten.
    expect(status.complete).toBe(true)
  })

  /**
   * Wer den Bogen gefahren hat (T-M16-05a).
   *
   * AK-7 verlangt im Wortlaut Noahs Abnahme. Bis zum 2026-09-07 zaehlte dieser Bogen
   * nur, ob jede Frage beantwortet ist — und der Abnahmebericht setzte daraufhin einen
   * Haken hinter AK-7, obwohl der Durchgang vom 2026-09-06 von einem Agenten stammte
   * und die Antwortdatei das in ihrem eigenen Kopf sagte. Der Bericht widersprach sich
   * damit in derselben Datei: die Tabelle meldete "beantwortet", der Satz darunter
   * "offen bleibt AK-7".
   *
   * Die Person ist nicht pruefbar. Ihre ANGABE ist es.
   */
  describe('R-UI-05/AK3 Der Bogen sagt, wer ihn gefahren hat', () => {
    const vollstaendig = [
      '| Frage | Anforderung | ja/nein | Anmerkung |',
      '|---|---|---|---|',
      '| 1 | R-UI-01 | ja | |',
      '| 2a | R-UI-02 | ja | |',
    ].join('\n')

    it('gilt ohne Unterschrift als ausgefuellt, aber nicht als abgenommen', () => {
      const status = playtestStatus(sheet, vollstaendig)
      expect(status.complete).toBe(true)
      expect(status.ok).toBe(false)
      expect(status.author).toBe('')
    })

    it('erkennt einen fremden Durchgang und laesst AK-7 offen', () => {
      const status = playtestStatus(sheet, `**Durchgang von:** ein Agent\n\n${vollstaendig}`)
      expect(status.complete).toBe(true)
      expect(status.byNoah).toBe(false)
      expect(status.ok).toBe(false)
    })

    it('erfuellt AK-7, wenn Noah unterschrieben hat', () => {
      const status = playtestStatus(sheet, `**Durchgang von:** Noah\n\n${vollstaendig}`)
      expect(status.byNoah).toBe(true)
      expect(status.ok).toBe(true)
    })

    it('laesst sich nicht von einem aehnlichen Namen taeuschen', () => {
      // Die sichere Richtung: alles, was nicht Noah ist, ist nicht Noah.
      const status = playtestStatus(sheet, `**Durchgang von:** Noahs Assistent\n\n${vollstaendig}`)
      expect(status.byNoah).toBe(false)
    })
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

/**
 * Die Anleitung sagt über den Bauabbruch, was der Code tut (T-M21-06).
 *
 * Bis zum 2026-09-07 stand dort „**Es gibt nichts zurück**" — der Code erstattet die
 * Hälfte (`CANCEL_REFUND_PERMILLE = 500`), und der Playtest hat es gemessen: +166
 * Material, +125 Geld. Derselbe Irrtum stand im Playtest-Bogen und ist dort am
 * 2026-09-06 berichtigt worden; in der Anleitung stand er noch. **Zwei Wahrheiten über
 * dieselbe Sache, und die berichtigte war die weniger gelesene.**
 *
 * ⚠ **Was dieser Wächter kann und was nicht.** Er prüft *eine* Aussage gegen *eine*
 * Konstante. Er kann nicht prüfen, ob die Anleitung im Allgemeinen mit den Regeln
 * übereinstimmt: Prosa lässt sich nicht gegen JSON diffen, ohne eine
 * Falschmeldungsmaschine zu bauen, die bei jeder Umformulierung anschlägt und die
 * irgendwann jemand abschaltet. Die allgemeine Fehlerklasse — „die Anleitung nennt eine
 * Zahl, die den Regeln widerspricht" — **bleibt ungeprüft**, und das steht so in
 * PROBLEME.md, 2026-09-07. Ein enger Wächter, der sagt, was er kann, ist besser als ein
 * breiter, der es nur behauptet.
 */
describe('R-UI-05 Die Anleitung widerspricht den Regeln nicht', () => {
  const abbruch = guide.slice(guide.indexOf('**Bauabbruch**'), guide.indexOf('**Der Kampfbericht**'))
  // Als Zahl, nicht als Literaltyp: sonst haelt der Compiler jeden Vergleich hier fuer
  // entschieden und meldet genau die Verzweigung als tot, die den Waechter mitwandern
  // laesst, wenn die Konstante sich aendert.
  const erstattung: number = CANCEL_REFUND_PERMILLE

  it('findet den Abschnitt ueberhaupt', () => {
    // Sonst prüfen die beiden folgenden Tests eine leere Zeichenkette und sind grün,
    // ohne etwas gesehen zu haben.
    expect(abbruch.length, 'Kein Abschnitt "Bauabbruch" in der Anleitung').toBeGreaterThan(150)
  })

  it('behauptet nicht, ein Abbruch gebe nichts zurueck', () => {
    if (erstattung === 0) return
    expect(
      abbruch,
      `Die Regeln erstatten ${erstattung} Promille, die Anleitung sagt "nichts zurueck"`,
    ).not.toMatch(/nichts zur(ü|ue)ck/i)
  })

  it('nennt die Haelfte genau dann, wenn die Regeln die Haelfte erstatten', () => {
    // Die Zahl steht damit an zwei Orten, und dieser Test ist der Preis dafür: ändert
    // jemand die Konstante, fällt er, statt die Anleitung still falsch werden zu lassen.
    const sagtHaelfte = /(die )?H(ä|ae)lfte/i.test(abbruch)
    expect(
      sagtHaelfte,
      erstattung === 500
        ? 'Die Regeln erstatten die Haelfte; die Anleitung sagt es nicht'
        : `Die Regeln erstatten ${erstattung} Promille, nicht die Haelfte`,
    ).toBe(erstattung === 500)
  })
})
