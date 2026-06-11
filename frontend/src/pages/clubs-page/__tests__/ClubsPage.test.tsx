import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ClubsPage from "../ClubsPage";
import { http } from "@/shared/api";
import { renderWithProviders } from "@/test/render";
import type { ClubResponse } from "@/shared/types";

vi.mock("@/shared/api", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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

const clubs: ClubResponse[] = [
  {
    id: "club-1",
    name: "Grandmasters Elite",
    slug: "grandmasters-elite",
    description: "Classical prep and coaching.",
    visibility: "public",
    owner_id: "user-1",
    owner: { id: "user-1", username: "Owner", rating: 2100 },
    member_count: 1240,
    viewer_is_member: false,
    viewer_role: null,
    created_at: "2026-06-11T10:00:00Z",
    updated_at: null,
  },
  {
    id: "club-2",
    name: "Night Knights",
    slug: "night-knights",
    description: "Late blitz study group.",
    visibility: "private",
    owner_id: "user-2",
    owner: { id: "user-2", username: "Captain", rating: 1800 },
    member_count: 850,
    viewer_is_member: true,
    viewer_role: "member",
    created_at: "2026-06-11T10:00:00Z",
    updated_at: null,
  },
];

describe("ClubsPage", () => {
  it("loads clubs from the API and filters by name, visibility, or description", async () => {
    vi.mocked(http.get).mockResolvedValue(clubs);

    renderWithProviders(<ClubsPage />);

    expect(await screen.findByText("Grandmasters Elite")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search clubs"), "blitz");

    expect(screen.getByText("Night Knights")).toBeInTheDocument();
    expect(screen.queryByText("Grandmasters Elite")).not.toBeInTheDocument();
    expect(http.get).toHaveBeenCalledWith("/clubs");
  });

  it("creates a club through the API and selects it", async () => {
    const created = { ...clubs[0], id: "club-3", name: "ChessView Club", member_count: 1, viewer_is_member: true, viewer_role: "owner" as const };
    vi.mocked(http.get).mockResolvedValue(clubs);
    vi.mocked(http.post).mockResolvedValue(created);

    renderWithProviders(<ClubsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /create club/i }));
    await userEvent.clear(screen.getByLabelText("Club name"));
    await userEvent.type(screen.getByLabelText("Club name"), "ChessView Club");
    await userEvent.type(screen.getByLabelText("Club description"), "Training room");
    await userEvent.click(screen.getByRole("button", { name: /^create$/i }));

    expect(http.post).toHaveBeenCalledWith("/clubs", {
      name: "ChessView Club",
      description: "Training room",
      visibility: "public",
    });
    expect(await screen.findByText("ChessView Club is ready for members.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "ChessView Club" })).toHaveLength(2);
  });

  it("joins and leaves clubs through membership endpoints", async () => {
    vi.mocked(http.get).mockResolvedValue(clubs);
    vi.mocked(http.post).mockResolvedValue({ ...clubs[0], viewer_is_member: true, viewer_role: "member", member_count: 1241 });
    vi.mocked(http.delete).mockResolvedValue({ ...clubs[1], viewer_is_member: false, viewer_role: null, member_count: 849 });

    renderWithProviders(<ClubsPage />);

    const firstClub = await screen.findByRole("article", { name: /grandmasters elite/i });
    await userEvent.click(within(firstClub).getByRole("button", { name: /join/i }));

    expect(http.post).toHaveBeenCalledWith("/clubs/club-1/join");
    expect(await screen.findByText("Joined Grandmasters Elite.")).toBeInTheDocument();

    const secondClub = screen.getByRole("article", { name: /night knights/i });
    await userEvent.click(within(secondClub).getByRole("button", { name: /leave/i }));

    expect(http.delete).toHaveBeenCalledWith("/clubs/club-2/join");
    await waitFor(() => {
      expect(screen.getByText("Left Night Knights.")).toBeInTheDocument();
    });
  });
});
