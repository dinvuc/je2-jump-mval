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
| stk | stk1::Tn (NTML NE217, Tn at codon 46 of 664) | grounded: no double jump; C gives a short ground dash through debris |
| stp | stp1::Tn (NTML NE1919, Tn at codon 189 of 247) | drifter: weak, slowly recharging double jump; hold jump to glide for up to 1 s while falling. No Stp1 **and** much less Stk1 (polar effect) |

All main routes use fixed platforms and the shared single jump. Strain abilities
help with speed, exploration and recovery. Movement abilities are game metaphors,
not measured phenotypes. There are no activation buttons, receptors, timed bridges,
locked gates or teleport channels.

1. **TSB — the nutrient garden (88 × 30 tiles):** a tutorial in three rooms.
   Steps, a first gap and low debris lead to the canopy hill: bounce or climb
   onto it and leap its shaft, or walk the tunnel below, where a flow channel
   pushes against you. Floating pillars and a backward-pushing track over open
   gaps lead up to the sample terrace. Peptides sit above the canopy, in the
   tunnel and on a high strand. No PASN means no PASN hazards, so no foam.
2. **SNpulse — the exposure run (40 × 68):** grown in TSB, then 15 min PASN.
   Four climbs, each with its own hazard: a foam well with stepping stones and
   a drifting foam clump; a flow channel and strand ladder with foam geysers;
   foam strips and zigzag flow tracks; a bubble chimney (with strands beside it)
   and a final foam-and-geyser gauntlet. Checkpoints sit between climbs.
   The blue exposure front accelerates pyocyanin sources and launchers behind
   it. Reach the MS within 145 game seconds; the HUD maps this to the experiment's
   15-minute pulse. The front adds no contact damage.
3. **SN — weathered biofilm (54 × 54):** ~15 h in 70 % TSB + 30 % PASN.
   Descend over foam-capped steps past drifting foam, then take the roof with
   its foam geysers or the fast flow channel underneath. The spillway mixes
   flow tracks, a foam-edged ledge and drifting foam; the foam lake at the bottom
   is crossed on a pillar, a track and a ledge between two geysers.
   Nutrient collection is a bonus, so reaching the sample completes the level.
4. **CF airway (40 × 76, bonus):** a climb built from stacked cilia tracks
   pushing in alternating directions, with mucus, foam patches, drifting foam,
   a spring and optional crumbling shortcuts. Jump takeoffs on the main route
   are dry. Brace with down during a cough or hold jump to ride the updraft.
   A checkpoint precedes the mucoid colony boss, with cover, ammunition blocks
   and upper escape ledges. Defeat it and reach the sputum sample.
   **This setting is not part of the course experiment.**

Defeated enemies are named twice: a stamped callout appears where they were,
and a feed below the HUD lists them, stacking repeats as ×2, ×3.

Named landmarks, arrows and cystine trails mark the route. Missed jumps on the
climbs generally land on the previous staging floor. Walk into tunnels normally;
the view darkens and music is muffled inside them.

| level | required | bonus stars |
|---|---|---|
| TSB | reach the sample terrace | all 3 peptides · keep 3/3 replicates |
| SNpulse | reach the MS before the exposure clock expires | all 3 peptides · neutralise 5 products |
| SN | reach the MS | collect 8 cystine · all 3 peptides · keep 3/3 replicates |
| CF airway | defeat the mucoid colony and reach the sample | neutralise 6 cells · all 3 peptides · keep 3/3 replicates |

PASN is cell-free, sterile-filtered spent medium of *P. aeruginosa* PAO1.
The three course levels contain only secreted products. Living *P. aeruginosa*
appears only in the separate CF setting.

**Medals and ghosts:** records are separate per level and strain. Initial gold,
silver and bronze targets appear in the intro; stk gets 12 % more time and stp
gets 8 % more. New layouts use version 4 records, preserving earlier records in
browser storage. Your best run records a translucent personal ghost (G toggles it),
with at most 12,000 positions, approximately 20 minutes. Everything stays in your
browser; storage failure never prevents play. Medal targets still need player tuning.

**Difficulty:** choose one of three main-menu buttons. **Normal** is selected by
default and keeps the original gameplay and records. **Study** slows the world
to 55% pace and makes jump timing more forgiving; hits and falls cost no
replicates, the pulse has no deadline, and checkpoint retries have no time
penalty. **Hard** runs at 115% pace and halves protection after hits, from 1.5 to
0.75 game seconds. It keeps Normal's pulse deadline and jump timing. Jump arcs,
routes and strain abilities stay the same in all modes. The real experiment's
pulse was still 15 minutes; difficulty only changes the game.

In Study, four marked **biology stations** per level offer optional reading.
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
starts a fresh attempt. On the game-over screen, tap the footer to retry the stock.

**Antibiotic waves (CF):** a 3 s warning precedes a 4 s inhaled mist. Take cover
under a floor within 10 tiles above you. Exposed *P. aeruginosa* die; the alginate
boss is unaffected. Subsequent waves are 55–80 s apart.

## Things in the world

| thing | meaning |
|---|---|
| three culture flasks | lives represented as replicates; lose all and n = 0 |
| S–S cystine | nutrient collectible; TcyABC is the cystine transporter (TcyA: B7H15_13375) |
| Fe | every three restore a replicate |
| peptide chain ending in K | optional collectible, three per level; trypsin cuts after K/R in proteomics |
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
| green rods / alginate colony | living P. aeruginosa cells / boss in the CF setting only |
| info vesicle | approach to read a short tip |

Between levels, fact cards show real summary numbers from the course analysis.
A_vs_B > 0 means higher in A; the text says which group is higher.

Controls: arrows or A/D to move; Space/up/W to jump (press again for a double
jump as anc/stp); hold jump as stp to glide; C to dash as stk; X/K/Shift to shoot;
down to brace against a cough; R to retry; G to toggle your ghost; P/Esc to pause;
Enter to continue; M for effects and N for music. Touch screens get movement,
jump, dash, shooting, brace and pause buttons. The page offers full screen.

## Graphics

The main canvas adapts to its displayed size and screen pixel density, up to
3 backing pixels per logical pixel. Physics and pointer input keep the same
960 × 544 coordinate system. Terrain is also drawn into higher-density caches
(up to 2×, capped at roughly 16 million pixels per level to bound memory).
Resizing and full screen rebuild the terrain at the appropriate density.
Soft distant layers remain intentionally subdued. Character outlines,
platform edges, opaque text panels, jump stretch, idle breathing and dash
afterimages improve readability. There are no downloaded graphics or fonts.

## Music and sound

The music adds a percussion layer when enemies are near and is muffled in
tunnels; each level has its own victory jingle, and a chime plays when a goal
is ticked off.

The soundtrack is an original chiptune written for this game: an 8-bar theme
over C–Am–F–G, with a different arrangement per medium (bright for TSB,
faster for SNpulse, a darker minor version for SN). It and all sound effects
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
  cells, the glycerol stock checkpoints, the `stk` dash, the `stp` glide,
  the advancing exposure front, mucus and
  cilia as floor types, flow channels as conveyors in the culture levels,
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

index.html and style.css provide the page and canvas. js/facts.js contains strain
metaphors and sourced summary numbers. js/levels.js builds the layouts;
js/runtime.js handles rendering density, dash, checkpoints, ghosts and the
exposure-front display; js/game.js contains physics, entities, drawing and audio.

## Level building and verification

Levels use tile coordinates. A floor at row 30 supports an entity at row 29.
Use ground/solid for terrain, pit for gaps that drop out of the level, plat for
permanent one-way strands, lysed for optional crumbling detours, carve for walk-in
passages, cilia/flow for conveyors, foam for static foam, and put for entities.
vent, spring, ribo, rosgun, geyser, drift, sign, arrow and landmark add their
named objects. L.route lists main-route terrain waypoints used by the regression search.

Keep main-route rises to two rows and leave dry takeoffs. A full single jump
reaches about three rows and clears about three tiles of foam from flat ground.
Mucus reduces jump height below two rows; place the next takeoff beyond it.
Never put foam under a low ceiling: the jump over it needs full headroom.
Timed foam (geysers, drifting clumps) should cross a jump, not cover the only
safe standing spot. Hide peptides on visible, reachable detours with a clear way back.

Run node tests/game.test.cjs. The dependency-free checks cover every level and
strain, removal of activation mechanics, sample and boss goals, dash collision,
glide limits, checkpoint snapshots, timed retries, versioned records, ghosts,
storage errors, scaling and pointer input. tests/routes.cjs searches the real
collision functions through each main route using the basic single jump, with
moving surfaces and crumbling platforms unavailable, conveyors applied and any
contact with static foam rejected, and checks entry and return routes for the
peptide detours. This proves a permanent main terrain route; it does not certify
timed hazards (geysers, drifting foam), reaction time or visual layout
in a browser. tests/harness.cjs supplies a mock Canvas environment.
Further checks cover geyser and drifting-foam damage, conveyors, foam only in
PASN and CF levels, and the kill feed.
Difficulty checks also cover the three buttons, Hard pacing, optional stations, easier timing and
damage rules, unchanged terrain, and separation of Normal/study records.

## License

MIT. See LICENSE.
