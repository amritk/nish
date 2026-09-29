// WP34 N3: `Date.now()` takes no argument.
export const test = (): number => {
  const t = Date.now(0);
  return 0;
};
