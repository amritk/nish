// NL2363: returning `m.get(k)` is not one of the places the fix covers — the
// caller may be the one that wants to know the key was missing.
const lookup = (counts: Map<string, i32>): i32 => counts.get("a")
export const test = (): number => lookup(new Map<string, i32>())
