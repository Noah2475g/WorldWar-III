# AK-8 — der Spielstand überlebt den Programmneustart

Gemessen am **2026-09-07** gegen `1c33ec7` (T-M16-05), am gebauten Programm und nicht im
Browser. Der Bericht gilt für genau diesen Stand.

> **Warum diese Datei existiert:** AK-8 stand seit dem 2026-09-05 in C-02 und hatte bis
> zum 2026-09-06 keinen Ort, an dem es geprüft wird. Eine Zusage ohne Messung ist genau
> die Fehlerklasse, die dieses Projekt schon zweimal Sitzungen gekostet hat. Hier steht,
> was tatsächlich gelaufen ist — nicht, was gelten soll.

## Das Erzeugnis

| | |
|---|---|
| `worldwar.exe` | 7 864 320 Bytes (7,50 MiB) |
| `WorldWar_0.1.0_x64_en-US.msi` | 2 945 024 Bytes |
| `WorldWar_0.1.0_x64-setup.exe` | 2 207 714 Bytes (NSIS) |
| Bauzeit | 3 min 27 s (`release`, LTO, `opt-level = "s"`) |
| Bauergebnis | Exit 0 |

## Der Ablauf, Schritt für Schritt

| # | Handlung | Beobachtung |
|---|---|---|
| 1 | `worldwar.exe` gestartet | Fenster „WorldWar" da, Prozess antwortet |
| 2 | Partie begonnen (Tastatur) | Weltkarte, Vereinigte Staaten, Tag 1 · 00:00 |
| 3 | Strg+S → „Speichern" auf Stand 1 | **`%APPDATA%/de.noahhaumersen.worldwar/saves/stand-1.json`, 96 198 Bytes** |
| 4 | Programm beendet | Prozess weg, Datei bleibt |
| 5 | `worldwar.exe` erneut gestartet | Startdialog, keine laufende Partie |
| 6 | „Spielstände" im Startdialog | **„Stand 1 — Tag 1"** in der Liste; alle anderen „leer" und ausgegraut |
| 7 | „Laden" auf Stand 1 | Partie läuft wieder, Tag 1 · 00:00, Protokoll: „Die Partie beginnt." |

**AK-8 ist erfüllt.** Der Ordner war vor Schritt 1 nicht vorhanden — der Ausgangspunkt
war sauber, die Datei ist in diesem Lauf entstanden.

## Was dieser Lauf nebenbei belegt

- **Der Datei-Port arbeitet im Programm** (T-M16-04), nicht nur gegen eine Nachbildung im
  Test: die Tauri-Berechtigungen `fs:allow-appdata-read-recursive` und
  `…-write-recursive` greifen, das Plugin ist registriert, und der Ordner `saves/` wird
  beim ersten Schreiben angelegt.
- **Schritt 6 ist zugleich der Nachweis für T-M12-07** (Playtest-Befund 26a). Genau das
  war nicht möglich: die Liste öffnete nur Strg+S, und ohne laufende Partie wirkte die
  Tastenkombination nicht — wer das Fenster geschlossen hatte, kam an seinen Spielstand
  nicht mehr heran. Der Weg über den Startdialog ist der, den die Reparatur gebaut hat.
- Im selben Dialog steht **kein** „Speichern"-Knopf, weil es ohne laufende Partie nichts
  zu speichern gibt.
- Auf dem Bildschirm aus Schritt 2 sind zwei weitere Reparaturen zu sehen: der Knopf
  „Spielstände" in der Kopfleiste und die Wirtschaftsspalten „Unterhalt" und „In Auftrag"
  (T-M12-10 a/b).

## Zweimal gemessen, und warum

Der erste Lauf (2026-09-07, gegen `c7dd2c1`) hat AK-8 ebenso erfüllt, mit demselben
Ergebnis in allen sieben Schritten. Er wird hier trotzdem **nicht** als die Messung
geführt, weil sein Erzeugnis den damals aktuellen Code nicht enthielt: `Dialogs.tsx`
wurde um 01:59 geändert, das Bündel war um 01:56 gebaut. Nachgewiesen am Bündel selbst —
es trug die alte Fokusliste, nicht die aus T-M16-07.

Für AK-8 hätte das nichts geändert; der Fokusfang hat mit Spielständen nichts zu tun.
Aber ein Bericht, der auf ein Erzeugnis zeigt, in dem der beschriebene Code nicht
steckt, ist genau die Falschaussage, die am 2026-09-06 schon einmal Zeit gekostet hat —
`acceptance.md` meldete damals einen Stand von **vor** der Reparatur, während die Datei
daneben das Gegenteil auswies. Also wurde neu gebaut und neu gemessen.

Der zweite Lauf ist auch der bessere Beleg. Beim ersten sprang die Tastatur im
Startdialog nicht dorthin, wo sie sollte — mit dem Fokusfang tut sie es, und auf dem
Bild aus Schritt 6 steht der Fokusring auf dem Schließen-Kreuz. Das ist R-UI-15/AK1 am
gebauten Programm beobachtet, nebenbei und ungeplant.

## Grenzen dieser Messung

- Sie lief auf **einem** Rechner (Windows 11), aus dem gebauten Ordner heraus
  — **nicht aus einer Installation** über MSI oder Setup. Ob der Installationspfad
  dieselben Rechte hat, ist damit nicht gemessen.
- Die Bedienung geschah über `SendKeys` und Mausereignisse, nicht durch einen Menschen.
  Was ein Mensch dabei empfindet, steht in AK-7 und ist davon unberührt.
