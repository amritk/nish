/**
 * The standard library, as the resolver sees it: where it lives and what is
 * in it.
 *
 * This is the counterpart of `checker/nish-modules.ts` and the contrast is the
 * point. A `nish:` module is a builtin — no file, no code, nothing linked. A
 * `nish/` module is ordinary Nish source that ships beside the compiler and is
 * compiled into whatever imports it, so all this module has to answer is a
 * directory and a listing; everything after that is the ordinary module path.
 */
import fs from "node:fs";
import path from "node:path";
import { PKG_ROOT } from "./version.js";

/** The directory the library lives in, relative to the package root. */
export const STD_DIR = "std";

/**
 * The modules the installed library has, without their extension and in a
 * fixed order, for the diagnostic that lists them. Read rather than written
 * down: a list in the source would be one more thing to forget beside the file
 * it names, and the two goldens that pin the wording would then pass while the
 * message was wrong. An unreadable directory answers nothing rather than
 * failing — the caller is already reporting an error when it asks.
 */
export const stdModuleNames = (): string[] => {
  try {
    return fs
      .readdirSync(path.join(PKG_ROOT, STD_DIR))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
};
