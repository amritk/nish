// The bound `join` puts on its result: once the lengths are summed, a total
// past 2^31 - 1 bytes asks the allocator for 2^62 bytes instead of the total,
// which fails as an allocation does (`nish: out of memory`, exit 1), so the
// result's `length` can never read back negative under `--number-mode i32`.
// A total that fits is allocated as it was. tests/link/cg_sec_join_limit runs
// the refusal. docs/security/codegen.md, CG-3.
const joined = (parts: string[], sep: string): string => parts.join(sep);

export const test = (): number => joined(["ab", "c", "def"], "--").length;
