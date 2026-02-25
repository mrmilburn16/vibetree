#!/usr/bin/env node
/**
 * Captures screenshots of the onboarding flow.
 * Run: npx playwright test scripts/onboarding-screenshots.mjs
 * Or: node scripts/onboarding-screenshots.mjs (uses Playwright's node API)
 *
 * Requires: npm install -D @playwright/test
 * Then: npx playwright install chromium
 */

import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "[REDACTED]";
const OUTPUT_DIR = process.env.SCREENSHOT_DIR || "onboarding-screenshots";

async function captureScreenshot(page, name) {
  const dir = join(process.cwd(), OUTPUT_DIR);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  Screenshot: ${path}`);
}

async function main() {
  console.log(`Opening ${BASE_URL}...`);
  const browser = await chromium.launch({ headless: process.env.HEADLESS !== "0" });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: "en-US",
  });
  const page = await context.newPage();

  try {
    // 1. Landing page
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await captureScreenshot(page, "01-landing");

    // 2. Click "Get started" -> redirects to sign-in when not logged in
    await page.getByRole("link", { name: "Get started" }).first().click();
    await page.waitForURL(/sign-in|sign-up|dashboard/);
    await page.waitForTimeout(800);

    const url = page.url();
    if (url.includes("sign-in")) {
      await captureScreenshot(page, "02-sign-in");

      // 3. Go to sign up
      await page.getByRole("link", { name: "Sign up" }).click();
      await page.waitForURL(/sign-up/);
      await page.waitForTimeout(500);
      await captureScreenshot(page, "03-sign-up");

      // 4. Fill sign up form and submit
      await page.getByLabel("Email").fill("screenshot-test@example.com");
      await page.getByLabel("Password").fill("testpass123");
      await page.getByRole("button", { name: "Sign up" }).click();
      await page.waitForURL(/dashboard/);
      await page.waitForTimeout(800);
    }
    await captureScreenshot(page, "04-dashboard");

    // 5. Create project without pending prompt so Guided Mode shows (suggestion chips bypass it)
    const projectId = await page.evaluate(() => {
      const projects = JSON.parse(localStorage.getItem("vibetree-projects") || "[]");
      const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();
      projects.unshift({
        id,
        name: "Untitled app",
        bundleId: `com.vibetree.${id.replace(/^proj_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 40)}`,
        createdAt: now,
        updatedAt: now,
      });
      localStorage.setItem("vibetree-projects", JSON.stringify(projects));
      return id;
    });
    await page.goto(`${BASE_URL}/editor/${projectId}`);
    await page.waitForTimeout(2000); // Wait for editor and Guided Mode to load

    // 6. Guided Mode - Step 0: Describe your app
    await captureScreenshot(page, "05-guided-step-0-describe");

    // Fill description and go to next
    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 10000 });
    await textarea.fill("A fitness tracker with activity rings");
    await page.locator('button:has-text("Next"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(800);

    // 7. Guided Mode - Step 1: Visual style
    await page.waitForSelector('text=How should your app look?', { timeout: 5000 });
    await page.waitForTimeout(400);
    await captureScreenshot(page, "06-guided-step-1-visual-style");
    // Click first option pill (Plain & Simple) - it's in the options div after the heading
    const optionsSection = page.getByRole("heading", { name: "How should your app look?" }).locator("..").locator("..");
    await optionsSection.locator("button").first().click();
    await page.locator('button:has-text("Next"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(400);

    // 8. Guided Mode - Step 2: How many screens
    await captureScreenshot(page, "07-guided-step-2-screens");
    await page.getByText("A few screens (2-4)").click();
    await page.locator('button:has-text("Next"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(400);

    // 9. Guided Mode - Step 3: Colors
    await captureScreenshot(page, "08-guided-step-3-colors");
    await page.getByText("Cool tones").click();
    await page.locator('button:has-text("Next"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(400);

    // 10. Guided Mode - Step 4: Data storage
    await captureScreenshot(page, "09-guided-step-4-data-storage");
    await page.getByText("Save locally on device").click();
    await page.locator('button:has-text("Next"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(400);

    // 11. Guided Mode - Step 5: Device capabilities (last step for standard projects)
    await captureScreenshot(page, "10-guided-step-5-device-capabilities");
    await page.getByText("None of these").click();
    await page.locator('button:has-text("Build"):not([data-nextjs-dev-tools-button])').first().click();
    await page.waitForTimeout(1500); // Wait for chat to send

    // 12. Editor after guided mode complete (chat sent)
    await captureScreenshot(page, "11-editor-after-guided");

    console.log(`\nDone! Screenshots saved to ${OUTPUT_DIR}/`);
  } catch (err) {
    console.error("Error:", err.message);
    await page.screenshot({ path: join(process.cwd(), OUTPUT_DIR, "error.png") });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
