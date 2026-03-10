import { getOpenAIClient, isOpenAIAvailable } from "@/lib/openai";
import type { IJob } from "@/models/Job";

export interface AIResumeTailoringResult {
  summary: string;
  bulletPoints: string[];
  coverLetter: string;
}

function buildTailoringContext(job: IJob, resumeText: string): string {
  return [
    `JOB TITLE: ${job.title ?? ""}`,
    `COMPANY: ${job.company ?? ""}`,
    `LOCATION: ${job.location ?? ""}`,
    "",
    "JOB DESCRIPTION:",
    job.description ?? "(No description provided)",
    "",
    "CANDIDATE RESUME:",
    resumeText
  ].join("\n");
}

const SYSTEM_PROMPT = `You are a senior technical recruiter and career coach.
Given a specific job description and a candidate's resume (plain text), tailor their application materials.

Respond with a JSON object ONLY (no markdown, no code fences) with EXACTLY these keys:
- summary: string (2-4 sentences summarizing how this candidate fits this specific role)
- bulletPoints: string[] (3-8 strong, tailored resume bullet points focused on this role; avoid first person; each bullet <= 200 characters)
- coverLetter: string (short, focused cover letter draft in first person; 3-5 short paragraphs, <= 600 words)`;

export async function tailorResumeForJob(
  job: IJob,
  resumeText: string
): Promise<AIResumeTailoringResult> {
  if (!isOpenAIAvailable()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env to enable AI tailoring.");
  }

  const openai = getOpenAIClient();
  const userMessage = buildTailoringContext(job, resumeText);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    temperature: 0.5,
    max_tokens: 1200
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty response from OpenAI for resume tailoring");
  }

  const parsed = JSON.parse(content) as unknown;
  const bulletsRaw = (parsed as { bulletPoints?: unknown }).bulletPoints;
  const bulletPoints =
    Array.isArray(bulletsRaw) && bulletsRaw.length
      ? (bulletsRaw as unknown[]).filter((b): b is string => typeof b === "string")
      : [];

  return {
    summary: String((parsed as { summary?: string }).summary ?? ""),
    bulletPoints,
    coverLetter: String((parsed as { coverLetter?: string }).coverLetter ?? "")
  };
}

