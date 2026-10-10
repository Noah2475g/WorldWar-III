/* global structuredClone */
/**
 * Eine KI-Macht erklärt dem Betrachter wirklich den Krieg (T-M44-03, R-UX-05/AK4 Folgefall).
 *
 * Der Dock-Zustand `attack` (`App.tsx` Zeile ~2535-2567) entsteht nur, wenn ein echter Tick der
 * laufenden Partie ein `WAR_DECLARED`-Ereignis gegen den Betrachter zurückgibt
 * (`isAutoPauseTrigger`, `game/events.ts`). Ein vorab gespeicherter „schon im Krieg"-Spielstand
 * reicht dafür nicht — das Ereignis muss aus einem echten Tick kommen.
 *
 * Hier wird keine Wahrscheinlichkeit erzwungen, sondern das Entscheidungstor der KI selbst
 * geöffnet: `grievances[angreifer][betrachter]` auf den Höchstwert gesetzt, dann **der echte
 * `runAi`** (kein Mock) aufgerufen und geprüft, ob er wirklich `declareWar` gegen den Betrachter
 * befiehlt. Trifft kein Landnachbar im Frieden zu, wird nichts erzwungen — das Ergebnis trägt
 * `real: false` statt eine erfundene Lage zurückzugeben.
 *
 * **Die Funktion ist absichtlich in sich geschlossen** (nur Argumente, keine Importe, keine
 * Hilfsfunktionen außerhalb): wie `grantUntilVictory` wird ihr Quelltext per `.toString()` in
 * die Seite geschickt (`ux-capture.mjs`, Folgeticket) und von `test/ux-war.test.ts` direkt in
 * Node gegen denselben Kern ausgeführt. Derselbe Text, zwei Orte.
 *
 * `core` wird entgegengenommen (gleiche Signatur wie im Auftrag, gleiche Form wie
 * `grantUntilVictory`), aber nicht gebraucht: die Nachbarschaft lässt sich direkt auf dem
 * vollen `GameState` (`next.provinces`/`next.provinceOrder`) bestimmen — `core.publicView`
 * wäre hier eine zusätzliche, unnötige Annahme (R-UX-05, „am wenigsten Annahmen").
 *
 * @param {{ publicView: Function }} core der Kern (ungenutzt, siehe oben; nur der Form halber da)
 * @param {{ runAi: Function }} ai echter `@worldwar/ai`-Produktionsweg
 * @param {any} map die Weltkarte
 * @param {any} rules die geparsten Regeln
 * @param {any} source der Stand, aus dem kopiert wird
 * @param {string} viewerId der Betrachter, dem der Krieg erklärt werden soll
 * @returns {{ next: any, attacker: string|null, real: boolean, reason?: string }}
 */
export function forceWarDeclaration(core, ai, map, rules, source, viewerId) {
  const next = structuredClone(source)

  // Gleiche Schlüsselbildung wie `relationKey` im Kern (`state/create.ts`): sortiert, also
  // unabhängig von der Reihenfolge der Parameter — hier nachgebaut, weil die Funktion
  // keine Importe haben darf.
  const relationKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  // Landnachbarn des Betrachters, auf dem vollen Stand ermittelt (gleiche Logik wie
  // `landNeighbours` in `packages/ai/src/diplomacy.ts`, dort auf der `PublicView`).
  const neighbours = new Set()
  for (const id of next.provinceOrder) {
    const province = next.provinces[id]
    if (province.owner !== viewerId) continue
    for (const neighbourId of province.neighbors) {
      const owner = next.provinces[neighbourId]?.owner
      if (owner && owner !== viewerId) neighbours.add(owner)
    }
  }

  // Kandidaten in fester (Spieler-)Reihenfolge, damit das Ergebnis deterministisch ist.
  const candidates = next.playerOrder.filter((id) => {
    if (!neighbours.has(id)) return false
    const player = next.players[id]
    if (!player || player.kind !== 'ai' || !player.alive) return false
    const relation = next.diplomacy.relations[relationKey(id, viewerId)]
    return relation?.state === 'peace'
  })

  if (candidates.length === 0) {
    return { next: source, attacker: null, real: false, reason: 'kein Landnachbar im Frieden' }
  }

  for (const attacker of candidates) {
    next.diplomacy.grievances[attacker] = next.diplomacy.grievances[attacker] ?? {}
    next.diplomacy.grievances[attacker][viewerId] = rules.constants.grievanceMax

    const result = ai.runAi(next, { map, rules })
    const declares = result.commands.some(
      (command) =>
        command.type === 'DIPLOMACY' &&
        command.playerId === attacker &&
        command.targetPlayerId === viewerId &&
        command.action === 'declareWar',
    )
    if (declares) {
      return { next, attacker, real: true }
    }
  }

  return {
    next: source,
    attacker: null,
    real: false,
    reason: 'kein Kandidat erklärt trotz maximaler Verstimmung den Krieg (Stärkeverhältnis < 800?)',
  }
}
