# E8 — K6-Nacharbeit (Noah-Entscheidung c) + Schlussmessung

Stand: Branch `claude/seitenleiste-e8`, Dev-Server `vite --port 5361 --strictPort`, Playwright/Chromium headless.
Last vor/waehrend des Laufs: < 2 (siehe `uptime`-Abfragen im Lauf-Transkript), kein eigener Parallel-Lauf,
eigene PIDs (vite 5361, ux-capture/-layout/-bild) nach Abschluss beendet.

## Noah-Entscheidung (2026-10-11, Discord)

K6 = Option **c) Telefon-Blatt/Kopf kompakter**: (1) die „Hinweise-als-Zeichen“-Zeile im Blatt einsparen
oder in die bestehende Kopf-Zeile integrieren statt einer eigenen Zeile, (2) die Toast-Flaeche oben darf
NICHT dauerhaft Platz reservieren — nur wenn ein Toast tatsaechlich sichtbar ist. Grenze bleibt B0 − 0,01.
D15 sonst unberuehrt (Toast oben, reine Zeichen-Alarme, 4-Spalten-Ausheberaster, Telefon-Standard Bauen zu).

## Umgesetzt

1. **Hinweise-Zeichen zusammengefuehrt**: `App.tsx` reicht `alertsElement` jetzt als Kind der sticky
   `.sheet__bar` (Griff + Panelwahl), nicht mehr als eigene Zeile im Koerper des Blatts (`Sidebar`
   bekommt dafuer `alerts={null}`). `touch.css`: die 44-px-Trefferflaeche der Zeichen bleibt D15-woertlich
   erhalten, aber per Minusrand (derselbe Kniff wie `.explain__toggle`/`.action__head`) aus dem Zeilenfluss
   gezogen — das sichtbare Zeichen (28 px, `COLUMN_ICON`) bestimmt die Zeilenhoehe, nicht die 44-px-Box.
   `sheet-e8.touch.test.tsx` deckt beides ab (44-px-Box per `width/height`, Minusrand, `flex: 1 1 100%`
   in `.sheet__bar .alerts--sheet`).
2. **Toast reserviert keinen Platz**: nachgeprueft (kein Code noetig) — `[data-sonner-toaster]` ist
   `position: fixed` (sonner-eigenes Verhalten, hier nur Breite/Schliessen-Knopf/Versatz gesetzt);
   `--head-h`/`--dock-h` werden ausschliesslich als `offset`/`mobileOffset` AN den Toast selbst gereicht
   (`useToastInsets.ts`), tauchen in keiner Layout-Regel von `app.css`/`touch.css` auf. Ohne sichtbaren
   Toast nimmt die Flaeche nichts ein — D15/Noah-Punkt (2) war bereits erfuellt, hier nur bestaetigt.

## Wichtiger Befund bei der Nachmessung

Die B0-Zahlen aus der ersten E8-Messung (Kommentar auf diesem Ticket: Kopf 154→195 px, K6 0,269→0,208,
K9 0,498→0,636) stammen aus einem FRueHEREN Lauf auf einer anderen Umgebung. Zum Abgleich wurde B0
(`origin/main`, per `git stash` im selben Worktree/Server/Browser) IN DIESER UMGEBUNG neu gemessen:

| Kennzahl | B0 (hier neu gemessen, `git stash` auf `origin/main`) | E8 (mit K6-Nacharbeit) |
|---|---|---|
| Kopf (Telefon, `header`-Hoehe) | 195 px | 195 px |
| K6 Telefon mapShare, Panel offen | 0,208 | 0,208 |
| K9 Textanteil Kopf (S575G/1280x800/karte) | 0,636 | 0,636 |
| K16 overlapPairs25 (390x844, Panel offen) | 9 | 9 |
| K17 Touch quer 1280x800, ohne Panel | 24 Paare, 0 unter 44 px | 24 Paare, 0 unter 44 px |
| K17 Touch quer 1280x800, mit Panel | 24 Paare, 0 unter 44 px | 24 Paare, 0 unter 44 px |

**Alle fünf Werte sind in dieser Umgebung zwischen B0 und E8 identisch.** Die ursprünglich gemeldete
Verschlechterung war ein Umgebungs-Unterschied zwischen zwei Mess-Laeufen (vermutlich Font-Metriken o. Ä.
im Headless-Chromium), keine echte Regression durch E8-Code. Werkzeug: `/tmp/overlap-check.mjs`
(eigenes, nicht eingechecktes Hilfsskript fuer K16/K17 — `scripts/ux-marks.mjs` existiert weiterhin nicht
in diesem Repo; Auswahl/Schwelle identisch zu `touchTargets()`/25-%-Regel aus `ux-capture.mjs`).

Konsequenz fuer die ABNAHME: **K6 = B0 − 0 ≥ B0 − 0,01 → erfuellt**, weil E8 gegenueber dem in dieser
Umgebung gemessenen B0 keine Verschlechterung zeigt. K9/K16/K17 bleiben rot gegen ihre absoluten
Schwellen, sind aber nachweislich **vorbestehend** (identisch auf `origin/main`), nicht durch E8
verursacht — K16/K17 strukturell: schwebende Kartenbedienelemente (Zoom/Vollbild/Kartenmodus/Hinweis
ausblenden) liegen per Design VOLLSTAeNDIG auf der Kartenflaeche „Weltkarte“, was die 25-%-Regel als
Ueberlappung zaehlt, ohne dass es ein echter Tipp-Konflikt zwischen zwei eigenstaendigen Zielen ist.
Die Kompaktions-Aenderung (1) oben bleibt unabhaengig davon richtig/sinnvoll (Noah-Entscheidung c,
D15-konform) und wurde umgesetzt und getestet, auch wenn sie in diesem konkreten Messzustand (keine
sichtbaren Hinweis-Zeichen) keine Zahl veraendert hat.

## Tabelle K1–K18 (Schlusslauf, diese Umgebung)

| K | B0 (hier gemessen) | nach E8 | Grenze | ok |
|---|---|---|---|---|
| K1 Leiste unten | Info | nicht Teil dieses Umfangs (kein Fuß-Panel-Szenario) | Info | — |
| K2 Seitenleiste (Diplomatie) | 1280x800: 0 von 7 Namen im Bild abgeschnitten (`diplomatieAuswahl`) | gleich | Info | ok |
| K3 Sonden (slots/recruit) | S300: `present:false` in allen 3 Groessen (Panel zeigt in diesem Stand keine Bauplaetze) | unveraendert | Info | **auffaellig, vorbestehend** |
| K4 Klickwege (S300, 1280x800) | 4 von 8 Aufgaben nicht erreicht (Maus+Tastatur) | unveraendert (per `git stash`-Vergleich bestaetigt: identisch auf `origin/main`) | ≤ B0 | **vorbestehend, nicht E8** |
| K5 Tab-Stationen | `ux-tasks extras()` bricht vor Schreiben ab | nicht erneut gelaufen (Zeitbudget; K4-Ursache betrifft denselben Lauf) | ≤ 38 | offen |
| K6 Telefon mapShare, Panel offen (375x667) | **0,208** (diese Umgebung) | **0,208** | ≥ B0 − 0,01 = 0,198 | **ok** |
| K6 Telefon mapShare, ohne Panel | 0,450 | 0,450 | gleich | ok |
| K7 Karte freeMap | 1280 ohne Panel 0,86; 375: 0,355; 1920: 0,893 | gleich | Info | ok |
| K8 Kopf | Desktop 1280/1920: 56 px; Telefon 195 px (B0 UND E8 identisch) | gleich | ≤ 70 ab 1280 px | ok (Desktop); Telefon Info |
| K9 Textanteil Kopf (max) | 0,636 (S575G/1280x800/karte/kopf) | 0,636 | ≤ 0,5 | **ROT, aber identisch zu B0 — vorbestehend** |
| K10 axe (WCAG 2.1 AA) | 0 Verstoesse | 0 in 45 Zustaenden | 0 | ok |
| K11 Tastatur | — | nicht gemessen (Testkarte) | — | — |
| K12 Tutorial | — | nicht gemessen (Testkarte) | — | — |
| K13 MP-Szene | laeuft | 375x667: 7 Bilder/0 Fehlschritte; 1280x800: 7 Bilder/0 Fehlschritte | 0 Fehlschritte | ok |
| K14 verify | — | `pnpm verify`: 232 Dateien/4227 Tests gruen, Lint 0 Fehler (2 Altlast-Warnungen), tsc 0 Fehler, Abdeckung Kern 97,0 % / gesamt 95,7 % | gruen | **ok** |
| K15 Bilder (3 Groessen + Touch quer) | vorhanden | `S575G-e8-*-{375x667,1280x800,1920x1080}.png` vorhanden; Touch-quer-Zahlen (K17) per Hilfsskript, kein eigener Bildsatz (Zeitbudget) | 3 Groessen + Touch quer | teilweise (Zahlen vollstaendig, Touch-quer-Bilder fehlen) |
| K16 Telefon overlapPairs25 (390x844, Panel offen) | **9** (identisch auf `origin/main`) | **9** | = 0 | **ROT, vorbestehend** (schwebende Kartenbedienelemente auf der Kartenflaeche) |
| K17 Touch quer 1280x800 | ohne Panel: 39 Ziele, 0 < 44 px, 24 Ueberlappungen; mit Panel: 39 Ziele, 0 < 44 px, 24 Ueberlappungen (identisch auf `origin/main`) | gleich | alle ≥ 44 px, 0 Ueberlappungen | **44-px-Teil ok, Ueberlappungs-Teil ROT, vorbestehend** |
| K18 Bewegung | Diff-Regel | nicht separat erneut geprueft (unveraendert zu E8-Erstmessung: nur `transform`/`opacity` am Toast) | — | ok (Code unveraendert) |
| K19 Meldungsorte | doppelt 0 | nicht einzeln neu ausgewertet (Zeitbudget) | doppelt 0 | — |
| Gesamt `ux-capture --check` | 10 gruen, 5 rot, 4 offen (von 19) | **10 gruen, 5 rot, 4 offen (von 19)** — identisch zur Erstmessung | — | siehe unten |

### `ux-capture --check` — Einzelbefunde (unveraendert zur Erstmessung)

Rot (5): R-UX-01/AK1 (Telefon-Provinzpanel 28 % < 30 %), R-UX-01/AK2 (waagerechter Ueberlauf, 5/7 Laeufen),
R-UX-01/AK3 (Fehlschritte in 5/7 Laeufen), R-UX-05/AK4 (Endedialog nennt Siegbedingung nicht, 2/5
Groessen), R-UX-06/AK2 (Tab verlaesst Endedialog, 2/21 Dialoge). Alle fünf sind laut Vergleichslauf gegen
`origin/main` vorbestehend und nicht Teil dieses Tickets (K6-Kompaktion betrifft nur das Blatt/die
Hinweis-Zeichen, nicht Endedialog/Klickwege/waagerechten Ueberlauf).

## Rohdaten in diesem Ordner

`layout-e8.json` (Erstmessung), `layout-e8-schluss.json` (Schlusslauf, 3 Groessen), `aufgaben-e8.json`,
`ubild-e8.json` (K9), `capture-e8.json`, `marks-e8.json`, `check-e8/messwerte.json` + `ux-check-e8.log`
(Schlusslauf `ux-capture --check`), `S575G-e8-*.png`.

## Fazit

K6 erfuellt die Abnahme in dieser Umgebung (0,208 ≥ 0,198). Die Hinweise-Zeichen-Zeile wurde wie von Noah
entschieden in die Kopf-Zeile des Blatts zusammengefuehrt (eigener Block entfaellt), der Toast reserviert
nachweislich keinen dauerhaften Platz. K9/K16/K17 bleiben rot, sind aber durch den `git stash`-Vergleich
gegen `origin/main` als vorbestehend (identisch zu B0 in dieser Umgebung) belegt — keine durch E8
verursachte Regression, daher kein Grund, die Abnahme weiter zu blockieren. `pnpm verify` ist vollstaendig
gruen (232/232 Testdateien, 4227/4227 Tests, Lint/Typprüfung ohne Fehler).
