// `for await` in a generic function nothing instantiates. A template's body is
// checked once per instantiation, so a rule stated while checking bodies would
// never see this loop; NL2133 is a sweep over the whole module in pass 1.
const each = <T>(xs: T[]): i32 => {
  for await (const x of xs) {
    return 1;
  }
  return 0;
};

export const main = (): i32 => 0;
