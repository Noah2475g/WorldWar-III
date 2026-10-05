# Vormerkungen — Befunde mit Zielversion (Stand 2026-10-04)

> Sammelstelle für Befunde, die **nicht sofort** gebaut werden, damit sie später ohne Suche zu
> einem Plan werden. Je Eintrag: Herkunft, Befund in Noahs Worten, Zielversion, was ein Plan
> klären muss. Wer einen Eintrag einplant, verweist hier auf die Aufgaben-ID; gestrichen wird
> nichts (LOESCHVERMERK-Regel).

## Zielversionen

| Version | Inhalt | Status |
|---|---|---|
| **V3** | Leistung im Spätspiel (M45), UX V3 (M46) | läuft (`PLAN-V3.md`) |
| **V3-Bugfix** | Fehler, die das Spiel heute falsch machen, aber eine Kernänderung brauchen | an Noahs Wort, Messkette Regel 3 „verhaltensändernd“ |
| **V4 „Gefecht“** | neues Kampf- und Bewegungsmodell innerhalb der Provinz | vorgemerkt, nicht geplant |
| **V4/V5 „Bild statt Text“** | durchgehender grafischer Umbau aller Ansichten, falls er über M46 hinausgeht | vorgemerkt, Umfang an Gate |

---

## V3-Bugfix

### VM-01 · Ausheben in eroberten Provinzen gesperrt
- **Herkunft:** Playtest V3, 2026-10-04.
- **Noah:** „In der eroberten Provinz konnte ich keine Einheiten bauen, bis ich selber das Gebäude
  gebaut habe … wenn ich der Besitzer bin, muss ich da ja auch Einheiten ausheben können.“
- **Stand:** Gebäude bleiben im Kern bei der Eroberung an der Provinz (`occupation.ts`), nur der
  Besitzer wechselt — die Sperre kommt von woanders. Ursache belegt: Moralsperre (`commands/recruit.ts:46`, Eroberung setzt 25 000 = Grenze, erste Tagesabrechnung drückt darunter); Test `recruitConquered.test.ts` (Zweig `claude/v3-bug-ausheben`). Entscheid G1-10: Anzeige T-M46-15 in V3, Schonfrist als eigener PR nach V3.
- **Plan muss klären:** Ursache (Datei:Zeile), Reparatur, Folgen für KI und Balance; als Kernänderung
  verhaltensändernd → volle Messkette (Turnier, `progress.slow`, 9 Vollpartien, Haltung) und Noahs Wort.
- **Eingeplant:** M47, T-M47-01 bis T-M47-03 (2026-10-04, Zweig `claude/vm01-schonfrist`).

## V3 · Welle 2 (UX, nur Hülle) — Kandidaten aus dem Playtest

### VM-02 · Einheiten liegen übereinander
- **Noah:** „Die Einheiten sind manchmal übereinander … man hat Einheiten nicht gesehen.“
- **Ziel:** Stapel auffächern oder als ein Zeichen mit Zahl und Typ-Symbolen; jede Armee anklickbar.
  Belebt T-M46-03 (vorher ohne Messbefund zurückgestellt).

### VM-03 · Überblick: Töne ohne Ort, überfülltes Protokoll
- **Noah:** „Es passieren einfach Sounds und man weiß nicht, wo etwas passiert, und die Konsole unten
  ist viel zu überfüllt.“
- **Ziel:** jedes hörbare Ereignis zeigt seinen Ort (Puls auf der Karte, Sprung per Klick);
  Protokoll mit Wichtigkeit, Filtern, Sammelzeilen, Sprung zum Ort. Belebt T-M46-02.

### VM-04 · Soundeffekte statt „Ploppen“
- **Noah:** „Wir müssen noch ein paar Soundeffekte hinzufügen. Statt einfach diesen Ploppen, das nervt sehr.“
- **Ziel:** eigener Klang je Ereignisart (Befehl, Angriff, Eroberung, Alarm, Bau fertig, Diplomatie),
  Open Source mit Lizenz in `docs/ASSETS.md`. Quellen: Recherche `bericht-assets` (läuft).

### VM-05 · Grafiken und Symbole statt Text als Hauptträger
- **Noah:** „Das UI ist nicht gut genug und zu unübersichtlich. Wir wollen keinen Text als
  Hauptvordergrund, sondern Grafiken und Symbole.“
- **V3-Teil (Vorschlag):** Symbole für Einheiten, Gebäude, Rohstoffe und Diplomatie in Kopfleiste,
  Provinz-/Armeepanel und Karte; Text nur noch als Beschriftung/Tooltip.
- **Darüber hinaus (V4/V5):** durchgehender visueller Umbau aller Dialoge und Panels mit eigenem
  Design-Gate — falls der V3-Teil nicht reicht.

### VM-06 · Mid-Game „sehr, sehr stressig“
- **Noah:** „Das Late Game ist doch ganz okay gewesen. Das Mid-Game ist nur sehr, sehr stressig.“
- **Einordnung:** zwei mögliche Ursachen, beide offen: (a) Bedienung — zu viele gleichzeitige
  Meldungen ohne Ort/Priorität (dann helfen VM-03/VM-05, V3); (b) Spieltempo/KI-Druck — Kriege,
  Angriffe pro Tag in der Mitte der Partie (dann Balance, eigener Plan mit Messung der Ereignisdichte
  je Spielabschnitt). Erst messen: Ereignisse je Spieltag nach Spielabschnitt aus einer Vollpartie.
- **Umsetzung 2026-10-05:** Auto-Pause bei eigenen Alarmen (enge Fassung, WAR_DECLARED an mich + CAPITAL_LOST; ARMY_INTRUDED gestrichen), Zaehlung docs/reports/v3/autopause-zaehlung.md (max. 7/Partie).

## V4 „Gefecht“ (vorgemerkt, nicht geplant)

### VM-07 · Einheiten innerhalb der Provinz nach Gebäuden verteilen
- **Noah:** „Wir sollten die Einheiten in den Ländern noch verteilen, passend zu den Gebäuden.“
- **Plan muss klären:** Positionen innerhalb einer Provinz im Kernzustand (heute: Armee steht „in“
  einer Provinz), Darstellung, Speichern/Laden, Mehrspieler-Gleichstand.
- **Eingeplant:** Etappe 1 (Variante A, nur Hülle) → M48; Variante B (Position im Kern) → VM-08-Plan.

### VM-08 · Bewegungslogik und Kampf mit Waffenradius
- **Noah:** „Sobald Einheiten losmarschieren und auf Angriff gestellt sind, den Waffenradius
  einstellen … die Position in den Provinzen relativ zu den Positionen der Gegner beachten …
  Armeen sollen sich mit einer Logik bewegen und mit einem Waffenradius aufeinander schießen,
  sobald ein Gegner im Radius ist.“
- **Plan muss klären:** Reichweite je Einheitentyp (Regeldaten), Kampfauslösung über Entfernung
  statt „gleiche Provinz“, Verhältnis zu Fernwirkung/Artillerie (R-UNIT-08), KI-Taktik, Leistung
  (Entfernungsprüfungen je Tick), völlig neue Golden Master und Balance-Messung. Setzt VM-07 voraus.
