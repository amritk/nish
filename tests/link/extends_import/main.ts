import { Derived } from "./lib";

// Only the derived class is imported: `new Derived(4)` runs the inherited
// `Base.constructor` and `d.twice()` is `Base.twice`, both reached through a
// `%struct.Base*` this module only declares opaque.
export function main(): number {
  const d = new Derived(4);
  console.log(d.twice());
  console.log(d.total());
  return d.id - 4;
}
