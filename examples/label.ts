/**
 * A wasm export that builds a string: a template with an integer and the
 * shortest form of a float. The page receives a JavaScript string. Built in
 * the wasm-size check as the string row (docs/wp50-wasm-host.md §7).
 */
export const label = (n: i32, kg: f64): string => `#${n} weighs ${kg} kg`
