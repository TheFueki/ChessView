import { describe, expect, it } from "vitest";
import { bannerStyleFromItem, boardThemeFromItem, DEFAULT_BOARD_THEME } from "../shop";
import type { ShopItemResponse } from "@/shared/types";

function shopItem(metadata: Record<string, unknown>): ShopItemResponse {
  return {
    id: 1,
    sku: "board-1",
    name: "Tournament board",
    price: 200,
    type: "board",
    rarity: "rare",
    description: "A board",
    metadata,
    consumable: false,
    is_active: true,
    owned: true,
    quantity: 1,
    equipped: true,
  };
}

describe("shop helpers", () => {
  it("falls back to the default board theme when metadata is missing or invalid", () => {
    expect(boardThemeFromItem(null)).toEqual(DEFAULT_BOARD_THEME);
    expect(boardThemeFromItem(shopItem({ light: "", dark: 42 }))).toEqual(DEFAULT_BOARD_THEME);
  });

  it("uses item metadata for board colors and banners", () => {
    const item = shopItem({
      light: "#f4f1de",
      dark: "#3d405b",
      accent: "#e07a5f",
      gradient: "linear-gradient(red, blue)",
    });

    expect(boardThemeFromItem(item)).toEqual({
      light: "#f4f1de",
      dark: "#3d405b",
      accent: "#e07a5f",
    });
    expect(bannerStyleFromItem(item)).toEqual({ backgroundImage: "linear-gradient(red, blue)" });
  });
});
