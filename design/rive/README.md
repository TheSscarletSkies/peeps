# Rive kit

Everything needed to animate the pets in [Rive](https://rive.app). The app swaps the current SVG pets for the Rive files once they exist, so the names below are a contract: keep them exactly.

![Mood reference](moods.png)

## Files

| File        | What it is                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| `bao.svg`   | The bao, every part on its own named layer. Alternative faces start hidden. |
| `gyoza.svg` | The gyoza, same layers and names.                                           |
| `moods.png` | Which layers make up each mood.                                             |

Import each SVG into its own Rive file. Rive keeps the group names as layer names.

## Layers

| Layer                                                                                                               | Use                                           |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `shadow`                                                                                                            | Squashes and fades with jumps                 |
| `pet` › `body-group` › `body`, `pleats`                                                                             | The dumpling; `body` takes the product colour |
| `blush` › `blush-left`, `blush-right`                                                                               | Grows and deepens with heat                   |
| `eyes` › `eyes-open` (`eye-left`, `eye-right`, `shine-left`, `shine-right`), `eyes-closed`, `eyes-x`, `eyes-squint` | One visible at a time                         |
| `brows`                                                                                                             | Effort and frustration                        |
| `mouth` › `mouth-smile`, `mouth-o`, `mouth-flat`, `mouth-wavy`, `mouth-frown`, `mouth-open-smile`, `drool`          | One mouth visible at a time; `drool` adds on  |
| `fx` › `fx-bang`, `fx-sweat`, `fx-steam`, `fx-zzz`, `fx-stink`, `fx-stars`, `fx-confetti`                           | Effects around the pet                        |
| `props` › `bowl`, `litter-box`                                                                                      | Objects beside the pet                        |

Redraw anything you like. Keep the layer names so the states below still make sense.

## Artboard

- One artboard per file, named **`Bao`** or **`Gyoza`**, 240 × 200.
- The pet sits on the bottom edge, centred. Effects may use the space above it.
- Leave the background transparent.

## State machine: `Mood`

### Inputs

| Input       | Type    | Values                                                                                                      |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `mood`      | Number  | 0 chill · 1 working · 2 sweating · 3 steaming · 4 needsYou · 5 hungry · 6 litterBox · 7 failing · 8 stalled |
| `heat`      | Number  | 0 to 100: how fast the product is burning tokens                                                            |
| `celebrate` | Trigger | An agent finished its work                                                                                  |
| `poke`      | Trigger | The user clicked the pet                                                                                    |
| `fed`       | Trigger | The user left the pet a note                                                                                |

### States

Each `mood` value is one looping state. Blend between states over about 200 ms so mood changes never snap.

| `mood`        | Layers                                                 | Motion                                                                      |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| 0 `chill`     | `eyes-open`, `mouth-smile`                             | Slow breathing squash, a blink every 3 to 5 s                               |
| 1 `working`   | `eyes-open`, `mouth-smile`                             | Quick bob; eyes glance left and right as if reading                         |
| 2 `sweating`  | `eyes-open`, `brows`, `mouth-flat`, `fx-sweat`         | Faster bob; drops slide down and fade, one at a time                        |
| 3 `steaming`  | `eyes-open`, `brows`, `mouth-wavy`, `fx-steam`         | Small jitter; puffs rise, grow and fade in turn                             |
| 4 `needsYou`  | `eyes-open`, `mouth-o`, `fx-bang`                      | Hops with squash on landing; `!` pulses. The most attention-grabbing state. |
| 5 `hungry`    | `eyes-open`, `mouth-open-smile`, `drool`, `bowl`       | Leans towards the bowl and back; drool stretches                            |
| 6 `litterBox` | `eyes-squint`, `mouth-frown`, `fx-stink`, `litter-box` | Shuffles away from the box; stink lines wave upwards                        |
| 7 `failing`   | `eyes-x`, `mouth-wavy`, `fx-stars`                     | Tipped over about 14°, gentle wobble; stars orbit the head                  |
| 8 `stalled`   | `eyes-closed`, `mouth-flat`, `fx-zzz`                  | Very slow breathing; z floats up and fades                                  |

### Heat (any state)

`heat` runs in its own layer of the state machine so it combines with every mood. Use a 1D blend from 0 to 100:

- `blush` grows to about 1.6× and reaches full opacity at 100.
- `body` warms towards red by about a third at 100. If you use data binding for the colour (below), animate a tint overlay instead of the fill.

### One-shot triggers

Each plays once on top of the current state, then returns to it:

- `celebrate`: a jump with `eyes-closed`, `mouth-open-smile` and `fx-confetti`, about 1 s.
- `poke`: squash and a quick surprised `mouth-o`. Three pokes in two seconds: dizzy with `fx-stars` for 2 s.
- `fed`: mouth opens, chomps twice, a happy wiggle.

## Product colour

Each product picks its own colour, so `body` must take it at runtime. Add a **View Model** named `Pet` with a colour property `bodyColor` and bind it to the fill of `body`. The app sets `bodyColor` for every pet.

## Handing over

Export `bao.riv` and `gyoza.riv` into `src/pets/rive/`. Keep the source `.rev` files too, so changes stay possible later. The app falls back to the SVG pets whenever a `.riv` file is missing.
