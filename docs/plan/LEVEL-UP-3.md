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

---

## 5 · T-M28-07 — Analyse: was an „Angriff und Verteidigung führen sich selbst aus" wirklich fehlt

> **Stand 2026-09-11.** Diese Analyse ist der *Auftrag* von T-M28-07; gebaut wird hier
> nichts. Sie beantwortet die Frage, die die Aufgabe stellt: die Haltungen existieren im
> Kern — was fehlt konkret?

### 5.1 Der Befund, und er ist grösser als erwartet

**Das Gefecht selbst läuft längst von allein.** Zwei Armeen im Krieg, die in derselben
Provinz stehen, kämpfen ohne jeden Befehl: `phases/combat.ts` sammelt je Tick alle
Seiten und rechnet die Runde. Niemand muss „angreifen" drücken.

**Aber:** von den drei Haltungen wirkt genau **eine**, und die dritte gar nicht.

| Haltung | Wo sie im Kern gelesen wird | Wirkung |
|---|---|---|
| `defensive` | `phases/combat.ts:98` | Nur zusammen mit „steht still": die Seite gilt als Verteidiger, rechnet mit Verteidigungswerten und schlägt nicht zurück |
| `retreat` | `phases/retreat.ts:34` | Die Armee weicht aus, verliert Trefferpunkte, bekommt Sperren — und fällt danach selbst auf `defensive` zurück |
| **`aggressive`** | **nirgends** | **Keine.** Ausser der Typdeklaration in `state/types.ts:47` kommt der Wert im ganzen Kern und in der KI nicht vor |

Das heisst: der Knopf „Angriff" im Armeepanel schaltet einen Zustand, den kein Rechenweg
je ansieht. Er ist heute nur die Abwesenheit von `defensive` — was zufällig etwas tut
(die Armee gilt nicht als eingegrabener Verteidiger), aber nicht das, was sein Name
verspricht. **Das ist der eigentliche Befund hinter Noahs Satz**, und er ist genau die
Fehlerklasse, die dieses Projekt schon dreimal gefangen hat: eine Zusage, die nie ans
Erzeugnis gebunden wurde.

### 5.2 Was Noah meint, ist Bewegung, nicht Kampf

Das Mikromanagement liegt nicht im Gefecht, sondern **davor und danach**: jede Armee
steht, bis ein Mensch ihr einen Marschbefehl gibt. Fällt eine Nachbarprovinz, marschiert
niemand hin. Weicht ein geschlagener Gegner aus, verfolgt ihn niemand. Die KI kann
beides (`packages/ai/src/threat.ts` rechnet eine Bedrohungskarte, `military.ts` erzeugt
daraus Marschbefehle) — **der Spieler hat dieselbe Rechnung nicht.**

### 5.3 Entwurf D28 — die Haltung wird ein Auftrag

Drei Bausteine, aufsteigend nach Kern-Beteiligung. Jeder ist für sich nützlich.

- **D28.1 `aggressive` verfolgt.** Eine stehende Armee in Haltung „Angriff", deren
  Gegner im selben Tick aus der Provinz gewichen ist (`ARMY_RETREATED` aus dieser
  Provinz, Ziel bekannt), erhält einen Marschbefehl dorthin — **über dieselbe
  Kommandoschiene wie ein Spielerklick**, nicht als Sonderweg in der Bewegungsphase.
  Damit gilt R-AI-01 auch hier: was die Automatik kann, kann der Spieler auch, und
  umgekehrt.
- **D28.2 `defensive` deckt.** Eine stehende Armee in Haltung „Verteidigung" marschiert
  selbsttätig in eine **angrenzende eigene** Provinz, in die eine kriegführende fremde
  Armee eingedrungen ist (`ARMY_INTRUDED`, T-M28-06 — das Ereignis dafür gibt es seit
  heute), sofern sie nicht selbst in einem Gefecht steht. Höchstens eine Armee je
  Einmarsch, die nächstgelegene.
- **D28.3 Die Garnison bleibt.** Eine dritte Haltung `garrison`: wie `defensive`, aber
  **ohne** den selbsttätigen Marsch — für die Armee, die bleiben soll, wo sie ist.
  Ohne sie nimmt D28.2 dem Spieler eine Wahl, die er heute hat.

### 5.4 Umgang mit dem Golden-Master — begründet, nicht umgangen

D28.1 und D28.2 erzeugen **zusätzliche Kommandos** und ändern damit den Spielverlauf
einer bestehenden Partie. Das ist **keine** hashneutrale Änderung, und sie lässt sich
auch nicht additiv verstecken: eine Armee, die vorher stand und jetzt marschiert, ist
ein anderer Zustand.

Der Umgang ist deshalb:

1. **Die Automatik hängt an der Haltung, und der Vorgabewert ändert sich nicht.** Neu
   ausgehobene Armeen stehen weiter auf `defensive` (`phases/recruitment.ts:67`). D28.2
   würde damit sofort greifen — **also bekommt D28.2 die neue Haltung `garrison` als
   Vorgabe**, und `defensive` wird die *gewählte* Deckungshaltung. So ist jede alte
   Partie, jeder alte Kommandolog und der Golden-Master **unverändert**: keine Armee
   steht nach dem Laden auf einer Haltung, die etwas Neues tut.
2. `garrison` ist ein neuer Wert im `Stance`-Typ — ein **Zustandsfeld ändert sich nicht**,
   nur sein Wertebereich. Die Migration setzt bestehende `defensive` auf `garrison` um,
   damit Punkt 1 auch für gespeicherte Stände gilt. Das ist der einzige Schritt, der
   `SCHEMA_VERSION` anfasst.
3. Der Golden-Master-Lauf (`tiny-500`) fährt ohne Kommandos und ohne Krieg — er bleibt
   damit bitgleich. Belegt wird das, bevor eine Zeile Automatik entsteht.

### 5.5 Teilaufgaben (noch nicht in `tasks.yaml` — erst nach Noahs Freigabe)

| ID | Titel | Kern? | Aufwand |
|---|---|---|---|
| T-M33-01 | Die Haltung `garrison` und die Migration bestehender Stände | **ja**, Wertebereich + Migration | mittel |
| T-M33-02 | `aggressive` verfolgt den weichenden Gegner (D28.1) | **ja**, erzeugt Kommandos | mittel |
| T-M33-03 | `defensive` deckt die eingenommene Nachbarprovinz (D28.2) | **ja**, erzeugt Kommandos | gross |
| T-M33-04 | Die vier Haltungen im Armeepanel, mit Erklärtext je Haltung | nein | klein |

**Vorbedingung für jede davon:** ein Messlauf über eine ganze Partie *vorher*, damit die
Wirkung der Automatik an Zahlen hängt und nicht an einem Eindruck — dieselbe Vorlage wie
`docs/reports/warmarch.json` (Kriegsmarschfaktor, T-M24-03).

**Offen für Noah:** ob `garrison` oder `defensive` die Vorgabe sein soll. Die Analyse
schlägt `garrison` vor, weil nur so keine bestehende Partie ihr Verhalten ändert — aber
es ist eine Spielentscheidung, keine technische.

