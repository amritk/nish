/**
 * `scripts/fetch-seed.sh`, checked against a stand-in `install.sh`.
 *
 *   node tests/fetch_seed.js
 *
 * The download itself is `install.sh`'s and `tests/run.js` checks it there;
 * what `fetch-seed.sh` adds is the logic around the call, and that is what
 * this checks: which arguments reach the installer, when the installer is not
 * called at all, which command lines are refused, and which of the installer's
 * output reaches the caller.
 *
 * No network, and nothing in the real `build/seed/`. Each check copies the
 * script into a fresh sandbox laid out as a checkout — `scripts/fetch-seed.sh`
 * and a stand-in `install.sh` at its root, which is where the script `cd`s to
 * — so it runs byte for byte what is checked in against an installer that
 * records its arguments and does what the check says. Exit 0 when every check
 * passes, 1 otherwise, and one PASS/FAIL line per check.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts", "fetch-seed.sh");

let failed = 0;
let passed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (ok) passed++;
  else {
    failed++;
    if (detail) console.log(String(detail).replace(/^/gm, "      "));
  }
};

/**
 * A stand-in installer. It appends its argument list to `install.calls`, and
 * then does what `mode` says: `ok` writes a `bin/nish` answering `nish
 * <version>` into the `--dir` it was given and prints the chatter a real
 * install prints; `fail` prints a reason and exits 1.
 */
const installer = (mode, version) => `#!/bin/sh
printf '%s\\n' "$*" >> install.calls
dir=""
while [ $# -gt 0 ]; do
  case "$1" in --dir) dir="$2"; shift 2 ;; *) shift ;; esac
done
if [ "${mode}" = fail ]; then
  echo "install: could not download (stand-in)" >&2
  exit 1
fi
mkdir -p "$dir/bin"
printf '#!/bin/sh\\necho "nish ${version}"\\n' > "$dir/bin/nish"
chmod +x "$dir/bin/nish"
echo "Put it on your PATH by adding this to your shell profile (stand-in chatter)"
`;

/** A sandbox checkout with the real script and a stand-in installer. */
const sandbox = (mode = "ok", version = "0.5.0") => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-seed-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(script, path.join(dir, "scripts", "fetch-seed.sh"));
  fs.writeFileSync(path.join(dir, "install.sh"), installer(mode, version));
  return dir;
};

/** A `build/seed/bin/nish` already in the sandbox, answering `--version` as given. */
const seedIn = (dir, answer) => {
  const bin = path.join(dir, "build", "seed", "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "nish"), `#!/bin/sh\n${answer}\n`);
  fs.chmodSync(path.join(bin, "nish"), 0o755);
};

const run = (dir, args) =>
  spawnSync("bash", [path.join(dir, "scripts", "fetch-seed.sh"), ...args], { encoding: "utf8" });

/** The installer's argument lists, one per call, or [] when it was never called. */
const calls = (dir) => {
  const file = path.join(dir, "install.calls");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n") : [];
};

const both = (r) => `status ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`;
const sandboxes = [];
const fresh = (...a) => {
  const dir = sandbox(...a);
  sandboxes.push(dir);
  return dir;
};

// No seed yet: the installer is called for the latest release into build/seed,
// its chatter is swallowed, and the line printed is the seed's own version.
{
  const dir = fresh();
  const r = run(dir, []);
  check(
    "with no seed it installs the latest release into build/seed",
    r.status === 0 && calls(dir).join("|") === "--dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  );
  check("and says which version it fetched", r.stdout === "fetch-seed: nish 0.5.0 in build/seed\n", both(r));
  check(
    "and keeps the installer's success chatter to itself",
    !r.stdout.includes("stand-in chatter") && !r.stderr.includes("stand-in chatter"),
    both(r)
  );

  // The same sandbox again: the seed runs, so nothing is fetched.
  const again = run(dir, []);
  check(
    "a seed that runs is left alone, without calling the installer",
    again.status === 0 && calls(dir).length === 1,
    `${both(again)}\ncalls: ${calls(dir)}`
  );
  check(
    "and says so",
    again.stdout === "fetch-seed: nish 0.5.0 in build/seed (already there)\n",
    both(again)
  );
}

// A seed that is there but does not run is not a seed: fetch it again.
{
  const dir = fresh();
  seedIn(dir, "exit 1");
  const r = run(dir, []);
  check(
    "a seed whose --version fails is fetched again",
    r.status === 0 && calls(dir).join("|") === "--dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  );
}

// --force and a version both go past the short-circuit, and reach the
// installer as install.sh spells them.
{
  const dir = fresh();
  seedIn(dir, 'echo "nish 0.4.0"');
  const r = run(dir, ["--force"]);
  check(
    "--force calls the installer even over a working seed, with --force",
    r.status === 0 && calls(dir).join("|") === "--force --dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  );
}
{
  const dir = fresh("ok", "0.4.0");
  seedIn(dir, 'echo "nish 0.5.0"');
  const r = run(dir, ["0.4.0"]);
  check(
    "a version is passed to the installer even over a working seed",
    r.status === 0 && calls(dir).join("|") === "0.4.0 --dir build/seed",
    `${both(r)}\ncalls: ${calls(dir)}`
  );
  check(
    "and the line printed is what the seed now says",
    r.stdout === "fetch-seed: nish 0.4.0 in build/seed\n",
    both(r)
  );
}

// Refusals: exit 2, a reason on stderr, and no installer call.
for (const [name, args, words] of [
  ["two versions are refused", ["0.4.0", "0.5.0"], "two versions given: 0.4.0 and 0.5.0"],
  ["an unknown option is refused", ["--bogus"], "unknown option --bogus"],
]) {
  const dir = fresh();
  const r = run(dir, args);
  check(
    `${name} with exit 2, before calling the installer`,
    r.status === 2 && r.stderr.includes(words) && calls(dir).length === 0,
    `${both(r)}\ncalls: ${calls(dir)}`
  );
}

// --help is the header, on stdout, and nothing else happens.
{
  const dir = fresh();
  const r = run(dir, ["--help"]);
  check(
    "--help prints the usage on stdout and installs nothing",
    r.status === 0 &&
      r.stdout.includes("scripts/fetch-seed.sh --force") &&
      !r.stdout.includes("set -eu") &&
      calls(dir).length === 0,
    both(r)
  );
}

// A failed install: exit 1, and the installer's own reason reaches stderr.
{
  const dir = fresh("fail");
  const r = run(dir, []);
  check(
    "a failed install exits 1 and passes the installer's reason on",
    r.status === 1 && r.stderr.includes("could not download (stand-in)"),
    both(r)
  );
}

for (const dir of sandboxes) fs.rmSync(dir, { recursive: true, force: true });
console.log(`fetch-seed: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
