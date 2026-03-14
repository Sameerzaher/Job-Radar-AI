import { NextRequest, NextResponse } from "next/server";
import { runTestRouting, fixtureToJobInput } from "@/services/autoApply/testRoutingService";
import { AUTO_APPLY_TEST_FIXTURES } from "@/services/autoApply/testFixtures";

/**
 * POST /api/debug/test-auto-apply-routing
 *
 * Simulates auto-apply evaluation (URL classification + rules) and returns
 * provider, hostname, rules result, final applicationStatus, and reasons
 * for each job. Does not run apply handlers.
 *
 * Body (optional):
 *   - useFixtures: boolean (default true) — run built-in test scenarios
 *   - jobs: array of { source, title, company, location, url?, postedAt?, missingSkills?, appliedCompanyNames? }
 *
 * When useFixtures is true and jobs is omitted, runs all AUTO_APPLY_TEST_FIXTURES.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { useFixtures?: boolean; jobs?: Array<Record<string, unknown>> } = {};
    try {
      const raw = await request.json();
      body = typeof raw === "object" && raw !== null ? raw : {};
    } catch {
      body = { useFixtures: true };
    }

    const useFixtures = body.useFixtures !== false;
    const customJobs = Array.isArray(body.jobs) ? body.jobs : [];

    const toRun: Array<{ scenarioName?: string; job: Parameters<typeof runTestRouting>[0][0]["job"] }> = [];

    if (useFixtures && customJobs.length === 0) {
      toRun.push(...AUTO_APPLY_TEST_FIXTURES.map((f) => fixtureToJobInput(f)));
    } else if (customJobs.length > 0) {
      toRun.push(
        ...customJobs.map((j, i) => ({
          scenarioName: `custom_${i}`,
          job: {
            source: String(j.source ?? ""),
            title: String(j.title ?? ""),
            company: String(j.company ?? ""),
            location: String(j.location ?? ""),
            url: j.url != null ? String(j.url) : null,
            externalUrl: j.externalUrl != null ? String(j.externalUrl) : null,
            postedAt: j.postedAt != null ? (typeof j.postedAt === "string" ? j.postedAt : new Date(j.postedAt as number)) : null,
            foundAt: j.foundAt != null ? (typeof j.foundAt === "string" ? j.foundAt : new Date(j.foundAt as number)) : null,
            missingSkills: Array.isArray(j.missingSkills) ? j.missingSkills.map(String) : undefined,
            appliedCompanyNames: Array.isArray(j.appliedCompanyNames) ? j.appliedCompanyNames.map(String) : undefined
          }
        }))
      );
    } else {
      toRun.push(...AUTO_APPLY_TEST_FIXTURES.map((f) => fixtureToJobInput(f)));
    }

    const result = await runTestRouting(toRun);

    return NextResponse.json({
      ok: true,
      message: useFixtures && customJobs.length === 0 ? "Ran built-in test fixtures" : "Ran provided jobs",
      items: result.items.map((item) => ({
        scenarioName: item.scenarioName,
        provider: item.provider,
        hostname: item.hostname,
        urlClassification: item.urlClassification,
        rulesResult: {
          eligible: item.rulesResult.eligible,
          status: item.rulesResult.status,
          reasons: item.rulesResult.reasons
        },
        finalApplicationStatus: item.finalApplicationStatus,
        reasons: item.reasons
      })),
      summary: result.summary
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[JobRadar] test-auto-apply-routing error:", message);
    return NextResponse.json(
      { ok: false, error: "Test routing failed", detail: message },
      { status: 500 }
    );
  }
}
