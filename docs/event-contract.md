# ChessView — Event & API Contract

This document is the canonical reference for every message that crosses a network boundary: WebSocket events and REST endpoints.

---

## 1. WebSocket Envelope

Every WebSocket frame is a JSON object conforming to this envelope:

```typescript
// Shared type used by both client and server
interface WSEnvelope<T = unknown> {
  type: EventType;       // discriminator string
  payload: T;            // event-specific data
  game_id?: string;      // UUID, present for all in-game events
  timestamp: string;     // ISO-8601, always set by sender
}
```

```python
# Backend Pydantic model
class WSEnvelope(BaseModel):
    type: str
    payload: dict = {}
    game_id: str | None = None
    timestamp: str       # ISO-8601
```

The `type` field is the routing key. The server WS handler dispatches to the correct domain handler based on `type`.

---

## 2. Event Type Registry

### 2.1 Client → Server

| type | Domain | payload schema | game_id required |
|------|--------|---------------|-----------------|
| `queue_join` | matchmaking | `{}` | No |
| `queue_leave` | matchmaking | `{}` | No |
| `move` | game | `{ uci: string }` | Yes |
| `resign` | game | `{}` | Yes |
| `draw_offer` | game | `{}` | Yes |
| `draw_accept` | game | `{}` | Yes |
| `draw_decline` | game | `{}` | Yes |
| `chat_send` | communication | `{ content: string }` | Yes |
| `rtc_offer` | rtc | `{ sdp: RTCSessionDescriptionInit }` | Yes |
| `rtc_answer` | rtc | `{ sdp: RTCSessionDescriptionInit }` | Yes |
| `rtc_ice` | rtc | `{ candidate: RTCIceCandidateInit }` | Yes |

### 2.2 Server → Client

| type | Domain | payload schema | Sent to |
|------|--------|---------------|---------|
| `queue_joined` | matchmaking | `{ position: number }` | sender |
| `match_found` | matchmaking | `MatchFoundPayload` | both matched players |
| `game_state` | game | `GameStatePayload` | game room |
| `game_over` | game | `GameOverPayload` | game room |
| `draw_offered` | game | `{ from_user_id: string }` | opponent |
| `draw_declined` | game | `{}` | offerer |
| `chat_message` | communication | `ChatMessagePayload` | game room |
| `rtc_offer` | rtc | `{ sdp: RTCSessionDescriptionInit }` | opponent |
| `rtc_answer` | rtc | `{ sdp: RTCSessionDescriptionInit }` | opponent |
| `rtc_ice` | rtc | `{ candidate: RTCIceCandidateInit }` | opponent |
| `error` | shared | `{ code: string, message: string }` | sender |

---

## 3. Payload Schemas (Detail)

### MatchFoundPayload

```typescript
{
  game_id: string;            // UUID
  opponent: {
    id: string;
    username: string;
    rating: number;
  };
  color: "white" | "black";
}
```

### GameStatePayload

```typescript
{
  fen: string;                // full FEN string
  last_move: {
    uci: string;              // e.g. "e2e4"
    move_number: number;
  } | null;                   // null on initial state
  turn: "white" | "black";
  white: { id: string; username: string; rating: number };
  black: { id: string; username: string; rating: number };
  status: "active" | "checkmate" | "stalemate" | "draw" | "resigned" | "timeout";
  move_history: string[];     // ordered UCI list: ["e2e4", "e7e5", ...]
}
```

### GameOverPayload

```typescript
{
  result: "1-0" | "0-1" | "1/2-1/2";
  reason: "checkmate" | "stalemate" | "resignation" | "draw_agreement" | "timeout";
  winner_id: string | null;   // null on draw
}
```

### ChatMessagePayload

```typescript
{
  id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;         // ISO-8601
}
```

### Error Payload

```typescript
{
  code: string;               // machine-readable, e.g. "ILLEGAL_MOVE", "NOT_YOUR_TURN"
  message: string;            // human-readable
}
```

Error codes:

| code | Meaning |
|------|---------|
| `ILLEGAL_MOVE` | python-chess rejected the UCI |
| `NOT_YOUR_TURN` | Wrong color attempted a move |
| `GAME_NOT_ACTIVE` | Move on a finished game |
| `ALREADY_IN_QUEUE` | Duplicate queue_join |
| `NOT_IN_GAME` | Event sent with a game_id the user isn't part of |
| `MESSAGE_TOO_LONG` | Chat content exceeds 500 chars |
| `INVALID_EVENT` | Unknown event type or malformed envelope |

---

## 4. REST API Contract

### 4.1 Identity

#### POST `/api/identity/register`

Request:
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "secureP@ss1"
}
```

Response `201`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Errors: `409 Conflict` (duplicate email/username), `422 Validation Error`.

#### POST `/api/identity/login`

Request:
```json
{
  "email": "alice@example.com",
  "password": "secureP@ss1"
}
```

Response `200`: same as register.

Errors: `401 Unauthorized` (invalid credentials).

#### POST `/api/identity/refresh`

Request:
```json
{
  "refresh_token": "eyJ..."
}
```

Response `200`:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Errors: `401 Unauthorized` (expired/invalid token).

#### GET `/api/identity/me`

Headers: `Authorization: Bearer <access_token>`

Response `200`:
```json
{
  "id": "uuid",
  "username": "alice",
  "email": "alice@example.com",
  "rating": 1200,
  "created_at": "2026-04-01T12:00:00Z"
}
```

#### GET `/api/identity/users/{id}`

Response `200`:
```json
{
  "id": "uuid",
  "username": "alice",
  "rating": 1200
}
```

Errors: `404 Not Found`.

### 4.2 Game

#### GET `/api/games?page=1&size=20`

Headers: `Authorization: Bearer <access_token>`

Response `200`:
```json
{
  "items": [
    {
      "id": "uuid",
      "white": { "id": "uuid", "username": "alice" },
      "black": { "id": "uuid", "username": "bob" },
      "result": "1-0",
      "status": "checkmate",
      "started_at": "2026-04-01T12:00:00Z",
      "ended_at": "2026-04-01T12:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "size": 20
}
```

#### GET `/api/games/{id}`

Response `200`:
```json
{
  "id": "uuid",
  "white": { "id": "uuid", "username": "alice", "rating": 1200 },
  "black": { "id": "uuid", "username": "bob", "rating": 1150 },
  "status": "checkmate",
  "result": "1-0",
  "fen": "...",
  "pgn": "1. e4 e5 ...",
  "started_at": "...",
  "ended_at": "...",
  "moves": [
    { "uci": "e2e4", "fen_after": "...", "move_number": 1, "created_at": "..." }
  ]
}
```

### 4.3 Communication

#### GET `/api/games/{id}/messages`

Response `200`:
```json
[
  {
    "id": 1,
    "user_id": "uuid",
    "username": "alice",
    "content": "Good luck!",
    "created_at": "2026-04-01T12:00:05Z"
  }
]
```

---

## 5. WebSocket Connection

**Endpoint:** `ws://<host>/ws?token=<jwt_access_token>`

**Connection lifecycle:**
1. Client opens WS with JWT in query string.
2. Server validates JWT; on failure sends `error` event and closes with code `4001`.
3. On success, server registers connection in `ConnectionManager.active_connections[user_id]`.
4. Client sends/receives JSON frames per the envelope schema.
5. On disconnect, server removes from `active_connections` and any `game_rooms`.

**Reconnection:** Client should implement exponential backoff (1s, 2s, 4s, max 30s). On reconnect, client re-authenticates and server re-joins them to any active game room.

---

## 6. TypeScript Event Types (Frontend Reference)

```typescript
// shared/api/ws.ts

type EventType =
  // Client → Server
  | "queue_join" | "queue_leave"
  | "move" | "resign" | "draw_offer" | "draw_accept" | "draw_decline"
  | "chat_send"
  | "rtc_offer" | "rtc_answer" | "rtc_ice"
  // Server → Client
  | "queue_joined" | "match_found"
  | "game_state" | "game_over" | "draw_offered" | "draw_declined"
  | "chat_message"
  | "error";

interface WSEnvelope<T = unknown> {
  type: EventType;
  payload: T;
  game_id?: string;
  timestamp: string;
}

// Helper to create outbound events
function createEvent<T>(type: EventType, payload: T, gameId?: string): WSEnvelope<T> {
  return { type, payload, game_id: gameId, timestamp: new Date().toISOString() };
}
```

## 7. Python Event Enum (Backend Reference)

```python
# shared/events.py
from enum import StrEnum

class EventType(StrEnum):
    # Client → Server
    QUEUE_JOIN = "queue_join"
    QUEUE_LEAVE = "queue_leave"
    MOVE = "move"
    RESIGN = "resign"
    DRAW_OFFER = "draw_offer"
    DRAW_ACCEPT = "draw_accept"
    DRAW_DECLINE = "draw_decline"
    CHAT_SEND = "chat_send"
    RTC_OFFER = "rtc_offer"
    RTC_ANSWER = "rtc_answer"
    RTC_ICE = "rtc_ice"

    # Server → Client
    QUEUE_JOINED = "queue_joined"
    MATCH_FOUND = "match_found"
    GAME_STATE = "game_state"
    GAME_OVER = "game_over"
    DRAW_OFFERED = "draw_offered"
    DRAW_DECLINED = "draw_declined"
    CHAT_MESSAGE = "chat_message"
    ERROR = "error"
```
