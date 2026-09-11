/**
 * Eine echte Pfadabfahrt fuer die Koordinatenwaechter beider Bildsaetze (T-M33-01).
 *
 * Der Vorgaenger stand in `icons.test.tsx` und zog die Zahlen mit `/-?d+(.d+)?/g` aus
 * dem Pfadstring. Der Ausdruck sucht den BUCHSTABEN `d`, nicht die Ziffer `\d` — er fand
 * in keinem der 44 Symbole etwas, `Math.max()` ueber der leeren Liste ergab `-Infinity`,
 * und beide Zusicherungen waren seit Monaten leer gruen. Selbst richtig geschrieben
 * waere er falsch gewesen: in `h-12` ist die −12 eine LAENGE, keine Koordinate, und in
 * `a9 5 0 1 0 18 0` sind fuenf der sieben Zahlen Radien und Flags.
 *
 * Deshalb wird der Stift hier wirklich gefuehrt. Jeder Befehl bewegt ihn, und in den
 * Kasten geht nur, wo er tatsaechlich hinkommt: Endpunkte, die Extrema der Bezierkurven
 * (exakt ueber die Nullstellen der Ableitung, nicht abgetastet) und der Bogen ueber eine
 * dichte Abtastung seiner Mittelpunktsform.
 *
 * Der Bogen ist die eine Naeherung in dieser Datei. 256 Punkte je Bogen halten den
 * Fehler unter `r · 1e-4` — bei einem Radius von 9 also unter einem Tausendstel Pixel,
 * eine Groessenordnung, in der keine dieser Zeichnungen entworfen ist.
 */

export interface Box {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** Wie fein ein Bogen abgetastet wird. Siehe Kopfkommentar. */
const ARC_SAMPLES = 256

const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g

type Token = { command: string } | { number: number }

function tokenize(d: string): Token[] {
  const out: Token[] = []
  let index = 0
  for (const match of d.matchAll(TOKEN)) {
    // Alles zwischen zwei Treffern muss Trennzeichen sein. Ein Buchstabe, den der
    // Ausdruck nicht kennt, faellt sonst still unter den Tisch — genau die Bauart des
    // Fehlers, den diese Datei ersetzt.
    const zwischenraum = d.slice(index, match.index)
    if (/[^\s,]/.test(zwischenraum)) {
      throw new SyntaxError(`Unbekanntes Zeichen "${zwischenraum.trim()}" im Pfad`)
    }
    index = match.index + match[0].length
    out.push(match[1] ? { command: match[1] } : { number: Number(match[2]) })
  }
  if (/[^\s,]/.test(d.slice(index))) {
    throw new SyntaxError(`Unbekanntes Zeichen "${d.slice(index).trim()}" am Pfadende`)
  }
  return out
}

/** Wie viele Zahlen ein Befehl je Wiederholung frisst. */
const ARITY: Record<string, number> = {
  M: 2, L: 2, T: 2,
  H: 1, V: 1,
  C: 6, S: 4, Q: 4,
  A: 7,
  Z: 0,
}

/**
 * Die Extrema einer quadratischen Bezierkurve in einer Achse — exakt.
 *
 * Nur die Nullstelle der Ableitung zaehlt, und nur wenn sie im Intervall liegt. Die
 * Endpunkte kommen ohnehin ueber den Stift in den Kasten.
 */
function quadraticExtrema(p0: number, p1: number, p2: number): number[] {
  const nenner = p0 - 2 * p1 + p2
  if (Math.abs(nenner) < 1e-12) return []
  const t = (p0 - p1) / nenner
  if (t <= 0 || t >= 1) return []
  const s = 1 - t
  return [s * s * p0 + 2 * s * t * p1 + t * t * p2]
}

/** Dasselbe fuer die kubische Kurve: zwei mögliche Nullstellen statt einer. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = p1 - p0
  const werte: number[] = []

  const einsetzen = (t: number): void => {
    if (t <= 0 || t >= 1) return
    const s = 1 - t
    werte.push(s * s * s * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t * p3)
  }

  if (Math.abs(3 * a) < 1e-12) {
    if (Math.abs(b) > 1e-12) einsetzen(-c / b)
    return werte
  }
  const diskriminante = b * b - 4 * (3 * a) * c
  if (diskriminante < 0) return werte
  const wurzel = Math.sqrt(diskriminante)
  einsetzen((-b + wurzel) / (6 * a))
  einsetzen((-b - wurzel) / (6 * a))
  return werte
}

interface Pen {
  x: number
  y: number
}

/**
 * Der elliptische Bogen in Mittelpunktsform (SVG 1.1, F.6.5) und dann abgetastet.
 *
 * Ohne diesen Schritt waere jeder Kreis dieses Projekts falsch gemessen: `armour` ist
 * `M3 12a9 5 …`, und seine Zahlen sagen nichts darueber, dass der Bogen bis y = 7
 * hinauf und bis y = 17 hinunter reicht.
 */
function arcPoints(from: Pen, rx: number, ry: number, drehung: number, grossBogen: number, richtung: number, to: Pen): Pen[] {
  if (rx === 0 || ry === 0) return [to]

  const phi = (drehung * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx2 = (from.x - to.x) / 2
  const dy2 = (from.y - to.y) / 2
  const x1 = cos * dx2 + sin * dy2
  const y1 = -sin * dx2 + cos * dy2

  let a = Math.abs(rx)
  let b = Math.abs(ry)
  // Zu kleine Radien werden nach SVG gleichmaessig aufgeblasen, bis der Bogen passt.
  const zuKlein = (x1 * x1) / (a * a) + (y1 * y1) / (b * b)
  if (zuKlein > 1) {
    const faktor = Math.sqrt(zuKlein)
    a *= faktor
    b *= faktor
  }

  const zaehler = a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1
  const nenner = a * a * y1 * y1 + b * b * x1 * x1
  const betrag = Math.sqrt(Math.max(0, zaehler / nenner)) * (grossBogen === richtung ? -1 : 1)
  const cx1 = (betrag * a * y1) / b
  const cy1 = (-betrag * b * x1) / a
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2

  const winkel = (ux: number, uy: number, vx: number, vy: number): number => {
    const punkt = ux * vx + uy * vy
    const laenge = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
    const roh = Math.acos(Math.min(1, Math.max(-1, punkt / laenge)))
    return ux * vy - uy * vx < 0 ? -roh : roh
  }

  const start = winkel(1, 0, (x1 - cx1) / a, (y1 - cy1) / b)
  let spanne = winkel((x1 - cx1) / a, (y1 - cy1) / b, (-x1 - cx1) / a, (-y1 - cy1) / b)
  if (richtung === 0 && spanne > 0) spanne -= 2 * Math.PI
  if (richtung === 1 && spanne < 0) spanne += 2 * Math.PI

  const punkte: Pen[] = []
  for (let i = 1; i <= ARC_SAMPLES; i++) {
    const theta = start + (spanne * i) / ARC_SAMPLES
    const ex = Math.cos(theta) * a
    const ey = Math.sin(theta) * b
    punkte.push({ x: cx + cos * ex - sin * ey, y: cy + sin * ex + cos * ey })
  }
  return punkte
}

/**
 * Faehrt den Pfad ab und meldet den Kasten, den er wirklich braucht.
 *
 * Wirft bei allem, was sie nicht versteht. Ein Waechter, der einen unbekannten Befehl
 * ueberspringt, misst wieder weniger als er behauptet.
 */
export function pathBounds(d: string): Box {
  const tokens = tokenize(d)
  const box: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  const merken = (punkt: Pen): void => {
    box.minX = Math.min(box.minX, punkt.x)
    box.maxX = Math.max(box.maxX, punkt.x)
    box.minY = Math.min(box.minY, punkt.y)
    box.maxY = Math.max(box.maxY, punkt.y)
  }

  const pen: Pen = { x: 0, y: 0 }
  let start: Pen = { x: 0, y: 0 }
  /** Der gespiegelte Kontrollpunkt fuer S und T — null, wenn es keinen gibt. */
  let letzterKontroll: Pen | null = null
  let befehl = ''
  let gelesen = 0

  const naechste = (): number => {
    const token = tokens[gelesen++]
    if (!token || !('number' in token)) throw new SyntaxError(`Zu wenige Zahlen nach "${befehl}"`)
    return token.number
  }

  while (gelesen < tokens.length) {
    const token = tokens[gelesen]!
    if ('command' in token) {
      befehl = token.command
      gelesen++
    } else if (befehl === '') {
      throw new SyntaxError('Der Pfad beginnt ohne Befehl')
    } else if (befehl === 'M') {
      // Weitere Zahlenpaare nach einem M sind Linien, kein zweites M (SVG 8.3.2).
      befehl = 'L'
    } else if (befehl === 'm') {
      befehl = 'l'
    }

    const gross = befehl.toUpperCase()
    const relativ = befehl !== gross
    const stellen = ARITY[gross]
    if (stellen === undefined) throw new SyntaxError(`Unbekannter Pfadbefehl "${befehl}"`)

    const dx = relativ ? pen.x : 0
    const dy = relativ ? pen.y : 0

    if (gross === 'Z') {
      pen.x = start.x
      pen.y = start.y
      letzterKontroll = null
      merken(pen)
      continue
    }
    if (stellen > 0 && !('number' in (tokens[gelesen] ?? { command: '' }))) {
      throw new SyntaxError(`"${befehl}" ohne Zahlen`)
    }

    if (gross === 'M') {
      pen.x = naechste() + dx
      pen.y = naechste() + dy
      start = { x: pen.x, y: pen.y }
      letzterKontroll = null
      merken(pen)
      continue
    }
    if (gross === 'L') {
      pen.x = naechste() + dx
      pen.y = naechste() + dy
      letzterKontroll = null
      merken(pen)
      continue
    }
    if (gross === 'H') {
      pen.x = naechste() + dx
      letzterKontroll = null
      merken(pen)
      continue
    }
    if (gross === 'V') {
      pen.y = naechste() + dy
      letzterKontroll = null
      merken(pen)
      continue
    }
    if (gross === 'C' || gross === 'S') {
      const erster =
        gross === 'C'
          ? { x: naechste() + dx, y: naechste() + dy }
          : { x: 2 * pen.x - (letzterKontroll?.x ?? pen.x), y: 2 * pen.y - (letzterKontroll?.y ?? pen.y) }
      const zweiter = { x: naechste() + dx, y: naechste() + dy }
      const ziel = { x: naechste() + dx, y: naechste() + dy }
      for (const wert of cubicExtrema(pen.x, erster.x, zweiter.x, ziel.x)) merken({ x: wert, y: pen.y })
      for (const wert of cubicExtrema(pen.y, erster.y, zweiter.y, ziel.y)) merken({ x: pen.x, y: wert })
      letzterKontroll = zweiter
      pen.x = ziel.x
      pen.y = ziel.y
      merken(pen)
      continue
    }
    if (gross === 'Q' || gross === 'T') {
      const kontroll: Pen =
        gross === 'Q'
          ? { x: naechste() + dx, y: naechste() + dy }
          : { x: 2 * pen.x - (letzterKontroll?.x ?? pen.x), y: 2 * pen.y - (letzterKontroll?.y ?? pen.y) }
      const ziel = { x: naechste() + dx, y: naechste() + dy }
      for (const wert of quadraticExtrema(pen.x, kontroll.x, ziel.x)) merken({ x: wert, y: pen.y })
      for (const wert of quadraticExtrema(pen.y, kontroll.y, ziel.y)) merken({ x: pen.x, y: wert })
      letzterKontroll = kontroll
      pen.x = ziel.x
      pen.y = ziel.y
      merken(pen)
      continue
    }
    // A
    const rx = naechste()
    const ry = naechste()
    const drehung = naechste()
    const grossBogen = naechste()
    const richtung = naechste()
    const ziel = { x: naechste() + dx, y: naechste() + dy }
    for (const punkt of arcPoints(pen, rx, ry, drehung, grossBogen, richtung, ziel)) merken(punkt)
    letzterKontroll = null
    pen.x = ziel.x
    pen.y = ziel.y
    merken(pen)
  }

  if (box.minX === Infinity) throw new SyntaxError('Der Pfad zeichnet nichts')
  return box
}

/**
 * Was an einem Pfad aus dem Kasten ragt, als Saetze — leer heisst: er passt.
 *
 * Die Toleranz ist die Abtastung des Bogens wert und nicht mehr: ein Zehntausendstel
 * Pixel. Wer sie groesser macht, macht den Waechter weicher, nicht genauer.
 */
export function outsideBox(d: string, width: number, height: number): string[] {
  const box = pathBounds(d)
  const toleranz = 1e-4
  const funde: string[] = []
  if (box.minX < -toleranz) funde.push(`links bis x = ${box.minX.toFixed(2)}`)
  if (box.maxX > width + toleranz) funde.push(`rechts bis x = ${box.maxX.toFixed(2)} (Kasten ${width})`)
  if (box.minY < -toleranz) funde.push(`oben bis y = ${box.minY.toFixed(2)}`)
  if (box.maxY > height + toleranz) funde.push(`unten bis y = ${box.maxY.toFixed(2)} (Kasten ${height})`)
  return funde
}
