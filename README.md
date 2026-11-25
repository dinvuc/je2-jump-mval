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
   high ledge, a drop into a valley and a staircase. No PASN, so no PASN hazards.
2. **SNpulse**: grown in TSB, then 15 min PASN. Up a strand shaft to a bridge
   under a pyocyanin ceiling, then down to the MS before the pulse clock runs out.
3. **SN**: ~15 h in 70 % TSB + 30 % PASN. Start high, drop into a pyocyanin
   tunnel, climb a long shaft, cross bottomless islands. More hazards, fewer
   nutrients. You need 6 cystine before the MS takes your sample.

The levels scroll in both directions (up to 40 tiles tall).

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
| LasA | protease that walks back and forth. Jump on it |
| glowing yellow-green claw | siderophore (e.g. pyoverdine). It steals iron |
| pink foam | rhamnolipids, *P. aeruginosa* biosurfactants. Costs a replicate |
| cryo-vial | glycerol stock = checkpoint. You restart from the last one you touched |
| bubble with "i" | info vesicle: walk close to read it |
| ground of packed cocci, twisted strands | decoration (biofilm look). Strands can be jumped through from below |

Between levels the game shows real summary numbers from our analysis, for
example the formal-test hit counts for `TSB_vs_SN` and `TSB_vs_SNpulse`. It
always says in words which group is higher (`A_vs_B > 0` means higher in A).

Controls: `←/→` or `A/D` to move, `Space/↑/W` to jump (press again in the air
to double jump), `P` to pause, `Enter` to continue. Touch screens get on-screen
buttons.

## What is real and what is a game

- **From the course repo:** strain names, NTML IDs and transposon codons
  (`R/constants.R`), locus tags, the medium definitions, and the hit counts
  (`results/step05_formal_test/hit_counts_mval.csv`: `limma::treat`,
  |log2FC| > 1 tested, BH-FDR < 0.05, n = 3). The Stk1 detection count comes
  from step 03.
- **Game metaphors, not biological claims:** "double jump = kinase boost", the
  slow recharge for `stp`, "3 Fe = one replicate", the AhpC shield, the TcyA
  magnet, HQNO slowing you down, LasA being stompable, rhamnolipid foam as a
  floor hazard, and the glycerol stock checkpoints.
- **Decoration only:** the level art (a biofilm-like ground of packed cocci,
  matrix strands, drifting molecules, cell clusters in the background) is there
  for the look. It does not describe how the course cultures were grown.
- **No course data in this repo.** Only a few summary numbers are written
  into `js/facts.js`. Raw and derived data stay in the course repository
  and are git-ignored there.

### Background sources for the hazards (please verify before citing)

- HQNO and *S. aureus* respiration / small-colony variants: Hoffman *et al.*
  2006, *PNAS* 103:19890, doi:10.1073/pnas.0606756104
- Pyocyanin as a redox-active, ROS-generating pigment: Lau *et al.* 2004,
  *Trends Mol Med* 10:599, doi:10.1016/j.molmed.2004.10.002
- LasA (staphylolysin) as a staphylolytic protease, pyoverdine/pyochelin
  as *P. aeruginosa* siderophores, and rhamnolipids as *P. aeruginosa*
  biosurfactants: textbook knowledge. We have not added a checked reference
  yet (TODO).

## Files

```
index.html     page + canvas
style.css      page style
js/facts.js    strains, hit counts, fact cards (course content)
js/levels.js   the three levels, built with small helper functions
js/game.js     physics, entities, drawing, state machine
```

### Make your own level

Levels are built in code, in tile coordinates (x = column, y = row, row 0 at
the top). Something standing on a surface in row 30 sits in row 29:

```js
const L = newLevel(120, 34);   // 120 columns, 34 rows
ground(L, 0, 25, 30);          // floor from column 0 to 25, top surface row 30
solid(L, 30, 34, 20, 22);      // a floating block of biofilm
plat(L, 17, 27, 4);            // 4-tile strand in row 27
put(L, 'cystine', 18, 26);     // a cystine on top of it
put(L, 'lasa', 22, 29);        // a LasA walking on the floor
foam(L, 8, 9, 29);             // rhamnolipid foam on the floor
sign(L, 13, 29, 'Some text');  // info vesicle
```

A single jump climbs 3 rows (2 under HQNO) and crosses about 4 columns, so
the main path should never need more than that. Platforms more than 3 rows up
are bonus areas for strains that can double jump. All three levels have been
checked with a physics-based search: every strain can reach the MS, and `stk`
misses only the double-jump bonus iron.

## License

MIT. See `LICENSE`.
