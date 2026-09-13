# Sichtprüfung der sieben Punkte im Browser (2026-09-14)

Schritt 3.5 der Übergabe (`docs/plan/UEBERGABE.md` §3.5). Geprüft wird am laufenden Spiel im echten
Browser, je Punkt mit einem Beleg. Kein Produktivcode wurde angefasst, kein Spielstand gelöscht.

## Stand und Umgebung

| | |
|---|---|
| Commit | `1759386b142aace0df8d6c40c583995833dd7c74` („docs(reports): AK-8 am gebauten Programm nach M41, M40 und M35") |
| Zweig | `claude/offene-punkte-abschliessen`, Arbeitsbaum vor der Messung sauber |
| Browser | **Brave** `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` — Google Chrome ist auf dieser Maschine nicht installiert |
| Steuerung | CDP über `--remote-debugging-port=9223`, eigenes `--user-data-dir`, **kein `--headless`** |
| Fenster | sichtbar und im Vordergrund, gemessen: `document.visibilityState` „visible", `document.hasFocus()` `true`, `requestAnimationFrame` **145 Bilder/s** bei stehender Uhr |
| Dev-Server | `pnpm --filter @worldwar/desktop dev --port 5174 --strictPort` (Vite 7.3.6, „ready in 275 ms") |
| Gebautes Bündel | `vite build` + `vite preview --port 5175 --strictPort` — dasselbe Bündel, das Tauri lädt |
| Maschinenlast beim Messen | `LoadPercentage 4`…`12`, kein Spiel, kein zweiter Testlauf |

**Belegt, dass der Server den Code dieses Zweigs ausliefert** (das ist hier schon einmal schiefgegangen):
`curl http://localhost:5174/src/i18n/de.ts` enthält `stanceGarrisonHint` und
`adjutantMarch: "{{army}} rückt von selbst nach {{province}} nach."`, `…/src/game/events.ts` enthält
`GOAL_REACHED`. Alle drei Bezeichner gibt es **nur auf diesem Zweig**:

```
adjutantMarch            main:0 branch:1
stanceGarrisonHint       main:0 branch:1
GOAL_REACHED             main:0 branch:1
```

Dasselbe für das gebaute Bündel: `assets/index-DaOTQzkr.js` enthält „rückt von selbst nach",
„Bleibt stehen, was auch geschieht" und `GOAL_REACHED`.

**Partien** (alle mit eigener Startzahl **20260914**, Weltkarte „Welt (237)", 7 Gegner, normal, Siegbedingung
Punkte): A Deutschland am Dev-Server, B Russland am Dev-Server, C Deutschland und D Russland am gebauten
Bündel. Der Dev-Server und `vite preview` haben je einen eigenen Ursprung — sie sehen die Spielstände des
Programms nicht und legen keine an. `%APPDATA%\de.noahhaumersen.worldwar\saves` war vorher und nachher
`autosave-0.json.json` (334 237 B) und `zeitreihe.autosave-0.json.json` (8 784 B), unverändert.

**Fensterhöhe:** die Läufe am Dev-Server liefen im Fenster 1584 × 911, die späteren am gebauten Bündel in
1080 × 1791. Das gebaute Bündel hatte also die **größere** Zeichenfläche (1,93 gegen 1,44 Megapixel) — die
Uhr lief dort trotzdem schneller (Punkt 1).

---

## 1 · Die Uhr bei Tempo 100 (T-M41-04) — **erfüllt**

**Zusage:** Tempo 100, zehn Sekunden Echtzeit → die Spielzeit rückt ≈ 1000 Ticks (≈ 41 Tage) vor, nicht ≈ 600.

**Gesehen, am gebauten Bündel** (Partie C, zwei abgelesene Uhrzeiten, `performance.now()` dazwischen):

| | Uhr | Tick | `performance.now()` |
|---|---|---|---|
| Ablesung 1 | **Tag 44 · 10:00** | 1042 | 44 608 ms |
| Ablesung 2 | **Tag 84 · 15:00** | 2007 | 54 619 ms |

Echtzeit **10,011 s**, **965 Ticks**, **40,21 Spieltage** → **Tickrate 96,4 Ticks/s** (Soll 1001).
`clockStep` über genau die gemessenen Bildzeiten verlangt 987 Ticks — die Uhr liefert, was die Formel
hergibt. Bildrate 34,3/s, Bildzeit Median 27,8 ms, p95 48,6 ms, max 76,5 ms.

**Am Dev-Server erreicht dieselbe Partie die Zusage nicht**: drei Läufe ergaben **65,4 / 57,0 / 47,3
Ticks/s**. Das ist kein Fehler der Uhrformel: auf der Kleinen Welt (12 Provinzen) liefert derselbe
Dev-Server **999 Ticks in 10,02 s = 99,7 Ticks/s**. Die Ursache ist gemessen: ein umhülltes
`requestAnimationFrame` zählte in einem Lauf **127 Bilder der Spielschleife**, `clockStep` über deren
Bildzeiten verlangt **635 Ticks**, die Uhr rückte **325** vor — und ein `MutationObserver` auf
`.clock__time` zählte nur **65 Commits**, von denen **jeder genau 5 Ticks** sprang (die Kappe
`clockCap(100) = 5`). Etwa jedes zweite Bild rechnet seine fünf Ticks aus dem Stand des letzten Commits
und überschreibt damit das Bild davor. Im gebauten Bündel (ohne React-Entwicklungsbau und ohne das
doppelte Rendern unter `StrictMode`) passiert das praktisch nicht: 987 verlangt, 965 geliefert.

**Urteil: erfüllt.** Das Programm, das Noah spielt, lädt das gebaute Bündel; dort hält die Zusage mit
96,4 Ticks/s und 40 Spieltagen in zehn Sekunden. Der Befund zum Dev-Server steht in `PROBLEME.md`
(2026-09-14, Punkt 1) — mit der Lehre, dass die Uhr **am gebauten Bündel** zu messen ist, nicht am
Dev-Server.

**Beleg:** `sichtpruefung-2026-09-14/p1-uhr-vorher.png` (Kopfleiste „Tag 44 · 00:00", Tempo 100 gedrückt),
`…/p1-uhr-nachher.png` („Tag 85 · 00:00" — die Bilder klammern das Messfenster, die genauen Ablesungen
stehen in `p1-uhr-bau.json`), dazu `p1-uhr-dev.json` für den Dev-Server.

---

## 2 · Tempo im Vorspulen gesperrt (T-M41-13) — **nicht geprüft**

**Zusage:** Während „Vorspulen" sind die Tempoknöpfe `disabled` und nennen im Tooltip den Grund.

**Gesehen:** nichts — die Lage lässt sich im Browser nicht herstellen. Beide Auslöser rufen
`fastForwardRun({ kind: 'days', days: 1 })` = 24 Ticks, und `DEFAULT_CHUNK_TICKS` ist ebenfalls 24. Der Lauf
ist damit **genau ein Häppchen** und endet synchron im Klick; `running: true` und `running: false` liegen im
selben JS-Zug, React spielt nur den zweiten ein.

Gemessen in Partie A (Tag 7 · 18:00): der Klick auf „Vorspulen" dauerte **31 ms** (an Tag 79 derselben
Partie 206 ms). Über drei Sekunden zählte ein `MutationObserver` auf `.speeds` **0 Mutationen**, und ein
Abtaster auf jedem Bild sah in **429 Abtastungen keinen einzigen gesperrten Knopf**. Vor dem Klick,
unmittelbar danach und drei Sekunden später trägt jeder Tempoknopf seinen normalen Tooltip
(„100 Stunden je Sekunde"), keiner ist `disabled`.

**Urteil: nicht geprüft** — Grund: der gesperrte Zustand wird nie gerendert. T-M41-13 hat das selbst notiert
(„heute nicht herstellbar"; der Test verkleinert die Häppchen per Hülle auf 4 Ticks). Neu ist nur, dass es
jetzt am laufenden Spiel gemessen ist; Befund in `PROBLEME.md` (2026-09-14, Punkt 2).

**Beleg:** DOM-Auszug, Tempogruppe vor, unmittelbar nach und drei Sekunden nach dem Klick — jeweils
`{ t: "100", disabled: false, title: "100 Stunden je Sekunde" }`; `mutationen: []`, `jeGesperrtGesehen: null`,
`abtastungen: 429`.

---

## 3 · Die Ankündigung (T-M41-03 / T-M41-12) — **erfüllt**

**Zusage:** zwei Tage vor einer Freischaltung „In zwei Tagen: …" mit der fehlenden Voraussetzung; bleibt
nach dem Vorspulen den Tag über sichtbar; bei niedrigerer vorhandener Stufe „Ihre beste steht auf Stufe N".

**Gesehen** — alle drei Teile:

1. **Ohne fehlende Voraussetzung** (Partie A, Tag 4 · 07:00, Hafen wird an Tag 6 frei):
   `In zwei Tagen: Hafen.` — Klasse `alert alert--upcoming`, Wegklick-Knopf mit Tooltip
   „Bis zum Ende des Spieltags ausblenden".
2. **Mit Voraussetzung und nach dem Vorspulen** (Partie A): von Tag 7 · 18:00 einen Tag vorgespult, die Uhr
   steht danach auf **Tag 8 · 18:00** — also weit hinter dem alten Zwölf-Tick-Fenster —, und die Meldung
   steht da: **„In zwei Tagen: Transportschiff. Dafür braucht es einen Hafen — Sie haben keinen."**
3. **Bei niedrigerer vorhandener Stufe** (Partie D, gebautes Bündel): an Tag 28 eine Fabrik befohlen, an
   Tag 34 steht sie auf Stufe 1; an **Tag 68 · 05:00** kündigt das Spiel den Schweren Kampfpanzer (Tag 70,
   verlangt Fabrik der Stufe 2) so an: **„In zwei Tagen: Schwerer Kampfpanzer. Dafür braucht es eine Fabrik
   der Stufe 2 — Ihre beste steht auf Stufe 1."**
   Gegenprobe ohne Fabrik (Partie B, Tag 68 · 07:00): „… — **Sie haben keine.**"

**Urteil: erfüllt.**

**Beleg:** `sichtpruefung-2026-09-14/p3-tag8.png` (Kopfleiste „Tag 8 · 18:00", daneben die Meldung mit dem
Hafen-Satz) und `…/p3c-tag68.png` („Ihre beste steht auf Stufe 1").

---

## 4 · Die Haltungsgruppe 2 × 2 (T-M40-05 / -11 / -14) — **erfüllt**

**Zusage:** vier Haltungen mit Erklärtext; Anhalten und ein eigener Marsch stellen eine Armee auf
Verteidigung auf Garnison; die Hinweise nennen die Folgen.

**Gesehen:**

- **Zwei mal zwei, gemessen an der Kaskade am laufenden Spiel:** `getComputedStyle(.stances)`
  `grid-template-columns: "169px 169px"` — zwei Spalten, vier Knöpfe: **Angriff · Verteidigung / Rückzug ·
  Garnison**. Die Vorgabe ist **Verteidigung** (`aria-pressed="true"`, gesperrt mit dem Grund „Die Armee hat
  diese Haltung schon.").
- **Die Erklärtexte stehen an den Knöpfen** (`title`) und nennen Folgen und Kosten:
  - Angriff: „Kämpft mit Angriffswerten statt eingegraben und marschiert nie von selbst."
  - Verteidigung: „Bleibt eingegraben stehen. Steht in ihrer Provinz noch eine weitere Armee, rückt sie von
    selbst in eine bedrohte eigene Nachbarprovinz nach; allein marschiert sie nie. Nach einem Marsch oder
    Rückzug ruht sie **5 Tage** ab dem Abmarsch, nicht ab der Ankunft; ein eigener Marschbefehl stellt sie
    auf Garnison."
  - Rückzug: „Weicht von selbst in eine Nachbarprovinz aus und steht danach auf Verteidigung. Kostet
    **10 %** der Stärke, danach **1 Tag** kein Angriff und **4 h** halbe Kampfkraft."
  - Garnison: „Bleibt stehen, was auch geschieht, und marschiert nie von selbst; kämpft wie die Verteidigung."
- **Eigener Marsch → Garnison** (Partie D, Armee 1011 in Zentralrussland): vor dem Befehl Haltung
  **Verteidigung**, „Auf dem Marsch: Steht". Marsch nach Nordwestrussland befohlen (Vorschau
  „Nordwestrussland: Ankunft Tag 106, 16:00"), Tag 93 · 23:00 → nach dem Weiterlaufen, Tag 94 · 04:00:
  Haltung **Garnison**.
- **Anhalten → Garnison:** die Armee wieder auf Verteidigung gestellt (Tag 94 · 07:00, sie marschiert, der
  Knopf „Anhalten" ist frei und sein Tooltip sagt die Folge: **„Hält an und stellt auf Garnison, damit sie
  nicht von selbst wieder losmarschiert."**). Nach dem Klick und dem nächsten Tick, Tag 94 · 10:00: Haltung
  **Garnison**, der Knopf „Garnison" gedrückt.

**Urteil: erfüllt.**

**Beleg:** `sichtpruefung-2026-09-14/p4-haltungen.png` (die 2 × 2-Gruppe, Verteidigung gedrückt) und
`…/p4b-garnison.png` (dieselbe Armee nach dem Anhalten: „Haltung Garnison", Knopf Garnison gedrückt).

---

## 5 · Die leise Meldung „rückt nach" (T-M40-13) — **erfüllt**

**Zusage:** zwei eigene Armeen auf Verteidigung in einer Provinz, Feind nebenan → eine Protokollzeile,
nicht laut.

**Hergestellt** (Partie B, Russland): in Zentralrussland Kaserne gebaut, zwölf Infanterie ausgehoben und die
Armee **geteilt** — zwei eigene Armeen (254 / Stärke 7 und 5 / Stärke 7) in einer Provinz, beide auf der
Vorgabehaltung Verteidigung. An Tag 22 Ukraine den Krieg erklärt, danach die Uhr laufen lassen.

**Gesehen:** an Tag 67 · 18:00 steht im Protokoll

```
67 · 18:00  Armee 254 marschiert nach Nordwestrussland.
67 · 18:00  Armee 254 rückt von selbst nach Nordwestrussland nach.
```

Die Zeile trägt die Klasse **`log__row`**, nicht `log__row--alert` — sie ist also **leise**: keine
Alarmfarbe, kein Alarmschild in der Kopfleiste, kein Sprung auf die Karte. Im selben Ausschnitt steht
darunter „Gefecht bei Slowenien." in Rot (`log__row--alert`); der Unterschied ist im Bild zu sehen.
Sie führt das Zeichen der Rubrik „Kämpfe" und einen Knopf „Zur Provinz springen".

**Urteil: erfüllt.**

**Beleg:** `sichtpruefung-2026-09-14/p5-rueckt-nach.png` (die Zeile hervorgehoben, darüber der eigene
Marschbefehl, darunter eine laute Gefechtszeile zum Vergleich).

---

## 6 · Die Zwischenziele in der Rangliste (T-M35-05) — **erfüllt**

**Zusage:** vier Zeilen mit Abstand bzw. erreichtem Tag, kein leerer Kasten.

**Gesehen** (Partie A, Tag 8 · 18:00, Kasten „Zwischenziele" im Ranglisten-Panel):

| Zeichen | Ziel | Stand |
|---|---|---|
| ○ | 25 eigene Provinzen | noch 21 Provinzen |
| ○ | 40 % aller Punkte | noch 29,9 Prozentpunkte |
| ○ | 35 % der Weltbevölkerung | noch 33,2 Prozentpunkte |
| ○ | 60 % aller Punkte | noch 49,9 Prozentpunkte |

Vier Zeilen, jede mit Zeichen, Satz und Abstand; der Kasten trägt die Überschrift „Zwischenziele" und ist
nicht leer. Die Bevölkerungsmarke steht bei **35 %** — das sind die 350 ‰ aus D31, nicht die früheren 300.

**Ein erreichtes Ziel war in keiner der vier Partien zu sehen** (Deutschland fiel auf eine Provinz, Russland
kam bis Tag 140 auf sechs) — die Spalte „erreicht an Tag N" ist damit **nicht** am Bildschirm belegt; die
Zusage nennt Abstand *bzw.* Tag, und der Abstand steht in allen vier Zeilen.

**Urteil: erfüllt.**

**Beleg:** `sichtpruefung-2026-09-14/p6-zwischenziele.png`.

---

## 7 · Gefechte im Vorspulen (T-M28-08) — beschrieben, **ohne Urteil**

> Das Urteil bleibt Noahs Maßstab. Hier steht nur, was zu sehen war.

**Hergestellt:** Partie B, Krieg mit Ukraine (selbst erklärt) und mit Polen (Polen marschierte ein),
laufende Gefechte von Tag 60 bis Tag 140 an mehreren Fronten.

**Was die Karte zeigt, wenn im aktuellen Tick wirklich gekämpft wird** (Tag 124 · 14:00, Gefecht in
Zentralrussland, Uhr angehalten, drei Stufen hineingezoomt): um das Armeeplättchen liegt ein **roter
Schein** mit **Ring** und den **Einschlagzeichen** ringsum — deutlich, ohne das Protokoll zu lesen. Dazu:
ein rotes Alarmschild in der Kopfleiste („Einmarsch: Zentralrussland"), eine rote Zeile im Provinzpanel
(„Kampf in Zentralrussland"), die umkämpfte Provinz orange umrandet, und das Hinweisfenster der Provinz sagt
„Gefecht — Runde 1". Armeen im Gefecht tragen einen roten Plättchenrahmen.

**Wie lange das steht.** Ein Gefecht dauert ein bis drei Spielstunden. Bei **Tempo 10** ist eine Spielstunde
rund 100 ms, bei **Tempo 100** rund 10 ms — also eine bis wenige Bildzeiten. Gemessen: 110 Bildschirmfotos
im Abstand der Aufnahmedauer (~120 ms) über rund 135 Spieltage bei Tempo 10 trafen **zwei** Bilder, in denen
in der gezeigten Provinz gerade gekämpft wurde; in einem weiteren Lauf mit 60 Aufnahmen **keines**. Die
meiste Zeit zeigt die Karte also **keinen** Gefechtsschein, obwohl das Protokoll fortlaufend Gefechte
meldet. Was bei Tempo 10 und 100 durchgehend zu sehen ist, sind die **roten Plättchenrahmen** der
kämpfenden Armeen, die **rot umrandete** umkämpfte Provinz und das **Alarmschild** in der Kopfleiste.

**Im „Vorspulen" ist gar nichts zu sehen.** Ein Vorspul-Lauf ist ein Spieltag in einem einzigen
synchronen Zug (gemessen 206 ms an Tag 79); dazwischen zeichnet der Browser nicht. Vor dem Klick standen im
Protokoll die Gefechte bis Tag 79 · 10:00, nach dem Klick die bis Tag 79 · 18:00 — die Gefechte des
vorgespulten Tages sind also passiert, aber kein einziges davon wurde je gezeichnet. Die Kopfleiste sagt
danach „Angehalten nach 1 Tag: ein Spieltag ist vorbei."

**Beleg:** `sichtpruefung-2026-09-14/p7-gefecht-nah.png` (Schein, Ring, Einschlagzeichen und „Gefecht —
Runde 1" bei angehaltener Uhr).

---

## Was daraus folgt

| Punkt | Urteil |
|---|---|
| 1 Uhr bei Tempo 100 | **erfüllt** (96,4 Ticks/s am gebauten Bündel; am Dev-Server 47–65, Befund eingetragen) |
| 2 Tempo im Vorspulen gesperrt | **nicht geprüft** — der Zustand wird nie gerendert |
| 3 Ankündigung | **erfüllt** (alle drei Teile) |
| 4 Haltungsgruppe 2 × 2 | **erfüllt** |
| 5 Leise Meldung „rückt nach" | **erfüllt** |
| 6 Zwischenziele | **erfüllt** |
| 7 Gefechte im Vorspulen | beschrieben, **ohne Urteil** (Noahs Maßstab) |

Zwei Befunde stehen in `docs/plan/PROBLEME.md` (beide 2026-09-14, beide **nicht gebaut**):
die Uhr am Dev-Server und die nicht sichtbare Tempo-Sperre im Vorspulen. `PROBLEME.md` hatte vor und nach
der Bearbeitung **7 CR-Bytes**.

Browser, Dev-Server und Vorschau-Server sind am Ende beendet worden; Noahs Spielstände unter
`%APPDATA%\de.noahhaumersen.worldwar\saves` sind unverändert.
