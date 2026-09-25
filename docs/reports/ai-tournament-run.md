# KI-Turnier — letzter Lauf

Erzeugt von `pnpm test:slow` am 2026-09-25.
Je 150 Partien je Paarung, 40 Spieltage; drei Mächte reihum (Nordland/Ostmark/Sueden),
der Dritte als Füller auf „normal"; Startzahlen 1000–1024 je Aufstellung, Stufen je
Paar getauscht.

Gemessen auf: 27766f10ff5b527acf9011632ebc649d25496bbe (Quellen sauber)

| Paarung | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen (schwer) | Friedensschlüsse (schwer) | Überfälle | verschiedene Ausgänge | Siege je Nation |
|---|---|---|---|---|---|---|---|---|---|
| schwer gegen leicht, im Krieg | 52 | 0 | 23 | 85 % | 255 | 120 | 8 | 59 | Nordland 50 · Ostmark 73 · Sueden 27 |
| schwer gegen normal, im Frieden | 39 | 0 | 36 | 76 % | 754 | 478 | 74 | 110 | Nordland 67 · Ostmark 18 · Sueden 65 |
| schwer gegen normal, im Krieg | 20 | 0 | 55 | 63 % | 260 | 243 | 6 | 74 | Nordland 80 · Ostmark 20 · Sueden 50 |

Je Stufe nach dem **Handelnden**, über alle drei Paarungen, in denen sie antritt
(T-M15-08 versprach „neun Zahlen je Stufe"; nachgeprüft in T-M41-08, `DECISIONS.md`):

| Stufe | Kriegserklärungen | davon förmlich | Selbsttätiger Beschuss |
|---|---|---|---|
| leicht | 0 | 0 | 0 |
| normal | 260 | 234 | 0 |
| schwer | 554 | 535 | 0 |

Schwer gegen normal, im Frieden, je Sitzordnung (T-M17-15, Befund M17-T4):

| Sitzordnung | A | B | U | Siegquote A |
|---|---|---|---|---|
| Nordland/Ostmark/Sueden | 12 | 0 | 13 | 74 % |
| Ostmark/Sueden/Nordland | 6 | 0 | 19 | 62 % |
| Sueden/Nordland/Ostmark | 21 | 0 | 4 | 92 % |

Die Streuung der Summe über vier Startzahl-Blöcke (0,7267–0,82) steht in `BALANCING.md`,
nicht in diesem Lauf gerechnet.

Zusicherungen: Siegquote der höheren Stufe zwischen 70 % und 95 %; „schwer gegen
normal" endet nicht mit lauter Unentschieden; mindestens ein Friedensschluss;
mindestens 50 verschiedene Ausgänge und keine Nation über 60 % der Partien (Paarung
„im Frieden"); beide Stufen erklären förmlich; schwer ist in keiner Sitzordnung
schlechter als normal (T-M17-15). Der Grundlauf **vor** der Verhältnisregel steht in
`ai-tournament.md`.
