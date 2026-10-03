/**
 * Die Schwellen aus R-UX-01…06 als reine Funktion über ein `messwerte.json` (T-M44-02).
 *
 * Wozu: jede Aufgabe von M44 wird an einer Zahl abgenommen, nicht an einem Eindruck, und diese
 * Zahlen stehen **hier** — an einer Stelle, mit der Kennung der Anforderung davor. Das Werkzeug
 * `scripts/ux-capture.mjs --check` fährt die Aufnahme und ruft `evaluate`; der Komponententest
 * `test/ux-thresholds.test.ts` ruft dieselbe Funktion mit dem eingecheckten Vorher-Stand und mit
 * einem erfundenen Sollstand. Beides ohne Browser.
 *
 * Drei Zustände je Kriterium, und der dritte ist Absicht:
 *   - `green`  alles Gemessene hält,
 *   - `red`    mindestens ein Messwert hält nicht,
 *   - `open`   es gibt noch keinen Messwert (ältere `messwerte.json`, Größe nicht gefahren,
 *              Sonde kommt erst mit der Aufgabe, die sie braucht). `open` ist **nicht grün**:
 *              `--strict` macht daraus einen Fehler, und der Bericht nennt, was fehlt.
 *
 * Kein Teil von `pnpm verify` (braucht Server und Browser, D14); die Funktion selbst läuft im Test.
 *
 * Regel für jede Änderung an den Zahlen: eine Schwelle wird **nicht angehoben, damit ein Messwert
 * passt** (CLAUDE.md). Sie ändert sich nur, wenn die Anforderung sich ändert — und dann steht die
 * Kennung der Anforderung im selben Commit.
 */

/** Die Zahlen der Anforderungen, benannt. */
export const LIMITS = {
  /** R-UX-01/AK1: sichtbare Kartenfläche bei 375×667 ohne offenes Panel. */
  mapShareNoPanel: 0.45,
  /** R-UX-01/AK1: … mit offenem Provinz- oder Armeepanel. */
  mapShareWithPanel: 0.3,
  /** R-UX-02/AK1: Kopfleiste samt Rohstoffleiste, ab dieser Fensterbreite. */
  headerMaxPx: 70,
  headerMinWidth: 1280,
  /** R-UX-02/AK5: drei Sekunden Tempo 100 bei 1920×1080, am gebauten Bündel. */
  framesOver50MsMax: 3,
  longTaskMaxMs: 60,
  /** R-UX-04/AK2: das Öffnen der Zielwahl erzeugt keine lange Aufgabe über 50 ms. */
  openLongTaskMaxMs: 50,
  /** R-UX-06/AK3: Mindestgröße (WCAG 2.5.5) per Finger oder unter 600 px, sonst WCAG 2.5.8. */
  touchFingerPx: 44,
  touchDeskPx: 24,
  narrowBelowPx: 600,
  /** Rückfallprüfung R-UX-01/AK3: so viel Streuung wird nicht als Verschlechterung gezählt. */
  baselineMapShareSlack: 0.01,
  baselineHeaderSlackPx: 2,
  /** Über diesem Anteil (Last je Kern) gilt die Maschine für Zeitmessungen als nicht ruhig. */
  busyMachineShare: 0.25,
}

/** Die Größen, für die R-UX-01/AK3 „nicht schlechter als vorher“ verlangt. */
export const FALLBACK_SIZES = ['667x375', '1366x768']

/**
 * Bereiche, die absichtlich waagerecht wischbar sind (R-UX-01/AK2). Ein Eintrag gilt nur, wenn der
 * Bereich per Tastatur erreichbar ist (R-UX-06/AK1) — wer hier etwas einträgt, nennt die Aufgabe,
 * die das belegt. Vorgabe: nichts ist ausgenommen.
 */
export const SWIPEABLE_REGIONS = []

const ok = (value, lines = []) => ({ status: 'green', value, lines })
const bad = (value, lines = []) => ({ status: 'red', value, lines })
const open = (value, lines = []) => ({ status: 'open', value, lines })

/** Sammelt Teilergebnisse: rot gewinnt vor offen, offen vor grün. */
function combine(parts, greenValue) {
  const reds = parts.filter((p) => p.status === 'red')
  const opens = parts.filter((p) => p.status === 'open')
  const lines = parts.flatMap((p) => p.lines)
  if (reds.length > 0) return bad(reds.map((p) => p.value).join('; '), lines)
  if (opens.length > 0 && opens.length === parts.length) return open(opens.map((p) => p.value).join('; '), lines)
  if (opens.length > 0) return open(`${greenValue}; offen: ${opens.map((p) => p.value).join('; ')}`, lines)
  return ok(greenValue, lines)
}

const vpSize = (tag) => {
  const [w, h] = tag.split('x').map(Number)
  return { w, h }
}
const viewportsOf = (m) => m?.viewports ?? {}
const pct = (x) => `${Math.round(x * 100)} %`

/** Der Bestand an Aufnahmen aus dem Mehrspielerlauf — als Fenster wie die übrigen. */
function allRuns(m) {
  const out = []
  for (const [tag, data] of Object.entries(viewportsOf(m))) out.push({ tag, data, section: 'viewports' })
  for (const [tag, data] of Object.entries(m?.mp ?? {})) out.push({ tag, data, section: 'mp' })
  return out
}

const layoutsOf = (data) => Object.entries(data?.layout ?? {}).filter(([, l]) => l && typeof l === 'object')

/** Welche Messzustände tragen den Alarmchip? Neue Daten sagen es selbst, alte nennen `battle`. */
function alarmLayouts(data) {
  const all = layoutsOf(data)
  const flagged = all.filter(([, l]) => l.alarmChipVisible === true)
  if (flagged.length > 0) return flagged
  return all.filter(([name]) => name === 'battle')
}

function mapShare(l) {
  return typeof l?.mapShareOfViewport === 'number' ? l.mapShareOfViewport : null
}

export const CRITERIA = [
  {
    id: 'R-UX-01/AK1',
    title: 'Telefon hochkant: Karte ohne Panel >= 45 %, mit Panel >= 30 %',
    needs: ['viewports'],
    check(m) {
      const data = viewportsOf(m)['375x667']
      if (!data) return open('375x667 nicht gefahren')
      const layout = data.layout ?? {}
      const parts = []
      const noPanel = mapShare(layout.mapStart)
      parts.push(
        noPanel === null
          ? open('ohne Panel nicht gemessen')
          : noPanel >= LIMITS.mapShareNoPanel
            ? ok(`ohne Panel ${pct(noPanel)}`)
            : bad(`ohne Panel ${pct(noPanel)} < ${pct(LIMITS.mapShareNoPanel)}`),
      )
      // Mit offenem Panel: die neuen Zustände, sonst der Lauf mit gewählter Provinz (Altdaten).
      const panelStates = [
        ['Provinzpanel', layout.provincePanel ?? layout.running],
        ['Armeepanel', layout.armyPanel],
      ]
      for (const [name, l] of panelStates) {
        const share = mapShare(l)
        if (share === null) parts.push(open(`${name} nicht gemessen`))
        else if (share >= LIMITS.mapShareWithPanel) parts.push(ok(`${name} ${pct(share)}`))
        else parts.push(bad(`${name} ${pct(share)} < ${pct(LIMITS.mapShareWithPanel)}`))
      }
      return combine(parts, parts.map((p) => p.value).join(', '))
    },
  },
  {
    id: 'R-UX-01/AK2',
    title: 'kein waagerechter Überlauf in keiner Mess-Fenstergröße',
    needs: ['viewports', 'mp'],
    check(m) {
      const runs = allRuns(m)
      if (runs.length === 0) return open('nichts gefahren')
      const lines = []
      let broken = 0
      for (const { tag, data, section } of runs) {
        const found = new Set()
        for (const [scene, l] of layoutsOf(data)) {
          if (l.pageOverflowX) found.add(`${scene}: Seite läuft über`)
          for (const region of l.overflowingRegions ?? []) {
            const name = String(region).split(' ')[0]
            if (SWIPEABLE_REGIONS.includes(name)) continue
            found.add(`${scene}: ${region}`)
          }
        }
        if (found.size > 0) {
          broken += 1
          lines.push(`${section === 'mp' ? 'mp ' : ''}${tag}: ${[...found].join(', ')}`)
        }
      }
      return broken === 0
        ? ok(`${runs.length} Läufe ohne Überlauf`)
        : bad(`${broken} von ${runs.length} Läufen mit Überlauf`, lines)
    },
  },
  {
    id: 'R-UX-01/AK3',
    title: 'Durchlauf ohne Fehlschritt; 667x375 und 1366x768 nicht schlechter als vorher',
    needs: ['viewports', 'mp'],
    check(m, ctx) {
      const runs = allRuns(m)
      if (runs.length === 0) return open('nichts gefahren')
      const lines = []
      const failing = runs.filter((r) => (r.data.failures ?? []).length > 0)
      for (const r of failing) {
        lines.push(`${r.section === 'mp' ? 'mp ' : ''}${r.tag}: ${r.data.failures.length} Fehlschritte (${r.data.failures.map((f) => f.step).join(', ')})`)
      }
      const parts = [
        failing.length === 0 ? ok(`${runs.length} Läufe ohne Fehlschritt`) : bad(`${failing.length} von ${runs.length} Läufen mit Fehlschritt`),
      ]
      const baseline = ctx.baseline
      if (!baseline) {
        parts.push(open('Rückfallprüfung ohne --baseline nicht gefahren'))
      } else {
        for (const tag of FALLBACK_SIZES) {
          const now = viewportsOf(m)[tag]
          const before = viewportsOf(baseline)[tag]
          if (!now || !before) {
            parts.push(open(`${tag} fehlt (Rückfallprüfung)`))
            continue
          }
          const worse = regressions(now, before)
          if (worse.length === 0) parts.push(ok(`${tag} nicht schlechter`))
          else {
            parts.push(bad(`${tag} schlechter als vorher`))
            for (const w of worse) lines.push(`${tag}: ${w}`)
          }
        }
      }
      const r = combine(parts, parts.map((p) => p.value).join(', '))
      return { ...r, lines }
    },
  },
  {
    id: 'R-UX-02/AK1',
    title: 'Kopf- und Rohstoffleiste <= 70 px ab 1280 px, im Zustand mit Alarmchip und Siegziel',
    needs: ['viewports', 'mp'],
    check(m) {
      const wide = allRuns(m).filter((r) => vpSize(r.tag).w >= LIMITS.headerMinWidth)
      if (wide.length === 0) return open('keine Größe ab 1280 px gefahren')
      const lines = []
      const parts = []
      for (const { tag, data, section } of wide) {
        const states = [...layoutsOf(data).filter(([name]) => name === 'running' || name === 'mpRunning'), ...alarmLayouts(data)]
        const heights = states.map(([name, l]) => [name, l.header?.h]).filter(([, h]) => typeof h === 'number')
        if (heights.length === 0) {
          parts.push(open(`${tag} ohne Kopfmessung`))
          continue
        }
        const worst = Math.max(...heights.map(([, h]) => h))
        const label = `${section === 'mp' ? 'mp ' : ''}${tag}`
        lines.push(`${label}: ${heights.map(([n, h]) => `${n} ${h} px`).join(', ')}`)
        parts.push(worst <= LIMITS.headerMaxPx ? ok(`${label} ${worst} px`) : bad(`${label} ${worst} px > ${LIMITS.headerMaxPx}`))
      }
      const mp = allRuns(m).filter((r) => r.section === 'mp' && vpSize(r.tag).w >= LIMITS.headerMinWidth)
      if (mp.length === 0) parts.push(open('Mehrspieler (header.fixedSpeed) nicht gefahren'))
      const noChip = wide.filter((r) => alarmLayouts(r.data).every(([, l]) => l.alarmChipVisible === false))
      for (const r of noChip) lines.push(`${r.section === 'mp' ? 'mp ' : ''}${r.tag}: Alarmchip im Lauf nie sichtbar — der Zustand mit Alarmchip ist hier nicht belegt`)
      const r = combine(parts, parts.map((p) => p.value).join(', '))
      return { ...r, lines }
    },
  },
  {
    id: 'R-UX-02/AK2',
    title: 'ein Element mit hidden wird nicht gezeichnet',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m)
      const lines = []
      let measured = 0
      for (const { tag, data } of runs) {
        for (const [scene, l] of layoutsOf(data)) {
          if (!Array.isArray(l.hiddenDrawn)) continue
          measured += 1
          if (l.hiddenDrawn.length > 0) lines.push(`${tag} ${scene}: ${l.hiddenDrawn.join(', ')}`)
        }
      }
      if (measured === 0) return open('Sonde hiddenDrawn fehlt in den Daten')
      return lines.length === 0 ? ok(`${measured} Zustände ohne gezeichnetes hidden`) : bad(`${lines.length} Zustände mit gezeichnetem hidden`, lines)
    },
  },
  {
    id: 'R-UX-02/AK3',
    title: 'kein Kartentooltip bei offenem Dialog; Auswahl-Tooltip ohne Mausbedienung',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports' && r.data.probes?.tooltip)
      if (runs.length === 0) return open('Sonde probes.tooltip fehlt in den Daten')
      const lines = []
      let broken = 0
      for (const { tag, data } of runs) {
        const p = data.probes.tooltip
        const problems = []
        if (p.visibleWithDialog) problems.push('Tooltip bei offenem Dialog sichtbar')
        if (p.mentionsMouse) problems.push(`Auswahl-Tooltip nennt Mausbedienung („${String(p.text).slice(0, 50)}“)`)
        if (problems.length > 0) {
          broken += 1
          lines.push(`${tag}: ${problems.join(', ')}`)
        }
      }
      return broken === 0 ? ok(`${runs.length} Größen ohne Befund`) : bad(`${broken} von ${runs.length} Größen mit Befund`, lines)
    },
  },
  {
    id: 'R-UX-02/AK4',
    title: 'Protokollzeit einzeilig, Gefechtszeilen zusammengefasst, Platz 1 zuerst',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports' && r.data.probes?.log)
      if (runs.length === 0) return open('Sonde probes.log fehlt in den Daten')
      const lines = []
      let broken = 0
      for (const { tag, data } of runs) {
        const p = data.probes.log
        const problems = []
        if (p.timeWrapped > 0) problems.push(`${p.timeWrapped} Zeitangaben umgebrochen`)
        if (p.duplicateBattleRuns > 0) problems.push(`${p.duplicateBattleRuns} gleichlautende Gefechtszeilen`)
        if (p.standingsFirstIsRankOne === false) problems.push('Platz 1 steht nicht zuerst')
        if (problems.length > 0) {
          broken += 1
          lines.push(`${tag}: ${problems.join(', ')}`)
        }
      }
      return broken === 0 ? ok(`${runs.length} Größen ohne Befund`) : bad(`${broken} von ${runs.length} Größen mit Befund`, lines)
    },
  },
  {
    id: 'R-UX-02/AK5',
    title: 'Tempo 100 am Bündel: <= 3 Bilder > 50 ms, keine lange Aufgabe > 60 ms (1920x1080)',
    needs: ['bundle'],
    check(m, ctx) {
      const data = m?.bundle?.['1920x1080']
      const run = data?.perf?.running100
      if (!run) return open('Bündel 1920x1080 nicht gefahren (--bundle)')
      const lines = [`Bündel 1920x1080: ${run.longTasks} lange Aufgaben, längste ${run.longTaskMaxMs} ms, ${run.framesOver50Ms} Bilder > 50 ms`]
      // Die Anforderung verlangt eine ruhige Maschine (R-UX-02/AK5). Eine Last über der Hälfte der Kerne
      // verfälscht die Bilderzahl; der Wert bleibt, was er ist, aber der Bericht sagt, worauf er gilt.
      const machine = data.perf?.machine
      if (machine && machine.cores > 0 && machine.loadAvg1 / machine.cores > LIMITS.busyMachineShare) {
        lines.push(`Maschine nicht ruhig (Last ${machine.loadAvg1} bei ${machine.cores} Kernen): ein roter Wert zählt erst, wenn er auf ruhiger Maschine wiederkehrt (Falle 18)`)
      }
      const problems = []
      if (run.framesOver50Ms > LIMITS.framesOver50MsMax) problems.push(`${run.framesOver50Ms} Bilder > 50 ms`)
      if (run.longTaskMaxMs > LIMITS.longTaskMaxMs) problems.push(`lange Aufgabe ${run.longTaskMaxMs} ms`)
      // Falle 18: eine absolute Schwelle unter der eigenen Streuung ist keine — der Vergleich
      // gegen den am selben Tag gemessenen Ausgangswert ist die eigentliche Probe.
      const base = ctx.sameDayBundle?.bundle?.['1920x1080']?.perf?.running100
      if (base) {
        lines.push(`Ausgangswert desselben Tages: ${base.longTasks} / ${base.longTaskMaxMs} ms / ${base.framesOver50Ms} Bilder`)
        if (run.framesOver50Ms > base.framesOver50Ms) problems.push(`mehr Bilder > 50 ms als der Ausgangswert (${base.framesOver50Ms})`)
        if (run.longTaskMaxMs > base.longTaskMaxMs) problems.push(`längere Aufgabe als der Ausgangswert (${base.longTaskMaxMs} ms)`)
      } else {
        lines.push('kein Ausgangswert desselben Tages (--baseline-bundle): nur die absolute Schwelle geprüft')
      }
      return problems.length === 0 ? ok(`${run.longTasks} / ${run.longTaskMaxMs} ms / ${run.framesOver50Ms}`, lines) : bad(problems.join('; '), lines)
    },
  },
  {
    id: 'R-UX-03/AK1-4',
    title: 'Spielersprache der Ablehnungen und Meldungen (Wächter und Komponententest)',
    needs: [],
    check() {
      return open('kein Browser-Messwert: Wächter text-keys und Komponententests der Aufgaben T-M44-06 und T-M44-18')
    },
  },
  {
    id: 'R-UX-04/AK1',
    title: 'folgenschwere Befehle brauchen einen zweiten Klick (Browserprobe)',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports' && r.data.probes?.confirm)
      if (runs.length === 0) return open('Sonde probes.confirm fehlt in den Daten (T-M44-09a)')
      const bad1 = runs.filter((r) => r.data.probes.confirm.warOnFirstClick === true || r.data.probes.confirm.asksOnFirstClick === false)
      return bad1.length === 0 ? ok(`${runs.length} Größen: Krieg erst nach dem zweiten Klick`) : bad(`${bad1.length} Größen: Krieg schon beim ersten Klick oder keine Rückfrage`, bad1.map((r) => r.tag))
    },
  },
  {
    id: 'R-UX-04/AK2',
    title: 'Zielwahl: erreichbare zuerst und getrennt, unerreichbare nicht wählbar, Öffnen ohne lange Aufgabe > 50 ms',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports' && r.data.probes?.march)
      if (runs.length === 0) return open('Sonde probes.march fehlt in den Daten')
      const lines = []
      let broken = 0
      for (const { tag, data } of runs) {
        const p = data.probes.march
        const problems = []
        const groups = p.groups ?? []
        if (groups.length < 2) problems.push('keine Trennung in erreichbar/unerreichbar')
        else {
          if (groups[0].disabled > 0) problems.push('erreichbare Gruppe enthält gesperrte Ziele')
          const last = groups[groups.length - 1]
          if (last.options > 0 && last.disabled < last.options) problems.push('unerreichbare Ziele sind wählbar')
        }
        if (typeof p.openLongTaskMaxMs === 'number' && p.openLongTaskMaxMs > LIMITS.openLongTaskMaxMs) {
          problems.push(`Öffnen erzeugt lange Aufgabe ${p.openLongTaskMaxMs} ms`)
        }
        if (problems.length > 0) {
          broken += 1
          lines.push(`${tag}: ${problems.join(', ')}`)
        }
      }
      return broken === 0 ? ok(`${runs.length} Größen ohne Befund`) : bad(`${broken} von ${runs.length} Größen mit Befund`, lines)
    },
  },
  {
    id: 'R-UX-05/AK1',
    title: 'Hauptaktion des Startdialogs ohne Rollen sichtbar',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports')
      const lines = []
      let measured = 0
      let broken = 0
      for (const { tag, data } of runs) {
        const note = (data.notes ?? []).find((n) => 'startButtonInFirstView' in n)
        if (!note) continue
        measured += 1
        if (note.startButtonInFirstView !== true) {
          broken += 1
          lines.push(`${tag}: „Partie beginnen“ unter dem Dialogrand`)
        }
      }
      if (measured === 0) return open('nichts gemessen')
      return broken === 0 ? ok(`${measured} Größen: Knopf sichtbar`) : bad(`${broken} von ${measured} Größen ohne sichtbare Hauptaktion`, lines)
    },
  },
  {
    id: 'R-UX-05/AK2',
    title: 'Einführung nennt stimmige Orte; im Hochformat Hinweis „quer halten empfohlen“',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports')
      const portrait = runs.filter((r) => {
        const { w, h } = vpSize(r.tag)
        return h > w && w < LIMITS.narrowBelowPx
      })
      const probed = portrait.filter((r) => r.data.probes && 'orientationHint' in r.data.probes)
      if (probed.length === 0) return open('Sonde probes.orientationHint fehlt in den Daten (T-M44-03a)')
      const missing = probed.filter((r) => r.data.probes.orientationHint !== true)
      return missing.length === 0
        ? ok(`${probed.length} Hochformat-Größen mit Hinweis`)
        : bad(`${missing.length} Hochformat-Größen ohne Hinweis`, missing.map((r) => r.tag))
    },
  },
  {
    id: 'R-UX-05/AK3',
    title: 'Escape schließt die Erklärung („?“), das Raster daneben bleibt',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports' && r.data.probes?.explain)
      if (runs.length === 0) return open('Sonde probes.explain fehlt in den Daten')
      const broken = runs.filter((r) => r.data.probes.explain.closedByEscape !== true || r.data.probes.explain.gridUnchanged === false)
      return broken.length === 0 ? ok(`${runs.length} Größen ohne Befund`) : bad(`${broken.length} von ${runs.length} Größen mit Befund`, broken.map((r) => r.tag))
    },
  },
  {
    id: 'R-UX-05/AK4',
    title: 'Endedialog an einem Stand, der die Siegbedingung wirklich erfüllt, und nennt sie',
    needs: ['viewports'],
    check(m) {
      const runs = allRuns(m).filter((r) => r.section === 'viewports')
      const lines = []
      let measured = 0
      let broken = 0
      for (const { tag, data } of runs) {
        const win = (data.notes ?? []).find((n) => n.victoryState)?.victoryState
        const lose = (data.notes ?? []).find((n) => n.defeatState)?.defeatState
        if (!win && !lose) continue
        measured += 1
        const problems = []
        if (!win?.real) problems.push('Siegstand erfüllt die Bedingung nicht wirklich')
        if (!lose?.real) problems.push('Niederlagenstand erfüllt die Bedingung nicht wirklich')
        const end = data.probes?.endDialog
        if (!end) problems.push('Endedialog nicht gemessen')
        else if (end.namesCondition !== true) problems.push('Endedialog nennt die Siegbedingung nicht')
        if (problems.length > 0) {
          broken += 1
          lines.push(`${tag}: ${problems.join(', ')}`)
        }
      }
      if (measured === 0) return open('kein Siegstand gemessen (Altdaten)')
      return broken === 0 ? ok(`${measured} Größen: echter Stand, Bedingung genannt`) : bad(`${broken} von ${measured} Größen mit Befund`, lines)
    },
  },
  {
    id: 'R-UX-06/AK1',
    title: 'axe-core (WCAG 2.1 AA) meldet keinen Verstoß in den Messzuständen',
    needs: ['viewports', 'mp'],
    check(m) {
      const runs = allRuns(m)
      if (runs.length === 0) return open('nichts gefahren')
      const lines = []
      let states = 0
      let broken = 0
      for (const { tag, data, section } of runs) {
        for (const [state, a] of Object.entries(data.axe ?? {})) {
          if (a.error) continue
          states += 1
          if (a.violations > 0) {
            broken += 1
            lines.push(`${section === 'mp' ? 'mp ' : ''}${tag} ${state}: ${(a.byRule ?? []).map((r) => `${r.id} (${r.nodes})`).join(', ')}`)
          }
        }
      }
      if (states === 0) return open('keine axe-Messung')
      return broken === 0 ? ok(`${states} Zustände ohne Verstoß`) : bad(`${broken} von ${states} Zuständen mit Verstoß`, lines)
    },
  },
  {
    id: 'R-UX-06/AK2',
    title: 'modale Dialoge: Tab verlässt sie nicht (Endedialog, gesperrter Vorhang, Lobby)',
    needs: ['viewports', 'mp'],
    check(m) {
      const runs = allRuns(m)
      const lines = []
      let measured = 0
      let broken = 0
      for (const { tag, data, section } of runs) {
        const label = `${section === 'mp' ? 'mp ' : ''}${tag}`
        const note = (data.notes ?? []).find((n) => 'victoryFocusLeavesDialog' in n)
        if (note) {
          measured += 1
          if (note.victoryFocusLeavesDialog) {
            broken += 1
            lines.push(`${label}: Endedialog — Tab verlässt den Dialog`)
          }
        }
        for (const [name, c] of Object.entries(data.dialogs ?? {})) {
          measured += 1
          if (c.focusLeaves) {
            broken += 1
            lines.push(`${label}: ${name} — Tab verlässt den Dialog`)
          }
          if (c.closable && c.closedByEscape === false) {
            broken += 1
            lines.push(`${label}: ${name} — Escape schließt nicht`)
          }
        }
      }
      if (measured === 0) return open('nichts gemessen')
      return broken === 0 ? ok(`${measured} Dialoge ohne Befund`) : bad(`${broken} Befunde in ${measured} Dialogen`, lines)
    },
  },
  {
    id: 'R-UX-06/AK3',
    title: 'Ziele in Kopf, Seitenleiste und Dialogen >= 44 px (Finger oder < 600 px), sonst >= 24 px',
    needs: ['viewports', 'mp'],
    check(m) {
      const runs = allRuns(m)
      if (runs.length === 0) return open('nichts gefahren')
      const lines = []
      let measured = 0
      let broken = 0
      for (const { tag, data, section } of runs) {
        const { w, h } = vpSize(tag)
        const finger = Math.min(w, h) < LIMITS.narrowBelowPx || w < LIMITS.narrowBelowPx
        const key = finger ? 'under44' : 'under24'
        const limit = finger ? LIMITS.touchFingerPx : LIMITS.touchDeskPx
        const states = Object.entries(data.touch ?? {}).filter(([, t]) => t && typeof t === 'object')
        for (const [state, t] of states) {
          // Neue Daten trennen nach Bereich; Altdaten kennen nur die Summe über das ganze Bild.
          const regions = t.regions
          const count = regions ? Object.values(regions).reduce((s, r) => s + (r[key] ?? 0), 0) : t[key]
          if (typeof count !== 'number') continue
          measured += 1
          if (count > 0) {
            broken += 1
            const where = regions
              ? Object.entries(regions).filter(([, r]) => r[key] > 0).map(([n, r]) => `${n} ${r[key]}`).join(', ')
              : 'ganzes Bild (Altdaten)'
            lines.push(`${section === 'mp' ? 'mp ' : ''}${tag} ${state}: ${count} Ziele < ${limit} px (${where})`)
          }
        }
      }
      if (measured === 0) return open('keine Zielmessung')
      return broken === 0 ? ok(`${measured} Zustände ohne zu kleine Ziele`) : bad(`${broken} von ${measured} Zuständen mit zu kleinen Zielen`, lines)
    },
  },
  {
    id: 'R-UX-06/AK4',
    title: 'Fokusrahmen mit eigenem Token und 3:1 (Komponententest tokens.contrast)',
    needs: [],
    check() {
      return open('kein Browser-Messwert: apps/desktop/src/ui/tokens.contrast.test.ts (T-M44-08, T-M44-17)')
    },
  },
]

/**
 * Wo ist `now` schlechter als `before`? Die Rückfallprüfung von R-UX-01/AK3 — nur Größen, die
 * schon etwas Bedienbares hatten, dürfen nicht schlechter werden.
 */
export function regressions(now, before) {
  const out = []
  const count = (d) => (d.failures ?? []).length
  if (count(now) > count(before)) out.push(`Fehlschritte ${count(before)} -> ${count(now)}`)
  const share = (d) => mapShare(d.layout?.mapStart)
  if (share(now) !== null && share(before) !== null && share(now) < share(before) - LIMITS.baselineMapShareSlack) {
    out.push(`Kartenanteil ${share(before)} -> ${share(now)}`)
  }
  const head = (d) => d.layout?.running?.header?.h
  if (typeof head(now) === 'number' && typeof head(before) === 'number' && head(now) > head(before) + LIMITS.baselineHeaderSlackPx) {
    out.push(`Kopfleiste ${head(before)} -> ${head(now)} px`)
  }
  // Verglichen wird nur, was beide Stände gemessen haben: ein später dazugekommener Messzustand
  // (Provinz-, Armeepanel) ist kein Vergleichswert gegen einen Stand, der ihn nicht kannte.
  const overflow = (d, scenes) =>
    layoutsOf(d)
      .filter(([name]) => scenes.includes(name))
      .reduce((s, [, l]) => s + (l.overflowingRegions ?? []).length + (l.pageOverflowX ? 1 : 0), 0)
  const scenesBefore = layoutsOf(before).map(([name]) => name)
  if (overflow(now, scenesBefore) > overflow(before, scenesBefore)) out.push(`Überlauf ${overflow(before, scenesBefore)} -> ${overflow(now, scenesBefore)}`)
  const axeBefore = Object.keys(before.axe ?? {})
  const axeNodes = (d) => axeBefore.reduce((s, name) => s + (d.axe?.[name]?.nodes ?? 0), 0)
  if (axeNodes(now) > axeNodes(before)) out.push(`axe-Knoten ${axeNodes(before)} -> ${axeNodes(now)}`)
  const small = (d) => d.touch?.mapStart?.under24
  if (typeof small(now) === 'number' && typeof small(before) === 'number' && small(now) > small(before)) {
    out.push(`Ziele unter 24 px ${small(before)} -> ${small(now)}`)
  }
  return out
}

/** Welche Kriterien passen zu `--only`? Eine Teilzeichenkette der Kennung genügt: `R-UX-02`, `02/AK1`. */
export function select(only) {
  if (!only) return CRITERIA
  const wanted = String(only)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return CRITERIA.filter((c) => wanted.some((w) => c.id.toLowerCase().includes(w)))
}

/**
 * @param {object} m messwerte.json
 * @param {{ only?: string, baseline?: object|null, sameDayBundle?: object|null }} ctx
 */
export function evaluate(m, ctx = {}) {
  return select(ctx.only).map((c) => {
    let r
    try {
      r = c.check(m, ctx)
    } catch (e) {
      r = open(`Auswertung fehlgeschlagen: ${String(e).slice(0, 120)}`)
    }
    return { id: c.id, title: c.title, needs: c.needs, ...r }
  })
}

/** Welche Teile der Aufnahme braucht eine Auswahl? Das Werkzeug fährt nur, was gefragt ist. */
export function sectionsNeeded(only) {
  return new Set(select(only).flatMap((c) => c.needs))
}

const MARK = { green: 'grün ', red: 'ROT  ', open: 'offen' }

export function render(results) {
  const out = []
  for (const r of results) {
    out.push(`${MARK[r.status]} ${r.id}  ${r.title}`)
    out.push(`        ${r.value}`)
    for (const line of r.lines) out.push(`        - ${line}`)
  }
  const n = (s) => results.filter((r) => r.status === s).length
  out.push('')
  out.push(`${n('green')} grün, ${n('red')} rot, ${n('open')} offen (von ${results.length})`)
  return out.join('\n')
}

/** 1 bei einem roten Kriterium; mit `strict` auch bei einem offenen. */
export function exitCodeFor(results, { strict = false } = {}) {
  if (results.some((r) => r.status === 'red')) return 1
  if (strict && results.some((r) => r.status === 'open')) return 1
  return 0
}
