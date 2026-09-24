// A workspace link: `node_modules/foo` is a link to `packages/foo`, a
// directory outside any `node_modules`, the layout npm, pnpm and yarn
// workspaces produce. A package is its real directory, so `foo` is named by
// `packages/foo`, and its own relative import of `./helper` is in package
// `foo` too — found under that real directory — rather than in the program's
// root package. So `foo`'s `helper` and the program's own `helper` are two
// symbols in two packages, `@foo.helper` and `@helper`, and do not clash.
import { foo } from "foo";
import { helper } from "./helper";

export const main = (): number => {
  write(`${foo() + helper()}\n`);
  return 0;
};
