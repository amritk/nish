// NL3037: an exported function of the program's own package named after a C
// library function the runtime calls. Its name is its symbol, so the runtime's
// `exit` would call it; it is refused rather than renamed, because an exported
// name is the program's ABI.
export const exit = (code: i32): i32 => code;

export const main = (): i32 => exit(0);
