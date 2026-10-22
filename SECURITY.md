# Security

Please report a vulnerability privately through **Security → Report a vulnerability** on this repository, not in a public issue.

## What peeps keeps and where

- Everything stays in `~/.peeps` on your computer. Calendar links, passwords and API keys live in the system keychain, never in the config or the sync folder.
- Chat goes through your own Claude Code; peeps has no server.
- Friends: messages go through the public relay ntfy.sh, sealed with ChaCha20-Poly1305 using a key made from the recipient's code, on channel names derived from a hash of the code. The relay sees only noise. Anyone who has your code can message you, so share it like a phone number; removing a friend blocks their code from adding itself back.
- "One thing at a time" reads only the name of the app in front, every few seconds, and never sends it anywhere. It is off by default.

## The sync folder

The sync folder holds your config, which can name commands peeps runs (the helper's command and any script checks). Only use a folder that you alone can write to. Don't point peeps at a folder shared with other people.
