---
type: report
projekt: WorldWar
betrifft: M37, M38, M39 — die Oberfläche am laufenden Programm
erstellt: 2026-09-14
gemessen_gegen: claude/mehrspieler-m37-m39
---

# Sichtprüfung des Mehrspielers in zwei Fenstern (2026-09-14)

Der Vorschlag aus `docs/reports/mehrspieler-anleitung.md` §6, ausgeführt: *„öffne beide Links in
zwei Fenstern desselben Rechners. Das geht ohne Tailscale und zeigt in zwei Minuten, ob die
Oberfläche stimmt; es erfüllt AK-9 nicht, aber es findet, was jsdom nicht sieht."*

Es hat mehr als zwei Minuten gedauert und **vier Befunde** gefunden, von denen der erste
verhinderte, dass überhaupt etwas zu sehen war. Drei sind repariert, einer ist eine Frage an
Noah. **AK-9 ist damit nicht erfüllt** — dafür braucht es Noah und einen zweiten Menschen in
einem anderen Netz; hier stand nur eine Maschine.

## Stand und Umgebung

| | |
|---|---|
| Zweig | `claude/mehrspieler-m37-m39`, Arbeitsbaum vor der Messung sauber (`87595a3`) |
| Browser | **Brave** `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` (Chrome 153) — Google Chrome ist auf dieser Maschine nicht installiert |
| Steuerung | CDP über `--remote-debugging-port=9223` (Gastgeber) und `9224` (Gast), je ein eigenes `--user-data-dir`, **kein `--headless`** (WORKFLOW §4 Falle 17) |
| Fenster | zwei sichtbare Fenster nebeneinander, je 1254 × 1235 px auf 2560 × 1440; gemessen `document.visibilityState` „visible", `requestAnimationFrame` **145** und **146** Bilder/s |
| Dienst | `pnpm mp:host` — baut `dist` mit `WORLDWAR_MULTIPLAYER=1` (1,6 s) und horcht auf Port **7749** auf allen Schnittstellen |
| Adresse | beide Fenster über `http://192.168.178.93:7749/…`, **nicht** über die Rückschleife |
| Partie | Weltkarte „Welt", Gastgeber **Vereinigte Staaten**, Gast **Kanada**, 7 Gegner (davon 6 Computer), Siegbedingung Punkte, feste Rate **25** Spielstunden je Sekunde, Startzahl 20260914 |

**Eine Flagge war nötig, und sie gehört genannt.** Beide Fenster meldeten zunächst
`visibilityState: "hidden"` — ein anderes Fenster lag darüber; Chromium hält dann `rAF` an und
drosselt `setInterval` auf **1,5 bis 2,5 Aufrufe je Sekunde** (gemessen). Der Gleichschritt
hängt an `setInterval` (`useNetplay.ts`: *„Kein `requestAnimationFrame` … ein verdecktes
Fenster hält rAF an"*), liefe unter dieser Drosselung also mit zwei statt fünfundzwanzig Ticks
je Sekunde. Die Fenster wurden deshalb mit `--disable-features=CalculateNativeWinOcclusion`
gestartet. Das schaltet nur die Verdeckungsrechnung ab; die Seite läuft unverändert, und die
145 Bilder/s danach sind dieselben wie bei der Sichtprüfung des Einzelspielers am selben Tag.

**Was einmal passierte und hier stehen soll:** nach rund zwanzig Minuten laufender Partie waren
beide Browserfenster verschwunden — ohne Absturzbericht in `Crashpad/reports`, ohne dass ein
Skript sie geschlossen hätte. Sie wurden neu gestartet, und es kam nicht wieder vor. Ursache
ungeklärt; es ist **kein** belegter Befund am Spiel.

---

## 1 · Der Beitrittsbildschirm — **erfüllt**

**Zusage (R-MP-12/AK1):** sechs Angaben vor dem Namensfeld, Knopf ohne Namen gesperrt, das
Geheimnis nicht in der Anfragezeile.

**Gesehen** — fünf Listenzeilen, in denen alle sechs Angaben stehen (die beiden Nationen teilen
sich eine Zeile):

```
Diese Partie:
  · Karte: Welt
  · Sie spielen Kanada, Ihr Gastgeber Vereinigte Staaten
  · Computergegner: 6
  · Siegbedingung: Punkte
  · Feste Geschwindigkeit: 25 Spielstunden je Sekunde
Die Geschwindigkeit steht für die ganze Partie fest, und Vorspulen gibt es zu zweit nicht.
```

Darunter, vor dem Namensfeld, der Satz über den offenen Spielstand („einen Schummelschutz gibt
es nicht"), dann erst „Ihr Name" und *Beitreten*. Die Reihenfolge im Baum ist gemessen:
**Bedingungen zuerst**.

**Der Knopf ist ohne Namen gesperrt** — `[{"t":"Beitreten","disabled":true}]`; mit Namen
`disabled: false`.

**Das Geheimnis steht nicht in der Anfragezeile.** Gemessen in der Seite des Gastes:

| | |
|---|---|
| `location.search` | `""` |
| `location.hash` | `#/beitreten?raum=gubM5G9m&s=-xjd-NUpLhTn9ZTa6mlt_A` |
| angefragt | `/` |

Und was der Dateiserver wirklich zu sehen bekam, aus der Netzansicht des Browsers: sechs
Adressen (`/assets/index-…js`, `…css`, `websocketTransport-…js`, drei Schriften) — **keine**
trägt `s=` oder `raum=`.

**Beleg:** `sichtpruefung-mehrspieler-2026-09-14/1-gast-beitrittsbildschirm.png`.

---

## 2 · Die Lobby beim Gastgeber — **erfüllt**, mit einer Beschreibung zum Kopier-Knopf

**Zusage (R-MP-12/AK2, T-M39-03):** der Gastgeber sieht, wer wartet, und die Partie beginnt auf
seinen Klick.

**Die drei Zustände, alle drei gesehen:**

| Lage | Was in der Lobby steht |
|---|---|
| niemand da | „Es wartet noch niemand. Der Link ist erst nützlich, wenn er angekommen ist." |
| da, noch ohne Namen | „Jemand hat den Link geöffnet und trägt gerade seinen Namen ein." |
| da, mit Namen | „Mitspieler Max wartet auf den Start." |

*Partie starten* ist in den ersten beiden Lagen **gesperrt** und wird erst mit dem Namen frei
(gemessen, beide Zustände).

**Die Partie beginnt nicht, wenn die Verbindung steht.** Beide Seiten sechs Sekunden lang
beobachtet, während der Gast schon beigetreten war: die Uhr des Gastgebers blieb auf
**Tag 1 · 00:00**, der Gast hatte gar keine. Erst der Klick löste den Handschlag aus.

**Was der Kopier-Knopf wirklich tut** (die Frage aus dem Auftrag — der Bericht der Vorsitzung
sagt „er markiert das Feld"; das stimmt, und hier stehen die Zahlen dazu):

| | |
|---|---|
| `window.isSecureContext` | `false` |
| `typeof navigator.clipboard` | `"undefined"` |
| Auswahl im Feld vor dem Klick | 77 – 77 (nichts markiert) |
| Auswahl im Feld nach dem Klick | **0 – 77** von 77 Zeichen |
| Knopfbeschriftung danach | **„Kopiert."** |

Es wird also nichts in die Zwischenablage geschrieben — es gibt über `http` keine, und das ist
die dokumentierte Lage (D28.10). Markiert wird der **ganze** Link, Strg+C danach trägt. Dass
der Knopf trotzdem „Kopiert." sagt, ist die einzige Stelle im Mehrspieler, an der das Programm
etwas behauptet, das es nicht getan hat. Ob das stört, ist Noahs Maßstab; gemessen ist, dass
die Zwischenablage nicht beschrieben wurde.

**Was im Bild noch zu sehen ist, ohne Urteil:** die Lobby liegt **über der fertig aufgebauten
Welt** — Karte, Wirtschaftstabelle, Rangliste und der Lernpfad („Schritt 1 von 10") stehen
schon da, während der Gastgeber auf seinen Gast wartet. Das Eingabefeld ist schmaler als der
Link und zeigt ihn abgeschnitten (`…?raum=gubM5(`); markiert ist er trotzdem ganz.

**Beleg:** `…/2a-lobby-gast-ohne-namen.png`, `…/2b-lobby-kopiert.png`, `…/2d-lobby-gast-bereit.png`.

---

## 3 · Eine Partie zu zweit, sichtbar — **erfüllt**

**Der Handschlag** brauchte vom Klick auf *Partie starten* bis zu zwei laufenden Uhren
**530 ms**. Beide Kopfleisten standen danach auf **Tag 1 · 11:00**.

**Beide Uhren laufen, und sie halten dasselbe Tempo.** Sechzig Sekunden lang beide Seiten alle
150 ms abgelesen:

| | Gastgeber | Gast |
|---|---|---|
| Ticks im Fenster | 1363 | 1363 |
| Echtzeit | 59,9 s | 59,8 s |
| **Ticks je Sekunde** | **22,77** | **22,78** |

Abstand zwischen beiden Seiten: **0,004 Ticks/s**. Die eingestellte Rate ist 25 — die feste
Rate ist eine **Obergrenze**, nicht eine Zusage („die Freigabe entscheidet", `useNetplay.ts`),
also ist 22,8 kein gerissenes Kriterium, sondern der gemessene Wert auf dieser Maschine mit
zwei Fenstern nebeneinander.

**Die Prüfsumme auf beiden Seiten, über mehrere Spieltage.** Verglichen wird nach **Tick**, nicht
nach Uhrzeit — die beiden Ablesungen liegen sonst um Millisekunden versetzt:

| | |
|---|---|
| gemeinsam abgelesene Ticks | **245** |
| Bereich | Tick **855** bis **2218** = **56,8 Spieltage** |
| **Abweichungen** | **0** |
| letzte Ablesung, beide Seiten | Tag 93 · 10:00, Tick 2218, Hash **`7aae49be9d989df8`** |

Stichproben aus demselben Lauf, Tick für Tick gleich: 855 `f2b4bfaf24a99405` · 1000
`a5a2a1f00851e612` · 1502 `06ef298d34e6a8cb` · 2007 `075c552d322f2fe3` · 2199 `5e1ada4e4897c47c`.

**Ein Befehl des einen kommt beim anderen an.** Im Stillstand befohlen, damit die Zeile im
Protokoll stehen bleibt (das Protokoll hält 51 Zeilen, und bei 22 Ticks/s ist eine Meldung
nach Sekunden verdrängt): der **Gast** erklärt bei Tick 8908 (Tag 372 · 04:00) den Krieg. Nach
dem Fortsetzen steht **im Protokoll des Gastgebers**:

```
372 · 06:00   Verträge   Kanada erklärt Vereinigte Staaten den Krieg. Wirksam ab Tag 372.
```

**3162 ms** nach dem Druck auf *Fortsetzen* — darin stecken die drei Sekunden Vorlauf des
Fortsetzens. Danach standen beide Seiten bei Tick **8927** mit Hash **`310f1042d8fd7bec`**; die
Meldung „Die beiden Spiele laufen auseinander" erschien in keinem der Läufe.

**Zwei Dinge am Rande, gemessen, ohne Urteil:** in dieser Partie spielte keiner der beiden
Menschen. Nach rund 330 Spieltagen war der Gastgeber **ausgeschieden** — die Diplomatie meldete
zu jeder Macht „Diese Macht ist ausgeschieden und kann nichts mehr befehlen." Die Partie lief
danach im Gleichschritt weiter, und die Prüfsummen blieben gleich. Und: Die Zeile aus
`mehrspieler-anleitung.md` §3, dreißig Spieltage seien bei 25 Spielstunden je Sekunde „rund
zwölf Minuten", stimmt nicht — dreißig Spieltage sind 720 Ticks, also bei 22,8 Ticks/s rund
**32 Sekunden**. Zwölf Minuten wären es bei Rate 1. Die Zeile ist in derselben Sitzung
berichtigt worden.

**Beleg:** `…/3a-host-partie-laeuft.png`, `…/3b-gast-partie-laeuft.png`, `…/3e-host-lauf.png`,
`…/3f-gast-lauf.png`, `…/3k-gast-befiehlt-im-stillstand.png`,
`…/3l-host-sieht-den-befehl-des-gastes.png`.

---

## 4 · Die Pause auf Antrag — **erfüllt**, mit einer Lücke (Befund MP-4)

**Der andere sieht den Antrag.** **211 ms** nach dem Druck auf *Pause beantragen* stand beim
Gast ein Dialog:

```
Partie zu zweit
Vereinigte Staaten möchte pausieren.
[Pause zulassen]  [Weiterspielen]
```

**Nach der Zustimmung steht die Partie bei beiden am selben Tick:**

| | Gastgeber | Gast |
|---|---|---|
| Tick | **7307** | **7307** |
| Uhr | Tag 305 · 11:00 | Tag 305 · 11:00 |
| Hash | `c0d8d0e08fc4905a` | `c0d8d0e08fc4905a` |

Drei Sekunden später unverändert (7307 → 7307 auf beiden Seiten). Beide Kopfleisten zeigen
danach *Fortsetzen* statt *Pause beantragen* — jeder darf allein fortsetzen, wie vorgesehen.

**Was fehlt:** der **Antragsteller** bekommt nichts zu sehen. Kein „Ihr Pausenantrag ist
gestellt", keine Meldung, wenn der andere mit *Weiterspielen* ablehnt (gemessen: nach der
Ablehnung stand beim Gastgeber weiterhin nur der alte Hinweis aus einem früheren Tastendruck),
kein Satz während der Pause und keiner beim Fortsetzen. Fünf Texte dafür stehen in `de.ts` und
werden nirgends gerendert → **Befund MP-4**.

**Beleg:** `…/4a-gast-pausenantrag.png`, `…/4b-host-antrag-gestellt.png`, `…/4c-host-pausiert.png`,
`…/4d-gast-pausiert.png`.

---

## 5 · Die Tempo-Sperre — **erfüllt und am Bildschirm zu sehen**

Bei der Vorspul-Sperre des Einzelspielers lautete die Antwort auf dieselbe Frage einmal
„nein, nie" (`sichtpruefung-2026-09-14.md` §2). Hier ist sie **ja**, und zwar auf zwei Wegen:

**Erstens: die Tempoknöpfe sind nicht gesperrt, sondern gar nicht da.** Gemessen in der
laufenden Partie zu zweit:

| | |
|---|---|
| `.speeds`-Gruppen | **0** |
| Tempoknöpfe | **0** |
| Vorspulknopf | **keiner** |
| stattdessen | „**25 Stunden je Sekunde (fest)**" als Text, daneben *Pause beantragen* |

**Zweitens: die Tasten sagen, warum sie nichts tun.** Jeder Tastendruck schreibt einen Hinweis
in die rechte Spalte, und die Rate bleibt stehen:

| Taste | Was auf dem Bildschirm erscheint |
|---|---|
| `+` | „Zu zweit steht die Geschwindigkeit fest — sie wurde beim Anlegen der Partie gewählt." |
| `−` | derselbe Satz |
| `F` | „Vorspulen gibt es zu zweit nicht: Ihr Mitspieler säße vor einem Spiel, das ohne ihn weiterläuft." |

**Die Leertaste tut etwas anderes, und das ist Absicht.** Sie zeigt **keinen** Hinweis, sondern
stellt einen Pausenantrag: 800 ms nach dem Druck stand beim Gast „Vereinigte Staaten möchte
pausieren." mit den zwei Knöpfen. Der Text `header.pauseNeedsConsent` („Zu zweit wird eine
Pause beantragt und angenommen") gilt nur für den Fall ohne laufende Sitzung und ist auf diesem
Weg nicht erschienen.

**Beleg:** `…/5a-kopfleiste-zu-zweit.png` (Kopfleiste ohne Tempogruppe),
`…/5b-hinweis-plus.png`, `…/5c-hinweis-vorspulen.png`, `…/5e-leertaste-beim-gast.png`.

---

## 6 · Ein Abbruch — **erfüllt**

**Wie hart gekappt wurde.** `Network.emulateNetworkConditions offline: true` reicht nicht: eine
schon offene WebSocket-Verbindung lässt Chromium damit weiterlaufen (gemessen — beide Uhren
liefen durch, 1735 → 1969). Gekappt wurde deshalb der Sockel selbst: ein vor dem ersten Skript
der Seite eingehängtes `WebSocket`-Doppel macht die offene Leitung erreichbar, ein Wächter
schließt dreizehn Sekunden lang jede, die der Transport neu aufbaut. Die **Seite bleibt
stehen** — das ist „der Stecker ist draußen", nicht „der Browser ist weg". Am Spielcode wurde
dafür nichts geändert.

**Was die Kopfleiste des Gastgebers sagt, in dieser Reihenfolge:**

| nach | was dasteht |
|---|---|
| **4,6 s** | „**Warte auf Mitspieler …**" (orange, neben der festen Rate), die Uhr steht bei Tick 2280 |
| **12,8 s** | „**Ihr Mitspieler ist seit zehn Sekunden nicht mehr da. Die Partie wartet; es geht nichts verloren.**" mit den zwei Knöpfen **Weiter warten** und **Partie beenden** |

**Und wenn der Gast zurückkommt, geht es weiter, ohne dass jemand etwas drückt.** **16,6 s**
nach dem Schnitt lief die Uhr wieder (Tick 2327, Tag 97 · 23:00), der Hinweis war weg. Danach
gemessen: **28 gemeinsame Ticks** (2331 – 2485), **0 Abweichungen**; keine Desync-Meldung.

Die Leitung selbst erzählt dasselbe: 42 Sockel, 41 Enden, die meisten mit Code `1000` „Auf
Wiedersehen." (der Dienst antwortet höflich auf den Schließrahmen) und eines mit `1006`.

**Beleg:** `…/6a-host-wartet-auf-mitspieler.png`, `…/6b-host-mitspieler-ist-weg.png`,
`…/6c-gast-waehrend-des-abbruchs.png`, `…/6d-host-nach-der-rueckkehr.png`,
`…/6e-gast-nach-der-rueckkehr.png`.

---

## Die vier Befunde

Alle vier stehen ausführlich in `docs/plan/PROBLEME.md` (2026-09-14, MP-1 bis MP-4), jeder mit
kleinstem reproduzierbarem Fall und, wo repariert, mit der Gegenprobe.

| | Befund | Stand |
|---|---|---|
| **MP-1** | `pnpm mp:host` antwortete unter Windows auf **jede** Adresse mit 404. Die Wurzel trägt gemischte Trenner (`…\WorldWar\apps/desktop/dist`); `join` normalisiert sie, der `startsWith`-Vergleich davor nicht. Kein Test sah es, weil `mkdtempSync(join(tmpdir(), …))` immer normalisiert ist | **repariert** — `resolveStatic` löst die Wurzel zuerst auf; neuer Fall, Gegenprobe gefahren |
| **MP-2** | Wer seinen Link **zuerst** öffnet, wartet für immer: „Es wartet noch niemand" gegen „Der Gastgeber legt die Partie gerade an", auch nach 30 weiteren Sekunden. Der Dienst puffert nichts, und nur der Gast meldete sich an | **repariert** — beide Seiten melden sich an; der Gast beantwortet das `hallo` des Gastgebers. Gegenprobe im Test **und** am Bildschirm |
| **MP-3** | Eine Abweisung (belegter Platz, falsches Geheimnis, unbekannter Raum) wurde **endlos** wiederholt — gemessen **77 Versuche in 20 s** — und nie gezeigt. Der Dienst weist nach dem 101-Handschlag ab, also setzte `onopen` die Abstände zurück | **repariert** — Schließcodes ab 4000 gelten als Antwort. Danach **1** Versuch statt 77, und der Gast liest „Der Beitritt hat nicht geklappt — Dieser Platz ist besetzt." |
| **MP-4** | Fünf Spielertexte unter `netplay` in `de.ts` werden nirgends gerendert (`pauseSent`, `pauseDeclined`, `pauseExpired`, `paused`, `resuming`). Wer eine Pause beantragt, sieht weder, dass der Antrag steht, noch dass er abgelehnt wurde | **offen** — Frage an Noah: wo diese Sätze hingehören, entscheidet über das Aussehen |

Dazu eine **fünfte Kleinigkeit ohne Reparatur:** im Anlegedialog des Gastgebers steht unter der
Einladungsvorschau noch der Satz aus M37 „Die Verbindung zum Mitspieler kommt mit dem nächsten
Ausbau; die Partie beginnt vorerst lokal." (`newGame.multiplayerPending`). Er ist seit M38/M39
falsch — die Verbindung ist gebaut. Auch das ist ein Text und damit Noahs Entscheidung; er
steht als MP-5 in `PROBLEME.md`.

---

## Was geprüft ist und was nicht

### Geprüft, an zwei sichtbaren Fenstern desselben Rechners

- **Der Beitrittsbildschirm**: alle sechs Angaben, Bedingungen vor dem Namensfeld, Knopf ohne
  Namen gesperrt, `location.search` leer, kein `s=` in einer der sechs Anfragen.
- **Die Lobby**: die drei Wartezustände, der gesperrte und der freie Startknopf, der Kopier-Knopf
  (Auswahl 0–77 von 77, keine Zwischenablage über `http`), und dass die Partie **nicht** mit der
  Verbindung beginnt (6 s beobachtet, Tag 1 · 00:00 unverändert).
- **Der Gleichschritt**: 1363 Ticks in 60 s auf beiden Seiten, 22,77 gegen 22,78 Ticks/s,
  245 gemeinsam abgelesene Ticks über 56,8 Spieltage, **0 Abweichungen**, Schlusshash
  `7aae49be9d989df8` auf beiden Seiten.
- **Ein Befehl über die Leitung**: die Kriegserklärung des Gastes steht im Protokoll des
  Gastgebers, mit Tag und Uhrzeit.
- **Die Pause auf Antrag**: Antrag nach 211 ms sichtbar, nach der Zustimmung beide bei Tick 7307
  und Hash `c0d8d0e08fc4905a`.
- **Die Tempo-Sperre**: keine Tempogruppe, kein Vorspulknopf, drei verschiedene Hinweistexte.
- **Der Abbruch**: „Warte auf Mitspieler …" nach 4,6 s, der Hinweis mit zwei Knöpfen nach 12,8 s,
  Wiederaufnahme von selbst nach 16,6 s, danach 28 gemeinsame Ticks ohne Abweichung.

### Nicht geprüft — und das bleibt AK-9

- **Ein Gast in einem anderen Netz.** Beide Fenster liefen auf **einer** Maschine über
  `192.168.178.93`. Tailscale ist installiert und nicht angemeldet (Befund M39-6); es gibt kein
  Tailnet, also keine zweite Seite und keine echte Laufzeit über eine Leitung. Was hier „3162 ms"
  heißt, heißt zwischen zwei Wohnungen etwas anderes.
- **Ein zweiter Mensch.** Beide Seiten wurden von demselben Skript bedient. Niemand hat den Link
  aus einer Nachricht kopiert, niemand hat sich vertippt, niemand hat entschieden, ob er die
  Pause zulässt.
- **Dreißig Spieltage „am Stück" im Sinne von AK-9.** Gerechnet wurden über 400 Spieltage, aber
  in einer Partie, in der kein Mensch spielte — beide Mächte standen still, der Gastgeber schied
  aus. Ob sich zwei Menschen dabei gut fühlen, misst kein Skript.
- **Die Übertragung eines Spielstands über mehrere Abende** (T-M39-06, D28.11). Der Fall ist in
  `party.test.tsx` gedeckt und stand hier nie an: beide Seiten begannen immer vom Anfang.
- **Die Meldung „Die beiden Spiele laufen auseinander".** Sie erschien in keinem Lauf — was gut
  ist und zugleich heißt: **sie ist am Bildschirm nicht belegt.** Dasselbe gilt für die
  Handschlag-Absagen („Verschiedene Regelwerke", „Verschiedene Karten"), für *Partie beenden*
  und für *Allein weiterspielen*.
- **Das ausgelieferte Programm.** Gemessen wurde das Bündel mit Bauflagge, das der Hostdienst
  ausliefert — nicht `worldwar.exe`. Das ist Absicht (T-M39-04): ohne Flagge steht im Erzeugnis
  kein `WebSocket`.

---

## Was am Code geändert wurde

Drei Reparaturen, je mit einem Fall, der ohne sie fällt (Gegenprobe gefahren). Der Kern
(`packages/core/src`, `data/rules`) ist unberührt, `apps/desktop/src/game/newGame.ts` ebenfalls
— der Haltungs-Messlauf muss nicht wiederholt werden.

| Datei | Was |
|---|---|
| `apps/party/src/server.ts` | `resolveStatic` löst die Wurzel auf (MP-1) |
| `apps/party/test/server.test.ts` | „liefert auch aus, wenn die Wurzel gemischte Trenner traegt" |
| `apps/desktop/src/net/party.ts` | beide Seiten melden sich an; der Gast antwortet auf ein `hallo` (MP-2) |
| `apps/desktop/src/net/party.test.tsx` | `RaumEnde` — ein Doppel, das **nicht** puffert — und „findet zusammen, auch wenn der Gast seinen Link ZUERST oeffnet" |
| `apps/desktop/src/net/websocketTransport.ts` | Schließcodes ab 4000 sind eine Antwort, kein Netzfehler (MP-3) |
| `apps/desktop/src/net/websocketTransport.test.ts` | zwei Fälle zur Abweisung |
| `docs/reports/mehrspieler-anleitung.md` | die zwölf Minuten berichtigt, §6 auf diesen Bericht gezeigt |
