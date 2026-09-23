// The `break` counterpart of #181 in a `while`, on a string. The condition
// sets `k = s.length`, the body sets `k = 100` and leaves by `break`, so
// `i < k` after the loop says nothing about `s`. Run by tests/run.js: exit 1
// with "index out of range: 50 >= 3" on stderr.
export const main = (): number => {
  const s = "abc";
  let k = 0;
  while ((k = s.length) > 0) {
    k = 100;
    break;
  }
  const i = 50;
  if (i >= 0 && i < k) {
    console.log(`${s.charCodeAt(i)}`);
  }
  return 0;
};
