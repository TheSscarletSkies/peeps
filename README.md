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
- **Calendars and reminders.** Paste the private iCal link from Google, Outlook or iCloud and peeps shows what is coming up and sends a Mac notification beforehand. Lead times are yours to set: per calendar, by words in the title ("class" → 30 minutes), or one default. Links live in your keychain.
- **Ask the helper.** Chat with your own Claude Code from the notch, knowing your day; anything it wants to do comes back as Allow or Deny. Drafts can be scheduled, like a LinkedIn post every Monday.
- **Email with your OK.** Add Gmail or iCloud with an app password. The helper drafts, you edit and press Send from its card, and peeps tells you when someone replies and who hasn't.
- **A team for each product.** Give a product a sales co-chair, a growth marketer, a showrunner, a launch marketer or an analyst. Each works on a rhythm from a playbook you write, through your own Claude, and reports back with drafts for you to approve.
- **Payments and posts.** Each product's card shows its week: PayPal payments and YouTube uploads arrive on their own with your own keys; bank transfers and TikTok, Instagram, LinkedIn or X posts take one tap.
- **Every computer, no account.** Choose a folder in iCloud Drive, OneDrive, Dropbox or Google Drive on each computer and to-dos, habits, scheduled drafts, products and settings stay in step.
- **Drop files on a pet.** A product gets them in its next note, the helper with your next message.
- **A helper pet.** To-dos with `#tags`, repeats and streaks for habits, times and reminders, drafts in your voice written by your own agent, and a weekly token report.
- **Weekly recap.** Your week as one shareable card: agent hours, tokens, busiest day, to-dos done and drafts written.
- **Pets with a life.** Little hands and feet: they wave for attention, hold a pencil while working, a cup when calm and a "help" sign when something broke, and reach up to catch a dropped file. Poke one and it squishes, poke it three times and it gets dizzy. Pets cheer when an agent finishes, hop when fed a note, hatch from the steamer when you add a product, and wear a witch hat before Halloween and a scarf in winter.
- **Light or dark, quiet or not.** Theme and an optional boop when a pet needs you live in the sidebar. Sound is off by default.

## Moods

| Mood       | Shows as            | Comes from                                         |
| ---------- | ------------------- | -------------------------------------------------- |
| Needs you  | Hops, with a `!`    | A permission request waiting for you               |
| Failing    | Cries, wobbles      | A session that stopped with an error               |
| Steaming   | Steam puffs, jitter | Context window past `steam_at_context`             |
| Hungry     | Drools, hops        | A check with `signal = "hungry"`                   |
| Litter box | Stink lines         | A check with `signal = "litter_box"`               |
| Sweating   | Sweat droplets      | An agent working longer than `sweat_after_minutes` |
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
pet = { kind = "bao", color = "#FFF3E3" }   # or "gyoza", "wonton"
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

### The helper

A fourth pet that looks after you rather than a product. It keeps a to-do list with due dates and study blocks, writes drafts on request, and shows each product's token use for the week. It gets restless when something is overdue and naps when the list is empty.

```toml
[helper]
command = ["claude", "-p", "{prompt}"]   # or ["codex", "exec", "{prompt}"]
voices = { linkedin = "~/.peeps/voice/linkedin.md", x = "" }
```

Drafts only run when you press **Draft it**. Each entry in `voices` becomes a draft type; point it at a Markdown file describing your voice, or leave it empty. Without `{prompt}` in the command, the request is sent on stdin.

### Mail

Add accounts on the Mail page. Each needs an app password (Gmail: myaccount.google.com/apppasswords; iCloud: account.apple.com → App-Specific Passwords), which stays in the keychain.

```toml
[[mail]]
address = "hello@funderly.app"
provider = "gmail"                 # or "icloud"
name = "Mariyam at Funderly"
login = "mariyam@gmail.com"       # only when the address is a "Send mail as" alias of another account
```

### Teammates

Add teammates on a product's Team tab. They live in the config with their product, and their playbooks are Markdown files in `teammates/<product>/<id>.md` beside it.

```toml
[[product.teammate]]
id = "sana"
name = "Sana"
role = "sales"        # sales, growth, showrunner, launch, analyst or custom
```

### Numbers

Connect PayPal and YouTube on the Numbers page. PayPal needs a REST app from developer.paypal.com with Transaction Search ticked; YouTube needs a free Data API key. Keys stay in the keychain.

```toml
[paypal]
product = "funderly"              # whose revenue PayPal payments are
sandbox = false

[[product]]
id = "enigma-archives"
youtube_channel = "UCxxxxxxxxxxxxxxxxxxxxxx"
```

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
npm run e2e            # each use case in docs/use-cases.md, in a real browser
```

## Roadmap

- Codex and other agents through the same hook protocol
- Rive animations for the pets
- iPhone companion with Lock Screen approvals

## Privacy

No account, no telemetry, no server. Data stays in `~/.peeps`. Secrets live in your OS keychain. The only network calls are the checks you write and the drafts you ask for, which go through your own agent.

## License

MIT
