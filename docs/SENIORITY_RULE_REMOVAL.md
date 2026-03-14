# Seniority rule removal (auto-apply)

Senior-level jobs are **no longer blocked** by the rules engine. They can be auto-queued and auto-applied like any other job when they meet URL, score threshold, and other rules.

## Where the senior rule was applied (and removed)

### 1. Rules engine (`src/services/rules/rulesEngine.ts`)

- **Before:** If the job was senior-level (title contained senior/lead/principal/staff/architect/head of) and `match.score < AUTO_APPLY_SCORE_THRESHOLD`, the engine added a blocking reason: `Senior level role (score X below auto-apply threshold Y)` and returned `eligible: false`, which led to `applicationStatus = "skipped_rules"`.
- **After:** The senior-level block was **removed**. The engine no longer adds any reason based on seniority. It only logs that seniority does not block (`Rules: seniority not blocking | title=...`) and then evaluates eligibility on cooldown, job age, missing skills, unsupported role types, and location only.
- **Logging:** Every evaluation logs `Rules: evaluated | eligible=... reasons=[...] seniorityNeverBlocks=true`. For senior-level jobs it also logs `Rules: seniority not blocking | title="..." company="..." (senior-level jobs allowed by policy)`.

### 2. Scoring (`src/services/scoring.ts`)

- **Unchanged.** Seniority is still used only as a **scoring penalty** (−15 when "Job targets senior level (above your level)"). This affects the match **score** only; it does not set `skipped_rules` or `failureReason`. So senior roles can still have a lower score, but they are never blocked by rules for being senior.

### 3. Other code paths

- **Queue eligibility, auto-queue, ingestion, backfill, apply agent:** They all call `evaluateJobForAutoApply()`. None had separate seniority logic. Now that the rules engine no longer blocks on seniority, none of these paths can mark a job as skipped_rules for seniority.

## What exact code was changed

| File | Change |
|------|--------|
| `src/services/rules/rulesEngine.ts` | Removed `getApplyConfig` import. Removed the block that added `Senior level role (score X below auto-apply threshold Y)` when `isSeniorLevelJob(job)` and `score < threshold`. Replaced with a log: senior-level jobs get `Rules: seniority not blocking | ...`. Added final log: `Rules: evaluated | eligible=... reasons=[...] seniorityNeverBlocks=true`. |
| `src/services/rules/rulesConfig.ts` | Added `isSeniorityOnlyFailureReason(reason)` to detect existing `failureReason` values that were set only due to the old senior rule (for repair). Kept `isSeniorLevelJob()` for logging and debug. |
| `src/services/jobService.ts` | Added `recheckSkippedRulesMatchesForSeniority(userId)`: finds matches with `applicationStatus === "skipped_rules"` and `isSeniorityOnlyFailureReason(failureReason)`, re-runs rules + URL resolution, and updates to `queued` (with `queuedAt`) or `ready_for_review` and clears `failureReason`. |
| `src/app/api/debug/recheck-match/route.ts` | New POST endpoint. Body: `{ matchId?: string, jobTitle?: string, repair?: boolean }`. Returns rule evaluation, reasons, `seniorityBlocked: false`, and `finalStatusAfterRecompute`. If `repair: true`, runs `recheckSkippedRulesMatchesForSeniority` and returns `repairResult: { updated, queued, readyForReview }`. |

## How old skipped records were repaired

1. **Detection:** `isSeniorityOnlyFailureReason(failureReason)` is true when `failureReason` contains:
   - `"senior level role"`, or
   - `"above your level"`, or
   - `"below auto-apply threshold"` and `"senior"`.

2. **Repair:** `recheckSkippedRulesMatchesForSeniority(user)`:
   - Finds all matches for the user with `applicationStatus === "skipped_rules"` and seniority-only `failureReason`.
   - For each: loads job, runs `evaluateJobForAutoApply` (no senior block), gets intended status from score + `getAutoQueueIntendedStatus`, resolves URL with `resolveQueueStatusByUrl`.
   - If resolved status is `queued` and rules are eligible → sets `applicationStatus: "queued"`, `queuedAt: now`, `failureReason: null`.
   - Otherwise → sets `applicationStatus: "ready_for_review"`, `failureReason: null`.

3. **How to run repair:**
   - **POST /api/debug/recheck-match** with body `{ "repair": true }`. Returns `{ ok: true, repairResult: { updated, queued, readyForReview } }`.

## Debug endpoint: POST /api/debug/recheck-match

- **Body:** `{ matchId?: string, jobTitle?: string, repair?: boolean }`.
- **Examples:**
  - Recheck one match: `{ "matchId": "..." }` or `{ "jobTitle": "Software Engineer, Fullstack - Figma Weave (Tel Aviv, Israel)" }`.
  - Repair all seniority-only skipped_rules: `{ "repair": true }`.
  - Repair then recheck one: `{ "repair": true, "jobTitle": "..." }`.
- **Response (single recheck):** `rulesResult` (eligible, status, reasons), `seniorityBlocked: false`, `seniorLevelJob`, `previousFailureWasSeniorityOnly`, `intendedStatusFromScore`, `resolvedStatusByUrl`, `finalStatusAfterRecompute`.

## Eligibility after change (what can still block)

- Supported apply URL (and provider).
- Score threshold (handled by queue/backfill/ingestion; rules engine does not block by score).
- Company cooldown.
- Job age (max days).
- Missing skills (max count).
- Unsupported role types (title substrings: Frontend only, Designer, QA, Marketing — **Senior is not in the list**).
- Location (Israel, Remote preferred).
- **Seniority never blocks.**
