import { getOpenAIClient, isOpenAIAvailable } from "@/lib/openai";
import type { IJob } from "@/models/Job";
import type { IUser } from "@/models/User";

export type AIRecommendation = "apply" | "maybe" | "skip";

export interface AIJobAnalysis {
  summary: string;
  whyItMatches: string;
  missingSkills: string[];
  recommendation: AIRecommendation;
}

function buildUserProfileSummary(user: IUser): string {
  const parts = [
    `Target roles: ${(user.targetRoles ?? []).join(", ") || "Not specified"}`,
    `Skills: ${(user.skills ?? []).join(", ") || "Not specified"}`,
    `Preferred locations: ${(user.preferredLocations ?? []).join(", ") || "Not specified"}`,
    `Work modes: ${(user.workModes ?? []).join(", ") || "Not specified"}`,
    `Seniority: ${user.seniority ?? "Not specified"}`,
    (user.excludedKeywords ?? []).length > 0
      ? `Excluded keywords: ${(user.excludedKeywords ?? []).join(", ")}`
      : ""
  ];
  return parts.filter(Boolean).join("\n");
}

function buildJobContext(job: IJob): string {
  return [
    `Title: ${job.title ?? ""}`,
    `Company: ${job.company ?? ""}`,
    `Location: ${job.location ?? ""}`,
    `Description:\n${job.description ?? "(No description)"}`,
    (job.skillsExtracted ?? []).length > 0
      ? `Mentioned skills: ${(job.skillsExtracted ?? []).join(", ")}`
      : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SYSTEM_PROMPT = `You are a career coach helping a developer evaluate job postings. Given a job description and the candidate's profile, analyze the fit and respond with a JSON object only (no markdown, no code block wrapper) with exactly these keys:
- summary: string (2-4 sentences summarizing the role and main requirements)
- whyItMatches: string (2-4 sentences explaining why this job fits the candidate's profile, or why it might not)
- missingSkills: array of strings (skills/tools the job needs that the candidate did not list; empty array if none)
- recommendation: one of "apply" | "maybe" | "skip" (apply = strong fit, maybe = possible fit with gaps, skip = poor fit)`;

export async function analyzeJobWithAI(job: IJob, user: IUser): Promise<AIJobAnalysis> {
  if (!isOpenAIAvailable()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env to enable AI analysis.");
  }

  const openai = getOpenAIClient();
  const userProfile = buildUserProfileSummary(user);
  const jobContext = buildJobContext(job);

  const userMessage = `Candidate profile:\n${userProfile}\n\n---\n\nJob posting:\n${jobContext}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    temperature: 0.3,
    max_tokens: 800
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content) as unknown;
  const rec = (parsed as { recommendation?: string }).recommendation;
  const validRec = rec === "apply" || rec === "maybe" || rec === "skip" ? rec : "maybe";

  return {
    summary: String((parsed as { summary?: string }).summary ?? ""),
    whyItMatches: String((parsed as { whyItMatches?: string }).whyItMatches ?? ""),
    missingSkills: Array.isArray((parsed as { missingSkills?: unknown }).missingSkills)
      ? (parsed as { missingSkills: string[] }).missingSkills.filter((s) => typeof s === "string")
      : [],
    recommendation: validRec
  };
}
