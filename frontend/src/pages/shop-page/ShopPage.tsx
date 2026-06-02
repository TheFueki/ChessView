import { useMemo, useState } from "react";
import { BadgeCheck, Coins, Flag, Layout, Palette, ShoppingBag, Sparkles, Ticket, Wand2, type LucideIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api";
import { Button, Card, Spinner } from "@/shared/ui";
import { useShopInventory } from "@/shared/lib/shop";
import type { ShopInventoryResponse, ShopItemResponse, ShopItemType } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";
import coachReviewTokenImage from "@/assets/shop/coach-review-token.png";
import neonMoveTrailImage from "@/assets/shop/neon-move-trail.png";
import tournamentBoardImage from "@/assets/shop/tournament-board.png";
import victoryAccentImage from "@/assets/shop/victory-accent.png";

type ShopCategory = ShopItemType | "all";

interface ShopCategoryOption {
  id: ShopCategory;
  label: string;
  icon: LucideIcon;
}

const assetImages: Record<string, string> = {
  "tournament-board": tournamentBoardImage,
  "arctic-match": neonMoveTrailImage,
  "speed-champion": victoryAccentImage,
  "endgame-lab": neonMoveTrailImage,
  "coach-review-token": coachReviewTokenImage,
};

const categories: ShopCategoryOption[] = [
  { id: "all", label: "All", icon: Layout },
  { id: "board", label: "Boards", icon: Palette },
  { id: "banner", label: "Banners", icon: Flag },
  { id: "effect", label: "Effects", icon: Sparkles },
  { id: "consumable", label: "Consumables", icon: Wand2 },
];

function imageForItem(item: ShopItemResponse) {
  return item.image_url || (item.asset_key ? assetImages[item.asset_key] : null) || tournamentBoardImage;
}

function canEquip(item: ShopItemResponse) {
  return item.type === "board" || item.type === "banner";
}

export default function ShopPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<ShopCategory>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const inventoryQuery = useShopInventory();

  const purchaseMutation = useMutation({
    mutationFn: (itemId: number) => http.post(`/shop/items/${itemId}/purchase`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setNotice("Purchase saved to your inventory.");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Purchase failed."),
  });

  const equipMutation = useMutation({
    mutationFn: (itemId: number) => http.post(`/shop/items/${itemId}/equip`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setNotice("Equipment updated.");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Could not equip item."),
  });

  const inventory: ShopInventoryResponse | undefined = inventoryQuery.data;
  const visibleItems = useMemo(
    () => (inventory?.items ?? []).filter((item) => category === "all" || item.type === category),
    [category, inventory?.items],
  );

  return (
    <AppShell
      eyebrow="Marketplace"
      title="ChessView Market"
      description="Customize your board and profile banner from the backend catalog."
      actions={
        <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200">
          <Coins className="h-4 w-4 text-amber-400" />
          <span className="font-semibold tabular-nums">{inventory?.coins ?? 0}</span>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {categories.map((item) => {
          const CategoryIcon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                category === item.id
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                  : "border-neutral-800 bg-neutral-900/70 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
              }`}
            >
              <CategoryIcon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice ? (
        <div aria-live="polite" className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-200">
          {notice}
        </div>
      ) : null}

      {inventoryQuery.isFetching ? (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-400">
          <Spinner /> Loading marketplace...
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => {
          const isBusy = purchaseMutation.isPending || equipMutation.isPending;
          const ItemIcon = item.consumable ? Ticket : item.equipped ? BadgeCheck : ShoppingBag;

          return (
            <Card key={item.id} className="flex min-h-[220px] flex-col justify-between gap-5">
              <div className="relative h-32 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/70">
                <img src={imageForItem(item)} alt="" className="h-full w-full object-cover opacity-85 transition duration-300 hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-linear-to-t from-neutral-950 via-neutral-950/15 to-transparent" />
                <div className="absolute bottom-3 right-3 rounded-full border border-white/15 bg-neutral-950/80 p-2 backdrop-blur">
                  <ItemIcon className="h-5 w-5 text-violet-200" />
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{item.rarity}</div>
                <h2 className="mt-2 text-lg font-semibold text-neutral-100">{item.name}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{item.description}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                  <Coins className="h-4 w-4" />
                  {item.price}
                </span>
                <Button size="sm" variant={item.owned ? "secondary" : "primary"} disabled={item.owned || isBusy} onClick={() => purchaseMutation.mutate(item.id)}>
                  {item.owned ? "Owned" : "Buy"}
                </Button>
                {item.owned && canEquip(item) ? (
                  <Button size="sm" variant={item.equipped ? "secondary" : "primary"} disabled={item.equipped || isBusy} onClick={() => equipMutation.mutate(item.id)}>
                    {item.equipped ? "Equipped" : "Equip"}
                  </Button>
                ) : null}
                {item.owned && item.consumable ? <span className="text-xs text-neutral-500">Qty {item.quantity}</span> : null}
              </div>
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}
