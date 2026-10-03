# UX-PLAN — UX V2 (M44), Aufnahme vom 2026-10-03

> **Wozu diese Datei.** Sie hält fest, wie sich das Spiel heute bedient — gemessen, nicht
> geschätzt —, bewertet es und leitet daraus 18 priorisierte Maßnahmen in sechs Paketen ab. Die
> Maßnahmen stehen als **M44 „UX V2"** (T-M44-01…21) in `tasks.yaml` und `03-TASKS.md`, die
> Anforderungen als **R-UX-01…06** in `01-REQUIREMENTS.md` 2.20, der Entwurf als **D36** in
> `02-DESIGN.md`.
>
> **Grenze:** keine Maßnahme ändert `packages/core`, `packages/ai` oder `data/rules` — keine Regel,
> kein Balancing, keine KI. Auch diese Aufnahme hat nichts davon angefasst: das Spielende entstand
> aus einem echten Spielstand der Aufnahme, dessen Feld `victory.winner` gesetzt und mit dem
> `serialise` des Kerns neu versiegelt wurde.

## 0 · Kurzfassung

Am Schreibtisch (1280×800, 1920×1080) ist das Spiel **vollständig bedienbar**: alle 34 Ansichten
erreichbar, axe-core findet am Start **0 Verstöße** gegen WCAG 2.1 AA, jeder Tab-Halt hat einen
sichtbaren Fokusrahmen, Zoomen und Schieben laufen ohne eine einzige lange Aufgabe (Bild-p95
16,8 ms). Die Schwächen liegen woanders:

1. **Telefon hochkant ist unbenutzbar.** Bei 375×667 ist die Karte **0 px breit**
   (`mapShareOfViewport` 0), die Kopfleiste frisst **240 px** (36 % der Höhe), und **9 von 34**
   Ansichten sind nicht erreichbar — Ausheben, Armee, Marsch, Gefecht, Depesche.
2. **Die Kopfleiste bricht bei 1280 px um**, sobald am zweiten Tag das Siegziel erscheint:
   **65 → 105–107 px**, der Kartenanteil fällt von **0,535 auf 0,462**; daneben steht ein **leerer
   roter Alarmrahmen**, weil `.header__alarm { display: inline-flex }` das Attribut `hidden` schlägt.
3. **Die Hauptaktion des Startdialogs liegt unter dem Dialogrand** (1280×800: Knopf bei y = 733,
   Dialog endet bei 720) — wer nicht im Dialog rollt, findet „Partie beginnen" nicht.
4. **Fehlermeldungen sprechen Kernsprache:** „Dieses Ziel ist für den Befehl nicht zulässig. (kein
   Angebot)" fünfmal im Diplomatiepanel, „a68 ist vernichtet." im Protokoll, und ein beschädigter
   Spielstand meldet „stammt aus einer anderen Fassung".
5. **Folgenschweres geschieht ohne Rückfrage:** Krieg erklären und Spielstand überschreiben sind
   ein Klick; die Zielwahl bietet 237 Ziele alphabetisch an und sagt erst nach der Wahl „Dorthin
   führt kein Weg".

Die Maßnahmen: **7 × P1, 8 × P2, 3 × P3**, dazu das Messwerkzeug (T-M44-01, erledigt), sein
Prüfmodus (T-M44-02) und die Nachher-Aufnahme (T-M44-21). Geschätzter Aufwand rund 62 h.

## 1 · Methode und Messaufbau

| Was | Wie |
|---|---|
| Werkzeug | `scripts/ux-capture.mjs` (`pnpm ux:capture`; Playwright 1.56.1 als Entwicklungsabhängigkeit, Begründung `DECISIONS.md` 2026-10-03 — kein Teil von `pnpm verify`, D14 bleibt, vorinstalliertes Chromium aus `/opt/pw-browsers`, `@axe-core/playwright`) gegen `pnpm dev --port 5321 --strictPort` im Worktree |
| Ablauf | Start → Partie anlegen → Karte → Zoom/Schieben → Kartenmodi → Provinz → Erklärung → Bau → Tempo 100 → Ausheben → Armee → Zielwahl (gültig/ungültig) → Marsch → Diplomatie → Krieg → Gefecht → Depesche → Panels → Menü → Einstellungen → Speichern → beschädigter Stand → Sieg → Niederlage |
| Fenster | 375×667 (Telefon, Finger-Modus `hasTouch`), 1280×800, 1920×1080; Gerätefaktor 1 |
| Ladezeit | Navigation Timing (`domInteractive`, `DOMContentLoaded`, `load`, erster Inhalt) und Wanduhr bis „Partie beginnen" im DOM steht |
| Ruckler | `PerformanceObserver('longtask')` und Bildabstände per `requestAnimationFrame` während Zoom (8 Mausradschritte), Schieben (20 Schritte) und 3 s Tempo 100 |
| Kontrast/Regeln | axe-core mit `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` in acht Zuständen (Start, Karte, Provinz, Armee, Diplomatie, Einstellungen, Spielstände, Ende) |
| Tastatur | 8–40 Tab-Schritte je Zustand: erreichtes Element, `:focus-visible`, Rahmen vorhanden, außerhalb des Bildes |
| Touch-Ziele | jedes sichtbare Bedienelement, gezählt unter 44 px (WCAG 2.5.5) und unter 24 px (2.5.8) |
| Fläche | Anteil der sichtbaren Karte, Höhen von Kopf/Fuß, waagerechter Überlauf von Seite, Kopf, Rohstoffleiste, Seitenleiste, Fuß, Dialog, Spielstandraster |
| Ergebnis | 100 Bilder in `docs/ux/before/` (Nummer = Ansicht, gleich in allen Größen; `x-…-nicht-erreichbar` = was man an einer unerreichbaren Stelle sieht), Rohdaten `docs/ux/before/messwerte.json` |

**Vorbehalte.** (a) Gemessen am **Dev-Server** (vite, unbündelt, 174 Ressourcen, 6,4 MB) —
die Ladezeiten taugen für vorher/nachher, nicht als Zusage über das ausgelieferte Bündel
(WORKFLOW §4 Falle 18). (b) Auf der Maschine (4 Kerne) lief **parallel eine KI-Simulation eines
anderen Agenten**; die Ruckler-Zahlen bei Tempo 100 sind deshalb eine Obergrenze. T-M44-20 misst
sie auf ruhiger Maschine neu, bevor eine Zeile fällt. (c) Die Partie ist nicht deterministisch
genug für Bildvergleiche Pixel für Pixel (Uhr läuft in Echtzeit); verglichen werden Messwerte.

**Wiederholen (Phase 6):**

```bash
pnpm dev --port 5321 --strictPort &          # im Worktree, eigener Port
node scripts/ux-capture.mjs --out docs/ux/after
```

## 2 · Messwerte auf einen Blick

| Messwert | 375×667 | 1280×800 | 1920×1080 |
|---|---|---|---|
| Ansichten erreicht (von 34) | **23** (9 Fehlschritte) | 34 | 34 |
| Startdialog bedienbar nach | 0,60 s | 0,64 s | 0,66 s |
| „Partie beginnen" → Karte steht | 0,72 s | 0,70 s | 0,72 s |
| Hauptaktion Startdialog ohne Rollen sichtbar | nein | **nein** | ja |
| Kopfleiste + Rohstoffleiste, Start → ab Tag 2 | **240 px** | 65 → **105–107 px** | 65 → 65–67 px |
| Kartenanteil am Bild, Start → ab Tag 2 | **0,000** | 0,535 → **0,462** | 0,660 → 0,628 |
| Überlaufende Bereiche | Kopf 528>375, Rohstoffe 478>375, Dialog 604>518, Raster 592>494 | Dialog 604>518, Raster 592>494 | Dialog 604>518, Raster 592>494 |
| Zoom: lange Aufgaben / Bild-p95 | 0 / 16,7 ms | 0 / 16,8 ms | 0 / 16,8 ms |
| Schieben: lange Aufgaben / Bild-p95 | 0 / 16,7 ms | 0 / 16,7 ms | 0 / 16,8 ms |
| Tempo 100 (3 s): lange Aufgaben, längste, Bilder > 50 ms | nicht erreichbar | 4, 107 ms, 10 | **7, 114 ms, 16** |
| axe-Verstöße (Zustände mit Verstoß / 8) | 6 (`scrollable-region-focusable` `.resources`) | 3 (`color-contrast` `.alarm-chip` 4,27:1) | 3 (dito) |
| axe „unvollständig" color-contrast (Knoten, max.) | 64 | 61 | 55 |
| Tab-Halte ohne Fokusrahmen | 0 | 0 | 0 |
| Tab-Halte außerhalb des Bildes (Karte, 40 Schritte) | **8** | 0 | 0 |
| Endedialog: Tab verlässt den Dialog | **ja** | **ja** | **ja** |
| Bedienelemente < 44 px (Karte, sichtbar) | 4 von 32 | 41 von 43 | 41 von 43 |
| Bedienelemente < 24 px (Karte, sichtbar) | 4 von 32 | **30 von 43** | 30 von 43 |
| Marschziele in der Zielwahl | — | 237 (alle Provinzen) | 237 |
| Konsolenfehler | 1 (404 `favicon.ico`) | 0 | 0 |

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
| B-05 | **Kernsprache in Spielertexten.** (a) `describeRejection` hängt `detail.reason` roh an: „… nicht zulässig. (kein Angebot)", „(bereits im Krieg)", „(nicht im Frieden)" — fünf Zeilen im Diplomatiepanel; „Hauptstadt verlegen" in der eigenen Hauptstadt. (b) `state.armies[id]?.name ?? id` nennt eine vernichtete Armee „a68". (c) `loadFrom` ordnet „Dem Speicherstand fehlen Version oder Spielstand" per `/Version/` als „andere Fassung" ein. | 09, 20, 21, 22, 23, 32 | H9 Fehler erkennen, H2 Sprache | hoch |
| B-06 | **Kartentooltip bleibt stehen** und liegt über der Depesche; auf dem Telefon erscheint er als markierter Text über der Wirtschaftstabelle. | 24 (Tooltip über dem Dialog), 09-375 | H8; WCAG 1.4.13 | mittel |
| B-07 | **Krieg erklären ohne Rückfrage** (Quittung erst danach: „befohlen — wirkt beim Weiterlaufen"); Speichern überschreibt einen belegten Platz ohne Rückfrage. | 21; 31 | H5 Fehlervermeidung, H3 | hoch |
| B-08 | **Zielwahl ohne Vorauswahl:** 237 Ziele alphabetisch, von Afghanistan an; „Dorthin führt kein Weg" erst nach der Wahl. | 16, 17; `marchTargetOptions` 237 | H5, H6 | mittel |
| B-09 | **Endedialog nicht modal:** kein Abdunkeln, Tab erreicht „Menü", die Weltkarte und die Zoomknöpfe dahinter; Sieg und Niederlage tragen denselben Titel, die Siegbedingung fehlt. | 33, 34; `victoryFocusLeavesDialog` true | WCAG 2.4.3; H1 | hoch |
| B-10 | **axe-Verstöße nach dem ersten Alarm:** Alarmchip `#e8583f` auf `#1e2632` = **4,27:1** bei 12 px (verlangt 4,5:1); bei 375 px ist die rollbare Rohstoffleiste ohne Tastaturzugang. | `axe.settings/saves/victory` (1280, 1920), `axe.*` (375) | WCAG 1.4.3, 2.1.1 | mittel |
| B-11 | **Kleine Ziele am Schreibtisch:** 30 von 43 Bedienelementen der Kartenansicht < 24 px — Tempoknöpfe 26×22, „?" 14×14, „Ausblenden" 15×18. Im Finger-Modus greifen die 44 px aus `touch.css` (nur „?" 22×22 bleibt), aber nur auf dem Teil, der sichtbar ist. | `touch.mapStart`, `touch.provincePanel` | WCAG 2.5.8 (2.2), 2.5.5 | mittel |
| B-12 | **Fokusrahmen in Feindrot:** `:focus-visible { outline: 2px solid var(--accent) }` — `accent` ist laut D27.1 „Feind, Kampf, Alarm — und nur das". Bei 375 liegen 8 der ersten 40 Tab-Halte außerhalb des Bildes. | 01 (Schließen-Kreuz rot umrandet); `keyboard.mapStart` | WCAG 2.4.7; Konsistenz | niedrig |
| B-13 | **Erklärung „?" bricht das Raster:** der Text erscheint in der Kachel und schiebt das Bauplatzraster auseinander; Escape schließt sie nicht. | 10 | H3 Kontrolle, H8 | mittel |
| B-14 | **Einführung spricht von „rechts"** („Rechts stehen Moral, Bevölkerung …"), auf dem Telefon liegt die Seitenleiste darunter; dort verdeckt die Einführung die Provinzwahl. | 04, 04-375 | H10 Hilfe, H2 | mittel |
| B-15 | **Protokollzeit bricht um** („22 ·" / „00:00"), sobald eine Zeile ein Symbol trägt; die Fuß-Rangliste zeigt die Plätze 3–6 oder 5–8, aber nie den Ersten. | 22–24, 27 | H8, H1 | niedrig |
| B-16 | **Seitenleiste ohne Ordnung:** die Wirtschaftstabelle steht unter jedem Panel; im Armeepanel ist der Kopf aus dem Bild gerollt, sobald man „Marschieren" sieht; „Derzeit führt niemand Krieg." steht in Überschriftgröße. | 14, 15, 20 | H8, H6 | mittel |
| B-17 | **Einstellungen ohne Einheiten** („Automatisch speichern alle 5" — Tage? Minuten?), Höchstgeschwindigkeit als freies Zahlenfeld; die Tastenkürzel-Hilfe ist nur per Taste erreichbar, das Menü kennt drei Einträge. | 29, 30 | H6, H10 | niedrig |
| B-18 | **Tempo 100 ruckelt** sichtbar bei 1920×1080: 7 lange Aufgaben in 3 s, längste 114 ms, 16 Bilder über 50 ms (1280: 4, 107 ms, 10). Zoom und Schieben sind dagegen glatt. Vorbehalt Maschinenlast (§1). | `perf.running100` | gefühlte Leistung | mittel |
| B-19 | **404 beim Start** — `index.html` nennt kein Icon, der Browser fragt `favicon.ico`. Einzige Konsolenmeldung. | `consoleErrors` 375 | Konsistenz | niedrig |

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
| H5 Fehlervermeidung | schwach | Krieg und Überschreiben ohne Rückfrage (B-07), Zielwahl ohne Vorauswahl (B-08) |
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
| Responsivität | schwach | Schreibtisch gut, Telefon hochkant unbenutzbar (B-01), Spielstandraster läuft über (B-04) |
| Konsistenz/visuelle Qualität | gut | einheitlicher Kriegsrat-Stil; Ausreißer B-02, B-12, B-13 |
| Gefühlte Leistung | gut / mittel | Start < 0,8 s, Zoom/Schieben glatt; Tempo 100 ruckelt (B-18) |

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
| T-M44-02 | P1 | alle (Werkzeug) | Prüfmodus des Messwerkzeugs | R-UX-01, R-UX-06 | 01 | 3 h |
| T-M44-03 | P1 | Responsivität | Telefon hochkant: Karte zuerst, Seitenleiste als Blatt | R-UX-01 | 02 | 8 h |
| T-M44-04 | P1 | Spielfeld/HUD | Kopfleiste einzeilig, hidden gilt | R-UX-02 | 02 | 3 h |
| T-M44-05 | P1 | Navigation/Menüs | Dialoge: Hauptaktion in fester Fußzeile, Spielstandraster passt | R-UX-05, R-UX-01 | 02 | 3 h |
| T-M44-06 | P1 | Feedback/Hinweise | Spielersprache: Sperrgründe, Kennungen, beschädigter Stand | R-UX-03 | 02 | 4 h |
| T-M44-07 | P1 | Feedback/Hinweise | Kartentooltip verschwindet beim Verlassen und unter Dialogen | R-UX-02 | 04 | 2 h |
| T-M44-08 | P1 | Barrierefreiheit | Endedialog hält den Fokus, axe ohne Verstoß | R-UX-06 | 04, 05 | 2,5 h |
| T-M44-09 | P1 | Feedback/Hinweise | Rückfrage bei folgenschweren Befehlen | R-UX-04 | 08 | 4 h |
| T-M44-10 | P2 | Spielfeld/HUD | Protokollzeit einzeilig, Fuß-Rangliste mit Spitze | R-UX-02 | 07 | 2 h |
| T-M44-11 | P2 | Spielfeld/HUD | Zielwahl: erreichbare Ziele zuerst | R-UX-04 | 06 | 4 h |
| T-M44-12 | P2 | Spielfeld/HUD | Seitenleiste: Wirtschaft einklappbar, Panelkopf mit Zurück | R-UX-02 | 03 | 4 h |
| T-M44-13 | P2 | Onboarding | Erklärung als Popover mit Escape | R-UX-05 | 02 | 2 h |
| T-M44-14 | P2 | Onboarding | Einführung ortsunabhängig und nicht verdeckend | R-UX-05 | 03 | 3 h |
| T-M44-15 | P2 | Onboarding | Startdialog mit Kurzhilfe, Endedialog mit Siegbedingung | R-UX-05 | 09 | 3 h |
| T-M44-16 | P2 | Navigation/Menüs | Einstellungen mit Einheiten, Tastenkürzel im Menü | R-UX-05 | 15 | 2 h |
| T-M44-17 | P2 | Barrierefreiheit | Touch-Ziele und eigenes Fokus-Token | R-UX-06 | 03, 08 | 3 h |
| T-M44-18 | P3 | Feedback/Hinweise | Sperrgründe gebündelt, Leerzustände als Fließtext | R-UX-03 | 11 | 3 h |
| T-M44-19 | P3 | Navigation/Menüs | Favicon und Ladeanzeige | R-UX-01 | 02 | 0,5 h |
| T-M44-20 | P3 | Spielfeld/HUD | Tempo 100 ohne Ruckler in der Hülle | R-UX-02 | 12 | 4 h |
| T-M44-21 | P1 | alle | Nachher-Aufnahme und Abnahme UX V2 | R-UX-01, R-UX-02, R-UX-03, R-UX-04, R-UX-05, R-UX-06 | 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 | 2 h |

**Zählung (ohne Werkzeug T-M44-01/02 und Abnahme T-M44-21):** P1: 7, P2: 8, P3: 3. Je Paket: Responsivität 1 (03); Spielfeld/HUD 5 (04, 10, 11, 12, 20); Navigation/Menüs 3 (05, 16, 19); Feedback/Hinweise 4 (06, 07, 09, 18); Barrierefreiheit 2 (08, 17); Onboarding 3 (13, 14, 15).

### 5.2 Maßnahmen im Einzelnen

#### Basis

**T-M44-01 · UX-Aufnahme: Messwerkzeug und Vorher-Bilder** — Paket alle, Befund —
- *Problem → Ziel:* Den Ist-Zustand in drei Fenstergrößen messbar festhalten, damit jede spätere Maßnahme gegen eine Zahl abgenommen wird.
- *Lösung:* erledigt — siehe §1.
- *Dateien:* `scripts/ux-capture.mjs`, `docs/ux/before/messwerte.json`, `docs/plan/UX-PLAN.md`, `package.json`
- *Abnahme (messbar):* Erledigt am 2026-10-03: scripts/ux-capture.mjs (Playwright, vorinstalliertes Chromium, @axe-core/playwright als devDependency) fährt 34 Ansichten in 375x667, 1280x800 und 1920x1080 und schreibt PNGs plus messwerte.json (Ladezeit, lange Aufgaben bei Zoom, Schieben und Tempo 100, axe WCAG 2.1 AA, Tab-Reihenfolge mit Fokusrahmen, Ziele unter 44/24 px, Flächenanteile, waagerechter Überlauf). Spielende über einen echten Spielstand der Aufnahme, dessen victory.winner gesetzt und mit serialise des Kerns neu versiegelt wird - keine Spiellogik geändert. Befunde und Maßnahmen in docs/plan/UX-PLAN.md.
- *Tests:* kein Komponententest (Werkzeug); Browserlauf `node scripts/ux-capture.mjs --out docs/ux/before` gegen `pnpm dev --port 5321`.
- *Abhängigkeiten:* — · *Aufwand:* erledigt

#### P1

**T-M44-02 · Prüfmodus des Messwerkzeugs** — Paket alle (Werkzeug), Befund alle
- *Problem → Ziel:* Jede M44-Aufgabe hat einen Browser-Test, der ihr Abnahmekriterium als Exit-Code meldet.
- *Lösung:* Prüfmodus `--check` mit Schwellen aus einer reinen Funktion (`scripts/ux-thresholds.mjs`), Exit-Code je Kriterium.
- *Dateien:* `scripts/ux-capture.mjs`, `scripts/ux-thresholds.mjs`, `test/ux-thresholds.test.ts`, `package.json`
- *Abnahme (messbar):* node scripts/ux-capture.mjs --check [--only <Kriterium>] liest die Schwellen aus scripts/ux-thresholds.mjs, gibt je Kriterium grün/rot mit Messwert aus und endet mit Exit 1 bei einem roten. pnpm ux:check als Skript in package.json (nicht in verify: braucht Dev-Server und Browser). Aufwand 3 h.
- *Tests:* `test/ux-thresholds.test.ts` - die Schwellen aus R-UX-01..06 als reine Funktion über ein messwerte.json: der Vorher-Stand fällt an genau den im UX-PLAN genannten Stellen, ein erfundener Sollstand ist grün.
- *Abhängigkeiten:* T-M44-01 · *Aufwand:* 3 h

**T-M44-03 · Telefon hochkant: Karte zuerst, Seitenleiste als Blatt** — Paket Responsivität, Befund B-01
- *Problem → Ziel:* Bei 375x667 ist die Karte sichtbar und jede Kernhandlung erreichbar (vorher Kartenanteil 0, Seitenleiste und Fuß füllen das Bild).
- *Lösung:* Unter 600 px Breite: Kopfleiste einzeilig wischbar, Karte volle Breite, Seitenleiste als Blatt mit drei Rasten, Fuß als Reiterleiste (D36.2).
- *Dateien:* `apps/desktop/src/ui/touch.css`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Sheet.tsx`, `apps/desktop/src/ui/Sheet.test.tsx`, `apps/desktop/src/ui/portrait.touch.test.tsx`
- *Abnahme (messbar):* R-UX-01/AK1-AK3 bei 375x667: mapShareOfViewport >= 0,45, pageOverflowX falsch, overflowingRegions leer, Aufnahme ohne Fehlschritt. 1280 und 1920 unverändert (Bildvergleich der Kartenansicht). Sichtprüfung am laufenden Spiel (WORKFLOW Paragraf 3, Kaskade). Aufwand 8 h.
- *Tests:* `apps/desktop/src/ui/Sheet.test.tsx` (drei Rasten, Escape schließt, Panel öffnet auf halb); `apps/desktop/src/ui/portrait.touch.test.tsx` (Kaskade: unter 600 px gilt die Blatt-Regel, Kopfleiste nowrap); Browser: `pnpm ux:check --only R-UX-01`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 8 h

**T-M44-04 · Kopfleiste einzeilig, hidden gilt** — Paket Spielfeld/HUD, Befund B-02
- *Problem → Ziel:* Die Kopfleiste bleibt ab 1280 px einzeilig, auch wenn das Siegziel erscheint; kein leerer Alarmrahmen.
- *Lösung:* Globale Regel `[hidden] { display: none !important }`; Siegziel als schmaler Balken in die Uhrzeile; Spielstände/Menü als kompakte Knöpfe am Zeilenende (D36.3).
- *Dateien:* `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/touch.css`
- *Abnahme (messbar):* R-UX-02/AK1, AK2: Kopfleiste samt Rohstoffleiste <= 70 px bei 1280x800 und 1920x1080 auch ab Tag 2 (vorher 105-107 px bei 1280x800, Kartenanteil fällt dabei von 0,535 auf 0,462), kein sichtbares Element mit hidden. Kaskade am laufenden Spiel geprüft (Falle aus M36). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/cascade.touch.test.tsx` - Kaskadenwächter: `[hidden]` gewinnt gegen `.header__alarm { display: inline-flex }` (heute rot); `apps/desktop/src/ui/Header.test.tsx` - Siegziel steht in der Uhrzeile; Browser: `pnpm ux:check --only R-UX-02`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-05 · Dialoge: Hauptaktion in fester Fußzeile, Spielstandraster passt** — Paket Navigation/Menüs, Befund B-03, B-04
- *Problem → Ziel:* "Partie beginnen" ist ohne Rollen sichtbar; das Spielstandraster läuft nicht aus dem Dialog.
- *Lösung:* Dialog-Gerüst mit fester Fußzeile `.dialog__foot` für Aktionen, Körper rollt; Spielstände als Liste (eine Zeile je Platz, mit Macht und Spieltag).
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/touch.css`
- *Abnahme (messbar):* R-UX-05/AK1 in allen drei Größen (vorher: Knopf bei y=733 unter dem Dialogrand 720 bei 1280x800); R-UX-01/AK2 für .dialog und .slots (vorher Spielstandraster 4. Spalte abgeschnitten). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Dialogs.test.tsx` - Aktionen stehen in `.dialog__foot` außerhalb des rollenden Körpers; Spielstände in einer Spalte je Platz; Browser: `pnpm ux:check --only R-UX-05/AK1` und `R-UX-01/AK2`.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 3 h

**T-M44-06 · Spielersprache: Sperrgründe, Kennungen, beschädigter Stand** — Paket Feedback/Hinweise, Befund B-05
- *Problem → Ziel:* Kein Rohwort des Kerns ("kein Angebot", "bereits im Krieg"), keine Kennung ("a68") und keine falsche Ursache ("andere Fassung") in Spielertexten.
- *Lösung:* Grund-Tabelle für `INVALID_TARGET` wie `SPY_REASON_KEYS`; letzter bekannter Armeename statt Kennung; `loadFrom` prüft „Formatversion" statt „Version" (D36.4).
- *Dateien:* `apps/desktop/src/game/rejections.ts`, `apps/desktop/src/game/rejections.test.ts`, `apps/desktop/src/game/saves.ts`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-03/AK1-AK3. Grund-Tabelle wie SPY_REASON_KEYS; Namensauflösung merkt sich den letzten Namen einer Armee (App.tsx, vier Stellen mit "?? id"). Kern unverändert: die Gründe werden gelesen, nicht geändert. Aufwand 4 h.
- *Tests:* `apps/desktop/src/game/rejections.test.ts` (neu) - jeder INVALID_TARGET-Grund der Hüllen-Befehle hat einen Satz, kein Satz enthält Klammer-Rohwort; `apps/desktop/src/game/saves.test.ts` - "Dem Speicherstand fehlen Version oder Spielstand" ergibt corrupt, nicht wrongVersion (heute rot); `apps/desktop/src/i18n/text.test.ts` - Umlaut-Wächter grün.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 4 h

**T-M44-07 · Kartentooltip verschwindet beim Verlassen und unter Dialogen** — Paket Feedback/Hinweise, Befund B-06
- *Problem → Ziel:* Der Tooltip "Mittlerer Westen / Moral / Armeen" liegt nicht mehr über der Depesche und bleibt nicht stehen, wenn der Zeiger geht.
- *Lösung:* Tooltip an `pointerleave` der Karte und an `dialog !== null` binden; `user-select: none` im Tooltip.
- *Dateien:* `apps/desktop/src/ui/Tooltip.tsx`, `apps/desktop/src/map/MapCanvas.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-02/AK3 in allen drei Größen. Aufwand 2 h.
- *Tests:* `apps/desktop/src/map/MapCanvas.test.tsx` - pointerleave meldet onHover(null); `apps/desktop/src/ui/Tooltip.test.tsx` - bei offenem Dialog kein Tooltip; Browser: Bild 24 (Depesche) ohne Tooltip.
- *Abhängigkeiten:* T-M44-04 · *Aufwand:* 2 h

**T-M44-08 · Endedialog hält den Fokus, axe ohne Verstoß** — Paket Barrierefreiheit, Befund B-09, B-10
- *Problem → Ziel:* Tab verlässt den Endedialog nicht mehr (vorher erreichte Tab Menü, Weltkarte und Zoomknöpfe dahinter), und axe meldet keinen Verstoß mehr (vorher Alarmchip 4,27:1 bei 12 px, rollbare Rohstoffleiste ohne Tastaturzugang bei 375 px).
- *Lösung:* VictoryDialog über das gemeinsame Dialog-Gerüst (Fokusfalle, Abdunkeln); Alarmchip-Schrift auf ein Paar ≥ 4,5:1; Rohstoffleiste `tabindex=0` mit Namen, wenn sie rollt.
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/ui/Header.tsx`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/tokens.ts`
- *Abnahme (messbar):* R-UX-06/AK1, AK2 für alle modalen Dialoge und Messzustände der Aufnahme (Start, Spielstände, Einstellungen, Depesche, Ende). Rohstoffleiste: tabindex=0 mit Namen, wenn sie rollt. Aufwand 2,5 h.
- *Tests:* `apps/desktop/src/ui/a11y.test.tsx` - R-UX-06/AK2: VictoryDialog nutzt das gemeinsame Dialog-Gerüst, Tab vom letzten Knopf springt zum ersten (heute rot); `apps/desktop/src/ui/tokens.contrast.test.ts` - Paar Alarmchip-Schrift auf paperSunk >= 4,5:1 (heute 4,27); Browser: keyboard.victory ohne Ziel außerhalb des Dialogs, axe 0 Verstöße in allen Messzuständen.
- *Abhängigkeiten:* T-M44-04, T-M44-05 · *Aufwand:* 2,5 h

**T-M44-09 · Rückfrage bei folgenschweren Befehlen** — Paket Feedback/Hinweise, Befund B-07
- *Problem → Ziel:* Krieg erklären, Bündnis aufkündigen, belegten Stand überschreiben und neue Partie aus laufender Partie brauchen einen zweiten Schritt.
- *Lösung:* `ConfirmButton`: erster Klick zeigt die Folge in einem Satz („Krieg mit Mexiko — Verträge enden, Ruf sinkt"), zweiter sendet; Escape/Fokusverlust bricht ab.
- *Dateien:* `apps/desktop/src/ui/ConfirmButton.tsx`, `apps/desktop/src/ui/ConfirmButton.test.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-04/AK1. Befehle selbst unverändert (dieselben Kommandos an den Kern). Aufwand 4 h.
- *Tests:* `apps/desktop/src/ui/ConfirmButton.test.tsx` (neu) - erster Klick zeigt Folge-Satz, zweiter sendet, Escape und Fokusverlust brechen ab; `apps/desktop/src/ui/Panels.test.tsx` - "Krieg erklären" sendet erst nach Bestätigung (heute rot); `apps/desktop/src/ui/Dialogs.test.tsx` - Überschreiben eines belegten Platzes fragt nach.
- *Abhängigkeiten:* T-M44-08 · *Aufwand:* 4 h

**T-M44-21 · Nachher-Aufnahme und Abnahme UX V2** — Paket alle, Befund alle
- *Problem → Ziel:* Dieselben Bilder und Messwerte nach dem Umbau, Vorher/Nachher-Tabelle im UX-PLAN.
- *Lösung:* Dieselbe Aufnahme nach `docs/ux/after`, Tabelle §7 füllen, `pnpm ux:check` grün.
- *Dateien:* `docs/ux/after/messwerte.json`, `docs/plan/UX-PLAN.md`, `docs/plan/PROGRESS.md`
- *Abnahme (messbar):* Alle R-UX-Kriterien grün in drei Größen; Tabelle vorher/nachher im UX-PLAN Paragraf 7; pnpm verify Exit 0; Golden-Master unverändert; packages/core, packages/ai, data/rules ohne Diff gegen den Stand vor M44. Neue Bilder in docs/ASSETS.md (R-ASSET-01). Aufwand 2 h.
- *Tests:* Browser: `node scripts/ux-capture.mjs --out docs/ux/after` und `pnpm ux:check` - alle Kriterien grün.
- *Abhängigkeiten:* T-M44-03, T-M44-04, T-M44-05, T-M44-06, T-M44-07, T-M44-08, T-M44-09, T-M44-10, T-M44-11, T-M44-12, T-M44-13, T-M44-14, T-M44-15, T-M44-16, T-M44-17, T-M44-18, T-M44-19, T-M44-20 · *Aufwand:* 2 h

#### P2

**T-M44-10 · Protokollzeit einzeilig, Fuß-Rangliste mit Spitze** — Paket Spielfeld/HUD, Befund B-15
- *Problem → Ziel:* "22 · 00:00" bricht nicht mehr um; die Fuß-Rangliste zeigt Platz 1 und die eigene Umgebung (vorher Plätze 5-8).
- *Lösung:* Zeitspalte `white-space: nowrap` mit fester Breite; Rangliste: Platz 1, dann eigene Umgebung.
- *Dateien:* `apps/desktop/src/ui/Foot.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-02/AK4. Aufwand 2 h.
- *Tests:* `apps/desktop/src/ui/Foot.test.tsx` - Platz 1 steht immer in der Liste; Zeitspalte mit nowrap (Kaskadenwächter); Browser: Bild 22/23 einzeilig.
- *Abhängigkeiten:* T-M44-07 · *Aufwand:* 2 h

**T-M44-11 · Zielwahl: erreichbare Ziele zuerst** — Paket Spielfeld/HUD, Befund B-08
- *Problem → Ziel:* Die Liste der Marschziele zeigt erreichbare Ziele mit Ankunftstag zuerst; unerreichbare sind abgetrennt und nicht wählbar (vorher 237 Ziele alphabetisch).
- *Lösung:* Zielliste einmal je Öffnen über die vorhandene Wegsuche der Hülle: `optgroup` „erreichbar (Ankunft Tag n)" zuerst, „nicht erreichbar" deaktiviert.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/game/actions.ts`
- *Abnahme (messbar):* R-UX-04/AK2. Nutzt die vorhandene Wegsuche der Hülle (dieselbe, die "Dorthin führt kein Weg" meldet); keine Kernänderung. Messen: Zeit zum Öffnen der Zielwahl auf der Weltkarte < 50 ms (lange Aufgabe). Aufwand 4 h.
- *Tests:* `apps/desktop/src/game/actions.test.ts` - Zielliste nach Erreichbarkeit und Ankunft sortiert, Nordwestaustralien von Mittlerer Westen aus disabled; `apps/desktop/src/ui/Panels.test.tsx` - zwei optgroups.
- *Abhängigkeiten:* T-M44-06 · *Aufwand:* 4 h

**T-M44-12 · Seitenleiste: Wirtschaft einklappbar, Panelkopf mit Zurück** — Paket Spielfeld/HUD, Befund B-16
- *Problem → Ziel:* Die Wirtschaftstabelle steht nicht mehr unter jedem Panel und schiebt die Befehle nicht aus dem Bild; jedes Panel hat einen Kopf mit Zurück.
- *Lösung:* Wirtschaft als `details` mit gemerktem Zustand; Panelkopf mit Zurück (Armee → Provinz) und Schließen.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-02 (Orientierung). Gemessen: Armeepanel 1280x800 zeigt Marschieren ohne Rollen (vorher Kopf außerhalb des Bildes). Aufwand 4 h.
- *Tests:* `apps/desktop/src/ui/Panels.test.tsx` - Wirtschaft als details mit gemerktem Zustand; `apps/desktop/src/App.test.tsx` - Zurück führt zur Provinz der Armee.
- *Abhängigkeiten:* T-M44-03 · *Aufwand:* 4 h

**T-M44-13 · Erklärung als Popover mit Escape** — Paket Onboarding, Befund B-13
- *Problem → Ziel:* Ein "?" im Bauplatzraster bricht die Kachel nicht mehr auf und schließt mit Escape.
- *Lösung:* Popover über dem Raster (absolute Lage, `role="tooltip"`/`note`), Escape schließt, Fokus zurück.
- *Dateien:* `apps/desktop/src/ui/Explain.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-05/AK3. Aufwand 2 h.
- *Tests:* `apps/desktop/src/ui/Explain.test.tsx` - Escape schließt, Fokus zurück auf "?" (heute rot); Browser: Bild 10 ohne verschobenes Raster.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 2 h

**T-M44-14 · Einführung ortsunabhängig und nicht verdeckend** — Paket Onboarding, Befund B-14
- *Problem → Ziel:* Die Einführung sagt nicht "rechts", wenn die Seitenleiste unten liegt, und verdeckt bei 375x667 nicht die Provinzwahl.
- *Lösung:* Schritttexte nennen Bereiche („in der Provinzansicht") statt Richtungen; Einführung weicht dem Zielelement aus.
- *Dateien:* `apps/desktop/src/game/tutorial.ts`, `apps/desktop/src/ui/Tutorial.tsx`, `apps/desktop/src/i18n/de.ts`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-05/AK2. Aufwand 3 h.
- *Tests:* `apps/desktop/src/game/tutorial.test.ts` - kein Schritttext mit rechts/links/oben/unten; `apps/desktop/src/ui/Tutorial.test.tsx` - Einführung weicht dem Zielelement aus.
- *Abhängigkeiten:* T-M44-03 · *Aufwand:* 3 h

**T-M44-15 · Startdialog mit Kurzhilfe, Endedialog mit Siegbedingung** — Paket Onboarding, Befund B-09 (Inhalt), B-03 (Umfeld)
- *Problem → Ziel:* Gegner, Schwierigkeit und Startzahl erklären sich im Startdialog; der Endedialog nennt Sieg/Niederlage, die Bedingung und Kennzahlen (vorher derselbe Titel für beides, nur eine Zeile).
- *Lösung:* Kurzhilfe je Feld im Startdialog; Endedialog mit eigener Überschrift für Niederlage, Siegbedingung, Kennzahlen, Weg zur Karte.
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-05/AK4. Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Dialogs.test.tsx` - Endedialog bei Niederlage hat eigene Überschrift und nennt die Siegbedingung; Startdialog führt für jedes Feld eine Kurzhilfe.
- *Abhängigkeiten:* T-M44-09 · *Aufwand:* 3 h

**T-M44-16 · Einstellungen mit Einheiten, Tastenkürzel im Menü** — Paket Navigation/Menüs, Befund B-17
- *Problem → Ziel:* "Automatisch speichern alle 5" nennt seine Einheit, die Höchstgeschwindigkeit ist eine Auswahl der Tempostufen, und die Tastenkürzel sind aus dem Menü erreichbar (heute nur per Taste).
- *Lösung:* Einheiten an den Feldern, Höchstgeschwindigkeit als Auswahl der Tempostufen; Menüpunkt „Tastenkürzel".
- *Dateien:* `apps/desktop/src/ui/Dialogs.tsx`, `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`
- *Abnahme (messbar):* R-UX-05 (Erkennen statt Erinnern). Aufwand 2 h.
- *Tests:* `apps/desktop/src/ui/Dialogs.test.tsx` - Menü führt "Tastenkürzel"; Einstellungen zeigen Einheiten; `apps/desktop/src/keyboard.test.ts` unverändert grün.
- *Abhängigkeiten:* T-M44-15 · *Aufwand:* 2 h

**T-M44-17 · Touch-Ziele und eigenes Fokus-Token** — Paket Barrierefreiheit, Befund B-11, B-12
- *Problem → Ziel:* Bei 375 px kein Bedienelement unter 44 px, am Schreibtisch keines unter 24 px; der Fokusrahmen ist nicht mehr Feindrot.
- *Lösung:* 44 px Mindestmaß im Finger-Modus und unter 600 px, sonst 24 px; Token `focus` (Bernstein-Ton) statt `accent` im Fokusrahmen.
- *Dateien:* `apps/desktop/src/ui/touch.css`, `apps/desktop/src/ui/app.css`, `apps/desktop/src/ui/tokens.ts`, `apps/desktop/src/ui/inputMode.ts`
- *Abnahme (messbar):* R-UX-06/AK3, AK4. Ausnahmen (Kartenmarker, Übersichtskarte) im UX-PLAN gelistet. Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/tokens.contrast.test.ts` - Token focus >= 3:1 gegen ground und paper, ungleich accent; `apps/desktop/src/ui/ActionButton.touch.test.tsx` - Mindestmaß unter 600 px; Browser: `pnpm ux:check --only R-UX-06/AK3`.
- *Abhängigkeiten:* T-M44-03, T-M44-08 · *Aufwand:* 3 h

#### P3

**T-M44-18 · Sperrgründe gebündelt, Leerzustände als Fließtext** — Paket Feedback/Hinweise, Befund B-16
- *Problem → Ziel:* Im Diplomatiepanel steht nicht mehr unter fünf Knöpfen je ein Sperrsatz; "Derzeit führt niemand Krieg." ist kein Überschriftentext.
- *Lösung:* Sperrgründe am Knopf (`aria-describedby`/`title`) und eine Sammelzeile je Gruppe; Leerzustände als Fließtext.
- *Dateien:* `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/app.css`
- *Abnahme (messbar):* R-UX-03 (Lesbarkeit). Aufwand 3 h.
- *Tests:* `apps/desktop/src/ui/Panels.test.tsx` - gesperrte Vertragsbefehle zeigen den Grund am Knopf (title/aria-describedby) und eine Sammelzeile, nicht fünf Absätze.
- *Abhängigkeiten:* T-M44-11 · *Aufwand:* 3 h

**T-M44-19 · Favicon und Ladeanzeige** — Paket Navigation/Menüs, Befund B-19
- *Problem → Ziel:* Kein 404 beim Start (favicon.ico), und der leere Zustand vor der ersten Partie zeigt Fortschritt statt nur "Lade".
- *Lösung:* `<link rel="icon">` auf ein eigenes SVG; Eintrag in `docs/ASSETS.md`.
- *Dateien:* `apps/desktop/index.html`, `apps/desktop/public/favicon.svg`, `docs/ASSETS.md`
- *Abnahme (messbar):* R-UX-01 (Konsistenz). Neue Bilddatei in docs/ASSETS.md eintragen (R-ASSET-01, WORKFLOW Falle 23). Aufwand 0,5 h.
- *Tests:* `apps/desktop/src/ui/viewport.touch.test.tsx` - index.html führt ein icon; Browser: consoleErrors leer.
- *Abhängigkeiten:* T-M44-02 · *Aufwand:* 0,5 h

**T-M44-20 · Tempo 100 ohne Ruckler in der Hülle** — Paket Spielfeld/HUD, Befund B-18
- *Problem → Ziel:* Bei Tempo 100 laufen Karte und Panels flüssig (vorher 4-7 lange Aufgaben in 3 s, längste 107-114 ms, Bild-p95 67-117 ms).
- *Lösung:* Erst messen (ruhige Maschine, Profil eines Tageswechsels), dann in der Hülle memoisieren; Ursache im Kern → Befund statt Änderung.
- *Dateien:* `apps/desktop/src/App.tsx`, `apps/desktop/src/ui/Panels.tsx`, `apps/desktop/src/ui/Foot.tsx`, `apps/desktop/src/map/MapCanvas.tsx`
- *Abnahme (messbar):* R-UX-02 (gefühlte Leistung): perf.running100.framesOver50Ms <= 3 und longTaskMaxMs <= 60 bei 1920x1080 auf ruhiger Maschine, gemessen gegen einen am selben Tag gemessenen Ausgangswert (WORKFLOW Falle 18). Nur Hülle (Memoisierung der Panels, Protokoll-Liste, Neuzeichnen nur bei Änderung); kein Kern-Tick wird verändert. Ist die Ursache im Kern-step, endet die Aufgabe mit einem Befund statt einer Änderung. Aufwand 4 h.
- *Tests:* Erst messen: `node scripts/ux-capture.mjs --out <tmp> --viewports 1920x1080` auf ruhiger Maschine (CLAUDE.md: Benchmarks brauchen die Maschine allein), dann Profil eines Tageswechsels; `apps/desktop/src/map/render.bench.slow.test.ts` bleibt im Budget.
- *Abhängigkeiten:* T-M44-12 · *Aufwand:* 4 h


## 6 · Pakete und Reihenfolge

**Welle 0 — Voraussetzung:** T-M44-02 (Prüfmodus). Ohne ihn hat keine Maßnahme einen
Browser-Test; jsdom rechnet kein Layout, und genau die Hälfte der Befunde ist Layout.

**Welle 1 — vier Bahnen parallel** (je ein Worktree mit eigenem Dev-Server-Port, WORKFLOW §4
Falle 9). Innerhalb einer Bahn nacheinander; die `deps` in `tasks.yaml` bilden genau diese
Reihenfolge ab:

| Bahn | Pakete | Aufgaben in Reihenfolge | Aufwand |
|---|---|---|---|
| 1 Layout | Responsivität, Spielfeld/HUD, Onboarding, Barrierefreiheit | T-M44-03 → T-M44-12 → T-M44-20; T-M44-03 → T-M44-14; T-M44-03 + T-M44-08 → T-M44-17 | 8 + 4 + 4 + 3 + 3 h |
| 2 Dialoge | Navigation/Menüs, Barrierefreiheit, Feedback, Onboarding | T-M44-05 → T-M44-08 → T-M44-09 → T-M44-15 → T-M44-16 | 3 + 2,5 + 4 + 3 + 2 h |
| 3 Kopf und Fuß | Spielfeld/HUD, Feedback | T-M44-04 → T-M44-07 → T-M44-10 | 3 + 2 + 2 h |
| 4 Texte | Feedback/Hinweise, Spielfeld/HUD | T-M44-06 → T-M44-11 → T-M44-18 | 4 + 4 + 3 h |
| frei | Onboarding, Navigation | T-M44-13, T-M44-19 (jederzeit nach T-M44-02) | 2 + 0,5 h |

**Welle 2 — Abschluss:** T-M44-21 (Nachher-Aufnahme), wenn alles andere `done` ist.

**Dateikonflikte zwischen den Bahnen** (dort wird gemergt, nicht parallel geschrieben):

| Datei | Aufgaben | Regel |
|---|---|---|
| `apps/desktop/src/App.tsx` | 03, 06, 07, 11, 12, 16, 20 | größter Konflikt. Reihenfolge der Rückläufe: 03 → 06 → 07 → 11 → 12 → 16 → 20; jede Bahn rebased vor dem Rücklauf auf den Integrationszweig. 06 berührt nur die vier `?? id`-Stellen der Namensauflösung, 07 nur `onHover`/Tooltip — beide klein. |
| `apps/desktop/src/ui/app.css` | 03, 04, 05, 07, 08, 10, 12, 13, 14, 17, 18 | jede Aufgabe schreibt **einen eigenen, kommentierten Block** am Ende statt verstreuter Änderungen; die globale `[hidden]`-Regel (04) steht oben bei den Grundregeln. Kaskade nach jedem Rücklauf **am laufenden Spiel** prüfen (WORKFLOW §3, Falle aus M36). |
| `apps/desktop/src/ui/touch.css` | 03, 04, 05, 17 | 03 zuerst (neuer Hochformat-Block); 04/05/17 hängen sich an dessen Medienabfrage. |
| `apps/desktop/src/ui/Dialogs.tsx` | 05, 08, 09, 15, 16 | alle in Bahn 2, also nacheinander. |
| `apps/desktop/src/ui/Header.tsx` | 04, 08 | 08 wartet auf 04 (deps). |
| `apps/desktop/src/ui/Panels.tsx` | 09, 11, 12, 18, 20 | 09 (Bahn 2) fasst nur die Diplomatie-Knöpfe an, 11/18 (Bahn 4) die Zielwahl und Sperrgründe, 12/20 (Bahn 1) Kopf und Memoisierung — Abschnitte getrennt halten. |
| `apps/desktop/src/ui/tokens.ts` | 08, 17 | 17 wartet auf 08 (deps). |
| `apps/desktop/src/i18n/de.ts` | 06, 09, 14, 15, 16 | nur neue Schlüssel anhängen; Spielertexte **mit** Umlauten (Wächter in `text.test.ts`). |

**Was nie angefasst wird:** `packages/core`, `packages/ai`, `data/rules`, die Golden-Master. Jede
Aufgabe prüft vor dem Rücklauf `git diff --stat <Basis> -- packages/core packages/ai data/rules`
(leer). T-M44-11 und T-M44-06 **lesen** Kernfunktionen (Wegsuche, Ablehnungsgründe), ändern sie
aber nicht.

**Benchmarks:** nur T-M44-20 misst Zeit (`render.bench.slow.test.ts`, Tempo-100-Messung) und
braucht die Maschine allein (CLAUDE.md). Alle anderen Aufgaben dürfen parallel zu Simulationen
laufen.

## 7 · Vorher/Nachher (wird in T-M44-21 gefüllt)

| Kriterium | Schwelle | Vorher (2026-10-03) | Nachher |
|---|---|---|---|
| R-UX-01/AK1 Kartenanteil 375×667 | ≥ 0,45 | 0,000 | |
| R-UX-01/AK2 überlaufende Bereiche | 0 in allen Größen | 4 / 2 / 2 | |
| R-UX-01/AK3 Fehlschritte | 0 in allen Größen | 9 / 0 / 0 | |
| R-UX-02/AK1 Kopf + Rohstoffleiste ab Tag 2 (1280) | ≤ 70 px | 105–107 px | |
| R-UX-02/AK2 sichtbare `hidden`-Elemente | 0 | 1 (Alarmrahmen) | |
| R-UX-02/AK3 Tooltip über Dialog | nie | ja (Bild 24) | |
| R-UX-02/AK5 Tempo 100, 1920: Bilder > 50 ms / längste Aufgabe | ≤ 3 / ≤ 60 ms (ruhige Maschine) | 16 / 114 ms (unter Last) | |
| R-UX-03/AK1 Rohwörter in Sperrgründen | 0 | ≥ 5 im Diplomatiepanel | |
| R-UX-03/AK2 Kennungen in Spielertexten | 0 | „a68" | |
| R-UX-04/AK1 Rückfrage bei Krieg/Überschreiben | ja | nein | |
| R-UX-04/AK2 unerreichbare Ziele wählbar | nein | ja (237 Ziele) | |
| R-UX-05/AK1 Hauptaktion Startdialog sichtbar | 3 von 3 Größen | 1 von 3 | |
| R-UX-06/AK1 axe-Verstöße | 0 | 6 / 3 / 3 Zustände | |
| R-UX-06/AK2 Endedialog hält den Fokus | ja | nein | |
| R-UX-06/AK3 Ziele < 24 px am Schreibtisch (Karte) | 0 (Ausnahmen gelistet) | 30 von 43 | |
| R-UX-06/AK4 Fokusrahmen-Token | eigenes, ≥ 3:1 | `accent` | |

## 8 · Nicht-Ziele und offene Fragen an Noah

- **Kein Umbau des Kriegsrat-Stils** (D27): Farben, Schriften und Marker bleiben; nur der
  Fokusrahmen bekommt ein eigenes Token.
- **Kein neues Spielverhalten:** Rückfragen und Zielvorauswahl ändern nur, *wann* ein Befehl an
  den Kern geht, nicht *welcher*.
- **Frage 1:** Soll das Telefon im Hochformat überhaupt ein Spielziel sein (T-M44-03, 8 h), oder
  reicht „bitte quer halten" mit einem Hinweis (0,5 h)? Der Plan nimmt das Hochformat an, weil
  der Mehrspieler-Link (M39) auf Telefonen geöffnet wird.
- **Frage 2:** Rückfrage bei Krieg als zweiter Klick am selben Knopf (Vorschlag) oder als Dialog?
- **Frage 3:** Die Fuß-Rangliste zeigt heute absichtlich die eigene Umgebung (T-M31-03); Platz 1
  dazuzunehmen ändert eine Entscheidung aus D27.6 — gewünscht?
