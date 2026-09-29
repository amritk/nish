// WP34 N3: a string is not bytes to fill.
export const test = (): number => {
  crypto.getRandomValues("abcd");
  return 0;
};
