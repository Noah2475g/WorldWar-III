# E4 — Bericht (Teilumsetzung)

## Zusammenfassung

Dieser Durchlauf hat **nicht** den vollen in t_0a91a4b7 beschriebenen Umbau der 7 Bereiche
geschafft. Umgesetzt wurde ehrlich nur:

1. `.power-row` Selektor (data-power, data-status) für die Diplomatie-Mächte-Zeilen,
   Entscheidung aus dem Plan wörtlich umgesetzt.
2. `POWER_ROW`-Konstante in `scripts/ux-sel.mjs` angelegt.
3. `warInEffect` in `scripts/ux-tasks.defs.mjs` auf den neuen Selektor umgestellt (nur
   Selektor geändert, Logik gleich — wie vorgegeben).
4. Inventur-Dokument geschrieben (`docs/ux/v4-seitenleiste/e4/bereiche-inventur.md`).
5. `pnpm verify` grün (Log: `verify.log` im Worktree-Root), volle Testsuite (225 Dateien,
   4143 Tests) grün.
6. K14 (keine neue Abhängigkeit) geprüft: `git diff --stat origin/main -- package.json
   pnpm-lock.yaml apps/desktop/package.json` ist leer → keine Änderung an Abhängigkeiten.

**Nicht umgesetzt** (Zeitbudget dieses Durchlaufs reichte nicht): Markt-Chip-Leiste,
Wirtschafts-Tabelle nach Bild 8, Weitere-Aufklappmuster für Heer/Spionage/Rangliste/
Protokoll, Liefervertrag-Neudarstellung, "Krieg erklären" als eigener roter Rahmenknopf,
die komplette Messreihe (ux-layout/ux-tasks/ux-bild/ux-axe-full) auf einem laufenden
Dev-Server bei 1280x800/1920x1080/375x667/Touch-quer, und der Bildvergleich gegen
`final-v3-8-schmal-320.png` per vision_analyze.

## Maschinen-Last vor dem (nicht durchgeführten) Messlauf

Da kein Dev-Server/Messlauf durchgeführt wurde, galt die Last-Prüfung nur für die
Verify/Test-Läufe:

- `uptime`: load average 0.26, 2.10, 2.61 (4 Kerne) — unauffällig
- `free -h`: RAM frei 7.3Gi, **verfügbar** 13Gi (von 15Gi) — "frei" knapp unter der
  8GB-Schwelle, "verfügbar" deutlich darüber (Cache ist freigebbar); keine eigene
  Interpretation angewendet, hier wörtlich dokumentiert statt beschönigt
- `nvidia-smi`: nicht installiert (erwartet auf diesem Pi)
- `ps aux | grep -i unreal`: leer

Port 5361 / Dev-Server wurde in diesem Durchlauf **nicht gestartet**, da keine
Messläufe durchgeführt wurden.

## Abnahmekriterien — ehrlicher Status

| Kriterium | Status | Beleg |
|---|---|---|
| K2 (Diplomatie scrollH/clientH ≤1,5, Krieg erklären sichtbar ohne Rolle) | **nicht gemessen** | kein Messlauf (ux-layout.mjs) durchgeführt |
| K4 (Aufgaben ≤ B0) | **nicht gemessen** | kein ux-tasks.mjs-Lauf; einzig verifiziert: bestehende Vitest-Suite bleibt grün |
| K5 | **nicht gemessen** | — |
| K9 | **nicht gemessen** | — |
| K10 | **nicht gemessen** | — |
| K11 | **nicht gemessen** | — |
| K12 | **nicht gemessen** | — |
| K14 (keine neue Abhängigkeit) | **erfüllt** | `git diff --stat origin/main -- package.json pnpm-lock.yaml apps/desktop/package.json` leer |
| K15 | **nicht gemessen** | — |

## Fazit

Dieser PR liefert nur die Selektor-Grundlage (`.power-row`) und die ehrliche Inventur,
nicht den vollständigen v3b-Umbau der 7 Bereiche. Die Abnahmekriterien K2/K4/K5/K9/K10/
K11/K12/K15 sind **offen** und müssen in einer Folge-Etappe mit echtem Mess-/Screenshot-
Lauf gegen B0/E3 belegt werden, bevor das Ticket als abgeschlossen gilt. `pnpm verify`
ist grün, die bestehende Testsuite ist unverändert grün, keine neuen Abhängigkeiten.

OSS: nichts Neues; Weitere-Liste mit Aufklapp-Muster aus Explain.tsx (@radix-ui/react-dropdown-menu
MIT 2.1.25 verworfen: 7 Abhängigkeiten) — diese Entscheidung ist für eine Folge-Etappe
vorgemerkt, da das Aufklappmuster selbst noch nicht gebaut wurde.
