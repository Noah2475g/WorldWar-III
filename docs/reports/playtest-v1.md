# Playtest V1 — Noahs Antworten

> Erzeugt von `node scripts/playtest-sheet.mjs --init` aus `docs/PLAYTEST.md`.
> Fragen und Reihenfolge stehen dort; hier stehen nur die Antworten, damit beide
> Dateien nicht auseinanderlaufen können. Läuft der Bogen weiter, den Befehl erneut
> aufrufen — bereits gegebene Antworten bleiben stehen.

**Erlaubte Antworten:** `ja`, `nein`, `n.z.` (nicht zutreffend/nicht geprüft).
**Jedes `nein` braucht eine Zeile in der Befundtabelle unten**, mit derselben
Fragenummer — sonst gilt AK-7 als offen. Das ist die einzige Regel, die dieser Bogen
sich selbst auferlegt, und sie ist die, an der Abnahmebögen sonst scheitern.

**Fragen im Bogen:** 60

| Frage | Anforderung | ja/nein | Anmerkung |
|---|---|---|---|
| 1 | R-UI-01 | ja | [G] Leinengrund, Tusche, gedeckte Nationalfarben; Zinnober nur als Signal. Aus der Leinwand gemessen: #cdb77e, #a2c293, #dcafaf - die Werte aus tokens.ts. Gegengeprueft: der Kartenmodus "Moral" faerbt eigene Provinzen oliv (#505738), NICHT zinnoberrot - der aus dem Code abgeleitete Verdacht auf eine gebrochene Farbreservierung bestaetigt sich im Lauf nicht. |
| 1a | R-UI-04 | ja | [G] document.fonts meldet alle vier Schnitte als "loaded": IBM Plex Sans 400/600, Sans Condensed 600, Mono 400. Kein Systemrueckfall. Die Kartennamen stehen in Condensed, die Zahlen in Mono mit tabular-nums. |
| 2 | R-UI-02 | ja | [G] Kontrast gerechnet an den echten Bildschirmfarben: Werte 11,94:1, kleine Beschriftungen 5,44:1 - beide ueber der Schwelle 4,5. Anmerkung: die kleinsten Texte stehen bei 10 px (Legende, Fortschritt der Einstiegshilfe); lesbar, aber am unteren Rand. |
| 3 | R-FREE-02 | nein | [G] Kein Treffer fuer Kauf, Abo, Premium, Shop, EUR oder Dollar im gesamten sichtbaren Text. Der Knopf "Markt" ist eine Rohstoffboerse gegen Spielgeld, kein Laden. Erwartungsgemaess. |
| 4 | R-GAME-01 | nein | [G] BLINDSCHALTER, BEFUND BESTAETIGT. "Kleine Welt (12)" gewaehlt, Partie gestartet - es laeuft die WELTKARTE: die Provinzliste zeigt "Mittlerer Westen", "Ostkanada", "Suedstaaten". testworld.json enthaelt dagegen "Hafen, Waldland, Bergland, Mittstadt". Alles andere (Macht, Gegnerzahl, Schwierigkeit, Siegbedingung, Startzahl) ist frei waehlbar und wirkt. Befund P-04. |
| 4a | R-GAME-02 | nein | [G] Punkte und Eroberung sind beide waehlbar, aber das Spiel erklaert an keiner Stelle, was sie bedeuten. Unter "Startzahl" steht ein Hinweissatz, unter "Siegbedingung" keiner. Befund P-02. |
| 5 | R-AI-02 | ja | [G] Im Startdialog: "Die KI spielt ohne Bonus - sie sieht dieselbe Karte wie Sie." |
| 6 | R-UI-03 | ja | [G] Als Vereinigte Staaten oeffnet die Karte auf Nordamerika, die eigenen Provinzen mittig im Bild. |
| 7 | R-MAP-01 | ja | [G] Kontinente am richtigen Platz, Grenzen sauber, deutsche Provinznamen, Meer abgesetzt. |
| 8 | R-UI-03 | ja | [G] Geprueft mit Farbmessung: der Klickpunkt lag auf #cdb77e (eigene Provinz) und waehlte genau die Provinz aus, die dort gezeichnet ist. Mein erster Verdacht auf einen Fehltreffer war meiner: die Beschriftung stand hoeher, als ich geschaetzt hatte. |
| 9 | R-UI-03 | n.z. | [U] Nicht pruefbar: das Browserfenster lag im Hintergrund, requestAnimationFrame feuerte 0-mal in 2 s, und Zoom/Verschieben haengen daran. Aus dem Code gemeldetes Risiko: MapCanvas und die Zeigerumrechnung nutzen zwei verschiedene Grenzenrechnungen, die bei nicht-quadratischem Fenster auseinanderlaufen koennen. Muss am sichtbaren Fenster nachgeholt werden. |
| 10 | R-MAP-06 | ja | [G] Vier Modi - Besitz, Rohstoffe, Moral, Truppenstaerke - jeder mit eigener Legende unten rechts und einem Erklaerknopf ("Was ist Besitz?"). Taste M schaltet weiter. |
| 10b | R-MAP-05 | n.z. | [G] Besitz, Bauten und ein Gefecht (rotes Zeichen bei Ostkanada) waren zu sehen. Eigene Einheiten auf der Karte blieben ungeprueft: meine einzige Armee entstand erst spaet, und ohne zeichnende Karte war ihre Darstellung nicht zu beurteilen. [C] Gemeldetes Risiko: mehrere Armeen an einem Ort liegen ohne Versatz auf demselben Punkt. |
| 11 | R-DIP-04 | ja | [G] Unaufgeklaertes Gebiet bleibt hell/grau, die aufgeklaerten Nachbarn tragen Spielerfarben. Anmerkung: im Modus Besitz haben Nebel und herrenloses Land dieselbe Farbe (#DAD5C6), die Legende nennt beides "neutral" - unterscheidbar ist es damit nicht. Befund P-08. |
| 12 | R-ARCH-06 | n.z. | [U] Nicht pruefbar, siehe 9: ohne requestAnimationFrame zeichnet die Karte nicht, ein Ruckeln kann man so nicht beurteilen. Der Tickbudget-Bench liegt bei 2,55-2,66 ms gegen 3,5 ms gefordert; das ist die Rechenzeit, nicht die Bildrate. |
| 13 | R-UI-05 | ja | [G] "Kaserne: 333 Material, 250 Geld - 1 Tag", "Infanterie: 75 Nahrung, 50 Material, 67 Geld - 14 h - Anfangsstaerke 89 % (Provinzmoral)". Einschraenkung: die ARMEEBEFEHLE (Marschieren, Angriff, Rueckzug, Teilen) tragen keinen Tooltip - siehe 25a. |
| 13a | R-PROV-01 | ja | [G] Bei angehaltener Uhr gemessen: Material -333, Geld -250, exakt wie angekuendigt. Der Auftrag erscheint als Balken mit "noch 1,1 Tage". |
| 13b | R-PROV-01 | ja | [G] Abbruch funktioniert; das Protokoll meldet "Bau abgebrochen, halbe Kosten erstattet" - unabhaengig nachgemessen: +166 Material, +125 Geld, also genau die Haelfte. ZWEI Einschraenkungen: der Knopf heisst "[province.cancelBuild]" (Befund P-01), und die Erstattung erfaehrt man erst hinterher. Die Frage im Bogen unterstellt "gibt nichts zurueck" - das ist falsch (Befund P-06). |
| 14 | R-UI-05 | ja | [G] Jede gesperrte Aktion nennt den Grund im Klartext: "Das gibt es erst ab Spieltag 3.", "Dafuer fehlt das Gebaeude: Kaserne.", "Dieses Ziel ist fuer den Befehl nicht zulaessig. (braucht Kueste)", "Keine Einheit mit Reichweite dabei." |
| 15 | R-ECON-01 | nein | [G] Das WOHER ist klar (Vorkommen je Provinz, Produktion je Rohstoff). Das WOHIN nicht: die Spalte "Verbrauch" stand ueber 35 Spieltage durchgehend auf 0, obwohl laufend gebaut und ausgehoben wurde. [C] Sie fuehrt ausschliesslich den Armeeunterhalt. |
| 16 | R-ECON-06 | ja | [G] Die Wirtschaftstabelle fuehrt je Rohstoff Bestand, Produktion, Verbrauch und Bilanz, jeder mit Erklaerknopf. |
| 16b | R-ECON-06 | ja | [G] Ueber genau einen Spieltag gemessen, angekuendigte Bilanz gegen tatsaechlichen Zuwachs: Nahrung +450/+450, Material +176/+176, Eisen +27/+27, Kohle +68/+68, Geld +198/+198. Fuenf von fuenf auf die Einheit genau. |
| 17 | R-TIME-01 | ja | [G] Tempo laesst sich jederzeit umschalten; die Pause haelt nachweislich auch die Produktion an (Bestand blieb ueber 1,2 s unveraendert). Tasten + und - schalten eine Stufe weiter. |
| 18 | R-TIME-02 | n.z. | [U] Nicht pruefbar: bei Tempo 100 stand die Uhr, weil requestAnimationFrame im minimierten Fenster nicht feuert (0 Aufrufe in 2 s). Das ist eine Grenze der Testumgebung, kein Befund - dieselbe Einschraenkung steht seit dem 2026-09-03 in SESSION-STATE. Am sichtbaren Fenster nachzuholen. |
| 19 | R-TIME-03 | nein | [G] Das Vorspulen laeuft und haelt an - aber es schreibt nie auf den Bildschirm, WARUM. Ueber 30 Klicks kein Hinweistext, auch nicht waehrend Gefechte liefen. R-TIME-03 verlangt die Begruendung ausdruecklich. |
| 20 | R-TIME-04 | n.z. | [U] Die Kernfrage braucht eine durchgespielte Sitzung mit laufender Uhr; siehe 18. Was ich sagen kann: es gibt acht Tempostufen plus Vorspulen, und das Vorspulen wirkt auch ohne laufende Uhr. |
| 21 | R-UNIT-02 | n.z. | [U] Der Marschbefehl liess sich ohne zeichnende Karte nicht bis zur Zielwahl durchfahren. [C] Die Vorschau nennt die Ankunft laut Code vor der Bestaetigung; die LAUFENDE Anzeige zeigt aber nur die Ankunft am naechsten Wegpunkt, nicht am Ziel. |
| 22 | R-BAT-01 | nein | [G] Das Protokoll meldet DASS und WER ("Gefecht entschieden - Brasilien behauptet das Feld"), aber kein WARUM: keine Verluste, keine Staerken, kein Gelaende. [C] Die Bausteine fuer einen Kampfbericht liegen in der Sprachdatei und werden nicht benutzt. Fuer ein EIGENES Gefecht ungeprueft. |
| 23 | R-DIP-01 | ja | [G] Acht Handlungen mit Begruendung je gesperrter Aktion ("Das geht nur im Krieg. Erklaeren Sie zuerst den Krieg."), Erklaerknopf am Zustand ("Frieden: Kein Krieg, kein Buendnis. Truppen duerfen die Grenze nicht ueberschreiten."), und die Vorlaufzeit steht im Protokoll: "Vereinigte Staaten erklaert Kanada den Krieg. Wirksam ab Tag 2." Einschraenkung: die Vorlaufzeit erfaehrt man erst HINTERHER, der Knopf sagt sie nicht vorher. |
| 24 | R-AI-01 | ja | [G] Ueber 35 Spieltage nachvollziehbar: die KI fuehrt Kriege, erobert (Nicaragua an Mexiko, Afghanistan an Indien), Provinzen wechseln mehrfach. Nichts offensichtlich Dummes beobachtet. Einschraenkung: Einblick in ihre Absicht gibt es nicht - die dafuer gebaute Debug-Ansicht ist leer (siehe 48). |
| 25 | R-AI-03 | n.z. | [U] Nicht in einer Sitzung beurteilbar; verlangt zwei Partien gleicher Laenge auf verschiedenen Stufen. [C] Belegt ist es im Turnier - aber auf der Zwoelf-Provinzen-Karte, nicht auf der ausgelieferten. |
| 25a | R-BAT-05 | nein | [G] Der Rueckzug IST moeglich - der Knopf steht da und ist aktiv. Aber er sagt NICHT, was er kostet: kein Tooltip, kein Hinweistext. Die zweite Haelfte der Frage scheitert. Befund P-05. |
| 25b | R-BAT-07 | n.z. | [U] Fuer ein EIGENES Gefecht ungeprueft. Bei fremden Gefechten nennt das Protokoll bewusst keine Verluste - das ist der Sichtschutz aus R-DIP-04 und richtig so. |
| 25c | R-UI-05 | ja | [G] Der Abbruch-Knopf existiert und wirkt (siehe 13b). Aber seine Beschriftung ist der rohe Schluessel "[province.cancelBuild]". Befund P-01. |
| 25d | R-UI-13 | n.z. | [U] Die eigene Niederlage liess sich in der Sitzung nicht herbeifuehren. [C] Ausgeschieden ist man erst ohne Provinz UND ohne Armee - wer die letzte Provinz verliert und noch eine Armee im Feld hat, bekommt die Meldung nicht. |
| 25e | R-GAME-01 | nein | [G] Waehrend einer laufenden Partie gibt es KEINEN Weg zu einer zweiten: kein Knopf traegt "neue", "Partie", "beenden", "aufgeben" oder "zurueck" (27 Knoepfe geprueft), und keine Taste oeffnet einen solchen Dialog. Das "Menue" enthaelt nur Einstellungen. Ob nach dem Ende einer Partie ein Weg erscheint, blieb ungeprueft - ich habe keine Partie zu Ende gebracht. Selbst wenn: der Startbildschirm nach dem Neuladen ist die einzige bekannte Tuer, und der fuehrt zu Befund 26a. |
| 26 | R-GAME-03 | ja | [G] Speichern und Laden funktionieren: "Stand 1 - Tag 1" nach dem Speichern, der Eintrag steht in IndexedDB. ABER: die Spielstaende sind AUSSCHLIESSLICH ueber Strg+S erreichbar - kein Knopf in der Oberflaeche fuehrt dorthin, "Menue" oeffnet nur die Einstellungen. Befund P-03. |
| 26a | R-GAME-03 | nein | [G] Der Stand UEBERLEBT (IndexedDB "worldwar", Store "saves", Schluessel "stand-1" nach dem Neuladen vorhanden) - aber er ist nicht ERREICHBAR: der Startbildschirm bietet nur "Partie beginnen" und ein Kreuz, Strg+S wirkt dort nicht. Schliesst man den Startdialog, bleibt eine leere Flaeche mit "Die Welt wird aufgebaut ..." zurueck, aus der keine Taste und kein Knopf herausfuehrt. Befunde P-03 und P-11. |
| 26b | R-GAME-05 | ja | [G] Ton aus und Schriftgroesse "gross" gesetzt, Fenster neu geladen, Partie gestartet: beide Werte stehen unveraendert im Menue, und localStorage fuehrt {"sound":false,"fontScale":"large"}. Auch Automatikspeicher-Intervall, Hoechstgeschwindigkeit und Debug-Schalter ueberleben. |
| 27 | R-UI-06 | n.z. | [G] Bestaetigt: Leertaste (Pause, haelt auch die Produktion an), + und - (Tempostufen), M (Kartenmodus), Strg+S (Spielstaende), Escape (schliesst Dialoge). NICHT geprueft: F und die Pfeiltasten - beide wirken auf die Karte, die im minimierten Fenster nicht zeichnet. Am sichtbaren Fenster nachzuholen. |
| 28 | R-UI-07 | nein | [G] Auf dem Bildschirm steht der rohe Uebersetzungsschluessel "[province.cancelBuild]" als Knopfbeschriftung unter "Im Bau" - der einzige Fund dieser Art im sichtbaren Text. Grenzfall: Armeen heissen "Armee 80", also nach ihrer Kennung. Befund P-01. |
| 30 | R-UI-10 | nein | [G] Symbole stehen an Gebaeuden, Einheiten und Rohstoffen. Aber zwei sind nicht auseinanderzuhalten: Flugplatz (Gebaeude) und Jagdflugzeug (Einheit) zeigen beide auf denselben Pfad "aircraft" (icons.tsx:131 und :143). Befund P-12. |
| 31 | R-UI-09 | ja | [G] Die Moral ist ein role=meter mit Balken und Wert ("Moral: 70 %"), nicht nur eine Zahl. Der Pfeil ist als .meter__trend--up/--down gebaut und erscheint nur bei einem Trend ueber einer halben Prozentstelle; bei ruhender Moral sah ich ihn folgerichtig nicht. |
| 32 | R-UI-09 | ja | [G] Der Bauauftrag ist ein role=meter: Balken bei 4 %, Text "noch 1,1 Tage", aria-valuetext gesetzt. Wie weit UND wie lange noch. |
| 33 | R-UI-09 | n.z. | [U] Nicht ausgeloest: die Reichweite in Tagen erscheint nur bei negativer Tagesbilanz, und meine Bilanzen blieben ueber die ganze Sitzung positiv. |
| 34 | R-UI-11 | ja | [G] Das Fragezeichen wirkt: "Frieden" lieferte "Kein Krieg, kein Buendnis. Truppen duerfen die Grenze nicht ueberschreiten." Jeder Rohstoff, jedes Bauwerk und die Kartenlegende tragen eines. Einschraenkung: das Zeichen haengt am BAUKNOPF - fuer ein bereits stehendes Gebaeude gibt es keines. |
| 35 | R-UI-12 | ja | [G] Provinznamen stehen ab mittlerer Zoomstufe auf der Karte, in schmaler Schrift mit hellem Saum, ohne Ueberlappung. Bei weitem Zoom bekommt nur ein Teil einen Namen - das ist die Platzregel, kein Fehler. |
| 36 | R-UI-12 | ja | [G] Die Hauptstadt traegt einen Stern auf der Karte, und das Panel schreibt "Mittlerer Westen - Hauptstadt". |
| 37 | R-UI-12 | ja | [G] Ein rotes Kampfzeichen stand auf der Karte bei Ostkanada, ohne dass ich das Protokoll lesen musste. [C] Einschraenkung: ab Tempo ueber 10 hoert der Puls des Zeichens auf. |
| 38 | R-UI-12 | n.z. | [U] Nicht pruefbar: der Marschbefehl liess sich ohne zeichnende Karte nicht bis zur Zielwahl fuehren. [C] Gemeldetes Risiko: die Linie haengt an der ausgewaehlten Armee, und ein Klick auf die Karte waehlt die Provinz - was die Armeeauswahl aufhebt. |
| 39 | R-MAP-07 | ja | [G] Objektiv gemessen ueber ein Raster von 384 Bildpunkten: Besitz 22, Rohstoffe 22, Moral 19, Truppenstaerke 18 verschiedene Farben. Keiner ist durchweg grau. |
| 40 | R-UI-13 | ja | [G] Die Lageuebersicht listet je Macht Punkte als Balken, das Verhaeltnis und die gesehene Staerke. Dazu steht der Fortschritt im Kopf: "Siegziel 11 % von 70". |
| 41 | R-UI-13 | n.z. | [U] Keine Partie zu Ende gespielt. [C] Gemeldetes Risiko: der Siegdialog erscheint genau einmal; wer ihn wegklickt, bekommt ihn nicht wieder. |
| 42 | R-UI-14 | n.z. | [U] Die Meldungsliste blieb ueber 35 Spieltage leer - richtig, denn alle Gefechte waren fremde und gehen mich nichts an. Ohne eigenen Kampf nicht beurteilbar. |
| 43 | R-GAME-06 | ja | [G] Fuenf Filter unter dem Protokoll: alles, Kaempfe, Aufbau, Vertraege, Weltgeschehen. |
| 44 | R-UI-04 | n.z. | [U] Ton im Testfenster nicht beurteilbar. [C] Gemeldetes Risiko: ab Tempo ueber 10 gibt es gar keinen Ton - wer zuegig spielt, haelt das fuer einen Fehler. |
| 45 | R-UI-04 | nein | [G] Kein Element mit laufender Animation oder Uebergang gefunden. Die einzigen Bewegungen sind gewollt und kurz: eine neue Meldung blendet 220 ms auf, ein fertiger Bau leuchtet 600 ms auf - beides schaltet prefers-reduced-motion ab. Erwartungsgemaess. |
| 46 | R-UI-05 | ja | [G] Fuenf Schritte, unten links, ohne etwas zu verdecken, reagieren auf das eigene Tun. Schritt 3 erklaert die Kernmechanik verstaendlich: "Die Zahlen sind Spielstunden je Sekunde - bei 10 vergeht ein Spieltag in gut zwei Sekunden." Abschaltbar ueber "Nicht mehr zeigen". |
| 47 | R-GAME-04 | n.z. | [U] Nicht ausgeloest: der Automatikstand faellt alle 5 Minuten Echtzeit, und die Sitzung lief ueber Vorspulen statt ueber die Uhr. Die zehn Plaetze (5 manuell, 5 automatisch) stehen im Dialog bereit. |
| 48 | R-UI-08 | ja | [G] BEFUND. Die "Debug-Ansicht" laesst sich einschalten und zeigt: "Tick: 8", einen LEEREN Zustands-Hash und zwei Ueberschriften - "Ziel" und "Kommandolog" - mit NICHTS darunter. Damit ist die Antwort auf "gibt es eine Einstellung, die sichtbar nichts bewirkt" ein Ja, und die erwartete Antwort war Nein. Befund P-13. |

---

## Die drei Fragen, auf die es ankommt

| | Antwort |
|---|---|
| A. Wollten Sie weiterspielen, als die 45 Minuten um waren? | |
| B. Gab es einen Moment, in dem Sie gewartet haben, ohne es abkürzen zu können? | |
| C. Hatten Sie das Gefühl, dass die KI schummelt? | |

Erwartet: **ja / nein / nein.**

---

## Befunde

> Durchgang durch einen Agenten am 2026-09-06, nicht durch Noah. **AK-7 verlangt im Wortlaut
> Noahs Abnahme** - dieser Bogen ersetzt sie nicht, er nimmt ihr die Suche ab.
> `[G]` = im laufenden Spiel gefahren · `[C]` = aus dem Code, nicht im Lauf geprueft.

| Frage | Was | Wie schlimm |
|---|---|---|
| 3 | Kein Befund - "nein" ist hier die erwartete Antwort. Kein Treffer fuer Kauf, Abo, Premium, Shop oder Waehrung im sichtbaren Text; der "Markt" ist eine Rohstoffboerse gegen Spielgeld. | - |
| 4 | BLINDSCHALTER: "Kleine Welt (12)" gewaehlt, es startet trotzdem die Weltkarte (Provinzen "Mittlerer Westen"/"Ostkanada" statt "Hafen"/"Waldland"). Befund 38/N10 ist NICHT geschlossen - docs/PLAYTEST.md:149 behauptet das Gegenteil und ist damit selbst falsch. | HOCH |
| 4a | Punkte- und Eroberungssieg sind waehlbar, aber nirgends erklaert. Unter "Startzahl" steht ein erklaerender Satz, unter der Siegbedingung keiner - dabei entscheidet sie, wie die Partie endet. | mittel |
| 15 | Die Spalte "Verbrauch" der Wirtschaftsuebersicht steht dauerhaft auf 0: sie fuehrt nur den Armeeunterhalt, Bau- und Aushebungskosten erscheinen nirgends. Die Frage "wohin gehen meine Rohstoffe" bleibt unbeantwortet. | mittel |
| 19 | Das Vorspulen sagt nie, warum es anhaelt. R-TIME-03 verlangt es ausdruecklich; der Grund wird intern gefuehrt und nicht angezeigt. | mittel |
| 22 | Nach einem Gefecht fehlt das WARUM: keine Verluste, keine Staerken, kein Gelaende. Die Textbausteine dafuer liegen ungenutzt in der Sprachdatei. | mittel |
| 25a | Der Rueckzug ist moeglich, aber der Knopf sagt nicht, was er kostet - kein Tooltip. Dasselbe bei Marschieren, Angriff und Teilen. Die Bauknoepfe machen es vor ("333 Material, 250 Geld - 1 Tag"). | mittel |
| 26a | ZWEI Befunde an einer Stelle. (a) Der Spielstand ueberlebt korrekt (IndexedDB), ist nach einem Neustart aber NICHT ERREICHBAR: die Liste oeffnet nur Strg+S, und die Tastenkombination wirkt ohne laufende Partie nicht; kein Knopf fuehrt dorthin. (b) Wer den Startdialog mit dem Kreuz schliesst, landet auf einer leeren Flaeche mit "Die Welt wird aufgebaut ..." - kein Knopf, keine Taste fuehrt zurueck, nur Neuladen hilft. | HOCH |
| 28 | Der Knopf zum Abbrechen eines Baus traegt den ROHEN Uebersetzungsschluessel "[province.cancelBuild]". Er funktioniert, sieht aber aus wie ein Programmfehler. Einziger Fund dieser Art im sichtbaren Text. Grenzfall daneben: Armeen heissen "Armee 80", also nach ihrer Kennung. | mittel |
| 30 | Flugplatz (Gebaeude) und Jagdflugzeug (Einheit) benutzen dasselbe Symbol - beide zeigen auf den Pfad "aircraft" (icons.tsx:131 und :143). | klein |
| 45 | Kein Befund - "nein" ist hier die erwartete Antwort. Kein Element mit laufender Animation; die zwei gewollten Bewegungen (Meldung 220 ms, fertiger Bau 600 ms) schaltet prefers-reduced-motion ab. | - |
| 48 | Die "Debug-Ansicht" laesst sich einschalten und ist praktisch leer: "Tick: 8", ein LEERER Zustands-Hash und zwei Ueberschriften ("Ziel", "Kommandolog") ohne Inhalt. Frage 48 ist damit mit JA zu beantworten, erwartet war NEIN. docs/PLAYTEST.md:149 behauptet, das Debug-Panel sei geschlossen. | mittel |
| 25e | Waehrend einer laufenden Partie gibt es keinen Weg zu einer zweiten - kein Knopf, keine Taste (27 Knoepfe geprueft). Dieselbe Wurzel wie 26a: die Oberflaeche hat ausser dem Startdialog keinen Ort fuer Partieverwaltung. | mittel |
| 11 | Nebenbefund (Antwort bleibt ja): im Modus Besitz haben Nebel und herrenloses Land dieselbe Farbe (#DAD5C6), die Legende nennt beides "neutral" - unterscheidbar ist es nicht. | klein |
| 13b | Nebenbefund (Antwort bleibt ja): die FRAGE des Bogens ist falsch. Sie unterstellt, ein Bauabbruch gebe "nichts zurueck"; gemessen werden 50 % erstattet, und das Protokoll sagt es auch ("halbe Kosten erstattet"). | klein - Fehler im Bogen |
| 9 | Nicht geprueft, kein Produktbefund: das Browserfenster lag im Hintergrund, requestAnimationFrame feuerte 0-mal in 2 s, die Karte zeichnete nicht und die Spieluhr stand. Betrifft auch 12, 18, 20, 21, 38, 44 und Teile von 27. Das Vorspulen wirkt ohne rAF und hat die Sitzung getragen. An einem sichtbaren Fenster nachzuholen. | Hinweis |

## Die drei Fragen, auf die es ankommt

**A. Wollten Sie weiterspielen?** — *Kann ein Agent nicht beantworten; die Frage zielt auf ein
Gefuehl. Was messbar ist: 35 Spieltage ohne Absturz, ohne Blockade, und zu jedem Zeitpunkt gab es
etwas zu tun.*

**B. Gab es einen Moment, in dem Sie gewartet haben, ohne es abkuerzen zu koennen?** — **Nein.**
Acht Tempostufen plus Vorspulen; das Vorspulen bringt einen ganzen Spieltag je Klick und wirkt
selbst dann, wenn die Bildschirmuhr steht.

**C. Hatten Sie das Gefuehl, dass die KI schummelt?** — **Nein.** Der Startdialog sagt es zu
("ohne Bonus, sie sieht dieselbe Karte wie Sie"), und im Lauf war nichts zu sehen, was dem
widerspricht. Von der Oberflaeche aus belegen laesst es sich allerdings nicht - der einzige
Einblick waere die Debug-Ansicht, und die ist leer (Befund zu Frage 48).
