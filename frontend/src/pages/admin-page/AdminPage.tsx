import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, RotateCcw, Shield, Undo2 } from "lucide-react";
import { http } from "@/shared/api";
import type {
  AdminAuditLogResponse,
  AdminUserResponse,
  FaceVerificationSessionResponse,
  PaymentIntentResponse,
} from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";

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
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-neutral-100">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header>
          <div className="flex items-center gap-3 text-emerald-400">
            <Shield size={22} />
            <span className="text-sm uppercase tracking-wide">Project control</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold">Admin</h1>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          {adminError && (
            <Card className="border-red-500/20 bg-red-950/10 text-sm text-red-300 lg:col-span-2">
              Admin access unavailable: {adminError instanceof Error ? adminError.message : "request failed"}
            </Card>
          )}

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
                      <div className="text-xs text-neutral-400">{payment.amount_cents} {payment.currency} / {payment.tournament_id}</div>
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
                    {session.game_id && <span className="text-neutral-400"> / game {session.game_id}</span>}
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
      </div>
    </main>
  );
}
