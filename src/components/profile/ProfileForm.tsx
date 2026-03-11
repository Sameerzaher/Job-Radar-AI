"use client";

import { useState, FormEvent } from "react";
import type { IUser } from "@/models/User";
import { SectionCard, Button } from "@/components/ui";

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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        resumeText: resumeText.trim() || undefined
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

