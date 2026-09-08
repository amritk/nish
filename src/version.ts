/**
 * Package version for `amritc --version`.
 *
 * Read from package.json at runtime rather than baked in at build time: the
 * file always ships in the npm tarball (npm includes it unconditionally), it
 * sits one level above `dist/`, and this way `npm version` bumps are picked
 * up without a generated file that could go stale.
 */
import fs from "node:fs";
import path from "node:path";

/** Package root: dist/version.js -> .. (the same for src/version.ts under ts-node). */
export const PKG_ROOT = path.resolve(__dirname, "..");

export function packageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, "package.json"), "utf8")) as { version?: unknown };
    if (typeof pkg.version === "string") return pkg.version;
  } catch {
    // fall through: a broken install still gets a usable answer
  }
  return "0.0.0-unknown";
}
