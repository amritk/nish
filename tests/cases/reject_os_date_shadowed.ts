// WP34 N3: a local named `Date` shadows the global, so calling it is an
// unknown function like any other value called, not the `Date` rule.
export const test = (): number => {
  const Date = 5;
  const t = Date();
  return t;
};
