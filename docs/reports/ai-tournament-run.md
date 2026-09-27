# KI-Turnier — letzter Lauf

Erzeugt von `pnpm test:slow` am 2026-09-27.
Je 150 Partien je Paarung, 40 Spieltage; drei Mächte reihum (Nordland/Ostmark/Sueden),
der Dritte als Füller auf „normal"; Startzahlen 1000–1024 je Aufstellung, Stufen je
Paar getauscht.

Gemessen auf: 669b105297763d663b03071d8fec7110ddd51bff (Quellen sauber)

| Paarung | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen (schwer) | Friedensschlüsse (schwer) | Überfälle | verschiedene Ausgänge | Siege je Nation |
|---|---|---|---|---|---|---|---|---|---|
| schwer gegen leicht, im Krieg | 52 | 0 | 23 | 85 % | 255 | 114 | 0 | 56 | Nordland 50 · Ostmark 73 · Sueden 27 |
| schwer gegen normal, im Frieden | 17 | 1 | 57 | 61 % | 715 | 443 | 2 | 106 | Nordland 86 · Ostmark 16 · Sueden 48 |
| schwer gegen normal, im Krieg | 19 | 0 | 56 | 63 % | 260 | 244 | 0 | 71 | Nordland 81 · Ostmark 19 · Sueden 50 |

Je Stufe nach dem **Handelnden**, über alle drei Paarungen, in denen sie antritt
(T-M15-08 versprach „neun Zahlen je Stufe"; nachgeprüft in T-M41-08, `DECISIONS.md`):

| Stufe | Kriegserklärungen | davon förmlich | Selbsttätiger Beschuss |
|---|---|---|---|
| leicht | 0 | 0 | 0 |
| normal | 267 | 266 | 0 |
| schwer | 522 | 522 | 0 |

Schwer gegen normal, im Frieden, je Sitzordnung (T-M17-15, Befund M17-T4):

| Sitzordnung | A | B | U | Siegquote A |
|---|---|---|---|---|
| Nordland/Ostmark/Sueden | 10 | 0 | 15 | 70 % |
| Ostmark/Sueden/Nordland | 3 | 1 | 21 | 54 % |
| Sueden/Nordland/Ostmark | 4 | 0 | 21 | 58 % |

Die Streuung der Summe über vier Startzahl-Blöcke (0,7267–0,82) steht in `BALANCING.md`,
nicht in diesem Lauf gerechnet.

Zusicherungen: Siegquote der höheren Stufe zwischen 70 % und 95 %; „schwer gegen
normal" endet nicht mit lauter Unentschieden; mindestens ein Friedensschluss;
mindestens 50 verschiedene Ausgänge und keine Nation über 60 % der Partien (Paarung
„im Frieden"); beide Stufen erklären förmlich; schwer ist in keiner Sitzordnung
schlechter als normal (T-M17-15). Der Grundlauf **vor** der Verhältnisregel steht in
`ai-tournament.md`.
