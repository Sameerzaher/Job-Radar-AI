# Company Memory / Application History

Company Memory tracks application history per company and role so the system can make smarter decisions, avoid duplicate applications, enforce cooldowns, and provide analytics.

## Data model

- **Model:** `CompanyMemory` (see `src/models/CompanyMemory.ts`)
- **Fields:** `userId`, `normalizedCompanyName`, `displayCompanyName`, `lastAppliedAt`, `lastAppliedRole`, `lastApplyProfileId`, `lastApplyProfileName`, `totalApplications`, `totalApplied`, `totalFailed`, `totalNeedsReview`, `totalRejected`, `totalSkippedRules`, `totalSkippedUnsupported`, `lastOutcome`, `notes`, `createdAt`, `updatedAt`
- **Index:** Unique on `(userId, normalizedCompanyName)` for fast lookups and upserts.

## How companies are normalized

Company names are normalized so variants like "Figma", "Figma, Inc.", and "figma" map to one key.

- **Utility:** `src/lib/companyNormalization.ts`
- **`normalizeCompanyName(displayName)`:** Trim, lowercase, remove common suffixes (Inc., Ltd., LLC, Corp., GmbH, etc.), collapse spaces. Used as the unique key per user+company.
- **`displayCompanyName(displayName)`:** Keeps the original form for UI; we store the latest seen display name on the record.

## When memory is updated

Company memory is updated whenever a Match’s application status is set to one of:

- `applied`
- `failed`
- `needs_review`
- `rejected`
- `skipped_rules`
- `skipped_unsupported`

**Update flow:**

1. **Apply agent** (`src/services/autoApply/applyAgent.ts`): After each Match status update to one of the above, `recordApplicationOutcome` is called with userId, company, job title, outcome, and (when relevant) apply profile and `appliedAt`.
2. **Auto-queue** (`src/services/autoApply/autoQueue.ts`): When a match is set to `skipped_rules`, outcome is recorded.
3. **Job service** (`rejectMatch`): When a match is rejected, outcome `rejected` is recorded.

The service **upserts** by `(userId, normalizedCompanyName)`: it increments the right outcome counter, sets `lastAppliedAt` / `lastAppliedRole` / `lastApplyProfileId` / `lastApplyProfileName` / `lastOutcome`, and updates `displayCompanyName`.

## How rules use company history

- **Rules engine:** `src/services/rules/rulesEngine.ts`
- **Cooldown:** Before evaluating other rules, the engine loads companies on cooldown via `getCompaniesOnCooldownForUser(userId, companyCooldownDays)`. The job’s company is normalized; if it’s in that set, the job is blocked with a “Company cooldown” reason. Cooldown is based on `lastAppliedAt` (successful “applied” outcome) and `AUTO_APPLY_COMPANY_COOLDOWN_DAYS`.
- **Fallback:** If CompanyMemory has no row for a company, the engine still uses the existing Match-based cooldown (recent matches with `applicationStatus: "applied"`), so behavior stays correct for data created before Company Memory.
- **Logs:** When any company is on cooldown, the rules engine logs “company memory loaded in rules evaluation”. When the current job is blocked by cooldown from company memory, it logs “cooldown triggered from company history”.

## How the UI shows company history

- **Job details** (`/jobs/[id]`): If there is a CompanyMemory row for the job’s company, a “Company application history” panel shows last applied at, last role, last outcome, profile used, total applications, and counts (applied / failed / needs review).
- **Review queue** (`/review`): Each review item can show a “Company history” line: last applied date, last outcome, profile used, total applications (when available).
- **Operations** (`/operations/auto-apply`): An “Applications by company memory” table lists companies with total applications, last outcome, applied success rate, and last applied at (from CompanyMemory).
- **Jobs list filters:** Optional “Company history” filter: “With prior applications”, “Never applied to”, or “On cooldown” (uses the same cooldown window as the rules engine).

## Backward compatibility and safety

- If no CompanyMemory exists for a company, the system still works: cooldown can be enforced via Match-based checks; UI simply shows no history.
- Company memory is created **lazily** on the first relevant event (first time we record an outcome for that user+company).
- All status updates that trigger recording are already in place; no change to when matches are applied, failed, or skipped.

## Logging

- **Company memory updated:** `[JobRadar] CompanyMemory: updated company=… outcome=… totalApplications=…` (in `companyMemoryService.recordApplicationOutcome`).
- **Cooldown triggered from company history:** `[JobRadar] Rules: cooldown triggered from company history | company="…" normalized="…"`.
- **Company memory loaded in rules:** `[JobRadar] Rules: company memory loaded in rules evaluation | companiesOnCooldown=N` (when there is at least one company on cooldown).
