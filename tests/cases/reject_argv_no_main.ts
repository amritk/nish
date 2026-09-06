// A library module (no `export function main`, as for a wasm or N-API build)
// has no entry wrapper to build process.argv from argc/argv.
export function count(): number {
  return process.argv.length;
}
