'use strict';
// facts.js -- the course content the game shows.
// Only summary numbers and concepts from the course repository are used here,
// never raw data. Source of every number is given next to it.

// The three playable strains (course repo: R/constants.R, notebook 07, step03).
// doubleJump = strength of the second jump (0 = none); recharge = frames you must
// stand on the ground before the double jump is ready again.
// These are GAME METAPHORS: "double jump = kinase boost" is not a biological claim.
const STRAINS = {
  anc: {
    key: 'anc', label: 'anc', title: 'wild type (JE2)', colour: '#0072B2',
    doubleJump: 0.92, recharge: 1, medalFactor: 1,
    ability: 'AGILE · full double jump',
    lines: ['AGILE · full double jump', 'Recharges on landing.', 'Explore the upper routes.'],
  },
  stk: {
    key: 'stk', label: 'stk', title: 'stk1::Tn (NE217)', colour: '#E69F00',
    doubleJump: 0, recharge: 0, medalFactor: 1.12,
    ability: 'C · ground dash',
    lines: ['GROUNDED · C to dash', 'Burst through debris.', 'Every main route is jumpable.'],
  },
  stp: {
    key: 'stp', label: 'stp', title: 'stp1::Tn (NE1919)', colour: '#009E73',
    doubleJump: 0.6, recharge: 30, medalFactor: 1.08,
    ability: 'DRIFTER · hold jump to glide',
    lines: ['DRIFTER · hold jump to glide', 'Weak jump, gentler descents.', 'No Stp1; much less Stk1 (polar)'],
  },
};

// Formal-test hit counts from our analysis (results/step05_formal_test/hit_counts_mval.csv):
// limma::treat(lfc = 1), BH-FDR < 0.05, total proteome.
// "up" = diff > 0 = higher in the FIRST group of the contrast (A in A_vs_B).
const HIT_COUNTS = {
  TSB_vs_SN: { up: 161, down: 83 },
  TSB_vs_SNpulse: { up: 0, down: 12 },
  TSB_vs_SN_at_anc: { up: 136, down: 68 },
  TSB_vs_SN_at_stk: { up: 158, down: 72 },
  TSB_vs_SN_at_stp: { up: 131, down: 82 },
};

// Cards shown after each level (index = level).
const LEVEL_FACTS = [
  [
    'TSB is the control medium.',
    'Contrast rule: A_vs_B means diff = log2(A) − log2(B).',
    'So TSB_vs_SN > 0 means higher in TSB = lower in SN (PASN).',
  ],
  [
    'A 15-min PASN pulse changes little:',
    `TSB_vs_SNpulse: ${HIT_COUNTS.TSB_vs_SNpulse.down + HIT_COUNTS.TSB_vs_SNpulse.up} proteins pass our formal test,`,
    `all ${HIT_COUNTS.TSB_vs_SNpulse.down} of them higher in SNpulse (diff < 0).`,
    '(limma treat, |log2FC| > 1 tested, BH-FDR < 0.05, n = 3)',
  ],
  [
    `~15 h in PASN changes a lot: TSB_vs_SN gives ${HIT_COUNTS.TSB_vs_SN.up + HIT_COUNTS.TSB_vs_SN.down} hits,`,
    `${HIT_COUNTS.TSB_vs_SN.up} higher in TSB and ${HIT_COUNTS.TSB_vs_SN.down} higher in SN.`,
    'With n = 3 per group: always plot the raw replicates first!',
  ],
  // Bonus level: general background, not course data (see README for sources).
  [
    'Cystic fibrosis: mutations in CFTR, a chloride channel, leave airway',
    'mucus thick and dehydrated, so the cilia cannot clear it well.',
    'S. aureus is common in children with CF; P. aeruginosa becomes',
    'more common with age, and the two can share the airway.',
    'Our course experiment used PASN in vitro, not CF samples.',
  ],
];

// Strain-specific line for the final screen.
function strainFact(key) {
  const h = HIT_COUNTS[`TSB_vs_SN_at_${key}`];
  const base = `TSB_vs_SN_at_${key}: ${h.up + h.down} hits (${h.up} higher in TSB, ${h.down} higher in SN).`;
  const extra = {
    anc: 'This is the reference response the mutants are compared to.',
    stk: 'Stk1 was detected in only 1 of 9 stk samples (step 03).',
    stp: 'Remember: stp lacks Stp1 AND most Stk1 (polar effect).',
  }[key];
  return [base, extra];
}
