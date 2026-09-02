# WorldWar

Ein privater, nicht-kommerzieller Nachbau von **Supremacy: World War 3** als
**Singleplayer gegen Computergegner** — mit zwei bewussten Verbesserungen gegenüber dem
Original: **frei regelbare Spielgeschwindigkeit** (kein Warten über Tage) und
**keinerlei Monetarisierung** (kein Gold, keine Kaufvorteile, keine Werbung, kein Konto).

Status: **Planung abgeschlossen, Umsetzung noch nicht begonnen.**

## Für Noah

| Was | Wo |
|---|---|
| Was gebaut wird (Anforderungen) | [`docs/plan/01-REQUIREMENTS.md`](docs/plan/01-REQUIREMENTS.md) |
| Wie es gebaut wird (Architektur, Formeln) | [`docs/plan/02-DESIGN.md`](docs/plan/02-DESIGN.md) |
| In welcher Reihenfolge (Aufgabenplan) | [`docs/plan/03-TASKS.md`](docs/plan/03-TASKS.md) |
| Mechanik-Referenz des Originals | [`docs/research/SUPREMACY-MECHANICS.md`](docs/research/SUPREMACY-MECHANICS.md) |

Drei Stellen im Plan brauchen dich: die Freigabe für den Geodaten-Download (T-M9-01), die
Design-Freigabe für die Oberfläche (T-M10-01) und der Abnahme-Playtest (T-M12-03).

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
