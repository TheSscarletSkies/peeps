<div align="center">

<img src="design/icon.svg" width="96" alt="">

# peeps

**A little dumpling that keeps you on top of your day.**

</div>

peeps is a desktop companion for Mac and Windows. It sits at the top of your screen, or anywhere you drop it, and helps you through the day like a friend would: what's on today, a nudge to stretch or drink water, and a pat when you need one.

## What it does

- **Today.** Your to-dos with `#tags`, dates and repeats, and what's coming up from your calendars. Tick one off and your peep gets a snack.
- **Chat.** Talk to your peep through your own Claude. It remembers what you tell it about you, and anything it wants to do, it asks first. “Remind me to call mum at 6” becomes a reminder.
- **Nudges.** Stand up and stretch, drink water, rest your eyes: each one switch. Your own reminders sit beside them. When one is due, your peep waves and says it in a bubble, with Done and Later.
- **Play.** Click your peep for a pat; click it a lot and it gets dizzy. Double-click or right-click it, or use the little bubble, to talk. Drop a file on it and it joins your next message.
- **Small, medium or large.** Make it the size you like, at the top of the screen or floating anywhere.
- **Calendars.** Paste the private iCal link from Google, Outlook or iCloud and peeps reminds you before classes and calls. Links live in your keychain.
- **Every computer, no account.** Choose a folder in iCloud Drive, OneDrive, Dropbox or Google Drive and your Mac and PC stay in step.
- **Light or dark, quiet or not.** Theme and an optional boop live in the sidebar.

## Install

Download the latest build from [Releases](../../releases): `.dmg` for macOS (Apple silicon or Intel), `.msi` or `.exe` for Windows, `.AppImage` or `.deb` for Linux.

Builds are not code-signed yet, so the first launch needs one extra step:

- **macOS:** right-click peeps in Applications, choose **Open**, then **Open** again.
- **Windows:** on the SmartScreen prompt, click **More info**, then **Run anyway**.

On first launch peeps opens its window with a short tour. Say hi in Chat so it gets to know you, then switch on a nudge or two. Chat needs Claude Code, which comes with a Claude account; if it isn't installed, Settings installs it in one click.

### Build from source

Requirements: Rust 1.82+, Node 20+, and on Linux the [Tauri system packages](https://tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri build
```

## Configuration

Everything is set in the app. Finer settings live in `~/.peeps/config.toml`; what you tell your peep about you is in `about-me.md` beside it.

```toml
[helper]
command = ["claude", "-p", "{prompt}"]   # or ["codex", "exec", "{prompt}"]
```

Without `{prompt}` in the command, the request is sent on stdin.

## How it works

```
to-dos, calendars ──▶ peeps app ──▶ notch or floating window
                          │  ▲
            your Claude ◀─┘  └── reminders, nudges
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

- Focus sessions: 25 minutes, then a break
- “One thing at a time”: a gentle nudge when you keep switching between apps
- iPhone companion

## Privacy

No account, no telemetry, no server. Data stays in `~/.peeps`. Secrets live in your OS keychain. The only network calls are your calendar links and the chats you start, which go through your own Claude.

## License

MIT
