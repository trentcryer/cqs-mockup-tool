/**
 * Runs once before all tests. Logs in and saves the session cookie
 * so each test doesn't need to re-authenticate.
 *
 * Requires env vars:
 *   TEST_EMAIL    — a valid studio account email
 *   TEST_PASSWORD — its password
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SESSION_FILE = path.join(__dirname, '.auth/session.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD

  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD env vars are required for E2E tests')
  }

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Wait until redirected away from /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })

  // Persist storage state so tests reuse this session
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
  await page.context().storageState({ path: SESSION_FILE })
})
