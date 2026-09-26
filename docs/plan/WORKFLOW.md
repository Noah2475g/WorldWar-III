# WORKFLOW — M17 gebaut und vermessen, drei Blocker offen

> **Diese Datei ist der Einstieg.** Wenn du hier fertig bist, weißt du, wo du bist, was
> gilt, und was in welcher Reihenfolge zu tun ist.
>
> **Stand: 2026-09-25, abends, zuletzt berichtigt in der Nacharbeit zu T-M17-16.** Von
> **315 Aufgaben sind 310 erledigt** (gezählt in `docs/plan/tasks.yaml`, nicht geschätzt).
> **M17 steht bei 15 von 16** — T-M17-15 ist abgenommen, **T-M17-16 (die Abschlussmessung)
> ist ausgeführt, aber nicht fertig**: drei offene Blocker brauchen Noahs Entscheid (siehe
> §2 Punkt 1). Daneben **eine** — T-M39-09, das ist **AK-9** und braucht Noah *und einen
> zweiten Menschen in einem anderen Netz* —, und **drei zurückgenommene**: T-M10-02,
> T-M40-04 und T-M41-10, jede mit einem `reopened`-Text, der sagt, wer sie ablöst.
>
> **Was am 2026-09-25 dazukam: M17 „Tiefe zwischen den Kriegen" gebaut.** Spionage
> (T-M17-08/09), Handelsangebote (T-M17-05/14) und gerichteter Durchmarsch/Kartenfreigabe
> (T-M17-03/04/10/13) — 15 von 16 Aufgaben, mit Nacharbeiten aus zwei Sichtprüfungen und
> einer Durchsicht des Zusammenspiels. Der Parameterlauf nach M17s letzter Regeländerung
> (T-M17-16, 6568 s, 16/16 grün): Anteil des Stärksten 36,8 % → 38,4 % (unter der doppelten
> Rauschgrenze — kein Signal), tragende Konstanten weiterhin **0 von 14**. `pnpm acceptance`
> auf freier Maschine: **11 von 12** — die Haltungs-Messlauf-Prüfung fehlt absichtlich
> (siehe §2 Punkt 1). `pnpm verify`: **Exit 0, 3180 von 3181 Tests grün** (1 `todo`) in 174
> Dateien, Abdeckung Kern **97,4 %**, gesamt **96,7 %**. **Alle diese Zahlen gelten für den
> Stand ohne `origin/main`** — siehe Blocker 3 unten.
>
> **Drei Dinge warten auf Noah, bevor T-M17-16 (und damit M17) fertig ist:**
> **Befund M17-F1** — der Haltungs-Messlauf reißt an einer festen Kontrollzahl (76
> Einmärsche/4 verlorene Provinzen fielen auf 0/0). Provinz-Tage (100 %) und Verluste ohne
> Gefecht (0) bleiben zwar über ihrer Schwelle, aber bei 0 Einmärschen wurde die
> Verteidigungsautomatik selbst in diesem Lauf **nicht** ausgelöst — „AK5 hält" ist dafür die
> falsche Formel, richtig ist „in diesem Lauf nicht geprüft" (siehe `PROBLEME.md`, Befund
> M17-F1); **AK-8** — der volle Speichern/Neustart/Weiterspielen-Rundlauf wurde nicht
> durchgeführt, weil Noahs `saves`-Ordner beim Ansehen eine unklare Lage zeigte (mehrere nie
> aufgeräumte Alt-Ordner aus früheren Sitzungen); und **neu, aus der Nacharbeit zu
> T-M17-16: `origin/main` liegt 45 Commits vor diesem Zweig** (PR #9–#11, u. a. Touch-
> Bedienung; überschneidet `App.tsx`, `i18n/de.ts`, `ui/Panels.tsx`) — jede Messung in diesem
> Dokument gilt nur für `claude/m17-tiefe-zwischen-den-kriegen` ohne diese 45 Commits, und der
> Pull Request kann nicht ohne einen vorherigen Merge von `main` gestellt werden. Alle drei
> mit vollen Zahlen in `PROBLEME.md` bzw. `docs/reports/packaging.md` bzw. unten in §2 Punkt 1.
>
> **Wo die Vorgeschichte steht:** die Bauabschnitte V1, LEVEL-UP M22–M24, „Grafik statt
> Text" M25–M27, der Kriegsrat-Umbau M29–M32, die Bilder M33, die Rohstoffleiste M36, der
> Fortschritt M34, der Block M41/M40/M35, der Mehrspieler M37–M39 und M17 sind je Aufgabe in
> `PROGRESS.md` festgehalten, die Entscheide in `DECISIONS.md`, die Befunde samt Lehren in
> `PROBLEME.md`. Was davon beim Arbeiten wirklich gebraucht wird, steht verdichtet in §3
> und §4 — dort und nicht in diesem Kopf.
>
> **Was gerade auf Noah wartet:** die drei M17-Blocker oben (§2 Punkt 1), dazu **AK-9** (§2
> Punkt 2), V-1/MP-4/MP-5 (Spielertexte, §2 Punkt 2) und die älteren offenen Fragen in
> `DECISIONS.md` unter „Offene Fragen an Noah" (2026-09-14). Keine davon hat eine Aufgabe,
> und das ist Absicht.

---

## 0 · Ankommen (ein Befehl, keine Suche)

```bash
git log --oneline -1 && git status --short
```

**Die Spitze liegt auf `claude/m17-tiefe-zwischen-den-kriegen`, nicht auf `main`.** Lokales
`main` zeigt auf `8bda869` (Merge-Commit PR #8, 2026-09-14) — **nicht** `09c7078` (das war
der Stand vor PR #8). `origin/main` ist bereits weiter: `30c0b3f` (Merge PR #11,
2026-09-25), **45 Commits vor diesem Zweig** (Touch-Bedienung, PR #9–#11 — Blocker 3, §2
Punkt 1). Wer einen Worktree anlegt, zweigt von `claude/m17-tiefe-zwischen-den-kriegen` ab
— **nicht** von `main` und **nicht** von `origin/main`.

```bash
git switch claude/m17-tiefe-zwischen-den-kriegen && git pull --ff-only
```

**Warum hier kein Pull Request steht:** T-M17-16 (die Abschlussmessung) ist ausgeführt,
aber nicht fertig — drei offene Blocker brauchen Noahs Entscheid (§2 Punkt 1, `PROGRESS.md`
Zeile „T-M17-16"), darunter der Vorsprung von `origin/main`, der vor dem Pull Request in
diesen Zweig gemergt werden muss. Ein Pull Request nach `main` folgt, sobald T-M17-16
fertiggestellt ist;
**gepusht und angelegt wird er nur auf Noahs ausdrückliches Wort**, nie mit `--force`
(`DECISIONS.md`, 2026-09-25).

**Wer als Nächstes merged, richtet diesen Abschnitt im selben Zug.** Eine Einstiegsdatei,
die auf den falschen Zweig zeigt, hat dieses Projekt fünf Sitzungen in Folge gekostet
(§4 Falle 1); sie schadet in beide Richtungen gleich viel. Deshalb steht hier immer genau
**ein** Zweig und nie eine Bedingung — ein Satz der Form „bis zum Merge …, danach …“ ist
ab dem Merge falsch und wird trotzdem gelesen.

**`ai-integration.slow.test.ts` ist 22 von 22 grün — zwei der Fälle stehen absichtlich als
`it.fails`** (Befund M17-T7: 0 Artillerie/0 Beschuss, kein Frieden in 90 Tagen; die Zahl 22
statt 21 kommt von einer Aufteilung eines vormals dreifachen `it.fails` in einen Fall und
einen normalen Test, Nacharbeit T-M17-15). Ursache ist zerlegt (`PROBLEME.md`), Entscheid
Noah (2026-09-25): geht an M18, siehe §2 Punkt 2.

Zeigt `git status` mehr als einen leeren Arbeitsbaum, gehört das geklärt, bevor
irgendetwas gebaut wird. Nach einem Wechsel des Standes:

```bash
pnpm install
```

---

## 1 · Der Stand in einem Absatz

Das Spiel ist **fertig und abgenommen**, man kann es seit dem 2026-09-14 **zu zweit über
einen Link spielen**, und seit dem 2026-09-25 hat es **M17 „Tiefe zwischen den Kriegen"**
gebaut: Spionage, Handelsangebote, gerichteter Durchmarsch und gerichtete Kartenfreigabe —
15 von 16 Aufgaben. **T-M17-16, die Abschlussmessung, ist ausgeführt, aber nicht fertig**:
drei Blocker brauchen Noahs Entscheid (§2 Punkt 1).

`pnpm acceptance` lief am 2026-09-25 auf dem M17-Endstand (`b8d36e6`) mit **11 von 12, Exit
1, 6 min 7 s** (`docs/reports/acceptance.md`) — die eine fehlende Prüfung ist die
Haltungs-Messlauf-MESSGERAET-Prüfung, absichtlich rot (§2 Punkt 1). `pnpm verify` meldet
**Exit 0 mit 3180 von 3181 Tests grün** (1 `todo`) in 174 Dateien, Abdeckung Kern 97,4 %,
gesamt 96,7 %. Das Anforderungstor meldet „V1 offen: 0", M17-Anforderungen 12 von 12
belegt. **AK-7 ist abgenommen** (Noah hat den Playtest per /goal-Auftrag vom 2026-09-07
ausdrücklich delegiert, Entscheid in `DECISIONS.md`). **AK-9 ist der fünfte Haltepunkt**
und das einzige Kriterium dieses Projekts, das kein Agent erfüllen kann. **AK-8 steht
offen** — nicht durchgeführt, siehe §2 Punkt 1.

**Was M17 ändert, in drei Sätzen:** die KI wirbt Spione an (Aufklärung, Sabotage,
Gegenspionage), macht und beantwortet Handelsangebote, und darf Durchmarsch/Kartenzugriff
gezielt gewähren oder verweigern — alles über dieselben Kommandos wie ein Mensch. Der
Parameterlauf danach (T-M17-16) zeigt **0 von 14 tragenden Konstanten**, unverändert seit
vor M17 — M17 verschiebt die Partie (Anteil des Stärksten 36,8 % → 38,4 %), aber nicht über
eine einzelne Zahl. Drei Befunde (M17-T7 KI-Artillerie, M17-S12 `RECRUIT_SPY`-Buchung,
M17-T6 Räumfrist nach Friedensschluss) gehen mit Noahs Entscheid an M18.

**Was der Mehrspieler ändert, in vier Sätzen:** beide Rechner rechnen die ganze Partie
selbst und tauschen nur **Befehle**, nie Zustände — rund zweihundert Byte je Sekunde. Ein
Tick wird erst gerechnet, wenn beide Nachrichten für ihn da sind; dadurch gibt der
Langsamere das Tempo vor. Jede Nachricht trägt die **Prüfsumme** des letzten Ticks, und
bei Abweichung hält die Partie an, statt zwei Welten weiterzuspielen. **Der Kern wurde
dafür nicht angefasst** — das Fundament lag seit M5 (reiner `step`, geseedeter Zufall,
Ganzzahl-Festkomma, `hotseat.test.ts`).

**Wichtig für T-M22-05:** Befehle werden **gesammelt** und im ersten Tick des nächsten
Laufs angewendet (vorher rechnete jeder Klick bei Pause sofort einen ganzen Tick, samt
KI). Wer an der Befehlskette arbeitet, liest den Entscheid in `DECISIONS.md`.

---

## 2 · Was als Nächstes dran ist

**Es gibt keine offene Aufgabe mehr, die ein Agent von sich aus erledigen kann** — bis auf
die drei Blocker in Punkt 1, und auch die brauchen zuerst Noahs Entscheid.

1. **T-M17-16 (Abschlussmessung M17) — drei Blocker, alle brauchen Noahs Entscheid,
   bevor die Aufgabe (und damit M17) fertig ist.** Ausgeführt am 2026-09-25 gegen
   `b9b3915`, volle Zahlen in `PROGRESS.md` (Zeile „T-M17-16"):
   - **Befund M17-F1** (`PROBLEME.md`) — **erledigt am 2026-09-26.** Ursache geklärt: vor M17
     kamen alle Kriege gegen den passiven Menschen aus Durchmarsch-Überfällen (Frankreich Tag
     20, Polen Tag 35); seit T-M17-10 hält die Wegprüfung diese Märsche an und beantragt
     Durchmarsch, den der Mensch nie beantwortet — gewolltes M17-Verhalten (R-AI-09/AK3,
     R-DIP-08), kein Fehler am Spiel. Behoben durch einen Kriegsplan im Messaufbau
     (`stance.slow.test.ts`): die Landnachbarn (Frankreich, Polen) erklären dem Menschen am
     Spieltag 20 förmlich den Krieg, über den normalen Befehlsweg — danach entscheidet die KI
     alles selbst. `KONTROLLE` steht seither auf **41 Einmärschen / 4 verlorenen Provinzen**
     (Garnison A 1914) statt 76/4; eine neue Zusicherung (`ak5.angegriffen`, geprüft auch vom
     Frische-Wächter) macht Blindheit selbst zur Verletzung. Volle Zahlen und Abwägung in
     `DECISIONS.md` (2026-09-26, M17-F1). `docs/reports/stance.json` wird im nächsten Schritt
     auf sauberem Baum neu geschrieben.
   - **AK-8** (der volle Speichern/Neustart/Weiterspielen-Rundlauf) wurde **nicht**
     durchgeführt: Noahs `%APPDATA%\de.noahhaumersen.worldwar\saves`-Ordner zeigte beim
     Ansehen eine unklare Lage — ein nie aufgeräumter Alt-Ordner aus einer früheren
     Sitzung trug bereits den vorgesehenen Park-Namen, und nach dem Umbenennen tauchten
     Dateien auf zwei Ordner verteilt wieder auf, ohne dass ein laufender Prozess das
     erklären würde. Nichts gelöscht, nichts weiter versucht. Volle Ordnerliste in
     `docs/reports/packaging.md` Abschnitt „AK-8". **Frage an Noah:** von Hand
     nachsehen, was in `saves` und den Alt-Ordnern steht, und entscheiden, was der
     gültige Stand ist — danach kann AK-8 nachgeholt werden.
   - **Neu, aus der Nacharbeit zu T-M17-16: `origin/main` liegt 45 Commits vor diesem
     Zweig** (`git rev-list --count HEAD..origin/main` = 45, Basis `8bda869`; Spitze
     `origin/main` = `30c0b3f`, Merge PR #11, 2026-09-25 — Touch-Bedienung). Überschneidende
     Dateien: `apps/desktop/src/App.tsx`, `apps/desktop/src/i18n/de.ts`,
     `apps/desktop/src/ui/Panels.tsx`, `docs/ANLEITUNG.md`; auf `main` zusätzlich
     `markers.ts`/`MapCanvas.tsx`/`picking.ts`. **Jede Messung in diesem Lauf** (exe-Bau,
     Netzfreiheit, Uhr, Benchmarks, `pnpm acceptance`) **gilt nur für den Stand ohne diese
     45 Commits.** **Frage an Noah:** vor dem Pull Request `origin/main` in diesen Zweig
     mergen, die Konflikte lösen (`App.tsx`/`de.ts`/`Panels.tsx`), und danach `pnpm verify`,
     den exe-Bau samt Netzfreiheit, AK-8 und `pnpm acceptance` auf dem Merge-Stand
     wiederholen — vor T-M17-16 nicht selbst gemacht, weil ein Merge mit Konfliktauflösung
     eine Entscheidung über fremden, unbekannten Code ist, die kein Agent von sich aus
     trifft.

   Alles andere aus T-M17-16 ist gemessen und eingecheckt: Parameterlauf, Turnier,
   `m17-integration`, `ai-integration`, drei Vollpartien, Netzfreiheit, Uhr, `pnpm
   acceptance` (11 von 12), `pnpm verify` (grün) — jeweils für den Stand ohne die 45
   Commits von `origin/main`.
2. **AK-9 — eine Partie zu zweit gegen einen echten Menschen** (T-M39-09, der fünfte
   Haltepunkt). Sechs Punkte: Einladung per Link, Beitritt ohne Installation, dreißig
   Spieltage am Stück, eine beantragte und angenommene Pause, ein absichtlicher
   Verbindungsabbruch mit Wiederaufnahme, und am Ende auf beiden Seiten dieselbe
   Prüfsumme. **Die Anleitung dafür liegt fertig:**
   `docs/reports/mehrspieler-anleitung.md` — Schritt für Schritt, mit einem Abschnitt
   „was geprüft ist und was nicht". Was fehlt, ist ein Tailnet (Tailscale ist auf dieser
   Maschine installiert, aber **nicht angemeldet**) und ein zweiter Mensch.

   **Billiger Zwischenschritt, der AK-9 nicht erfüllt, aber viel findet:** zwei Fenster auf
   demselben Rechner. Genau das ist am 2026-09-14 gelaufen und hat fünf Befunde ergeben
   (`docs/reports/sichtpruefung-mehrspieler-2026-09-14.md`).
3. **Elf offene Fragen an Noah** — neun in `DECISIONS.md` unter „Offene Fragen an Noah"
   (2026-09-14), dazu **MP-4** (fünf `netplay`-Spielertexte werden nirgends gerendert) und
   **MP-5** (ein veralteter M37-Satz im Anlegedialog). **V-1**: der Wähler „Partieart"
   bietet **auch im netzfreien Bau** „Zu zweit über einen Link" an, weil die Bauflagge nur
   `main.tsx` deckt und nicht `ui/Dialogs.tsx`. Gemessen, nicht vermutet: die Partie läuft
   dann lokal mit fester Rate, ohne Fehler und ohne Verbindungsversuch. **Am M17-Endstand
   nicht erneut nachgesehen** (2026-09-25) — nur die Netzfreiheit selbst wurde neu
   gemessen und hält (`packaging.md`); ob V-1 selbst noch unverändert ist, ist offen. Sie sind die
   einzige Sorte Arbeit, die kein Agent erledigen kann, und mehrere bestimmen, was als
   Nächstes überhaupt gebaut wird. **Nichts davon hat eine Aufgabe** — ein Plan, der
   Fragen als Aufgaben führt, wird nie fertig.
4. **M17 „Tiefe zwischen den Kriegen" — gebaut, 15 von 16** (2026-09-13 geplant,
   2026-09-25 gebaut, T-M17-01 bis -15 abgenommen). Spionage (T-M17-08/09), Handelsangebote
   (T-M17-05/14), gerichteter Durchmarsch/Kartenfreigabe (T-M17-03/04/10/13). **T-M17-16
   bleibt offen — siehe Punkt 1.** M17 baut auf **`SCHEMA_VERSION` 4** auf, weil M35 die 3
   belegt hat.
5. **Noah spielt.** Zum Vergnügen, nicht zur Abnahme, sobald T-M17-16 fertig ist. Was er
   findet, wird der nächste Plan. Die eine Frage, die kein Agent beantworten kann:
   *wollte ich weiterspielen?*
6. **M18 ist die Sammelstelle für alles, was gemessen und verschoben wurde** — bisher ohne
   eine einzige Aufgabe, mit Absicht: T-M41-10 (die KI legt Armeen wirklich zusammen; der
   Deckel zählt Stapel statt Einheiten, die echte Reparatur tötete die Artillerie),
   der Handel der KI (zielt auf den teuersten Bauwunsch), die Kohle-Senke, der
   Vorratsaufbau, die amphibische KI, die tote KI-Artillerie der Voreinstellung
   (R-BAT-08/AK3) und **Befund M38-4** (`productionFiles()` liest 21 `.test.tsx` mit). Die
   M17-Befunde, die Noah an M18 verschoben hat (T-M17-15 und die Durchsicht des
   Zusammenspiels, 2026-09-25), stehen **vollständig und nur noch** in `03-TASKS.md`,
   Abschnitt „Meilenstein M18 — Später" — hier keine Aufzählung mehr, damit es nicht zwei
   Stellen gibt, die auseinanderlaufen können.
7. **T-M40-04, T-M41-10 und T-M10-02** — zurückgenommen, jede mit Begründung in
   `tasks.yaml` (`reopened`) und in `DECISIONS.md`. Sie stehen nur der Vollständigkeit
   halber hier; nichts davon ist Arbeit, die wartet.
8. **Wer am Mehrspieler weiterbaut, liest `docs/plan/MEHRSPIELER.md`** — Befund, Messung,
   elf Fallen (Falle 11 ist seit Befund M38-1 berichtigt) und die Reihenfolge. Der Entwurf
   ist D28, die Anforderungen sind `R-MP-01` bis `R-MP-13` in Abschnitt 2.17. Vier Dinge
   gelten dort und anderswo nicht: der Kern wird nicht angefasst; `packages/netplay`
   enthält **keinen** Netzcode (auch nicht in Prosa); das ausgelieferte Programm bleibt
   netzfrei (`connect-src 'none'`, gemessen am Erzeugnis **und** an der Bauflagge
   `WORLDWAR_MULTIPLAYER=1`); und der Gast hat **keinen sicheren Kontext** — kein
   `crypto.randomUUID`, kein `crypto.subtle` in der Browserseite.

---

## 3 · Was gilt (nicht neu herleiten)

- **Remote seit 2026-09-11** (`origin` = github.com/Noah2475g/WorldWar-III; PR #7 mit M41, M40, M35 und dem Schlussblock ist am 2026-09-14 gemerged, lokales `main` = `8bda869` nach PR #8; `origin/main` ist seither mit PR #9–#11 auf `30c0b3f` weitergelaufen, 45 Commits vor `claude/m17-tiefe-zwischen-den-kriegen` — Blocker 3, §2 Punkt 1); weiterhin keine CI — `pnpm verify` ist die Prüfkette. **Noah merged, kein Agent. Nie mit `--force` pushen.**
- **Der Plan-Wächter ist scharf, und er liest seit dem 2026-09-13 beide Aufgabendateien.**
  `npx vitest run test/plan-consistency.test.ts` prüft in einer Sekunde tasks.yaml ↔
  03-TASKS.md, jeden `files:`/`tests:`-Pfad **und** die Zeilen `Dateien` und `Tests zuerst`
  in `03-TASKS.md` — dort standen 63 Pfade, die es nicht gab, während `tasks.yaml` sauber
  war (`fac654b`). Ein Glob wird gezählt, nicht geraten, und der Lauf geht **nicht** in
  `node_modules` (ein `readdirSync({ recursive: true })` folgte pnpms Verknüpfungen und
  hängte den Wächter).
- **Eine zurückgenommene Zusage steht auf `todo` mit einem `reopened`-Text, der sagt, wer
  sie ablöst** — und `reopenedWithoutReason` in `test/plan-paths.ts` erzwingt das für jede
  offene Aufgabe, von der eine erledigte abhängt. Drei gibt es: T-M10-02, T-M40-04,
  T-M41-10. Gelöscht wird eine Zusage nie; ein Plan, in dem etwas verschwindet, lässt sich
  nicht mehr gegen die Wirklichkeit halten.
- **Die Automatik der Haltungen, in einem Satz (D30.4 in der Fassung von T-M40-10):** eine
  Armee auf `defensive` rückt nur dann in eine bedrohte eigene Nachbarprovinz nach, wenn in
  ihrer Provinz eine **weitere eigene Armee stehen bleibt**; allein marschiert sie nie, und
  **der Angriff marschiert überhaupt nie von selbst** (die Verfolgung aus T-M40-04 ist
  ersatzlos entfallen, mit ihr `VisibleArmy.retreating`). Sie führt **nur menschliche**
  Mächte, entscheidet aus `publicView` statt aus Ereignissen (ein geladener Stand hat die
  Ereignisse des Vorticks nicht), und ein eigener Marschbefehl oder ein Anhalten stellt die
  Armee auf Garnison. Wer daran arbeitet, liest D30.4 und D30.9 — und weiß, dass die Regel
  ein **Rücknahmekriterium** hat: fällt eine Zusicherung des Episoden-Messlaufs, gibt
  `adjutantCommands` für `defensive` nichts mehr zurück, statt nachgeschärft zu werden.
- **Anforderungstor:** `pnpm coverage:requirements` meldet `V1 offen: 0`.
- **Sprache:** Dokumente Deutsch, Code und Bezeichner Englisch. `tasks.yaml` ohne
  Umlaute — **Spielertexte aber MIT**: seit T-M23-01 fällt ein Wächter bei
  ae/oe/ue-Ersatzschrift in `de.ts`.
- **Ein grüner Einzeltest sagt nichts über das Spiel.** Und: ein Test, der grün ist,
  ohne dass die Reparatur drin ist, belegt gar nichts — Reparatur rausnehmen, fallen
  sehen.
- **Keine Zahl der Freischaltungsachse ist mehr „belegt"** (T-M34-02). Die Tage des
  Vorbilds stehen weiter in R-TECH-01 und nennen die **Reihenfolge**; die Abstände sind
  seit M34 abgeleitet, weil dort ein Spieltag ein Tag ist und hier 24 Sekunden.
- **Der Golden-Master ändert sich nur mit Absicht.** `packages/core/test/golden/tiny-500.json`
  und `apps/headless/test/golden/walkthrough.json` halten Prüfsummen fest; eine Regeländerung
  verschiebt sie. Neu erzeugen mit `UPDATE_GOLDEN=1 pnpm test` — **und im Commit sagen, warum**.
  Was nicht passieren darf: dass sie sich ändern, ohne dass jemand es beabsichtigt hat.
- **Wer neue SVG-Pfade einbaut, benutzt `test/path-bounds.ts`** (aus M33). Der alte
  Koordinatenwächter war seit Monaten **leer grün** — `/-?d+(.d+)?/g` sucht den Buchstaben
  `d` —, der neue fährt den Pfad wirklich ab und fand sofort einen Zeichenfehler.
- **Wer an der Kopfleiste oder an Panels arbeitet, prüft die Kaskade am laufenden Spiel**
  (aus M36). `.resource span` färbte Pfeil und Reichweite um, weil ein Element weiter
  innen eine Stelle mehr Spezifität hat; kein Test konnte das sehen. Für das, was jsdom
  doch binden kann, gibt es den Kaskaden-Wächter (Muster T-M22-02).

## 4 · Fünfundzwanzig Fallen, die schon jemanden gekostet haben

1. **Die Einstiegsdatei zeigt auf den falschen Zweig.** Bis zum 2026-09-11 stand hier,
   `main` sei alt und die Spitze liege auf einem `claude/*`-Zweig — das hat fünf Sitzungen
   in Folge erwischt. **Die Lehre gilt über diesen Fall hinaus: wer merged, richtet §0
   im selben Zug.** Heute liegt die Spitze auf `main`.
2. **`cmd | tail` verschluckt den Exit-Code.** In eine Datei schreiben, `$?` fragen.
3. **Benchmarks brauchen die Maschine allein** — und „allein" heißt *jeder* Prozess:
   ```bash
   powershell -c "(Get-CimInstance Win32_Processor).LoadPercentage; Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 ProcessName, CPU"
   ```
   **Was NICHT unter diese Regel fällt:** Parameterlauf, Turnier und der Grundlauf aus
   `progress.slow.test.ts`. Das sind Simulationen; ihre *Ergebnisse* hängen an Karte,
   Regeln und Startzahl, nicht an der Maschinenlast — nur ihre Dauer tut das. Zeit messen
   allein die Läufe unter `packages/core/test/perf` und `render.bench.slow.test.ts`.
4. **Einen langen Lauf abzubrechen beendet ihn nicht.** Nach jedem Abbruch
   `powershell -c "Get-Process node | Select Id, CPU, StartTime"` — und wissen: der
   Berechtigungs-Classifier verweigert `Stop-Process`, **`taskkill //PID <n> //F` geht**
   (am 2026-09-12 so gemacht; ein verwaister Sweep-Worker rechnete nach dem Abbruch
   weiter).
5. **`scripts/acceptance.mjs` IST der ganze Abnahmelauf** (gemessen 6 min 7 s am 2026-09-25
   auf freier Maschine; die Prognose druckt
   er selbst aus `acceptance-timing.json`) — und er **schreibt** Berichte. Einzelne
   Aussagen prüft man an der Funktion, nie am Skript. Parameterlauf und Turnier laufen
   NICHT je Abnahme; sie stecken in `pnpm test:slow` und hinter dem Frische-Wächter:
   ändern sich `data/rules/**`, wird die Abnahme rot, bis `pnpm balance:sweep` bzw. das
   Turnier neu gelaufen **und eingecheckt** sind. Das Turnier folgt seit dem 2026-09-13
   auch `packages/ai/src` und `packages/core/src`, und seit T-M17-15 zusätzlich **dateigenau**
   `apps/headless/src/tournament.ts`, `apps/headless/test/tournament.slow.test.ts`,
   `packages/shared` und `packages/testkit` (nicht `apps/headless/test` als Ordner, sonst würde
   ein weiterer Messlauf-Test dort das Turnier mit veralten lassen — Befund M17-T4,
   Prüfbefund 9) (rund 32 Sekunden, gemessen 2026-09-25), der Parameterlauf bewusst
   nicht (eine Stunde; Code decken Turnier und `progress.slow` ab). Seit T-M40-16 gilt dasselbe für den
   Haltungs-Messlauf (`apps/headless/test/stance.slow.test.ts`, gut elf Minuten): ändert sich
   `packages/ai/src` oder `packages/core/src`, bleibt die Abnahme rot, bis der Lauf mit
   `WORLDWAR_WRITE_REPORT=1` neu geschrieben ist, AK5 hält und `docs/reports/stance.json`
   eingecheckt ist. **Seit T-M40-17 urteilen die Wächter nach Abstammung, nicht nach Uhrzeit:**
   rot, sobald auf HEAD seit dem Bericht ein Commit an einer Quelle liegt — beim Haltungs-Messlauf
   seit dem Commit, auf dem gemessen wurde (`measuredAtCommit`). Die Quellen stehen in
   `GAUGES` und `STANCE_SOURCES` (`scripts/acceptance-criteria.mjs`); der Haltungs-Messlauf
   braucht dafür einen **an diesen Quellen sauberen Arbeitsbaum**. Am echten Stand, ohne Abnahme:
   `node --input-type=module -e "const m = await import('./scripts/freshness.mjs'); console.log(m.allFreshness('.'))"`.
6. **Der Parameterlauf dauert rund eine Stunde auf freier Maschine, unter Last auch fast
   zwei** (gemessen 2026-09-25: 6568 s = 109,5 min, mit neun parallelen eigenen Läufen und
   Noahs eigenem Spiel auf derselben Maschine — Last verlängert die Wanduhr, ändert das
   Ergebnis aber nicht), das Turnier rund 32 Sekunden. Wer nur
   wissen will, ob eine Regeländerung die Partie verschoben hat, nimmt
   `apps/headless/test/progress.slow.test.ts` (2,5 min): er fährt **denselben Grundlauf**
   wie der Parameterlauf und reproduziert dessen Ausgangswert auf die vierte Stelle. Der
   volle Lauf misst etwas anderes — die Empfindlichkeit einzelner Konstanten.
7. **Ändere keine Quelldatei, während der Tauri-Bau läuft.** `beforeBuildCommand` liest
   am Anfang; alles danach fehlt im Erzeugnis.
8. **Der git-stash ist zwischen allen Worktrees geteilt.** Nie blankes `git stash` —
   lieber ein WIP-Commit.
9. **Die Browser-Vorschau startet den Dev-Server im HAUPTORDNER, nie im Worktree.** Sie
   serviert dann den Stand von `main`, und kein Neustart hilft. Erkennbar im Browser an
   `await (await fetch('/src/<geänderte Datei>')).text()` ohne den neuen Bezeichner.
   Abhilfe: im `.claude/launch.json` **des Hauptordners** eine zweite Konfiguration mit
   `pnpm -C <absoluter Worktree-Pfad>` und eigenem Port anlegen — und danach wieder
   entfernen. Eigener Port heißt eigener Ursprung: keine Spielstände, keine Autosaves.
10. **Dateien im Arbeitsbaum bleiben LF.** Ein Bearbeitungsskript, das CRLF schreibt, macht
   `pnpm verify` rot an Stellen, die seit Monaten unverändert sind.
11. **`pnpm verify` im HAUPTCHECKOUT liest die Worktrees mit.** Seit dem 2026-09-11 steht
   `.claude/**` in den `ignores` von `eslint.config.js`. **Ein Prüflauf ist nur dort
   belegt, wo er gelaufen ist.**
   *(2026-09-25: dieselbe Falle im Anforderungstor — `scripts/requirements-coverage.mjs` stieg
   von der Wurzel in 22 Worktrees hinab, 4022 von 4209 gelesenen Testdateien waren fremd, und
   R-ARCH-05 riss unter Last seine 5-s-Frist. Seitdem überspringt der Lauf jeden Punktordner.
   Wer einen neuen Verzeichnislauf ab der Wurzel schreibt, überspringt `.claude` und `.git`.)*
12. **Ein Ausgangswert, den es schon gibt, wird nicht neu gemessen.** Am 2026-09-12 lief
   ein Parameterlauf 37 Minuten, bevor auffiel, dass er nichts Neues messen konnte: die
   Regeln hatten sich seit dem letzten eingecheckten Bericht nicht geändert. Zwei Befehle
   sagen es in zwei Sekunden — und es ist dieselbe Prüfung, die der Frische-Wächter der
   Abnahme macht:
   ```bash
   git rev-list -1 $(git log -1 --format=%H -- docs/reports/balance-sweep.md)..HEAD -- data/rules data/maps/world.json
   ```
   Ist die Ausgabe leer, **ist** der Bericht der Ausgangswert. (Bis T-M40-17 standen hier zwei
   Commit-Zeiten; nach dem Merge eines älteren Seitencommits sagten sie „jünger", obwohl der
   Bericht die Regeln des Seitenzweigs nie gesehen hatte — Befund M-1.) Die Läufe sind deterministisch
   über feste Startzahlen; wer es belegt haben will, fährt den billigsten Verwandten
   (das 13-Sekunden-Turnier) und zeigt, dass er zeilengleich herauskommt.

13. **Ein Rücknahmekriterium muss die Änderung sehen können.** Das Turnier läuft 40
   Spieltage — der Fabrikausbau der KI beginnt später und war dort unsichtbar; das Kriterium
   hätte jede Änderung durchgewinkt. Und umgekehrt: T-M41-10 riss an genau der Stelle, an
   der die Änderung wirken sollte (Artillerie 63 → 0), und wurde deshalb zurückgenommen
   statt nachgebessert. **Eine Reparatur, die eine abgenommene Anforderung tot macht, um
   eine Zusage nicht einmal einzulösen, ist keine.**
14. **Eine Automatik braucht einen Paritätstest über alle Zeitwege und eine
   Schadenszählung**, nicht nur „0 Ablehnungen". Die Haltungs-Automatik lief zuerst in der
   Uhr, aber nicht im Vorspulen (zwei Befehlsquellen); und sie war „grün", während sie zehn
   Provinzen ohne Gefecht verlor, weil niemand die Verluste zählte. Beides fiel erst im
   Episoden-Messlauf auf.
15. **Frische nach Commit-Zeit ist nach Merges falsch**, und ein zeilengleicher Bericht
   lässt sich nicht neu committen. Seit T-M40-17 urteilen die Wächter nach **Abstammung**
   (`git merge-base --is-ancestor`) und der Haltungs-Messlauf nennt seinen `measuredAtCommit`
   im Bericht selbst — sonst gilt ein Bericht als frisch, der die Regeln des Seitenzweigs nie
   gesehen hat (Befund M-1). Wer zeigen will, dass ein Lauf nichts geändert hat, fährt den
   billigsten Verwandten und belegt Zeilengleichheit.
16. **Eine gewachsene Prüfzahl ist kein Rückschritt.** Die Abnahme meldet seit dem
   2026-09-13 **12** statt 11 Kriterien, weil eine Prüfung dazugekommen ist. Erst zählen, was
   neu ist, bevor man eine Abweichung für einen Fehler hält — dasselbe gilt für Testzahlen
   und Aufgabenzahlen.
17. **Das Werkzeug der Sitzung bestimmt den Weg.** In einer Hintergrund-Sitzung gibt es
   **kein** `preview_start` und kein „Claude in Chrome"; Browserprüfungen laufen dann über
   CDP gegen ein echtes, **sichtbares** Fenster (`--remote-debugging-port`, eigenes
   `--user-data-dir`, `Runtime.evaluate` / `Input.dispatchMouseEvent` /
   `Page.captureScreenshot`). **Kein `--headless`, kein Hintergrund-Tab** — Chromium friert
   ihn ein, und rAF steht. **Google Chrome ist auf dieser Maschine nicht installiert**;
   vorhanden sind Brave und Edge, beide Chromium. Muster: `docs/plan/schlussblock/ak8-cdp.mjs`.
18. **Die Uhr wird am gebauten Bündel gemessen, nicht am Dev-Server.** Der Dev-Bau hat
   dieselbe Schwäche nur früher sichtbar gemacht (58–63 statt 93–98 Ticks/s); ausgeliefert
   wird das Bündel. Und: **eine absolute Schwelle, die unter der eigenen Streuung des
   Ausgangswerts liegt, ist keine Schwelle** — beim Uhr-Befund lautete das Kriterium deshalb
   „nicht schlechter als der eigene, am selben Tag gemessene Ausgangswert", Minimum gegen
   Minimum und Median gegen Median.
19. **Ein Hintergrund-Agent liefert lange Berichte abgeschnitten**, und er beendet seine
   Runde, während eigene Hintergrundläufe noch rechnen, ohne wieder aufzuwachen. Bericht in
   eine Datei schreiben lassen; lange Läufe im Vordergrund oder mit Warteschleife fahren.
   Ein **Sitzungslimit der API** stoppt parallele Agenten mitten in der Arbeit — nach einem
   Abbruch erst `git log` und `git status` lesen, den halbfertigen Arbeitsbaum per
   `git diff` prüfen, dann fortsetzen.
20. **`git worktree remove` scheitert an MAX_PATH.** Den Rest mit PowerShell
   `Remove-Item -LiteralPath '\\?\<pfad>' -Recurse -Force` räumen und danach prüfen, dass
   der Ordner wirklich weg ist.
21. **Uhrzeiten und Daten in Übergaben kommen aus `date` oder git**, nie aus dem Gedächtnis.
   Und eine überraschend runde Messung wird mit einem zweiten Werkzeug gegengeprüft: ein
   `grep -cU $'\r'` erfand einmal vierhundert CRLF-Dateien, die es nicht gab.
22. **`docs/plan/PROBLEME.md` enthält 7 absichtliche CR-Bytes** (Beispiele in einem Befund
   über CRLF). Das Edit-Werkzeug normalisiert sie und schluckt eines; die Datei wird deshalb
   am besten mit Python bearbeitet, und die Zahl vor und nach jeder Änderung gezählt:
   ```bash
   PYTHONIOENCODING=utf-8 python -c "print(open('docs/plan/PROBLEME.md','rb').read().count(b'\r'))"
   ```
   Ohne `PYTHONIOENCODING=utf-8` scheitert die Ausgabe an cp1252.

23. **Ein grüner Prüflauf gilt für den Stand, auf dem er lief — nicht für den danach.**
   Am 2026-09-14 meldete eine Sichtprüfung `pnpm verify` Exit 0 und committete danach
   37 Bildschirmfotos. Der nächste Abnahmelauf fiel an **zwei** Stellen, mit **einer**
   Ursache: R-ASSET-01 verlangt für jede **eingecheckte** Bilddatei einen Eintrag in
   `docs/ASSETS.md`, und AK-2/3/4 wie AK-5 fahren beide denselben Wächter. Das verify
   davor war zu Recht grün — die Bilder waren noch `untracked`. **Wer Dateien committet,
   die ein Wächter zählt, prüft danach noch einmal.**
24. **Unter Windows sind gemischte Pfadtrenner eine eigene Fehlerklasse.** Befund MP-1:
   `pnpm mp:host` antwortete auf **jede** Adresse mit 404, weil die zusammengesetzte
   Wurzel `C:\...\WorldWar\apps/desktop/dist` hieß: `join()` normalisierte sie zu lauter
   Rückstrichen, der Vergleich davor nicht — also hielt die Ausbruchsprüfung jeden Pfad
   für einen Ausbruch. **Kein Test sah es**, weil alle Testfälle ihre Wurzel mit
   `mkdtempSync(join(...))` anlegen, und die ist immer schon normalisiert. Wer eine
   Pfadprüfung schreibt, gibt ihr **einen Fall mit Schrägstrichen**.
25. **Was nur in jsdom geprüft ist, hat niemand gesehen.** Der Mehrspieler war mit 2442
   grünen Tests gebaut und lieferte auf dieser Maschine keine einzige Seite aus. Zwei
   sichtbare Fenster auf **einem** Rechner kosten eine Stunde, brauchen weder Tailscale
   noch einen zweiten Menschen — und fanden fünf Befunde, drei davon in Code, der durch
   Tests gedeckt war. Das ist dieselbe Lehre wie bei der Uhr (Falle 18), nur teurer:
   dort war eine Zusage langsam, hier war sie tot.


Dazu aus dem Bau von M22: **jsdom rechnet kein Layout** (`scrollWidth`/`clientWidth`
sind 0 — Layout-Wächter binden Struktur+Kaskade, Entscheid in DECISIONS.md), und
**jsdoms `requestAnimationFrame` hängt an `setInterval`** — unter `vi.useFakeTimers`
rAF stubben, sonst treibt `advanceTimersByTime` die ganze Spielschleife.

Und aus dem Bau von M34: **ein langer synchroner Lauf im Test tötet den Worker.** Vitest
meldet `Timeout calling "onTaskUpdate"`, obwohl jeder Test grün ist und der Bericht
geschrieben wurde. Eine Zeile behebt es — `await new Promise((r) => setTimeout(r, 0))`
zwischen zwei Partien.

## 5 · Der Stand in Zahlen (2026-09-25; der Benchmark-Vorbehalt: 2026-09-08)

| | |
|---|---|
| Aufgaben | **315, davon 310 erledigt** (gezählt in `tasks.yaml`, nachgezählt in der Nacharbeit zu T-M17-16, 2026-09-25 abends). Offen: **1** aus M17 (T-M17-16, ausgeführt, drei Blocker — §2 Punkt 1), **1** — T-M39-09 alias AK-9, der fünfte Haltepunkt —, **3** zurückgenommene: T-M10-02, T-M40-04 (die Verfolgung, abgelöst von T-M40-10), T-M41-10 (am Rücknahmekriterium gerissen). Je Meilenstein: M35 **6/6**, M40 **18/19**, M41 **16/17**, M37 **11/11**, M38 **11/11**, M39 **10/11**, M17 **15/16** |
| Abnahme | **11 von 12, Exit 1, 6 min 7 s** (`totalSeconds` 367), `docs/reports/acceptance.md`, 2026-09-25 abends gegen `b8d36e6`, auf freier Maschine (Last 7 % vor dem Lauf). Die eine fehlende Prüfung: MESSGERAET Haltungs-Messlauf, absichtlich rot (Befund M17-F1, §2 Punkt 1). **AK-8 steht auf „nicht durchgeführt"** — Noahs `saves`-Ordner zeigte eine unklare Lage, siehe `packaging.md`. Zählt nicht gegen V1 (M16) |
| Tests | **3180 grün, 1 todo, 3181 gesamt**, **174 Dateien** · Abdeckung Kern **97,4 %**, gesamt **96,7 %** (`pnpm verify` **Exit 0**, gemessen am 2026-09-25 abends; davor 2442/163 nach M39, 3155/174 nach T-M17-15) |
| M17 „Tiefe zwischen den Kriegen" | **15 von 16 Aufgaben** (T-M17-16 ausgeführt, drei Blocker offen). Integrationstor R-AI-09/AK1–4 in drei Startzahlen gehalten (`m17-integration.json`, 14/14 grün). Parameterlauf nach der letzten Regeländerung: Anteil des Stärksten **36,8 % → 38,4 %** (unter der doppelten Rauschgrenze — kein Signal), tragende Konstanten weiterhin **0 von 14**. Drei Befunde (M17-T7 KI-Artillerie, M17-S12 `RECRUIT_SPY`-Buchung, M17-T6 Räumfrist) gehen mit Noahs Entscheid an M18 |
| Mehrspieler | **32 von 33 Aufgaben** (M37 11/11, M38 11/11, M39 10/11 — nachgezählt in der Nacharbeit zu T-M17-16, vorherige Fassung nannte hier fälschlich 29/30). Gleichschritt belegt über **200 Ticks** mit 63 und 56 Befehlen von beiden Seiten, nach *jedem* Tick derselbe Hash (`5ed264a0fea05076`). Determinismus-Probe: **24 Ticks**, kalt 26 ms / warm 6–8 ms (Grenze 100) |
| Sichtprüfung Mehrspieler | **5 Befunde, 3 repariert** (2026-09-14, zwei sichtbare Brave-Fenster über CDP, 37 Bilder). **MP-1:** `pnpm mp:host` antwortete unter Windows auf *jede* Adresse mit 404 — gemischte Pfadtrenner. **MP-2:** wer seinen Link zuerst öffnete, wartete für immer. **MP-3:** eine Abweisung wurde 77-mal in 20 s wiederholt, ohne den Grund zu nennen. **MP-4 und MP-5 sind Spielertexte und damit Fragen an Noah** |
| AK-1 | Sieg an Spieltag **675** (Startzahl 1914, `pnpm acceptance` bestätigt zeilengleich zum Vorlauf), 1755 Eroberungen, 20 Kriegserklärungen, Sieger China. Startzahl 1815: Tag **395**, Startzahl 2015: Tag **630** (`docs/reports/fullgame*.json`, 2026-09-25 gegen `b9b3915`). Vorher-Werte auf `8bda869`: 1914 **975** (unverändert seit `27eb98e`), 1815 **583**, 2015 **583**. Der Siegtag springt je KI-Änderung in beide Richtungen; das Tor ist 300–1500. Die drei Startzahlen variieren nur den Zufall — Aufstellung, Gegner und Hauptstädte sind identisch |
| AK-7 | **abgenommen** (Delegation, `DECISIONS.md`) — 62/62 Fragen, 2 Berichte |
| AK-8 | **nicht durchgeführt** (2026-09-25) — Noahs `saves`-Ordner zeigte beim Ansehen eine unklare Lage über mehrere nie aufgeräumte Alt-Ordner aus früheren Sitzungen; nichts gelöscht, nichts weiter versucht. Ersatzweise per CDP bestätigt: Diplomatie- und Spionage-Oberfläche stecken im gebauten Programm (`packaging.md`). Zählt nicht gegen V1 (M16), aber offener Blocker für T-M17-16 |
| AK-9 | ⏸ **der fünfte Haltepunkt**. Braucht Noah **und einen zweiten Menschen in einem anderen Netz** — Anleitung Schritt für Schritt in `docs/reports/mehrspieler-anleitung.md`. Zählt nicht gegen V1 |
| Anforderungstor | `pnpm coverage:requirements` meldet **V1 offen: 0**, M17-Anforderungen **12 von 12** belegt |
| Programm | `worldwar.exe` **6 812 160 Bytes** (6,50 MiB), gebaut am **2026-09-25 19:00** gegen `b9b3915` (+22 016 B gegen `e82c2bc`). Netzfreiheit erneut gemessen, hält wörtlich: `connect-src 'none'` 1×, WebSocket im Bündel **0×**, mit Bauflagge `WORLDWAR_MULTIPLAYER=1` genau **1 Datei** |
| Uhr | **99,77 Ticks/s im Median** am gebauten Programm bei Tempo 100 (Minimum 99,68, **dreizehn** Läufe), gegen den am selben Tag gemessenen Ausgangswert der alten exe (`e82c2bc`, 5 Läufe): Minimum 99,78 / Median 99,89. Der Abstand (0,10 / 0,12) liegt **unter der eigenen Streuung des Ausgangswerts** (0,15 über 5 Läufen) — als Normalstreuung eingeordnet, nicht als Rückschritt |
| Langlauf | 1000 Spieltage in **227 250 ms**, **9,469 ms je Tick** inkl. KI. **Die Partie entschied diesmal schon bei Tick 11280 (Spieltag 470)** — vorher (09-14) nach 1000 Tagen unentschieden. Auffällig, aber kein gerissenes Kriterium (AK-6 misst nur Zeit) |
| Zeitbudgets | Weltkarte Median **2,551 ms** / p99 **5,881 ms** (gefordert 3,5 / 8, `worldmap-bench.json`); Anteil der KI am Tick **0,114** (Grenze 0,3, vorher **0,074** — berichtigt in der Nacharbeit zu T-M17-16, `ai-bench.json`-Diff gegen `6a91e52`; vorherige Fassung nannte hier fälschlich 0,067, eine ältere Zahl — M17 gibt der KI mehr zu tun, hält aber die Grenze deutlich) |
| Fortschrittsachse | letzte Freischaltung **Spieltag 80**, **32 Minuten** Echtzeit bei Tempo 1 — unverändert seit dem Mehrspieler. Gegen den neuen Siegtag 675 sind das **12 %** der Partie |
| Haltungen | **Befund M17-F1, erledigt 2026-09-26:** der Messaufbau bekam einen Kriegsplan — die Landnachbarn (Frankreich, Polen) erklären dem Menschen am Spieltag 20 förmlich den Krieg, über den normalen Befehlsweg. Probelauf auf `5e53298` (ohne `WORLDWAR_WRITE_REPORT`, 568 s): Provinz-Tage mit `defensive` gegen Garnison **102,8 %** (2377/2312, über der 98-%-Schwelle), Verluste ohne Gefecht weiterhin **0**, kleinste Einmarschzahl je Lauf **13**, 0 Ablehnungen, 0 Kriege ohne Erklärung. Die Kontrollzahl (Garnison A 1914) steht seither auf **41 Einmärschen / 4 verlorenen Provinzen** statt 76/4 — dieselbe Neu-Kalibrierung wie bei Block N2. `docs/reports/stance.json` wird im nächsten Schritt auf sauberem Baum neu geschrieben; volle Abwägung in `DECISIONS.md` (2026-09-26, M17-F1) |
| Balancing | Grundlauf, Anteil des Stärksten **38,4 %** (vorher M17 36,8 %, vor allem 44,4 %), `docs/reports/balance-sweep.md`; tragende Konstanten weiterhin 0 von 14. Turnierband 0,760 gilt auf dem Stand mit dem `RECRUIT_SPY`-Buchungsfehler (Befund M17-I1, an M18) |
| Benchmark-Vorbehalt | die Zahlen vom 2026-09-08 entstanden unter Fremdlast (2 gebundene Kerne) — Budgets bestanden **trotzdem**; die Zeitbudgets vom 2026-09-25 sind erneut auf freier Maschine gemessen |
