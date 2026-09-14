// WP21 S2: a package reached through a **symlink** is a second package, and
// this case is here to say so out loud rather than to approve of it
// (`docs/wp21-packages.md` §10d).
//
// The layout is the one pnpm produces and npm produces when it cannot hoist:
// `node_modules/shared` and `node_modules/app2/node_modules/shared`, the second
// a symlink to the first. Node's resolver calls `realpath` on what it finds, so
// both paths are one module there. Neither compiler can: a module's identity is
// its path, and resolving a symlink needs a `realpath` the language does not
// have — which is what makes this a *declared* limitation instead of a fix. The
// two paths therefore become two copies of package `shared`, and the WP21 S1
// clash check refuses them, naming the file it found the name in first.
//
// So the expectation here is a refusal, and the point of the case is that
// **both compilers refuse it with the same sentence**, which `tests/run.js`
// asks of each of them by name. The entry sits in `app/` rather than at the top
// of the fixture on purpose: the link section's loop discovers a case by its
// `main.ts`, and a tree whose whole point is a symlink belongs to the two
// checks written for it rather than to every oracle that walks the corpus. The
// day the limitation is closed, those checks fail and this fixture is deleted
// rather than edited.
import { val } from "shared";
import { twice } from "app2";

export const main = (): i32 => val() + twice();
