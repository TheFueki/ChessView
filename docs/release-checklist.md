# ChessView Release Checklist

## Code Freeze

- stop adding new features
- keep only release-quality fixes

## Verification

- run backend tests
- run frontend lint
- run frontend build
- confirm Docker Compose boot still works

## Release Assets

- capture dashboard screenshot
- capture live game screenshot
- capture analysis screenshot
- capture puzzle screenshot
- capture tournament screenshot
- record short demo video

## Git

- commit final v1 state
- push `main`
- tag `v1.0.0`
- push `v1.0.0`

## After Push

- confirm README renders well on GitHub
- add screenshots to the repository or release page
- attach the demo video in the project presentation or portfolio page
