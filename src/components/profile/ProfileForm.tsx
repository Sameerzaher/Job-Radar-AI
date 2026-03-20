"use client";

import { useState, FormEvent } from "react";
import type { IUser, ScoreWeights } from "@/models/User";
import { SectionCard, Button } from "@/components/ui";

const DEFAULT_WEIGHT = 100;

type ProfileFormProps = {
  initialUser: IUser;
  onSave: (payload: {
    name: string;
    targetRoles: string[];
    skills: string[];
    preferredLocations: string[];
    workModes: string[];
    seniority: string;
    excludedKeywords?: string[];
    resumeText?: string;
    baseResumeText?: string;
    defaultCoverLetterTemplate?: string;
    yearsOfExperience?: string;
    keyProjects?: string[];
    achievements?: string[];
    phone?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    resumeFilePath?: string;
    defaultCoverLetter?: string;
    scoreWeights?: ScoreWeights;
    autoApplyBlacklistCompanies?: string[];
    autoApplyReviewRequiredCompanies?: string[];
  }) => Promise<void>;
};

export function ProfileForm({ initialUser, onSave }: ProfileFormProps) {
  const [name, setName] = useState(initialUser.name);
  const [targetRoles, setTargetRoles] = useState(
    initialUser.targetRoles.join(", ")
  );
  const [skills, setSkills] = useState(initialUser.skills.join(", "));
  const [preferredLocations, setPreferredLocations] = useState(
    initialUser.preferredLocations.join(", ")
  );
  const [workModes, setWorkModes] = useState(initialUser.workModes.join(", "));
  const [seniority, setSeniority] = useState(initialUser.seniority);
  const [excludedKeywords, setExcludedKeywords] = useState(
    (initialUser.excludedKeywords ?? []).join(", ")
  );
  const [resumeText, setResumeText] = useState(initialUser.resumeText ?? "");
  const userWithApp = initialUser as IUser & {
    phone?: string; linkedinUrl?: string; githubUrl?: string; portfolioUrl?: string; resumeFilePath?: string; defaultCoverLetter?: string;
    baseResumeText?: string; defaultCoverLetterTemplate?: string; yearsOfExperience?: string; keyProjects?: string[]; achievements?: string[];
    autoApplyBlacklistCompanies?: string[]; autoApplyReviewRequiredCompanies?: string[];
  };
  const [phone, setPhone] = useState(userWithApp.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(userWithApp.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(userWithApp.githubUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(userWithApp.portfolioUrl ?? "");
  const [resumeFilePath, setResumeFilePath] = useState(userWithApp.resumeFilePath ?? "");
  const [defaultCoverLetter, setDefaultCoverLetter] = useState(userWithApp.defaultCoverLetter ?? "");
  const [baseResumeText, setBaseResumeText] = useState(userWithApp.baseResumeText ?? "");
  const [defaultCoverLetterTemplate, setDefaultCoverLetterTemplate] = useState(userWithApp.defaultCoverLetterTemplate ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(userWithApp.yearsOfExperience ?? "");
  const [keyProjects, setKeyProjects] = useState((userWithApp.keyProjects ?? []).join("\n"));
  const [achievements, setAchievements] = useState((userWithApp.achievements ?? []).join("\n"));
  const userWeights = (initialUser as IUser & { scoreWeights?: ScoreWeights }).scoreWeights ?? {};
  const [titleMatchWeight, setTitleMatchWeight] = useState(
    String(userWeights.titleMatch ?? DEFAULT_WEIGHT)
  );
  const [skillMatchWeight, setSkillMatchWeight] = useState(
    String(userWeights.skillMatch ?? DEFAULT_WEIGHT)
  );
  const [locationMatchWeight, setLocationMatchWeight] = useState(
    String(userWeights.locationMatch ?? DEFAULT_WEIGHT)
  );
  const [remoteMatchWeight, setRemoteMatchWeight] = useState(
    String(userWeights.remoteMatch ?? DEFAULT_WEIGHT)
  );
  const [seniorityMatchWeight, setSeniorityMatchWeight] = useState(
    String(userWeights.seniorityMatch ?? DEFAULT_WEIGHT)
  );
  const [autoApplyBlacklist, setAutoApplyBlacklist] = useState(
    (userWithApp.autoApplyBlacklistCompanies ?? []).join(", ")
  );
  const [autoApplyReviewRequired, setAutoApplyReviewRequired] = useState(
    (userWithApp.autoApplyReviewRequiredCompanies ?? []).join(", ")
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function parseWeight(v: string): number {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(200, n)) : DEFAULT_WEIGHT;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await onSave({
        name: name.trim(),
        targetRoles: targetRoles
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        skills: skills
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        preferredLocations: preferredLocations
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        workModes: workModes
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        seniority,
        excludedKeywords: excludedKeywords
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        resumeText: resumeText.trim() || undefined,
        baseResumeText: baseResumeText.trim() || undefined,
        defaultCoverLetterTemplate: defaultCoverLetterTemplate.trim() || undefined,
        yearsOfExperience: yearsOfExperience.trim() || undefined,
        keyProjects: keyProjects.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
        achievements: achievements.split(/\n|,/).map((v) => v.trim()).filter(Boolean),
        phone: phone.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        githubUrl: githubUrl.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
        resumeFilePath: resumeFilePath.trim() || undefined,
        defaultCoverLetter: defaultCoverLetter.trim() || undefined,
        scoreWeights: {
          titleMatch: parseWeight(titleMatchWeight),
          skillMatch: parseWeight(skillMatchWeight),
          locationMatch: parseWeight(locationMatchWeight),
          remoteMatch: parseWeight(remoteMatchWeight),
          seniorityMatch: parseWeight(seniorityMatchWeight)
        },
        autoApplyBlacklistCompanies: autoApplyBlacklist
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
        autoApplyReviewRequiredCompanies: autoApplyReviewRequired
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      });
      setMessage("Profile updated");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard>
      <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Name</label>
        <input
          className="ds-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Resume (plain text)</label>
        <textarea
          className="ds-input h-40"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume text here for AI tailoring. Avoid sensitive personal data."
        />
        <p className="text-ds-caption text-slate-500">
          Job Radar AI uses this resume text to tailor summaries, bullet points, and cover letters to each job.
        </p>
      </div>

      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Base resume (tailoring)</label>
        <textarea
          className="ds-input h-24"
          value={baseResumeText}
          onChange={(e) => setBaseResumeText(e.target.value)}
          placeholder="Optional. If empty, Resume (plain text) above is used for tailoring."
        />
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Default cover letter template</label>
        <textarea className="ds-input h-20" value={defaultCoverLetterTemplate} onChange={(e) => setDefaultCoverLetterTemplate(e.target.value)} placeholder="Optional template or tone for AI-generated cover letters." />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Years of experience</label>
          <input className="ds-input" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} placeholder="e.g. 5" />
        </div>
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Key projects</label>
        <textarea className="ds-input h-20" value={keyProjects} onChange={(e) => setKeyProjects(e.target.value)} placeholder="One per line or comma-separated" />
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Achievements</label>
        <textarea className="ds-input h-20" value={achievements} onChange={(e) => setAchievements(e.target.value)} placeholder="One per line or comma-separated" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Target roles</label>
          <input
            className="ds-input"
            value={targetRoles}
            onChange={(e) => setTargetRoles(e.target.value)}
            placeholder="e.g. Full Stack Developer, Backend Developer"
          />
          <p className="text-ds-caption text-slate-500">Comma-separated. Used heavily in match scoring.</p>
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Skills</label>
          <input
            className="ds-input"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Node.js, React, Next.js, TypeScript, MongoDB, Docker"
          />
          <p className="text-ds-caption text-slate-500">Comma-separated. Matched loosely against job title and tags.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Preferred locations</label>
          <input
            className="ds-input"
            value={preferredLocations}
            onChange={(e) => setPreferredLocations(e.target.value)}
            placeholder="Israel, Remote"
          />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Work modes</label>
          <input
            className="ds-input"
            value={workModes}
            onChange={(e) => setWorkModes(e.target.value)}
            placeholder="Remote, Hybrid"
          />
          <p className="text-ds-caption text-slate-500">Example values: Remote, Hybrid, Onsite.</p>
        </div>
      </div>

      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Seniority</label>
        <select
          className="ds-input"
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
        >
          <option value="junior">Junior</option>
          <option value="junior-mid">Junior–Mid</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
        </select>
      </div>

      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Excluded keywords</label>
        <input
          className="ds-input"
          value={excludedKeywords}
          onChange={(e) => setExcludedKeywords(e.target.value)}
          placeholder="e.g. PHP, legacy, on-call"
        />
        <p className="text-ds-caption text-slate-500">Comma-separated. Jobs containing these get a score penalty.</p>
      </div>

      <h3 className="text-ds-body font-semibold text-slate-200 pt-4 border-t border-slate-700/60 mt-6">Score weights</h3>
      <p className="text-ds-caption text-slate-500">Adjust how much each dimension affects the match score. 100 = default, higher = dimension matters more (0–200).</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Title / role</label>
          <input
            type="number"
            min={0}
            max={200}
            className="ds-input w-20"
            value={titleMatchWeight}
            onChange={(e) => setTitleMatchWeight(e.target.value)}
          />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Skills</label>
          <input
            type="number"
            min={0}
            max={200}
            className="ds-input w-20"
            value={skillMatchWeight}
            onChange={(e) => setSkillMatchWeight(e.target.value)}
          />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Location</label>
          <input
            type="number"
            min={0}
            max={200}
            className="ds-input w-20"
            value={locationMatchWeight}
            onChange={(e) => setLocationMatchWeight(e.target.value)}
          />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Remote</label>
          <input
            type="number"
            min={0}
            max={200}
            className="ds-input w-20"
            value={remoteMatchWeight}
            onChange={(e) => setRemoteMatchWeight(e.target.value)}
          />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Seniority</label>
          <input
            type="number"
            min={0}
            max={200}
            className="ds-input w-20"
            value={seniorityMatchWeight}
            onChange={(e) => setSeniorityMatchWeight(e.target.value)}
          />
        </div>
      </div>

      <h3 className="text-ds-body font-semibold text-slate-200 pt-4 border-t border-slate-700/60 mt-6">Application profile (auto-apply)</h3>
      <p className="text-ds-caption text-slate-500">Used when auto-applying to Greenhouse, Lever, and Workable jobs. Name and email come from above.</p>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Do not auto-apply to these companies</label>
        <input
          className="ds-input"
          value={autoApplyBlacklist}
          onChange={(e) => setAutoApplyBlacklist(e.target.value)}
          placeholder="e.g. Company A, Company B"
        />
        <p className="text-ds-caption text-slate-500">Comma-separated. Jobs from these companies will never be auto-applied (skipped_rules).</p>
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Always require review before applying</label>
        <input
          className="ds-input"
          value={autoApplyReviewRequired}
          onChange={(e) => setAutoApplyReviewRequired(e.target.value)}
          placeholder="e.g. Big Corp, Startup Inc"
        />
        <p className="text-ds-caption text-slate-500">Comma-separated. Jobs from these companies go to Ready for review instead of auto-queue; you approve manually.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Phone</label>
          <input className="ds-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">LinkedIn URL</label>
          <input className="ds-input" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/you" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">GitHub URL</label>
          <input className="ds-input" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/you" />
        </div>
        <div className="space-y-ds-input-gap">
          <label className="text-ds-caption font-medium text-slate-500">Portfolio URL</label>
          <input className="ds-input" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://your-site.com" />
        </div>
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Resume file path (server)</label>
        <input className="ds-input" value={resumeFilePath} onChange={(e) => setResumeFilePath(e.target.value)} placeholder="/app/data/resume.pdf" />
        <p className="text-ds-caption text-slate-500">Absolute path on the server to your resume PDF for upload during auto-apply.</p>
      </div>
      <div className="space-y-ds-input-gap">
        <label className="text-ds-caption font-medium text-slate-500">Default cover letter</label>
        <textarea className="ds-input h-24" value={defaultCoverLetter} onChange={(e) => setDefaultCoverLetter(e.target.value)} placeholder="Optional default cover letter text for auto-apply." />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-ds-caption text-slate-500">{message && <span>{message}</span>}</div>
        <Button type="submit" variant="primary" size="md" disabled={saving}>
          {saving ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </form>
    </SectionCard>
  );
}

