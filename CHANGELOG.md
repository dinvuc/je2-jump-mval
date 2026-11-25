# Changelog

## Engagement update (25 Nov 2026)

The same entries appear in the "What's new?" lab note on the page.

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

### Structure
- New files: js/audio.js (moved out of game.js), js/effects.js, js/codex.js,
  js/share.js, js/modes.js, js/endless.js, js/replay.js.
- tests/features.test.cjs for the new features; `npm test` runs both suites.
