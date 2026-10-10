# E4 — Inventur alt→neu je Bereich (Seitenleiste 320px)

Stand: Branch `claude/seitenleiste-e4`, finaler Stand nach E4.1–E4.7 (HEAD `8cfafb9`).
Hinweis: Protokoll (Kampf-/Ereignisprotokoll) wurde bereits in E3 auf main umgebaut und
hier nicht erneut angefasst — reine Dokumentation, kein Code-Diff in dieser Etappe.

## 1. Diplomatie

| Alt (IST) | Fundort | Neu (v3b, Status) |
|---|---|---|
| Tabelle Macht/Beziehung/Ansehen/Durchmarsch, Name = Auswahlknopf | `Panels.tsx:1976-2049` (vor E4) | Zeilen jetzt `.power-row[data-power][data-status]` (E4.1 umgesetzt) |
| Eingehende/Ausgehende Angebote (`OfferList`) | `Panels.tsx` | unverändert, Reihenfolge Angebote→Mächte→gewählte Macht per Grep gegen Commit `c93be37` geprüft: bereits korrekt (E4.1) |
| „Krieg erklären“ als Hauptaktion vermischt mit Verträgen | `Panels.tsx` (vor E4.3) | eigener roter Rahmenknopf `.button--danger-outline` ausserhalb jeder Gruppe, nie Hauptaktion, aber in jedem Nicht-Kriegs-Status sichtbar/klickbar (E4.3, Commit `0f3e874`) |
| Restliche Vertrags- und Durchmarsch-/Kartenaktionen inline | `Panels.tsx` (vor E4.3) | wandern ins neue „Weitere“-Aufklappmuster `DiplomacyMore` (Vorbild `Explain.tsx`): aria-expanded/aria-controls, Escape schliesst + gibt Fokus zurück, Klick aussen schliesst, Panel überlagert per `position: absolute` statt Layout zu verschieben (E4.3) |
| Liefervertrag-Zeile (PR #26) | `Panels.tsx`, `TradeOfferForm` | kompakte Zeile: Icon, Menge, „noch N“, Kündigen-Knopf (E4.2, Commit `59f7240`) |
| `warInEffect`-Prüfung (Skript) | `scripts/ux-tasks.defs.mjs:459` | umgestellt auf `.power-row[data-status=war]` (E4.1) |
| Regression gemessen in E4.7 | — | „Frieden anbieten“ per Maus **und** Tastatur nicht erreichbar (Timeout/Tab-Explosion), vermutlich Folge der `.power-row`-Umstellung — dokumentiert in `bericht.md` §E4.7, **nicht behoben** (reines Mess-Ticket), Folge-Fix empfohlen |

## 2. Markt

| Alt (IST) | Fundort | Neu (v3b, Status) |
|---|---|---|
| `MarketPanel` Formular/Liste ohne Chip-Auswahl | `Panels.tsx` (vor E4.4) | 7-Rohstoff-Chip-Leiste für „Gibt“ (§9.1): Klick setzt den Rohstoff via `selectGiveChip` und fokussiert `#market-amount` (E4.4, Commit `ba99574`) |
| Nur eine Seite (Geben) mit Chips | `Panels.tsx` | zweite Chip-Leiste für „Verlangen“ ergänzt, gleiches Muster, `selectWantChip` (E4.4, Commit `b621f7f`) |
| `aria-pressed` je aktivem Chip, CSS `.market__chips`/`.market__chip` (Muster wie `.alarm-chip`) | `app.css` | unverändert seit E4.4, Fokusring bei `:focus-visible` |
| K2-Messung Markt-Körper (E4.7) | `scripts/ux-layout.mjs` | neue `markt`-Szene ergänzt (gleiches Muster wie Diplomatie-Szene), scrollH/clientH = 1,0 bei 1280×800 und 1920×1080 — erfüllt |

## 3. Heer (ArmiesPanel)

Geprüft in E4.6 (Commit-Referenz `1f39225`, Ergebnis dokumentiert im Kommentarverlauf von
t_564b9f19): `ArmyRow` hat genau 5 Felder (id, name, provinceName, strength, order,
orderText) — **alle** bereits in `armies__what` (flex-column, stackt automatisch)
sichtbar. Kein verborgenes Feld gefunden. → **kein Weitere-Pattern gebaut**, bewusst
begründet, nicht erzwungen. Kein Code-Diff.

## 4. Spionage (EspionagePanel)

Geprüft in E4.6: Design-Kommentar im CSS (`app.css:788f`) sagt explizit „eine Karte je
Spion statt einer Tabelle — sechs Spalten schoben die Leiste seitwärts“. Das bestehende
`<dl class="facts">`-Grid-Layout (auto/1fr) löst das bereits; Ziel/Sold/letztes Ergebnis +
ActionRow passen bei 320px ohne Umbruchprobleme. → **kein Weitere-Pattern nötig**, kein
Code-Diff.

## 5. Rangliste (Standings.tsx)

Geprüft in E4.6: 4 Spalten (Nation/Score/Beziehung/sichtbare Stärke). Die Komponente hat
bereits `useScrollableTab` (horizontales Scrollen mit Tabstopp, R-UX-06/AK1, barrierefrei
getestet) für schmale Breiten. Ein zusätzliches Weitere-Collapse würde diesen etablierten
Mechanismus duplizieren **und** „sichtbare Stärke“ (Kern-Ehrlichkeitsregel R-DIP-04) hinter
einem Klick verstecken — das ist eine der 4 Kernfragen der Rangliste, keine seltene
Zusatzinfo. → **kein Weitere-Pattern gebaut**, bestehender Scroll-Mechanismus bleibt die
Lösung. Kein Code-Diff.

## 6. Wirtschaft (EconomyPanel)

Bereits vor E4 erfüllt, in E4.5 kompaktiert statt doppelt gebaut: Tabelle mit
Rohstoff-Icon + 4 Zahlenspalten (Bestand/Produktion/Unterhalt/Bilanz) plus `<Sparkline>`
je Zeile in der Bestandsspalte. In E4.5 (Commit `1f39225`, nur `app.css`, 17 additive
Zeilen) Zellenpolsterung 5px→3px und Nebenwert-Schriftgröße 12px→10px verkleinert — keine
Spalte entfernt, R-ECON-06-Test (Panels.test.tsx, „Ruhiger, nicht kürzer“) bleibt grün.
Seitenleiste bleibt fix 320px, Tabelle liegt darin ohne horizontales Scrollen (geprüft per
Playwright-Viewport 375×667).

## 7. Protokoll

Bereits in E3 (vor dieser Etappe, auf `main`) umgebaut — in E4 **nicht** erneut angefasst.
Nur zur Vollständigkeit dieser Inventur dokumentiert, kein Diff in E4.

## Offene Punkte für eine Folge-Etappe

1. Regression „Frieden anbieten“ (K4, E4.7) — Maus und Tastatur erreichen den Knopf nicht
   mehr seit der `.power-row`-Umstellung (E4.3/E4.1). Fix-Ticket empfohlen vor Breitenabnahme.
2. Zwei kleine Tastatur-Abweichungen (+1 Tab-Stopp je) bei krieg-erklaeren und
   handel-anbieten gegenüber B0 — nicht blockierend, Aufgaben bleiben erreichbar.

## Verlauf der Etappen (zur Nachvollziehbarkeit)

- E4.1 (`838c987`): Diplomatie-Reihenfolge geprüft (bereits korrekt), Kriegsliste-Frage dokumentiert.
- E4.2 (`59f7240`): Liefervertragszeile kompaktiert.
- E4.3 (`0f3e874`): Krieg-Rahmenknopf isoliert + `DiplomacyMore`-Aufklappmuster gebaut.
- E4.4 (`ba99574`, `b621f7f`): Markt-Chip-Leiste (Geben + Verlangen).
- E4.5 (`1f39225`): Wirtschaftstabelle kompaktiert (292px, R-ECON-06 erhalten).
- E4.6 (kein Code-Diff, s. Kommentarverlauf t_564b9f19): Heer/Spionage/Rangliste geprüft,
  begründet kein Weitere-Pattern nötig.
- E4.7 (`8cfafb9`): Messreihe gegen B0 über 4 Auflösungen, Regression „Frieden anbieten“
  gefunden und dokumentiert.
- E4.8 (dieses Ticket): finale Inventur, Gesamt-Verify, PR review-fertig.
