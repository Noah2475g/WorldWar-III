# KI-Turnier — letzter Lauf

Erzeugt von `pnpm test:slow` am 2026-09-27.
Je 150 Partien je Paarung, 40 Spieltage; drei Mächte reihum (Nordland/Ostmark/Sueden),
der Dritte als Füller auf „normal"; Startzahlen 1000–1024 je Aufstellung, Stufen je
Paar getauscht.

Gemessen auf: 1d7687c43b82e4bd849baa3a7d2dc95a002ecc0f (Quellen sauber)

| Paarung | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen (schwer) | Friedensschlüsse (schwer) | Überfälle | verschiedene Ausgänge | Siege je Nation |
|---|---|---|---|---|---|---|---|---|---|
| schwer gegen leicht, im Krieg | 52 | 0 | 23 | 85 % | 258 | 120 | 0 | 59 | Nordland 50 · Ostmark 73 · Sueden 27 |
| schwer gegen normal, im Frieden | 22 | 2 | 51 | 63 % | 707 | 430 | 2 | 108 | Nordland 83 · Ostmark 21 · Sueden 46 |
| schwer gegen normal, im Krieg | 20 | 0 | 55 | 63 % | 259 | 242 | 0 | 74 | Nordland 80 · Ostmark 20 · Sueden 50 |

Je Stufe nach dem **Handelnden**, über alle drei Paarungen, in denen sie antritt
(T-M15-08 versprach „neun Zahlen je Stufe"; nachgeprüft in T-M41-08, `DECISIONS.md`):

| Stufe | Kriegserklärungen | davon förmlich | Selbsttätiger Beschuss |
|---|---|---|---|
| leicht | 0 | 0 | 0 |
| normal | 263 | 262 | 0 |
| schwer | 521 | 521 | 0 |

Schwer gegen normal, im Frieden, je Sitzordnung (T-M17-15, Befund M17-T4):

| Sitzordnung | A | B | U | Siegquote A |
|---|---|---|---|---|
| Nordland/Ostmark/Sueden | 12 | 0 | 13 | 74 % |
| Ostmark/Sueden/Nordland | 5 | 2 | 18 | 56 % |
| Sueden/Nordland/Ostmark | 5 | 0 | 20 | 60 % |

Die Streuung der Summe über vier Startzahl-Blöcke (0,7267–0,82) steht in `BALANCING.md`,
nicht in diesem Lauf gerechnet.

Zusicherungen: Siegquote der höheren Stufe zwischen 70 % und 95 %; „schwer gegen
normal" endet nicht mit lauter Unentschieden; mindestens ein Friedensschluss;
mindestens 50 verschiedene Ausgänge und keine Nation über 60 % der Partien (Paarung
„im Frieden"); beide Stufen erklären förmlich; schwer ist in keiner Sitzordnung
schlechter als normal (T-M17-15). Der Grundlauf **vor** der Verhältnisregel steht in
`ai-tournament.md`.
