// WP34 N3: `Date.UTC` is refused, like every `Date` member but `now`.
export const test = (): number => {
  const t = Date.UTC(2026, 8, 29);
  return 0;
};
