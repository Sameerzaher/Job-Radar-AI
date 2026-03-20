# Apply Profiles (Resume Versions)

Apply profiles let you define multiple application personas (e.g. Full Stack, Backend, Platform), each with its own resume, cover letter template, keywords, and targeting. The system picks the best profile per job and uses it for tailoring and auto-apply.

## How apply profiles are stored

- **Model:** `ApplyProfile` in MongoDB (`applyprofiles` collection).
- **Fields:** `userId`, `name`, `isDefault`, `isActive`, `targetRoles`, `preferredKeywords`, `excludedKeywords`, `seniorityTargets`, `preferredLocations`, `remoteOnly`, `resumeFilePath`, `resumeText`, `coverLetterTemplate`, `recruiterMessageTemplate`, `createdAt`, `updatedAt`.
- **Relation:** Each profile belongs to one user (`userId`). A user can have many profiles.
- **Match / TailoredApplication:** When an application or tailoring run uses a profile, we store `applyProfileId` and `applyProfileName` on the Match and TailoredApplication for analytics and display.

## How the best profile is selected

- **Service:** `services/applyProfiles/selectApplyProfile.ts` → `selectBestApplyProfile(user, job, match)`.
- **Inputs:** User (to load active profiles), job (title, location, description, workMode, remoteSupport), match (for context).
- **Logic:**
  - If the user has no apply profiles, we return `useUserFallback: true` and the app uses the user-level resume/cover (backward compatibility).
  - Otherwise we score each **active** profile against the job:
    - **Target roles:** Job title vs `targetRoles` (e.g. "Full Stack" in title → +40).
    - **Preferred keywords:** Job description/title vs `preferredKeywords` (+up to 30).
    - **Excluded keywords:** If any `excludedKeywords` appear in title/description → −50.
    - **Seniority:** Job title/description vs `seniorityTargets` (junior/mid/senior) (+20 if match).
    - **Location / remote:** `preferredLocations` and `remoteOnly` vs job location/remote (+15 or −20).
    - **Default profile:** +5 so it is preferred when nothing else matches.
  - The profile with the highest score (and score > 0) is chosen. If none score > 0, we use the default profile or the first active one.
- **Output:** `{ selectedProfile, reasons, useUserFallback }`. Reasons are short strings (e.g. "Title matches target role", "Preferred keyword(s) matched") used in the UI.

## How to create a new profile

1. Go to **Apply profiles** in the sidebar (`/apply-profiles`).
2. Click **New profile**.
3. Fill in:
   - **Name** (e.g. "Full Stack", "Backend").
   - **Targeting:** Target roles, preferred/excluded keywords, seniority targets, locations, remote only.
   - **Resume & cover:** Resume file path (for uploads in apply flow), resume text (for AI tailoring), cover letter template, recruiter message template.
   - **Default** and **Active** as needed.
4. Click **Save**.

You can edit or delete profiles from the list, set one as default, and activate/deactivate without deleting.

## How profile selection affects tailoring and auto-apply

- **Tailoring:** When generating a tailored application (resume summary, bullet points, cover letter), we use the selected apply profile if available:
  - **Resume text** and **cover letter template** come from that profile (else from the user profile).
  - The chosen profile’s `_id` and `name` are stored on the `TailoredApplication` (`applyProfileId`, `applyProfileName`).
- **Auto-apply:** When the worker processes a queued/approved match:
  - It selects the best profile (or uses the match’s `selectedApplyProfileId` if the user overrode it on job details/review).
  - If the selected profile has **no resume file path**, the job is not auto-applied; it is moved to `ready_for_review` with failure reason: *"Selected apply profile has no resume configured"*.
  - Otherwise we build an application profile from that apply profile (resume path, cover template, recruiter message) and run the apply (Greenhouse/Lever/Workable). After apply we store `applyProfileId` and `applyProfileName` on the Match.

## Job details and review

- **Job details (`/jobs/[id]):** The page shows which apply profile would be selected and why. You can override the selection with a dropdown (e.g. "Auto (recommended)" or a specific profile). The override is saved on the Match (`selectedApplyProfileId`) and used in the next apply/tailoring.
- **Review queue:** Each item can show the apply profile name. To change it before approval, open the job details and set the override there.

## Operations and analytics

- On **Operations → Auto-apply** we show an **Applications by apply profile** table (when you have at least one application with a profile): applied, failed, needs_review, and success rate per profile name.

## Backward compatibility

- If a user has **no apply profiles**, behavior is unchanged: we use the user’s own `resumeFilePath`, `resumeText`, and `defaultCoverLetter` / `defaultCoverLetterTemplate` for tailoring and apply.
- You can optionally create one default profile from the current user fields via `createDefaultApplyProfileFromUser(user)` (e.g. from a migration or “Create from profile” action).
