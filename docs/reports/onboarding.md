# Der Durchgang durch die ersten Spieltage

Gemessen am **2026-09-13** von `apps/desktop/src/game/onboarding.slow.test.ts`, über
**16 Spieltage** (384 Ticks) auf der kleinen Karte, Startzahl 1914.

> Dieser Bericht gilt für genau diesen Stand. Zeigt `git log --oneline -1` etwas anderes,
> ist er überholt und keine Aussage über das Projekt.

## Die Zahl, die zählt

| **Längste Pause ohne Anlass** | **48 Ticks** (Tag 4, 00:00 → Tag 6, 00:00) |
|---|---|
| Führungsschritte im Lauf | 4 |
| Freischaltungsmeldungen | 6 |
| Ankündigungen (zwei Tage vorher) | 4 |
| Erste Einheit möglich ab | Tick 43 (Tag 2, 19:00) |
| Führung am Ende | fastForward |

Die längste Pause ist die Stelle, an der jemand aufhört. Alles andere in diesem Bericht
erklärt nur, warum sie so lang ist.

## Was wann geschah

| Zeit | Art | Was |
|---|---|---|
| Tag 1, 00:00 | Schritt | select, build, speed, score (vier Klicks) |
| Tag 1, 01:00 | Meldung | Neu ab heute: Kaserne. Sie können sie jetzt bauen. |
| Tag 1, 01:00 | Meldung | Neu ab heute: Infanterie. Sie können sie jetzt ausheben. |
| Tag 2, 00:00 | Schritt | dayPassed beendet |
| Tag 2, 03:00 | Fertig | BUILD_COMPLETED |
| Tag 2, 03:00 | Schritt | buildCompleted beendet |
| Tag 2, 19:00 | Fertig | UNIT_RECRUITED |
| Tag 2, 19:00 | Schritt | unitRecruited beendet |
| Tag 4, 00:00 | Ankündigung | In zwei Tagen: Hafen. |
| Tag 6, 00:00 | Meldung | Neu ab heute: Hafen. Sie können ihn jetzt bauen. |
| Tag 8, 00:00 | Ankündigung | In zwei Tagen: Transportschiff. Dafür braucht es einen Hafen — Sie haben keinen. |
| Tag 10, 00:00 | Meldung | Neu ab heute: Transportschiff. Sie können es jetzt ausheben. |
| Tag 10, 00:00 | Ankündigung | In zwei Tagen: Festung. |
| Tag 12, 00:00 | Meldung | Neu ab heute: Festung. Sie können sie jetzt bauen. |
| Tag 14, 00:00 | Ankündigung | In zwei Tagen: Motorisierte Infanterie. |
| Tag 16, 00:00 | Meldung | Neu ab heute: Motorisierte Infanterie. Sie können sie jetzt ausheben. |

## Wie der Lauf gedacht ist

Der gedachte Spieler ist **fleißig**: er tut in der ersten Stunde, was die drei
Klickschritte von ihm verlangen, baut, sobald er kann, und hebt aus, sobald die Kaserne
steht. Was danach an Leerlauf bleibt, ist der Leerlauf, den das Spiel **erzwingt** — und
nur der ist eine Aussage über die Eröffnung. Ein zögerlicher Spieler erlebt mehr davon,
nicht weniger.

Gemessen wird auf der kleinen Karte, nicht auf der Weltkarte: die Eröffnung hängt an den
Bauzeiten und am Startvorrat, nicht an der Zahl der Provinzen, und sechzehn Spieltage
Weltkarte kosten das Zwanzigfache an Rechenzeit für dieselbe Aussage.

## Der Befund fuer Noah

Nach M34 lagen **zwei Pausen von vier Spieltagen** im Fenster: vom Hafen an Tag 6 bis zum
Transportschiff an Tag 10 und von der Festung an Tag 12 bis zur motorisierten Infanterie an
Tag 16 (96 Ticks).

**Seit T-M41-03 kündigt sich jede Freischaltung zwei Spieltage vorher an**, und die
Ankündigung sagt, was dafür fehlt — „In zwei Tagen: Transportschiff. Dafür braucht es einen
Hafen — Sie haben keinen." Die Freischaltungstage selbst sind unverändert (Entscheid
„Ankündigung statt Datenänderung", `DECISIONS.md`, 2026-09-13, kippbar). Die längste
Pause im Fenster beträgt damit **48 Ticks**.

Hinter dem Messfenster liegen größere Lücken zwischen den Freischaltungen (Tag 20 → 28,
48 → 62, 70 → 80). Die Ankündigung wirkt dort genauso, halbiert sie aber nicht: eine Lücke
von vierzehn Tagen bleibt eine Lücke von zwölf.

## Was dieser Bericht nicht sagt

Ob die Führung **verständlich** ist, und ob eine leise Ankündigung als Anlass empfunden
wird. Er zählt, dass etwas geschieht und wann; ob der Satz an der richtigen Stelle das
Richtige sagt, findet nur ein Mensch heraus. Dafür stehen die beiden Fragen am Ende von
`docs/PLAYTEST.md`.
