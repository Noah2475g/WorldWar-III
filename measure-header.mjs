import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://localhost:5321/')
await page.waitForTimeout(1000)

const results = await page.evaluate(() => {
  const header = document.querySelector('header.header')
  const headerTop = document.querySelector('.header__top')
  const clock = document.querySelector('.clock')
  const speeds = document.querySelector('.speeds')
  const resources = document.querySelector('.resources')
  const alarm = document.querySelector('.header__alarm')
  const panels = document.querySelector('.header__panels')
  const mapTools = document.querySelector('.map-tools')
  const modes = document.querySelector('.map-tools .modes')
  const modesSelect = document.querySelector('.map-tools .modes-select')
  
  // Header height
  const headerHeight = header ? header.getBoundingClientRect().height : null
  const headerTopHeight = headerTop ? headerTop.getBoundingClientRect().height : null
  
  // Touch targets in header
  const headerButtons = [...document.querySelectorAll('header.header button, header.header [role="button"], header.header select, header.header a[href]')]
    .filter(e => !e.closest('.marks'))
    .map(e => {
      const r = e.getBoundingClientRect()
      return {
        name: e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30) || e.className,
        width: r.width,
        height: r.height,
        minDim: Math.min(r.width, r.height)
      }
    })
  
  // Map tools buttons
  const mapToolsButtons = [...document.querySelectorAll('.map-tools button, .map-tools select')]
    .map(e => {
      const r = e.getBoundingClientRect()
      return {
        name: e.getAttribute('aria-label') || e.textContent?.trim().slice(0, 30) || e.className,
        width: r.width,
        height: r.height,
        minDim: Math.min(r.width, r.height)
      }
    })

  return {
    headerHeight,
    headerTopHeight,
    headerButtons,
    mapToolsButtons,
    clockRect: clock ? clock.getBoundingClientRect() : null,
    speedsRect: speeds ? speeds.getBoundingClientRect() : null,
    resourcesRect: resources ? resources.getBoundingClientRect() : null,
    alarmRect: alarm ? alarm.getBoundingClientRect() : null,
    panelsRect: panels ? panels.getBoundingClientRect() : null,
    mapToolsRect: mapTools ? mapTools.getBoundingClientRect() : null,
    modesRect: modes ? modes.getBoundingClientRect() : null,
    modesSelectRect: modesSelect ? modesSelect.getBoundingClientRect() : null
  }
})

console.log(JSON.stringify(results, null, 2))
await browser.close()
