// WP66: the shape `nish c-import` writes, used where it was written. Each
// declaration is exported, so main.ts imports the module rather than copying
// its declarations.
export declare class TallyOut {
  value: i64
}
export declare class tally {}
export declare function tally_new(start: i32): tally | null
export declare function tally_add(t: tally, k: i64): void
export declare function tally_get(t: tally, out: TallyOut): i32
export declare function tally_free(t: tally): void
