"use client";

import { useState } from "react";
import { JobsTable } from "./JobsTable";
import { JobDetailModal } from "./JobDetailModal";
import type { JobWithScore } from "@/services/jobService";
import type { JobStatus } from "@/models/Job";

type JobsTableWithModalProps = {
  jobs: JobWithScore[];
  updateStatusAction: (jobId: string, status: JobStatus) => Promise<void>;
};

export function JobsTableWithModal({
  jobs,
  updateStatusAction
}: JobsTableWithModalProps) {
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);

  return (
    <>
      <JobsTable
        jobs={jobs}
        onJobSelect={(job) => setSelectedJob(job)}
      />
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          updateStatusAction={updateStatusAction}
        />
      )}
    </>
  );
}
