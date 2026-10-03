# PLAN V3 — Uhr-Abschluss, Leistung (M45) und UX V3 (M46)

> **Für den Orchestrator — diese Datei ist der ganze Auftrag.** Du brauchst keinen weiteren Kontext.
> Geplant am 2026-10-03 auf `main` = `b63d667` (nach PR #15–#18), von einem Review-Agenten geprüft
> (6/10 → zwölf Befunde eingearbeitet).
>
> **Ablauf:** Schritt 0 (Uhr an der exe, schließt die Vorversion ab) → Phase 0 (messen, kein Spielcode) →
> Gate G1 (Noahs Entscheide) → Phase 1 (bauen, zwei Wellen) → Phase 2 (Abnahme, PR).
> **Kein Spiel-, KI- oder Kerncode vor G1.**

---

## A · Einstieg für den Orchestrator (in dieser Reihenfolge)

1. `git switch main && git pull --ff-only && git log --oneline -1 && git status --short` — Baum muss leer sein.
2. Lies **nur**: diese Datei; `docs/plan/WORKFLOW.md` §0 und die Fallen **1, 3, 7, 9, 17, 18, 20** aus §4.
   Plandateien (`01-REQUIREMENTS`, `02-DESIGN`, `03-TASKS`, `DECISIONS`, `PROBLEME`) nie am Stück, nur per grep.
3. **Rollen:** du = Orchestrator (plant nicht neu, startet Agenten, entscheidet nach Zahlen, merged Bahnen in den
   Versionszweig, spricht mit Noah). Bauen/Messen = Sonnet-Agenten (`Agent`-Werkzeug, `model: "sonnet"`).
   Höchstens 3 Agenten gleichzeitig.
4. **Ablage:** kurze Agentenberichte → dein Sitzungs-Scratchpad (`<SP>`, steht in deiner Umgebung).
   Messergebnisse, die bleiben → `docs/reports/v3/` (eingecheckt). Versionszweig: `claude/v3-leistung-ux` ab `main`.
5. **Noah wird nur gefragt bei:** (a) Rechnerfenster Schritt 0, (b) Rechnerfenster P0-W, (c) Gate G1,
   (d) Playtest, (e) Rechnerfenster Phase 2, (f) Merge nach `main`. Sonst nicht fragen, sondern nach diesem Plan
   handeln. Noah arbeitet auf Deutsch; er will vor großen Schritten Plan → Selbstkritik → sein Wort (das ist
   hier mit G1 abgedeckt).
6. **Agentenauftrag-Muster** (jeder Auftrag enthält diese Punkte wörtlich):
   - Arbeitsverzeichnis: `git worktree add .claude/worktrees/<kurz> -b claude/v3-<bahn> <basis>` (kurze Namen,
     Falle 20 MAX_PATH), danach `pnpm install --frozen-lockfile` im Worktree.
   - Pflichtlektüre: Abschnitt C dieser Datei + der eigene Abschnitt; Aufgabentexte nur per grep.
   - Ports der Bahn (Regel 7). Kein `pnpm acceptance`, keine Zeitmessung (Regel 5).
   - Bericht `<SP>/bericht-<bahn>.md`, ≤ 40 Zeilen (Regel 8); Antwort nur Pfad + drei Sätze.
   - Häufige WIP-Commits + Push; „Stop und melden“ an den genannten Haltepunkten.

---

## B · Ausgangslage (gemessen; Review-geprüft)

**Leistung**
| Kennzahl | Wert | Quelle / Vorbehalt |
|---|---|---|
| Langlauf, Zeit je Tick inkl. KI | **18,6 ms** auf `0cabf39`; 13,0 (`bf8af90`, Cloud-Rechner), 8,0 (`fd57eff`), 10,4 (`9a7678f`) | `performance.md` je Commit. **Vorbehalt:** alle Werte entstanden in `pnpm acceptance`, wo der Langlauf **parallel zur Vollpartie** läuft (`acceptance.mjs`), die Partien divergieren (Entscheidung Tick 10224/9456/11280), und der Mittelwert mischt Ticks **nach** der Entscheidung (~60 %) |
| Budget bei Tempo 100 | 10 ms je Tick (100 Ticks/s) | R-TIME-02 |
| Weltkarte, Tick ohne Spätspiel | Median 2,46 / p99 4,92 ms (Grenze 3,5 / 8) | `worldmap-bench.json` |
| KI-Anteil | 0,122 — **nur die ersten 480 Ticks** | `ai-bench.json` |
| Zeichnen | Kopf vom 2026-09-07 (Browser, `ee888b1`); Teile vom 2026-10-03 unter Node | `render-bench.json` — kein Browser-Zeichenskript vorhanden |
| Bündel | ein JS-Chunk **1,80 MB**, Assets 2,05 MB; Ladezeit nur am Dev-Server (Notiz in `ux-capture.mjs` fest „Dev-Server“) | `apps/desktop/dist` |
| Tempo 100 am Bündel | 0 Bilder > 50 ms — **nur neue Partie, 3 s** | T-M44-20 |
| Uhr an der exe | zuletzt 2026-09-26 (`7a6aa47`): Min 99,41 / Median 99,82 Ticks/s; seit M44 **nicht gemessen** | `packaging.md` |

**Hypothese H-P1 (unbelegt):** Die Tickzeit stieg durch die KI aus Etappe 2 (`consolidate.ts` +159, `economy.ts`
+85 zwischen `b8106df` und `0cabf39`: T-M42-15/-16/-17/-18) und wirkt im Spätspiel. Zu prüfen auf **einem**
Rechner, Langlauf **einzeln**, je 50-Tage-Fenster, nur bis zur Entscheidung.

**UX**
- M44 maß 34 Ansichten des **Spielanfangs**; Mittel- und Spätspiel (viele Armeen, Kriege, volles Protokoll,
  Spione, Handel) hat niemand aufgenommen.
- M44-Reste: axe „color-contrast incomplete“ (10 Knoten auf der Karte), Alarmchip im `--mp`-Lauf nie sichtbar,
  R-UX-03/AK1-4 und R-UX-06/AK4 ohne Browsersonde.
- Noahs Playtest (F6) wurde zweimal verschoben.

---

## C · Harte Regeln (wörtlich in jeden Agentenauftrag)

1. **Nichts löschen, bis Noah anderes sagt** (Regel seit 2026-10-02; Noah hat am 2026-10-03 die *Liste* freigegeben,
   nicht die Regel aufgehoben): Altcode auskommentieren mit `LOESCHVERMERK (Review): <Grund>`, Eintrag am Ende von
   `docs/plan/LOESCHVERMERKE.md`. Zurücknehmen = `git revert`.
2. Grenzen nie anheben, damit eine Zahl passt. Rücknahmekriterien gelten wörtlich.
3. **Leistungsänderungen sind verhaltensgleich.** Beleg (alle drei, billig):
   (a) **Spätspiel-Hash:** ab den Ständen S100/S300/S575 (Phase 0) je 720 Ticks **mit KI** fahren,
   `hashValue(state, { omitKeys: HASH_OMIT_KEYS })` vorher = nachher (Test `apps/headless/test/v3-verhalten.slow.test.ts`,
   je ~10–15 s);
   (b) Golden-Master `packages/core/test/golden/tiny-500.json` und `apps/headless/test/golden/walkthrough.json` unverändert;
   (c) Turnierbericht `docs/reports/ai-tournament-run.md` zeilengleich **ohne** die Zeile „Gemessen auf: <Commit>“.
   Ändert eine Optimierung das Verhalten, ist sie **verhaltensändernd** → nur mit Noahs Wort an G1 und mit voller
   Messkette (Turnier, `progress.slow`, neun Vollpartien, `ai-integration`, `m17-integration`, Haltung).
4. UX-Bahnen berühren `packages/core`, `packages/ai`, `data/rules`, `apps/desktop/src/game/newGame.ts` nicht
   (`git diff --stat <Basis> -- …` leer).
5. **Zeitmessungen nur im Rechnerfenster** (Noahs Wort; vorher Last < 10 %: `powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage"`).
   Bahnen messen lastunabhängig: **Aufrufzahlen, Allokationen, Anteile aus `--cpu-prof`**, keine Millisekunden als Beleg.
6. Nie `--force`, nie blankes `git stash`, **nie `git commit -a`** (Messwerkzeuge schreiben Berichte; nur benannte
   Dateien adden). LF. `PROBLEME.md` nur per Python (7 CR-Bytes vorher/nachher zählen, `PYTHONIOENCODING=utf-8`).
7. **Ports:** Orchestrator 5321/5322, Bahn A 5331/5332, Bahn B 5341/5342, Bahn C 5351/5352 — immer ausdrücklich
   `--url http://localhost:<p>/ --preview-port <p+1>` (Vorgabe 5322 gehört dem Orchestrator). CDP-Port als Parameter
   (Orchestrator 9222, Bahnen 9232/9242).
8. Tokens: Ausgaben in Dateien (`cmd > log 2>&1; echo $?`), nur Exit + Zusammenfassung lesen; nie `| tail` vor dem
   Exit-Code. Bericht ≤ 40 Zeilen: Tabelle Kennzahl | Ausgangswert | gemessen | hält?, Commits, offene Punkte.
9. WIP-Commits + Push auf den eigenen Zweig; nach Abbruch erst `git log/status/diff` lesen, dann fortsetzen.
10. Plandateien: Konflikte durch Vereinigung beider Seiten, danach `npx vitest run test/plan-consistency.test.ts` grün.
11. **Noahs echte Spielstände** in `%APPDATA%\de.noahhaumersen.worldwar\saves` werden vor jedem Lauf der exe geparkt
    (SHA-256 vorher, umbenennen, nachher zurück, SHA-256 gleich) — nie gelöscht, nie überschrieben.
12. Bilder: jedes eingecheckte PNG/SVG braucht einen Eintrag in `docs/ASSETS.md` (Wächter `no-foreign-assets`,
    Muster ASSETS.md ~185–194). Neue Bilder sparsam (Repo hat schon ~52 MB in `docs/ux`).

---

## Schritt 0 · Uhr bei Tempo 100 an der exe (Abschluss der Vorversion — ZUERST)

Offen seit PR #15/#16 („Uhr: nicht neu gemessen“ in `packaging.md`). **Braucht den Rechner allein.**
**Bekannt und erwartet:** bis zum Neubau in Schritt 3 ist `test/guards/packaging.test.ts` lokal rot
(„expected 6816768 to be 6827008“) — im Hauptordner liegt noch die exe vom 2026-09-26, `packaging-netfree.json` nennt
schon die aus PR #16. Kein Befund; nach dem Bau grün. `import-boundaries` kann unter Fremdlast an der Frist reißen
(einzeln grün) — nur einzeln nachprüfen.
→ Orchestrator fragt Noah nach einem Fenster (~30 min) und wartet. Vorbereitung 1–3 darf vorher laufen;
P0-A/B/C dürfen parallel starten (keine Zeitmessung), **aber im Fenster läuft nichts anderes** — Agenten pausieren
(keinen neuen Auftrag geben, laufende Simulationen abwarten).

Vorbereitung (Orchestrator selbst, ohne Last-Anspruch):
1. **Ausgangswert sichern, bevor irgendetwas baut:** `apps/desktop/src-tauri/target/release/worldwar.exe`
   (6 816 768 B, 2026-09-26, Quelle `7a6aa47`) nach `<SP>/worldwar-vorher.exe` **kopieren**; Größe + SHA-256 notieren.
   Ein Bau überschreibt sonst den Ausgangswert.
2. **Messskript** `docs/plan/schlussblock/uhr-cdp.mjs` schreiben (Muster `ak8-cdp.mjs`, eingecheckt — letztes Mal lag
   es nur im Scratchpad). Verfahren aus `packaging.md`, Abschnitt „Die Uhr bei Tempo 100 (Falle 18)“ unter „Geschichte“:
   - Parameter: Pfad der exe, CDP-Port (Vorgabe 9222), Anzahl Läufe.
   - **Abbruch, wenn `saves` nicht leer ist** (Regel 11; Autosave schreibt bei Tempo 100 ~4×/s, `saves.ts:281`).
   - exe mit `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<p>` starten, **sichtbares Fenster** (Falle 17).
   - Über CDP „Partie beginnen“ klicken (Knopf in `.dialog__foot`, `Dialogs.tsx:166`), Taste `+` **siebenmal**
     (`SPEED_STOPS` in `speed.ts`, Start 0, Taste `keyboard.ts:107`), 10 s Echtzeit.
   - Spielstunden der Kopfleiste und `performance.now()` **im selben `Runtime.evaluate`** → Ticks/s.
   - Jeder Lauf frisch gestartet, danach `taskkill //PID <n> //F`; Ergebnis JSON nach `docs/reports/v3/uhr-exe.json`.
3. **Neue exe bauen:** Hauptordner auf `main`, `git status --porcelain -- apps packages data` leer, `pnpm tauri:build`
   (Ausgabe in Datei; während des Baus keine Quelldatei ändern, Falle 7). Größe, Zeitstempel, Quelle notieren.

Im Fenster (Last < 10 %; Kiro, Blender, Spiele aus):
4. `saves` parken (Regel 11). **Alte exe 5 Läufe, dann neue exe 5 Läufe.** Ein erster Lauf der alten exe muss ~99,8
   ergeben (Gegenprobe des Skripts). `saves` zurück, SHA-256 vergleichen.
5. Bewertung (Falle 18): Minimum gegen Minimum, Median gegen Median, gegen den Ausgangswert **vom selben Tag**.
   Abstand kleiner als die Streuung des Ausgangswerts → Normalstreuung; sonst Befund in `PROBLEME.md`, kein Nachschärfen.
   Hinweis in den Bericht: Autosave läuft in beiden exe gleich mit.
6. Wenn P0-A schon fertig ist, **P0-W direkt anhängen** (ein Fenster statt zwei; Noah die Gesamtdauer vorher nennen).

Abschluss: in `docs/reports/packaging.md` den Kopf um „Uhr bei Tempo 100“ mit beiden Tabellen ergänzen (alter Abschnitt
bleibt unter „Geschichte“); `uhr-cdp.mjs`, `packaging.md`, `docs/reports/v3/uhr-exe.json` als benannte Dateien committen,
PR nach `main`, **Noahs Merge** (Frage f). Erst dann ist die Vorversion abgeschlossen.

---

## Phase 0 · Messen (kein Spiel-, KI- oder Kerncode)

Basis aller Phase-0-Zweige: `main`. Messwerkzeuge und Tests dürfen entstehen, Spielverhalten nicht.

### P0-A · Stände und Leistungswerkzeug (Bahn A, Worktree `p0a`, Ports 5331/5332, CDP 9232) — zuerst starten
1. **Stände zuerst** (dann Zwischenmeldung an den Orchestrator, damit P0-B starten kann): Weltkarte, Startzahl **1914**
   (entschieden an Tag 589, `fullgame.json`), Stände an Tag **100, 300, 575** (`S100/S300/S575`, 575 = 14 Tage vor der
   Entscheidung) über den Kern-`serialise` (Verfahren wie der Siegstand in `ux-capture.mjs`). Größe messen; je ≤ 1 MB,
   sonst als `.json.gz`. Ablage `test/fixtures/v3/`. Prüfen, ob ein Wächter Fixtures zählt; ggf. eintragen.
2. **Verhaltenstest** `apps/headless/test/v3-verhalten.slow.test.ts` (Regel 3a): je Stand 720 Ticks mit KI, Hash in
   `docs/reports/v3/verhalten-hash.json`; zweiter Lauf muss denselben Hash liefern (Determinismus-Gegenprobe).
3. **Profil** als `apps/headless/test/perf-profile.slow.test.ts` (Konfiguration `vitest.slow.config.ts`; **kein**
   Node-Skript — `packages/core` importiert ohne Dateiendung): je Stand N Ticks; Aufrufzahlen je KI-Funktion
   (`consolidate`, Teilen, `economy`, `military`) und Kernphase; Anteile per
   `--pool=forks --poolOptions.forks.execArgv=--cpu-prof` (Top-15-Funktionen, `.cpuprofile` auswerten). Hinweis:
   `planRoute` ist Kern (`core/phases/movement.ts`), nicht KI. Ergebnis `docs/reports/v3/profil-<stand>.json`.
4. **Langlauf-Zeitreihe:** `longrun.slow.test.ts` schreibt zusätzlich je 50-Tage-Fenster die Tickzeit und den
   Entscheidungstick (nur Bericht, keine Schranke) in `performance.md`.
5. **Bündel am Stand:** `ux-capture.mjs` um `--state <datei>` erweitern (Stand in IndexedDB `worldwar`/`saves` legen wie
   `ux-capture.mjs:849-853`, über „Spielstände > Laden“ öffnen), bei Tempo 100 **10 s** messen: Ticks/s aus der
   Kopfleiste + Bilder > 50 ms; die Ladezeit-Notiz unterscheidet Dev-Server und Bündel (Zeile ~501 korrigieren).
6. Bericht `bericht-p0a.md`. **Keine Millisekunden als Ergebnis** — die kommen in P0-W.

### P0-B1 · UX-Aufnahme Spätspiel, Bilder (Bahn B, Worktree `p0b`, Ports 5341/5342) — startet nach P0-A Schritt 1
1. `ux-capture.mjs --state` (aus P0-A.5; bis dahin auf P0-A warten, nicht selbst bauen) für S100/S300/S575:
   Karte mit vielen Armeen, Armeepanel, volles Protokoll, Kriegs-/Friedensdialog, Spionage, Handel, Bündnis,
   Speichern/Laden eines großen Standes — Bilder nur 375x667 und 1280x800, 1920x1080 nur Messwert.
2. M44-Reste messen: axe „color-contrast incomplete“ auf der Karte per Pixelprobe entscheiden; Alarmchip im `--mp`-Lauf;
   Browsersonden für R-UX-03/AK1-4 und R-UX-06/AK4.
3. Ablage `docs/ux/v3-before/` (+ `ASSETS.md`-Einträge, Regel 12). Bericht `bericht-p0b1.md`.

### P0-B2 · Aufgabenläufe (Bahn C, Worktree `p0c`, Ports 5351/5352) — startet nach P0-A Schritt 1
1. Playwright-Läufe (in `ux-capture.mjs` als Schlüssel `tasks` oder eigenes `scripts/ux-tasks.mjs`) für die acht
   häufigsten Handlungen auf S300: Armee finden und bewegen, Armee teilen/zusammenlegen, bauen, ausheben, Krieg erklären,
   Frieden anbieten, Handel anbieten, Spion anwerben. Je Lauf **Klicks, Tastendrücke, Fehlwege**, dazu Zeit als
   Nebenwert (nicht lastfest). Je Lauf Maus **und** Tastatur, wo möglich.
2. Ergebnis `docs/ux/v3-before/aufgaben.json`. Bericht `bericht-p0b2.md` mit den 10 schlimmsten Befunden aus B1+B2
   nach Schwere (Messwert, Bild/Lauf, Ansicht) — B1-Bericht dafür lesen.

### P0-C · Playtest-Bogen (Orchestrator oder kleiner Sonnet-Auftrag, kein Worktree)
Mit `pnpm playtest:sheet` (`scripts/playtest-sheet.mjs`) als Muster `docs/PLAYTEST-V3.md` erzeugen: 45–60 min,
Voreinstellung „normal“, bis mindestens Tag 150 (Vorspulen erlaubt), sieben Fragen (Spielfluss; wo hast du gesucht;
was hat genervt; Übersicht im Spätspiel; Ruckeln/Langsamkeit wann; Lesbarkeit der Karte; „wolltest du weiterspielen?“)
und „drei Dinge, die ich ändern würde“. Antwortdatei `docs/reports/playtest-v3.md` leer anlegen. Noah bekommt den Bogen
mit der Bitte um den Playtest (Frage d) — er kann parallel zu P0 laufen.

### P0-W · Rechnerfenster 1 (Noahs Wort, ~60 min; mit Schritt 0 bündeln, wenn möglich)
Vorbereitung ohne Last: Worktrees für die Messpunkte `95441e0` (Etappe 1), `b8106df` (Code von Stufe C2),
`0cabf39` (KI-Endstand, 18,6 ms) und `main` anlegen und installieren (`git worktree add --detach`). Der Langlauf
schreibt `performance.md` in seinen Worktree — Datei nach `docs/reports/v3/langlauf-<commit>.md` kopieren, Worktree
danach verwerfen.
Im Fenster, nacheinander, Maschine allein:
1. `pnpm sim:long` **einzeln** auf den vier Messpunkten (je ~8 min) → Zeitreihe je 50 Tage bis zur Entscheidung.
   Zeigt sich der Sprung zwischen `b8106df` und `0cabf39`, optional eingrenzen mit `7b14319` (T-M42-15/16/18) und
   `9f4b142` (T-M42-17).
2. `perf-profile.slow` auf S100/S300/S575 (main).
3. Bündel am Stand: `ux-capture --bundle --state` S300 und S575, Tempo 100, 10 s.
4. Zeichnen: `render.bench.slow` (Node) neu; Ladezeit am Bündel.
→ `docs/reports/v3/leistung-ausgang.md` mit allen Zahlen; einchecken (benannte Dateien) auf `claude/v3-leistung-ux`.

### Gate G1 · Noahs Entscheide (ein Dossier ≤ 2 Seiten, Frage c)
Vorlegen: Ausgangswerte P0-W (H-P1 bestätigt/widerlegt), Top-10 UX-Befunde, Noahs Playtest-Antworten (falls da).
Fragen, je mit Empfehlung:
1. **Zielwert:** Tickzeit ≤ 10 ms je Tick bis zur Entscheidung, Tempo 100 hält an S575 (≥ 98 Ticks/s am Bündel) — bestätigen?
2. **Verhaltensändernde Optimierungen** (z. B. KI denkt in ruhigen Provinzen seltener)? Empfehlung: erst nur
   verhaltensgleiche; verhaltensändernde nur, wenn das Ziel sonst nicht erreichbar ist, mit Rücknahme: Turnier-Zusicherungen
   + `progress.slow` + 9/9 Vollpartien halten.
3. **Simulation im Worker** (T-M10-02, zurückgenommen)? Empfehlung: nein in V3, eigener Plan nur falls Ziel verfehlt.
4. **UX-Auswahl** aus §Phase 1/Welle 2 + Playtest-Funde, mit Reihenfolge.
Danach: DECISIONS-Eintrag; gewählte Aufgaben als **T-M45-xx / T-M46-xx** in `tasks.yaml` (ohne Umlaute) und `03-TASKS.md`
(je Aufgabe: Ziel, Dateien, Tests zuerst, Fertig wenn, Rücknahme); neue Anforderungen `R-PERF-xx` / `R-UX-07ff` in
`01-REQUIREMENTS.md` nur dort, wo eine Zahl zugesagt wird; `plan-consistency` + `pnpm coverage:requirements` grün.

---

## Phase 1 · Bauen (Katalog; an G1 festgelegt)

**Welle 1 — Leistung** (drei Bahnen parallel, dateigetrennt). Je Kandidat **erst Anteil messen, dann ändern**
(Ausgangswert im Commit-Text), Beleg Regel 3.

| Aufgabe | Bahn | Kandidat | Dateien (Schwerpunkt) |
|---|---|---|---|
| T-M45-01 | **P-KI** | KI-Pässe (Zusammenlegen, Teilen, Sortierung) nur für Provinzen mit Änderung seit letztem Denkschritt; Sortierschlüssel einmal je Denkschritt | `packages/ai/src/consolidate.ts`, `economy.ts`, `military.ts` |
| T-M45-02 | **P-Kern** | Wegesuche: Zwischenspeicher für `planRoute`/Heimweg, Invalidierung bei Besitz-/Bündniswechsel | `packages/core/src/phases/movement.ts`, `rules/homePath.ts` |
| T-M45-03 | **P-Kern** | Kern-Hotspots laut Profil (Allokationen im Tick, Map/Set-Neubau, `publicView` nur bei Bedarf) | `packages/core/src/**` |
| T-M45-04 | **P-Hülle** | Zeitbudget je Frame für Ticks (Rückstand gedeckelt, R-TIME), Neuzeichnen nur bei geänderter Sicht, `React.memo`/Selektoren nur mit Profiler-Beleg | `apps/desktop/src/App.tsx`, `game/clock.ts`, Kartenmodul |
| T-M45-05 | **P-Hülle** | Bündel: `React.lazy` für Dialoge/Mehrspieler/Einstellungen, nur benötigte Schriftschnitte | `apps/desktop/src/ui/Dialogs.tsx`, `main.tsx`, Schriften |
| T-M45-06 | P-KI (bedingt, G1-2) | KI-Denktakt nach Lage | verhaltensändernd, volle Messkette |
| T-M45-07 | — (bedingt, G1-3) | Simulation im Worker | eigener Plan, nicht in V3 ohne Noahs Wort |

Merge in `claude/v3-leistung-ux`: **P-Kern → P-KI → P-Hülle** (P-KI mergt vorher den neuen Kern hinein und misst
erneut Regel 3). Nach Welle 1: `pnpm verify` (Datei, Exit-Code), Regel-3-Belege auf dem Zweig.

**Welle 2 — UX V3** (startet erst nach dem Merge von P-Hülle, weil sie `App.tsx`, Panels und Dialoge berührt;
zwei Bahnen parallel). **Nichts davon wird ohne Messbefund aus P0-B gebaut**; jede Aufgabe muss ihren Aufgabenlauf
verbessern (weniger Klicks/Fehlwege) und darf die Spätspiel-Uhr nicht verschlechtern.

| Aufgabe | Bahn | Kandidat | geprüft über |
|---|---|---|---|
| T-M46-01 | U-Panels | Heerübersicht: alle eigenen Armeen mit Ort, Stärke, Auftrag, Sprung zur Karte, Filter | Lauf „Armee finden/bewegen“ |
| T-M46-02 | U-Panels | Protokoll mit Filtern/Wichtigkeit, Sammelzeilen, Sprung zum Ort | volles Protokoll S300/S575 |
| T-M46-06 | U-Panels | Diplomatie-Übersicht (Krieg/Frieden/Bündnis, Räumfristen, offene Angebote) | Läufe Frieden/Handel |
| T-M46-03 | U-Karte | Kartenlesbarkeit im Spätspiel (Marker-/Beschriftungsverdichtung, Zoomstufen) | Bilder S575, Überdeckungszählung |
| T-M46-04 | U-Karte | Mehrfachauswahl, ein Befehl für mehrere Armeen (Tastatur + Touch) | Lauf „drei Armeen an die Front“ |
| T-M46-05 | U-Karte | Tastenkürzel für die acht Handlungen, in der Tastenhilfe sichtbar | Läufe per Tastatur |
| T-M46-07 | U-Karte | Ladezustand für große Stände/Vorspulen, `prefers-reduced-motion` | Laden S575 |
| T-M46-08 | U-Panels | M44-Reste (Kontrast entscheiden, Alarmchip im Mehrspieler, Browsersonden R-UX-03/06) | P0-B1 Punkt 2 |
| T-M46-09 | nach G1 | Funde aus Noahs Playtest | `playtest-v3.md` |

Merge: **U-Panels → U-Karte**. Danach `pnpm verify`.

---

## Phase 2 · Integration und Abnahme

1. Simulationen (parallel erlaubt, keine Zeitaussage): Regel-3-Belege, Turnier, `progress.slow`, neun Vollpartien,
   `ai-integration`, `m17-integration`, Haltung → bei nur verhaltensgleichen Änderungen **zeilengleich** zu `main`;
   Frische-Wächter (`node --input-type=module -e "const m=await import('./scripts/freshness.mjs');console.log(m.allFreshness('.'))"`) grün.
2. `ux-capture` nach `docs/ux/v3-after` (+ ASSETS), Aufgabenläufe nachher; Abgleich durch einen **frischen**
   Sonnet-Agenten (Urteil je Aufgabe erfüllt/teilweise/nicht, ≤ 40 Zeilen); Nachbesserung nur für „nicht erfüllt“.
3. **Rechnerfenster 2 (Noahs Wort, ~50 min, Frage e):** Langlauf einzeln, Bündel am Stand S300/S575, Uhr an einer
   neu gebauten exe (Schritt-0-Skript, Ausgangswert = exe aus Schritt 0), Zeichnen, Laden, zuletzt `pnpm acceptance` → 12/12.
   Danach `git status` lesen und nur benannte Berichte einchecken.
4. Präsentation (Sonnet, 8–12 Folien, Muster `docs/praesentation/sitzung-2026-10-03-abschluss.html`), PR
   `claude/v3-leistung-ux` → `main` mit Zahlen vorher/nachher, **Noahs Merge** (Frage f).
5. Nach dem Merge im selben Zug: `WORKFLOW.md` §0 auf `main` richten, `allFreshness` auf `main`, Worktrees räumen
   (robocopy-Weg, Falle 20; fremde Worktrees bleiben), Vault: `01_Projects/WorldWar/WorldWar — Handoff.md`,
   `SESSION-STATE.md`-Zeile, `99_Meta/Changelog.md`, `vault_check.py`; Fehler/Korrekturen → `99_Meta/Lessons Log.md`.

---

## D · Aufwand und Reihenfolge auf einen Blick

| Schritt | Wer | Rechner allein | grob |
|---|---|---|---|
| Schritt 0 | Orchestrator | **ja, ~30 min** (+ Bau ~5 min davor) | 1 h |
| P0-A → P0-B1, P0-B2, P0-C | 3 Bahnen + Orchestrator | nein | 4–6 Agentenstunden |
| P0-W | Orchestrator | **ja, ~60 min** (mit Schritt 0 bündelbar) | — |
| G1 + Playtest | Noah | — | 45–60 min Playtest |
| Welle 1 | 3 Bahnen | nein | 5–8 Agentenstunden |
| Welle 2 | 2 Bahnen | nein | 5–8 Agentenstunden |
| Phase 2 | 2–3 Agenten + Orchestrator | **ja, ~50 min** | 2–3 Agentenstunden |

## E · Risiken und Abfang

- **H-P1 falsch** (kein Sprung, nur Parallel-Last in `acceptance` oder Ticks nach der Entscheidung): P0-W misst einzeln
  auf vier Commits; ohne Sprung schrumpft Welle 1 auf Bündel/Hülle — kein Schaden, Ergebnis an G1.
- **Optimierung ändert unbemerkt Verhalten:** Regel 3a fängt das Spätspiel, 3b/3c den Rest → `git revert`, nicht anpassen.
- **UX-Maßnahme ohne Nutzen:** ohne besseren Aufgabenlauf kein `done`.
- **Noah spielt nicht:** G1 nur mit P0-B; T-M46-09 entfällt, im Bericht vermerkt.
- **Agentenabbruch/Sitzungslimit:** Regel 9; Berichte liegen in Dateien.
- **Uhr-Lauf zerstört Spielstände:** Regel 11 + Abbruch im Skript bei nicht leerem `saves`.
