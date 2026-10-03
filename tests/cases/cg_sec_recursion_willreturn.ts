// `willreturn` was inferred through recursion: a function on a call-graph
// cycle kept it, because only a callee that had already lost the fact could
// clear it. `spin` calling itself with the same argument was
// `willreturn readnone`, `opt -O2` deleted the call, and a program that should
// hang returned. Mutual recursion did the same. A function on a cycle, and
// every caller of one, is no longer `willreturn`; `fib` below is recursion
// that terminates and loses it too, because termination is not proved
// (docs/security/codegen.md, CG-4). `cg_sec_recursion_willreturn.c` runs each
// hang in a child with an alarm, so the signal is the answer.
const spin = (x: i32): i32 => spin(x);

const ping = (x: i32): i32 => pong(x);

const pong = (x: i32): i32 => ping(x);

const fib = (n: i32): i32 => (n < 2 ? n : fib(n - 1) + fib(n - 2));

export const selfCall = (): i32 => {
  spin(parseInt("1"));
  return 7;
};

export const mutualCall = (): i32 => {
  ping(parseInt("1"));
  return 7;
};

export const test = (): i32 => fib(parseInt("10"));
