// WP34 N3: `crypto` itself is not a value.
export const test = (): number => {
  const c = crypto;
  return 0;
};
