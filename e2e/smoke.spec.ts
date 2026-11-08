import { expect, test, type Page } from '@playwright/test'

const panel = (page: Page) => page.locator('.status-panel')
const readout = (page: Page, label: string) => panel(page).locator('.row', { hasText: label }).locator('dd')
const statusLine = (page: Page) => page.locator('.status-line')

function mA(text: string): number {
  const m = /([\d.]+)\s*(m|µ|n|p)?A/.exec(text)
  if (!m) return NaN
  const k = { m: 1e-3, µ: 1e-6, n: 1e-9, p: 1e-12 }[m[2] as 'm'] ?? 1
  return Number(m[1]) * k * 1000
}

test('led-resistor: assemble, power, upload, blink, break', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('#/lesson/led-resistor')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('LED and Resistor')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(panel(page)).toContainText('READY')

  // strip → place all (breadboard: nothing to pick-and-place or solder)
  await page.getByRole('button', { name: /Clear the breadboard/ }).click()
  await expect(panel(page)).toContainText('BARE PCB')
  await expect(panel(page)).toContainText('0/6')
  await expect(page.getByRole('button', { name: /Pick & place SMD/ })).toHaveCount(0) // breadboard: no SMD or solder steps
  await page.getByRole('button', { name: /Place a part/ }).click()
  await page.getByRole('menuitem', { name: /R1/ }).click()
  await expect(panel(page)).toContainText('ASSEMBLING')
  await expect(page.locator('.toast').last()).toContainText('Drops the extra 3.2 V')
  await page.getByRole('button', { name: /Place a part/ }).click()
  await page.getByRole('menuitem', { name: 'Place all' }).click()
  await expect(panel(page)).toContainText('6/6')
  await expect(panel(page)).toContainText('READY')
  await expect(page.getByRole('button', { name: /Solder joints/ })).toHaveCount(0)

  // power and upload
  await page.getByRole('button', { name: 'Plug USB' }).click()
  await expect(panel(page)).toContainText('POWERED')
  await page.getByRole('button', { name: 'Upload sketch' }).click()
  await expect(panel(page)).toContainText('RUNNING')

  // pin 13 HIGH: about 13 mA through the LED
  await expect(statusLine(page)).toContainText('pin 13 HIGH', { timeout: 5000 })
  await expect.poll(async () => mA(await readout(page, 'LED CURRENT').innerText())).toBeGreaterThan(12)
  expect(mA(await readout(page, 'LED CURRENT').innerText())).toBeLessThan(16)
  await expect(page.locator('.serial pre')).toContainText('LED on')

  // pin 13 LOW: dark
  await expect(statusLine(page)).toContainText('pin 13 LOW', { timeout: 5000 })
  await expect.poll(async () => mA(await readout(page, 'LED CURRENT').innerText())).toBeLessThan(0.001)

  // break: leave the resistor out → burn → FAULT
  await page.getByRole('button', { name: /Break something/ }).click()
  await page.getByRole('menuitem', { name: /Leave the resistor out/ }).click()
  await expect(panel(page)).toContainText('FAULT', { timeout: 5000 })
  await expect(statusLine(page)).toContainText('LED1')
  await expect(statusLine(page)).toContainText('burnt')

  // repair → running again
  await page.getByRole('button', { name: /Break something/ }).click()
  await page.getByRole('menuitem', { name: 'Repair all' }).click()
  await expect(panel(page)).toContainText('RUNNING')

  expect(errors).toEqual([])
})

test('led-resistor: the first labelled part (UNO) shows its callout', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  await page.goto('#/lesson/led-resistor')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(panel(page)).toContainText('READY')
  const callout = (text: string) => page.locator('.callout-layer .callout', { hasText: new RegExp(`^${text}$`) })
  await expect(callout('UNO')).toBeVisible()
  for (const t of ['BREADBOARD', 'LIMIT', 'LED', 'PIN13', 'GND']) await expect(callout(t)).toBeVisible()
  // the old per-tag drei <Html> roots raced their own unmount on first render
  expect(consoleErrors.filter((e) => /synchronously unmount a root/.test(e))).toEqual([])
})

test('tweak slider, quiz completion and progress survive a reload', async ({ page }) => {
  await page.goto('#/lesson/led-resistor')
  await page.getByRole('button', { name: 'Plug USB' }).click()
  const tweak = page.locator('.tweak')
  await expect(tweak.locator('output')).toHaveText('220 Ω')
  // drag the log slider toward 2.2 kΩ: the bands and readouts follow
  await tweak.locator('input[type=range]').fill('1')
  await expect(tweak.locator('output')).toHaveText('2.2 kΩ')

  for (const a of [1, 0, 3, 2]) {
    await page.locator('.opts .opt').nth(a).click()
    await page.getByRole('button', { name: /Next question|Finish/ }).click()
  }
  await expect(page.locator('.quiz-done')).toContainText('Clean sheet')
  const ledCheck = () => page.locator('.lesson-link', { hasText: 'LED and Resistor' }).first().locator('.lesson-check')
  await expect(ledCheck()).toHaveText('✓')
  await page.reload()
  await expect(ledCheck()).toHaveText('✓')
})

test('transistor-switch: the scope catches the no-flyback kick; speed control; strip chart', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('#/lesson/transistor-switch')
  await expect(page.locator('canvas').first()).toBeVisible()
  await page.getByRole('switch', { name: 'Instruments' }).click()
  await expect(page.locator('.scope-canvas')).toBeVisible()
  // speed control: ×1 by default, buttons switch it
  const speed = page.getByRole('radiogroup', { name: 'Sim speed' })
  await expect(speed.getByRole('radio', { name: '×1', exact: true })).toHaveAttribute('aria-checked', 'true')
  await speed.getByRole('radio', { name: '×10', exact: true }).click()
  await expect(speed.getByRole('radio', { name: '×10', exact: true })).toHaveAttribute('aria-checked', 'true')
  await speed.getByRole('radio', { name: '×1', exact: true }).click()

  await page.getByRole('button', { name: 'Plug USB' }).click()
  await page.getByRole('button', { name: 'Connect pack' }).click()
  await page.getByRole('button', { name: 'Upload sketch' }).click()
  await page.getByRole('button', { name: /Break something/ }).click()
  await page.getByRole('menuitem', { name: /Remove the flyback diode/ }).click()
  await expect(panel(page)).toContainText('FAULT', { timeout: 15_000 })
  // the µs spike is in the held sweep and in the peak-hold readout
  await expect.poll(async () => Number(/V CE: max ([\d.]+) V/.exec(await page.locator('.inst-stats').innerText())?.[1] ?? 0), { timeout: 10_000 }).toBeGreaterThan(55)
  expect(Number(/([\d.]+)\s*V/.exec(await readout(page, 'V CE PEAK').innerText())?.[1])).toBeGreaterThan(55)

  await page.getByRole('tab', { name: 'Strip chart' }).click()
  await expect(page.locator('.chart-canvas')).toBeVisible()
  await page.getByRole('switch', { name: 'Q1 POWER' }).click()
  await expect(page.getByRole('switch', { name: 'Q1 POWER' })).toHaveAttribute('aria-checked', 'true')

  // mobile: the panel stacks, no sideways scroll
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('tab', { name: 'Oscilloscope' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('mobile drawer: focus moves in and Escape closes it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('#/lesson/led-resistor')
  await page.getByRole('button', { name: 'Open syllabus' }).click()
  await expect(page.locator('.sidebar')).toHaveAttribute('data-open', 'true')
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.sidebar'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.sidebar')).toHaveAttribute('data-open', 'false')
  await expect(page.getByRole('button', { name: 'Open syllabus' })).toBeFocused()
})

type Probe = { __partScreen?: (id: string) => { x: number; y: number } | null }

test('part inspector: click a resistor and the card decodes its bands', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('#/lesson/resistor-codes-divider')
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect(panel(page)).toContainText('READY')
  const card = page.getByRole('dialog', { name: /R1/ })

  // click R1's body on the bench (it has no callout pill)
  const where = () => page.evaluate(() => (window as unknown as Probe).__partScreen?.('r1') ?? null)
  await expect.poll(where).not.toBeNull()
  const at = (await where())!
  await page.mouse.click(at.x, at.y)
  await expect(card).toBeVisible()
  await expect(card.locator('.band-decode')).toHaveText('brown · black · orange · gold = 10 kΩ ±5 %')
  await expect(card.locator('.band')).toHaveCount(4)
  await expect(card).toContainText('P 0 W / 250 mW max, 0 %')
  await expect(card.locator('.inspector-view canvas')).toBeVisible()

  // live once powered: the divider current flows through R1
  await page.getByRole('button', { name: 'Connect battery' }).click()
  await expect(card.locator('.inspector-live')).toContainText(/µA|mA/)

  // Escape closes it
  await page.keyboard.press('Escape')
  await expect(page.locator('.inspector')).toHaveCount(0)

  // a callout pill is a button: Enter on LOAD inspects R_LOAD
  const pill = page.getByRole('button', { name: 'Inspect LOAD' })
  await pill.focus()
  await page.keyboard.press('Enter')
  const load = page.getByRole('dialog', { name: /LOAD/ })
  await expect(load.locator('.band-decode')).toHaveText('brown · black · yellow · gold = 100 kΩ ±5 %')
  await expect(load.locator('.inspector-title')).toBeFocused()
  await load.getByRole('button', { name: 'Close the part inspector' }).click()
  await expect(pill).toBeFocused()
  expect(errors).toEqual([])
})
