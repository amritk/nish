// `import.meta` names the running module's own object (its URL, a resolver),
// and a module has no runtime object: paths are resolved at compile time. The
// meta-property is read wherever an operand stands and refused once, at its
// first use in source order. A member access, a deeper one or a call after it
// costs nothing more, so the one diagnostic here is the top-level constant's.
const here = import.meta.url;

import.meta;

export const main = (): i32 => {
  const meta = import.meta;
  const url: string = import.meta.url;
  const mode = import.meta.env.MODE;
  const lib = import.meta.resolve("./lib");
  return 0;
};
