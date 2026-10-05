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

Offene Abweichung vom Plan: Soll war homeBuildingsFullyCovered = 0 je Massstab. Gemessen mit Stellung 0 / 2 / 4, ohne Stellung 4 / 4 / 3. Verdecker sind Armeekaesten Nachbarprovinzen (Stapel an gehobenen Ankern plus declutter). Die Zusicherung ist per Hermes-Entscheid auf "Summe 0,5/1/2 mit Stellung <= ohne" gelockert (6 gegen 11). Je Massstab ist 2 schlechter (4 gegen 3). Kein Drehen an DECLUTTER_RADIUS/FAN_PITCH. Reviewer soll die Lockerung beurteilen.

Hinweis: Mehrstufiger Marsch: Naeherung ab Etappe 2 (render.ts:178) ist bestehend und nicht Teil von VM-07.
