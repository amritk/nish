// WP34 N3: `Date.now` is a builtin, not a function value.
export const test = (): number => {
  const clock = Date.now;
  return 0;
};
