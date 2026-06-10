import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ClubsPage from "../ClubsPage";
import { renderWithProviders } from "@/test/render";

vi.mock("@/widgets/app-shell", () => ({
  AppShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      <div>{actions}</div>
      {children}
    </main>
  ),
}));

describe("ClubsPage", () => {
  it("filters clubs by name, access type, or tag", async () => {
    renderWithProviders(<ClubsPage />);

    await userEvent.type(screen.getByLabelText("Search clubs"), "blitz");

    expect(screen.getByText("Night Knights")).toBeInTheDocument();
    expect(screen.getByText("Blitz Arena")).toBeInTheDocument();
    expect(screen.queryByText("Grandmasters Elite")).not.toBeInTheDocument();
  });

  it("creates and selects a local club deterministically", async () => {
    vi.setSystemTime(new Date("2026-06-10T10:00:00.000Z"));
    renderWithProviders(<ClubsPage />);

    await userEvent.click(screen.getByRole("button", { name: /create club/i }));

    expect(screen.getByText("ChessView Club 4 is ready for members.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "ChessView Club 4" })).toHaveLength(2);
    expect(screen.getByText("1 members, 1200+ average rating, public access.")).toBeInTheDocument();
  });
});
