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
 * Bei einem späten Spielstand (`stand-1` in `ux-capture.mjs`) hat jede KI längst einmal
 * strategisch gedacht: `lastStrategicTick` blockiert die Diplomatie-Stufe für 24 Ticks
 * (`decide.ts:104`). Deshalb wird er pro Kandidat zurückgesetzt, und die Prüfung läuft auf
 * einer `probe`-Kopie, deren Tick auf die nächste Denkrunde der Macht vorgespult ist
 * (`shouldThinkThisTick`, `decide.ts:153-156`) — nur `next.tick` bleibt der echte Tick
 * (t_0ff9f671, verifizierte Root-Cause der 90s-Timeouts in evidence3/).
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

  // Dieselbe KI-Spielerliste wie `runAi` (`packages/ai/src/runner.ts:42`), fuer die
  // tick-ausgerichtete Sonde unten.
  const aiPlayers = next.playerOrder.filter((id) => next.players[id]?.kind === 'ai' && next.players[id]?.alive)

  for (const attacker of candidates) {
    next.diplomacy.grievances[attacker] = next.diplomacy.grievances[attacker] ?? {}
    next.diplomacy.grievances[attacker][viewerId] = rules.constants.grievanceMax

    // Zeitsperre der Strategiestufe zuruecksetzen (`decide.ts:104`, `lastStrategicTick`, 24 Tick
    // Abklingzeit): ein spaeter Spielstand hat diese Stufe laengst durchlaufen; ohne Reset wartet
    // die Pruefung auf den naechsten taeglichen Durchlauf statt auf die naechste Denkrunde der
    // Macht — gemessene Ursache fuer "real: true, aber 90s Timeout ohne Ereignis" (t_0ff9f671).
    // Der Groll bleibt die einzige erfundene Groesse; die Zeitsperre ist KI-Buchfuehrung, kein
    // Spielzustand, den ein Betrachter sieht.
    next.ai[attacker] = { ...(next.ai[attacker] ?? {}), lastStrategicTick: -1 }

    // Pruefung auf einer Sonde: nur ihr Tick wird auf die naechste Denkrunde dieser Macht
    // vorgespult (`tick % aiCount === index`, dieselbe Formel wie `shouldThinkThisTick`,
    // `decide.ts:153-156`, hier nachgebaut, keine Importe erlaubt). `next.tick` bleibt der echte
    // Spielstand-Tick — das Vorspulen passiert gleich darauf in echten Ticks (Laden des
    // Spielstands in `ux-capture.mjs` bzw. `advanceTicks` im Test), die Sonde nimmt nur vorweg,
    // was binnen `aiPlayers.length` echter Ticks ohnehin passiert.
    const index = aiPlayers.indexOf(attacker)
    const aiCount = aiPlayers.length
    const delta = aiCount <= 1 ? 0 : ((index % aiCount) - (next.tick % aiCount) + aiCount) % aiCount
    const probe = { ...next, tick: next.tick + delta }

    const result = ai.runAi(probe, { map, rules })
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
