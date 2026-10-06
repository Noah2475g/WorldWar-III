# Armee-Sammelmarke (M49): Abnahme am laufenden Programm (T-M49-04)

Basis-Commit: 6ca34a4 (origin/main bei B1). Branch claude/sammelmarke, danach `git merge origin/main` (185b849, nur Doku-Konflikte: 03-TASKS.md, DECISIONS.md, tasks.yaml, beide Seiten behalten).
Stand S575G, Mensch = staerkste Macht, Uebersichtskarte, Provinz SAU, 1280x800, msedge (Playwright). Skript: scripts/v4-sammel-bild.mjs.

## Zahlen (docs/reports/v4/sammel.json, B3)

| Massstab | ohne | mit | Gruppen | groesste |
|---|---|---|---|---|
| 0.97 (near) | 154 | 154 | 0 | 0 |
| 1.6 | 216 | 54 | 17 | 18 |
| 2.3 | 237 | 57 | 18 | 26 |

Ganze Karte: 193 eigene = 37 einzeln + 156 in 14 Gruppen; fullyHidden 0.

## Bilder (selbst angesehen)

Das Skript hat im Lauf `data-view-scale 2.0000` (Tier mid) geliefert, nicht 1.6 (Risiko R7). Der Tier stimmt (mid); die Zahlen im Bericht stammen aus dem Slow-Test bei 1.6/2.3.

- mid-vorher.png (6ca34a4, kein Tier-Attribut, Scale 2.0): sehr dichter Kastenteppich, grob 230 Kaesten; Zahlen 1-20 je Kasten, Gitter aus 20er-Kaesten in Indochina/Sumatra, keine Pfeile sichtbar.
- mid-nachher.png (Tier mid, Scale 2.0000): grob 60 Kaesten/Marken; etwa 35 Einzelkaesten und etwa 25 Sammelmarken mit Zahl (23, 17, 21, 26, 27, 37, 99, 507 bei eigenen; x11, x13, x14 bei der Gegenseite). Ein Pfeil je Konvoi, gruen fuer eigene; Tageslabel nur an der gewaehlten Armee. Karte lesbar, Gebaeude wieder sichtbar.
- nah-nachher.png (4 Rad-Schritte, Tier near, Scale 0.9645): nur Einzelkaesten (Zahlen 1-3, 13, 15), keine Sammelmarke, viele Pfeile (alle Konvois) und Tageslabel wie bisher; near unveraendert.

Abweichung zum Plan: 3 Rad-Schritte ergaben Scale 1.1574 (Tier mid, Abbruch); mit `--wheel 4` Scale 0.9645, Tier near. Das Skript hat dafuer die Option `--wheel` (Standard 3).

Skript-Logs: b4-bild-vorher.log (mid data-view-scale 2.0000, --no-tier-check), b4-bild-nachher.log (mid 2.0000, nah near 0.9645) im Kanban-Arbeitsordner t_ee0f4172.

Hinweis R5: In Gruppen ab 4 ist die einzelne Stellung auf mid nicht sichtbar; erst Klick auf die Marke (Zoom auf 1) oder near zeigt sie.

## Last (Maschinen-Regel)

| Zeitpunkt | CPU | GPU | RAM frei | Unreal/R6Arena | eigene Altinstanzen |
|---|---|---|---|---|---|
| vor vorher-Lauf (05:00) | ca. 5-10 % | 9 % | ca. 15 GB | keine | keine |
| vor nachher-Lauf (05:02) | ca. 24 % | 10 % | ca. 15 GB | keine | keine |

Nur ein Dev-Server zugleich: Port 5344 (sammel-vorher, PID 28820/28988), Port 5343 (sammel, PID 10004/27388). Alle per `taskkill /PID .. /T /F` beendet, Ports frei, kein msedge uebrig. Worktree sammel-vorher entfernt (Dateiname zu lang fuer git: node_modules per Python mit `\\?\`-Pfad geloescht, `git worktree prune`).
