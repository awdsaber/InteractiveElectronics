import { expect, test } from '@playwright/test'

test('serial-protocols: the logic-analyzer tab decodes the I2C read and the UART text', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('#/lesson/serial-protocols')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('UART, I²C and SPI')
  await page.getByRole('button', { name: 'Plug USB' }).click()
  await page.getByRole('button', { name: 'Upload sketch' }).click()
  await expect(page.locator('.status-panel')).toContainText('RUNNING')

  await page.getByRole('switch', { name: 'Instruments' }).click()
  const tab = page.getByRole('tab', { name: 'Logic analyzer' })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.la-canvas')).toBeVisible()
  // I²C decode: the MPU-6050 address with its R/W bit and the ACKs
  await expect(page.locator('.la-decoded')).toContainText('0x68 W', { timeout: 10000 })
  await expect(page.locator('.la-decoded')).toContainText('A')

  // UART decode: the sketch's text, as hex and ASCII
  await page.getByRole('radiogroup', { name: 'Protocol decoder' }).getByRole('radio', { name: 'UART' }).click()
  await expect(page.locator('.la-decoded')).toContainText("'a'", { timeout: 10000 })
  await expect(page.locator('.la-decoded')).toContainText('bar:')

  // the other tabs still work
  await page.getByRole('tab', { name: 'Oscilloscope' }).click()
  await expect(page.locator('.scope-canvas')).toBeVisible()
  expect(errors).toEqual([])
})
