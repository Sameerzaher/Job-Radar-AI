import { getOpenAIClient, isOpenAIAvailable } from "@/lib/openai";
import { getTailoringConfig } from "@/config/tailoringConfig";
import type { IUser } from "@/models/User";

export interface TailorApplicationInput {
  userProfile: {
    name?: string;
    targetRoles?: string[];
    skills: string[];
    seniority?: string;
    preferredLocations?: string[];
    workModes?: string[];
    baseResumeText: string;
    defaultCoverLetterTemplate?: string;
    yearsOfExperience?: string;
    keyProjects?: string[];
    achievements?: string[];
  };
  jobTitle: string;
  company: string;
  location?: string;
  jobDescription: string;
  matchReasons: string[];
  matchedSkills: string[];
  missingSkills: string[];
}

export interface TailorApplicationOutput {
  resumeSummary: string;
  suggestedBulletPoints: string[];
  missingSkills: string[];
  strengths: string[];
  coverLetter: string;
  recruiterMessage: string;
}

const SYSTEM_PROMPT = `You are a professional career coach helping tailor application materials. You must stay truthful to the candidate's profile.

STRICT RULES:
- Only use facts from the candidate profile and resume. Do not invent experience, employers, or projects.
- Do not claim skills the candidate does not have. Missing skills must be listed separately and never presented as strengths.
- Clearly separate "strengths" (what the candidate has) from "missing skills" (what the job wants but the candidate did not list).
- Keep the cover letter concise and professional (3-5 short paragraphs, under 400 words).
- Recruiter message must be very short (1-3 sentences, under 200 chars) for InMail/LinkedIn style.
- Suggested bullet points: 4-8 items, each under 200 characters, past tense or impact-focused; only reflect real experience from the resume/profile.`;

function buildUserContext(input: TailorApplicationInput): string {
  const p = input.userProfile;
  const parts = [
    `Name: ${p.name ?? "Candidate"}`,
    `Target roles: ${(p.targetRoles ?? []).join(", ") || "Not specified"}`,
    `Skills (ONLY use these for strengths): ${p.skills.join(", ") || "None listed"}`,
    `Seniority: ${p.seniority ?? "Not specified"}`,
    `Preferred locations: ${(p.preferredLocations ?? []).join(", ") || "Not specified"}`,
    `Work modes: ${(p.workModes ?? []).join(", ") || "Not specified"}`,
    p.yearsOfExperience ? `Years of experience: ${p.yearsOfExperience}` : "",
    (p.keyProjects ?? []).length > 0
      ? `Key projects: ${p.keyProjects!.join("; ")}`
      : "",
    (p.achievements ?? []).length > 0
      ? `Achievements: ${p.achievements!.join("; ")}`
      : "",
    "",
    "BASE RESUME (use only this for experience and facts):",
    p.baseResumeText || "(No resume text provided)"
  ];
  if (p.defaultCoverLetterTemplate) {
    parts.push("", "Default cover letter template (optional tone):", p.defaultCoverLetterTemplate);
  }
  return parts.filter(Boolean).join("\n");
}

function buildJobAndMatchContext(input: TailorApplicationInput): string {
  return [
    "JOB:",
    `Title: ${input.jobTitle}`,
    `Company: ${input.company}`,
    input.location ? `Location: ${input.location}` : "",
    "",
    "JOB DESCRIPTION:",
    input.jobDescription,
    "",
    "MATCH REASONS:",
    input.matchReasons.join("\n"),
    "",
    "MATCHED SKILLS (candidate has these):",
    input.matchedSkills.join(", ") || "None",
    "",
    "MISSING SKILLS (job wants these; candidate did not list - do not claim these):",
    input.missingSkills.join(", ") || "None"
  ]
    .filter(Boolean)
    .join("\n");
}

export async function tailorApplicationWithAI(
  input: TailorApplicationInput
): Promise<TailorApplicationOutput> {
  const config = getTailoringConfig();
  if (!isOpenAIAvailable()) {
    return buildFallbackTailoring(input);
  }

  const openai = getOpenAIClient();
  const userContext = buildUserContext(input);
  const jobContext = buildJobAndMatchContext(input);

  const userMessage = `Candidate profile and resume:\n${userContext}\n\n---\n\n${jobContext}\n\nRespond with a single JSON object only (no markdown, no code fences) with exactly these keys:\n- resumeSummary: string (2-4 sentences, how candidate fits this role; only use profile facts)\n- suggestedBulletPoints: string[] (4-8 bullets, from real experience only)\n- missingSkills: string[] (skills job needs that candidate did not list; copy from input or subset)\n- strengths: string[] (skills/experience candidate has that align with job)\n- coverLetter: string (short professional cover letter, first person)\n- recruiterMessage: string (1-3 sentences, under 200 chars)`;

  try {
    const response = await openai.chat.completions.create({
      model: config.defaultAiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ],
      temperature: 0.4,
      max_tokens: 1600
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return buildFallbackTailoring(input);
    }

    const parsed = JSON.parse(content) as Record<string, unknown>;
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
    return {
      resumeSummary: String(parsed.resumeSummary ?? ""),
      suggestedBulletPoints: arr(parsed.suggestedBulletPoints).slice(0, 8),
      missingSkills: arr(parsed.missingSkills),
      strengths: arr(parsed.strengths),
      coverLetter: String(parsed.coverLetter ?? ""),
      recruiterMessage: String(parsed.recruiterMessage ?? "")
    };
  } catch {
    return buildFallbackTailoring(input);
  }
}

/** Deterministic fallback when AI is unavailable or fails. */
export function buildFallbackTailoring(
  input: TailorApplicationInput
): TailorApplicationOutput {
  const p = input.userProfile;
  const resumeSummary = [
    `${p.name ?? "Candidate"} has experience in ${(p.targetRoles ?? p.skills.slice(0, 3)).join(", ") || "software development"}.`,
    `Relevant skills for this role include: ${input.matchedSkills.slice(0, 5).join(", ") || "see resume"}.`
  ].join(" ");

  const suggestedBulletPoints = [
    ...(p.keyProjects ?? []).slice(0, 3).map((proj) => `Delivered ${proj}`),
    ...(p.achievements ?? []).slice(0, 2).map((a) => a),
    ...p.skills.slice(0, 3).map((s) => `Strong experience with ${s}`)
  ].slice(0, 6);

  const strengths = [...input.matchedSkills].slice(0, 8);
  const missingSkills = [...input.missingSkills];

  const coverLetter = [
    `Dear Hiring Team,`,
    ``,
    `I am writing to apply for the ${input.jobTitle} position at ${input.company}. My background in ${(p.targetRoles ?? []).join(", ") || "software development"} and experience with ${input.matchedSkills.slice(0, 3).join(", ") || "relevant technologies"} align well with this role.`,
    ``,
    p.baseResumeText
      ? `I have attached my resume for your review and would welcome the opportunity to discuss how I can contribute to your team.`
      : `I would welcome the opportunity to discuss my qualifications further.`,
    ``,
    `Best regards,`,
    p.name ?? "Candidate"
  ].join("\n");

  const recruiterMessage = `Hi, I applied for the ${input.jobTitle} role at ${input.company} and would love to connect. My experience with ${input.matchedSkills.slice(0, 2).join(" and ") || "this domain"} is a strong fit.`;

  return {
    resumeSummary,
    suggestedBulletPoints,
    missingSkills,
    strengths,
    coverLetter,
    recruiterMessage
  };
}

/** Build TailorApplicationInput from user, job, and match (for use by callers). */
export function buildTailorInput(
  user: IUser,
  job: { title?: string; company?: string; location?: string; description?: string },
  match: { reasons?: string[]; matchedSkills?: string[]; missingSkills?: string[] }
): TailorApplicationInput {
  const u = user as IUser & {
    baseResumeText?: string;
    defaultCoverLetterTemplate?: string;
    yearsOfExperience?: string;
    keyProjects?: string[];
    achievements?: string[];
    workModes?: string[];
  };
  const baseResume = (u.baseResumeText ?? u.resumeText ?? "").trim();
  return {
    userProfile: {
      name: u.name,
      targetRoles: u.targetRoles ?? [],
      skills: u.skills ?? [],
      seniority: u.seniority,
      preferredLocations: u.preferredLocations ?? [],
      workModes: u.workModes ?? [],
      baseResumeText: baseResume || "(No resume provided)",
      defaultCoverLetterTemplate: u.defaultCoverLetterTemplate,
      yearsOfExperience: u.yearsOfExperience,
      keyProjects: u.keyProjects ?? [],
      achievements: u.achievements ?? []
    },
    jobTitle: job.title ?? "",
    company: job.company ?? "",
    location: job.location,
    jobDescription: (job.description ?? "").trim(),
    matchReasons: match.reasons ?? [],
    matchedSkills: match.matchedSkills ?? [],
    missingSkills: match.missingSkills ?? []
  };
}
