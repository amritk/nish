// NL8002: a `slice` bound nothing proves inside the string, which panics here
// where TypeScript clamps it.
export const main = (): number => {
  const s = "abcdef";
  const at = s.length + 1;
  console.log(s.slice(0, at));
  return 0;
};
