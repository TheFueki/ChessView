import { useMemo, useState } from "react";
import { BadgeCheck, BookOpen, Coins, Layout, Palette, ShoppingBag, Sparkles, Ticket, UserCircle, Wand2, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/shared/api";
import { Button, Card } from "@/shared/ui";
import type { ProfileResponse } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";

type ShopItemType = "board" | "avatar" | "effect" | "training" | "boost";
type ShopCategory = ShopItemType | "all";

interface ShopItem {
  id: number;
  name: string;
  price: number;
  type: ShopItemType;
  rarity: "common" | "rare" | "epic" | "legendary";
  description: string;
  consumable?: boolean;
}

interface ShopCategoryOption {
  id: ShopCategory;
  label: string;
  icon: LucideIcon;
}

const shopItems: ShopItem[] = [
  { id: 1, name: "Tournament Board", price: 500, type: "board", rarity: "rare", description: "A restrained green board tuned for long rated sessions." },
  { id: 2, name: "Profile Frame", price: 1200, type: "avatar", rarity: "epic", description: "A metallic profile frame for leaderboard and lobby surfaces." },
  { id: 3, name: "Classic Pieces", price: 150, type: "board", rarity: "common", description: "Readable pieces for rapid games and review." },
  { id: 4, name: "Victory Accent", price: 5000, type: "effect", rarity: "legendary", description: "A subtle win-state accent for post-game overlays." },
  { id: 5, name: "Opening Lab Pass", price: 900, type: "training", rarity: "rare", description: "Unlocks a focused opening prep pack in the analysis hub.", consumable: true },
  { id: 6, name: "Blunder Shield", price: 650, type: "boost", rarity: "epic", description: "Adds one extra review hint to the next training game.", consumable: true },
  { id: 7, name: "Neon Move Trail", price: 1800, type: "effect", rarity: "epic", description: "Highlights your last move with a sharper animated trail." },
  { id: 8, name: "Coach Review Token", price: 750, type: "training", rarity: "rare", description: "Marks one completed game for deeper review.", consumable: true },
];

const categories: ShopCategoryOption[] = [
  { id: "all", label: "All", icon: Layout },
  { id: "board", label: "Boards", icon: Palette },
  { id: "avatar", label: "Avatars", icon: UserCircle },
  { id: "effect", label: "Effects", icon: Sparkles },
  { id: "training", label: "Training", icon: BookOpen },
  { id: "boost", label: "Boosts", icon: Wand2 },
];

const SHOP_STORAGE_KEY = "chessview.shop.inventory.v1";

function readShopState() {
  if (typeof window === "undefined") {
    return { ownedItemIds: [] as number[], equippedItemId: null as number | null, usedItemIds: [] as number[], spentCoins: 0 };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SHOP_STORAGE_KEY) ?? "{}") as Partial<{
      ownedItemIds: number[];
      equippedItemId: number | null;
      usedItemIds: number[];
      spentCoins: number;
    }>;

    return {
      ownedItemIds: Array.isArray(parsed.ownedItemIds) ? parsed.ownedItemIds : [],
      equippedItemId: typeof parsed.equippedItemId === "number" ? parsed.equippedItemId : null,
      usedItemIds: Array.isArray(parsed.usedItemIds) ? parsed.usedItemIds : [],
      spentCoins: typeof parsed.spentCoins === "number" ? parsed.spentCoins : 0,
    };
  } catch {
    return { ownedItemIds: [] as number[], equippedItemId: null as number | null, usedItemIds: [] as number[], spentCoins: 0 };
  }
}

function writeShopState(state: ReturnType<typeof readShopState>) {
  window.localStorage.setItem(SHOP_STORAGE_KEY, JSON.stringify(state));
}

export default function ShopPage() {
  const [category, setCategory] = useState<ShopCategory>("all");
  const [shopState, setShopState] = useState(readShopState);
  const [notice, setNotice] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ["marketplace-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const { ownedItemIds, equippedItemId, usedItemIds, spentCoins } = shopState;
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

    setShopState((currentState) => {
      const nextState = {
        ...currentState,
        ownedItemIds: [...currentState.ownedItemIds, item.id],
        spentCoins: currentState.spentCoins + item.price,
      };
      writeShopState(nextState);
      return nextState;
    });
    setNotice(`Purchased ${item.name}.`);
  };

  const handleUseOrEquipItem = (item: ShopItem) => {
    if (!ownedItemIds.includes(item.id)) {
      setNotice(`Buy ${item.name} before using it.`);
      return;
    }

    if (item.consumable) {
      if (usedItemIds.includes(item.id)) {
        setNotice(`${item.name} has already been used.`);
        return;
      }
      setShopState((currentState) => {
        const nextState = { ...currentState, usedItemIds: [...currentState.usedItemIds, item.id] };
        writeShopState(nextState);
        return nextState;
      });
      setNotice(`${item.name} queued for your next session.`);
      return;
    }

    setShopState((currentState) => {
      const nextState = { ...currentState, equippedItemId: item.id };
      writeShopState(nextState);
      return nextState;
    });
    setNotice(`${item.name} equipped.`);
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
          const isEquipped = equippedItemId === item.id;
          const isUsed = usedItemIds.includes(item.id);
          const ItemIcon = item.consumable ? Ticket : isEquipped ? BadgeCheck : ShoppingBag;

          return (
            <Card key={item.id} className="flex min-h-[220px] flex-col justify-between gap-5">
              <div className="flex h-24 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/70">
                <ItemIcon className="h-9 w-9 text-violet-300" />
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
                <Button size="sm" variant={isOwned ? "secondary" : "primary"} disabled={isOwned} onClick={() => buyItem(item)}>
                  {isOwned ? "Owned" : canAfford ? "Buy" : "Need coins"}
                </Button>
                {isOwned ? (
                  <Button
                    size="sm"
                    variant={isEquipped || isUsed ? "secondary" : "primary"}
                    disabled={isEquipped || isUsed}
                    onClick={() => handleUseOrEquipItem(item)}
                  >
                    {item.consumable ? (isUsed ? "Queued" : "Use") : isEquipped ? "Equipped" : "Equip"}
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}
