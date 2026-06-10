import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ShopPage from "../ShopPage";
import { http } from "@/shared/api";
import { renderWithProviders } from "@/test/render";
import type { ShopInventoryResponse } from "@/shared/types";

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

const inventory: ShopInventoryResponse = {
  coins: 850,
  equipped_board_sku: "classic-board",
  equipped_banner_sku: null,
  items: [
    {
      id: 1,
      sku: "classic-board",
      name: "Classic Board",
      price: 200,
      type: "board",
      rarity: "common",
      description: "A calm board theme.",
      asset_key: "tournament-board",
      metadata: { light: "#fff", dark: "#111" },
      consumable: false,
      is_active: true,
      owned: true,
      quantity: 1,
      equipped: true,
    },
    {
      id: 2,
      sku: "coach-token",
      name: "Coach Review Token",
      price: 75,
      type: "consumable",
      rarity: "rare",
      description: "Spend for a review.",
      asset_key: "coach-review-token",
      metadata: {},
      consumable: true,
      is_active: true,
      owned: false,
      quantity: 0,
      equipped: false,
    },
  ],
};

describe("ShopPage", () => {
  it("renders inventory from the API and filters by category", async () => {
    vi.mocked(http.get).mockResolvedValue(inventory);

    renderWithProviders(<ShopPage />);

    expect(await screen.findByText("850")).toBeInTheDocument();
    expect(screen.getByText("Classic Board")).toBeInTheDocument();
    expect(screen.getByText("Coach Review Token")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /boards/i }));

    expect(screen.getByText("Classic Board")).toBeInTheDocument();
    expect(screen.queryByText("Coach Review Token")).not.toBeInTheDocument();
  });

  it("posts purchases and shows the saved notice", async () => {
    vi.mocked(http.get).mockResolvedValue(inventory);
    vi.mocked(http.post).mockResolvedValue({});

    renderWithProviders(<ShopPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Buy" }));

    expect(http.post).toHaveBeenCalledWith("/shop/items/2/purchase");
    await waitFor(() => {
      expect(screen.getByText("Purchase saved to your inventory.")).toBeInTheDocument();
    });
  });
});
