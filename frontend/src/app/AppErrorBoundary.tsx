import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Crown } from "lucide-react";
import { Button, Card } from "@/shared/ui";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Unhandled render error", error, errorInfo);
    this.setState({ message: error.message });
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  private reloadPage = () => {
    window.location.reload();
  };

  private handleWindowError = (event: ErrorEvent) => {
    console.error("[AppErrorBoundary] Window error", event.error ?? event.message);
    this.setState({
      hasError: true,
      message: event.error instanceof Error ? event.error.message : event.message || "Unexpected runtime error",
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("[AppErrorBoundary] Unhandled promise rejection", event.reason);
    this.setState({
      hasError: true,
      message: event.reason instanceof Error ? event.reason.message : "Unexpected async error",
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6">
        <Card className="w-full max-w-xl space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <AlertTriangle className="h-7 w-7 text-red-300" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-neutral-200">
              <Crown className="h-5 w-5 text-violet-500" />
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-400">ChessView</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Something went wrong</h1>
            <p className="text-sm leading-6 text-neutral-400">
              The app hit an unexpected error. Your account and saved games are safe, and reloading usually recovers the session.
            </p>
            {this.state.message ? <p className="text-xs text-neutral-500">{this.state.message}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={this.reloadPage}>Reload App</Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/")}>
              Back to Lobby
            </Button>
          </div>
        </Card>
      </div>
    );
  }
}
