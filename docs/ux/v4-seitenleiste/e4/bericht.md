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

## E4.7 — Messreihe gegen B0 (Ergänzung, nach E4.1-E4.6)

Stand: Branch `claude/seitenleiste-e4` HEAD 1f39225 (nach E4.1-E4.6, alle gemergt/angenommen).
Maschine: Pi 5, 4 Kerne. Last vor Lauf 1: 4,68/4,04/4,04 (fremder vitest-Lauf eines anderen
Workers) — 6 Min gewartet, keine Besserung, Lauf verschoben (`kanban_block transient`,
siehe Kommentarverlauf). Last vor Lauf 2 (dieser Durchlauf): 0,47-0,65/0,34/0,24 — frei.
RAM frei 6,4 GiB / verfügbar 13 GiB. Kein Unreal/R6Arena, kein GAMING_MODE.flag. Dev-Server
`npx vite --port 5361 --strictPort` in `apps/desktop`, nach dem Lauf per PID beendet,
Port 5361 danach frei geprüft (`lsof`/`fuser` leer).

Skripte (unverändert übernommen aus E1-E3, Befehle aus den Kopfkommentaren):
`node scripts/ux-layout.mjs --url http://localhost:5361/ --viewports 1280x800,1920x1080,375x667 --shots`
(+ ein zweiter Lauf `--viewports 1280x800 --tag e4-touch-quer` für die vierte Auflösung),
`node scripts/ux-tasks.mjs --url http://localhost:5361/ --out docs/ux/v4-seitenleiste/e4`,
`node scripts/ux-bild.mjs --url http://localhost:5361/ --viewports 1280x800,1920x1080,375x667`,
`node scripts/ux-axe-full.mjs --url http://localhost:5361/ --viewport <vp>` (1280x800, 1920x1080,
375x667). **Eine Anpassung an `scripts/ux-layout.mjs`**: Bisher gab es keine eigene Markt-Szene
(nur Diplomatie); für K2 Markt-Körper wurde — nach demselben Muster wie die bestehende
Diplomatie-Szene (RAIL_ITEM-Klick, `side.clientHeight`/`side.scrollHeight`) — eine `markt`-Szene
ergänzt (`scripts/ux-layout.mjs`, nach der Diplomatie-Messung, vor `Escape`). Keine neue
Abhängigkeit, kein Fremdcode.

### Abnahme-Tabelle gegen B0

| K | Soll | E4.7 (1280x800 / 1920x1080) | Beleg |
|---|---|---|---|
| K2 Diplomatie scrollH/clientH | ≤1,5 | 720/720 = 1,0 / 1000/1000 = 1,0 | `layout-e4.json` scenes.diplomatie |
| K2 „Krieg erklären" sichtbar ohne Rolle | sichtbar, inView | gefunden, inView=true, y=215 | `layout-e4.json` scenes.diplomatie.probes |
| K2 Markt-Körper scrollH/clientH | ≤1,5 | 720/720 = 1,0 / 1000/1000 = 1,0 | `layout-e4.json` scenes.markt (neue Szene) |
| K4 armee-bewegen (maus/tastatur) | ≤ B0 (5/0, 0/8) | 5/0, 0/8 | `aufgaben-e4.json` = B0 `aufgaben-basis.json` |
| K4 armee-teilen-zusammenlegen | ≤ B0 (3/0, 0/6) | 3/0, 0/6 | gleich B0 |
| K4 bauen | ≤ B0 (2/0, 0/4) | 2/0, 0/4 | gleich B0 |
| K4 ausheben | ≤ B0 (2/0, 0/5) | 2/0, 0/5 | gleich B0 |
| K4 krieg-erklaeren | ≤ B0 (4/0, 0/6) | 4/0 (= B0), **0/7 tastatur (B0: 0/6, +1 Taste)** | `aufgaben-e4.json` vs `aufgaben-basis.json` |
| K4 frieden-anbieten | ≤ B0 (3/0 erreicht, 0/2 erreicht) | **maus: ABBRUCH, nicht erreicht** (Timeout 8000ms, Button "Frieden anbieten" nicht gefunden); **tastatur: 309 Tasten, nicht erreicht** (Tab-Fokus auf Mexiko erst nach 57 statt 2 Tab, dann Zeitlimit beim Weitersuchen) | `aufgaben-e4.json` — **NICHT erfüllt, Regression** |
| K4 handel-anbieten | ≤ B0 (5/5, 0/16) | 5/5 (= B0), **0/17 tastatur (B0: 0/16, +1 Taste)** | gleich bis auf 1 Taste |
| K4 spion-anwerben | ≤ B0 (4/0 fehlwege1, 0/11) | 4/0 fehlwege1 (= B0), 0/11 (= B0) | gleich B0 |
| K10 axe 2.2 voll | 0 bzw. ≤ B0, keine neue Regelart | 1280x800: 9 Treffer Regel `target-size` (= B0-Muster 1×9 Szenen); 1920x1080: 9 Treffer `target-size`; 375x667: 0 | `axe-voll-1280x800.json`, `axe-voll-1920x1080.json`, `axe-voll-375x667.json` — keine neue Regelart |
| K14 keine neue Abhängigkeit | erfüllt | `git diff --stat HEAD -- package.json pnpm-lock.yaml apps/desktop/package.json` leer (nur `scripts/ux-layout.mjs` geändert) | — |
| K15 Bilder | 1280x800, 1920x1080, 375x667, Touch quer | je ~5 Szenen-Bilder pro Auflösung vorhanden (`S575G-e4-*-{1280x800,1920x1080,375x667}.png`, `S575G-e4-touch-quer-*-1280x800.png`) | Verzeichnislisting `docs/ux/v4-seitenleiste/e4/` |

### Befund: Regression bei „Frieden anbieten" (K4, kritisch)

Mit Maus **und** Tastatur ist „Frieden anbieten" auf dem Diplomatie-Bildschirm (Zustand: Krieg
gegen Mexiko besteht, S300) in diesem Stand **nicht erreichbar**:

- Maus: `getByRole('button', { name: 'Frieden anbieten', exact: true })` läuft nach 8000 ms in
  Timeout — der Button ist entweder nicht im DOM oder nicht sichtbar in diesem Ablauf.
- Tastatur: die Tab-Reihenfolge bis „Mexiko" braucht jetzt 57 Tab-Stopps statt 2 in B0
  (`schritte` in `aufgaben-e4.json`, Lauf `frieden-anbieten/tastatur`) — vermutlich weil die
  `.power-row`-Umstellung (E4.3) jetzt alle Mächte-Zeilen einzeln fokussierbar macht, bevor die
  Liste zur gewählten Macht springt. Der Lauf erreicht danach die 250-Tab-Obergrenze des Skripts
  und bricht mit Fehlweg ab.

Dies ist eine Funktionsregression gegenüber B0 (dort `erreicht: true` in beiden Modi) und muss
in einer Folge-Etappe behoben werden (vermutlich Diplomatie-Zustand „Krieg besteht" zeigt den
Knopf an anderer Stelle, oder die Tab-Reihenfolge der Mächte-Liste muss gekürzt werden). Nicht
im Rahmen dieses Mess-Tickets behoben (reine Messreihe laut Auftrag).

### Weitere kleine Abweichungen

- krieg-erklaeren/tastatur und handel-anbieten/tastatur je +1 Taste gegenüber B0 — vermutlich
  dieselbe Ursache (ein zusätzlicher Tab-Stopp durch die `.power-row`-Liste), aber nicht
  blockierend, da die Aufgaben trotzdem erreicht werden.

### Fazit E4.7

K2 (Diplomatie + Markt, beide Auflösungen) erfüllt, K10 (axe) erfüllt (keine neue Regelart),
K14 erfüllt, K15 (Bilder aller 4 Auflösungen) erfüllt. **K4 NICHT vollständig erfüllt**:
„Frieden anbieten" ist in diesem Stand per Maus und Tastatur nicht erreichbar (Regression,
vermutlich Folge der E4.3-Umstellung der Mächte-Zeilen auf `.power-row`); zwei Aufgaben haben
je 1 Taste mehr als B0 (krieg-erklaeren, handel-anbieten tastatur), beide noch erreichbar.
Empfehlung: Fix-Ticket für „Frieden anbieten" vor Abnahme der gesamten E4-Reihe, da K4 damit
nicht vollständig erfüllt ist.
