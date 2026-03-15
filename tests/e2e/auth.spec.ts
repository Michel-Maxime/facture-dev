import { test, expect } from '@playwright/test'

const testEmail = `test-${Date.now()}@example.com`
const testPassword = 'password123456'

test.describe('Authentication flow', () => {
  test('register → login → create client → see in list', async ({ page }) => {
    // 1. Navigate to register page
    await page.goto('/register')
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // 2. Fill registration form
    await page.fill('input[name="email"], input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.fill('input[name="first_name"]', 'Jean')
    await page.fill('input[name="last_name"]', 'Dupont')
    await page.fill('input[name="siret"]', '12345678901234')
    await page.fill('input[name="address"]', '1 rue de la Paix')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postal_code"]', '75001')
    await page.fill('input[name="company_created_at"]', '2024-01-01')

    // 3. Submit registration
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // 4. Navigate to login
    await page.goto('/login')
    await page.fill('input[name="email"], input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')

    // 5. Should be redirected to dashboard
    await page.waitForURL('/', { timeout: 10000 })
    await expect(page).toHaveURL('/')

    // 6. Navigate to clients
    await page.click('a[href="/clients"]')
    await page.waitForURL('/clients')

    // 7. Create a new client
    await page.click('button:has-text("Nouveau client"), button:has-text("Ajouter")')
    await page.waitForSelector('form, dialog, [role="dialog"]')

    await page.fill('input[name="name"]', 'Client Test SARL')
    await page.fill('input[name="address"]', '10 avenue des Tests')
    await page.fill('input[name="city"]', 'Lyon')
    await page.fill('input[name="postal_code"]', '69001')

    await page.click('button[type="submit"]:has-text("Enregistrer"), button[type="submit"]:has-text("Créer")')
    await page.waitForTimeout(1500)

    // 8. Verify client appears in list
    await expect(page.locator('text=Client Test SARL')).toBeVisible({ timeout: 5000 })
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/invoices')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
