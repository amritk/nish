// WP33 R2: a ternary carries the spelling when either branch does: `c ? xs : t`
// is `number[] | Float64Array` to TypeScript, which has no `pop` either.
export const test = (c: boolean): number => {
  const t = new Float64Array(2);
  const u = new Float64Array(2);
  const xs: f64[] = [];
  (c ? t : u).push(1.0);
  (c ? xs : t).pop();
  return xs.length;
};
