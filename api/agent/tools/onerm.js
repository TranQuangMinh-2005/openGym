export const REP_CAP = 12;

export const WEIGHTED_REP_CAP = 15;


export const FORMULAS = {
  epley:    (w, r) => w * (1 + r / 30),
  brzycki:  (w, r) => w * 36 / (37 - r),
  lombardi: (w, r) => w * Math.pow(r, 0.1),
  oconner:  (w, r) => w * (1 + r / 40),
  mayhew:   (w, r) => (w * 100) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  wathan:   (w, r) => (w * 100) / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  lander:   (w, r) => (w * 100) / (101.3 - 2.67123 * r),
}
export const DEFAULT_FORMULA = 'epley';

export const FORMULA_NAMES = {
  epley: 'Epley', brzycki: 'Brzycki', lombardi: 'Lombardi', oconner: 'O’Conner',
  mayhew: 'Mayhew', wathan: 'Wathan', lander: 'Lander',
}
export const formulaOf = S => {
  const f = S?.oneRmFormula;
  return f === 'weighted' || Object.hasOwn(FORMULAS, f) ? f : DEFAULT_FORMULA;
}

const RIR_PCT = [
  100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9,
  71.7, 69.5, 67.5, 65.5, 63.6,
];

function rirEstimate(w, effectiveReps) {
  const idx = Math.min(Math.max(Math.round(effectiveReps) - 1, 0), RIR_PCT.length - 1);
  return (w * 100) / RIR_PCT[idx];
}

const WEIGHTS = {
  epley:    { a: 0.95, v: r => r <= 6  ? 1 : Math.max(0.4, 1 - (r - 6) * 0.12) },
  brzycki:  { a: 1.10, v: r => r <= 8  ? 1 : Math.max(0.3, 1 - (r - 8) * 0.18) },
  lombardi: { a: 0.85, v: r => r <= 5  ? 1 : Math.max(0.4, 1 - (r - 5) * 0.10) },
  oconner:  { a: 0.90, v: r => r <= 6  ? 1 : Math.max(0.4, 1 - (r - 6) * 0.12) },
  mayhew:   { a: 0.95, v: r => r <= 8  ? 1 : Math.max(0.5, 1 - (r - 8) * 0.10) },
  wathan:   { a: 0.90, v: r => r <= 7  ? 1 : Math.max(0.4, 1 - (r - 7) * 0.12) },
  lander:   { a: 0.85, v: r => r <= 7  ? 1 : Math.max(0.35, 1 - (r - 7) * 0.15) },
  rir:      { a: 1.00, v: r => r <= 10 ? 1 : Math.max(0.4, 1 - (r - 10) * 0.15) },
}

function ensembleCV(w, effectiveReps) {
  const vals = Object.keys(FORMULAS).map(f => FORMULAS[f](w, effectiveReps));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, e) => a + (e - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance) / mean;
}

export function weightedEstimate(w, effectiveReps) {
  let total = 0;
  let wsum = 0;
  for (const [name, fn] of Object.entries(FORMULAS)) {
    const wt = WEIGHTS[name].a * WEIGHTS[name].v(effectiveReps);
    total += fn(w, effectiveReps) * wt;
    wsum += wt;
  }
  const rirWt = WEIGHTS.rir.a * WEIGHTS.rir.v(effectiveReps);
  total += rirEstimate(w, effectiveReps) * rirWt;
  wsum += rirWt;
  return total / wsum;
}


export function estimate1RM(w, r, formula = DEFAULT_FORMULA, rir = null) {
  const weight = Number(w);
  const reps = Number(r);
  if (!isFinite(weight) || !isFinite(reps)) return null;
  if (weight <= 0 || reps < 1) return null;

  const validRir = rir != null && Number(rir) >= 0;

  if (reps === 1 && (!validRir || Number(rir) === 0)) {
    return Math.round(weight * 10) / 10;
  }

  if (formula === 'weighted') {
    const effectiveReps = validRir ? reps + Number(rir) : reps;
    if (effectiveReps > WEIGHTED_REP_CAP) return null;
    const est = weightedEstimate(weight, effectiveReps);
    if (!isFinite(est) || est <= 0) return null;
    return Math.round(est * 10) / 10;
  }

  if (reps > REP_CAP) return null;
  const fn = FORMULAS[formula] || FORMULAS[DEFAULT_FORMULA];
  const est = reps === 1 ? weight : fn(weight, Math.round(reps));
  if (!isFinite(est) || est <= 0) return null;
  return Math.round(est * 10) / 10;
}
