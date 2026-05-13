import React, { useState } from "react";
import { 
  Rocket, Zap, Clock, ChevronRight, Wand2, Layers, Cpu, Globe, ArrowLeft, Search, TimerReset 
} from "lucide-react";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useJoinMatchmaking } from "@/features/join-matchmaking";
import { useLeaveMatchmaking } from "@/features/leave-matchmaking";
import type { TimeControlKey } from "@/shared/types";
import { Button, Card } from "@/shared/ui";

const CATEGORIES = [
  {
    id: 'classic',
    name: 'Classical controls',
    icon: <Clock size={20} />,
    modes: [
      { id: 'bullet', title: 'Bullet', icon: <Rocket size={24} />, desc: 'Speed of light', color: '#ef4444', presets: ['1+0', '1+1','1+2', '2+1'] },
      { id: 'blitz', title: 'Blitz', icon: <Zap size={24} />, desc: 'Golden standard', color: '#eab308', presets: ['3+0', '3+1', '3+2', '5+0'] },
      { id: 'rapid', title: 'Rapid', icon: <Layers size={24} />, desc: 'For strategists', color: '#3b82f6', presets: ['5+3', '10+0', '15+0', '15+10'] },
    ]
  },
  {
    id: 'variants',
    name: 'Chess variants',
    icon: <Wand2 size={20} />,
    modes: [
      { id: 'chess960', title: 'Chess 960', icon: <Cpu size={24} />, desc: 'Fischer Random', color: '#8b5cf6', presets: ['3+2', '5+3'] },
    ]
  }
];

interface GameMode {
  id: string;
  title: string;
  icon: React.ReactNode;
  desc: string;
  color: string;
  presets: string[];
}

export function MatchmakingPanel() {
  const { joinQueue } = useJoinMatchmaking();
  const { leaveQueue } = useLeaveMatchmaking();
  
  const queueStatus = useMatchmakingStore((state) => state.queueStatus);
  const queuePosition = useMatchmakingStore((state) => state.queuePosition);
  const selectedTimeControl = useMatchmakingStore((state) => state.selectedTimeControl);
  const setSelectedTimeControl = useMatchmakingStore((state) => state.setSelectedTimeControl);
  const connectionState = useMatchmakingStore((state) => state.connectionState);
  const lastError = useMatchmakingStore((state) => state.lastError);

  const [expandedCategory, setExpandedCategory] = useState<string | null>('classic');
  const [viewStep, setViewStep] = useState<'modes' | 'times'>('modes');
  const [activeMode, setActiveMode] = useState<GameMode | null>(null);

  const isBusy = queueStatus === "joining" || queueStatus === "leaving";
  const isQueued = queueStatus === "queued" || queueStatus === "joining" || queueStatus === "leaving";

  const handleSelectTime = (time: string) => {
    setSelectedTimeControl(time as TimeControlKey);
  };

  const statusLabel =
    queueStatus === "joining" ? "Joining queue..." :
    queueStatus === "queued" ? `Searching... ${queuePosition ? `#${queuePosition}` : ""}` :
    queueStatus === "leaving" ? "Leaving queue..." :
    connectionState === "connecting" ? "Connecting..." :
    connectionState === "open" ? "Ready for battle" : "Offline";

  return (
    <Card className="flex flex-col gap-6 p-6 overflow-hidden min-h-[500px]">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-emerald-500/10 text-emerald-500 ${isQueued ? 'animate-pulse' : ''}`}>
            <Search size={20} />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-bold text-neutral-100">Matchmaking</h2>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={`h-1.5 w-1.5 rounded-full ${connectionState === 'open' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {statusLabel}
            </div>
          </div>
        </div>
        {isQueued && (
          <Button variant="secondary" size="sm" onClick={leaveQueue} disabled={isBusy}>
             <TimerReset className="h-4 w-4 mr-2" /> Stop
          </Button>
        )}
      </div>

      <div className="flex-1 w-full relative">
        {!isQueued && (
          <>
            {viewStep === 'modes' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                {CATEGORIES.map((category) => (
                  <div key={category.id} className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/30">
                    <button 
                      onClick={() => setExpandedCategory(expandedCategory === category.id ? null : category.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/50 transition"
                    >
                      <div className="flex items-center gap-3 text-neutral-300">
                        {category.icon}
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <ChevronRight className={`transition-transform ${expandedCategory === category.id ? 'rotate-90' : ''}`} size={16} />
                    </button>
                    
                    {expandedCategory === category.id && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-black/20">
                        {category.modes.map((m) => (
                          <div 
                            key={m.id}
                            onClick={() => { setActiveMode(m); setViewStep('times'); }}
                            className="flex items-center gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-950/40 hover:border-neutral-700 cursor-pointer transition group"
                          >
                            <div style={{ color: m.color }} className="group-hover:scale-110 transition-transform">{m.icon}</div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-neutral-200">{m.title}</div>
                              <div className="text-[10px] text-neutral-500 uppercase tracking-tighter">{m.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4">
                <button 
                  onClick={() => setViewStep('modes')}
                  className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 mb-6 transition"
                >
                  <ArrowLeft size={14} /> Back to categories
                </button>
                
                <div className="text-center mb-8">
                  <div className="inline-block p-4 rounded-2xl bg-neutral-900 mb-3" style={{ color: activeMode?.color }}>
                    {activeMode?.icon}
                  </div>
                  <h3 className="text-xl font-bold text-neutral-100">{activeMode?.title}</h3>
                  <p className="text-sm text-neutral-500">Pick time control</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {activeMode?.presets.map((time: string) => (
                    <button
                      key={time}
                      onClick={() => handleSelectTime(time)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        selectedTimeControl === time 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200' 
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-lg font-black block">{time}</span>
                      <span className="text-[10px] uppercase opacity-50">{activeMode.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {isQueued && (
           <div className="flex flex-col items-center justify-center py-20 text-center animate-pulse">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                <Globe className="h-16 w-16 text-emerald-500 relative" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Searching...</h3>
              <p className="text-neutral-500 text-sm max-w-[200px]">
                Matching you with an opponent in {selectedTimeControl} pool
              </p>
           </div>
        )}
      </div>

      <div className="w-full pt-4 border-t border-neutral-800 space-y-3">
        {lastError && (
          <div className="text-xs text-red-400 bg-red-400/5 p-3 rounded-lg border border-red-400/10 text-center">
            {lastError.message}
          </div>
        )}
        
        <Button
          size="lg"
          className="w-full"
          onClick={joinQueue}
          disabled={isQueued || connectionState !== "open" || !selectedTimeControl}
        >
          {queueStatus === "joining" ? "Initiating..." : "Find Opponent"}
        </Button>
      </div>
    </Card>
  );
}

export default MatchmakingPanel;