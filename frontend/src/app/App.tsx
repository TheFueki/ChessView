/**
 * Root application component.
 *
 * Composes providers + router. This is the only file that
 * touches both providers and routing.
 *
 * FSD layer: app
 */

import { AppErrorBoundary } from "./AppErrorBoundary";
import { Providers } from "./providers";
import AppRouter from "./router";
import "./styles/globals.css";

export default function App() {
  return (
    <Providers>
      <AppErrorBoundary>
        <AppRouter />
      </AppErrorBoundary>
    </Providers>
  );
}
