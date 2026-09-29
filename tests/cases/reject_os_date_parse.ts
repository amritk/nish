// WP34 N3: `Date.parse` needs a calendar and a time zone, so it is refused.
export const test = (): number => {
  const t = Date.parse("2026-09-29");
  return 0;
};
