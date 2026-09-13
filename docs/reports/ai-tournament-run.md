# KI-Turnier — letzter Lauf

Erzeugt von `pnpm test:slow` am 2026-09-13.
Je 50 Partien, 40 Spieltage, Seiten jede zweite Partie getauscht.

| Paarung | Siege A | Siege B | Unentschieden | Siegquote A | Kriegserklärungen (schwer) | Friedensschlüsse (schwer) |
|---|---|---|---|---|---|---|
| schwer gegen leicht, im Krieg | 25 | 0 | 0 | 100 % | 0 | 0 |
| schwer gegen normal, im Frieden | 10 | 0 | 15 | 70 % | 146 | 97 |
| schwer gegen normal, im Krieg | 25 | 0 | 0 | 100 % | 34 | 34 |

Je Stufe nach dem **Handelnden**, über alle drei Paarungen, in denen sie antritt
(T-M15-08 versprach „neun Zahlen je Stufe"; nachgeprüft in T-M41-08, `DECISIONS.md`):

| Stufe | Kriegserklärungen | Selbsttätiger Beschuss |
|---|---|---|
| leicht | 0 | 0 |
| normal | 110 | 0 |
| schwer | 70 | 0 |

Zusicherungen: Siegquote der höheren Stufe zwischen 70 % und 95 %; „schwer gegen
normal" endet nicht 25:25; mindestens ein Friedensschluss. Der Grundlauf **vor**
der Verhältnisregel steht in `ai-tournament.md`.
