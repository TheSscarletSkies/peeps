# Use cases

What peeps is for, written from the side of the person using it. Each case lists what should happen and where it is tested: `e2e/` runs the interface in a browser with demo data, `crates/core` holds the Rust unit tests, and `src/**/*.test.ts` the interface logic.

The person in these examples runs three products (Funderly, Enigma Archives, Kaiveni Hiya), studies, and wants to spend their attention only where it is needed.

## Products

### UC1. See every product at a glance

**When** they glance at the top of the screen.
**Then** each product is a pet beside the notch (or floating, on screens without one), showing its mood: working, sweating on a long task, steaming when its context is nearly full, hungry when a check fires, crying when a session failed, asleep when nothing has happened for a while. Pets that need them stay still and show a `!`; the rest wander.

Tested by `e2e/notch.e2e.ts` (pets and moods), `crates/core/src/mood.rs`, `crates/core/src/snapshot.rs`.

### UC2. Approve a tool from anywhere

**When** an agent asks to run something, like `git push origin main`.
**Then** that product's pet needs them; clicking it shows the exact command with Allow and Deny, and the agent carries on as soon as they choose. The same works for the helper's own agent.

Tested by `e2e/notch.e2e.ts`, `crates/core/src/protocol.rs`, `crates/core/src/session.rs`.

### UC3. Leave a note for a product's next session

**When** they think of something for Funderly while it is busy.
**Then** they feed the pet a note; the agent reads it when its next session starts, or after its next step. Nothing running is interrupted.

Tested by `e2e/notch.e2e.ts`, `crates/core/src/notes.rs`.

### UC4. Hand a file to a product or the helper

**When** they drag a file from Finder or Explorer onto a pet.
**Then** the pet opens its mouth while the file hovers and gulps it on drop. A product's card opens with the file attached to a note; the helper attaches it to the next message. The agent receives the full path.

Tested by `e2e/drops.e2e.ts`, `src/life/drops.test.ts`.

### UC5. Watch their own data

**When** Funderly has sign-ups nobody answered, or Enigma Archives has not posted in four days.
**Then** a check written in the config (an HTTP query such as Supabase, or any script) makes that pet hungry or need its litter box, with the reason on its card.

Tested by `crates/core/src/checks/`.

## Living with the pets

### UC6. Arrange the pets

**When** the strip gets crowded or a product is quiet.
**Then** they can drag any pet anywhere in the strip, hide pets (a hidden pet still comes out when it needs them), choose small, medium or large, and choose where pets live: the notch, the top of the screen, or floating anywhere.

Tested by `e2e/notch.e2e.ts`, `src/life/roam.test.ts`, `src/life/prefs.test.ts`.

### UC7. Use peeps on a screen without a notch

**When** they use Windows, or a Mac with an external display.
**Then** the helper floats wherever they drop it, never over the browser's tabs unless they put it there. A badge counts pets that need them; a click opens all pets and the helper beside it, towards the side with room.

Tested by `e2e/float.e2e.ts`, `src/life/float.test.ts`.

### UC8. Enjoy them

Pets have stubby hands and feet: they wave when they need you, hold a little "help" sign when something broke, scribble with a pencil while working, sip from a cup when all is calm, reach up to catch a file dragged over them, cheer with both arms when an agent finishes, step as they walk along the notch and kick their feet when picked up. They blink, glance around and wiggle on their own, cheer when an agent finishes, hatch when a product is added, squish when poked, get dizzy after three quick pokes, show love when fed or when a to-do is ticked, and wear a hat or scarf in season.

Tested by `src/life/*.test.ts`, `src/pets/limbs.test.ts`.

### UC17. Think a product through with its pet

**When** they open a product (Ask on its card) and ask "Where are we losing people?".
**Then** the pet answers as that product's strategist through their own Claude, knowing its brief (goal, audience, voice, numbers, links, past decisions) and how it is doing right now, and able to read the project. What they agree on becomes to-dos tagged with the product, decisions are dated in the brief, and coding work can be handed to the product's agent as a note. Each product keeps its own conversation. The brief is plain Markdown beside the config, so it syncs and can be edited on the Brief tab.

Tested by `e2e/products.e2e.ts`, `crates/core/src/briefs.rs`, `crates/core/src/chat.rs`, `crates/core/src/tools.rs`, `crates/hook/tests/mcp.rs`.

### UC20. Know what each product earned and posted

**When** Funderly gets paid through PayPal, a sponsor pays Funderly by bank transfer, and Enigma Archives posts on YouTube and TikTok.
**Then** each product's card (in the hub and the tray) shows its last seven days, like "$147 · 3 payments" and "3 posts · last 2 days ago". PayPal payments arrive on their own every 30 minutes, with a notification, once they connect a PayPal REST app on the Numbers page; YouTube uploads arrive with a free API key and the channel id. Bank transfers are logged with + Payment, and TikTok, Instagram, LinkedIn and X posts with one tap on Posted, since those platforms only open their APIs to reviewed apps with a server. Their Claude can log both ("Funderly got $49 from Green Hope") and reads the numbers in reviews and product chats. Entries sync between computers, and the same PayPal payment pulled on two computers counts once. Keys stay in each computer's keychain, and peeps can only read transactions.

Tested by `e2e/numbers.e2e.ts`, `src/numbers/format.test.ts`, `crates/core/src/numbers.rs`, `crates/core/src/paypal.rs`, `crates/core/src/youtube.rs`, `crates/core/src/config_edit.rs`, `crates/core/src/tools.rs`.

### UC21. A team for each product

**When** they give Funderly a sales co-chair, Enigma Archives a showrunner and Kaiveni Hiya a launch marketer from the Team tab.
**Then** a product with no team gets a suggested one, pre-ticked, from what peeps knows about it: sign-ups, payments or pricing suggest a sales co-chair, episodes and videos a showrunner, a launch or waitlist a launch marketer, each with a growth marketer, and the Team page can add every product's suggestion at once. Each teammate starts from a role's playbook (what it owns, what to do each shift, its rules), which they can rewrite in plain words, and works on that role's rhythm, such as weekdays at 9, through their own Claude. A shift ends with a short report in the teammate's own conversation: what it did, what is waiting for them (emails in Mail, posts and scripts in Write, to-dos tagged with the product) and one question. A notification says the report is in. They can pause a teammate, run a shift now, or talk to it like any pet. Teammates never send or publish; everything they make waits for approval. Teammates and playbooks sync between computers, and each shift runs once, on the computer that set it up.

Tested by `e2e/team.e2e.ts`, `src/team/team.test.ts`, `src/lib/rich.test.ts`, `crates/core/src/teammates.rs`, `crates/core/src/config_edit.rs`, `crates/core/src/tools.rs`.

### UC18. A weekly review for each product

**When** they switch on Weekly review on a product's Ask tab.
**Then** every Monday at 9 its pet reads the brief, the live status and the project, writes a short review in the product's conversation with the numbers that matter and the three most useful moves, adds those as to-dos tagged with the product, due by Friday, and sends a notification.

Tested by `e2e/products.e2e.ts`, `crates/core/src/chat.rs`, `src/tray/review.test.ts`.

## The helper

### UC9. Ask the helper anything

**When** they type "What's on today?" or "Draft a reply to the Funderly sign-ups".
**Then** the helper answers through their own Claude Code, with their connectors, knowing today's to-dos, events and products. The conversation carries on between messages until they start a new one. Anything the agent wants to do that needs permission comes back as Allow or Deny. The agent has peeps tools: it can add to-dos and reminders, schedule drafts, draft emails for approval, log payments and posts, leave notes for products and keep product briefs, so "plan my week" ends in real to-dos. It uses the person's own Claude settings until they pick a model and effort (Haiku, Sonnet or Opus; low, medium or high) from the chip above the message box; drafts use the same choice. The helper works with no products at all.

Tested by `e2e/helper.e2e.ts`, `crates/core/src/chat.rs`.

### UC10. Keep to-dos and habits

**When** they add "Pay rent #bills" due on the 1st, monthly, reminded the morning of.
**Then** tags become coloured chips with a filter, nudges like "drink water" can repeat every 1, 2 or 3 hours between two times and count how many today, typing "remind me to drink water every 2 hours" (or "at 6pm", "tomorrow at 9", "every Monday at 10", "in 20 minutes") to the helper sets it up instantly, repeating to-dos roll forward when ticked and count a streak while done on time, and a notification arrives at the chosen lead.

Tested by `e2e/helper.e2e.ts`, `crates/core/src/todos.rs`, `crates/core/src/quick.rs`, `src/helper/todoForm.test.ts`.

### UC11. Never miss a class

**When** they add their college Google calendar and a rule "titles with _class_ remind 30 min before".
**Then** a notification arrives 30 minutes before every class, including repeats, skipping cancelled ones and following moved ones. All-day events like exams remind on the morning. Rules win over a calendar's own lead, which wins over the default.

Tested by `e2e/hub.e2e.ts`, `crates/core/src/calendar.rs`, `crates/core/src/reminders.rs`.

### UC19. Email with approval

**When** they add hello@funderly.app (Gmail, with an app password) and ask the helper "welcome the three new Funderly sign-ups".
**Then** each email waits in the helper's card, which opens on Mail with a badge on the helper: From, To, Subject and the message are all editable, and nothing goes out until they press Send. Discard drops it. A failed send stays with the reason and a Try again. Sent mail is checked for replies every 10 minutes; a reply sends a notification, and the Mail page lists who hasn't answered in 30 days with a Follow up that asks the helper for a threaded draft. Gmail and iCloud work; a work address added to a personal Gmail with "Send mail as" signs in through that Gmail. A synced computer without the app password shows "Needs its app password on this computer". Outlook needs a sign-in peeps can't do without a server, so it isn't supported.

Tested by `e2e/mail.e2e.ts`, `src/mail/mail.test.ts`, `crates/core/src/mail.rs`, `crates/core/src/config_edit.rs`, `crates/core/src/tools.rs`.

### UC12. Get posts written on a schedule

**When** they schedule "LinkedIn post, every Monday at 9, about what I shipped".
**Then** the helper drafts it with their agent at that time, in their voice guide, and notifies them that it is ready to copy.

Tested by `e2e/helper.e2e.ts`, `crates/core/src/schedule.rs`.

### UC13. Share the week

**When** they open Recap.
**Then** they get a 1080 by 1350 card with agent hours, tokens, to-dos done, drafts written, the busiest day and each product's hours, saved to Downloads or copied.

Tested by `e2e/hub.e2e.ts`, `src/hub/recap.test.ts`, `crates/core/src/helper.rs`.

## Getting going

### UC14. Set up in a few minutes

**When** they open peeps for the first time.
**Then** a short tour walks through the window one tooltip at a time, with Back, Next and Skip, and can be replayed from the ? in the sidebar. Home also lists four steps (connect Claude Code, add a product, add a calendar, add a to-do), ticks them off as they happen and can be hidden.

Tested by `e2e/hub.e2e.ts`, `src/hub/gettingStarted.test.ts`.

### UC16. The same peeps on every computer

**When** they use a MacBook and a Windows PC.
**Then** they choose a folder in a cloud drive they already have (iCloud Drive, OneDrive, Dropbox or Google Drive) on each computer. To-dos, habits, scheduled drafts, products and settings stay in step with no account and nothing hosted. The newest edit wins, deletions travel, and a scheduled draft is written once by the computer that made it. A product can have a folder on each computer. Calendar links, passwords and chats stay on each computer.

Tested by `e2e/hub.e2e.ts`, `crates/core/src/sync.rs`, `crates/core/src/todos.rs`, `crates/core/src/schedule.rs`, `crates/core/src/config_edit.rs`.

### UC15. Light or dark

**When** they prefer a light window.
**Then** the sidebar toggle switches the peeps window to a cream theme and remembers it.

Tested by `e2e/hub.e2e.ts`.
