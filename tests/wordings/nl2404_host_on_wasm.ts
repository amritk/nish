// NL2404: the host builtins reach the operating system, which a wasm32 build does not have.
export const now = (): f64 => Date.now();
