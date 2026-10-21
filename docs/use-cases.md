# Use cases

What peeps is for, written from the side of the person using it. Each case lists what should happen and where it is tested: `e2e/` runs the interface in a browser with demo data, `crates/core` holds the Rust unit tests, and `src/**/*.test.ts` the interface logic.

The person in these examples studies, runs a small business, and wants a friendly nudge through the day without another app to manage.

## Their day

### UC1. See the day at a glance

**When** they open peeps.
**Then** Today greets them with their peep, what's due and what's coming up from their calendars. Ticking a to-do feeds the peep, which says "yum, thanks!". Only the companion lives on the desktop.

Tested by `e2e/hub.e2e.ts`, `e2e/notch.e2e.ts`.

### UC10. Keep to-dos and habits

**When** they add "Pay rent #bills" due on the 1st, monthly, reminded the morning of.
**Then** tags become coloured chips with a filter, typing "remind me to drink water every 2 hours" (or "at 6pm", "tomorrow at 9", "every Monday at 10", "in 20 minutes") in Chat sets it up instantly, repeating to-dos roll forward when ticked and count a streak (a daily habit ticked today shows "Done today" and can't be ticked again until tomorrow), and at the chosen time a notification arrives while the peep waves and says the reminder in a speech bubble, with Done and Later (15 minutes).

Tested by `e2e/helper.e2e.ts`, `e2e/nudge.e2e.ts`, `crates/core/src/todos.rs`, `crates/core/src/quick.rs`, `src/helper/todoForm.test.ts`.

### UC17. Nudges like a friend would give

**When** they open Nudges.
**Then** stand up and stretch (hourly, 9 to 6), drink water (every 2 hours, 9 to 9) and rest your eyes (every 3 hours) are each one switch, with their own reminders listed below. Nudges stay off the to-do list so it doesn't fill up.

Tested by `e2e/helper.e2e.ts`, `e2e/hub.e2e.ts`, `src/nudges/presets.test.ts`.

### UC11. Never miss a class

**When** they add their college Google calendar in Settings and a rule "titles with _class_ remind 30 min before".
**Then** a notification arrives 30 minutes before every class, including repeats, skipping cancelled ones and following moved ones. All-day events like exams remind on the morning.

Tested by `e2e/hub.e2e.ts`, `crates/core/src/calendar.rs`, `crates/core/src/reminders.rs`.

## Their peep

### UC9. Chat

**When** they type "What's on today?".
**Then** the peep answers through their own Claude, knowing today's to-dos and events. The conversation carries on until they start a new one, and anything it wants to do comes back as Allow or Deny. It can add to-dos and reminders for them. A model and effort can be picked from the chip above the message box, but never has to be.

Tested by `e2e/helper.e2e.ts`, `e2e/hub.e2e.ts`, `crates/core/src/chat.rs`.

### UC22. It gets to know you

**When** they say hi for the first time.
**Then** the peep asks a few short questions and saves the answers to About me, which every chat reads. It adds to it when they mention something lasting, and they can edit it on the Chat page.

Tested by `crates/core/src/profile.rs`.

### UC8. Play

Click the peep and it says "hehe!" or "boop!" and hugs a heart; click it quickly and it gets dizzy ("whoa…"). Hands come out only when it has something to do: waving for a reminder, reaching for a file dragged over it. It blinks, glances around and wears a hat or scarf in season.

Tested by `e2e/helper.e2e.ts`, `e2e/float.e2e.ts`, `src/life/*.test.ts`, `src/pets/limbs.test.ts`.

### UC4. Hand it a file

**When** they drag a file onto the peep.
**Then** it opens its mouth while the file hovers, gulps it on drop and attaches it to the next message.

Tested by `e2e/drops.e2e.ts`, `src/life/drops.test.ts`.

### UC6. Make it the right size

**When** it feels too big or too small.
**Then** they choose small, medium or large, and whether it lives at the top of the screen or floats anywhere. On the notch it can be dragged along the strip.

Tested by `e2e/notch.e2e.ts`, `e2e/float.e2e.ts`, `src/life/float.test.ts`, `src/life/prefs.test.ts`.

### UC7. Anywhere on screen

**When** they use Windows, or a Mac with an external display.
**Then** the peep floats wherever they drop it and remembers the spot. A click pats it; a double click, a right click or the bubble that appears on hover opens its card towards the side with room.

Tested by `e2e/float.e2e.ts`, `src/life/float.test.ts`.

## Getting going

### UC14. Set up in a minute

**When** they open peeps for the first time.
**Then** a short tour walks through Today, Chat, Nudges and Settings, and can be replayed from the ?. Today lists three steps (say hi, turn on a nudge, add a calendar) and ticks them off. If Claude Code isn't installed, Settings installs it in one click and turns Connected by itself.

Tested by `e2e/hub.e2e.ts`, `src/hub/setupSteps.test.ts`, `crates/core/src/programs.rs`.

### UC16. The same peeps on every computer

**When** they use a MacBook and a Windows PC.
**Then** they choose a folder in a cloud drive they already have on each computer, and to-dos, habits and settings stay in step with no account. Calendar links and chats stay on each computer.

Tested by `e2e/hub.e2e.ts`, `crates/core/src/sync.rs`.

### UC15. Light or dark

**When** they prefer a light window.
**Then** the sidebar toggle switches to a cream theme and remembers it.

Tested by `e2e/hub.e2e.ts`.
