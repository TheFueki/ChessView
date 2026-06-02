import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { http } from "@/shared/api";
import type { ShopInventoryResponse, ShopItemResponse } from "@/shared/types";

export const DEFAULT_BOARD_THEME = {
  light: "#D9DFC8",
  dark: "#2B3A30",
  accent: "#8b5cf6",
};

export interface BoardTheme {
  light: string;
  dark: string;
  accent: string;
}

function stringMetadataValue(item: ShopItemResponse | null | undefined, key: string): string | null {
  const value = item?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function boardThemeFromItem(item: ShopItemResponse | null | undefined): BoardTheme {
  return {
    light: stringMetadataValue(item, "light") ?? DEFAULT_BOARD_THEME.light,
    dark: stringMetadataValue(item, "dark") ?? DEFAULT_BOARD_THEME.dark,
    accent: stringMetadataValue(item, "accent") ?? DEFAULT_BOARD_THEME.accent,
  };
}

export function bannerStyleFromItem(item: ShopItemResponse | null | undefined): CSSProperties | undefined {
  const gradient = stringMetadataValue(item, "gradient");
  return gradient ? { backgroundImage: gradient } : undefined;
}

export function useShopInventory(enabled = true) {
  return useQuery({
    queryKey: ["shop-inventory"],
    queryFn: () => http.get<ShopInventoryResponse>("/shop/me"),
    enabled,
  });
}

export function useEquippedBoardTheme(enabled = true): BoardTheme {
  const inventoryQuery = useShopInventory(enabled);
  const board = inventoryQuery.data?.items.find((item) => item.type === "board" && item.equipped);
  return boardThemeFromItem(board);
}
