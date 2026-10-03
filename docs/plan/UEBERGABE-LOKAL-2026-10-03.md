# Übergabe an den lokalen Agenten — Cloud-Sitzung 2026-10-02/03

> Die Cloud-Sitzung endete, weil das Guthaben aufgebraucht war. **Alle Agenten wurden
> mitten in der Arbeit angehalten.** Jede Änderung ist gesichert: entweder auf dem
> Hauptzweig oder als WIP-Commit auf einem eigenen `wip/…`-Zweig auf `origin`. Nichts liegt
> nur noch in der Cloud. Diese Datei sagt, wo was liegt und wie es weitergeht.

## 0 · Ankommen

```bash
git fetch origin
git switch claude/game-v2-planned-tasks-tk5rrr && git pull --ff-only
git branch -r | grep wip/          # alle gesicherten Arbeitsstände
pnpm install
```

**Hauptzweig:** `claude/game-v2-planned-tasks-tk5rrr`. Seine Spitze bei Übergabe ist
`efdabd2` plus der Commit, der diese Datei bringt. Auf ihm ist alles **geprüft**
(`pnpm verify` grün, Plan-Wächter grün). `main` steht unverändert auf `95441e0`, es
wurde nichts gemerged und kein Pull Request angelegt.

## 1 · Der Auftrag (Noahs /goal, unverändert gültig)

1. Alle offenen geplanten Punkte umsetzen (V2). → **erledigt** (Phase 1)
2. Review durch einen Sonnet-Agenten → **erledigt** (Phase 2)
3. Verbesserungslauf nach dem Review → **Doku/Test-Teil erledigt, KI-Teil in Arbeit** (§3)
4. UX-Planung mit Screenshots → **erledigt** (`docs/plan/UX-PLAN.md`, `docs/ux/before/`)
5. Review des UX-Plans → **erledigt und eingearbeitet** (UX-PLAN §9)
6. UX-Umsetzung in Paketen A–D, danach Nachher-Screenshots `docs/ux/after/`, ein
   Abgleich durch einen Sonnet-Agenten, Nachbesserung, `pnpm verify` + `pnpm acceptance`
   (Simulationszahlen unverändert), dann Merge und `WORKFLOW.md` §0 → **in Arbeit** (§4)
7. Abschlusspräsentation: eine selbstständige HTML-Datei mit 8–12 Folien, im Repo
   committet und an Noah geschickt. Inhalt: was die Sitzung erreicht hat, die
   UX-Ausgangslage mit Screenshots, Vorher-Nachher-Vergleiche, das Ergebnis des
   UX-Reviews, messbare Verbesserungen, begründete Ausnahmen, offene Punkte → **offen**

**Harte Regeln aus dieser Sitzung:**
- **Nichts löschen.** Kein `rm`, kein `git rm`, keine Codeblöcke entfernen. Was wegfallen
  soll, wird auskommentiert mit `LOESCHVERMERK (Review): <Grund>`. Die Sammelliste für
  Noahs spätere Freigabe steht in `docs/plan/LOESCHVERMERKE.md`.
- `packages/core`, `packages/ai` und `data/rules` werden von der UX-Arbeit **nicht** berührt.
- Grenzen werden nie angehoben, damit eine Zahl passt.
- Nie `--force`. Kein Pull Request ohne Noahs Wort.
- Alle weiteren Schritte sind von Noah vorab freigegeben, solange nichts gelöscht wird.

## 2 · Was fertig ist (auf dem Hauptzweig)

- **M42 Etappe 2:**
  - T-M42-08 und -09 (Zusammenlegen nach Rolle und überall), T-M42-10 (widerlegt, 0)
    und T-M42-12 (Abschlussmessung, `pnpm acceptance` 12/12) sind **done**.
  - T-M42-05 und -07 (Artillerie) sind zurückgenommen: das Band 15–30 % ist
    gegen den Öl-Wächter nicht erfüllbar, weil 5 von 8 Mächten kein Öl fördern
    (Befund M42-07-a). **Noahs Regelfrage:** soll Artillerie weiter Öl verbrauchen?
  - T-M42-04 ist zurückgestellt (Festungspatt, Befund M42-04-a).
- **Review-Umsetzung, Doku/Tests** (`ffb95a9`): Tests K6/K8–K10 und B6c,
  WORKFLOW berichtigt, `LOESCHVERMERKE.md`.
- **UX:**
  - UX-PLAN mit Review-Einarbeitung (`8e30cfb`, `d0c7bb4`), 268 Vorher-Screenshots,
    `scripts/ux-capture.mjs`.
  - Welle 0/0,5: T-M44-02 (`pnpm ux:check`) und T-M44-02b (Nahtstellen in `App.tsx`)
    in `afdbb4b`.
  - Paket D (T-M44-06, -11, -18) in `efdabd2`.

## 3 · KI-Verbesserungslauf (Review-Punkte 1, 3, 5, 8c, 9, 10, 11, T-M42-04) — UNFERTIG

Zweig **`wip/claude/improve-ai`**. Die Basis ist `ffb95a9`, deshalb muss der
Hauptzweig hineingemergt werden. Die Commits, älteste zuerst:

| Commit | Inhalt | Stand |
|---|---|---|
| `e2fde62` | T-M42-13: Festung nur an der Front (Review 10, Festungspatt) | gebaut, Messergebnis nicht dokumentiert |
| `c4c84bb`, `e0faffa`, `b856abb` | T-M42-14 H1–H3: Öl-Wächter mit Vorrats-Horizont (Review 9) | **zurückgenommen** in `7bf8f26`, drei Iterationen rissen die Kriterien |
| `7e41eda` | T-M42-05 allein auf S10 (Review 8c) | Messstand, Ergebnis offen |
| `7b14319` | T-M42-15/-16/-18: Sortierung nach Codeeinheiten, gesperrte Armeen auslassen, Zahl gemischter Armeen (Review 1, 3, 5) | gebaut |
| `1de3320` | Revert-Anteil T-M42-16 (Sperre im Merge-Pass), weil das Turnier riss | zurückgenommen |
| `8fcf67d`, `3841236`, `9f4b142` | T-M42-17: Verbände über dem Deckel teilen (Review 11). Zweite Fassung „nur abseits der Front", dann wieder „überall" | Messstand |
| `61d1477` | **WIP:** Wortlaut von AK4 in 01-REQUIREMENTS, DECISIONS, tasks.yaml und economy.ts | **ungeprüft** |

Nebenzweige derselben Gruppe (Messsonden, nicht zum Mergen):
- `wip/claude/improve-ai-buch` (`8e1516c`): T-M42-04 Buchung auf S10, Cherry-Pick
  von `0532029` **mitten in der Konfliktlösung — economy.ts und economy.test.ts
  enthalten Konfliktmarker.**
- `wip/claude/improve-ai-probe13` (`4b5cfa7`): Probe-Revert von T-M42-13, **economy.test.ts
  enthält Konfliktmarker.**
- `wip/claude/improve-ai-measure-wip`: die Ölprobe `zz-oelprobe.slow.test.ts`.
- `wip/claude/m42-08-hilfsworktree-wip`: alter Hilfs-Worktree von T-M42-08.

**Weiter so:**
1. Den WIP-Commit `61d1477` prüfen: ist der AK4-Wortlaut schlüssig, nachdem H1–H3
   zurückgenommen sind? Wahrscheinlich gehört er mit zurück.
2. Für jede gebaute Stufe (T-M42-13, -05 auf S10, -15/-18, -17) die Messung **neu
   fahren**: Turnier, `progress.slow`, neun Vollpartien, `ai-integration`. Die
   Rohausgaben der Cloud-Läufe liegen im Archiv auf `wip/messdaten-cloud-2026-10-03`.
   Behalten wird, was die Kriterien hält; alles andere wird zurückgenommen und
   dokumentiert (PROBLEME/DECISIONS, tasks.yaml mit `reopened`).
3. T-M42-04 auf dem neuen Stand nach Wahlregel D32.5 neu messen. Die Konfliktlösung
   aus `improve-ai-buch` kann als Vorlage dienen.
4. Am Ende `pnpm acceptance` 12/12. Danach `claude/improve-ai` per Merge auf den
   Hauptzweig bringen (nie force).

## 4 · UX-Umsetzung M44 — Pakete

Merge-Reihenfolge laut UX-PLAN §6: **C → B → D → A.** Jedes Paket vor dem Merge prüfen:
`pnpm verify` grün, `pnpm ux:check --only <R-UX-..>` und
`git diff --stat <Basis> -- packages/core packages/ai data/rules` leer.

| Paket | Zweig | Stand | Nächster Schritt |
|---|---|---|---|
| C Kopf/Fuß/Karte (04, 07, 10, 13, 19) | `wip/claude/m44-c` (`140cf6c`) | gebaut (`675faf3`), origin bereits hineingemergt, **Push auf den Hauptzweig fehlte** — verify vermutlich gelaufen, nicht bestätigt | verify, `ux:check`, Status in tasks.yaml prüfen, mergen |
| B Dialoge (05, 08, 09a, 15, 16) | `wip/claude/m44-b` (`5472e4a`) | gebaut in einem Commit, **noch nicht mit origin gemergt** | origin mergen, verify, `ux:check` inkl. `--mp`, mergen |
| D Texte/Panels (06, 11, 18) | Hauptzweig `efdabd2` | **done** | T-M44-09b (Krieg erklären/Bündnis aufkündigen mit dem ConfirmButton aus B) bauen, sobald B gemergt ist |
| A Layout (03a, 12, 14, 17, 03b) | `wip/claude/m44-a` (`9c65f96`) | **WIP, ungeprüft**: T-M44-03a angefangen (touch.css-Hochformat, `OrientationHint.tsx`, `portrait.touch.test.tsx`, Schwellen) | 03a fertigbauen, dann 12 → 14 → 17 → 03b; als Letzter mergen |

**Hinweise:**
- Den Fehler „Escape im Menü schließt das Provinzpanel, danach erzeugt Tempo 100
  *Maximum update depth exceeded*" bearbeitet Noah in einer eigenen Sitzung; die Pakete
  lassen ihn aus.
- Die Statuszeilen in `tasks.yaml` sind für B und C noch `todo`, solange ihre Zweige
  nicht gemergt sind. Prüfe, ob die Zweige sie selbst auf `done` setzen.
- Nach allen Paketen in dieser Reihenfolge:
  1. T-M44-20 (Leistung, bedingt) allein auf ruhiger Maschine.
  2. T-M44-21: `pnpm ux:capture --out docs/ux/after`, ohne 1920er-Bilder.
  3. Abgleich mit dem UX-PLAN durch einen Sonnet-Agenten, dann Nachbesserung.
  4. `pnpm verify` und `pnpm acceptance`, mit unveränderten Simulationszahlen gegen
     den KI-Endstand aus §3.
  5. Erst dann `WORKFLOW.md` §0 richten.

## 5 · Sonstiges

- **Wächter-Routine** „WorldWar Wächter" (`trig_01CEnq7HpiWBCVk7FSJCjb5d`) ist deaktiviert.
  Sie hat nur diese Cloud-Sitzung beobachtet.
- **Offene Fragen an Noah:**
  - M42-07-a: soll Artillerie weiter Öl verbrauchen?
  - AK-9: Partie zu zweit mit einem echten Menschen.
  - Kippbare Orchestrator-Entscheide in DECISIONS 2026-10-02/03: F6-Playtest
    verschoben, Option (c), F1–F3 der UX, Playwright als Messwerkzeug.
- **Plandatei fehlt:** `m18-plan-v2.md` war nie im Repo (Befund M42-PL-a). Die
  Plansonden K1–K9 sind durch Slow-Suites ersetzt.
- **Messdaten:** `wip/messdaten-cloud-2026-10-03` enthält
  `messwerte-cloud-2026-10-03.tgz` (28 MB) mit dem Scratchpad aller Agenten und
  `docs/research/_raw`. Der Name in der README dort ist falsch geschrieben, gemeint
  ist diese Datei.
