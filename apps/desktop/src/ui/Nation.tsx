/**
 * Eine Macht mit ihrer Farbe (T-M20-02, R-UI-16).
 *
 * Die Farbe steht seit M6 in der Sicht und wurde ausserhalb der Karte nirgends benutzt:
 * die Lage, die Diplomatie, das Protokoll und die Provinzansicht nannten nur den Namen.
 * Wer auf der Karte eine rote Front sah, musste raten, welche der acht Zeilen der
 * Tabelle dazu gehoert.
 *
 * **Die Farbe kommt aus den Daten, nicht aus dem Quelltext.** `style={{ background }}`
 * mit einem Wert aus der Sicht ist kein Farbliteral und verletzt die Lint-Regel zu
 * R-UI-02 nicht; die Form — Groesse, Rundung, Rahmen — steht in `app.css` und benutzt
 * dort nur `var(--*)`.
 *
 * **Der Name bleibt daneben stehen, und das ist keine Nettigkeit.** Rund acht Prozent
 * der Maenner unterscheiden Rot und Gruen nicht, und die Spielerfarben enthalten beides.
 * Eine Farbe, die das einzige Unterscheidungsmerkmal ist, ist fuer diese Leser gar
 * keines — deshalb traegt das Feld selbst auch keinen Text und ist fuer Vorleseprogramme
 * unsichtbar: es wiederholt den Namen, der ohnehin danebensteht.
 */
export function NationName({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="nation">
      <span className="nation__swatch" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  )
}
