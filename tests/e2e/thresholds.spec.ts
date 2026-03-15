import { test, expect } from '@playwright/test'

const testEmail = `thresholds-test-${Date.now()}@example.com`
const testPassword = 'password123456'

test.describe('Threshold gauges and alerts', () => {
  test.beforeAll(async ({ browser }) => {
    // Register a test user
    const page = await browser.newPage()
    await page.goto('/register')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.fill('input[name="first_name"]', 'Claire')
    await page.fill('input[name="last_name"]', 'Bernard')
    await page.fill('input[name="siret"]', '11122233344455')
    await page.fill('input[name="address"]', '10 avenue des Seuils')
    await page.fill('input[name="city"]', 'Toulouse')
    await page.fill('input[name="postal_code"]', '31000')
    // Company created this year for prorata testing
    await page.fill('input[name="company_created_at"]', `${new Date().getFullYear()}-01-01`)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    await page.close()
  })

  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('register page has company_created_at field for prorata threshold calculation', async ({
    page,
  }) => {
    await page.goto('/register')
    const companyDate = page.locator('input[name="company_created_at"]')
    await expect(companyDate).toBeVisible()
  })

  test('dashboard shows threshold gauge section after login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    // Wait for dashboard to load
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(1500)

    // Threshold section must be present — look for Franchise TVA or similar labels
    const thresholdSection = page.locator(
      'text=Franchise TVA, text=Micro-entreprise, text=seuil, [data-testid="threshold-gauges"]',
    )
    await expect(thresholdSection.first()).toBeVisible({ timeout: 5000 })
  })

  test('threshold gauges are visible on dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.waitForTimeout(1500)

    // Gauge elements (progress bars or custom gauge components) should be present
    const gauges = page.locator(
      '[role="progressbar"], [data-testid="gauge"], .gauge, svg circle[stroke-dasharray]',
    )
    // At least one gauge should be visible
    await expect(gauges.first()).toBeVisible({ timeout: 5000 })
  })

  test('at 0% revenue, thresholds are in safe (green) state', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.waitForTimeout(1500)

    // A new user with 0 revenue should NOT show warning or danger alerts
    const dangerAlert = page.locator('text=Seuil TVA dépassé, text=Seuil dépassé, [data-testid="danger-alert"]')
    const warningAlert = page.locator('text=Attention au seuil TVA, text=Attention au seuil, [data-testid="warning-alert"]')

    // These should not be visible at 0% usage
    expect(await dangerAlert.count()).toBe(0)
    expect(await warningAlert.count()).toBe(0)
  })

  test('dashboard displays metric cards with revenue figures', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.waitForTimeout(1500)

    // Dashboard should show at least some metric cards
    const metricCards = page.locator('[data-testid="metric-card"], .metric-card, [class*="metric"]')
    const revenueText = page.locator('text=CA encaissé, text=Chiffre d\'affaires, text=En attente')

    const hasMetrics = (await metricCards.count()) > 0 || (await revenueText.count()) > 0
    expect(hasMetrics).toBe(true)
  })
})
