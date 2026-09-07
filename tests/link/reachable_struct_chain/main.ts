import { Branch } from "./mid";

// `Leaf` reaches this module through two hops: `Branch.tip()` returns it, and
// `mid.ts` only knows it because it imports `leaf.ts`. The closure therefore
// cannot be a per-module step taken while imports are still being bound — the
// answer would depend on the order the modules happened to be bound in.
export function main(): number {
  const branch = new Branch(21);
  const tip = branch.tip();
  console.log(tip.doubled());
  return tip.value - 21;
}
