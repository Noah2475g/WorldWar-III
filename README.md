# WorldWar

Ein privater, nicht-kommerzieller Nachbau von **Supremacy: World War 3** als
**Singleplayer gegen Computergegner** — mit zwei bewussten Verbesserungen gegenüber dem
Original: **frei regelbare Spielgeschwindigkeit** (kein Warten über Tage) und
**keinerlei Monetarisierung** (kein Gold, keine Kaufvorteile, keine Werbung, kein Konto).

Status (2026-09-14): **abgenommen, und man kann es zu zweit spielen.** `pnpm acceptance` lief
am 2026-09-14 auf freier Maschine **12 von 12, Exit 0, 5 min 7 s**; das Spiel wird mit der
Startzahl 1914 an Spieltag **975** entschieden (mit 2015 und 1815 je an Tag 583). Von
**312 Aufgaben sind 293 gebaut**, darunter der **Mehrspieler M37–M39 mit 29 von 30**
([`docs/plan/MEHRSPIELER.md`](docs/plan/MEHRSPIELER.md)). Offen sind **fünfzehn** aus M17
(„Tiefe zwischen den Kriegen", als Ganzes geplant — gebaut wird es auf Noahs Ansage),
**eine** — die Abnahme des Mehrspielers, die zwei Menschen in zwei Netzen braucht — und
**drei zurückgenommene** Aufgaben, jede mit Begründung im Plan: T-M10-02, T-M40-04 und
T-M41-10.

Der letzte Bauabschnitt sind **M41, M40 und M35** (2026-09-13): die KI baut ihre Fabriken
wirklich aus, die Uhr hält ihr Tempo, Armeen haben vier Haltungen mit Erklärtext — eine
Verteidigung rückt nach, wenn eine zweite Armee stehen bleibt, der Angriff marschiert nie
von selbst —, und die lange Mitte der Partie hat vier Zwischenziele in der Rangliste. Davor
hatte **M34** die Fortschrittsachse gestreckt: die letzte Freischaltung liegt bei Spieltag 80
statt 16, Gebäudestufen kosten und dauern mehr, und über der Aushebeliste steht, was als
Nächstes kommt.

`pnpm tauri:build` erzeugt `WorldWar_0.1.0_x64_en-US.msi` und ein NSIS-Setup; der
Auslieferungsweg ist gelaufen und nicht nur beschrieben. **AK-8 ist am 2026-09-14 am
gebauten Programm gemessen und erfüllt** — starten, speichern, beenden, neu starten,
weiterspielen ([`docs/reports/packaging.md`](docs/reports/packaging.md)). Noahs Playtest liegt in zwei
Berichten vor ([`docs/PLAYTEST.md`](docs/PLAYTEST.md) beschreibt den Ablauf).

**Arbeitest du an diesem Projekt, lies genau eine Datei:**
[`docs/plan/WORKFLOW.md`](docs/plan/WORKFLOW.md). Sie sagt, wo der Stand liegt, was gilt,
welche Fallen es gibt und was in welcher Reihenfolge zu tun ist.

### Wie es hierher kam

Eine Auswertung am 2026-09-05 fand 68 bestätigte Befunde, darunter sieben Blocker: kein
Spielstand überlebte das Schließen des Fensters, der Stapel-Deckel machte Armeen ab 50
Einheiten wertlos, das Anforderungstor war rot, AK-1 prüfte kein Test, und das Spiel hatte
keine Schrift. Der blinde Fleck über allem: **niemand hatte das Spiel je gestartet.**

Drei Meilensteine haben das abgeräumt. **M14** machte den Bericht über das Spiel wieder
wahr — Spielstände überleben das Fenster, das Anforderungstor meldet `V1 offen: 0`, und
AK-1 ist erstmals belegt. **M15** machte die KI zu einem Gegner; die Lehre steckt in
ihrem Integrationstor: eine Mechanik war in zwölf Einzeltests belegt und **im Spiel tot**.
**M16** verpackt das Ganze als Programm.

Danach ging es nicht mehr um Fehlendes, sondern um Qualität: **M22–M24** brachten die
Oberfläche auf den Stand des Kerns und die Sprache auf echtes Deutsch, **M25–M27**
ersetzten Text durch Bilder (Kurven, Marschpfeile, Gefechtsbild), **M29–M32** bauten den
Kriegsrat um. Zwei adversarische Durchsichten des Diffs fanden dabei einundzwanzig
Befunde, die die Widerlegung überlebten; der schwerste war, dass ohne Maus kein einziger
Knopf zu betätigen war. **M33** gab Einheiten und Gebäuden Bilder, **M36** machte die
Rohstoffleiste lesbar, und **M34** streckte die Fortschrittsachse — sie war nach 6,4
Minuten Echtzeit durchlaufen, während die Partie über achthundert Spieltage lief.


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

Alle drei Stellen, die dich brauchten, sind erledigt: Geodaten-Freigabe (T-M9-01),
Design-Freigabe (T-M10-01) und der Abnahme-Playtest (T-M12-03), den du am 2026-09-07
ausdrücklich an den Agenten delegiert hast. Was jetzt auf dich wartet, ist kein Tor mehr,
sondern die Frage, die kein Agent beantworten kann: *wolltest du weiterspielen?*

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
- **Zeit:** 1 Tick = 1 Spielstunde; Regler von Pause bis 100 Spielstunden pro Sekunde,
  dazu „Vorspulen bis Ereignis“.
- **Vorgehen:** strikt testgetrieben; Kern ≥ 90 % Testabdeckung, Determinismus per Golden-Master
  abgesichert.
- **Mehrspieler:** nicht in V1, aber seit dem 2026-09-14 **gebaut** (M37–M39, 29 von 30
  Aufgaben). Eine Partie zu zweit im Gleichschritt: beide Rechner rechnen alles selbst und
  tauschen nur Befehle — rund zweihundert Byte je Sekunde —, jede Nachricht trägt die
  Prüfsumme des letzten Ticks, und bei Abweichung hält die Partie an, statt zwei Welten
  weiterzuspielen. Der Host ist der Server, der Gast tritt über einen Link und Tailscale
  bei, **das ausgelieferte Programm bleibt netzfrei** (`connect-src 'none'`, am Erzeugnis
  gemessen), und der Kern wurde nicht angefasst. Die Abnahme AK-9 braucht Noah und einen
  zweiten Menschen in einem anderen Netz — Anleitung in
  [`docs/reports/mehrspieler-anleitung.md`](docs/reports/mehrspieler-anleitung.md).
