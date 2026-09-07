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
| 1a | R-UI-04 | Steht die Schrift **IBM Plex** auf dem Bildschirm — schmale Buchstaben auf der Karte, gleich breite Ziffern in der Kopfleiste? *(Bis zum 2026-09-06 lag keine Schriftdatei bei; das Spiel fiel still auf die Systemschrift zurück und sah damit anders aus als das freigegebene Bild)* | |
| 2 | R-UI-02 | Ist alles auf Anhieb lesbar — kein Text, bei dem Sie die Augen zusammenkneifen? | |
| 3 | R-FREE-02 | Sehen Sie irgendwo etwas zu kaufen, ein Abonnement oder eine Wartezeit gegen Geld? (Erwartet: **nein**) | |

## Die erste Partie beginnen (5 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 4 | R-GAME-01 | Können Sie **Karte**, Macht, Gegnerzahl, Schwierigkeit, Siegbedingung und Startzahl frei wählen — und **wirkt die Kartenwahl auch**? | |
| 4a | R-GAME-02 | Stehen **Punktesieg und Eroberungssieg** zur Wahl, und sagt das Spiel, was das jeweils heißt? *(Der Zeitsieg ist am 2026-09-05 mit Begründung zurückgenommen und steht deshalb nicht mehr im Menü — `DECISIONS.md`)* | |
| 5 | R-AI-02 | Steht dort, welchen Bonus die KI bekommt? (Erwartet: **ohne Bonus**) | |
| 6 | R-UI-03 | Öffnet die Karte auf Ihrem eigenen Land, nicht irgendwo? | |
| 7 | R-MAP-01 | Wirkt die Weltkarte wie eine Weltkarte — Kontinente am richtigen Platz, Grenzen sauber? | |

## Die Karte bedienen (8 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 8 | R-UI-03 | Wird beim Klicken **die** Provinz ausgewählt, auf die Sie gezeigt haben? | |
| 9 | R-UI-03 | Fühlen sich Zoom und Verschieben natürlich an — bleibt der Punkt unter dem Zeiger? | |
| 10 | R-MAP-06 | Sagen die vier Kartenmodi (M) jeweils etwas Verständliches? | |
| 10b | R-MAP-05 | Sehen Sie auf der Karte, wo Ihre Einheiten stehen, wo gebaut ist und wo gekämpft wird? | |
| 11 | R-DIP-04 | Bleibt fremdes Gebiet grau, solange Sie es nicht aufgeklärt haben? | |
| 12 | R-ARCH-06 | Ruckelt die Karte irgendwann? (Erwartet: **nein**, auch bei Tempo 100) | |

## Wirtschaft und Bauen (8 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 13 | R-UI-05 | Sagt jeder Knopf **vorher**, was er kostet und wie lange er dauert? | |
| 13a | R-PROV-01 | Werden die Kosten eines Bauauftrags **sofort** abgezogen, und steht der Fertigstellungstag am Auftrag? | |
| 13b | R-PROV-01 | Können Sie ein laufendes Bauvorhaben abbrechen — und sagt das Spiel dazu, **was mit den Kosten geschieht**? *(Bis zum 2026-09-06 stand hier „dass es nichts zurückgibt". Gemessen werden **50 %** erstattet, und das Protokoll sagt es auch — die Frage war falsch gestellt, nicht das Spiel.)* | |
| 14 | R-UI-05 | Steht bei einer ausgegrauten Aktion der Grund dabei — und ist er verständlich? | |
| 15 | R-ECON-01 | Verstehen Sie nach zehn Minuten, woher Ihre Rohstoffe kommen und wohin sie gehen? | |
| 16 | R-ECON-06 | Sagt Ihnen die Wirtschaftsübersicht (Bestand, Produktion, Verbrauch, Bilanz), warum ein Rohstoff knapp wird? | |
| 16b | R-ECON-06 | Stimmt die angekündigte Tagesproduktion mit dem überein, was der Tag dann liefert? | |

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
| 25a | R-BAT-05 | **Können Sie eine bedrängte Armee zurückziehen — und sagt der Knopf, was es kostet?** *(Bis zum 2026-09-06 konnte das nur die KI)* | |
| 25b | R-BAT-07 | **Nennt das Protokoll nach einem Gefecht die Verluste beider Seiten?** *(Standen im Ereignis und erreichten den Spieler nie)* | |
| 25c | R-UI-05 | **Können Sie ein laufendes Bauvorhaben abbrechen?** *(Der Befehl gibt es seit M3; einen Knopf dafür nicht)* | |
| 25d | R-UI-13 | **Wenn Sie Ihre letzte Provinz verlieren: sagt das Spiel es Ihnen?** *(Vorher tickte es wortlos weiter)* | |
| 25e | R-GAME-01 | **Können Sie nach dem Ende eine zweite Partie beginnen, ohne das Programm neu zu starten?** | |

## Speichern und Einstellungen (4 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 26 | R-GAME-03 | Speichern, laden, weiterspielen — ist alles wie vorher? | |
| 26a | R-GAME-03 | **Speichern, das Fenster schließen, neu öffnen: steht der Stand noch in der Liste und lädt er?** *(Bis zum 2026-09-06 nicht — der Speicher lag im Arbeitsspeicher)* | |
| 26b | R-GAME-05 | Ton aus, Schriftgröße ändern, neu starten: sind die Einstellungen noch so? | |
| 27 | R-UI-06 | Kommen Sie ohne Maus durch das Spiel? (Leertaste, +/−, F, M, Pfeile, Strg+S) | |
| 28 | R-UI-07 | Ist irgendwo englischer Text oder eine Kennung wie „p1" stehengeblieben? (Erwartet: **nein**) | |

---


## Was die Oberfläche zeigt (8 min)

| # | Anforderung | Frage | ja/nein |
|---|---|---|---|
| 30 | R-UI-10 | Steht neben jedem Gebäude, jeder Einheit und jedem Rohstoff sein Symbol — und lassen sich die Symbole auseinanderhalten? | |
| 31 | R-UI-09 | Sehen Sie die Moral einer Provinz als Balken mit Pfeil statt als bloße Prozentzahl? | |
| 32 | R-UI-09 | Zeigt ein laufender Bau, wie weit er ist und wie lange er noch braucht? | |
| 33 | R-UI-09 | Sagt Ihnen die Kopfleiste bei einem schrumpfenden Vorrat, wie viele Tage er noch reicht? | |
| 34 | R-UI-11 | Konnten Sie mit dem **?** herausfinden, wofür ein Gebäude gut ist, ohne die Anleitung zu öffnen? | |
| 35 | R-UI-12 | Stehen die Provinznamen auf der Karte, sobald Sie nah genug sind — und ist keiner davon über einen Nachbarn geschrieben? | |
| 36 | R-UI-12 | Finden Sie Ihre Hauptstadt auf der Karte auf einen Blick? | |
| 37 | R-UI-12 | Sehen Sie, wo gekämpft wird, ohne das Protokoll zu lesen? | |
| 38 | R-UI-12 | Zeigt die Karte den Weg einer marschierenden Armee, wenn Sie sie auswählen? | |
| 39 | R-MAP-07 | Färbt jeder der vier Kartenmodi etwas ein — oder ist einer durchweg grau? (Erwartet: **jeder färbt**) | |
| 40 | R-UI-13 | Beantwortet die Lageübersicht (Taste L) die Frage „gewinne ich gerade?" | |
| 41 | R-UI-13 | Sagt Ihnen das Spiel von selbst, wenn die Partie entschieden ist? | |
| 42 | R-UI-14 | Haben die Meldungen Sie auf etwas hingewiesen, das Sie sonst übersehen hätten? | |
| 43 | R-GAME-06 | Können Sie das Ereignisprotokoll auf Kämpfe filtern? | |
| 44 | R-UI-04 | Hören Sie einen Ton bei Kampf, Eroberung und Fertigstellung — und hört er auf, wenn Sie ihn abschalten? | |
| 45 | R-UI-04 | Bewegt sich irgendetwas, das sich nicht bewegen sollte? (Erwartet: **nein**) | |
| 46 | R-UI-05 | Hat die Einstiegshilfe in der ersten Partie geholfen, ohne im Weg zu stehen? | |
| 47 | R-GAME-04 | Liegt nach einer Weile ein automatischer Spielstand in der Liste? | |
| 48 | R-UI-08 | Gibt es eine Einstellung im Menü, die sichtbar nichts bewirkt? (Erwartet: **nein**) | |
| 49 | R-UI-05 | **Wussten Sie in den ersten drei Spieltagen jederzeit, was zu tun ist?** Wenn nein: an welcher Stelle nicht? | |
| 50 | R-UI-05 | **Wussten Sie auch, wozu?** Also warum die Kaserne vor der Infanterie kommt und warum zwischendurch gewartet wird — nicht nur, welchen Knopf man drückt. | |

---

## Die drei Fragen, auf die es ankommt

> **A. Wollten Sie weiterspielen, als die 45 Minuten um waren?**
>
> **B. Gab es einen Moment, in dem Sie gewartet haben, ohne es abkürzen zu können?**
>
> **C. Hatten Sie das Gefühl, dass die KI schummelt?**

Erwartet: **ja / nein / nein.**

---

## Was dieser Bogen am 2026-09-06 dazubekommen hat

Der Bogen war nach dem **Gebauten** geschrieben, nicht nach der Anforderung — Frage 4
fragte nach „Macht, Gegnerzahl, Schwierigkeit, Startzahl", während R-GAME-01 an erster
Stelle die **Karte** nennt, und die war ein Blindschalter (Befund N10 des Audits). Ein
Abnahmebogen, der abfragt, was ohnehin da ist, kann eine Abnahme nur bestehen.

Neu sind die Fragen zu den Dingen, die bis zum 2026-09-06 **gar nicht gingen** und in
einer einzelnen Sitzung auch nicht auffallen: das Fenster schließen und wiederkommen (der
Speicher lag im Arbeitsspeicher), eine zweite Partie, der Rückzug, der Kampfbericht, der
Bauabbruch, die eigene Niederlage. Jede davon war im Kern gebaut, getestet und für den
Spieler unerreichbar.

**Frage 48** — „Gibt es eine Einstellung im Menü, die sichtbar nichts bewirkt? Erwartet:
nein" — war am 2026-09-05 mit **ja** vorbeantwortet: Kartenwahl, Zeitsieg und das leere
Debug-Panel. Der Zeitsieg ist mit Begründung zurückgenommen (`DECISIONS.md`) und steht
nicht mehr im Menü.

> ⚠ **Berichtigt am 2026-09-06, erledigt am 2026-09-07.** Bis zum 2026-09-06 stand hier:
> „Kartenwahl und Debug sind seither geschlossen." **Beides war falsch**, und der
> Durchgang an diesem Tag hat es gemessen: „Kleine Welt (12)" gewählt startete weiterhin
> die Weltkarte, und die Debug-Ansicht zeigte „Tick: 8", einen leeren Zustands-Hash und
> zwei Überschriften ohne Inhalt.
>
> **Seit dem 2026-09-07 sind beide wirklich geschlossen** — T-M12-08 und T-M12-10 (f),
> jeweils mit einem Test, der ohne die Reparatur fällt. Frage 48 ist damit erstmals
> begründet mit **nein** zu beantworten. Einzelheiten in `PROBLEME.md`.
>
> Ein Abnahmebogen, der einen Befund für geschlossen erklärt, ohne dass jemand
> nachgesehen hat, ist schlimmer als einer, der ihn offen führt: er lenkt den Blick weg.

---

## Befunde

Bitte alles notieren, was auffällt — auch Kleinigkeiten. Was hier steht, wird
abgearbeitet; was nur gedacht wird, nicht.

| # | Wo | Was | Wie schlimm |
|---|---|---|---|
| | | | |
