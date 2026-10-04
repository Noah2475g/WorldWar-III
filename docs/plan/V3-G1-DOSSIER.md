# V3 · Gate G1 — Noahs Entscheide (Dossier, 2026-10-04)

> Grundlage: `docs/reports/v3/leistung-ausgang.md` (Rechnerfenster P0-W), P0-B1 (56 Bilder,
> `docs/ux/v3-before/`), P0-B2 (`docs/ux/v3-before/aufgaben.json`, 16 Läufe). Noahs Playtest liegt
> noch nicht vor. Jede Frage: Lage · **Empfehlung** · verworfene Alternative mit Grund.
> Antwort genügt als Liste „1 ja, 2 ja, …“ oder mit Abweichung.

## Was die Messung gezeigt hat (in drei Sätzen)

1. **Die KI aus Etappe 2 ist nicht das Problem:** bis zur Entscheidung braucht jeder der vier Stände
   höchstens 9,1–9,3 ms je Tick (Budget 10 ms). Der alte Wert 18,6 ms stammte aus den Ticks **nach** dem
   Sieg (24–32 ms) und aus der Parallellast in `acceptance`.
2. **Im Browser hält Tempo 100 im Spätspiel nicht:** Stand Tag 575 läuft am Bündel mit **29,9 statt 100
   Ticks/s** (Tag 300: 91,6). Headless kostet derselbe Stand ~11 ms je Tick — davon 48 % KI, vor allem
   `threat.ts` (`distances` 24 %, `threatMap` 13 %). Rund zwei Drittel der Zeit im Browser frisst die Hülle.
3. **UX:** am Desktop liegen alle acht Handlungen am Klick-Minimum (2–5 Klicks). Die echten Lücken sind
   das **Telefon** (Kopfleiste 1561 px in 375 px Breite; Tempo, Menü, Alarmchip unerreichbar) und die
   **Tastatur** (19–60 Tasten je Handlung, Armee bewegen 46 statt 5; Armeen sind nur Canvas-Pixel).

---

### Frage 1 · Zielwert Leistung

Lage: S575 am Bündel 29,9 Ticks/s; headless ≤ 9,3 ms bis zur Entscheidung (Langlauf), ~11 ms an S575.

**Empfehlung: Tempo 100 hält am Bündel an S300 und S575 (≥ 98 Ticks/s, 10 s, wie die Uhr an der exe
gemessen), und der Langlauf bleibt vor der Entscheidung in jedem 50-Tage-Fenster ≤ 10 ms je Tick.**
Neue Anforderung `R-PERF-01`; Rücknahme: verfehlt Welle 1 das Ziel, kommt das Ergebnis mit Zahl zurück
an dich (Frage 3 neu), die Grenze wird nicht gesenkt.

*Verworfen: ein weicheres Ziel (z. B. „≥ 60 Ticks/s an S575“).* Tempo 100 ist eine Zusage (R-TIME-02);
ein Ziel unter der Zusage hieße, die Grenze an die Zahl anzupassen — genau das verbietet Regel 2.
Ob 98 erreichbar ist, wissen wir erst nach Welle 1; dann entscheidest du mit Zahlen, nicht jetzt auf Verdacht.

### Frage 2 · Nur verhaltensgleiche Optimierungen?

Lage: Die teuren Stellen (`threat.ts` je Tick neu berechnet, Hülle zeichnet/leitet je Tick ab) lassen
sich ohne Verhaltensänderung angehen; Beleg billig über Spätspiel-Hash + Golden Master + Turnierbericht.

**Empfehlung: In Welle 1 nur verhaltensgleiche Änderungen.** Verhaltensändernde (z. B. „KI denkt in
ruhigen Provinzen seltener“, T-M45-06) erst, wenn Welle 1 das Ziel aus Frage 1 verfehlt — dann mit
voller Messkette (Turnier, `progress.slow`, 9/9 Vollpartien, Haltung) und erneut deinem Wort.

*Verworfen: KI-Denktakt sofort drosseln.* Er trifft nur die KI-Hälfte von ~11 ms, nicht die ~20 ms der
Hülle; und er ändert das Spiel, was die ganze Messkette (Stunden) und eine Balance-Frage auslöst — hoher
Preis für den kleineren Hebel.

### Frage 3 · Simulation in einen Web Worker (T-M10-02)?

Lage: Ein Worker nimmt die Rechnung vom Zeichen-Thread (weniger Ruckler), macht sie aber nicht billiger.

**Empfehlung: Nein in V3.** Erst Hülle und `threat.ts` (Welle 1). Bleiben danach Bilder > 50 ms bei
erreichtem Tick-Ziel, wird der Worker ein eigener Plan.

*Verworfen: Worker jetzt.* Großer Umbau (Zustand über Threadgrenze, Speichern, Mehrspieler), damals
begründet zurückgenommen, und er löst das gemessene Problem nicht: an S575 fehlen Ticks, nicht nur glatte Bilder.

### Frage 4 · Zuschnitt Welle 1 (Leistung) — angepasst an die Messung

**Empfehlung, in dieser Reihenfolge der Wirkung:**
1. **T-M45-04 Hülle** (Bahn P-Hülle): Neuzeichnen/Ableiten nur bei geänderter Sicht, Zeitbudget je Frame — größter Hebel (~⅔).
2. **T-M45-01 neu zugeschnitten auf `threat.ts`** (Bahn P-KI): `distances`/`threatMap` einmal je Tick bzw.
   nur bei Änderung — statt der ursprünglichen Etappe-2-Pässe, die nur 0,25-mal je Tick laufen.
3. **T-M45-03 Kern-Hotspots** (Bahn P-Kern): `combat`, Allokationen `cloneProvince`/`cloneArmy`/`emit`.
4. T-M45-02 Wegesuche nur, wenn das Profil nach 1–3 `planRoute` noch vorn zeigt; T-M45-05 Bündel-Aufteilung
   (1,8 MB-Chunk) zuletzt, Ladezeit wurde noch nicht am Bündel gemessen.

*Verworfen: der Katalog wie geplant (KI-Pässe zuerst).* H-P1 ist widerlegt; T-M45-01 in alter Form
optimiert Code, der im Profil nicht vorkommt.

### Frage 5 · Zeit nach dem Sieg

Lage: Nach dem Sieg hält das Spiel an; wer den Siegdialog bestätigt, spielt weiter — dort 24–32 ms je
Tick (Sieger-KI wächst weiter), Tempo 100 hält dann nicht.

**Empfehlung: kein Ziel für die Zeit nach dem Sieg in V3**; nur als Befund in `PROBLEME.md` vermerken.

*Verworfen: auch dort ≥ 98 Ticks/s zusagen.* Das ist ein Randfall außerhalb der eigentlichen Partie und
würde Welle 1 um die teuerste Phase (riesige Siegermacht) verlängern, ohne dass ein Spieler es im Normalfall erlebt.

### Frage 6 · UX-Auswahl (Welle 2) und Reihenfolge

Regel: nichts ohne Messbefund. **Empfehlung (6 Aufgaben):**

| # | Aufgabe | Befund (Top-10-Rang) | Prüfung nachher |
|---|---|---|---|
| 1 | **T-M46-10 neu: Telefon-Layout** — Kopfleiste umbrechen/Überlauf-Menü, Seitenleiste ausklappbar, Protokoll mit Filter | 1, 2, 3 (HOCH) | 375x667: alle Kopfknöpfe sichtbar, Panel ≥ 50 % Höhe |
| 2 | **T-M46-01 Heerübersicht** — Armeen als Liste mit Namen, Sprung zur Karte, Marschziele nur erreichbare/gruppiert | 5, 7 | Lauf „Armee bewegen“ per Tastatur < 15 Tasten |
| 3 | **T-M46-05 Tastenkürzel** für die acht Handlungen + Tab-Reihenfolge (Liste vor Protokoll) | 4, 9 | jede Tastatur-Handlung halbiert |
| 4 | **T-M46-06 Diplomatie-Übersicht** — Aktionen über dem Falz, Handel kompakt | 8 | 0 Bildläufe je Handlung bei 1280x800 |
| 5 | **T-M46-11 neu: Rückmeldung „befohlen“** bleibt ≥ 1,5 s unabhängig vom Tempo; Aufstandshinweise zu einer Zeile | 6, 10 | Rückmeldung bei Tempo 100 messbar sichtbar |
| 6 | **T-M46-08 gekürzt** — Kontrast ist entschieden (kein Verstoß), bleibt: Alarmchip im Mehrspieler mit #1 mitprüfen | M44-Rest | Alarmchip im `--mp`-Lauf sichtbar |

*Verworfen: T-M46-03 Kartenlesbarkeit, T-M46-04 Mehrfachauswahl, T-M46-07 Ladezustand, T-M46-02 Protokoll
am Desktop.* Für keine gibt es einen Messbefund: Laden eines großen Standes hat keine lange Aufgabe > 115 ms,
die Mauswege liegen am Minimum, die Karte wurde nicht als überladen gemessen. Sie bleiben auf `todo` mit
`reopened`-Text „kein Befund in P0-B; wieder auf, wenn der Playtest einen liefert“.

### Frage 7 · Warten auf deinen Playtest?

**Empfehlung: Nicht warten.** Welle 1 (Leistung) hängt nicht am Playtest; spiel ihn während Welle 1
(45–60 min, `docs/PLAYTEST-V3.md`). Deine Funde werden T-M46-09 und kommen vor Welle 2 dazu.

*Verworfen: G1 bis zum Playtest anhalten.* Er wurde zweimal verschoben; Welle 1 bräuchte ihn nicht, und
Warten kostet Tage ohne Erkenntnis für die Leistung.

---

**Nach deinem Wort:** DECISIONS-Eintrag, Aufgaben T-M45-xx/T-M46-xx in `tasks.yaml` und `03-TASKS.md`,
`R-PERF-01` in `01-REQUIREMENTS.md`, `plan-consistency` + `coverage:requirements` grün, dann Welle 1 mit drei Bahnen.
