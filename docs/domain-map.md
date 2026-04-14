# ChessView Domain Map

## Identity

Purpose:

- registration
- login and current-user flows
- JWT-backed session handling
- avatar upload

Main surfaces:

- `backend/domains/identity/`
- `/api/identity/*`

## Matchmaking

Purpose:

- queue users into compatible live games
- create games with the selected time control

Main surfaces:

- `backend/domains/matchmaking/`
- live WebSocket events for queue join/leave and match creation

## Game

Purpose:

- server-authoritative gameplay
- clocks, timeout, reconnect, abort logic
- finished-game history and replay data

Main surfaces:

- `backend/domains/game/`
- `/api/games`
- live game WebSocket events

## Ratings

Purpose:

- apply rating updates when rated games complete
- expose rating deltas and before/after snapshots

Main surfaces:

- `backend/domains/ratings/`

## Profiles

Purpose:

- self and public player profiles
- summary statistics and recent games

Main surfaces:

- `backend/domains/profiles/`
- `/api/profiles/*`

## Communication

Purpose:

- in-game chat

Main surfaces:

- `backend/domains/communication/`
- game-scoped message history and live chat events

## Tournaments

Purpose:

- tournament creation and membership
- round lifecycle
- pairings and standings

Main surfaces:

- `backend/domains/tournaments/`
- `/api/tournaments/*`

## Puzzles

Purpose:

- puzzle catalog
- puzzle retrieval and random selection
- per-user attempt tracking

Main surfaces:

- `backend/domains/puzzles/`
- `/api/puzzles/*`

## RTC

Purpose:

- relay WebRTC signaling for live games

Main surfaces:

- `backend/domains/rtc/`
- WebSocket signaling events only

## Frontend Product Surfaces

These backend domains feed the main frontend routes:

- `/`: landing page when logged out, dashboard when logged in
- `/lobby`: live play entry
- `/game/:gameId`: active live game
- `/history`: archive and replay entry
- `/games/:gameId`: replay review
- `/analysis`: board editor, PGN import, sandbox analysis
- `/puzzles`: tactical training
- `/tournaments`: tournament list and detail
- `/profile` and `/players/:userId`: player surfaces

## Cross-Cutting Rules

- live gameplay authority stays on the backend
- analysis and Stockfish stay in the browser
- product defaults belong in domain or policy code, not persistence models
- routers should stay thin and delegate to application/domain code
