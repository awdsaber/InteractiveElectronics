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
