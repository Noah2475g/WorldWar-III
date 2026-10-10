# E5: Leiste unten — Messung & Verifikation

## Inhaltsverzeichnis
1. Scope & Stand
2. Responsive Messung (4 Aufloesungen)
3. A11y Audit
4. Keyboard-Navigation & Screen-Reader
5. Commit A & B Zusammenfassung
6. Fix in diesem Commit (C)
7. Bekannte Einschraenkungen
8. Validierung

## 1. Scope & Stand

Dieser Bericht deckt Scope C von E5 ab (Messung, A11y-Audit, Bericht, PR). Gemessen wurde
gegen die **Storyboard-HTML-Dateien** (`docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html`,
`storyboard-provincepopup.html`), die in E5a/E5b entstanden sind — **nicht** gegen die Live-App.

**Wichtig:** Dock/RecruitSheet/ProvincePopup sind zum Zeitpunkt dieses Commits noch **nicht**
in `App.tsx`/`Panels.tsx` eingehaengt. Diese Verdrahtung war in keinem der E5a/b/c-Kind-Tickets
beauftragt und ist als eigenes Folge-Ticket **t_fe5f8bd0** (Kind von diesem Ticket, laeuft auf
demselben Branch `claude/seitenleiste-e5`) angelegt. **Live-Integration folgt in t_fe5f8bd0.**
Dieser Bericht beschreibt daher den Stand der isolierten Komponenten-Storyboards, nicht den
Stand der Spiel-UI.

## 2. Responsive Messung (4 Aufloesungen)

Gemessen mit Playwright (`scripts/ux-e5c-measure.mjs`), Screenshots + `.stage`-Boxgroessen
in `docs/ux/v4-seitenleiste/e5/layout-e5c.json`.

| Aufloesung | Screenshots | Stage-Box (w x h) | Befund |
|---|---|---|---|
| 320x640 (Handy) | `e5c-recruitsheet-320x640.png`, `e5c-provincepopup-320x640.png` | 460x240 / 460x280 | **Aenderung noetig (Folgeticket)**: Die Storyboard-Stage ist fest auf 460px breit (keine Media-Queries). Bei 320px Viewport-Breite ragt die Stage ueber den Viewport hinaus. Das Storyboard ist ein statisches Layout-Muster fuer Desktop-Vergleich, hat selbst keine Responsive-Logik — diese entsteht erst bei der echten Integration in `App.tsx` (t_fe5f8bd0), wo Dock/RecruitSheet reale CSS-Klassen mit Breakpoints bekommen (vgl. E5a/E5b-Tests fuer `viewRect`-Clamping). Notiz hier bewusst als Kontext fuer t_fe5f8bd0, nicht als Fehler dieses Tickets, da das Storyboard nie als responsive Live-Komponente deklariert war. |
| 768x1024 (Tablet) | `e5c-recruitsheet-768x1024.png`, `e5c-provincepopup-768x1024.png` | 460x240 / 460x280 | Minor — gleiche feste Box, kein Umbruch, aber Platz reicht (768px > 460px), keine Ueberlappung sichtbar. |
| 1024x768 (kleine Screens) | `e5c-recruitsheet-1024x768.png`, `e5c-provincepopup-1024x768.png` | 460x240 / 460x280 | OK — Box passt, kein Clipping. |
| 1920x1080 (Desktop) | `e5c-recruitsheet-1920x1080.png`, `e5c-provincepopup-1920x1080.png` | 460x240 / 460x280 | OK — entspricht Design-Vorlage (fixe 460px-Stage-Groesse war genau so in `final-v3-2-provinz.png`/`final-v3b-3-fremd-popup.png` als Referenz angelegt). |

**Fazit Messung:** Fuer 768/1024/1920 OK. Fuer 320px ist das Storyboard selbst kein Repro der
geplanten Mobil-Darstellung (Dock halbiert/vertikal) — das ist der dokumentierte Scope-Luecke
aus t_fe5f8bd0 und keine Regression dieses Commits. Echte Responsive-Pruefung auf 320px folgt
nach der App-Verdrahtung.

## 3. A11y Audit

Werkzeug: `@axe-core/playwright`, Regelsatz `wcag2a wcag2aa wcag21a wcag21aa wcag22aa`.
Skript: `scripts/ux-axe-storyboard-e5b.mjs` (Review-Lauf) + eigener Score-Lauf (passes/violations).

| Datei | Violations (vor Fix) | Violations (nach Fix) | Score |
|---|---|---|---|
| storyboard-recruitsheet.html | 1 serious (`color-contrast`, 5 Knoten, `.slot--locked`) | **0** | **100/100** |
| storyboard-provincepopup.html | 0 | 0 | **100/100** |

**Root Cause (recruitsheet):** `.slot--locked { opacity: 0.4; }` daempfte Text+Rand zusammen,
dadurch Kontrast 3.28:1 auf `.slot--locked`-Text (Soll 4.5:1). Fix in diesem Commit: Opacity-Trick
entfernt, stattdessen feste gedaempfte Farbe `color: #9099a6; border-color: #46505c;` — visuell
weiterhin erkennbar "gesperrt", aber WCAG-AA-konform. Damit **>= 90/100 erreicht (100/100)**.

## 4. Keyboard-Navigation & Screen-Reader

Die Storyboard-Dateien sind statische HTML-Demos ohne interaktive Buttons/Fokus-Reihenfolge
(reine `<div>`/`<li>`-Vorschau, kein `tabindex`, keine Click-Handler) — Tab-Reihenfolge und
Screen-Reader-Ansage fuer **Dock-Buttons, RecruitSheet-Panel-Toggle, ProvincePopup-Close** lassen
sich an den Storyboards nicht sinnvoll pruefen, da diese Elemente dort nicht existieren (nur
visuelle Attrappen). Diese Pruefung gehoert inhaltlich zur Live-Integration und wird in
**t_fe5f8bd0** nachgeholt. Hier dokumentiert als bewusste Auslassung, nicht als "bestanden".

## 5. Commit A & B Zusammenfassung

- **Commit A (`1ddca6e`, E5a):** Dock + RecruitSheet UI-Komponenten + Tests (153 Tests gruen
  inkl. Reachability/CSS-Mirror-Pruefungen). Storyboard-HTML fuer RecruitSheet als visueller
  Entwurf ohne Build-Schritt.
- **Commit B (`55b728a`, E5b):** ProvincePopup + `viewRect`-Utility (Map-Clamping-Logik,
  Mentor-Korrektur D11/D12: Map-Utility statt Dock-Logik) + Storyboard fuer ProvincePopup.
  14/14 Tests gruen, axe 0 Violations auf ProvincePopup.

## 6. Fix in diesem Commit (C)

- `docs/ux/v4-seitenleiste/e5/storyboard-recruitsheet.html`: `.slot--locked`-Kontrastfix
  (opacity-Trick entfernt) — axe-Score recruitsheet von 88 auf 100.
- `scripts/ux-e5c-measure.mjs` (neu): Playwright-Messskript fuer 4 Aufloesungen gegen die
  E5-Storyboards, schreibt Screenshots + `layout-e5c.json`.
- Screenshots + `layout-e5c.json` in `docs/ux/v4-seitenleiste/e5/`.
- Dieser Bericht.

## 7. Bekannte Einschraenkungen

- **App.tsx-Verdrahtung fehlt** (Dock/RecruitSheet/ProvincePopup nicht in der Live-App) —
  Folge-Ticket t_fe5f8bd0, bereits als Parent von t_37375e3f (Merge-Gate) verlinkt.
- Keine Animations-Uebergaenge fuer Dock-Collapse/Expand.
- Kein Drag-and-Drop-Reorder im RecruitSheet-Grid.
- 320px-Mobil-Stacking ist nur als Plan dokumentiert, noch nicht implementiert/gemessen
  (haengt an t_fe5f8bd0).
- Keyboard/Screen-Reader-Pruefung auf echte interaktive Elemente steht noch aus (s. Abschnitt 4).

## 8. Validierung

- `npm run build` (tsc --noEmit): **build-ok**
- `npx vitest run`: **229 Testdateien / 4186 Tests gruen** (gesamtes Repo, keine Regression)
- axe-core (Storyboards): **100/100 beide Dateien, 0 Violations**
- PR: siehe PR-Link im Ticket-Kommentar (wird von diesem Builder-Lauf erstellt, **nicht gemergt**
  — Merge macht ausschliesslich der reviewer in t_37375e3f gemaess Merge-Regel).
