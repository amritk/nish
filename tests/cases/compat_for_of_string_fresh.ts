// WP28 C1, `for-of-string`: each code point is a fresh string, so it outlives
// the pass that made it. `last` keeps a code point from an inner walk after
// the outer loop's pass, which allocates, has ended; `first` returns one to a
// caller that allocates again before it reads the answer. Both must still
// print the code point, as they do in Node.
const lastOf = (s: string, n: number): string => {
  let last = "";
  for (let i = 0; i < n; i++) {
    const _t = `pass ${i} of ${n}`;
    for (const c of s) {
      last = c;
    }
  }
  return last;
};

const first = (s: string): string => {
  for (const c of s) {
    return c;
  }
  return "";
};

export const main = (): void => {
  const kept = lastOf("aé😀", 3);
  const pad = first("pp") + first("dd");
  console.log(kept);
  console.log(pad);
  const heads: string[] = [];
  for (let i = 0; i < 3; i++) {
    const head = first("€x");
    const _u = `round ${i}`;
    heads.push(head);
  }
  console.log(heads.join(""));
  console.log(first("") + "|" + first("z"));
};
