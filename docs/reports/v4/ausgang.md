# V4 Etappe 1 Stellung — Ausgang (T-M48-01)

## Stand
- Ausgang: `origin/main` = `25aafa4`, Zweig `claude/v4-stellung`, Worktree `.claude/worktrees/vm07`.
- Node v26.7.0; PR #22 (execArgv `--no-experimental-webstorage`) ist nicht in `origin/main`.

## Desktop-Tests vor dem Umbau (`pnpm vitest run apps/desktop`)
| Lauf | Exit | Testdateien | Tests |
|---|---|---|---|
| ohne NODE_OPTIONS (`b1-vorher.log`) | 1 | 3 rot, 68 gruen (71) | 23 rot, 1578 gruen (1601) |
| mit `NODE_OPTIONS=--no-experimental-webstorage` (`b1-vorher-nodeopt.log`) | 0 | 71 gruen | 1601 gruen (1601) |

Die 23 roten Tests sind localStorage-Fehler der Node-26-Umgebung; die Umgebungsvariable behebt sie vollstaendig.

## A6 — Stapelwaechter S575, Sicht p6, 237 Armeen (`docs/reports/v3/treffer.json`, `byScale`, Stand 25aafa4)
| Feld | Massstab 0.5 | Massstab 1 | Massstab 2 | Massstab 4 | Massstab 8 |
|---|---|---|---|---|---|
| markers | 237 | 237 | 237 | 237 | 237 |
| fullyHidden | 0 | 0 | 0 | 0 | 0 |
| partlyCovered | 0 | 0 | 0 | 0 | 0 |
| centreCovered | 0 | 0 | 0 | 0 | 0 |
| ownTotal | 193 | 193 | 193 | 193 | 193 |
| ownHit | 193 | 193 | 193 | 193 | 193 |
| visiblePoints | 6755 | 6755 | 6755 | 6755 | 6755 |
| visiblePicked | 6755 | 6755 | 6755 | 6755 | 6755 |
| farFromHome48px | 96 | 121 | 174 | 209 | 219 |
| meanMovePx | 43 | 52 | 75 | 118 | 155 |
| maxMovePx | 108 | 131 | 205 | 248 | 276 |

## A5 — Wirkung der Stellung (Planer-Messung 2026-10-05)
- S575, Sicht p6: 193 eigene Armeen, **161 bekaemen eine Stellung** (107 Kaserne, 54 Fabrik), 32 bleiben in der Mitte.
- 21 Provinzen betroffen; bis zu 21 Armeen an einem Anker; 159 der 193 marschieren.
- Spitze: SAU Saudi-Arabien (27 eigene, 10 Kaserne + 17 Fabrik, Mitte 2479/1250), MYS (26), BFA/BEN/IRQ (14).
- Quelle: `vm07-count.mjs` + `vm07-count.out.json` (Planner-Scratch, Kanban-Task t_80c1bba6; Kern per esbuild gebuendelt, nur gelesen). Plan: Vault-Notiz „WorldWar — Plan V4 Etappe 1 Stellung“, Annahme A5.
