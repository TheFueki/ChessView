/**
 * Shared TypeScript types for WebSocket contracts and REST DTOs.
 */

export type EventType =
  | "queue_join"
  | "queue_leave"
  | "move"
  | "resign"
  | "draw_offer"
  | "draw_accept"
  | "draw_decline"
  | "chat_send"
  | "rtc_offer"
  | "rtc_answer"
  | "rtc_ice"
  | "queue_joined"
  | "match_found"
  | "game_state"
  | "game_over"
  | "draw_offered"
  | "draw_declined"
  | "chat_message"
  | "error";

export type ClientEventType =
  | "queue_join"
  | "queue_leave"
  | "move"
  | "resign"
  | "draw_offer"
  | "draw_accept"
  | "draw_decline"
  | "chat_send"
  | "rtc_offer"
  | "rtc_answer"
  | "rtc_ice";

export type ConnectionState = "idle" | "connecting" | "open" | "disconnected" | "error";

export type PlayerColor = "white" | "black";
export type GameStatus = "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "timeout" | "aborted";
export type GameResult = "1-0" | "0-1" | "1/2-1/2";
export type TimeControlKey = "3+0" | "3+2" | "5+0" | "5+3" | "10+0";
export type TerminationReason =
  | "checkmate"
  | "stalemate"
  | "draw"
  | "draw_agreement"
  | "resignation"
  | "clock_timeout"
  | "disconnect_timeout"
  | "auto_abort";

export interface PlayerSummary {
  id: string;
  username: string;
  rating: number;
  avatar_url?: string | null;
}

export interface QueueJoinedPayload {
  position: number;
  time_control: TimeControlKey;
}

export interface MatchFoundPayload {
  game_id: string;
  opponent: PlayerSummary;
  color: PlayerColor;
  time_control: TimeControlKey;
}

export interface ClockState {
  time_control_name: TimeControlKey | string;
  initial_time_ms: number;
  increment_ms: number;
  white_time_ms: number;
  black_time_ms: number;
  active_color: PlayerColor | null;
  is_paused: boolean;
  pause_reason: "disconnect" | "game_over" | null;
  disconnected_player_id: string | null;
  grace_deadline_at: string | null;
  last_updated_at: string;
}

export interface GameStatePayload {
  fen: string;
  last_move: { uci: string; move_number: number } | null;
  turn: PlayerColor;
  white: PlayerSummary;
  black: PlayerSummary;
  status: GameStatus;
  termination_reason: TerminationReason | null;
  clock: ClockState;
  move_history: string[];
}

export interface GameOverPayload {
  status: GameStatus;
  result: GameResult;
  reason: TerminationReason;
  winner_id: string | null;
  clock: ClockState;
  rating_update: {
    white: {
      before: number;
      after: number;
      delta: number;
    };
    black: {
      before: number;
      after: number;
      delta: number;
    };
  } | null;
}

export interface ChatMessagePayload {
  id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface RtcOfferPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface RtcAnswerPayload {
  sdp: RTCSessionDescriptionInit;
}

export interface RtcIcePayload {
  candidate: RTCIceCandidateInit;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface EventPayloadMap {
  queue_join: { time_control: TimeControlKey };
  queue_leave: Record<string, never>;
  move: { uci: string };
  resign: Record<string, never>;
  draw_offer: Record<string, never>;
  draw_accept: Record<string, never>;
  draw_decline: Record<string, never>;
  chat_send: { content: string };
  rtc_offer: RtcOfferPayload;
  rtc_answer: RtcAnswerPayload;
  rtc_ice: RtcIcePayload;
  queue_joined: QueueJoinedPayload;
  match_found: MatchFoundPayload;
  game_state: GameStatePayload;
  game_over: GameOverPayload;
  draw_offered: { from_user_id: string };
  draw_declined: Record<string, never>;
  chat_message: ChatMessagePayload;
  error: ErrorPayload;
}

export type EventPayload<K extends EventType> = EventPayloadMap[K];

export interface WSEnvelope<T = unknown> {
  type: EventType;
  payload: T;
  game_id?: string;
  timestamp: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  rating: number;
  avatar_url?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: UserProfile;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface GameMoveResponse {
  user_id: string;
  username: string;
  uci: string;
  fen_after: string;
  move_number: number;
  created_at: string;
}

export interface GameDetailResponse {
  id: string;
  white: PlayerSummary;
  black: PlayerSummary;
  rated: boolean;
  time_control_name: string;
  status: GameStatus;
  termination_reason: TerminationReason | null;
  result: GameResult | null;
  fen: string;
  pgn: string | null;
  move_count: number;
  clock: ClockState;
  white_rating: {
    before: number;
    after: number;
    delta: number;
  } | null;
  black_rating: {
    before: number;
    after: number;
    delta: number;
  } | null;
  started_at: string;
  ended_at: string | null;
  moves: GameMoveResponse[];
}

export interface GameHistoryItemResponse {
  id: string;
  white: PlayerSummary;
  black: PlayerSummary;
  opponent: PlayerSummary;
  my_color: PlayerColor;
  rated: boolean;
  time_control_name: string;
  result: GameResult | null;
  status: GameStatus;
  termination_reason?: TerminationReason | null;
  move_count: number;
  started_at: string;
  ended_at: string | null;
  rating_delta?: number | null;
}

export type GameHistoryResponse = PaginatedResponse<GameHistoryItemResponse>;

export interface ProfileRecentGameResponse {
  id: string;
  white: PlayerSummary;
  black: PlayerSummary;
  opponent: PlayerSummary;
  player_color: PlayerColor;
  rated: boolean;
  time_control_name: string;
  result: GameResult | null;
  status: GameStatus;
  termination_reason: TerminationReason | null;
  move_count: number;
  started_at: string;
  ended_at: string | null;
  rating_delta: number | null;
}

export interface ProfileResponse {
  id: string;
  username: string;
  rating: number;
  avatar_url?: string | null;
  created_at: string;
  games_played: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
  recent_games: ProfileRecentGameResponse[];
}

export type TournamentStatus = "registration" | "active" | "finished";
export type PuzzleAttemptResult = "solved" | "failed";

export interface TournamentSummaryResponse {
  id: string;
  name: string;
  time_control_name: TimeControlKey | string;
  status: TournamentStatus;
  current_round: number;
  total_rounds: number;
  player_count: number;
  owner: PlayerSummary;
  viewer_is_member: boolean;
  viewer_is_owner: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TournamentStandingResponse {
  rank: number;
  player: PlayerSummary;
  score: number;
  games_played: number;
}

export interface TournamentPairingResponse {
  id: number | null;
  round_number: number;
  white: PlayerSummary;
  black: PlayerSummary | null;
  game_id: string | null;
  game_status: GameStatus | null;
  result: GameResult | null;
}

export interface TournamentRoundResponse {
  round_number: number;
  pairings: TournamentPairingResponse[];
}

export interface TournamentDetailResponse extends TournamentSummaryResponse {
  standings: TournamentStandingResponse[];
  rounds: TournamentRoundResponse[];
}

export interface PuzzleAttemptStateResponse {
  attempts_count: number;
  solved: boolean;
  last_result: PuzzleAttemptResult | null;
  last_attempted_at: string | null;
}

export interface PuzzleSummaryResponse {
  id: string;
  fen: string;
  rating: number;
  themes: string[];
  source_game_id: string | null;
  attempt: PuzzleAttemptStateResponse | null;
}

export interface PuzzleDetailResponse extends PuzzleSummaryResponse {
  solution_moves: string[];
}

export type PuzzleListResponse = PaginatedResponse<PuzzleSummaryResponse>;
