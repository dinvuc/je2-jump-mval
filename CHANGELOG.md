# Changelog

## Polish update (26 Nov 2026)

The same entries appear in the "What's new?" lab note on the page.

### Feel
- **Jumps carry:** in the air the cell keeps more of its speed when you let go,
  hangs for a moment at the top of a held jump and falls a little faster. The
  jump is still about three rows high; every route was re-checked.
- **Smooth motion on fast screens:** the cell, the camera and moving enemies are
  drawn between physics steps, so 90, 120 and 144 Hz screens no longer judder.

### A calmer screen
- The goal checklist folds into a small pill after 5 s and reopens for a moment
  when a goal changes (and while paused). Control reminders fade after 8 s.
- Messages move to the bottom when the cell is high in the view.
- The TSB background is faded back so the golden ground stands out.
- Fixed: in SNpulse, "Reach the MS before the pulse ends" was ticked from the start.
  The sample label above the MS no longer shows "0/1 goals" in TSB, SNpulse and SN.

### First visit
- A first visit starts TSB straight away with a short controls panel; the full
  menu opens after the first clear (or via P → Main menu).
- The intro panels are shorter: the medium, one goal line, strain and medal times.
- Below the game the page lists the five main keys; the rest is behind "All controls".

### Phones and comfort
- Upright phones show "turn your phone sideways" and the game pauses.
- Touch buttons are at least 44 px; messages, signs and labels are larger on small screens.
- **Reduce motion** (pause menu): no screen shake, no full-screen flashes, no
  blinking warnings. It follows the system setting by default.

### Music
- A new 8-bar B section (F G Em Am F G C C, half-time snare) alternates with the
  theme. The boss fight keeps the A theme.

### For the team
- **Playtest heat map:** hits and falls are logged in the browser; open the game
  with `?debug=deaths` to see them on the map and press J to copy the log as JSON.
- **js/entities.js:** every entity type is one entry (set-up, hit box, update,
  drawing) instead of four long switch statements in game.js. Seeded runs of all
  map parts and strains behave identically before and after the move.
- New checks in tests/features.test.cjs for all of the above.

## Engagement update (25 Nov 2026)

### Play
- **Instant retry:** at n = 0 the cell bursts, the world slows for a moment and
  the part restarts by itself (Enter: now, R: last stock, Esc: menu). The intro
  panel is skipped. Results count every lost replicate (☠).
- **Split times** at the PART 2 gate, compared with the personal-best run.
- **Daily challenge:** one part, one strain and one rule of the day, the same for
  everyone on the same day.
- **Log phase:** a climb generated from a seed, 20 generations up to an MS, chased
  by a rising "depleted medium" front.
- **Codex:** enemies, hazards and pickups you met, with the checked study notes, a
  peptide album and found secrets.
- **Secret rooms:** one per map behind passable walls or floors, with a golden
  cluster.
- **Stomp chains:** DOUBLE!, TRIPLE! and more when you stomp without landing.
- **Attempt replay:** all attempts at a part run at once on a map of the part.

### Sharing
- One-line results (T), race links that let a friend race your ghost (L) and
  micrograph screenshots (I). Nothing is uploaded.

### Animation and feel
- Facial expressions and eyes that follow things, double-jump roll, fast-fall
  stretch, landing rings, sweat when time is short.
- Ribosome blocks hop, debris breaks into chips, stomp shock rings, LasA wind-up
  before a charge, cryo-vials fill when a stock is saved.
- Pickups fly into the HUD, the score rolls, flasks shake, results stamp in beats.
- Camera looks ahead and down; smoother screen shake.
- Most first-time tutorial banners became short labels in the world.
- Info signs speak only after you stand on them for about a second, in a small
  translucent panel that fades in and out.
- stk: C dashes on the ground and once per jump in the air; dashes defeat enemies
  and superoxide and hit the boss; cooldown 0.75 s (was 1.5 s).
- stp: glide lasts 1.5 s (was 1 s); ↓ in the air dives, smashing enemies, with a
  landing shockwave that defeats nearby enemies and breaks debris.
- Study slows only the world (enemies, hazards, timers); the cell moves at full
  speed. Study plays the story only; daily and log phase need Normal or Hard.
- A drawing error can no longer freeze the game (the codex froze on an HCN icon).
- Title screen reorganised: strain cards, a STORY panel and a MORE WAYS TO PLAY
  panel, aligned and clear of the difficulty buttons.

### Structure
- New files: js/audio.js (moved out of game.js), js/effects.js, js/codex.js,
  js/share.js, js/modes.js, js/endless.js, js/replay.js.
- tests/features.test.cjs for the new features; `npm test` runs both suites.
