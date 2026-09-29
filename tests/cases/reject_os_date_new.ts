// WP34 N3: there is no `Date` object, so `new Date()` is refused by the rule.
export const test = (): number => {
  const d = new Date();
  return 0;
};
