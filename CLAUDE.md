# peeps

## Commits and pull requests

- Never add `Co-Authored-By` trailers, "Generated with Claude Code" lines, session links or any other AI attribution to commits, pull requests, code comments or docs.

## Code

- Logic lives in `crates/core` with unit tests; `src-tauri` and `src` stay thin.
- Comments explain why, not what. No narration.
- Before committing: `cargo fmt --all`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e`, `npm run format:check`.
