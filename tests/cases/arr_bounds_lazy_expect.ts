// #182 for `expect`: the message is evaluated on the `Err` path only
// (`emitExpect`), and that path exits. Here `r` is `Ok`, so the assignment in
// the message never runs and `k` stays 100; the walk used to record
// `k <= s.length` from it, and `i < k` then proved `s.charCodeAt(50)` on a
// three-byte string. Run by tests/run.js: exit 1 with
// "index out of range: 50 >= 3" on stderr.
const parse = (n: i32): Result<i32, string> => (n < 0 ? Err("negative") : Ok(n));

export const main = (): number => {
  const s = "abc";
  let k = 100;
  const r = parse(1);
  const v = r.expect(`no value, ${(k = s.length)} bytes`);
  const i = 50;
  let c = -1;
  if (i >= 0 && i < k) {
    c = s.charCodeAt(i);
  }
  console.log(`${v} ${c}`);
  return 0;
};
