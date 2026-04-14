import { AlertTriangle, ArrowRight, Clock3, Swords, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { GameHistoryItemResponse, GameHistoryResponse } from "@/shared/types";
import { Avatar, Card, Spinner } from "@/shared/ui";

interface HistoryTableProps {
  items?: GameHistoryItemResponse[];
  isLoading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatResult(result: GameHistoryItemResponse["result"], myColor: GameHistoryItemResponse["my_color"]) {
  if (result === "1/2-1/2") {
    return {
      label: "Draw",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  if ((result === "1-0" && myColor === "white") || (result === "0-1" && myColor === "black")) {
    return {
      label: "Win",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (result) {
    return {
      label: "Loss",
      className: "border-red-500/20 bg-red-500/10 text-red-300",
    };
  }

  return {
    label: "Pending",
    className: "border-neutral-700 bg-neutral-800 text-neutral-300",
  };
}

function formatRatingDelta(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--";
  }

  return value > 0 ? `+${value}` : String(value);
}

function formatTermination(status: GameHistoryItemResponse["status"], terminationReason: GameHistoryItemResponse["termination_reason"]) {
  if (terminationReason) {
    return terminationReason.replaceAll("_", " ");
  }

  return status.replaceAll("_", " ");
}

function formatMoveCount(moveCount: number) {
  if (moveCount === 1) {
    return "1 move";
  }

  return `${moveCount} moves`;
}

export function HistoryTable({
  items: providedItems,
  isLoading: providedLoading,
  error: providedError,
  title = "Match History",
  description = "Your recent games and results.",
  emptyTitle = "No games yet",
  emptyDescription = "Play your first match to see it here.",
}: HistoryTableProps = {}) {
  const navigate = useNavigate();
  const isControlled = providedItems !== undefined || providedLoading !== undefined || providedError !== undefined;

  const historyQuery = useQuery({
    queryKey: ["history"],
    queryFn: () => http.get<GameHistoryResponse>("/games"),
    enabled: !isControlled,
  });

  const items = providedItems ?? historyQuery.data?.items ?? [];
  const isLoading = providedLoading ?? historyQuery.isLoading;
  const error =
    providedError ??
    (historyQuery.error instanceof Error ? historyQuery.error.message : historyQuery.error ? "Unable to load match history." : null);

  return (
    <Card className="w-full overflow-hidden p-0">
      <div className="border-b border-neutral-800 px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-neutral-100">{title}</h3>
        </div>
        <p className="mt-1.5 pl-[30px] text-sm text-neutral-500">{description}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
          <Spinner size="md" />
          <p className="text-sm">Loading match history...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertTriangle className="h-7 w-7 text-red-400/80" />
          <div>
            <p className="text-sm font-medium text-red-300">{error}</p>
            <p className="mt-1 text-xs text-neutral-500">Refresh the page once the backend is running.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Swords className="h-7 w-7 text-neutral-600" />
          <div>
            <p className="text-sm font-medium text-neutral-300">{emptyTitle}</p>
            <p className="mt-1 text-xs text-neutral-500">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-neutral-800/70">
          {items.map((game) => {
            const result = formatResult(game.result, game.my_color);
            const reviewLabel = game.status === "active" ? "Resume" : "Review";
            const targetHref = game.status === "active" ? `/game/${game.id}` : `/games/${game.id}`;

            return (
              <div
                key={game.id}
                className="cursor-pointer px-6 py-5 transition hover:bg-neutral-900/60"
                onClick={() => navigate(targetHref)}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        to={`/players/${game.opponent.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <Avatar username={game.opponent.username} avatarUrl={game.opponent.avatar_url} size="md" />
                        <span className="truncate text-lg font-semibold text-neutral-100 transition hover:text-emerald-300">
                          {game.opponent.username}
                        </span>
                      </Link>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${result.className}`}>
                        {result.label}
                      </span>
                      <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                        {game.time_control_name}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{game.opponent.rating ? `Rating ${game.opponent.rating}` : "Opponent"}</span>
                      <span className="h-1 w-1 rounded-full bg-neutral-700" />
                      <span>{game.rated ? "Rated" : "Casual"}</span>
                      <span className="h-1 w-1 rounded-full bg-neutral-700" />
                      <span className="capitalize">{game.my_color}</span>
                      <span
                        className={`inline-flex h-2.5 w-2.5 rounded-full border ${
                          game.my_color === "white" ? "border-neutral-500 bg-white" : "border-neutral-600 bg-neutral-800"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Status</div>
                      <div className="mt-2 text-sm capitalize text-neutral-200">
                        {formatTermination(game.status, game.termination_reason)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Played</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-neutral-200">
                        <Clock3 className="h-3.5 w-3.5 text-neutral-500" />
                        {formatDate(game.ended_at ?? game.started_at)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-3 py-3">
                      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Impact</div>
                      <div
                        className={`mt-2 text-sm font-semibold ${
                          (game.rating_delta ?? 0) > 0
                            ? "text-emerald-300"
                            : (game.rating_delta ?? 0) < 0
                              ? "text-red-300"
                              : "text-neutral-300"
                        }`}
                      >
                        {formatRatingDelta(game.rating_delta)} • {formatMoveCount(game.move_count)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 xl:justify-end">
                    <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{reviewLabel}</div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-200">
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default HistoryTable;
