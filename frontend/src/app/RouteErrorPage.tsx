import { AlertTriangle, Crown } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Button, Card } from "@/shared/ui";

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    if (typeof error.data === "string" && error.data.trim()) {
      return error.data;
    }

    if (error.statusText) {
      return error.statusText;
    }

    return `Request failed with status ${error.status}.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected route error occurred.";
}

export default function RouteErrorPage() {
  const navigate = useNavigate();
  const error = useRouteError();

  console.error("[RouteErrorPage] Route error", error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
      <Card className="w-full max-w-xl space-y-5 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-7 w-7 text-amber-300" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-neutral-200">
            <Crown className="h-5 w-5 text-violet-500" />
            <span className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-400">ChessView</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">This page hit a problem</h1>
          <p className="text-sm leading-6 text-neutral-400">{getErrorMessage(error)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate(0)}>Retry</Button>
          <Button variant="secondary" onClick={() => navigate("/")}>
            Back to Lobby
          </Button>
        </div>
      </Card>
    </div>
  );
}
