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

   **First implementation uses Greenhouse only.** Sync fetches from public Greenhouse boards (see `src/config/sourceRegistry.ts`), normalizes URLs to absolute, and saves only jobs with valid external URLs. Console logs: jobs fetched, jobs saved, jobs skipped, and real URLs captured.

   **Manual sync (recommended for testing):**

   - **Dashboard:** Click **Sync now** on the dashboard (Job ingestion pipeline card).
   - **API:** `POST /api/admin/sync` (optional `x-api-key` header if `ADMIN_API_KEY` is set):

   ```bash
   curl -X POST http://localhost:3000/api/admin/sync
   ```

   **Scheduled:** `npm run sync:cron` (runs sync on a schedule).

   After sync, the jobs table shows only real jobs; **Open Job** opens the real posting URL in a new tab.

6. **Remove old demo/fake jobs (one-time)**

   Before or after switching to real ingestion, remove seeded/sample jobs (and their Match records) that have no valid external URL:

   ```bash
   npm run cleanup:jobs
   ```

   Run this once to clear demo data; then run sync so the jobs table displays only real Greenhouse jobs.

7. **Verifying real jobs**

   - **MongoDB:** Inspect `jobs` collection: `url` should be `https://boards.greenhouse.io/...` (or similar). No `example.com`, `#`, or empty URLs.
   - **UI:** On `/jobs`, each row’s **Open Job** button should open the real job posting in a new tab.

8. **Playwright scraper (optional)**  
   Install Chromium once: `npm run scraper:install`. Set `SCRAPER_CAREERS_URL` in `.env` to a real careers page URL (not the sample). Sync will include it only when the URL is set and not localhost/sample.

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
  - Daily/weekly email or in-app digest of new high-match jobs and status changes.

This repo gives you a solid, typed foundation (models, services, scoring, and minimal UI) to iterate quickly on ingest, ranking, and personalization.***
