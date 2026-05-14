import { Globe, Lock, Plus, Shield, Trophy, Users } from "lucide-react";
import { Button, Card, Input } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

const clubs = [
  { id: 1, name: "Grandmasters Elite", members: 1240, type: "Public", rating: 2100 },
  { id: 2, name: "Night Knights", members: 850, type: "Invite Only", rating: 1800 },
  { id: 3, name: "Blitz Arena", members: 3200, type: "Public", rating: 1400 },
];

export default function ClubsPage() {
  return (
    <AppShell
      eyebrow="Community"
      title="Clubs"
      description="Find players, organize practice, and keep community play close to tournaments and ratings."
      actions={
        <Button variant="secondary">
          <Plus className="h-4 w-4" />
          Create Club
        </Button>
      }
    >
      <div className="max-w-xl">
        <Input placeholder="Search clubs by name or tag" aria-label="Search clubs" />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {clubs.map((club) => (
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
            </div>
            <Button variant="secondary" className="w-full">View Details</Button>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
