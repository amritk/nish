// #643: the `wasi` profile links a wasm module too, whose linear memory is its
// `memory` export, so an exported `memory` is refused there as on a wasm
// `--target`.
export function memory(n: i32): i32 {
  return n + 1;
}

export const main = (): i32 => memory(41);
