// NL2302 once per list: `<T, T, T>` is refused on the second `T` alone, the
// first duplicate in source order. The third is the same mistake again, and
// the sweep reports one diagnostic per declaration; `tests/run.js` pins the
// count and the column through `--json`.
const first = <T, T, T>(a: T, b: T, c: T): T => a;

export const main = (): i32 => first(1, 2, 3);
