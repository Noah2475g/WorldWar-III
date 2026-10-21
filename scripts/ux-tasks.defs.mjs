/* global document, HTMLElement */
import { PICKER, RAIL_ITEM } from './ux-sel.mjs'
/**
 * Die acht Handlungen (PLAN-V3 P0-B2). Jede hat `maus` und `tastatur`; `minimum` ist die kuerzeste
 * Folge der Oberflaeche, von Hand gezaehlt. Bei der Tastatur steht als Mass die Zahl der Absichten
 * (Fokus setzen, Wert tippen, ausloesen): was darueber liegt, sind Tab-Druecke.
 *
 * Vorbedingung jedes Laufs: der Stand ist geladen, die Einfuehrung geschlossen, der Fokus auf <body>,
 * die Uhr steht auf Tempo 10 (Befehle wirken erst, wenn die Uhr laeuft: "befohlen -- wirkt beim
 * Weiterlaufen"). Die Einrichtung zaehlt nicht.
 */

const sleep = (page, ms) => page.waitForTimeout(ms)

/** Uhr auf Tempo 10 (Einrichtung). */
async function clockOn(page) {
  await page.getByRole('button', { name: '10', exact: true }).first().click({ timeout: 5000 })
  await sleep(page, 300)
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
}

/** Auf eine Bedingung in der Seite warten; liefert ja/nein statt zu werfen. */
async function until(page, fn, arg, ms = 6000) {
  return page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Hilfe fuer weitere Aufgabenlaeufe (V3 M46), bewusst behalten (Regel 1)
const aside = (page) => page.locator('aside.side')
// D16: die Provinzwahl lebt seit E5 in `section.dock .picker select` (PICKER), nicht mehr in
// `aside select`. T-F9F9 (Nachtrag, per Live-DOM bestaetigt): der Marschziel-Select ist bei "Marschieren"
// NICHT im `aside.side`-Panel geblieben wie der Kommentar hier frueher sagte -- er steckt im Dock
// selbst (`section.dock.dock--army .dock-army__targeting select`, Dock wechselt beim Marschieren-Klick
// in den Armee-Modus). `asideSelect` (frueher: Provinz- und Marschziel-Select in `aside select`) ist
// damit tot und entfernt (Regel 1 gilt fuer Wege, nicht fuer einen Selektor ohne Ziel mehr).
const targetSelect = (page) => page.locator('.dock-army__targeting select')
const provincePicker = (page) => page.locator(PICKER)
const btn = (page, name, exact = true) => page.getByRole('button', { name, exact }).first()
// T-F9F9: Kamera-Drift nach E5-Dock (s. ux-tasks.mjs-Ticket) -- die eigene Armee stand bis E5 an
// einer festen Pixelstelle auf der Canvas-Karte (MARKER/markerY); das Laden des S300/armeen-Standes
// zentriert die Kamera seit dem Dock anders, die feste Stelle trifft nicht mehr zuverlaessig.
// GEGENPRUEFT (nicht geraten): der Dock-Picker zeigt fuer eine Provinz nur Bauplaetze/Ausheben, KEINE
// Armeenliste (anders als vor E5/D19c, wo `aside.side` beides gleichzeitig fuehrte) -- Auswaehlen
// lebt seit E5 ausschliesslich in der Heer-Uebersicht der Leiste rechts (`RAIL_ITEM('armies')`,
// Taste A, `aside.side`), unabhaengig von einer Provinzwahl im Dock. Die Maus-Laeufe fuer die
// Armee-Aufgaben gehen daher ueber die Leiste, nicht ueber den Picker. ACHTUNG (per Live-DOM bestaetigt,
// nicht die App.test.tsx-Vermutung uebernommen): die Heer-Uebersicht setzt den zugaenglichen Namen
// ueber `armies.selectAria` = "{{name}} auswählen und auf der Karte zeigen" (de.ts) -- klein
// geschrieben, mitten im Satz. Das ist NICHT dieselbe Flaeche wie das `army.select`-Aria-Label
// ("Auswählen: {{name}}", gross, am Anfang) der Dock-Provinzliste aus Panels.tsx; jene Flaeche
// existiert in der aktuellen UI fuer Armeen gar nicht (nur fuer Gebaeude/Ausheben im Dock). Darum
// hier ein Regex, der beide Schreibweisen trifft, nicht `/^Auswählen/`.
const auswaehlenBtn = (page) => page.getByRole('button', { name: /auswählen/i }).first()
const openArmiesRail = (page) => page.locator(RAIL_ITEM('armies')).first().click()
const asideHas = (src) => new RegExp(src).test(document.querySelector('aside.side')?.innerText ?? '')
// T-F9F9: das Baurad/Ausheben-Raster der Provinz lebt seit E5 im Dock, nicht mehr in `aside.side`
// (D19c) -- Rueckmeldungen dazu ("Im Bau" waehrend ein Auftrag laeuft) stehen darum im Dock.
const dockHas = (src) => new RegExp(src).test(document.querySelector('.dock')?.innerText ?? '')
const MOVING = '(Marsch\\s+Ankunft Tag \\d+|\\d+ · \\d\\d:00)' // Symbol-Durchgang T-M46-17: Ankunft steht als "380 · 03:00"
const bodyHas = (src) => new RegExp(src).test(document.body.innerText)

/** Fokus-Tests */
const isButton = (re) => (f) => f.tag === 'button' && re.test(f.name)
const isProvinceSelect = (f) => f.tag === 'select' && /Provinz/.test(f.name)
const isOtherSelect = (f) => f.tag === 'select' && !/Provinz|Kartenmodus/.test(f.name)
const isInput = (re) => (f) => f.tag === 'input' && re.test(f.name)

// T-F9F9: `MARKER`/`markerY` (feste Canvas-Pixelstelle der eigenen Armee) sind seit dem Kamera-Drift-Fix
// nicht mehr in Benutzung (s. Kommentar oben bei `auswaehlenBtn`) -- die Maus-Laeufe gehen jetzt ueber
// den PICKER + "Auswählen", unabhaengig vom Kamerastand. Absichtlich entfernt, nicht nur auskommentiert
// (Regel 1 gilt fuer Wege, nicht fuer tote Koordinaten einer ueberholten Technik).

/** Keyboard: Armee in Mittlerer Westen auswaehlen (Provinzliste, dann "Auswaehlen"). */
async function kbSelectArmy(run, page) {
  if (!(await run.tabTo(isProvinceSelect, 'Provinzliste'))) return false
  if (!(await run.typeSelect('Mittlerer Westen', 'Provinz'))) return false
  if (!(await run.tabTo(isButton(/^Auswählen/), 'Auswählen (Armee)'))) return false
  await run.key('Enter', 'Auswählen')
  await sleep(page, 300)
  return true
}

/** Klartext der Armee-Liste der Provinz -- Anzahl der Eintraege "Armee ... Staerke". */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Hilfe fuer weitere Aufgabenlaeufe (V3 M46), bewusst behalten (Regel 1)
const armyCount = (page) =>
  page.evaluate(() => {
    const m = /Armeen hier([\s\S]*?)Ausheben/.exec(document.querySelector('aside.side')?.innerText ?? '')
    return m ? (m[1].match(/Stärke/g) ?? []).length : null
  })

export const TASKS = [
  // ------------------------------------------------------------------------------------
  {
    id: 'armee-bewegen',
    title: 'Armee finden und bewegen (Mittlerer Westen nach Südstaaten)',
    base: 'armeen',
    minimum: { maus: { klicks: 6, tasten: 0, hinweis: 'Heer (Leiste rechts), Auswählen, Marschieren, Ziel-Liste (2), Marsch befehlen' }, tastatur: { absichten: 7, hinweis: 'Liste fokussieren, tippen, Auswählen, Marschieren, Ziel fokussieren, tippen, Marsch befehlen' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await openArmiesRail(page)
      await run.click(auswaehlenBtn(page), 'Auswählen (Armee)')
      await run.click(btn(page, 'Marschieren'), 'Marschieren')
      await run.pick(targetSelect(page), 'Südstaaten', 'Marschziel')
      await run.click(btn(page, 'Marsch befehlen'), 'Marsch befehlen')
      run.stop()
      // T-F9F9: der Marsch-Status ("Ziel · Tag N, HH:00") steht seit E5 im Dock (Armee-Modus), nicht
      // in `aside.side` (das bleibt hier leer) -- per Live-DOM bestaetigt.
      const ok = await until(page, dockHas, MOVING, 5000)
      const text = await page.evaluate(() => document.querySelector('.dock')?.innerText.slice(0, 600) ?? '')
      return run.result(ok, { beleg: text.replace(/\s+/g, ' ').slice(0, 300) })
    },
    // T-M46-01: seit der Heeruebersicht: A oeffnet sie (Fokus auf der ersten Armee), Tab zu "Marschieren", Eingabe;
    // die Zielliste hat den Fokus, Pfeil ab bis zum Ziel (die Liste ist nach Ankunft sortiert), Tab zu "Marsch befehlen".
    // Der Weg ueber Provinzliste (46 Tasten, docs/ux/v3-before) bleibt als `tastaturAlt` erhalten (Regel 1).
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('a', 'Heeruebersicht')
      await sleep(page, 300)
      if (!(await run.tabTo(isButton(/marschieren lassen$/), 'Marschieren (erste Armee)'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Marschieren')
      await sleep(page, 300)
      if (!(await run.arrowSelect('Südstaaten', 'Marschziel'))) return (run.stop(), run.result(false))
      if (!(await run.tabTo(isButton(/^Marsch befehlen$/), 'Marsch befehlen'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Marsch befehlen')
      await sleep(page, 400)
      await run.checkNotice('Marsch befehlen')
      run.stop()
      const ok = await until(page, asideHas, MOVING, 5000)
      const text = await page.evaluate(() => document.querySelector('aside.side')?.innerText.slice(0, 600) ?? '')
      return run.result(ok || /befohlen/.test(text), { beleg: text.replace(/\s+/g, ' ').slice(0, 300) })
    },
    async tastaturAlt(run, page) {
      await clockOn(page)
      run.start()
      if (!(await kbSelectArmy(run, page))) return (run.stop(), run.result(false))
      if (!(await run.tabTo(isButton(/^Marschieren$/), 'Marschieren'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Marschieren')
      await sleep(page, 300)
      if (!(await run.tabTo(isOtherSelect, 'Zielliste'))) return (run.stop(), run.result(false))
      await run.typeSelect('Südstaaten', 'Marschziel')
      if (!(await run.tabTo(isButton(/^Marsch befehlen$/), 'Marsch befehlen'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Marsch befehlen')
      await sleep(page, 400)
      await run.checkNotice('Marsch befehlen')
      run.stop()
      const ok = await until(page, asideHas, MOVING, 5000)
      const text = await page.evaluate(() => document.querySelector('aside.side')?.innerText.slice(0, 600) ?? '')
      return run.result(ok || /befohlen/.test(text), { beleg: text.replace(/\s+/g, ' ').slice(0, 300) })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'armee-teilen-zusammenlegen',
    title: 'Armee teilen und wieder zusammenlegen (Mittlerer Westen)',
    base: 'armeen',
    minimum: { maus: { klicks: 4, tasten: 0, hinweis: 'Heer (Leiste rechts), Auswählen, Teilen, Zusammenlegen' }, tastatur: { absichten: 6, hinweis: 'Liste, tippen, Auswählen, Teilen, Zusammenlegen' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await openArmiesRail(page)
      await run.click(auswaehlenBtn(page), 'Auswählen (Armee)')
      await run.click(btn(page, 'Teilen'), 'Teilen')
      // T-F9F9: die Armee-Werkzeuge (Teilen/Zusammenlegen) leben seit E5 im Dock (`section.dock.dock--army`),
      // nicht mehr in `aside.side` -- `aside.side` ist hier durchgehend leer (per Live-DOM bestaetigt).
      const geteilt = await until(page, () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && !b.disabled), null, 5000)
      if (!geteilt) run.detour('Teilen', 'Zusammenlegen wurde nach 5 s nicht frei')
      await run.click(btn(page, 'Zusammenlegen'), 'Zusammenlegen', { js: true })
      run.stop()
      const ok = await until(page, () => [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && b.disabled), null, 5000)
      return run.result(geteilt && ok, { beleg: `geteilt=${geteilt}, wieder eine Armee=${ok}` })
    },
    // T-M46-05: A oeffnet die Heeruebersicht, Eingabe waehlt die erste Armee, der Fokus steht auf ihrem ersten Befehl.
    // Der Weg ueber die Provinzliste (40 Tasten, docs/ux/v3-before) bleibt als `tastaturAlt` erhalten (Regel 1).
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('a', 'Heeruebersicht')
      await sleep(page, 300)
      await run.key('Enter', 'Auswählen (erste Armee)')
      await sleep(page, 300)
      if (!(await run.tabTo(isButton(/^Teilen$/), 'Teilen', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Teilen')
      const geteilt = await until(page, () => [...document.querySelectorAll('aside.side button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && !b.disabled), null, 5000)
      if (!geteilt) run.detour('Teilen', 'Zusammenlegen wurde nach 5 s nicht frei')
      if (!(await run.tabTo(isButton(/^Zusammenlegen$/), 'Zusammenlegen', { max: 40, back: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Zusammenlegen')
      run.stop()
      const ok = await until(page, () => [...document.querySelectorAll('aside.side button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && b.disabled), null, 5000)
      return run.result(geteilt && ok, { beleg: `geteilt=${geteilt}, wieder eine Armee=${ok}` })
    },
    async tastaturAlt(run, page) {
      await clockOn(page)
      run.start()
      if (!(await kbSelectArmy(run, page))) return (run.stop(), run.result(false))
      if (!(await run.tabTo(isButton(/^Teilen$/), 'Teilen'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Teilen')
      const geteilt = await until(page, () => [...document.querySelectorAll('aside.side button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && !b.disabled), null, 5000)
      if (!geteilt) run.detour('Teilen', 'Zusammenlegen wurde nach 5 s nicht frei')
      // Der Fokus steht nach dem Befehl auf dem Teilen-Knopf; Zusammenlegen liegt davor: Umschalt+Tab.
      if (!(await run.tabTo(isButton(/^Zusammenlegen$/), 'Zusammenlegen', { max: 40, back: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Zusammenlegen')
      run.stop()
      const ok = await until(page, () => [...document.querySelectorAll('aside.side button')].some((b) => (b.getAttribute('aria-label') || b.textContent || '').trim() === 'Zusammenlegen' && b.disabled), null, 5000)
      return run.result(geteilt && ok, { beleg: `geteilt=${geteilt}, wieder eine Armee=${ok}` })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'bauen',
    title: 'Kaserne bauen (Mittlerer Westen)',
    base: 'S300',
    minimum: { maus: { klicks: 3, tasten: 0, hinweis: 'Provinz-Liste (2), Kaserne bauen' }, tastatur: { absichten: 4, hinweis: 'Liste, tippen, Kaserne bauen' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await run.pick(provincePicker(page), 'Mittlerer Westen', 'Provinz (Kartenpicker)')
      await run.click(btn(page, 'Kaserne bauen'), 'Kaserne bauen')
      run.stop()
      // T-F9F9: der Fortschrittstext "noch N h" ist seit D19a aus dem Dock entfernt (nur Platz fuer
      // Raster, nicht Meter) -- "Im Bau" (die Ueberschrift ueber dem Abbrechen-Knopf, cancelGroup)
      // bleibt waehrend ein Auftrag laeuft die einzige textliche Auskunft im Dock (bestaetigt per
      // Live-Messung: 150-900ms nach dem Klick sichtbar, danach nach Fertigstellung wieder weg).
      const wirkt = await until(page, dockHas, 'Im Bau', 4000)
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; "Im Bau" im Dock gesehen: ${wirkt}` })
    },
    // T-M46-05: P springt in die Provinzliste, B zu den Bauknoepfen (docs/ux/v3-before: 19 Tasten, 17 Tab; `tastaturAlt`).
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('p', 'Provinzliste')
      if (!(await run.typeSelect('Mittlerer Westen', 'Provinz'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Wahl bestaetigen (Fokus zu den Handlungen der Provinz)')
      if (!(await run.tabTo(isButton(/^Kaserne bauen$/), 'Kaserne bauen', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Kaserne bauen')
      // Sofort nachsehen (T-M46-05): die Restzeit steht nur so lange im Panel, wie der Bau laeuft (12 h = 1,2 s bei Tempo 10).
      const wirkt = await until(page, asideHas, 'noch \\d+ [hd]', 4000)
      await run.checkNotice('Kaserne bauen')
      run.stop()
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; Fortschrittsanzeige (noch N h) im Panel: ${wirkt}`, panel: (await page.evaluate(() => document.querySelector('aside.side')?.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 400) })
    },
    async tastaturAlt(run, page) {
      await clockOn(page)
      run.start()
      if (!(await run.tabTo(isProvinceSelect, 'Provinzliste'))) return (run.stop(), run.result(false))
      if (!(await run.typeSelect('Mittlerer Westen', 'Provinz'))) return (run.stop(), run.result(false))
      if (!(await run.tabTo(isButton(/^Kaserne bauen$/), 'Kaserne bauen'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Kaserne bauen')
      await sleep(page, 300)
      await run.checkNotice('Kaserne bauen')
      run.stop()
      const wirkt = await until(page, asideHas, 'noch \\d+ [hd]', 4000)
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; Fortschrittsanzeige (noch N h) im Panel: ${wirkt}` })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'ausheben',
    title: 'Infanterie ausheben (Mittlerer Westen, Kaserne steht)',
    base: 'armeen',
    minimum: { maus: { klicks: 3, tasten: 0, hinweis: 'Provinz-Liste (2), Infanterie ausheben' }, tastatur: { absichten: 4, hinweis: 'Liste, tippen, Infanterie ausheben' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await run.pick(provincePicker(page), 'Mittlerer Westen', 'Provinz (Kartenpicker)')
      // T-F9F9: der Fortschrittstext "noch N h" gibt es im Ausheben-Raster nicht (nie gegeben --
      // mehrere Einheiten lassen sich gleichzeitig in die Ausbildung geben, kein Platz "belegt" sich
      // dafuer). Live bestaetigt: der Kopf des Rasters zaehlt "N frei" (freie Bevoelkerungs-Slots) und
      // faellt fuer die Dauer der Ausbildung um eins, bevor er zurueckspringt -- das ist das einzige
      // textliche Vorher/Nachher-Signal; vorher merken, nachher auf einen niedrigeren Wert warten.
      const freiVorher = await page.evaluate(() => {
        const m = /·\s*(\d+)\s*frei/.exec(document.querySelector('#recruit-sheet')?.innerText ?? '')
        return m ? Number(m[1]) : null
      })
      await run.click(btn(page, 'Infanterie ausheben'), 'Infanterie ausheben')
      run.stop()
      const wirkt =
        freiVorher === null
          ? await until(page, dockHas, 'Infanterie', 4000) // Raster ohne lesbaren Kopf (Fallback): zumindest noch da
          : await until(
              page,
              (vorher) => {
                const m = /·\s*(\d+)\s*frei/.exec(document.querySelector('#recruit-sheet')?.innerText ?? '')
                return m ? Number(m[1]) < vorher : false
              },
              freiVorher,
              4000,
            )
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; "N frei" im Ausheben-Raster gesunken: ${wirkt}` })
    },
    // T-M46-05: P Provinzliste, E zu den Aushebeknoepfen (docs/ux/v3-before: 31 Tasten, 29 Tab; `tastaturAlt`).
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('p', 'Provinzliste')
      if (!(await run.typeSelect('Mittlerer Westen', 'Provinz'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Wahl bestaetigen (Fokus zu den Handlungen der Provinz)')
      // Der Fokus steht auf dem ersten freien Bauplatz; E springt zu den Aushebeknoepfen.
      await run.key('e', 'Aushebeknoepfe')
      if (!(await run.tabTo(isButton(/^Infanterie ausheben$/), 'Infanterie ausheben', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Infanterie ausheben')
      // Sofort nachsehen (T-M46-05): die Restzeit steht nur so lange im Panel, wie der Bau laeuft (12 h = 1,2 s bei Tempo 10).
      const wirkt = await until(page, asideHas, 'noch \\d+ [hd]', 4000)
      await run.checkNotice('Infanterie ausheben')
      run.stop()
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; Fortschrittsanzeige (noch N h) im Panel: ${wirkt}`, panel: (await page.evaluate(() => document.querySelector('aside.side')?.innerText ?? '')).replace(/\s+/g, ' ').slice(0, 400) })
    },
    async tastaturAlt(run, page) {
      await clockOn(page)
      run.start()
      if (!(await run.tabTo(isProvinceSelect, 'Provinzliste'))) return (run.stop(), run.result(false))
      if (!(await run.typeSelect('Mittlerer Westen', 'Provinz'))) return (run.stop(), run.result(false))
      if (!(await run.tabTo(isButton(/^Infanterie ausheben$/), 'Infanterie ausheben'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Infanterie ausheben')
      await sleep(page, 300)
      await run.checkNotice('Infanterie ausheben')
      run.stop()
      const wirkt = await until(page, asideHas, 'noch \\d+ [hd]', 4000)
      const ok = wirkt && (await accepted(run, page))
      return run.result(ok, { beleg: `Rückmeldung gesehen: ${await accepted(run, page)}; Fortschrittsanzeige (noch N h) im Panel: ${wirkt}` })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'krieg-erklaeren',
    title: 'Mexiko den Krieg erklären',
    base: 'S300',
    minimum: { maus: { klicks: 4, tasten: 0, hinweis: 'Diplomatie, Mexiko, Krieg erklären, noch einmal klicken' }, tastatur: { absichten: 4, hinweis: 'D, Mexiko, Krieg erklären, Bestätigung' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await run.click(btn(page, 'Diplomatie'), 'Diplomatie')
      await run.click(btn(page, 'Mexiko'), 'Mexiko')
      await run.click(btn(page, 'Krieg erklären'), 'Krieg erklären')
      await run.click(page.getByRole('button', { name: /noch einmal klicken/ }), 'Bestätigung "noch einmal klicken"')
      run.stop()
      const ok = await warInEffect(page)
      return run.result(ok, { beleg: ok ? 'Tabelle zeigt Krieg mit Mexiko' : await ackText(page) })
    },
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('d', 'Diplomatie')
      await sleep(page, 300)
      if (!(await run.tabTo(isButton(/^Mexiko$/), 'Mexiko', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Mexiko')
      await sleep(page, 300)
      if (!(await run.tabTo(isButton(/^Krieg erklären$/), 'Krieg erklären', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Krieg erklären')
      await sleep(page, 300)
      const f = await run.focusInfo()
      if (!/noch einmal klicken/.test(f.name)) run.detour('Bestätigung', `Fokus nach dem ersten Enter: "${f.tag} ${f.name}" -- Bestätigung nicht auf dem Fokus`)
      await run.key('Enter', 'Bestätigung')
      await sleep(page, 300)
      await run.checkNotice('Bestätigung')
      run.stop()
      const ok = await warInEffect(page)
      return run.result(ok, { beleg: ok ? 'Tabelle zeigt Krieg mit Mexiko' : await ackText(page) })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'frieden-anbieten',
    title: 'Mexiko Frieden anbieten (Krieg besteht)',
    base: 'S300',
    minimum: { maus: { klicks: 3, tasten: 0, hinweis: 'Diplomatie, Mexiko, Frieden anbieten' }, tastatur: { absichten: 3, hinweis: 'D, Mexiko, Frieden anbieten' } },
    async setup(page) {
      // Krieg herstellen (Einrichtung): ueber dieselben Knoepfe, dann laufen lassen, bis die Tabelle ihn zeigt.
      await btn(page, 'Diplomatie').click({ timeout: 5000 })
      await btn(page, 'Mexiko').click({ timeout: 5000 })
      await btn(page, 'Krieg erklären').click({ timeout: 5000 })
      await page.getByRole('button', { name: /noch einmal klicken/ }).first().click({ timeout: 5000 })
      await btn(page, '100').click({ timeout: 5000 })
      const ok = await warInEffect(page, 20000)
      await btn(page, 'Pause').click({ timeout: 5000 })
      await page.getByRole('button', { name: 'Schließen', exact: true }).first().click({ timeout: 5000 }).catch(() => {})
      await sleep(page, 300)
      return ok
    },
    async maus(run, page) {
      const war = await this.setup(page)
      run.note('Einrichtung', `Krieg gegen Mexiko wirksam: ${war}`)
      await clockOn(page)
      run.start()
      await run.click(btn(page, 'Diplomatie'), 'Diplomatie')
      await run.click(btn(page, 'Mexiko'), 'Mexiko')
      await run.click(btn(page, 'Frieden anbieten'), 'Frieden anbieten')
      run.stop()
      const ok = await accepted(run, page, 'Friedensangebot an Mexiko wartet')
      return run.result(war && ok, { beleg: await ackText(page), krieg: war })
    },
    async tastatur(run, page) {
      const war = await this.setup(page)
      run.note('Einrichtung', `Krieg gegen Mexiko wirksam: ${war}`)
      await clockOn(page)
      run.start()
      await run.key('d', 'Diplomatie')
      await sleep(page, 300)
      // Ist Mexiko schon die gewaehlte Macht (die Einrichtung hat den Krieg erklaert), steht der Fokus beim Oeffnen auf
      // ihrer ersten freien Handlung - dann entfaellt die Wahl (T-M46-05).
      if (!isButton(/^Frieden anbieten$/)(await run.focusInfo())) {
        if (!(await run.tabTo(isButton(/^Mexiko$/), 'Mexiko', { checkFirst: true }))) return (run.stop(), run.result(false))
        await run.key('Enter', 'Mexiko')
        await sleep(page, 300)
      }
      if (!(await run.tabTo(isButton(/^Frieden anbieten$/), 'Frieden anbieten', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Frieden anbieten')
      await sleep(page, 300)
      await run.checkNotice('Frieden anbieten')
      run.stop()
      const ok = await accepted(run, page, 'Friedensangebot an Mexiko wartet')
      return run.result(war && ok, { beleg: await ackText(page), krieg: war })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'handel-anbieten',
    title: 'Mexiko 100 Nahrung gegen 50 Material anbieten',
    base: 'S300',
    minimum: { maus: { klicks: 5, tasten: 5, hinweis: 'Diplomatie, Mexiko, Feld, 100, Feld, 50, Handel anbieten' }, tastatur: { absichten: 7, hinweis: 'D, Mexiko, Feld, 100, Feld, 50, Handel anbieten' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await run.click(btn(page, 'Diplomatie'), 'Diplomatie')
      await run.click(btn(page, 'Mexiko'), 'Mexiko')
      await run.click(page.getByLabel('Nahrung geben', { exact: true }), 'Feld Nahrung geben')
      for (const ch of '100') await run.key(ch, 'Menge')
      await run.click(page.getByLabel('Material verlangen', { exact: true }), 'Feld Material verlangen')
      for (const ch of '50') await run.key(ch, 'Menge')
      await run.click(btn(page, 'Handel anbieten'), 'Handel anbieten')
      run.stop()
      const ok = await accepted(run, page)
      return run.result(ok, { beleg: await ackText(page) })
    },
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      await run.key('d', 'Diplomatie')
      await sleep(page, 300)
      if (!(await run.tabTo(isButton(/^Mexiko$/), 'Mexiko', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Mexiko')
      await sleep(page, 300)
      if (!(await run.tabTo(isInput(/Nahrung geben/), 'Feld Nahrung geben', { checkFirst: true }))) return (run.stop(), run.result(false))
      for (const ch of '100') await run.key(ch, 'Menge')
      if (!(await run.tabTo(isInput(/Material verlangen/), 'Feld Material verlangen'))) return (run.stop(), run.result(false))
      for (const ch of '50') await run.key(ch, 'Menge')
      // T-M46-05: Eingabe in einem Mengenfeld schickt das Angebot ab (vorher 13 Tab bis zum Knopf).
      await run.key('Enter', 'Handel anbieten (im Mengenfeld)')
      await sleep(page, 300)
      await run.checkNotice('Handel anbieten')
      run.stop()
      const ok = await accepted(run, page)
      return run.result(ok, { beleg: await ackText(page) })
    },
  },
  // ------------------------------------------------------------------------------------
  {
    id: 'spion-anwerben',
    title: 'Spion für Aufklärung in Nordostmexiko anwerben',
    base: 'S300',
    pfad: 'naiv: erst der Knopf "Spionage", wie der Name es nahelegt; der Spieler merkt dort, dass angeworben wird in der Provinzleiste',
    minimum: { maus: { klicks: 3, tasten: 0, hinweis: 'Liste (2), Aufklärung -- ohne den Umweg über die Spionageübersicht' }, tastatur: { absichten: 4, hinweis: 'Liste, tippen, Aufklärung' } },
    async maus(run, page) {
      await clockOn(page)
      run.start()
      await run.click(btn(page, 'Spionage'), 'Spionage (Übersicht)')
      const leer = await page.evaluate(() => /keine Spione/.test(document.body.innerText))
      if (leer) run.detour('Spionage (Übersicht)', 'Übersicht ist leer; sie sagt "Anwerben können Sie in der Provinzleiste"')
      await run.pick(provincePicker(page), 'Nordostmexiko', 'Provinz')
      await run.click(page.getByRole('button', { name: 'Spion für Aufklärung anwerben' }), 'Aufklärung anwerben')
      run.stop()
      const ok = await accepted(run, page, 'Aufgeklärt')
      return run.result(ok, { beleg: await ackText(page) })
    },
    async tastatur(run, page) {
      await clockOn(page)
      run.start()
      // T-M46-05: P springt in die Provinzliste; der Umweg ueber die leere Spionageuebersicht (S) entfaellt.
      await run.key('p', 'Provinzliste')
      if (!(await run.typeSelect('Nordostmexiko', 'Provinz'))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Wahl bestaetigen (Fokus zu den Handlungen der Provinz)')
      if (!(await run.tabTo(isButton(/^Spion für Aufklärung anwerben$/), 'Aufklärung anwerben', { checkFirst: true }))) return (run.stop(), run.result(false))
      await run.key('Enter', 'Aufklärung anwerben')
      await sleep(page, 300)
      await run.checkNotice('Aufklärung anwerben')
      run.stop()
      const ok = await accepted(run, page, 'Aufgeklärt')
      return run.result(ok, { beleg: await ackText(page) })
    },
  },
]

/**
 * Hat das Spiel den Befehl angenommen? Die Rueckmeldung "befohlen" steht bei laufender Uhr nur bis zum
 * naechsten Tick im Bild, deshalb zaehlt der Beobachter der Seite (Run.ackDurations), nicht ein
 * spaeterer Blick; ersatzweise ein Text, der die Wirkung zeigt.
 */
async function accepted(run, page, effectPattern = null) {
  if ((await run.ackDurations()).length > 0) return true
  return effectPattern ? until(page, bodyHas, effectPattern, 3000) : false
}

/** Die Rueckmeldung, die der Spieler liest: Hinweiszeile oder erste "befohlen"-Zeile. */
async function ackText(page) {
  return page.evaluate(() => {
    const n = document.querySelector('.notice, .action__pending, [role=status]')
    const m = /✓[^\n]*/.exec(document.body.innerText)
    return ((n?.textContent ?? '') + ' ' + (m?.[0] ?? '')).replace(/\s+/g, ' ').trim().slice(0, 200)
  })
}

/** Zeigt die Diplomatie-Tabelle den Krieg mit Mexiko? (Zeile mit data-power, Status war; E4: .power-row) */
async function warInEffect(page, ms = 8000) {
  return until(
    page,
    () => {
      const rows = [...document.querySelectorAll('.power-row')].filter((r) => /^\s*Mexiko/.test(r.innerText))
      return rows.some((r) => r.dataset.status === 'war')
    },
    null,
    ms,
  )
}
