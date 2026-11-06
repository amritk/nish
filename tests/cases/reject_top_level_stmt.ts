// Beside a declared `main` a module has no top-level code (an entry without
// one runs it as `main`, docs/LANGUAGE.md → "Top-level code"), so an
// expression statement has nowhere to run.
console.log("hi");

export const main = (): void => {}
