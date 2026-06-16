/**
 * E2E tests for the CQS Studio editor.
 *
 * Run with:
 *   TEST_EMAIL=you@example.com TEST_PASSWORD=yourpass \
 *   npx playwright test --config tests/e2e/playwright.config.ts
 *
 * Requires the Next.js app (npm start) and the logo processor
 * Docker service (docker compose up) both running.
 */
import { test, expect } from '@playwright/test'
import path from 'path'

const FIXTURES = path.join(__dirname, '../fixtures')

// ── Catalog ───────────────────────────────────────────────────────────────────

test('catalog page loads and shows products', async ({ page }) => {
  await page.goto('/studio/catalog')
  await expect(page).toHaveTitle(/catalog|studio/i)

  // At least one product card should be visible
  const products = page.locator('[data-testid="product-card"], .product-card, a[href*="editor"]')
  await expect(products.first()).toBeVisible({ timeout: 15_000 })
})

// ── Logo upload + background removal ─────────────────────────────────────────

test.describe('logo upload', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the first available product in the editor
    await page.goto('/studio/catalog')
    await page.locator('a[href*="editor"]').first().click()
    await page.waitForURL(/editor/)
  })

  test('uploading opaque JPEG triggers background removal', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'logo-small-opaque.jpeg'))

    // Should show a processing spinner or "removing background" indicator
    const spinner = page.locator('[data-testid="bg-removing"], text=/removing/i')
    // It might be fast — just wait for the "Background removed" confirmation
    const confirmation = page.locator('text=/background removed/i, [data-testid="bg-removed"]')
    await expect(confirmation).toBeVisible({ timeout: 60_000 })
  })

  test('uploading already-transparent PNG skips removal', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'logo-transparent.png'))

    // Should NOT show "Background removed" badge — image passes through
    await page.waitForTimeout(3_000)
    const confirmation = page.locator('text=/background removed/i')
    await expect(confirmation).not.toBeVisible()

    // But the logo preview should be visible
    const preview = page.locator('[data-testid="logo-preview"], img[alt*="logo"], .logo-thumb')
    await expect(preview.first()).toBeVisible()
  })

  test('uploading WebP file is accepted', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'logo-webp-alpha.webp'))

    // Should not show an error toast
    const errorToast = page.locator('text=/error|failed|unsupported/i')
    await page.waitForTimeout(5_000)
    await expect(errorToast).not.toBeVisible()
  })

  test('logo preview updates after upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'logo-wolf.jpg'))

    // Preview image or canvas should reflect the upload
    const preview = page.locator('[data-testid="logo-preview"], .logo-preview, canvas')
    await expect(preview.first()).toBeVisible({ timeout: 10_000 })
  })
})

// ── Mockup generation ─────────────────────────────────────────────────────────

test.describe('mockup generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/studio/catalog')
    await page.locator('a[href*="editor"]').first().click()
    await page.waitForURL(/editor/)

    // Upload a logo and wait for processing to finish
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(FIXTURES, 'logo-wolf.jpg'))
    // Wait for removal to complete (or timeout gracefully)
    await page.waitForTimeout(8_000)
  })

  test('generate mockup button produces at least one mockup image', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /generate|mockup/i })
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // Wait for mockup image to appear (Printful can take 20-40s)
    const mockupImg = page.locator('[data-testid="mockup-image"], .mockup-result img, img[alt*="mockup"]')
    await expect(mockupImg.first()).toBeVisible({ timeout: 60_000 })
  })

  test('changing color and regenerating works', async ({ page }) => {
    // Find a color swatch that isn't already selected
    const swatches = page.locator('[data-testid="color-swatch"], .color-swatch')
    const count = await swatches.count()
    if (count > 1) {
      await swatches.nth(1).click()
    }

    const generateBtn = page.getByRole('button', { name: /generate|mockup/i })
    await generateBtn.click()

    const mockupImg = page.locator('[data-testid="mockup-image"], .mockup-result img')
    await expect(mockupImg.first()).toBeVisible({ timeout: 60_000 })
  })
})

// ── AOP-specific controls ─────────────────────────────────────────────────────

test.describe('AOP controls', () => {
  test('AOP product shows tile style buttons and tightness slider', async ({ page }) => {
    // Navigate to an AOP product — look for one in catalog with "all over" in title
    await page.goto('/studio/catalog')
    const aopLink = page.locator('a[href*="editor"]', { hasText: /all.over|aop/i })
    const count = await aopLink.count()

    if (count === 0) {
      test.skip(true, 'No AOP products found in catalog — skipping AOP tests')
      return
    }

    await aopLink.first().click()
    await page.waitForURL(/editor/)

    // Tile style buttons
    await expect(page.getByRole('button', { name: /straight/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /diagonal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /random/i })).toBeVisible()

    // Tightness slider
    const tightnessSlider = page.locator('input[type="range"]').filter({ hasText: /tightness/i })
      .or(page.locator('label:has-text("Tightness") ~ input[type="range"]'))
      .or(page.locator('input[type="range"]').nth(1))
    await expect(tightnessSlider).toBeVisible()

    // Entire shirt checkbox
    await expect(page.getByLabel(/entire shirt/i)).toBeVisible()
  })
})

// ── Sliders ───────────────────────────────────────────────────────────────────

test('position and size sliders update display values', async ({ page }) => {
  await page.goto('/studio/catalog')
  await page.locator('a[href*="editor"]').first().click()
  await page.waitForURL(/editor/)

  // Size slider — drag to a new value and confirm the % label updates
  const sizeSlider = page.locator('input[type="range"]').first()
  await sizeSlider.fill('50')
  await expect(page.locator('text=/50%/')).toBeVisible()
})

// ── Save design ───────────────────────────────────────────────────────────────

test('save button is present and clickable after logo upload', async ({ page }) => {
  await page.goto('/studio/catalog')
  await page.locator('a[href*="editor"]').first().click()
  await page.waitForURL(/editor/)

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join(FIXTURES, 'logo-small-opaque.jpeg'))
  await page.waitForTimeout(5_000)

  const saveBtn = page.getByRole('button', { name: /save/i })
  await expect(saveBtn).toBeVisible()
  // Just verify it's enabled — don't actually submit to avoid polluting the DB
  await expect(saveBtn).not.toBeDisabled()
})
