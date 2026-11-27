// WP89 S3b: one module holds a C library's binding and exports it, the way
// `std/gpu/sys.ts` is the one generated binding the other `std/gpu` modules
// import. `Counter` is opaque (no members, no heritage clause), so every
// importer holds it as the C pointer it is.
export declare class Counter {}
export declare function counter_new(start: i32): Counter | null
export declare function counter_bump(c: Counter, by: i32): i32
export declare function counter_free(c: Counter): void
