// Imported by tests/link/module_private_outside/main.ts from outside its
// directory; this directory has no main.ts, so it is no program of its own.
const helper = (n: number): number => {
  return n * 2;
};

export const fromShared = (n: number): number => {
  return helper(n);
};
