// The exporter of the functions and of the function type `main.ts` stores:
// `apply` calls a reference that a reference of another module made.
export type Op = (x: i32) => i32;

export const inc = (x: i32): i32 => x + 1;

export const triple = (x: i32): i32 => x * 3;

export const apply = (op: Op, x: i32): i32 => op(x);

export const pick = (big: boolean): Op => (big ? triple : inc);
