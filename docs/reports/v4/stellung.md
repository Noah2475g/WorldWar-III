# V4 Etappe 1 Stellung: Messung an S575 (T-M48-03)

Quelle: apps/desktop/src/map/stapel.slow.test.ts (Sicht der staerksten Macht, 193 eigene Armeen). Werte ohne Rundung.

Armeen mit Stellung (home): 153 (Soll A5: 161). Nach Gattung: {"infantry":107,"artillery":20,"armour":26}. Spitzenprovinz: SAU.

Abweichung 153 statt 161: 193 eigene minus 32 ohne Gattungsgebaeude = 161 (A5 stimmt). Weitere 8 haben das Gebaeude (Stufe >= 1), aber placeBuildings zeichnet es mangels Anker nicht (anchors.ts: Ueberzaehliges bleibt ungezeichnet), z.B. MYS Artillerie mit factory:1. Inferenz aus Code, nicht je Armee einzeln belegt.

## Vorher (ohne Stellung) / Nachher (mit Stellung)

ohneStellung ist bitgleich zu docs/reports/v3/treffer.json@25aafa4 (byScale, 5 Massstaebe, Skript b3-vergleich.mjs Exit 0).

| Feld | 0.5 ohne | 0.5 mit | 1 ohne | 1 mit | 2 ohne | 2 mit | 4 ohne | 4 mit | 8 ohne | 8 mit |
|---|---|---|---|---|---|---|---|---|---|---|
| markers | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 | 237 |
| fullyHidden | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| partlyCovered | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| centreCovered | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| ownTotal | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 |
| ownHit | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 | 193 |
| visiblePoints | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 |
| visiblePicked | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 | 6755 |
| farFromHome48px | 96 | 115 | 121 | 126 | 174 | 181 | 209 | 216 | 219 | 222 |
| meanMovePx | 43 | 49 | 52 | 52 | 75 | 78 | 118 | 125 | 155 | 156 |
| maxMovePx | 108 | 130 | 131 | 126 | 205 | 197 | 248 | 247 | 276 | 270 |

## Heimatgebaeude (Massstab 0,5 / 1 / 2)

| Massstab | homeBuildings | voll verdeckt mit | voll verdeckt ohne | teils mit | teils ohne |
|---|---|---|---|---|---|
| 0.5 | 29 | 0 | 4 | 11 | 14 |
| 1 | 29 | 2 | 4 | 20 | 24 |
| 2 | 29 | 4 | 3 | 24 | 26 |

## Offen fuer Noah

Plan-Soll war homeBuildingsFullyCovered = 0 je Massstab. Verfehlt. Gemessen (29 Heimatgebaeude je Massstab, ungerundet):

| Massstab | voll verdeckt mit Stellung | voll verdeckt ohne Stellung |
|---|---|---|
| 0.5 | 0 | 4 |
| 1 | 2 | 4 |
| 2 | 4 | 3 |

Ursache: Die Verdecker sind Armeekaesten aus Nachbarprovinzen (BEN -> BFA bei Massstab 1 mit a1146/a3269, BEN -> CIV bei 2, MYS -> KHM bei 2). Die Stellung-Regel betrifft nur die home-Position eigener Armeen in ihrer eigenen Provinz. Fremde Provinzen fasst sie nicht an, deshalb gab es innerhalb E5/E6 keinen Nachbesserungsversuch. declutter behandelt Gebaeudemarker nicht als Hindernis (E7 unveraendert).

Entscheidungen: Hermes entschied "je Massstab nicht schlechter als ohne Stellung". Das reisst bei Massstab 2 (4 gegen 3). Eine Summenpruefung (builder, Commit 659bccb) wurde deshalb verworfen. Der Waechter im Test ist jetzt je Massstab auf den Ist-Stand festgeschrieben (<= 0 / 2 / 4, Konstante HOME_FULLY_COVERED_MAX, Gegenprobe mit Grenze 3 bei Massstab 2 rot, Log b3-gegenprobe.log). homeBuildingsPartly wird je Massstab protokolliert (11 / 20 / 24), nicht zugesichert.

Loesungsweg B (nicht Teil von V4-B3, eigenes Feature): declutter behandelt Gebaeudemarker als Hindernis. DECLUTTER_RADIUS und FAN_PITCH bleiben unveraendert.

## armiesWithHome 153 statt 161

193 eigene Armeen, davon 32 ohne Gattungsgebaeude, ergibt 161. Weitere 8 haben das Gattungsgebaeude auf Stufe >= 1, bekommen aber kein home, weil die Provinz nur 1 Anker hat und placeBuildings nur 1 von 5 Gebaeuden zeichnet (gemessen, Log b3-anker.log, Feld ankerLuecke in stellung.json):

| Provinz | Anker (anchorsFor) | Gebaeude Stufe >= 1 | von placeBuildings gezeichnet | Armeen ohne home |
|---|---|---|---|---|
| MYS | 1 | 5 | 1 | 5 (artillery 4, tank 1; factory) |
| BGD | 1 | 5 | 1 | 3 (tank 3; factory) |
| Summe | | | | 8 |

161 - 8 = 153.

Hinweis: Mehrstufiger Marsch: Naeherung ab Etappe 2 (render.ts:178) ist bestehend und nicht Teil von VM-07.

## Abnahmebilder am laufenden Programm (T-M48-04)

Bilder: docs/ux/v4-stellung/stand-vorher.png, stand-nachher.png, marsch-vorher.png, marsch-nachher.png (Stand S575G, 1280x800, Pause; erzeugt mit scripts/v4-stellung-bild.mjs). Vorher = Worktree .claude/worktrees/vm07-vorher (detached b23aa04 = origin/main, Port 5342, stellung.ts dort nicht ausgeliefert), nachher = Worktree vm07 (Port 5341, stellung.ts ausgeliefert). Beide Bilder selbst angesehen.

Befund: Der Klick auf die Uebersichtskarte (2479/4000, 1250/2400) zeigt Nahost und Suedasien mit SAU am linken Bildrand-Mitte, nicht stark herangezoomt; der Klickpunkt blieb unveraendert. Nachher stehen die eigenen Armeekaesten sichtbar ueber den Gebaeudezeichen (Kaserne/Fabrik) statt wie vorher mitten in der Provinz auf ihnen; die Gebaeudezeichen sind in beiden Bildern zu erkennen. Fremde Armeen (rote Kaesten, Sued des Bildes) stehen unveraendert in der Provinzmitte. Im Marschbild (eine Spielstunde Tempo 1, dann Pause) laufen Marker und Marschpfeil gemeinsam, kein Sprung erkennbar. In SAU sind es viele Armeen an wenigen Ankern: das Raster waechst nach oben und ragt dicht gedraengt in Nachbarprovinzen; Geschmacksfrage an Noah, nicht umgebaut.
