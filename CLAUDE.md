# Instructions for AI coding agents (JE2 Jump)

A small HTML5 canvas game made by Bio253 group mval, themed on the course's
*S. aureus* JE2 proteomics project.

- Plain JavaScript, no libraries, no build step, classic `<script>` tags (so
  `index.html` also works from `file://`). Do not add a bundler or framework.
- Plain file names, no `_mval` suffix (that rule belongs to the course repo only).
- **Never commit course data** (Excel/TSV/parquet/FASTA). Only short summary
  numbers go in `js/facts.js`, and each one names its source file in the
  course repo.
- Biology wording must stay correct: PASN = cell-free spent medium of
  *P. aeruginosa* PAO1, never "co-culture" or "in the presence of Pseudomonas".
  `A_vs_B > 0` means higher in A; say which group is higher in words. `stp` also
  lacks most Stk1 (polar effect).
- Game mechanics are metaphors. Label them as such in the README, and do not
  turn them into biological claims. Do not invent references.
- No AI co-author trailers in commits.
