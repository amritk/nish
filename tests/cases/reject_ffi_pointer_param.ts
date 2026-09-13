// A function this program defines cannot take a `CPtr`: `--emit-header`,
// `--emit-dts` and `--emit-napi` all render an exported signature and none of
// them has a spelling for an address whose provenance and lifetime are unknown.
const close = (open: CPtr): i32 => 0;

export const main = (): i32 => 0;
