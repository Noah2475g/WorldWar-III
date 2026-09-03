# Playtest — Abnahme durch Noah

Etwa 45 Minuten. Jede Frage trägt die Anforderungs-ID, die sie prüft — bei einem Nein
weiß der nächste Durchgang sofort, wo er ansetzt.

**So läuft es ab:** Spielen Sie normal und beantworten Sie die Fragen unterwegs. Kein
Punkt ist eine Fangfrage; wo etwas nicht geht, ist das der Befund.

Starten:

```bash
pnpm --filter @worldwar/desktop dev
```

---

## Vor dem Spielen (2 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 1 | R-UI-01 | Sieht das Spiel aus wie die freigegebene Richtung A („Lagekarte")? | |
| 2 | R-UI-02 | Ist alles auf Anhieb lesbar — kein Text, bei dem Sie die Augen zusammenkneifen? | |
| 3 | R-FREE-02 | Sehen Sie irgendwo etwas zu kaufen, ein Abonnement oder eine Wartezeit gegen Geld? (Erwartet: **nein**) | |

## Die erste Partie beginnen (5 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 4 | R-GAME-01 | Können Sie Macht, Gegnerzahl, Schwierigkeit und Startzahl frei wählen? | |
| 5 | R-AI-02 | Steht dort, welchen Bonus die KI bekommt? (Erwartet: **ohne Bonus**) | |
| 6 | R-UI-03 | Öffnet die Karte auf Ihrem eigenen Land, nicht irgendwo? | |
| 7 | R-MAP-01 | Wirkt die Weltkarte wie eine Weltkarte — Kontinente am richtigen Platz, Grenzen sauber? | |

## Die Karte bedienen (8 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 8 | R-UI-03 | Wird beim Klicken **die** Provinz ausgewählt, auf die Sie gezeigt haben? | |
| 9 | R-UI-03 | Fühlen sich Zoom und Verschieben natürlich an — bleibt der Punkt unter dem Zeiger? | |
| 10 | R-MAP-06 | Sagen die vier Kartenmodi (M) jeweils etwas Verständliches? | |
| 11 | R-DIP-04 | Bleibt fremdes Gebiet grau, solange Sie es nicht aufgeklärt haben? | |
| 12 | R-ARCH-06 | Ruckelt die Karte irgendwann? (Erwartet: **nein**, auch bei Tempo 100) | |

## Wirtschaft und Bauen (8 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 13 | R-UI-05 | Sagt jeder Knopf **vorher**, was er kostet und wie lange er dauert? | |
| 14 | R-UI-05 | Steht bei einer ausgegrauten Aktion der Grund dabei — und ist er verständlich? | |
| 15 | R-ECON-01 | Verstehen Sie nach zehn Minuten, woher Ihre Rohstoffe kommen und wohin sie gehen? | |
| 16 | R-ECON-06 | Ist die Bilanz in der Kopfleiste das, was Sie zum Steuern brauchen? | |

## Zeit (8 min) — der Kern des Spiels

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 17 | R-TIME-01 | Können Sie die Geschwindigkeit jederzeit ändern, ohne etwas zu unterbrechen? | |
| 18 | R-TIME-02 | Läuft es bei 100 Spielstunden/s flüssig? | |
| 19 | R-TIME-03 | Hält das Vorspulen an, wenn etwas passiert, das Sie sehen müssen — und sagt es warum? | |
| 20 | R-TIME-04 | **Kernfrage:** Haben Sie irgendwann auf etwas gewartet, ohne es beschleunigen zu können? (Erwartet: **nein**) | |

## Krieg (10 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 21 | R-UNIT-02 | Sagt ein Marschbefehl vorher, wann die Armee ankommt — und stimmt es? | |
| 22 | R-BAT-01 | Ist nach einem Gefecht klar, was passiert ist und warum? | |
| 23 | R-DIP-01 | Ist die Diplomatie verständlich — Kriegserklärung, Vorlaufzeit, Folgen? | |
| 24 | R-AI-01 | Spielt die KI nachvollziehbar? Tut sie irgendwann etwas offensichtlich Dummes? | |
| 25 | R-AI-03 | Fühlt sich „schwer" schwerer an als „normal"? | |

## Speichern und Einstellungen (4 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 26 | R-GAME-03 | Speichern, laden, weiterspielen — ist alles wie vorher? | |
| 27 | R-UI-06 | Kommen Sie ohne Maus durch das Spiel? (Leertaste, +/−, F, M, Pfeile, Strg+S) | |
| 28 | R-UI-07 | Ist irgendwo englischer Text oder eine Kennung wie „p1" stehengeblieben? (Erwartet: **nein**) | |

---

## Die drei Fragen, auf die es ankommt

> **A. Wollten Sie weiterspielen, als die 45 Minuten um waren?**
>
> **B. Gab es einen Moment, in dem Sie gewartet haben, ohne es abkürzen zu können?**
>
> **C. Hatten Sie das Gefühl, dass die KI schummelt?**

Erwartet: **ja / nein / nein.**

---

## Befunde

Bitte alles notieren, was auffällt — auch Kleinigkeiten. Was hier steht, wird
abgearbeitet; was nur gedacht wird, nicht.

| # | Wo | Was | Wie schlimm |
|---|---|---|---|
| | | | |
