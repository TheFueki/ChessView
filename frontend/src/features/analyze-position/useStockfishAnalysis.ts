import { useEffect, useRef, useState } from "react";
import stockfishWorkerUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import stockfishWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";
import { isPlayableUciMove } from "@/shared/lib/chess";

export interface StockfishScore {
  type: "cp" | "mate";
  value: number;
}

export interface StockfishAnalysisState {
  status: "idle" | "loading" | "ready" | "analyzing" | "done" | "error";
  depth: number;
  selectiveDepth: number | null;
  nodes: number | null;
  nps: number | null;
  score: StockfishScore | null;
  bestMove: string | null;
  pv: string[];
  error: string | null;
}

interface UseStockfishAnalysisOptions {
  fen: string;
  enabled: boolean;
  depth?: number;
  debounceMs?: number;
}

const INITIAL_STATE: StockfishAnalysisState = {
  status: "idle",
  depth: 0,
  selectiveDepth: null,
  nodes: null,
  nps: null,
  score: null,
  bestMove: null,
  pv: [],
  error: null,
};

interface ParsedInfoLine {
  depth?: number;
  selectiveDepth?: number;
  nodes?: number;
  nps?: number;
  score?: StockfishScore;
  pv?: string[];
}

function parseInfoLine(line: string): ParsedInfoLine | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") {
    return null;
  }

  const parsed: ParsedInfoLine = {};

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    switch (token) {
      case "depth":
        parsed.depth = Number(tokens[index + 1]);
        index += 1;
        break;
      case "seldepth":
        parsed.selectiveDepth = Number(tokens[index + 1]);
        index += 1;
        break;
      case "nodes":
        parsed.nodes = Number(tokens[index + 1]);
        index += 1;
        break;
      case "nps":
        parsed.nps = Number(tokens[index + 1]);
        index += 1;
        break;
      case "multipv":
        if (tokens[index + 1] !== "1") {
          return null;
        }
        index += 1;
        break;
      case "score": {
        const scoreType = tokens[index + 1];
        const rawValue = Number(tokens[index + 2]);
        if ((scoreType === "cp" || scoreType === "mate") && !Number.isNaN(rawValue)) {
          parsed.score = {
            type: scoreType,
            value: rawValue,
          };
        }
        index += 2;
        break;
      }
      case "pv":
        parsed.pv = tokens.slice(index + 1);
        index = tokens.length;
        break;
      default:
        break;
    }
  }

  if (
    parsed.depth === undefined &&
    parsed.selectiveDepth === undefined &&
    parsed.nodes === undefined &&
    parsed.nps === undefined &&
    parsed.score === undefined &&
    parsed.pv === undefined
  ) {
    return null;
  }

  return parsed;
}

function createWorkerUrl() {
  return `${stockfishWorkerUrl}#${encodeURIComponent(stockfishWasmUrl)}`;
}

interface AnalysisTrackingState {
  queuedFen: string | null;
  activeFen: string | null;
  completedFen: string | null;
}

const INITIAL_TRACKING_STATE: AnalysisTrackingState = {
  queuedFen: null,
  activeFen: null,
  completedFen: null,
};

export function useStockfishAnalysis({
  fen,
  enabled,
  depth = 14,
  debounceMs = 250,
}: UseStockfishAnalysisOptions): StockfishAnalysisState {
  const workerRef = useRef<Worker | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const currentFenRef = useRef(fen);
  const queuedSearchRef = useRef<{ fen: string; depth: number } | null>(null);
  const isSearchActiveRef = useRef(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [analysis, setAnalysis] = useState<StockfishAnalysisState>(INITIAL_STATE);
  const [trackingState, setTrackingState] = useState<AnalysisTrackingState>(INITIAL_TRACKING_STATE);
  const isWorkerSupported = typeof Worker !== "undefined";

  useEffect(() => {
    currentFenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!isWorkerSupported) {
      return;
    }

    const worker = new Worker(createWorkerUrl());
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<string>) => {
      const line = String(event.data ?? "").trim();
      if (!line) {
        return;
      }

      if (line === "uciok") {
        worker.postMessage("setoption name UCI_AnalyseMode value true");
        worker.postMessage("setoption name MultiPV value 1");
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        setIsEngineReady(true);
        const queuedSearch = queuedSearchRef.current;
        if (queuedSearch) {
          queuedSearchRef.current = null;
          isSearchActiveRef.current = true;
          currentFenRef.current = queuedSearch.fen;
          setTrackingState({
            queuedFen: null,
            activeFen: queuedSearch.fen,
            completedFen: null,
          });
          setAnalysis({
            ...INITIAL_STATE,
            status: "analyzing",
          });
          worker.postMessage("position fen " + queuedSearch.fen);
          worker.postMessage(`go depth ${queuedSearch.depth}`);
        } else {
          setAnalysis((current) =>
            current.status === "loading"
              ? {
                  ...current,
                  status: "ready",
                }
              : current,
          );
        }
        return;
      }

      if (line.startsWith("info ")) {
        if (!isSearchActiveRef.current) {
          return;
        }

        const parsed = parseInfoLine(line);
        if (!parsed) {
          return;
        }

        if (parsed.pv && parsed.pv.length > 0 && !isPlayableUciMove(currentFenRef.current, parsed.pv[0])) {
          return;
        }

        setAnalysis((current) => ({
          ...current,
          status: "analyzing",
          depth: parsed.depth ?? current.depth,
          selectiveDepth: parsed.selectiveDepth ?? current.selectiveDepth,
          nodes: parsed.nodes ?? current.nodes,
          nps: parsed.nps ?? current.nps,
          score: parsed.score ?? current.score,
          pv: parsed.pv ?? current.pv,
        }));
        return;
      }

      if (line.startsWith("bestmove ")) {
        if (!isSearchActiveRef.current) {
          return;
        }

        const bestMove = line.split(/\s+/)[1] ?? null;
        if (bestMove && !isPlayableUciMove(currentFenRef.current, bestMove)) {
          return;
        }

        isSearchActiveRef.current = false;
        setTrackingState({
          queuedFen: null,
          activeFen: null,
          completedFen: currentFenRef.current,
        });
        setAnalysis((current) => ({
          ...current,
          status: "done",
          bestMove,
        }));
      }
    };

    worker.onerror = () => {
      setAnalysis({
        ...INITIAL_STATE,
        status: "error",
        error: "Stockfish failed to start in this browser session.",
      });
    };

    worker.postMessage("uci");

    return () => {
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current);
      }

      setIsEngineReady(false);
      queuedSearchRef.current = null;
      isSearchActiveRef.current = false;
      worker.postMessage("stop");
      worker.postMessage("quit");
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, isWorkerSupported]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!enabled || !worker) {
      return;
    }

    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    worker.postMessage("stop");
    queuedSearchRef.current = null;
    isSearchActiveRef.current = false;

    if (!isEngineReady) {
      return;
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      queuedSearchRef.current = { fen, depth };
      isSearchActiveRef.current = false;
      setTrackingState({
        queuedFen: fen,
        activeFen: null,
        completedFen: null,
      });
      setAnalysis({
        ...INITIAL_STATE,
        status: "analyzing",
      });
      worker.postMessage("stop");
      worker.postMessage("isready");
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current);
      }

      worker.postMessage("stop");
    };
  }, [debounceMs, depth, enabled, fen, isEngineReady]);

  if (!enabled) {
    return INITIAL_STATE;
  }

  if (!isWorkerSupported) {
    return {
      ...INITIAL_STATE,
      status: "error",
      error: "Web Workers are unavailable in this browser, so local analysis cannot start.",
    };
  }

  if (!isEngineReady && analysis.status === "idle") {
    return {
      ...analysis,
      status: "loading",
    };
  }

  const hasQueuedCurrentFen = trackingState.queuedFen === fen;
  if (hasQueuedCurrentFen) {
    return {
      ...INITIAL_STATE,
      status: "analyzing",
    };
  }

  const isActiveCurrentFen = trackingState.activeFen === fen;
  const hasCompletedCurrentFen = trackingState.completedFen === fen;
  if (!isActiveCurrentFen && !hasCompletedCurrentFen && analysis.status !== "error") {
    return {
      ...INITIAL_STATE,
      status: isEngineReady ? "ready" : "loading",
    };
  }

  return analysis;
}
