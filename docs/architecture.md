# Architecture

## Data flow

1. An agent fires a hook. `peeps-hook` reads the payload from stdin and writes it as one JSON line to the app's local socket.
2. The app matches the session's `cwd` to a product, updates its session state and, for events that wait, answers:
   - `PermissionRequest`: waits for Allow or Deny in the notch. If the hook process goes away, for example because the user answered in the terminal, the request is dropped.
   - `SessionStart`: returns the product's pending notes as `additionalContext`.
   - `PostToolUse`: returns notes marked "next step".
3. `peeps-hook` turns the reply into the agent's hook output. Any failure produces no output, which leaves the agent's own behaviour in place.

A background loop runs every 15 seconds. It reads new lines from transcripts, runs checks that are due and, every few minutes, rescans `~/.claude/projects` and refreshes token tips.

## Moods

`peeps_core::mood::feel` turns `Signals` into a `Mood` and a heat value. It is a pure function with a fixed priority:

needs you › failing › steaming › hungry › litter box › sweating › working › stalled › chill

`peeps_core::snapshot::build` gathers signals for each product and produces the `Snapshot` the interface renders.

## Storage

- `~/.peeps/config.toml`: products and checks
- `~/.peeps/peeps.db`: SQLite, notes only
- OS keychain, service `peeps`: secrets referenced as `{secret:NAME}`

Set `PEEPS_HOME` to use another directory.

## Adding an agent

Any agent that can run a command with a JSON payload on stdin can feed peeps. Map its events to the names in `peeps_core::protocol::HookEvent` and send `session_id`, `hook_event_name` and `cwd`.
