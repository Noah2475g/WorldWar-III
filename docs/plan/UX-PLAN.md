# UX-PLAN — UX V2 (M44), Aufnahme vom 2026-10-03

> **Wozu diese Datei.** Sie hält fest, wie sich das Spiel heute bedient — gemessen, nicht
> geschätzt —, bewertet es und leitet daraus 20 priorisierte Maßnahmen in sechs Paketen ab. Die
> Maßnahmen stehen als **M44 „UX V2"** (T-M44-01…21, mit 02b, 03a/03b, 09a/09b) in `tasks.yaml` und
> `03-TASKS.md`, die Anforderungen als **R-UX-01…06** in `01-REQUIREMENTS.md` 2.20, der Entwurf als
> **D37** in `02-DESIGN.md` (bis zum Review „D36" — die Nummer gehört `ROHSTOFFE.md`).
>
> **Stand nach dem Review vom 2026-10-03:** alle 18 Punkte sind am Code nachgeprüft und eingearbeitet
> (§9 „Review-Einarbeitung"); drei Ursachen aus der ersten Fassung waren falsch und sind berichtigt
> (B-05c, B-06, B-09), die Zeiten sind am gebauten Bündel nachgemessen (B-18), fünf Fenstergrößen und
> sechs Befunde kamen dazu.
>
> **Grenze:** keine Maßnahme ändert `packages/core`, `packages/ai` oder `data/rules` — keine Regel,
> kein Balancing, keine KI. Auch diese Aufnahme hat nichts davon angefasst: das Spielende entstand
> aus einem echten Spielstand der Aufnahme, dessen Feld `victory.winner` gesetzt und mit dem
> `serialise` des Kerns neu versiegelt wurde.

## 0 · Kurzfassung

Ab 667×375 (Telefon quer) bis 1920×1080 ist das Spiel **vollständig bedienbar**: alle 34 Ansichten
erreichbar, axe-core findet am Start **0 Verstöße** gegen WCAG 2.1 AA, jeder Tab-Halt hat einen
sichtbaren Fokusrahmen, Zoomen und Schieben laufen ohne eine einzige lange Aufgabe, und am gebauten
Bündel läuft selbst Tempo 100 ohne lange Aufgabe. Die Schwächen liegen woanders:

1. **Telefon hochkant ist unbenutzbar.** Bei 375×667 und 320×568 ist die Karte **0 px breit**
   (`mapShareOfViewport` 0), die Kopfleiste frisst **240 px**, und nur **23 bzw. 22 von 34**
   Ansichten sind erreichbar — Ausheben, Armee, Marsch, Gefecht, Depesche fehlen.
2. **Die Kopfleiste bricht unter 1920 px um**, sobald am zweiten Tag das Siegziel und dann der
   Alarmchip erscheinen: **65 → 105–107 px** bei 1280×800 und 1366×768, 139–141 px bei 768×1024; der
   Kartenanteil fällt bei 1280 von **0,535 auf 0,462**. Daneben steht ein **leerer roter
   Alarmrahmen**, weil `.header__alarm { display: inline-flex }` das Attribut `hidden` schlägt.
3. **Die Hauptaktion des Startdialogs liegt unter dem Dialogrand** in 6 von 8 Größen (1280×800:
   Knopf bei y = 733, Dialog endet bei 720) — wer nicht im Dialog rollt, findet „Partie beginnen"
   nicht.
4. **Fehlermeldungen sprechen Kernsprache:** „Dieses Ziel ist für den Befehl nicht zulässig. (kein
   Angebot)" fünfmal im Diplomatiepanel, „a68 ist vernichtet." im Protokoll, „feindliches Gebiet"
   als falsche Ursache für „kein Weg", und ein beschädigter Spielstand meldet „stammt aus einer
   anderen Fassung".
5. **Folgenschweres geschieht ohne Rückfrage:** Krieg erklären, Spielstand überschreiben und
   Einstellungen zurücksetzen sind ein Klick; die Zielwahl bietet 237 Ziele alphabetisch an und sagt
   erst nach der Wahl „Dorthin führt kein Weg".

Die Maßnahmen: **8 × P1, 9 × P2, 3 × P3**, dazu das Messwerkzeug (T-M44-01, erledigt), sein
Prüfmodus mit Mehrspielerlauf (T-M44-02), die Nahtstellen in `App.tsx` (T-M44-02b) und die
Nachher-Aufnahme (T-M44-21). Geschätzter Aufwand rund 80 h (davon 10 h für das Blatt T-M44-03b).

## 1 · Methode und Messaufbau

| Was | Wie |
|---|---|
| Werkzeug | `scripts/ux-capture.mjs` (`pnpm ux:capture`; Playwright 1.56.1 als Entwicklungsabhängigkeit, Begründung `DECISIONS.md` 2026-10-03 — kein Teil von `pnpm verify`, D14 bleibt, vorinstalliertes Chromium aus `/opt/pw-browsers`, `@axe-core/playwright`) gegen `pnpm dev --port 5321 --strictPort` im Worktree |
| Ablauf | Start → Partie anlegen → Karte → Zoom/Schieben → Kartenmodi → Provinz → Erklärung → Bau → Tempo 100 → Ausheben → Armee → Zielwahl (gültig/ungültig) → Marsch → Diplomatie → Krieg → Gefecht → Depesche → Panels → Menü → Einstellungen → Speichern → beschädigter Stand → Sieg → Niederlage |
| Fenster | 375×667 (Telefon hochkant), 667×375 (Telefon quer, Rückfallprüfung), 1280×800, 1366×768 (häufigster Laptop, Prüfung „unverändert“), 1920×1080, 1024×768, 768×1024 (Tablet hochkant), 320×568 (WCAG 1.4.10); Finger-Modus `hasTouch`, wenn die kürzere Seite < 600 px; Gerätefaktor 1 |
| Ladezeit | am Dev-Server und **am gebauten Bündel** (`vite build` + `vite preview`, `--section bundle --perf-only`, WORKFLOW §4 Falle 18); Navigation Timing (`domInteractive`, `DOMContentLoaded`, `load`, erster Inhalt) und Wanduhr bis „Partie beginnen" im DOM steht |
| Ruckler | `PerformanceObserver('longtask')` und Bildabstände per `requestAnimationFrame` während Zoom (8 Mausradschritte), Schieben (20 Schritte) und 3 s Tempo 100 |
| Kontrast/Regeln | axe-core mit `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` in acht Zuständen (Start, Karte, Provinz, Armee, Diplomatie, Einstellungen, Spielstände, Ende) |
| Tastatur | 8–40 Tab-Schritte je Zustand: erreichtes Element, `:focus-visible`, Rahmen vorhanden, außerhalb des Bildes |
| Touch-Ziele | jedes sichtbare Bedienelement, gezählt unter 44 px (WCAG 2.5.5) und unter 24 px (2.5.8) |
| Fläche | Anteil der sichtbaren Karte, Höhen von Kopf/Fuß, waagerechter Überlauf von Seite, Kopf, Rohstoffleiste, Seitenleiste, Fuß, Dialog, Spielstandraster |
| Ergebnis | **268 Bilder** in `docs/ux/before/` (Nummer = Ansicht, gleich in allen Größen; `x-…-nicht-erreichbar` = was man an einer unerreichbaren Stelle sieht; verlustfrei mit oxipng verkleinert, 40 → 33 MB), Rohdaten `docs/ux/before/messwerte.json` (`viewports` am Dev-Server, `bundle` am Bündel) |

**Vorbehalte.** (a) Der Durchlauf läuft am **Dev-Server** (vite, unbündelt, 174 Ressourcen,
6,4 MB), weil der vorbereitete Spielstand den Kern über `/@fs` lädt; **Zeiten zählen nur am
Bündel** (621 KB, Abschnitt `bundle`). Die erste Fassung dieses Plans hatte die Ruckler am
Dev-Server gemessen und daraus B-18 gemacht — am Bündel ist er nicht zu sehen (§9 Punkt 12).
(b) Auf der Maschine (4 Kerne) lief **parallel eine KI-Simulation eines anderen Agenten**; alle
Zeiten sind eine Obergrenze. T-M44-20 misst auf ruhiger Maschine nach. (c) Die Partie ist nicht
deterministisch genug für Bildvergleiche Pixel für Pixel (Uhr läuft in Echtzeit); verglichen werden
Messwerte. (d) Das Spielende ist ein gesetzter `winner` ohne erfüllte Siegbedingung (Kopfleiste
„7 % von 70 %" neben „Sie haben gewonnen", B-22); T-M44-02 baut einen echten Siegstand. (e) Der
Mehrspieler-Bau (`WORLDWAR_MULTIPLAYER=1`) ist noch nicht aufgenommen; T-M44-02 ergänzt `--mp`.

**Wiederholen (Phase 6) — seit T-M44-02 in einem Befehl je Teil:**

```bash
# Prüfmodus: fährt, was die gewählten Kriterien brauchen, und meldet grün/ROT/offen je Kriterium (Exit 1 bei rot).
pnpm ux:check                                          # alle Kriterien R-UX-01…06; startet den Dev-Server selbst
node scripts/ux-capture.mjs --check --only R-UX-02     # nur ein Paket; --only kennt Teilketten wie 06/AK2
node scripts/ux-capture.mjs --check --from docs/ux/before/messwerte.json   # nur auswerten, kein Browser
# Bilder und Messwerte für docs/ux/after (1920x1080 nur als Messwert, Review Punkt 16):
node scripts/ux-capture.mjs --out docs/ux/after --viewports 375x667,667x375,1280x800,1366x768,1024x768,768x1024,320x568
node scripts/ux-capture.mjs --out docs/ux/after --merge --viewports 1920x1080 --measure-only 1920x1080
# Zeiten am gebauten Bündel (baut, startet vite preview auf 5322, beendet es wieder), Mehrspieler (Bau nach dist-mp, zwei Fenster):
node scripts/ux-capture.mjs --out docs/ux/after --merge --bundle --bundle-viewports 1280x800,1920x1080,375x667
node scripts/ux-capture.mjs --out docs/ux/after --merge --mp
```

<!-- LOESCHVERMERK (Review): Fassung von T-M44-01, ersetzt durch den Prüfmodus von T-M44-02 (T-M44-02 ändert `--viewports`-Vorgaben nicht, ergänzt `--check`, `--bundle`, `--mp`, `--measure-only`). Wortlaut:
**Wiederholen (Phase 6):**

```bash
pnpm dev --port 5321 --strictPort &          # im Worktree, eigener Port
node scripts/ux-capture.mjs --out docs/ux/after --viewports 375x667,667x375,1280x800,1366x768,1024x768,768x1024,320x568
node scripts/ux-capture.mjs --out docs/ux/after --merge --viewports 1920x1080 --no-shots   # 1920 nur als Messwert
pnpm desktop:build && (cd apps/desktop && npx vite preview --port 5322 --strictPort &)
node scripts/ux-capture.mjs --out docs/ux/after --merge --section bundle --perf-only --no-shots \
  --url http://localhost:5322/ --viewports 1280x800,1920x1080,375x667
```

-->

## 2 · Messwerte auf einen Blick

**Kerngrößen** (Dev-Server, Durchlauf und Layout):

| Messwert | 375×667 | 1280×800 | 1920×1080 |
|---|---|---|---|
| Ansichten erreicht (von 34) | **23** (9 Fehlschritte) | 34 | 34 |
| Hauptaktion Startdialog ohne Rollen sichtbar | nein | **nein** | ja |
| Kopf + Rohstoffleiste: Start → Tag 2 → mit Alarmchip | **240 px** | 65 → **105 → 107 px** | 65 → 65 → 67 px |
| Kartenanteil am Bild, Start → ab Tag 2 | **0,000** | 0,535 → **0,462** | 0,660 → 0,628 |
| Überlaufende Bereiche | Kopf 528>375, Rohstoffe 478>375, Dialog 604>518, Raster 592>494 | Dialog 604>518, Raster 592>494 | Dialog 604>518, Raster 592>494 |
| Zoom / Schieben: lange Aufgaben, Bild-p95 | 0 / 0, 16,7 ms | 0 / 0, 16,8 ms | 0 / 0, 16,8 ms |
| axe-Verstöße (Zustände mit Verstoß / geprüft) | 6 / 7 (`scrollable-region-focusable` `.resources`) | 3 / 8 (`color-contrast` `.alarm-chip` 4,27:1) | 3 / 8 (dito) |
| axe „unvollständig" color-contrast (Knoten, max.) | 64 | 61 | 55 |
| Tab-Halte ohne Fokusrahmen | 0 | 0 | 0 |
| Tab-Halte außerhalb des Bildes (Karte, 40 Schritte) | **8** | 0 | 0 |
| Endedialog: Tab verlässt den Dialog | **ja** | **ja** | **ja** |
| Bedienelemente < 44 px / < 24 px (Karte, sichtbar) | 4 / 4 von 32 | 41 / **30** von 43 | 41 / 30 von 43 |
| Marschziele in der Zielwahl | — | 237 (alle Provinzen) | 237 |
| Konsolenfehler | 1 (404 `favicon.ico`) | 0 | 0 |

**Weitere Größen** (nach dem Review aufgenommen):

| Messwert | 667×375 | 1366×768 | 1024×768 | 768×1024 | 320×568 |
|---|---|---|---|---|---|
| Ansichten erreicht (von 34) | 34 | 34 | 34 | 34 | **22** (10 Fehlschritte) |
| Hauptaktion Startdialog sichtbar | nein | nein | nein | ja | nein |
| Kopf + Rohstoffleiste: Start → Tag 2 → mit Alarmchip | 69 → 69 → 73 px | 65 → **83 → 107 px** | **105** → 101 → 103 px | 99 → **139 → 141 px** | **240 px** |
| Kartenanteil Start → Tag 2 | 0,432 → 0,432 | 0,542 → 0,486 | 0,439 → 0,409 | 0,394 → 0,354 | **0,000** |
| Überlaufende Bereiche (außer Dialog/Raster, die überall überlaufen) | Kopf 1182>667 (wischbar, gewollt), **Seitenleiste 288>252** | — | — | — | Kopf, Rohstoffe, **Fuß 370>320** |
| axe-Verstöße (Zustände) | 3 / 8 (Kontrast, `.resources`) | 3 / 8 | 3 / 8 | 3 / 8 | 6 / 7 |
| Ziele < 24 px (Karte) | 2 von 28 | 30 von 43 | 30 von 43 | 30 von 43 | 2 von 28 |
| Endedialog: Tab verlässt ihn | ja | ja | ja | ja | ja |

**Zeiten am gebauten Bündel** (`vite build` + `vite preview`, 621 KB übertragen; unter Last, §1 b)
gegen den Dev-Server:

| Messwert | Bündel 375×667 | Bündel 1280×800 | Bündel 1920×1080 | Dev 1280×800 | Dev 1920×1080 |
|---|---|---|---|---|---|
| Startdialog bedienbar nach | 0,29 s | 0,30 s | 0,34 s | 0,64 s | 0,66 s |
| „Partie beginnen" → Karte steht | 0,65 s | 0,66 s | 0,72 s | 0,70 s | 0,72 s |
| Zoom: lange Aufgaben | 0 | 0 | 0 | 0 | 0 |
| Tempo 100 (3 s): lange Aufgaben / längste / Bilder > 50 ms | nicht erreichbar | **0 / 0 / 1** | **0 / 0 / 1** | 4 / 107 ms / 10 | 7 / 114 ms / 16 |

## 3 · Befunde

Bildverweise ohne Größe meinen 1280×800 (`docs/ux/before/<nr>-<name>-1280x800.png`); `-375`
und `-1920` meinen die anderen Größen. Die Spalte „Heuristik" nennt Nielsens zehn Heuristiken
(H1 Sichtbarkeit des Systemstatus … H10 Hilfe) bzw. das WCAG-Kriterium.

| Nr | Befund | Beleg (Bild, Messwert) | Heuristik / Kriterium | Schwere |
|---|---|---|---|---|
| B-01 | **Telefon hochkant: keine Karte.** `.main` hat `grid-template-columns: 1fr 380px`; bei 375 px bleibt der Karte 0 px. Die Hochformat-Regeln in `touch.css` gelten nur für `max-height: 480px` (Telefon quer). Kopfleiste 240 px, Seitenleiste 259 px, Fuß 168 px. | 05/09-375, `x-…-375`; `mapShareOfViewport` 0; 9 Fehlschritte | H7 Flexibilität; Responsivität | kritisch |
| B-02 | **Kopfleiste bricht um** sobald das Siegziel erscheint; Spielstände/Menü rutschen in eine zweite Zeile. Daneben ein leerer roter Rahmen: `.header__alarm` hat `hidden`, aber `display: inline-flex` gewinnt (die Kaskadenfalle aus M36). | 06, 12, 14; 65 → 105–107 px; Karte 0,535 → 0,462 | H8 Ästhetik, H1 | hoch |
| B-03 | **„Partie beginnen" unter dem Dialogrand.** `.dialog` hat `max-height: 640px; overflow: auto`, die Aktionen stehen am Ende des rollenden Körpers. | 01, 02; Knopf y = 733, Dialog bis 720; bei 1920 sichtbar | H6 Erkennen, H1 | hoch |
| B-04 | **Spielstandraster läuft aus dem Dialog** — die vierte Spalte ist in allen Größen abgeschnitten; Plätze nennen nur „Stand 2 — Tag 24", keine Macht, keine Uhrzeit. | 03, 31, 32; `dialog 604>518`, `slots 592>494` | H8, H6 | hoch |
| B-05 | **Kernsprache in Spielertexten.** (a) `describeRejection` hängt `detail.reason` roh an: „… nicht zulässig. (kein Angebot)", „(bereits im Krieg)", „(nicht im Frieden)" — fünf Zeilen im Diplomatiepanel; „Hauptstadt verlegen" wird in der eigenen Hauptstadt angeboten. Die Kernbefehle führen **34 Freitext-Gründe** (`diplomacy.ts`, `army.ts`, `handlers.ts`, `move.ts`, `build.ts`, `bombard.ts`, `trade.ts`, `recruit.ts`). (b) `state.armies[id]?.name ?? id` nennt eine vernichtete Armee „a68" — vier Stellen in `App.tsx` (840, 1838, 1871, 1910). (c) `loadFrom` ordnet per `/Version/i` zu; die Regex trifft „fehlen Version oder Spielstand" **und** „Formatversion" — richtig ist allein `error.name === 'UnsupportedSaveVersion'` (dessen Text „Version 3 … Version 2" enthält). *(Berichtigt nach Review §9 Punkt 1: die erste Fassung schlug vor, nach „Formatversion" statt „Version" zu prüfen — das wäre falsch herum gewesen.)* (d) `errors.NO_PATH` sagt „feindliches Gebiet oder offenes Meer" — `planRoute` kennt nur den Kartengraphen, kein feindliches Gebiet. | 09, 20, 21, 22, 23, 32 | H9 Fehler erkennen, H2 Sprache | hoch |
| B-06 | **Kartentooltip bleibt stehen** und liegt über der Depesche; auf dem Telefon erscheint er als markierter Text über der Wirtschaftstabelle. **Ursache:** `tooltipId = hover?.id ?? ui.selectedProvince` (`App.tsx`, T-M31-01) — der Tooltip folgt absichtlich der Auswahl, damit die Tastatur ihn hat; nach einer **Mausauswahl** bleibt er deshalb stehen und rät „Klicken: auswählen" zu einer schon gewählten Provinz. *(Berichtigt nach Review §9 Punkt 3: die erste Fassung vermutete ein fehlendes `pointerleave`.)* | 24 (Tooltip über dem Dialog), 09-375 | H8; WCAG 1.4.13 | mittel |
| B-07 | **Krieg erklären ohne Rückfrage** (Quittung erst danach: „befohlen — wirkt beim Weiterlaufen"); Speichern überschreibt einen belegten Platz ohne Rückfrage. | 21; 31 | H5 Fehlervermeidung, H3 | hoch |
| B-08 | **Zielwahl ohne Vorauswahl:** 237 Ziele alphabetisch, von Afghanistan an; „Dorthin führt kein Weg" erst nach der Wahl. | 16, 17; `marchTargetOptions` 237 | H5, H6 | mittel |
| B-09 | **Endedialog hält den Fokus nicht:** `VictoryDialog` (`ui/Standings.tsx`) ist eine Kopie des Dialoggerüsts **mit** Abdunkeln (`.dialog-backdrop`, 45 % `ground`), aber ohne Fokus-Einzug, Fokusfalle und Escape; Tab erreicht „Menü", die Weltkarte und die Zoomknöpfe dahinter. Sieg und Niederlage tragen denselben Titel, die Siegbedingung fehlt. *(Berichtigt nach Review §9 Punkt 4: die erste Fassung behauptete „kein Abdunkeln".)* | 33, 34; `victoryFocusLeavesDialog` true in allen 8 Größen | WCAG 2.4.3; H1 | hoch |
| B-10 | **axe-Verstöße nach dem ersten Alarm:** Alarmchip `#e8583f` auf `#1e2632` = **4,27:1** bei 12 px (verlangt 4,5:1); bei 375 px ist die rollbare Rohstoffleiste ohne Tastaturzugang. | `axe.settings/saves/victory` (1280, 1920), `axe.*` (375) | WCAG 1.4.3, 2.1.1 | mittel |
| B-11 | **Kleine Ziele am Schreibtisch:** 30 von 43 Bedienelementen der Kartenansicht < 24 px — Tempoknöpfe 26×22, „?" 14×14, „Ausblenden" 15×18. Im Finger-Modus greifen die 44 px aus `touch.css` (nur „?" 22×22 bleibt), aber nur auf dem Teil, der sichtbar ist. | `touch.mapStart`, `touch.provincePanel` | WCAG 2.5.8 (2.2), 2.5.5 | mittel |
| B-12 | **Fokusrahmen in Feindrot:** `:focus-visible { outline: 2px solid var(--accent) }` — `accent` ist laut D27.1 „Feind, Kampf, Alarm — und nur das". Bei 375 liegen 8 der ersten 40 Tab-Halte außerhalb des Bildes. | 01 (Schließen-Kreuz rot umrandet); `keyboard.mapStart` | WCAG 2.4.7; Konsistenz | niedrig |
| B-13 | **Erklärung „?" bricht das Raster:** der Text erscheint in der Kachel und schiebt das Bauplatzraster auseinander; Escape schließt sie nicht. | 10 | H3 Kontrolle, H8 | mittel |
| B-14 | **Einführung spricht von „rechts"** („Rechts stehen Moral, Bevölkerung …"), auf dem Telefon liegt die Seitenleiste darunter; dort verdeckt die Einführung die Provinzwahl. | 04, 04-375 | H10 Hilfe, H2 | mittel |
| B-15 | **Protokollzeit bricht um** („22 ·" / „00:00"), sobald eine Zeile ein Symbol trägt; die Fuß-Rangliste zeigt die Plätze 3–6 oder 5–8, aber nie den Ersten. | 22–24, 27 | H8, H1 | niedrig |
| B-16 | **Seitenleiste ohne Ordnung:** die Wirtschaftstabelle steht unter jedem Panel; im Armeepanel ist der Kopf aus dem Bild gerollt, sobald man „Marschieren" sieht; zwei dauerhafte „Neu ab heute"-Meldungen belegen zwei Zeilen Panelhöhe; „Derzeit führt niemand Krieg." steht in Überschriftgröße. | 05, 14, 15, 20 | H8, H6 | mittel |
| B-17 | **Einstellungen ohne Einheiten** („Automatisch speichern alle 5" — Tage? Minuten?), Höchstgeschwindigkeit als freies Zahlenfeld; die Tastenkürzel-Hilfe ist nur per Taste erreichbar, das Menü kennt drei Einträge. | 29, 30 | H6, H10 | niedrig |
| B-18 | **Tempo 100 ruckelt — nur am Dev-Server.** Dort bei 1920×1080 7 lange Aufgaben in 3 s, längste 114 ms, 16 Bilder über 50 ms; **am gebauten Bündel 0 lange Aufgaben und 1 Bild über 50 ms**. *(Berichtigt nach Review §9 Punkt 12: die erste Fassung wertete den Dev-Server als „mittel"; am Bündel ist der Befund widerlegt, T-M44-20 wird bedingt.)* | `viewports.*.perf.running100`, `bundle.*.perf.running100` | gefühlte Leistung | niedrig |
| B-19 | **404 beim Start** — `index.html` nennt kein Icon, der Browser fragt `favicon.ico`. Einzige Konsolenmeldung. | `consoleErrors` 375 | Konsistenz | niedrig |
| B-20 | **Gleichlautende Gefechtszeilen:** „Südstaaten: Gefecht entschieden — niemand behauptet das Feld" steht viermal hintereinander im Protokoll. | 22, 23 | H8 | niedrig |
| B-21 | **„Auf Vorgabe zurücksetzen" ohne Rückfrage** — alle Einstellungen gehen mit einem Klick verloren. | 30 | H5 | mittel |
| B-22 | **Das aufgenommene Spielende ist kein echtes:** die Kopfleiste zeigt „7 % von 70 %", der Dialog „Sie haben gewonnen" — der Stand hat nur `winner` gesetzt. Für die Abnahme von R-UX-05/AK4 braucht es einen Stand, der die Bedingung erfüllt. | 33 | Messgüte | mittel |
| B-23 | **axe „unvollständig":** 55–64 Kontrastknoten je Zustand, die axe nicht entscheiden kann (Text über Karte, Verläufe, Balken) — ungeprüft. | `axe.*.incomplete` | WCAG 1.4.3 | mittel |
| B-24 | **Mehrspieler nicht aufgenommen:** Beitritt, Lobby, Kopfleiste mit fester Rate (`header.fixedSpeed`) und der gesperrte Vorhang (`.dialog-backdrop--locked`) fehlen in Aufnahme und erster Fassung des Plans. | — | Abdeckung | hoch |
| B-25 | **Weitere Größen:** bei 667×375 läuft die Seitenleiste waagerecht über (288>252), bei 320×568 der Fuß (370>320); bei 1024×768 ist die Kopfleiste schon am Start zweizeilig (105 px), bei 768×1024 ab Tag 2 139 px. | §2 Tabelle 2 | Responsivität | mittel |

**Was gut ist und bleiben soll.** Jeder Befehl quittiert sofort („✓ befohlen — wirkt beim
Weiterlaufen", Bild 11/21); jeder gesperrte Knopf nennt seinen Grund (Bild 09, 14); Ereignisse
im Protokoll springen auf die Karte; die Rohstoffleiste zeigt Bilanzrichtung und Reichweite; die
Tab-Reihenfolge folgt dem Bild (Kopf → Karte → Seite → Fuß), jeder Halt hat einen Rahmen; die
Startzahl-Erklärung „Dieselbe Startzahl ergibt dieselbe Partie" und der KI-Bonus-Hinweis sind
vorbildlich ehrlich.

## 4 · Bewertung nach Kriterien

| Kriterium | Urteil | Warum (Befunde) |
|---|---|---|
| Nielsen H1 Systemstatus | gut, mit Lücken | Uhr, Tempo, Siegziel, Quittungen da; Endedialog ohne Bedingung (B-09), Ranking ohne Spitze (B-15) |
| H2 Sprache der Nutzer | mittel | Spielertexte sonst sorgfältig; Rohwörter und Kennungen (B-05) |
| H3 Kontrolle und Freiheit | mittel | Escape schließt Dialoge, nicht die Erklärung (B-13); „Abbrechen" bei der Zielwahl vorhanden |
| H4 Konsistenz | mittel | Fokus in Feindrot (B-12), Aktionen im Dialog mal oben, mal unter dem Rand (B-03) |
| H5 Fehlervermeidung | schwach | Krieg, Überschreiben und Zurücksetzen ohne Rückfrage (B-07, B-21), Zielwahl ohne Vorauswahl (B-08) |
| H6 Erkennen statt Erinnern | mittel | Einheiten fehlen (B-17), Plätze ohne Kontext (B-04) |
| H7 Flexibilität | schwach | Hochformat-Telefon fehlt ganz (B-01); Tastenkürzel versteckt (B-17) |
| H8 Ästhetik, Minimalismus | mittel | Kriegsrat-Stil trägt; Umbruch der Kopfleiste (B-02), Rasterbruch (B-13), Sperrsatz-Wiederholung (B-16) |
| H9 Fehler erkennen und beheben | mittel | Sperrgründe überall — aber teils roh (B-05a), falsche Ursache beim Laden (B-05c) |
| H10 Hilfe | gut | „?" an jedem Ding, zehnstufige Einführung; Ortsangabe stimmt nicht überall (B-14) |
| Lesbarkeit/Hierarchie | gut am Schreibtisch | Kontraste halten (axe 0 am Start), klare Panelköpfe; Überschrift als Leerzustand (B-16) |
| Orientierung (Spielstand auf einen Blick) | gut | Siegziel-Balken, Rangliste, Rohstoffampel; kostet Kartenfläche durch Umbruch (B-02) |
| Rückmeldung, Fehlerprävention | gut / schwach | Quittungen gut; Prävention siehe H5 |
| Onboarding | gut | Einführung + Erklärungen; Startdialog erklärt Gegner/Schwierigkeit nicht (B-03 Umfeld) |
| WCAG 2.1 AA | fast | 0 Verstöße am Start; 1 Kontrastverstoß ab dem ersten Alarm, 1 Tastaturverstoß auf dem Telefon, Fokusfalle im Endedialog fehlt (B-09, B-10) |
| Responsivität | schwach | ab 667×375 bedienbar; Telefon hochkant und 320 px unbenutzbar (B-01), Spielstandraster läuft überall über (B-04), Kopfleiste unter 1920 px zweizeilig (B-02, B-25) |
| Konsistenz/visuelle Qualität | gut | einheitlicher Kriegsrat-Stil; Ausreißer B-02, B-12, B-13 |
| Gefühlte Leistung | gut | am Bündel Start 0,3 s, Partie 0,7 s, Zoom/Schieben/Tempo 100 glatt; nur der Dev-Server ruckelt (B-18) |

## 5 · Maßnahmen

Prioritäten: **P1** — behebt einen kritischen oder hohen Befund oder ist Voraussetzung;
**P2** — mittlere Befunde, spürbare Verbesserung; **P3** — Feinschliff. Jede Maßnahme ist eine
Aufgabe in `tasks.yaml`/`03-TASKS.md` mit gleicher ID; das Abnahmekriterium ist ein Messwert des
Werkzeugs oder ein Test. **Browser-Test** heißt: der Prüfmodus aus T-M44-02 gegen den Dev-Server
des Worktrees.


### 5.1 Übersicht

| ID | Prio | Paket | Maßnahme | Anforderung | Abhängig von | Aufwand |
|---|---|---|---|---|---|---|
| T-M44-01 | Basis | alle | UX-Aufnahme: Messwerkzeug und Vorher-Bilder | R-UX-01, R-UX-06 | — | erledigt |
| T-M44-02 | P1 | alle (Werkzeug) | Prüfmodus, Mehrspielerlauf und echter Siegstand im Messwerkzeug | R-UX-01, R-UX-06 | 01 | 5 h |
| T-M44-02b | P1 | alle (Vorbereitung) | Nahtstellen in App.tsx vorbereiten (keine Funktion) | R-UX-02, R-UX-03 | 01 | 1 h |
| T-M44-03a | P1 | Responsivität | Telefon hochkant: CSS-Stapel und Hinweis qür halten | R-UX-01, R-UX-05 | 02 | 8 h |
| T-M44-03b | P2 | Responsivität | Telefon hochkant: Seitenleiste als Blatt mit Rasten | R-UX-01 | 03a | 10 h |
| T-M44-04 | P1 | Spielfeld/HUD | Kopfleiste einzeilig mit Alarmchip und Siegziel, hidden gilt | R-UX-02 | 02 | 4 h |
| T-M44-05 | P1 | Navigation/Menüs | Dialoge: Hauptaktion in fester Fußzeile, Spielstandraster passt | R-UX-05, R-UX-01 | 02 | 3 h |
| T-M44-06 | P1 | Feedback/Hinweise | Spielersprache: Sperrgründe, Kennungen, beschädigter Stand, kein Weg | R-UX-03 | 02 | 5 h |
| T-M44-07 | P1 | Feedback/Hinweise | Kartentooltip: Auswahl-Tooltip nur per Tastatur, nie über Dialogen | R-UX-02 | 02 | 2 h |
| T-M44-08 | P1 | Barrierefreiheit | Endedialog und gesperrter Vorhang halten den Fokus, axe ohne Verstoß | R-UX-06 | 05 | 2,5 h |
| T-M44-09a | P1 | Feedback/Hinweise | Bestätigungsknopf und Rückfrage in Dialogen | R-UX-04 | 02 | 2,5 h |
| T-M44-09b | P1 | Feedback/Hinweise | Rückfrage bei Krieg und Bündnisbruch | R-UX-04 | 09a | 1,5 h |
| T-M44-10 | P2 | Spielfeld/HUD | Protokoll und Fuß: Zeit einzeilig, Gefechte zusammengefasst, Platz 1 zuerst | R-UX-02 | 02 | 3 h |
| T-M44-11 | P2 | Spielfeld/HUD | Zielwahl: erreichbare Ziele zuerst, gemessen und zwischengespeichert | R-UX-04 | 02 | 4 h |
| T-M44-12 | P2 | Spielfeld/HUD | Seitenleiste: Wirtschaft einklappbar, Panelkopf mit Zurück, Neu-Meldungen kompakt | R-UX-02 | 03a | 4 h |
| T-M44-13 | P2 | Onboarding | Erklärung als Popover mit Escape | R-UX-05 | 02 | 2 h |
| T-M44-14 | P2 | Onboarding | Einführung ortsunabhängig und nicht verdeckend | R-UX-05 | 02 | 3 h |
| T-M44-15 | P2 | Onboarding | Startdialog mit Kurzhilfe, Endedialog mit Siegbedingung | R-UX-05 | 08 | 3 h |
| T-M44-16 | P2 | Navigation/Menüs | Einstellungen mit Einheiten, Tastenkürzel im Menü | R-UX-05 | 02 | 2 h |
| T-M44-17 | P2 | Barrierefreiheit | Touch-Ziele, eigenes Fokus-Token, Kontrast-Stichprobe | R-UX-06 | 03a, 08 | 4 h |
| T-M44-18 | P3 | Feedback/Hinweise | Sperrgründe gebündelt, Leerzustände als Fließtext | R-UX-03 | 02 | 3 h |
| T-M44-19 | P3 | Navigation/Menüs | Favicon ohne 404 | R-UX-01 | 02 | 0,5 h |
| T-M44-20 | P3 | Spielfeld/HUD | (bedingt) Tempo 100 ohne Ruckler am Bündel | R-UX-02 | 02 | 0,5 h / 4 h |
| T-M44-21 | P1 | alle | Nachher-Aufnahme und Abnahme UX V2 | R-UX-01, R-UX-02, R-UX-03, R-UX-04, R-UX-05, R-UX-06 | 02b, 03a, 03b, 04, 05, 06, 07, 08, 09a, 09b, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 | 2 h |

**Zählung (ohne Werkzeug T-M44-01/02, Nahtstellen T-M44-02b und Abnahme T-M44-21):** P1: 8, P2: 9, P3: 3. Je Paket: Responsivität 2 (03a, 03b); Spielfeld/HUD 5 (04, 10, 11, 12, 20); Navigation/Menüs 3 (05, 16, 19); Feedback/Hinweise 5 (06, 07, 09a, 09b, 18); Barrierefreiheit 2 (08, 17); Onboarding 3 (13, 14, 15).

### 5.2 Maßnahmen im Einzelnen

#### Basis

**T-M44-01 · UX-Aufnahme: Messwerkzeug und Vorher-Bilder** — Paket alle, Befund —
- *Problem → Ziel:* Den Ist-Zustand in den Mess-Fenstergrößen messbar festhalten, damit jede spätere Maßnahme gegen eine Zahl abgenommen wird.
- *Lösung:* erledigt — siehe §1.
- *Dateien:* `scripts/ux-capture.mjs`, `docs/ux/before/messwerte.json`, `docs/plan/UX-PLAN.md`, `package.json`
- *Abnahme (messbar):* Erledigt am 2026-10-03: scripts/ux-capture.mjs (Playwright, vorinstalliertes Chromium, unter Windows Edge; @axe-core/playwright als devDependency, Lockfile nur um diese Einträge ergänzt) fährt 34 Ansichten in 375x667, 667x375, 1280x800, 1366x768, 1920x1080, 1024x768, 768x1024 und 320x568 und schreibt PNGs (verlustfrei optimiert) plus messwerte.json (Ladezeit, lange Aufgaben bei Zoom, Schieben und Tempo 100 am Dev-Server und am gebauten Bündel, axe WCAG 2.1 AA, Tab-Reihenfolge mit Fokusrahmen, Ziele unter 44/24 px, Flächenanteile, waagerechter Überlauf). Spielende über einen echten Spielstand der Aufnahme, dessen victory.winner gesetzt und mit serialise des Kerns neu versiegelt wird - keine Spiellogik geändert; der Stand erfüllt die Siegbedingung nicht wirklich (Befund B-22, behoben in T-M44-02). Befunde, Maßnahmen und Review-Einarbeitung in docs/plan/UX-PLAN.md.
- *Tests:* kein Komponententest (Werkzeug); Browserlauf `node scripts/ux-capture.mjs --out docs/ux/before` gegen `pnpm dev --port 5321`, Zeiten zusätzlich `--section bundle --perf-only` gegen `vite preview`.
- *Abhängigkeiten:* — · *Aufwand:* erledigt

#### P1

**T-M44-02 · Prüfmodus, Mehrspielerlauf und echter Siegstand im Messwerkzeug** — Paket alle (Werkzeug), Befund B-22, B-24, alle
- *Problem → Ziel:* Jede M44-Aufgabe hat eine Browser-Prüfung, die ihr Abnahmekriterium als Exit-Code meldet; der Mehrspieler-Bau und ein echtes Spielende sind Teil der Aufnahme.
- *Lösung:* Prüfmodus `--check` mit Schwellen aus einer reinen Funktion (`scripts/ux-thresholds.mjs`); Lauf `--mp` im Mehrspieler-Bau; ein vorbereiteter Stand, der die Siegbedingung wirklich erfüllt; Nachher-Bilder nur für 375×667, 1280×800 und die neuen Größen.
- *Dateien:* `scripts/ux-capture.mjs`, `scripts/ux-thresholds.mjs`, `test/ux-thresholds.test.ts`, `package.json`, `docs/ASSETS.md`
- *Abnahme (messbar):* node scripts/ux-capture.mjs --check [--only <Kriterium>] liest die Schwellen aus scripts/ux-thresholds.mjs, gibt je Kriterium grün/rot mit Messwert aus und endet mit Exit 1 bei einem roten; pnpm ux:check (nicht in verify: braucht Server und Browser, D14). --mp: Bau mit WORLDWAR_MULTIPLAYER=1, Gastgeber legt an, Gast tritt per Link bei, Bedingungen, Kopfleiste mit fester Rate, gesperrter Vorhang - in 375x667 und 1280x800. Der Siegstand erfüllt die Siegbedingung wirklich (Punkteanteil >= pointsShareToWin durch Besitz, im vorbereiteten Stand, Kern unverändert), Niederlage ebenso. Bilder für docs/ux/after nur 375x667, 1280x800 und die neuen Größen; 1920x1080 nur als Messwert (Repo-Größe, Review Punkt 16). Aufwand 5 h.
- *Tests:* `test/ux-thresholds.test.ts` - describe(R-UX-01/AK1 ...) usw.: die Schwellen aus R-UX-01..06 als reine Funktion über ein messwerte.json; der Vorher-Stand fällt an genau den im UX-PLAN genannten Stellen, ein erfundener Sollstand ist grün.
- *Abhängigkeiten:* T-M44-01 · *Aufwand:* 5 h

**T-M44-02b · Nahtstellen in App.tsx vorbereiten (keine Funktion)** — Paket alle (Vorbereitung), Befund — (Vorbereitung)
- *Problem → Ziel:* Die vier Bahnen von Welle 1 schreiben nicht gleichzeitig in dieselben Zeilen von App.tsx.
- *Lösung:* Vier Nahtstellen in `App.tsx` herausziehen (Namensauflösung, Hover/Tooltip-Hook, Seitenleisten-Hülle, Menüliste), verhaltensgleich.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/game/names.ts`, `apps/desktop/src/game/names.test.ts`
- *Abnahme (messbar):* Reines Umziehen ohne Verhaltensänderung: Namensauflösung nach game/names.ts, Hover/Tooltip-Zustand in einen eigenen Hook, Seitenleisten-Hülle als Komponente, Menüeinträge als Liste. Wellenplan UX-PLAN Paragraf 6, Welle 0,5. Wächter ui-reachability grün. Aufwand 1 h.
- *Tests:* `apps/desktop/src/game/names.test.ts` (neu) - Namensauflösung verhaltensgleich zu heute (Gegenprobe); `apps/desktop/src/App.test.tsx` unverändert grün.
- *Abhängigkeiten:* T-M44-01 · *Aufwand:* 1 h

**T-M44-03a · Telefon hochkant: CSS-Stapel und Hinweis qür halten** — Paket Responsivität, Befund B-01, B-25
- *Problem → Ziel:* Bei 375x667 ist die Karte sichtbar und jede Kernhandlung erreichbar (vorher Kartenanteil 0, Seitenleiste und Fuß füllen das Bild).
- *Lösung:* Medienabfrage `(max-width: 599px) and (orientation: portrait)`: Kopfleiste einzeilig wischbar, Karte oben, Seitenleiste darunter rollend, kompakter Fuß; nicht blockierender Hinweis „quer halten empfohlen" (D37.2).
- *Dateien:* `apps/desktop/src/ui/touch.css`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/portrait.touch.test.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-01/AK1 (ohne Panel >= 0,45, mit offenem Panel >= 0,30), AK2, AK3 bei 375x667 und 320x568; 667x375 und 1366x768 nicht schlechter als vorher. Kopfleiste einzeilig wischbar, Karte oben, Seitenleiste darunter rollend, kompakter Fuß; nicht blockierender Hinweis qür halten empfohlen (0,5 h, R-UX-05/AK2, Orchestrator-Entscheid F1). Sichtprüfung am laufenden Spiel (Kaskade). Aufwand 8 h.
- *Tests:* `apps/desktop/src/ui/portrait.touch.test.tsx` (neu) - describe(R-UX-01/AK1 ...): die Regel hängt an (max-width: 599px) and (orientation: portrait), nicht an data-input und nicht nur an max-height 480; Kopfleiste nowrap; Hinweis qür halten ist nicht modal; `apps/desktop/src/ui/cascade.touch.test.tsx` grün; Wächter touch-entry, css-mirrors-tokens, no-color-literals, prose-in-code; Browser: `pnpm ux:check --only R-UX-01`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 8 h

**T-M44-04 · Kopfleiste einzeilig mit Alarmchip und Siegziel, hidden gilt** — Paket Spielfeld/HUD, Befund B-02, B-25
- *Problem → Ziel:* Die Kopfleiste bleibt ab 1280 px einzeilig, auch mit Siegziel und Alarmchip; kein leerer Alarmrahmen.
- *Lösung:* Erst alle `hidden`-Stellen mit eigenem `display` suchen, dann `[hidden] { display: none !important }`; Siegziel in die Uhrzeile; Kompaktregeln (Titel < 1500 px aus, Tempo als Gruppe, Modi < 1400 px als Auswahl); gemessen mit Alarmchip und mit `fixedSpeed` (D37.3).
- *Dateien:* `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/touch.css`
- *Abnahme (messbar):* R-UX-02/AK1 (<= 70 px im Zustand mit Alarmchip und Siegziel, 1280x800 und 1366x768, auch Mehrspieler mit fester Rate; vorher 105-107 px), AK2. Kompaktregeln: Titel unter 1500 px aus, Tempoknöpfe als Gruppe, Kartenmodi unter 1400 px als Auswahl. Kaskade am laufenden Spiel geprüft (Falle aus M36). Aufwand 4 h.
- *Tests:* `apps/desktop/src/ui/cascade.touch.test.tsx` - describe(R-UX-02/AK2 ...): `[hidden]` gewinnt gegen `.header__alarm { display: inline-flex }` (heute rot); vorher alle Stellen gesucht, an denen hidden auf eine Klasse mit eigenem display trifft (app.css, touch.css); `apps/desktop/src/ui/Header.test.tsx` - describe(R-UX-02/AK1 ...): Siegziel in der Uhrzeile, Kompaktregeln, auch mit fixedSpeed; Wächter css-mirrors-tokens, no-color-literals; Browser: `pnpm ux:check --only R-UX-02` in 1280x800 und 1366x768 sowie `--mp`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 4 h

**T-M44-05 · Dialoge: Hauptaktion in fester Fußzeile, Spielstandraster passt** — Paket Navigation/Menüs, Befund B-03, B-04
- *Problem → Ziel:* "Partie beginnen" ist ohne Rollen sichtbar; das Spielstandraster läuft nicht aus dem Dialog; Beitritt und Lobby folgen demselben Gerüst.
- *Lösung:* Dialog-Gerüst mit fester Fußzeile `.dialog__foot` für Aktionen, Körper rollt — auch Beitritt/Lobby; Spielstände als Liste (eine Zeile je Platz, mit Macht und Spieltag).
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/touch.css`
- *Abnahme (messbar):* R-UX-05/AK1 in allen Mess-Fenstergrößen (vorher: Knopf bei y=733 unter dem Dialogrand 720 bei 1280x800); R-UX-01/AK2 für .dialog und .slots (vorher 604>518 und 592>494). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Dialogs.test.tsx` - describe(R-UX-05/AK1 ...): Aktionen stehen in `.dialog__foot` außerhalb des rollenden Körpers, auch in JoinDialog und LobbyDialog; Spielstände eine Zeile je Platz; Browser: `pnpm ux:check --only R-UX-05/AK1` und `R-UX-01/AK2`, dazu `--mp`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-06 · Spielersprache: Sperrgründe, Kennungen, beschädigter Stand, kein Weg** — Paket Feedback/Hinweise, Befund B-05
- *Problem → Ziel:* Kein Rohwort des Kerns ("kein Angebot", "bereits im Krieg"), keine Kennung ("a68"), keine falsche Ursache ("andere Fassung", "feindliches Gebiet") in Spielertexten.
- *Lösung:* Sätze je (Befehlstyp, Grund) für die 34 Kerngründe; `loadFrom` nach `error.name === 'UnsupportedSaveVersion'`; Namensspeicher `game/names.ts` (nach dem Laden leer: „eine Armee"); Hauptstadt verlegen in der eigenen Hauptstadt nicht anbieten; `errors.NO_PATH` ohne „feindliches Gebiet" (D37.4).
- *Dateien:* `apps/desktop/src/game/rejections.ts`, `apps/desktop/src/game/rejections.test.ts`, `apps/desktop/src/game/saves.ts`, `apps/desktop/src/game/names.ts`, `apps/desktop/src/game/actions.ts`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-03/AK1-AK4. loadFrom entscheidet nach error.name === UnsupportedSaveVersion, sonst corrupt (die Regex /Version/ trifft auch Formatversion). Namensspeicher in game/names.ts für die vier Armee-Stellen (App.tsx 840, 1838, 1871, 1910; 773 ist die Provinz), nach dem Laden bewusst leer: unbekannt heisst eine Armee. Hauptstadt verlegen in der eigenen Hauptstadt nicht anbieten. errors.NO_PATH ohne feindliches Gebiet (planRoute kennt nur den Kartengraphen). Kern unverändert. Aufwand 5 h.
- *Tests:* `apps/desktop/src/game/rejections.test.ts` (neu) - describe(R-UX-03/AK1 ...): liest die 34 Freitext-Gründe aus packages/core/src/commands (nur lesend) und verlangt je (Befehlstyp, Grund) einen Schlüssel, kein Satz mit Klammer-Rohwort; `apps/desktop/src/game/saves.test.ts` - describe(R-UX-03/AK3 ...): alle fünf Meldungen aus save.ts und UnsupportedSaveVersion aus migrate.ts, nur letztere ergibt wrongVersion (heute ergibt "fehlen Version oder Spielstand" wrongVersion); `apps/desktop/src/i18n/text.test.ts` - Umlaut-Wächter; Wächter text-keys, prose-in-code.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 5 h

**T-M44-07 · Kartentooltip: Auswahl-Tooltip nur per Tastatur, nie über Dialogen** — Paket Feedback/Hinweise, Befund B-06
- *Problem → Ziel:* Der Tooltip "Mittlerer Westen / Moral / Armeen" liegt nicht über der Depesche und bleibt nicht stehen, wenn der Zeiger weg ist.
- *Lösung:* Auswahl-Tooltip nur nach Tastaturauswahl; nie bei offenem Dialog; `user-select: none`; kein „Klicken: auswählen" bei gewählter Provinz.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Tooltip.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-02/AK3. Ursache: tooltipId = hover?.id ?? ui.selectedProvince (App.tsx, T-M31-01, absichtlich für die Tastatur) - die Auswahl hält den Tooltip auch nach Mausauswahl. Aufwand 2 h.
- *Tests:* `apps/desktop/src/App.test.tsx` - describe(R-UX-02/AK3 ...): Provinz per Maus gewählt, Zeiger weg -> kein Tooltip; per Tastatur gewählt -> Tooltip ohne "Klicken: auswählen"; Dialog offen -> kein Tooltip; `apps/desktop/src/ui/Tooltip.test.tsx` - user-select none.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 2 h

**T-M44-08 · Endedialog und gesperrter Vorhang halten den Fokus, axe ohne Verstoß** — Paket Barrierefreiheit, Befund B-09, B-10
- *Problem → Ziel:* Tab verlässt den Endedialog nicht mehr, Escape wirkt; axe meldet keinen Verstoß (vorher Alarmchip 4,27:1 bei 12 px, rollbare Rohstoffleiste ohne Tastaturzugang bei 375 px).
- *Lösung:* `VictoryDialog` (`ui/Standings.tsx`) über `Dialog` aus `Dialogs.tsx` mit optionalem `onClose` (Fokus-Einzug, Falle, Escape); ebenso Vorhang und Beitritt/Lobby prüfen; Alarmchip-Schrift auf ein Paar ≥ 4,5:1; Rohstoffleiste `tabindex=0` mit Namen, wenn sie rollt. Escape in `Dialog` geht nur eine Stufe zurück: der Escape-Zweig in `onKeyDown` ruft `event.stopPropagation()` (Befund vom 2026-10-03 aus T-M44-02: der Dialog schloss sich selbst, React band den Fenster-Hörer mit `dialog = null` neu, und dieselbe Taste schloss danach auch das Provinzpanel).
- *Dateien:* `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/tokens.ts`
- *Abnahme (messbar):* R-UX-06/AK1, AK2. Das Abdunkeln existiert schon (.dialog-backdrop, app.css), es fehlen Fokus-Einzug, Fokusfalle und Escape. Rohstoffleiste tabindex=0 mit Namen, wenn sie rollt. Ein Escape im Dialog schließt nur den Dialog, nicht das Panel dahinter. Aufwand 2,5 h.
- *Tests:* `apps/desktop/src/ui/a11y.test.tsx` - describe(R-UX-06/AK2 ...): VictoryDialog (ui/Standings.tsx) nutzt Dialog aus Dialogs.tsx mit optionalem onClose: Fokus-Einzug, Fokusfalle, Escape (heute rot); ebenso der Vorhang .dialog-backdrop--locked und Join/Lobby; `apps/desktop/src/ui/Standings.test.tsx`; `apps/desktop/src/ui/tokens.contrast.test.ts` - describe(R-UX-06/AK1 ...): Alarmchip-Schrift auf paperSunk >= 4,5:1; Browser: keyboard.victory ohne Ziel außerhalb, axe 0 Verstöße; Browser: Provinz wählen, „Menü“, ein Escape: Dialog zu, Provinzpanel bleibt offen (jsdom stellt den Doppelschritt nicht nach — Testing Library rendert erst nach dem Ereignis).
- *Abhängigkeiten:* T-M44-05 · *Aufwand:* 2,5 h

**T-M44-09a · Bestätigungsknopf und Rückfrage in Dialogen** — Paket Feedback/Hinweise, Befund B-07, B-21
- *Problem → Ziel:* Belegten Stand überschreiben, Einstellungen zurücksetzen und neue Partie aus laufender Partie brauchen einen zweiten Klick am selben Knopf.
- *Lösung:* `ConfirmButton`: erster Klick zeigt die Folge im Knopf und über `aria-live`, zweiter sendet; Escape/Fokusverlust brechen ab; kein Timer. Eingesetzt für Überschreiben, Zurücksetzen, neue Partie.
- *Dateien:* `apps/desktop/src/ui/ConfirmButton.tsx`, `apps/desktop/src/ui/ConfirmButton.test.tsx`, `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-04/AK1 für die Dialog-Fälle (Orchestrator-Entscheid F2: kein Dialog, keine Zeitüberschreitung). Aufwand 2,5 h.
- *Tests:* `apps/desktop/src/ui/ConfirmButton.test.tsx` (neu) - describe(R-UX-04/AK1 ...): erster Klick zeigt den Folgesatz im Knopf und in einer aria-live-Region, zweiter sendet, Escape und Fokusverlust brechen ab, kein Timer (Wächter no-time-pressure); `apps/desktop/src/ui/Dialogs.test.tsx` - Überschreiben und Zurücksetzen fragen nach; Wächter ui-reachability (ConfirmButton.tsx von main.tsx erreichbar), prose-in-code.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 2,5 h

**T-M44-09b · Rückfrage bei Krieg und Bündnisbruch** — Paket Feedback/Hinweise, Befund B-07
- *Problem → Ziel:* Krieg erklären und Bündnis aufkündigen brauchen einen zweiten Klick am selben Knopf.
- *Lösung:* `ConfirmButton` an „Krieg erklären" und „Bündnis aufkündigen" („Krieg mit Mexiko — Verträge enden, Ruf sinkt").
- *Dateien:* `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-04/AK1 für die Diplomatie. Befehle selbst unverändert (dieselben Kommandos an den Kern). Aufwand 1,5 h.
- *Tests:* `apps/desktop/src/ui/Panels.test.tsx` - describe(R-UX-04/AK1 ...): Krieg erklären sendet erst nach dem zweiten Klick (heute rot), der Folgesatz nennt die Macht.
- *Abhängigkeiten:* T-M44-09a · *Aufwand:* 1,5 h

**T-M44-21 · Nachher-Aufnahme und Abnahme UX V2** — Paket alle, Befund alle
- *Problem → Ziel:* Dieselben Messwerte nach dem Umbau, Vorher/Nachher-Tabelle im UX-PLAN.
- *Lösung:* Dieselbe Aufnahme nach `docs/ux/after` (Dev-Server, Bündel, `--mp`), Tabelle §7 füllen, `pnpm ux:check` grün.
- *Dateien:* `docs/ux/after/messwerte.json`, `docs/plan/UX-PLAN.md`, `docs/plan/PROGRESS.md`, `docs/ASSETS.md`
- *Abnahme (messbar):* Alle R-UX-Kriterien grün in allen Mess-Fenstergrößen; Tabelle vorher/nachher im UX-PLAN Paragraf 7; Zeiten am Bündel wie vorher (gleicher Bündeltyp); Bilder nur 375x667, 1280x800 und die neuen Größen, verlustfrei optimiert, in docs/ASSETS.md (R-ASSET-01); pnpm verify Exit 0; Golden-Master unverändert; packages/core, packages/ai, data/rules ohne Diff gegen den Stand vor M44; coverage:requirements meldet M44: 6 von 6. Aufwand 2 h.
- *Tests:* Browser: `node scripts/ux-capture.mjs --out docs/ux/after` (Dev-Server), `--section bundle --perf-only` (Bündel) und `--mp`; `pnpm ux:check` - alle Kriterien grün.
- *Abhängigkeiten:* T-M44-02b, T-M44-03a, T-M44-03b, T-M44-04, T-M44-05, T-M44-06, T-M44-07, T-M44-08, T-M44-09a, T-M44-09b, T-M44-10, T-M44-11, T-M44-12, T-M44-13, T-M44-14, T-M44-15, T-M44-16, T-M44-17, T-M44-18, T-M44-19, T-M44-20 · *Aufwand:* 2 h

#### P2

**T-M44-03b · Telefon hochkant: Seitenleiste als Blatt mit Rasten** — Paket Responsivität, Befund B-01
- *Problem → Ziel:* Auf dem Telefon liegt die Seitenleiste als Blatt über der Karte; die gewählte Provinz bleibt im sichtbaren Kartenteil.
- *Lösung:* Seitenleiste als Blatt mit drei Rasten, Auto-Schwenk zur gewählten Provinz, Gesten gegen `MapCanvas` (PR #9–#11) geprüft.
- *Dateien:* `apps/desktop/src/ui/Sheet.tsx`, `apps/desktop/src/ui/Sheet.test.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/touch.css`, `apps/desktop/src/map/MapCanvas.tsx`
- *Abnahme (messbar):* Optional im Plan, wird in Phase 6 gebaut (Orchestrator-Entscheid F1). R-UX-01/AK1 mit offenem Panel >= 0,30 bei 375x667; Auto-Schwenk zur gewählten Provinz. Aufwand 10 h.
- *Tests:* `apps/desktop/src/ui/Sheet.test.tsx` (neu) - drei Rasten, Escape schließt, Panel öffnet auf halb; `apps/desktop/src/map/MapCanvas.touch.test.tsx` - Wischen am Blatt löst keine Kartengeste aus (PR #9-#11); Wächter ui-reachability (Sheet.tsx von main.tsx erreichbar).
- *Abhängigkeiten:* T-M44-03a · *Aufwand:* 10 h

**T-M44-10 · Protokoll und Fuß: Zeit einzeilig, Gefechte zusammengefasst, Platz 1 zuerst** — Paket Spielfeld/HUD, Befund B-15, B-20
- *Problem → Ziel:* "22 · 00:00" bricht nicht mehr um; viermal "Gefecht entschieden - niemand behauptet das Feld" wird eine Zeile; die Fuß-Rangliste zeigt Platz 1 als erste Zeile.
- *Lösung:* Zeitspalte `white-space: nowrap`; gleichlautende Gefechtszeilen derselben Provinz und Stunde als eine Zeile mit Anzahl; Platz 1 additiv als erste Ranglistenzeile (F3).
- *Dateien:* `apps/desktop/src/ui/Foot.tsx`, `apps/desktop/src/game/events.ts`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-02/AK4 (Orchestrator-Entscheid F3). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Foot.test.tsx` - describe(R-UX-02/AK4 ...): Platz 1 additiv als erste Zeile, eigene Umgebung bleibt (T-M31-03); Zeitspalte nowrap (Kaskadenwächter); `apps/desktop/src/game/events.test.ts` - gleichlautende Gefechtszeilen derselben Provinz und Stunde werden eine Zeile mit Anzahl.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-11 · Zielwahl: erreichbare Ziele zuerst, gemessen und zwischengespeichert** — Paket Spielfeld/HUD, Befund B-08, B-05d
- *Problem → Ziel:* Die Liste der Marschziele zeigt erreichbare Ziele mit Ankunftstag zuerst; unerreichbare sind abgetrennt und nicht wählbar (vorher 237 Ziele alphabetisch).
- *Lösung:* Erst die Kosten von 237 `planRoute`-Aufrufen am Bündel messen; dann Zielliste je (Armee, Ort, Spieltag) zwischenspeichern, nur beim Öffnen: `optgroup` „erreichbar (Ankunft Tag n)" zuerst, „nicht erreichbar" deaktiviert.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/actions.ts`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-04/AK2. Erst messen: 237 Aufrufe von planRoute (actions.ts) beim Öffnen auf der Weltkarte als lange Aufgabe am Bündel; dann zwischenspeichern; Öffnen < 50 ms. Text für unerreichbar ohne feindliches Gebiet (siehe T-M44-06). Keine Kernänderung. Aufwand 4 h.
- *Tests:* `apps/desktop/src/game/actions.test.ts` - describe(R-UX-04/AK2 ...): Zielliste nach Erreichbarkeit und Ankunft sortiert, Nordwestaustralien von Mittlerer Westen aus disabled; Zwischenspeicher je (Armee, Ort, Spieltag), nur beim Öffnen; `apps/desktop/src/ui/Panels.test.tsx` - zwei optgroups.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 4 h

**T-M44-12 · Seitenleiste: Wirtschaft einklappbar, Panelkopf mit Zurück, Neu-Meldungen kompakt** — Paket Spielfeld/HUD, Befund B-16
- *Problem → Ziel:* Die Wirtschaftstabelle steht nicht mehr unter jedem Panel; jedes Panel hat einen Kopf mit Zurück; die zwei daürhaften "Neu ab heute"-Meldungen belegen keine zwei Zeilen Panelhöhe.
- *Lösung:* Wirtschaft als `details` mit gemerktem Zustand; Panelkopf mit Zurück (Armee → Provinz) und Schließen; „Neu ab heute"-Meldungen als eine Sammelzeile.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Alerts.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-02 (Orientierung). Gemessen: Armeepanel 1280x800 zeigt Name und Marschieren ohne Rollen (vorher Kopf außerhalb des Bildes). Aufwand 4 h.
- *Tests:* `apps/desktop/src/ui/Panels.test.tsx` - Wirtschaft als details mit gemerktem Zustand; `apps/desktop/src/ui/Alerts.test.tsx` - Neu-Meldungen als eine Sammelzeile; `apps/desktop/src/App.test.tsx` - Zurück führt zur Provinz der Armee.
- *Abhängigkeiten:* T-M44-03a · *Aufwand:* 4 h

**T-M44-13 · Erklärung als Popover mit Escape** — Paket Onboarding, Befund B-13
- *Problem → Ziel:* Ein "?" im Bauplatzraster bricht die Kachel nicht mehr auf und schließt mit Escape.
- *Lösung:* Popover über dem Raster, Escape schließt, Fokus zurück.
- *Dateien:* `apps/desktop/src/ui/Explain.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-05/AK3. Aufwand 2 h.
- *Tests:* `apps/desktop/src/ui/Explain.test.tsx` - describe(R-UX-05/AK3 ...): Escape schließt, Fokus zurück auf "?" (heute rot); Browser: Bild 10 ohne verschobenes Raster.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 2 h

**T-M44-14 · Einführung ortsunabhängig und nicht verdeckend** — Paket Onboarding, Befund B-14
- *Problem → Ziel:* Die Einführung sagt nicht "rechts", wenn die Seitenleiste unten liegt, und verdeckt bei 375x667 nicht die Provinzwahl.
- *Lösung:* Schritttexte nennen Bereiche („in der Provinzansicht") statt Richtungen; Einführung weicht dem Zielelement aus.
- *Dateien:* `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/ui/Tutorial.tsx`, `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-05/AK2. Aufwand 3 h.
- *Tests:* `apps/desktop/src/game/tutorial.test.ts` - describe(R-UX-05/AK2 ...): kein Schritttext mit rechts/links/oben/unten; `apps/desktop/src/ui/Tutorial.test.tsx` - Einführung weicht dem Zielelement aus; Wächter prose-in-code, text-keys.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-15 · Startdialog mit Kurzhilfe, Endedialog mit Siegbedingung** — Paket Onboarding, Befund B-09 (Inhalt), B-22
- *Problem → Ziel:* Gegner, Schwierigkeit und Startzahl erklären sich im Startdialog; der Endedialog nennt Sieg/Niederlage, die erfüllte Bedingung und Kennzahlen (vorher derselbe Titel für beides, nur eine Zeile).
- *Lösung:* Kurzhilfe je Feld im Startdialog; Endedialog mit eigener Überschrift für Niederlage, Siegbedingung, Kennzahlen, Weg zur Karte — geprüft am echten Siegstand aus T-M44-02.
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/ui/Standings.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-05/AK4. Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Standings.test.tsx` - describe(R-UX-05/AK4 ...): Niederlage mit eigener Überschrift, Siegbedingung genannt; `apps/desktop/src/ui/Dialogs.test.tsx` - Kurzhilfe je Feld; Browser: Siegstand aus T-M44-02, der die Bedingung wirklich erfüllt.
- *Abhängigkeiten:* T-M44-08 · *Aufwand:* 3 h

**T-M44-16 · Einstellungen mit Einheiten, Tastenkürzel im Menü** — Paket Navigation/Menüs, Befund B-17
- *Problem → Ziel:* "Automatisch speichern alle 5" nennt seine Einheit, die Höchstgeschwindigkeit ist eine Auswahl der Tempostufen, und die Tastenkürzel sind aus dem Menü erreichbar (heute nur per Taste).
- *Lösung:* Einheiten an den Feldern, Höchstgeschwindigkeit als Auswahl der Tempostufen; Menüpunkt „Tastenkürzel".
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-05 (Erkennen statt Erinnern). Aufwand 2 h.
- *Tests:* `apps/desktop/src/ui/Dialogs.test.tsx` - Menü führt Tastenkürzel; Einstellungen zeigen Einheiten; `apps/desktop/src/keyboard.test.ts` unverändert grün; Wächter text-keys.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 2 h

**T-M44-17 · Touch-Ziele, eigenes Fokus-Token, Kontrast-Stichprobe** — Paket Barrierefreiheit, Befund B-11, B-12, B-23
- *Problem → Ziel:* Bei 375 px kein Bedienelement unter 44 px, am Schreibtisch keines unter 24 px; der Fokusrahmen ist nicht mehr Feindrot; die 55-64 von axe als unvollständig gemeldeten Kontrastknoten sind stichprobenartig nachgemessen.
- *Lösung:* 44 px Mindestmaß im Finger-Modus und unter 600 px, sonst 24 px; Token `focus` statt `accent`; Stichprobe von ≥ 20 „unvollständigen" Kontrastknoten von Hand, Ergebnis hier im Plan.
- *Dateien:* `apps/desktop/src/ui/touch.css`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/tokens.ts`, `apps/desktop/src/ui/inputMode.ts`, `docs/plan/UX-PLAN.md`
- *Abnahme (messbar):* R-UX-06/AK1 (Stichprobe von mindestens 20 unvollständigen Knoten, Ergebnis im UX-PLAN), AK3, AK4. Ausnahmen (Kartenmarker, Übersichtskarte) im UX-PLAN gelistet. Aufwand 4 h.
- *Tests:* `apps/desktop/src/ui/tokens.contrast.test.ts` - describe(R-UX-06/AK4 ...): Token focus >= 3:1 gegen ground und paper, ungleich accent; `apps/desktop/src/ui/ActionButton.touch.test.tsx` - describe(R-UX-06/AK3 ...): Mindestmaß unter 600 px; Wächter css-mirrors-tokens, no-color-literals, touch-entry; Browser: `pnpm ux:check --only R-UX-06/AK3`.
- *Abhängigkeiten:* T-M44-03a, T-M44-08 · *Aufwand:* 4 h

#### P3

**T-M44-18 · Sperrgründe gebündelt, Leerzustände als Fließtext** — Paket Feedback/Hinweise, Befund B-16
- *Problem → Ziel:* Im Diplomatiepanel steht nicht mehr unter fünf Knöpfen je ein Sperrsatz; "Derzeit führt niemand Krieg." ist kein Überschriftentext.
- *Lösung:* Sperrgründe am Knopf (`aria-describedby`) und eine Sammelzeile je Gruppe; Leerzustände als Fließtext.
- *Dateien:* `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-03 (Lesbarkeit). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Panels.test.tsx` - describe(R-UX-03/AK1 ...): gesperrte Vertragsbefehle zeigen den Grund am Knopf (aria-describedby) und eine Sammelzeile, nicht fünf Absätze.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-19 · Favicon ohne 404** — Paket Navigation/Menüs, Befund B-19
- *Problem → Ziel:* Kein 404 beim Start (favicon.ico); die Ladeanzeige ist nicht Teil dieser Aufgabe (Titel festgelegt, Review Punkt 15).
- *Lösung:* `<link rel="icon">` als `data:`-URI (CSP `img-src 'self' data:`), keine Bilddatei.
- *Dateien:* `apps/desktop/index.html`
- *Abnahme (messbar):* R-UX-01 (Konsistenz). Favicon als data:-URI im link-Element (die CSP erlaubt img-src self data:, tauri.conf.json) - keine neue Bilddatei, kein ASSETS.md-Eintrag nötig. Aufwand 0,5 h.
- *Tests:* `apps/desktop/src/ui/viewport.touch.test.tsx` - index.html führt ein icon als data:-URI; Browser: consoleErrors leer.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 0,5 h

**T-M44-20 · (bedingt) Tempo 100 ohne Ruckler am Bündel** — Paket Spielfeld/HUD, Befund B-18
- *Problem → Ziel:* Tempo 100 läuft flüssig. Am Dev-Server ruckelte es (1920x1080: 7 lange Aufgaben in 3 s, längste 114 ms, 16 Bilder > 50 ms), am gebauten Bündel nicht (0 lange Aufgaben, 1 Bild > 50 ms in 1280x800 und 1920x1080) - der Befund B-18 ist am Bündel widerlegt, unter Last gemessen.
- *Lösung:* Bedingt: hält R-UX-02/AK5 am Bündel auf ruhiger Maschine, schließt die Aufgabe ohne Code; sonst Memoisierung in der Hülle.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Foot.tsx`, `apps/desktop/src/map/MapCanvas.tsx`
- *Abnahme (messbar):* Bedingung wie T-M42-10: hält R-UX-02/AK5 am Bündel auf ruhiger Maschine, wird die Aufgabe done mit "B-18 am Bündel widerlegt, gemessen N" ohne Codeänderung. Sonst Profil eines Tageswechsels und Memoisierung in der Hülle; kein Kern-Tick wird verändert, eine Ursache im Kern-step wird Befund statt Änderung. Läuft allein, nach Welle 1. Aufwand 0,5 h (widerlegt) oder 4 h (gebaut).
- *Tests:* Erst messen am gebauten Bündel auf ruhiger Maschine: `node scripts/ux-capture.mjs --section bundle --perf-only --url <preview>` (CLAUDE.md: Benchmarks brauchen die Maschine allein); `apps/desktop/src/map/render.bench.slow.test.ts` bleibt im Budget.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 0,5 h / 4 h


## 6 · Pakete und Reihenfolge

Die `deps` in `tasks.yaml` sind **nur fachlich** (08←05, 15←08, 12←03a, 17←03a und 08, 03b←03a,
09b←09a, 21←alle; alle anderen ←02). Die Reihenfolge wegen **Dateikonflikten** steht allein hier,
in den Paketen (Review §9 Punkt 9).

**Welle 0 — allein:** T-M44-02 (Prüfmodus, Mehrspielerlauf `--mp`, echter Siegstand). Ohne ihn hat
keine Maßnahme eine Browser-Prüfung; jsdom rechnet kein Layout.

**Welle 0,5 — Nahtstellen:** T-M44-02b zieht in `App.tsx` vier Nahtstellen heraus, ohne Funktion zu
ändern (~1 h): `game/names.ts` (Namensauflösung), ein Hover/Tooltip-Hook, eine Seitenleisten-Hülle,
die Menüeinträge als Liste. Danach schreiben die Bahnen in getrennte Dateien statt in dieselben
Zeilen von `App.tsx`.

**Stand der Welle 0 und 0,5 (erledigt 2026-10-03, T-M44-02 und T-M44-02b).** Die Browser-Abnahme jeder
Aufgabe ist `pnpm ux:check --only <Kennung>` (Paket A: `R-UX-01`, B: `R-UX-05`/`06`, C: `R-UX-02`, D:
`R-UX-03`/`04`); `--mp` und `--bundle` laufen von selbst, wenn ein gewähltes Kriterium sie braucht.
Wer eine Messgröße braucht, die es noch nicht gibt, ergänzt die **Sonde** in `scripts/ux-capture.mjs`
(unter `probes`, `dialogs` oder `layout`) und das **Kriterium** in `scripts/ux-thresholds.mjs` samt
Mutation in `test/ux-thresholds.test.ts` — nicht eine zweite Messung daneben. Die Nahtstellen in der
Oberfläche:

| Nahtstelle | Datei | Wer sie benutzt |
|---|---|---|
| Namen von Armee, Provinz und Macht (Rückfall heute: die Kennung) | `apps/desktop/src/game/names.ts` (`armyNamer`, `provinceNamer`, `nationNamer`) | D (T-M44-06 ändert den Rückfall auf „eine Armee“, R-UX-03/AK2) |
| Hover- und Tooltip-Zustand, Escape-Ausblenden | `apps/desktop/src/ui/useMapTooltip.ts` | C (T-M44-07: Auswahl-Tooltip nur per Tastatur, nie bei Dialog) |
| Seitenleisten-Hülle mit sechs Plätzen (`picker`, `alerts`, `notice`, `panel`, `economy`, `debug`) | `apps/desktop/src/ui/Sidebar.tsx`; den Inhalt von `panel` setzt `App.tsx` | A (Hochformat, Blatt, Wirtschaft: die Hülle), D (die Panels: ihr Inhalt) |
| Menüeinträge als Liste (`MENU_ENTRIES`, `MenuEntry`) | `apps/desktop/src/ui/menuEntries.ts`, gezeichnet von `MenuDialog` in `Dialogs.tsx` | B (T-M44-09a: zweiter Klick bei „Neue Partie“) |

**Welle 1 — vier parallele Worktrees** (je eigener Dev-Server-Port, WORKFLOW §4 Falle 9):

| Paket | Inhalt | Aufgaben in Reihenfolge | Aufwand |
|---|---|---|---|
| A Layout | Responsivität, Seitenleiste, Einführung, Zugang | T-M44-03a → T-M44-12 → T-M44-14 → T-M44-17 (→ T-M44-03b) | 8 + 4 + 3 + 4 (+ 10) h |
| B Dialoge | Navigation, Barrierefreiheit, Onboarding, Rückfrage | T-M44-05 → T-M44-08 → T-M44-15 → T-M44-16, dazu T-M44-09a (ConfirmButton) | 3 + 2,5 + 3 + 2 + 2,5 h |
| C Kopf, Fuß, Karte | Spielfeld/HUD, Feedback | T-M44-04 → T-M44-07 → T-M44-10, daneben T-M44-13 und T-M44-19 | 4 + 2 + 3 + 2 + 0,5 h |
| D Texte, Panels | Feedback/Hinweise, Zielwahl | T-M44-06 → T-M44-11 → T-M44-18 → T-M44-09b | 5 + 4 + 3 + 1,5 h |

**Merge-Reihenfolge der Bahnen: C → B → D → A.** C bringt die globale `[hidden]`-Regel und den
Kopf, auf die alle anderen sehen; A zuletzt, weil der Hochformat-Stapel die meisten Regeln der
anderen überlagert.

**Welle 2:** T-M44-20 **allein auf ruhiger Maschine** (Zeiten am Bündel), dann T-M44-21.

**Dateikonflikte** (dort wird gemergt, nicht parallel geschrieben):

| Datei | Aufgaben (Paket) | Regel |
|---|---|---|
| `apps/desktop/src/App.tsx` | 02b, 03a/03b (A), 06/11 (D), 07 (C), 12 (A), 16 (B), 20 | nach 02b fassen die Bahnen nur noch ihre Nahtstelle an; Rücklauf in der Merge-Reihenfolge, jede Bahn rebased vorher. |
| `apps/desktop/src/ui/app.css` | 03a, 04, 05, 07, 08, 10, 12, 13, 14, 17, 18 | jede Aufgabe schreibt **einen eigenen, kommentierten Block am Ende**; die globale `[hidden]`-Regel (04, Paket C) steht oben bei den Grundregeln. Kaskade nach jedem Rücklauf am laufenden Spiel prüfen. |
| `apps/desktop/src/ui/touch.css` | 03a, 03b (A), 04 (C), 05 (B), 17 (A) | 03a legt den Hochformat-Block an; andere hängen sich an dessen Medienabfrage. |
| `apps/desktop/src/ui/Dialogs.tsx` | 05, 08, 09a, 15, 16 (alle B) | eine Bahn, nacheinander. |
| `apps/desktop/src/ui/Standings.tsx` | 08, 15 (B) | eine Bahn. |
| `apps/desktop/src/ui/Header.tsx` | 04 (C), 08 (B) | 08 fasst nur die Rohstoffleiste (`tabindex`) an; C merged zuerst. |
| `apps/desktop/src/ui/Panels.tsx` | 09b, 11, 18 (D), 12 (A), 20 | D und A in getrennten Abschnitten (Diplomatie/Zielwahl vs. Kopf/Wirtschaft). |
| `apps/desktop/src/ui/tokens.ts` | 08 (B), 17 (A) | fachliche dep 17←08. |
| `apps/desktop/src/i18n/de.ts` | 03a, 06, 07, 09a, 09b, 11, 14, 15, 16 | nur neue Schlüssel anhängen; Spielertexte **mit** Umlauten. |

**Wächter, die jede Aufgabe grün halten muss** (und in ihrer Tests-Zeile nennt, wo sie greifen):
`test/guards/prose-in-code.test.ts` (keine Literale ≥ 4 Wörter in `ui/*.tsx`, auch nicht in `title`
oder `aria-label` — alles nach `de.ts`), `test/guards/text-keys.test.ts`, der Umlaut-Wächter in
`apps/desktop/src/i18n/text.test.ts`, `test/guards/ui-reachability.test.ts` (neue Module wie
`Sheet.tsx`, `ConfirmButton.tsx`, `game/names.ts` müssen von `main.tsx` erreichbar sein),
`test/guards/css-mirrors-tokens.test.ts` und `test/guards/no-color-literals.test.ts` (Farben nur als
`var(--token)`), `test/guards/touch-entry.test.ts`, `test/guards/no-time-pressure.test.ts` (die
Rückfrage hat keinen Timer), `test/guards/no-foreign-assets.test.ts` (jedes Bild in `docs/ASSETS.md`).
**Testblöcke tragen die Kennung im Titel** — `describe('R-UX-02/AK3 …')` —, sonst meldet
`pnpm coverage:requirements` weiter „M44: 0 von 6".

**Was nie angefasst wird:** `packages/core`, `packages/ai`, `data/rules`, die Golden-Master. Vor jedem
Rücklauf `git diff --stat <Basis> -- packages/core packages/ai data/rules` (leer). T-M44-06 und
T-M44-11 **lesen** Kernfunktionen und -texte (Ablehnungsgründe, `planRoute`), ändern sie nicht.

**Benchmarks:** nur T-M44-20 misst Zeit und braucht die Maschine allein (CLAUDE.md); alle anderen
Aufgaben dürfen parallel zu Simulationen laufen.

## 7 · Vorher/Nachher (wird in T-M44-21 gefüllt)

| Kriterium | Schwelle | Vorher (2026-10-03) | Nachher |
|---|---|---|---|
| R-UX-01/AK1 Kartenanteil 375×667, ohne / mit Panel | ≥ 0,45 / ≥ 0,30 | 0,000 / 0,000 | |
| R-UX-01/AK2 überlaufende Bereiche | 0 in allen Größen | 4 (375), 2 (1280), 2 (1920), 3 (667×375), 5 (320) | |
| R-UX-01/AK3 Fehlschritte | 0 in allen Größen | 9 (375), 10 (320), sonst 0 | |
| R-UX-02/AK1 Kopf + Rohstoffleiste mit Alarmchip und Siegziel | ≤ 70 px bei 1280 und 1366, auch `--mp` | 107 / 107 px; `--mp` nicht gemessen | |
| R-UX-02/AK2 sichtbare `hidden`-Elemente | 0 | 1 (Alarmrahmen) | |
| R-UX-02/AK3 Tooltip über Dialog / nach Mausauswahl stehend | nie | ja / ja | |
| R-UX-02/AK4 Protokollzeit einzeilig, Gefechte zusammengefasst, Platz 1 | ja | nein / nein (4×) / nein | |
| R-UX-02/AK5 Tempo 100 am Bündel, 1920: Bilder > 50 ms / längste Aufgabe | ≤ 3 / ≤ 60 ms | 1 / 0 ms (unter Last) | |
| R-UX-03/AK1 Rohwörter in Sperrgründen | 0 | ≥ 5 im Diplomatiepanel; 34 Gründe ohne Schlüssel | |
| R-UX-03/AK2 Kennungen in Spielertexten | 0 | „a68" | |
| R-UX-03/AK3 beschädigter Stand als „andere Fassung" | nie | ja | |
| R-UX-03/AK4 „feindliches Gebiet" bei kein Weg | nie | ja | |
| R-UX-04/AK1 Rückfrage (Krieg, Bündnis, Überschreiben, Zurücksetzen, neue Partie) | 5 von 5 | 0 von 5 | |
| R-UX-04/AK2 unerreichbare Ziele wählbar; Öffnen der Zielwahl | nein; < 50 ms | ja (237 Ziele); nicht gemessen | |
| R-UX-05/AK1 Hauptaktion Startdialog sichtbar | 8 von 8 Größen | 2 von 8 | |
| R-UX-05/AK4 Endedialog nennt Bedingung (echter Siegstand) | ja | nein; Stand unecht | |
| R-UX-06/AK1 axe-Verstöße; Stichprobe „unvollständig" | 0; ≥ 20 Knoten geprüft | 3–6 Zustände je Größe; 0 geprüft | |
| R-UX-06/AK2 Endedialog, Vorhang, Beitritt/Lobby halten den Fokus | ja | nein (Ende, alle 8 Größen); Rest nicht gemessen | |
| R-UX-06/AK3 Ziele < 24 px am Schreibtisch (Karte) | 0 (Ausnahmen gelistet) | 30 von 43 | |
| R-UX-06/AK4 Fokusrahmen-Token | eigenes, ≥ 3:1 | `accent` | |
| Mehrspieler `--mp`: Beitritt/Lobby/Kopf | aufgenommen | fehlt | |

## 8 · Nicht-Ziele und beantwortete Fragen

- **Kein Umbau des Kriegsrat-Stils** (D27): Farben, Schriften und Marker bleiben; nur der
  Fokusrahmen bekommt ein eigenes Token.
- **Kein neues Spielverhalten:** Rückfragen und Zielvorauswahl ändern nur, *wann* ein Befehl an
  den Kern geht, nicht *welcher*.
- **Die drei Fragen der ersten Fassung sind beantwortet** (Orchestrator-Entscheid unter Noahs
  Vorabfreigabe, kippbar, `DECISIONS.md` 2026-10-03):
  **F1** Hochformat wird gestuft gebaut — T-M44-03a samt nicht blockierendem Hinweis „quer halten
  empfohlen" erfüllt R-UX-01; T-M44-03b (Blatt) ist optional im Plan, wird aber in Phase 6 umgesetzt.
  **F2** Rückfrage als zweiter Klick am selben Knopf, Folgesatz im Knopf und über `aria-live`, kein
  Dialog, keine Zeitüberschreitung, Escape/Fokusverlust brechen ab — auch für Überschreiben und
  Zurücksetzen. **F3** Platz 1 additiv als erste Zeile der Fuß-Rangliste, die eigene Umgebung aus
  T-M31-03 bleibt; `Foot.test.tsx` wird angepasst.
- **Repo-Größe:** die Vorher-Bilder bleiben vollständig (Sitzungsregel „nichts löschen"), verlustfrei
  verkleinert (40 → 33 MB). Für `docs/ux/after` werden nur 375×667, 1280×800 und die neuen Größen als
  Bild eingecheckt; 1920×1080 bleibt Messwert (`--no-shots`).

<!-- LOESCHVERMERK (Review): bis zum Review vom 2026-10-03 standen in Paragraf 6-8 die Bahnen nach Dateikonflikten als deps, die Vorher/Nachher-Tabelle fuer drei Groessen und die drei offenen Fragen an Noah. Wortlaut: git show 8e30cfb:docs/plan/UX-PLAN.md (Paragrafen 6-8). Ersetzt durch die Fassung oben, Begruendung in Paragraf 9. -->

## 9 · Review-Einarbeitung (Review vom 2026-10-03)

Jeder Punkt wurde vor der Übernahme am Code nachgeprüft (die erste Fassung dieses Plans: Commit `8e30cfb`). Abgelehnt wird nur, was nachweislich falsch
ist; Teilablehnungen stehen in der Spalte „wie/warum".

| Nr | Punkt | Ergebnis | Wie / warum (mit Fundstelle) |
|---|---|---|---|
| 1 | `saves.ts`: Reparatur falsch herum | **übernommen** | `migrate.ts:20` `UnsupportedSaveVersion` meldet „Version 3 … Version 2" — `/Version/i` trifft das **und** „Dem Speicherstand fehlen Version oder Spielstand" (`save.ts:48`) und „Formatversion" (`save.ts:61`). T-M44-06: Entscheidung nach `error.name`, Test mit allen Meldungen aus `save.ts` und `migrate.ts`; R-UX-03/AK3 neu gefasst; B-05c berichtigt. |
| 2 | T-M44-03 zu groß, teilen | **übernommen** | Heute greift das Telefon-Layout nur bei `max-height: 480px` (`touch.css`), daher Kartenbreite 0 im Hochformat. T-M44-03a (CSS-Stapel, `(max-width: 599px) and (orientation: portrait)`, 8 h, erfüllt R-UX-01) und T-M44-03b (Blatt, Auto-Schwenk, Gesten gegen `MapCanvas`, 10 h, optional); R-UX-01/AK1 um „mit offenem Panel ≥ 0,30" ergänzt. |
| 3 | Tooltip: falsche Ursache | **übernommen** | `App.tsx` `tooltipId = hover?.id ?? ui.selectedProvince` mit Kommentar T-M31-01 — Absicht für die Tastatur. T-M44-07: Auswahl-Tooltip nur bei Tastaturauswahl, nie bei Dialog, `user-select: none`, ohne „Klicken: auswählen"; Test „Provinz gewählt, Zeiger weg"; B-06 und R-UX-02/AK3 berichtigt. |
| 4 | Endedialog: Abdunkeln existiert | **übernommen** | `ui/Standings.tsx` rendert `.dialog-backdrop` (`app.css` 45 % `ground`) und `role="dialog"`, aber ohne Fokus-Einzug/-falle/Escape. T-M44-08/-15 nennen `Standings.tsx` und `App.tsx`, nutzen `Dialog` aus `Dialogs.tsx` mit optionalem `onClose`; B-09 berichtigt; R-UX-06/AK2 deckt `.dialog-backdrop--locked` und Beitritt/Lobby. |
| 5 | Kopfleiste im Zustand mit Alarmchip und Siegziel, 1366×768, Kompaktregeln, Mehrspieler | **übernommen** | Nachgemessen: mit Alarmchip 107 px bei 1280×800 **und** 1366×768 (ohne 105/83). R-UX-02/AK1 und T-M44-04 entsprechend; Kompaktregeln (Titel < 1500 px aus, Tempo als Gruppe, Modi < 1400 px als Auswahl); `header.fixedSpeed` im `--mp`-Lauf. |
| 6 | Mehrspieler fehlt | **übernommen** | `JoinDialog`/`LobbyDialog` in `Dialogs.tsx`, Bauflagge `WORLDWAR_MULTIPLAYER` in `vite.config.ts`. T-M44-02 bekommt `--mp` (375×667 und 1280×800); T-M44-05/-08 decken Beitritt/Lobby; Befund B-24. |
| 7 | D36 kollidiert mit ROHSTOFFE.md | **übernommen** | `ROHSTOFFE.md` „Entwurf D36 Ampel" (M36). Umbenannt in **D37** in `02-DESIGN.md`, `tasks.yaml` (`design: [D-37]`), `03-TASKS.md`, `01-REQUIREMENTS.md`, UX-PLAN, DECISIONS; alte Fassung als LOESCHVERMERK. `test/withdrawals.test.ts` grün. |
| 8 | Wächter nennen, R-UX-Kennungen in Testtiteln | **übernommen** | Alle acht Wächter existieren unter `test/guards/` bzw. `text.test.ts`; §6 listet sie, die Tests-Zeilen der Aufgaben nennen sie und die `describe('R-UX-0n/AKm …')`-Titel. `coverage:requirements` meldet heute nachweislich „M44: 0 von 6". |
| 9 | deps nur fachlich | **übernommen** | `tasks.yaml`: 08←05, 17←03a+08, 15←08, 12←03a, 21←alle; neu 03b←03a, 09b←09a; Rest ←02. Konfliktreihenfolge nur noch in §6. |
| 10 | Zielwahl: erst messen, dann zwischenspeichern; NO_PATH-Text falsch | **übernommen** | `actions.ts:528` ruft `planRoute` je Ziel; `planRoute` (`movement.ts`) nutzt nur `findPath` über den Kartengraphen — kein feindliches Gebiet. T-M44-11 misst am Bündel, speichert je (Armee, Ort, Spieltag), nur beim Öffnen; `errors.NO_PATH` (`de.ts`) in T-M44-06 berichtigt (R-UX-03/AK4). |
| 11 | ~25 Freitext-Gründe; Hauptstadt verlegen; Namensspeicher; „nur 3 Armeestellen" | **übernommen, ein Teil abgelehnt** | Gezählt: **34** verschiedene `reason`-Texte in den genannten und weiteren Kernbefehlen (statt ~25) — übernommen mit der gezählten Zahl; Schlüssel nach (Befehlstyp, Grund), Wächter liest den Kern nur. Hauptstadt-verlegen-Ausblendung und bewusst leerer Namensspeicher nach dem Laden übernommen. **Abgelehnt:** „nur 3 Armeestellen" — `App.tsx` hat **vier** (`840`, `1838`, `1871`, `1910`); `773` ist, wie das Review richtig sagt, die Provinz. |
| 12 | Zeiten am gebauten Bündel | **übernommen und nachgemessen** | `vite build` + `vite preview`, Abschnitt `bundle` in `messwerte.json`: Tempo 100 am Bündel 0 lange Aufgaben, 1 Bild > 50 ms (Dev: 7/114 ms/16). B-18 herabgestuft, T-M44-20 bedingt wie T-M42-10; T-M44-21 misst nachher denselben Bündeltyp. |
| 13 | Viewports 667×375, 1366×768 (+1024×768, 768×1024, 320×568) | **übernommen und aufgenommen** | Alle fünf in `docs/ux/before` (168 zusätzliche Bilder) und im Standard des Skripts; Befund B-25; R-UX-01 auf alle Mess-Größen erweitert, 667×375/1366×768 als Rückfallprüfung. |
| 14 | Weitere Befunde | **übernommen** | B-20 (vier gleiche Gefechtszeilen → T-M44-10), B-21 (Zurücksetzen ohne Rückfrage → R-UX-04/AK1, T-M44-09a), B-22 (unechtes Spielende → T-M44-02, R-UX-05/AK4), B-23 (55–64 unvollständige Kontrastknoten → Stichprobe in T-M44-17), B-16 um die zwei dauerhaften „Neu ab heute"-Meldungen ergänzt (T-M44-12). |
| 15 | T-M44-19 Titel festlegen, Favicon-Form | **übernommen** | Titel „Favicon ohne 404"; die Ladeanzeige entfällt aus der Aufgabe. Favicon als `data:`-URI — die CSP in `tauri.conf.json` erlaubt `img-src 'self' data:`; damit keine neue Bilddatei und kein ASSETS-Eintrag. |
| 16 | Repo-Größe | **übernommen mit Abweichung** | Sitzungsregel „nichts löschen": Vorher-Bilder bleiben vollständig. oxipng/pngquant/sharp waren nicht installiert; per `pip install pyoxipng` (Scratchpad) **verlustfrei** verkleinert, 40 → 33 MB (−18 %). Verlustbehaftete Palette (−69 %) bewusst nicht, weil „verlustfrei" verlangt war. Nachher nur 375×667, 1280×800 und die neuen Größen als Bild, 1920×1080 als Messwert (T-M44-02/-21). |
| 17 | msedge-Rückfall, Lockfile nur Playwright/axe | **übernommen** | `launchOptions()` in `ux-capture.mjs`: `UX_CHROMIUM` → `/opt/pw-browsers` → unter Windows `channel: 'msedge'`; im Kopf dokumentiert. `pnpm-lock.yaml` vom Stand `ffb95a9` aus neu aufgebaut, nur die zehn rein hinzufügenden Abschnitte übernommen (48 Zeilen statt 227); `pnpm install --frozen-lockfile` Exit 0. Die verschobene Einrückung von `mp:host` in `package.json` ist zurückgestellt. |
| 18 | `[hidden]` vorher alle Stellen suchen; AK-Reihenfolge | **übernommen** | Heute einzige `hidden`-Stelle in TSX: `Header.tsx` `.header__alarm`; T-M44-04 verlangt die Suche in `app.css`/`touch.css` vor der globalen Regel und die Kaskadenprüfung am laufenden Spiel. R-UX-02: AK4 (Protokoll/Fuß) steht jetzt vor AK5 (Tempo). |
