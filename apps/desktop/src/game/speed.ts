/**
 * Die Geschwindigkeitsstufen der Uhr (R-TIME-02, T-M15-06).
 *
 * Gerettet aus `sim/SimHost.ts`, das am 2026-09-06 gelöscht wurde: die Stufen sind das
 * einzige aus 521 Zeilen Simulations-Host, das die Oberfläche wirklich benutzt hat
 * (`keyboard.ts` und `ui/Header.tsx`). Der Rest war eine zweite Spielschleife in einem
 * Hintergrundprozess, den nie etwas gestartet hat — siehe DECISIONS.md, 2026-09-06.
 *
 * Null ist Pause und gehört dazu: sie ist eine Stufe des Reglers, kein Sonderfall
 * daneben.
 */
export const SPEED_STOPS = [0, 1, 2, 5, 10, 25, 50, 100] as const

export type SpeedStop = (typeof SPEED_STOPS)[number]

/**
 * Die Geschwindigkeit, mit der die Leertaste eine pausierte Partie fortsetzt
 * (T-M28-09). Eine Raste aus SPEED_STOPS, damit die Tempo-Gruppe danach genau einen
 * gedrueckten Knopf zeigt; die eingestellte Hoechstgeschwindigkeit kappt sie.
 */
export const RESUME_SPEED = 10
