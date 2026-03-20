## Job Radar AI (MVP)

Minimal, production-ready MVP that stores software job listings, scores them against a user profile, and exposes a clean dashboard, jobs list, and editable profile – built with **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, and **MongoDB/Mongoose**.

### Folder structure

- **`src/app`**: App Router routes and layout
  - `layout.tsx`: Root shell, top nav, global styling
  - `page.tsx`: Redirects `/` → `/dashboard`
  - `/dashboard/page.tsx`: Overview cards (total jobs, new, high match, saved)
  - `/jobs/page.tsx`: Jobs table with scores
  - `/profile/page.tsx`: Editable user profile
- **`src/components`**: Reusable UI
  - `layout/AppShell.tsx`: Header + shell layout
  - `dashboard/StatCard.tsx`: Dashboard stat tiles
  - `jobs/JobsTable.tsx`: Responsive table/card jobs list
  - `profile/ProfileForm.tsx`: Client-side editable profile form
- **`src/lib`**
  - `db.ts`: MongoDB connection helper (Mongoose, with global cache)
- **`src/models`**
  - `User.ts`: User profile model (target roles, skills, locations, work modes, seniority)
  - `Job.ts`: Job listing model (title, company, location, source, score-related fields)
  - `Match.ts`: Match model (user, job, score, reasons)
- **`src/services`**
  - `scoring.ts`: Simple scoring utility that returns `{ score, reasons[] }`
  - `userService.ts`: Default user bootstrap + profile update helpers
  - `jobService.ts`: Fetch jobs with scores, create jobs and persist matches
- **`scripts`**
  - `seed.ts`: Seeds the default user profile and a few sample jobs
- **Root**
  - `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
  - `.env.example`: Example Mongo connection string

### Models & default user

- **`User`** (`src/models/User.ts`)
  - `targetRoles`: includes **Full Stack Developer**, **Backend Developer**
  - `skills`: `Node.js, React, Next.js, TypeScript, MongoDB, Docker`
  - `preferredLocations`: `Israel, Remote`
  - `workModes`: `Remote, Hybrid`
  - `seniority`: `"junior-mid"`
- **`Job`** (`src/models/Job.ts`): title, company, location, source, externalUrl, status, tags, timestamps, matches[]
- **`Match`** (`src/models/Match.ts`): user, job, score, reasons[], timestamps

The default user is created (if missing) in `getOrCreateDefaultUser()` inside `src/services/userService.ts` and used throughout dashboard/jobs/profile and seeding.

### Scoring

`src/services/scoring.ts` exposes:

- **`scoreJobForUser(job, user)`** → `{ score: number, reasons: string[] }`

Heuristics:

- Role match by loose inclusion of target role tokens in the job title
- Skill overlap between user skills and job title/tags
- Preferred location match (`Israel`, `Remote`, etc.)
- Work mode alignment (Remote/Hybrid hints in job vs user workModes)
- Seniority boost for `"junior-mid"` if the job title includes junior/mid-like words

The score is normalized to 0–100 and reasons are human-readable bullet-style strings surfaced in the service layer (and easy to show in future UI).  

### Pages

- **Dashboard (`/dashboard`)**
  - Fetches the default user and all jobs with scores
  - Shows stat cards for **total jobs**, **new jobs**, **high match jobs (score ≥ 70)**, and **saved jobs**
  - Includes a “coming next” panel describing live ingestion
- **Jobs (`/jobs`)**
  - Fetches jobs with scores and renders them via `JobsTable`
  - Desktop: full-width table with columns: title, company, location, source, score, status, external link
  - Mobile: stacked cards with compact details and a primary “View role” button
- **Profile (`/profile`)**
  - Server component loads default user
  - `ProfileForm` (client) edits:
    - name
    - target roles
    - skills
    - preferred locations
    - work modes
    - seniority
  - Uses a server action (`saveProfile`) with Zod validation to persist via `updateUserProfile`

No authentication or OpenAI calls are wired – the app is intentionally single-profile for this MVP.

### Running locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   - Copy `.env.example` → `.env`
   - Adjust `MONGODB_URI` if needed, e.g. for your local MongoDB instance.

3. **Seed the database (optional, development only)**

   Creates the default user and sample jobs (without real URLs; "Open Job" will show Unavailable):

   ```bash
   npm run seed
   ```

   For real jobs with real posting URLs, skip seed and run sync instead (step 5).

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   Then visit `http://localhost:3000` – you’ll be redirected to `/dashboard`. Use `/jobs` for the jobs table and `/profile` to tweak scoring preferences.

5. **Sync real jobs (production)**

   **Sources: Greenhouse + Lever.** Sync fetches from public boards (see `src/config/sourceRegistry.ts` and `src/config/publicBoards.ts`), normalizes URLs, and saves only jobs with valid external URLs.

   **Manual sync:**

   - **Dashboard:** Click **Sync now** (runs both Greenhouse and Lever).
   - **API (all sources):** `POST /api/admin/sync` or `GET/POST /api/sync/all` (optional `x-api-key` if `ADMIN_API_KEY` is set).
   - **API (per source):** `GET /api/sync/greenhouse`, `GET /api/sync/lever` for single-source sync.

   ```bash
   curl -X POST http://localhost:3000/api/admin/sync
   curl http://localhost:3000/api/sync/all
   curl http://localhost:3000/api/sync/lever
   ```

   **Scheduled:** `npm run sync:cron` (runs full sync on a schedule).

   After sync, the jobs table shows only real jobs; **Open Job** opens the real posting URL in a new tab. Filter by **Source** (e.g. Greenhouse, Lever) on the jobs page.

6. **Remove old demo/fake jobs (one-time)**

   Before or after switching to real ingestion, remove seeded/sample jobs (and their Match records) that have no valid external URL:

   ```bash
   npm run cleanup:jobs
   ```

   Run this once to clear demo data; then run sync so the jobs table displays only real jobs (Greenhouse and Lever).

7. **Verifying real jobs**

   - **MongoDB:** Inspect `jobs` collection: `url` should be real posting links (e.g. `https://boards.greenhouse.io/...` or `https://jobs.lever.co/...`). No `example.com`, `#`, or empty URLs. `source` will be `"Greenhouse"` or `"Lever"`.
   - **UI:** On `/jobs`, filter by Source (Greenhouse / Lever), and each row’s **Open Job** button opens the real posting in a new tab.

8. **Playwright scraper (optional)**  
   Install Chromium once: `npm run scraper:install`. Set `SCRAPER_CAREERS_URL` in `.env` to a real careers page URL (not the sample). Sync will include it only when the URL is set and not localhost/sample.

9. **Auto-apply and review queue**  
   - **Score rules:** score ≥ 90 → `queued` for auto-apply; 80–89 → `ready_for_review`; &lt; 80 → `new`.
   - **Review page:** `/review` lists jobs in ready_for_review, needs_review, failed. Actions: Approve (→ queued), Reject (→ rejected), Retry (→ queued), Open Job, View Details.
   - **Safety env:** `AUTO_APPLY_ENABLED`, `AUTO_APPLY_SCORE_THRESHOLD` (default 90), `REVIEW_SCORE_MIN` (80), `MAX_APPLICATIONS_PER_RUN`, `MAX_APPLICATIONS_PER_DAY`, `REQUIRE_REVIEW_FOR_SOURCES`, `DRY_RUN_DEFAULT`.
   - **Manual controls:** Dashboard has Sync all, Auto apply, Dry run, Retry failed. Activity log records sync/apply/review/telegram for metrics.

10. **Apply profiles (resume versions)**  
   Define multiple application profiles (e.g. Full Stack, Backend), each with its own resume, cover letter template, and targeting (roles, keywords, locations). The system selects the best profile per job for tailoring and auto-apply. See **docs/APPLY_PROFILES.md**.

11. **Digest (Telegram)**  
   Daily or on-demand summary of **new high-match jobs** and **status changes** (applied, failed, needs review) since the last digest.  
   - **Env:** `DIGEST_SCORE_THRESHOLD` (default 70), `DIGEST_HOURS` (default 24, used when no previous digest).  
   - **Run once:** `npm run digest` or `GET/POST /api/cron/digest` (optional `x-api-key` if `ADMIN_API_KEY` is set).  
   - **Schedule:** Use system cron (e.g. `0 9 * * *` for 9:00 daily) to call the API or run `npm run digest`.  
   - Activity log type `digest` records each run (success/failed/skipped).

### What to build next

- **Job ingestion pipeline**
  - Background worker or cron-like job that pulls from job boards / ATS APIs or parses provided links.
  - Normalize and upsert jobs into the `Job` collection, then call `createJobForUser` to maintain `Match` rows.
- **Richer scoring dimensions**
  - Include salary bands, tech stack depth vs breadth, company size, and domain preferences.
  - Persist per-dimension weights in the user profile so the radar is tunable.
- **Saved views and filters**
  - Quick filters for seniority, location, remote-only, score thresholds.
  - Saved searches or “focus modes” (e.g., “backend-only this week”).

- **Multi-user + auth**
  - Add sign-in, multi-profile support, and per-user job pipelines once the scoring feels right.

- **Notifications & digests**
  - Telegram digest is implemented (see §10); optional: email or in-app digest.

This repo gives you a solid, typed foundation (models, services, scoring, and minimal UI) to iterate quickly on ingest, ranking, and personalization.***
