# LEVEL-UP 2 — Grafik statt Text (2026-09-08)

> Noahs Auftrag nach der V1-Abnahme: *„wir wollen noch mehr weg vom Text und eher auf
> Grafiken setzen."* Fünf Vorschläge vorgelegt, **Noah hat alle fünf gewählt (A–E)**.
> Methode wie beim ersten LEVEL-UP: Analyse → Anforderungen → Entwurf → Aufgaben.
> Die Aufgaben stehen als **M25, M26, M27** in `tasks.yaml` und `03-TASKS.md`.

---

## 1 · Analyse: wo das Spiel heute Text ist, obwohl die Daten Bilder hergeben

Aus dem Playtest V2 und dem Code:

- **„Gewinne ich?" ist eine Tabelle.** Das Lage-Panel zeigt Punktebalken je Macht —
  aber keinen **Verlauf**. Ob man aufholt oder zurückfällt, die spannendste Kurve des
  Spiels, existiert nirgends. Es gibt auch **keine Aufzeichnung**: die Sicht kennt nur
  das Jetzt.
- **Die Wirtschaft ist eine Zahlenkolonne** (7 Rohstoffe × 5 Spalten). Trends
  (Öl sinkt seit Tag 12) muss man sich merken. Der neue Tagesbericht (T-M24-01)
  nennt Bilanzen als Text.
- **Die Karte kennt Bewegung nur als gestrichelte Linie** ohne Richtung und ohne
  Fortschritt; Kämpfe sind ein pulsierender Ring (`ringRadius` existiert), Besitzwechsel
  ein harter Farbsprung.
- **Das Gefecht ist ein Satz** („Gefecht entschieden — niemand behauptet das Feld.
  Verluste: X, Y"), obwohl der Kern Stärken, Verluste, Gelände und Festung kennt.
- **Die Diplomatie wohnt nur in einer Tabelle**, obwohl `PublicView.relations` je
  Macht Zustand und Dauer führt und die Karte vier Modi hat (`MAP_MODES`), die per
  Taste M zyklieren.

**Technische Leitplanken** (aus den bestehenden Wächtern):
- Keine Fremdbibliothek fürs Zeichnen — eigene SVG/Canvas-Komponenten im
  Lagekarten-Stil (`tokens.ts`; Zinnober nur als Signal).
- Die Seitenleiste darf nicht wieder querscrollen (Wächter aus T-M22-02).
- Das Zeichenbudget gilt weiter (p95 gegen 16,7 ms, `render.bench`).
- `prefers-reduced-motion` schaltet gewollte Bewegung ab (Muster existiert).
- Kern bleibt unangetastet, wo es geht — Golden-Master-Schutz; die Zeitreihe ist
  Sache der Hülle.

## 2 · Anforderungen (bestehende R-IDs, verfeinert)

- **A (Machtverlauf) → R-UI-13** „Der Stand der Partie ist ablesbar": jetzt auch als
  Verlauf — wer führt, wer holt auf, seit wann.
- **B (Wirtschaft) → R-UI-05/R-UI-13**: Trend und Bilanz je Rohstoff sind ohne Lesen
  einer Zahlenkolonne erkennbar; der Tagesbericht zeigt Deltas als Balken.
- **C (Karte) → R-MAP-05/R-UI-16/R-UI-17**: Bewegung hat Richtung und Fortschritt,
  Kampf und Eroberung sind als Ereignis auf der Karte sichtbar.
- **D (Gefecht) → R-BAT-05/R-UI-10**: der Kampfbericht zeigt Stärke, Verluste und
  Umstände beider Seiten grafisch.
- **E (Beziehungen) → R-MAP-06**: ein fünfter Kartenmodus färbt die Welt nach der
  eigenen Beziehung (eigen/verbündet/Frieden/Krieg/unbekannt), mit Legende, per
  Taste M erreichbar.

## 3 · Entwurf (D25 — Kurzform, Details je Aufgabe)

- **D25.1 Zeitreihe:** Die Hülle zeichnet am Tageswechsel auf (derselbe Effekt-Ort
  wie der Tagesbericht): Punkte je bekannter Macht, eigene Bestände und Bilanzen.
  Ringpuffer mit Deckel (~400 Tage × 8 Mächte, ein paar KB), lebt im UI-Zustand und
  wird **je Spielstand-Slot** in IndexedDB mitgeführt (best effort: ein alter Stand
  ohne Aufzeichnung startet die Kurve am Ladetag — der Leerzustand sagt das ehrlich).
- **D25.2 Diagramm-Bausteine:** eine kleine eigene SVG-Komponentenfamilie
  (`ui/charts/`): `LineChart` (Machtverlauf, Spielerfarben aus `tokens.ts`, Legende,
  aria-Beschreibung mit Endwerten), `Sparkline` (7-Tage-Fenster), `DeltaBar`
  (±-Balken, grün/zinnober, Null als Strich). Tabellenzellen bleiben schmal.
- **D25.3 Marschpfeile:** je bewegter Armee die Route als Pfad mit Pfeilspitze;
  der zurückgelegte Anteil (aus Abmarsch-/Ankunftstick) gefüllt, der Rest blass.
  Eigene Armeen Tinte, fremde in Spielerfarbe. Ersetzt die gestrichelte Linie.
- **D25.4 Kartenereignisse:** Besitzwechsel läuft als kurze Farbwelle (~600 ms,
  Provinzfläche blendet von alt nach neu); Kampfzonen behalten den Ring, bekommen
  aber Intensität nach Gefechtsgröße. `prefers-reduced-motion` → sofortiger Wechsel.
- **D25.5 Beziehungsmodus:** `MAP_MODES` + `'relations'`; Farben aus einer eigenen
  kleinen Palette (eigen = Gold des Spielers, verbündet = gedecktes Grün, Frieden =
  Leinen, Krieg = Zinnober-Ton, unbekannt = Nebelgrau) — ΔE-geprüft wie die
  Spielerfarben; Legende nennt alle fünf; die Diplomatie-Tabelle bleibt.
- **D25.6 Gefechtsbild:** der Protokolleintrag eines Gefechts bekommt einen
  aufklappbaren Körper (Muster Tagesbericht): zwei Stärkebalken (vorher → nachher,
  Verlust als zinnoberner Abschnitt), Zeichen für Gelände, Festung, Eingrabung,
  Rückzugssperre. Datenquelle: die BATTLE-Ereignisse plus Sicht zum Ereigniszeitpunkt;
  fehlt eine Angabe im Ereignis, wird sie dort ergänzt, ohne Hash-Bruch (additive
  Felder), sonst Entscheid dokumentieren.

## 4 · Aufgaben (Zwilling in tasks.yaml; Reihenfolge = Baureihenfolge)

| ID | Titel | Vorschlag |
|---|---|---|
| T-M25-01 | Die Partie bekommt ein Gedächtnis (Zeitreihe je Spieltag) | A/B |
| T-M25-02 | Der Machtverlauf wird eine Kurve | A |
| T-M25-03 | Die Wirtschaft zeigt Trend und Bilanz als Bild | B |
| T-M25-04 | Der Tagesbericht bekommt Balken | B |
| T-M26-01 | Märsche werden Pfeile mit Fortschritt | C |
| T-M26-02 | Kampf und Eroberung sind auf der Karte sichtbar | C |
| T-M26-03 | Der fünfte Kartenmodus: Beziehungen | E |
| T-M27-01 | Das Gefecht sammelt seine Zahlen für die Anzeige | D |
| T-M27-02 | Das Gefecht zeigt sich: Stärkebalken und Zeichen | D |

**Definition of Done je Aufgabe:** Test zuerst, der ohne die Reparatur fällt;
`pnpm verify` grün; Zeichenbudget-Bench nach M26 nachgemessen; PROGRESS.md-Eintrag.
