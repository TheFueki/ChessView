import { type FormEvent, type ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut, Plus, RotateCcw, Shield, Trash2, Undo2 } from "lucide-react";
import {
  type AdminSession,
  AdminButton,
  AdminCard,
  AdminSpinner,
  adminCreate,
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
} from "./AdminApp";

interface AdminUserResponse {
  id: string;
  username: string;
  email: string;
  rating: number;
  role: string;
  banned_at?: string | null;
}

interface TournamentResponse {
  id: string;
  name: string;
  status: string;
  tournament_type: string;
  entry_fee_cents: number;
  current_round: number;
  total_rounds: number;
}

interface PaymentIntentResponse {
  id: string;
  amount_cents: number;
  status: string;
  subject_type: string;
}

interface FaceVerificationSessionResponse {
  id: string;
  user_id: string;
  game_id?: string | null;
  status: string;
}

interface ScheduledMatchResponse {
  id: string;
  tournament_id?: string | null;
  status: string;
  starts_at: string;
  game_id?: string | null;
}

interface GameResponse {
  id: string;
  status: string;
  result?: string | null;
  rated: boolean;
  started_at: string;
}

interface ShopItem {
  id: number;
  name: string;
  price: number;
  type: string;
  rarity: string;
  description: string;
  image_url?: string | null;
  consumable: boolean;
}

interface AdminAuditLogResponse {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
}

function AdminShell({ children, session, onLogout }: { children: ReactNode; session: AdminSession; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-950/95">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900">
              <Shield className="h-5 w-5 text-neutral-300" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">ChessView Admin</div>
              <div className="text-xs text-neutral-500">Operations controls</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-neutral-400">{session.user.username}</div>
            <AdminButton variant="secondary" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </AdminButton>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8">
        <section className="grid gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project control</div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-100">Admin</h1>
          <p className="max-w-3xl text-sm leading-6 text-neutral-400">
            Users, tournaments, OTB schedules, games, payments, verification, audit logs, and market catalog.
          </p>
        </section>
        {children}
      </main>
    </div>
  );
}

function ResourceCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <AdminCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action}
      </div>
      <div className="max-h-[29rem] space-y-3 overflow-y-auto pr-1">{children}</div>
    </AdminCard>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-400" {...props} />;
}

export default function AdminPage({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const token = session.accessToken;
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "password123", role: "user" });
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newShopItem, setNewShopItem] = useState({ id: 100, name: "", price: 100, type: "board", rarity: "common", description: "" });

  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => adminGet<AdminUserResponse[]>("/admin/users", token) });
  const tournamentsQuery = useQuery({ queryKey: ["admin-tournaments"], queryFn: () => adminGet<TournamentResponse[]>("/admin/tournaments", token) });
  const matchesQuery = useQuery({ queryKey: ["admin-scheduled-matches"], queryFn: () => adminGet<ScheduledMatchResponse[]>("/admin/scheduled-matches", token) });
  const gamesQuery = useQuery({ queryKey: ["admin-games"], queryFn: () => adminGet<GameResponse[]>("/admin/games", token) });
  const shopQuery = useQuery({ queryKey: ["admin-shop-items"], queryFn: () => adminGet<ShopItem[]>("/admin/shop-items", token) });
  const logsQuery = useQuery({ queryKey: ["admin-logs"], queryFn: () => adminGet<AdminAuditLogResponse[]>("/admin/logs", token) });
  const paymentsQuery = useQuery({ queryKey: ["admin-payments"], queryFn: () => adminGet<PaymentIntentResponse[]>("/admin/payments", token) });
  const verificationQuery = useQuery({ queryKey: ["admin-face-verification-issues"], queryFn: () => adminGet<FaceVerificationSessionResponse[]>("/admin/face-verification/sessions", token) });
  const adminError = usersQuery.error ?? tournamentsQuery.error ?? matchesQuery.error ?? gamesQuery.error ?? shopQuery.error ?? logsQuery.error ?? paymentsQuery.error ?? verificationQuery.error;

  const invalidate = async (...keys: string[]) => {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    await queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
  };

  const createUser = useMutation({
    mutationFn: () => adminCreate<AdminUserResponse>("/admin/users", { ...newUser, rating: 1200, coins: 2000 }, token),
    onSuccess: async () => {
      setNewUser({ username: "", email: "", password: "password123", role: "user" });
      await invalidate("admin-users");
    },
  });
  const userAction = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "ban" | "unban" }) => adminPost<AdminUserResponse>(`/admin/users/${id}/${verb}`, token),
    onSuccess: async () => invalidate("admin-users"),
  });
  const patchUser = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => adminPatch<AdminUserResponse>(`/admin/users/${id}`, body, token),
    onSuccess: async () => invalidate("admin-users"),
  });
  const deleteUser = useMutation({ mutationFn: (id: string) => adminDelete(`/admin/users/${id}`, token), onSuccess: async () => invalidate("admin-users") });

  const createTournament = useMutation({
    mutationFn: () => adminCreate<TournamentResponse>("/admin/tournaments", { name: newTournamentName || "Admin tournament" }, token),
    onSuccess: async () => {
      setNewTournamentName("");
      await invalidate("admin-tournaments");
    },
  });
  const patchTournament = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => adminPatch<TournamentResponse>(`/admin/tournaments/${id}`, body, token),
    onSuccess: async () => invalidate("admin-tournaments"),
  });
  const deleteTournament = useMutation({ mutationFn: (id: string) => adminDelete(`/admin/tournaments/${id}`, token), onSuccess: async () => invalidate("admin-tournaments") });

  const patchMatch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => adminPatch<ScheduledMatchResponse>(`/admin/scheduled-matches/${id}`, body, token),
    onSuccess: async () => invalidate("admin-scheduled-matches"),
  });
  const deleteMatch = useMutation({ mutationFn: (id: string) => adminDelete(`/admin/scheduled-matches/${id}`, token), onSuccess: async () => invalidate("admin-scheduled-matches") });

  const patchGame = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => adminPatch<GameResponse>(`/admin/games/${id}`, body, token),
    onSuccess: async () => invalidate("admin-games"),
  });
  const deleteGame = useMutation({ mutationFn: (id: string) => adminDelete(`/admin/games/${id}`, token), onSuccess: async () => invalidate("admin-games") });

  const createShopItem = useMutation({
    mutationFn: () => adminCreate<ShopItem>("/admin/shop-items", { ...newShopItem, image_url: null, consumable: false }, token),
    onSuccess: async () => {
      setNewShopItem({ id: newShopItem.id + 1, name: "", price: 100, type: "board", rarity: "common", description: "" });
      await invalidate("admin-shop-items");
    },
  });
  const patchShopItem = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => adminPatch<ShopItem>(`/admin/shop-items/${id}`, body, token),
    onSuccess: async () => invalidate("admin-shop-items"),
  });
  const deleteShopItem = useMutation({ mutationFn: (id: number) => adminDelete(`/admin/shop-items/${id}`, token), onSuccess: async () => invalidate("admin-shop-items") });
  const refund = useMutation({ mutationFn: (id: string) => adminPost<PaymentIntentResponse>(`/admin/payments/${id}/refund`, token), onSuccess: async () => invalidate("admin-payments") });

  const handleUserCreate = (event: FormEvent) => {
    event.preventDefault();
    createUser.mutate();
  };
  const handleTournamentCreate = (event: FormEvent) => {
    event.preventDefault();
    createTournament.mutate();
  };
  const handleShopCreate = (event: FormEvent) => {
    event.preventDefault();
    createShopItem.mutate();
  };

  return (
    <AdminShell session={session} onLogout={onLogout}>
      {adminError ? (
        <AdminCard className="border-red-500/20 bg-red-950/10 text-sm text-red-300">
          Admin access unavailable: {adminError instanceof Error ? adminError.message : "request failed"}
        </AdminCard>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <ResourceCard title="Users">
          <form onSubmit={handleUserCreate} className="grid gap-2 rounded-lg border border-neutral-800 p-3 sm:grid-cols-2">
            <TextInput placeholder="username" value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} required />
            <TextInput placeholder="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required />
            <TextInput placeholder="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required />
            <select className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <AdminButton type="submit" className="sm:col-span-2"><Plus size={14} /> Create user</AdminButton>
          </form>
          {usersQuery.isLoading ? <AdminSpinner /> : (usersQuery.data ?? []).map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{user.username}</div>
                <div className="truncate text-xs text-neutral-400">{user.email} / {user.role} / {user.rating}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" onClick={() => patchUser.mutate({ id: user.id, body: { role: user.role === "admin" ? "user" : "admin" } })}>Role</AdminButton>
                <AdminButton variant={user.banned_at ? "secondary" : "danger"} onClick={() => userAction.mutate({ id: user.id, verb: user.banned_at ? "unban" : "ban" })}>
                  {user.banned_at ? <RotateCcw size={14} /> : <Ban size={14} />}
                </AdminButton>
                <AdminButton variant="danger" onClick={() => window.confirm("Delete user?") && deleteUser.mutate(user.id)}><Trash2 size={14} /></AdminButton>
              </div>
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="Tournaments">
          <form onSubmit={handleTournamentCreate} className="flex gap-2 rounded-lg border border-neutral-800 p-3">
            <TextInput className="min-w-0 flex-1" placeholder="Tournament name" value={newTournamentName} onChange={(event) => setNewTournamentName(event.target.value)} />
            <AdminButton type="submit"><Plus size={14} /> Create</AdminButton>
          </form>
          {tournamentsQuery.isLoading ? <AdminSpinner /> : (tournamentsQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.name}</div>
                <div className="text-xs text-neutral-400">{item.status} / {item.tournament_type} / round {item.current_round}/{item.total_rounds}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" onClick={() => patchTournament.mutate({ id: item.id, body: { status: item.status === "finished" ? "registration" : "finished" } })}>Status</AdminButton>
                <AdminButton variant="danger" onClick={() => window.confirm("Delete tournament?") && deleteTournament.mutate(item.id)}><Trash2 size={14} /></AdminButton>
              </div>
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="OTB / Scheduled Matches">
          {matchesQuery.isLoading ? <AdminSpinner /> : (matchesQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.status}</div>
                <div className="truncate text-xs text-neutral-400">{new Date(item.starts_at).toLocaleString()} / game {item.game_id ?? "none"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" onClick={() => patchMatch.mutate({ id: item.id, body: { status: item.status === "cancelled" ? "scheduled" : "cancelled" } })}>Toggle</AdminButton>
                <AdminButton variant="danger" onClick={() => window.confirm("Delete match?") && deleteMatch.mutate(item.id)}><Trash2 size={14} /></AdminButton>
              </div>
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="Games">
          {gamesQuery.isLoading ? <AdminSpinner /> : (gamesQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.status} {item.result ? `/ ${item.result}` : ""}</div>
                <div className="truncate text-xs text-neutral-400">{item.rated ? "rated" : "casual"} / {new Date(item.started_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" onClick={() => patchGame.mutate({ id: item.id, body: { status: "finished", result: item.result ?? "1/2-1/2" } })}>Finish</AdminButton>
                <AdminButton variant="danger" onClick={() => window.confirm("Delete game?") && deleteGame.mutate(item.id)}><Trash2 size={14} /></AdminButton>
              </div>
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="Store">
          <form onSubmit={handleShopCreate} className="grid gap-2 rounded-lg border border-neutral-800 p-3 sm:grid-cols-2">
            <TextInput type="number" value={newShopItem.id} onChange={(event) => setNewShopItem({ ...newShopItem, id: Number(event.target.value) })} />
            <TextInput placeholder="name" value={newShopItem.name} onChange={(event) => setNewShopItem({ ...newShopItem, name: event.target.value })} required />
            <TextInput type="number" placeholder="price" value={newShopItem.price} onChange={(event) => setNewShopItem({ ...newShopItem, price: Number(event.target.value) })} />
            <TextInput placeholder="type" value={newShopItem.type} onChange={(event) => setNewShopItem({ ...newShopItem, type: event.target.value })} />
            <TextInput placeholder="rarity" value={newShopItem.rarity} onChange={(event) => setNewShopItem({ ...newShopItem, rarity: event.target.value })} />
            <TextInput placeholder="description" value={newShopItem.description} onChange={(event) => setNewShopItem({ ...newShopItem, description: event.target.value })} />
            <AdminButton type="submit" className="sm:col-span-2"><Plus size={14} /> Create item</AdminButton>
          </form>
          {shopQuery.isLoading ? <AdminSpinner /> : (shopQuery.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.name}</div>
                <div className="truncate text-xs text-neutral-400">{item.price} coins / {item.type} / {item.rarity}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="secondary" onClick={() => patchShopItem.mutate({ id: item.id, body: { price: item.price + 100 } })}>+100</AdminButton>
                <AdminButton variant="danger" onClick={() => window.confirm("Delete item?") && deleteShopItem.mutate(item.id)}><Trash2 size={14} /></AdminButton>
              </div>
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="Payments">
          {paymentsQuery.isLoading ? <AdminSpinner /> : (paymentsQuery.data ?? []).map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
              <div>
                <div className="font-medium">{payment.status}</div>
                <div className="text-xs text-neutral-400">{payment.amount_cents.toLocaleString()} coins / {payment.subject_type}</div>
              </div>
              <AdminButton variant="secondary" onClick={() => refund.mutate(payment.id)}><Undo2 size={14} /> Refund</AdminButton>
            </div>
          ))}
        </ResourceCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ResourceCard title="Verification Issues">
          {verificationQuery.isLoading ? <AdminSpinner /> : (verificationQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-neutral-400">No verification sessions.</p>
          ) : (verificationQuery.data ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
              <span className="font-medium">{item.status}</span>
              <span className="text-neutral-400"> / user {item.user_id}</span>
              {item.game_id ? <span className="text-neutral-400"> / game {item.game_id}</span> : null}
            </div>
          ))}
        </ResourceCard>

        <ResourceCard title="Audit Logs">
          {(logsQuery.data ?? []).map((log) => (
            <div key={log.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-neutral-400"> on {log.target_type}:{log.target_id}</span>
            </div>
          ))}
        </ResourceCard>
      </section>
    </AdminShell>
  );
}
