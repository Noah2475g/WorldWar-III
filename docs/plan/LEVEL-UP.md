# LEVEL-UP — der Plan für das nächste Niveau (2026-09-07)

> Entstanden aus dem delegierten Abnahme-Playtest vom 2026-09-07
> (`docs/reports/playtest-2026-09-07-v2.md`, 17 Befunde) und einer kritischen
> Überprüfung des Stands nach M19–M21. Drei Achsen, wie beauftragt: **UI/UX**,
> **Stil**, **Spiellogik**. Methode: Analyse → Anforderungen → Entwurf → Aufgaben.
> Die Aufgaben stehen als **M22, M23, M24** in `tasks.yaml` und `03-TASKS.md`.

---

## 1 · Analyse: was das Spiel heute ist — und woran es sich stößt

**Was steht:** 152 von 154 Aufgaben, 1528 Tests, Kern 96,8 %; alle Kernpfade laufen
(Playtest V2: Bauen, Ausheben, Marsch mit Ankunftsvorschau, Krieg, Eroberung,
Rückeroberung, Markt, Speichern hash-treu über den Neustart). Das Spiel **funktioniert**.
Die Ereignis-Stopps aus M21 sind der beste UX-Baustein des Spiels: das Vorspulen hält an,
wenn etwas passiert, und sagt was.

**Woran es sich stößt — die Diagnose in einem Satz:** Das Spiel *rechnet* auf dem Niveau
eines fertigen Strategiespiels und *spricht* auf dem Niveau eines Debug-Werkzeugs.

Drei Wurzeln, aus dem Playtest belegt:

**W1 · Die Oberfläche verliert Information auf dem letzten Meter.** Das
Ereignisprotokoll — der wichtigste Kanal — bricht in einer ~90-px-Spalte um (V2-01);
die Seitenleiste scrollt horizontal und schneidet Knöpfe ab (V2-02); der Fall der
eigenen Großstadt hat dieselbe optische Stimme wie „Vietnam ist gefallen" (V2-07);
Tagesberichte sind Überschriften ohne Körper (V2-06). Der Kern erzeugt die
Information vollständig — die Oberfläche wirft sie weg.

**W2 · Die Sprache ist auf halbem Weg stehen geblieben.** „Sie können **es** jetzt
bauen" (Genus), „nach 2 **Tage**" (Dativ), „Vereinigte Staaten **erklärt**" (Numerus),
„haelt/Staerke/Haelfte" in Tooltips (die tasks.yaml-Regel „ohne Umlaute" ist in
Spielertexte durchgesickert, V2-10/11). Einzeln klein; zusammen die Anmutung eines
Provisoriums — und genau das ist „Stil": nicht Schmuck, sondern ob man dem Spiel
glaubt.

**W3 · Die Frühphase erklärt das Was, aber nicht das Wozu — und belohnt das
Falsche.** Gemessen (PROBLEME.md „Der Einstieg ist enger…"): 52 Bedienelemente,
davon bringt am Tag 1 genau eines voran; die Bevölkerung stellt 98,6 % der
Startpunkte, eine Eroberung wiegt 285 Kasernen — aber nichts sagt das dem Spieler;
ab der dritten Provinz kostet jede weitere 3000 Zielmoral, unerklärt; und eine
Kriegserklärung **halbiert** die Marschgeschwindigkeit auf fremdem Boden (0,7 → 0,35),
womit der schnellste Eröffnungszug der unangekündigte Überfall ist. Dazu Frage 50
des Bogens, ehrlich beantwortet: **nein**, das Wozu fehlt.

**Nicht Teil dieses Plans** (bewusst): neue Mechaniken (M17 „Tiefe zwischen den
Kriegen" bleibt eigene Achse), Mehrspieler, Kartenneubau. Erst muss das Vorhandene
ankommen.

---

## 2 · Anforderungen

Keine neuen R-IDs: jede Aufgabe verfeinert bestehende Anforderungen (R-UI-05
Verständlichkeit, R-UI-07 Textqualität, R-UI-11 wahre Auskünfte, R-UI-18 Führung,
R-TIME-06 Ereignisse, R-MAP-05 Kartendarstellung, R-BAT-04 Bewegung). Was jede
Achse **zusichert**, wenn ihr Meilenstein fertig ist:

- **M22 (UI/UX):** Kein sichtbarer Text wird von Layout abgeschnitten oder in
  Spalten < 200 px umbrochen. Ereignisse, die den Spieler selbst betreffen
  (Provinzverlust, Hauptstadt, Aufstand, eigenes Ausscheiden), sind optisch von
  Weltereignissen unterschieden **und** ohne Scrollen erkennbar. Jeder Befehl
  quittiert sofort sichtbar („ausstehend"), auch bei Pause. Nach einem Neustart
  ist der jüngste Stand in einem Klick erreichbar. Eine stehende Uhr nennt sich
  „Pausiert".
- **M23 (Stil):** Spielertexte sind orthografisch und grammatisch korrektes
  Deutsch — maschinell bewacht (Umlaut-Ersatzschrift, Genus-Kongruenz der
  Baumeldungen). Benannte Dinge tragen ehrliche Namen (`AUS-SE`).
- **M24 (Spiellogik/Wozu):** Der Tagesbericht hat einen Körper. Die Punktequellen
  und die Ausdehnungs-Moralstrafe sind im Spiel erklärt, bevor sie wirken. Das
  Kriegsmarsch-Paradox ist entschieden (nicht zwingend geändert — entschieden und
  dokumentiert).

## 3 · Entwurf (D24, Kurzform — Details je Aufgabe)

- **D24.1 Protokoll:** Das Log wird eine volle Breitenzeile je Eintrag
  (`.log-entry { grid-column / max-width: none }`); Einträge, die den Spieler
  betreffen, tragen eine Klasse `log--self` (Zinnober-Balken links, fett), die der
  Kern über `event.audience`/Betroffenheit bereits hergibt. Tagesberichte werden
  aufklappbare Einträge mit Körper (D24.4).
- **D24.2 Seitenleiste:** `overflow-x: hidden` auf der Leiste; die
  Wirtschaftstabelle verliert die Spalte „In Auftrag" an ein Symbol mit Zahl hinter
  dem Bestand und bricht damit unter 320 px nicht mehr aus. Kein Panel darf breiter
  sein als die Leiste (Wächter-Test am gerenderten Baum: `scrollWidth <=
  clientWidth`).
- **D24.3 Start und Menü:** Der Startdialog bekommt Titelzeile („WorldWar",
  Untertitel, Versionszeile) und — wenn ein Spielstand existiert — als **ersten**
  Knopf „Weiterspielen (Tag N)". Das Menü wird dreiteilig: Neue Partie ·
  Spielstände · Einstellungen.
- **D24.4 Tagesbericht:** `dailyTick` liefert die Zahlen schon (Bilanzen, Moral,
  Aufträge, Freischaltungen). Der Bericht rendert: Δ je Rohstoff (nur ≠ 0), Moral
  je Provinz mit Richtung, fertige/laufende Aufträge, „morgen neu: X". Kein neues
  Kern-Ereignis nötig — die Oberfläche liest den Zustand am Tageswechsel.
- **D24.5 Befehls-Quittung:** `pendingCommands` der Hülle (existiert für die
  Übergabe an den Kern) wird im Panel angezeigt: der auslösende Knopf zeigt bis zum
  nächsten Tick „✓ befohlen…". Bei stehender Uhr zusätzlich der Hinweis „wirkt beim
  Weiterlaufen".
- **D24.6 Sprachwächter:** ein Test läuft über alle Werte von `de.ts` und die
  Tooltip-Texte in `actions.ts` und schlägt bei `ae|oe|ue`-Ersatzschrift in
  deutschen Wörtern an (Ausnahmeliste für echte Vorkommen wie „Ozean" → betrifft
  `ue` in „Queue" etc.); ein zweiter bindet die „Neu ab heute"-Sätze an das Genus
  aus einer kleinen Genus-Tabelle je Gebäude/Einheit.
- **D24.7 Wozu-Sätze:** Die Führungsschritte (tutorial.ts) erhalten je einen
  Begründungssatz (ein Feld `why`), und zwei neue Schritte erklären Punktequellen
  („Eroberung zählt, Ausbau kaum") und Moralstrafe („jede Provinz ab der dritten
  kostet Zielmoral"). Der bestehende Wächter `unlocks-explained` deckt die neuen
  Felder mit.
- **D24.8 Kriegsmarsch:** Messlauf über beide Varianten (Krieg 0,35 wie heute
  gegen einheitlich 0,7) im Parameterlauf; Entscheidung nach Zahlen, Eintrag in
  DECISIONS.md. Default-Empfehlung: Kriegsmalus **halbieren statt streichen**
  (0,5), damit der Überfall nicht der einzig rationale Zug bleibt, Verteidiger aber
  Zeit behalten.

## 4 · Aufgaben (Zwilling in tasks.yaml; Reihenfolge = Baureihenfolge)

| ID | Titel | Achse |
|---|---|---|
| T-M22-01 | Das Protokoll spricht in ganzen Zeilen | UI/UX |
| T-M22-02 | Die Seitenleiste hört auf, seitwärts zu kriechen | UI/UX |
| T-M22-03 | Was mich betrifft, sieht anders aus | UI/UX |
| T-M22-04 | Start mit Gesicht, Menü mit Wegen, Weiterspielen mit einem Klick | UI/UX |
| T-M22-05 | Jeder Befehl quittiert; eine stehende Uhr sagt es | UI/UX |
| T-M22-06 | Knöpfe sagen, was sie tun (A11y-Namen, Klickziele) | UI/UX |
| T-M23-01 | Umlaute kehren zurück, ein Wächter hält die Tür | Stil |
| T-M23-02 | Grammatik: Genus, Dativ, Numerus — mit Genus-Tabelle | Stil |
| T-M23-03 | `AUS-SE` bekommt einen ehrlichen Namen; Marktsymbol daneben | Stil |
| T-M24-01 | Der Tagesbericht bekommt einen Körper | Spiellogik |
| T-M24-02 | Das Wozu: Punkte, Moralstrafe, zwei neue Führungsschritte | Spiellogik |
| T-M24-03 | Das Kriegsmarsch-Paradox wird gemessen und entschieden | Spiellogik |

**Definition of Done je Aufgabe:** wie im Haus üblich — Test zuerst, der ohne die
Reparatur fällt; `pnpm verify` grün; PROGRESS.md-Eintrag. Nach M22–M24: ein
frischer `pnpm acceptance` gegen den Endstand.
