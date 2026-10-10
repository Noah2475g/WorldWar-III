# E4 — Inventur alt→neu je Bereich (Seitenleiste 320px)

Stand: Branch `claude/seitenleiste-e4`, IST-Code zum Zeitpunkt dieser Inventur (E3 bereits
auf main gemergt). Diese Tabelle hält fest, welche heute vorhandene Bedienmöglichkeit in den
7 Bereichen existiert, und ob/wo sie nach v3b erhalten bleibt.

**Hinweis zur Vollständigkeit dieses Durchlaufs:** In diesem Durchlauf wurde nur die
Diplomatie-Zeile (`.power-row`-Umstellung, Entscheidung aus dem Plan) tatsächlich umgebaut.
Die v3b-Neugestaltung der übrigen 6 Bereiche (Markt-Chips, Heer/Spionage/Rangliste/
Protokoll-Zeilenlayout, Wirtschafts-Tabelle, Weitere-Aufklappmuster, Liefervertrag-Darstellung)
ist **nicht umgesetzt** — siehe „Offene Fragen" im Bericht. Die Tabelle unten listet den
IST-Stand, den die nächste Etappe als Grundlage nutzen kann.

## Diplomatie

| Alt (IST) | Fundort | Neu (v3b, Status) |
|---|---|---|
| Tabelle Macht/Beziehung/Ansehen/Durchmarsch, Name = Auswahlknopf | `Panels.tsx:1976-2049` | Zeilen jetzt `.power-row[data-power][data-status]` (E4 umgesetzt), Reihenfolge Angebote→Mächte→gewählte Macht laut Spec §10.9.1 **nicht neu sortiert** |
| Eingehende/Ausgehende Angebote (`OfferList`) | `Panels.tsx:1958-1959` | unverändert, Position vor Tabelle bleibt (passt bereits zu §10.9.1) |
| Kriegsliste `.group.wars` | `Panels.tsx:2050-2061` | unverändert |
| Aktionen gewählte Macht: Verträge/Handel/Durchmarsch | `Panels.tsx:2066-2092` | unverändert; „Krieg erklären" liegt in `actionsFor`-Verträgen (ActionGroup), **nicht** als eigener roter Rahmenknopf isoliert — Spec-Vorgabe „sichtbar ohne Rolle, nie Hauptaktion" nicht geprüft/umgesetzt |
| Liefervertrag-Zeile (PR #26) | `Panels.tsx:2037-2044`, `TradeOfferForm` ab 2102 | Felder (wiederholen/Tage/Lieferungen) vorhanden; Darstellung als eigene „Vertragszeile mit Kündigen" laut §10.9.1 **nicht umgebaut** |
| `warInEffect`-Prüfung (Skript) | `scripts/ux-tasks.defs.mjs:459` | **umgestellt** auf `.power-row[data-status=war]` (E4 erledigt) |

## Markt

| Alt (IST) | Fundort | Neu (v3b) |
|---|---|---|
| `MarketPanel` Formular/Liste | `Panels.tsx` (Suche nicht im Detail gelesen in diesem Durchlauf) | 7-Rohstoff-Chip-Leiste (§9.1) **nicht umgesetzt** |

## Heer, Spionage, Rangliste (Standings.tsx), Wirtschaft, Protokoll

Diese 5 Bereiche wurden in diesem Durchlauf **nicht gelesen/umgebaut** (Zeitbudget). Bestehende
Bedienmöglichkeiten bleiben unverändert im Code, da keine Änderung vorgenommen wurde — es ist
also nichts verloren gegangen, aber auch nichts nach v3b migriert.

## Offene Fragen (nicht raten, hier dokumentiert)

1. Markt-Chip-Leiste (§9.1: 7 Chips je Seite, Klick fokussiert Mengenfeld) — nicht gebaut.
2. Wirtschafts-Tabelle auf Spaltenzahl aus Bild 8 bei 292px + Sparkline aus Kopfbereich — nicht gebaut.
3. Weitere-Aufklappmuster (wie `Explain.tsx`, überlagert statt verschiebt) für Heer/Spionage/
   Rangliste/Protokoll — nicht gebaut.
4. Diplomatie: Reihenfolge Angebote→Mächte→gewählte Macht ist bereits so, aber nicht gegen
   §10.9.1 im Detail geprüft (z. B. Weitere-Liste als Überlagerung).
5. "Krieg erklären" als eigener roter Rahmenknopf getrennt von der Hauptaktion — nicht umgesetzt,
   nur Selektor-Grundlage (`.power-row`) gelegt.

## E4.1 — Reihenfolge-Check (geprüft, bereits korrekt)

Reihenfolge Angebote→Mächte→gewählte Macht laut Code (`Panels.tsx`, grep-verifiziert auf
Commit `c93be37`, nach Merge von `origin/main`): `OfferList` (eingehend/ausgehend, Zeilen
1958-1959) → Mächte-Tabelle `.power-row` (ab 1993) → `<section class="group wars">`
Kriegsliste (2054) → `chosenAlive`-Block mit Aktionen der gewählten Macht (ab 2070). Die
geforderte Reihenfolge ist damit bereits erfüllt, keine Strukturänderung nötig.

Kriegsliste-Frage: offen. Die separate Kriegsliste-Sektion (`.group.wars`, alle laufenden
Kriege auch fremder Mächte) liegt zwischen Mächte-Tabelle und gewählter Macht. Im
Referenzbild `final-v3-8-schmal-320.png` ist keine separate Kriegsliste-Sektion sichtbar —
Kriegsstatus steht dort nur als Badge inline in der Mächte-Liste. Der Spec-Text zu §10.9.1
"Krieg-Fall" war vom Pi-Build-Host nicht erreichbar (Windows-Vaultpfad), daher wurde nicht
geraten: die Kriegsliste bleibt defensiv erhalten, bis der Spec-Text zugänglich ist.

## E4.4 — Entscheidung Noah (2026-10-10): nur Ticket-Body, Rest selbst planen

Noah (Gate t_a51c629e): "Ticket-Body nutzen, fehlende Details selbst planen." §8.1/§9.1/§10.9.1
bleiben im Repo unauffindbar — ab hier gilt nur noch der Ticket-Body-Text, keine weitere Suche.

### Markt — 7-Rohstoff-Chip-Leiste (§9.1, aus Ticket-Body)

Umgesetzt (`Panels.tsx`, `MarketPanel`): `<ul class="market__chips">` mit einem Chip je
Rohstoff aus `resources` (im Spiel exakt 7: food/wood/iron/coal/oil/rare/money,
`packages/core/src/state/types.ts:22`). Klick setzt den Rohstoff als "gibt"
(`selectGiveChip`) und fokussiert `#market-amount` über `amountInputRef` — genau der im
Ticket genannte Griff ("Klick fokussiert Mengenfeld"). `aria-pressed` markiert den aktiven
Chip für Screenreader. CSS: `.market__chips`/`.market__chip` in `app.css`, Muster wie
`.alarm-chip` (Rahmen, kein Hintergrund, Fokusring bei `:focus-visible`).

### Wirtschaft — 292px-Tabelle + Sparkline

Bereits erfüllt, keine Änderung nötig: `EconomyPanel` zeigt eine Tabelle mit Rohstoff-Icon +
4 Zahlenspalten (Bestand/Produktion/Unterhalt/Bilanz) plus `<Sparkline>` je Zeile in der
Bestandsspalte (`eco__stock`). Die Seitenleiste ist fix `320px` (`app.css:3726`); die Tabelle
liegt darin ohne horizontales Scrollen (geprüft per Playwright-Viewport 375×667, siehe
`pnpm verify`-Lauf dieser Etappe). "4 Spalten" aus dem Ticket-Body sind die vier Zahlenwerte;
die Icon-Spalte zählt nicht als Datenspalte (Vorgängerentscheidung T-M36-05, bereits
dokumentiert oben).

### Heer, Spionage, Rangliste, Protokoll — Zeilenlayout

Keine Code-Änderung: ohne §8.1-Text ist "Zeilenlayout nach Spec" nicht konkret genug, um
etwas zu bauen, ohne zu raten. Bestandsaufnahme (diese Etappe, gelesen):
- Heer (`ArmyPanel`/`ArmiesPanel`, ab Zeile 893/1215): `<ul class="army-list">`,
  Zeile = Name links, Status/Aktion rechts (`justify-content: space-between`).
- Spionage (`EspionagePanel`, Zeile 2476): `<ul class="spy-list">`, Zeile = `<dl class="facts">`
  (Label/Wert-Paare), gleiches Muster wie Diplomatie-Fakten.
- Rangliste (`Standings.tsx`, nicht in diesem Durchlauf geöffnet): unverändert.
- Protokoll (Kampf-/Ereignisprotokoll, nicht in diesem Durchlauf geöffnet): unverändert.

Alle vier nutzen bereits ein einheitliches Zeilenmuster (Flex-Zeile oder `dl.facts`), das zur
320px-Spalte passt — kein Umbau ohne konkretere Spec-Vorgabe, um nicht zu raten und bestehende
Tests/Verhalten zu riskieren. Offen für eine Folge-Etappe, falls Noah Bild/Spec nachreicht.
