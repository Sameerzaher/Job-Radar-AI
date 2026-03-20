"use client";

import { useState, FormEvent } from "react";
import type { IApplyProfile } from "@/models/ApplyProfile";
import { SectionCard, Button } from "@/components/ui";

export type ApplyProfileFormPayload = {
  name: string;
  isDefault?: boolean;
  targetRoles?: string[];
  preferredKeywords?: string[];
  excludedKeywords?: string[];
  seniorityTargets?: string[];
  preferredLocations?: string[];
  remoteOnly?: boolean;
  resumeFilePath?: string;
  resumeText?: string;
  coverLetterTemplate?: string;
  recruiterMessageTemplate?: string;
  isActive?: boolean;
};

function split(s: string): string[] {
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type Props = {
  initialProfile?: IApplyProfile | null;
  /** For create: (payload) => ... For edit: (payload, { profileId }) => ... */
  onSave: (payload: ApplyProfileFormPayload, meta?: { profileId: string }) => Promise<void>;
  cancelHref: string;
};

export function ApplyProfileForm({ initialProfile, onSave, cancelHref }: Props) {
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [isDefault, setIsDefault] = useState(initialProfile?.isDefault ?? false);
  const [targetRoles, setTargetRoles] = useState((initialProfile?.targetRoles ?? []).join(", "));
  const [preferredKeywords, setPreferredKeywords] = useState((initialProfile?.preferredKeywords ?? []).join(", "));
  const [excludedKeywords, setExcludedKeywords] = useState((initialProfile?.excludedKeywords ?? []).join(", "));
  const [seniorityTargets, setSeniorityTargets] = useState((initialProfile?.seniorityTargets ?? []).join(", "));
  const [preferredLocations, setPreferredLocations] = useState((initialProfile?.preferredLocations ?? []).join(", "));
  const [remoteOnly, setRemoteOnly] = useState(initialProfile?.remoteOnly ?? false);
  const [resumeFilePath, setResumeFilePath] = useState(initialProfile?.resumeFilePath ?? "");
  const [resumeText, setResumeText] = useState(initialProfile?.resumeText ?? "");
  const [coverLetterTemplate, setCoverLetterTemplate] = useState(initialProfile?.coverLetterTemplate ?? "");
  const [recruiterMessageTemplate, setRecruiterMessageTemplate] = useState(initialProfile?.recruiterMessageTemplate ?? "");
  const [isActive, setIsActive] = useState(initialProfile?.isActive !== false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: ApplyProfileFormPayload = {
        name: name.trim() || "Unnamed",
        isDefault,
        targetRoles: split(targetRoles),
        preferredKeywords: split(preferredKeywords),
        excludedKeywords: split(excludedKeywords),
        seniorityTargets: split(seniorityTargets),
        preferredLocations: split(preferredLocations),
        remoteOnly,
        resumeFilePath: resumeFilePath.trim() || undefined,
        resumeText: resumeText.trim() || undefined,
        coverLetterTemplate: coverLetterTemplate.trim() || undefined,
        recruiterMessageTemplate: recruiterMessageTemplate.trim() || undefined,
        isActive
      };
      const meta = initialProfile?._id ? { profileId: String(initialProfile._id) } : undefined;
      await onSave(payload, meta);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-ds-section">
      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Basic</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Name</label>
            <input
              type="text"
              className="ds-input mt-1 w-full max-w-md"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full Stack, Backend"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              <span className="text-sm text-slate-300">Default profile (used when no profile matches)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span className="text-sm text-slate-300">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
              <span className="text-sm text-slate-300">Remote only</span>
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Targeting</h2>
        <p className="mt-1 text-ds-caption text-slate-500">Used to select this profile for a job (role, keywords, location).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Target roles (comma-separated)</label>
            <input
              type="text"
              className="ds-input mt-1 w-full"
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              placeholder="Full Stack Developer, Backend"
            />
          </div>
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Seniority targets (comma)</label>
            <input
              type="text"
              className="ds-input mt-1 w-full"
              value={seniorityTargets}
              onChange={(e) => setSeniorityTargets(e.target.value)}
              placeholder="mid, senior"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-ds-caption font-medium text-slate-400">Preferred keywords (comma)</label>
            <input
              type="text"
              className="ds-input mt-1 w-full"
              value={preferredKeywords}
              onChange={(e) => setPreferredKeywords(e.target.value)}
              placeholder="Node.js, React, TypeScript"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-ds-caption font-medium text-slate-400">Excluded keywords (comma)</label>
            <input
              type="text"
              className="ds-input mt-1 w-full"
              value={excludedKeywords}
              onChange={(e) => setExcludedKeywords(e.target.value)}
              placeholder="PHP, legacy"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-ds-caption font-medium text-slate-400">Preferred locations (comma)</label>
            <input
              type="text"
              className="ds-input mt-1 w-full"
              value={preferredLocations}
              onChange={(e) => setPreferredLocations(e.target.value)}
              placeholder="Israel, Remote, US"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Resume & cover</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Resume file path</label>
            <input
              type="text"
              className="ds-input mt-1 w-full max-w-md"
              value={resumeFilePath}
              onChange={(e) => setResumeFilePath(e.target.value)}
              placeholder="/app/data/resume-fullstack.pdf"
            />
          </div>
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Resume text (for tailoring)</label>
            <textarea
              className="ds-input mt-1 w-full min-h-[120px]"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste resume content for AI tailoring..."
            />
          </div>
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Cover letter template</label>
            <textarea
              className="ds-input mt-1 w-full min-h-[100px]"
              value={coverLetterTemplate}
              onChange={(e) => setCoverLetterTemplate(e.target.value)}
              placeholder="Optional default cover letter..."
            />
          </div>
          <div>
            <label className="block text-ds-caption font-medium text-slate-400">Recruiter message template (short)</label>
            <textarea
              className="ds-input mt-1 w-full min-h-[60px]"
              value={recruiterMessageTemplate}
              onChange={(e) => setRecruiterMessageTemplate(e.target.value)}
              placeholder="1–2 sentences for InMail/LinkedIn..."
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="secondary" asChild>
          <a href={cancelHref}>Cancel</a>
        </Button>
      </div>
    </form>
  );
}
