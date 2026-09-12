---
type: plan
status: approved
projekt: WorldWar
stufe: Bauplan
created: 2026-09-12
gilt_fuer: M37, M38, M39
---

# MEHRSPIELER — eine Partie zu zweit, über einen Link

> **Wenn du das hier liest, weil du bauen sollst:** lies §0 bis §4 einmal am Stück
> (etwa zehn Minuten), dann nur noch den Abschnitt deiner Aufgabe. `02-DESIGN.md` D28
> begründet, dieses Dokument baut. Die Aufgaben stehen in `03-TASKS.md` und
> `tasks.yaml` unter M37 bis M39.
>
> **Fang mit M37 an, nicht mit dem Netz.** Vier Fünftel dieses Plans lassen sich ohne
> ein einziges Netzwerkpaket bauen und belegen. Wer beim Netz anfängt, baut die
> Spielmechanik im Dunkeln.

---

## 0 · Was Noah entschieden hat (2026-09-12)

Vier Fragen, vier Antworten. Sie sind der Rahmen; wer davon abweichen will, fragt neu.

1. **Der Host ist der Server.** Der Gast öffnet einen Link und spielt im Browser. Er
   installiert kein Spiel, er lädt keine Datei, er legt kein Konto an. Auf Noahs
   Rechner läuft währenddessen ein kleiner Dienst, der das gebaute Spiel ausliefert und
   die Befehle weiterreicht.
2. **Die letzte Meile ist Tailscale.** Kein öffentlicher Endpunkt, kein Tunnelanbieter,
   keine Portfreigabe am Router. Beide Rechner liegen im selben privaten Netz; der Gast
   nimmt einmalig eine Tailscale-Einladung an. Das kostet ihn etwa fünf Minuten und
   danach nie wieder etwas.
3. **Das ausgelieferte Programm bleibt netzfrei.** Die Tauri-Anwendung behält ihre
   Sperre wörtlich: `connect-src 'none'`, keine Netzberechtigung, Wächter scharf. Der
   Mehrspielermodus läuft über den Browser und den Hostdienst. Ziel Z3 bleibt für das
   Programm wahr, das Noah weitergibt; präzisiert wird nur, wovon es spricht.
4. **Die Pause wird beantragt und angenommen.** Kein einseitiges Anhalten. Wer eine
   Pause will, stellt einen Antrag; die Partie steht erst, wenn der andere zustimmt.

Nicht gewählt und ausdrücklich verworfen:

- **Tempo und Vorspulen im Mehrspieler.** Sie fallen weg, und das ist seit dem
  2026-09-04 die Rahmenbedingung C-11. Beide bleiben im Einzelspieler unverändert.
- **Ein Dienst im Internet** (gemieteter Server, Worker bei einem Anbieter): Konto,
  Betrieb, dauerhafter Endpunkt. Alles drei will Noah nicht.
- **Ein Tunnel zu einer öffentlichen Adresse**: technisch der bequemste Weg für den
  Gast, aber die Adresse wäre aus dem Internet erreichbar. Tailscale löst dasselbe
  Problem ohne diesen Preis.
- **Ein Postspiel** (Spielstände hin- und herschicken): billig zu bauen, aber es ist
  keine gemeinsame Partie mehr.

---

## 1 · Der Befund: das Fundament liegt seit M5

Dieses Projekt hat den Mehrspieler seit dem ersten Tag vorbereitet und nie gebraucht.
Was schon da ist, ist der Grund, warum dieser Plan den Kern nicht anfasst:

| Baustein | Wo | Zustand |
|---|---|---|
| Reiner Kern | `packages/core/src/step.ts` | `step(state, commands, ctx)` fasst den Eingang nie an |
| Geseedeter Zufall | `packages/shared/src/rng.ts` | xoshiro128, vier Wörter, im Zustand; der Kommentar nennt Lockstep beim Namen |
| Kein Gleitkomma | `packages/shared/src/fixed.ts` | Ganzzahl-Festkomma; Mal und Geteilt sind im Kern per ESLint verboten |
| Prüfsumme | `packages/shared/src/hash.ts` | 16 Hexzeichen, Schlüsselreihenfolge egal, Listenreihenfolge nicht |
| Zwei Menschen | `packages/core/test/hotseat.test.ts` | seit M5 grün: „menschlich" ist nur ein Attribut |
| Befehle je Tick | `packages/ai/src/loop.ts`, `opts.scripted` | für die Wiedergabe gebaut, für den Gleichschritt fertig |
| KI im Zustand | `state.ai`, `packages/ai/src/runner.ts` | beide Seiten rechnen dieselbe KI aus demselben Zustand |
| Sammeln statt sofort | `App.tsx`, T-M22-05 | Befehle wirken schon heute erst im nächsten Tick |

**Gemessen am 2026-09-12** an der ausgelieferten Weltkarte, sechs Mächte, 30 Spieltage
gespielt:

| Größe | Wert |
|---|---|
| Partiedefinition (`GameConfig`) | 645 Byte |
| Ein Befehl als JSON | 79 Byte |
| Spielstand am Anfang | 93,6 KB |
| Spielstand nach 30 Spieltagen | 249 KB |
| Karte `world.json` (nicht im Spielstand) | 1,17 MB |
| Rechenzeit je Tick | 1,54 ms |

Was daraus folgt, und es bestimmt den ganzen Entwurf:

- **Bandbreite ist kein Thema.** Bei einer Spielstunde je Sekunde tauschen beide Seiten
  zusammen etwa zweihundert Byte je Sekunde. Jeder Transport reicht.
- **Der Spielstand passt in eine Nachricht.** Ein Viertelmegabyte ist der Preis dafür,
  eine unterbrochene Partie wiederherzustellen, statt sie zu verlieren.
- **Die Karte passt nicht in eine Nachricht** und muss es nicht: der Gast bekommt sie im
  ausgelieferten Bündel, das aus demselben Bau stammt wie das des Hosts.

**Der Kern wird nicht angefasst.** Keine Zeile in `packages/core`, keine Zeile in
`data/rules`. Damit bleiben Golden-Master, Parameterlauf und Turnier unberührt, der
Frische-Wächter in `scripts/acceptance.mjs` bleibt still, und die Abnahme kostet sechs
Minuten statt einer Nacht. Wer beim Bauen meint, den Kern doch anfassen zu müssen, hat
mit hoher Wahrscheinlichkeit einen Entwurfsfehler gefunden und keine Notwendigkeit:
Befund in `PROBLEME.md`, dann fragen.

---

## 2 · Wie es funktioniert (Gleichschritt in fünf Sätzen)

1. Beide Rechner haben denselben Zustand und rechnen **beide** die ganze Partie,
   Computergegner eingeschlossen.
2. Übertragen werden nur **Befehle**, nie Zustände: je Tick schickt jede Seite genau
   eine Nachricht, auch wenn sie leer ist.
3. Ein Tick wird erst gerechnet, wenn **beide** Nachrichten für ihn da sind. Dadurch
   synchronisiert sich das Tempo von selbst: der Langsamere gibt es vor.
4. Ein Befehl, der jetzt gegeben wird, gilt für **Tick + 2**. Das fällt niemandem auf,
   weil Befehle schon im Einzelspieler erst im nächsten Tick wirken (T-M22-05).
5. Jede Nachricht trägt die **Prüfsumme** des zuletzt gerechneten Ticks. Weichen sie ab,
   hält die Partie an und sagt es, statt zwei verschiedene Welten weiterzuspielen.

Es gibt **keinen Schiedsrichter**. Der Hostdienst ist Briefträger und Dateiserver, sonst
nichts. Die Reihenfolge der Befehle innerhalb eines Ticks ist ohne Absprache eindeutig,
weil beide Seiten nach derselben Regel sortieren (§3.3).

### 2.1 Was das kostet, und was es nicht kann

**Jeder hat den vollen Zustand im Speicher.** Der Nebel des Krieges ist damit eine
Eigenschaft der Anzeige, nicht der Daten: wer die Entwicklerwerkzeuge des Browsers
öffnet, kann alles sehen. Das ist bei zwei Freunden hinnehmbar und bei einem
öffentlichen Spiel nicht. Die Alternative wäre ein Host, der nur `publicView` verschickt
und alles allein rechnet — viel mehr Arbeit, und dann könnte der Host schummeln statt
des Gastes. **Entschieden:** Gleichschritt mit vollem Zustand, und die Einschränkung
steht in der Anleitung, statt verschwiegen zu werden.

**Ein Rechner, der auseinanderläuft, verdirbt die Partie.** Dagegen stehen der
Determinismus-Handschlag vor dem ersten Zug (§3.4) und die Prüfsumme in jeder Nachricht.

---

## 3 · Der Bau, Stück für Stück

### 3.1 Wo was liegt

```
packages/netplay/          Protokoll und Gleichschritt. KEIN Netzcode.
  src/protocol.ts          Nachrichtentypen und ihre Pruefung
  src/lockstep.ts          die Zustandsmaschine: sammeln, freigeben, vergleichen
  src/handshake.ts         Fassung, Regelpruefsumme, Kartenpruefsumme, Probelauf
  src/transport.ts         die Schnittstelle (senden, empfangen, schliessen)
  src/loopback.ts          das Testdoppel: zwei Enden im selben Prozess
apps/party/                der Hostdienst (Node)
  src/server.ts            HTTP fuer das Buendel, WebSocket fuer die Partie
  src/room.ts              ein Raum, zwei Plaetze, ein Geheimnis
apps/desktop/src/net/      die Browserseite
  websocketTransport.ts    die einzige Stelle im Spiel, die new WebSocket sagt
  useNetplay.ts            die Anbindung an App.tsx
```

**Warum `packages/netplay` keinen Netzcode enthält:** so bleibt der Wächter
`test/guards/no-network.test.ts` für alles scharf und bekommt genau zwei benannte
Ausnahmen statt einer Lücke. Und der ganze schwierige Teil — Gleichschritt, Reihenfolge,
Prüfsummen, Pause, Wiederaufnahme — ist damit ein reines Paket, das ohne Netz
vollständig geprüft wird.

### 3.2 Die Nachrichten

Sieben Arten, mehr braucht es nicht. Alle sind reines JSON und tragen ihre Fassung.

| Art | Richtung | Inhalt |
|---|---|---|
| `hallo` | Gast zum Host | Protokollfassung, Name, gewünschte Nation |
| `willkommen` | Host zum Gast | Partiedefinition, Platz (`p1`/`p2`), Prüfsummen, Probeauftrag |
| `probe` | beide | Prüfsumme nach 24 Probeticks |
| `befehle` | beide | `{ tick, commands, hash }` — je Tick genau eine, auch leer |
| `pause` | beide | `{ art: antrag/ja/nein/weiter, abTick }` |
| `zustand` | Host zum Gast | vollständiger Spielstand, nur bei Wiederaufnahme |
| `ende` | beide | Grund: Sieg, Abbruch, Auseinanderlaufen, Fassungsstreit |

**Unbekannte Arten werden verworfen und gemeldet, nie geraten.** Eine Nachricht, deren
Fassung nicht passt, beendet die Verbindung mit einer Erklärung, statt halb zu wirken.

### 3.3 Die Reihenfolge der Befehle

Die Falle, an der Gleichschritt-Umsetzungen scheitern: zwei Seiten wenden dieselben
Befehle in verschiedener Reihenfolge an und laufen auseinander, ohne dass jemand einen
Fehler gemacht hat.

**Die Regel:** innerhalb eines Ticks wird sortiert nach der Stellung des Spielers in
`state.playerOrder`, und innerhalb eines Spielers bleibt seine eigene Reihenfolge
erhalten. Danach kommen die Befehle der Computergegner, die ohnehin beide Seiten selbst
und identisch berechnen.

Das ist stabil, weil `playerOrder` ein ausdrückliches Feld des Zustands ist und kein
Nebenprodukt der Schlüsselreihenfolge (siehe `state/types.ts`, Regel 3).

### 3.4 Der Handschlag

Vier Prüfungen, bevor ein einziger Zug möglich ist. Sie kosten zusammen etwa fünfzig
Millisekunden und ersparen im Zweifel eine verlorene Partie.

1. **Protokollfassung** — verschiedene Fassungen reden nicht miteinander.
2. **Regelprüfsumme** — `hashValue` über das geladene Regelwerk. Ein Gast mit anderen
   Zahlen rechnet ein anderes Spiel.
3. **Kartenprüfsumme** — dasselbe für die Karte.
4. **Determinismus-Probe** — beide erzeugen aus der Partiedefinition den Startzustand,
   rechnen 24 Ticks ohne Befehle und vergleichen die Prüfsumme.

Punkt 4 ist der wichtige. Er beantwortet vor dem ersten Zug die Frage, die man sonst
erst nach zwei Stunden stellt: rechnet die andere Maschine wirklich bitgleich? Die
Antwort ist mit hoher Wahrscheinlichkeit ja, denn der Kern rechnet ausschließlich in
Ganzzahlen, und deren Verhalten ist in JavaScript exakt festgelegt. Aber „mit hoher
Wahrscheinlichkeit" ist keine Grundlage für einen Abend zu zweit.

### 3.5 Die Pause

Noahs Regel: beantragt und angenommen.

```
A stellt Antrag  ->  B sieht "A moechte pausieren"  ->  B stimmt zu
                 ->  beide halten ab Tick T+2 an
```

Drei Einzelheiten, die nicht Zierde sind:

- **Die Pause hängt an einem Tick, nicht an einem Augenblick.** Sonst steht der eine bei
  Tick 500 und der andere bei 502.
- **Ein Antrag verfällt.** Nach dreißig Sekunden ohne Antwort ist er weg, mit Hinweis an
  beide. Sonst wartet einer auf etwas, das der andere längst weggeklickt hat.
- **Fortsetzen darf jeder allein**, mit drei Sekunden Vorlauf und Anzeige bei beiden.
  Das ist bewusst nicht symmetrisch zum Anhalten: verlangte auch das Fortsetzen eine
  Zustimmung, könnte ein abgelenkter Mitspieler die Partie einsperren. Wer das anders
  will, sagt es — es ist eine Zeile im Entwurf.

### 3.6 Wenn die Verbindung abreißt

Drei Stufen, in dieser Reihenfolge:

1. **Es hakt** (unter zehn Sekunden): die Uhr steht, die Kopfleiste sagt „warte auf
   Mitspieler". Nichts geht verloren, der Gleichschritt wartet ohnehin.
2. **Es ist weg** (über zehn Sekunden): Hinweis mit zwei Knöpfen — weiter warten, oder
   die Partie beenden. Jede Seite hat ihre gesendeten Nachrichten ab dem letzten
   bestätigten Tick gepuffert; kommt die Verbindung zurück, wird nachgeliefert und
   weitergespielt, als wäre nichts gewesen.
3. **Er kommt nicht wieder**: der verbleibende Spieler kann die Partie übernehmen. Der
   Mitspieler wird dabei zum Computergegner (`players[id].kind = 'ai'`), und ab da ist
   es eine Einzelspielerpartie mit allem, was dazugehört — Tempo und Vorspulen
   eingeschlossen. Das ist ein bewusster Klick und passiert nie von selbst.

Stufe 3 ist der Grund, warum dieser Entwurf keine verlorenen Abende produziert: eine
Mehrspielerpartie kann immer in eine Einzelspielerpartie zurückfallen, weil der Zustand
derselbe ist.

### 3.7 Der Link und der Beitritt

```
http://<rechner>.<tailnet>.ts.net:7749/#/beitreten?raum=<id>&s=<geheimnis>
```

- **Das Geheimnis steht hinter dem Rautezeichen.** Was dort steht, schickt der Browser
  nicht an den Server und es landet in keinem Protokoll. Geprüft wird es erst beim
  Verbindungsaufbau der Partie.
- **Der Link ist kurz**, weil der Host die Partiedefinition ohnehin kennt. Sie muss
  nicht mitreisen.
- **Der Beitrittsbildschirm zeigt, worauf man sich einlässt**, bevor irgendetwas
  passiert: Kartenname, Nation des Gastes, Nation des Hosts, Zahl der Computergegner,
  Siegbedingung und die feste Geschwindigkeit. Dann Name eintragen und beitreten.
- **Kein sicherer Kontext verfügbar.** Der Gast erreicht den Host über `http` im
  privaten Netz. Deshalb darf die Browserseite **keine** Programmschnittstellen
  benutzen, die einen sicheren Kontext verlangen: kein `crypto.randomUUID`, kein
  `crypto.subtle`. Das Geheimnis erzeugt der Hostdienst in Node, wo diese Frage sich
  nicht stellt.

### 3.8 Die feste Geschwindigkeit

Beim Anlegen einer Mehrspielerpartie wählt der Host eine Raste aus `SPEED_STOPS` ohne
die Null. Sie steht danach fest. In der Oberfläche heißt das:

- Die Tempogruppe in der Kopfleiste zeigt die gewählte Rate als Text, nicht als Regler.
- Die Tasten Plus und Minus und die Leertaste tun im Mehrspieler nichts, außer den
  Hinweis zu zeigen, warum.
- Die Vorspulziele sind nicht wählbar.
- Der Pausenknopf wird zum Pausenantrag (§3.5).

**Wichtig:** Das ist Sache der Hülle. Weder Kern noch Zustand kennen eine
Geschwindigkeit — genau das sichert R-ARCH-04/AK2 seit M5 zu, und genau deshalb kostet
dieser Punkt hier fast nichts.

---

## 4 · Fallen, die schon feststehen

Sie sind vor dem Bau gefunden worden, beim Lesen der Wächter. Wer sie übersieht,
verliert eine Sitzung an einen roten Lauf, der nichts mit seiner Arbeit zu tun hat.

1. **Der Haltepunkt-Wächter kennt vier feste IDs.** `test/plan-consistency.test.ts`
   prüft `expect(gates).toEqual(['T-M9-01', 'T-M10-01', 'T-M12-03', 'T-M14-15'])`. Ein
   fünfter Haltepunkt macht ihn rot, bis er mitgezogen wird — **und die Übersichtstabelle
   am Ende von `03-TASKS.md` gehört dazu**, ein zweiter Test liest sie. T-M39-08 macht
   beides in einem Zug, und zwar **bevor** T-M39-09 auf `gate: true` gesetzt wird.
2. **`AK-9` steht schon in einem Test — als erfundenes Gegenbeispiel.**
   `test/requirements.test.ts` benutzt die Nummer, um zu zeigen, dass ein Kriterium ohne
   Anforderung auffällt. Sobald AK-9 echt wird, ist das Beispiel irreführend; es wird auf
   `AK-99` umgestellt. Ebenfalls T-M39-08.
3. **Jede neue Anforderung braucht drei Einträge, sonst wird der Plan rot.** Eine ID in
   Abschnitt 2 von `01-REQUIREMENTS.md` ist ohne Weiteres **V1-Pflicht** und lässt
   `pnpm coverage:requirements` sofort `V1 offen: n` melden. Sie braucht: einen
   `later`-Eintrag im scope-Block in der Form `"M37 — Begründung"` (mit Geviertstrich,
   nicht mit Bindestrich), eine Aufgabe in `tasks.yaml`, und ihren Namen im Fließtext
   von `02-DESIGN.md`.
4. **Jedes Akzeptanzkriterium braucht seinen eigenen Testblock.** Die Übergangsliste
   `name_level` ist eingefroren und darf nur schrumpfen; neue IDs kommen nicht hinein.
   Ein Test heißt also `describe('R-MP-03/AK2 …')` und nicht `describe('R-MP-03 …')`.
5. **`tasks.yaml` verträgt keine Umlaute.** Die Prosadokumente verlangen sie.
   Spielertexte in `de.ts` ebenfalls — dort fällt seit T-M23-01 ein Wächter bei
   ae/oe/ue-Ersatzschrift.
6. **Dateien im Arbeitsbaum bleiben LF.** Ein Bearbeitungsskript, das CRLF schreibt,
   macht den Prosa-Wächter an Stellen rot, die seit Monaten unverändert sind.
7. **Die Browser-Vorschau startet den Dev-Server im Hauptordner, nie im Worktree.** Wer
   den Beitrittsbildschirm ansehen will, liest `WORKFLOW.md` §4 Punkt 8, bevor er sich
   wundert.
8. **jsdom rechnet kein Layout und hängt `requestAnimationFrame` an `setInterval`.** Die
   Gleichschritt-Uhr wird mit `vi.useFakeTimers` geprüft; dabei muss rAF gestubbt werden,
   sonst treibt `advanceTimersByTime` die ganze Spielschleife.
9. **Ein grüner Einzeltest sagt nichts über das Spiel.** Für M37 heißt das konkret: die
   Gleichschritt-Maschine ist erst belegt, wenn zwei vollständige Simulationen im selben
   Prozess zweihundert Ticks lang dieselbe Prüfsumme halten — mit Befehlen von beiden
   Seiten, nicht mit leeren Listen.
10. **Dieser Zweig fasst dieselben Plandateien an wie M34 und M35.** Alles Neue wird
    **angehängt**, nicht eingeschoben: neue Abschnitte ans Ende, neue Aufgaben ans Ende
    von `tasks.yaml`. Dann bleiben Konflikte auf die Anhängestellen beschränkt.
11. **Der Netz-Wächter schlägt an, sobald `new WebSocket` im Produktcode steht.** Er
    wird in T-M38-09 umgebaut, **bevor** T-M38-04 den Transport schreibt. Wer die
    Reihenfolge umdreht, hat einen roten `pnpm verify` und hält ihn für seinen Fehler.

---

## 5 · Die Reihenfolge, und warum sie so ist

**M37 — Zwei Menschen, ein Spiel.** Elf Aufgaben, keine Zeile Netzcode. Die Oberfläche
lernt, dass sie einen Spieler hat, statt `p1` zu sein; die Partieart und die feste
Geschwindigkeit kommen in den Anlegedialog; die Gleichschritt-Maschine entsteht und wird
gegen zwei Simulationen im selben Prozess belegt. **Nach M37 ist die schwierige Hälfte
fertig und bewiesen**, ohne dass je ein Paket über ein Netz ging.

**M38 — Die Verbindung.** Zehn Aufgaben. Transportschnittstelle, Handschlag,
WebSocket-Transport, Hostdienst, Wiederaufnahme, der Ausweg über die KI, und die neue
Grenze für den Netz-Wächter. **Nach M38 ist eine Partie zu zweit im selben Netz
spielbar.**

**M39 — Die Einladung.** Neun Aufgaben. Raum, Link, Beitrittsbildschirm, Startbefehl für
den Host, die letzte Meile über Tailscale, Speichern und Fortsetzen, Anleitung, und der
Haltepunkt: Noah spielt eine Partie zu zweit gegen einen Menschen in einem anderen Netz.
**Das ist AK-9 und die Abnahme dieses Features.**

Dreißig Aufgaben. Die teuerste ist T-M37-01 (die Oberfläche an achtzehn Stellen), die
riskanteste T-M38-03 (die Determinismus-Probe), und die einzige, die kein Agent
abschließen kann, ist T-M39-09 (Noah und ein Mensch).

---

## 6 · Was ausdrücklich nicht gebaut wird

Damit niemand es aus Freundlichkeit doch tut:

- **Mehr als zwei Menschen.** Das Protokoll verträgt es später, der Raum hat zwei
  Plätze. Drei Menschen brauchen eine Antwort auf „wer wartet auf wen", und die ist
  nicht geschenkt.
- **Eine Lobby, eine Freundesliste, ein Konto.** Es gibt einen Link, und den verschickt
  Noah selbst.
- **Wiederverbinden über eine neue Adresse.** Wechselt der Gast das Netz, bekommt er
  einen neuen Link. Alles andere hieße, Zustand über die Partie hinaus zu halten.
- **Schummelschutz.** Siehe §2.1. Es ist ein Spiel unter Freunden.
- **Ein Chat.** Wer zusammen spielt, hat ein Telefon.
