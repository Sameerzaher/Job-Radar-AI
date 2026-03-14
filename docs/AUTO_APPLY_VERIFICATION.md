# Auto-apply verification and test layer

## Test cases (fixtures)

Built-in scenarios in `src/services/autoApply/testFixtures.ts` are run by **POST /api/debug/test-auto-apply-routing** (with no body or `{ "useFixtures": true }`).

| Scenario | Expected result | What is tested |
|----------|-----------------|----------------|
| **supported_greenhouse_good_match** | `eligible` | Supported Greenhouse URL (boards.greenhouse.io) + good match → queued for apply |
| **greenhouse_custom_careers_page** | `skipped_unsupported` | Greenhouse source but custom host (jobs.otherco.com) → URL classifier blocks |
| **old_job_posting** | `skipped_rules` | Job posted > 7 days ago → rules engine blocks |
| **same_company_applied_recently** | `skipped_rules` | Company in cooldown (simulated appliedCompanyNames) → rules engine blocks |
| **unsupported_role_frontend_only** | `skipped_rules` | Title contains "Frontend only" → unsupported role rule |
| **unsupported_role_qa** | `skipped_rules` | Title "QA Engineer" → unsupported role rule |
| **unsupported_role_designer** | `skipped_rules` | Title "Product Designer" → unsupported role rule |
| **greenhouse_unsupported_custom_fields** | `eligible` | URL + rules pass; *handler* would set needs_review for complex forms (not simulated here) |
| **successful_standard_greenhouse_apply** | `eligible` | Standard Greenhouse URL (grnh.se) + rules pass → would be applied by handler |
| **invalid_url** | `skipped_unsupported` | Empty URL → invalid, skipped |
| **unknown_provider** | `skipped_unsupported` | LinkedIn source → unsupported source |
| **too_many_missing_skills** | `skipped_rules` | missingSkills count > config → rules block |
| **location_outside_preferred** | `skipped_rules` | Location "New York, NY" (not Israel/Remote) → rules block |

## Debug endpoint

- **POST /api/debug/test-auto-apply-routing**
  - **Body (optional):**
    - `useFixtures: true` (default) — run all built-in fixtures.
    - `jobs: [...]` — run custom jobs (each: source, title, company, location, url?, postedAt?, missingSkills?, appliedCompanyNames?).
  - **Response:** For each job: `provider`, `hostname`, `urlClassification`, `rulesResult` (eligible, status, reasons), `finalApplicationStatus`, `reasons`. Plus **summary**: `eligible`, `skipped_rules`, `skipped_unsupported`, `needs_review`, `applied`.

## Decision-flow logs

When `verbose: true` (default in runAutoApply), every branch logs with a consistent prefix:

- `[JobRadar] decision: skip – tailoring required, moved to ready_for_review`
- `[JobRadar] decision: skip – source requires review approval first`
- `[JobRadar] decision: skip – unsupported source | provider: …`
- `[JobRadar] decision: skip – invalid or missing URL`
- `[JobRadar] decision: skip – unsupported URL | hostname: … | classification: …`
- `[JobRadar] decision: URL supported | hostname: … | provider: … | handler: …`
- `[JobRadar] decision: skip – already applied`
- `[JobRadar] decision: skip – no handler for source`
- `[JobRadar] decision: skip – rules blocked | <reason>`
- `[JobRadar] decision: queued for apply … | method: …`

## Operational checklist

On **/operations/auto-apply** the checklist shows:

1. **Live mode enabled** — AUTO_APPLY_ENABLED
2. **Dry run** — DRY_RUN_DEFAULT (if true, no real applications)
3. **Worker configured** — heartbeat present (run a cycle or start worker)
4. **Supported URL** — only official apply URLs are used (Greenhouse, Lever, Workable hosts)
5. **Resume path configured** — Profile resumeFilePath for uploads
6. **Telegram configured** — TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID

## How to verify the system is ready for automatic execution

1. **Run the test route:**  
   `POST /api/debug/test-auto-apply-routing` with no body (or `{ "useFixtures": true }`).  
   Check that the summary and each item match the expected outcomes above (e.g. supported_greenhouse_good_match → eligible, greenhouse_custom_careers_page → skipped_unsupported).

2. **Check the operational checklist** at **/operations/auto-apply**:  
   Live mode and dry run set as intended, worker heartbeat if you use one, resume path and Telegram if you want uploads and notifications.

3. **Run a dry run:**  
   `GET /api/debug/auto-apply?dryRun=true` (or run auto-apply with `dryRun: true`).  
   Inspect logs for `[JobRadar] decision:` lines and confirm queued/skipped counts and reasons.

4. **Enable live only when:**  
   Test route and dry run look correct, checklist is satisfied, and you are comfortable with the daily/run caps and rules (cooldown, job age, missing skills, role type, location).
