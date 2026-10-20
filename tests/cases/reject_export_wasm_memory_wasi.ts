// #643: the `wasi` command module exports only `memory` and `_start`, so an
// exported `memory` does not collide there today; the name is reserved across
// every wasm build anyway, so a program that builds for wasi also builds as the
// freestanding module `build.sh --profile wasm` links with `--export-all`.
export function memory(n: i32): i32 {
  return n + 1;
}

export const main = (): i32 => memory(41);
