// A library entry has no `main`, and every export a host can call is judged:
// `stamp` reaches `clock`, which `--deny clock` refuses (NL2459).
export const stamp = (): f64 => Date.now();

export const twice = (n: i32): i32 => n * 2;
