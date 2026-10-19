# Contributing

1. Open an issue before large changes.
2. Keep logic in `crates/core` with tests. The app and the interface should stay thin.
3. Before opening a pull request:

```sh
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run lint && npm run typecheck && npm test
npm run format:check
```

Comments explain why, not what. Match the style of the code around your change.
