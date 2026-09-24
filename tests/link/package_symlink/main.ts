// WP21 S3: a package reached through a **symlink** is one package, as it is to
// Node's resolver (`docs/wp21-packages.md` §10d, #198).
//
// The layout is the one pnpm produces and npm produces when it cannot hoist:
// `node_modules/shared` and `node_modules/app2/node_modules/shared`, the second
// a symlink to the first. A package's identity is its real directory, so both
// paths are one package and its one module loads once: `val` is defined once,
// and `app2` calls the same function the program does. Until the identity was
// the real path this was two copies of `shared`, refused as a clash on `val`.
import { val } from "shared";
import { twice } from "app2";

export const main = (): number => {
  write(`${val() + twice()}\n`);
  return 0;
};
