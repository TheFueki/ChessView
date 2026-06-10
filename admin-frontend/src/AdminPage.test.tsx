import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "./AdminPage";
import { adminRoutes, installFetchMock } from "./test/http";
import { adminDatasets, adminSession, bannedUserAccount, userAccount } from "./test/fixtures";
import { renderWithQueryClient } from "./test/render";

function renderAdminPage() {
  return renderWithQueryClient(<AdminPage session={adminSession} onLogout={vi.fn()} />);
}

describe("AdminPage data states", () => {
  it("shows stable admin fixtures for users, payments, verification sessions, and audit logs", async () => {
    installFetchMock(adminRoutes());

    renderAdminPage();

    expect(await screen.findByText("ada")).toBeInTheDocument();
    expect(screen.getByText("grace")).toBeInTheDocument();
    expect(screen.getByText("June Swiss")).toBeInTheDocument();
    expect(screen.getByText("Walnut board")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    expect(screen.getByText("user.ban")).toBeInTheDocument();
    expect(screen.getByText(/user user-1/)).toBeInTheDocument();
    expect(screen.getByText(/game game-1/)).toBeInTheDocument();
  });

  it("shows a loading indicator while admin resources are pending", () => {
    installFetchMock(
      adminRoutes({
        "GET /admin/users": new Promise(() => undefined),
      }),
    );

    const { container } = renderAdminPage();

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows request errors, including admin auth failures", async () => {
    installFetchMock(
      adminRoutes({
        "GET /admin/users": new Response("Not authorized", { status: 401 }),
      }),
    );

    renderAdminPage();

    expect(await screen.findByText("Admin access unavailable: Not authorized")).toBeInTheDocument();
  });
});

describe("AdminPage user actions", () => {
  it("bans and unbans users through the admin action endpoints", async () => {
    const user = userEvent.setup();
    const { calls } = installFetchMock(
      adminRoutes({
        "POST /admin/users/user-1/ban": { ...userAccount, banned_at: "2026-06-10T10:00:00.000Z" },
        "POST /admin/users/user-2/unban": { ...bannedUserAccount, banned_at: null },
      }),
    );

    renderAdminPage();

    await screen.findByText("ada");
    await user.click(screen.getByRole("button", { name: "Ban ada" }));
    await user.click(screen.getByRole("button", { name: "Unban grace" }));

    await waitFor(() => {
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: "POST", path: "/admin/users/user-1/ban", body: {}, authorization: "Bearer access-token" }),
          expect.objectContaining({ method: "POST", path: "/admin/users/user-2/unban", body: {}, authorization: "Bearer access-token" }),
        ]),
      );
    });
  });

  it("changes roles through the backend role endpoint", async () => {
    const user = userEvent.setup();
    const { calls } = installFetchMock(
      adminRoutes({
        "POST /admin/users/user-1/role": { ...userAccount, role: "admin" },
      }),
    );

    renderAdminPage();

    await screen.findByText("ada");
    const adaRow = screen.getByText("ada").closest("div.rounded-lg");
    expect(adaRow).not.toBeNull();

    await user.click(within(adaRow as HTMLElement).getByRole("button", { name: "Role" }));

    await waitFor(() => {
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: "POST",
            path: "/admin/users/user-1/role",
            body: { role: "admin" },
            authorization: "Bearer access-token",
          }),
        ]),
      );
    });
    expect(calls).not.toEqual(expect.arrayContaining([expect.objectContaining({ method: "PATCH", path: "/admin/users/user-1" })]));
  });
});

describe("AdminPage payment actions", () => {
  it("refunds payments through the refund endpoint", async () => {
    const user = userEvent.setup();
    const { calls } = installFetchMock(
      adminRoutes({
        "POST /admin/payments/payment-1/refund": { ...adminDatasets.payments[0], status: "refunded" },
      }),
    );

    renderAdminPage();

    await screen.findByText("succeeded");
    await user.click(screen.getByRole("button", { name: /Refund/ }));

    await waitFor(() => {
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ method: "POST", path: "/admin/payments/payment-1/refund", body: {}, authorization: "Bearer access-token" }),
        ]),
      );
    });
  });
});
