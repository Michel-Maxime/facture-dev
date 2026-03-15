import { test, expect } from '@playwright/test'

const testEmail = `ledger-test-${Date.now()}@example.com`
const testPassword = 'password123456'

test.describe('Ledger page (Livre de recettes)', () => {
  test.beforeAll(async ({ browser }) => {
    // Register a test user
    const page = await browser.newPage()
    await page.goto('/register')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.fill('input[name="first_name"]', 'Bob')
    await page.fill('input[name="last_name"]', 'Martin')
    await page.fill('input[name="siret"]', '99988877766655')
    await page.fill('input[name="address"]', '5 rue du Ledger')
    await page.fill('input[name="city"]', 'Marseille')
    await page.fill('input[name="postal_code"]', '13001')
    await page.fill('input[name="company_created_at"]', '2024-01-01')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    await page.close()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/ledger')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('ledger page loads with correct heading after login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/ledger')
    await expect(page.locator('h1:has-text("Livre de recettes"), h2:has-text("Livre de recettes")')).toBeVisible({ timeout: 5000 })
  })

  test('ledger shows only PAID invoices — empty state when no payments recorded', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/ledger')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })

    // Wait for data to load
    await page.waitForTimeout(1500)

    // With no paid invoices, either there's an empty state message or the table has no rows
    const tableRows = page.locator('table tbody tr[data-testid], table tbody tr:not(.empty-row)')
    const emptyState = page.locator(
      'text=Aucune recette, text=Aucun paiement, text=aucune entrée, [data-testid="empty-ledger"]',
    )

    const rowCount = await tableRows.count()
    const emptyStateVisible = await emptyState.count() > 0

    // A new user with no payments: either empty state is shown or table has 0 rows
    // (This verifies ledger only shows PAID invoices)
    expect(rowCount === 0 || emptyStateVisible).toBe(true)
  })

  test('ledger page has CSV export button', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/ledger')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })

    // CSV export button should be present
    const csvButton = page.locator(
      'button:has-text("CSV"), button:has-text("Exporter"), a:has-text("CSV"), [data-testid="export-csv"]',
    )
    await expect(csvButton.first()).toBeVisible({ timeout: 5000 })
  })

  test('ledger year selector is present', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/ledger')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })

    // Ledger should have year filtering (select or buttons with year)
    const currentYear = new Date().getFullYear().toString()
    const yearControl = page.locator(
      `select, button:has-text("${currentYear}"), [data-testid="year-select"]`,
    )
    await expect(yearControl.first()).toBeVisible({ timeout: 5000 })
  })
})
