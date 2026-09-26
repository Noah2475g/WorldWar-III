# Verpackung als Programm — Stand nach M17 und dem Merge von `origin/main`

Gemessen am **2026-09-26** gegen `7a6aa47` (M17-F1-Fix, nach dem konfliktfreien Merge von
`origin/main`/Touch-Bedienung in `65feab8`) — **AK-8 vollständig durchgeführt**, anders als
im vorherigen Lauf. Am gebauten Programm und nicht im Browser. Dieser Lauf schließt Blocker 2
(AK-8) von T-M17-16 ab — Blocker 3 (`origin/main`) war zum Zeitpunkt dieses Laufs bereits
erledigt (Noahs Entscheid 2026-09-26, `DECISIONS.md`).

> **Kurzfassung:** exe neu gebaut (sauberer Quellstand — 0 uncommittete Zeilen unter `apps/`,
> `packages/`, `data/` vor dem Bau), Netzfreiheit haelt wieder woertlich, die Uhr bei Tempo 100
> liegt innerhalb der eigenen Streuung des Ausgangswerts vom selben Tag, und **AK-8 ist
> vollstaendig gelaufen: 7 von 7, Noahs echte Spielstaende per SHA-256 vor/nach identisch**.
> Die Stufe-4-Rundreise (Speichern, Beenden, Neustart, Laden, Weiterspielen) uebersteht einen
> echten Programmneustart — der Speicherstand traegt `state.espionage` und
> `state.diplomacy.tradeOffers` (schemaVersion 4), das ist der eigentliche Beleg, staerker als
> die reine UI-Gegenprobe der Vorlaeufe.

## Das Erzeugnis

| | |
|---|---|
| `worldwar.exe` | **6 816 768 Bytes** (6,50 MiB), geschrieben am **2026-09-26** (`01:43` UTC) |
| Bau | `pnpm tauri:build`, Exit 0; `vite build` in 2,46 s, danach Rust `release` in 2 min 30 s |
| Quelle | `7a6aa47` — beim Bau **keine uncommittete Datei unter `apps/`, `packages/`, `data/`** (`git status --porcelain` darauf gefiltert: 0 Zeilen) |
| Gegenüber `b9b3915` (2026-09-25, 6 812 160 B, vor dem `origin/main`-Merge) | **+4 608 Bytes** — die Touch-Bedienung aus PR #9–#11 |
| Gegenüber `e82c2bc` (2026-09-14, 6 790 144 B, vor M17) | **+26 624 Bytes** |

Wie zuvor festgehalten: **die Dateigröße allein belegt nicht, dass der neue Code drinsteckt**
— dafür steht AK-8 unten (der Speicherstand selbst ist der Beleg).

## Netzfreiheit (T-M38-05, R-MP-09/AK3)

`node scripts/measure-netfree.mjs`, beide Bündel aus demselben Commit (`7a6aa47`):

| Kennzahl | Soll | Gemessen |
|---|---|---|
| `connect-src 'none'` in der exe | 1× | **1×** |
| Inhaltsrichtlinie wörtlich in der exe | 1× | **1×** |
| `WebSocket` in der exe | 0× | **0×** |
| `WebSocket` im ausgelieferten Bündel (`dist`, ohne Bauflagge) | 0× | **0×** |
| `WebSocket` im Bündel MIT `WORLDWAR_MULTIPLAYER=1` (`dist-mp`, die Gegenprobe) | genau 1 Datei | **1 Datei** (`websocketTransport-_vntqp57.js`) |
| Netzberechtigungen in `capabilities/local-only.json` | `[]` | **`[]`** |
| `test/guards/packaging.test.ts` | grün | **18/18 grün** |

Die Gegenprobe mit Bauflagge ist der Beleg, dass die 0 eine Aussage über die Bauflagge ist
und nicht aus Unterlassen besteht — ohne Flagge fehlt der WebSocket-Transport ganz, mit ihr
steht er in genau einer Datei. Die Touch-Bedienung aus `origin/main` aendert daran nichts.

## AK-8: vollständig durchgeführt — 7 von 7, Noahs Stände unangetastet

Noahs `%APPDATA%\de.noahhaumersen.worldwar`-Verzeichnis stand beim Ansehen **klar**: nur
`saves` (Noahs echter Spielstand, vier Dateien, zuletzt geschrieben 21.09.) und
`saves.geparkt-2026-09-08` (unberührtes Relikt einer alten Sitzung) — die vier
Alt-Testordner aus den vorherigen AK-8-Versuchen (`saves.geparkt-2026-09-25`,
`saves.messung-2026-09-14`, `-14b`, `-14c`) waren auf Noahs Wort bereits in den Papierkorb
verschoben (`DECISIONS.md`, 2026-09-26).

**Ablauf, gemessen:**
1. SHA-256 der vier Dateien in `saves` **vorher** festgehalten.
2. `saves` → `saves.geparkt-2026-09-26` umbenannt (Name geprüft: existierte nicht).
3. `node docs/plan/schlussblock/ak8-cdp.mjs` gegen die neue exe: **7 von 7, `AK-8 ERFÜLLT`**
   (Start ohne Weiterspielen → Partie beginnen → Strg+S, Stand 1 speichern (**99 799 B**
   `stand-1.json` + 26 B Zeitreihe, gegenüber 96 954 B mit Stufe 3 am 2026-09-14 — die
   neuen Felder `espionage`/`tradeOffers` wachsen die Datei) → Beenden → Neustart → Spielstände
   prüfen → Weiterspielen).
4. Inhalt geprüft: `stand-1.json` ist `schemaVersion: 4`, `state.espionage` vorhanden,
   `state.diplomacy.tradeOffers` vorhanden — **das ist der eigentliche Beleg, dass M17 im
   Speicherformat der exe steckt**, stärker als die reine Bildschirmtext-Gegenprobe der
   Vorläufe.
5. Ergebnisordner `saves` (mit `stand-1.json`) → `saves.messung-2026-09-26` verschoben.
6. `saves.geparkt-2026-09-26` → `saves` zurückbenannt.
7. SHA-256 der vier Dateien **nachher**: **identisch** zu vorher, byteweise, alle vier Dateien.

**Nichts gelöscht, nichts überschrieben.** Noahs echte Stände (`autosave-0/1.json.json` samt
Zeitreihe) sind unangetastet — SHA-256 ist der Beleg, nicht nur der Dateiname/die Größe.

## Die Uhr bei Tempo 100 (Falle 18)

Verfahren wie zuvor: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=…`, über
CDP „Partie beginnen" geklickt (Voreinstellung: Weltkarte, 8 KI-Mächte), **Tempo 100** über
die Taste `+` siebenmal gedrückt (`SPEED_STOPS` `[0,1,2,5,10,25,50,100]`, Start bei 0),
**10 s Echtzeit** gemessen: Tag/Stunde der Kopfleiste (auf Stunden umgerechnet) und
`performance.now()` **aus demselben `Runtime.evaluate`-Aufruf**, damit kein
CDP-Rundlauf-Versatz zwischen Uhr und Zeitstempel liegt. Jeder Lauf mit frisch gestartetem
Programm. Das Messskript liegt im Scratchpad (`uhr-cdp.mjs`, Muster
`docs/plan/schlussblock/ak8-cdp.mjs`), nicht eingecheckt.

**Am selben Tag** zuerst die alte exe (`worldwar-vorher.exe` = `b9b3915`, gesichert vor
diesem Bau — der M17-Stand **vor** dem `origin/main`-Merge), dann die neue:

| Stand | Läufe | Minimum | Median | Höchstwert |
|---|---|---|---|---|
| exe vom 2026-09-25 (`b9b3915`, vor dem Merge) — **der Ausgangswert** | 5 | **99,60** | **99,90** | 99,93 |
| exe vom 2026-09-26 (`7a6aa47`, nach Merge und F1-Fix) — **Endstand** | 13 | **99,41** | **99,82** | 99,95 |

**Bewertung nach Falle 18** (Minimum gegen Minimum, Median gegen Median, gegen den eigenen
Ausgangswert vom selben Tag): das Minimum liegt 0,19 unter dem Ausgangswert, der Median 0,08
darunter. Beide Abstände sind **kleiner als die eigene Streuung des Ausgangswerts**
(99,60–99,93, Spanne **0,33** über 5 Läufen) — als Normalstreuung eingeordnet, nicht als
Rückschritt. Wie bei der vorherigen Messung ist die Spanne des Endstands selbst größer
(99,41–99,95, Spanne **0,54** über 13 Läufen) — derselbe Grenzfall wie am 2026-09-25, nicht
neu und nicht schlimmer: die Touch-Bedienung aus `origin/main` fügt keinen erkennbaren
zusätzlichen Ausschlag hinzu. Weit über dem historischen Tiefstwert vor der Uhr-Reparatur aus
T-M41-17 (98,40, siehe „Geschichte" unten).

## Grenzen dieser Messung

- Ein Rechner (Windows 11), aus dem gebauten Ordner — nicht aus einer Installation über
  MSI/Setup.
- Die Uhr-Läufe fuhren ohne Bildschirmfoto (anders als AK-8); die Zahlen stammen aus
  `Runtime.evaluate`, nicht aus einem Foto.
- Gemessen ist die **Einzelspieler**-Seite. AK-9 bleibt unberührt.
- Die CDP-Gegenprobe der Vorläufe (Diplomatie-/Spionage-Panel per Tastendruck) wurde in
  diesem Lauf nicht wiederholt — AK-8 selbst (Speicherstand mit `espionage`/`tradeOffers`)
  ist der stärkere Beleg und deckt dieselbe Frage ab.

---

# Geschichte

## Die Messung vom 2026-09-25 (gegen `b9b3915`) — AK-8 nicht durchgeführt, vor dem `origin/main`-Merge

Gebaut und Netzfreiheit gemessen am **2026-09-25** auf `b9b3915`; AK-8 selbst wurde in
diesem Lauf **nicht** gemessen. Die Kopfzeile nannte absichtlich **keinen** Stempel im
Format „Gemessen am, gegen Commit" für AK-8, damit `scripts/acceptance-criteria.mjs`
(`measurementOf`) AK-8 nicht fälschlich als „erfüllt, seither nur Dokumente" grün meldete.

**Das Erzeugnis:** `worldwar.exe` 6 812 160 Bytes, geschrieben 2026-09-25 19:00 Ortszeit,
Quelle `b9b3915`. Gegenüber `e82c2bc` (2026-09-14, 6 790 144 B): +22 016 Bytes.

**Netzfreiheit:** `connect-src 'none'` 1×, WebSocket exe/Bündel 0×, mit Bauflagge genau 1
Datei (`websocketTransport-TJkkYkH5.js`), Netzberechtigungen `[]`, Guard 18/18 grün.

**Gegenprobe (Ersatz für AK-8):** über CDP eine neue Partie begonnen und Taste **D**
gedrückt — Bildschirmtext enthielt „Diplomatie" (Panel-Titel) und „Spionage" (eigener
Reiter). Beides gab es vor M17 nicht.

**Die Uhr bei Tempo 100:** Ausgangswert (`e82c2bc`, 5 Läufe) Minimum 99,78 / Median 99,89 /
Höchstwert 99,93. M17-Endstand (`b9b3915`, 13 Läufe) Minimum 99,68 / Median 99,77 /
Höchstwert 99,91. Abstände (0,10 Minimum / 0,12 Median) kleiner als die Streuung des
Ausgangswerts (0,15 über 5 Läufen) — als Normalstreuung eingeordnet, mit dem offenen
Hinweis, dass die Spanne des Endstands selbst (0,23 über 13 Läufen) größer war.

**AK-8: in diesem Lauf NICHT durchgeführt — Noahs `saves`-Ordner war unklar.**
Vorbedingung des Skripts ist ein leerer oder umbenannter
`%APPDATA%\de.noahhaumersen.worldwar\saves`-Ordner. Beim Ansehen (18:36 Uhr) enthielt er
sechs Dateien (Noahs echter Spielstand). Beim geplanten Umbenennen (nur umbenennen, nichts
löschen) stellte sich eine unklare Lage heraus:

- Es gab bereits einen Ordner `saves.geparkt-2026-09-25` (Erstellzeit 2026-09-08, 03:24
  Uhr) — ein Relikt einer früheren Sitzung, die denselben Namen benutzt haben muss, aber nie
  zurückbenannt hat.
- Nach dem Umbenennen enthielt dieser Zielordner nur zwei der ursprünglich sechs Dateien;
  gleichzeitig existierte wieder ein neuer `saves`-Ordner mit den vier übrigen Dateien.
- Vier weitere Alt-Ordner aus früheren Sitzungen lagen im selben Verzeichnis:
  `saves.geparkt-2026-09-08`, `saves.messung-2026-09-14`, `-14b`, `-14c`.
- Kein `worldwar.exe`-Prozess lief währenddessen — eine erklärende Schreibquelle wurde
  nicht gefunden.

Nichts wurde gelöscht. **Empfehlung an Noah:** von Hand nachsehen, was in `saves` und den
Alt-Ordnern steht. **Aufgelöst am 2026-09-26:** Noah hat die vier Alt-Testordner
(`saves.geparkt-2026-09-25`, `saves.messung-2026-09-14`, `-14b`, `-14c`) in den Papierkorb
verschoben und AK-8 mit Park-unter-neuem-Namen/SHA-256-Vergleich freigegeben
(`DECISIONS.md`, 2026-09-26) — siehe die aktuelle Messung oben, AK-8 vollständig
durchgeführt.

## Die Messung vom 2026-09-14, 18:40 (gegen `e82c2bc`) - vor T-M17-16

Gemessen am **2026-09-14** gegen `e82c2bc`, am gebauten Programm und nicht im Browser.
Der Bericht gilt für genau diesen Stand.

> **Warum diese Datei existiert:** AK-8 stand seit dem 2026-09-05 in C-02 und hatte bis
> zum 2026-09-06 keinen Ort, an dem es geprüft wird. Eine Zusage ohne Messung ist genau
> die Fehlerklasse, die dieses Projekt schon mehrfach Sitzungen gekostet hat. Hier
> steht, was tatsächlich gelaufen ist — nicht, was gelten soll.

> **Warum am selben Tag ein drittes Mal gemessen wurde:** Zwischen der Messung von 03:24
> (gegen `1c64a6e`) und heute Abend liegen **M37, M38 und M39** — der Gleichschritt, der
> Hostdienst, der Beitrittsbildschirm, die Bauflagge und drei Reparaturen aus der
> Sichtprüfung des Mehrspielers (`672b3c6`, `0410bb7`, `48beeb7`, alle in `apps/`). Der
> Frische-Wächter des Abnahmelaufs hat das erkannt und AK-8 zu Recht auf ⚠ gestellt:
> *„seither 32 Datei(en) am Erzeugnis geändert"*. Der Wächter war nicht zu streng — die
> exe war alt. Also: neu bauen, neu messen, und **am laufenden Programm nachweisen, dass
> wirklich dieser Stand darin steckt** (Abschnitt „Gegenprobe" unten). Die alten Messungen
> stehen vollständig unter „Geschichte", sie werden nicht gelöscht.
>
> Das ist genau die Lehre vom Morgen desselben Tages, ein zweites Mal angewandt: **wer
> AK-8 grün haben will, misst es zuletzt**, nach der letzten Zeile ausgelieferten Codes.

## Das Erzeugnis

| | |
|---|---|
| `worldwar.exe` | **6 790 144 Bytes** (6,48 MiB), geschrieben am **2026-09-14 18:40:02** |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 822 144 Bytes (2026-09-14 18:39:54) |
| `WorldWar_0.1.0_x64-setup.exe` (NSIS) | 2 150 829 Bytes (2026-09-14 18:40:02) |
| Bau | `pnpm tauri:build`, Exit 0, Wanduhr **1 min 45 s** (18:38:17–18:40:02); `vite build` in 1,54 s, Rust `release`-Profil in **1 min 32 s**, danach beide Bündel („Finished 2 bundles at") |
| Quelle | `e82c2bc` (18:29:46); beim Bau **keine uncommittete Datei unter `apps/`, `packages/`, `data/`** (`git status --porcelain` darauf gefiltert: 0 Zeilen). Was seither auf den Zweig kam, sind Dokumente, `README.md` und `index.html` — nichts davon geht ins Programm |

Größe im Verlauf desselben Tages, alles derselbe Rechner und dieselbe Kette:

| Bau | exe | gegen |
|---|---|---|
| 03:22 (AK-8, M41-Endstand) | 6 780 416 B | `1c64a6e` |
| 15:30 (Netzfrei-Messung, M38) | 6 784 512 B | `a4ed758` |
| **18:40 (dieser Bau, M39-Endstand)** | **6 790 144 B** | **`e82c2bc`** |

**+9 728 Bytes gegen den Bau von 03:22**, +5 632 gegen den von 15:30 — das ist M39 an der
Oberfläche (Beitrittsbildschirm, Lobby, Texte). Die Zahl ist trotzdem **kein Beleg dafür,
dass der neue Code drinsteckt**: am Morgen dieses Tages waren zwei Bauten mit und ohne die
Uhr-Reparatur auf das Byte gleich groß. Was es belegt, steht unter „Gegenprobe".

## Wie gemessen wurde

Nicht von Hand, sondern über `docs/plan/schlussblock/ak8-cdp.mjs` — dasselbe Skript wie am
03:24, unverändert gefahren: das Programm startet mit
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, das Skript spricht
über CDP mit der laufenden WebView2 und klickt über die **Knopftexte**, die ein Spieler
auch sieht.

```bash
node docs/plan/schlussblock/ak8-cdp.mjs apps/desktop/src-tauri/target/release/worldwar.exe <ausgabe>
```

Der Lauf dauerte **8 Sekunden** (18:40:45–18:40:53; `measuredAt` in `ak8-ergebnis.json`:
`2026-09-14T16:40:53.164Z`) und endete mit Exit 0 und `AK-8 ERFÜLLT`. Er hinterließ
`ak8-ergebnis.json` und sechs Bildschirmfotos. Das Skript bricht ab, wenn `saves` nicht
leer ist, und es beendet nur die Prozesse, die es selbst gestartet hat — **gelöscht wird
nichts**.

**Noahs Spielstände waren währenddessen geparkt, nicht gelöscht:** `saves` war für die
Dauer der Messung umbenannt und steht seither wieder an seinem Platz; die Dateien dieses
dritten Laufs liegen unter `saves.messung-2026-09-14c` (die der beiden früheren unter
`saves.messung-2026-09-14` und `…-14b`). Die Listen vorher und nachher nennen dieselben
zwei Dateien mit derselben Größe, derselben Uhrzeit (2026-09-09 23:08) und derselben
SHA-256-Summe (`autosave-0.json.json` 334 237 B, `EC0A17D3…A21C`;
`zeitreihe.autosave-0.json.json` 8 784 B, `B2E5390E…FEB4`) — dieselben Summen wie am
Morgen. Gezogen wurden sie dreimal: vor dem Parken, nach der Gegenprobe und nach der
Nachschau am Startdialog.

## Der Ablauf, Schritt für Schritt (Ausgangspunkt: `saves/` leer)

| # | Handlung | Beobachtung (aus `ak8-ergebnis.json`) |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Startdialog „Neue Partie", Knöpfe im Rumpf: **„Partie beginnen \| Spielstände"** — **kein** „Weiterspielen", richtig, es gibt keinen Stand |
| 2 | „Partie beginnen" geklickt | Weltkarte, Vereinigte Staaten, Uhr **„Tag 1 · 00:00"** |
| 3 | Strg+S → in der Zeile „Stand 1" auf „Speichern" | Zeile vorher „Stand 1 — leer", danach **„Stand 1 — Tag 1"**. Auf der Platte: `stand-1.json` (**96 954 B**) **und `zeitreihe.stand-1.json`** (26 B) — die M25-Zeitreihe wandert mit, an Tag 1 · 00:00 noch ohne Eintrag |
| 4 | Programm beendet | Prozessbaum weg, **beide Dateien bleiben liegen** |
| 5 | `worldwar.exe` erneut gestartet | Startdialog, Knöpfe in dieser Reihenfolge: **„Weiterspielen (Tag 1)" \| „Partie beginnen" \| „Spielstände"** — der Wiedereinstieg steht zuerst (T-M22-04) |
| 6 | „Spielstände" geprüft | Zeile **„Stand 1 — Tag 1"**, einziger Knopf **„Laden"** und **nicht gesperrt**. Kein „Speichern" — ohne laufende Partie gibt es nichts zu sichern (T-M12-07) |
| 7 | „Weiterspielen (Tag 1)" geklickt | Partie läuft: **„Tag 1 · 00:00"** |

**AK-8 ist erfüllt** — sieben von sieben Schritten, Exit 0 (`AK-8 ERFÜLLT`).

Die Zahl **96 954 B** für `stand-1.json` ist bemerkenswert und gehört hierher: sie ist auf
das Byte dieselbe wie am 03:24. M37–M39 haben die **Partieart** und die **feste Rate** in
die Hülle gelegt und ausdrücklich *nicht* in den `GameState` — der Golden Master der
Serialisierung ist damit unberührt, und ein Stand vom Morgen liest sich heute noch. Das
ist keine Absichtserklärung, sondern eine Zahl aus zwei Läufen.

## Gegenprobe: steckt der neue Stand wirklich in dieser exe?

Die Dateigröße sagt es nicht (siehe oben), ein Dateidatum erst recht nicht. Also wurde
nicht die Datei befragt, sondern **das laufende Programm** — und zwar an der Stelle, die
am 2026-09-14 schon einmal auseinandergegangen ist: **der Uhr bei Tempo 100** (Falle 18,
T-M41-17).

Verfahren wie beim letzten Mal: `worldwar.exe` mit
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223` gestartet, über CDP
„Partie beginnen" geklickt (Voreinstellung: Weltkarte mit 237 Provinzen, Vereinigte
Staaten, 7 Gegner, Startzahl 1914), **Tempo 100** gedrückt und über **10 Sekunden
Echtzeit** gemessen: zwei abgelesene Uhrzeiten der Kopfleiste und `performance.now()`
**aus demselben JS-Zug**, dazu die Bildzeiten aus `requestAnimationFrame`. **Jeder Lauf
mit frisch gestartetem Programm und frischer Partie.** Dreizehn Läufe in zwei Reihen:

| Reihe | Zeit | Läufe | Ticks/s je Lauf | Minimum | Median |
|---|---|---|---|---|---|
| A | 18:42:22–18:43:38 | 5 | 99,91 · 99,76 · 99,84 · 99,86 · 99,46 | 99,46 | **99,84** |
| B | 18:44:07–18:46:07 | 8 | 99,73 · 99,91 · 99,87 · 99,76 · 99,56 · 99,82 · 99,80 · 99,82 | 99,56 | **99,81** |
| **A+B** | | **13** | | **99,46** | **99,82** (Mittel 99,78, Höchstwert 99,91) |

Der Vergleich, den Falle 18 verlangt — **Minimum gegen Minimum, Median gegen Median**,
gegen den eigenen, am selben Tag gemessenen Ausgangswert:

| Stand | Läufe | Minimum | Median | Band |
|---|---|---|---|---|
| **vor** der Uhr-Reparatur (`vite preview`-Bündel) | 8 | 92,98 | 95,76 | 92,98 – 98,40, große Streuung |
| **nach** der Reparatur (`vite preview`-Bündel) | 5 | 99,77 | 99,90 | 99,77 – 99,95 |
| exe vom 03:22 (`1c64a6e`) — **der Ausgangswert** | 3 | **99,85** | **99,88** | 99,85 – 99,98 |
| **exe vom 18:40 (`e82c2bc`) — diese Messung** | **13** | **99,46** | **99,82** | 99,46 – 99,91 |

**Die Antwort, um die es geht, ist eindeutig:** alle dreizehn Läufe liegen über dem
*höchsten* Wert, der je **vor** der Reparatur gemessen wurde (98,40) — mit Abstand, nicht
knapp. Die Uhr-Reparatur aus T-M41-17 ist in dieser exe. Ein zweiter Bau war nicht nötig.

**Und der Teil, der nicht übergangen wird:** gegen den Ausgangswert ist der Median
**0,06 niedriger** und das Minimum **0,39 niedriger**. Der Median liegt damit innerhalb der
eigenen Streuung des Ausgangswerts (0,13 über drei Läufe) — das Minimum nicht. Zwei Dinge,
die beide *gemessen* und nicht behauptet sind:

- **Die zwei langsamen Läufe sind Einzelbilder, keine langsame Uhr.** Die Norm liegt bei
  1000–1002 Ticks in 10,02 s. A5 zählte 997, B5 zählte 998 — ein Fehlbetrag von 3 bis 5
  Ticks. `clockCap(100)` ist **5**: das ist genau das, was **ein einziges** Bild in zehn
  Sekunden gutschreiben darf. Ein verlorenes Bild erklärt die Abweichung vollständig; elf
  der dreizehn Läufe liegen bei ≥ 99,73.
- **Ein Minimum über 13 Ziehungen ist nicht dasselbe wie eines über 3.** Der Ausgangswert
  hat drei Läufe; dieselbe Verteilung liefert bei dreizehn Ziehungen fast zwangsläufig
  einen tieferen Tiefstwert. Dazu kam die Maschine: 15 % Grundlast und Noahs Browser
  offen, während der Lauf vom 04:42 nachts auf einer ruhigeren Maschine stand.

Was daraus **nicht** folgt: dass die Uhr sicher unverändert schnell ist. Der Unterschied im
Median (0,06 von 100, also 0,06 %) ist zu klein, um ihn von der Maschinenlast zu trennen,
und das sagt dieser Bericht so und nicht anders. Was daraus **folgt**: der ausgelieferte
Bau hält die Zusage aus T-M41-04 — 100 Spielstunden je Sekunde, gemessen 99,8 % davon.

Nebenbelege desselben Laufs: **Tempo 100 blieb in allen dreizehn Läufen gedrückt**
(`aria-pressed="true"` am Anfang *und* am Ende jeder Messung), und die Spielschleife lief
mit **89 Bildern/s im Median** (809–935 Bilder je zehn Sekunden).

Diese Gegenprobe hat **nicht gespeichert**. Die Autosave-Automatik konnte nicht
dazwischenfunken: `shouldAutosave` verlangt **beides**, einen Tagessprung *und* fünf Minuten
Echtzeit seit dem Partiebeginn — keine der dreizehn Partien lebte auch nur eine halbe
Minute.

## Was dieser Lauf nebenbei belegt

- Der Startdialog (Titel, Fassung, Weiterspielen) läuft im gebauten Programm, nicht nur im
  Test — auch nach M37–M39, die genau diesen Dialog um die Partieart erweitert haben.
- Die Zeitreihe (M25) wandert je Slot als Nachbardatei mit.
- Die fünf Hüllen-Kommandos aus T-M28-03 tragen den ganzen Weg: schreiben, auflisten,
  wiederlesen — über zwei Programmstarts hinweg.
- Das Speicherformat ist über M37–M39 hinweg **byte-gleich groß** geblieben (96 954 B);
  die Partieart liegt in der Hülle, nicht im `GameState`.
- Bekannter Kleinbefund bleibt: Autosave-Dateien heißen `autosave-N.json.json`
  (der Kern-Slotname trägt `.json`, die Hülle hängt ein zweites an) — funktional
  folgenlos, da Schreiben und Lesen symmetrisch sind; notiert in PROBLEME.md.

## Gesehen am gebauten Programm, nicht repariert: „Zu zweit über einen Link" steht im netzfreien Bau

Schritt 1 zeigt den Startdialog, und darin steht seit M37 ein Wähler **„Partieart"**. Im
netzfreien Tauri-Bau bietet er **beide** Werte an — „Allein gegen den Rechner" *und* „Zu
zweit über einen Link" —, obwohl dieses Programm die zweite Art technisch nicht kann. Das
ist nachgemessen und nicht erschlossen: der Wähler wurde im laufenden Programm auf
`multiplayer` gestellt und die Partie begonnen. Sie läuft **lokal** weiter, mit fester Rate
(„10 Stunden je Sekunde (fest)"), dem Mitspielerland als KI und **ohne jeden Fehler** — der
Hinweis darunter sagt es sogar, nur mit einem Text, der seit M38/M39 nicht mehr stimmt:
*„Die Verbindung zum Mitspieler kommt mit dem nächsten Ausbau; die Partie beginnt vorerst
lokal."*

**Die Netzfreiheit ist davon unberührt** — sie ist unten gemessen, und sie hält —, aber der
Bau verspricht in der Oberfläche einen Link, den er nicht erzeugen kann. Der Befund steht
mit dem vollen Messweg in `docs/plan/PROBLEME.md` (2026-09-14, AK-8-Bau `e82c2bc`); hier
wird er nur genannt, weil er beim Verpackungslauf aufgefallen ist. **AK-8 ist davon nicht
betroffen:** die sieben Schritte fahren „Allein gegen den Rechner", so wie ein Spieler das
ausgelieferte Programm fährt.

## Grenzen dieser Messung

- Ein Rechner (Windows 11), aus dem gebauten Ordner — nicht aus einer Installation
  über MSI/Setup.
- Bedienung über CDP mit Bildschirmfoto nach jedem Schritt; was ein Mensch dabei
  empfindet, steht in AK-7 und ist davon unberührt.
- Die Partie wurde an **Tag 1 · 00:00** gespeichert. Dass ein weit fortgeschrittener
  Stand ebenso zurückkommt, zeigt diese Messung nicht — dafür steht Noahs eigene
  Autosave-Datei (334 237 B) und der Golden-Master der Serialisierung.
- Gemessen ist die **Einzelspieler**-Seite. AK-9 — eine Partie zu zweit über einen Link,
  gespielt von zwei Menschen in zwei Netzen — ist ein eigenes Kriterium mit eigenem
  Bericht (`docs/reports/mehrspieler.md`) und hier nicht berührt.


## Die Messung vom 2026-09-14, 03:24 (gegen `1c64a6e`) — von M37–M39 überholt

Diese Messung war in der Sache **richtig und bestanden**: sieben von sieben Schritten,
Exit 0, derselbe Ablauf und dieselben Beobachtungen wie oben. Überholt ist sie nicht durch
einen Fehler, sondern durch den Mehrspieler-Block, der danach kam.

| | |
|---|---|
| `worldwar.exe` | **6 780 416 Bytes** (6,47 MiB), geschrieben am **2026-09-14 03:22:44** |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 813 952 Bytes (2026-09-14 03:22:34) |
| `WorldWar_0.1.0_x64-setup.exe` (NSIS) | 2 140 999 Bytes (2026-09-14 03:22:44) |
| Bau | `pnpm tauri:build`, fertig um **03:22:44**; `vite build` in 1,53 s, Rust `release`-Profil in 1 min 51 s |
| Quelle | `1c64a6e` (03:17:17), Arbeitsbaum sauber |
| AK-8-Lauf | Ende **03:24:36**, `AK-8 ERFÜLLT`, Messdateien unter `saves.messung-2026-09-14b` |

Der Ablauf Schritt für Schritt, so wie er damals gemessen wurde:

| # | Handlung | Beobachtung |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Startdialog „Neue Partie", Knöpfe im Rumpf: **„Partie beginnen \| Spielstände"** — **kein** „Weiterspielen" |
| 2 | „Partie beginnen" geklickt | Weltkarte, Vereinigte Staaten, Uhr **„Tag 1 · 00:00"**; die Ankündigungen aus M41 stehen da („Neu ab heute: Kaserne / Infanterie") |
| 3 | Strg+S → in der Zeile „Stand 1" auf „Speichern" | Zeile vorher „Stand 1 — leer", danach **„Stand 1 — Tag 1"**, Meldung „Gespeichert." Auf der Platte: `stand-1.json` (96 954 B) **und `zeitreihe.stand-1.json`** (26 B) |
| 4 | Programm beendet | Prozessbaum weg, **beide Dateien bleiben liegen** |
| 5 | `worldwar.exe` erneut gestartet | **„Weiterspielen (Tag 1)" \| „Partie beginnen" \| „Spielstände"** — der Wiedereinstieg steht zuerst (T-M22-04) |
| 6 | „Spielstände" geprüft | Zeile **„Stand 1 — Tag 1"**, einziger Knopf **„Laden"** und **nicht gesperrt** (T-M12-07) |
| 7 | „Weiterspielen (Tag 1)" geklickt | Partie läuft: **„Tag 1 · 00:00"**, eigene Provinzen, Wirtschaft zeichengleich mit Schritt 2 (667 / 667 / 333 / 333 / 167 / 67 / 1.667), Protokoll „Die Partie beginnt." |

Ihre Gegenprobe an der Uhr — dieselbe Frage, dieselbe Methode wie oben, drei Läufe:

| Lauf | Uhr von → bis | Echtzeit | Ticks | **Ticks/s** | Bilder | Soll laut `clockStep` |
|---|---|---|---|---|---|---|
| 1 | Tag 7 · 14:00 → Tag 49 · 08:00 | 10,022 s | 1 002 | **99,98** | 849 | 998 |
| 2 | Tag 9 · 10:00 → Tag 51 · 02:00 | 10,015 s | 1 000 | **99,85** | 948 | 997 |
| 3 | Tag 9 · 10:00 → Tag 51 · 02:00 | 10,012 s | 1 000 | **99,88** | 936 | 997 |

**99,85–99,98 Ticks/s**, gemessen um 04:42, Startzahl 20260914, Bildrate 85–95 Bilder/s
(Median der Bildzeit 7 ms, p95 21 ms). Das ist der Ausgangswert, gegen den die Messung vom
18:40 oben antritt.

### Zwei Befunde am Steuerskript (beim ersten Lauf überhaupt)

Das gilt für den Lauf um **00:45**; die Läufe um 03:24 und um 18:40 fuhren dasselbe,
bereits korrigierte Skript unverändert.

Das Skript war am 2026-09-13 geschrieben und **noch nie gelaufen**. Eine Vorabprobe am
DOM — starten, Partie beginnen, Strg+S, nur lesen, nichts speichern — zeigte zwei Stellen,
an denen es gescheitert wäre. Beide sind im Skript korrigiert und dort auch begründet:

1. **Der Spielstände-Dialog erscheint leer und füllt seine Zeilen erst danach.**
   `listSlots` ist asynchron; unmittelbar nach dem Dialogtitel gibt es **kein einziges**
   `li.slot` und damit keinen Knopf. Das Skript wartet jetzt auf die Zeilen, nicht auf
   den Titel.
2. **Zehn Zeilen tragen denselben Knopftext „Speichern"** (fünf Stände, fünf
   Automatikplätze). Über den Text allein ist die Zeile „Stand 1" nicht getroffen,
   sondern nur die erste in der Dokumentreihenfolge — richtig, aber aus dem falschen
   Grund. Geklickt wird jetzt **in der Zeile**, deren Beschriftung mit „Stand 1" beginnt.

Dazu zwei Verschärfungen, die die Messung strenger machen als zuvor: Schritt 5 verlangt,
dass „Weiterspielen (Tag N)" der **erste** Knopf im Rumpf des Startdialogs ist (der
Dialogkopf mit dem „×" zählt nicht mit), und Schritt 6 aus der Messung vom 2026-09-08 —
die Liste nach dem Neustart — ist wieder Teil des Laufs, statt übersprungen zu werden.

## Die Messung vom 2026-09-14, 00:45 (gegen `2c52356`) — vom Uhr-Commit überholt

Diese Messung war in der Sache **richtig und bestanden**: sieben von sieben Schritten,
Exit 0, derselbe Ablauf und dieselben Beobachtungen wie oben. Überholt ist sie nicht
durch einen Fehler, sondern durch die Reihenfolge des Tages.

| | |
|---|---|
| `worldwar.exe` | 6 780 416 Bytes (6,47 MiB), geschrieben am 2026-09-14 **00:41:25** |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 813 952 Bytes |
| `WorldWar_0.1.0_x64-setup.exe` (NSIS) | 2 141 188 Bytes |
| Bau | `pnpm tauri:build`, Exit 0, Wanduhr 2 min 19 s (00:39:07–00:41:26); Rust `release`-Profil in 2 min 01 s |
| Quelle | während des Baus unangefasst (`git status` sauber bei Baubeginn, erste Schreiboperation nach 00:41:26) |
| AK-8-Lauf | 8 Sekunden (00:45:26–00:45:34), `AK-8 ERFÜLLT`, Messdateien unter `saves.messung-2026-09-14` |

**Warum sie nicht mehr zählt:** Um 02:21 landete `0f1fce1` — die Uhr schreibt ihren Stand
zurück, bevor das nächste Bild rechnet (T-M41-17) — und das ist eine Änderung an
`apps/desktop/src/App.tsx`, also am ausgelieferten Gut. Der Frische-Wächter des
Abnahmelaufs vergleicht den Stempel dieses Berichts mit `HEAD` und sieht über
`artefactUnchangedSince` nach, ob dazwischen nur Dokumente und Tests liegen. Hier lag
mehr, und AK-8 stand folgerichtig auf **⚠ „seither N Datei(en) am Erzeugnis geändert"**.

Das ist der Wächter, der seine Arbeit tut: die 00:41-exe hätte in Noahs Hand die alte,
stockende Uhr gehabt, und der Bericht hätte trotzdem ✅ gemeldet, wäre der Stempel bloß
mitgeschrieben worden. Die Antwort war deshalb nicht, die Grenze zu verschieben, sondern
neu zu bauen (03:22:44), neu zu messen (03:24:36) — und die Reparatur am laufenden
Programm nachzuweisen, statt sie aus Dateigröße und Datum zu erschließen.

## Die Messung vom 2026-09-08 (gegen den M28-Stand, T-M28-03)

Erzeugnis: `worldwar.exe` 7 933 952 Bytes (7,57 MiB), `release`, LTO, Exit 0. Der große
Sprung von dort auf die 6,78 MiB des 2026-09-14 stammt aus T-M28-03, das
`tauri-plugin-fs` samt Berechtigungen aus dem Programm entfernt hat.

| # | Handlung | Beobachtung |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Startdialog mit Titelzeile (M22), **kein** „Weiterspielen" |
| 2 | Partie begonnen | Weltkarte, Vereinigte Staaten, Tag 1 · 00:00; Führung „Schritt 1 von 10" |
| 3 | Strg+S → „Speichern" auf Stand 1 | „Gespeichert." **und die Zeile wird sofort „Stand 1 — Tag 1"**, Laden aktiv. Auf der Platte: `stand-1.json` (96 216 B) **und `zeitreihe.stand-1.json`** |
| 4 | Programm beendet | Prozess weg, Dateien bleiben |
| 5 | `worldwar.exe` erneut gestartet | Startdialog zeigt als ersten Knopf **„Weiterspielen (Tag 1)"** (T-M22-04, erstmals am Programm gemessen) |
| 6 | „Spielstände" geprüft | „Stand 1 — Tag 1" in der Liste, Laden aktiv |
| 7 | „Weiterspielen (Tag 1)" geklickt | Partie läuft: Tag 1 · 00:00, eigene Provinzen, Wirtschaft identisch, Protokoll „Die Partie beginnt." |

**AK-8 war erfüllt** — einschließlich des neuen Weiterspielen-Wegs.

### Der Befund, der jene Messung zu einer Reparatur machte

Der **erste** Lauf jenes Tages (Bündel gegen `36b63a8`, noch mit `tauri-plugin-fs`)
**brach AK-8**: Schritt 3 schrieb die Datei und meldete „Gespeichert." — aber die
Zeile blieb „Stand 1 — leer", nach dem Neustart ebenso, kein Weiterspielen-Knopf.

Ursache, per Falsifikationskette am laufenden Programm über CDP gemessen (vollständig
in `PROBLEME.md`, 2026-09-08): Die Scope-Prüfung von `tauri-plugin-fs` kanonisiert
Pfade, **die existieren** — unter Windows ergibt das die `\\?\C:\…`-Schreibweise, und
kein Scope-Muster passt je auf sie. Deshalb ging das **Schreiben neuer** Dateien
(nichts zu kanonisieren) und das **Wiederlesen** war „forbidden path" — trotz
`fs:allow-appdata-read-recursive`, explizitem `fs:scope` und Laufzeit-Freigabe beider
Schreibweisen (`is_allowed` blieb `false` unmittelbar nach `allow_directory == Ok`).
Der Beweis-Moment: `exists` auf eine **Geisterdatei** lieferte sauber `false`,
derselbe Pfad **mit existierender Datei** „forbidden".

**Die Reparatur:** Das Spiel spricht nicht mehr mit `tauri-plugin-fs`, sondern mit
**sechs *(korrigiert 2026-09-13: fünf)* eigenen, engen Kommandos der Hülle** (`saves_list` … `saves_exists` in
`src-tauri/src/main.rs`): sie nehmen einen Datei**namen** an, nie einen Pfad
(Separatoren und `..` werden verweigert, nicht bereinigt), und berühren
ausschließlich `$APPDATA/saves`. Das fs-Plugin und seine Berechtigungen sind
entfernt — weniger Oberfläche als vorher.

> **Zur Messung vom 2026-09-07 (gegen `1c33ec7`):** sie berichtete Schritt 6 als
> bestanden. Mit identischem Storage-Code, identischen Berechtigungen und identischen
> Crate-Versionen (Cargo.lock/pnpm-lock unverändert) war das am 2026-09-08 **nicht
> reproduzierbar** — derselbe Schritt scheiterte vor der Reparatur zuverlässig. Die
> alte Messung bleibt als nicht nachvollziehbar markiert; maßgeblich sind der Lauf vom
> 2026-09-08 und die Läufe vom 2026-09-14 darüber.

> Die alten Messdaten vom 2026-09-08 lagen geparkt in
> `%APPDATA%/de.noahhaumersen.worldwar/saves.geparkt-2026-09-08` (nichts gelöscht); dieser
> Ordner war am 2026-09-14 nicht mehr vorhanden.


---

## Netzfrei, gemessen am Erzeugnis (T-M38-05, R-MP-09/AK3, 2026-09-14)

Noahs dritte Festlegung vom 2026-09-12: **die Tauri-Anwendung kennt keinen Mehrspieler und
darf ihn technisch nicht können.** Der Mehrspieler ist der Browserbau, gestartet vom
Hostdienst; damit bleibt Ziel Z3 für das Programm wörtlich wahr, das Noah weitergibt.

Bis hierher wurde das an der **Konfiguration** geprüft — `tauri.conf.json` gegen
`capabilities/local-only.json`, zwei JSON-Dateien derselben Hand. Der Block ist für das,
was er prüft, richtig, und er prüft die Absicht gegen sich selbst (Befunde 17, 20, 21).
Seit T-M38-05 kommt die zweite Seite aus dem **kompilierten Programm**:
`scripts/measure-netfree.mjs` liest die Inhaltsrichtlinie dort heraus, und
`test/guards/packaging.test.ts` hält den gemessenen Text gegen die heutige Konfiguration.
Wer die Sperre lockert, bekommt einen roten Lauf, bis neu gebaut und neu gemessen ist.

### Der Bau

| | |
|---|---|
| `worldwar.exe` | **6 784 512 Bytes**, geschrieben am **2026-09-14 15:30:41** |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 818 048 Bytes |
| `WorldWar_0.1.0_x64-setup.exe` (NSIS) | 2 144 550 Bytes |
| Bau | `pnpm tauri:build`; `vite build` in 1,98 s, Rust `release` in **1 min 42 s** |
| Quelle | `a4ed758`, Arbeitsbaum sauber |

Gegen den Bau vom 2026-09-14 03:22 (`1c64a6e`, 6 780 416 B) sind das **+4096 Bytes** — eine
Seite. Das gebaute Bündel wuchs um 13 528 Zeichen; das ist M38 an der Oberfläche
(Hinweis, Knöpfe, Dialog, Texte).

### Was im Programm steht

| Gemessen | Wert |
|---|---|
| Inhaltsrichtlinie **wörtlich** in der Binärdatei | **1×** |
| davon `connect-src 'none'` | **1×** |
| `build.devUrl` (`http://localhost:5173/`) in der Binärdatei | 1× |
| Netzberechtigungen in der Konfiguration | **keine** |
| `WebSocket` im gebauten Bündel (2 Dateien, 1 650 291 Zeichen) | **keiner** |

Die Richtlinie steht direkt hinter der Bündelkennung `de.noahhaumersen.worldwar`, im
Klartext und genau einmal.

**Die letzte Zeile ist die eigentliche Nachricht.** `apps/desktop/src/net/websocketTransport.ts`
gibt es seit T-M38-06 und es ist die einzige Stelle im Spiel, die `new WebSocket` sagt —
im ausgelieferten Bündel steht davon **nichts**, weil kein Pfad von `main.tsx` dorthin
führt (der Beitrittsbildschirm ist T-M39-02). `test/guards/ui-reachability.test.ts` führt
die Datei deshalb mit Begründung als Ausnahme, und die Ausnahme ist eine Zusage auf Zeit:
in T-M39-03 wird sie verdrahtet, und dann steht der Transport im Bündel. **Netzfrei bleibt
das Programm auch dann**, denn `connect-src 'none'` verbietet die Verbindung, gleich wer
sie versucht — das ist die Zusage, die trägt, und sie ist oben gemessen.

### Was diese Messung nicht kann, und das gehört dazu

Die **Berechtigungen** sind im Erzeugnis nicht als Text zu finden: `local-only` 0×,
`allow-open` 0×, `dialog:` 0× — während das Wort `dialog` 13× vorkommt, weil das Plugin
gelinkt ist. Tauri backt die Zugriffsliste in eine eigene Darstellung. Sie bleiben deshalb
eine Aussage über die Konfiguration, und das steht im Wächter, statt verschwiegen zu
werden. Umgekehrt findet eine Suche nach `http:` im Programm genau einen Treffer, und der
ist **kein Leck**: es ist `build.devUrl`, das direkt hinter der Richtlinie steht und im
Release-Bau nie benutzt wird. Ein Wächter, der daraus „Netzzugriff im Erzeugnis" machte,
wäre ein Fehlalarm mit Ansage.

### Nachtrag vom 18:40 desselben Tages: neu gebaut heißt neu gemessen

**Der Bau für AK-8 hat diesen Messwert ungültig gemacht, und der Wächter hat es gemerkt.**
`test/guards/packaging.test.ts` liest die exe, *wenn sie auf dieser Maschine liegt*, und
hält ihre Größe gegen `packaging-netfree.json` — nach dem neuen Bau stand dort
`expected 6790144 to be 6789632`, ein roter Lauf. Das ist der Wächter, der seine Arbeit
tut: ein Netzfrei-Bericht über eine exe, die es so nicht mehr gibt, ist kein Bericht.
Deshalb lief `node scripts/measure-netfree.mjs` erneut, und vorher wurde auch das
Gegenprobe-Bündel neu gebaut (`WORLDWAR_MULTIPLAYER=1 … vite build --outDir dist-mp`, 1,60 s),
damit beide Bündel aus **demselben** Stand kommen. Geändert hat sich nur, was sich ändern
musste — Stempel, Größen, Dateiname des Brockens; **keine einzige Aussage**:

| Gemessen am Bau `e82c2bc` (18:55) | Wert | vorher (`d5936cd`) |
|---|---|---|
| Inhaltsrichtlinie wörtlich in der Binärdatei | **1×** | 1× |
| davon `connect-src 'none'` | **1×** | 1× |
| `devUrl` im Programm (kein Leck) | 1× | 1× |
| `WebSocket` im Programm | **0×** | 0× |
| `WebSocket` im gebauten Bündel (2 Dateien, **1 668 947** Zeichen) | **0×** | 0× (1 667 096) |
| Bündel **mit** der Bauflagge (3 Dateien, 1 671 340 Zeichen) | **1×**, `websocketTransport-CaoVH4nW.js` | 1×, `…-oNoror0l.js` |
| Netzberechtigungen in der Konfiguration | **keine** | keine |

Der Abschnitt oben nennt außerdem eine Zusage auf Zeit — in T-M39-03 werde der
WebSocket-Transport verdrahtet, und dann stehe er im Bündel. **T-M39-03 ist gebaut, und er
steht trotzdem nicht darin.** Getragen wird das von der Bauflagge aus T-M39-04:
`__MULTIPLAYER__` ist beim gewöhnlichen Bau ein literales `false`, Rollup schneidet den
Zweig samt dynamischem Import heraus, und `pnpm mp:host` setzt sie für den Browserbau, den
der Hostdienst ausliefert. Die letzte Zeile der Tabelle ist die Gegenprobe dazu: **derselbe
Quelltext mit Flagge nimmt den Transport sehr wohl mit.** Die Zusage wurde damit nicht
gestrichen, sondern tragfähig gemacht — und sie ist jetzt zweimal am Erzeugnis gemessen,
nicht mehr aus Unterlassung erschlossen.

**Was der Nachtrag nicht deckt:** der Wähler „Partieart" im Startdialog bietet „Zu zweit
über einen Link" auch in diesem Bau an, obwohl er ihn nicht herstellen kann (Abschnitt
oben, Befund in `PROBLEME.md`). Das ist eine Frage der Oberfläche, keine des Netzzugriffs —
verbunden wird nichts, es gibt nichts, was verbinden könnte.

**AK-8 ist von diesem Bau vom 15:30 nicht berührt** und war es auch nie: die sieben
Schritte vom 03:24 galten gegen `1c64a6e`, die von heute Abend gelten gegen `e82c2bc`. Der
Frische-Wächter hat sie zwischendurch zu Recht auf ⚠ gestellt. **Wer AK-8 grün haben will,
misst es zuletzt**, nach der letzten Zeile ausgelieferten Codes (die Lehre vom 2026-09-14,
an diesem Tag zweimal gelernt).
