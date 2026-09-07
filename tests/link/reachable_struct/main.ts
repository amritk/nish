import { Registry } from "./lib";

// `Entry` is never imported: every mention of it here is inferred from
// `Registry`'s own signatures. The layout must still be in this module (the
// field reads are `getelementptr`s into `%struct.Entry`) and so must the
// symbols (`@Entry.label` is defined in lib.ts).
export function main(): number {
  const registry = new Registry();
  registry.add("a", 1);
  registry.add("b", 2);
  let total = 0;
  for (const entry of registry.all()) {
    console.log(entry.label());
    total = total + entry.count;
  }
  const head = registry.first();
  if (head !== null) {
    console.log(head.key);
    total = total + head.count;
  }
  return total - 4;
}
