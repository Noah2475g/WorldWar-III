# WorldWar

Ein privater, nicht-kommerzieller Nachbau von **Supremacy: World War 3** als
**Singleplayer gegen Computergegner** — mit zwei bewussten Verbesserungen gegenüber dem
Original: **frei regelbare Spielgeschwindigkeit** (kein Warten über Tage) und
**keinerlei Monetarisierung** (kein Gold, keine Kaufvorteile, keine Werbung, kein Konto).

Status (2026-09-06): **V1 gebaut, in Reparatur vor der Abnahme (M14).**

Eine Auswertung am 2026-09-05 fand 68 bestätigte Befunde, darunter sieben Blocker: kein
Spielstand überlebte das Schließen des Fensters, der Stapel-Deckel machte Armeen ab 50
Einheiten wertlos, das Anforderungstor war rot, AK-1 prüfte kein Test, und das Spiel hatte
keine Schrift. Nachzulesen in [`docs/reports/audit-2026-09-05.md`](docs/reports/audit-2026-09-05.md)
— samt dem, was das Verfahren selbst nicht abdeckt.

**M14 macht den Bericht über das Spiel wieder wahr**, statt neue Mechanik zu bauen: 13 von
16 Aufgaben sind fertig, `pnpm verify` grün, das Anforderungstor meldet wieder
`V1 offen: 0`. Offen sind die Schrift (braucht eine Entscheidung, siehe
[`docs/plan/PROBLEME.md`](docs/plan/PROBLEME.md)) und **Noahs Playtest**
([`docs/PLAYTEST.md`](docs/PLAYTEST.md)). Danach folgt M15 „Die KI wird ein Gegner".

Anleitung in [`docs/ANLEITUNG.md`](docs/ANLEITUNG.md), Plan in
[`docs/plan/03-TASKS.md`](docs/plan/03-TASKS.md).

```bash
pnpm install
pnpm --filter @worldwar/desktop dev
```

Prüfen: `pnpm verify` (Lint, Typen, Tests, Guards, Abdeckung) · `pnpm test:slow`
(Langläufe, Turnier, Budgets, Parameterlauf) · `pnpm acceptance` (beides plus
Anforderungs-Tor, schreibt `docs/reports/acceptance.md`). Weltkarte neu bauen:
`node scripts/build-map.mjs` (braucht die Rohdaten aus `scripts/fetch-geodata.mjs`).


## Für Noah

| Was | Wo |
|---|---|
| Was gebaut wird (Anforderungen) | [`docs/plan/01-REQUIREMENTS.md`](docs/plan/01-REQUIREMENTS.md) |
| Wie es gebaut wird (Architektur, Formeln) | [`docs/plan/02-DESIGN.md`](docs/plan/02-DESIGN.md) |
| In welcher Reihenfolge (Aufgabenplan) | [`docs/plan/03-TASKS.md`](docs/plan/03-TASKS.md) |
| Mechanik-Referenz des Originals | [`docs/research/SUPREMACY-MECHANICS.md`](docs/research/SUPREMACY-MECHANICS.md) |

| Wo es steht (Fortschritt, Entscheidungen, Befunde) | [`docs/plan/PROGRESS.md`](docs/plan/PROGRESS.md) · [`docs/plan/DECISIONS.md`](docs/plan/DECISIONS.md) · [`docs/plan/PROBLEME.md`](docs/plan/PROBLEME.md) |
| Jede Zahl mit Status und gemessenem Ausschlag | [`docs/plan/BALANCING.md`](docs/plan/BALANCING.md) |
| Berichte (Abnahme, Karte, Parameterlauf, Budgets) | [`docs/reports/`](docs/reports/) |

Von den drei Stellen, die dich brauchten — Geodaten-Freigabe (T-M9-01), Design-Freigabe
(T-M10-01), Abnahme-Playtest (T-M12-03) — ist nur noch der Playtest offen.

## Für den umsetzenden Agenten

Lies **zuerst** [`docs/plan/AGENT-EXECUTION.md`](docs/plan/AGENT-EXECUTION.md), dann die
drei Plandokumente, dann `docs/plan/tasks.yaml`. Arbeite Aufgaben in ID-Reihenfolge ab,
Test zuerst, `pnpm verify` vor jedem Commit.

## Was genau nachgebaut wird

Die verlinkte Steam-Anwendung 784950 ist das **umbenannte „Conflict of Nations: World War 3"** —
ein Bytro-Schwesterspiel, nicht der Supremacy-1914-Nachfolger. Entschieden ist deshalb:
**Kernmechanik nach Supremacy 1914 in der Fassung nach dem Umbau vom 10.01.2023** (dafür liegen
belegte Formeln vor), **Setting und Einheiten modern**. Belegte Zahlen werden übernommen,
Lücken begründet geschätzt und über automatisierte Testpartien abgestimmt.

## Eckdaten

- **Technik:** TypeScript-Monorepo (pnpm), Simulationskern ohne UI-Abhängigkeit, React-Oberfläche,
  Kartenrendering über Canvas, Desktop-Verpackung mit Tauri.
- **Spielwelt:** echte Weltkarte, 150–250 Provinzen aus gemeinfreien Geodaten.
- **Zeit:** 1 Tick = 1 Spielstunde; Regler von Pause bis 1000 Spielstunden pro Sekunde,
  dazu „Vorspulen bis Ereignis“.
- **Vorgehen:** strikt testgetrieben; Kern ≥ 90 % Testabdeckung, Determinismus per Golden-Master
  abgesichert.
- **Multiplayer:** nicht in V1, aber architektonisch vorbereitet (deterministischer Kern,
  kommandobasiert) — ein späterer Zwei-Personen-Modus braucht keinen Kernumbau.
