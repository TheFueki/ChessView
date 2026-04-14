import { motion } from "framer-motion";
import { Crown, MessageSquare, Swords, Video } from "lucide-react";
import { useNavigate } from "react-router";
import { Button, Card } from "@/shared/ui";

const features = [
  {
    icon: Swords,
    title: "Authoritative Multiplayer",
    description: "Real-time games with server-owned state, clocks, and fair move validation.",
  },
  {
    icon: Video,
    title: "Replay and Review",
    description: "Every finished game becomes a replayable lesson with move stepping and local analysis.",
  },
  {
    icon: MessageSquare,
    title: "Profiles and Tournaments",
    description: "Build a rating history, browse player profiles, and join Swiss events as the platform grows.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute right-[-4rem] top-1/3 h-80 w-80 rounded-full bg-emerald-600/6 blur-3xl" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <Crown className="h-6 w-6 text-emerald-500" />
          <span className="text-lg font-bold tracking-tight text-neutral-100">ChessView</span>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            Login
          </Button>
          <Button size="sm" onClick={() => navigate("/register")}>
            Register
          </Button>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pb-32 pt-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="mb-4 inline-block rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
            Multiplayer Chess Platform
          </span>

          <h1 className="mt-4 text-5xl font-extrabold leading-tight tracking-tight text-neutral-100 sm:text-6xl lg:text-7xl">
            Play chess.{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
              Review everything.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400">
            Real-time 1v1 chess with replay, local engine analysis, ratings, and tournaments.
            No downloads required - sign in and start playing.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button size="lg" onClick={() => navigate("/register")}>
            Start Playing
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate("/login")}>
            Login
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="mt-24 grid gap-6 sm:grid-cols-3"
        >
          {features.map((feature) => (
            <Card key={feature.title} glow className="text-left">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <feature.icon className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-100">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{feature.description}</p>
            </Card>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-neutral-800/50 py-8 text-center text-xs text-neutral-600">
        © {new Date().getFullYear()} ChessView - multiplayer chess built around replay and review
      </footer>
    </div>
  );
}
