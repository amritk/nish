// The answering twin is refused on wasm32 for the same reason: no entropy source.
export const fill = (b: u8[]): boolean => crypto.tryGetRandomValues(b);
