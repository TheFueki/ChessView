import type { AdminSession, AdminUser } from "../AdminApp";

export const adminUser: AdminUser = {
  id: "admin-1",
  username: "admin",
  email: "admin@example.com",
  rating: 1600,
  role: "admin",
  banned_at: null,
  created_at: "2026-06-01T10:00:00.000Z",
};

export const userAccount = {
  id: "user-1",
  username: "ada",
  email: "ada@example.com",
  rating: 1420,
  role: "user",
  banned_at: null,
  created_at: "2026-06-01T11:00:00.000Z",
};

export const bannedUserAccount = {
  id: "user-2",
  username: "grace",
  email: "grace@example.com",
  rating: 1510,
  role: "user",
  banned_at: "2026-06-02T12:00:00.000Z",
  created_at: "2026-06-01T12:00:00.000Z",
};

export const adminSession: AdminSession = {
  user: adminUser,
  accessToken: "access-token",
  refreshToken: "refresh-token",
};

export const adminDatasets = {
  users: [userAccount, bannedUserAccount],
  tournaments: [
    {
      id: "tournament-1",
      name: "June Swiss",
      status: "registration",
      tournament_type: "swiss",
      entry_fee_cents: 250,
      current_round: 1,
      total_rounds: 5,
    },
  ],
  matches: [
    {
      id: "match-1",
      tournament_id: "tournament-1",
      status: "scheduled",
      starts_at: "2026-06-12T16:00:00.000Z",
      game_id: null,
    },
  ],
  games: [
    {
      id: "game-1",
      status: "active",
      result: null,
      rated: true,
      started_at: "2026-06-10T12:00:00.000Z",
    },
  ],
  shopItems: [
    {
      id: 100,
      name: "Walnut board",
      price: 500,
      type: "board",
      rarity: "rare",
      description: "Wood board",
      image_url: null,
      consumable: false,
    },
  ],
  logs: [
    {
      id: "log-1",
      action: "user.ban",
      target_type: "user",
      target_id: "user-1",
    },
  ],
  payments: [
    {
      id: "payment-1",
      amount_cents: 250,
      status: "succeeded",
      subject_type: "tournament",
    },
  ],
  verificationSessions: [
    {
      id: "verification-1",
      user_id: "user-1",
      game_id: "game-1",
      status: "failed",
    },
  ],
};
