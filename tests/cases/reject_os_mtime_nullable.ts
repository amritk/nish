// WP34 N3: a missing file is NaN, not null, because an f64 has no null.
export const test = (): number => {
  const m: f64 | null = statMtimeSync("x");
  return 0;
};
