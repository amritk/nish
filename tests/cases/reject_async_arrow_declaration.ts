// A module-level `const` bound to an `async` arrow declares an `async`
// function, which Phase 0 refuses as it does the `function` spelling (NL1015).
export const main = async (): i32 => 0
