# ChessView Event & API Contract

This document summarizes the network boundary used by the current repository: WebSocket events and selected REST endpoints.

## WebSocket Envelope

Every WebSocket frame is a JSON object:

```typescript
interface WSEnvelope<T = unknown> {
  type: EventType;
  payload: T;
  game_id?: string;
  timestamp: string;
}
```

Backend model:

```python
class WSEnvelope(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)
    game_id: str | None = None
    timestamp: str = Field(default_factory=...)
```

Endpoint:

```text
ws://<host>/ws?token=<jwt_access_token>
```

The token is an access JWT passed as a query parameter. This is simple for the local SPA setup, but should be reassessed for hardened deployments.

## Client to Server Events

| Type | Domain | Payload | `game_id` |
| --- | --- | --- | --- |
| `queue_join` | matchmaking | `{ "time_control": "5+0" }` | No |
| `queue_leave` | matchmaking | `{}` | No |
| `move` | game | `{ "uci": "e2e4" }` | Yes |
| `resign` | game | `{}` | Yes |
| `draw_offer` | game | `{}` | Yes |
| `draw_accept` | game | `{}` | Yes |
| `draw_decline` | game | `{}` | Yes |
| `chat_send` | communication | `{ "content": "Good luck!" }` | Yes |
| `rtc_offer` | rtc | `{ "sdp": ... }` | Yes |
| `rtc_answer` | rtc | `{ "sdp": ... }` | Yes |
| `rtc_ice` | rtc | `{ "candidate": ... }` | Yes |

## Server to Client Events

| Type | Domain | Payload |
| --- | --- | --- |
| `queue_joined` | matchmaking | `{ "position": 1, "time_control": "5+0" }` |
| `match_found` | matchmaking | game id, opponent, color, time control |
| `game_state` | game | FEN, clocks, players, status, result, moves |
| `game_over` | game | final result and reason |
| `draw_offered` | game | offering user id |
| `draw_declined` | game | empty payload |
| `chat_message` | communication | saved chat message |
| `rtc_offer` | rtc | relayed offer |
| `rtc_answer` | rtc | relayed answer |
| `rtc_ice` | rtc | relayed ICE candidate |
| `error` | shared | `{ "code": "...", "message": "..." }` |

## REST API Base

All REST endpoints are registered under:

```text
/api/v1
```

## Identity

```text
POST /api/v1/identity/register
POST /api/v1/identity/login
POST /api/v1/identity/refresh
GET  /api/v1/identity/me
PUT  /api/v1/identity/profile
GET  /api/v1/identity/users/{user_id}
POST /api/v1/identity/me/avatar
```

Identity also contains local face-verification and passkey endpoints under `/api/v1/identity/face-verification/*`.

## Profiles

```text
GET /api/v1/profiles/me
GET /api/v1/profiles/leaderboard
GET /api/v1/profiles/search?query=<text>
GET /api/v1/profiles/{user_id}
GET /api/v1/profiles/{user_id}/head-to-head/{opponent_id}
```

## Games and Chat

```text
GET  /api/v1/games?page=1&size=20
GET  /api/v1/games/{game_id}
POST /api/v1/games/{game_id}/face-verification/start
POST /api/v1/games/{game_id}/face-verification/submit
GET  /api/v1/games/{game_id}/face-verification/status
GET  /api/v1/chat/{game_id}/messages
```

Live moves, resignations, draw actions, room updates, and chat sends are WebSocket events.

## Puzzles

```text
GET  /api/v1/puzzles
GET  /api/v1/puzzles/random
GET  /api/v1/puzzles/{puzzle_id}
POST /api/v1/puzzles/{puzzle_id}/attempts
```

## Tournaments

```text
GET    /api/v1/tournaments
POST   /api/v1/tournaments
GET    /api/v1/tournaments/{tournament_id}
PATCH  /api/v1/tournaments/{tournament_id}
POST   /api/v1/tournaments/{tournament_id}/publish
POST   /api/v1/tournaments/{tournament_id}/open-registration
POST   /api/v1/tournaments/{tournament_id}/close-registration
POST   /api/v1/tournaments/{tournament_id}/start
POST   /api/v1/tournaments/{tournament_id}/advance
POST   /api/v1/tournaments/{tournament_id}/finish
POST   /api/v1/tournaments/{tournament_id}/cancel
POST   /api/v1/tournaments/{tournament_id}/join
DELETE /api/v1/tournaments/{tournament_id}/join
GET    /api/v1/tournaments/{tournament_id}/standings
POST   /api/v1/tournaments/{tournament_id}/rounds/suggest-count
POST   /api/v1/tournaments/{tournament_id}/rounds/generate-swiss
POST   /api/v1/tournaments/{tournament_id}/entry-payment
```

## Scheduled Matches

```text
GET  /api/v1/scheduled-matches/me
GET  /api/v1/scheduled-matches/{match_id}
POST /api/v1/scheduled-matches
POST /api/v1/scheduled-matches/{match_id}/accept
POST /api/v1/scheduled-matches/{match_id}/decline
POST /api/v1/scheduled-matches/{match_id}/cancel
POST /api/v1/scheduled-matches/{match_id}/start
POST /api/v1/scheduled-matches/{match_id}/reschedule
POST /api/v1/scheduled-matches/{match_id}/payment
```

## Payments Emulator

```text
GET  /api/v1/payments/{payment_id}
POST /api/v1/payments/emulator/{payment_id}/simulate
```

The payment module records internal payment intents and emulator events. It is not a real payment gateway.

## Admin

```text
GET   /api/v1/admin/users
PATCH /api/v1/admin/users/{user_id}
POST  /api/v1/admin/users/{user_id}/ban
POST  /api/v1/admin/users/{user_id}/unban
POST  /api/v1/admin/users/{user_id}/role
GET   /api/v1/admin/logs
GET   /api/v1/admin/payments
POST  /api/v1/admin/payments/{payment_id}/refund
GET   /api/v1/admin/face-verification/sessions
```

Admin endpoints require an admin user.
