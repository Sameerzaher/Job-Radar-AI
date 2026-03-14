/**
 * Test fixtures for auto-apply routing verification.
 * Used by POST /api/debug/test-auto-apply-routing to simulate rules + URL classification.
 */

export type TestFixtureJob = {
  _id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  url?: string;
  externalUrl?: string;
  postedAt?: Date | string | null;
  foundAt?: Date | string | null;
};

export type TestFixtureMatch = {
  missingSkills?: string[];
  applicationStatus?: string;
};

/** For simulation: companies to treat as "applied recently" (cooldown). */
export type TestFixtureSimulation = {
  appliedCompanyNames?: string[];
};

export type TestFixture = {
  name: string;
  description: string;
  job: TestFixtureJob;
  match: TestFixtureMatch;
  simulation?: TestFixtureSimulation;
  /** Expected outcome from routing (rules + URL only; applied/needs_review come from handler). */
  expectedStatus: "eligible" | "skipped_rules" | "skipped_unsupported" | "needs_review" | "applied";
  /** Optional: expected rule reason substring or URL classification. */
  expectedReasonSubstring?: string;
};

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

export const AUTO_APPLY_TEST_FIXTURES: TestFixture[] = [
  {
    name: "supported_greenhouse_good_match",
    description: "Supported Greenhouse URL + good match => eligible / queued",
    job: {
      _id: "fixture-1",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "Acme Corp",
      location: "Remote",
      url: "https://boards.greenhouse.io/acme/jobs/123456"
    },
    match: { missingSkills: [] },
    expectedStatus: "eligible"
  },
  {
    name: "greenhouse_custom_careers_page",
    description: "Greenhouse source but custom careers page URL => skipped_unsupported",
    job: {
      _id: "fixture-2",
      source: "Greenhouse",
      title: "Backend Developer",
      company: "OtherCo",
      location: "Israel",
      url: "https://jobs.otherco.com/careers/backend"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_unsupported",
    expectedReasonSubstring: "Unsupported careers page"
  },
  {
    name: "old_job_posting",
    description: "Job posted > 7 days ago => skipped_rules",
    job: {
      _id: "fixture-3",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "OldCo",
      location: "Remote",
      url: "https://boards.greenhouse.io/oldco/jobs/789",
      postedAt: daysAgo(14)
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "older than"
  },
  {
    name: "same_company_applied_recently",
    description: "Same company applied to within 30 days => skipped_rules",
    job: {
      _id: "fixture-4",
      source: "Greenhouse",
      title: "Backend Developer",
      company: "CoolCompany",
      location: "Remote",
      url: "https://boards.greenhouse.io/coolcompany/jobs/111"
    },
    match: { missingSkills: [] },
    simulation: { appliedCompanyNames: ["CoolCompany"] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "Company cooldown"
  },
  {
    name: "unsupported_role_frontend_only",
    description: "Frontend-only role => skipped_rules",
    job: {
      _id: "fixture-5",
      source: "Greenhouse",
      title: "Frontend only Developer",
      company: "UI Inc",
      location: "Remote",
      url: "https://boards.greenhouse.io/uiinc/jobs/222"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "Unsupported role"
  },
  {
    name: "unsupported_role_qa",
    description: "QA role => skipped_rules",
    job: {
      _id: "fixture-6",
      source: "Lever",
      title: "QA Engineer",
      company: "TestCo",
      location: "Remote",
      url: "https://jobs.lever.co/testco/abc123"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "Unsupported role"
  },
  {
    name: "unsupported_role_designer",
    description: "Designer role => skipped_rules",
    job: {
      _id: "fixture-7",
      source: "Greenhouse",
      title: "Product Designer",
      company: "DesignCo",
      location: "Israel",
      url: "https://boards.greenhouse.io/designco/jobs/333"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "Unsupported role"
  },
  {
    name: "greenhouse_unsupported_custom_fields",
    description: "Greenhouse page with unsupported required custom fields => needs_review (handler outcome)",
    job: {
      _id: "fixture-8",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "ComplexCo",
      location: "Remote",
      url: "https://boards.greenhouse.io/complexco/jobs/444"
    },
    match: { missingSkills: [] },
    expectedStatus: "eligible",
    expectedReasonSubstring: undefined
  },
  {
    name: "successful_standard_greenhouse_apply",
    description: "Standard Greenhouse apply => applied (handler outcome)",
    job: {
      _id: "fixture-9",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "StandardCo",
      location: "Remote",
      url: "https://grnh.se/abc123"
    },
    match: { missingSkills: [] },
    expectedStatus: "eligible"
  },
  {
    name: "invalid_url",
    description: "Missing or invalid URL => skipped_unsupported",
    job: {
      _id: "fixture-10",
      source: "Greenhouse",
      title: "Backend Developer",
      company: "NoUrlCo",
      location: "Remote",
      url: ""
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_unsupported"
  },
  {
    name: "unknown_provider",
    description: "LinkedIn / unknown source => skipped_unsupported",
    job: {
      _id: "fixture-11",
      source: "LinkedIn",
      title: "Full Stack Developer",
      company: "AnyCo",
      location: "Remote",
      url: "https://www.linkedin.com/jobs/view/123"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_unsupported"
  },
  {
    name: "too_many_missing_skills",
    description: "Too many missing skills => skipped_rules",
    job: {
      _id: "fixture-12",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "SkillCo",
      location: "Remote",
      url: "https://boards.greenhouse.io/skillco/jobs/555"
    },
    match: { missingSkills: ["Kubernetes", "Go", "Rust", "ML", "GraphQL", "gRPC"] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "missing skills"
  },
  {
    name: "location_outside_preferred",
    description: "Location not Israel/Remote => skipped_rules",
    job: {
      _id: "fixture-13",
      source: "Greenhouse",
      title: "Full Stack Developer",
      company: "NYC Co",
      location: "New York, NY",
      url: "https://boards.greenhouse.io/nycco/jobs/666"
    },
    match: { missingSkills: [] },
    expectedStatus: "skipped_rules",
    expectedReasonSubstring: "Location"
  }
];

/** Resolve job URL for classifier (same as applyAgent). */
export function getFixtureJobUrl(job: TestFixtureJob): string | null {
  const candidate = job.url ?? (job as { externalUrl?: string }).externalUrl ?? null;
  if (candidate == null || String(candidate).trim() === "") return null;
  return candidate as string;
}
