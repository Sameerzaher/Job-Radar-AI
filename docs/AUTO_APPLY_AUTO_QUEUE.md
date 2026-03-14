# Auto-apply auto-queue (Greenhouse)

Eligible high-score Greenhouse jobs are **automatically** moved into the auto-apply queue (`applicationStatus = "queued"`) without any manual "Queue" or "Approve" step.

## Where automatic queueing runs

1. **Ingestion / sync** – When new jobs (and matches) are created or when a job’s URL is upgraded to a supported apply URL, the pipeline evaluates rules and sets status to `queued` (and `queuedAt`) when eligible, or `skipped_rules` when rules block.
2. **Backfill / rescoring** – When `backfillApplicationStatusFromScore` runs, it uses the same rules and threshold; matches that resolve to "queued" get `queued` + `queuedAt` if they pass rules.
3. **URL quality cleanup** – After cleanup (when not dry run), `autoQueueEligibleMatches(user)` runs so any match that is still `new` or `ready_for_review` and now eligible (e.g. job got a supported URL) is auto-queued.
4. **Worker start** – At the start of each auto-apply run, after backfill, `autoQueueEligibleMatches(user)` runs so any match that is still `new` or `ready_for_review` and eligible is queued in that run.

## Conditions that must be true for auto-queue

- `job.source === "Greenhouse"`
- `job.autoApplySupported === true`
- `job.urlClassification === "supported_apply_url"`
- `match.score >= AUTO_APPLY_SCORE_THRESHOLD` (from env)
- `match.applicationStatus` is `"new"` or `"ready_for_review"`
- Rules pass (company cooldown, job age, missing skills, etc.) via `evaluateJobForAutoApply`
- Not already applied (status is not `applied` / `failed` / etc.)

Only **Greenhouse** is auto-queued automatically; Lever and Workable remain `ready_for_review` unless explicitly enabled later.

## Why a job might stay "New" or "ready_for_review"

- **Provider** – Source is not Greenhouse (e.g. Lever, Workable).
- **Unsupported URL** – `urlClassification !== "supported_apply_url"` or `autoApplySupported !== true`.
- **Low score** – `match.score < AUTO_APPLY_SCORE_THRESHOLD`.
- **Rules** – Company cooldown, job too old, missing skills, or other rule reasons (status set to `skipped_rules` with a failure reason).
- **Status** – Already `queued`, `applied`, `failed`, `skipped_*`, etc.

## Changing the threshold

Set the env variable:

- **`AUTO_APPLY_SCORE_THRESHOLD`** – Minimum match score for auto-queue and for considering a match "eligible" (e.g. 80).

The app reads it via `getApplyConfig().autoApplyScoreThreshold` and uses it in ingestion, backfill, and `autoQueueEligibleMatch` consistently.

## Helper

- **`autoQueueEligibleMatch(match, job, user)`** – Checks provider, URL, threshold, and rules; if all pass, sets `applicationStatus = "queued"` and `queuedAt = new Date()`; if rules block, sets `skipped_rules` and logs. Used by `autoQueueEligibleMatches` and can be used from ingestion/backfill when resolving status to "queued".

## Metrics (dashboard / operations)

- **Auto-queued today** – Matches with `applicationStatus = "queued"` and `queuedAt >= start of today`.
- **Greenhouse auto-queued today** – Same, restricted to jobs with `source === "Greenhouse"`.
- **Last run: blocked by threshold** – From the latest "Auto-queue pass" activity log: `details.skippedByLowScore`.
- **Last run: blocked by rules** – From the latest "Auto-queue pass" activity log: `details.skippedByRules`.
