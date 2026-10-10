/**
 * Gemeinsame Selektoren der UX-Skripte (Seitenleiste v3b, D16).
 * Aendert sich der Ort eines Bereichs, aendert sich genau eine Zeile hier — nicht jedes Skript.
 * CTX und POWER_ROW folgen mit E4.
 */
export const SIDE = 'aside.side'
/** Hinweisspalte: seit E1 oben links ueber der Karte (`.alerts.map-alerts`), im Telefon-Hochformat noch im Blatt. */
export const ALERTS = '.alerts'
export const PICKER = '.picker select'
/** Leiste rechts (E3, D6): sieben Bereiche statt der Fussknoepfe. */
export const RAIL = 'nav.rail'
export const RAIL_ITEM = (a) => `.rail__item[data-area="${a}"]`
/** Depesche: erste Zeile im Bereich Protokoll (E3, D27). */
export const DISPATCH = '.dispatch-card'
/** Ranglisten-Zeilen des alten Fusses, seit E3 oben im Bereich Rangliste. */
export const STANDINGS_TOP = '.standings-top'
/** Dieselben Bereiche in der Leiste des Blatts (Telefon hochkant, Blatt halb/voll offen). */
export const SHEET_ITEM = (a) => `.sheet__navbutton[data-area="${a}"]`
/** Maechte-Zeile der Diplomatie-Tabelle (E4, D16): data-status (war|peace|alliance) + data-power (id). */
export const POWER_ROW = '.power-row'
