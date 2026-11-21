// A library module (no `main` entry point, as for a wasm or N-API build)
// has no entry wrapper to build process.argv from argc/argv.
export const count = (): number => {
  return process.argv.length;
};
