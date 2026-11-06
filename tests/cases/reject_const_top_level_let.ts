// Beside a declared `main` only `const` is available at the top level; `let`
// would need code to run (an entry without `main` runs it as `main`).
let x = 1;

export const main = (): void => {}
