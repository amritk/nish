// A dump flag does not turn a refused program into a compiling one: `--emit-ast`
// prints the tree of a program Phase 0 accepts, and prints nothing at all for
// one it does not. stage1 used to dump the tree and exit 0 here while stage0
// refused (WP19 §A3), which is a difference only `--parity` could see, because
// no oracle asks what a dump flag does to a program that fails to validate.
export function main(): number {
  const x: any = 1;
  return x;
}
