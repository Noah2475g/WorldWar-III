import { quotFixed } from '@worldwar/shared'
import type { Command, PlayerId } from '@worldwar/core'
import { explainRelationship, relationship } from './relationship'
import type { AiContext, Explanation } from './types'

/**
 * Diplomatic decisions (R-DIP-03, R-DIP-06, T-M7-04, T-M15-05).
 *
 * The rules are deliberately legible rather than clever: accept peace when the war is
 * going badly, do not open a second front you cannot hold, and stay out of wars that
 * are not yours. A player should be able to predict roughly what an opponent will do —
 * unpredictability is not the same thing as difficulty.
 *
 * Seit dem 2026-09-06 entscheidet **das Verhältnis** über den Krieg, nicht mehr allein
 * das Punkteverhältnis. Der Grundlauf davor (`docs/reports/ai-tournament.md`) sagt,
 * warum: „schwer gegen normal" endete 25:25, und zwar so, dass in allen 50 Partien die
 * erste Nation gewann — die Stufe entschied nichts. In 150 Partien endete kein einziger
 * Krieg. Und `reputation` wurde seit M6 geschrieben und von keiner Zeile gelesen.
 */

/** How many wars this AI is currently in. */
export function activeWars(context: AiContext): PlayerId[] {
  return Object.entries(context.view.relations)
    .filter(([, relation]) => relation.state === 'war')
    .map(([id]) => id)
}

/** Relative standing: our score against theirs, 1000 means equal. */
function standing(context: AiContext, other: PlayerId): number {
  const own = Math.max(1, context.view.self.score)
  const theirs = Math.max(1, context.view.others.find((entry) => entry.id === other)?.score ?? 1)
  return quotFixed(own, theirs)
}

/** Die Mächte, an deren Gebiet ich unmittelbar grenze — in fester Reihenfolge. */
function landNeighbours(context: AiContext): PlayerId[] {
  const playerId = context.view.playerId
  const neighbours = new Set<PlayerId>()
  for (const province of context.view.provinces) {
    if (province.owner !== playerId) continue
    for (const id of province.neighbors) {
      const owner = context.view.provinces.find((entry) => entry.id === id)?.owner
      if (owner && owner !== playerId) neighbours.add(owner)
    }
  }
  return [...neighbours].sort()
}

/**
 * Hat sich in diesem Krieg seit `days` Spieltagen keine Provinz mehr bewegt?
 *
 * Abgeleitet aus `occupiedSince` der sichtbaren Provinzen — **kein neues Zustandsfeld**.
 * Das ist der Grund, warum es hier steht und nicht im Kern: die Frage „ist dieser Krieg
 * festgefahren" ist aus dem beantwortbar, was ohnehin jeder sehen kann, und ein Feld
 * dafür hätte eine zweite Schemastufe in M15 gekostet (DECISIONS.md, 2026-09-06).
 */
function stalemate(context: AiContext, other: PlayerId, days: number): boolean {
  const relation = context.view.relations[other]
  if (!relation) return false

  const window = days * context.rules.constants.ticksPerDay
  // Der Krieg muss überhaupt so lange laufen — sonst wäre jeder frische Krieg sofort
  // "festgefahren", weil noch nichts passiert sein *konnte*.
  if (context.view.tick - relation.sinceTick < window) return false

  const beteiligt = context.view.provinces.filter(
    (province) => province.owner === context.view.playerId || province.owner === other,
  )
  if (beteiligt.length === 0) return false

  return beteiligt.every((province) => context.view.tick - (province.occupiedSince ?? 0) >= window)
}

export function diplomacyCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const playerId = context.view.playerId
  const wars = activeWars(context)
  const rules = context.rules
  const grievances = context.view.self.grievances

  /**
   * Das Verhältnis, **einmal je Macht und Tick** (R-AI-04).
   *
   * `relationship` läuft über alle Provinzen und Armeen der Sicht, um die Truppen an der
   * eigenen Grenze zu zählen — auf der Weltkarte sind das 237 und ein paar hundert. Der
   * Wert wird hier bis zu viermal je Gegner gebraucht (Friedensfrage, Bündnis, Durchmarsch,
   * Kriegsentscheidung), und ohne diese Ablage stieg der KI-Anteil an der Tickzeit auf
   * **51,7 %** — über die Grenze aus R-AI-04. Die Sicht ändert sich innerhalb eines Ticks
   * nicht, also ist die Ablage nicht nur schneller, sondern auch richtiger als vier
   * getrennte Rechnungen auf demselben Zustand.
   */
  const abgelegt = new Map<PlayerId, ReturnType<typeof relationship>>()
  const towards = (other: PlayerId) => {
    let wert = abgelegt.get(other)
    if (!wert) {
      wert = relationship(context.view, other, grievances, rules)
      abgelegt.set(other, wert)
    }
    return wert
  }

  // 1. Answer standing offers first.
  for (const [other, relation] of Object.entries(context.view.relations)) {
    if (relation.state !== 'war') continue

    const ratio = standing(context, other)
    const feindselig = towards(other).value < context.difficulty.warThreshold

    // Losing: take the way out. Angenommen wird nur, was auch angeboten wurde
    // (T-M14-12, Befund 41): vorher warf die KI acceptPeace ins Blaue, weil die Sicht
    // die eingehenden Angebote gar nicht fuehrte — 99 % dieser Befehle wurden
    // abgelehnt, und zwischen zwei KI-Maechten konnte ein Krieg strukturell fast nie
    // enden, weil beide anboten und keine das Angebot der anderen sah.
    //
    // R-DIP-06/AK4 (T-M15-05): Unterlegenheit ist nicht mehr der einzige Grund. Ein
    // Krieg, in dem seit Tagen keine Provinz mehr wechselt, kostet beide Seiten Unterhalt
    // und bringt keiner etwas — und ohne diese Bedingung endete in 150 Turnierpartien
    // **kein einziger** Krieg.
    const unterlegen = ratio < 900
    const festgefahren = !feindselig && stalemate(context, other, rules.constants.stalemateDaysBeforePeace)
    if (!unterlegen && !festgefahren) continue

    const liegtVor = context.view.incomingOffers.some(
      (offer) => offer.from === other && offer.kind === 'peace',
    )
    if (liegtVor) {
      commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'acceptPeace' })
    } else {
      commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'offerPeace' })
    }
    explanations.push({
      action: `Sucht Frieden mit ${other}`,
      reason: unterlegen ? `unterlegen (Verhältnis ${ratio})` : `festgefahren seit ${rules.constants.stalemateDaysBeforePeace} Tagen`,
      score: 850,
      alternative: { action: 'weiterkämpfen', score: 200 },
    })
  }

  // 1b. Bündnisangebote (R-DIP-06/AK3). Das Ansehen entscheidet, nicht das Verhältnis:
  // wer wortbrüchig ist, ist ein schlechter Bündnispartner, auch wenn er mir nie etwas
  // getan hat. Umgekehrt macht ein hohes Verhältnis aus einem Wortbrüchigen keinen
  // Verlässlichen — deshalb zwei Schwellen und nicht eine.
  for (const offer of context.view.incomingOffers) {
    if (offer.kind !== 'alliance') continue
    const ansehen = context.view.others.find((entry) => entry.id === offer.from)?.reputation ?? 0
    if (ansehen < context.difficulty.trustThreshold) {
      explanations.push({
        action: `Bündnis mit ${offer.from} abgelehnt`,
        reason: `Ansehen ${ansehen} unter der Vertrauensschwelle ${context.difficulty.trustThreshold}`,
        score: 100,
      })
      continue
    }
    commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: offer.from, action: 'acceptAlliance' })
    explanations.push({
      action: `Bündnis mit ${offer.from} angenommen`,
      reason: `Ansehen ${ansehen}, ${explainRelationship(towards(offer.from))}`,
      score: 700,
    })
  }

  // 1c. Gewährter Durchmarsch wird erwidert, wenn das Verhältnis stimmt (R-DIP-06/AK3).
  // Eine Geste, die nie beantwortet wird, ist keine Diplomatie, sondern eine Einbahnstraße.
  for (const other of Object.keys(context.view.relations).sort()) {
    const relation = context.view.relations[other]!
    if (!relation.rightOfWay || relation.state === 'war') continue
    const wert = towards(other)
    if (wert.value < context.difficulty.trustThreshold) continue
    commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'grantRightOfWay' })
    explanations.push({
      action: `Durchmarsch für ${other} erwidert`,
      reason: explainRelationship(wert),
      score: 500,
    })
  }

  // 2. Do not start what cannot be finished.
  if (wars.length >= context.difficulty.maxFronts) {
    explanations.push({
      action: 'Keine neue Kriegserklärung',
      reason: `bereits ${wars.length} Krieg(e), Grenze ${context.difficulty.maxFronts}`,
      score: 0,
    })
    return commands
  }

  // 3. Der Bündnisfall (R-DIP-06/AK2) hat Vorrang vor der eigenen Rechnung: wer seinen
  // Verbündeten im Stich lässt, hat beim nächsten Mal keinen. Braucht `publicWars` —
  // `relations` führt nur meine eigenen Beziehungen, und damit war der Fall bis zum
  // 2026-09-06 gar nicht entscheidbar.
  const allies = new Set(
    Object.entries(context.view.relations)
      .filter(([, relation]) => relation.state === 'alliance')
      .map(([id]) => id),
  )
  for (const war of context.view.publicWars) {
    const angreifer = allies.has(war.a) ? war.b : allies.has(war.b) ? war.a : null
    if (!angreifer || angreifer === playerId || allies.has(angreifer)) continue
    if (context.view.relations[angreifer]?.state !== 'peace') continue

    commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: angreifer, action: 'declareWar' })
    explanations.push({
      action: `Erklärt ${angreifer} den Krieg`,
      reason: `Bündnisfall — greift meinen Verbündeten an, ${explainRelationship(towards(angreifer))}`,
      score: 800,
      alternative: { action: 'Bündnis brechen', score: 100 },
    })
    return commands
  }

  // 4. Der Krieg gegen einen Nachbarn: **Verhältnis** und Stärke, in dieser Reihenfolge.
  //
  // Vorher hing die Entscheidung allein am Punkteverhältnis, mit einer Schwelle, die aus
  // `maxFronts` abgeleitet war (`maxFronts >= 3 ? 1200 : 1600`). Ein gleich starker
  // Nachbar bekam nie eine Kriegserklärung, gleich was er getan hatte, und ein
  // schwächerer bekam sie immer, gleich wie gut man sich verstand. Beides ist keine
  // Diplomatie.
  for (const other of landNeighbours(context)) {
    const relation = context.view.relations[other]
    if (!relation || relation.state !== 'peace') continue

    const wert = towards(other)
    const ratio = standing(context, other)

    // **Das Verhältnis ist das Tor, die Stärke verschiebt nur seine Schwelle.**
    //
    // Nicht umgekehrt, und das ist der Kern dieser Aufgabe: eine Übermacht allein reicht
    // nicht mehr. Vorher bekam ein schwächerer Nachbar die Kriegserklärung *immer*, gleich
    // wie gut man sich verstand — ein Spiel, in dem Wohlverhalten nichts nützt, hat keine
    // Diplomatie, sondern eine Rangliste. Umgekehrt macht Übermacht einen ohnehin
    // schwelenden Streit eher zum Krieg, und das soll sie: sonst wäre die Stärke ohne
    // jeden Einfluss, und die Grenze zwischen "gereizt" und "gereizt und im Vorteil"
    // verschwände.
    // Die Obergrenze der Verlockung ist **450 und nicht 200**, und das ist die Antwort auf
    // einen gemessenen Befund: mit 200 endete die ausgelieferte Standardpartie nicht mehr.
    // Der Führende kam auf 127 Provinzen und **57 % der Punkte**, brauchte 70 % — und hörte
    // ab Spieltag 900 auf, sich auszudehnen, weil er zu den Restmächten schlicht kein
    // schlechtes Verhältnis mehr hatte. Das Verhältnis ist das Tor für *gewöhnliche*
    // Entscheidungen; eine erdrückende Übermacht ist irgendwann ihr eigenes Argument, sonst
    // gibt es keine Partie, die zu Ende geht. 450 liegt bewusst knapp über der Skala des
    // Verhältnisses (0..1000): erst bei einem Stärkeverhältnis von rund 1:2,8 kann selbst
    // ein tadelloses Verhältnis überstimmt werden — ein Nachbar mit doppelten Punkten und
    // gutem Verhältnis bleibt unbehelligt (R-DIP-06/AK1, zweite Richtung).
    const verlockung = Math.max(0, Math.min(450, Math.trunc((ratio - 1000) / 4)))
    const schwelle = context.difficulty.warThreshold + verlockung
    if (wert.value >= schwelle) {
      // Auch das Nichtstun wird begründet (R-AI-05). Eine Debug-Ansicht, die nur zeigt,
      // was geschehen *ist*, beantwortet die häufigere Frage nicht: warum passiert nichts?
      explanations.push({
        action: `Frieden mit ${other} gehalten`,
        reason: `${explainRelationship(wert)} über der Schwelle ${schwelle}, Stärkeverhältnis ${ratio}`,
        score: 400,
        alternative: { action: `${other} den Krieg erklären`, score: 200 },
      })
      continue
    }
    // Und niemand erklärt hoffnungslos unterlegen den Krieg — sonst stürzt sich eine
    // gedemütigte Kleinmacht auf die Großmacht und ist am nächsten Tag weg.
    if (ratio < 800) continue

    commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'declareWar' })
    explanations.push({
      action: `Erklärt ${other} den Krieg`,
      reason: `${explainRelationship(wert)} unter der Schwelle ${schwelle}, Stärkeverhältnis ${ratio}`,
      score: 700,
      alternative: { action: 'Frieden halten', score: 400 },
    })
    break
  }

  return commands
}
