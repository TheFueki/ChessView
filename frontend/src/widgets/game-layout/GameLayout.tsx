import type { ReactNode } from "react";

interface GameLayoutProps {
  board: ReactNode;
  sidebar: ReactNode;
  videoChat: ReactNode;
}

export function GameLayout({ board, sidebar, videoChat }: GameLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-neutral-950 xl:h-screen xl:flex-row">
      <aside className="hidden w-80 flex-shrink-0 flex-col border-r border-neutral-800 lg:flex">
        {videoChat}
      </aside>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-[min(75vh,640px)]">{board}</div>
      </main>

      <aside className="flex w-full flex-shrink-0 flex-col border-t border-neutral-800 xl:w-80 xl:border-l xl:border-t-0">
        {sidebar}
      </aside>
    </div>
  );
}

export default GameLayout;
