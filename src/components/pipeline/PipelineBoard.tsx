"use client";

import { useState } from "react";
import type { BoardColumn } from "@/services/atsService";
import type { MatchStatus } from "@/models/Match";
import { Badge, ScoreBadge } from "@/components/ui";

type PipelineBoardProps = {
  initialColumns: BoardColumn[];
  updateStatusAction: (matchId: string, status: MatchStatus) => Promise<void>;
};

type DragState = {
  matchId: string;
  fromStatus: MatchStatus;
} | null;

export function PipelineBoard({ initialColumns, updateStatusAction }: PipelineBoardProps) {
  const [columns, setColumns] = useState<BoardColumn[]>(initialColumns);
  const [dragState, setDragState] = useState<DragState>(null);

  function handleDragStart(matchId: string, fromStatus: MatchStatus) {
    setDragState({ matchId, fromStatus });
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleDrop(status: MatchStatus) {
    if (!dragState) return;
    const { matchId, fromStatus } = dragState;
    if (fromStatus === status) {
      setDragState(null);
      return;
    }

    setColumns((prev) => {
      const next = prev.map((col) => ({
        ...col,
        matches: [...col.matches]
      }));
      const fromCol = next.find((c) => c.status === fromStatus);
      const toCol = next.find((c) => c.status === status);
      if (!fromCol || !toCol) return prev;
      const idx = fromCol.matches.findIndex((m) => m._id.toString() === matchId);
      if (idx === -1) return prev;
      const [match] = fromCol.matches.splice(idx, 1);
      match.status = status;
      toCol.matches.unshift(match);
      return next;
    });

    try {
      await updateStatusAction(matchId, status);
    } catch (e) {
      // On error, ideally we would refetch; simplest is to ignore and rely on server state on next load
      console.error(e);
    } finally {
      setDragState(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {columns.map((column) => (
        <div
          key={column.status}
          className="flex min-h-[280px] flex-col overflow-hidden rounded-ds-2xl border border-slate-800/60 bg-slate-900/40 shadow-card"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.status)}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
            <p className="text-ds-caption font-medium text-slate-500">{column.title}</p>
            <Badge variant="neutral">{column.matches.length}</Badge>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {column.matches.map((match) => (
              <button
                key={match._id.toString()}
                type="button"
                draggable
                onDragStart={() => handleDragStart(match._id.toString(), column.status)}
                className="w-full cursor-move rounded-ds-xl border border-slate-800/60 bg-slate-800/30 p-3 text-left transition hover:border-slate-700 hover:bg-slate-800/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-ds-caption font-medium text-slate-100">
                    {match.job.title}
                  </p>
                  <ScoreBadge score={match.score} />
                </div>
                <p className="mt-1 line-clamp-1 text-ds-caption text-slate-500">
                  {match.job.company} · {match.job.location}
                </p>
                {match.matchedSkills && match.matchedSkills.length > 0 && (
                  <p className="mt-1 line-clamp-1 text-ds-caption text-slate-400">
                    {match.matchedSkills.slice(0, 3).join(", ")}
                  </p>
                )}
                {match.appliedAt && (
                  <p className="mt-1 text-ds-caption text-slate-500">
                    Applied {new Date(match.appliedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                )}
                {column.status === "applied" && (match as { tailoredUsedInApply?: boolean }).tailoredUsedInApply && (
                  <p className="mt-1 text-ds-caption text-sky-400">Tailored</p>
                )}
              </button>
            ))}
            {column.matches.length === 0 && (
              <p className="py-6 text-center text-ds-caption text-slate-500">Drag a job here</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

