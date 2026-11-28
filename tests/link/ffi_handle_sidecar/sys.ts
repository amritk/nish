// WP89 S5a: the binding module: an opaque C cell, the functions that open,
// read and release it, and the C probe that calls back into `stack.ts`.
export declare class Cell {}
export declare function cell_open(n: i32): Cell | null
export declare function cell_read(c: Cell): i32
export declare function cell_close(c: Cell): void
export declare function probe(n: i32): i32
