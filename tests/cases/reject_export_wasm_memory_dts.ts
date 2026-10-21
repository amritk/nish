// #643: an `--emit-dts` compile writes IR for the host, but the loader beside
// it is for the module `scripts/build.sh --profile wasm` links that IR into,
// whose linear memory is its `memory` export, so an exported `memory` is
// refused there too.
export const memory = (n: i32): i32 => n + 1;
