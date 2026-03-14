"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import type { BoardWithMeta } from "@/services/discovery/boardService";

type Props = { boards: BoardWithMeta[] };

export function SourcesListClient({ boards }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setEnabled(boardId: string, enabled: boolean) {
    setLoading(`enable-${boardId}`);
    try {
      const res = await fetch(`/api/sources/boards/${encodeURIComponent(boardId)}/enable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function syncBoard(boardId: string) {
    setLoading(`sync-${boardId}`);
    try {
      const res = await fetch(`/api/sync/board/${encodeURIComponent(boardId)}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function syncProvider(provider: string) {
    setLoading(`sync-provider-${provider}`);
    try {
      const res = await fetch(`/api/sync/provider/${encodeURIComponent(provider)}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const byProvider = new Map<string, BoardWithMeta[]>();
  for (const b of boards) {
    const list = byProvider.get(b.provider) ?? [];
    list.push(b);
    byProvider.set(b.provider, list);
  }

  return (
    <div className="space-y-6">
      {Array.from(byProvider.entries()).map(([provider, list]) => (
        <div key={provider}>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-ds-body font-semibold text-slate-200 capitalize">{provider}</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!!loading}
              onClick={() => syncProvider(provider)}
            >
              {loading === `sync-provider-${provider}` ? "Syncing…" : "Sync provider"}
            </Button>
          </div>
          <ul className="space-y-2">
            {list.map((board) => (
              <li
                key={board.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/20 p-3"
              >
                <span className="font-medium text-slate-100">{board.companyName}</span>
                <Badge variant={board.enabled ? "default" : "neutral"}>
                  {board.enabled ? "On" : "Off"}
                </Badge>
                {board.lastSync && (
                  <>
                    <span className="text-ds-caption text-slate-500">
                      Last: {new Date(board.lastSync.completedAt).toLocaleString()}
                    </span>
                    <span className="text-ds-caption text-slate-500">
                      Fetched: {board.lastSync.fetched} · Saved: {board.lastSync.saved}
                    </span>
                    {board.lastSync.failed > 0 && (
                      <Badge variant="score-low">Failures: {board.lastSync.failed}</Badge>
                    )}
                  </>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!!loading}
                    onClick={() => setEnabled(board.id, !board.enabled)}
                  >
                    {loading === `enable-${board.id}` ? "…" : board.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={!!loading}
                    onClick={() => syncBoard(board.id)}
                  >
                    {loading === `sync-${board.id}` ? "Syncing…" : "Sync now"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
