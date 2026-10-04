# VM-01 · Messkette (Zweig claude/vm01-schonfrist, 991dd2c, 2026-10-04)

Was: Schonfrist fürs Ausheben in eroberten Provinzen (G1-10b): 14 Tage Besatzungszeit sperrt die Moral RECRUIT nicht, im Kern und in der KI. Warum: frisch eroberte Provinzen lagen sonst sofort unter der Moralgrenze; danach und in nie eroberten Provinzen bleibt alles wie vorher (D6.8).

| Messgerät | vorher (ausgang.md, main 25aafa4) | nachher | hält? |
|---|---|---|---|
| Turnier schwer gegen leicht, Krieg | 84 % | 84 % | ja |
| Turnier schwer gegen normal, Frieden | 61 % | 61 % | ja |
| Turnier schwer gegen normal, Krieg | 63 % | 62 % | ja (Rauschen, Messlauf-Exit 0) |
| progress anteilDesStaerksten | 0.335 | 0.3293 | ja |
| Vollpartie 1914 | Tag 589, p6, 1612 Eroberungen, 3422 Schlachten | Tag 589, p6, 1612, 3422 (identisch) | ja |
| Vollpartie 1683 | Tag 594, p7 | Tag 711, p7 | Exit 0, Sieger gleich |
| Vollpartie 1789 | Tag 953, p6 | Tag 989, p8 | Exit 0, Sieger wechselt |
| Vollpartie 1806 | Tag 468, p8 | Tag 468, p8 | identisch |
| Vollpartie 1815 | Tag 596, p7 | Tag 596, p7 | identisch |
| Vollpartie 1871 | Tag 522, p6 | Tag 522, p6 | identisch |
| Vollpartie 1939 | Tag 541, p6 | Tag 541, p6 | identisch |
| Vollpartie 1945 | Tag 397, p6 | Tag 397, p6 | identisch |
| Vollpartie 2015 | Tag 627, p6 | Tag 502, p6 | Exit 0, Sieger gleich |
| ai-integration | grün | 29 von 29 grün, Exit 0 | ja |
| m17-integration | grün | Exit 0 | ja |
| Haltung AK5 (Kontrolle Garnison A 1914) | measuredAtCommit 91faf03, erfüllt true | c7c324b, erfüllt true, 35 grün/6 übersprungen | ja |
| v3-verhalten (Spätspiel-Hash) | S100 90f71675…, S300 098e6884…, 3d6a07bd… | unverändert, Test grün, Rebase und Wiederholung Exit 0 | ja (Änderung im 720-Tick-Fenster unsichtbar) |
| Schonfrist-Aushebungen unter der Grenze (3 x 200 Tage) | 0 / 0 / 0 (Gegenprobe auf cd42c8c) | 1815: 1, 1914: 1, 2015: 0 (Summe 2) | ja |

Wirkung im Spiel klein: 2 von ca. 8700 KI-Aushebungen in 3 x 200 Tagen fielen in die Schonfrist unter die Grenze, beide vom Kern angenommen (Reviewer B3). Auf den Vollpartien ändern sich 1683, 1789 und 2015 im Spielverlauf (Tag/Sieger/Zahlen siehe Tabelle); die übrigen sechs, darunter 1914, bleiben bitgleich. data/rules und data/maps unverändert (kein Parameterlauf nötig).

pnpm verify: Exit 0 (3934 Tests) mit NODE_OPTIONS=--no-experimental-webstorage; ohne diese Option reißen 24 Desktop-Tests wegen Node-26-localStorage (auch auf main, Fix in PR #22, kein VM-01-Bezug).

Nicht gelaufen (Zeitmessung, nur im Rechnerfenster mit Noahs Wort): pnpm acceptance, pnpm sim:long.

Offen für Noah: (1) 14 Tage am Spielgefühl prüfen (nächster Playtest); (2) in entlegenen Frontprovinzen bleibt die Moral auch nach der Schonfrist oft < 25 — das ist D6.8, keine Regression; (3) optionaler UI-Hinweis „Schonfrist noch N Tage" als Vormerkung.

Merge: nur Noah.
