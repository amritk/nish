// NL4007: an exported generic with no instantiation has no symbol, so a
// sidecar flag refuses it rather than describe an ABI without it.
export const identity = <T>(x: T): T => x;
