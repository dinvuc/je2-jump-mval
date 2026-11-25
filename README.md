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

1. **TSB**: control medium, used as a tutorial.
2. **SNpulse**: grown in TSB, then 15 min PASN. You have to reach the mass spectrometer before the pulse clock runs out.
3. **SN**: ~15 h in 70 % TSB + 30 % PASN. More hazards, fewer nutrients. You need 6 cystine before the MS takes your sample.

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
| orange spinner | siderophore. It steals iron |

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
  magnet, HQNO slowing you down, and LasA being stompable.
- **No course data in this repo.** Only a few summary numbers are written
  into `js/facts_mval.js`. Raw and derived data stay in the course repository
  and are git-ignored there.

### Background sources for the hazards (please verify before citing)

- HQNO and *S. aureus* respiration / small-colony variants: Hoffman *et al.*
  2006, *PNAS* 103:19890, doi:10.1073/pnas.0606756104
- Pyocyanin as a redox-active, ROS-generating pigment: Lau *et al.* 2004,
  *Trends Mol Med* 10:599, doi:10.1016/j.molmed.2004.10.002
- LasA (staphylolysin) as a staphylolytic protease, and pyoverdine/pyochelin
  as *P. aeruginosa* siderophores: textbook knowledge. We have not added a
  checked reference yet (TODO).

## Files

```
index.html            page + canvas
style_mval.css        page style
js/facts_mval.js      strains, hit counts, fact cards (course content)
js/levels_mval.js     the three levels, built with small helper functions
js/game_mval.js       physics, entities, drawing, state machine
```

Following our group rule, every file we created ends in `_mval`. Files that
need a fixed name (`index.html`, `README.md`, `LICENSE`) are the exceptions.

### Make your own level

Levels are built in code, in tile coordinates (row 14 = ground surface):

```js
ground(L, 0, 25);              // floor from column 0 to 25
plat(L, 17, 11, 4);            // 4-tile platform in row 11
put(L, 'cystine', 18, 10);     // a cystine above it
put(L, 'lasa', 37);            // a LasA walking on the ground
sign(L, 13, 'Some text');      // info sign
```

A single jump climbs about 3 tiles and crosses about 4 tiles, so the main path
should never need more than that. Higher platforms are bonus areas for strains
that can double jump.

## License

MIT. See `LICENSE`.
