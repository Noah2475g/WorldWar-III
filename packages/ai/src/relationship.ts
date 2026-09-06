import type { PlayerId, PublicView, Rules } from '@worldwar/core'

/**
 * Das Verhältnis zu einer fremden Macht (T-M15-05, R-DIP-06).
 *
 * Bis zum 2026-09-06 erklärte die KI den Krieg **allein** nach dem Punkteverhältnis:
 * `standing >= 1200` bei „schwer", `>= 1600` sonst. Ob die andere Macht wortbrüchig ist,
 * ob sie mir eine Provinz genommen hat, ob sie mit meinem Verbündeten im Krieg steht —
 * nichts davon spielte eine Rolle. `reputation` wurde seit M6 geschrieben und von keiner
 * Zeile gelesen. Noahs Vorgabe vom 2026-09-04: *die KI muss auch auf Grundlage der
 * Beziehung angreifen können.*
 *
 * Eine **reine Funktion** über die öffentliche Sicht, aus zwei Gründen. Erstens ist sie
 * damit prüfbar, ohne eine Partie zu spielen. Zweitens — und das ist der wichtigere —
 * kann sie nichts benutzen, was die KI nicht sehen darf: sie bekommt `PublicView` und
 * sonst nichts, also ist R-AI-01 („die KI kann nichts, was ein Mensch nicht kann") nicht
 * eine Zusage, sondern eine Eigenschaft der Signatur.
 */

/** Die Anteile, aus denen sich ein Verhältnis zusammensetzt — für die Erklärung (AK6). */
export interface RelationshipParts {
  /** Öffentliches Ansehen der anderen Macht, 0..1000. */
  reputation: number
  /** Meine Verstimmung gegen sie, 0..1000, negativ gewichtet. */
  grievance: number
  /** Bündnis, gewährter Durchmarsch, geteilte Karte. */
  ties: number
  /** Krieg gegen einen meiner Verbündeten, negativ gewichtet. */
  hostility: number
  /**
   * Truppen an meiner Grenze, negativ gewichtet.
   *
   * Der Anteil, der eine Partie überhaupt in Bewegung bringt. Ohne ihn entsteht in einer
   * Aufstellung ohne Vorgeschichte **nie** ein Krieg: Ansehen startet beim Ausgangswert,
   * Verstimmungen bei null, Bindungen bei null — das Verhältnis stünde bei 1000 und
   * bliebe dort, und der Abnahmelauf AK-1 (mindestens eine Kriegserklärung) wäre
   * unerfüllbar. Truppen an der Grenze sind das, was ohne jedes Zutun entsteht, sobald
   * zwei Mächte rekrutieren — und sie sind öffentlich sichtbar, also kein Bruch von
   * R-DIP-04.
   */
  borderThreat: number
}

export interface Relationship {
  value: number
  parts: RelationshipParts
  /** Der Anteil, der am weitesten vom Mittelwert abweicht — die Begründung in einem Wort. */
  decisive: keyof RelationshipParts
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

/**
 * Das Verhältnis von `view.playerId` zu `other`, 0..1000.
 *
 * 1000 heißt „nichts spricht gegen sie", 0 heißt „Feind". Der Ausgangswert ohne jede
 * Vorgeschichte ist das Ansehen der anderen Macht — wer nichts getan hat, wird nach dem
 * beurteilt, was alle über ihn wissen.
 */
export function relationship(
  view: PublicView,
  other: PlayerId,
  grievances: Record<PlayerId, number>,
  rules: Rules,
): Relationship {
  const power = view.others.find((entry) => entry.id === other)
  const relation = view.relations[other]

  const reputation = clamp(power?.reputation ?? rules.constants.reputationBaseline, 0, 1000)
  const grievance = clamp(grievances[other] ?? 0, 0, rules.constants.grievanceMax)

  // Bündnis wiegt schwerer als Durchmarsch, Durchmarsch schwerer als geteilte Karte:
  // die Reihenfolge dessen, was jemand aufs Spiel setzt, wenn er es gewährt.
  let ties = 0
  if (relation?.state === 'alliance') ties += 300
  if (relation?.rightOfWay) ties += 150
  if (relation?.sharedMap) ties += 50

  // Krieg gegen einen meiner Verbündeten. Das ist der Bündnisfall aus AK2, hier als
  // Verhältniswert — die Kriegserklärung selbst entsteht in diplomacy.ts.
  const allies = new Set(
    Object.entries(view.relations)
      .filter(([, entry]) => entry.state === 'alliance')
      .map(([id]) => id),
  )
  const attacksMyAlly = view.publicWars.some(
    (war) => (war.a === other && allies.has(war.b)) || (war.b === other && allies.has(war.a)),
  )
  const hostility = attacksMyAlly ? 400 : 0

  // Truppen dieser Macht in Provinzen, die an meine grenzen — gemessen an dem, was ich
  // selbst dort stehen habe. Ein Nachbar mit doppelt so vielen Soldaten an der Grenze ist
  // ein Anlass zur Sorge, einer mit gleich vielen nicht.
  const meine = new Set(view.provinces.filter((entry) => entry.owner === view.playerId).map((entry) => entry.id))
  const grenznah = new Set<string>()
  for (const province of view.provinces) {
    if (!meine.has(province.id)) continue
    grenznah.add(province.id)
    for (const neighbour of province.neighbors) grenznah.add(neighbour)
  }

  let ihre = 0
  let unsere = 0
  for (const army of view.armies) {
    if (!grenznah.has(army.provinceId)) continue
    if (army.owner === other) ihre += army.strength
    else if (army.owner === view.playerId) unsere += army.strength
  }
  // Bis 300 Punkte, erreicht bei doppelter Übermacht an der Grenze. Kein Festkomma:
  // das Ergebnis ist ein Verhältniswert in 0..1000, keine Spielgröße.
  const borderThreat = ihre === 0 ? 0 : clamp(Math.trunc((ihre * 300) / Math.max(1, unsere * 2)), 0, 300)

  const value = clamp(reputation - grievance + ties - hostility - borderThreat, 0, 1000)

  // Der ausschlaggebende Anteil: der grösste Beitrag, der nicht der Ausgangswert ist.
  // Ohne diese Unterscheidung wäre die Antwort immer "reputation", weil sie den
  // Grundwert stellt — und die Erklärung sagte nichts (AK6).
  const parts: RelationshipParts = { reputation, grievance, ties, hostility, borderThreat }
  const weights: [keyof RelationshipParts, number][] = [
    ['grievance', grievance],
    ['hostility', hostility],
    ['borderThreat', borderThreat],
    ['ties', ties],
  ]
  let decisive: keyof RelationshipParts = 'reputation'
  let strongest = Math.abs(reputation - rules.constants.reputationBaseline)
  for (const [name, weight] of weights) {
    if (weight > strongest) {
      strongest = weight
      decisive = name
    }
  }

  return { value, parts, decisive }
}

/** Das Verhältnis in einem Satz, für die Begründung im Debug-Modus (R-AI-05, AK6). */
export function explainRelationship(result: Relationship): string {
  const names: Record<keyof RelationshipParts, string> = {
    reputation: 'Ansehen',
    grievance: 'Verstimmung',
    ties: 'Bindungen',
    hostility: 'Krieg gegen meinen Verbündeten',
    borderThreat: 'Truppen an meiner Grenze',
  }
  return `Verhältnis ${result.value} (ausschlaggebend: ${names[result.decisive]} ${result.parts[result.decisive]})`
}
