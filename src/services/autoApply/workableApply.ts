import type { ApplyResult, ApplyAttemptContext } from "./types";
import { getEffectiveCoverLetter } from "./types";

/**
 * Workable apply handler. Opens job URL (apply.workable.com or similar),
 * fills profile fields, uploads resume/cover letter if provided, submits.
 */
export async function applyWithWorkable(ctx: ApplyAttemptContext): Promise<ApplyResult> {
  const { job } = ctx;
  const jobUrl = job.url ?? "";
  if (!jobUrl || !jobUrl.includes("workable")) {
    return { success: false, failureReason: "Invalid or non-Workable URL" };
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(2000);

      const applySelector = 'a:has-text("Apply"), button:has-text("Apply")';
      const applyVisible = await page.locator(applySelector).first().isVisible().catch(() => false);
      if (applyVisible) {
        await page.locator(applySelector).first().click();
        await page.waitForTimeout(2000);
      }

      const profile = ctx.profile;
      const fill = async (selector: string, value: string) => {
        if (!value) return;
        await page.locator(selector).first().fill(value).catch(() => {});
      };
      await fill('input[name*="name"], input[placeholder*="name"]', profile.fullName);
      await fill('input[type="email"], input[name*="email"]', profile.email);
      await fill('input[type="tel"], input[name*="phone"]', profile.phone);
      await fill('input[name*="linkedin"], input[placeholder*="LinkedIn"]', profile.linkedinUrl);
      await fill('input[name*="github"], input[placeholder*="GitHub"]', profile.githubUrl);
      await fill('input[name*="portfolio"], input[placeholder*="portfolio"]', profile.portfolioUrl);

      if (profile.resumeFilePath) {
        const fileInput = await page.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false)) {
          await fileInput.setInputFiles(profile.resumeFilePath).catch(() => {});
        }
      }
      const coverLetter = getEffectiveCoverLetter(profile);
      if (coverLetter) {
        const coverField = await page.locator('textarea[name*="cover"], textarea[placeholder*="cover"]').first();
        if (await coverField.isVisible().catch(() => false)) {
          await coverField.fill(coverLetter).catch(() => {});
        }
      }

      const submitBtn = await page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit")').first();
      const hasSubmit = await submitBtn.isVisible().catch(() => false);
      if (!hasSubmit) {
        await browser.close();
        return { success: false, needsReview: true, failureReason: "Submit button not found" };
      }
      await submitBtn.click();
      await page.waitForTimeout(3000);
      const stillOnForm = await page.locator('form').first().isVisible().catch(() => false);
      await browser.close();
      if (stillOnForm) {
        return { success: false, needsReview: true, failureReason: "Form may have validation errors or captcha" };
      }
      return { success: true };
    } finally {
      await browser.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, needsReview: true, failureReason: msg };
  }
}
