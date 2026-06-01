# ChessView Domain Map

This map describes the current repository, not planned production scope.

## Identity

Purpose:

- registration, login, token refresh, current-user loading
- JWT-backed session handling
- profile update and avatar upload
- local face-verification/passkey flows

Main surfaces:

- `backend/domains/identity/`
- `/api/v1/identity/*`
- `frontend/src/pages/auth-page/`
- `frontend/src/pages/settings-page/`

## Matchmaking

Purpose:

- queue authenticated users into compatible live games
- create games with selected time controls

Main surfaces:

- `backend/domains/matchmaking/`
- WebSocket events: `queue_join`, `queue_leave`, `queue_joined`, `match_found`

Current limitation:

- queue state is in memory and assumes one backend process.

## Game

Purpose:

- server-authoritative gameplay
- legal move validation, clocks, timeout, reconnect, abort, resign, and draw flows
- finished-game history and replay data

Main surfaces:

- `backend/domains/game/`
- `/api/v1/games`
- live game WebSocket events
- `frontend/src/pages/game-page/`
- `frontend/src/pages/game-review-page/`

## Ratings

Purpose:

- apply rating updates when rated games complete
- expose rating snapshots and before/after deltas

Main surfaces:

- `backend/domains/ratings/`
- game serialization and profile read models

## Profiles

Purpose:

- current and public player profiles
- summary statistics, recent games, leaderboard, and head-to-head comparison

Main surfaces:

- `backend/domains/profiles/`
- `/api/v1/profiles/*`
- `frontend/src/pages/profile-page/`
- `frontend/src/pages/leaderboard-page/`
- `frontend/src/pages/compare-page/`

## Communication

Purpose:

- game-scoped chat history and live chat events

Main surfaces:

- `backend/domains/communication/`
- `/api/v1/chat/{game_id}/messages`
- WebSocket events: `chat_send`, `chat_message`

## Tournaments

Purpose:

- tournament creation and membership
- lifecycle actions, standings, Swiss helpers, and round progression
- entry-payment emulator integration
- OTB tournament type used by the OTB manager page

Main surfaces:

- `backend/domains/tournaments/`
- `/api/v1/tournaments/*`
- `frontend/src/pages/tournaments-page/`
- `frontend/src/pages/tournament-detail-page/`
- `frontend/src/pages/otb-manager-page/`

## Scheduled Matches

Purpose:

- direct planned match invitations
- accept/decline/cancel/start lifecycle
- optional emulator payment scenario
- optional tournament pairing integration

Main surfaces:

- `backend/domains/scheduled_matches/`
- `/api/v1/scheduled-matches/*`
- `frontend/src/pages/scheduled-matches-page/`

## Payments

Purpose:

- internal payment intent records
- emulator state transitions
- wallet coin debit/refund flows for supported scenarios

Main surfaces:

- `backend/domains/payments/`
- `/api/v1/payments/*`

Current limitation:

- this is not a real payment provider integration.

## Puzzles

Purpose:

- puzzle catalog
- puzzle retrieval and random selection
- per-user attempt tracking

Main surfaces:

- `backend/domains/puzzles/`
- `/api/v1/puzzles/*`
- `frontend/src/pages/puzzle-page/`

## RTC

Purpose:

- relay WebRTC signaling events for live games

Main surfaces:

- `backend/domains/rtc/`
- WebSocket events: `rtc_offer`, `rtc_answer`, `rtc_ice`

## Admin

Purpose:

- admin-only user management
- audit logs
- payment/verification inspection and emulator refund

Main surfaces:

- `backend/domains/admin/`
- `/api/v1/admin/*`
- `admin-frontend/`

## Demo Frontend Modules

- `frontend/src/pages/clubs-page/ClubsPage.tsx` is a local-state demonstration of a club UI.
- `frontend/src/pages/shop-page/ShopPage.tsx` is a marketplace UI demonstration that reads profile coins and stores purchased item state in browser local storage.

## Cross-Cutting Rules

- live gameplay authority stays on the backend
- analysis and Stockfish stay in the browser
- product defaults belong in domain or policy code, not persistence models
- routers should stay thin and delegate to application/domain code
- current deployment assumes one backend instance unless Redis/pub-sub and shared storage are introduced
