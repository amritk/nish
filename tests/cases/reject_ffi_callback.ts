// C never calls back into Nish: a function is never a value, so an arrow
// cannot be handed to a declared C function, and a `CPtr` parameter does not
// make one into an address.
declare function atexit(f: CPtr): i32;

export const main = (): i32 => atexit((): void => {});
