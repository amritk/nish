// #618: `abs` is not libm's, but LLVM's TargetLibraryInfo knows it by name and
// folds `abs(-3)` to 3 whatever the definition, and an exported `abs` is the
// external definition the C library's own references bind to. The checker
// refuses it like any other name reserved to C.
export const abs = (x: i32): i32 => x * 2;

export const main = (): i32 => abs(-3);
