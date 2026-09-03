# Design-Tokens — Vorschlag zum Design-Gate (T-M10-01)

Diese Datei ist die schriftliche Fassung des Mockups in `ui-mockup.html`. Nach der
Freigabe wird sie eins zu eins zu `apps/desktop/src/ui/tokens.ts` (T-M10-01b); die
Kontrastwerte werden dort automatisiert geprüft (R-UI-02).

## Schrift

Eine Familie in drei Schnitten — **IBM Plex** (SIL Open Font License 1.1, also frei
verwendbar, R-ASSET-02). Sie ist nicht aus Geschmack gewählt, sondern weil sie eine
schmale Variante für Kartenbeschriftung, eine normale für Bedienelemente und eine
dicktengleiche für Zahlen mitbringt — drei Rollen, eine Lizenz, ein Schriftbild.

| Rolle | Schnitt | Wofür |
|---|---|---|
| `font-map` | IBM Plex Sans Condensed | Provinznamen, Kartenlegende |
| `font-ui` | IBM Plex Sans | Knöpfe, Panels, Fließtext |
| `font-num` | IBM Plex Mono | Ressourcen, Uhrzeit, alle Zahlenkolonnen (`tabular-nums`) |

Stufen: 11 / 12 / 14 / 16 / 20 / 26 px. Versalien-Etiketten mit 0,08em Sperrung.

## Farben — Richtung A „Lagekarte" (Empfehlung)

| Token | Wert | Rolle |
|---|---|---|
| `ground` | `#E4E0D2` | Kartengrund, Leinen |
| `paper` | `#F2EEE3` | Panels, Leisten |
| `paper-sunk` | `#DAD5C6` | vertiefte Flächen, Tabellenzeilen |
| `ink` | `#1F2420` | Text |
| `ink-soft` | `#5A6055` | Zweitrangiger Text, Einheiten |
| `line` | `#8C8676` | Provinzgrenzen, Rahmen |
| `water` | `#BFC9C6` | Meer |
| `accent` | `#B3341E` | Alarm, Krieg, Signalfarbe — **nur** hierfür |
| `good` | `#3D6B4A` | Fertig, Frieden, Überschuss |
| `warn` | `#9A6B14` | Mangel, Frist läuft |

Spielerfarben (auf hellem Grund geprüft): `#2C5F7C` · `#7C3F2C` · `#4A5D2C` · `#5B3A6B`.

## Kontraste (WCAG, Schwelle 4,5:1 für Text)

| Paar | Verhältnis | |
|---|---|---|
| `ink` auf `paper` | 13,9:1 | ✓ |
| `ink` auf `ground` | 12,4:1 | ✓ |
| `ink-soft` auf `paper` | 5,2:1 | ✓ |
| `accent` auf `paper` | 5,6:1 | ✓ |
| `good` auf `paper` | 5,4:1 | ✓ |
| `warn` auf `paper` | 4,6:1 | ✓ |
| `paper` auf `accent` (Alarmknopf) | 5,6:1 | ✓ |

Die Zahlen stammen aus der WCAG-Formel und werden in T-M10-01b als Test festgeschrieben —
nicht als Behauptung in einer Tabelle, sondern als Prüfung, die bricht, wenn jemand eine
Farbe verschiebt.

## Warum diese Richtung

Die Lesson aus Rotation (`ui-needs-design-gate`) lautet: dunkle Farbe auf dunklem Grund
hat dort einen fertigen Playtest nach einer Minute beendet. Eine helle Karte mit Tinte
ist der Gegenentwurf — sie hat von sich aus hohen Kontrast, und die einzige kräftige
Farbe bleibt für das reserviert, was wirklich Aufmerksamkeit braucht: Kampf und Alarm.
