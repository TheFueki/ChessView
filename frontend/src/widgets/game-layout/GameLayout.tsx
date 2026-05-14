import type { ReactNode } from "react";

interface GameLayoutProps {
  board: ReactNode;
  sidebar: ReactNode;
  videoChat: ReactNode;
}

export function GameLayout({ board, sidebar, videoChat }: GameLayoutProps) {
  return (
    <div className="game-layout flex min-h-screen w-full flex-col overflow-x-hidden bg-neutral-950 xl:h-screen xl:flex-row">
      <aside className="hidden w-80 min-w-0 flex-shrink-0 flex-col overflow-hidden border-r border-neutral-800 lg:flex">
        {videoChat}
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center overflow-x-hidden p-3 sm:p-4">
        <div className="w-full max-w-[min(100%,calc(100vh-2rem),640px)]">
          {board}
        </div>
      </main>

      <aside className="flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-t border-neutral-800 xl:w-80 xl:border-l xl:border-t-0">
        {sidebar}
      </aside>
    </div>
  );
}

export default GameLayout;
