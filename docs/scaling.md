# Scaling Readiness Notes

ChessView currently targets local development and single-instance Docker Compose deployment. The codebase has clear extension points, but it should not be described as horizontally scalable without additional shared infrastructure.

## Current Single-Instance Assumptions

- Matchmaking queue state is in memory.
  - See `backend/domains/matchmaking/infrastructure/queue.py`.
- WebSocket connection and room membership state is in memory.
  - See `backend/shared/ws_manager.py`.
- Background game monitoring runs inside the FastAPI process lifespan.
  - See `backend/domains/game/presentation/runtime.py`.
- Uploaded media is stored on the local filesystem.
  - See `backend/storage/`.

These are all reasonable for a single VM or one Docker Compose deployment, but they limit safe horizontal scaling.

Other current constraints:

- WebSocket authentication uses a query token for the SPA connection flow.
- Payment flows use an internal emulator, not a real provider.
- Automated E2E and load tests are not part of the current verification baseline.

## Where Redis Should Be Introduced Next

Redis is the next infrastructure addition, and it should be introduced in this order:

1. Matchmaking queue and player presence
2. Cross-instance WebSocket room fanout / reconnect routing
3. Coordination for background game monitoring jobs

That keeps the product architecture intact while removing the main shared-state bottlenecks.

## Recommended Next Infra Move

The next practical step is:

1. Keep PostgreSQL as the system of record.
2. Add Redis for shared ephemeral state and pub/sub.
3. Run multiple stateless API instances behind one load balancer.
4. Move media from local disk to shared object storage when multi-instance deploys begin.

This is a scaling step, not a rewrite. FastAPI, the current domain structure, and browser-local analysis can stay as they are.

## Incremental Migration Plan

1. Introduce thin Redis-backed adapters for matchmaking and connection presence while preserving the current service boundaries.
2. Add Redis pub/sub so WebSocket events can reach players connected to different instances.
3. Move the game monitor into a dedicated worker process or add a distributed lock so only one instance runs it at a time.
4. Replace local avatar/media storage with shared object storage before running multiple instances in production.

## What Does Not Need To Change Yet

- No Redis-backed move engine
- No rewrite away from FastAPI
- No speculative microservice split
- No change to browser-local Stockfish analysis ownership
