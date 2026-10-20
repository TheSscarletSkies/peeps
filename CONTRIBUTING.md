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

CI also builds the app on Linux and opens it with `tauri-driver` to check the window renders. To run that locally, install `webkit2gtk-driver` and `cargo install tauri-driver`, build the app with `npm run build && npm run build:hook && cargo build -p peeps-desktop --features tauri/custom-protocol`, then run `xvfb-run -a npm run smoke`. It keeps its data in a temporary directory, never your own.

Comments explain why, not what. Match the style of the code around your change.
