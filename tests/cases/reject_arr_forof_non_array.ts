// The strict dialect walks arrays only: `for...of` over a string is refused,
// naming the `for-of-string` feature; `--compat` admits it, one code point
// per pass (tests/compat-erasure.js).
const f = (s: string): void => {
  for (const c of s) { console.log(c); }
};

export const main = (): void => { f("aé😀"); };
