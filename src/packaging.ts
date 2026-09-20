/**
 * Which prebuilt binary this machine wants, and what the package holding it is
 * called.
 *
 * `npm install -g @amritk/nish` is meant to be a download, not a build: the
 * native compiler is already built, verified and smoke-tested per platform by
 * `release.yml`, and it reaches a user as an `optionalDependencies` entry that
 * npm installs only where `os` and `cpu` match — the esbuild pattern. This
 * module is the one place the three spellings of a platform are converted
 * between, so the launcher, the package generator and the tests cannot drift:
 *
 *   node          `process.platform` / `process.arch`      darwin / arm64
 *   this project  the `asset` in .github/seed-targets.json  aarch64-darwin
 *   npm           `os` / `cpu` in a package.json            darwin / arm64
 *
 * The middle one is the odd spelling and it is not this module's to change:
 * `asset` is the target triple with the vendor and the ABI dropped, which is
 * what the release assets, the seed protocol and `bootstrap.sh` already call a
 * platform. So the rule is a translation between node's two-word name and that
 * one, and `tests/run.js` checks it against `seed-targets.json` rather than
 * trusting the two lists to stay equal.
 */

/**
 * The architecture half of an `asset`, keyed by node's `process.arch`.
 *
 * Only the architectures a release actually attaches are here. An arch that is
 * missing is not an error — it means no prebuilt binary exists for this
 * machine, which the launcher answers by running the Node compiler instead.
 */
const ARCH_BY_CPU: Record<string, string> = {
  x64: "x86_64",
  arm64: "aarch64",
};

/**
 * The operating-system half. It is an identity map today, because node's
 * `linux` and `darwin` are already what the triple calls them, and it exists
 * so that the one platform where that stops being true — a `win32` whose
 * triple says `windows` — is a line here rather than a special case at the
 * call site.
 */
const OS_BY_PLATFORM: Record<string, string> = {
  linux: "linux",
  darwin: "darwin",
};

/** One supported target, in all three spellings. */
export type PlatformTarget = {
  /** `.github/seed-targets.json`'s name for it: `aarch64-darwin`. */
  asset: string;
  /** npm's `os` field, which is node's `process.platform`. */
  os: string;
  /** npm's `cpu` field, which is node's `process.arch`. */
  cpu: string;
};

/**
 * The `asset` for a node platform/arch pair, or `null` when this project
 * attaches no binary for it.
 *
 * `null` is a supported answer rather than a failure: Alpine on musl, a
 * FreeBSD, a linux/riscv64 all land here, and each of them has a working
 * compiler available in the same package — just not a native one.
 */
export const assetFor = (platform: string, arch: string): string | null => {
  const os = OS_BY_PLATFORM[platform];
  const cpu = ARCH_BY_CPU[arch];
  if (os === undefined || cpu === undefined) return null;
  return `${cpu}-${os}`;
};

/** The inverse, for the generator and the tests: an `asset` back to npm's pair. */
export const targetForAsset = (asset: string): PlatformTarget | null => {
  const dash = asset.indexOf("-");
  if (dash < 0) return null;
  const arch = asset.slice(0, dash);
  const os = asset.slice(dash + 1);
  const cpu = Object.keys(ARCH_BY_CPU).find((key) => ARCH_BY_CPU[key] === arch);
  const platform = Object.keys(OS_BY_PLATFORM).find((key) => OS_BY_PLATFORM[key] === os);
  if (cpu === undefined || platform === undefined) return null;
  return { asset, os: platform, cpu };
};

/**
 * The package holding the binary for one asset, derived from the main
 * package's own name: `@amritk/nish` + `x86_64-linux` -> `@amritk/nish-x86_64-linux`.
 *
 * Derived rather than written out so that the scope is spelled once. The
 * registry name was settled late (`nish` belongs to somebody else, so this one
 * is scoped — docs/wp12-release.md "The npm name"), and a list of five literal
 * names would be five places to edit if it ever moves again.
 */
export const platformPackageName = (packageName: string, asset: string): string => `${packageName}-${asset}`;
