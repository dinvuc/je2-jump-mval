# JE2 Jump

**Small cell. Big reaction.** Run, bounce and glide through a living microscopic world.

A small browser platformer based on the Bio253 block course
*Staphylococcus aureus* JE2 proteomics project (group mval: Din Vuckic &
Mete Kabranlar). No install, build step, internet connection or libraries needed.

**Play:** https://dinvuc.github.io/je2-jump-mval/. To play local changes, open
index.html in your browser. Publishing the repository is a separate step.

## How it plays

You are a golden *S. aureus* JE2 cell. Pick one of the three course strains:

| strain | in the course | in the game |
|---|---|---|
| anc | wild type JE2 | agile: full double jump, recharges on landing |
| stk | stk1::Tn (NTML NE217, Tn at codon 46 of 664) | dasher: no double jump; C dashes on the ground or once per jump in the air (the cell hangs while it dashes), cutting through enemies, superoxide and debris and slamming into the boss; 0.75 s cooldown |
| stp | stp1::Tn (NTML NE1919, Tn at codon 189 of 247) | drifter: weak, slowly recharging double jump; hold jump to glide for up to 1.5 s while falling; ↓ in the air dives straight down, smashing enemies on the way, and the landing shockwave defeats nearby enemies and breaks debris (a dive even cracks the closed boss shell). No Stp1 **and** much less Stk1 (polar effect) |

**First visit:** the game skips the menu and starts TSB as anc on Normal, with a
short controls panel. The full title screen (strains, levels, modes) opens after
the first level is cleared, or at once via P → "Main menu". A race link always
opens its own level and strain.

All main routes use fixed platforms and the shared single jump. Strain abilities
help with speed, exploration and recovery. Movement abilities are game metaphors,
not measured phenotypes. There are no activation buttons, receptors, timed bridges,
locked gates or teleport channels.

Every map has **two parts**. Part 1 ends at a glowing "PART 2" vial: walking into
it saves a stock (like a checkpoint) and moves you straight into part 2 of the same
map. Time, score, replicates, pickups and power-ups carry over; there is no
results screen in between. The gate shows your **split time** for part 1, green
when you are ahead of your personal-best run and red when behind. The gate also
works as a restart point: if you lose your last replicate (n = 0) in part 2, the
cell bursts, the world slows for a moment and part 2 restarts from the gate by
itself, with all three replicates back; time, score and pickups return to what
you had at the gate. Enter restarts at once, R restores the last stock instead,
Esc goes to the menu. If the SNpulse pulse runs out, a panel explains the 15-min
time point and Enter restarts from the gate. The pause menu offers "Restart
part 2" as well. In part 1, n = 0 restarts the whole map straight away, without
the intro panel. The results count every replicate you lost (☠).

1. **TSB — the nutrient garden (part 1: 88 × 30 tiles, part 2: 84 × 40):**
   Part 1 is a tutorial in three rooms. Steps, a first gap and low debris lead
   to the canopy hill: bounce or climb onto it and leap its shaft, or walk the
   tunnel below, where a flow channel pushes against you. Floating pillars and
   a backward-pushing track over open gaps lead up to the terrace gate.
   Part 2 starts at a debris barricade (climb it or shoot through it), then flow
   stairs whose tracks push in turn over an open gap, a bubble chimney with
   strands beside it, and a fast flow tunnel with debris to hop, up to the
   sample terrace. No PASN means no PASN hazards, so no foam.
2. **SNpulse — the exposure run (40 × 68, then 44 × 80):** grown in TSB, then
   15 min PASN. Part 1 has four climbs, each with its own hazard: a foam well
   with stepping stones and a drifting foam clump; a flow channel and strand
   ladder with foam geysers; foam strips and zigzag flow tracks; a bubble chimney
   and a foam-and-geyser gauntlet. Part 2 adds a row of floor geysers, a strand
   ladder with foam on its outer ends, a foam pool with one stepping stone, a
   crumbling bridge with permanent strands above it, a flow elevator with
   drifting foam, and a last gauntlet below the MS.
   The blue exposure front accelerates pyocyanin sources and launchers behind
   it; it covers part 1 in the first 42 % of the deadline and part 2 in the rest.
   Reach the MS within 300 game seconds; the HUD maps this to the experiment's
   15-minute pulse. The front adds no contact damage.
3. **SN — weathered biofilm (54 × 54, then 54 × 62):** ~15 h in 70 % TSB +
   30 % PASN. Part 1 descends over foam-capped steps past drifting foam, then
   takes the roof with its foam geysers or the fast flow channel underneath,
   the spillway, and a foam lake crossed between two geysers. Part 2 goes down
   and to the left: foam-capped ledges, three flow-track switchbacks that carry
   you toward foam at their far ends, pillars over an abyss with drifting foam
   swinging through each gap, and a geyser in front of the MS.
   Nutrient collection is a bonus, so reaching the sample completes the level.
4. **CF airway (40 × 76, then 40 × 90, bonus):** part 1 is a climb built from
   stacked cilia tracks pushing in alternating directions, with mucus, foam
   patches, drifting foam, a spring and optional crumbling shortcuts, up to the
   gate in the upper airway. Part 2 crosses a mucus bog, a cilia gallery with
   foam on the track, a crumbling bridge, a cilia lift whose tracks carry you
   toward foam, and the colony approach. Only then comes the mucoid colony boss,
   with cover, ammunition blocks and upper escape ledges. Defeat it and reach
   the sputum sample. Jump takeoffs on the main routes are dry. Brace with down
   during a cough or hold jump to ride the updraft.
   **This setting is not part of the course experiment.**

## More ways to play

The title screen lists the four story levels and three more chips; ↑ ↓ moves
through all of them. Study plays the story only: the daily challenge and the log
phase are greyed out until you pick Normal or Hard (the codex stays open).

- **Daily challenge (☀).** The date picks one part of one map, a strain and one
  rule of the day: *Low gravity* (80 % gravity), *Swift cell* (run 25 % faster),
  *Single replicate* (start with n = 1), *Grounded* (no double jump or glide)
  or *Cystine magnet* (TcyA pull all run). Everyone gets the same challenge on
  the same day. A part-1 challenge ends at the PART 2 gate; a part-2 challenge
  starts at the gate (in SNpulse with the clock where part 2 begins) and ends at
  the sample. R restarts instantly; your tries and best time today stay in this
  browser for a month. The rules are game modifiers, not biology.
- **Log phase (📈).** A climb generated anew for every run: 20 bands of strand
  steps, conveyor steps, foam, geysers and enemies, getting harder as you rise,
  up to an MS at the top. Each band you clear is one "generation" and the HUD
  doubles a cell counter (2ⁿ). A brown front of "depleted medium" rises behind
  you and gets faster; touching it costs a replicate and throws you upward.
  There are no stocks: R starts a new climb. The best generation is kept per
  strain and difficulty. The name, the 2ⁿ counter and the front are game
  metaphors for growth, not a model of bacterial growth phases.
- **Codex (📖, B on the title, or "Codex" in the pause menu).** A collection
  book of the enemies you neutralised (with counts), the hazards you met and the
  pickups you collected. Each entry shows the short in-game line and the
  matching checked study note from `STUDY_FACTS` (no new biology text). It also
  has a **peptide album** (six peptides per map, remembered across runs) and the
  secrets you found. Entries unlock silently, without a message in play.

### Sharing, race links and micrographs

On every results screen, **T** (or the button) copies a one-line result such as
`JE2 Jump · SN · stp · Normal` / `🥇 ⏱ 2:41 ★★☆ 🧪🧪⬜ ☠ 4` with the game's link.
**L** copies a **race link**: the run's ghost is packed into the part of the
address after `#` (about 4 bytes per 0.2 s). Whoever opens it gets that level,
strain and difficulty selected and races your ghost (red, "RIVAL") next to their
own personal-best ghost; the results say who was faster. **I** saves a
**micrograph**: the current view in an eyepiece frame with a caption, at any time
during play. Nothing is uploaded: the part after `#` is never sent to a server,
and the screenshot is saved by your browser. If copying is blocked, a small panel
shows the text to copy by hand.

### Secrets, chains and replays

- **Secret rooms.** Each map hides one room behind a wall or floor that looks a
  little different (hairline cracks). The cell can pass through; enemies, drops
  and items cannot. Inside is a **golden cluster** (+1000), a game collectible:
  the name *Staphylococcus aureus* refers to golden, grape-like clusters, but the
  cluster is not a biological structure. Locations: TSB beside the first debris,
  SNpulse under the floor on the way to the first peptide, SN in the left wall
  where the roof shaft lands, CF under the floor right of the first cilia track.
- **Stomp chains.** Stomping several enemies without touching the ground gives
  DOUBLE!, TRIPLE! and more, with a rising pitch and +100 per link.
- **Attempt replay.** Every life (from a start, stock or restart until a fall, a
  retry or the end of the part) is recorded as a short track. When a map is done
  and a part took more than one attempt, all tracks of that part run at once on
  a zoomed-out map of the part (at most about 5 s per part; Enter skips).

Defeated enemies are named twice: a stamped callout appears where they were,
and a feed below the HUD lists them, stacking repeats as ×2, ×3.

Named landmarks, arrows and cystine trails mark the route. Missed jumps on the
climbs generally land on the previous staging floor. Walk into tunnels normally;
the view darkens and music is muffled inside them.

| level | required | bonus stars |
|---|---|---|
| TSB | reach the sample terrace at the end of part 2 | all 6 peptides · keep 3/3 replicates |
| SNpulse | reach the MS at the end of part 2 before the exposure clock expires | all 6 peptides · neutralise 8 products |
| SN | reach the MS at the end of part 2 | collect 16 cystine · all 6 peptides · keep 3/3 replicates |
| CF airway | defeat the mucoid colony atop part 2 and reach the sample | neutralise 12 cells · all 6 peptides · keep 3/3 replicates |

PASN is cell-free, sterile-filtered spent medium of *P. aeruginosa* PAO1.
The three course levels contain only secreted products. Living *P. aeruginosa*
appears only in the separate CF setting.

**Medals and ghosts:** records are separate per level and strain. Initial gold,
silver and bronze targets appear in the intro; stk gets 12 % more time and stp
gets 8 % more. New layouts use version 5 records, preserving earlier records in
browser storage. Your best run records a translucent personal ghost (G toggles it),
with at most 12,000 positions, approximately 20 minutes. Everything stays in your
browser; storage failure never prevents play. Medal targets still need player tuning.

**Difficulty:** choose one of three main-menu buttons. **Normal** is selected by
default and keeps the original gameplay and records. **Study** slows the world
(enemies, hazards and their timers, crumbling cells, coughs) to 55% pace while
your cell still runs and jumps at full speed, and makes jump timing more forgiving; hits and falls cost no
replicates, the pulse has no deadline, and checkpoint retries have no time
penalty. **Hard** runs at 115% pace and halves protection after hits, from 1.5 to
0.75 game seconds. It keeps Normal's pulse deadline and jump timing. Jump arcs,
routes and strain abilities stay the same in all modes. The real experiment's
pulse was still 15 minutes; difficulty only changes the game.

In Study, three or four marked **biology stations** per part offer optional reading.
Approach a station, then click **Open biology note** or press **B** to read.
Cards never open automatically. The note appears to one side; the world keeps
running and movement controls still work. Roll away and the note closes
automatically. You can also close it with B or the × button.
The 21 topics cover exposure histories, phosphorylation, nutrient uptake,
translation, proteomics, secreted products, oxidative defenses, airway biology
and replication. Each card separates biology from the game's metaphor. Use the
station's Previous/Next buttons to browse its topics. Stations remain available
when you return; reading never triggers a sequence of encounter popups.
Times, ghosts and best scores are stored separately for each difficulty, so
Study and Hard runs cannot replace Normal records. Tab to a difficulty button
and use Enter/Space to select it, or click/tap it, then choose a strain to start.

**Checkpoint retry (R):** restore the world, inventory and replicates saved at the
last cryo-vial, or the starting position. Time continues and adds a 3 s penalty.
Retried runs cannot earn the keep-all-replicates star. An expired SNpulse deadline
starts a fresh attempt (from the part 2 gate if you already reached part 2). On
the pulse game-over screen, tap the footer to retry the stock; during the n = 0
burst, R does the same. In the daily challenge and the log phase, R restarts
the run instantly instead.

**Antibiotic waves (CF):** a 3 s warning precedes a 4 s inhaled mist. Take cover
under a floor within 10 tiles above you. Exposed *P. aeruginosa* die; the alginate
boss is unaffected. Subsequent waves are 55–80 s apart.

## Things in the world

| thing | meaning |
|---|---|
| three culture flasks | lives represented as replicates; lose all and n = 0 |
| S–S cystine | nutrient collectible; TcyABC is the cystine transporter (TcyA: B7H15_13375) |
| Fe | every three restore a replicate |
| peptide chain ending in K | optional collectible, three per part (six per map); trypsin cuts after K/R in proteomics |
| ribosome block | bump from below to translate a protein power-up |
| pink PSM helices | shooting ammunition, 12 per pickup; X/K/Shift fires |
| golden staphyloxanthin | 12 s protection against ROS |
| AhpC | one-hit ROS shield, up to 20 s (AhpC: B7H15_02095) |
| TcyA | temporarily pulls cystine towards you |
| pyocyanin drops / superoxide launcher | ROS hazards; dodge, shoot or use antioxidant protection |
| HCN vent | warning puff followed by a damaging cloud |
| HQNO cloud | temporarily slows movement and weakens jumps |
| LasA / LasB / OMV | walking protease, flying protease, bouncing vesicle; stomp or shoot |
| siderophore claw | competes for iron |
| pink foam | rhamnolipid hazard: static pools, geysers that bubble before they erupt, drifting clumps |
| mucus / cilia | sticky surfaces / directional conveyors (CF airway) |
| flow channel | directional conveyor in the culture levels (game metaphor) |
| low debris | jump over, shoot, bump from below, or dash through as stk |
| pale cracked cells | collapse 0.6 s after landing and return after 4 s; optional routes only |
| air stone / swollen cell | ride a bubble / bounce upwards |
| cryo-vial | checkpoint; saved stocks are counted in the HUD |
| large vial marked PART 2 | end of part 1: saves a stock and moves on to part 2 |
| green rods / alginate colony | living P. aeruginosa cells / boss in the CF setting only |
| info vesicle | stand on it for about a second to read a short tip (a ring fills around the icon); the tip fades in as a small translucent panel |
| wall or floor with hairline cracks | hidden passage to a secret room; the cell passes, enemies do not |
| golden cluster | secret collectible (+1000), one per map; a game object, not a biological structure |

Between levels, fact cards show real summary numbers from the course analysis.
A_vs_B > 0 means higher in A; the text says which group is higher.

Controls: arrows or A/D to move; Space/up/W to jump (press again for a double
jump as anc/stp); hold jump as stp to glide; ↓ in the air as stp to dive; C to dash as stk (also in the air); X/K/Shift to shoot;
down to brace against a cough; R to retry; G to toggle your ghost; P/Esc to pause;
Enter to continue; M for effects and N for music; B for the codex (title);
T to copy a result, L to copy a race link (results) and I to save a micrograph. Touch screens get movement,
jump, dash, shooting, brace and pause buttons (at least 44 px). The page offers full screen; below the game
it lists the five main keys, with all controls behind "All controls".

**Phones:** play with the phone held sideways (the page then shows only the game).
Held upright, the game is too small to play: a "turn your phone sideways" prompt
covers it and the game pauses. On small screens, messages, info signs, world labels
and the goal list are drawn 30 % larger.

**Reduce motion:** the pause menu item "Screen shake & flashes" turns off screen
shake, the full-screen cough flash and blinking warnings (they stay lit). It
follows the system's reduce-motion setting until you change it.

## Graphics

The main canvas adapts to its displayed size and screen pixel density, up to
3 backing pixels per logical pixel. Physics and pointer input keep the same
960 × 544 coordinate system. Terrain is also drawn into higher-density caches
(up to 2×, capped at roughly 16 million pixels per level to bound memory).
Resizing and full screen rebuild the terrain at the appropriate density.
Soft distant layers remain intentionally subdued. Character outlines,
platform edges, opaque text panels, jump stretch, idle breathing and dash
afterimages improve readability. There are no downloaded graphics or fonts.

**Smooth motion:** physics runs at a fixed 60 steps per second, but the cell, the
camera and moving enemies are drawn between the last two steps, so motion stays
even on 90, 120 and 144 Hz screens. The camera snaps to screen pixels, not game
pixels. The background is faded slightly towards the sky colour (per theme,
strongest in TSB) so the ground in front of it stands out.

**A calmer screen:** the goal checklist shows in full for 5 s at the start of each
part, for 4 s whenever a goal changes, and while paused; otherwise it folds into a
small "☑ 1/3 goals" pill. Control reminders (the ability chip and the R/G/I line)
fade out after 8 s; stk's dash chip stays while the dash is cooling down. Messages
appear below the HUD bar, or at the bottom of the view when the cell is up there.

Animations added for feel (decoration only, no effect on collisions or routes):
the cell's face reacts (^ ^ after pickups, wide eyes near danger, > < while
gliding or dashing, x x after a hit) and its eyes follow the nearest enemy or
pickup; a roll on the double jump; stretch and speed lines in fast falls; a dust
ring and thud on hard landings; a sweat drop when the pulse or the front is
close. Ribosome blocks hop when bumped, debris breaks into tumbling chips, stomps
send out a shock ring, LasA crouches with a "!" for a moment before it charges,
and cryo-vials fill up when a stock is saved. Pickups fly into their HUD counter,
which bounces; the score rolls up; lost flasks shake. The camera looks ahead in
the direction you face and down while you fall, and screen shake is smooth
instead of random jitter. Results play in beats: the score counts up, stars stamp
in one by one with rising notes, the medal drops in and a NEW BEST stamp lands.
Most first-time tutorial banners became short labels in the world. The title
screen groups the strain cards, a STORY panel (the four maps) and a MORE WAYS TO
PLAY panel (daily challenge, log phase, codex), all aligned to the same width.

## Music and sound

The music adds a percussion layer when enemies are near and is muffled in
tunnels; each level has its own victory jingle, and a chime plays when a goal
is ticked off.

The soundtrack is an original chiptune written for this game: an 8-bar A theme
over C–Am–F–G and an 8-bar B section over F–G–Em–Am–F–G–C–C (longer notes, a
half-time snare), played in turn, with a different arrangement per medium (bright
for TSB, faster for SNpulse, a darker minor version for SN). The boss fight loops
the A theme only. It and all sound effects
are synthesised live in the browser with the Web Audio API. There are no
sound files, no samples and no third-party music in this repository, so the
music falls under the same MIT license as the code.

## What is real and what is a game

- **From the course repo:** strain names, NTML IDs and transposon codons
  (`R/constants.R`), locus tags, the medium definitions, and the hit counts
  (`results/step05_formal_test/hit_counts_mval.csv`: `limma::treat`,
  |log2FC| > 1 tested, BH-FDR < 0.05, n = 3). The Stk1 detection count comes
  from step 03.
- **Not from the course:** the CF bonus level. Our experiment used PASN in
  vitro, not CF samples. Its fact card is general background (see sources).
- **Game metaphors, not biological claims:** the boss (a mucoid colony that
  walks, spits and slams), coughs that "add" bacteria, superoxide fired like
  rockets, the antibiotic mist as a hazard you hide from (in reality
  antibiotics are a key CF treatment; here you play a bacterium), "double
  jump = kinase boost", the
  slow recharge for `stp`, "3 Fe = one replicate", the AhpC shield, the TcyA
  magnet, HQNO slowing you down, LasA/LasB/OMVs/HCN/rhamnolipids as hazards,
  "lysed cells" that collapse, ribosome blocks, shooting PSMs (in reality
  *S. aureus* toxins such as PSMs mainly act on host cells, not on
  *P. aeruginosa*), staphyloxanthin as a timed shield, the air bubbles, swollen
  cells, the glycerol stock checkpoints, the `stk` dash (on the ground and in the air)
  and its dash attack, the `stp` glide and dive,
  the advancing exposure front, mucus and
  cilia as floor types, flow channels as conveyors in the culture levels,
  the daily-challenge rules, the log phase (its generations, 2ⁿ counter and
  rising "depleted medium" front), hidden passages and the golden cluster,
  stomp chains, the cell's facial expressions,
  rhamnolipid foam as pools, geysers and drifting clumps (their placement,
  timing and amount are invented), and which *P. aeruginosa* products appear where.
- **Decoration only:** the level art (a biofilm-like ground of packed cocci,
  matrix strands, tunnels, drifting molecules, cell clusters in the background,
  pink airway tissue in the CF level) is there for the look. It does not
  describe how the course cultures were grown.
- **No course data in this repo.** Only a few summary numbers are written
  into `js/facts.js`. Raw and derived data stay in the course repository
  and are git-ignored there.

### Background sources (please verify before citing)

- HQNO and *S. aureus* respiration / small-colony variants: Hoffman *et al.*
  2006, *PNAS* 103:19890, doi:10.1073/pnas.0606756104
- Pyocyanin as a redox-active, ROS-generating pigment: Lau *et al.* 2004,
  *Trends Mol Med* 10:599, doi:10.1016/j.molmed.2004.10.002
- Textbook knowledge, no checked reference added yet (TODO): LasA
  (staphylolysin) and LasB (elastase) as *P. aeruginosa* proteases;
  pyoverdine/pyochelin as siderophores; rhamnolipids as biosurfactants;
  hydrogen cyanide production and outer membrane vesicles of *P. aeruginosa*;
  the *S. aureus* agr quorum-sensing system (AgrB processes the AgrD
  propeptide into the cyclic AIP, which is sensed by the histidine kinase
  AgrC); phenol-soluble modulins; staphyloxanthin as the golden, antioxidant
  carotenoid of *S. aureus*; cystic fibrosis (CFTR, thick mucus, impaired
  mucociliary clearance, *S. aureus* common in children and *P. aeruginosa*
  more common with age; mucoid, alginate-producing *P. aeruginosa* in chronic
  CF infection; biofilms and alginate reducing antibiotic efficacy); pyocyanin redox cycling producing superoxide and hydrogen
  peroxide; trypsin cutting after K/R in bottom-up proteomics.

### Study-note references

Checked on 2026-11-25. These describe general biology, not causal evidence for
the course dataset. Course-specific medium definitions, strains and replication
come from the course context listed above; translation and peptide digestion
are standard molecular-biology and proteomics background.

- [Stk1 kinase and Stp1 phosphatase characterization (2009)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2698471/).
- [TcyABC/TcyP nutrient sulfur acquisition (Lensmire et al., 2020)](https://journals.asm.org/doi/10.1128/iai.00690-19).
- [Secreted antimicrobial products and their combined effects (Gdaniec et al., 2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7496599/): pyocyanin/ROS, respiratory inhibitors, proteases, siderophores and rhamnolipids.
- [KatA/AhpC peroxide defenses (Cosgrove et al., 2007)](https://pmc.ncbi.nlm.nih.gov/articles/PMC1797328/).
- [Staphyloxanthin antioxidant activity (Liu et al., 2005)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2213009/).
- [HQNO and small-colony variants (Hoffman et al., 2006)](https://pubmed.ncbi.nlm.nih.gov/17172450/).
- [Membrane vesicles and bacterial cell-wall damage (Li et al., 1998)](https://pmc.ncbi.nlm.nih.gov/articles/PMC107602/).
- [S. aureus PSM effects on human neutrophils (Forsman et al., 2012)](https://pubmed.ncbi.nlm.nih.gov/22431645/).
- [Alginate overproduction and biofilm structure (2001)](https://pmc.ncbi.nlm.nih.gov/articles/PMC95424/).
- [CFTR, mucus and cilia: Cystic Fibrosis Foundation](https://www.cff.org/managing-cf/basics-lung-care).

## Files

index.html and style.css provide the page, the canvas and the lab-notebook note
("What's new?") in the header. The scripts load in this order, as classic
`<script>` tags without a build step:

| file | contents |
|---|---|
| js/facts.js | strain metaphors, sourced summary numbers, study notes |
| js/levels.js | the eight hand-built map parts, study stations, secret rooms |
| js/endless.js | the seeded generator for the log phase climb |
| js/audio.js | synthesised sound effects and the original chiptune |
| js/runtime.js | rendering density, dash, checkpoints, splits, ghosts, exposure front |
| js/effects.js | rings, chips, world labels, HUD fly-ins, gaze and mood, results timing |
| js/codex.js | the codex, peptide album and secret records |
| js/share.js | result lines, race-link codec, copying, micrographs |
| js/modes.js | daily challenge and log phase rules |
| js/replay.js | attempt tracks and the all-attempts replay |
| js/playtest.js | the hit-and-fall log and its heat map (`?debug=deaths`) |
| js/entities.js | one entry per entity type: set-up, hit box, update and drawing |
| js/game.js | input, physics, shared entity rules, drawing and the state machine |

CHANGELOG.md lists what changed between versions.

## Level building and verification

Levels use tile coordinates. A floor at row 30 supports an entity at row 29.
Use ground/solid for terrain, pit for gaps that drop out of the level, plat for
permanent one-way strands, lysed for optional crumbling detours, carve for walk-in
passages, cilia/flow for conveyors, foam for static foam, and put for entities.
vent, spring, ribo, rosgun, geyser, drift, sign, arrow and landmark add their
named objects; stage marks the end of part 1. L.route lists main-route terrain
waypoints used by the regression search. Each map lists its two builders in
LEVELS[i].stages, and STUDY_STATIONS holds one station list per part.

Keep main-route rises to two rows and leave dry takeoffs. A full single jump
reaches about three rows and clears about three tiles of foam from flat ground.
Mucus reduces jump height below two rows; place the next takeoff beyond it.
Never put foam under a low ceiling: the jump over it needs full headroom.
Timed foam (geysers, drifting clumps) should cross a jump, not cover the only
safe standing spot. Hide peptides on visible, reachable detours with a clear way back.

Jump physics live in js/game.js: in the air the cell keeps more speed when you let
go (AIR_FRICTION), hangs briefly at the top of a held jump (APEX_GRAV) and falls a
little faster than it rises (FALL_GRAV). A full jump rises about 98 px and stays in
the air 41 frames. `fallStep()` is shared with the route search, so any change to
the arc is checked against every route.

New entity types go in js/entities.js: one entry with `init`, `box` (enemies),
`update` and `draw`. Enemies also need their names in ENEMIES, ENEMY_COL and
ENEMY_NAME in js/game.js.

### Playtesting

Every hit and fall is logged in the browser (map, part, position, cause,
difficulty and strain; at most 3,000 entries). Open the game with `?debug=deaths`
after the address (for example `index.html?debug=deaths`) to see the log of the
current part as a heat map, red for hits and blue for falls, with counts per
cause. J copies the whole log as JSON, so playtesters can send it to the team.
Nothing is uploaded. Use it to find where players fail before changing a layout
or the medal times.

Run `npm test` (or node tests/game.test.cjs and node tests/features.test.cjs).
The dependency-free checks cover every level and
strain, removal of activation mechanics, sample and boss goals, dash collision,
glide limits, checkpoint snapshots, timed retries, versioned records, ghosts,
storage errors, scaling and pointer input. tests/routes.cjs searches the real
collision functions through the main route of each part using the basic single jump, with
moving surfaces and crumbling platforms unavailable, conveyors applied and any
contact with static foam rejected, and checks entry and return routes for the
peptide detours. This proves a permanent main terrain route; it does not certify
timed hazards (geysers, drifting foam), reaction time or visual layout
in a browser. tests/harness.cjs supplies a mock Canvas environment.
Further checks cover geyser and drifting-foam damage, conveyors, foam only in
PASN and CF levels, and the kill feed.
Difficulty checks also cover the three buttons, Hard pacing, optional stations, easier timing and
damage rules, unchanged terrain, and separation of Normal/study records.
tests/features.test.cjs also covers the jump arc and air control, drawing between
physics steps, the folding goal list and the SNpulse deadline goal, message
placement and small-screen scaling, the first visit, reduce motion, the playtest
log and both soundtrack sections (against a fake Web Audio clock). It covers the automatic restart and death count, splits,
the animated results, share lines, race-link round trips and bad codes, rival
ghosts, the codex and its storage, stomp chains, the LasA wind-up, the secret
rooms (including entry and exit with the single jump), the daily challenge and
its rules, the log phase (route search through generated climbs for several
seeds, generations, the front, results) and the attempt replay.

## License

MIT. See LICENSE.
