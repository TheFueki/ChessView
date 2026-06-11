import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, Plus, Search, Shield, Users } from "lucide-react";
import { http } from "@/shared/api";
import { Button, Card, Input, Spinner } from "@/shared/ui";
import type { ClubResponse, ClubVisibility } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";

const CLUBS_QUERY_KEY = ["clubs"];

function visibilityLabel(visibility: ClubVisibility) {
  return visibility === "public" ? "Public" : "Invite only";
}

function upsertClub(clubs: ClubResponse[] | undefined, updated: ClubResponse) {
  const current = clubs ?? [];
  const exists = current.some((club) => club.id === updated.id);
  if (!exists) {
    return [updated, ...current];
  }
  return current.map((club) => (club.id === updated.id ? updated : club));
}

export default function ClubsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [clubVisibility, setClubVisibility] = useState<ClubVisibility>("public");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<ClubVisibility>("public");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const clubsQuery = useQuery({
    queryKey: CLUBS_QUERY_KEY,
    queryFn: () => http.get<ClubResponse[]>("/clubs"),
  });

  const clubs = clubsQuery.data ?? [];
  const selectedClub = clubs.find((club) => club.id === selectedClubId) ?? null;

  const filteredClubs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return clubs;
    }

    return clubs.filter((club) => {
      const searchableText = [
        club.name,
        club.description,
        club.visibility,
        visibilityLabel(club.visibility),
        club.owner?.username ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [clubs, query]);

  const createClub = useMutation({
    mutationFn: () =>
      http.post<ClubResponse>("/clubs", {
        name: clubName.trim(),
        description: clubDescription.trim(),
        visibility: clubVisibility,
      }),
    onSuccess: (createdClub) => {
      queryClient.setQueryData<ClubResponse[]>(CLUBS_QUERY_KEY, (current) => upsertClub(current, createdClub));
      setSelectedClubId(createdClub.id);
      setEditDescription(createdClub.description);
      setEditVisibility(createdClub.visibility);
      setShowCreateForm(false);
      setClubName("");
      setClubDescription("");
      setClubVisibility("public");
      setQuery("");
      setActionError(null);
      setNotice(`${createdClub.name} is ready for members.`);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to create club.");
    },
  });

  const joinClub = useMutation({
    mutationFn: (clubId: string) => http.post<ClubResponse>(`/clubs/${clubId}/join`),
    onSuccess: (updatedClub) => {
      queryClient.setQueryData<ClubResponse[]>(CLUBS_QUERY_KEY, (current) => upsertClub(current, updatedClub));
      setActionError(null);
      setNotice(`Joined ${updatedClub.name}.`);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to join club.");
    },
  });

  const leaveClub = useMutation({
    mutationFn: (clubId: string) => http.delete<ClubResponse>(`/clubs/${clubId}/join`),
    onSuccess: (updatedClub) => {
      queryClient.setQueryData<ClubResponse[]>(CLUBS_QUERY_KEY, (current) => upsertClub(current, updatedClub));
      setActionError(null);
      setNotice(`Left ${updatedClub.name}.`);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to leave club.");
    },
  });

  const updateClub = useMutation({
    mutationFn: (club: ClubResponse) =>
      http.patch<ClubResponse>(`/clubs/${club.id}`, {
        description: editDescription.trim(),
        visibility: editVisibility,
      }),
    onSuccess: (updatedClub) => {
      queryClient.setQueryData<ClubResponse[]>(CLUBS_QUERY_KEY, (current) => upsertClub(current, updatedClub));
      setActionError(null);
      setNotice(`${updatedClub.name} was updated.`);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to update club.");
    },
  });

  const error = actionError ?? (clubsQuery.error instanceof Error ? clubsQuery.error.message : null);

  const handleCreate = () => {
    if (!clubName.trim()) {
      setActionError("Club name is required.");
      return;
    }
    createClub.mutate();
  };

  const selectClub = (club: ClubResponse) => {
    setSelectedClubId(club.id);
    setEditDescription(club.description);
    setEditVisibility(club.visibility);
  };

  return (
    <AppShell
      eyebrow="Community"
      title="Clubs"
      description="Find players, organize practice, and keep community play close to tournaments and ratings."
      actions={
        <Button variant="secondary" onClick={() => setShowCreateForm((visible) => !visible)}>
          <Plus className="h-4 w-4" />
          Create Club
        </Button>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <div className="max-w-xl">
            <Input
              placeholder="Search clubs by name, visibility, or description"
              aria-label="Search clubs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {showCreateForm ? (
            <Card className="space-y-4 p-5">
              <div>
                <h2 className="text-xl font-semibold text-neutral-100">Create a club</h2>
                <p className="mt-1 text-sm text-neutral-500">Start a public training room or keep it invite-only.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <Input
                  label="Club name"
                  aria-label="Club name"
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  placeholder="Night Knights"
                />
                <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-400">
                  Visibility
                  <select
                    value={clubVisibility}
                    onChange={(event) => setClubVisibility(event.target.value as ClubVisibility)}
                    className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-hidden transition focus:border-neutral-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Invite only</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-400">
                Club description
                <textarea
                  aria-label="Club description"
                  value={clubDescription}
                  onChange={(event) => setClubDescription(event.target.value)}
                  className="min-h-24 rounded-lg border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-500/70 focus:ring-2 focus:ring-neutral-500/20"
                  placeholder="Training room"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreate} disabled={createClub.isPending}>
                  {createClub.isPending ? "Creating..." : "Create"}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : null}

          {notice ? (
            <div
              aria-live="polite"
              className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-200"
            >
              {notice}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {clubsQuery.isLoading ? (
            <Card className="flex items-center justify-center p-10">
              <Spinner />
            </Card>
          ) : filteredClubs.length === 0 ? (
            <Card className="flex items-center gap-3 p-6 text-sm text-neutral-400">
              <Search className="h-5 w-5 text-neutral-500" />
              No clubs match that search.
            </Card>
          ) : (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClubs.map((club) => {
                const isBusy = joinClub.isPending || leaveClub.isPending;
                return (
                  <Card key={club.id} role="article" aria-label={club.name} className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200">
                        <Shield className="h-6 w-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-1 text-xs text-neutral-400">
                        {club.visibility === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {visibilityLabel(club.visibility)}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-100">{club.name}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">{club.description || "No description yet."}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-400">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {club.member_count.toLocaleString()}
                        </span>
                        <span>Host: {club.owner?.username ?? "Unknown"}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" className="flex-1" onClick={() => selectClub(club)}>
                        View
                      </Button>
                      {club.viewer_is_member ? (
                        <Button
                          variant="ghost"
                          className="flex-1"
                          onClick={() => leaveClub.mutate(club.id)}
                          disabled={isBusy || club.viewer_role === "owner"}
                        >
                          Leave
                        </Button>
                      ) : (
                        <Button
                          className="flex-1"
                          onClick={() => joinClub.mutate(club.id)}
                          disabled={isBusy || club.visibility === "private"}
                        >
                          {club.visibility === "private" ? "Invite only" : "Join"}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </section>
          )}
        </div>

        {selectedClub ? (
          <Card className="h-fit space-y-5 p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Selected club</div>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-100">{selectedClub.name}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{selectedClub.description || "No description yet."}</p>
            </div>
            <div className="grid gap-2 text-sm text-neutral-400">
              <span>{selectedClub.member_count.toLocaleString()} members</span>
              <span>{visibilityLabel(selectedClub.visibility)}</span>
              <span>Owner: {selectedClub.owner?.username ?? "Unknown"}</span>
              <span>{selectedClub.viewer_is_member ? `You are a ${selectedClub.viewer_role}.` : "You are not a member yet."}</span>
            </div>
            {selectedClub.viewer_role === "owner" ? (
              <div className="space-y-3 border-t border-neutral-800 pt-4">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-400">
                  Description
                  <textarea
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="min-h-24 rounded-lg border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-100 outline-none transition focus:border-neutral-500/70 focus:ring-2 focus:ring-neutral-500/20"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-neutral-400">
                  Visibility
                  <select
                    value={editVisibility}
                    onChange={(event) => setEditVisibility(event.target.value as ClubVisibility)}
                    className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-hidden transition focus:border-neutral-500"
                  >
                    <option value="public">Public</option>
                    <option value="private">Invite only</option>
                  </select>
                </label>
                <Button className="w-full" onClick={() => updateClub.mutate(selectedClub)} disabled={updateClub.isPending}>
                  {updateClub.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
