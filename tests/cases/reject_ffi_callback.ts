// C never calls back into Nish: an arrow in value position is no function
// reference, so it cannot be handed to a declared C function, and a `CPtr`
// parameter does not make one into an address.
declare function atexit(f: CPtr): i32;

export const main = (): i32 => atexit((): void => {});
