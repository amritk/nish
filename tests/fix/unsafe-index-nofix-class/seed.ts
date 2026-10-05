// A second root with an error that has a fix of its own. The runner wants a
// plain run that exits 1, and a program whose only diagnostics are warnings
// exits 0; `--fix` applies this fix in its first round, then the warnings'.
export const seed = (x: i32): boolean => x == 0
