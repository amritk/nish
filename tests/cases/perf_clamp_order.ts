// WP15 §2/§8: a `substring` bound's clamp may only be folded on facts that
// hold where the *emitter* evaluates that bound. `emitSubstring` clamps
// argument 0 before argument 1 is evaluated, so nothing argument 1 does may
// reach back and prove argument 0. Judging both ends against the state the
// whole argument list left behind folded the clamp on a negative bound, read
// three bytes before the string body, and segfaulted once the offset was
// large enough -- with both compilers agreeing, so no oracle could see it.
function width(): number {
  return 6;
}

export const main = (): number => {
  const s = "hello world";

  // The reported shape: the assignment in argument 1 records `k <= s.length`,
  // and that fact must not reach the `k` the emitter has already read.
  let k = -3;
  const a = s.substring(k, (k = s.length));
  console.log(`a [${a}] ${a.length}`);

  // The same assignment one level down, in both arms of a conditional, where
  // the merge keeps it -- so reaching the call is not the same as being
  // written at the top of the argument.
  let m = -4;
  const pick = true;
  const b = s.substring(m, pick ? (m = s.length) : (m = s.length));
  console.log(`b [${b}] ${b.length}`);

  // The other direction: a call in argument 1 takes nothing away from a bound
  // argument 0 already proved. A callee cannot reach a caller's local and a
  // string's length is fixed at construction, so `n` is still in range and its
  // clamp is still folded -- the golden is what says so.
  const n = s.length;
  const c = s.substring(n, width());
  console.log(`c [${c}] ${c.length}`);

  // A literal `0` needs no facts at all, so it folds whatever argument 1 does.
  let j = -1;
  const d = s.substring(0, (j = s.length) - 6);
  console.log(`d [${d}] ${d.length} ${j}`);
  return 0;
};
