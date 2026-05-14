import { type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut, RotateCcw, Shield, Undo2 } from "lucide-react";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type {
  AdminAuditLogResponse,
  AdminUserResponse,
  FaceVerificationSessionResponse,
  PaymentIntentResponse,
} from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";

function AdminShell({ children }: { children: ReactNode }) {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-950/95">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900">
              <Shield className="h-5 w-5 text-neutral-300" />
            </div>
            <div>
              <div className="text-sm font-semibold text-neutral-100">ChessView Admin</div>
              <div className="text-xs text-neutral-500">Separated operations service</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user ? <div className="text-sm text-neutral-400">{user.username}</div> : null}
            <Button variant="secondary" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-8">
        <section className="grid gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project control</div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-100">Admin</h1>
          <p className="max-w-3xl text-sm leading-6 text-neutral-400">
            Review users, wallet payments, verification sessions, and audit history from a dedicated admin package.
          </p>
        </section>

        {children}
      </main>
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: () => http.get<AdminUserResponse[]>("/admin/users") });
  const logsQuery = useQuery({ queryKey: ["admin-logs"], queryFn: () => http.get<AdminAuditLogResponse[]>("/admin/logs") });
  const paymentsQuery = useQuery({ queryKey: ["admin-payments"], queryFn: () => http.get<PaymentIntentResponse[]>("/admin/payments") });
  const verificationQuery = useQuery({
    queryKey: ["admin-face-verification-issues"],
    queryFn: () => http.get<FaceVerificationSessionResponse[]>("/admin/face-verification/sessions"),
  });
  const adminError = usersQuery.error ?? logsQuery.error ?? paymentsQuery.error ?? verificationQuery.error;

  const userAction = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "ban" | "unban" }) => http.post<AdminUserResponse>(`/admin/users/${id}/${verb}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });

  const refund = useMutation({
    mutationFn: (id: string) => http.post<PaymentIntentResponse>(`/admin/payments/${id}/refund`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });

  return (
    <AdminShell>
      <section className="grid gap-6 lg:grid-cols-2">
        {adminError ? (
          <Card className="border-red-500/20 bg-red-950/10 text-sm text-red-300 lg:col-span-2">
            Admin access unavailable: {adminError instanceof Error ? adminError.message : "request failed"}
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Users</h2>
          {usersQuery.isLoading ? <Spinner /> : (
            <div className="space-y-3">
              {(usersQuery.data ?? []).map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-neutral-400">{user.email} / {user.role}</div>
                  </div>
                  <Button size="sm" variant={user.banned_at ? "secondary" : "danger"} onClick={() => userAction.mutate({ id: user.id, verb: user.banned_at ? "unban" : "ban" })}>
                    {user.banned_at ? <RotateCcw size={14} /> : <Ban size={14} />}
                    {user.banned_at ? "Unban" : "Ban"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold">Payments</h2>
          {paymentsQuery.isLoading ? <Spinner /> : (
            <div className="space-y-3">
              {(paymentsQuery.data ?? []).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 p-3">
                  <div>
                    <div className="font-medium">{payment.status}</div>
                    <div className="text-xs text-neutral-400">
                      {payment.amount_cents.toLocaleString()} coins / {payment.subject_type}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => refund.mutate(payment.id)}>
                    <Undo2 size={14} /> Refund
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Verification Issues</h2>
        {verificationQuery.isLoading ? <Spinner /> : (
          <div className="space-y-2">
            {(verificationQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-neutral-400">No verification sessions.</p>
            ) : (
              (verificationQuery.data ?? []).map((session) => (
                <div key={session.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
                  <span className="font-medium">{session.status}</span>
                  <span className="text-neutral-400"> / user {session.user_id}</span>
                  {session.game_id ? <span className="text-neutral-400"> / game {session.game_id}</span> : null}
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-semibold">Audit Logs</h2>
        <div className="space-y-2">
          {(logsQuery.data ?? []).map((log) => (
            <div key={log.id} className="rounded-lg border border-neutral-800 p-3 text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-neutral-400"> on {log.target_type}:{log.target_id}</span>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
