# ÜBERGABE — Schlussblock nach M41, M40 und M35 (Stand 2026-09-14, nach der Abnahme)

> **Für den nächsten Agenten: Diese Datei ist dein Auftrag.** Du musst nichts analysieren. Lies sie
> ganz, dann `CLAUDE.md` und `docs/plan/WORKFLOW.md` §3–§4 (Regeln, Fallen), und arbeite §3 hier
> **in dieser Reihenfolge** ab. Alles, was dafür nötig ist, steht hier oder in den genannten Dateien.
> `WORKFLOW.md` Kopf/§0–§2/§5 sind **veraltet** (Stand 2026-09-12) — sie nachzuziehen ist Schritt 3.6.
>
> **Neu gegenüber der Fassung vom 2026-09-13:** Schritt 3.1 (Frische-Wächter) und 3.2 (`pnpm
> acceptance`) sind **erledigt und grün** — Einzelheiten in §1a. Offen sind 3.3 bis 3.7.

---

## 0 · Wo du bist

```bash
git fetch origin
git switch claude/offene-punkte-abschliessen   # NICHT main — main ist 80+ Commits älter
git pull --ff-only
git log --oneline -1 && git status --short && pnpm install
```

- Zweig **`claude/offene-punkte-abschliessen`**, gepusht, **PR #7 gegen `main` offen**
  (https://github.com/Noah2475g/WorldWar-III/pull/7 — **Noah merged, nicht du**).
- Spitze bei der Übergabe: **`c410c8e`** („docs(reports): Abnahme nach M41, M40 und M35").
  Arbeitsbaum sauber, Zweig mit `origin` gleichauf.
- Keine Worktrees mehr außer zwei alten Planungs-Worktrees (`iphone-app-deployment-plan-49df37`,
  `multiplayer-invite-feature-plan-0a0cc1`) — **nicht anfassen**, nicht Teil des Auftrags.

## 1 · Was diese Sitzung gemacht hat (Auftrag Noah, /goal 2026-09-13)

Auftrag: *alle offenen Punkte abschließen, außer Mehrspieler (M37–M39) und iPhone-App.* Noah hat
dabei seine offenen Spielentscheidungen delegiert (Einträge in `DECISIONS.md`, je „kippbar"). Um
17:10 entschied Noah wegen der Dauer: **M17 wird später gebaut** (bleibt geplant, 1 von 16 Aufgaben).

| Block | Inhalt | Beleg |
|---|---|---|
| Plan-Wächter | liest auch `03-TASKS.md` (63 tote Pfade aufgelöst), Glob ohne `node_modules` | `fac654b`, `7ad42cd`, `d4e071b` |
| Planung | M35, M40, M41 und M17 (D29–D31, R-GAME-08/09, R-UNIT-09, R-DIP-08/09, R-AI-09) | `5b4d1d9`, `8b85393` |
| **M41** Pflege nach M34 | KI baut Fabriken aus; Uhr verlor im Spiel 40 % der Ticks; KI-Gedächtnis 106 → 10 KB; Vorankündigung der Freischaltungen; Nahkampf-Eigenschaft; Nacharbeit N1 (Ankündigungstext, Meldungen stehen den Tag, Tempo im Vorspulen gesperrt, Uhr-Kappe); Block N2 (keine Befehle an zusammengelegte Armeen, Fabrik-Sperre behoben, kein Bau in erinnerten Provinzen, Hauptstadt-Sperre in der Sicht; **T-M41-10 gebaut und zurückgenommen**) | `PROGRESS.md`, `PROBLEME.md` |
| **M40** Haltungen | Adjutant für menschliche Armeen; nach zwei Durchsichten grundlegend nachgearbeitet: eine Befehlsquelle für Uhr und Vorspulen, kein Marsch auf Nicht-eigenes Gebiet, Regel „nicht entblößen", 5 Tage Ruhe, eigener Marsch/Anhalten → Garnison, leise Meldung; Messlauf je Episode (12 Läufe), Frische-Wächter nach Abstammung mit `measuredAtCommit` | D30, `docs/reports/stance.json` |
| **M35** Zwischenziele | Feld `goals`, `SCHEMA_VERSION` 3 (`save-v2.json` eingefroren), `GOAL_REACHED`, vier Zeilen in der Rangliste; Marke Bevölkerung **350 ‰** (statt 300, Reihenfolge-Befund) | D31, `docs/reports/fullgame*.json` |
| Messberichte | Parameterlauf (`5cdc611`, Grundlauf 44,4 % → 36,8 %), Haltungs-Messlauf auf `bd4744c` (`e009bc4`), Turnier mit Messcommit (`b692328`) — **alle drei Frische-Wächter `fresh=true`** | §1a |
| **Abnahme** | `pnpm acceptance` Exit 0, **12 von 12** | `c410c8e`, §1a |

## 1a · Schritt 3.1 und 3.2 — erledigt am 2026-09-13 abends (gemessen)

**Frische-Wächter (3.1): alle drei `fresh=true`**, geprüft auf `02c0bf9` und nach dem Commit noch
einmal auf `c410c8e`. Aufruf (so, nicht anders — `allFreshness` bündelt die drei in der Reihenfolge
der Abnahme):

```bash
node --input-type=module -e "const m = await import('./scripts/freshness.mjs'); console.log(m.allFreshness('.'))"
```

| Wächter | Bericht gemessen auf | warum frisch |
|---|---|---|
| Parameterlauf | `5cdc611` | seitdem kein Commit an `data/rules`, `data/maps/world.json` |
| Turnier | `5252d64` | seitdem kein Commit an `data/rules`, `data/maps/testworld.json`, `packages/ai/src`, `packages/core/src` |
| Haltungs-Messlauf | `bd4744c` | seitdem kein Commit an den Quellen; AK5 mit Kontrolle und Kartenfenster erfüllt |

**Abnahmelauf (3.2):** Last vor dem Start `LoadPercentage 4` (kein Spiel, keine zweite Suite) →
`pnpm acceptance` **Exit 0**, Wanduhr **4 min 58 s** (21:53:25Z–21:58:23Z). Commit `c410c8e`,
neun Berichtsdateien, alle 0 CR-Bytes; `PROBLEME.md` unverändert 7 CR vorher/nachher.

**Ergebnis 12 von 12** — nicht 11/11. Seit dem 2026-09-12 ist **eine Prüfung dazugekommen**
(dritter Frische-Wächter „Haltungs-Messlauf", T-M40-16/-17); die alten elf sind alle da und alle
grün. **In `WORKFLOW.md` §5 gehört darum `12/12`, nicht `11/11`.** Daneben stehen drei nicht
maschinell zählende Zeilen: AK-7 ✅ abgenommen, **AK-8 ⚠ „`packaging.md` nennt keinen Stand — keine
Messung"** (genau das räumt Schritt 3.4 ab), AK-9 ⏸ M39, noch nicht gemessen.

Kennzahlen gegen den Stand vom 2026-09-12 (`d82779d`), alles aus den Berichten:

| Größe | 2026-09-12 | jetzt |
|---|---|---|
| Prüfungen | 11 von 11 | **12 von 12** |
| Wanduhr der Abnahme | 7 min 28 s | **4 min 58 s** (`totalSeconds` 298) |
| AK-1 Siegtag (1914) | 471, 1827 Eroberungen, 12 Kriegserklärungen | **975**, 2589, 11 |
| Abdeckung gesamt | 95,9 % | **96,3 %** |
| Langlauf gesamt / je Tick | 319 030 ms / 13,293 ms | **198 321 ms / 8,263 ms** |
| Langlauf: Partie entschieden | Tick 19320 | **nicht entschieden** |
| Weltkarte Median / p99 | 2,665 / 6,064 ms | **2,523 / 6,215 ms** (gefordert 3,5 / 8) |
| R-AI-04 Anteil KI am Tick | 0,082 | **0,072** (Grenze 0,3) |
| Zeichnen p95 | 2,57 ms | **2,29 ms** (Bildbudget 16,7 ms) |

Kein Zeitbudget war knapp, **keine Grenze wurde angefasst**, kein Produktivcode verändert.

Zuletzt gemessen davor: `pnpm verify` **Exit 0, 2118 Tests** (nach M35, Kern 96,9 %).

## 2 · Freigaben von Noah, die für dich gelten

- **Fenster im Vordergrund: freigegeben** (Noah, 2026-09-13 abends: „Zwanzig, dreißig Minuten ist gar
  kein Problem. Ich beende das Spiel."). Du darfst einen Browser und das gebaute Programm sichtbar
  nach vorne holen und steuern.
- **Spielstände schützen** (Pflicht, §3.4): nur **umbenennen**, nie löschen.
- Kein Push auf `main`, kein Merge des PRs — das macht Noah. Commits auf den Zweig pushen ist
  erlaubt, **niemals mit `--force`**.

## 3 · Was du tust — in dieser Reihenfolge

> 3.1 und 3.2 sind erledigt (§1a). Fang bei 3.3 an.

### 3.3 Programm bauen (~10–20 min)
```bash
pnpm tauri:build > tauri-build.log 2>&1; echo "exit $?"
```
- **Während des Baus keine Quelldatei ändern** (WORKFLOW Falle 7).
- Erzeugnis: `apps/desktop/src-tauri/target/release/worldwar.exe` (vorher 13.09. 00:28, 6 776 832 B —
  Größe und Datum danach notieren).

### 3.4 AK-8 am gebauten Programm (~10 min, Fenster sichtbar)
Ablauf wie `docs/reports/packaging.md`: Start → Startdialog **ohne** „Weiterspielen" → „Partie
beginnen" → Strg+S → „Speichern" für Stand 1 → „Gespeichert." und Zeile „Stand 1 — Tag N" → Programm
beenden → neu starten → erster Knopf „Weiterspielen (Tag N)" → klicken → Partie läuft.

**1. Noahs Spielstände parken (Pflicht):** `%APPDATA%\de.noahhaumersen.worldwar\saves` enthält
(gemessen 2026-09-13) `autosave-0.json.json` (334 237 B, 09.09. 23:08 — Noahs Partie),
`zeitreihe.autosave-0.json.json`, `stand-1.json`, `zeitreihe.stand-1.json`.
```powershell
$d = Join-Path $env:APPDATA 'de.noahhaumersen.worldwar'
Get-ChildItem (Join-Path $d 'saves') | Select-Object Name, Length   # vorher notieren
Rename-Item (Join-Path $d 'saves') 'saves.geparkt-2026-09-14'
```
(`saves.geparkt-2026-09-08` existiert schon — nicht anfassen.)

**2. Messen:** fertiges Steuerskript über CDP (WebView2 Remote-Debugging, Node-eigener WebSocket):
```bash
node docs/plan/schlussblock/ak8-cdp.mjs apps/desktop/src-tauri/target/release/worldwar.exe <scratchpad>/ak8
```
Es bricht ab, wenn `saves` nicht leer ist, startet das Programm zweimal, klickt über Knopftexte,
schreibt `ak8-ergebnis.json` + Screenshots und beendet nur die eigenen Prozesse. **Es ist noch nie
gelaufen** — rechne mit Anpassungen (z. B. wie der Speichern-Knopf der Zeile „Stand 1" im Dialog
heißt: vorher über das DOM prüfen). Jede Anpassung am Skript im Repo mitcommitten.

**3. Zurückbenennen (Pflicht):**
```powershell
Rename-Item (Join-Path $d 'saves') 'saves.messung-2026-09-14'
Rename-Item (Join-Path $d 'saves.geparkt-2026-09-14') 'saves'
Get-ChildItem (Join-Path $d 'saves') | Select-Object Name, Length   # muss der Liste von vorher gleichen
```
**4.** `docs/reports/packaging.md` mit Stand-Stempel (Commit, exe-Größe, Datum) und den Schritten neu
schreiben; alte Messung als Geschichte behalten. Commit. Damit fällt das `AK-8 ⚠` aus §1a weg.

### 3.5 Sichtprüfung im echten Browser (~20 min, Fenster sichtbar)

> **Achtung, hier hat sich die Lage gegenüber der Fassung vom 2026-09-13 geändert:**
> **Google Chrome ist auf dieser Maschine nicht installiert** (gemessen 2026-09-13). Vorhanden sind
> **Brave** (`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`) und **Edge**
> (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) — beide Chromium, beide
> CDP-fähig. Und: in einer **Hintergrund-Sitzung gibt es die Werkzeuge `preview_start` / „Claude in
> Chrome" nicht.** Hast du sie (interaktive Sitzung), nimm sie. Hast du sie nicht, steuere einen
> echten Browser über CDP — dasselbe Muster wie `docs/plan/schlussblock/ak8-cdp.mjs`:
> Browser mit `--remote-debugging-port=9223` und eigenem `--user-data-dir` starten, `/json` abfragen,
> per WebSocket `Runtime.evaluate` / `Input.dispatchMouseEvent` / `Page.captureScreenshot`.

Warum ein **echtes, sichtbares** Fenster: im Vorschaufenster läuft rAF/die Spieluhr **nie**, und ein
Hintergrund-Tab wird von Chromium eingefroren (am 2026-09-13 lief ein Screenshot deshalb in die
Zeitüberschreitung) → **kein `--headless`, Fenster im Vordergrund.**

Dev-Server: `pnpm --filter @worldwar/desktop dev --port 5174 --strictPort` (so steht es in
`.claude/launch.json` unter dem Namen `desktop-dev`), dann auf `http://localhost:5174`.
Neue Partie mit eigener Startzahl, **keine Spielstände löschen**. Je Punkt Screenshot oder
DOM-Beleg; Ergebnis nach `docs/reports/sichtpruefung-2026-09-14.md`:

1. **Uhr (T-M41-04):** Tempo 100, 10 s Echtzeit → Spielzeit rückt ≈ 1000 Ticks (≈ 41 Tage) vor, nicht ≈ 600 (zwei abgelesene Uhrzeiten + `performance.now()`).
2. **Tempo im Vorspulen gesperrt (T-M41-13):** während „Vorspulen" Tempoknöpfe `disabled` mit Tooltip-Grund.
3. **Ankündigung (T-M41-03/-12):** zwei Tage vor einer Freischaltung „In zwei Tagen: …" mit Voraussetzung; bleibt nach Vorspulen den Tag über sichtbar; bei niedrigerer vorhandener Stufe „Ihre beste steht auf Stufe N".
4. **Haltungsgruppe 2×2 (T-M40-05/-11/-14):** vier Haltungen mit Erklärtext; Anhalten und eigener Marsch auf Verteidigung stellen auf Garnison; Hinweise nennen die Folgen (Kaskade am laufenden Spiel, WORKFLOW §3).
5. **Leise Meldung „rückt nach" (T-M40-13):** zwei eigene Armeen auf Verteidigung in einer Provinz, Feind nebenan → Protokollzeile, nicht laut.
6. **Zwischenziele (T-M35-05):** vier Zeilen in der Rangliste mit Abstand bzw. erreichtem Tag, kein leerer Kasten.
7. **Gefechte im Vorspulen (T-M28-08, seit 2026-09-11 offen):** Krieg herbeiführen, Tempo 10/100 → sind Gefechtsschein/Einschläge sichtbar, ohne das Protokoll zu lesen? (Urteil bleibt Noahs Maßstab — beschreiben, was zu sehen ist, Screenshots/GIF.)

Am Ende Browser und Dev-Server beenden (nur die eigenen Prozesse). Fehler → `PROBLEME.md`, melden
(nicht nebenbei umbauen).

### 3.6 Einstiegsdoku und Projektstand (~40 min)
Nur Dokumentation, kein Code. **Jede Zahl aus einem Bericht oder Befehl, nie geschätzt.**
1. **`DECISIONS.md`:** Eintrag „2026-09-13 · Noah: M17 wird in einer späteren Sitzung gebaut" (Grund Dauer; Stand geplant, 1 von 16; der eine Parameterlauf lief deshalb im Schlussblock, T-M35-02/-06 zeigen dorthin). Eintrag „Offene Fragen an Noah" mit §4 unten.
2. **`WORKFLOW.md`** vollständig wahr machen: Kopf (Stand, Aufgabenzahlen **aus `tasks.yaml` gezählt**), §0 (Zweig bis zum PR-Merge, danach `main`), §1, §2 (Nächstes: Mehrspieler M37–M39 bzw. M17 auf Noahs Ansage, offene Fragen, M18-Vormerkungen), §3 (Plan-Wächter liest `03-TASKS.md`; Frische-Wächter nach Abstammung/`measuredAtCommit` für Turnier und Haltungs-Messlauf, Parameterlauf commit-basiert; Adjutant-Regeln D30.4), §4 (neue Fallen: siehe §5 unten), §5 (Tests, Abdeckung, **Abnahme 12/12**, AK-1 975, Fortschrittsachse, AK-8). Den Hinweis auf diese Übergabe oben in `WORKFLOW.md` danach **entfernen**, `CLAUDE.md`-Hinweis ebenso.
3. **`README.md`:** Status-Abschnitt.
4. **`index.html`** (Projektstand-Seite): `meilensteine` aus `tasks.yaml` gezählt (M35, M40, M41 fertig; M17 geplant 1/16), `offen`-Listen, `kennzahlen` (Tests, Abdeckung, AK-1), `roadmap.naechsteSchritte`/`roadmapData` wahr machen; Seite muss weiter laden.
5. **`PROGRESS.md`:** Abschlusszeile „Offene Punkte 2026-09-13".
6. Prüfen: `npx vitest run test/plan-consistency.test.ts test/docs.test.ts test/requirements.test.ts`, `pnpm coverage:requirements` (V1 offen: 0). `PROBLEME.md` hat **7 absichtliche CR-Bytes** — vor/nach jedem Bearbeiten mit Python zählen; das Edit-Werkzeug schluckt eins in Z. ~1926, dann per Skript aus HEAD wiederherstellen.
7. Commit `docs: Einstiegsdoku und Projektstand nach M41, M40 und M35`.

### 3.7 Abschluss
1. `pnpm verify` im sauberen Arbeitsbaum (Ausgabe in Datei, `$?`); `docs/reports/m5-balance.md` ggf. zurücksetzen.
2. Push auf den Zweig, **ohne `--force`** (PR #7 aktualisiert sich). Push danach prüfen:
   `git fetch origin && git rev-list --left-right --count origin/claude/offene-punkte-abschliessen...HEAD` muss `0	0` melden.
3. Vault: `C:\Users\noahh\Documents\Vaults\Claude\SESSION-STATE.md` (neuer oberster Block) und `99_Meta/Changelog.md`; Projektnotiz `01_Projects/` zu WorldWar.
4. **Artefakt für Noah (sein ausdrücklicher Wunsch): „was gemacht wurde".** Skill `artifact-design` laden, dann eine Seite: Überblick (Blöcke, Aufgaben, Commits), Befunde der Durchsichten und was daraus wurde, Messzahlen vorher/nachher (Siegtag 471 → 975, KI-Ablehnungen 1177 → 216, Artillerie 1 → 69 / Beschuss 10 → 303, Uhr 60 → 100 Ticks/s, KI-Gedächtnis 106 → 10 KB, Provinz-Tage Haltungen 79,7 % → 101,8 %, Grundlauf 44,4 % → 36,8 %, Abnahme 11/11 → 12/12, Abdeckung 95,9 → 96,3 %, Langlauf 13,293 → 8,263 ms je Tick), Zurückgenommenes mit Grund (T-M41-10, Verfolgung), Entscheidungen (delegiert/kippbar, Noahs M17-Entscheid), offene Fragen §4, Ergebnisse von Abnahme/AK-8/Sichtprüfung. **Nur Zahlen aus Berichten und git.**

## 4 · Offene Fragen an Noah (ins Artefakt und in `DECISIONS.md`)

1. **Verteidigungs-Automatik behalten?** Sie hält ihr Rücknahmekriterium (101,8 % Provinz-Tage, 0 ohne Gefecht verlorene Provinzen), bringt aber nach Block N2 keinen messbaren Nutzen (befohlene Deckung rechtzeitig 0 von 19 Gefechten) und pendelt einmal. Behalten, abschalten (Verteidigung = Garnison) oder ersetzen durch **ausdrückliche Aufträge** („halte Provinz X mit N Armeen, fülle nach", Sammelbefehl) bzw. Rückeroberung aus `startPositions`? Gemessen (D30.9): keine Nachbarschaftsautomatik hilft auf der Weltkarte — Gefechte 1–3 Ticks, Märsche 25–113.
2. **KI-Artillerie in der Voreinstellung tot:** 7 KI „normal", 200 Tage → 3 Artillerien, **0 selbsttätige Beschüsse**; Engstelle Fabrik + Geld. Eigener Balancing-Block (M18) oder so lassen?
3. **Zusammenlegen der KI** (T-M41-10 zurückgenommen: Deckel zählt Stapel statt Einheiten; echte Reparatur tötete Artillerie) → M18.
4. **Handel der KI** zielt auf den teuersten Bauwunsch → M18.
5. **Kippbare delegierte Entscheidungen** bestätigen: Marken 25 Provinzen / 400 ‰ / Bevölkerung 350 ‰ / 600 ‰; Vorgabehaltung `defensive`; nur Fabrikausbau (Kaserne reißt R-AI-06); Ankündigung statt Datenänderung; 5 Tage Ruhe ab Abmarsch; eigener Marsch → Garnison; Turnier-Wächter mit Code-Pfaden, Parameterlauf ohne.
6. **Der Langlauf entscheidet die Partie in 1000 Spieltagen nicht mehr** (`performance.md`: „nicht entschieden", vorher Tick 19320). AK-6 misst Zeit und ist bestanden; inhaltlich passt es zu AK-1 Tag 975 statt 471. Ist die längere Partie gewollt, oder gehört das in den Balancing-Block M18?
7. **M17** — später (entschieden); **Mehrspieler** und **iPhone-App** unverändert offen.

## 4a · Zwei kleine Befunde am Abnahmeskript (Produktivcode, unangetastet)

Beide gefunden beim Abnahmelauf, beide **keine** gefallenen Kriterien, beide bewusst nicht nebenbei
repariert. Wer 3.6 macht, entscheidet mit Noah, ob sie noch in diese Sitzung gehören:

- `scripts/acceptance.mjs` **Z. 303** schreibt für *jedes* spätere Kriterium den festen Text
  „Verpackung als Programm (T-M16-05)". Die **AK-9-Zeile trägt darum die Beschreibung von AK-8**,
  obwohl AK-9 die Zweispieler-Abnahme aus M39 ist → ein falscher Satz in `acceptance.md`.
- `scripts/acceptance.mjs` **Z. 334** rechnet `Math.round(totalSeconds / 60)` statt abzurunden:
  bei 298 s druckt die Konsole „5 min 58 s" statt 4 min 58 s. Die JSON-Zahl ist richtig.

## 5 · Fallen aus dieser Sitzung (für `WORKFLOW.md` §4)

- **Hintergrund-Agenten liefern lange Berichte abgeschnitten** → Bericht in Datei schreiben lassen; Plan-Agenten per SendMessage in Teilen.
- **Agenten beenden ihre Runde, während eigene Hintergrundläufe noch rechnen, und wachen nicht wieder auf** → lange Läufe im Vordergrund oder mit Warteschleife.
- **Sitzungslimit der API** stoppt parallele Agenten mitten in der Arbeit → nach Abbruch `git log`/`git status` lesen, halbfertigen Arbeitsbaum per `git diff` prüfen, dann fortsetzen.
- **`git worktree remove` scheitert an MAX_PATH** → Rest mit PowerShell `Remove-Item -LiteralPath '\\?\<pfad>' -Recurse -Force`, danach prüfen, dass der Ordner weg ist.
- **Tests laufen unter Fremdlast (Spiele) in 5-s-Zeitüberschreitungen** → betroffene Dateien einzeln fahren und Dauer belegen, verify wiederholen, keine Grenze anheben.
- **Ein Rücknahmekriterium muss die Änderung sehen können** (Turnier auf 40 Tagen sah den Fabrikausbau nicht).
- **Eine Automatik braucht Paritätstest über alle Zeitwege** (Uhr *und* Vorspulen) und eine **Schadenszählung**, nicht nur „0 Ablehnungen".
- **Frische nach Commit-Zeit ist nach Merges falsch; ein zeilengleicher Bericht lässt sich nicht neu committen** → Abstammung + `measuredAtCommit`.
- **Uhrzeiten/Daten in Übergaben nur aus `date`/git**, nie schätzen.
- **Das Edit-Werkzeug normalisiert CRLF** in `PROBLEME.md` (7 absichtliche CR-Bytes).
- **Eine gewachsene Prüfzahl ist kein Fehler** — die Abnahme meldet 12 statt 11 Kriterien, weil eine Prüfung dazukam. Erst zählen, was dazugekommen ist, bevor man eine Abweichung für einen Rückschritt hält.
- **Das Werkzeug der Sitzung bestimmt den Weg:** in einer Hintergrund-Sitzung gibt es kein `preview_start` und kein „Claude in Chrome" — Browserprüfungen laufen dann über CDP gegen ein echtes, sichtbares Chromium-Fenster. **Google Chrome ist auf dieser Maschine nicht installiert** (Brave und Edge sind es).

## 6 · Wo was steht

- Regeln/Fallen: `CLAUDE.md`, `docs/plan/WORKFLOW.md` §3–§4 · Entscheide: `docs/plan/DECISIONS.md` (Einträge 2026-09-13) · Befunde: `docs/plan/PROBLEME.md` · je Aufgabe: `docs/plan/PROGRESS.md`, `03-TASKS.md`, `tasks.yaml` · Entwürfe D29 (M17), D30 (Haltungen, bes. D30.4/D30.9), D31 (Zwischenziele) in `02-DESIGN.md`.
- AK-8-Steuerskript: `docs/plan/schlussblock/ak8-cdp.mjs`.
- Messberichte: `docs/reports/acceptance.md`, `acceptance-timing.json`, `performance.md`, `stance.json`, `balance-sweep.md`, `ai-tournament-run.md`, `fullgame*.json`, `ai-integration.json`, `progress-baseline.md`.
