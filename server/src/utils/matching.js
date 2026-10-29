/**
 * Explainable, deterministic similarity between a lost and a found report.
 * Pure functions (no database) so they can be unit tested.
 */
export function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((x) => x.length > 2)
  );
}

export function scoreMatch(a, b) {
  let score = 0;
  const reasons = [];

  if (a.category === b.category) {
    score += 30;
    reasons.push('Same category');
  }

  const aa = tokens(`${a.title} ${a.description}`);
  const bb = tokens(`${b.title} ${b.description}`);
  const common = [...aa].filter((x) => bb.has(x));
  const union = new Set([...aa, ...bb]).size;
  const similarity = union ? common.length / union : 0;
  score += Math.round(similarity * 40);
  if (common.length) reasons.push(`Shared clues: ${common.slice(0, 4).join(', ')}`);

  const la = String(a.location || '').trim().toLowerCase();
  const lb = String(b.location || '').trim().toLowerCase();
  if (la && la === lb) {
    score += 20;
    reasons.push('Same reported location');
  } else if (la && lb && la.split(/\W+/).some((w) => w.length > 3 && lb.includes(w))) {
    score += 10;
    reasons.push('Similar location wording');
  }

  const days = Math.abs(new Date(a.date) - new Date(b.date)) / 86400000;
  if (days <= 1) {
    score += 10;
    reasons.push('Dates are within one day');
  } else if (days <= 7) {
    score += 5;
    reasons.push('Dates are within one week');
  }

  return { score: Math.min(score, 100), reasons };
}
