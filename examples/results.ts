// A by-value Result crossing into wasm. `nish examples/results.ts --target wasm32
// --emit-dts results.d.ts` writes a loader that packs `{ ok, value }` / `{ ok, error }`
// into one i64; this program has no module storage, so its loader is the plain one.

/** 1 for an `ok` Result, 2 for an `err` one. */
export const f = (r: Result<i32, i32>): i32 => (r.ok ? 1 : 2)

/** Seven. */
export const g = (): i32 => 7
