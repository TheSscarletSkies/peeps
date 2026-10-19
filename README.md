<div align="center">

<img src="design/icon.svg" width="96" alt="">

# peeps

**A dumpling for every product you run, living in your notch.**

</div>

Each product gets a pet. It works when your coding agents work, sweats on long runs, flushes red when it burns tokens fast, steams when its context window fills up, and asks before your agent does something you have to approve. It also watches the product itself: it gets hungry when sign-ups wait for a reply and its litter box fills up when chores go overdue.

Watching costs nothing. Moods come from agent hooks, transcripts on disk and checks you define, never from a model.

## What it does

- **One pet per product.** Sessions are matched to products by folder, so five repos and three agents still read as one pet per thing you are building.
- **Approve from the notch.** Claude Code permission requests show up with Allow and Deny.
- **Notes for the next session.** Leave a note for a product and its agent reads it when its next session starts, or after its next step. Nothing running is interrupted.
- **Checks on your own data.** Point an HTTP check at any JSON API, such as a Supabase table, or run a script in any language.
- **Token tips.** Spots a large `CLAUDE.md` that loads every session, and the largest model doing consistently short work.

## Moods

| Mood       | Shows as            | Comes from                                         |
| ---------- | ------------------- | -------------------------------------------------- |
| Needs you  | Hops, with a `!`    | A permission request waiting for you               |
| Failing    | Tipped over, X eyes | A session that stopped with an error               |
| Steaming   | Steam, jitters      | Context window past `steam_at_context`             |
| Hungry     | Drools, hops        | A check with `signal = "hungry"`                   |
| Litter box | Stink lines         | A check with `signal = "litter_box"`               |
| Sweating   | Sweat drops         | An agent working longer than `sweat_after_minutes` |
| Working    | Bobs                | An agent working                                   |
| Stalled    | Dozes               | No activity for `expect_activity_every_hours`      |
| Chill      | Breathes            | Nothing to report                                  |

Heat is separate from mood: the pet's colour and blush warm up with the token burn rate.

## Install

Download the latest build from [Releases](../../releases): `.dmg` for macOS (Apple silicon or Intel), `.msi` or `.exe` for Windows, `.AppImage` or `.deb` for Linux.

Builds are not code-signed yet, so the first launch needs one extra step:

- **macOS:** right-click peeps in Applications, choose **Open**, then **Open** again.
- **Windows:** on the SmartScreen prompt, click **More info**, then **Run anyway**.

On first launch, hover the notch and follow the setup:

1. **Connect Claude Code.** Adds peeps' hook to `~/.claude/settings.json` and leaves everything else in the file as it is. Disconnect removes exactly what was added.
2. **Add your products.** Pick a name, the product's folder, a dumpling and a colour.

Checks and finer settings live in `~/.peeps/config.toml`. Secrets used by checks go in the OS keychain under the service `peeps`.

### Build from source

Requirements: Rust 1.82+, Node 20+, and on Linux the [Tauri system packages](https://tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri build
```

## Configuration

```toml
[settings]
approvals = true                 # set to false if another app answers permission requests
sweat_after_minutes = 30
steam_at_context = 0.85
full_heat_tokens_per_minute = 60000

[[product]]
id = "shop"
name = "Shop"
paths = ["~/code/shop"]
pet = { kind = "bao", color = "#F6E3B4" }   # or kind = "gyoza"
expect_activity_every_hours = 48

[[product.check]]
id = "unanswered-signups"
signal = "hungry"
message = "{count} sign-ups have waited a week"
every_minutes = 30
kind = "http"
url = "https://YOUR-PROJECT.supabase.co/rest/v1/signups?select=id&replied_at=is.null&created_at=lt.{days_ago:7}"
headers = { apikey = "{secret:shop-supabase}" }
```

`examples/founder.toml` shows three products with HTTP and script checks.

### Checks

- **`http`** fetches JSON. It counts the array it gets back, or the number at `count_pointer`, and fires at `threshold` (default 1).
- **`script`** runs `command` with `args` and reads `{"triggered": bool, "count"?: n, "message"?: "..."}` from stdout. See `examples/checks/`.

URLs and headers accept `{secret:NAME}`, `{days_ago:N}` and `{hours_ago:N}`.

## How it works

```
agent ──hook──▶ peeps-hook ──local socket──▶ peeps app ──▶ notch window
                    ▲                            │
                    └──── decision / notes ◀─────┘
```

- `crates/core`: config, checks, sessions, moods, token usage, notes and the hook protocol. No UI code, fully unit tested.
- `crates/hook`: the small binary agents run. If the app is closed it exits silently, so agents are never blocked.
- `src-tauri`: the desktop app. Runs the socket server, the check scheduler and the window.
- `src`: the React interface and the dumplings.

More in [docs/architecture.md](docs/architecture.md).

## Develop

```sh
npm run dev            # interface in a browser with demo data
npm run tauri dev      # the full app
cargo test --workspace
npm test
```

## Roadmap

- Codex and other agents through the same hook protocol
- A helper pet: to-dos, drafts in your voice, weekly token report
- Rive animations for the pets
- iPhone companion with Lock Screen approvals

## Privacy

No account, no telemetry, no server. Data stays in `~/.peeps`. Secrets live in your OS keychain. The only network calls are the checks you write.

## License

MIT
