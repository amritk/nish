// WP28 C1, `nullish`: a `??` on a value narrowed past `null`. Strict refuses
// it, as a default with nothing to replace; Node's answer is the left
// operand, and so is the build's.
const size = (p: string | null): number => {
  if (p !== null) {
    return (p ?? "fallback").length;
  }
  return 0;
};

export const main = (): void => {
  console.log(`${size("abc")} ${size(null)}`);
};
