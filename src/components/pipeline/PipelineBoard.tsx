"use client";

import { useState } from "react";
import type { BoardColumn } from "@/services/atsService";
import type { MatchStatus } from "@/models/Match";

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
          className="flex min-h-[260px] flex-col rounded-2xl border border-slate-800/80 bg-slate-950/60"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.status)}
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {column.title}
            </p>
            <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-xs text-slate-300">
              {column.matches.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {column.matches.map((match) => (
              <button
                key={match._id.toString()}
                type="button"
                draggable
                onDragStart={() => handleDragStart(match._id.toString(), column.status)}
                className="group w-full cursor-move rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-left text-sm text-slate-200 transition hover:border-accent hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-2 text-xs font-medium text-slate-100">
                    {match.job.title}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    {match.score}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
                  {match.job.company} · {match.job.location}
                </p>
                {match.matchedSkills && match.matchedSkills.length > 0 && (
                  <p className="mt-1 line-clamp-1 text-[11px] text-emerald-400/90">
                    {match.matchedSkills.slice(0, 3).join(", ")}
                  </p>
                )}
                {match.appliedAt && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Applied{" "}
                    {new Date(match.appliedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })}
                  </p>
                )}
              </button>
            ))}
            {column.matches.length === 0 && (
              <p className="px-1 py-4 text-center text-[11px] text-slate-500">
                Drag a job here to add to this stage.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

