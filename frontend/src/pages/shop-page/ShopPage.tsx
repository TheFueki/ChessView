import { useMemo, useState } from "react";
import { Coins, Layout, Palette, ShoppingBag, Sparkles, UserCircle, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/shared/api";
import { Button, Card } from "@/shared/ui";
import type { ProfileResponse } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";

type ShopItemType = "board" | "avatar" | "effect";
type ShopCategory = ShopItemType | "all";

interface ShopItem {
  id: number;
  name: string;
  price: number;
  type: ShopItemType;
  rarity: "common" | "rare" | "epic" | "legendary";
}

interface ShopCategoryOption {
  id: ShopCategory;
  label: string;
  icon: LucideIcon;
}

const shopItems: ShopItem[] = [
  { id: 1, name: "Tournament Board", price: 500, type: "board", rarity: "rare" },
  { id: 2, name: "Profile Frame", price: 1200, type: "avatar", rarity: "epic" },
  { id: 3, name: "Classic Pieces", price: 150, type: "board", rarity: "common" },
  { id: 4, name: "Victory Accent", price: 5000, type: "effect", rarity: "legendary" },
];

const categories: ShopCategoryOption[] = [
  { id: "all", label: "All", icon: Layout },
  { id: "board", label: "Boards", icon: Palette },
  { id: "avatar", label: "Avatars", icon: UserCircle },
  { id: "effect", label: "Effects", icon: Sparkles },
];

export default function ShopPage() {
  const [category, setCategory] = useState<ShopCategory>("all");
  const [ownedItemIds, setOwnedItemIds] = useState<number[]>([]);
  const [spentCoins, setSpentCoins] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["marketplace-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const coinBalance = Math.max((profileQuery.data?.coins ?? 0) - spentCoins, 0);
  const visibleItems = useMemo(
    () => shopItems.filter((item) => category === "all" || item.type === category),
    [category],
  );

  const buyItem = (item: ShopItem) => {
    if (ownedItemIds.includes(item.id)) {
      setNotice(`${item.name} is already in your inventory.`);
      return;
    }

    if (item.price > coinBalance) {
      setNotice(`Not enough coins for ${item.name}.`);
      return;
    }

    setOwnedItemIds((currentItems) => [...currentItems, item.id]);
    setSpentCoins((currentSpend) => currentSpend + item.price);
    setNotice(`Purchased ${item.name}.`);
  };

  return (
    <AppShell
      eyebrow="Marketplace"
      title="ChessView Market"
      description="Customize your board, profile, and match presence with one consistent ChessView style."
      actions={
        <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200">
          <Coins className="h-4 w-4 text-amber-400" />
          <span className="font-semibold tabular-nums">{coinBalance}</span>
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

      {notice && (
        <div
          aria-live="polite"
          className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-200"
        >
          {notice}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibleItems.map((item) => {
          const isOwned = ownedItemIds.includes(item.id);
          const canAfford = item.price <= coinBalance;

          return (
            <Card key={item.id} className="flex min-h-[220px] flex-col justify-between gap-5">
              <div className="flex h-24 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/70">
                <ShoppingBag className="h-9 w-9 text-violet-300" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">{item.rarity}</div>
                <h2 className="mt-2 text-lg font-semibold text-neutral-100">{item.name}</h2>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                  <Coins className="h-4 w-4" />
                  {item.price}
                </span>
                <Button size="sm" variant={isOwned ? "secondary" : "primary"} disabled={isOwned} onClick={() => buyItem(item)}>
                  {isOwned ? "Owned" : canAfford ? "Buy" : "Need coins"}
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}
