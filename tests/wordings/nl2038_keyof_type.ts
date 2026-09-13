// NL2038: a type operator with no rule of its own gets the generic "unsupported
// type" sentence, which is the one that lists the set Phase 1 does have.
interface Point {
  x: i32;
}

export const main = (): i32 => {
  const k: keyof Point = 1;
  return 0;
};
