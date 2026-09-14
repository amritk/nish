// WP21 S2: an ordinary npm package, imported by name. It resolves — the
// directory is there and its `package.json` is read — and it offers no `nish`
// condition, so it has no Nish entry point.
//
// That is the message `docs/wp21-packages.md` §6 asks for by name: the failure
// a reader meets when they reach for a JavaScript package should say what is
// missing, not read like a module-not-found for a file they mistyped. The
// package below declares `import` and `require` the way a published one does.
import { chunk } from "plainjs";

export const main = (): i32 => chunk(1);
