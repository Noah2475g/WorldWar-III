# FORTSCHRITT — Bauplan M34/M35

> **Stand:** 2026-09-11 · **Noahs Wahl:** die vier Vorschläge zur Freischaltung (1–4) und
> zwei der drei zum Spielfluss (5 und 6). **Nicht gewählt:** die ruhige Eröffnung
> (Kriegssperre in den ersten Spieltagen) — sie bleibt in Abschnitt 5 als verworfene
> Möglichkeit stehen, mit dem Grund.
>
> **Status:** freigegeben. Zwillinge in `tasks.yaml` und `03-TASKS.md` angelegt.

---

## 0 · Für den Agenten, der das baut (lies nur das hier)

1. **Erst messen, dann strecken.** T-M34-01 hält den Ausgangswert fest, bevor eine Zahl
   fällt. Ohne diesen Bericht ist jedes spätere „es ist besser geworden" unbelegt.
2. **Jede Änderung unter `data/rules` macht die Abnahme rot**, bis Parameterlauf *und*
   Turnier neu gelaufen und ihre Berichte eingecheckt sind. Der Frische-Wächter in
   `scripts/acceptance.mjs` vergleicht Commit-Zeiten, nicht Inhalte — ein Lauf ohne
   Commit hilft nicht. Das ist der Nachtlauf, nicht die vier Minuten.
3. **Der Golden-Master wird sich ändern, und das ist richtig.** `determinism.test.ts` hält
   vier Prüfsummen eines 500-Tick-Laufs fest. Eine Regeländerung verschiebt sie. Neu
   erzeugen mit `UPDATE_GOLDEN=1`, **und im Commit sagen, warum** — so steht es im Test.
   Was *nicht* passieren darf: dass die Prüfsummen sich ändern, ohne dass jemand es
   beabsichtigt hat.
4. Reihenfolge ist Baureihenfolge. Je Aufgabe ein Commit und eine Zeile in `PROGRESS.md`.
   `pnpm verify` am Ende des Meilensteins, nicht nach jeder Aufgabe.

---

## 1 · Die Analyse, auf der das hier steht (2026-09-11)

> **Diese Tabelle beschreibt den Zustand VOR M34.** Sie steht hier als Begründung, nicht
> als Stand. Was nach dem Bau gemessen wurde — Spieltag 80, 32 Minuten, 17 % der Partie,
> Siegtag 471 — steht in `docs/reports/progress-baseline.md`.

Die Uhr der Anwendung läuft mit **einem Tick je Sekunde bei Tempo 1** (`App.tsx`, die
Schleife mit `owed`), und ein Spieltag hat vierundzwanzig Ticks. Daraus folgt alles
Weitere:

| | |
|---|---|
| Letzte Freischaltung (Raketenartillerie) | Spieltag 16 |
| Das in Echtzeit bei Tempo 1 | 6,4 Minuten |
| Bei Tempo 10 | 38 Sekunden |
| Partie bis zum Sieg, Abnahmelauf AK-1 | Spieltag 798 |
| Anteil der Partie mit Freischaltungen | 2 % |

Die Tage stammen aus dem Vorbild (R-TECH-01 nennt sie als belegt: Kaserne Tag 1, Hafen
Tag 2, Eisenbahn Tag 5, Fabrik Tag 8, Flugplatz Tag 10). **Dort ist ein Spieltag ein
echter Tag** — sechzehn Tage sind sechzehn Tage Spielen. Bei uns sind sie sechs Minuten.
Die Achse ist richtig gedacht (T-M15-02 hat sie gegen genau diesen Befund gebaut: „Spieltag
1 unterschied sich von Spieltag 40 durch nichts als den Kontostand") und mit Zahlen
befüllt, die eine andere Zeitrechnung meinen.

**Drei Befunde dazu, alle am Code geprüft:**

1. **Gebäudestufen kosten auf jeder Stufe dasselbe.** `commands/build.ts` zieht
   `rule.cost` unverändert ab und setzt `completionTick` aus `rule.buildTicks`; die Stufe
   ist reine Buchführung. Eine Fabrik der dritten Stufe kostet so viel wie die erste. Die
   zweite Fortschrittsachse ist damit so kurz wie die erste.
2. **Die Leiter hängt am Kalender, nicht am Handeln.** `rules/availability.ts` kennt nur
   `currentDay`. Wer nichts tut, schaltet zur selben Stunde frei wie wer baut.
3. **Der Startvorrat trägt die Eröffnung allein.** Er reicht für rund dreizehn Infanterie
   aus der Nahrung und siebenunddreißig aus dem Geld; eine durchschnittliche Provinz
   erwirtschaftet am Tag etwa eine dreiviertel Infanterie an Nahrung. Die ersten Tage sind
   ein Abbau des Anfangslagers, keine Knappheit.

**Was nicht angefasst wird:** Öl. Ein Panzer verbraucht am Tag etwa die Hälfte dessen, was
eine durchschnittliche Provinz fördert. Dieser Engpass wirkt bereits und ist der einzige,
der die Armeegröße wirklich begrenzt.

---

## 2 · Was gebaut wird (M34)

### D34.1 Die Leiter wird gestreckt (Vorschlag 1)

Die Zielmarke: die **letzte** Freischaltung liegt bei etwa Spieltag 80 statt 16 — gut eine
halbe Stunde bei Tempo 1, drei Minuten bei Tempo 10. Der Vorschlag als Ausgangspunkt für
die Messung, nicht als Festlegung:

| Sache | heute | Vorschlag |
|---|---|---|
| Rekrutierungsbüro, Infanterie | 1 | 1 |
| Hafen | 2 | 6 |
| Transportschiff | 3 | 10 |
| Festung | 3 | 12 |
| Motorisierte Infanterie | 4 | 16 |
| Eisenbahn | 5 | 20 |
| Fabrik | 8 | 28 |
| Kampfpanzer | 8 | 30 |
| Artillerie | 9 | 34 |
| Werft | 9 | 36 |
| Flugplatz | 10 | 40 |
| Jagdflugzeug | 10 | 44 |
| Zerstörer | 11 | 48 |
| Bomber | 13 | 62 |
| Schwerer Kampfpanzer | 14 | 70 |
| Raketenartillerie | 16 | 80 |

Die Reihenfolge bleibt, die Abstände wachsen. Der erste Spieltag bleibt unangetastet: die
Kaserne muss am ersten Tag baubar sein, sonst steht der Spieler ohne Handlung da (das war
die ausdrückliche Begründung für die Eins-basierte Zählung in `availability.ts`).

> **Korrigiert am 2026-09-12 beim Bau (T-M34-03).** Die Fassung vom 2026-09-11 gab der
> **Artillerie Tag 28 und der Fabrik Tag 30** — die Einheit also zwei Tage vor dem
> Gebäude, das sie verlangt. Das ist nicht bloß unschön: `rules/load.ts` weist ein
> Regelwerk zurück, in dem eine Einheit früher zu haben ist als ihr Gebäude, und zwar aus
> gutem Grund (der Auftrag scheiterte sonst an `MISSING_BUILDING` statt am Tag, und der
> Spieler läse die falsche Begründung). Der Vorschlag widersprach damit seinem eigenen
> Satz „die Reihenfolge bleibt": heute liegt die Artillerie **nach** dem Panzer, nicht vor
> der Fabrik. Die drei Zahlen 28, 30 und 34 sind unverändert geblieben und nur in der
> richtigen Reihenfolge vergeben. Gefunden hat es kein Mensch, sondern der Test aus der
> Aufgabenbeschreibung — „kein Gebäude wird später frei als die Einheit, die es verlangt"
> —, und das ist der Grund, warum er dort steht.

### D34.2 Stufen statt Kalender (Vorschlag 2)

Drei Einheiten bekommen eine Gebäudestufe als zusätzliche Bedingung — das Feld
`requiresBuildingLevel` gibt es bereits und `commands/recruit.ts` wertet es aus:

| Einheit | heute | Vorschlag |
|---|---|---|
| Raketenartillerie | Fabrik 2 | **Fabrik 3** |
| Bomber | Flugplatz 2 | Flugplatz 2 (bleibt) |
| Zerstörer | Werft 1 | **Werft 2** |

Mehr nicht. Eine Bedingung, die niemand erfüllen kann, ist keine Fortschrittsachse,
sondern eine Sperre — und die Höchststufen sind niedrig (Fabrik 3, Werft 2).

### D34.3 Gebäudestufen werden teurer und dauern länger (Vorschlag 3)

Zwei neue Konstanten in `constants.json`, beide als Permille auf die Stufe über der
ersten:

```
buildLevelCostPermille: 1800   // Stufe n kostet 1,8^(n-1) der Grundkosten
buildLevelTimePermille: 1500   // Stufe n dauert 1,5^(n-1) der Grundzeit
```

Damit kostet eine Fabrik der dritten Stufe das 3,24-fache der ersten und dauert das
2,25-fache. Der Ort ist `commands/build.ts` (Preis) und `phases/construction.ts`
(Fertigstellung). **Das ist die einzige Kernänderung dieses Meilensteins** — sie verschiebt
den Golden-Master, und das Panel muss den Preis der *nächsten* Stufe anzeigen, nicht den
der ersten.

### D34.4 Der Startvorrat schrumpft (Vorschlag 4)

`resources.json`, `startAmount` je Rohstoff auf zwei Drittel. Nicht weiter: die Eröffnung
soll knapp werden, nicht handlungsunfähig — und der Kaufkraftverlust trifft die KI
genauso, die in der Frühphase ohnehin am schwächsten spielt.

### D34.5 Die nächste Freischaltung wird sichtbar (Vorschlag 5)

Heute steht an einem gesperrten Eintrag nur „ab Tag 34". Was fehlt, ist der Blick nach
vorn: **eine Zeile am Kopf der Rekrutierungsliste**, die die nächste Freischaltung nennt,
mit Bild, Namen und Tagen bis dahin. Aus Warten wird ein Ziel. Sie gehört hinter T-M33-02,
weil sie dieselbe Liste anfasst — und weil ein Schattenriss besser zeigt, worauf man
wartet, als ein Wort.

---

## 3 · Was entworfen wird (M35)

### D35.1 Zwischenziele zum Sieg (Vorschlag 6)

Heute gibt es **eine** Schwelle: siebzig Prozent Punktanteil, sonst nichts. Zwischen
Spieltag 20 und Spieltag 700 sagt dem Spieler niemand, ob er vorankommt. Kandidaten:
stärkste Macht eines Kontinents, eine Großmacht besiegt, eine Zahl von Provinzen, ein
Anteil der Weltbevölkerung.

**Dieser Punkt wird erst entworfen, nicht gebaut.** Er braucht neue Mechanik (ein
Zustandsfeld je Ziel, eine Prüfung im Tagestick, eine Anzeige) und berührt die
Siegbedingung — R-GAME-02 ist eine V1-Zusage. T-M35-01 ist die Vormerkung mit
Entwurfspflicht, wie T-M28-07 es vormacht: erst der Entwurf hier in Abschnitt 3, dann der
Schnitt in Aufgaben.

### Der Entwurf (T-M35-01, 2026-09-12)

**Was der Zustand heute schon trägt — am Code nachgesehen, nicht vermutet.**
`victory.ts` rechnet `scoreOf` einmal je Spieltag über Provinzen, Bevölkerung, Gebäude
und Einheiten; `pointShare` gibt daraus den Anteil. Vier der fünf Kandidaten brauchen
**kein einziges neues Zustandsfeld**:

| Zwischenziel | woraus | neues Feld? |
|---|---|---|
| Punktanteil über einer Marke (z. B. 250 ‰, 400 ‰) | `pointShare` | nein |
| Eine Zahl eigener Provinzen (z. B. 25, 50, 100) | `state.provinces`, nach Besitzer gezählt | nein |
| Ein Anteil der Weltbevölkerung | `province.population`, nach Besitzer summiert | nein |
| Eine Großmacht ist gefallen | `player.alive`, `capitalProvinceId === null` | nein |
| Stärkste Macht **eines Kontinents** | — | **ja, und zwar in der Karte** |

Der fünfte ist der teure: **die Karte kennt keinen Kontinent.** `MapProvince` führt
`id`, `name`, `kind`, `terrain`, `coastal`, `center` und `polygons` — kein Feld, aus dem
sich „Europa" ergäbe. Dieses Ziel kostet ein Kartenfeld, einen neuen Durchlauf des
Kartengenerators und eine Wanderung durch `validateMap`; es ist damit **kein Zwischenziel
mehr, sondern ein eigener Bauabschnitt** und gehört nicht in diesen.

**Was trotzdem ein neues Feld braucht: das Erreichen selbst.** Ein Ziel, das jeden Tag
neu ausgerechnet wird, kann auch wieder verschwinden — wer fünfzig Provinzen hatte und
auf achtundvierzig fällt, hätte sein Ziel nie erreicht. Gebraucht wird genau ein Feld:
`state.goals: Record<GoalKey, { reachedOnDay: number | null }>`, einmal je Spieltag
geprüft, nie zurückgesetzt. Das ist additiv (R-ARCH-02) und braucht eine Migration nach
R-GAME-05 — ein Spielstand ohne das Feld bekommt es leer.

**Was die Anzeige kostet.** Vier Zeilen in der Rangliste (`Standings.tsx`), je Ziel eine:
Zeichen, Satz, erreicht oder nicht, und bei den drei zählbaren ein Balken mit dem Stand.
Kein neues Panel; die Rangliste ist der Ort, an dem der Spieler ohnehin fragt, wie er
steht. Dazu ein Ereignis `GOAL_REACHED` im Protokoll, weil ein Zwischenziel, das man nur
beim Nachsehen bemerkt, kein Ziel ist.

**R-GAME-02 bleibt unberührt, und das ist der Kern des Entwurfs.** Zwischenziele
**gewinnen keine Partie**. Sie ändern weder `checkVictory` noch die Siegschwelle von
700 ‰; sie sind Rückmeldung, keine Regel. Damit ist die V1-Zusage nicht angefasst und
`coverage:requirements` muss nichts nachziehen. Wer sie später zu Siegbedingungen machen
will, ändert R-GAME-02 begründet — so wie T-M34-02 es mit R-TECH-01 gemacht hat.

**Umgang mit dem Golden-Master.** Ein neues Zustandsfeld verschiebt die Prüfsummen des
500-Tick-Laufs, auch wenn sich am Spiel nichts ändert — `HASH_OMIT_KEYS` kennt es nicht.
Zwei Wege, und der Entwurf wählt den zweiten: `goals` in `HASH_OMIT_KEYS` aufnehmen
(dann prüft der Determinismus-Test das Feld gar nicht) **oder** den Golden-Master mit
`UPDATE_GOLDEN=1` neu erzeugen und im Commit sagen, warum. Der zweite Weg ist richtig,
weil das Feld Teil des Spielstands ist: ein Zustandsfeld, das aus dem Hash fällt, kann
beim Speichern und Laden auseinanderlaufen, ohne dass ein Test es merkt.

**Der Schnitt in Teilaufgaben.** Vier Stück, in dieser Reihenfolge — **bewusst noch nicht
in `tasks.yaml`**, genau wie die vier Teilaufgaben aus T-M28-07 (`LEVEL-UP-3.md` §5): ein
Meilenstein gilt dem Plan-Wächter als geplant, sobald er *eine* Aufgabe trägt, und M35
wird als Ganzes geplant oder gar nicht.

1. **Die vier Ziele als Regel-Daten.** Marken in `data/rules/default/constants.json` oder
   einer eigenen `goals.json`, nicht im Code (D-08). Test zuerst: jede Marke hat eine
   Zeile in `BALANCING.md` mit Status.
2. **Das Feld und die Prüfung.** `state.goals`, einmal je Spieltag in der Tagesphase,
   nie zurückgesetzt; Migration nach R-GAME-05; Golden-Master neu erzeugt und begründet.
   Test zuerst: ein Ziel, das einmal erreicht war, bleibt erreicht, auch wenn die Zahl
   darunter wieder fällt.
3. **Das Ereignis.** `GOAL_REACHED` mit `audience: [playerId]` — ein Zwischenziel ist
   keine Weltnachricht. Test zuerst: genau ein Ereignis je Ziel und Partie.
4. **Die Anzeige.** Vier Zeilen in der Rangliste mit Stand und Zeichen. Test zuerst: das
   noch offene Ziel nennt seinen Abstand, das erreichte seinen Tag, und nach dem letzten
   steht dort kein leerer Kasten — dasselbe Muster wie die Zeile aus T-M34-08.

**Was der Entwurf offen lässt, und wer es entscheidet.** *Welche* vier Marken es sind
(25/50/100 Provinzen? 250/400 ‰?) ist eine Spielentscheidung und gehört zu Noah, nicht in
diesen Entwurf. Der Parameterlauf kann sie nicht beantworten: er misst, was eine Zahl am
Ausgang ändert, und diese Zahlen ändern am Ausgang nichts — sie ändern, wann der Spieler
etwas erfährt.

---

## 4 · Selbstkritik und Risiken

1. **Die Streckung ist geraten, bis sie gemessen ist.** Der Faktor fünf kommt aus der
   Rechnung „sechs Minuten sind zu wenig, eine halbe Stunde klingt richtig" — das ist ein
   Gefühl, keine Messung. T-M34-01 und T-M34-07 klammern die Änderung zwischen zwei Läufe;
   fällt der Siegtag dadurch unter 300 oder über 1500, wird nachjustiert statt behauptet.
2. **Die KI spielt die gestreckte Frühphase nicht automatisch gut.** Sie bekommt vierzig
   statt acht Tage mit Infanterie in der Hand. Ob sie die Zeit nutzt oder nur wartet,
   entscheidet der Turnierlauf, nicht die Vermutung — T-M34-07 vergleicht die
   Siegverteilung über die drei Schwierigkeitsstufen gegen den Ausgangswert.
3. **Vier Zahlenänderungen auf einmal lassen sich nicht auseinanderhalten.** Wenn der Lauf
   danach schlechter aussieht, weiß niemand, welche der vier es war. Gegenmittel: die vier
   Aufgaben sind einzeln committet, und T-M34-07 misst **nach jeder** von ihnen den
   Parameterlauf, nicht nur am Ende. Das kostet vier Nachtläufe statt einem — und ist der
   Unterschied zwischen einem Befund und einer Vermutung.
4. **R-TECH-01 wird geändert, und die Anforderung war als belegt markiert.** Das ist kein
   Formfehler, sondern eine bewusste Abweichung vom Vorbild mit einem nachvollziehbaren
   Grund (Abschnitt 1). T-M34-02 schreibt beides in die Anforderung: die neuen Tage **und**
   dass die alten aus einer anderen Zeitrechnung stammen. Wer sie später wieder für belegt
   hält, findet dort die Gegenrede.
5. **Teurere Gebäudestufen können die Wirtschaft kippen.** Wenn die dritte Fabrikstufe
   unerreichbar wird, ist die neue Achse wieder keine. Der Prüfstein ist
   `apps/headless/test/economy-scale.test.ts`: erreicht eine mittlere Macht die dritte
   Stufe bis Spieltag 200?
6. **Was hier nicht gebaut wird.** Keine Forschungspunkte, kein Baum, keine neue Ressource.
   T-M32-03 hält den Entscheid zur Forschung als eigene Achse offen; dieser Plan greift ihm
   nicht vor. Er macht die Achse lang, die es schon gibt.

---

## 5 · Verworfen, mit Grund

- **Die ruhige Eröffnung** (keine Kriegserklärung vor Spieltag 5 bis 10). Noahs Entscheid
  vom 2026-09-11: nicht bauen. Der Grund ist gut — eine Regel, die dem Spieler eine
  Handlung verbietet, damit ihm die Eröffnung besser gefällt, bevormundet ihn. Die
  Streckung der Leiter erreicht dasselbe, ohne etwas zu verbieten: wer am dritten Tag
  angreift, hat dann eben nur Infanterie.
- **Die Uhr langsamer stellen** statt die Tage zu strecken. Wäre einfacher und wäre falsch:
  es macht jede Partie länger, ohne einen einzigen Fortschritt hinzuzufügen. Warten ist
  kein Inhalt.
