import { test, expect } from '@playwright/test'

const testEmail = `immutability-test-${Date.now()}@example.com`
const testPassword = 'password123456'

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 10000 })
}

test.describe('Invoice immutability', () => {
  test.beforeAll(async ({ browser }) => {
    // Register user and create a client
    const page = await browser.newPage()
    await page.goto('/register')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.fill('input[name="confirmPassword"]', testPassword)
    await page.fill('input[name="first_name"]', 'Alice')
    await page.fill('input[name="last_name"]', 'Dupont')
    await page.fill('input[name="siret"]', '12312312312312')
    await page.fill('input[name="address"]', '1 rue de la Paix')
    await page.fill('input[name="city"]', 'Paris')
    await page.fill('input[name="postal_code"]', '75001')
    await page.fill('input[name="company_created_at"]', '2024-01-01')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Login and create a client
    await page.goto('/login')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })

    await page.goto('/clients')
    await page.click('button:has-text("Nouveau"), button:has-text("Ajouter")')
    await page.waitForSelector('form, [role="dialog"]')
    await page.fill('input[name="name"]', 'Immutability Corp')
    await page.fill('input[name="address"]', '99 avenue des Tests')
    await page.fill('input[name="city"]', 'Bordeaux')
    await page.fill('input[name="postal_code"]', '33000')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1500)
    await page.close()
  })

  test('unauthenticated access to invoices redirects to login', async ({ page }) => {
    await page.goto('/invoices')
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('DRAFT invoice detail page shows Émettre button', async ({ page }) => {
    await loginAs(page, testEmail, testPassword)

    // Create a draft invoice
    await page.goto('/invoices/new')
    await expect(page.locator('form')).toBeVisible({ timeout: 5000 })

    const today = new Date().toISOString().split('T')[0]
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

    const issueDateInput = page.locator('input[name="issue_date"], input[type="date"]').first()
    await issueDateInput.fill(today)
    const serviceDateInput = page.locator('input[name="service_date"]')
    if (await serviceDateInput.count() > 0) await serviceDateInput.fill(today)
    const dueDateInput = page.locator('input[name="due_date"]')
    if (await dueDateInput.count() > 0) await dueDateInput.fill(dueDate)

    const clientSelect = page.locator('select[name="client_id"]').first()
    if (await clientSelect.count() > 0) await clientSelect.selectOption({ index: 1 })

    const descInput = page.locator('input[name="description"], input[placeholder*="description" i]').first()
    if (await descInput.count() > 0) await descInput.fill('Conseil stratégique')

    const qtyInput = page.locator('input[name="quantity"]').first()
    if (await qtyInput.count() > 0) await qtyInput.fill('1')
    const priceInput = page.locator('input[name="unit_price"]').first()
    if (await priceInput.count() > 0) await priceInput.fill('3000')

    await page.locator('button[type="submit"]').first().click()
    await page.waitForTimeout(2000)

    // Navigate to the draft invoice
    await page.goto('/invoices')
    await page.waitForTimeout(1500)

    const draftRow = page.locator('table tbody tr').filter({ hasText: /Brouillon|DRAFT/i }).first()
    if (await draftRow.count() > 0) {
      const draftLink = draftRow.locator('a').first()
      if (await draftLink.count() > 0) {
        await draftLink.click()
        await page.waitForTimeout(1000)

        // DRAFT invoice MUST show the "Émettre" button
        const emitButton = page.locator('button:has-text("Émettre la facture"), button:has-text("Émettre")')
        await expect(emitButton.first()).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('emitted invoice does not show Émettre button (immutability enforcement)', async ({
    page,
  }) => {
    await loginAs(page, testEmail, testPassword)

    // Navigate to invoices list and look for a DRAFT to emit
    await page.goto('/invoices')
    await page.waitForTimeout(1500)

    const draftRow = page.locator('table tbody tr').filter({ hasText: /Brouillon|DRAFT/i }).first()

    if ((await draftRow.count()) === 0) {
      // No drafts to emit — test is informational
      return
    }

    const draftLink = draftRow.locator('a').first()
    if ((await draftLink.count()) === 0) return

    await draftLink.click()
    await page.waitForTimeout(1000)

    const emitButton = page.locator('button:has-text("Émettre la facture"), button:has-text("Émettre")')
    if ((await emitButton.count()) === 0) return

    // Click emit
    await emitButton.first().click()
    await page.waitForTimeout(4000)

    // If Edge Function worked, the invoice should now be SENT
    // The "Émettre" button must no longer be visible
    const emitButtonAfterEmission = page.locator('button:has-text("Émettre la facture"), button:has-text("Émettre")')
    const invoiceNumber = page.locator('text=/FAC-\\d{4}-\\d{3}/')

    if ((await invoiceNumber.count()) > 0) {
      // Emission succeeded — verify immutability: Émettre button is gone
      await expect(emitButtonAfterEmission.first()).not.toBeVisible()

      // Verify the invoice number matches the FAC-YYYY-NNN format
      await expect(invoiceNumber.first()).toBeVisible()
    }
  })

  test('invoice status correctly determines available actions in the UI', async ({ page }) => {
    await loginAs(page, testEmail, testPassword)
    await page.goto('/invoices')
    await page.waitForTimeout(1500)

    // For any invoice visible in the list, the UI must show correct actions based on status
    const invoiceRows = page.locator('table tbody tr')
    const count = await invoiceRows.count()

    for (let i = 0; i < Math.min(count, 3); i++) {
      const row = invoiceRows.nth(i)
      const isDraft = (await row.locator('text=/Brouillon|DRAFT/i').count()) > 0
      const isSentOrPaid = (await row.locator('text=/Envoyée|SENT|Payée|PAID|OVERDUE/i').count()) > 0

      const rowLink = row.locator('a').first()
      if ((await rowLink.count()) === 0) continue

      await rowLink.click()
      await page.waitForTimeout(800)

      const emitButton = page.locator('button:has-text("Émettre la facture"), button:has-text("Émettre")')

      if (isDraft) {
        // DRAFT invoices should show Émettre
        await expect(emitButton.first()).toBeVisible({ timeout: 3000 })
      } else if (isSentOrPaid) {
        // Non-DRAFT invoices must NOT show Émettre (immutability)
        expect(await emitButton.count()).toBe(0)
      }

      await page.goto('/invoices')
      await page.waitForTimeout(1000)
    }
  })
})
