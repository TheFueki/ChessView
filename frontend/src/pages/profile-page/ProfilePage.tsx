import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Crown, TrendingUp, Trophy, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { GameHistoryItemResponse, ProfileResponse, UserProfile } from "@/shared/types";
import { Avatar, Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { HistoryTable } from "@/widgets/history-table";

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toHistoryItems(profile: ProfileResponse): GameHistoryItemResponse[] {
  return profile.recent_games.map((game) => ({
    id: game.id,
    white: game.white,
    black: game.black,
    opponent: game.opponent,
    my_color: game.player_color,
    rated: game.rated,
    time_control_name: game.time_control_name,
    result: game.result,
    status: game.status,
    termination_reason: game.termination_reason,
    move_count: game.move_count,
    started_at: game.started_at,
    ended_at: game.ended_at,
    rating_delta: game.rating_delta,
  }));
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const currentUser = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const isOwnProfile = !userId || userId === currentUser?.id;
  const [uploadError, setUploadError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", isOwnProfile ? "me" : userId],
    queryFn: () => http.get<ProfileResponse>(isOwnProfile ? "/profiles/me" : `/profiles/${userId}`),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return http.post<UserProfile>("/identity/me/avatar", formData);
    },
    onSuccess: (updatedUser) => {
      setUploadError(null);
      if (currentUser) {
        setUser({
          ...currentUser,
          ...updatedUser,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["analysis-history"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
    onError: (error) => {
      setUploadError(error instanceof Error ? error.message : "Avatar upload failed.");
    },
  });

  const profile = profileQuery.data ?? null;
  const error =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? "Unable to load profile."
        : null;

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Choose a PNG, JPEG, or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Avatar files must be 2MB or smaller.");
      return;
    }

    await avatarMutation.mutateAsync(file);
  };

  return (
    <AppShell
      eyebrow={isOwnProfile ? "Your Profile" : "Player Profile"}
      title={profile?.username ?? "Profile"}
      description={
        isOwnProfile
          ? "Track your rating, recent results, and study surfaces from one place."
          : "Public player card with rating, performance summary, and recent games."
      }
      actions={
        <>
          <Button onClick={() => navigate("/lobby")}>Play</Button>
          <Button variant="secondary" onClick={() => navigate("/analysis")}>
            <BarChart3 className="h-4 w-4" />
            Analysis
          </Button>
          {!isOwnProfile && currentUser ? (
            <Button variant="ghost" onClick={() => navigate("/profile")}>
              Back to My Profile
            </Button>
          ) : null}
        </>
      }
    >
      {profileQuery.isLoading ? (
        <Card className="flex items-center gap-3">
          <Spinner size="sm" />
          <span className="text-sm text-neutral-400">Loading profile...</span>
        </Card>
      ) : error || !profile ? (
        <Card className="mx-auto mt-12 max-w-xl text-center">
          <div className="space-y-3">
            <UserRound className="mx-auto h-8 w-8 text-red-300" />
            <div className="text-lg font-semibold text-neutral-100">Profile unavailable</div>
            <p className="text-sm text-neutral-400">{error ?? "We couldn't find that player."}</p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <Card className="overflow-hidden p-0">
              <div className="border-b border-neutral-800 bg-linear-to-r from-emerald-500/12 via-transparent to-cyan-500/12 px-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar username={profile.username} avatarUrl={profile.avatar_url} size="xl" className="rounded-3xl" />
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
                        {isOwnProfile ? "Personal Summary" : "Player Summary"}
                      </div>
                      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">{profile.username}</h1>
                      <div className="mt-2 text-sm text-neutral-400">
                        Joined {formatJoinedDate(profile.created_at)}
                        {isOwnProfile && currentUser?.email ? ` • ${currentUser.email}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/75 px-5 py-4 text-right">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Current Rating</div>
                    <div className="mt-1 text-4xl font-bold tabular-nums text-neutral-100">{profile.rating}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                    <Trophy className="h-3.5 w-3.5" />
                    Record
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-neutral-100">
                    {profile.wins}-{profile.losses}-{profile.draws}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">Wins, losses, draws</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Win Rate
                  </div>
                  <div className="mt-3 text-2xl font-semibold text-neutral-100">{profile.win_rate.toFixed(1)}%</div>
                  <div className="mt-1 text-sm text-neutral-500">Across {profile.games_played} games</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Games Played</div>
                  <div className="mt-3 text-2xl font-semibold text-neutral-100">{profile.games_played}</div>
                  <div className="mt-1 text-sm text-neutral-500">Rated and casual combined</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                    <Crown className="h-3.5 w-3.5" />
                    Latest Board
                  </div>
                  <div className="mt-3 text-lg font-semibold text-neutral-100">
                    {profile.recent_games[0] ? formatJoinedDate(profile.recent_games[0].ended_at ?? profile.recent_games[0].started_at) : "No games yet"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">Most recent activity</div>
                </div>
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Quick Actions</div>
              <div className="space-y-3">
                <Button className="w-full justify-center" onClick={() => navigate("/lobby")}>
                  Play a Game
                </Button>
                {isOwnProfile ? (
                  <label className="block">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarSelect}
                      disabled={avatarMutation.isPending}
                    />
                    <span className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-100 transition hover:border-neutral-600 hover:bg-neutral-700">
                      {avatarMutation.isPending ? "Uploading..." : "Upload Profile Picture"}
                    </span>
                  </label>
                ) : null}
                <Button className="w-full justify-center" variant="secondary" onClick={() => navigate("/analysis")}>
                  Open Analysis Hub
                </Button>
                <Button className="w-full justify-center" variant="secondary" onClick={() => navigate("/history")}>
                  Open Full History
                </Button>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                Recent games below stay fully clickable for replay, and opponent names still deep-link into profile views.
              </div>
              {uploadError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {uploadError}
                </div>
              ) : null}
              {!isOwnProfile && currentUser ? (
                <Link to="/profile" className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200">
                  Return to your own profile
                </Link>
              ) : null}
            </Card>
          </section>

          <HistoryTable
            items={toHistoryItems(profile)}
            isLoading={false}
            error={null}
            title={isOwnProfile ? "Recent Games" : `${profile.username}'s Recent Games`}
            description={
              isOwnProfile
                ? "Your latest boards, with stronger result metadata and instant replay access."
                : "Recent games from this player's archive."
            }
            emptyTitle="No recent games"
            emptyDescription="This player has not completed any games yet."
          />
        </>
      )}
    </AppShell>
  );
}
