// A function on a call-graph cycle is never inferred `willreturn`: nothing
// proves the recursion ends, and LangRef's `willreturn` promises the call
// returns. `spin` calls itself with the same `x` and `ping` and `pong` call
// each other the same way, so neither ends; with `willreturn readnone` on
// them `opt -O2` deleted the unused calls and `selfSpin` and `mutualSpin`
// returned. `cg_sec_recursion_willreturn.c` runs each in a child process and
// prints whether it came back. `countdown` does end, and still loses the
// attribute: no proof of termination is attempted for recursion.
// docs/security/codegen.md, CG-4.
const spin = (x: i32): i32 => spin(x) * 3 + x;

const ping = (x: i32): i32 => pong(x) * 3 + x;

const pong = (x: i32): i32 => ping(x) * 5 + x;

const countdown = (n: i32): i32 => (n <= 0 ? 0 : countdown(n - 1) + 1);

export const selfSpin = (): i32 => {
  spin(parseInt("1"));
  return 1;
};

export const mutualSpin = (): i32 => {
  ping(parseInt("1"));
  return 2;
};

export const test = (): number => countdown(parseInt("10"));
