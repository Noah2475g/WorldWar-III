# Touch-Bedienung im Android-Emulator: Prüfstand und Ausgangswert

Stand: 2026-09-24. Zweig `claude/mobile-c-pruefstand`, Werkzeug `scripts/android-check.mjs`
(Aufruf `pnpm android:check`), reine Logik in `scripts/lib/android-check-lib.mjs`, Tests in
`test/android-check.test.ts`.

## Zweck

Noah hat am 2026-09-24 verlangt, dass WorldWar im Android-Emulator (LDPlayer 9) per Finger
einwandfrei bedienbar ist **und dort geprüft werden kann**. Dieser Prüfstand ist der zweite
Teil: Er startet eine Partie so, wie ein Spieler es tut, also per Finger und nicht per Maus,
misst dann neun Dinge und meldet jedes mit PASS oder FAIL und mit Zahlen. Der Exit-Code ist
nur dann 0, wenn alle neun Prüfungen in jedem Lauf bestehen. So kann ein Bot (adb-Tipps und
Bildschirmfotos) oder ein Mensch nach jeder Änderung in einer Minute sehen, ob die
Touch-Bedienung trägt, statt es aus jsdom-Tests zu schließen (WORKFLOW Falle 25).

Der Prüfstand ändert nichts am Spiel. Er liest die Seite über das Chrome DevTools Protocol
(CDP) und gibt Berührungen über `Input.dispatchTouchEvent` ein.

## Verhältnis zur Entscheidung vom 2026-09-12

Die Planung für WorldWar-Mobil hielt am 2026-09-12 fest: „das Desktop-Programm bekommt keine
Mobil-Fassung“ (`WorldWar-Mobil/docs/plan/ENTSCHEIDUNGEN.md`). Diese Arbeit **erweitert diese
Entscheidung bewusst, auf Noahs Anweisung vom 2026-09-24**: Das Desktop-Programm soll im
Android-Emulator per Touch bedienbar und prüfbar werden. Das Mobil-Repository wurde dabei
nicht angefasst. Der Prüfstand liegt vollständig in `scripts/` und `test/`, nicht unter `apps/`
oder `packages/`.

## Einrichtung

**Emulator.** LDPlayer 9, Android 9, Chrome aus dem Emulator (`com.android.chrome`),
Querformat. Typische Einstellungen:

| Emulator | CSS-Pixel | DPR |
|---|---|---|
| 1920x1080 bei 280 dpi | 1097x617 (ohne Chrome-Leisten) | 1,75 |
| 1280x720 bei 320 dpi | 640x360 (ohne Chrome-Leisten) | 2 |

**Chrome im Emulator.** Beim ersten Öffnen zeigt Chrome eine Begrüßung mit
Nutzungsbedingungen. **Die bestätigt der Mensch selbst.** Das Skript stimmt keinen
Bedingungen zu und meldet stattdessen „kein Chrome-Tab gefunden“.

**adb.** Auf dieser Maschine liegen zwei: LDPlayers eigenes `C:\LDPlayer\LDPlayer9\adb.exe`
und `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. Nimm immer dasselbe. Zwei
verschiedene Versionen starten den adb-Server bei jedem Wechsel neu, und bestehende
Weiterleitungen gehen dabei verloren. Das Skript nimmt `--adb <pfad>`, sonst die
Umgebungsvariable `ADB`, sonst `adb` aus dem PATH.

**Das Spiel ausliefern.** Das Skript startet keinen Server. Gemessen wird das gebaute
Bündel, nicht der Dev-Server (WORKFLOW Falle 18). Der Bau kommt aus dem eigenen Worktree
(Falle 9) und ohne Mehrspielerflagge:

```powershell
Remove-Item Env:WORLDWAR_MULTIPLAYER -ErrorAction SilentlyContinue
pnpm desktop:build
pnpm --filter @worldwar/desktop preview --host 127.0.0.1 --port 4192 --strictPort
```

`--host 127.0.0.1` ist wichtig, weil `localhost` unter Windows zuerst `::1` fragen kann.
`--strictPort` verhindert, dass Vite still auf einen anderen Port ausweicht, während
`adb reverse` noch auf den alten zeigt. Jeder Port ist ein eigener Ursprung mit eigenen
Spielständen und eigenem Einführungs-Merker.

**Tunnel.** Das Skript richtet beide selbst ein:

- `adb reverse tcp:4192 tcp:4192`: Im Emulator ist `http://localhost:4192/` das Spiel auf
  dem PC. Das ist ein sicherer Kontext und derselbe Ursprung, den ein Spieler hätte.
- `adb forward tcp:9229 localabstract:chrome_devtools_remote`: CDP zu Chrome im Emulator.
  Eine Weiterleitung, die vor dem Lauf schon bestand, lässt das Skript am Ende stehen.
  Seine eigene räumt es ab. Den `reverse` lässt es stehen, damit die Seite im Emulator
  benutzbar bleibt; wegräumen mit `adb reverse --remove tcp:4192`.

## Befehle

```powershell
# Android (Vorgabe): ein bereites Gerät, sonst --serial
pnpm android:check --adb C:\LDPlayer\LDPlayer9\adb.exe --out C:\temp\ww-check

# Chromium mit Touch-Emulation auf dem PC, zwei Größen nacheinander
pnpm android:check --target chromium --sizes "640x360@2,1097x617@1.75" --url-port 4192

# Hilfe
node scripts/android-check.mjs --help
```

pnpm 11 reicht ein `--` hinter dem Skriptnamen wörtlich durch. Das Skript überliest es,
beide Schreibweisen gehen also.

| Schalter | Bedeutung | Vorgabe |
|---|---|---|
| `--target android\|chromium` | Ziel | `android` |
| `--url <adresse>` | volle Seitenadresse, schlägt `--url-port` | `http://localhost:<port>/?touch=1` (Android), `http://127.0.0.1:<port>/?touch=1` (Chromium) |
| `--url-port <p>` | Port des Spiels | 4192 |
| `--out <ordner>` | Bildschirmfotos und `report.json` | Temp-Ordner `worldwar-android-check\<zeit>` |
| `--adb`, `--serial`, `--devtools-port` | nur Android | `ADB`/`adb`, einziges Gerät, 9229 |
| `--browser`, `--debug-port`, `--sizes` | nur Chromium | Brave, sonst Edge; 9223; `640x360@2,1097x617@1.75` |
| `--long-press-ms`, `--pinch-tolerance` | Dauer des langen Drückens, erlaubter Versatz des Zoom-Ankers | 700 ms, 8 px |

Exit-Code: 0 = alle Prüfungen in allen Läufen bestanden; 1 = mindestens ein FAIL;
2 = Aufbau gescheitert (kein Gerät, kein Browser, Seite antwortet nicht, keine CDP-Verbindung).

**Chromium** heißt ein **sichtbares** Fenster (Brave oder Edge, Google Chrome gibt es auf
dieser Maschine nicht) mit eigenem Profil im Temp-Ordner und `--remote-debugging-port`.
Headless geht nicht, weil Chromium unsichtbare Tabs einfriert (WORKFLOW Falle 17). Das Skript
beendet nur den Browser, den es selbst gestartet hat, und löscht danach sein eigenes Profil.
Je Größe setzt es `Emulation.setDeviceMetricsOverride` (mobile, DPR, Querformat) und
`Emulation.setTouchEmulationEnabled` mit 5 Berührungspunkten.

## Ablauf eines Laufs

1. Die Seite laden, `localStorage['worldwar.tutorial.seen'] = 'true'` setzen, neu laden. Die
   Einführung stört dann nicht, und der Startdialog steht da.
2. „Partie beginnen“ **antippen** (touchStart und touchEnd an der Knopfmitte, vorher in Sicht
   gerollt). Scheitert das, ist der ganze Lauf FAIL mit Grund: Wer die Partie nicht per
   Finger starten kann, kann sie nicht per Finger spielen.
3. Die neun Prüfungen in dieser Reihenfolge: Umgebung, Seitenscroll, Canvas, langes Drücken
   (zuerst, solange nichts gewählt ist), Antippen, Ziehen, Zwei-Finger-Zoom, Zoomknöpfe,
   Touch-Ziele. Die Touch-Ziele werden im Startdialog, in der laufenden Partie und, falls
   etwas gewählt ist, mit geöffneter Provinz gemessen.
4. Nach jedem Schritt ein Bildschirmfoto (`Page.captureScreenshot`).

Gesten setzen **dort auf, wo jeder Finger wirklich die Karte trifft**
(`document.elementFromPoint`). Zuerst kommen Provinzmitten nahe der Kartenmitte, sofern die
Ansicht über den Vertrag lesbar ist, sonst ein Raster mit der Mitte zuerst. Liegt etwas über
der Kartenmitte, steht das im Bericht („Kartenmitte verdeckt von canvas.map-overview“).

## Der Vertrag mit der Anwendung

Die Bahnen A (Gesten) und B (Oberfläche) setzen diese Attribute. Der Prüfstand liest nur sie:

- `:root[data-input]`: `"touch"` oder `"mouse"`. Mit `?touch=1` / `?touch=0` in der Adresse
  lässt es sich erzwingen.
- `div.map-wrapper[data-view-x]`, `[data-view-y]`: Ansicht in Karteneinheiten, gerundet.
- `div.map-wrapper[data-view-scale]`: Karteneinheiten je CSS-Pixel, vier Nachkommastellen.
  **Hineinzoomen macht ihn kleiner.**
- `div.map-wrapper[data-selected-province]`: gewählte Provinz, sonst leer.
- Die Zoomknöpfe tragen `aria-label="Hineinzoomen"` bzw. `"Herauszoomen"`. Die Gruppe
  darüber heißt ebenfalls „Hineinzoomen“, deshalb sucht das Skript ausdrücklich `button[...]`.
- Der Tooltip hat die Klasse `tooltip`.

Fehlt ein Attribut, meldet die betroffene Prüfung FAIL mit dem Attributnamen
(„Vertragsattribut fehlt an div.map-wrapper: data-view-x, …“) und stürzt nicht ab.

## Die neun Prüfungen

| Nr | Prüfung | PASS, wenn |
|---|---|---|
| 1 | Umgebung | `(pointer: coarse)` passt und `:root` trägt `data-input="touch"`; bei Chromium zusätzlich Fenstergröße und DPR wie bestellt. Gemeldet werden auch Chrome-Version, `(hover: none)` und das ausgelieferte Bündel. |
| 2 | Kein Seitenscroll | `scrollWidth <= innerWidth` und `scrollHeight <= innerHeight` (Dokument und `body`) |
| 3 | Touch-Ziele >= 44 px | jedes sichtbare `button`, `select`, `input`, `summary`, `[role=button]`, `a[href]` ist mindestens 44 x 44 CSS-Pixel groß. Ein Häkchen in einem `<label>` zählt mit der Fläche des Labels. Die Liste der Verstöße nennt Selektor, Text und Maße, den kleinsten zuerst, und den Zustand, in dem er lag. |
| 4 | Karten-Canvas | jede Kartenebene in `.map-wrapper` ist mindestens 320 x 240 CSS-Pixel groß, und Bitmap/CSS hat auf beiden Achsen dasselbe Verhältnis (sonst ist sie verzerrt, und Tipps treffen daneben) |
| 5 | Ein-Finger-Ziehen | nach einem Zug (bis 150 x 100 px, 12 Schritte) folgt die Ansicht dem Finger: gleiche Richtung, mindestens 25 % des erwarteten Wegs `-Finger x Maßstab`. `data-selected-province` bleibt unverändert. |
| 6 | Zwei-Finger-Zoom | zwei Finger spreizen sich um den Faktor 1,8. `data-view-scale` sinkt um mindestens 5 %, und der Kartenpunkt unter der Fingermitte verrutscht höchstens 8 px. Gerechnet wird aus den Attributen: Punkt = Ansicht + Mitte x Maßstab, vorher und nachher. |
| 7 | Antippen wählt | nach einem Tipp auf eine Provinz ist `data-selected-province` nicht leer |
| 8 | Langes Drücken | vorher kein `.tooltip`, nach 700 ms Halten und Loslassen einer, **und die Auswahl hat sich nicht geändert**. Kommt der Tooltip nur, weil das Drücken die Provinz gewählt hat, ist das kein Zeigen: Während eines Marschbefehls säße damit das Ziel. |
| 9 | Zoomknöpfe | „Hineinzoomen“ senkt `data-view-scale`, „Herauszoomen“ hebt ihn. Beide Knöpfe sind vorhanden und **nicht verdeckt**, der Finger an der Knopfmitte trifft also den Knopf. |

**Hilfsbeobachtung.** Zu jeder Geste steht in eckigen Klammern, was sich auch ohne Vertrag
beobachten lässt. Sie ändert kein PASS/FAIL, macht aber einen Ausgangswert ohne die Attribute
lesbar:

- **Zeigerereignisse** der Geste (`down`, `move`, `up`, `cancel`) und das Element, auf dem der
  Finger aufsetzte. Ein `pointercancel` heißt, dass der Browser die Geste übernommen hat, um
  die Seite zu rollen oder zu zoomen, und die Karte sie nicht mehr bekommt.
- eine Prüfsumme eines verkleinerten Kartenbilds (hat sich die Karte bewegt?)
- der Wert der Provinzliste in der Seitenleiste (wurde etwas gewählt?)
- `visualViewport.scale` (hat die ganze Seite gezoomt?) und der Rollstand

## report.json lesen

```jsonc
{
  "tool": "scripts/android-check.mjs",
  "measuredAt": "2026-09-24T20:09:03.464Z",   // UTC
  "commit": "1778e03",                        // Stand des Prüfstands, nicht des Spiels
  "target": "chromium", "url": "http://127.0.0.1:4191/?touch=1",
  "browser": "…brave.exe", "browserVersion": "Chrome/153.0.8010.53",   // nur Chromium
  "serial": "emulator-5554", "adb": { "reverse": 4192, "forward": 9229, "forwardExisted": false },  // nur Android
  "settings": { "longPressMs": 700, "pinchTolerancePx": 8, "minTarget": 44 },
  "runs": [{
    "label": "640x360@2",                     // bzw. "android_<serial>"
    "environment": { "userAgent": "…", "innerWidth": 640, "dpr": 2, "pointerCoarse": true, "dataInput": null, "bundle": "./assets/index-….js" },
    "checks": [{ "nr": 1, "id": "environment", "name": "Umgebung", "pass": false, "numbers": { … }, "detail": "…" }, …],
    "screenshots": ["640x360_2-01-startdialog.png", …],
    "error": null                             // gesetzt, wenn die Partie nicht startete
  }],
  "setupError": null,                         // gesetzt bei Exit-Code 2
  "pass": false
}
```

- `checks[].numbers` enthält die Messwerte der Prüfung. Bei 3 stehen dort Summe, Verstöße
  und kleinstes Maß je Zustand, dazu `checks[].violators` mit jedem einzelnen Verstoß. Bei 5
  und 6 stehen dort die Verschiebung, der erwartete Weg, der Ankerversatz in Pixeln und unter
  `aux` die Hilfsbeobachtung vorher und nachher.
- `environment.bundle` sagt, welches Bündel gemessen wurde. Gleicher Dateiname heißt
  gleicher Inhalt (Vite hängt einen Inhaltshash an).
- Die Bildschirmfotos heißen `<lauf>-<nr>-<zustand>.png`. Die Zustände in dieser Reihenfolge:
  `startdialog`, `partie`, `langes-druecken`, `antippen`, `ziehen`, `zwei-finger`,
  `zoomknoepfe`, `provinz`.

## Grenzen der Chromium-Emulation

Die Touch-Emulation eines Desktop-Chromium ist ein Ersatz und nicht der Emulator:

- Sie liefert Touch- und Zeigerereignisse, und der Browser übernimmt Gesten sichtbar (es
  kommen `pointercancel`). Die Folge, die ein Spieler auf dem Gerät sieht, zeigt sie aber
  nicht: Im Ausgangswert unten zoomte bei keinem Zwei-Finger-Zug die ganze Seite
  (`visualViewport.scale` blieb 1). Chrome im Emulator zoomte am selben Tag die Seite von 1
  auf 5 (siehe unten). **Ein PASS unter Chromium ist notwendig, aber nicht hinreichend; die
  Abnahme läuft gegen `--target android`.**
- Chromium meldet unter Touch-Emulation `(hover: none)`. LDPlayer meldet zusätzlich einen
  hover-fähigen Zeiger (`hover: none` ist dort falsch). Wer Regeln an `(hover: none)`
  hängt, sieht sie im Emulator nicht. Deshalb gibt es `data-input`.
- Die sichtbare Höhe im Emulator ist um die Chrome-Leisten kleiner (etwa 120 CSS-Pixel bei
  1097 Breite). 1097x617 unter Chromium entspricht dem Bildschirm, nicht dem Fenster.

## Messungen

### Ausgangswert: unverändertes `main`, Chromium mit Touch-Emulation

Dieser Lauf ist zugleich die **Gegenprobe des Prüfstands selbst**: Gegen das unveränderte
Spiel muss er rot werden, und zwar an den Stellen, an denen die Bedienung heute wirklich
bricht.

- Gemessen: 2026-09-24, 22:09 Uhr MESZ (20:09 UTC, aus `report.json`), mit
  `node scripts/android-check.mjs --target chromium --url "http://127.0.0.1:4191/?touch=1" --sizes "640x360@2,1097x617@1.75"`.
- Spiel: Anwendungscode von `main` = `8bda869`, gebaut im Worktree des Prüfstands (Commit
  `1778e03`; anders sind nur `scripts/`, `test/` und ein Skripteintrag in `package.json`),
  `WORLDWAR_MULTIPLAYER` nicht gesetzt,
  Bündel `index-B1aHSitH.js` (1 667 102 Byte, derselbe Hash wie auf `main`), ausgeliefert mit
  `vite preview --host 127.0.0.1 --port 4191 --strictPort`.
- Browser: Brave, `Chrome/153.0.8010.53`, sichtbares Fenster, eigenes Profil.
- Ergebnis: **Exit-Code 1. 0 von 9 bei 640x360@2, 2 von 9 bei 1097x617@1.75.** Ein zweiter
  Lauf mit demselben Stand ergab dieselben Zahlen.
- Belege (nicht eingecheckt, keine Bilder in git): `report.json` und 15 Bildschirmfotos im
  Scratchpad der Sitzung unter `baseline-main\`.

| Nr | Prüfung | 640x360 @ DPR 2 | 1097x617 @ DPR 1,75 |
|---|---|---|---|
| 1 | Umgebung | FAIL: `data-input` fehlt (pointer: coarse ja, hover: none ja, Chrome 153) | FAIL: dasselbe |
| 2 | Kein Seitenscroll | FAIL: Seite 640x**527** bei 360 sichtbar, **167 px** Überstand; die Fußleiste ist abgeschnitten | PASS: 1097x617, 0 px |
| 3 | Touch-Ziele | FAIL: Startdialog **10 von 10** unter 44 px (Knöpfe 28 hoch, Felder 29), Partie **39 von 40**, kleinstes 14x14 (`explain__toggle` „Was ist …?“) | FAIL: Startdialog 10/10, Partie 39/40, Provinz gewählt **40 von 41**, kleinstes 14x14 |
| 4 | Karten-Canvas | FAIL: CSS **260x162,5**, Bitmap 320x240, Verhältnis 1,231 zu 1,477, also verzerrt und zu klein | PASS: CSS 717x435,5, Bitmap 717x436 (Verhältnis 1 zu 1,001; ohne DPR, also unscharf) |
| 5 | Ein-Finger-Ziehen | FAIL: Vertrag fehlt. Zeiger: down 1, move **3**, **cancel 1**; der Browser übernahm nach drei Bewegungen. Kartenmitte **verdeckt von der Übersichtskarte** | FAIL: Vertrag fehlt. Zeiger: down 1, move **2**, **cancel 1**, Kartenbild bewegt |
| 6 | Zwei-Finger-Zoom | FAIL: Vertrag fehlt. Zeiger: down 2, move 24, cancel 0, Kartenbild bewegt (laut Code gibt es nur einen Ziehpunkt, der zweite Finger überschreibt den ersten); Seitenzoom 1 → 1 | FAIL: Vertrag fehlt. Zeiger: down 2, move 14, **cancel 2**; Seitenzoom 1 → 1 |
| 7 | Antippen wählt | FAIL: Vertrag fehlt. Der Tipp traf die Karte, gewählt wurde **nichts** (Provinzliste leer). Vermutete Ursache laut Code: Bei 260 px Breite laufen Zeichnung (Bitmap mindestens 320x240) und Trefferrechnung auseinander, und die Startansicht legt die Hauptstadt auf den Punkt (480, 300), also außerhalb der Karte | FAIL: Vertrag fehlt (Provinzliste zeigt „CAN-WEST“ aus Schritt 8) |
| 8 | Langes Drücken | FAIL: kein Tooltip vorher, beim Halten oder danach | FAIL: Tooltip erst nach dem Loslassen, weil das Drücken **„CAN-WEST“ wählte**; der Tooltip war der der Auswahl |
| 9 | Zoomknöpfe | FAIL: beide Knöpfe (26x24) **verdeckt**; der Finger traf `canvas.map-overview`, und das Kartenbild änderte sich trotzdem (die Übersichtskarte setzt die Ansicht auf den getroffenen Punkt) | FAIL: Vertrag fehlt. Knöpfe 26x24 getroffen, Kartenbild änderte sich |

Was die Zahlen sagen: Bei 640x360 ist die Karte 260 x 162 px groß. Übersichtskarte und
Legende bedecken gut ein Drittel davon (nach dem Bildschirmfoto), die Kartenmitte
eingeschlossen, und die Seite ist 167 px höher als der Bildschirm. Bei beiden Größen übernimmt
der Browser das Ziehen nach zwei bis drei Bewegungen (`pointercancel`); auf der Karte steht
kein `touch-action`. Außer der Übersichtskarte (132x74, das einzige Ziel ohne Verstoß)
erreicht kein Bedienelement 44 x 44 px. Und langes Drücken wählt die Provinz, statt sie zu
zeigen.

### Zum Vergleich: am echten Emulator, von Hand

Nicht mit diesem Prüfstand gemessen, sondern am selben Abend (etwa 21:55 Uhr) mit einem
Hilfsskript über dasselbe CDP und `Input.dispatchTouchEvent`, gegen dasselbe Bündel
`index-B1aHSitH.js` auf `127.0.0.1:4189`. Gerät: LDPlayer 9.5.37.0, Android 9 (API 28),
1920x1080 bei 280 dpi; Chrome 124.0.6367.82 (zugleich WebView-Anbieter).

| Messung | Wert |
|---|---|
| sichtbarer Bereich | 1098 x 498 CSS-Pixel (Tabs und Adresszeile etwa 120 px), DPR 1,75 |
| `(pointer: coarse)` / `(hover: none)` | ja / **nein** |
| Seitenhöhe | 594 bei 498 sichtbar: **die Seite rollt 96 px** |
| Touch-Ziele | Startdialog 10 von 10 unter 44 px, im Spiel 40 von 41, kleinstes 14 px |
| Ziehen mit einem Finger (170 x 70 px) | die Karte folgt etwa 11 px, also rund 6 % |
| Zwei-Finger-Zoom (60 → 220 px) | **`visualViewport.scale` 1 → 5**: Die ganze Seite zoomt, nicht die Karte |
| langes Drücken (900 ms) | kein Tooltip |

Das bestätigt den Chromium-Ausgangswert und zeigt seine Grenze: Den Seitenzoom sieht nur
das Gerät.

### Nach den Änderungen der Bahnen A und B

**Port 4190 geht nicht — deshalb ist die Vorgabe jetzt 4192.** 4190 steht auf der Sperrliste, die
die Fetch-Spezifikation und Chromium teilen (registrierter ManageSieve-Port): Node meldet `fetch
failed` mit der Ursache `bad port`, noch bevor ein Browser die Seite lädt, und jeder Lauf endete
mit Exit-Code 2. Die Vorgabe in `scripts/lib/android-check-lib.mjs`, `scripts/android-check.mjs`
und diesem Dokument ist auf **4192** gewechselt; ein Test in `test/android-check.test.ts` hält
alle drei Vorgabeports von der Sperrliste fern.

- Gemessen: 2026-09-25, 00:06 Uhr MESZ (22:06 UTC, aus `report.json`), Prüfstand-Commit
  `c0fbd61` (nach den Fusionen der Bahnen A, B, C auf `claude/mobile-bedienung-android` und
  zwei Korrekturen am Prüfstand selbst, siehe unten), mit
  `node scripts/android-check.mjs --target chromium --url "http://127.0.0.1:4192/?touch=1" --sizes "640x360@2,1097x617@1.75"`.
- Spiel: `WORLDWAR_MULTIPLAYER` nicht gesetzt, `pnpm desktop:build`, ausgeliefert mit
  `vite preview --host 127.0.0.1 --port 4192 --strictPort`.
- Browser: Brave, `Chrome/153.0.8010.53`, sichtbares Fenster, eigenes Profil.
- Ergebnis: **Exit-Code 0. 9 von 9 bei 640x360@2, 9 von 9 bei 1097x617@1.75.**
- Belege (nicht eingecheckt, keine Bilder in git): `report.json` und Bildschirmfotos im
  Scratchpad der Sitzung unter `integrator\integrated-chromium3\`.

| Nr | Prüfung | 640x360 @ DPR 2 | 1097x617 @ DPR 1,75 |
|---|---|---|---|
| 1 | Umgebung | PASS: `data-input="touch"`, pointer:coarse ja, hover:none ja, Chrome 153 | PASS: dasselbe |
| 2 | Kein Seitenscroll | PASS: 640x360, 0 px Überstand | PASS: 1097x617, 0 px |
| 3 | Touch-Ziele | PASS: Startdialog 0/10, Partie 0/34, Provinz gewählt 0/70 unter 44 px | PASS: Startdialog 0/10, Partie 0/39, Provinz gewählt 0/75 unter 44 px |
| 4 | Karten-Canvas | PASS: CSS 396,8x246,5, Bitmap 794x494 (Verhältnis 2,001/2,004) | PASS: CSS 757x375,5, Bitmap 1325x658 (Verhältnis 1,75/1,752) |
| 5 | Ein-Finger-Ziehen | PASS: Finger −119/−62 px, Ansicht 191/100 (erwartet 190/99), Auswahl blieb "USA-MW" | PASS: Finger −150/−94 px, Ansicht 240/151 (erwartet 240/150), Auswahl blieb "USA-MW" |
| 6 | Zwei-Finger-Zoom | PASS: Maßstab 1,6 → 0,8836 (×0,552), Anker-Versatz 0,3 px | PASS: Maßstab 1,6 → 0,8871 (×0,554), Anker-Versatz 0,4 px |
| 7 | Antippen wählt | PASS: "USA-MW" gewählt (vorher leer) | PASS: dasselbe |
| 8 | Langes Drücken | PASS: Tooltip erst beim Halten, Auswahl unverändert | PASS: dasselbe |
| 9 | Zoomknöpfe | PASS: Hineinzoomen 0,8836→0,7363 (44x44 px), Herauszoomen 0,7363→0,8836 (44x44 px) | PASS: Hineinzoomen 0,8871→0,7393 (44x44 px), Herauszoomen 0,7393→0,8871 (44x44 px) |

Der Weg von 0/9 (640x360) bzw. 2/9 (1097x617) auf 9/9: `data-input` und der ganze Vertrag
(`data-view-*`, `data-selected-province`) sind gesetzt, die Karte ist über beide Größen
scharf (Bitmap-Verhältnis 1:1 bzw. 2:1 wie DPR), kein Ziehen wird mehr vom Browser
übernommen (kein `pointercancel` mehr in den Hilfsbeobachtungen), langes Drücken wählt
nicht mehr, und jedes Bedienelement erreicht 44 x 44 px — die 26 kleinen "?"-Knöpfe
(`.explain__toggle`, sichtbar weiter 22x22 px) über eine vergrößerte, unsichtbare
Trefferfläche (`::after`, `inset: -11px`, touch.css), gemessen mit der Prüfstand-Korrektur
von Commit `d76a92e` (siehe unten). Ausnahme davon: der Erklär-Knopf "Was ist Besitz?" in
der Kartenlegende zählt nicht mehr mit, weil er `pointer-events: none` von `.legend` erbt
und dadurch unabhängig von seiner Größe für keinen Eingabeweg erreichbar ist — ein
vorbestehender Befund in `app.css` (nicht Teil dieser Bahnen, siehe Risiken).

**Korrekturen am Prüfstand selbst** (Commit `d76a92e`, nach dieser Sitzung nötig, weil die
erste Messung mit dem fertigen Vertrag noch 8/9 statt 9/9 zeigte): `pageTargets()` maß bis
dahin nur die Layout-Box des Elements und zählte deshalb 26 `.explain__toggle`-Knöpfe als zu
klein, obwohl ein Finger sie über die vergrößerte `::after`-Fläche trifft; die Funktion liest
jetzt `getComputedStyle(el, '::after'|'::before')` und nimmt die größere Fläche. Und: ein
Element mit (vererbtem) `pointer-events: none` zählt nicht mehr mit, siehe "Was ist Besitz?"
oben.

### `?touch=0` bei 1280x800@1 (Maus-Betrieb, zum Vergleich)

Zielgrößen-Prüfungen gelten nicht im Maus-Betrieb (dieselbe Seite bleibt bei 24 px hohen
Knöpfen); informativ mitgemessen:

- Befehl: `node scripts/android-check.mjs --target chromium --url "http://127.0.0.1:4192/?touch=0" --sizes "1280x800@1"`.
- Ergebnis: Exit-Code 1 (2 von 9), aber genau die zwei erwarteten Prüfungen weichen ab, beide
  informativ, kein Rückschritt:
  - Nr 1 Umgebung: FAIL nur weil `data-input="mouse"` statt der vom Prüfstand fest erwarteten
    `"touch"` ist — beabsichtigt bei `?touch=0`.
  - Nr 3 Touch-Ziele: FAIL mit denselben 24-28-px-Knöpfen wie vor dieser Arbeit — beabsichtigt,
    Bahn B lässt den Maus-Betrieb unverändert (Vertrag: "mouse mode renders exactly as before").
  - Nr 2 Kein Seitenscroll: **PASS**, 1280x800 bei 1280x800 sichtbar, 0 px Überstand.
  - Nr 4 Karten-Canvas: **PASS**, CSS 900x636,5, Bitmap 900x637 (Verhältnis 1/1,001) — weit über
    der Mindestgröße 320x240.
  - Nr 5–9 (Ziehen, Zoom, Antippen, langes Drücken, Zoomknöpfe): alle **PASS** — die Gesten
    funktionieren technisch auch im Maus-Betrieb, weil der Prüfstand sie über
    `Input.dispatchTouchEvent` auslöst; das sagt nichts über echte Maus-Bedienung aus.

### Chromium-Emulation: notwendig, nicht hinreichend

Alle Zahlen im Abschnitt oben sind **Chromium-Emulation** (Desktop-Fenster mit
`Emulation.setDeviceMetricsOverride`/`setTouchEmulationEnabled`), kein LDPlayer. Wie unter
"Grenzen der Chromium-Emulation" oben beschrieben, ist ein PASS hier notwendig, aber nicht
hinreichend — insbesondere fehlte dort der Seitenzoom-Befund vom echten Gerät (dort zoomte die
ganze Seite 1→5 bei Zwei-Finger-Zoom). Der Lauf mit `--target android` gegen LDPlayer folgt
unten.

### Am echten Emulator (LDPlayer) nach den Änderungen

Gemessen: 2026-09-25, 00:20–00:23 Uhr MESZ (22:20–22:23 UTC, aus `report.json`), Prüfstand- und
Spielstand `b11a091` (Bahnen A/B/C gemergt), `WORLDWAR_MULTIPLAYER` nicht gesetzt, `pnpm
desktop:build` (Bündel `index-BVvTxDrX.js`), ausgeliefert mit `vite preview --host 127.0.0.1
--port 4192 --strictPort`. Gerät: LDPlayer 9.5.37, Instanz 0, Android 9 (API 28), Chrome
124.0.0.0 (com.android.chrome). Befehl je Lauf:

```powershell
node scripts/android-check.mjs --target android --adb C:\LDPlayer\LDPlayer9\adb.exe --url-port 4192 --out <ordner>
```

Belege (nicht eingecheckt, keine Bilder in git): `report.json` und je 9 Bildschirmfotos im
Scratchpad der Sitzung unter `em-after-tablet\` und `em-after-phone\`, dazu ein `screencap.png`
je Auflösung.

**Lauf A — 1920x1080 @ 280 dpi (aktuelle/tablet-artige Auflösung).** Sichtbar 1098x498 CSS-px,
DPR 1,75. **Ergebnis: Exit-Code 0, 9 von 9 bestanden.**

| Nr | Prüfung | Ergebnis |
|---|---|---|
| 1 | Umgebung | PASS: 1098x498 CSS-px, DPR 1,75, Chrome 124, pointer:coarse ja, hover:none **nein**, data-input touch |
| 2 | Kein Seitenscroll | PASS: 1098x498 bei 1098x498 sichtbar, 0 px Überstand |
| 3 | Touch-Ziele | PASS: Startdialog 0/10, Partie 0/39, Provinz gewählt 0/75 unter 44 px |
| 4 | Karten-Canvas | PASS: CSS 758,3x258,9, Bitmap 1327x453 (Verhältnis 1,75 / 1,75) |
| 5 | Ein-Finger-Ziehen | PASS: Finger −150/−65 px, Ansicht 240/104 (erwartet 240/104), Auswahl blieb "USA-MW" |
| 6 | Zwei-Finger-Zoom | PASS: Maßstab 1,6 → 0,8914 (×0,557), Anker-Versatz 0,7 px |
| 7 | Antippen wählt | PASS: "USA-MW" gewählt (vorher leer) |
| 8 | Langes Drücken | PASS: kein Tooltip vorher, während des Haltens ja, Auswahl unverändert |
| 9 | Zoomknöpfe | PASS: Hineinzoomen 0,8914→0,7429 (44,0x44,0 px); Herauszoomen 0,7429→0,8914 (44,0x44,0 px) |

**Lauf B — 1280x720 @ 320 dpi (telefonartige Auflösung, Querformat).** Sichtbar **640x280**
CSS-px (nicht die vorher angenommenen ~304 — Chrome nimmt hier gut 80 CSS-px für Tabs und
Adresszeile), DPR 2. **Ergebnis: Exit-Code 1, 7 von 9 bestanden.**

| Nr | Prüfung | Ergebnis |
|---|---|---|
| 1 | Umgebung | PASS: 640x280 CSS-px, DPR 2, Chrome 124, pointer:coarse ja, hover:none **nein**, data-input touch |
| 2 | Kein Seitenscroll | PASS: 640x280 bei 640x280 sichtbar, 0 px Überstand |
| 3 | Touch-Ziele | PASS: Startdialog 0/10, Partie 0/34, Provinz gewählt 0/70 unter 44 px |
| 4 | Karten-Canvas | **FAIL**: CSS 396,8x**166,5**, Bitmap 794x480 (Verhältnis 2,001 / **2,883**) — unter 320x240 **und** verzerrt |
| 5 | Ein-Finger-Ziehen | PASS: Finger −119/−42 px, Ansicht 191/97 (erwartet 190/67 → 144 % in Y), Auswahl blieb "USA-SOUTH" |
| 6 | Zwei-Finger-Zoom | **FAIL**: Maßstab 1,6 → 0,8889 (×0,556), Anker-Versatz **16,4 px** (erlaubt 8) |
| 7 | Antippen wählt | PASS: "USA-SOUTH" gewählt (vorher leer) |
| 8 | Langes Drücken | PASS: kein Tooltip vorher, während des Haltens ja, Auswahl unverändert |
| 9 | Zoomknöpfe | PASS: Hineinzoomen 0,8889→0,7407 (44x44 px); Herauszoomen 0,7407→0,8889 (44x44 px) |

#### Ursache der zwei FAILs bei 1280x720 (kein Rückschritt, ein Grenzfall)

Beide FAILs haben **dieselbe Wurzel** und sind kein neuer Fehler der Bahnen A/B/C, sondern ein
bereits im Code beschriebener, bewusster Kompromiss, der bei dieser Auflösung erstmals
greift:

- `MapCanvas.tsx` (`update()`, Zeile ~318) hält die interne Ansichtsgröße nie unter 320x240:
  `Math.max(320, element.clientWidth)` / `Math.max(240, element.clientHeight)`. Grund steht in
  `picking.ts` bei `toCanvasPoint` (Kommentar): "Die Leinwand rechnet mit `bufferW` x `bufferH`
  Punkten (mindestens 320 x 240) ... Ist die Hülle kleiner ..., staucht der Browser das Bild.
  Hier wird die Stauchung herausgerechnet." Das ist also **so gebaut**, damit Antippen und
  Ziehen auch auf einer winzigen Karte noch die richtige Provinz treffen — der Preis ist ein
  optisch gestauchtes Bild, wenn die echte Hülle kleiner als 320x240 CSS-px ist.
- Bei 1280x720@320 bleiben der Karte real nur **166,5** von 240 CSS-px Höhe (Kopf- und
  Fußleiste sind laut `touch.css`, `@media (max-height: 480px)`, bereits auf eine Zeile
  respektive 45 px zusammengestrichen — dort ist kaum noch etwas zu holen, ohne Kopf- oder
  Fußleiste ganz zu verstecken). Der Stauchfaktor in der Höhe ist 240 / 166,5 = **1,441**.
- Dieser eine Faktor erklärt beide FAILs und einen Wert, der noch PASS blieb, ohne
  Zusatzannahme:
  - Prüfung 4: Bitmap/CSS-Verhältnis 2,883 / 2,001 = 1,441.
  - Prüfung 6: der Anker einer Zwei-Finger-Geste wird in Y um denselben Faktor verstärkt
    verschoben abgebildet, deshalb 16,4 statt der erlaubten 8 px.
  - Prüfung 5 (PASS, aber auffällig): Ansicht folgte dem Finger in Y zu 144 % statt der
    erwarteten 100 % — exakt der Faktor 1,441. Die Prüfung besteht trotzdem, weil ihre
    Schwelle nur "mindestens 25 %" verlangt, nicht "höchstens 100 %".
- Die Chromium-Messung vom 2026-09-24 (Abschnitt oben) zeigte das nicht, weil dort keine der
  beiden Testgrößen (640x360, 1097x617) unter 240 CSS-px Höhe fiel. Das Gerät hier tut es,
  weil Chrome im Emulator gut 80 CSS-px für Tabs/Adresszeile nimmt (mehr als die im Vorlauf
  angenommenen ~120 px bei 1097 Breite, aber bei nur 640 Breite reicht auch das, um unter
  240 zu fallen).

Eingeordnet: 1280x720 im Querformat ist eine der kürzesten Auflösungen, die ein Telefon
überhaupt zeigt — ein modernes, schlankeres Gerät (z. B. 19,5:9) hätte im Querformat sogar
**weniger** Höhe je Breiteneinheit, nicht mehr. Dass die Karte selbst unter dieser Bedingung
noch trifft, wo man tippt (Prüfungen 5, 7, 8, 9 alle PASS, nur mit sichtbar verstärktem statt
exaktem Weg), ist genau der Zweck des 320x240-Bodens. Eine echte Behebung der Prüfungen 4/6
würde entweder die App zwingen, mit einer Karte unter 240 CSS-px Höhe zu rechnen (bricht dann
möglicherweise die Treffergenauigkeit, die der Boden gerade sichert) oder Kopf-/Fußleiste noch
enger fassen (`app.css`, außerhalb der erlaubten Dateien für diese Sitzung, und `touch.css` hat
für diese Zeilen schon das Minimum). Es wurde daher **keine Schwelle abgesenkt und keine
Zeile Code geändert** — dies ist ein dokumentierter Grenzfall einer extrem kurzen Auflösung,
kein Rückschritt gegenüber dem Ausgangswert (der bei keiner seiner beiden Größen unter diese
Grenze fiel).

#### Vorher/Nachher gegen den echten Emulator (Ausgangswert vs. nach den Bahnen A/B/C)

Ausgangswert aus `em-baseline.md` (2026-09-24, ~21:55 Uhr, von Hand mit Hilfsskript, 1920x1080
@ 280 dpi, Chrome 124.0.6367.82); "Nachher" ist Lauf A oben (derselbe Auflösungs-Typ, jetzt mit
diesem Prüfstand statt Hilfsskript, Chrome 124.0.0.0):

| Messung | Vorher (Ausgangswert) | Nachher (Lauf A, 1920x1080@280) |
|---|---|---|
| Touch-Ziele < 44 px | 40 von 41 | **0 von 39** (Partie), 0/10 Startdialog, 0/75 Provinz gewählt |
| Seitenhöhe vs. sichtbar | 594 bei 498 sichtbar, **96 px Rollweg** | 498 bei 498 sichtbar, **0 px** |
| Ein-Finger-Ziehen | Karte folgt ~11 px (**≈ 6 %** von 170x70 px Weg) | Karte folgt zu **100 %** des erwarteten Wegs |
| Zwei-Finger-Zoom | `visualViewport.scale` 1 → **5**: die ganze **Seite** zoomt | `data-view-scale` 1,6 → 0,89: die **Karte** zoomt, Seite bleibt bei 1, Anker-Versatz 0,7 px |
| Langes Drücken (900/700 ms) | kein Tooltip | Tooltip erscheint während des Haltens, Auswahl bleibt leer |
| Bitmap/CSS (Schärfe) | 718x416 CSS-px, Bitmap 718x416 (kein DPR, unscharf bei 1,75) | 758,3x258,9 CSS-px, Bitmap 1327x453 (Verhältnis 1,75/1,75, scharf) |

Damit bestätigt sich am echten Gerät, was die Chromium-Messung vom 2026-09-24 schon zeigte,
und zusätzlich der einzige Befund, den nur das echte Gerät liefern konnte: Der Seitenzoom
(„die ganze Seite zoomt, nicht die Karte") ist behoben — `visualViewport.scale` blieb in
beiden LDPlayer-Läufen bei 1, während `data-view-scale` den Zoom trägt.

#### Randnotiz: Chrome-Tab nach Auflösungswechsel

Nach `ldconsole modify --resolution` und einem Neustart der Instanz fand der erste Lauf bei
1280x720 keinen Chrome-Tab über CDP (`kein Chrome-Tab mit http://localhost:4192/?touch=1 ueber
tcp:9229 - ist Chrome eingerichtet ... und im Vordergrund?`, Aufbaufehler, kein PASS/FAIL-Lauf).
Ein Bildschirmfoto zeigte den Tab tatsächlich schon korrekt auf der Spielseite (Startdialog
sichtbar) — der zweite Versuch, ohne weiteres Zutun, fand ihn sofort. Vermutlich war die
CDP-Zielliste unmittelbar nach dem Neustart der App noch nicht bereit. Kein Code- oder
Prüfstandsfehler; beim nächsten Mal einfach erneut versuchen.

#### Auflösung wiederhergestellt

Nach Lauf B: `ldconsole quit --index 0`, `ldconsole modify --index 0 --resolution
1920,1080,280`, danach erneut `launch` + Boot abgewartet und mit `adb shell wm size`/`wm
density` **live bestätigt**: 1920x1080, 280 dpi. Anschließend `adb reverse --remove tcp:4192`
und `adb forward --remove tcp:9229` (beide bereits durch den Neustart der Instanz entfernt,
adb meldete „listener not found" — ungefährlich), `ldconsole quit --index 0` (Emulator bleibt
aus), Vorschau-Server (eigene PID) beendet, Port 4192 frei.
