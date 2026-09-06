---
type: plan
status: draft
projekt: WorldWar
stufe: Ausführungsprotokoll
created: 2026-09-02
---

# AGENT-EXECUTION — Protokoll für den umsetzenden Agenten

> **Du liest das hier, weil du den Plan umsetzen sollst.** Dieses Dokument sagt dir *wie du
> arbeitest*. Was gebaut wird, steht in `01-REQUIREMENTS.md`; wie es gebaut wird, in
> `02-DESIGN.md`; in welcher Reihenfolge, in `03-TASKS.md` / `tasks.yaml`.

## 0. Startsequenz (einmal pro Sitzung)

1. Lies `C:\Users\noahh\Documents\Vaults\Claude\START-HERE.md` und `SESSION-STATE.md`
   (Noahs Wissensspeicher, Pflicht laut Projektvorgabe).
2. Lies in dieser Reihenfolge: `01-REQUIREMENTS.md` → `02-DESIGN.md` → `03-TASKS.md`.
3. Lies `docs/research/SUPREMACY-MECHANICS.md` (Mechanik-Referenz des Originals), sofern
   vorhanden — sie ist die Quelle für Balancing-Zahlen.
4. Öffne `tasks.yaml` und wähle die nächste Aufgabe (siehe §1).
5. Wenn `docs/plan/PROGRESS.md` existiert, lies zuerst dort den letzten Eintrag.

## 1. Auswahl der nächsten Aufgabe

Nimm die **erste** Aufgabe in `tasks.yaml`, die alle drei Bedingungen erfüllt:
- `status: todo`,
- alle IDs unter `deps` haben `status: done`,
- `gate` ist nicht gesetzt **oder** die Freigabe liegt schriftlich vor.

Bei mehreren möglichen Aufgaben: die mit der niedrigsten ID zuerst. Arbeite **eine** Aufgabe
zu Ende, bevor du die nächste beginnst.

## 2. Arbeitszyklus je Aufgabe (verbindlich)

```
1. status: in_progress in tasks.yaml setzen
2. Tests schreiben, die die genannten Akzeptanzkriterien prüfen   → Lauf muss ROT sein
   (Testname beginnt mit der Anforderungs-ID, z. B. 'R-BAT-07 …')
3. Minimal implementieren                                          → GRÜN
4. Aufräumen: Namen, Doppelungen, tote Zweige
5. pnpm verify                                                     → muss durchlaufen
6. Commit (siehe §5)
7. status: done setzen, Zeile in docs/plan/PROGRESS.md ergänzen
```

**Verboten:**
- Produktionscode schreiben, bevor ein fehlschlagender Test existiert.
- Einen Test „grün machen“, indem die Erwartung an die Implementierung angepasst wird, ohne
  dass die Anforderung sich geändert hat.
- Tests überspringen, `.skip`, `.only` oder auskommentierte Erwartungen im Commit.
- Balancing-Zahlen im Code statt in `data/rules/**` (Design D-08).
- `Math.random`, `Date.now`, `fs`, Netzwerkzugriffe in `packages/core` (Guard bricht sonst).
- Abhängigkeiten hinzufügen, die Geld kosten, ein Konto verlangen oder nach außen funken.

## 3. Wenn du nicht weiterkommst

| Lage | Vorgehen |
|---|---|
| Test bleibt rot, Ursache unklar | Höchstens drei ernsthafte Versuche. Danach: kleinsten reproduzierbaren Fall isolieren, Befund in `docs/plan/PROBLEME.md` notieren, Aufgabe auf `status: blocked` setzen, mit der nächsten unabhängigen Aufgabe weitermachen. |
| Design ist an einer **Randstelle** unvollständig (Benennung, Aufbau, Reihenfolge im Kleinen) | Entscheide selbst nach dem Geist des Designs, setze um, trage es mit Begründung in `docs/plan/DECISIONS.md` ein. Nicht anhalten. |
| Eine **Spielregel oder Formel** fehlt (Kampf, Moral, Wirtschaft, Bewegung) | Nicht frei erfinden: erst in `docs/research/SUPREMACY-MECHANICS.md` nachschlagen, dann in D6.8/D6.9 prüfen. Findet sich nichts, setze einen begründeten Wert, markiere ihn in `docs/plan/BALANCING.md` als *geschätzt* und notiere ihn in `DECISIONS.md`. Solche Werte prägen das Spielgefühl — sie gehören sichtbar dokumentiert, nicht versteckt im Code. |
| Anforderung erweist sich als undurchführbar | Nicht stillschweigend abweichen: Befund in `docs/plan/PROBLEME.md`, dann Noah fragen (§4). |
| Balancing-Zahl fehlt in der Recherche | Begründet schätzen, in `docs/plan/BALANCING.md` als *geschätzt* markieren, weiterarbeiten. |
| Ein Werkzeug/Paket fehlt | Freie Pakete darfst du ohne Rückfrage installieren. Alles mit Kosten, Konto oder Datenabfluss: fragen. |

## 4. Wann du Noah fragst (und nur dann)

1. **Haltepunkte** (`gate: true` in `tasks.yaml`): T-M9-01 (Geodaten-Download),
   T-M10-01 (Design-Freigabe), T-M12-03 (Abnahme).
2. Wenn eine Anforderung geändert oder gestrichen werden müsste.
3. Wenn eine Aufgabe Geld, ein Konto oder eine Netzwerkverbindung nach außen erfordert.
4. Wenn du zwei Wege siehst, die das Spielgefühl deutlich unterschiedlich prägen.

In allen anderen Fällen: entscheiden, umsetzen, dokumentieren. Fragen sind auf Deutsch zu
stellen, kurz, mit Empfehlung.

## 5. Commits und Versionsverwaltung

- Repository liegt unter `C:\Users\noahh\Desktop\Claude-Projekte\WorldWar`.
  **Falls noch kein Git-Repository existiert:** `git init`, Branch `main`, erster Commit
  „chore: initial project plan“.
- Ein Commit je abgeschlossener Aufgabe. Titel auf Englisch, mit Aufgaben-ID:
  `feat(core): T-M3-02 province production per tick`
- Kein Push ohne Aufforderung (es gibt kein Fernarchiv). Kein Force-Push, kein Merge auf
  `main` ohne Ansage.
- Arbeitszweig je Meilenstein: `m3-economy`, `m4-combat`, …

## 6. Fortschritt und Übergabe

- `docs/plan/PROGRESS.md`: je erledigter Aufgabe eine Zeile —
  `T-M3-02 · 2026-09-05 · Produktion umgesetzt · 14 Tests · verify grün`.
- **Am Sitzungsende (höchste Priorität):** `SESSION-STATE.md` im Vault aktualisieren —
  Stand, offene Aufgabe, nächster Schritt. Erst danach alles Weitere.
- Bei Fehlern, Fehlschlägen oder Korrekturen durch Noah: Eintrag in
  `99_Meta/Lessons Log.md` im Vault und `/learn` ausführen (Vault-Konvention §7).

## 7. Qualitätsschwellen, die nie unterschritten werden

| Schwelle | Wert | Prüfung |
|---|---|---|
| Testabdeckung Kern | ≥ 90 % Zeilen | `pnpm coverage` (leere Pakete ausgenommen) |
| Testabdeckung gesamt | ≥ 80 % | `pnpm coverage` |
| Anforderungen mit Test | 100 % der V1-IDs | `pnpm coverage:requirements` — **eigenes Tor, nicht Teil von `verify`**; erst in T-M12-03 verpflichtend grün |
| Tick-Rechenzeit | Median < 3,5 ms, p99 < 8 ms auf der **ausgelieferten** Weltkarte (237 Provinzen, 12 Mächte) | `pnpm test:slow` → `worldmap.bench.slow.test.ts`, Messwert in `docs/reports/worldmap-bench.json`. Die Zahl ist am 2026-09-06 nachgemessen und ersetzt die nie nachgerechneten 0,5 ms (DECISIONS.md); der kleine Bench an 12 Provinzen ist eine Frühwarnung, keine Abnahme |
| KI-Rechenzeit | ≤ 30 % der Tickzeit | `pnpm bench` + Budget-Test |
| Guards | alle grün | `pnpm verify` |

`pnpm verify` enthält **keine** lang laufenden Prüfungen. Turniere und Tausend-Tage-Läufe tragen
das Tag `@slow` und laufen über `pnpm test:slow` — verpflichtend in T-M8-03, T-M9-04, T-M12-01
und T-M12-03.

## 8. Umgang mit dem Spielgefühl

Grüne Tests sind notwendig, aber nicht hinreichend. Nach den Meilensteinen **M5** (Kernregeln
stehen) und **M9** (Weltkarte) läufst du je einen Langlauf und liest die Kennzahlen gegen:
Wächst eine Wirtschaft ins Unendliche? Endet jede Partie in denselben 20 Spieltagen? Gewinnt
immer dieselbe Nation? Auffälligkeiten gehören in `docs/reports/` und ins Balancing, nicht in
den Code.

## 9. Sprache

Dokumentation, Berichte, Commit-Beschreibungen im Fließtext und alle Texte für Noah: **Deutsch**.
Bezeichner im Code, Dateinamen, Commit-Titel: **Englisch**. Spieltexte in der Oberfläche:
Deutsch, ausschließlich über `i18n/de.json`.
