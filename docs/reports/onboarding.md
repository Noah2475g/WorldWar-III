# Der Durchgang durch die ersten Spieltage

Gemessen am **2026-09-07** von `apps/desktop/src/game/onboarding.slow.test.ts`, über
**16 Spieltage** (384 Ticks) auf der kleinen Karte, Startzahl 1914.

> Dieser Bericht gilt für genau diesen Stand. Zeigt `git log --oneline -1` etwas anderes,
> ist er überholt und keine Aussage über das Projekt.

## Die Zahl, die zählt

| **Längste Pause ohne Anlass** | **72 Ticks** (Tag 5, 00:00 → Tag 8, 00:00) |
|---|---|
| Führungsschritte im Lauf | 4 |
| Freischaltungsmeldungen | 17 |
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
| Tag 2, 00:00 | Meldung | Neu ab heute: Hafen. Sie können ihn jetzt bauen. |
| Tag 2, 00:00 | Schritt | dayPassed beendet |
| Tag 2, 03:00 | Fertig | BUILD_COMPLETED |
| Tag 2, 03:00 | Schritt | buildCompleted beendet |
| Tag 2, 19:00 | Fertig | UNIT_RECRUITED |
| Tag 2, 19:00 | Schritt | unitRecruited beendet |
| Tag 3, 00:00 | Meldung | Neu ab heute: Festung. Sie können sie jetzt bauen. |
| Tag 3, 00:00 | Meldung | Neu ab heute: Transportschiff. Sie können es jetzt ausheben. |
| Tag 4, 00:00 | Meldung | Neu ab heute: Motorisierte Infanterie. Sie können sie jetzt ausheben. |
| Tag 5, 00:00 | Meldung | Neu ab heute: Eisenbahn. Sie können sie jetzt bauen. |
| Tag 8, 00:00 | Meldung | Neu ab heute: Fabrik. Sie können sie jetzt bauen. |
| Tag 8, 00:00 | Meldung | Neu ab heute: Kampfpanzer. Sie können ihn jetzt ausheben. |
| Tag 9, 00:00 | Meldung | Neu ab heute: Werft. Sie können sie jetzt bauen. |
| Tag 9, 00:00 | Meldung | Neu ab heute: Artillerie. Sie können sie jetzt ausheben. |
| Tag 10, 00:00 | Meldung | Neu ab heute: Flugplatz. Sie können ihn jetzt bauen. |
| Tag 10, 00:00 | Meldung | Neu ab heute: Jagdflugzeug. Sie können es jetzt ausheben. |
| Tag 11, 00:00 | Meldung | Neu ab heute: Zerstörer. Sie können ihn jetzt ausheben. |
| Tag 13, 00:00 | Meldung | Neu ab heute: Bomber. Sie können ihn jetzt ausheben. |
| Tag 14, 00:00 | Meldung | Neu ab heute: Schwerer Kampfpanzer. Sie können ihn jetzt ausheben. |
| Tag 16, 00:00 | Meldung | Neu ab heute: Raketenartillerie. Sie können sie jetzt ausheben. |

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

**Zwischen Tag 5 und Tag 8 geschieht drei Spieltage lang nichts.** Die Eisenbahn kommt an
Tag 5, die Fabrik an Tag 8, und dazwischen meldet das Spiel nichts, was den Spieler
anspräche. Die Führung ist da längst durchgelaufen.

Ob das zu lang ist, ist eine **Balancing-Frage** und gehört Noah — hier steht nur die
gemessene Zahl. Drei Wege wären denkbar, alle drei sind eigene Aufgaben:

1. **Die Achse verdichten** — eine Freischaltung an Tag 6 oder 7. Ändert die Partie.
2. **Anderes melden** — Bevölkerungswachstum, ein Lagerstand, eine Nachricht aus der
   Welt. Ändert die Partie nicht, füllt aber auch nur die Meldungsleiste.
3. **So lassen.** Wer bis Tag 5 gespielt hat, hat sich entschieden; die Lücke trifft
   nicht mehr den Einsteiger, für den diese Aufgabe gebaut wurde.

Der Test hält die Zahl als Obergrenze fest: sie darf nicht unbemerkt wachsen.

## Was dieser Bericht nicht sagt

Ob die Führung **verständlich** ist. Er zählt, dass etwas geschieht und wann; ob der Satz
an der richtigen Stelle das Richtige sagt, findet nur ein Mensch heraus. Dafür stehen die
beiden Fragen am Ende von `docs/PLAYTEST.md`.
