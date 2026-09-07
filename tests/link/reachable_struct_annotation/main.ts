import { Registry } from "./lib";

// The layout of `Entry` reaches this module through `Registry.head()`, but the
// *name* does not: writing it as a type still needs an `import { Entry }`.
export function main(): number {
  const registry = new Registry();
  const head: Entry = registry.head();
  return head.count;
}
