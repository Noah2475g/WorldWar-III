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
