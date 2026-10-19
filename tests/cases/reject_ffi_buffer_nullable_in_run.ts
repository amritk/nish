// A nullable buffer after a buffer is refused for its null, not read as the
// run's count: the refusal is the nullable buffer's, and the `u64` after it
// still closes the run.
declare function compare(a: readonly u8[], b: readonly u8[] | null, n: u64): i32;

export const main = (): i32 => 0;
