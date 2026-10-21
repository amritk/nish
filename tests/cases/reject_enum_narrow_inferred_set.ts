// `const j = k` where `k` is narrowed to `Kind.B | Kind.C` would infer that
// union in TypeScript, a type Nish does not have, so it is annotated (NL2530).
// tsc would accept this one: Nish is stricter here, as docs/LANGUAGE.md says.
enum Kind {
  A,
  B,
  C,
}

const pick = (n: i32): Kind => (n === 0 ? Kind.A : n === 1 ? Kind.B : Kind.C);

const f = (k: Kind): i32 => {
  if (k !== Kind.A) {
    const j = k;
    return j === Kind.B ? 1 : 0;
  }
  return 0;
};

export const main = (): void => {
  console.log(f(pick(1)));
};
