import type { ApplyResult, ApplyAttemptContext } from "./types";
import { getEffectiveCoverLetter } from "./types";

const LOG_PREFIX = "[GreenhouseApply]";

function log(step: string, detail?: string): void {
  const msg = detail ? `${LOG_PREFIX} ${step} | ${detail}` : `${LOG_PREFIX} ${step}`;
  console.log(msg);
}

/**
 * Only allow standard Greenhouse apply pages: boards.greenhouse.io or grnh.se.
 */
function isStandardGreenhouseUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === "boards.greenhouse.io" || host === "grnh.se";
  } catch {
    return false;
  }
}

/** Standard phrases that indicate application was received (thank-you page). */
const SUCCESS_PHRASES = [
  "thank you for applying",
  "application received",
  "thanks for your application",
  "application submitted",
  "we've received your application",
  "your application has been submitted"
];

/**
 * Greenhouse apply handler. Supports boards.greenhouse.io and grnh.se.
 * Fills standard fields, detects missing required fields and validation errors,
 * and only marks success when thank-you page or clear confirmation is detected.
 */
export async function applyWithGreenhouse(ctx: ApplyAttemptContext): Promise<ApplyResult> {
  const { job, profile } = ctx;
  const jobUrl = (job.url ?? "").trim();

  if (!jobUrl) {
    log("skipped", "no URL");
    return { success: false, needsReview: true, failureReason: "No job URL" };
  }

  if (!isStandardGreenhouseUrl(jobUrl)) {
    log("skipped", "non-standard URL");
    return {
      success: false,
      needsReview: true,
      failureReason: "Invalid or non-Greenhouse URL (only boards.greenhouse.io and grnh.se are supported)"
    };
  }

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      log("page opened", jobUrl);
      await page.goto(jobUrl, { waitUntil: "networkidle", timeout: 25000 });
      await page.waitForTimeout(2000);

      const captchaFrame = await page
        .locator('iframe[src*="captcha"], iframe[title*="recaptcha"], [data-sitekey]')
        .first()
        .isVisible()
        .catch(() => false);
      if (captchaFrame) {
        log("needs_review reason", "Captcha detected");
        await browser.close();
        return { success: false, needsReview: true, failureReason: "Captcha detected; manual apply required" };
      }

      const applySelector =
        'a[href*="apply"], button:has-text("Apply"), a:has-text("Apply for this job"), button:has-text("Submit your application")';
      const applyLink = page.locator(applySelector).first();
      const applyVisible = await applyLink.isVisible().catch(() => false);
      if (applyVisible) {
        await applyLink.click();
        await page.waitForTimeout(2000);
      } else {
        const formVisible = await page
          .locator('form[action*="greenhouse"], form[id*="application"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (!formVisible) {
          log("needs_review reason", "Apply link or form not found");
          await browser.close();
          return { success: false, needsReview: true, failureReason: "Apply link or form not found" };
        }
      }

      // --- Fields detected (log) ---
      const fieldChecks: [string[], string][] = [
        [['input[name*="name"]', 'input[name*="first"]', 'input[name*="last"]', 'input[name*="full_name"]'], "full name"],
        [['input[name*="first"]', 'input[name*="first_name"]'], "first name"],
        [['input[name*="last"]', 'input[name*="last_name"]'], "last name"],
        [['input[type="email"]', 'input[name*="email"]'], "email"],
        [['input[type="tel"]', 'input[name*="phone"]'], "phone"],
        [['input[name*="linkedin"]', 'input[placeholder*="LinkedIn"]'], "LinkedIn"],
        [['input[name*="github"]', 'input[placeholder*="GitHub"]'], "GitHub"],
        [['input[name*="portfolio"]', 'input[name*="website"]', 'input[placeholder*="portfolio"]'], "portfolio / website"],
        [['input[type="file"]'], "resume upload"],
        [['textarea[name*="cover"]', 'textarea[name*="message"]', 'textarea[placeholder*="cover"]'], "cover letter"]
      ];
      const detected: string[] = [];
      for (const [selectors, label] of fieldChecks) {
        for (const sel of selectors) {
          if (await page.locator(sel).first().isVisible().catch(() => false)) {
            detected.push(label);
            break;
          }
        }
      }
      log("fields detected", detected.length ? detected.join(", ") : "none");

      const fill = async (selectors: string[], value: string, label: string): Promise<boolean> => {
        if (!value || !value.trim()) return false;
        for (const sel of selectors) {
          const el = page.locator(sel).first();
          if (await el.isVisible().catch(() => false)) {
            await el.fill(value).catch(() => {});
            log("fields filled", label);
            return true;
          }
        }
        return false;
      };

      // Full name
      const nameSelectors = [
        'input[name*="full_name"]',
        'input[name*="name"]:not([name*="first"]):not([name*="last"])',
        'input[placeholder*="name" i]',
        'input[id*="name"]:not([id*="first"]):not([id*="last"])'
      ];
      await fill(nameSelectors, profile.fullName, "full name");
      const firstPart = profile.fullName.split(/\s+/)[0] ?? profile.fullName;
      const lastPart = profile.fullName.split(/\s+/).slice(1).join(" ") || firstPart;
      await fill(['input[name*="first"]', 'input[name*="first_name"]'], firstPart, "first name");
      await fill(['input[name*="last"]', 'input[name*="last_name"]'], lastPart, "last name");

      await fill(['input[type="email"]', 'input[name*="email"]'], profile.email, "email");
      await fill(['input[type="tel"]', 'input[name*="phone"]'], profile.phone, "phone");
      await fill(['input[name*="linkedin"]', 'input[placeholder*="LinkedIn"]'], profile.linkedinUrl, "LinkedIn");
      await fill(['input[name*="github"]', 'input[placeholder*="GitHub"]'], profile.githubUrl, "GitHub");
      await fill(
        ['input[name*="portfolio"]', 'input[name*="website"]', 'input[placeholder*="portfolio"]'],
        profile.portfolioUrl,
        "portfolio / website"
      );

      // Resume upload
      let resumeUploaded = false;
      if (profile.resumeFilePath && profile.resumeFilePath.trim()) {
        const fileInputs = await page.locator('input[type="file"]').all();
        // First file input is typically resume
        const resumeInput = fileInputs[0];
        if (resumeInput) {
          const visible = await resumeInput.isVisible().catch(() => false);
          if (visible) {
            try {
              await resumeInput.setInputFiles(profile.resumeFilePath);
              resumeUploaded = true;
              log("resume uploaded", profile.resumeFilePath);
            } catch {
              log("needs_review reason", "Resume upload failed");
              await browser.close();
              return { success: false, needsReview: true, failureReason: "Resume upload failed" };
            }
          }
        }
      }

      // Cover letter textarea
      const coverLetter = getEffectiveCoverLetter(profile);
      if (coverLetter) {
        const coverSelectors = [
          'textarea[name*="cover"]',
          'textarea[placeholder*="cover"]',
          'textarea[id*="cover"]',
          'textarea[name*="message"]',
          'textarea[placeholder*="message"]'
        ];
        for (const sel of coverSelectors) {
          const el = page.locator(sel).first();
          if (await el.isVisible().catch(() => false)) {
            await el.fill(coverLetter).catch(() => {});
            log("cover letter used", "textarea filled");
            break;
          }
        }
      }

      // Required checkboxes: try to check common consent/agreement checkboxes
      const requiredCheckboxes = await page
        .locator('input[type="checkbox"][required]:not(:checked), .required input[type="checkbox"]:not(:checked)')
        .all();
      for (const cb of requiredCheckboxes) {
        const visible = await cb.isVisible().catch(() => false);
        if (visible) {
          const labelText = await cb.evaluate((el) => {
            const id = (el as HTMLInputElement).id;
            if (id) {
              const label = document.querySelector(`label[for="${id}"]`);
              if (label) return (label.textContent ?? "").trim().slice(0, 50);
            }
            const parent = (el as HTMLInputElement).closest("label");
            if (parent) return (parent.textContent ?? "").trim().slice(0, 50);
            return "";
          }).catch(() => "");
          // Try checking; if it's a custom "I agree to X" we might not have a safe default
          await cb.check().catch(() => {});
        }
      }
      const stillRequiredCheckbox = await page
        .locator('input[type="checkbox"][required]:not(:checked), .required input[type="checkbox"]:not(:checked)')
        .first()
        .isVisible()
        .catch(() => false);
      if (stillRequiredCheckbox) {
        log("needs_review reason", "Required checkbox not handled");
        await browser.close();
        return { success: false, needsReview: true, failureReason: "Required checkbox not handled" };
      }

      // Required custom dropdowns (we don't fill arbitrary selects)
      const requiredSelects = await page.locator('select[required], .required select, [data-required="true"] select').all();
      for (const sel of requiredSelects) {
        const visible = await sel.isVisible().catch(() => false);
        if (!visible) continue;
        const value = await sel.evaluate((e) => (e as HTMLSelectElement).value).catch(() => "");
        if (!value || !value.trim()) {
          log("needs_review reason", "Unsupported required custom question");
          await browser.close();
          return { success: false, needsReview: true, failureReason: "Unsupported required custom question" };
        }
      }

      // Required fields: detect missing before submit and log which blocked
      const requiredEls = await page
        .locator('input[required]:not([type="file"]), textarea[required], select[required]')
        .all();
      for (const el of requiredEls) {
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;
        const tag = await el.evaluate((e) => (e as HTMLElement).tagName).catch(() => "INPUT");
        let value = "";
        if (tag === "SELECT") {
          value = await el.evaluate((e) => (e as HTMLSelectElement).value).catch(() => "");
        } else {
          value = await el.evaluate((e) => ((e as HTMLInputElement | HTMLTextAreaElement).value ?? "")).catch(() => "");
        }
        if (!value || !String(value).trim()) {
          const label = await el
            .evaluate((e) => {
              const id = (e as HTMLInputElement).id;
              if (id) {
                const labelEl = document.querySelector(`label[for="${id}"]`);
                if (labelEl) return (labelEl.textContent ?? "").trim().slice(0, 60);
              }
              const name = (e as HTMLInputElement).name || (e as HTMLInputElement).getAttribute("aria-label") || "";
              const placeholder = (e as HTMLInputElement).placeholder || "";
              return name || placeholder || "unknown field";
            })
            .catch(() => "unknown field");
          log("needs_review reason", `Required field not filled: ${label}`);
          await browser.close();
          return {
            success: false,
            needsReview: true,
            failureReason: `Unsupported required custom question (required field: ${label})`
          };
        }
      }

      // Validation errors after fill (before submit)
      const validationSelectors = '.field-error, .error, .invalid, [aria-invalid="true"], .form-error, [class*="error"]';
      const validationEl = page.locator(validationSelectors).first();
      const hasValidationError = await validationEl.isVisible().catch(() => false);
      if (hasValidationError) {
        const errorText = await validationEl.textContent().catch(() => "").then((t) => (t ?? "").trim().slice(0, 80));
        log("needs_review reason", `Validation error remained after fill: ${errorText || "see page"}`);
        await browser.close();
        return {
          success: false,
          needsReview: true,
          failureReason: "Validation error remained after fill"
        };
      }

      // Submit button
      const submitBtn = page.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply"), a:has-text("Submit application")'
      ).first();
      const hasSubmit = await submitBtn.isVisible().catch(() => false);
      if (!hasSubmit) {
        log("needs_review reason", "Submit button not found");
        await browser.close();
        return { success: false, needsReview: true, failureReason: "Submit button not found" };
      }

      log("submit attempted", "clicking submit");
      await submitBtn.click();

      // Success detection: thank-you page, application received text, or success URL
      const successRegex = new RegExp(
        SUCCESS_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
        "i"
      );
      const navPromise = page.waitForNavigation({ waitUntil: "networkidle", timeout: 14000 }).then(() => "navigated" as const).catch(() => null);
      const textPromise = page.getByText(successRegex).first().waitFor({ timeout: 14000 }).then(() => "success-text" as const).catch(() => null);
      const urlPromise = page
        .waitForFunction(
          () => {
            const h = window.location.href.toLowerCase();
            return h.includes("thank") || h.includes("success") || h.includes("received");
          },
          { timeout: 10000 }
        )
        .then(() => "success-url" as const)
        .catch(() => null);

      const outcome = await Promise.race([navPromise, textPromise, urlPromise]);

      const formStillVisible = await page
        .locator('form[action*="greenhouse"], form[id*="application"]')
        .first()
        .isVisible()
        .catch(() => false);
      const hasSuccessText = outcome === "success-text" || (await page.getByText(successRegex).first().isVisible().catch(() => false));
      const url = page.url();
      const isThankYouUrl = /thank|success|received/.test(url.toLowerCase());

      if (hasSuccessText || isThankYouUrl || (outcome && !formStillVisible)) {
        log("success detected", outcome ?? (hasSuccessText ? "success-text" : isThankYouUrl ? "success-url" : "form gone"));
        await browser.close();
        return { success: true };
      }

      // Submit was attempted but success unclear: check for validation errors first
      const validationAfterSubmit = await page.locator(validationSelectors).first().isVisible().catch(() => false);
      const failureReason = validationAfterSubmit
        ? "Validation error remained after fill"
        : "Success confirmation not detected";

      log("needs_review reason", failureReason);
      await browser.close();
      return { success: false, needsReview: true, failureReason };
    } finally {
      await browser.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("needs_review reason", msg);
    return { success: false, needsReview: true, failureReason: msg };
  }
}
