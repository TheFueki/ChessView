import stockfishWorkerUrl from "stockfish/bin/stockfish-18-lite-single.js?url";
import stockfishWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";

export interface StockfishReviewResult {
  evaluations: number[];
  bestMoves: Array<string | null>;
}

type StockfishScore = { type: "cp" | "mate"; value: number };

const MATE_SCORE_CP = 100_000;

function createWorkerUrl() {
  return `${stockfishWorkerUrl}#${encodeURIComponent(stockfishWasmUrl)}`;
}

function parseScore(line: string): StockfishScore | null {
  const match = /\bscore\s+(cp|mate)\s+(-?\d+)/.exec(line);
  if (!match) {
    return null;
  }

  const type = match[1];
  const value = Number(match[2]);

  return (type === "cp" || type === "mate") && Number.isFinite(value) ? { type, value } : null;
}

function parseBestMove(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line);
  return !match || match[1] === "(none)" ? null : (match[1] ?? null);
}

function scoreToWhiteCentipawns(fen: string, score: StockfishScore): number {
  const rawScore = score.type === "cp" ? score.value : Math.sign(score.value) * (MATE_SCORE_CP - Math.abs(score.value));
  return fen.split(" ")[1] === "b" ? -rawScore : rawScore;
}

function waitForLine(worker: Worker, predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Stockfish timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const handleMessage = (event: MessageEvent<string>) => {
      const lines = String(event.data ?? "").split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (predicate(line)) {
          cleanup();
          resolve(line);
          return;
        }
      }
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Stockfish failed while reviewing the game."));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
  });
}

async function initializeWorker(worker: Worker): Promise<void> {
  worker.postMessage("uci");
  await waitForLine(worker, (line) => line === "uciok", 10_000);
  worker.postMessage("setoption name UCI_AnalyseMode value true");
  worker.postMessage("setoption name MultiPV value 1");
  worker.postMessage("isready");
  await waitForLine(worker, (line) => line === "readyok", 10_000);
}

async function analyzeFen(worker: Worker, fen: string, depth: number): Promise<{ evaluation: number; bestMove: string | null }> {
  let latestScore: StockfishScore | null = null;

  const handleMessage = (event: MessageEvent<string>) => {
    const lines = String(event.data ?? "").split("\n");
    for (const rawLine of lines) {
      const parsedScore = parseScore(rawLine.trim());
      if (parsedScore) {
        latestScore = parsedScore;
      }
    }
  };

  worker.addEventListener("message", handleMessage);
  try {
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${depth}`);
    const bestMoveLine = await waitForLine(worker, (line) => line.startsWith("bestmove "), 120_000);

    if (!latestScore) {
      throw new Error("Stockfish returned no score for one reviewed position.");
    }

    return {
      evaluation: scoreToWhiteCentipawns(fen, latestScore),
      bestMove: parseBestMove(bestMoveLine),
    };
  } finally {
    worker.removeEventListener("message", handleMessage);
  }
}

export async function analyzeGameReviewWithStockfish(fens: readonly string[], depth = 10): Promise<StockfishReviewResult> {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are unavailable in this browser session.");
  }

  const worker = new Worker(createWorkerUrl());

  try {
    await initializeWorker(worker);
    const evaluations: number[] = [];
    const bestMoves: Array<string | null> = [];

    for (let index = 0; index < fens.length; index += 1) {
      const fen = fens[index];
      if (!fen) {
        throw new Error(`Missing FEN at index ${index}`);
      }

      const result = await analyzeFen(worker, fen, depth);
      evaluations.push(result.evaluation);
      if (index < fens.length - 1) {
        bestMoves.push(result.bestMove);
      }
    }

    return { evaluations, bestMoves };
  } finally {
    worker.postMessage("quit");
    worker.terminate();
  }
}
