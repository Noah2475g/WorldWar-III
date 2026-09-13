# AK-8 — der Spielstand überlebt den Programmneustart

Gemessen am **2026-09-14** gegen `2c52356`, am gebauten Programm und nicht im Browser.
Der Bericht gilt für genau diesen Stand.

> **Warum diese Datei existiert:** AK-8 stand seit dem 2026-09-05 in C-02 und hatte bis
> zum 2026-09-06 keinen Ort, an dem es geprüft wird. Eine Zusage ohne Messung ist genau
> die Fehlerklasse, die dieses Projekt schon mehrfach Sitzungen gekostet hat. Hier
> steht, was tatsächlich gelaufen ist — nicht, was gelten soll.

## Das Erzeugnis

| | |
|---|---|
| `worldwar.exe` | **6 780 416 Bytes** (6,47 MiB), geschrieben am **2026-09-14 00:41:25** |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 813 952 Bytes |
| `WorldWar_0.1.0_x64-setup.exe` (NSIS) | 2 141 188 Bytes |
| Bau | `pnpm tauri:build`, **Exit 0**, Wanduhr 2 min 19 s (00:39:07–00:41:26); Rust `release`-Profil in 2 min 01 s |
| Quelle | während des Baus unangefasst (`git status` sauber bei Baubeginn, erste Schreiboperation nach 00:41:26) |

Zum Vergleich: das Bündel vom 2026-09-13 00:28 war 6 776 832 Bytes groß, das vom
2026-09-08 noch 7 933 952 Bytes. Die 3 584 Bytes Unterschied zum Vortag sind der
Schlussstand von M41, M40 und M35; der große Sprung gegen den 2026-09-08 stammt aus
T-M28-03, das `tauri-plugin-fs` samt Berechtigungen aus dem Programm entfernt hat.

## Wie gemessen wurde

Nicht von Hand, sondern über `docs/plan/schlussblock/ak8-cdp.mjs` — dasselbe Muster wie
die Falsifikationskette vom 2026-09-08: das Programm startet mit
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, das Skript spricht
über CDP mit der laufenden WebView2 und klickt über die **Knopftexte**, die ein Spieler
auch sieht.

```bash
node docs/plan/schlussblock/ak8-cdp.mjs apps/desktop/src-tauri/target/release/worldwar.exe <ausgabe>
```

Der Lauf dauerte **8 Sekunden** (00:45:26–00:45:34) und hinterließ `ak8-ergebnis.json`
und sechs Bildschirmfotos. Das Skript bricht ab, wenn `saves` nicht leer ist, und es
beendet nur die Prozesse, die es selbst gestartet hat — **gelöscht wird nichts**.

**Noahs Spielstände waren währenddessen geparkt, nicht gelöscht:** `saves` hieß für die
Dauer der Messung `saves.geparkt-2026-09-14`, danach wieder `saves`; die Dateien der
Messung liegen unter `saves.messung-2026-09-14`. Beide Listen — vorher und nachher —
nennen dieselben zwei Dateien mit derselben Größe, derselben Uhrzeit und derselben
SHA-256-Summe (`autosave-0.json.json` 334 237 B, `zeitreihe.autosave-0.json.json`
8 784 B, beide 2026-09-09 23:08).

## Der Ablauf, Schritt für Schritt (Ausgangspunkt: `saves/` leer)

| # | Handlung | Beobachtung (aus `ak8-ergebnis.json`) |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Startdialog „Neue Partie", Knöpfe im Rumpf: **„Partie beginnen \| Spielstände"** — **kein** „Weiterspielen", richtig, es gibt keinen Stand |
| 2 | „Partie beginnen" geklickt | Weltkarte, Vereinigte Staaten, Uhr **„Tag 1 · 00:00"**; die Ankündigungen aus M41 stehen da („Neu ab heute: Kaserne / Infanterie") |
| 3 | Strg+S → in der Zeile „Stand 1" auf „Speichern" | Zeile vorher „Stand 1 — leer", danach **„Stand 1 — Tag 1"**, Meldung „Gespeichert." Auf der Platte: `stand-1.json` (96 954 B) **und `zeitreihe.stand-1.json`** (26 B) — die M25-Zeitreihe wandert mit, an Tag 1 · 00:00 noch ohne Eintrag |
| 4 | Programm beendet | Prozessbaum weg, **beide Dateien bleiben liegen** |
| 5 | `worldwar.exe` erneut gestartet | Startdialog, Knöpfe in dieser Reihenfolge: **„Weiterspielen (Tag 1)" \| „Partie beginnen" \| „Spielstände"** — der Wiedereinstieg steht zuerst (T-M22-04) |
| 6 | „Spielstände" geprüft | Zeile **„Stand 1 — Tag 1"**, einziger Knopf **„Laden"** und **nicht gesperrt**. Kein „Speichern" — ohne laufende Partie gibt es nichts zu sichern (T-M12-07) |
| 7 | „Weiterspielen (Tag 1)" geklickt | Partie läuft: **„Tag 1 · 00:00"**, eigene Provinzen, Wirtschaft zeichengleich mit Schritt 2 (667 / 667 / 333 / 333 / 167 / 67 / 1.667), Protokoll „Die Partie beginnt." |

**AK-8 ist erfüllt** — sieben von sieben Schritten, Exit 0 (`AK-8 ERFÜLLT`).

## Zwei Befunde am Steuerskript (beim ersten Lauf überhaupt)

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

## Was dieser Lauf nebenbei belegt

- Der Startdialog (Titel, Fassung, Weiterspielen) und die Ankündigungen aus M41 laufen im
  gebauten Programm, nicht nur im Test.
- Die Zeitreihe (M25) wandert je Slot als Nachbardatei mit.
- Die fünf Hüllen-Kommandos aus T-M28-03 tragen den ganzen Weg: schreiben, auflisten,
  wiederlesen — über zwei Programmstarts hinweg.
- Bekannter Kleinbefund bleibt: Autosave-Dateien heißen `autosave-N.json.json`
  (der Kern-Slotname trägt `.json`, die Hülle hängt ein zweites an) — funktional
  folgenlos, da Schreiben und Lesen symmetrisch sind; notiert in PROBLEME.md.

## Grenzen dieser Messung

- Ein Rechner (Windows 11), aus dem gebauten Ordner — nicht aus einer Installation
  über MSI/Setup.
- Bedienung über CDP mit Bildschirmfoto nach jedem Schritt; was ein Mensch dabei
  empfindet, steht in AK-7 und ist davon unberührt.
- Die Partie wurde an **Tag 1 · 00:00** gespeichert. Dass ein weit fortgeschrittener
  Stand ebenso zurückkommt, zeigt diese Messung nicht — dafür steht Noahs eigene
  Autosave-Datei (334 237 B) und der Golden-Master der Serialisierung.

---

# Geschichte

## Die Messung vom 2026-09-08 (gegen den M28-Stand, T-M28-03)

Erzeugnis: `worldwar.exe` 7 933 952 Bytes (7,57 MiB), `release`, LTO, Exit 0.

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
> 2026-09-08 und der Lauf vom 2026-09-14 darüber.

> Die alten Messdaten vom 2026-09-08 lagen geparkt in
> `%APPDATA%/de.noahhaumersen.worldwar/saves.geparkt-2026-09-08` (nichts gelöscht); dieser
> Ordner war am 2026-09-14 nicht mehr vorhanden.
