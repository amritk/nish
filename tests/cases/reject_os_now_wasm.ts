// WP34 N3: runtime-host.c is empty on wasm, so the host builtins are refused there.
export const now = (): f64 => Date.now();
