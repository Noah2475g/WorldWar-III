# LEVEL-UP 3 — der Feinschliff nach dem Spielen (2026-09-08)

> Der dritte Plan derselben Methode: Analyse → Anforderungen → Entwurf → Aufgaben.
> **Haltepunkt vor der Ausführung:** Noah spielt gerade den frischen Stand und gibt
> danach Feedback — das ist der wichtigste Input dieser Runde, und Bauarbeit während
> er spielt würde sein Spiel per Hot-Reload unter ihm neu laden. Gebaut wird, sobald
> sein Feedback da ist; seine Befunde werden als T-M28-06+ ergänzt.

## 1 · Analyse: was nach LEVEL-UP 2 offen ist (aus eigener Sichtprüfung, ohne Neuleserei)

Alle 17 V2-Playtest-Befunde sind adressiert bis auf zwei bewusst kleine (V2-12,
V2-16: das opt-in-Debug spricht Rohbezeichner). Aus der heutigen Sichtprüfung und
dem Debugging kamen vier neue, belegte Beobachtungen:

1. **Die Machtverlauf-Kurve ist bei kurzer Aufzeichnung unlesbar** — acht Tage
   Historie ergeben flache, am Rand gedrängte Linien: die Y-Skala beginnt bei 0,
   die Punktestände (2 800–10 000) nutzen das obere Fünftel.
2. **Die Befehls-Quittung der Zielwahl ist unsichtbar** — sie hängt per `actionId`
   am „Marsch befehlen"-Knopf, der nach dem Bestätigen verschwindet
   (`setTargeting(null)`). Der Spieler sieht nach dem Klick *nichts* — genau das
   Loch, das T-M22-05 schließen sollte, nur einen Pfad weiter.
3. **Das Programm ist alt:** `worldwar.exe` wurde gegen `75a0128` gebaut — seither
   StrictMode-Fix und die komplette Grafikrunde; die AK-8-Messung beschreibt sogar
   noch `1c33ec7`.
4. **„Wohin gehen meine Rohstoffe" bleibt unbeantwortet** (v1-Befund 15, nie
   adressiert): die Spalte Unterhalt führt nur den Armeeunterhalt; Bau- und
   Aushebungskosten erscheinen in keiner Übersicht — mit den neuen Sparklines
   sichtbarer denn je, weil der Bestand sichtbar fällt, ohne dass eine Spalte sagt
   warum.

**Nächste große Achse danach:** M17 „Tiefe zwischen den Kriegen" (Spionage,
Handelsangebote) — bewusst erst nach Noahs Feedback-Runde planen.

## 2 · Anforderungen (bestehende R-IDs, verfeinert)

- **T-M28-01 → R-UI-13:** der Verlauf ist auch bei kurzer Historie lesbar.
- **T-M28-02 → R-UI-05:** *jeder* Befehlsweg quittiert sichtbar — auch die Zielwahl.
- **T-M28-03 → R-PKG-01/R-PKG-02:** das ausgelieferte Programm entspricht dem
  abgenommenen Stand; AK-8 ist am aktuellen Bündel gemessen.
- **T-M28-04 → R-UI-07:** auch die Debug-Ansicht spricht Deutsch mit Namen.
- **T-M28-05 → R-UI-05/R-UI-13:** die Wirtschaft beantwortet, wohin Rohstoffe gehen.

## 3 · Entwurf (D26, Kurzform)

- **D26.1 Kurvenskala:** LineChart skaliert Y von `min − Rand` bis `max + Rand`
  statt ab 0; unter drei Aufzeichnungspunkten zeigt das Panel den ehrlichen
  Wartesatz statt einer Pseudokurve; Endwert-Beschriftung je Linie am rechten Rand.
- **D26.2 Zielwahl-Quittung:** die Quittung wandert vom verschwindenden
  Bestätigungsknopf in die Armee-Statuszeile („Marsch befohlen — wirkt beim
  Weiterlaufen"), gespeist aus derselben `pendingCommands`-Sammlung; Test am
  gerenderten Baum über den vollen Zielwahl-Weg.
- **D26.3 Frisches Bündel:** Tauri-Bau bei unangefasster Quelle gegen den
  Endstand, dann die AK-8-Messung (starten, speichern, schließen, neu starten,
  laden) am neuen Bündel; `packaging.md` mit Stand-Stempel.
- **D26.4 Debug mit Namen:** die Debug-Texte der KI ersetzen `p2`/`money` durch
  Machtnamen und Rohstoffnamen aus derselben Quelle wie die übrige Oberfläche;
  der Umlaut-Wächter deckt die Debug-Strings mit ab.
- **D26.5 Verbrauchsspalte:** die Wirtschaftstabelle führt neben Unterhalt einen
  Tagesabfluss „Ausgaben" (Bau + Aushebung + Markt des Tages, aus denselben Zahlen
  wie der Tagesbericht); die Bilanzspalte stimmt damit wieder mit der sichtbaren
  Bestandskurve überein.

## 4 · Aufgaben (M28 in tasks.yaml; Ausführung nach Noahs Feedback)

| ID | Titel | Quelle |
|---|---|---|
| T-M28-01 | Die Kurve wird bei jeder Historienlänge lesbar | Sichtprüfung 2026-09-08 |
| T-M28-02 | Auch die Zielwahl quittiert sichtbar | Debugging 2026-09-08 |
| T-M28-03 | Frisches Bündel, AK-8 am echten Stand gemessen | offener Punkt seit M22 |
| T-M28-04 | Die Debug-Ansicht spricht Namen | V2-12 |
| T-M28-05 | Die Wirtschaft sagt, wohin die Rohstoffe gehen | v1-Befund 15 |
| T-M28-06+ | **Noahs Spiel-Feedback** — wird nach dem Spielen ergänzt | Noah |

**DoD wie im Haus:** Test zuerst, der ohne die Reparatur fällt; `pnpm verify` grün;
`pnpm acceptance` (jetzt ~6,5 min) am Ende der Runde; PROGRESS-Einträge.
