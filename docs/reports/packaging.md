# AK-8 — der Spielstand überlebt den Programmneustart

Gemessen am **2026-09-08** gegen den M28-Stand (T-M28-03), am gebauten Programm und
nicht im Browser. Der Bericht gilt für genau diesen Stand.

> **Warum diese Datei existiert:** AK-8 stand seit dem 2026-09-05 in C-02 und hatte bis
> zum 2026-09-06 keinen Ort, an dem es geprüft wird. Eine Zusage ohne Messung ist genau
> die Fehlerklasse, die dieses Projekt schon mehrfach Sitzungen gekostet hat. Hier
> steht, was tatsächlich gelaufen ist — nicht, was gelten soll.

## Das Erzeugnis

| | |
|---|---|
| `worldwar.exe` | 7 933 952 Bytes (7,57 MiB) |
| `WorldWar_0.1.0_x64_en-US.msi` + NSIS-Setup | unter `src-tauri/target/release/bundle/` |
| Bau | `release`, LTO, Exit 0, Quelle während des Baus unangefasst |

## Der Ablauf, Schritt für Schritt (Ausgangspunkt: `saves/` leer)

| # | Handlung | Beobachtung |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Startdialog mit Titelzeile (M22), **kein** „Weiterspielen" — richtig, es gibt keinen Stand |
| 2 | Partie begonnen | Weltkarte, Vereinigte Staaten, Tag 1 · 00:00; Führung „Schritt 1 von 10" |
| 3 | Strg+S → „Speichern" auf Stand 1 | „Gespeichert." **und die Zeile wird sofort „Stand 1 — Tag 1"**, Laden aktiv. Auf der Platte: `stand-1.json` (96 216 B) **und `zeitreihe.stand-1.json`** — die M25-Zeitreihe wandert mit |
| 4 | Programm beendet | Prozess weg, Dateien bleiben |
| 5 | `worldwar.exe` erneut gestartet | Startdialog zeigt als ersten Knopf **„Weiterspielen (Tag 1)"** (T-M22-04, erstmals am Programm gemessen) |
| 6 | „Spielstände" geprüft | „Stand 1 — Tag 1" in der Liste, Laden aktiv |
| 7 | „Weiterspielen (Tag 1)" geklickt | Partie läuft: Tag 1 · 00:00, eigene Provinzen, Wirtschaft identisch, Protokoll „Die Partie beginnt." |

**AK-8 ist erfüllt** — einschließlich des neuen Weiterspielen-Wegs.

## Der Befund, der diese Messung zu einer Reparatur machte

Der **erste** Lauf des Tages (Bündel gegen `36b63a8`, noch mit `tauri-plugin-fs`)
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
**sechs eigenen, engen Kommandos der Hülle** (`saves_list` … `saves_exists` in
`src-tauri/src/main.rs`): sie nehmen einen Datei**namen** an, nie einen Pfad
(Separatoren und `..` werden verweigert, nicht bereinigt), und berühren
ausschließlich `$APPDATA/saves`. Das fs-Plugin und seine Berechtigungen sind
entfernt — weniger Oberfläche als vorher.

> **Zur Messung vom 2026-09-07 (gegen `1c33ec7`):** sie berichtete Schritt 6 als
> bestanden. Mit identischem Storage-Code, identischen Berechtigungen und identischen
> Crate-Versionen (Cargo.lock/pnpm-lock unverändert) ist das heute **nicht
> reproduzierbar** — derselbe Schritt scheiterte vor der Reparatur zuverlässig. Die
> alte Messung bleibt als nicht nachvollziehbar markiert; maßgeblich ist dieser Lauf.

## Was dieser Lauf nebenbei belegt

- Der neue Startdialog (Titel, Weiterspielen) und die Zehn-Schritte-Führung (M24)
  laufen im gebauten Programm.
- Die Zeitreihe (M25) wandert je Slot als Nachbardatei mit.
- Bekannter Kleinbefund bleibt: Autosave-Dateien heißen `autosave-N.json.json`
  (der Kern-Slotname trägt `.json`, die Hülle hängt ein zweites an) — funktional
  folgenlos, da Schreiben und Lesen symmetrisch sind; notiert in PROBLEME.md.

## Grenzen dieser Messung

- Ein Rechner (Windows 11), aus dem gebauten Ordner — nicht aus einer Installation
  über MSI/Setup.
- Bedienung über simulierte Eingaben mit Screenshot-Kontrolle vor jedem Klick; was
  ein Mensch dabei empfindet, steht in AK-7 und ist davon unberührt.
- Die alten Messdaten von gestern liegen geparkt in
  `%APPDATA%/de.noahhaumersen.worldwar/saves.geparkt-2026-09-08` (nichts gelöscht).
