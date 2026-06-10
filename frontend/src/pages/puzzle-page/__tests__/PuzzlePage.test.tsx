import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PuzzlePage from "../PuzzlePage";
import { http } from "@/shared/api";
import { renderWithProviders } from "@/test/render";
import type { PuzzleDetailResponse, PuzzleListResponse } from "@/shared/types";

vi.mock("@/shared/api", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/widgets/app-shell", () => ({
  AppShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <div>{actions}</div>
      {children}
    </main>
  ),
}));

vi.mock("react-chessboard", () => ({
  Chessboard: ({ id, position }: { id: string; position: string }) => (
    <div data-testid={id} data-position={position} />
  ),
}));

const puzzle: PuzzleDetailResponse = {
  id: "puzzle-1",
  fen: "6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1",
  rating: 1250,
  themes: ["endgame", "calculation"],
  source_game_id: null,
  attempt: { attempts_count: 2, solved: false, last_result: "failed", last_attempted_at: "2026-06-01T00:00:00Z" },
  solution_moves: ["g2g3"],
};

const catalog: PuzzleListResponse = {
  items: [
    {
      id: puzzle.id,
      fen: puzzle.fen,
      rating: puzzle.rating,
      themes: puzzle.themes,
      source_game_id: puzzle.source_game_id,
      attempt: puzzle.attempt,
    },
    {
      id: "puzzle-2",
      fen: puzzle.fen,
      rating: 1400,
      themes: ["fork", "tactics"],
      source_game_id: null,
      attempt: null,
    },
  ],
  total: 2,
  page: 1,
  size: 15,
};

describe("PuzzlePage", () => {
  it("shows a loading state while the puzzle request is pending", () => {
    vi.mocked(http.get).mockImplementation((endpoint) => {
      if (endpoint === "/puzzles?size=15") return Promise.resolve(catalog);
      return new Promise(() => {});
    });

    renderWithProviders(<PuzzlePage />, { route: "/puzzles" });

    expect(screen.getAllByText("Loading puzzle").length).toBeGreaterThan(0);
  });

  it("renders fetched puzzle detail and catalog state", async () => {
    vi.mocked(http.get).mockImplementation((endpoint) => {
      if (endpoint === "/puzzles?size=15") return Promise.resolve(catalog);
      if (endpoint === "/puzzles/random") return Promise.resolve(puzzle);
      throw new Error(`Unexpected endpoint ${endpoint}`);
    });

    renderWithProviders(<PuzzlePage />, { route: "/puzzles" });

    expect(await screen.findByRole("heading", { name: "Puzzle Trainer" })).toBeInTheDocument();
    expect(screen.getAllByText("1250")).toHaveLength(2);
    expect(screen.getAllByText(/endgame\s+calculation/)).toHaveLength(2);
    expect(screen.getByText("Total Attempts")).toBeInTheDocument();
    expect(screen.getByText(/fork\s+tactics/)).toBeInTheDocument();
    expect(screen.getByTestId("fueki-puzzle-board")).toHaveAttribute("data-position", puzzle.fen);
  });
});
