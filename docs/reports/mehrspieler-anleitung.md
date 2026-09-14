---
type: report
projekt: WorldWar
betrifft: AK-9, T-M39-09
erstellt: 2026-09-14
gemessen_gegen: M39 (T-M39-01 bis T-M39-08 gebaut)
---

# AK-9 einlösen: was Noah tun muss

> **Wozu dieses Blatt.** M39 ist gebaut — acht von neun Aufgaben, `pnpm verify` Exit 0. Die
> neunte ist **AK-9**, und sie ist das einzige Kriterium des ganzen Mehrspieler-Plans, das
> **kein Agent erfüllen kann**: ein zweiter Mensch in einem anderen Netz ist nicht
> simulierbar, und ein zweites Netz auch nicht. Hier steht, was zu tun ist — und, im letzten
> Abschnitt, **was davon geprüft ist und was nicht**.
>
> Die Spieleranleitung sagt dasselbe kürzer und ohne die Ehrlichkeitsspalte:
> `docs/ANLEITUNG.md`, Abschnitt „Eine Partie zu zweit — die Einladung".

---

## 0 · Was AK-9 verlangt

> **AK-9** — Noah und ein zweiter Mensch in einem **anderen Netz** spielen eine Partie zu
> zweit: Einladung per Link, Beitritt ohne Installation, mindestens dreissig Spieltage am
> Stück, eine beantragte und angenommene Pause, ein absichtlich herbeigeführter
> Verbindungsabbruch mit Wiederaufnahme — und am Ende führen beide Seiten dieselbe
> Zustandsprüfsumme.

Sechs Punkte. Jeder davon gehört in `docs/reports/mehrspieler.md`; erst dann ist T-M39-09
erledigt und der Haltepunkt weg.

---

## 1 · Einmal einrichten (etwa zehn Minuten, davon fünf beim Gast)

**Auf deinem Rechner:**

1. Tailscale installieren: <https://tailscale.com/download>. Anmelden. Das Gerät erscheint
   in deinem Tailnet.
2. Prüfen, dass es steht:

   ```bash
   "C:\Program Files\Tailscale\tailscale.exe" ip -4
   ```

   Erwartet: eine Adresse, die mit **100.** beginnt (der Bereich `100.64.0.0/10`). Steht da
   `no current Tailscale IPs; state: NoState`, ist Tailscale installiert, aber nicht
   angemeldet — dann funktioniert nichts weiter unten, und das ist **kein Fehler des
   Spiels**. (Genau dieser Zustand war am 2026-09-14 auf dieser Maschine: Version 1.102.2,
   nicht angemeldet, Schnittstelle `169.254.83.107`.)

**Bei deinem Mitspieler** (einmal je Person):

3. Im Tailscale-Adminbereich unter *Users → Invite external users* eine Einladung erzeugen
   und ihm schicken.
4. Er installiert Tailscale, nimmt die Einladung an — fertig. Ab da sind beide Rechner im
   selben privaten Netz. Kein öffentlicher Endpunkt, kein Tunnelanbieter, keine Portfreigabe
   am Router.

---

## 2 · Jedes Mal (vier Befehle und ein Link)

```bash
cd C:\Users\noahh\Desktop\Claude-Projekte\WorldWar
git checkout claude/mehrspieler-m37-m39     # solange M37–M39 nicht gemerged sind
pnpm mp:host
```

`pnpm mp:host` tut drei Dinge in dieser Reihenfolge:

1. **baut** das Bündel mit `WORLDWAR_MULTIPLAYER=1` (rund zwei Sekunden),
2. **startet** den Dienst auf Port **7749**, auf allen Schnittstellen,
3. **druckt** zwei Links — einen für dich (`#/gastgeben…`) und einen für deinen Gast
   (`#/beitreten…`). Beide tragen dieselbe Raumkennung und dasselbe Geheimnis.

Die Ausgabe sieht so aus (gemessen am 2026-09-14, hier ohne Tailnet):

```
WorldWar-Hostdienst auf Port 7749. Beenden mit Strg+C.

Keine Tailscale-Adresse gefunden (erwartet wird 100.64.0.0/10).
Ohne Tailnet erreicht der Gast diesen Rechner nicht — das ist keine Stoerung,
sondern der Zweck: es gibt keinen oeffentlichen Endpunkt. Siehe docs/ANLEITUNG.md.

Fuer dich  (Wi-Fi, nur im lokalen Netz): http://192.168.178.93:7749/#/gastgeben?raum=VYCD30hL&s=GR50…
Fuer deinen Gast:                        http://192.168.178.93:7749/#/beitreten?raum=VYCD30hL&s=GR50…
```

**Mit** angemeldetem Tailnet steht statt `Wi-Fi, nur im lokalen Netz` die Zeile
`Tailscale, im Tailnet`, sie steht **zuerst**, und der Hinweisblock darüber fehlt. **Diesen
Link** verschickst du — per Nachricht, Telefon, wie du magst.

Dann:

4. **Deinen eigenen Link öffnen** (`#/gastgeben…`) in Brave oder Edge. Der Anlegedialog steht
   sofort offen und ist schon auf „Zu zweit über einen Link" gestellt. Karte, deine Nation,
   Zahl der Gegner, Siegbedingung und die **feste Geschwindigkeit** wählen → *Partie
   beginnen*. Danach siehst du die Lobby.
5. **Der Gast öffnet seinen Link.** Er sieht zuerst, worauf er sich einlässt: Karte, seine
   Nation, deine Nation, Zahl der Computergegner, Siegbedingung, feste Geschwindigkeit —
   und den Satz, dass es **keinen Schummelschutz** gibt. Dann trägt er seinen Namen ein und
   tritt bei.
6. **Du startest.** In deiner Lobby steht jetzt sein Name. Erst dein Druck auf *Partie
   starten* löst den Handschlag aus: beide Rechner vergleichen Protokollfassung, Regelwerk
   und Karte und rechnen einen Spieltag zur Probe. Stimmen die Prüfsummen, beginnt die
   Partie; stimmen sie nicht, beginnt sie **nicht**, und der Grund steht auf dem Bildschirm.

**Beenden:** Strg+C im Fenster des Hostdienstes. Er gibt den Port sofort frei.

---

## 3 · Die sechs Punkte, und wie du sie prüfst

| # | Punkt | Wie du ihn prüfst | Wo es steht |
|---|---|---|---|
| 1 | Die Einladung kam an | Der Gast öffnet den Link **in einem anderen Netz** — nicht in deinem WLAN. Sein Browser zeigt den Beitrittsbildschirm | — |
| 2 | Der Gast musste nichts installieren | Keine Datei, kein Programm, kein Konto. Nur Tailscale, und das war Schritt 1 | — |
| 3 | Mindestens dreissig Spieltage am Stück | Das Datum in der Kopfleiste. Bei 25 Spielstunden je Sekunde sind dreissig Tage rund zwölf Minuten | Kopfleiste |
| 4 | Eine beantragte und angenommene Pause | Du drückst *Pause beantragen*; beim Gast erscheint ein Dialog mit zwei Knöpfen; er stimmt zu; **beide Uhren stehen bei derselben Spielstunde** | Kopfleiste beider Seiten |
| 5 | Ein absichtlicher Abbruch mit Wiederaufnahme | Beim Gast WLAN aus, zwanzig Sekunden warten (nach zehn erscheint „Ihr Mitspieler ist seit zehn Sekunden nicht mehr da"), WLAN an. Die Partie läuft **von selbst** weiter, ohne dass ein Befehl verloren geht | Kopfleiste, dann die Karte |
| 6 | Am Ende dieselbe Zustandsprüfsumme | Taste **`D`** auf beiden Rechnern, Zeile „Zustands-Hash" vergleichen. Beide müssen dieselben 16 Zeichen zeigen | Debug-Ansicht |

Läuft einer der sechs Punkte schief, gehört er als **Befund** in
`docs/plan/PROBLEME.md` — und AK-9 bleibt offen, statt halb abgehakt zu werden.

---

## 4 · Was zu tun ist, wenn es schiefgeht

| Was du siehst | Was es heißt | Was zu tun ist |
|---|---|---|
| Der Gast sieht „Der Beitritt hat nicht geklappt" mit „Dieser Link passt zu keiner Partie" | Falsches oder fehlendes Geheimnis, oder der Dienst wurde zwischendurch neu gestartet (ein Neustart erzeugt einen **neuen** Raum) | Neuen Link aus der laufenden Ausgabe von `pnpm mp:host` schicken |
| Der Gast sieht gar nichts, der Browser lädt endlos | Kein Tailnet zwischen euch | `tailscale ip -4` auf **beiden** Rechnern; beide brauchen eine `100.`-Adresse |
| Beide Seiten stehen bei „Warte auf Mitspieler …" | Eine Seite rechnet nicht mehr | Zehn Sekunden warten; dann erscheint der Hinweis mit *Weiter warten* und *Partie beenden* |
| „Die beiden Spiele laufen auseinander" | Die Prüfsummen weichen ab. Die Partie hält an — mit Absicht | Auf beiden Seiten *Spielstand sichern*, dann Befund in `PROBLEME.md` mit beiden Prüfsummen und dem Tick |
| Die Partie beginnt nicht, „Verschiedene Regelwerke" / „Verschiedene Karten" | Ihr spielt aus zwei verschiedenen Bauten | Kann eigentlich nicht sein — beide Seiten holen dasselbe Bündel vom selben Dienst. Wenn doch: Befund, das wäre ein echter Fund |

---

## 5 · Und über mehrere Abende

Beide speichern lokal weiter (Strg+S). Zum Fortsetzen startest du `pnpm mp:host` neu und
verschickst den neuen Link. Der Handschlag vergleicht die Prüfsummen beider gespeicherten
Stände:

- **gleich** → es geht weiter, und **nichts** geht über die Leitung;
- **ungleich** (er hat einen älteren Stand oder gar keinen) → dein Rechner überträgt seinen
  Stand, und beide prüfen erneut. Gemessen: 263 KB nach dreissig Spieltagen — auf dieser
  Leitung eine Sekunde.

Das ist die **einzige** Stelle, an der ein Spielstand über die Leitung geht.

---

## 6 · Was geprüft ist — und was nicht

Der ehrliche Teil. Alles in der linken Spalte ist **gemessen** und steht als Zusicherung im
Testlauf; alles in der rechten ist **nicht** gemessen und wartet auf dich.

### Gemessen (2026-09-14, `pnpm verify` Exit 0, 163 Dateien / 2442 Tests)

- **Der Link.** Raum und Geheimnis stehen hinter dem Rautezeichen, die Anfragezeile trägt
  keines von beiden. Das Format wird an einer Stelle gebaut und an einer gelesen; ein
  Rundlauf-Test hält beide zusammen. Das Geheimnis sind 16 Bytes aus `randomBytes` — tausend
  Ziehungen, tausend verschiedene Werte.
- **Die Abweisung.** Am **laufenden Dienst**, über einen echten TCP-Sockel: ein falsches
  Geheimnis, ein fehlendes und eine unbekannte Raumkennung bekommen denselben Satz und
  denselben Schließcode.
- **Der Beitrittsbildschirm.** An der **ganzen Anwendung** in der Rolle des Gastes: alle
  sechs Angaben stehen da, die Bedingungen im Baum **vor** dem Namensfeld, der Knopf ohne
  Namen gesperrt — und danach spielt der Gast als `p2` mit seiner Nation.
- **Der Start durch den Gastgeber.** Die Partie beginnt nicht, wenn eine Verbindung steht,
  sondern wenn er drückt. Gegenprobe gefahren.
- **Der Gleichschritt.** Zwei übergebene Maschinen rechnen **200 Ticks** gegeneinander, mit
  Prüfsummenvergleich nach **jedem** Tick.
- **Die Wiederaufnahme.** Gleiche Stände → keine Übertragung; verschiedene → genau eine
  `zustand`-Nachricht, danach zwei Spieltage Gleichschritt über einen Tageswechsel hinweg.
- **Die Erreichbarkeit im lokalen Netz.** Der Dienst horcht auf allen Schnittstellen und
  antwortet über `192.168.178.93`, nicht nur über die Rückschleife.
- **Netzfrei bleibt netzfrei.** Das neu gebaute `worldwar.exe` (6 789 632 B) trägt
  `connect-src 'none'` und **keinen** `WebSocket`; das Bündel mit Bauflagge trägt einen. Die
  Zusage hängt damit an der Flagge und nicht an einer Unterlassung.

### Nicht gemessen — das ist AK-9

- **Ein Gast in einem anderen Netz.** Tailscale ist auf dieser Maschine installiert
  (1.102.2), aber **nicht angemeldet**: `tailscale ip -4` meldet „no current Tailscale IPs".
  Es gibt kein Tailnet, also keine zweite Seite. Ich habe **nichts installiert und kein Konto
  angelegt** — das sind deine Schritte.
- **Ein zweiter Mensch.** Nicht simulierbar, und genau deshalb ist T-M39-09 ein Haltepunkt.
- **Die Sichtprüfung im Browser.** Diesem Lauf stand kein Browser zur Verfügung
  (Hintergrund-Sitzung, `WORKFLOW.md` §4 Falle 17). Der Beitrittsbildschirm, die Lobby und
  der Link zum Kopieren sind in jsdom geprüft — **niemand hat sie gesehen**. Wenn du
  zuerst nur eines tun willst: öffne beide Links in zwei Fenstern desselben Rechners. Das
  geht ohne Tailscale und zeigt in zwei Minuten, ob die Oberfläche stimmt; es erfüllt AK-9
  nicht, aber es findet, was jsdom nicht sieht.
- **Der Kopier-Knopf in der Lobby** markiert das Feld, statt in die Zwischenablage zu
  schreiben: ohne sicheren Kontext gibt es keine Zwischenablage-Schnittstelle. Strg+C danach
  ist dein Schritt.
