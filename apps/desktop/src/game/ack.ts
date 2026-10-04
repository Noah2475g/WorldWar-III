/**
 * Die Quittung „befohlen“ steht mindestens so lange im Bild (T-M46-11, R-UX-03).
 *
 * Gemessen an S300, 1280x800 (Aufgabenlauf „Kaserne bauen“): die Quittung stand bei Tempo 1 687 ms, bei Tempo
 * 10 269 ms und bei Tempo 100 111 ms im Bild - sie endete mit dem Tick, der den Befehl anwendet, und der kommt bei
 * hohem Tempo nach Millisekunden. Wer klickt und wegsieht, erfuhr nie, ob der Befehl angekommen war. Jetzt gilt eine
 * Untergrenze in Echtzeit, unabhaengig vom Tempo; bei stehender Uhr bleibt die Quittung wie bisher bis zum
 * Weiterlaufen stehen.
 */
export const ACK_MIN_MS = 1500

/** Die Schluessel, unter denen der Befehl einer Armee gehalten wird (Marsch, Beschuss): `army:<Kennung>`. */
export function armyAckKey(armyId: string): string {
  return `army:${armyId}`
}
