// The `break` counterpart of #181 in a `for`, on a string, with the `break`
// under an `if`. The condition sets `k = s.length` on every pass; the first
// pass sets `k = 100` and leaves, so the loop after it runs `i` past the end of
// `s`. Run by tests/run.js: exit 1 with "index out of range: 3 >= 3" on stderr.
export const main = (): number => {
  const s = "abc";
  let k = 0;
  let n = 0;
  for (; (k = s.length) > 0 && n < 10; n = n + 1) {
    if (n === 0) {
      k = 100;
      break;
    }
  }
  let t = 0;
  for (let i = 0; i < k; i = i + 1) {
    t = t + s.charCodeAt(i);
  }
  console.log(`${t}`);
  return 0;
};
