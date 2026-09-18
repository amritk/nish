// WP22 §8a's bug class, aimed at the passes the class's first two bugs were
// not in. Each of these is a concise body sitting in a position some pass
// decides by looking at the parent node: `null` takes its type from the
// context (`checker/nullable.ts`), `process.argv` is read-only and the
// construct that consumes it decides whether it was mutated
// (`checker/io.ts`), a `Result` a function hands back is inspected by its
// caller rather than by it (`checker/result.ts`), and an element or a field
// read through a parameter is a read rather than a capture
// (`codegen/attributes.ts`). The block-bodied twin of each compiled before
// arrows existed; the golden is the claim that the concise one is the same.
interface Node {
  value: i32;
}

const nothing = (): Node | null => null;

const args = (): string[] => process.argv;

const firstArg = (): string => process.argv[0];

const half = (n: i32): Result<i32, string> => (n % 2 !== 0 ? Err("odd") : Ok(n / 2));

const field = (n: Node): i32 => n.value;

const element = (xs: i32[]): i32 => xs[0];

export const main = (): number => {
  const maybe = nothing();
  console.log(maybe === null ? "null" : "node");
  console.log(`${args().length > 0}`);
  console.log(`${firstArg().length > 0}`);
  const r = half(8);
  console.log(`${r.unwrapOr(-1)}`);
  const n: Node = { value: 4 };
  console.log(`${field(n)} ${element([7, 8])}`);
  return 0;
};
