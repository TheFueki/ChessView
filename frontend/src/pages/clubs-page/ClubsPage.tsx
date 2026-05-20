import { useMemo, useState } from "react";
import { Globe, Lock, Plus, Shield, Trophy, Users } from "lucide-react";
import { Button, Card, Input } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

interface Club {
  id: number;
  name: string;
  members: number;
  type: "Public" | "Invite Only";
  rating: number;
  tags: string[];
}

const initialClubs: Club[] = [
  { id: 1, name: "Grandmasters Elite", members: 1240, type: "Public", rating: 2100, tags: ["classical", "coaching"] },
  { id: 2, name: "Night Knights", members: 850, type: "Invite Only", rating: 1800, tags: ["blitz", "study"] },
  { id: 3, name: "Blitz Arena", members: 3200, type: "Public", rating: 1400, tags: ["blitz", "arena"] },
];

export default function ClubsPage() {
  const [query, setQuery] = useState("");
  const [clubs, setClubs] = useState<Club[]>(initialClubs);
  const [selectedClub, setSelectedClub] = useState<Club | null>(initialClubs[0]);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredClubs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return clubs;
    }

    return clubs.filter((club) => {
      const searchableText = [club.name, club.type, ...club.tags].join(" ").toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [clubs, query]);
  const selectedClubIsVisible = selectedClub ? filteredClubs.some((club) => club.id === selectedClub.id) : false;

  const createClub = () => {
    const nextClub: Club = {
      id: Date.now(),
      name: `ChessView Club ${clubs.length + 1}`,
      members: 1,
      type: "Public",
      rating: 1200,
      tags: ["community", "new"],
    };

    setClubs((currentClubs) => [nextClub, ...currentClubs]);
    setSelectedClub(nextClub);
    setQuery("");
    setNotice(`${nextClub.name} is ready for members.`);
  };

  return (
    <AppShell
      eyebrow="Community"
      title="Clubs"
      description="Find players, organize practice, and keep community play close to tournaments and ratings."
      actions={
        <Button variant="secondary" onClick={createClub}>
          <Plus className="h-4 w-4" />
          Create Club
        </Button>
      }
    >
      <div className="max-w-xl">
        <Input
          placeholder="Search clubs by name or tag"
          aria-label="Search clubs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {notice && (
        <div
          aria-live="polite"
          className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-200"
        >
          {notice}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {filteredClubs.map((club) => (
          <Card key={club.id} className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200">
                <Shield className="h-6 w-6" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-1 text-xs text-neutral-400">
                {club.type === "Public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {club.type}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">{club.name}</h2>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-400">
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{club.members}</span>
                <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" />{club.rating}+</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {club.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setSelectedClub(club)}>
              View Details
            </Button>
          </Card>
        ))}
      </section>

      {filteredClubs.length === 0 ? (
        <Card className="text-sm text-neutral-400">No clubs match that search.</Card>
      ) : null}

      {selectedClub && selectedClubIsVisible ? (
        <Card className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Selected club</div>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-100">{selectedClub.name}</h2>
            <p className="mt-2 text-sm text-neutral-400">
              {selectedClub.members.toLocaleString()} members, {selectedClub.rating}+ average rating, {selectedClub.type.toLowerCase()} access.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {selectedClub.tags.map((tag) => (
              <span key={tag} className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-400">
                {tag}
              </span>
            ))}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
