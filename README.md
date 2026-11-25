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

Then play the three media of the experiment as levels:

1. **TSB**: control medium, used as a tutorial. A climb up matrix strands, a
   high ledge, air bubbles, the first quorum-sensing gate, a staircase. No
   PASN, so no PASN hazards.
2. **SNpulse**: grown in TSB, then 15 min PASN. Lysed cells, a strand shaft
   (or a bubble ride), a phospho-switch that runs a moving bridge under a
   pyocyanin ceiling, then down to the MS before the pulse clock runs out.
3. **SN**: ~15 h in 70 % TSB + 30 % PASN. Start high, drop into a pyocyanin
   tunnel, climb a long shaft, cross bottomless islands, and open the gate to
   the MS with a quorum-sensing signal. More hazards, fewer nutrients. You
   need 6 cystine before the MS takes your sample.

The levels scroll in both directions (up to 40 tiles tall). Each level gives
up to three stars: sample measured, all 3 replicates kept, at least 80 % of
the cystine collected. Picking things up quickly in a row builds a combo (up
to x5).

PASN is the cell-free, sterile-filtered spent medium of *P. aeruginosa* PAO1.
It contains secreted molecules only. No living *Pseudomonas* appears in the
experiment or in the game.

| thing | meaning |
|---|---|
| 3 sample tubes (lives) | your 3 replicates. Lose them all and the game says "n = 0: no statistics possible" |
| S–S (L-cystine) | collectible. TcyABC is the cystine transporter (TcyA = `B7H15_13375`) |
| Fe | iron. Every 3 Fe restore a replicate |
| AhpC power-up | shield against one ROS hit (AhpC = `B7H15_02095`, alkyl hydroperoxide reductase) |
| TcyA power-up | pulls cystine towards you |
| blue drops (Pyo) | pyocyanin, which makes ROS and costs a replicate |
| green cloud | HQNO, which inhibits respiration and makes you slow |
| LasA | protease that patrols and charges when it sees you. Jump on it |
| glowing yellow-green claw | siderophore (e.g. pyoverdine). It steals iron |
| pink foam | rhamnolipids, *P. aeruginosa* biosurfactants. Costs a replicate |
| pale cracked cells | "lysed by LasA": they collapse 0.6 s after you land and come back after 4 s |
| air stone + bubbles | stand on a bubble and ride it up |
| AIP block, AgrC notch, AgrB | quorum-sensing puzzle: push the AIP into AgrC to open the purple gate. Touch AgrB for a fresh AIP |
| phospho-switch + bead bridge | touch the switch (a phosphate is added, ON) and the bridge moves for 10 s, then a phosphatase switches it OFF |
| cryo-vial | glycerol stock = checkpoint. You restart from the last one you touched |
| bubble with "i" | info vesicle: walk close to read it |
| ground of packed cocci, twisted strands | decoration (biofilm look). Strands can be jumped through from below |

Between levels the game shows real summary numbers from our analysis, for
example the formal-test hit counts for `TSB_vs_SN` and `TSB_vs_SNpulse`. It
always says in words which group is higher (`A_vs_B > 0` means higher in A).

Controls: `←/→` or `A/D` to move, `Space/↑/W` to jump (press again in the air
to double jump), `P` or `Esc` for the pause menu (resume, restart level,
sound, music, main menu), `Enter` to continue, `M` sound effects on/off, `N`
music on/off. Touch screens get on-screen buttons.

## Music and sound

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
- **Game metaphors, not biological claims:** "double jump = kinase boost", the
  slow recharge for `stp`, "3 Fe = one replicate", the AhpC shield, the TcyA
  magnet, HQNO slowing you down, LasA being stompable and charging, rhamnolipid
  foam as a floor hazard, "lysed cells" that collapse, the air bubbles, the
  glycerol stock checkpoints, "the AIP signal opens a gate", and "a
  phospho-switch runs a bridge for 10 s".
- **Decoration only:** the level art (a biofilm-like ground of packed cocci,
  matrix strands, drifting molecules, cell clusters in the background) is there
  for the look. It does not describe how the course cultures were grown.
- **No course data in this repo.** Only a few summary numbers are written
  into `js/facts.js`. Raw and derived data stay in the course repository
  and are git-ignored there.

### Background sources (please verify before citing)

- HQNO and *S. aureus* respiration / small-colony variants: Hoffman *et al.*
  2006, *PNAS* 103:19890, doi:10.1073/pnas.0606756104
- Pyocyanin as a redox-active, ROS-generating pigment: Lau *et al.* 2004,
  *Trends Mol Med* 10:599, doi:10.1016/j.molmed.2004.10.002
- LasA (staphylolysin) as a staphylolytic protease, pyoverdine/pyochelin
  as *P. aeruginosa* siderophores, rhamnolipids as *P. aeruginosa*
  biosurfactants, and the *S. aureus* agr quorum-sensing system (AgrB
  processes the AgrD propeptide into the cyclic AIP, which is sensed by the
  histidine kinase AgrC): textbook knowledge. We have not added a checked
  reference yet (TODO).

## Files

```
index.html     page + canvas
style.css      page style
js/facts.js    strains, hit counts, fact cards (course content)
js/levels.js   the three levels, built with small helper functions
js/game.js     physics, entities, puzzles, drawing, audio, state machine
```

### Make your own level

Levels are built in code, in tile coordinates (x = column, y = row, row 0 at
the top). Something standing on a surface in row 30 sits in row 29:

```js
const L = newLevel(120, 34);       // 120 columns, 34 rows
ground(L, 0, 40, 30);              // floor from column 0 to 40, top surface row 30
solid(L, 30, 34, 20, 22);          // a floating block of biofilm
plat(L, 17, 27, 4);                // 4-tile strand in row 27
lysed(L, 22, 26, 3);               // 3 tiles of lysed cells (collapse)
put(L, 'cystine', 18, 26);         // a cystine on top of the strand
put(L, 'lasa', 22, 29);            // a LasA walking on the floor
foam(L, 8, 9, 29);                 // rhamnolipid foam on the floor
sign(L, 13, 29, 'Some text');      // info vesicle
vent(L, 5, 29, 10);                // air bubbles that rise 10 rows
agrb(L, 24, 29);                   // AgrB; its AIP block appears at column 25
agrc(L, 30, 30, 'a');              // AgrC notch in the floor, signal 'a'
gate(L, 36, 25, 5, 'a');           // gate rows 25-29, opens on signal 'a'
phos(L, 10, 29, 'b');              // phospho-switch, signal 'b' for 10 s
shuttle(L, 12, 27, 3, 20, 27, 'b');// 3-tile bridge from column 12 to 20 while 'b' is on
```

A single jump climbs 3 rows (2 under HQNO) and crosses about 4 columns, so
the main path should never need more than that. Platforms more than 3 rows up
are bonus areas for double jumps or bubble rides. A gate needs solid tiles
above it, or players can jump over it.

All three levels were checked with a physics-based search that replays real
jumps. With the puzzles solved, every strain can reach the MS (`stk` misses
only the double-jump bonus iron). With the puzzles unsolved, no strain can
reach it, so the puzzles cannot be skipped.

## License

MIT. See `LICENSE`.
