import { test, expect } from '@playwright/test'

test('About explains privacy, and the whole box can be read on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/how-to-play')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: 'About' }).click()

  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
  const last = page.getByText(/follow you across sites/)
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await expect(page.getByText('There are no accounts and no cookies.')).toBeVisible()
})
