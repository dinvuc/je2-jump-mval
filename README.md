# JE2 Jump

A small browser platformer based on the Bio253 block course
*Staphylococcus aureus* JE2 proteomics project (group mval: Din Vuckic &
Mete Kabranlar).

**Play:** https://dinvuc.github.io/je2-jump-mval/. You can also open
`index.html` in a browser; it needs no install, no build and no internet.

## How it plays

You are a golden *S. aureus* JE2 cell. Pick one of the three course strains:

| strain | in the course | in the game |
|---|---|---|
| `anc` | wild type JE2 | full double jump, recharges at once |
| `stk` | `stk1::Tn` (NTML NE217, Tn at codon 46 of 664) | no double jump (no Stk1 kinase), hard mode |
| `stp` | `stp1::Tn` (NTML NE1919, Tn at codon 189 of 247) | weak, slowly recharging double jump: no Stp1 **and** much less Stk1 (polar effect) |

Then play the three media of the experiment as levels, plus a bonus level:

1. **TSB** (60 × 46 tiles): control medium, tutorial. A room with a ribosome
   block and a short tunnel (a shortcut), a strand tower, a middle ledge with
   the quorum-sensing gate, and the MS on top. No PASN, so no PASN hazards.
2. **SNpulse** (48 × 72): grown in TSB, then 15 min PASN. A climb against the
   pulse clock: an OMV room, a ledge of HCN vents and superoxide rockets, a
   strand shaft with LasB, a phospho-switch lift, a bubble ride, and lysed
   strands to the MS at the top. One secret tunnel.
3. **SN** (70 × 64): ~15 h in 70 % TSB + 30 % PASN. Down from a high start
   onto a thick biofilm (over the top, or through its tunnel), into a pit over
   rhamnolipid foam, and along the floor to the gate in front of the MS.
4. **CF airway** (36 × 96, bonus): a cystic fibrosis airway. Floors alternate
   left and right; you climb through sticky mucus, past beating cilia, mucus
   plugs and superoxide, while the patient coughs now and then (the screen
   shakes, air pushes you, and more *P. aeruginosa* appear). At the top waits
   the boss, a **mucoid *P. aeruginosa* colony** in an alginate shell: it
   spits pyocyanin, releases cells and slams the floor; shoot it, or jump on
   it while its shell is open. Then reach the sputum sample.
   **This level is a game setting, not part of the course experiment.**

Each level has at most one tunnel, with labelled channels ("tunnel",
"back up", "secret"), and glowing arrows show the way at every turn. Inside a
tunnel the view darkens around a soft light on your cell and the music is
muffled.

**Medal times:** every level has gold / silver / bronze target times (shown in
the level intro). The HUD timer dot shows which medal you are still on track
for; the results screen shows your medal and best time, and the title screen
shows your best medal on each level button. Best times are kept in your
browser only. (The targets are first estimates and may need tuning.)

**Antibiotic waves (CF level):** every 55–80 s, after a 3 s warning, an inhaled
antibiotic mist comes down the airway for 4 s. Take cover under a floor (within
10 tiles above you) or lose a replicate. *P. aeruginosa* caught in the open
die; the alginate-wrapped boss is unaffected.

Each level has a goal checklist (bottom-left on screen). Required goals must be
done before the MS (or the sputum sample) takes your sample; bonus goals give
stars:

| level | required | bonus stars |
|---|---|---|
| TSB | open the quorum-sensing gate | all 3 hidden peptides · keep 3/3 replicates |
| SNpulse | reach the MS before the pulse ends | all 3 hidden peptides · neutralise 5 *P. aeruginosa* products |
| SN | collect 6 cystine · open the gate | all 3 hidden peptides · keep 3/3 replicates |
| CF airway | clear the mucoid colony · neutralise 6 *P. aeruginosa* cells | all 3 hidden peptides · keep 3/3 replicates |

PASN is the cell-free, sterile-filtered spent medium of *P. aeruginosa* PAO1.
It contains secreted molecules only. In the three PASN/TSB levels no living
*Pseudomonas* appears, only secreted products. Living *P. aeruginosa* cells
appear only in the separate CF bonus level.

### Things in the game

| thing | meaning |
|---|---|
| 3 culture flasks (lives) | your 3 replicates. A lost one is empty and flashes red. Lose them all and the game says "n = 0: no statistics possible" |
| S–S (L-cystine) | collectible. TcyABC is the cystine transporter (TcyA = `B7H15_13375`) |
| Fe | iron. Every 3 Fe restore a replicate |
| tryptic peptide (chain ending in K) | hidden collectible, 3 per level. In proteomics, trypsin cuts proteins after K/R and the MS identifies the peptides |
| ribosome block | jump into it from below: it "translates" a protein power-up that slides out |
| PSMs (pink helices) | power-up: phenol-soluble modulins. Shoot them with `X`, `K` or `Shift` (12 per pickup) |
| staphyloxanthin (golden chain) | power-up: for 12 s, ROS (pyocyanin drops) cannot hurt you, and you glow gold |
| AhpC power-up | shield against one ROS hit (AhpC = `B7H15_02095`, alkyl hydroperoxide reductase) |
| TcyA power-up | pulls cystine towards you |
| blue drops from a phenazine | pyocyanin, which makes ROS and costs a replicate |
| blue launcher + flying red O₂ | pyocyanin redox launcher firing superoxide radicals (O₂•⁻, a ROS) in straight lines. Jump over, stomp or shoot them; AhpC and staphyloxanthin protect you |
| green cloud | HQNO, which inhibits respiration and makes you slow |
| HCN vent | puffs hydrogen cyanide now and then; the cloud costs a replicate |
| LasA (walks) / LasB (flies) | *P. aeruginosa* proteases. LasA charges when it sees you. Jump on them or shoot them |
| bouncing double-membrane bubble | outer membrane vesicle (OMV) released by *P. aeruginosa*. Jump on it or shoot it |
| glowing yellow-green claw | siderophore (e.g. pyoverdine). It steals iron; PSMs stop it |
| pink foam | rhamnolipids, *P. aeruginosa* biosurfactants. Costs a replicate |
| green rods (CF level only) | living *P. aeruginosa*: swimming (flagellum) and twitching (pili) cells |
| green gel blob with eyes (CF boss) | a mucoid *P. aeruginosa* colony wrapped in alginate |
| "COUGH!" (CF level) | every 24–46 s, with a warning: the screen shakes, air pushes you up, and up to 3 more *P. aeruginosa* appear |
| yellow-green goo (CF) | thick mucus: slow and lower jumps |
| pink floor with hairs (CF) | cilia that push you along |
| debris / mucus plug blocks | shoot them, or bump them from below |
| pale cracked cells | "lysed by LasA": they collapse 0.6 s after you land and come back after 4 s |
| air stone + bubbles | stand on a bubble and ride it up |
| swollen cell | land on it and it throws you about 6 tiles up |
| water channel (blue opening) | stand on it and press `↓`: you come out at the other end |
| AIP block, AgrC notch, AgrB | quorum-sensing puzzle: push the AIP into AgrC to open the purple gate. Touch AgrB for a fresh AIP |
| phospho-switch + bead bridge / lift | touch the switch (a phosphate is added, ON) and the bridge or lift runs for 10 s, then a phosphatase switches it OFF |
| cryo-vial | glycerol stock = checkpoint. You restart from the last one you touched. The HUD counts the stocks you have saved in the level |
| glowing arrows | the way to go |
| bubble with "i" | info vesicle: walk close to read it |
| ground of packed cocci, strands, tunnels | decoration (biofilm look). Strands can be jumped through from below |

The block-bumping, warp channels, bounce pads, pushable blocks, switches and
moving platforms are standard puzzle-platformer mechanics; the art, names and
levels are our own.

Between levels the game shows real summary numbers from our analysis, for
example the formal-test hit counts for `TSB_vs_SN` and `TSB_vs_SNpulse`. It
always says in words which group is higher (`A_vs_B > 0` means higher in A).

On the title screen, pick a strain (`1/2/3`, `←/→` or a click) and the level
to start at (`↑/↓` or a click, including the CF bonus level), then press
`Enter`/`Space` or click a strain card. Later levels follow in order.

Controls: `←/→` or `A/D` to move, `Space/↑/W` to jump (press again in the air
to double jump), `X`/`K`/`Shift` to shoot, `↓` to dive into a channel, `P` or
`Esc` for the pause menu (resume, restart level, sound, music, main menu),
`Enter` to continue, `M` sound effects on/off, `N` music on/off. Touch screens
get on-screen buttons.

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
  cells, water channels as warps, the glycerol stock checkpoints, "the AIP
  signal opens a gate", "a phospho-switch runs a bridge for 10 s", mucus and
  cilia as floor types, and which *P. aeruginosa* products appear where.
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

## Files

```
index.html     page + canvas
style.css      page style
js/facts.js    strains, hit counts, fact cards (course content + CF background)
js/levels.js   the four levels, built with small helper functions
js/game.js     physics, entities, puzzles, drawing, audio, state machine
```

### Make your own level

Levels are built in code, in tile coordinates (x = column, y = row, row 0 at
the top). Something standing on a surface in row 30 sits in row 29:

```js
const L = newLevel(60, 40);          // 60 columns, 40 rows
ground(L, 0, 59, 30);                // floor from column 0 to 59, top surface row 30
carve(L, 2, 50, 32, 34);             // a tunnel inside the floor
solid(L, 30, 34, 20, 22);            // a floating block of biofilm
plat(L, 17, 27, 4);                  // 4-tile strand in row 27
lysed(L, 22, 26, 3);                 // lysed cells (collapse)
mucus(L, 40, 45, 30); cilia(L, 46, 50, 30, 1);   // sticky floor, floor that pushes right
ribo(L, 8, 26, 'psm');               // ribosome block that makes PSMs
debris(L, 12, 12, 28, 29);           // breakable block
put(L, 'cystine', 18, 26);           // collectibles: cystine, iron, peptide, xan, ahpc, tcya
put(L, 'omv', 22, 29);               // enemies: lasa, lasb, omv, hcn, dripper, hqno, sidero, pa, twitch
foam(L, 8, 9, 29);                   // rhamnolipid foam on the floor
sign(L, 13, 29, 'Some text');        // info vesicle
vent(L, 5, 29, 10);                  // air bubbles that rise 10 rows
spring(L, 25, 29);                   // swollen cell
channel(L, 3, 29, 1, 'tunnel'); channel(L, 4, 34, 1, 'back up');   // two labelled ends of channel 1
rosgun(L, 40, 29);                   // pyocyanin launcher firing superoxide
arrow(L, 30, 29, 'up');              // a glowing arrow: this way
agrb(L, 24, 29);                     // AgrB; its AIP block appears at column 25
agrc(L, 30, 30, 'a');                // AgrC notch in the floor, signal 'a'
gate(L, 36, 25, 5, 'a');             // gate rows 25-29, opens on signal 'a'
phos(L, 10, 29, 'b');                // phospho-switch, signal 'b' for 10 s
shuttle(L, 12, 27, 3, 20, 27, 'b');  // 3-tile bridge from column 12 to 20 while 'b' is on
```

Each level also lists its `goals` (see `LEVELS` in `js/levels.js`). A single
jump climbs 3 rows (2 under HQNO or on mucus) and crosses about 4 columns, so
the main path should never need more than that. A gate needs solid tiles
above it that are out of reach, or players can jump over it.

All four levels were checked with a physics-based search that replays real
jumps (with springs, channels, lifts and bubbles). With the puzzles solved,
every strain can reach the goal; with them unsolved, no strain can, so the
puzzles cannot be skipped. Only peptides hidden behind breakable blocks need
a PSM shot.

## License

MIT. See `LICENSE`.
