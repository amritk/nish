// A task may wipe a `Secret` it makes from a fresh value, but not a `Secret`
// a call answers (`const k = make(n)`), even one the callee made from a fresh
// array: the rule does not follow freshness across a return, so the `Secret`
// may be anyone's memory. This pins the `Secret`-valued call result;
// `reject_thread_wipe_secret_call_result` pins `secret(<call result>)`.
import { Secret, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";
const make = (n: i32): Secret<u8[]> => {
  const k = secret(new Array<u8>(n));
  return k;
};
const clear = (n: i32): i32 => {
  const k = make(n);
  wipe(k);
  return 0;
};
export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(clear, 4, out, 0);
  }
  return out[0];
};
