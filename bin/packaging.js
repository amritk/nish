/**
 * Which prebuilt binary this machine wants, and what the package holding it is
 * called.
 *
 * `npm install -g @amritk/nish` is a download, not a build: the native
 * compiler is already built, verified and smoke-tested per platform by
 * `release.yml`, and it reaches a user as an `optionalDependencies` entry that
 * npm installs only where `os` and `cpu` match -- the esbuild pattern. This
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
 *
 * **This is plain JavaScript under `bin/`, and that is deliberate.** It used
 * to be `src/packaging.ts`, compiled into `dist/` by `tsc` -- which made the
 * command a build artifact of the compiler it is supposed to install. `bin/`
 * is what the tarball carries and what `bin.nish` points into, so the launcher
 * and its platform table now live where they ship, need no build step, and
 * survive the deletion of `src/` (`docs/wp19-stage0-retirement.md` R6). The
 * types they lose are not much of a loss for two string maps; what they gain is
 * that `npm pack` ships the same bytes this repository runs.
 */

/**
 * The architecture half of an `asset`, keyed by node's `process.arch`.
 *
 * Only the architectures a release actually attaches are here. An arch that is
 * missing is not an error -- it means no prebuilt binary exists for this
 * machine, which the launcher answers by saying so and stopping.
 */
const ARCH_BY_CPU = {
  x64: "x86_64",
  arm64: "aarch64",
};

/**
 * The operating-system half. It is an identity map today, because node's
 * `linux` and `darwin` are already what the triple calls them, and it exists
 * so that the one platform where that stops being true -- a `win32` whose
 * triple says `windows` -- is a line here rather than a special case at the
 * call site.
 */
const OS_BY_PLATFORM = {
  linux: "linux",
  darwin: "darwin",
};

/**
 * Every asset a release actually attaches, sorted, in `seed-targets.json`'s
 * spelling. This is the list the refusal *prints*.
 *
 * **A literal list rather than the cross product of the two maps above**, which
 * is what it was first written as and which is wrong in a way that only shows up
 * later: the maps multiply out to this list only because the support matrix
 * happens to be full. Add `riscv64: "riscv64"` for linux alone -- one platform,
 * not four -- and a cross product advertises `riscv64-darwin` to a user, and
 * fails the check that compares this against `.github/seed-targets.json` for a
 * launcher that was behaving correctly. The authority is that file; `tests/run.js`
 * compares the two, so a literal is exactly as gated as a derivation and says
 * only what is true.
 */
export const SUPPORTED_ASSETS = ["aarch64-darwin", "aarch64-linux", "x86_64-darwin", "x86_64-linux"];

/**
 * The `asset` for a node platform/arch pair, or `null` when this project
 * attaches no binary for it.
 *
 * `null` is a supported answer rather than a crash: Alpine on musl, a FreeBSD,
 * a linux/riscv64 all land here. What it is no longer is a *quiet* answer --
 * there is no compiler in the package to fall back to since 0.6.0, so the
 * launcher turns this `null` into a diagnostic naming the four platforms and
 * exits non-zero (`docs/wp12-release.md`, "Which compiler the package ships").
 */
export const assetFor = (platform, arch) => {
  const os = OS_BY_PLATFORM[platform];
  const cpu = ARCH_BY_CPU[arch];
  if (os === undefined || cpu === undefined) return null;
  return `${cpu}-${os}`;
};

/** The inverse, for the generator and the tests: an `asset` back to npm's pair. */
export const targetForAsset = (asset) => {
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
 * is scoped -- docs/wp12-release.md "The npm name"), and a list of five literal
 * names would be five places to edit if it ever moves again.
 */
export const platformPackageName = (packageName, asset) => `${packageName}-${asset}`;

/**
 * The diagnostic code every refusal here carries: `NL0002`, the toolchain code.
 *
 * Not a new code, and that is the point. `self/codes.ts` defines `NL0002` as
 * "the toolchain `--link` needs could not be used (exit 3)", and a prebuilt
 * compiler that is absent or will not start is the same class of failure seen
 * one step earlier: no source position, nothing wrong with the program, and the
 * thing that could not be run is a binary rather than the input. Reusing it
 * keeps the launcher out of the diagnostic registry entirely -- a code minted
 * here would be one `self/codes.ts` mirrors for a message the compiler can
 * never print, and `tests/diagnostic_coverage.js` would then want a case
 * provoking a rule that does not exist.
 */
export const NO_COMPILER_CODE = "NL0002";

/**
 * Why there is no compiler to run, and what to do about it: the one-line
 * `message` a `--json` object carries, and the report a person reads.
 *
 * **Both, from one function, because the contract is that they say the same
 * thing.** `AGENTS.md` promises that a failure with no source position is still
 * one JSON line under `--json` and that "you never have to read stderr to find
 * out why a run failed" -- so the refusal cannot be prose only, and the first
 * version of this file made it prose only, which broke that contract on a path
 * a user reaches with `--no-optional` on a fully supported platform.
 *
 * A pure function rather than `process.stderr.write` calls in the launcher, for
 * one reason: the branch a user on musl or FreeBSD hits is the branch no machine
 * in CI can reach, because every runner this project uses is one of the four
 * supported platforms. Written like this, `tests/run.js` can ask for that exact
 * message on any host and assert what it says, while the branch the harness
 * *can* reach is asserted end to end on the installed command. A diagnostic
 * nothing can test is how the advice in it goes stale.
 *
 * Three situations, and they get different advice because the remedy differs:
 *
 *   - `unsupported`: this project publishes no binary for the machine. Nothing
 *     about the install is wrong and reinstalling will not help, so the advice
 *     is the bootstrap, and INSTALL.md carries the part that needs more than
 *     four lines -- including that on musl no released binary may run at all.
 *   - `missing`: a binary exists for this platform and the install does not
 *     have it. Reinstalling is the remedy.
 *   - `unstartable`: it is installed and will not run. A broken or partly
 *     written install, named as one rather than reported as an unsupported
 *     platform.
 *
 * Every branch names the four platforms, because a user who has just been
 * refused wants to know whether the list is the whole list. It is.
 */
export const noCompilerMessage = ({ platform, arch, packageName, unstartable = null }) => {
  const asset = assetFor(platform, arch);
  const published = SUPPORTED_ASSETS.join("  ");
  const preamble =
    "  This package installs a prebuilt native compiler. One is published for:\n" +
    `    ${published}\n\n` +
    "  There is no compiler inside the package to fall back to, and nothing is\n" +
    "  compiled on your machine on any path.\n";
  if (asset === null) {
    return {
      code: NO_COMPILER_CODE,
      summary:
        `no prebuilt compiler for ${platform}/${arch}; one is published for ${published}, ` +
        "and there is none inside the package to fall back to. Build one from a released " +
        "`nish` that runs here: NISH_BOOTSTRAP=<nish> scripts/bootstrap.sh in a checkout " +
        "(docs/INSTALL.md)",
      report:
        `nish: no prebuilt compiler for ${platform}/${arch}\n\n${preamble}\n` +
        "  To get a compiler for this machine, build one from a released `nish` in a\n" +
        "  checkout of the repository:\n" +
        "    NISH_BOOTSTRAP=<a released nish that runs here> scripts/bootstrap.sh\n" +
        "  docs/INSTALL.md has the detail, including what to do when no released\n" +
        "  binary runs on this platform at all.\n",
    };
  }
  if (unstartable !== null) {
    return {
      code: NO_COMPILER_CODE,
      summary:
        `${unstartable.binary} could not be started (${unstartable.reason}); that is a broken ` +
        "or partly written install rather than an unsupported platform. Reinstall the " +
        "package, or run `npm rebuild` if the tree moved",
      report:
        `nish: ${unstartable.binary} could not be started (${unstartable.reason})\n\n${preamble}\n` +
        "  That is a broken or partly written install rather than an unsupported\n" +
        "  platform. Reinstall the package, or run `npm rebuild` if the tree moved.\n",
    };
  }
  // A `packageName` of `null` means this package's own `package.json` could not
  // be read, which is a broken install and not the moment to guess: naming the
  // wrong package sends the user to install something that does not exist, so
  // the sentence loses the name instead of inventing one.
  const named = packageName === null ? null : platformPackageName(packageName, asset);
  const pkg = named === null ? `the platform package for ${asset}` : named;
  return {
    code: NO_COMPILER_CODE,
    summary:
      `the prebuilt compiler for ${asset} is not installed; its package is ${pkg}, which npm ` +
      "installs automatically for this platform. Reinstall the package, or install the pair " +
      "by hand (docs/INSTALL.md)",
    report:
      `nish: the prebuilt compiler for ${asset} is not installed\n\n${preamble}\n` +
      `  Its package is ${pkg}, which npm installs\n` +
      "  automatically for this platform. An install that skipped it is usually\n" +
      "  `--no-optional`, a lockfile without the platform packages, or a registry that\n" +
      "  does not carry them yet. Reinstall the package, or install the pair by hand as\n" +
      "  docs/INSTALL.md shows.\n",
  };
};
