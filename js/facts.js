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
    ability: 'C · dash, also in the air',
    lines: ['DASHER · C to dash, also in the air', 'Dashes cut through enemies.', 'Burst through debris.'],
  },
  stp: {
    key: 'stp', label: 'stp', title: 'stp1::Tn (NE1919)', colour: '#009E73',
    doubleJump: 0.6, recharge: 30, medalFactor: 1.08,
    ability: 'DRIFTER · glide, ↓ to dive',
    lines: ['DRIFTER · glide, ↓ in the air to dive', 'Dives smash enemies and debris.', 'No Stp1; much less Stk1 (polar)'],
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

// Study notes separate general biology, course observations and game metaphors.
// Sources checked 2026-11-25; full links are in README.
const STUDY_FACTS = {
  strain: {
    title: 'Stk1 / Stp1: reversible phosphorylation',
    biology: 'Stk1 is a serine/threonine kinase: it adds phosphate groups to proteins. Stp1 is a phosphatase that can remove them, including from Stk1. Phosphorylation can change protein activity without changing protein abundance.',
    game: 'Double jumps, dashes and gliding distinguish the strains for play. They are invented abilities, not measured bacterial movement or proof of kinase activity.',
    source: 'Debarbouille et al., 2009 · PMC2698471; course strain notes',
  },
  TSB: {
    title: 'TSB: the reference condition',
    biology: 'Tryptic soy broth is the nutrient-rich control medium in this course. Comparing the same genotype across media asks about its response to exposure; comparing genotypes within a medium asks a different question.',
    game: 'This garden has no PASN hazards. Its landscape and platforms are decoration; they do not depict the actual culture conditions.',
    source: 'Course design and contrast definitions · README',
  },
  SNpulse: {
    title: 'A pulse is an exposure history',
    biology: 'SNpulse cells grew in TSB before a 15-minute PASN exposure. PASN is sterile-filtered, cell-free spent medium from P. aeruginosa PAO1. Secreted products can affect S. aureus without live Pseudomonas being present.',
    game: 'The blue front is a pacing device. Extra play time at lower difficulty does not change the real experiment: the pulse was still 15 minutes.',
    source: 'Course medium definitions · README',
  },
  SN: {
    title: 'Long exposure differs from a short pulse',
    biology: 'SN cells experienced about 15 hours in 70% TSB plus 30% PASN. This differs from SNpulse in duration and growth history. Spent medium also changes nutrient availability, so a protein response need not be caused by one toxin alone.',
    game: 'The descent and foam course are metaphors. Finding a hazard here does not establish which molecule caused a course proteomics result.',
    source: 'Course medium definitions and interpretation · README',
  },
  'CF airway': {
    title: 'CF airway: a separate bonus setting',
    biology: 'CFTR dysfunction alters salt and water transport at airway surfaces. Dehydrated mucus becomes harder for cilia to clear, allowing microbes to persist. The course itself used PASN in vitro, not airway samples.',
    game: 'Living P. aeruginosa appears only in this bonus setting. Cough updrafts, conveyors and mist-cover rules are invented gameplay.',
    source: 'Cystic Fibrosis Foundation · Basics of Lung Care; course design',
  },
  sulfur: {
    title: 'Cystine and nutrient sulfur uptake',
    biology: 'Cystine consists of two cysteine molecules joined by a disulfide bond. S. aureus can acquire it as a sulfur source using TcyABC and TcyP. TcyA is part of the TcyABC transport system.',
    game: 'The S-S collectibles stand for nutrient acquisition. The TcyA magnet is a shortcut: transporters import substrates at the cell surface rather than pulling distant molecules through space.',
    source: 'Lensmire et al., 2020 · doi:10.1128/IAI.00690-19',
  },
  ribosome: {
    title: 'Ribosomes translate information into protein',
    biology: 'Ribosomes read messenger RNA and join amino acids into a polypeptide. A protein must then fold and may be modified before it functions. More protein abundance does not automatically mean more enzyme activity.',
    game: 'Bumping a ribosome block releases a protein-themed power-up. Real translation uses molecular substrates and energy; it is not triggered by physical impacts.',
    source: 'Standard molecular biology · course proteomics context',
  },
  peptide: {
    title: 'From a protein to an MS signal',
    biology: 'In bottom-up proteomics, proteins are digested into peptides before mass spectrometry. Trypsin usually cleaves after lysine (K) or arginine (R). Peptide evidence is used to identify and estimate the abundance of proteins.',
    game: 'The three hidden peptides are optional exploration goals. They do not represent three biological replicates or three independent measurements of a protein.',
    source: 'Standard bottom-up proteomics · course analysis context',
  },
  ros: {
    title: 'Pyocyanin and oxidative stress',
    biology: 'Pyocyanin is a redox-active P. aeruginosa pigment. Redox cycling can promote reactive oxygen species (ROS), including superoxide and hydrogen peroxide. These can damage cellular components; antioxidant defenses help limit that stress.',
    game: 'Drops and launchers make oxidative stress visible. Superoxide is a reactive chemical species, not a missile that a bacterium can jump over.',
    source: 'Gdaniec et al., 2020 · PMC7496599',
  },
  ahpc: {
    title: 'AhpC: peroxide defense',
    biology: 'AhpC is an alkyl hydroperoxide reductase involved in peroxide defense. In S. aureus, AhpC and catalase KatA have overlapping and compensatory roles. Losing one defense can change expression of another.',
    game: 'The blue shield absorbs one ROS hit for up to 20 game seconds. AhpC is an enzyme, not a disposable shield or a direct superoxide interceptor.',
    source: 'Cosgrove et al., 2007 · PMC1797328',
  },
  xan: {
    title: 'Why S. aureus is golden',
    biology: 'Staphyloxanthin is the carotenoid pigment behind the golden color of S. aureus. Its antioxidant properties can help the cell withstand oxidants, including those produced by host immune cells.',
    game: 'The golden power-up gives 12 seconds of ROS immunity. Real pigment protection is context dependent, not complete invulnerability with a timer.',
    source: 'Liu et al., 2005 · PMC2213009',
  },
  hqno: {
    title: 'HQNO inhibits respiration',
    biology: 'HQNO is a P. aeruginosa exoproduct that suppresses S. aureus respiration. Prolonged exposure can select for slow-growing small-colony variants. This also changes susceptibility to some antibiotics; a slower cell is not simply a weaker cell.',
    game: 'Reduced speed and jump strength stand for respiratory inhibition. A few seconds in a cloud do not demonstrate a stable small-colony variant.',
    source: 'Hoffman et al., 2006 · doi:10.1073/pnas.0606756104',
  },
  hcn: {
    title: 'Hydrogen cyanide and respiration',
    biology: 'P. aeruginosa can release hydrogen cyanide (HCN), which inhibits susceptible respiratory enzymes. Respiratory inhibition limits the use of oxygen for energy conservation. Effects depend on the organism and its respiratory machinery.',
    game: 'The warning puff and timed cloud make a chemical exposure dodgeable. Actual HCN production does not follow these regular game cycles.',
    source: 'Gdaniec et al., 2020 · PMC7496599',
  },
  proteases: {
    title: 'Proteases attack different substrates',
    biology: 'LasA and LasB are secreted P. aeruginosa proteases. LasA can damage S. aureus peptidoglycan; LasB is an elastase. Their biological targets and effects differ, even though both are represented as enemies here.',
    game: 'Walking LasA and flying LasB are visual metaphors. These enzymes do not chase cells or become harmless when stomped.',
    source: 'Gdaniec et al., 2020 · PMC7496599; README background sources',
  },
  omv: {
    title: 'Outer membrane vesicles carry cargo',
    biology: 'Gram-negative bacteria such as P. aeruginosa release outer membrane vesicles (OMVs). Vesicles can carry enzymes and other cargo. Experiments with PAO1 vesicles showed cell-wall-degrading activity against susceptible bacteria, including S. aureus.',
    game: 'Bouncing OMVs represent cargo delivery. They are membrane particles, not living Pseudomonas cells; the bounce and contact damage are invented.',
    source: 'Li et al., 1998 · PMC107602',
  },
  iron: {
    title: 'Iron is useful, but contested',
    biology: 'Iron supports many cellular enzymes. P. aeruginosa siderophores such as pyoverdine and pyochelin bind iron and contribute to competition for it. Iron availability can affect interactions between species.',
    game: 'The claw makes nutrient competition visible. Three Fe tokens restoring a replicate is a reward rule; iron cannot recreate an independent biological replicate.',
    source: 'Gdaniec et al., 2020 · PMC7496599; course replicate design',
  },
  foam: {
    title: 'Rhamnolipids change interfaces',
    biology: 'Rhamnolipids are biosurfactants produced by P. aeruginosa. They affect interfaces and can permeabilize membranes, contributing to antimicrobial effects alongside other secreted products.',
    game: 'Pink foam marks a membrane hazard. Foam pools, erupting geysers and drifting clumps turn a concentration-dependent chemical effect into platforming obstacles; their timing and placement are invented.',
    source: 'Gdaniec et al., 2020 · PMC7496599',
  },
  psm: {
    title: 'PSMs: peptide toxins of S. aureus',
    biology: 'Phenol-soluble modulins (PSMs) are small, amphipathic peptides. Some S. aureus PSMs activate and damage neutrophils, linking them to host-pathogen interactions.',
    game: 'PSMs are ammunition here. Shooting Pseudomonas or debris with them is an invented ability, not evidence that these toxins act as bacterial projectiles.',
    source: 'Forsman et al., 2012 · PMID22431645',
  },
  airway: {
    title: 'Mucus and cilia are host defenses',
    biology: 'Airway mucus traps inhaled material and microbes. Cilia beat to move that mucus out. In cystic fibrosis, dehydrated mucus is harder to clear, helping create a setting where persistent infection can develop.',
    game: 'Sticky floors, conveyors and cough-assisted jumps are movement puzzles. Coughs do not generate new bacteria, and these rules do not model treatment.',
    source: 'Cystic Fibrosis Foundation · Basics of Lung Care',
  },
  boss: {
    title: 'A mucoid colony is a community',
    biology: 'Mucoid P. aeruginosa produces abundant alginate, an extracellular polysaccharide associated with its matrix. A biofilm contains many cells and extracellular material; it is not a single giant bacterium.',
    game: 'The moving colony, opening shell and health bar form a boss fight. Defeating it does not simulate clearing an infection or antibiotic efficacy.',
    source: 'Alginate biofilm study, 2001 · PMC95424 (not course data)',
  },
  replicates: {
    title: 'A saved stock is not a replicate',
    biology: 'Biological replicates are independently prepared samples. The course used three samples per genotype-medium group. Restoring one saved culture repeatedly cannot create independent biological replication.',
    game: 'Cryo-vials are checkpoints and flasks are lives. They let you retry a route; a restored stock is not a new experimental replicate.',
    source: 'Course experimental design · README',
  },
};
